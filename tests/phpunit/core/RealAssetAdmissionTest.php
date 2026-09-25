<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\FileRepo\File\OldLocalFile;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\TitleFactory;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Real asset and multi-page acceptance tests for page-owned Layers revisions.
 *
 * Verifies real uploaded image and PDF assets, upload/replacement with exact
 * archived version matching, page-count boundary validation against PdfHandler,
 * unavailable/missing source bytes, source-free slides, and exact historical read bundles.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @covers \MediaWiki\Extension\Layers\Revision\SourceVersionResolver
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks
 * @group Database
 */
class RealAssetAdmissionTest extends RealAssetTestCase {
	/**
	 * J06 (1): Admitted publication with real uploaded image and multi-page PDF assets.
	 * Mixed document containing source-free slide, real PNG, and real PDF page 2 publishes
	 * atomically with main wikitext; revision and slot properties are verified.
	 */
	public function testAdmittedPublicationWithRealImageAndMultipagePdf(): void {
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$pdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';
		$this->assertFileExists( $imageFixture );
		$this->assertFileExists( $pdfFixture );

		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J06_Real_Diagram.png', '20260906120000' );
		$pdfFile = $this->uploadFixtureFile( $pdfFixture, 'File:J06_Real_Reference.pdf', '20260906120000' );

		$this->assertSame( 'image/png', $pngFile->getMimeType() );
		$this->assertSame( 'application/pdf', $pdfFile->getMimeType() );
		$this->assertSame( 2, $pdfFile->pageCount(), 'Multi-page PDF fixture must report 2 pages from PdfHandler' );

		$surfaces = [
			$this->makeSlideSurface( 'presentation', 'Welcome Slide' ),
			$this->makeImageSurface(
				'diagram',
				'Real Image Surface',
				'File:J06_Real_Diagram.png',
				$pngFile->getTimestamp(),
				$pngFile->getSha1()
			),
			$this->makePdfSurface(
				'reference',
				'Real PDF Surface Page 2',
				'File:J06_Real_Reference.pdf',
				$pdfFile->getTimestamp(),
				$pdfFile->getSha1(),
				2
			)
		];
		$documentJson = $this->buildDocument( $surfaces );

		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$documentJson,
			'Publish mixed document with real image and PDF',
			new WikitextContent( 'Main wikitext for real asset document' )
		);

		$this->assertGreaterThan( 0, $revId );

		$services = $this->getServiceContainer();
		$revision = $services->getRevisionLookup()->getRevisionById( $revId );
		$this->assertNotNull( $revision );
		$this->assertSame( 0, $revision->getParentId() );
		$this->assertSame( $actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( 'Publish mixed document with real image and PDF', $revision->getComment()->text );
		$this->assertSame(
			'Main wikitext for real asset document',
			$revision->getContent( SlotRecord::MAIN )->getText()
		);

		// Assert Layers slot
		$this->assertTrue( $revision->hasSlot( PageRevisionWriter::SLOT ) );
		$layersContent = $revision->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContent::class, $layersContent );
		$this->assertSame( LayersDocumentContent::MODEL, $layersContent->getModel() );

		$decoded = json_decode( $layersContent->getCanonicalText(), true );
		$this->assertCount( 3, $decoded['surfaces'] );
		$this->assertSame( 'slide', $decoded['surfaces'][0]['kind'] );
		$this->assertSame( 'image', $decoded['surfaces'][1]['kind'] );
		$this->assertSame( 'pdf', $decoded['surfaces'][2]['kind'] );
		$this->assertSame( 2, $decoded['surfaces'][2]['source']['page'] );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/**
	 * J06 (2): Real upload replacement and exact archived source version matching.
	 * Uploads initial image T1, replaces it at T2. Snapshot specifying T1 matches the
	 * OldLocalFile archived record and publishes; mismatched hashes or timestamps fail.
	 */
	public function testRealUploadReplacementAndArchivedVersionMatching(): void {
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$titleText = 'File:J06_Replaced_Image_' . wfRandomString( 6 ) . '.png';
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $titleText );
		$repo = $this->getLocalRepo();
		$sysop = $this->getTestSysop()->getUser();
		$actor = $this->actor();

		// Upload initial version at T1
		$initialFile = $repo->newFile( $title );
		$status1 = $initialFile->upload(
			$imageFixture,
			'Initial version',
			'Initial page text',
			0,
			false,
			'20260906120000',
			$sysop
		);
		$this->assertStatusGood( $status1 );
		$initialSha1 = $initialFile->getSha1();
		$initialTimestamp = '20260906120000';

		// Upload replacement version at T2 with modified bytes
		$replacementTemp = __DIR__ . '/../../fixtures/assets/test-image-replacement.png';
		$replacementFile = $repo->newFile( $title );
		$status2 = $replacementFile->upload(
			$replacementTemp,
			'Replacement version',
			'Updated page text',
			0,
			false,
			'20260907120000',
			$sysop
		);
		$this->assertStatusGood( $status2 );
		$replacementSha1 = $replacementFile->getSha1();
		$replacementTimestamp = '20260907120000';

		$this->assertNotSame( $initialSha1, $replacementSha1, 'Replacement must produce a different sha1' );

		// 2a. Snapshot referencing exact archived version (T1 + initialSha1) resolves and publishes
		$archivedDoc = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Archived Version', $titleText, $initialTimestamp, $initialSha1 )
		] );

		$pageA = $this->getNonexistingTestPage();
		$archivedRevId = $this->publisher->publish(
			$pageA->getTitle(),
			$actor,
			0,
			$archivedDoc,
			'Publish with exact archived source version',
			new WikitextContent( 'Archived version owner page' )
		);
		$this->assertGreaterThan( 0, $archivedRevId );

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$archivedRev = $lookup->getRevisionById( $archivedRevId );
		$this->assertNotNull( $archivedRev );
		$archivedData = json_decode( $archivedRev->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertSame( $initialTimestamp, $archivedData['surfaces'][0]['source']['timestamp'] );
		$this->assertSame( $initialSha1, $archivedData['surfaces'][0]['source']['sha1'] );
		$archivedFile = $this->resolver->resolve( new LayersDocumentContent( $archivedDoc ), $actor )['img1'];
		$this->assertInstanceOf( \MediaWiki\FileRepo\File\OldLocalFile::class, $archivedFile );
		$this->assertSame( file_get_contents( $imageFixture ), file_get_contents( $archivedFile->getLocalRefPath() ) );
		$this->assertSame( file_get_contents( $replacementTemp ),
			file_get_contents( $replacementFile->getLocalRefPath() ) );

		// 2b. Snapshot with timestamp mismatch (T1 timestamp with replacement sha1) fails closed
		$mismatchedTimestampDoc = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Mismatched', $titleText, $initialTimestamp, $replacementSha1 )
		] );
		$pageB = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageB->getTitle(),
				$actor,
				0,
				$mismatchedTimestampDoc,
				'Must fail due to timestamp/sha1 mismatch',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Mismatched archived version must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageB->getTitle() ) );

		// 2c. Snapshot with sha1 mismatch (T2 timestamp with initial sha1) fails closed
		$mismatchedShaDoc = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Mismatched Sha', $titleText, $replacementTimestamp, $initialSha1 )
		] );
		$pageC = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageC->getTitle(),
				$actor,
				0,
				$mismatchedShaDoc,
				'Must fail due to sha1 mismatch',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Mismatched sha1 must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageC->getTitle() ) );

		// 2d. Snapshot specifying current version (T2 + replacementSha1) publishes cleanly
		$currentDoc = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Current Version', $titleText, $replacementTimestamp, $replacementSha1 )
		] );
		$pageD = $this->getNonexistingTestPage();
		$currentRevId = $this->publisher->publish(
			$pageD->getTitle(),
			$actor,
			0,
			$currentDoc,
			'Publish with current version',
			new WikitextContent( 'Current version owner page' )
		);
		$this->assertGreaterThan( 0, $currentRevId );
	}

	/**
	 * J06 (3): Multi-page PDF page validation against real PdfHandler evidence.
	 * Pages within pageCount bounds (pages 1 and 2) resolve; an invalid page (page 3)
	 * is rejected with layers-source-unavailable without creating a revision.
	 */
	public function testPdfPageCountBoundaryEnforcement(): void {
		$pdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';
		$titleText = 'File:J06_Boundary_Pdf.pdf';
		$pdfFile = $this->uploadFixtureFile( $pdfFixture, $titleText, '20260906120000' );

		$this->assertSame( 2, $pdfFile->pageCount(), 'PdfHandler must confirm exactly 2 pages' );
		$actor = $this->actor();
		$lookup = $this->getServiceContainer()->getRevisionLookup();

		// 3a. Valid page 1 succeeds
		$docPage1 = $this->buildDocument( [
			$this->makePdfSurface( 'p1', 'Page 1', $titleText, $pdfFile->getTimestamp(), $pdfFile->getSha1(), 1 )
		] );
		$page1 = $this->getNonexistingTestPage();
		$rev1 = $this->publisher->publish(
			$page1->getTitle(),
			$actor,
			0,
			$docPage1,
			'Page 1 publication',
			new WikitextContent( 'Page 1 text' )
		);
		$this->assertGreaterThan( 0, $rev1 );

		// 3b. Valid page 2 succeeds
		$docPage2 = $this->buildDocument( [
			$this->makePdfSurface( 'p2', 'Page 2', $titleText, $pdfFile->getTimestamp(), $pdfFile->getSha1(), 2 )
		] );
		$page2 = $this->getNonexistingTestPage();
		$rev2 = $this->publisher->publish(
			$page2->getTitle(),
			$actor,
			0,
			$docPage2,
			'Page 2 publication',
			new WikitextContent( 'Page 2 text' )
		);
		$this->assertGreaterThan( 0, $rev2 );

		// 3c. Invalid page 3 (exceeds pageCount = 2) is rejected by SourceVersionResolver
		$docPage3 = $this->buildDocument( [
			$this->makePdfSurface( 'p3', 'Page 3', $titleText, $pdfFile->getTimestamp(), $pdfFile->getSha1(), 3 )
		] );
		$page3 = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$page3->getTitle(),
				$actor,
				0,
				$docPage3,
				'Must fail on out-of-bounds page',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Out-of-bounds PDF page must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		$this->assertNull( $lookup->getRevisionByTitle( $page3->getTitle() ) );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/**
	 * J06 (4): Unavailable or missing source bytes rejected.
	 * Nonexistent titles and existing database records whose physical disk bytes
	 * have vanished are rejected before admission without creating revisions.
	 */
	public function testUnavailableOrMissingSourceBytesRejected(): void {
		$actor = $this->actor();
		$lookup = $this->getServiceContainer()->getRevisionLookup();

		// 4a. Nonexistent file title
		$nonexistentDoc = $this->buildDocument( [
			$this->makeImageSurface(
				'img',
				'Nonexistent',
				'File:J06_Completely_Nonexistent.png',
				'20260906120000',
				str_repeat( '0', 31 )
			)
		] );
		$pageA = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageA->getTitle(),
				$actor,
				0,
				$nonexistentDoc,
				'Must fail on missing file',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Nonexistent source file must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageA->getTitle() ) );

		// 4b. Existing database record whose physical disk bytes are deleted
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$titleText = 'File:J06_Missing_Disk_Bytes.png';
		$file = $this->uploadFixtureFile( $imageFixture, $titleText, '20260906120000' );
		$path = $file->getPath();
		$this->assertNotEmpty( $path );
		$repo = $this->getLocalRepo();
		$this->assertTrue( $repo->fileExists( $path ) );

		// Delete physical file from storage backend
		$repo->getBackend()->delete( [ 'src' => $path ] );
		$this->assertFalse( $repo->fileExists( $path ), 'File bytes must be deleted from backend' );

		$missingBytesDoc = $this->buildDocument( [
			$this->makeImageSurface( 'img', 'Missing Bytes', $titleText, $file->getTimestamp(), $file->getSha1() )
		] );
		$pageB = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageB->getTitle(),
				$actor,
				0,
				$missingBytesDoc,
				'Must fail on missing backend bytes',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Missing source bytes must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageB->getTitle() ) );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/**
	 * J06 (5): Source-free slide document publishes without repository lookups.
	 * Uses the slide fixture; verifies atomic revision creation and zero source dependencies.
	 */
	public function testSourceFreeSlidePublishesWithoutSourceLookupOrFileRead(): void {
		$slideFixture = __DIR__ . '/../../fixtures/revisions/slide-document-v1.json';
		$this->assertFileExists( $slideFixture );
		$slideJson = file_get_contents( $slideFixture );
		$unusedRepo = $this->createMock( LocalRepo::class );
		$unusedRepo->expects( $this->never() )->method( 'findFile' );
		$unusedRepo->expects( $this->never() )->method( 'fileExists' );
		$unusedTitles = $this->createMock( \MediaWiki\Title\TitleFactory::class );
		$unusedTitles->expects( $this->never() )->method( 'newFromText' );
		$registration = TestingAdmissionRegistration::install( $this, $this->context,
			new SourceVersionResolver( $unusedRepo, $unusedTitles ) );
		$this->publisher = $registration['publisher'];

		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$slideJson,
			'Publish standalone slide document',
			new WikitextContent( 'Slide presentation main text' )
		);

		$this->assertGreaterThan( 0, $revId );

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$revision = $lookup->getRevisionById( $revId );
		$this->assertNotNull( $revision );
		$this->assertSame( 'Slide presentation main text', $revision->getContent( SlotRecord::MAIN )->getText() );

		$layersContent = $revision->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContent::class, $layersContent );
		$decoded = json_decode( $layersContent->getCanonicalText(), true );
		$this->assertCount( 1, $decoded['surfaces'] );
		$this->assertSame( 'slide', $decoded['surfaces'][0]['kind'] );
		$this->assertArrayNotHasKey( 'source', $decoded['surfaces'][0] );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/**
	 * J06 (6): Snapshots survive actual source-byte loss across ordinary main-only edits.
	 * A page with published real image and PDF assets undergoes an ordinary wikitext-only edit.
	 * The inherited layers slot retains identical bytes and model without re-resolving sources.
	 */
	public function testInheritedRealAssetsPreservedAcrossOrdinaryMainEdit(): void {
		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$pdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';

		$pngFile = $this->uploadFixtureFile( $imageFixture, 'File:J06_Inherit_Diagram.png', '20260906120000' );
		$pdfFile = $this->uploadFixtureFile( $pdfFixture, 'File:J06_Inherit_Reference.pdf', '20260906120000' );

		$surfaces = [
			$this->makeSlideSurface( 'pres', 'Slide' ),
			$this->makeImageSurface(
				'diag', 'Image', 'File:J06_Inherit_Diagram.png',
				$pngFile->getTimestamp(), $pngFile->getSha1()
			),
			$this->makePdfSurface(
				'ref', 'PDF', 'File:J06_Inherit_Reference.pdf',
				$pdfFile->getTimestamp(), $pdfFile->getSha1(), 1
			)
		];
		$docJson = $this->buildDocument( $surfaces );

		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$initialRevId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$docJson,
			'Initial publication with real assets',
			new WikitextContent( 'Initial main content' )
		);
		$this->assertGreaterThan( 0, $initialRevId );

		$services = $this->getServiceContainer();
		$lookup = $services->getRevisionLookup();
		$initialRev = $lookup->getRevisionById( $initialRevId );
		$initialLayersBytes = $initialRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// Lose actual fixture bytes while retaining metadata and the published revision.
		foreach ( [ $pngFile, $pdfFile ] as $file ) {
			$path = $file->getPath();
			$this->assertTrue( $this->repo->fileExists( $path ) );
			$this->assertStatusGood( $this->repo->getBackend()->delete( [ 'src' => $path ] ) );
			$this->assertFalse( $this->repo->fileExists( $path ) );
		}

		// Ordinary editor without editlayers performs main-only edit
		$ordinaryEditor = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $ordinaryEditor, [ 'read', 'edit' ] );

		$freshPage = $services->getWikiPageFactory()->newFromTitle( $page->getTitle() );
		$updater = $freshPage->newPageUpdater( $ordinaryEditor );
		$updater->setContent( SlotRecord::MAIN, new WikitextContent( 'Updated ordinary main content' ) );
		$savedRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Main-only update' ) );

		$this->assertNotNull( $savedRev );
		$this->assertTrue( $updater->wasSuccessful() );
		$this->assertSame( $initialRevId, $savedRev->getParentId() );
		$this->assertGreaterThan( $initialRevId, $savedRev->getId() );
		$this->assertSame( 'Updated ordinary main content', $savedRev->getContent( SlotRecord::MAIN )->getText() );

		// Stored layers slot is identical in bytes and model
		$this->assertTrue( $savedRev->hasSlot( PageRevisionWriter::SLOT ) );
		$inheritedSlot = $savedRev->getContent( PageRevisionWriter::SLOT );
		$this->assertSame( LayersDocumentContent::MODEL, $inheritedSlot->getModel() );
		$this->assertSame( $initialLayersBytes, $inheritedSlot->serialize() );

		// Republish the real referenced assets: their missing bytes must reject the save.

		try {
			$this->publisher->publish(
				$page->getTitle(),
				$actor,
				$savedRev->getId(),
				$docJson,
				'Mutation attempt'
			);
			$this->fail( 'Publication with missing real source bytes must fail' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		$latestRev = $lookup->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $savedRev->getId(), $latestRev->getId() );
		$this->assertSame( $initialLayersBytes, $latestRev->getContent( PageRevisionWriter::SLOT )->serialize() );
	}

	/**
	 * J27 (1): Archived PDF replacement and page-specific geometry validation.
	 * Uploads initial 2-page PDF (T1), replaces with 1-page PDF (T2) of different dimensions.
	 * Resolves and publishes snapshots pinned to T1 (page 2) and T2 (page 1).
	 * Verifies byte-level integrity, page counts, and dimension units (MediaBox pt vs rendered px).
	 * Verifies fallback trap (page 2 on T2), mismatched timestamps/hashes, and out-of-bounds pages.
	 */
	public function testArchivedPdfReplacementAndPageSpecificGeometry(): void {
		$initialPdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';
		$replacementPdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf';
		$this->assertFileExists( $initialPdfFixture );
		$this->assertFileExists( $replacementPdfFixture );

		$titleText = 'File:J27_Multipage_Pdf_' . wfRandomString( 6 ) . '.pdf';
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $titleText );
		$repo = $this->getLocalRepo();
		$sysop = $this->getTestSysop()->getUser();
		$actor = $this->actor();
		$lookup = $this->getServiceContainer()->getRevisionLookup();

		// 1. Upload initial 2-page PDF at T1
		// MediaBox points: Page 1 = 200x100 pt, Page 2 = 100x200 pt.
		// Handler-reported pixel dimensions at the test-pinned 150 DPI (not rendered output):
		// Page 1 = 416x208 px, Page 2 = 208x416 px.
		$initialFile = $repo->newFile( $title );
		$status1 = $initialFile->upload(
			$initialPdfFixture,
			'Initial multi-page PDF version',
			'Initial PDF page text',
			0,
			false,
			'20260906120000',
			$sysop
		);
		$this->assertStatusGood( $status1 );
		$initialSha1 = $initialFile->getSha1();
		$initialTimestamp = '20260906120000';

		$this->assertSame( 2, $initialFile->pageCount(), 'Initial PDF must report exactly 2 pages' );
		$this->assertSame( 416, $initialFile->getWidth( 1 ), 'Page 1 width must be 416 px (200 pt at 150 DPI)' );
		$this->assertSame( 208, $initialFile->getHeight( 1 ), 'Page 1 height must be 208 px (100 pt at 150 DPI)' );
		$this->assertSame( 208, $initialFile->getWidth( 2 ), 'Page 2 width must be 208 px (100 pt at 150 DPI)' );
		$this->assertSame( 416, $initialFile->getHeight( 2 ), 'Page 2 height must be 416 px (200 pt at 150 DPI)' );

		// 2. Upload replacement 1-page PDF at T2
		// MediaBox points: Page 1 = 300x150 pt, Page 2 = absent.
		// Handler-reported dimensions at 150 DPI: Page 1 = 625x312 px.
		$replacementFile = $repo->newFile( $title );
		$status2 = $replacementFile->upload(
			$replacementPdfFixture,
			'Replacement PDF version',
			'Updated PDF page text',
			0,
			false,
			'20260907120000',
			$sysop
		);
		$this->assertStatusGood( $status2 );
		$replacementSha1 = $replacementFile->getSha1();
		$replacementTimestamp = '20260907120000';

		$this->assertNotSame( $initialSha1, $replacementSha1, 'Replacement must have different sha1' );
		$this->assertSame( 1, $replacementFile->pageCount(), 'Replacement PDF must report exactly 1 page' );
		$this->assertSame(
			625,
			$replacementFile->getWidth( 1 ),
			'Replacement Page 1 width must be 625 px (300 pt at 150 DPI)'
		);
		$this->assertSame(
			312,
			$replacementFile->getHeight( 1 ),
			'Replacement Page 1 height must be 312 px (150 pt at 150 DPI)'
		);

		// 3. Snapshot pinned to archived version T1 on Page 2 (208x416 px) resolves and publishes cleanly
		$archivedDoc = $this->buildDocument( [
			$this->makePdfSurface( 'pdf_p2', 'Archived PDF Page 2', $titleText, $initialTimestamp, $initialSha1, 2 )
		] );

		$pageA = $this->getNonexistingTestPage();
		$archivedRevId = $this->publisher->publish(
			$pageA->getTitle(),
			$actor,
			0,
			$archivedDoc,
			'Publish pinned to archived PDF page 2',
			new WikitextContent( 'Archived PDF owner page wikitext' )
		);
		$this->assertGreaterThan( 0, $archivedRevId );

		$archivedRev = $lookup->getRevisionById( $archivedRevId );
		$this->assertNotNull( $archivedRev );
		$archivedLayersData = json_decode( $archivedRev->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertSame( $initialTimestamp, $archivedLayersData['surfaces'][0]['source']['timestamp'] );
		$this->assertSame( $initialSha1, $archivedLayersData['surfaces'][0]['source']['sha1'] );
		$this->assertSame( 2, $archivedLayersData['surfaces'][0]['source']['page'] );

		// Resolve through SourceVersionResolver and verify OldLocalFile returned
		$resolvedArchivedFiles = $this->resolver->resolve( new LayersDocumentContent( $archivedDoc ), $actor );
		$this->assertArrayHasKey( 'pdf_p2', $resolvedArchivedFiles );
		$resolvedArchived = $resolvedArchivedFiles['pdf_p2'];
		$this->assertInstanceOf( OldLocalFile::class, $resolvedArchived );
		$this->assertSame( $initialTimestamp, $resolvedArchived->getTimestamp() );
		$this->assertSame( $initialSha1, $resolvedArchived->getSha1() );
		$this->assertSame(
			file_get_contents( $initialPdfFixture ),
			file_get_contents( $resolvedArchived->getLocalRefPath() )
		);
		$this->assertSame( 2, $resolvedArchived->pageCount() );
		$this->assertSame( 416, $resolvedArchived->getWidth( 1 ) );
		$this->assertSame( 208, $resolvedArchived->getHeight( 1 ) );
		$this->assertSame( 208, $resolvedArchived->getWidth( 2 ) );
		$this->assertSame( 416, $resolvedArchived->getHeight( 2 ) );

		// Contrast with current replacement file metadata
		$this->assertInstanceOf( LocalFile::class, $replacementFile );
		$this->assertSame( 1, $replacementFile->pageCount() );
		$this->assertSame( 625, $replacementFile->getWidth( 1 ) );
		$this->assertSame( 312, $replacementFile->getHeight( 1 ) );
		$this->assertSame(
			file_get_contents( $replacementPdfFixture ),
			file_get_contents( $replacementFile->getLocalRefPath() )
		);

		// 4. Snapshot pinned to current version T2 on Page 1 (625x312 px) publishes cleanly
		$currentDoc = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf_curr',
				'Current PDF Page 1',
				$titleText,
				$replacementTimestamp,
				$replacementSha1,
				1
			)
		] );

		$pageB = $this->getNonexistingTestPage();
		$currentRevId = $this->publisher->publish(
			$pageB->getTitle(),
			$actor,
			0,
			$currentDoc,
			'Publish pinned to current PDF page 1',
			new WikitextContent( 'Current PDF owner page wikitext' )
		);
		$this->assertGreaterThan( 0, $currentRevId );

		$currentRev = $lookup->getRevisionById( $currentRevId );
		$this->assertNotNull( $currentRev );
		$currentLayersData = json_decode( $currentRev->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertSame( $replacementTimestamp, $currentLayersData['surfaces'][0]['source']['timestamp'] );
		$this->assertSame( $replacementSha1, $currentLayersData['surfaces'][0]['source']['sha1'] );
		$this->assertSame( 1, $currentLayersData['surfaces'][0]['source']['page'] );

		$resolvedCurrentFiles = $this->resolver->resolve( new LayersDocumentContent( $currentDoc ), $actor );
		$this->assertArrayHasKey( 'pdf_curr', $resolvedCurrentFiles );
		$resolvedCurrent = $resolvedCurrentFiles['pdf_curr'];
		$this->assertInstanceOf( LocalFile::class, $resolvedCurrent );
		$this->assertSame( $replacementTimestamp, $resolvedCurrent->getTimestamp() );
		$this->assertSame( $replacementSha1, $resolvedCurrent->getSha1() );
		$this->assertSame( 1, $resolvedCurrent->pageCount() );
		$this->assertSame( 625, $resolvedCurrent->getWidth( 1 ) );
		$this->assertSame( 312, $resolvedCurrent->getHeight( 1 ) );

		// 5. Fallback trap: Attempting to reference Page 2 on current version T2 must fail closed
		// (Page 2 was valid in T1, but is absent in T2: pageCount 1 < 2).
		$fallbackTrapDoc = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf_trap',
				'Fallback Trap Page 2',
				$titleText,
				$replacementTimestamp,
				$replacementSha1,
				2
			)
		] );
		$pageTrap = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageTrap->getTitle(),
				$actor,
				0,
				$fallbackTrapDoc,
				'Must fail on page absent from current version',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Referencing page absent from current PDF must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageTrap->getTitle() ) );

		// 6. Stale / wrong hash and out-of-bounds rejection without revision advancement
		// 6a. Timestamp mismatch: T1 timestamp with replacement T2 sha1
		$mismatchedTimestampDoc = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf_mis_time',
				'Mismatched Time',
				$titleText,
				$initialTimestamp,
				$replacementSha1,
				1
			)
		] );
		$pageMisTime = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageMisTime->getTitle(),
				$actor,
				0,
				$mismatchedTimestampDoc,
				'Must fail on timestamp/sha1 mismatch',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Mismatched timestamp/sha1 must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageMisTime->getTitle() ) );

		// 6b. Sha1 mismatch: T2 timestamp with initial T1 sha1
		$mismatchedShaDoc = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf_mis_sha',
				'Mismatched Sha',
				$titleText,
				$replacementTimestamp,
				$initialSha1,
				1
			)
		] );
		$pageMisSha = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageMisSha->getTitle(),
				$actor,
				0,
				$mismatchedShaDoc,
				'Must fail on sha1 mismatch',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Mismatched sha1 must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageMisSha->getTitle() ) );

		// 6c. Out-of-bounds page on T1: Page 3 on 2-page PDF
		$oobPageDoc = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf_oob',
				'Out of Bounds Page 3',
				$titleText,
				$initialTimestamp,
				$initialSha1,
				3
			)
		] );
		$pageOob = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageOob->getTitle(),
				$actor,
				0,
				$oobPageDoc,
				'Must fail on out-of-bounds page 3',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Out-of-bounds page on archived PDF must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageOob->getTitle() ) );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/**
	 * J27 (2): Archived PDF byte loss fails closed without latest-version fallback.
	 * When physical disk bytes for archived T1 are deleted while current T2 bytes remain intact,
	 * resolving pinned T1 fails closed with layers-source-unavailable rather than returning T2.
	 * Inherited layers slot survives ordinary main-only edit without re-resolving sources.
	 */
	public function testArchivedPdfByteLossFailsClosedWithoutLatestFallback(): void {
		$initialPdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';
		$replacementPdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf';

		$titleText = 'File:J27_ByteLoss_Pdf_' . wfRandomString( 6 ) . '.pdf';
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText( $titleText );
		$repo = $this->getLocalRepo();
		$sysop = $this->getTestSysop()->getUser();
		$actor = $this->actor();
		$lookup = $this->getServiceContainer()->getRevisionLookup();

		// Upload T1 (2 pages)
		$initialFile = $repo->newFile( $title );
		$status1 = $initialFile->upload(
			$initialPdfFixture,
			'T1 version',
			'T1 page text',
			0,
			false,
			'20260906120000',
			$sysop
		);
		$this->assertStatusGood( $status1 );
		$initialSha1 = $initialFile->getSha1();
		$initialTimestamp = '20260906120000';

		// Upload T2 (1 page)
		$replacementFile = $repo->newFile( $title );
		$status2 = $replacementFile->upload(
			$replacementPdfFixture,
			'T2 replacement',
			'T2 page text',
			0,
			false,
			'20260907120000',
			$sysop
		);
		$this->assertStatusGood( $status2 );
		$replacementSha1 = $replacementFile->getSha1();
		$replacementTimestamp = '20260907120000';

		// Publish initial owner page pinned to archived T1 (page 2)
		$archivedDoc = $this->buildDocument( [
			$this->makePdfSurface( 'pdf_snap', 'Archived PDF Page 2', $titleText, $initialTimestamp, $initialSha1, 2 )
		] );

		$page = $this->getNonexistingTestPage();
		$initialRevId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$archivedDoc,
			'Initial publication with archived PDF',
			new WikitextContent( 'Initial main wikitext' )
		);
		$this->assertGreaterThan( 0, $initialRevId );

		$initialRev = $lookup->getRevisionById( $initialRevId );
		$this->assertNotNull( $initialRev );
		$initialLayersBytes = $initialRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// Locate physical paths: archived T1 vs current T2
		$resolvedArchived = $this->resolver->resolve( new LayersDocumentContent( $archivedDoc ), $actor )['pdf_snap'];
		$this->assertInstanceOf( OldLocalFile::class, $resolvedArchived );
		$archivedPath = $resolvedArchived->getPath();
		$currentPath = $replacementFile->getPath();

		$this->assertNotEmpty( $archivedPath );
		$this->assertNotEmpty( $currentPath );
		$this->assertNotSame( $archivedPath, $currentPath, 'Archived and current file paths must be distinct' );
		$this->assertTrue( $repo->fileExists( $archivedPath ), 'Archived file must exist in storage' );
		$this->assertTrue( $repo->fileExists( $currentPath ), 'Current file must exist in storage' );

		// Delete ONLY the archived T1 bytes from storage, leaving current T2 bytes intact
		$deleteStatus = $repo->getBackend()->delete( [ 'src' => $archivedPath ] );
		$this->assertStatusGood( $deleteStatus );
		$this->assertFalse( $repo->fileExists( $archivedPath ), 'Archived bytes must be gone' );
		$this->assertTrue( $repo->fileExists( $currentPath ), 'Current T2 bytes must remain intact' );

		// Proving resolving pinned T1 fails closed with layers-source-unavailable rather than falling back to T2
		try {
			$this->resolver->resolve( new LayersDocumentContent( $archivedDoc ), $actor );
			$this->fail( 'Resolving archived PDF with deleted physical bytes must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		// Attempting to publish using missing archived T1 bytes must fail closed
		$pageFail = $this->getNonexistingTestPage();
		try {
			$this->publisher->publish(
				$pageFail->getTitle(),
				$actor,
				0,
				$archivedDoc,
				'Must not save missing archived bytes',
				new WikitextContent( 'Must not save' )
			);
			$this->fail( 'Publishing with missing archived PDF bytes must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}
		$this->assertNull( $lookup->getRevisionByTitle( $pageFail->getTitle() ) );

		// Ordinary main-only edit on the page with T1 snapshot retains the stored snapshot
		$ordinaryEditor = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $ordinaryEditor, [ 'read', 'edit' ] );

		$services = $this->getServiceContainer();
		$freshPage = $services->getWikiPageFactory()->newFromTitle( $page->getTitle() );
		$updater = $freshPage->newPageUpdater( $ordinaryEditor );
		$updater->setContent(
			SlotRecord::MAIN,
			new WikitextContent( 'Updated main wikitext after archived byte loss' )
		);
		$savedRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Main-only update' ) );

		$this->assertNotNull( $savedRev );
		$this->assertTrue( $updater->wasSuccessful() );
		$this->assertSame( $initialRevId, $savedRev->getParentId() );
		$this->assertGreaterThan( $initialRevId, $savedRev->getId() );
		$this->assertSame(
			'Updated main wikitext after archived byte loss',
			$savedRev->getContent( SlotRecord::MAIN )->getText()
		);

		// Stored layers slot is identical in bytes and model
		$this->assertTrue( $savedRev->hasSlot( PageRevisionWriter::SLOT ) );
		$inheritedSlot = $savedRev->getContent( PageRevisionWriter::SLOT );
		$this->assertSame( LayersDocumentContent::MODEL, $inheritedSlot->getModel() );
		$this->assertSame( $initialLayersBytes, $inheritedSlot->serialize() );

		// Re-publishing the missing archived PDF bytes fails closed
		try {
			$this->publisher->publish(
				$page->getTitle(),
				$actor,
				$savedRev->getId(),
				$archivedDoc,
				'Mutation attempt with missing archived bytes'
			);
			$this->fail( 'Mutating layers with missing archived bytes must throw PublicationException' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		// Revision unchanged after failed mutation
		$latestRev = $lookup->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $savedRev->getId(), $latestRev->getId() );
		$this->assertSame( $initialLayersBytes, $latestRev->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/** L02 internal reader resolves old and current versions without exposing storage objects. */
	public function testExactRevisionReadBundleWithRealSources(): void {
		$actor = $this->actor();
		$page = $this->getNonexistingTestPage();
		$title = 'File:L02_Read_Source.pdf';
		$first = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $title );
		$image = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', 'File:L02_Read.png' );
		$oldDocument = $this->buildDocument( [
			$this->makeSlideSurface(),
			$this->makeImageSurface( 'image', 'Image', 'File:L02_Read.png', $image->getTimestamp(), $image->getSha1() ),
			$this->makePdfSurface( 'pdf', 'Old PDF page 2', $title, $first->getTimestamp(), $first->getSha1(), 2 )
		] );
		$oldId = $this->publisher->publish( $page->getTitle(), $actor, 0, $oldDocument,
			'Initial mixed document', new WikitextContent( 'Owner' ) );
		$replacement = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf', $title, '20260907120000' );
		$newDocument = $this->buildDocument( [ $this->makePdfSurface(
			'pdf', 'New PDF page 1', $title, $replacement->getTimestamp(), $replacement->getSha1(), 1
		) ] );
		$newId = $this->publisher->publish( $page->getTitle(), $actor, $oldId, $newDocument, 'Replace document' );
		$reader = new \MediaWiki\Extension\Layers\Revision\PageReadService(
			new \MediaWiki\Extension\Layers\Revision\PageHistoryAccess(
				$this->getServiceContainer()->getRevisionLookup() ), $this->resolver );
		$old = $reader->read( $page->getTitle(), $oldId, $actor );
		$current = $reader->read( $page->getTitle(), $newId, $actor );
		$this->assertSame( $oldId, $old['revisionId'] );
		$this->assertEquals( json_decode( $oldDocument, true ), $old['snapshot'] );
		$this->assertSame( [ 'page' => 2, 'width' => 208, 'height' => 416, 'units' => 'file-handler-pixels' ],
			$old['sourceGeometry']['pdf'] );
		$this->assertSame( [ 'page' => 1, 'width' => 1, 'height' => 1, 'units' => 'file-handler-pixels' ],
			$old['sourceGeometry']['image'] );
		$this->assertArrayNotHasKey( 'presentation', $old['sourceGeometry'] );
		$this->assertSame( $newId, $current['revisionId'] );
		$this->assertEquals( json_decode( $newDocument, true ), $current['snapshot'] );
		$this->assertSame( [ 'page' => 1, 'width' => 625, 'height' => 312, 'units' => 'file-handler-pixels' ],
			$current['sourceGeometry']['pdf'] );
		$this->assertSame( [ 'revisionId', 'snapshot', 'sourceGeometry' ], array_keys( $old ) );

		// Loss of old bytes must not redirect the reader to the still-readable current PDF.
		$archived = $this->resolver->resolve( new LayersDocumentContent( $oldDocument ), $actor )['pdf'];
		$this->assertStatusGood( $this->repo->getBackend()->delete( [ 'src' => $archived->getPath() ] ) );
		try {
			$reader->read( $page->getTitle(), $oldId, $actor );
			$this->fail( 'Missing archived source must reject the complete read bundle' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( $current, $reader->read( $page->getTitle(), $newId, $actor ) );
	}

	/** Revision authorization must run before source metadata is touched. */
	public function testReadBundleDenialPrecedesSourceResolution(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$id = $this->publisher->publish( $page->getTitle(), $actor, 0,
			$this->buildDocument( [ $this->makeSlideSurface() ] ), 'Slide', new WikitextContent( 'Owner' ) );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$reader = new \MediaWiki\Extension\Layers\Revision\PageReadService(
			new \MediaWiki\Extension\Layers\Revision\PageHistoryAccess(
				$this->getServiceContainer()->getRevisionLookup() ), $sources );
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-revision-unavailable' );
		$reader->read( $page->getTitle(), $id, $denied );
	}

	/**
	 * J28 (1): Zero, negative and foreign-owner revision IDs fail before source resolution.
	 * Proves that invalid or foreign-owner revision requests are rejected by owner authorization
	 * and revision checks in PageHistoryAccess without touching SourceVersionResolver.
	 */
	public function testReadRejectsNonPositiveAndForeignOwnerRevisionBeforeSourceResolution(): void {
		$pageA = $this->getNonexistingTestPage();
		$actor = $this->actor();

		// Publish a valid document to Page A to obtain a real revision ID
		$doc = $this->buildDocument( [ $this->makeSlideSurface( 'pres', 'Page A Slide' ) ] );
		$revIdA = $this->publisher->publish(
			$pageA->getTitle(),
			$actor,
			0,
			$doc,
			'Publish Page A document',
			new WikitextContent( 'Owner A' )
		);
		$this->assertGreaterThan( 0, $revIdA );

		// Source resolver must never receive a resolve() call for invalid or foreign revisions
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$reader = new PageReadService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$sources
		);

		// 1a. Zero revision ID must fail before source resolution
		try {
			$reader->read( $pageA->getTitle(), 0, $actor );
			$this->fail( 'Zero revision ID must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// 1b. Negative revision ID must fail before source resolution
		try {
			$reader->read( $pageA->getTitle(), -1, $actor );
			$this->fail( 'Negative revision ID must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}

		// 1c. Revision belonging to another owner (Page A) requested under Page B must fail
		$pageB = $this->getNonexistingTestPage();
		$updaterB = $pageB->newPageUpdater( $actor );
		$updaterB->setContent(
			SlotRecord::MAIN,
			new WikitextContent( 'Owner B main text' )
		);
		$updaterB->saveRevision( CommentStoreComment::newUnsavedComment( 'Create Page B' ) );
		$this->assertGreaterThan( 0, $pageB->getId() );
		$this->assertNotSame( $pageA->getId(), $pageB->getId() );

		try {
			$reader->read( $pageB->getTitle(), $revIdA, $actor );
			$this->fail( 'Foreign owner revision ID must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	/**
	 * J28 (2): Hidden/deleted-text revision fails before source resolution under current read policy.
	 * When a revision has DELETED_TEXT visibility and the reader lacks deletedtext permission,
	 * PageHistoryAccess rejects the read and SourceVersionResolver is never invoked.
	 */
	public function testReadRejectsDeletedTextRevisionBeforeSourceResolution(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$doc = $this->buildDocument( [ $this->makeSlideSurface( 'slide', 'Deleted Text Slide' ) ] );
		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$doc,
			'Publish slide document',
			new WikitextContent( 'Owner main text' )
		);
		$this->assertGreaterThan( 0, $revId );

		// Mark revision text as deleted in the database
		$this->getDb()->newUpdateQueryBuilder()
			->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revId ] )
			->caller( __METHOD__ )
			->execute();

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$updatedRev = $lookup->getRevisionById(
			$revId,
			\Wikimedia\Rdbms\IDBAccessObject::READ_LATEST
		);
		$this->assertSame( RevisionRecord::DELETED_TEXT, $updatedRev->getVisibility() );

		// Reader actor lacks deletedtext permission
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );

		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$reader = new PageReadService( new PageHistoryAccess( $lookup ), $sources );

		try {
			$reader->read( $page->getTitle(), $revId, $actor );
			$this->fail( 'Deleted text revision must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
	}

	/**
	 * J28 (3): Denied source access is exposed only as layers-revision-unavailable without partial bundle.
	 * Proves that when SourceVersionResolver rejects source access with layers-source-unavailable,
	 * PageReadService wraps and re-throws strictly as layers-revision-unavailable, returning no bundle.
	 */
	public function testReadDeniedSourceAccessExposedOnlyAsRevisionUnavailableWithoutPartialBundle(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$file = $this->uploadFixtureFile( $imageFixture, 'File:J28_Denied_Source.png', '20260906120000' );

		$doc = $this->buildDocument( [
			$this->makeImageSurface(
				'img1',
				'Image Surface',
				'File:J28_Denied_Source.png',
				$file->getTimestamp(),
				$file->getSha1()
			)
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$doc,
			'Publish image document',
			new WikitextContent( 'Owner' )
		);
		$this->assertGreaterThan( 0, $revId );

		// Configure resolver to deny source access (throwing layers-source-unavailable)
		$sources = $this->createMock( SourceVersionResolver::class );
		$sourceException = new \DomainException( 'layers-source-unavailable' );
		$sources->expects( $this->once() )
			->method( 'resolve' )
			->willThrowException( $sourceException );

		$reader = new PageReadService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$sources
		);

		$bundle = null;
		try {
			$bundle = $reader->read( $page->getTitle(), $revId, $actor );
			$this->fail( 'Denied source access must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			$this->assertSame( $sourceException, $e->getPrevious() );
		}
		$this->assertNull( $bundle, 'No partial bundle may be returned on denied source access' );

		// Also exercise the real source authorization path, not just exception mapping.
		$denied = $this->createMock( Authority::class );
		$denied->method( 'getUser' )->willReturn( $actor->getUser() );
		$checked = [];
		$denied->method( 'authorizeRead' )->willReturnCallback(
			static function ( $permission, $target ) use ( &$checked ) {
				$checked[] = $target->getNamespace();
				return $target->getNamespace() !== NS_FILE;
			} );
		$realReader = new PageReadService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ), $this->resolver );
		$bundle = null;
		try {
			$bundle = $realReader->read( $page->getTitle(), $revId, $denied );
			$this->fail( 'Owner access must not bypass the real source read check' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( [ $page->getTitle()->getNamespace(), NS_FILE ], $checked );
		$this->assertNull( $bundle );
	}

	/**
	 * J28 (4): Zero, negative, or unavailable handler dimensions reject the bundle without invented geometry.
	 * Verifies that when File::getWidth() / getHeight() returns 0, negative integers, or false/non-int,
	 * PageReadService rejects the complete bundle with layers-revision-unavailable.
	 */
	public function testReadRejectsNonPositiveOrUnavailableHandlerDimensions(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$imageFixture = __DIR__ . '/../../fixtures/assets/test-image.png';
		$fileTitle = 'File:J28_Geometry_' . wfRandomString( 6 ) . '.png';
		$file = $this->uploadFixtureFile( $imageFixture, $fileTitle, '20260906120000' );

		$doc = $this->buildDocument( [
			$this->makeImageSurface(
				'img1',
				'Geometry Surface',
				$fileTitle,
				$file->getTimestamp(),
				$file->getSha1()
			)
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$doc,
			'Publish geometry test document',
			new WikitextContent( 'Owner' )
		);
		$this->assertGreaterThan( 0, $revId );

		$invalidDimensionCases = [
			'zero-width' => [ 0, 100 ],
			'zero-height' => [ 100, 0 ],
			'negative-width' => [ -1, 100 ],
			'negative-height' => [ 100, -5 ],
			'unavailable-false-width' => [ false, 100 ],
			'unavailable-false-height' => [ 100, false ],
		];

		foreach ( $invalidDimensionCases as $caseLabel => [ $mockWidth, $mockHeight ] ) {
			$mockFile = $this->createMock( File::class );
			$mockFile->method( 'getWidth' )->willReturn( $mockWidth );
			$mockFile->method( 'getHeight' )->willReturn( $mockHeight );

			$sources = $this->createMock( SourceVersionResolver::class );
			$sources->method( 'resolve' )->willReturn( [ 'img1' => $mockFile ] );

			$reader = new PageReadService(
				new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
				$sources
			);

			$bundle = null;
			try {
				$bundle = $reader->read( $page->getTitle(), $revId, $actor );
				$this->fail( "Invalid dimensions ({$caseLabel}) must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame(
					'layers-revision-unavailable',
					$e->getMessage(),
					"Case {$caseLabel} must throw layers-revision-unavailable"
				);
			}
			$this->assertNull( $bundle, "Case {$caseLabel} must return no bundle" );
		}
	}

	/**
	 * J28 (5): A source-free slide-only bundle has an empty geometry map and zero repository lookups.
	 * Verifies that reading a slide-only revision produces an empty sourceGeometry map and
	 * does not touch LocalRepo or TitleFactory during resolution or bundle assembly.
	 */
	public function testReadSlideOnlyBundleHasEmptyGeometryAndZeroRepositoryLookups(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		$slideDoc = $this->buildDocument( [
			$this->makeSlideSurface( 'slide1', 'Presentation Title Slide' ),
			$this->makeSlideSurface( 'slide2', 'Presentation Content Slide' )
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$slideDoc,
			'Publish slide presentation',
			new WikitextContent( 'Slide presentation main content' )
		);
		$this->assertGreaterThan( 0, $revId );

		// LocalRepo and TitleFactory must receive zero calls during slide-only resolution
		$unusedRepo = $this->createMock( LocalRepo::class );
		$unusedRepo->expects( $this->never() )->method( 'findFile' );
		$unusedRepo->expects( $this->never() )->method( 'fileExists' );
		$unusedRepo->expects( $this->never() )->method( 'getBackend' );

		$unusedTitles = $this->createMock( TitleFactory::class );
		$unusedTitles->expects( $this->never() )->method( 'newFromText' );

		$resolver = new SourceVersionResolver( $unusedRepo, $unusedTitles );
		$reader = new PageReadService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$resolver
		);

		$bundle = $reader->read( $page->getTitle(), $revId, $actor );

		$this->assertIsArray( $bundle );
		$this->assertSame( [ 'revisionId', 'snapshot', 'sourceGeometry' ], array_keys( $bundle ) );
		$this->assertSame( $revId, $bundle['revisionId'] );
		$this->assertEquals( json_decode( $slideDoc, true ), $bundle['snapshot'] );
		$this->assertSame( [], $bundle['sourceGeometry'], 'Slide-only bundle must have empty sourceGeometry map' );
	}

}
