/**
 * MediaWiki mock for Jest tests
 */

// Mock MediaWiki global object
var mw = {
    config: {
        get: function ( key, fallback ) {
            var mockConfig = {
                'wgLayersEnable': true,
                'wgCanonicalNamespace': 'File',
                'wgTitle': 'Example.jpg',
                'wgPageName': 'File:Example.jpg'
            };
            return mockConfig[ key ] !== undefined ? mockConfig[ key ] : fallback;
        }
    },

    message: function ( key ) {
        var mockMessages = {
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
            get: function ( params ) {
                return Promise.resolve({
                    query: {
                        layers: {
                            layers: []
                        }
                    }
                });
            },
            post: function ( params ) {
                return Promise.resolve({
                    layers: {
                        result: 'success'
                    }
                });
            }
        };
    },

    loader: {
        using: function ( modules ) {
            return Promise.resolve();
        }
    }
};

module.exports = mw;
