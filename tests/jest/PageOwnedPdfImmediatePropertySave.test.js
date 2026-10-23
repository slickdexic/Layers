'use strict';

const { setup, applyImport, successfulSave, nativeCalls, ordinaryCalls, copy } =
	require( './PageOwnedWholePdfImportPublication.test.js' );
const InlineTextEditor = require( '../../resources/ext.layers.editor/canvas/InlineTextEditor.js' );

function connectEditorSave( work ) {
	const editor = work.editor;
	editor.validationManager = { sanitizeLayerData: changes => changes };
	editor.uiManager = { showSpinner: jest.fn(), hideSpinner: jest.fn() };
	editor.apiManager.saveLayers = () => work.bridge.save( 'Immediate property edit' );
	return editor;
}

async function savedImport( work, application, request ) {
	await applyImport( work, application, request );
	await successfulSave( work, 'Initial PDF Import' );
	return JSON.parse( work.session._savedJson );
}

describe( 'PageOwnedPdfImmediatePropertySave', () => {
	it( 'saves a property edit before its debounced history checkpoint and does not duplicate the checkpoint', async () => {
		const { work, api, request, application } = await setup();
		const realRequestAnimationFrame = window.requestAnimationFrame;
		try {
			const initial = await savedImport( work, application, request );
			const editor = connectEditorSave( work );
			const imported = initial.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 2 );
			const layerId = imported.layers[ 0 ].id;
			jest.useFakeTimers();
			window.requestAnimationFrame = jest.fn();
			editor.updateLayer( layerId, { text: 'Immediate property edit' } );
			expect( editor.historyManager.history[ editor.historyManager.historyIndex ].layers[ 0 ].text )
				.toBe( 'Imported PDF page 2' );

			const saved = await editor.saveCurrentPage();
			expect( saved ).toBe( true );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
			const published = JSON.parse( ordinaryCalls( api )[ 0 ][ 1 ].data );
			expect( published.surfaces.find( surface => surface.id === imported.id ).layers[ 0 ].text )
				.toBe( 'Immediate property edit' );
			expect( published.surfaces.filter( surface => surface.id !== imported.id ) )
				.toEqual( initial.surfaces.filter( surface => surface.id !== imported.id ) );
			expect( editor.historyManager.history[ editor.historyManager.historyIndex ].layers[ 0 ].text )
				.toBe( 'Immediate property edit' );

			const historyLength = editor.historyManager.history.length;
			jest.advanceTimersByTime( 300 );
			expect( editor.historyManager.history ).toHaveLength( historyLength );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
		} finally {
			window.requestAnimationFrame = realRequestAnimationFrame;
			jest.useRealTimers();
			work.close();
		}
	} );

	it( 'keeps the debounced property edit and history when the server refuses Save', async () => {
		const { work, api, request, application, getRevision } = await setup();
		const realRequestAnimationFrame = window.requestAnimationFrame;
		try {
			const initial = await savedImport( work, application, request );
			const editor = connectEditorSave( work );
			const imported = initial.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 2 );
			const layerId = imported.layers[ 0 ].id;
			jest.useFakeTimers();
			window.requestAnimationFrame = jest.fn();
			editor.updateLayer( layerId, { text: 'Keep this refused edit' } );
			jest.advanceTimersByTime( 300 );
			const history = copy( editor.historyManager.captureTimeline() );
			const revision = getRevision();
			api.postWithToken.mockRejectedValueOnce( { error: { code: 'layers-edit-conflict' } } );

			expect( await editor.saveCurrentPage() ).toBe( false );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( getRevision() ).toBe( revision );
			expect( editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Keep this refused edit' );
			expect( work.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Keep this refused edit' );
			expect( editor.historyManager.captureTimeline() ).toEqual( history );
			expect( work.session.getStatus().dirty ).toBe( true );
		} finally {
			window.requestAnimationFrame = realRequestAnimationFrame;
			jest.useRealTimers();
			work.close();
		}
	} );

	it.each( [ false, true ] )( 'saves active inline text once in history (pending format %s)', async pendingFormat => {
		const { work, api, request, application } = await setup();
		const realRequestAnimationFrame = window.requestAnimationFrame;
		try {
			const initial = await savedImport( work, application, request );
			const editor = connectEditorSave( work );
			const imported = initial.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 2 );
			const layer = editor.getLayerById( imported.layers[ 0 ].id );
			const inline = new InlineTextEditor( editor.canvasManager );
			inline.isEditing = true;
			inline.editingLayer = layer;
			inline.originalText = layer.text;
			inline._originalVisible = true;
			layer.visible = false;
			inline.editorElement = document.createElement( 'textarea' );
			inline.editorElement.value = 'Inline immediate edit';
			editor.canvasManager.inlineTextEditor = inline;
			jest.useFakeTimers();
			window.requestAnimationFrame = jest.fn();
			if ( pendingFormat ) {
				editor.updateLayer( layer.id, { fontFamily: 'serif' } );
				inline.editingLayer = editor.getLayerById( layer.id );
			}
			// Keep this focused on the actual finish/save/history path, without requiring canvas rendering.
			editor.canvasManager.setTextEditingMode = jest.fn();
			editor.canvasManager.renderLayers = jest.fn();

			const historyLength = editor.historyManager.history.length;
			expect( await editor.saveCurrentPage() ).toBe( true );
			expect( editor.historyManager.history ).toHaveLength( historyLength + 1 );
			jest.advanceTimersByTime( 300 );
			expect( editor.historyManager.history ).toHaveLength( historyLength + 1 );
			expect( inline.isActive() ).toBe( false );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
			const published = JSON.parse( ordinaryCalls( api )[ 0 ][ 1 ].data );
			expect( published.surfaces.find( surface => surface.id === imported.id ).layers[ 0 ].text )
				.toBe( 'Inline immediate edit' );
			expect( published.surfaces.find( surface => surface.id === imported.id ).layers[ 0 ].visible ).toBe( true );
			expect( published.surfaces.filter( surface => surface.id !== imported.id ) )
				.toEqual( initial.surfaces.filter( surface => surface.id !== imported.id ) );
			expect( editor.historyManager.history[ editor.historyManager.historyIndex ].layers[ 0 ].text )
				.toBe( 'Inline immediate edit' );

			expect( editor.historyManager.undo() ).toBe( true );
			expect( editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Imported PDF page 2' );
			expect( work.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Imported PDF page 2' );
			expect( work.session.getStatus().dirty ).toBe( true );
		} finally {
			window.requestAnimationFrame = realRequestAnimationFrame;
			jest.useRealTimers();
			work.close();
		}
	} );
} );
