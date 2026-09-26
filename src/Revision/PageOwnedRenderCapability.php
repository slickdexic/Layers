<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

/**
 * Layer content the page-owned historical renderer draws faithfully.
 * Mirrors RENDERABLE_LAYER_TYPES in PageOwnedRevisionRenderer.js (checked by check-parallel-lists.js).
 */
final class PageOwnedRenderCapability {
	public const LAYER_TYPES = [
		'text', 'textbox', 'callout', 'rectangle', 'circle', 'ellipse', 'polygon', 'star',
		'line', 'arrow', 'path', 'dimension', 'angleDimension'
	];

	/**
	 * Hidden layers count too: saving must never make a revision unviewable.
	 * @param \stdClass $surface Structurally validated surface
	 * @return bool
	 */
	public static function isRenderable( \stdClass $surface ): bool {
		foreach ( $surface->layers as $layer ) {
			if ( !in_array( $layer->type ?? null, self::LAYER_TYPES, true ) ||
				isset( $layer->parentGroup ) || isset( $layer->parentId ) ) {
				return false;
			}
		}
		return true;
	}
}
