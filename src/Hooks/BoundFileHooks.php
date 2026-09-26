<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Parser\Parser;

/**
 * `[[File:X|layersbinding=v1:<pageId>:<surfaceId>]]` on a pilot owner page.
 * The image keeps core's rendering; it is only marked with the binding and exact revision, and the
 * history module draws the page-owned surface over it after an authorized layersread request.
 * A binding that cannot be admitted shows the plain image, never a shared or latest drawing.
 */
class BoundFileHooks {
	/**
	 * @param Parser $parser Parse of the page that carries the embed
	 * @param string $value Raw option value
	 * @return array|false [ 'binding' => string, 'revisionId' => int ], or false for a refused binding
	 */
	public static function resolve( Parser $parser, string $value ) {
		try {
			[ $binding, $revisionId ] = BoundSlideHooks::register( $parser, PageOwnedBinding::parse( trim( $value ) ) );
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			return false;
		}
		$parser->getOutput()->addModules( [ 'ext.layers.history' ] );
		return [ 'binding' => $binding, 'revisionId' => $revisionId ];
	}

	/**
	 * @param array &$attribs Core image attributes
	 * @param array $bound Result of resolve()
	 */
	public static function markImage( array &$attribs, array $bound ): void {
		$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-bound-file' );
		$attribs['data-layers-binding'] = $bound['binding'];
		$attribs['data-layers-revision'] = (string)$bound['revisionId'];
	}
}
