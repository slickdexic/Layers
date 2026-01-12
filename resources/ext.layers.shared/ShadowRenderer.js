/**
 * ShadowRenderer - Shadow rendering engine for Layers extension
 *
 * Extracted from LayerRenderer to handle all shadow-related rendering logic:
 * - Standard canvas shadows
 * - Shadow spread via offscreen canvas technique
 * - Rotation-aware shadow rendering
 *
 * This module is used by LayerRenderer for consistent shadow handling across
 * all shape types.
 *
 * @module ShadowRenderer
 * @since 0.9.1
 */
( function () {
	'use strict';

	/**
	 * Get clampOpacity from MathUtils namespace
	 *
	 * @private
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value
	 */
	function clampOpacity( value ) {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.MathUtils ) {
			return window.Layers.MathUtils.clampOpacity( value );
		}
		// Fallback if MathUtils not loaded
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	}

	/**
	 * ShadowRenderer class - Handles shadow rendering for layer shapes
	 */
class ShadowRenderer {
	/**
	 * Creates a new ShadowRenderer instance
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} [config] - Configuration options
	 * @param {HTMLCanvasElement} [config.canvas] - Canvas element reference
	 */
	constructor( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};
		this.canvas = this.config.canvas || null;
	}

	// ========================================================================
	// Configuration
	// ========================================================================

	/**
	 * Set the canvas reference
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element
	 */
	setCanvas( canvas ) {
		this.canvas = canvas;
	}

	/**
	 * Update the context reference
	 *
	 * @param {CanvasRenderingContext2D} ctx - New context
	 */
	setContext ( ctx ) {
		this.ctx = ctx;
	}

	// ========================================================================
	// Shadow State Management
	// ========================================================================

	/**
	 * Clear shadow settings from context
	 */
	clearShadow () {
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
	}

	/**
	 * Apply shadow settings to context (blur and offset only, not spread)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors {sx, sy, avg}
	 */
	applyShadow ( layer, scale ) {
		const scaleX = scale.sx || 1;
		const scaleY = scale.sy || 1;
		const scaleAvg = scale.avg || 1;

		// Helper to parse numeric values (handles strings like "0")
		const parseNum = ( val, defaultVal ) => {
			if ( val === undefined || val === null ) {
				return defaultVal;
			}
			const num = Number( val );
			return Number.isNaN( num ) ? defaultVal : num;
		};

		// Check for explicit disable
		const shadowExplicitlyDisabled = layer.shadow === false ||
			layer.shadow === 'false' ||
			layer.shadow === 0 ||
			layer.shadow === '0';

		const shadowExplicitlyEnabled = layer.shadow === true ||
			layer.shadow === 'true' ||
			layer.shadow === 1 ||
			layer.shadow === '1';

		if ( shadowExplicitlyDisabled ) {
			this.clearShadow();
		} else if ( shadowExplicitlyEnabled ) {
			// Flat format: shadow properties directly on layer
			this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
			this.ctx.shadowBlur = parseNum( layer.shadowBlur, 8 ) * scaleAvg;
			this.ctx.shadowOffsetX = parseNum( layer.shadowOffsetX, 2 ) * scaleX;
			this.ctx.shadowOffsetY = parseNum( layer.shadowOffsetY, 2 ) * scaleY;
		} else if ( typeof layer.shadow === 'object' && layer.shadow ) {
			// Legacy nested format: shadow: {color, blur, offsetX, offsetY}
			this.ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.4)';
			this.ctx.shadowBlur = parseNum( layer.shadow.blur, 8 ) * scaleAvg;
			this.ctx.shadowOffsetX = parseNum( layer.shadow.offsetX, 2 ) * scaleX;
			this.ctx.shadowOffsetY = parseNum( layer.shadow.offsetY, 2 ) * scaleY;
		}
		// If shadow is undefined/null, no shadow is applied (canvas defaults)
	}

	// ========================================================================
	// Shadow Property Helpers
	// ========================================================================

	/**
	 * Check if shadow is enabled on a layer
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if shadow is enabled
	 */
	hasShadowEnabled ( layer ) {
		// Explicit enable
		if ( layer.shadow === true ||
			layer.shadow === 'true' ||
			layer.shadow === 1 ||
			layer.shadow === '1' ||
			( typeof layer.shadow === 'object' && layer.shadow ) ) {
			return true;
		}

		// Explicit disable
		if ( layer.shadow === false ||
			layer.shadow === 'false' ||
			layer.shadow === 0 ||
			layer.shadow === '0' ) {
			return false;
		}

		// Fallback: if any shadow property is set, treat as enabled
		// This handles legacy data where shadow="" but other shadow props are present
		if ( layer.shadowColor &&
			typeof layer.shadowColor === 'string' &&
			layer.shadowColor !== 'transparent' &&
			layer.shadowColor !== 'rgba(0,0,0,0)' ) {
			return true;
		}

		// Also check for shadowBlur or offset values
		if ( typeof layer.shadowBlur === 'number' && layer.shadowBlur > 0 ) {
			return true;
		}
		if ( typeof layer.shadowOffsetX === 'number' && layer.shadowOffsetX !== 0 ) {
			return true;
		}
		if ( typeof layer.shadowOffsetY === 'number' && layer.shadowOffsetY !== 0 ) {
			return true;
		}

		return false;
	}

	/**
	 * Get shadow spread value from layer
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {number} Spread value in pixels (scaled)
	 */
	getShadowSpread ( layer, scale ) {
		const scaleAvg = scale.avg || 1;

		// Check if shadow is enabled
		if ( !this.hasShadowEnabled( layer ) ) {
			return 0;
		}

		// Get spread from flat format
		if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
			return layer.shadowSpread * scaleAvg;
		}

		// Get spread from nested format
		if ( typeof layer.shadow === 'object' && layer.shadow &&
			typeof layer.shadow.spread === 'number' && layer.shadow.spread > 0 ) {
			return layer.shadow.spread * scaleAvg;
		}

		return 0;
	}

	/**
	 * Get shadow parameters for offscreen rendering technique
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {Object} Shadow parameters {offsetX, offsetY, blur, color, offscreenOffset}
	 */
	getShadowParams ( layer, scale ) {
		const scaleX = scale.sx || 1;
		const scaleY = scale.sy || 1;
		const scaleAvg = scale.avg || 1;

		// Parse values - handle both numbers and numeric strings, use defaults only for undefined/null
		const parseNum = ( val, defaultVal ) => {
			if ( val === undefined || val === null ) {
				return defaultVal;
			}
			const num = Number( val );
			return Number.isNaN( num ) ? defaultVal : num;
		};

		// DEBUG: Log shadow params to verify code is executing
		const result = {
			offsetX: parseNum( layer.shadowOffsetX, 2 ) * scaleX,
			offsetY: parseNum( layer.shadowOffsetY, 2 ) * scaleY,
			blur: parseNum( layer.shadowBlur, 8 ) * scaleAvg,
			color: layer.shadowColor || 'rgba(0,0,0,0.4)',
			offscreenOffset: 10000
		};
		return result;
	}

	// ========================================================================
	// Offscreen Shadow Rendering (Spread Support)
	// ========================================================================

	/**
	 * Draw a spread shadow using offscreen canvas technique.
	 * This renders ONLY the shadow (not the shape) with the spread expansion.
	 *
	 * The technique: We need to draw an expanded shape to cast a larger shadow, then remove
	 * the shape while keeping the shadow. The challenge is that when we erase the shape,
	 * we might also erase part of the shadow that overlaps with it.
	 *
	 * Solution: Draw the shape offset horizontally by a large amount (FAR_OFFSET), then
	 * adjust the shadow offset to compensate. This puts the shadow at the correct position
	 * while keeping the shape far away, so erasing the shape doesn't affect the shadow.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} spread - Spread amount in pixels (already scaled)
	 * @param {Function} drawExpandedPathFn - Function(ctx) that creates the expanded path on the provided context
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadow ( layer, scale, spread, drawExpandedPathFn, opacity ) {
		const sp = this.getShadowParams( layer, scale );
		const blur = sp.blur;
		const shadowOpacity = typeof opacity === 'number' ? Math.max( 0, Math.min( 1, opacity ) ) : 1;

		// Large offset to separate shape from its shadow
		const FAR_OFFSET = 5000;

		const canvasWidth = this.canvas ? this.canvas.width : 800;
		const canvasHeight = this.canvas ? this.canvas.height : 600;

		// Create temporary canvas - needs to be wide enough for the offset shape
		const tempCanvas = document.createElement( 'canvas' );
		tempCanvas.width = canvasWidth + FAR_OFFSET + blur + Math.abs( sp.offsetX );
		tempCanvas.height = canvasHeight + blur + Math.abs( sp.offsetY );
		const tempCtx = tempCanvas.getContext( '2d' );

		if ( !tempCtx ) {
			this.applyShadow( layer, scale );
			return;
		}

		// FIX (2025-12-08): Handle rotation separately from the FAR_OFFSET technique.
		// The problem: FAR_OFFSET shifts the shape horizontally in transformed space,
		// but shadowOffset compensation is in screen space. These don't align when rotated.
		// Solution: Copy transform but EXCLUDE rotation, draw shadow, then composite
		// with rotation applied during the final drawImage.

		// Get current transform and extract rotation
		let currentTransform = null;
		let hasRotation = false;
		let rotationAngle = 0;
		let transformWithoutRotation = null;

		if ( this.ctx.getTransform ) {
			currentTransform = this.ctx.getTransform();
			// Check if there's rotation in the transform (a !== 1 or b !== 0 indicates rotation/skew)
			// For pure rotation: a = cos(θ), b = sin(θ), c = -sin(θ), d = cos(θ)
			if ( currentTransform.b !== 0 || currentTransform.c !== 0 ) {
				hasRotation = true;
				// Extract rotation angle from transform matrix
				rotationAngle = Math.atan2( currentTransform.b, currentTransform.a );

				// For temp canvas, use identity + translation only (no scale, no rotation)
				// The shape coordinates in drawExpandedPathFn are already in local (rotated) space
				// We just need to position correctly
				transformWithoutRotation = new DOMMatrix( [
					1, 0, 0, 1,
					currentTransform.e,
					currentTransform.f
				] );
			}
		}

		// Copy transform to temp canvas - either full transform or without rotation
		if ( hasRotation && transformWithoutRotation ) {
			// Use transform without rotation for the FAR_OFFSET technique to work
			tempCtx.setTransform( transformWithoutRotation );
		} else if ( currentTransform ) {
			tempCtx.setTransform( currentTransform );
		}

		// Shift drawing position by FAR_OFFSET to the right (now in screen-aligned space)
		tempCtx.translate( FAR_OFFSET, 0 );

		// Set up shadow - offsets are now in screen space which matches FAR_OFFSET direction
		tempCtx.shadowColor = sp.color;
		tempCtx.shadowBlur = blur;
		tempCtx.shadowOffsetX = sp.offsetX - FAR_OFFSET; // Shadow goes back to correct position
		tempCtx.shadowOffsetY = sp.offsetY;
		tempCtx.fillStyle = sp.color;

		// Draw the expanded shape (offset by FAR_OFFSET due to translate)
		// If rotated, we need to apply rotation here for the shape drawing
		if ( hasRotation ) {
			tempCtx.save();
			// Rotate around the shape's center (which is at the translated position)
			// The drawExpandedPathFn draws relative to current origin
			tempCtx.rotate( rotationAngle );
		}

		// FIX (2025-12-11): Pass the temp context to the callback function
		// This fixes the bug where callbacks were using the wrong context due to arrow function closures
		drawExpandedPathFn( tempCtx );

		tempCtx.fill();

		if ( hasRotation ) {
			tempCtx.restore();
		}

		// Erase the shape - it's far from the shadow so this is safe
		tempCtx.globalCompositeOperation = 'destination-out';
		tempCtx.shadowColor = 'transparent';
		tempCtx.shadowBlur = 0;
		tempCtx.shadowOffsetX = 0;
		tempCtx.shadowOffsetY = 0;

		if ( hasRotation ) {
			tempCtx.save();
			tempCtx.rotate( rotationAngle );
		}

		drawExpandedPathFn( tempCtx );

		tempCtx.fill();

		if ( hasRotation ) {
			tempCtx.restore();
		}

		// Draw the shadow from temp canvas onto main canvas
		// IMPORTANT: Clear shadow on main context first to prevent double shadow!
		// Apply the opacity parameter to match what non-spread shadows would look like
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
		this.ctx.globalAlpha = shadowOpacity;
		this.ctx.drawImage( tempCanvas, 0, 0 );
		this.ctx.restore();
	}

	/**
	 * Draw a spread shadow for stroked shapes (lines, paths) using offscreen canvas.
	 * Similar to drawSpreadShadow but uses stroke() instead of fill().
	 *
	 * Uses the same FAR_OFFSET technique to separate the stroke from its shadow.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} strokeWidth - The expanded stroke width to use
	 * @param {Function} drawPathFn - Function(ctx) that creates the path on the provided context
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadowStroke ( layer, scale, strokeWidth, drawPathFn, opacity ) {
		const sp = this.getShadowParams( layer, scale );
		const shadowOpacity = typeof opacity === 'number' ? Math.max( 0, Math.min( 1, opacity ) ) : 1;

		const FAR_OFFSET = 5000;

		const canvasWidth = this.canvas ? this.canvas.width : 800;
		const canvasHeight = this.canvas ? this.canvas.height : 600;

		const tempCanvas = document.createElement( 'canvas' );
		tempCanvas.width = canvasWidth + FAR_OFFSET + sp.blur + Math.abs( sp.offsetX );
		tempCanvas.height = canvasHeight + sp.blur + Math.abs( sp.offsetY );
		const tempCtx = tempCanvas.getContext( '2d' );

		if ( !tempCtx ) {
			this.applyShadow( layer, scale );
			return;
		}

		// FIX (2025-12-08): Handle rotation separately from the FAR_OFFSET technique.
		// Same approach as drawSpreadShadow - extract rotation and apply separately.
		let currentTransform = null;
		let hasRotation = false;
		let rotationAngle = 0;
		let transformWithoutRotation = null;

		if ( this.ctx.getTransform ) {
			currentTransform = this.ctx.getTransform();
			if ( currentTransform.b !== 0 || currentTransform.c !== 0 ) {
				hasRotation = true;
				rotationAngle = Math.atan2( currentTransform.b, currentTransform.a );
				transformWithoutRotation = new DOMMatrix( [
					1, 0, 0, 1,
					currentTransform.e,
					currentTransform.f
				] );
			}
		}

		if ( hasRotation && transformWithoutRotation ) {
			tempCtx.setTransform( transformWithoutRotation );
		} else if ( currentTransform ) {
			tempCtx.setTransform( currentTransform );
		}

		tempCtx.translate( FAR_OFFSET, 0 );

		// Set up shadow - offsets are now in screen space which matches FAR_OFFSET direction
		tempCtx.shadowColor = sp.color;
		tempCtx.shadowBlur = sp.blur;
		tempCtx.shadowOffsetX = sp.offsetX - FAR_OFFSET;
		tempCtx.shadowOffsetY = sp.offsetY;
		tempCtx.strokeStyle = sp.color;
		tempCtx.lineWidth = strokeWidth;
		tempCtx.lineCap = 'round';
		tempCtx.lineJoin = 'round';

		if ( hasRotation ) {
			tempCtx.save();
			tempCtx.rotate( rotationAngle );
		}

		// FIX (2025-12-11): Pass the temp context to the callback function
		// This fixes the bug where callbacks were using the wrong context due to arrow function closures
		drawPathFn( tempCtx );

		tempCtx.stroke();

		if ( hasRotation ) {
			tempCtx.restore();
		}

		// Erase the stroke itself, leaving only the shadow
		tempCtx.globalCompositeOperation = 'destination-out';
		tempCtx.shadowColor = 'transparent';
		tempCtx.shadowBlur = 0;
		tempCtx.shadowOffsetX = 0;
		tempCtx.shadowOffsetY = 0;

		if ( hasRotation ) {
			tempCtx.save();
			tempCtx.rotate( rotationAngle );
		}

		drawPathFn( tempCtx );

		tempCtx.stroke();

		if ( hasRotation ) {
			tempCtx.restore();
		}

		// Draw the shadow onto main canvas
		// IMPORTANT: Clear shadow on main context first to prevent double shadow!
		// Apply the opacity parameter to match what non-spread shadows would look like
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
		this.ctx.globalAlpha = shadowOpacity;
		this.ctx.drawImage( tempCanvas, 0, 0 );
		this.ctx.restore();
	}

	// ========================================================================
	// Utility Methods
	// ========================================================================

	/**
	 * Execute a function with a temporary globalAlpha multiplier
	 *
	 * @param {number|undefined} alpha - Opacity multiplier (0-1)
	 * @param {Function} drawFn - Drawing function to execute
	 */
	withLocalAlpha ( alpha, drawFn ) {
		if ( typeof drawFn !== 'function' ) {
			return;
		}
		if ( typeof alpha !== 'number' ) {
			drawFn.call( this );
			return;
		}

		const clampedAlpha = Math.max( 0, Math.min( 1, alpha ) );
		const previousAlpha = this.ctx.globalAlpha;
		this.ctx.globalAlpha = previousAlpha * clampedAlpha;
		try {
			drawFn.call( this );
		} finally {
			this.ctx.globalAlpha = previousAlpha;
		}
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	/**
	 * Clean up resources
	 */
	destroy() {
		this.ctx = null;
		this.config = null;
		this.canvas = null;
	}
}

	// ========================================================================
	// Exports
	// ========================================================================

	// Export clampOpacity for use by LayerRenderer
	ShadowRenderer.clampOpacity = clampOpacity;

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ShadowRenderer = ShadowRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = ShadowRenderer;
	}

}() );
