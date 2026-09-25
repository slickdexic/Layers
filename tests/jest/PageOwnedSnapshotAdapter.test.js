/**
 * Tests for PageOwnedSnapshotAdapter
 */
/* global BigInt */
'use strict';

window.Layers = window.Layers || {};
window.Layers.Editor = window.Layers.Editor || {};

const PageOwnedSnapshotAdapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const mixedDocumentFixture = require( '../fixtures/revisions/mixed-document-v1.json' );
const slideDocumentFixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'PageOwnedSnapshotAdapter', () => {
	let adapter;

	beforeEach( () => {
		adapter = new PageOwnedSnapshotAdapter();
	} );

	it( 'preserves own __proto__ JSON keys without changing clone prototypes', () => {
		const snapshot = JSON.parse( JSON.stringify( slideDocumentFixture ) );
		snapshot.extra = JSON.parse( '{"__proto__":{"flag":"preserve"},"constructor":"data"}' );
		const state = adapter.toEditorState( snapshot, 'presentation' );
		state.layers[ 0 ].extra = snapshot.extra;
		const result = adapter.withEditorState( snapshot, 'presentation', state );
		for ( const object of [ result.extra, result.surfaces[ 0 ].layers[ 0 ].extra ] ) {
			expect( Object.getPrototypeOf( object ) ).toBe( Object.prototype );
			expect( Object.prototype.hasOwnProperty.call( object, '__proto__' ) ).toBe( true );
			expect( JSON.stringify( object ) ).toBe( JSON.stringify( snapshot.extra ) );
			expect( object ).not.toBe( snapshot.extra );
		}
		expect( {}.flag ).toBeUndefined();
	} );

	it.each( [ 'schemaVersion', 'surfaces' ] )( 'rejects root %s accessors without executing them', ( key ) => {
		const snapshot = JSON.parse( JSON.stringify( slideDocumentFixture ) );
		const getter = jest.fn( () => { throw new Error( 'SECRET getter diagnostic' ); } );
		Object.defineProperty( snapshot, key, { get: getter, enumerable: true } );
		for ( const invoke of [
			() => adapter.toEditorState( snapshot, 'presentation' ),
			() => adapter.withEditorState( snapshot, 'presentation', { canvas: {}, layers: [] } )
		] ) {
			expect( invoke ).toThrow( 'Invalid editor snapshot' );
		}
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'redacts reflection exceptions instead of leaking raw diagnostics', () => {
		const value = new Proxy( {}, {
			getPrototypeOf() { throw new Error( 'SECRET reflection diagnostic' ); }
		} );
		for ( const invoke of [
			() => adapter.toEditorState( value, 'presentation' ),
			() => adapter.withEditorState( slideDocumentFixture, 'presentation', value )
		] ) {
			try {
				invoke();
				throw new Error( 'Expected rejection' );
			} catch ( error ) {
				expect( error.code ).toBe( 'layers-invalid-editor-snapshot' );
				expect( error.message ).toBe( 'Invalid editor snapshot' );
				expect( error.stack ).not.toContain( 'SECRET' );
			}
		}
	} );

	describe( 'constructor and exports', () => {
		it( 'should instantiate as a stateless class', () => {
			expect( adapter ).toBeInstanceOf( PageOwnedSnapshotAdapter );
		} );

		it( 'should export to window.Layers.Editor.PageOwnedSnapshotAdapter', () => {
			expect( window.Layers.Editor.PageOwnedSnapshotAdapter ).toBe( PageOwnedSnapshotAdapter );
		} );

		it( 'should export via CommonJS module.exports', () => {
			expect( typeof PageOwnedSnapshotAdapter ).toBe( 'function' );
		} );
	} );

	describe( 'toEditorState extraction', () => {
		it( 'should extract slide surface state from mixed document fixture', () => {
			const state = adapter.toEditorState( mixedDocumentFixture, 'presentation' );

			expect( state ).toBeDefined();
			expect( Object.keys( state ).sort() ).toEqual( [ 'canvas', 'layers' ] );
			expect( state.canvas ).toEqual( {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			} );
			expect( state.layers ).toHaveLength( 1 );
			expect( state.layers[ 0 ] ).toEqual( {
				id: 'title',
				type: 'text',
				x: 40,
				y: 60,
				text: 'Visual ideas — 世界',
				fontSize: 24,
				color: '#000000'
			} );
		} );

		it( 'should extract image surface state from mixed document fixture', () => {
			const state = adapter.toEditorState( mixedDocumentFixture, 'diagram' );

			expect( state ).toBeDefined();
			expect( Object.keys( state ).sort() ).toEqual( [ 'canvas', 'layers' ] );
			expect( state.canvas ).toEqual( {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			} );
			expect( state.layers ).toHaveLength( 1 );
			expect( state.layers[ 0 ].id ).toBe( 'title' );
		} );

		it( 'should extract PDF surface state from mixed document fixture', () => {
			const state = adapter.toEditorState( mixedDocumentFixture, 'reference' );

			expect( state ).toBeDefined();
			expect( Object.keys( state ).sort() ).toEqual( [ 'canvas', 'layers' ] );
			expect( state.canvas.width ).toBe( 800 );
			expect( state.layers ).toHaveLength( 1 );
			expect( state.layers[ 0 ].id ).toBe( 'title' );
		} );

		it( 'should extract slide surface state from slide document fixture', () => {
			const state = adapter.toEditorState( slideDocumentFixture, 'presentation' );

			expect( state ).toBeDefined();
			expect( state.canvas.width ).toBe( 800 );
			expect( state.layers ).toHaveLength( 1 );
			expect( state.layers[ 0 ].text ).toBe( 'Visual ideas — 世界' );
		} );

		it( 'should guarantee alias isolation so mutating returned data does not mutate input snapshot', () => {
			const snapshot = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			const state = adapter.toEditorState( snapshot, 'presentation' );

			// Mutate returned state
			state.canvas.width = 1920;
			state.canvas.extraProp = 'mutated';
			state.layers[ 0 ].text = 'mutated text';
			state.layers.push( { id: 'new-layer', type: 'line' } );

			// Snapshot must remain completely unchanged
			expect( snapshot.surfaces[ 0 ].canvas.width ).toBe( 800 );
			expect( snapshot.surfaces[ 0 ].canvas.extraProp ).toBeUndefined();
			expect( snapshot.surfaces[ 0 ].layers ).toHaveLength( 1 );
			expect( snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'Visual ideas — 世界' );

			// Subsequent calls return unmutated data
			const state2 = adapter.toEditorState( snapshot, 'presentation' );
			expect( state2.canvas.width ).toBe( 800 );
			expect( state2.layers ).toHaveLength( 1 );
		} );

		it( 'should reject unknown surfaceId with layers-invalid-editor-snapshot', () => {
			expect( () => adapter.toEditorState( mixedDocumentFixture, 'nonexistent' ) ).toThrow();
			try {
				adapter.toEditorState( mixedDocumentFixture, 'nonexistent' );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
				expect( err.message ).toBe( 'Invalid editor snapshot' );
			}
		} );

		it( 'should reject non-string or empty surfaceId with layers-invalid-editor-snapshot', () => {
			for ( const badId of [ '', null, undefined, 123, true, {}, [] ] ) {
				expect( () => adapter.toEditorState( mixedDocumentFixture, badId ) ).toThrow();
				try {
					adapter.toEditorState( mixedDocumentFixture, badId );
				} catch ( err ) {
					expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
				}
			}
		} );

		it( 'should match surface ID literally without case conversion or whitespace trimming', () => {
			expect( () => adapter.toEditorState( mixedDocumentFixture, 'Presentation' ) ).toThrow();
			expect( () => adapter.toEditorState( mixedDocumentFixture, ' presentation' ) ).toThrow();
			expect( () => adapter.toEditorState( mixedDocumentFixture, 'presentation ' ) ).toThrow();
		} );
	} );

	describe( 'withEditorState replacement and document preservation', () => {
		it( 'should update slide surface while preserving all other surfaces and document fields in mixed document', () => {
			const original = JSON.parse( JSON.stringify( mixedDocumentFixture ) );
			const replacementState = {
				canvas: {
					width: 1024,
					height: 768,
					backgroundColor: '#000000',
					backgroundVisible: false,
					backgroundOpacity: 0.5
				},
				layers: [
					{
						id: 'title',
						type: 'text',
						x: 50,
						y: 80,
						text: 'Updated slide — 日本語',
						fontSize: 32,
						color: '#ffffff'
					}
				]
			};

			const updated = adapter.withEditorState( original, 'presentation', replacementState );

			// Verify updated surface
			expect( updated.surfaces[ 0 ].id ).toBe( 'presentation' );
			expect( updated.surfaces[ 0 ].kind ).toBe( 'slide' );
			expect( updated.surfaces[ 0 ].label ).toBe( 'Welcome' );
			expect( updated.surfaces[ 0 ].canvas ).toEqual( replacementState.canvas );
			expect( updated.surfaces[ 0 ].layers ).toEqual( replacementState.layers );
			expect( updated.surfaces[ 0 ].readingOrder ).toEqual( [ 'title' ] );

			// Verify other surfaces are completely preserved
			expect( updated.surfaces[ 1 ] ).toEqual( original.surfaces[ 1 ] );
			expect( updated.surfaces[ 2 ] ).toEqual( original.surfaces[ 2 ] );

			// Verify root schemaVersion
			expect( updated.schemaVersion ).toBe( 1 );

			// Verify input was not mutated
			expect( original.surfaces[ 0 ].canvas.width ).toBe( 800 );
			expect( original.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'Visual ideas — 世界' );
		} );

		it( 'should update image surface while preserving source metadata and readingOrder', () => {
			const original = JSON.parse( JSON.stringify( mixedDocumentFixture ) );
			const replacementState = {
				canvas: {
					width: 800,
					height: 600,
					backgroundColor: '#ffffff',
					backgroundVisible: true,
					backgroundOpacity: 1
				},
				layers: [
					{
						id: 'title',
						type: 'text',
						x: 10,
						y: 20,
						text: 'Updated Diagram Annotation',
						fontSize: 18,
						color: '#ff0000'
					}
				]
			};

			const updated = adapter.withEditorState( original, 'diagram', replacementState );

			const diagramSurface = updated.surfaces[ 1 ];
			expect( diagramSurface.id ).toBe( 'diagram' );
			expect( diagramSurface.kind ).toBe( 'image' );
			expect( diagramSurface.label ).toBe( 'Annotated diagram' );
			expect( diagramSurface.source ).toEqual( {
				repository: 'local',
				fileTitle: 'File:Diagram.png',
				timestamp: '20260906120000',
				sha1: '0000000000000000000000000000000',
				page: 1
			} );
			expect( diagramSurface.readingOrder ).toEqual( [ 'title' ] );
			expect( diagramSurface.layers ).toEqual( replacementState.layers );

			// Surfaces 0 and 2 unchanged
			expect( updated.surfaces[ 0 ] ).toEqual( original.surfaces[ 0 ] );
			expect( updated.surfaces[ 2 ] ).toEqual( original.surfaces[ 2 ] );
		} );

		it( 'should update PDF surface while preserving PDF source and page metadata', () => {
			const original = JSON.parse( JSON.stringify( mixedDocumentFixture ) );
			const replacementState = {
				canvas: {
					width: 800,
					height: 600,
					backgroundColor: '#ffffff',
					backgroundVisible: true,
					backgroundOpacity: 1
				},
				layers: [
					{
						id: 'title',
						type: 'text',
						x: 30,
						y: 40,
						text: 'Updated PDF Annotation',
						fontSize: 16,
						color: '#0000ff'
					}
				]
			};

			const updated = adapter.withEditorState( original, 'reference', replacementState );

			const pdfSurface = updated.surfaces[ 2 ];
			expect( pdfSurface.id ).toBe( 'reference' );
			expect( pdfSurface.kind ).toBe( 'pdf' );
			expect( pdfSurface.label ).toBe( 'Reference sheet' );
			expect( pdfSurface.source ).toEqual( {
				repository: 'local',
				fileTitle: 'File:Reference.pdf',
				timestamp: '20260906120000',
				sha1: '1111111111111111111111111111111',
				page: 2
			} );
			expect( pdfSurface.readingOrder ).toEqual( [ 'title' ] );
			expect( pdfSurface.layers ).toEqual( replacementState.layers );

			// Surfaces 0 and 1 unchanged
			expect( updated.surfaces[ 0 ] ).toEqual( original.surfaces[ 0 ] );
			expect( updated.surfaces[ 1 ] ).toEqual( original.surfaces[ 1 ] );
		} );

		it( 'should guarantee full alias isolation across replacement', () => {
			const original = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			const state = {
				canvas: { width: 1200, height: 900 },
				layers: [ { id: 'title', text: 'Isolation test' } ]
			};

			const updated = adapter.withEditorState( original, 'presentation', state );

			// Mutate state after the call
			state.canvas.width = 9999;
			state.layers[ 0 ].text = 'mutated state';

			expect( updated.surfaces[ 0 ].canvas.width ).toBe( 1200 );
			expect( updated.surfaces[ 0 ].layers[ 0 ].text ).toBe('Isolation test' );

			// Mutate updated document
			updated.surfaces[ 0 ].canvas.width = 5555;
			updated.surfaces[ 0 ].layers[ 0 ].text = 'mutated updated';

			expect( original.surfaces[ 0 ].canvas.width ).toBe( 800 );
			expect( original.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'Visual ideas — 世界' );
			expect( state.canvas.width ).toBe( 9999 );
		} );
	} );

	describe( 'editor state validation and boundaries', () => {
		it( 'should reject non-object state', () => {
			for ( const invalid of [ null, undefined, 'string', 123, true, [] ] ) {
				expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', invalid ) ).toThrow();
				try {
					adapter.withEditorState( slideDocumentFixture, 'presentation', invalid );
				} catch ( err ) {
					expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
				}
			}
		} );

		it( 'should reject state missing canvas or layers', () => {
			expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', { canvas: {} } ) ).toThrow();
			expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', { layers: [] } ) ).toThrow();
		} );

		it( 'should reject state with unknown or extra fields', () => {
			const extraFields = [
				{ canvas: {}, layers: [ { id: 'title' } ], extraField: 'bad' },
				{ canvas: {}, layers: [ { id: 'title' } ], readingOrder: [ 'title' ] },
				{ canvas: {}, layers: [ { id: 'title' } ], id: 'presentation' },
				{ canvas: {}, layers: [ { id: 'title' } ], label: 'New Label' },
				{ canvas: {}, layers: [ { id: 'title' } ], source: {} },
				{ canvas: {}, layers: [ { id: 'title' } ], schemaVersion: 1 }
			];

			for ( const badState of extraFields ) {
				expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', badState ) ).toThrow();
				try {
					adapter.withEditorState( slideDocumentFixture, 'presentation', badState );
				} catch ( err ) {
					expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
				}
			}
		} );

		it( 'should reject state with non-plain-object canvas', () => {
			for ( const badCanvas of [ null, undefined, 'string', 123, true, [], new Date() ] ) {
				const state = { canvas: badCanvas, layers: [ { id: 'title' } ] };
				expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', state ) ).toThrow();
			}
		} );

		it( 'should reject state with non-array layers', () => {
			for ( const badLayers of [ null, undefined, 'string', 123, true, {} ] ) {
				const state = { canvas: {}, layers: badLayers };
				expect( () => adapter.withEditorState( slideDocumentFixture, 'presentation', state ) ).toThrow();
			}
		} );
	} );

	describe( 'reading order retention and verification', () => {
		it( 'should reject replacement that removes a layer referenced in readingOrder', () => {
			const original = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			// original has readingOrder: ['title']
			const replacementState = {
				canvas: { width: 800, height: 600 },
				layers: [
					{ id: 'different-layer', type: 'text', text: 'Title was removed' }
				]
			};

			expect( () => adapter.withEditorState( original, 'presentation', replacementState ) ).toThrow();
			try {
				adapter.withEditorState( original, 'presentation', replacementState );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
			}
		} );

		it( 'should reject replacement that duplicates a layer referenced in readingOrder', () => {
			const original = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			// original has readingOrder: ['title']
			const replacementState = {
				canvas: { width: 800, height: 600 },
				layers: [
					{ id: 'title', type: 'text', text: 'First title' },
					{ id: 'title', type: 'text', text: 'Duplicate title' }
				]
			};

			expect( () => adapter.withEditorState( original, 'presentation', replacementState ) ).toThrow();
			try {
				adapter.withEditorState( original, 'presentation', replacementState );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
			}
		} );

		it( 'should allow replacement with additional layers not referenced in readingOrder', () => {
			const original = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			const replacementState = {
				canvas: { width: 800, height: 600 },
				layers: [
					{ id: 'title', type: 'text', text: 'Retained title' },
					{ id: 'subtitle', type: 'text', text: 'New unreferenced subtitle' }
				]
			};

			const updated = adapter.withEditorState( original, 'presentation', replacementState );
			expect( updated.surfaces[ 0 ].layers ).toHaveLength( 2 );
			expect( updated.surfaces[ 0 ].readingOrder ).toEqual( [ 'title' ] );
		} );

		it( 'should preserve readingOrder absence when surface has no readingOrder', () => {
			const docWithoutRo = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 'slide-no-ro',
						kind: 'slide',
						label: 'No reading order',
						canvas: { width: 800, height: 600 },
						layers: [ { id: 'any-layer' } ]
					}
				]
			};

			const replacementState = {
				canvas: { width: 800, height: 600 },
				layers: []
			};

			const updated = adapter.withEditorState( docWithoutRo, 'slide-no-ro', replacementState );
			expect( Object.prototype.hasOwnProperty.call( updated.surfaces[ 0 ], 'readingOrder' ) ).toBe( false );
			expect( updated.surfaces[ 0 ].layers ).toEqual( [] );
		} );

		it( 'should allow empty layers when readingOrder is empty array', () => {
			const docWithEmptyRo = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 'slide-empty-ro',
						kind: 'slide',
						label: 'Empty reading order',
						canvas: { width: 800, height: 600 },
						layers: [],
						readingOrder: []
					}
				]
			};

			const replacementState = {
				canvas: { width: 800, height: 600 },
				layers: []
			};

			const updated = adapter.withEditorState( docWithEmptyRo, 'slide-empty-ro', replacementState );
			expect( updated.surfaces[ 0 ].layers ).toEqual( [] );
			expect( updated.surfaces[ 0 ].readingOrder ).toEqual( [] );
		} );
	} );

	describe( 'data loss prevention and edge values', () => {
		it( 'should faithfully preserve explicit false, 0, empty string, and null values', () => {
			const doc = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 'edge-vals',
						kind: 'slide',
						label: 'Edge values',
						canvas: {
							width: 800,
							height: 600,
							backgroundVisible: false,
							backgroundOpacity: 0
						},
						layers: [
							{
								id: 'l1',
								text: '',
								x: 0,
								y: 0,
								opacity: 0,
								visible: false,
								note: null
							}
						],
						readingOrder: [ 'l1' ]
					}
				]
			};

			const extracted = adapter.toEditorState( doc, 'edge-vals' );
			expect( extracted.canvas.backgroundVisible ).toBe( false );
			expect( extracted.canvas.backgroundOpacity ).toBe( 0 );
			expect( extracted.layers[ 0 ].text ).toBe( '' );
			expect( extracted.layers[ 0 ].x ).toBe( 0 );
			expect( extracted.layers[ 0 ].visible ).toBe( false );
			expect( extracted.layers[ 0 ].note ).toBeNull();

			const replacement = {
				canvas: {
					width: 800,
					height: 600,
					backgroundVisible: false,
					backgroundOpacity: 0
				},
				layers: [
					{
						id: 'l1',
						text: '',
						x: 0,
						y: 0,
						visible: false,
						note: null
					}
				]
			};

			const updated = adapter.withEditorState( doc, 'edge-vals', replacement );
			expect( updated.surfaces[ 0 ].canvas.backgroundVisible ).toBe( false );
			expect( updated.surfaces[ 0 ].canvas.backgroundOpacity ).toBe( 0 );
			expect( updated.surfaces[ 0 ].layers[ 0 ].text ).toBe( '' );
			expect( updated.surfaces[ 0 ].layers[ 0 ].x ).toBe( 0 );
			expect( updated.surfaces[ 0 ].layers[ 0 ].visible ).toBe( false );
			expect( updated.surfaces[ 0 ].layers[ 0 ].note ).toBeNull();
		} );

		it( 'should faithfully preserve Unicode and nested group/layer hierarchies', () => {
			const doc = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 'nested-unicode',
						kind: 'slide',
						label: 'Unicode 🌍 & Hierarchies',
						canvas: { width: 1920, height: 1080 },
						layers: [
							{
								id: 'group1',
								type: 'group',
								children: [ 'child1', 'child2' ],
								metadata: {
									nested: {
										text: '🌟 Complex Unicode: 𠮷野家 — тест — العربية'
									}
								}
							},
							{
								id: 'child1',
								type: 'text',
								parentGroup: 'group1',
								text: 'Hello 🌍'
							},
							{
								id: 'child2',
								type: 'shape',
								parentGroup: 'group1'
							}
						],
						readingOrder: [ 'child1' ]
					}
				]
			};

			const extracted = adapter.toEditorState( doc, 'nested-unicode' );
			expect( extracted.layers[ 0 ].metadata.nested.text ).toBe( '🌟 Complex Unicode: 𠮷野家 — тест — العربية' );

			const replacement = {
				canvas: extracted.canvas,
				layers: extracted.layers
			};

			const updated = adapter.withEditorState( doc, 'nested-unicode', replacement );
			expect( updated.surfaces[ 0 ].layers[ 0 ].metadata.nested.text )
				.toBe( '🌟 Complex Unicode: 𠮷野家 — тест — العربية' );
		} );

		it( 'should show zero coordinate drift and zero field loss over repeated conversions', () => {
			const original = JSON.parse( JSON.stringify( mixedDocumentFixture ) );
			let currentSnapshot = original;

			for ( let i = 0; i < 10; i++ ) {
				const state = adapter.toEditorState( currentSnapshot, 'presentation' );
				currentSnapshot = adapter.withEditorState( currentSnapshot, 'presentation', state );
			}

			expect( currentSnapshot ).toEqual( original );
		} );
	} );

	describe( 'strict rejection of non-JSON and malformed data', () => {
		it( 'should reject NaN, Infinity, and -Infinity in snapshot', () => {
			for ( const badNum of [ NaN, Infinity, -Infinity ] ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{
							id: 's1',
							kind: 'slide',
							canvas: { width: badNum, height: 600 },
							layers: []
						}
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject NaN, Infinity, and -Infinity in editor state', () => {
			for ( const badNum of [ NaN, Infinity, -Infinity ] ) {
				const badState = {
					canvas: { width: badNum, height: 600 },
					layers: []
				};
				const doc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [] }
					]
				};
				expect( () => adapter.withEditorState( doc, 's1', badState ) ).toThrow();
			}
		} );

		it( 'should reject undefined, function, symbol, and BigInt in snapshot or state', () => {
			const nonJsonValues = [
				undefined,
				function () {},
				Symbol( 'test' ),
				BigInt( 12345 )
			];

			for ( const val of nonJsonValues ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [], badVal: val }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();

				const badState = {
					canvas: { width: 800, height: 600 },
					layers: [ { id: 'l1', badVal: val } ]
				};
				const doc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [ { id: 'l1' } ] }
					]
				};
				expect( () => adapter.withEditorState( doc, 's1', badState ) ).toThrow();
			}
		} );

		it( 'should reject custom class instances such as Date, RegExp, Map, Set', () => {
			const customObjects = [
				new Date(),
				new RegExp( 'abc' ),
				new Map(),
				new Set(),
				new Error( 'custom' )
			];

			for ( const custom of customObjects ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [], custom }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject sparse arrays in snapshot or state', () => {
			const sparseArray = new Array( 3 );
			sparseArray[ 0 ] = { id: 'l1' };
			sparseArray[ 2 ] = { id: 'l3' };

			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: sparseArray }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
		} );

		it( 'should reject arrays with custom non-index properties', () => {
			const arr = [ { id: 'l1' } ];
			arr.customProp = 'bad';

			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: arr }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
		} );

		it( 'should reject symbol keys on objects', () => {
			const sym = Symbol( 'key' );
			const obj = { [ sym ]: 'value' };

			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [ obj ] }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
		} );

		it( 'should reject non-enumerable properties on objects', () => {
			const obj = { a: 1 };
			Object.defineProperty( obj, 'secret', { value: 'hidden', enumerable: false } );

			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [ obj ] }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
		} );

		it( 'should reject accessors (getters/setters)', () => {
			const obj = {
				get x() {
					return 10;
				}
			};

			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [ obj ] }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
		} );

		it( 'should reject cyclic references in snapshot and in state', () => {
			const cyclicDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [] }
				]
			};
			cyclicDoc.self = cyclicDoc;
			expect( () => adapter.toEditorState( cyclicDoc, 's1' ) ).toThrow();

			const cyclicState = {
				canvas: { width: 800, height: 600 },
				layers: []
			};
			cyclicState.self = cyclicState;

			const validDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 's1', kind: 'slide', canvas: { width: 800, height: 600 }, layers: [] }
				]
			};
			expect( () => adapter.withEditorState( validDoc, 's1', cyclicState ) ).toThrow();
		} );

		it( 'should allow shared acyclic references and copy them independently', () => {
			const sharedConfig = { theme: 'dark', font: 'sans-serif' };
			const doc = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 's1',
						kind: 'slide',
						canvas: { width: 800, height: 600, config: sharedConfig },
						layers: [ { id: 'l1', config: sharedConfig } ]
					}
				]
			};

			const state = adapter.toEditorState( doc, 's1' );
			expect( state.canvas.config ).toEqual( sharedConfig );
			expect( state.layers[ 0 ].config ).toEqual( sharedConfig );

			// They must be independent copies in the result
			expect( state.canvas.config ).not.toBe( state.layers[ 0 ].config );
		} );
	} );

	describe( 'document boundary validation', () => {
		it( 'should reject non-object snapshot root', () => {
			for ( const invalid of [ null, undefined, 'string', 123, true, [] ] ) {
				expect( () => adapter.toEditorState( invalid, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject schemaVersion other than integer 1', () => {
			for ( const badVersion of [ 0, 2, '1', 1.5, null, undefined, true ] ) {
				const badDoc = {
					schemaVersion: badVersion,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: {}, layers: [] }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject non-array surfaces', () => {
			for ( const badSurfaces of [ null, undefined, 'string', 123, true, {} ] ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: badSurfaces
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject duplicate surface IDs throughout the document', () => {
			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: 'duplicate-id', kind: 'slide', canvas: {}, layers: [] },
					{ id: 'duplicate-id', kind: 'slide', canvas: {}, layers: [] }
				]
			};
			expect( () => adapter.toEditorState( badDoc, 'duplicate-id' ) ).toThrow();
		} );

		it( 'should reject empty string surface IDs', () => {
			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{ id: '', kind: 'slide', canvas: {}, layers: [] }
				]
			};
			expect( () => adapter.toEditorState( badDoc, '' ) ).toThrow();
		} );

		it( 'should reject unsupported surface kinds', () => {
			for ( const badKind of [ 'svg', 'video', 'audio', 'document', '', null, undefined, 123 ] ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: badKind, canvas: {}, layers: [] }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject surface with non-object canvas', () => {
			for ( const badCanvas of [ null, undefined, 'string', 123, true, [] ] ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: badCanvas, layers: [] }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should reject surface with non-array layers', () => {
			for ( const badLayers of [ null, undefined, 'string', 123, true, {} ] ) {
				const badDoc = {
					schemaVersion: 1,
					surfaces: [
						{ id: 's1', kind: 'slide', canvas: {}, layers: badLayers }
					]
				};
				expect( () => adapter.toEditorState( badDoc, 's1' ) ).toThrow();
			}
		} );

		it( 'should verify that failed calls never mutate the input snapshot or state', () => {
			const snapshot = JSON.parse( JSON.stringify( slideDocumentFixture ) );
			const badState = {
				canvas: { width: 800 },
				layers: 'not-an-array'
			};

			expect( () => adapter.withEditorState( snapshot, 'presentation', badState ) ).toThrow();

			expect( snapshot.surfaces[ 0 ].canvas.width ).toBe( 800 );
			expect( snapshot.surfaces[ 0 ].layers ).toHaveLength( 1 );
		} );
	} );

	describe( 'safe error contracts', () => {
		it( 'should throw fresh Error with fixed message and .code = layers-invalid-editor-snapshot', () => {
			try {
				adapter.toEditorState( null, 's1' );
				expect( true ).toBe( false );
			} catch ( err ) {
				expect( err ).toBeInstanceOf( Error );
				expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
				expect( err.message ).toBe( 'Invalid editor snapshot' );
			}
		} );

		it( 'should not reflect raw inputs, property names, or diagnostic strings in error', () => {
			const sensitiveToken = 'SECRET_TOKEN_XYZ_12345';
			const badDoc = {
				schemaVersion: 1,
				surfaces: [
					{
						id: 's1',
						kind: 'slide',
						canvas: {},
						layers: [],
						[ sensitiveToken ]: () => {}
					}
				]
			};

			try {
				adapter.toEditorState( badDoc, 's1' );
				expect( true ).toBe( false );
			} catch ( err ) {
				expect( err.message ).toBe( 'Invalid editor snapshot' );
				expect( err.message ).not.toContain( sensitiveToken );
				expect( err.code ).toBe( 'layers-invalid-editor-snapshot' );
			}
		} );
	} );
} );
