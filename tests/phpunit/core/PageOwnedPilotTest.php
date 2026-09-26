<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Status\Status;
use MediaWiki\User\UserIdentity;
use OldRevisionImporter;
use WikiRevision;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class PageOwnedPilotTest extends \MediaWiki\Tests\Api\ApiTestCase {
	/**
	 * @dataProvider provideBoundaryCases
	 * @param string $mode
	 * @param string $action
	 */
	public function testSharedApiBoundary( string $mode, string $action ): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$keys = $mode === 'empty' ? [] : [ $title->getPrefixedDBkey() . ( $mode === 'outside' ? '_other' : '' ) ];
		$this->configure( $mode !== 'disabled', $keys );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => $action, 'owner' => $title->getPrefixedText() ];
		if ( $action === 'layerspublish' ) {
			$this->expectApiErrorCode( 'layers-publication-disabled' );
			$this->doApiRequestWithToken( $params + [ 'baserevid' => 0,
				'data' => '{"schemaVersion":1,"surfaces":[]}', 'maintext' => 'Denied' ], null, $actor );
		} else {
			$this->expectApiErrorCode(
				$mode === 'disabled' ? 'layers-reading-disabled' : 'layers-revision-unavailable' );
			$this->doApiRequest( $params + [ 'revid' => 1 ], null, false, $actor );
		}
	}

	/** @return array */
	public static function provideBoundaryCases(): array {
		$cases = [];
		foreach ( [ 'disabled', 'empty', 'outside' ] as $mode ) {
			foreach ( [ 'layerspublish', 'layersread' ] as $action ) {
				$cases[] = [ $mode, $action ];
			}
		}
		return $cases;
	}

	private function configure( bool $enabled, array $keys ): PageOwnedPilot {
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => $enabled,
			'LayersPageOwnedPilotOwners' => $keys ] );
		$s = $this->getServiceContainer();
		$pilot = null;
		$this->overrideConfigValue( 'APIModules', $s->getMainConfig()->get( 'APIModules' ) + [
			'layerspublish' => [ 'class' => ApiLayersPublish::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newPublishApi( $main, $name );
				} ],
			'layersread' => [ 'class' => ApiLayersRead::class,
				'factory' => static function ( $main, $name ) use ( &$pilot ) {
					return $pilot->newReadApi( $main, $name );
				} ]
		] );
		TestingAdmissionRegistration::install( $this );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $pilot->newAdmissionHooks(), true );
		return $pilot;
	}

	public function testSharedPublisherAdmissionAndExactReader(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'First composed save' ];
		$first = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$params['baserevid'] = $first;
		$params['data'] = '{"schemaVersion":1,"surfaces":[]}';
		$second = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $first, $second );
		$read = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $first ], null, false, $actor )[0]['layersread'];
		$this->assertSame( $first, $read['revisionId'] );
		$this->assertNotEmpty( $read['snapshot']['surfaces'] );
		$this->assertSame( $second, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title )->getId() );
	}

	public function testDisabledApisRetainMoveAndImportProtection(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( false, [ $title->getPrefixedDBkey() ] );
		$status = Status::newGood();
		$this->assertFalse( $pilot->newLifecycleHooks()->onMovePageIsValidMove(
			$title, $this->getNonexistingTestPage()->getTitle(), $status ) );
		$this->assertTrue( $status->hasMessage( 'layers-admission-unauthorized' ) );
		$native = $this->createMock( OldRevisionImporter::class );
		$native->expects( $this->never() )->method( 'import' );
		$revision = new WikiRevision();
		$revision->setTitle( $title );
		try {
			$pilot->wrapImporter( $native )->import( $revision );
			$this->fail( 'Expected retained import guard' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
		$this->expectApiErrorCode( 'layers-reading-disabled' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(), 'revid' => 1 ] );
	}

	public function testHistoricalViewerRetainsOldContentForReaderWithoutEditRights(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => $json, 'maintext' => 'Historical viewer owner' ];
		$first = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$updated = json_decode( $json, true );
		$updated['surfaces'][0]['layers'][0]['text'] = 'New text';
		$params['data'] = json_encode( $updated );
		$params['baserevid'] = $first;
		$second = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->overrideUserPermissions( $actor, [ 'read' ] );
		$old = $pilot->prepareViewer( $title->getPrefixedText(), $first, 'presentation', $actor );
		$new = $pilot->prepareViewer( $title->getPrefixedText(), $second, 'presentation', $actor );
		$this->assertSame( $first, $old['revisionId'] );
		$this->assertSame( $second, $new['revisionId'] );
		$oldCanonical = ( new LayersDocumentContent( $json ) )->getCanonicalText();
		$newCanonical = ( new LayersDocumentContent( json_encode( $updated ) ) )->getCanonicalText();
		$this->assertSame( json_decode( $oldCanonical, true )['surfaces'][0], $old['surface'] );
		$this->assertSame( json_decode( $newCanonical, true )['surfaces'][0], $new['surface'] );
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $old ) );
		$entry = $this->getServiceContainer()->getSpecialPageFactory()->getPage( 'ViewLayersPage' );
		$this->assertInstanceOf( \MediaWiki\Extension\Layers\SpecialPages\SpecialViewLayersPage::class, $entry );
		$context = new \RequestContext();
		$context->setAuthority( $actor );
		$context->setTitle( $entry->getPageTitle() );
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [
			'owner' => $title->getPrefixedText(), 'revid' => (string)$first, 'surface' => 'presentation'
		] ) );
		$entry->setContext( $context );
		$entry->execute( null );
		$out = $context->getOutput();
		$this->assertSame( $old, $out->getJsConfigVars()['wgLayersRevisionView'] );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $out->getJsConfigVars() );
		$this->assertContains( 'ext.layers.history', $out->getModules() );
		$this->assertNotContains( 'ext.layers.editor', $out->getModules() );
		$out->sendCacheControl();
		$this->assertStringContainsString( 'no-store',
			$context->getRequest()->response()->getHeader( 'Cache-Control' ) );
		$this->expectExceptionMessage( 'layers-revision-unavailable' );
		$pilot->prepareViewer( $title->getPrefixedText(), $first, 'missing', $actor );
	}

	public function testBoundEditorDerivesSelectionFromExactSavedSource(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Initial owner' ];
		$base = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$pageId = $title->getArticleID();
		$prefix = "Unicode 世界 — café\n";
		$embed = '{{#Slide:Welcome|layersbinding=v1:' . $pageId . ':presentation}}';
		$params['baserevid'] = $base;
		$params['maintext'] = $prefix . $embed;
		$current = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$init = $pilot->prepareBoundEditor( $pageId, $current, strlen( $prefix ), $embed, $actor );
		$this->assertSame( $pageId, $init['pageOwned']['pageId'] );
		$this->assertSame( $current, $init['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		foreach ( [
			[ $base, strlen( $prefix ), $embed ],
			[ $current, 0, $embed ],
			[ $current, strlen( $prefix ), '{{#Slide:Forged|layersbinding=v1:' . $pageId . ':presentation}}' ]
		] as [ $revision, $start, $expected ] ) {
			try {
				$pilot->prepareBoundEditor( $pageId, $revision, $start, $expected, $actor );
				$this->fail( 'Expected exact-source rejection' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
				$this->assertNull( $e->getPrevious() );
			}
		}
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$this->assertSame( $current, $lookup->getRevisionByTitle( $title )->getId() );
		$this->assertSame( $prefix . $embed, $lookup->getRevisionById( $current )->getContent( 'main' )->getText() );
	}

	public function testEditorPreparationUsesAuthorizedCurrentRevisionAndServerIdentity(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Editor owner' ];
		$id = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$init = $pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $actor );
		$this->assertSame( $title->getPrefixedDBkey(), $init['pageOwned']['owner'] );
		$this->assertSame( $id, $init['pageOwned']['revisionId'] );
		$this->assertSame( $title->getArticleID(), $init['pageOwned']['pageId'] );
		$this->assertSame( (string)$actor->getId(), $init['pageOwned']['draftScope']['user'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$this->assertFalse( $init['autoCreate'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertSame( 800, $init['canvasWidth'] );
		$this->assertArrayNotHasKey( 'snapshot', $init );
		$this->assertArrayNotHasKey( 'initialSetName', $init );
		$context = new \RequestContext();
		$context->setUser( $actor );
		$context->setTitle( $this->getServiceContainer()->getTitleFactory()
			->newFromText( 'Special:EditLayersPage' ) );
		$context->setRequest( new \MediaWiki\Request\FauxRequest( [
			'owner' => $title->getPrefixedText(), 'revid' => (string)$id, 'surface' => 'presentation'
		] ) );
		$entry = new SpecialEditLayersPage( $pilot );
		$entry->setContext( $context );
		$entry->execute( null );
		$this->assertSame( $init, $context->getOutput()->getJsConfigVars()['wgLayersEditorInit'] );
		$this->assertContains( 'ext.layers.editor', $context->getOutput()->getModules() );
		$this->assertStringContainsString( 'layers-editor-container', $context->getOutput()->getHTML() );
		$denied = $this->createMock( \MediaWiki\Permissions\Authority::class );
		$denied->method( 'getUser' )->willReturn( $actor );
		$denied->method( 'definitelyCan' )->willReturn( false );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $denied );
			$this->fail( 'Expected denied editor' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
		foreach ( [ [ $pilot, 'missing' ],
			[ new PageOwnedPilot( $this->getServiceContainer(), false,
				[ $title->getPrefixedDBkey() ] ), 'presentation' ],
			[ new PageOwnedPilot( $this->getServiceContainer(), true, [] ), 'presentation' ]
		] as [ $service, $surface ] ) {
			try {
				$service->prepareEditor( $title->getPrefixedText(), $id, $surface, $actor );
				$this->fail( 'Expected unavailable editor' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
			}
		}
		$params['baserevid'] = $id;
		$params['maintext'] = 'Newer main text';
		$next = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $id, $next );
		$this->expectExceptionMessage( 'layers-editor-unavailable' );
		$pilot->prepareEditor( $title->getPrefixedText(), $id, 'presentation', $actor );
	}

	public function testEditorPreparationRejectsInvalidInputsAndForeignRevisionsWithoutMutatingDatabase(): void {
		$titleA = $this->getNonexistingTestPage()->getTitle();
		$titleB = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $titleA->getPrefixedDBkey(), $titleB->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$paramsA = [
			'action' => 'layerspublish',
			'owner' => $titleA->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Owner A content'
		];
		$revA = $this->doApiRequestWithToken( $paramsA, null, $actor )[0]['layerspublish']['revid'];

		$paramsB = [
			'action' => 'layerspublish',
			'owner' => $titleB->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Owner B content'
		];
		$revB = $this->doApiRequestWithToken( $paramsB, null, $actor )[0]['layerspublish']['revid'];

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$layerSetsTableExists = $dbr->tableExists( 'layer_sets' );
		$initialLayerSetsCount = $layerSetsTableExists ?
			(int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() : 0;

		$unrelatedTitle = $this->getNonexistingTestPage()->getTitle();

		$rejectionCases = [
			'zero-revision' => [ $titleA->getPrefixedText(), 0, 'presentation' ],
			'negative-revision' => [ $titleA->getPrefixedText(), -1, 'presentation' ],
			'oversized-revision' => [ $titleA->getPrefixedText(), 2147483648, 'presentation' ],
			'empty-surface' => [ $titleA->getPrefixedText(), $revA, '' ],
			'missing-surface' => [ $titleA->getPrefixedText(), $revA, 'nonexistent_surface' ],
			'empty-owner' => [ '', $revA, 'presentation' ],
			'malformed-owner' => [ 'Invalid[]Title', $revA, 'presentation' ],
			'fragment-owner' => [ $titleA->getPrefixedText() . '#fragment', $revA, 'presentation' ],
			'unrelated-owner' => [ $unrelatedTitle->getPrefixedText(), $revA, 'presentation' ],
			'foreign-rev-A-with-B' => [ $titleA->getPrefixedText(), $revB, 'presentation' ],
			'foreign-rev-B-with-A' => [ $titleB->getPrefixedText(), $revA, 'presentation' ],
		];

		foreach ( $rejectionCases as $caseName => [ $ownerText, $revid, $surfaceId ] ) {
			try {
				$pilot->prepareEditor( $ownerText, $revid, $surfaceId, $actor );
				$this->fail( "Expected prepareEditor to throw for {$caseName}" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-editor-unavailable', $e->getMessage(),
					"Failed assertion for {$caseName}" );
			}
		}

		$currentPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$currentRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $initialPageCount, $currentPageCount, 'Page table row count must remain unchanged' );
		$this->assertSame( $initialRevCount, $currentRevCount, 'Revision table row count must remain unchanged' );
		if ( $layerSetsTableExists ) {
			$currentLayerSetsCount = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField();
			$this->assertSame( $initialLayerSetsCount, $currentLayerSetsCount,
				'Layer sets table row count must remain unchanged' );
		}
	}

	public function testEditorEntryRejectsMalformedRevisionBeforePreparingBootstrap(): void {
		$pilot = $this->createMock( PageOwnedPilot::class );
		$pilot->expects( $this->never() )->method( 'prepareEditor' );
		foreach ( [ null, '0', '01', '-1', '12junk', '1.5', '2147483648' ] as $revision ) {
			$context = new \RequestContext();
			$context->setTitle( $this->getServiceContainer()->getTitleFactory()
			->newFromText( 'Special:EditLayersPage' ) );
			$context->setRequest( new \MediaWiki\Request\FauxRequest( [
				'owner' => 'Owner', 'revid' => $revision, 'surface' => 'presentation'
			] ) );
			$entry = new SpecialEditLayersPage( $pilot );
			$entry->setContext( $context );
			$entry->execute( null );
			$this->assertArrayNotHasKey( 'wgLayersEditorInit', $context->getOutput()->getJsConfigVars() );
			$this->assertNotContains( 'ext.layers.editor', $context->getOutput()->getModules() );
		}
	}

	public function testEditorPreparationEnforcesAuthorityAndPreflightStopsBeforeReading(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Preflight authority content'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		// Case A: Registered reader lacking editlayers
		$readerNoEditlayers = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerNoEditlayers, [ 'read', 'edit', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoEditlayers );
			$this->fail( 'Expected preparation to reject user lacking editlayers' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case B: Registered reader lacking edit
		$readerNoEdit = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerNoEdit, [ 'read', 'editlayers', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoEdit );
			$this->fail( 'Expected preparation to reject user lacking edit' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case C: Anonymous authority (user id <= 0)
		$anonUser = $this->createMock( UserIdentity::class );
		$anonUser->method( 'getId' )->willReturn( 0 );
		$anonAuthority = $this->createMock( Authority::class );
		$anonAuthority->method( 'getUser' )->willReturn( $anonUser );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $anonAuthority );
			$this->fail( 'Expected preparation to reject anonymous authority' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case D: Denied read
		$readerNoRead = $this->getTestUser()->getUser();
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$this->overrideUserPermissions( $readerNoRead, [ 'edit', 'editlayers', 'createpage' ] );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $readerNoRead );
			$this->fail( 'Expected preparation to reject user lacking read' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case E: Authority spy — original authority is checked,
		// and denied preflight does not proceed to reading snapshot
		$spyAuthority = $this->createMock( Authority::class );
		$spyAuthority->method( 'getUser' )->willReturn( $author );
		$spyAuthority->method( 'definitelyCan' )->willReturnCallback( static function ( string $permission ) {
			return $permission !== 'editlayers';
		} );
		$spyAuthority->expects( $this->never() )->method( 'authorizeRead' );
		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $spyAuthority );
			$this->fail( 'Expected preparation with spy authority lacking editlayers to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testEditorPreparationRejectsHiddenTextMissingSlotAndDeletedPageWithoutFallback(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'delete' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Visibility and deletion test content'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		// Case A: Hidden Layers text (rev_deleted has DELETED_TEXT, actor lacks deletedtext)
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revId ] )
			->caller( __METHOD__ )->execute();

		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject revision with DELETED_TEXT visibility' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Restore visibility for subsequent sub-cases
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $revId ] )
			->caller( __METHOD__ )->execute();

		// Case B: Standard page with no Layers slot
		$plainPage = $this->getExistingTestPage();
		$plainTitle = $plainPage->getTitle();
		$plainRevId = $plainPage->getLatest();
		$pilotWithPlain = $this->configure( true,
			[ $title->getPrefixedDBkey(), $plainTitle->getPrefixedDBkey() ] );

		try {
			$pilotWithPlain->prepareEditor( $plainTitle->getPrefixedText(), $plainRevId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject page without Layers slot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}

		// Case C: Deleted page after revision was published
		$pageToDelete = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $title );
		$delStatus = $this->getServiceContainer()->getDeletePageFactory()
			->newDeletePage( $pageToDelete, $actor )
			->deleteUnsafe( 'J53 deletion test' );
		$this->assertTrue( $delStatus->isOK(), 'Page deletion must succeed' );

		try {
			$pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );
			$this->fail( 'Expected preparation to reject deleted page' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testEditorPreparationMetadataIntegrityAndAssetBackedRejection(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'upload' ] );

		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			'maintext' => 'Metadata integrity test'
		];
		$revId = $this->doApiRequestWithToken( $params, null, $actor )[0]['layerspublish']['revid'];

		$init = $pilot->prepareEditor( $title->getPrefixedText(), $revId, 'presentation', $actor );

		// Metadata integrity assertions
		$this->assertSame( $title->getPrefixedDBkey(), $init['pageOwned']['owner'] );
		$this->assertSame( $revId, $init['pageOwned']['revisionId'] );
		$this->assertSame( 'presentation', $init['pageOwned']['surfaceId'] );
		$this->assertFalse( $init['pageOwned']['readOnly'] );
		$this->assertFalse( $init['autoCreate'] );
		$this->assertSame( $title->getPrefixedText(), $init['filename'] );
		$this->assertTrue( $init['isSlide'] );
		$this->assertSame( 800, $init['canvasWidth'] );
		$this->assertSame( 600, $init['canvasHeight'] );

		// Server-derived draftScope
		$config = $this->getServiceContainer()->getMainConfig();
		$expectedWiki = json_encode(
			[ $config->get( 'DBname' ), $config->get( 'DBprefix' ) ], JSON_THROW_ON_ERROR );
		$this->assertSame( $expectedWiki, $init['pageOwned']['draftScope']['wiki'] );
		$this->assertSame( (string)$actor->getId(), $init['pageOwned']['draftScope']['user'] );

		// Omission of snapshot, source URLs, and legacy set selection
		$this->assertArrayNotHasKey( 'snapshot', $init );
		$this->assertArrayNotHasKey( 'sourceUrl', $init );
		$this->assertNull( $init['imageUrl'] );
		$this->assertArrayNotHasKey( 'initialSetName', $init );
		$this->assertArrayNotHasKey( 'initialSetId', $init );

		// Asset-backed rejection
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$this->assertFileExists( $imageFixture );
		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J53_Asset_Rejection.png', '20260906120000' );

		$mixedDoc = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => []
				],
				[
					'id' => 'diagram',
					'kind' => 'image',
					'label' => 'Image Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => [],
					'source' => [
						'repository' => 'local',
						'fileTitle' => 'File:J53_Asset_Rejection.png',
						'timestamp' => $pngFile->getTimestamp(),
						'sha1' => $pngFile->getSha1(),
						'page' => 1
					]
				]
			]
		];

		$mixedTitle = $this->getNonexistingTestPage()->getTitle();
		$mixedPilot = $this->configure( true, [ $mixedTitle->getPrefixedDBkey() ] );
		$mixedParams = [
			'action' => 'layerspublish',
			'owner' => $mixedTitle->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $mixedDoc ),
			'maintext' => 'Mixed surface owner'
		];
		$mixedRevId = $this->doApiRequestWithToken( $mixedParams, null, $actor )[0]['layerspublish']['revid'];

		// Slide surface in mixed document prepares successfully
		$slideInit = $mixedPilot->prepareEditor( $mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $actor );
		$this->assertSame( 'presentation', $slideInit['pageOwned']['surfaceId'] );
		$this->assertTrue( $slideInit['isSlide'] );

		// Asset-backed image surface rejects with layers-editor-unavailable
		try {
			$mixedPilot->prepareEditor( $mixedTitle->getPrefixedText(), $mixedRevId, 'diagram', $actor );
			$this->fail( 'Expected preparation of asset-backed image surface to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-editor-unavailable', $e->getMessage() );
		}
	}

	public function testHistoricalViewerRejectsInvalidInputsScopesAndUnavailableRevisions(): void {
		$titleA = $this->getNonexistingTestPage()->getTitle();
		$titleB = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $titleA->getPrefixedDBkey(), $titleB->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'delete' ] );

		$fixtureJson = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$paramsA = [
			'action' => 'layerspublish',
			'owner' => $titleA->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Historical viewer Owner A content'
		];
		$revA = $this->doApiRequestWithToken( $paramsA, null, $actor )[0]['layerspublish']['revid'];

		$paramsB = [
			'action' => 'layerspublish',
			'owner' => $titleB->getPrefixedText(),
			'baserevid' => 0,
			'data' => $fixtureJson,
			'maintext' => 'Historical viewer Owner B content'
		];
		$revB = $this->doApiRequestWithToken( $paramsB, null, $actor )[0]['layerspublish']['revid'];

		$plainPage = $this->getExistingTestPage();
		$plainTitle = $plainPage->getTitle();
		$plainRevId = $plainPage->getLatest();

		$dbr = $this->getDb();
		$initialPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$initialRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$layerSetsTableExists = $dbr->tableExists( 'layer_sets' );
		$initialLayerSetsCount = $layerSetsTableExists ?
			(int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() : 0;

		$unrelatedTitle = $this->getNonexistingTestPage()->getTitle();

		$rejectionCases = [
			'zero-revision' => [ $titleA->getPrefixedText(), 0, 'presentation' ],
			'negative-revision' => [ $titleA->getPrefixedText(), -1, 'presentation' ],
			'oversized-revision' => [ $titleA->getPrefixedText(), 2147483648, 'presentation' ],
			'empty-surface' => [ $titleA->getPrefixedText(), $revA, '' ],
			'missing-surface' => [ $titleA->getPrefixedText(), $revA, 'nonexistent_surface' ],
			'empty-owner' => [ '', $revA, 'presentation' ],
			'malformed-owner' => [ 'Invalid[]Title', $revA, 'presentation' ],
			'fragment-owner' => [ $titleA->getPrefixedText() . '#fragment', $revA, 'presentation' ],
			'unrelated-owner' => [ $unrelatedTitle->getPrefixedText(), $revA, 'presentation' ],
			'foreign-rev-A-with-B' => [ $titleA->getPrefixedText(), $revB, 'presentation' ],
			'foreign-rev-B-with-A' => [ $titleB->getPrefixedText(), $revA, 'presentation' ],
		];

		foreach ( $rejectionCases as $caseName => [ $ownerText, $revid, $surfaceId ] ) {
			try {
				$pilot->prepareViewer( $ownerText, $revid, $surfaceId, $actor );
				$this->fail( "Expected prepareViewer to throw for {$caseName}" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-revision-unavailable', $e->getMessage(),
					"Failed assertion for {$caseName}" );
			}
		}

		$disabledPilot = new PageOwnedPilot( $this->getServiceContainer(), false, [ $titleA->getPrefixedDBkey() ] );
		try {
			$disabledPilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for disabled pilot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		$emptyScopePilot = new PageOwnedPilot( $this->getServiceContainer(), true, [] );
		try {
			$emptyScopePilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for empty scope pilot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Missing Layers slot
		$pilotWithPlain = $this->configure( true,
			[ $titleA->getPrefixedDBkey(), $plainTitle->getPrefixedDBkey() ] );
		try {
			$pilotWithPlain->prepareViewer( $plainTitle->getPrefixedText(), $plainRevId, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for page without Layers slot' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Hidden text (DELETED_TEXT without deletedtext permission)
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revA ] )
			->caller( __METHOD__ )->execute();
		try {
			$pilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for DELETED_TEXT revision' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		// Restore visibility
		$dbr->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $revA ] )
			->caller( __METHOD__ )->execute();

		// Database non-mutation assertion for all non-destructive rejections
		$currentPageCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'page' )->caller( __METHOD__ )->fetchField();
		$currentRevCount = (int)$dbr->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->caller( __METHOD__ )->fetchField();
		$this->assertSame( $initialPageCount, $currentPageCount, 'Page table row count must remain unchanged' );
		$this->assertSame( $initialRevCount, $currentRevCount, 'Revision table row count must remain unchanged' );
		if ( $layerSetsTableExists ) {
			$currentLayerSetsCount = (int)$dbr->newSelectQueryBuilder()
				->select( 'COUNT(*)' )->from( 'layer_sets' )->caller( __METHOD__ )->fetchField();
			$this->assertSame( $initialLayerSetsCount, $currentLayerSetsCount,
				'Layer sets table row count must remain unchanged' );
		}

		// Deleted page after publication
		$pageToDelete = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $titleA );
		$delStatus = $this->getServiceContainer()->getDeletePageFactory()
			->newDeletePage( $pageToDelete, $actor )
			->deleteUnsafe( 'J56 deletion test' );
		$this->assertTrue( $delStatus->isOK() );
		try {
			$pilot->prepareViewer( $titleA->getPrefixedText(), $revA, 'presentation', $actor );
			$this->fail( 'Expected prepareViewer to throw for deleted page' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	public function testHistoricalViewerReadOnlyAuthorityAndSpyVerification(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$author = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $author, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$params = [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => $json,
			'maintext' => 'Historical viewer read-only authority test'
		];
		$firstId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];

		$updated = json_decode( $json, true );
		$updated['surfaces'][0]['layers'][0]['text'] = 'Second revision text';
		$params['data'] = json_encode( $updated );
		$params['baserevid'] = $firstId;
		$secondId = $this->doApiRequestWithToken( $params, null, $author )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $firstId, $secondId );

		// Case A: Registered reader lacking edit and editlayers
		$readerOnly = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readerOnly, [ 'read' ] );
		$this->assertFalse( $readerOnly->isAllowed( 'edit' ) );
		$this->assertFalse( $readerOnly->isAllowed( 'editlayers' ) );
		$oldData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $readerOnly );
		$this->assertSame( $firstId, $oldData['revisionId'] );
		$this->assertSame( 'presentation', $oldData['surface']['id'] );

		// Case B: Anonymous reader when page read is allowed
		$anonUser = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$anonData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $anonUser );
		$this->assertSame( $firstId, $anonData['revisionId'] );
		$this->assertSame( 'presentation', $anonData['surface']['id'] );

		// Case C: Denied reader lacking read permission fails
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$deniedReader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $deniedReader, [] );
		try {
			$pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $deniedReader );
			$this->fail( 'Expected prepareViewer to reject reader without read permission' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		$deniedAuthority = $this->createMock( Authority::class );
		$deniedAuthority->method( 'authorizeRead' )->willReturn( false );
		try {
			$pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $deniedAuthority );
			$this->fail( 'Expected prepareViewer to reject denied Authority' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// Case D: Authority spy — requires authorizeRead on the same owner and ensures no edit preflight
		$spy = $this->createMock( Authority::class );
		$spy->expects( $this->atLeastOnce() )
			->method( 'authorizeRead' )
			->with( 'read', $this->callback( static function ( $target ) use ( $title ) {
				return $target instanceof \MediaWiki\Title\Title
					&& $target->getPrefixedDBkey() === $title->getPrefixedDBkey();
			} ) )
			->willReturn( true );
		$spy->expects( $this->never() )->method( 'authorizeWrite' );
		$spy->expects( $this->never() )->method( 'definitelyCan' );

		$spyData = $pilot->prepareViewer( $title->getPrefixedText(), $firstId, 'presentation', $spy );
		$this->assertSame( $firstId, $spyData['revisionId'] );
		$this->assertSame( 'presentation', $spyData['surface']['id'] );
	}

	public function testHistoricalViewerDistinctRevisionsAndExactMetadataShape(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$pilot = $this->configure( true, [ $title->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );

		$doc1 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface V1',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 100,
							'y' => 100,
							'text' => 'First revision distinct slide text',
							'fontSize' => 24,
							'color' => '#000000'
						]
					],
					'readingOrder' => [ 'text-1' ]
				]
			]
		];
		$rev1Id = $this->doApiRequestWithToken( [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $doc1 ),
			'maintext' => 'Distinct revisions test - Rev 1'
		], null, $actor )[0]['layerspublish']['revid'];

		$doc2 = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface V2',
					'canvas' => [
						'width' => 1280,
						'height' => 720,
						'backgroundColor' => '#204060',
						'backgroundVisible' => true,
						'backgroundOpacity' => 0.9
					],
					'layers' => [
						[
							'id' => 'text-1',
							'type' => 'text',
							'x' => 150,
							'y' => 120,
							'text' => 'Second revision changed text and geometry',
							'fontSize' => 32,
							'color' => '#ffffff'
						]
					],
					'readingOrder' => [ 'text-1' ]
				]
			]
		];
		$rev2Id = $this->doApiRequestWithToken( [
			'action' => 'layerspublish',
			'owner' => $title->getPrefixedText(),
			'baserevid' => $rev1Id,
			'data' => json_encode( $doc2 ),
			'maintext' => 'Distinct revisions test - Rev 2'
		], null, $actor )[0]['layerspublish']['revid'];
		$this->assertGreaterThan( $rev1Id, $rev2Id );

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		// Request Rev 1 after Rev 2 exists
		$old = $pilot->prepareViewer( $title->getPrefixedText(), $rev1Id, 'presentation', $reader );

		// Verify exact return shape: strictly only owner, revisionId, surface
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $old ) );
		$this->assertSame( $title->getPrefixedDBkey(), $old['owner'] );
		$this->assertSame( $rev1Id, $old['revisionId'] );

		// Verify absence of editor configuration, draft scope, token, live/source URLs
		$this->assertArrayNotHasKey( 'draftScope', $old );
		$this->assertArrayNotHasKey( 'filename', $old );
		$this->assertArrayNotHasKey( 'imageUrl', $old );
		$this->assertArrayNotHasKey( 'isSlide', $old );
		$this->assertArrayNotHasKey( 'autoCreate', $old );
		$this->assertArrayNotHasKey( 'readOnly', $old );
		$this->assertArrayNotHasKey( 'canvasWidth', $old );
		$this->assertArrayNotHasKey( 'canvasHeight', $old );
		$this->assertArrayNotHasKey( 'sourceUrl', $old );
		$this->assertArrayNotHasKey( 'token', $old );

		// Compare complete selected canonical surface strictly
		$canonicalDoc1 = ( new LayersDocumentContent( json_encode( $doc1 ) ) )->getCanonicalText();
		$canonicalSurface1 = json_decode( $canonicalDoc1, true )['surfaces'][0];
		$this->assertSame( $canonicalSurface1, $old['surface'] );
		$this->assertSame( 800, $old['surface']['canvas']['width'] );
		$this->assertSame( 600, $old['surface']['canvas']['height'] );
		$this->assertSame( 'First revision distinct slide text', $old['surface']['layers'][0]['text'] );
		$this->assertSame( [ 'text-1' ], $old['surface']['readingOrder'] );

		// Request Rev 2 independently
		$new = $pilot->prepareViewer( $title->getPrefixedText(), $rev2Id, 'presentation', $reader );
		$this->assertSame( [ 'owner', 'revisionId', 'surface' ], array_keys( $new ) );
		$this->assertSame( $title->getPrefixedDBkey(), $new['owner'] );
		$this->assertSame( $rev2Id, $new['revisionId'] );

		$canonicalDoc2 = ( new LayersDocumentContent( json_encode( $doc2 ) ) )->getCanonicalText();
		$canonicalSurface2 = json_decode( $canonicalDoc2, true )['surfaces'][0];
		$this->assertSame( $canonicalSurface2, $new['surface'] );
		$this->assertSame( 1280, $new['surface']['canvas']['width'] );
		$this->assertSame( 720, $new['surface']['canvas']['height'] );
		$this->assertSame( 'Second revision changed text and geometry', $new['surface']['layers'][0]['text'] );
		$this->assertSame( [ 'text-1' ], $new['surface']['readingOrder'] );
	}

	public function testHistoricalViewerAssetBackedRejectionAndWholeDocumentSourceRule(): void {
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$this->assertFileExists( $imageFixture );
		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J56_Asset_Viewer.png', '20260906120000' );

		$mixedDoc = [
			'schemaVersion' => 1,
			'surfaces' => [
				[
					'id' => 'presentation',
					'kind' => 'slide',
					'label' => 'Slide Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => []
				],
				[
					'id' => 'diagram',
					'kind' => 'image',
					'label' => 'Image Surface',
					'canvas' => [
						'width' => 800,
						'height' => 600,
						'backgroundColor' => '#ffffff',
						'backgroundVisible' => true,
						'backgroundOpacity' => 1
					],
					'layers' => [],
					'readingOrder' => [],
					'source' => [
						'repository' => 'local',
						'fileTitle' => 'File:J56_Asset_Viewer.png',
						'timestamp' => $pngFile->getTimestamp(),
						'sha1' => $pngFile->getSha1(),
						'page' => 1
					]
				]
			]
		];

		$mixedTitle = $this->getNonexistingTestPage()->getTitle();
		$mixedPilot = $this->configure( true, [ $mixedTitle->getPrefixedDBkey() ] );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor,
			[ 'read', 'edit', 'editlayers', 'createpage', 'createtalk', 'upload' ] );

		$mixedParams = [
			'action' => 'layerspublish',
			'owner' => $mixedTitle->getPrefixedText(),
			'baserevid' => 0,
			'data' => json_encode( $mixedDoc ),
			'maintext' => 'Mixed surface historical viewer owner'
		];
		$mixedRevId = $this->doApiRequestWithToken( $mixedParams, null, $actor )[0]['layerspublish']['revid'];

		$reader = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );

		// 4a. Selecting the image surface in prepareViewer is currently rejected
		try {
			$mixedPilot->prepareViewer( $mixedTitle->getPrefixedText(), $mixedRevId, 'diagram', $reader );
			$this->fail( 'Expected preparation of asset-backed image surface to reject' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// 4b. Selecting the slide surface in the mixed document succeeds when source is authorized
		$slideData = $mixedPilot->prepareViewer( $mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $reader );
		$this->assertSame( 'presentation', $slideData['surface']['id'] );
		$this->assertSame( 'slide', $slideData['surface']['kind'] );
		$this->assertSame( $mixedRevId, $slideData['revisionId'] );

		// 4c. Whole-document source-authorization rule:
		// When the reader cannot authorize read of the source image file,
		// resolving sources fails and attempting to view even the slide surface
		// in the mixed document must throw layers-revision-unavailable without partial rendering.
		$restrictedReader = $this->createMock( Authority::class );
		$restrictedReader->method( 'getUser' )->willReturn( $reader );
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:J56_Asset_Viewer.png' );
		$restrictedReader->method( 'authorizeRead' )->willReturnCallback(
			static function ( string $action, $target ) use ( $mixedTitle, $fileTitle ) {
				if ( $target instanceof \MediaWiki\Title\Title ) {
					if ( $target->getPrefixedDBkey() === $fileTitle->getPrefixedDBkey() ) {
						// Deny access to the image file
						return false;
					}
					if ( $target->getPrefixedDBkey() === $mixedTitle->getPrefixedDBkey() ) {
						return true;
					}
				}
				return true;
			}
		);
		try {
			$mixedPilot->prepareViewer(
				$mixedTitle->getPrefixedText(), $mixedRevId, 'presentation', $restrictedReader );
			$this->fail( 'Expected prepareViewer for slide surface to reject when source file read is denied' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	private function uploadFixtureFile(
		string $fixturePath,
		string $fileTitle,
		string $timestamp = '20260906120000',
		string $comment = 'Test fixture upload'
	): LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $fileTitle );
		$this->assertNotNull( $title, "Title for {$fileTitle} must be valid" );
		$sysop = $this->getTestSysop()->getUser();
		$file = $repo->newFile( $title );
		$status = $file->upload( $fixturePath, $comment, 'Fixture file content', 0, false, $timestamp, $sysop );
		$this->assertStatusGood( $status, "Upload of {$fileTitle} must succeed" );
		return $file;
	}
}
