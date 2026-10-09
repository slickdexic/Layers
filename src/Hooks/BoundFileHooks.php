<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Revision\CreationOverlayControls;
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
	 * `[[File:X|layerset=<pageId>:<name>]]`: this page's drawing of that name on file X.
	 * @param Parser $parser Parse of the page that carries the embed
	 * @param string $value Raw layerset= value
	 * @param string $fileKey DB key of the embedded file
	 * @param int|null $sourcePage Effective rendered page
	 * @param string|null $creationToken Private direct-occurrence marker
	 * @return array|false As resolve()
	 */
	public static function resolveNamed( Parser $parser, string $value, string $fileKey,
		?int $sourcePage = null, ?string $creationToken = null
	) {
		try {
			$named = PageOwnedBinding::parseNamed( $value );
			if ( $named === null ) {
				return false;
			}
			[ $binding, $revisionId ] = BoundSlideHooks::register( $parser,
				BoundSlideHooks::named( $parser, $named, 'file', 'File:' . $fileKey, $sourcePage ) );
		} catch ( \DomainException | \InvalidArgumentException $e ) {
			if ( isset( $named ) && $creationToken !== null ) {
				return CreationOverlayControls::missing( $parser, $named, 'image', 'File:' . $fileKey,
					$creationToken );
			}
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
		if ( isset( $bound['creation'] ) ) {
			$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-creation-image' );
			$attribs['data-layers-creation'] = $bound['creation'];
			if ( $bound['noEdit'] ) {
				$attribs['data-layers-noedit'] = '1';
			}
			return;
		}
		$attribs['class'] = trim( ( $attribs['class'] ?? '' ) . ' layers-bound-file' );
		$attribs['data-layers-binding'] = $bound['binding'];
		$attribs['data-layers-revision'] = (string)$bound['revisionId'];
	}
}
