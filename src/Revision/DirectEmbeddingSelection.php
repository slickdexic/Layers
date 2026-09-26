<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;

/** Matches a conservative literal embed to server-captured legacy identity; never authorizes access. */
class DirectEmbeddingSelection {

	/**
	 * Does not prove row freshness or permissions. Callers must provide the exact authorized row.
	 * @param array $candidate Scanner-produced candidate
	 * @param array $legacySelection Server-captured imgName, name and integer page
	 * @param string|null $displayedSetName Server-resolved set a slide without `layerset=` currently shows
	 */
	public static function assertMatches( array $candidate, array $legacySelection,
		?string $displayedSetName = null
	): void {
		$kind = $candidate['kind'] ?? null;
		$target = $candidate['target'] ?? null;
		$options = $candidate['options'] ?? null;
		$name = $legacySelection['name'] ?? null;
		$imgName = $legacySelection['imgName'] ?? null;
		$page = $legacySelection['page'] ?? null;
		if ( !in_array( $kind, [ 'file', 'slide' ], true ) || !is_string( $target ) ||
			!is_array( $options ) || !array_is_list( $options ) || !is_string( $name ) ||
			!is_string( $imgName ) || $imgName === '' || !is_int( $page ) || $page < 1 || $page > 100000
		) {
			self::reject();
		}
		if ( $kind === 'slide' ) {
			if ( !( new SlideNameValidator() )->isValid( $target ) || trim( $target ) !== $target ||
				$imgName !== LayersConstants::SLIDE_PREFIX . $target || $page !== 1
			) {
				self::reject();
			}
		} elseif ( $target !== 'File:' . $imgName ) {
			self::reject();
		}
		$selector = null;
		$embeddingPage = 1;
		$hasPage = false;
		foreach ( $options as $option ) {
			if ( !is_string( $option ) || preg_match( '/[\x00-\x08\x0b\x0e-\x1f\x7f]/', $option ) ) {
				self::reject();
			}
			$parts = explode( '=', $option, 2 );
			$key = strtolower( trim( $parts[0], " \t\r\n\f" ) );
			$value = isset( $parts[1] ) ? trim( $parts[1], " \t\r\n\f" ) : null;
			if ( in_array( $key, [ 'layersbinding', 'layersetid' ], true ) ||
				( $kind === 'slide' && in_array( $key,
					[ 'name', 'layers', 'layer', 'page', 'canvas', 'background' ], true ) )
			) {
				self::reject();
			}
			if ( $key === 'page' ) {
				if ( $hasPage || $value === null || !preg_match( '/\A[1-9][0-9]{0,5}\z/D', $value ) ||
					(int)$value > 100000
				) {
					self::reject();
				}
				$hasPage = true;
				$embeddingPage = (int)$value;
			}
			if ( in_array( $key, [ 'layerset', 'layers', 'layer' ], true ) ) {
				if ( $selector !== null || $value === null || !SetNameSanitizer::isCanonical( $value ) ||
					SetNameResolver::isGenericIntent( $value )
				) {
					self::reject();
				}
				// File rendering paths disagree about case and hexadecimal short-ID names.
				if ( $kind === 'file' && preg_match( '/[A-Z]|\A[0-9a-f]{2,8}\z/D', $value ) ) {
					self::reject();
				}
				$selector = $value;
			}
		}
		// A slide without a selector shows its most recently saved set; files keep explicit selection.
		if ( $selector === null && $kind === 'slide' ) {
			$selector = $displayedSetName;
		}
		if ( $selector === null || $selector !== $name || $embeddingPage !== $page ) {
			self::reject();
		}
	}

	/** @return never */
	private static function reject(): void {
		throw new \InvalidArgumentException( 'layers-embedding-selection-unavailable' );
	}
}
