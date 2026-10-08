'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const WorkingSet = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const witness = work => {
	const editor = work.editor, history = editor.historyManager, canvas = editor.canvasManager;
	return { draft: work.session.getDraft(), selection: work.session.getPdfStatus(), status: work.session.getStatus(),
		live: work.bridge.getLiveState(), background: canvas.backgroundImage,
		geometry: [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ],
		urls: [ editor.config.imageUrl, canvas.config.backgroundImageUrl, window.location.href ],
		page: [ editor.page, editor.pageCount ], dirty: editor.stateManager.get( 'isDirty' ),
		history: copy( { states: history.history, index: history.historyIndex, saved: history.lastSaveHistoryIndex,
			max: history.maxHistorySteps, batchMode: history.batchMode, destroyed: history.isDestroyed } ),
		timelines: copy( Array.from( work.bridge.pdfCoordinator.timelines ) ) };
};
const noWrites = work => {
	expect( work.api.postWithToken ).not.toHaveBeenCalled();
	expect( work.api.get.mock.calls.every( ( [ params ] ) => params.action === 'layersread' ) ).toBe( true );
};
function decodedBoundary( work, mutate ) {
	const canvas = work.editor.canvasManager, stageExact = canvas.stageExactBackground.bind( canvas );
	canvas.stageExactBackground = url => {
		const stage = stageExact( url );
		stage.promise.then( () => mutate( stage ) );
		return stage;
	};
}
function stalledDecode() {
	let enter, release;
	const entered = new Promise( resolve => { enter = resolve; } );
	const decoded = new Promise( resolve => { release = resolve; } );
	const Image = global.Image;
	global.Image = class extends Image {
		decode() { enter(); return decoded; }
	};
	return { entered, release };
}

describe( 'Complete PDF page-turn validation boundary', () => {
	it( 'normal two-way edits preserve independent Undo, complete finite data and sparse native IDs', async () => {
		const work = await fixture();
		try {
			work.edit( 'Second edited' );
			const layers = copy( work.editor.stateManager.get( 'layers' ) );
			layers[ 0 ].gradient = { type: 'linear', colors: [ { offset: 0, color: 'invalid' },
				{ offset: 1, color: '#ffffff' } ] };
			layers[ 0 ].future = [ null, false, { finite: -17 } ];
			work.editor.stateManager.set( 'layers', layers );
			work.editor.historyManager.saveState( 'Finite invalid work' );
			const second = work.session.getDraft().snapshot.surfaces.find( member => member.id === 'anchor' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'First edited' );
			const firstId = work.session.getPdfStatus().activeSurfaceId;
			expect( firstId ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ) ).toStrictEqual( second.layers );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( firstId );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'First edited' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session.getDraft().snapshot.metadata ).toStrictEqual( work.base.metadata );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it.each( [ 'disposed stage', 'changed exact URL', 'width', 'height', 'ownership', 'undecoded image', 'stage identity' ] )(
		'refuses %s without changing complete work', async boundary => {
			const work = await fixture();
			try {
				work.edit( 'Protected second' );
				const before = witness( work ), canvas = work.editor.canvasManager;
				decodedBoundary( work, stage => {
					if ( boundary === 'disposed stage' ) stage.dispose();
					if ( boundary === 'changed exact URL' ) stage.url = '/wrong-exact-source';
					if ( boundary === 'width' ) stage.info.width++;
					if ( boundary === 'height' ) stage.info.height++;
					if ( boundary === 'ownership' ) canvas.exactStages.delete( stage );
					if ( boundary === 'undecoded image' ) stage.image = null;
					if ( boundary === 'stage identity' ) work.bridge.pdfCoordinator.stage = null;
				} );
				expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
				expect( witness( work ) ).toStrictEqual( before );
				expect( canvas.exactStages.size ).toBe( 0 );
				noWrites( work );
			} finally { work.close(); }
		} );
	it.each( [ 'denied', 'stale base', 'wrong source', 'wrong page' ] )( 'refuses %s context completely', async boundary => {
		const work = await fixture();
		try {
			work.edit( 'Protected second' );
			const before = witness( work ), context = work.context( 1 );
			if ( boundary === 'stale base' ) context.revisionId++;
			if ( boundary === 'wrong source' ) context.surface.source.sha1 = 'b'.repeat( 31 );
			if ( boundary === 'wrong page' ) context.page = 2;
			work.api.get.mockResolvedValueOnce( boundary === 'denied' ? { error: { code: 'permissiondenied' } } :
				{ layersread: { editor: context } } );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages?.size || 0 ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it.each( [ 'read', 'decode' ] )( 'preserves newer work while %s waits and allows an explicit exact retry', async boundary => {
		const work = await fixture();
		try {
			let release;
			let pending;
			if ( boundary === 'read' ) {
				work.api.get.mockImplementationOnce( () => new Promise( resolve => { release = resolve; } ) );
				pending = work.bridge.pdfCoordinator.turn( 1 );
			} else {
				const gate = stalledDecode();
				pending = work.bridge.pdfCoordinator.turn( 1 );
				await gate.entered;
				release = gate.release;
			}
			work.edit( 'Newer finite edit' );
			work.editor.stateManager.set( 'backgroundOpacity', 0.25 );
			const before = witness( work );
			release( { layersread: { editor: work.context( 1 ) } } );
			expect( await pending ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages?.size || 0 ).toBe( 0 );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.session.getDraft().snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text )
				.toBe( 'Newer finite edit' );
			noWrites( work );
		} finally { work.close(); }
	} );
	it.each( [ 'off-screen timeline', 'dirty flag', 'editor URL', 'canvas geometry', 'background object',
		'history batch', 'history destruction', 'canvas destruction', 'blocked session' ] )(
		'preserves complete newer %s at the decoded boundary', async boundary => {
			const work = await fixture();
			try {
				work.edit( 'Protected second' );
				const gate = stalledDecode(), pending = work.bridge.pdfCoordinator.turn( 1 );
				await gate.entered;
				const coordinator = work.bridge.pdfCoordinator, editor = work.editor;
				if ( boundary === 'off-screen timeline' ) coordinator.timelines.set( 1, coordinator.freshTimeline( { layers: [] } ) );
				if ( boundary === 'dirty flag' ) editor.stateManager.set( 'isDirty', false );
				if ( boundary === 'editor URL' ) editor.config.imageUrl = '/newer-editor-url';
				if ( boundary === 'canvas geometry' ) editor.canvasManager.canvas.width++;
				if ( boundary === 'background object' ) editor.canvasManager.backgroundImage = { newer: true };
				if ( boundary === 'history batch' ) editor.historyManager.startBatch( 'Pending edit batch' );
				if ( boundary === 'history destruction' ) editor.historyManager.isDestroyed = true;
				if ( boundary === 'canvas destruction' ) editor.canvasManager.isDestroyed = true;
				if ( boundary === 'blocked session' ) work.session.blockPublication();
				const before = witness( work );
				gate.release();
				expect( await pending ).toBe( false );
				expect( witness( work ) ).toStrictEqual( before );
				expect( editor.canvasManager.exactStages.size ).toBe( 0 );
				noWrites( work );
			} finally { work.close(); }
		} );
	it( 'a stalled decode reaches the existing deadline without changing complete work', async () => {
		const work = await fixture();
		let gate;
		try {
			work.edit( 'Protected second' );
			const before = witness( work );
			jest.useFakeTimers( { doNotFake: [ 'queueMicrotask' ] } );
			gate = stalledDecode();
			const pending = work.bridge.pdfCoordinator.turn( 1 );
			await gate.entered;
			await jest.advanceTimersByTimeAsync( 5001 );
			expect( await pending ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally {
			if ( gate ) gate.release();
			work.close();
			jest.useRealTimers();
		}
	} );
	it( 'an older decoded completion cannot release a newer owned pending stage', async () => {
		const work = await fixture();
		try {
			let firstEnter, secondEnter, firstRelease, secondRelease;
			const firstEntered = new Promise( resolve => { firstEnter = resolve; } );
			const secondEntered = new Promise( resolve => { secondEnter = resolve; } );
			const firstDecode = new Promise( resolve => { firstRelease = resolve; } );
			const secondDecode = new Promise( resolve => { secondRelease = resolve; } );
			const Image = global.Image;
			let decodes = 0;
			global.Image = class extends Image {
				decode() {
					if ( decodes++ === 0 ) { firstEnter(); return firstDecode; }
					secondEnter(); return secondDecode;
				}
			};
			const before = witness( work ), older = work.bridge.pdfCoordinator.turn( 1 );
			await firstEntered;
			const newer = work.bridge.pdfCoordinator.turn( 1 );
			await secondEntered;
			const stage = work.bridge.pdfCoordinator.stage;
			expect( await older ).toBe( false );
			firstRelease();
			await Promise.resolve();
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.bridge.pdfCoordinator.stage ).toBe( stage );
			expect( work.editor.canvasManager.exactStages.has( stage ) ).toBe( true );
			secondRelease();
			expect( await newer ).toBe( true );
			expect( work.editor.page ).toBe( 1 );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it( 'overlapping read completions cannot release or replace the newer installed page', async () => {
		const work = await fixture();
		try {
			work.edit( 'Second retained' );
			let release;
			work.api.get.mockImplementationOnce( () => new Promise( resolve => { release = resolve; } ) );
			const older = work.bridge.pdfCoordinator.turn( 1 );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'Newer first' );
			const before = witness( work );
			release( { layersread: { editor: work.context( 1 ) } } );
			expect( await older ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it.each( [ 'load', 'decode' ] )( 'failed %s leaves complete current work intact', async boundary => {
		const work = await fixture();
		try {
			work.edit( 'Protected second' );
			const before = witness( work ), Image = global.Image;
			global.Image = class extends Image {
				decode() { return Promise.reject( new Error( 'decode edge' ) ); }
				set src( value ) {
					if ( boundary === 'load' ) {
						if ( value ) queueMicrotask( () => this.onerror && this.onerror() );
					} else super.src = value;
				}
			};
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it( 'invalid target timeline is rejected before selection or installation', async () => {
		const work = await fixture();
		try {
			const timeline = work.bridge.pdfCoordinator.freshTimeline( { layers: [] } );
			timeline.historyIndex = 99;
			work.bridge.pdfCoordinator.timelines.set( 1, timeline );
			const before = witness( work );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			noWrites( work );
		} finally { work.close(); }
	} );
	it( 'coordinator disposal cancels stalled decoding without installing or publishing', async () => {
		const work = await fixture();
		try {
			work.edit( 'Protected second' );
			const gate = stalledDecode(), pending = work.bridge.pdfCoordinator.turn( 1 );
			await gate.entered;
			work.bridge.pdfCoordinator.dispose();
			const before = witness( work );
			gate.release();
			expect( await pending ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			noWrites( work );
		} finally { work.close(); }
	} );
	it.each( [ 'save', 'reconcile' ] )( 'a pending %s refuses an old turn before installation', async boundary => {
		const work = await fixture();
		try {
			work.edit( 'Second retained' );
			let releaseTurn, releaseOperation;
			work.api.get.mockImplementationOnce( () => new Promise( resolve => { releaseTurn = resolve; } ) );
			const turn = work.bridge.pdfCoordinator.turn( 1 );
			let operation;
			if ( boundary === 'save' ) {
				const publish = work.api.postWithToken.getMockImplementation();
				work.api.postWithToken.mockImplementationOnce( ( ...args ) => new Promise( resolve => {
					releaseOperation = () => resolve( publish( ...args ) );
				} ) );
				operation = work.bridge.save( 'Intentional transport-only save' );
			} else {
				const read = work.api.get.getMockImplementation();
				work.api.get.mockImplementationOnce( ( ...args ) => new Promise( resolve => {
					releaseOperation = () => resolve( read( ...args ) );
				} ) );
				operation = work.bridge.reconcile( 13 );
			}
			const before = witness( work );
			releaseTurn( { layersread: { editor: work.context( 1 ) } } );
			expect( await turn ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			releaseOperation();
			await operation;
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.api.get.mock.calls.at( -1 )[ 0 ].revid ).toBe( 13 );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( boundary === 'save' ? 1 : 0 );
		} finally { work.close(); }
	} );
	it( 'turn refuses an owned pending recovery without canceling or installing it', async () => {
		const work = await fixture();
		try {
			let release;
			const candidate = { pdfDraft: copy( work.session.getDraft() ) };
			candidate.pdfDraft.snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text = 'Recovered second';
			work.api.get.mockImplementationOnce( () => new Promise( resolve => { release = resolve; } ) );
			const recovery = work.bridge.pdfCoordinator.restoreDraft( candidate );
			const owned = work.bridge.pdfCoordinator.recoveryOperation, before = witness( work );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.bridge.pdfCoordinator.recoveryOperation ).toBe( owned );
			release( { layersread: { editor: work.context( 2 ) } } );
			await recovery;
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Recovered second' );
			noWrites( work );
		} finally { work.close(); }
	} );
} );