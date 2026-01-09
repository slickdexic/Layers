/**
 * @jest-environment jsdom
 */

/**
 * Extended Unit Tests for LayerPanel - Coverage Improvement
 * Targets uncovered lines: logging methods, editLayerName, reorderLayers fallback,
 * createConfirmDialog, renderCodeSnippet
 */

const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );

// Mock IconFactory
const mockIconFactory = {
	createSVGElement: jest.fn( ( tag ) => document.createElementNS( 'http://www.w3.org/2000/svg', tag ) ),
	createEyeIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'eye-icon' );
		return svg;
	} ),
	createLockIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'lock-icon' );
		return svg;
	} ),
	createDeleteIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'delete-icon' );
		return svg;
	} ),
	createGrabIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'grab-icon' );
		return svg;
	} )
};

describe( 'LayerPanel Coverage Extension', () => {
	let LayerPanel;
	let mockEditor;
	let mockStateManager;
	let layerPanel;

	beforeEach( () => {
		// Setup window globals with namespaced structure
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.StateManager = StateManager;
		window.Layers.UI.IconFactory = mockIconFactory;
		window.Layers.UI.ColorPickerDialog = null;
		window.Layers.UI.ConfirmDialog = null;
		window.Layers.UI.PropertiesForm = null;

		// Load LayerItemFactory for layer item creation
		const LayerItemFactory = require( '../../resources/ext.layers.editor/ui/LayerItemFactory.js' );
		window.Layers.UI.LayerItemFactory = LayerItemFactory;

		window.layersErrorHandler = {
			handleError: jest.fn()
		};

		// Mock EventTracker for event listener management
		window.EventTracker = jest.fn( function () {
			this.listeners = [];
			this.add = jest.fn( ( element, event, handler, options ) => {
				element.addEventListener( event, handler, options );
				this.listeners.push( { element, event, handler, options } );
				return { element, event, handler, options };
			} );
			this.remove = jest.fn();
			this.removeAllForElement = jest.fn( ( elem ) => {
				this.listeners = this.listeners.filter( ( l ) => l.element !== elem );
			} );
			this.count = jest.fn( () => this.listeners.length );
			this.destroy = jest.fn( () => {
				this.listeners.forEach( ( info ) => {
					if ( info.element && info.element.removeEventListener ) {
						info.element.removeEventListener( info.event, info.handler, info.options );
					}
				} );
				this.listeners = [];
			} );
		} );

		// Setup DOM
		document.body.innerHTML = `
			<div id="layers-panel-container"></div>
			<div id="inspector-container"></div>
		`;

		// Create mock StateManager
		mockStateManager = new StateManager();
		mockStateManager.set( 'layers', [
			{ id: 'layer1', type: 'rectangle', name: 'Rectangle 1', visible: true },
			{ id: 'layer2', type: 'text', name: 'Text Layer', visible: true },
			{ id: 'layer3', type: 'circle', name: 'Circle', visible: false }
		] );
		mockStateManager.set( 'selectedLayerIds', [] );

		// Create mock editor
		mockEditor = {
			stateManager: mockStateManager,
			container: document.body,
			filename: 'TestImage.png',
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			updateLayer: jest.fn(),
			getLayerById: jest.fn( ( id ) => {
				const layers = mockStateManager.get( 'layers' ) || [];
				return layers.find( ( l ) => l.id === id );
			} ),
			canvasManager: {
				renderLayers: jest.fn(),
				redraw: jest.fn(),
				selectLayer: jest.fn()
			}
		};

		// Reset module cache and reload LayerPanel
		jest.resetModules();
		jest.clearAllMocks();

		require( '../../resources/ext.layers.editor/LayerPanel.js' );
		LayerPanel = window.Layers.UI.LayerPanel;
	} );

	afterEach( () => {
		if ( layerPanel && typeof layerPanel.destroy === 'function' ) {
			layerPanel.destroy();
		}
		document.body.innerHTML = '';
		jest.clearAllMocks();
		delete window.mw;
	} );

	describe( 'Logging methods', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		describe( 'isDebugEnabled', () => {
			it( 'should return false when mw not available', () => {
				delete window.mw;
				expect( layerPanel.isDebugEnabled() ).toBe( false );
			} );

			it( 'should return false when wgLayersDebug is false', () => {
				window.mw = {
					config: {
						get: jest.fn( () => false )
					}
				};
				expect( layerPanel.isDebugEnabled() ).toBe( false );
			} );

			it( 'should return true when wgLayersDebug is true', () => {
				window.mw = {
					config: {
						get: jest.fn( () => true )
					}
				};
				expect( layerPanel.isDebugEnabled() ).toBe( true );
			} );
		} );

		describe( 'logDebug', () => {
			it( 'should not log when debug disabled', () => {
				delete window.mw;
				layerPanel.logDebug( 'test message' );
				// Should not throw
			} );

			it( 'should log when debug enabled', () => {
				window.mw = {
					config: {
						get: jest.fn( () => true )
					},
					log: jest.fn()
				};
				layerPanel.logDebug( 'test message', { data: 1 } );
				expect( window.mw.log ).toHaveBeenCalledWith( '[LayerPanel]', 'test message', { data: 1 } );
			} );
		} );

		describe( 'logWarn', () => {
			it( 'should not throw when mw not available', () => {
				delete window.mw;
				expect( () => layerPanel.logWarn( 'warning' ) ).not.toThrow();
			} );

			it( 'should call mw.log.warn when available', () => {
				window.mw = {
					log: {
						warn: jest.fn()
					}
				};
				layerPanel.logWarn( 'warning message', 'extra data' );
				expect( window.mw.log.warn ).toHaveBeenCalledWith( '[LayerPanel]', 'warning message', 'extra data' );
			} );
		} );

		describe( 'logError', () => {
			it( 'should not throw when mw not available', () => {
				delete window.mw;
				expect( () => layerPanel.logError( 'error' ) ).not.toThrow();
			} );

			it( 'should call mw.log.error when available', () => {
				window.mw = {
					log: {
						error: jest.fn()
					}
				};
				layerPanel.logError( 'error message', new Error( 'test' ) );
				expect( window.mw.log.error ).toHaveBeenCalledWith( '[LayerPanel]', 'error message', expect.any( Error ) );
			} );
		} );
	} );

	describe( 'editLayerName', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should truncate input exceeding maxLength', () => {
			const nameElement = document.createElement( 'span' );
			nameElement.textContent = 'Original Name';
			nameElement.contentEditable = true;
			document.body.appendChild( nameElement );

			layerPanel.editLayerName( 'layer1', nameElement );

			// Simulate input of very long text
			nameElement.textContent = 'A'.repeat( 150 );
			const inputEvent = new Event( 'input' );
			nameElement.dispatchEvent( inputEvent );

			expect( nameElement.textContent.length ).toBe( 100 );
		} );

		it( 'should save name on blur with new name', () => {
			const nameElement = document.createElement( 'span' );
			nameElement.textContent = 'Original Name';
			nameElement.contentEditable = true;
			document.body.appendChild( nameElement );

			layerPanel.editLayerName( 'layer1', nameElement );

			// Change the name
			nameElement.textContent = 'New Layer Name';
			const blurEvent = new Event( 'blur' );
			nameElement.dispatchEvent( blurEvent );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'layer1', { name: 'New Layer Name' } );
			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Rename Layer' );
		} );

		it( 'should not save if name unchanged', () => {
			const nameElement = document.createElement( 'span' );
			nameElement.textContent = 'Original Name';
			nameElement.contentEditable = true;
			document.body.appendChild( nameElement );

			layerPanel.editLayerName( 'layer1', nameElement );

			// Blur without changing
			const blurEvent = new Event( 'blur' );
			nameElement.dispatchEvent( blurEvent );

			expect( mockEditor.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should save on Enter key', () => {
			const nameElement = document.createElement( 'span' );
			nameElement.textContent = 'Original Name';
			nameElement.contentEditable = true;
			document.body.appendChild( nameElement );

			// Mock blur to trigger the save
			const originalBlur = nameElement.blur;
			nameElement.blur = jest.fn( () => {
				originalBlur.call( nameElement );
				// Manually dispatch blur event since jsdom doesn't auto-trigger
				const blurEvent = new Event( 'blur' );
				nameElement.dispatchEvent( blurEvent );
			} );

			layerPanel.editLayerName( 'layer1', nameElement );

			// Change name then press Enter
			nameElement.textContent = 'Enter Name';
			const keydownEvent = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			nameElement.dispatchEvent( keydownEvent );

			// Enter triggers blur which triggers save
			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'layer1', { name: 'Enter Name' } );
		} );

		it( 'should revert on Escape key', () => {
			const nameElement = document.createElement( 'span' );
			nameElement.textContent = 'Original Name';
			nameElement.contentEditable = true;
			document.body.appendChild( nameElement );

			// Mock blur
			nameElement.blur = jest.fn();

			layerPanel.editLayerName( 'layer1', nameElement );

			// Change name then press Escape
			nameElement.textContent = 'Changed Name';
			const keydownEvent = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			nameElement.dispatchEvent( keydownEvent );

			// Escape restores original and blurs
			expect( nameElement.textContent ).toBe( 'Original Name' );
			expect( nameElement.blur ).toHaveBeenCalled();
		} );
	} );

	describe( 'reorderLayers delegation', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should delegate to dragDropController when available', () => {
			const mockDragDrop = {
				reorderLayers: jest.fn()
			};
			layerPanel.dragDropController = mockDragDrop;

			layerPanel.reorderLayers( 'layer2', 'layer1' );

			expect( mockDragDrop.reorderLayers ).toHaveBeenCalledWith( 'layer2', 'layer1' );
		} );

		it( 'should do nothing when dragDropController is not available', () => {
			layerPanel.dragDropController = null;
			const originalLayers = mockStateManager.get( 'layers' ).slice();

			layerPanel.reorderLayers( 'layer2', 'layer1' );

			// Layers should be unchanged since controller is required
			expect( mockStateManager.get( 'layers' ) ).toEqual( originalLayers );
		} );
	} );

	describe( 'createConfirmDialog', () => {
		let mockConfirmDialogShow;

		beforeEach( () => {
			// Mock ConfirmDialog.show for all tests
			mockConfirmDialogShow = jest.fn();
			window.Layers.UI.ConfirmDialog = {
				show: mockConfirmDialogShow
			};

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			layerPanel = new LP( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		afterEach( () => {
			delete window.Layers.UI.ConfirmDialog;
		} );

		it( 'should delegate to ConfirmDialog.show', () => {
			const onConfirm = jest.fn();
			layerPanel.createConfirmDialog( 'Test message', onConfirm );

			expect( mockConfirmDialogShow ).toHaveBeenCalled();
			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.message ).toBe( 'Test message' );
			expect( callArgs.onConfirm ).toBe( onConfirm );
		} );

		it( 'should pass message to ConfirmDialog', () => {
			layerPanel.createConfirmDialog( 'Are you sure?', jest.fn() );

			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.message ).toBe( 'Are you sure?' );
		} );

		it( 'should pass onConfirm callback to ConfirmDialog', () => {
			const onConfirm = jest.fn();
			layerPanel.createConfirmDialog( 'Confirm?', onConfirm );

			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.onConfirm ).toBe( onConfirm );
		} );

		it( 'should pass localized strings to ConfirmDialog', () => {
			layerPanel.createConfirmDialog( 'Test', jest.fn() );

			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.strings ).toBeDefined();
			expect( callArgs.strings.title ).toBeDefined();
			expect( callArgs.strings.cancel ).toBeDefined();
			expect( callArgs.strings.confirm ).toBeDefined();
		} );

		it( 'should register cleanup callback', () => {
			layerPanel.createConfirmDialog( 'Test', jest.fn() );

			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( typeof callArgs.registerCleanup ).toBe( 'function' );
		} );

		it( 'should do nothing when ConfirmDialog is not available', () => {
			// Remove the mock
			delete window.Layers.UI.ConfirmDialog;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );

			// Should not throw
			expect( () => {
				panel.createConfirmDialog( 'Focus trap test', jest.fn() );
			} ).not.toThrow();
		} );
	} );

	describe( 'simpleConfirm', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should use window.confirm when available', () => {
			const originalConfirm = window.confirm;
			window.confirm = jest.fn( () => true );

			const result = layerPanel.simpleConfirm( 'Test?' );

			expect( window.confirm ).toHaveBeenCalledWith( 'Test?' );
			expect( result ).toBe( true );

			window.confirm = originalConfirm;
		} );

		it( 'should return true and log warning when confirm unavailable', () => {
			const originalConfirm = window.confirm;
			delete window.confirm;

			window.mw = {
				log: {
					warn: jest.fn()
				}
			};

			const result = layerPanel.simpleConfirm( 'No confirm available' );

			expect( result ).toBe( true );

			window.confirm = originalConfirm;
		} );
	} );

	describe( 'renderCodeSnippet', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should show "no layers visible" message when all hidden', () => {
			const layers = [
				{ id: 'layer1', visible: false },
				{ id: 'layer2', visible: false }
			];

			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'No layers visible' );
		} );

		it( 'should show "all visible" code when all layers visible', () => {
			const layers = [
				{ id: 'layer1', visible: true },
				{ id: 'layer2', visible: true }
			];

			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'layers=all' );
			expect( html ).toContain( 'All layers visible' );
		} );

		it( 'should show specific layer IDs when some visible', () => {
			const layers = [
				{ id: 'layer1', visible: true },
				{ id: 'layer2', visible: false },
				{ id: 'layer3', visible: true }
			];

			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'layers=layer1,layer3' );
			expect( html ).toContain( 'Selected layers visible' );
		} );

		it( 'should include filename in code', () => {
			const layers = [ { id: 'layer1', visible: true } ];

			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'TestImage.png' );
		} );

		it( 'should include copy button', () => {
			const layers = [ { id: 'layer1', visible: true } ];

			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'copy-btn' );
			expect( html ).toContain( 'Copy' );
		} );

		it( 'should use default filename when editor filename not set', () => {
			mockEditor.filename = null;

			const layers = [ { id: 'layer1', visible: true } ];
			const html = layerPanel.renderCodeSnippet( layers );

			expect( html ).toContain( 'YourImage.jpg' );
		} );
	} );

	describe( 'getDefaultLayerName edge cases', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should return Layer for unknown type', () => {
			const label = layerPanel.getDefaultLayerName( { type: 'unknown_type' } );
			expect( label ).toBe( 'Layer' );
		} );

		it( 'should handle all standard types', () => {
			const types = [
				'rectangle', 'circle', 'ellipse', 'polygon',
				'star', 'arrow', 'line', 'path', 'blur'
			];

			types.forEach( ( type ) => {
				const label = layerPanel.getDefaultLayerName( { type: type } );
				expect( label ).not.toBe( '' );
				expect( typeof label ).toBe( 'string' );
			} );
		} );

		it( 'should handle text type with text content', () => {
			const label = layerPanel.getDefaultLayerName( { type: 'text', text: 'Hello World' } );
			expect( label ).toContain( 'Hello World' );
		} );

		it( 'should handle text type without text content', () => {
			const label = layerPanel.getDefaultLayerName( { type: 'text', text: '' } );
			expect( label ).toContain( 'Empty' );
		} );

		it( 'should truncate long text', () => {
			const longText = 'This is a very long text that should be truncated';
			const label = layerPanel.getDefaultLayerName( { type: 'text', text: longText } );
			expect( label.length ).toBeLessThan( longText.length + 10 ); // +10 for prefix
		} );
	} );

	describe( 'syncPropertiesFromLayer', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should handle null layer', () => {
			expect( () => layerPanel.syncPropertiesFromLayer( null ) ).not.toThrow();
		} );

		it( 'should handle missing propertiesPanel', () => {
			layerPanel.propertiesPanel = null;
			expect( () => layerPanel.syncPropertiesFromLayer( { id: 'test' } ) ).not.toThrow();
		} );

		it( 'should update input values from layer', () => {
			// Create a mock properties panel with inputs
			const panel = document.createElement( 'div' );
			panel.className = 'layer-properties-form';

			const xInput = document.createElement( 'input' );
			xInput.setAttribute( 'data-prop', 'x' );
			xInput.value = '';
			panel.appendChild( xInput );

			const yInput = document.createElement( 'input' );
			yInput.setAttribute( 'data-prop', 'y' );
			yInput.value = '';
			panel.appendChild( yInput );

			layerPanel.propertiesPanel = panel;

			const layer = { id: 'test', x: 100, y: 200 };
			layerPanel.syncPropertiesFromLayer( layer );

			expect( xInput.value ).toBe( '100' );
			expect( yInput.value ).toBe( '200' );
		} );

		it( 'should not update input if it has focus', () => {
			const panel = document.createElement( 'div' );
			panel.className = 'layer-properties-form';

			const xInput = document.createElement( 'input' );
			xInput.setAttribute( 'data-prop', 'x' );
			xInput.value = '50';
			panel.appendChild( xInput );
			document.body.appendChild( panel );

			layerPanel.propertiesPanel = panel;

			// Focus the input
			xInput.focus();

			const layer = { id: 'test', x: 100 };
			layerPanel.syncPropertiesFromLayer( layer );

			// Should not change because input has focus
			expect( xInput.value ).toBe( '50' );
		} );

		it( 'should handle ellipse width/height from radiusX/radiusY', () => {
			const panel = document.createElement( 'div' );
			panel.className = 'layer-properties-form';

			const widthInput = document.createElement( 'input' );
			widthInput.setAttribute( 'data-prop', 'width' );
			widthInput.value = '';
			panel.appendChild( widthInput );

			layerPanel.propertiesPanel = panel;

			const layer = { id: 'test', type: 'ellipse', radiusX: 50 };
			layerPanel.syncPropertiesFromLayer( layer );

			expect( widthInput.value ).toBe( '100' ); // radiusX * 2
		} );

		it( 'should format with decimals when data-decimals attribute set', () => {
			const panel = document.createElement( 'div' );
			panel.className = 'layer-properties-form';

			const rotInput = document.createElement( 'input' );
			rotInput.setAttribute( 'data-prop', 'rotation' );
			rotInput.setAttribute( 'data-decimals', '1' );
			rotInput.value = '';
			panel.appendChild( rotInput );

			layerPanel.propertiesPanel = panel;

			const layer = { id: 'test', rotation: 45.678 };
			layerPanel.syncPropertiesFromLayer( layer );

			expect( rotInput.value ).toBe( '45.7' );
		} );
	} );

	describe( 'listener management', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should add and remove document listeners', () => {
			const handler = jest.fn();
			layerPanel.addDocumentListener( 'click', handler );

			// Now tracked via EventTracker
			expect( layerPanel.eventTracker.add ).toHaveBeenCalledWith( document, 'click', handler, undefined );

			layerPanel.removeDocumentListeners();

			expect( layerPanel.eventTracker.removeAllForElement ).toHaveBeenCalledWith( document );
		} );

		it( 'should ignore invalid addDocumentListener calls', () => {
			const initialCount = layerPanel.eventTracker.add.mock.calls.length;
			layerPanel.addDocumentListener( null, jest.fn() );
			layerPanel.addDocumentListener( 'click', null );
			layerPanel.addDocumentListener( 'click', 'not a function' );

			expect( layerPanel.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );

		it( 'should add and remove target listeners', () => {
			const target = document.createElement( 'div' );
			const handler = jest.fn();
			layerPanel.addTargetListener( target, 'click', handler );

			// Now tracked via EventTracker
			expect( layerPanel.eventTracker.add ).toHaveBeenCalledWith( target, 'click', handler, undefined );
		} );

		it( 'should ignore invalid addTargetListener calls', () => {
			const initialCount = layerPanel.eventTracker.add.mock.calls.length;
			layerPanel.addTargetListener( null, 'click', jest.fn() );
			layerPanel.addTargetListener( document.createElement( 'div' ), 'click', null );
			layerPanel.addTargetListener( {}, 'click', jest.fn() ); // no addEventListener

			expect( layerPanel.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );
	} );

	describe( 'dialog cleanup', () => {
		beforeEach( () => {
			layerPanel = new LayerPanel( {
				editor: mockEditor,
				container: document.getElementById( 'layers-panel-container' )
			} );
		} );

		it( 'should register and run dialog cleanups', () => {
			const cleanup1 = jest.fn();
			const cleanup2 = jest.fn();

			layerPanel.registerDialogCleanup( cleanup1 );
			layerPanel.registerDialogCleanup( cleanup2 );

			expect( layerPanel.dialogCleanups.length ).toBe( 2 );

			layerPanel.runDialogCleanups();

			expect( cleanup1 ).toHaveBeenCalled();
			expect( cleanup2 ).toHaveBeenCalled();
			expect( layerPanel.dialogCleanups.length ).toBe( 0 );
		} );

		it( 'should handle cleanup errors gracefully', () => {
			const errorCleanup = jest.fn( () => {
				throw new Error( 'Cleanup error' );
			} );

			layerPanel.registerDialogCleanup( errorCleanup );

			expect( () => layerPanel.runDialogCleanups() ).not.toThrow();
			expect( window.layersErrorHandler.handleError ).toHaveBeenCalled();
		} );

		it( 'should ignore non-function cleanup registrations', () => {
			layerPanel.registerDialogCleanup( 'not a function' );
			layerPanel.registerDialogCleanup( null );
			layerPanel.registerDialogCleanup( 123 );

			expect( layerPanel.dialogCleanups.length ).toBe( 0 );
		} );
	} );
} );
