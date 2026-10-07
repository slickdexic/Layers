<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Readers receive core renditions of the exact pinned source version, never of the latest upload.
 * @covers \MediaWiki\Extension\Layers\Revision\SourceRenditions
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 */
class SourceRenditionsTest extends RealAssetTestCase {
	private function reader(): PageReadService {
		return new PageReadService( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ),
			$this->resolver, new SourceRenditions( $this->getServiceContainer()->getUrlUtils() ) );
	}

	/** @return array [ owner page, revision ID, old image, old PDF, actor ] for a document pinned to replaced versions */
	private function pinnedToReplacedVersions(): array {
		$actor = $this->actor();
		$page = $this->getNonexistingTestPage();
		$image = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', 'File:Rendition.png' );
		$pdf = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:Rendition.pdf' );
		$document = $this->buildDocument( [
			$this->makeSlideSurface(),
			$this->makeImageSurface( 'image', 'Image', 'File:Rendition.png', $image->getTimestamp(),
				$image->getSha1() ),
			$this->makePdfSurface( 'pdf', 'Page two', 'File:Rendition.pdf', $pdf->getTimestamp(), $pdf->getSha1(), 2 )
		] );
		$revisionId = $this->publisher->publish( $page->getTitle(), $actor, 0, $document, 'Pinned',
			new WikitextContent( 'Owner' ) );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image-replacement.png', 'File:Rendition.png',
			'20260907120000' );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			'File:Rendition.pdf', '20260907120000' );
		return [ $page, $revisionId, $image, $pdf, $actor ];
	}

	public function testRenditionsComeFromTheExactArchivedVersions(): void {
		[ $page, $revisionId, $image, $pdf, $actor ] = $this->pinnedToReplacedVersions();
		$bundle = $this->reader()->read( $page->getTitle(), $revisionId, $actor );
		$this->assertSame( [ 'image', 'pdf' ], array_keys( $bundle['sourceRenditions'] ) );
		$resolved = $this->resolver->resolve( new LayersDocumentContent(
			json_encode( $bundle['snapshot'] ) ), $actor );
		$this->assertTrue( $resolved['image']->isOld() );
		$this->assertTrue( $resolved['pdf']->isOld() );

		$still = $bundle['sourceRenditions']['image'];
		// The 1x1 bitmap is never upscaled, so core serves the archived original itself at display size.
		$this->assertSame( $still['width'], $still['height'] );
		$this->assertStringContainsString( '/archive/', $still['url'] );
		$this->assertStringNotContainsString( '/thumb/', $still['url'] );
		$this->assertStringContainsString( $resolved['image']->getArchiveName(), rawurldecode( $still['url'] ) );

		$pdfRendition = $bundle['sourceRenditions']['pdf'];
		$this->assertMatchesRegularExpression( '#^https?://#', $pdfRendition['url'] );
		$this->assertStringContainsString( '/thumb/archive/', $pdfRendition['url'] );
		$this->assertStringContainsString( 'page2-', $pdfRendition['url'] );
		$this->assertStringContainsString( $resolved['pdf']->getArchiveName(), rawurldecode( $pdfRendition['url'] ) );
		// Page 2 of the pinned PDF is portrait (208x416 handler pixels); the rendition keeps its aspect.
		$this->assertLessThan( $pdfRendition['height'], $pdfRendition['width'] );

		$pageId = $page->getTitle()->getArticleID( IDBAccessObject::READ_LATEST );
		$bound = $this->reader()->readBoundSurfaces( $page->getTitle(), $revisionId, [
			'v1:' . $pageId . ':pdf', 'v1:' . $pageId . ':presentation'
		], $actor );
		$this->assertSame( $pdfRendition, $bound['v1:' . $pageId . ':pdf']['source'] );
		$this->assertArrayNotHasKey( 'source', $bound['v1:' . $pageId . ':presentation'] );
	}

	public function testHiddenVersionYieldsNoRendition(): void {
		[ $page, $revisionId, , , $actor ] = $this->pinnedToReplacedVersions();
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )
			->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => 'Rendition.png' ] )->caller( __METHOD__ )->execute();
		try {
			$this->reader()->read( $page->getTitle(), $revisionId, $actor );
			$this->fail( 'Expected unavailable bundle' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		// Only the hidden version's drawing disappears from a page view.
		$pageId = $page->getTitle()->getArticleID( IDBAccessObject::READ_LATEST );
		$bound = $this->reader()->readBoundSurfaces( $page->getTitle(), $revisionId, [
			'v1:' . $pageId . ':image', 'v1:' . $pageId . ':pdf'
		], $actor );
		$this->assertSame( [ 'v1:' . $pageId . ':pdf' ], array_keys( $bound ) );
	}

	public function testHistoryViewerReceivesTheRenditionForImageAndPdfSurfaces(): void {
		[ $page, $revisionId, , , $actor ] = $this->pinnedToReplacedVersions();
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), [ $page->getTitle()->getPrefixedDBkey() ] );
		$expected = $this->reader()->read( $page->getTitle(), $revisionId, $actor )['sourceRenditions'];
		$pageId = $page->getTitle()->getArticleID( IDBAccessObject::READ_LATEST );
		foreach ( [ 'image', 'pdf' ] as $surfaceId ) {
			$view = $pilot->prepareViewer( $page->getTitle()->getPrefixedText(), $revisionId, $surfaceId, $actor );
			$this->assertSame( [ 'owner', 'pageId', 'revisionId', 'surface', 'source' ], array_keys( $view ) );
			$this->assertSame( $pageId, $view['pageId'] );
			$this->assertSame( $expected[$surfaceId], $view['source'] );
		}
		$slide = $pilot->prepareViewer( $page->getTitle()->getPrefixedText(), $revisionId, 'presentation', $actor );
		$this->assertArrayNotHasKey( 'source', $slide );
		$this->assertSame( $pageId, $slide['pageId'] );
		// Page history links to every drawing kind the viewer can show.
		$this->assertSame( [ 'presentation', 'image', 'pdf' ], array_column(
			$pilot->getHistorySurfaces( $page->getTitle(), $revisionId, $actor ), 'id' ) );
	}
}
