<?php

declare( strict_types=1 );

/**
 * Layer set name resolution.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Utility;

use MediaWiki\Extension\Layers\Database\LayersDatabase;

/**
 * Resolves a caller-supplied layer set reference to a concrete set name.
 *
 * Layer set names are entirely user-defined. There is no reserved name and no
 * name the extension requires to exist: an image whose only set is called
 * "001" must behave exactly like one whose only set is called "default".
 *
 * A caller may supply one of three things:
 *  - a concrete set name, which is used verbatim;
 *  - a generic "show" intent from wikitext (`on`, `true`, `all`, `1`), which
 *    means "show this image's annotations" without naming a set;
 *  - nothing at all.
 *
 * In the latter two cases the set is resolved by recency — the most recently
 * saved set for that image and page wins. `$wgLayersDefaultSetName` is only
 * consulted when naming the very first set for an image, because a row has to
 * be stored under some name; it is never used as a lookup key.
 *
 * @package MediaWiki\Extension\Layers\Utility
 */
class SetNameResolver {

	/**
	 * Wikitext values meaning "show the current annotations", not a set name.
	 */
	private const SHOW_INTENTS = [ 'on', 'true', 'all', '1' ];

	/**
	 * Wikitext values meaning "show no annotations".
	 */
	private const HIDE_INTENTS = [ 'off', 'none', 'false', '0' ];

	/**
	 * Whether a value asks for annotations without naming a set.
	 *
	 * @param string|null $value Raw caller-supplied value
	 * @return bool
	 */
	public static function isShowIntent( ?string $value ): bool {
		return $value !== null
			&& in_array( strtolower( trim( $value ) ), self::SHOW_INTENTS, true );
	}

	/**
	 * Whether a value explicitly suppresses annotations.
	 *
	 * @param string|null $value Raw caller-supplied value
	 * @return bool
	 */
	public static function isHideIntent( ?string $value ): bool {
		return $value !== null
			&& in_array( strtolower( trim( $value ) ), self::HIDE_INTENTS, true );
	}

	/**
	 * Whether a value is a generic intent rather than a set name.
	 *
	 * @param string|null $value Raw caller-supplied value
	 * @return bool
	 */
	public static function isGenericIntent( ?string $value ): bool {
		return self::isShowIntent( $value ) || self::isHideIntent( $value );
	}

	/**
	 * Whether a value names a specific set.
	 *
	 * @param string|null $value Raw caller-supplied value
	 * @return bool
	 */
	public static function isSpecificName( ?string $value ): bool {
		return $value !== null
			&& trim( $value ) !== ''
			&& !self::isGenericIntent( $value );
	}

	/**
	 * Resolve a caller-supplied reference to a concrete stored set name.
	 *
	 * @param LayersDatabase $db Database access
	 * @param string $imgName Image name
	 * @param string $sha1 File SHA-1
	 * @param string|null $requested Caller-supplied set name or generic intent
	 * @param int $page 1-based page number for multi-page files
	 * @return string|null Concrete set name, or null when the image has none
	 */
	public static function resolve(
		LayersDatabase $db,
		string $imgName,
		string $sha1,
		?string $requested,
		int $page = 1
	): ?string {
		if ( self::isHideIntent( $requested ) ) {
			return null;
		}
		if ( self::isSpecificName( $requested ) ) {
			return trim( (string)$requested );
		}
		return self::latestName( $db, $imgName, $sha1, $page );
	}

	/**
	 * Name of the most recently saved set for an image and page.
	 *
	 * @param LayersDatabase $db Database access
	 * @param string $imgName Image name
	 * @param string $sha1 File SHA-1
	 * @param int $page 1-based page number for multi-page files
	 * @return string|null Set name, or null when the image has none
	 */
	public static function latestName(
		LayersDatabase $db,
		string $imgName,
		string $sha1,
		int $page = 1
	): ?string {
		$latest = $db->getLatestLayerSet( $imgName, $sha1, null, $page );
		if ( !$latest ) {
			return null;
		}
		$name = (string)( $latest['setName'] ?? $latest['name'] ?? '' );
		return $name === '' ? null : $name;
	}
}
