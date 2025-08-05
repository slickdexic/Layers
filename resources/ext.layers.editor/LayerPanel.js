/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, and layer properties
 */
( function () {
	'use strict';

	/**
	 * LayerPanel class
	 *
	 * @param config
	 * @class
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
		header.innerHTML = '<h3>' + mw.msg( 'layers-editor-title' ) + '</h3>';
		this.container.appendChild( header );

		// Create layer list container
		this.layerList = document.createElement( 'div' );
		this.layerList.className = 'layers-list';
		this.container.appendChild( this.layerList );

		// Create properties panel
		this.propertiesPanel = document.createElement( 'div' );
		this.propertiesPanel.className = 'layers-properties';
		this.propertiesPanel.innerHTML = '<h4>Properties</h4><div class="properties-content"></div>';
		this.container.appendChild( this.propertiesPanel );
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
	};

	LayerPanel.prototype.renderLayerList = function () {
		this.layerList.innerHTML = '';

		this.layers.forEach( function ( layer, index ) {
			var layerItem = this.createLayerItem( layer, index );
			this.layerList.appendChild( layerItem );
		}.bind( this ) );
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
		visibilityBtn.title = 'Toggle visibility';

		// Layer name
		var name = document.createElement( 'span' );
		name.className = 'layer-name';
		name.textContent = layer.name || this.getDefaultLayerName( layer );
		name.contentEditable = true;

		// Lock toggle
		var lockBtn = document.createElement( 'button' );
		lockBtn.className = 'layer-lock';
		lockBtn.innerHTML = layer.locked ? '🔒' : '🔓';
		lockBtn.title = 'Toggle lock';

		// Delete button
		var deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.innerHTML = '🗑';
		deleteBtn.title = 'Delete layer';

		item.appendChild( visibilityBtn );
		item.appendChild( name );
		item.appendChild( lockBtn );
		item.appendChild( deleteBtn );

		return item;
	};

	LayerPanel.prototype.getDefaultLayerName = function ( layer ) {
		switch ( layer.type ) {
			case 'text': return 'Text: ' + ( layer.text || 'Empty' ).slice( 0, 20 );
			case 'rectangle': return 'Rectangle';
			case 'circle': return 'Circle';
			case 'arrow': return 'Arrow';
			case 'line': return 'Line';
			case 'path': return 'Drawing';
			case 'highlight': return 'Highlight';
			default: return 'Layer';
		}
	};

	LayerPanel.prototype.handleLayerListClick = function ( e ) {
		var target = e.target;
		var layerItem = target.closest( '.layer-item' );

		if ( !layerItem ) { return; }

		var layerId = layerItem.dataset.layerId;
		var layer = this.editor.getLayerById( layerId );

		if ( !layer ) { return; }

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
		if ( confirm( 'Are you sure you want to delete this layer?' ) ) {
			this.editor.removeLayer( layerId );
			if ( this.selectedLayerId === layerId ) {
				this.selectedLayerId = null;
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
			contentDiv.innerHTML = '<p>No layer selected</p>';
			return;
		}

		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			contentDiv.innerHTML = '<p>Layer not found</p>';
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
		this.addPropertyField( form, 'X Position', 'number', layer.x || 0, function ( value ) {
			this.editor.updateLayer( layer.id, { x: parseFloat( value ) } );
		}.bind( this ) );

		this.addPropertyField( form, 'Y Position', 'number', layer.y || 0, function ( value ) {
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

		this.addPropertyField( form, 'Text', 'text', layer.text || '', function ( value ) {
			self.editor.updateLayer( layer.id, { text: value } );
		} );

		this.addPropertyField( form, 'Font Size', 'number', layer.fontSize || 16, function ( value ) {
			self.editor.updateLayer( layer.id, { fontSize: parseInt( value ) } );
		} );

		this.addPropertyField( form, 'Color', 'color', layer.fill || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { fill: value } );
		} );
	};

	LayerPanel.prototype.addRectangleProperties = function ( form, layer ) {
		var self = this;

		this.addPropertyField( form, 'Width', 'number', layer.width || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { width: parseFloat( value ) } );
		} );

		this.addPropertyField( form, 'Height', 'number', layer.height || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { height: parseFloat( value ) } );
		} );

		this.addPropertyField( form, 'Stroke Color', 'color', layer.stroke || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { stroke: value } );
		} );

		this.addPropertyField( form, 'Fill Color', 'color', layer.fill || '#ffffff', function ( value ) {
			self.editor.updateLayer( layer.id, { fill: value } );
		} );
	};

	LayerPanel.prototype.addCircleProperties = function ( form, layer ) {
		var self = this;

		this.addPropertyField( form, 'Radius', 'number', layer.radius || 0, function ( value ) {
			self.editor.updateLayer( layer.id, { radius: parseFloat( value ) } );
		} );

		this.addPropertyField( form, 'Stroke Color', 'color', layer.stroke || '#000000', function ( value ) {
			self.editor.updateLayer( layer.id, { stroke: value } );
		} );

		this.addPropertyField( form, 'Fill Color', 'color', layer.fill || '#ffffff', function ( value ) {
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

	// Export LayerPanel to global scope
	window.LayerPanel = LayerPanel;

}() );
