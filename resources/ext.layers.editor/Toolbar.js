/**
 * Toolbar for Layers Editor
 * Manages drawing tools, color picker, and editor actions
 */
( function () {
    'use strict';

    /**
     * Toolbar class
     * @class
     */
    function Toolbar( config ) {
        this.config = config || {};
        this.container = this.config.container;
        this.editor = this.config.editor;
        this.currentTool = 'pointer';
        this.currentColor = '#000000';
        this.currentStrokeWidth = 2;
        
        this.init();
    }

    Toolbar.prototype.init = function () {
        this.createInterface();
        this.setupEventHandlers();
    };

    Toolbar.prototype.createInterface = function () {
        this.container.innerHTML = '';
        this.container.className = 'layers-toolbar';
        
        // Create tool groups
        this.createToolGroup();
        this.createStyleGroup();
        this.createActionGroup();
    };

    Toolbar.prototype.createToolGroup = function () {
        var toolGroup = document.createElement( 'div' );
        toolGroup.className = 'toolbar-group tools-group';
        
        var tools = [
            { id: 'pointer', icon: '↖', title: 'Select Tool', key: 'V' },
            { id: 'text', icon: 'T', title: 'Text Tool', key: 'T' },
            { id: 'rectangle', icon: '▢', title: 'Rectangle Tool', key: 'R' },
            { id: 'circle', icon: '○', title: 'Circle Tool', key: 'C' },
            { id: 'arrow', icon: '→', title: 'Arrow Tool', key: 'A' },
            { id: 'line', icon: '/', title: 'Line Tool', key: 'L' },
            { id: 'highlight', icon: '▒', title: 'Highlight Tool', key: 'H' }
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
        
        if ( tool.id === this.currentTool ) {
            button.classList.add( 'active' );
        }
        
        return button;
    };

    Toolbar.prototype.createStyleGroup = function () {
        var styleGroup = document.createElement( 'div' );
        styleGroup.className = 'toolbar-group style-group';
        
        // Color picker
        var colorPicker = document.createElement( 'input' );
        colorPicker.type = 'color';
        colorPicker.className = 'color-picker';
        colorPicker.value = this.currentColor;
        colorPicker.title = 'Color';
        styleGroup.appendChild( colorPicker );
        
        // Stroke width
        var strokeWidthContainer = document.createElement( 'div' );
        strokeWidthContainer.className = 'stroke-width-container';
        
        var strokeLabel = document.createElement( 'label' );
        strokeLabel.textContent = 'Width:';
        strokeLabel.className = 'stroke-label';
        
        var strokeWidth = document.createElement( 'input' );
        strokeWidth.type = 'range';
        strokeWidth.min = '1';
        strokeWidth.max = '20';
        strokeWidth.value = this.currentStrokeWidth;
        strokeWidth.className = 'stroke-width';
        strokeWidth.title = 'Stroke Width';
        
        var strokeValue = document.createElement( 'span' );
        strokeValue.className = 'stroke-value';
        strokeValue.textContent = this.currentStrokeWidth;
        
        strokeWidthContainer.appendChild( strokeLabel );
        strokeWidthContainer.appendChild( strokeWidth );
        strokeWidthContainer.appendChild( strokeValue );
        styleGroup.appendChild( strokeWidthContainer );
        
        // Font size (for text tool)
        var fontSizeContainer = document.createElement( 'div' );
        fontSizeContainer.className = 'font-size-container';
        fontSizeContainer.style.display = 'none';
        
        var fontLabel = document.createElement( 'label' );
        fontLabel.textContent = 'Size:';
        fontLabel.className = 'font-label';
        
        var fontSize = document.createElement( 'input' );
        fontSize.type = 'number';
        fontSize.min = '8';
        fontSize.max = '72';
        fontSize.value = '16';
        fontSize.className = 'font-size';
        fontSize.title = 'Font Size';
        
        fontSizeContainer.appendChild( fontLabel );
        fontSizeContainer.appendChild( fontSize );
        styleGroup.appendChild( fontSizeContainer );
        
        this.container.appendChild( styleGroup );
        
        // Store references
        this.colorPicker = colorPicker;
        this.strokeWidth = strokeWidth;
        this.strokeValue = strokeValue;
        this.fontSize = fontSize;
        this.fontSizeContainer = fontSizeContainer;
    };

    Toolbar.prototype.createActionGroup = function () {
        var actionGroup = document.createElement( 'div' );
        actionGroup.className = 'toolbar-group action-group';
        
        var actions = [
            { id: 'undo', icon: '↶', title: 'Undo', key: 'Ctrl+Z' },
            { id: 'redo', icon: '↷', title: 'Redo', key: 'Ctrl+Y' },
            { id: 'delete', icon: '🗑', title: 'Delete Selected', key: 'Delete' },
            { id: 'duplicate', icon: '⧉', title: 'Duplicate Selected', key: 'Ctrl+D' }
        ];
        
        actions.forEach( function ( action ) {
            var button = this.createActionButton( action );
            actionGroup.appendChild( button );
        }.bind( this ) );
        
        // Separator
        var separator = document.createElement( 'div' );
        separator.className = 'toolbar-separator';
        actionGroup.appendChild( separator );
        
        // Save and Cancel buttons
        var saveButton = document.createElement( 'button' );
        saveButton.className = 'toolbar-button save-button primary';
        saveButton.textContent = mw.msg( 'layers-editor-save' );
        saveButton.title = 'Save Changes (Ctrl+S)';
        actionGroup.appendChild( saveButton );
        
        var cancelButton = document.createElement( 'button' );
        cancelButton.className = 'toolbar-button cancel-button';
        cancelButton.textContent = mw.msg( 'layers-editor-cancel' );
        cancelButton.title = 'Cancel Changes (Escape)';
        actionGroup.appendChild( cancelButton );
        
        this.container.appendChild( actionGroup );
        
        // Store references
        this.saveButton = saveButton;
        this.cancelButton = cancelButton;
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
            }
        } );
        
        // Save/Cancel buttons
        this.saveButton.addEventListener( 'click', function () {
            self.editor.save();
        } );
        
        this.cancelButton.addEventListener( 'click', function () {
            self.editor.cancel();
        } );
        
        // Color picker
        this.colorPicker.addEventListener( 'change', function () {
            self.currentColor = this.value;
            self.updateStyleOptions();
        } );
        
        // Stroke width
        this.strokeWidth.addEventListener( 'input', function () {
            self.currentStrokeWidth = parseInt( this.value );
            self.strokeValue.textContent = self.currentStrokeWidth;
            self.updateStyleOptions();
        } );
        
        // Font size
        this.fontSize.addEventListener( 'change', function () {
            self.updateStyleOptions();
        } );
        
        // Keyboard shortcuts
        document.addEventListener( 'keydown', function ( e ) {
            self.handleKeyboardShortcuts( e );
        } );
    };

    Toolbar.prototype.selectTool = function ( toolId ) {
        // Update UI
        this.container.querySelectorAll( '.tool-button' ).forEach( function ( button ) {
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
    };

    Toolbar.prototype.updateToolOptions = function ( toolId ) {
        // Show/hide font size controls for text tool
        if ( toolId === 'text' ) {
            this.fontSizeContainer.style.display = 'block';
        } else {
            this.fontSizeContainer.style.display = 'none';
        }
    };

    Toolbar.prototype.updateStyleOptions = function () {
        // Update current style settings and notify editor
        var styleOptions = {
            color: this.currentColor,
            strokeWidth: this.currentStrokeWidth,
            fontSize: parseInt( this.fontSize.value )
        };
        
        if ( this.editor.canvasManager ) {
            this.editor.canvasManager.updateStyleOptions( styleOptions );
        }
    };

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
                case 'r':
                    this.selectTool( 'rectangle' );
                    break;
                case 'c':
                    this.selectTool( 'circle' );
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
