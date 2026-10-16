'use strict';
const Host = require( '../../../resources/ext.layers.editor/PageOwnedPdfCreationHost.js' );
const Ids = require( '../../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const State = require( '../../../resources/ext.layers.editor/StateManager.js' );
const History = require( '../../../resources/ext.layers.editor/HistoryManager.js' );
const Canvas = require( '../../../resources/ext.layers.editor/CanvasManager.js' );
const ImageLoader = require( '../../../resources/ext.layers.editor/ImageLoader.js' );
global.GeometryUtils = require( '../../../resources/ext.layers.editor/GeometryUtils.js' );
require( '../../../resources/ext.layers.editor/selection/SelectionState.js' );
const Selection = require( '../../../resources/ext.layers.editor/SelectionManager.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
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

module.exports = { setup, preparation, witness, wait, tickUntil, copy };
