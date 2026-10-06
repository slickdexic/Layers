<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/**
 * Verified, request-local PDF capture. No path is reopened when delivering bytes.
 * Owner/revision/source authorization belongs to the caller and must be rechecked
 * after capture, immediately before response admission. Never cache this object.
 */
final class PinnedPdfStream {

	/** @var resource|null */
	private $stream;
	private int $length;
	private ?\Closure $cleanup;

	/**
	 * @param resource $stream Verified readable resource, owned by this object
	 * @param int $length Exact verified byte count
	 * @param \Closure $cleanup Releases the native temporary copy
	 */
	private function __construct( $stream, int $length, \Closure $cleanup ) {
		$this->stream = $stream;
		$this->length = $length;
		$this->cleanup = $cleanup;
	}

	/**
	 * Take ownership of a seekable private capture and verify the same handle later delivered.
	 * The caller converts the admitted MediaWiki base-36 source SHA-1 to 40-digit hex.
	 * @param resource $stream Private immutable copy, never a mutable current-file reference
	 * @param string $expectedSha1Hex Source hash derived from the authorized revision
	 * @param \Closure $cleanup Releases the native copy; runs on refusal and close
	 * @return self
	 * @throws \DomainException Generic unavailable result, without paths or hashes
	 */
	public static function capture( $stream, string $expectedSha1Hex, \Closure $cleanup ): self {
		try {
			if ( gettype( $stream ) !== 'resource' || get_resource_type( $stream ) !== 'stream' ||
				!preg_match( '/^[0-9a-f]{40}$/D', $expectedSha1Hex ) ||
				!stream_get_meta_data( $stream )['seekable'] || !rewind( $stream )
			) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$stat = fstat( $stream );
			if ( !$stat || !is_int( $stat['size'] ) || $stat['size'] < 1 ) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			$hash = hash_init( 'sha1' );
			$count = hash_update_stream( $hash, $stream );
			if ( $count !== $stat['size'] || !hash_equals( $expectedSha1Hex, hash_final( $hash ) ) ||
				!rewind( $stream )
			) {
				throw new \DomainException( 'layers-revision-unavailable' );
			}
			return new self( $stream, $count, $cleanup );
		} catch ( \Throwable $e ) {
			if ( gettype( $stream ) === 'resource' ) {
				fclose( $stream );
			}
			$cleanup();
			throw $e;
		}
	}

	/** @return int Byte count for Content-Length, not a file metadata estimate */
	public function getLength(): int {
		return $this->length;
	}

	/**
	 * Deliver the already verified handle. The caller owns authorization, headers and finally-close.
	 * @param resource $target Writable response body or test sink
	 * @throws \RuntimeException If closed, unreadable or not completely delivered
	 */
	public function copyTo( $target ): void {
		if ( gettype( $target ) !== 'resource' || get_resource_type( $target ) !== 'stream' ||
			gettype( $this->stream ) !== 'resource' || !rewind( $this->stream ) ||
			stream_copy_to_stream( $this->stream, $target, $this->length ) !== $this->length
		) {
			throw new \RuntimeException( 'Incomplete PDF delivery' );
		}
	}

	/** Release the handle before its temporary copy; safe to call more than once. */
	public function close(): void {
		if ( gettype( $this->stream ) === 'resource' ) {
			fclose( $this->stream );
		}
		$this->stream = null;
		$cleanup = $this->cleanup;
		$this->cleanup = null;
		if ( $cleanup ) {
			$cleanup();
		}
	}

	/** Owned handles must never be duplicated. */
	private function __clone() {
	}

	/** Release an abandoned capture; explicit caller cleanup remains required. */
	public function __destruct() {
		$this->close();
	}
}
