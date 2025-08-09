/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, and layer properties
 */
( function () {
	'use strict';

	/**
	 * LayerPanel class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the panel
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 */
	function LayerPanel( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.layers = [];
		this.selectedLayerId = null;

		this.init();
	}

	LayerPanel.prototype.init = function () {
		this.createInterface();
		this.setupEventHandlers();
	};

	LayerPanel.prototype.createInterface = function () {
		this.container.innerHTML = '';

		// Create header
		var header = document.createElement( 'div' );
		header.className = 'layers-panel-header';
		var title = document.createElement( 'h3' );
		title.textContent = ( mw.message ? mw.message( 'layers-panel-title' ).text() : 'Layers' );
		header.appendChild( title );
		var subtitle = document.createElement( 'div' );
		subtitle.className = 'layers-panel-subtitle';
		subtitle.textContent = ( mw.message ? mw.message( 'layers-panel-subtitle' ).text() : 'Drag to reorder • Click name to rename' );
		header.appendChild( subtitle );
		this.container.appendChild( header );

		// Create layer list container
		this.layerList = document.createElement( 'div' );
		this.layerList.className = 'layers-list';
		var emptyState = document.createElement( 'div' );
		emptyState.className = 'layers-empty';
		emptyState.textContent = ( mw.message ? mw.message( 'layers-empty' ).text() : 'No layers yet. Choose a tool to begin.' );
		this.layerList.appendChild( emptyState );
		this.container.appendChild( this.layerList );

		// Create properties panel
		this.propertiesPanel = document.createElement( 'div' );
		this.propertiesPanel.className = 'layers-properties';
		this.propertiesPanel.innerHTML = '<h4>' + ( mw.message ? mw.message( 'layers-properties-title' ).text() : 'Properties' ) + '</h4><div class="properties-content"></div>';
		this.container.appendChild( this.propertiesPanel );

		// Create layers code panel
		this.codePanel = document.createElement( 'div' );
		this.codePanel.className = 'layers-code-panel';
		this.codePanel.innerHTML = '<h4>' + ( mw.message ? mw.message( 'layers-code-title' ).text() : 'Wikitext Code' ) + '</h4><div class="code-content"></div>';
		this.container.appendChild( this.codePanel );
		this.updateCodePanel();
	};

	LayerPanel.prototype.setupEventHandlers = function () {
		var self = this;

		// Layer list interactions
		this.layerList.addEventListener( 'click', function ( e ) {
			self.handleLayerListClick( e );
		} );

		// Drag and drop for reordering
		this.setupDragAndDrop();
	};

	LayerPanel.prototype.updateLayers = function ( layers ) {
		this.layers = layers || [];
		this.renderLayerList();
		this.updateCodePanel();
	};

	LayerPanel.prototype.renderLayerList = function () {
		this.layerList.innerHTML = '';

		this.layers.forEach( function ( layer, index ) {
			var layerItem = this.createLayerItem( layer, index );
			this.layerList.appendChild( layerItem );
		}.bind( this ) );

		if ( this.layers.length === 0 ) {
			var empty = document.createElement( 'div' );
			empty.className = 'layers-empty';
			empty.textContent = ( mw.message ? mw.message( 'layers-empty' ).text() : 'No layers yet. Choose a tool to begin.' );
			this.layerList.appendChild( empty );
		}
	};

	LayerPanel.prototype.createLayerItem = function ( layer, index ) {
		var item = document.createElement( 'div' );
		item.className = 'layer-item';
		item.dataset.layerId = layer.id;
		item.dataset.index = index;

		if ( layer.id === this.selectedLayerId ) {
			item.classList.add( 'selected' );
		}

		// Visibility toggle
		var visibilityBtn = document.createElement( 'button' );
		visibilityBtn.className = 'layer-visibility';
		visibilityBtn.innerHTML = layer.visible !== false ? '👁' : '👁‍🗨';
		visibilityBtn.title = ( mw.message ? mw.message( 'layers-toggle-visibility' ).text() : 'Toggle visibility' );
		visibilityBtn.type = 'button';

		// Layer name
		var name = document.createElement( 'span' );
		name.className = 'layer-name';
		name.textContent = layer.name || this.getDefaultLayerName( layer );
		name.contentEditable = true;

		// Lock toggle
		var lockBtn = document.createElement( 'button' );
		lockBtn.className = 'layer-lock';
		lockBtn.innerHTML = layer.locked ? '🔒' : '🔓';
		lockBtn.title = ( mw.message ? mw.message( 'layers-toggle-lock' ).text() : 'Toggle lock' );
		lockBtn.type = 'button';

		// Delete button
		var deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.innerHTML = '🗑';
		deleteBtn.title = ( mw.message ? mw.message( 'layers-delete-layer-button' ).text() : 'Delete layer' );
		deleteBtn.type = 'button';

		item.appendChild( visibilityBtn );
		item.appendChild( name );
		item.appendChild( lockBtn );
		item.appendChild( deleteBtn );

		return item;
	};

	LayerPanel.prototype.getDefaultLayerName = function ( layer ) {
		switch ( layer.type ) {
			case 'text': {
				var prefix = ( mw.message ? mw.message( 'layers-default-text-prefix' ).text() : 'Text: ' );
				var emptyText = ( mw.message ? mw.message( 'layers-default-empty' ).text() : 'Empty' );
				return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
			}
			case 'rectangle':
				return ( mw.message ? mw.message( 'layers-type-rectangle' ).text() : 'Rectangle' );
			case 'circle':
				return ( mw.message ? mw.message( 'layers-type-circle' ).text() : 'Circle' );
			case 'ellipse':
				return ( mw.message ? mw.message( 'layers-type-ellipse' ).text() : 'Ellipse' );
			case 'polygon':
				return ( mw.message ? mw.message( 'layers-type-polygon' ).text() : 'Polygon' );
			case 'star':
				return ( mw.message ? mw.message( 'layers-type-star' ).text() : 'Star' );
			case 'arrow':
				return ( mw.message ? mw.message( 'layers-type-arrow' ).text() : 'Arrow' );
			case 'line':
				return ( mw.message ? mw.message( 'layers-type-line' ).text() : 'Line' );
			case 'path':
				return ( mw.message ? mw.message( 'layers-type-path' ).text() : 'Drawing' );
			case 'highlight':
				return ( mw.message ? mw.message( 'layers-type-highlight' ).text() : 'Highlight' );
			default:
				return ( mw.message ? mw.message( 'layers-type-layer' ).text() : 'Layer' );
		}
	};

	LayerPanel.prototype.handleLayerListClick = function ( e ) {
		var target = e.target;
		var layerItem = target.closest( '.layer-item' );

		if ( !layerItem ) {
			return;
		}

		var layerId = layerItem.dataset.layerId;
		var layer = this.editor.getLayerById( layerId );

		if ( !layer ) {
			return;
		}

		if ( target.classList.contains( 'layer-visibility' ) ) {
			this.toggleLayerVisibility( layerId );
		} else if ( target.classList.contains( 'layer-lock' ) ) {
			this.toggleLayerLock( layerId );
		} else if ( target.classList.contains( 'layer-delete' ) ) {
			this.deleteLayer( layerId );
		} else if ( target.classList.contains( 'layer-name' ) ) {
			this.editLayerName( layerId, target );
		} else {
			this.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.selectLayer = function ( layerId ) {
		this.selectedLayerId = layerId;
		this.renderLayerList();
		this.updatePropertiesPanel( layerId );

		// Notify editor of selection
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.toggleLayerVisibility = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.visible = layer.visible === false;
			this.editor.renderLayers();
			this.renderLayerList();
			this.updateCodePanel(); // Update the code when visibility changes
		}
	};

	LayerPanel.prototype.toggleLayerLock = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.locked = !layer.locked;
			this.renderLayerList();
		}
	};

	LayerPanel.prototype.deleteLayer = function ( layerId ) {
		// Use MediaWiki's OO.ui.confirm when available, fallback to confirm
		var confirmMessage = ( mw.message ? mw.message( 'layers-delete-confirm' ).text() : 'Are you sure you want to delete this layer?' );
		if ( window.OO && window.OO.ui && window.OO.ui.confirm ) {
			OO.ui.confirm( confirmMessage ).done( function ( confirmed ) {
				if ( confirmed ) {
					this.editor.removeLayer( layerId );
					if ( this.selectedLayerId === layerId ) {
						this.selectedLayerId = null;
						this.updatePropertiesPanel( null );
					}
				}
			}.bind( this ) );
		} else {
			// Use MediaWiki's OO.ui.confirm if available, otherwise fall back to browser confirm
			var confirmResult = false;
			if ( window.OO && OO.ui && OO.ui.confirm ) {
				// Note: OO.ui.confirm is async, but we'll use sync confirm for simplicity here
				// In a real implementation, this should be refactored to handle async confirmation
				confirmResult = confirm( confirmMessage ); // eslint-disable-line no-alert
			} else {
				confirmResult = confirm( confirmMessage ); // eslint-disable-line no-alert
			}
			if ( confirmResult ) {
				this.editor.removeLayer( layerId );
				if ( this.selectedLayerId === layerId ) {
					this.selectedLayerId = null;
				}
				this.updatePropertiesPanel( null );
			}
		}
	};

	LayerPanel.prototype.editLayerName = function ( layerId, nameElement ) {
		var self = this;
		var originalName = nameElement.textContent;

		nameElement.addEventListener( 'blur', function () {
			var newName = nameElement.textContent.trim();
			if ( newName && newName !== originalName ) {
				self.editor.updateLayer( layerId, { name: newName } );
			}
		} );

		nameElement.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Enter' ) {
				nameElement.blur();
			} else if ( e.key === 'Escape' ) {
				nameElement.textContent = originalName;
				nameElement.blur();
			}
		} );
	};

	LayerPanel.prototype.updatePropertiesPanel = function ( layerId ) {
		var contentDiv = this.propertiesPanel.querySelector( '.properties-content' );

		if ( !layerId ) {
			contentDiv.innerHTML = '<p>' + ( mw.message ? mw.message( 'layers-no-layer-selected' ).text() : 'No layer selected' ) + '</p>';
			return;
		}

		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			contentDiv.innerHTML = '<p>' + ( mw.message ? mw.message( 'layers-layer-not-found' ).text() : 'Layer not found' ) + '</p>';
			return;
		}

		// Create properties form based on layer type
		var form = this.createPropertiesForm( layer );
		contentDiv.innerHTML = '';
		contentDiv.appendChild( form );
	};

	LayerPanel.prototype.createPropertiesForm = function ( layer ) {
		var form = document.createElement( 'form' );
		form.className = 'layer-properties-form';

		// Common properties
		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-x' ).text() : 'X Position' ), 'number', layer.x || 0, function ( value ) {
			this.editor.updateLayer( layer.id, { x: parseFloat( value ) } );
		}.bind( this ) );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-y' ).text() : 'Y Position' ), 'number', layer.y || 0, function ( value ) {
			this.editor.updateLayer( layer.id, { y: parseFloat( value ) } );
		}.bind( this ) );

		// Type-specific properties
		switch ( layer.type ) {
			case 'text':
				this.addTextProperties( form, layer );
				break;
			case 'rectangle':
				this.addRectangleProperties( form, layer );
				break;
			case 'circle':
				this.addCircleProperties( form, layer );
				break;
		}

		return form;
	};

	LayerPanel.prototype.addPropertyField = function ( form, label, type, value, onChange ) {
		var wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field';

		var labelEl = document.createElement( 'label' );
		labelEl.textContent = label;

		var input = document.createElement( 'input' );
		input.type = type;
		input.value = value;
		input.addEventListener( 'change', function () {
			onChange( input.value );
		} );

		wrapper.appendChild( labelEl );
		wrapper.appendChild( input );
		form.appendChild( wrapper );
	};

	LayerPanel.prototype.addTextProperties = function ( form, layer ) {
		var self = this;

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-text' ).text() : 'Text' ), 'text', layer.text || '', function ( value ) {
			self.editor.updateLayer( layer.id, { text: value } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-font-size' ).text() : 'Font Size' ), 'number', layer.fontSize || 16, function ( value ) {
			self.editor.updateLayer( layer.id, { fontSize: parseInt( value ) } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-color' ).text() : 'Color' ), 'color', layer.fill || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { fill: value } );
		} );
	};

	LayerPanel.prototype.addRectangleProperties = function ( form, layer ) {
		var self = this;

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-width' ).text() : 'Width' ), 'number', layer.width || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { width: parseFloat( value ) } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-height' ).text() : 'Height' ), 'number', layer.height || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { height: parseFloat( value ) } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-stroke-color' ).text() : 'Stroke Color' ), 'color', layer.stroke || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { stroke: value } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-fill-color' ).text() : 'Fill Color' ), 'color', layer.fill || '#ffffff', function ( value ) {
			self.editor.updateLayer( layer.id, { fill: value } );
		} );
	};

	LayerPanel.prototype.addCircleProperties = function ( form, layer ) {
		var self = this;

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-radius' ).text() : 'Radius' ), 'number', layer.radius || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { radius: parseFloat( value ) } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-stroke-color' ).text() : 'Stroke Color' ), 'color', layer.stroke || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { stroke: value } );
		} );

		this.addPropertyField( form, ( mw.message ? mw.message( 'layers-prop-fill-color' ).text() : 'Fill Color' ), 'color', layer.fill || '#ffffff', function ( value ) {
			self.editor.updateLayer( layer.id, { fill: value } );
		} );
	};

	LayerPanel.prototype.setupDragAndDrop = function () {
		var self = this;

		// Enable drag and drop for layer reordering
		this.layerList.addEventListener( 'dragstart', function ( e ) {
			if ( e.target.classList.contains( 'layer-item' ) ) {
				e.dataTransfer.setData( 'text/plain', e.target.dataset.layerId );
				e.target.classList.add( 'dragging' );
			}
		} );

		this.layerList.addEventListener( 'dragend', function ( e ) {
			e.target.classList.remove( 'dragging' );
		} );

		this.layerList.addEventListener( 'dragover', function ( e ) {
			e.preventDefault();
		} );

		this.layerList.addEventListener( 'drop', function ( e ) {
			e.preventDefault();
			var draggedId = e.dataTransfer.getData( 'text/plain' );
			var targetItem = e.target.closest( '.layer-item' );

			if ( targetItem && draggedId !== targetItem.dataset.layerId ) {
				self.reorderLayers( draggedId, targetItem.dataset.layerId );
			}
		} );

		// Make layer items draggable
		this.layerList.addEventListener( 'mousedown', function ( e ) {
			var layerItem = e.target.closest( '.layer-item' );
			if ( layerItem ) {
				layerItem.draggable = true;
			}
		} );
	};

	LayerPanel.prototype.reorderLayers = function ( draggedId, targetId ) {
		var draggedIndex = -1;
		for ( var i = 0; i < this.layers.length; i++ ) {
			if ( this.layers[ i ].id === draggedId ) {
				draggedIndex = i;
				break;
			}
		}

		var targetIndex = -1;
		for ( var j = 0; j < this.layers.length; j++ ) {
			if ( this.layers[ j ].id === targetId ) {
				targetIndex = j;
				break;
			}
		}

		if ( draggedIndex !== -1 && targetIndex !== -1 ) {
			// Move layer
			var draggedLayer = this.layers.splice( draggedIndex, 1 )[ 0 ];
			this.layers.splice( targetIndex, 0, draggedLayer );

			// Update editor
			this.editor.layers = this.layers;
			this.editor.renderLayers();
			this.renderLayerList();
		}
	};

	LayerPanel.prototype.updateCodePanel = function () {
		if ( !this.codePanel ) {
			return;
		}

		var content = this.codePanel.querySelector( '.code-content' );
		if ( !content ) {
			return;
		}

		// Get visible layers
		var visibleLayers = this.layers.filter( function ( layer ) {
			return layer.visible !== false;
		} );

		var filename = this.editor && this.editor.filename ? this.editor.filename : 'YourImage.jpg';
		var codeHtml = '';

		if ( visibleLayers.length === 0 ) {
			codeHtml = '<p><strong>' + ( mw.message ? mw.message( 'layers-code-none' ).text() : 'No layers visible.' ) + '</strong> ' + ( mw.message ? mw.message( 'layers-code-enable' ).text() : 'Enable layers to see the code.' ) + '</p>';
		} else if ( visibleLayers.length === this.layers.length ) {
			// All layers visible
			codeHtml = '<p><strong>' + ( mw.message ? mw.message( 'layers-code-all-visible' ).text() : 'All layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=all|' + ( mw.message ? mw.message( 'layers-code-caption' ).text() : 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=all">' + ( mw.message ? mw.message( 'layers-code-copy' ).text() : 'Copy' ) + '</button>';
		} else {
			// Specific layers visible
			var layerIds = visibleLayers.map( function ( layer ) {
				return layer.id ? layer.id.slice( 0, 4 ) : 'unknown';
			} );
			var layersParam = layerIds.join( ',' );

			codeHtml = '<p><strong>' + ( mw.message ? mw.message( 'layers-code-selected-visible' ).text() : 'Selected layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=' + layersParam + '|' + ( mw.message ? mw.message( 'layers-code-caption' ).text() : 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=' + layersParam + '">' + ( mw.message ? mw.message( 'layers-code-copy' ).text() : 'Copy' ) + '</button>';
		}

		content.innerHTML = codeHtml;

		// Add click handlers for copy buttons
		var copyBtns = content.querySelectorAll( '.copy-btn' );
		copyBtns.forEach( function ( btn ) {
			btn.addEventListener( 'click', function () {
				var code = btn.getAttribute( 'data-code' );

				var onSuccess = function () {
					btn.textContent = ( mw.message ? mw.message( 'layers-code-copied' ).text() : 'Copied!' );
					setTimeout( function () {
						btn.textContent = ( mw.message ? mw.message( 'layers-code-copy' ).text() : 'Copy' );
					}, 2000 );
				};
				var onFailure = function () {
					btn.textContent = ( mw.message ? mw.message( 'layers-code-copy-failed' ).text() : 'Copy failed' );
					setTimeout( function () {
						btn.textContent = ( mw.message ? mw.message( 'layers-code-copy' ).text() : 'Copy' );
					}, 2000 );
				};

				if ( navigator.clipboard && navigator.clipboard.writeText ) {
					navigator.clipboard.writeText( code ).then( onSuccess ).catch( function () {
						// Fallback to execCommand
						var ta = document.createElement( 'textarea' );
						ta.value = code;
						document.body.appendChild( ta );
						ta.select();
						try {
							if ( document.execCommand( 'copy' ) ) {
								onSuccess();
							} else {
								onFailure();
							}
						} catch ( e ) {
							onFailure();
						}
						document.body.removeChild( ta );
					} );
				} else {
					// Fallback method for older browsers
					var textArea = document.createElement( 'textarea' );
					textArea.value = code;
					document.body.appendChild( textArea );
					textArea.select();
					try {
						if ( document.execCommand( 'copy' ) ) {
							onSuccess();
						} else {
							onFailure();
						}
					} catch ( err ) {
						onFailure();
					}
					document.body.removeChild( textArea );
				}
			} );
		} );
	};

	// Export LayerPanel to global scope
	window.LayerPanel = LayerPanel;

}() );
