/**
 * SVG Exporter for Layers Extension
 *
 * Converts layer data to SVG format for vector-editable export.
 *
 * @module SVGExporter
 */
'use strict';

/**
 * @class SVGExporter
 * @description Exports layer annotations to SVG format
 */
class SVGExporter {
	/**
	 * Create an SVG exporter instance
	 *
	 * @param {Object} options - Export options
	 * @param {number} options.width - Canvas width
	 * @param {number} options.height - Canvas height
	 * @param {boolean} options.includeBackground - Include background image
	 * @param {HTMLImageElement} options.backgroundImage - Background image element
	 * @param {number} options.backgroundOpacity - Background opacity (0-1)
	 */
	constructor( options = {} ) {
		this.width = options.width || 800;
		this.height = options.height || 600;
		this.includeBackground = options.includeBackground !== false;
		this.backgroundImage = options.backgroundImage || null;
		this.backgroundOpacity = options.backgroundOpacity !== undefined ? options.backgroundOpacity : 1;

		// SVG namespace
		this.svgNS = 'http://www.w3.org/2000/svg';
		this.xlinkNS = 'http://www.w3.org/1999/xlink';

		// Counter for unique IDs (markers, gradients, etc.)
		this.idCounter = 0;
	}

	/**
	 * Generate a unique ID for SVG elements
	 *
	 * @param {string} prefix - ID prefix
	 * @return {string} Unique ID
	 */
	generateId( prefix = 'layers' ) {
		return `${ prefix }-${ ++this.idCounter }`;
	}

	/**
	 * Export layers to SVG string
	 *
	 * @param {Array<Object>} layers - Array of layer objects
	 * @return {string} SVG markup string
	 */
	export( layers ) {
		// Reset ID counter for each export
		this.idCounter = 0;

		const defs = [];
		const elements = [];

		// Filter visible layers
		const visibleLayers = ( layers || [] ).filter( ( layer ) => layer.visible !== false );

		// Process each layer
		for ( const layer of visibleLayers ) {
			const result = this.convertLayer( layer );
			if ( result ) {
				if ( result.defs ) {
					defs.push( ...result.defs );
				}
				if ( result.element ) {
					elements.push( result.element );
				}
			}
		}

		// Build the SVG document
		return this.buildSVGDocument( defs, elements );
	}

	/**
	 * Build the complete SVG document
	 *
	 * @param {Array<string>} defs - SVG definitions (markers, gradients, etc.)
	 * @param {Array<string>} elements - SVG elements
	 * @return {string} Complete SVG markup
	 */
	buildSVGDocument( defs, elements ) {
		const parts = [
			`<?xml version="1.0" encoding="UTF-8"?>`,
			`<svg xmlns="${ this.svgNS }" xmlns:xlink="${ this.xlinkNS }" ` +
			`width="${ this.width }" height="${ this.height }" ` +
			`viewBox="0 0 ${ this.width } ${ this.height }">`
		];

		// Add background if requested
		if ( this.includeBackground && this.backgroundImage ) {
			const bgElement = this.createBackgroundElement();
			if ( bgElement ) {
				parts.push( bgElement );
			}
		}

		// Add definitions if any
		if ( defs.length > 0 ) {
			parts.push( '<defs>' );
			parts.push( ...defs );
			parts.push( '</defs>' );
		}

		// Add layer elements
		parts.push( ...elements );

		parts.push( '</svg>' );

		return parts.join( '\n' );
	}

	/**
	 * Create background element
	 *
	 * @return {string|null} SVG image element for background
	 */
	createBackgroundElement() {
		if ( !this.backgroundImage ) {
			return null;
		}

		// Convert background image to data URL if it's an Image element
		let href = '';
		if ( this.backgroundImage.src ) {
			href = this.backgroundImage.src;
		}

		if ( !href ) {
			return null;
		}

		const opacity = this.backgroundOpacity < 1 ? ` opacity="${ this.backgroundOpacity }"` : '';

		return `<image xlink:href="${ this.escapeXml( href ) }" ` +
			`x="0" y="0" width="${ this.width }" height="${ this.height }"${ opacity }/>`;
	}

	/**
	 * Convert a layer to SVG element(s)
	 *
	 * @param {Object} layer - Layer data
	 * @return {Object|null} Object with { defs: Array, element: string } or null
	 */
	convertLayer( layer ) {
		if ( !layer || !layer.type ) {
			return null;
		}

		// Apply group transform wrapper if layer has rotation
		const rotation = layer.rotation || 0;
		const hasRotation = Math.abs( rotation ) > 0.01;

		let result;

		switch ( layer.type ) {
			case 'rectangle':
				result = this.convertRectangle( layer );
				break;
			case 'circle':
				result = this.convertCircle( layer );
				break;
			case 'ellipse':
				result = this.convertEllipse( layer );
				break;
			case 'line':
				result = this.convertLine( layer );
				break;
			case 'arrow':
				result = this.convertArrow( layer );
				break;
			case 'polygon':
			case 'star':
				result = this.convertPolygon( layer );
				break;
			case 'path':
				result = this.convertPath( layer );
				break;
			case 'text':
				result = this.convertText( layer );
				break;
			case 'textbox':
				result = this.convertTextBox( layer );
				break;
			case 'image':
				result = this.convertImage( layer );
				break;
			case 'custom':
				result = this.convertCustomShape( layer );
				break;
			default:
				// Unknown layer type - skip
				return null;
		}

		if ( !result || !result.element ) {
			return null;
		}

		// Wrap in group with rotation transform if needed
		if ( hasRotation ) {
			const cx = this.getLayerCenterX( layer );
			const cy = this.getLayerCenterY( layer );
			result.element = `<g transform="rotate(${ rotation }, ${ cx }, ${ cy })">${ result.element }</g>`;
		}

		return result;
	}

	/**
	 * Get the center X coordinate of a layer
	 *
	 * @param {Object} layer - Layer data
	 * @return {number} Center X
	 */
	getLayerCenterX( layer ) {
		if ( layer.x !== undefined && layer.width !== undefined ) {
			return layer.x + layer.width / 2;
		}
		if ( layer.x !== undefined && layer.radius !== undefined ) {
			return layer.x;
		}
		if ( layer.x1 !== undefined && layer.x2 !== undefined ) {
			return ( layer.x1 + layer.x2 ) / 2;
		}
		return layer.x || 0;
	}

	/**
	 * Get the center Y coordinate of a layer
	 *
	 * @param {Object} layer - Layer data
	 * @return {number} Center Y
	 */
	getLayerCenterY( layer ) {
		if ( layer.y !== undefined && layer.height !== undefined ) {
			return layer.y + layer.height / 2;
		}
		if ( layer.y !== undefined && layer.radius !== undefined ) {
			return layer.y;
		}
		if ( layer.y1 !== undefined && layer.y2 !== undefined ) {
			return ( layer.y1 + layer.y2 ) / 2;
		}
		return layer.y || 0;
	}

	/**
	 * Convert rectangle layer to SVG
	 *
	 * @param {Object} layer - Rectangle layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertRectangle( layer ) {
		const attrs = [
			`x="${ layer.x || 0 }"`,
			`y="${ layer.y || 0 }"`,
			`width="${ layer.width || 100 }"`,
			`height="${ layer.height || 60 }"`
		];

		// Corner radius
		if ( layer.cornerRadius ) {
			attrs.push( `rx="${ layer.cornerRadius }"` );
			attrs.push( `ry="${ layer.cornerRadius }"` );
		}

		// Add style attributes
		attrs.push( ...this.getStyleAttributes( layer ) );

		return {
			defs: [],
			element: `<rect ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert circle layer to SVG
	 *
	 * @param {Object} layer - Circle layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertCircle( layer ) {
		const cx = layer.x || 0;
		const cy = layer.y || 0;
		const r = layer.radius || 50;

		const attrs = [
			`cx="${ cx }"`,
			`cy="${ cy }"`,
			`r="${ r }"`
		];

		attrs.push( ...this.getStyleAttributes( layer ) );

		return {
			defs: [],
			element: `<circle ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert ellipse layer to SVG
	 *
	 * @param {Object} layer - Ellipse layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertEllipse( layer ) {
		const cx = layer.x || 0;
		const cy = layer.y || 0;
		const rx = layer.radiusX || layer.width / 2 || 50;
		const ry = layer.radiusY || layer.height / 2 || 30;

		const attrs = [
			`cx="${ cx }"`,
			`cy="${ cy }"`,
			`rx="${ rx }"`,
			`ry="${ ry }"`
		];

		attrs.push( ...this.getStyleAttributes( layer ) );

		return {
			defs: [],
			element: `<ellipse ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert line layer to SVG
	 *
	 * @param {Object} layer - Line layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertLine( layer ) {
		const attrs = [
			`x1="${ layer.x1 || 0 }"`,
			`y1="${ layer.y1 || 0 }"`,
			`x2="${ layer.x2 || 100 }"`,
			`y2="${ layer.y2 || 100 }"`
		];

		attrs.push( ...this.getStyleAttributes( layer, { noFill: true } ) );

		return {
			defs: [],
			element: `<line ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert arrow layer to SVG
	 *
	 * @param {Object} layer - Arrow layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertArrow( layer ) {
		const defs = [];
		const markerId = this.generateId( 'arrow' );

		// Create arrowhead marker definition
		const arrowhead = layer.arrowhead || 'arrow';
		const stroke = layer.stroke || '#000000';
		const strokeWidth = layer.strokeWidth || 2;

		if ( arrowhead !== 'none' ) {
			const markerDef = this.createArrowMarker( markerId, arrowhead, stroke, strokeWidth );
			defs.push( markerDef );
		}

		const attrs = [
			`x1="${ layer.x1 || 0 }"`,
			`y1="${ layer.y1 || 0 }"`,
			`x2="${ layer.x2 || 100 }"`,
			`y2="${ layer.y2 || 100 }"`
		];

		attrs.push( ...this.getStyleAttributes( layer, { noFill: true } ) );

		// Add marker reference
		if ( arrowhead !== 'none' ) {
			attrs.push( `marker-end="url(#${ markerId })"` );
		}

		// Handle dashed/dotted styles
		const arrowStyle = layer.arrowStyle || 'solid';
		if ( arrowStyle === 'dashed' ) {
			attrs.push( `stroke-dasharray="${ strokeWidth * 3 }, ${ strokeWidth * 2 }"` );
		} else if ( arrowStyle === 'dotted' ) {
			attrs.push( `stroke-dasharray="${ strokeWidth }, ${ strokeWidth * 2 }"` );
		}

		return {
			defs: defs,
			element: `<line ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Create an arrow marker definition
	 *
	 * @param {string} id - Marker ID
	 * @param {string} type - Arrowhead type (arrow, circle, diamond, triangle)
	 * @param {string} color - Fill/stroke color
	 * @param {number} strokeWidth - Stroke width for sizing
	 * @return {string} SVG marker definition
	 */
	createArrowMarker( id, type, color, strokeWidth ) {
		const size = Math.max( 8, strokeWidth * 3 );
		const half = size / 2;

		let path;
		switch ( type ) {
			case 'circle':
				return `<marker id="${ id }" markerWidth="${ size }" markerHeight="${ size }" ` +
					`refX="${ half }" refY="${ half }" orient="auto">` +
					`<circle cx="${ half }" cy="${ half }" r="${ half * 0.6 }" fill="${ color }"/>` +
					`</marker>`;

			case 'diamond':
				path = `M${ half },0 L${ size },${ half } L${ half },${ size } L0,${ half } Z`;
				break;

			case 'triangle':
			case 'arrow':
			default:
				path = `M0,0 L${ size },${ half } L0,${ size } Z`;
				break;
		}

		return `<marker id="${ id }" markerWidth="${ size }" markerHeight="${ size }" ` +
			`refX="${ size }" refY="${ half }" orient="auto">` +
			`<path d="${ path }" fill="${ color }"/>` +
			`</marker>`;
	}

	/**
	 * Convert polygon/star layer to SVG
	 *
	 * @param {Object} layer - Polygon layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertPolygon( layer ) {
		const points = layer.points || [];
		if ( points.length < 3 ) {
			return null;
		}

		const pointsStr = points.map( ( p ) => `${ p.x },${ p.y }` ).join( ' ' );

		const attrs = [
			`points="${ pointsStr }"`
		];

		attrs.push( ...this.getStyleAttributes( layer ) );

		return {
			defs: [],
			element: `<polygon ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert path layer to SVG
	 *
	 * @param {Object} layer - Path layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertPath( layer ) {
		const points = layer.points || [];
		if ( points.length < 2 ) {
			return null;
		}

		// Build path data
		let d = `M${ points[ 0 ].x },${ points[ 0 ].y }`;
		for ( let i = 1; i < points.length; i++ ) {
			d += ` L${ points[ i ].x },${ points[ i ].y }`;
		}

		const attrs = [
			`d="${ d }"`
		];

		attrs.push( ...this.getStyleAttributes( layer, { noFill: true } ) );

		return {
			defs: [],
			element: `<path ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert text layer to SVG
	 *
	 * @param {Object} layer - Text layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertText( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const text = layer.text || '';

		const attrs = [
			`x="${ x }"`,
			`y="${ y }"`
		];

		// Font properties
		const fontFamily = layer.fontFamily || 'Arial, sans-serif';
		const fontSize = layer.fontSize || 16;
		const fontWeight = layer.fontWeight || 'normal';
		const fontStyle = layer.fontStyle || 'normal';

		attrs.push( `font-family="${ this.escapeXml( fontFamily ) }"` );
		attrs.push( `font-size="${ fontSize }"` );
		if ( fontWeight !== 'normal' ) {
			attrs.push( `font-weight="${ fontWeight }"` );
		}
		if ( fontStyle !== 'normal' ) {
			attrs.push( `font-style="${ fontStyle }"` );
		}

		// Text color
		const fill = layer.color || layer.fill || '#000000';
		attrs.push( `fill="${ fill }"` );

		// Text stroke
		if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
			attrs.push( `stroke="${ layer.textStrokeColor || '#000000' }"` );
			attrs.push( `stroke-width="${ layer.textStrokeWidth }"` );
			attrs.push( 'paint-order="stroke"' );
		}

		// Opacity
		if ( layer.opacity !== undefined && layer.opacity < 1 ) {
			attrs.push( `opacity="${ layer.opacity }"` );
		}

		// Dominant baseline for vertical alignment
		attrs.push( 'dominant-baseline="hanging"' );

		const escapedText = this.escapeXml( text );

		return {
			defs: [],
			element: `<text ${ attrs.join( ' ' ) }>${ escapedText }</text>`
		};
	}

	/**
	 * Convert textbox layer to SVG
	 *
	 * @param {Object} layer - Textbox layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertTextBox( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 200;
		const height = layer.height || 100;
		const text = layer.text || '';
		const padding = layer.padding || 8;

		const elements = [];

		// Background rectangle
		const rectAttrs = [
			`x="${ x }"`,
			`y="${ y }"`,
			`width="${ width }"`,
			`height="${ height }"`
		];

		if ( layer.cornerRadius ) {
			rectAttrs.push( `rx="${ layer.cornerRadius }"` );
			rectAttrs.push( `ry="${ layer.cornerRadius }"` );
		}

		rectAttrs.push( ...this.getStyleAttributes( layer ) );
		elements.push( `<rect ${ rectAttrs.join( ' ' ) }/>` );

		// Text element
		const textX = x + padding;
		const textY = y + padding;

		const textAttrs = [
			`x="${ textX }"`,
			`y="${ textY }"`
		];

		const fontFamily = layer.fontFamily || 'Arial, sans-serif';
		const fontSize = layer.fontSize || 16;

		textAttrs.push( `font-family="${ this.escapeXml( fontFamily ) }"` );
		textAttrs.push( `font-size="${ fontSize }"` );
		textAttrs.push( `fill="${ layer.color || '#000000' }"` );
		textAttrs.push( 'dominant-baseline="hanging"' );

		// Text alignment
		const textAlign = layer.textAlign || 'left';
		if ( textAlign === 'center' ) {
			textAttrs[ 0 ] = `x="${ x + width / 2 }"`;
			textAttrs.push( 'text-anchor="middle"' );
		} else if ( textAlign === 'right' ) {
			textAttrs[ 0 ] = `x="${ x + width - padding }"`;
			textAttrs.push( 'text-anchor="end"' );
		}

		const escapedText = this.escapeXml( text );
		elements.push( `<text ${ textAttrs.join( ' ' ) }>${ escapedText }</text>` );

		return {
			defs: [],
			element: `<g>${ elements.join( '' ) }</g>`
		};
	}

	/**
	 * Convert image layer to SVG
	 *
	 * @param {Object} layer - Image layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertImage( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 100;
		const height = layer.height || 100;
		const src = layer.src || '';

		if ( !src ) {
			return null;
		}

		const attrs = [
			`x="${ x }"`,
			`y="${ y }"`,
			`width="${ width }"`,
			`height="${ height }"`,
			`xlink:href="${ this.escapeXml( src ) }"`
		];

		if ( layer.opacity !== undefined && layer.opacity < 1 ) {
			attrs.push( `opacity="${ layer.opacity }"` );
		}

		return {
			defs: [],
			element: `<image ${ attrs.join( ' ' ) }/>`
		};
	}

	/**
	 * Convert custom shape layer to SVG
	 *
	 * @param {Object} layer - Custom shape layer
	 * @return {Object} { defs: [], element: string }
	 */
	convertCustomShape( layer ) {
		// Custom shapes store SVG path data
		const pathData = layer.pathData || layer.svgPath;
		if ( !pathData ) {
			return null;
		}

		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 100;
		const height = layer.height || 100;

		// Original viewBox dimensions (for scaling)
		const originalWidth = layer.originalWidth || 100;
		const originalHeight = layer.originalHeight || 100;

		// Calculate scale factors
		const scaleX = width / originalWidth;
		const scaleY = height / originalHeight;

		const attrs = [
			`d="${ pathData }"`
		];

		attrs.push( ...this.getStyleAttributes( layer ) );

		// Wrap in group with transform for positioning and scaling
		const transform = `translate(${ x }, ${ y }) scale(${ scaleX }, ${ scaleY })`;

		return {
			defs: [],
			element: `<g transform="${ transform }"><path ${ attrs.join( ' ' ) }/></g>`
		};
	}

	/**
	 * Get common style attributes for SVG elements
	 *
	 * @param {Object} layer - Layer data
	 * @param {Object} options - Options
	 * @param {boolean} options.noFill - Don't include fill (for lines/paths)
	 * @return {Array<string>} Array of attribute strings
	 */
	getStyleAttributes( layer, options = {} ) {
		const attrs = [];

		// Fill
		if ( !options.noFill ) {
			const fill = layer.fill || 'none';
			if ( fill === 'blur' ) {
				// Blur fill not supported in basic SVG - use semi-transparent white
				attrs.push( 'fill="rgba(255,255,255,0.7)"' );
			} else {
				attrs.push( `fill="${ fill }"` );
			}

			if ( layer.fillOpacity !== undefined && layer.fillOpacity < 1 ) {
				attrs.push( `fill-opacity="${ layer.fillOpacity }"` );
			}
		} else {
			attrs.push( 'fill="none"' );
		}

		// Stroke
		const stroke = layer.stroke || 'none';
		if ( stroke && stroke !== 'none' ) {
			attrs.push( `stroke="${ stroke }"` );
			attrs.push( `stroke-width="${ layer.strokeWidth || 2 }"` );

			if ( layer.strokeOpacity !== undefined && layer.strokeOpacity < 1 ) {
				attrs.push( `stroke-opacity="${ layer.strokeOpacity }"` );
			}
		}

		// Overall opacity
		if ( layer.opacity !== undefined && layer.opacity < 1 ) {
			attrs.push( `opacity="${ layer.opacity }"` );
		}

		return attrs;
	}

	/**
	 * Escape XML special characters
	 *
	 * @param {string} str - String to escape
	 * @return {string} Escaped string
	 */
	escapeXml( str ) {
		if ( typeof str !== 'string' ) {
			return '';
		}
		return str
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&apos;' );
	}

	/**
	 * Export layers to SVG Blob
	 *
	 * @param {Array<Object>} layers - Array of layer objects
	 * @return {Blob} SVG blob
	 */
	exportToBlob( layers ) {
		const svgString = this.export( layers );
		return new Blob( [ svgString ], { type: 'image/svg+xml;charset=utf-8' } );
	}

	/**
	 * Export layers to data URL
	 *
	 * @param {Array<Object>} layers - Array of layer objects
	 * @return {string} Data URL
	 */
	exportToDataURL( layers ) {
		const svgString = this.export( layers );
		const encoded = encodeURIComponent( svgString )
			.replace( /'/g, '%27' )
			.replace( /"/g, '%22' );
		return `data:image/svg+xml,${ encoded }`;
	}
}

// Register in namespace
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Export = window.Layers.Export || {};
	window.Layers.Export.SVGExporter = SVGExporter;
}

// CommonJS export for testing
/* eslint-disable-next-line no-undef */
if ( typeof module !== 'undefined' && module.exports ) {
	/* eslint-disable-next-line no-undef */
	module.exports = SVGExporter;
}
