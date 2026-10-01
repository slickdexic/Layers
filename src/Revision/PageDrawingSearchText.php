<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\Content;

/** Search terms projected from page-owned layer sets. */
final class PageDrawingSearchText {
	/**
	 * @param Content $content Layer sets of one revision
	 * @return string Layer-set labels, visible layer text, and every link target,
	 *   one per line; empty when unreadable
	 */
	public static function extract( Content $content ): string {
		$lines = [];
		foreach ( self::surfaces( $content ) as $surface ) {
			$lines[] = is_string( $surface['label'] ?? null ) ? $surface['label'] : '';
			$lines[] = self::layerText( $surface );
			foreach ( is_array( $surface['layers'] ?? null ) ? $surface['layers'] : [] as $layer ) {
				if ( !is_array( $layer ) || !is_string( $layer['link'] ?? null )
				) {
					continue;
				}
				$lines[] = $layer['link'];
				$normalizedLink = strtr( $layer['link'], [ '_' => ' ', '#' => ' ' ] );
				if ( $normalizedLink !== $layer['link'] ) {
					$lines[] = $normalizedLink;
				}
			}
		}
		return implode( "\n", array_filter( array_map( 'trim', $lines ), 'strlen' ) );
	}

	/**
	 * @param Content $content
	 * @return array[] Decoded surfaces; empty when unreadable
	 */
	public static function surfaces( Content $content ): array {
		try {
			$document = json_decode( $content->serialize(), true, 64, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $e ) {
			return [];
		}
		return is_array( $document['surfaces'] ?? null ) ? array_values( array_filter( $document['surfaces'],
			'is_array' ) ) : [];
	}

	/**
	 * @param array $surface
	 * @return string Visible text from the surface's text-bearing layers, one per line.
	 *   This does not add link targets.
	 */
	public static function layerText( array $surface ): string {
		$lines = [];
		foreach ( is_array( $surface['layers'] ?? null ) ? $surface['layers'] : [] as $layer ) {
			if ( !is_array( $layer ) || ( $layer['visible'] ?? true ) === false ) {
				continue;
			}
			// Rich text replaces the plain text property when present.
			if ( is_array( $layer['richText'] ?? null ) ) {
				$lines[] = implode( '', array_map( static fn ( $run ) =>
					is_string( $run['text'] ?? null ) ? $run['text'] : '', $layer['richText'] ) );
			} elseif ( is_string( $layer['text'] ?? null ) ) {
				$lines[] = $layer['text'];
			}
		}
		return implode( "\n", array_filter( array_map( 'trim', $lines ), 'strlen' ) );
	}
}
