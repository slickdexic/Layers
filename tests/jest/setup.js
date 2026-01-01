/**
 * Jest setup file for MediaWiki Layers extension tests
 * This file is run before each test suite
 */

// Import Jest DOM matchers (skip for now to avoid ES6 issues)
// require('@testing-library/jest-dom');

// Mock console methods in tests to avoid noise
global.console = Object.assign({}, console, {
    // Keep log, warn, error for debugging
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    // Silence debug and info
    debug: jest.fn(),
    info: jest.fn()
});

// Mock window.alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn(function () {
    return true; });

// Mock CSS.escape for DOM queries with special characters
if ( typeof global.CSS === 'undefined' ) {
    global.CSS = {
        escape: function ( str ) {
            // Basic CSS.escape polyfill for tests
            return String( str ).replace( /([^\w\u0080-\uFFFF-])/g, '\\$1' );
        }
    };
}

// Mock browser APIs that might be used
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    },
    writable: true
});

Object.defineProperty(window, 'sessionStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    },
    writable: true
});

// Mock HTMLCanvasElement and its context
HTMLCanvasElement.prototype.getContext = jest.fn(function () {
    return {
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(function () {
            return { data: new Array(4) }; }),
    putImageData: jest.fn(),
    createImageData: jest.fn(function () {
        return { data: new Array(4) }; }),
    setTransform: jest.fn(),
    resetTransform: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    transform: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    drawImage: jest.fn(),
    measureText: jest.fn(function () {
        return { width: 100 }; }),
    fillText: jest.fn(),
    strokeText: jest.fn()
    };
});

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.toDataURL = jest.fn(function () {
    return 'data:image/png;base64,test'; });
HTMLCanvasElement.prototype.toBlob = jest.fn(function ( callback ) {
    callback(new Blob());
});

// Global test utilities
global.createMockLayer = function ( overrides ) {
    overrides = overrides || {};
    return Object.assign({
        id: 'test-layer-' + Math.random().toString(36).slice(2, 11),
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fillColor: '#000000',
        strokeColor: '#000000',
        strokeWidth: 1,
        opacity: 1,
        visible: true,
        locked: false,
        name: 'Test Layer'
    }, overrides);
};

// Provide a minimal mw global early to avoid ReferenceError in modules that check typeof mw
if ( typeof global.mw === 'undefined' ) {
    global.mw = {
        config: {
            get: function () {
                return undefined;
            }
        },
        log: Object.assign(
            jest.fn(),
            {
                warn: jest.fn(),
                error: jest.fn(),
                deprecate: jest.fn()
            }
        ),
        hook: function ( _name ) {
            const callbacks = [];
            return {
                add: function ( callback ) {
                    callbacks.push( callback );
                    return this;
                },
                fire: function () {
                    const args = Array.prototype.slice.call( arguments );
                    callbacks.forEach( function ( callback ) {
                        callback.apply( null, args );
                    } );
                    return this;
                }
            };
        }
    };
}

// Initialize MessageHelper singleton for tests
// This mimics what happens in the browser when MessageHelper.js loads
( function () {
    function MessageHelper() {
        this.cache = {};
        this.cacheEnabled = true;
    }

    MessageHelper.prototype.get = function ( key, fallback ) {
        if ( typeof key !== 'string' || !key ) {
            return fallback || '';
        }

        // Check cache first
        if ( this.cacheEnabled && Object.prototype.hasOwnProperty.call( this.cache, key ) ) {
            return this.cache[ key ];
        }

        let result = fallback || '';

        try {
            // Try standard mw.message API first
            if ( typeof mw !== 'undefined' && mw.message ) {
                const msg = mw.message( key );
                if ( msg && !msg.exists ) {
                    result = fallback || key;
                } else if ( msg && typeof msg.text === 'function' ) {
                    result = msg.text();
                }
            } else if ( typeof mw !== 'undefined' && mw.msg ) {
                result = mw.msg( key );
            }
        } catch ( e ) {
            result = fallback || key;
        }

        if ( this.cacheEnabled ) {
            this.cache[ key ] = result;
        }

        return result;
    };

    MessageHelper.prototype.getWithParams = function ( key ) {
        const params = Array.prototype.slice.call( arguments, 1 );

        try {
            if ( typeof mw !== 'undefined' && mw.message ) {
                const msg = mw.message.apply( mw, [ key ].concat( params ) );
                if ( msg && typeof msg.text === 'function' ) {
                    return msg.text();
                }
            }
        } catch ( e ) {
            // Fall through
        }

        let result = this.get( key, key );
        for ( let i = 0; i < params.length; i++ ) {
            result = result.replace( '$' + ( i + 1 ), String( params[ i ] ) );
        }
        return result;
    };

    MessageHelper.prototype.exists = function ( key ) {
        try {
            if ( typeof mw !== 'undefined' && mw.message ) {
                const msg = mw.message( key );
                return msg && msg.exists !== false;
            }
        } catch ( e ) {
            // Assume doesn't exist on error
        }
        return false;
    };

    MessageHelper.prototype.clearCache = function () {
        this.cache = {};
    };

    MessageHelper.prototype.setCacheEnabled = function ( enabled ) {
        this.cacheEnabled = !!enabled;
        if ( !enabled ) {
            this.clearCache();
        }
    };

    // Create singleton and export to window/global for tests
    const messageHelper = new MessageHelper();
    global.LayersMessageHelper = MessageHelper;
    global.layersMessages = messageHelper;
    if ( typeof window !== 'undefined' ) {
        window.LayersMessageHelper = MessageHelper;
        window.layersMessages = messageHelper;
    }
} )();

global.createMockEditor = function () {
    return {
        canvas: document.createElement('canvas'),
        context: document.createElement('canvas').getContext('2d'),
        layers: [],
        selectedLayerIds: [],
        currentTool: 'pointer',
        isModified: false,
        scale: 1,
        offsetX: 0,
        offsetY: 0
    };
};
