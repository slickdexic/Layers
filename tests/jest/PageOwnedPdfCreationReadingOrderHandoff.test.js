'use strict';

global.TextEncoder = global.TextEncoder || require( 'util' ).TextEncoder;
const { build } = require( './fixtures/pdfCreationSavedImport.js' );
const creationFixture = require( './fixtures/pdfCreationHost.js' );

function pdfMembers( snapshot ) {
	return snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' &&
		surface.source && surface.source.fileTitle === 'File:Source.pdf' ).sort( ( left, right ) => left.source.page - right.source.page );
}

async function buildWithReadingOrder( blankOrder ) {
	return build( { beforeLoad: work => {
		// The target and its fresh per-page reads model native creation admission before Import.
		const setBlankOrder = surface => {
			if ( blankOrder === 'explicit' ) { surface.readingOrder = []; } else { delete surface.readingOrder; }
		};
		setBlankOrder( work.native.anchorSurface );
		setBlankOrder( work.native.context.surface );
		for ( const page of work.nativeImport.value.targetAdmission.pages ) { setBlankOrder( page.surface ); }

		// The imported source carries a meaningful, non-layer-array reading order.
		for ( const surface of work.nativeImport.value.sourceBundle.snapshot.surfaces ) {
			surface.readingOrder = surface.layers.map( layer => layer.id ).reverse();
		}

		work.reader.read.mockImplementation( async request => {
			const result = creationFixture.preparation( true, 2, request.page, 2 );
			result.mainText = work.native.mainText;
			setBlankOrder( result.anchorSurface );
			setBlankOrder( result.context.surface );
			return result;
		} );

		// Recreate the host so its immutable native admission is captured with the adjusted fields.
		const Host = work.host.constructor;
		work.host.dispose();
		const host = new Host( work.editor, work.native, { reader: work.reader, publisher: work.publisher } );
		const close = work.close;
		work.host = host;
		work.close = () => { host.dispose(); close(); };
	} } );
}

describe( 'PDF creation Import readingOrder through confirmed first Save', () => {
	it.each( [ 'explicit', 'absent' ] )( 'preserves the %s blank readingOrder across native handoff Undo/Redo', async blankOrder => {
		const value = await buildWithReadingOrder( blankOrder ); let delivered;
		try {
			const saved = await value.save();
			delivered = await value.work.host.handoffSavedSession( saved.dependencies );
			expect( delivered.needsRefresh ).toBe( false );

			const savedMembers = pdfMembers( saved.snapshot );
			expect( savedMembers ).toHaveLength( 2 );
			for ( const member of savedMembers ) {
				expect( member.readingOrder ).toEqual( member.layers.map( layer => layer.id ).reverse() );
			}

			expect( value.work.editor.historyManager.undo() ).toBe( true );
			const beforeImport = pdfMembers( delivered.importApplication.captureDraft().session.snapshot );
			expect( beforeImport ).toHaveLength( 2 );
			for ( const member of beforeImport ) {
				expect( member.layers ).toEqual( [] );
				if ( blankOrder === 'explicit' ) {
					expect( Object.hasOwn( member, 'readingOrder' ) ).toBe( true );
					expect( member.readingOrder ).toEqual( [] );
				} else {
					expect( Object.hasOwn( member, 'readingOrder' ) ).toBe( false );
				}
			}

			expect( value.work.editor.historyManager.redo() ).toBe( true );
			expect( pdfMembers( delivered.importApplication.captureDraft().session.snapshot ) ).toEqual( savedMembers );
		} finally {
			if ( delivered ) {
				delivered.importApplication.dispose(); delivered.importBinding.dispose(); delivered.bridge.dispose();
			}
			value.work.close();
		}
	} );
} );
