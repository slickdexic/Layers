<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Utility;

use Wikimedia\AtEase\AtEase;

/**
 * Publish a generated PDF only after its private temporary file is complete.
 */
final class AtomicPdfCache {
	/**
	 * @param string $target Final cache path
	 * @param callable $render Receives the temporary path and returns true on successful conversion
	 * @return bool
	 */
	public static function publish( string $target, callable $render ): bool {
		$targetDir = realpath( dirname( $target ) );
		if ( $targetDir === false ) {
			return false;
		}
		$temporary = AtEase::quietCall( 'tempnam', $targetDir, '.layers-pdf-' );
		if ( $temporary === false || realpath( dirname( $temporary ) ) !== $targetDir ) {
			if ( $temporary !== false ) {
				AtEase::quietCall( 'unlink', $temporary );
			}
			return false;
		}
		try {
			if ( !$render( $temporary ) || !self::isCompletePdf( $temporary ) ) {
				return false;
			}
			return AtEase::quietCall( 'rename', $temporary, $target );
		} finally {
			if ( is_file( $temporary ) ) {
				AtEase::quietCall( 'unlink', $temporary );
			}
		}
	}

	/** @param string $path @return bool */
	private static function isCompletePdf( string $path ): bool {
		$file = AtEase::quietCall( 'fopen', $path, 'rb' );
		if ( !$file ) {
			return false;
		}
		try {
			if ( fread( $file, 5 ) !== '%PDF-' || fseek( $file, 0, SEEK_END ) !== 0 ) {
				return false;
			}
			$size = ftell( $file );
			if ( $size === false || fseek( $file, max( 0, $size - 1024 ) ) !== 0 ) {
				return false;
			}
			$tail = stream_get_contents( $file );
			return is_string( $tail ) && preg_match( '/%%EOF\s*$/', $tail ) === 1;
		} finally {
			fclose( $file );
		}
	}
}
