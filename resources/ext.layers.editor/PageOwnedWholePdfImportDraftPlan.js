/** Pure validation of an inert whole-PDF Import recovery record. */
'use strict';

( function () {
	const CODE = 'layers-working-copy-import-unavailable';
	const own = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	function unavailable() { const error = new Error( CODE ); error.code = CODE; return error; }
	function clone( value, depth = 0, seen = new Set() ) {
		if ( depth > 72 ) { throw unavailable(); }
		if ( value === null || typeof value === 'string' || typeof value === 'boolean' ) { return value; }
		if ( typeof value === 'number' ) { if ( !Number.isFinite( value ) ) { throw unavailable(); } return value; }
		if ( typeof value !== 'object' || seen.has( value ) ) { throw unavailable(); }
		const array = Array.isArray( value ), proto = Object.getPrototypeOf( value );
		if ( array ? proto !== Array.prototype : ![ Object.prototype, null ].includes( proto ) ) { throw unavailable(); }
		seen.add( value );
		const keys = Reflect.ownKeys( value );
		if ( keys.some( key => typeof key !== 'string' ) ) { throw unavailable(); }
		if ( array && ( keys.length !== value.length + 1 || keys.some( key => key !== 'length' &&
			( !/^(0|[1-9][0-9]*)$/.test( key ) || Number( key ) >= value.length ) ) ) ) { throw unavailable(); }
		const result = array ? [] : {};
		for ( const key of keys ) {
			if ( array && key === 'length' ) { continue; }
			const descriptor = Object.getOwnPropertyDescriptor( value, key );
			if ( !descriptor || !own( descriptor, 'value' ) || !descriptor.enumerable ) { throw unavailable(); }
			Object.defineProperty( result, key, { value: clone( descriptor.value, depth + 1, seen ), enumerable: true, writable: true, configurable: true } );
		}
		if ( array && result.length !== value.length ) { throw unavailable(); }
		seen.delete( value ); return result;
	}
	function same( left, right ) {
		if ( left === right ) { return true; }
		if ( left === null || right === null || typeof left !== 'object' || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const leftKeys = Object.keys( left ), rightKeys = Object.keys( right );
		return leftKeys.length === rightKeys.length && leftKeys.every( key => own( right, key ) && same( left[ key ], right[ key ] ) );
	}
	function object( value ) { return !!value && typeof value === 'object' && !Array.isArray( value ); }
	function exact( value, keys ) { return object( value ) && Object.keys( value ).sort().join( '\u0000' ) === keys.slice().sort().join( '\u0000' ); }
	function id( value ) { return typeof value === 'string' && value.length > 0 && new TextEncoder().encode( value ).length <= 128; }
	function validName( value ) {
		return typeof value === 'string' && value === value.replace( /\s+/gu, ' ' ).trim() && Array.from( value ).length > 0 &&
			Array.from( value ).length <= 255 && !Array.from( value ).some( char => char.charCodeAt( 0 ) < 32 ||
				char.charCodeAt( 0 ) === 127 || '|[]{}<>:'.includes( char ) );
	}
	function groupOf( snapshot, scope ) {
		const anchor = snapshot.surfaces.find( surface => surface.id === scope.surfaceId );
		if ( !anchor || anchor.kind !== 'pdf' || !anchor.source || typeof anchor.label !== 'string' ) { throw unavailable(); }
		const stored = JSON.parse( scope.savedJson ).surfaces.find( surface => surface.id === scope.surfaceId );
		if ( !stored || ( anchor.label !== stored.label && !validName( anchor.label ) ) ) { throw unavailable(); }
		const key = value => String( value ).replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
		const result = snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.source &&
			surface.source.fileTitle === anchor.source.fileTitle && key( surface.label ) === key( anchor.label ) );
		const pages = new Set();
		for ( const surface of result ) {
			if ( surface.label !== anchor.label || !Number.isInteger( surface.source.page ) || surface.source.page < 1 ||
				surface.source.page > scope.pageCount || pages.has( surface.source.page ) || !same( sourcePin( surface.source ), sourcePin( anchor.source ) ) ) { throw unavailable(); }
			pages.add( surface.source.page );
		}
		return result;
	}
	function fixed( value ) {
		const result = { ...value }; delete result.canvas; delete result.layers; delete result.readingOrder; delete result.label; return result;
	}
	function sourcePin( value ) { const result = { ...value }; delete result.page; return result; }
	function validSnapshot( value ) {
		if ( !object( value ) || !Array.isArray( value.surfaces ) ) { return false; }
		const ids = new Set();
		for ( const surface of value.surfaces ) {
			if ( !object( surface ) || !id( surface.id ) || ids.has( surface.id ) ) { return false; }
			ids.add( surface.id );
		}
		return true;
	}
	function mapRows( rows, scope, base, group, storedGroup, temporary, admissions ) {
		if ( !Array.isArray( rows ) ) { throw unavailable(); }
		if ( !Array.isArray( admissions ) || admissions.some( row => !Array.isArray( row ) || row.length !== 2 || !id( row[ 0 ] ) || !object( row[ 1 ] ) ) ) { throw unavailable(); }
		const keys = new Set(), ids = new Set(), pages = new Set(), baseIds = new Set( base.surfaces.map( value => value.id ) );
		for ( const row of rows ) {
			if ( !Array.isArray( row ) || row.length !== 2 || !id( row[ 0 ] ) || keys.has( row[ 0 ] ) || !object( row[ 1 ] ) ) { throw unavailable(); }
			keys.add( row[ 0 ] );
			const surface = row[ 1 ];
			if ( surface.id !== row[ 0 ] || baseIds.has( row[ 0 ] ) || ids.has( surface.id ) || surface.kind !== 'pdf' ||
				!surface.source || !Number.isInteger( surface.source.page ) || surface.source.page < 1 || surface.source.page > scope.pageCount ||
				typeof surface.label !== 'string' || !same( sourcePin( surface.source ), sourcePin( group[ 0 ].source ) ) ||
				!Array.isArray( surface.layers ) || surface.layers.length !== 0 ) { throw unavailable(); }
			ids.add( surface.id ); pages.add( surface.source.page );
			const origin = admissions.find( item => item[ 0 ] === surface.id );
			if ( !origin || !exact( origin[ 1 ], [ 'revisionId', 'surface' ] ) || !Number.isInteger( origin[ 1 ].revisionId ) || origin[ 1 ].revisionId < 1 ||
				origin[ 1 ].revisionId > scope.baseRevisionId || !object( origin[ 1 ].surface ) || origin[ 1 ].surface.id !== surface.id ||
				typeof origin[ 1 ].surface.label !== 'string' ) { throw unavailable(); }
			if ( !Array.isArray( origin[ 1 ].surface.layers ) || origin[ 1 ].surface.layers.length !== 0 ||
				!same( origin[ 1 ].surface, surface ) ||
				origin[ 1 ].surface.source.page !== surface.source.page || origin[ 1 ].surface.source.fileTitle !== surface.source.fileTitle ) { throw unavailable(); }
			const nativeGroupMember = storedGroup.find( member => member.source.page === surface.source.page );
			if ( nativeGroupMember ) { throw unavailable(); }
			const blank = temporary.find( entry => entry[ 0 ] === surface.id )?.[ 1 ];
			if ( !blank || !same( fixed( surface ), fixed( blank ) ) ) { throw unavailable(); }
		}
		if ( keys.size !== ids.size || keys.size !== temporary.length || admissions.length !== temporary.length ) { throw unavailable(); }
		const tempIds = new Set( temporary.map( row => row[ 0 ] ) );
		if ( tempIds.size !== temporary.length || admissions.some( row => !tempIds.has( row[ 0 ] ) ) ) { throw unavailable(); }
		return { ids, pages };
	}
	function validatePairRows( temporary, admissions ) {
		if ( !Array.isArray( temporary ) || !Array.isArray( admissions ) ) { throw unavailable(); }
		const temporaryIds = new Set(), admissionIds = new Set();
		for ( const row of temporary ) {
			if ( !Array.isArray( row ) || row.length !== 2 || !id( row[ 0 ] ) || temporaryIds.has( row[ 0 ] ) || !object( row[ 1 ] ) ) { throw unavailable(); }
			temporaryIds.add( row[ 0 ] );
		}
		for ( const row of admissions ) {
			if ( !Array.isArray( row ) || row.length !== 2 || !id( row[ 0 ] ) || admissionIds.has( row[ 0 ] ) ||
				!exact( row[ 1 ], [ 'revisionId', 'surface' ] ) || !Number.isInteger( row[ 1 ].revisionId ) || row[ 1 ].revisionId < 1 ||
				!object( row[ 1 ].surface ) ) { throw unavailable(); }
			admissionIds.add( row[ 0 ] );
		}
		if ( temporaryIds.size !== admissionIds.size || Array.from( temporaryIds ).some( key => !admissionIds.has( key ) ) ) { throw unavailable(); }
	}
	function checkSources( values, scope ) {
		if ( !Array.isArray( values ) || values.length > 32 ) { throw unavailable(); }
		const seen = new Set();
		for ( const value of values ) {
			if ( !exact( value, [ 'targetSurfaceId', 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ] ) ||
				![ value.sourcePageId, value.sourceRevisionId ].every( number => Number.isInteger( number ) && number > 0 && number <= 2147483647 ) ||
				!id( value.targetSurfaceId ) || !id( value.sourceSurfaceId ) || value.targetSurfaceId !== scope.surfaceId || value.sourcePageId === scope.pageId ) { throw unavailable(); }
			const key = JSON.stringify( [ value.sourcePageId, value.sourceRevisionId, value.sourceSurfaceId ] );
			if ( seen.has( key ) ) { throw unavailable(); } seen.add( key );
		}
	}
	function timeline( input ) {
		if ( !exact( input, [ 'history', 'historyIndex', 'lastSaveHistoryIndex', 'maxHistorySteps' ] ) || !Array.isArray( input.history ) ||
			!Number.isInteger( input.maxHistorySteps ) || input.maxHistorySteps < 1 || input.history.length > input.maxHistorySteps ||
			!Number.isInteger( input.historyIndex ) || !Number.isInteger( input.lastSaveHistoryIndex ) ||
			input.historyIndex < -1 || input.historyIndex >= input.history.length || input.lastSaveHistoryIndex < -1 || input.lastSaveHistoryIndex >= input.history.length ||
			( input.history.length ? input.historyIndex < 0 : input.historyIndex !== -1 ) ||
			input.history.some( entry => !object( entry ) || !Array.isArray( entry.layers ) ||
				( own( entry, 'timestamp' ) && ( !Number.isFinite( entry.timestamp ) || entry.timestamp < 0 ) ) ||
				( own( entry, 'description' ) && typeof entry.description !== 'string' ) ) ) { throw unavailable(); }
		const markers = new Set();
		for ( const entry of input.history ) {
			if ( !own( entry, 'pdfImportGroup' ) ) { continue; }
			const mark = entry.pdfImportGroup;
			if ( !exact( mark, [ 'id', 'page' ] ) || typeof mark.id !== 'string' || !/^[a-f0-9]{32}$/.test( mark.id ) ||
				!Number.isInteger( mark.page ) || mark.page < 1 || markers.has( mark.id ) ) { throw unavailable(); }
			markers.add( mark.id );
		}
		return input;
	}
	function rowMap( rows, maxPage ) {
		if ( !Array.isArray( rows ) ) { throw unavailable(); }
		const result = new Map();
		for ( const row of rows ) {
			if ( !exact( row, [ 'page', 'timeline' ] ) || !Number.isInteger( row.page ) || row.page < 1 || row.page > maxPage || result.has( row.page ) ) { throw unavailable(); }
			result.set( row.page, timeline( row.timeline ) );
			if ( row.timeline.history.some( entry => own( entry, 'pdfImportGroup' ) && entry.pdfImportGroup.page !== row.page ) ) { throw unavailable(); }
		}
		return result;
	}
	function checkpoint( value, session, base, currentGroup ) {
		if ( !exact( value, [ 'snapshot', 'temporary', 'admissions', 'sources', 'admissionRevisions' ] ) || !validSnapshot( value.snapshot ) ) { throw unavailable(); }
		const group = groupOf( value.snapshot, session.scope );
		if ( !group.length || group.some( member => member.label !== currentGroup[ 0 ].label || !same( sourcePin( member.source ), sourcePin( currentGroup[ 0 ].source ) ) ) ) { throw unavailable(); }
		checkSources( value.sources, session.scope );
		validatePairRows( value.temporary, value.admissions );
		const baseGroup = groupOf( base, session.scope ), baseById = new Map( baseGroup.map( member => [ member.id, member ] ) );
		if ( baseGroup.some( member => !group.some( valueMember => valueMember.id === member.id && same( fixed( member ), fixed( valueMember ) ) ) ) ||
			group.some( member => {
				if ( baseById.has( member.id ) ) { return false; }
				const origin = value.admissions.find( row => row[ 0 ] === member.id );
				return !origin || !same( fixed( member ), fixed( origin[ 1 ].surface ) ) || member.label !== group[ 0 ].label;
			} ) ) { throw unavailable(); }
		const mapped = mapRows( value.temporary, session.scope, base, group, groupOf( base, session.scope ), value.temporary, value.admissions );
		const ids = new Set( group.map( member => member.id ) );
		if ( mapped.ids.size && mapped.pages.size !== mapped.ids.size ) { throw unavailable(); }
		const revisions = value.admissionRevisions;
		const baseIds = new Set( base.surfaces.map( member => member.id ) );
		const expected = group.filter( member => !baseIds.has( member.id ) ).map( member => {
			const origin = value.admissions.find( row => row[ 0 ] === member.id );
			if ( !origin ) { throw unavailable(); }
			return origin[ 1 ].revisionId < session.scope.baseRevisionId ? { surfaceId: member.id, revisionId: origin[ 1 ].revisionId } : null;
		} ).filter( Boolean )
			.sort( ( a, b ) => a.surfaceId.localeCompare( b.surfaceId ) );
		if ( !same( revisions, expected ) ) { throw unavailable(); }
		// Other file groups and root metadata are data, not authority; keep them intact.
		if ( !object( base ) || !Array.isArray( base.surfaces ) || !ids.size ) { throw unavailable(); }
		return value;
	}
	function checkpointMember( data, scope, page ) {
		const anchor = data.snapshot.surfaces.find( member => member.id === scope.surfaceId );
		const found = data.snapshot.surfaces.find( member => member.kind === 'pdf' && member.source && anchor &&
			member.source.fileTitle === anchor.source.fileTitle && member.label === anchor.label && member.source.page === page );
		if ( found ) { return found; }
		const temporary = data.temporary.find( row => row[ 1 ].source.page === page );
		return temporary && temporary[ 1 ];
	}
	function savedRows( rows, baseGroup, retired = new Set() ) {
		for ( const [ page, value ] of rows ) {
			if ( value.lastSaveHistoryIndex < 0 ) { continue; }
			const original = baseGroup.find( member => member.source.page === page );
			if ( !same( value.history[ value.lastSaveHistoryIndex ].layers, original ? original.layers : [] ) ) {
				const mark = value.history[ 0 ].pdfImportGroup;
				// Native history trimming can clamp a removed saved index to its surviving barrier.
				// That entry is retained, but cannot truthfully represent the exact saved page.
				if ( value.lastSaveHistoryIndex !== 0 || !mark || mark.page !== page || !retired.has( mark.id ) ) { throw unavailable(); }
				value.lastSaveHistoryIndex = -1;
			}
		}
	}
	function history( input, session, base ) {
		if ( !exact( input, [ 'version', 'activePage', 'timelines', 'groups' ] ) || input.version !== 1 || !Number.isInteger( input.activePage ) ||
			input.activePage < 1 || input.activePage > session.scope.pageCount || !Array.isArray( input.groups ) ) { throw unavailable(); }
		const rows = rowMap( input.timelines, session.scope.pageCount ), currentGroup = groupOf( session.snapshot, session.scope );
		const baseGroup = groupOf( base, session.scope );
		const activeMember = currentGroup.find( member => member.source.page === input.activePage ) ||
			session.temporary.find( row => row[ 1 ].source.page === input.activePage )?.[ 1 ];
		const activeTimeline = rows.get( input.activePage );
		if ( !activeMember || !activeTimeline || ( activeTimeline.historyIndex >= 0 &&
			!same( activeTimeline.history[ activeTimeline.historyIndex ].layers, activeMember.layers ) ) ) { throw unavailable(); }
		for ( const member of currentGroup ) {
			const original = baseGroup.find( value => value.id === member.id );
			const dirty = !original || !same( { canvas: original.canvas, layers: original.layers, readingOrder: original.readingOrder },
				{ canvas: member.canvas, layers: member.layers, readingOrder: member.readingOrder } );
			const row = rows.get( member.source.page );
			if ( ( dirty || input.activePage === member.source.page ) && !row ) { throw unavailable(); }
			if ( row && row.historyIndex >= 0 && !same( row.history[ row.historyIndex ].layers, member.layers ) ) { throw unavailable(); }
		}
		const currentMarkers = new Map(), groupIds = new Set();
		for ( const value of input.groups ) {
			if ( !exact( value, [ 'id', 'phase', 'retired', 'entries', 'checkpoints', 'timelines' ] ) ||
				typeof value.id !== 'string' || !/^[a-f0-9]{32}$/.test( value.id ) || groupIds.has( value.id ) ||
				![ 'before', 'after' ].includes( value.phase ) || typeof value.retired !== 'boolean' || !Array.isArray( value.entries ) ) { throw unavailable(); }
			groupIds.add( value.id );
			const entries = new Map();
			for ( const row of value.entries ) {
				if ( !exact( row, [ 'page', 'entry' ] ) || !Number.isInteger( row.page ) || row.page < 1 || row.page > session.scope.pageCount || entries.has( row.page ) ||
					!object( row.entry ) || !exact( row.entry.pdfImportGroup, [ 'id', 'page' ] ) || row.entry.pdfImportGroup.id !== value.id || row.entry.pdfImportGroup.page !== row.page ) { throw unavailable(); }
				const tl = rows.get( row.page );
				if ( !tl || tl.history.filter( item => same( item, row.entry ) ).length !== 1 || currentMarkers.has( row.page + ':' + value.id ) ) { throw unavailable(); }
				const index = tl.history.findIndex( item => same( item, row.entry ) );
				if ( ( !value.retired && index < 1 ) || ( tl.historyIndex >= index ) !== ( value.phase === 'after' ) ) { throw unavailable(); }
				entries.set( row.page, { row, index } ); currentMarkers.set( row.page + ':' + value.id, value.id );
			}
			if ( !entries.size ) { throw unavailable(); }
			if ( value.retired ) {
				if ( value.checkpoints !== null || value.timelines !== null ) { throw unavailable(); }
				continue;
			}
			if ( !exact( value.checkpoints, [ 'before', 'after' ] ) || !exact( value.timelines, [ 'pages', 'before', 'after' ] ) ||
				!Array.isArray( value.timelines.pages ) || value.timelines.pages.length !== entries.size ||
				new Set( value.timelines.pages ).size !== entries.size || value.timelines.pages.some( page => !entries.has( page ) ) ) { throw unavailable(); }
			const beforeRows = rowMap( value.timelines.before, session.scope.pageCount ), afterRows = rowMap( value.timelines.after, session.scope.pageCount );
			savedRows( beforeRows, baseGroup ); savedRows( afterRows, baseGroup );
			for ( const page of value.timelines.pages ) {
				const before = beforeRows.get( page ), after = afterRows.get( page ), markerRow = entries.get( page ), beforePoint = before && before.history[ before.historyIndex ];
				const markerIndex = after && after.history.findIndex( entry => same( entry, markerRow.row.entry ) );
				if ( !before || !after || !beforePoint || markerIndex < 1 ||
					before.history.some( entry => entry.pdfImportGroup && entry.pdfImportGroup.id === value.id ) ||
					!same( after.history[ markerIndex - 1 ].layers, beforePoint.layers ) ) { throw unavailable(); }
			}
			checkpoint( value.checkpoints.before, session, base, currentGroup ); checkpoint( value.checkpoints.after, session, base, currentGroup );
			const expected = value.checkpoints[ value.phase ];
			if ( Array.from( entries, ( [ page, entry ] ) => rows.get( page ).historyIndex ===
				( value.phase === 'after' ? entry.index : entry.index - 1 ) ).every( Boolean ) &&
				same( groupOf( expected.snapshot, session.scope ), currentGroup ) && !same( expected.sources, session.sources ) ) { throw unavailable(); }
			for ( const page of value.timelines.pages ) {
				const before = beforeRows.get( page ), after = afterRows.get( page );
				const beforeMember = checkpointMember( value.checkpoints.before, session.scope, page ) ||
					value.checkpoints.after.temporary.find( row => row[ 1 ].source.page === page )?.[ 1 ];
				const afterMember = checkpointMember( value.checkpoints.after, session.scope, page );
				const markerIndex = after.history.findIndex( entry => same( entry, entries.get( page ).row.entry ) );
				if ( !beforeMember || !afterMember || markerIndex < 1 || !same( before.history[ before.historyIndex ].layers, beforeMember.layers ) ||
					!same( after.history[ markerIndex ].layers, afterMember.layers ) ) { throw unavailable(); }
			}
		}
		for ( const [ page, tl ] of rows ) {
			for ( const item of tl.history ) {
				if ( own( item, 'pdfImportGroup' ) ) {
					const mark = item.pdfImportGroup;
					if ( !exact( mark, [ 'id', 'page' ] ) || mark.page !== page || !groupIds.has( mark.id ) || !currentMarkers.has( page + ':' + mark.id ) ) { throw unavailable(); }
				}
			}
		}
		savedRows( rows, baseGroup, new Set( input.groups.filter( value => value.retired ).map( value => value.id ) ) );
		return input;
	}
	class PageOwnedWholePdfImportDraftPlan {
		static prepare( input, expected ) {
			try {
				const data = clone( input ), current = clone( expected );
				if ( !exact( data, [ 'format', 'version', 'session', 'history' ] ) || data.format !== 'layers-whole-pdf-import-draft' || data.version !== 1 ||
					!exact( data.session, [ 'version', 'scope', 'snapshot', 'pdf', 'context', 'temporary', 'admissions', 'sources', 'admissionRevisions' ] ) ||
					data.session.version !== 1 || !exact( current, [ 'version', 'scope', 'snapshot', 'pdf', 'context', 'temporary', 'admissions', 'sources', 'admissionRevisions' ] ) ||
					!same( data.session.scope, current.scope ) || !same( data.session.pdf, { ...current.pdf, page: data.session.pdf.page, activeSurfaceId: data.session.pdf.activeSurfaceId } ) ||
					!validSnapshot( data.session.snapshot ) || !validSnapshot( current.snapshot ) ) { throw unavailable(); }
				const scope = data.session.scope, base = JSON.parse( scope.savedJson );
				if ( !Number.isInteger( scope.pageCount ) || scope.pageCount < 1 || scope.pageCount > 2147483647 ||
					!Number.isInteger( scope.baseRevisionId ) || scope.baseRevisionId < 1 || !Number.isInteger( scope.pageId ) || scope.pageId < 1 ||
					!validSnapshot( base ) || !Number.isInteger( data.session.pdf.page ) || data.session.pdf.page < 1 || data.session.pdf.page > scope.pageCount ||
					!id( data.session.pdf.activeSurfaceId ) ) { throw unavailable(); }
				const group = groupOf( base, scope ), currentGroup = groupOf( data.session.snapshot, scope );
				const root = value => { const result = { ...value }; delete result.surfaces; return result; };
				if ( !same( root( data.session.snapshot ), root( current.snapshot ) ) ) { throw unavailable(); }
				if ( !group.length || !currentGroup.length ) { throw unavailable(); }
				const selectedIds = new Set( [ ...currentGroup, ...groupOf( current.snapshot, scope ) ].map( surface => surface.id ) );
				const selectedKey = surface => selectedIds.has( surface.id );
				if ( !same( data.session.snapshot.surfaces.filter( member => !selectedKey( member ) ),
					current.snapshot.surfaces.filter( member => !selectedKey( member ) ) ) ) { throw unavailable(); }
				validatePairRows( data.session.temporary, data.session.admissions );
				if ( currentGroup.some( member => {
					const original = group.find( item => item.id === member.id );
					if ( original ) { return !same( fixed( original ), fixed( member ) ); }
					const temp = data.session.temporary.find( row => row[ 0 ] === member.id );
					const origin = data.session.admissions.find( row => row[ 0 ] === member.id );
					return !temp || !origin || !same( fixed( temp[ 1 ] ), fixed( origin[ 1 ].surface ) ) ||
						!same( fixed( member ), fixed( origin[ 1 ].surface ) ) || member.label !== currentGroup[ 0 ].label;
				} ) || group.some( original => !currentGroup.some( member => member.id === original.id ) ) ) { throw unavailable(); }
				const temp = mapRows( data.session.temporary, scope, base, currentGroup, group, data.session.temporary, data.session.admissions );
				if ( data.session.admissions.length !== data.session.temporary.length || data.session.temporary.length !== temp.ids.size ) { throw unavailable(); }
				const baseIds = new Set( base.surfaces.map( member => member.id ) );
				if ( currentGroup.some( member => !baseIds.has( member.id ) && ( !temp.ids.has( member.id ) ||
					!same( fixed( member ), fixed( data.session.temporary.find( row => row[ 0 ] === member.id )[ 1 ] ) ) ) ) ) { throw unavailable(); }
				checkSources( data.session.sources, scope );
				const origins = currentGroup.filter( member => !baseIds.has( member.id ) ).map( member => {
					const origin = data.session.admissions.find( row => row[ 0 ] === member.id );
					if ( !origin ) { throw unavailable(); }
					return origin[ 1 ].revisionId < scope.baseRevisionId ? { surfaceId: member.id, revisionId: origin[ 1 ].revisionId } : null;
				} ).filter( Boolean ).sort( ( a, b ) => a.surfaceId.localeCompare( b.surfaceId ) );
				if ( !same( data.session.admissionRevisions, origins ) ) { throw unavailable(); }
				const active = currentGroup.find( member => member.id === data.session.pdf.activeSurfaceId ) || data.session.temporary.find( row => row[ 0 ] === data.session.pdf.activeSurfaceId )?.[ 1 ];
				if ( !active || active.source.page !== data.session.pdf.page ) { throw unavailable(); }
				history( data.history, data.session, base );
				return data;
			} catch ( error ) { throw unavailable(); }
		}
	}
	if ( typeof window !== 'undefined' ) { window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {}; window.Layers.Editor.PageOwnedWholePdfImportDraftPlan = PageOwnedWholePdfImportDraftPlan; }
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportDraftPlan; }
}() );
