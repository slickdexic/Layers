'use strict';
const { creationContext, clone, choose, tick } = require( './creationDraftAdmissionContext.js' );
async function rebaseContext( kind = 'slide', siblings = false ) {
	const c = await creationContext( kind, siblings );
	const previousPost = c.api.post.getMockImplementation();
	const previousRead = c.reader.read.getMockImplementation();
	const currentBase = siblings ? clone( c.base ) : { schemaVersion: 1, surfaces: [] };
	currentBase.metadata = { newer: [ null, false, 0, 'Preserve' ] };
	if ( siblings ) { currentBase.surfaces[ 0 ].layers[ 0 ].text = 'Newer native sibling'; }
	const newSurface = clone( c.added ); newSurface.id = 'current';
	const currentSelection = { start: 23, expected: c.selection.expected };
	const creation = { target: { owner: 'Target Page', pageId: 7, revisionId: 20, surfaceId: 'current' },
		selection: currentSelection, hasLayersSlot: siblings,
		baseBundle: siblings ? { revisionId: 20, snapshot: currentBase, sourceGeometry: [], extra: [ null, 0 ] } : null, newSurface };
	// Without a stored slot, native admission carries no synthetic root metadata.
	if ( !siblings ) { delete currentBase.metadata; }
	const rebase = { origin: { pageId: 7, revisionId: 12, surfaceId: 'target', selection: clone( c.selection ) }, creation };
	const events = { rebase: null, source: null, response: null };
	c.api.post.mockImplementation( async params => {
		if ( params.action === 'layersworkingcopyimportcreationrebase' ) {
			if ( events.rebase ) { await events.rebase(); }
			const response = { layersworkingcopyimportcreationrebase: clone( rebase ) };
			return events.response ? events.response( response ) : response;
		}
		if ( params.baserevid === 20 ) {
			if ( events.source ) { await events.source(); }
			const response = { layersworkingcopyimportcreationread: { creation: clone( creation ), source: clone( c.choice ), sourceBundle: clone( c.bundle ) } };
			return events.response ? events.response( response ) : response;
		}
		return previousPost( params );
	} );
	let saved;
	c.api.postWithToken.mockImplementation( async ( token, params ) => {
		expect( token ).toBe( 'csrf' ); expect( params.baserevid ).toBe( 20 ); expect( params.targetsurface ).toBe( 'current' );
		expect( params.embedstart ).toBe( 23 ); expect( params.embedtext ).toBe( c.selection.expected );
		saved = JSON.parse( params.data ); return { layersworkingcopyimportcreationpublish: { result: 'Success', revid: 21 } };
	} );
	c.reader.read.mockImplementation( async options => {
		if ( saved ) { return { revisionId: 21, snapshot: clone( saved ) }; }
		if ( options.revisionId === 12 ) { return previousRead( options ); }
		if ( !siblings ) { throw new Error( 'No native Layers slot' ); }
		return { revisionId: 20, snapshot: clone( currentBase ) };
	} );
	return { ...c, currentBase, creation, rebase, events, currentSelection };
}
function observed( c ) {
	return JSON.parse( JSON.stringify( { draft: c.session.getDraft(), timeline: c.history.captureTimeline(),
		saved: c.session._savedJson, newSurface: c.session._newSurface, status: c.session.getStatus(),
		state: c.store.state, config: c.editor.config, claims: c.session.captureWorkingCopyImportProvenance(),
		selection: c.editor.canvasManager.selectedLayerIds, records: Array.from( c.records.entries() ) },
		( key, value ) => value === undefined ? { absentValue: true } : value ) );
}
module.exports = { rebaseContext, clone, choose, tick, observed };
