<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

/** Refuse resource lookups in inline shapes before passing them to a native converter. */
final class SvgResourceGuard {
	/** @var string[] Attributes whose values use CSS resource syntax. */
	private const CSS_ATTRIBUTES = [ 'style', 'fill', 'stroke', 'filter', 'clip-path', 'mask',
		'cursor', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'color-profile' ];

	/**
	 * Permit internal fragments and embedded raster images, never file/network references.
	 * This supplements the layer validator and also protects older stored SVG at rendering.
	 * @param string $svg Inline SVG document
	 * @param int $maxBytes Trusted caller's existing size boundary; publication keeps 100 KiB
	 * @return bool
	 */
	public static function isSelfContained( string $svg, int $maxBytes = 102400 ): bool {
		if ( strlen( $svg ) > $maxBytes || preg_match( '/<!DOCTYPE|<!ENTITY/i', $svg ) ) {
			return false;
		}
		$document = new \DOMDocument();
		$document->resolveExternals = false;
		$document->substituteEntities = false;
		if ( !$document->loadXML( $svg, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING ) ||
			$document->doctype || !$document->documentElement || $document->documentElement->localName !== 'svg'
		) {
			return false;
		}
		$pending = [ $document ];
		while ( $pending ) {
			$node = array_pop( $pending );
			if ( $node instanceof \DOMProcessingInstruction ) {
				return false;
			}
			if ( $node instanceof \DOMElement ) {
				foreach ( $node->attributes as $attribute ) {
					$name = strtolower( $attribute->localName );
					$value = trim( $attribute->value );
					if ( $name === 'base' && $attribute->namespaceURI === 'http://www.w3.org/XML/1998/namespace' ) {
						return false;
					}
					if ( in_array( $name, [ 'href', 'src' ], true ) && !self::safeReference( $value ) ) {
						return false;
					}
					if ( in_array( $name, self::CSS_ATTRIBUTES, true ) && !self::safeCss( $value ) ) {
						return false;
					}
					if ( $name === 'attributename' && in_array( strtolower( $node->localName ),
						[ 'animate', 'set' ], true ) &&
						in_array( strtolower( substr( $value, strrpos( ':' . $value, ':' ) ) ),
							array_merge( self::CSS_ATTRIBUTES, [ 'href', 'src', 'base' ] ), true )
					) {
						return false;
					}
				}
				// Stylesheet rules can introduce resource lookups outside presentation attributes.
				if ( strtolower( $node->localName ) === 'style' && !self::safeCss( $node->textContent ) ) {
					return false;
				}
			}
			foreach ( $node->childNodes as $child ) {
				$pending[] = $child;
			}
		}
		return true;
	}

	/** @param string $value XML-decoded resource reference @return bool */
	private static function safeReference( string $value ): bool {
		if ( $value === '' || str_starts_with( $value, '#' ) ) {
			return true;
		}
		if ( !preg_match( '#^data:image/(png|jpeg|gif|webp);base64,([a-z0-9+/=\r\n]+)$#i', $value, $match ) ) {
			return false;
		}
		$bytes = base64_decode( $match[2], true );
		// phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Invalid embedded images are refused.
		$info = $bytes !== false ? @getimagesizefromstring( $bytes ) : false;
		return $info && ( $info['mime'] ?? '' ) === 'image/' . strtolower( $match[1] );
	}

	/** @param string $value XML-decoded CSS attribute @return bool */
	private static function safeCss( string $value ): bool {
		$value = preg_replace( '~/\*.*?\*/~s', '', $value );
		$value = preg_replace_callback( '/\\\\(?:([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|(.))/is',
			static function ( array $match ): string {
				if ( ( $match[1] ?? '' ) !== '' ) {
					$point = hexdec( $match[1] );
					return $point > 0 && $point <= 0x10ffff && !( $point >= 0xd800 && $point <= 0xdfff ) ?
						mb_chr( $point, 'UTF-8' ) : "\u{FFFD}";
				}
				return str_contains( "\r\n\f", $match[2] ) ? '' : $match[2];
			}, $value );
		// Remove only complete internal-fragment URL functions, then refuse any remaining lookup.
		$value = preg_replace( '/url\(\s*(?:"#[^"\r\n]*"|\'#[^\'\r\n]*\'|#[^\s)]+)\s*\)/i', '', $value );
		return !preg_match( '/url\s*\(|@import\b/i', $value );
	}
}
