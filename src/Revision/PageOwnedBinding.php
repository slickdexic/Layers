<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** Internal binding syntax only. Parsing does not establish existence or authority. */
final class PageOwnedBinding {

	/**
	 * Decode a canonical, case-sensitive version-one binding.
	 * The page ID bound matches the currently supported pilot request range.
	 * Do not trim, decode URLs, lowercase or infer a binding from a set name.
	 *
	 * @param mixed $value
	 * @return array{pageId:int,surfaceId:string}
	 * @throws \InvalidArgumentException On invalid input, without reflecting it
	 */
	public static function parse( $value ): array {
		if ( !is_string( $value ) || strlen( $value ) > 78 ||
			!preg_match( '/\Av1:([1-9][0-9]{0,9}):([A-Za-z0-9_-]{1,64})\z/D', $value, $matches ) ||
			( strlen( $matches[1] ) === 10 && strcmp( $matches[1], '2147483647' ) > 0 )
		) {
			throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
		}
		return [ 'pageId' => (int)$matches[1], 'surfaceId' => $matches[2] ];
	}
}
