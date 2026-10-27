<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor;
use MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use PHPUnit\Framework\TestCase;

/**
 * Effective PDF page controls geometry as well as stored layer selection.
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor
 */
class LegacyPdfDimensionPropagationTest extends TestCase {

	/** @return \PHPUnit\Framework\MockObject\MockObject Two pages with opposite orientations */
	private function file() {
		$file = $this->getMockBuilder( \stdClass::class )->addMethods( [ 'getName', 'getSha1', 'getRepo',
			'isMultipage', 'pageCount', 'getWidth', 'getHeight' ] )->getMock();
		$file->method( 'getName' )->willReturn( 'Review.pdf' );
		$file->method( 'getSha1' )->willReturn( 'abc' );
		$file->method( 'getRepo' )->willReturn( null );
		$file->method( 'isMultipage' )->willReturn( true );
		$file->method( 'pageCount' )->willReturn( 2 );
		$file->method( 'getWidth' )->willReturnCallback( static fn ( $page = 1 ) => $page === 2 ? 208 : 416 );
		$file->method( 'getHeight' )->willReturnCallback( static fn ( $page = 1 ) => $page === 2 ? 416 : 208 );
		return $file;
	}

	/** @return array */
	public static function providePages(): array {
		return [ 'first' => [ 1, 1, 416, 208 ], 'second' => [ 2, 2, 208, 416 ],
			'clamped high' => [ 99, 2, 208, 416 ], 'clamped low' => [ 0, 1, 416, 208 ] ];
	}

	/**
	 * @dataProvider providePages
	 * @param int $requested
	 * @param int $effective
	 * @param int $width
	 * @param int $height
	 */
	public function testAttributeInjectionUsesSelectedPage( int $requested, int $effective,
		int $width, int $height
	): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->expects( $this->once() )->method( 'getLatestLayerSet' )
			->with( 'Review.pdf', 'abc', 'ABC', $effective )
			->willReturn( [ 'data' => [ 'layers' => [ [ 'id' => 'selected-page', 'type' => 'text' ] ] ] ] );
		$injector = new LayerInjector();
		$injector->setDatabase( $db );
		$injector->setHtmlInjector( new LayersHtmlInjector() );
		$attributes = [];
		$this->assertTrue( $injector->injectIntoAttributes( $attributes, $this->file(), 'ABC', 'test', $requested ) );
		$payload = json_decode( $attributes['data-layer-data'], true, 32, JSON_THROW_ON_ERROR );
		$this->assertSame( $width, $payload['baseWidth'] );
		$this->assertSame( $height, $payload['baseHeight'] );
		$this->assertSame( 'selected-page', $payload['layers'][0]['id'] );
	}

	/** @return array */
	public static function provideDirectPages(): array {
		return [ 'default' => [ [], [], 416, 208 ], 'handler' => [ [ 'page' => 2 ], [], 208, 416 ],
			'frame' => [ [], [ 'page' => 2 ], 208, 416 ],
			'handler precedence' => [ [ 'page' => 1 ], [ 'page' => 2 ], 416, 208 ] ];
	}

	/**
	 * @dataProvider provideDirectPages
	 * @param array $handler
	 * @param array $frame
	 * @param int $width
	 * @param int $height
	 */
	public function testDirectPayloadUsesEffectivePdfPage( array $handler, array $frame,
		int $width, int $height
	): void {
		$processor = new ImageLinkProcessor( new LayersHtmlInjector(), new LayersParamExtractor() );
		$html = '<img src="/example.jpg">';
		$handler['layersjson'] = '{"layers":[{"id":"selected-page","type":"text"}]}';
		$processor->processImageLink( $this->file(), $handler, $frame, $html );
		$this->assertSame( 1, preg_match( '/data-layer-data="([^"]+)"/', $html, $matches ) );
		$payload = json_decode( html_entity_decode( $matches[1], ENT_QUOTES ), true, 32, JSON_THROW_ON_ERROR );
		$this->assertSame( $width, $payload['baseWidth'] );
		$this->assertSame( $height, $payload['baseHeight'] );
		$this->assertSame( 'selected-page', $payload['layers'][0]['id'] );
	}
}
