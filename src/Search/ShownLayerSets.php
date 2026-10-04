<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use InvalidArgumentException;
use MediaWiki\Parser\Parser;

/**
 * Shared layer sets a page shows ([[File:…|layerset=…]] embeds and {{#Slide:}}), recorded while parsing as
 * a page property, so that search can index their text with the page and find the pages a set change affects.
 */
final class ShownLayerSets {
	public const PROPERTY = 'layers-shown-sets';
	public const FILE = 'file';
	public const SLIDE = 'slide';
	/** More are shown but not indexed. */
	private const MAX_ENTRIES = 50;

	/**
	 * @param Parser $parser
	 * @param string $kind self::FILE or self::SLIDE
	 * @param string $name File DB key or slide name
	 * @param string $set Set name; '' for whichever set was saved most recently
	 * @param int $page Internal page selector (must be 1 for slide, >= 1 for file)
	 * @throws InvalidArgumentException If page < 1 or if slide has page != 1
	 */
	public static function note( Parser $parser, string $kind, string $name, string $set, int $page = 1 ): void {
		if ( $page < 1 ) {
			throw new InvalidArgumentException( 'Page must be greater than zero' );
		}
		if ( $kind === self::SLIDE && $page !== 1 ) {
			throw new InvalidArgumentException( 'Slide page must be 1' );
		}

		$output = $parser->getOutput();
		$keys = array_map( [ self::class, 'encode' ], self::decode( $output->getPageProperty( self::PROPERTY ) ) );
		$newEntry = ( $kind === self::FILE && $page > 1 ) ?
			[ $kind, $name, $set, $page ] :
			[ $kind, $name, $set ];
		$keys[] = self::encode( $newEntry );
		$keys = array_values( array_unique( $keys ) );
		// Sorted, so the value does not depend on the order in which embeds are parsed.
		sort( $keys );
		$output->setUnsortedPageProperty( self::PROPERTY,
			'[' . implode( ',', array_slice( $keys, 0, self::MAX_ENTRIES ) ) . ']' );
	}

	/**
	 * @param mixed $value Page property value
	 * @return array[] [ kind, name, set, ?page ] entries; malformed ones are dropped
	 */
	public static function decode( $value ): array {
		$entries = is_string( $value ) ? json_decode( $value, true ) : null;
		if ( !is_array( $entries ) ) {
			return [];
		}

		$result = [];
		foreach ( $entries as $entry ) {
			if ( !is_array( $entry ) || !array_is_list( $entry ) ) {
				continue;
			}
			$count = count( $entry );
			if ( $count !== 3 && $count !== 4 ) {
				continue;
			}
			$kind = $entry[0] ?? null;
			$name = $entry[1] ?? null;
			$set = $entry[2] ?? null;
			if ( !in_array( $kind, [ self::FILE, self::SLIDE ], true ) ||
				!is_string( $name ) || $name === '' ||
				!is_string( $set )
			) {
				continue;
			}
			if ( $count === 3 ) {
				$result[] = [ $kind, $name, $set ];
			} else {
				$page = $entry[3] ?? null;
				if ( $kind !== self::FILE || !is_int( $page ) || $page < 1 ) {
					continue;
				}
				if ( $page === 1 ) {
					$result[] = [ $kind, $name, $set ];
				} else {
					$result[] = [ $kind, $name, $set, $page ];
				}
			}
		}

		return $result;
	}

	/**
	 * @param array $entry A valid decoded entry [ kind, name, set, ?page ]
	 * @return int The fourth field if present and valid, otherwise 1
	 */
	public static function sourcePage( array $entry ): int {
		return ( isset( $entry[3] ) && is_int( $entry[3] ) && $entry[3] > 0 ) ? $entry[3] : 1;
	}

	/**
	 * @param string $kind
	 * @param string $name
	 * @return string Text that the stored property contains wherever it lists any set of this file or slide
	 */
	public static function fragment( string $kind, string $name ): string {
		return substr( self::encode( [ $kind, $name, '' ] ), 0, -3 );
	}

	/**
	 * @param array $entry
	 * @return string
	 */
	private static function encode( array $entry ): string {
		return json_encode( array_values( $entry ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	}
}
