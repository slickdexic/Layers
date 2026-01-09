/**
 * Shape Library Panel for Layers Extension
 *
 * Provides a modal dialog for browsing and selecting shapes from the shape library.
 * Shapes are organized by category with search functionality.
 *
 * @file
 */

( function () {
	'use strict';

	/**
	 * Shape Library Panel class
	 *
	 * @class
	 * @param {Object} options - Panel options
	 * @param {Function} options.onSelect - Callback when shape is selected
	 * @param {HTMLElement} [options.container] - Container element (defaults to document.body)
	 */
	function ShapeLibraryPanel( options ) {
		this.options = options || {};
		this.onSelect = this.options.onSelect || function () {};
		this.container = this.options.container || document.body;

		this.panel = null;
		this.overlay = null;
		this.searchInput = null;
		this.categoryList = null;
		this.shapeGrid = null;
		this.activeCategory = 'iso7010-w'; // Default to warning signs

		this.isOpen = false;

		this.init();
	}

	/**
	 * Initialize the panel
	 *
	 * @private
	 */
	ShapeLibraryPanel.prototype.init = function () {
		this.createPanel();
		this.bindEvents();
	};

	/**
	 * Create the panel DOM structure
	 *
	 * @private
	 */
	ShapeLibraryPanel.prototype.createPanel = function () {
		// Create overlay
		this.overlay = document.createElement( 'div' );
		this.overlay.className = 'layers-shape-library-overlay';
		this.overlay.style.cssText = `
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			z-index: 1000010;
		`;

		// Create panel
		this.panel = document.createElement( 'div' );
		this.panel.className = 'layers-shape-library-panel';
		this.panel.setAttribute( 'role', 'dialog' );
		this.panel.setAttribute( 'aria-label', mw.message( 'layers-shape-library-title' ).text() );
		this.panel.style.cssText = `
			display: none;
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 800px;
			max-width: 90vw;
			height: 600px;
			max-height: 80vh;
			background: var(--background-color-base, #fff);
			border-radius: 8px;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
			z-index: 1000011;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;

		// Header
		const header = document.createElement( 'div' );
		header.className = 'layers-shape-library-header';
		header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			border-bottom: 1px solid var(--border-color-base, #a2a9b1);
			background: var(--background-color-interactive, #f8f9fa);
		`;

		const title = document.createElement( 'h2' );
		title.textContent = mw.message( 'layers-shape-library-title' ).text();
		title.style.cssText = `
			margin: 0;
			font-size: 18px;
			font-weight: 600;
			color: var(--color-base, #202122);
		`;

		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-shape-library-close';
		closeBtn.setAttribute( 'aria-label', mw.message( 'layers-close' ).text() );
		closeBtn.innerHTML = '&times;';
		closeBtn.style.cssText = `
			background: none;
			border: none;
			font-size: 24px;
			cursor: pointer;
			padding: 4px 8px;
			color: var(--color-base, #202122);
			line-height: 1;
		`;

		header.appendChild( title );
		header.appendChild( closeBtn );

		// Search bar
		const searchBar = document.createElement( 'div' );
		searchBar.className = 'layers-shape-library-search';
		searchBar.style.cssText = `
			padding: 12px 16px;
			border-bottom: 1px solid var(--border-color-base, #a2a9b1);
		`;

		this.searchInput = document.createElement( 'input' );
		this.searchInput.type = 'text';
		this.searchInput.placeholder = mw.message( 'layers-shape-library-search' ).text();
		this.searchInput.className = 'layers-shape-library-search-input';
		this.searchInput.style.cssText = `
			width: 100%;
			padding: 8px 12px;
			border: 1px solid var(--border-color-base, #a2a9b1);
			border-radius: 4px;
			font-size: 14px;
			background: var(--background-color-base, #fff);
			color: var(--color-base, #202122);
		`;

		searchBar.appendChild( this.searchInput );

		// Content area
		const content = document.createElement( 'div' );
		content.className = 'layers-shape-library-content';
		content.style.cssText = `
			display: flex;
			flex: 1;
			overflow: hidden;
		`;

		// Category sidebar
		this.categoryList = document.createElement( 'div' );
		this.categoryList.className = 'layers-shape-library-categories';
		this.categoryList.style.cssText = `
			width: 200px;
			border-right: 1px solid var(--border-color-base, #a2a9b1);
			overflow-y: auto;
			background: var(--background-color-interactive, #f8f9fa);
		`;

		// Shape grid
		this.shapeGrid = document.createElement( 'div' );
		this.shapeGrid.className = 'layers-shape-library-grid';
		this.shapeGrid.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 12px;
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
			gap: 8px;
			align-content: start;
		`;

		content.appendChild( this.categoryList );
		content.appendChild( this.shapeGrid );

		// Assemble panel
		this.panel.appendChild( header );
		this.panel.appendChild( searchBar );
		this.panel.appendChild( content );

		// Add to container
		this.container.appendChild( this.overlay );
		this.container.appendChild( this.panel );

		// Build category list
		this.buildCategories();
	};

	/**
	 * Build the category list
	 *
	 * @private
	 */
	ShapeLibraryPanel.prototype.buildCategories = function () {
		const self = this;
		const categories = window.Layers.ShapeLibrary.getCategories();

		this.categoryList.innerHTML = '';

		categories.forEach( function ( cat ) {
			const count = window.Layers.ShapeLibrary.getShapesByCategory( cat.id ).length;

			const item = document.createElement( 'button' );
			item.className = 'layers-shape-library-category';
			item.dataset.category = cat.id;
			item.style.cssText = `
				display: flex;
				align-items: center;
				width: 100%;
				padding: 10px 12px;
				border: none;
				background: transparent;
				text-align: left;
				cursor: pointer;
				font-size: 13px;
				color: var(--color-base, #202122);
				transition: background 0.15s;
			`;

			// Color indicator
			const indicator = document.createElement( 'span' );
			indicator.style.cssText = `
				width: 12px;
				height: 12px;
				border-radius: 2px;
				margin-right: 8px;
				background: ${ cat.color };
			`;

			// Text container
			const textContainer = document.createElement( 'span' );
			textContainer.style.cssText = `
				flex: 1;
				display: flex;
				flex-direction: column;
			`;

			const nameSpan = document.createElement( 'span' );
			nameSpan.textContent = cat.name;
			nameSpan.style.fontWeight = '500';

			const countSpan = document.createElement( 'span' );
			countSpan.textContent = mw.message( 'layers-shape-library-count', count ).text();
			countSpan.style.cssText = `
				font-size: 11px;
				color: var(--color-subtle, #72777d);
			`;

			textContainer.appendChild( nameSpan );
			textContainer.appendChild( countSpan );

			item.appendChild( indicator );
			item.appendChild( textContainer );

			// Active state
			if ( cat.id === self.activeCategory ) {
				item.style.background = 'var(--background-color-interactive-subtle, #eaecf0)';
			}

			item.addEventListener( 'click', function () {
				self.selectCategory( cat.id );
			} );

			self.categoryList.appendChild( item );
		} );
	};

	/**
	 * Select a category
	 *
	 * @param {string} categoryId - Category ID
	 */
	ShapeLibraryPanel.prototype.selectCategory = function ( categoryId ) {
		this.activeCategory = categoryId;
		this.searchInput.value = '';

		// Update category buttons
		const buttons = this.categoryList.querySelectorAll( '.layers-shape-library-category' );
		buttons.forEach( function ( btn ) {
			if ( btn.dataset.category === categoryId ) {
				btn.style.background = 'var(--background-color-interactive-subtle, #eaecf0)';
			} else {
				btn.style.background = 'transparent';
			}
		} );

		// Show shapes
		this.showShapes( window.Layers.ShapeLibrary.getShapesByCategory( categoryId ) );
	};

	/**
	 * Show shapes in the grid
	 *
	 * @param {Object[]} shapes - Array of shape objects
	 */
	ShapeLibraryPanel.prototype.showShapes = function ( shapes ) {
		const self = this;
		this.shapeGrid.innerHTML = '';

		if ( shapes.length === 0 ) {
			const empty = document.createElement( 'div' );
			empty.textContent = mw.message( 'layers-shape-library-empty' ).text();
			empty.style.cssText = `
				grid-column: 1 / -1;
				text-align: center;
				padding: 40px;
				color: var(--color-subtle, #72777d);
			`;
			this.shapeGrid.appendChild( empty );
			return;
		}

		shapes.forEach( function ( shape ) {
			const item = document.createElement( 'button' );
			item.className = 'layers-shape-library-item';
			item.title = shape.name;
			item.style.cssText = `
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 8px;
				border: 1px solid var(--border-color-base, #a2a9b1);
				border-radius: 4px;
				background: var(--background-color-base, #fff);
				cursor: pointer;
				transition: border-color 0.15s, box-shadow 0.15s;
			`;

			// SVG preview
			const preview = document.createElement( 'div' );
			preview.className = 'layers-shape-library-preview';
			preview.style.cssText = `
				width: 60px;
				height: 60px;
				display: flex;
				align-items: center;
				justify-content: center;
			`;
			preview.innerHTML = shape.svg;

			// Scale SVG to fit
			const svg = preview.querySelector( 'svg' );
			if ( svg ) {
				svg.style.cssText = `
					max-width: 100%;
					max-height: 100%;
					width: auto;
					height: auto;
				`;
				// Ensure viewBox is set
				if ( !svg.getAttribute( 'viewBox' ) && shape.viewBox ) {
					svg.setAttribute( 'viewBox', shape.viewBox.join( ' ' ) );
				}
			}

			// Name label
			const label = document.createElement( 'span' );
			label.className = 'layers-shape-library-label';
			label.textContent = self.truncateName( shape.name );
			label.style.cssText = `
				margin-top: 4px;
				font-size: 10px;
				text-align: center;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				width: 100%;
				color: var(--color-base, #202122);
			`;

			item.appendChild( preview );
			item.appendChild( label );

			// Hover effect
			item.addEventListener( 'mouseenter', function () {
				this.style.borderColor = 'var(--color-progressive, #36c)';
				this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
			} );
			item.addEventListener( 'mouseleave', function () {
				this.style.borderColor = 'var(--border-color-base, #a2a9b1)';
				this.style.boxShadow = 'none';
			} );

			// Click to select
			item.addEventListener( 'click', function () {
				self.selectShape( shape );
			} );

			self.shapeGrid.appendChild( item );
		} );
	};

	/**
	 * Truncate shape name for display
	 *
	 * @param {string} name - Shape name
	 * @return {string} Truncated name
	 */
	ShapeLibraryPanel.prototype.truncateName = function ( name ) {
		// Extract just the descriptive part if it has a code
		const match = name.match( /^[A-Z]\d+:\s*(.+)$/ );
		if ( match ) {
			name = match[ 1 ];
		}

		// Truncate if too long
		if ( name.length > 15 ) {
			return name.substring( 0, 12 ) + '...';
		}
		return name;
	};

	/**
	 * Select a shape
	 *
	 * @param {Object} shape - Shape object
	 */
	ShapeLibraryPanel.prototype.selectShape = function ( shape ) {
		this.close();
		this.onSelect( shape );
	};

	/**
	 * Bind event listeners
	 *
	 * @private
	 */
	ShapeLibraryPanel.prototype.bindEvents = function () {
		const self = this;

		// Close button
		const closeBtn = this.panel.querySelector( '.layers-shape-library-close' );
		closeBtn.addEventListener( 'click', function () {
			self.close();
		} );

		// Overlay click
		this.overlay.addEventListener( 'click', function () {
			self.close();
		} );

		// Escape key
		document.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' && self.isOpen ) {
				self.close();
			}
		} );

		// Search input
		let searchTimeout;
		this.searchInput.addEventListener( 'input', function () {
			clearTimeout( searchTimeout );
			const query = this.value.trim();

			searchTimeout = setTimeout( function () {
				if ( query.length >= 2 ) {
					const results = window.Layers.ShapeLibrary.search( query );
					self.showShapes( results );

					// Clear category selection
					const buttons = self.categoryList.querySelectorAll( '.layers-shape-library-category' );
					buttons.forEach( function ( btn ) {
						btn.style.background = 'transparent';
					} );
				} else if ( query.length === 0 ) {
					self.selectCategory( self.activeCategory );
				}
			}, 200 );
		} );
	};

	/**
	 * Open the panel
	 */
	ShapeLibraryPanel.prototype.open = function () {
		// Check if library is loaded
		if ( !window.Layers || !window.Layers.ShapeLibrary ) {
			mw.notify( mw.message( 'layers-shape-library-not-loaded' ).text(), { type: 'error' } );
			return;
		}

		this.isOpen = true;
		this.overlay.style.display = 'block';
		this.panel.style.display = 'flex';

		// Focus search input
		this.searchInput.focus();

		// Show initial category
		this.selectCategory( this.activeCategory );
	};

	/**
	 * Close the panel
	 */
	ShapeLibraryPanel.prototype.close = function () {
		this.isOpen = false;
		this.overlay.style.display = 'none';
		this.panel.style.display = 'none';
	};

	/**
	 * Destroy the panel
	 */
	ShapeLibraryPanel.prototype.destroy = function () {
		if ( this.panel && this.panel.parentNode ) {
			this.panel.parentNode.removeChild( this.panel );
		}
		if ( this.overlay && this.overlay.parentNode ) {
			this.overlay.parentNode.removeChild( this.overlay );
		}
	};

	// Export
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibraryPanel = ShapeLibraryPanel;

}() );
