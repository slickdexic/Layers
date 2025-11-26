# Canvas Module Architecture

This directory will contain refactored modules extracted from `CanvasManager.js` as part of the improvement plan documented in `improvement_plan.md`.

## Planned Modules

### Phase 1: Core Controllers (High Priority)

1. **ZoomPanController.js** - Zoom and pan functionality
   - Properties to extract: zoom, minZoom, maxZoom, panX, panY, isPanning, lastPanPoint
   - Smooth zoom animation logic
   - Fit-to-window and reset-zoom operations
   - Coordinate conversion for pan/zoom transforms

2. **GridRulersController.js** - Grid and rulers rendering/logic
   - Properties: showGrid, gridSize, snapToGrid, showRulers, rulerSize
   - Guide management: horizontalGuides, verticalGuides
   - Smart guides and snap-to-guides logic
   - Grid and ruler rendering methods

3. **TransformController.js** - Layer transformation operations
   - Resize logic (all 8 handles)
   - Rotation logic
   - Multi-layer transform operations
   - Transform bounds validation

### Phase 2: Interaction Handlers

4. **DrawingController.js** - Shape/tool creation logic
   - startDrawing, continueDrawing, finishDrawing
   - Tool-specific drawing methods (rectangle, circle, line, etc.)
   - Temporary layer management during drawing

5. **ClipboardController.js** - Copy/paste operations
   - Clipboard array management
   - Copy, cut, paste, duplicate operations
   - Multi-layer clipboard support

### Phase 3: Utility Modules

6. **CanvasPool.js** - Canvas pooling for performance
   - getPooledCanvas, releasePooledCanvas
   - Pool size management

7. **ViewportManager.js** - Viewport/culling management
   - Viewport bounds calculation
   - Layer culling for rendering optimization
   - Dirty region tracking

## Integration Pattern

Each module should:

1. Export a class/constructor that accepts a `canvasManager` reference
2. Expose methods that can be called from CanvasManager
3. Use events for loose coupling where possible
4. Be registered with ModuleRegistry for dependency injection

Example:
```javascript
function ZoomPanController(canvasManager) {
    this.manager = canvasManager;
    this.zoom = 1.0;
    // ... initialization
}

ZoomPanController.prototype.zoomIn = function() {
    // Implementation
};

// Export for use
window.ZoomPanController = ZoomPanController;
```

## Status

- [x] Directory structure created
- [x] ZoomPanController.js extracted
- [x] GridRulersController.js extracted
- [x] TransformController.js extracted (resize, rotation, drag)
- [ ] DrawingController.js extracted
- [ ] ClipboardController.js extracted
- [ ] CanvasPool.js extracted
- [ ] ViewportManager.js extracted

## Migration Strategy

1. Extract one module at a time
2. Keep CanvasManager delegating to new modules
3. Run full test suite after each extraction
4. Update imports/exports in extension.json as needed
5. Update any files that reference extracted methods
