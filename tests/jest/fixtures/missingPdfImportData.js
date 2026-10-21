'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const Client = require( '../../../resources/ext.layers.editor/PageOwnedMissingPdfImportReadClient.js' );
const Ids = require( '../../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

const nfd = 'e\u0301';
const nfc = '\u00e9';
const literal = `NFD ${nfd}; NFC ${nfc}; π / 日本 / 😀`;
const targetPin = { repository: 'local', fileTitle: 'File:Target.pdf', timestamp: '20261015120000', sha1: 'a'.repeat( 31 ) };
const sourcePin = { repository: 'local', fileTitle: 'File:Target.pdf', timestamp: '20261016120000', sha1: 'b'.repeat( 31 ) };

function asciiJson( value ) {
	return JSON.stringify( value ).split( '' ).map( character => character.charCodeAt( 0 ) > 127 ?
		'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) : character ).join( '' );
}

function pdfSurface( pin, page, label = 'A_BC', canvas = { width: page === 1 ? 416 : 208, height: page === 1 ? 208 : 416 } ) {
	return { id: Ids.surfaceId( 7, 12, pin.fileTitle, label, page ), kind: 'pdf', label,
		source: { ...pin, page }, canvas: { ...canvas }, layers: [] };
}

function baseSnapshot() {
	return { schemaVersion: 1, metadata: { literal, absent: null, nested: { values: [ nfd, nfc ] } }, surfaces: [
		{ id: 'image-sibling', kind: 'image', label: 'Side image', source: { repository: 'local', fileTitle: 'File:Sibling.png',
			timestamp: '20261010120000', sha1: 'd'.repeat( 31 ) },
			canvas: { width: 400, height: 200, backgroundColor: null }, layers: [ { id: 'sib', type: 'text', text: literal, unknown: null } ] },
		{ id: 'pdf-sibling', kind: 'pdf', label: 'Another set',
			source: { repository: 'local', fileTitle: 'File:Other.pdf', timestamp: '20261010120000', sha1: 'c'.repeat( 31 ), page: 1 },
			canvas: { width: 240, height: 320, backgroundColor: null }, layers: [ { id: 'other-pdf-text', type: 'text', text: nfc } ] },
		{ id: 'slide-sibling', kind: 'slide', label: 'Side slide', canvas: { width: 300, height: 180, backgroundColor: null },
			layers: [ { id: 'slide-text', type: 'text', text: nfd } ] }
	] };
}

function baseBundle( snapshot ) {
	return { revisionId: 12, snapshot,
		sourceGeometry: { 'pdf-sibling': { page: 1, width: 240, height: 320, units: 'file-handler-pixels' } },
		sourceRenditions: { 'pdf-sibling': { url: 'https://example.test/sibling.jpg', width: 240, height: 320 } } };
}

function targetAdmission( hasSlot = true ) {
	const prefix = `Préface ${nfd} π\n`, expected = `[[File:Target.pdf|page=2|layerset=A_BC|Caption ${nfd}]]`;
	const anchor = pdfSurface( targetPin, 2 );
	const base = baseSnapshot();
	const baseText = hasSlot ? JSON.stringify( base, null, 2 ) : null;
	return {
		target: { pageId: 7, owner: 'Owner', revisionId: 12, surfaceId: anchor.id },
		selection: { start: Buffer.byteLength( prefix, 'utf8' ), expected },
		hasLayersSlot: hasSlot, mainText: prefix + expected,
		baseText, baseBundle: hasSlot ? baseBundle( base ) : null,
		label: 'A_BC', initialPage: 2, pageCount: 2, source: { ...targetPin },
		pages: [ 1, 2 ].map( memberPage => ( { page: memberPage, surface: pdfSurface( targetPin, memberPage ),
			sourceGeometry: { page: memberPage, width: memberPage === 1 ? 416 : 208,
				height: memberPage === 1 ? 208 : 416, units: 'file-handler-pixels' },
			rendition: { url: `https://example.test/target-${ memberPage }.jpg`, width: memberPage === 1 ? 416 : 208,
				height: ( memberPage === 1 ? 208 : 416 ) + ( memberPage === 2 ? 1 : 0 ) } } ) )
	};
}

function sourcePreparation( sparse = false ) {
	const surfaces = ( sparse ? [ 2 ] : [ 1, 2 ] ).map( page => ( {
		...pdfSurface( sourcePin, page, 'a bc', { width: page === 1 ? 640 : 320, height: page === 1 ? 320 : 640 } ),
		layers: page === 1 ? [ { id: 'text-source-1', type: 'text', text: literal, future: null } ] :
			[ { id: 'text-source-2', type: 'text', text: nfd } ]
	} ) );
	const snapshot = { schemaVersion: 1, metadata: { unknown: null, text: literal }, surfaces };
	const geometry = Object.fromEntries( surfaces.map( surface => [ surface.id, {
		page: surface.source.page, width: surface.canvas.width, height: surface.canvas.height, units: 'file-handler-pixels'
	} ] ) );
	const renditions = Object.fromEntries( surfaces.map( surface => [ surface.id, {
		url: `https://example.test/source-${ surface.source.page }.jpg`, width: surface.canvas.width, height: surface.canvas.height
	} ] ) );
	const anchor = surfaces[ 0 ];
	return {
		source: { pageId: 8, owner: 'Source', revisionId: 21, surfaceId: anchor.id },
		sourceBundle: { revisionId: 21, snapshot, sourceGeometry: geometry, sourceRenditions: renditions },
		sourceGroup: { label: 'a bc', source: { ...sourcePin }, pageCount: 2,
			members: surfaces.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) }
	};
}

function preparation( slot = true, sparse = false ) {
	return { targetAdmission: targetAdmission( slot ), ...sourcePreparation( sparse ) };
}

function options( value ) {
	return { target: copy( value.targetAdmission.target ), selection: copy( value.targetAdmission.selection ),
		source: copy( value.source ) };
}

function setup( slot = true, sparse = false ) {
	const value = preparation( slot, sparse );
	const api = { post: jest.fn().mockResolvedValue( { layersmissingpdfimportread: {
		version: 1, data: asciiJson( value )
	} } ) };
	return { value, api, request: options( value ), client: new Client( api ) };
}

module.exports = { copy, asciiJson, setup, targetAdmission, preparation, options, targetPin, sourcePin, sourcePreparation, nfd, nfc, literal, pdfSurface, baseSnapshot, baseBundle };
