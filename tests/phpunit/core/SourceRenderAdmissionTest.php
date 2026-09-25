<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\SourceRenderAdmission;
use MediaWiki\FileRepo\File\File;

/** @covers \MediaWiki\Extension\Layers\Revision\SourceRenderAdmission */
class SourceRenderAdmissionTest extends \MediaWikiIntegrationTestCase {

	/** Exact byte limit and exact pixel limit on pinned page 2 are accepted. */
	public function testExactLimitsAndPinnedPageAreAccepted(): void {
		$file = $this->createMock( File::class );
		$file->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES );
		$file->expects( $this->once() )->method( 'getWidth' )->with( 2 )->willReturn( 10000 );
		$file->expects( $this->once() )->method( 'getHeight' )->with( 2 )->willReturn( 4000 );
		( new SourceRenderAdmission() )->assertCanRender( $file, 2 );
	}

	/** Source bytes exceeding 64 MiB reject immediately without invoking geometry methods. */
	public function testExcessiveBytesRejectBeforeGeometry(): void {
		$file = $this->createMock( File::class );
		$file->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES + 1 );
		$file->expects( $this->never() )->method( 'getWidth' );
		$file->expects( $this->never() )->method( 'getHeight' );
		$this->expectExceptionMessage( 'layers-render-unavailable' );
		$this->expectException( \DomainException::class );
		( new SourceRenderAdmission() )->assertCanRender( $file, 1 );
	}

	/** Zero, negative, false, null or non-integer file sizes must reject before geometry queries. */
	public function testZeroNegativeAndUnavailableFileSizeRejectBeforeGeometry(): void {
		foreach ( [ 0, -1, -100, false, null, '64000000', 1.5 ] as $size ) {
			$file = $this->createMock( File::class );
			$file->method( 'getSize' )->willReturn( $size );
			$file->expects( $this->never() )->method( 'getWidth' );
			$file->expects( $this->never() )->method( 'getHeight' );
			try {
				( new SourceRenderAdmission() )->assertCanRender( $file, 1 );
				$this->fail( 'Invalid file size must be rejected before geometry lookups' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
		}
	}

	/** Non-positive page numbers must reject before geometry queries. */
	public function testInvalidPageRejectsBeforeGeometry(): void {
		foreach ( [ 0, -1, -999 ] as $page ) {
			$file = $this->createMock( File::class );
			$file->method( 'getSize' )->willReturn( 1024 );
			$file->expects( $this->never() )->method( 'getWidth' );
			$file->expects( $this->never() )->method( 'getHeight' );
			try {
				( new SourceRenderAdmission() )->assertCanRender( $file, $page );
				$this->fail( 'Non-positive page must be rejected before geometry lookups' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
		}
	}

	/** Byte threshold boundaries: just below, exact limit and just above limit. */
	public function testByteThresholdBoundariesJustBelowExactAndJustAbove(): void {
		$admission = new SourceRenderAdmission();

		// Just below byte limit: admitted
		$fileBelow = $this->createMock( File::class );
		$fileBelow->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES - 1 );
		$fileBelow->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 100 );
		$fileBelow->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 100 );
		$admission->assertCanRender( $fileBelow, 1 );

		// Exact byte limit: admitted
		$fileExact = $this->createMock( File::class );
		$fileExact->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES );
		$fileExact->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 100 );
		$fileExact->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 100 );
		$admission->assertCanRender( $fileExact, 1 );

		// Just above byte limit: rejected before geometry
		$fileAbove = $this->createMock( File::class );
		$fileAbove->method( 'getSize' )->willReturn( SourceRenderAdmission::MAX_SOURCE_BYTES + 1 );
		$fileAbove->expects( $this->never() )->method( 'getWidth' );
		$fileAbove->expects( $this->never() )->method( 'getHeight' );
		try {
			$admission->assertCanRender( $fileAbove, 1 );
			$this->fail( 'File size exceeding MAX_SOURCE_BYTES must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
	}

	/** Pixel threshold boundaries: just below, exact limit and just above limit. */
	public function testPixelThresholdBoundariesJustBelowExactAndJustAbove(): void {
		$admission = new SourceRenderAdmission();

		// Just below pixel limit (39,999,999 pixels): admitted
		$fileBelow = $this->createMock( File::class );
		$fileBelow->method( 'getSize' )->willReturn( 1024 );
		$fileBelow->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 39999999 );
		$fileBelow->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 1 );
		$admission->assertCanRender( $fileBelow, 1 );

		// Exact pixel limit 1D (40,000,000 pixels): admitted
		$fileExact1D = $this->createMock( File::class );
		$fileExact1D->method( 'getSize' )->willReturn( 1024 );
		$fileExact1D->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 40000000 );
		$fileExact1D->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 1 );
		$admission->assertCanRender( $fileExact1D, 1 );

		// Exact pixel limit 2D (10,000 x 4,000 = 40,000,000 pixels): admitted
		$fileExact2D = $this->createMock( File::class );
		$fileExact2D->method( 'getSize' )->willReturn( 1024 );
		$fileExact2D->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 10000 );
		$fileExact2D->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 4000 );
		$admission->assertCanRender( $fileExact2D, 1 );

		// Just above pixel limit 1D (40,000,001 pixels): rejected
		$fileAbove1D = $this->createMock( File::class );
		$fileAbove1D->method( 'getSize' )->willReturn( 1024 );
		$fileAbove1D->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 40000001 );
		$fileAbove1D->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 1 );
		try {
			$admission->assertCanRender( $fileAbove1D, 1 );
			$this->fail( '40,000,001 pixels must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}

		// Just above pixel limit 2D (10,000 x 4,001 = 40,010,000 pixels): rejected
		$fileAbove2D = $this->createMock( File::class );
		$fileAbove2D->method( 'getSize' )->willReturn( 1024 );
		$fileAbove2D->expects( $this->once() )->method( 'getWidth' )->with( 1 )->willReturn( 10000 );
		$fileAbove2D->expects( $this->once() )->method( 'getHeight' )->with( 1 )->willReturn( 4001 );
		try {
			$admission->assertCanRender( $fileAbove2D, 1 );
			$this->fail( '40,010,000 pixels must be rejected' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
		}
	}

	/** Invalid and excessive geometry rejects without multiplication overflow. */
	public function testInvalidAndExcessiveGeometryRejectsWithoutMultiplicationOverflow(): void {
		foreach ( [
			[ 0, 1 ],
			[ 1, -1 ],
			[ -10, 100 ],
			[ false, 1 ],
			[ 1, false ],
			[ null, 100 ],
			[ 100, null ],
			[ '100', 100 ],
			[ 100, '100' ],
			[ 100.5, 100 ],
			[ 10000, 4001 ],
			[ PHP_INT_MAX, PHP_INT_MAX ]
		] as [ $width, $height ] ) {
			$file = $this->createMock( File::class );
			$file->method( 'getSize' )->willReturn( 100 );
			$file->method( 'getWidth' )->willReturn( $width );
			$file->method( 'getHeight' )->willReturn( $height );
			try {
				( new SourceRenderAdmission() )->assertCanRender( $file, 1 );
				$this->fail( 'Invalid geometry must not be admitted' );
			} catch ( \DomainException $e ) {
				$this->assertSame( 'layers-render-unavailable', $e->getMessage() );
			}
		}
	}
}
