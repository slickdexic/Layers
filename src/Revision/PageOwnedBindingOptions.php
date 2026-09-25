<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/**
 * Pure adapter for extracting a single page-owned binding from ordered option strings.
 *
 * This helper does not split wikitext or perform I/O. All legacy option interpretation
 * remains with the caller when no binding is present.
 */
final class PageOwnedBindingOptions {

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
}
