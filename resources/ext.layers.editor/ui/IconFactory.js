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
	 * @param {boolean} visible - Whether the layer is visible
	 * @return {SVGSVGElement} Eye icon SVG
	 */
	IconFactory.createEyeIcon = function ( visible ) {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '24',
			height: '24',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		// Eye outline (ellipse)
		const ellipse = IconFactory.createSVGElement( 'ellipse', {
			cx: '12',
			cy: '12',
			rx: '9',
			ry: '7',
			fill: 'none',
			'stroke-width': '2.5',
			stroke: visible ? '#666' : '#aaa'
		} );
		svg.appendChild( ellipse );

		if ( visible ) {
			// Pupil when visible
			const pupil = IconFactory.createSVGElement( 'circle', {
				cx: '12',
				cy: '12',
				r: '3.5',
				fill: '#666'
			} );
			svg.appendChild( pupil );
		} else {
			// Slash when hidden
			const slash = IconFactory.createSVGElement( 'line', {
				x1: '5',
				y1: '21',
				x2: '21',
				y2: '5',
				stroke: '#c00',
				'stroke-width': '2.5'
			} );
			svg.appendChild( slash );
		}

		return svg;
	};

	/**
	 * Create a lock icon for lock toggle
	 * @param {boolean} locked - Whether the layer is locked
	 * @return {SVGSVGElement} Lock icon SVG
	 */
	IconFactory.createLockIcon = function ( locked ) {
		const color = locked ? '#d63031' : '#27ae60';

		const svg = IconFactory.createSVGElement( 'svg', {
			width: '20',
			height: '20',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true',
			style: 'opacity: ' + ( locked ? '1' : '0.4' )
		} );

		// Lock body
		const rect = IconFactory.createSVGElement( 'rect', {
			x: '6',
			y: '10',
			width: '12',
			height: '10',
			rx: '1',
			ry: '1',
			fill: 'none',
			stroke: color,
			'stroke-width': '2'
		} );
		svg.appendChild( rect );

		// Lock shackle (closed when locked, open when unlocked)
		const path = IconFactory.createSVGElement( 'path', {
			fill: 'none',
			stroke: color,
			'stroke-width': '2',
			d: locked ? 'M9 10V8a3 3 0 0 1 6 0v2' : 'M9 10V6a3 3 0 0 1 6 0'
		} );
		svg.appendChild( path );

		// Keyhole dot
		const dot = IconFactory.createSVGElement( 'circle', {
			cx: '12',
			cy: '15',
			r: '1.5',
			fill: color
		} );
		svg.appendChild( dot );

		return svg;
	};

	/**
	 * Create a delete/trash icon
	 * @return {SVGSVGElement} Delete icon SVG
	 */
	IconFactory.createDeleteIcon = function () {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '20',
			height: '20',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true',
			style: 'opacity: 0.6'
		} );

		// Trash can outline
		const path = IconFactory.createSVGElement( 'path', {
			d: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
			fill: 'none',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		} );
		svg.appendChild( path );

		// Left trash line
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

		// Right trash line
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
	 * @return {SVGSVGElement} Grab handle icon SVG
	 */
	IconFactory.createGrabIcon = function () {
		const svg = IconFactory.createSVGElement( 'svg', {
			width: '24',
			height: '24',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		// Four dots in a 2x2 grid
		const positions = [
			{ cx: 7, cy: 7 },
			{ cx: 17, cy: 7 },
			{ cx: 7, cy: 17 },
			{ cx: 17, cy: 17 }
		];

		positions.forEach( function ( pos ) {
			const circle = IconFactory.createSVGElement( 'circle', {
				cx: String( pos.cx ),
				cy: String( pos.cy ),
				r: '2.5',
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

		// Backward compatibility - direct window export
		window.IconFactory = IconFactory;
	}

	// Node.js/CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = IconFactory;
	}
}() );
