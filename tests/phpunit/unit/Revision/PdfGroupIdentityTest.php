<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;

/** @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot */
class PdfGroupIdentityTest extends \MediaWikiUnitTestCase {
	/** @dataProvider provideGroups */
	public function testGroupIdentityPreservesFileNamePageAndPinBoundaries( array $surfaces, bool $expected ): void {
		$pilot = ( new \ReflectionClass( PageOwnedPilot::class ) )->newInstanceWithoutConstructor();
		$method = new \ReflectionMethod( PageOwnedPilot::class, 'isWholePdfGroup' );
		$this->assertSame( $expected, $method->invoke( $pilot, [ 'schemaVersion' => 1, 'surfaces' => $surfaces ],
			$surfaces[0] ) );
	}

	public static function provideGroups(): array {
		$pdf = [ 'id' => 'one', 'kind' => 'pdf', 'label' => 'ABC', 'source' => [ 'repository' => 'local',
			'fileTitle' => 'File:Example.pdf', 'timestamp' => '20261030000000', 'sha1' => str_repeat( 'a', 31 ),
			'page' => 1 ], 'layers' => [] ];
		$page2 = $pdf;
		$page2['id'] = 'two';
		$page2['source']['page'] = 2;
		$otherFile = $page2;
		$otherFile['source']['fileTitle'] = 'File:Other.pdf';
		$otherName = $page2;
		$otherName['label'] = 'Different';
		$otherSpelling = $page2;
		$otherSpelling['label'] = 'abc';
		$otherVersion = $page2;
		$otherVersion['source']['sha1'] = str_repeat( 'b', 31 );
		$otherTimestamp = $page2;
		$otherTimestamp['source']['timestamp'] = '20261031000000';
		$otherRepository = $page2;
		$otherRepository['source']['repository'] = 'other';
		$duplicatePage = $page2;
		$duplicatePage['source']['page'] = 1;
		$image = $page2;
		$image['kind'] = 'image';
		$slide = [ 'id' => 'slide', 'kind' => 'slide', 'label' => 'ABC',
			'layers' => [ [ 'src' => 'data:image/png;base64,' . str_repeat( 'x', 1200000 ) ] ] ];
		return [ 'single page' => [ [ $pdf ], true ], 'matching pages' => [ [ $pdf, $page2 ], true ],
			'different file' => [ [ $pdf, $otherFile ], true ], 'different name' => [ [ $pdf, $otherName ], true ],
			'unrelated slide payload' => [ [ $pdf, $slide ], true ],
			'different spelling in group' => [ [ $pdf, $otherSpelling ], false ],
			'different version' => [ [ $pdf, $otherVersion ], false ],
			'different timestamp' => [ [ $pdf, $otherTimestamp ], false ],
			'different repository' => [ [ $pdf, $otherRepository ], false ],
			'duplicate page' => [ [ $pdf, $duplicatePage ], false ], 'mixed file kind' => [ [ $pdf, $image ], false ] ];
	}
}
