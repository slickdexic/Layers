/**
 * LayerBounds - Shared axis-aligned bounds for rendered layer geometry.
 *
 * Bounds are expressed in surface pixels and include the layer's rotation.
 * Text layers without an explicit width may provide a measurement callback.
 *
 * @module LayerBounds
 */
( function () {
	'use strict';

	class LayerBounds {
		/**
		 * Return the axis-aligned surface-pixel box that contains a layer.
		 *
		 * @param {Object} layer Layer data
		 * @param {Object} [options={}] Optional measurement callback
		 * @param {Function} [options.measureText] Returns {width, height} for text
		 * @return {{x:number,y:number,width:number,height:number}|null}
		 */
		static getBounds( layer, options ) {
			if ( !layer || !layer.type || layer.type === 'group' ) {
				return null;
			}

			let bounds;
			let rectX;
			let rectY;
			let safeWidth;
			let safeHeight;

			switch ( layer.type ) {
				case 'text': {
					let measured;
					if ( layer.width === undefined ) {
						if ( !options || typeof options.measureText !== 'function' ) {
						return null;
					}
						measured = options.measureText( layer );
						if ( !measured || measured.width === undefined || measured.height === undefined ) {
							return null;
						}
					}
					bounds = {
						x: layer.x || 0,
						y: layer.y || 0,
						width: layer.width === undefined ? measured.width : ( layer.width || 0 ),
						height: layer.height === undefined ? ( measured ? measured.height : 0 ) : ( layer.height || 0 )
					};
					break;
				}
				case 'rectangle':
				case 'textbox':
				case 'callout':
				case 'image':
					rectX = layer.x || 0;
					rectY = layer.y || 0;
					safeWidth = layer.width || 0;
					safeHeight = layer.height || 0;
					if ( safeWidth < 0 ) {
						rectX += safeWidth;
						safeWidth = Math.abs( safeWidth );
					}
					if ( safeHeight < 0 ) {
						rectY += safeHeight;
						safeHeight = Math.abs( safeHeight );
					}
					bounds = { x: rectX, y: rectY, width: safeWidth, height: safeHeight };
					break;
				case 'circle': {
					const radius = Math.abs( layer.radius || 0 );
					bounds = {
						x: ( layer.x || 0 ) - radius,
						y: ( layer.y || 0 ) - radius,
						width: radius * 2,
						height: radius * 2
					};
					break;
				}
				case 'ellipse': {
					const radiusX = Math.abs( layer.radiusX || layer.radius || 0 );
					const radiusY = Math.abs( layer.radiusY || layer.radius || 0 );
					bounds = {
						x: ( layer.x || 0 ) - radiusX,
						y: ( layer.y || 0 ) - radiusY,
						width: radiusX * 2,
						height: radiusY * 2
					};
					break;
				}
				case 'line':
				case 'arrow':
				case 'dimension': {
					const x1 = layer.x1 !== undefined ? layer.x1 : ( layer.x || 0 );
					const y1 = layer.y1 !== undefined ? layer.y1 : ( layer.y || 0 );
					const x2 = layer.x2 !== undefined ? layer.x2 : ( layer.x || 0 );
					const y2 = layer.y2 !== undefined ? layer.y2 : ( layer.y || 0 );
					const includeStroke = !options || options.includeStroke !== false;
					const halfStroke = includeStroke && Number.isFinite( layer.strokeWidth ) ? Math.abs( layer.strokeWidth ) / 2 : 0;
					bounds = {
						x: Math.min( x1, x2 ) - halfStroke,
						y: Math.min( y1, y2 ) - halfStroke,
						width: Math.max( Math.abs( x2 - x1 ), 1 ) + halfStroke * 2,
						height: Math.max( Math.abs( y2 - y1 ), 1 ) + halfStroke * 2
					};
					break;
				}
				case 'polygon':
				case 'star':
				case 'path': {
					if ( Array.isArray( layer.points ) && layer.points.length >= 3 ) {
						bounds = LayerBounds.getPointsBounds( layer.points );
						if ( !bounds ) {
							return null;
						}
						break;
					}
					let radius = layer.radius;
					if ( layer.type === 'star' && layer.outerRadius ) {
						radius = layer.outerRadius;
					}
					const radiusFallback = Math.abs( radius || 50 );
					bounds = {
						x: ( layer.x || 0 ) - radiusFallback,
						y: ( layer.y || 0 ) - radiusFallback,
						width: radiusFallback * 2,
						height: radiusFallback * 2
					};
					break;
				}
				case 'marker': {
					const markerSize = layer.size || 24;
					const markerRadius = markerSize / 2;
					const markerX = layer.x || 0;
					const markerY = layer.y || 0;
					if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
						const minX = Math.min( markerX - markerRadius, layer.arrowX );
						const minY = Math.min( markerY - markerRadius, layer.arrowY );
						const maxX = Math.max( markerX + markerRadius, layer.arrowX );
						const maxY = Math.max( markerY + markerRadius, layer.arrowY );
						bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
					} else {
						bounds = {
							x: markerX - markerRadius,
							y: markerY - markerRadius,
							width: markerSize,
							height: markerSize
						};
					}
					break;
				}
				case 'angleDimension': {
					const cx = layer.cx || 0;
					const cy = layer.cy || 0;
					const ax = layer.ax || 0;
					const ay = layer.ay || 0;
					const bx = layer.bx || 0;
					const by = layer.by || 0;
					const minX = Math.min( cx, ax, bx );
					const minY = Math.min( cy, ay, by );
					bounds = {
						x: minX,
						y: minY,
						width: Math.max( Math.max( cx, ax, bx ) - minX, 1 ),
						height: Math.max( Math.max( cy, ay, by ) - minY, 1 )
					};
					break;
				}
				default:
					bounds = {
						x: layer.x || 0,
						y: layer.y || 0,
						width: Math.abs( layer.width || 50 ) || 50,
						height: Math.abs( layer.height || 50 ) || 50
					};
			}

			return LayerBounds.rotateBounds( bounds, layer.rotation || 0 );
		}

		/**
		 * Calculate bounds from points, preserving the editor's zero-size behavior.
		 *
		 * @param {Array<Object>} points Points with x and y coordinates
		 * @return {Object|null} Bounds or null for invalid points
		 */
		static getPointsBounds( points ) {
			if ( !points.length || !points[ 0 ] || points[ 0 ].x === undefined || points[ 0 ].y === undefined ) {
				return null;
			}
			let minX = points[ 0 ].x;
			let maxX = points[ 0 ].x;
			let minY = points[ 0 ].y;
			let maxY = points[ 0 ].y;
			for ( let i = 1; i < points.length; i++ ) {
				const point = points[ i ];
				if ( !point || point.x === undefined || point.y === undefined ) {
					return null;
				}
				minX = Math.min( minX, point.x );
				maxX = Math.max( maxX, point.x );
				minY = Math.min( minY, point.y );
				maxY = Math.max( maxY, point.y );
			}
			return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
		}

		/**
		 * Apply the layer's rotation to the corners of a rectangular box.
		 * Values extremely close to zero/one are normalized to avoid 90° drift.
		 *
		 * @param {Object} bounds Unrotated bounds
		 * @param {number} degrees Rotation angle in degrees
		 * @return {Object} Rotated axis-aligned bounds
		 */
		static rotateBounds( bounds, degrees ) {
			if ( !degrees ) {
				return bounds;
			}
			const radians = degrees * Math.PI / 180;
			let cos = Math.cos( radians );
			let sin = Math.sin( radians );
			if ( Math.abs( cos ) < 1e-12 ) {
				cos = 0;
			} else if ( Math.abs( Math.abs( cos ) - 1 ) < 1e-12 ) {
				cos = Math.sign( cos );
			}
			if ( Math.abs( sin ) < 1e-12 ) {
				sin = 0;
			} else if ( Math.abs( Math.abs( sin ) - 1 ) < 1e-12 ) {
				sin = Math.sign( sin );
			}
			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;
			const width = Math.abs( bounds.width * cos ) + Math.abs( bounds.height * sin );
			const height = Math.abs( bounds.width * sin ) + Math.abs( bounds.height * cos );
			return {
				x: centerX - width / 2,
				y: centerY - height / 2,
				width: width,
				height: height
			};
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.LayerBounds = LayerBounds;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerBounds;
	}
}() );
