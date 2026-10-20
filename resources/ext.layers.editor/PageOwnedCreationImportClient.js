/** Native creation Import transport; keeps the admitted member separate from stored history. */
( function () {
	'use strict';
	const identities = [ 'targetPageId', 'targetBaseRevisionId', 'targetSurfaceId', 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ];
	const descriptors = [ 'pageId', 'owner', 'revisionId', 'surfaceId' ];
	const confirmedRevisions = new WeakMap();
	const rebaseCertificates = new WeakSet();
	const draftRebaseCertificates = new WeakSet();
	function draftValueEqual( left, right ) {
		if ( left === right ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key => Object.hasOwn( right, key ) && draftValueEqual( left[ key ], right[ key ] ) );
	}
	const id = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	const bytes = value => new TextEncoder().encode( value ).length;
	const member = value => typeof value === 'string' && value.length > 0 && bytes( value ) <= 128;
	const unavailable = ( code = 'layers-working-copy-import-unavailable' ) => Object.assign( new Error( code ), { code } );
	const copy = value => window.Layers.Core.StateManager.copyWorkingCopyValue( value );
	function fields( input, names ) {
		const result = copy( input );
		if ( !result || Array.isArray( result ) || Object.keys( result ).length !== names.length || !names.every( name => Object.hasOwn( result, name ) ) ) { throw unavailable(); }
		return result;
	}
	function matches( value, pageId, revisionId, surfaceId ) {
		const captured = fields( value, descriptors );
		return captured.pageId === pageId && captured.revisionId === revisionId && captured.surfaceId === surfaceId && typeof captured.owner === 'string' && !!captured.owner.trim();
	}
	function bundle( value, revisionId ) {
		if ( !value || value.revisionId !== revisionId || !value.snapshot || value.snapshot.schemaVersion !== 1 || !Array.isArray( value.snapshot.surfaces ) ) { throw unavailable(); }
	}
	// Native JSON syntax is checked first; this pass rejects equivalent repeated object keys.
	function uniqueKeys( json ) {
		const stack = [];
		for ( let i = 0; i < json.length; i++ ) {
			const char = json[ i ];
			if ( char === '"' ) {
				const start = i++;
				while ( json[ i ] !== '"' ) {
					if ( json[ i ] === '\\' ) { i++; }
					i++;
				}
				let next = i + 1;
				while ( /\s/u.test( json[ next ] || '' ) ) { next++; }
				if ( json[ next ] === ':' ) {
					const key = JSON.parse( json.slice( start, i + 1 ) ), keys = stack[ stack.length - 1 ];
					if ( keys.has( key ) ) { throw unavailable(); }
					keys.add( key );
				}
			} else if ( char === '{' || char === '[' ) {
				stack.push( char === '{' ? new Set() : null );
			} else if ( char === '}' || char === ']' ) {
				stack.pop();
			}
		}
	}

	function ascii( value ) {
		for ( let i = 0; i < value.length; i++ ) {
			if ( value.charCodeAt( i ) > 127 ) { return false; }
		}
		return true;
	}

	function exactResponse( value ) {
		const envelope = fields( value, [ 'version', 'data' ] );
		if ( envelope.version !== 1 || typeof envelope.data !== 'string' || !ascii( envelope.data ) ) {
			throw unavailable();
		}
		try {
			const result = JSON.parse( envelope.data );
			uniqueKeys( envelope.data );
			return copy( result );
		} catch ( error ) {
			throw unavailable();
		}
	}

	class PageOwnedCreationImportClient {
		static isPreparedRebase( value ) { return rebaseCertificates.has( value ); }
		static isPreparedDraftRebase( value ) { return draftRebaseCertificates.has( value ); }

		/** Inactive historical backup proof; never changes selection, applies layers or publishes. */
		async prepareDraftRebase( options ) {
			try {
				const Store = window.Layers.Core.StateManager, clone = Store.copyWorkingCopyValue;
				const request = fields( options, [ 'pageId', 'currentRevisionId', 'origin' ] );
				const retained = fields( request.origin, [ 'version', 'origin', 'newSurface', 'hasLayersSlot' ] );
				const origin = fields( retained.origin, [ 'pageId', 'owner', 'revisionId', 'surfaceId', 'selection' ] );
				const oldSelection = fields( origin.selection, [ 'start', 'expected' ] ), selection = clone( this.selection );
				const oldSurface = retained.newSurface;
				if ( confirmedRevisions.get( this ) !== null || retained.version !== 1 || typeof retained.hasLayersSlot !== 'boolean' ||
					![ request.pageId, request.currentRevisionId, origin.revisionId ].every( id ) || origin.pageId !== request.pageId ||
					origin.revisionId >= request.currentRevisionId || typeof origin.surfaceId !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test( origin.surfaceId ) ||
					typeof origin.owner !== 'string' || !origin.owner.trim() || !Number.isInteger( oldSelection.start ) ||
					oldSelection.start < 0 || oldSelection.start > 2147483647 || typeof oldSelection.expected !== 'string' ||
					!oldSelection.expected || bytes( oldSelection.expected ) > 2097152 || oldSelection.expected !== selection.expected ||
					!oldSurface || oldSurface.id !== origin.surfaceId || ![ 'image', 'slide' ].includes( oldSurface.kind ) ||
					typeof oldSurface.label !== 'string' || !oldSurface.canvas || typeof oldSurface.canvas !== 'object' || Array.isArray( oldSurface.canvas ) ||
					![ oldSurface.canvas.width, oldSurface.canvas.height ].every( value => typeof value === 'number' && value > 0 ) ||
					!Array.isArray( oldSurface.layers ) || oldSurface.layers.length ) { throw unavailable(); }
				if ( oldSurface.kind === 'image' && ( !oldSurface.source || typeof oldSurface.source !== 'object' || Array.isArray( oldSurface.source ) ||
					![ 'repository', 'fileTitle', 'timestamp', 'sha1' ].every( key => typeof oldSurface.source[ key ] === 'string' && !!oldSurface.source[ key ] ) || oldSurface.source.page !== 1 ) ) { throw unavailable(); }
				const observations = [ Store.observeWorkingCopyObject( this, false ), Store.observeWorkingCopyObject( this.selection ), Store.observeWorkingCopyObject( this.api, false ) ];
				const methods = [ 'read', 'publish', 'confirmStored', 'prepareDraftRebase' ].map( key => Store.captureWorkingCopyMethod( this, key ) )
					.concat( [ 'post', 'postWithToken' ].map( key => Store.captureWorkingCopyMethod( this.api, key ) ) );
				let released = false;
				const check = () => {
					if ( released || confirmedRevisions.get( this ) !== null || window.Layers.Core.StateManager !== Store ) { throw unavailable(); }
					observations.forEach( Store.checkWorkingCopyObservation ); Store.checkWorkingCopyMethods( methods );
				};
				const post = methods.find( method => method.key === 'post' ).method;
				const parameters = { action: 'layersworkingcopyimportcreationdraftrebase', formatversion: 2, exacttext: true,
					targetpageid: request.pageId, baserevid: request.currentRevisionId,
					originrevid: origin.revisionId, originsurface: origin.surfaceId };
				const fetch = async () => {
					check(); const response = clone( await post.call( this.api, clone( parameters ) ) ); check();
					const result = fields( exactResponse( response.layersworkingcopyimportcreationdraftrebase ), [ 'origin', 'creation' ] );
					const nativeOrigin = fields( result.origin, [ 'pageId', 'revisionId', 'surfaceId', 'selection' ] );
					const creation = fields( result.creation, [ 'target', 'selection', 'hasLayersSlot', 'baseBundle', 'newSurface' ] );
					const target = fields( creation.target, descriptors ), next = fields( creation.selection, [ 'start', 'expected' ] );
					const metadata = clone( creation.newSurface ), oldMetadata = clone( oldSurface );
					delete metadata.id; delete oldMetadata.id;
					if ( response.error || !draftValueEqual( nativeOrigin, { pageId: origin.pageId, revisionId: origin.revisionId,
						surfaceId: origin.surfaceId, selection: oldSelection } ) || !matches( target, request.pageId, request.currentRevisionId, target.surfaceId ) ||
						target.owner !== origin.owner || typeof target.surfaceId !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test( target.surfaceId ) || target.surfaceId === origin.surfaceId ||
						!draftValueEqual( next, selection ) || typeof creation.hasLayersSlot !== 'boolean' ||
						creation.newSurface.id !== target.surfaceId || !draftValueEqual( metadata, oldMetadata ) ) { throw unavailable(); }
					if ( creation.hasLayersSlot ) {
						bundle( creation.baseBundle, request.currentRevisionId );
						if ( creation.baseBundle.snapshot.surfaces.some( surface => [ origin.surfaceId, target.surfaceId ].includes( surface.id ) ) ) { throw unavailable(); }
					} else if ( creation.baseBundle !== null ) { throw unavailable(); }
					return result;
				};
				const captured = await fetch(), read = methods.find( method => method.key === 'read' ).method;
				const certificate = Object.freeze( {
					inspect: () => { check(); return clone( captured ); }, preflight: check,
					revalidate: async () => { if ( !draftValueEqual( await fetch(), captured ) ) { throw unavailable(); } check(); },
					read: async options => {
						check(); const source = fields( options, identities ), target = captured.creation.target;
						if ( source.targetPageId !== target.pageId || source.targetBaseRevisionId !== target.revisionId || source.targetSurfaceId !== target.surfaceId ) { throw unavailable(); }
						const result = clone( await read.call( this, source ) ); check();
						if ( !draftValueEqual( result.creation, captured.creation ) ) { throw unavailable(); } return result;
					},
					release: () => { released = true; }
				} );
				check(); draftRebaseCertificates.add( certificate ); return certificate;
			} catch ( error ) { throw unavailable(); }
		}

		/** Read-only native proof and detached transport; selection changes only at synchronous commit. */
		async prepareRebase( options ) {
			const Store = window.Layers.Core.StateManager, clone = Store.copyWorkingCopyValue;
			const observe = Store.observeWorkingCopyObject, checkObservation = Store.checkWorkingCopyObservation;
			const captureMethod = Store.captureWorkingCopyMethod, checkMethods = Store.checkWorkingCopyMethods;
			const request = fields( options, [ 'pageId', 'originRevisionId', 'surfaceId', 'currentRevisionId' ] );
			if ( ![ request.pageId, request.originRevisionId, request.currentRevisionId ].every( id ) ||
				request.currentRevisionId < request.originRevisionId || !member( request.surfaceId ) || confirmedRevisions.get( this ) !== null ) { throw unavailable(); }
			const selection = clone( this.selection ), observations = [ observe( this, false ), observe( this.selection ), observe( this.api, false ) ];
			const methods = [ 'read', 'publish', 'confirmStored', 'prepareRebase' ].map( key => captureMethod( this, key ) )
				.concat( [ 'post', 'postWithToken' ].map( key => captureMethod( this.api, key ) ) );
			const descriptor = Object.getOwnPropertyDescriptor( this, 'selection' );
			if ( !descriptor || !Object.hasOwn( descriptor, 'value' ) || !descriptor.writable ) { throw unavailable(); }
			let committed = false;
			const check = () => {
				if ( committed || confirmedRevisions.get( this ) !== null || window.Layers.Core.StateManager !== Store ) { throw unavailable(); }
				observations.forEach( checkObservation ); checkMethods( methods );
			};
			check();
			const response = clone( await methods.find( method => method.key === 'post' ).method.call( this.api, {
				action: 'layersworkingcopyimportcreationrebase', formatversion: 2, exacttext: true, targetpageid: request.pageId,
				baserevid: request.currentRevisionId, targetsurface: request.surfaceId, originrevid: request.originRevisionId,
				originstart: selection.start, origintext: selection.expected
			} ) );
			check();
			const result = fields( exactResponse( response.layersworkingcopyimportcreationrebase ), [ 'origin', 'creation' ] );
			const origin = fields( result.origin, [ 'pageId', 'revisionId', 'surfaceId', 'selection' ] );
			const creation = fields( result.creation, [ 'target', 'selection', 'hasLayersSlot', 'baseBundle', 'newSurface' ] );
			const next = fields( creation.selection, [ 'start', 'expected' ] ), target = fields( creation.target, descriptors );
			if ( response.error || origin.pageId !== request.pageId || origin.revisionId !== request.originRevisionId ||
				origin.surfaceId !== request.surfaceId || fields( origin.selection, [ 'start', 'expected' ] ).start !== selection.start || origin.selection.expected !== selection.expected ||
				!matches( target, request.pageId, request.currentRevisionId, target.surfaceId ) || !member( target.surfaceId ) ||
				( request.currentRevisionId === request.originRevisionId ? target.surfaceId !== request.surfaceId : target.surfaceId === request.surfaceId ) ||
				!Number.isInteger( next.start ) || next.start < 0 || next.start > 2147483647 || next.expected !== selection.expected ||
				typeof creation.hasLayersSlot !== 'boolean' || !creation.newSurface || creation.newSurface.id !== target.surfaceId ||
				![ 'image', 'slide' ].includes( creation.newSurface.kind ) || typeof creation.newSurface.label !== 'string' ||
				!creation.newSurface.canvas || !Array.isArray( creation.newSurface.layers ) || creation.newSurface.layers.length ) { throw unavailable(); }
			if ( creation.hasLayersSlot ) {
				bundle( creation.baseBundle, request.currentRevisionId );
				if ( creation.baseBundle.snapshot.surfaces.some( surface => [ request.surfaceId, target.surfaceId ].includes( surface.id ) ) ) { throw unavailable(); }
			} else if ( creation.baseBundle !== null ) { throw unavailable(); }
			const detached = new PageOwnedCreationImportClient( this.api, next ), read = detached.read;
			const preparedSelection = Object.freeze( clone( next ) );
			const transaction = Object.freeze( {
				inspect: () => { check(); return clone( creation ); },
				read: options => { check(); return read.call( detached, options ); }, preflight: check,
				commit: () => { check(); Object.defineProperty( this, 'selection', { value: preparedSelection } ); committed = true; }
			} );
			check(); rebaseCertificates.add( transaction ); return transaction;
		}
		constructor( api, selection ) {
			if ( !api || typeof api.post !== 'function' || typeof api.postWithToken !== 'function' ) { throw unavailable(); }
			this.api = api; this.selection = Object.freeze( fields( selection, [ 'start', 'expected' ] ) );
			if ( !Number.isInteger( this.selection.start ) || this.selection.start < 0 || this.selection.start > 2147483647 ||
				typeof this.selection.expected !== 'string' || !this.selection.expected || bytes( this.selection.expected ) > 2097152 ) { throw unavailable(); }
			this.stored = new window.Layers.Editor.PageOwnedWorkingCopyImportReadClient( api );
			confirmedRevisions.set( this, null );
		}
		/** Only confirmed native first-Save publication switches subsequent reads to stored admission. */
		confirmStored( revisionId ) { if ( !id( revisionId ) ) { throw unavailable(); } confirmedRevisions.set( this, revisionId ); }
		read( options ) {
			let request;
			try {
				request = fields( options, identities );
				if ( ![ request.targetPageId, request.targetBaseRevisionId, request.sourcePageId, request.sourceRevisionId ].every( id ) ||
					!member( request.targetSurfaceId ) || !member( request.sourceSurfaceId ) || request.targetPageId === request.sourcePageId ) { throw unavailable(); }
				if ( confirmedRevisions.get( this ) !== null ) { return this.stored.read( request ); }
			} catch ( error ) { return Promise.reject( unavailable() ); }
			return Promise.resolve().then( () => this.api.post( {
				action: 'layersworkingcopyimportcreationread', formatversion: 2, exacttext: true,
				targetpageid: request.targetPageId, baserevid: request.targetBaseRevisionId, targetsurface: request.targetSurfaceId,
				embedstart: this.selection.start, embedtext: this.selection.expected,
				sourcepageid: request.sourcePageId, sourcerevid: request.sourceRevisionId, sourcesurface: request.sourceSurfaceId
			} ) ).then( response => {
				const safe = copy( response ), result = fields( exactResponse( safe.layersworkingcopyimportcreationread ), [ 'creation', 'source', 'sourceBundle' ] );
				const creation = fields( result.creation, [ 'target', 'selection', 'hasLayersSlot', 'baseBundle', 'newSurface' ] );
				if ( safe.error || !matches( creation.target, request.targetPageId, request.targetBaseRevisionId, request.targetSurfaceId ) ||
					!matches( result.source, request.sourcePageId, request.sourceRevisionId, request.sourceSurfaceId ) ||
					fields( creation.selection, [ 'start', 'expected' ] ).start !== this.selection.start || creation.selection.expected !== this.selection.expected ||
					typeof creation.hasLayersSlot !== 'boolean' ) { throw unavailable(); }
				if ( creation.hasLayersSlot ) {
					bundle( creation.baseBundle, request.targetBaseRevisionId );
					if ( creation.baseBundle.snapshot.surfaces.some( surface => surface.id === request.targetSurfaceId ) ) { throw unavailable(); }
				} else if ( creation.baseBundle !== null ) { throw unavailable(); }
				const added = creation.newSurface;
				if ( !added || added.id !== request.targetSurfaceId || ![ 'image', 'slide' ].includes( added.kind ) ||
					typeof added.label !== 'string' || !added.canvas || !Array.isArray( added.layers ) || added.layers.length ) { throw unavailable(); }
				bundle( result.sourceBundle, request.sourceRevisionId );
				const selected = result.sourceBundle.snapshot.surfaces.filter( surface => surface.id === request.sourceSurfaceId );
				if ( selected.length !== 1 || selected[ 0 ].kind !== added.kind ||
					selected[ 0 ].label.replace( /[\s_]+/g, ' ' ).trim().toLowerCase() !== added.label.replace( /[\s_]+/g, ' ' ).trim().toLowerCase() ||
					( added.kind === 'image' && ( !added.source || !selected[ 0 ].source || added.source.fileTitle !== selected[ 0 ].source.fileTitle ) ) ) { throw unavailable(); }
				return result;
			} ).catch( () => { throw unavailable(); } );
		}
		/** First Save is a single native POST, never retried. */
		publish( options ) {
			let captured, claims;
			try {
				captured = fields( options, [ 'pageId', 'baseRevisionId', 'surfaceId', 'snapshotJson', 'summary', 'importSources' ] );
				if ( !id( captured.pageId ) || !id( captured.baseRevisionId ) || !member( captured.surfaceId ) ||
					typeof captured.snapshotJson !== 'string' || bytes( captured.snapshotJson ) > 2097152 ||
					typeof captured.summary !== 'string' || Array.from( captured.summary ).length > 500 ||
					!Array.isArray( captured.importSources ) || !captured.importSources.length || captured.importSources.length > 32 ) { throw unavailable(); }
				claims = captured.importSources.map( claim => {
					const value = fields( claim, [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId', 'targetSurfaceId' ] );
					if ( !id( value.sourcePageId ) || !id( value.sourceRevisionId ) || value.sourcePageId === captured.pageId ||
						!member( value.sourceSurfaceId ) || value.targetSurfaceId !== captured.surfaceId ) { throw unavailable(); }
					delete value.targetSurfaceId; return value;
				} );
				if ( bytes( JSON.stringify( claims ) ) > 16384 ) { throw unavailable(); }
			} catch ( error ) { return Promise.reject( unavailable( 'layers-invalid-publication-request' ) ); }
			return new Promise( ( resolve, reject ) => {
				const request = this.api.postWithToken( 'csrf', { action: 'layersworkingcopyimportcreationpublish', formatversion: 2,
					targetpageid: captured.pageId, baserevid: captured.baseRevisionId, targetsurface: captured.surfaceId,
					embedstart: this.selection.start, embedtext: this.selection.expected, data: captured.snapshotJson,
					importsources: JSON.stringify( claims ), summary: captured.summary } );
				if ( request && typeof request.then === 'function' ) { request.then( resolve, ( code, result ) => reject( result || code ) ); } else { resolve( request ); }
			} ).then( response => {
				const value = copy( response );
				if ( value.error ) { throw value; }
				const result = value.layersworkingcopyimportcreationpublish;
				if ( !result || result.result !== 'Success' || !id( result.revid ) || result.revid <= captured.baseRevisionId ) { throw unavailable( 'layers-publication-outcome-unknown' ); }
				return { revisionId: result.revid };
			} ).catch( error => {
				const code = typeof error === 'string' ? error : error && ( error.code || error.error && error.error.code );
				const known = [ 'badtoken', 'permissiondenied', 'ratelimited', 'mustbeposted', 'missingparam', 'outofrange', 'maxbytes',
					'layers-edit-conflict', 'layers-owner-edit-denied', 'layers-invalid-snapshot', 'layers-source-unavailable',
					'layers-admission-unauthorized', 'layers-working-copy-import-unavailable', 'layers-invalid-publication-request',
					'layers-content-not-renderable', 'layers-edit-filtered' ];
				throw unavailable( known.includes( code ) ? code : 'layers-publication-outcome-unknown' );
			} );
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedCreationImportClient = PageOwnedCreationImportClient;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedCreationImportClient; }
}() );
