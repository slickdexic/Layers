<?php

namespace MediaWiki\Extension\Layers\Cargo;

use CargoGalleryFormat;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;

/**
 * Enhanced Cargo gallery format that honours per-image named layer sets.
 *
 * This class replaces Cargo's built-in 'gallery' format (registered via the
 * CargoSetFormatClasses hook).  Before delegating to CargoGalleryFormat it
 * iterates the query result rows and pre-registers a filename → setname hint
 * for each row that has a non-empty value in the 'layerset' field (or the
 * field named by the 'layerset field' display parameter).
 *
 * Those hints are consumed by WikitextHooks::onThumbnailBeforeProduceHTML
 * for non-wikitext renders, so the correct named set is shown per image
 * instead of always falling back to the latest-set ('layerset=on') semantics.
 *
 * If no 'layerset' field is present in the query the class is a transparent
 * pass-through with identical behaviour to the standard gallery format.
 *
 * Usage (no change required if the query already includes 'layerset'):
 *   {{#cargo_query:...|fields=Image,layerset,...|format=gallery|...}}
 *
 * To use a differently-named set field:
 *   {{#cargo_query:...|fields=Image,setname,...|format=gallery|layerset field=setname|...}}
 */
class CargoLayersGalleryFormat extends CargoGalleryFormat {

	/**
	 * Pre-register layer set hints then delegate to the standard gallery renderer.
	 *
	 * @param array $valuesTable    Raw row values keyed by field name
	 * @param array $formattedValuesTable HTML-formatted values (unused here)
	 * @param array $fieldDescriptions  CargoFieldDescription objects keyed by field name
	 * @param array $displayParams  Display parameters from the #cargo_query call
	 * @return string Gallery HTML
	 */
	public function display( $valuesTable, $formattedValuesTable, $fieldDescriptions, $displayParams ) {
		// Hint registration is best-effort; never break gallery rendering.
		try {
			$this->preRegisterLayerHints( $valuesTable, $fieldDescriptions, $displayParams );
		} catch ( \Exception $e ) {
			// Silently ignore — fall through to standard rendering.
		}

		return parent::display( $valuesTable, $formattedValuesTable, $fieldDescriptions, $displayParams );
	}

	/**
	 * Iterate query rows and call WikitextHooks::registerGalleryHint() for each
	 * row that has both a filename and a layerset value.
	 *
	 * @param array $valuesTable
	 * @param array $fieldDescriptions
	 * @param array $displayParams
	 */
	private function preRegisterLayerHints( array $valuesTable, array $fieldDescriptions, array $displayParams ): void {
		if ( empty( $valuesTable ) ) {
			return;
		}

		// --- Find the File field (mirrors CargoGalleryFormat::getFileTitles logic) ---
		$fileField = null;
		foreach ( $fieldDescriptions as $field => $fieldDesc ) {
			if ( isset( $fieldDesc->mType ) && $fieldDesc->mType === 'File' ) {
				$fileField = $field;
				break;
			}
		}
		// Fall back to _pageName if no File-type field declared (same as Cargo core).
		if ( $fileField === null ) {
			$fileField = '_pageName';
		}

		// --- Find the layerset field ---
		// Explicit override via 'layerset field=foo' display parameter.
		$layersetField = isset( $displayParams['layerset field'] )
			? trim( $displayParams['layerset field'] )
			: 'layerset';

		// Bail out early if the field is not present in the result set.
		$firstRow = reset( $valuesTable );
		if ( !is_array( $firstRow ) || !array_key_exists( $layersetField, $firstRow ) ) {
			return;
		}

		// --- Pre-register one hint per row ---
		foreach ( $valuesTable as $row ) {
			$filename = $row[$fileField] ?? null;
			$setname  = $row[$layersetField] ?? null;
			if ( $filename !== null && $filename !== ''
				&& $setname !== null && $setname !== ''
			) {
				WikitextHooks::registerGalleryHint( $filename, $setname );
			}
		}
	}
}
