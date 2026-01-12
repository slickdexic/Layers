/**
 * Tests for ArrowStyleControl
 *
 * @jest-environment jsdom
 */

'use strict';

const ArrowStyleControl = require( '../../../resources/ext.layers.editor/ui/ArrowStyleControl.js' );

describe( 'ArrowStyleControl', () => {
	let control;
	let mockConfig;
	let styleChangeCallback;

	beforeEach( () => {
		styleChangeCallback = jest.fn();
		mockConfig = {
			msg: jest.fn( ( key, fallback ) => fallback || key ),
			addListener: jest.fn( ( el, event, handler ) => {
				el.addEventListener( event, handler );
			} ),
			notifyStyleChange: styleChangeCallback
		};
		control = new ArrowStyleControl( mockConfig );
	} );

	afterEach( () => {
		if ( control ) {
			control.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default config', () => {
			const defaultControl = new ArrowStyleControl();
			expect( defaultControl.container ).toBeNull();
			expect( defaultControl.selectElement ).toBeNull();
			defaultControl.destroy();
		} );

		it( 'should use fallback msg function when not provided', () => {
			const defaultControl = new ArrowStyleControl();
			// The fallback msgFn returns fallback or key
			expect( defaultControl.msg( 'test-key', 'Test Fallback' ) ).toBe( 'Test Fallback' );
			expect( defaultControl.msg( 'test-key' ) ).toBe( 'test-key' );
			defaultControl.destroy();
		} );

		it( 'should store config references', () => {
			expect( control.msgFn ).toBe( mockConfig.msg );
			expect( control.addListenerFn ).toBe( mockConfig.addListener );
			expect( control.notifyStyleChange ).toBe( styleChangeCallback );
		} );
	} );

	describe( 'msg', () => {
		it( 'should delegate to msgFn', () => {
			const result = control.msg( 'test-key', 'Test Fallback' );
			expect( mockConfig.msg ).toHaveBeenCalledWith( 'test-key', 'Test Fallback' );
			expect( result ).toBe( 'Test Fallback' );
		} );
	} );

	describe( 'addListener', () => {
		it( 'should delegate to addListenerFn', () => {
			const element = document.createElement( 'div' );
			const handler = jest.fn();
			control.addListener( element, 'click', handler );
			expect( mockConfig.addListener ).toHaveBeenCalledWith( element, 'click', handler, undefined );
		} );

		it( 'should use addEventListener directly when addListenerFn is null', () => {
			// Test the fallback path when addListenerFn is explicitly null
			const testControl = new ArrowStyleControl( { msg: jest.fn() } );
			// Override addListenerFn to null to hit the fallback branch
			testControl.addListenerFn = null;
			const element = document.createElement( 'div' );
			const handler = jest.fn();
			testControl.addListener( element, 'click', handler );
			element.click();
			expect( handler ).toHaveBeenCalled();
			testControl.destroy();
		} );

		it( 'should use addEventListener directly when addListenerFn delegates', () => {
			// In real use, addListener delegates to the parent's EventTracker
			// This test verifies the delegation works correctly
			const element = document.createElement( 'div' );
			const handler = jest.fn();
			// The delegating function that mimics the real behavior
			const delegatingFn = ( el, event, fn ) => el.addEventListener( event, fn );
			const testControl = new ArrowStyleControl( { addListener: delegatingFn } );
			testControl.addListener( element, 'click', handler );
			element.click();
			expect( handler ).toHaveBeenCalled();
			testControl.destroy();
		} );
	} );

	describe( 'create', () => {
		it( 'should create container element', () => {
			const container = control.create();
			expect( container ).toBeInstanceOf( HTMLElement );
			expect( container.className ).toBe( 'arrow-style-container' );
			expect( container.style.display ).toBe( 'none' );
		} );

		it( 'should create label element', () => {
			const container = control.create();
			const label = container.querySelector( 'label' );
			expect( label ).toBeTruthy();
			expect( label.className ).toBe( 'arrow-label' );
		} );

		it( 'should create select element with options', () => {
			const container = control.create();
			const select = container.querySelector( 'select' );
			expect( select ).toBeTruthy();
			expect( select.className ).toBe( 'arrow-style-select' );
			expect( select.options.length ).toBe( 3 );
		} );

		it( 'should have single, double, and none options', () => {
			control.create();
			const select = control.getSelectElement();
			const values = Array.from( select.options ).map( o => o.value );
			expect( values ).toEqual( [ 'single', 'double', 'none' ] );
		} );

		it( 'should have ARIA label on select', () => {
			control.create();
			const select = control.getSelectElement();
			expect( select.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'should call notifyStyleChange on select change', () => {
			control.create();
			const select = control.getSelectElement();
			select.value = 'double';
			select.dispatchEvent( new Event( 'change' ) );
			expect( styleChangeCallback ).toHaveBeenCalled();
		} );
	} );

	describe( 'getContainer', () => {
		it( 'should return null before create', () => {
			expect( control.getContainer() ).toBeNull();
		} );

		it( 'should return container after create', () => {
			const container = control.create();
			expect( control.getContainer() ).toBe( container );
		} );
	} );

	describe( 'getSelectElement', () => {
		it( 'should return null before create', () => {
			expect( control.getSelectElement() ).toBeNull();
		} );

		it( 'should return select after create', () => {
			control.create();
			const select = control.getSelectElement();
			expect( select ).toBeInstanceOf( HTMLSelectElement );
		} );
	} );

	describe( 'getValue', () => {
		it( 'should return single by default before create', () => {
			expect( control.getValue() ).toBe( 'single' );
		} );

		it( 'should return current select value', () => {
			control.create();
			expect( control.getValue() ).toBe( 'single' );
			control.getSelectElement().value = 'double';
			expect( control.getValue() ).toBe( 'double' );
		} );
	} );

	describe( 'setValue', () => {
		it( 'should do nothing before create', () => {
			control.setValue( 'double' );
			// Should not throw
		} );

		it( 'should set select value', () => {
			control.create();
			control.setValue( 'double' );
			expect( control.getSelectElement().value ).toBe( 'double' );
		} );

		it( 'should set none value', () => {
			control.create();
			control.setValue( 'none' );
			expect( control.getSelectElement().value ).toBe( 'none' );
		} );

		it( 'should ignore invalid values', () => {
			control.create();
			control.setValue( 'invalid' );
			expect( control.getSelectElement().value ).toBe( 'single' );
		} );
	} );

	describe( 'setVisible', () => {
		it( 'should do nothing before create', () => {
			control.setVisible( true );
			// Should not throw
		} );

		it( 'should show container when true', () => {
			control.create();
			control.setVisible( true );
			expect( control.getContainer().style.display ).toBe( 'block' );
		} );

		it( 'should hide container when false', () => {
			control.create();
			control.setVisible( true );
			control.setVisible( false );
			expect( control.getContainer().style.display ).toBe( 'none' );
		} );
	} );

	describe( 'updateForTool', () => {
		it( 'should show for arrow tool', () => {
			control.create();
			control.updateForTool( 'arrow' );
			expect( control.getContainer().style.display ).toBe( 'block' );
		} );

		it( 'should hide for rectangle tool', () => {
			control.create();
			control.setVisible( true );
			control.updateForTool( 'rectangle' );
			expect( control.getContainer().style.display ).toBe( 'none' );
		} );

		it( 'should hide for text tool', () => {
			control.create();
			control.setVisible( true );
			control.updateForTool( 'text' );
			expect( control.getContainer().style.display ).toBe( 'none' );
		} );
	} );

	describe( 'applyStyle', () => {
		it( 'should do nothing with null style', () => {
			control.create();
			control.applyStyle( null );
			expect( control.getValue() ).toBe( 'single' );
		} );

		it( 'should set arrowStyle from style object', () => {
			control.create();
			control.applyStyle( { arrowStyle: 'double' } );
			expect( control.getValue() ).toBe( 'double' );
		} );

		it( 'should ignore style without arrowStyle', () => {
			control.create();
			control.applyStyle( { stroke: '#ff0000' } );
			expect( control.getValue() ).toBe( 'single' );
		} );
	} );

	describe( 'getStyleValues', () => {
		it( 'should return object with arrowStyle', () => {
			control.create();
			const values = control.getStyleValues();
			expect( values ).toEqual( { arrowStyle: 'single' } );
		} );

		it( 'should return current arrowStyle value', () => {
			control.create();
			control.setValue( 'none' );
			const values = control.getStyleValues();
			expect( values ).toEqual( { arrowStyle: 'none' } );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear DOM references', () => {
			control.create();
			control.destroy();
			expect( control.container ).toBeNull();
			expect( control.selectElement ).toBeNull();
		} );

		it( 'should be safe to call multiple times', () => {
			control.create();
			control.destroy();
			control.destroy();
			// Should not throw
		} );
	} );
} );
