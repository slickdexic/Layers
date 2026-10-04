<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class FileSurfaceSelectionProjectionTest extends \MediaWikiIntegrationTestCase {

	private PageOwnedPilot $pilot;
	private Title $owner;
	private User $actor;
	private int $baseRevisionId;
	private array $registered;

	protected function setUp(): void {
		parent::setUp();
		$this->registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage();
		$this->owner = $page->getTitle();
		$this->baseRevisionId = $page->getLatest();
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers' ] );
		$this->pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $this->owner->getPrefixedDBkey() ] );
	}

	/** @return array[] Mixed stored surfaces whose pinned source files do not exist */
	private function mixedSurfaces(): array {
		$surfaces = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ), true )['surfaces'];
		[ $slide, $image, $pdf ] = $surfaces;
		$prefix = 'File:J113E_missing_' . wfRandomString();
		$image['source']['fileTitle'] = $prefix . '.png';
		$pdf['source']['fileTitle'] = $prefix . '.pdf';
		$slide['label'] = $image['label'] = $pdf['label'] = 'ABC';
		$firstPage = $pdf;
		$firstPage['id'] = 'first-page';
		$firstPage['source']['page'] = 1;
		$otherImage = $image;
		$otherImage['id'] = 'other-image';
		$otherImage['source']['fileTitle'] = $prefix . '_other.png';
		return [ $pdf, $image, $slide, $firstPage, $otherImage ];
	}

	/**
	 * Store a readable historical fixture in isolated tables without resolving its missing files.
	 * @param array[] $surfaces
	 * @return int
	 */
	private function historical( array $surfaces ): int {
		$content = new LayersDocumentContent( json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
		$this->assertTrue( $content->isReadable() );
		$revision = new MutableRevisionRecord( $this->owner );
		$revision->setUser( $this->actor->getUser() );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setComment( CommentStoreComment::newUnsavedComment( 'Historical file selection fixture' ) );
		$revision->setParentId( $this->baseRevisionId );
		$revision->setContent( 'main', new WikitextContent( 'Historical selection fixture' ) );
		$revision->setContent( 'layers', $content );
		return $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $revision, $this->getDb() )->getId();
	}

	public function testMixedSelectionsKeepStoredOrderAndOnlySelectionMetadata(): void {
		$surfaces = $this->mixedSurfaces();
		$revisionId = $this->historical( $surfaces );
		$before = $this->databaseState();
		$actual = $this->pilot->getFileSurfaceSelections( $this->owner, $revisionId, $this->actor );
		$this->assertSame( [
			[ 'id' => 'reference', 'label' => 'ABC', 'kind' => 'pdf',
				'source' => [ 'fileTitle' => $surfaces[0]['source']['fileTitle'], 'page' => 2 ] ],
			[ 'id' => 'diagram', 'label' => 'ABC', 'kind' => 'image',
				'source' => [ 'fileTitle' => $surfaces[1]['source']['fileTitle'], 'page' => 1 ] ],
			[ 'id' => 'presentation', 'label' => 'ABC', 'kind' => 'slide' ],
			[ 'id' => 'first-page', 'label' => 'ABC', 'kind' => 'pdf',
				'source' => [ 'fileTitle' => $surfaces[3]['source']['fileTitle'], 'page' => 1 ] ],
			[ 'id' => 'other-image', 'label' => 'ABC', 'kind' => 'image',
				'source' => [ 'fileTitle' => $surfaces[4]['source']['fileTitle'], 'page' => 1 ] ]
		], $actual );
		$this->assertSame( [
			[ 'id' => 'reference', 'label' => 'ABC', 'kind' => 'pdf' ],
			[ 'id' => 'diagram', 'label' => 'ABC', 'kind' => 'image' ],
			[ 'id' => 'presentation', 'label' => 'ABC', 'kind' => 'slide' ],
			[ 'id' => 'first-page', 'label' => 'ABC', 'kind' => 'pdf' ],
			[ 'id' => 'other-image', 'label' => 'ABC', 'kind' => 'image' ]
		], $this->pilot->getHistorySurfaces( $this->owner, $revisionId, $this->actor ) );
		$this->assertSame( $before, $this->databaseState() );
	}

	public function testExactOldSelectionSurvivesLaterPublishedContent(): void {
		$surfaces = $this->mixedSurfaces();
		$oldId = $this->historical( $surfaces );
		$old = $this->pilot->getFileSurfaceSelections( $this->owner, $oldId, $this->actor );
		$slide = $surfaces[2];
		$slide['id'] = 'later-slide';
		$slide['label'] = 'Later layer set';
		$laterId = $this->registered['publisher']->publish( $this->owner, $this->actor, $this->baseRevisionId,
			json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $slide ] ] ), 'Later selection fixture',
			new WikitextContent( 'Later selection fixture' ),
			$this->owner->getArticleID( IDBAccessObject::READ_LATEST ) );
		$this->assertSame( $laterId, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $this->owner, 0, IDBAccessObject::READ_LATEST )->getId() );
		$before = $this->databaseState();
		$this->assertSame( [ [ 'id' => 'later-slide', 'label' => 'Later layer set', 'kind' => 'slide' ] ],
			$this->pilot->getFileSurfaceSelections( $this->owner, $laterId, $this->actor ) );
		$this->assertSame( $old, $this->pilot->getFileSurfaceSelections( $this->owner, $oldId, $this->actor ) );
		$this->assertSame( $before, $this->databaseState() );
	}

	public function testMissingSourcesAreNotResolvedOrAuthorizedDuringSelection(): void {
		$surfaces = $this->mixedSurfaces();
		$revisionId = $this->historical( $surfaces );
		foreach ( $surfaces as $surface ) {
			if ( isset( $surface['source'] ) ) {
				$this->assertFalse( $this->getServiceContainer()->getRepoGroup()
					->findFile( $surface['source']['fileTitle'] ) );
			}
		}
		$authority = $this->createMock( Authority::class );
		$authority->expects( $this->once() )->method( 'authorizeRead' )
			->with( 'read', $this->owner )->willReturn( true );
		$before = $this->databaseState();
		$this->assertCount( 5, $this->pilot->getFileSurfaceSelections( $this->owner, $revisionId, $authority ) );
		$this->assertSame( $before, $this->databaseState() );
	}

	/** @param string $reason @dataProvider provideUnavailable */
	public function testUnavailableSnapshotNeverReturnsSelectors( string $reason ): void {
		$revisionId = $this->historical( $this->mixedSurfaces() );
		$owner = $this->owner;
		$authority = $this->actor;
		if ( $reason === 'foreign' ) {
			$owner = $this->getExistingTestPage( 'Foreign file selection owner' )->getTitle();
			$this->pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $owner->getPrefixedDBkey() ] );
		} elseif ( $reason === 'denied' ) {
			$authority = $this->createMock( Authority::class );
			$authority->method( 'authorizeRead' )->willReturn( false );
		} elseif ( $reason === 'missing' ) {
			$revisionId = 2147483647;
		} elseif ( $reason === 'absent-slot' ) {
			$revisionId = $this->baseRevisionId;
		} else {
			$visibility = RevisionRecord::DELETED_TEXT;
			if ( $reason === 'suppressed' ) {
				$visibility |= RevisionRecord::DELETED_RESTRICTED;
			}
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => $visibility ] )
				->where( [ 'rev_id' => $revisionId ] )->caller( __METHOD__ )->execute();
			$this->assertFalse( $this->actor->isAllowed( 'deletedtext' ) );
			$this->assertFalse( $this->actor->isAllowed( 'suppressrevision' ) );
		}
		$before = $this->databaseState();
		try {
			$this->pilot->getFileSurfaceSelections( $owner, $revisionId, $authority );
			$this->fail( 'Unavailable revision must not fall back to a current selection' );
		} catch ( \DomainException $exception ) {
			$this->assertSame( 'layers-revision-unavailable', $exception->getMessage() );
		}
		$this->assertSame( $before, $this->databaseState() );
	}

	public static function provideUnavailable(): array {
		return [ [ 'foreign' ], [ 'denied' ], [ 'hidden' ], [ 'suppressed' ], [ 'missing' ], [ 'absent-slot' ] ];
	}

	public function testInvalidRevisionFragmentAndOutOfScopeReturnEmptyBeforeAuthorization(): void {
		$revisionId = $this->historical( $this->mixedSurfaces() );
		$authority = $this->createMock( Authority::class );
		$authority->expects( $this->never() )->method( 'authorizeRead' );
		$fragment = $this->getServiceContainer()->getTitleFactory()
			->newFromText( $this->owner->getPrefixedDBkey() . '#Section' );
		$outside = $this->getExistingTestPage( 'Unenrolled file selection owner' )->getTitle();
		$before = $this->databaseState();
		foreach ( [ [ $this->owner, 0 ], [ $this->owner, -1 ], [ $this->owner, 2147483648 ],
			[ $fragment, $revisionId ], [ $outside, $revisionId ],
			[ Title::newFromText( 'Special:Version' ), $revisionId ]
		] as [ $owner, $id ] ) {
			$this->assertSame( [], $this->pilot->getFileSurfaceSelections( $owner, $id, $authority ) );
		}
		$this->assertSame( $before, $this->databaseState() );
	}

	public function testReadableEmptySnapshotHasNoSelections(): void {
		$revisionId = $this->historical( [] );
		$before = $this->databaseState();
		$this->assertSame( [], $this->pilot->getFileSurfaceSelections( $this->owner, $revisionId, $this->actor ) );
		$this->assertSame( $before, $this->databaseState() );
	}

	/** @return array Ordered persistent rows and exact slot text after deferred fixture writes */
	private function databaseState(): array {
		$this->runDeferredUpdates();
		$db = $this->getDb();
		$state = [];
		foreach ( [ 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'page' => 'page_id', 'layer_sets' => 'ls_id', 'updatelog' => 'ul_key',
			'content' => 'content_id', 'text' => 'old_id' ] as $table => $order ) {
			$rows = [];
			foreach ( $db->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
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
