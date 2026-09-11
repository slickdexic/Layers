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
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;

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
	 * Whether a raw caller-supplied value provides an explicit set name.
	 *
	 * Unlike wikitext display attributes (where "on", "off", "1", etc. represent
	 * display directives evaluated by isSpecificName()), API callers may explicitly
	 * specify any valid layer set name, including literal names like "on", "off",
	 * "all", "true", "false", "1", or "0".
	 *
	 * Presence is separate from validity: malformed input must not select latest.
	 *
	 * @param string|null $value Raw caller-supplied value
	 * @return bool True if an explicit set name was provided
	 */
	public static function hasExplicitName( ?string $value ): bool {
		return $value !== null && $value !== '';
	}

	/**
	 * Resolve an explicit set name supplied to API endpoints.
	 *
	 * If an explicit name is provided, it is validated and returned literally without
	 * being intercepted by wikitext display-intent checks (such as "on", "off", "1", etc.).
	 *
	 * If no explicit name is provided (null or empty), recency
	 * resolution is used to find the latest existing set name for the target image
	 * and page. If no set exists yet, $fallbackDefault or the configured seed name is used.
	 *
	 * @param LayersDatabase $db Database access
	 * @param string $imgName Image or slide DB key
	 * @param string $sha1 File SHA-1 or slide type
	 * @param string|null $requested Caller-supplied explicit set name
	 * @param int $page 1-based page number for multi-page files
	 * @param string|null $fallbackDefault Seed name when no set exists yet
	 * @return string Concrete sanitized set name
	 */
	public static function resolveExplicit(
		LayersDatabase $db,
		string $imgName,
		string $sha1,
		?string $requested,
		int $page = 1,
		?string $fallbackDefault = null
	): string {
		if ( self::hasExplicitName( $requested ) ) {
			if ( !SetNameSanitizer::isCanonical( $requested ) ) {
				throw new \InvalidArgumentException( 'Invalid explicit set name' );
			}
			return $requested;
		}
		return self::latestName( $db, $imgName, $sha1, $page )
			?? $fallbackDefault
			?? SetNameSanitizer::getDefaultName();
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
	 * Resolve a set name for a whole multi-page document.
	 *
	 * Sets are stored per page, so resolving against page 1 alone produced an
	 * empty name — and therefore an unannotated export — whenever page 1 had no
	 * layers, which is the normal state of a cover page. Scans forward to the
	 * first page that actually has a set.
	 *
	 * @param LayersDatabase $db Database access
	 * @param string $imgName Image name
	 * @param string $sha1 File SHA-1
	 * @param string|null $requested Caller-supplied set reference
	 * @param int $pageCount Total pages in the file
	 * @return string|null Set name, or null when no page has one
	 */
	public static function resolveAcrossPages(
		LayersDatabase $db,
		string $imgName,
		string $sha1,
		?string $requested,
		int $pageCount
	): ?string {
		if ( self::isHideIntent( $requested ) ) {
			return null;
		}
		if ( self::isSpecificName( $requested ) ) {
			return trim( (string)$requested );
		}
		$pageCount = max( 1, $pageCount );
		for ( $page = 1; $page <= $pageCount; $page++ ) {
			$name = self::latestName( $db, $imgName, $sha1, $page );
			if ( $name !== null ) {
				return $name;
			}
		}
		return null;
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
