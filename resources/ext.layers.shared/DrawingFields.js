/**
 * Values a page gives through {{#layers_fields:}}, filled into {{name}} tokens of drawing text where the page
 * shows the drawing. Stored drawings keep the tokens; only viewers on the page call this.
 */
( function () {
	'use strict';

	const TOKEN = /\{\{\s*([A-Za-z0-9_][A-Za-z0-9_ .-]{0,63}?)\s*\}\}/g;
	let cached = null;

	/**
	 * @param {Object|null} config wgLayersDrawingFields: a set whose keys are JSON [ drawing, name, value ] entries
	 * @return {Object} Values by drawing key and name; a name given two different values is left out
	 */
	function fromConfig( config ) {
		const fields = {};
		const conflicts = new Set();
		Object.keys( config && typeof config === 'object' ? config : {} ).forEach( ( key ) => {
			let entry;
			try {
				entry = JSON.parse( key );
			} catch ( e ) {
				return;
			}
			if ( !Array.isArray( entry ) || entry.length !== 3 || !entry.every( ( part ) => typeof part === 'string' ) ) {
				return;
			}
			const [ drawing, name, value ] = entry;
			const values = Object.prototype.hasOwnProperty.call( fields, drawing ) ? fields[ drawing ] :
				( fields[ drawing ] = {} );
			if ( Object.prototype.hasOwnProperty.call( values, name ) && values[ name ] !== value ) {
				conflicts.add( JSON.stringify( [ drawing, name ] ) );
			}
			values[ name ] = value;
		} );
		conflicts.forEach( ( key ) => {
			const [ drawing, name ] = JSON.parse( key );
			delete fields[ drawing ][ name ];
		} );
		return fields;
	}

	/**
	 * @param {Array} layers Drawing layers
	 * @param {Object|undefined} values Plain-text values by name
	 * @return {Array} The layers, or copies whose text and rich-text runs show the values; unknown names stay
	 */
	function fillLayers( layers, values ) {
		if ( !values || typeof values !== 'object' || !Array.isArray( layers ) ) {
			return layers;
		}
		const fill = ( text ) => text.replace( TOKEN, ( token, name ) =>
			Object.prototype.hasOwnProperty.call( values, name ) && typeof values[ name ] === 'string' ?
				values[ name ] : token );
		return layers.map( ( layer ) => {
			if ( !layer || typeof layer !== 'object' ) {
				return layer;
			}
			const copy = Object.assign( {}, layer );
			if ( typeof copy.text === 'string' ) {
				copy.text = fill( copy.text );
			}
			if ( Array.isArray( copy.richText ) ) {
				copy.richText = copy.richText.map( ( run ) => run && typeof run.text === 'string' ?
					Object.assign( {}, run, { text: fill( run.text ) } ) : run );
			}
			return copy;
		} );
	}

	/**
	 * @param {string} key Page-owned drawing ID, fileKey() or slideKey()
	 * @return {Object|undefined} This page's values for that drawing
	 */
	function forDrawing( key ) {
		if ( cached === null ) {
			cached = fromConfig( typeof mw !== 'undefined' && mw.config ? mw.config.get( 'wgLayersDrawingFields' ) : null );
		}
		return Object.prototype.hasOwnProperty.call( cached, key ) ? cached[ key ] : undefined;
	}

	const DrawingFields = {
		fromConfig,
		fillLayers,
		forDrawing,
		/**
		 * @param {string} name File name
		 * @return {string}
		 */
		fileKey: ( name ) => 'File:' + String( name ).replace( / /g, '_' ),
		/**
		 * @param {string} name Slide name
		 * @return {string}
		 */
		slideKey: ( name ) => 'Slide:' + String( name ).trim(),
		/** Forget the parsed page values (tests). */
		reset: () => {
			cached = null;
		}
	};

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.DrawingFields = DrawingFields;
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = DrawingFields;
	}
}() );
