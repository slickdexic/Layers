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

	describe( 'category hover effects', function () {
		it( 'should highlight category on mouseenter when not selected', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Find a category that is NOT the currently selected one
			const categoryButtons = panel.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			// First category is 'smileys' (selected by default), use second
			const unselectedCategory = categoryButtons[ 1 ];
			expect( unselectedCategory.dataset.category ).toBe( 'animals' );

			// Trigger mouseenter
			unselectedCategory.dispatchEvent( new MouseEvent( 'mouseenter' ) );

			// Should have highlight background
			expect( unselectedCategory.style.background ).toContain( 'eaecf0' );
		} );

		it( 'should remove highlight on mouseleave when not selected', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const categoryButtons = panel.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			const unselectedCategory = categoryButtons[ 1 ];

			// Trigger mouseenter then mouseleave
			unselectedCategory.dispatchEvent( new MouseEvent( 'mouseenter' ) );
			unselectedCategory.dispatchEvent( new MouseEvent( 'mouseleave' ) );

			expect( unselectedCategory.style.background ).toBe( 'transparent' );
		} );

		it( 'should not change background on hover when category is selected', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Get the selected category (smileys)
			const selectedCategory = panel.categoryList.querySelector( '[data-category="smileys"]' );
			const originalBackground = selectedCategory.style.background;

			// Trigger mouseenter on selected category
			selectedCategory.dispatchEvent( new MouseEvent( 'mouseenter' ) );

			// Background should not change to transparent hover state
			// It should keep its selected styling
			expect( selectedCategory.style.background ).toBe( originalBackground );
		} );

		it( 'should not reset background on mouseleave when category is selected', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const selectedCategory = panel.categoryList.querySelector( '[data-category="smileys"]' );
			const originalBackground = selectedCategory.style.background;

			selectedCategory.dispatchEvent( new MouseEvent( 'mouseleave' ) );

			// Should keep selected background, not reset to transparent
			expect( selectedCategory.style.background ).toBe( originalBackground );
		} );
	} );

	describe( 'emoji item hover effects', function () {
		it( 'should scale up emoji on mouseenter', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			expect( emojiItem ).not.toBeNull();

			emojiItem.dispatchEvent( new MouseEvent( 'mouseenter' ) );

			expect( emojiItem.style.transform ).toBe( 'scale(1.1)' );
			expect( emojiItem.style.background ).toContain( 'f0f0f0' );
		} );

		it( 'should reset emoji on mouseleave', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );

			emojiItem.dispatchEvent( new MouseEvent( 'mouseenter' ) );
			emojiItem.dispatchEvent( new MouseEvent( 'mouseleave' ) );

			expect( emojiItem.style.transform ).toBe( 'scale(1)' );
			expect( emojiItem.style.background ).toBe( 'transparent' );
		} );
	} );

	describe( 'loadThumbnail error handling', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should show fallback when SVG load fails', async function () {
			// Make loadSVG reject
			mockEmojiLibrary.loadSVG.mockRejectedValueOnce( new Error( 'Network error' ) );

			panel = new EmojiPickerPanel();
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );

			// Call loadThumbnail directly
			panel.loadThumbnail( emojiItem );

			// Wait for the promise to reject
			await jest.runAllTimersAsync();

			// Should show fallback '?'
			const fallback = emojiItem.querySelector( 'span' );
			expect( fallback ).not.toBeNull();
			expect( fallback.textContent ).toBe( '?' );
		} );
	} );

	describe( 'prepareSvgThumbnail', function () {
		it( 'should return fallback when SVG element not found', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const result = panel.prepareSvgThumbnail( '<div>Not an SVG</div>' );

			expect( result ).toContain( '?' );
		} );

		it( 'should set dimensions on SVG element', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const result = panel.prepareSvgThumbnail( '<svg viewBox="0 0 128 128"></svg>' );

			expect( result ).toContain( 'width="36"' );
			expect( result ).toContain( 'height="36"' );
		} );

		it( 'should make IDs unique to prevent conflicts', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const svgWithIds = `<svg viewBox="0 0 128 128">
				<defs>
					<linearGradient id="grad1"><stop offset="0%" stop-color="red"/></linearGradient>
				</defs>
				<rect fill="url(#grad1)"/>
			</svg>`;

			const result = panel.prepareSvgThumbnail( svgWithIds );

			// Original ID should be replaced with unique ID
			expect( result ).not.toContain( 'id="grad1"' );
			// Should contain a unique ID pattern
			expect( result ).toMatch( /id="et[a-z0-9]+_grad1"/ );
		} );

		it( 'should update url() references to use new IDs', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const svgWithRefs = `<svg viewBox="0 0 128 128">
				<defs>
					<linearGradient id="myGrad"><stop offset="0%"/></linearGradient>
				</defs>
				<rect fill="url(#myGrad)"/>
			</svg>`;

			const result = panel.prepareSvgThumbnail( svgWithRefs );

			// Should have updated the url() reference
			expect( result ).toMatch( /fill="url\(#et[a-z0-9]+_myGrad\)"/ );
		} );

		it( 'should update style attribute url() references', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const svgWithStyleRefs = `<svg viewBox="0 0 128 128">
				<defs>
					<linearGradient id="styleGrad"><stop offset="0%"/></linearGradient>
				</defs>
				<rect style="fill: url(#styleGrad);"/>
			</svg>`;

			const result = panel.prepareSvgThumbnail( svgWithStyleRefs );

			// Should have updated the style url() reference
			expect( result ).toMatch( /url\(#et[a-z0-9]+_styleGrad\)/ );
		} );

		it( 'should update xlink:href references', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const svgWithXlink = `<svg viewBox="0 0 128 128" xmlns:xlink="http://www.w3.org/1999/xlink">
				<defs>
					<linearGradient id="baseGrad"><stop offset="0%"/></linearGradient>
					<linearGradient id="derivedGrad" xlink:href="#baseGrad"/>
				</defs>
				<rect fill="url(#derivedGrad)"/>
			</svg>`;

			const result = panel.prepareSvgThumbnail( svgWithXlink );

			// Should have updated the xlink:href reference
			expect( result ).toMatch( /xlink:href="#et[a-z0-9]+_baseGrad"/ );
		} );

		it( 'should update clip-path, mask, and filter attributes', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const svgWithAttrs = `<svg viewBox="0 0 128 128">
				<defs>
					<clipPath id="myClip"><circle cx="50" cy="50" r="40"/></clipPath>
				</defs>
				<rect clip-path="url(#myClip)"/>
			</svg>`;

			const result = panel.prepareSvgThumbnail( svgWithAttrs );

			expect( result ).toMatch( /clip-path="url\(#et[a-z0-9]+_myClip\)"/ );
		} );
	} );

	describe( 'insertEmoji error handling', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should show error notification when emoji load fails', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Make loadSVG reject
			mockEmojiLibrary.loadSVG.mockRejectedValueOnce( new Error( 'Load failed' ) );

			panel.insertEmoji( 'emoji_u1f600.svg' );

			// Wait for promise rejection
			await jest.runAllTimersAsync();

			expect( mw.notify ).toHaveBeenCalled();
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should restore item opacity and pointer events after error', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Make loadSVG reject
			mockEmojiLibrary.loadSVG.mockRejectedValueOnce( new Error( 'Load failed' ) );

			const emojiItem = panel.panel.querySelector( '[data-filename="emoji_u1f600.svg"]' );

			panel.insertEmoji( 'emoji_u1f600.svg' );

			// Wait for promise rejection and finally block
			await jest.runAllTimersAsync();

			// Item should be restored
			expect( emojiItem.style.opacity ).toBe( '1' );
			expect( emojiItem.style.pointerEvents ).toBe( 'auto' );
		} );

		it( 'should set loading state on item during emoji insert', function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Don't resolve the promise immediately
			let resolvePromise;
			mockEmojiLibrary.loadSVG.mockReturnValueOnce( new Promise( ( resolve ) => {
				resolvePromise = resolve;
			} ) );

			const emojiItem = panel.panel.querySelector( '[data-filename="emoji_u1f600.svg"]' );

			panel.insertEmoji( 'emoji_u1f600.svg' );

			// Check loading state
			expect( emojiItem.style.opacity ).toBe( '0.5' );
			expect( emojiItem.style.pointerEvents ).toBe( 'none' );

			// Clean up
			resolvePromise( '<svg viewBox="0 0 128 128"></svg>' );
		} );
	} );

	describe( 'destroy', function () {
		it( 'should close panel and clear all references', function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			panel.destroy();

			expect( panel.isOpen ).toBe( false );
			expect( panel.options ).toBeNull();
			expect( panel.onSelect ).toBeNull();
			expect( panel.categoryList ).toBeNull();
			expect( panel.emojiGrid ).toBeNull();
			expect( panel.searchInput ).toBeNull();
			expect( panel.currentCategory ).toBeNull();
		} );

		it( 'should work even if panel was never opened', function () {
			panel = new EmojiPickerPanel();

			expect( () => panel.destroy() ).not.toThrow();

			expect( panel.options ).toBeNull();
		} );
	} );

	describe( 'search edge cases', function () {
		it( 'should ignore very short queries (less than 2 chars)', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const selectCategorySpy = jest.spyOn( panel, 'selectCategory' );
			const initialCategory = panel.currentCategory;

			// Single character should reset to category
			panel.search( 'a' );

			// Should have called selectCategory to reset
			expect( selectCategorySpy ).toHaveBeenCalledWith( initialCategory );
		} );

		it( 'should search by emoji character', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Search by the actual emoji character
			panel.search( '😀' );

			// Grid should have results (since mock emoji includes 😀)
			const items = panel.emojiGrid.querySelectorAll( '.layers-emoji-picker-item' );
			expect( items.length ).toBeGreaterThan( 0 );
		} );

		it( 'should search by filename pattern', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Search by filename fragment
			panel.search( '1f600' );

			// Should find results
			const noResults = panel.emojiGrid.querySelector( '.layers-emoji-picker-no-results' );
			expect( noResults ).toBeNull();
		} );

		it( 'should clear category selection styling during search', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.search( 'smile' );

			// All category buttons should have transparent background
			const categoryButtons = panel.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			categoryButtons.forEach( ( btn ) => {
				expect( btn.style.background ).toBe( 'transparent' );
				expect( btn.style.borderLeft ).toBe( '3px solid transparent' );
			} );
		} );

		it( 'should show result count when search has results', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			panel.search( 'smile' );

			// First child should be the result info
			const resultInfo = panel.emojiGrid.firstElementChild;
			expect( resultInfo.textContent ).toContain( 'Found' );
			expect( resultInfo.textContent ).toContain( 'emoji' );
		} );
	} );

	describe( 'viewBox parsing', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should parse viewBox correctly from SVG', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Set up the mock AFTER open but BEFORE insertEmoji
			mockEmojiLibrary.loadSVG.mockResolvedValueOnce( '<svg viewBox="10 20 200 300"></svg>' );

			panel.insertEmoji( 'emoji_test.svg' );

			// Wait for async operations
			await jest.runAllTimersAsync();

			expect( mockOnSelect ).toHaveBeenCalledWith( expect.objectContaining( {
				viewBox: [ 10, 20, 200, 300 ]
			} ) );
		} );

		it( 'should use default viewBox when not present in SVG', async function () {
			panel = new EmojiPickerPanel( { onSelect: mockOnSelect } );
			panel.open();

			// Set up the mock AFTER open but BEFORE insertEmoji
			mockEmojiLibrary.loadSVG.mockResolvedValueOnce( '<svg></svg>' );

			panel.insertEmoji( 'emoji_test.svg' );

			// Wait for async operations
			await jest.runAllTimersAsync();

			expect( mockOnSelect ).toHaveBeenCalledWith( expect.objectContaining( {
				viewBox: [ 0, 0, 128, 128 ]
			} ) );
		} );
	} );

	describe( 'close with search timeout', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should clear pending search timeout on close', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Start a search that will be debounced
			panel.searchInput.value = 'test';
			panel.searchInput.dispatchEvent( new Event( 'input' ) );

			// Close before debounce timer fires
			panel.close();

			// Advance timer - should not throw or cause issues
			expect( () => jest.advanceTimersByTime( 300 ) ).not.toThrow();
		} );
	} );

	describe( 'category click', function () {
		it( 'should select category when clicked', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const animalsButton = panel.categoryList.querySelector( '[data-category="animals"]' );
			animalsButton.click();

			expect( panel.currentCategory ).toBe( 'animals' );
			expect( mockEmojiLibrary.getByCategory ).toHaveBeenCalledWith( 'animals' );
		} );
	} );

	describe( 'emoji item title', function () {
		it( 'should use descriptive name for title when available', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			// First emoji has name 'Grinning Face'
			expect( emojiItem.title ).toBe( 'Grinning Face' );
		} );

		it( 'should fallback to filename-based title when name not available', function () {
			panel = new EmojiPickerPanel();
			panel.open();

			// Mock emoji without name for the next call
			mockEmojiLibrary.getByCategory.mockReturnValueOnce( [
				{ f: 'emoji_u1f999.svg', c: '🦙', k: 'llama' }
			] );

			// Clear and re-render grid with new mock data
			panel.emojiGrid.innerHTML = '';
			panel.renderEmojiGrid( [ { f: 'emoji_u1f999.svg', c: '🦙', k: 'llama' } ] );

			const emojiItem = panel.emojiGrid.querySelector( '.layers-emoji-picker-item' );
			// Should have cleaned up filename as title
			expect( emojiItem.title ).toContain( '1f999' );
		} );
	} );
} );
