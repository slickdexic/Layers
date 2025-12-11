# Bug Fix: Shadow Rendering Broken After ShadowRenderer Extraction (2025-12-11)

## Summary
Shadow rendering was completely broken for rectangles, circles, and other shapes after the ShadowRenderer.js extraction refactoring. The issue was that callback functions passed to `drawSpreadShadow()` and `drawSpreadShadowStroke()` were using the wrong canvas context.

## Symptoms
- **Rectangle and Circle:** No shadows at all for fill or stroke, spread or no spread
- **Polygon:** Shadows only for fill when spread=0, no stroke shadow unless fill opacity=0
- **Star:** Stroke shadow only when fill opacity=0

## Root Cause
When LayerRenderer was refactored to delegate shadow calls to ShadowRenderer, the callback functions were passed as arrow functions like:

```javascript
this.drawSpreadShadow( layer, shadowScale, spread, () => {
    this.ctx.beginPath();
    this.ctx.rect( x, y, width, height );
}, fillShadowOpacity );
```

The ShadowRenderer tried to swap the context using:

```javascript
const originalCtx = this.ctx;
this.ctx = tempCtx;
drawExpandedPathFn.call( this );  // Call callback with ShadowRenderer as 'this'
this.ctx = originalCtx;
```

However, **arrow functions ignore `.call(this)` binding** - they always use the lexically captured `this` from their definition scope. So `this.ctx` in the callback still referred to `LayerRenderer.ctx`, not `ShadowRenderer.ctx` (which was set to `tempCtx`).

Result: The path was drawn on the main canvas instead of the temporary offscreen canvas, so the offscreen shadow technique never worked.

## The Fix
Changed the callback signature to explicitly pass the context as a parameter:

### ShadowRenderer.js
```javascript
// Before (broken):
drawExpandedPathFn.call( this );

// After (working):
drawExpandedPathFn( tempCtx );
```

### LayerRenderer.js (all callbacks)
```javascript
// Before (broken):
this.drawSpreadShadow( layer, shadowScale, spread, () => {
    this.ctx.beginPath();
    this.ctx.rect( x, y, width, height );
}, fillShadowOpacity );

// After (working):
this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
    ctx.beginPath();
    ctx.rect( x, y, width, height );
}, fillShadowOpacity );
```

## Files Modified
- `resources/ext.layers.shared/ShadowRenderer.js` - Changed `drawSpreadShadow` and `drawSpreadShadowStroke` to pass `tempCtx` to the callback
- `resources/ext.layers.shared/LayerRenderer.js` - Updated all callback usages (17 callbacks total) to accept `ctx` parameter:
  - `drawRectangle` - 3 callbacks (fill spread, fill no-spread, stroke)
  - `drawCircle` - 2 callbacks (fill, stroke)
  - `drawEllipse` - 2 callbacks (fill, stroke)
  - `drawLine` - 1 callback (stroke)
  - `drawArrow` - 2 callbacks (fill, stroke)
  - `drawPolygon` - 2 callbacks (fill, stroke)
  - `drawStar` - 2 callbacks (fill, stroke)
  - `drawPath` - 1 callback (stroke)
- Also updated `drawRoundedRectPath` to accept optional `context` parameter for callbacks that need rounded rectangles

## Why This Keeps Breaking
The shadow rendering system is complex with multiple interdependent components:
1. The offscreen canvas technique (FAR_OFFSET = 5000)
2. Context swapping for temporary canvas
3. Rotation handling
4. Separate fill/stroke shadow opacity
5. Spread expansion for enlarged shadows

Each refactoring has to carefully preserve all these aspects. The context-passing mechanism is particularly fragile because JavaScript's `this` binding has subtle rules that differ between regular functions and arrow functions.

## Lesson Learned
When refactoring rendering code that uses callbacks:
1. **Never rely on `this` rebinding for arrow functions** - use explicit parameters
2. Always pass the canvas context explicitly to callbacks
3. Test shadow rendering for ALL shape types after ANY change to the shadow system
4. Add comprehensive shadow tests that verify actual pixel output (not just that methods are called)

## Test Verification
All 3,877 tests pass after this fix.
