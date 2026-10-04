<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Action\EditLayersAction;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Migration\FilePageDrawings;
use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Page\Article;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * @covers \MediaWiki\Extension\Layers\Migration\FilePageDrawings
 * @covers \MediaWiki\Extension\Layers\Action\EditLayersAction
 * @group Database
 */
class LegacyPdfSelectionTest extends \MediaWikiIntegrationTestCase {

	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		MigrationState::markComplete( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	/** @param bool $grouped @return array File, exact revision, stored surfaces */
	private function pdf( bool $grouped = true ): array {
		$file = $this->upload( 'Legacy_selector_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'Private first-page payload' );
		$this->saveSet( $file, 'Notes', 1, 'Private second-page payload', 2 );
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		if ( !$grouped ) {
			// Explicit historical split fixture; current migration keeps one name.
			$document = json_decode( $plan['document'], true );
			$document['surfaces'][1]['label'] = 'Notes (page 2)';
			$plan['document'] = json_encode( $document );
			$plan['add'][1]['name'] = 'Notes (page 2)';
		}
		$id = $migration->commit( $plan, $this->actor );
		return [ $file, $id, $this->surfaces( $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $id ) ) ];
	}

	/**
	 * @param Title $title
	 * @param array $params
	 * @return \MediaWiki\Output\OutputPage
	 */
	private function action( Title $title, array $params = [] ) {
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $this->actor );
		$request = new FauxRequest( [ 'action' => 'editlayers' ] + $params );
		$request->setRequestURL( '/index.php' );
		$context->setRequest( $request );
		$context->setLanguage( 'en' );
		( new EditLayersAction( Article::newFromTitle( $title, $context ), $context ) )->show();
		return $context->getOutput();
	}

	/** @param Title $owner @param array $surfaces @return int Isolated historical revision, head unchanged */
	private function historical( Title $owner, array $surfaces ): int {
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
		$this->assertTrue( $content->isReadable() );
		$revision = new MutableRevisionRecord( $owner );
		$revision->setUser( $this->actor );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setComment( CommentStoreComment::newUnsavedComment( 'Historical legacy selection fixture' ) );
		$revision->setParentId( $owner->getLatestRevID() );
		$revision->setContent( 'main', new WikitextContent( 'Fixture' ) );
		$revision->setContent( 'layers', $content );
		return $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $revision, $this->getDb() )->getId();
	}

	public function testGroupedPdfActionSelectsSecondPageWithoutRenaming(): void {
		[ $file, $id, $surfaces ] = $this->pdf();
		$title = Title::makeTitle( NS_FILE, $file->getName() );
		$before = $this->state();
		foreach ( [ 'setname', 'layerset', 'layers' ] as $parameter ) {
			$this->assertSame( FilePageDrawings::editUrl( $title, $surfaces[1]['id'] ),
				$this->action( $title, [ $parameter => 'notes', 'page' => '2' ] )->getRedirect() );
		}
		$this->assertSame( FilePageDrawings::editUrl( $title, $surfaces[0]['id'] ),
			$this->action( $title, [ 'setname' => 'Notes' ] )->getRedirect() );
		$this->assertEditorJourney( $title, $id, $surfaces,
			$this->action( $title, [ 'layerset' => 'notes', 'page' => '2' ] )->getRedirect() );
		$this->assertSame( $before, $this->state() );
	}

	/** @param Title $owner @param int $revisionId @param array $surfaces @param string $redirect */
	private function assertEditorJourney( Title $owner, int $revisionId, array $surfaces,
		string $redirect
	): void {
		parse_str( parse_url( $redirect, PHP_URL_QUERY ), $params );
		$this->assertSame( $owner->getPrefixedDBkey(), $params['owner'] );
		$this->assertSame( 'current', $params['revid'] );
		$this->assertSame( $surfaces[1]['id'], $params['surface'] );
		$init = $this->pilot->prepareCurrentEditor( $params['owner'], $params['surface'], $this->actor );
		$this->assertSame( $revisionId, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST )->getId() );
		$this->assertSame( $revisionId, $init['pageOwned']['revisionId'] );
		$this->assertSame( $owner->getArticleID( IDBAccessObject::READ_LATEST ), $init['pageOwned']['pageId'] );
		$this->assertSame( $params['surface'], $init['pageOwned']['surfaceId'] );
		$context = new RequestContext();
		$context->setUser( $this->actor );
		$context->setRequest( new FauxRequest( [ 'action' => 'layersread',
			'owner' => $init['pageOwned']['owner'], 'revid' => $init['pageOwned']['revisionId'] ] ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$read = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] )['layersread'];
		$selected = array_values( array_filter( $read['snapshot']['surfaces'],
			static fn ( $surface ) => $surface['id'] === $init['pageOwned']['surfaceId'] ) );
		$this->assertCount( 1, $selected );
		$this->assertSame( $revisionId, $read['revisionId'] );
		$this->assertSame( $surfaces[1], $selected[0] );
		$this->assertSame( 2, $selected[0]['source']['page'] );
		$this->assertSame( $surfaces[1]['source'], $selected[0]['source'] );
		$this->assertSame( $surfaces[1]['layers'], $selected[0]['layers'] );
		$this->assertNotSame( $surfaces[0]['layers'], $selected[0]['layers'] );
		$this->assertSame( $read['sourceRenditions'][$selected[0]['id']]['url'], $init['imageUrl'] );
		$this->assertSame( $surfaces[1]['canvas']['width'], $init['baseWidth'] );
		$this->assertSame( $surfaces[1]['canvas']['height'], $init['baseHeight'] );
	}

	public function testActionClampsPdfPageAndRejectsNoncanonicalIntegers(): void {
		[ $file, , $surfaces ] = $this->pdf();
		$title = Title::makeTitle( NS_FILE, $file->getName() );
		foreach ( [ '999', ' 2 ' ] as $page ) {
			$this->assertSame( FilePageDrawings::editUrl( $title, $surfaces[1]['id'] ),
				$this->action( $title, [ 'setname' => 'Notes', 'page' => $page ] )->getRedirect() );
		}
		foreach ( [ '02', '2oops', '0', '-2', '' ] as $page ) {
			$this->assertSame( FilePageDrawings::editUrl( $title, $surfaces[0]['id'] ),
				$this->action( $title, [ 'setname' => 'Notes', 'page' => $page ] )->getRedirect() );
		}
	}

	public function testExactNameNormalizesCaseSpacesAndUnderscoresWithinPage(): void {
		[ $file, , $surfaces ] = $this->pdf();
		foreach ( $surfaces as &$surface ) {
			$surface['label'] = 'Field Notes';
		}
		unset( $surface );
		$id = $this->historical( $file->getTitle(), $surfaces );
		$before = $this->state();
		foreach ( [ 'FIELD_NOTES', ' field notes ' ] as $name ) {
			$this->assertSame( $surfaces[1]['id'], FilePageDrawings::select( $file->getTitle(),
				$id, $this->actor, $name, 2 )['id'] );
		}
		$this->assertSame( $before, $this->state() );
	}

	public function testMissingPageListsAllExistingEntriesInsteadOfSubstitution(): void {
		[ $file, , $surfaces ] = $this->pdf();
		$owner = $file->getTitle();
		$id = $this->historical( $owner, [ $surfaces[0] ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 ) );
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, '', 2 ) );
		$this->assertSame( $surfaces[0]['id'],
			FilePageDrawings::select( $owner, $id, $this->actor, '', 1 )['id'] );
		$this->assertSame( '', $this->action( Title::makeTitle( NS_FILE, $file->getName() ) )->getRedirect() );
		$listed = $this->action( Title::makeTitle( NS_FILE, $file->getName() ), [ 'setname' => 'Absent' ] );
		foreach ( $surfaces as $surface ) {
			$this->assertStringContainsString( htmlspecialchars( FilePageDrawings::editUrl( $owner,
				$surface['id'] ) ), $listed->getHTML() );
		}
		$this->assertStringNotContainsString( 'Private', $listed->getHTML() );
		$this->assertSame( $before, $this->state() );
	}

	public function testOtherFilesAndSlidesWithTheSameNameRemainSeparate(): void {
		[ $file, , $surfaces ] = $this->pdf();
		$other = $this->upload( 'Other_selector_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$foreign = $surfaces[1];
		$foreign['id'] = 'other-file';
		$foreign['source']['fileTitle'] = 'File:' . $other->getName();
		$slide = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ),
			true )['surfaces'][0];
		$slide['label'] = 'Notes';
		$owner = $file->getTitle();
		$id = $this->historical( $owner, [ $foreign, $slide, $surfaces[0], $surfaces[1] ] );
		$this->assertSame( $surfaces[1]['id'],
			FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 )['id'] );
		$id = $this->historical( $owner, [ $foreign, $slide, $surfaces[0] ] );
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 ) );
		$id = $this->historical( $owner, [ $slide ] );
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, '', 1 ) );
	}

	public function testDuplicateExactPageIsAmbiguousAndCannotUseLegacyAlias(): void {
		[ $file, , $surfaces ] = $this->pdf( false );
		$exact = $surfaces[1];
		$exact['label'] = 'Notes';
		$exact['id'] = 'exact-one';
		$duplicate = $exact;
		$duplicate['id'] = 'exact-two';
		$duplicate['label'] = 'notes';
		$owner = $file->getTitle();
		$id = $this->historical( $owner, [ $surfaces[0], $exact, $duplicate, $surfaces[1] ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $before, $this->state() );
		$id = $this->historical( $owner, [ $surfaces[0], $exact, $surfaces[1] ] );
		$this->assertSame( 'exact-one', FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 )['id'] );
		$aliasDuplicate = $surfaces[1];
		$aliasDuplicate['id'] = 'unproven-duplicate';
		$id = $this->historical( $owner, [ $surfaces[0], $surfaces[1], $aliasDuplicate ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testRetainedSplitNameRemainsReachableWithExactEvidence(): void {
		[ $file, $id, $surfaces ] = $this->pdf( false );
		$owner = Title::makeTitle( NS_FILE, $file->getName() );
		$before = $this->state();
		$this->assertSame( FilePageDrawings::editUrl( $owner, $surfaces[1]['id'] ),
			$this->action( $owner, [ 'setname' => 'Notes', 'page' => '2' ] )->getRedirect() );
		$this->assertSame( $surfaces[1]['id'],
			FilePageDrawings::select( $owner, $id, $this->actor, 'Notes (page 2)', 2 )['id'] );
		$this->assertEditorJourney( $owner, $id, $surfaces,
			$this->action( $owner, [ 'setname' => 'Notes', 'page' => '2' ] )->getRedirect() );
		$this->assertSame( $before, $this->state() );
		// Newer retained rows do not replace the exact migrated row.
		$this->saveSet( $file, 'Notes', 2, 'Later legacy payload', 2 );
		$before = $this->state();
		$this->assertSame( $surfaces[1]['id'],
			FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 )['id'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testLiteralSuffixNameDoesNotProveAnAlias(): void {
		[ $file, , $surfaces ] = $this->pdf( false );
		$literalRow = $this->saveSet( $file, 'Notes (page 2)', 1, 'Literal name', 2 );
		$literal = $surfaces[1];
		$literal['id'] = \MediaWiki\Extension\Layers\Migration\FilePageMigration::surfaceId(
			$literalRow, $file->getTitle()->getArticleID() );
		$owner = $file->getTitle();
		$id = $this->historical( $owner, [ $surfaces[0], $literal ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $owner, $id, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $literal['id'],
			FilePageDrawings::select( $owner, $id, $this->actor, 'Notes (page 2)', 2 )['id'] );
		$this->assertSame( $before, $this->state() );
	}

	public function testAnotherOwnerDerivedIdCannotQualifyAsRetainedAlias(): void {
		[ $file, , $surfaces ] = $this->pdf( false );
		$otherOwner = $this->getExistingTestPage( 'Other legacy selection owner' )->getTitle();
		$rowId = (int)$this->getDb()->newSelectQueryBuilder()->select( 'ls_id' )->from( 'layer_sets' )
			->where( [ 'ls_img_name' => $file->getName(), 'ls_page' => 2 ] )
			->caller( __METHOD__ )->fetchField();
		$alias = $surfaces[1];
		$this->assertSame( FilePageMigration::surfaceId( $rowId, $file->getTitle()->getArticleID() ),
			$alias['id'] );
		$alias['id'] = FilePageMigration::surfaceId( $rowId, $otherOwner->getArticleID() );
		$this->assertNotSame( $surfaces[1]['id'], $alias['id'] );
		$this->assertSame( $surfaces[1]['source'], $alias['source'] );
		$id = $this->historical( $file->getTitle(), [ $surfaces[0], $alias ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $file->getTitle(), $id, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $alias['id'], FilePageDrawings::select( $file->getTitle(), $id,
			$this->actor, 'Notes (page 2)', 2 )['id'] );
		$this->assertSame( $before, $this->state() );
	}

	/** @param string $change @dataProvider provideUnprovenAliases */
	public function testUnprovenSuffixNeverRedirects( string $change ): void {
		[ $file, , $surfaces ] = $this->pdf( false );
		$alias = $surfaces[1];
		if ( $change === 'id' ) {
			$alias['id'] = 'unproven-id';
		} elseif ( $change === 'sha1' ) {
			$alias['source']['sha1'] = str_repeat( 'a', 31 );
		} elseif ( $change === 'page' ) {
			$alias['source']['page'] = 1;
		} elseif ( $change === 'mime' ) {
			$this->getDb()->newUpdateQueryBuilder()->update( 'layer_sets' )
				->set( [ 'ls_img_major_mime' => 'image', 'ls_img_minor_mime' => 'png' ] )
				->where( [ 'ls_img_name' => $file->getName(), 'ls_page' => 2 ] )
				->caller( __METHOD__ )->execute();
		} else {
			$other = $this->upload( 'Unproven_selector_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
			$alias['source']['fileTitle'] = 'File:' . $other->getName();
		}
		$id = $this->historical( $file->getTitle(), [ $surfaces[0], $alias ] );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $file->getTitle(), $id, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $before, $this->state() );
	}

	public static function provideUnprovenAliases(): array {
		return [ [ 'id' ], [ 'sha1' ], [ 'page' ], [ 'mime' ], [ 'file' ] ];
	}

	public function testDeniedAndForeignRevisionsReturnNoSelection(): void {
		[ $file, $id ] = $this->pdf();
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $file->getTitle(), $id, $denied, 'Notes', 2 ) );
		$this->assertSame( $before, $this->state() );
		$other = $this->upload( 'Foreign_selector_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$before = $this->state();
		$this->assertNull( FilePageDrawings::select( $other->getTitle(), $id, $this->actor, 'Notes', 2 ) );
		$this->assertNull( FilePageDrawings::select( $file->getTitle(), 2147483647, $this->actor, 'Notes', 2 ) );
		$this->assertSame( $before, $this->state() );
	}

	public function testImagePageQueryUsesItsOnlyPageAndSelectionWritesNothing(): void {
		$file = $this->upload( 'Image_selector_' . wfRandomString() . '.png' );
		$this->saveSet( $file, 'Notes', 1, 'Image payload' );
		$migration = $this->pilot->newFilePageMigration();
		$id = $migration->commit( $migration->plan( $file->getName(), $this->actor ), $this->actor );
		$this->runDeferredUpdates();
		$owner = Title::makeTitle( NS_FILE, $file->getName() );
		$surfaces = $this->surfaces( $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id ) );
		$before = $this->state();
		$this->assertSame( FilePageDrawings::editUrl( $owner, $surfaces[0]['id'] ),
			$this->action( $owner, [ 'setname' => 'Notes', 'page' => '2' ] )->getRedirect() );
		$this->assertSame( $before, $this->state() );
	}

	/** @return array Exact persistent row bytes, after fixture writes/deferred updates have completed */
	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'page' => 'page_id', 'layer_sets' => 'ls_id', 'updatelog' => 'ul_key',
			'content' => 'content_id', 'text' => 'old_id' ] as $table => $order ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->orderBy( $order )
				->caller( __METHOD__ )->fetchResultSet() as $row
			) {
				$rows[] = (array)$row;
			}
			$state[$table] = $rows;
		}
		foreach ( $state['revision'] as $row ) {
			$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( (int)$row['rev_id'] );
			foreach ( [ 'main', 'layers' ] as $role ) {
				$state['slotText'][$row['rev_id']][$role] = $revision->hasSlot( $role ) ?
					$revision->getContent( $role, RevisionRecord::RAW )->getText() : null;
			}
		}
		return $state;
	}
}
