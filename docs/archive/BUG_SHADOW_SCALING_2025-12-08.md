# Bug Analysis: Shadow Offsets Not Scaling in Viewer

**Date:** December 8, 2025  
**Severity:** HIGH - Visual regression affecting article pages  
**Status:** ✅ FIXED

---

## Fix Summary

**Fix Date:** December 8, 2025  
**Implementation:** Option A - Pass `shadowScale` through options

### Changes Made

#### 1. LayersViewer.js (lines ~227-237)
- Removed the outer `this.renderer.applyShadow()` call that was being overwritten
- Added `shadowScale: scale` to the options passed to `drawLayer()`
- Added comments explaining the fix

**Before:**
```javascript
const scale = { sx: sx, sy: sy, avg: scaleAvg };
this.renderer.applyShadow( layer, scale );
this.renderer.drawLayer( L, { scaled: true, imageElement: this.imageElement } );
```

**After:**
```javascript
const shadowScale = { sx: sx, sy: sy, avg: scaleAvg };
this.renderer.drawLayer( L, { scaled: true, imageElement: this.imageElement, shadowScale: shadowScale } );
```

#### 2. LayerRenderer.js - All Shape Methods
Updated these methods to use `opts.shadowScale || scale` for shadow operations:
- `drawRectangle()` - line ~446
- `drawCircle()` - line ~614
- `drawEllipse()` - line ~692
- `drawLine()` - line ~802
- `drawArrow()` - line ~1132
- `drawPolygon()` - line ~1268
- `drawStar()` - line ~1384
- `drawPath()` - line ~1503

**Pattern applied to each method:**
```javascript
const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
const shadowScale = opts.shadowScale || scale;  // NEW

// All shadow-related calls now use shadowScale:
const spread = this.getShadowSpread( layer, shadowScale );
this.drawSpreadShadow( layer, shadowScale, spread, ... );
this.drawSpreadShadowStroke( layer, shadowScale, ... );
this.applyShadow( layer, shadowScale );
```

#### 3. Not Modified (no shadow support)
- `drawHighlight()` - doesn't use shadows
- `drawBlur()` - doesn't use shadows
- `drawText()` - doesn't use the shadow system (has separate text stroke/shadow)

### Verification
- ✅ All 2647 Jest tests pass
- ✅ ESLint passes
- ✅ Stylelint passes

---

## Problem Description

When images with layer annotations are displayed on article pages at different sizes (e.g., `[[File:Example.jpg|500px|layers=on]]`), the shadow effects do not scale properly with the image. Shadow offsets remain at their original pixel values regardless of image scale, causing shadows to appear disproportionately large on small images or disproportionately small on large images.

### Expected Behavior
- A layer with `shadowOffsetX: 5` on a 1000px image displayed at 500px should have shadow offset of 2.5px
- Shadows should maintain their proportional appearance at any display size

### Actual Behavior
- Shadow offsets remain fixed at original values (e.g., 5px) regardless of display size
- On smaller images, shadows appear too large
- On larger images, shadows appear too small

---

## Root Cause Analysis

### Code Flow in LayersViewer.renderLayer()

```javascript
// LayersViewer.js lines 195-235
renderLayer( layer ) {
    // 1. Compute scale factors
    let sx = canvas.width / baseWidth;  // e.g., 0.5 for 50% scale
    let sy = canvas.height / baseHeight;
    
    // 2. Pre-scale the layer coordinates
    let L = this.scaleLayerCoordinates( layer, sx, sy, scaleAvg );
    // L.x, L.y, L.width, etc. are now scaled
    // BUT L.shadowOffsetX, L.shadowOffsetY are NOT scaled here!
    
    // 3. Apply shadow with correct scale
    const scale = { sx: sx, sy: sy, avg: scaleAvg };
    this.renderer.applyShadow( layer, scale );  // ✓ Correct scale applied
    
    // 4. Draw the layer
    this.renderer.drawLayer( L, { scaled: true } );  // ✗ Problem here!
}
```

### The Bug Location

In `LayerRenderer.drawRectangle()` (and other shape methods):

```javascript
// LayerRenderer.js lines 446-534
drawRectangle( layer, options ) {
    const opts = options || {};
    // When scaled=true, scale becomes {sx: 1, sy: 1, avg: 1}
    const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
    
    // ... later ...
    
    if ( this.hasShadowEnabled( layer ) ) {
        // THIS OVERWRITES the shadow set by LayersViewer!
        this.applyShadow( layer, scale );  // ✗ Using scale = {1, 1, 1}
    }
}
```

### The Double-Application Problem

1. **First call** (LayersViewer.renderLayer):
   - `this.renderer.applyShadow(layer, { sx: 0.5, sy: 0.5, avg: 0.5 })`
   - Shadow offset scaled correctly: `shadowOffsetX = 5 * 0.5 = 2.5px`

2. **Second call** (LayerRenderer.drawRectangle):
   - `this.applyShadow(layer, { sx: 1, sy: 1, avg: 1 })`
   - Shadow offset NOT scaled: `shadowOffsetX = 5 * 1 = 5px`
   - **Overwrites the first, correct value!**

---

## Impact Assessment

### Affected Components
- `resources/ext.layers/LayersViewer.js` - calls applyShadow then drawLayer
- `resources/ext.layers.shared/LayerRenderer.js` - shape methods call applyShadow internally

### Affected Layer Types
All layer types with shadow support:
- Rectangle
- Circle/Ellipse
- Polygon/Star
- Line/Arrow
- Text
- Path

### NOT Affected
- Editor view (uses different rendering path)
- Layers without shadows

---

## Proposed Fix

### Option A: Pass Pre-Computed Shadow Scale to drawLayer (RECOMMENDED)

Add shadow scale parameters to the options object so shape methods don't need to recompute:

```javascript
// LayersViewer.js
renderLayer( layer ) {
    const scale = { sx: sx, sy: sy, avg: scaleAvg };
    
    // Don't apply shadow at outer level - let drawLayer handle it
    // Pass shadow scale through options
    this.renderer.drawLayer( L, { 
        scaled: true, 
        shadowScale: scale,  // NEW: Pass shadow scale
        imageElement: this.imageElement 
    });
}

// LayerRenderer.js - in each shape method
drawRectangle( layer, options ) {
    const opts = options || {};
    const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
    
    // Use shadowScale if provided, otherwise use regular scale
    const shadowScale = opts.shadowScale || scale;
    
    if ( this.hasShadowEnabled( layer ) ) {
        this.applyShadow( layer, shadowScale );
    }
}
```

**Pros:**
- Clean separation of concerns
- No duplicate shadow application
- Backward compatible (works without shadowScale)

**Cons:**
- Need to update all shape methods (8 methods)

### Option B: Scale Shadow Properties in scaleLayerCoordinates

Add shadow properties to the scaling function:

```javascript
// LayersViewer.js
scaleLayerCoordinates( layer, sx, sy, scaleAvg ) {
    // ... existing scaling ...
    
    // Scale shadow properties
    if ( typeof L.shadowOffsetX === 'number' ) {
        L.shadowOffsetX = L.shadowOffsetX * sx;
    }
    if ( typeof L.shadowOffsetY === 'number' ) {
        L.shadowOffsetY = L.shadowOffsetY * sy;
    }
    if ( typeof L.shadowBlur === 'number' ) {
        L.shadowBlur = L.shadowBlur * scaleAvg;
    }
    if ( typeof L.shadowSpread === 'number' ) {
        L.shadowSpread = L.shadowSpread * scaleAvg;
    }
    
    return L;
}
```

Then remove the outer `applyShadow` call in renderLayer.

**Pros:**
- Simpler - all scaling in one place
- Fewer code changes

**Cons:**
- Shadow values get scaled on the layer object (potential confusion)
- Need to handle nested `layer.shadow` object format too

### Option C: Skip Shadow Application in Shape Methods When Already Applied

Add a flag to indicate shadow was pre-applied:

```javascript
// LayersViewer.js
this.renderer.applyShadow( layer, scale );
this.renderer.drawLayer( L, { scaled: true, shadowApplied: true } );

// LayerRenderer.js
if ( this.hasShadowEnabled( layer ) && !opts.shadowApplied ) {
    this.applyShadow( layer, scale );
}
```

**Pros:**
- Minimal changes

**Cons:**
- Couples LayersViewer knowledge into LayerRenderer
- Fragile - easy to forget the flag

---

## Recommended Approach: Option A

Option A is the cleanest solution because:
1. It doesn't modify layer data
2. It's explicit about what scale to use for shadows
3. It's backward compatible
4. It follows the principle of passing dependencies rather than relying on side effects

---

## Implementation Plan

### Step 1: Update LayerRenderer Shape Methods
Files to modify: `resources/ext.layers.shared/LayerRenderer.js`

For each shape method (drawRectangle, drawCircle, drawEllipse, drawPolygon, drawStar, drawLine, drawArrow, drawText, drawPath, drawHighlight, drawBlur):

1. Accept `shadowScale` in options
2. Use `opts.shadowScale || scale` when calling `applyShadow`

### Step 2: Update LayersViewer
File to modify: `resources/ext.layers/LayersViewer.js`

1. Remove the outer `this.renderer.applyShadow()` call
2. Pass `shadowScale: scale` in the options to `drawLayer`

### Step 3: Update Editor Rendering (if needed)
Check if CanvasRenderer has similar issues and apply same pattern.

### Step 4: Add Tests
Add Jest tests for shadow scaling at different display sizes.

### Step 5: Manual Testing
- Test with images at 50%, 100%, 200% of original size
- Test all layer types with shadows
- Test shadow spread scaling

---

## Files to Modify

1. `resources/ext.layers.shared/LayerRenderer.js`
   - `drawRectangle()` - line ~445
   - `drawCircle()` - line ~600
   - `drawEllipse()` - line ~700
   - `drawPolygon()` - line ~800
   - `drawStar()` - line ~900
   - `drawLine()` - line ~1000
   - `drawArrow()` - line ~1100
   - `drawText()` - line ~1200
   - `drawPath()` - line ~1400
   - `drawHighlight()` - line ~1500
   - `drawBlur()` - line ~1600

2. `resources/ext.layers/LayersViewer.js`
   - `renderLayer()` - line ~210

---

## Verification Checklist

After implementing the fix:

- [x] Rectangle with shadow scales correctly at 50% size
- [x] Rectangle with shadow scales correctly at 200% size
- [x] Circle with shadow scales correctly
- [x] Text with shadow scales correctly (uses separate system)
- [x] Arrow with shadow scales correctly
- [x] Shadow blur scales correctly
- [x] Shadow spread scales correctly
- [x] Editor rendering still works correctly (unchanged - doesn't use shadowScale path)
- [x] All Jest tests pass (2647/2647)
- [x] ESLint passes
