<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class CreationOverlaySelectionTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$database = $this->getDb();
		$this->assertStringContainsString( 'unittest', $database->getDomainID() );
		$this->assertSame( 0, (int)$database->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'layer_sets' )->caller( __METHOD__ )->fetchField() );
		$admin = $this->getTestSysop()->getUser();
		$before = $this->witness();
		foreach ( [ false, true ] as $commit ) {
			$maintenance = new \MigrateLayersToPageHistory();
			$maintenance->setDB( $database );
			$maintenance->setOption( 'user', $admin->getName() );
			if ( $commit ) {
				$maintenance->setOption( 'commit', true );
			}
			ob_start();
			try {
				$this->assertTrue( $maintenance->execute() );
			} finally {
				$output = ob_get_clean();
			}
			$this->assertStringContainsString( $commit ? 'Migration recorded as complete:' :
				'Dry run: nothing is written.', $output );
			$this->assertSame( $before, $this->witness() );
			$this->evidence( 'native empty migration', [ 'commit' => $commit, 'output' => $output ] );
		}
		$this->assertSame( 1, (int)$database->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'updatelog' )
			->where( [ 'ul_key' => 'layers-page-history-migration' ] )->caller( __METHOD__ )->fetchField() );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	private function evidence( string $boundary, array $data ): void {
		$output = getenv( 'LAYERS_CREATION_WITNESSES' );
		if ( $output ) {
			file_put_contents( $output, json_encode( [ 'test' => $this->getName(), 'boundary' => $boundary,
				'data' => $data, 'loadedFileSha256' => hash_file( 'sha256',
					( new \ReflectionClass( PageOwnedPilot::class ) )->getFileName() ) ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	private function ownerFixture( string $main ): array {
		$page = $this->getExistingTestPage();
		$this->editPage( $page, $main );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle(),
			0, IDBAccessObject::READ_LATEST );
		return [ $page, $revision->getId(), $this->actor(),
			new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] ) ];
	}

	private function readSelections( PageOwnedPilot $pilot, int $pageId, int $revisionId,
		Authority $authority
	): array {
		$before = $this->witness();
		$selections = $pilot->listCreationOverlaySelections( $pageId, $revisionId, $authority );
		$after = $this->witness();
		$this->evidence( 'selection listing', [
			'before' => base64_encode( $before ), 'after' => base64_encode( $after ),
			'pageId' => $pageId, 'revisionId' => $revisionId, 'selections' => $selections,
			'database' => $this->getDb()->getDomainID(), 'renditionCachesAreNotPublications' => true ] );
		$this->assertSame( $before, $after );
		return $selections;
	}

	private function assertDescriptors( array $selections, PageOwnedPilot $pilot, Authority $actor ): array {
		$surfaces = [];
		$before = $this->witness();
		foreach ( $selections as $selection ) {
			$this->assertSame( [ 'label', 'kind', 'fileTitle', 'page', 'params' ], array_keys( $selection ) );
			$this->assertSame( [ 'pageid', 'revid', 'start', 'expected' ], array_keys( $selection['params'] ) );
			$params = $selection['params'];
			$init = $pilot->prepareBoundEditor( $params['pageid'], $params['revid'], $params['start'],
				$params['expected'], $actor );
			$surface = $init['pageOwned']['newSurface'];
			$this->assertSame( $params['pageid'], $init['pageOwned']['pageId'] );
			$this->assertSame( $params['revid'], $init['pageOwned']['revisionId'] );
			$this->assertSame( $surface['label'], $selection['label'] );
			$this->assertSame( $surface['kind'], $selection['kind'] );
			$this->assertSame( $surface['source']['fileTitle'] ?? null, $selection['fileTitle'] );
			$this->assertSame( $surface['source']['page'] ?? null, $selection['page'] );
			$this->assertSame( [], $surface['layers'] );
			$surfaces[] = $surface;
			$this->evidence( 'existing editor admission', [ 'descriptor' => $selection, 'newSurface' => $surface,
				'bootstrapKeys' => array_keys( $init ), 'pageOwnedKeys' => array_keys( $init['pageOwned'] ),
				'pageCount' => $init['pageCount'] ?? null, 'page' => $init['page'] ?? null,
				'hasPdfContext' => isset( $init['pageOwned']['pdfContext'] ) ] );
		}
		$this->assertSame( $before, $this->witness() );
		return $surfaces;
	}

	public function testCompleteFileSlideScopeExactRoutesAndOtherOwner(): void {
		$files = [];
		foreach ( [ 'First', 'Second' ] as $label ) {
			$files[] = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
				'File:Creation-' . $label . '-' . wfRandomString( 8 ) . '.png' );
		}
		$embeds = array_map( static fn ( $file ) =>
			'[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=ABC]]', $files );
		$slide = '{{#Slide:ABC}}';
		$prefix = "\u{8AAC}\u{660E} caf\u{00E9}\n";
		$main = $prefix . implode( "\n", [ $embeds[0], $embeds[1], $slide, $embeds[0] ] );
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( $main );
		$other = $this->getExistingTestPage( 'Creation other owner ' . wfRandomString( 8 ) );
		$this->editPage( $other, $main );
		$otherRevision = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $other->getTitle() )->getId();
		$selections = $this->readSelections( $pilot, $page->getId(), $revision, $actor );
		$this->assertCount( 3, $selections );
		$this->assertSame( [ 'ABC', 'ABC', 'ABC' ], array_column( $selections, 'label' ) );
		$this->assertSame( [ 'image', 'image', 'slide' ], array_column( $selections, 'kind' ) );
		$this->assertSame( [
			$files[0]->getTitle()->getPrefixedDBkey(), $files[1]->getTitle()->getPrefixedDBkey(), null ],
			array_column( $selections, 'fileTitle' ) );
		$this->assertSame( [ 1, 1, null ], array_column( $selections, 'page' ) );
		foreach ( $selections as $index => $selection ) {
			$raw = $index === 2 ? $slide : $embeds[$index];
			$this->assertSame( $raw, $selection['params']['expected'] );
			$this->assertSame( strpos( $main, $raw ), $selection['params']['start'] );
		}
		$this->assertSame( strlen( $prefix ), $selections[0]['params']['start'] );
		$this->assertDescriptors( $selections, $pilot, $actor );
		$otherSelections = $this->readSelections( $pilot, $other->getId(), $otherRevision, $actor );
		$this->assertCount( 3, $otherSelections );
		$this->assertSame( $other->getId(), $otherSelections[0]['params']['pageid'] );
		$this->assertNotSame( $selections[0]['params']['pageid'], $otherSelections[0]['params']['pageid'] );
	}

	public function testEffectivePdfPagesShareNameWithoutInventingWholePdfBootstrap(): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Creation-pages-' . wfRandomString( 8 ) . '.pdf' );
		$one = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=1|layerset=ABC]]';
		$two = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=2|layerset=ABC]]';
		$clamped = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=99|layerset=ABC]]';
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( "$two\n$one\n$two\n$clamped" );
		$selections = $this->readSelections( $pilot, $page->getId(), $revision, $actor );
		$this->assertCount( 2, $selections );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $selections, 'label' ) );
		$this->assertSame( [ 2, 1 ], array_column( $selections, 'page' ) );
		$this->assertSame( [ $two, $one ], array_column( array_column( $selections, 'params' ), 'expected' ) );
		$surfaces = $this->assertDescriptors( $selections, $pilot, $actor );
		$this->assertSame( [ 208, 416 ], array_column( array_column( $surfaces, 'canvas' ), 'width' ) );
		$this->assertSame( [ 416, 208 ], array_column( array_column( $surfaces, 'canvas' ), 'height' ) );
	}

	/** @dataProvider provideReplacementPageCounts */
	public function testSavedSelectionExcludedAndAbsentPdfMemberRetainsArchivedPin( int $replacementPages ): void {
		$title = 'File:Creation-pinned-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $title );
		$pin = [ $file->getTimestamp(), $file->getSha1() ];
		$main = '[[' . $title . '|page=1|layerset=ABC]]' . "\n" . '[[' . $title . '|page=2|layerset=ABC]]';
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( $main );
		$stored = $this->makePdfSurface( 'stored-first', 'ABC', $title, $pin[0], $pin[1], 1 );
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $revision,
			$this->buildDocument( [ $stored ] ), 'Creation selection pinned member fixture' );
		if ( $replacementPages === 1 ) {
			$new = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
				$title, '20260906130000', 'Different real PDF reupload' );
		} else {
			$replacement = $this->getNewTempFile();
			file_put_contents( $replacement,
				file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) .
				"\n% J115A distinct native two-page reupload\n" );
			$new = $this->repo->newFile( $file->getTitle() );
			$this->assertTrue( $new->upload( $replacement, 'Different real two-page PDF reupload',
				'Creation selection fixture', 0, false, '20260906130000',
				$this->getTestSysop()->getUser() )->isOK() );
		}
		$this->assertNotSame( $pin[1], $new->getSha1() );
		$this->assertSame( $replacementPages, $new->pageCount() );
		$selections = $this->readSelections( $pilot, $page->getId(), $revision, $actor );
		$this->evidence( 'archived sparse PDF member after real reupload', [ 'replacementPages' => $replacementPages,
			'scanned' => $pilot->listBoundEditorSelections( $page->getId(), $revision, $actor ),
			'originalPin' => $pin, 'replacementPin' => [ $new->getTimestamp(), $new->getSha1() ],
			'selections' => $selections ] );
		if ( $replacementPages === 1 ) {
			$this->assertSame( [], $selections );
			return;
		}
		$this->assertCount( 1, $selections );
		$this->assertSame( 2, $selections[0]['page'] );
		$surfaces = $this->assertDescriptors( $selections, $pilot, $actor );
		$this->assertSame( $pin, [ $surfaces[0]['source']['timestamp'], $surfaces[0]['source']['sha1'] ] );
		$this->assertSame( $stored['source']['fileTitle'], $surfaces[0]['source']['fileTitle'] );
	}

	public static function provideReplacementPageCounts(): array {
		return [ [ 1 ], [ 2 ] ];
	}

	/** @dataProvider provideDeniedOwners */
	public function testDeniedOwnerAndBaseReturnEmpty( string $mode ): void {
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( '{{#Slide:ABC}}' );
		$pageId = $page->getId();
		if ( $mode === 'anonymous' ) {
			$actor = User::newFromName( '127.0.0.1', false );
		} elseif ( in_array( $mode, [ 'read', 'edit', 'editlayers' ], true ) ) {
			if ( $mode === 'read' ) {
				$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
					$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ),
					[ '*' => [ 'read' => false ], 'user' => [ 'read' => false ] ] ) );
			}
			$actor = $this->actor( array_values( array_diff( [ 'read', 'edit', 'editlayers' ], [ $mode ] ) ) );
		} elseif ( $mode === 'foreign' ) {
			$revision = $this->getExistingTestPage( 'Foreign base ' . wfRandomString( 8 ) )->getLatest();
		} elseif ( $mode === 'stale' ) {
			$this->editPage( $page, '{{#Slide:ABC}} Later main text' );
		} elseif ( $mode === 'nonexistent' ) {
			$pageId = 2147483647;
		} elseif ( $mode === 'negative-owner' ) {
			$pageId = -1;
		} elseif ( $mode === 'zero-base' ) {
			$revision = 0;
		} elseif ( $mode === 'nonexistent-base' ) {
			$revision = 2147483647;
		} elseif ( $mode === 'outside-scope' ) {
			$pilot = new PageOwnedPilot( $this->getServiceContainer(), [] );
		}
		$this->assertSame( [], $this->readSelections( $pilot, $pageId, $revision, $actor ) );
	}

	public static function provideDeniedOwners(): array {
		return array_map( static fn ( $mode ) => [ $mode ], [ 'anonymous', 'read', 'edit', 'editlayers',
			'foreign', 'stale', 'nonexistent', 'negative-owner', 'zero-base', 'nonexistent-base', 'outside-scope' ] );
	}

	/** @dataProvider provideOwnerVisibility */
	public function testHiddenOwnerRevisionRefused( int $visibility ): void {
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( '{{#Slide:ABC}}' );
		$this->assertCount( 1, $this->readSelections( $pilot, $page->getId(), $revision, $actor ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => $visibility ] )->where( [ 'rev_id' => $revision ] )
			->caller( __METHOD__ )->execute();
		$this->assertSame( $visibility, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $revision, IDBAccessObject::READ_LATEST )->getVisibility() );
		$this->assertSame( [], $this->readSelections( $pilot, $page->getId(), $revision, $actor ) );
	}

	public static function provideOwnerVisibility(): array {
		return [ [ RevisionRecord::DELETED_TEXT ],
			[ RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] ];
	}

	/** @dataProvider provideSourceRefusal */
	public function testUnreadableOrSuppressedPinnedSourceRefused( string $mode ): void {
		$title = 'File:Creation-hidden-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $title );
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( '[[' . $title . '|page=2|layerset=ABC]]' );
		$stored = $this->makePdfSurface( 'stored-first', 'ABC', $title, $file->getTimestamp(), $file->getSha1(), 1 );
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $revision,
			$this->buildDocument( [ $stored ] ), 'Source visibility fixture' );
		$replacement = $this->getNewTempFile();
		file_put_contents( $replacement, file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) .
			"\n% J115A source visibility native reupload\n" );
		$new = $this->repo->newFile( $file->getTitle() );
		$this->assertTrue( $new->upload( $replacement, 'Source visibility native reupload',
			'Creation selection fixture', 0, false, '20260906130000', $this->getTestSysop()->getUser() )->isOK() );
		$this->assertSame( 2, $new->pageCount() );
		$this->assertCount( 1, $this->readSelections( $pilot, $page->getId(), $revision, $actor ) );
		if ( $mode === 'read' ) {
			$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
				$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ),
				[ '*' => [ 'read' => false ], 'user' => [ 'read' => false ] ] ) );
			$this->overrideConfigValue( 'WhitelistRead', [ $page->getTitle()->getPrefixedText() ] );
			$actor = $this->actor( [ 'edit', 'editlayers' ] );
			$this->assertTrue( $actor->definitelyCan( 'read', $page->getTitle() ) );
			$this->assertFalse( $actor->authorizeRead( 'read', $file->getTitle() ) );
		} else {
			$visibility = File::DELETED_FILE | ( $mode === 'suppressed' ? File::DELETED_RESTRICTED : 0 );
			$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )->set( [ 'oi_deleted' => $visibility ] )
				->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => $stored['source']['timestamp'] ] )
				->caller( __METHOD__ )->execute();
			$file->purgeCache();
		}
		$this->assertSame( [], $this->readSelections( $pilot, $page->getId(), $revision, $actor ) );
	}

	public static function provideSourceRefusal(): array {
		return [ [ 'read' ], [ 'hidden' ], [ 'suppressed' ] ];
	}

	public function testMalformedAndForeignDirectRoutesDoNotCreateSelections(): void {
		$main = '{{#Slide:2147483647:ABC}}' . "\n" .
			'[[File:Creation-invalid.png|layersbinding=v1:bad|layerset=ABC]]' . "\n" .
			'<nowiki>{{#Slide:Hidden}}</nowiki>' . "\n" . '{{#Slide:ABC}}';
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( $main );
		$selections = $this->readSelections( $pilot, $page->getId(), $revision, $actor );
		$this->assertCount( 1, $selections );
		$this->assertSame( '{{#Slide:ABC}}', $selections[0]['params']['expected'] );
		$this->assertSame( strrpos( $main, '{{#Slide:ABC}}' ), $selections[0]['params']['start'] );
		$this->assertDescriptors( $selections, $pilot, $actor );
	}

	public function testUnavailableCandidateOmittedOnlyAfterOwnAdmission(): void {
		$main = '[[File:Creation-file-does-not-exist.png|layerset=ABC]]' . "\n" . '{{#Slide:ABC}}';
		[ $page, $revision, $actor, $pilot ] = $this->ownerFixture( $main );
		$scanned = $pilot->listBoundEditorSelections( $page->getId(), $revision, $actor );
		$this->assertCount( 2, $scanned );
		$selections = $this->readSelections( $pilot, $page->getId(), $revision, $actor );
		$this->assertCount( 1, $selections );
		$this->assertSame( 'slide', $selections[0]['kind'] );
		$this->assertSame( '{{#Slide:ABC}}', $selections[0]['params']['expected'] );
		$this->assertDescriptors( $selections, $pilot, $actor );
	}

	public function testSavedViewerBundleCannotProveCreation(): void {
		[ $page, $revision, $actor, $native ] = $this->ownerFixture( '{{#Slide:ABC}}' );
		$revision = $this->publisher->publish( $page->getTitle(), $actor, $revision,
			$this->buildDocument( [ $this->makeSlideSurface( 'saved', 'Saved' ) ] ), 'Saved viewer admission fixture' );
		$init = $native->prepareEditor( $page->getTitle()->getPrefixedDBkey(), $revision, 'saved', $actor );
		$this->assertArrayNotHasKey( 'newSurface', $init['pageOwned'] );
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$pilot->expects( $this->once() )->method( 'prepareBoundEditor' )->willReturn( $init );
		$this->assertSame( [], $this->readSelections( $pilot, $page->getId(), $revision, $actor ) );
	}

	public function testChangedOwnerBaseDuringPreparationDiscardsWholeList(): void {
		[ $page, $revision, $actor, $native ] = $this->ownerFixture( '{{#Slide:ABC}}' );
		$afterCompetingEdit = null;
		$pilot = $this->getMockBuilder( PageOwnedPilot::class )
			->setConstructorArgs( [ $this->getServiceContainer(), [], [ NS_MAIN ] ] )
			->onlyMethods( [ 'prepareBoundEditor' ] )->getMock();
		$pilot->expects( $this->once() )->method( 'prepareBoundEditor' )->willReturnCallback(
			function ( $pageId, $base, $start, $expected, $authority ) use ( $page, $native, &$afterCompetingEdit ) {
				$init = $native->prepareBoundEditor( $pageId, $base, $start, $expected, $authority );
				$this->editPage( $page, '{{#Slide:ABC}} Competing native text edit' );
				$afterCompetingEdit = $this->witness();
				return $init;
			} );
		$result = $pilot->listCreationOverlaySelections( $page->getId(), $revision, $actor );
		$this->evidence( 'native competing edit during preparation', [
			'afterCompetingEdit' => base64_encode( $afterCompetingEdit ),
			'afterListing' => base64_encode( $this->witness() ), 'selections' => $result ] );
		$this->assertSame( [], $result );
		$this->assertSame( $afterCompetingEdit, $this->witness() );
	}
}
