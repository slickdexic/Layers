'use strict';
const Host = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationHost.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
const History = require( '../../resources/ext.layers.editor/HistoryManager.js' );
const Canvas = require( '../../resources/ext.layers.editor/CanvasManager.js' );
const ImageLoader = require( '../../resources/ext.layers.editor/ImageLoader.js' );
global.GeometryUtils = require( '../../resources/ext.layers.editor/GeometryUtils.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
const Selection = require( '../../resources/ext.layers.editor/SelectionManager.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );
const wait = () => { let resolve, reject; const promise = new Promise( ( yes, no ) => { resolve = yes; reject = no; } ); return { promise, resolve, reject }; };

function preparation( slot, initial, page, count = 2 ) {
	const surface = number => ( { id: Ids.surfaceId( 7, 12, 'File:Source.pdf', 'ABC', number ), kind: 'pdf', label: 'ABC',
		source: { repository: 'local', fileTitle: 'File:Source.pdf', timestamp: '20261001120000', sha1: 'a'.repeat( 31 ), page: number },
		canvas: { width: number === 1 ? 416 : 208, height: number === 1 ? 208 : 416,
			backgroundVisible: true, backgroundOpacity: 1, backgroundColor: '#ffffff' }, layers: [], metadata: { future: null } } );
	const base = { schemaVersion: 1, future: [ null, false, 0 ], surfaces: [
		{ id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 200, height: 100 }, layers: [ { id: 'slide-text', type: 'text', text: 'Sibling' } ] },
		{ ...surface( 1 ), id: 'other-file', source: { ...surface( 1 ).source, fileTitle: 'File:Other.pdf' } }
	] }, requested = surface( page ), anchor = surface( initial );
	return { target: { owner: 'Owner', pageId: 7, revisionId: 12, surfaceId: anchor.id },
		selection: { start: 8, expected: '[[File:Source.pdf|page=' + initial + '|layerset=ABC|Caption]]' },
		hasLayersSlot: slot, mainText: 'Before\n[[File:Source.pdf|layerset=ABC]]\nAfter',
		baseText: slot ? JSON.stringify( base, null, 2 ) : null, baseBundle: slot ? { revisionId: 12, snapshot: base, sourceGeometry: {} } : null,
		anchorSurface: anchor, context: { owner: 'Owner', pageId: 7, revisionId: 12, binding: 'v1:7:' + anchor.id,
			kind: 'pdf', label: 'ABC', initialPage: initial, pageCount: count, page, members: [], surface: requested, stored: false,
			sourceGeometry: { page, width: requested.canvas.width, height: requested.canvas.height, units: 'file-handler-pixels' },
			rendition: { url: '/exact/pdf-page-' + page + '.jpg', width: requested.canvas.width, height: requested.canvas.height + ( page === 2 ? 1 : 0 ) } } };
}
function setup( slot = true, initial = 2, requested = initial, count = 2 ) {
	const editor = { filename: 'Source.pdf', config: { imageUrl: '/before.jpg' }, page: 88, pageCount: 88,
		notifyPdfPageNavigationFailure: jest.fn(), refreshPageControls: jest.fn(), syncPageInUrl: jest.fn( page => {
			window.history.replaceState( {}, '', '?pdfpage=' + page );
		} ) };
	editor.stateManager = new State( editor );
	Object.defineProperty( editor, 'layers', { configurable: true, get: () => editor.stateManager.get( 'layers' ) } );
	global.ImageLoader = ImageLoader;
	editor.canvasManager = new Canvas( { editor, container: document.createElement( 'div' ), canvas: document.createElement( 'canvas' ), exactBackground: true } );
	editor.canvasManager.config.backgroundImageUrl = '/before.jpg';
	editor.canvasManager.backgroundImage = { before: true };
	editor.canvasManager.selectionManager = new Selection( editor.canvasManager );
	editor.historyManager = new History( { editor } );
	const Original = global.Image;
	global.Image = class {
		constructor() { this.width = 416; this.height = 208; }
		decode() { return Promise.resolve(); }
		set src( url ) {
			this.value = url;
			if ( url && !url.includes( 'page-1.' ) ) { this.width = 208; this.height = 416; }
			if ( url && url.includes( 'page-2.' ) ) this.height = 417;
			if ( url ) queueMicrotask( () => this.onload && this.onload() );
		}
		get src() { return this.value; }
	};
	const native = preparation( slot, initial, requested, count );
	const reader = { read: jest.fn( async request => preparation( slot, initial, request.page, count ) ) };
	const publisher = { publish: jest.fn() }, host = new Host( editor, native, { reader, publisher } );
	const edit = text => { editor.stateManager.set( 'layers', [ { id: 'text-' + editor.page, type: 'text', text,
		x: -17, gradient: { angle: 0, stops: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] }, future: null } ] );
		editor.historyManager.saveState( text ); };
	const close = () => { host.dispose(); editor.canvasManager.destroy(); global.Image = Original; window.history.replaceState( {}, '', '/' ); };
	return { editor, host, native, reader, publisher, edit, close };
}
function witness( work ) {
	const { editor } = work, canvas = editor.canvasManager;
	return { state: copy( editor.stateManager.state ), history: editor.historyManager.captureTimeline(),
		page: editor.page, pageCount: editor.pageCount, url: window.location.href, imageUrl: editor.config.imageUrl,
		backgroundUrl: canvas.config.backgroundImageUrl, background: canvas.backgroundImage,
		geometry: [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ] };
}
async function tickUntil( predicate ) { for ( let index = 0; index < 30 && !predicate(); index++ ) await Promise.resolve(); expect( predicate() ).toBe( true ); }

describe( 'Explicit new-PDF creation editor host', () => {
	it.each( [ [ false, 1, 1 ], [ false, 2, 2 ], [ true, 1, 2 ], [ true, 2, 1 ] ] )(
		'loads the requested page directly with slot=%s initial=%s requested=%s', async ( slot, initial, requested ) => {
			const work = setup( slot, initial, requested );
			try {
				const before = witness( work );
				expect( work.host.getStatus() ).toMatchObject( { loaded: false, page: requested, initialPage: initial } );
				expect( witness( work ) ).toEqual( before );
				expect( await work.host.load() ).toBe( true );
				expect( [ work.editor.page, work.editor.pageCount ] ).toEqual( [ requested, 2 ] );
				expect( work.editor.canvasManager.config.backgroundImageUrl ).toBe( '/exact/pdf-page-' + requested + '.jpg' );
				expect( work.editor.syncPageInUrl.mock.calls ).toEqual( [ [ requested ] ] );
				expect( work.host.getDraft().creation.baseText ).toBe( work.native.baseText );
				expect( work.host.getDraft().creation.baseBundle ).toEqual( work.native.baseBundle );
				expect( work.host.getStatus() ).toMatchObject( { loaded: true, phase: 'ready', dirty: true, label: 'ABC' } );
				expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( -1 );
				expect( work.publisher.publish ).not.toHaveBeenCalled();
			} finally { work.close(); }
		} );
	it( 'keeps native canvas geometry separate from the rounded JPEG rendition', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true );
			expect( [ work.editor.canvasManager.canvas.width, work.editor.canvasManager.canvas.height ] ).toEqual( [ 208, 416 ] );
			expect( work.editor.canvasManager.backgroundImage.height ).toBe( 417 );
			expect( [ work.editor.stateManager.get( 'baseWidth' ), work.editor.stateManager.get( 'baseHeight' ) ] ).toEqual( [ 208, 416 ] );
		} finally { work.close(); }
	} );
	it( 'retains both complete per-page Undo/Redo timelines through repeated page changes', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Second A' ); work.edit( 'Second B' );
			const second = work.editor.historyManager.captureTimeline();
			expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'First A' ); work.edit( 'First B' );
			expect( work.editor.historyManager.undo() ).toBe( true ); const first = work.editor.historyManager.captureTimeline();
			expect( await work.host.turn( 2 ) ).toBe( true ); expect( work.editor.historyManager.captureTimeline() ).toEqual( second );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Second A' );
			expect( await work.host.turn( 1 ) ).toBe( true ); expect( work.editor.historyManager.captureTimeline() ).toEqual( first );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'First B' );
			expect( work.host.getDraft().snapshot.surfaces.slice( 2 ).map( member => [ member.label, member.source.page, member.layers[ 0 ].text ] ) )
				.toEqual( [ [ 'ABC', 1, 'First B' ], [ 'ABC', 2, 'Second A' ] ] );
			expect( work.host.captureDraftHistory().members.map( member => member.timeline.lastSaveHistoryIndex ) ).toEqual( [ -1, -1 ] );
		} finally { work.close(); }
	} );
	it( 'does not materialize visited empty pages and remains dirty after Undo to empty before first Save', async () => {
		const work = setup( false ); try {
			expect( await work.host.load() ).toBe( true ); expect( await work.host.turn( 1 ) ).toBe( true );
			work.edit( 'Optional' ); expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.host.getDraft().snapshot.surfaces.map( member => member.source.page ) ).toEqual( [ 2 ] );
			expect( work.host.getStatus().dirty ).toBe( true ); expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( work.host.captureDraftHistory().members ).toHaveLength( 2 );
			expect( await work.host.turn( 2 ) ).toBe( true ); expect( await work.host.turn( 1 ) ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.host.getDraft().snapshot.surfaces ).toHaveLength( 2 );
		} finally { work.close(); }
	} );
	it( 'preserves unvisited anchor history and isolates every draft/history output', async () => {
		const work = setup( true, 2, 1 ); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'First only' );
			const history = work.host.captureDraftHistory(); expect( history.members.map( member => member.page ) ).toEqual( [ 1, 2 ] );
			expect( history.members[ 1 ].surfaceId ).toBe( work.native.anchorSurface.id );
			history.members[ 0 ].timeline.history[ 1 ].layers[ 0 ].text = 'Mutated output';
			expect( work.host.captureDraftHistory().members[ 0 ].timeline.history[ 1 ].layers[ 0 ].text ).toBe( 'First only' );
			const draft = work.host.getDraft(); draft.creation.mainText = 'Replaced'; draft.snapshot.surfaces[ 0 ].layers = [];
			expect( work.host.getDraft().creation.mainText ).toBe( work.native.mainText );
			expect( work.host.getDraft().snapshot.surfaces[ 0 ].layers ).toHaveLength( 1 );
		} finally { work.close(); }
	} );
	it.each( [ 'read', 'decode' ] )( 'preserves newer edits during pending %s before any page commit', async boundary => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep' );
			if ( boundary === 'read' ) work.reader.read.mockReturnValueOnce( deferred.promise );
			else global.Image.prototype.decode = () => deferred.promise;
			const pending = work.host.turn( 1 );
			if ( boundary === 'decode' ) await tickUntil( () => work.editor.canvasManager.exactStages.size > 0 );
			work.edit( 'Newer during ' + boundary ); const before = witness( work ), draft = work.host.getDraft();
			deferred.resolve( boundary === 'read' ? preparation( true, 2, 1 ) : undefined );
			expect( await pending ).toBe( false ); expect( witness( work ) ).toEqual( before ); expect( work.host.getDraft() ).toEqual( draft );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
		} finally { work.close(); }
	} );
	it.each( [ 'owner', 'source', 'page', 'geometry', 'selector', 'base', 'denied' ] )( 'refuses native %s changes without mutating the editor', async reason => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep second' );
			const native = preparation( true, 2, 1 ), before = witness( work ), draft = work.host.getDraft();
			if ( reason === 'owner' ) native.context.owner = 'Other';
			if ( reason === 'source' ) native.context.surface.source.sha1 = 'b'.repeat( 31 );
			if ( reason === 'page' ) native.context.page = 2;
			if ( reason === 'geometry' ) native.context.sourceGeometry.height++;
			if ( reason === 'selector' ) native.selection.expected += '|off';
			if ( reason === 'base' ) native.baseText += ' ';
			if ( reason === 'denied' ) work.reader.read.mockRejectedValueOnce( new Error( 'Private diagnostic' ) );
			else work.reader.read.mockResolvedValueOnce( native );
			expect( await work.host.turn( 1 ) ).toBe( false ); expect( witness( work ) ).toEqual( before ); expect( work.host.getDraft() ).toEqual( draft );
			expect( work.editor.notifyPdfPageNavigationFailure ).toHaveBeenCalledWith( 1 ); expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'read', 'decode' ] )( 'cancels %s after disposal and preserves all editor work', async boundary => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep' );
			if ( boundary === 'read' ) work.reader.read.mockReturnValueOnce( deferred.promise ); else global.Image.prototype.decode = () => deferred.promise;
			const pending = work.host.turn( 1 );
			if ( boundary === 'decode' ) await tickUntil( () => work.editor.canvasManager.exactStages.size > 0 );
			work.host.dispose(); const before = witness( work );
			deferred.resolve( boundary === 'read' ? preparation( true, 2, 1 ) : undefined );
			expect( await pending ).toBe( false ); expect( witness( work ) ).toEqual( before );
			expect( work.editor.notifyPdfPageNavigationFailure ).not.toHaveBeenCalled();
			expect( () => work.host.getDraft() ).toThrow();
		} finally { work.close(); }
	} );
	it.each( [ 'decode rejection', 'wrong dimensions', 'stage refusal' ] )( 'refuses %s with complete current work intact', async reason => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep' ); const before = witness( work );
			if ( reason === 'decode rejection' ) global.Image.prototype.decode = () => Promise.reject( new Error( 'Failed decoding' ) );
			if ( reason === 'wrong dimensions' ) Object.defineProperty( global.Image.prototype, 'width', { get: () => 999, set() {}, configurable: true } );
			if ( reason === 'stage refusal' ) work.editor.canvasManager.exactStages = new Set();
			if ( reason === 'stage refusal' ) {
				const original = work.editor.canvasManager.preflightStagedBackground;
				work.editor.canvasManager.preflightStagedBackground = () => { throw new Error( 'Refuse' ); };
				expect( await work.host.turn( 1 ) ).toBe( false ); work.editor.canvasManager.preflightStagedBackground = original;
			} else expect( await work.host.turn( 1 ) ).toBe( false );
			expect( witness( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
	it( 'cancels an older pending read when a newer page request completes', async () => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.reader.read.mockReturnValueOnce( deferred.promise );
			const older = work.host.turn( 1 ); expect( await work.host.turn( 2 ) ).toBe( true ); const before = witness( work );
			deferred.resolve( preparation( true, 2, 1 ) ); expect( await older ).toBe( false ); expect( witness( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
	it( 'clears the actual selection only after the destination is ready', async () => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Selected' );
			work.editor.canvasManager.selectionManager.selectLayer( 'text-2' );
			expect( work.editor.stateManager.get( 'selectedLayerIds' ) ).toEqual( [ 'text-2' ] );
			work.reader.read.mockReturnValueOnce( deferred.promise ); const pending = work.host.turn( 1 );
			expect( work.editor.canvasManager.selectionManager.selectedLayerIds ).toEqual( [ 'text-2' ] );
			deferred.resolve( preparation( true, 2, 1 ) ); expect( await pending ).toBe( true );
			expect( work.editor.canvasManager.selectionManager.selectedLayerIds ).toEqual( [] );
			expect( work.editor.stateManager.get( 'selectedLayerIds' ) ).toEqual( [] );
		} finally { work.close(); }
	} );
	it.each( [ 'read', 'decode' ].flatMap( boundary => [ 'in-place layer', 'history', 'saved marker', 'URL', 'background',
		'canvas width', 'opacity', 'visibility', 'selection', 'selection core', 'round-trip edit', 'batch', 'locked',
		'pending work', 'destroyed store', 'destroyed history', 'replaced method', 'state participant', 'history participant', 'canvas participant' ]
		.map( reason => [ boundary, reason ] ) ) )( 'refuses pending %s after %s changes', async ( boundary, reason ) => {
		const work = setup(), deferred = wait(); const { editor } = work;
		const store = editor.stateManager, history = editor.historyManager, canvas = editor.canvasManager;
		const originalMethod = canvas.preflightStagedBackground;
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep this' );
			if ( boundary === 'read' ) work.reader.read.mockReturnValueOnce( deferred.promise ); else global.Image.prototype.decode = () => deferred.promise;
			const pending = work.host.turn( 1 );
			if ( boundary === 'decode' ) await tickUntil( () => canvas.exactStages.size > 0 );
			if ( reason === 'in-place layer' ) store.get( 'layers' )[ 0 ].text = 'Edited in place';
			if ( reason === 'history' ) history.history[ 1 ].description = 'New description';
			if ( reason === 'saved marker' ) history.lastSaveHistoryIndex = 0;
			if ( reason === 'URL' ) window.history.replaceState( {}, '', '?external=1' );
			if ( reason === 'background' ) canvas.backgroundImage = { replaced: true };
			if ( reason === 'canvas width' ) canvas.canvas.width++;
			if ( reason === 'opacity' ) store.set( 'backgroundOpacity', 0.5 );
			if ( reason === 'visibility' ) store.set( 'backgroundVisible', false );
			if ( reason === 'selection' ) canvas.selectionManager.selectLayer( 'text-2' );
			if ( reason === 'selection core' ) canvas.selectionManager._selectionState.selectedLayerIds.push( 'text-2' );
			if ( reason === 'round-trip edit' ) { const layers = store.get( 'layers' ); store.set( 'layers', [] ); store.set( 'layers', layers ); }
			if ( reason === 'batch' ) history.batchMode = true;
			if ( reason === 'locked' ) store.isLocked = true;
			if ( reason === 'pending work' ) store.pendingOperations.push( { key: 'layers', value: [] } );
			if ( reason === 'destroyed store' ) store.destroy();
			if ( reason === 'destroyed history' ) history.destroy();
			if ( reason === 'replaced method' ) canvas.preflightStagedBackground = jest.fn();
			if ( reason === 'state participant' ) editor.stateManager = new State( editor );
			if ( reason === 'history participant' ) editor.historyManager = new History( { editor } );
			if ( reason === 'canvas participant' ) editor.canvasManager = { replaced: true };
			const before = { state: copy( store.state ), history: copy( history.history ), historyIndex: history.historyIndex,
				lastSaveHistoryIndex: history.lastSaveHistoryIndex, page: editor.page, pageCount: editor.pageCount,
				url: window.location.href, imageUrl: editor.config.imageUrl, background: canvas.backgroundImage,
				backgroundUrl: canvas.config.backgroundImageUrl, dimensions: [ canvas.canvas.width, canvas.canvas.height ],
				selected: copy( canvas.selectionManager._selectionState.selectedLayerIds ) };
			deferred.resolve( boundary === 'read' ? preparation( true, 2, 1 ) : undefined );
			expect( await pending ).toBe( false );
			expect( { state: copy( store.state ), history: copy( history.history ), historyIndex: history.historyIndex,
				lastSaveHistoryIndex: history.lastSaveHistoryIndex, page: editor.page, pageCount: editor.pageCount,
				url: window.location.href, imageUrl: editor.config.imageUrl, background: canvas.backgroundImage,
				backgroundUrl: canvas.config.backgroundImageUrl, dimensions: [ canvas.canvas.width, canvas.canvas.height ],
				selected: copy( canvas.selectionManager._selectionState.selectedLayerIds ) } ).toEqual( before );
			expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { editor.stateManager = store; editor.historyManager = history; editor.canvasManager = canvas; canvas.preflightStagedBackground = originalMethod; work.close(); }
	} );
	it( 'retains stable empty anchor history when the requested page differs', async () => {
		const work = setup( false, 2, 1 ); try {
			expect( await work.host.load() ).toBe( true ); const first = work.host.captureDraftHistory();
			expect( work.host.captureDraftHistory() ).toEqual( first );
		} finally { work.close(); }
	} );
	it( 'reads and decodes only the requested page of a 99-page source', async () => {
		const work = setup( false, 2, 2, 99 ); try {
			expect( await work.host.load() ).toBe( true ); expect( await work.host.turn( 99 ) ).toBe( true );
			expect( work.reader.read.mock.calls.map( call => call[ 0 ].page ) ).toEqual( [ 2, 99 ] );
			expect( work.host.getDraft().snapshot.surfaces ).toHaveLength( 1 );
		} finally { work.close(); }
	} );
	it( 'refuses to replace work entered before initial loading starts', async () => {
		const work = setup(); try {
			work.editor.stateManager.set( 'layers', [ { id: 'new-work', type: 'text', text: 'Before load' } ] );
			const before = witness( work ); expect( await work.host.load() ).toBe( false ); expect( witness( work ) ).toEqual( before );
			expect( work.reader.read ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'does not admit another creation host over an editor containing current work', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Do not replace' ); const before = witness( work );
			expect( () => new Host( work.editor, work.native, { reader: work.reader, publisher: work.publisher } ) ).toThrow();
			expect( witness( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
	it( 'refuses a stalled decode at the existing deadline without losing current work', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep after timeout' ); const before = witness( work );
			jest.useFakeTimers(); global.Image.prototype.decode = () => new Promise( () => {} );
			const pending = work.host.turn( 1 ); await tickUntil( () => work.editor.canvasManager.exactStages.size > 0 );
			jest.advanceTimersByTime( 60001 ); expect( await pending ).toBe( false ); expect( witness( work ) ).toEqual( before );
		} finally { jest.useRealTimers(); work.close(); }
	} );
	it( 'captures edits made by state listeners after the synchronous page commit', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Second retained' );
			let changed = false;
			const unsubscribe = work.editor.stateManager.subscribe( 'layers', () => {
				if ( work.editor.page === 1 && !changed ) { changed = true; work.edit( 'Listener edit' ); }
			} );
			expect( await work.host.turn( 1 ) ).toBe( true ); unsubscribe();
			expect( work.host.getDraft().snapshot.surfaces.slice( 2 ).map( member => member.layers[ 0 ].text ) ).toEqual( [ 'Listener edit', 'Second retained' ] );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' ) ).toEqual( [] );
		} finally { work.close(); }
	} );
	it( 'preserves committed work and reports a refresh failure rather than returning false readiness', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Second retained' );
			work.editor.canvasManager.renderer = { setBackgroundImage() { throw new Error( 'Renderer failed' ); } };
			expect( await work.host.turn( 1 ) ).toBe( false );
			expect( work.host.getStatus() ).toMatchObject( { page: 1, dirty: true, needsRefresh: true } );
			expect( work.host.getDraft().snapshot.surfaces.find( surface => surface.source && surface.source.page === 2 ).layers[ 0 ].text ).toBe( 'Second retained' );
			const before = witness( work ); expect( await work.host.turn( 2 ) ).toBe( false ); expect( witness( work ) ).toEqual( before );
			work.editor.canvasManager.renderer = null;
		} finally { work.close(); }
	} );
	it( 'loads in MediaWiki script mode without a relative CommonJS import', () => {
		const forbidden = jest.fn( () => { throw new Error( 'Relative imports unavailable' ); } );
		const sandbox = vm.createContext( { window: {}, module: { exports: {} }, require: forbidden } );
		for ( const file of [ 'PageOwnedSnapshotAdapter', 'PageOwnedPdfWorkingSet', 'PageOwnedPdfCreationTransaction', 'StateManager', 'HistoryManager', 'PageOwnedPdfCreationHost' ] ) {
			vm.runInContext( fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor', file + '.js' ), 'utf8' ), sandbox );
		}
		vm.runInContext( 'const native = JSON.parse(' + JSON.stringify( JSON.stringify( preparation( false, 2, 1 ) ) ) + ');', sandbox );
		const page = vm.runInContext( `const editor = { config: {}, syncPageInUrl() {}, refreshPageControls() {}, notifyPdfPageNavigationFailure() {} };
			editor.stateManager = new window.Layers.Core.StateManager(editor);
			editor.historyManager = new window.Layers.Core.HistoryManager({editor});
			editor.canvasManager = { config: {}, canvas: {width:300,height:150}, stageExactBackground() {}, preflightStagedBackground() {}, commitStagedBackground() {} };
			const host = new window.Layers.Editor.PageOwnedPdfCreationHost(editor,native,{reader:{read(){}},publisher:{publish(){}}});
			host.getStatus().page;`, sandbox );
		expect( page ).toBe( 1 ); expect( forbidden ).not.toHaveBeenCalled();
	} );
} );
