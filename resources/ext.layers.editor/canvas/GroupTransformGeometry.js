/** Geometry for folder transforms. Stored layers remain in surface coordinates. */
( function () {
	'use strict';

	const TYPES = new Set( [ 'rectangle', 'textbox', 'callout', 'blur', 'image',
		'customShape', 'text', 'circle', 'ellipse', 'polygon', 'star', 'path',
		'line', 'arrow', 'marker', 'dimension', 'angleDimension' ] );
	// Intersections of the existing client/server limits; never silently clamp a member.
	const SIZES = {
		width: [ 0, 10000 ], height: [ 0, 10000 ], radius: [ 0, 5000 ],
		radiusX: [ 0, 5000 ], radiusY: [ 0, 5000 ], innerRadius: [ 0, 5000 ],
		outerRadius: [ 0, 5000 ], pointRadius: [ 0, 5000 ], valleyRadius: [ 0, 5000 ],
		fontSize: [ 1, 1000 ], strokeWidth: [ 0, 100 ], arrowSize: [ 1, 100 ],
		tailWidth: [ 0, 100 ], blurRadius: [ 0, 100 ], padding: [ 0, 100 ],
		cornerRadius: [ 0, 500 ], tailSize: [ 5, 100 ], size: [ 10, 200 ],
		fontSizeAdjust: [ -10, 20 ], textStrokeWidth: [ 0, 50 ],
		shadowBlur: [ 0, 100 ], shadowSpread: [ 0, 50 ],
		shadowOffsetX: [ -100, 100 ], shadowOffsetY: [ -100, 100 ],
		textShadowBlur: [ 0, 50 ], textShadowOffsetX: [ -100, 100 ],
		textShadowOffsetY: [ -100, 100 ], extensionLength: [ 0, 100 ],
		extensionGap: [ 0, 50 ], dimensionOffset: [ -500, 500 ],
		textOffset: [ -2000, 2000 ], tickSize: [ 2, 50 ], arcRadius: [ 1, 2000 ],
		tailTipX: [ -100000, 100000 ], tailTipY: [ -100000, 100000 ]
	};

	class GroupTransformGeometry {
		/** Resolve selected roots once, rejecting broken/cyclic folder relationships. */
		static resolve( ids, layers ) {
			const map = new Map( layers.map( ( layer ) => [ layer.id, layer ] ) );
			const seen = new Set();
			const visiting = new Set();
			const members = [];
			const visit = ( id ) => {
				if ( visiting.has( id ) || !map.has( id ) ) {
					throw new Error( 'invalid' );
				}
				if ( seen.has( id ) ) {
					return;
				}
				visiting.add( id );
				const layer = map.get( id );
				if ( layer.type === 'group' ) {
					for ( const child of layer.children || [] ) {
						if ( map.get( child )?.parentGroup !== id ) {
							throw new Error( 'invalid' );
						}
						visit( child );
					}
					if ( layers.some( ( item ) => item.parentGroup === id &&
						!( layer.children || [] ).includes( item.id ) ) ) {
						throw new Error( 'invalid' );
					}
				} else if ( TYPES.has( layer.type ) ) {
					members.push( layer );
				} else {
					throw new Error( 'invalid' );
				}
				visiting.delete( id );
				seen.add( id );
			};
			ids.forEach( visit );
			return { members, nodes: Array.from( seen, ( id ) => map.get( id ) ) };
		}

		/** Rotate and uniformly scale a point around an anchor, then translate. */
		static point( point, transform ) {
			const { anchor, scale = 1, angle = 0, dx = 0, dy = 0 } = transform;
			const rad = angle * Math.PI / 180;
			const x = ( point.x - anchor.x ) * scale;
			const y = ( point.y - anchor.y ) * scale;
			return { x: anchor.x + x * Math.cos( rad ) - y * Math.sin( rad ) + dx,
				y: anchor.y + x * Math.sin( rad ) + y * Math.cos( rad ) + dy };
		}

		/** Bounds and actual rendering pivot, including point-based and text layers. */
		static geometry( layer, manager ) {
			const raw = manager.getLayerBounds( layer );
			if ( !raw || ![ raw.x, raw.y, raw.width, raw.height ].every( Number.isFinite ) ) {
				throw new Error( 'invalid' );
			}
			let pivot = { x: raw.x + raw.width / 2, y: raw.y + raw.height / 2 };
			let box = { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
			if ( [ 'line', 'arrow' ].includes( layer.type ) ) {
				// Hit-test bounds have a one-pixel minimum; renderers use the actual midpoint.
				pivot = { x: ( ( layer.x1 || 0 ) + ( layer.x2 || 0 ) ) / 2,
					y: ( ( layer.y1 || 0 ) + ( layer.y2 || 0 ) ) / 2 };
			}
			if ( [ 'circle', 'ellipse', 'polygon', 'star', 'marker' ].includes( layer.type ) &&
				!Array.isArray( layer.points ) ) {
				pivot = { x: layer.x || 0, y: layer.y || 0 };
			}
			if ( layer.type === 'text' && manager.ctx ) {
				manager.ctx.save();
				const size = layer.fontSize || 16;
				manager.ctx.font = size + 'px ' + ( layer.fontFamily || 'Arial' );
				const width = manager.ctx.measureText( layer.text || '' ).width;
				manager.ctx.restore();
				const align = layer.textAlign || 'left';
				pivot = { x: ( layer.x || 0 ) + ( align === 'center' ? 0 :
					( align === 'right' ? -width / 2 : width / 2 ) ), y: ( layer.y || 0 ) - size / 4 };
			}
			if ( layer.type === 'path' && layer.points?.length ) {
				box = this.enclose( layer.points );
				pivot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
			}
			if ( [ 'dimension', 'angleDimension' ].includes( layer.type ) ) {
				box = this.dimensionBounds( layer, box );
			}
			const corners = [ { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
				{ x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height } ];
			if ( layer.type === 'arrow' && layer.controlX !== undefined ) {
				corners.push( { x: layer.controlX, y: layer.controlY } );
			}
			if ( layer.type === 'callout' ) {
				if ( layer.tailTipX !== undefined && layer.tailTipY !== undefined ) {
					corners.push( { x: pivot.x + layer.tailTipX, y: pivot.y + layer.tailTipY } );
				} else {
					// Default tails can protrude on any edge.
					const tail = layer.tailSize || 20;
					corners.push( { x: box.x - tail, y: box.y - tail },
						{ x: box.x + box.width + tail, y: box.y + box.height + tail } );
				}
			}
			const angle = [ 'dimension', 'angleDimension' ].includes( layer.type ) ? 0 : ( layer.rotation || 0 );
			const bounds = this.enclose( corners.map( ( point ) => this.point( point, { anchor: pivot, angle } ) ) );
			return { pivot, bounds };
		}

		/** Include offset measurement lines, extension lines, arcs and their labels. */
		static dimensionBounds( layer, raw ) {
			const font = layer.fontSize || 12;
			const extension = layer.extensionLength ?? 10;
			const points = [ { x: raw.x, y: raw.y },
				{ x: raw.x + raw.width, y: raw.y + raw.height } ];
			if ( layer.type === 'angleDimension' ) {
				const radius = ( layer.arcRadius || 40 ) + extension;
				points.push( { x: ( layer.cx || 0 ) - radius, y: ( layer.cy || 0 ) - radius },
					{ x: ( layer.cx || 0 ) + radius, y: ( layer.cy || 0 ) + radius } );
			} else {
				const dx = ( layer.x2 || 0 ) - ( layer.x1 || 0 );
				const dy = ( layer.y2 || 0 ) - ( layer.y1 || 0 );
				const length = Math.hypot( dx, dy ) || 1;
				const offset = layer.dimensionOffset ?? ( ( layer.extensionGap ?? 3 ) + extension / 2 );
				const end = offset + Math.sign( offset || 1 ) * extension;
				for ( const [ x, y ] of [ [ layer.x1 || 0, layer.y1 || 0 ], [ layer.x2 || 0, layer.y2 || 0 ] ] ) {
					points.push( { x: x + dy / length * end, y: y - dx / length * end } );
				}
				points.push( { x: ( ( layer.x1 || 0 ) + ( layer.x2 || 0 ) ) / 2 +
					dy / length * offset + dx / length * ( layer.textOffset || 0 ),
					y: ( ( layer.y1 || 0 ) + ( layer.y2 || 0 ) ) / 2 -
					dx / length * offset + dy / length * ( layer.textOffset || 0 ) } );
			}
			const b = this.enclose( points );
			// Labels can use either horizontal or line-aligned text. Conservative padding
			// keeps both inside the group frame without changing their existing layout.
			const padding = Math.max( font * 3, layer.arrowSize || 8, layer.tickSize || 6 );
			return { x: b.x - padding, y: b.y - padding,
				width: b.width + 2 * padding, height: b.height + 2 * padding };
		}

		/** Union of finite points. */
		static enclose( points ) {
			if ( !points.length || !points.every( ( p ) => Number.isFinite( p.x ) && Number.isFinite( p.y ) ) ) {
				throw new Error( 'invalid' );
			}
			const xs = points.map( ( p ) => p.x );
			const ys = points.map( ( p ) => p.y );
			const x = Math.min( ...xs );
			const y = Math.min( ...ys );
			return { x, y, width: Math.max( ...xs ) - x, height: Math.max( ...ys ) - y };
		}

		/** Union of member bounds. */
		static bounds( members, manager ) {
			return this.enclose( members.flatMap( ( layer ) => {
				const b = this.geometry( layer, manager ).bounds;
				return [ { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height } ];
			} ) );
		}

		/** Effective defaults needed when a sparse saved layer is scaled. */
		static defaults( layer ) {
			const defaults = {};
			if ( [ true, 1, 'true', '1' ].includes( layer.shadow ) ) {
				Object.assign( defaults, { shadowBlur: 8, shadowOffsetX: 2, shadowOffsetY: 2 } );
			}
			if ( layer.textShadow === true ) {
				Object.assign( defaults, { textShadowBlur: 4, textShadowOffsetX: 2, textShadowOffsetY: 2 } );
			}
			if ( [ 'text', 'textbox', 'callout' ].includes( layer.type ) ) {
				defaults.fontSize = 16;
			}
			if ( [ 'textbox', 'callout' ].includes( layer.type ) ) {
				defaults.padding = 8;
			}
			if ( layer.type === 'callout' ) {
				defaults.tailSize = 20;
			}
			if ( layer.type === 'marker' ) {
				defaults.size = 24;
			}
			if ( [ 'dimension', 'angleDimension' ].includes( layer.type ) ) {
				Object.assign( defaults, { fontSize: 12, extensionLength: 10, extensionGap: 3,
					arrowSize: 8, tickSize: 6 } );
				if ( layer.type === 'angleDimension' ) {
					defaults.arcRadius = 40;
				}
			}
			if ( layer.type === 'arrow' ) {
				defaults.arrowSize = 15;
			}
			if ( ![ 'image', 'customShape', 'text', 'blur' ].includes( layer.type ) ) {
				defaults.strokeWidth = [ 'arrow', 'marker', 'path' ].includes( layer.type ) ? 2 : 1;
			}
			return defaults;
		}

		/** Return a new layer, never mutating the original or its nested data. */
		static transform( original, transform, manager ) {
			const layer = { ...original };
			const scale = transform.scale === undefined ? 1 : transform.scale;
			const angle = transform.angle || 0;
			if ( !Number.isFinite( scale ) || scale <= 0 ) {
				throw new Error( 'limit' );
			}
			const pivot = this.geometry( original, manager ).pivot;
			const destination = this.point( pivot, transform );
			// Rotating the local shape about its own pivot and orbiting that pivot
			// preserves the renderer's existing rotation model (including curved arrows).
			const local = { anchor: pivot, scale, dx: destination.x - pivot.x, dy: destination.y - pivot.y };
			const direct = [ 'dimension', 'angleDimension' ].includes( layer.type );
			const required = layer.type === 'angleDimension' ? [ 'cx', 'ax', 'bx' ] :
				( [ 'line', 'arrow', 'dimension' ].includes( layer.type ) ? [ 'x1', 'x2' ] :
					( layer.type === 'path' ? [] : [ 'x' ] ) );
			const movePair = ( x, y ) => {
				if ( required.includes( x ) || original[ x ] !== undefined || original[ y ] !== undefined ) {
					const point = this.point( { x: original[ x ] || 0, y: original[ y ] || 0 }, direct ? transform : local );
					layer[ x ] = point.x;
					layer[ y ] = point.y;
				}
			};
			[ [ 'x', 'y' ], [ 'x1', 'y1' ], [ 'x2', 'y2' ], [ 'controlX', 'controlY' ],
				[ 'arrowX', 'arrowY' ], [ 'cx', 'cy' ], [ 'ax', 'ay' ], [ 'bx', 'by' ] ].forEach( ( pair ) => movePair( ...pair ) );
			if ( Array.isArray( original.points ) ) {
				layer.points = original.points.map( ( point ) => ( { ...point, ...this.point( point, local ) } ) );
			}
			if ( !direct && angle ) {
				layer.rotation = ( ( ( original.rotation || 0 ) + angle ) % 360 + 360 ) % 360;
			}
			if ( scale !== 1 ) {
				const defaults = this.defaults( original );
				for ( const key of Object.keys( SIZES ) ) {
					if ( key === 'textOffset' && layer.type === 'angleDimension' ) {
						continue; // Angle label offset is degrees, not a length.
					}
					const value = original[ key ] === undefined ? defaults[ key ] : original[ key ];
					if ( value !== undefined && value !== null ) {
						layer[ key ] = value * scale;
						this.checkSize( key, layer[ key ] );
					}
				}
				if ( original.richText ) {
					layer.richText = original.richText.map( ( run ) => ( { ...run, style: { ...run.style } } ) );
				}
				if ( original.shadow && typeof original.shadow === 'object' ) {
					layer.shadow = { ...original.shadow };
					for ( const [ key, flat, fallback ] of [ [ 'blur', 'shadowBlur', 8 ],
						[ 'offsetX', 'shadowOffsetX', 2 ], [ 'offsetY', 'shadowOffsetY', 2 ] ] ) {
						layer.shadow[ key ] = ( original.shadow[ key ] ?? fallback ) * scale;
						this.checkSize( flat, layer.shadow[ key ] );
					}
				}
				for ( const run of layer.richText || [] ) {
					if ( run.style?.fontSize !== undefined ) {
						run.style.fontSize *= scale;
						this.checkSize( 'fontSize', run.style.fontSize );
					}
				}
			}
			// Coordinates are bounded on the server; preserve the whole group on refusal.
			for ( const value of Object.values( layer ) ) {
				if ( typeof value === 'number' && ( !Number.isFinite( value ) || Math.abs( value ) > 100000 ) ) {
					throw new Error( 'limit' );
				}
			}
			for ( const point of Array.isArray( layer.points ) ? layer.points : [] ) {
				if ( ![ point.x, point.y ].every( ( value ) => Number.isFinite( value ) && Math.abs( value ) <= 100000 ) ) {
					throw new Error( 'limit' );
				}
			}
			return layer;
		}

		/** Enforce a size without distortion from per-member clamping. */
		static checkSize( key, value ) {
			const [ min, max ] = SIZES[ key ];
			if ( !Number.isFinite( value ) || value < min || value > max ) {
				throw new Error( 'limit' );
			}
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.GroupTransformGeometry = GroupTransformGeometry;
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GroupTransformGeometry;
	}
}() );
