'use strict';

const render = require( '../../resources/ext.layers/viewer/PageOwnedRevisionRenderer.js' );
const PageOwnedRevisionView = require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
const PageOwnedSnapshotAdapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );

describe( 'PageOwnedRevisionRenderer', () => {
	describe( 'renderer unit tests', () => {
		let canvas, context, surface, painter, Renderer, failure;

		beforeEach( () => {
			context = { clearRect: jest.fn(), save: jest.fn(), restore: jest.fn(), fillRect: jest.fn() };
			canvas = { width: 800, height: 600, getContext: () => context };
			surface = {
				kind: 'slide',
				canvas: { width: 800, height: 600, backgroundOpacity: 0 },
				layers: [
					{ id: 'top', type: 'text', x: 0.25 },
					{ id: 'hidden', type: 'text', visible: false },
					{ id: 'bottom', type: 'callout', x: 17.75 }
				]
			};
			painter = { drawLayer: jest.fn(), destroy: jest.fn() };
			Renderer = jest.fn( () => painter );
			failure = jest.fn();
		} );

		it( 'uses original dimensions and reverse paint order while preserving zero opacity and coordinates', () => {
			const before = JSON.stringify( surface );
			const dispose = render( canvas, surface, failure, Renderer );
			expect( Renderer ).toHaveBeenCalledWith( context, { canvas, zoom: 1, baseWidth: 800, baseHeight: 600 } );
			expect( painter.drawLayer.mock.calls.map( ( call ) => call[ 0 ].id ) ).toEqual( [ 'bottom', 'top' ] );
			expect( context.globalAlpha ).toBe( 0 );
			expect( JSON.stringify( surface ) ).toBe( before );
			dispose();
			dispose();
			expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
			expect( failure ).not.toHaveBeenCalled();
		} );

		it.each( [ 'image', 'customShape', 'group', 'unknown' ] )(
			'fails explicitly before painting unsupported %s',
			( type ) => {
				surface.layers[ 0 ].type = type;
				render( canvas, surface, failure, Renderer )();
				expect( Renderer ).not.toHaveBeenCalled();
				expect( failure ).toHaveBeenCalledTimes( 1 );
			}
		);

		it( 'fails and cleans up once on painter errors, including failing teardown', () => {
			painter.drawLayer.mockImplementation( () => {
				throw new Error( 'private' );
			} );
			painter.destroy.mockImplementation( () => {
				throw new Error( 'private teardown' );
			} );
			const dispose = render( canvas, surface, failure, Renderer );
			expect( failure ).toHaveBeenCalledWith();
			dispose();
			expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'does not redraw after disposal when fonts finish loading', async () => {
			let resolve;
			const ready = new Promise( ( done ) => {
				resolve = done;
			} );
			const dispose = render( canvas, surface, failure, Renderer, { ready } );
			dispose();
			resolve();
			await ready;
			expect( context.clearRect ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'redraws the same snapshot after font readiness', async () => {
			const ready = Promise.resolve();
			const dispose = render( canvas, surface, failure, Renderer, { ready } );
			await ready;
			expect( context.clearRect ).toHaveBeenCalledTimes( 2 );
			expect( failure ).not.toHaveBeenCalled();
			dispose();
		} );
	} );

	describe( 'PageOwnedRevisionView and PageOwnedRevisionRenderer integration', () => {
		let adapter, messageMock, mockContext, getContextSpy, parent, painter, Renderer;

		const createDeferred = () => {
			let resolve, reject;
			const promise = new Promise( ( res, rej ) => {
				resolve = res;
				reject = rej;
			} );
			return { promise, resolve, reject };
		};

		const createStandardBundle = ( overrides = {} ) => {
			const layers = overrides.layers || [
				{ id: 'layer-top-text', type: 'text', text: 'Top Title', x: 20, y: 30, visible: true },
				{ id: 'layer-mid-rect', type: 'rectangle', x: 40, y: 50, width: 200, height: 100, visible: true },
				{ id: 'layer-bottom-star', type: 'star', x: 60, y: 70, visible: true }
			];
			const readingOrder = overrides.readingOrder !== undefined ?
				overrides.readingOrder :
				layers.map( ( l ) => l.id );

			return {
				owner: 'Test_Project_Page',
				revisionId: 105,
				surface: {
					id: 'slide-overview',
					kind: 'slide',
					label: 'Architecture Overview',
					canvas: {
						width: 960,
						height: 540,
						backgroundColor: '#f0f4f8',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					...overrides,
					layers,
					readingOrder
				}
			};
		};

		beforeEach( () => {
			adapter = new PageOwnedSnapshotAdapter();
			parent = document.createElement( 'div' );
			document.body.appendChild( parent );

			messageMock = jest.fn( ( key, ...args ) => {
				if ( key === 'layers-page-history-caption' ) {
					return `Page ${ args[ 0 ] }, revision ${ args[ 1 ] } — ${ args[ 2 ] }`;
				}
				if ( key === 'layers-page-history-render-failed' ) {
					return 'This saved drawing could not be displayed.';
				}
				return `msg:${ key }`;
			} );

			mockContext = {
				clearRect: jest.fn(),
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: '',
				globalAlpha: 1
			};

			getContextSpy = jest.spyOn( HTMLCanvasElement.prototype, 'getContext' ).mockImplementation( function ( type ) {
				if ( type === '2d' ) {
					return mockContext;
				}
				return null;
			} );

			painter = {
				drawLayer: jest.fn(),
				destroy: jest.fn()
			};

			Renderer = jest.fn( () => painter );
		} );

		afterEach( () => {
			if ( getContextSpy ) {
				getContextSpy.mockRestore();
			}
			if ( parent && parent.parentNode ) {
				parent.parentNode.removeChild( parent );
			}
		} );

		describe( 'mounting, dimensions, caption, painter calls and snapshot immutability', () => {
			it( 'mounts view, allocates canvas with exact dimensions, sets caption and draws in reverse order', () => {
				const bundle = createStandardBundle();
				const beforeJson = JSON.stringify( bundle );

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure ).not.toBeNull();

				const caption = figure.querySelector( '.ext-layers-historical-caption' );
				expect( caption.textContent ).toBe( 'Page Test_Project_Page, revision 105 — Architecture Overview' );

				const canvas = figure.querySelector( '.ext-layers-historical-canvas' );
				expect( canvas ).not.toBeNull();
				expect( canvas.width ).toBe( 960 );
				expect( canvas.height ).toBe( 540 );
				expect( canvas.getAttribute( 'aria-label' ) ).toBe(
					'Page Test_Project_Page, revision 105 — Architecture Overview'
				);
				expect( canvas.style.maxWidth ).toBe( '100%' );
				expect( canvas.style.height ).toBe( 'auto' );

				const status = figure.querySelector( '.ext-layers-historical-status' );
				expect( status.textContent ).toBe( '' );

				expect( Renderer ).toHaveBeenCalledTimes( 1 );
				expect( Renderer ).toHaveBeenCalledWith( mockContext, {
					canvas,
					zoom: 1,
					baseWidth: 960,
					baseHeight: 540
				} );

				expect( mockContext.clearRect ).toHaveBeenCalledWith( 0, 0, 960, 540 );
				expect( mockContext.fillRect ).toHaveBeenCalledWith( 0, 0, 960, 540 );
				expect( mockContext.fillStyle ).toBe( '#f0f4f8' );
				expect( mockContext.globalAlpha ).toBe( 1 );

				expect( painter.drawLayer.mock.calls.map( ( call ) => call[ 0 ].id ) ).toEqual( [
					'layer-bottom-star',
					'layer-mid-rect',
					'layer-top-text'
				] );

				expect( JSON.stringify( bundle ) ).toBe( beforeJson );

				view.dispose();
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
				expect( parent.children.length ).toBe( 0 );
			} );

			it( 'preserves caption fallback to surface id when label is absent or non-string, but preserves empty label', () => {
				const bundleNoLabel = createStandardBundle();
				delete bundleNoLabel.surface.label;

				const view1 = new PageOwnedRevisionView( {
					bundle: bundleNoLabel,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );
				view1.mount( parent );
				expect( parent.querySelector( '.ext-layers-historical-caption' ).textContent ).toBe(
					'Page Test_Project_Page, revision 105 — slide-overview'
				);
				view1.dispose();

				const bundleEmptyLabel = createStandardBundle( { label: '' } );
				const view2 = new PageOwnedRevisionView( {
					bundle: bundleEmptyLabel,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );
				view2.mount( parent );
				expect( parent.querySelector( '.ext-layers-historical-caption' ).textContent ).toBe(
					'Page Test_Project_Page, revision 105 — '
				);
				view2.dispose();
			} );

			it( 'supports all valid synchronous text and vector layer types without error', () => {
				const supportedTypes = [
					'text', 'textbox', 'callout', 'rectangle', 'circle',
					'ellipse', 'polygon', 'star', 'line', 'arrow', 'path', 'dimension', 'angleDimension'
				];
				const layers = supportedTypes.map( ( type, index ) => ( {
					id: `layer-${ index }-${ type }`,
					type,
					x: 10 + index,
					y: 10 + index,
					visible: true
				} ) );

				const bundle = createStandardBundle( { layers } );
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( painter.drawLayer ).toHaveBeenCalledTimes( supportedTypes.length );
				const paintedIds = painter.drawLayer.mock.calls.map( ( call ) => call[ 0 ].id );
				expect( paintedIds ).toEqual( layers.map( ( l ) => l.id ).reverse() );
				expect( parent.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();

				view.dispose();
			} );

			it( 'guarantees caller bundle and surface remain strictly immutable even if painter attempts mutations', () => {
				const bundle = createStandardBundle();
				const originalX = bundle.surface.layers[ 0 ].x;

				painter.drawLayer.mockImplementation( ( layerCopy ) => {
					layerCopy.x = 99999;
					layerCopy.mutated = true;
				} );

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) => {
						surfaceCopy.canvas.width = 99999;
						return render( canvas, surfaceCopy, handleFailure, Renderer );
					},
					message: messageMock
				} );

				view.mount( parent );

				expect( bundle.surface.canvas.width ).toBe( 960 );
				expect( bundle.surface.layers[ 0 ].x ).toBe( originalX );
				expect( bundle.surface.layers[ 0 ].mutated ).toBeUndefined();

				view.dispose();
			} );
		} );

		describe( 'painter errors, constructor throw, teardown throw and unavailable context', () => {
			it( 'handles drawLayer error: removes canvas, shows fixed host failure, retains caption and cleans up once', () => {
				painter.drawLayer.mockImplementation( () => {
					throw new Error( 'Internal GPU hardware fault 0xDEADBEEF' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure ).not.toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();

				const caption = figure.querySelector( '.ext-layers-historical-caption' );
				expect( caption ).not.toBeNull();
				expect( caption.textContent ).toBe( 'Page Test_Project_Page, revision 105 — Architecture Overview' );

				const status = figure.querySelector( '.ext-layers-historical-status' );
				expect( status.textContent ).toBe( 'This saved drawing could not be displayed.' );
				expect( figure.textContent ).not.toContain( '0xDEADBEEF' );
				expect( figure.textContent ).not.toContain( 'GPU' );

				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );

				view.dispose();
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
			} );

			it( 'handles unavailable canvas context (getContext returns null): removes canvas and shows failure', () => {
				getContextSpy.mockReturnValue( null );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( figure.querySelector( '.ext-layers-historical-caption' ).textContent ).toBe(
					'Page Test_Project_Page, revision 105 — Architecture Overview'
				);
				expect( Renderer ).not.toHaveBeenCalled();

				view.dispose();
			} );

			it( 'handles canvas getContext throwing an unexpected exception', () => {
				getContextSpy.mockImplementation( () => {
					throw new Error( 'SecurityException: canvas tainted' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( figure.textContent ).not.toContain( 'SecurityException' );

				view.dispose();
			} );

			it( 'handles Renderer constructor throwing: removes canvas, shows failure and retains caption', () => {
				Renderer = jest.fn( () => {
					throw new Error( 'Renderer init crash' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( figure.textContent ).not.toContain( 'crash' );

				view.dispose();
			} );

			it( 'handles teardown throwing an exception on failure without leaking diagnostics or failing mount', () => {
				painter.drawLayer.mockImplementation( () => {
					throw new Error( 'Draw failed' );
				} );
				painter.destroy.mockImplementation( () => {
					throw new Error( 'Teardown failure diagnostic' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				expect( () => view.mount( parent ) ).not.toThrow();

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( figure.textContent ).not.toContain( 'Teardown failure' );
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );

				expect( () => view.dispose() ).not.toThrow();
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
			} );

			it( 'handles teardown throwing an exception on view.dispose() without throwing to caller', () => {
				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );
				painter.destroy.mockImplementation( () => {
					throw new Error( 'Disposal error' );
				} );

				expect( () => view.dispose() ).not.toThrow();
				expect( parent.children.length ).toBe( 0 );
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );

				expect( () => view.dispose() ).not.toThrow();
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
			} );
		} );

		describe( 'background visibility, opacity, colors and context save/restore balance', () => {
			it( 'skips background fill and save/restore when backgroundVisible is explicitly false', () => {
				const bundle = createStandardBundle();
				bundle.surface.canvas.backgroundVisible = false;

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.fillRect ).not.toHaveBeenCalled();
				expect( mockContext.save ).not.toHaveBeenCalled();
				expect( mockContext.restore ).not.toHaveBeenCalled();

				view.dispose();
			} );

			it( 'skips background fill and save/restore when backgroundVisible is explicitly 0', () => {
				const bundle = createStandardBundle();
				bundle.surface.canvas.backgroundVisible = 0;

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.fillRect ).not.toHaveBeenCalled();
				expect( mockContext.save ).not.toHaveBeenCalled();
				expect( mockContext.restore ).not.toHaveBeenCalled();

				view.dispose();
			} );

			it( 'paints background with globalAlpha 0 when backgroundOpacity is explicitly 0', () => {
				const bundle = createStandardBundle();
				bundle.surface.canvas.backgroundOpacity = 0;

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.save ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.globalAlpha ).toBe( 0 );
				expect( mockContext.fillRect ).toHaveBeenCalledWith( 0, 0, 960, 540 );
				expect( mockContext.restore ).toHaveBeenCalledTimes( 1 );

				view.dispose();
			} );

			it.each( [
				[ 'empty string', '' ],
				[ 'transparent', 'transparent' ],
				[ 'none', 'none' ]
			] )( 'skips background fill when backgroundColor is %s', ( _, color ) => {
				const bundle = createStandardBundle();
				bundle.surface.canvas.backgroundColor = color;

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.fillRect ).not.toHaveBeenCalled();
				expect( mockContext.save ).not.toHaveBeenCalled();
				expect( mockContext.restore ).not.toHaveBeenCalled();

				view.dispose();
			} );

			it( 'applies default #ffffff and opacity 1 when background properties are omitted', () => {
				const bundle = createStandardBundle();
				bundle.surface.canvas = { width: 800, height: 600 };

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.save ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.fillStyle ).toBe( '#ffffff' );
				expect( mockContext.globalAlpha ).toBe( 1 );
				expect( mockContext.fillRect ).toHaveBeenCalledWith( 0, 0, 800, 600 );
				expect( mockContext.restore ).toHaveBeenCalledTimes( 1 );

				view.dispose();
			} );

			it( 'guarantees context save and restore stay balanced when fillRect throws', () => {
				mockContext.fillRect.mockImplementation( () => {
					throw new Error( 'fillRect crash' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.save ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.restore ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.save.mock.calls.length ).toBe( mockContext.restore.mock.calls.length );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);

				view.dispose();
			} );

			it( 'guarantees context save and restore stay balanced when painter drawLayer throws', () => {
				painter.drawLayer.mockImplementation( () => {
					throw new Error( 'DrawLayer crash' );
				} );

				const bundle = createStandardBundle();
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.save ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.restore ).toHaveBeenCalledTimes( 1 );
				expect( mockContext.save.mock.calls.length ).toBe( mockContext.restore.mock.calls.length );

				view.dispose();
			} );
		} );

		describe( 'invisible layers, unsupported types and group membership rejection', () => {
			it( 'skips invisible layers with visible: false or visible: 0 while drawing visible layers', () => {
				const layers = [
					{ id: 'layer-v-true', type: 'text', text: 'Visible true', x: 1, y: 1, visible: true },
					{ id: 'layer-v-false', type: 'text', text: 'Hidden false', x: 2, y: 2, visible: false },
					{ id: 'layer-v-zero', type: 'rectangle', x: 3, y: 3, visible: 0 },
					{ id: 'layer-v-default', type: 'circle', x: 4, y: 4 }
				];

				const bundle = createStandardBundle( { layers } );
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( painter.drawLayer ).toHaveBeenCalledTimes( 2 );
				expect( painter.drawLayer.mock.calls.map( ( call ) => call[ 0 ].id ) ).toEqual( [
					'layer-v-default',
					'layer-v-true'
				] );

				view.dispose();
			} );

			it.each( [ 'image', 'customShape', 'group', 'marker', 'unknown-vector' ] )(
				'rejects unsupported type %s before painter construction even when visible: false',
				( type ) => {
					const layers = [
						{ id: 'layer-unsupported', type, x: 10, y: 10, visible: false }
					];

					const bundle = createStandardBundle( { layers } );
					const view = new PageOwnedRevisionView( {
						bundle,
						adapter,
						render: ( canvas, surfaceCopy, handleFailure ) =>
							render( canvas, surfaceCopy, handleFailure, Renderer ),
						message: messageMock
					} );

					view.mount( parent );

					expect( Renderer ).not.toHaveBeenCalled();

					const figure = parent.querySelector( '.ext-layers-historical-view' );
					expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
					expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
						'This saved drawing could not be displayed.'
					);

					view.dispose();
				}
			);

			it.each( [ 'image', 'customShape', 'group', 'marker', 'unknown-vector' ] )(
				'rejects unsupported type %s before painter construction even when visible: 0',
				( type ) => {
					const layers = [
						{ id: 'layer-unsupported-zero', type, x: 10, y: 10, visible: 0 }
					];

					const bundle = createStandardBundle( { layers } );
					const view = new PageOwnedRevisionView( {
						bundle,
						adapter,
						render: ( canvas, surfaceCopy, handleFailure ) =>
							render( canvas, surfaceCopy, handleFailure, Renderer ),
						message: messageMock
					} );

					view.mount( parent );

					expect( Renderer ).not.toHaveBeenCalled();

					const figure = parent.querySelector( '.ext-layers-historical-view' );
					expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();

					view.dispose();
				}
			);

			it( 'rejects layer with parentGroup before painter construction even when visible: false', () => {
				const layers = [
					{ id: 'grouped-text', type: 'text', parentGroup: 'group-alpha', visible: false }
				];

				const bundle = createStandardBundle( { layers } );
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( Renderer ).not.toHaveBeenCalled();
				expect( parent.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( parent.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);

				view.dispose();
			} );

			it( 'rejects layer with parentId before painter construction even when visible: 0', () => {
				const layers = [
					{ id: 'parent-id-rect', type: 'rectangle', parentId: 'parent-container', visible: 0 }
				];

				const bundle = createStandardBundle( { layers } );
				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer ),
					message: messageMock
				} );

				view.mount( parent );

				expect( Renderer ).not.toHaveBeenCalled();
				expect( parent.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();

				view.dispose();
			} );
		} );

		describe( 'deferred fonts.ready success, rejection and disposal races', () => {
			it( 'redraws the exact same isolated snapshot after deferred fonts.ready resolves', async () => {
				const deferred = createDeferred();
				const bundle = createStandardBundle();

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer, { ready: deferred.promise } ),
					message: messageMock
				} );

				view.mount( parent );

				expect( mockContext.clearRect ).toHaveBeenCalledTimes( 1 );
				expect( painter.drawLayer ).toHaveBeenCalledTimes( 3 );

				deferred.resolve();
				await deferred.promise;

				expect( mockContext.clearRect ).toHaveBeenCalledTimes( 2 );
				expect( painter.drawLayer ).toHaveBeenCalledTimes( 6 );
				expect( parent.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();
				expect( parent.querySelector( '.ext-layers-historical-status' ).textContent ).toBe( '' );

				view.dispose();
			} );

			it( 'fails the host when deferred fonts.ready rejects', async () => {
				const deferred = createDeferred();
				const bundle = createStandardBundle();

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer, { ready: deferred.promise } ),
					message: messageMock
				} );

				view.mount( parent );

				expect( parent.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();

				deferred.reject( new Error( 'Font load failed: network offline' ) );
				await deferred.promise.catch( () => {} );

				const figure = parent.querySelector( '.ext-layers-historical-view' );
				expect( figure.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( figure.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( figure.querySelector( '.ext-layers-historical-caption' ).textContent ).toBe(
					'Page Test_Project_Page, revision 105 — Architecture Overview'
				);
				expect( figure.textContent ).not.toContain( 'network offline' );
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );

				view.dispose();
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );
			} );

			it( 'makes deferred font resolution completely inert if view is disposed before resolution', async () => {
				const deferred = createDeferred();
				const bundle = createStandardBundle();

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer, { ready: deferred.promise } ),
					message: messageMock
				} );

				view.mount( parent );
				expect( mockContext.clearRect ).toHaveBeenCalledTimes( 1 );

				view.dispose();
				expect( parent.children.length ).toBe( 0 );
				expect( painter.destroy ).toHaveBeenCalledTimes( 1 );

				deferred.resolve();
				await deferred.promise;

				expect( mockContext.clearRect ).toHaveBeenCalledTimes( 1 );
				expect( painter.drawLayer ).toHaveBeenCalledTimes( 3 );
				expect( parent.children.length ).toBe( 0 );
			} );

			it( 'makes deferred font rejection completely inert if view is disposed before rejection', async () => {
				const deferred = createDeferred();
				const bundle = createStandardBundle();

				const view = new PageOwnedRevisionView( {
					bundle,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer, { ready: deferred.promise } ),
					message: messageMock
				} );

				view.mount( parent );
				view.dispose();

				deferred.reject( new Error( 'Late font failure after disposal' ) );
				await deferred.promise.catch( () => {} );

				expect( messageMock ).not.toHaveBeenCalledWith( 'layers-page-history-render-failed' );
				expect( parent.children.length ).toBe( 0 );
			} );
		} );

		describe( 'multiple instances and isolation', () => {
			it( 'allows multiple view instances to mount and render independently without sharing state', () => {
				const parent1 = document.createElement( 'div' );
				const parent2 = document.createElement( 'div' );
				document.body.appendChild( parent1 );
				document.body.appendChild( parent2 );

				const painter1 = { drawLayer: jest.fn(), destroy: jest.fn() };
				const painter2 = { drawLayer: jest.fn(), destroy: jest.fn() };
				const Renderer1 = jest.fn( () => painter1 );
				const Renderer2 = jest.fn( () => painter2 );

				const bundle1 = createStandardBundle( {
					canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true },
					layers: [ { id: 'p1-l1', type: 'text', text: 'Inst 1', visible: true } ]
				} );
				const bundle2 = createStandardBundle( {
					canvas: { width: 1024, height: 768, backgroundColor: '#000000', backgroundVisible: true },
					layers: [
						{ id: 'p2-l1', type: 'rectangle', visible: true },
						{ id: 'p2-l2', type: 'circle', visible: true }
					]
				} );

				const view1 = new PageOwnedRevisionView( {
					bundle: bundle1,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer1 ),
					message: messageMock
				} );
				const view2 = new PageOwnedRevisionView( {
					bundle: bundle2,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer2 ),
					message: messageMock
				} );

				view1.mount( parent1 );
				view2.mount( parent2 );

				const canvas1 = parent1.querySelector( '.ext-layers-historical-canvas' );
				const canvas2 = parent2.querySelector( '.ext-layers-historical-canvas' );

				expect( canvas1.width ).toBe( 800 );
				expect( canvas2.width ).toBe( 1024 );

				expect( painter1.drawLayer ).toHaveBeenCalledTimes( 1 );
				expect( painter2.drawLayer ).toHaveBeenCalledTimes( 2 );

				view1.dispose();
				expect( parent1.children.length ).toBe( 0 );
				expect( painter1.destroy ).toHaveBeenCalledTimes( 1 );

				expect( parent2.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();
				expect( painter2.destroy ).not.toHaveBeenCalled();

				view2.dispose();
				expect( parent2.children.length ).toBe( 0 );
				expect( painter2.destroy ).toHaveBeenCalledTimes( 1 );

				document.body.removeChild( parent1 );
				document.body.removeChild( parent2 );
			} );

			it( 'isolates failure between multiple instances: failure in one does not affect the other', async () => {
				const parent1 = document.createElement( 'div' );
				const parent2 = document.createElement( 'div' );
				document.body.appendChild( parent1 );
				document.body.appendChild( parent2 );

				const deferred1 = createDeferred();
				const deferred2 = createDeferred();

				const painter1 = { drawLayer: jest.fn(), destroy: jest.fn() };
				const painter2 = { drawLayer: jest.fn(), destroy: jest.fn() };
				const Renderer1 = jest.fn( () => painter1 );
				const Renderer2 = jest.fn( () => painter2 );

				const bundle1 = createStandardBundle();
				const bundle2 = createStandardBundle();

				const view1 = new PageOwnedRevisionView( {
					bundle: bundle1,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer1, { ready: deferred1.promise } ),
					message: messageMock
				} );
				const view2 = new PageOwnedRevisionView( {
					bundle: bundle2,
					adapter,
					render: ( canvas, surfaceCopy, handleFailure ) =>
						render( canvas, surfaceCopy, handleFailure, Renderer2, { ready: deferred2.promise } ),
					message: messageMock
				} );

				view1.mount( parent1 );
				view2.mount( parent2 );

				deferred1.reject( new Error( 'Font fail 1' ) );
				await deferred1.promise.catch( () => {} );

				expect( parent1.querySelector( '.ext-layers-historical-canvas' ) ).toBeNull();
				expect( parent1.querySelector( '.ext-layers-historical-status' ).textContent ).toBe(
					'This saved drawing could not be displayed.'
				);
				expect( painter1.destroy ).toHaveBeenCalledTimes( 1 );

				expect( parent2.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();
				expect( parent2.querySelector( '.ext-layers-historical-status' ).textContent ).toBe( '' );
				expect( painter2.destroy ).not.toHaveBeenCalled();

				deferred2.resolve();
				await deferred2.promise;

				expect( painter2.drawLayer ).toHaveBeenCalledTimes( 6 );
				expect( parent2.querySelector( '.ext-layers-historical-canvas' ) ).not.toBeNull();

				view1.dispose();
				view2.dispose();

				document.body.removeChild( parent1 );
				document.body.removeChild( parent2 );
			} );
		} );
	} );
} );
