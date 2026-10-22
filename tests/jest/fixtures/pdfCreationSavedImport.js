'use strict';

global.TextEncoder = global.TextEncoder || require( 'util' ).TextEncoder;
const creationFixture = require( './pdfCreationHostImport.js' );
const Ids = require( '../../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const WholePdfImportSource = require( '../../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const PdfReadClient = require( '../../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const WholePdfImportPublishClient = require( '../../../resources/ext.layers.editor/PageOwnedWholePdfImportPublishClient.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

function asciiJson( value ) {
	return Array.from( JSON.stringify( value ), character => {
		const point = character.codePointAt( 0 );
		if ( point <= 127 ) { return character; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) +
			'\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
}

function pdfContext( work, snapshot, page, revisionId ) {
	const native = work.native, anchor = native.anchorSurface;
	const group = snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === anchor.label &&
		surface.source && surface.source.fileTitle === anchor.source.fileTitle );
	const storedSurface = group.find( surface => surface.source.page === page );
	const pageData = nativeImportPages( work, page );
	const surface = storedSurface ? copy( storedSurface ) : {
		...copy( pageData.surface ), id: Ids.surfaceId( native.target.pageId, revisionId,
			anchor.source.fileTitle, anchor.label, page ), layers: []
	};
	return { owner: native.target.owner, pageId: native.target.pageId, revisionId,
		binding: 'v1:' + native.target.pageId + ':' + native.target.surfaceId,
		kind: 'pdf', label: anchor.label, initialPage: native.context.initialPage,
		pageCount: native.context.pageCount, page,
		members: group.map( member => ( { page: member.source.page, surfaceId: member.id } ) ),
		stored: !!storedSurface, surface,
		sourceGeometry: storedSurface ? { page, width: surface.canvas.width, height: surface.canvas.height,
			units: 'file-handler-pixels' } : copy( pageData.sourceGeometry ),
		rendition: { url: 'https://example.test/saved-page-' + page + '.jpg',
			width: surface.canvas.width, height: surface.canvas.height + ( page === 2 ? 1 : 0 ) } };
}

function nativeImportPages( work, page ) {
	return work.nativeImport.value.targetAdmission.pages.find( value => value.page === page );
}

function savedImportData( work, snapshot, revisionId ) {
	const data = copy( work.nativeImport.value ), anchor = work.native.anchorSurface;
	delete data.targetAdmission;
	const members = snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === anchor.label &&
		surface.source && surface.source.fileTitle === anchor.source.fileTitle );
	const memberPages = new Set( members.map( surface => surface.source.page ) );
	const pageContexts = Array.from( { length: work.native.context.pageCount }, ( _, index ) =>
		pdfContext( work, snapshot, index + 1, revisionId ) );
	const sourceGeometry = {}, sourceRenditions = {}, admittedTargetGeometry = {}, admittedTargetRenditions = {};
	for ( const member of members ) {
		const context = pageContexts.find( value => value.page === member.source.page );
		sourceGeometry[ member.id ] = copy( context.sourceGeometry );
		sourceRenditions[ member.id ] = copy( context.rendition );
	}
	const admittedTargetSurfaces = pageContexts.filter( context => !memberPages.has( context.page ) ).map( context => {
		admittedTargetGeometry[ context.surface.id ] = copy( context.sourceGeometry );
		admittedTargetRenditions[ context.surface.id ] = copy( context.rendition );
		return copy( context.surface );
	} );
	data.target = { pageId: work.native.target.pageId, owner: work.native.target.owner,
		revisionId, surfaceId: work.native.target.surfaceId };
	data.targetBundle = { revisionId, snapshot: copy( snapshot ), sourceGeometry, sourceRenditions };
	data.targetGroup = { label: anchor.label,
		source: Object.fromEntries( Object.entries( anchor.source ).filter( ( [ key ] ) => key !== 'page' ) ),
		pageCount: work.native.context.pageCount,
		members: members.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) };
	data.admittedTargetSurfaces = admittedTargetSurfaces;
	data.admittedTargetGeometry = admittedTargetGeometry;
	data.admittedTargetRenditions = admittedTargetRenditions;
	return data;
}

/**
 * Build a real creation Import history and the native transports used after its
 * confirmed first Save. `undo` saves the before side of the whole-group command.
 */
async function build( options = {} ) {
	const work = creationFixture.setup();
	try {
		if ( await work.host.load() !== true ) { throw new Error( 'layers-creation-unavailable' ); }
		const importApi = { post: work.nativeImport.api.post,
			postWithToken: work.publicationApi.postWithToken };
		work.host.enableImports( importApi );
		work.host.enableImportHistory();
		let nextId = 0;
		const prepared = await work.host.prepareImport( copy( work.nativeImport.source ), {
			mode: 'empty', maxLayers: 100, allocateId: () => 'saved-import-' + ++nextId
		} );
		if ( !prepared || !work.host.commitImport( prepared.handle ) ) {
			throw new Error( 'layers-creation-import-unavailable' );
		}
		if ( options.undo && await work.editor.historyManager.undo() !== true ) {
			throw new Error( 'layers-creation-import-unavailable' );
		}

		const savedState = { value: null, data: null, readApi: null, sourceApi: null, pdfApi: null,
			importPublisher: null, dependencies: null };
		const save = async ( saveOptions = {} ) => {
			if ( savedState.value ) { throw new Error( 'layers-creation-import-already-saved' ); }
			if ( saveOptions.undo && !options.undo && await work.editor.historyManager.undo() !== true ) {
				throw new Error( 'layers-creation-import-unavailable' );
			}
			work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
			const result = await work.host.save( 'Import source', () => {} );
			const snapshot = copy( result.snapshot );
			savedState.value = result;
			savedState.data = savedImportData( work, snapshot, result.revisionId );
			if ( saveOptions.newer ) {
				const layers = copy( work.editor.stateManager.get( 'layers' ) );
				if ( layers.length ) { layers[ 0 ].text = 'Newer imported work'; }
				else { layers.push( { id: 'newer-saved-edit', type: 'text', text: 'Newer imported work', x: 1 } ); }
				work.editor.stateManager.set( 'layers', layers );
				work.editor.historyManager.saveState( 'Newer work' );
			}
			const data = savedState.data;
			const sourceApi = { post: jest.fn().mockImplementation( () => ( {
				layersworkingcopypdfimportread: { version: 1, data: asciiJson( data ) }
			} ) ) };
			const pdfApi = { get: jest.fn().mockImplementation( request => ( {
				layersread: { editor: pdfContext( work, snapshot, request.editorpage, result.revisionId ) }
			} ) ) };
			const readApi = { api: pdfApi, read: jest.fn().mockResolvedValue( { revisionId: result.revisionId,
				snapshot: copy( snapshot ) } ) };
			const importPublishApi = { postWithToken: jest.fn().mockResolvedValue( {
				layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 14 }
			} ) };
			const dependencies = {
				reader: readApi, pdfReader: new PdfReadClient( pdfApi ),
				publisher: work.publisher, importSource: new WholePdfImportSource( sourceApi ),
				importPublisher: new WholePdfImportPublishClient( importPublishApi )
			};
			savedState.sourceApi = sourceApi;
			savedState.pdfApi = pdfApi;
			savedState.readApi = readApi;
			savedState.dependencies = dependencies;
			savedState.importPublisher = importPublishApi;
			return { ...result, snapshot: copy( snapshot ), dependencies: {
				...dependencies
			} };
		};
		const close = work.close;
		work.close = () => {
			if ( savedState.data && savedState.sourceApi ) {
				try { const source = savedState.dependencies && savedState.dependencies.importSource; if ( source ) { source.dispose(); } } catch ( error ) {}
			}
			close();
		};
		return { work, save, get saved() { return savedState.value; },
			get data() { return savedState.data && copy( savedState.data ); },
			get sourceApi() { return savedState.sourceApi; }, get pdfApi() { return savedState.pdfApi; },
			get importPublishApi() { return savedState.importPublisher; } };
	} catch ( error ) {
		work.close();
		throw error;
	}
}

module.exports = { build, copy, asciiJson };
