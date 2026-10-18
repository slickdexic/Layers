/**
 * Unregistered whole-PDF Import preparation. Never mutates an editor or publishes work.
 */
'use strict';

( function () {
	const instances = new WeakMap();
	const own = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const nameKey = value => value.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	const identityKeys = [ 'targetPageId', 'targetBaseRevisionId', 'targetSurfaceId',
		'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ];

	function unavailable() {
		const error = new Error( 'layers-working-copy-import-unavailable' );
		error.code = error.message;
		return error;
	}

	function fields( value, keys ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ||
			Reflect.ownKeys( value ).length !== keys.length ) { throw unavailable(); }
		return Object.fromEntries( keys.map( key => {
			const descriptor = Object.getOwnPropertyDescriptor( value, key );
			if ( !descriptor || !descriptor.enumerable || !own( descriptor, 'value' ) ) { throw unavailable(); }
			return [ key, descriptor.value ];
		} ) );
	}

	function method( object, key ) {
		let holder = object;
		while ( holder && !own( holder, key ) ) { holder = Object.getPrototypeOf( holder ); }
		const descriptor = holder && Object.getOwnPropertyDescriptor( holder, key );
		if ( !descriptor || !own( descriptor, 'value' ) || typeof descriptor.value !== 'function' ) { throw unavailable(); }
		return { object, key, holder, descriptor };
	}

	function exactMethods( state ) {
		for ( const captured of state.methods ) {
			const current = method( captured.object, captured.key );
			if ( current.holder !== captured.holder || current.descriptor.value !== captured.descriptor.value ||
				current.descriptor.writable !== captured.descriptor.writable ||
				current.descriptor.configurable !== captured.descriptor.configurable ||
				current.descriptor.enumerable !== captured.descriptor.enumerable ) { throw unavailable(); }
		}
	}

	function equal( left, right ) {
		if ( left === right ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' ||
			Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key => own( right, key ) && equal( left[ key ], right[ key ] ) );
	}

	function active( instance ) {
		const state = instances.get( instance );
		if ( !state || !state.active ) { throw unavailable(); }
		exactMethods( state );
		return state;
	}

	function clone( state, value ) {
		return state.copy.call( state.adapter, { schemaVersion: 1, surfaces: [ {
			id: 'pdf-import-copy', kind: 'slide', canvas: { value }, layers: []
		} ] }, 'pdf-import-copy' ).canvas.value;
	}

	function check( instance, state, guard ) {
		if ( active( instance ) !== state || guard() !== undefined || active( instance ) !== state ) { throw unavailable(); }
	}

	function recordFor( instance, handle ) {
		const state = active( instance ), record = state.handles.get( handle );
		if ( !record ) { throw unavailable(); }
		check( instance, state, record.guard );
		if ( state.handles.get( handle ) !== record ) { throw unavailable(); }
		return { state, record };
	}

	// Live layer/canvas edits are retained. Member identity must still match the saved native group.
	function liveGroup( live, data ) {
		const anchor = live.surfaces.find( member => member.id === data.target.surfaceId );
		if ( !anchor || anchor.kind !== 'pdf' || !anchor.source ) { throw unavailable(); }
		const members = live.surfaces.filter( member => member.source &&
			member.source.fileTitle === anchor.source.fileTitle && typeof member.label === 'string' &&
			nameKey( member.label ) === nameKey( anchor.label ) );
		if ( members.length !== data.targetGroup.members.length ) { throw unavailable(); }
		for ( const item of data.targetGroup.members ) {
			const saved = data.targetBundle.snapshot.surfaces.find( member => member.id === item.surfaceId );
			const current = members.find( member => member.id === item.surfaceId );
			if ( !current || current.kind !== saved.kind || current.label !== saved.label ||
				!equal( current.source, saved.source ) ) { throw unavailable(); }
		}
	}

	class PageOwnedWholePdfImportSource {
		/** @param {Object} api Native API transport; the qualified reader validates every response. */
		constructor( api ) {
			try {
				const editor = typeof window !== 'undefined' && window.Layers && window.Layers.Editor;
				const load = ( key, file ) => editor && editor[ key ] || module.require( file );
				const Client = load( 'PageOwnedWholePdfImportReadClient', './PageOwnedWholePdfImportReadClient.js' );
				const Planner = load( 'PageOwnedWholePdfImportPlan', './PageOwnedWholePdfImportPlan.js' );
				const Adapter = load( 'PageOwnedSnapshotAdapter', './PageOwnedSnapshotAdapter.js' );
				const post = method( api, 'post' ), adapter = new Adapter();
				// The reader's transport is private and invokes only the captured native POST method.
				const reader = new Client( { post: input => post.descriptor.value.call( api, input ) } );
				const read = method( reader, 'read' ), prepare = method( Planner, 'prepare' ), copy = method( adapter, 'toEditorState' );
				const namespace = typeof window !== 'undefined' && window.Layers && window.Layers.Editor;
				const bindings = namespace ? [ 'PageOwnedWholePdfImportReadClient', 'PageOwnedWholePdfImportPlan',
					'PageOwnedSnapshotAdapter' ].map( key => method( namespace, key ) ) : [];
				instances.set( this, { active: true, handles: new WeakMap(), adapter, reader, planner: Planner,
					read: read.descriptor.value, prepare: prepare.descriptor.value, copy: copy.descriptor.value,
					methods: [ post, read, prepare, copy, ...bindings ] } );
			} catch ( error ) { throw unavailable(); }
		}

		/**
		 * @param {Object} request Native identities, saved base, complete live work and synchronous guard
		 * @return {Promise<Object|null>} Private frozen handle, or null for Cancel
		 */
		async prepare( request ) {
			try {
				const state = active( this );
				if ( !request || typeof request !== 'object' || Array.isArray( request ) ||
					![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) { throw unavailable(); }
				const mode = request && Object.getOwnPropertyDescriptor( request, 'mode' );
				if ( !mode || !mode.enumerable || !own( mode, 'value' ) ) { throw unavailable(); }
				if ( mode.value === 'cancel' ) { return null; }
				const captured = fields( request, [ 'identity', 'baseSnapshot', 'targetSnapshot', 'mode', 'maxLayers', 'allocateId', 'assertCurrent' ] );
				if ( typeof captured.assertCurrent !== 'function' || typeof captured.allocateId !== 'function' ||
					![ 'empty', 'append', 'replace' ].includes( captured.mode ) ||
					!Number.isInteger( captured.maxLayers ) || captured.maxLayers < 1 ) { throw unavailable(); }
				const guard = captured.assertCurrent;
				check( this, state, guard );
				const identity = clone( state, fields( captured.identity, identityKeys ) );
				const base = clone( state, captured.baseSnapshot ), target = clone( state, captured.targetSnapshot );
				check( this, state, guard );
				const response = await state.read.call( state.reader, identity );
				check( this, state, guard );
				const data = clone( state, response );
				check( this, state, guard );
				if ( !equal( base, data.targetBundle.snapshot ) ) { throw unavailable(); }
				liveGroup( target, data );
				const allocateId = () => {
					check( this, state, guard );
					const result = captured.allocateId();
					check( this, state, guard );
					return result;
				};
				const plan = state.prepare.call( state.planner, { targetSnapshot: target, targetSurfaceId: identity.targetSurfaceId,
					sourceSnapshot: data.sourceBundle.snapshot, sourceSurfaceId: identity.sourceSurfaceId,
					admittedTargetSurfaces: data.admittedTargetSurfaces, mode: captured.mode, maxLayers: captured.maxLayers, allocateId } );
				check( this, state, guard );
				const preview = clone( state, { target: data.target, source: data.source, mode: captured.mode,
					candidateSnapshot: plan.snapshot, importedLayerIds: plan.importedLayerIds, pages: plan.pages,
					differentFileVersion: !equal( data.targetGroup.source, data.sourceGroup.source ),
					targetGeometry: data.targetBundle.sourceGeometry, targetRenditions: data.targetBundle.sourceRenditions,
					admittedTargetSurfaces: data.admittedTargetSurfaces, admittedTargetGeometry: data.admittedTargetGeometry,
					admittedTargetRenditions: data.admittedTargetRenditions } );
				check( this, state, guard );
				const handle = Object.freeze( Object.create( null ) );
				state.handles.set( handle, { guard, identity, data, preview, checking: false } );
				return handle;
			} catch ( error ) { throw unavailable(); }
		}

		/** @param {Object} handle Issued handle @return {Object} Detached complete preview, never authority */
		inspect( handle ) {
			try {
				const { state, record } = recordFor( this, handle ), result = clone( state, record.preview );
				recordFor( this, handle );
				return result;
			} catch ( error ) { throw unavailable(); }
		}

		/** Retained exact read context for future application/Save integration; not a publication claim. */
		getReadEvidence( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				const result = clone( state, { request: record.identity, result: record.data } );
				recordFor( this, handle );
				return result;
			} catch ( error ) { throw unavailable(); }
		}

		/** @param {Object} handle Issued handle @return {Promise<undefined>} Fresh complete read check only */
		async revalidate( handle ) {
			let retained;
			try {
				const { state, record } = recordFor( this, handle );
				if ( record.checking ) { throw unavailable(); }
				record.checking = true; retained = record;
				const response = await state.read.call( state.reader, clone( state, record.identity ) );
				recordFor( this, handle );
				const data = clone( state, response );
				if ( recordFor( this, handle ).record !== record || !equal( record.data, data ) ) { throw unavailable(); }
			} catch ( error ) { throw unavailable(); }
			finally { if ( retained ) { retained.checking = false; } }
		}

		/** Release never requires current work to stay unchanged, so refused preparations can be cleaned up. */
		release( handle ) {
			const state = instances.get( this );
			if ( !state || !state.handles.delete( handle ) ) { throw unavailable(); }
		}

		dispose() {
			const state = instances.get( this );
			if ( !state ) { throw unavailable(); }
			state.active = false; state.handles = new WeakMap();
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWholePdfImportSource = PageOwnedWholePdfImportSource;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportSource; }
}() );
