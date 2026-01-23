# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 23, 2026 (Comprehensive Critical Audit v23)  
**Version:** 1.5.26  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 9,946 tests in 156 suites (all passing, verified January 23, 2026)
- **Coverage:** 92.59% statements, 83.02% branches (verified January 22, 2026)
- **JS files:** 124 (excludes `resources/dist/` and build scripts)
- **PHP files:** 33+

---

## Executive Summary

The Layers extension is a mature, feature-rich MediaWiki extension with strong security practices and excellent test coverage. However, a critical audit identified **5 Slide Mode issues** (1 now diagnosed with fix), **10+ core architectural issues** including race conditions and memory leaks, and several code quality concerns.

**Overall Assessment:** **7.2/10** — Production-ready for image layers, but Slide Mode and core components have significant bugs that need resolution.

### Key Strengths
- Excellent security model (CSRF, rate limiting, validation)
- Strong test coverage (92.59% statement, 83.02% branch)
- Well-documented with comprehensive inline comments
- Modern ES6 class-based architecture
- Proper delegation patterns in large files
- Zero TODO/FIXME comments in production code

### 🚨 Critical Issues Summary (January 23, 2026)

| # | Issue | Severity | Status | Component |
|---|-------|----------|--------|-----------|
| SM-4 | **SVG shapes render with grey dashed boxes on article pages** | **Critical** | ✅ **FIXED** | Slides |
| CORE-1 | **StateManager set() doesn't lock - race condition** | **Critical** | 🟡 By Design | Editor |
| CORE-2 | **HistoryManager memory leak with large images** | **Critical** | 🔴 Open | Editor |
| CORE-3 | **APIManager save race condition with retry** | **High** | ✅ **FIXED** | Editor |
| CORE-4 | **GroupManager circular reference incomplete** | **High** | ✅ **FIXED** | Editor |
| CORE-5 | **LayersEditor event listener leaks** | **High** | 🟡 Reviewed OK | Editor |
| SM-1 | Canvas layer not showing in Layer Manager | Critical | ✅ Closed | Not reproducible |
| SM-5 | Exiting editor jumps back extra page | High | ✅ Closed | Not reproducible |

See detailed analysis below for each issue.

### Test Coverage (January 23, 2026)
- ✅ **9,954 Jest tests passing** — 8 new tests added for CORE-3 and CORE-4 fixes
- ✅ **All slide mode tests passing** — BackgroundLayerController has 52 tests
- ⚠️ **ViewerManager has 64.84% coverage** — significant coverage gap

### Fixes Applied (January 23, 2026)
- ✅ **SM-4 FIXED** — Added `onImageLoad` callback to slide viewers for SVG re-render
- ✅ **CORE-3 FIXED** — Added `saveInProgress` flag to prevent concurrent save operations
- ✅ **CORE-4 FIXED** — Added `isDescendantOf()` check to prevent circular folder references
- 🟡 **CORE-1 Reviewed** — `set()` correctly queues when locked; JS single-threaded, no true race
- 🟡 **CORE-5 Reviewed** — Event listeners properly cleaned up via `cleanup()` function

### Previous Fixes (January 2026)
- ✅ **Slide Mode modal editor** — slides now use modal like images, no page refresh needed
- ✅ **Canvas size controls** — SlidePropertiesPanel now integrated into LayerPanel
- ✅ **Background layer icon** — slides show color swatch instead of image icon
- ✅ **Background color picker** — clickable color swatch opens color picker dialog
- ✅ **Transparent background default** — new slides default to white (#ffffff)
- **Documentation clarity** — `canvas=WxH` behavior not well documented

---

## � BUGS FIXED (January 23, 2026)

### BUG-1: Method Name Typo in BackgroundLayerController (FIXED ✅)

**File:** [resources/ext.layers.editor/ui/BackgroundLayerController.js](resources/ext.layers.editor/ui/BackgroundLayerController.js#L450)

**Problem:** Line 450 called `this.isBackgroundVisible()` but the method is named `getBackgroundVisible()`. This caused a runtime TypeError when creating the visibility button for the Background Image layer.

**Fix:** Changed `this.isBackgroundVisible()` to `this.getBackgroundVisible()`.

### BUG-2: CSS Selector Mismatch for Visibility Button (FIXED ✅)

**File:** [resources/ext.layers.editor/ui/BackgroundLayerController.js](resources/ext.layers.editor/ui/BackgroundLayerController.js#L560)

**Problem:** Line 560 queried for `.background-visibility` but the button was created with class `background-visibility-btn` (line 453). This caused the `updateBackgroundLayerItem()` method to fail to find and update the visibility button.

**Fix:** Changed the selector from `.background-visibility` to `.background-visibility-btn`.

**Test Fixes:** Updated test selectors in `BackgroundLayerController.test.js` to use the correct class name.

---

## 🚨 SLIDE MODE ISSUES (January 23, 2026)

These issues were reported during testing and confirmed through code review:

---

### SM-1: Canvas Layer Not Showing in Layer Manager

**Severity:** Critical  
**Category:** UI/UX Bug  
**Status:** 🔴 OPEN

**Description:** In Slide Mode, the Layer Manager should display a "Canvas" layer at the bottom of the layer list (similar to how images show a "Background Image" layer). This Canvas layer is not appearing.

**Expected Behavior:**
- When editing a slide, the layer panel should show a "Canvas" item at the bottom
- This item represents the slide canvas itself
- It should be distinct from the "Background Image" layer shown when editing image layers

**Code Analysis:**
The code in `BackgroundLayerController.js` (lines 108-142) has logic for creating a Canvas layer item when in slide mode:

```javascript
// In createBackgroundLayerItem()
if ( isSlide ) {
    // For slides, create a Canvas layer with size and color controls
    return this.createCanvasLayerContent( item, t );
} else {
    // For images, use the existing background layer style
    return this.createImageBackgroundContent( item, t );
}
```

The `createCanvasLayerContent()` method exists (lines 151-175), but the issue is likely in the condition check or the `isSlideMode()` method returning false when it should return true.

**Investigation Findings (January 23, 2026):**

The config chain has been verified as CORRECT:
1. **PHP** (`SpecialEditSlide.php` lines 117-131): Sets `wgLayersEditorInit.isSlide = true` ✅
2. **EditorBootstrap.js** (lines 386-397): Passes `isSlide: init.isSlide || false` to hook ✅
3. **LayersEditor.js** (line 242): Sets `stateManager.set('isSlide', this.config.isSlide || false)` ✅
4. **BackgroundLayerController.isSlideMode()** (line 55-60): Returns `!!stateManager.get('isSlide')` ✅

**Test Coverage (January 23, 2026):**

Added 9 new unit tests in `BackgroundLayerController.test.js` verifying:
- `isSlideMode()` correctly returns `true` when `isSlide` state is true ✅
- `isSlideMode()` correctly returns `false` when `isSlide` state is false ✅
- Canvas layer item is created with correct classes (`canvas-layer-item`, `background-layer-item--slide`) ✅
- "Canvas" label is shown in slide mode (not "Background Image") ✅
- Color swatch is included in slide mode ✅
- Opacity slider is NOT included in slide mode (correct behavior) ✅
- `getSlideBackgroundColor()` returns color from state ✅
- Image mode correctly creates "Background Image" layer with opacity slider ✅

All 52 BackgroundLayerController tests pass.

**Status: CODE IS CORRECT — Needs live environment verification**

The code logic and unit tests confirm the slide mode implementation is correct. If SM-1 persists, the issue is likely:
1. A JavaScript error preventing execution (check browser console)
2. `wgLayersEditorInit` config not being sent (check browser dev tools Network/Sources)
3. A timing issue where DOM isn't ready (check ResourceLoader module dependencies)

**Remaining Potential Issues:**
- The layer list may not be rendering initially (timing/async issue)
- The first `renderLayerList()` call happens via state subscription when layers are loaded
- Need to verify with debug logging in a live environment

**Files to Examine:**
- [resources/ext.layers.editor/ui/BackgroundLayerController.js](resources/ext.layers.editor/ui/BackgroundLayerController.js#L55)
- [resources/ext.layers.editor/LayerPanel.js](resources/ext.layers.editor/LayerPanel.js#L1121)
- [resources/ext.layers.editor/LayersEditor.js](resources/ext.layers.editor/LayersEditor.js)

---

### SM-2: Canvas Layer Missing Color Swatch Display

**Severity:** High  
**Category:** UI/UX Bug  
**Status:** 🔴 OPEN

**Description:** When the Canvas layer is visible in the Layer Manager, it should display a color swatch showing the current canvas background color. This swatch is not appearing.

**Expected Behavior:**
- A 28×28px color swatch should appear in the Canvas layer row
- The swatch should display the current `slideBackgroundColor` from state
- Clicking the swatch should open the color picker dialog

**Code Analysis:**
The `createColorSwatchIcon()` method in `BackgroundLayerController.js` (lines 316-353) creates a color swatch:

```javascript
createColorSwatchIcon() {
    const t = this.msg.bind( this );
    const color = this.getSlideBackgroundColor();
    const swatchBtn = document.createElement( 'button' );
    // ... styling and event handlers
}
```

The swatch is appended in `createCanvasLayerContent()` (line 164):
```javascript
const colorSwatch = this.createColorSwatchIcon();
item.appendChild( colorSwatch );
```

**Potential Root Causes:**
1. This issue is dependent on SM-1 — if the Canvas layer item isn't created, the swatch won't appear
2. If SM-1 is fixed but swatch still missing, check that `createColorSwatchIcon()` is being called
3. CSS may be hiding the swatch element

**Dependency:** Fix SM-1 first, then verify if this issue persists.

---

### SM-3: Canvas Layer Missing W/H Properties When Selected

**Severity:** High  
**Category:** UI/UX Bug  
**Status:** 🔴 OPEN

**Description:** When the Canvas layer is selected, the properties panel should display width and height controls for resizing the slide canvas. These controls are not appearing.

**Expected Behavior:**
1. Click on the Canvas layer in the Layer Manager
2. The Properties Panel should show:
   - "Canvas" title
   - Width input field
   - Height input field
   - Background color picker

**Code Analysis:**
The `showCanvasProperties()` method in `LayerPanel.js` (lines 132-206) handles this:

```javascript
showCanvasProperties() {
    // ... clears properties panel
    // Title
    const title = document.createElement( 'h4' );
    title.textContent = t( 'layers-slide-canvas-layer', 'Canvas' );
    // Size controls
    const sizeGroup = document.createElement( 'div' );
    // ... width/height inputs created
}
```

The `selectCanvasLayer()` method in `BackgroundLayerController.js` (lines 184-220) should trigger this:

```javascript
selectCanvasLayer() {
    // ... update properties panel FIRST
    if ( this.editor.layerPanel && typeof this.editor.layerPanel.showCanvasProperties === 'function' ) {
        this.editor.layerPanel.showCanvasProperties();
    }
    // ... set state
}
```

**Potential Root Causes:**
1. Dependent on SM-1 — Canvas layer must be clickable first
2. The click handler in `createCanvasLayerContent()` may not be firing
3. `showCanvasProperties()` may be called but the properties panel cleared immediately by a state change subscriber

**Investigation Points:**
- Add console logging to `selectCanvasLayer()` to verify it's called
- Check if `showCanvasProperties()` is called
- Look for state subscribers that might clear the properties panel

**Dependency:** Fix SM-1 first, then verify.

---

### SM-4: SVG Shapes Render with Dashed Outline Boxes on Article Pages

**Severity:** Critical  
**Category:** Rendering Bug  
**Status:** � **DIAGNOSED — FIX IDENTIFIED**

**Description:** Custom SVG shapes from the Shape Library display with visible grey dashed rectangle placeholders on article pages when embedded in slides. They render correctly in the editor.

**Expected Behavior:**
- SVG shapes should render immediately without placeholder boxes
- No visible loading state should appear to users
- Shapes should look identical in the editor and article view

---

## 🔴 ROOT CAUSE IDENTIFIED (January 23, 2026)

**File:** [resources/ext.layers/viewer/ViewerManager.js](resources/ext.layers/viewer/ViewerManager.js)

The `initializeSlideViewer()` method (lines 1108-1171) and `reinitializeSlideViewer()` method (lines 262-405) both create a `LayerRenderer` **without passing an `onImageLoad` callback**:

```javascript
// initializeSlideViewer() - Around line 1155
const renderer = new LayerRenderer( ctx, {
    canvas: canvas,
    zoom: 1
    // ❌ MISSING: onImageLoad callback
});
```

Compare with `LayersViewer.js` which does it correctly:

```javascript
// LayersViewer.js - Line 227
this.renderer = new LayerRenderer( this.ctx, {
    canvas: this.canvas,
    baseWidth: this.baseWidth,
    baseHeight: this.baseHeight,
    onImageLoad: () => {          // ✅ CORRECT
        this.renderLayers();
    }
} );
```

### Why This Causes the Bug

When `CustomShapeRenderer.renderSVG()` encounters an uncached SVG:
1. It draws a grey dashed placeholder box (lines 217-224, 285-291 in CustomShapeRenderer.js)
2. It starts async loading the SVG blob
3. When loaded, it calls `_options.onLoad()` if provided
4. **Without the callback, the canvas never re-renders** — the placeholder stays visible forever

The grey dashed box is drawn by this code in `CustomShapeRenderer.js`:
```javascript
// Lines 285-291 - placeholder while loading
ctx.save();
ctx.strokeStyle = '#ccc';
ctx.lineWidth = 1;
ctx.setLineDash( [ 4, 4 ] );
ctx.strokeRect( layerX, layerY, layerWidth, layerHeight );
ctx.restore();
```

### Why It Works in the Editor

The editor has continuous re-render cycles during interaction. The placeholder flashes so quickly it's not noticeable, and subsequent renders use the cached SVG.

### Why It Fails on Article Pages (Slides)

Slides only render once via `initializeSlideViewer()`. Since no `onImageLoad` callback is provided, when the SVG finishes loading asynchronously, nothing triggers a re-render. The grey dashed placeholder drawn during the initial render stays visible forever.

---

## THE FIX

**Option 1: Add onImageLoad callback (Recommended)**

In `ViewerManager.js`, modify `initializeSlideViewer()` (around line 1155):

```javascript
const self = this;
const renderAllLayers = function() {
    ctx.clearRect( 0, 0, canvas.width, canvas.height );
    if ( !isTransparent && bgVisible ) {
        ctx.fillStyle = bgColor;
        ctx.fillRect( 0, 0, canvas.width, canvas.height );
    }
    payload.layers.forEach( function( layer ) {
        if ( layer.visible !== false && layer.visible !== 0 ) {
            renderer.drawLayer( layer );
        }
    } );
};

const renderer = new LayerRenderer( ctx, {
    canvas: canvas,
    zoom: 1,
    onImageLoad: renderAllLayers  // ✅ ADD THIS
} );

// Initial render
renderAllLayers();
```

Apply the same fix to `reinitializeSlideViewer()` (around line 385).

**Option 2: Remove placeholder drawing (Simpler alternative)**

In `CustomShapeRenderer.js`, instead of drawing a grey dashed box while loading, just return without drawing anything:

```javascript
// Lines 217-229 and 285-291 - change from:
ctx.strokeRect( layerX, layerY, layerWidth, layerHeight );

// To: just return without drawing anything
return;
```

This makes shapes appear instantly when cached and simply not appear until loaded when uncached (no ugly placeholder).

---

**Previous Analysis (superseded):**

The issue is in `CustomShapeRenderer.renderSVG()` (lines 214-295). When an SVG isn't cached, it:
1. Draws a dashed placeholder rectangle while loading
2. Creates a blob URL and Image object
3. On load, caches the image and redraws
4. Calls `_options.onLoad()` to trigger a re-render

**The Changelog Claims This Is Fixed (v1.5.26):**
```
- **SVG Custom Shapes: Dashed Placeholder Boxes on Article Pages** — Fixed...
```

But the user is still seeing this issue, indicating the fix is incomplete or regressed.

**Potential Causes:**
1. The `onImageLoad` callback may not be properly passed to `CustomShapeRenderer`
2. The viewer's `LayerRenderer` may not pass the `onLoad` option
3. The fix may only work for the editor, not the viewer

**Files to Examine:**
- [resources/ext.layers.shared/CustomShapeRenderer.js](resources/ext.layers.shared/CustomShapeRenderer.js#L285)
- [resources/ext.layers.shared/LayerRenderer.js](resources/ext.layers.shared/LayerRenderer.js) — check how it initializes CustomShapeRenderer
- [resources/ext.layers/LayersViewer.js](resources/ext.layers/LayersViewer.js) — check onImageLoad callback setup

**Recommended Fix Approach:**
1. Make the placeholder invisible (or don't draw anything while loading)
2. Pre-load SVGs before rendering the canvas
3. Ensure `onImageLoad` callback is properly wired in the viewer

---

### SM-5: Exiting Editor Jumps Back an Extra Page

**Severity:** High  
**Category:** Navigation Bug  
**Status:** 🔴 Open

**Description:** When closing the slide editor, the browser navigates back two pages instead of one, returning to a page before the article containing the slide.

**Expected Behavior:**
1. User views article with embedded slide
2. User clicks edit button on slide
3. Editor opens (adds one entry to browser history)
4. User closes editor (clicks close/X or saves and closes)
5. Browser should return to the article page (step 1)

**Actual Behavior:**
After step 4, the browser goes back to whatever page was viewed BEFORE the article, skipping the article entirely.

**Code Analysis:**
The `navigateBackToFileWithName()` method in `LayersEditor.js` (lines 1350-1415) handles navigation:

```javascript
// For slides, navigate back to the referring page or Special:Slides
const isSlide = this.stateManager && this.stateManager.get( 'isSlide' );
if ( isSlide ) {
    // IMPORTANT: In modal mode, the postMessage above already handled closing.
    // This code only runs in non-modal mode (direct URL navigation).
    
    // Use history.back() to return to the page that opened the editor
    if ( window.history && window.history.length > 1 ) {
        window.history.back();
        return;
    }
    // ...
}
```

**The Problem:**
The code calls `window.history.back()` once, which should work correctly. However, if slides are using `window.location.href` navigation to open the editor (instead of modal), the browser history may have:

1. Previous page
2. Article with slide
3. Editor page (via `window.location.href` to `Special:EditSlide`)

Then when `history.back()` is called, it goes from 3→2 (correct).

**BUT** — if there's a redirect involved (e.g., MediaWiki's action=edit redirect), or if the modal is somehow adding extra history entries, the history could look like:

1. Previous page
2. Article with slide
3. Intermediate redirect
4. Editor page

Then `history.back()` goes 4→3 (the redirect), and the redirect immediately goes 3→2→1.

**Potential Causes:**
1. Modal mode might be pushing extra history entries
2. `window.location.href` navigation might be pushing multiple entries
3. The bfcache workaround from fix #11 might be interfering
4. `postMessage` close handler in modal might also trigger `history.back()`

**Investigation Points:**
- Log `window.history.length` before and after opening editor
- Check if `postMessage` handler in the parent also does navigation
- Test with browser devtools to trace all history changes
- Check if slides use modal (`isModalMode`) or direct navigation

**Files to Examine:**
- [resources/ext.layers.editor/LayersEditor.js](resources/ext.layers.editor/LayersEditor.js#L1375)
- [resources/ext.layers.editor/editor/EditorBootstrap.js](resources/ext.layers.editor/editor/EditorBootstrap.js)
- [resources/ext.layers/init.js](resources/ext.layers/init.js) — pageshow handler
- Modal opener code in ViewerManager.js

---

## 🔴 Core Editor Issues (NEW — January 23, 2026)

The following issues were discovered during a comprehensive code review of the core editor components.

---

### CORE-1: StateManager set() Race Condition

**Severity:** Critical  
**Category:** Race Condition  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js#L75)

**Problem:** The `set()` method does NOT call `lockState()`, but `batchUpdate()` does (line 94). This means concurrent `set()` calls can interleave while `batchUpdate()` is running, defeating the purpose of the locking mechanism.

```javascript
// Lines 75-84
set( key, value ) {
    if ( this.isLocked ) {
        // Queue the operation if state is locked
        this.pendingOperations.push( { type: 'set', key: key, value: value } );
        return;
    }
    // ... sets state without locking ❌
```

**Impact:** Rapid clicks or drag operations can cause state corruption when simultaneous `set()` and `batchUpdate()` calls modify the same state.

**Recommended Fix:** Either `set()` should also use locking, or document that it's intentionally lock-free for single-key operations.

---

### CORE-2: HistoryManager Memory Leak with Large Images

**Severity:** Critical  
**Category:** Memory Leak  
**File:** [resources/ext.layers.editor/HistoryManager.js](resources/ext.layers.editor/HistoryManager.js#L184)

**Problem:** Each history entry clones all layers using `JSON.parse(JSON.stringify(...))`, including base64 image data that can be 500KB+ per layer. With 50 history entries (the max), this can consume **25MB+ of memory** for a single undo history.

```javascript
// Lines 184-194 - getLayersSnapshot()
// Fallback to JSON cloning
return JSON.parse( JSON.stringify( layers || [] ) );
```

**Additional Issue:** `hasUnsavedChanges()` (lines 594-603) serializes potentially megabytes of data just to check for changes:

```javascript
return JSON.stringify( currentLayers ) !== JSON.stringify( lastSavedLayers );
```

**Impact:** Editing images with many image layers will cause significant memory consumption and potential browser crashes.

**Recommended Fix:** 
1. Implement incremental history (store diffs instead of full snapshots)
2. Add a memory limit in addition to count limit
3. For image layers, store only the reference/ID, not the full base64 data

---

### CORE-3: APIManager Save Race Condition

**Severity:** High  
**Category:** Race Condition  
**File:** [resources/ext.layers.editor/APIManager.js](resources/ext.layers.editor/APIManager.js#L726)

**Problem:** There's no tracking of save requests. If the user clicks save twice rapidly, both saves proceed simultaneously. The retry logic compounds this problem by potentially creating even more concurrent requests.

```javascript
// Lines 726-759 - performSaveWithRetry()
this.api.postWithToken( 'csrf', payload ).then( ( data ) => {
    // ...
} ).catch( ( code, result ) => {
    if ( canRetry ) {
        this._scheduleTimeout( () => {
            this.performSaveWithRetry( payload, attempt + 1, resolve, reject );
        }, delay );
    }
```

**Impact:** Could cause duplicate saves, lost changes, or database inconsistencies.

**Recommended Fix:** Add a `saveInProgress` flag like the existing `loadInProgress` pattern used for loading operations.

---

### CORE-4: GroupManager Circular Reference Protection Incomplete

**Severity:** High  
**Category:** Logic Bug  
**File:** [resources/ext.layers.editor/GroupManager.js](resources/ext.layers.editor/GroupManager.js#L266)

**Problem:** `moveToFolder()` only checks if layer equals folder, but doesn't check if `folderId` is a child/descendant of `layerId`. This could create circular references if you move a parent folder into its own child.

```javascript
// Lines 266-328 - moveToFolder()
moveToFolder( layerId, folderId ) {
    // Don't move a folder into itself or its children
    if ( layerId === folderId ) {
        return false;
    }
    // ❌ Missing: check if folderId is a descendant of layerId
```

**Impact:** Could corrupt the layer tree and cause infinite loops in rendering.

**Recommended Fix:** Add a `isDescendant(layerId, folderId)` check before allowing the move.

---

### CORE-5: LayersEditor Event Listener Leaks

**Severity:** High  
**Category:** Memory Leak  
**File:** [resources/ext.layers.editor/LayersEditor.js](resources/ext.layers.editor/LayersEditor.js#L1413)

**Problem:** In the cancel confirmation dialog (lines 1413-1463), the `keydown` event listener is added to `document` but may not be removed if the dialog is dismissed without user interaction:

```javascript
// Lines 1413-1463
const handleKey = function ( e ) { ... };
document.addEventListener( 'keydown', handleKey );
// ...
cancelBtn.addEventListener( 'click', cleanup );
confirmBtn.addEventListener( 'click', function () { ... } );
// ❌ No cleanup if dialog is programmatically destroyed
```

**Additional Issue:** In `cleanupDOMEventListeners()` (lines 1495-1565):
```javascript
if ( this.eventTracker ) {
    this.eventTracker.destroy();
    this.eventTracker = EventTracker ? new EventTracker() : null;  // ❌ Why create new one?
}
```
Creating a new `EventTracker` in cleanup is pointless and potentially creates a memory leak.

---

### CORE-6: StateManager Dead Code

**Severity:** Medium  
**Category:** Code Quality  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js#L590)  
**Status:** ✅ FIXED

**Problem:** The `saveToHistory()` method is completely disabled but still called ~20 times throughout the codebase:

```javascript
// Lines 590-604
saveToHistory( /* action */ ) {
    // Disabled - HistoryManager handles undo/redo
    return;
    // Original code (kept for reference, unreachable):
```

The `undo()` and `redo()` methods (lines 606-625) are also dead code since `saveToHistory()` never populates the history.

**Impact:** Wasted function calls and confusing code. These methods should be removed or the feature re-enabled.

**Resolution (January 23, 2026):**
Removed the dead `undo()`, `redo()`, and `restoreState()` methods from StateManager.js. The `saveToHistory()` is kept as a no-op for backward compatibility with existing code that calls it, but all undo/redo functionality is handled by HistoryManager. Updated all tests to verify methods don't exist.

---

### CORE-7: StateManager Lock Timeout Never Recovers

**Severity:** Medium  
**Category:** Error Handling  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js#L158)  
**Status:** ✅ FIXED

**Problem:** The lock timeout sets `lockStuckSince` but this property is never read anywhere:

```javascript
// Lines 158-170
this.lockTimeout = setTimeout( () => {
    mw.log.error( '[StateManager] Lock held for >5s - possible deadlock.' );
    this.lockStuckSince = Date.now();  // ❌ Never used
}, 5000 );
```

**Impact:** If a deadlock occurs, the editor becomes permanently frozen with no recovery mechanism. Users must refresh the page.

**Recommended Fix:** Either force-unlock after timeout (risky) or provide a UI indicator and manual recovery button.

**Resolution (January 23, 2026):**
Added recovery check at the start of `lockState()` that detects and logs when recovery from a stuck lock occurs. When `lockStuckSince` is set and a new `lockState()` call succeeds, it logs the stuck duration and clears the flag. This provides observability without risky force-unlock behavior.

---

### CORE-8: Missing API Request Timeouts

**Severity:** Medium  
**Category:** Error Handling  
**File:** [resources/ext.layers.editor/APIManager.js](resources/ext.layers.editor/APIManager.js)  
**Status:** ✅ ALREADY HANDLED

**Problem:** ~~No request timeout is configured on any API calls. If the server hangs, the editor will wait indefinitely.~~

**Resolution (January 23, 2026):**
This issue was a false positive. MediaWiki's `mw.Api` already has a **default 30-second timeout** built in (see `resources/src/mediawiki.api/index.js` line 26: `timeout: 30 * 1000`).

Additionally:
- `APIErrorHandler.js` already maps the `'timeout'` error code to `'layers-timeout-error'`
- All API calls have proper `.catch()` handlers that hide spinners and display errors
- Added missing i18n messages for `layers-timeout-error` and `layers-network-error`

**No code changes needed** — the timeout handling was already in place.

---

### CORE-9: HistoryManager Bounds Check Missing

**Severity:** Medium  
**Category:** Potential Bug  
**File:** [resources/ext.layers.editor/HistoryManager.js](resources/ext.layers.editor/HistoryManager.js#L249)  
**Status:** ✅ FIXED

**Problem:** In `undo()`, if `historyIndex` is modified between the `canUndo()` check and accessing `this.history[this.historyIndex]`, the state could be undefined:

```javascript
undo() {
    if ( this.isDestroyed || !this.canUndo() ) {
        return false;
    }
    this.historyIndex--;
    const state = this.history[ this.historyIndex ];  // Could be undefined
    this.restoreState( state );  // Will crash if state is undefined
```

**Recommended Fix:** Verify `state` exists before calling `restoreState()`.

**Resolution (January 23, 2026):**
Added defensive bounds check in both `undo()` and `redo()` methods. If the state at the computed index is undefined, the method logs an error, restores the index to its previous value, and returns `false`. Added 4 unit tests to verify graceful handling of corrupted history.

---

### CORE-10: Inconsistent Layer Cloning Methods

**Severity:** Medium  
**Category:** Code Quality  

**Problem:** Layer cloning uses inconsistent methods across the codebase:
- `JSON.parse(JSON.stringify(layer))` — StateManager, HistoryManager, TransformController
- `DeepClone.clone()` — GroupManager
- `Object.assign({}, layer)` — some UI components

**Impact:** Different cloning methods have different behaviors (functions dropped, shallow vs deep, undefined handling).

**Recommended Fix:** Standardize on `DeepClone.clone()` or document when each is appropriate.

---

### CORE-11: Hardcoded Magic Numbers

**Severity:** Low  
**Category:** Code Quality  

**Problem:** Various hardcoded values scattered throughout:
- Lock timeout: 5000ms (StateManager.js line 42)
- Max history: 50 (HistoryManager.js)
- Debounce delays: 300ms (multiple files)
- Max nesting depth: 3 (GroupManager.js line 33)
- Max children per group: 100 (GroupManager.js line 34)
- LRU cache size: 50 (ImageLoader.js)
- Retry delays: 1000ms (APIManager.js)
- Default shape size: 100 (LayersEditor.js line 722)

**Recommended Fix:** Consolidate in `LayersConstants.js` or make configurable.

---

## 🔴 Critical Issues (4 of 7 FIXED in January 2026)

### ~~1. SLIDE MODE: No Modal Editor Integration~~ ✅ FIXED

**Status:** FIXED in January 2026  
**Fix Location:** `resources/ext.layers/viewer/ViewerManager.js` - `openSlideEditor()` now uses `LayersEditorModal`

**NOTE:** While the modal integration was reportedly fixed, the new SM-5 issue (exiting jumps back extra page) suggests the navigation logic may still have problems.

~~**Severity:** Critical~~  
~~**Category:** Architectural Issue / Poor UX~~

**Original Issue:** When editing a slide (`{{#Slide: ...}}`), clicking the edit button navigates to `Special:EditSlide` using `window.location.href` instead of opening a modal editor like images do.
1. Slides require a full page refresh to see changes after closing the editor
2. Current workaround uses `pageshow` event to detect bfcache restoration, but this is fragile
3. User experience is inconsistent between images and slides

**Code Location:**
- `resources/ext.layers/viewer/ViewerManager.js` line 1463: `window.location.href = editUrl;`
- Compare with `resources/ext.layers/viewer/ViewerOverlay.js` line 368 which uses `LayersEditorModal`

**Root Cause:** The slide editor was designed as a separate Special page rather than reusing the modal editor pattern from images. The modal approach provides:
- Seamless save→refresh experience
- No navigation away from the article
- Callback mechanism to refresh viewers on close

**Recommendation:** ~~Refactor `openSlideEditor()` to use `LayersEditorModal` with an iframe to `Special:EditSlide`, similar to how images work. This would unify the UX and eliminate the bfcache workaround.~~ **DONE**

---

### 2. ~~SLIDE MODE: Missing Canvas Size Controls in Editor~~ ✅ FIXED

**Status:** FIXED in January 2026  
**Fix Location:** `resources/ext.layers.editor/LayerPanel.js` - Added `initSlidePropertiesPanel()` method

~~**Severity:** Critical~~  
~~**Category:** Missing Feature~~

**Original Issue:** While `SlidePropertiesPanel.js` exists with canvas dimension inputs (lines 218-269), these controls are not accessible in the main editor UI. Users cannot resize a slide canvas after creation without directly editing database values.

**Impact:** 
- ~~Users cannot change canvas dimensions in the editor~~ **NOW FIXED**
- The `canvas=WxH` wikitext parameter only works on initial slide creation (by design)
- ~~Once a slide exists in the database, its dimensions are locked unless edited via database~~ **NOW FIXED**

**Code Evidence:**
- `SlidePropertiesPanel.js` has `createDimensionsRow()` method with width/height inputs
- `LayerPanel.js` now calls `initSlidePropertiesPanel()` to show this panel in slide mode

**Current Behavior:**
- First parse: `canvas=600x400` creates slide with those dimensions
- Subsequent parses: Dimensions are loaded from database, `canvas=` is ignored
- No UI control in editor to change dimensions

**Recommendation:** 
1. Ensure `SlidePropertiesPanel` is visible and functional in the editor toolbar/sidebar
2. Add a "Canvas Size" button to the toolbar that opens a resize dialog
3. When dimensions change, properly resize canvas and mark document dirty

---

### 3. ~~SLIDE MODE: Background Layer Has Incorrect Icon~~ ✅ FIXED

**Status:** FIXED in January 2026  
**Fix Location:** `resources/ext.layers.editor/ui/BackgroundLayerController.js` - Added `isSlideMode()` and `createColorSwatchIcon()`

~~**Severity:** Medium~~  
~~**Category:** UI/UX Inconsistency~~

**Original Issue:** In the layer panel, the background layer displays an "image icon" (landscape with mountains) which is appropriate for image-backed layers but nonsensical for slides that have a solid color background.

**Fix Applied:** Added `isSlideMode()` detection. In slide mode, `createColorSwatchIcon()` creates a clickable color swatch showing the current background color instead of the image icon.

~~**Recommendation:** Detect slide mode via `stateManager.get('isSlide')` and show a different icon (e.g., a solid rectangle or paint bucket icon) when editing a slide vs an image.~~ **DONE**

---

### 4. ~~SLIDE MODE: Background Layer Missing Color Picker~~ ✅ FIXED

**Status:** FIXED in January 2026  
**Fix Location:** `resources/ext.layers.editor/ui/BackgroundLayerController.js` - Added `openColorPicker()` and `setSlideBackgroundColor()`

~~**Severity:** High~~  
~~**Category:** Missing Feature~~

**Original Issue:** The background layer item in the layer panel shows only:
- Visibility toggle
- Name ("Background Image" — also wrong for slides)
- Opacity slider
- Lock icon

**Fix Applied:** 
- Added clickable color swatch icon (shows current background color)
- Added `openColorPicker()` method that shows an OOUI color picker dialog
- Added `setSlideBackgroundColor()` to update state and redraw canvas
- Color swatch updates automatically when background color changes

**Code Location:** `BackgroundLayerController.createBackgroundLayerItem()` lines 78-116

**Current Controls:**
1. Icon (image icon - wrong for slides)
2. Visibility button ✓
3. Name label ✓
4. Opacity slider ✓
5. Lock icon ✓
6. ❌ NO color swatch/picker

**Recommendation:** For slide mode, add a clickable color swatch next to the name that opens the color picker dialog (similar to how layer fill colors work).

---

### 5. SLIDE MODE: Background Layer Shows Delete Button (UNCONFIRMED)

**Severity:** Low (if confirmed)  
**Category:** UI Bug

**User Report:** The background layer reportedly shows a delete icon.

**Investigation:** Based on code review, `BackgroundLayerController.createBackgroundLayerItem()` does NOT add a delete button. The method appends only:
- iconArea, visibilityBtn, name, opacityContainer, lockIcon

**Possible Causes:**
1. CSS styling issue making another element look like a delete button
2. User confusion with lock icon
3. Old cached version of the extension

**Recommendation:** Verify in browser dev tools. If delete button exists, trace its origin. The LayerItemFactory does add delete buttons to regular layers, so there may be a CSS leak.

---

### 6. ~~SLIDE MODE: Newly Created Slides Have Transparent Background~~ ✅ FIXED

**Status:** FIXED in January 2026  
**Fix Location:** `resources/ext.layers.editor/LayersEditor.js` line 248

~~**Severity:** High~~  
~~**Category:** Configuration Bug~~

**Original Issue:** When creating a new slide, the background defaults to `transparent` even though the server config `LayersSlideDefaultBackground` is set to `#ffffff`.

**Fix Applied:** Changed the JavaScript fallback from `'transparent'` to `'#ffffff'`:
```javascript
// OLD: this.stateManager.set( 'slideBackgroundColor', this.config.backgroundColor || 'transparent' );
// NEW: this.stateManager.set( 'slideBackgroundColor', this.config.backgroundColor || '#ffffff' );
```

~~**Recommendation:** Change JS fallback to `this.config.backgroundColor || '#ffffff'`~~ **DONE**

---

### 7. SLIDE MODE: `canvas=WxH` Parameter Ignored After First Parse

**Severity:** Medium  
**Category:** Expected Behavior (but poorly documented)

**Description:** The `canvas=WxH` wikitext parameter is ONLY used when creating a new slide. If the slide already exists in the database, the dimensions are loaded from DB and the wikitext parameter is ignored.

**Code Evidence:** `SlideHooks.php` lines 100-117:
```php
if ( !empty( $params['canvas'] ) ) {
    // Explicit canvas= param takes priority
    $dimensions = self::parseCanvasDimensions( $params['canvas'], $config );
    // ...
} else {
    // No explicit canvas param - try to get saved dimensions from database
    $savedDimensions = self::getSavedSlideDimensions( $slideName, $layerSetName );
    // ...
}
```

**Design Intent:** This is actually intentional — the database is the source of truth after initial creation. However:
1. This behavior is not documented for users
2. There's no way to resize a slide after creation
3. The wikitext becomes misleading (shows old dimensions)

**Recommendation:**
1. Document this behavior clearly in wikitext syntax documentation
2. Add canvas size controls to the editor (see Issue #2)
3. Consider a "force" parameter like `canvas=600x400|force` for advanced users

---

### 8. ViewerManager.js — 64.84% Coverage (Critical Gap)

**Severity:** High  
**Category:** Test Coverage Gap  
**File:** [resources/ext.layers/viewer/ViewerManager.js](resources/ext.layers/viewer/ViewerManager.js)

**Description:** ViewerManager is a 1,810-line critical component with only 64.84% line coverage. Uncovered lines include:
- Lines 937-1090 (~153 lines) — substantial functionality untested
- Lines 1176-1430 (~254 lines) — major code paths untested
- Various error handling paths

**Impact:** This is the core viewer component that renders layers on article pages. Insufficient testing increases regression risk.

**Recommendation:** Add tests for the uncovered code paths, particularly slide-related functionality.

---

## 🟠 High Severity Issues

### 9. Memory Leak: Untracked setTimeout Calls

**Severity:** High  
**Category:** Memory Leak  
**Files:** PropertyBuilders.js, LayerPanel.js, PropertiesForm.js, SpecialSlides.js

**Description:** Many `setTimeout` calls for debouncing are not tracked or cleared on component destruction:
```javascript
// Pattern found multiple times - no cleanup
setTimeout(() => {
    this.updateUI();
}, 300);
```

If a component is destroyed before the timeout fires, callbacks may execute on stale state or cause errors.

**Recommendation:** Create a `TimeoutTracker` utility or use the existing pattern from `APIManager._scheduleTimeout()`.

---

### 10. Memory Leak: Event Listeners Not Cleaned Up

**Severity:** High  
**Category:** Memory Leak  
**Files:** LayersEditorModal.js, SpecialSlides.js

**Description:** 
- `LayersEditorModal` adds `keydown` and `message` event listeners that ARE cleaned up in `close()`, but the modal doesn't have a `destroy()` method for cleanup if closed abnormally.
- `SpecialSlides.js` binds jQuery events with `.on()` but has NO destroy/cleanup method whatsoever.

**Recommendation:** Add explicit destroy methods to both components.

---

### 11. State Lock Timeout May Cause Corruption

**Severity:** High  
**Category:** Race Condition  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js#L172)

**Description:** The 5-second forced unlock timeout in `lockState()` could cause state corruption if a legitimate slow operation is still in progress:
```javascript
this.lockTimeout = setTimeout( () => {
    mw.log.warn( '[StateManager] Force unlocking state after timeout' );
    this.unlockState();  // Force unlock - potentially dangerous
}, 5000 );
```

**Recommendation:** Instead of force-unlocking, log an error and leave the state locked. Provide a manual recovery mechanism.

---

### 12. XSS Risk in SpecialSlides.js

**Severity:** High  
**Category:** Security  
**File:** [resources/ext.layers.slides/SpecialSlides.js](resources/ext.layers.slides/SpecialSlides.js)

**Description:** While `mw.html.escape()` is used for most user content, the pattern of building HTML strings and using `$list.html(html)` is fragile:
```javascript
const name = mw.html.escape( slide.name );
// ... more escaping ...
html += `<div class="layers-slide-item" data-name="${ name }">`;
this.$list.html( html );
```

If ANY field is missed or the escaping is inconsistent, XSS is possible.

**Recommendation:** Use DOM construction methods instead of HTML string building, or use a templating system that auto-escapes.

---

## 🟡 Medium Severity Issues

### 13. Documentation Metric Inconsistencies

**Severity:** Medium  
**Category:** Documentation  

**Description:** Metrics are inconsistent across documentation files:
- `codebase_review.md` previously reported 9,951 tests, 93.52% coverage
- `improvement_plan.md` reports 9,951 tests, 93.52% coverage  
- Actual run shows **9,902 tests, 92.59% coverage**
- README badge says "9,951 passing" but that's outdated

**Files with outdated metrics:**
- README.md (badge: 9,951 tests)
- wiki/Home.md (9,951 tests)
- improvement_plan.md (9,951 tests, 93.52%)
- copilot-instructions.md (9,951 tests)

**Recommendation:** Automate metric updates or run verification before releases.

---

### 14. Inconsistent Layer Cloning Methods

**Severity:** Medium  
**Category:** Code Quality

**Description:** Layer cloning uses inconsistent methods across the codebase:
- `JSON.parse(JSON.stringify(layer))` — StateManager, HistoryManager, TransformController
- `DeepClone.clone()` — GroupManager
- `Object.assign({}, layer)` — some UI components

**Impact:** Different cloning methods have different behaviors:
- `JSON.parse/stringify` drops functions and undefined values
- `Object.assign` is shallow only
- `DeepClone.clone()` handles both deep and shallow with edge cases

**Recommendation:** Standardize on `DeepClone.clone()` or document when each is appropriate.

---

### 15. i18n Author Placeholder Not Updated

**Severity:** Medium  
**Category:** Documentation  
**File:** [i18n/en.json](i18n/en.json)

**Description:** The i18n file metadata still shows:
```json
"@metadata": {
    "authors": [
        "Your Name"
    ]
}
```

**Recommendation:** Update to actual author name(s).

---

### 16. Missing Destroy Method in EmojiPickerPanel

**Severity:** Medium  
**Category:** Memory Leak  
**File:** resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js

**Description:** EmojiPickerPanel creates IntersectionObservers and DOM elements but has no `destroy()` method. If the picker is opened/closed multiple times, observers may accumulate.

---

### 17. Hardcoded Magic Numbers

**Severity:** Medium  
**Category:** Code Quality

**Description:** Various hardcoded values scattered throughout:
- Lock timeout: 5000ms (StateManager.js)
- Max history: 50 (HistoryManager.js)
- Debounce delays: 300ms (multiple files)
- LRU cache size: 50 (ImageLoader.js)
- Retry delays: 1000ms (APIManager.js)

**Recommendation:** Consolidate in `LayersConstants.js` (which exists but doesn't contain all these values).

---

## 🟢 Low Severity Issues

### 18. Console Statements in Build Scripts

**Severity:** Low  
**Category:** Code Quality

**Description:** Build scripts (generate-library.js, sanitize-svgs.js) use `console.log` directly. This is appropriate for CLI tools but inconsistent with the rest of the codebase which uses `mw.log`.

---

### 19. Test File eslint-disable Comments

**Severity:** Low  
**Category:** Code Quality

**Description:** Some test files have blanket `eslint-disable` comments:
- `tests/jest/tools/TextToolHandler.test.js` — `/* eslint-disable no-unused-vars */`
- `tests/jest/tools/PathToolHandler.test.js` — `/* eslint-disable no-unused-vars */`
- `tests/jest/SpecialSlides.test.js` — `/* eslint-disable no-unused-vars */`

**Recommendation:** Use more targeted line-specific disables or refactor to avoid the need.

---

### 20. Missing ARIA Attributes on Dynamic Inputs

**Severity:** Low  
**Category:** Accessibility  
**File:** [resources/ext.layers.editor/ui/PropertyBuilders.js](resources/ext.layers.editor/ui/PropertyBuilders.js)

**Description:** Dynamically created input elements lack:
- `aria-describedby` linking to help text
- `aria-invalid` for validation state
- Consistent labeling patterns

---

## ✅ Recently Fixed Issues

### BUG: Slide Viewers Partially Refresh After Editor Close (January 24, 2026)

**Severity:** Critical → Workaround Applied  
**Status:** ⚠️ PARTIAL FIX — Root cause not addressed  
**Version:** 1.5.25

**Original Symptom:** When editing a slide (`{{#Slide: ...}}`), closing the editor required a full page refresh to see changes.

**Root Cause:** Slides use `window.location.href` navigation while images use a modal editor. Browser bfcache restoration doesn't re-execute JavaScript.

**Current Workaround:** Added `pageshow` event listener in `init.js` that detects bfcache restoration and calls `refreshAllViewers()`.

**Why This Is Not a Full Fix:** The bfcache workaround is fragile and browser-dependent. Not all browsers support bfcache, and the detection mechanism (`event.persisted`) may not work in all scenarios. The proper fix is to make slides use the modal editor like images do (see Issue #1 above).

---

## What's Working Well ✅

### Security
- CSRF protection on all write endpoints (layerssave, layersdelete, layersrename)
- Rate limiting via MediaWiki's pingLimiter system
- Server-side property whitelist with 50+ validated fields in ServerSideLayerValidator
- Text sanitization, color validation, path traversal prevention
- SQL injection protection via parameterized queries throughout LayersDatabase

### Architecture
- Clean separation: PHP backend (storage/API), JS frontend (editor/viewer)
- Registry pattern for dependency management in LayersEditor (ModuleRegistry)
- Controller/Facade pattern in CanvasManager (delegates to 10+ controllers)
- Shared rendering code between editor and viewer (LayerRenderer, ShapeRenderer, etc.)
- ES6 classes throughout (100% migration complete)

### Test Coverage
- 92.59% statement coverage — excellent for this complexity
- 83.02% branch coverage — strong edge case coverage
- 9,902 tests in 155 suites — comprehensive
- Performance benchmarks in test suite
- Good separation of unit, integration tests

### Features
- **15 drawing tools** all working correctly
- **1,310 shapes** in Shape Library (ISO 7010, IEC 60417, etc.)
- **2,817 emoji** in Emoji Picker
- Named layer sets with version history
- Layer folders with visibility cascading
- Style presets with import/export
- Curved arrows, gradient fills, blur effects
- Full keyboard accessibility
- Dark mode support (Vector 2022)

---

## God Class Inventory (≥ 1,000 lines)

**Total:** 20 files (3 generated, 17 hand-written)

### Generated Data (Exempt from Refactoring)

| File | Lines | Purpose |
|------|-------|---------|
| EmojiLibraryData.js | 26,277 | Emoji metadata |
| ShapeLibraryData.js | 11,299 | Shape definitions |
| EmojiLibraryIndex.js | 3,003 | Search index |

### Hand-Written Code

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| CanvasManager.js | 2,011 | ⚠️ WATCH | At 2K threshold |
| ViewerManager.js | 1,946 | ⚠️ CRITICAL | **Missing onImageLoad in slide viewer (SM-4)**, only 64.84% tested |
| Toolbar.js | 1,848 | ✅ OK | Delegates to 4 modules |
| LayerPanel.js | 1,806 | ✅ OK | Delegates to 9 controllers |
| LayersEditor.js | 1,768 | ⚠️ ISSUES | **Event listener leaks (CORE-5)** |
| APIManager.js | 1,492 | ⚠️ ISSUES | **Save race condition (CORE-3)**, no timeouts |
| SelectionManager.js | 1,432 | ✅ OK | Delegates to 3 modules |
| ArrowRenderer.js | 1,310 | ✅ OK | Complex curve math |
| CalloutRenderer.js | 1,291 | ✅ OK | Speech bubble rendering |
| PropertyBuilders.js | 1,284 | ✅ OK | UI property builders |
| InlineTextEditor.js | 1,258 | ✅ OK | Figma-style editing |
| ToolManager.js | 1,224 | ✅ OK | Delegates to handlers |
| GroupManager.js | 1,133 | ⚠️ ISSUES | **Circular reference incomplete (CORE-4)** |
| CanvasRenderer.js | 1,132 | ✅ OK | Delegates to SelectionRenderer |
| TransformController.js | 1,110 | ✅ OK | Resize/rotate transforms |
| ResizeCalculator.js | 1,105 | ✅ OK | Shape-specific math |
| ToolbarStyleControls.js | 1,099 | ✅ OK | Style controls |
| PropertiesForm.js | 1,001 | ✅ OK | Just crossed threshold |

---

## Recommendations by Priority

### P0 (Critical — Immediate)

1. **SM-4: Fix SVG grey dashed boxes** — Add `onImageLoad` callback to `initializeSlideViewer()` and `reinitializeSlideViewer()` in ViewerManager.js (root cause identified, fix documented above)
2. **CORE-1: Fix StateManager set() race condition** — Either add locking to set() or document intentional behavior
3. **CORE-2: Fix HistoryManager memory leak** — Implement incremental history or add memory limits for image layers
4. **CORE-3: Fix APIManager save race condition** — Add `saveInProgress` tracking like load operations

### P1 (High — Next Sprint)

1. **SM-1: Debug Canvas layer in live environment** — Verify `isSlide` state is being set correctly
2. **CORE-4: Fix GroupManager circular reference** — Add descendant check in moveToFolder()
3. **CORE-5: Fix LayersEditor event listener leaks** — Clean up document listeners on dialog close
4. **SM-5: Fix editor exit navigation** — Trace history entries during slide editor open/close
5. Increase ViewerManager.js test coverage from 64.84% to >85%
6. Add `destroy()` methods to EmojiPickerPanel

### P2 (Medium — Next Milestone)

1. ~~**CORE-6:** Remove StateManager dead code (saveToHistory, undo, redo methods)~~ ✅ FIXED
2. ~~**CORE-7:** Add lock timeout recovery mechanism or UI indicator~~ ✅ FIXED
3. ~~**CORE-8:** Add explicit API request timeouts~~ ✅ Already handled by mw.Api default
4. ~~**CORE-9:** Add HistoryManager bounds check in undo()~~ ✅ FIXED
5. **CORE-10:** Standardize layer cloning on `DeepClone.clone()`
6. **CORE-11:** Consolidate magic numbers in LayersConstants.js
7. SM-2/SM-3: Verify color swatch and W/H properties work after SM-1 is fixed
8. Document `canvas=WxH` behavior (only works on first parse)
9. Add ARIA attributes to dynamic form inputs
10. Update i18n author metadata

### P3 (Long-Term)

1. Incremental history system (store diffs instead of snapshots)
2. OffscreenCanvas/WebGL rendering path
3. Real-time collaboration architecture
4. Incremental TypeScript migration
5. Automated visual regression tests
6. Virtualize layer list for 50+ layer sets

---

## Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent CSRF, validation, rate limiting |
| Test Coverage | 8.0/10 | 25% | 92.59% overall but ViewerManager gap; no tests for race conditions |
| Functionality | 6.0/10 | 25% | **Slide Mode bugs + core race conditions** |
| Architecture | 7.0/10 | 15% | Good delegation, but race conditions and memory leaks |
| Documentation | 8.0/10 | 10% | Good but some inconsistencies |

**Weighted Total: 7.23/10 → Overall: 7.2/10**

**Note:** Score reduced from 7.8 to 7.2 due to newly discovered core issues (race conditions, memory leaks, missing callbacks).

---

## ESLint-Disable Audit

**Production Code: 9 eslint-disable comments** (all legitimate)

| File | Disable | Reason |
|------|---------|--------|
| LayerSetManager.js | no-alert | Prompt for new set name |
| UIManager.js (×3) | no-alert | Prompt for set operations |
| PresetDropdown.js (×2) | no-alert | Prompt for preset name |
| ImportExportManager.js | no-alert | Import confirmation |
| RevisionManager.js | no-alert | Revert confirmation |
| APIManager.js | no-control-regex | Control character sanitization |

**Test Files: 4 blanket disables** (should be reduced)

---

## Appendix: Verification Commands

```bash
# Verify branch and uncommitted files
git status

# Run tests with coverage
npm run test:js -- --coverage --silent

# Get coverage summary
npm run test:js -- --coverage --silent 2>&1 | grep -E "All files"

# JS file count
find resources -name "*.js" ! -path "*/dist/*" ! -path "*scripts*" | wc -l

# Find files with low coverage
npm run test:js -- --coverage 2>&1 | grep -E "^\s+\w.*\|\s+[0-6][0-9]\."
```

---

*Review performed on `main` branch, January 23, 2026.*  
*Critical findings: Slide Mode has 5 open issues — Canvas layer not showing, missing color swatch, missing W/H properties, SVG dashed boxes on article pages, and navigation jumping back extra page.*  
*Rating: 7.8/10 — Production-ready for image layers, but Slide Mode needs fixes before GA release.*

---

## Appendix: Slide Mode Issue Summary

For quick reference, here are all Slide Mode issues identified in this review:

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| SM-1 | Canvas layer not showing in Layer Manager | Critical | ✅ Closed | Not reproducible - user confirmed working |
| SM-2 | Canvas layer missing color swatch | High | 🔴 Open | Depends on SM-1 |
| SM-3 | Canvas layer missing W/H properties | High | 🔴 Open | Depends on SM-1 |
| SM-4 | SVG shapes show dashed boxes on articles | Critical | 🔴 Open | Changelog claims fixed but regressed |
| SM-5 | Exiting editor jumps back extra page | High | ✅ Closed | Not reproducible - user confirmed working |
| 1 | No modal editor — requires page refresh | Critical | ✅ Fixed | But SM-5 suggests navigation issues remain |
| 2 | Missing canvas size controls in editor | Critical | ✅ Fixed | Code exists but depends on SM-1 |
| 3 | Background layer shows wrong icon for slides | Medium | ✅ Fixed | Code exists but depends on SM-1 |
| 4 | Background layer missing color picker | High | ✅ Fixed | Code exists but depends on SM-1 |
| 5 | Background layer shows delete button (unconfirmed) | Low | ❓ Needs Verification | Likely CSS issue |
| 6 | Newly created slides default to transparent | High | ✅ Fixed | |
| 7 | `canvas=WxH` ignored after first parse | Medium | By Design | Needs docs |

**Root Cause:** Multiple fixes were implemented for Slide Mode but appear to be incomplete or have regressed. The core issue is that `isSlide` state may not be properly set when the editor initializes in slide mode, causing all the conditional slide-specific UI elements to not render.

**Recommended Investigation Order:**
1. **SM-1 first** — Verify `isSlide` is set in StateManager when editing a slide
2. **SM-4 second** — Debug the CustomShapeRenderer onLoad callback chain in the viewer
3. **SM-5 third** — Trace history entries during slide editor open/close cycle

---

## Appendix: Code Quality Issues (Non-Slide)

### Memory Leaks
- `setTimeout` calls in PropertyBuilders.js, LayerPanel.js, PropertiesForm.js not tracked
- `EmojiPickerPanel` creates IntersectionObservers without cleanup
- `SpecialSlides.js` has no destroy method

### Security
- XSS risk in SpecialSlides.js HTML string building pattern

### Test Coverage
- `ViewerManager.js` has only 64.84% coverage despite being 1,810 lines

### Documentation
- Metrics inconsistent across files (test counts, coverage percentages)
- i18n author placeholder not updated
