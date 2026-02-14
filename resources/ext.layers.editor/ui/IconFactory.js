/**
 * Icon Factory
 * Creates SVG icons for the Layers editor UI.
 *
 * @module IconFactory
 */
( function () {
	'use strict';

	/**
	 * SVG namespace
	 * @constant {string}
	 */
	const SVG_NS = 'http://www.w3.org/2000/svg';

	/**
	 * IconFactory provides static methods to create SVG icons
	 * @namespace IconFactory
	 */
	const IconFactory = {};

	/**
	 * Helper to set multiple attributes on an element
	 * @param {Element} element - DOM element
	 * @param {Object} attributes - Key-value pairs of attributes
	 */
	IconFactory.setAttributes = function ( element, attributes ) {
		for ( const key in attributes ) {
			if ( Object.prototype.hasOwnProperty.call( attributes, key ) ) {
				element.setAttribute( key, attributes[ key ] );
			}
		}
	};

	/**
	 * Create an SVG element with optional attributes
	 * @param {string} tag - SVG element tag name
	 * @param {Object} [attributes] - Attributes to set
	 * @return {SVGElement} The created SVG element
	 */
	IconFactory.createSVGElement = function ( tag, attributes ) {
		const element = document.createElementNS( SVG_NS, tag );
		if ( attributes ) {
			IconFactory.setAttributes( element, attributes );
		}
		return element;
	};

	/**
	 * Create an eye icon for visibility toggle
	 * Modern minimal design inspired by Feather icons
	 * @param {boolean} visible - Whether the layer is visible
	 * @return {SVGSVGElement} Eye icon SVG
	 */
	IconFactory.createEyeIcon = function ( visible ) {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '18',
			height: '18',
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true'
		} );

		const strokeColor = visible ? '#555' : '#aaa';

		if ( visible ) {
			// Eye path - visible state
			const eyePath = IconFactory.createSVGElement( 'path', {
				d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
				stroke: strokeColor,
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				fill: 'none'
			} );
			svg.appendChild( eyePath );

			// Pupil circle
			const pupil = IconFactory.createSVGElement( 'circle', {
				cx: '12',
				cy: '12',
				r: '3',
				stroke: strokeColor,
				'stroke-width': '2',
				fill: 'none'
			} );
			svg.appendChild( pupil );
		} else {
			// Eye-off path - hidden state
			const eyeOffPath = IconFactory.createSVGElement( 'path', {
				d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
				stroke: strokeColor,
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				fill: 'none'
			} );
			svg.appendChild( eyeOffPath );

			// Diagonal strike-through line
			const line = IconFactory.createSVGElement( 'line', {
				x1: '1',
				y1: '1',
				x2: '23',
				y2: '23',
				stroke: strokeColor,
				'stroke-width': '2',
				'stroke-linecap': 'round'
			} );
			svg.appendChild( line );
		}

		return svg;
	};

	/**
	 * Create a lock icon for lock toggle
	 * Modern minimal design inspired by Feather icons
	 * @param {boolean} locked - Whether the layer is locked
	 * @return {SVGSVGElement} Lock icon SVG
	 */
	IconFactory.createLockIcon = function ( locked ) {
		const strokeColor = locked ? '#d63031' : '#888';
		const opacity = locked ? '1' : '0.5';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: '16',
			height: '16',
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true',
			style: 'opacity: ' + opacity
		} );

		// Lock body rectangle
		const rect = IconFactory.createSVGElement( 'rect', {
			x: '3',
			y: '11',
			width: '18',
			height: '11',
			rx: '2',
			ry: '2',
			stroke: strokeColor,
			'stroke-width': '2',
			fill: 'none'
		} );
		svg.appendChild( rect );

		// Lock shackle
		const shackle = IconFactory.createSVGElement( 'path', {
			d: locked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1',
			stroke: strokeColor,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( shackle );

		return svg;
	};

	/**
	 * Create a delete/trash icon
	 * Modern minimal design inspired by Feather icons
	 * @return {SVGSVGElement} Delete icon SVG
	 */
	IconFactory.createDeleteIcon = function () {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '16',
			height: '16',
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true'
		} );

		// Trash can body and lid
		const path = IconFactory.createSVGElement( 'path', {
			d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( path );

		// Vertical lines inside
		const line1 = IconFactory.createSVGElement( 'line', {
			x1: '10',
			y1: '11',
			x2: '10',
			y2: '17',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line1 );

		const line2 = IconFactory.createSVGElement( 'line', {
			x1: '14',
			y1: '11',
			x2: '14',
			y2: '17',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line2 );

		return svg;
	};

	/**
	 * Create a grab/drag handle icon
	 * Modern 6-dot grip pattern (2 columns x 3 rows)
	 * @return {SVGSVGElement} Grab handle icon SVG
	 */
	IconFactory.createGrabIcon = function () {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '12',
			height: '18',
			viewBox: '0 0 12 18',
			fill: 'none',
			'aria-hidden': 'true'
		} );

		// Six dots in a 2x3 grid pattern (common drag handle design)
		const positions = [
			{ cx: 3, cy: 4 },
			{ cx: 9, cy: 4 },
			{ cx: 3, cy: 9 },
			{ cx: 9, cy: 9 },
			{ cx: 3, cy: 14 },
			{ cx: 9, cy: 14 }
		];

		positions.forEach( ( pos ) => {
			const circle = IconFactory.createSVGElement( 'circle', {
				cx: String( pos.cx ),
				cy: String( pos.cy ),
				r: '1.5',
				fill: '#bbb'
			} );
			svg.appendChild( circle );
		} );

		return svg;
	};

	/**
	 * Create a plus/add icon
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=20] - Icon size
	 * @param {string} [options.color='#666'] - Icon color
	 * @return {SVGSVGElement} Plus icon SVG
	 */
	IconFactory.createPlusIcon = function ( options ) {
		options = options || {};
		const size = options.size || 20;
		const color = options.color || '#666';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		// Horizontal line
		const h = IconFactory.createSVGElement( 'line', {
			x1: '5',
			y1: '12',
			x2: '19',
			y2: '12',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( h );

		// Vertical line
		const v = IconFactory.createSVGElement( 'line', {
			x1: '12',
			y1: '5',
			x2: '12',
			y2: '19',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( v );

		return svg;
	};

	/**
	 * Create a chevron/arrow icon
	 * @param {string} direction - Direction: 'up', 'down', 'left', 'right'
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=16] - Icon size
	 * @param {string} [options.color='#666'] - Icon color
	 * @return {SVGSVGElement} Chevron icon SVG
	 */
	IconFactory.createChevronIcon = function ( direction, options ) {
		options = options || {};
		const size = options.size || 16;
		const color = options.color || '#666';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		const paths = {
			up: 'M18 15l-6-6-6 6',
			down: 'M6 9l6 6 6-6',
			left: 'M15 18l-6-6 6-6',
			right: 'M9 6l6 6-6 6'
		};

		const path = IconFactory.createSVGElement( 'path', {
			d: paths[ direction ] || paths.down,
			fill: 'none',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		} );
		svg.appendChild( path );

		return svg;
	};

	/**
	 * Create a check/checkmark icon
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=16] - Icon size
	 * @param {string} [options.color='#27ae60'] - Icon color
	 * @return {SVGSVGElement} Check icon SVG
	 */
	IconFactory.createCheckIcon = function ( options ) {
		options = options || {};
		const size = options.size || 16;
		const color = options.color || '#27ae60';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		const path = IconFactory.createSVGElement( 'path', {
			d: 'M20 6L9 17l-5-5',
			fill: 'none',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		} );
		svg.appendChild( path );

		return svg;
	};

	/**
	 * Create a close/X icon
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=16] - Icon size
	 * @param {string} [options.color='#666'] - Icon color
	 * @return {SVGSVGElement} Close icon SVG
	 */
	IconFactory.createCloseIcon = function ( options ) {
		options = options || {};
		const size = options.size || 16;
		const color = options.color || '#666';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		// X shape (two lines)
		const line1 = IconFactory.createSVGElement( 'line', {
			x1: '6',
			y1: '6',
			x2: '18',
			y2: '18',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line1 );

		const line2 = IconFactory.createSVGElement( 'line', {
			x1: '18',
			y1: '6',
			x2: '6',
			y2: '18',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line2 );

		return svg;
	};

	/**
	 * Create a folder icon for group layers
	 * @param {boolean} [expanded=true] - Whether the folder is expanded
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=18] - Icon size
	 * @param {string} [options.color='#f39c12'] - Icon color (default golden yellow)
	 * @return {SVGSVGElement} Folder icon SVG
	 */
	IconFactory.createFolderIcon = function ( expanded, options ) {
		options = options || {};
		const size = options.size || 18;
		const color = options.color || '#f39c12';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		if ( expanded ) {
			// Open folder icon
			const path = IconFactory.createSVGElement( 'path', {
				d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z',
				fill: color,
				stroke: color,
				'stroke-width': '1.5',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round'
			} );
			svg.appendChild( path );

			// Open folder flap
			const flap = IconFactory.createSVGElement( 'path', {
				d: 'M2 10l2.5-2h17l-2.5 2',
				fill: 'none',
				stroke: '#fff',
				'stroke-width': '1',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				opacity: '0.5'
			} );
			svg.appendChild( flap );
		} else {
			// Closed folder icon
			const path = IconFactory.createSVGElement( 'path', {
				d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z',
				fill: color,
				stroke: color,
				'stroke-width': '1.5',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round'
			} );
			svg.appendChild( path );
		}

		return svg;
	};

	/**
	 * Create an expand/collapse toggle icon (triangle)
	 * @param {boolean} [expanded=true] - Whether expanded (pointing down) or collapsed (pointing right)
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=12] - Icon size
	 * @param {string} [options.color='#666'] - Icon color
	 * @return {SVGSVGElement} Triangle icon SVG
	 */
	IconFactory.createExpandIcon = function ( expanded, options ) {
		options = options || {};
		const size = options.size || 12;
		const color = options.color || '#666';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 12 12',
			'aria-hidden': 'true'
		} );

		// Rotate the triangle based on expanded state
		// Expanded (down): points down
		// Collapsed (right): points right
		const path = IconFactory.createSVGElement( 'path', {
			d: expanded ? 'M2 4l4 5 4-5z' : 'M4 2l5 4-5 4z',
			fill: color
		} );
		svg.appendChild( path );

		return svg;
	};

	/**
	 * Create a pencil/edit icon
	 * Modern minimal design for edit actions
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=18] - Icon size
	 * @param {string} [options.color='#fff'] - Icon color
	 * @return {SVGSVGElement} Pencil icon SVG
	 */
	IconFactory.createPencilIcon = function ( options ) {
		options = options || {};
		const size = options.size || 18;
		const color = options.color || '#fff';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true'
		} );

		// Pencil body with tip
		const path = IconFactory.createSVGElement( 'path', {
			d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( path );

		// Pencil edit line
		const editPath = IconFactory.createSVGElement( 'path', {
			d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( editPath );

		return svg;
	};

	/**
	 * Create an expand/fullscreen icon (diagonal arrows)
	 * Modern minimal design for view/expand actions
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=18] - Icon size
	 * @param {string} [options.color='#fff'] - Icon color
	 * @return {SVGSVGElement} Expand icon SVG
	 */
	IconFactory.createFullscreenIcon = function ( options ) {
		options = options || {};
		const size = options.size || 18;
		const color = options.color || '#fff';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true'
		} );

		// Top-right corner
		const path1 = IconFactory.createSVGElement( 'path', {
			d: 'M15 3h6v6',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( path1 );

		// Top-right diagonal
		const path2 = IconFactory.createSVGElement( 'path', {
			d: 'M9 21H3v-6',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			fill: 'none'
		} );
		svg.appendChild( path2 );

		// Diagonal lines
		const line1 = IconFactory.createSVGElement( 'line', {
			x1: '21',
			y1: '3',
			x2: '14',
			y2: '10',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line1 );

		const line2 = IconFactory.createSVGElement( 'line', {
			x1: '3',
			y1: '21',
			x2: '10',
			y2: '14',
			stroke: color,
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( line2 );

		return svg;
	};

	/**
	 * Create a folder icon with a plus badge (for "Add Folder" button)
	 * @param {Object} [options] - Icon options
	 * @param {number} [options.size=20] - Icon size
	 * @param {string} [options.folderColor='#f39c12'] - Folder color
	 * @param {string} [options.badgeColor='#4caf50'] - Plus badge color
	 * @return {SVGSVGElement} Folder with plus icon SVG
	 */
	IconFactory.createAddFolderIcon = function ( options ) {
		options = options || {};
		const size = options.size || 20;
		const folderColor = options.folderColor || '#f39c12';
		const badgeColor = options.badgeColor || '#4caf50';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		// Folder shape
		const folder = IconFactory.createSVGElement( 'path', {
			d: 'M20 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11z',
			fill: folderColor,
			stroke: folderColor,
			'stroke-width': '1',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		} );
		svg.appendChild( folder );

		// Plus badge circle background
		const badgeCircle = IconFactory.createSVGElement( 'circle', {
			cx: '18',
			cy: '17',
			r: '6',
			fill: badgeColor,
			stroke: '#fff',
			'stroke-width': '1.5'
		} );
		svg.appendChild( badgeCircle );

		// Plus sign horizontal line
		const plusH = IconFactory.createSVGElement( 'line', {
			x1: '15',
			y1: '17',
			x2: '21',
			y2: '17',
			stroke: '#fff',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( plusH );

		// Plus sign vertical line
		const plusV = IconFactory.createSVGElement( 'line', {
			x1: '18',
			y1: '14',
			x2: '18',
			y2: '20',
			stroke: '#fff',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( plusV );

		return svg;
	};

	/**
	 * Create the Layers logo icon (3 stacked diamond shapes)
	 * Based on the diamond layers from Layers_Logo.svg
	 * @param {number} [size=24] - Icon size in pixels
	 * @return {SVGSVGElement} Layers logo icon SVG
	 */
	IconFactory.createLayersLogoIcon = function ( size ) {
		size = size || 24;
		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( size ),
			height: String( size ),
			viewBox: '0 0 24 24',
			fill: 'none',
			'aria-hidden': 'true',
			class: 'layers-logo-icon'
		} );

		// Three stacked diamond shapes (from logo)
		// Top layer (teal/green #00af89)
		const topLayer = IconFactory.createSVGElement( 'path', {
			d: 'M4 6 L12 3 L20 6 L12 9 Z',
			fill: '#00af89'
		} );
		svg.appendChild( topLayer );

		// Middle layer (red #dd3333)
		const middleLayer = IconFactory.createSVGElement( 'path', {
			d: 'M4 10 L12 7 L20 10 L12 13 Z',
			fill: '#dd3333'
		} );
		svg.appendChild( middleLayer );

		// Bottom layer (blue #3366cc)
		const bottomLayer = IconFactory.createSVGElement( 'path', {
			d: 'M4 14 L12 11 L20 14 L12 17 Z',
			fill: '#3366cc'
		} );
		svg.appendChild( bottomLayer );

		return svg;
	};

	/**
	 * Create the full Layers brand logo with text
	 * Includes the L-bracket, "Layers" text, and 3 diamond shapes
	 * @param {number} [width=100] - Logo width in pixels (height auto-scales)
	 * @return {SVGSVGElement} Full Layers logo SVG
	 */
	IconFactory.createFullLayersLogo = function ( width ) {
		width = width || 100;
		// Original viewBox is 385x245, maintain aspect ratio
		const height = Math.round( width * ( 245 / 385 ) );

		const svg = IconFactory.createSVGElement( 'svg', {
			width: String( width ),
			height: String( height ),
			viewBox: '0 0 385 245',
			fill: 'none',
			'aria-hidden': 'true',
			class: 'layers-full-logo'
		} );

		// L-bracket path
		const bracket = IconFactory.createSVGElement( 'path', {
			d: 'M 19,6 V 226 H 379',
			stroke: '#3366cc',
			'stroke-width': '12',
			'stroke-linecap': 'square',
			fill: 'none'
		} );
		svg.appendChild( bracket );

		// Corner rectangle
		const corner = IconFactory.createSVGElement( 'rect', {
			x: '4',
			y: '211',
			width: '30',
			height: '30',
			fill: '#ffffff',
			stroke: '#3366cc',
			'stroke-width': '8'
		} );
		svg.appendChild( corner );

		// "Layers" text
		const text = IconFactory.createSVGElement( 'text', {
			x: '34',
			y: '196',
			fill: '#3366cc',
			'font-family': 'sans-serif',
			'font-weight': 'bold',
			'font-size': '95px',
			'letter-spacing': '-2'
		} );
		text.textContent = 'Layers';
		svg.appendChild( text );

		// Three diamond shapes (bottom to top stacking)
		// Bottom layer (blue)
		const blueLayer = IconFactory.createSVGElement( 'path', {
			d: 'M 44,96 204,61 364,96 204,131 Z',
			fill: '#3366cc'
		} );
		svg.appendChild( blueLayer );

		// Middle layer (red)
		const redLayer = IconFactory.createSVGElement( 'path', {
			d: 'M 44,66 204,31 364,66 204,101 Z',
			fill: '#dd3333'
		} );
		svg.appendChild( redLayer );

		// Top layer (teal/green)
		const tealLayer = IconFactory.createSVGElement( 'path', {
			d: 'M 44,36 204,1 364,36 204,71 Z',
			fill: '#00af89'
		} );
		svg.appendChild( tealLayer );

		return svg;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.IconFactory = IconFactory;
	}

	// Node.js/CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = IconFactory;
	}
}() );
