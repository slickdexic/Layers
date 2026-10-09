<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Extension\Layers\Utility\SetNameResolver;

/**
 * Pure adapter for extracting a single page-owned binding from ordered option strings.
 *
 * This helper does not split wikitext or perform I/O. All legacy option interpretation
 * remains with the caller when no binding is present.
 */
final class PageOwnedBindingOptions {

	/**
	 * @param array $options Ordered scanned file options
	 * @param callable $matchPageOption Native option matcher returning its value, or null when not matched
	 * @return int Effective PDF page, following core's positive-integer validation
	 */
	public static function sourcePage( array $options, callable $matchPageOption ): int {
		$page = 1;
		foreach ( $options as $option ) {
			$value = $matchPageOption( trim( $option ) );
			if ( $value === null ) {
				continue;
			}
			$value = trim( $value );
			if ( $value === (string)(int)$value && (int)$value > 0 ) {
				$page = (int)$value;
			}
		}
		return $page;
	}

	/**
	 * Conflicting legacy selector option names (lowercased).
	 */
	private const LEGACY_SELECTORS = [
		'layerset' => true,
		'layers' => true,
		'layer' => true,
		'layersetid' => true,
	];

	/**
	 * Extract a validated page-owned binding from a list of raw option strings.
	 *
	 * @param array $options Ordered list of option strings separated by the caller
	 * @return array{pageId:int,surfaceId:string}|null
	 * @throws \InvalidArgumentException On invalid options container or invalid/conflicting binding
	 */
	public static function extract( array $options ): ?array {
		if ( !array_is_list( $options ) ) {
			throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
		}

		$bindingCount = 0;
		$bindingValue = null;
		$hasLegacySelector = false;

		foreach ( $options as $option ) {
			if ( !is_string( $option ) ) {
				throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
			}

			$equalsPos = strpos( $option, '=' );
			if ( $equalsPos !== false ) {
				$name = strtolower( trim( substr( $option, 0, $equalsPos ), " \t\r\n\f" ) );
				$value = trim( substr( $option, $equalsPos + 1 ), " \t\r\n\f" );
			} else {
				$name = strtolower( trim( $option, " \t\r\n\f" ) );
				$value = '';
			}

			if ( $name === 'layersbinding' ) {
				$bindingCount++;
				if ( $bindingCount > 1 ) {
					throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
				}
				$bindingValue = $value;
			} elseif ( isset( self::LEGACY_SELECTORS[$name] ) ) {
				$hasLegacySelector = true;
			}
		}

		if ( $bindingCount === 0 ) {
			return null;
		}

		if ( $hasLegacySelector ) {
			throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
		}

		return PageOwnedBinding::parse( $bindingValue );
	}

	/**
	 * The drawing an embed names as `<pageId>:<name>`: a file embed's layerset= (or layers=)
	 * value, or a slide embed's target. With $bareOwner, a bare name is that page's drawing too,
	 * as it is once the migration has finished.
	 *
	 * @param array $options Ordered option strings, as for extract()
	 * @param string $kind 'file' or 'slide'
	 * @param string $target Slide target, or the file title
	 * @param int|null $bareOwner The page carrying the embed, when bare names mean its own drawings
	 * @return array{pageId:int,name:string}|null
	 * @throws \InvalidArgumentException For a malformed or repeated name
	 */
	public static function named( array $options, string $kind, string $target, ?int $bareOwner = null ): ?array {
		if ( $kind === 'slide' ) {
			$named = PageOwnedBinding::parseNamed( $target );
			if ( $named === null && $bareOwner !== null ) {
				$name = DrawingName::normalize( trim( $target ) );
				return $name === null ? null : [ 'pageId' => $bareOwner, 'name' => $name ];
			}
			return $named;
		}
		$found = null;
		$bare = null;
		$selectorCount = 0;
		$defaultIntent = false;
		foreach ( $options as $option ) {
			$equalsPos = strpos( (string)$option, '=' );
			$name = strtolower( trim( $equalsPos === false ? (string)$option :
				substr( $option, 0, $equalsPos ), " \t\r\n\f" ) );
			$selectorCount += isset( self::LEGACY_SELECTORS[$name] ) ? 1 : 0;
			if ( $equalsPos === false || ( $name !== 'layerset' && $name !== 'layers' ) ) {
				continue;
			}
			$defaultIntent = $defaultIntent ||
				strtolower( trim( substr( $option, $equalsPos + 1 ), " \t\r\n\f" ) ) === 'on';
			$named = PageOwnedBinding::parseNamed( substr( $option, $equalsPos + 1 ) );
			if ( $named !== null ) {
				if ( $found !== null ) {
					throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
				}
				$found = $named;
			} else {
				$bare ??= trim( substr( $option, $equalsPos + 1 ), " \t\r\n\f" );
			}
		}
		if ( $kind === 'file' && $bareOwner !== null && $bareOwner > 0 && $bareOwner <= 2147483647 &&
			$defaultIntent
		) {
			if ( $selectorCount !== 1 || self::extract( $options ) !== null ) {
				throw new \InvalidArgumentException( 'layers-invalid-page-binding' );
			}
			return [ 'pageId' => $bareOwner, 'name' => 'Default' ];
		}
		if ( $found === null && $bareOwner !== null && $bare !== null &&
			!SetNameResolver::isGenericIntent( $bare ) && !str_starts_with( $bare, 'id:' )
		) {
			$name = DrawingName::normalize( (string)preg_replace( '/^name:/', '', $bare ) );
			return $name === null ? null : [ 'pageId' => $bareOwner, 'name' => $name ];
		}
		return $found;
	}
}
