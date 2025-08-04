/**
 * Main Layers Editor Controller
 * Manages the overall editing interface and coordinates between components
 */
( function () {
    'use strict';

    /**
     * LayersEditor main class
     * @class
     */
    function LayersEditor( config ) {
        this.config = config || {};
        this.filename = this.config.filename;
        this.canvasManager = null;
        this.layerPanel = null;
        this.toolbar = null;
        this.layers = [];
        this.currentTool = 'pointer';
        this.isDirty = false;
        
        this.init();
    }

    LayersEditor.prototype.init = function () {
        // Create the main editor interface
        this.createInterface();
        
        // Initialize undo/redo system
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // Initialize components
        this.canvasManager = new window.CanvasManager( {
            container: this.$canvas.get( 0 ),
            editor: this
        } );
        
        this.layerPanel = new window.LayerPanel( {
            container: this.$layerPanel.get( 0 ),
            editor: this
        } );
        
        this.toolbar = new window.Toolbar( {
            container: this.$toolbar.get( 0 ),
            editor: this
        } );
        
        // Load existing layers if any
        this.loadLayers();
        
        // Set up event handlers
        this.setupEventHandlers();
    };

    LayersEditor.prototype.createInterface = function () {
        // Create main editor container
        this.$container = $( '<div>' )
            .addClass( 'layers-editor' )
            .appendTo( 'body' );
            
        // Create toolbar
        this.$toolbar = $( '<div>' )
            .addClass( 'layers-toolbar' )
            .appendTo( this.$container );
            
        // Create main content area
        this.$content = $( '<div>' )
            .addClass( 'layers-content' )
            .appendTo( this.$container );
            
        // Create layer panel
        this.$layerPanel = $( '<div>' )
            .addClass( 'layers-panel' )
            .appendTo( this.$content );
            
        // Create canvas container
        this.$canvasContainer = $( '<div>' )
            .addClass( 'layers-canvas-container' )
            .appendTo( this.$content );
            
        this.$canvas = $( '<canvas>' )
            .addClass( 'layers-canvas' )
            .appendTo( this.$canvasContainer );
    };

    LayersEditor.prototype.setupEventHandlers = function () {
        var self = this;
        
        // Handle window resize
        $( window ).on( 'resize.layerseditor', function () {
            self.handleResize();
        } );
        
        // Handle unsaved changes warning
        $( window ).on( 'beforeunload.layerseditor', function () {
            if ( self.isDirty ) {
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        } );
    };

    LayersEditor.prototype.loadLayers = function () {
        var self = this;
        
        // Load existing layers from API
        var api = new mw.Api();
        api.get( {
            action: 'layersinfo',
            filename: this.filename,
            format: 'json'
        } ).done( function ( data ) {
            if ( data.layersinfo && data.layersinfo.layerset ) {
                self.layers = data.layersinfo.layerset.data.layers || [];
                self.renderLayers();
            }
        } ).fail( function ( err ) {
            console.error( 'Failed to load layers:', err );
        } );
    };

    LayersEditor.prototype.renderLayers = function () {
        // Render layers on canvas
        if ( this.canvasManager ) {
            this.canvasManager.renderLayers( this.layers );
        }
        
        // Update layer panel
        if ( this.layerPanel ) {
            this.layerPanel.updateLayers( this.layers );
        }
    };

    LayersEditor.prototype.addLayer = function ( layerData ) {
        // Save current state for undo
        this.saveState();
        
        // Add new layer
        layerData.id = this.generateLayerId();
        this.layers.push( layerData );
        this.renderLayers();
        this.markDirty();
        
        // Update UI state
        this.updateUIState();
    };

    LayersEditor.prototype.updateLayer = function ( layerId, changes ) {
        // Save current state for undo
        this.saveState();
        
        // Update existing layer
        var layer = this.getLayerById( layerId );
        if ( layer ) {
            $.extend( layer, changes );
            this.renderLayers();
            this.markDirty();
        }
    };

    LayersEditor.prototype.removeLayer = function ( layerId ) {
        // Save current state for undo
        this.saveState();
        
        // Remove layer
        this.layers = this.layers.filter( function ( layer ) {
            return layer.id !== layerId;
        } );
        this.renderLayers();
        this.markDirty();
        
        // Update UI state
        this.updateUIState();
    };

    LayersEditor.prototype.getLayerById = function ( layerId ) {
        return this.layers.find( function ( layer ) {
            return layer.id === layerId;
        } );
    };

    LayersEditor.prototype.generateLayerId = function () {
        return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).substr( 2, 9 );
    };

    LayersEditor.prototype.setCurrentTool = function ( tool ) {
        this.currentTool = tool;
        if ( this.canvasManager ) {
            this.canvasManager.setTool( tool );
        }
    };

    // Undo/Redo System
    LayersEditor.prototype.saveState = function () {
        // Save current layers state for undo
        var state = JSON.parse( JSON.stringify( this.layers ) );
        this.undoStack.push( state );
        
        // Limit undo stack size
        if ( this.undoStack.length > this.maxUndoSteps ) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
        
        this.updateUIState();
    };

    LayersEditor.prototype.undo = function () {
        if ( this.undoStack.length === 0 ) {
            return;
        }
        
        // Save current state to redo stack
        var currentState = JSON.parse( JSON.stringify( this.layers ) );
        this.redoStack.push( currentState );
        
        // Restore previous state
        var previousState = this.undoStack.pop();
        this.layers = previousState;
        
        this.renderLayers();
        this.markDirty();
        this.updateUIState();
    };

    LayersEditor.prototype.redo = function () {
        if ( this.redoStack.length === 0 ) {
            return;
        }
        
        // Save current state to undo stack
        var currentState = JSON.parse( JSON.stringify( this.layers ) );
        this.undoStack.push( currentState );
        
        // Restore next state
        var nextState = this.redoStack.pop();
        this.layers = nextState;
        
        this.renderLayers();
        this.markDirty();
        this.updateUIState();
    };

    // Selection Management
    LayersEditor.prototype.selectLayer = function ( layerId ) {
        this.selectedLayerId = layerId;
        if ( this.layerPanel ) {
            this.layerPanel.selectLayer( layerId );
        }
        this.updateUIState();
    };

    LayersEditor.prototype.deleteSelected = function () {
        if ( this.selectedLayerId ) {
            this.removeLayer( this.selectedLayerId );
            this.selectedLayerId = null;
        }
    };

    LayersEditor.prototype.duplicateSelected = function () {
        if ( this.selectedLayerId ) {
            var layer = this.getLayerById( this.selectedLayerId );
            if ( layer ) {
                var duplicate = JSON.parse( JSON.stringify( layer ) );
                duplicate.x = ( duplicate.x || 0 ) + 10;
                duplicate.y = ( duplicate.y || 0 ) + 10;
                delete duplicate.id; // Will be regenerated
                this.addLayer( duplicate );
            }
        }
    };

    LayersEditor.prototype.updateUIState = function () {
        // Update toolbar state
        if ( this.toolbar ) {
            this.toolbar.updateUndoRedoState( 
                this.undoStack.length > 0, 
                this.redoStack.length > 0 
            );
            this.toolbar.updateDeleteState( !!this.selectedLayerId );
        }
    };

    LayersEditor.prototype.cancel = function () {
        if ( this.isDirty ) {
            if ( confirm( 'You have unsaved changes. Are you sure you want to cancel?' ) ) {
                this.destroy();
            }
        } else {
            this.destroy();
        }
    };

    LayersEditor.prototype.save = function () {
        var self = this;
        
        // Save layers to API
        var api = new mw.Api();
        api.postWithToken( 'csrf', {
            action: 'layerssave',
            filename: this.filename,
            data: JSON.stringify( this.layers ),
            format: 'json'
        } ).done( function ( data ) {
            if ( data.layerssave && data.layerssave.success ) {
                self.markClean();
                mw.notify( mw.msg( 'layers-save-success' ), { type: 'success' } );
            } else {
                mw.notify( mw.msg( 'layers-save-error' ), { type: 'error' } );
            }
        } ).fail( function ( err ) {
            console.error( 'Failed to save layers:', err );
            mw.notify( mw.msg( 'layers-save-error' ), { type: 'error' } );
        } );
    };

    LayersEditor.prototype.markDirty = function () {
        this.isDirty = true;
        // Update UI to show unsaved changes
    };

    LayersEditor.prototype.markClean = function () {
        this.isDirty = false;
        // Update UI to show saved state
    };

    LayersEditor.prototype.handleResize = function () {
        if ( this.canvasManager ) {
            this.canvasManager.handleResize();
        }
    };

    LayersEditor.prototype.destroy = function () {
        // Cleanup
        $( window ).off( '.layerseditor' );
        if ( this.$container ) {
            this.$container.remove();
        }
    };

    // Export LayersEditor to global scope
    window.LayersEditor = LayersEditor;

    // Initialize editor when appropriate
    mw.hook( 'layers.editor.init' ).add( function ( config ) {
        new LayersEditor( config );
    } );

}() );
