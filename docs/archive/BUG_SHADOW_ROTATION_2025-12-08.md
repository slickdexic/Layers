# Bug Analysis: Shadow Offset Not Rotating with Shape (Spread > 0 Only)

**Date:** December 8, 2025  
**Status:** Documented (not yet fixed)  
**Severity:** Medium - Visual bug affecting rotated shapes with shadow spread

---

## Problem Description

When rotating a rectangle (or any shape) that has a shadow with **non-zero spread**, the shadow appears to "leave" the object dramatically, moving vertically up or down depending on the rotation direction.

**IMPORTANT:** This bug **only occurs when shadow spread is non-zero**. When spread = 0, shadows work correctly with rotation.

**Expected Behavior:** Shadow should rotate with the shape, maintaining its relative offset regardless of rotation angle.

**Actual Behavior:** With spread > 0, shadow offset stays fixed in screen space while the shape rotates.

---

## Root Cause

The bug is in the `drawSpreadShadow()` method in [LayerRenderer.js](../../resources/ext.layers.shared/LayerRenderer.js#L256).

### Why Spread = 0 Works

When spread = 0, shadows are applied via `applyShadow()` directly in the shape's drawing context:

```javascript
// Line ~535 in drawRectangle()
} else if ( this.hasShadowEnabled( layer ) ) {
    // No spread, apply shadow normally to the actual shape
    this.applyShadow( layer, shadowScale );
}
```

The shadow is drawn as part of the same fill/stroke operations in the rotated coordinate system. While `shadowOffsetX/Y` are technically in screen space, they're applied before drawing and the visual result is acceptable because everything happens in one context.

### Why Spread > 0 Fails

When spread > 0, the `drawSpreadShadow()` method uses an offscreen canvas technique:

```javascript
// Line ~278-282 - Copy rotation transform to temp canvas
if ( this.ctx.getTransform ) {
    const transform = this.ctx.getTransform();
    tempCtx.setTransform( transform );
}
tempCtx.translate( FAR_OFFSET, 0 );  // Horizontal offset for shadow isolation

// Line ~284-289 - Set shadow offsets (in SCREEN coordinates, not rotated!)
tempCtx.shadowOffsetX = sp.offsetX - FAR_OFFSET;
tempCtx.shadowOffsetY = sp.offsetY;
```

The problem is:
1. The rotation transform IS copied to temp canvas
2. But `shadowOffsetX/Y` are always in screen coordinates (Canvas API limitation)
3. The FAR_OFFSET (5000px) is applied horizontally in the rotated space
4. The shadow offset compensation (`sp.offsetX - FAR_OFFSET`) doesn't account for rotation

Then when drawing back to main canvas:

```javascript
// Line ~316-322 - Draw temp canvas with IDENTITY transform
this.ctx.save();
this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );  // ← Resets rotation!
this.ctx.drawImage( tempCanvas, 0, 0 );
this.ctx.restore();
```

The temp canvas (which contains the shadow) is composited back using an identity transform, losing all rotation context.

---

## Visual Demonstration

```
With spread = 0 (works correctly):
┌─────────┐     Rotated 45°:     ◇
│ Shape   │                     ╱ ╲
│         │    →               ╱   ╲
└─────────┘                    ╲   ╱
    ░░░░░░                      ╲ ╱
    Shadow                        ░░░░ (shadow stays relative)

With spread > 0 (BUG):
┌─────────┐     Rotated 45°:     ◇
│ Shape   │                     ╱ ╲
│         │    →               ╱   ╲
└─────────┘                    ╲   ╱
    ░░░░░░                      ╲ ╱
    Shadow                   ░░░░░░░░ (shadow stays in screen space!)
```

---

## Potential Solutions

### Option 1: Rotate Shadow Offsets Before Off-Screen Rendering (Recommended)

In `drawSpreadShadow()`, rotate the shadow offset vector to match the current rotation:

```javascript
LayerRenderer.prototype.drawSpreadShadow = function ( layer, scale, spread, drawExpandedPathFn, opacity ) {
    const sp = this.getShadowParams( layer, scale );
    
    // Get rotation from layer (if available) to rotate shadow offsets
    const rotation = layer.rotation || 0;
    let adjustedOffsetX = sp.offsetX;
    let adjustedOffsetY = sp.offsetY;
    
    if ( rotation !== 0 ) {
        const rad = ( rotation * Math.PI ) / 180;
        const cos = Math.cos( rad );
        const sin = Math.sin( rad );
        adjustedOffsetX = sp.offsetX * cos - sp.offsetY * sin;
        adjustedOffsetY = sp.offsetX * sin + sp.offsetY * cos;
    }
    
    // ... later in the method:
    tempCtx.shadowOffsetX = adjustedOffsetX - FAR_OFFSET;
    tempCtx.shadowOffsetY = adjustedOffsetY;
    // ...
};
```

**Pros:**
- Simple fix in one location
- Works with existing offscreen canvas technique
- Minimal performance impact

**Cons:**
- Need to pass rotation info to drawSpreadShadow (may need to extract from transform matrix if layer.rotation not available)

### Option 2: Use Transformed FAR_OFFSET

Transform the FAR_OFFSET itself to account for rotation, keeping shadow offsets in the rotated space.

**Cons:**
- More complex math
- May cause issues with canvas bounds

### Option 3: Draw Shadow in Rotated Space Without Reset

Modify the final `drawImage` to use the current transform instead of identity.

**Cons:**
- May cause positioning issues
- The temp canvas coordinates don't align with rotated space easily

---

## Recommended Fix

**Option 1** is recommended. The fix involves:

1. In `drawSpreadShadow()` and `drawSpreadShadowStroke()`, accept or detect the rotation angle
2. Rotate the shadow offset vector before setting `shadowOffsetX/Y`
3. Keep the rest of the algorithm unchanged

### Implementation Location

- `resources/ext.layers.shared/LayerRenderer.js`:
  - `drawSpreadShadow()` (line ~256)
  - `drawSpreadShadowStroke()` (line ~340)

---

## Fix Applied (2025-12-08)

### Changes Made

**File:** `resources/ext.layers.shared/LayerRenderer.js`

**Method 1: `drawSpreadShadow()` (line ~256)**

Added rotation-aware shadow offset calculation after copying the transform to temp canvas:

```javascript
// FIX (2025-12-08): Rotate shadow offsets to match layer rotation
// Canvas shadowOffsetX/Y are in screen coordinates, not transformed coordinates.
// When the layer is rotated, we need to rotate the offset vector so the shadow
// stays in the correct relative position to the shape.
let adjustedOffsetX = sp.offsetX;
let adjustedOffsetY = sp.offsetY;
const rotation = typeof layer.rotation === 'number' ? layer.rotation : 0;
if ( rotation !== 0 ) {
    const rad = ( rotation * Math.PI ) / 180;
    const cos = Math.cos( rad );
    const sin = Math.sin( rad );
    adjustedOffsetX = sp.offsetX * cos - sp.offsetY * sin;
    adjustedOffsetY = sp.offsetX * sin + sp.offsetY * cos;
}

// Set up shadow with adjusted offset to compensate for FAR_OFFSET
tempCtx.shadowColor = sp.color;
tempCtx.shadowBlur = blur;
tempCtx.shadowOffsetX = adjustedOffsetX - FAR_OFFSET; // Changed from sp.offsetX
tempCtx.shadowOffsetY = adjustedOffsetY;              // Changed from sp.offsetY
```

**Method 2: `drawSpreadShadowStroke()` (line ~340)**

Same fix applied - added rotation-aware shadow offset calculation.

### How to Revert

If this fix doesn't resolve the issue or causes problems, revert by:

1. In `drawSpreadShadow()`, replace:
   ```javascript
   let adjustedOffsetX = sp.offsetX;
   let adjustedOffsetY = sp.offsetY;
   const rotation = typeof layer.rotation === 'number' ? layer.rotation : 0;
   if ( rotation !== 0 ) {
       const rad = ( rotation * Math.PI ) / 180;
       const cos = Math.cos( rad );
       const sin = Math.sin( rad );
       adjustedOffsetX = sp.offsetX * cos - sp.offsetY * sin;
       adjustedOffsetY = sp.offsetX * sin + sp.offsetY * cos;
   }

   // Set up shadow with adjusted offset to compensate for FAR_OFFSET
   tempCtx.shadowColor = sp.color;
   tempCtx.shadowBlur = blur;
   tempCtx.shadowOffsetX = adjustedOffsetX - FAR_OFFSET;
   tempCtx.shadowOffsetY = adjustedOffsetY;
   ```
   
   With the original:
   ```javascript
   // Set up shadow with adjusted offset to compensate for FAR_OFFSET
   tempCtx.shadowColor = sp.color;
   tempCtx.shadowBlur = blur;
   tempCtx.shadowOffsetX = sp.offsetX - FAR_OFFSET;
   tempCtx.shadowOffsetY = sp.offsetY;
   ```

2. Same revert in `drawSpreadShadowStroke()`.

### Test Results

All 2,647 tests pass after fix.

---

## Testing Verification

After fix, verify:
1. Create rectangle with shadow enabled AND spread > 0
2. Rotate rectangle to 45°, 90°, 135°, 180°
3. Shadow should maintain relative position at all angles
4. Test with spread = 0 to ensure no regression
5. Test all shape types: rectangle, circle, ellipse, polygon, star, text

---

## References

- MDN: [CanvasRenderingContext2D.shadowOffsetX](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/shadowOffsetX) - Documents that shadow offsets are in device/screen coordinates
- Related fix: [BUG_SHADOW_SCALING_2025-12-08.md](BUG_SHADOW_SCALING_2025-12-08.md) - Shadow scaling issue fixed earlier today

---

*Document created: December 8, 2025*  
*Updated: December 8, 2025 - Clarified that bug only occurs with spread > 0*
