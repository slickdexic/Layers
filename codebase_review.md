# Layers MediaWiki Extension — Codebase Review

**Review Date:** February 15, 2026 (v42 fresh audit)
**Version:** 1.5.58
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** main
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions, 95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~97,072 lines) *(excludes dist/)*
- **PHP production files:** 40 in `src/` (~14,991 lines)
- **Jest test suites:** 162 files (~11,148 test cases)
- **PHPUnit test files:** 31
- **i18n message keys:** 820 (in en.json, all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)
- **eslint-disable directives:** 18 (all legitimate)
- **God classes (>1,000 lines):** 17 (2 generated data files, 13 hand-written JS, 2 PHP)

---

## Executive Summary

The v42 review is a fully independent, line-level audit of the entire codebase performed on the main branch at version 1.5.57. Every finding has been verified against actual source code with specific file and line-number evidence. False positives from sub-agent reviews were filtered through dedicated verification passes.

**Methodology:** Six parallel sub-agent reviews (PHP API modules, PHP core/validation/hooks, JS core editor modules, JS canvas controllers, JS renderers/shared, JS UI/toolbar/viewer), followed by targeted cross-verification confirming each finding against source code. Documentation files reviewed separately for accuracy.

### Key Strengths (Genuine)
1. **High Test Coverage:** 95.19% statement coverage across 160 test files
2. **Server-Side Validation:** ServerSideLayerValidator is thorough (110+ properties, strict whitelist, numeric constraints)
3. **Modern Architecture:** 100% ES6 classes, facade/controller delegation patterns
4. **CSRF Protection:** All write endpoints require tokens via `api.postWithToken('csrf', ...)`
5. **SQL Parameterization:** All database queries parameterized via MediaWiki's RDBMS abstraction
6. **Defense in Depth:** TextSanitizer, ColorValidator, property whitelist, LayerDataNormalizer, SVG element blocklist
7. **Transaction Safety:** Atomic with retry/backoff and FOR UPDATE
8. **Rate Limiting Infrastructure:** All 5 API endpoints support rate limiting (via RateLimiter.php + User::pingLimiter())
9. **IM Injection Protection:** Shell::command escapes all args; `@` prefix stripped from text inputs
10. **CSP via MW API:** EditLayersAction prefers addExtraHeader(), raw header() only as guarded fallback
11. **Font Sanitization:** sanitizeIdentifier() strips fontFamily to `[a-zA-Z0-9_.-]` at save time (top-level and richText runs)
12. **Renderer Context Cascading:** ShapeRenderer.setContext() propagates to PolygonStarRenderer automatically
13. **WikitextHooks State Reset:** resetPageLayersFlag() resets all 6 static properties + 6 singletons on each page render
14. **Boolean Serialization:** preserveLayerBooleans() robustly handles MW API's boolean serialization behavior
15. **Deep Clone for History:** HistoryManager uses DeepClone.js cloneLayersEfficient() with proper nested object handling
16. **DraftManager Storage Safety:** localStorage writes wrapped in try/catch; base64 image data proactively stripped

### Previously Open Issues

180 issues from v22–v40 are resolved. 10 items from v41 were marked as "✅ Fixed v41" in documentation but 1 critical fix was never committed (CacheInvalidationTrait.php — see CRITICAL-v42-1).

### Key Weaknesses (NEW in v42 — ALL VERIFIED)

#### Critical / Show-Stopping

- **CacheInvalidationTrait.php missing from disk:** Three API modules (Save, Delete, Rename) `use CacheInvalidationTrait` but the file does not exist, causing a PHP fatal error on any write operation. The v41 KNOWN_ISSUES.md claims this was "✅ Fixed v41" but the trait file was never committed.

- **ApiLayersInfo null dereference:** When no layers exist for an image, `$layerSet` is null but the code at line 280 still tries to access `$layerSet['name']`, causing PHP warnings/TypeError.

#### Security

- **ThumbnailRenderer fontFamily not re-validated:** While `sanitizeIdentifier()` strips at save time, ThumbnailRenderer passes font names directly to ImageMagick's `-font` flag without secondary validation against the allowed fonts whitelist.

#### Rendering

- **CustomShapeRenderer spread shadow ignores rotation AND scale:** Only copies translation (e,f) from transform, unlike ShadowRenderer which properly decomposes rotation. Visual bug for rotated custom shapes.
- **CalloutRenderer blur bounds ignore dragged tail position:** Uses tailDirection property rather than actual tailTipX/tailTipY.
- **ThumbnailRenderer textbox stroke bleeds into text:** Missing stroke reset before text drawing.
- **ThumbnailRenderer missing ellipse shadow:** Ellipse is the only shape without shadow support in the server renderer.

#### Logic / State

- **Arrow keys always pan, never nudge:** No layer nudge functionality exists at all. Selected layers cannot be repositioned via keyboard.
- **Color preview mutates layers directly:** applyColorPreview() bypasses StateManager entirely. No undo/rollback capability.
- **Double render on undo/redo:** EventManager.handleUndo/handleRedo calls renderLayers() and markDirty() after the HistoryManager already does both.
- **AlignmentController missing dimension/marker types:** Dimension layers (x1/y1/x2/y2) and marker arrows fall through to wrong coordinate model.
- **ClipboardController applies paste offset to local coordinates:** tailTipX/tailTipY are center-relative but receive PASTE_OFFSET.
- **Timestamp parsing assumes local timezone:** parseMWTimestamp() uses local Date constructor instead of Date.UTC() for MediaWiki UTC timestamps.

#### Code Quality

- **Dead code: CanvasRenderer layer cache (~140 lines):** layerCache infrastructure defined but never called.
- **StyleController double-applies properties:** Three redundant passes over properties.
- **Duplicate sanitizeLogMessage in 3 files.**
- **Hardcoded English strings in ToolbarKeyboard.js.**

### Issue Summary (February 15, 2026 — v42 Fresh Audit)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Infrastructure | 1 | 0 | 0 | 0 | Missing trait file |
| Bugs | 0 | 3 | 5 | 5 | Null deref, rendering, logic |
| Security | 0 | 1 | 0 | 0 | Font re-validation |
| Code Quality | 0 | 0 | 3 | 8 | Dead code, duplication |
| Documentation | 0 | 0 | 2 | 5+ | Stale metrics, false claims |
| **Total** | **1** | **4** | **10** | **18+** | **33+ items** |

**Overall Grade: B+** (strong foundation; excellent test coverage; critical infrastructure bug with missing trait file blocks all write operations; multiple rendering inconsistencies between client and server; good security posture with defense-in-depth)

---

## Confirmed False Positives (v24–v42)

| Report | Claimed Issue | Why It's False |
|--------|---------------|----------------|
| v42 | SmartGuidesController rightSnap guard no-op | While \|a-b\| === \|b-a\| makes the outer guard always true, the inner comparisons still produce correct snap behavior |
| v42 | DrawingController ellipse finalization uses stale center | Preview and finalize produce identical math results; fragile but correct |
| v42 | $fileName undefined in catch block | Actually uses `$requestedFilename` which IS defined; checked ApiLayersSave L382 |
| v42 | BoundsCalculator misidentifies layer type | getRectangularBounds checks for width/height, ellipses don't have these; types don't collide |
| v42 | ContextMenuController hover listener leak | Menu DOM is recreated each show, old DOM gets GC'd with listeners |
| v42 | ImportExportManager prototype pollution | `JSON.parse` produces plain objects; `__proto__` on parsed object is an own property that doesn't affect prototype chain |
| v41 | isComplexityAllowed() broken | LayersMaxComplexity IS registered in extension.json |
| v41 | Viewport culling wrong property names | getLayerBounds returns {left, top, right, bottom} correctly |
| v39 | ClipboardController paste() saveState before mutation breaks undo | saveState() BEFORE mutation is the correct undo pattern |
| v39 | htmlToRichText innerHTML XSS risk | Detached element (never in DOM); source is user's own contentEditable content |
| v39 | document.execCommand deprecation risk | Only practical way for contentEditable; all browsers support it |
| v39 | HistoryManager getMemoryUsage() performance hazard | Only called on-demand/debug |
| v38 | innerHTML for SVG icons is XSS | Hardcoded trusted strings, not user data |
| v38 | StateManager.saveToHistory() dead code | Intentionally disabled for consistency |
| v37 | ColorPickerDialog JSON.parse missing try-catch | getSavedColors() HAS try-catch |
| v37 | PresetStorage JSON.parse missing try-catch | load() HAS try-catch |
| v37 | RichTextConverter innerHTML XSS risk | escapeHtml() used; styles are CSS-only |
| v36 | DraftManager missing QuotaExceededError catch | saveDraft() wrapped in try/catch |
| v35 | isLayerInViewport uses wrong property names | getLayerBounds returns correct props |
| v35 | HistoryManager shallow snapshot | Uses DeepClone.cloneLayersEfficient() |
| v35 | ApiLayersSave rate limit after validation | Intentional — invalid data shouldn't consume tokens |
| v33 | NamespaceHelper null caching prevents late-load | Intentional: Map.has() for cached null |
| v33 | EditLayersAction getImageBaseUrl() unused | Called at L164 |
| v33 | Map mutation during iteration | ES6 permits deletion during Map.keys() |
| v29 | AlignmentController missing dimension/marker | Partially valid — default x/y case works for basic positioning but misses endpoint/arrow coords; RECLASSIFIED as real issue MED-v42-5 |
| v28 | PolygonStarRenderer missing from setContext() | ShapeRenderer cascades to it |
| v28 | Non-atomic batch deletion N undo entries | StateManager.saveToHistory() is a no-op |
| v28 | ThumbnailRenderer font not re-validated | sanitizeIdentifier() strips at save |
| v28 | WikitextHooks static state fragile | resetPageLayersFlag() called per page |
| v28 | CSP uses raw header() | Prefers addExtraHeader(); raw is guarded |
| v28 | ShapeRenderer.drawRectangle missing scaling | CSS transform handles scaling |
| v27 | IM color injection via ThumbnailRenderer | Shell::command escapes each arg |
| v27 | CSP header injection | $fileUrl from File::getUrl() |
| v27 | Retry on all errors in DB save | Only isDuplicateKeyError() retried |
| v27 | isLayerEffectivelyLocked stale layers | Getter delegates to StateManager |
| v27 | StateManager.set() locking inconsistency | Correct lock pattern |
| v24 | TypeScript compilation failure | Pure JS project |
| v24 | Event Binding Loss | Verified working correctly |

---

## NEW Issues — v42

### CRITICAL (New in v42)

#### CRITICAL-v42-1: CacheInvalidationTrait.php Missing — All Write APIs Broken

**Status:** Open
**Severity:** CRITICAL (Show-stopping — PHP fatal error)
**Files:** src/Api/ApiLayersSave.php L9+L67, src/Api/ApiLayersDelete.php L8+L40, src/Api/ApiLayersRename.php L8+L41, src/Api/Traits/ (missing file)

**Issue:** All three write API modules (`ApiLayersSave`, `ApiLayersDelete`, `ApiLayersRename`) declare `use CacheInvalidationTrait` and call `$this->invalidateCachesForFile($title)` after successful operations. However, the file `src/Api/Traits/CacheInvalidationTrait.php` does NOT exist on disk. PHP's autoloader will fail when any of these classes is instantiated, producing a fatal error.

The v41 review documented this as "✅ Fixed v41" in KNOWN_ISSUES.md (P1-033), claiming the trait was "Extracted cache invalidation to shared trait, added calls to both Delete and Rename API modules." This fix was **never committed** — the trait file was never created.

**Evidence:**
```
$ ls src/Api/Traits/
ForeignFileHelperTrait.php  LayerSaveGuardsTrait.php
LayersApiHelperTrait.php    LayersContinuationTrait.php
# CacheInvalidationTrait.php is MISSING

$ grep -n "CacheInvalidationTrait" src/Api/ApiLayersSave.php
9:use MediaWiki\Extension\Layers\Api\Traits\CacheInvalidationTrait;
67:     use CacheInvalidationTrait;
```

**Result:** Any attempt to save, delete, or rename layers will fail with a PHP fatal error: "Trait 'MediaWiki\Extension\Layers\Api\Traits\CacheInvalidationTrait' not found." The entire write API is non-functional.

**Recommended Fix:** Create `src/Api/Traits/CacheInvalidationTrait.php` with the `invalidateCachesForFile()` method. Based on the call pattern in ApiLayersSave.php line 338, it should purge the file's page cache and queue HTMLCacheUpdateJob for backlink pages. The implementation should match what was previously inline in ApiLayersSave.php before the trait extraction.

---

### HIGH (New in v42)

#### HIGH-v42-1: ApiLayersInfo Null Dereference on Line 280

**Status:** Open
**Severity:** HIGH (Bug — PHP warning/TypeError)
**File:** src/Api/ApiLayersInfo.php L280

**Issue:** When no layers exist for an image (`$layerSet` is null from line 252 branch), the code at line 280 attempts `$layerSet['name']` on a null value. In PHP 8+, accessing an array index on null triggers a TypeError.

```php
// Line 249: sets $result with layerset => null when !$layerSet
if ( !$layerSet ) {
    $result = [ 'layerset' => null, 'message' => ... ];
} else {
    $result = ['layerset' => $layerSet];
}

// Line 280: BUG — $layerSet may be null here
$currentSetName = $layerSet['name'] ?? $layerSet['setName'] ?? null;
```

**Recommended Fix:** Wrap the revision-fetching block (lines 280-310) in `if ( $layerSet ) { ... }`.

**Resolution:** ✅ FIXED — Restructured the code so that when `$layerSet` is null, the code uses a general revision fetch, and when `$layerSet` exists, it accesses `$layerSet['name']` safely inside the else block.

---

#### ~~HIGH-v42-2: Arrow Keys Always Pan, Never Nudge Selected Layers~~ ✅ RESOLVED

**Status:** ✅ RESOLVED
**Severity:** HIGH (Broken feature — expected UX missing)
**File:** resources/ext.layers.editor/EventManager.js

**Issue:** Arrow keys unconditionally pan the canvas. There is no check for whether layers are selected, and EventManager has no nudge handler. Every drawing/annotation tool (Figma, Photoshop, Illustrator, etc.) uses arrow keys to nudge selected objects by 1px (or 10px with Shift). The current behavior makes precise keyboard positioning impossible.

**Resolution:** ✅ FIXED — Implemented `handleArrowKeyNudge()` and `nudgeSelectedLayers()` methods in EventManager.js:
- Arrow keys (← → ↑ ↓) nudge selected layers by 1px
- Shift + Arrow keys nudge by 10px
- Locked layers are protected from nudging
- Proper history snapshots recorded for undo/redo
- Status bar updates for single layer selections
- 17 new tests added to EventManager.test.js

---

#### HIGH-v42-3: Color Preview Mutates Layers Without StateManager

**Status:** Open
**Severity:** HIGH (Bug — breaks undo/redo)
**File:** resources/ext.layers.editor/ToolbarStyleControls.js L522-563

**Issue:** `applyColorPreview()` directly writes to layer objects (`layer.fill = color`, `layer.stroke = color`) without going through StateManager. This means:
- Changes are not tracked by HistoryManager (no undo/redo)
- If the user cancels the color picker, the layer retains the preview color with no rollback mechanism
- StateManager subscribers are not notified

Similar issues exist in `FolderOperationsController.toggleLayerVisibility` and `StyleController.applyToLayer`.

**Recommended Fix:** Store original colors before preview, restore on cancel, commit via StateManager on confirm.

---

#### HIGH-v42-4: ThumbnailRenderer Font Name Not Validated Against Whitelist

**Status:** Open
**Severity:** HIGH (Security — defense-in-depth gap)
**File:** src/ThumbnailRenderer.php (buildTextArguments, buildTextBoxArguments)

**Issue:** Font names from layer data are passed directly to ImageMagick's `-font` flag. While `sanitizeIdentifier()` strips to `[a-zA-Z0-9_.-]` at save time, ThumbnailRenderer performs no secondary validation against the configured `$wgLayersDefaultFonts` whitelist. If data bypasses the validator (e.g., direct DB manipulation, or a bug in sanitization), an arbitrary font path could reach ImageMagick.

**Recommended Fix:** Validate `$layer['fontFamily']` against the configured fonts whitelist in ThumbnailRenderer before passing to ImageMagick. Fall back to 'DejaVu-Sans' if not in whitelist.

---

### MEDIUM (New in v42)

#### MED-v42-1: Double Render on Every Undo/Redo Operation

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Performance bug)
**Files:** resources/ext.layers.editor/EventManager.js L140-165, resources/ext.layers.editor/HistoryManager.js L307-322

**Issue:** `EventManager.handleUndo()` and `handleRedo()` called `editor.renderLayers()` and `editor.markDirty()` after undo/redo succeeds. But `HistoryManager.restoreState()` (called by `editor.undo()`) already calls `canvasMgr.renderLayers(restored)` (line 309) and `editor.markDirty()` (line 322). Every undo/redo triggered two full canvas renders and two dirty marks.

**Resolution:** Removed redundant `renderLayers()` and `markDirty()` calls from EventManager's `handleUndo()` and `handleRedo()`. The methods now just call `editor.undo()` and `editor.redo()` respectively, letting HistoryManager.restoreState() handle rendering. Updated 6 related tests to verify the new behavior.

---

#### MED-v42-2: CustomShapeRenderer Spread Shadow Ignores Rotation/Scale

**Status:** Open
**Severity:** MEDIUM (Rendering bug)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** `drawSpreadShadowForImage()` only copies translation (e, f) from the transform matrix, discarding rotation and scale:

```javascript
if ( currentTransform ) {
    tempCtx.setTransform( 1, 0, 0, 1, currentTransform.e, currentTransform.f );
}
```

ShadowRenderer was fixed to properly decompose transforms, but this fix was never ported to CustomShapeRenderer.

**Recommended Fix:** Use the same rotation decomposition approach as ShadowRenderer.drawSpreadShadow, or delegate to ShadowRenderer directly.

---

#### MED-v42-3: ThumbnailRenderer TextBox Stroke Bleeds Into Text

**Status:** Open
**Severity:** MEDIUM (Rendering bug — server-side)
**File:** src/ThumbnailRenderer.php (buildTextBoxArguments)

**Issue:** After drawing the rectangle with `-stroke` and `-strokewidth`, the text annotate inherits these settings. Text renders with the rectangle's stroke color/width applied as an outline.

**Recommended Fix:** Insert `'-stroke', 'none', '-strokewidth', '0'` before the text `-annotate` arguments.

---

#### MED-v42-4: ThumbnailRenderer Missing Ellipse Shadow Support

**Status:** Open
**Severity:** MEDIUM (Rendering inconsistency — server-side)
**File:** src/ThumbnailRenderer.php (buildEllipseArguments)

**Issue:** `buildEllipseArguments()` is the only shape handler that doesn't implement shadow rendering. All others (rectangle, circle, text, textbox, polygon, star) support shadows.

**Recommended Fix:** Add the standard shadow pattern from `buildCircleArguments()`.

---

#### MED-v42-5: AlignmentController Missing Dimension/Marker Types

**Status:** Open
**Severity:** MEDIUM (Bug — alignment broken for 2 layer types)
**File:** resources/ext.layers.editor/canvas/AlignmentController.js

**Issue:** `moveLayer()` has no case for `dimension` layers (which use x1/y1/x2/y2 endpoints) or marker layers with arrows (arrowX/arrowY). Dimension layers fall through to the default case which moves `layer.x` — but dimensions don't use x/y for positioning. When aligning dimension layers, endpoints don't move correctly.

Similarly, `getLayerBounds()` has no case for dimension layers, producing incorrect bounds for alignment calculations.

Note: This was previously dismissed as a false positive in v29 ("Default case sets x/y which both use"). However, dimension layers use x1/y1/x2/y2 for their endpoints, NOT x/y. The v29 dismissal was incorrect. Reclassified as a real issue.

**Recommended Fix:** Add dimension case: move x1/y1 and x2/y2 by delta. Add marker arrow case: also move arrowX/arrowY.

---

#### MED-v42-6: ClipboardController Paste Offset on Local Coordinates

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Bug — pasted callouts have displaced tails)
**File:** resources/ext.layers.editor/canvas/ClipboardController.js L253-257

**Issue:** `applyPasteOffset()` added `PASTE_OFFSET` (20px) to `tailTipX` and `tailTipY`. These are stored in local coordinates relative to the callout center. The world-space offset was already applied via `layer.x` and `layer.y`, so the additional tail offset displaced the tail relative to the callout body by 20px.

**Resolution:** Removed `tailTipX`/`tailTipY` offset from applyPasteOffset(). These coordinates are center-relative and move with the callout automatically when layer.x/y change. Added explanatory comments.

---

#### MED-v42-7: parseMWTimestamp Uses Local Time Instead of UTC

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Bug — timestamps display wrong for non-UTC users)
**File:** resources/ext.layers.editor/LayerSetManager.js L119-138

**Issue:** MediaWiki timestamps are UTC, but `new Date(year, month, day, hour, minute, second)` created a local-time Date object. Revision timestamps displayed offset by the user's timezone from the correct time.

**Resolution:** Changed to `new Date(Date.UTC(year, month, day, hour, minute, second))` so timestamps are correctly interpreted as UTC. Updated tests to use `getUTC*()` methods to verify behavior.

---

#### MED-v42-8: CalloutRenderer Blur Bounds Ignore Dragged Tail

**Status:** Open
**Severity:** MEDIUM (Rendering bug)
**File:** resources/ext.layers.shared/CalloutRenderer.js

**Issue:** When a callout has `fill='blur'` and uses a draggable tail, the blur capture bounds use the `tailDirection` property rather than the actual `tailTipX`/`tailTipY` position. The blur effect gets clipped when the tail is dragged to a different side than tailDirection indicates.

**Recommended Fix:** When tailTipX/tailTipY are set, compute bounds from actual tip coordinates.

---

#### MED-v42-9: CSS Font Shorthand Order Wrong in InlineTextEditor

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (Bug — text measurement may be inaccurate)
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js L815-819

**Issue:** Canvas font string was constructed with fontWeight before fontStyle. CSS spec requires: `font-style font-variant font-weight font-size/line-height font-family`. Most canvas implementations are lenient, but this could cause incorrect text measurement in strict engines.

**Resolution:** Swapped fontStyle and fontWeight in the concatenation to follow CSS spec order.

---

#### MED-v42-10: Hardcoded English in ToolbarKeyboard.js

**Status:** ✅ RESOLVED
**Severity:** MEDIUM (i18n violation)
**File:** resources/ext.layers.editor/ToolbarKeyboard.js

**Issue:** User-visible strings "Layers grouped", "Layers ungrouped", "Smart Guides: On", "Smart Guides: Off" were hardcoded English instead of `mw.message()` calls.

**Resolution:** Added 4 new i18n messages (layers-group-success, layers-ungroup-success, layers-smart-guides-on, layers-smart-guides-off) and updated ToolbarKeyboard.js to use mw.message() with English fallbacks for non-MediaWiki environments.

---

### LOW (New in v42)

#### LOW-v42-1: ~140 Lines Dead Layer Cache Code in CanvasRenderer

**Status:** Open
**Severity:** LOW (Dead code)
**File:** resources/ext.layers.editor/CanvasRenderer.js

**Issue:** `layerCache`, `_getCachedLayer`, `_setCachedLayer`, `invalidateLayerCache`, `layerCacheMaxSize`, `layerCacheEnabled` are defined but never called from the rendering pipeline.

---

#### LOW-v42-2: StyleController.updateStyleOptions Triple-Applies Properties

**Status:** Open
**Severity:** LOW (Redundant code)
**File:** resources/ext.layers.editor/StyleController.js L85-144

**Issue:** First checks individual properties (lines 95-120), then Object.keys forEach overwrites ALL (line 123), then checks shadow properties again (lines 131-143). Three redundant passes.

---

#### LOW-v42-3: Duplicate sanitizeLogMessage in 3 Files

**Status:** Open
**Severity:** LOW (Code duplication)
**Files:** LayersEditor.js, APIErrorHandler.js, ValidationManager.js

**Recommended Fix:** Extract to a shared utility module.

---

#### LOW-v42-4: SelectionManager Boolean Handling Inconsistency

**Status:** Open
**Severity:** LOW (Potential bug)
**File:** resources/ext.layers.editor/SelectionManager.js

**Issue:** `selectAll()` correctly handles API boolean serialization (`visible !== false && visible !== 0`), but the `selectLayer()` fallback path only checks `layer.locked !== true && layer.visible !== false`, missing the integer 0 and 1 cases.

---

#### LOW-v42-5: DimensionRenderer createDimensionLayer Uses || for Falsy Defaults

**Status:** Open
**Severity:** LOW (Bug for edge cases)
**File:** resources/ext.layers.shared/DimensionRenderer.js

**Issue:** Properties like `extensionGap` use `||` which rejects legitimate `0` values. The same file uses `!== undefined` correctly for `precision` and `toleranceValue`, showing the inconsistency.

---

#### LOW-v42-6: CustomShapeRenderer Opacity Not Clamped

**Status:** Open
**Severity:** LOW (Inconsistency)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** `getOpacity()` returns `specific * overall` without clamping. All other renderers use `clampOpacity()` from MathUtils.

---

#### LOW-v42-7: ExportController Blob URL Leak on Error

**Status:** Open
**Severity:** LOW (Resource leak)
**File:** resources/ext.layers.editor/ExportController.js

**Issue:** If `document.body.removeChild(a)` throws, `URL.revokeObjectURL(url)` is skipped. Should use try/finally.

---

#### LOW-v42-8: RenderCoordinator Hash Misses Visual Properties

**Status:** Open
**Severity:** LOW (Optimization bug — missed redraws)
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js

**Issue:** Layer hash misses radiusX/Y, controlX/Y, tailTipX/Y, cornerRadius, lineHeight, color, arrowhead/style/size, gradient stop changes, and shadow offset/spread properties.

---

#### LOW-v42-9: Escape Closes Modal Without Unsaved Changes Check

**Status:** Open
**Severity:** LOW (UX issue)
**File:** resources/ext.layers.modal/LayersEditorModal.js

**Issue:** Pressing Escape immediately closes the modal iframe without checking for unsaved changes via the postMessage channel.

---

#### LOW-v42-10: Duplicated SVG Icon Code

**Status:** Open
**Severity:** LOW (Code duplication)
**Files:** ViewerManager.js, SlideController.js

**Issue:** Both contain identical `_createPencilIcon()` and `_createExpandIcon()` SVG generation methods. Should use the existing IconFactory.js.

---

#### LOW-v42-11: Dead Code renderCodeSnippet with Embedded XSS

**Status:** Open
**Severity:** LOW (Dead code + latent security)
**File:** resources/ext.layers.editor/LayerPanel.js L2161

**Issue:** `renderCodeSnippet()` is never called (zero call sites) but contains unescaped `filename` interpolated into raw HTML. Should be removed or fixed before any caller is added.

---

#### LOW-v42-12: RichTextToolbar Potential Drag Listener Leak

**Status:** Open
**Severity:** LOW (Resource leak)
**File:** resources/ext.layers.editor/canvas/RichTextToolbar.js

**Issue:** Document-level mousemove/mouseup handlers added during drag are not cleaned up in destroy() if destroyed mid-drag.

---

#### LOW-v42-13: Touch Events Missing Key Modifier Properties

**Status:** Open
**Severity:** LOW (Functionality gap)
**File:** resources/ext.layers.editor/CanvasEvents.js L600-614

**Issue:** Synthetic mouse events from touch lack ctrlKey, metaKey, shiftKey, and target. Multi-select via touch impossible.

---

#### LOW-v42-14: SlideController.refreshAllSlides No Concurrency Limit

**Status:** Open
**Severity:** LOW (Performance/server load)
**File:** resources/ext.layers.slides/SlideController.js

**Issue:** Uses bare Promise.all() without concurrency limiting. ViewerManager has a proper `_processWithConcurrency()` (5 parallel).

---

#### LOW-v42-15: CustomShapeRenderer Creates Oversized Temp Canvas Each Call

**Status:** Open
**Severity:** LOW (Performance — GC pressure)
**File:** resources/ext.layers.shared/CustomShapeRenderer.js

**Issue:** Creates a new canvas 5000+ pixels wider than needed per call, with no reuse or size limit. ShadowRenderer has both.

---

#### LOW-v42-16: Unguarded mw.log.warn in CanvasRenderer

**Status:** Open
**Severity:** LOW (Test environment crash)
**File:** resources/ext.layers.editor/CanvasRenderer.js

**Issue:** Uses `mw.log.warn(...)` without `typeof mw !== 'undefined'` guard. Throws ReferenceError in Jest test environment.

---

#### LOW-v42-17: ToolManager Resolves Module References at IIFE Load Time

**Status:** Open
**Severity:** LOW (Fragile loading)
**File:** resources/ext.layers.editor/ToolManager.js

**Issue:** `const ToolRegistry = window.ToolRegistry` etc. resolved at IIFE execution time. If the module loads before its dependencies, references are undefined. Other modules use lazy resolution.

---

### Previously Open Items from v41 (Status Update)

| v41 ID | Issue | v42 Status |
|--------|-------|------------|
| P3-067 | ~200 lines duplicated in ApiLayersSave | Open |
| P3-068 | ToolbarStyleControls god class (1,006 lines) | Open |
| P3-069 | drawRoundedRectPath duplicated in 3 files | Open |
| P3-070 | duplicateSelected duplicated in 2 files | Open |
| P3-071 | GradientRenderer namespace inconsistency | Open |
| P3-072 | RenderCoordinator hash misses deep changes | Superseded by LOW-v42-8 |
| P3-073 | Inconsistent service resolution pattern | Open |
| P3-074 | Response format inconsistency across APIs | Open |
| P3-075 | Missing CommonJS export in LayerDefaults.js | Open |
| P3-076 | Hard-coded English strings in UI | Superseded by MED-v42-10 |
| P3-077 | Font size validation type check gap | Open |
| P3-078 | getNamedSetOwner reads replica DB | Open |
| P3-079 | ValidationResult mixed error structure | Open |

---

## Documentation Accuracy Issues (v42)

### Critical Inaccuracies Found

| Document | Issue | Severity |
|----------|-------|----------|
| .github/copilot-instructions.md | ToolManager listed at ~1,214 lines (actual: 799) | High — misleads AI agents |
| .github/copilot-instructions.md | InlineTextEditor listed at ~1,672 (actual: 1,832) | Medium |
| .github/copilot-instructions.md | TextBoxRenderer listed at ~996 (actual: 1,120) | Medium |
| .github/copilot-instructions.md | EmojiLibraryIndex path wrong (ext.layers.emojiPicker/) | Medium |
| .github/copilot-instructions.md | ToolManager classified as god class (799 lines, under threshold) | Medium |
| .github/copilot-instructions.md | God class count says 16 (actual: 17, missing ToolbarStyleControls) | Medium |
| .github/copilot-instructions.md | LayersEditor listed at ~1,846 (actual: 1,790) | Low |
| KNOWN_ISSUES.md | P1-033 CacheInvalidationTrait marked "✅ Fixed v41" but not committed | Critical — false claim |
| Mediawiki-Extension-Layers.mediawiki | Says "15 drawing tools" (actual: 17) | Medium |
| Mediawiki-Extension-Layers.mediawiki | Missing Image tool from tools list | Medium |
| docs/DEVELOPER_ONBOARDING.md | ToolManager.js at ~1,214 lines (actual: 799) | Medium |
| docs/SLIDES_REQUIREMENTS.md | Claims "Planning Phase" for shipped feature | Low |

---

## Security Controls Status (v42 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ✅ PASS | Properly delegates to $wgRateLimits |
| Input Validation | ✅ PASS | 110+ property whitelist, numeric constraints |
| RichText Font Sanitization | ✅ PASS | Fixed v39 |
| Authorization | ✅ PASS | All APIs check rights |
| Boolean Normalization | ✅ PASS | API serialization robust |
| IM Font Validation | ⚠️ GAP | No whitelist check in ThumbnailRenderer |
| CSP Header | ✅ PASS | addExtraHeader() pattern |
| Font Sanitization | ✅ PASS | sanitizeIdentifier() at save time |
| SVG Sanitization | ✅ PASS | embed/object/iframe/applet added v41 |
| Client-Side SVG | ✅ PASS | DOMParser sanitizer |
| User Deletion | ✅ PASS | ON DELETE SET NULL |
| Cache Invalidation | ❌ FAIL | CacheInvalidationTrait.php missing from disk |
| window.open | ✅ PASS | noopener,noreferrer |
| TextSanitizer XSS | ✅ PASS | Second strip_tags after decode |
| Info Disclosure | ✅ PASS | Generic error + server logging |
| Transaction Safety | ✅ PASS | OverflowException re-thrown |
| Build Pipeline | ✅ PASS | npm test runs lint + Jest |

---

## God Class Status (17 files >= 1,000 lines)

### Generated Data (Exempt — 2 files)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,293 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (13 files)

| File | Lines |
|------|-------|
| LayerPanel.js | 2,195 |
| CanvasManager.js | 2,037 |
| Toolbar.js | 1,910 |
| InlineTextEditor.js | 1,832 |
| LayersEditor.js | 1,790 |
| APIManager.js | 1,593 |
| PropertyBuilders.js | 1,493 |
| SelectionManager.js | 1,418 |
| CanvasRenderer.js | 1,390 |
| ViewerManager.js | 1,320 |
| SlideController.js | 1,170 |
| TextBoxRenderer.js | 1,120 |
| ToolbarStyleControls.js | 1,006 |

### PHP (2 files)

| File | Lines |
|------|-------|
| ServerSideLayerValidator.php | 1,406 |
| LayersDatabase.php | 1,369 |

### Near-Threshold (900–999 lines — 10 files)

| File | Lines |
|------|-------|
| PropertiesForm.js | 991 |
| TransformController.js | 990 |
| GroupManager.js | 987 |
| ArrowRenderer.js | 974 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 969 |
| StateManager.js | 967 |
| ResizeCalculator.js | 966 |
| ShapeRenderer.js | 959 |
| LayersValidator.js | 935 |

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test coverage (95.19% statement, 84.96% branch), modern ES6 architecture (100% class migration), comprehensive server-side validation, and proper CSRF/SQL injection protection. 183 bugs have been found and fixed across v22–v41 review cycles.

**However, the v42 fresh audit discovered a critical show-stopping bug:** `CacheInvalidationTrait.php` was referenced in code but never committed to disk, rendering ALL write API operations (save, delete, rename) completely non-functional. The previous review cycle (v41) incorrectly marked this as fixed. This is the most severe bug found in the entire review history.

Beyond the critical infrastructure issue, the audit found:
- 4 HIGH: Null dereference, missing nudge UX, color preview state bypass, font re-validation gap
- 10 MEDIUM: Double render, rendering bugs (shadow, blur, stroke, font order), alignment gaps, clipboard offsets, timestamp UTC, i18n
- 17+ LOW: Dead code, duplication, touch events, resource leaks, documentation inaccuracies

The **most actionable improvements** are:
1. **CREATE** CacheInvalidationTrait.php (unblocks all write operations)
2. Fix ApiLayersInfo null dereference at line 280
3. Implement arrow key nudging for selected layers
4. Store/restore original colors in color preview
5. Remove redundant render/markDirty in EventManager undo/redo
6. Port CustomShapeRenderer shadow rotation fix from ShadowRenderer
7. Fix ThumbnailRenderer textbox stroke bleed
8. Use Date.UTC in parseMWTimestamp
9. Update copilot-instructions.md with correct line counts

**Overall Grade: B+** — Excellent core with strong testing and security fundamentals, but the missing trait file is a critical deployment blocker that must be resolved immediately. Once the CacheInvalidationTrait is created and the null dereference fixed, the grade would return to A-.

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|---------|
| v42 | 2026-02-15 | B+ | Fresh audit; 1C, 4H, 10M, 17L new; CacheInvalidationTrait.php missing. |
| v41 | 2026-02-15 | A- | Fresh audit; 3H, 7M, 13L; 10 items fixed (but 1 fix not committed). |
| v40 | 2026-02-14 | A- | Verification addendum; 5 items fixed. |
| v39 | 2026-02-14 | A- | Fresh audit; 1H security, 4H bugs, 5M, 4L; all fixed. |
| v38 | 2026-02-14 | A | Fresh audit; 2M, 4L new; 2 FPs. |
| v37 | 2026-02-13 | A | Fresh audit; 1M, 2L new; 3 FPs. |
| v36 | 2026-02-13 | A | Fresh audit + fixes; 6H fixed; 13M; 20L. |
| v35 | 2026-02-11 | A | Fresh audit; 4H, 5M, 9L; all 18 fixed. |
| v33 | 2026-02-09 | B | Fresh audit; 4H, 8M, 7L new. |
| v29 | 2026-02-08 | B | Full audit; 4H, 10M, 8L new. |
| v28 | 2026-02-08 | B | Full audit; 1C, 10H, 9M, 6L. |
| v27 | 2026-02-07 | B | 3C (fixed), 15H, 20M, 17L. |
| v25 | 2026-02-07 | B+ | 2C (fixed), 8H, 9M, 11L. |
| v22 | 2026-02-05 | B+ | Initial comprehensive review. |
