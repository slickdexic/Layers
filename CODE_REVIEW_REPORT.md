# JavaScript Frontend Code Review Report

**Date:** June 2025  
**Scope:** All JavaScript files under `resources/ext.layers.editor/` and `resources/ext.layers.shared/`  
**Focus:** Security, logic bugs, state management, memory leaks, race conditions, rendering correctness

---

## Triage & Resolution Summary (July 2025)

All 16 findings were triaged against the current codebase. 3 real issues were fixed; 13 were classified as safe, already fixed, or not bugs.

| # | Finding | Verdict | Notes |
|---|---------|---------|-------|
| 1 | HelpDialog innerHTML with msg() | **Safe** | `mw.message().text()` returns admin-controlled i18n strings, not user input |
| 2 | ShapeLibraryPanel SVG innerHTML | **Safe** | SVG data is from bundled static `ShapeLibraryData.js`, not user-supplied |
| 3 | EmojiPickerPanel SVG innerHTML | **Safe** | SVG data is from bundled static `emoji-bundle.json`, not user-supplied |
| 4 | Boolean `visible !== false` missing `!== 0` | **FIXED** | Added `&& visible !== 0` defense at all 17 locations across 13 files |
| 5 | ClipboardController.cutSelected reads editor.layers | **OK** | Uses stateManager with fallback; bridge property keeps in sync |
| 6 | ZoomPanController reads editor.layers | **OK** | Read-only; bridge property keeps in sync |
| 7 | Arrow key conflict CanvasEvents/EventManager | **Already fixed** | Fixed in v54 audit (P2-126) — CanvasEvents now checks for selected layers |
| 8 | TransformController direct mutation | **Intentional** | Performance trade-off; saves state on mouseup; documented |
| 9 | Map iteration deletion | **Not a bug** | ECMAScript spec explicitly allows Map deletion during `for...of` iteration |
| 10 | loadRevisionById missing isLoading | **FIXED** | Added `isLoading` set/clear matching `loadLayersBySetName()` pattern |
| 11 | HelpDialog tab innerHTML | **Safe** | Same as #1 — `mw.message().text()` is admin-controlled |
| 12 | Paste renders with editor.layers | **OK** | Bridge property in sync; layers just set via stateManager on prior line |
| 13 | CSS parentheses in escapeCSSValue | **Safe** | Server validates all color values; client-side is defense-in-depth |
| 14 | data-font-size not validated numeric | **FIXED** | Added `parseFloat()` guard; also fixed `textStrokeWidth` interpolation |
| 15 | ClipboardController no destroy() | **OK** | Delegates lifecycle to CanvasManager which handles cleanup |
| 16 | Arrow keys consumed for panning | **Already fixed** | Same as #7 — fixed in v54 audit |

---

## CRITICAL — Security Issues

### 1. XSS via innerHTML in HelpDialog.js (line 405)

**File:** `resources/ext.layers.editor/editor/HelpDialog.js`  
**Line:** 405  
**Severity:** HIGH (stored XSS if i18n keys are ever user-controlled or return unsanitized content)

```js
nameRow.innerHTML = `<strong>${tool.name}</strong> <kbd>${tool.key}</kbd>`;
```

`tool.name` and `tool.key` come from `msg()`, which calls `mw.message()`. While MediaWiki message values are normally admin-controlled, the pattern of interpolating into `innerHTML` without escaping is unsafe. If any message value contains `<img onerror=...>` or similar, this is exploitable. Nearby `panel.innerHTML = content` at lines 264 and 565 also use template literals with `msg()` return values, creating the same risk across the entire help dialog.

**Suggested fix:** Use `textContent` for text data, or escape with `mw.html.escape()`:

```js
nameRow.innerHTML = `<strong>${mw.html.escape(tool.name)}</strong> <kbd>${mw.html.escape(tool.key)}</kbd>`;
```

Or build DOM elements instead of innerHTML.

---

### 2. SVG injection in ShapeLibraryPanel.js (line 639)

**File:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js`  
**Line:** 639  
**Severity:** MEDIUM (SVG data comes from bundled ShapeLibraryData.js, but no sanitization)

```js
preview.innerHTML = svgContent;
```

The `svgContent` is the shape's SVG string with only regex-based ID uniquification (replacing `id="..."` and `url(#...)` references). No actual SVG sanitization is performed — `<script>` tags, event handler attributes (`onload`, `onerror`), or `<foreignObject>` elements within the SVG would execute. The data currently comes from a trusted static file, but if the shape library ever accepts user-contributed shapes, this becomes exploitable.

**Suggested fix:** Parse through DOMParser and strip dangerous elements/attributes (similar to what `ValidationManager.sanitizeSvgString()` already does for other SVG input):

```js
const sanitized = this.editor.validationManager.sanitizeSvgString(svgContent);
preview.innerHTML = sanitized;
```

---

### 3. SVG injection in EmojiPickerPanel.js (line 559)

**File:** `resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js`  
**Line:** 559  
**Severity:** MEDIUM (emoji SVGs from bundled JSON, but no sanitization)

```js
temp.innerHTML = svg;
```

And at line 529:
```js
thumb.innerHTML = svgContent;
```

Emoji SVG data is loaded from `emoji-bundle.json` and inserted as raw HTML. While the bundle is currently a static trusted file, there's no defense-in-depth sanitization of the SVG content before DOM insertion.

**Suggested fix:** Apply the same SVG sanitization used elsewhere, or at minimum parse via DOMParser and validate the SVG structure before insertion.

---

## HIGH — Logic Bugs and State Management Issues

### 4. Boolean visibility (`visible !== false`) inconsistency across files

**File:** Multiple files  
**Severity:** HIGH (documented postmortem bug that has resurfaced 3 times)

Per the copilot-instructions.md, the API returns `0`/`1` integers for boolean fields. The code is inconsistent in handling this:

**Files using ONLY `!== false` (missing `!== 0` check — BUG):**
- [InlineTextEditor.js](resources/ext.layers.editor/canvas/InlineTextEditor.js#L193): `layer.visible !== false`
- [ExportController.js](resources/ext.layers.editor/ExportController.js#L149): `layer.visible !== false`
- [LayersEditor.js](resources/ext.layers.editor/LayersEditor.js#L755): `layerData.visible !== false`
- [LayersEditor.js](resources/ext.layers.editor/LayersEditor.js#L777): `layerData.visible !== false`
- [CanvasRenderer.js](resources/ext.layers.editor/CanvasRenderer.js#L420): `layer.visible !== false`
- [CanvasRenderer.js](resources/ext.layers.editor/CanvasRenderer.js#L463): `layer.visible !== false`
- [CanvasManager.js](resources/ext.layers.editor/CanvasManager.js#L1411): `layer.visible !== false`
- [StateManager.js](resources/ext.layers.editor/StateManager.js#L529): `layerData.visible !== false`
- [SelectionState.js](resources/ext.layers.editor/selection/SelectionState.js#L124): `layer.visible !== false`
- [FolderOperationsController.js](resources/ext.layers.editor/ui/FolderOperationsController.js#L373): `layer.visible !== false`
- [LayerItemFactory.js](resources/ext.layers.editor/ui/LayerItemFactory.js#L279): `layer.visible !== false`
- [LayerListRenderer.js](resources/ext.layers.editor/ui/LayerListRenderer.js#L375): `layer.visible !== false`

**Files correctly using BOTH checks:**
- [RenderCoordinator.js](resources/ext.layers.editor/canvas/RenderCoordinator.js#L210): `layer.visible !== false && layer.visible !== 0`
- [SelectionManager.js](resources/ext.layers.editor/SelectionManager.js#L179): `layer.visible !== false && layer.visible !== 0`

When the API returns `visible: 0`, the `!== false` check evaluates to `true` (0 is not false in strict equality), so the layer is treated as **visible** when it should be **hidden**. The `LayerDataNormalizer` is supposed to fix this at load time, but if any code path bypasses normalization, these checks silently break.

**Impact:** Layers set to invisible via the API will appear visible in the canvas renderer, export, selection filtering, and layer panel — the core display path.

**Suggested fix:** Either (a) ensure ALL data passes through `LayerDataNormalizer` at every entry point and add a regression test, or (b) fix every `!== false` to also check `!== 0`:
```js
const isVisible = layer.visible !== false && layer.visible !== 0;
```

---

### 5. `cutSelected()` reads `editor.layers` directly, bypassing StateManager

**File:** `resources/ext.layers.editor/canvas/ClipboardController.js`  
**Line:** 167  
**Severity:** MEDIUM (could cause stale data or missed state updates)

```js
const remaining = editor.layers.filter( ( layer ) => {
    return !ids.includes( layer.id );
} );
```

The `cutSelected()` method reads the layers array from `editor.layers` directly instead of `editor.stateManager.getLayers()`. This bypasses the StateManager's version tracking and could return stale data if another operation modified the layers through StateManager. Compare to `paste()` at line 107 which correctly uses:

```js
const currentLayers = editor.stateManager ?
    editor.stateManager.getLayers() : editor.layers;
```

**Suggested fix:** Use the same pattern as `paste()`:
```js
const currentLayers = editor.stateManager ?
    editor.stateManager.getLayers() : editor.layers;
const remaining = currentLayers.filter( ( layer ) => !ids.includes( layer.id ) );
```

---

### 6. `ZoomPanController.zoomToFitLayers()` reads `editor.layers` directly

**File:** `resources/ext.layers.editor/canvas/ZoomPanController.js`  
**Line:** 274  
**Severity:** LOW (read-only usage, but inconsistent with data access patterns)

```js
const layer = this.manager.editor.layers[ i ];
```

And at line 268:
```js
if ( !this.manager.editor || this.manager.editor.layers.length === 0 ) {
```

The method bypasses `stateManager.getLayers()` and reads the layers array via the legacy `editor.layers` property. While a bridge property exists, this is fragile and could miss state updates.

---

### 7. Arrow key conflict between CanvasEvents and EventManager

**File:** `resources/ext.layers.editor/CanvasEvents.js` (lines 594-613) and `resources/ext.layers.editor/EventManager.js`  
**Severity:** MEDIUM (double handling of arrow keys)

In `CanvasEvents.handleKeyDown()`, arrow keys (without Ctrl) are handled as pan operations:

```js
case 'ArrowUp':
    e.preventDefault();
    cm.panY += panDistance;
    cm.updateCanvasTransform();
    break;
```

But per the copilot instructions, `EventManager.js` also handles arrow keys for **nudging selected layers** (1px or 10px with Shift). Both handlers call `e.preventDefault()`. The behavior depends on event propagation order — if CanvasEvents fires first, the arrow keys will always pan instead of nudging, even when a layer is selected. There's no check for whether a layer is selected before consuming the key event.

**Suggested fix:** In `CanvasEvents.handleKeyDown()`, check if a layer is selected before handling arrow keys for panning. If a layer is selected, let the event propagate to EventManager for nudging:

```js
case 'ArrowUp':
    // Don't pan if a layer is selected (EventManager handles nudge)
    if ( cm.getSelectedLayerId && cm.getSelectedLayerId() ) {
        return; // Let EventManager handle nudge
    }
    e.preventDefault();
    cm.panY += panDistance;
    cm.updateCanvasTransform();
    break;
```

---

### 8. TransformController mutates layer objects directly during resize/rotation

**File:** `resources/ext.layers.editor/canvas/TransformController.js`  
**Lines:** 220-250 (handleResize), 330-360 (handleRotation), 480-560 (handleDrag)  
**Severity:** MEDIUM (bypasses StateManager, causes state inconsistency)

During drag/resize/rotation, the TransformController mutates layer properties directly:

```js
// handleResize (line ~220)
Object.keys( updates ).forEach( ( key ) => {
    layer[ key ] = updates[ key ];
});

// handleRotation (line ~340)
layer.rotation = ( this.originalLayerState.rotation || 0 ) + degrees;

// handleDrag/updateLayerPosition (line ~590+)
layer.x = ( originalState.x || 0 ) + deltaX;
layer.y = ( originalState.y || 0 ) + deltaY;
```

These mutations bypass `StateManager.updateLayer()`, which means:
1. State change listeners are not notified during the transform
2. The state version counter is not incremented
3. Any code that checks state freshness may get stale results

The `finishResize()`/`finishRotation()`/`finishDrag()` methods call `editor.saveState()` for undo, but the state listeners still miss the intermediate updates. This is an intentional performance trade-off (avoiding state notifications on every mouse move), but it's worth documenting explicitly.

---

## MEDIUM — Potential Issues

### 9. `_invalidateCache` iterates Map while deleting entries

**File:** `resources/ext.layers.editor/APIManager.js`  
**Line:** ~215  
**Severity:** LOW (works in practice in current JS engines, but fragile)

```js
_invalidateCache( filename ) {
    if ( !filename ) {
        this.responseCache.clear();
        return;
    }
    for ( const key of this.responseCache.keys() ) {
        if ( key.startsWith( filename + ':' ) ) {
            this.responseCache.delete( key );
        }
    }
}
```

Per the ECMAScript specification, deleting entries from a Map during iteration with `for...of` over `.keys()` is technically safe (the spec explicitly allows it), so this is **not a bug**. However, it's a common source of confusion and could be made more readable:

```js
const keysToDelete = [...this.responseCache.keys()].filter(k => k.startsWith(filename + ':'));
keysToDelete.forEach(k => this.responseCache.delete(k));
```

---

### 10. `loadRevisionById` doesn't clear `isLoading` on rejection path

**File:** `resources/ext.layers.editor/APIManager.js`  
**Line:** ~630  
**Severity:** MEDIUM (can leave UI in loading state)

In `loadRevisionById()`, the initial `loadLayers()` method properly sets/clears `isLoading` state. But `loadRevisionById()` shows a spinner but never sets `stateManager.set('isLoading', true)`. Compare to `loadLayersBySetName()` which does:

```js
if ( this.editor.stateManager ) {
    this.editor.stateManager.set( 'isLoading', true );
}
```

If `loadRevisionById` fails, there's no `isLoading = false` cleanup, and the `InteractionController.shouldBlockInteraction()` check (which reads `isLoading`) might not properly block/unblock interactions.

**Suggested fix:** Add `isLoading` state management to `loadRevisionById()` matching the pattern in `loadLayersBySetName()`.

---

### 11. HelpDialog builds entire tabs with unescaped template literals into innerHTML

**File:** `resources/ext.layers.editor/editor/HelpDialog.js`  
**Lines:** 264, 565  
**Severity:** MEDIUM (all msg() values flow into innerHTML)

The `renderOverview()` and `renderTips()` methods build large HTML strings with embedded `msg()` calls:

```js
const content = `
    <h3>${msg( 'layers-help-overview-title', 'Getting Started' )}</h3>
    <p>${msg( 'layers-help-overview-intro', '...' )}</p>
    ...
`;
panel.innerHTML = content;
```

Every `msg()` fallback value and every i18n message value is injected directly into the HTML string without escaping. While the fallback strings are hardcoded and safe, the i18n values from `i18n/en.json` are typically admin-controlled. If any translation contains HTML entities or injection payloads, it would execute.

**Suggested fix:** Either (a) use DOM creation APIs, or (b) pass all msg() values through `mw.html.escape()` before interpolation.

---

### 12. Paste operation renders using `editor.layers` instead of StateManager

**File:** `resources/ext.layers.editor/canvas/ClipboardController.js`  
**Line:** 140  
**Severity:** LOW (minor inconsistency)

```js
cm.renderLayers( editor.layers );
```

After pasting, the render call uses `editor.layers` directly instead of the StateManager. The layers were just set via `editor.stateManager.set('layers', newLayers)` on the line above, so the bridge property should be in sync, but for consistency it should use:

```js
const layers = editor.stateManager ? editor.stateManager.getLayers() : editor.layers;
cm.renderLayers( layers );
```

---

## LOW — Code Quality and Robustness

### 13. RichTextConverter.escapeCSSValue allows parentheses (potential CSS injection)

**File:** `resources/ext.layers.editor/canvas/RichTextConverter.js`  
**Line:** ~60  
**Severity:** LOW (defense-in-depth concern)

```js
static escapeCSSValue( value ) {
    return String( value ).replace( /["'<>&;{}\\]/g, '' );
}
```

The comment says "KEEP parentheses for valid CSS functions like rgb(), rgba(), hsl()". However, allowing parentheses means CSS functions like `url()` and `expression()` (IE) could potentially be injected through color values. The server performs its own sanitization, so this is defense-in-depth only.

**Suggested fix:** If the intent is to support color functions, explicitly validate against an allowlist of CSS function names rather than allowing arbitrary parentheses:

```js
// Only allow known safe CSS functions
const safeValue = String(value).replace(/["'<>&;{}\\]/g, '');
if (/\b(?!rgb|rgba|hsl|hsla)\w+\s*\(/i.test(safeValue)) {
    return safeValue.replace(/\([^)]*\)/g, '');
}
return safeValue;
```

---

### 14. InlineTextEditor._createEditor sets innerHTML with richTextToHtml output

**File:** `resources/ext.layers.editor/canvas/InlineTextEditor.js`  
**Line:** 548  
**Severity:** LOW (data comes from layer model, which was loaded from API and normalized)

```js
contentWrapper.innerHTML = RichTextConverter.richTextToHtml( layer.richText, this._displayScale );
```

The `richTextToHtml()` method does escape text content via `escapeHtml()` (using `textContent` → `innerHTML` pattern), and CSS values are sanitized via `escapeCSSValue()`. This is reasonably safe because:
1. Text content is escaped
2. Style attribute values have dangerous chars stripped
3. The data ultimately comes from the server which performs its own validation

However, the `data-font-size` attribute is constructed with a numeric value from `style.fontSize` which isn't validated as numeric:

```js
dataAttrs.push( `data-font-size="${ style.fontSize }"` );
```

If `style.fontSize` somehow contains `" onmouseover="alert(1)`, it could break out of the attribute. The server's whitelist validation should prevent this, but a `parseFloat()` guard would be prudent.

---

### 15. No `destroy()` method on ClipboardController

**File:** `resources/ext.layers.editor/canvas/ClipboardController.js`  
**Severity:** LOW (minor memory concern)

Unlike other controllers (TransformController, ZoomPanController, etc.), ClipboardController has no `destroy()` method. It holds references to `canvasManager` and the `clipboard` array. While the clipboard array is just data, the reference to `canvasManager` could prevent garbage collection if the controller outlives the editor.

**Suggested fix:**
```js
destroy() {
    this.clipboard = [];
    this.canvasManager = null;
}
```

---

### 16. CanvasEvents arrow key handler consumes all arrow keys for panning

**File:** `resources/ext.layers.editor/CanvasEvents.js`  
**Lines:** 594-613  
**Severity:** LOW (but see #7 above for the conflict)

When no Ctrl/Meta key is pressed, arrow keys always trigger canvas panning. This means in any mode where the user might expect arrow keys to work differently (e.g., text editing in the properties panel, or navigating the layer panel list), the canvas event handler would steal the keypress. The `e.target` tag check at the top only excludes `INPUT`, `TEXTAREA`, and `contentEditable` elements — but doesn't exclude the layer panel or other custom UI elements.

---

## Summary

| # | Issue | Severity | Category | Status |
|---|-------|----------|----------|--------|
| 1 | HelpDialog innerHTML with msg() values | HIGH | XSS | Safe — admin i18n |
| 2 | ShapeLibraryPanel unsanitized SVG innerHTML | MEDIUM | XSS | Safe — static data |
| 3 | EmojiPickerPanel unsanitized SVG innerHTML | MEDIUM | XSS | Safe — static data |
| 4 | Boolean `visible !== false` missing `!== 0` in 12 files | HIGH | Logic Bug | **FIXED** |
| 5 | ClipboardController.cutSelected reads editor.layers directly | MEDIUM | State Management | OK — bridge synced |
| 6 | ZoomPanController reads editor.layers directly | LOW | State Management | OK — bridge synced |
| 7 | Arrow key conflict between CanvasEvents and EventManager | MEDIUM | Logic Bug | Already fixed (v54) |
| 8 | TransformController mutates layers bypassing StateManager | MEDIUM | State Management | Intentional |
| 9 | Map iteration during deletion in _invalidateCache | LOW | Code Quality | Not a bug |
| 10 | loadRevisionById missing isLoading state management | MEDIUM | Race Condition | **FIXED** |
| 11 | HelpDialog tab content built with unescaped msg() | MEDIUM | XSS | Safe — admin i18n |
| 12 | Paste renders with editor.layers instead of StateManager | LOW | State Management | OK — bridge synced |
| 13 | escapeCSSValue allows parentheses (CSS injection risk) | LOW | Security | Safe — server validates |
| 14 | data-font-size attribute not validated as numeric | LOW | Security | **FIXED** |
| 15 | No destroy() on ClipboardController | LOW | Memory Leak | OK — delegated |
| 16 | Arrow keys consumed for panning regardless of context | LOW | UX Bug | Already fixed (v54) |
