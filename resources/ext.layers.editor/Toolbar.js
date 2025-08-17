/**
 * Toolbar for Layers Editor
 * Manages drawing tools, color picker, and editor actions
 */
( function () {
	'use strict';

	/**
	 * Toolbar class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the toolbar
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 */
	function Toolbar( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.currentTool = 'pointer';
		this.currentStrokeWidth = 2.0;
		this.strokeColorNone = false;
		this.fillColorNone = false;

		// Initialize validator for real-time input validation
		this.validator = window.LayersValidator ? new window.LayersValidator() : null;
		this.inputValidators = [];

		this.init();
	}

	Toolbar.prototype.init = function () {
		this.createInterface();
		this.setupEventHandlers();

		// Set default tool
		this.selectTool( 'pointer' );
	};

	// Resolve i18n text safely, avoiding placeholder leakage
	Toolbar.prototype.msg = function ( key, fallback ) {
		function pick( txt, fb ) {
			if ( txt && txt.indexOf && txt.indexOf( '⧼' ) === -1 ) {
				return txt;
			}
			return fb;
		}
		switch ( key ) {
			case 'layers-toolbar-title': {
				var t0 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toolbar-title' ).text() : null;
				return pick( t0, fallback );
			}
			// Tools
			case 'layers-tool-select': {
				var t1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-select' ).text() : null;
				return pick( t1, fallback );
			}
			case 'layers-tool-zoom': {
				var t2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-zoom' ).text() : null;
				return pick( t2, fallback );
			}
			case 'layers-tool-text': {
				var t3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-text' ).text() : null;
				return pick( t3, fallback );
			}
			case 'layers-tool-pen': {
				var t4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-pen' ).text() : null;
				return pick( t4, fallback );
			}
			case 'layers-tool-rectangle': {
				var t5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-rectangle' ).text() : null;
				return pick( t5, fallback );
			}
			case 'layers-tool-circle': {
				var t6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-circle' ).text() : null;
				return pick( t6, fallback );
			}
			case 'layers-tool-ellipse': {
				var t7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-ellipse' ).text() : null;
				return pick( t7, fallback );
			}
			case 'layers-tool-polygon': {
				var t8 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-polygon' ).text() : null;
				return pick( t8, fallback );
			}
			case 'layers-tool-star': {
				var t9 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-star' ).text() : null;
				return pick( t9, fallback );
			}
			case 'layers-tool-arrow': {
				var t10 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-arrow' ).text() : null;
				return pick( t10, fallback );
			}
			case 'layers-tool-line': {
				var t11 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-line' ).text() : null;
				return pick( t11, fallback );
			}
			case 'layers-tool-highlight': {
				var t12 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-highlight' ).text() : null;
				return pick( t12, fallback );
			}
			case 'layers-tool-blur': {
				var t13 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-blur' ).text() : null;
				return pick( t13, fallback );
			}
			case 'layers-tool-marquee': {
				var t14 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-marquee' ).text() : null;
				return pick( t14, fallback );
			}
			// Properties/labels
			case 'layers-prop-stroke-color': {
				var p1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-stroke-color' ).text() : null;
				return pick( p1, fallback );
			}
			case 'layers-prop-fill-color': {
				var p2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-fill-color' ).text() : null;
				return pick( p2, fallback );
			}
			case 'layers-prop-stroke-width': {
				var p3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-stroke-width' ).text() : null;
				return pick( p3, fallback );
			}
			case 'layers-prop-font-size': {
				var p4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-font-size' ).text() : null;
				return pick( p4, fallback );
			}
			case 'layers-effect-shadow': {
				var p5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow' ).text() : null;
				return pick( p5, fallback );
			}
			case 'layers-effect-shadow-enable': {
				var p6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow-enable' ).text() : null;
				return pick( p6, fallback );
			}
			case 'layers-effect-shadow-color': {
				var p7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow-color' ).text() : null;
				return pick( p7, fallback );
			}
			// Arrow styles
			case 'layers-arrow-single': {
				var a1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-single' ).text() : null;
				return pick( a1, fallback );
			}
			case 'layers-arrow-double': {
				var a2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-double' ).text() : null;
				return pick( a2, fallback );
			}
			case 'layers-arrow-none': {
				var a3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-none' ).text() : null;
				return pick( a3, fallback );
			}
			// Zoom
			case 'layers-zoom-out': {
				var z1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-out' ).text() : null;
				return pick( z1, fallback );
			}
			case 'layers-zoom-reset': {
				var z2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-reset' ).text() : null;
				return pick( z2, fallback );
			}
			case 'layers-zoom-in': {
				var z3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-in' ).text() : null;
				return pick( z3, fallback );
			}
			case 'layers-zoom-fit': {
				var z4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-fit' ).text() : null;
				return pick( z4, fallback );
			}
			// Actions
			case 'layers-undo': {
				var ac1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-undo' ).text() : null;
				return pick( ac1, fallback );
			}
			case 'layers-redo': {
				var ac2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-redo' ).text() : null;
				return pick( ac2, fallback );
			}
			case 'layers-delete-selected': {
				var ac3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-delete-selected' ).text() : null;
				return pick( ac3, fallback );
			}
			case 'layers-duplicate-selected': {
				var ac4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-duplicate-selected' ).text() : null;
				return pick( ac4, fallback );
			}
			case 'layers-toggle-grid': {
				var ac5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-grid' ).text() : null;
				return pick( ac5, fallback );
			}
			case 'layers-toggle-rulers': {
				var ac6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-rulers' ).text() : null;
				return pick( ac6, fallback );
			}
			case 'layers-toggle-guides': {
				var ac7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-guides' ).text() : null;
				return pick( ac7, fallback );
			}
			case 'layers-toggle-snap-grid': {
				var ac8 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-snap-grid' ).text() : null;
				return pick( ac8, fallback );
			}
			case 'layers-toggle-snap-guides': {
				var ac9 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-snap-guides' ).text() : null;
				return pick( ac9, fallback );
			}
			// Import/Export
			case 'layers-import': {
				var ie1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import' ).text() : null;
				return pick( ie1, fallback );
			}
			case 'layers-export': {
				var ie2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-export' ).text() : null;
				return pick( ie2, fallback );
			}
			case 'layers-import-unsaved-confirm': {
				var ie3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-unsaved-confirm' ).text() : null;
				return pick( ie3, fallback );
			}
			case 'layers-import-success': {
				var ie4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-success' ).text() : null;
				return pick( ie4, fallback );
			}
			case 'layers-import-error': {
				var ie5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-error' ).text() : null;
				return pick( ie5, fallback );
			}
			// Save/Cancel
			case 'layers-editor-save': {
				var sc1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-editor-save' ).text() : null;
				return pick( sc1, fallback );
			}
			case 'layers-save-changes': {
				var sc2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-save-changes' ).text() : null;
				return pick( sc2, fallback );
			}
			case 'layers-editor-cancel': {
				var sc3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-editor-cancel' ).text() : null;
				return pick( sc3, fallback );
			}
			case 'layers-cancel-changes': {
				var sc4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-cancel-changes' ).text() : null;
				return pick( sc4, fallback );
			}
			// Misc
			case 'layers-transparent': {
				var mi1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-transparent' ).text() : null;
				return pick( mi1, fallback );
			}
			default:
				return fallback;
		}
	};

	Toolbar.prototype.createInterface = function () {
		this.container.innerHTML = '';
		this.container.className = 'layers-toolbar';
		this.container.setAttribute( 'role', 'toolbar' );
		this.container.setAttribute( 'aria-label', this.msg( 'layers-toolbar-title', 'Toolbar' ) );

		// Create tool groups
		this.createToolGroup();
		this.createStyleGroup();
		this.createZoomGroup();
		this.createActionGroup();
	};

	Toolbar.prototype.createToolGroup = function () {
		var toolGroup = document.createElement( 'div' );
		toolGroup.className = 'toolbar-group tools-group';
		var t = this.msg.bind( this );

		var tools = [
			{ id: 'pointer', icon: '↖', title: t( 'layers-tool-select', 'Select Tool' ), key: 'V' },
			{ id: 'zoom', icon: '🔍', title: t( 'layers-tool-zoom', 'Zoom Tool' ), key: 'Z' },
			{ id: 'text', icon: 'T', title: t( 'layers-tool-text', 'Text Tool' ), key: 'T' },
			{ id: 'pen', icon: '✏', title: t( 'layers-tool-pen', 'Pen Tool' ), key: 'P' },
			{ id: 'rectangle', icon: '▢', title: t( 'layers-tool-rectangle', 'Rectangle Tool' ), key: 'R' },
			{ id: 'circle', icon: '○', title: t( 'layers-tool-circle', 'Circle Tool' ), key: 'C' },
			{ id: 'ellipse', icon: '○', title: t( 'layers-tool-ellipse', 'Ellipse Tool' ), key: 'E' },
			{ id: 'polygon', icon: '⬟', title: t( 'layers-tool-polygon', 'Polygon Tool' ), key: 'G' },
			{ id: 'star', icon: '★', title: t( 'layers-tool-star', 'Star Tool' ), key: 'S' },
			{ id: 'arrow', icon: '→', title: t( 'layers-tool-arrow', 'Arrow Tool' ), key: 'A' },
			{ id: 'line', icon: '/', title: t( 'layers-tool-line', 'Line Tool' ), key: 'L' },
			{ id: 'highlight', icon: '▒', title: t( 'layers-tool-highlight', 'Highlight Tool' ), key: 'H' },
			{ id: 'blur', icon: '◼︎', title: t( 'layers-tool-blur', 'Blur/Redact Tool' ), key: 'B' },
			{ id: 'marquee', icon: '⬚', title: t( 'layers-tool-marquee', 'Marquee Select' ), key: 'M' }
		];

		tools.forEach( function ( tool ) {
			var button = this.createToolButton( tool );
			toolGroup.appendChild( button );
		}.bind( this ) );

		this.container.appendChild( toolGroup );
	};

	Toolbar.prototype.createToolButton = function ( tool ) {
		var button = document.createElement( 'button' );
		button.className = 'toolbar-button tool-button';
		button.dataset.tool = tool.id;
		button.innerHTML = tool.icon;
		button.title = tool.title + ( tool.key ? ' (' + tool.key + ')' : '' );
		button.setAttribute( 'aria-label', tool.title );
		button.type = 'button';

		if ( tool.id === this.currentTool ) {
			button.classList.add( 'active' );
		}

		return button;
	};

	Toolbar.prototype.createStyleGroup = function () {
		var styleGroup = document.createElement( 'div' );
		styleGroup.className = 'toolbar-group style-group';
		var self = this;
		var t = this.msg.bind( this );

		// Color pickers (modern dialog-based)
		var colorContainer = document.createElement( 'div' );
		colorContainer.className = 'color-input-group';

		// Local helper to update button display for a color
		var updateColorButtonDisplay = function ( btn, color, transparentLabel ) {
			if ( !color || color === 'none' || color === 'transparent' ) {
				btn.style.background = 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)';
				btn.title = transparentLabel || 'Transparent';
			} else {
				btn.style.background = color;
				btn.title = color;
			}
		};

		// Color picker dialog factory (based on LayerPanel implementation)
		var openColorPickerDialog = function ( anchorButton, initialValue, options ) {
			options = options || {};
			var transparentTitle = options.transparentTitle || 'No Color (Transparent)';
			var onApply = options.onApply || function () {};

			var buttonRect = anchorButton.getBoundingClientRect();
			var overlay = document.createElement( 'div' );
			overlay.className = 'color-picker-overlay';
			overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 999999;';

			var dialog = document.createElement( 'div' );
			dialog.className = 'color-picker-dialog';

			var dialogTop = buttonRect.bottom + 5;
			var dialogLeft = buttonRect.left;
			var maxTop = window.innerHeight - 420;
			var maxLeft = window.innerWidth - 300;
			if ( dialogTop > maxTop ) {
				dialogTop = buttonRect.top - 420 - 5;
			}
			if ( dialogLeft > maxLeft ) {
				dialogLeft = maxLeft;
			}
			if ( dialogLeft < 10 ) {
				dialogLeft = 10;
			}
			if ( dialogTop < 10 ) {
				dialogTop = 10;
			}

			dialog.style.cssText = 'position: fixed; top: ' + Math.floor( dialogTop ) + 'px; left: ' + Math.floor( dialogLeft ) + 'px; background: white; border: 2px solid #333; border-radius: 6px; padding: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); width: 260px; z-index: 1000000;';

			var title = document.createElement( 'h3' );
			title.textContent = options.title || 'Choose Color';
			title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; color: #333;';
			dialog.appendChild( title );

			var paletteContainer = document.createElement( 'div' );
			paletteContainer.style.cssText = 'margin-bottom: 16px;';
			var paletteTitle = document.createElement( 'div' );
			paletteTitle.textContent = 'Standard Colors';
			paletteTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
			paletteContainer.appendChild( paletteTitle );
			var paletteGrid = document.createElement( 'div' );
			paletteGrid.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin-bottom: 12px;';

			var standardColors = [
				'#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#ff0000', '#ffff00', '#00ff00',
				'#00ffff', '#0000ff', '#ff00ff', '#800000', '#808000', '#008000', '#008080', '#000080',
				'#800080', '#ff4500', '#ffa500', '#ffff00', '#adff2f', '#00ff7f', '#00bfff', '#1e90ff',
				'#9370db', '#ff69b4', '#ffdab9', '#f0e68c', '#e0ffff', '#ffe4e1', '#dcdcdc', '#a9a9a9'
			];

			var selectedColor = ( initialValue === 'none' ) ? 'none' : ( initialValue || '#000000' );
			var selectedButton = null;
			var updateSelection = function ( button ) {
				if ( selectedButton ) {
					selectedButton.style.borderColor = '#999';
					selectedButton.style.borderWidth = '1px';
				}
				if ( button ) {
					button.style.borderColor = '#007cba';
					button.style.borderWidth = '2px';
					selectedButton = button;
				}
			};

			var noneButton = document.createElement( 'button' );
			noneButton.type = 'button';
			noneButton.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer; background: repeating-linear-gradient(45deg, #ff0000 0, #ff0000 2px, white 2px, white 4px); position: relative;';
			noneButton.title = transparentTitle;
			noneButton.addEventListener( 'click', function () {
				selectedColor = 'none';
				updateSelection( noneButton );
			} );
			paletteGrid.appendChild( noneButton );

			standardColors.forEach( function ( color ) {
				var colorBtn = document.createElement( 'button' );
				colorBtn.type = 'button';
				colorBtn.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer; background-color: ' + color + ';';
				colorBtn.title = color;
				colorBtn.addEventListener( 'click', function () {
					selectedColor = color;
					updateSelection( colorBtn );
				} );
				paletteGrid.appendChild( colorBtn );
			} );

			paletteContainer.appendChild( paletteGrid );
			dialog.appendChild( paletteContainer );

			var customContainer = document.createElement( 'div' );
			customContainer.style.cssText = 'margin-bottom: 16px;';
			var customTitle = document.createElement( 'div' );
			customTitle.textContent = 'Custom Colors';
			customTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
			customContainer.appendChild( customTitle );
			var customGrid = document.createElement( 'div' );
			customGrid.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin-bottom: 12px;';
			var savedCustomColors = [];
			try {
				savedCustomColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
			} catch ( e ) {}

			var createCustomButtonClickHandler = function ( button ) {
				return function () {
					selectedColor = button.style.backgroundColor;
					updateSelection( button );
				};
			};

			for ( var i = 0; i < 16; i++ ) {
				var customBtn = document.createElement( 'button' );
				customBtn.type = 'button';
				customBtn.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer;';
				customBtn.dataset.slot = i;
				if ( savedCustomColors[ i ] ) {
					customBtn.style.backgroundColor = savedCustomColors[ i ];
					customBtn.title = savedCustomColors[ i ];
					customBtn.addEventListener( 'click', createCustomButtonClickHandler( customBtn ) );
				} else {
					customBtn.style.backgroundColor = '#f5f5f5';
					customBtn.title = 'Empty slot';
				}
				customGrid.appendChild( customBtn );
			}

			customContainer.appendChild( customGrid );
			dialog.appendChild( customContainer );

			var customSection = document.createElement( 'div' );
			customSection.style.cssText = 'margin-bottom: 16px;';
			var customLabel = document.createElement( 'div' );
			customLabel.textContent = 'Custom Color';
			customLabel.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
			customSection.appendChild( customLabel );
			var customInput = document.createElement( 'input' );
			customInput.type = 'color';
			customInput.style.cssText = 'width: 30px; height: 30px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;';
			customInput.addEventListener( 'change', function () {
				selectedColor = customInput.value;
			} );
			customSection.appendChild( customInput );
			dialog.appendChild( customSection );

			if ( selectedColor === 'none' ) {
				updateSelection( noneButton );
			}

			var buttonContainer = document.createElement( 'div' );
			buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;';
			var cancelBtn = document.createElement( 'button' );
			cancelBtn.type = 'button';
			cancelBtn.textContent = 'Cancel';
			cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
			cancelBtn.addEventListener( 'click', function () {
				document.body.removeChild( overlay );
				document.body.removeChild( dialog );
			} );
			var okBtn = document.createElement( 'button' );
			okBtn.type = 'button';
			okBtn.textContent = 'OK';
			okBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #007cba; border-radius: 4px; background: #007cba; color: white; cursor: pointer;';
			okBtn.addEventListener( 'click', function () {
				if ( selectedColor !== 'none' && selectedColor !== initialValue ) {
					try {
						var customColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
						if ( customColors.indexOf( selectedColor ) === -1 ) {
							customColors.unshift( selectedColor );
							customColors = customColors.slice( 0, 16 );
							localStorage.setItem( 'layers-custom-colors', JSON.stringify( customColors ) );
						}
					} catch ( e ) {}
				}
				onApply( selectedColor );
				document.body.removeChild( overlay );
				document.body.removeChild( dialog );
			} );
			buttonContainer.appendChild( cancelBtn );
			buttonContainer.appendChild( okBtn );
			dialog.appendChild( buttonContainer );

			overlay.addEventListener( 'click', function ( e ) {
				if ( e.target === overlay ) {
					document.body.removeChild( overlay );
					document.body.removeChild( dialog );
				}
			} );
			var escapeHandler = function ( e ) {
				if ( e.key === 'Escape' ) {
					document.body.removeChild( overlay );
					document.body.removeChild( dialog );
					document.removeEventListener( 'keydown', escapeHandler );
				}
			};
			document.addEventListener( 'keydown', escapeHandler );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );
		};

		// Stroke color button
		var strokeColorWrapper = document.createElement( 'div' );
		strokeColorWrapper.className = 'color-input-wrapper';
		var strokeBtn = document.createElement( 'button' );
		strokeBtn.type = 'button';
		strokeBtn.className = 'color-display-button stroke-color';
		strokeBtn.style.cssText = 'width: 30px; height: 30px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;';
		strokeBtn.setAttribute( 'aria-label', t( 'layers-prop-stroke-color', 'Stroke Color' ) );
		updateColorButtonDisplay( strokeBtn, '#000000', t( 'layers-transparent', 'Transparent' ) );
		strokeColorWrapper.appendChild( strokeBtn );
		colorContainer.appendChild( strokeColorWrapper );
		strokeBtn.addEventListener( 'click', function () {
			openColorPickerDialog( strokeBtn, self.strokeColorNone ? 'none' : self.strokeColorValue, {
				title: t( 'layers-prop-stroke-color', 'Stroke Color' ),
				transparentTitle: t( 'layers-transparent', 'No Stroke (Transparent)' ),
				onApply: function ( chosen ) {
					if ( chosen === 'none' ) {
						self.strokeColorNone = true;
						updateColorButtonDisplay( self.strokeColorButton, 'none', t( 'layers-transparent', 'Transparent' ) );
					} else {
						self.strokeColorNone = false;
						self.strokeColorValue = chosen;
						updateColorButtonDisplay( self.strokeColorButton, chosen, t( 'layers-transparent', 'Transparent' ) );
					}
					self.updateStyleOptions();
				}
			} );
		} );

		// Fill color button
		var fillColorWrapper = document.createElement( 'div' );
		fillColorWrapper.className = 'color-input-wrapper';
		var fillBtn = document.createElement( 'button' );
		fillBtn.type = 'button';
		fillBtn.className = 'color-display-button fill-color';
		fillBtn.style.cssText = 'width: 30px; height: 30px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;';
		fillBtn.setAttribute( 'aria-label', t( 'layers-prop-fill-color', 'Fill Color' ) );
		updateColorButtonDisplay( fillBtn, '#ffffff', t( 'layers-transparent', 'Transparent' ) );
		fillColorWrapper.appendChild( fillBtn );
		colorContainer.appendChild( fillColorWrapper );
		fillBtn.addEventListener( 'click', function () {
			openColorPickerDialog( fillBtn, self.fillColorNone ? 'none' : self.fillColorValue, {
				title: t( 'layers-prop-fill-color', 'Fill Color' ),
				transparentTitle: t( 'layers-transparent', 'No Fill (Transparent)' ),
				onApply: function ( chosen ) {
					if ( chosen === 'none' ) {
						self.fillColorNone = true;
						updateColorButtonDisplay( self.fillColorButton, 'none', t( 'layers-transparent', 'Transparent' ) );
					} else {
						self.fillColorNone = false;
						self.fillColorValue = chosen;
						updateColorButtonDisplay( self.fillColorButton, chosen, t( 'layers-transparent', 'Transparent' ) );
					}
					self.updateStyleOptions();
				}
			} );
		} );

		styleGroup.appendChild( colorContainer );

		// Stroke width with numeric input only
		var strokeWidthContainer = document.createElement( 'div' );
		strokeWidthContainer.className = 'stroke-width-container';

		var strokeLabel = document.createElement( 'label' );
		strokeLabel.textContent = t( 'layers-prop-stroke-width', 'Stroke' ) + ':';
		strokeLabel.className = 'stroke-label';

		var strokeWidth = document.createElement( 'input' );
		strokeWidth.type = 'number';
		strokeWidth.min = '0';
		strokeWidth.max = '100';
		strokeWidth.step = '1';
		strokeWidth.value = '2';
		strokeWidth.className = 'stroke-width-input';
		strokeWidth.title = t( 'layers-prop-stroke-width', 'Stroke Width' ) + ': 2px';
		strokeWidth.placeholder = '0-100px';

		strokeWidthContainer.appendChild( strokeLabel );
		strokeWidthContainer.appendChild( strokeWidth );
		styleGroup.appendChild( strokeWidthContainer );

		// Font size (for text tool)
		var fontSizeContainer = document.createElement( 'div' );
		fontSizeContainer.className = 'font-size-container';
		fontSizeContainer.style.display = 'none';

		var fontLabel = document.createElement( 'label' );
		fontLabel.textContent = t( 'layers-prop-font-size', 'Font Size' ) + ':';
		fontLabel.className = 'font-label';

		var fontSize = document.createElement( 'input' );
		fontSize.type = 'number';
		fontSize.min = '8';
		fontSize.max = '72';
		fontSize.value = '16';
		fontSize.className = 'font-size';
		fontSize.title = t( 'layers-prop-font-size', 'Font Size' );

		fontSizeContainer.appendChild( fontLabel );
		fontSizeContainer.appendChild( fontSize );
		styleGroup.appendChild( fontSizeContainer );

		// Text stroke options (for text tool)
		var strokeContainer = document.createElement( 'div' );
		strokeContainer.className = 'text-stroke-container';
		strokeContainer.style.display = 'none';

		var strokeColorLabel = document.createElement( 'label' );
		strokeColorLabel.textContent = t( 'layers-prop-stroke-color', 'Stroke Color' ) + ':';
		strokeColorLabel.className = 'stroke-color-label';

		var strokeColor = document.createElement( 'input' );
		strokeColor.type = 'color';
		strokeColor.value = '#000000';
		strokeColor.className = 'text-stroke-color';
		strokeColor.title = t( 'layers-prop-stroke-color', 'Text Stroke Color' );

		var strokeWidthInput = document.createElement( 'input' );
		strokeWidthInput.type = 'range';
		strokeWidthInput.min = '0';
		strokeWidthInput.max = '10';
		strokeWidthInput.value = '0';
		strokeWidthInput.className = 'text-stroke-width';
		strokeWidthInput.title = t( 'layers-prop-stroke-width', 'Text Stroke Width' );

		var strokeWidthValue = document.createElement( 'span' );
		strokeWidthValue.className = 'text-stroke-value';
		strokeWidthValue.textContent = '0';

		strokeContainer.appendChild( strokeColorLabel );
		strokeContainer.appendChild( strokeColor );
		strokeContainer.appendChild( strokeWidthInput );
		strokeContainer.appendChild( strokeWidthValue );
		styleGroup.appendChild( strokeContainer );

		// Drop shadow options (for text tool)
		var shadowContainer = document.createElement( 'div' );
		shadowContainer.className = 'text-shadow-container';
		shadowContainer.style.display = 'none';

		var shadowLabel = document.createElement( 'label' );
		shadowLabel.textContent = t( 'layers-effect-shadow', 'Shadow' ) + ':';
		shadowLabel.className = 'shadow-label';

		var shadowToggle = document.createElement( 'input' );
		shadowToggle.type = 'checkbox';
		shadowToggle.className = 'text-shadow-toggle';
		shadowToggle.title = t( 'layers-effect-shadow-enable', 'Enable Drop Shadow' );

		var shadowColor = document.createElement( 'input' );
		shadowColor.type = 'color';
		shadowColor.value = '#000000';
		shadowColor.className = 'text-shadow-color';
		shadowColor.title = t( 'layers-effect-shadow-color', 'Shadow Color' );
		shadowColor.style.display = 'none';

		shadowContainer.appendChild( shadowLabel );
		shadowContainer.appendChild( shadowToggle );
		shadowContainer.appendChild( shadowColor );
		styleGroup.appendChild( shadowContainer );

		// Arrow style options (for arrow tool)
		var arrowContainer = document.createElement( 'div' );
		arrowContainer.className = 'arrow-style-container';
		arrowContainer.style.display = 'none';

		var arrowLabel = document.createElement( 'label' );
		arrowLabel.textContent = t( 'layers-tool-arrow', 'Arrow' ) + ':';
		arrowLabel.className = 'arrow-label';

		var arrowStyleSelect = document.createElement( 'select' );
		arrowStyleSelect.className = 'arrow-style-select';
		arrowStyleSelect.innerHTML =
			'<option value="single">' + t( 'layers-arrow-single', 'Single →' ) + '</option>' +
			'<option value="double">' + t( 'layers-arrow-double', 'Double ↔' ) + '</option>' +
			'<option value="none">' + t( 'layers-arrow-none', 'Line only' ) + '</option>';

		arrowContainer.appendChild( arrowLabel );
		arrowContainer.appendChild( arrowStyleSelect );
		styleGroup.appendChild( arrowContainer );

		this.container.appendChild( styleGroup );

		// Store references and initial state
		this.strokeColorButton = strokeBtn;
		this.fillColorButton = fillBtn;
		this.strokeColorValue = '#000000';
		this.fillColorValue = '#ffffff';
		this.strokeWidth = strokeWidth;
		this.fontSize = fontSize;
		this.fontSizeContainer = fontSizeContainer;
		this.strokeContainer = strokeContainer;
		this.shadowContainer = shadowContainer;
		this.arrowContainer = arrowContainer;
		this.textStrokeColor = strokeColor;
		this.textStrokeWidth = strokeWidthInput;
		this.textStrokeValue = strokeWidthValue;
		this.textShadowToggle = shadowToggle;
		this.textShadowColor = shadowColor;
		this.arrowStyleSelect = arrowStyleSelect;

		// Set up state tracking for transparent colors
		this.strokeColorNone = false;
		this.fillColorNone = false;

		// Add client-side validation to input fields
		this.setupInputValidation();
	};

	Toolbar.prototype.setupInputValidation = function () {
		if ( !this.validator ) {
			return; // Validator not available
		}

		// eslint-disable-next-line no-unused-vars
		var self = this;

		// Font size validation (1-200)
		if ( this.fontSize ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.fontSize, 'number', {
					min: 1,
					max: 200
				} )
			);
		}

		// Stroke width validation (0-100 integer)
		if ( this.strokeWidth ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.strokeWidth, 'number', {
					min: 0,
					max: 100
				} )
			);
		}

		// Text stroke width validation (0-10)
		if ( this.textStrokeWidth ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textStrokeWidth, 'number', {
					min: 0,
					max: 10
				} )
			);
		}

		// Color inputs for text stroke/shadow are still validated

		if ( this.textStrokeColor ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textStrokeColor, 'color' )
			);
		}

		if ( this.textShadowColor ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textShadowColor, 'color' )
			);
		}
	};

	// Effects group removed; moved to LayerPanel Properties

	Toolbar.prototype.createZoomGroup = function () {
		var zoomGroup = document.createElement( 'div' );
		zoomGroup.className = 'toolbar-group zoom-group';
		var t2 = this.msg.bind( this );

		// Zoom out button
		var zoomOutBtn = document.createElement( 'button' );
		zoomOutBtn.className = 'toolbar-button zoom-button';
		zoomOutBtn.innerHTML = '−';
		zoomOutBtn.title = t2( 'layers-zoom-out', 'Zoom Out' ) + ' (Ctrl+-)';
		zoomOutBtn.dataset.action = 'zoom-out';

		// Zoom display/reset
		var zoomDisplay = document.createElement( 'button' );
		zoomDisplay.className = 'toolbar-button zoom-display';
		zoomDisplay.textContent = '100%';
		zoomDisplay.title = t2( 'layers-zoom-reset', 'Reset Zoom' ) + ' (Ctrl+0)';
		zoomDisplay.dataset.action = 'zoom-reset';

		// Zoom in button
		var zoomInBtn = document.createElement( 'button' );
		zoomInBtn.className = 'toolbar-button zoom-button';
		zoomInBtn.innerHTML = '+';
		zoomInBtn.title = t2( 'layers-zoom-in', 'Zoom In' ) + ' (Ctrl++)';
		zoomInBtn.dataset.action = 'zoom-in';

		// Fit to window button
		var fitBtn = document.createElement( 'button' );
		fitBtn.className = 'toolbar-button fit-button';
		fitBtn.innerHTML = '⌂';
		fitBtn.title = t2( 'layers-zoom-fit', 'Fit to Window' );
		fitBtn.dataset.action = 'fit-window';

		zoomGroup.appendChild( zoomOutBtn );
		zoomGroup.appendChild( zoomDisplay );
		zoomGroup.appendChild( zoomInBtn );
		zoomGroup.appendChild( fitBtn );

		this.container.appendChild( zoomGroup );

		// Store references
		this.zoomDisplay = zoomDisplay;
	};

	Toolbar.prototype.createActionGroup = function () {
		var actionGroup = document.createElement( 'div' );
		actionGroup.className = 'toolbar-group action-group';
		var t = this.msg.bind( this );

		var actions = [
			{ id: 'undo', icon: '↶', title: t( 'layers-undo', 'Undo' ), key: 'Ctrl+Z' },
			{ id: 'redo', icon: '↷', title: t( 'layers-redo', 'Redo' ), key: 'Ctrl+Y' },
			{ id: 'delete', icon: '🗑', title: t( 'layers-delete-selected', 'Delete Selected' ), key: 'Delete' },
			{ id: 'duplicate', icon: '⧉', title: t( 'layers-duplicate-selected', 'Duplicate Selected' ), key: 'Ctrl+D' },
			{ id: 'grid', icon: '⊞', title: t( 'layers-toggle-grid', 'Toggle Grid' ), key: 'G' },
			{ id: 'rulers', icon: '📏', title: t( 'layers-toggle-rulers', 'Toggle Rulers' ) },
			{ id: 'guides', icon: '➕', title: t( 'layers-toggle-guides', 'Toggle Guides' ) },
			{ id: 'snap-grid', icon: '🧲⊞', title: t( 'layers-toggle-snap-grid', 'Snap to Grid' ) },
			{ id: 'snap-guides', icon: '🧲▭', title: t( 'layers-toggle-snap-guides', 'Snap to Guides' ) }
		];

		actions.forEach( function ( action ) {
			var button = this.createActionButton( action );
			actionGroup.appendChild( button );
		}.bind( this ) );

		// Separator
		var separator = document.createElement( 'div' );
		separator.className = 'toolbar-separator';
		actionGroup.appendChild( separator );

		// Import button + hidden file input
		var importButton = document.createElement( 'button' );
		importButton.className = 'toolbar-button import-button';
		importButton.textContent = t( 'layers-import', 'Import' );
		importButton.title = t( 'layers-import', 'Import' );
		actionGroup.appendChild( importButton );

		var importInput = document.createElement( 'input' );
		importInput.type = 'file';
		importInput.accept = '.json,application/json';
		importInput.style.display = 'none';
		actionGroup.appendChild( importInput );

		// Export button
		var exportButton = document.createElement( 'button' );
		exportButton.className = 'toolbar-button export-button';
		exportButton.textContent = t( 'layers-export', 'Export' );
		exportButton.title = t( 'layers-export', 'Export' );
		actionGroup.appendChild( exportButton );

		// Save and Cancel buttons
		var saveButton = document.createElement( 'button' );
		saveButton.className = 'toolbar-button save-button primary';
		saveButton.textContent = t( 'layers-editor-save', 'Save' );
		saveButton.title = t( 'layers-save-changes', 'Save Changes' ) + ' (Ctrl+S)';
		actionGroup.appendChild( saveButton );

		var cancelButton = document.createElement( 'button' );
		cancelButton.className = 'toolbar-button cancel-button';
		cancelButton.textContent = t( 'layers-editor-cancel', 'Cancel' );
		cancelButton.title = t( 'layers-cancel-changes', 'Cancel Changes' ) + ' (Escape)';
		actionGroup.appendChild( cancelButton );

		this.container.appendChild( actionGroup );

		// Store references
		this.saveButton = saveButton;
		this.cancelButton = cancelButton;
		this.importButton = importButton;
		this.importInput = importInput;
		this.exportButton = exportButton;
	};

	Toolbar.prototype.createActionButton = function ( action ) {
		var button = document.createElement( 'button' );
		button.className = 'toolbar-button action-button';
		button.dataset.action = action.id;
		button.innerHTML = action.icon;
		button.title = action.title + ( action.key ? ' (' + action.key + ')' : '' );

		return button;
	};

	Toolbar.prototype.setupEventHandlers = function () {
		var self = this;

		// Tool selection
		this.container.addEventListener( 'click', function ( e ) {
			if ( e.target.classList.contains( 'tool-button' ) ) {
				self.selectTool( e.target.dataset.tool );
			} else if ( e.target.classList.contains( 'action-button' ) ) {
				self.executeAction( e.target.dataset.action );
			} else if ( e.target.dataset.action && e.target.dataset.action.indexOf( 'zoom' ) === 0 ) {
				self.executeZoomAction( e.target.dataset.action );
			} else if ( e.target.dataset.action === 'fit-window' ) {
				self.executeZoomAction( e.target.dataset.action );
			}
		} );

		// Also support keyboard navigation on tool buttons for accessibility
		this.container.addEventListener( 'keydown', function ( e ) {
			if ( e.target.classList && e.target.classList.contains( 'tool-button' ) && ( e.key === 'Enter' || e.key === ' ' ) ) {
				e.preventDefault();
				self.selectTool( e.target.dataset.tool );
			}
		} );

		// Save/Cancel buttons
		this.saveButton.addEventListener( 'click', function () {
			self.editor.save();
		} );

		this.cancelButton.addEventListener( 'click', function () {
			self.editor.cancel();
		} );

		// Import JSON
		this.importButton.addEventListener( 'click', function () {
			self.importInput.click();
		} );

		this.importInput.addEventListener( 'change', function () {
			var file = this.files && this.files[ 0 ];
			if ( !file ) {
				return;
			}
			// Confirm overwrite if there are unsaved changes
			if ( self.editor && self.editor.isDirty ) {
				var msg = ( mw.message ? mw.message( 'layers-import-unsaved-confirm' ).text() : 'You have unsaved changes. Import anyway?' );
				// eslint-disable-next-line no-alert
				if ( !window.confirm( msg ) ) {
					self.importInput.value = '';
					return;
				}
			}
			var reader = new FileReader();
			reader.onload = function () {
				try {
					var text = String( reader.result || '' );
					var parsed = JSON.parse( text );
					var layers;
					if ( Array.isArray( parsed ) ) {
						layers = parsed;
					} else if ( parsed && Array.isArray( parsed.layers ) ) {
						layers = parsed.layers;
					} else {
						layers = [];
					}
					if ( !Array.isArray( layers ) ) {
						throw new Error( 'Invalid JSON format' );
					}
					// Save state and replace layers
					if ( self.editor && typeof self.editor.saveState === 'function' ) {
						self.editor.saveState( 'import' );
					}
					self.editor.layers = layers.map( function ( layer ) {
						var obj = layer || {};
						if ( !obj.id ) {
							obj.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 9 );
						}
						return obj;
					} );
					if ( self.editor && typeof self.editor.renderLayers === 'function' ) {
						self.editor.renderLayers();
					}
					if ( self.editor && typeof self.editor.markDirty === 'function' ) {
						self.editor.markDirty();
					}
					if ( window.mw && window.mw.notify ) {
						mw.notify( ( mw.message ? mw.message( 'layers-import-success' ).text() : 'Import complete' ), { type: 'success' } );
					}
				} catch ( err ) {
					if ( window.mw && window.mw.notify ) {
						mw.notify( ( mw.message ? mw.message( 'layers-import-error' ).text() : 'Import failed' ), { type: 'error' } );
					}
				}
				self.importInput.value = '';
			};
			reader.onerror = function () {
				if ( window.mw && window.mw.notify ) {
					mw.notify( ( mw.message ? mw.message( 'layers-import-error' ).text() : 'Import failed' ), { type: 'error' } );
				}
				self.importInput.value = '';
			};
			reader.readAsText( file );
		} );

		// Export JSON
		this.exportButton.addEventListener( 'click', function () {
			try {
				var data = [];
				if ( self.editor && Array.isArray( self.editor.layers ) ) {
					data = self.editor.layers;
				}
				var json = JSON.stringify( data, null, 2 );
				var fname = ( self.editor && self.editor.filename ? self.editor.filename : 'layers' ) + '.layers.json';
				var blob = new Blob( [ json ], { type: 'application/json' } );
				// IE 11 and old Edge
				if ( window.navigator && window.navigator.msSaveOrOpenBlob ) {
					window.navigator.msSaveOrOpenBlob( blob, fname );
					return;
				}

				var a = document.createElement( 'a' );
				a.style.display = 'none';
				a.download = fname;
				// Use data URL for broad compatibility without relying on window.URL
				a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent( json );
				document.body.appendChild( a );
				a.click();
				setTimeout( function () {
					document.body.removeChild( a );
				}, 0 );
			} catch ( e ) {
				if ( window.mw && window.mw.notify ) {
					mw.notify( 'Export failed', { type: 'error' } );
				}
			}
		} );

		// Stroke and fill color pickers are wired in createStyleGroup()

		// Stroke width input with improved validation (integer-only) and units consistency
		this.strokeWidth.addEventListener( 'input', function () {
			var val = parseInt( this.value, 10 );
			var isValid = !isNaN( val ) && val >= 0 && val <= 100;

			if ( isValid ) {
				val = Math.round( val );
				self.currentStrokeWidth = val;

				// Update display with px unit for clarity
				this.title = self.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + val + 'px';

				// Remove error styling
				this.classList.remove( 'validation-error' );

				// Update canvas with new stroke width
				self.updateStyleOptions();
			} else {
				// Apply error styling for invalid values
				this.classList.add( 'validation-error' );

				// Show validation message in title
				if ( isNaN( val ) ) {
					this.title = 'Please enter a valid number between 0 and 100';
				} else if ( val < 0 ) {
					this.title = 'Minimum stroke width: 0px';
				} else if ( val > 100 ) {
					this.title = 'Maximum stroke width: 100px';
				}
			}
		} );

		// Also handle blur event to reset invalid values
		this.strokeWidth.addEventListener( 'blur', function () {
			var val = parseInt( this.value, 10 );
			if ( isNaN( val ) || val < 0 || val > 100 ) {
				// Reset to last valid value or default
				this.value = String( self.currentStrokeWidth );
				this.classList.remove( 'validation-error' );
				this.title = self.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' +
					self.currentStrokeWidth + 'px';
			}
		} );

		// Font size
		this.fontSize.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Text stroke controls
		this.textStrokeColor.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		this.textStrokeWidth.addEventListener( 'input', function () {
			self.textStrokeValue.textContent = this.value;
			self.updateStyleOptions();
		} );

		// Text shadow controls
		this.textShadowToggle.addEventListener( 'change', function () {
			self.textShadowColor.style.display = this.checked ? 'inline-block' : 'none';
			self.updateStyleOptions();
		} );

		this.textShadowColor.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Arrow style controls
		this.arrowStyleSelect.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Keyboard shortcuts
		document.addEventListener( 'keydown', function ( e ) {
			self.handleKeyboardShortcuts( e );
		} );

		// Layer-level effects removed: opacity, blend, toggles are in Properties panel
	};

	Toolbar.prototype.selectTool = function ( toolId ) {
		// Update UI
		Array.prototype.forEach.call( this.container.querySelectorAll( '.tool-button' ), function ( button ) {
			button.classList.remove( 'active' );
		} );

		var selectedButton = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( selectedButton ) {
			selectedButton.classList.add( 'active' );
		}

		this.currentTool = toolId;

		// Show/hide tool-specific options
		this.updateToolOptions( toolId );

		// Notify editor
		this.editor.setCurrentTool( toolId );

		// Ensure focus remains on selected tool for keyboard users
		var focusedBtn = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( focusedBtn ) {
			focusedBtn.focus();
		}
	};

	Toolbar.prototype.updateToolOptions = function ( toolId ) {
		// Show/hide tool-specific options
		if ( toolId === 'text' ) {
			this.fontSizeContainer.style.display = 'block';
			this.strokeContainer.style.display = 'block';
			this.shadowContainer.style.display = 'block';
			this.arrowContainer.style.display = 'none';
		} else if ( toolId === 'arrow' ) {
			this.fontSizeContainer.style.display = 'none';
			this.strokeContainer.style.display = 'none';
			this.shadowContainer.style.display = 'none';
			this.arrowContainer.style.display = 'block';
		} else {
			this.fontSizeContainer.style.display = 'none';
			this.strokeContainer.style.display = 'none';
			this.shadowContainer.style.display = 'none';
			this.arrowContainer.style.display = 'none';
		}
	};

	Toolbar.prototype.updateStyleOptions = function () {
		// Update current style settings and notify editor
		var styleOptions = {
			color: this.strokeColorNone ? 'transparent' : this.strokeColorValue,
			fill: this.fillColorNone ? 'transparent' : this.fillColorValue,
			strokeWidth: this.currentStrokeWidth,
			fontSize: parseInt( this.fontSize.value, 10 ),
			textStrokeColor: this.textStrokeColor.value,
			textStrokeWidth: parseInt( this.textStrokeWidth.value, 10 ),
			textShadow: this.textShadowToggle.checked,
			textShadowColor: this.textShadowColor.value,
			arrowStyle: this.arrowStyleSelect.value
		};

		if ( this.editor.canvasManager && typeof this.editor.canvasManager.updateStyleOptions === 'function' ) {
			this.editor.canvasManager.updateStyleOptions( styleOptions );
		}
		if ( this.editor.toolManager && typeof this.editor.toolManager.updateStyle === 'function' ) {
			this.editor.toolManager.updateStyle( {
				color: styleOptions.color,
				fill: styleOptions.fill,
				strokeWidth: styleOptions.strokeWidth,
				fontSize: styleOptions.fontSize,
				// Ensure new arrows use the chosen arrowStyle by default
				arrowStyle: styleOptions.arrowStyle
			} );
		}
	};

	// Removed legacy none buttons; transparent selection is integrated in the color dialog

	Toolbar.prototype.executeAction = function ( actionId ) {
		switch ( actionId ) {
			case 'undo':
				this.editor.undo();
				break;
			case 'redo':
				this.editor.redo();
				break;
			case 'delete':
				this.editor.deleteSelected();
				break;
			case 'duplicate':
				this.editor.duplicateSelected();
				break;
			case 'grid':
				this.toggleGrid();
				break;
			case 'rulers':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleRulers();
				}
				this.toggleButtonState( 'rulers' );
				break;
			case 'guides':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleGuidesVisibility();
				}
				this.toggleButtonState( 'guides' );
				break;
			case 'snap-grid':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleSnapToGrid();
				}
				this.toggleButtonState( 'snap-grid' );
				break;
			case 'snap-guides':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleSnapToGuides();
				}
				this.toggleButtonState( 'snap-guides' );
				break;
		}
	};

	Toolbar.prototype.toggleButtonState = function ( id ) {
		var btn = this.container.querySelector( '[data-action="' + id + '"]' );
		if ( btn ) {
			btn.classList.toggle( 'active' );
		}
	};

	Toolbar.prototype.toggleGrid = function () {
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.toggleGrid();
		}

		// Update button state
		var gridButton = this.container.querySelector( '[data-action="grid"]' );
		if ( gridButton ) {
			gridButton.classList.toggle( 'active' );
		}
	};

	Toolbar.prototype.executeZoomAction = function ( actionId ) {
		if ( !this.editor.canvasManager ) {
			return;
		}

		switch ( actionId ) {
			case 'zoom-in':
				this.editor.canvasManager.zoomIn();
				break;
			case 'zoom-out':
				this.editor.canvasManager.zoomOut();
				break;
			case 'zoom-reset':
				this.editor.canvasManager.resetZoom();
				break;
			case 'fit-window':
				this.editor.canvasManager.fitToWindow();
				break;
		}
	};

	Toolbar.prototype.updateZoomDisplay = function ( zoomPercent ) {
		if ( this.zoomDisplay ) {
			this.zoomDisplay.textContent = zoomPercent + '%';
		}
	};

	Toolbar.prototype.handleKeyboardShortcuts = function ( e ) {
		// Don't handle shortcuts when typing in input fields
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
			return;
		}

		var key = e.key.toLowerCase();
		var ctrl = e.ctrlKey || e.metaKey;

		if ( ctrl ) {
			switch ( key ) {
				case 'z':
					e.preventDefault();
					if ( e.shiftKey ) {
						this.editor.redo();
					} else {
						this.editor.undo();
					}
					break;
				case 'y':
					e.preventDefault();
					this.editor.redo();
					break;
				case 's':
					e.preventDefault();
					this.editor.save();
					break;
				case 'd':
					e.preventDefault();
					this.editor.duplicateSelected();
					break;
			}
		} else {
			// Tool shortcuts
			switch ( key ) {
				case 'v':
					this.selectTool( 'pointer' );
					break;
				case 't':
					this.selectTool( 'text' );
					break;
				case 'p':
					this.selectTool( 'pen' );
					break;
				case 'r':
					this.selectTool( 'rectangle' );
					break;
				case 'c':
					this.selectTool( 'circle' );
					break;
				case 'b':
					this.selectTool( 'blur' );
					break;
				case 'a':
					this.selectTool( 'arrow' );
					break;
				case 'l':
					this.selectTool( 'line' );
					break;
				case 'h':
					this.selectTool( 'highlight' );
					break;
				case 'g':
					this.toggleGrid();
					break;
				case 'delete':
				case 'backspace':
					this.editor.deleteSelected();
					break;
				case 'escape':
					this.editor.cancel();
					break;
			}
		}
	};

	Toolbar.prototype.updateUndoRedoState = function ( canUndo, canRedo ) {
		var undoButton = this.container.querySelector( '[data-action="undo"]' );
		var redoButton = this.container.querySelector( '[data-action="redo"]' );

		if ( undoButton ) {
			undoButton.disabled = !canUndo;
		}

		if ( redoButton ) {
			redoButton.disabled = !canRedo;
		}
	};

	Toolbar.prototype.updateDeleteState = function ( hasSelection ) {
		var deleteButton = this.container.querySelector( '[data-action="delete"]' );
		var duplicateButton = this.container.querySelector( '[data-action="duplicate"]' );

		if ( deleteButton ) {
			deleteButton.disabled = !hasSelection;
		}

		if ( duplicateButton ) {
			duplicateButton.disabled = !hasSelection;
		}
	};

	// Export Toolbar to global scope
	window.Toolbar = Toolbar;

}() );
