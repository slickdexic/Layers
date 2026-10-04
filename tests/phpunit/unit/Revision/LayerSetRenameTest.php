<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\LayerSetIdentity;
use MediaWiki\Extension\Layers\Revision\LayerSetRename;
use MediaWiki\Extension\Layers\Revision\PublicationException;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\LayerSetIdentity
 * @covers \MediaWiki\Extension\Layers\Revision\LayerSetRename
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingName
 */
class LayerSetRenameTest extends \MediaWikiUnitTestCase {

	private function surface( string $id, string $label, ?string $file = null, int $page = 1 ): \stdClass {
		return (object)[ 'id' => $id, 'label' => $label, 'kind' => $file === null ? 'slide' : 'pdf',
			'source' => (object)[ 'fileTitle' => $file, 'page' => $page, 'timestamp' => '20260101000000' ],
			'canvas' => (object)[ 'width' => 640, 'height' => 480 ], 'layers' => [ (object)[ 'text' => $id ] ] ];
	}

	public function testFullIdentitiesIncludeFileCaseAndPageButNotVersion(): void {
		$a = $this->surface( 'a', 'ABC', 'File:Ab.pdf' );
		$otherPage = $this->surface( 'b', 'abc', 'File:Ab.pdf', 2 );
		$this->assertSame( LayerSetIdentity::key( $a ), LayerSetIdentity::key( $otherPage ) );
		$this->assertNotSame( LayerSetIdentity::surfaceKey( $a ), LayerSetIdentity::surfaceKey( $otherPage ) );
		$otherPage->source->page = 1;
		$otherPage->source->timestamp = '20260202000000';
		$this->assertSame( LayerSetIdentity::surfaceKey( $a ), LayerSetIdentity::surfaceKey( $otherPage ) );
		$this->assertNotSame( LayerSetIdentity::key( $a ),
			LayerSetIdentity::key( $this->surface( 'c', 'ABC', 'File:AB.pdf' ) ) );
		$this->assertNotSame( LayerSetIdentity::key( $a ), LayerSetIdentity::key( $this->surface( 's', 'ABC' ) ) );
		$this->assertSame( [ 'ABC', 'abc' ], LayerSetIdentity::namesInScope(
			[ $a, $otherPage, $this->surface( 's', 'ABC' ) ], $a ) );
	}

	public function testOnePdfRenamePreservesEveryOtherFieldAndInput(): void {
		$stored = [ $this->surface( 'a1', 'ABC', 'File:A.pdf' ),
			$this->surface( 'a2', 'ABC', 'File:A.pdf', 2 ),
			$this->surface( 'b', 'ABC', 'File:B.pdf' ), $this->surface( 's', 'ABC' ) ];
		$before = JsonSnapshotCodec::encode( $stored );
		$proposed = array_map( static fn ( $surface ) => clone $surface, $stored );
		$proposed[0]->label = 'XYZ';
		$input = JsonSnapshotCodec::encode( $proposed );
		$result = LayerSetRename::prepare( $stored, $proposed );
		$this->assertSame( [ 'XYZ', 'XYZ', 'ABC', 'ABC' ], array_column( $result['surfaces'], 'label' ) );
		$this->assertSame( [ [ 'kind' => 'file', 'fileTitle' => 'File:A.pdf',
			'oldName' => 'ABC', 'newName' => 'XYZ' ] ], $result['renames'] );
		$this->assertSame( $before, JsonSnapshotCodec::encode( $stored ) );
		$this->assertSame( $input, JsonSnapshotCodec::encode( $proposed ) );
		foreach ( $result['surfaces'] as $i => $surface ) {
			$surface->label = $stored[$i]->label;
			$this->assertSame( JsonSnapshotCodec::encode( $stored[$i] ), JsonSnapshotCodec::encode( $surface ) );
		}
	}

	public function testRemovedPagesStayRemovedAndAddedPagesFollowTheirOriginalSet(): void {
		$stored = [ $this->surface( 'p1', 'ABC', 'File:A.pdf' ), $this->surface( 'p2', 'ABC', 'File:A.pdf', 2 ) ];
		$result = LayerSetRename::prepare( $stored,
			[ $this->surface( 'p1', 'XYZ', 'File:A.pdf' ), $this->surface( 'p3', 'ABC', 'File:A.pdf', 3 ) ] );
		$this->assertSame( [ 'p1', 'p3' ], array_column( $result['surfaces'], 'id' ) );
		$this->assertSame( [ 'XYZ', 'XYZ' ], array_column( $result['surfaces'], 'label' ) );
	}

	public function testSwapsAreBasedOnOriginalIdentitiesInEitherOrder(): void {
		$stored = [ $this->surface( 'a1', 'A', 'File:A.pdf' ), $this->surface( 'a2', 'A', 'File:A.pdf', 2 ),
			$this->surface( 'b1', 'B', 'File:A.pdf' ), $this->surface( 'b2', 'B', 'File:A.pdf', 2 ) ];
		$proposed = array_map( static fn ( $surface ) => clone $surface, $stored );
		$proposed[0]->label = 'B';
		$proposed[2]->label = 'A';
		foreach ( [ $proposed, array_reverse( $proposed ) ] as $order ) {
			$result = LayerSetRename::prepare( $stored, $order );
			$labels = array_column( $result['surfaces'], 'label', 'id' );
			ksort( $labels );
			$this->assertSame( [ 'a1' => 'B', 'a2' => 'B', 'b1' => 'A', 'b2' => 'A' ], $labels );
			DrawingName::assertPublishable( $result['surfaces'], array_column( $result['surfaces'], 'id' ) );
		}
	}

	public function testCaseOnlyRenamePropagatesDisplayNameWithoutRewritingEmbeds(): void {
		$stored = [ $this->surface( 'a', 'ABC', 'File:A.pdf' ), $this->surface( 'b', 'ABC', 'File:A.pdf', 2 ) ];
		$result = LayerSetRename::prepare( $stored, [ $this->surface( 'a', 'abc', 'File:A.pdf' ), $stored[1] ] );
		$this->assertSame( [ 'abc', 'abc' ], array_column( $result['surfaces'], 'label' ) );
		$this->assertSame( [], $result['renames'] );
	}

	public function testConflictingNamesAndMergesOfDisjointPagesRefuse(): void {
		$stored = [ $this->surface( 'a', 'ABC', 'File:A.pdf' ), $this->surface( 'b', 'ABC', 'File:A.pdf', 2 ),
			$this->surface( 'c', 'XYZ', 'File:A.pdf', 3 ) ];
		foreach ( [ [ 'XYZ', 'Different', 'XYZ' ], [ 'XYZ', 'ABC', 'XYZ' ] ] as $labels ) {
			$proposed = array_map( static fn ( $s ) => clone $s, $stored );
			foreach ( $labels as $i => $label ) {
				$proposed[$i]->label = $label;
			}
			foreach ( [ $proposed, array_reverse( $proposed ) ] as $order ) {
				try {
					LayerSetRename::prepare( $stored, $order );
					$this->fail( 'Conflicting rename or implicit set merge must refuse' );
				} catch ( PublicationException $e ) {
					$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
				}
			}
		}
	}

	public function testScopedNameValidationAllowsPdfPagesButRejectsDuplicates(): void {
		$surfaces = [ $this->surface( 'a', 'ABC', 'File:A.pdf' ), $this->surface( 'b', 'ABC', 'File:A.pdf', 2 ),
			$this->surface( 'c', 'ABC', 'File:B.pdf' ), $this->surface( 's', 'ABC' ) ];
		DrawingName::assertPublishable( $surfaces, [ 'a', 'b', 'c', 's' ] );
		$this->addToAssertionCount( 1 );
		foreach ( [ $this->surface( 'duplicate', 'ABC', 'File:A.pdf' ),
			$this->surface( 'different-display', 'abc', 'File:A.pdf', 3 ) ] as $addition ) {
			try {
				DrawingName::assertPublishable( array_merge( $surfaces, [ $addition ] ), [ $addition->id ] );
				$this->fail( 'Duplicate internal page or different display name must refuse' );
			} catch ( PublicationException $e ) {
				$this->assertSame( [ 'layers-invalid-snapshot-name-taken', $addition->label ], $e->getUserMessage() );
			}
		}
	}
}
