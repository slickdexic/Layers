/**
 * PresetStyleManager - Manages style presets integration for toolbar
 * Extracted from ToolbarStyleControls.js to reduce god class size
 *
 * @module PresetStyleManager
 */
( function () {
	'use strict';

	// Helper to resolve classes from namespace with global fallback
	const getClass = window.layersGetClass || function ( namespacePath, globalName ) {
		if ( window.Layers ) {
			const parts = namespacePath.split( '.' );
			let obj = window.Layers;
			for ( const part of parts ) {
				if ( obj && obj[ part ] ) {
					obj = obj[ part ];
				} else {
					break;
				}
			}
			if ( typeof obj === 'function' ) {
				return obj;
			}
		}
		return window[ globalName ];
	};

	/**
	 * All style properties that can be applied from presets.
	 * This list matches PresetManager.extractStyleFromLayer() and sanitizeStyle().
	 *
	 * @type {string[]}
	 */
	const PRESET_STYLE_PROPERTIES = [
		// Stroke
		'stroke', 'strokeWidth', 'strokeOpacity',
		// Fill
		'fill', 'fillOpacity',
		// Text
		'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
		'textAlign', 'verticalAlign', 'lineHeight', 'padding',
		// Text stroke
		'textStrokeColor', 'textStrokeWidth',
		// Shape
		'cornerRadius',
		// Arrow
		'arrowStyle', 'arrowhead', 'arrowSize', 'arrowHeadType', 'headScale', 'tailWidth',
		// Polygon/Star
		'sides', 'points', 'innerRadius', 'outerRadius', 'pointRadius', 'valleyRadius',
		// Shadow
		'shadow', 'shadowColor', 'shadowBlur',
		'shadowOffsetX', 'shadowOffsetY', 'shadowSpread',
		// Text shadow
		'textShadow', 'textShadowColor', 'textShadowBlur',
		'textShadowOffsetX', 'textShadowOffsetY',
		// Glow
		'glow',
		// Blend mode
		'blendMode',
		// Opacity
		'opacity',
		// Dimension
		'endStyle', 'textPosition', 'extensionLength', 'extensionGap',
		'tickSize', 'unit', 'scale', 'showUnit', 'showBackground', 'backgroundColor',
		'precision', 'toleranceType', 'toleranceValue', 'toleranceUpper', 'toleranceLower',
		// Marker
		'style', 'size', 'fontSizeAdjust', 'hasArrow', 'arrowStyle'
	];

	/**
	 * PresetStyleManager class
	 *
	 * @class
	 */
	class PresetStyleManager {
		/**
		 * @param {Object} config Configuration object
		 * @param {Object} config.toolbar Reference to parent Toolbar instance
		 * @param {Function} config.msg Message lookup function for i18n
		 * @param {Function} config.getStyleOptions Function to get current style options
		 * @param {Function} config.applyStyle Function to apply style to controls
		 */
		constructor( config ) {
			this.config = config || {};
			this.toolbar = this.config.toolbar;
			this.msgFn = this.config.msg || function ( key, fallback ) {
				return fallback || key;
			};
			this.getStyleOptionsFn = this.config.getStyleOptions;
			this.applyStyleFn = this.config.applyStyle;

			// Preset state
			this.presetDropdown = null;
			this.presetManager = null;
			this.selectedLayers = [];
		}

		/**
		 * Get localized message
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 */
		msg( key, fallback ) {
			return this.msgFn( key, fallback );
		}

		/**
		 * Create the preset dropdown component
		 *
		 * @return {PresetDropdown|null} The preset dropdown or null if not available
		 */
		createPresetDropdown() {
			const PresetManager = getClass( 'PresetManager', 'PresetManager' );
			const PresetDropdown = getClass( 'PresetDropdown', 'PresetDropdown' );

			// Check if PresetManager and PresetDropdown are available
			if ( !PresetManager || !PresetDropdown ) {
				return null;
			}

			// Create a shared preset manager instance
			if ( !this.presetManager ) {
				this.presetManager = new PresetManager();
			}

			// Get DialogManager from editor if available
			const dialogManager = this.toolbar && this.toolbar.editor && this.toolbar.editor.dialogManager;

			// Create the dropdown
			const dropdown = new PresetDropdown( {
				presetManager: this.presetManager,
				getMessage: this.msg.bind( this ),
				dialogManager: dialogManager,
				onSelect: ( style ) => {
					this.applyPresetToSelection( style );
				},
				onSave: ( callback ) => {
					const currentStyle = this.getStyleFromSelection();
					callback( currentStyle );
				}
			} );

			this.presetDropdown = dropdown;
			return dropdown;
		}

		/**
		 * Get the preset dropdown element
		 *
		 * @return {HTMLElement|null} The dropdown element or null
		 */
		getElement() {
			return this.presetDropdown ? this.presetDropdown.getElement() : null;
		}

		/**
		 * Apply a preset style to the current controls
		 *
		 * @param {Object} style Style properties from the preset
		 */
		applyPresetStyle( style ) {
			if ( !style || !this.applyStyleFn ) {
				return;
			}
			this.applyStyleFn( style );
		}

		/**
		 * Update preset dropdown when tool changes
		 *
		 * @param {string} tool Current tool name
		 */
		setCurrentTool( tool ) {
			// Only update for tool if no layers are selected
			// Layer selection takes precedence over tool selection
			if ( this.presetDropdown && ( !this.selectedLayers || this.selectedLayers.length === 0 ) ) {
				this.presetDropdown.setTool( tool );
			}
		}

		/**
		 * Update preset dropdown when layer selection changes
		 *
		 * @param {Array} selectedLayers Array of selected layer objects
		 */
		updateForSelection( selectedLayers ) {
			this.selectedLayers = selectedLayers || [];

			if ( !this.presetDropdown ) {
				return;
			}

			if ( this.selectedLayers.length === 0 ) {
				// No selection - clear layer type, fall back to tool
				this.presetDropdown.setLayerType( null );
				if ( this.toolbar && this.toolbar.currentTool ) {
					this.presetDropdown.setTool( this.toolbar.currentTool );
				}
				return;
			}

			// Get the type of the first selected layer
			const firstLayer = this.selectedLayers[ 0 ];
			const layerType = firstLayer.type;

			// Map layer types to tool types for preset lookup
			const typeMapping = {
				'rect': 'rectangle',
				'ellipse': 'ellipse',
				'circle': 'circle',
				'line': 'line',
				'arrow': 'arrow',
				'text': 'text',
				'textbox': 'textbox',
				'polygon': 'polygon',
				'star': 'star',
				'path': 'path',
				'rectangle': 'rectangle',
				'dimension': 'dimension',
				'angleDimension': 'angleDimension',
				'marker': 'marker',
				'callout': 'callout'
			};

			const toolType = typeMapping[ layerType ] || layerType;
			// Use setLayerType which takes precedence over tool
			this.presetDropdown.setLayerType( toolType );
		}

		/**
		 * Apply a preset style to selected layers
		 *
		 * @param {Object} style Style properties from the preset
		 */
		applyPresetToSelection( style ) {
			if ( !style ) {
				return;
			}

			// Determine the layer type we're applying to (for tool-specific defaults)
			let layerType = null;
			if ( this.selectedLayers && this.selectedLayers.length > 0 ) {
				layerType = this.selectedLayers[ 0 ].type;
			}

			// Get the canvas manager for updating tool-specific defaults
			const canvasManager = this.toolbar && this.toolbar.editor ?
				this.toolbar.editor.canvasManager : null;

			// If we have selected layers, apply to them via the editor
			if ( this.selectedLayers && this.selectedLayers.length > 0 && this.toolbar && this.toolbar.editor ) {
				this.toolbar.editor.applyToSelection( ( layer ) => {
					// Apply all style properties from the preset
					PRESET_STYLE_PROPERTIES.forEach( ( prop ) => {
						if ( style[ prop ] !== undefined ) {
							layer[ prop ] = style[ prop ];
						}
					} );
				} );

				// Update tool-specific defaults for modality (future drawings use these settings)
				if ( canvasManager ) {
					if ( layerType === 'dimension' && canvasManager.updateDimensionDefaults ) {
						canvasManager.updateDimensionDefaults( style );
					} else if ( layerType === 'angleDimension' && canvasManager.updateAngleDimensionDefaults ) {
						canvasManager.updateAngleDimensionDefaults( style );
					} else if ( layerType === 'marker' && canvasManager.updateMarkerDefaults ) {
						canvasManager.updateMarkerDefaults( style );
					}
				}
			} else if ( canvasManager && this.toolbar ) {
				// No selection - update tool-specific defaults based on current tool
				// This enables preset modality: selecting a preset before drawing uses those settings
				const currentTool = this.toolbar.currentTool;
				if ( currentTool === 'dimension' && canvasManager.updateDimensionDefaults ) {
					canvasManager.updateDimensionDefaults( style );
				} else if ( currentTool === 'angleDimension' && canvasManager.updateAngleDimensionDefaults ) {
					canvasManager.updateAngleDimensionDefaults( style );
				} else if ( currentTool === 'marker' && canvasManager.updateMarkerDefaults ) {
					canvasManager.updateMarkerDefaults( style );
				}
				
				// CRITICAL: Also update the generic CanvasManager style directly.
				// This ensures properties NOT managed by the toolbar controls (like arrowhead, arrowSize)
				// are seeded into CanvasManager.currentStyle and persisted by the improved StyleController,
				// rather than being lost when the ToolbarStyleControls round-trip the style.
				if ( canvasManager.updateStyleOptions ) {
					canvasManager.updateStyleOptions( style );
				}
			}

			// Also update the toolbar controls for future drawings
			this.applyPresetStyle( style );
		}

		/**
		 * Get style from the first selected layer for saving as preset
		 *
		 * @return {Object} Style properties from selected layer, or current controls
		 */
		getStyleFromSelection() {
			if ( this.selectedLayers && this.selectedLayers.length > 0 ) {
				// IMPORTANT: Fetch fresh layer data from state, not stale reference
				// The editor uses immutable updates, so this.selectedLayers[0] may be
				// outdated after property changes. We need to get the current layer
				// from the editor's state to capture recent changes.
				const layerId = this.selectedLayers[ 0 ].id;
				let layer = this.selectedLayers[ 0 ]; // fallback to cached reference

				// Try to get fresh layer data from editor
				if ( this.toolbar && this.toolbar.editor && typeof this.toolbar.editor.getLayerById === 'function' ) {
					const freshLayer = this.toolbar.editor.getLayerById( layerId );
					if ( freshLayer ) {
						layer = freshLayer;
					}
				}

				const style = {};

				// Extract all style properties from the layer
				PRESET_STYLE_PROPERTIES.forEach( ( prop ) => {
					if ( layer[ prop ] !== undefined ) {
						style[ prop ] = layer[ prop ];
					}
				} );

				return style;
			}

			// Fallback to current toolbar controls
			if ( this.getStyleOptionsFn ) {
				return this.getStyleOptionsFn();
			}
			return {};
		}

		/**
		 * Get the list of preset style properties
		 *
		 * @return {string[]} Array of property names
		 */
		static get PRESET_STYLE_PROPERTIES() {
			return PRESET_STYLE_PROPERTIES;
		}

		/**
		 * Destroy and cleanup
		 */
		destroy() {
			// Clean up preset dropdown
			if ( this.presetDropdown ) {
				this.presetDropdown.destroy();
				this.presetDropdown = null;
			}

			// Clean up preset manager
			if ( this.presetManager ) {
				this.presetManager.destroy();
				this.presetManager = null;
			}

			this.selectedLayers = [];
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.PresetStyleManager = PresetStyleManager;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PresetStyleManager;
	}

}() );
