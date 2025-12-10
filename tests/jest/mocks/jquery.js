/**
 * jQuery mock for Jest tests
 */

function jQuery( selector )
{
    let elements = [];

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

    const jqObject = {
        length: elements.length,

        each: function ( callback ) {
            for ( let i = 0; i < elements.length; i++ ) {
                callback.call(elements[ i ], i, elements[ i ]);
            }
            return jqObject;
        },

        find: function ( childSelector ) {
            return jQuery(childSelector);
        },

        append: function ( _content ) {
            return jqObject;
        },

        remove: function () {
            return jqObject;
        },

        addClass: function ( _className ) {
            return jqObject;
        },

        removeClass: function ( _className ) {
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

        on: function ( _event, _handler ) {
            return jqObject;
        },

        off: function ( _event, _handler ) {
            return jqObject;
        },

        trigger: function ( _event ) {
            return jqObject;
        }
    };

    return jqObject;
}

jQuery.extend = function ( target ) {
    for ( let i = 1; i < arguments.length; i++ ) {
        const source = arguments[ i ];
        for ( const key in source ) {
            if ( Object.prototype.hasOwnProperty.call(source, key) ) {
                target[ key ] = source[ key ];
            }
        }
    }
    return target;
};

module.exports = jQuery;
