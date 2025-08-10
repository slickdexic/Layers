/**
 * Layers Viewer - Displays images with layers in articles
 * Lightweight viewer for non-editing contexts
 */
( function () {
	'use strict';

	/**
	 * LayersViewer class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the viewer.
	 * @param {HTMLImageElement} config.imageElement The image element to overlay.
	 * @param {Object} config.layerData The layer data to render.
	 */
	function LayersViewer( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.imageElement = this.config.imageElement;
		this.layerData = this.config.layerData || [];
		this.baseWidth = ( this.layerData && this.layerData.baseWidth ) || null;
		this.baseHeight = ( this.layerData && this.layerData.baseHeight ) || null;
		this.canvas = null;
		this.ctx = null;

		this.init();
	}

	LayersViewer.prototype.init = function () {
		if ( !this.container || !this.imageElement ) {
			return;
		}

		this.createCanvas();
		this.loadImageAndRender();
	};

	LayersViewer.prototype.createCanvas = function () {
		// Create canvas overlay
		this.canvas = document.createElement( 'canvas' );
		this.canvas.className = 'layers-viewer-canvas';
		this.canvas.style.position = 'absolute';
		this.canvas.style.top = '0';
		this.canvas.style.left = '0';
		this.canvas.style.pointerEvents = 'none';
		this.canvas.style.zIndex = '1000';

		this.ctx = this.canvas.getContext( '2d' );

		// Make container relative positioned
		if ( getComputedStyle( this.container ).position === 'static' ) {
			this.container.style.position = 'relative';
		}

		this.container.appendChild( this.canvas );
	};

	LayersViewer.prototype.loadImageAndRender = function () {
		var self = this;

		// Wait for image to load if not already loaded
		if ( this.imageElement.complete ) {
			this.resizeCanvasAndRender();
		} else {
			this.imageElement.addEventListener( 'load', function () {
				self.resizeCanvasAndRender();
			} );
		}

		// Re-render on window resize to keep overlay aligned
		window.addEventListener( 'resize', function () {
			self.resizeCanvasAndRender();
		} );
	};

	LayersViewer.prototype.resizeCanvasAndRender = function () {
		// Set canvas pixel size to MATCH the displayed image size for crisp alignment
		var displayW = this.imageElement.offsetWidth;
		var displayH = this.imageElement.offsetHeight;
		if ( !displayW || !displayH ) {
			// Fallback to natural dimensions when offsets are 0 (e.g., image hidden)
			displayW = this.imageElement.naturalWidth || this.imageElement.width || 0;
			displayH = this.imageElement.naturalHeight || this.imageElement.height || 0;
		}

		this.canvas.width = displayW;
		this.canvas.height = displayH;

		// Ensure CSS size matches exactly
		this.canvas.style.width = displayW + 'px';
		this.canvas.style.height = displayH + 'px';

		this.renderLayers();
	};

	LayersViewer.prototype.renderLayers = function () {
		if ( !this.layerData || !this.layerData.layers ) {
			return;
		}

		// Clear canvas
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Render each layer
		this.layerData.layers.forEach( function ( layer ) {
			this.renderLayer( layer );
		}.bind( this ) );
	};

	LayersViewer.prototype.renderLayer = function ( layer ) {
		// Skip invisible layers
		if ( layer.visible === false ) {
			return;
		}

		// Compute scaling from saved coordinates to current canvas size
		var sx = 1;
		var sy = 1;
		if ( this.baseWidth && this.baseHeight ) {
			sx = ( this.canvas.width || 1 ) / this.baseWidth;
			sy = ( this.canvas.height || 1 ) / this.baseHeight;
		}

		// Create a shallow copy and scale known coords
		var L = layer;
		if ( this.baseWidth && this.baseHeight ) {
			L = {};
			for ( var k in layer ) {
				if ( Object.prototype.hasOwnProperty.call( layer, k ) ) {
					L[ k ] = layer[ k ];
				}
			}
			if ( typeof L.x === 'number' ) {
				L.x = L.x * sx;
			}
			if ( typeof L.y === 'number' ) {
				L.y = L.y * sy;
			}
			if ( typeof L.width === 'number' ) {
				L.width = L.width * sx;
			}
			if ( typeof L.height === 'number' ) {
				L.height = L.height * sy;
			}
			if ( typeof L.radius === 'number' ) {
				L.radius = L.radius * ( ( sx + sy ) / 2 );
			}
			if ( typeof L.radiusX === 'number' ) {
				L.radiusX = L.radiusX * sx;
			}
			if ( typeof L.radiusY === 'number' ) {
				L.radiusY = L.radiusY * sy;
			}
			if ( typeof L.x1 === 'number' ) {
				L.x1 = L.x1 * sx;
			}
			if ( typeof L.y1 === 'number' ) {
				L.y1 = L.y1 * sy;
			}
			if ( typeof L.x2 === 'number' ) {
				L.x2 = L.x2 * sx;
			}
			if ( typeof L.y2 === 'number' ) {
				L.y2 = L.y2 * sy;
			}
			if ( Array.isArray( L.points ) ) {
				var pts = [];
				for ( var i = 0; i < L.points.length; i++ ) {
					var p = L.points[ i ];
					pts.push( { x: p.x * sx, y: p.y * sy } );
				}
				L.points = pts;
			}
		}

		switch ( L.type ) {
			case 'text':
				this.renderText( L );
				break;
			case 'rectangle':
				this.renderRectangle( L );
				break;
			case 'circle':
				this.renderCircle( L );
				break;
			case 'ellipse':
				this.renderEllipse( L );
				break;
			case 'polygon':
				this.renderPolygon( L );
				break;
			case 'star':
				this.renderStar( L );
				break;
			case 'line':
				this.renderLine( L );
				break;
			case 'arrow':
				this.renderArrow( L );
				break;
			case 'highlight':
				this.renderHighlight( L );
				break;
			case 'path':
				this.renderPath( L );
				break;
		}
	};

	LayersViewer.prototype.renderText = function ( layer ) {
		this.ctx.save();
		var scaleAvg = 1;
		if ( this.baseWidth && this.baseHeight ) {
			var sx = ( this.canvas.width || 1 ) / this.baseWidth;
			var sy = ( this.canvas.height || 1 ) / this.baseHeight;
			scaleAvg = ( sx + sy ) / 2;
		}
		var fontPx = layer.fontSize || 16;
		fontPx = Math.max( 1, Math.round( fontPx * scaleAvg ) );
		this.ctx.font = fontPx + 'px ' + ( layer.fontFamily || 'Arial' );
		this.ctx.fillStyle = layer.fill || '#000000';

		// Handle text shadow
		if ( layer.shadow ) {
			this.ctx.shadowColor = layer.shadow.color || '#000000';
			this.ctx.shadowBlur = layer.shadow.blur || 0;
			this.ctx.shadowOffsetX = layer.shadow.offsetX || 0;
			this.ctx.shadowOffsetY = layer.shadow.offsetY || 0;
		}

		this.ctx.fillText( layer.text || '', layer.x || 0, layer.y || 0 );
		this.ctx.restore();
	};

	LayersViewer.prototype.renderRectangle = function ( layer ) {
		this.ctx.save();

		var x = layer.x || 0;
		var y = layer.y || 0;
		var width = layer.width || 0;
		var height = layer.height || 0;
		var strokeW = layer.strokeWidth || 1;
		if ( this.baseWidth && this.baseHeight ) {
			var sx = ( this.canvas.width || 1 ) / this.baseWidth;
			var sy = ( this.canvas.height || 1 ) / this.baseHeight;
			strokeW = strokeW * ( ( sx + sy ) / 2 );
		}

		var hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			// rotate around rectangle center
			this.ctx.translate( x + width / 2, y + height / 2 );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			x = -width / 2;
			y = -height / 2;
		}

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fillRect( x, y, width, height );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = strokeW;
			this.ctx.strokeRect( x, y, width, height );
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderCircle = function ( layer ) {
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.arc( layer.x || 0, layer.y || 0, layer.radius || 0, 0, 2 * Math.PI );

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			var sw = layer.strokeWidth || 1;
			if ( this.baseWidth && this.baseHeight ) {
				var sx2 = ( this.canvas.width || 1 ) / this.baseWidth;
				var sy2 = ( this.canvas.height || 1 ) / this.baseHeight;
				sw = sw * ( ( sx2 + sy2 ) / 2 );
			}
			this.ctx.lineWidth = sw;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderLine = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		var sw = layer.strokeWidth || 1;
		if ( this.baseWidth && this.baseHeight ) {
			var sx = ( this.canvas.width || 1 ) / this.baseWidth;
			var sy = ( this.canvas.height || 1 ) / this.baseHeight;
			sw = sw * ( ( sx + sy ) / 2 );
		}
		this.ctx.lineWidth = sw;

		this.ctx.beginPath();
		this.ctx.moveTo( layer.x1 || 0, layer.y1 || 0 );
		this.ctx.lineTo( layer.x2 || 0, layer.y2 || 0 );
		this.ctx.stroke();

		this.ctx.restore();
	};

	LayersViewer.prototype.renderArrow = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		var sw = layer.strokeWidth || 1;
		var arrowSize = layer.arrowSize || 10;
		if ( this.baseWidth && this.baseHeight ) {
			var sx = ( this.canvas.width || 1 ) / this.baseWidth;
			var sy = ( this.canvas.height || 1 ) / this.baseHeight;
			var avg = ( sx + sy ) / 2;
			sw = sw * avg;
			arrowSize = arrowSize * avg;
		}
		this.ctx.lineWidth = sw;

		var x1 = layer.x1 || 0;
		var y1 = layer.y1 || 0;
		var x2 = layer.x2 || 0;
		var y2 = layer.y2 || 0;

		// Draw line
		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		this.ctx.stroke();

		// Draw arrow head
		var angle = Math.atan2( y2 - y1, x2 - x1 );
		var arrowAngle = Math.PI / 6;

		this.ctx.beginPath();
		this.ctx.moveTo( x2, y2 );
		this.ctx.lineTo(
			x2 - arrowSize * Math.cos( angle - arrowAngle ),
			y2 - arrowSize * Math.sin( angle - arrowAngle )
		);
		this.ctx.moveTo( x2, y2 );
		this.ctx.lineTo(
			x2 - arrowSize * Math.cos( angle + arrowAngle ),
			y2 - arrowSize * Math.sin( angle + arrowAngle )
		);
		this.ctx.stroke();

		this.ctx.restore();
	};

	LayersViewer.prototype.renderHighlight = function ( layer ) {
		this.ctx.save();
		this.ctx.fillStyle = layer.fill || '#ffff0080';
		this.ctx.fillRect( layer.x || 0, layer.y || 0, layer.width || 0, layer.height || 0 );
		this.ctx.restore();
	};

	LayersViewer.prototype.renderEllipse = function ( layer ) {
		this.ctx.save();
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radiusX = layer.radiusX || layer.width / 2 || 0;
		var radiusY = layer.radiusY || layer.height / 2 || 0;

		// Build the ellipse path under a scaled transform
		this.ctx.translate( x, y );
		this.ctx.beginPath();
		this.ctx.scale( Math.max( radiusX, 0.0001 ), Math.max( radiusY, 0.0001 ) );
		this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );

		// Fill/stroke while the transform is active
		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderPolygon = function ( layer ) {
		var sides = layer.sides || 6;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;

		this.ctx.save();
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderStar = function ( layer ) {
		var points = layer.points || 5;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var outerRadius = layer.outerRadius || layer.radius || 50;
		var innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();
		this.ctx.beginPath();

		for ( var i = 0; i < points * 2; i++ ) {
			var angle = ( i * Math.PI ) / points - Math.PI / 2;
			var radius = i % 2 === 0 ? outerRadius : innerRadius;
			var px = x + radius * Math.cos( angle );
			var py = y + radius * Math.sin( angle );

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderPath = function ( layer ) {
		if ( !layer.points || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( var i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.stroke();
		this.ctx.restore();
	};

	// Export for manual initialization; bootstrap handled in ext.layers/init.js
	window.LayersViewer = LayersViewer;

}() );
