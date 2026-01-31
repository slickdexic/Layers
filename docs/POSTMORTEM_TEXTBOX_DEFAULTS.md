# Postmortem: Textbox Default Stroke and Related Issues

**Date:** January 29, 2026  
**Version:** 1.5.39  
**Severity:** Medium (UX bug affecting new textbox creation)

## Summary

Multiple related issues were discovered and fixed regarding textbox layer creation, text editing, and drawing preview feedback:

1. **Textbox default stroke appearing as 2px black** instead of transparent
2. **Text disappearing on deselect** after inline editing
3. **Slides in tables showing "Empty Slide" then becoming blank**
4. **No visual feedback when dragging to create a textbox**

## Issue 1: Textbox Default Stroke

### Symptoms
When creating a new textbox, it would render with a 2px black stroke border even though the UI showed no stroke settings applied.

### Root Cause
Multiple code paths existed for creating textbox layers:

1. **ShapeFactory.js** - Correctly set `stroke: 'transparent'`, `strokeWidth: 0`
2. **DrawingController.js** - Used `stroke: style.color || '#000000'`, `strokeWidth: style.strokeWidth || 1`
3. **ToolManager.js** - Had similar fallback defaults

The DrawingController was the actual code path used during mouse drag operations, and it was inheriting color/strokeWidth from the generic style object instead of using textbox-specific defaults.

### Solution
Updated `startTextBoxTool()` and `startCalloutTool()` in DrawingController.js to explicitly set:
```javascript
stroke: 'transparent',
strokeWidth: 0
```

### Files Modified
- `resources/ext.layers.editor/canvas/DrawingController.js`

---

## Issue 2: Text Disappearing on Deselect

### Symptoms
After editing text in an inline editor and deselecting the textbox by clicking elsewhere, the text would disappear entirely.

### Root Cause
The InlineTextEditor's `_isMultilineType()` check was looking for `editorElement.contentEditable === 'true'`, but the contentEditable attribute had been moved from the outer editor element to an inner wrapper div during previous refactoring.

The check was returning `false` for textbox/callout layers, causing the commit logic to skip saving the text content.

### Solution
Changed the condition to check the layer type directly:
```javascript
// Before (broken)
if (editorElement.contentEditable === 'true') { ... }

// After (fixed)
if (this._isMultilineType(this.editingLayer)) { ... }
```

### Files Modified
- `resources/ext.layers.editor/canvas/InlineTextEditor.js`

---

## Issue 3: TextBoxRenderer strokeWidth: 0 Handling

### Symptoms
Even after setting `strokeWidth: 0`, a faint 1px stroke would still appear.

### Root Cause
The TextBoxRenderer used `strokeWidth || 1` which treats `0` as falsy and defaults to `1`:
```javascript
const strokeW = layer.strokeWidth || 1;  // 0 becomes 1!
```

### Solution
Use explicit type checking:
```javascript
const strokeW = typeof layer.strokeWidth === 'number' ? layer.strokeWidth : 1;
```

Also added `strokeW > 0` checks before drawing stroke operations.

### Files Modified
- `resources/ext.layers.shared/TextBoxRenderer.js`

---

## Issue 4: Slides in Tables Becoming Blank

### Symptoms
When slides were embedded in wiki tables, they would briefly show "Empty Slide" placeholder, then become completely blank/transparent.

### Root Cause
The `reinitializeSlideViewer()` function in SlideController.js would clear the canvas and render layers, but when layers array was empty, it didn't draw the empty state placeholder. The empty state was only drawn during initial initialization, not during reinitialization.

### Solution
Added empty state drawing to the `renderAllLayers()` helper within `reinitializeSlideViewer()`:
```javascript
if (payload.layers && payload.layers.length > 0) {
    // render layers
} else {
    // No layers - draw empty state placeholder
    self.drawEmptyStateContent(ctx, canvas.width, canvas.height, container);
}
```

### Files Modified
- `resources/ext.layers/viewer/SlideController.js`

---

## Issue 5: No Visual Feedback During Textbox Drag

### Symptoms
When dragging to create a textbox, no visual indication appeared showing the size/position of the box being created.

### Root Cause
With the textbox now having transparent stroke, the `drawPreview()` function would render an invisible rectangle during the drag operation.

### Solution
Added a dashed blue bounding box specifically for textbox/callout layers with transparent stroke during the drawing preview:

```javascript
drawPreview() {
    // ... existing code ...
    
    // For textbox/callout with transparent stroke, draw a visible bounding box
    if ((this.tempLayer.type === 'textbox' || this.tempLayer.type === 'callout') &&
        (!this.tempLayer.stroke || this.tempLayer.stroke === 'transparent' ||
        this.tempLayer.strokeWidth === 0)) {
        this._drawPreviewBoundingBox(this.tempLayer);
    }
}

_drawPreviewBoundingBox(layer) {
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
}
```

### Files Modified
- `resources/ext.layers.editor/canvas/DrawingController.js`

---

## Test Updates Required

The following test files needed updates to reflect the new behavior:

1. **DrawingController.test.js** - Updated expectations for textbox/callout to expect `strokeWidth: 0` and `stroke: 'transparent'`
2. **SlideController.test.js** - Added missing canvas context mock methods (`fillText`, `strokeStyle`, `lineWidth`, `font`, `textAlign`, `textBaseline`) for empty state rendering
3. **ViewerManager.test.js** - Same canvas context mock additions

---

## Prevention Strategies

### 1. Centralize Layer Defaults
All layer type defaults should be defined in ONE place (ShapeFactory.js) and all other code paths should delegate to it rather than implementing their own defaults.

### 2. Use Explicit Type Checks for Numeric Defaults
Always use `typeof value === 'number'` instead of `value || default` when 0 is a valid value:
```javascript
// ❌ BAD - treats 0 as falsy
const width = layer.strokeWidth || 1;

// ✅ GOOD - explicit type check
const width = typeof layer.strokeWidth === 'number' ? layer.strokeWidth : 1;
```

### 3. Test Layer Creation Through All Code Paths
When adding new layer types or modifying defaults:
- Test ShapeFactory direct creation
- Test DrawingController drag creation
- Test ToolManager single-click creation
- Test API loading/saving round-trip

### 4. Verify Visual Feedback for All Drawing Tools
Any tool that creates shapes during drag should provide visual feedback. If a shape's stroke is transparent or invisible, an alternative indicator (like a dashed bounding box) must be provided.

---

## Related Documentation

- [POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md](POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md) - Similar issue with boolean/integer handling
- [copilot-instructions.md](../.github/copilot-instructions.md) - Section on Boolean Serialization

---

## Checklist for Future Textbox/Callout Changes

- [ ] Verify stroke defaults in ShapeFactory.js
- [ ] Verify stroke defaults in DrawingController.js
- [ ] Verify TextBoxRenderer handles strokeWidth: 0
- [ ] Verify visual feedback during drag creation
- [ ] Verify text saves on deselect
- [ ] Run DrawingController.test.js
- [ ] Run TextBoxRenderer.test.js
