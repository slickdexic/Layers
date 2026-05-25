<?php

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Cargo\CargoLayersGalleryFormat;

/**
 * Hook handlers for Cargo integration.
 *
 * Registers an enhanced gallery format that pre-registers per-image layer
 * set hints before Cargo's standard gallery renderer fires.
 */
class CargoHooks {

	/**
	 * CargoSetFormatClasses hook.
	 *
	 * Replaces Cargo's built-in 'gallery' format class with
	 * CargoLayersGalleryFormat. The replacement class is a transparent
	 * subclass that pre-registers layer set hints from any 'layerset' field
	 * in the query result before delegating to the standard gallery renderer.
	 *
	 * Only registered when CargoGalleryFormat is available (i.e. Cargo is
	 * installed), so this is a no-op on wikis without Cargo.
	 *
	 * @param array &$formatClasses Map of format name => class name
	 */
	public static function onCargoSetFormatClasses( array &$formatClasses ): void {
		if ( class_exists( 'CargoGalleryFormat' ) ) {
			$formatClasses['gallery'] = CargoLayersGalleryFormat::class;
		}
	}
}
