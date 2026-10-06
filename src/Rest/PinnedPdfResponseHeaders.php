<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Rest;

use MediaWiki\Rest\ResponseInterface;

/** Shared policy for authorized PDF delivery and endpoint refusals. */
final class PinnedPdfResponseHeaders {
	public const HEADERS = [
		'Cache-Control' => 'private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate',
		'Pragma' => 'no-cache',
		'Expires' => 'Thu, 01 Jan 1970 00:00:00 GMT',
		'X-Content-Type-Options' => 'nosniff'
	];

	/**
	 * Apply after native session handling; conditional validators must not permit reuse.
	 * @param ResponseInterface $response
	 */
	public static function apply( ResponseInterface $response ): void {
		foreach ( self::HEADERS as $name => $value ) {
			$response->setHeader( $name, $value );
		}
		$response->removeHeader( 'ETag' );
		$response->removeHeader( 'Last-Modified' );
	}
}
