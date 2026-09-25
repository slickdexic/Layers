<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaHandler;
use MediaTransformOutput;
use MediaWiki\Extension\Layers\Revision\PrivateRasterRenderer;
use MediaWiki\Extension\Layers\Revision\PrivateStagingDirectory;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Shell\Shell;
use Wikimedia\FileBackend\FSFile\TempFSFileFactory;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Acceptance and fault-injection tests for PrivateRasterRenderer.
 *
 * Verifies private raster generation with real core handlers, native copy,
 * SVG rasterization, multi-page PDF rendering, backend storage isolation,
 * and comprehensive fault boundaries.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PrivateRasterRenderer
 * @group Database
 */
class PrivateRasterRendererTest extends RealAssetTestCase {

	/**
	 * Snapshot files across the isolated fixture backend's public and thumb zones.
	 *
	 * @return array<string, array{size: int, sha1: string}>
	 */
	private function snapshotBackendStorageInventory(): array {
		$inventory = [];
		foreach ( [ 'public', 'thumb' ] as $zone ) {
			$dir = $this->backendPaths['layers-fixture-' . $zone] ?? null;
			if ( $dir && is_dir( $dir ) ) {
				$iterator = new \RecursiveIteratorIterator(
					new \RecursiveDirectoryIterator( $dir, \FilesystemIterator::SKIP_DOTS )
				);
				foreach ( $iterator as $item ) {
					if ( $item->isFile() ) {
						$inventory[$zone . '/' . $iterator->getSubPathname()] = [
							'size' => $item->getSize(),
							'sha1' => sha1_file( $item->getPathname() )
						];
					}
				}
			}
		}
		ksort( $inventory );
		return $inventory;
	}

	/**
	 * Helper to create a mock File and MediaHandler configured with default valid parameters.
	 *
	 * @param string $mime
	 * @param string $extension
	 * @param int $width
	 * @param int $height
	 * @param int $size
	 * @return array{0: File, 1: MediaHandler}
	 */
	private function createMockFileAndHandler(
		string $mime = 'image/png',
		string $extension = 'png',
		int $width = 80,
		int $height = 40,
		int $size = 1024
	): array {
		$file = $this->createMock( File::class );
		$handler = $this->createMock( MediaHandler::class );
		$file->method( 'getHandler' )->willReturn( $handler );
		$file->method( 'getMimeType' )->willReturn( $mime );
		$file->method( 'getExtension' )->willReturn( $extension );
		$file->method( 'getWidth' )->willReturn( $width );
		$file->method( 'getHeight' )->willReturn( $height );
		$file->method( 'getSize' )->willReturn( $size );
		return [ $file, $handler ];
	}

	/** Private rendering uses core handlers without returning public URLs or leaving artifacts. */
	public function testPrivateRasterRendererWithRealCoreHandlers(): void {
		$directory = $this->getNewTempDirectory();
		file_put_contents( $directory . '/unrelated.txt', 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer(
			PrivateStagingDirectory::createFactory( $directory, [
				$this->backendPaths['layers-fixture-public'], $this->backendPaths['layers-fixture-thumb']
			] ), $decoder );
		$png = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', 'File:L02_Private.png' );
		$pdf = $this->uploadFixtureFile(
			__DIR__ . '/../../fixtures/assets/test-multipage.pdf', 'File:L02_Private.pdf' );
		$svgPath = $this->getNewTempFile();
		file_put_contents( $svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40">' .
			'<rect width="80" height="40" fill="blue"/></svg>' );
		$svg = $this->uploadFixtureFile( $svgPath, 'File:L02_Private.svg' );
		$jpegPath = $this->getNewTempFile();
		$converted = Shell::command( [ $decoder,
			__DIR__ . '/../../fixtures/assets/test-image.png', 'jpg:' . $jpegPath ] )->execute();
		$this->assertSame( 0, $converted->getExitCode() );
		$jpeg = $this->uploadFixtureFile( $jpegPath, 'File:L02_Private.jpg' );

		// Generate multi-pixel PNG and JPEG source fixtures (80x40) to test real resampling/downsampling
		$multiPngPath = $this->getNewTempFile();
		$convertedPng = Shell::command( [ $decoder,
			'-size', '80x40', 'xc:blue', 'png:' . $multiPngPath ] )->execute();
		$this->assertSame( 0, $convertedPng->getExitCode() );
		$multiPng = $this->uploadFixtureFile( $multiPngPath, 'File:L02_Private_Multi.png' );
		$this->assertSame( 80, $multiPng->getWidth() );
		$this->assertSame( 40, $multiPng->getHeight() );

		$multiJpegPath = $this->getNewTempFile();
		$convertedJpeg = Shell::command( [ $decoder,
			'-size', '80x40', 'xc:blue', 'jpg:' . $multiJpegPath ] )->execute();
		$this->assertSame( 0, $convertedJpeg->getExitCode() );
		$multiJpeg = $this->uploadFixtureFile( $multiJpegPath, 'File:L02_Private_Multi.jpg' );
		$this->assertSame( 80, $multiJpeg->getWidth() );
		$this->assertSame( 40, $multiJpeg->getHeight() );

		// Snapshot backend inventory before rendering: assert public files exist and thumb zone is empty
		$backendInventoryBefore = $this->snapshotBackendStorageInventory();
		$this->assertNotEmpty( $backendInventoryBefore );
		$this->assertSame(
			[],
			glob( $this->backendPaths['layers-fixture-thumb'] . '/*' ),
			'Thumb zone must be empty before rendering'
		);

		$dimensionLog = [];
		$renderCases = [
			'native-png' => [ $png, 1, 1, 1 ],
			'downsampled-png' => [ $multiPng, 1, 40, 20 ],
			'native-jpeg' => [ $jpeg, 1, 1, 1 ],
			'downsampled-jpeg' => [ $multiJpeg, 1, 40, 20 ],
			'svg' => [ $svg, 1, 40, 20 ],
			'pdf-page1' => [ $pdf, 1, 40, 20 ],
			'pdf-page2' => [ $pdf, 2, 40, 80 ],
		];

		foreach ( $renderCases as $caseKey => [ $file, $page, $width, $height ] ) {
			$output = $renderer->render( $file, $page, $width );
			$dimensionLog[$caseKey] = [
				'requested_width' => $width,
				'actual_width' => $output['width'],
				'actual_height' => $output['height'],
			];
			$this->assertSame( [ 'mime', 'width', 'height', 'bytes' ], array_keys( $output ) );
			$this->assertContains( $output['mime'], [ 'image/png', 'image/jpeg' ] );
			$decoded = getimagesizefromstring( $output['bytes'] );
			$this->assertSame( $output['mime'], $decoded['mime'] );
			$this->assertSame( $output['width'], $decoded[0] );
			$this->assertSame( $output['height'], $decoded[1] );
			$this->assertSame( $width, $output['width'] );
			$this->assertSame( $height, $output['height'] );
			$this->assertSame( [ $directory . '/unrelated.txt' ], glob( $directory . '/*' ) );
		}

		// Snapshot backend inventory after rendering: verify zero derivative files and intact sources
		$backendInventoryAfter = $this->snapshotBackendStorageInventory();
		$this->assertSame(
			$backendInventoryBefore,
			$backendInventoryAfter,
			'Private rendering must not add derivative files to public/thumb zones or modify sources'
		);
		$this->assertSame(
			[],
			glob( $this->backendPaths['layers-fixture-thumb'] . '/*' ),
			'Thumb repository zone must remain completely empty after rendering'
		);

		// Record and verify requested versus actual dimensions across native copy, downsampling, and PDF
		$this->assertSame( [
			'native-png' => [ 'requested_width' => 1, 'actual_width' => 1, 'actual_height' => 1 ],
			'downsampled-png' => [ 'requested_width' => 40, 'actual_width' => 40, 'actual_height' => 20 ],
			'native-jpeg' => [ 'requested_width' => 1, 'actual_width' => 1, 'actual_height' => 1 ],
			'downsampled-jpeg' => [ 'requested_width' => 40, 'actual_width' => 40, 'actual_height' => 20 ],
			'svg' => [ 'requested_width' => 40, 'actual_width' => 40, 'actual_height' => 20 ],
			'pdf-page1' => [ 'requested_width' => 40, 'actual_width' => 40, 'actual_height' => 20 ],
			'pdf-page2' => [ 'requested_width' => 40, 'actual_width' => 40, 'actual_height' => 80 ],
		], $dimensionLog );

		$this->assertSame( 'Keep this file', file_get_contents( $directory . '/unrelated.txt' ) );
	}

	/** Decoder failure cannot leave its private output behind or return a partial result. */
	public function testPrivateRasterDecoderFailureCleansArtifact(): void {
		$directory = $this->getNewTempDirectory();
		$renderer = new PrivateRasterRenderer(
			new TempFSFileFactory( $directory ), '/bin/false' );
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png', 'File:L02_Fail.png' );
		try {
			$renderer->render( $file, 1, 1 );
			$this->fail( 'Decoder failure must reject the raster' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertSame( [], glob( $directory . '/*' ) );
	}

	/**
	 * J29a: Fault injection — Renderer rejects non-positive or excessive requested/normalized dimensions.
	 * Covers page < 1, width outside 1..4096, empty decoder, normaliseParams returning false,
	 * and handler normalising dimensions to non-positive or > 4096 (width, height, physicalWidth, physicalHeight).
	 * Asserts each failure throws DomainException('layers-render-unavailable') without partial output,
	 * and preserves unrelated staging files.
	 */
	public function testPrivateRasterRendererRejectsInvalidWidthOrPageAndExcessiveDimensions(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$factory = new TempFSFileFactory( $directory );
		$renderer = new PrivateRasterRenderer( $factory, $decoder );

		[ $file, $handler ] = $this->createMockFileAndHandler();
		$file->expects( $this->never() )->method( 'getHandler' );

		// 1a. Invalid requested width and page parameters (validated before handler invocation)
		$invalidParamCases = [
			'page-zero' => [ 0, 100 ],
			'page-negative' => [ -1, 100 ],
			'width-zero' => [ 1, 0 ],
			'width-negative' => [ 1, -1 ],
			'width-excessive-4097' => [ 1, 4097 ],
		];

		foreach ( $invalidParamCases as $label => [ $page, $width ] ) {
			$result = null;
			try {
				$result = $renderer->render( $file, $page, $width );
				$this->fail( "Case {$label} must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
			$this->assertNull( $result, "Case {$label} must return no result" );
			$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		}

		// 1b. Empty decoder executable string rejected before handler invocation
		$emptyDecoderRenderer = new PrivateRasterRenderer( $factory, '' );
		$result = null;
		try {
			$result = $emptyDecoderRenderer->render( $file, 1, 100 );
			$this->fail( 'Empty decoder must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 1c. normaliseParams returning false
		$failingHandlerFile = $this->createMock( File::class );
		$failingHandler = $this->createMock( MediaHandler::class );
		$failingHandlerFile->method( 'getHandler' )->willReturn( $failingHandler );
		$failingHandlerFile->method( 'getMimeType' )->willReturn( 'image/png' );
		$failingHandler->expects( $this->never() )->method( 'getThumbType' );
		$failingHandler->expects( $this->once() )
			->method( 'normaliseParams' )
			->willReturn( false );

		$result = null;
		try {
			$result = $renderer->render( $failingHandlerFile, 1, 100 );
			$this->fail( 'Failed normaliseParams must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 1d. Handler normalises dimensions to non-positive or excessive (> 4096)
		$invalidNormalizedDimensions = [
			'zero-normalized-width' => [ 'width' => 0 ],
			'negative-normalized-width' => [ 'width' => -10 ],
			'excessive-normalized-width' => [ 'width' => 4097 ],
			'zero-normalized-height' => [ 'height' => 0 ],
			'negative-normalized-height' => [ 'height' => -5 ],
			'excessive-normalized-height' => [ 'height' => 5000 ],
			'zero-physical-width' => [ 'physicalWidth' => 0 ],
			'excessive-physical-width' => [ 'physicalWidth' => 4097 ],
			'zero-physical-height' => [ 'physicalHeight' => 0 ],
			'excessive-physical-height' => [ 'physicalHeight' => 8192 ],
		];

		foreach ( $invalidNormalizedDimensions as $dimLabel => $overrideParams ) {
			$mockFile = $this->createMock( File::class );
			$mockHandler = $this->createMock( MediaHandler::class );
			$mockFile->method( 'getHandler' )->willReturn( $mockHandler );
			$mockFile->method( 'getMimeType' )->willReturn( 'image/png' );
			$mockHandler->expects( $this->never() )->method( 'getThumbType' );
			$mockHandler->expects( $this->once() )
				->method( 'normaliseParams' )
				->willReturnCallback( static function ( $f, &$params ) use ( $overrideParams ) {
					$params = array_merge( [ 'width' => 100, 'height' => 50 ], $overrideParams );
					return true;
				} );

			$result = null;
			try {
				$result = $renderer->render( $mockFile, 1, 100 );
				$this->fail( "Case {$dimLabel} must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
			$this->assertNull( $result, "Case {$dimLabel} must return no result" );
			$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		}

		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}

	/**
	 * J29a: Fault injection — Renderer rejects unsupported input and output MIME types and extensions.
	 * Covers missing handler, unsupported source MIME (image/webp, image/gif, text/plain),
	 * and unsupported thumb output type from getThumbType (webp, svg, gif, x-png, invalid extension).
	 * Asserts DomainException('layers-render-unavailable'), no partial output, and staging preserved.
	 */
	public function testPrivateRasterRendererRejectsUnsupportedInputAndOutputTypes(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		// 2a. Missing handler (getHandler() === null)
		$noHandlerFile = $this->createMock( File::class );
		$noHandlerFile->method( 'getHandler' )->willReturn( null );
		$noHandlerFile->method( 'getMimeType' )->willReturn( 'image/png' );
		$result = null;
		try {
			$result = $renderer->render( $noHandlerFile, 1, 100 );
			$this->fail( 'Missing handler must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 2b. Unsupported input MIME types
		$unsupportedInputMimes = [
			'webp' => 'image/webp',
			'gif' => 'image/gif',
			'text' => 'text/plain',
			'octet-stream' => 'application/octet-stream',
			'tiff' => 'image/tiff',
		];
		foreach ( $unsupportedInputMimes as $label => $mime ) {
			$unsupportedFile = $this->createMock( File::class );
			$unsupportedHandler = $this->createMock( MediaHandler::class );
			$unsupportedFile->method( 'getHandler' )->willReturn( $unsupportedHandler );
			$unsupportedFile->method( 'getMimeType' )->willReturn( $mime );
			$unsupportedHandler->expects( $this->never() )->method( 'normaliseParams' );

			$result = null;
			try {
				$result = $renderer->render( $unsupportedFile, 1, 100 );
				$this->fail( "Unsupported input MIME {$label} must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
			$this->assertNull( $result, "Case {$label} must return no result" );
			$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		}

		// 2c. Unsupported thumb output MIME/extension returned by getThumbType
		$unsupportedOutputTypes = [
			'webp-output' => [ 'webp', 'image/webp' ],
			'svg-output' => [ 'svg', 'image/svg+xml' ],
			'gif-output' => [ 'gif', 'image/gif' ],
			'invalid-mime' => [ 'png', 'image/x-png' ],
			'invalid-ext' => [ 'exe', 'image/png' ],
			'pdf-output' => [ 'pdf', 'application/pdf' ],
		];
		foreach ( $unsupportedOutputTypes as $label => [ $thumbExt, $thumbMime ] ) {
			[ $file, $handler ] = $this->createMockFileAndHandler();
			$handler->method( 'normaliseParams' )->willReturnCallback(
				static function ( $f, &$params ) {
					$params['width'] = 100;
					$params['height'] = 50;
					return true;
				} );
			$handler->method( 'getThumbType' )->willReturn( [ $thumbExt, $thumbMime ] );
			$handler->expects( $this->never() )->method( 'doTransform' );

			$result = null;
			try {
				$result = $renderer->render( $file, 1, 100 );
				$this->fail( "Unsupported output type {$label} must throw DomainException" );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
			$this->assertNull( $result, "Case {$label} must return no result" );
			$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		}

		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}

	/**
	 * J29a: Fault injection — Handler errors, null output, and transform exceptions fail cleanly.
	 * Covers doTransform returning null, a mocked error output (isError() === true),
	 * and throwing an exception. Asserts staging artifact is purged in finally,
	 * unrelated staging files are preserved, and exceptions propagate as expected.
	 */
	public function testPrivateRasterRendererRejectsHandlerErrorsAndExceptions(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		// 3a. doTransform returning null
		[ $fileNull, $handlerNull ] = $this->createMockFileAndHandler();
		$handlerNull->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerNull->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$handlerNull->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( null );

		$result = null;
		try {
			$result = $renderer->render( $fileNull, 1, 100 );
			$this->fail( 'doTransform returning null must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 3b. doTransform returning MediaTransformError (isError() === true)
		[ $fileErr, $handlerErr ] = $this->createMockFileAndHandler();
		$handlerErr->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerErr->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$errorOutput = $this->createMock( MediaTransformOutput::class );
		$errorOutput->method( 'isError' )->willReturn( true );
		$handlerErr->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $errorOutput );

		$result = null;
		try {
			$result = $renderer->render( $fileErr, 1, 100 );
			$this->fail( 'MediaTransformError must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 3c. doTransform throwing an unexpected exception
		[ $fileEx, $handlerEx ] = $this->createMockFileAndHandler();
		$handlerEx->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerEx->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$handlerEx->expects( $this->once() )
			->method( 'doTransform' )
			->willReturnCallback( static function ( $f, $dstPath ) {
				file_put_contents( $dstPath, 'Partial private raster bytes' );
				throw new \RuntimeException( 'Unexpected transform crash' );
			} );

		$result = null;
		try {
			$result = $renderer->render( $fileEx, 1, 100 );
			$this->fail( 'Transform exception must propagate' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'Unexpected transform crash', $e->getMessage() );
		}
		$this->assertNull( $result );
		// finally block must have purged the temporary artifact
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}

	/**
	 * J29a: Fault injection — Renderer rejects deferred/client output and mismatched local copy paths.
	 * Covers doTransform output with hasFile() === false and getLocalCopyPath() !== $path.
	 * Asserts DomainException('layers-render-unavailable'), no partial output, and staging purged.
	 */
	public function testPrivateRasterRendererRejectsDeferredOutputOrMismatchedLocalCopyPath(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		// 4a. Deferred / client-side output without a local file (hasFile() === false)
		[ $fileDeferred, $handlerDeferred ] = $this->createMockFileAndHandler();
		$handlerDeferred->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerDeferred->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$deferredOutput = $this->createMock( MediaTransformOutput::class );
		$deferredOutput->method( 'isError' )->willReturn( false );
		$deferredOutput->method( 'hasFile' )->willReturn( false );
		$handlerDeferred->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $deferredOutput );

		$result = null;
		try {
			$result = $renderer->render( $fileDeferred, 1, 100 );
			$this->fail( 'Deferred output (hasFile === false) must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 4b. Differing returned local copy path (getLocalCopyPath() !== $path)
		[ $filePathMismatch, $handlerPathMismatch ] = $this->createMockFileAndHandler();
		$handlerPathMismatch->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerPathMismatch->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$mismatchedOutput = $this->createMock( MediaTransformOutput::class );
		$mismatchedOutput->method( 'isError' )->willReturn( false );
		$mismatchedOutput->method( 'hasFile' )->willReturn( true );
		$mismatchedOutput->method( 'fileIsSource' )->willReturn( false );
		$mismatchedOutput->method( 'getLocalCopyPath' )
			->willReturn( $unrelatedFile );
		$handlerPathMismatch->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $mismatchedOutput );

		$result = null;
		try {
			$result = $renderer->render( $filePathMismatch, 1, 100 );
			$this->fail( 'Mismatched local copy path must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}

	/**
	 * J29a: Fault injection — Renderer rejects corrupted, truncated, zero-byte, or oversized output.
	 * Covers invalid image bytes (failing getimagesizefromstring), corrupted stream failing full
	 * ImageMagick decode (-regard-warnings), empty file (0 bytes), and output exceeding 8 MB (8,388,608 bytes).
	 * Asserts DomainException('layers-render-unavailable'), no partial output, and staging artifact purged.
	 */
	public function testPrivateRasterRendererRejectsCorruptedOrOversizedOutput(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		// 5a. Corrupted / truncated image bytes failing getimagesizefromstring
		[ $fileCorrupt, $handlerCorrupt ] = $this->createMockFileAndHandler();
		$handlerCorrupt->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerCorrupt->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputCorrupt = $this->createMock( MediaTransformOutput::class );
		$outputCorrupt->method( 'isError' )->willReturn( false );
		$outputCorrupt->method( 'hasFile' )->willReturn( true );
		$outputCorrupt->method( 'fileIsSource' )->willReturn( false );
		$handlerCorrupt->expects( $this->once() )
			->method( 'doTransform' )
			->willReturnCallback( function ( $f, $dstPath ) use ( $outputCorrupt ) {
				$bytes = 'This is not an image';
				// phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Prove the header failure boundary.
				$this->assertFalse( @getimagesizefromstring( $bytes ) );
				file_put_contents( $dstPath, $bytes );
				$outputCorrupt->method( 'getLocalCopyPath' )->willReturn( $dstPath );
				return $outputCorrupt;
			} );

		$result = null;
		try {
			$result = $renderer->render( $fileCorrupt, 1, 100 );
			$this->fail( 'Corrupt bytes must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 5b. Valid header but truncated stream failing full ImageMagick decode (-regard-warnings)
		[ $fileDecodeFail, $handlerDecodeFail ] = $this->createMockFileAndHandler();
		$handlerDecodeFail->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 1;
				$params['height'] = 1;
				return true;
			} );
		$handlerDecodeFail->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputDecodeFail = $this->createMock( MediaTransformOutput::class );
		$outputDecodeFail->method( 'isError' )->willReturn( false );
		$outputDecodeFail->method( 'hasFile' )->willReturn( true );
		$outputDecodeFail->method( 'fileIsSource' )->willReturn( false );
		$handlerDecodeFail->expects( $this->once() )
			->method( 'doTransform' )
			->willReturnCallback( function ( $f, $dstPath ) use ( $outputDecodeFail ) {
				// Valid PNG header and IHDR chunk so getimagesizefromstring returns 1x1 image/png,
				// followed by corrupted IDAT data so ImageMagick fails with nonzero exit code.
				$chunk = static function ( string $type, string $data ): string {
					return pack( 'N', strlen( $data ) ) . $type . $data . pack( 'N', crc32( $type . $data ) );
				};
				$corruptPng = "\x89PNG\r\n\x1a\n" .
					$chunk( 'IHDR', pack( 'NNCCCCC', 1, 1, 8, 2, 0, 0, 0 ) ) .
					$chunk( 'IDAT', 'corrupted_stream_data_that_fails_deflate' ) .
					$chunk( 'IEND', '' );
				$header = getimagesizefromstring( $corruptPng );
				$this->assertSame( 'image/png', $header['mime'] );
				$this->assertSame( [ 1, 1 ], [ $header[0], $header[1] ] );
				file_put_contents( $dstPath, $corruptPng );
				$outputDecodeFail->method( 'getLocalCopyPath' )->willReturn( $dstPath );
				return $outputDecodeFail;
			} );

		$result = null;
		try {
			$result = $renderer->render( $fileDecodeFail, 1, 1 );
			$this->fail( 'Corrupted IDAT stream failing ImageMagick decode must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 5c. Zero-byte output
		[ $fileEmpty, $handlerEmpty ] = $this->createMockFileAndHandler();
		$handlerEmpty->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerEmpty->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputEmpty = $this->createMock( MediaTransformOutput::class );
		$outputEmpty->method( 'isError' )->willReturn( false );
		$outputEmpty->method( 'hasFile' )->willReturn( true );
		$outputEmpty->method( 'fileIsSource' )->willReturn( false );
		$handlerEmpty->expects( $this->once() )
			->method( 'doTransform' )
			->willReturnCallback( static function ( $f, $dstPath ) use ( $outputEmpty ) {
				file_put_contents( $dstPath, '' );
				$outputEmpty->method( 'getLocalCopyPath' )->willReturn( $dstPath );
				return $outputEmpty;
			} );

		$result = null;
		try {
			$result = $renderer->render( $fileEmpty, 1, 100 );
			$this->fail( 'Empty output file must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 5d. Oversized encoded output exceeding MAX_BYTES (8,388,608 bytes)
		[ $fileOversized, $handlerOversized ] = $this->createMockFileAndHandler();
		$handlerOversized->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 100;
				$params['height'] = 50;
				return true;
			} );
		$handlerOversized->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputOversized = $this->createMock( MediaTransformOutput::class );
		$outputOversized->method( 'isError' )->willReturn( false );
		$outputOversized->method( 'hasFile' )->willReturn( true );
		$outputOversized->method( 'fileIsSource' )->willReturn( false );
		$handlerOversized->expects( $this->once() )
			->method( 'doTransform' )
			->willReturnCallback( static function ( $f, $dstPath ) use ( $outputOversized ) {
				// 8,388,609 bytes exceeds MAX_BYTES (8,388,608)
				$fh = fopen( $dstPath, 'wb' );
				$chunkData = str_repeat( 'A', 65536 );
				for ( $i = 0; $i < 128; $i++ ) {
					fwrite( $fh, $chunkData );
				}
				fwrite( $fh, str_repeat( 'B', 8388609 - ( 128 * 65536 ) ) );
				fclose( $fh );
				$outputOversized->method( 'getLocalCopyPath' )->willReturn( $dstPath );
				return $outputOversized;
			} );

		$result = null;
		try {
			$result = $renderer->render( $fileOversized, 1, 100 );
			$this->fail( 'Oversized output must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}

	/**
	 * J29a: Fault injection — Renderer rejects invalid native source copy attempts when fileIsSource is claimed.
	 * Covers non-PNG/JPEG source claiming fileIsSource, width mismatch, height mismatch,
	 * source size exceeding MAX_BYTES, and missing local source reference path.
	 * Asserts DomainException('layers-render-unavailable'), no partial output, and staging purged.
	 */
	public function testPrivateRasterRendererRejectsMismatchedNativeSourceDimensions(): void {
		$directory = $this->getNewTempDirectory();
		$unrelatedFile = $directory . '/unrelated.txt';
		file_put_contents( $unrelatedFile, 'Keep this file' );
		$decoder = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		$renderer = new PrivateRasterRenderer( new TempFSFileFactory( $directory ), $decoder );

		// 6a. Non-PNG/JPEG (e.g. SVG) attempting fileIsSource() copy
		$svgFile = $this->createMock( File::class );
		$svgHandler = $this->createMock( MediaHandler::class );
		$svgFile->method( 'getHandler' )->willReturn( $svgHandler );
		$svgFile->method( 'getMimeType' )->willReturn( 'image/svg+xml' );
		$svgFile->method( 'getExtension' )->willReturn( 'svg' );
		$svgFile->method( 'getWidth' )->willReturn( 80 );
		$svgFile->method( 'getHeight' )->willReturn( 40 );
		$svgHandler->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 80;
				$params['height'] = 40;
				return true;
			} );
		$svgHandler->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$svgOutput = $this->createMock( MediaTransformOutput::class );
		$svgOutput->method( 'isError' )->willReturn( false );
		$svgOutput->method( 'hasFile' )->willReturn( true );
		$svgOutput->method( 'fileIsSource' )->willReturn( true );
		$svgHandler->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $svgOutput );

		$result = null;
		try {
			$result = $renderer->render( $svgFile, 1, 80 );
			$this->fail( 'SVG claiming fileIsSource must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 6b. Native bitmap width mismatch ($file->getWidth() !== $params['width'])
		[ $fileWidthMismatch, $handlerWidthMismatch ] = $this->createMockFileAndHandler(
			'image/png', 'png', 100, 40 );
		$handlerWidthMismatch->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 80;
				$params['height'] = 40;
				return true;
			} );
		$handlerWidthMismatch->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputWidthMismatch = $this->createMock( MediaTransformOutput::class );
		$outputWidthMismatch->method( 'isError' )->willReturn( false );
		$outputWidthMismatch->method( 'hasFile' )->willReturn( true );
		$outputWidthMismatch->method( 'fileIsSource' )->willReturn( true );
		$handlerWidthMismatch->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $outputWidthMismatch );

		$result = null;
		try {
			$result = $renderer->render( $fileWidthMismatch, 1, 80 );
			$this->fail( 'Width mismatch with fileIsSource must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 6c. Native bitmap height mismatch ($file->getHeight() !== $params['height'])
		[ $fileHeightMismatch, $handlerHeightMismatch ] = $this->createMockFileAndHandler(
			'image/png', 'png', 80, 60 );
		$handlerHeightMismatch->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 80;
				$params['height'] = 40;
				return true;
			} );
		$handlerHeightMismatch->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputHeightMismatch = $this->createMock( MediaTransformOutput::class );
		$outputHeightMismatch->method( 'isError' )->willReturn( false );
		$outputHeightMismatch->method( 'hasFile' )->willReturn( true );
		$outputHeightMismatch->method( 'fileIsSource' )->willReturn( true );
		$handlerHeightMismatch->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $outputHeightMismatch );

		$result = null;
		try {
			$result = $renderer->render( $fileHeightMismatch, 1, 80 );
			$this->fail( 'Height mismatch with fileIsSource must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 6d. Native bitmap source size exceeding MAX_BYTES (8,388,608 bytes)
		[ $fileSizeExceeded, $handlerSizeExceeded ] = $this->createMockFileAndHandler(
			'image/png', 'png', 80, 40, 8388609 );
		$handlerSizeExceeded->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 80;
				$params['height'] = 40;
				return true;
			} );
		$handlerSizeExceeded->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputSizeExceeded = $this->createMock( MediaTransformOutput::class );
		$outputSizeExceeded->method( 'isError' )->willReturn( false );
		$outputSizeExceeded->method( 'hasFile' )->willReturn( true );
		$outputSizeExceeded->method( 'fileIsSource' )->willReturn( true );
		$handlerSizeExceeded->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $outputSizeExceeded );

		$result = null;
		try {
			$result = $renderer->render( $fileSizeExceeded, 1, 80 );
			$this->fail( 'Source size exceeding MAX_BYTES must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );

		// 6e. Missing local source reference path (getLocalRefPath() returns false)
		[ $fileNoSourceRef, $handlerNoSourceRef ] = $this->createMockFileAndHandler(
			'image/png', 'png', 80, 40 );
		$fileNoSourceRef->method( 'getLocalRefPath' )->willReturn( false );
		$handlerNoSourceRef->method( 'normaliseParams' )->willReturnCallback(
			static function ( $f, &$params ) {
				$params['width'] = 80;
				$params['height'] = 40;
				return true;
			} );
		$handlerNoSourceRef->method( 'getThumbType' )->willReturn( [ 'png', 'image/png' ] );
		$outputNoSourceRef = $this->createMock( MediaTransformOutput::class );
		$outputNoSourceRef->method( 'isError' )->willReturn( false );
		$outputNoSourceRef->method( 'hasFile' )->willReturn( true );
		$outputNoSourceRef->method( 'fileIsSource' )->willReturn( true );
		$handlerNoSourceRef->expects( $this->once() )
			->method( 'doTransform' )
			->willReturn( $outputNoSourceRef );

		$result = null;
		try {
			$result = $renderer->render( $fileNoSourceRef, 1, 80 );
			$this->fail( 'Missing local source ref must throw DomainException' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
		$this->assertNull( $result );
		$this->assertSame( [ $unrelatedFile ], glob( $directory . '/*' ) );
		$this->assertSame( 'Keep this file', file_get_contents( $unrelatedFile ) );
	}
}
