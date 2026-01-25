/**
 * LayersConstants Module for Layers Editor
 * Defines shared constants to eliminate magic strings and numbers throughout the codebase
 */
( function () {
	'use strict';

	/**
	 * LayersConstants - Central registry of constants used throughout the editor
	 * @namespace
	 */
	const LayersConstants = {

		// Tool names
		TOOLS: {
			POINTER: 'pointer',
			TEXT: 'text',
			TEXTBOX: 'textbox',
			RECTANGLE: 'rectangle',
			CIRCLE: 'circle',
			ELLIPSE: 'ellipse',
			LINE: 'line',
			ARROW: 'arrow',
			POLYGON: 'polygon',
			STAR: 'star',
			PATH: 'path'
		},

		// Layer types
		LAYER_TYPES: {
			TEXT: 'text',
			TEXTBOX: 'textbox',
			RECTANGLE: 'rectangle',
			CIRCLE: 'circle',
			ELLIPSE: 'ellipse',
			LINE: 'line',
			ARROW: 'arrow',
			POLYGON: 'polygon',
			STAR: 'star',
			PATH: 'path'
		},

		// Selection handle types
		HANDLE_TYPES: {
			NORTHWEST: 'nw',
			NORTH: 'n',
			NORTHEAST: 'ne',
			EAST: 'e',
			SOUTHEAST: 'se',
			SOUTH: 's',
			SOUTHWEST: 'sw',
			WEST: 'w',
			ROTATE: 'rotate'
		},

		// Default layer properties
		DEFAULTS: {
			LAYER: {
				OPACITY: 1.0,
				FILL_OPACITY: 1.0,
				STROKE_OPACITY: 1.0,
				STROKE_WIDTH: 2,
				FONT_SIZE: 16,
				FONT_FAMILY: 'Arial, sans-serif',
				VISIBLE: true,
				LOCKED: false,
				ROTATION: 0
			},
			COLORS: {
				STROKE: '#000000',
				FILL: '#ffffff',
				TEXT: '#000000',
				SHADOW: '#000000'
			},
			SIZES: {
				RECTANGLE_WIDTH: 100,
				RECTANGLE_HEIGHT: 60,
				CIRCLE_RADIUS: 50,
				LINE_LENGTH: 100,
				ARROW_SIZE: 10,
				STAR_POINTS: 5,
				SELECTION_HANDLE_SIZE: 8,
				SELECTION_HANDLE_SIZE_TOUCH: 14,
				ROTATION_HANDLE_DISTANCE: 25,
				MARKER_SIZE: 24
			},
			EFFECTS: {
				BLUR_RADIUS: 12,
				BLUR_MIN: 1,
				BLUR_MAX: 64
			}
		},

		// Mathematical constants - references MathUtils.MATH for single source of truth
		// These are re-exported here for convenience and backward compatibility
		MATH: {
			/** Epsilon for canvas scale operations (prevent divide-by-zero) */
			get SCALE_EPSILON() {
				return ( window.Layers && window.Layers.MathUtils && window.Layers.MathUtils.MATH ) ?
					window.Layers.MathUtils.MATH.SCALE_EPSILON : 0.0001;
			},
			/** Epsilon for integer detection (is-integer checks) */
			get INTEGER_EPSILON() {
				return ( window.Layers && window.Layers.MathUtils && window.Layers.MathUtils.MATH ) ?
					window.Layers.MathUtils.MATH.INTEGER_EPSILON : 1e-9;
			}
		},

		// Canvas and UI constants
		UI: {
			GRID_SIZE: 20,
			RULER_SIZE: 30,
			SNAP_DISTANCE: 10,
			ZOOM_STEP: 0.2,
			MIN_ZOOM: 0.1,
			MAX_ZOOM: 5.0,
			ANIMATION_DURATION: 300,
			DIRTY_REGION_PADDING: 4,
			HANDLE_PADDING: 5,
			// Offsets for layer operations
			PASTE_OFFSET: 20,
			DUPLICATE_OFFSET: 20,
			// Default canvas dimensions
			DEFAULT_CANVAS_WIDTH: 800,
			DEFAULT_CANVAS_HEIGHT: 600
		},

		/**
		 * Z-index layering for UI elements.
		 * Organized into tiers to ensure proper stacking:
		 * - Tier 1 (1-100): Canvas-internal elements
		 * - Tier 2 (1000-1999): Canvas overlays, tooltips
		 * - Tier 3 (10000-10999): Editor chrome, panels
		 * - Tier 4 (100000-999999): Modal dialogs
		 * - Tier 5 (1000000+): Popups above modals (color picker, library panels)
		 */
		Z_INDEX: {
			// Tier 1: Canvas-internal stacking
			CANVAS_BACKGROUND: 1,
			CANVAS_FOREGROUND: 2,
			SLIDE_CONTROLS: 10,

			// Tier 2: Canvas overlays
			CANVAS_OVERLAY: 1000,
			TEXT_INPUT: 1001,
			LIGHTBOX_CONTROLS: 1001,

			// Tier 3: Editor chrome
			EDITOR_BASE: 10000,
			CONTEXT_MENU: 10000,
			LAYER_PANEL: 10001,
			INLINE_TEXT_EDITOR: 10002,

			// Tier 4: Modal layer
			MODAL_OVERLAY: 100000,
			EDITOR_FULLSCREEN: 999999,

			// Tier 5: Above-modal popups (must be above fullscreen editor)
			COLOR_PICKER: 1000000,
			COLOR_PICKER_CONTENT: 1000001,
			TEXT_INPUT_MODAL: 1000002,
			LIBRARY_PANEL: 1000010,
			LIBRARY_OVERLAY: 1000011
		},

		// Colors for UI elements
		UI_COLORS: {
			SELECTION_OUTLINE: '#007cba',
			SELECTION_HANDLE_FILL: '#ffffff',
			SELECTION_HANDLE_STROKE: '#007cba',
			GRID_COLOR: '#e0e0e0',
			RULER_BACKGROUND: '#f5f5f5',
			RULER_TEXT: '#666666',
			GUIDE_COLOR: '#ff6b35',
			ERROR_COLOR: '#ff0000'
		},

		// Blend modes
		BLEND_MODES: {
			NORMAL: 'source-over',
			MULTIPLY: 'multiply',
			SCREEN: 'screen',
			OVERLAY: 'overlay',
			DARKEN: 'darken',
			LIGHTEN: 'lighten',
			COLOR_DODGE: 'color-dodge',
			COLOR_BURN: 'color-burn',
			HARD_LIGHT: 'hard-light',
			SOFT_LIGHT: 'soft-light',
			DIFFERENCE: 'difference',
			EXCLUSION: 'exclusion',
			BLUR: 'blur'
		},

		// Line styles
		LINE_STYLES: {
			SOLID: 'solid',
			DASHED: 'dashed',
			DOTTED: 'dotted'
		},

		// Arrow head types
		ARROW_HEADS: {
			NONE: 'none',
			ARROW: 'arrow',
			CIRCLE: 'circle',
			DIAMOND: 'diamond',
			TRIANGLE: 'triangle'
		},

		// Text alignment options
		TEXT_ALIGN: {
			LEFT: 'left',
			CENTER: 'center',
			RIGHT: 'right'
		},

		// Text baseline options
		TEXT_BASELINE: {
			TOP: 'top',
			MIDDLE: 'middle',
			BOTTOM: 'bottom',
			ALPHABETIC: 'alphabetic'
		},

		// Cursor types
		CURSORS: {
			DEFAULT: 'default',
			POINTER: 'pointer',
			MOVE: 'move',
			CROSSHAIR: 'crosshair',
			TEXT: 'text',
			GRAB: 'grab',
			GRABBING: 'grabbing',
			RESIZE_NW: 'nw-resize',
			RESIZE_NE: 'ne-resize',
			RESIZE_NS: 'ns-resize',
			RESIZE_EW: 'ew-resize'
		},

		// Event types
		EVENTS: {
			LAYER_SELECTED: 'layerSelected',
			LAYER_DESELECTED: 'layerDeselected',
			LAYER_ADDED: 'layerAdded',
			LAYER_REMOVED: 'layerRemoved',
			LAYER_MODIFIED: 'layerModified',
			TOOL_CHANGED: 'toolChanged',
			ZOOM_CHANGED: 'zoomChanged',
			PAN_CHANGED: 'panChanged',
			SELECTION_CHANGED: 'selectionChanged'
		},

		// Key codes for keyboard handling
		KEY_CODES: {
			ESCAPE: 27,
			SPACE: 32,
			ARROW_LEFT: 37,
			ARROW_UP: 38,
			ARROW_RIGHT: 39,
			ARROW_DOWN: 40,
			DELETE: 46,
			BACKSPACE: 8,
			ENTER: 13,
			TAB: 9,
			SHIFT: 16,
			CTRL: 17,
			ALT: 18
		},

		// Key names for modern key event handling
		KEYS: {
			ESCAPE: 'Escape',
			SPACE: ' ',
			ARROW_LEFT: 'ArrowLeft',
			ARROW_UP: 'ArrowUp',
			ARROW_RIGHT: 'ArrowRight',
			ARROW_DOWN: 'ArrowDown',
			DELETE: 'Delete',
			BACKSPACE: 'Backspace',
			ENTER: 'Enter',
			TAB: 'Tab',
			SHIFT: 'Shift',
			CONTROL: 'Control',
			ALT: 'Alt'
		},

		// Error messages (keys for i18n)
		ERROR_MESSAGES: {
			LAYER_NOT_FOUND: 'layers-error-layer-not-found',
			INVALID_TOOL: 'layers-error-invalid-tool',
			CANVAS_NOT_AVAILABLE: 'layers-error-canvas-not-available',
			SAVE_FAILED: 'layers-error-save-failed',
			LOAD_FAILED: 'layers-error-load-failed',
			INVALID_DATA: 'layers-error-invalid-data',
			PERMISSION_DENIED: 'layers-error-permission-denied'
		},

		// Status messages (keys for i18n)
		STATUS_MESSAGES: {
			READY: 'layers-status-ready',
			LOADING: 'layers-status-loading',
			SAVING: 'layers-status-saving',
			SAVED: 'layers-status-saved',
			MODIFIED: 'layers-status-modified',
			ERROR: 'layers-status-error'
		},

		// Action messages (keys for i18n)
		ACTION_MESSAGES: {
			LAYER_CREATED: 'layers-action-layer-created',
			LAYER_DELETED: 'layers-action-layer-deleted',
			LAYER_DUPLICATED: 'layers-action-layer-duplicated',
			LAYERS_CLEARED: 'layers-action-layers-cleared',
			ZOOM_RESET: 'layers-action-zoom-reset',
			SELECTION_CLEARED: 'layers-action-selection-cleared'
		},

		// Performance limits
		LIMITS: {
			MAX_LAYERS: 100,
			MAX_POINTS_PER_PATH: 1000,
			MAX_HISTORY_STEPS: 50,
			MAX_CANVAS_POOL_SIZE: 5,
			REDRAW_THROTTLE_MS: 16, // ~60fps
			TRANSFORM_THROTTLE_MS: 16,
			MAX_ZOOM_STEPS_PER_WHEEL: 3,
			MIN_POLYGON_SIDES: 3,
			MAX_POLYGON_SIDES: 20,
			MIN_STAR_POINTS: 3,
			MAX_STAR_POINTS: 20
		},

		// Timing constants for delays and timeouts
		TIMING: {
			IMAGE_LOAD_TIMEOUT: 5000, // Timeout for background image loading
			BOOTSTRAP_RETRY_DELAY: 50, // Delay between bootstrap retries
			HOOK_LISTENER_DELAY: 50, // Delay for hook listener retry
			DEPENDENCY_WAIT_DELAY: 100, // Delay waiting for dependencies
			API_RETRY_DELAY: 1000, // Delay between API retry attempts
			DEBOUNCE_DEFAULT: 150, // Default debounce delay
			NOTIFICATION_DURATION: 5000, // How long notifications show
			ANIMATION_DURATION: 300, // CSS transition duration
			SAVE_BUTTON_DISABLE_DELAY: 2000 // Re-enable save button delay
		},

		// File and data constants
		DATA: {
			SCHEMA_VERSION: 1,
			MAX_FILENAME_LENGTH: 255,
			SUPPORTED_IMAGE_FORMATS: [ 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg' ],
			DEFAULT_EXPORT_FORMAT: 'png',
			DEFAULT_EXPORT_QUALITY: 0.9
		},

		// Validation patterns
		VALIDATION: {
			COLOR_HEX: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
			COLOR_RGB: /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
			COLOR_RGBA: /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/,
			FONT_FAMILY: /^[a-zA-Z\s\-,'"]+$/,
			LAYER_ID: /^[a-zA-Z0-9\-_]+$/
		}
	};

	// Freeze the constants to prevent modification
	if ( typeof Object.freeze === 'function' ) {
		Object.freeze( LayersConstants.TOOLS );
		Object.freeze( LayersConstants.LAYER_TYPES );
		Object.freeze( LayersConstants.HANDLE_TYPES );
		Object.freeze( LayersConstants.DEFAULTS.LAYER );
		Object.freeze( LayersConstants.DEFAULTS.COLORS );
		Object.freeze( LayersConstants.DEFAULTS.SIZES );
		Object.freeze( LayersConstants.DEFAULTS );
		Object.freeze( LayersConstants.UI );
		Object.freeze( LayersConstants.Z_INDEX );
		Object.freeze( LayersConstants.UI_COLORS );
		Object.freeze( LayersConstants.BLEND_MODES );
		Object.freeze( LayersConstants.LINE_STYLES );
		Object.freeze( LayersConstants.ARROW_HEADS );
		Object.freeze( LayersConstants.TEXT_ALIGN );
		Object.freeze( LayersConstants.TEXT_BASELINE );
		Object.freeze( LayersConstants.CURSORS );
		Object.freeze( LayersConstants.EVENTS );
		Object.freeze( LayersConstants.KEY_CODES );
		Object.freeze( LayersConstants.KEYS );
		Object.freeze( LayersConstants.ERROR_MESSAGES );
		Object.freeze( LayersConstants.STATUS_MESSAGES );
		Object.freeze( LayersConstants.ACTION_MESSAGES );
		Object.freeze( LayersConstants.LIMITS );
		Object.freeze( LayersConstants.TIMING );
		Object.freeze( LayersConstants.DATA );
		Object.freeze( LayersConstants.VALIDATION );
		Object.freeze( LayersConstants );
	}

	// Export the module - ALWAYS set on window for browser compatibility
	// ResourceLoader and other bundlers may define `module`, but we need window.* for
	// cross-file dependencies within the same ResourceLoader module
	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Constants = LayersConstants;
	}

	// Also export via CommonJS if available (for Node.js/Jest testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayersConstants;
	}

}() );
