<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\NewPageDrawing;

/** @covers \MediaWiki\Extension\Layers\Revision\NewPageDrawing */
class NewPageDrawingTest extends \MediaWikiUnitTestCase {

	public function testNewDraftIdsSeparateTargetsAndTheFormerPageWideNamespace(): void {
		$ids = [
			NewPageDrawing::surfaceId( 150, 200, 'ABC' ),
			NewPageDrawing::surfaceId( 150, 200, 'ABC', 'File:Ab.pdf', 1 ),
			NewPageDrawing::surfaceId( 150, 200, 'ABC', 'File:Ab.pdf', 2 ),
			NewPageDrawing::surfaceId( 150, 200, 'ABC', 'File:AB.pdf', 1 ),
			NewPageDrawing::surfaceId( 151, 200, 'ABC', 'File:Ab.pdf', 1 ),
			NewPageDrawing::surfaceId( 150, 201, 'ABC', 'File:Ab.pdf', 1 ),
			NewPageDrawing::legacySurfaceId( 150, 200, 'ABC' )
		];
		$this->assertSameSize( $ids, array_unique( $ids ) );
		$this->assertSame( 'd' . substr( hash( 'sha256', '150:200:abc' ), 0, 24 ), $ids[6] );
	}

	public function testRepeatedNormalizedIdentityFindsTheSameDraft(): void {
		$this->assertSame( NewPageDrawing::surfaceId( 150, 200, 'Shared_set', 'File:A.pdf', 2 ),
			NewPageDrawing::surfaceId( 150, 200, ' shared SET ', 'File:A.pdf', 2 ) );
		$this->assertSame( NewPageDrawing::surfaceId( 150, 200, 'Shared_set' ),
			NewPageDrawing::surfaceId( 150, 200, ' shared SET ' ) );
	}
}
