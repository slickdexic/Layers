/**
 * LayerRenderer Module for Layers Editor
 * Specialized renderer for complex shapes and advanced layer effects
 * Extracted from CanvasManager.js - handles polygon, star, arrow, highlight, and path drawing
 */
( function () {
	'use strict';

	/**
	 * LayerRenderer - Handles complex shape rendering and advanced effects
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
	 * @param {Object} config - Configuration options
	 * @class
	 */
	function LayerRenderer( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};

		// Editor reference for layer lookup (optional)
		this.editor = this.config.editor || null;
		this.selectedLayerId = null;

		this.init();
	}

	/**
	 * Initialize the layer renderer
	 */
	LayerRenderer.prototype.init = function () {
		// Set up default rendering properties
		this.defaultStrokeWidth = 2;
		this.defaultArrowSize = 10;
		this.defaultPolygonSides = 6;
		this.defaultStarPoints = 5;
	};

	/**
	 * Set the selected layer ID for context-aware rendering
	 *
	 * @param {string} layerId - ID of the currently selected layer
	 */
	LayerRenderer.prototype.setSelectedLayer = function ( layerId ) {
		this.selectedLayerId = layerId;
	};

	/**
	 * Apply alpha transparency with proper restoration
	 *
	 * @param {number} factor - Alpha factor (0-1)
	 * @param {Function} fn - Function to execute with alpha applied
	 */
	LayerRenderer.prototype.withLocalAlpha = function ( factor, fn ) {
		const f = ( typeof factor === 'number' ) ? Math.max( 0, Math.min( 1, factor ) ) : 1;
		if ( f === 1 ) {
			fn();
			return;
		}
		const prev = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prev || 1 ) * f;
		try {
			fn();
		} finally {
			this.ctx.globalAlpha = prev;
		}
	};

	/**
	 * Apply drop shadow styling to the context
	 *
	 * @param {Object} layer - Layer object with shadow properties
	 */
	LayerRenderer.prototype.applyShadow = function ( layer ) {
		if ( layer.shadow ) {
			this.ctx.shadowColor = layer.shadowColor || '#000000';
			this.ctx.shadowBlur = layer.shadowBlur || 8;
			this.ctx.shadowOffsetX = layer.shadowOffsetX || 2;
			this.ctx.shadowOffsetY = layer.shadowOffsetY || 2;
		} else {
			// Clear any existing shadow
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}
	};

	/**
	 * Draw arrow layer with customizable arrowheads
	 *
	 * @param {Object} layer - Arrow layer object
	 */
	LayerRenderer.prototype.drawArrow = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || this.defaultStrokeWidth;

		// Apply drop shadow
		this.applyShadow( layer );

		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;
		const arrowSize = layer.arrowSize || this.defaultArrowSize;
		const arrowStyle = layer.arrowStyle || 'single';

		// Draw main line
		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		const strokeOpacity = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( strokeOpacity, () => {
			this.ctx.stroke();
		} );

		// Draw arrowheads based on style
		if ( arrowStyle === 'single' || arrowStyle === 'double' ) {
			this.drawArrowHead( x2, y2, x1, y1, arrowSize );
		}

		if ( arrowStyle === 'double' ) {
			this.drawArrowHead( x1, y1, x2, y2, arrowSize );
		}

		this.ctx.restore();
	};

	/**
	 * Draw arrowhead at specified position
	 *
	 * @param {number} tipX - X coordinate of arrow tip
	 * @param {number} tipY - Y coordinate of arrow tip
	 * @param {number} baseX - X coordinate of arrow base
	 * @param {number} baseY - Y coordinate of arrow base
	 * @param {number} size - Size of the arrowhead
	 */
	LayerRenderer.prototype.drawArrowHead = function ( tipX, tipY, baseX, baseY, size ) {
		// Calculate arrow head angle
		const angle = Math.atan2( tipY - baseY, tipX - baseX );
		const arrowAngle = Math.PI / 6; // 30 degrees

		// Draw arrow head
		this.ctx.beginPath();
		this.ctx.moveTo( tipX, tipY );
		this.ctx.lineTo(
			tipX - size * Math.cos( angle - arrowAngle ),
			tipY - size * Math.sin( angle - arrowAngle )
		);
		this.ctx.moveTo( tipX, tipY );
		this.ctx.lineTo(
			tipX - size * Math.cos( angle + arrowAngle ),
			tipY - size * Math.sin( angle + arrowAngle )
		);

		let strokeOpacity = 1;
		if ( this.editor && this.editor.getLayerById && this.selectedLayerId ) {
			// Try to respect stroke opacity of selected layer if available
			const selectedLayer = this.editor.getLayerById( this.selectedLayerId );
			if ( selectedLayer && typeof selectedLayer.strokeOpacity === 'number' ) {
				strokeOpacity = selectedLayer.strokeOpacity;
			}
		}

		this.withLocalAlpha( strokeOpacity, () => {
			this.ctx.stroke();
		} );
	};

	/**
	 * Draw highlight layer with semi-transparent overlay
	 *
	 * @param {Object} layer - Highlight layer object
	 */
	LayerRenderer.prototype.drawHighlight = function ( layer ) {
		this.ctx.save();

		// Apply drop shadow
		this.applyShadow( layer );

		// Draw semi-transparent highlight
		this.ctx.fillStyle = layer.fill || '#ffff0080';
		const fillOpacity = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
		this.withLocalAlpha( fillOpacity, () => {
			this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );
		} );

		this.ctx.restore();
	};

	/**
	 * Draw path layer from array of points
	 *
	 * @param {Object} layer - Path layer object with points array
	 */
	LayerRenderer.prototype.drawPath = function ( layer ) {
		if ( !layer.points || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();

		// Apply drop shadow
		this.applyShadow( layer );

		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || this.defaultStrokeWidth;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		const strokeOpacity = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( strokeOpacity, () => {
			this.ctx.stroke();
		} );

		this.ctx.restore();
	};

	/**
	 * Draw polygon layer with configurable number of sides
	 *
	 * @param {Object} layer - Polygon layer object
	 */
	LayerRenderer.prototype.drawPolygon = function ( layer ) {
		const sides = layer.sides || this.defaultPolygonSides;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const radius = layer.radius || 50;
		const rotation = layer.rotation || 0;

		this.ctx.save();

		// Apply drop shadow
		this.applyShadow( layer );

		// Apply rotation if specified
		if ( rotation !== 0 ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( rotation * Math.PI / 180 );
			this.ctx.translate( -x, -y );
		}

		this.ctx.beginPath();

		for ( let i = 0; i < sides; i++ ) {
			const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
			const px = x + radius * Math.cos( angle );
			const py = y + radius * Math.sin( angle );

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		// Fill polygon if fill is specified
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			const fillOpacity = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fillOpacity, () => {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		// Stroke polygon if stroke is specified
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			const strokeOpacity = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( strokeOpacity, () => {
				this.ctx.stroke();
			} );
		}

		this.ctx.restore();
	};

	/**
	 * Draw star layer with configurable points and radii
	 *
	 * @param {Object} layer - Star layer object
	 */
	LayerRenderer.prototype.drawStar = function ( layer ) {
		const points = layer.points || this.defaultStarPoints;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const outerRadius = layer.outerRadius || layer.radius || 50;
		const innerRadius = layer.innerRadius || outerRadius * 0.5;
		const rotation = ( layer.rotation || 0 ) * Math.PI / 180;

		this.ctx.save();

		// Apply drop shadow
		this.applyShadow( layer );

		if ( rotation !== 0 ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( rotation );
			this.ctx.translate( -x, -y );
		}

		this.ctx.beginPath();

		for ( let i = 0; i < points * 2; i++ ) {
			const angle = ( i * Math.PI ) / points - Math.PI / 2;
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const px = x + radius * Math.cos( angle );
			const py = y + radius * Math.sin( angle );

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		// Fill star if fill is specified
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			const fillOpacity = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fillOpacity, () => {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		// Stroke star if stroke is specified
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			const strokeOpacity = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( strokeOpacity, () => {
				this.ctx.stroke();
			} );
		}

		this.ctx.restore();
	};

	/**
	 * Render complex layer based on type
	 *
	 * @param {Object} layer - Layer object to render
	 * @return {boolean} True if layer was handled, false if not supported
	 */
	LayerRenderer.prototype.renderLayer = function ( layer ) {
		if ( !layer || layer.visible === false ) {
			return false;
		}

		switch ( layer.type ) {
			case 'arrow':
				this.drawArrow( layer );
				return true;
			case 'highlight':
				this.drawHighlight( layer );
				return true;
			case 'path':
				this.drawPath( layer );
				return true;
			case 'polygon':
				this.drawPolygon( layer );
				return true;
			case 'star':
				this.drawStar( layer );
				return true;
			default:
				return false; // Layer type not supported by this renderer
		}
	};

	/**
	 * Get list of supported layer types
	 *
	 * @return {Array} Array of supported layer type strings
	 */
	LayerRenderer.prototype.getSupportedTypes = function () {
		return [ 'arrow', 'highlight', 'path', 'polygon', 'star' ];
	};

	/**
	 * Check if a layer type is supported by this renderer
	 *
	 * @param {string} type - Layer type to check
	 * @return {boolean} True if supported, false otherwise
	 */
	LayerRenderer.prototype.supportsType = function ( type ) {
		return this.getSupportedTypes().includes( type );
	};

	/**
	 * Update configuration options
	 *
	 * @param {Object} newConfig - New configuration options
	 */
	LayerRenderer.prototype.updateConfig = function ( newConfig ) {
		if ( newConfig ) {
			Object.keys( newConfig ).forEach( ( key ) => {
				this.config[ key ] = newConfig[ key ];
			} );

			// Update editor reference if provided
			if ( newConfig.editor ) {
				this.editor = newConfig.editor;
			}
		}
	};

	/**
	 * Clean up resources
	 */
	LayerRenderer.prototype.destroy = function () {
		this.ctx = null;
		this.editor = null;
		this.config = null;
		this.selectedLayerId = null;
	};

	// Export the module
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerRenderer;
	} else if ( typeof window !== 'undefined' ) {
		window.LayerRenderer = LayerRenderer;
	}

	// MediaWiki ResourceLoader support
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], () => {
			mw.LayerRenderer = LayerRenderer;
		} );
	}

}() );
