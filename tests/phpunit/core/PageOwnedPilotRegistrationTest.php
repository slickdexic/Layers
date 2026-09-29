<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilotImporter;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilotMergeFactory;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Status\Status;
use MediaWiki\User\User;
use RuntimeException;
use Wikimedia\Rdbms\IDBAccessObject;
use WikiRevision;

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @group Database
 * @group API
 */
class PageOwnedPilotRegistrationTest extends \MediaWiki\Tests\Api\ApiTestCase {
	/** @var \Wikimedia\ScopedCallback|null Native registry override, restored during teardown */
	private $bootstrapHookOverride;

	protected function setUp(): void {
		parent::setUp();
		$registry = \MediaWiki\Registration\ExtensionRegistry::getInstance();
		$hooks = $registry->getAttribute( 'Hooks' );
		$hooks['MediaWikiServices'] = array_values( array_filter( $hooks['MediaWikiServices'] ?? [],
			static function ( $handler ) {
				return strpos( json_encode( $handler ), 'PageOwnedPilotRegistration' ) === false;
			} ) );
		// Disable only automatic Layers installation in this bootstrap fixture. Each test
		// explicitly invokes the real registration method once with its own scope.
		$this->bootstrapHookOverride = $registry->setAttributeForTest( 'Hooks', $hooks );
		$this->overrideMwServices( new \MediaWiki\Config\HashConfig( [ 'LayersPageDrawingNamespaces' => null ] ) );
	}

	protected function tearDown(): void {
		try {
			parent::tearDown();
		} finally {
			$this->bootstrapHookOverride = null;
		}
	}

	public function testExtensionCallbackInstallsPairedModules(): void {
		$this->setMwGlobals( [ 'wgAPIModules' => [ 'unrelated' => 'UnrelatedModule' ] ] );
		PageOwnedPilotRegistration::onRegistration( [] );
		$modules = $GLOBALS['wgAPIModules'];
		$this->assertArrayHasKey( 'layersread', $modules );
		$this->assertArrayHasKey( 'layerspublish', $modules );
		$this->assertArrayHasKey( 'mergehistory', $modules );
		$this->assertSame( 'UnrelatedModule', $modules['unrelated'] );
	}

	public function testExtensionCallbackRejectsConflictWithoutPartialInstallation(): void {
		$modules = [ 'mergehistory' => 'AnotherMergeModule' ];
		$this->setMwGlobals( [ 'wgAPIModules' => $modules ] );
		try {
			PageOwnedPilotRegistration::onRegistration( [] );
			$this->fail( 'Expected conflicting registration to reject' );
		} catch ( \LogicException $e ) {
			$this->assertSame( 'Conflicting Layers pilot API registration', $e->getMessage() );
		}
		$this->assertSame( $modules, $GLOBALS['wgAPIModules'] );
	}

	/**
	 * @param int[]|null $namespaces $wgLayersPageDrawingNamespaces
	 * @return MediaWikiServices
	 */
	private function bootstrap( ?array $namespaces ): MediaWikiServices {
		$modules = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$this->overrideConfigValues( [
			'LayersPageDrawingNamespaces' => $namespaces,
			'APIModules' => array_replace( $modules, PageOwnedPilotRegistration::apiModules() ),
		] );
		$s = $this->getServiceContainer();
		( new PageOwnedPilotRegistration() )->onMediaWikiServices( $s );
		return $s;
	}

	private function getAuthorizedActor(
		array $permissions = [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ]
	): User {
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, $permissions );
		return $actor;
	}

	public function testProtectionIsInstalledEvenWhereNoPageMayStartDrawings(): void {
		$s = $this->bootstrap( [] );
		$this->assertTrue( $s->getContentHandlerFactory()->isDefinedModel( LayersDocumentContent::MODEL ) );
		$this->assertTrue( $s->getSlotRoleRegistry()->isDefinedRole( PageRevisionWriter::SLOT ) );
		$this->assertInstanceOf( PageOwnedPilotMergeFactory::class, $s->getMergeHistoryFactory() );
		$this->assertInstanceOf( PageOwnedPilotImporter::class, $s->getWikiRevisionOldRevisionImporter() );
		// Drawings belong to the PageID, so moves need no guard.
		$status = Status::newGood();
		$s->getHookContainer()->run( 'MovePageIsValidMove', [
			$s->getTitleFactory()->newFromText( 'Layers bootstrap test' ),
			$s->getTitleFactory()->newFromText( 'Layers other title' ), $status
		] );
		$this->assertTrue( $status->isOK() );
		$this->expectApiErrorCode( 'layers-revision-unavailable' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => 'Layers bootstrap test', 'revid' => 1 ] );
	}

	public function testDefaultBootstrapPublishesAndReadsOnContentPagesWithoutConfiguration(): void {
		$s = $this->bootstrap( null );
		$scope = $s->getService( 'LayersPageOwnedPilot' )->getScope();
		$titles = $s->getTitleFactory();
		// The default is the content namespaces and File:, with no owner list or switch (D2).
		$this->assertTrue( $scope->isEnrolled( $titles->newFromText( 'Any page' ) ) );
		$this->assertTrue( $scope->isEnrolled( $titles->newFromText( 'File:Any.png' ) ) );
		$this->assertFalse( $scope->isEnrolled( $titles->newFromText( 'Project:Any page' ) ) );
		$this->assertInstanceOf( PageOwnedPilotImporter::class, $s->getWikiRevisionOldRevisionImporter() );
		$this->assertInstanceOf( PageOwnedPilotImporter::class, $s->getWikiRevisionOldRevisionImporterNoUpdates() );
		$this->assertInstanceOf( PageOwnedPilotMergeFactory::class, $s->getMergeHistoryFactory() );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$result = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => 'Layers bootstrap test',
			'baserevid' => 0, 'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'Bootstrap test'
		], null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $result['result'] );
		$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => 'Layers bootstrap test',
			'revid' => $result['revid'] ], null, false, $actor )[0]['layersread'];
		$this->assertSame( $result['revid'], $read['revisionId'] );
		$this->assertSame( [], $read['snapshot']['surfaces'] );
	}

	public function testConfiguredNamespacesLimitWherePagesStartOwningDrawings(): void {
		$s = $this->bootstrap( [ NS_MAIN ] );
		$this->assertTrue( $s->getSlotRoleRegistry()->isDefinedRole( PageRevisionWriter::SLOT ) );
		$this->assertInstanceOf( PageOwnedPilotImporter::class, $s->getWikiRevisionOldRevisionImporter() );
		$actor = $this->getAuthorizedActor();
		$publish = fn ( string $owner ) => $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $owner, 'baserevid' => 0, 'data' => '{"schemaVersion":1,"surfaces":[]}',
			'maintext' => 'Namespace enrollment' ], null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $publish( 'Layers namespace enrolled page' )['result'] );
		try {
			$publish( 'Project:Layers namespace outside page' );
			$this->fail( 'A page outside the enrolled namespace must not start owning drawings' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-publication-disabled' ) );
		}
		$scope = $s->getService( 'LayersPageOwnedPilot' )->getScope();
		$titles = $s->getTitleFactory();
		$this->assertTrue( $scope->isEnrolled( $titles->newFromText( 'Any main namespace page' ) ) );
		$this->assertFalse( $scope->isEnrolled( $titles->newFromText( 'Talk:Any main namespace page' ) ) );
		$this->assertFalse( $scope->isEnrolled( $titles->newFromText( 'File:Not configured.png' ) ) );
		foreach ( [ [ -1 ], [ '0' ], [ 1.5 ] ] as $invalid ) {
			try {
				PageOwnedScope::newFromServices( $s, [], $invalid );
				$this->fail( 'Invalid namespace scope accepted' );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertSame( 'Invalid Layers pilot namespace scope', $e->getMessage() );
			}
		}
	}

	public function testNoConfiguredNamespaceLetsNoPageStartDrawings(): void {
		$actor = $this->getAuthorizedActor();
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$this->bootstrap( [] );

		$revisionCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();

		try {
			$this->doApiRequestWithToken( [
				'action' => 'layerspublish',
				'owner' => $title->getPrefixedText(),
				'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}',
			], null, $actor );
			$this->fail( 'Expected publication rejection for empty owners' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-publication-disabled' ) );
		}

		$this->assertSame( $revisionCount, $this->getDb()->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$row = $this->getDb()->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->where( [ 'page_namespace' => $title->getNamespace(), 'page_title' => $title->getDBkey() ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertFalse( $row, 'Empty-owner publication must not insert a page record' );
	}

	public function testPageOutsideTheConfiguredNamespacesCannotStartDrawings(): void {
		$actor = $this->getAuthorizedActor();
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$this->bootstrap( [ NS_PROJECT ] );

		$revisionCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();

		try {
			$this->doApiRequestWithToken( [
				'action' => 'layerspublish',
				'owner' => $title->getPrefixedText(),
				'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}',
			], null, $actor );
			$this->fail( 'Expected publication rejection for unrelated owner' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-publication-disabled' ) );
		}

		$this->assertSame( $revisionCount, $this->getDb()->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField() );
		$row = $this->getDb()->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->where( [ 'page_namespace' => $title->getNamespace(), 'page_title' => $title->getDBkey() ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertFalse( $row, 'Unrelated-owner publication must not insert a page record' );

		try {
			$this->doApiRequest(
				[ 'action' => 'layersread', 'owner' => $title->getPrefixedText(), 'revid' => 1 ],
				null, false, $actor
			);
			$this->fail( 'Expected read rejection for out-of-scope owner' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-revision-unavailable' ) );
		}
	}

	public function testInstalledSaveAdmissionProtectsAndPreservesSnapshot(): void {
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$s = $this->bootstrap( null );
		$actor = $this->getAuthorizedActor();

		// 1. Publish initial snapshot through installed API.
		$initialData = '{"schemaVersion":1,"surfaces":[]}';
		$pubResult = $this->doApiRequestWithToken( [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => $initialData,
			'maintext' => 'Initial bootstrap text',
			'summary' => 'Initial bootstrap publish',
		], null, $actor )[0]['layerspublish'];
		$this->assertSame( 'Success', $pubResult['result'] );
		$baseRevId = $pubResult['revid'];
		$this->assertGreaterThan( 0, $baseRevId );

		$revLookup = $s->getRevisionLookup();
		$initialRev = $revLookup->getRevisionById( $baseRevId );
		$this->assertNotNull( $initialRev );
		$this->assertTrue( $initialRev->hasSlot( PageRevisionWriter::SLOT ) );
		$initialSnapshotText = $initialRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// 2. Attempt unauthorized slot replacement through native PageUpdater.
		$wikiPage = $s->getWikiPageFactory()->newFromTitle( $title );
		$updater = $wikiPage->newPageUpdater( $actor );
		$replacement = new LayersDocumentContent(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' )
		);
		$this->assertTrue( $replacement->isValid(), 'Admission must reject a valid replacement' );
		$updater->setContent( PageRevisionWriter::SLOT, $replacement );
		$saved = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Unauthorized replace attempt' ) );
		$this->assertNull( $saved, 'Direct PageUpdater replacement must be rejected by installed admission hook' );
		$this->assertFalse( $updater->wasSuccessful() );
		$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );

		// Current revision and snapshot in DB must remain completely unchanged.
		$wikiPage->clear();
		$this->assertSame( $baseRevId, $wikiPage->getLatest() );
		$currentRev = $revLookup->getRevisionById( $wikiPage->getLatest() );
		$this->assertSame( $initialSnapshotText, $currentRev->getContent( PageRevisionWriter::SLOT )->serialize() );

		// 3. Normal main-text edit preserving the snapshot must succeed.
		$mainUpdater = $wikiPage->newPageUpdater( $actor );
		$mainUpdater->setContent( SlotRecord::MAIN, new WikitextContent( 'Updated bootstrap main text' ) );
		$savedMain = $mainUpdater->saveRevision( CommentStoreComment::newUnsavedComment( 'Normal main text edit' ) );
		$this->assertNotNull( $savedMain, 'Normal main-text edit must succeed' );
		$this->assertTrue( $mainUpdater->wasSuccessful() );
		$newRevId = $savedMain->getId();
		$this->assertGreaterThan( $baseRevId, $newRevId );

		// Verify new revision has updated main text and preserves the exact Layers snapshot.
		$newRev = $revLookup->getRevisionById( $newRevId );
		$this->assertSame( 'Updated bootstrap main text', $newRev->getContent( SlotRecord::MAIN )->serialize() );
		$this->assertTrue( $newRev->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertSame( $initialSnapshotText, $newRev->getContent( PageRevisionWriter::SLOT )->serialize() );
	}

	public function testInstalledImportWrappersRejectProtectedAndPermitOrdinary(): void {
		$protectedPage1 = $this->getNonexistingTestPage();
		$protectedTitle1 = $protectedPage1->getTitle();
		$protectedPage2 = $this->getNonexistingTestPage();
		$protectedTitle2 = $protectedPage2->getTitle();

		$s = $this->bootstrap( null );
		$actor = $this->getAuthorizedActor();
		$owned = [];
		foreach ( [ $protectedTitle1, $protectedTitle2 ] as $index => $protectedTitle ) {
			$owned[$index] = $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
				'owner' => $protectedTitle->getPrefixedText(), 'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'Owner'
			], null, $actor )[0]['layerspublish']['revid'];
		}

		// Mode 1: OldRevisionImporter ($noUpdates = false)
		$rev1 = new WikiRevision();
		$rev1->setTitle( $protectedTitle1 );
		$rev1->setTimestamp( '20260101000000' );
		$rev1->setUsername( $actor->getName() );
		$rev1->setComment( 'Import attempt 1' );
		$rev1->setContent( 'main', new WikitextContent( 'Imported text 1' ) );
		$rev1->setNoUpdates( false );

		$beforeCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();

		try {
			$rev1->importOldRevision();
			$this->fail( 'Expected protected import rejection with updates' );
		} catch ( RuntimeException $e ) {
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}

		$afterCount = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
		$this->assertSame( $beforeCount, $afterCount );

		$this->assertSame( $owned[0], $protectedTitle1->getLatestRevID( IDBAccessObject::READ_LATEST ),
			'Rejected import must not change the owner' );

		// Ordinary import with $noUpdates = false succeeds.
		$ordinaryPage1 = $this->getNonexistingTestPage();
		$ordinaryTitle1 = $ordinaryPage1->getTitle();

		$revOrd1 = new WikiRevision();
		$revOrd1->setTitle( $ordinaryTitle1 );
		$revOrd1->setTimestamp( '20260101000000' );
		$revOrd1->setUsername( $actor->getName() );
		$revOrd1->setComment( 'Ordinary import 1' );
		$revOrd1->setContent( 'main', new WikitextContent( 'Ordinary imported text 1' ) );
		$revOrd1->setNoUpdates( false );

		$this->assertTrue( $revOrd1->importOldRevision() );
		$stored1 = $s->getRevisionLookup()->getRevisionByTitle( $ordinaryTitle1 );
		$this->assertNotNull( $stored1 );
		$this->assertSame( 'Ordinary imported text 1', $stored1->getContent( 'main' )->serialize() );

		// Mode 2: WikiRevisionOldRevisionImporterNoUpdates ($noUpdates = true)
		$rev2 = new WikiRevision();
		$rev2->setTitle( $protectedTitle2 );
		$rev2->setTimestamp( '20260101000000' );
		$rev2->setUsername( $actor->getName() );
		$rev2->setComment( 'Import attempt 2' );
		$rev2->setContent( 'main', new WikitextContent( 'Imported text 2' ) );
		$rev2->setNoUpdates( true );

		$beforeCount2 = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();

		try {
			$rev2->importOldRevision();
			$this->fail( 'Expected protected import rejection without updates' );
		} catch ( RuntimeException $e ) {
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}

		$afterCount2 = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->caller( __METHOD__ )->fetchField();
		$this->assertSame( $beforeCount2, $afterCount2 );

		$this->assertSame( $owned[1], $protectedTitle2->getLatestRevID( IDBAccessObject::READ_LATEST ),
			'Rejected no-updates import must not change the owner' );

		// Ordinary import with $noUpdates = true succeeds.
		$ordinaryPage2 = $this->getNonexistingTestPage();
		$ordinaryTitle2 = $ordinaryPage2->getTitle();

		$revOrd2 = new WikiRevision();
		$revOrd2->setTitle( $ordinaryTitle2 );
		$revOrd2->setTimestamp( '20260101000000' );
		$revOrd2->setUsername( $actor->getName() );
		$revOrd2->setComment( 'Ordinary import 2' );
		$revOrd2->setContent( 'main', new WikitextContent( 'Ordinary imported text 2' ) );
		$revOrd2->setNoUpdates( true );

		$this->assertTrue( $revOrd2->importOldRevision() );
		$stored2 = $s->getRevisionLookup()->getRevisionByTitle( $ordinaryTitle2 );
		$this->assertNotNull( $stored2 );
		$this->assertSame( 'Ordinary imported text 2', $stored2->getContent( 'main' )->serialize() );
	}

	/**
	 * @dataProvider provideProtectedMergeSides
	 * @param bool $protectDestination
	 */
	public function testInstalledMergeBoundaryRejectsProtectedMerge( bool $protectDestination ): void {
		$source = $this->getExistingTestPage();
		$destination = $this->getExistingTestPage();
		$sourceId = $source->getId();
		$destinationId = $destination->getId();
		$sourceRevId = $source->getLatest();
		$sourceKey = $source->getTitle()->getPrefixedDBkey();

		// Deterministic timestamps: source predates destination without sleeping.
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20200101000000' ) ] )
			->where( [ 'rev_page' => $sourceId ] )->caller( __METHOD__ )->execute();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20210101000000' ) ] )
			->where( [ 'rev_page' => $destinationId ] )->caller( __METHOD__ )->execute();

		$protected = $protectDestination ? $destination : $source;
		$this->bootstrap( null );
		$this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $protected->getTitle()->getPrefixedText(), 'baserevid' => $protected->getLatest(),
			'data' => '{"schemaVersion":1,"surfaces":[]}' ], null, $this->getAuthorizedActor() );
		$sourceRevId = $source->getTitle()->getLatestRevID( IDBAccessObject::READ_LATEST );
		$beforePages = iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'page' )
			->where( [ 'page_id' => [ $sourceId, $destinationId ] ] )->orderBy( 'page_id' )
			->caller( __METHOD__ )->fetchResultSet() );
		$actor = $this->getAuthorizedActor( [ 'read', 'edit', 'mergehistory' ] );

		$beforeLogs = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'logging' )
			->where( [ 'log_type' => 'merge' ] )->caller( __METHOD__ )->fetchField();

		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Protected merge attempt',
		];

		try {
			$this->doApiRequestWithToken( $params, null, $actor );
			$this->fail( 'Expected protected merge rejection' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-admission-unauthorized' ) );
		}

		$afterPages = iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'page' )
			->where( [ 'page_id' => [ $sourceId, $destinationId ] ] )->orderBy( 'page_id' )
			->caller( __METHOD__ )->fetchResultSet() );
		$this->assertEquals( $beforePages, $afterPages, 'Both complete page rows must remain unchanged' );

		// Revision ownership, latest IDs, and merge log count must remain invariant.
		$revOwner = (int)$this->getDb()->newSelectQueryBuilder()->select( 'rev_page' )->from( 'revision' )
			->where( [ 'rev_id' => $sourceRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $sourceId, $revOwner );

		$sourceLatest = (int)$this->getDb()->newSelectQueryBuilder()->select( 'page_latest' )->from( 'page' )
			->where( [ 'page_id' => $sourceId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $sourceRevId, $sourceLatest );

		$afterLogs = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'logging' )
			->where( [ 'log_type' => 'merge' ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $beforeLogs, $afterLogs );
	}

	/** @return array */
	public static function provideProtectedMergeSides(): array {
		return [ 'source' => [ false ], 'destination' => [ true ] ];
	}

	public function testInstalledMergeBoundaryPermitsOrdinaryMerge(): void {
		$source = $this->getExistingTestPage();
		$destination = $this->getExistingTestPage();
		$sourceId = $source->getId();
		$destinationId = $destination->getId();
		$sourceRevId = $source->getLatest();

		// Deterministic timestamps: source predates destination without sleeping.
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20200101000000' ) ] )
			->where( [ 'rev_page' => $sourceId ] )->caller( __METHOD__ )->execute();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_timestamp' => $this->getDb()->timestamp( '20210101000000' ) ] )
			->where( [ 'rev_page' => $destinationId ] )->caller( __METHOD__ )->execute();

		$this->bootstrap( [] );
		$actor = $this->getAuthorizedActor( [ 'read', 'edit', 'mergehistory' ] );

		$beforeLogs = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'logging' )
			->where( [ 'log_type' => 'merge' ] )->caller( __METHOD__ )->fetchField();

		$params = [
			'action' => 'mergehistory',
			'from' => $source->getTitle()->getPrefixedText(),
			'to' => $destination->getTitle()->getPrefixedText(),
			'reason' => 'Ordinary merge test',
		];

		$response = $this->doApiRequestWithToken( $params, null, $actor )[0];
		$this->assertArrayNotHasKey( 'error', $response );
		$this->assertArrayHasKey( 'mergehistory', $response );
		$this->assertSame( $source->getTitle()->getPrefixedText(), $response['mergehistory']['from'] );
		$this->assertSame( $destination->getTitle()->getPrefixedText(), $response['mergehistory']['to'] );

		// Revision moved to destination.
		$afterOwner = (int)$this->getDb()->newSelectQueryBuilder()->select( 'rev_page' )->from( 'revision' )
			->where( [ 'rev_id' => $sourceRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $destinationId, $afterOwner );

		// Exactly two merge log entries inserted (merge and merge-into).
		$afterLogs = (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'logging' )
			->where( [ 'log_type' => 'merge' ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $beforeLogs + 2, $afterLogs );
	}

	public function testInstalledRestoreHookRejectsProtectedAndPermitsOrdinary(): void {
		$protectedPage = $this->getExistingTestPage();
		$protectedTitle = $protectedPage->getTitle();
		$protectedKey = $protectedTitle->getPrefixedDBkey();
		$protectedRevId = $protectedPage->getLatest();

		$ordinaryPage = $this->getExistingTestPage();
		$ordinaryTitle = $ordinaryPage->getTitle();
		$ordinaryRevId = $ordinaryPage->getLatest();

		$s = $this->bootstrap( null );
		$actor = $this->getAuthorizedActor(
			[ 'read', 'edit', 'editlayers', 'delete', 'undelete', 'createpage', 'createtalk' ]
		);
		$protectedRevId = $this->doApiRequestWithToken( [ 'action' => 'layerspublish',
			'owner' => $protectedTitle->getPrefixedText(), 'baserevid' => $protectedPage->getLatest(),
			'data' => '{"schemaVersion":1,"surfaces":[]}' ], null, $actor )[0]['layerspublish']['revid'];

		// 1. Delete protected page via DeletePageFactory.
		$delProtected = $s->getWikiPageFactory()->newFromTitle( $protectedTitle );
		$delStatus = $s->getDeletePageFactory()->newDeletePage( $delProtected, $actor )
			->deleteUnsafe( 'Delete protected test' );
		$this->assertTrue( $delStatus->isOK(), json_encode( $delStatus->getErrors() ) );
		$this->runDeferredUpdates();

		// Verify revision is in archive table.
		$archived = $this->getDb()->newSelectQueryBuilder()->select( 'ar_rev_id' )->from( 'archive' )
			->where( [ 'ar_rev_id' => $protectedRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $protectedRevId, (int)$archived );

		$this->editPage( $protectedTitle, 'A different page at the same title' );
		$actor = $this->getAuthorizedActor(
			[ 'read', 'edit', 'editlayers', 'delete', 'undelete', 'createpage', 'createtalk' ]
		);
		// Attempt native restoration of protected page via UndeletePageFactory.
		$restoreProtected = $s->getUndeletePageFactory()->newUndeletePage( $delProtected, $actor );
		$restoreStatus = $restoreProtected->undeleteIfAllowed( 'Restore protected test' );
		$this->assertFalse( $restoreStatus->isOK() );
		$this->assertTrue( $restoreStatus->hasMessage( 'layers-restore-drawings-denied' ),
			json_encode( $restoreStatus->getErrors() ) );

		// Archived data stays in archive table; no live revision appears.
		$archivedAfter = $this->getDb()->newSelectQueryBuilder()->select( 'ar_rev_id' )->from( 'archive' )
			->where( [ 'ar_rev_id' => $protectedRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $protectedRevId, (int)$archivedAfter );

		$liveAfter = $this->getDb()->newSelectQueryBuilder()->select( 'rev_id' )->from( 'revision' )
			->where( [ 'rev_id' => $protectedRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertFalse( $liveAfter, 'Archived revision must not appear in revision table' );

		// 2. Delete and restore ordinary page.
		$delOrdinary = $s->getWikiPageFactory()->newFromTitle( $ordinaryTitle );
		$delOrdStatus = $s->getDeletePageFactory()->newDeletePage( $delOrdinary, $actor )
			->deleteUnsafe( 'Delete ordinary test' );
		$this->assertTrue( $delOrdStatus->isOK(), json_encode( $delOrdStatus->getErrors() ) );
		$this->runDeferredUpdates();

		// Attempt native restoration of ordinary page via UndeletePageFactory.
		$restoreOrdinary = $s->getUndeletePageFactory()->newUndeletePage( $delOrdinary, $actor );
		$ordRestoreStatus = $restoreOrdinary->undeleteIfAllowed( 'Restore ordinary test' );
		$this->assertTrue( $ordRestoreStatus->isOK(), json_encode( $ordRestoreStatus->getErrors() ) );

		// Ordinary page is restored to revision table.
		$liveOrd = $this->getDb()->newSelectQueryBuilder()->select( 'rev_id' )->from( 'revision' )
			->where( [ 'rev_id' => $ordinaryRevId ] )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $ordinaryRevId, (int)$liveOrd );
	}
}
