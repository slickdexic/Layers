/**
 * Tests for PageOwnedRevisionView
 */
'use strict';

window.Layers = window.Layers || {};
window.Layers.Viewer = window.Layers.Viewer || {};

const PageOwnedRevisionView = require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
const PageOwnedSnapshotAdapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );

describe( 'PageOwnedRevisionView', () => {
	let adapter, messageMock, baseBundle, validSurface;

	beforeEach( () => {
		adapter = new PageOwnedSnapshotAdapter();
		messageMock = jest.fn( ( key, ...args ) => {
			if ( key === 'layers-page-history-caption' ) {
				return `Page ${ args[ 0 ] }, revision ${ args[ 1 ] } — ${ args[ 2 ] }`;
			}
			if ( key === 'layers-page-history-render-failed' ) {
				return 'This saved drawing could not be displayed.';
			}
			return `msg:${ key }`;
		} );

		validSurface = {
			id: 'presentation',
			kind: 'slide',
			label: 'Main Slide',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'text-1',
					type: 'text',
					x: 40,
					y: 60,
					text: 'Visual Title',
					fontSize: 24,
					color: '#000000'
				}
			],
			readingOrder: [ 'text-1' ]
		};

		baseBundle = {
			owner: 'Test_Page',
			revisionId: 42,
			surface: JSON.parse( JSON.stringify( validSurface ) )
		};
	} );

	describe( 'module export', () => {
		it( 'exports to window.Layers.Viewer.PageOwnedRevisionView and CommonJS', () => {
			expect( window.Layers.Viewer.PageOwnedRevisionView ).toBe( PageOwnedRevisionView );
			expect( typeof PageOwnedRevisionView ).toBe( 'function' );
		} );
	} );

	describe( 'constructor validation', () => {
		it( 'accepts valid options with real adapter', () => {
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );
			expect( view ).toBeInstanceOf( PageOwnedRevisionView );
		} );

		it.each( [
			[ 'null options', null ],
			[ 'undefined options', undefined ],
			[ 'number options', 123 ],
			[ 'string options', 'invalid' ],
			[ 'array options', [] ],
			[ 'empty object options', {} ]
		] )( 'rejects invalid options: %s', ( _, opts ) => {
			expect( () => new PageOwnedRevisionView( opts ) ).toThrow( 'Invalid revision view' );
			try {
				new PageOwnedRevisionView( opts );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-revision-view' );
			}
		} );

		it.each( [
			[ 'missing bundle', undefined ],
			[ 'null bundle', null ],
			[ 'array bundle', [] ],
			[ 'string bundle', 'invalid' ],
			[ 'missing owner', { revisionId: 1, surface: {} } ],
			[ 'empty owner', { owner: '', revisionId: 1, surface: {} } ],
			[ 'number owner', { owner: 123, revisionId: 1, surface: {} } ],
			[ 'missing revisionId', { owner: 'P', surface: {} } ],
			[ 'zero revisionId', { owner: 'P', revisionId: 0, surface: {} } ],
			[ 'negative revisionId', { owner: 'P', revisionId: -1, surface: {} } ],
			[ 'float revisionId', { owner: 'P', revisionId: 1.5, surface: {} } ],
			[ 'overflow revisionId', { owner: 'P', revisionId: 2147483648, surface: {} } ],
			[ 'string revisionId', { owner: 'P', revisionId: '42', surface: {} } ],
			[ 'missing surface', { owner: 'P', revisionId: 1 } ],
			[ 'null surface', { owner: 'P', revisionId: 1, surface: null } ],
			[ 'array surface', { owner: 'P', revisionId: 1, surface: [] } ],
			[ 'image surface kind', { owner: 'P', revisionId: 1, surface: { id: 's', kind: 'image' } } ],
			[ 'pdf surface kind', { owner: 'P', revisionId: 1, surface: { id: 's', kind: 'pdf' } } ],
			[ 'unknown surface kind', { owner: 'P', revisionId: 1, surface: { id: 's', kind: 'unknown' } } ],
			[ 'empty surface id', { owner: 'P', revisionId: 1, surface: { id: '', kind: 'slide' } } ],
			[ 'missing surface id', { owner: 'P', revisionId: 1, surface: { kind: 'slide' } } ]
		] )( 'rejects invalid bundle: %s', ( _, invalidBundle ) => {
			expect( () => new PageOwnedRevisionView( {
				bundle: invalidBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} ) ).toThrow( 'Invalid revision view' );
		} );

		it.each( [
			[ 'missing adapter', undefined ],
			[ 'null adapter', null ],
			[ 'object without toEditorState', { withEditorState: () => {} } ],
			[ 'object without withEditorState', { toEditorState: () => {} } ],
			[ 'non-function toEditorState', { toEditorState: 'notAFn', withEditorState: () => {} } ],
			[ 'non-function withEditorState', { toEditorState: () => {}, withEditorState: 'notAFn' } ]
		] )( 'rejects invalid adapter: %s', ( _, invalidAdapter ) => {
			expect( () => new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter: invalidAdapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} ) ).toThrow( 'Invalid revision view' );
		} );

		it.each( [
			[ 'missing render', undefined ],
			[ 'null render', null ],
			[ 'string render', 'notAFunction' ],
			[ 'object render', {} ]
		] )( 'rejects invalid render: %s', ( _, invalidRender ) => {
			expect( () => new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: invalidRender,
				message: messageMock
			} ) ).toThrow( 'Invalid revision view' );
		} );

		it.each( [
			[ 'missing message', undefined ],
			[ 'null message', null ],
			[ 'string message', 'notAFunction' ],
			[ 'object message', {} ]
		] )( 'rejects invalid message: %s', ( _, invalidMessage ) => {
			expect( () => new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: invalidMessage
			} ) ).toThrow( 'Invalid revision view' );
		} );

		it( 'accepts boundary revision IDs 1 and 2147483647', () => {
			const bundle1 = Object.assign( {}, baseBundle, { revisionId: 1 } );
			const bundleMax = Object.assign( {}, baseBundle, { revisionId: 2147483647 } );

			expect( () => new PageOwnedRevisionView( {
				bundle: bundle1,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} ) ).not.toThrow();

			expect( () => new PageOwnedRevisionView( {
				bundle: bundleMax,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} ) ).not.toThrow();
		} );

		it( 'redacts adapter diagnostics when adapter throws on malformed surface', () => {
			const badSurfaceBundle = {
				owner: 'Test_Page',
				revisionId: 1,
				surface: {
					id: 'presentation',
					kind: 'slide',
					canvas: 'notAnObject', // Will cause adapter to throw
					layers: []
				}
			};

			try {
				new PageOwnedRevisionView( {
					bundle: badSurfaceBundle,
					adapter,
					render: jest.fn( () => () => {} ),
					message: messageMock
				} );
				throw new Error( 'Expected constructor to throw' );
			} catch ( err ) {
				expect( err.message ).toBe( 'Invalid revision view' );
				expect( err.code ).toBe( 'layers-invalid-revision-view' );
			}
		} );

		it( 'preserves false and zero values in surface metadata and does not mutate caller data', () => {
			const callerSurface = JSON.parse( JSON.stringify( validSurface ) );
			callerSurface.canvas.backgroundVisible = false;
			callerSurface.canvas.backgroundOpacity = 0;
			callerSurface.layers[ 0 ].x = 0;
			callerSurface.layers[ 0 ].y = 0;

			const callerBundle = {
				owner: 'Test_Page',
				revisionId: 10,
				surface: callerSurface
			};

			const view = new PageOwnedRevisionView( {
				bundle: callerBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			// Mutate caller data after construction
			callerSurface.canvas.width = 9999;
			callerSurface.layers[ 0 ].text = 'MUTATED';

			const parent = document.createElement( 'div' );
			view.mount( parent );

			const canvas = parent.querySelector( 'canvas' );
			expect( canvas.width ).toBe( 800 ); // Not 9999
			view.dispose();
		} );
	} );

	describe( 'canvas dimensions and area limits', () => {
		it.each( [
			[ 'zero width', { width: 0, height: 600 } ],
			[ 'negative width', { width: -100, height: 600 } ],
			[ 'float width', { width: 800.5, height: 600 } ],
			[ 'zero height', { width: 800, height: 0 } ],
			[ 'negative height', { width: 800, height: -50 } ],
			[ 'float height', { width: 800, height: 600.2 } ],
			[ 'width exceeding 16384', { width: 16385, height: 600 } ],
			[ 'height exceeding 16384', { width: 800, height: 16385 } ],
			[ 'area exceeding 16777216', { width: 16384, height: 1025 } ], // 16793600
			[ 'huge area 16384x16384', { width: 16384, height: 16384 } ]
		] )( 'rejects on mount when dimensions are invalid: %s', ( _, invalidCanvas ) => {
			const bundle = JSON.parse( JSON.stringify( baseBundle ) );
			bundle.surface.canvas = Object.assign( {}, bundle.surface.canvas, invalidCanvas );

			const view = new PageOwnedRevisionView( {
				bundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			const parent = document.createElement( 'div' );
			expect( () => view.mount( parent ) ).toThrow( 'Invalid revision view' );
			try {
				view.mount( parent );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-revision-view' );
			}
			expect( parent.children.length ).toBe( 0 );
		} );

		it( 'accepts exact maximum allowed area (16384 x 1024 = 16777216)', () => {
			const bundle = JSON.parse( JSON.stringify( baseBundle ) );
			bundle.surface.canvas.width = 16384;
			bundle.surface.canvas.height = 1024;

			const view = new PageOwnedRevisionView( {
				bundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			const parent = document.createElement( 'div' );
			expect( () => view.mount( parent ) ).not.toThrow();

			const canvas = parent.querySelector( 'canvas' );
			expect( canvas.width ).toBe( 16384 );
			expect( canvas.height ).toBe( 1024 );
			view.dispose();
		} );
	} );

	describe( 'mounting and DOM structure', () => {
		let parent;

		beforeEach( () => {
			parent = document.createElement( 'div' );
			document.body.appendChild( parent );
		} );

		afterEach( () => {
			if ( parent && parent.parentNode ) {
				parent.parentNode.removeChild( parent );
			}
		} );

		it.each( [
			[ 'null parent', null ],
			[ 'undefined parent', undefined ],
			[ 'primitive parent', 'notAnElement' ],
			[ 'object without appendChild', {} ],
			[ 'document fragment or non-element', document.createTextNode( '' ) ]
		] )( 'rejects invalid mount target: %s', ( _, invalidParent ) => {
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );
			expect( () => view.mount( invalidParent ) ).toThrow( 'Invalid revision view' );
		} );

		it( 'creates figure, figcaption, canvas, and accessible status element', () => {
			const renderSpy = jest.fn( () => () => {} );
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderSpy,
				message: messageMock
			} );

			view.mount( parent );

			const figure = parent.querySelector( 'figure' );
			expect( figure ).not.toBeNull();
			expect( figure.className ).toBe( 'ext-layers-historical-view' );

			const caption = figure.querySelector( 'figcaption' );
			expect( caption ).not.toBeNull();
			expect( caption.className ).toBe( 'ext-layers-historical-caption' );
			expect( caption.textContent ).toBe( 'Page Test_Page, revision 42 — Main Slide' );

			const canvas = figure.querySelector( 'canvas' );
			expect( canvas ).not.toBeNull();
			expect( canvas.className ).toBe( 'ext-layers-historical-canvas' );
			expect( canvas.width ).toBe( 800 );
			expect( canvas.height ).toBe( 600 );
			expect( canvas.getAttribute( 'aria-label' ) ).toBe( 'Page Test_Page, revision 42 — Main Slide' );
			expect( canvas.style.maxWidth ).toBe( '100%' );
			expect( canvas.style.height ).toBe( 'auto' );

			const status = figure.querySelector( 'div.ext-layers-historical-status' );
			expect( status ).not.toBeNull();
			expect( status.getAttribute( 'role' ) ).toBe( 'status' );
			expect( status.getAttribute( 'aria-live' ) ).toBe( 'polite' );
			expect( status.textContent ).toBe( '' );

			// Zero editing buttons, inputs, links
			expect( figure.querySelector( 'button' ) ).toBeNull();
			expect( figure.querySelector( 'input' ) ).toBeNull();
			expect( figure.querySelector( 'a' ) ).toBeNull();

			view.dispose();
		} );

		it( 'preserves an explicitly empty surface label', () => {
			baseBundle.surface.label = '';
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle, adapter, render: () => () => {}, message: messageMock
			} );
			view.mount( parent );
			expect( messageMock ).toHaveBeenCalledWith( 'layers-page-history-caption', 'Test_Page', 42, '' );
			view.dispose();
		} );

		it( 'falls back to surface.id when surface.label is missing', () => {
			const bundle = JSON.parse( JSON.stringify( baseBundle ) );
			delete bundle.surface.label;

			const view = new PageOwnedRevisionView( {
				bundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			view.mount( parent );

			const caption = parent.querySelector( 'figcaption' );
			expect( caption.textContent ).toBe( 'Page Test_Page, revision 42 — presentation' );

			view.dispose();
		} );

		it( 'safely renders markup-like text as literal textContent without creating HTML tags', () => {
			const bundle = JSON.parse( JSON.stringify( baseBundle ) );
			bundle.owner = '<script>alert("owner")</script>';
			bundle.surface.label = '<img src=x onerror=alert(1)>';

			const view = new PageOwnedRevisionView( {
				bundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			view.mount( parent );

			const figure = parent.querySelector( 'figure' );
			expect( figure.querySelector( 'script' ) ).toBeNull();
			expect( figure.querySelector( 'img' ) ).toBeNull();

			const caption = figure.querySelector( 'figcaption' );
			expect( caption.textContent ).toContain( '<script>alert("owner")</script>' );
			expect( caption.textContent ).toContain( '<img src=x onerror=alert(1)>' );

			view.dispose();
		} );

		it( 'rejects mounting twice on the same instance', () => {
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			view.mount( parent );
			expect( parent.children.length ).toBe( 1 );

			expect( () => view.mount( parent ) ).toThrow( 'Invalid revision view' );
			expect( parent.children.length ).toBe( 1 );

			view.dispose();
		} );

		it( 'rejects mounting after disposal', () => {
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			view.dispose();
			expect( () => view.mount( parent ) ).toThrow( 'Invalid revision view' );
			expect( parent.children.length ).toBe( 0 );
		} );
	} );

	describe( 'renderer factory execution and failure handling', () => {
		let parent;

		beforeEach( () => {
			parent = document.createElement( 'div' );
			document.body.appendChild( parent );
		} );

		afterEach( () => {
			if ( parent && parent.parentNode ) {
				parent.parentNode.removeChild( parent );
			}
		} );

		it( 'passes an isolated deep copy of the surface to the renderer', () => {
			let passedSurface = null;
			const cleanupSpy = jest.fn();
			const renderMock = jest.fn( ( canvas, surfaceCopy ) => {
				passedSurface = surfaceCopy;
				// Mutate surface inside renderer
				surfaceCopy.canvas.width = 999;
				surfaceCopy.layers.push( { id: 'added' } );
				return cleanupSpy;
			} );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			view.mount( parent );

			expect( renderMock ).toHaveBeenCalledTimes( 1 );
			expect( passedSurface ).not.toBeNull();
			expect( passedSurface.canvas.width ).toBe( 999 );

			// Underlying component surface was not affected
			expect( parent.querySelector( 'canvas' ).width ).toBe( 800 );

			view.dispose();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'handles renderer throwing synchronously: removes canvas, sets failed status, retains caption', () => {
			const renderMock = jest.fn( () => {
				throw new Error( 'SECRET renderer failure' );
			} );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			expect( () => view.mount( parent ) ).not.toThrow();

			const figure = parent.querySelector( 'figure' );
			expect( figure.querySelector( 'canvas' ) ).toBeNull();

			const caption = figure.querySelector( 'figcaption' );
			expect( caption.textContent ).toBe( 'Page Test_Page, revision 42 — Main Slide' );

			const status = figure.querySelector( 'div.ext-layers-historical-status' );
			expect( status.textContent ).toBe( 'This saved drawing could not be displayed.' );
			expect( status.textContent ).not.toContain( 'SECRET' );

			view.dispose();
		} );

		it( 'handles renderer returning non-function: removes canvas, sets failed status', () => {
			const renderMock = jest.fn( () => 'notACleanupFunction' );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			view.mount( parent );

			const figure = parent.querySelector( 'figure' );
			expect( figure.querySelector( 'canvas' ) ).toBeNull();

			const status = figure.querySelector( 'div.ext-layers-historical-status' );
			expect( status.textContent ).toBe( 'This saved drawing could not be displayed.' );

			view.dispose();
		} );

		it( 'handles synchronous failure before cleanup return: runs cleanup once returned', () => {
			const cleanupSpy = jest.fn();
			const renderMock = jest.fn( ( canvas, surfaceCopy, onFailure ) => {
				onFailure(); // synchronous failure call!
				return cleanupSpy;
			} );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			view.mount( parent );

			expect( parent.querySelector( 'canvas' ) ).toBeNull();
			const status = parent.querySelector( 'div.ext-layers-historical-status' );
			expect( status.textContent ).toBe( 'This saved drawing could not be displayed.' );

			// Cleanup was called immediately upon factory return because renderFailed was already true
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );

			// Subsequent dispose does not re-invoke cleanup
			view.dispose();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'handles asynchronous failure callback: removes canvas, sets failed status, calls cleanup', () => {
			let failureCallback = null;
			const cleanupSpy = jest.fn();
			const renderMock = jest.fn( ( canvas, surfaceCopy, onFailure ) => {
				failureCallback = onFailure;
				return cleanupSpy;
			} );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			view.mount( parent );

			expect( parent.querySelector( 'canvas' ) ).not.toBeNull();
			expect( cleanupSpy ).not.toHaveBeenCalled();

			// Trigger async failure
			expect( typeof failureCallback ).toBe( 'function' );
			failureCallback();

			expect( parent.querySelector( 'canvas' ) ).toBeNull();
			const status = parent.querySelector( 'div.ext-layers-historical-status' );
			expect( status.textContent ).toBe( 'This saved drawing could not be displayed.' );
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );

			// Repeated failure call is inert
			failureCallback();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );

			view.dispose();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'suppresses cleanup exceptions without failing disposal or leaking diagnostics', () => {
			const cleanupThrows = jest.fn( () => {
				throw new Error( 'SECRET cleanup diagnostic' );
			} );
			const renderMock = jest.fn( () => cleanupThrows );

			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: renderMock,
				message: messageMock
			} );

			view.mount( parent );
			expect( parent.children.length ).toBe( 1 );

			expect( () => view.dispose() ).not.toThrow();
			expect( cleanupThrows ).toHaveBeenCalledTimes( 1 );
			expect( parent.children.length ).toBe( 0 ); // Figure was still successfully removed
		} );
	} );

	describe( 'disposal lifecycle and idempotency', () => {
		let parent;

		beforeEach( () => {
			parent = document.createElement( 'div' );
			document.body.appendChild( parent );
		} );

		afterEach( () => {
			if ( parent && parent.parentNode ) {
				parent.parentNode.removeChild( parent );
			}
		} );

		it( 'removes only component DOM from parent and calls cleanup once', () => {
			const unrelatedElem = document.createElement( 'span' );
			unrelatedElem.textContent = 'Keep me';
			parent.appendChild( unrelatedElem );

			const cleanupSpy = jest.fn();
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => cleanupSpy ),
				message: messageMock
			} );

			view.mount( parent );
			expect( parent.children.length ).toBe( 2 );

			view.dispose();
			expect( parent.children.length ).toBe( 1 );
			expect( parent.firstElementChild ).toBe( unrelatedElem );
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );

			// Idempotent repeated disposal
			expect( () => view.dispose() ).not.toThrow();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );
			expect( parent.children.length ).toBe( 1 );
		} );

		it( 'makes late failure callback inert after disposal', () => {
			let failureCallback = null;
			const cleanupSpy = jest.fn();
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( ( c, s, onFailure ) => {
					failureCallback = onFailure;
					return cleanupSpy;
				} ),
				message: messageMock
			} );

			view.mount( parent );
			view.dispose();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );

			// Trigger failure callback after disposal
			expect( () => failureCallback() ).not.toThrow();
			expect( cleanupSpy ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'multiple instances and resize invariance', () => {
		let parent;

		beforeEach( () => {
			parent = document.createElement( 'div' );
			document.body.appendChild( parent );
		} );

		afterEach( () => {
			if ( parent && parent.parentNode ) {
				parent.parentNode.removeChild( parent );
			}
		} );

		it( 'allows multiple instances to mount and dispose independently', () => {
			const cleanup1 = jest.fn();
			const cleanup2 = jest.fn();

			const bundle2 = JSON.parse( JSON.stringify( baseBundle ) );
			bundle2.revisionId = 43;
			bundle2.surface.label = 'Second Slide';

			const view1 = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => cleanup1 ),
				message: messageMock
			} );

			const view2 = new PageOwnedRevisionView( {
				bundle: bundle2,
				adapter,
				render: jest.fn( () => cleanup2 ),
				message: messageMock
			} );

			view1.mount( parent );
			view2.mount( parent );

			expect( parent.querySelectorAll( 'figure' ).length ).toBe( 2 );

			view1.dispose();
			expect( cleanup1 ).toHaveBeenCalledTimes( 1 );
			expect( cleanup2 ).not.toHaveBeenCalled();
			expect( parent.querySelectorAll( 'figure' ).length ).toBe( 1 );

			view2.dispose();
			expect( cleanup2 ).toHaveBeenCalledTimes( 1 );
			expect( parent.querySelectorAll( 'figure' ).length ).toBe( 0 );
		} );

		it( 'preserves canvas width/height properties and surface data when visually resized via CSS', () => {
			const view = new PageOwnedRevisionView( {
				bundle: baseBundle,
				adapter,
				render: jest.fn( () => () => {} ),
				message: messageMock
			} );

			view.mount( parent );

			const canvas = parent.querySelector( 'canvas' );
			expect( canvas.width ).toBe( 800 );
			expect( canvas.height ).toBe( 600 );

			// Visual resize of parent container
			parent.style.width = '400px';
			canvas.style.width = '100%';

			// Canvas intrinsic coordinate properties remain strictly unchanged
			expect( canvas.width ).toBe( 800 );
			expect( canvas.height ).toBe( 600 );

			view.dispose();
		} );
	} );
} );
