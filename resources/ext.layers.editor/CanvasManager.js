/**
 * Canvas Manager for Layers Editor
 * Handles HTML5 canvas operations and rendering
 */
( function () {
    'use strict';

    /**
     * CanvasManager class
     * @class
     */
    function CanvasManager( config ) {
        this.config = config || {};
        this.container = this.config.container;
        this.editor = this.config.editor;
        this.canvas = null;
        this.ctx = null;
        this.backgroundImage = null;
        this.currentTool = 'pointer';
        this.isDrawing = false;
        this.startPoint = null;
        
        this.init();
    }

    CanvasManager.prototype.init = function () {
        this.canvas = this.container.querySelector( 'canvas' ) || 
                    this.container.appendChild( document.createElement( 'canvas' ) );
        this.ctx = this.canvas.getContext( '2d' );
        
        // Load background image
        this.loadBackgroundImage();
        
        // Set up event handlers
        this.setupEventHandlers();
    };

    CanvasManager.prototype.loadBackgroundImage = function () {
        var self = this;
        var filename = this.editor.filename;
        
        // Create image URL for the file
        var imageUrl = mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) + 
                      '/index.php?title=Special:Redirect/file/' + encodeURIComponent( filename );
        
        this.backgroundImage = new Image();
        this.backgroundImage.onload = function () {
            self.resizeCanvas();
            self.redraw();
        };
        this.backgroundImage.src = imageUrl;
    };

    CanvasManager.prototype.resizeCanvas = function () {
        if ( !this.backgroundImage ) return;
        
        // Set canvas size to image size
        this.canvas.width = this.backgroundImage.width;
        this.canvas.height = this.backgroundImage.height;
        
        // Style the canvas to fit container while maintaining aspect ratio
        var container = this.canvas.parentElement;
        var containerWidth = container.clientWidth;
        var containerHeight = container.clientHeight;
        
        var scaleX = containerWidth / this.canvas.width;
        var scaleY = containerHeight / this.canvas.height;
        var scale = Math.min( scaleX, scaleY );
        
        this.canvas.style.width = ( this.canvas.width * scale ) + 'px';
        this.canvas.style.height = ( this.canvas.height * scale ) + 'px';
    };

    CanvasManager.prototype.setupEventHandlers = function () {
        var self = this;
        
        // Mouse events
        this.canvas.addEventListener( 'mousedown', function ( e ) {
            self.handleMouseDown( e );
        } );
        
        this.canvas.addEventListener( 'mousemove', function ( e ) {
            self.handleMouseMove( e );
        } );
        
        this.canvas.addEventListener( 'mouseup', function ( e ) {
            self.handleMouseUp( e );
        } );
        
        // Prevent context menu
        this.canvas.addEventListener( 'contextmenu', function ( e ) {
            e.preventDefault();
        } );
    };

    CanvasManager.prototype.handleMouseDown = function ( e ) {
        var point = this.getMousePoint( e );
        this.startPoint = point;
        this.isDrawing = true;
        
        if ( this.currentTool === 'pointer' ) {
            // Handle layer selection
            this.handleLayerSelection( point );
        } else {
            // Start drawing new layer
            this.startDrawing( point );
        }
    };

    CanvasManager.prototype.handleLayerSelection = function ( point ) {
        // Find layer at click point (reverse order for top-most first)
        var selectedLayer = null;
        for ( var i = this.editor.layers.length - 1; i >= 0; i-- ) {
            var layer = this.editor.layers[i];
            if ( layer.visible !== false && this.isPointInLayer( point, layer ) ) {
                selectedLayer = layer;
                break;
            }
        }
        
        if ( selectedLayer ) {
            this.editor.selectLayer( selectedLayer.id );
        } else {
            this.editor.selectLayer( null );
        }
    };

    CanvasManager.prototype.isPointInLayer = function ( point, layer ) {
        switch ( layer.type ) {
            case 'text':
                return this.isPointInText( point, layer );
            case 'rectangle':
                return this.isPointInRectangle( point, layer );
            case 'circle':
                return this.isPointInCircle( point, layer );
            default:
                return false;
        }
    };

    CanvasManager.prototype.isPointInText = function ( point, layer ) {
        // Simple bounding box check for text
        var x = layer.x || 0;
        var y = layer.y || 0;
        var fontSize = layer.fontSize || 16;
        var text = layer.text || '';
        
        // Estimate text dimensions
        this.ctx.save();
        this.ctx.font = fontSize + 'px ' + ( layer.fontFamily || 'Arial' );
        var metrics = this.ctx.measureText( text );
        this.ctx.restore();
        
        return point.x >= x && point.x <= x + metrics.width &&
               point.y >= y - fontSize && point.y <= y;
    };

    CanvasManager.prototype.isPointInRectangle = function ( point, layer ) {
        var x = layer.x || 0;
        var y = layer.y || 0;
        var width = layer.width || 0;
        var height = layer.height || 0;
        
        // Handle negative dimensions
        if ( width < 0 ) {
            x += width;
            width = -width;
        }
        if ( height < 0 ) {
            y += height;
            height = -height;
        }
        
        return point.x >= x && point.x <= x + width &&
               point.y >= y && point.y <= y + height;
    };

    CanvasManager.prototype.isPointInCircle = function ( point, layer ) {
        var centerX = layer.x || 0;
        var centerY = layer.y || 0;
        var radius = layer.radius || 0;
        
        var dx = point.x - centerX;
        var dy = point.y - centerY;
        var distance = Math.sqrt( dx * dx + dy * dy );
        
        return distance <= radius;
    };

    CanvasManager.prototype.selectLayer = function ( layerId ) {
        this.selectedLayerId = layerId;
        this.redraw();
        this.renderLayers( this.editor.layers );
        
        // Draw selection indicators
        if ( layerId ) {
            this.drawSelectionIndicators( layerId );
        }
    };

    CanvasManager.prototype.drawSelectionIndicators = function ( layerId ) {
        var layer = this.editor.getLayerById( layerId );
        if ( !layer ) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#2196f3';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash( [5, 5] );
        
        switch ( layer.type ) {
            case 'rectangle':
                var x = layer.x || 0;
                var y = layer.y || 0;
                var width = layer.width || 0;
                var height = layer.height || 0;
                
                // Handle negative dimensions
                if ( width < 0 ) {
                    x += width;
                    width = -width;
                }
                if ( height < 0 ) {
                    y += height;
                    height = -height;
                }
                
                this.ctx.strokeRect( x - 2, y - 2, width + 4, height + 4 );
                break;
                
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc( layer.x, layer.y, ( layer.radius || 0 ) + 2, 0, 2 * Math.PI );
                this.ctx.stroke();
                break;
                
            case 'text':
                // Draw bounding box around text
                var fontSize = layer.fontSize || 16;
                var text = layer.text || '';
                this.ctx.font = fontSize + 'px ' + ( layer.fontFamily || 'Arial' );
                var metrics = this.ctx.measureText( text );
                this.ctx.strokeRect( 
                    ( layer.x || 0 ) - 2, 
                    ( layer.y || 0 ) - fontSize - 2, 
                    metrics.width + 4, 
                    fontSize + 4 
                );
                break;
        }
        
        this.ctx.restore();
    };

    CanvasManager.prototype.updateStyleOptions = function ( options ) {
        this.currentStyle = options || {};
    };

    CanvasManager.prototype.handleMouseMove = function ( e ) {
        if ( !this.isDrawing ) return;
        
        var point = this.getMousePoint( e );
        
        if ( this.currentTool !== 'pointer' ) {
            this.continueDrawing( point );
        }
    };

    CanvasManager.prototype.handleMouseUp = function ( e ) {
        if ( !this.isDrawing ) return;
        
        var point = this.getMousePoint( e );
        this.isDrawing = false;
        
        if ( this.currentTool !== 'pointer' ) {
            this.finishDrawing( point );
        }
    };

    CanvasManager.prototype.getMousePoint = function ( e ) {
        var rect = this.canvas.getBoundingClientRect();
        var scaleX = this.canvas.width / rect.width;
        var scaleY = this.canvas.height / rect.height;
        
        return {
            x: ( e.clientX - rect.left ) * scaleX,
            y: ( e.clientY - rect.top ) * scaleY
        };
    };

    CanvasManager.prototype.startDrawing = function ( point ) {
        // Use current style options if available
        var style = this.currentStyle || {};
        
        // Prepare for drawing based on current tool
        switch ( this.currentTool ) {
            case 'text':
                this.startTextTool( point, style );
                break;
            case 'rectangle':
                this.startRectangleTool( point, style );
                break;
            case 'circle':
                this.startCircleTool( point, style );
                break;
            case 'line':
                this.startLineTool( point, style );
                break;
            case 'arrow':
                this.startArrowTool( point, style );
                break;
            case 'highlight':
                this.startHighlightTool( point, style );
                break;
            // Add more tools as needed
        }
    };

    CanvasManager.prototype.continueDrawing = function ( point ) {
        // Continue drawing based on current tool
        this.redraw();
        this.drawPreview( point );
    };

    CanvasManager.prototype.finishDrawing = function ( point ) {
        // Finish drawing and create layer
        var layerData = this.createLayerFromDrawing( point );
        if ( layerData ) {
            this.editor.addLayer( layerData );
        }
    };

    CanvasManager.prototype.startTextTool = function ( point, style ) {
        // For text tool, we immediately create the layer and let user edit
        var text = prompt( 'Enter text:' );
        if ( text ) {
            var layerData = {
                type: 'text',
                text: text,
                x: point.x,
                y: point.y,
                fontSize: style.fontSize || 16,
                fontFamily: 'Arial',
                fill: style.color || '#000000'
            };
            this.editor.addLayer( layerData );
        }
        this.isDrawing = false;
    };

    CanvasManager.prototype.startRectangleTool = function ( point, style ) {
        // Store starting point for rectangle
        this.tempLayer = {
            type: 'rectangle',
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            stroke: style.color || '#000000',
            strokeWidth: style.strokeWidth || 2,
            fill: 'transparent'
        };
    };

    CanvasManager.prototype.startCircleTool = function ( point, style ) {
        // Store starting point for circle
        this.tempLayer = {
            type: 'circle',
            x: point.x,
            y: point.y,
            radius: 0,
            stroke: style.color || '#000000',
            strokeWidth: style.strokeWidth || 2,
            fill: 'transparent'
        };
    };

    CanvasManager.prototype.startLineTool = function ( point, style ) {
        this.tempLayer = {
            type: 'line',
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
            stroke: style.color || '#000000',
            strokeWidth: style.strokeWidth || 2
        };
    };

    CanvasManager.prototype.startArrowTool = function ( point, style ) {
        this.tempLayer = {
            type: 'arrow',
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
            stroke: style.color || '#000000',
            strokeWidth: style.strokeWidth || 2,
            arrowSize: 10
        };
    };

    CanvasManager.prototype.startHighlightTool = function ( point, style ) {
        this.tempLayer = {
            type: 'highlight',
            x: point.x,
            y: point.y,
            width: 0,
            height: 20, // Default highlight height
            fill: style.color ? style.color + '80' : '#ffff0080' // Add transparency
        };
    };

    CanvasManager.prototype.drawPreview = function ( point ) {
        if ( !this.tempLayer ) return;
        
        switch ( this.tempLayer.type ) {
            case 'rectangle':
                this.tempLayer.width = point.x - this.tempLayer.x;
                this.tempLayer.height = point.y - this.tempLayer.y;
                this.drawRectangle( this.tempLayer );
                break;
            case 'circle':
                var dx = point.x - this.tempLayer.x;
                var dy = point.y - this.tempLayer.y;
                this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
                this.drawCircle( this.tempLayer );
                break;
            case 'line':
                this.tempLayer.x2 = point.x;
                this.tempLayer.y2 = point.y;
                this.drawLine( this.tempLayer );
                break;
            case 'arrow':
                this.tempLayer.x2 = point.x;
                this.tempLayer.y2 = point.y;
                this.drawArrow( this.tempLayer );
                break;
            case 'highlight':
                this.tempLayer.width = point.x - this.tempLayer.x;
                this.drawHighlight( this.tempLayer );
                break;
        }
    };

    CanvasManager.prototype.createLayerFromDrawing = function ( point ) {
        if ( !this.tempLayer ) return null;
        
        var layer = this.tempLayer;
        this.tempLayer = null;
        
        // Final adjustments based on tool type
        switch ( layer.type ) {
            case 'rectangle':
                layer.width = point.x - layer.x;
                layer.height = point.y - layer.y;
                break;
            case 'circle':
                var dx = point.x - layer.x;
                var dy = point.y - layer.y;
                layer.radius = Math.sqrt( dx * dx + dy * dy );
                break;
            case 'line':
                layer.x2 = point.x;
                layer.y2 = point.y;
                break;
            case 'arrow':
                layer.x2 = point.x;
                layer.y2 = point.y;
                break;
            case 'highlight':
                layer.width = point.x - layer.x;
                break;
        }
        
        // Don't create tiny shapes
        if ( layer.type === 'rectangle' && ( Math.abs( layer.width ) < 5 || Math.abs( layer.height ) < 5 ) ) {
            return null;
        }
        if ( layer.type === 'circle' && layer.radius < 5 ) {
            return null;
        }
        if ( ( layer.type === 'line' || layer.type === 'arrow' ) && 
             Math.sqrt( Math.pow( layer.x2 - layer.x1, 2 ) + Math.pow( layer.y2 - layer.y1, 2 ) ) < 5 ) {
            return null;
        }
        
        return layer;
    };

    CanvasManager.prototype.setTool = function ( tool ) {
        this.currentTool = tool;
        this.canvas.style.cursor = this.getToolCursor( tool );
    };

    CanvasManager.prototype.getToolCursor = function ( tool ) {
        switch ( tool ) {
            case 'text': return 'text';
            case 'rectangle':
            case 'circle': return 'crosshair';
            default: return 'default';
        }
    };

    CanvasManager.prototype.renderLayers = function ( layers ) {
        this.redraw();
        
        layers.forEach( function ( layer ) {
            this.drawLayer( layer );
        }.bind( this ) );
    };

    CanvasManager.prototype.redraw = function () {
        // Clear canvas
        this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
        
        // Draw background image
        if ( this.backgroundImage ) {
            this.ctx.drawImage( this.backgroundImage, 0, 0 );
        }
    };

    CanvasManager.prototype.drawLayer = function ( layer ) {
        // Skip invisible layers
        if ( layer.visible === false ) {
            return;
        }
        
        switch ( layer.type ) {
            case 'text':
                this.drawText( layer );
                break;
            case 'rectangle':
                this.drawRectangle( layer );
                break;
            case 'circle':
                this.drawCircle( layer );
                break;
            case 'line':
                this.drawLine( layer );
                break;
            case 'arrow':
                this.drawArrow( layer );
                break;
            case 'highlight':
                this.drawHighlight( layer );
                break;
            // Add more layer types as needed
        }
    };

    CanvasManager.prototype.drawText = function ( layer ) {
        this.ctx.save();
        this.ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
        this.ctx.fillStyle = layer.fill || '#000000';
        this.ctx.fillText( layer.text || '', layer.x || 0, layer.y || 0 );
        this.ctx.restore();
    };

    CanvasManager.prototype.drawRectangle = function ( layer ) {
        this.ctx.save();
        
        if ( layer.fill && layer.fill !== 'transparent' ) {
            this.ctx.fillStyle = layer.fill;
            this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );
        }
        
        if ( layer.stroke ) {
            this.ctx.strokeStyle = layer.stroke;
            this.ctx.lineWidth = layer.strokeWidth || 1;
            this.ctx.strokeRect( layer.x, layer.y, layer.width, layer.height );
        }
        
        this.ctx.restore();
    };

    CanvasManager.prototype.drawCircle = function ( layer ) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc( layer.x, layer.y, layer.radius, 0, 2 * Math.PI );
        
        if ( layer.fill && layer.fill !== 'transparent' ) {
            this.ctx.fillStyle = layer.fill;
            this.ctx.fill();
        }
        
        if ( layer.stroke ) {
            this.ctx.strokeStyle = layer.stroke;
            this.ctx.lineWidth = layer.strokeWidth || 1;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    };

    CanvasManager.prototype.drawLine = function ( layer ) {
        this.ctx.save();
        this.ctx.strokeStyle = layer.stroke || '#000000';
        this.ctx.lineWidth = layer.strokeWidth || 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo( layer.x1, layer.y1 );
        this.ctx.lineTo( layer.x2, layer.y2 );
        this.ctx.stroke();
        
        this.ctx.restore();
    };

    CanvasManager.prototype.drawArrow = function ( layer ) {
        this.ctx.save();
        this.ctx.strokeStyle = layer.stroke || '#000000';
        this.ctx.fillStyle = layer.stroke || '#000000';
        this.ctx.lineWidth = layer.strokeWidth || 1;
        
        var x1 = layer.x1;
        var y1 = layer.y1;
        var x2 = layer.x2;
        var y2 = layer.y2;
        var arrowSize = layer.arrowSize || 10;
        
        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo( x1, y1 );
        this.ctx.lineTo( x2, y2 );
        this.ctx.stroke();
        
        // Calculate arrow head
        var angle = Math.atan2( y2 - y1, x2 - x1 );
        var arrowAngle = Math.PI / 6; // 30 degrees
        
        // Draw arrow head
        this.ctx.beginPath();
        this.ctx.moveTo( x2, y2 );
        this.ctx.lineTo( 
            x2 - arrowSize * Math.cos( angle - arrowAngle ),
            y2 - arrowSize * Math.sin( angle - arrowAngle )
        );
        this.ctx.moveTo( x2, y2 );
        this.ctx.lineTo( 
            x2 - arrowSize * Math.cos( angle + arrowAngle ),
            y2 - arrowSize * Math.sin( angle + arrowAngle )
        );
        this.ctx.stroke();
        
        this.ctx.restore();
    };

    CanvasManager.prototype.drawHighlight = function ( layer ) {
        this.ctx.save();
        
        // Draw semi-transparent highlight
        this.ctx.fillStyle = layer.fill || '#ffff0080';
        this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );
        
        this.ctx.restore();
    };

    CanvasManager.prototype.handleResize = function () {
        this.resizeCanvas();
        this.redraw();
    };

    // Export CanvasManager to global scope
    window.CanvasManager = CanvasManager;

}() );
