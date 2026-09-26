<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Content\Content;

/** Words a reader can see in a page's drawings, for search and Cargo. */
final class PageDrawingSearchText {
	/**
	 * @param Content $content Drawings of one revision
	 * @return string Drawing labels and layer text, one entry per line; empty when unreadable
	 */
	public static function extract( Content $content ): string {
		$lines = [];
		foreach ( self::surfaces( $content ) as $surface ) {
			$lines[] = is_string( $surface['label'] ?? null ) ? $surface['label'] : '';
			$lines[] = self::layerText( $surface );
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
	 * @return string Text of the surface's visible text-bearing layers, one per line
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
