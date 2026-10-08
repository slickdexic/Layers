<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePdfEditorReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\LocalRepo;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\SourceRenditions
 * @group Database
 */
class SourceRenditionsPixelGeometryTest extends RealAssetTestCase {

	public function testNativePageTwoReportsEncodedPixels(): void {
		$pdf = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:PixelGeometry-' . wfRandomString( 8 ) . '.pdf' );
		$surface = $this->makePdfSurface( 'pdf', 'ABC', $pdf->getTitle()->getPrefixedText(),
			$pdf->getTimestamp(), $pdf->getSha1(), 2 );
		$surface['canvas']['width'] = 208;
		$surface['canvas']['height'] = 416;
		$before = $surface;
		$thumb = $pdf->transform( [ 'width' => 208, 'page' => 2 ], File::RENDER_NOW );
		$this->assertFalse( $thumb->isError() );
		$reference = $thumb->getLocalCopyPath();
		$this->assertIsString( $reference );
		$pixels = getimagesize( $reference );
		$this->assertIsArray( $pixels );
		$this->assertSame( [ 208, 416 ], [ $thumb->getWidth(), $thumb->getHeight() ] );
		$this->assertSame( [ 208, 417 ], [ $pixels[0], $pixels[1] ] );
		$start = microtime( true );
		$result = ( new SourceRenditions( $this->getServiceContainer()->getUrlUtils() ) )
			->forSurface( $pdf, $surface );
		fwrite( STDERR, json_encode( [ 'nativeLogical' => [ $thumb->getWidth(), $thumb->getHeight() ],
			'encodedPixels' => [ $pixels[0], $pixels[1] ], 'reported' => $result,
			'elapsedSeconds' => microtime( true ) - $start,
			'bitmapSha256' => hash_file( 'sha256', $reference ),
			'loadedSourceSha256' => hash_file( 'sha256',
				__DIR__ . '/../../../src/Revision/SourceRenditions.php' ) ] ) . "\n" );
		$this->assertSame( $before, $surface );
		$this->assertSame( [ $pixels[0], $pixels[1] ], [ $result['width'], $result['height'] ] );
	}

	/** @dataProvider providePdfPages */
	public function testColdAndCachedNativePages( int $page, int $width, int $height ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Cold-pixels-' . wfRandomString( 8 ) . '.pdf' );
		$surface = $this->makePdfSurface( 'pdf', 'ABC', $file->getTitle()->getPrefixedText(),
			$file->getTimestamp(), $file->getSha1(), $page );
		$surface['canvas']['width'] = $width;
		$surface['canvas']['height'] = $height;
		$before = $surface;
		$renditions = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$start = microtime( true );
		$cold = $renditions->forSurface( $file, $surface );
		$coldSeconds = microtime( true ) - $start;
		$bitmap = $file->transform( [ 'width' => $width, 'page' => $page ], File::RENDER_NOW );
		$this->assertStringStartsWith( 'mwstore://', $bitmap->getStoragePath() );
		$reference = $bitmap->getLocalCopyPath();
		$this->assertIsString( $reference );
		$pixels = getimagesize( $reference );
		$this->assertIsArray( $pixels );
		$this->assertSame( [ $pixels[0], $pixels[1] ], [ $cold['width'], $cold['height'] ] );
		$beforeHash = hash_file( 'sha256', $reference );
		$start = microtime( true );
		$cached = $renditions->forSurface( $file, $surface );
		$cachedSeconds = microtime( true ) - $start;
		$this->assertSame( $cold, $cached );
		$this->assertSame( $beforeHash, hash_file( 'sha256', $reference ) );
		$this->assertSame( $before, $surface );
		fwrite( STDERR, json_encode( [ 'page' => $page, 'coldSeconds' => $coldSeconds,
			'cachedSeconds' => $cachedSeconds, 'rendition' => $cold, 'bitmapSha256' => $beforeHash,
			'localReference' => $reference, 'storageReference' => $bitmap->getStoragePath() ] ) . "\n" );
	}

	public static function providePdfPages(): array {
		return [ 'landscape' => [ 1, 416, 208 ], 'portrait' => [ 2, 208, 416 ] ];
	}

	/** @dataProvider provideDeferredModes */
	public function testConfiguredDeferredOutputIsProducedNatively( string $mode ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:Deferred-pixels-' . wfRandomString( 8 ) . '.pdf' );
		$repo = new LocalRepo( [ 'name' => 'layers-fixture', 'backend' => $this->repo->getBackend(),
			'url' => '/test-files', 'thumbScriptUrl' => $mode === 'scripted' ? '/thumb.php' : false,
			'transformVia404' => $mode === '404' ] );
		$file = $repo->newFile( $file->getTitle() );
		$surface = $this->makePdfSurface( 'pdf', 'ABC', $file->getTitle()->getPrefixedText(),
			$file->getTimestamp(), $file->getSha1(), 2 );
		$surface['canvas']['width'] = 208;
		$surface['canvas']['height'] = 416;
		$deferred = $file->transform( [ 'width' => 208, 'page' => 2 ] );
		$this->assertFalse( $deferred->isError() );
		$this->assertFalse( $deferred->getLocalCopyPath() );
		$result = ( new SourceRenditions( $this->getServiceContainer()->getUrlUtils() ) )
			->forSurface( $file, $surface );
		$bitmap = $file->transform( [ 'width' => 208, 'page' => 2 ], File::RENDER_NOW );
		$reference = $bitmap->getLocalCopyPath();
		$this->assertIsString( $reference );
		$pixels = getimagesize( $reference );
		$this->assertSame( [ $pixels[0], $pixels[1] ], [ $result['width'], $result['height'] ] );
		$this->assertStringNotContainsString( '/thumb.php', $result['url'] );
		$this->assertStringContainsString( 'page2-208px-', $result['url'] );
	}

	public static function provideDeferredModes(): array {
		return [ 'scripted' => [ 'scripted' ], '404' => [ '404' ] ];
	}

	/** @dataProvider provideFailureModes */
	public function testUnavailableNativeOutputRefusesSafely( string $mode ): void {
		$surface = [ 'kind' => 'pdf', 'canvas' => [ 'width' => 208 ], 'source' => [ 'page' => 2 ] ];
		$file = $this->createMock( File::class );
		$transform = $file->expects( $this->once() )->method( 'transform' )
			->with( [ 'width' => 208, 'page' => 2 ], File::RENDER_NOW );
		if ( $mode === 'transform-throws' ) {
			$transform->willThrowException( new \RuntimeException( '/private/backend/failure' ) );
		} elseif ( $mode === 'transform-false' ) {
			$transform->willReturn( false );
		} else {
			$thumb = $this->createMock( \MediaTransformOutput::class );
			$thumb->method( 'isError' )->willReturn( $mode === 'transform-error' );
			$thumb->method( 'getUrl' )->willReturn( 'https://example.invalid/exact-version-page.jpg' );
			$reference = false;
			if ( $mode === 'missing' ) {
				$reference = $this->getNewTempDirectory() . '/missing-bitmap.jpg';
			} elseif ( $mode === 'non-image' || $mode === 'unreadable' ) {
				$reference = $this->getNewTempFile();
				file_put_contents( $reference, 'Not an image' );
				if ( $mode === 'unreadable' ) {
					chmod( $reference, 0000 );
					clearstatcache( true, $reference );
					$this->assertFalse( is_readable( $reference ), 'Run the native group as an unprivileged user' );
				}
			}
			if ( $mode === 'reference-throws' ) {
				$thumb->method( 'getLocalCopyPath' )
					->willThrowException( new \RuntimeException( '/private/reference/failure' ) );
			} else {
				$thumb->method( 'getLocalCopyPath' )->willReturn( $reference );
			}
			$transform->willReturn( $thumb );
		}
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-source-unavailable' );
		( new SourceRenditions( $this->getServiceContainer()->getUrlUtils() ) )->forSurface( $file, $surface );
	}

	public static function provideFailureModes(): array {
		return array_map( static fn ( $mode ): array => [ $mode ], [ 'transform-throws', 'transform-false',
			'transform-error', 'reference-throws', 'reference-false', 'missing', 'non-image', 'unreadable' ] );
	}

	/** @dataProvider provideBitmapModes */
	public function testBitmapAndFullSizeKeepNativeBehavior( bool $fullSize ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Bitmap-pixels-' . wfRandomString( 8 ) . '.png' );
		$surface = $this->makeImageSurface( 'image', 'ABC', $file->getTitle()->getPrefixedText(),
			$file->getTimestamp(), $file->getSha1() );
		$before = $surface;
		$native = $file->transform( [ 'width' => $fullSize ? $file->getWidth( 1 ) : 800 ] );
		$expected = [ 'url' => $this->getServiceContainer()->getUrlUtils()->expand( $native->getUrl(),
			PROTO_CURRENT ), 'width' => $native->getWidth(), 'height' => $native->getHeight() ];
		$this->assertSame( $expected, ( new SourceRenditions( $this->getServiceContainer()->getUrlUtils() ) )
			->forSurface( $file, $surface, $fullSize ) );
		$this->assertSame( $before, $surface );
	}

	public static function provideBitmapModes(): array {
		return [ 'canvas' => [ false ], 'full-size' => [ true ] ];
	}

	public function testArchivedPagesKeepCompleteStoredGeometryAndPins(): void {
		$name = 'File:Archived-pixels-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $name );
		$surfaces = [];
		foreach ( self::providePdfPages() as [ $page, $width, $height ] ) {
			$surface = $this->makePdfSurface( 'member-' . $page, 'ABC', $name,
				$file->getTimestamp(), $file->getSha1(), $page );
			$surface['canvas']['width'] = $width;
			$surface['canvas']['height'] = $height;
			$surface['layers'] = [ [ 'id' => 'rectangle-' . $page, 'type' => 'rectangle',
				'x' => 12, 'y' => 14, 'width' => 32, 'height' => 28, 'fill' => '#ff0000' ] ];
			$surface['readingOrder'] = [ 'rectangle-' . $page ];
			$surfaces[] = $surface;
		}
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$revisionId = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( $surfaces ), 'Pinned pixel fixture' );
		$before = $lookup->getRevisionById( $revisionId );
		$main = $before->getContent( 'main', RevisionRecord::RAW )->serialize();
		$layers = $before->getContent( 'layers', RevisionRecord::RAW )->serialize();
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf', $name,
			'20260907120000' );
		$resolved = $this->resolver->resolve( new LayersDocumentContent( $layers ), $actor );
		$renditions = new SourceRenditions( $this->getServiceContainer()->getUrlUtils() );
		$reader = new PagePdfEditorReadService( new PageHistoryAccess( $lookup ), $this->resolver, $renditions,
			new NewPageDrawing( $this->resolver, $renditions, $this->repo,
				$this->getServiceContainer()->getTitleFactory(), [] ), $lookup );
		$binding = 'v1:' . $owner->getArticleID() . ':member-2';
		foreach ( $surfaces as $surface ) {
			$page = $surface['source']['page'];
			$context = $reader->read( $owner, $revisionId, $binding, $page, $actor );
			$this->assertEquals( $surface, $context['surface'] );
			$this->assertSame( [ [ 'page' => 1, 'surfaceId' => 'member-1' ],
				[ 'page' => 2, 'surfaceId' => 'member-2' ] ], $context['members'] );
			$this->assertSame( 2, $context['pageCount'] );
			$this->assertSame( $revisionId, $context['revisionId'] );
			$this->assertSame( $binding, $context['binding'] );
			$this->assertSame( [ 'page' => $page, 'width' => $file->getWidth( $page ),
				'height' => $file->getHeight( $page ), 'units' => 'file-handler-pixels' ], $context['sourceGeometry'] );
			$archived = $resolved[$surface['id']];
			$this->assertTrue( $archived->isOld() );
			$bitmap = $archived->transform( [ 'width' => $surface['canvas']['width'], 'page' => $page ],
				File::RENDER_NOW );
			$reference = $bitmap->getLocalCopyPath();
			$this->assertIsString( $reference );
			$pixels = getimagesize( $reference );
			$this->assertSame( [ $pixels[0], $pixels[1] ],
				[ $context['rendition']['width'], $context['rendition']['height'] ] );
			$this->assertStringContainsString( '/thumb/archive/', $context['rendition']['url'] );
			$this->assertStringContainsString( $archived->getArchiveName(),
				rawurldecode( $context['rendition']['url'] ) );
			$this->assertStringContainsString( 'page' . $page . '-', $context['rendition']['url'] );
		}
		$after = $lookup->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		$this->assertSame( $revisionId, $after->getId() );
		$this->assertSame( $main, $after->getContent( 'main', RevisionRecord::RAW )->serialize() );
		$this->assertSame( $layers, $after->getContent( 'layers', RevisionRecord::RAW )->serialize() );
	}
}
