/**
 * ShapeLibraryPanel Test Suite
 *
 * Tests for the shape library modal dialog functionality
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

describe( 'ShapeLibraryPanel', () => {
	let ShapeLibraryPanel;
	let panel;
	let mockContainer;
	let onSelectCallback;

	// Mock shape library data
	const mockCategories = [
		{ id: 'iso7010', name: 'ISO 7010', color: '#ff0000', isParent: true },
		{ id: 'iso7010-w', name: 'Warning', color: '#ffcc00', parentId: 'iso7010' },
		{ id: 'iso7010-p', name: 'Prohibition', color: '#ff0000', parentId: 'iso7010' },
		{ id: 'arrows', name: 'Arrows', color: '#0066cc' }
	];

	const mockShapes = [
		{ id: 'w001', name: 'W001: General warning', categoryId: 'iso7010-w', svg: '<svg></svg>' },
		{ id: 'w002', name: 'W002: Explosive', categoryId: 'iso7010-w', svg: '<svg></svg>' },
		{ id: 'p001', name: 'P001: No smoking', categoryId: 'iso7010-p', svg: '<svg></svg>' },
		{ id: 'arrow-right', name: 'Arrow Right', categoryId: 'arrows', svg: '<svg></svg>' }
	];

	beforeEach( () => {
		// Setup DOM
		document.body.innerHTML = '';
		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

		// Setup mw mock
		global.mw = {
			message: jest.fn( ( key, ...args ) => ( {
				text: () => {
					if ( key === 'layers-shape-library-count' ) {
						return `${ args[ 0 ] } shapes`;
					}
					return key;
				}
			} ) ),
			notify: jest.fn()
		};

		// Setup window.Layers.ShapeLibrary mock
		global.window.Layers = global.window.Layers || {};
		global.window.Layers.ShapeLibrary = {
			getCategories: jest.fn( () => mockCategories ),
			getShapesByCategory: jest.fn( ( categoryId ) => {
				return mockShapes.filter( ( s ) => s.categoryId === categoryId );
			} ),
			search: jest.fn( ( query ) => {
				return mockShapes.filter( ( s ) =>
					s.name.toLowerCase().includes( query.toLowerCase() )
				);
			} )
		};

		// Load the module
		jest.isolateModules( () => {
			require( '../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js' );
		} );
		ShapeLibraryPanel = window.Layers.ShapeLibraryPanel;

		onSelectCallback = jest.fn();
	} );

	afterEach( () => {
		if ( panel && typeof panel.destroy === 'function' ) {
			panel.destroy();
		}
		panel = null;
		document.body.innerHTML = '';
		jest.clearAllMocks();
	} );

	describe( 'Constructor', () => {
		it( 'should create panel with default options', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.panel ).toBeInstanceOf( HTMLElement );
			expect( panel.overlay ).toBeInstanceOf( HTMLElement );
			expect( panel.searchInput ).toBeInstanceOf( HTMLElement );
			expect( panel.categoryList ).toBeInstanceOf( HTMLElement );
			expect( panel.shapeGrid ).toBeInstanceOf( HTMLElement );
		} );

		it( 'should use custom container', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			expect( mockContainer.contains( panel.panel ) ).toBe( true );
			expect( mockContainer.contains( panel.overlay ) ).toBe( true );
		} );

		it( 'should store onSelect callback', () => {
			panel = new ShapeLibraryPanel( { onSelect: onSelectCallback } );

			expect( panel.onSelect ).toBe( onSelectCallback );
		} );

		it( 'should have default category set', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.activeCategory ).toBe( 'iso7010-w' );
		} );

		it( 'should have ISO 7010 expanded by default', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.expandedParents.iso7010 ).toBe( true );
		} );

		it( 'should set isOpen to false initially', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should set isDestroyed to false initially', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.isDestroyed ).toBe( false );
		} );
	} );

	describe( 'Panel DOM Structure', () => {
		it( 'should create overlay with correct class', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.overlay.className ).toBe( 'layers-shape-library-overlay' );
		} );

		it( 'should create panel with dialog role', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.panel.getAttribute( 'role' ) ).toBe( 'dialog' );
		} );

		it( 'should create panel with aria-label', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.panel.getAttribute( 'aria-label' ) ).toBe( 'layers-shape-library-title' );
		} );

		it( 'should create close button with aria-label', () => {
			panel = new ShapeLibraryPanel( {} );

			const closeBtn = panel.panel.querySelector( '.layers-shape-library-close' );
			expect( closeBtn ).not.toBeNull();
			expect( closeBtn.getAttribute( 'aria-label' ) ).toBe( 'layers-close' );
		} );

		it( 'should create search input', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.searchInput.type ).toBe( 'text' );
			expect( panel.searchInput.placeholder ).toBe( 'layers-shape-library-search' );
		} );

		it( 'should create category list', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.categoryList.className ).toBe( 'layers-shape-library-categories' );
		} );

		it( 'should create shape grid', () => {
			panel = new ShapeLibraryPanel( {} );

			expect( panel.shapeGrid.className ).toBe( 'layers-shape-library-grid' );
		} );
	} );

	describe( 'open()', () => {
		it( 'should show overlay and panel', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			expect( panel.overlay.style.display ).toBe( 'block' );
			expect( panel.panel.style.display ).toBe( 'flex' );
		} );

		it( 'should set isOpen to true', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.open();

			expect( panel.isOpen ).toBe( true );
		} );

		it( 'should focus search input', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			expect( document.activeElement ).toBe( panel.searchInput );
		} );

		it( 'should not open if destroyed', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.destroy();
			panel.open();

			// isOpen stays false since panel is destroyed
			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should show notification if ShapeLibrary not loaded', () => {
			// ShapeLibrary is available during construction
			panel = new ShapeLibraryPanel( {} );
			// Then delete it before open() to simulate it becoming unavailable
			delete window.Layers.ShapeLibrary;

			panel.open();

			expect( mw.notify ).toHaveBeenCalled();
			// Panel should stay closed
			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should call selectCategory with active category', () => {
			panel = new ShapeLibraryPanel( {} );
			const selectSpy = jest.spyOn( panel, 'selectCategory' );
			panel.open();

			expect( selectSpy ).toHaveBeenCalledWith( 'iso7010-w' );
		} );
	} );

	describe( 'close()', () => {
		it( 'should hide overlay and panel', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();
			panel.close();

			expect( panel.overlay.style.display ).toBe( 'none' );
			expect( panel.panel.style.display ).toBe( 'none' );
		} );

		it( 'should set isOpen to false', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.open();
			panel.close();

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should handle null overlay gracefully', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.overlay = null;

			expect( () => panel.close() ).not.toThrow();
		} );

		it( 'should handle null panel gracefully', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.panel = null;

			expect( () => panel.close() ).not.toThrow();
		} );
	} );

	describe( 'Event Handling', () => {
		it( 'should close on close button click', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			const closeBtn = panel.panel.querySelector( '.layers-shape-library-close' );
			closeBtn.click();

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should close on overlay click', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.overlay.click();

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should close on Escape key', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should not close on Escape when not open', () => {
			panel = new ShapeLibraryPanel( {} );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			// Should not throw and isOpen should still be false
			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should not close on other keys', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			document.dispatchEvent( event );

			expect( panel.isOpen ).toBe( true );
		} );
	} );

	describe( 'Search Functionality', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should search on input with debounce', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.searchInput.value = 'warning';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			// Not called immediately due to debounce
			expect( window.Layers.ShapeLibrary.search ).not.toHaveBeenCalled();

			jest.advanceTimersByTime( 200 );

			expect( window.Layers.ShapeLibrary.search ).toHaveBeenCalledWith( 'warning' );
		} );

		it( 'should not search if query is less than 2 chars', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.searchInput.value = 'w';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 200 );

			expect( window.Layers.ShapeLibrary.search ).not.toHaveBeenCalled();
		} );

		it( 'should restore category when search is cleared', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			const selectSpy = jest.spyOn( panel, 'selectCategory' );
			selectSpy.mockClear();

			panel.searchInput.value = '';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 200 );

			expect( selectSpy ).toHaveBeenCalledWith( 'iso7010-w' );
		} );

		it( 'should clear previous timeout on rapid input', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.searchInput.value = 'wa';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 100 );

			panel.searchInput.value = 'war';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 200 );

			// Should only search once with final value
			expect( window.Layers.ShapeLibrary.search ).toHaveBeenCalledTimes( 1 );
			expect( window.Layers.ShapeLibrary.search ).toHaveBeenCalledWith( 'war' );
		} );
	} );

	describe( 'Category Selection', () => {
		it( 'should select category and show shapes', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.selectCategory( 'arrows' );

			expect( panel.activeCategory ).toBe( 'arrows' );
			expect( window.Layers.ShapeLibrary.getShapesByCategory ).toHaveBeenCalledWith( 'arrows' );
		} );

		it( 'should update grid with shapes from category', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.selectCategory( 'arrows' );

			// Should have one shape item (arrow-right)
			const items = panel.shapeGrid.querySelectorAll( '.layers-shape-library-item' );
			expect( items.length ).toBe( 1 );
		} );

		it( 'should handle parent category toggle', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			// Initially iso7010 is expanded
			expect( panel.expandedParents.iso7010 ).toBe( true );

			// Find parent item and click to toggle
			const parentItem = panel.categoryList.querySelector( '[data-parent="iso7010"]' );
			if ( parentItem ) {
				parentItem.click();
				// Should toggle expansion
				expect( panel.expandedParents.iso7010 ).toBe( false );
			}
		} );
	} );

	describe( 'Shape Selection', () => {
		it( 'should call onSelect callback with shape', () => {
			panel = new ShapeLibraryPanel( {
				container: mockContainer,
				onSelect: onSelectCallback
			} );
			panel.open();
			panel.selectCategory( 'arrows' );

			const shapeItem = panel.shapeGrid.querySelector( '.layers-shape-library-item' );
			shapeItem.click();

			expect( onSelectCallback ).toHaveBeenCalled();
			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should close panel after selection', () => {
			panel = new ShapeLibraryPanel( {
				container: mockContainer,
				onSelect: onSelectCallback
			} );
			panel.open();
			panel.selectCategory( 'arrows' );

			const shapeItem = panel.shapeGrid.querySelector( '.layers-shape-library-item' );
			shapeItem.click();

			expect( panel.isOpen ).toBe( false );
		} );
	} );

	describe( 'Name Truncation', () => {
		it( 'should extract descriptive part from coded names', () => {
			panel = new ShapeLibraryPanel( {} );

			// "General warning" is 15 chars, so it won't be truncated
			const truncated = panel.truncateName( 'W001: General warning' );
			expect( truncated ).toBe( 'General warning' );
		} );

		it( 'should extract and truncate coded names over 15 chars', () => {
			panel = new ShapeLibraryPanel( {} );

			// After stripping "W001: ", "Explosive material danger" (25 chars) should be truncated
			const truncated = panel.truncateName( 'W001: Explosive material danger' );
			expect( truncated ).toBe( 'Explosive ma...' );
		} );

		it( 'should keep short names as-is', () => {
			panel = new ShapeLibraryPanel( {} );

			const truncated = panel.truncateName( 'Short' );
			expect( truncated ).toBe( 'Short' );
		} );

		it( 'should handle exactly 15 char names', () => {
			panel = new ShapeLibraryPanel( {} );

			const truncated = panel.truncateName( 'Fifteen Charrrr' );
			expect( truncated ).toBe( 'Fifteen Charrrr' );
		} );
	} );

	describe( 'destroy()', () => {
		it( 'should remove all event listeners', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			const removeEventListenerSpy = jest.spyOn( document, 'removeEventListener' );
			panel.destroy();

			expect( removeEventListenerSpy ).toHaveBeenCalledWith( 'keydown', expect.any( Function ) );
		} );

		it( 'should clear search timeout', () => {
			jest.useFakeTimers();
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.searchInput.value = 'test';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			panel.destroy();

			jest.advanceTimersByTime( 500 );

			// Search should not have been called after destroy
			expect( window.Layers.ShapeLibrary.search ).not.toHaveBeenCalled();

			jest.useRealTimers();
		} );

		it( 'should remove DOM elements', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			panel.destroy();

			expect( mockContainer.querySelector( '.layers-shape-library-panel' ) ).toBeNull();
			expect( mockContainer.querySelector( '.layers-shape-library-overlay' ) ).toBeNull();
		} );

		it( 'should set isDestroyed to true', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.destroy();

			expect( panel.isDestroyed ).toBe( true );
		} );

		it( 'should clear all references', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.destroy();

			expect( panel.panel ).toBeNull();
			expect( panel.overlay ).toBeNull();
			expect( panel.searchInput ).toBeNull();
			expect( panel.categoryList ).toBeNull();
			expect( panel.shapeGrid ).toBeNull();
			expect( panel.onSelect ).toBeNull();
			expect( panel.options ).toBeNull();
		} );

		it( 'should not throw if called multiple times', () => {
			panel = new ShapeLibraryPanel( {} );
			panel.destroy();

			expect( () => panel.destroy() ).not.toThrow();
		} );

		it( 'should remove overlay click listener', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			const overlayRef = panel.overlay;

			panel.destroy();

			// Handler should be null
			expect( panel._boundOverlayClickHandler ).toBeNull();
		} );

		it( 'should remove close button listener', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			panel.destroy();

			expect( panel._boundCloseClickHandler ).toBeNull();
		} );

		it( 'should remove search input listener', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			panel.destroy();

			expect( panel._boundSearchInputHandler ).toBeNull();
		} );
	} );

	describe( 'Memory Leak Prevention', () => {
		it( 'should not leak escape handler after destroy', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();
			panel.destroy();

			// Dispatch escape - should not throw or cause issues
			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			expect( () => document.dispatchEvent( event ) ).not.toThrow();
		} );

		it( 'should properly cleanup bound handlers', () => {
			panel = new ShapeLibraryPanel( { container: mockContainer } );

			expect( typeof panel._boundEscapeHandler ).toBe( 'function' );
			expect( typeof panel._boundOverlayClickHandler ).toBe( 'function' );
			expect( typeof panel._boundCloseClickHandler ).toBe( 'function' );
			expect( typeof panel._boundSearchInputHandler ).toBe( 'function' );

			panel.destroy();

			expect( panel._boundEscapeHandler ).toBeNull();
			expect( panel._boundOverlayClickHandler ).toBeNull();
			expect( panel._boundCloseClickHandler ).toBeNull();
			expect( panel._boundSearchInputHandler ).toBeNull();
		} );
	} );

	describe( 'Edge Cases', () => {
		it( 'should handle empty category', () => {
			window.Layers.ShapeLibrary.getShapesByCategory.mockReturnValue( [] );

			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.selectCategory( 'empty-category' );

			const items = panel.shapeGrid.querySelectorAll( '.layers-shape-library-item' );
			expect( items.length ).toBe( 0 );
		} );

		it( 'should handle empty search results', () => {
			window.Layers.ShapeLibrary.search.mockReturnValue( [] );
			jest.useFakeTimers();

			panel = new ShapeLibraryPanel( { container: mockContainer } );
			panel.open();

			panel.searchInput.value = 'nonexistent';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 200 );

			const items = panel.shapeGrid.querySelectorAll( '.layers-shape-library-item' );
			expect( items.length ).toBe( 0 );

			jest.useRealTimers();
		} );

		it( 'should handle missing ShapeLibrary on open', () => {
			panel = new ShapeLibraryPanel( {} );
			delete window.Layers.ShapeLibrary;

			panel.open();

			expect( mw.notify ).toHaveBeenCalledWith(
				'layers-shape-library-not-loaded',
				{ type: 'error' }
			);
			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should handle missing window.Layers on open', () => {
			panel = new ShapeLibraryPanel( {} );
			const originalLayers = window.Layers;
			window.Layers = null;

			panel.open();

			expect( mw.notify ).toHaveBeenCalled();

			window.Layers = originalLayers;
		} );
	} );
} );
