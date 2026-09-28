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

	/**
	 * Decode `<pageId>:<name>` as authors write it. Legacy set and slide names cannot contain ':'.
	 *
	 * @param string $value
	 * @return array{pageId:int,name:string}|null Null when $value is not of this form
	 * @throws \InvalidArgumentException For this form with an unusable page ID or name
	 */
	public static function parseNamed( string $value ): ?array {
		if ( !preg_match( '/\A\s*([0-9]+):(.*)\z/sD', $value, $matches ) ) {
			return null;
		}
		$name = DrawingName::normalize( $matches[2] );
		if ( $name === null || !preg_match( '/\A[1-9][0-9]{0,9}\z/D', $matches[1] ) ||
			( strlen( $matches[1] ) === 10 && strcmp( $matches[1], '2147483647' ) > 0 )
		) {
			throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
		}
		return [ 'pageId' => (int)$matches[1], 'name' => $name ];
	}

	/**
	 * @param array{pageId:int,name:string} $named
	 * @param array[] $surfaces The page's drawings, decoded as arrays
	 * @param string|null $kind 'file' or 'slide', the kind of embed; null accepts any drawing
	 * @param string|null $fileTitle For a file embed, 'File:<DB key>'
	 * @return string|null ID of the one drawing with that name that fits the embed
	 */
	public static function resolveNamed( array $named, array $surfaces, ?string $kind, ?string $fileTitle ): ?string {
		$key = DrawingName::key( $named['name'] );
		$found = array_values( array_filter( $surfaces, static function ( $surface ) use ( $key ) {
			return is_string( $surface['label'] ?? null ) && DrawingName::key( $surface['label'] ) === $key;
		} ) );
		if ( count( $found ) !== 1 ) {
			return null;
		}
		$surface = $found[0];
		if ( $kind === null ) {
			return (string)$surface['id'];
		}
		$fits = $kind === 'slide' ? $surface['kind'] === 'slide' :
			in_array( $surface['kind'], [ 'image', 'pdf' ], true ) &&
			( $surface['source']['fileTitle'] ?? null ) === $fileTitle;
		return $fits ? (string)$surface['id'] : null;
	}
}
