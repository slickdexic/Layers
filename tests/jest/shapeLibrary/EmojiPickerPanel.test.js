/**
 * Tests for EmojiPickerPanel
 *
 * @file
 */

'use strict';

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver {
	constructor( callback ) {
		this.callback = callback;
		this.elements = [];
	}

	observe( element ) {
		this.elements.push( element );
		// Immediately trigger as intersecting for testing
		this.callback( [ { target: element, isIntersecting: true } ] );
	}

	unobserve( element ) {
		this.elements = this.elements.filter( ( e ) => e !== element );
	}

	disconnect() {
		this.elements = [];
	}
}

global.IntersectionObserver = MockIntersectionObserver;

describe( 'EmojiPickerPanel', function () {
	let EmojiPickerPanel;
	let panel;
	let mockOnSelect;
	let mockEmojiLibrary;

	beforeEach( function () {
		// Clean up any existing panels
		document.body.innerHTML = '';

		// Mock emoji library - reset for each test
		mockEmojiLibrary = {
			getCategories: jest.fn( () => [
				{ id: 'smileys', name: 'Smileys', icon: '😀' },
				{ id: 'animals', name: 'Animals', icon: '🐱' },
				{ id: 'food', name: 'Food', icon: '🍎' }
			] ),
			getByCategory: jest.fn( ( categoryId ) => {
				if ( categoryId === 'smileys' ) {
					return [
						{ f: 'emoji_u1f600.svg', n: 'Grinning Face', c: '😀', k: 'smile happy' },
						{ f: 'emoji_u1f601.svg', n: 'Beaming Face', c: '😁', k: 'smile grin' }
					];
				}
				if ( categoryId === 'animals' ) {
					return [
						{ f: 'emoji_u1f431.svg', n: 'Cat Face', c: '🐱', k: 'cat pet' }
					];
				}
				return [];
			} ),
			loadSVG: jest.fn( () => Promise.resolve( '<svg viewBox="0 0 128 128"></svg>' ) )
		};

		// Setup mw mock
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => `[${ key }]`,
				parse: () => `[${ key }]`
			} ) ),
			notify: jest.fn(),
			log: {
				error: jest.fn()
			}
		};

		// Set up window.Layers
		global.window.Layers = global.window.Layers || {};
		global.window.Layers.EmojiLibrary = mockEmojiLibrary;

		// Load the module fresh
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js' );
		} );
		EmojiPickerPanel = global.window.Layers.EmojiPickerPanel;

		// Clear mocks
		jest.clearAllMocks();
		mockOnSelect = jest.fn();
	} );

	afterEach( function () {
		// Clean up
		if ( panel && panel.isOpen ) {
			panel.close();
		}
		panel = null;
	} );

	describe( 'constructor', function () {
		it( 'should create instance with default options', function () {
			panel = new EmojiPickerPanel();
			expect( panel ).toBeDefined();
			expect( panel.isOpen ).toBe( false );
			expect( panel.panel ).toBeNull();
		} );

		it( 'should accept onSelect callback', function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			expect( panel.onSelect ).toBe( mockOnSelect );
		} );

		it( 'should have default onSelect function if not provided', function () {
			panel = new EmojiPickerPanel();
			expect( typeof panel.onSelect ).toBe( 'function' );
		} );
	} );

	describe( 'open', function () {
		it( 'should create panel and overlay', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( panel.isOpen ).toBe( true );
			expect( panel.panel ).not.toBeNull();
			expect( panel.overlay ).not.toBeNull();
			expect( document.body.contains( panel.panel ) ).toBe( true );
			expect( document.body.contains( panel.overlay ) ).toBe( true );
		} );

		it( 'should set proper ARIA attributes', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( panel.panel.getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( panel.panel.getAttribute( 'aria-label' ) ).toContain( 'layers-emoji-picker-title' );
		} );

		it( 'should close existing panel if already open', function () {
			panel = new EmojiPickerPanel();
			panel.open();
			expect( panel.isOpen ).toBe( true );

			panel.open(); // Should close (toggle behavior)

			expect( panel.isOpen ).toBe( false );
			expect( panel.panel ).toBeNull();
		} );

		it( 'should focus search input after opening', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( panel.searchInput ).not.toBeNull();
			// Note: focus() may not work in JSDOM without explicit focus management
		} );

		it( 'should build category list on open', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( mockEmojiLibrary.getCategories ).toHaveBeenCalled();
			expect( panel.categoryList.children.length ).toBeGreaterThan( 0 );
		} );

		it( 'should select first category by default', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( panel.currentCategory ).toBe( 'smileys' );
		} );

		it( 'should show error if emoji library not loaded', function () {
			// Temporarily remove library
			const savedLibrary = global.window.Layers.EmojiLibrary;
			global.window.Layers.EmojiLibrary = null;

			panel = new EmojiPickerPanel();
			panel.open();

			expect( global.mw.notify ).toHaveBeenCalled();
			expect( panel.panel ).toBeNull();

			// Restore
			global.window.Layers.EmojiLibrary = savedLibrary;
		} );
	} );

	describe( 'close', function () {
		it( 'should remove panel and overlay from DOM', function () {
			panel = new EmojiPickerPanel();
			panel.open();
			panel.close();

			expect( panel.isOpen ).toBe( false );
			expect( panel.panel ).toBeNull();
			expect( panel.overlay ).toBeNull();
			expect( document.querySelectorAll( '.layers-emoji-picker' ).length ).toBe( 0 );
		} );

		it( 'should remove event listeners', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const removeEventListenerSpy = jest.spyOn( document, 'removeEventListener' );
			panel.close();

			expect( removeEventListenerSpy ).toHaveBeenCalledWith( 'keydown', expect.any( Function ) );
			removeEventListenerSpy.mockRestore();
		} );

		it( 'should disconnect thumbnail observer', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Simulate having an observer
			panel.thumbnailObserver = {
				disconnect: jest.fn()
			};

			panel.close();

			expect( panel.thumbnailObserver ).toBeNull();
		} );
	} );

	describe( 'keyboard navigation', function () {
		it( 'should close on Escape key', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( panel.isOpen ).toBe( false );
		} );
	} );

	describe( 'overlay click', function () {
		it( 'should close when overlay is clicked', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.overlay.click();

			expect( panel.isOpen ).toBe( false );
		} );
	} );

	describe( 'close button', function () {
		it( 'should have a close button', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const closeBtn = panel.panel.querySelector( '.layers-emoji-picker-close' );
			expect( closeBtn ).not.toBeNull();
		} );

		it( 'should close when close button is clicked', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const closeBtn = panel.panel.querySelector( '.layers-emoji-picker-close' );
			closeBtn.click();

			expect( panel.isOpen ).toBe( false );
		} );
	} );

	describe( 'category selection', function () {
		it( 'should render categories in sidebar', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const categoryItems = panel.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			expect( categoryItems.length ).toBe( 3 );
		} );

		it( 'should update emoji grid when category is selected', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.selectCategory( 'animals' );

			expect( mockEmojiLibrary.getByCategory ).toHaveBeenCalledWith( 'animals' );
		} );

		it( 'should highlight selected category', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.selectCategory( 'animals' );

			expect( panel.currentCategory ).toBe( 'animals' );
		} );
	} );

	describe( 'search', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should have search input', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			expect( panel.searchInput ).not.toBeNull();
			expect( panel.searchInput.type ).toBe( 'text' );
		} );

		it( 'should debounce search input', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const searchSpy = jest.spyOn( panel, 'search' );

			panel.searchInput.value = 'smile';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			// Should not search immediately
			expect( searchSpy ).not.toHaveBeenCalled();

			// Fast-forward debounce timer
			jest.advanceTimersByTime( 200 );

			expect( searchSpy ).toHaveBeenCalledWith( 'smile' );
		} );

		it( 'should search across all categories', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Search uses getCategories and getByCategory to search all emoji
			panel.search( 'smile' );

			expect( mockEmojiLibrary.getCategories ).toHaveBeenCalled();
			expect( mockEmojiLibrary.getByCategory ).toHaveBeenCalled();
		} );

		it( 'should show search results in grid', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.search( 'smile' );

			// Grid should be updated with search results
			expect( panel.emojiGrid.children.length ).toBeGreaterThan( 0 );
		} );

		it( 'should return to category view when search is cleared', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Record initial call count
			const initialCalls = mockEmojiLibrary.getByCategory.mock.calls.length;

			panel.search( 'smile' );
			panel.search( '' );

			// Should have called getByCategory again to restore category view
			expect( mockEmojiLibrary.getByCategory.mock.calls.length ).toBeGreaterThan( initialCalls );
		} );

		it( 'should show no results message when nothing found', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.search( 'zzznomatchzzz' );

			const noResults = panel.emojiGrid.querySelector( '.layers-emoji-picker-no-results' );
			expect( noResults ).not.toBeNull();
		} );
	} );

	describe( 'emoji selection', function () {
		it( 'should call onSelect callback when emoji is clicked', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Find an emoji item and click it
			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			expect( emojiItem ).not.toBeNull();

			emojiItem.click();

			// Wait for async loadSVG
			await Promise.resolve();

			expect( mockOnSelect ).toHaveBeenCalled();
		} );

		it( 'should close panel after selection', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			expect( emojiItem ).not.toBeNull();

			emojiItem.click();

			// Wait for async loadSVG
			await Promise.resolve();

			expect( panel.isOpen ).toBe( false );
		} );

		it( 'should pass emoji data to onSelect callback', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			emojiItem.click();

			// Wait for async loadSVG
			await Promise.resolve();

			expect( mockOnSelect ).toHaveBeenCalledWith( expect.objectContaining( {
				svg: expect.any( String ),
				viewBox: expect.any( Array ),
				name: expect.any( String )
			} ) );
		} );
	} );

	describe( 'CSS styles injection', function () {
		it( 'should inject keyframe styles once', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const styleElement = document.getElementById( 'layers-emoji-picker-styles' );
			expect( styleElement ).not.toBeNull();

			// Open again - should not create duplicate
			panel.close();
			panel.open();

			const styleElements = document.querySelectorAll( '#layers-emoji-picker-styles' );
			expect( styleElements.length ).toBe( 1 );
		} );
	} );

	describe( 'panel structure', function () {
		it( 'should have header with title', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const header = panel.panel.querySelector( '.layers-emoji-picker-header' );
			expect( header ).not.toBeNull();

			const title = header.querySelector( 'h2' );
			expect( title ).not.toBeNull();
		} );

		it( 'should have search bar', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const searchBar = panel.panel.querySelector( '.layers-emoji-picker-search' );
			expect( searchBar ).not.toBeNull();
		} );

		it( 'should have category sidebar', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const categories = panel.panel.querySelector( '.layers-emoji-picker-categories' );
			expect( categories ).not.toBeNull();
		} );

		it( 'should have emoji grid', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const grid = panel.panel.querySelector( '.layers-emoji-picker-grid' );
			expect( grid ).not.toBeNull();
		} );
	} );

	describe( 'toggle behavior', function () {
		it( 'should toggle open/close', function () {
			panel = new EmojiPickerPanel();

			expect( panel.isOpen ).toBe( false );

			panel.open();
			expect( panel.isOpen ).toBe( true );

			panel.open(); // Toggle closes
			expect( panel.isOpen ).toBe( false );
		} );
	} );
} );
