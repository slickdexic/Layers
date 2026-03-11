/**
 * ViewerIcons - Shared SVG icon factory for viewer modules.
 *
 * Provides pencil (edit) and expand (fullscreen) icons used by
 * ViewerManager, ViewerOverlay, and SlideController.
 *
 * @namespace window.Layers.ViewerIcons
 */
( function () {
	'use strict';

	const SVG_NS = 'http://www.w3.org/2000/svg';

	/**
	 * Helper to create an SVG element with attributes.
	 *
	 * @param {string} tag SVG tag name
	 * @param {Object} attrs Attribute key-value pairs
	 * @return {SVGElement} The created element
	 */
	function svgEl( tag, attrs ) {
		const el = document.createElementNS( SVG_NS, tag );
		if ( attrs ) {
			for ( const key in attrs ) {
				el.setAttribute( key, attrs[ key ] );
			}
		}
		return el;
	}

	const ViewerIcons = {

		/**
		 * Create a pencil/edit icon SVG element.
		 *
		 * @param {Object} [options] Options
		 * @param {number} [options.size=16] Icon size in px
		 * @param {string} [options.color='#fff'] Stroke color
		 * @return {SVGElement} Pencil icon
		 */
		createPencilIcon( options ) {
			const size = ( options && options.size ) || 16;
			const color = ( options && options.color ) || '#fff';
			const strokeAttrs = {
				stroke: color,
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round'
			};

			const svg = svgEl( 'svg', {
				width: String( size ),
				height: String( size ),
				viewBox: '0 0 24 24',
				fill: 'none',
				'aria-hidden': 'true'
			} );

			const path1 = svgEl( 'path', Object.assign(
				{ d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' },
				strokeAttrs
			) );
			svg.appendChild( path1 );

			const path2 = svgEl( 'path', Object.assign(
				{ d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
				strokeAttrs
			) );
			svg.appendChild( path2 );

			return svg;
		},

		/**
		 * Create an expand/fullscreen icon SVG element.
		 *
		 * @param {Object} [options] Options
		 * @param {number} [options.size=16] Icon size in px
		 * @param {string} [options.color='#fff'] Stroke color
		 * @return {SVGElement} Expand icon
		 */
		createExpandIcon( options ) {
			const size = ( options && options.size ) || 16;
			const color = ( options && options.color ) || '#fff';
			const strokeAttrs = {
				stroke: color,
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round'
			};

			const svg = svgEl( 'svg', {
				width: String( size ),
				height: String( size ),
				viewBox: '0 0 24 24',
				fill: 'none',
				'aria-hidden': 'true'
			} );

			// Top-right corner
			svg.appendChild( svgEl( 'path', Object.assign(
				{ d: 'M15 3h6v6' }, strokeAttrs
			) ) );

			// Bottom-left corner
			svg.appendChild( svgEl( 'path', Object.assign(
				{ d: 'M9 21H3v-6' }, strokeAttrs
			) ) );

			// Diagonal line top-right
			svg.appendChild( svgEl( 'line', {
				x1: '21', y1: '3', x2: '14', y2: '10',
				stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round'
			} ) );

			// Diagonal line bottom-left
			svg.appendChild( svgEl( 'line', {
				x1: '3', y1: '21', x2: '10', y2: '14',
				stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round'
			} ) );

			return svg;
		}
	};

	// Register in Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ViewerIcons = ViewerIcons;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ViewerIcons;
	}
}() );
