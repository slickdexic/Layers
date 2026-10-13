<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/NativeCreationImportApiTest.php';

/**
 * Historical proof and fresh current admission for a still-unsaved Import target.
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase
 * @group Database
 */
class CreationImportRebaseTest extends NativeCreationImportApiTest {

	public static function provideRebaseTargets(): array {
		return [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ];
	}

	private function advance( array $fixture, string $main, ?array $document = null ): int {
		$access = TestingAccessWrapper::newFromObject( $this );
		if ( $document === null ) {
			return $this->editPage( $fixture['page'], $main )->getNewRevision()->getId();
		}
		return $access->registration['publisher']->publish( $fixture['page']->getTitle(), $access->actor,
			$fixture['revision'], JsonSnapshotCodec::encode( $document ), 'Independent newer base',
			new WikitextContent( $main ) );
	}

	private function request( array $fixture, int $current ): array {
		return [ 'action' => 'layersworkingcopyimportcreationrebase', 'formatversion' => 2,
			'targetpageid' => $fixture['page']->getId(), 'baserevid' => $current,
			'targetsurface' => $fixture['id'], 'originrevid' => $fixture['revision'],
			'originstart' => $fixture['start'], 'origintext' => $fixture['expected'] ];
	}

	/** @dataProvider provideRebaseTargets */
	public function testRebaseReturnsCanonicalCurrentMemberWithoutWriting( string $kind, bool $slot ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( $kind, $slot );
		$prefix = "Newer π heading\n";
		$document = $slot ? $f['document'] : null;
		if ( $slot ) {
			$document['surfaces'][0]['layers'][0]['text'] = 'Preserved newer sibling';
		}
		$current = $this->advance( $f, $prefix . $f['expected'], $document );
		$this->runDeferredUpdates();
		$before = $access->witness();
		$data = $access->readRequest( $this->request( $f, $current ) )['layersworkingcopyimportcreationrebase'];
		$this->assertSame( [ 'origin', 'creation' ], array_keys( $data ) );
		$this->assertSame( [ 'pageId' => $f['page']->getId(), 'revisionId' => $f['revision'],
			'surfaceId' => $f['id'], 'selection' => [ 'start' => $f['start'], 'expected' => $f['expected'] ] ],
			$data['origin'] );
		$creation = $data['creation'];
		$newId = NewPageDrawing::surfaceId( $f['page']->getId(), $current, $f['label'],
			$f['file'] ? 'File:' . $f['file']->getName() : null );
		$this->assertNotSame( $f['id'], $newId );
		$this->assertSame( $newId, $creation['target']['surfaceId'] );
		$this->assertSame( $newId, $creation['newSurface']['id'] );
		$this->assertSame( $current, $creation['target']['revisionId'] );
		$this->assertSame( $f['label'], $creation['newSurface']['label'] );
		$this->assertSame( $kind, $creation['newSurface']['kind'] );
		$this->assertSame( [], $creation['newSurface']['layers'] );
		$this->assertSame( [ 'start' => strlen( $prefix ), 'expected' => $f['expected'] ], $creation['selection'] );
		$this->assertSame( $slot, $creation['hasLayersSlot'] );
		$this->assertSame( $document, $creation['baseBundle']['snapshot'] ?? null );
		$access->privatePolicy( $access->readMain );
		$this->assertSame( $before, $access->witness(), 'Read-only re-admission preserves all ten fixture tables' );
	}

	public function testRebaseRefusesFabricatedHistoricalAssociation(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$current = $this->advance( $f, 'New prefix ' . $f['expected'] );
		$access->refused( array_replace( $this->request( $f, $current ), [ 'targetsurface' => 'fabricated' ] ) );
	}

	public function testRebaseAcceptsSameBaseWithoutInventingHistory(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$before = $access->witness();
		$data = $access->readRequest( $this->request( $f, $f['revision'] ) )
			['layersworkingcopyimportcreationrebase']['creation'];
		$this->assertSame( $f['id'], $data['target']['surfaceId'] );
		$this->assertSame( null, $data['baseBundle'] );
		$this->assertSame( $before, $access->witness() );
	}

	public function testRebasePreservesSourceClaimsOnARealFirstSaveFromTheNewBase(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->pair( 'image', true );
		$main = 'Independent prefix ' . $f['expected'];
		$current = $this->advance( $f, $main, $f['document'] );
		$data = $access->readRequest( $this->request( $f, $current ) )
			['layersworkingcopyimportcreationrebase']['creation'];
		$oldId = $f['id'];
		$f['id'] = $data['target']['surfaceId'];
		$f['revision'] = $current;
		$f['start'] = $data['selection']['start'];
		$f['proposed']['surfaces'][1]['id'] = $f['id'];
		$access->refused( array_replace( $access->params( $f ), [ 'targetsurface' => $oldId ] ) );
		$access->refused( array_replace( $access->params( $f, true ), [ 'targetsurface' => $oldId ] ), true );
		$before = $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows();
		$id = $this->doApiRequestWithToken( $access->params( $f, true ), null, $access->actor )[0]
			['layersworkingcopyimportcreationpublish']['revid'];
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertSame( $current, $stored->getParentId() );
		$this->assertSame( $f['page']->getId(), $stored->getPageId() );
		$this->assertSame( $main, $stored->getContent( 'main' )->getText() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['proposed'] ), $stored->getContent( 'layers' )->getText() );
		$this->assertStringContainsString( (string)$f['source']['sourceRevisionId'], $stored->getComment()->text );
		$this->assertSame( $before + 1, $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows() );
	}

	public function testRebaseRefusesWrongOwnerRevisionOffsetAndRawBytes(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$other = $access->fixture();
		$current = $this->advance( $f, 'New ' . $f['expected'] );
		foreach ( [ [ 'targetpageid' => $other['page']->getId() ], [ 'originrevid' => $other['revision'] ],
			[ 'originstart' => 0 ], [ 'origintext' => $f['expected'] . ' forged' ],
			[ 'originrevid' => $current + 1 ], [ 'baserevid' => $f['revision'] ] ] as $change ) {
			$access->refused( array_replace( $this->request( $f, $current ), $change ) );
		}
	}

	public static function provideChangedEmbeds(): array {
		return [ [ 'removed' ], [ 'changed' ], [ 'nowiki' ], [ 'comment' ], [ 'includeonly' ], [ 'template' ] ];
	}

	/** @dataProvider provideChangedEmbeds */
	public function testRebaseRefusesChangedRemovedOrOpaqueCurrentEmbed( string $variant ): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$embed = $f['expected'];
		$main = [ 'removed' => 'Removed', 'changed' => str_replace( 'ABC', 'Different', $embed ),
			'nowiki' => '<nowiki>' . $embed . '</nowiki>', 'comment' => '<!--' . $embed . '-->',
			'includeonly' => '<includeonly>' . $embed . '</includeonly>',
			'template' => '{{Unknown|' . $embed . '}}' ][$variant];
		$current = $this->advance( $f, $main );
		$access->refused( $this->request( $f, $current ) );
	}

	public function testRebaseRefusesAnOccupiedCurrentName(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->pair();
		$current = $this->advance( $f, $f['expected'], $f['proposed'] );
		$access->refused( $this->request( $f, $current ) );
	}

	public function testRebaseRefusesAnOldIdCollisionInAnUnrelatedCurrentMember(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'slide', true );
		$document = $f['document'];
		$document['surfaces'][0]['id'] = $f['id'];
		$current = $this->advance( $f, 'New ' . $f['expected'], $document );
		$access->refused( $this->request( $f, $current ) );
	}

	public function testRebaseRefusesANameThatWasStoredAtTheClaimedOrigin(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->pair();
		$f['revision'] = $this->advance( $f, $f['expected'], $f['proposed'] );
		$f['start'] = 0;
		$f['id'] = NewPageDrawing::surfaceId( $f['page']->getId(), $f['revision'], $f['label'] );
		$current = $this->advance( $f, $f['expected'], [ 'schemaVersion' => 1, 'surfaces' => [] ] );
		$access->refused( $this->request( $f, $current ) );
	}

	public function testRebaseRefusesSuppressedHistoricalText(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$current = $this->advance( $f, 'New ' . $f['expected'] );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $f['revision'] ] )->caller( __METHOD__ )->execute();
		$access->refused( $this->request( $f, $current ) );
	}

	public function testRebaseReadOnlyRouteRequiresPostEditAuthorityAndBoundedParameters(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture();
		$current = $this->advance( $f, 'New ' . $f['expected'] );
		$request = $this->request( $f, $current );
		$access->posted = false;
		$access->refused( $request, false, 'mustbeposted' );
		$access->posted = true;
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$access->refused( $request, false, 'layers-working-copy-import-unavailable', $reader );
		$missing = $request;
		unset( $missing['origintext'] );
		$access->refused( $missing, false, 'missingparam' );
		$access->refused( array_replace( $request, [ 'originstart' => -1 ] ), false, 'outofrange' );
		$access->refused( array_replace( $request, [ 'origintext' => str_repeat( 'x', 2097153 ) ] ),
			false, 'maxbytes' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertSame( ApiLayersWorkingCopyImportCreationRebase::class,
			$definitions[$request['action']]['class'] );
		$module = ( $definitions[$request['action']]['factory'] )( $access->readMain, 'rebasealias' );
		$this->assertSame( 'rebasealias', $module->getModuleName() );
		$this->assertFalse( $module->isWriteMode() );
		$this->assertTrue( $module->mustBePosted() );
		$this->assertFalse( $module->needsToken() );
		$access->privatePolicy( $access->readMain );
	}

	public function testRebaseRefusesWhenStoredBaseChangesBetweenCaptures(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'slide', true );
		$current = $this->advance( $f, 'New ' . $f['expected'], $f['document'] );
		$pilot = TestingAccessWrapper::newFromObject( $f['pilot'] );
		$native = $pilot->reader;
		$reader = $this->createMock( PageReadService::class );
		$count = 0;
		$reader->method( 'read' )->willReturnCallback( static function ( ...$args ) use ( $native, &$count ) {
			$result = $native->read( ...$args );
			if ( ++$count >= 6 ) {
				$result['snapshot']['surfaces'][0]['layers'][0]['text'] = 'Changed capture';
			}
			return $result;
		} );
		$pilot->reader = $reader;
		try {
			$access->refused( $this->request( $f, $current ) );
		} finally {
			$pilot->reader = $native;
		}
		$this->assertGreaterThanOrEqual( 6, $count, 'Complete capture comparison must be exercised' );
	}

	public function testRebaseRepeatsHistoricalVisibilityAfterCurrentPreparation(): void {
		$access = TestingAccessWrapper::newFromObject( $this );
		$f = $access->fixture( 'slide', true );
		$current = $this->advance( $f, 'New ' . $f['expected'], $f['document'] );
		$pilot = TestingAccessWrapper::newFromObject( $f['pilot'] );
		$native = $pilot->reader;
		$reader = $this->createMock( PageReadService::class );
		$originReads = 0;
		$afterSuppression = null;
		$caller = __METHOD__;
		$reader->method( 'read' )->willReturnCallback( function ( ...$args ) use ( $native, $f, $current,
			&$originReads, &$afterSuppression, $access, $caller
		) {
			$result = $native->read( ...$args );
			if ( $args[1] === $f['revision'] ) {
				$originReads++;
			} elseif ( $args[1] === $current && $originReads >= 2 && $afterSuppression === null ) {
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $f['revision'] ] )->caller( $caller )->execute();
				$afterSuppression = $access->witness();
			}
			return $result;
		} );
		$pilot->reader = $reader;
		try {
			$access->readRequest( $this->request( $f, $current ) );
			$this->fail( 'Historical suppression during current preparation must refuse the complete response' );
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-working-copy-import-unavailable' ) );
			$this->assertArrayNotHasKey( 'layersworkingcopyimportcreationrebase',
				$access->readMain->getResult()->getResultData() );
			$access->privatePolicy( $access->readMain );
		} finally {
			$pilot->reader = $native;
		}
		$this->assertNotNull( $afterSuppression, 'Late native suppression must execute' );
		$this->assertSame( $afterSuppression, $access->witness(), 'The read itself writes nothing' );
	}
}
