'use strict';

const hostFixture = require( './pdfCreationHost.js' );
const importFixture = require( './missingPdfImportData.js' );
const Ids = require( '../../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const Host = require( '../../../resources/ext.layers.editor/PageOwnedPdfCreationHost.js' );

function nativeImportFor( host ) {
	const data = importFixture.preparation( false, false );
	const creation = host.native;
	const target = {
		target: creation.target,
		selection: creation.selection,
		hasLayersSlot: creation.hasLayersSlot,
		mainText: creation.mainText,
		baseText: creation.baseText,
		baseBundle: creation.baseBundle,
		label: creation.context.label,
		initialPage: creation.context.initialPage,
		pageCount: creation.context.pageCount,
		source: {
			repository: creation.anchorSurface.source.repository,
			fileTitle: creation.anchorSurface.source.fileTitle,
			timestamp: creation.anchorSurface.source.timestamp,
			sha1: creation.anchorSurface.source.sha1
		},
		pages: Array.from( { length: creation.context.pageCount }, ( _, index ) => {
			const page = hostFixture.preparation( creation.hasLayersSlot, creation.context.initialPage, index + 1,
				creation.context.pageCount ).context;
			return { page: index + 1, surface: page.surface, sourceGeometry: page.sourceGeometry, rendition: page.rendition };
		} )
	};
	data.targetAdmission = target;
	data.sourceGroup.source.fileTitle = target.source.fileTitle;
	data.sourceGroup.label = target.label;
	const geometry = {}, renditions = {};
	for ( const surface of data.sourceBundle.snapshot.surfaces ) {
		surface.source.fileTitle = target.source.fileTitle;
		surface.label = target.label;
		surface.id = Ids.surfaceId( data.source.pageId, data.source.revisionId,
			target.source.fileTitle, target.label, surface.source.page );
		geometry[ surface.id ] = { page: surface.source.page, width: surface.canvas.width,
			height: surface.canvas.height, units: 'file-handler-pixels' };
		renditions[ surface.id ] = { url: `https://example.test/source-${ surface.source.page }.jpg`, width: surface.canvas.width,
			height: surface.canvas.height };
	}
	data.sourceBundle.sourceGeometry = geometry;
	data.sourceBundle.sourceRenditions = renditions;
	data.source.surfaceId = data.sourceBundle.snapshot.surfaces[ 0 ].id;
	for ( const member of data.sourceGroup.members ) {
		member.surfaceId = data.sourceBundle.snapshot.surfaces.find( surface => surface.source.page === member.page ).id;
	}
	const api = { post: jest.fn().mockImplementation( () => ( { layersmissingpdfimportread: {
		version: 1, data: importFixture.asciiJson( data )
	} } ) ) };
	return { api, value: data, source: data.source };
}

function setup( slot = true ) {
	const host = hostFixture.setup( slot );
	const originalClose = host.close, oldHost = host.host;
	oldHost.dispose();
	host.native.mainText = 'Prefix: ' + host.native.selection.expected + '\nAfter';
	host.reader.read.mockImplementation( async request => {
		const value = hostFixture.preparation( slot, 2, request.page, 2 );
		value.mainText = host.native.mainText;
		return value;
	} );
	host.host = new Host( host.editor, host.native, { reader: host.reader, publisher: host.publisher } );
	host.close = () => { host.host.dispose(); originalClose(); };
	const nativeImport = nativeImportFor( host );
	const publicationApi = { postWithToken: jest.fn().mockResolvedValue( { layersmissingpdfimportpublish: {
		version: 1, result: 'Success', revid: 13
	} } ) };
	const close = host.close;
	host.close = () => { nativeImport.api.post.mockClear(); close(); };
	return { ...host, nativeImport, publicationApi };
}

module.exports = { setup, nativeImportFor };
