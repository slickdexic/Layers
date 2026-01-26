/**
 * Emoji Picker Panel for Layers Extension
 *
 * Provides a modal dialog for browsing and selecting emoji from the Noto Emoji library.
 * Emoji are organized by category with search functionality.
 * SVGs are loaded on-demand for performance.
 *
 * @file
 */

( function () {
	'use strict';

	/**
	 * EmojiPickerPanel class
	 *
	 * @class
	 * @param {Object} options - Configuration options
	 * @param {Function} options.onSelect - Callback when emoji is selected, receives { id, svg, viewBox, name }
	 */
	class EmojiPickerPanel {
		constructor( options ) {
			this.options = options || {};
			this.onSelect = this.options.onSelect || function () {};
			this.panel = null;
			this.overlay = null;
			this.categoryList = null;
			this.emojiGrid = null;
			this.searchInput = null;
			this.currentCategory = null;
			this.searchTimeout = null;
			this.isOpen = false;
			this.thumbnailObserver = null;

			// Bound event handlers for cleanup
			this._boundEscapeHandler = null;
			this._boundOverlayClickHandler = null;
		}

		/**
		 * Open the emoji picker panel
		 */
		open() {
			if ( this.isOpen ) {
				this.close();
				return;
			}

			this.createPanel();
			this.isOpen = true;

			// Focus search input
			if ( this.searchInput ) {
				this.searchInput.focus();
			}
		}

		/**
		 * Close the emoji picker panel
		 */
		close() {
			// Clean up search timeout
			if ( this.searchTimeout ) {
				clearTimeout( this.searchTimeout );
				this.searchTimeout = null;
			}
			// Clean up observer
			if ( this.thumbnailObserver ) {
				this.thumbnailObserver.disconnect();
				this.thumbnailObserver = null;
			}
			if ( this.overlay ) {
				this.overlay.remove();
				this.overlay = null;
			}
			if ( this.panel ) {
				this.panel.remove();
				this.panel = null;
			}
			if ( this._boundEscapeHandler ) {
				document.removeEventListener( 'keydown', this._boundEscapeHandler );
				this._boundEscapeHandler = null;
			}
			if ( this._boundOverlayClickHandler ) {
				// Overlay may already be removed, but clean up the reference
				this._boundOverlayClickHandler = null;
			}
			this.isOpen = false;
		}

		/**
		 * Create the panel DOM structure
		 */
		createPanel() {
			const library = window.Layers && window.Layers.EmojiLibrary;

			if ( !library ) {
				mw.notify( mw.message( 'layers-emoji-not-loaded' ).text() || 'Emoji library not loaded', { type: 'error' } );
				return;
			}

			// Start loading the emoji bundle in background for faster emoji loading
			if ( library.loadBundle ) {
				library.loadBundle();
			}

			// Inject CSS keyframes for loading animation if not already present
			if ( !document.getElementById( 'layers-emoji-picker-styles' ) ) {
				const style = document.createElement( 'style' );
				style.id = 'layers-emoji-picker-styles';
				style.textContent = `
					@keyframes layers-emoji-pulse {
						0%, 100% { opacity: 0.4; }
						50% { opacity: 0.7; }
					}
				`;
				document.head.appendChild( style );
			}

			const Z_INDEX = window.Layers.Constants.Z_INDEX;

			// Create overlay
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'layers-emoji-picker-overlay';
			this.overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.5);
				z-index: ${ Z_INDEX.LIBRARY_PANEL };
			`;

			// Create panel
			this.panel = document.createElement( 'div' );
			this.panel.className = 'layers-emoji-picker';
			this.panel.setAttribute( 'role', 'dialog' );
			this.panel.setAttribute( 'aria-label', mw.message( 'layers-emoji-picker-title' ).text() || 'Emoji Picker' );
			this.panel.style.cssText = `
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
				z-index: ${ Z_INDEX.LIBRARY_OVERLAY };
				display: flex;
				flex-direction: column;
				overflow: hidden;
			`;

			// Header
			const header = document.createElement( 'div' );
			header.className = 'layers-emoji-picker-header';
			header.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--border-color-base, #a2a9b1);
				background: var(--background-color-interactive, #f8f9fa);
			`;

			const title = document.createElement( 'h2' );
			title.textContent = mw.message( 'layers-emoji-picker-title' ).text() || 'Emoji Picker';
			title.style.cssText = `
				margin: 0;
				font-size: 18px;
				font-weight: 600;
				color: var(--color-base, #202122);
			`;

			const closeBtn = document.createElement( 'button' );
			closeBtn.className = 'layers-emoji-picker-close';
			closeBtn.setAttribute( 'aria-label', mw.message( 'layers-close' ).text() || 'Close' );
			closeBtn.innerHTML = '&times;';
			closeBtn.style.cssText = `
				background: transparent;
				border: 0;
				font-size: 24px;
				cursor: pointer;
				padding: 4px 8px;
				color: var(--color-base, #202122);
				line-height: 1;
			`;
			closeBtn.addEventListener( 'click', () => this.close() );

			header.appendChild( title );
			header.appendChild( closeBtn );

			// Search bar
			const searchBar = document.createElement( 'div' );
			searchBar.className = 'layers-emoji-picker-search';
			searchBar.style.cssText = `
				padding: 12px 16px;
				border-bottom: 1px solid var(--border-color-base, #a2a9b1);
			`;

			this.searchInput = document.createElement( 'input' );
			this.searchInput.type = 'text';
			this.searchInput.placeholder = mw.message( 'layers-emoji-search-placeholder' ).text() || 'Search emoji...';
			this.searchInput.className = 'layers-emoji-picker-search-input';
			this.searchInput.style.cssText = `
				width: 100%;
				padding: 8px 12px;
				border: 1px solid var(--border-color-base, #a2a9b1);
				border-radius: 4px;
				font-size: 14px;
				background: var(--background-color-base, #fff);
				color: var(--color-base, #202122);
			`;
			this.searchInput.addEventListener( 'input', () => {
				clearTimeout( this.searchTimeout );
				this.searchTimeout = setTimeout( () => {
					this.search( this.searchInput.value );
				}, 200 );
			} );

			searchBar.appendChild( this.searchInput );

			// Content area
			const content = document.createElement( 'div' );
			content.className = 'layers-emoji-picker-content';
			content.style.cssText = `
				display: flex;
				flex: 1;
				overflow: hidden;
			`;

			// Category sidebar
			this.categoryList = document.createElement( 'div' );
			this.categoryList.className = 'layers-emoji-picker-categories';
			this.categoryList.style.cssText = `
				width: 200px;
				border-right: 1px solid var(--border-color-base, #a2a9b1);
				overflow-y: auto;
				background: var(--background-color-interactive, #f8f9fa);
			`;

			// Emoji grid
			this.emojiGrid = document.createElement( 'div' );
			this.emojiGrid.className = 'layers-emoji-picker-grid';
			this.emojiGrid.style.cssText = `
				flex: 1;
				overflow-y: auto;
				padding: 12px;
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
				gap: 4px;
				align-content: start;
			`;

			content.appendChild( this.categoryList );
			content.appendChild( this.emojiGrid );

			// Assemble panel
			this.panel.appendChild( header );
			this.panel.appendChild( searchBar );
			this.panel.appendChild( content );

			// Add to document
			document.body.appendChild( this.overlay );
			document.body.appendChild( this.panel );

			// Build category list
			this.buildCategories();

			// Select first category
			const categories = library.getCategories();
			if ( categories.length > 0 ) {
				this.selectCategory( categories[ 0 ].id );
			}

			// Event handlers
			this._boundEscapeHandler = ( e ) => {
				if ( e.key === 'Escape' ) {
					this.close();
				}
			};
			document.addEventListener( 'keydown', this._boundEscapeHandler );

			this._boundOverlayClickHandler = () => this.close();
			this.overlay.addEventListener( 'click', this._boundOverlayClickHandler );
		}

		/**
		 * Build the category list
		 */
		buildCategories() {
			const library = window.Layers.EmojiLibrary;
			const categories = library.getCategories();

			this.categoryList.innerHTML = '';

			// Category colors for visual distinction
			const categoryColors = {
				smileys: '#FFD93D',
				people: '#FFB6C1',
				animals: '#98D8C8',
				food: '#F7DC6F',
				travel: '#87CEEB',
				activities: '#DDA0DD',
				objects: '#B0C4DE',
				symbols: '#E6E6FA',
				flags: '#90EE90'
			};

			categories.forEach( ( cat ) => {
				const item = document.createElement( 'button' );
				item.className = 'layers-emoji-picker-category';
				item.dataset.category = cat.id;
				item.style.cssText = `
					display: flex;
					align-items: center;
					width: 100%;
					padding: 10px 12px;
					border: 0;
					background: transparent;
					text-align: left;
					cursor: pointer;
					font-size: 13px;
					color: var(--color-base, #202122);
					transition: background 0.15s;
					border-left: 3px solid transparent;
				`;

				// Icon
				const icon = document.createElement( 'span' );
				icon.textContent = cat.icon;
				icon.style.cssText = `
					font-size: 20px;
					margin-right: 10px;
				`;

				// Color indicator
				const indicator = document.createElement( 'span' );
				indicator.style.cssText = `
					width: 12px;
					height: 12px;
					border-radius: 2px;
					margin-right: 8px;
					background: ${ categoryColors[ cat.id ] || '#ccc' };
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
				countSpan.textContent = cat.count + ' emoji';
				countSpan.style.cssText = `
					font-size: 11px;
					color: var(--color-subtle, #72777d);
				`;

				textContainer.appendChild( nameSpan );
				textContainer.appendChild( countSpan );

				item.appendChild( icon );
				item.appendChild( indicator );
				item.appendChild( textContainer );

				// Hover effect
				item.addEventListener( 'mouseenter', () => {
					if ( cat.id !== this.currentCategory ) {
						item.style.background = 'var(--background-color-interactive-subtle, #eaecf0)';
					}
				} );
				item.addEventListener( 'mouseleave', () => {
					if ( cat.id !== this.currentCategory ) {
						item.style.background = 'transparent';
					}
				} );

				item.addEventListener( 'click', () => {
					this.selectCategory( cat.id );
				} );

				this.categoryList.appendChild( item );
			} );
		}

		/**
		 * Select a category and display its emoji
		 *
		 * @param {string} categoryId
		 */
		selectCategory( categoryId ) {
			const library = window.Layers.EmojiLibrary;

			// Update category button styles
			const categoryButtons = this.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			categoryButtons.forEach( ( btn ) => {
				if ( btn.dataset.category === categoryId ) {
					btn.style.background = 'var(--background-color-progressive-subtle, #eaf3ff)';
					btn.style.borderLeft = '3px solid var(--color-progressive, #36c)';
				} else {
					btn.style.background = 'transparent';
					btn.style.borderLeft = '3px solid transparent';
				}
			} );

			this.currentCategory = categoryId;

			// Get emoji for this category
			const emoji = library.getByCategory( categoryId );

			// Clear and populate grid
			this.emojiGrid.innerHTML = '';
			this.renderEmojiGrid( emoji );
		}

		/**
		 * Render emoji items to the grid with lazy-loaded SVG thumbnails
		 *
		 * @param {Array} emoji - Array of emoji objects { f: filename, c: char, n: name, k: keywords }
		 */
		renderEmojiGrid( emoji ) {
			// Set up intersection observer for lazy loading
			if ( !this.thumbnailObserver ) {
				this.thumbnailObserver = new IntersectionObserver( ( entries ) => {
					entries.forEach( ( entry ) => {
						if ( entry.isIntersecting ) {
							this.loadThumbnail( entry.target );
							this.thumbnailObserver.unobserve( entry.target );
						}
					} );
				}, {
					root: this.emojiGrid,
					rootMargin: '100px', // Load slightly before visible
					threshold: 0
				} );
			}

			emoji.forEach( ( e ) => {
				const item = document.createElement( 'button' );
				item.className = 'layers-emoji-picker-item';
				// Use descriptive name if available, otherwise fallback to codepoint
				item.title = e.n || e.f.replace( /^emoji_u/, '' ).replace( /_/g, ' ' ).replace( /\.svg$/, '' );
				item.dataset.filename = e.f;
				item.style.cssText = `
					background: transparent;
					border: 0;
					padding: 4px;
					width: 48px;
					height: 48px;
					cursor: pointer;
					border-radius: 4px;
					transition: background 0.15s, transform 0.1s;
					display: flex;
					align-items: center;
					justify-content: center;
					overflow: hidden;
				`;

				// Placeholder spinner while loading
				const placeholder = document.createElement( 'div' );
				placeholder.className = 'layers-emoji-placeholder';
				placeholder.style.cssText = `
					width: 32px;
					height: 32px;
					background: var(--background-color-interactive-subtle, #f0f0f0);
					border-radius: 4px;
					animation: layers-emoji-pulse 1.5s ease-in-out infinite;
				`;
				item.appendChild( placeholder );

				item.addEventListener( 'mouseenter', () => {
					item.style.background = 'var(--background-color-interactive-subtle, #f0f0f0)';
					item.style.transform = 'scale(1.1)';
				} );
				item.addEventListener( 'mouseleave', () => {
					item.style.background = 'transparent';
					item.style.transform = 'scale(1)';
				} );

				item.addEventListener( 'click', () => {
					this.insertEmoji( e.f );
				} );

				this.emojiGrid.appendChild( item );

				// Observe for lazy loading
				this.thumbnailObserver.observe( item );
			} );
		}

		/**
		 * Load SVG thumbnail for an emoji item
		 *
		 * @param {HTMLElement} item - The button element
		 */
		loadThumbnail( item ) {
			const filename = item.dataset.filename;
			const library = window.Layers.EmojiLibrary;

			library.loadSVG( filename )
				.then( ( svg ) => {
					// Clear placeholder
					item.innerHTML = '';

					// Create thumbnail container
					const thumb = document.createElement( 'div' );
					thumb.className = 'layers-emoji-thumb';
					thumb.style.cssText = `
						width: 36px;
						height: 36px;
						display: flex;
						align-items: center;
						justify-content: center;
					`;

					// Parse and sanitize SVG for thumbnail use
					const svgContent = this.prepareSvgThumbnail( svg );
					thumb.innerHTML = svgContent;

					item.appendChild( thumb );
				} )
				.catch( () => {
					// Show fallback on error
					item.innerHTML = '';
					const fallback = document.createElement( 'span' );
					fallback.textContent = '?';
					fallback.style.cssText = `
						font-size: 20px;
						color: var(--color-subtle, #999);
					`;
					item.appendChild( fallback );
				} );
		}

		/**
		 * Prepare SVG for use as a thumbnail
		 * Makes IDs unique to prevent conflicts while preserving gradient references
		 *
		 * @param {string} svg - Raw SVG content
		 * @return {string} Sanitized SVG suitable for thumbnail display
		 */
		prepareSvgThumbnail( svg ) {
			// Generate unique prefix for this thumbnail
			const uniqueId = 'et' + Math.random().toString( 36 ).substr( 2, 6 );

			// Create a temporary container to parse the SVG
			const temp = document.createElement( 'div' );
			temp.innerHTML = svg;
			const svgEl = temp.querySelector( 'svg' );

			if ( !svgEl ) {
				return '<span style="color:#999">?</span>';
			}

			// Set dimensions for thumbnail
			svgEl.setAttribute( 'width', '36' );
			svgEl.setAttribute( 'height', '36' );
			svgEl.style.width = '36px';
			svgEl.style.height = '36px';

			// Make IDs unique to prevent conflicts between multiple emoji
			// This preserves gradient/clip-path references while avoiding collisions
			const idMap = new Map();

			// First pass: collect and rename all IDs
			svgEl.querySelectorAll( '[id]' ).forEach( ( el ) => {
				const oldId = el.getAttribute( 'id' );
				const newId = uniqueId + '_' + oldId;
				idMap.set( oldId, newId );
				el.setAttribute( 'id', newId );
			} );

			// Second pass: update all url() references to use new IDs
			if ( idMap.size > 0 ) {
				const allElements = svgEl.querySelectorAll( '*' );
				allElements.forEach( ( el ) => {
					// Check style attribute for url() references
					const style = el.getAttribute( 'style' );
					if ( style ) {
						let newStyle = style;
						idMap.forEach( ( newId, oldId ) => {
							// Replace url(#oldId) with url(#newId)
							const pattern = new RegExp( 'url\\(#' + oldId.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '\\)', 'g' );
							newStyle = newStyle.replace( pattern, 'url(#' + newId + ')' );
						} );
						if ( newStyle !== style ) {
							el.setAttribute( 'style', newStyle );
						}
					}

					// Check fill, stroke, clip-path, mask attributes
					[ 'fill', 'stroke', 'clip-path', 'mask', 'filter' ].forEach( ( attr ) => {
						const val = el.getAttribute( attr );
						if ( val && val.startsWith( 'url(#' ) ) {
							const match = val.match( /url\(#([^)]+)\)/ );
							if ( match && idMap.has( match[ 1 ] ) ) {
								el.setAttribute( attr, 'url(#' + idMap.get( match[ 1 ] ) + ')' );
							}
						}
					} );
				} );

				// Also check xlink:href for gradients/patterns
				svgEl.querySelectorAll( '[xlink\\:href], [href]' ).forEach( ( el ) => {
					[ 'xlink:href', 'href' ].forEach( ( attr ) => {
						const val = el.getAttribute( attr );
						if ( val && val.startsWith( '#' ) ) {
							const oldId = val.substring( 1 );
							if ( idMap.has( oldId ) ) {
								el.setAttribute( attr, '#' + idMap.get( oldId ) );
							}
						}
					} );
				} );
			}

			return svgEl.outerHTML;
		}

		/**
		 * Search emoji across all categories
		 *
		 * @param {string} query
		 */
		search( query ) {
			const library = window.Layers.EmojiLibrary;

			if ( !query || query.length < 2 ) {
				// Reset to current category
				if ( this.currentCategory ) {
					this.selectCategory( this.currentCategory );
				}
				return;
			}

			const searchQuery = query.toLowerCase();

			// Search across all categories
			const results = [];
			const categories = library.getCategories();

			categories.forEach( ( cat ) => {
				const emoji = library.getByCategory( cat.id );
				emoji.forEach( ( e ) => {
					// Search in name, keywords, and character
					const name = ( e.n || '' ).toLowerCase();
					const keywords = ( e.k || '' ).toLowerCase();
					const filename = e.f.toLowerCase().replace( /^emoji_u/, '' ).replace( /_/g, ' ' );

					if ( name.includes( searchQuery ) ||
						keywords.includes( searchQuery ) ||
						filename.includes( searchQuery ) ||
						( e.c && e.c.includes( query ) ) ) {
						results.push( e );
					}
				} );
			} );

			// Clear category selection styling
			const categoryButtons = this.categoryList.querySelectorAll( '.layers-emoji-picker-category' );
			categoryButtons.forEach( ( btn ) => {
				btn.style.background = 'transparent';
				btn.style.borderLeft = '3px solid transparent';
			} );

			// Clear and populate grid
			this.emojiGrid.innerHTML = '';

			if ( results.length === 0 ) {
				const noResults = document.createElement( 'div' );
				noResults.className = 'layers-emoji-picker-no-results';
				noResults.textContent = mw.message( 'layers-emoji-no-results' ).text() || 'No emoji found';
				noResults.style.cssText = `
					grid-column: 1 / -1;
					text-align: center;
					padding: 40px 20px;
					color: var(--color-subtle, #666);
					font-size: 14px;
				`;
				this.emojiGrid.appendChild( noResults );
			} else {
				// Show result count
				const resultInfo = document.createElement( 'div' );
				resultInfo.textContent = `Found ${ results.length } emoji`;
				resultInfo.style.cssText = `
					grid-column: 1 / -1;
					padding: 8px 4px;
					color: var(--color-subtle, #666);
					font-size: 12px;
					border-bottom: 1px solid var(--border-color-base, #eee);
					margin-bottom: 8px;
				`;
				this.emojiGrid.appendChild( resultInfo );

				this.renderEmojiGrid( results );
			}
		}

		/**
		/**
		 * Insert an emoji by calling the onSelect callback
		 *
		 * @param {string} filename
		 */
		insertEmoji( filename ) {
			const library = window.Layers.EmojiLibrary;

			// Show loading state
			const item = this.panel.querySelector( `[data-filename="${ filename }"]` );
			if ( item ) {
				item.style.opacity = '0.5';
				item.style.pointerEvents = 'none';
			}

			// Load the SVG
			library.loadSVG( filename )
				.then( ( svg ) => {
					// Parse viewBox - return as array [x, y, width, height] to match createCustomShapeLayer format
					let viewBox = [ 0, 0, 128, 128 ];
					const vbMatch = svg.match( /viewBox=["']([^"']+)["']/i );
					if ( vbMatch ) {
						const parts = vbMatch[ 1 ].trim().split( /\s+/ ).map( Number );
						if ( parts.length === 4 ) {
							viewBox = parts;
						}
					}

					// Create a readable name from the filename
					const name = 'Emoji: ' + filename
						.replace( /^emoji_u/, '' )
						.replace( /_/g, ' ' )
						.replace( /\.svg$/, '' );

					// Call the onSelect callback with shape data matching createCustomShapeLayer format
					this.onSelect( {
						id: 'emoji/' + filename.replace( /\.svg$/, '' ),
						svg: svg,
						viewBox: viewBox,
						name: name
					} );

					// Close panel after successful selection
					this.close();
				} )
				.catch( ( err ) => {
					mw.log.error( 'Failed to load emoji:', err );
					mw.notify( mw.message( 'layers-emoji-load-error' ).text() || 'Failed to load emoji', { type: 'error' } );
				} )
				.finally( () => {
					if ( item ) {
						item.style.opacity = '1';
						item.style.pointerEvents = 'auto';
					}
				} );
		}

		/**
		 * Destroy the panel and clean up all resources.
		 * Call this when the parent component is destroyed to prevent memory leaks.
		 */
		destroy() {
			this.close();
			// Clear all references to allow garbage collection
			this.options = null;
			this.onSelect = null;
			this.categoryList = null;
			this.emojiGrid = null;
			this.searchInput = null;
			this.currentCategory = null;
		}
	}

	// Export
	window.Layers = window.Layers || {};
	window.Layers.EmojiPickerPanel = EmojiPickerPanel;
}() );
