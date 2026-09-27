<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

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
	 */
	public static function note( Parser $parser, string $kind, string $name, string $set ): void {
		$output = $parser->getOutput();
		$keys = array_map( [ self::class, 'encode' ], self::decode( $output->getPageProperty( self::PROPERTY ) ) );
		$keys[] = self::encode( [ $kind, $name, $set ] );
		$keys = array_values( array_unique( $keys ) );
		// Sorted, so the value does not depend on the order in which embeds are parsed.
		sort( $keys );
		$output->setUnsortedPageProperty( self::PROPERTY,
			'[' . implode( ',', array_slice( $keys, 0, self::MAX_ENTRIES ) ) . ']' );
	}

	/**
	 * @param mixed $value Page property value
	 * @return string[][] [ kind, name, set ] entries; malformed ones are dropped
	 */
	public static function decode( $value ): array {
		$entries = is_string( $value ) ? json_decode( $value, true ) : null;
		return array_values( array_filter( is_array( $entries ) ? $entries : [], static fn ( $entry ) =>
			is_array( $entry ) && count( $entry ) === 3 &&
			in_array( $entry[0] ?? null, [ self::FILE, self::SLIDE ], true ) &&
			is_string( $entry[1] ?? null ) && $entry[1] !== '' && is_string( $entry[2] ?? null ) ) );
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
