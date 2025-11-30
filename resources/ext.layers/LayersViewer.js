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
		this.resizeObserver = null; // ResizeObserver instance
		this.rAFId = null; // throttle reflows
		this.boundWindowResize = null; // handler reference

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
		const self = this;

		// Wait for image to load if not already loaded
		if ( this.imageElement.complete ) {
			this.resizeCanvasAndRender();
		} else {
			this.imageElement.addEventListener( 'load', function () {
				self.resizeCanvasAndRender();
			} );
		}

		// Re-render on window resize to keep overlay aligned
		this.boundWindowResize = function () {
			self.scheduleResize();
		};
		window.addEventListener( 'resize', this.boundWindowResize );

		// Re-render when the image element's box size changes (responsive layout, thumb swaps)
		if ( typeof window.ResizeObserver === 'function' ) {
			try {
				this.resizeObserver = new window.ResizeObserver( function () {
					self.scheduleResize();
				} );
				this.resizeObserver.observe( this.imageElement );
			} catch ( e ) {
				// ResizeObserver may fail in some browsers - log for debugging
				if ( window.mw && window.mw.log ) {
					mw.log.warn( '[LayersViewer] ResizeObserver setup failed:', e.message );
				}
			}
		}
	};

	// Coalesce multiple resize calls into a single frame
	LayersViewer.prototype.scheduleResize = function () {
		const self = this;
		if ( this.rAFId ) {
			return;
		}
		this.rAFId = window.requestAnimationFrame( function () {
			self.rAFId = null;
			self.resizeCanvasAndRender();
		} );
	};

	// Cleanup observers and listeners if the element is removed
	LayersViewer.prototype.destroy = function () {
		if ( this.resizeObserver && typeof this.resizeObserver.disconnect === 'function' ) {
			try {
				this.resizeObserver.disconnect();
			} catch ( e ) {
				// Disconnect may fail if observer was already disconnected
				if ( window.mw && window.mw.log ) {
					mw.log.warn( '[LayersViewer] ResizeObserver disconnect failed:', e.message );
				}
			}
		}
		if ( this.boundWindowResize ) {
			window.removeEventListener( 'resize', this.boundWindowResize );
			this.boundWindowResize = null;
		}
		if ( this.rAFId ) {
			try {
				window.cancelAnimationFrame( this.rAFId );
			} catch ( cancelError ) {
				// cancelAnimationFrame failed - likely invalid ID, safe to ignore
				mw.log.warn( '[LayersViewer] cancelAnimationFrame failed:', cancelError.message );
			}
			this.rAFId = null;
		}
	};

// Temporarily adjusts global alpha for a draw call and restores afterward
LayersViewer.prototype.withLocalAlpha = function ( alpha, drawFn ) {
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
};

	LayersViewer.prototype.resizeCanvasAndRender = function () {
		// Set canvas pixel size to MATCH the displayed image size for crisp alignment
		let displayW = this.imageElement.offsetWidth;
		let displayH = this.imageElement.offsetHeight;
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

		// Render layers from bottom to top so top-most (index 0 in editor) is drawn last.
		// The editor maintains layers with index 0 as visually top-most and draws end->start;
		// mirror that here by iterating from the array end to start.
		const layers = Array.isArray( this.layerData.layers ) ? this.layerData.layers : [];
		for ( let i = layers.length - 1; i >= 0; i-- ) {
			this.renderLayer( layers[ i ] );
		}
	};

	LayersViewer.prototype.renderLayer = function ( layer ) {
		// Skip invisible layers
		// Empty string '' is treated as visible (default), only explicit false hides layer
		if ( layer.visible === false || layer.visible === 'false' || layer.visible === '0' || layer.visible === 0 ) {
			return;
		}

		// Compute scaling from saved coordinates to current canvas size
		let sx = 1;
		let sy = 1;
		let scaleAvg = 1;
		if ( this.baseWidth && this.baseHeight ) {
			sx = ( this.canvas.width || 1 ) / this.baseWidth;
			sy = ( this.canvas.height || 1 ) / this.baseHeight;
			scaleAvg = ( sx + sy ) / 2;
		}

		// Create a shallow copy and scale known coords
		let L = layer;
		if ( this.baseWidth && this.baseHeight ) {
			L = {};
			for ( const k in layer ) {
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
				L.radius = L.radius * scaleAvg;
			}
			if ( typeof L.outerRadius === 'number' ) {
				L.outerRadius = L.outerRadius * scaleAvg;
			}
			if ( typeof L.innerRadius === 'number' ) {
				L.innerRadius = L.innerRadius * scaleAvg;
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
				const pts = [];
				for ( let i = 0; i < L.points.length; i++ ) {
					const p = L.points[ i ];
					pts.push( { x: p.x * sx, y: p.y * sy } );
				}
				L.points = pts;
			}
		}

		// Apply per-layer effects (opacity, blend, shadow) around the draw
		// Shadow MUST be applied at this outer context level to persist through rendering
		this.ctx.save();
		if ( typeof layer.opacity === 'number' ) {
			// Clamp to [0,1]
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blend ) {
			try {
				this.ctx.globalCompositeOperation = String( layer.blend );
			} catch ( e ) {
				// Browser doesn't support this blend mode - log and continue with default
				if ( window.mw && window.mw.log ) {
					mw.log.warn( '[LayersViewer] Unsupported blend mode: ' + layer.blend );
				}
			}
		}

		// Apply shadow at OUTER context - critical for proper rendering
		// Calculate shadow scale factors
		let shadowScaleX = 1, shadowScaleY = 1, shadowScaleAvg = 1;
		if ( this.baseWidth && this.baseHeight ) {
			shadowScaleX = ( this.canvas.width || 1 ) / this.baseWidth;
			shadowScaleY = ( this.canvas.height || 1 ) / this.baseHeight;
			shadowScaleAvg = ( shadowScaleX + shadowScaleY ) / 2;
		}

		// Apply shadow settings at outer context
		// Check if shadow properties exist (handles case where shadow: "" but shadowColor is set)
		const hasShadowData = layer.shadowColor || layer.shadowBlur || layer.shadowOffsetX || layer.shadowOffsetY;
		const shadowExplicitlyEnabled = layer.shadow === true || layer.shadow === 'true' || layer.shadow === 1 || layer.shadow === '1';
		
		if ( shadowExplicitlyEnabled || hasShadowData ) {
			// Apply shadow properties - works with flat format
			this.ctx.shadowColor = layer.shadowColor || '#000000';
			this.ctx.shadowBlur = ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * shadowScaleAvg;
			this.ctx.shadowOffsetX = ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * shadowScaleX;
			this.ctx.shadowOffsetY = ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * shadowScaleY;
		} else if ( typeof layer.shadow === 'object' && layer.shadow ) {
			// Legacy nested format (shadow: {color: '#000', blur: 5, etc.})
			this.ctx.shadowColor = layer.shadow.color || '#000000';
			this.ctx.shadowBlur = ( typeof layer.shadow.blur === 'number' ? layer.shadow.blur : 8 ) * shadowScaleAvg;
			this.ctx.shadowOffsetX = ( typeof layer.shadow.offsetX === 'number' ? layer.shadow.offsetX : 2 ) * shadowScaleX;
			this.ctx.shadowOffsetY = ( typeof layer.shadow.offsetY === 'number' ? layer.shadow.offsetY : 2 ) * shadowScaleY;
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
			case 'blur':
				this.renderBlur( L );
				break;
		}

		// Restore to pre-layer state
		this.ctx.restore();
	};

	LayersViewer.prototype.renderText = function ( layer ) {
		this.ctx.save();
		
		let scaleAvg = 1;
		if ( this.baseWidth && this.baseHeight ) {
			const sx = ( this.canvas.width || 1 ) / this.baseWidth;
			const sy = ( this.canvas.height || 1 ) / this.baseHeight;
			scaleAvg = ( sx + sy ) / 2;
		}
		let fontPx = layer.fontSize || 16;
		fontPx = Math.max( 1, Math.round( fontPx * scaleAvg ) );
		this.ctx.font = fontPx + 'px ' + ( layer.fontFamily || 'Arial' );
		this.ctx.textAlign = layer.textAlign || 'left';
		this.ctx.fillStyle = layer.fill || '#000000';

		let x = layer.x || 0;
		let y = layer.y || 0;
		const text = layer.text || '';

		// Calculate text dimensions for proper rotation centering
		const textMetrics = this.ctx.measureText( text );
		const textWidth = textMetrics.width;
		const textHeight = fontPx;

		// Calculate text center for rotation
		const centerX = x + ( textWidth / 2 );
		const centerY = y - ( textHeight / 4 ); // Adjust for text baseline

		// Apply rotation if present
		if ( layer.rotation && layer.rotation !== 0 ) {
			const rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			// Adjust drawing position to account for center rotation
			x = -( textWidth / 2 );
			y = textHeight / 4;
		}

		// Draw text stroke if enabled
		if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
			this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
			this.ctx.lineWidth = layer.textStrokeWidth * scaleAvg;
			this.ctx.strokeText( text, x, y );
		}

		this.ctx.fillText( text, x, y );
		this.ctx.restore();
	};

	LayersViewer.prototype.renderRectangle = function ( layer ) {
		this.ctx.save();

		let x = layer.x || 0;
		let y = layer.y || 0;
		const width = layer.width || 0;
		const height = layer.height || 0;
		let strokeW = layer.strokeWidth || 1;
		if ( this.baseWidth && this.baseHeight ) {
			const sx = ( this.canvas.width || 1 ) / this.baseWidth;
			const sy = ( this.canvas.height || 1 ) / this.baseHeight;
			strokeW = strokeW * ( ( sx + sy ) / 2 );
		}

		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			// rotate around rectangle center
			this.ctx.translate( x + width / 2, y + height / 2 );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			x = -width / 2;
			y = -height / 2;
		}

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.withLocalAlpha( layer.fillOpacity, function () {
				this.ctx.fillRect( x, y, width, height );
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = strokeW;
			this.withLocalAlpha( layer.strokeOpacity, function () {
				this.ctx.strokeRect( x, y, width, height );
			} );
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderCircle = function ( layer ) {
		this.ctx.save();
		
		this.ctx.beginPath();
		this.ctx.arc( layer.x || 0, layer.y || 0, layer.radius || 0, 0, 2 * Math.PI );

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.withLocalAlpha( layer.fillOpacity, function () {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			let sw = layer.strokeWidth || 1;
			if ( this.baseWidth && this.baseHeight ) {
				const sx2 = ( this.canvas.width || 1 ) / this.baseWidth;
				const sy2 = ( this.canvas.height || 1 ) / this.baseHeight;
				sw = sw * ( ( sx2 + sy2 ) / 2 );
			}
			this.ctx.lineWidth = sw;
			this.withLocalAlpha( layer.strokeOpacity, function () {
				this.ctx.stroke();
			} );
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderLine = function ( layer ) {
		this.ctx.save();
		
		this.ctx.strokeStyle = layer.stroke || '#000000';
		let sw = layer.strokeWidth || 1;
		if ( this.baseWidth && this.baseHeight ) {
			const sx = ( this.canvas.width || 1 ) / this.baseWidth;
			const sy = ( this.canvas.height || 1 ) / this.baseHeight;
			sw = sw * ( ( sx + sy ) / 2 );
		}
		this.ctx.lineWidth = sw;

		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;

		// Apply rotation around line center if present
		if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
			const centerX = ( x1 + x2 ) / 2;
			const centerY = ( y1 + y2 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			this.ctx.translate( -centerX, -centerY );
		}

		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		this.ctx.stroke();

		this.ctx.restore();
	};

	LayersViewer.prototype.renderArrow = function ( layer ) {
		this.ctx.save();
		
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		let sw = layer.strokeWidth || 1;
		let arrowSize = layer.arrowSize || 10;
		if ( this.baseWidth && this.baseHeight ) {
			const sx = ( this.canvas.width || 1 ) / this.baseWidth;
			const sy = ( this.canvas.height || 1 ) / this.baseHeight;
			const avg = ( sx + sy ) / 2;
			sw = sw * avg;
			arrowSize = arrowSize * avg;
		}
		this.ctx.lineWidth = sw;

		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;

		// Apply rotation around arrow center if present
		if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
			const centerX = ( x1 + x2 ) / 2;
			const centerY = ( y1 + y2 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			this.ctx.translate( -centerX, -centerY );
		}

		// Draw line
		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		this.ctx.stroke();

		// Draw arrow head
		const angle = Math.atan2( y2 - y1, x2 - x1 );
		const arrowAngle = Math.PI / 6;

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
		
		let x = layer.x || 0;
		let y = layer.y || 0;
		const width = layer.width || 0;
		const height = layer.height || 0;

		// Handle rotation around highlight center (like rectangle)
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.translate( x + width / 2, y + height / 2 );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			x = -width / 2;
			y = -height / 2;
		}

		// Set fill color
		this.ctx.fillStyle = layer.color || layer.fill || '#ffff00';

		// Apply opacity - use opacity, fillOpacity, or default to 0.3 for highlights
		let opacity = 0.3;
		if ( typeof layer.opacity === 'number' && !Number.isNaN( layer.opacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.opacity ) );
		} else if ( typeof layer.fillOpacity === 'number' && !Number.isNaN( layer.fillOpacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.fillOpacity ) );
		}
		this.ctx.globalAlpha = opacity;

		this.ctx.fillRect( x, y, width, height );
		this.ctx.restore();
	};

	LayersViewer.prototype.renderEllipse = function ( layer ) {
		this.ctx.save();
		
		const x = layer.x || 0;
		const y = layer.y || 0;
		const radiusX = layer.radiusX || layer.width / 2 || 0;
		const radiusY = layer.radiusY || layer.height / 2 || 0;

		// Translate to center, apply rotation if present, then scale
		this.ctx.translate( x, y );
		
		// Apply rotation around the ellipse's center
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
		}

		// Build the ellipse path under a scaled transform
		this.ctx.beginPath();
		this.ctx.scale( Math.max( radiusX, 0.0001 ), Math.max( radiusY, 0.0001 ) );
		this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );

		// Fill/stroke while the transform is active

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.withLocalAlpha( layer.fillOpacity, function () {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			let ellipseStroke = layer.strokeWidth || 1;
			if ( this.baseWidth && this.baseHeight ) {
				const ellipseSx = ( this.canvas.width || 1 ) / this.baseWidth;
				const ellipseSy = ( this.canvas.height || 1 ) / this.baseHeight;
				ellipseStroke = ellipseStroke * ( ( ellipseSx + ellipseSy ) / 2 );
			}
			this.ctx.lineWidth = ellipseStroke;
			this.withLocalAlpha( layer.strokeOpacity, function () {
				this.ctx.stroke();
			} );
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderPolygon = function ( layer ) {
		const sides = layer.sides || 6;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const radius = layer.radius || 50;

		this.ctx.save();

		// Apply rotation around the polygon's center (x, y)
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.withLocalAlpha( layer.fillOpacity, function () {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			let polygonStroke = layer.strokeWidth || 1;
			if ( this.baseWidth && this.baseHeight ) {
				const polySx = ( this.canvas.width || 1 ) / this.baseWidth;
				const polySy = ( this.canvas.height || 1 ) / this.baseHeight;
				polygonStroke = polygonStroke * ( ( polySx + polySy ) / 2 );
			}
			this.ctx.lineWidth = polygonStroke;
			this.withLocalAlpha( layer.strokeOpacity, function () {
				this.ctx.stroke();
			} );
		}

		this.ctx.restore();
	};

	LayersViewer.prototype.renderStar = function ( layer ) {
		const points = layer.points || 5;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const outerRadius = layer.outerRadius || layer.radius || 50;
		const innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();

		// Apply rotation around the star's center (x, y)
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.withLocalAlpha( layer.fillOpacity, function () {
				this.ctx.fill();
			} );

			// Disable shadow for stroke to prevent it from rendering on top of the fill
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			let starStroke = layer.strokeWidth || 1;
			if ( this.baseWidth && this.baseHeight ) {
				const starSx = ( this.canvas.width || 1 ) / this.baseWidth;
				const starSy = ( this.canvas.height || 1 ) / this.baseHeight;
				starStroke = starStroke * ( ( starSx + starSy ) / 2 );
			}
			this.ctx.lineWidth = starStroke;
			this.withLocalAlpha( layer.strokeOpacity, function () {
				this.ctx.stroke();
			} );
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

		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.stroke();
		this.ctx.restore();
	};

	LayersViewer.prototype.renderBlur = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 0;
		const h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		// Calculate scaled coordinates based on canvas/image ratio
		let sx = 1;
		let sy = 1;
		if ( this.baseWidth && this.baseHeight ) {
			sx = ( this.canvas.width || 1 ) / this.baseWidth;
			sy = ( this.canvas.height || 1 ) / this.baseHeight;
		}

		const scaledX = x * sx;
		const scaledY = y * sy;
		const scaledW = w * sx;
		const scaledH = h * sy;

		// Check if we can access the source image
		if ( !this.imageElement || !this.imageElement.complete ) {
			// Fallback: draw a semi-transparent gray overlay to indicate blur area
			this.ctx.save();
			this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
			this.ctx.fillRect( scaledX, scaledY, scaledW, scaledH );
			this.ctx.restore();
			return;
		}

		// Create temporary canvas for blur effect
		const tempCanvas = document.createElement( 'canvas' );
		tempCanvas.width = Math.max( 1, Math.ceil( scaledW ) );
		tempCanvas.height = Math.max( 1, Math.ceil( scaledH ) );
		const tempCtx = tempCanvas.getContext( '2d' );

		if ( !tempCtx ) {
			return;
		}

		// Calculate source coordinates in the original image
		const imgW = this.imageElement.naturalWidth || this.imageElement.width;
		const imgH = this.imageElement.naturalHeight || this.imageElement.height;
		const imgScaleX = imgW / ( this.canvas.width || 1 );
		const imgScaleY = imgH / ( this.canvas.height || 1 );

		const srcX = scaledX * imgScaleX;
		const srcY = scaledY * imgScaleY;
		const srcW = scaledW * imgScaleX;
		const srcH = scaledH * imgScaleY;

		// Draw the portion of the image to the temp canvas
		try {
			tempCtx.drawImage(
				this.imageElement,
				srcX, srcY, srcW, srcH,
				0, 0, tempCanvas.width, tempCanvas.height
			);
		} catch ( e ) {
			// CORS or other error - fallback to gray overlay
			this.ctx.save();
			this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
			this.ctx.fillRect( scaledX, scaledY, scaledW, scaledH );
			this.ctx.restore();
			return;
		}

		// Apply blur filter and draw back to main canvas
		const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
		this.ctx.save();
		this.ctx.filter = 'blur(' + radius + 'px)';
		this.ctx.drawImage( tempCanvas, scaledX, scaledY, scaledW, scaledH );
		this.ctx.filter = 'none';
		this.ctx.restore();
	};

	// Export for manual initialization; bootstrap handled in ext.layers/init.js
	window.LayersViewer = LayersViewer;

}() );
