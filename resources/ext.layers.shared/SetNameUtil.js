/**
 * Set Name Utilities - shared rules for interpreting layer set references
 *
 * Layer set names are entirely user-defined. There is no reserved name and no
 * name the extension requires to exist: an image whose only set is called
 * "001" behaves exactly like one whose only set is called "default".
 *
 * A set reference is either a concrete name, or a generic wikitext intent such
 * as `on` / `off` that asks for annotations without naming a set. Only concrete
 * names may be sent to the API as `setname`; a generic intent is omitted so the
 * server resolves whichever set the image actually has.
 *
 * Mirrors src/Utility/SetNameResolver.php.
 *
 * @module SetNameUtil
 */
( function () {
	'use strict';

	/**
	 * Wikitext values meaning "show the current annotations", not a set name.
	 *
	 * @type {string[]}
	 */
	const SHOW_INTENTS = [ 'on', 'true', 'all', '1' ];

	/**
	 * Wikitext values meaning "show no annotations".
	 *
	 * @type {string[]}
	 */
	const HIDE_INTENTS = [ 'off', 'none', 'false', '0' ];

	/**
	 * @param {*} value Raw set reference
	 * @return {string} Trimmed lower-case form, or '' when not a string
	 */
	function normalize( value ) {
		return typeof value === 'string' ? value.trim().toLowerCase() : '';
	}

	/**
	 * @namespace SetNameUtil
	 */
	const SetNameUtil = {
		/**
		 * Whether a value asks for annotations without naming a set.
		 *
		 * @param {*} value Raw set reference
		 * @return {boolean}
		 */
		isShowIntent: function ( value ) {
			return SHOW_INTENTS.indexOf( normalize( value ) ) !== -1;
		},

		/**
		 * Whether a value explicitly suppresses annotations.
		 *
		 * @param {*} value Raw set reference
		 * @return {boolean}
		 */
		isHideIntent: function ( value ) {
			return HIDE_INTENTS.indexOf( normalize( value ) ) !== -1;
		},

		/**
		 * Whether a value is a generic intent rather than a set name.
		 *
		 * @param {*} value Raw set reference
		 * @return {boolean}
		 */
		isGenericIntent: function ( value ) {
			return SetNameUtil.isShowIntent( value ) || SetNameUtil.isHideIntent( value );
		},

		/**
		 * Whether a value names a specific set.
		 *
		 * @param {*} value Raw set reference
		 * @return {boolean}
		 */
		isSpecificName: function ( value ) {
			return normalize( value ) !== '' && !SetNameUtil.isGenericIntent( value );
		},

		/**
		 * Add `setname` to API parameters only when a specific set is named.
		 *
		 * @param {Object} params API parameter object, mutated in place
		 * @param {*} value Raw set reference
		 * @return {Object} The same params object, for chaining
		 */
		applyToParams: function ( params, value ) {
			if ( SetNameUtil.isSpecificName( value ) ) {
				params.setname = String( value ).trim();
			}
			return params;
		}
	};

	Object.freeze( SetNameUtil );

	// Export to mw.ext.layers namespace
	if ( typeof mw !== 'undefined' ) {
		mw.ext = mw.ext || {};
		mw.ext.layers = mw.ext.layers || {};
		mw.ext.layers.SetNameUtil = SetNameUtil;
	}

	// Also expose on the window.Layers namespace used by the viewer/editor
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.SetNameUtil = SetNameUtil;
	}

	// CommonJS export for Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SetNameUtil;
	}

}() );
