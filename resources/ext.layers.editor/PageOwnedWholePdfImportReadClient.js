/** Unregistered whole-PDF working-copy Import transport; requires an injected API. */
'use strict';

( function () {
	const CODE = 'layers-working-copy-import-unavailable';
	const INPUT_FIELDS = [ 'targetPageId', 'targetBaseRevisionId', 'targetSurfaceId',
		'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ];
	const DATA_FIELDS = [ 'target', 'source', 'targetBundle', 'sourceBundle', 'targetGroup',
		'sourceGroup', 'admittedTargetSurfaces', 'admittedTargetGeometry', 'admittedTargetRenditions' ];
	const DESCRIPTOR_FIELDS = [ 'pageId', 'owner', 'revisionId', 'surfaceId' ];
	const BUNDLE_FIELDS = [ 'revisionId', 'snapshot', 'sourceGeometry', 'sourceRenditions' ];
	const GROUP_FIELDS = [ 'label', 'source', 'pageCount', 'members' ];
	const GEOMETRY_FIELDS = [ 'page', 'width', 'height', 'units' ];
	const RENDITION_FIELDS = [ 'url', 'width', 'height' ];
	const PIN_FIELDS = [ 'repository', 'fileTitle', 'timestamp', 'sha1' ];

	function unavailable() {
		const error = new Error( CODE );
		error.code = CODE;
		return error;
	}

	function object( value ) {
		return value !== null && typeof value === 'object' && !Array.isArray( value );
	}

	function exactKeys( value, keys ) {
		return object( value ) && Reflect.ownKeys( value ).length === keys.length &&
			keys.every( key => Object.hasOwn( value, key ) );
	}

	function integer( value ) {
		return Number.isInteger( value ) && value >= 1 && value <= 2147483647;
	}

	function memberId( value ) {
		return typeof value === 'string' && value.length > 0 &&
			new TextEncoder().encode( value ).length <= 128;
	}

	function detach( value, ancestors = new Set(), depth = 0 ) {
		if ( depth > 72 ) {
			throw unavailable();
		}
		if ( value === null || typeof value === 'string' || typeof value === 'boolean' ) {
			return value;
		}
		if ( typeof value === 'number' && Number.isFinite( value ) &&
			( !Number.isInteger( value ) || Number.isSafeInteger( value ) ) ) {
			return value;
		}
		if ( typeof value !== 'object' || ancestors.has( value ) ||
			( !Array.isArray( value ) && ![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ) ) {
			throw unavailable();
		}
		ancestors.add( value );
		const descriptors = Object.getOwnPropertyDescriptors( value );
		const keys = Reflect.ownKeys( descriptors );
		const result = Array.isArray( value ) ? [] : {};
		if ( Array.isArray( value ) && keys.length !== value.length + 1 ) {
			throw unavailable();
		}
		for ( const key of keys ) {
			if ( Array.isArray( value ) && key === 'length' ) {
				continue;
			}
			const descriptor = descriptors[ key ];
			if ( typeof key !== 'string' || !Object.hasOwn( descriptor, 'value' ) || !descriptor.enumerable ||
				( Array.isArray( value ) && ( !/^(0|[1-9][0-9]*)$/.test( key ) || Number( key ) >= value.length ) ) ) {
				throw unavailable();
			}
			Object.defineProperty( result, key, { value: detach( descriptor.value, ancestors, depth + 1 ),
				enumerable: true, writable: true, configurable: true } );
		}
		ancestors.delete( value );
		return result;
	}

	function nameKey( label ) {
		return label.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	}

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

	function validPin( pin ) {
		const timestamp = typeof pin.timestamp === 'string' && /^\d{14}$/u.test( pin.timestamp ) ?
			new Date( pin.timestamp.slice( 0, 4 ) + '-' + pin.timestamp.slice( 4, 6 ) + '-' +
				pin.timestamp.slice( 6, 8 ) + 'T' + pin.timestamp.slice( 8, 10 ) + ':' +
				pin.timestamp.slice( 10, 12 ) + ':' + pin.timestamp.slice( 12, 14 ) + 'Z' ) : null;
		return object( pin ) && exactKeys( pin, PIN_FIELDS ) && pin.repository === 'local' &&
			typeof pin.fileTitle === 'string' && pin.fileTitle.split( '' ).every( char => {
				const code = char.charCodeAt( 0 );
				return code >= 32 && code !== 127 && !'#<>[]{}|'.includes( char );
			} ) && pin.fileTitle.startsWith( 'File:' ) && pin.fileTitle.length > 5 &&
			new TextEncoder().encode( pin.fileTitle ).length <= 255 &&
			timestamp instanceof Date && Number.isFinite( timestamp.getTime() ) &&
			timestamp.toISOString().replace( /\D/gu, '' ).slice( 0, 14 ) === pin.timestamp &&
			typeof pin.sha1 === 'string' && /^[0-9a-z]{31}$/u.test( pin.sha1 );
	}

	function pinOf( surface ) {
		if ( !object( surface.source ) ) {
			throw unavailable();
		}
		const pin = {};
		for ( const key of Object.keys( surface.source ) ) {
			if ( key !== 'page' ) {
				Object.defineProperty( pin, key, { value: surface.source[ key ], enumerable: true } );
			}
		}
		return pin;
	}

	function validDescriptor( descriptor, pageId, revisionId, surfaceId ) {
		return exactKeys( descriptor, DESCRIPTOR_FIELDS ) && descriptor.pageId === pageId &&
			descriptor.revisionId === revisionId && descriptor.surfaceId === surfaceId &&
			typeof descriptor.owner === 'string' && descriptor.owner.length > 0;
	}

	function validateSnapshot( bundle, revisionId, anchorId, allIds ) {
		if ( !exactKeys( bundle, BUNDLE_FIELDS ) || bundle.revisionId !== revisionId ||
			!object( bundle.snapshot ) || bundle.snapshot.schemaVersion !== 1 ||
			!Array.isArray( bundle.snapshot.surfaces ) ) {
			throw unavailable();
		}
		const surfaces = bundle.snapshot.surfaces;
		const byId = new Map();
		for ( const surface of surfaces ) {
			if ( !object( surface ) || !memberId( surface.id ) || byId.has( surface.id ) || allIds.has( surface.id ) ) {
				throw unavailable();
			}
			byId.set( surface.id, surface );
			allIds.add( surface.id );
		}
		const anchor = byId.get( anchorId );
		if ( !anchor || anchor.kind !== 'pdf' || typeof anchor.label !== 'string' || !nameKey( anchor.label ) ||
			!validPin( pinOf( anchor ) ) || !integer( anchor.source.page ) ) {
			throw unavailable();
		}
		const groupMembers = new Map();
		for ( const surface of surfaces ) {
			if ( !object( surface.source ) || surface.source.fileTitle !== anchor.source.fileTitle ||
				typeof surface.label !== 'string' || nameKey( surface.label ) !== nameKey( anchor.label ) ) {
				continue;
			}
			if ( surface.kind !== 'pdf' || surface.label !== anchor.label || !integer( surface.source.page ) ||
				comparable( pinOf( surface ) ) !== comparable( pinOf( anchor ) ) ||
				groupMembers.has( surface.source.page ) ) {
				throw unavailable();
			}
			groupMembers.set( surface.source.page, surface );
		}
		const geometry = bundle.sourceGeometry, renditions = bundle.sourceRenditions;
		if ( !sameKeys( geometry, [ ...groupMembers.values() ].map( surface => surface.id ) ) ||
			!sameKeys( renditions, [ ...groupMembers.values() ].map( surface => surface.id ) ) ) {
			throw unavailable();
		}
		for ( const surface of groupMembers.values() ) {
			validGeometry( geometry[ surface.id ], surface.source.page );
			validRendition( renditions[ surface.id ] );
		}
		return { anchor, members: groupMembers };
	}

	function sameKeys( value, expected ) {
		return ( object( value ) || Array.isArray( value ) ) && Object.keys( value ).length === expected.length &&
			expected.every( key => Object.prototype.propertyIsEnumerable.call( value, key ) );
	}

	function validGeometry( value, page ) {
		if ( !exactKeys( value, GEOMETRY_FIELDS ) || value.page !== page || !integer( value.width ) ||
			!integer( value.height ) || value.units !== 'file-handler-pixels' ) {
			throw unavailable();
		}
	}

	function validRendition( value ) {
		let url;
		try {
			url = new URL( value.url );
		} catch ( error ) {
			throw unavailable();
		}
		if ( !exactKeys( value, RENDITION_FIELDS ) || typeof value.url !== 'string' ||
			!['http:', 'https:'].includes( url.protocol ) || !url.hostname || !integer( value.width ) ||
			!integer( value.height ) ) {
			throw unavailable();
		}
	}

	function validateGroup( group, bundleGroup, expectedPin ) {
		if ( !exactKeys( group, GROUP_FIELDS ) || typeof group.label !== 'string' || !nameKey( group.label ) ||
			group.label !== bundleGroup.anchor.label || !validPin( group.source ) ||
			comparable( group.source ) !== comparable( expectedPin ) || !integer( group.pageCount ) ||
			!Array.isArray( group.members ) ) {
			throw unavailable();
		}
		let prior = 0;
		const members = new Map();
		for ( const member of group.members ) {
			if ( !exactKeys( member, [ 'page', 'surfaceId' ] ) || !integer( member.page ) ||
				member.page <= prior || member.page > group.pageCount || !memberId( member.surfaceId ) ||
				members.has( member.page ) ) {
				throw unavailable();
			}
			prior = member.page;
			members.set( member.page, member.surfaceId );
		}
		if ( members.size !== bundleGroup.members.size ) {
			throw unavailable();
		}
		for ( const [ page, surface ] of bundleGroup.members ) {
			if ( members.get( page ) !== surface.id || page > group.pageCount ) {
				throw unavailable();
			}
		}
		return members;
	}

	function samePin( target, source ) {
		return target.fileTitle === source.fileTitle;
	}

	function validateData( data, input ) {
		if ( !exactKeys( data, DATA_FIELDS ) || !validDescriptor( data.target, input.targetPageId,
			input.targetBaseRevisionId, input.targetSurfaceId ) ||
			!validDescriptor( data.source, input.sourcePageId, input.sourceRevisionId, input.sourceSurfaceId ) ||
			data.target.owner === data.source.owner ) {
			throw unavailable();
		}
		const ids = new Set();
		const targetBundle = validateSnapshot( data.targetBundle, input.targetBaseRevisionId, input.targetSurfaceId, ids );
		const sourceBundle = validateSnapshot( data.sourceBundle, input.sourceRevisionId, input.sourceSurfaceId, new Set() );
		const targetPin = pinOf( targetBundle.anchor ), sourcePin = pinOf( sourceBundle.anchor );
		const targetMembers = validateGroup( data.targetGroup, targetBundle, targetPin );
		const sourceMembers = validateGroup( data.sourceGroup, sourceBundle, sourcePin );
		if ( !samePin( targetPin, sourcePin ) ||
			nameKey( data.targetGroup.label ) !== nameKey( data.sourceGroup.label ) ||
			!Array.isArray( data.admittedTargetSurfaces ) ) {
			throw unavailable();
		}
		const missing = [ ...sourceMembers.keys() ].filter( page => !targetMembers.has( page ) );
		if ( missing.some( page => page > data.targetGroup.pageCount ) ||
			data.admittedTargetSurfaces.length !== missing.length ) {
			throw unavailable();
		}
		const admissions = new Map();
		for ( const surface of data.admittedTargetSurfaces ) {
			if ( !object( surface ) || surface.kind !== 'pdf' || surface.label !== data.targetGroup.label ||
				!memberId( surface.id ) || ids.has( surface.id ) || !object( surface.source ) ||
				!integer( surface.source.page ) || !Array.isArray( surface.layers ) || surface.layers.length !== 0 ||
				comparable( pinOf( surface ) ) !== comparable( targetPin ) ||
				!missing.includes( surface.source.page ) || admissions.has( surface.source.page ) ) {
				throw unavailable();
			}
			ids.add( surface.id );
			admissions.set( surface.source.page, surface );
		}
		if ( missing.some( page => !admissions.has( page ) ) ) {
			throw unavailable();
		}
		const admissionIds = [ ...admissions.values() ].map( surface => surface.id );
		if ( !sameKeys( data.admittedTargetGeometry, admissionIds ) ||
			!sameKeys( data.admittedTargetRenditions, admissionIds ) ) {
			throw unavailable();
		}
		for ( const surface of admissions.values() ) {
			validGeometry( data.admittedTargetGeometry[ surface.id ], surface.source.page );
			validRendition( data.admittedTargetRenditions[ surface.id ] );
		}
		return data;
	}

	function capture( options ) {
		if ( !exactKeys( options, INPUT_FIELDS ) ) {
			throw unavailable();
		}
		const input = {};
		for ( const key of INPUT_FIELDS ) {
			input[ key ] = options[ key ];
		}
		if ( !integer( input.targetPageId ) || !integer( input.targetBaseRevisionId ) ||
			!integer( input.sourcePageId ) || !integer( input.sourceRevisionId ) ||
			!memberId( input.targetSurfaceId ) || !memberId( input.sourceSurfaceId ) ||
			input.targetPageId === input.sourcePageId ) {
			throw unavailable();
		}
		return input;
	}

	class PageOwnedWholePdfImportReadClient {
		constructor( api ) {
			if ( !api || typeof api.post !== 'function' ) {
				throw unavailable();
			}
			this.api = api;
		}

		read( options ) {
			let input;
			try {
				input = capture( options );
			} catch ( error ) {
				return Promise.reject( unavailable() );
			}
			let request;
			try {
				request = this.api.post( {
					action: 'layersworkingcopypdfimportread', formatversion: 2,
					targetpageid: input.targetPageId, baserevid: input.targetBaseRevisionId,
					targetsurface: input.targetSurfaceId, sourcepageid: input.sourcePageId,
					sourcerevid: input.sourceRevisionId, sourcesurface: input.sourceSurfaceId
				} );
			} catch ( error ) {
				return Promise.reject( unavailable() );
			}
			return Promise.resolve( request ).then( response => {
				const safe = detach( response );
				if ( !object( safe ) || Object.hasOwn( safe, 'error' ) ) {
					throw unavailable();
				}
				const envelope = safe.layersworkingcopypdfimportread;
				if ( !exactKeys( envelope, [ 'version', 'data' ] ) || envelope.version !== 1 ||
					typeof envelope.data !== 'string' || !ascii( envelope.data ) ) {
					throw unavailable();
				}
				const data = detach( JSON.parse( envelope.data ) );
				uniqueKeys( envelope.data );
				return validateData( data, input );
			} ).catch( () => {
				throw unavailable();
			} );
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedWholePdfImportReadClient = PageOwnedWholePdfImportReadClient;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedWholePdfImportReadClient;
	}
}() );
