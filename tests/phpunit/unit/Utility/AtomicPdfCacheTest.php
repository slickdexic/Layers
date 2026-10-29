<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Utility;

use MediaWiki\Extension\Layers\Utility\AtomicPdfCache;
use PHPUnit\Framework\TestCase;

/** @covers \MediaWiki\Extension\Layers\Utility\AtomicPdfCache */
class AtomicPdfCacheTest extends TestCase {
	private string $dir;

	protected function setUp(): void {
		$this->dir = sys_get_temp_dir() . '/layers-pdf-' . bin2hex( random_bytes( 8 ) );
		mkdir( $this->dir );
	}

	protected function tearDown(): void {
		foreach ( glob( $this->dir . '/*' ) ?: [] as $file ) {
			unlink( $file );
		}
		foreach ( glob( $this->dir . '/.layers-pdf-*' ) ?: [] as $file ) {
			unlink( $file );
		}
		rmdir( $this->dir );
	}

	public function testFailedOrIncompleteOutputNeverAppearsAtFinalPath(): void {
		$target = $this->dir . '/export.pdf';
		foreach ( [ false, true ] as $success ) {
			$result = AtomicPdfCache::publish( $target, function ( $temp ) use ( $target, $success ) {
				$this->assertFileDoesNotExist( $target );
				file_put_contents( $temp, '%PDF-1.7 partial' );
				return $success;
			} );
			$this->assertFalse( $result );
			$this->assertFileDoesNotExist( $target );
			$this->assertSame( [], glob( $this->dir . '/.layers-pdf-*' ) );
		}
	}

	public function testCompleteOutputIsPublishedAtomically(): void {
		$target = $this->dir . '/export.pdf';
		$pdf = "%PDF-1.7\ncomplete\n%%EOF\n";
		$this->assertTrue( AtomicPdfCache::publish( $target, function ( $temp ) use ( $target, $pdf ) {
			$this->assertFileDoesNotExist( $target );
			file_put_contents( $temp, $pdf );
			return true;
		} ) );
		$this->assertSame( $pdf, file_get_contents( $target ) );
	}

	public function testFailedConcurrentRenderCannotReplaceCompleteOutput(): void {
		$target = $this->dir . '/export.pdf';
		$pdf = "%PDF-1.7\ncomplete\n%%EOF\n";
		$this->assertFalse( AtomicPdfCache::publish( $target, function ( $outer ) use ( $target, $pdf ) {
			file_put_contents( $outer, '%PDF-1.7 partial' );
			$this->assertTrue( AtomicPdfCache::publish( $target, static function ( $inner ) use ( $pdf ) {
				file_put_contents( $inner, $pdf );
				return true;
			} ) );
			return false;
		} ) );
		$this->assertSame( $pdf, file_get_contents( $target ) );
	}

	public function testInterleavedSuccessfulRendersPublishOnlyCompleteFiles(): void {
		$target = $this->dir . '/export.pdf';
		$first = "%PDF-1.7\nfirst\n%%EOF\n";
		$second = "%PDF-1.7\nsecond\n%%EOF\n";
		$this->assertTrue( AtomicPdfCache::publish( $target, function ( $outer ) use ( $target, $first, $second ) {
			file_put_contents( $outer, '%PDF-1.7 partial' );
			$this->assertTrue( AtomicPdfCache::publish( $target, static function ( $inner ) use ( $second ) {
				file_put_contents( $inner, $second );
				return true;
			} ) );
			$this->assertSame( $second, file_get_contents( $target ) );
			file_put_contents( $outer, $first );
			return true;
		} ) );
		$this->assertSame( $first, file_get_contents( $target ) );
	}
}
