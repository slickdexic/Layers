# Canvas Module Architecture

This directory contains refactored modules extracted from `CanvasManager.js` as part of the improvement plan documented in `improvement_plan.md`.

## Extracted Modules

### Phase 1: Core Controllers (Complete)

1. **ZoomPanController.js** ✅ - Zoom and pan functionality (343 lines)
   - Properties: zoom, minZoom, maxZoom, panX, panY, isPanning, lastPanPoint
   - Smooth zoom animation logic
   - Fit-to-window and reset-zoom operations
   - Coordinate conversion for pan/zoom transforms

2. **GridRulersController.js** ✅ - Grid and rulers rendering/logic (385 lines)
   - Properties: showGrid, gridSize, snapToGrid, showRulers, rulerSize
   - Guide management: horizontalGuides, verticalGuides
   - Smart guides and snap-to-guides logic
   - Grid and ruler rendering methods

3. **TransformController.js** ✅ - Layer transformation operations (965 lines)
   - Resize logic (all 8 handles)
   - Rotation logic
   - Multi-layer transform operations
   - Transform bounds validation

4. **HitTestController.js** ✅ - Hit testing for selection (382 lines)
   - Selection handle hit testing
   - Layer hit testing (getLayerAtPoint)
   - Point-in-shape calculations for all layer types
   - Geometry utilities (isPointInPolygon, pointToSegmentDistance, etc.)

### Phase 2: Interaction Handlers (Complete)

5. **DrawingController.js** ✅ - Shape/tool creation logic (622 lines)
   - startDrawing, continueDrawing, finishDrawing
   - Tool-specific drawing methods (rectangle, circle, line, arrow, etc.)
   - Drawing preview and validation
   - Tool cursor management

6. **ClipboardController.js** ✅ - Copy/paste operations (212 lines)
   - Clipboard array management
   - Copy, cut, paste operations
   - Paste offset handling
   - Multi-layer clipboard support

### Phase 3: Utility Modules (In Progress)

7. **ImageLoader.js** ✅ - Background image loading (280 lines) - NEW
   - Located in `ext.layers.editor/ImageLoader.js` (not in this directory)
   - URL detection from MediaWiki config and DOM
   - Fallback URL chains for robustness
   - SVG test image generation for offline/test environments
   - Comprehensive test suite (30+ tests)

### Phase 4: Future Enhancements

8. **CanvasPool.js** - Canvas pooling for performance
   - getPooledCanvas, releasePooledCanvas
   - Pool size management
   - Currently ~40 lines in CanvasManager (too small for separate file)

9. **ViewportManager.js** - Viewport/culling management
   - Viewport bounds calculation
   - Layer culling for rendering optimization
   - Dirty region tracking

10. **TextInputModal.js** - Text input UI (planned)
    - Currently ~220 lines in CanvasManager.createTextInputModal
    - Should be moved to ui/ directory
    - Pure DOM manipulation, no canvas logic

## Integration Pattern

Each module follows this pattern:

1. Accepts a `canvasManager` reference in constructor
2. Exposes methods that can be called from CanvasManager
3. Uses delegation pattern for backward compatibility
4. Exports for both browser (window) and Node.js (module.exports) environments

Example:
```javascript
function ZoomPanController(canvasManager) {
    this.canvasManager = canvasManager;
    this.zoom = 1.0;
    // ... initialization
}

ZoomPanController.prototype.zoomIn = function() {
    // Implementation
};

// Browser export
window.ZoomPanController = ZoomPanController;

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomPanController;
}
```

## Known Issues

### Fallback Code Duplication
CanvasManager still contains ~500 lines of fallback implementations that duplicate controller logic. These fallbacks were intended for environments where controllers don't load, but since extension.json guarantees loading order, they're likely unnecessary.

**Recommended action:** Remove fallback implementations once controller loading is verified stable across all MediaWiki environments.

## Status

- [x] Directory structure created
- [x] ZoomPanController.js extracted (343 lines)
- [x] GridRulersController.js extracted (385 lines)
- [x] TransformController.js extracted (1,157 lines)
- [x] HitTestController.js extracted (376 lines)
- [x] DrawingController.js extracted (614 lines)
- [x] ClipboardController.js extracted (220 lines)
- [x] RenderCoordinator.js extracted (387 lines)
- [x] InteractionController.js extracted (487 lines)
- [x] ImageLoader.js extracted (280 lines) - in parent directory
- [x] TextInputController.js extracted (187 lines) - modal text input handling
- [ ] Remove fallback code from CanvasManager (~80 lines) - low priority, has test coverage
- [ ] MarqueeSelectionController (~80 lines) - optional, already delegates to SelectionManager
- [ ] CanvasPool.js - future enhancement (~50 lines, too small)
- [ ] ViewportManager.js - future enhancement

**Total extracted:** ~4,436 lines into focused, maintainable modules
**CanvasManager.js current size:** 2,025 lines (down from 5,462 lines)
**Target:** <800 lines (significant refactoring needed)

**Analysis (2025-01-15):** Many CanvasManager methods are now thin delegation calls (3-5 lines each).
The remaining bulk comes from:
- Constructor state initialization (~90 lines)
- JSDoc comments (~200 lines)
- Fallback code for tests (~100 lines)
- Coordinate transform methods (~50 lines)
- Layer bounds calculations (~70 lines)

Further reduction requires either:
1. Moving more state to controllers (breaking change)
2. Consolidating delegation calls into a single passthrough mechanism
3. Accepting current size as acceptable for a facade class

## Benefits Achieved

1. **Separation of Concerns**: Each controller handles one responsibility
2. **Testability**: Controllers can be unit tested independently (97-100% coverage)
3. **Maintainability**: Smaller files are easier to understand and modify
4. **Code Reuse**: Controllers can be used by other parts of the application
5. **Backward Compatibility**: CanvasManager delegates to controllers but maintains same API

## Migration Strategy

1. Extract one module at a time
2. Keep CanvasManager delegating to new modules
3. Run full test suite after each extraction
4. Update imports/exports in extension.json as needed
5. Update any files that reference extracted methods
