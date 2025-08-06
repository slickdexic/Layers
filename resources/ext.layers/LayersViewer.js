/**
 * Layers Viewer - Displays images with layers in articles
 * Lightweight viewer for non-editing contexts
 */
( function () {
	'use strict';

	/**
	 * LayersViewer class
	 *
	 * @param config
	 * @class
	 */
	function LayersViewer( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.imageElement = this.config.imageElement;
		this.layerData = this.config.layerData || [];
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
		this.canvas.style.zIndex = '1';

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
	};

	LayersViewer.prototype.resizeCanvasAndRender = function () {
		// Set canvas size to match image display size

		this.canvas.width = this.imageElement.naturalWidth || this.imageElement.width;
		this.canvas.height = this.imageElement.naturalHeight || this.imageElement.height;

		// Scale canvas to match image display size
		this.canvas.style.width = this.imageElement.offsetWidth + 'px';
		this.canvas.style.height = this.imageElement.offsetHeight + 'px';

		// Calculate scale factors
		this.scaleX = this.canvas.width / this.imageElement.offsetWidth;
		this.scaleY = this.canvas.height / this.imageElement.offsetHeight;

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

		switch ( layer.type ) {
			case 'text':
				this.renderText( layer );
				break;
			case 'rectangle':
				this.renderRectangle( layer );
				break;
			case 'circle':
				this.renderCircle( layer );
				break;
			case 'ellipse':
				this.renderEllipse( layer );
				break;
			case 'polygon':
				this.renderPolygon( layer );
				break;
			case 'star':
				this.renderStar( layer );
				break;
			case 'line':
				this.renderLine( layer );
				break;
			case 'arrow':
				this.renderArrow( layer );
				break;
			case 'highlight':
				this.renderHighlight( layer );
				break;
			case 'path':
				this.renderPath( layer );
				break;
		}
	};

	LayersViewer.prototype.renderText = function ( layer ) {
		this.ctx.save();
		this.ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fillRect( x, y, width, height );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
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
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderLine = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 1;

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
		this.ctx.lineWidth = layer.strokeWidth || 1;

		var x1 = layer.x1 || 0;
		var y1 = layer.y1 || 0;
		var x2 = layer.x2 || 0;
		var y2 = layer.y2 || 0;
		var arrowSize = layer.arrowSize || 10;

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
		this.ctx.beginPath();

		var x = layer.x || 0;
		var y = layer.y || 0;
		var radiusX = layer.radiusX || layer.width / 2 || 0;
		var radiusY = layer.radiusY || layer.height / 2 || 0;

		// Create ellipse using scaling transformation
		this.ctx.translate( x, y );
		this.ctx.scale( radiusX, radiusY );
		this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
		this.ctx.restore();

		this.ctx.save();
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
		if ( !layer.points || layer.points.length < 2 ) { return; }

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

	// Auto-initialize viewers on page load
	function initViewers() {
		var images = document.querySelectorAll( 'img[data-layers]' );
		images.forEach( function ( img ) {
			try {
				var layerData = JSON.parse( img.dataset.layers );
				var container = img.parentNode;

				new LayersViewer( {
					container: container,
					imageElement: img,
					layerData: layerData
				} );
			} catch ( e ) {
				// console.warn( 'Failed to initialize layers viewer:', e );
			}
		} );
	}

	// Initialize when DOM is ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initViewers );
	} else {
		initViewers();
	}

	// Export for manual initialization
	window.LayersViewer = LayersViewer;

}() );
