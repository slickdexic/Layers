/**
 * Inactive preparation of page-owned image/slide working-copy Import candidates.
 */
'use strict';

( function () {
	const hasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const isObject = value => value !== null && typeof value === 'object' && !Array.isArray( value );
	const isId = value => typeof value === 'string' && value.length > 0;

	function invalid() {
		const error = new Error( 'Invalid working-copy import plan' );
		error.code = 'layers-invalid-working-copy-import-plan';
		return error;
	}

	function field( request, name ) {
		const descriptor = Object.getOwnPropertyDescriptor( request, name );
		if ( !descriptor || !descriptor.enumerable || !hasOwn( descriptor, 'value' ) ) {
			throw invalid();
		}
		return descriptor.value;
	}

	function validateSurface( surface ) {
		if ( !isObject( surface ) || !isId( surface.id ) || typeof surface.label !== 'string' ||
			![ 'image', 'slide' ].includes( surface.kind ) || !isObject( surface.canvas ) ||
			!Number.isFinite( surface.canvas.width ) || surface.canvas.width <= 0 ||
			!Number.isFinite( surface.canvas.height ) || surface.canvas.height <= 0 ||
			!Array.isArray( surface.layers ) ) {
			throw invalid();
		}
		if ( surface.kind === 'image' && ( !isObject( surface.source ) ||
			!isId( surface.source.fileTitle ) || !surface.source.fileTitle.startsWith( 'File:' ) ||
			surface.source.fileTitle.length === 5 ) ) {
			throw invalid();
		}

		const layers = new Map();
		for ( const layer of surface.layers ) {
			if ( !isObject( layer ) || !isId( layer.id ) || !isId( layer.type ) || layers.has( layer.id ) ) {
				throw invalid();
			}
			layers.set( layer.id, layer );
		}
		const parents = new Map();
		for ( const layer of surface.layers ) {
			if ( layer.type !== 'group' ) {
				continue;
			}
			if ( !Array.isArray( layer.children ) ) {
				throw invalid();
			}
			for ( const childId of layer.children ) {
				if ( !isId( childId ) || !layers.has( childId ) || parents.has( childId ) ||
					layers.get( childId ).parentGroup !== layer.id ) {
					throw invalid();
				}
				parents.set( childId, layer.id );
			}
		}
		for ( const layer of surface.layers ) {
			if ( hasOwn( layer, 'parentGroup' ) && layer.parentGroup !== null &&
				( !isId( layer.parentGroup ) || parents.get( layer.id ) !== layer.parentGroup ) ) {
				throw invalid();
			}
			const visited = new Set( [ layer.id ] );
			let parent = parents.get( layer.id );
			while ( parent !== undefined ) {
				if ( visited.has( parent ) ) {
					throw invalid();
				}
				visited.add( parent );
				parent = parents.get( parent );
			}
		}
		if ( hasOwn( surface, 'readingOrder' ) ) {
			if ( !Array.isArray( surface.readingOrder ) ) {
				throw invalid();
			}
			const seen = new Set();
			for ( const id of surface.readingOrder ) {
				if ( !isId( id ) || !layers.has( id ) || seen.has( id ) ) {
					throw invalid();
				}
				seen.add( id );
			}
		}
		return layers;
	}

	class PageOwnedWorkingCopyImportPlan {
		/**
		 * Prepare an isolated candidate only; does not authorize, apply or publish it.
		 *
		 * @param {Object} request Target/source surfaces, mode, maxLayers and allocateId
		 * @return {Object|null} Detached surface and importedLayerIds, or null for Cancel
		 */
		static prepare( request ) {
			try {
				if ( !isObject( request ) || ![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) {
					throw invalid();
				}
				const mode = field( request, 'mode' );
				if ( mode === 'cancel' ) {
					return null;
				}
				if ( ![ 'empty', 'append', 'replace' ].includes( mode ) ) {
					throw invalid();
				}
				const maxLayers = field( request, 'maxLayers' ), allocateId = field( request, 'allocateId' );
				if ( !Number.isInteger( maxLayers ) || maxLayers <= 0 || typeof allocateId !== 'function' ) {
					throw invalid();
				}
				let Adapter = typeof window !== 'undefined' && window.Layers &&
					window.Layers.Editor && window.Layers.Editor.PageOwnedSnapshotAdapter;
				if ( !Adapter && typeof module !== 'undefined' && typeof module.require === 'function' ) {
					Adapter = module.require( './PageOwnedSnapshotAdapter.js' );
				}
				if ( typeof Adapter !== 'function' ) {
					throw invalid();
				}
				const cloned = new Adapter().toEditorState( {
					schemaVersion: 1,
					surfaces: [ {
						id: 'import-input', kind: 'slide', layers: [],
						canvas: { target: field( request, 'targetSurface' ), source: field( request, 'sourceSurface' ) }
					} ]
				}, 'import-input' ).canvas;
				const target = cloned.target, source = cloned.source;
				const targetLayers = validateSurface( target ), sourceLayers = validateSurface( source );
				if ( target.kind !== source.kind || ( target.kind === 'image' &&
					target.source.fileTitle !== source.source.fileTitle ) ||
					( mode === 'empty' ? target.layers.length !== 0 : target.layers.length === 0 ) ||
					source.layers.length + ( mode === 'append' ? target.layers.length : 0 ) > maxLayers ) {
					throw invalid();
				}
				const reserved = new Set( [ ...targetLayers.keys(), ...sourceLayers.keys() ] ), ids = new Map();
				for ( const layer of source.layers ) {
					const id = allocateId();
					if ( !isId( id ) || reserved.has( id ) ) {
						throw invalid();
					}
					reserved.add( id );
					ids.set( layer.id, id );
				}
				for ( const layer of source.layers ) {
					layer.id = ids.get( layer.id );
					if ( layer.type === 'group' ) {
						layer.children = layer.children.map( id => ids.get( id ) );
					}
					if ( hasOwn( layer, 'parentGroup' ) && layer.parentGroup !== null ) {
						layer.parentGroup = ids.get( layer.parentGroup );
					}
				}
				if ( hasOwn( target, 'readingOrder' ) || hasOwn( source, 'readingOrder' ) ) {
					const importedOrder = hasOwn( source, 'readingOrder' ) ?
						source.readingOrder.map( id => ids.get( id ) ) : source.layers.map( layer => layer.id );
					target.readingOrder = mode === 'append' ?
						( target.readingOrder || target.layers.map( layer => layer.id ) ).concat( importedOrder ) : importedOrder;
				}
				if ( mode === 'empty' && target.kind === 'slide' ) {
					target.canvas = source.canvas;
				}
				target.layers = mode === 'append' ? source.layers.concat( target.layers ) : source.layers;
				return { surface: target, importedLayerIds: source.layers.map( layer => layer.id ) };
			} catch ( error ) {
				throw invalid();
			}
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWorkingCopyImportPlan = PageOwnedWorkingCopyImportPlan;
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedWorkingCopyImportPlan;
	}
}() );