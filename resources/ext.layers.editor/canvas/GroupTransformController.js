/** Atomic folder gestures using ordinary stored member geometry. */
( function () {
	'use strict';
	// ResourceLoader also provides module/require; prefer its registered class.
	const Geometry = typeof window !== 'undefined' && window.Layers && window.Layers.Canvas &&
		window.Layers.Canvas.GroupTransformGeometry ||
		( typeof module !== 'undefined' && module.exports ? require( './GroupTransformGeometry.js' ) : null );
	const MESSAGES = {
		locked: [ 'layers-group-transform-locked', 'Unlock this folder and all its layers to move, rotate or scale the group.' ],
		empty: [ 'layers-group-transform-empty', 'This folder is empty. Add layers to edit them as a group.' ],
		invalid: [ 'layers-group-transform-invalid', 'This group cannot be transformed safely. No layers were changed.' ],
		limit: [ 'layers-group-transform-limit', 'The group cannot be scaled further because a layer would exceed its supported size.' ],
		move: [ 'layers-group-transform-move', 'Move group' ],
		rotate: [ 'layers-group-transform-rotate', 'Rotate group' ],
		scale: [ 'layers-group-transform-scale', 'Scale group' ]
	};

	class GroupTransformController {
		constructor( transformController ) {
			this.controller = transformController;
			this.manager = transformController.manager;
			this.session = null;
			this.frame = null;
			this.onKey = ( event ) => {
				if ( this.session && ![ 'Shift', 'Alt', 'Control', 'Meta' ].includes( event.key ) ) {
					if ( event.key === 'Escape' ) {
						event.preventDefault();
						event.stopImmediatePropagation();
					}
					// Other commands act on the committed document, never a partial preview.
					this.finish( true );
				}
			};
			this.onOutsideMove = ( event ) => {
				if ( this.session && event.target !== this.manager.canvas ) {
					this.update( this.manager.getMousePoint( event ), event );
				}
			};
			this.onOutsideUp = ( event ) => {
				if ( this.session && event.target !== this.manager.canvas ) {
					this.update( this.manager.getMousePoint( event ), event );
					this.finish();
				}
			};
			this.onBlur = () => this.finish( true );
		}

		/** Read the authoritative array, not the copying compatibility getter. */
		activeLayers() {
			// The legacy editor.layers getter returns a new array on each read.
			return this.manager.editor.stateManager?.get( 'layers' ) || this.manager.editor.layers;
		}

		/** Include legacy numeric locks and reject broken ancestor chains. */
		locked( layer ) {
			const seen = new Set();
			while ( layer ) {
				if ( seen.has( layer.id ) ) {
					throw new Error( 'invalid' );
				}
				seen.add( layer.id );
				if ( layer.locked === true || layer.locked === 1 ) {
					return true;
				}
				const parent = layer.parentGroup;
				layer = parent ? this.manager.editor.getLayerById( parent ) : null;
				if ( parent && !layer ) {
					throw new Error( 'invalid' );
				}
			}
			return false;
		}

		/** Resolve a selection containing a folder; unrelated selection paths stay intact. */
		selectedIds() {
			const ids = this.manager.getSelectedLayerIds();
			return ids.some( ( id ) => this.manager.editor.getLayerById( id )?.type === 'group' ) ? ids : null;
		}

		/** Localized, escaped-by-consumer status/action text. */
		message( code ) {
			const [ key, fallback ] = MESSAGES[ code ] || MESSAGES.invalid;
			const message = typeof mw !== 'undefined' && mw.message ? mw.message( key ) : null;
			return message && typeof message.exists === 'function' && message.exists() ? message.text() : fallback;
		}

		/** Use the existing editor notification area. */
		notify( code ) {
			if ( this.lastNotice !== code ) {
				this.manager.editor.apiManager?.showUserNotification( this.message( code ), 'warning' );
				this.lastNotice = code;
			}
		}

		/** Bounds for display/hit testing, including collapsed and hidden members. */
		selection( id ) {
			if ( this.session && this.session.ids.includes( id ) ) {
				return this.session.visual;
			}
			try {
				const { members } = Geometry.resolve( [ id ], this.manager.editor.layers );
				if ( !members.length ) {
					this.notify( 'empty' );
				}
				return members.length ? { bounds: Geometry.bounds( members, this.manager ), rotation: 0 } : null;
			} catch ( error ) {
				return null;
			}
		}

		/** Keep the folder selected when dragging even an empty space inside its box. */
		hit( point ) {
			const ids = this.selectedIds();
			return ids && ids.some( ( id ) => {
				if ( this.manager.editor.getLayerById( id )?.type !== 'group' ) {
					return false;
				}
				const box = this.selection( id )?.bounds;
				return box && point.x >= box.x && point.x <= box.x + box.width &&
					point.y >= box.y && point.y <= box.y + box.height;
			} );
		}

		/** Return true when a group handled the request, including a refused gesture. */
		start( mode, point, handle ) {
			const ids = this.selectedIds();
			if ( !ids ) {
				return false;
			}
			this.lastNotice = null;
			try {
				const layers = this.activeLayers();
				const { members, nodes } = Geometry.resolve( ids, layers );
				if ( nodes.some( ( layer ) => this.locked( layer ) ) ) {
					throw new Error( 'locked' );
				}
				if ( !members.length ) {
					throw new Error( 'empty' );
				}
				const bounds = Geometry.bounds( members, this.manager );
				if ( mode === 'scale' && ( !bounds.width || !bounds.height ) ) {
					throw new Error( 'invalid' );
				}
				const originals = members.map( ( layer ) => JSON.parse( JSON.stringify( layer ) ) );
				this.session = { ids, mode, handle, point, bounds, nodes, members, originals,
					writes: members.map( () => new Set() ), hierarchy: nodes.map( ( node ) =>
						JSON.stringify( [ node.parentGroup, node.children ] ) ),
					layers, visual: { bounds, rotation: 0 }, changed: false };
				this.controller.isDragging = mode === 'move';
				this.controller.isRotating = mode === 'rotate';
				this.controller.isResizing = mode === 'scale';
				this.controller.resizeHandle = handle;
				this.controller.dragStartPoint = point;
				this.manager.canvas.style.cursor = mode === 'move' ? 'move' : 'grabbing';
				document.addEventListener( 'keydown', this.onKey, true );
				document.addEventListener( 'mousemove', this.onOutsideMove );
				document.addEventListener( 'mouseup', this.onOutsideUp );
				window.addEventListener( 'blur', this.onBlur );
			} catch ( error ) {
				this.notify( error.message );
			}
			return true;
		}

		/** Build every candidate first; a failed member leaves the whole gesture unchanged. */
		update( point, event = {} ) {
			const session = this.session;
			if ( !session ) {
				return;
			}
			const b = session.bounds;
			const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
			const transform = { anchor: center, scale: 1, angle: 0, dx: 0, dy: 0 };
			if ( session.mode === 'move' ) {
				transform.dx = point.x - session.point.x;
				transform.dy = point.y - session.point.y;
			} else if ( session.mode === 'rotate' ) {
				transform.angle = ( Math.atan2( point.y - center.y, point.x - center.x ) -
					Math.atan2( session.point.y - center.y, session.point.x - center.x ) ) * 180 / Math.PI;
				if ( event.shiftKey ) {
					transform.angle = Math.round( transform.angle / 15 ) * 15;
				}
			} else {
				const type = session.handle.type;
				const corner = { x: b.x + ( type.includes( 'e' ) ? b.width : 0 ),
					y: b.y + ( type.includes( 's' ) ? b.height : 0 ) };
				transform.anchor = event.altKey ? center :
					{ x: 2 * center.x - corner.x, y: 2 * center.y - corner.y };
				const vx = corner.x - transform.anchor.x;
				const vy = corner.y - transform.anchor.y;
				// Project the pointer delta onto the diagonal: uniform, stable at all corners.
				transform.scale = 1 + ( ( point.x - session.point.x ) * vx +
					( point.y - session.point.y ) * vy ) / ( vx * vx + vy * vy );
			}
			try {
				this.checkSession();
				const changed = Math.abs( transform.dx ) + Math.abs( transform.dy ) +
					Math.abs( transform.angle % 360 ) + Math.abs( transform.scale - 1 ) > 1e-9;
				const candidates = changed ? session.originals.map( ( layer ) =>
					Geometry.transform( layer, transform, this.manager ) ) : session.originals;
				this.apply( candidates );
				session.changed = changed;
				const corner = Geometry.point( { x: b.x, y: b.y }, { ...transform, angle: 0 } );
				session.visual = { bounds: { x: corner.x, y: corner.y,
					width: b.width * transform.scale, height: b.height * transform.scale }, rotation: transform.angle };
				this.lastNotice = null;
				this.render();
			} catch ( error ) {
				// Do not retain an earlier partial gesture after a refused endpoint.
				this.apply( session.originals );
				session.changed = false;
				session.visual = { bounds: b, rotation: 0 };
				this.notify( error.message );
				this.render();
			}
		}

		/** Recheck references and locks before both preview and final publication. */
		checkSession() {
			const s = this.session;
			if ( this.activeLayers() !== s.layers ||
				s.nodes.some( ( layer, index ) => !s.layers.includes( layer ) ||
					JSON.stringify( [ layer.parentGroup, layer.children ] ) !== s.hierarchy[ index ] ) ) {
				throw new Error( 'invalid' );
			}
			if ( s.nodes.some( ( layer ) => this.locked( layer ) ) ) {
				throw new Error( 'locked' );
			}
		}

		/** Replace only geometry-bearing records from the unchanged active document. */
		apply( candidates ) {
			const s = this.session;
			if ( this.activeLayers() !== s.layers ) {
				return;
			}
			s.members.forEach( ( member, index ) => {
				if ( s.layers.includes( member ) ) {
					const original = s.originals[ index ];
					const candidate = candidates[ index ];
					// Restore only values this gesture wrote; never reset a new lock or label.
					for ( const key of s.writes[ index ] ) {
						if ( Object.hasOwn( original, key ) ) {
							member[ key ] = original[ key ];
						} else {
							delete member[ key ];
						}
					}
					s.writes[ index ].clear();
					for ( const key of Object.keys( candidate ) ) {
						if ( candidate[ key ] !== original[ key ] &&
							JSON.stringify( candidate[ key ] ) !== JSON.stringify( original[ key ] ) ) {
							member[ key ] = candidate[ key ];
							s.writes[ index ].add( key );
						}
					}
				}
			} );
		}

		/** Existing arrow-key movement/rotation/resize shortcuts act on the folder unit. */
		keyboard( event ) {
			const ids = this.selectedIds();
			if ( !ids || !event.key.startsWith( 'Arrow' ) ||
				( event.altKey && [ 'ArrowUp', 'ArrowDown' ].includes( event.key ) ) ) {
				return false;
			}
			const scale = event.ctrlKey || event.metaKey;
			const rotate = event.altKey;
			const mode = scale ? 'scale' : ( rotate ? 'rotate' : 'move' );
			this.start( mode, { x: 0, y: 0 }, { type: 'se' } );
			if ( !this.session ) {
				return true;
			}
			const b = this.session.bounds;
			const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
			const step = event.shiftKey ? ( rotate ? 15 : 10 ) : 1;
			const positive = [ 'ArrowRight', 'ArrowDown' ].includes( event.key );
			let point;
			if ( scale ) {
				const amount = step * ( positive ? 1 : -1 ) / Math.max( b.width, b.height );
				this.session.point = { x: b.x + b.width, y: b.y + b.height };
				point = { x: this.session.point.x + b.width * amount, y: this.session.point.y + b.height * amount };
			} else if ( rotate ) {
				this.session.point = { x: center.x + 100, y: center.y };
				point = Geometry.point( this.session.point, { anchor: center, angle: step * ( positive ? 1 : -1 ) } );
			} else {
				point = { x: ( event.key === 'ArrowRight' ? step : 0 ) - ( event.key === 'ArrowLeft' ? step : 0 ),
					y: ( event.key === 'ArrowDown' ? step : 0 ) - ( event.key === 'ArrowUp' ? step : 0 ) };
			}
			this.update( point );
			this.finish();
			return true;
		}

		/** Coalesce redraws without deferring changes or history publication. */
		render() {
			if ( this.frame === null ) {
				this.frame = window.requestAnimationFrame( () => {
					this.frame = null;
					this.manager.renderLayers( this.manager.editor.layers );
				} );
			}
		}

		/** Commit one history step, or restore the full starting snapshot. */
		finish( cancel = false ) {
			const s = this.session;
			if ( !s ) {
				return false;
			}
			try {
				this.checkSession();
			} catch ( error ) {
				cancel = true;
				this.notify( error.message );
			}
			if ( cancel ) {
				this.apply( s.originals );
			}
			this.session = null;
			document.removeEventListener( 'keydown', this.onKey, true );
			document.removeEventListener( 'mousemove', this.onOutsideMove );
			document.removeEventListener( 'mouseup', this.onOutsideUp );
			window.removeEventListener( 'blur', this.onBlur );
			if ( this.frame !== null ) {
				window.cancelAnimationFrame( this.frame );
				this.frame = null;
			}
			this.controller.isDragging = false;
			this.controller.isRotating = false;
			this.controller.isResizing = false;
			this.controller.dragStartPoint = null;
			this.controller.resizeHandle = null;
			this.manager.isDrawing = false;
			this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );
			if ( s.changed && !cancel ) {
				this.manager.editor.markDirty();
				this.manager.editor.saveState( this.message( s.mode ) );
			}
			this.manager.renderLayers( this.manager.editor.layers );
			return true;
		}
	}
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.GroupTransformController = GroupTransformController;
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GroupTransformController;
	}
}() );
