/**
 * Detached, unregistered whole-PDF Import planning. Does not authorize or apply a plan.
 */
'use strict';

( function () {
	const own = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const object = value => value !== null && typeof value === 'object' && !Array.isArray( value );
	const id = value => typeof value === 'string' && value.length > 0;
	const page = value => Number.isInteger( value ) && value > 0 && value <= 100000;
	const nameKey = value => value.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();

	function invalid() {
		const error = new Error( 'Invalid whole-PDF import plan' );
		error.code = 'layers-invalid-whole-pdf-import-plan';
		return error;
	}

	function field( request, key ) {
		const descriptor = Object.getOwnPropertyDescriptor( request, key );
		if ( !descriptor || !descriptor.enumerable || !own( descriptor, 'value' ) ) {
			throw invalid();
		}
		return descriptor.value;
	}

	// Values have already passed finite-JSON cloning. Key order is not a pin change.
	function comparable( value ) {
		if ( Array.isArray( value ) ) {
			return '[' + value.map( comparable ).join( ',' ) + ']';
		}
		if ( object( value ) ) {
			return '{' + Object.keys( value ).sort().map( key =>
				JSON.stringify( key ) + ':' + comparable( value[ key ] ) ).join( ',' ) + '}';
		}
		return JSON.stringify( value );
	}

	function pin( surface ) {
		const value = { ...surface.source };
		delete value.page;
		return comparable( value );
	}

	function validateLayers( surface ) {
		if ( !object( surface.canvas ) || ![ surface.canvas.width, surface.canvas.height ]
			.every( value => Number.isFinite( value ) && value > 0 ) || !Array.isArray( surface.layers ) ) {
			throw invalid();
		}
		const layers = new Map(), parents = new Map();
		for ( const layer of surface.layers ) {
			if ( !object( layer ) || !id( layer.id ) || !id( layer.type ) || layers.has( layer.id ) ) {
				throw invalid();
			}
			layers.set( layer.id, layer );
		}
		for ( const layer of surface.layers ) {
			if ( layer.type !== 'group' ) {
				continue;
			}
			if ( !Array.isArray( layer.children ) ) {
				throw invalid();
			}
			for ( const child of layer.children ) {
				if ( !id( child ) || !layers.has( child ) || parents.has( child ) ||
					layers.get( child ).parentGroup !== layer.id ) {
					throw invalid();
				}
				parents.set( child, layer.id );
			}
		}
		for ( const layer of surface.layers ) {
			if ( own( layer, 'parentGroup' ) && layer.parentGroup !== null &&
				( !id( layer.parentGroup ) || parents.get( layer.id ) !== layer.parentGroup ) ) {
				throw invalid();
			}
			const seen = new Set( [ layer.id ] );
			let parent = parents.get( layer.id );
			while ( parent !== undefined ) {
				if ( seen.has( parent ) ) {
					throw invalid();
				}
				seen.add( parent );
				parent = parents.get( parent );
			}
		}
		if ( own( surface, 'readingOrder' ) ) {
			if ( !Array.isArray( surface.readingOrder ) || new Set( surface.readingOrder ).size !== surface.readingOrder.length ||
				surface.readingOrder.some( key => !id( key ) || !layers.has( key ) ) ) {
				throw invalid();
			}
		}
	}

	function validateMember( surface, anchor ) {
		if ( !object( surface ) || surface.kind !== 'pdf' || !id( surface.id ) ||
			typeof surface.label !== 'string' || !nameKey( surface.label ) || !object( surface.source ) ||
			surface.source.repository !== 'local' || !validFileTitle( surface.source.fileTitle ) ||
			!page( surface.source.page ) || !validTimestamp( surface.source.timestamp ) ||
			typeof surface.source.sha1 !== 'string' || surface.source.sha1.length !== 31 ||
			!/^[0-9a-z]{31}$/.test( surface.source.sha1 ) ||
			( anchor && ( surface.label !== anchor.label || pin( surface ) !== pin( anchor ) ) ) ) {
			throw invalid();
		}
		validateLayers( surface );
	}

	function validFileTitle( value ) {
		return typeof value === 'string' && value.startsWith( 'File:' ) && value.length > 5 &&
			encodeURIComponent( value ).replace( /%[A-F\d]{2}|./g, 'x' ).length <= 255 &&
			!Array.from( value ).some( char => char.charCodeAt( 0 ) < 32 || char.charCodeAt( 0 ) === 127 ||
				'#<>[]{}|'.includes( char ) );
	}

	// Structural source formats mirror DocumentSchema; file existence and authority stay native.
	function validTimestamp( value ) {
		if ( typeof value !== 'string' || value.length !== 14 || !/^\d{14}$/.test( value ) ) {
			return false;
		}
		const date = new Date( value.slice( 0, 4 ) + '-' + value.slice( 4, 6 ) + '-' + value.slice( 6, 8 ) +
			'T' + value.slice( 8, 10 ) + ':' + value.slice( 10, 12 ) + ':' + value.slice( 12, 14 ) + 'Z' );
		return Number.isFinite( date.getTime() ) && date.toISOString().replace( /\D/g, '' ).slice( 0, 14 ) === value;
	}

	function group( snapshot, surfaceId ) {
		if ( !object( snapshot ) || snapshot.schemaVersion !== 1 || !Array.isArray( snapshot.surfaces ) || !id( surfaceId ) ) {
			throw invalid();
		}
		const ids = new Set();
		for ( const surface of snapshot.surfaces ) {
			if ( !object( surface ) || !id( surface.id ) || ids.has( surface.id ) ) {
				throw invalid();
			}
			ids.add( surface.id );
		}
		const anchor = snapshot.surfaces.find( surface => surface.id === surfaceId );
		validateMember( anchor );
		const members = new Map();
		for ( const surface of snapshot.surfaces ) {
			if ( !object( surface.source ) || surface.source.fileTitle !== anchor.source.fileTitle ||
				typeof surface.label !== 'string' || nameKey( surface.label ) !== nameKey( anchor.label ) ) {
				continue;
			}
			validateMember( surface, anchor );
			if ( members.has( surface.source.page ) ) {
				throw invalid();
			}
			members.set( surface.source.page, surface );
		}
		return { anchor, members, ids };
	}

	function reserve( surfaces, reserved ) {
		for ( const surface of surfaces ) {
			if ( Array.isArray( surface.layers ) ) {
				for ( const layer of surface.layers ) {
					if ( object( layer ) && id( layer.id ) ) {
						reserved.add( layer.id );
					}
				}
			}
		}
	}

	function importPage( target, source, append, allocateId, reserved ) {
		const mapping = new Map();
		for ( const layer of source.layers ) {
			const next = allocateId();
			if ( !id( next ) || reserved.has( next ) ) {
				throw invalid();
			}
			reserved.add( next );
			mapping.set( layer.id, next );
		}
		const importedOrder = own( source, 'readingOrder' ) ? source.readingOrder.map( key => mapping.get( key ) ) :
			source.layers.map( layer => mapping.get( layer.id ) );
		for ( const layer of source.layers ) {
			layer.id = mapping.get( layer.id );
			if ( layer.type === 'group' ) {
				layer.children = layer.children.map( key => mapping.get( key ) );
			}
			if ( own( layer, 'parentGroup' ) && layer.parentGroup !== null ) {
				layer.parentGroup = mapping.get( layer.parentGroup );
			}
		}
		if ( own( target, 'readingOrder' ) || own( source, 'readingOrder' ) ) {
			target.readingOrder = append ? ( target.readingOrder || target.layers.map( layer => layer.id ) )
				.concat( importedOrder ) : importedOrder;
		}
		target.layers = append ? source.layers.concat( target.layers ) : source.layers;
		return source.layers.map( layer => layer.id );
	}

	class PageOwnedWholePdfImportPlan {
		/**
		 * Prepare one detached complete-document candidate. Admission and atomic application are external.
		 *
		 * @param {Object} request Complete snapshots, anchors, admitted empty members, mode, limit and allocator
		 * @return {Object|null} Candidate snapshot, importedLayerIds and per-source-page IDs, or null for Cancel
		 */
		static prepare( request ) {
			try {
				if ( !object( request ) || ![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) {
					throw invalid();
				}
				const mode = field( request, 'mode' );
				if ( mode === 'cancel' ) {
					return null;
				}
				const maxLayers = field( request, 'maxLayers' ), allocateId = field( request, 'allocateId' );
				if ( ![ 'empty', 'append', 'replace' ].includes( mode ) || !Number.isInteger( maxLayers ) ||
					maxLayers <= 0 || typeof allocateId !== 'function' ) {
					throw invalid();
				}
				let Adapter = typeof window !== 'undefined' && window.Layers &&
					window.Layers.Editor && window.Layers.Editor.PageOwnedSnapshotAdapter;
				if ( !Adapter && typeof module !== 'undefined' && typeof module.require === 'function' ) {
					Adapter = module.require( './PageOwnedSnapshotAdapter.js' );
				}
				const input = new Adapter().toEditorState( { schemaVersion: 1, surfaces: [ {
					id: 'whole-pdf-import-input', kind: 'slide', layers: [], canvas: {
						target: field( request, 'targetSnapshot' ), targetId: field( request, 'targetSurfaceId' ),
						source: field( request, 'sourceSnapshot' ), sourceId: field( request, 'sourceSurfaceId' ),
						admitted: field( request, 'admittedTargetSurfaces' )
					}
				} ] }, 'whole-pdf-import-input' ).canvas;
				const target = group( input.target, input.targetId ), source = group( input.source, input.sourceId );
				if ( target.anchor.source.fileTitle !== source.anchor.source.fileTitle ||
					nameKey( target.anchor.label ) !== nameKey( source.anchor.label ) || !Array.isArray( input.admitted ) ) {
					throw invalid();
				}
				const existingCount = Array.from( target.members.values() ).reduce( ( count, member ) => count + member.layers.length, 0 );
				if ( mode === 'empty' ? existingCount !== 0 : existingCount === 0 ) {
					throw invalid();
				}
				for ( const member of input.admitted ) {
					validateMember( member, target.anchor );
					const number = member.source.page;
					if ( member.layers.length || target.ids.has( member.id ) || target.members.has( number ) || !source.members.has( number ) ) {
						throw invalid();
					}
					target.ids.add( member.id );
					target.members.set( number, member );
				}
				for ( const [ number, member ] of source.members ) {
					if ( !target.members.has( number ) || member.layers.length +
						( mode === 'append' ? target.members.get( number ).layers.length : 0 ) > maxLayers ) {
						throw invalid();
					}
				}
				const reserved = new Set();
				reserve( [ ...input.target.surfaces, ...input.source.surfaces, ...input.admitted ], reserved );
				const pages = [], importedLayerIds = [];
				if ( mode === 'replace' ) {
					for ( const [ number, member ] of target.members ) {
						if ( !source.members.has( number ) ) {
							member.layers = [];
							if ( own( member, 'readingOrder' ) ) {
								member.readingOrder = [];
							}
						}
					}
				}
				for ( const number of Array.from( source.members.keys() ).sort( ( left, right ) => left - right ) ) {
					const member = target.members.get( number );
					const imported = importPage( member, source.members.get( number ), mode === 'append', allocateId, reserved );
					pages.push( { page: number, surfaceId: member.id, importedLayerIds: imported } );
					importedLayerIds.push( ...imported );
				}
				input.target.surfaces.push( ...input.admitted.sort( ( left, right ) => left.source.page - right.source.page ) );
				return { snapshot: input.target, importedLayerIds, pages };
			} catch ( error ) {
				throw invalid();
			}
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWholePdfImportPlan = PageOwnedWholePdfImportPlan;
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedWholePdfImportPlan;
	}
}() );
