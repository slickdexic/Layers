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
        
        // Zoom and pan functionality
        this.zoom = 1.0;
        this.minZoom = 0.1;
        this.maxZoom = 5.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanPoint = null;
        
        // Grid settings
        this.showGrid = false;
        this.gridSize = 20;
        this.snapToGrid = false;
        
        this.init();
    }

    CanvasManager.prototype.init = function () {
        console.log( 'Layers: CanvasManager initializing...' );
        
        this.canvas = this.container.querySelector( 'canvas' ) || 
                    this.container.appendChild( document.createElement( 'canvas' ) );
        this.ctx = this.canvas.getContext( '2d' );
        
        console.log( 'Layers: Canvas created, size:', this.canvas.width, 'x', this.canvas.height );
        
        // Load background image
        this.loadBackgroundImage();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        console.log( 'Layers: CanvasManager initialization complete' );
    };

    CanvasManager.prototype.loadBackgroundImage = function () {
        var self = this;
        var filename = this.editor.filename;
        
        // Create image URL for the file - try multiple URL patterns
        var imageUrls = [];
        
        // Try MediaWiki patterns only if mw is properly configured
        if ( mw && mw.config && mw.config.get( 'wgServer' ) && mw.config.get( 'wgScriptPath' ) ) {
            imageUrls.push( 
                mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) + 
                '/index.php?title=Special:Redirect/file/' + encodeURIComponent( filename )
            );
            
            if ( mw.config.get( 'wgArticlePath' ) ) {
                imageUrls.push( 
                    mw.config.get( 'wgServer' ) + mw.config.get( 'wgArticlePath' ).replace( '$1', 'File:' + encodeURIComponent( filename ) )
                );
            }
            
            imageUrls.push( mw.config.get( 'wgServer' ) + '/wiki/File:' + encodeURIComponent( filename ) );
        }
        
        // Add test placeholder image
        imageUrls.push( 'https://via.placeholder.com/800x600/f8f9fa/666666?text=' + encodeURIComponent( filename + ' - Sample Image' ) );
        
        // Always add test SVG as final fallback
        imageUrls.push( 'data:image/svg+xml;base64,' + btoa( this.createTestImage( filename ) ) );
        
        console.log( 'Layers: Trying to load background image from URLs:', imageUrls );
        this.tryLoadImage( imageUrls, 0 );
    };

    CanvasManager.prototype.tryLoadImage = function ( urls, index ) {
        var self = this;
        
        if ( index >= urls.length ) {
            console.error( 'Layers: Failed to load image from any URL, using test image' );
            this.useTestImage();
            return;
        }
        
        var currentUrl = urls[index];
        console.log( 'Layers: Attempting to load image from:', currentUrl );
        
        this.backgroundImage = new Image();
        this.backgroundImage.crossOrigin = 'anonymous'; // Allow cross-origin images
        
        this.backgroundImage.onload = function () {
            console.log( 'Layers: Background image loaded successfully from:', currentUrl );
            console.log( 'Layers: Image dimensions:', self.backgroundImage.width, 'x', self.backgroundImage.height );
            self.resizeCanvas();
            self.redraw();
            if ( self.editor.layers ) {
                self.renderLayers( self.editor.layers );
            }
        };
        
        this.backgroundImage.onerror = function () {
            console.warn( 'Layers: Failed to load image from:', currentUrl );
            // Try next URL
            self.tryLoadImage( urls, index + 1 );
        };
        
        this.backgroundImage.src = currentUrl;
    };

    CanvasManager.prototype.useTestImage = function () {
        // Create a test image when no real image is available
        var self = this;
        this.backgroundImage = new Image();
        
        var testImageData = this.createTestImage( this.editor.filename );
        this.backgroundImage.src = 'data:image/svg+xml;base64,' + btoa( testImageData );
        
        this.backgroundImage.onload = function () {
            console.log( 'Layers: Test background image loaded successfully' );
            console.log( 'Layers: Test image dimensions:', self.backgroundImage.width, 'x', self.backgroundImage.height );
            self.resizeCanvas();
            self.redraw();
            if ( self.editor.layers ) {
                self.renderLayers( self.editor.layers );
            }
        };
        
        this.backgroundImage.onerror = function () {
            console.error( 'Layers: Even test image failed to load, creating canvas background' );
            self.createCanvasBackground();
        };
    };

    CanvasManager.prototype.createCanvasBackground = function () {
        // Create a simple background directly on canvas when even SVG fails
        console.log( 'Layers: Creating canvas background as final fallback' );
        this.backgroundImage = null;
        
        // Set default canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Draw background
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
        this.ctx.strokeStyle = '#dee2e6';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect( 1, 1, this.canvas.width - 2, this.canvas.height - 2 );
        
        // Add text
        this.ctx.fillStyle = '#6c757d';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText( this.editor.filename, this.canvas.width / 2, this.canvas.height / 2 - 20 );
        this.ctx.font = '16px Arial';
        this.ctx.fillText( 'Sample Image for Layer Editing', this.canvas.width / 2, this.canvas.height / 2 + 20 );
        
        // Add some design elements
        this.ctx.strokeStyle = '#e9ecef';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc( 200, 150, 50, 0, 2 * Math.PI );
        this.ctx.stroke();
        
        this.ctx.strokeRect( 500, 300, 100, 80 );
        
        this.ctx.beginPath();
        this.ctx.moveTo( 100, 400 );
        this.ctx.lineTo( 300, 500 );
        this.ctx.stroke();
        
        // Set up canvas display
        this.canvas.style.width = '800px';
        this.canvas.style.height = '600px';
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        
        console.log( 'Layers: Canvas background created successfully' );
        
        if ( this.editor && this.editor.layers ) {
            this.renderLayers( this.editor.layers );
        }
    };

    CanvasManager.prototype.createTestImage = function ( filename ) {
        return '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>' +
            '<text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#495057">' + 
            (filename || 'Sample Image').replace(/[<>&"]/g, function(match) {
                return {'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;'}[match];
            }) + '</text>' +
            '<text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6c757d">Sample Image for Layer Editing</text>' +
            '<circle cx="200" cy="150" r="50" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
            '<rect x="500" y="300" width="100" height="80" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
            '<line x1="100" y1="400" x2="300" y2="500" stroke="#e9ecef" stroke-width="2"/>' +
            '<text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#adb5bd">Draw shapes and text using the tools above</text>' +
            '</svg>';
    };

    CanvasManager.prototype.resizeCanvas = function () {
        if ( !this.backgroundImage ) return;
        
        // Set canvas logical size to image size
        this.canvas.width = this.backgroundImage.width;
        this.canvas.height = this.backgroundImage.height;
        
        console.log( 'Layers: Canvas resized to', this.canvas.width, 'x', this.canvas.height );
        
        // Calculate display size that fits in container
        var container = this.canvas.parentElement;
        var containerWidth = container.clientWidth - 40; // padding
        var containerHeight = container.clientHeight - 40;
        
        var scaleX = containerWidth / this.backgroundImage.width;
        var scaleY = containerHeight / this.backgroundImage.height;
        var scale = Math.min( scaleX, scaleY, 1 ); // Don't scale up initially
        
        // Set CSS size for display
        this.canvas.style.width = ( this.backgroundImage.width * scale ) + 'px';
        this.canvas.style.height = ( this.backgroundImage.height * scale ) + 'px';
        
        // Initialize zoom to fit
        this.zoom = scale;
        this.panX = 0;
        this.panY = 0;
        
        console.log( 'Layers: Initial zoom set to', this.zoom );
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
        
        // Wheel event for zooming
        this.canvas.addEventListener( 'wheel', function ( e ) {
            e.preventDefault();
            self.handleWheel( e );
        } );
        
        // Prevent context menu
        this.canvas.addEventListener( 'contextmenu', function ( e ) {
            e.preventDefault();
        } );
        
        // Keyboard events for pan and zoom
        document.addEventListener( 'keydown', function ( e ) {
            self.handleKeyDown( e );
        } );
        
        document.addEventListener( 'keyup', function ( e ) {
            self.handleKeyUp( e );
        } );
        
        // Touch events for mobile support
        this.canvas.addEventListener( 'touchstart', function ( e ) {
            e.preventDefault();
            var touch = e.touches[0];
            var mouseEvent = new MouseEvent( 'mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            } );
            self.canvas.dispatchEvent( mouseEvent );
        } );
        
        this.canvas.addEventListener( 'touchmove', function ( e ) {
            e.preventDefault();
            var touch = e.touches[0];
            var mouseEvent = new MouseEvent( 'mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            } );
            self.canvas.dispatchEvent( mouseEvent );
        } );
        
        this.canvas.addEventListener( 'touchend', function ( e ) {
            e.preventDefault();
            var mouseEvent = new MouseEvent( 'mouseup', {} );
            self.canvas.dispatchEvent( mouseEvent );
        } );
    };

    CanvasManager.prototype.handleMouseDown = function ( e ) {
        var point = this.getMousePoint( e );
        this.startPoint = point;
        
        // Handle middle mouse button or space+click for panning
        if ( e.button === 1 || ( e.button === 0 && e.spaceKey ) ) {
            this.isPanning = true;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // Ignore right click
        if ( e.button === 2 ) {
            return;
        }
        
        this.isDrawing = true;
        
        if ( this.currentTool === 'pointer' ) {
            // Handle layer selection
            this.handleLayerSelection( point );
        } else {
            // Start drawing new layer
            this.startDrawing( point );
        }
    };

    CanvasManager.prototype.handleMouseMove = function ( e ) {
        if ( this.isPanning ) {
            var deltaX = e.clientX - this.lastPanPoint.x;
            var deltaY = e.clientY - this.lastPanPoint.y;
            
            // Apply pan offset to canvas position
            var currentTranslateX = this.panX || 0;
            var currentTranslateY = this.panY || 0;
            
            this.panX = currentTranslateX + deltaX;
            this.panY = currentTranslateY + deltaY;
            
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            
            // Update canvas position
            this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            this.canvas.style.transformOrigin = '0 0';
            
            return;
        }
        
        if ( !this.isDrawing ) return;
        
        var point = this.getMousePoint( e );
        
        if ( this.currentTool !== 'pointer' ) {
            this.continueDrawing( point );
        }
    };

    CanvasManager.prototype.handleMouseUp = function ( e ) {
        if ( this.isPanning ) {
            this.isPanning = false;
            this.canvas.style.cursor = this.getToolCursor( this.currentTool );
            return;
        }
        
        if ( !this.isDrawing ) return;
        
        var point = this.getMousePoint( e );
        this.isDrawing = false;
        
        if ( this.currentTool !== 'pointer' ) {
            this.finishDrawing( point );
        }
    };

    CanvasManager.prototype.handleWheel = function ( e ) {
        e.preventDefault();
        
        var delta = e.deltaY > 0 ? -0.1 : 0.1;
        var newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom + delta ) );
        
        if ( newZoom !== this.zoom ) {
            // Get mouse position relative to canvas before zoom
            var rect = this.canvas.getBoundingClientRect();
            var mouseX = e.clientX - rect.left;
            var mouseY = e.clientY - rect.top;
            
            // Calculate the point on the canvas that the mouse is over
            var canvasPointX = mouseX / this.zoom;
            var canvasPointY = mouseY / this.zoom;
            
            // Update zoom
            this.zoom = newZoom;
            
            // Update CSS size
            if ( this.backgroundImage ) {
                this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
                this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
            }
            
            this.updateCanvasTransform();
        }
    };

    CanvasManager.prototype.handleKeyDown = function ( e ) {
        // Don't handle keys when typing in input fields
        if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
            return;
        }
        
        // Zoom shortcuts
        if ( e.ctrlKey || e.metaKey ) {
            switch ( e.key ) {
                case '=':
                case '+':
                    e.preventDefault();
                    this.zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    this.zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    this.resetZoom();
                    break;
            }
        }
        
        // Pan shortcuts with arrow keys
        if ( !e.ctrlKey && !e.metaKey ) {
            var panDistance = 20;
            switch ( e.key ) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.panY += panDistance;
                    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.panY -= panDistance;
                    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.panX += panDistance;
                    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.panX -= panDistance;
                    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
                    break;
            }
        }
        
        // Space key for temporary pan mode
        if ( e.code === 'Space' && !e.repeat ) {
            e.preventDefault();
            e.spaceKey = true;
            this.canvas.style.cursor = 'grab';
        }
    };

    CanvasManager.prototype.zoomIn = function () {
        this.setZoom( this.zoom + 0.1 );
    };

    CanvasManager.prototype.zoomOut = function () {
        this.setZoom( this.zoom - 0.1 );
    };

    CanvasManager.prototype.setZoom = function ( newZoom ) {
        this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
        
        // Update CSS size based on zoom
        if ( this.backgroundImage ) {
            this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
            this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
        }
        
        this.updateCanvasTransform();
        
        console.log( 'Layers: Zoom set to', this.zoom );
    };

    CanvasManager.prototype.resetZoom = function () {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        
        if ( this.backgroundImage ) {
            this.canvas.style.width = this.backgroundImage.width + 'px';
            this.canvas.style.height = this.backgroundImage.height + 'px';
        }
        
        this.updateCanvasTransform();
        
        if ( this.editor.toolbar ) {
            this.editor.toolbar.updateZoomDisplay( 100 );
        }
    };

    CanvasManager.prototype.fitToWindow = function () {
        if ( !this.backgroundImage ) return;
        
        var container = this.canvas.parentElement;
        var containerWidth = container.clientWidth - 40; // padding
        var containerHeight = container.clientHeight - 40;
        
        var scaleX = containerWidth / this.backgroundImage.width;
        var scaleY = containerHeight / this.backgroundImage.height;
        var scale = Math.min( scaleX, scaleY );
        
        this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, scale ) );
        this.panX = 0;
        this.panY = 0;
        
        // Update CSS size
        this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
        this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
        
        this.updateCanvasTransform();
        
        if ( this.editor.toolbar ) {
            this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
        }
        
        console.log( 'Layers: Fit to window - zoom:', this.zoom );
    };

    CanvasManager.prototype.updateCanvasTransform = function () {
        // Update zoom display
        if ( this.editor.toolbar ) {
            this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
        }
        
        // Apply CSS transform for zoom and pan
        var scale = this.zoom;
        var translateX = this.panX;
        var translateY = this.panY;
        
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        this.canvas.style.transformOrigin = '0 0';
        
        console.log( 'Layers: Canvas transform updated - zoom:', this.zoom, 'pan:', this.panX, this.panY );
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
            case 'path':
                return this.isPointInPath( point, layer );
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

    CanvasManager.prototype.isPointInPath = function ( point, layer ) {
        if ( !layer.points || layer.points.length < 2 ) return false;
        
        var tolerance = ( layer.strokeWidth || 2 ) + 3; // Click tolerance
        
        // Check if point is near any line segment in the path
        for ( var i = 0; i < layer.points.length - 1; i++ ) {
            var p1 = layer.points[i];
            var p2 = layer.points[i + 1];
            
            var distance = this.distanceToLineSegment( point, p1, p2 );
            if ( distance <= tolerance ) {
                return true;
            }
        }
        
        return false;
    };

    CanvasManager.prototype.distanceToLineSegment = function ( point, lineStart, lineEnd ) {
        var A = point.x - lineStart.x;
        var B = point.y - lineStart.y;
        var C = lineEnd.x - lineStart.x;
        var D = lineEnd.y - lineStart.y;

        var dot = A * C + B * D;
        var lenSq = C * C + D * D;
        var param = -1;
        
        if ( lenSq !== 0 ) {
            param = dot / lenSq;
        }

        var xx, yy;

        if ( param < 0 ) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if ( param > 1 ) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        var dx = point.x - xx;
        var dy = point.y - yy;
        return Math.sqrt( dx * dx + dy * dy );
    };

    CanvasManager.prototype.handleKeyUp = function ( e ) {
        // Handle space key release for pan mode
        if ( e.code === 'Space' ) {
            e.preventDefault();
            this.canvas.style.cursor = this.getToolCursor( this.currentTool );
        }
    };

    CanvasManager.prototype.toggleGrid = function () {
        this.showGrid = !this.showGrid;
        this.redraw();
        this.renderLayers( this.editor.layers );
    };

    CanvasManager.prototype.snapToGridPoint = function ( point ) {
        if ( !this.snapToGrid ) return point;
        
        return {
            x: Math.round( point.x / this.gridSize ) * this.gridSize,
            y: Math.round( point.y / this.gridSize ) * this.gridSize
        };
    };

    CanvasManager.prototype.drawGrid = function () {
        if ( !this.showGrid ) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;
        
        var gridSize = this.gridSize;
        var width = this.canvas.width;
        var height = this.canvas.height;
        
        // Draw vertical lines
        for ( var x = 0; x <= width; x += gridSize ) {
            this.ctx.beginPath();
            this.ctx.moveTo( x, 0 );
            this.ctx.lineTo( x, height );
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for ( var y = 0; y <= height; y += gridSize ) {
            this.ctx.beginPath();
            this.ctx.moveTo( 0, y );
            this.ctx.lineTo( width, y );
            this.ctx.stroke();
        }
        
        this.ctx.restore();
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
        
        // Get mouse position relative to canvas
        var clientX = e.clientX - rect.left;
        var clientY = e.clientY - rect.top;
        
        // Convert from display coordinates to canvas coordinates
        // Account for CSS transforms (zoom and pan)
        var canvasX = clientX / this.zoom;
        var canvasY = clientY / this.zoom;
        
        // Snap to grid if enabled
        if ( this.snapToGrid ) {
            canvasX = Math.round( canvasX / this.gridSize ) * this.gridSize;
            canvasY = Math.round( canvasY / this.gridSize ) * this.gridSize;
        }
        
        return {
            x: canvasX,
            y: canvasY
        };
    };

    CanvasManager.prototype.startDrawing = function ( point ) {
        // Use current style options if available
        var style = this.currentStyle || {};
        
        // Reset any previous temp layer
        this.tempLayer = null;
        
        // Prepare for drawing based on current tool
        switch ( this.currentTool ) {
            case 'text':
                this.startTextTool( point, style );
                break;
            case 'pen':
                this.startPenTool( point, style );
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
            default:
                console.warn( 'Unknown tool:', this.currentTool );
        }
    };

    CanvasManager.prototype.continueDrawing = function ( point ) {
        // Continue drawing based on current tool
        if ( this.tempLayer ) {
            this.redraw();
            this.renderLayers( this.editor.layers );
            this.drawPreview( point );
        }
    };

    CanvasManager.prototype.finishDrawing = function ( point ) {
        // Finish drawing and create layer
        var layerData = this.createLayerFromDrawing( point );
        if ( layerData ) {
            this.editor.addLayer( layerData );
        }
        
        // Clean up
        this.tempLayer = null;
        this.redraw();
        this.renderLayers( this.editor.layers );
    };

    CanvasManager.prototype.startTextTool = function ( point, style ) {
        // Create a more sophisticated text input dialog
        var self = this;
        
        // Create modal for text input
        var modal = this.createTextInputModal( point, style );
        document.body.appendChild( modal );
        
        // Focus on text input
        var textInput = modal.querySelector( '.text-input' );
        textInput.focus();
        
        this.isDrawing = false;
    };

    CanvasManager.prototype.startPenTool = function ( point, style ) {
        // Create a path for free-hand drawing
        this.tempLayer = {
            type: 'path',
            points: [ point ],
            stroke: style.color || '#000000',
            strokeWidth: style.strokeWidth || 2,
            fill: 'none'
        };
    };

    CanvasManager.prototype.createTextInputModal = function ( point, style ) {
        var self = this;
        
        // Create modal overlay
        var overlay = document.createElement( 'div' );
        overlay.className = 'text-input-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Create modal content
        var modal = document.createElement( 'div' );
        modal.className = 'text-input-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            min-width: 300px;
        `;
        
        modal.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">Add Text</h3>
            <textarea class="text-input" placeholder="Enter your text..." style="
                width: 100%; 
                height: 80px; 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                padding: 8px;
                font-family: inherit;
                resize: vertical;
            "></textarea>
            <div style="margin: 15px 0;">
                <label style="display: block; margin-bottom: 5px;">Font Size:</label>
                <input type="number" class="font-size-input" value="${style.fontSize || 16}" min="8" max="72" style="
                    width: 80px;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                ">
                <label style="display: inline-block; margin-left: 15px; margin-right: 5px;">Color:</label>
                <input type="color" class="color-input" value="${style.color || '#000000'}" style="
                    width: 40px;
                    height: 30px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                ">
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button class="cancel-btn" style="
                    background: #f8f9fa;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 8px 16px;
                    margin-right: 10px;
                    cursor: pointer;
                ">Cancel</button>
                <button class="add-btn" style="
                    background: #007bff;
                    color: white;
                    border: 1px solid #007bff;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                ">Add Text</button>
            </div>
        `;
        
        overlay.appendChild( modal );
        
        // Event handlers
        var textInput = modal.querySelector( '.text-input' );
        var fontSizeInput = modal.querySelector( '.font-size-input' );
        var colorInput = modal.querySelector( '.color-input' );
        var addBtn = modal.querySelector( '.add-btn' );
        var cancelBtn = modal.querySelector( '.cancel-btn' );
        
        function addText() {
            var text = textInput.value.trim();
            if ( text ) {
                var layerData = {
                    type: 'text',
                    text: text,
                    x: point.x,
                    y: point.y,
                    fontSize: parseInt( fontSizeInput.value ) || 16,
                    fontFamily: 'Arial',
                    fill: colorInput.value
                };
                self.editor.addLayer( layerData );
            }
            document.body.removeChild( overlay );
        }
        
        function cancel() {
            document.body.removeChild( overlay );
        }
        
        addBtn.addEventListener( 'click', addText );
        cancelBtn.addEventListener( 'click', cancel );
        
        // Allow Enter to add text (but not Shift+Enter for new lines)
        textInput.addEventListener( 'keydown', function ( e ) {
            if ( e.key === 'Enter' && !e.shiftKey ) {
                e.preventDefault();
                addText();
            } else if ( e.key === 'Escape' ) {
                cancel();
            }
        } );
        
        // Click outside to cancel
        overlay.addEventListener( 'click', function ( e ) {
            if ( e.target === overlay ) {
                cancel();
            }
        } );
        
        return overlay;
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
            case 'path':
                // Add point to path for pen tool
                this.tempLayer.points.push( point );
                this.drawPath( this.tempLayer );
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
            case 'path':
                // Path is already complete
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
        if ( layer.type === 'path' && layer.points.length < 2 ) {
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
            case 'pen': return 'crosshair';
            case 'rectangle':
            case 'circle': return 'crosshair';
            default: return 'default';
        }
    };

    CanvasManager.prototype.renderLayers = function ( layers ) {
        // Redraw background
        this.redraw();
        
        // Render each layer in order
        if ( layers && layers.length > 0 ) {
            layers.forEach( function ( layer ) {
                this.drawLayer( layer );
            }.bind( this ) );
        }
        
        // Draw selection indicators if any layer is selected
        if ( this.selectedLayerId ) {
            this.drawSelectionIndicators( this.selectedLayerId );
        }
    };

    CanvasManager.prototype.redraw = function () {
        // Clear canvas
        this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
        
        // Draw background image
        if ( this.backgroundImage ) {
            this.ctx.drawImage( this.backgroundImage, 0, 0 );
        }
        
        // Draw grid if enabled
        this.drawGrid();
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
            case 'path':
                this.drawPath( layer );
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

    CanvasManager.prototype.drawPath = function ( layer ) {
        if ( !layer.points || layer.points.length < 2 ) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = layer.stroke || '#000000';
        this.ctx.lineWidth = layer.strokeWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo( layer.points[0].x, layer.points[0].y );
        
        for ( var i = 1; i < layer.points.length; i++ ) {
            this.ctx.lineTo( layer.points[i].x, layer.points[i].y );
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    };

    CanvasManager.prototype.handleResize = function () {
        // Recalculate fit to window if canvas is at fit zoom level
        if ( this.backgroundImage ) {
            var container = this.canvas.parentElement;
            var containerWidth = container.clientWidth - 40;
            var containerHeight = container.clientHeight - 40;
            
            var scaleX = containerWidth / this.backgroundImage.width;
            var scaleY = containerHeight / this.backgroundImage.height;
            var fitScale = Math.min( scaleX, scaleY );
            
            // If we're close to fit zoom, re-fit to window
            if ( Math.abs( this.zoom - fitScale ) < 0.1 ) {
                this.fitToWindow();
            }
        }
    };

    // Export CanvasManager to global scope
    window.CanvasManager = CanvasManager;

}() );
