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

		positions.forEach( function ( pos ) {
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

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.IconFactory = IconFactory;

			// DEPRECATED: Direct window export - use window.Layers.UI.IconFactory instead
			// This will be removed in a future version
		window.IconFactory = IconFactory;
	}

	// Node.js/CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = IconFactory;
	}
}() );
