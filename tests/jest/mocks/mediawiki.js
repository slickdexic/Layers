/**
 * MediaWiki mock for Jest tests
 */

// Mock MediaWiki global object
const mw = {
    config: {
        get: function ( key, fallback ) {
            const mockConfig = {
                'wgLayersEnable': true,
                'wgCanonicalNamespace': 'File',
                'wgTitle': 'Example.jpg',
                'wgPageName': 'File:Example.jpg'
            };
            return mockConfig[ key ] !== undefined ? mockConfig[ key ] : fallback;
        }
    },

    message: function ( key ) {
        const mockMessages = {
            'layers-edit-layers': 'Edit Layers',
            'layers-save': 'Save',
            'layers-cancel': 'Cancel',
            'layers-delete-layer': 'Delete Layer',
            'layers-layer-name': 'Layer Name',
            'layers-error-save': 'Error saving layers'
        };
        return {
            text: function () {
                return mockMessages[ key ] || key;
            },
            parse: function () {
                return mockMessages[ key ] || key;
            }
        };
    },

    util: {
        getUrl: function ( title ) {
            return '/wiki/' + encodeURIComponent(title);
        }
    },

    user: {
        tokens: {
            get: function ( type ) {
                return type === 'csrfToken' ? 'mock-csrf-token' : null;
            }
        }
    },

    Api: function () {
        return {
            get: function ( _params ) {
                return Promise.resolve({
                    query: {
                        layers: {
                            layers: []
                        }
                    }
                });
            },
            post: function ( _params ) {
                return Promise.resolve({
                    layers: {
                        result: 'success'
                    }
                });
            }
        };
    },

    loader: {
        using: function ( _modules ) {
            return Promise.resolve();
        }
    },

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

module.exports = mw;
