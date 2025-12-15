/**
 * Focused tests for CanvasManager fallback branches
 */

'use strict';

const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );

describe( 'CanvasManager fallbacks', () => {
    let mockCanvas, mockContext, mockEditor, manager;

    beforeEach( () => {
        mockContext = {
            clearRect: jest.fn(),
            getImageData: jest.fn(),
        };
        mockCanvas = {
            getContext: jest.fn( () => mockContext ),
            getBoundingClientRect: jest.fn( () => ( { left: 0, top: 0, width: 800, height: 600 } ) ),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            width: 640,
            height: 480,
            style: {}
        };

        mockEditor = {
            filename: 'Fallback.png',
            layers: [],
            getLayerById: jest.fn(),
            historyManager: { saveState: jest.fn() },
            updateStatus: jest.fn(),
            errorLog: jest.fn()
        };

        manager = new CanvasManager( { container: null, editor: mockEditor, canvas: mockCanvas } );

        // Provide a renderer mock
        manager.renderer = {
            setBackgroundImage: jest.fn(),
            redraw: jest.fn(),
        };
    } );

    afterEach( () => {
        if ( manager ) {
            manager.destroy();
        }
        jest.clearAllMocks();
        delete global.ImageLoader;
    } );

    it( 'delegates to imageController when present', () => {
        manager.imageController = { load: jest.fn() };
        // ensure filename is set (constructor may have triggered earlier loads)
        manager.editor.filename = 'Fallback.png';
        manager.loadBackgroundImage();
        expect( manager.imageController.load ).toHaveBeenCalled();
        expect( manager.imageController.load.mock.calls[0][0] ).toBe( manager.editor.filename );
    } );

    it( 'uses global ImageLoader when available and handles onLoad', () => {
        // Mock global ImageLoader to invoke onLoad immediately
        global.ImageLoader = jest.fn( function ( cfg ) {
            this.config = cfg;
            this.load = jest.fn( () => {
                if ( typeof cfg.onLoad === 'function' ) {
                    cfg.onLoad( { src: 'x' }, { width: 123, height: 77 } );
                }
            } );
        } );

        manager.loadBackgroundImage();

        // After load, manager should have set backgroundImage and canvas size
        expect( manager.backgroundImage ).toBeDefined();
        expect( manager.canvas.width ).toBe( 123 );
        expect( manager.canvas.height ).toBe( 77 );
        expect( manager.renderer.setBackgroundImage ).toHaveBeenCalled();
    } );

    it( 'falls back to loadBackgroundImageFallback when no loader present', () => {
        // Ensure no ImageLoader and no imageController
        manager.imageController = null;
        const spy = jest.fn();
        manager.loadBackgroundImageFallback = spy;
        manager.loadBackgroundImage();
        expect( spy ).toHaveBeenCalled();
    } );

    it( 'handleImageLoadError clears background and resizes canvas', () => {
        manager.canvas.width = 50;
        manager.canvas.height = 60;
        manager.handleImageLoadError();
        expect( manager.backgroundImage ).toBeNull();
        expect( manager.canvas.width ).toBe( 800 );
        expect( manager.canvas.height ).toBe( 600 );
        expect( manager.renderer.setBackgroundImage ).toHaveBeenCalledWith( null );
    } );
} );
