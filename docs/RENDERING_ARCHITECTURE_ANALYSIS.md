# Layers Extension Rendering Architecture Analysis

**Date**: December 24, 2025  
**Purpose**: Identify rendering differences between editor, viewer, and modal contexts

## Executive Summary

The Layers extension has **three rendering paths** that share a common `LayerRenderer` class but apply effects at different levels, causing visual inconsistencies. The root cause is that:

1. **The Editor** (`CanvasRenderer.js`) applies opacity, blend modes, and shadows **at the canvas context level before calling LayerRenderer**
2. **The Viewer** (`LayersViewer.js`) applies opacity, blend modes, and shadows **at the canvas context level before calling LayerRenderer**
3. **The Modal** (`LayersEditorModal.js`) **loads the full editor in an iframe** - so it uses the same rendering as the Editor

The good news: the Editor and Viewer **both delegate shape drawing to the shared `LayerRenderer`**. The inconsistencies come from **how they set up the canvas context before delegation**.

---

## 1. Rendering Path Comparison

### 1.1 Editor Rendering Path

**Entry Point**: `CanvasRenderer.js` → `redraw(layers)` → `renderLayers(layers)` → `drawLayerWithEffects(layer)` → `drawLayer(layer)`

```
CanvasRenderer.redraw(layers)
    ↓
CanvasRenderer.renderLayers(layers)  // loops layers bottom-to-top
    ↓
For each layer:
    if (layer.type === 'blur')
        → CanvasRenderer.drawBlurEffect(layer)  [EDITOR-SPECIFIC]
    else
        → CanvasRenderer.drawLayerWithEffects(layer)
              ↓
              1. Check for blur blend mode → drawLayerWithBlurBlend() [EDITOR-SPECIFIC]
              2. ctx.save()
              3. Apply layer.opacity → ctx.globalAlpha
              4. Apply layer.blend → ctx.globalCompositeOperation
              5. Apply shadow → ctx.shadowColor/Blur/Offset
              6. drawLayer(layer) → delegates to LayerRenderer.drawLayer()
              7. Draw glow if enabled
              8. ctx.restore()
```

**Key Observations**:
- Effects (opacity, blend, shadow) applied **before** calling LayerRenderer
- Has **blur blend mode** implementation in `drawLayerWithBlurBlend()`
- Has **blur layer type** implementation in `drawBlurEffect()`
- Uses `this.zoom` and `this.panX/Y` for transformations
- Shadow is applied **at context level**, not inside shape renderers

### 1.2 Viewer Rendering Path

**Entry Point**: `LayersViewer.js` → `renderLayers()` → `renderLayer(layer)`

```
LayersViewer.renderLayers()
    ↓
For each layer (bottom-to-top):
    if (layer.type === 'blur')
        → LayersViewer.renderBlurLayer(layer)  [VIEWER-SPECIFIC]
    else
        → LayersViewer.renderLayer(layer)
              ↓
              1. Check visibility
              2. Compute scale factors (sx, sy, scaleAvg)
              3. Scale layer coordinates → scaleLayerCoordinates()
              4. ctx.save()
              5. Check for blur blend mode → handled by LayerRenderer
              6. Apply layer.opacity → ctx.globalAlpha (if not blur blend)
              7. Apply layer.blend → ctx.globalCompositeOperation (if not blur blend)
              8. Apply shadow at CONTEXT level → ctx.shadowColor/Blur/Offset
              9. renderer.drawLayer(L, {scaled: true, shadowScale: ...})
              10. ctx.restore()
```

**Key Observations**:
- Effects (opacity, blend, shadow) applied **before** calling LayerRenderer (same as Editor)
- Has its own `renderBlurLayer()` for blur layer type (different implementation!)
- Pre-scales coordinates before passing to LayerRenderer (`scaled: true`)
- Passes `shadowScale` option for scaled shadow rendering
- Background is **not drawn on canvas** - it's the underlying `<img>` element

### 1.3 Modal Rendering Path

**Entry Point**: `LayersEditorModal.js`

**Key Finding**: The modal **does NOT have its own rendering**. It loads the full editor in an iframe:

```javascript
// Build editor URL if not provided
if ( !editorUrl ) {
    const params = new URLSearchParams( {
        action: 'editlayers',
        setname: setname || '',
        modal: '1'
    } );
    editorUrl = mw.util.getUrl( 'File:' + filename ) + '?' + params.toString();
}

// Create iframe
this.iframe = document.createElement( 'iframe' );
this.iframe.src = editorUrl;
```

**Conclusion**: Modal uses Editor rendering - no differences expected.

---

## 2. Shared LayerRenderer Architecture

`LayerRenderer` (`ext.layers.shared/LayerRenderer.js`) is the **shared rendering engine** used by both Editor and Viewer.

### 2.1 LayerRenderer Composition

```
LayerRenderer
    ├── ShadowRenderer       → Shadow operations (spread, offscreen technique)
    ├── ArrowRenderer        → Arrow polygon rendering
    ├── TextRenderer         → Text rendering
    ├── TextBoxRenderer      → Text box (rect + multi-line text)
    ├── ShapeRenderer        → Rectangle, Circle, Ellipse
    │   └── PolygonStarRenderer → Polygon, Star
    └── EffectsRenderer      → Blur layer and blur blend mode
```

### 2.2 LayerRenderer Entry Points

```javascript
drawLayer(layer, options)
    ↓
    if (hasBlurBlendMode(layer))
        → drawLayerWithBlurBlend(layer, options)
    else
        → _drawLayerByType(layer, options)
              ↓
              switch(layer.type):
                  'text' → textRenderer.draw()
                  'textbox' → textBoxRenderer.draw()
                  'rectangle' → shapeRenderer.drawRectangle()
                  'circle' → shapeRenderer.drawCircle()
                  'arrow' → arrowRenderer.draw()
                  'blur' → effectsRenderer.drawBlur()
                  'image' → drawImage() [internal]
                  etc.
```

---

## 3. Key Differences & Inconsistencies

### 3.1 Blur Layer Implementation (MAJOR DIFFERENCE)

#### Editor (`CanvasRenderer.drawBlurEffect`):
```javascript
drawBlurEffect(layer) {
    // Captures current canvas state (includes background + lower layers)
    tempCtx.drawImage(
        this.canvas,
        x * this.zoom + this.panX,  // Uses zoom/pan transforms
        y * this.zoom + this.panY,
        w * this.zoom,
        h * this.zoom,
        ...
    );
    // Applies blur filter
    this.ctx.filter = 'blur(' + radius + 'px)';
    this.ctx.drawImage(tempCanvas, x, y, w, h);
}
```

#### Viewer (`LayersViewer.renderBlurLayer`):
```javascript
renderBlurLayer(layer) {
    // First draws background image region
    tempCtx.drawImage(
        this.imageElement,
        x * imgScaleX, y * imgScaleY, w * imgScaleX, h * imgScaleY,
        0, 0, ...
    );
    // Then overlays what's on canvas (layers below)
    tempCtx.drawImage(
        this.canvas,
        x, y, w, h,
        0, 0, ...
    );
    // Applies blur filter
    this.ctx.filter = 'blur(' + radius + 'px)';
    this.ctx.drawImage(tempCanvas, x, y, w, h);
}
```

**Difference**: The viewer **explicitly composites background + canvas layers**, while the editor relies on the background already being drawn on the same canvas. This can cause subtle differences in blur appearance.

#### Shared (`EffectsRenderer.drawBlur`):
```javascript
drawBlur(layer, options) {
    // Has BOTH approaches depending on what's available
    if (imgSource && imgSource.complete) {
        // Uses image source directly (like viewer)
    } else if (this.backgroundImage) {
        // Uses clip + filter (different approach)
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        this.ctx.clip();
        this.ctx.filter = 'blur(' + radius + 'px)';
        this.ctx.drawImage(this.backgroundImage, 0, 0);
    }
}
```

**Issue**: Three different blur implementations exist!

### 3.2 Blur Blend Mode (MAJOR DIFFERENCE)

The "blur" blend mode (where a shape uses blur as its fill effect) has separate implementations:

1. **Editor**: `CanvasRenderer.drawLayerWithBlurBlend()` - full implementation
2. **LayerRenderer**: `drawLayerWithBlurBlend()` - delegates to `EffectsRenderer.drawBlurWithShape()`
3. **EffectsRenderer**: `drawBlurWithShape()` - actual implementation

**Potential Issue**: The Editor's implementation may not be identical to EffectsRenderer's implementation.

### 3.3 Shadow Application Level

#### Editor (`CanvasRenderer.drawLayerWithEffects`):
```javascript
// Shadow applied at CONTEXT level before shape drawing
if (layer.shadow) {
    this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
    this.ctx.shadowBlur = Math.round(layer.shadowBlur || 8);
    this.ctx.shadowOffsetX = Math.round(layer.shadowOffsetX || 2);
    this.ctx.shadowOffsetY = Math.round(layer.shadowOffsetY || 2);
}
// Then calls drawLayer() which delegates to LayerRenderer
this.drawLayer(layer);
```

#### Viewer (`LayersViewer.renderLayer`):
```javascript
// Shadow applied at CONTEXT level via renderer's hasShadowEnabled check
const shadowScale = {sx, sy, avg: scaleAvg};
if (this.renderer && this.renderer.hasShadowEnabled(layer)) {
    this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
    this.ctx.shadowBlur = Math.round((layer.shadowBlur || 8) * scaleAvg);
    this.ctx.shadowOffsetX = Math.round((layer.shadowOffsetX || 2) * sx);
    this.ctx.shadowOffsetY = Math.round((layer.shadowOffsetY || 2) * sy);
}
// Then calls renderer.drawLayer()
this.renderer.drawLayer(L, {scaled: true, imageElement: this.imageElement, shadowScale});
```

**Difference**: 
- Editor uses raw shadow values
- Viewer scales shadow values by `sx/sy/scaleAvg`

This is CORRECT behavior since viewer displays at different sizes than the saved coordinates.

### 3.4 Coordinate Scaling

| Aspect | Editor | Viewer |
|--------|--------|--------|
| Scaling method | Canvas transform (`ctx.scale(zoom, zoom)`) | Pre-scale coordinates before rendering |
| Pan/offset | Canvas transform (`ctx.translate(panX, panY)`) | No pan (viewer is static) |
| Shadow scaling | Raw values (zoom applied via transform) | Explicitly scaled by sx/sy |
| Stroke width | Scaled by zoom internally | Pre-scaled in `scaleLayerCoordinates()` |

### 3.5 Opacity Handling

Both apply opacity the same way:
```javascript
// Both editor and viewer do:
this.ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
```

✅ **No difference** - consistent.

### 3.6 Blend Mode Handling

Both apply blend mode the same way (except for 'blur'):
```javascript
// Both do:
if (layer.blend) {
    this.ctx.globalCompositeOperation = String(layer.blend);
}
```

For 'blur' blend mode:
- Editor: Handles in `drawLayerWithBlurBlend()` before delegating
- Viewer: Delegates to `LayerRenderer.drawLayerWithBlurBlend()` via normal path

**Potential Issue**: Editor may skip `LayerRenderer.hasBlurBlendMode()` check if it intercepts first.

---

## 4. Code Duplication Analysis

### 4.1 Blur Rendering (HIGH PRIORITY)

| Location | Implementation |
|----------|----------------|
| `CanvasRenderer.drawBlurEffect()` | Editor-specific blur layer |
| `CanvasRenderer.drawLayerWithBlurBlend()` | Editor-specific blur blend |
| `CanvasRenderer._drawTextBlurBlend()` | Editor-specific text blur blend |
| `LayersViewer.renderBlurLayer()` | Viewer-specific blur layer |
| `EffectsRenderer.drawBlur()` | Shared blur layer |
| `EffectsRenderer.drawBlurWithShape()` | Shared blur blend |
| `LayerRenderer.drawLayerWithBlurBlend()` | Shared blur blend dispatcher |
| `LayerRenderer._drawTextBlurBlend()` | Shared text blur blend |

**Result**: 8 blur-related implementations when there should be 2-3.

### 4.2 Arrow Clip Path (MEDIUM PRIORITY)

| Location | Implementation |
|----------|----------------|
| `CanvasRenderer._buildArrowClipVertices()` | ~60 lines |
| `ArrowRenderer.buildArrowVertices()` | ~200 lines |
| `LayerRenderer._drawArrowPath()` | ~50 lines |

The editor has its own simplified arrow vertex builder for blur blend clipping. This could diverge from `ArrowRenderer`.

### 4.3 Shape Path Drawing for Blur Blend (MEDIUM PRIORITY)

The Editor has `_drawBlurClipPath()` which duplicates shape path logic:
```javascript
_drawBlurClipPath(layer) {
    switch (layer.type) {
        case 'rectangle': ctx.rect(...);
        case 'circle': ctx.arc(...);
        case 'ellipse': ctx.ellipse(...);
        case 'polygon': // duplicates PolygonGeometry logic
        case 'star': // duplicates star logic
        case 'arrow': // duplicates arrow logic
    }
}
```

This is separate from `LayerRenderer._drawShapePath()` which does the same thing!

---

## 5. Specific Inconsistency Scenarios

### Scenario 1: Blur Layer Looks Different

**Cause**: Editor captures background via canvas (includes transforms), Viewer composites background image separately.

**Symptoms**: 
- Different blur intensity at same `blurRadius`
- Different color tone in blurred region

### Scenario 2: Blur Blend Mode Shape Different

**Cause**: Editor uses `_drawBlurClipPath()`, LayerRenderer uses `_drawShapePath()`. Different vertex calculations.

**Symptoms**:
- Arrow blur blend has different shape
- Polygon corners render differently

### Scenario 3: Shadow Looks Different at Small Sizes

**Cause**: Editor applies raw shadow values, Viewer scales by display size.

**Symptoms**:
- Shadow appears larger/smaller relative to shape in viewer
- Actually CORRECT behavior - not a bug

### Scenario 4: Glow Effect Missing in Viewer

**Looking at code**:
- Editor: `if (layer.glow && this.supportsGlow(layer.type)) { this.drawGlow(layer); }`
- Viewer: No glow handling found

**Issue**: Viewer does NOT render glow effects!

---

## 6. Recommendations

### 6.1 Unify Blur Rendering (HIGH PRIORITY)

1. Remove `CanvasRenderer.drawBlurEffect()` - delegate to `EffectsRenderer.drawBlur()`
2. Remove `CanvasRenderer.drawLayerWithBlurBlend()` - delegate to `LayerRenderer.drawLayerWithBlurBlend()`
3. Remove `LayersViewer.renderBlurLayer()` - delegate to `LayerRenderer.drawLayer()` for blur type
4. Ensure `EffectsRenderer` handles both background-on-canvas (editor) and background-as-image (viewer) modes

### 6.2 Unify Shape Path Drawing (MEDIUM PRIORITY)

1. Remove `CanvasRenderer._drawBlurClipPath()` 
2. Add a `LayerRenderer.drawShapePath(layer, ctx)` public method
3. Use this method for blur blend clipping in both Editor and Viewer

### 6.3 Add Glow to Viewer (LOW PRIORITY)

1. Add glow rendering to `LayerRenderer.drawLayer()` after shape drawing
2. Or move glow to individual shape renderers

### 6.4 Centralize Effect Application

Consider moving opacity/blend/shadow application INTO `LayerRenderer.drawLayer()`:

```javascript
// Proposed unified approach
drawLayer(layer, options) {
    this.ctx.save();
    
    // Apply common effects
    this.applyOpacity(layer);
    this.applyBlendMode(layer);
    this.applyShadow(layer, options.shadowScale);
    
    // Dispatch to shape renderer
    this._drawLayerByType(layer, options);
    
    // Apply post-effects
    this.applyGlow(layer);
    
    this.ctx.restore();
}
```

This would ensure Editor and Viewer have identical effect application.

---

## 7. Testing Strategy

To verify rendering consistency:

1. **Visual diff testing**: Render same layers in Editor and Viewer, compare screenshots
2. **Effect-specific tests**:
   - Blur layer with various radii
   - Blur blend mode on each shape type
   - Shadow spread on rotated shapes
   - Glow on supported shapes
3. **Scale testing**: Verify shadow/stroke scaling at different viewer sizes

---

## Appendix: File Reference

| File | Lines | Role |
|------|-------|------|
| `ext.layers.editor/CanvasRenderer.js` | ~834 | Editor rendering coordinator |
| `ext.layers/LayersViewer.js` | ~380 | Viewer rendering |
| `ext.layers.shared/LayerRenderer.js` | ~600 | Shared layer dispatcher |
| `ext.layers.shared/EffectsRenderer.js` | ~245 | Blur effects |
| `ext.layers.shared/ShadowRenderer.js` | ~521 | Shadow rendering |
| `ext.layers.shared/ShapeRenderer.js` | ~1049 | Basic shapes |
| `ext.layers.shared/ArrowRenderer.js` | ~702 | Arrow polygons |
| `ext.layers.shared/TextRenderer.js` | ~343 | Text rendering |
| `ext.layers.modal/LayersEditorModal.js` | ~200 | Modal wrapper (iframe) |
