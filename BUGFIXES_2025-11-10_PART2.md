# Bug Fixes Part 2 - November 10, 2025

## Issue #3: Missing markCanvasDirty() Method

### Error
```
Uncaught TypeError: this.editor.canvasManager.markCanvasDirty is not a function
    at LayerPanel.reorderLayers (LayerPanel.js:1396)
```

### Root Cause Analysis

**Location:** `resources/ext.layers.editor/LayerPanel.js` line 1396

**Problem:**
The `reorderLayers()` method calls `this.editor.canvasManager.markCanvasDirty()` but this method does not exist in the `CanvasManager` class. The method was likely renamed or removed during refactoring.

**Code Context:**
```javascript
// LayerPanel.js line 1396
if ( this.editor.canvasManager ) {
    // Mark canvas dirty instead of rendering directly to avoid duplicate rendering
    this.editor.canvasManager.markCanvasDirty();  // ❌ METHOD DOES NOT EXIST
    this.editor.canvasManager.redraw();
}
```

**Analysis:**
- The `CanvasManager` class does have a `dirtyRegion` property (line 39)
- The comment says "Mark canvas dirty instead of rendering directly"
- The code immediately calls `redraw()` after marking dirty
- No `markCanvasDirty()` or `markDirty()` method exists in `CanvasManager.js`

**Impact:**
- Layer drag-and-drop fails completely
- Error thrown prevents layer reordering
- This is why the drag-and-drop feature wasn't working

### Solution

**Option 1: Remove the non-existent method call (Recommended)**
Since `redraw()` is called immediately after, the `markCanvasDirty()` call is redundant.

**Option 2: Add the missing method to CanvasManager**
Create a proper `markCanvasDirty()` method to track dirty regions.

**Recommendation:** Option 1 - Remove the call since `redraw()` handles the canvas update.

---

## Issue #4: Revision Selector Cleared After Loading Revision

### Error
User report: "When selecting a revision and loading it, it loads correctly, but the revision history list is then blank."

### Root Cause Analysis

**Location:** `resources/ext.layers.editor/APIManager.js` line 446

**Problem:**
When loading a revision, the API call only returns data for that specific revision. The `all_layersets` array in the response may be empty or incomplete when loading a specific `layersetid`.

**Code Context:**
```javascript
// APIManager.js lines 442-446
this.extractLayerSetData( data.layersinfo.layerset );
this.editor.stateManager.set( 'allLayerSets', data.layersinfo.all_layersets || [] );
this.editor.buildRevisionSelector();
this.editor.renderLayers();
this.editor.stateManager.set( 'isDirty', false );
```

**Analysis:**
1. `loadRevisionById()` calls API with `layersetid: revisionId`
2. Server returns the specific revision's data
3. `all_layersets` in response may be empty when specific revision requested
4. `stateManager.set('allLayerSets', [])` overwrites the full list with empty array
5. `buildRevisionSelector()` has no revisions to display
6. Dropdown becomes empty

**Expected Behavior:**
- Loading a revision should preserve the full list of available revisions
- Only the current revision data should change
- The dropdown should remain populated with all revisions

### Solution

**Option 1: Don't overwrite allLayerSets if empty (Recommended)**
Only update `allLayerSets` if the response contains data.

**Option 2: Make separate API call for revision list**
After loading revision, make another call without `layersetid` to get full list.

**Option 3: Fix server to always return full list**
Modify `ApiLayersInfo.php` to return `all_layersets` even when specific revision requested.

**Recommendation:** Option 1 - Simplest fix that preserves existing revision list.

---

## Files Modified ✅

1. **LayerPanel.js** (line 1396)
   - ✅ Removed call to non-existent `markCanvasDirty()` method
   - ✅ Kept `redraw()` call to update canvas

2. **APIManager.js** (line 445-447)
   - ✅ Added conditional check before updating `allLayerSets`
   - ✅ Only updates if `all_layersets` exists and has data
   - ✅ Preserves existing revision list when loading specific revision

**Implementation Status:** ✅ **COMPLETE**

**Lint/Style Tests:** ✅ **PASSED**

---

## Testing Plan

### Test #3: Layer Drag-and-Drop
1. Create 3-5 layers
2. Drag a layer to different position
3. **Expected:** Layer reorders without error
4. **Expected:** Console shows no errors
5. **Expected:** Canvas updates to show new order

### Test #4: Revision Selector After Load
1. Create 3-4 layer revisions
2. Note that dropdown shows all revisions
3. Select a previous revision and click "Load"
4. **Expected:** Previous revision loads correctly
5. **Expected:** Dropdown still shows all revisions
6. **Expected:** Current revision is highlighted in dropdown

---

## Implementation Priority

**Issue #3 (markCanvasDirty):** ⚠️ CRITICAL - Breaks core functionality  
**Issue #4 (revision selector):** ⚠️ HIGH - Poor UX, confusing for users

Both issues should be fixed immediately.
