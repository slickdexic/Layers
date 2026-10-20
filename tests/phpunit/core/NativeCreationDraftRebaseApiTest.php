<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/NativeCreationImportApiTest.php';

/**
 * Registered native read boundary only; no browser/editor callers or draft writes.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @group Database
 */
class NativeCreationDraftRebaseApiTest extends NativeCreationImportApiTest {

	private function current( array $f, ?string $main = null ): int {
		return $this->editPage( $f['page'], $main ?? 'Current π prefix ' . $f['expected'] )
			->getNewRevision()->getId();
	}

	private function request( array $f, int $current ): array {
		return [ 'action' => 'layersworkingcopyimportcreationdraftrebase', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $current,
			'originrevid' => $f['revision'], 'originsurface' => $f['id'] ];
	}

	public static function provideDraftApiTargets(): array {
		return [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ];
	}

	/** @dataProvider provideDraftApiTargets */
	public function testNativeRouteProvesTheExactOwnerHistoryWithoutWriting( string $kind, bool $slot ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( $kind, $slot );
		// The accepted publisher preserves a preexisting Layers slot during a main-text edit.
		if ( $slot ) {
			$current = $access->registration['publisher']->publish( $f['page']->getTitle(), $access->actor,
				$f['revision'], json_encode( $f['document'] ), 'Current fixture base',
				new \MediaWiki\Content\WikitextContent( 'Current π prefix ' . $f['expected'] ) );
		} else {
			$current = $this->current( $f );
		}
		$this->runDeferredUpdates();
		$before = $access->witness();
		$data = $access->readRequest( $this->request( $f, $current ) )
			['layersworkingcopyimportcreationdraftrebase'];
		$this->assertSame( [ 'origin', 'creation' ], array_keys( $data ) );
		$this->assertSame( [ 'pageId' => $f['page']->getId(), 'revisionId' => $f['revision'],
			'surfaceId' => $f['id'], 'selection' => [ 'start' => $f['start'], 'expected' => $f['expected'] ] ],
			$data['origin'] );
		$this->assertSame( $current, $data['creation']['target']['revisionId'] );
		$this->assertSame( $kind, $data['creation']['newSurface']['kind'] );
		$this->assertSame( $f['label'], $data['creation']['newSurface']['label'] );
		$this->assertSame( $slot, $data['creation']['hasLayersSlot'] );
		$this->assertSame( $slot ? $f['document'] : null, $data['creation']['baseBundle']['snapshot'] ?? null );
		$this->assertSame( NewPageDrawing::surfaceId( $f['page']->getId(), $current, $f['label'],
			$f['file'] ? $f['file']->getTitle()->getPrefixedDBkey() : null ), $data['creation']['newSurface']['id'] );
		$access->privatePolicy( $access->readMain );
		$this->assertSame( $before, $access->witness() );
	}

	public function testPostAuthorityAndEveryRequiredBoundedParameter(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$request = $this->request( $f, $this->current( $f ) );
		$access->posted = false;
		$access->refused( $request, false, 'mustbeposted' );
		$access->privatePolicy( $access->readMain );
		$access->posted = true;
		$user = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$access->refused( $request, false, 'layers-working-copy-import-unavailable', $user );
		foreach ( [ 'targetpageid', 'baserevid', 'originrevid', 'originsurface' ] as $key ) {
			$missing = $request;
			unset( $missing[$key] );
			$access->refused( $missing, false, 'missingparam' );
			$access->privatePolicy( $access->readMain );
		}
		foreach ( [ 'targetpageid', 'baserevid', 'originrevid' ] as $key ) {
			foreach ( [ 0, -1, 2147483648 ] as $value ) {
				$access->refused( array_replace( $request, [ $key => $value ] ), false, 'outofrange' );
			}
		}
		$access->refused( array_replace( $request, [ 'originsurface' => str_repeat( 'x', 129 ) ] ),
			false, 'maxbytes' );
		$access->refused( array_replace( $request, [ 'originsurface' => 'invalid id' ] ) );
	}

	public function testForeignHistoryFabricatedIdsAndChangedEmbedsRefuseWithoutData(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$other = $access->fixture();
		$current = $this->current( $f );
		$request = $this->request( $f, $current );
		foreach ( [ [ 'originrevid' => $other['revision'] ], [ 'originsurface' => $other['id'] ],
			[ 'originsurface' => 'fabricated' ], [ 'originrevid' => $current + 1 ],
			[ 'baserevid' => $f['revision'] ], [ 'targetpageid' => $other['page']->getId() ] ] as $change ) {
			$access->refused( array_replace( $request, $change ) );
			$this->assertArrayNotHasKey( $request['action'], $access->readMain->getResult()->getResultData() );
		}
		$current = $this->editPage( $f['page'], '{{#Slide:Other}}' )->getNewRevision()->getId();
		$access->refused( $this->request( $f, $current ) );
	}

	public function testSuppressedAndAmbiguousHistoricalAssociationsRefuse(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$f['revision'] = $this->editPage( $f['page'], $f['expected'] . "\n" . $f['expected'] )
			->getNewRevision()->getId();
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], $f['label'] );
		$current = $this->current( $f );
		$access->refused( $this->request( $f, $current ) );
		$f = $access->fixture();
		$current = $this->current( $f );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $f['revision'] ] )->caller( __METHOD__ )->execute();
		$access->refused( $this->request( $f, $current ) );
	}

	public function testLazyRegistrationAliasesAndExistingParameterContractStayIntact(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$definition = $definitions['layersworkingcopyimportcreationdraftrebase'];
		$this->assertSame( ApiLayersWorkingCopyImportCreationDraftRebase::class, $definition['class'] );
		$module = ( $definition['factory'] )( $access->readMain ?? new \MediaWiki\Api\ApiMain(), 'draftproofalias' );
		$this->assertSame( 'draftproofalias', $module->getModuleName() );
		$this->assertFalse( $module->isWriteMode() );
		$this->assertFalse( $module->needsToken() );
		$this->assertTrue( $module->mustBePosted() );
		$this->assertSame( [ 'exacttext', 'targetpageid', 'baserevid', 'originrevid', 'originsurface' ],
			array_keys( $module->getAllowedParams() ) );
		$old = ( $definitions['layersworkingcopyimportcreationrebase']['factory'] )(
			$module->getMain(), 'originalproofalias' );
		$this->assertTrue( $old->getAllowedParams()['origintext'][\MediaWiki\Api\ApiBase::PARAM_REQUIRED] );
		$this->assertTrue( $old->getAllowedParams()['originstart'][\MediaWiki\Api\ApiBase::PARAM_REQUIRED] );
	}

	public function testResponseUsesTheRegisteredAliasAndRefusesPublicCaching(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$current = $this->current( $f );
		$definitions = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$definitions['draftproofalias'] = PageOwnedPilotRegistration::apiModules()
			['layersworkingcopyimportcreationdraftrebase'];
		$this->overrideConfigValue( 'APIModules', $definitions );
		$request = array_replace( $this->request( $f, $current ), [ 'action' => 'draftproofalias',
			'maxage' => 3600, 'smaxage' => 3600 ] );
		$before = $access->witness();
		$data = $access->readRequest( $request );
		$this->assertArrayHasKey( 'draftproofalias', $data );
		$this->assertArrayNotHasKey( 'layersworkingcopyimportcreationdraftrebase', $data );
		$this->assertSame( $f['id'], $data['draftproofalias']['origin']['surfaceId'] );
		$access->privatePolicy( $access->readMain );
		$this->assertSame( $before, $access->witness() );
	}
}
