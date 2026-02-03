/**
 * Layer Defaults - Central constants for default layer values
 *
 * This module provides a single source of truth for commonly used
 * default values across the Layers extension. Using these constants
 * instead of magic numbers improves maintainability and consistency.
 *
 * @module LayerDefaults
 */
( function () {
	'use strict';

	/**
	 * Default values for layer properties
	 *
	 * @namespace LayerDefaults
	 */
	const LayerDefaults = {
		// ====================================================================
		// Text Defaults
		// ====================================================================

		/**
		 * Default font size in pixels
		 *
		 * @type {number}
		 */
		FONT_SIZE: 16,

		/**
		 * Default font family
		 *
		 * @type {string}
		 */
		FONT_FAMILY: 'Arial, sans-serif',

		// ====================================================================
		// Stroke Defaults
		// ====================================================================

		/**
		 * Default stroke width in pixels
		 *
		 * @type {number}
		 */
		STROKE_WIDTH: 2,

		/**
		 * Default stroke color (black)
		 *
		 * @type {string}
		 */
		STROKE_COLOR: '#000000',

		/**
		 * Maximum stroke width allowed
		 *
		 * @type {number}
		 */
		MAX_STROKE_WIDTH: 50,

		// ====================================================================
		// Opacity Defaults
		// ====================================================================

		/**
		 * Default opacity (fully opaque)
		 *
		 * @type {number}
		 */
		OPACITY: 1,

		/**
		 * Default fill opacity
		 *
		 * @type {number}
		 */
		FILL_OPACITY: 1,

		// ====================================================================
		// Shadow Defaults
		// ====================================================================

		/**
		 * Default shadow blur radius
		 *
		 * @type {number}
		 */
		SHADOW_BLUR: 8,

		/**
		 * Maximum shadow blur radius
		 *
		 * @type {number}
		 */
		MAX_SHADOW_BLUR: 64,

		/**
		 * Default shadow offset X
		 *
		 * @type {number}
		 */
		SHADOW_OFFSET_X: 2,

		/**
		 * Default shadow offset Y
		 *
		 * @type {number}
		 */
		SHADOW_OFFSET_Y: 2,

		/**
		 * Default shadow color
		 *
		 * @type {string}
		 */
		SHADOW_COLOR: '#000000',

		/**
		 * Maximum shadow spread
		 *
		 * @type {number}
		 */
		MAX_SHADOW_SPREAD: 50,

		/**
		 * Maximum text shadow blur
		 *
		 * @type {number}
		 */
		MAX_TEXT_SHADOW_BLUR: 50,

		// ====================================================================
		// Slide Dimension Limits
		// ====================================================================

		/**
		 * Minimum slide dimension (width or height) in pixels
		 *
		 * @type {number}
		 */
		MIN_SLIDE_DIMENSION: 50,

		/**
		 * Maximum slide dimension (width or height) in pixels
		 *
		 * @type {number}
		 */
		MAX_SLIDE_DIMENSION: 4096,

		// ====================================================================
		// Cache and History Limits
		// ====================================================================

		/**
		 * Maximum history size (undo/redo steps)
		 *
		 * @type {number}
		 */
		MAX_HISTORY_SIZE: 50,

		/**
		 * Maximum image cache entries
		 *
		 * @type {number}
		 */
		MAX_IMAGE_CACHE_SIZE: 50,

		// ====================================================================
		// Text Length Limits
		// ====================================================================

		/**
		 * Maximum single-line text length
		 *
		 * @type {number}
		 */
		MAX_TEXT_LENGTH: 1000,

		/**
		 * Maximum multi-line text length (textarea)
		 *
		 * @type {number}
		 */
		MAX_TEXTAREA_LENGTH: 5000,

		// ====================================================================
		// Default Colors
		// ====================================================================

		/**
		 * Default fill color (transparent)
		 *
		 * @type {string}
		 */
		FILL_COLOR: 'transparent',

		/**
		 * Default text stroke color
		 *
		 * @type {string}
		 */
		TEXT_STROKE_COLOR: '#000000',

		// ====================================================================
		// Animation/Timing
		// ====================================================================

		/**
		 * Frame interval for ~60fps animations (milliseconds)
		 *
		 * @type {number}
		 */
		FRAME_INTERVAL_60FPS: 16,

		/**
		 * Debounce delay for auto-save (milliseconds)
		 *
		 * @type {number}
		 */
		AUTO_SAVE_DEBOUNCE: 2000
	};

	// Freeze to prevent accidental modification
	Object.freeze( LayerDefaults );

	// Export to mw.ext.layers namespace
	mw.ext = mw.ext || {};
	mw.ext.layers = mw.ext.layers || {};
	mw.ext.layers.LayerDefaults = LayerDefaults;

}() );
