<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\User\User;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Step 1 of the D3 migration: a file's shared sets become drawings of its File: page.
 * @covers \MediaWiki\Extension\Layers\Migration\FilePageMigration
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
 * @group Database
 */
class FilePageMigrationTest extends \MediaWikiIntegrationTestCase {
	private PageOwnedPilot $pilot;
	private User $actor;
	private int $nextId = 9000;

	protected function setUp(): void {
		parent::setUp();
		if ( !$this->getDb()->tableExists( 'layer_sets', __METHOD__ ) ) {
			$this->markTestSkipped( 'layer_sets table not available' );
		}
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', null );
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		TestingAdmissionRegistration::install( $this );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->setTemporaryHook( 'MultiContentSave', $this->pilot->newAdmissionHooks(), true );
		$this->actor = $this->getTestSysop()->getUser();
	}

	/**
	 * @param string $name
	 * @param string $fixture
	 * @param string $timestamp
	 * @return LocalFile
	 */
	private function upload( string $name, string $fixture = 'test-image.png',
		string $timestamp = '20260906120000'
	): LocalFile {
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( 'File:' . $name );
		$file = $this->getServiceContainer()->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/' . $fixture, 'Fixture', '',
			0, false, $timestamp, $this->actor ) );
		return $file;
	}

	/**
	 * A legacy row as older saves stored it: no ownerId and no background settings.
	 * @param LocalFile $file
	 * @param string $set
	 * @param int $revision
	 * @param string $text
	 * @param int $page
	 * @param string|null $sha1
	 * @return int Row ID
	 */
	private function saveSet( LocalFile $file, string $set, int $revision, string $text, int $page = 1,
		?string $sha1 = null
	): int {
		$id = $this->nextId++;
		$timestamp = '2026091012' . sprintf( '%04d', $id % 10000 );
		[ $major, $minor ] = explode( '/', $file->getMimeType() );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'layer_sets' )->row( [
			'ls_id' => $id, 'ls_img_name' => $file->getName(), 'ls_img_major_mime' => $major,
			'ls_img_minor_mime' => $minor, 'ls_img_sha1' => $sha1 ?? $file->getSha1(),
			'ls_json_blob' => json_encode( [ 'revision' => $revision, 'schema' => 1, 'created' => $timestamp,
				'layers' => [ [ 'id' => 'note', 'type' => 'text', 'x' => 10, 'y' => 20, 'text' => $text ] ] ] ),
			'ls_user_id' => $this->actor->getId(), 'ls_timestamp' => $timestamp, 'ls_revision' => $revision,
			'ls_name' => $set, 'ls_page' => $page, 'ls_size' => 100, 'ls_layer_count' => 1
		] )->caller( __METHOD__ )->execute();
		return $id;
	}

	/**
	 * @param LocalFile $file
	 * @return RevisionRecord
	 */
	private function latest( LocalFile $file ): RevisionRecord {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $file->getTitle() );
	}

	/**
	 * @param RevisionRecord $revision
	 * @return array[] Surfaces of the revision
	 */
	private function surfaces( RevisionRecord $revision ): array {
		return json_decode( $revision->getContent( 'layers' )->getText(), true )['surfaces'];
	}

	public function testLatestSetsBecomeDrawingsOfTheFilePageInOneBotEdit(): void {
		$file = $this->upload( 'Migrated_photo.png' );
		$this->saveSet( $file, 'labels', 1, 'Old labels' );
		$labels = $this->saveSet( $file, 'labels', 2, 'New labels' );
		$anatomy = $this->saveSet( $file, 'anatomy', 1, 'Heart' );
		$before = $this->latest( $file );
		$migration = $this->pilot->newFilePageMigration();

		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [ [ 'anatomy', 1, $anatomy ], [ 'labels', 1, $labels ] ], array_map(
			static fn ( $add ) => [ $add['name'], $add['page'], $add['legacyId'] ], $plan['add'] ) );
		$this->assertSame( $before->getId(), $this->latest( $file )->getId(), 'planning writes nothing' );

		$revisionId = $migration->commit( $plan, $this->actor );
		$revision = $this->latest( $file );
		$this->assertSame( $revisionId, $revision->getId() );
		$this->assertSame( $before->getId(), $revision->getParentId() );
		$this->assertSame( 'Moved 2 shared layer sets into page history: "anatomy", "labels"',
			$revision->getComment()->text );
		$tags = $this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $revisionId );
		$this->assertEqualsCanonicalizing(
			[ PagePublicationService::CHANGE_TAG, PagePublicationService::MIGRATION_TAG ], $tags );
		$this->runDeferredUpdates();
		$this->assertSame( '1', (string)$this->getDb()->newSelectQueryBuilder()->select( 'rc_bot' )
			->from( 'recentchanges' )->where( [ 'rc_this_oldid' => $revisionId ] )->caller( __METHOD__ )
			->fetchField() );
		$this->assertSame( $before->getContent( 'main' )->getText(), $revision->getContent( 'main' )->getText() );

		$surfaces = $this->surfaces( $revision );
		$this->assertSame( [ 'anatomy', 'labels' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ FilePageMigration::surfaceId( $anatomy, $file->getTitle()->getArticleID() ),
			FilePageMigration::surfaceId( $labels, $file->getTitle()->getArticleID() ) ],
			array_column( $surfaces, 'id' ) );
		$this->assertSame( 'New labels', $surfaces[1]['layers'][0]['text'] );
		$this->assertSame( [ 'image', 'File:Migrated_photo.png', $file->getTimestamp(), $file->getSha1(), 1 ], [
			$surfaces[0]['kind'], $surfaces[0]['source']['fileTitle'], $surfaces[0]['source']['timestamp'],
			$surfaces[0]['source']['sha1'], $surfaces[0]['source']['page'] ] );
		// Older saves had no background settings; the legacy viewer showed the image fully.
		$this->assertSame( [ true, 1 ], [ $surfaces[0]['canvas']['backgroundVisible'],
			$surfaces[0]['canvas']['backgroundOpacity'] ] );
		$this->assertSame( 3, (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'layer_sets' )->where( [ 'ls_img_name' => $file->getName() ] )->caller( __METHOD__ )->fetchField(),
			'layer_sets is left untouched' );

		$again = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [], $again['add'] );
		$this->assertSame( [ [ 'set' => 'anatomy', 'page' => 1 ], [ 'set' => 'labels', 'page' => 1 ] ],
			$again['done'] );
		$this->assertNull( $migration->commit( $again, $this->actor ) );
		$this->assertSame( $revisionId, $this->latest( $file )->getId() );
	}

	public function testTakenNamesAreNumberedAndPdfPagesNamed(): void {
		$file = $this->upload( 'Migrated_notes.pdf', 'test-multipage.pdf' );
		$this->assertSame( 'application/pdf', $file->getMimeType() );
		$first = $this->saveSet( $file, 'notes', 1, 'Page one' );
		$third = $this->saveSet( $file, 'notes', 1, 'Page two', 2 );
		$migration = $this->pilot->newFilePageMigration();
		// The file page already owns a drawing called "notes", with an ID the migration did not derive.
		$existing = $migration->plan( $file->getName(), $this->actor );
		$document = json_decode( $existing['document'] );
		$document->surfaces = [ $document->surfaces[0] ];
		$document->surfaces[0]->id = 'own';
		$existing['document'] = json_encode( $document );
		$existing['add'] = array_slice( $existing['add'], 0, 1 );
		$migration->commit( $existing, $this->actor );

		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertSame( [ [ 'notes 2', 1, $first ], [ 'notes (page 2)', 2, $third ] ], array_map(
			static fn ( $add ) => [ $add['name'], $add['page'], $add['legacyId'] ], $plan['add'] ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$migration->commit( $plan, $this->actor ) );
		$surfaces = $this->surfaces( $revision );
		$this->assertSame( [ 'notes', 'notes 2', 'notes (page 2)' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ 'pdf', 2, $file->getWidth( 2 ), $file->getHeight( 2 ) ], [ $surfaces[2]['kind'],
			$surfaces[2]['source']['page'], $surfaces[2]['canvas']['width'], $surfaces[2]['canvas']['height'] ] );
	}

	public function testSetsOfEarlierVersionsAndMissingFilesAreListedNotMoved(): void {
		// The file backend outlives the test database, so a fixed name would collide in the archive on reruns.
		$name = 'Migrated_reupload_' . wfRandomString( 8 ) . '.png';
		$file = $this->upload( $name );
		$this->saveSet( $file, 'old', 1, 'Before the reupload' );
		$oldSha1 = $file->getSha1();
		$file = $this->upload( $name, 'test-image-replacement.png', '20260907120000' );
		$this->assertNotSame( $oldSha1, $file->getSha1() );
		$current = $this->saveSet( $file, 'current', 1, 'After' );

		$plan = $this->pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$this->assertSame( [ $current ], array_column( $plan['add'], 'legacyId' ) );
		$this->assertSame( [ [ 'set' => 'old', 'page' => 1, 'reason' => 'earlier-file-version' ] ], $plan['notMoved'] );

		$missing = $this->pilot->newFilePageMigration()->plan( 'Never_uploaded.png', $this->actor );
		$this->assertSame( 'missing-file', $missing['problem'] );
		$this->assertNull( $missing['document'] );
	}

	public function testFilePagesOutsideTheDrawingNamespacesAreNotMoved(): void {
		$file = $this->upload( 'Migrated_elsewhere.png' );
		$this->saveSet( $file, 'set', 1, 'Text' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$plan = $pilot->newFilePageMigration()->plan( $file->getName(), $this->actor );
		$this->assertSame( 'namespace-not-enabled', $plan['problem'] );
		$this->assertNull( $pilot->newFilePageMigration()->commit( $plan, $this->actor ) );
	}

	public function testAPageChangedSincePlanningIsNotWritten(): void {
		$file = $this->upload( 'Migrated_conflict.png' );
		$this->saveSet( $file, 'set', 1, 'Text' );
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->editPage( $file->getTitle(), 'Changed description', '', NS_MAIN, $this->actor );
		$changed = $this->latest( $file )->getId();
		try {
			$migration->commit( $plan, $this->actor );
			$this->fail( 'stale plan written' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertSame( $changed, $this->latest( $file )->getId() );
	}
}
