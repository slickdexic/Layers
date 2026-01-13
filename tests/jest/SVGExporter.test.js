/**
 * Jest tests for SVGExporter.js
 * Tests SVG export functionality for all layer types
 */
'use strict';

const SVGExporter = require( '../../resources/ext.layers.editor/export/SVGExporter.js' );

describe( 'SVGExporter', () => {
	let exporter;

	beforeEach( () => {
		exporter = new SVGExporter( {
			width: 800,
			height: 600
		} );
	} );

	describe( 'Constructor', () => {
		it( 'should create exporter with default options', () => {
			const exp = new SVGExporter();
			expect( exp.width ).toBe( 800 );
			expect( exp.height ).toBe( 600 );
			expect( exp.includeBackground ).toBe( true );
		} );

		it( 'should accept custom dimensions', () => {
			const exp = new SVGExporter( { width: 1024, height: 768 } );
			expect( exp.width ).toBe( 1024 );
			expect( exp.height ).toBe( 768 );
		} );

		it( 'should set background options', () => {
			const exp = new SVGExporter( {
				includeBackground: false,
				backgroundOpacity: 0.5
			} );
			expect( exp.includeBackground ).toBe( false );
			expect( exp.backgroundOpacity ).toBe( 0.5 );
		} );
	} );

	describe( 'generateId', () => {
		it( 'should generate unique IDs', () => {
			const id1 = exporter.generateId( 'test' );
			const id2 = exporter.generateId( 'test' );
			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should use default prefix', () => {
			const id = exporter.generateId();
			expect( id ).toMatch( /^layers-\d+$/ );
		} );

		it( 'should use custom prefix', () => {
			const id = exporter.generateId( 'arrow' );
			expect( id ).toMatch( /^arrow-\d+$/ );
		} );
	} );

	describe( 'escapeXml', () => {
		it( 'should escape ampersand', () => {
			expect( exporter.escapeXml( 'A & B' ) ).toBe( 'A &amp; B' );
		} );

		it( 'should escape angle brackets', () => {
			expect( exporter.escapeXml( '<tag>' ) ).toBe( '&lt;tag&gt;' );
		} );

		it( 'should escape quotes', () => {
			expect( exporter.escapeXml( '"hello"' ) ).toBe( '&quot;hello&quot;' );
			expect( exporter.escapeXml( "it's" ) ).toBe( 'it&apos;s' );
		} );

		it( 'should handle non-strings', () => {
			expect( exporter.escapeXml( null ) ).toBe( '' );
			expect( exporter.escapeXml( undefined ) ).toBe( '' );
			expect( exporter.escapeXml( 123 ) ).toBe( '' );
		} );
	} );

	describe( 'export()', () => {
		it( 'should export empty layers array', () => {
			const svg = exporter.export( [] );
			expect( svg ).toContain( '<?xml version="1.0"' );
			expect( svg ).toContain( '<svg xmlns=' );
			expect( svg ).toContain( 'width="800"' );
			expect( svg ).toContain( 'height="600"' );
			expect( svg ).toContain( '</svg>' );
		} );

		it( 'should handle null layers', () => {
			const svg = exporter.export( null );
			expect( svg ).toContain( '</svg>' );
		} );

		it( 'should filter invisible layers', () => {
			const layers = [
				{ type: 'rectangle', x: 0, y: 0, width: 100, height: 50, visible: true },
				{ type: 'rectangle', x: 100, y: 0, width: 100, height: 50, visible: false }
			];
			const svg = exporter.export( layers );
			// Should only have one rect
			const rectMatches = svg.match( /<rect/g );
			expect( rectMatches.length ).toBe( 1 );
		} );
	} );

	describe( 'convertRectangle', () => {
		it( 'should convert basic rectangle', () => {
			const result = exporter.convertRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50
			} );
			expect( result.element ).toContain( '<rect' );
			expect( result.element ).toContain( 'x="10"' );
			expect( result.element ).toContain( 'y="20"' );
			expect( result.element ).toContain( 'width="100"' );
			expect( result.element ).toContain( 'height="50"' );
		} );

		it( 'should include corner radius', () => {
			const result = exporter.convertRectangle( {
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				cornerRadius: 8
			} );
			expect( result.element ).toContain( 'rx="8"' );
			expect( result.element ).toContain( 'ry="8"' );
		} );

		it( 'should include fill and stroke', () => {
			const result = exporter.convertRectangle( {
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				strokeWidth: 3
			} );
			expect( result.element ).toContain( 'fill="#ff0000"' );
			expect( result.element ).toContain( 'stroke="#0000ff"' );
			expect( result.element ).toContain( 'stroke-width="3"' );
		} );
	} );

	describe( 'convertCircle', () => {
		it( 'should convert circle', () => {
			const result = exporter.convertCircle( {
				x: 100,
				y: 100,
				radius: 50
			} );
			expect( result.element ).toContain( '<circle' );
			expect( result.element ).toContain( 'cx="100"' );
			expect( result.element ).toContain( 'cy="100"' );
			expect( result.element ).toContain( 'r="50"' );
		} );
	} );

	describe( 'convertEllipse', () => {
		it( 'should convert ellipse', () => {
			const result = exporter.convertEllipse( {
				x: 100,
				y: 100,
				radiusX: 80,
				radiusY: 40
			} );
			expect( result.element ).toContain( '<ellipse' );
			expect( result.element ).toContain( 'cx="100"' );
			expect( result.element ).toContain( 'cy="100"' );
			expect( result.element ).toContain( 'rx="80"' );
			expect( result.element ).toContain( 'ry="40"' );
		} );
	} );

	describe( 'convertLine', () => {
		it( 'should convert line', () => {
			const result = exporter.convertLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 200
			} );
			expect( result.element ).toContain( '<line' );
			expect( result.element ).toContain( 'x1="10"' );
			expect( result.element ).toContain( 'y1="20"' );
			expect( result.element ).toContain( 'x2="100"' );
			expect( result.element ).toContain( 'y2="200"' );
			expect( result.element ).toContain( 'fill="none"' );
		} );
	} );

	describe( 'convertArrow', () => {
		it( 'should convert arrow with marker', () => {
			const result = exporter.convertArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 200,
				arrowhead: 'arrow',
				stroke: '#000000',
				strokeWidth: 2
			} );
			expect( result.defs.length ).toBe( 1 );
			expect( result.defs[ 0 ] ).toContain( '<marker' );
			expect( result.element ).toContain( 'marker-end="url(#' );
		} );

		it( 'should handle arrow without arrowhead', () => {
			const result = exporter.convertArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 200,
				arrowhead: 'none'
			} );
			expect( result.defs.length ).toBe( 0 );
			expect( result.element ).not.toContain( 'marker-end' );
		} );

		it( 'should handle dashed arrow style', () => {
			const result = exporter.convertArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 200,
				arrowStyle: 'dashed',
				strokeWidth: 2
			} );
			expect( result.element ).toContain( 'stroke-dasharray' );
		} );

		it( 'should handle dotted arrow style', () => {
			const result = exporter.convertArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 200,
				arrowStyle: 'dotted',
				strokeWidth: 2
			} );
			expect( result.element ).toContain( 'stroke-dasharray' );
		} );
	} );

	describe( 'createArrowMarker', () => {
		it( 'should create arrow marker', () => {
			const marker = exporter.createArrowMarker( 'test-id', 'arrow', '#ff0000', 2 );
			expect( marker ).toContain( 'id="test-id"' );
			expect( marker ).toContain( 'fill="#ff0000"' );
			expect( marker ).toContain( '<path' );
		} );

		it( 'should create circle marker', () => {
			const marker = exporter.createArrowMarker( 'test-id', 'circle', '#ff0000', 2 );
			expect( marker ).toContain( '<circle' );
		} );

		it( 'should create diamond marker', () => {
			const marker = exporter.createArrowMarker( 'test-id', 'diamond', '#ff0000', 2 );
			expect( marker ).toContain( '<path' );
		} );
	} );

	describe( 'convertPolygon', () => {
		it( 'should convert polygon', () => {
			const result = exporter.convertPolygon( {
				points: [
					{ x: 0, y: 0 },
					{ x: 100, y: 0 },
					{ x: 50, y: 100 }
				]
			} );
			expect( result.element ).toContain( '<polygon' );
			expect( result.element ).toContain( 'points="0,0 100,0 50,100"' );
		} );

		it( 'should return null for insufficient points', () => {
			const result = exporter.convertPolygon( {
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 } ]
			} );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'convertPath', () => {
		it( 'should convert path', () => {
			const result = exporter.convertPath( {
				points: [
					{ x: 0, y: 0 },
					{ x: 50, y: 50 },
					{ x: 100, y: 0 }
				]
			} );
			expect( result.element ).toContain( '<path' );
			expect( result.element ).toContain( 'd="M0,0 L50,50 L100,0"' );
		} );

		it( 'should return null for insufficient points', () => {
			const result = exporter.convertPath( {
				points: [ { x: 0, y: 0 } ]
			} );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'convertText', () => {
		it( 'should convert text', () => {
			const result = exporter.convertText( {
				x: 100,
				y: 200,
				text: 'Hello World',
				fontSize: 24,
				fontFamily: 'Arial',
				color: '#000000'
			} );
			expect( result.element ).toContain( '<text' );
			expect( result.element ).toContain( 'x="100"' );
			expect( result.element ).toContain( 'y="200"' );
			expect( result.element ).toContain( 'font-size="24"' );
			expect( result.element ).toContain( 'font-family="Arial"' );
			expect( result.element ).toContain( '>Hello World</text>' );
		} );

		it( 'should escape special characters in text', () => {
			const result = exporter.convertText( {
				x: 0,
				y: 0,
				text: '<script>alert("XSS")</script>'
			} );
			expect( result.element ).toContain( '&lt;script&gt;' );
			expect( result.element ).not.toContain( '<script>' );
		} );

		it( 'should include font weight and style', () => {
			const result = exporter.convertText( {
				x: 0,
				y: 0,
				text: 'Bold Italic',
				fontWeight: 'bold',
				fontStyle: 'italic'
			} );
			expect( result.element ).toContain( 'font-weight="bold"' );
			expect( result.element ).toContain( 'font-style="italic"' );
		} );

		it( 'should include text stroke', () => {
			const result = exporter.convertText( {
				x: 0,
				y: 0,
				text: 'Outlined',
				textStrokeWidth: 2,
				textStrokeColor: '#ffffff'
			} );
			expect( result.element ).toContain( 'stroke="#ffffff"' );
			expect( result.element ).toContain( 'stroke-width="2"' );
			expect( result.element ).toContain( 'paint-order="stroke"' );
		} );
	} );

	describe( 'convertTextBox', () => {
		it( 'should convert textbox with background', () => {
			const result = exporter.convertTextBox( {
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Textbox content',
				fill: '#ffffff',
				stroke: '#000000'
			} );
			expect( result.element ).toContain( '<g>' );
			expect( result.element ).toContain( '<rect' );
			expect( result.element ).toContain( '<text' );
			expect( result.element ).toContain( 'Textbox content</text>' );
		} );

		it( 'should handle center alignment', () => {
			const result = exporter.convertTextBox( {
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Centered',
				textAlign: 'center'
			} );
			expect( result.element ).toContain( 'text-anchor="middle"' );
		} );

		it( 'should handle right alignment', () => {
			const result = exporter.convertTextBox( {
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Right',
				textAlign: 'right'
			} );
			expect( result.element ).toContain( 'text-anchor="end"' );
		} );
	} );

	describe( 'convertImage', () => {
		it( 'should convert image layer', () => {
			const result = exporter.convertImage( {
				x: 50,
				y: 50,
				width: 200,
				height: 150,
				src: 'data:image/png;base64,abc123'
			} );
			expect( result.element ).toContain( '<image' );
			expect( result.element ).toContain( 'x="50"' );
			expect( result.element ).toContain( 'y="50"' );
			expect( result.element ).toContain( 'width="200"' );
			expect( result.element ).toContain( 'height="150"' );
			expect( result.element ).toContain( 'xlink:href' );
		} );

		it( 'should return null for empty src', () => {
			const result = exporter.convertImage( {
				x: 50,
				y: 50,
				width: 200,
				height: 150,
				src: ''
			} );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'convertCustomShape', () => {
		it( 'should convert custom shape with path data', () => {
			const result = exporter.convertCustomShape( {
				x: 100,
				y: 100,
				width: 50,
				height: 50,
				originalWidth: 100,
				originalHeight: 100,
				pathData: 'M0,0 L100,50 L50,100 Z'
			} );
			expect( result.element ).toContain( '<g transform=' );
			expect( result.element ).toContain( '<path' );
			expect( result.element ).toContain( 'M0,0 L100,50 L50,100 Z' );
		} );

		it( 'should return null without path data', () => {
			const result = exporter.convertCustomShape( {
				x: 100,
				y: 100,
				width: 50,
				height: 50
			} );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'convertLayer with rotation', () => {
		it( 'should wrap rotated layer in group', () => {
			const result = exporter.convertLayer( {
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 50,
				height: 30,
				rotation: 45
			} );
			expect( result.element ).toContain( '<g transform="rotate(45' );
			expect( result.element ).toContain( '<rect' );
		} );

		it( 'should not wrap if rotation is zero', () => {
			const result = exporter.convertLayer( {
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 50,
				height: 30,
				rotation: 0
			} );
			expect( result.element ).not.toContain( '<g transform' );
			expect( result.element ).toMatch( /^<rect/ );
		} );
	} );

	describe( 'getStyleAttributes', () => {
		it( 'should include fill', () => {
			const attrs = exporter.getStyleAttributes( { fill: '#ff0000' } );
			expect( attrs ).toContain( 'fill="#ff0000"' );
		} );

		it( 'should include fill opacity', () => {
			const attrs = exporter.getStyleAttributes( {
				fill: '#ff0000',
				fillOpacity: 0.5
			} );
			expect( attrs ).toContain( 'fill-opacity="0.5"' );
		} );

		it( 'should include stroke', () => {
			const attrs = exporter.getStyleAttributes( {
				stroke: '#0000ff',
				strokeWidth: 3
			} );
			expect( attrs ).toContain( 'stroke="#0000ff"' );
			expect( attrs ).toContain( 'stroke-width="3"' );
		} );

		it( 'should skip fill for noFill option', () => {
			const attrs = exporter.getStyleAttributes(
				{ fill: '#ff0000' },
				{ noFill: true }
			);
			expect( attrs ).toContain( 'fill="none"' );
		} );

		it( 'should convert blur fill to semi-transparent', () => {
			const attrs = exporter.getStyleAttributes( { fill: 'blur' } );
			expect( attrs.join( ' ' ) ).toContain( 'rgba(255,255,255,0.7)' );
		} );

		it( 'should include opacity', () => {
			const attrs = exporter.getStyleAttributes( { opacity: 0.7 } );
			expect( attrs ).toContain( 'opacity="0.7"' );
		} );
	} );

	describe( 'exportToBlob', () => {
		it( 'should return a Blob', () => {
			const blob = exporter.exportToBlob( [] );
			expect( blob ).toBeInstanceOf( Blob );
			expect( blob.type ).toBe( 'image/svg+xml;charset=utf-8' );
		} );
	} );

	describe( 'exportToDataURL', () => {
		it( 'should return a data URL', () => {
			const dataUrl = exporter.exportToDataURL( [] );
			expect( dataUrl ).toMatch( /^data:image\/svg\+xml,/ );
		} );
	} );

	describe( 'getLayerCenterX/Y', () => {
		it( 'should calculate center for rectangle', () => {
			const layer = { x: 100, y: 50, width: 200, height: 100 };
			expect( exporter.getLayerCenterX( layer ) ).toBe( 200 );
			expect( exporter.getLayerCenterY( layer ) ).toBe( 100 );
		} );

		it( 'should calculate center for circle', () => {
			const layer = { x: 100, y: 100, radius: 50 };
			expect( exporter.getLayerCenterX( layer ) ).toBe( 100 );
			expect( exporter.getLayerCenterY( layer ) ).toBe( 100 );
		} );

		it( 'should calculate center for line', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 200 };
			expect( exporter.getLayerCenterX( layer ) ).toBe( 50 );
			expect( exporter.getLayerCenterY( layer ) ).toBe( 100 );
		} );
	} );

	describe( 'Unknown layer types', () => {
		it( 'should return null for unknown type', () => {
			const result = exporter.convertLayer( { type: 'unknown-type' } );
			expect( result ).toBeNull();
		} );

		it( 'should return null for null layer', () => {
			const result = exporter.convertLayer( null );
			expect( result ).toBeNull();
		} );

		it( 'should return null for layer without type', () => {
			const result = exporter.convertLayer( { x: 0, y: 0 } );
			expect( result ).toBeNull();
		} );
	} );
} );
