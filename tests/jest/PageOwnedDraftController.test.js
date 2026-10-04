'use strict';
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );

describe( 'PageOwnedDraftController', () => {
	let controller, bridge, data, state, identity, status, storage, label;
	beforeEach( () => {
		data = new Map();
		storage = { getItem: jest.fn( ( key ) => data.get( key ) ?? null ),
			setItem: jest.fn( ( key, value ) => data.set( key, value ) ) };
		state = { canvas: { width: 800, height: 600, backgroundOpacity: 0 }, layers: [] };
		identity = { owner: 'Owner', baseRevisionId: 12, surfaceId: 'selected' };
		status = { phase: 'ready', readOnly: false };
		label = 'Welcome';
		bridge = { getLiveState: () => state, session: {
			getStatus: () => status, getDraft: () => identity, getLabel: () => label
		} };
		controller = new Controller( bridge, new Store( storage ), new Adapter(), { wiki: 'wiki', user: 'user' } );
	} );

	it( 'round trips live state independently of the valid publication snapshot', () => {
		state.layers = [ { id: 'draft-only', invalidDrawingField: false } ];
		controller.persist();
		const recovery = controller.inspectRecovery();
		expect( recovery ).toEqual( { editorState: state, label: 'Welcome', publicationBlocked: false } );
		recovery.editorState.layers.length = 0;
		expect( controller.inspectRecovery().editorState.layers ).toHaveLength( 1 );
		expect( identity.baseRevisionId ).toBe( 12 );
	} );

	it.each( [ 'saving', 'conflict', 'uncertain' ] )( 'requires reconciliation for a stored %s phase', ( phase ) => {
		status.phase = phase;
		controller.persist();
		status.phase = 'ready';
		expect( controller.inspectRecovery().publicationBlocked ).toBe( true );
		expect( status.phase ).toBe( 'ready' );
	} );

	it( 'keeps a renamed drawing name, and reads drafts written before renaming existed', () => {
		label = 'Renamed';
		controller.persist();
		expect( controller.inspectRecovery().label ).toBe( 'Renamed' );
		const [ key, raw ] = [ ...data.entries() ][ 0 ];
		const envelope = JSON.parse( raw );
		delete envelope.label;
		data.set( key, JSON.stringify( envelope ) );
		expect( controller.inspectRecovery() ).toEqual( { editorState: state, publicationBlocked: false } );
	} );

	it( 'does not look up drafts from another base revision', () => {
		controller.persist();
		identity.baseRevisionId = 13;
		expect( controller.inspectRecovery() ).toBeNull();
		expect( data.size ).toBe( 1 );
	} );

	it( 'rejects tampered envelope scope without applying or deleting it', () => {
		controller.persist();
		const [ key, raw ] = [ ...data.entries() ][ 0 ];
		const envelope = JSON.parse( raw );
		envelope.scope.owner = 'Other owner';
		data.set( key, JSON.stringify( envelope ) );
		expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( data.size ).toBe( 1 );
		expect( identity.owner ).toBe( 'Owner' );
	} );

	it( 'rejects non-JSON edits rather than silently dropping data', () => {
		state.layers = [ { text: undefined } ];
		expect( () => controller.persist() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( storage.setItem ).not.toHaveBeenCalled();
	} );

	it( 'does not read or persist drafts in historical read-only mode', () => {
		status.readOnly = true;
		expect( () => controller.persist() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( storage.setItem ).not.toHaveBeenCalled();
		expect( storage.getItem ).not.toHaveBeenCalled();
	} );

	it( 'surfaces a safe storage failure and leaves live edits intact', () => {
		const store = new Store( { getItem: () => null, setItem: () => { throw new Error( 'quota secret' ); } } );
		controller = new Controller( bridge, store, new Adapter(), { wiki: 'wiki', user: 'user' } );
		expect( () => controller.persist() ).toThrow( 'layers-draft-storage-failed' );
		expect( state.canvas.backgroundOpacity ).toBe( 0 );
	} );

	describe( 'authorized alias for an unsaved file target', () => {
		const oldWriter = 'a'.repeat( 32 );
		const newWriter = 'b'.repeat( 32 );
		let store, currentScope, legacyScope, options;

		function envelope( scope, name = 'Recovered name' ) {
			return JSON.stringify( { version: 1, scope, phase: 'ready', label: name, editorState: state } );
		}

		function oldRecord( writerId = oldWriter, name = 'Recovered name' ) {
			const original = new Store( storage, writerId === null ? undefined : writerId );
			original.write( legacyScope, envelope( legacyScope, name ) );
			return original;
		}

		beforeEach( () => {
			storage.key = jest.fn( ( index ) => Array.from( data.keys() )[ index ] ?? null );
			Object.defineProperty( storage, 'length', { get: () => data.size } );
			bridge.session.isUnsavedNew = jest.fn( () => true );
			currentScope = { wiki: 'wiki', user: 'user', ...identity };
			legacyScope = { ...currentScope, surfaceId: 'old-unsaved-file-target' };
			options = { wiki: 'wiki', user: 'user',
				legacySurface: { surfaceId: legacyScope.surfaceId, baseRevisionId: 12 } };
			store = new Store( storage, newWriter );
			controller = new Controller( bridge, store, new Adapter(), options );
		} );

		it.each( [ oldWriter, null ] )( 'explicitly reads an authorized alias written by %s', ( writerId ) => {
			const original = oldRecord( writerId );
			const bytes = original.read( legacyScope );
			const candidates = controller.listCandidates();
			expect( candidates ).toEqual( [ { surfaceId: legacyScope.surfaceId, writerId } ] );
			expect( controller.inspectRecovery() ).toBeNull();
			expect( controller.describeCandidates( candidates ) ).toEqual( [ {
				editorState: state, label: 'Recovered name', publicationBlocked: false
			} ] );
			controller.selectRecovery( candidates[ 0 ] );
			expect( controller.inspectRecovery().label ).toBe( 'Recovered name' );
			state.layers.push( { id: 'edited', text: 'Retain subsequent work' } );
			controller.persist();
			expect( original.read( legacyScope ) ).toBe( bytes );
			expect( data.size ).toBe( 2 );
			const written = JSON.parse( new Store( storage, newWriter ).read( currentScope ) );
			expect( written.scope ).toEqual( currentScope );
			expect( written.editorState ).toEqual( state );
			expect( identity.surfaceId ).toBe( 'selected' );
		} );

		it( 'keeps current and alias records separate even when their writer IDs match', () => {
			const original = oldRecord();
			original.write( currentScope, envelope( currentScope, 'Current target' ) );
			const candidates = controller.listCandidates();
			expect( candidates ).toEqual( [ oldWriter, { surfaceId: legacyScope.surfaceId, writerId: oldWriter } ] );
			expect( controller.describeCandidates( candidates ).map( ( candidate ) => candidate.label ) )
				.toEqual( [ 'Current target', 'Recovered name' ] );
			controller.selectRecovery( candidates[ 1 ] );
			expect( controller.inspectRecovery().label ).toBe( 'Recovered name' );
			controller.selectRecovery( candidates[ 0 ] );
			expect( controller.inspectRecovery().label ).toBe( 'Current target' );
		} );

		it( 'does not look up any alias without the authorized option', () => {
			oldRecord();
			controller = new Controller( bridge, store, new Adapter(), { wiki: 'wiki', user: 'user' } );
			const list = jest.spyOn( store, 'listCandidates' );
			const read = jest.spyOn( store, 'read' );
			expect( controller.listCandidates() ).toEqual( [] );
			expect( list.mock.calls ).toEqual( [ [ currentScope ] ] );
			expect( controller.inspectRecovery() ).toBeNull();
			expect( read.mock.calls ).toEqual( [ [ currentScope ] ] );
			expect( data.size ).toBe( 1 );
		} );

		it.each( [ 'base', 'saved' ] )( 'invalidates an alias when its %s changes', ( change ) => {
			const original = oldRecord();
			const bytes = original.read( legacyScope );
			const candidate = controller.listCandidates()[ 0 ];
			controller.selectRecovery( candidate );
			if ( change === 'base' ) {
				identity.baseRevisionId = 13;
			} else {
				bridge.session.isUnsavedNew.mockReturnValue( false );
			}
			const list = jest.spyOn( store, 'listCandidates' );
			const read = jest.spyOn( store, 'read' );
			expect( controller.listCandidates() ).toEqual( [] );
			expect( list.mock.calls ).toEqual( [ [ { ...currentScope, baseRevisionId: identity.baseRevisionId } ] ] );
			expect( () => controller.selectRecovery( candidate ) ).toThrow( 'layers-invalid-page-owned-draft' );
			expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
			expect( read ).not.toHaveBeenCalled();
			controller.persist();
			expect( original.read( legacyScope ) ).toBe( bytes );
		} );

		it( 'validates the recovered envelope against the selected legacy scope', () => {
			const original = oldRecord();
			original.write( legacyScope, envelope( currentScope ) );
			const before = new Map( data );
			controller.selectRecovery( controller.listCandidates()[ 0 ] );
			expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
			expect( data ).toEqual( before );
		} );

		it( 'rejects spoofed, cloned or other-controller alias descriptors before reading storage', () => {
			oldRecord();
			const candidate = controller.listCandidates()[ 0 ];
			const other = new Controller( bridge, store, new Adapter(), options );
			const read = jest.spyOn( store, 'read' );
			const select = jest.spyOn( store, 'selectRecovery' );
			const getter = jest.fn( () => { throw new Error( 'private diagnostic' ); } );
			const accessor = Object.defineProperty( {}, 'surfaceId', { get: getter } );
			for ( const spoof of [ {}, { ...candidate }, { surfaceId: 'other', writerId: oldWriter },
				accessor, other.listCandidates()[ 0 ], new Proxy( {}, { get: getter } ) ] ) {
				expect( () => controller.selectRecovery( spoof ) ).toThrow( 'layers-invalid-page-owned-draft' );
			}
			expect( getter ).not.toHaveBeenCalled();
			expect( read ).not.toHaveBeenCalled();
			expect( select ).not.toHaveBeenCalled();
			expect( Object.isFrozen( candidate ) ).toBe( true );
		} );

		it( 'copies authorized options and rejects malformed or accessor options without evaluating them', () => {
			oldRecord();
			options.legacySurface.surfaceId = 'changed-after-construction';
			expect( controller.listCandidates() ).toEqual( [ { surfaceId: legacyScope.surfaceId, writerId: oldWriter } ] );
			const getter = jest.fn( () => { throw new Error( 'private diagnostic' ); } );
			const accessor = Object.defineProperty( { baseRevisionId: 12 }, 'surfaceId', { get: getter } );
			const extraSymbol = { surfaceId: 'old', baseRevisionId: 12, [ Symbol( 'extra' ) ]: true };
			for ( const value of [ null, [], {}, accessor, extraSymbol, { surfaceId: '', baseRevisionId: 12 },
				{ surfaceId: 'old', baseRevisionId: '12' }, { surfaceId: 'old', baseRevisionId: 0 },
				{ surfaceId: 'old', baseRevisionId: 2147483648 }, { surfaceId: 'old', baseRevisionId: 12, extra: true },
				new Proxy( {}, { ownKeys: getter } ) ] ) {
				expect( () => new Controller( bridge, store, new Adapter(),
					{ wiki: 'wiki', user: 'user', legacySurface: value } ) ).toThrow( 'layers-invalid-page-owned-draft' );
			}
			expect( getter ).toHaveBeenCalledTimes( 1 ); // Proxy reflection is caught and redacted.
			getter.mockClear();
			const scopedAccessor = Object.defineProperty( { wiki: 'wiki', user: 'user' },
				'legacySurface', { get: getter } );
			expect( () => new Controller( bridge, store, new Adapter(), scopedAccessor ) )
				.toThrow( 'layers-invalid-page-owned-draft' );
			expect( getter ).not.toHaveBeenCalled();
		} );

		it( 'preserves both original records when writing recovered work fails', () => {
			const original = oldRecord();
			original.write( currentScope, envelope( currentScope, 'Other current writer' ) );
			const before = new Map( data );
			controller.selectRecovery( controller.listCandidates()[ 1 ] );
			expect( controller.inspectRecovery().label ).toBe( 'Recovered name' );
			storage.setItem.mockImplementation( () => { throw new Error( 'private quota diagnostic' ); } );
			expect( () => controller.persist() ).toThrow( 'layers-draft-storage-failed' );
			expect( data ).toEqual( before );
			expect( controller.inspectRecovery().label ).toBe( 'Recovered name' );
			expect( state.canvas.backgroundOpacity ).toBe( 0 );
		} );
	} );
} );
