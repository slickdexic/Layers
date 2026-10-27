<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Config\Config;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\Extension\Layers\Validation\SvgResourceGuard;
use Psr\Log\NullLogger;

/** Self-contained shape resources at both publication and historical rendering. */
class SvgResourceGuardTest extends \MediaWikiUnitTestCase {
	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\SvgResourceGuard
	 * @dataProvider provideDocuments
	 * @param string $content SVG body
	 * @param bool $allowed Expected admission
	 */
	public function testResourceReferences( string $content, bool $allowed ): void {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' .
			$content . '</svg>';
		$this->assertSame( $allowed, SvgResourceGuard::isSelfContained( $svg ) );
	}

	/** @return array */
	public static function provideDocuments(): array {
		return [
			'geometry' => [ '<path d="M0,0 L10,10"/>', true ],
			'fragment' => [ '<use href="#shape"/>', true ],
			'namespaced fragment' => [ '<use xlink:href="#shape"/>', true ],
			'fragment CSS' => [ '<path fill="url(&quot;#paint&quot;)"/>', true ],
			'internal stylesheet' => [ '<style>path {fill:url(#paint)}</style>', true ],
			'embedded raster' => [ '<image href="data:image/png;base64,' .
				base64_encode( file_get_contents( __DIR__ . '/../../../fixtures/assets/test-image.png' ) ) . '"/>',
				true ],
			'local file' => [ '<image href="file:///tmp/owned-marker.png"/>', false ],
			'absolute path' => [ '<image href="/tmp/owned-marker.png"/>', false ],
			'relative file' => [ '<image href="owned-marker.png"/>', false ],
			'remote URL' => [ '<image href="https://example.invalid/marker.png"/>', false ],
			'protocol relative' => [ '<image href="//example.invalid/marker.png"/>', false ],
			'entity encoded file' => [ '<image href="&#102;ile:///tmp/owned-marker.png"/>', false ],
			'CSS file' => [ '<path fill="url(file:///tmp/owned-marker.png)"/>', false ],
			'escaped CSS function' => [ '<path style="fill:u\72 l(file:///tmp/owned-marker.png)"/>', false ],
			'CSS comments' => [ '<path style="fill:u/**/rl(file:///tmp/owned-marker.png)"/>', false ],
			'base URI' => [ '<g xml:base="file:///tmp/"><image href="#fragment"/></g>', false ],
			'animated resource' => [ '<image href="#safe">' .
				'<set attributeName="href" to="file:///tmp/marker.png"/></image>', false ],
			'aliased animated resource' => [ '<g xmlns:r="http://www.w3.org/1999/xlink">' .
				'<set attributeName="r:href" to="marker.png"/></g>', false ],
			'embedded SVG' => [ '<image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>', false ],
			'stylesheet' => [ '<style>path {fill:url(marker.png)}</style>', false ],
			'processing instruction' => [ '<?xml-stylesheet href="marker.css"?>', false ],
			'malformed XML' => [ '<path>', false ],
		];
	}

	/** @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator */
	public function testPublicationRefusesFileReference(): void {
		$method = new \ReflectionMethod( ServerSideLayerValidator::class, 'validateSvgString' );
		$method->setAccessible( true );
		$result = $method->invoke( new ServerSideLayerValidator(),
			'<svg><image href="file:///tmp/owned-marker.png"/></svg>' );
		$this->assertFalse( $result['valid'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\SvgResourceGuard
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator
	 */
	public function testRetainedRenderingDoesNotIncreasePublicationLimit(): void {
		$svg = '<svg>' . str_repeat( ' ', 102400 ) . '<path d="M0,0 L10,10"/></svg>';
		$this->assertTrue( SvgResourceGuard::isSelfContained( $svg, 2097152 ) );
		$this->assertFalse( SvgResourceGuard::isSelfContained( $svg ) );
		$method = new \ReflectionMethod( ServerSideLayerValidator::class, 'validateSvgString' );
		$method->setAccessible( true );
		$this->assertFalse( $method->invoke( new ServerSideLayerValidator(), $svg )['valid'] );
	}

	/** @covers \MediaWiki\Extension\Layers\ThumbnailRenderer */
	public function testStoredSvgIsRefusedBeforeConverterConfigurationIsRead(): void {
		$reads = [];
		$config = $this->createMock( Config::class );
		$config->method( 'has' )->willReturnCallback( static function ( $key ) use ( &$reads ) {
			$reads[] = $key;
			return false;
		} );
		$renderer = new ThumbnailRenderer( $config, new NullLogger() );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'rasterizeShapeSvg' );
		$method->setAccessible( true );
		$this->assertNull( $method->invoke( $renderer,
			'<svg><image href="file:///tmp/owned-marker.png"/></svg>', 16, 16 ) );
		$this->assertSame( [], $reads );
	}
}
