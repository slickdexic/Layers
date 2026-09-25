<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageAssetService;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PrivateRasterRenderer;
use MediaWiki\Extension\Layers\Revision\SourceRenderAdmission;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\File\OldLocalFile;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\FileBackend\FSFile\TempFSFileFactory;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Delivery-time authorization acceptance tests for PageAssetService.
 *
 * Verifies exact revision/owner mismatch, hidden revisions, archived PDF page selection,
 * whole-document pre/post-render policies, mid-render suppression with empty staging,
 * and renderer error mapping and propagation.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PageAssetService
 * @group Database
 */
class PageAssetServiceTest extends RealAssetTestCase {

	/** Invalid raster widths cannot consume revision, source-metadata or rendering work. */
	public function testInvalidWidthIsRejectedBeforeRevisionAndSourceLookups(): void {
		$access = $this->createMock( PageHistoryAccess::class );
		$access->expects( $this->never() )->method( 'read' );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$renderer = $this->createMock( PrivateRasterRenderer::class );
		$renderer->expects( $this->never() )->method( 'render' );
		$service = new PageAssetService( $access, $sources, $renderer );
		$owner = $this->getNonexistingTestPage()->getTitle();
		$reader = $this->actor();
		foreach ( [ 0, -1, 4097, PHP_INT_MAX ] as $width ) {
			try {
				$service->prepare( $owner, 1, 'image', $width, $reader );
				$this->fail( 'Invalid width must reject before any lookup' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			}
		}
	}

	/** Completed real raster bytes must be withheld when access changes during rendering. */
	public function testAssetPreparationReauthorizesAfterRendering(): void {
		$actor = $this->actor();
		$directory = $this->getNewTempDirectory();
		$realRenderer = new PrivateRasterRenderer(
			new TempFSFileFactory( $directory ),
			$this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' ) );
		foreach ( [ 'allowed', 'owner', 'source', 'hidden', 'missing-bytes' ] as $case ) {
			$page = $this->getNonexistingTestPage();
			$title = 'File:L02_Delivery_' . $case . '.png';
			$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', $title );
			$document = $this->buildDocument( [ $this->makeImageSurface(
				'img', 'Image', $title, $file->getTimestamp(), $file->getSha1() ) ] );
			$id = $this->publisher->publish( $page->getTitle(), $actor, 0, $document,
				'Prepare raster', new WikitextContent( 'Owner' ) );
			$rendered = false;
			$reader = $this->createMock( Authority::class );
			$reader->method( 'getUser' )->willReturn( $actor->getUser() );
			$reader->method( 'authorizeRead' )->willReturnCallback(
				static function ( $permission, $target ) use ( &$rendered, $case ) {
					return $permission === 'read' && ( !$rendered || ( $case !== 'owner' &&
						( $case !== 'source' || $target->getNamespace() !== NS_FILE ) ) );
				} );
			$renderer = $this->createMock( PrivateRasterRenderer::class );
			$renderer->expects( $this->once() )->method( 'render' )->willReturnCallback(
				function ( $source, $sourcePage, $width ) use ( $realRenderer, &$rendered, $case, $id ) {
					$raster = $realRenderer->render( $source, $sourcePage, $width );
					$this->assertNotEmpty( $raster['bytes'] );
					$rendered = true;
					if ( $case === 'missing-bytes' ) {
						$this->assertStatusGood( $this->repo->getBackend()->delete( [ 'src' => $source->getPath() ] ) );
					}
					if ( $case === 'hidden' ) {
						$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
							->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
							->where( [ 'rev_id' => $id ] )->caller( 'Layers post-render visibility test' )->execute();
					}
					return $raster;
				} );
			$service = new PageAssetService(
				new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
				$this->resolver, $renderer );
			$result = null;
			try {
				$result = $service->prepare( $page->getTitle(), $id, 'img', 1, $reader );
				$this->assertSame( 'allowed', $case, 'Revoked access must withhold completed bytes' );
				$this->assertSame( [ 'mime', 'width', 'height', 'bytes' ], array_keys( $result ) );
				$this->assertSame( 1, getimagesizefromstring( $result['bytes'] )[0] );
			} catch ( \DomainException $e ) {
				$this->assertNotSame( 'allowed', $case );
				$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
				$this->assertNull( $result );
			}
			$this->assertTrue( $rendered );
			$this->assertSame( [], glob( $directory . '/*' ) );
		}
	}

	/** Slides and unknown surface IDs cannot invoke the source renderer. */
	public function testAssetPreparationRejectsNonAssetSurfaces(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$id = $this->publisher->publish( $page->getTitle(), $actor, 0,
			$this->buildDocument( [ $this->makeSlideSurface( 'slide', 'Ideas' ) ] ),
			'Create slide', new WikitextContent( 'Owner' ) );
		$renderer = $this->createMock( PrivateRasterRenderer::class );
		$renderer->expects( $this->never() )->method( 'render' );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$service = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ), $sources, $renderer );
		foreach ( [ 'slide', 'missing' ] as $surface ) {
			try {
				$service->prepare( $page->getTitle(), $id, $surface, 100, $actor );
				$this->fail( 'No source raster exists for this surface' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			}
		}
	}

	/**
	 * J29b: Asset preparation rejects foreign, missing, or hidden revisions before rendering.
	 * Verifies that foreign owner/revision pairs, non-positive or nonexistent revision IDs,
	 * and revisions with DELETED_TEXT visibility (when reader lacks deletedtext permission)
	 * are rejected before source resolution or rendering are invoked.
	 */
	public function testAssetPreparationRejectsForeignMissingOrHiddenRevisionBeforeRendering(): void {
		$actor = $this->actor();
		$pageA = $this->getNonexistingTestPage();
		$title = 'File:J29b_Foreign_Owner.png';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', $title );
		$doc = $this->buildDocument( [ $this->makeImageSurface(
			'img1', 'Image', $title, $file->getTimestamp(), $file->getSha1() ) ] );
		$revIdA = $this->publisher->publish(
			$pageA->getTitle(), $actor, 0, $doc, 'Publish Page A', new WikitextContent( 'Owner A' )
		);
		$this->assertGreaterThan( 0, $revIdA );

		// Setup resolver and renderer mocks that must NEVER be invoked on early revision failures
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$renderer = $this->createMock( PrivateRasterRenderer::class );
		$renderer->expects( $this->never() )->method( 'render' );

		$service = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$sources,
			$renderer
		);

		// 1a. Foreign owner/revision pair: requesting Rev A under Page B
		$pageB = $this->getNonexistingTestPage();
		$updaterB = $pageB->newPageUpdater( $actor );
		$updaterB->setContent( SlotRecord::MAIN, new WikitextContent( 'Owner B' ) );
		$updaterB->saveRevision( CommentStoreComment::newUnsavedComment( 'Create Page B' ) );
		$this->assertGreaterThan( 0, $pageB->getId() );
		$this->assertNotSame( $pageA->getId(), $pageB->getId() );

		$result = null;
		try {
			$result = $service->prepare( $pageB->getTitle(), $revIdA, 'img1', 100, $actor );
			$this->fail( 'Foreign owner/revision must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );

		// 1b. Missing or non-positive revision IDs
		$missingId = (int)$this->getDb()->newSelectQueryBuilder()->select( 'MAX(rev_id)' )
			->from( 'revision' )->caller( __METHOD__ )->fetchField() + 1;
		foreach ( [ 0, -1, $missingId ] as $badRevId ) {
			$result = null;
			try {
				$result = $service->prepare( $pageA->getTitle(), $badRevId, 'img1', 100, $actor );
				$this->fail( "Revision ID {$badRevId} must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			}
			$this->assertNull( $result );
		}

		// 1c. Hidden revision (DELETED_TEXT) before rendering
		$pageC = $this->getNonexistingTestPage();
		$revIdC = $this->publisher->publish(
			$pageC->getTitle(), $actor, 0, $doc, 'Publish Page C', new WikitextContent( 'Owner C' )
		);
		$this->getDb()->newUpdateQueryBuilder()
			->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $revIdC ] )
			->caller( __METHOD__ )
			->execute();

		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$result = null;
		try {
			$result = $service->prepare( $pageC->getTitle(), $revIdC, 'img1', 100, $actor );
			$this->fail( 'Hidden revision must throw DomainException before rendering' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
	}

	/**
	 * J29b: Asset preparation renders exact archived PDF page after replacement with shorter PDF.
	 * Publishes a revision referencing page 2 of a 2-page PDF (T1), replaces the PDF with a 1-page PDF (T2).
	 * Proves that prepare() derives source filename, timestamp, hash, and page exclusively from the snapshot,
	 * resolves the exact archived OldLocalFile without falling back to latest, and renders the 40x80 px raster.
	 */
	public function testAssetPreparationRendersArchivedPdfPageAfterReplacementWithShorterPdf(): void {
		$actor = $this->actor();
		$directory = $this->getNewTempDirectory();
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		$pdfFixture = __DIR__ . '/../../fixtures/assets/test-multipage.pdf';
		$replacementFixture = __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf';
		$titleText = 'File:J29b_Archived_Pdf_' . wfRandomString( 6 ) . '.pdf';

		// Upload initial 2-page PDF (T1)
		$pdfFileT1 = $this->uploadFixtureFile( $pdfFixture, $titleText, '20260906120000', 'Upload T1 2-page' );
		$this->assertSame( 2, $pdfFileT1->pageCount() );
		$timestampT1 = $pdfFileT1->getTimestamp();
		$sha1T1 = $pdfFileT1->getSha1();

		// Publish document pinned to T1 page 2
		$page = $this->getNonexistingTestPage();
		$docPinnedPage2 = $this->buildDocument( [
			$this->makePdfSurface( 'pdf_p2', 'PDF Page 2', $titleText, $timestampT1, $sha1T1, 2 )
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$docPinnedPage2,
			'Publish pinned to T1 page 2',
			new WikitextContent( 'Owner pinned to T1 page 2' )
		);
		$this->assertGreaterThan( 0, $revId );

		// Replace with 1-page PDF (T2)
		$pdfFileT2 = $this->uploadFixtureFile(
			$replacementFixture, $titleText, '20260907120000', 'Upload T2 1-page replacement'
		);
		$this->assertSame( 1, $pdfFileT2->pageCount(), 'Current file must now report only 1 page' );

		// Observe the exact pinned source and page, then execute the real renderer.
		$observedRenderer = $this->createMock( PrivateRasterRenderer::class );
		$observedRenderer->expects( $this->once() )->method( 'render' )->willReturnCallback(
			function ( $source, $sourcePage, $width ) use ( $renderer, $pdfFileT1, $timestampT1, $sha1T1 ) {
				$this->assertInstanceOf( OldLocalFile::class, $source );
				$this->assertSame( $pdfFileT1->getName(), $source->getName() );
				$this->assertSame( $timestampT1, $source->getTimestamp() );
				$this->assertSame( $sha1T1, $source->getSha1() );
				$this->assertSame( 2, $sourcePage );
				$this->assertSame( 40, $width );
				return $renderer->render( $source, $sourcePage, $width );
			} );
		$service = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$observedRenderer
		);

		$raster = $service->prepare( $page->getTitle(), $revId, 'pdf_p2', 40, $actor );

		$this->assertSame( [ 'mime', 'width', 'height', 'bytes' ], array_keys( $raster ) );
		$this->assertContains( $raster['mime'], [ 'image/png', 'image/jpeg' ] );
		$this->assertSame( 40, $raster['width'] );
		$this->assertSame( 80, $raster['height'], 'Page 2 (100x200 pt) rendered at width 40 must have height 80' );

		$decoded = getimagesizefromstring( $raster['bytes'] );
		$this->assertSame( $raster['mime'], $decoded['mime'] );
		$this->assertSame( 40, $decoded[0] );
		$this->assertSame( 80, $decoded[1] );
		$this->assertSame( [], glob( $directory . '/*' ), 'Staging must be purged after delivery' );
	}

	/**
	 * J29b: Whole-document authorization policy enforced both before and after rendering.
	 * In a mixed slide + image + PDF document, denying read access to the PDF source blocks delivery
	 * of the image source before rendering begins. Revoking access to the PDF source during rendering
	 * withholds completed image raster bytes after rendering.
	 */
	public function testAssetPreparationEnforcesWholeDocumentPolicyBeforeAndAfterRendering(): void {
		$actor = $this->actor();
		$directory = $this->getNewTempDirectory();
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$realRenderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		$imgTitle = 'File:J29b_Mixed_Img_' . wfRandomString( 6 ) . '.png';
		$pdfTitle = 'File:J29b_Mixed_Pdf_' . wfRandomString( 6 ) . '.pdf';
		$imgFile = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', $imgTitle );
		$pdfFile = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $pdfTitle );

		$mixedDoc = $this->buildDocument( [
			$this->makeSlideSurface( 'slide1', 'Slide Surface' ),
			$this->makeImageSurface(
				'img1', 'Image Surface', $imgTitle, $imgFile->getTimestamp(), $imgFile->getSha1()
			),
			$this->makePdfSurface(
				'pdf1', 'PDF Surface', $pdfTitle, $pdfFile->getTimestamp(), $pdfFile->getSha1(), 1
			),
		] );

		$page = $this->getNonexistingTestPage();
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $mixedDoc, 'Publish mixed document', new WikitextContent( 'Owner' )
		);
		$this->assertGreaterThan( 0, $revId );

		$pdfTitleObj = $this->getServiceContainer()->getTitleFactory()->newFromText( $pdfTitle );

		// 3a. Pre-render whole-document denial: Reader can access owner and img1, but denied pdf1
		$preDeniedReader = $this->createMock( Authority::class );
		$preDeniedReader->method( 'getUser' )->willReturn( $actor->getUser() );
		$preDeniedReader->method( 'authorizeRead' )->willReturnCallback(
			static function ( $perm, $target ) use ( $pdfTitleObj ) {
				return $perm === 'read' && !$target->equals( $pdfTitleObj );
			} );

		$mockRenderer = $this->createMock( PrivateRasterRenderer::class );
		$mockRenderer->expects( $this->never() )->method( 'render' );

		$servicePre = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$mockRenderer
		);

		$resultPre = null;
		try {
			$resultPre = $servicePre->prepare( $page->getTitle(), $revId, 'img1', 1, $preDeniedReader );
			$this->fail( 'Pre-render denial of different source in document must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
		$this->assertNull( $resultPre );

		// 3b. Post-render whole-document denial: Reader access to pdf1 is revoked during img1 rendering
		$rendered = false;
		$postDeniedReader = $this->createMock( Authority::class );
		$postDeniedReader->method( 'getUser' )->willReturn( $actor->getUser() );
		$postDeniedReader->method( 'authorizeRead' )->willReturnCallback(
			static function ( $perm, $target ) use ( &$rendered, $pdfTitleObj ) {
				if ( $perm !== 'read' ) {
					return false;
				}
				// Once rendered is true, access to the PDF source is revoked
				if ( $rendered && $target->equals( $pdfTitleObj ) ) {
					return false;
				}
				return true;
			} );

		$spyingRenderer = $this->createMock( PrivateRasterRenderer::class );
		$spyingRenderer->expects( $this->once() )
			->method( 'render' )
			->willReturnCallback( static function ( $source, $page, $width ) use ( $realRenderer, &$rendered ) {
				$raster = $realRenderer->render( $source, $page, $width );
				$rendered = true;
				return $raster;
			} );

		$servicePost = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$spyingRenderer
		);

		$resultPost = null;
		try {
			$resultPost = $servicePost->prepare( $page->getTitle(), $revId, 'img1', 1, $postDeniedReader );
			$this->fail( 'Post-render revocation of different source in document must withhold completed bytes' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
		$this->assertNull( $resultPost );
		$this->assertTrue( $rendered, 'Renderer must have completed real raster before revocation' );
		$this->assertSame( [], glob( $directory . '/*' ), 'Staging must remain empty' );
	}

	/**
	 * J29b: Asset preparation withholds completed bytes when pinned archived source is suppressed mid-render.
	 * Injects a renderer callback that generates real raster bytes for a pinned archived OldLocalFile,
	 * then suppresses the archived version with bytes retained, or removes its physical bytes.
	 * Proves that prepare() rechecks all pinned sources, detects the loss, withholds completed bytes,
	 * and leaves owned staging empty.
	 *
	 * @dataProvider provideArchivedSourceRevocationModes
	 * @param string $mode
	 */
	public function testAssetPreparationWithholdsBytesWhenArchivedSourceSuppressedMidRender( string $mode ): void {
		$actor = $this->actor();
		$directory = $this->getNewTempDirectory();
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$realRenderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		$titleText = 'File:J29b_Archived_Loss_' . wfRandomString( 6 ) . '.png';
		$fileT1 = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', $titleText, '20260906120000', 'Upload T1'
		);
		$timestampT1 = $fileT1->getTimestamp();
		$sha1T1 = $fileT1->getSha1();

		$page = $this->getNonexistingTestPage();
		$docPinnedT1 = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Archived Surface', $titleText, $timestampT1, $sha1T1 )
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $docPinnedT1, 'Publish pinned T1', new WikitextContent( 'Owner' )
		);
		$this->assertGreaterThan( 0, $revId );

		// Replace with T2 so T1 becomes an archived OldLocalFile
		$fileT2 = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			$titleText,
			'20260907120000',
			'Upload T2 replacement'
		);
		$this->assertNotSame( $sha1T1, $fileT2->getSha1() );

		$rendered = false;
		$rendererCallback = $this->createMock( PrivateRasterRenderer::class );
		$rendererCallback->expects( $this->once() )
			->method( 'render' )
			->willReturnCallback(
				function ( $source, $page, $width ) use ( $realRenderer, &$rendered, $mode, $fileT2 ) {
					$this->assertInstanceOf( OldLocalFile::class, $source, 'Source must be an OldLocalFile' );
					$raster = $realRenderer->render( $source, $page, $width );
					$this->assertNotEmpty( $raster['bytes'] );
					$rendered = true;
					if ( $mode === 'suppressed' ) {
						$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
							->set( [ 'oi_deleted' => File::DELETED_FILE | File::DELETED_RESTRICTED ] )
							->where( [ 'oi_name' => $source->getName(), 'oi_timestamp' => $source->getTimestamp() ] )
							->caller( 'Layers archived suppression test' )->execute();
						$this->assertSame( 1, $this->getDb()->affectedRows() );
						$this->assertTrue( $this->repo->fileExists( $source->getPath() ),
							'Suppression must be detected while archived bytes remain present' );
					} else {
						$this->assertStatusGood( $this->repo->getBackend()->delete( [ 'src' => $source->getPath() ] ) );
						$this->assertFalse( $this->repo->fileExists( $source->getPath() ) );
					}
					$this->assertTrue( $this->repo->fileExists( $fileT2->getPath() ) );
					return $raster;
				} );

		$service = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$rendererCallback
		);

		$result = null;
		try {
			$result = $service->prepare( $page->getTitle(), $revId, 'img1', 1, $actor );
			$this->fail( 'Suppressed archived source bytes must withhold completed raster' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertTrue( $rendered );
		$this->assertSame( [], glob( $directory . '/*' ), 'Staging directory must be completely empty' );
	}

	/** @return array */
	public static function provideArchivedSourceRevocationModes(): array {
		return [ 'suppressed with bytes retained' => [ 'suppressed' ], 'missing bytes' => [ 'missing' ] ];
	}

	/**
	 * J29b: Asset preparation maps generic renderer DomainException and propagates infrastructure errors.
	 * Verifies that DomainException('layers-render-unavailable') is caught and wrapped as
	 * DomainException('layers-asset-unavailable') with the original exception chained,
	 * while infrastructure exceptions like RuntimeException('layers-render-cleanup-failed') propagate uncaught.
	 */
	public function testAssetPreparationMapsRendererDomainExceptionAndPropagatesInfrastructureErrors(): void {
		$actor = $this->actor();
		$titleText = 'File:J29b_Renderer_Mapping_' . wfRandomString( 6 ) . '.png';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', $titleText );

		$page = $this->getNonexistingTestPage();
		$doc = $this->buildDocument( [
			$this->makeImageSurface( 'img1', 'Image Surface', $titleText, $file->getTimestamp(), $file->getSha1() )
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $doc, 'Publish mapping document', new WikitextContent( 'Owner' )
		);
		$this->assertGreaterThan( 0, $revId );

		// 5a. Generic renderer DomainException('layers-render-unavailable') mapped to layers-asset-unavailable
		$rendererDomainFail = $this->createMock( PrivateRasterRenderer::class );
		$renderDomainException = new \DomainException( 'layers-render-unavailable' );
		$rendererDomainFail->expects( $this->once() )
			->method( 'render' )
			->willThrowException( $renderDomainException );

		$serviceDomain = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$rendererDomainFail
		);

		$resultDomain = null;
		try {
			$resultDomain = $serviceDomain->prepare( $page->getTitle(), $revId, 'img1', 100, $actor );
			$this->fail( 'Renderer DomainException must throw layers-asset-unavailable' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			$this->assertSame( $renderDomainException, $e->getPrevious() );
		}
		$this->assertNull( $resultDomain );

		// 5b. Cleanup / infrastructure RuntimeException('layers-render-cleanup-failed') propagates directly
		$rendererRuntimeFail = $this->createMock( PrivateRasterRenderer::class );
		$cleanupException = new \RuntimeException( 'layers-render-cleanup-failed' );
		$rendererRuntimeFail->expects( $this->once() )
			->method( 'render' )
			->willThrowException( $cleanupException );

		$serviceRuntime = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver,
			$rendererRuntimeFail
		);

		$resultRuntime = null;
		try {
			$resultRuntime = $serviceRuntime->prepare( $page->getTitle(), $revId, 'img1', 100, $actor );
			$this->fail( 'Cleanup RuntimeException must propagate without being caught as DomainException' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'layers-render-cleanup-failed', $e->getMessage() );
			$this->assertSame( $cleanupException, $e );
		}
		$this->assertNull( $resultRuntime );

		// Source admission failures must never invoke the renderer and share the generic result.
		$admission = $this->createMock( SourceRenderAdmission::class );
		$denial = new \DomainException( 'layers-render-unavailable' );
		$admission->expects( $this->once() )->method( 'assertCanRender' )
			->with( $this->isInstanceOf( File::class ), 1 )->willThrowException( $denial );
		$unusedRenderer = $this->createMock( PrivateRasterRenderer::class );
		$unusedRenderer->expects( $this->never() )->method( 'render' );
		$serviceDenied = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver, $unusedRenderer, $admission );
		try {
			$serviceDenied->prepare( $page->getTitle(), $revId, 'img1', 100, $actor );
			$this->fail( 'Admission failure must reject before rendering' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			$this->assertSame( $denial, $e->getPrevious() );
		}
	}

	/** Real SourceRenderAdmission through PageAssetService rejects excessive source metadata without rendering. */
	public function testAssetPreparationWithRealAdmissionEnforcesThresholdsWithoutRendering(): void {
		$actor = $this->actor();
		$file = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', 'File:L02_Admission_Image.png'
		);
		$page = $this->getNonexistingTestPage();
		$document = $this->buildDocument( [
			$this->makeImageSurface(
				'img', 'Image', 'File:L02_Admission_Image.png', $file->getTimestamp(), $file->getSha1()
			)
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $document, 'Publish admission doc', new WikitextContent( 'Owner' )
		);

		// Case A: Excessive bytes (MAX_SOURCE_BYTES + 1)
		$mockFileBytes = $this->createMock( File::class );
		$mockFileBytes->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES + 1 );
		$mockFileBytes->expects( $this->never() )->method( 'getWidth' );
		$mockFileBytes->expects( $this->never() )->method( 'getHeight' );

		$resolverBytes = $this->createMock( SourceVersionResolver::class );
		$resolverBytes->expects( $this->once() )->method( 'resolve' )->willReturnCallback(
			function ( $content, $reader ) use ( $mockFileBytes ) {
				// Real exact-source authorization precedes controlled metadata substitution.
				$this->resolver->resolve( $content, $reader );
				return [ 'img' => $mockFileBytes ];
			} );

		$rendererUnused = $this->createMock( PrivateRasterRenderer::class );
		$rendererUnused->expects( $this->never() )->method( 'render' );

		$serviceBytes = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$resolverBytes,
			$rendererUnused,
			new SourceRenderAdmission()
		);

		try {
			$serviceBytes->prepare( $page->getTitle(), $revId, 'img', 100, $actor );
			$this->fail( 'Excessive bytes must reject through PageAssetService' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			$this->assertInstanceOf( \DomainException::class, $e->getPrevious() );
			$this->assertSame( 'layers-render-unavailable', $e->getPrevious()->getMessage() );
		}

		// Case B: Excessive pixels (50,000,000 pixels > 40,000,000)
		$mockFilePixels = $this->createMock( File::class );
		$mockFilePixels->method( 'getSize' )->willReturn( 1024 );
		$mockFilePixels->method( 'getWidth' )->with( 1 )->willReturn( 10000 );
		$mockFilePixels->method( 'getHeight' )->with( 1 )->willReturn( 5000 );

		$resolverPixels = $this->createMock( SourceVersionResolver::class );
		$resolverPixels->expects( $this->once() )->method( 'resolve' )->willReturnCallback(
			function ( $content, $reader ) use ( $mockFilePixels ) {
				// Real exact-source authorization precedes controlled metadata substitution.
				$this->resolver->resolve( $content, $reader );
				return [ 'img' => $mockFilePixels ];
			} );

		$servicePixels = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$resolverPixels,
			$rendererUnused,
			new SourceRenderAdmission()
		);

		try {
			$servicePixels->prepare( $page->getTitle(), $revId, 'img', 100, $actor );
			$this->fail( 'Excessive pixels must reject through PageAssetService' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			$this->assertInstanceOf( \DomainException::class, $e->getPrevious() );
			$this->assertSame( 'layers-render-unavailable', $e->getPrevious()->getMessage() );
		}
	}

	/** SourceRenderAdmission evaluates geometry specifically for the snapshot-pinned PDF page. */
	public function testAssetPreparationBindsAdmissionToSnapshotPinnedPdfPageGeometry(): void {
		$actor = $this->actor();
		$file = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:L02_Admission_Pdf.pdf'
		);
		$page = $this->getNonexistingTestPage();
		$document = $this->buildDocument( [
			$this->makePdfSurface(
				'pdf2', 'Page 2', 'File:L02_Admission_Pdf.pdf', $file->getTimestamp(), $file->getSha1(), 2
			)
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $document, 'Publish pinned PDF doc', new WikitextContent( 'Owner' )
		);

		// Case A: Page 1 is small (100x100) but pinned page 2 is excessive (10,000 x 5,000 = 50M pixels)
		$mockFileOversizedPage2 = $this->createMock( File::class );
		$mockFileOversizedPage2->method( 'getSize' )->willReturn( 10240 );
		$mockFileOversizedPage2->method( 'getWidth' )->willReturnCallback(
			static fn ( $p ) => $p === 2 ? 10000 : 100
		);
		$mockFileOversizedPage2->method( 'getHeight' )->willReturnCallback(
			static fn ( $p ) => $p === 2 ? 5000 : 100
		);

		$resolverA = $this->createMock( SourceVersionResolver::class );
		$resolverA->expects( $this->once() )->method( 'resolve' )->willReturnCallback(
			function ( $content, $reader ) use ( $mockFileOversizedPage2 ) {
				// Real exact-source authorization precedes controlled metadata substitution.
				$this->resolver->resolve( $content, $reader );
				return [ 'pdf2' => $mockFileOversizedPage2 ];
			} );

		$rendererUnused = $this->createMock( PrivateRasterRenderer::class );
		$rendererUnused->expects( $this->never() )->method( 'render' );

		$serviceA = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$resolverA,
			$rendererUnused,
			new SourceRenderAdmission()
		);

		try {
			$serviceA->prepare( $page->getTitle(), $revId, 'pdf2', 100, $actor );
			$this->fail( 'Oversized pinned page 2 must reject even if page 1 is small' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
			$this->assertInstanceOf( \DomainException::class, $e->getPrevious() );
			$this->assertSame( 'layers-render-unavailable', $e->getPrevious()->getMessage() );
		}

		// Case B: Page 1 is excessive (50M pixels) but pinned page 2 is small (100x100) -> admitted & renders
		$mockFileSmallPage2 = $this->createMock( File::class );
		$mockFileSmallPage2->method( 'getSize' )->willReturn( 10240 );
		$mockFileSmallPage2->method( 'getWidth' )->willReturnCallback(
			static fn ( $p ) => $p === 2 ? 100 : 10000
		);
		$mockFileSmallPage2->method( 'getHeight' )->willReturnCallback(
			static fn ( $p ) => $p === 2 ? 100 : 5000
		);

		$resolverB = $this->createMock( SourceVersionResolver::class );
		$resolverB->expects( $this->exactly( 2 ) )->method( 'resolve' )->willReturnCallback(
			function ( $content, $reader ) use ( $mockFileSmallPage2 ) {
				// Real exact-source authorization precedes controlled metadata substitution.
				$this->resolver->resolve( $content, $reader );
				return [ 'pdf2' => $mockFileSmallPage2 ];
			} );

		$rendererUsed = $this->createMock( PrivateRasterRenderer::class );
		$rendererUsed->expects( $this->once() )
			->method( 'render' )
			->with( $mockFileSmallPage2, 2, 100 )
			->willReturn( [ 'mime' => 'image/png', 'width' => 100, 'height' => 100, 'bytes' => 'raster-bytes' ] );

		$serviceB = new PageAssetService(
			new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$resolverB,
			$rendererUsed,
			new SourceRenderAdmission()
		);

		$result = $serviceB->prepare( $page->getTitle(), $revId, 'pdf2', 100, $actor );
		$this->assertSame( 'raster-bytes', $result['bytes'] );
	}

	/** Mixed document charges only selected source; source-free slides never invoke renderer. */
	public function testAssetPreparationMixedDocumentAdmissionAndSourceFreeSlides(): void {
		$actor = $this->actor();
		$imgFile = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-image.png', 'File:L02_Mixed_Image.png'
		);
		$pdfFile = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:L02_Mixed_Pdf.pdf'
		);
		$page = $this->getNonexistingTestPage();
		$document = $this->buildDocument( [
			$this->makeImageSurface(
				'img', 'Image', 'File:L02_Mixed_Image.png', $imgFile->getTimestamp(), $imgFile->getSha1()
			),
			$this->makePdfSurface(
				'pdf', 'PDF Page 1', 'File:L02_Mixed_Pdf.pdf', $pdfFile->getTimestamp(), $pdfFile->getSha1(), 1
			),
			$this->makeSlideSurface( 'slide', 'Standalone Slide' )
		] );
		$revId = $this->publisher->publish(
			$page->getTitle(), $actor, 0, $document, 'Publish mixed document', new WikitextContent( 'Owner' )
		);

		// 1. Source-free slide rejection before resolution, admission or rendering
		$access = new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() );
		$resolverMock = $this->createMock( SourceVersionResolver::class );
		$resolverMock->expects( $this->never() )->method( 'resolve' );
		$rendererMock = $this->createMock( PrivateRasterRenderer::class );
		$rendererMock->expects( $this->never() )->method( 'render' );

		$serviceSlide = new PageAssetService( $access, $resolverMock, $rendererMock );
		try {
			$serviceSlide->prepare( $page->getTitle(), $revId, 'slide', 100, $actor );
			$this->fail( 'Slide surface must be rejected before resolution or rendering' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}

		// 2. Mixed document: sibling PDF exceeds byte limit, but requested image is valid
		$mockImg = $this->createMock( File::class );
		$mockImg->method( 'getSize' )->willReturn( 2048 );
		$mockImg->method( 'getWidth' )->with( 1 )->willReturn( 200 );
		$mockImg->method( 'getHeight' )->with( 1 )->willReturn( 100 );

		$mockPdf = $this->createMock( File::class );
		// Sibling PDF exceeds 64 MiB limit
		$mockPdf->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES + 1 );
		$mockPdf->expects( $this->never() )->method( 'getWidth' );
		$mockPdf->expects( $this->never() )->method( 'getHeight' );

		$resolverMixed = $this->createMock( SourceVersionResolver::class );
		$resolverMixed->expects( $this->exactly( 3 ) )->method( 'resolve' )->willReturnCallback(
			function ( $content, $reader ) use ( $mockImg, $mockPdf ) {
				$resolved = $this->resolver->resolve( $content, $reader );
				$this->assertSame( [ 'img', 'pdf' ], array_keys( $resolved ) );
				return [ 'img' => $mockImg, 'pdf' => $mockPdf ];
			} );

		$rendererMixed = $this->createMock( PrivateRasterRenderer::class );
		// Renderer called ONLY for img
		$rendererMixed->expects( $this->once() )
			->method( 'render' )
			->with( $mockImg, 1, 100 )
			->willReturn( [ 'mime' => 'image/png', 'width' => 100, 'height' => 50, 'bytes' => 'img-raster' ] );

		$serviceMixed = new PageAssetService(
			$access,
			$resolverMixed,
			$rendererMixed,
			new SourceRenderAdmission()
		);

		// Preparing img succeeds despite sibling PDF exceeding limit
		$resImg = $serviceMixed->prepare( $page->getTitle(), $revId, 'img', 100, $actor );
		$this->assertSame( 'img-raster', $resImg['bytes'] );

		// Preparing pdf fails admission without rendering
		$rendererUnusedPdf = $this->createMock( PrivateRasterRenderer::class );
		$rendererUnusedPdf->expects( $this->never() )->method( 'render' );
		$servicePdf = new PageAssetService(
			$access,
			$resolverMixed,
			$rendererUnusedPdf,
			new SourceRenderAdmission()
		);
		try {
			$servicePdf->prepare( $page->getTitle(), $revId, 'pdf', 100, $actor );
			$this->fail( 'Oversized PDF surface must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-asset-unavailable', $e->getMessage() );
		}
	}
}
