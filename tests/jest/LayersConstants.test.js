/**
 * @jest-environment jsdom
 */

/**
 * Tests for LayersConstants module
 * Validates that constants are properly defined and accessible
 */

require( '../../resources/ext.layers.editor/LayersConstants.js' );

describe( 'LayersConstants', () => {
	const LayersConstants = window.Layers.Constants;

	describe( 'module exports', () => {
		it( 'should export LayersConstants to window.Layers.Constants', () => {
			expect( window.Layers.Constants ).toBe( LayersConstants );
		} );
	} );

	describe( 'TOOLS', () => {
		it( 'should define all tool types', () => {
			expect( LayersConstants.TOOLS.POINTER ).toBe( 'pointer' );
			expect( LayersConstants.TOOLS.TEXT ).toBe( 'text' );
			expect( LayersConstants.TOOLS.RECTANGLE ).toBe( 'rectangle' );
			expect( LayersConstants.TOOLS.CIRCLE ).toBe( 'circle' );
			expect( LayersConstants.TOOLS.ELLIPSE ).toBe( 'ellipse' );
			expect( LayersConstants.TOOLS.LINE ).toBe( 'line' );
			expect( LayersConstants.TOOLS.ARROW ).toBe( 'arrow' );
			expect( LayersConstants.TOOLS.POLYGON ).toBe( 'polygon' );
			expect( LayersConstants.TOOLS.STAR ).toBe( 'star' );
			expect( LayersConstants.TOOLS.PATH ).toBe( 'path' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.TOOLS ) ).toBe( true );
		} );
	} );

	describe( 'LAYER_TYPES', () => {
		it( 'should define all layer types', () => {
			expect( LayersConstants.LAYER_TYPES.TEXT ).toBe( 'text' );
			expect( LayersConstants.LAYER_TYPES.RECTANGLE ).toBe( 'rectangle' );
			expect( LayersConstants.LAYER_TYPES.CIRCLE ).toBe( 'circle' );
			expect( LayersConstants.LAYER_TYPES.ELLIPSE ).toBe( 'ellipse' );
			expect( LayersConstants.LAYER_TYPES.LINE ).toBe( 'line' );
			expect( LayersConstants.LAYER_TYPES.ARROW ).toBe( 'arrow' );
			expect( LayersConstants.LAYER_TYPES.POLYGON ).toBe( 'polygon' );
			expect( LayersConstants.LAYER_TYPES.STAR ).toBe( 'star' );
			expect( LayersConstants.LAYER_TYPES.PATH ).toBe( 'path' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.LAYER_TYPES ) ).toBe( true );
		} );
	} );

	describe( 'HANDLE_TYPES', () => {
		it( 'should define all handle types', () => {
			expect( LayersConstants.HANDLE_TYPES.NORTHWEST ).toBe( 'nw' );
			expect( LayersConstants.HANDLE_TYPES.NORTH ).toBe( 'n' );
			expect( LayersConstants.HANDLE_TYPES.NORTHEAST ).toBe( 'ne' );
			expect( LayersConstants.HANDLE_TYPES.EAST ).toBe( 'e' );
			expect( LayersConstants.HANDLE_TYPES.SOUTHEAST ).toBe( 'se' );
			expect( LayersConstants.HANDLE_TYPES.SOUTH ).toBe( 's' );
			expect( LayersConstants.HANDLE_TYPES.SOUTHWEST ).toBe( 'sw' );
			expect( LayersConstants.HANDLE_TYPES.WEST ).toBe( 'w' );
			expect( LayersConstants.HANDLE_TYPES.ROTATE ).toBe( 'rotate' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.HANDLE_TYPES ) ).toBe( true );
		} );
	} );

	describe( 'DEFAULTS', () => {
		it( 'should define layer defaults', () => {
			expect( LayersConstants.DEFAULTS.LAYER.OPACITY ).toBe( 1.0 );
			expect( LayersConstants.DEFAULTS.LAYER.FILL_OPACITY ).toBe( 1.0 );
			expect( LayersConstants.DEFAULTS.LAYER.STROKE_OPACITY ).toBe( 1.0 );
			expect( LayersConstants.DEFAULTS.LAYER.STROKE_WIDTH ).toBe( 2 );
			expect( LayersConstants.DEFAULTS.LAYER.FONT_SIZE ).toBe( 16 );
			expect( LayersConstants.DEFAULTS.LAYER.FONT_FAMILY ).toBe( 'Arial, sans-serif' );
			expect( LayersConstants.DEFAULTS.LAYER.VISIBLE ).toBe( true );
			expect( LayersConstants.DEFAULTS.LAYER.LOCKED ).toBe( false );
			expect( LayersConstants.DEFAULTS.LAYER.ROTATION ).toBe( 0 );
		} );

		it( 'should define color defaults', () => {
			expect( LayersConstants.DEFAULTS.COLORS.STROKE ).toBe( '#000000' );
			expect( LayersConstants.DEFAULTS.COLORS.FILL ).toBe( '#ffffff' );
			expect( LayersConstants.DEFAULTS.COLORS.TEXT ).toBe( '#000000' );
			expect( LayersConstants.DEFAULTS.COLORS.SHADOW ).toBe( '#000000' );
		} );

		it( 'should define size defaults', () => {
			expect( LayersConstants.DEFAULTS.SIZES.RECTANGLE_WIDTH ).toBe( 100 );
			expect( LayersConstants.DEFAULTS.SIZES.RECTANGLE_HEIGHT ).toBe( 60 );
			expect( LayersConstants.DEFAULTS.SIZES.CIRCLE_RADIUS ).toBe( 50 );
			expect( LayersConstants.DEFAULTS.SIZES.LINE_LENGTH ).toBe( 100 );
			expect( LayersConstants.DEFAULTS.SIZES.ARROW_SIZE ).toBe( 10 );
			expect( LayersConstants.DEFAULTS.SIZES.STAR_POINTS ).toBe( 5 );
			expect( LayersConstants.DEFAULTS.SIZES.SELECTION_HANDLE_SIZE ).toBe( 8 );
			expect( LayersConstants.DEFAULTS.SIZES.ROTATION_HANDLE_DISTANCE ).toBe( 25 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.DEFAULTS ) ).toBe( true );
			expect( Object.isFrozen( LayersConstants.DEFAULTS.LAYER ) ).toBe( true );
			expect( Object.isFrozen( LayersConstants.DEFAULTS.COLORS ) ).toBe( true );
			expect( Object.isFrozen( LayersConstants.DEFAULTS.SIZES ) ).toBe( true );
		} );
	} );

	describe( 'MATH', () => {
		it( 'should provide SCALE_EPSILON from MathUtils when available', () => {
			// MathUtils should already be loaded in test environment
			expect( LayersConstants.MATH.SCALE_EPSILON ).toBe( 0.0001 );
		} );

		it( 'should provide INTEGER_EPSILON from MathUtils when available', () => {
			expect( LayersConstants.MATH.INTEGER_EPSILON ).toBe( 1e-9 );
		} );

		it( 'should return fallback SCALE_EPSILON when MathUtils unavailable', () => {
			// Temporarily remove MathUtils to test fallback
			const originalMathUtils = window.Layers.MathUtils;
			delete window.Layers.MathUtils;

			// Re-require to get fresh getters (they check at runtime)
			expect( LayersConstants.MATH.SCALE_EPSILON ).toBe( 0.0001 );

			// Restore
			window.Layers.MathUtils = originalMathUtils;
		} );

		it( 'should return fallback INTEGER_EPSILON when MathUtils unavailable', () => {
			// Temporarily remove MathUtils to test fallback
			const originalMathUtils = window.Layers.MathUtils;
			delete window.Layers.MathUtils;

			expect( LayersConstants.MATH.INTEGER_EPSILON ).toBe( 1e-9 );

			// Restore
			window.Layers.MathUtils = originalMathUtils;
		} );

		it( 'should return fallback when Layers namespace is missing', () => {
			// Temporarily remove entire Layers namespace
			const originalLayers = window.Layers;
			delete window.Layers;

			// Re-require the module to test full fallback path
			// Since the module is already loaded, we test the getter logic directly
			// The getters in the already-loaded module will check window.Layers at runtime
			// We need to reload the module to properly test this edge case
			jest.resetModules();

			// Reload just LayersConstants without MathUtils
			require( '../../resources/ext.layers.editor/LayersConstants.js' );
			const FreshConstants = window.Layers.Constants;

			// Should still return the fallback values
			expect( FreshConstants.MATH.SCALE_EPSILON ).toBe( 0.0001 );
			expect( FreshConstants.MATH.INTEGER_EPSILON ).toBe( 1e-9 );

			// Restore
			window.Layers = originalLayers;
		} );
	} );

	describe( 'UI', () => {
		it( 'should define UI constants', () => {
			expect( LayersConstants.UI.GRID_SIZE ).toBe( 20 );
			expect( LayersConstants.UI.RULER_SIZE ).toBe( 30 );
			expect( LayersConstants.UI.SNAP_DISTANCE ).toBe( 10 );
			expect( LayersConstants.UI.ZOOM_STEP ).toBe( 0.2 );
			expect( LayersConstants.UI.MIN_ZOOM ).toBe( 0.1 );
			expect( LayersConstants.UI.MAX_ZOOM ).toBe( 5.0 );
			expect( LayersConstants.UI.ANIMATION_DURATION ).toBe( 300 );
			expect( LayersConstants.UI.DIRTY_REGION_PADDING ).toBe( 4 );
			expect( LayersConstants.UI.HANDLE_PADDING ).toBe( 5 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.UI ) ).toBe( true );
		} );
	} );

	describe( 'UI_COLORS', () => {
		it( 'should define UI colors', () => {
			expect( LayersConstants.UI_COLORS.SELECTION_OUTLINE ).toBe( '#007cba' );
			expect( LayersConstants.UI_COLORS.SELECTION_HANDLE_FILL ).toBe( '#ffffff' );
			expect( LayersConstants.UI_COLORS.SELECTION_HANDLE_STROKE ).toBe( '#007cba' );
			expect( LayersConstants.UI_COLORS.GRID_COLOR ).toBe( '#e0e0e0' );
			expect( LayersConstants.UI_COLORS.RULER_BACKGROUND ).toBe( '#f5f5f5' );
			expect( LayersConstants.UI_COLORS.RULER_TEXT ).toBe( '#666666' );
			expect( LayersConstants.UI_COLORS.GUIDE_COLOR ).toBe( '#ff6b35' );
			expect( LayersConstants.UI_COLORS.ERROR_COLOR ).toBe( '#ff0000' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.UI_COLORS ) ).toBe( true );
		} );
	} );

	describe( 'BLEND_MODES', () => {
		it( 'should define blend modes', () => {
			expect( LayersConstants.BLEND_MODES.NORMAL ).toBe( 'source-over' );
			expect( LayersConstants.BLEND_MODES.MULTIPLY ).toBe( 'multiply' );
			expect( LayersConstants.BLEND_MODES.SCREEN ).toBe( 'screen' );
			expect( LayersConstants.BLEND_MODES.OVERLAY ).toBe( 'overlay' );
			expect( LayersConstants.BLEND_MODES.DARKEN ).toBe( 'darken' );
			expect( LayersConstants.BLEND_MODES.LIGHTEN ).toBe( 'lighten' );
			expect( LayersConstants.BLEND_MODES.DIFFERENCE ).toBe( 'difference' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.BLEND_MODES ) ).toBe( true );
		} );
	} );

	describe( 'LINE_STYLES', () => {
		it( 'should define line styles', () => {
			expect( LayersConstants.LINE_STYLES.SOLID ).toBe( 'solid' );
			expect( LayersConstants.LINE_STYLES.DASHED ).toBe( 'dashed' );
			expect( LayersConstants.LINE_STYLES.DOTTED ).toBe( 'dotted' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.LINE_STYLES ) ).toBe( true );
		} );
	} );

	describe( 'ARROW_HEADS', () => {
		it( 'should define arrow head types', () => {
			expect( LayersConstants.ARROW_HEADS.NONE ).toBe( 'none' );
			expect( LayersConstants.ARROW_HEADS.ARROW ).toBe( 'arrow' );
			expect( LayersConstants.ARROW_HEADS.CIRCLE ).toBe( 'circle' );
			expect( LayersConstants.ARROW_HEADS.DIAMOND ).toBe( 'diamond' );
			expect( LayersConstants.ARROW_HEADS.TRIANGLE ).toBe( 'triangle' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.ARROW_HEADS ) ).toBe( true );
		} );
	} );

	describe( 'TEXT_ALIGN', () => {
		it( 'should define text alignment options', () => {
			expect( LayersConstants.TEXT_ALIGN.LEFT ).toBe( 'left' );
			expect( LayersConstants.TEXT_ALIGN.CENTER ).toBe( 'center' );
			expect( LayersConstants.TEXT_ALIGN.RIGHT ).toBe( 'right' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.TEXT_ALIGN ) ).toBe( true );
		} );
	} );

	describe( 'TEXT_BASELINE', () => {
		it( 'should define text baseline options', () => {
			expect( LayersConstants.TEXT_BASELINE.TOP ).toBe( 'top' );
			expect( LayersConstants.TEXT_BASELINE.MIDDLE ).toBe( 'middle' );
			expect( LayersConstants.TEXT_BASELINE.BOTTOM ).toBe( 'bottom' );
			expect( LayersConstants.TEXT_BASELINE.ALPHABETIC ).toBe( 'alphabetic' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.TEXT_BASELINE ) ).toBe( true );
		} );
	} );

	describe( 'CURSORS', () => {
		it( 'should define cursor types', () => {
			expect( LayersConstants.CURSORS.DEFAULT ).toBe( 'default' );
			expect( LayersConstants.CURSORS.POINTER ).toBe( 'pointer' );
			expect( LayersConstants.CURSORS.MOVE ).toBe( 'move' );
			expect( LayersConstants.CURSORS.CROSSHAIR ).toBe( 'crosshair' );
			expect( LayersConstants.CURSORS.TEXT ).toBe( 'text' );
			expect( LayersConstants.CURSORS.GRAB ).toBe( 'grab' );
			expect( LayersConstants.CURSORS.GRABBING ).toBe( 'grabbing' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.CURSORS ) ).toBe( true );
		} );
	} );

	describe( 'EVENTS', () => {
		it( 'should define event types', () => {
			expect( LayersConstants.EVENTS.LAYER_SELECTED ).toBe( 'layerSelected' );
			expect( LayersConstants.EVENTS.LAYER_DESELECTED ).toBe( 'layerDeselected' );
			expect( LayersConstants.EVENTS.LAYER_ADDED ).toBe( 'layerAdded' );
			expect( LayersConstants.EVENTS.LAYER_REMOVED ).toBe( 'layerRemoved' );
			expect( LayersConstants.EVENTS.LAYER_MODIFIED ).toBe( 'layerModified' );
			expect( LayersConstants.EVENTS.TOOL_CHANGED ).toBe( 'toolChanged' );
			expect( LayersConstants.EVENTS.ZOOM_CHANGED ).toBe( 'zoomChanged' );
			expect( LayersConstants.EVENTS.PAN_CHANGED ).toBe( 'panChanged' );
			expect( LayersConstants.EVENTS.SELECTION_CHANGED ).toBe( 'selectionChanged' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.EVENTS ) ).toBe( true );
		} );
	} );

	describe( 'KEY_CODES', () => {
		it( 'should define key codes', () => {
			expect( LayersConstants.KEY_CODES.ESCAPE ).toBe( 27 );
			expect( LayersConstants.KEY_CODES.SPACE ).toBe( 32 );
			expect( LayersConstants.KEY_CODES.ARROW_LEFT ).toBe( 37 );
			expect( LayersConstants.KEY_CODES.ARROW_UP ).toBe( 38 );
			expect( LayersConstants.KEY_CODES.ARROW_RIGHT ).toBe( 39 );
			expect( LayersConstants.KEY_CODES.ARROW_DOWN ).toBe( 40 );
			expect( LayersConstants.KEY_CODES.DELETE ).toBe( 46 );
			expect( LayersConstants.KEY_CODES.BACKSPACE ).toBe( 8 );
			expect( LayersConstants.KEY_CODES.ENTER ).toBe( 13 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.KEY_CODES ) ).toBe( true );
		} );
	} );

	describe( 'KEYS', () => {
		it( 'should define key names', () => {
			expect( LayersConstants.KEYS.ESCAPE ).toBe( 'Escape' );
			expect( LayersConstants.KEYS.SPACE ).toBe( ' ' );
			expect( LayersConstants.KEYS.ARROW_LEFT ).toBe( 'ArrowLeft' );
			expect( LayersConstants.KEYS.ARROW_UP ).toBe( 'ArrowUp' );
			expect( LayersConstants.KEYS.ARROW_RIGHT ).toBe( 'ArrowRight' );
			expect( LayersConstants.KEYS.ARROW_DOWN ).toBe( 'ArrowDown' );
			expect( LayersConstants.KEYS.DELETE ).toBe( 'Delete' );
			expect( LayersConstants.KEYS.BACKSPACE ).toBe( 'Backspace' );
			expect( LayersConstants.KEYS.ENTER ).toBe( 'Enter' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.KEYS ) ).toBe( true );
		} );
	} );

	describe( 'ERROR_MESSAGES', () => {
		it( 'should define error message keys', () => {
			expect( LayersConstants.ERROR_MESSAGES.LAYER_NOT_FOUND ).toBe( 'layers-error-layer-not-found' );
			expect( LayersConstants.ERROR_MESSAGES.INVALID_TOOL ).toBe( 'layers-error-invalid-tool' );
			expect( LayersConstants.ERROR_MESSAGES.CANVAS_NOT_AVAILABLE ).toBe( 'layers-error-canvas-not-available' );
			expect( LayersConstants.ERROR_MESSAGES.SAVE_FAILED ).toBe( 'layers-error-save-failed' );
			expect( LayersConstants.ERROR_MESSAGES.LOAD_FAILED ).toBe( 'layers-error-load-failed' );
			expect( LayersConstants.ERROR_MESSAGES.INVALID_DATA ).toBe( 'layers-error-invalid-data' );
			expect( LayersConstants.ERROR_MESSAGES.PERMISSION_DENIED ).toBe( 'layers-error-permission-denied' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.ERROR_MESSAGES ) ).toBe( true );
		} );
	} );

	describe( 'STATUS_MESSAGES', () => {
		it( 'should define status message keys', () => {
			expect( LayersConstants.STATUS_MESSAGES.READY ).toBe( 'layers-status-ready' );
			expect( LayersConstants.STATUS_MESSAGES.LOADING ).toBe( 'layers-status-loading' );
			expect( LayersConstants.STATUS_MESSAGES.SAVING ).toBe( 'layers-status-saving' );
			expect( LayersConstants.STATUS_MESSAGES.SAVED ).toBe( 'layers-status-saved' );
			expect( LayersConstants.STATUS_MESSAGES.MODIFIED ).toBe( 'layers-status-modified' );
			expect( LayersConstants.STATUS_MESSAGES.ERROR ).toBe( 'layers-status-error' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.STATUS_MESSAGES ) ).toBe( true );
		} );
	} );

	describe( 'ACTION_MESSAGES', () => {
		it( 'should define action message keys', () => {
			expect( LayersConstants.ACTION_MESSAGES.LAYER_CREATED ).toBe( 'layers-action-layer-created' );
			expect( LayersConstants.ACTION_MESSAGES.LAYER_DELETED ).toBe( 'layers-action-layer-deleted' );
			expect( LayersConstants.ACTION_MESSAGES.LAYER_DUPLICATED ).toBe( 'layers-action-layer-duplicated' );
			expect( LayersConstants.ACTION_MESSAGES.LAYERS_CLEARED ).toBe( 'layers-action-layers-cleared' );
			expect( LayersConstants.ACTION_MESSAGES.ZOOM_RESET ).toBe( 'layers-action-zoom-reset' );
			expect( LayersConstants.ACTION_MESSAGES.SELECTION_CLEARED ).toBe( 'layers-action-selection-cleared' );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.ACTION_MESSAGES ) ).toBe( true );
		} );
	} );

	describe( 'LIMITS', () => {
		it( 'should define performance limits', () => {
			expect( LayersConstants.LIMITS.MAX_LAYERS ).toBe( 100 );
			expect( LayersConstants.LIMITS.MAX_POINTS_PER_PATH ).toBe( 1000 );
			expect( LayersConstants.LIMITS.MAX_HISTORY_STEPS ).toBe( 50 );
			expect( LayersConstants.LIMITS.MAX_CANVAS_POOL_SIZE ).toBe( 5 );
			expect( LayersConstants.LIMITS.REDRAW_THROTTLE_MS ).toBe( 16 );
			expect( LayersConstants.LIMITS.TRANSFORM_THROTTLE_MS ).toBe( 16 );
			expect( LayersConstants.LIMITS.MAX_ZOOM_STEPS_PER_WHEEL ).toBe( 3 );
			expect( LayersConstants.LIMITS.MIN_POLYGON_SIDES ).toBe( 3 );
			expect( LayersConstants.LIMITS.MAX_POLYGON_SIDES ).toBe( 20 );
			expect( LayersConstants.LIMITS.MIN_STAR_POINTS ).toBe( 3 );
			expect( LayersConstants.LIMITS.MAX_STAR_POINTS ).toBe( 20 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.LIMITS ) ).toBe( true );
		} );
	} );

	describe( 'TIMING', () => {
		it( 'should define timing constants', () => {
			expect( LayersConstants.TIMING.IMAGE_LOAD_TIMEOUT ).toBe( 5000 );
			expect( LayersConstants.TIMING.BOOTSTRAP_RETRY_DELAY ).toBe( 50 );
			expect( LayersConstants.TIMING.HOOK_LISTENER_DELAY ).toBe( 50 );
			expect( LayersConstants.TIMING.DEPENDENCY_WAIT_DELAY ).toBe( 100 );
			expect( LayersConstants.TIMING.API_RETRY_DELAY ).toBe( 1000 );
			expect( LayersConstants.TIMING.DEBOUNCE_DEFAULT ).toBe( 150 );
			expect( LayersConstants.TIMING.NOTIFICATION_DURATION ).toBe( 5000 );
			expect( LayersConstants.TIMING.ANIMATION_DURATION ).toBe( 300 );
			expect( LayersConstants.TIMING.SAVE_BUTTON_DISABLE_DELAY ).toBe( 2000 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.TIMING ) ).toBe( true );
		} );
	} );

	describe( 'DATA', () => {
		it( 'should define data constants', () => {
			expect( LayersConstants.DATA.SCHEMA_VERSION ).toBe( 1 );
			expect( LayersConstants.DATA.MAX_FILENAME_LENGTH ).toBe( 255 );
			expect( LayersConstants.DATA.SUPPORTED_IMAGE_FORMATS ).toContain( 'png' );
			expect( LayersConstants.DATA.SUPPORTED_IMAGE_FORMATS ).toContain( 'jpg' );
			expect( LayersConstants.DATA.SUPPORTED_IMAGE_FORMATS ).toContain( 'svg' );
			expect( LayersConstants.DATA.DEFAULT_EXPORT_FORMAT ).toBe( 'png' );
			expect( LayersConstants.DATA.DEFAULT_EXPORT_QUALITY ).toBe( 0.9 );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.DATA ) ).toBe( true );
		} );
	} );

	describe( 'VALIDATION', () => {
		it( 'should define validation patterns', () => {
			expect( LayersConstants.VALIDATION.COLOR_HEX ).toBeInstanceOf( RegExp );
			expect( LayersConstants.VALIDATION.COLOR_RGB ).toBeInstanceOf( RegExp );
			expect( LayersConstants.VALIDATION.COLOR_RGBA ).toBeInstanceOf( RegExp );
			expect( LayersConstants.VALIDATION.FONT_FAMILY ).toBeInstanceOf( RegExp );
			expect( LayersConstants.VALIDATION.LAYER_ID ).toBeInstanceOf( RegExp );
		} );

		it( 'should validate hex colors correctly', () => {
			expect( LayersConstants.VALIDATION.COLOR_HEX.test( '#ffffff' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_HEX.test( '#FFF' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_HEX.test( '#000000' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_HEX.test( 'ffffff' ) ).toBe( false );
			expect( LayersConstants.VALIDATION.COLOR_HEX.test( '#gggggg' ) ).toBe( false );
		} );

		it( 'should validate RGB colors correctly', () => {
			expect( LayersConstants.VALIDATION.COLOR_RGB.test( 'rgb(255, 255, 255)' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_RGB.test( 'rgb(0,0,0)' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_RGB.test( 'rgb(255, 255, 255, 0.5)' ) ).toBe( false );
		} );

		it( 'should validate RGBA colors correctly', () => {
			expect( LayersConstants.VALIDATION.COLOR_RGBA.test( 'rgba(255, 255, 255, 0.5)' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_RGBA.test( 'rgba(0, 0, 0, 1)' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.COLOR_RGBA.test( 'rgba(0, 0, 0, 0)' ) ).toBe( true );
		} );

		it( 'should validate layer IDs correctly', () => {
			expect( LayersConstants.VALIDATION.LAYER_ID.test( 'layer-1' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.LAYER_ID.test( 'layer_test_123' ) ).toBe( true );
			expect( LayersConstants.VALIDATION.LAYER_ID.test( 'layer with space' ) ).toBe( false );
		} );

		it( 'should be frozen', () => {
			expect( Object.isFrozen( LayersConstants.VALIDATION ) ).toBe( true );
		} );
	} );

	describe( 'immutability', () => {
		it( 'should be completely frozen', () => {
			expect( Object.isFrozen( LayersConstants ) ).toBe( true );
		} );

		it( 'should not allow modification of constants', () => {
			// Attempting to modify a frozen object throws in strict mode,
			// but we're testing that the value doesn't change
			const originalValue = LayersConstants.TOOLS.POINTER;
			try {
				LayersConstants.TOOLS.POINTER = 'modified';
			} catch ( e ) {
				// Expected in strict mode
			}
			expect( LayersConstants.TOOLS.POINTER ).toBe( originalValue );
		} );
	} );
} );
