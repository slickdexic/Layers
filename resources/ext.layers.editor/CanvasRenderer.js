/**
 * CanvasRenderer Module for Layers Editor
 * Unified rendering engine handling all canvas drawing operations.
 * Consolidates logic from CanvasManager, RenderingCore, and LayerRenderer.
 */
( function () {
	'use strict';

	var clampOpacity = function ( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	};

	/**
	 * CanvasRenderer - Manages all canvas rendering operations
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element to render on
	 * @param {Object} config - Configuration options
	 * @class
	 */
	function CanvasRenderer( canvas, config ) {
		this.canvas = canvas;
		this.ctx = canvas.getContext( '2d' );
		this.config = config || {};
		this.editor = this.config.editor || null;

		// Canvas state management
		this.canvasStateStack = [];
		this.backgroundImage = null;

		// Transformation state
		this.zoom = 1.0;
		this.panX = 0;
		this.panY = 0;

		// Grid and rulers
		this.showGrid = false;
		this.gridSize = 20;
		this.showRulers = false;
		this.rulerSize = 20;
		this.showGuides = false;
		this.horizontalGuides = [];
		this.verticalGuides = [];

		// Selection state
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.rotationHandle = null;
		this.isMarqueeSelecting = false;
		this.marqueeRect = null;

		// Canvas pooling
		this.canvasPool = [];
		this.maxPoolSize = 5;

		this.init();
	}

	CanvasRenderer.prototype.init = function () {
		this.ctx.imageSmoothingEnabled = true;
		this.ctx.imageSmoothingQuality = 'high';
	};

	CanvasRenderer.prototype.setTransform = function ( zoom, panX, panY ) {
		this.zoom = zoom;
		this.panX = panX;
		this.panY = panY;
	};

	CanvasRenderer.prototype.setBackgroundImage = function ( img ) {
		this.backgroundImage = img;
	};

	CanvasRenderer.prototype.setSelection = function ( selectedLayerIds ) {
		this.selectedLayerIds = selectedLayerIds || [];
	};

	CanvasRenderer.prototype.setMarquee = function ( isSelecting, rect ) {
		this.isMarqueeSelecting = isSelecting;
		this.marqueeRect = rect;
	};

	CanvasRenderer.prototype.setGuides = function ( show, hGuides, vGuides ) {
		this.showGuides = show;
		this.horizontalGuides = hGuides || [];
		this.verticalGuides = vGuides || [];
	};

	CanvasRenderer.prototype.clear = function () {
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
		this.ctx.restore();
	};

	CanvasRenderer.prototype.redraw = function ( layers ) {
		this.clear();
		this.applyTransformations();

		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.drawBackgroundImage();
		}

		if ( this.showGrid ) {
			this.drawGrid();
		}

		if ( this.showRulers ) {
			this.drawRulers();
		}

		if ( layers && layers.length > 0 ) {
			this.renderLayers( layers );
		}

		this.drawGuides();
		this.drawGuidePreview();
		this.drawMultiSelectionIndicators();
		this.drawMarqueeBox();
	};

	CanvasRenderer.prototype.applyTransformations = function () {
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.translate( this.panX, this.panY );
		this.ctx.scale( this.zoom, this.zoom );
	};

	CanvasRenderer.prototype.drawBackgroundImage = function () {
		if ( !this.backgroundImage ) {
			// Draw placeholder
			this.ctx.save();
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
			
			// Checker pattern
			this.ctx.fillStyle = '#f0f0f0';
			var checkerSize = 20;
			for ( var x = 0; x < this.canvas.width; x += checkerSize * 2 ) {
				for ( var y = 0; y < this.canvas.height; y += checkerSize * 2 ) {
					this.ctx.fillRect( x, y, checkerSize, checkerSize );
					this.ctx.fillRect( x + checkerSize, y + checkerSize, checkerSize, checkerSize );
				}
			}
			
			this.ctx.fillStyle = '#666666';
			this.ctx.font = '24px Arial';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText( 'No image loaded', this.canvas.width / 2, this.canvas.height / 2 );
			this.ctx.restore();
			return;
		}
		this.ctx.drawImage( this.backgroundImage, 0, 0 );
	};

	CanvasRenderer.prototype.renderLayers = function ( layers ) {
		if ( !Array.isArray( layers ) ) {
			return;
		}
		// Render in reverse order (bottom to top) if that's how the array is structured,
		// or normal order if array is bottom-to-top.
		// CanvasManager loop was: for ( var i = layers.length - 1; i >= 0; i-- )
		// which implies layers[0] is top? No, usually layers[0] is bottom.
		// Let's check CanvasManager.renderLayers.
		// CanvasManager.js: for ( var i = layers.length - 1; i >= 0; i-- )
		// This means layers[length-1] is drawn first? No, loop goes backwards.
		// If i=length-1 is drawn first, then it's at the bottom.
		// So layers array is Top-to-Bottom.
		for ( var i = layers.length - 1; i >= 0; i-- ) {
			var layer = layers[ i ];
			if ( layer && layer.visible !== false ) {
				this.drawLayerWithEffects( layer );
			}
		}
	};

	CanvasRenderer.prototype.drawLayerWithEffects = function ( layer ) {
		this.ctx.save();
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blend ) {
			try {
				this.ctx.globalCompositeOperation = String( layer.blend );
			} catch ( _e ) {}
		}

		// Shadow
		if ( layer.shadow ) {
			this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
			this.ctx.shadowBlur = Math.round( layer.shadowBlur || 8 );
			this.ctx.shadowOffsetX = Math.round( layer.shadowOffsetX || 2 );
			this.ctx.shadowOffsetY = Math.round( layer.shadowOffsetY || 2 );
		} else {
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		try {
			this.drawLayer( layer );

			// Glow effect
			if ( layer.glow && this.supportsGlow( layer.type ) ) {
				this.drawGlow( layer );
			}
		} finally {
			this.ctx.restore();
		}
	};

	CanvasRenderer.prototype.supportsGlow = function ( type ) {
		return [ 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path' ].indexOf( type ) !== -1;
	};

	CanvasRenderer.prototype.drawGlow = function ( layer ) {
		var prevAlpha = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prevAlpha || 1 ) * 0.3;
		this.ctx.save();
		this.ctx.strokeStyle = ( layer.stroke || '#000' );
		this.ctx.lineWidth = ( layer.strokeWidth || 1 ) + 6;
		// Re-draw shape outline for glow
		// This is a simplified version, ideally we'd reuse the path
		this.drawLayerShapeOnly( layer );
		this.ctx.restore();
		this.ctx.globalAlpha = prevAlpha;
	};

	CanvasRenderer.prototype.drawLayerShapeOnly = function ( layer ) {
		// Helper to draw just the path/shape for glow effect
		// This duplicates some logic but avoids full drawLayer overhead
		switch ( layer.type ) {
			case 'rectangle':
				this.ctx.strokeRect( layer.x || 0, layer.y || 0, layer.width || 0, layer.height || 0 );
				break;
			case 'circle':
				this.ctx.beginPath();
				this.ctx.arc( layer.x || 0, layer.y || 0, layer.radius || 0, 0, 2 * Math.PI );
				this.ctx.stroke();
				break;
			case 'ellipse':
				this.ctx.save();
				this.ctx.translate( layer.x || 0, layer.y || 0 );
				this.ctx.scale( layer.radiusX || 1, layer.radiusY || 1 );
				this.ctx.beginPath();
				this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
				this.ctx.stroke();
				this.ctx.restore();
				break;
			// Add others as needed
		}
	};

	CanvasRenderer.prototype.drawLayer = function ( layer ) {
		switch ( layer.type ) {
			case 'text':
				this.drawText( layer );
				break;
			case 'rectangle':
			case 'rect':
				this.drawRectangle( layer );
				break;
			case 'circle':
				this.drawCircle( layer );
				break;
			case 'ellipse':
				this.drawEllipse( layer );
				break;
			case 'polygon':
				this.drawPolygon( layer );
				break;
			case 'star':
				this.drawStar( layer );
				break;
			case 'line':
				this.drawLine( layer );
				break;
			case 'arrow':
				this.drawArrow( layer );
				break;
			case 'highlight':
				this.drawHighlight( layer );
				break;
			case 'path':
				this.drawPath( layer );
				break;
			case 'blur':
				this.drawBlur( layer );
				break;
		}
	};

	// --- Shape Drawing Methods ---

	CanvasRenderer.prototype.drawRectangle = function ( layer ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var w = layer.width || 0;
		var h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );

		var baseOpacity = this.ctx.globalAlpha;

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fillOpacity = typeof layer.fillOpacity === 'number' ? layer.fillOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
			this.clearShadow(); // Prevent shadow on stroke
		}

		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			var strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawCircle = function ( layer ) {
		var centerX = layer.x || 0;
		var centerY = layer.y || 0;
		var radius = layer.radius || ( layer.width ? layer.width / 2 : 50 );

		if ( radius <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.arc( centerX, centerY, radius, 0, 2 * Math.PI );

		var baseOpacity = this.ctx.globalAlpha;

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fillOpacity = typeof layer.fillOpacity === 'number' ? layer.fillOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
			this.clearShadow();
		}

		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			var strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawEllipse = function ( layer ) {
		var centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
		var centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
		var radiusX = ( layer.width || 0 ) / 2;
		var radiusY = ( layer.height || 0 ) / 2;

		if ( radiusX <= 0 || radiusY <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.ellipse( centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI );

		var baseOpacity = this.ctx.globalAlpha;

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}

		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawLine = function ( layer ) {
		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.moveTo( layer.x1 || layer.x || 0, layer.y1 || layer.y || 0 );
		var endX = layer.x2 || ( layer.x || 0 ) + ( layer.width || 0 );
		var endY = layer.y2 || ( layer.y || 0 ) + ( layer.height || 0 );
		this.ctx.lineTo( endX, endY );

		var baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
		this.ctx.stroke();

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawArrow = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;

		var x1 = layer.x1 || 0;
		var y1 = layer.y1 || 0;
		var x2 = layer.x2 || 0;
		var y2 = layer.y2 || 0;
		var arrowSize = layer.arrowSize || 10;
		var arrowStyle = layer.arrowStyle || 'single';

		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );

		var strokeOpacity = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( strokeOpacity, function () {
			this.ctx.stroke();
		}.bind( this ) );

		if ( arrowStyle === 'single' || arrowStyle === 'double' ) {
			this.drawArrowHead( x2, y2, x1, y1, arrowSize, strokeOpacity );
		}
		if ( arrowStyle === 'double' ) {
			this.drawArrowHead( x1, y1, x2, y2, arrowSize, strokeOpacity );
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawArrowHead = function ( tipX, tipY, baseX, baseY, size, opacity ) {
		var angle = Math.atan2( tipY - baseY, tipX - baseX );
		var arrowAngle = Math.PI / 6;

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

		this.withLocalAlpha( opacity, function () {
			this.ctx.stroke();
		}.bind( this ) );
	};

	CanvasRenderer.prototype.drawPolygon = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 3 ) {
			// Fallback for regular polygon defined by sides/radius
			if ( layer.sides ) {
				this.drawRegularPolygon( layer );
			}
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
		for ( var i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}
		this.ctx.closePath();

		var baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawRegularPolygon = function ( layer ) {
		var sides = layer.sides || 6;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;
		var rotation = layer.rotation || 0;

		this.ctx.save();
		// applyLayerStyle handles rotation, but here we might want local rotation
		// If applyLayerStyle is used, it rotates around center.
		// Let's use manual rotation here if needed, or rely on applyLayerStyle.
		// applyLayerStyle rotates the whole context.
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		for ( var i = 0; i < sides; i++ ) {
			var angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
			var px = x + radius * Math.cos( angle );
			var py = y + radius * Math.sin( angle );
			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}
		this.ctx.closePath();

		var baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawStar = function ( layer ) {
		var points = layer.points || 5;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var outerRadius = layer.outerRadius || layer.radius || 50;
		var innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();

		for ( var i = 0; i < points * 2; i++ ) {
			var angle = ( i * Math.PI ) / points - Math.PI / 2;
			var r = i % 2 === 0 ? outerRadius : innerRadius;
			var px = x + Math.cos( angle ) * r;
			var py = y + Math.sin( angle ) * r;
			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}
		this.ctx.closePath();

		var baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawPath = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		var baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
		for ( var i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}
		this.ctx.stroke();

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawHighlight = function ( layer ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var width = layer.width || 100;
		var height = layer.height || 20;

		this.ctx.save();
		var opacity = 0.3;
		if ( typeof layer.opacity === 'number' && !Number.isNaN( layer.opacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.opacity ) );
		} else if ( typeof layer.fillOpacity === 'number' && !Number.isNaN( layer.fillOpacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.fillOpacity ) );
		}
		this.ctx.globalAlpha = opacity;
		this.ctx.fillStyle = layer.color || layer.fill || '#ffff00';
		this.ctx.fillRect( x, y, width, height );
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawBlur = function ( layer ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var w = layer.width || 0;
		var h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );
		this.ctx.clip();

		var radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
		var prevFilter = this.ctx.filter || 'none';
		this.ctx.filter = 'blur(' + radius + 'px)';

		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
		}

		this.ctx.filter = prevFilter;
		this.ctx.restore();
	};

	// --- Text Handling ---

	CanvasRenderer.prototype.drawText = function ( layer ) {
		this.ctx.save();

		var metrics = this.measureTextLayer( layer );
		if ( !metrics ) {
			this.ctx.restore();
			return;
		}

		var drawX = metrics.originX;
		var baselineStart = metrics.baselineY;
		var centerX = metrics.originX + ( metrics.width / 2 );
		var centerY = metrics.originY + ( metrics.height / 2 );

		this.ctx.font = metrics.fontSize + 'px ' + metrics.fontFamily;
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'alphabetic';

		if ( layer.rotation && layer.rotation !== 0 ) {
			var rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			drawX = -( metrics.width / 2 );
			baselineStart = -( metrics.height / 2 ) + metrics.ascent;
		}

		if ( layer.textShadow ) {
			this.ctx.shadowColor = layer.textShadowColor || '#000000';
			this.ctx.shadowOffsetX = 2 * ( this.zoom || 1 );
			this.ctx.shadowOffsetY = 2 * ( this.zoom || 1 );
			this.ctx.shadowBlur = 4;
		}

		var baseAlpha = this.ctx.globalAlpha;
		var fillColor = layer.fill || layer.color || '#000000';
		var fillOpacity = clampOpacity( layer.fillOpacity );
		var strokeOpacity = clampOpacity( layer.strokeOpacity );

		for ( var j = 0; j < metrics.lines.length; j++ ) {
			var lineText = metrics.lines[ j ];
			var lineY = baselineStart + ( j * metrics.lineHeight );

			if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
				this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
				this.ctx.lineWidth = layer.textStrokeWidth;
				this.ctx.globalAlpha = baseAlpha * strokeOpacity;
				this.ctx.strokeText( lineText, drawX, lineY );
			}

			this.ctx.fillStyle = fillColor;
			this.ctx.globalAlpha = baseAlpha * fillOpacity;
			this.ctx.fillText( lineText, drawX, lineY );
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.measureTextLayer = function ( layer ) {
		if ( !layer ) {
			return null;
		}

		var fontSize = layer.fontSize || 16;
		var fontFamily = layer.fontFamily || 'Arial';
		var sanitizedText = this.sanitizeTextContent( layer.text || '' );
		var lineHeight = fontSize * 1.2;
		var context = this.ctx;
		var canvasWidth = this.canvas ? this.canvas.width : 0;
		var maxLineWidth = layer.maxWidth || ( canvasWidth ? canvasWidth * 0.8 : fontSize * Math.max( sanitizedText.length, 1 ) );

		context.save();
		context.font = fontSize + 'px ' + fontFamily;
		var lines = this.wrapText( sanitizedText, maxLineWidth, context );
		if ( !lines.length ) {
			lines = [ '' ];
		}

		var totalTextWidth = 0;
		var metricsForLongest = null;
		for ( var i = 0; i < lines.length; i++ ) {
			var lineMetrics = context.measureText( lines[ i ] || ' ' );
			if ( lineMetrics.width > totalTextWidth ) {
				totalTextWidth = lineMetrics.width;
				metricsForLongest = lineMetrics;
			}
		}
		if ( totalTextWidth === 0 ) {
			var fallbackMetrics = context.measureText( sanitizedText || ' ' );
			totalTextWidth = fallbackMetrics.width;
			metricsForLongest = fallbackMetrics;
		}

		context.restore();

		var ascent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxAscent === 'number' ?
			metricsForLongest.actualBoundingBoxAscent : fontSize * 0.8;
		var descent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxDescent === 'number' ?
			metricsForLongest.actualBoundingBoxDescent : fontSize * 0.2;
		var totalHeight = ascent + descent;
		if ( lines.length > 1 ) {
			totalHeight = ascent + descent + ( lines.length - 1 ) * lineHeight;
		}

		var textAlign = layer.textAlign || 'left';
		var alignOffset = 0;
		switch ( textAlign ) {
			case 'center':
				alignOffset = totalTextWidth / 2;
				break;
			case 'right':
			case 'end':
				alignOffset = totalTextWidth;
				break;
			default:
				alignOffset = 0;
		}

		var originX = ( layer.x || 0 ) - alignOffset;
		var originY = ( layer.y || 0 ) - ascent;

		return {
			lines: lines,
			fontSize: fontSize,
			fontFamily: fontFamily,
			lineHeight: lineHeight,
			width: totalTextWidth,
			height: totalHeight,
			originX: originX,
			originY: originY,
			ascent: ascent,
			descent: descent,
			baselineY: layer.y || 0,
			alignOffset: alignOffset
		};
	};

	CanvasRenderer.prototype.wrapText = function ( text, maxWidth, ctx ) {
		if ( !text || !maxWidth || maxWidth <= 0 ) {
			return [ text || '' ];
		}
		var words = text.split( ' ' );
		var lines = [];
		var currentLine = '';
		for ( var i = 0; i < words.length; i++ ) {
			var word = words[ i ];
			var testLine = currentLine + ( currentLine ? ' ' : '' ) + word;
			var metrics = ctx.measureText( testLine );
			if ( metrics.width > maxWidth && currentLine !== '' ) {
				lines.push( currentLine );
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if ( currentLine ) {
			lines.push( currentLine );
		}
		return lines.length > 0 ? lines : [ '' ];
	};

	CanvasRenderer.prototype.sanitizeTextContent = function ( text ) {
		var safeText = text == null ? '' : String( text );
		safeText = safeText.replace( /[^\x20-\x7E\u00A0-\uFFFF]/g, '' );
		safeText = safeText.replace( /<[^>]+>/g, '' );
		return safeText;
	};

	// --- UI Rendering (Selection, Guides, etc.) ---

	CanvasRenderer.prototype.drawMultiSelectionIndicators = function () {
		this.selectionHandles = [];
		if ( !this.selectedLayerIds || this.selectedLayerIds.length === 0 ) {
			return;
		}
		for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
			this.drawSelectionIndicators( this.selectedLayerIds[ i ] );
		}
	};

	CanvasRenderer.prototype.drawSelectionIndicators = function ( layerId ) {
		// We need the layer object. Since we don't have direct access to editor.getLayerById here easily
		// unless we pass it or look it up.
		// We can pass the layer object instead of ID, or rely on this.editor.
		if ( !this.editor ) {
			return;
		}
		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			return;
		}

		this.ctx.save();
		var bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			this.ctx.restore();
			return;
		}

		var rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
			var centerX = bounds.x + bounds.width / 2;
			var centerY = bounds.y + bounds.height / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotation * Math.PI / 180 );
			// When rotated, we draw handles around the unrotated bounds centered at 0,0
			// But wait, if we translate/rotate context, the coordinates for drawing are local.
			// But for hit testing, we need world coordinates.
			// This complicates hit testing if we store transformed coordinates.
			// For now, let's store the handles as they are drawn (transformed).
			// Actually, if we rotate context, the rects we draw are aligned with local axes.
			// But on screen they are rotated.
			// Hit testing usually happens in world space.
			// If we want to hit test rotated handles, we need to rotate the point or the handles.
			// CanvasManager.hitTestSelectionHandles uses simple rect intersection.
			// This implies handles are axis-aligned in world space?
			// If rotation is supported, handles should rotate with the object.
			// If CanvasManager doesn't support rotated hit testing, then we have a problem.
			// But let's stick to drawing first.
			
			// We need to pass the effective bounds for drawing handles.
			// If we rotated the context, we draw at relative coordinates.
			var localBounds = {
				x: -bounds.width / 2,
				y: -bounds.height / 2,
				width: bounds.width,
				height: bounds.height
			};
			// Pass world-space bounds for correct hit testing coordinate calculation
			this.drawSelectionHandles( localBounds, layer, true, bounds );
			this.drawRotationHandle( localBounds, layer, true, bounds );
		} else {
			this.drawSelectionHandles( bounds, layer, false, bounds );
			this.drawRotationHandle( bounds, layer, false, bounds );
		}

		this.ctx.restore();
	};

	/**
	 * Draw selection handles and register them for hit testing
	 *
	 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
	 * @param {Object} layer - The layer object
	 * @param {boolean} isRotated - Whether the layer is rotated
	 * @param {Object} worldBounds - World-space bounds for hit testing calculation
	 */
	CanvasRenderer.prototype.drawSelectionHandles = function ( bounds, layer, isRotated, worldBounds ) {
		var handleSize = 12;
		var handleColor = '#2196f3';
		var handleBorderColor = '#ffffff';

		var handles = [
			{ x: bounds.x, y: bounds.y, type: 'nw' },
			{ x: bounds.x + bounds.width / 2, y: bounds.y, type: 'n' },
			{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, type: 'e' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
			{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, type: 's' },
			{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw' },
			{ x: bounds.x, y: bounds.y + bounds.height / 2, type: 'w' }
		];

		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );

		for ( var i = 0; i < handles.length; i++ ) {
			var h = handles[ i ];
			this.ctx.fillRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );
			this.ctx.strokeRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );

			// Store handle for hit testing
			// If isRotated, the coordinates h.x/h.y are in local rotated space.
			// We need to transform them back to world space for hit testing.
			var worldX = h.x;
			var worldY = h.y;
			
			if ( isRotated && layer.rotation ) {
				// We are currently in a rotated context centered at layer center.
				// We need to transform (h.x, h.y) which are relative to center, back to world.
				// Use worldBounds to get correct center for all layer types (including text)
				var wb = worldBounds || bounds;
				var centerX = wb.x + wb.width / 2;
				var centerY = wb.y + wb.height / 2;
				var rad = layer.rotation * Math.PI / 180;
				var cos = Math.cos( rad );
				var sin = Math.sin( rad );
				
				worldX = centerX + ( h.x * cos - h.y * sin );
				worldY = centerY + ( h.x * sin + h.y * cos );
			}

			this.selectionHandles.push( {
				type: h.type,
				x: worldX - handleSize / 2,
				y: worldY - handleSize / 2,
				width: handleSize,
				height: handleSize,
				layerId: layer.id,
				rotation: layer.rotation || 0 // Store rotation if needed
			} );
		}
	};

	/**
	 * Draw rotation handle and register it for hit testing
	 *
	 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
	 * @param {Object} layer - The layer object
	 * @param {boolean} isRotated - Whether the layer is rotated
	 * @param {Object} worldBounds - World-space bounds for hit testing calculation
	 */
	CanvasRenderer.prototype.drawRotationHandle = function ( bounds, layer, isRotated, worldBounds ) {
		var handleSize = 12;
		var handleColor = '#ff9800';
		var handleBorderColor = '#ffffff';
		var lineColor = '#2196f3';

		var rotationHandleX = bounds.x + bounds.width / 2;
		var rotationHandleY = bounds.y - 20;

		this.ctx.strokeStyle = lineColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );
		this.ctx.beginPath();
		this.ctx.moveTo( bounds.x + bounds.width / 2, bounds.y );
		this.ctx.lineTo( rotationHandleX, rotationHandleY );
		this.ctx.stroke();

		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.beginPath();
		this.ctx.arc( rotationHandleX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI );
		this.ctx.fill();
		this.ctx.stroke();

		// Add to selection handles for hit testing
		// Rotation handle is circular, but we can use a rect for hit testing
		
		var worldX = rotationHandleX;
		var worldY = rotationHandleY;

		if ( isRotated && layer.rotation ) {
			// Transform local coordinates back to world coordinates
			// Use worldBounds to get correct center for all layer types (including text)
			var wb = worldBounds || bounds;
			var centerX = wb.x + wb.width / 2;
			var centerY = wb.y + wb.height / 2;
			var rad = layer.rotation * Math.PI / 180;
			var cos = Math.cos( rad );
			var sin = Math.sin( rad );
			
			// rotationHandleX/Y are relative to the rotated context origin (which is centerX, centerY)
			// because bounds passed in are localBounds (centered at 0,0)
			worldX = centerX + ( rotationHandleX * cos - rotationHandleY * sin );
			worldY = centerY + ( rotationHandleX * sin + rotationHandleY * cos );
		}

		this.selectionHandles.push( {
			type: 'rotate',
			x: worldX - handleSize / 2,
			y: worldY - handleSize / 2,
			width: handleSize,
			height: handleSize,
			layerId: layer.id,
			rotation: layer.rotation || 0
		} );
	};

	CanvasRenderer.prototype.drawMarqueeBox = function () {
		if ( !this.isMarqueeSelecting || !this.marqueeRect ) {
			return;
		}
		var rect = this.marqueeRect;
		this.ctx.save();
		this.ctx.strokeStyle = '#007bff';
		this.ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.fillRect( rect.x, rect.y, rect.width, rect.height );
		this.ctx.strokeRect( rect.x, rect.y, rect.width, rect.height );
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGrid = function () {
		var size = this.gridSize || 20;
		var w = this.canvas.width;
		var h = this.canvas.height;

		this.ctx.save();
		this.ctx.strokeStyle = '#e9ecef';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );

		// We need to account for pan/zoom if we want grid to move with canvas,
		// but usually grid is drawn in world coordinates.
		// Since we applied transform in redraw(), we are drawing in world coordinates.
		// But we need to cover the visible area.
		// For simplicity, let's draw a large enough grid or calculate visible bounds.
		// The original code drew from 0 to canvas.width/height which implies screen coordinates?
		// No, if transform is applied, 0,0 is world origin.
		// If we want infinite grid, we need to calculate bounds.
		// For now, let's just draw a fixed large area or match original behavior.
		// Original behavior: 0 to canvas.width. This is likely wrong if zoomed/panned.
		// But let's keep it simple and maybe improve later.
		// Actually, let's try to cover the visible area.
		var left = -this.panX / this.zoom;
		var top = -this.panY / this.zoom;
		var right = ( this.canvas.width - this.panX ) / this.zoom;
		var bottom = ( this.canvas.height - this.panY ) / this.zoom;

		// Snap to grid
		var startX = Math.floor( left / size ) * size;
		var startY = Math.floor( top / size ) * size;

		this.ctx.beginPath();
		for ( var x = startX; x < right; x += size ) {
			this.ctx.moveTo( x, top );
			this.ctx.lineTo( x, bottom );
		}
		for ( var y = startY; y < bottom; y += size ) {
			this.ctx.moveTo( left, y );
			this.ctx.lineTo( right, y );
		}
		this.ctx.stroke();
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawRulers = function () {
		// Rulers should be drawn in screen space (fixed to top/left)
		// So we need to reset transform temporarily.
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );

		var size = this.rulerSize;
		var w = this.canvas.width;
		var h = this.canvas.height;

		this.ctx.fillStyle = '#f3f3f3';
		this.ctx.fillRect( 0, 0, w, size );
		this.ctx.fillRect( 0, 0, size, h );

		this.ctx.strokeStyle = '#ddd';
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		this.ctx.moveTo( 0, size + 0.5 );
		this.ctx.lineTo( w, size + 0.5 );
		this.ctx.moveTo( size + 0.5, 0 );
		this.ctx.lineTo( size + 0.5, h );
		this.ctx.stroke();

		// Draw ticks... (simplified for now)
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGuides = function () {
		if ( !this.showGuides ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#26c6da';
		this.ctx.lineWidth = 1 / this.zoom; // Keep line width constant on screen
		this.ctx.setLineDash( [ 4 / this.zoom, 4 / this.zoom ] );

		// Guides are in world coordinates
		// We need to draw them across the visible area
		var top = -this.panY / this.zoom;
		var bottom = ( this.canvas.height - this.panY ) / this.zoom;
		var left = -this.panX / this.zoom;
		var right = ( this.canvas.width - this.panX ) / this.zoom;

		for ( var i = 0; i < this.verticalGuides.length; i++ ) {
			var gx = this.verticalGuides[ i ];
			this.ctx.beginPath();
			this.ctx.moveTo( gx, top );
			this.ctx.lineTo( gx, bottom );
			this.ctx.stroke();
		}
		for ( var j = 0; j < this.horizontalGuides.length; j++ ) {
			var gy = this.horizontalGuides[ j ];
			this.ctx.beginPath();
			this.ctx.moveTo( left, gy );
			this.ctx.lineTo( right, gy );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGuidePreview = function () {
		// This requires state about dragging guide.
		// We can pass it in or set it.
		// For now, let's assume the controller handles the preview by drawing it manually or we add state.
		// Let's add state methods: setDragGuide(orientation, pos)
		if ( !this.dragGuide ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#ff4081';
		this.ctx.lineWidth = 1 / this.zoom;
		this.ctx.setLineDash( [ 8 / this.zoom, 4 / this.zoom ] );

		var top = -this.panY / this.zoom;
		var bottom = ( this.canvas.height - this.panY ) / this.zoom;
		var left = -this.panX / this.zoom;
		var right = ( this.canvas.width - this.panX ) / this.zoom;

		if ( this.dragGuide.orientation === 'h' ) {
			this.ctx.beginPath();
			this.ctx.moveTo( left, this.dragGuide.pos );
			this.ctx.lineTo( right, this.dragGuide.pos );
			this.ctx.stroke();
		} else {
			this.ctx.beginPath();
			this.ctx.moveTo( this.dragGuide.pos, top );
			this.ctx.lineTo( this.dragGuide.pos, bottom );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.setDragGuide = function ( orientation, pos ) {
		if ( orientation ) {
			this.dragGuide = { orientation: orientation, pos: pos };
		} else {
			this.dragGuide = null;
		}
	};

	// --- Helpers ---

	CanvasRenderer.prototype.applyLayerStyle = function ( layer ) {
		if ( layer.fill ) {
			this.ctx.fillStyle = layer.fill;
		} else if ( layer.color ) {
			this.ctx.fillStyle = layer.color;
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
		}
		if ( layer.strokeWidth ) {
			this.ctx.lineWidth = layer.strokeWidth;
		}
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blendMode || layer.blend ) {
			this.ctx.globalCompositeOperation = layer.blendMode || layer.blend;
		}
		if ( layer.rotation ) {
			var centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
			var centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}
	};

	CanvasRenderer.prototype.withLocalAlpha = function ( factor, fn ) {
		var f = ( typeof factor === 'number' ) ? Math.max( 0, Math.min( 1, factor ) ) : 1;
		if ( f === 1 ) {
			fn();
			return;
		}
		var prev = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prev || 1 ) * f;
		try {
			fn();
		} finally {
			this.ctx.globalAlpha = prev;
		}
	};

	CanvasRenderer.prototype.clearShadow = function () {
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
	};

	CanvasRenderer.prototype.getLayerBounds = function ( layer ) {
		// Duplicate logic from CanvasManager to be self-contained or use editor?
		// It's better to be self-contained if possible, but it depends on measureTextLayer.
		// We have measureTextLayer here.
		if ( !layer ) {
			return null;
		}
		var baseBounds = this._getRawLayerBounds( layer );
		if ( !baseBounds ) {
			return null;
		}
		return baseBounds; // Simplified for now, rotation handled in drawSelectionIndicators
	};

	CanvasRenderer.prototype._getRawLayerBounds = function ( layer ) {
		// Simplified version of CanvasManager._getRawLayerBounds
		switch ( layer.type ) {
			case 'text':
				var metrics = this.measureTextLayer( layer );
				return metrics ? { x: metrics.originX, y: metrics.originY, width: metrics.width, height: metrics.height } : null;
			case 'rectangle':
			case 'highlight':
			case 'blur':
				return { x: layer.x || 0, y: layer.y || 0, width: layer.width || 0, height: layer.height || 0 };
			case 'circle':
				var r = layer.radius || 0;
				return { x: ( layer.x || 0 ) - r, y: ( layer.y || 0 ) - r, width: r * 2, height: r * 2 };
			case 'ellipse':
				var rx = layer.radiusX || 0;
				var ry = layer.radiusY || 0;
				return { x: ( layer.x || 0 ) - rx, y: ( layer.y || 0 ) - ry, width: rx * 2, height: ry * 2 };
			case 'line':
			case 'arrow':
				var x1 = layer.x1 || 0, y1 = layer.y1 || 0, x2 = layer.x2 || 0, y2 = layer.y2 || 0;
				return {
					x: Math.min( x1, x2 ), y: Math.min( y1, y2 ),
					width: Math.abs( x2 - x1 ), height: Math.abs( y2 - y1 )
				};
			case 'polygon':
			case 'star':
			case 'path':
				if ( layer.points && layer.points.length >= 3 ) {
					var minX = layer.points[ 0 ].x, maxX = minX, minY = layer.points[ 0 ].y, maxY = minY;
					for ( var i = 1; i < layer.points.length; i++ ) {
						minX = Math.min( minX, layer.points[ i ].x );
						maxX = Math.max( maxX, layer.points[ i ].x );
						minY = Math.min( minY, layer.points[ i ].y );
						maxY = Math.max( maxY, layer.points[ i ].y );
					}
					return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
				}
				// Fallback to radius for polygon/star if points are missing or insufficient
				if ( layer.type === 'polygon' || layer.type === 'star' ) {
					var r = layer.radius || ( layer.width ? layer.width / 2 : 50 );
					if ( layer.type === 'star' && layer.outerRadius ) {
						r = layer.outerRadius;
					}
					return { x: ( layer.x || 0 ) - r, y: ( layer.y || 0 ) - r, width: r * 2, height: r * 2 };
				}
				return { x: layer.x || 0, y: layer.y || 0, width: 100, height: 100 };
			default:
				return { x: layer.x || 0, y: layer.y || 0, width: layer.width || 0, height: layer.height || 0 };
		}
	};

	CanvasRenderer.prototype.drawErrorPlaceholder = function ( layer ) {
		this.ctx.save();
		this.ctx.fillStyle = '#ff9999';
		this.ctx.strokeStyle = '#cc0000';
		this.ctx.lineWidth = 2;

		var x = layer.x || 0;
		var y = layer.y || 0;
		var width = layer.width || 50;
		var height = layer.height || 50;

		this.ctx.fillRect( x, y, width, height );
		this.ctx.strokeRect( x, y, width, height );

		// Draw error icon (X)
		this.ctx.strokeStyle = '#ffffff';
		this.ctx.lineWidth = 3;
		this.ctx.beginPath();
		this.ctx.moveTo( x + 10, y + 10 );
		this.ctx.lineTo( x + width - 10, y + height - 10 );
		this.ctx.moveTo( x + width - 10, y + 10 );
		this.ctx.lineTo( x + 10, y + height - 10 );
		this.ctx.stroke();

		this.ctx.restore();
	};

	// Export
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasRenderer;
	} else if ( typeof window !== 'undefined' ) {
		window.CanvasRenderer = CanvasRenderer;
	}
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], function () {
			mw.CanvasRenderer = CanvasRenderer;
		} );
	}

}() );
