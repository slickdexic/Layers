<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingSelection;

/** @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingSelection */
class DirectEmbeddingSelectionTest extends \MediaWikiUnitTestCase {

	/** @dataProvider provideAccepted @param array $candidate @param array $selection */
	public function testMatchesWithoutMutating( array $candidate, array $selection ): void {
		$original = [ $candidate, $selection ];
		DirectEmbeddingSelection::assertMatches( $candidate, $selection );
		$this->assertSame( $original, [ $candidate, $selection ] );
	}

	/** @return array */
	public static function provideAccepted(): array {
		$result = [];
		foreach ( [ 'layerset', 'layers', 'layer' ] as $key ) {
			$result[$key] = [ self::file( [ "$key=default" ] ), self::selection() ];
		}
		$result['second PDF page'] = [ self::file( [ 'page=2', 'layerset=default' ] ), self::selection( 2 ) ];
		$result['upper option lower value'] = [
			self::file( [ 'thumb', ' LAYERSET = default ', 'caption mentions layerset=other' ] ), self::selection()
		];
		$result['slide case preserved'] = [
			[ 'kind' => 'slide', 'target' => 'My_Slide',
				'options' => [ 'layerset=Drawing_A', 'size=400x300', 'noedit' ] ],
			[ 'imgName' => 'Slide:My_Slide', 'name' => 'Drawing_A', 'page' => 1 ]
		];
		return $result;
	}

	/** @dataProvider provideRejected @param array $candidate @param array $selection */
	public function testRejectsWithoutReflectingInput( array $candidate, array $selection ): void {
		try {
			DirectEmbeddingSelection::assertMatches( $candidate, $selection );
			$this->fail( 'Expected rejection' );
		} catch ( \InvalidArgumentException $e ) {
			$this->assertSame( 'layers-embedding-selection-unavailable', $e->getMessage() );
		}
	}

	/** @return array */
	public static function provideRejected(): array {
		$result = [];
		foreach ( [ [], [ 'layerset' ], [ 'layerset=' ], [ 'layersetid=12' ],
			[ 'layerset=default', 'layers=default' ], [ 'layerset=default', 'layerset=default' ],
			[ 'layerset=default', 'layersbinding=v1:2:a' ], [ 'layerset=default', 'page' ],
			[ 'layerset=default', 'page=1', 'page=1' ], [ 'layerset=default', 'page=01' ],
			[ 'layerset=default', 'page=0' ], [ 'layerset=default', 'page=100001' ],
			[ 'layerset=default', 'page=2' ], [ 'layerset=default', 'page=1x' ],
			[ 'layerset=default', 'page=1.0' ], [ 'layerset=default', "page=1\0" ],
			[ 'layerset=default', 123 ], [ 1 => 'layerset=default' ]
		] as $index => $options ) {
			$result["options $index"] = [ self::file( $options ), self::selection() ];
		}
		// Numeric 001 is a legitimate legacy name, but file paths also interpret it as short layer IDs.
		foreach ( [ 'on', 'true', 'all', '1', 'off', 'none', 'false', '0', '001', 'ab12',
			'aa,bb', 'id:12', 'name:default', 'Drawing_A', 'a  b', "default\0" ] as $value
		) {
			$result["name $value"] = [ self::file( [ "layerset=$value" ] ),
				[ 'imgName' => 'Diagram.pdf', 'name' => $value, 'page' => 1 ] ];
		}
		foreach ( [ [ 'imgName', 'Other.pdf' ], [ 'name', 'different' ], [ 'page', '1' ],
			[ 'page', 0 ], [ 'page', 100001 ], [ 'name', null ] ] as [ $key, $value ]
		) {
			$selection = self::selection();
			$selection[$key] = $value;
			$result['selection ' . $key . serialize( $value )] = [ self::file( [ 'layerset=default' ] ), $selection ];
		}
		$slide = [ 'kind' => 'slide', 'target' => 'MySlide', 'options' => [ 'layerset=Drawing_A' ] ];
		$selection = [ 'imgName' => 'Slide:MySlide', 'name' => 'Drawing_A', 'page' => 1 ];
		foreach ( [ 'canvas=800x600', 'background=white', 'canvas', 'background', 'page=1',
			'layers=Drawing_A', 'layer=Drawing_A', 'layersetid=1', 'name=Other', 'NAME=MySlide',
			'name=', 'name' ] as $option
		) {
			$candidate = $slide;
			$candidate['options'][] = $option;
			$result['slide ' . $option] = [ $candidate, $selection ];
		}
		foreach ( [ 'myslide', ' MySlide ', 'new', 'Bad/name' ] as $target ) {
			$candidate = $slide;
			$candidate['target'] = $target;
			$result['slide target ' . $target] = [ $candidate, $selection ];
		}
		$result['unknown kind'] = [ [ 'kind' => 'pdf', 'target' => 'File:Diagram.pdf', 'options' => [] ], [] ];
		$result['missing candidate'] = [ [], self::selection() ];
		return $result;
	}

	/** @param array $options @return array */
	private static function file( array $options ): array {
		return [ 'kind' => 'file', 'target' => 'File:Diagram.pdf', 'options' => $options ];
	}

	/** @param int $page @return array */
	private static function selection( int $page = 1 ): array {
		return [ 'imgName' => 'Diagram.pdf', 'name' => 'default', 'page' => $page ];
	}
}
