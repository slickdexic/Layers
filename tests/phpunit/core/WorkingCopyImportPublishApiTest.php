<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPublish
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class WorkingCopyImportPublishApiTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private array $pair = [];
	private array $documents = [];
	private bool $posted = true;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		if ( getenv( 'LAYERS_O_API_SOURCE' ) ) {
			$definitions['layerspublish']['factory'] = function ( $main, $name ) {
				$original = $this->pilot->newPublishApi( $main, $name );
				$parts = TestingAccessWrapper::newFromObject( $original );
				$class = 'MediaWiki\\Extension\\Layers\\Api\\J116OCopiedPublish';
				return new $class( $main, $name, $parts->publisher, $parts->titles,
					$parts->scope, $parts->importPublisherFactory );
			};
		}
		$this->overrideConfigValue( 'APIModules', array_replace( $modules, $definitions ) );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		foreach ( [ 'target', 'source' ] as $role ) {
			$document = json_decode( file_get_contents(
				__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
			$document['surfaces'][0]['layers'][0]['text'] = 'Independent ' . $role . ' text';
			$sibling = $document['surfaces'][0];
			$sibling['id'] = 'offscreen';
			$sibling['label'] = 'Offscreen';
			$document['surfaces'][] = $sibling;
			$page = $this->getExistingTestPage( 'ImportApi ' . $role . ' ' . wfRandomString( 8 ) );
			$id = $this->ordinary( $page->getTitle()->getPrefixedText(), $page->getLatest(), $document );
			$this->documents[$role] = $document;
			$this->pair[$role] = [ 'page' => $page, 'pageId' => $page->getId(), 'revisionId' => $id ];
		}
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, $this->posted, $session );
	}

	private function ordinary( string $owner, int $base, array $document ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $owner,
			'baserevid' => $base, 'data' => JsonSnapshotCodec::encode( $document ),
			'summary' => 'Isolated API fixture' ], null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function descriptor(): array {
		return [ 'sourcePageId' => $this->pair['source']['pageId'],
			'sourceRevisionId' => $this->pair['source']['revisionId'],
			'sourceSurfaceId' => 'presentation', 'targetSurfaceId' => 'presentation' ];
	}

	private function proposed(): array {
		$document = $this->documents['target'];
		$document['surfaces'][0]['layers'] = $this->documents['source']['surfaces'][0]['layers'];
		$document['surfaces'][0]['layers'][0]['id'] = 'fresh';
		$document['surfaces'][0]['readingOrder'] = [ 'fresh' ];
		return $document;
	}

	private function params(): array {
		return [ 'action' => 'layerspublish', 'owner' => $this->pair['target']['page']->getTitle()->getPrefixedText(),
			'pageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
			'data' => JsonSnapshotCodec::encode( $this->proposed() ),
			'importsources' => JsonSnapshotCodec::encode( [ $this->descriptor() ] ), 'summary' => 'Owner note 世界' ];
	}

	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'content' => 'content_id', 'text' => 'old_id', 'comment' => 'comment_id',
			'change_tag' => 'ct_id', 'change_tag_def' => 'ctd_id' ] as $table => $order ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$state[$table] = array_map( static fn ( $row ) => (array)$row, iterator_to_array(
				$this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
					->caller( __METHOD__ )->fetchResultSet() ) );
		}
		return $state;
	}

	private function refused( array $params, string $code = 'layers-working-copy-import-unavailable',
		?Authority $actor = null, ?string $token = 'csrf'
	): void {
		$before = $this->state();
		try {
			$this->doApiRequest( $params, null, false, $actor ?? $this->actor, $token );
			$this->fail( 'Unavailable Import must not publish through the API' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
		}
		$this->assertSame( $before, $this->state(), 'Refusal must preserve all eight fixture tables' );
	}

	public function testNativeApiSaveRecordsSourceCitationNotePayloadAndOnlyOneOwnerRevision(): void {
		$before = $this->state();
		$result = $this->doApiRequestWithToken( $this->params(), null, $this->actor )[0]['layerspublish'];
		$this->assertSame( [ 'result', 'revid' ], array_keys( $result ) );
		$this->assertSame( 'Success', $result['result'] );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $result['revid'] );
		$expected = wfMessage( 'layers-copy-summary' )->plaintextParams( 'Welcome Slide' )
			->params( $this->pair['source']['page']->getTitle()->getPrefixedText(),
				(string)$this->pair['source']['revisionId'] )->inContentLanguage()->text() . ': Owner note 世界';
		$this->assertSame( $expected, $revision->getComment()->text );
		$this->assertSame( $this->pair['target']['pageId'], $revision->getPageId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( JsonSnapshotCodec::encode( $this->proposed() ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$base = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$this->pair['target']['revisionId'] );
		$this->assertSame( $base->getContent( SlotRecord::MAIN )->serialize(),
			$revision->getContent( SlotRecord::MAIN )->serialize() );
		$this->assertCount( count( $before['revision'] ) + 1, $this->state()['revision'] );
		$sourceRevision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$this->pair['source']['page']->getTitle(), 0, IDBAccessObject::READ_LATEST );
		$this->assertSame( $this->pair['source']['revisionId'], $sourceRevision->getId() );
	}

	public function testOmittedOptionKeepsOrdinaryPublicationAndFactoryLazy(): void {
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$modules['layerspublish']['factory'] = function ( $main, $name ) {
			$parts = TestingAccessWrapper::newFromObject( $this->pilot->newPublishApi( $main, $name ) );
			return new ApiLayersPublish( $main, $name, $parts->publisher, $parts->titles, $parts->scope,
				static function () { throw new \LogicException( 'Lazy service must not be requested' );
				} );
		};
		$this->overrideConfigValue( 'APIModules', $modules );
		$params = $this->params();
		unset( $params['importsources'] );
		$id = $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
		$this->assertSame( $params['summary'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $id )->getComment()->text );
	}

	public function testBoundOwnerTitleMustMatchPageIdWithoutAnyWrites(): void {
		$params = $this->params();
		$params['owner'] = $this->pair['source']['page']->getTitle()->getPrefixedText();
		$this->refused( $params );
	}

	/** @dataProvider provideMalformedSources @param string $json */
	public function testMalformedSourcesNeverReachPublication( string $json ): void {
		$this->refused( array_replace( $this->params(), [ 'importsources' => $json ] ) );
	}

	/** @return array[] */
	public static function provideMalformedSources(): array {
		$valid = '{"sourcePageId":1,"sourceRevisionId":2,"sourceSurfaceId":"presentation",' .
			'"targetSurfaceId":"presentation"}';
		return [ [ '' ], [ 'null' ], [ 'true' ], [ '{}' ], [ '[]' ], [ '[' ], [ '[null]' ], [ '[[]]' ],
			[ '{"0":' . $valid . '}' ], [ '[' . str_replace( '"sourcePageId":1',
				'"sourcePageId":1,"sourcePageId":2', $valid ) . ']' ],
			[ '[' . str_replace( '"sourcePageId":1', '"sourcePageId":1,"sourcePage\\u0049d":2', $valid ) . ']' ],
			[ '[' . implode( ',', array_fill( 0, 33, $valid ) ) . ']' ] ];
	}

	public function testDuplicateValidDescriptorKeysRefuseBeforeNativeSave(): void {
		$json = JsonSnapshotCodec::encode( [ $this->descriptor() ] );
		$id = $this->pair['source']['pageId'];
		$json = str_replace( '"sourcePageId":' . $id,
			'"sourcePageId":' . $id . ',"sourcePage\\u0049d":' . $id, $json );
		$this->refused( array_replace( $this->params(), [ 'importsources' => $json ] ) );
	}

	public function testMissingBoundIdentityNewBaseAndSimultaneousMainTextRefuse(): void {
		$params = $this->params();
		unset( $params['pageid'] );
		$this->refused( $params );
		$this->refused( array_replace( $this->params(), [ 'baserevid' => 0 ] ) );
		foreach ( [ '', 'Do not replace the owning page' ] as $text ) {
			$this->refused( array_replace( $this->params(), [ 'maintext' => $text ] ) );
		}
	}

	public function testWrongMemberRevisionAndUnknownDescriptorFieldsRefuse(): void {
		foreach ( [ [ 'sourceRevisionId' => $this->pair['target']['revisionId'] ],
			[ 'sourceSurfaceId' => 'absent' ], [ 'targetSurfaceId' => 'absent' ],
			[ 'sourcePageId' => $this->pair['target']['pageId'] ], [ 'extra' => 'No client authority' ],
			[ 'sourcePageId' => (string)$this->pair['source']['pageId'] ] ] as $change ) {
			$this->refused( array_replace( $this->params(), [ 'importsources' => JsonSnapshotCodec::encode(
				[ array_replace( $this->descriptor(), $change ) ] ) ] ) );
		}
	}

	public function testNativeVisibilityStaleBaseAndNoopRefuseWithoutWrites(): void {
		$this->refused( array_replace( $this->params(), [ 'data' =>
			JsonSnapshotCodec::encode( $this->documents['target'] ) ] ) );
		$source = $this->pair['source']['revisionId'];
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $source ] )->caller( __METHOD__ )->execute();
		$this->refused( $this->params() );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $source ] )->caller( __METHOD__ )->execute();
		$later = $this->documents['target'];
		$later['surfaces'][0]['layers'][0]['text'] = 'Intervening native edit';
		$this->ordinary( $this->params()['owner'], $this->pair['target']['revisionId'], $later );
		$this->refused( $this->params() );
	}

	public function testNativeTokenPostPermissionScopeAndSizeAdmissionRemainInForce(): void {
		$this->refused( $this->params(), 'missingparam', null, null );
		$this->posted = false;
		$this->refused( $this->params(), 'mustbeposted' );
		$this->posted = true;
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->refused( $this->params(), 'permissiondenied', $reader );
		$this->refused( array_replace( $this->params(), [ 'owner' => 'File:OutOfScope.png' ] ),
			'layers-publication-disabled' );
		$this->refused( array_replace( $this->params(), [ 'importsources' => str_repeat( ' ', 16385 ) ] ), 'maxbytes' );
	}

	public function testFactoryComposesTheAcceptedNativeServicesAndOptionalContract(): void {
		$main = new \MediaWiki\Api\ApiMain( new FauxRequest() );
		$module = $this->pilot->newPublishApi( $main, 'layerspublish' );
		$parts = TestingAccessWrapper::newFromObject( $module );
		$native = TestingAccessWrapper::newFromObject( ( $parts->importPublisherFactory )() );
		$pilot = TestingAccessWrapper::newFromObject( $this->pilot );
		$this->assertSame( $pilot->publisher, $native->publisher );
		$reader = TestingAccessWrapper::newFromObject( $native->reader );
		$this->assertSame( $pilot->reader, $reader->reader );
		$this->assertSame( $this->pilot->getScope(), $reader->scope );
		$this->assertSame( 'string', $module->getAllowedParams()['importsources'][ApiBase::PARAM_TYPE] );
		$this->assertSame( 16384, $module->getAllowedParams()['importsources'][ApiBase::PARAM_MAX_BYTES] );
		$this->assertArrayNotHasKey( ApiBase::PARAM_REQUIRED, $module->getAllowedParams()['importsources'] );
		$this->assertSame( 'csrf', $module->needsToken() );
		$this->assertTrue( $module->isWriteMode() && $module->mustBePosted() );
	}

	public function testOlderCompositionRefusesExplicitSourcesWithoutFallback(): void {
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$modules['layerspublish']['factory'] = function ( $main, $name ) {
			$parts = TestingAccessWrapper::newFromObject( $this->pilot->newPublishApi( $main, $name ) );
			return new ApiLayersPublish( $main, $name, $parts->publisher, $parts->titles, $parts->scope );
		};
		$this->overrideConfigValue( 'APIModules', $modules );
		$this->refused( $this->params() );
	}

	public function testLateSuppressionAfterSaveRollsBackThroughNativeApi(): void {
		$source = $this->pair['source']['revisionId'];
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( 'RevisionFromEditComplete', function () use ( $source, &$entered, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $source ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$this->refused( $this->params() );
		$this->assertTrue( $entered );
		$id = $this->doApiRequestWithToken( $this->params(), null, $this->actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $id );
	}

	public function testNativeImageImportPreservesTheTargetPinAndUnrelatedMember(): void {
		$s = $this->getServiceContainer();
		$title = $s->getTitleFactory()->newFromText( 'File:ImportApi' . wfRandomString( 8 ) . '.png' );
		$input = $this->getNewTempFile();
		file_put_contents( $input, base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA' .
			'C0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' ) );
		$file = $s->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Isolated PNG', 'Import API', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
		$pin = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedDBkey(),
			'sha1' => $file->getSha1(), 'timestamp' => '20260906120000', 'page' => 1 ];
		foreach ( [ 'target', 'source' ] as $role ) {
			$this->documents[$role]['surfaces'][0]['kind'] = 'image';
			$this->documents[$role]['surfaces'][0]['source'] = $pin;
			$this->pair[$role]['revisionId'] = $this->ordinary(
				$this->pair[$role]['page']->getTitle()->getPrefixedText(), $this->pair[$role]['revisionId'],
				$this->documents[$role] );
		}
		$id = $this->doApiRequestWithToken( $this->params(), null, $this->actor )[0]['layerspublish']['revid'];
		$document = json_decode( $s->getRevisionLookup()->getRevisionById( $id )
			->getContent( PageRevisionWriter::SLOT )->serialize(), true );
		$this->assertEquals( $this->proposed(), $document );
		$this->assertEquals( $pin, $document['surfaces'][0]['source'] );
		$this->assertSame( JsonSnapshotCodec::encode( $this->documents['target']['surfaces'][1] ),
			JsonSnapshotCodec::encode( $document['surfaces'][1] ) );
	}

	public function testRepeatedDescriptorsProduceOneNativeCitation(): void {
		$params = $this->params();
		$params['importsources'] = JsonSnapshotCodec::encode(
			[ $this->descriptor(), array_reverse( $this->descriptor(), true ) ] );
		$id = $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
		$text = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id )->getComment()->text;
		$this->assertSame( 1, substr_count( $text, $this->pair['source']['page']->getTitle()->getPrefixedText() ) );
		$this->assertStringContainsString( 'Owner note 世界', $text );
	}

	public function testTheCompleteNativeSummaryCannotBeSilentlyTruncated(): void {
		$this->refused( array_replace( $this->params(), [ 'summary' => str_repeat( 'x', 500 ) ] ) );
	}
}
