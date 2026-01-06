/* eslint-env node */
/**
 * ShapeLibraryData - Built-in shape definitions organized by category
 *
 * All shapes use pure SVG path data (d attribute) for security.
 * No scripts, event handlers, or external references possible.
 *
 * @class
 */
class ShapeLibraryData {
	/**
	 * Get all available categories
	 *
	 * @returns {Array<Object>} Category definitions
	 */
	static getCategories() {
		return [
			{
				id: 'arrows',
				name: 'layers-shape-category-arrows',
				icon: '→'
			},
			{
				id: 'flowchart',
				name: 'layers-shape-category-flowchart',
				icon: '◇'
			},
			{
				id: 'callouts',
				name: 'layers-shape-category-callouts',
				icon: '💬'
			},
			{
				id: 'geometric',
				name: 'layers-shape-category-geometric',
				icon: '⬡'
			},
			{
				id: 'symbols',
				name: 'layers-shape-category-symbols',
				icon: '✓'
			},
			{
				id: 'decorative',
				name: 'layers-shape-category-decorative',
				icon: '🎀'
			}
		];
	}

	/**
	 * Get all shapes
	 *
	 * @returns {Array<Object>} All shape definitions
	 */
	static getAllShapes() {
		return [
			...ShapeLibraryData.getArrowShapes(),
			...ShapeLibraryData.getFlowchartShapes(),
			...ShapeLibraryData.getCalloutShapes(),
			...ShapeLibraryData.getGeometricShapes(),
			...ShapeLibraryData.getSymbolShapes(),
			...ShapeLibraryData.getDecorativeShapes()
		];
	}

	/**
	 * Get shapes by category
	 *
	 * @param {string} categoryId - Category identifier
	 * @returns {Array<Object>} Shapes in category
	 */
	static getShapesByCategory( categoryId ) {
		return ShapeLibraryData.getAllShapes().filter(
			( shape ) => shape.category === categoryId
		);
	}

	/**
	 * Get a shape by ID
	 *
	 * @param {string} shapeId - Shape identifier
	 * @returns {Object|null} Shape definition or null
	 */
	static getShapeById( shapeId ) {
		return ShapeLibraryData.getAllShapes().find(
			( shape ) => shape.id === shapeId
		) || null;
	}

	/**
	 * Arrow shapes
	 *
	 * @returns {Array<Object>} Arrow shape definitions
	 */
	static getArrowShapes() {
		return [
			{
				id: 'arrows/right',
				name: 'layers-shape-arrow-right',
				category: 'arrows',
				tags: [ 'arrow', 'right', 'next', 'forward', 'direction' ],
				path: 'M5 12 L15 12 L15 8 L22 12 L15 16 L15 12 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 80,
				defaultHeight: 40
			},
			{
				id: 'arrows/left',
				name: 'layers-shape-arrow-left',
				category: 'arrows',
				tags: [ 'arrow', 'left', 'back', 'previous', 'direction' ],
				path: 'M19 12 L9 12 L9 8 L2 12 L9 16 L9 12 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 80,
				defaultHeight: 40
			},
			{
				id: 'arrows/up',
				name: 'layers-shape-arrow-up',
				category: 'arrows',
				tags: [ 'arrow', 'up', 'top', 'direction' ],
				path: 'M12 19 L12 9 L8 9 L12 2 L16 9 L12 9 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 40,
				defaultHeight: 80
			},
			{
				id: 'arrows/down',
				name: 'layers-shape-arrow-down',
				category: 'arrows',
				tags: [ 'arrow', 'down', 'bottom', 'direction' ],
				path: 'M12 5 L12 15 L16 15 L12 22 L8 15 L12 15 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 40,
				defaultHeight: 80
			},
			{
				id: 'arrows/double-horizontal',
				name: 'layers-shape-arrow-double-h',
				category: 'arrows',
				tags: [ 'arrow', 'double', 'horizontal', 'both', 'bidirectional' ],
				path: 'M2 12 L7 8 L7 11 L17 11 L17 8 L22 12 L17 16 L17 13 L7 13 L7 16 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 100,
				defaultHeight: 40
			},
			{
				id: 'arrows/chevron-right',
				name: 'layers-shape-chevron-right',
				category: 'arrows',
				tags: [ 'chevron', 'right', 'next', 'caret' ],
				path: 'M9 6 L15 12 L9 18',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 40,
				defaultHeight: 60
			},
			{
				id: 'arrows/curved-right',
				name: 'layers-shape-arrow-curved',
				category: 'arrows',
				tags: [ 'arrow', 'curved', 'bend', 'turn' ],
				path: 'M4 16 C4 8 12 4 20 4 L20 1 L23 5 L20 9 L20 6 C13 6 6 10 6 16 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 80,
				defaultHeight: 60
			}
		];
	}

	/**
	 * Flowchart shapes
	 *
	 * @returns {Array<Object>} Flowchart shape definitions
	 */
	static getFlowchartShapes() {
		return [
			{
				id: 'flowchart/process',
				name: 'layers-shape-process',
				category: 'flowchart',
				tags: [ 'process', 'rectangle', 'step', 'action', 'box' ],
				path: 'M2 2 H98 V58 H2 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 120,
				defaultHeight: 72
			},
			{
				id: 'flowchart/process-rounded',
				name: 'layers-shape-process-rounded',
				category: 'flowchart',
				tags: [ 'process', 'rounded', 'step', 'action' ],
				path: 'M10 2 H90 Q98 2 98 10 V50 Q98 58 90 58 H10 Q2 58 2 50 V10 Q2 2 10 2',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 120,
				defaultHeight: 72
			},
			{
				id: 'flowchart/decision',
				name: 'layers-shape-decision',
				category: 'flowchart',
				tags: [ 'decision', 'diamond', 'condition', 'if', 'branch', 'choice' ],
				path: 'M50 2 L98 30 L50 58 L2 30 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 100,
				defaultHeight: 60
			},
			{
				id: 'flowchart/terminator',
				name: 'layers-shape-terminator',
				category: 'flowchart',
				tags: [ 'terminator', 'start', 'end', 'pill', 'stadium', 'capsule' ],
				path: 'M15 2 H85 A13 13 0 0 1 85 28 H15 A13 13 0 0 1 15 2',
				viewBox: [ 0, 0, 100, 30 ],
				defaultWidth: 120,
				defaultHeight: 36
			},
			{
				id: 'flowchart/data',
				name: 'layers-shape-data',
				category: 'flowchart',
				tags: [ 'data', 'parallelogram', 'input', 'output', 'io' ],
				path: 'M15 2 L98 2 L85 58 L2 58 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 120,
				defaultHeight: 72
			},
			{
				id: 'flowchart/document',
				name: 'layers-shape-document',
				category: 'flowchart',
				tags: [ 'document', 'paper', 'file', 'wavy' ],
				path: 'M2 2 H98 V45 Q75 55 50 45 Q25 35 2 45 Z',
				viewBox: [ 0, 0, 100, 55 ],
				defaultWidth: 100,
				defaultHeight: 55
			},
			{
				id: 'flowchart/database',
				name: 'layers-shape-database',
				category: 'flowchart',
				tags: [ 'database', 'cylinder', 'storage', 'data' ],
				path: 'M2 10 Q2 2 50 2 Q98 2 98 10 V50 Q98 58 50 58 Q2 58 2 50 Z M2 10 Q2 18 50 18 Q98 18 98 10',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 80,
				defaultHeight: 96
			},
			{
				id: 'flowchart/connector',
				name: 'layers-shape-connector',
				category: 'flowchart',
				tags: [ 'connector', 'circle', 'junction', 'reference' ],
				path: 'M50 2 A24 24 0 1 1 50 50 A24 24 0 1 1 50 2',
				viewBox: [ 0, 0, 100, 52 ],
				defaultWidth: 40,
				defaultHeight: 40
			}
		];
	}

	/**
	 * Callout shapes
	 *
	 * @returns {Array<Object>} Callout shape definitions
	 */
	static getCalloutShapes() {
		return [
			{
				id: 'callouts/speech-rect',
				name: 'layers-shape-speech-rect',
				category: 'callouts',
				tags: [ 'speech', 'bubble', 'callout', 'rectangle', 'dialog' ],
				path: 'M10 2 H90 Q98 2 98 10 V40 Q98 48 90 48 H30 L20 58 L22 48 H10 Q2 48 2 40 V10 Q2 2 10 2',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 150,
				defaultHeight: 90
			},
			{
				id: 'callouts/speech-round',
				name: 'layers-shape-speech-round',
				category: 'callouts',
				tags: [ 'speech', 'bubble', 'callout', 'oval', 'ellipse' ],
				path: 'M50 2 Q98 2 98 25 Q98 45 60 48 L50 58 L52 48 Q2 48 2 25 Q2 2 50 2',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 150,
				defaultHeight: 90
			},
			{
				id: 'callouts/thought',
				name: 'layers-shape-thought',
				category: 'callouts',
				tags: [ 'thought', 'bubble', 'cloud', 'think' ],
				path: 'M25 15 Q10 15 10 25 Q5 25 5 32 Q5 40 15 42 Q15 50 25 50 L35 50 Q40 55 35 58 Q30 60 25 58 Q20 65 15 60 L45 50 Q55 50 60 45 Q70 50 80 45 Q95 45 95 32 Q95 20 80 18 Q80 8 65 8 Q50 5 40 10 Q30 5 25 15 Z',
				viewBox: [ 0, 0, 100, 70 ],
				defaultWidth: 150,
				defaultHeight: 105
			},
			{
				id: 'callouts/callout-left',
				name: 'layers-shape-callout-left',
				category: 'callouts',
				tags: [ 'callout', 'pointer', 'left', 'label' ],
				path: 'M15 2 H98 V58 H15 V35 L2 30 L15 25 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 150,
				defaultHeight: 90
			},
			{
				id: 'callouts/callout-right',
				name: 'layers-shape-callout-right',
				category: 'callouts',
				tags: [ 'callout', 'pointer', 'right', 'label' ],
				path: 'M2 2 H85 V25 L98 30 L85 35 V58 H2 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 150,
				defaultHeight: 90
			}
		];
	}

	/**
	 * Geometric shapes
	 *
	 * @returns {Array<Object>} Geometric shape definitions
	 */
	static getGeometricShapes() {
		return [
			{
				id: 'geometric/triangle',
				name: 'layers-shape-triangle',
				category: 'geometric',
				tags: [ 'triangle', 'equilateral', 'polygon' ],
				path: 'M50 5 L95 85 L5 85 Z',
				viewBox: [ 0, 0, 100, 90 ],
				defaultWidth: 80,
				defaultHeight: 72
			},
			{
				id: 'geometric/triangle-right',
				name: 'layers-shape-triangle-right',
				category: 'geometric',
				tags: [ 'triangle', 'right', 'corner' ],
				path: 'M5 5 L95 85 L5 85 Z',
				viewBox: [ 0, 0, 100, 90 ],
				defaultWidth: 80,
				defaultHeight: 72
			},
			// Note: Pentagon, hexagon, octagon removed - use Polygon tool instead
			{
				id: 'geometric/cross',
				name: 'layers-shape-cross',
				category: 'geometric',
				tags: [ 'cross', 'plus', 'medical', 'add' ],
				path: 'M35 5 H65 V35 H95 V65 H65 V95 H35 V65 H5 V35 H35 Z',
				viewBox: [ 0, 0, 100, 100 ],
				defaultWidth: 60,
				defaultHeight: 60
			},
			{
				id: 'geometric/trapezoid',
				name: 'layers-shape-trapezoid',
				category: 'geometric',
				tags: [ 'trapezoid', 'quadrilateral' ],
				path: 'M20 5 H80 L95 55 H5 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 100,
				defaultHeight: 60
			},
			{
				id: 'geometric/parallelogram',
				name: 'layers-shape-parallelogram',
				category: 'geometric',
				tags: [ 'parallelogram', 'slant', 'italic' ],
				path: 'M20 5 H95 L80 55 H5 Z',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 100,
				defaultHeight: 60
			}
		];
	}

	/**
	 * Symbol shapes
	 *
	 * @returns {Array<Object>} Symbol shape definitions
	 */
	static getSymbolShapes() {
		return [
			{
				id: 'symbols/checkmark',
				name: 'layers-shape-checkmark',
				category: 'symbols',
				tags: [ 'check', 'checkmark', 'yes', 'done', 'complete', 'tick', 'ok' ],
				path: 'M9 16.17 L4.83 12 L3.41 13.41 L9 19 L21 7 L19.59 5.59 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 48,
				defaultHeight: 48
			},
			{
				id: 'symbols/xmark',
				name: 'layers-shape-xmark',
				category: 'symbols',
				tags: [ 'x', 'cross', 'no', 'close', 'cancel', 'delete', 'remove' ],
				path: 'M19 6.41 L17.59 5 L12 10.59 L6.41 5 L5 6.41 L10.59 12 L5 17.59 L6.41 19 L12 13.41 L17.59 19 L19 17.59 L13.41 12 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 48,
				defaultHeight: 48
			},
			{
				id: 'symbols/warning',
				name: 'layers-shape-warning',
				category: 'symbols',
				tags: [ 'warning', 'alert', 'caution', 'danger', 'exclamation', 'attention' ],
				path: 'M1 21 L12 2 L23 21 Z M11 10 V14 H13 V10 Z M11 16 V18 H13 V16 Z',
				viewBox: [ 0, 0, 24, 24 ],
				fillRule: 'evenodd',
				defaultWidth: 48,
				defaultHeight: 48
			},
			{
				id: 'symbols/info',
				name: 'layers-shape-info',
				category: 'symbols',
				tags: [ 'info', 'information', 'help', 'about', 'details' ],
				path: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 M11 7 H13 V9 H11 Z M11 11 H13 V17 H11 Z',
				viewBox: [ 0, 0, 24, 24 ],
				fillRule: 'evenodd',
				defaultWidth: 48,
				defaultHeight: 48
			},
			{
				id: 'symbols/question',
				name: 'layers-shape-question',
				category: 'symbols',
				tags: [ 'question', 'help', 'faq', 'ask' ],
				path: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 M12 6 Q15 6 15 9 Q15 11 12 12 V14 H11 V11 Q14 11 14 9 Q14 7 12 7 Q10 7 10 9 H9 Q9 6 12 6 M11 16 H13 V18 H11 Z',
				viewBox: [ 0, 0, 24, 24 ],
				fillRule: 'evenodd',
				defaultWidth: 48,
				defaultHeight: 48
			},
			// Note: Star removed - use Star tool instead
			{
				id: 'symbols/heart',
				name: 'layers-shape-heart',
				category: 'symbols',
				tags: [ 'heart', 'love', 'favorite', 'like' ],
				path: 'M12 21.35 L10.55 20.03 C5.4 15.36 2 12.28 2 8.5 C2 5.42 4.42 3 7.5 3 C9.24 3 10.91 3.81 12 5.09 C13.09 3.81 14.76 3 16.5 3 C19.58 3 22 5.42 22 8.5 C22 12.28 18.6 15.36 13.45 20.04 L12 21.35 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 48,
				defaultHeight: 48
			},
			{
				id: 'symbols/lightning',
				name: 'layers-shape-lightning',
				category: 'symbols',
				tags: [ 'lightning', 'bolt', 'power', 'energy', 'flash', 'electric' ],
				path: 'M13 2 L3 14 H11 L9 22 L21 10 H13 L15 2 Z',
				viewBox: [ 0, 0, 24, 24 ],
				defaultWidth: 48,
				defaultHeight: 48
			}
		];
	}

	/**
	 * Decorative shapes
	 *
	 * @returns {Array<Object>} Decorative shape definitions
	 */
	static getDecorativeShapes() {
		return [
			{
				id: 'decorative/banner',
				name: 'layers-shape-banner',
				category: 'decorative',
				tags: [ 'banner', 'ribbon', 'label', 'tag' ],
				path: 'M0 10 L10 15 V45 L0 40 V10 M10 10 H90 V50 H10 Z M90 10 L100 15 V45 L90 40',
				viewBox: [ 0, 0, 100, 60 ],
				defaultWidth: 150,
				defaultHeight: 90
			},
			{
				id: 'decorative/shield',
				name: 'layers-shape-shield',
				category: 'decorative',
				tags: [ 'shield', 'badge', 'security', 'protect' ],
				path: 'M50 5 L90 15 V45 Q90 75 50 95 Q10 75 10 45 V15 Z',
				viewBox: [ 0, 0, 100, 100 ],
				defaultWidth: 60,
				defaultHeight: 60
			},
			{
				id: 'decorative/seal',
				name: 'layers-shape-seal',
				category: 'decorative',
				tags: [ 'seal', 'stamp', 'certificate', 'badge', 'starburst' ],
				path: 'M50 5 L55 20 L70 10 L65 25 L85 25 L70 35 L85 50 L65 45 L70 65 L55 55 L50 75 L45 55 L30 65 L35 45 L15 50 L30 35 L15 25 L35 25 L30 10 L45 20 Z',
				viewBox: [ 0, 0, 100, 80 ],
				defaultWidth: 80,
				defaultHeight: 64
			},
			{
				id: 'decorative/bracket-left',
				name: 'layers-shape-bracket-left',
				category: 'decorative',
				tags: [ 'bracket', 'brace', 'curly', 'left' ],
				path: 'M20 5 Q5 5 5 20 V40 Q5 50 0 50 Q5 50 5 60 V80 Q5 95 20 95',
				viewBox: [ 0, 0, 25, 100 ],
				defaultWidth: 25,
				defaultHeight: 100
			},
			{
				id: 'decorative/bracket-right',
				name: 'layers-shape-bracket-right',
				category: 'decorative',
				tags: [ 'bracket', 'brace', 'curly', 'right' ],
				path: 'M5 5 Q20 5 20 20 V40 Q20 50 25 50 Q20 50 20 60 V80 Q20 95 5 95',
				viewBox: [ 0, 0, 25, 100 ],
				defaultWidth: 25,
				defaultHeight: 100
			},
			{
				id: 'decorative/flag',
				name: 'layers-shape-flag',
				category: 'decorative',
				tags: [ 'flag', 'banner', 'marker', 'pin' ],
				path: 'M5 5 V95 M5 5 H70 L60 25 L70 45 H5',
				viewBox: [ 0, 0, 75, 100 ],
				defaultWidth: 60,
				defaultHeight: 80
			}
		];
	}

	/**
	 * Search shapes by query
	 *
	 * @param {string} query - Search query
	 * @returns {Array<Object>} Matching shapes
	 */
	static search( query ) {
		if ( !query || typeof query !== 'string' ) {
			return [];
		}

		const normalizedQuery = query.toLowerCase().trim();
		if ( normalizedQuery.length === 0 ) {
			return [];
		}

		const words = normalizedQuery.split( /\s+/ );

		return ShapeLibraryData.getAllShapes().filter( ( shape ) => {
			const searchableText = [
				shape.id,
				shape.name,
				shape.category,
				...( shape.tags || [] )
			].join( ' ' ).toLowerCase();

			return words.every( ( word ) => searchableText.includes( word ) );
		} );
	}
}

// Export for browser (MediaWiki ResourceLoader)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};
	window.Layers.ShapeLibrary.ShapeLibraryData = ShapeLibraryData;
	window.ShapeLibraryData = ShapeLibraryData;
}

// Export for Node.js (Jest tests)
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = ShapeLibraryData;
}
