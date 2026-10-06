<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Rest;

use MediaWiki\Extension\Layers\Revision\PinnedPdfStream;
use MediaWiki\Rest\Stream;

/** Internal native response adapter retaining ownership of the verified resource. */
final class PinnedPdfResponseBody extends Stream {
	private PinnedPdfStream $capture;

	/**
	 * @param resource $stream The capture's already verified handle, never a reopened path
	 * @param PinnedPdfStream $capture Retained through delivery and finally-cleanup
	 */
	public function __construct( $stream, PinnedPdfStream $capture ) {
		$this->capture = $capture;
		parent::__construct( $stream, [ 'size' => $capture->getLength() ] );
	}

	/** Final pre-header authorization, called by the handler's cache-admission phase. */
	public function assertCanDeliver(): void {
		$this->capture->assertCanDeliver();
	}

	/** @inheritDoc */
	public function copyToStream( $target ) {
		try {
			$this->capture->copyTo( $target );
		} finally {
			$this->close();
		}
	}

	/** @inheritDoc */
	public function close(): void {
		$this->capture->close();
		parent::detach();
	}

	/**
	 * Ownership cannot escape the response and bypass capture cleanup.
	 * @return null
	 */
	public function detach() {
		$this->close();
		return null;
	}

	/** @inheritDoc */
	public function write( $string ): int {
		$this->close();
		throw new \RuntimeException( 'PDF response body is read-only' );
	}

	/** Owned captures and response handles must never be duplicated. */
	private function __clone() {
	}
}
