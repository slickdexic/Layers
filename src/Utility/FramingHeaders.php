<?php
/**
 * @file
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Utility;

/**
 * Clickjacking headers for the editor's modal (iframe) mode.
 *
 * MediaWiki sends `X-Frame-Options: DENY` on pages that accept input. The editor
 * is deliberately opened in a same-origin iframe from File pages and articles, so
 * that default has to be relaxed to SAMEORIGIN for modal mode only.
 *
 * `X-Frame-Options` is obsolete and is ignored entirely by browsers that
 * understand a `frame-ancestors` directive, so relaxing only the former would
 * leave the page framed according to whatever CSP the wiki happens to send —
 * which for most wikis is nothing at all. Both headers are therefore emitted:
 * `frame-ancestors 'self'` for current browsers and `SAMEORIGIN` for old ones.
 */
class FramingHeaders {

	/**
	 * Allow the current response to be framed by this wiki, and only this wiki.
	 *
	 * @param mixed $out OutputPage for the current request
	 * @param \WebResponse $response Response to write headers to
	 * @return void
	 */
	public static function allowSameOriginFraming( $out, $response ): void {
		// Suppress MediaWiki's default X-Frame-Options: DENY.
		// setPreventClickjacking() was added in 1.38; allowClickjacking() was
		// removed in 1.44. Guard both so the editor does not fatal mid-upgrade.
		if ( method_exists( $out, 'setPreventClickjacking' ) ) {
			$out->setPreventClickjacking( false );
		} elseif ( method_exists( $out, 'allowClickjacking' ) ) {
			$out->allowClickjacking();
		}

		// Legacy header for browsers with no frame-ancestors support.
		$response->header( 'X-Frame-Options: SAMEORIGIN' );

		// Authoritative directive for every current browser. Sent as a separate
		// Content-Security-Policy header so it intersects with, rather than
		// replaces, any policy the wiki already sends: CSP is enforced as the
		// conjunction of all policies present, so an additional header can only
		// ever tighten the result.
		$response->header( "Content-Security-Policy: frame-ancestors 'self'", false );
	}
}
