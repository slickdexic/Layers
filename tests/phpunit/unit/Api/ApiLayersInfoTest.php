<?php

namespace MediaWiki\Extension\Layers\Tests\Api;

require_once __DIR__ . '/../../../../src/Api/Traits/LayersContinuationTrait.php';

use MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait;
use PHPUnit\Framework\TestCase;

class ApiLayersInfoTest extends TestCase {
	public function testParseContinueParameterWithPrefix(): void {
		$module = new LayersContinuationTraitHarness();
		$this->assertSame( 25, $module->callParseContinueParameter( 'offset|25' ) );
		$this->assertSame( 0, $module->callParseContinueParameter( 'offset|not-a-number' ) );
	}

	public function testParseContinueParameterFallsBackToInteger(): void {
		$module = new LayersContinuationTraitHarness();
		$this->assertSame( 10, $module->callParseContinueParameter( '10' ) );
		$this->assertSame( 0, $module->callParseContinueParameter( '-5' ) );
	}

	public function testFormatContinueParameter(): void {
		$module = new LayersContinuationTraitHarness();
		$this->assertSame( 'offset|40', $module->callFormatContinueParameter( 40 ) );
		$this->assertSame( 'offset|0', $module->callFormatContinueParameter( -4 ) );
	}
}

class LayersContinuationTraitHarness {
	use LayersContinuationTrait;

	public function callParseContinueParameter( string $continue ): int {
		return $this->parseContinueParameter( $continue );
	}

	public function callFormatContinueParameter( int $offset ): string {
		return $this->formatContinueParameter( $offset );
	}
}
