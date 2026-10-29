<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Shell\Shell;
use Psr\Log\NullLogger;

/**
 * @covers \MediaWiki\Extension\Layers\ThumbnailRenderer
 * @group Database
 */
class ThumbnailRendererRotationTest extends \MediaWikiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();
		if ( !is_executable( '/usr/bin/convert' ) || !is_executable( '/usr/bin/identify' ) ) {
			$this->markTestSkipped( 'ImageMagick is not installed' );
		}
	}

	/** @dataProvider provideRotationCases */
	public function testRotatedLayerPixels( string $type, int $angle, float $scaleX, float $scaleY,
		int $x = 40
	): void {
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$sample = "$dir/sample.png";
		$output = "$dir/output.png";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '240x180', 'xc:white', 'PNG24:' . $base )
			->execute()->getExitCode() );
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '80x20', 'xc:red', '-fill', 'blue',
			'-draw', 'rectangle 40,0 79,19', $sample )->execute()->getExitCode() );
		$layer = [ 'type' => $type, 'x' => $x, 'y' => 60, 'width' => 80, 'height' => 20,
			'rotation' => $angle, 'fill' => '#ff0000', 'stroke' => 'none', 'strokeWidth' => 0,
			'src' => 'data:image/png;base64,' . base64_encode( file_get_contents( $sample ) ) ];
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10, 'LayersMaxImageBytes' => 100000 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$this->assertTrue( $method->invoke( $renderer, $base, [ $layer ], $output, $scaleX, $scaleY, 240, 180 ) );
		$this->assertSame( [], $renderer->getDroppedLayerTypes() );
		$cx = ( $x + 40 ) * $scaleX;
		$cy = 70 * $scaleY;
		$radians = deg2rad( $angle );
		$dx = 24 * $scaleX * cos( $radians );
		$dy = 24 * $scaleX * sin( $radians );
		$this->assertStringContainsString( '255,0,0', $this->pixel( $output, $cx - $dx, $cy - $dy ) );
		$this->assertStringContainsString( $type === 'image' ? '0,0,255' : '255,0,0',
			$this->pixel( $output, $cx + $dx, $cy + $dy ) );
		$this->assertStringContainsString( '255,255,255', $this->pixel( $output,
			$cx + 25 * $scaleY * sin( $radians ), $cy - 25 * $scaleY * cos( $radians ) ) );
	}

	private function pixel( string $file, float $x, float $y ): string {
		$result = Shell::command( '/usr/bin/convert', $file, '-format',
			sprintf( '%%[pixel:p{%d,%d}]', (int)round( $x ), (int)round( $y ) ), 'info:' )->execute();
		$this->assertSame( 0, $result->getExitCode() );
		return $result->getStdout();
	}

	public static function provideRotationCases(): array {
		$cases = [];
		foreach ( [ 'rectangle', 'image' ] as $type ) {
			foreach ( [ 0, 45, 90 ] as $angle ) {
				$cases[ "$type $angle" ] = [ $type, $angle, 1.0, 1.0 ];
				$cases[ "$type $angle scaled" ] = [ $type, $angle, 1.5, 1.0 ];
			}
		}
		$cases['image 45 partially off canvas'] = [ 'image', 45, 1.0, 1.0, -20 ];
		$cases['image 90 partially off canvas'] = [ 'image', 90, 1.0, 1.0, -20 ];
		return $cases;
	}

	public function testRotatedRectangleDoesNotTransformTheFollowingLayer(): void {
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$output = "$dir/output.png";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '240x180', 'xc:white',
			'PNG24:' . $base )->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$layers = [
			[ 'type' => 'rectangle', 'x' => 40, 'y' => 60, 'width' => 80, 'height' => 20,
				'rotation' => 45, 'fill' => '#ff0000', 'stroke' => 'none', 'strokeWidth' => 0 ],
			[ 'type' => 'rectangle', 'x' => 160, 'y' => 20, 'width' => 40, 'height' => 20,
				'fill' => '#0000ff', 'stroke' => 'none', 'strokeWidth' => 0 ],
		];
		$this->assertTrue( $method->invoke( $renderer, $base, $layers, $output, 1.0, 1.0, 240, 180 ) );
		$this->assertStringContainsString( '0,0,255', $this->pixel( $output, 180, 30 ) );
	}

	/** @dataProvider provideRectangleShadowCases */
	public function testRotatedRectangleShadowUsesCanvasCoordinates(
		int $angle, int $offsetX, int $offsetY, int $sampleX, int $sampleY
	): void {
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$output = "$dir/output.png";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '240x180', 'xc:white',
			'PNG24:' . $base )->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$layer = [ 'type' => 'rectangle', 'x' => 40, 'y' => 60, 'width' => 80, 'height' => 20,
			'rotation' => $angle, 'fill' => '#ff0000', 'stroke' => 'none', 'strokeWidth' => 0,
			'shadow' => true, 'shadowColor' => '#000000', 'shadowBlur' => 0,
			'shadowOffsetX' => $offsetX, 'shadowOffsetY' => $offsetY ];
		$this->assertTrue( $method->invoke( $renderer, $base, [ $layer ], $output, 1.0, 1.0, 240, 180 ) );
		$this->assertStringContainsString( '0,0,0', $this->pixel( $output, $sampleX, $sampleY ) );
	}

	public static function provideRectangleShadowCases(): array {
		return [
			'not rotated' => [ 0, 30, 0, 130, 70 ],
			'45 degrees, horizontal shadow' => [ 45, 30, 0, 110, 70 ],
			'90 degrees, horizontal shadow' => [ 90, 30, 0, 110, 70 ],
			'90 degrees, vertical shadow' => [ 90, 0, 30, 80, 130 ],
		];
	}

	/** @dataProvider provideLargeRotatedImageCases */
	public function testLargeRotatedImageRendersWithinShellLimits(
		int $width, int $height, int $angle, float $opacity, float $sourceOpacity, string $format = 'png'
	): void {
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$source = "$dir/source.$format";
		$output = "$dir/output.png";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '240x180', 'xc:white', 'PNG24:' . $base )
			->execute()->getExitCode() );
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '4x4',
			sprintf( 'xc:rgba(255,0,0,%.2F)', $sourceOpacity ),
			( $format === 'png' ? 'PNG32:' : 'JPEG:' ) . $source )
			->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 307200, 'MaxShellTime' => 180, 'MaxShellFileSize' => 102400,
			'LayersImageMagickTimeout' => 30, 'LayersMaxImageBytes' => 100000 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$layer = [ 'type' => 'image', 'x' => 120 - $width / 2, 'y' => 90 - $height / 2,
			'width' => $width, 'height' => $height, 'rotation' => $angle, 'opacity' => $opacity,
			'src' => 'data:image/' . $format . ';base64,' . base64_encode( file_get_contents( $source ) ) ];
		$this->assertTrue( $method->invoke( $renderer, $base, [ $layer ], $output, 1.0, 1.0, 240, 180 ) );
		$sample = Shell::command( '/usr/bin/convert', $output, '-format', '%[fx:round(255*p{120,90}.g)]',
			'info:' )->execute();
		$this->assertSame( 0, $sample->getExitCode() );
		$this->assertEqualsWithDelta( 255 * ( 1 - $opacity * $sourceOpacity ), (float)$sample->getStdout(), 3 );
		if ( $height === 20 ) {
			$this->assertStringContainsString( '255,255,255', $this->pixel( $output, 120, 60 ) );
		}
	}

	public static function provideLargeRotatedImageCases(): array {
		return [
			'45 degrees' => [ 10000, 10000, 45, 1.0, 1.0 ],
			'90 degrees' => [ 10000, 6000, 90, 1.0, 1.0 ],
			'180 degrees, translucent' => [ 6000, 10000, 180, 0.5, 1.0 ],
			'45 degrees, narrow partially visible image' => [ 10000, 20, 45, 1.0, 1.0 ],
			'45 degrees, source and layer transparency' => [ 10000, 10000, 45, 0.5, 0.5 ],
			'45 degrees, JPEG source' => [ 10000, 6000, 45, 1.0, 1.0, 'jpeg' ],
		];
	}

	/** @dataProvider provideImageColorCases */
	public function testImageLayerRetainsColorOnBase(
		bool $grayBase, bool $largeRotated, float $opacity
	): void {
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$source = "$dir/source.png";
		$output = "$dir/output.png";
		$baseArgs = [ '/usr/bin/convert', '-size', '100x100', 'xc:gray(50%)' ];
		if ( $grayBase ) {
			$baseArgs = array_merge( $baseArgs, [ '-colorspace', 'Gray', $base ] );
		} else {
			$baseArgs[] = 'PNG24:' . $base;
		}
		$this->assertSame( 0, Shell::command( ...$baseArgs )->execute()->getExitCode() );
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '4x4', 'xc:red',
			'PNG32:' . $source )->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 307200, 'MaxShellTime' => 180, 'MaxShellFileSize' => 102400,
			'LayersImageMagickTimeout' => 30, 'LayersMaxImageBytes' => 100000 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$layer = [ 'type' => 'image', 'x' => $largeRotated ? -4950 : 20,
			'y' => $largeRotated ? -4950 : 20, 'width' => $largeRotated ? 10000 : 20,
			'height' => $largeRotated ? 10000 : 20, 'rotation' => $largeRotated ? 45 : 0,
			'opacity' => $opacity, 'src' => 'data:image/png;base64,' . base64_encode( file_get_contents( $source ) ) ];
		$this->assertTrue( $method->invoke( $renderer, $base, [ $layer ], $output, 1.0, 1.0, 100, 100 ) );
		$sample = static function ( string $file, int $x, int $y, string $channel ): float {
			$result = Shell::command( '/usr/bin/convert', $file, '-format',
				sprintf( '%%[fx:255*p{%d,%d}.%s]', $x, $y, $channel ), 'info:' )->execute();
			return (float)$result->getStdout();
		};
		$before = $sample( $base, 0, 0, 'g' );
		$this->assertEqualsWithDelta( $opacity * 255 + ( 1 - $opacity ) * $before,
			$sample( $output, $largeRotated ? 50 : 30, $largeRotated ? 50 : 30, 'r' ), 2 );
		$this->assertEqualsWithDelta( ( 1 - $opacity ) * $before,
			$sample( $output, $largeRotated ? 50 : 30, $largeRotated ? 50 : 30, 'g' ), 2 );
		if ( !$largeRotated ) {
			$this->assertEqualsWithDelta( $before, $sample( $output, 0, 0, 'g' ), 1 );
		}
	}

	public static function provideImageColorCases(): array {
		return [
			'gray background, opaque image' => [ true, false, 1.0 ],
			'gray background, translucent image' => [ true, false, 0.5 ],
			'gray background, large rotated image' => [ true, true, 0.5 ],
			'color background, translucent image' => [ false, false, 0.5 ],
		];
	}

	public function testImageColorOnGrayscaleBaseSurvivesPdfConversion(): void {
		if ( !is_executable( '/usr/bin/pdftoppm' ) ) {
			$this->markTestSkipped( 'PDF inspection tools are not installed' );
		}
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$source = "$dir/source.png";
		$output = "$dir/output.png";
		$pdf = "$dir/result.pdf";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '100x100', 'xc:gray(50%)',
			'-colorspace', 'Gray', $base )->execute()->getExitCode() );
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '20x20', 'xc:red',
			'PNG24:' . $source )->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10, 'LayersMaxImageBytes' => 100000 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$layer = [ 'type' => 'image', 'x' => 20, 'y' => 20, 'width' => 20, 'height' => 20,
			'src' => 'data:image/png;base64,' . base64_encode( file_get_contents( $source ) ) ];
		$this->assertTrue( $method->invoke( $renderer, $base, [ $layer ], $output, 1.0, 1.0, 100, 100 ) );
		$conversion = Shell::command( '/usr/bin/convert', $output, 'pdf:' . $pdf )->includeStderr()->execute();
		if ( $conversion->getExitCode() !== 0 &&
			str_contains( $conversion->getStdout() . $conversion->getStderr(), 'security policy' ) ) {
			$this->markTestSkipped( 'ImageMagick policy prohibits PDF conversion on this host' );
		}
		$this->assertSame( 0, $conversion->getExitCode() );
		$prefix = "$dir/extracted";
		$this->assertSame( 0, Shell::command( 'pdftoppm', '-f', '1', '-l', '1', '-r', '72',
			'-png', '-singlefile', $pdf, $prefix )->execute()->getExitCode() );
		$red = Shell::command( '/usr/bin/convert', $prefix . '.png', '-format', '%[fx:p{30,30}.r]',
			'info:' )->execute();
		$green = Shell::command( '/usr/bin/convert', $prefix . '.png', '-format', '%[fx:p{30,30}.g]',
			'info:' )->execute();
		$this->assertGreaterThan( 0.8, (float)$red->getStdout() );
		$this->assertLessThan( 0.2, (float)$green->getStdout() );
	}

	public function testRotationSurvivesMultipagePdfConversion(): void {
		if ( !is_executable( '/usr/bin/pdfinfo' ) || !is_executable( '/usr/bin/pdftoppm' ) ) {
			$this->markTestSkipped( 'PDF inspection tools are not installed' );
		}
		$dir = $this->getNewTempDirectory();
		$base = "$dir/base.png";
		$sample = "$dir/sample.png";
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '240x180', 'xc:white',
			'PNG24:' . $base )->execute()->getExitCode() );
		$this->assertSame( 0, Shell::command( '/usr/bin/convert', '-size', '80x20', 'xc:red', '-fill', 'blue',
			'-draw', 'rectangle 40,0 79,19', $sample )->execute()->getExitCode() );
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => '/usr/bin/convert',
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10, 'LayersMaxImageBytes' => 100000 ] );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		$common = [ 'x' => 40, 'y' => 60, 'width' => 80, 'height' => 20 ];
		$rectangle = $common + [ 'type' => 'rectangle', 'rotation' => 45, 'fill' => '#ff0000',
			'stroke' => 'none', 'strokeWidth' => 0 ];
		$image = $common + [ 'type' => 'image', 'rotation' => 90,
			'src' => 'data:image/png;base64,' . base64_encode( file_get_contents( $sample ) ) ];
		$pages = [ "$dir/page1.png", "$dir/page2.png" ];
		$this->assertTrue( $method->invoke( $renderer, $base, [ $rectangle ], $pages[0], 1.0, 1.0, 240, 180 ) );
		$this->assertTrue( $method->invoke( $renderer, $base, [ $image ], $pages[1], 1.0, 1.0, 240, 180 ) );
		$pdf = "$dir/output.pdf";
		$conversion = Shell::command( ...array_merge( [ '/usr/bin/convert' ], $pages,
			[ '-density', '150', 'pdf:' . $pdf ] ) )->includeStderr()->execute();
		if ( $conversion->getExitCode() !== 0 &&
			str_contains( $conversion->getStdout() . $conversion->getStderr(), 'security policy' )
		) {
			$this->markTestSkipped( 'ImageMagick policy prohibits PDF conversion on this host' );
		}
		$this->assertSame( 0, $conversion->getExitCode() );
		$info = Shell::command( 'pdfinfo', $pdf )->execute();
		$this->assertSame( 0, $info->getExitCode() );
		$this->assertMatchesRegularExpression( '/^Pages:\s+2$/m', $info->getStdout() );
		foreach ( [ 1, 2 ] as $page ) {
			$prefix = "$dir/extracted$page";
			$this->assertSame( 0, Shell::command( 'pdftoppm', '-f', (string)$page, '-l', (string)$page,
				'-r', '72', '-png', '-singlefile', $pdf, $prefix )->execute()->getExitCode() );
			$size = Shell::command( 'identify', '-format', '%w %h', $prefix . '.png' )->execute();
			$this->assertSame( 0, $size->getExitCode() );
			[ $width, $height ] = array_map( 'intval', explode( ' ', trim( $size->getStdout() ) ) );
			$angle = $page === 1 ? 45 : 90;
			$dx = 24 * cos( deg2rad( $angle ) );
			$dy = 24 * sin( deg2rad( $angle ) );
			$this->assertStringContainsString( '255,0,0', $this->pixel( $prefix . '.png',
				( 80 - $dx ) * $width / 240, ( 70 - $dy ) * $height / 180 ) );
			$this->assertStringContainsString( $page === 1 ? '255,0,0' : '0,0,255', $this->pixel( $prefix . '.png',
				( 80 + $dx ) * $width / 240, ( 70 + $dy ) * $height / 180 ) );
		}
	}
}
