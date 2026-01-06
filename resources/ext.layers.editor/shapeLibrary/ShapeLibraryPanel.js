/* eslint-env node */
/**
 * ShapeLibraryPanel - UI component for the shape library
 *
 * Provides a searchable, categorized panel for selecting and placing shapes.
 * Supports keyboard navigation and accessibility.
 *
 * @class
 */
class ShapeLibraryPanel {
	/**
	 * Create a ShapeLibraryPanel
	 *
	 * @param {Object} options - Panel options
	 * @param {HTMLElement} [options.container] - Container element (created if not provided)
	 * @param {ShapeLibraryManager} options.manager - Shape library manager
	 * @param {Function} [options.onShapeSelect] - Callback when shape is selected
	 * @param {Function} [options.getMessage] - i18n message function
	 * @param {Function} [options.msg] - Alias for getMessage
	 * @param {Function} [options.onSelect] - Alias for onShapeSelect
	 */
	constructor( options ) {
		/**
		 * Container element
		 *
		 * @private
		 * @type {HTMLElement}
		 */
		this.container = options.container || document.createElement( 'div' );

		/**
		 * Shape library manager
		 *
		 * @private
		 * @type {ShapeLibraryManager}
		 */
		this.manager = options.manager;

		/**
		 * Shape selection callback
		 *
		 * @private
		 * @type {Function}
		 */
		this.onShapeSelect = options.onShapeSelect || options.onSelect || ( () => {} );

		/**
		 * i18n message function
		 *
		 * @private
		 * @type {Function}
		 */
		this.getMessage = options.getMessage || options.msg || ( ( key ) => key );

		/**
		 * Currently expanded category
		 *
		 * @private
		 * @type {string|null}
		 */
		this.expandedCategory = null;

		/**
		 * Currently focused shape index for keyboard navigation
		 *
		 * @private
		 * @type {number}
		 */
		this.focusedIndex = -1;

		/**
		 * Currently visible shapes for keyboard navigation
		 *
		 * @private
		 * @type {Array<Object>}
		 */
		this.visibleShapes = [];

		/**
		 * Search input element
		 *
		 * @private
		 * @type {HTMLInputElement|null}
		 */
		this.searchInput = null;

		/**
		 * Shape grid element
		 *
		 * @private
		 * @type {HTMLElement|null}
		 */
		this.shapeGrid = null;

		this.render();
		this.attachEventListeners();
	}

	/**
	 * Render the panel
	 *
	 * @private
	 */
	render() {
		this.container.innerHTML = '';
		this.container.className = 'layers-shape-library-panel';
		this.container.setAttribute( 'role', 'region' );
		this.container.setAttribute( 'aria-label', this.getMessage( 'layers-shape-library' ) );

		// Search bar
		const searchContainer = document.createElement( 'div' );
		searchContainer.className = 'layers-shape-search';

		this.searchInput = document.createElement( 'input' );
		this.searchInput.type = 'text';
		this.searchInput.className = 'layers-shape-search-input';
		this.searchInput.placeholder = this.getMessage( 'layers-shape-search-placeholder' ) || 'Search shapes...';
		this.searchInput.setAttribute( 'aria-label', this.getMessage( 'layers-shape-search-aria' ) || 'Search shapes' );

		searchContainer.appendChild( this.searchInput );
		this.container.appendChild( searchContainer );

		// Content area
		const content = document.createElement( 'div' );
		content.className = 'layers-shape-content';

		// Recent shapes section
		this.recentSection = this.createSection( 'recent', '★ ' + ( this.getMessage( 'layers-shape-recent' ) || 'Recent' ) );
		content.appendChild( this.recentSection );

		// Category sections
		const categories = this.manager.getCategories();
		categories.forEach( ( category ) => {
			const section = this.createCategorySection( category );
			content.appendChild( section );
		} );

		this.container.appendChild( content );

		// Shape grid (shown during search or category expansion)
		this.shapeGrid = document.createElement( 'div' );
		this.shapeGrid.className = 'layers-shape-grid';
		this.shapeGrid.setAttribute( 'role', 'listbox' );
		this.shapeGrid.setAttribute( 'aria-label', this.getMessage( 'layers-shape-grid-aria' ) || 'Shape selection' );
		this.container.appendChild( this.shapeGrid );

		// Initial render of recent shapes
		this.updateRecentShapes();
	}

	/**
	 * Create a collapsible section
	 *
	 * @private
	 * @param {string} id - Section identifier
	 * @param {string} title - Section title
	 * @returns {HTMLElement} Section element
	 */
	createSection( id, title ) {
		const section = document.createElement( 'div' );
		section.className = 'layers-shape-section';
		section.dataset.sectionId = id;

		const header = document.createElement( 'button' );
		header.className = 'layers-shape-section-header';
		header.setAttribute( 'aria-expanded', 'false' );
		header.setAttribute( 'aria-controls', `layers-shape-section-${ id }` );

		const arrow = document.createElement( 'span' );
		arrow.className = 'layers-shape-section-arrow';
		arrow.textContent = '▶';

		const titleSpan = document.createElement( 'span' );
		titleSpan.className = 'layers-shape-section-title';
		titleSpan.textContent = title;

		header.appendChild( arrow );
		header.appendChild( titleSpan );
		section.appendChild( header );

		const content = document.createElement( 'div' );
		content.className = 'layers-shape-section-content';
		content.id = `layers-shape-section-${ id }`;
		content.style.display = 'none';
		section.appendChild( content );

		return section;
	}

	/**
	 * Create a category section
	 *
	 * @private
	 * @param {Object} category - Category definition
	 * @returns {HTMLElement} Section element
	 */
	createCategorySection( category ) {
		const title = `${ category.icon } ${ this.getMessage( category.name ) || category.id }`;
		const section = this.createSection( category.id, title );

		// Add shape count
		const shapes = this.manager.getShapesByCategory( category.id );
		const header = section.querySelector( '.layers-shape-section-header' );
		const count = document.createElement( 'span' );
		count.className = 'layers-shape-section-count';
		count.textContent = `(${ shapes.length })`;
		header.appendChild( count );

		return section;
	}

	/**
	 * Attach event listeners
	 *
	 * @private
	 */
	attachEventListeners() {
		// Search input
		this.searchInput.addEventListener( 'input', this.handleSearch.bind( this ) );
		this.searchInput.addEventListener( 'keydown', this.handleSearchKeydown.bind( this ) );

		// Section headers (event delegation)
		this.container.addEventListener( 'click', this.handleClick.bind( this ) );

		// Keyboard navigation in grid
		this.shapeGrid.addEventListener( 'keydown', this.handleGridKeydown.bind( this ) );
	}

	/**
	 * Handle search input
	 *
	 * @private
	 * @param {Event} event - Input event
	 */
	handleSearch( event ) {
		const query = event.target.value.trim();

		if ( query.length === 0 ) {
			// Show categories
			this.shapeGrid.style.display = 'none';
			this.container.querySelector( '.layers-shape-content' ).style.display = 'block';
			this.visibleShapes = [];
			return;
		}

		// Search and show results
		const results = this.manager.search( query );
		this.showShapes( results );

		// Hide category view
		this.container.querySelector( '.layers-shape-content' ).style.display = 'none';
	}

	/**
	 * Handle keydown in search
	 *
	 * @private
	 * @param {KeyboardEvent} event - Keyboard event
	 */
	handleSearchKeydown( event ) {
		if ( event.key === 'ArrowDown' && this.visibleShapes.length > 0 ) {
			event.preventDefault();
			this.focusedIndex = 0;
			this.focusShape( 0 );
		} else if ( event.key === 'Escape' ) {
			this.searchInput.value = '';
			this.handleSearch( { target: this.searchInput } );
		}
	}

	/**
	 * Handle click events (delegation)
	 *
	 * @private
	 * @param {MouseEvent} event - Click event
	 */
	handleClick( event ) {
		const target = event.target;

		// Favorite button click - check first since it's inside shape item
		const favButton = target.closest( '.layers-shape-favorite' );
		if ( favButton ) {
			event.stopPropagation();
			const shapeId = favButton.closest( '.layers-shape-item' ).dataset.shapeId;
			this.toggleFavorite( shapeId, favButton );
			return;
		}

		// Section header click
		const header = target.closest( '.layers-shape-section-header' );
		if ( header ) {
			this.toggleSection( header.closest( '.layers-shape-section' ) );
			return;
		}

		// Shape item click
		const shapeItem = target.closest( '.layers-shape-item' );
		if ( shapeItem ) {
			const shapeId = shapeItem.dataset.shapeId;
			this.selectShape( shapeId );
		}
	}

	/**
	 * Toggle section expansion
	 *
	 * @private
	 * @param {HTMLElement} section - Section element
	 */
	toggleSection( section ) {
		const header = section.querySelector( '.layers-shape-section-header' );
		const content = section.querySelector( '.layers-shape-section-content' );
		const arrow = section.querySelector( '.layers-shape-section-arrow' );
		const categoryId = section.dataset.sectionId;

		const isExpanded = header.getAttribute( 'aria-expanded' ) === 'true';

		if ( isExpanded ) {
			// Collapse
			header.setAttribute( 'aria-expanded', 'false' );
			content.style.display = 'none';
			arrow.textContent = '▶';
			this.expandedCategory = null;
		} else {
			// Collapse any other expanded section
			this.container.querySelectorAll( '.layers-shape-section' ).forEach( ( s ) => {
				if ( s !== section ) {
					const h = s.querySelector( '.layers-shape-section-header' );
					const c = s.querySelector( '.layers-shape-section-content' );
					const a = s.querySelector( '.layers-shape-section-arrow' );
					h.setAttribute( 'aria-expanded', 'false' );
					c.style.display = 'none';
					a.textContent = '▶';
				}
			} );

			// Expand this section
			header.setAttribute( 'aria-expanded', 'true' );
			content.style.display = 'block';
			arrow.textContent = '▼';
			this.expandedCategory = categoryId;

			// Populate shapes
			this.populateSectionShapes( section, categoryId );
		}
	}

	/**
	 * Populate shapes in a section
	 *
	 * @private
	 * @param {HTMLElement} section - Section element
	 * @param {string} categoryId - Category identifier
	 */
	populateSectionShapes( section, categoryId ) {
		const content = section.querySelector( '.layers-shape-section-content' );

		// Skip if already populated
		if ( content.children.length > 0 ) {
			return;
		}

		let shapes;
		if ( categoryId === 'recent' ) {
			shapes = this.manager.getRecentShapes();
		} else {
			shapes = this.manager.getShapesByCategory( categoryId );
		}

		const grid = document.createElement( 'div' );
		grid.className = 'layers-shape-grid-inline';

		shapes.forEach( ( shape ) => {
			grid.appendChild( this.createShapeItem( shape ) );
		} );

		content.appendChild( grid );
	}

	/**
	 * Show shapes in the main grid
	 *
	 * @private
	 * @param {Array<Object>} shapes - Shapes to display
	 */
	showShapes( shapes ) {
		this.shapeGrid.innerHTML = '';
		this.shapeGrid.style.display = 'grid';
		this.visibleShapes = shapes;

		shapes.forEach( ( shape, index ) => {
			const item = this.createShapeItem( shape, index );
			this.shapeGrid.appendChild( item );
		} );
	}

	/**
	 * Create a shape item element
	 *
	 * @private
	 * @param {Object} shape - Shape definition
	 * @param {number} [index] - Index for keyboard navigation
	 * @returns {HTMLElement} Shape item element
	 */
	createShapeItem( shape, index = -1 ) {
		const item = document.createElement( 'div' );
		item.className = 'layers-shape-item';
		item.dataset.shapeId = shape.id;
		item.setAttribute( 'role', 'option' );
		item.setAttribute( 'tabindex', index === 0 ? '0' : '-1' );
		item.setAttribute( 'aria-label', this.getMessage( shape.name ) || shape.id );

		// Shape preview (SVG)
		const preview = document.createElement( 'div' );
		preview.className = 'layers-shape-preview';

		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'viewBox', shape.viewBox.join( ' ' ) );
		svg.setAttribute( 'aria-hidden', 'true' );

		const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
		path.setAttribute( 'd', shape.path );
		path.setAttribute( 'fill', 'currentColor' );
		if ( shape.fillRule ) {
			path.setAttribute( 'fill-rule', shape.fillRule );
		}

		svg.appendChild( path );
		preview.appendChild( svg );
		item.appendChild( preview );

		// Shape name
		const name = document.createElement( 'div' );
		name.className = 'layers-shape-name';
		name.textContent = this.getMessage( shape.name ) || shape.id.split( '/' ).pop();
		item.appendChild( name );

		// Favorite button
		const favButton = document.createElement( 'button' );
		favButton.className = 'layers-shape-favorite';
		favButton.setAttribute( 'aria-label', this.getMessage( 'layers-shape-toggle-favorite' ) || 'Toggle favorite' );
		favButton.textContent = this.manager.isFavorite( shape.id ) ? '★' : '☆';
		item.appendChild( favButton );

		return item;
	}

	/**
	 * Select a shape
	 *
	 * @private
	 * @param {string} shapeId - Shape identifier
	 */
	selectShape( shapeId ) {
		const shape = this.manager.getShapeById( shapeId );
		if ( !shape ) {
			return;
		}

		// Add to recent
		this.manager.addToRecent( shapeId );

		// Update recent section
		this.updateRecentShapes();

		// Callback
		this.onShapeSelect( shape );
	}

	/**
	 * Toggle favorite for a shape
	 *
	 * @private
	 * @param {string} shapeId - Shape identifier
	 * @param {HTMLElement} button - Favorite button element
	 */
	toggleFavorite( shapeId, button ) {
		const isFavorite = this.manager.toggleFavorite( shapeId );
		button.textContent = isFavorite ? '★' : '☆';
	}

	/**
	 * Update recent shapes section
	 *
	 * @private
	 */
	updateRecentShapes() {
		const section = this.recentSection;
		const content = section.querySelector( '.layers-shape-section-content' );
		content.innerHTML = '';

		const recentShapes = this.manager.getRecentShapes();
		if ( recentShapes.length === 0 ) {
			section.style.display = 'none';
			return;
		}

		section.style.display = 'block';

		const grid = document.createElement( 'div' );
		grid.className = 'layers-shape-grid-inline';

		recentShapes.forEach( ( shape ) => {
			grid.appendChild( this.createShapeItem( shape ) );
		} );

		content.appendChild( grid );
	}

	/**
	 * Handle keyboard navigation in grid
	 *
	 * @private
	 * @param {KeyboardEvent} event - Keyboard event
	 */
	handleGridKeydown( event ) {
		const { key } = event;
		const itemsPerRow = 4; // Assuming 4 items per row

		switch ( key ) {
			case 'ArrowRight':
				event.preventDefault();
				this.focusShape( this.focusedIndex + 1 );
				break;
			case 'ArrowLeft':
				event.preventDefault();
				this.focusShape( this.focusedIndex - 1 );
				break;
			case 'ArrowDown':
				event.preventDefault();
				this.focusShape( this.focusedIndex + itemsPerRow );
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.focusShape( this.focusedIndex - itemsPerRow );
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				if ( this.focusedIndex >= 0 && this.focusedIndex < this.visibleShapes.length ) {
					this.selectShape( this.visibleShapes[ this.focusedIndex ].id );
				}
				break;
			case 'Escape':
				this.searchInput.focus();
				break;
		}
	}

	/**
	 * Focus a shape by index
	 *
	 * @private
	 * @param {number} index - Shape index
	 */
	focusShape( index ) {
		if ( index < 0 || index >= this.visibleShapes.length ) {
			return;
		}

		// Remove focus from current
		const current = this.shapeGrid.querySelector( '[tabindex="0"]' );
		if ( current ) {
			current.setAttribute( 'tabindex', '-1' );
		}

		// Focus new
		const items = this.shapeGrid.querySelectorAll( '.layers-shape-item' );
		if ( items[ index ] ) {
			items[ index ].setAttribute( 'tabindex', '0' );
			items[ index ].focus();
			this.focusedIndex = index;
		}
	}

	/**
	 * Get the panel container element
	 *
	 * @returns {HTMLElement} The panel container
	 */
	getElement() {
		return this.container;
	}

	/**
	 * Show the panel
	 */
	show() {
		this.container.style.display = 'block';
		if ( this.searchInput ) {
			this.searchInput.focus();
		}
	}

	/**
	 * Hide the panel
	 */
	hide() {
		this.container.style.display = 'none';
	}

	/**
	 * Toggle panel visibility
	 *
	 * @returns {boolean} New visibility state
	 */
	toggle() {
		const isVisible = this.container.style.display !== 'none';
		if ( isVisible ) {
			this.hide();
		} else {
			this.show();
		}
		return !isVisible;
	}

	/**
	 * Destroy the panel and clean up
	 */
	destroy() {
		this.container.innerHTML = '';
		this.visibleShapes = [];
		this.searchInput = null;
		this.shapeGrid = null;
	}
}

// Export for browser (MediaWiki ResourceLoader)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};
	window.Layers.ShapeLibrary.ShapeLibraryPanel = ShapeLibraryPanel;
	window.ShapeLibraryPanel = ShapeLibraryPanel;
}

// Export for Node.js (Jest tests)
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = ShapeLibraryPanel;
}
