/** Owner-directed image/slide PNG choices and retained whole-PDF exports. */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const png = fs.readFileSync( path.join( __dirname, '../fixtures/assets/test-image.png' ) );
const entry = {
	src: 'data:image/png;base64,' + png.toString( 'base64' ),
	width: png.readUInt32BE( 16 ), height: png.readUInt32BE( 20 )
};
let lightbox, NativeImage;

beforeEach( () => {
	jest.resetModules();
	window.mw = { message: () => ( { exists: () => false } ), notify: jest.fn() };
	const Lightbox = require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
	lightbox = new Lightbox();
	lightbox.filename = 'Example.png';
	lightbox.isPdf = false;
	lightbox.pageCount = 1;
	lightbox.createOverlay();
	lightbox.isOpen = true;
	lightbox._sessionToken = 1;
	lightbox.updateToolbar();
	NativeImage = global.Image;
	global.Image = class {
		constructor() {
			this.naturalWidth = entry.width;
			this.naturalHeight = entry.height;
		}
		decode() {
			return Promise.resolve();
		}
	};
} );

afterEach( () => {
	lightbox.close( true );
	global.Image = NativeImage;
	jest.restoreAllMocks();
	document.body.innerHTML = '';
} );

function readBlob( blob ) {
	return new Promise( ( resolve, reject ) => {
		const reader = new FileReader();
		reader.onload = () => resolve( Buffer.from( reader.result ) );
		reader.onerror = reject;
		reader.readAsArrayBuffer( blob );
	} );
}

function pageOwned( kind = 'image' ) {
	const viewer = { kind, pages: [ { page: 1, surface: { id: 'one', kind } } ],
		source: kind === 'slide' ? null : { url: '/saved-image.png' }, pageCount: 1 };
	lightbox.pageOwned = { read: jest.fn().mockResolvedValue( viewer ), dispose: jest.fn(),
		loadPage: jest.fn().mockResolvedValue( { imageUrl: '/saved-image.png', layerData: { layers: [] } } ) };
	lightbox._pageOwnedViewerData = viewer;
	jest.spyOn( lightbox, 'flattenPage' ).mockResolvedValue( entry );
	jest.spyOn( lightbox, 'saveBlob' ).mockImplementation( () => {} );
	return viewer;
}

it.each( [ 'Example.png', 'Slide name' ] )( 'offers PNG first and preserves PDF for %s', ( filename ) => {
	lightbox.filename = filename;
	const buttons = [ ...lightbox.toolbar.querySelectorAll( 'button' ) ].filter( b => b.textContent.startsWith( 'Download' ) );
	expect( buttons.map( b => b.textContent ) ).toEqual( [ 'Download PNG', 'Download PDF' ] );
	const pngDownload = jest.spyOn( lightbox, 'downloadPng' ).mockResolvedValue();
	const pdfDownload = jest.spyOn( lightbox, 'downloadPdf' ).mockResolvedValue();
	buttons[ 0 ].click();
	expect( pngDownload ).toHaveBeenCalledTimes( 1 );
	expect( pdfDownload ).not.toHaveBeenCalled();
	buttons[ 1 ].click();
	expect( pdfDownload ).toHaveBeenCalledTimes( 1 );
} );

it.each( [ 1, 99 ] )( 'offers only PDF for a %s-page PDF and resets correctly on reuse', ( count ) => {
	lightbox.isPdf = true;
	lightbox.pageCount = count;
	lightbox.updateToolbar();
	expect( lightbox.downloadPngBtn.hidden ).toBe( true );
	expect( lightbox.downloadBtn.textContent ).toBe( 'Download PDF' );
	lightbox.isPdf = false;
	lightbox.pageCount = 1;
	lightbox.updateToolbar();
	expect( lightbox.downloadPngBtn.hidden ).toBe( false );
} );

it.each( [ 'image', 'slide' ] )( 'reauthorizes the complete %s and saves unchanged PNG bytes', async ( kind ) => {
	const viewer = pageOwned( kind );
	lightbox.downloadPngBtn.focus();
	await lightbox.downloadPng();
	expect( lightbox.pageOwned.read ).toHaveBeenCalledTimes( 1 );
	expect( lightbox.pageOwned.loadPage ).toHaveBeenCalledWith( viewer, 1 );
	expect( lightbox.flattenPage ).toHaveBeenCalledWith( '/saved-image.png', { layers: [] }, 'image/png', undefined );
	const [ blob, name ] = lightbox.saveBlob.mock.calls[ 0 ];
	expect( blob.type ).toBe( 'image/png' );
	expect( name ).toBe( 'Example.png' );
	expect( await readBlob( blob ) ).toEqual( png );
	expect( document.activeElement ).toBe( lightbox.downloadPngBtn );
	expect( lightbox.downloadBtn.disabled ).toBe( false );
	expect( lightbox.downloadPngBtn.disabled ).toBe( false );
} );

it.each( [ false, true ] )( 'exports legacy/empty single-page content as PNG (empty=%s)', async ( empty ) => {
	lightbox.explicitEmpty = empty;
	jest.spyOn( lightbox, 'composePage' ).mockResolvedValue( entry );
	jest.spyOn( lightbox, 'saveBlob' ).mockImplementation( () => {} );
	await lightbox.downloadPng();
	expect( lightbox.composePage ).toHaveBeenCalledWith( 1, 'image/png' );
	const [ blob, name ] = lightbox.saveBlob.mock.calls[ 0 ];
	expect( await readBlob( blob ) ).toEqual( png );
	expect( name ).toBe( 'Example.png' );
} );

it( 'keeps direct PNG requests for a PDF on the whole-PDF download path', async () => {
	lightbox.isPdf = true;
	const pdfDownload = jest.spyOn( lightbox, 'downloadPdf' ).mockResolvedValue();
	await lightbox.downloadPng();
	expect( pdfDownload ).toHaveBeenCalledTimes( 1 );
} );

it.each( [ 'authorization', 'changed-source', 'bad-png', 'decoding', 'wrong-dimensions' ] )( 'refuses %s without another format or server fallback', async ( failure ) => {
	const viewer = pageOwned();
	if ( failure === 'authorization' ) {
		lightbox.pageOwned.read.mockRejectedValue( new Error( 'denied' ) );
	} else if ( failure === 'changed-source' ) {
		lightbox.pageOwned.read.mockResolvedValue( { ...viewer, source: { url: '/new-image.png' } } );
	} else if ( failure === 'bad-png' ) {
		lightbox.flattenPage.mockResolvedValue( { ...entry, src: 'data:image/png;base64,cGRm' } );
	} else if ( failure === 'decoding' ) {
		global.Image.prototype.decode = () => Promise.reject( new Error( 'decode failed' ) );
	} else {
		lightbox.flattenPage.mockResolvedValue( { ...entry, width: entry.width + 1 } );
	}
	const server = jest.spyOn( lightbox, 'downloadViaServer' );
	const pdf = jest.spyOn( lightbox, 'buildPdfBlob' );
	await lightbox.downloadPng();
	expect( lightbox.saveBlob ).not.toHaveBeenCalled();
	expect( server ).not.toHaveBeenCalled();
	expect( pdf ).not.toHaveBeenCalled();
	expect( mw.notify ).toHaveBeenCalled();
	expect( lightbox.downloadPngBtn.disabled ).toBe( false );
} );

it( 'bounds a stalled PNG decode and restores the controls', async () => {
	jest.useFakeTimers();
	try {
		pageOwned();
		global.Image.prototype.decode = () => new Promise( () => {} );
		const exporting = lightbox.downloadPng();
		await jest.advanceTimersByTimeAsync( 5001 );
		await exporting;
		expect( lightbox.saveBlob ).not.toHaveBeenCalled();
		expect( mw.notify ).toHaveBeenCalled();
		expect( lightbox.downloadPngBtn.disabled ).toBe( false );
	} finally {
		jest.useRealTimers();
	}
} );

it( 'shares one pending PNG operation and does not begin a second export', async () => {
	pageOwned();
	const first = lightbox.downloadPng();
	const second = lightbox.downloadPng();
	expect( first ).toBe( second );
	await first;
	expect( lightbox.pageOwned.loadPage ).toHaveBeenCalledTimes( 1 );
	expect( lightbox.saveBlob ).toHaveBeenCalledTimes( 1 );
} );

it( 'keeps the PNG filename safe and separate from the PDF filename', () => {
	lightbox.filename = 'My:Doc/2.jpg';
	expect( lightbox.exportFileName( 'png' ) ).toBe( 'My_Doc_2.png' );
	expect( lightbox.exportFileName() ).toBe( 'My_Doc_2.pdf' );
} );

it( 'discards a pending PNG after Close and does not report a false export error', async () => {
	pageOwned();
	let complete;
	lightbox.pageOwned.loadPage.mockReturnValue( new Promise( resolve => { complete = resolve; } ) );
	const exporting = lightbox.downloadPng();
	for ( let n = 0; n < 5; n++ ) {
		await Promise.resolve();
	}
	lightbox.close( true );
	complete( { imageUrl: '/saved-image.png', layerData: { layers: [] } } );
	await exporting;
	expect( lightbox.saveBlob ).not.toHaveBeenCalled();
	expect( mw.notify ).not.toHaveBeenCalled();
} );
