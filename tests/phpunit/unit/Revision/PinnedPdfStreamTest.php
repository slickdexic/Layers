<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\PinnedPdfStream;
use PHPUnit\Framework\TestCase;

/** @covers \MediaWiki\Extension\Layers\Revision\PinnedPdfStream */
class PinnedPdfStreamTest extends TestCase {

	/** @return resource */
	private function source( string $bytes ) {
		$handle = fopen( 'php://temp', 'w+b' );
		$this->assertIsResource( $handle );
		$this->assertSame( strlen( $bytes ), fwrite( $handle, $bytes ) );
		return $handle;
	}

	public function testRetainsVerifiedBytesAndClosesBeforeCleaningUp(): void {
		$bytes = file_get_contents( __DIR__ . '/../../../fixtures/assets/test-multipage.pdf' );
		$handle = $this->source( $bytes );
		$cleaned = 0;
		$capture = PinnedPdfStream::capture( $handle, sha1( $bytes ), function () use ( &$cleaned, $handle ) {
			$this->assertSame( 'resource (closed)', get_debug_type( $handle ) );
			$cleaned++;
		} );
		$this->assertSame( strlen( $bytes ), $capture->getLength() );
		$sink = fopen( 'php://temp', 'w+b' );
		try {
			$capture->copyTo( $sink );
			rewind( $sink );
			$this->assertSame( $bytes, stream_get_contents( $sink ) );
			$this->assertSame( 0, $cleaned );
		} finally {
			fclose( $sink );
			$capture->close();
		}
		$capture->close();
		$this->assertSame( 1, $cleaned );
	}

	public function testReplacementSourceIsRefusedBeforeAnyDelivery(): void {
		$original = file_get_contents( __DIR__ . '/../../../fixtures/assets/test-multipage.pdf' );
		$replacement = file_get_contents( __DIR__ . '/../../../fixtures/assets/test-multipage-replacement.pdf' );
		$this->assertNotSame( sha1( $original ), sha1( $replacement ) );
		$handle = $this->source( $replacement );
		$cleaned = false;
		try {
			PinnedPdfStream::capture( $handle, sha1( $original ), static function () use ( &$cleaned ) {
				$cleaned = true;
			} );
			$this->fail( 'A different uploaded PDF must not be delivered as the pinned version' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( 'resource (closed)', get_debug_type( $handle ) );
		$this->assertTrue( $cleaned );
	}

	public function testDeliveryDoesNotReopenTheMutableRepositoryPath(): void {
		$path = tempnam( sys_get_temp_dir(), 'layers-pdf-' );
		$original = file_get_contents( __DIR__ . '/../../../fixtures/assets/test-multipage.pdf' );
		$replacement = file_get_contents( __DIR__ . '/../../../fixtures/assets/test-multipage-replacement.pdf' );
		file_put_contents( $path, $original );
		$handle = $this->source( file_get_contents( $path ) );
		$capture = PinnedPdfStream::capture( $handle, sha1( $original ), static function () {
		} );
		$sink = fopen( 'php://temp', 'w+b' );
		try {
			file_put_contents( $path, $replacement );
			$this->assertSame( $replacement, file_get_contents( $path ) );
			$capture->copyTo( $sink );
			rewind( $sink );
			$this->assertSame( $original, stream_get_contents( $sink ) );
		} finally {
			$capture->close();
			fclose( $sink );
			unlink( $path );
		}
	}

	/** @return array */
	public static function provideInvalidCaptures(): array {
		return [
			'empty bytes' => [ '', sha1( '' ) ],
			'wrong pin' => [ '%PDF-fixture', str_repeat( '0', 40 ) ],
			'base36 is not hex' => [ '%PDF-fixture', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' ],
			'malformed hex' => [ '%PDF-fixture', "\n" . sha1( '%PDF-fixture' ) ],
		];
	}

	/** @dataProvider provideInvalidCaptures */
	public function testInvalidCaptureReleasesOwnedResources( string $bytes, string $pin ): void {
		$handle = $this->source( $bytes );
		$cleaned = 0;
		try {
			PinnedPdfStream::capture( $handle, $pin, static function () use ( &$cleaned ) {
				$cleaned++;
			} );
			$this->fail( 'Invalid capture must refuse before any response' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
		}
		$this->assertSame( 'resource (closed)', get_debug_type( $handle ) );
		$this->assertSame( 1, $cleaned );
	}

	public function testAbandonedCaptureReleasesTheHandle(): void {
		$handle = $this->source( '%PDF-fixture' );
		$cleaned = false;
		$capture = PinnedPdfStream::capture( $handle, sha1( '%PDF-fixture' ), static function () use ( &$cleaned ) {
			$cleaned = true;
		} );
		unset( $capture );
		$this->assertSame( 'resource (closed)', get_debug_type( $handle ) );
		$this->assertTrue( $cleaned );
	}

	public function testClosedCaptureCannotDeliver(): void {
		$bytes = '%PDF-fixture';
		$capture = PinnedPdfStream::capture( $this->source( $bytes ), sha1( $bytes ), static function () {
		} );
		$capture->close();
		$sink = fopen( 'php://temp', 'w+b' );
		try {
			$this->expectException( \RuntimeException::class );
			$capture->copyTo( $sink );
		} finally {
			$this->assertSame( 0, fstat( $sink )['size'] );
			fclose( $sink );
		}
	}
}
