<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/** A layer-set name, compared within its owning page and file/slide namespace. */
final class DrawingName {
	public const MAX_LENGTH = 255;

	/**
	 * @param string $name
	 * @return string|null The name with spacing tidied, or null if it cannot be a drawing name
	 */
	public static function normalize( string $name ): ?string {
		$name = trim( preg_replace( '/\s+/u', ' ', $name ) ?? '' );
		if ( $name === '' || mb_strlen( $name ) > self::MAX_LENGTH ||
			preg_match( '/[\x00-\x1f\x7f|\[\]{}<>:]/u', $name ) ) {
			return null;
		}
		return $name;
	}

	/**
	 * Names that differ only in case, spacing or underscores are the same name.
	 * @param string $name
	 * @return string
	 */
	public static function key( string $name ): string {
		return mb_strtolower( trim( preg_replace( '/[\s_]+/u', ' ', $name ) ?? '' ) );
	}

	/**
	 * @param string $name A valid name
	 * @param string[] $taken Names in the caller's allocation scope
	 * @return string $name, or $name with the first free number appended
	 */
	public static function unused( string $name, array $taken ): string {
		$keys = array_flip( array_map( [ self::class, 'key' ], $taken ) );
		$candidate = $name;
		for ( $n = 2; isset( $keys[self::key( $candidate )] ); $n++ ) {
			$suffix = ' ' . $n;
			$candidate = rtrim( mb_substr( $name, 0, self::MAX_LENGTH - strlen( $suffix ) ) ) . $suffix;
		}
		return $candidate;
	}

	/**
	 * Unchanged drawings were admitted under the rules of their day and are not rechecked.
	 * @param \stdClass[] $surfaces The page's complete proposed drawings
	 * @param string[] $changed IDs of new or changed drawings
	 * @throws PublicationException
	 */
	public static function assertPublishable( array $surfaces, array $changed ): void {
		$uses = [];
		$labels = [];
		foreach ( $surfaces as $surface ) {
			$key = LayerSetIdentity::surfaceKey( $surface );
			$uses[$key] = ( $uses[$key] ?? 0 ) + 1;
			$labels[LayerSetIdentity::key( $surface )][(string)$surface->label] = true;
		}
		foreach ( $surfaces as $surface ) {
			if ( !in_array( $surface->id, $changed, true ) ) {
				continue;
			}
			$label = (string)$surface->label;
			if ( self::normalize( $label ) !== $label ) {
				throw PublicationException::refusedName( $label, false );
			}
			if ( $uses[LayerSetIdentity::surfaceKey( $surface )] > 1 ||
				count( $labels[LayerSetIdentity::key( $surface )] ) > 1 ) {
				throw PublicationException::refusedName( $label, true );
			}
		}
	}
}
