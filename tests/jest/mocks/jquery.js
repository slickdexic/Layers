/**
 * jQuery mock for Jest tests
 */

function jQuery( selector )
{
    var elements = [];

    if ( typeof selector === 'string' ) {
        // Mock DOM selection
        if ( selector === 'body' ) {
            elements = [ document.body ];
        } else {
            elements = [];
        }
    } else if ( selector && selector.nodeType ) {
        elements = [ selector ];
    }

    var jqObject = {
        length: elements.length,

        each: function ( callback ) {
            for ( var i = 0; i < elements.length; i++ ) {
                callback.call(elements[ i ], i, elements[ i ]);
            }
            return jqObject;
        },

        find: function ( childSelector ) {
            return jQuery(childSelector);
        },

        append: function ( content ) {
            return jqObject;
        },

        remove: function () {
            return jqObject;
        },

        addClass: function ( className ) {
            return jqObject;
        },

        removeClass: function ( className ) {
            return jqObject;
        },

        attr: function ( name, value ) {
            if ( value !== undefined ) {
                return jqObject;
            }
            return '';
        },

        val: function ( value ) {
            if ( value !== undefined ) {
                return jqObject;
            }
            return '';
        },

        on: function ( event, handler ) {
            return jqObject;
        },

        off: function ( event, handler ) {
            return jqObject;
        },

        trigger: function ( event ) {
            return jqObject;
        }
    };

    return jqObject;
}

jQuery.extend = function ( target ) {
    for ( var i = 1; i < arguments.length; i++ ) {
        var source = arguments[ i ];
        for ( var key in source ) {
            if ( source.hasOwnProperty(key) ) {
                target[ key ] = source[ key ];
            }
        }
    }
    return target;
};

module.exports = jQuery;
