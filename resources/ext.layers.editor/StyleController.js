( function () {
	'use strict';

	function StyleController( editor ) {
		this.editor = editor || null;
		this.currentStyle = {
			color: '#000000',
			fill: null,
			strokeWidth: 2,
			fontSize: 16,
			fontFamily: 'Arial, sans-serif'
		};
	}

	StyleController.prototype.setCurrentStyle = function ( style ) {
		this.currentStyle = Object.assign( {}, this.currentStyle, style );
	};

	StyleController.prototype.getCurrentStyle = function () {
		return this.currentStyle;
	};

	StyleController.prototype.updateStyleOptions = function ( options ) {
		this.currentStyle = this.currentStyle || {};
		const prev = this.currentStyle;
		const has = function ( v ) { return v !== undefined && v !== null; };
		const next = {
			color: has( options.color ) ? options.color : prev.color,
			fill: has( options.fill ) ? options.fill : prev.fill,
			strokeWidth: has( options.strokeWidth ) ? options.strokeWidth : prev.strokeWidth,
			fontSize: has( options.fontSize ) ? options.fontSize : prev.fontSize,
			fontFamily: has( options.fontFamily ) ? options.fontFamily : prev.fontFamily || 'Arial, sans-serif',
			textStrokeColor: has( options.textStrokeColor ) ? options.textStrokeColor : prev.textStrokeColor,
			textStrokeWidth: has( options.textStrokeWidth ) ? options.textStrokeWidth : prev.textStrokeWidth,
			textShadow: has( options.textShadow ) ? options.textShadow : prev.textShadow,
			textShadowColor: has( options.textShadowColor ) ? options.textShadowColor : prev.textShadowColor,
			arrowStyle: has( options.arrowStyle ) ? options.arrowStyle : prev.arrowStyle,
			shadow: has( options.shadow ) ? options.shadow : prev.shadow,
			shadowColor: has( options.shadowColor ) ? options.shadowColor : prev.shadowColor,
			shadowBlur: has( options.shadowBlur ) ? options.shadowBlur : prev.shadowBlur,
			shadowOffsetX: has( options.shadowOffsetX ) ? options.shadowOffsetX : prev.shadowOffsetX,
			shadowOffsetY: has( options.shadowOffsetY ) ? options.shadowOffsetY : prev.shadowOffsetY
		};
		this.currentStyle = next;
		return next;
	};

	StyleController.prototype.applyToLayer = function ( layer, next ) {
		if ( !layer ) {
			return;
		}
		if ( next.color ) {
			if ( layer.type === 'text' ) {
				layer.fill = next.color;
			} else if ( layer.type === 'highlight' ) {
				layer.fill = next.color;
			} else {
				layer.stroke = next.color;
			}
		}
		if ( next.fill ) {
			if ( layer.type !== 'text' && layer.type !== 'line' && layer.type !== 'arrow' ) {
				layer.fill = next.fill;
			}
		}
		if ( next.strokeWidth ) {
			if ( layer.type !== 'text' ) {
				layer.strokeWidth = next.strokeWidth;
			}
		}
		// Apply text style
		if ( layer.type === 'text' ) {
			layer.fontSize = next.fontSize || layer.fontSize || 16;
			layer.fontFamily = next.fontFamily || layer.fontFamily;
			if ( next.textStrokeColor ) {
				layer.textStrokeColor = next.textStrokeColor;
			}
			if ( next.textStrokeWidth ) {
				layer.textStrokeWidth = next.textStrokeWidth;
			}
		}
		// Apply generic effects
		if ( next.shadow ) {
			layer.shadow = next.shadow;
			if ( next.shadowColor ) layer.shadowColor = next.shadowColor;
			if ( next.shadowBlur ) layer.shadowBlur = next.shadowBlur;
			if ( next.shadowOffsetX !== undefined ) layer.shadowOffsetX = next.shadowOffsetX;
			if ( next.shadowOffsetY !== undefined ) layer.shadowOffsetY = next.shadowOffsetY;
		}
	};

	// Expose globally for legacy compatibility
	if ( typeof window !== 'undefined' ) {
		window.StyleController = StyleController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = StyleController;
	}
})();
