# DEBUG: Canvas Layer Properties Panel Issue

## Problem Statement
When clicking the Canvas layer in Layer Manager (slide mode), the Properties Panel shows "Layer not found" instead of W×H and color controls.

## Expected Behavior
Properties Panel should show:
- Width input
- Height input  
- Background color picker

## Current Code Flow (Hypothesized)

### 1. Click on Canvas Layer
- `BackgroundLayerController.createCanvasLayerContent()` creates the Canvas layer item
- Click handler should call something to select the canvas layer
- Properties Panel should update to show canvas properties

### 2. Key Methods to Trace
- `BackgroundLayerController.createCanvasLayerContent()` - Creates the layer item, has click handler
- `LayerPanel.selectCanvasLayer()` - Should select canvas and show properties
- `LayerPanel.showCanvasProperties()` - Should populate Properties Panel with W×H + color
- `StateManager.setState('canvasLayerSelected', true)` - State change

---

## Debugging Log

### Attempt 1: Add subscription to canvasLayerSelected (FAILED)
**Date:** 2026-01-23
**Change:** Added subscription in LayerPanel.subscribeToState():
```javascript
const unsubCanvasSelection = this.editor.stateManager.subscribe( 'canvasLayerSelected', ( isSelected ) => {
    if ( isSelected ) {
        this.showCanvasProperties();
    }
} );
this.stateSubscriptions.push( unsubCanvasSelection );
```
**Result:** FAILED - Properties Panel still shows "Layer not found"
**Why it failed:** Unknown - need to investigate
**Action:** Need to revert this change and investigate root cause

---

## Investigation Findings

### "Layer not found" Source
Found at `LayerPanel.js` line 1828 in `updatePropertiesPanel()`:
```javascript
const layer = this.editor.getLayerById( layerId );
if ( !layer ) {
    // Shows "Layer not found"
}
```

This means `updatePropertiesPanel()` is being called with a layer ID that doesn't exist.

### Code Flow Analysis

1. **selectCanvasLayer()** (BackgroundLayerController.js:196-223):
   - FIRST calls `showCanvasProperties()` (line 200-206) 
   - THEN sets `canvasLayerSelected = true` (line 209)
   - THEN sets `selectedLayerIds = []` (line 211)

2. **selectedLayerIds subscription** (LayerPanel.js:504-522):
   - Fires when `selectedLayerIds` changes to `[]`
   - Calculates `selectedId = null` (empty array)
   - Line 518-520: `if ( !canvasLayerSelected ) { updatePropertiesPanel(selectedId) }`
   - SHOULD skip because `canvasLayerSelected` is true

3. **canvasLayerSelected subscription** (LayerPanel.js:524-529):
   - Fires when `canvasLayerSelected` becomes true
   - Calls `showCanvasProperties()` again (redundant but harmless)

### Hypothesis: Race Condition or State Issue

The guard at line 518 checks `canvasLayerSelected` state. BUT:
- `canvasLayerSelected` is set at line 209
- `selectedLayerIds` is set at line 211
- IF subscriptions fire synchronously, `canvasLayerSelected` should be true when checked

**WAIT** - Line 211 sets `selectedLayerIds = []`, so `selectedId` would be `null`.
If `updatePropertiesPanel(null)` runs, it shows "No layer selected", NOT "Layer not found"!

**CONCLUSION:** If the user sees "Layer not found", something ELSE is calling 
`updatePropertiesPanel()` with an actual (but invalid) layer ID.

### Where else is updatePropertiesPanel called?

- PropertyBuilders.js: After changing layer type (re-renders for current layer)
- PropertiesForm.js: After changing layer type
- FolderOperationsController.js: When deleting layers
- LayerPanel.js line 519: From selectedLayerIds subscription

### NEW HYPOTHESIS

Maybe the issue is NOT with the subscription guard, but with the INITIAL state.
When the editor opens, what's the initial selection state? If a layer was 
selected before (stored in state), and then we switch to slide mode, the 
subscription might fire with an old layer ID that no longer exists.

OR: The Canvas layer click doesn't actually trigger `selectCanvasLayer()`.

---

## Test Plan

1. Add console.log to verify `selectCanvasLayer()` is called on click
2. Add console.log to verify the guard `!canvasLayerSelected` at line 518
3. Add console.log to see WHAT layer ID is passed to `updatePropertiesPanel()`
4. Check if the error appears IMMEDIATELY on editor load vs. after clicking Canvas

---

## Attempt 1: Add subscription to canvasLayerSelected (FAILED)
**Date:** 2026-01-23
**Change:** Added subscription in LayerPanel.subscribeToState()
**Result:** FAILED - Properties Panel still shows "Layer not found"
**Why it failed:** The subscription is redundant - showCanvasProperties() was 
  already being called directly from selectCanvasLayer(). The real issue is 
  elsewhere.
**Action:** Need to add debug logging to find root cause

---

## Next Steps
1. ~~Add debug logging to trace execution path~~ DONE
2. User tests in browser and provides console output
3. Analyze logs to find root cause

---

## Attempt 2: Add Debug Logging - INCONCLUSIVE
**Date:** 2026-01-23
**Changes:**
1. Added logging to `selectCanvasLayer()` in BackgroundLayerController.js
2. Added logging to `selectedLayerIds` subscription in LayerPanel.js
3. Added logging + stack trace to `updatePropertiesPanel()` in LayerPanel.js

**Result:** NONE of the debug logs appeared in console output
**Console showed:** Only ViewerManager and LayersEditorModal loading messages

**Analysis:** 
- If debug logs didn't appear, either:
  1. Browser/ResourceLoader cache - old code running (need hard refresh Ctrl+Shift+R)
  2. The Canvas layer click isn't being detected at all
  3. The click handler isn't wired up

**Action:** Remove debug logging (it's noise if not helping) and try a different approach

---

## Attempt 2: Debug Logging - FAILED/INCONCLUSIVE
**Date:** 2026-01-23
**Changes:** Added console logging to trace execution
**Result:** Debug logs did NOT appear in console
**Reverted:** YES - all debug logging removed
**Reason:** Code runs inside iframe, logs may not appear in parent console

---

## User Feedback (2026-01-23 15:37)

**Console output from ARTICLE PAGE:**
```
LayersEditorModal.js:15 [LayersEditorModal] Module loading...
LayersEditorModal.js:287 [LayersEditorModal] Module exported...
ViewerManager.js:1513 [Layers:ViewerManager] _shouldUseModalForSlide: ...
ViewerManager.js:1469 [Layers:ViewerManager] openSlideEditor: useModal= true
```

**Key observations:**
1. Editor opens via iframe modal (LayersEditorModal)
2. "Layer not found" appears INSIDE the editor (iframe context)
3. **NEW ISSUE IDENTIFIED:** Page navigates before iframe opens

**User question:** "Why does clicking 'edit layers' overlay navigate to another page before opening the iframe editor?"

---

## NEW BUG: Navigation Before Modal Opens

The modal SHOULD open an iframe on the current page WITHOUT navigation.
But the user reports navigation is happening first.

**UPDATE:** This may be EXPECTED BEHAVIOR:
- The modal creates an iframe
- The iframe loads the editor page (Special:EditSlide or File:X?action=editlayers)
- The PARENT page (article) should NOT navigate
- Inside the iframe, a different page loads - this is normal

**User should confirm:** Does the article page URL in the browser address bar change?
If YES - bug
If NO - expected behavior (iframe loads a different page internally)

---

## USER CONFIRMATION (2026-01-23)

**Confirmed behavior:**
1. Editor opens with "No layer selected" ✓ (correct)
2. After clicking Canvas layer → "Layer not found" ✗ (BUG)
3. URL does not change ✓ (modal working correctly)
4. Closing editor jumps back one page ✗ (SM-5 bug - separate issue)

**Root cause:** When Canvas layer is clicked, something is calling 
`updatePropertiesPanel()` with a layer ID (not null) that doesn't exist.

The `__background__` data-layer-id might be getting passed to updatePropertiesPanel.

---

## Attempt 3: Initialize State + Stop Propagation - PARTIAL SUCCESS
**Date:** 2026-01-23
**Changes:**
1. Added `canvasLayerSelected: false` to StateManager initial state
2. Added `e.stopPropagation()` to Canvas layer click handler

**Result:** Properties Panel now shows W×H and color controls ✓
**Remaining issues:**
1. ~~Controls do nothing when changed~~ → Fixed in Attempt 4
2. ~~Two color picker swatches (Layer Manager + Properties Panel)~~ → Fixed in Attempt 4

---

## Attempt 4: Fix Controls + Consolidate Swatches - SUCCESS
**Date:** 2026-01-23

### Issues Found:
1. **Canvas didn't update live** - `setCanvasDimension` called `resizeCanvas()` but that doesn't take parameters; it just adjusts CSS. Need to call `setBaseDimensions()` which actually resizes the canvas element.
2. **Properties Panel swatch didn't show current color** - Was using gray checkerboard pattern (wrong); wasn't updating after color change
3. **Inconsistent transparency display** - Three different patterns:
   - ColorPickerDialog: red diagonal stripes (correct)
   - Layer Manager: thicker red stripes (close but different)
   - Properties Panel: gray checkerboard (wrong)

### Fixes Applied:
1. **BackgroundLayerController.setCanvasDimension()** - Now calls `setBaseDimensions(width, height)` instead of just `resizeCanvas()` to actually resize the canvas element
2. **LayerPanel.createCanvasColorSwatch()** - Uses new `updateSwatchColor()` helper for consistent display
3. **LayerPanel.updateSwatchColor()** - New helper using exact ColorPickerDialog pattern: `repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)`
4. **LayerPanel.updateCanvasColorSwatch()** - New method called by BackgroundLayerController after color changes
5. **BackgroundLayerController.setSlideBackgroundColor()** - Now calls `layerPanel.updateCanvasColorSwatch()` to sync Properties Panel
6. **BackgroundLayerController.createColorSwatchIcon()** - Changed from button to span (display-only), smaller size (20px), removed click handler. Color editing happens in Properties Panel only.

### Design Decision:
- **Layer Manager swatch**: Display-only (shows current color, not clickable)
- **Properties Panel swatch**: Clickable (opens color picker)
- This is consistent with how regular layers work - click layer to select, edit in Properties Panel

### Tests: All passing (52 BackgroundLayerController, 257 LayerPanel)

---

## Regression Fix: APIManager uiManager null check
**Date:** 2026-01-23

**Issue:** Editor failed to load with error: `Cannot read properties of null (reading 'uiManager')`

**Root Cause:** APIManager was directly accessing `this.editor.uiManager.showSpinner()` and `this.editor.uiManager.hideSpinner()` without null checks. During initial load, `uiManager` may not be initialized yet.

**Fix:**
1. Added `showSpinner()` and `hideSpinner()` helper methods in APIManager with null guards
2. Replaced all 20+ direct `this.editor.uiManager.showSpinner/hideSpinner` calls with the new helper methods
3. Added null check for `this.editor.uiManager.revNameInputEl` access

**Tests:** 207 APIManager tests passing
