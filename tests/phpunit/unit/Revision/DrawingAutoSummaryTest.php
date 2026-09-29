<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DrawingAutoSummary;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingAutoSummary
 */
class DrawingAutoSummaryTest extends \MediaWikiUnitTestCase {

	private function document(): \stdClass {
		return json_decode( file_get_contents( __DIR__ . '/../../../fixtures/revisions/mixed-document-v1.json' ) );
	}

	public function testNoChangeGivesNothing(): void {
		$doc = $this->document();
		$this->assertSame( [], DrawingAutoSummary::changes( $this->document()->surfaces, $doc ) );
	}

	public function testEachAddedEditedRenamedAndRemovedDrawingIsNamed(): void {
		$stored = $this->document()->surfaces;
		$doc = $this->document();
		// Welcome: renamed only. Annotated diagram: edited. Reference sheet: removed. New: added.
		$doc->surfaces[0]->label = 'Title slide';
		$doc->surfaces[1]->canvas->backgroundOpacity = 0.5;
		$added = clone $doc->surfaces[0];
		$added->id = 'added';
		$added->label = 'Extra';
		$doc->surfaces = [ $doc->surfaces[0], $doc->surfaces[1], $added ];
		$this->assertSame( [
			[ 'layers-autosummary-renamed', 'Welcome', 'Title slide' ],
			[ 'layers-autosummary-edited', 'Annotated diagram' ],
			[ 'layers-autosummary-added', 'Extra' ],
			[ 'layers-autosummary-removed', 'Reference sheet' ]
		], DrawingAutoSummary::changes( $stored, $doc ) );
	}

	public function testARenamedAndEditedDrawingGetsBoth(): void {
		$stored = $this->document()->surfaces;
		$doc = $this->document();
		$doc->surfaces[0]->label = 'welcome';
		$doc->surfaces[0]->layers = [];
		$this->assertSame( [
			[ 'layers-autosummary-renamed', 'Welcome', 'welcome' ],
			[ 'layers-autosummary-edited', 'welcome' ]
		], DrawingAutoSummary::changes( $stored, $doc ) );
	}

	public function testKeyOrderIsNotAnEdit(): void {
		$stored = $this->document()->surfaces;
		$doc = $this->document();
		$doc->surfaces[0]->canvas = (object)array_reverse( (array)$doc->surfaces[0]->canvas, true );
		$this->assertSame( [], DrawingAutoSummary::changes( $stored, $doc ) );
	}
}
