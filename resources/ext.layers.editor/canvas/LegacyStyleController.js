( function () {
	'use strict';

	class LegacyStyleController {
		/**
		 * @param {Object} manager - CanvasManager instance
		 */
		constructor( manager ) {
			this.manager = manager;
		}

		updateStyleOptions( options ) {
			this.manager.currentStyle = this.manager.currentStyle || {};
			const prev = this.manager.currentStyle;
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
			this.manager.currentStyle = next;

			const applyToLayer = function ( layer ) {
				if ( !layer ) return;
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
				if ( layer.type === 'text' ) {
					layer.fontSize = next.fontSize || layer.fontSize || 16;
					layer.fontFamily = next.fontFamily || layer.fontFamily;
					if ( next.textStrokeColor ) layer.textStrokeColor = next.textStrokeColor;
					if ( next.textStrokeWidth ) layer.textStrokeWidth = next.textStrokeWidth;
				}
				if ( next.shadow ) {
					layer.shadow = next.shadow;
					if ( next.shadowColor ) layer.shadowColor = next.shadowColor;
					if ( next.shadowBlur ) layer.shadowBlur = next.shadowBlur;
					if ( next.shadowOffsetX !== undefined ) layer.shadowOffsetX = next.shadowOffsetX;
					if ( next.shadowOffsetY !== undefined ) layer.shadowOffsetY = next.shadowOffsetY;
				}
			};

			const ids = this.manager.getSelectedLayerIds();
			if ( ids && ids.length && this.manager.editor ) {
				for ( let i = 0; i < ids.length; i++ ) {
					const layer = this.manager.editor.getLayerById( ids[ i ] );
					if ( layer ) applyToLayer( layer );
				}
				if ( typeof this.manager.renderLayers === 'function' ) {
					this.manager.renderLayers( this.manager.editor.layers );
				}
			}
			return next;
		}

		destroy() {
			this.manager = null;
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.LegacyStyleController = LegacyStyleController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LegacyStyleController;
	}

}() );
