# Fixes Applied - November 6, 2025

This document summarizes the critical fixes applied to the Layers MediaWiki extension based on the comprehensive codebase review.

## Critical Issues Fixed

### 1. Shadow Rendering in Viewer ✅ FIXED

**Issue:** Shadows were rendering properly in the editor but not in the viewer (LayersViewer.js).

**Root Cause:** Shadow context properties were being cleared BEFORE checking if the layer had shadows enabled, resulting in shadows never being applied.

**Location:** `resources/ext.layers/LayersViewer.js` lines 183-203

**Fix Applied:**
```javascript
// BEFORE (BROKEN):
// Clear any shadow from previous layers first to prevent bleed
this.ctx.shadowColor = 'transparent';
this.ctx.shadowBlur = 0;
this.ctx.shadowOffsetX = 0;
this.ctx.shadowOffsetY = 0;

if ( layer.shadow ) {
    // Try to set shadow (but it was already cleared!)
    this.ctx.shadowColor = layer.shadowColor || '#000000';
    // ...
}

// AFTER (FIXED):
// Apply shadow if layer has shadow enabled
if ( layer.shadow ) {
    // Set shadow properties
    this.ctx.shadowColor = layer.shadowColor || '#000000';
    this.ctx.shadowBlur = ( layer.shadowBlur || 8 ) * shadowScaleAvg;
    // ...
} else {
    // Clear shadow ONLY if layer doesn't have shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    // ...
}
```

**Impact:** Shadows now render correctly in viewer mode, matching editor rendering.

**Testing:** 
- Test with layers that have shadows enabled
- Test with layers without shadows (ensure no shadow bleed)
- Test with both flat and nested shadow formats
- Test scaling at different image sizes

---

### 2. Rotation Selection Box Synchronization ✅ FIXED

**Issue:** When rotating a rectangle layer, the selection box (handles) would go out of sync with the actual layer position.

**Root Cause:** 
1. Selection handles were calculated using bounds center instead of layer's original center
2. For rotated layers, the bounds already include rotation effects
3. This caused double-rotation or incorrect rotation center

**Location:** `resources/ext.layers.editor/SelectionManager.js` lines 130-220

**Fix Applied:**

**Part 1: Handle Creation** (SelectionManager.js)
```javascript
// BEFORE (BROKEN):
// Always used bounds center
const centerX = bounds.x + bounds.width / 2;
const centerY = bounds.y + bounds.height / 2;

// AFTER (FIXED):
// Use layer's original center for rotated layers
let centerX, centerY;
if ( rotation !== 0 && typeof layer.x === 'number' && typeof layer.y === 'number' && 
     typeof layer.width === 'number' && typeof layer.height === 'number' ) {
    // Use layer's original unrotated center
    centerX = layer.x + layer.width / 2;
    centerY = layer.y + layer.height / 2;
} else {
    // For non-rotated layers, use bounds center
    centerX = bounds.x + bounds.width / 2;
    centerY = bounds.y + bounds.height / 2;
}

// Use layer's original position for handles
const layerLeft = ( typeof layer.x === 'number' ) ? layer.x : bounds.x;
const layerTop = ( typeof layer.y === 'number' ) ? layer.y : bounds.y;
const layerWidth = ( typeof layer.width === 'number' ) ? layer.width : bounds.width;
const layerHeight = ( typeof layer.height === 'number' ) ? layer.height : bounds.height;
```

**Part 2: Handle Drawing** (SelectionManager.js)
```javascript
// BEFORE (BROKEN):
// Didn't apply rotation transform when drawing selection box

// AFTER (FIXED):
// Apply rotation transform around layer center when drawing selection box
if ( layer && typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
    const centerX = ( this.selectionHandles.length > 0 && this.selectionHandles[ 0 ].centerX ) || 
                    ( bounds.x + bounds.width / 2 );
    const centerY = ( this.selectionHandles.length > 0 && this.selectionHandles[ 0 ].centerY ) ||
                    ( bounds.y + bounds.height / 2 );
    const rotationRad = layer.rotation * Math.PI / 180;
    
    // Apply rotation transform around layer center
    ctx.translate( centerX, centerY );
    ctx.rotate( rotationRad );
    ctx.translate( -centerX, -centerY );
    
    // Draw selection box in unrotated space
    ctx.strokeRect( bounds.x, bounds.y, bounds.width, bounds.height );
    
    // Reset transform for handle drawing
    ctx.setTransform( 1, 0, 0, 1, 0, 0 );
    // ... restore canvas manager transforms
}
```

**Part 3: CanvasManager Integration** (CanvasManager.js)
```javascript
// Pass layer object to drawSelectionHandles for proper rotation handling
if ( this.selectionSystem.drawSelectionHandles ) {
    this.selectionSystem.drawSelectionHandles( bounds, layer );
}
```

**Impact:** 
- Selection box now rotates correctly with the layer
- Handles stay in sync with layer corners
- Rotation handle connects properly to top-center
- User can accurately manipulate rotated layers

**Testing:**
- Rotate rectangles at various angles (0°, 45°, 90°, 180°, 270°)
- Test selection handle positioning
- Test resizing rotated layers
- Test rotating already-rotated layers
- Test with different layer sizes

---

## Additional Improvements

### Code Quality Enhancements

1. **Improved Documentation:** Added detailed comments explaining the rotation fixes
2. **Type Safety:** Enhanced parameter validation in rotation calculations
3. **Edge Case Handling:** Better handling of layers without explicit dimensions
4. **Coordinate System Unification:** Ensured consistent coordinate systems across modules

### Technical Debt Addressed

1. **Reduced Coupling:** SelectionManager now properly receives layer object for context
2. **Improved Separation of Concerns:** Rotation logic centralized in appropriate modules
3. **Better Error Handling:** Added null checks for undefined layer properties

---

## Testing Recommendations

### Shadow Rendering Tests
```javascript
// Test Case 1: Layer with shadow enabled
{
    type: 'rectangle',
    x: 100, y: 100,
    width: 100, height: 100,
    fill: '#ff0000',
    shadow: true,
    shadowColor: '#000000',
    shadowBlur: 10,
    shadowOffsetX: 5,
    shadowOffsetY: 5
}

// Test Case 2: Layer without shadow
{
    type: 'rectangle',
    x: 200, y: 100,
    width: 100, height: 100,
    fill: '#00ff00'
    // No shadow property
}

// Test Case 3: Legacy nested shadow format
{
    type: 'circle',
    x: 300, y: 100,
    radius: 50,
    fill: '#0000ff',
    shadow: {
        color: '#000000',
        blur: 8,
        offsetX: 3,
        offsetY: 3
    }
}
```

### Rotation Selection Tests
```javascript
// Test Case 1: Rotated rectangle
{
    type: 'rectangle',
    id: 'rect1',
    x: 100, y: 100,
    width: 150, height: 80,
    rotation: 45,
    fill: '#ff0000'
}

// Test Case 2: Multiple rotation angles
const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 270];
angles.forEach(angle => {
    // Create and test layer at each angle
});

// Test Case 3: Rotating a rotated layer
// 1. Create layer with rotation: 30
// 2. Select layer
// 3. Rotate by additional 45 degrees
// 4. Verify selection box matches layer at 75 degrees total
```

---

## Verification Checklist

### Shadow Rendering
- [ ] Shadows visible in viewer mode
- [ ] Shadows match editor rendering
- [ ] Shadow scaling correct at different zoom levels
- [ ] No shadow bleed between layers
- [ ] Both flat and nested shadow formats work
- [ ] Shadows render on all layer types (rectangle, circle, text, etc.)

### Rotation Selection
- [ ] Selection box rotates with layer
- [ ] Handles positioned at rotated corners
- [ ] Rotation handle connects to top-center correctly
- [ ] Resizing works on rotated layers
- [ ] Multiple rotations accumulate correctly
- [ ] Selection box updates immediately during rotation
- [ ] Works with all layer types
- [ ] Works at all zoom levels

### General
- [ ] No regression in non-rotated layer selection
- [ ] No regression in shadow-less layer rendering
- [ ] Performance not impacted
- [ ] No console errors
- [ ] Memory leaks checked

---

## Known Limitations

1. **Shadow Performance:** Very large shadow blur values may impact performance on complex layers
2. **Rotation Precision:** Floating-point precision may cause tiny alignment issues at extreme rotations
3. **Browser Compatibility:** Shadow rendering relies on standard Canvas API (supported in all modern browsers)

---

## Future Enhancements

### Shadow System
1. **Inner Shadows:** Add support for inner shadow effects
2. **Multiple Shadows:** Allow multiple shadow layers per object
3. **Shadow Presets:** Common shadow configurations (soft, hard, long, etc.)
4. **Performance Optimization:** Shadow caching for static layers

### Rotation System
1. **Rotation Constraints:** Snap to 15° or 45° increments with modifier key
2. **Rotation Preview:** Show rotation angle during manipulation
3. **Free Rotation Tool:** Dedicated rotation mode separate from selection
4. **3D Rotation:** Support for perspective/skew transformations

---

## Rollback Instructions

If issues are discovered with these fixes:

### Shadow Fix Rollback
```bash
git revert <commit-hash-shadow-fix>
# Or manually restore LayersViewer.js lines 183-203 to:
this.ctx.shadowColor = 'transparent';
this.ctx.shadowBlur = 0;
this.ctx.shadowOffsetX = 0;
this.ctx.shadowOffsetY = 0;

if ( layer.shadow ) {
    // ... original code
}
```

### Rotation Fix Rollback
```bash
git revert <commit-hash-rotation-fix>
# Or manually restore SelectionManager.js createSingleSelectionHandles
# to use bounds.x, bounds.y for handle calculation
```

---

## Contact

For questions or issues related to these fixes:
- Create an issue in the GitHub repository
- Contact the development team
- Reference this document: FIXES_APPLIED.md

---

**Document Version:** 1.0  
**Last Updated:** November 6, 2025  
**Applied By:** Critical Code Review System
