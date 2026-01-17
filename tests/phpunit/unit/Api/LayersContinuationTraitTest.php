<?php
/**
 * Tests for LayersContinuationTrait
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait
 * @group Layers
 */
class LayersContinuationTraitTest extends TestCase {
	use LayersContinuationTrait;

	/**
	 * @dataProvider provideParseContinueParameter
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait::parseContinueParameter
	 */
	public function testParseContinueParameter( string $continue, int $expected ): void {
		$this->assertSame( $expected, $this->parseContinueParameter( $continue ) );
	}

	/**
	 * Data provider for testParseContinueParameter
	 *
	 * @return array Test cases
	 */
	public static function provideParseContinueParameter(): array {
		return [
			'offset format with zero' => [ 'offset|0', 0 ],
			'offset format with positive' => [ 'offset|10', 10 ],
			'offset format with large number' => [ 'offset|1000', 1000 ],
			'plain integer string' => [ '50', 50 ],
			'plain zero' => [ '0', 0 ],
			'negative offset clamps to zero' => [ 'offset|-5', 0 ],
			'negative plain integer clamps to zero' => [ '-10', 0 ],
			'empty string returns zero' => [ '', 0 ],
			'malformed offset with missing value' => [ 'offset|', 0 ],
			'non-numeric value returns zero' => [ 'offset|abc', 0 ],
			'plain non-numeric value returns zero' => [ 'abc', 0 ],
		];
	}

	/**
	 * @dataProvider provideFormatContinueParameter
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait::formatContinueParameter
	 */
	public function testFormatContinueParameter( int $offset, string $expected ): void {
		$this->assertSame( $expected, $this->formatContinueParameter( $offset ) );
	}

	/**
	 * Data provider for testFormatContinueParameter
	 *
	 * @return array Test cases
	 */
	public static function provideFormatContinueParameter(): array {
		return [
			'zero offset' => [ 0, 'offset|0' ],
			'positive offset' => [ 25, 'offset|25' ],
			'large offset' => [ 500, 'offset|500' ],
			'negative offset clamps to zero' => [ -10, 'offset|0' ],
		];
	}

	/**
	 * Test round-trip parsing and formatting
	 *
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait::parseContinueParameter
	 * @covers \MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait::formatContinueParameter
	 */
	public function testRoundTrip(): void {
		$offsets = [ 0, 1, 10, 100, 1000 ];

		foreach ( $offsets as $original ) {
			$formatted = $this->formatContinueParameter( $original );
			$parsed = $this->parseContinueParameter( $formatted );
			$this->assertSame( $original, $parsed, "Round-trip failed for offset $original" );
		}
	}
}
