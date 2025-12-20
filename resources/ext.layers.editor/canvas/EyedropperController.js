/**
 * EyedropperController - Color sampling from canvas
 *
 * Provides eyedropper/color picker functionality that allows users to
 * sample colors from anywhere on the canvas, including the background
 * image and rendered layers.
 *
 * Features:
 * - Click to sample color at cursor position
 * - Magnified preview while sampling
 * - Apply sampled color to stroke or fill
 * - Keyboard modifier to toggle stroke/fill target
 * - ESC to cancel sampling mode
 *
 * @class EyedropperController
 * @since 1.1.7
 */

const NamespaceHelper = require( '../utils/NamespaceHelper.js' );

/**
 * @class EyedropperController
 */
class EyedropperController {
	/**
	 * Get the class name for namespace registration
	 *
	 * @return {string} The class name
	 */
	static getClass() {
		return NamespaceHelper.getClass( EyedropperController, 'EyedropperController' );
	}

	/**
	 * Create an EyedropperController
	 *
	 * @param {Object} canvasManager - The canvas manager instance
	 */
	constructor( canvasManager ) {
		/**
		 * @property {Object} manager - Reference to canvas manager
		 */
		this.manager = canvasManager;

		/**
		 * @property {boolean} active - Whether eyedropper mode is active
		 */
		this.active = false;

		/**
		 * @property {string} target - Color target: 'fill' or 'stroke'
		 */
		this.target = 'fill';

		/**
		 * @property {string|null} sampledColor - Last sampled color (hex)
		 */
		this.sampledColor = null;

		/**
		 * @property {Object|null} previewPosition - Current preview position {x, y}
		 */
		this.previewPosition = null;

		/**
		 * @property {number} previewSize - Size of magnified preview in pixels
		 */
		this.previewSize = 100;

		/**
		 * @property {number} magnification - Magnification factor for preview
		 */
		this.magnification = 8;

		/**
		 * @property {number} sampleRadius - Radius to average colors from (0 = single pixel)
		 */
		this.sampleRadius = 0;

		/**
		 * @property {boolean} showPreview - Whether to show magnified preview
		 */
		this.showPreview = true;

		/**
		 * @property {string} previewBorderColor - Border color for preview circle
		 */
		this.previewBorderColor = '#ffffff';

		/**
		 * @property {string} crosshairColor - Crosshair color in preview
		 */
		this.crosshairColor = '#000000';

		/**
		 * @property {Function|null} onColorSampled - Callback when color is sampled
		 */
		this.onColorSampled = null;

		/**
		 * @property {Function|null} onModeChange - Callback when mode changes
		 */
		this.onModeChange = null;

		/**
		 * @property {string} originalCursor - Original cursor style to restore
		 */
		this.originalCursor = 'default';

		// Bind event handlers
		this.handleMouseMove = this.handleMouseMove.bind( this );
		this.handleMouseDown = this.handleMouseDown.bind( this );
		this.handleKeyDown = this.handleKeyDown.bind( this );
	}

	/**
	 * Activate eyedropper mode
	 *
	 * @param {string} [target='fill'] - Color target: 'fill' or 'stroke'
	 */
	activate( target = 'fill' ) {
		if ( this.active ) {
			return;
		}

		this.active = true;
		this.target = target === 'stroke' ? 'stroke' : 'fill';
		this.sampledColor = null;
		this.previewPosition = null;

		// Store original cursor
		const canvas = this.getCanvas();
		if ( canvas ) {
			this.originalCursor = canvas.style.cursor;
			canvas.style.cursor = 'crosshair';
		}

		// Add event listeners
		this.addEventListeners();

		// Notify mode change
		if ( this.onModeChange ) {
			this.onModeChange( true, this.target );
		}

		// Request redraw to show any UI
		this.requestRedraw();
	}

	/**
	 * Deactivate eyedropper mode
	 *
	 * @param {boolean} [cancelled=false] - Whether deactivation was cancelled
	 */
	deactivate( cancelled = false ) {
		if ( !this.active ) {
			return;
		}

		this.active = false;
		this.previewPosition = null;

		// Restore original cursor
		const canvas = this.getCanvas();
		if ( canvas ) {
			canvas.style.cursor = this.originalCursor;
		}

		// Remove event listeners
		this.removeEventListeners();

		// Notify mode change
		if ( this.onModeChange ) {
			this.onModeChange( false, this.target, cancelled );
		}

		// Request redraw to clear preview
		this.requestRedraw();
	}

	/**
	 * Toggle eyedropper mode
	 *
	 * @param {string} [target='fill'] - Color target when activating
	 * @return {boolean} New active state
	 */
	toggle( target = 'fill' ) {
		if ( this.active ) {
			this.deactivate();
		} else {
			this.activate( target );
		}
		return this.active;
	}

	/**
	 * Check if eyedropper is active
	 *
	 * @return {boolean} Whether eyedropper mode is active
	 */
	isActive() {
		return this.active;
	}

	/**
	 * Get the current target (fill or stroke)
	 *
	 * @return {string} Current target
	 */
	getTarget() {
		return this.target;
	}

	/**
	 * Set the color target
	 *
	 * @param {string} target - 'fill' or 'stroke'
	 */
	setTarget( target ) {
		this.target = target === 'stroke' ? 'stroke' : 'fill';
	}

	/**
	 * Get the canvas element
	 *
	 * @return {HTMLCanvasElement|null} The canvas element
	 */
	getCanvas() {
		return this.manager && this.manager.canvas ? this.manager.canvas : null;
	}

	/**
	 * Get the canvas 2D context
	 *
	 * @return {CanvasRenderingContext2D|null} The canvas context
	 */
	getContext() {
		const canvas = this.getCanvas();
		return canvas ? canvas.getContext( '2d' ) : null;
	}

	/**
	 * Add event listeners for eyedropper mode
	 */
	addEventListeners() {
		const canvas = this.getCanvas();
		if ( canvas ) {
			canvas.addEventListener( 'mousemove', this.handleMouseMove );
			canvas.addEventListener( 'mousedown', this.handleMouseDown );
		}
		document.addEventListener( 'keydown', this.handleKeyDown );
	}

	/**
	 * Remove event listeners
	 */
	removeEventListeners() {
		const canvas = this.getCanvas();
		if ( canvas ) {
			canvas.removeEventListener( 'mousemove', this.handleMouseMove );
			canvas.removeEventListener( 'mousedown', this.handleMouseDown );
		}
		document.removeEventListener( 'keydown', this.handleKeyDown );
	}

	/**
	 * Handle mouse move during eyedropper mode
	 *
	 * @param {MouseEvent} e - The mouse event
	 */
	handleMouseMove( e ) {
		if ( !this.active ) {
			return;
		}

		const canvas = this.getCanvas();
		if ( !canvas ) {
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		this.previewPosition = { x, y };

		// Sample color at current position for preview
		this.sampledColor = this.sampleColorAt( x, y );

		// Update target based on modifier keys
		if ( e.altKey || e.shiftKey ) {
			this.target = 'stroke';
		} else {
			this.target = 'fill';
		}

		this.requestRedraw();
	}

	/**
	 * Handle mouse down to sample color
	 *
	 * @param {MouseEvent} e - The mouse event
	 */
	handleMouseDown( e ) {
		if ( !this.active ) {
			return;
		}

		// Prevent default to avoid text selection, etc.
		e.preventDefault();
		e.stopPropagation();

		const canvas = this.getCanvas();
		if ( !canvas ) {
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Sample the color
		const color = this.sampleColorAt( x, y );

		if ( color ) {
			this.sampledColor = color;

			// Determine target from modifier keys
			const target = ( e.altKey || e.shiftKey ) ? 'stroke' : 'fill';

			// Apply the color
			this.applyColor( color, target );

			// Notify callback
			if ( this.onColorSampled ) {
				this.onColorSampled( color, target, { x, y } );
			}
		}

		// Deactivate after sampling
		this.deactivate();
	}

	/**
	 * Handle keyboard events
	 *
	 * @param {KeyboardEvent} e - The keyboard event
	 */
	handleKeyDown( e ) {
		if ( !this.active ) {
			return;
		}

		// ESC to cancel
		if ( e.key === 'Escape' ) {
			e.preventDefault();
			this.deactivate( true );
		}

		// Toggle target with Alt/Shift
		if ( e.key === 'Alt' || e.key === 'Shift' ) {
			this.target = 'stroke';
			this.requestRedraw();
		}
	}

	/**
	 * Sample color at canvas position
	 *
	 * @param {number} x - X position on canvas
	 * @param {number} y - Y position on canvas
	 * @return {string|null} Hex color or null if invalid
	 */
	sampleColorAt( x, y ) {
		const ctx = this.getContext();
		if ( !ctx ) {
			return null;
		}

		try {
			let r, g, b, a;

			if ( this.sampleRadius === 0 ) {
				// Single pixel sample
				const imageData = ctx.getImageData( Math.floor( x ), Math.floor( y ), 1, 1 );
				[ r, g, b, a ] = imageData.data;
			} else {
				// Average over radius
				const diameter = this.sampleRadius * 2 + 1;
				const startX = Math.floor( x ) - this.sampleRadius;
				const startY = Math.floor( y ) - this.sampleRadius;

				const imageData = ctx.getImageData( startX, startY, diameter, diameter );
				const data = imageData.data;

				let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
				let count = 0;

				for ( let i = 0; i < data.length; i += 4 ) {
					totalR += data[ i ];
					totalG += data[ i + 1 ];
					totalB += data[ i + 2 ];
					totalA += data[ i + 3 ];
					count++;
				}

				r = Math.round( totalR / count );
				g = Math.round( totalG / count );
				b = Math.round( totalB / count );
				a = Math.round( totalA / count );
			}

			// If fully transparent, return null or a default
			if ( a === 0 ) {
				return '#ffffff';
			}

			return this.rgbToHex( r, g, b );
		} catch ( e ) {
			// Canvas tainted or out of bounds
			return null;
		}
	}

	/**
	 * Convert RGB values to hex string
	 *
	 * @param {number} r - Red (0-255)
	 * @param {number} g - Green (0-255)
	 * @param {number} b - Blue (0-255)
	 * @return {string} Hex color string
	 */
	rgbToHex( r, g, b ) {
		const toHex = ( n ) => {
			const hex = Math.max( 0, Math.min( 255, n ) ).toString( 16 );
			return hex.length === 1 ? '0' + hex : hex;
		};
		return '#' + toHex( r ) + toHex( g ) + toHex( b );
	}

	/**
	 * Apply sampled color to selected layers or active color
	 *
	 * @param {string} color - Hex color to apply
	 * @param {string} target - 'fill' or 'stroke'
	 */
	applyColor( color, target ) {
		if ( !this.manager ) {
			return;
		}

		// Get selected layer IDs
		const selectedIds = this.manager.selectionManager ?
			this.manager.selectionManager.getSelectedIds() : [];

		if ( selectedIds.length > 0 ) {
			// Apply to selected layers
			const editor = this.manager.editor;
			if ( editor && editor.layers ) {
				const updates = {};

				selectedIds.forEach( ( id ) => {
					const layer = editor.layers.find( ( l ) => l.id === id );
					if ( layer ) {
						if ( target === 'stroke' ) {
							updates[ id ] = { stroke: color };
						} else {
							updates[ id ] = { fill: color };
						}
					}
				} );

				// Apply updates through editor
				if ( Object.keys( updates ).length > 0 && editor.updateLayerProperties ) {
					Object.entries( updates ).forEach( ( [ id, props ] ) => {
						editor.updateLayerProperties( id, props );
					} );
				}
			}
		}

		// Also update the toolbar's active color if available
		if ( this.manager.editor && this.manager.editor.toolbar ) {
			const toolbar = this.manager.editor.toolbar;
			if ( target === 'stroke' && toolbar.setStrokeColor ) {
				toolbar.setStrokeColor( color );
			} else if ( target === 'fill' && toolbar.setFillColor ) {
				toolbar.setFillColor( color );
			}
		}
	}

	/**
	 * Request a canvas redraw
	 */
	requestRedraw() {
		if ( this.manager && this.manager.requestRedraw ) {
			this.manager.requestRedraw();
		}
	}

	/**
	 * Render eyedropper preview overlay
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context
	 */
	render( ctx ) {
		if ( !this.active || !this.showPreview || !this.previewPosition ) {
			return;
		}

		this.renderMagnifiedPreview( ctx );
	}

	/**
	 * Render magnified preview circle
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context
	 */
	renderMagnifiedPreview( ctx ) {
		const { x, y } = this.previewPosition;
		const size = this.previewSize;
		const mag = this.magnification;
		const halfSize = size / 2;

		// Position preview offset from cursor
		let previewX = x + 20;
		let previewY = y - size - 10;

		// Keep preview on screen
		const canvas = this.getCanvas();
		if ( canvas ) {
			if ( previewX + size > canvas.width ) {
				previewX = x - size - 20;
			}
			if ( previewY < 0 ) {
				previewY = y + 20;
			}
		}

		ctx.save();

		// Create circular clip for magnified view
		ctx.beginPath();
		ctx.arc( previewX + halfSize, previewY + halfSize, halfSize, 0, Math.PI * 2 );
		ctx.clip();

		// Draw magnified portion of canvas
		const sourceSize = size / mag;
		const sourceX = x - sourceSize / 2;
		const sourceY = y - sourceSize / 2;

		try {
			// Get image data from source area
			const sourceCanvas = this.getCanvas();
			if ( sourceCanvas ) {
				ctx.drawImage(
					sourceCanvas,
					sourceX, sourceY, sourceSize, sourceSize,
					previewX, previewY, size, size
				);
			}
		} catch ( e ) {
			// Canvas might be tainted
			ctx.fillStyle = '#cccccc';
			ctx.fillRect( previewX, previewY, size, size );
		}

		ctx.restore();

		// Draw border
		ctx.save();
		ctx.beginPath();
		ctx.arc( previewX + halfSize, previewY + halfSize, halfSize, 0, Math.PI * 2 );
		ctx.strokeStyle = this.previewBorderColor;
		ctx.lineWidth = 3;
		ctx.stroke();

		// Draw inner border for contrast
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.restore();

		// Draw crosshair in center
		ctx.save();
		ctx.strokeStyle = this.crosshairColor;
		ctx.lineWidth = 1;

		const centerX = previewX + halfSize;
		const centerY = previewY + halfSize;
		const crossSize = 10;

		ctx.beginPath();
		ctx.moveTo( centerX - crossSize, centerY );
		ctx.lineTo( centerX + crossSize, centerY );
		ctx.moveTo( centerX, centerY - crossSize );
		ctx.lineTo( centerX, centerY + crossSize );
		ctx.stroke();
		ctx.restore();

		// Draw sampled color swatch
		if ( this.sampledColor ) {
			this.renderColorSwatch( ctx, previewX, previewY + size + 5 );
		}
	}

	/**
	 * Render color swatch showing sampled color
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 */
	renderColorSwatch( ctx, x, y ) {
		const swatchSize = 30;
		const padding = 4;

		ctx.save();

		// Background
		ctx.fillStyle = '#ffffff';
		ctx.fillRect( x, y, swatchSize + padding * 2, swatchSize + padding * 2 + 20 );

		// Border
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 1;
		ctx.strokeRect( x, y, swatchSize + padding * 2, swatchSize + padding * 2 + 20 );

		// Color swatch
		ctx.fillStyle = this.sampledColor;
		ctx.fillRect( x + padding, y + padding, swatchSize, swatchSize );

		// Color text
		ctx.fillStyle = '#000000';
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.fillText(
			this.sampledColor.toUpperCase(),
			x + padding + swatchSize / 2,
			y + padding + swatchSize + 14
		);

		// Target indicator
		ctx.font = '9px sans-serif';
		ctx.fillStyle = '#666666';
		ctx.fillText(
			this.target === 'stroke' ? 'STROKE' : 'FILL',
			x + padding + swatchSize / 2,
			y - 4
		);

		ctx.restore();
	}

	/**
	 * Get the last sampled color
	 *
	 * @return {string|null} Hex color or null
	 */
	getSampledColor() {
		return this.sampledColor;
	}

	/**
	 * Set preview options
	 *
	 * @param {Object} options - Preview options
	 * @param {number} [options.size] - Preview size in pixels
	 * @param {number} [options.magnification] - Magnification factor
	 * @param {boolean} [options.show] - Whether to show preview
	 */
	setPreviewOptions( options ) {
		if ( options.size !== undefined && options.size > 0 ) {
			this.previewSize = options.size;
		}
		if ( options.magnification !== undefined && options.magnification > 0 ) {
			this.magnification = options.magnification;
		}
		if ( options.show !== undefined ) {
			this.showPreview = Boolean( options.show );
		}
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.deactivate();
		this.manager = null;
		this.onColorSampled = null;
		this.onModeChange = null;
	}
}

module.exports = EyedropperController;
