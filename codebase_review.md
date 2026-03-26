# Layers MediaWiki Extension — Codebase Review

**Review Date:** March 26, 2026 (v65 audit + fix pass)
**Previous Review:** March 26, 2026 (v64 audit + fix pass)
**Version:** 1.5.63
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** `main`
- **Verification Method:** Direct source inspection with 4 specialized
    subagent sweeps (PHP backend, JS frontend, security/SQL deep dive,
    documentation accuracy) plus manual verification of every finding
    against actual source code. Fresh test run and coverage generation
    performed. All subagent-reported issues individually confirmed
    before inclusion. 14 false positives from subagent analysis
    rigorously eliminated (see Verified Non-Issues).
- **Coverage:** 94.24% statements, 84.17% branches, 93.27% functions,
    94.34% lines (freshly verified `npm run test:coverage` March 25, 2026)
- **JS source files:** 157 in `resources/` excluding dist
    (~113,902 lines)
- **PHP production files:** 42 in `src/` (~15,339 lines)
- **Jest test suites:** 168
- **Jest test cases:** 11,904 (`npm run test:js --silent` —
    verified March 25, 2026)
- **PHPUnit test files:** 34 in `tests/phpunit`
- **i18n message keys:** 842 in `i18n/en.json` (excluding @metadata;
    verified via direct count March 26, 2026)
- **API Modules:** 5 (`layersinfo`, `layerssave`, `layersdelete`,
  `layersrename`, `layerslist`)
- **Files ≥1,000 lines:** 26 total (5 generated JS data, 19
    hand-written JS, 2 PHP)

---

## Executive Summary

The v65 audit covered two major areas: viewer stack (4 files:
ViewerManager, LayersViewer, LayersLightbox, ViewerOverlay — ~2,961
lines plus ImageLayerRenderer ~278 lines) and remaining shared
renderers (5 files: EffectsRenderer, MarkerRenderer,
DimensionRenderer, CalloutRenderer, AngleDimensionRenderer — ~3,006
lines). Two specialized subagent sweeps identified 7+5=12 candidate
issues. Manual verification confirmed 5 real findings (1 P2, 4 P3)
and eliminated 7 non-issues.

**v65 findings:** 0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW code items.

**v65 fix pass (March 26):** P2-205 fixed (ImageLayerRenderer broken
image retry storm — onerror deleted cache entry causing infinite
network requests on re-render), P3-206 fixed (LayersLightbox race
condition on close during image load), P3-207 fixed (DimensionRenderer
auto-reversed text normalization math), P3-208 fixed (ViewerManager
layersPending not cleared on success), P3-209 fixed (CalloutRenderer
richText gate on layer.text). All cherry-picked to REL1_43 and
REL1_39.
**0 open code items. 0 open doc items.** 11,904 tests passing.

The codebase retains strong architecture, comprehensive test coverage
(94.24% statements, 11,904 tests in 168 suites), and robust security
controls. P3-147 (accepted) and P3-148 (deferred) carried forward.

---

## Confirmed Findings (v65 — March 26, 2026) — 5 Code Items

### v64 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P2-199 | ✅ Fixed | Touch double-tap measured tap duration |
| P2-200 | ✅ Fixed | Marquee selection nonexistent method |
| P2-201 | ✅ Fixed | Locked text layers editable |
| P2-202 | ✅ Fixed | selectAll included locked layers |
| P2-203 | ✅ Fixed | Space key blocked toolbar buttons |
| P3-204 | ✅ Fixed | ArrowStyleControl null guard |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v65) — 5 Items

**Audit scope:** 4 viewer files (ViewerManager, LayersViewer,
LayersLightbox, ViewerOverlay — ~2,961 lines) + ImageLayerRenderer
(~278 lines) + 5 shared renderers (EffectsRenderer, MarkerRenderer,
DimensionRenderer, CalloutRenderer, AngleDimensionRenderer — ~3,006
lines). 10 files total, ~6,245 lines on main branch.

**Methodology:** 2 specialized subagent sweeps identified 12 candidate
issues. Manual verification confirmed 5 real findings (1 P2, 4 P3)
and eliminated 7 non-issues.

### Medium — JavaScript (Network Bug)

#### P2-205 · `ImageLayerRenderer` Broken Image Retry Storm

- **File:** `resources/ext.layers.shared/ImageLayerRenderer.js`
- **Lines:** ~223, ~181
- **Issue:** `img.onerror` handler deleted the cache entry for a
    failed image. On the next render cycle (resize, RAF), `_getImageElement`
    found no cache entry, created a new `Image` with the same broken
    URL, and started a new network request. During continuous resize
    events (60fps via RAF), this fired dozens of requests per second
    to a failing endpoint.
- **Fix:** Track failed URLs in a `_failedUrls` Set. Skip re-creation
    for known-failed URLs.
- **Status:** ✅ Fixed (network spam eliminated)

### Low — JavaScript (Race Condition)

#### P3-206 · `LayersLightbox.renderViewer` img.onload After close()

- **File:** `resources/ext.layers/viewer/LayersLightbox.js`
- **Line:** ~290
- **Issue:** `renderViewer()` guarded against `!this.imageWrapper` at
    the function start, but `img.onload` fired asynchronously with no
    guard. If user closed lightbox during image load, `close()` nulled
    `this.imageWrapper`, then `img.onload` created a LayersViewer with
    `container: null` — a non-functional instance.
- **Fix:** Added `!this.imageWrapper || !this.isOpen` guard inside
    the `img.onload` callback.
- **Status:** ✅ Fixed (stale callback guarded)

### Low — JavaScript (Math Bug)

#### P3-207 · `DimensionRenderer` auto-reversed Text Normalization

- **File:** `resources/ext.layers.shared/DimensionRenderer.js`
- **Line:** ~658
- **Issue:** After adding π for reversal, a single `if` normalization
    (`>π/2 || <-π/2 → +=π`) could produce a net 2π (identity),
    making `auto-reversed` identical to `auto` for common angles
    (all angles in [-π/2, π/2]). The feature was effectively broken
    for horizontal and diagonal dimension lines.
- **Fix:** Replaced single `if` with `while` loop normalization for
    correct angle wrapping across all input ranges.
- **Status:** ✅ Fixed (auto-reversed now distinct from auto)

### Low — JavaScript (Lifecycle Bug)

#### P3-208 · `ViewerManager` layersPending Not Cleared on Success

- **File:** `resources/ext.layers/viewer/ViewerManager.js`
- **Line:** ~814
- **Issue:** In `initializeLargeImages`, `img.layersPending = true`
    was set before the API call, but only cleared on the failure path.
    On success, the flag persisted. If the viewer was later destroyed
    (e.g., via `destroyViewer`), the flag blocked re-initialization:
    `if ( img.layersViewer || img.layersPending )` skipped it.
- **Fix:** Unconditionally clear `layersPending` after
    `initializeViewer()` call.
- **Status:** ✅ Fixed (re-initialization unblocked)

### Low — JavaScript (Rendering Gap)

#### P3-209 · `CalloutRenderer` richText Gate on `layer.text`

- **File:** `resources/ext.layers.shared/CalloutRenderer.js`
- **Line:** ~920
- **Issue:** Text rendering was gated on `layer.text` being truthy.
    Per the data model, when `richText` is present, `text` is ignored
    and may be empty. `TextBoxRenderer` correctly checks
    `(text || richText)`, but `CalloutRenderer` only checked `text`,
    so callouts with `richText` but empty `text` rendered as empty
    bubbles.
- **Fix:** Added `richText` check matching TextBoxRenderer pattern:
    `(layer.text.length > 0) || (layer.richText && richText.length)`.
- **Status:** ✅ Fixed (richText callouts render correctly)

---

## v65 Verified Non-Issues (7 Eliminated)

- **LayersViewer image load listener leak** — anonymous listener on
  `this.imageElement`, but `resizeCanvasAndRender` has `!this.canvas`
  guard. Narrow timing window, stale callback is safe.

- **LayersLightbox new mw.Api() per-call** — creates new API instance
  each open. Minor waste but not a functional bug; token caches are
  reused by jQuery.

- **LayersViewer mw.log in catch** — `cancelAnimationFrame` never
  throws in browsers. Unreachable catch block.

- **ViewerOverlay config.canEdit integer 0** — no caller passes
  `canEdit` from API data. Latent footgun only.

- **MarkerRenderer formatValue >702** — max layers per set is 100.
  Practically unreachable 27+ double-letter column overflow.

- **CalloutRenderer error handler restore** — `ctx.restore()` in
  catch could pop caller's state if exception occurs before `save()`.
  Only arithmetic in that window; no realistic throw path.

- **DimensionRenderer/AngleDimensionRenderer factory integer 0** —
  factory methods called from JS editor, not API deserialization.
  PHP-serialized integers won't reach these code paths.

---

## Confirmed Findings (v64 — March 26, 2026) — 6 Code Items

### v63 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P2-195 | ✅ Fixed | SmartGuides snap tautology |
| P2-196 | ✅ Fixed | Reflex angle arc hit test |
| P2-197 | ✅ Fixed | Rotation rAF layer guard |
| P3-198 | ✅ Fixed | Untracked dimension text rAFs |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v64) — 6 Items

**Audit scope:** 5 UI god classes (Toolbar, LayerPanel,
ToolbarStyleControls, PropertyBuilders, InlineTextEditor — ~8,570
lines) and 5 core editor files (CanvasManager, SelectionManager,
CanvasRenderer, CanvasEvents, GroupManager — ~7,865 lines). 10 files
total, ~16,435 lines on main branch.

**Methodology:** 2 specialized subagent sweeps identified 15 candidate
issues. Manual verification confirmed 6 real findings (5 P2, 1 P3)
and eliminated 9 non-issues.

### Medium — JavaScript (Touch Input)

#### P2-199 · `CanvasEvents` Double-Tap Measures Tap Duration

- **File:** `resources/ext.layers.editor/CanvasEvents.js`
- **Lines:** ~664, ~706
- **Issue:** `lastTouchTime` was set in `handleTouchStart`, then
    `handleTouchEnd` compared `now - lastTouchTime < 300`. This
    measured single tap duration (~50-200ms), not interval between
    two consecutive taps. Every quick tap triggered `handleDoubleTap`
    (zoom toggle), and the early `return` skipped `handleMouseUp`,
    leaving drag/selection state unreleased.
- **Fix:** Moved `lastTouchTime` assignment to `handleTouchEnd`
    (after the double-tap check), reset to 0 after triggering.
- **Status:** ✅ Fixed (measures inter-tap interval correctly)

### Medium — JavaScript (Logic Bug)

#### P2-200 · `CanvasManager.finishMarqueeSelection` Nonexistent Method

- **File:** `resources/ext.layers.editor/CanvasManager.js`
- **Line:** ~1315
- **Issue:** Called `this.selectionManager.getSelectedLayerIds()`
    which does not exist on SelectionManager (it's a property, not
    a method). The conditional `getSelectedLayerIds ?` evaluated to
    `undefined` (falsy), fallback `[]` was always used, and
    `deselectAll()` was always called — clearing the marquee
    selection on every mouseUp.
- **Fix:** Changed to property access
    `this.selectionManager.selectedLayerIds || []`.
- **Status:** ✅ Fixed (marquee selection now persists)

#### P2-201 · `CanvasEvents.findTextLayerAtPoint` Skips Locked Check

- **File:** `resources/ext.layers.editor/CanvasEvents.js`
- **Line:** ~161
- **Issue:** Comment said "Skip hidden or locked layers" but code
    only checked `visible`. Locked text/textbox/callout layers could
    be double-clicked to enter inline text editing, bypassing the
    lock contract.
- **Fix:** Added `layer.locked === true || layer.locked === 1`
    to the skip condition.
- **Status:** ✅ Fixed (locked layers are not double-click editable)

#### P2-202 · `CanvasManager.selectAll` Includes Locked Layers

- **File:** `resources/ext.layers.editor/CanvasManager.js`
- **Line:** ~1425
- **Issue:** `selectAll()` filtered only by visibility, not locked
    status. `SelectionManager.selectAll()` correctly filters both.
    Ctrl+A selected locked layers, allowing them to be
    drag-moved, resized, or deleted — bypassing lock protection.
- **Fix:** Added `layer.locked !== true && layer.locked !== 1`
    to the filter, matching SelectionManager.
- **Status:** ✅ Fixed (Ctrl+A respects locked status)

### Medium — JavaScript (Accessibility)

#### P2-203 · `CanvasEvents` Space Key Blocks Toolbar Buttons

- **File:** `resources/ext.layers.editor/CanvasEvents.js`
- **Line:** ~620
- **Issue:** Document-level `keydown` handler called
    `e.preventDefault()` for Space key to enter pan mode. The guard
    only checked INPUT, TEXTAREA, and contentEditable. When toolbar
    buttons/selects had focus, Space activation was blocked — users
    navigating toolbar with keyboard (Tab + Space) could not activate
    controls.
- **Fix:** Added check for BUTTON, SELECT, and `.oo-ui-widget`
    ancestor before capturing Space key.
- **Status:** ✅ Fixed (toolbar buttons activatable via keyboard)

### Low — JavaScript (Defensive Coding)

#### P3-204 · `ToolbarStyleControls` Missing ArrowStyleControl Guard

- **File:** `resources/ext.layers.editor/ToolbarStyleControls.js`
- **Line:** ~183
- **Issue:** `this.arrowStyleControl.create()` was called without a
    null guard, while all other delegates (textEffectsControls,
    presetStyleManager) had null guards. If `ArrowStyleControl`
    failed to load via `getClass()`, the entire style group creation
    would crash.
- **Fix:** Added `if ( this.arrowStyleControl )` guard matching
    the pattern used by other delegates.
- **Status:** ✅ Fixed (consistent null checking)

---

## v64 Verified Non-Issues (9 Eliminated)

- **Intra-folder reorder rejection (C4-B2):**
  `addToFolderAtPosition` returns false for same-folder moves, but
  `LayerDragDrop` handles same-folder reordering via Case 3
  (standard reorder through `stateManager.reorderLayer`).

- **Color preview originals leak (C3-B1):**
  Would require abnormal dialog close without triggering cancel or
  commit callbacks. Edge case; cleanup happens in both normal paths.

- **EventTracker stale name listeners (C4-B1):**
  Old elements' listeners accumulate in EventTracker on re-render,
  but are all cleaned up in `destroy()`. Long-session-only.

- **fontFamily nesting without cleanup (C5-B1):**
  Repeated font family changes produce nested spans, but innermost
  CSS wins — visually correct. HTML bloat is bounded by session.

- **ToolbarKeyboard unguarded instantiation (C2-B1):**
  Same pattern used by many modules. If getClass fails, the module
  failed to load at all — not a runtime concern.

- **NaN group bounds (C8-B2):**
  Server validates all layer geometry. Malformed values from API
  are normalized by LayerDataNormalizer. Theoretical only.

- **Ellipse glow stroke distortion (C9-B2):**
  Non-uniform scale on stroke is a known Canvas limitation. Visual
  only, no data impact. Standard workaround would add complexity.

- **renderLayersToContext zoom sync (C10-B2):**
  LayerRenderer zoom sync gap — low confidence, needs deeper
  analysis of rendering pipeline. Theoretical concern only.

- **moveToFolder nested group positioning (C5-B2):**
  Edge case for deeply nested folder hierarchies. The early break
  at non-direct children means insert position is approximate,
  but functionally layers still end up in the correct folder.

---

## Confirmed Findings (v63 — March 26, 2026) — 4 Code Items

### v62 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P2-192 | ✅ Fixed | Exception-safe destroy chain |
| P2-193 | ✅ Fixed | Draft save failure notification |
| P3-194 | ✅ Fixed | Rich text color validation parity |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v63) — 4 Items

**Audit scope:** 5 shared renderers (TextBoxRenderer, ArrowRenderer,
ShapeRenderer, LayerRenderer, ShadowRenderer — ~4,200 lines) and
5 canvas controllers (TransformController, DrawingController,
SmartGuidesController, ResizeCalculator, HitTestController — ~4,100
lines). 10 files total, ~8,300 lines on main branch.

**Methodology:** 2 specialized subagent sweeps identified 11 candidate
issues. Manual verification confirmed 4 real findings (3 P2, 1 P3)
and eliminated 7 non-issues (false positives or accepted low-risk).

### Medium — JavaScript (Logic Bug)

#### P2-195 · `SmartGuidesController` Right-Edge Snap Tautology

- **File:** `resources/ext.layers.editor/canvas/SmartGuidesController.js`
- **Line:** ~574
- **Issue:** The right-edge snap override condition used
    `Math.abs(right - rightSnap.value) < Math.abs(rightSnap.value - right)`
    which is `|a - b| < |b - a|` — a mathematical identity that is
    always false. Right-edge snaps could never override left-edge
    snaps, even when the right edge was geometrically closer.
- **Root cause:** Copy-paste error. The condition should compare the
    right-edge offset against the current best `verticalOffset`, not
    recompute the same distance with swapped operands.
- **Fix:** Changed to `Math.abs(right - rightSnap.value) < Math.abs(verticalOffset)`
    matching the pattern used by centerXSnap.
- **Status:** ✅ Fixed (right-edge snap comparison corrected)

#### P2-196 · `HitTestController` Reflex Angle Arc Hit Test

- **File:** `resources/ext.layers.editor/canvas/HitTestController.js`
- **Lines:** ~375–383
- **Issue:** The reflex angle sweep calculation used a 3-step approach:
    (1) calculate sweep, (2) if sweep ≤ π, add 2π, (3) if sweep > 2π,
    subtract 2π. Steps 2 and 3 cancel each other out for the exact
    case they handle (sweep ≤ π → becomes ≤ 3π → step 3 subtracts 2π
    → back to original). Reflex arcs were not hittable.
- **Root cause:** Incorrect reflex complement logic. Should use
    `sweep = 2π - sweep` (the angular complement).
- **Fix:** Replaced 3-step logic with `sweep = 2 * Math.PI - sweep`,
    matching the pattern in `AngleDimensionRenderer.calculateAngles()`.
- **Status:** ✅ Fixed (reflex arc hit detection corrected)

#### P2-197 · `TransformController` Rotation rAF Missing Layer Check

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
- **Line:** ~353
- **Issue:** The `handleResize` rAF callback had a P2.20 FIX that
    validates the layer still exists in `editor.layers` before calling
    `renderLayers`/`emitTransforming`. The `handleRotation` rAF
    callback lacked the same guard. If a layer is deleted during a
    pending rotation animation frame, the stale reference would cause
    the properties panel to show data for a deleted layer.
- **Fix:** Added `editor.layers.find()` existence check to the
    rotation rAF callback, matching the resize pattern.
- **Status:** ✅ Fixed (rotation rAF layer guard added)

### Low — JavaScript (Resource Leak)

#### P3-198 · `TransformController` Untracked Dimension Text rAF IDs

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
- **Lines:** ~888, ~1016
- **Issue:** `handleAngleDimensionTextDrag` and
    `handleDimensionTextDrag` each schedule a `requestAnimationFrame`
    but never store the return value. The `destroy()` method cancels
    resize/rotation/drag/arrowTip rAFs but cannot cancel these two
    because the IDs are not tracked. Their scheduling flags also
    weren't reset in `destroy()`.
- **Fix:** Stored rAF return values as `_angleDimRafId` and
    `_dimTextRafId` with null assignment in callback. Added
    cancellation and flag resets in `destroy()`.
- **Status:** ✅ Fixed (all rAF IDs now tracked and cancelled)

---

## v63 Verified Non-Issues (7 Eliminated)

- **Negative radii reaching canvas (P2-001 candidate):**
  Server validates `min:0` for radius/radiusX/radiusY/width/height.
  Client-side negative values are caught before reaching canvas APIs.

- **Zero-width stroke shadow performance (P2-002 candidate):**
  `strokeWidth: 0` with shadow enabled wastes a canvas draw call but
  produces no visual artifact. Performance-only — not worth guarding.

- **ArrowRenderer '1' string fallback (P3-001 candidate):**
  The `|| 1` fallback for arrowSize handles both `0` and `undefined`.
  Minimal visual impact; server normalizes to proper integers.

- **Uncached lookup in hot path (P3-002 candidate):**
  The lookup occurs once per render, not per-pixel. Caching would add
  complexity for negligible performance gain.

- **LayerRenderer `visible === false` check (F6 candidate):**
  `LayerDataNormalizer` includes `'visible'` in BOOLEAN_PROPERTIES,
  converting `0` → `false` before rendering code sees it. The strict
  comparison is correct post-normalization.

- **Dead code in angleDimension finalization (F7 candidate):**
  Unreachable branch in angle dimension drag end. Harmless — the
  condition can never be true given the preceding control flow.

- **ShadowRenderer missing blur bounds check:**
  Canvas `shadowBlur` accepts any non-negative number. The server
  already validates blurRadius range (1–64). No additional guard
  needed in the renderer.

---

## Confirmed Findings (v62 — March 26, 2026) — 3 Code Items

### v61 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P2-188 | ✅ Fixed | Base64 payload validation added |
| P2-189 | ✅ Fixed | Empty guard + logger warning |
| P3-190 | ✅ Fixed | DOMParser replaces innerHTML |
| P3-191 | ❌ FP | Depth counting is correct |
| D-061-01..05 | ✅ Fixed | All 5 doc drift items corrected |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v62) — 3 Items

**Audit scope:** All 42 PHP source files (`src/`), 5 key JavaScript
files in `resources/ext.layers.editor/` (LayersEditor.js,
EditorBootstrap.js, DraftManager.js, LayersValidator.js, APIManager.js).
Main branch.

**Methodology:** 2 specialized subagent sweeps (PHP security audit —
all clean; JS frontend audit — 12 candidates). Manual verification
eliminated 4 false positives and confirmed 3 real findings.

**Post-v61 changes:** v61 fix pass confirmed intact. i18n key count
increased from 841 to 842 (added `layers-draft-save-failed`).

### Medium — JavaScript (Lifecycle Safety)

#### P2-192 · `LayersEditor.destroy()` Lacks Exception Protection

- **File:** `resources/ext.layers.editor/LayersEditor.js`
- **Issue:** The `destroy()` method iterates 10 module managers
    calling `.destroy()` on each. If any manager throws, all
    subsequent managers are skipped — including `CanvasEvents` which
    holds document-level `keydown`/`keyup` listeners. Additionally,
    `EditorBootstrap.cleanupGlobalEditorInstance()` failed to null
    the global `window.layersEditorInstance` reference if `destroy()`
    threw, blocking all future editor instantiation.
- **Impact:** Ghost keyboard listeners after editor close. Editor
    reload blocked until page refresh.
- **Fix:** Wrapped each manager's `destroy()` in individual try/catch
    with `mw.log.error()`. Added try/finally in EditorBootstrap to
    guarantee global instance nullification.
- **Status:** ✅ Fixed (exception-safe destroy chain)

### Medium — JavaScript (Silent Failure)

#### P2-193 · `DraftManager` Silent Auto-Save Failure

- **File:** `resources/ext.layers.editor/DraftManager.js`
- **Issue:** `saveDraft()` returned `false` on localStorage quota
    exceeded but both callers (`scheduleAutoSave()` and
    `startAutoSaveTimer()`) ignored the return value. Users could
    lose unsaved work without any warning.
- **Impact:** Data loss risk when localStorage is full.
- **Fix:** Added return value check in both auto-save paths. On
    failure, shows one-time `mw.notify()` warning per session using
    new i18n key `layers-draft-save-failed`.
- **Status:** ✅ Fixed (save failure notification added)

### Low — JavaScript (Validation Gap)

#### P3-194 · `LayersValidator.validateRichText` Missing Color Validation

- **File:** `resources/ext.layers.editor/LayersValidator.js`
- **Issue:** `validateRichText()` validated fontWeight, fontStyle,
    fontSize, and textStrokeWidth for each rich text run's style
    object, but did not validate `color`, `backgroundColor`, or
    `textStrokeColor` with `isValidColor()`. The server-side
    validator did check these — a client/server validation parity
    gap.
- **Impact:** Invalid colors could reach the canvas (rendered as
    transparent by browser). No security risk (server validates).
- **Fix:** Added `isValidColor()` check for all three color
    properties in the rich text style validation loop.
- **Status:** ✅ Fixed (client-side color validation added)

---

## v62 Verified Non-Issues (False Positives Eliminated)

- **`APIManager.sanitizeInput` dead code:**
  **FALSE POSITIVE** — Zero callers across entire codebase. Dead code
  but harmless. Not a security issue; the method exists as defensive
  infrastructure. No action needed.

- **`isValidColor` accepts CSS `var()`/`calc()` injection:**
  **FALSE POSITIVE** — The regex pattern explicitly does NOT match
  `var()` or `calc()` syntax. Only hex, rgb/rgba, hsl/hsla, and
  named colors are accepted. Tested and confirmed rejection.

- **`StateManager.getState()` returns mutable shallow copy:**
  **FALSE POSITIVE** — No callers in the codebase mutate the returned
  state object. The layers array is independently cloned where needed.
  Defensive copying would add unnecessary overhead.

- **`ToolStyles` XSS via `textContent` property:**
  **FALSE POSITIVE** — Text layers render via Canvas `fillText()` /
  `strokeText()` APIs, never via DOM innerHTML. Canvas text rendering
  is inherently XSS-safe — it draws pixels, not HTML.

---

## Confirmed Findings (v61 — March 25, 2026) — 4 Code + 5 Doc Items

### v60 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P3-186 | ✅ Fixed | Dead SQL files deleted |
| P3-187 | ✅ Fixed | ContextMenu keyboard nav added |
| D-060-01 | ✅ Fixed | Test/coverage metrics corrected |
| D-060-02 | ✅ Fixed | i18n count corrected |
| D-060-03 | ✅ Fixed | PHP file count corrected |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v61) — 9 Items

**Audit scope:** All 42 PHP source files (`src/`), all 157 JS files
(`resources/`), all documentation (CHANGELOG, wiki, docs/, mediawiki
files, CONTRIBUTING, SECURITY). Main branch.

**Methodology:** 4 specialized subagent sweeps (PHP backend, JS
frontend core, security/SQL deep dive, documentation accuracy) plus
manual verification of every finding against actual source code. Fresh
test run (`npm run test:coverage`) performed to confirm metrics. 14
false positives eliminated during verification (see Verified
Non-Issues).

**Post-v60 changes:** v60 fix pass confirmed intact. All fixes from
P3-186 (dead SQL), P3-187 (keyboard nav), and D-060-01/02/03 (docs)
verified. Metrics shifted slightly: 11,904 tests (was 11,894), 94.24%
stmts (was 94.28%), 84.17% branches (was 84.18%).

### Medium — PHP (Validation Gap)

#### P2-188 · `validateImageSrc` Does Not Validate Base64 Payload

- **File:** `src/Validation/ServerSideLayerValidator.php` ~L592–620
- **Issue:** The `validateImageSrc()` method validates the data URL
    format (`data:image/TYPE;base64,...`) and enforces a MIME whitelist
    (png, jpeg, gif, webp — SVG correctly excluded), but does not
    validate the base64 payload itself:
    1. Invalid base64 characters are not detected (e.g., a string
       containing `???` after the `,` delimiter would pass).
    2. No decoded-size check: the method checks `strlen($src)` against
       `$wgLayersMaxImageBytes`, but this measures the *encoded* size
       (33% larger than decoded). A 1MB limit allows ~1.33MB encoded.
    3. No actual image header validation (magic bytes).
- **Mitigation:** Total JSON payload size is checked at the API level
    (`$wgLayersMaxBytes` default 2MB), which encapsulates all images.
    Invalid base64 simply fails to render on canvas (browser handles
    gracefully). No code path decodes the base64 server-side.
- **Impact:** Low exploitability. Invalid base64 wastes storage but
    causes no server-side harm. Could theoretically be used to store
    arbitrary data disguised as images.
- **Fix:** Add `base64_decode($payload, true) !== false` check after
    extracting the payload portion. Optionally check decoded size
    against `$wgLayersMaxImageBytes`.
- **Status:** ✅ Fixed (base64 validation added after MIME check)

### Medium — PHP (Defensive Programming)

#### P2-189 · `buildImageNameLookup` Read Paths Missing Empty Guard

- **File:** `src/Database/LayersDatabase.php` ~L1134–1148
- **Issue:** `buildImageNameLookup()` has a fallback
    `return $filtered ?: [ $normalized ]`. If `$imgName` is empty,
    `normalizeImageName('')` returns `''`, all variants filter out,
    and the fallback returns `['']` — a valid SQL condition that
    matches nothing.

    **Write paths** are properly guarded:
    `saveLayerSet()` L95–108 checks `empty($normalizedImgName)`.

    **Read paths** are NOT guarded:
    - `getLatestLayerSet()` — delegates from `ApiLayersInfo`
    - `getLayerSetByName()` — delegates from `ApiLayersInfo`
    - `getAllLayerSets()` — used for revision listing
    - `getNamedSetsSummary()` — used for set enumeration
    - `getNamedSetOwner()` — used for permission checks

    In practice, callers pass `$title->getDBkey()` which is never
    empty for a valid `Title` object. But if any future caller
    passes unsanitized input, the empty lookup silently returns no
    results instead of failing fast.
- **Impact:** No current exploitability. Defense-in-depth improvement.
- **Fix:** Add `if ( $imgName === '' ) { return []; }` at the start
    of `buildImageNameLookup()`. Update callers to handle empty return.
- **Status:** ✅ Fixed (early guard + logger warning for empty input)

### Low — JavaScript (Code Quality)

#### P3-190 · `EmojiPickerPanel.prepareSvgThumbnail` Uses innerHTML

- **File:**
    `resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js`
    L529, L559
- **Issue:** SVG content from the bundled `emoji-bundle.json` is
    inserted via `innerHTML` in two locations:
    - L529: `thumb.innerHTML = svgContent;`
    - L559: `temp.innerHTML = svg;` (inside `prepareSvgThumbnail`)
    The data source is a first-party bundled file deployed with the
    extension, not user input. The `prepareSvgThumbnail` method
    processes the SVG to ensure unique IDs and correct dimensions.
    No XSS vector exists with the current data flow.
- **Impact:** No current vulnerability. Code hygiene note — if the
    emoji data source ever changes to accept user input, these
    sites would need sanitization.
- **Fix (optional):** Use `DOMParser` to parse SVG strings instead of
    `innerHTML` for defense-in-depth.
- **Status:** ✅ Fixed (DOMParser replaces innerHTML for SVG parsing)

#### P3-191 · `SelectionManager._getGroupDescendantIds` Depth Guard

- **File:**
    `resources/ext.layers.editor/SelectionManager.js` L199–202
- **Original Claim:** Off-by-one: `depth > MAX_GROUP_DEPTH` allows
    depth 10 inclusive (11 levels). Should be `>=`.
- **Status:** ✅ False Positive — `traverse(groupId)` starts at
    depth=0 (the root group itself, not a nesting level). Children
    at depth 1 through 10 are exactly 10 nesting levels, matching
    `MAX_GROUP_DEPTH = 10`. The `visited` set independently prevents
    infinite recursion from circular references. Depth counting is
    correct.

### Documentation Drift — 5 Items

#### D-061-01 · README.md Badge Shows 94.43% (Actual: 94.24%)

- **File:** `README.md` L5
- **Current text:** `coverage-94.43%25-brightgreen`
- **Should be:** `coverage-94.24%25-brightgreen`
- **Severity:** MEDIUM — prominent badge visible to all visitors

#### D-061-02 · wiki/Home.md Badges Show 11,847 / 92.88% (v1.5.62 Era)

- **File:** `wiki/Home.md` L7–8
- **Current text:** Badge images referencing `11%2C847` tests and
    `92.88%` coverage
- **Should be:** `11%2C904` tests and `94.24%` coverage
- **Severity:** MEDIUM — GitHub Wiki homepage with outdated metrics

#### D-061-03 · docs/ARCHITECTURE.md Version 1.5.62 + 3 Stale Metrics

- **File:** `docs/ARCHITECTURE.md` L3–4, L148, L928, L1005
- **Issues:**
    - L3–4: Version 1.5.62, Last Updated March 14, 2026 (should be
      1.5.63, March 25, 2026)
    - L148: "92.88% statement test coverage" (should be 94.24%)
    - L928: "11,847 tests, 92.88% statement coverage, 82.58% branch
      coverage" (should be 11,904/94.24%/84.17%)
    - L1005: "11,847 tests" (should be 11,904)
- **Severity:** HIGH — authoritative architecture doc with wrong
    version and 3 stale metric locations

#### D-061-04 · wiki/Architecture-Overview.md Shows 11,847 / 92.88%

- **File:** `wiki/Architecture-Overview.md` L315–316
- **Current text:** Test Cases 11,847, Code Coverage 92.88%
- **Should be:** 11,904 tests, 94.24% coverage
- **Severity:** MEDIUM

#### D-061-05 · wiki/Testing-Guide.md Shows 91.32% Coverage

- **File:** `wiki/Testing-Guide.md` L13
- **Current text:** `Jest | JavaScript | Unit tests | 91.32%`
- **Should be:** 94.24%
- **Severity:** LOW — outdated but clearly pre-v1.5.63

---

## v61 Verified Non-Issues (False Positives Eliminated)

- **`ApiLayersSave` catch(\Throwable) overly broad:**
  **FALSE POSITIVE** — The catch hierarchy is intentional security
  design: `ApiUsageException` is caught and re-thrown first, then
  `OverflowException` for named-set limits, then `\Throwable` as a
  catch-all safety net. Full exceptions are logged server-side; only
  generic error messages reach the client. This prevents information
  leakage. TypeErrors are correctly caught and logged, not masked.

- **Named set limit race condition in `saveLayerSet`:**
  **FALSE POSITIVE** — Both the set existence check AND the distinct
  set count query use `FOR UPDATE` locks inside the same transaction.
  The database schema also has a UNIQUE key on
  `(ls_img_name, ls_img_sha1, ls_name, ls_revision)` which prevents
  duplicate set-name+revision combinations at the database level.
  `isDuplicateKeyError()` retry logic handles any residual races.

- **Integer overflow in point count validation:**
  **FALSE POSITIVE** — PHP's `count()` returns an `int` bounded by
  the array size. The JSON max depth (512) and per-layer point cap
  (1,000) bound the maximum `$totalPoints` to
  100 layers × 1,000 points = 100,000 — well within PHP int range.
  No overflow is possible.

- **TextSanitizer order-of-operations (length check after string ops):**
  **FALSE POSITIVE** — `sanitizeText()` performs `mb_strlen` check
  and `mb_substr` truncation as the FIRST operation (L33–35), BEFORE
  `strip_tags`, `html_entity_decode`, or `removeDangerousProtocols`.
  The code is correctly ordered.

- **ColorValidator ReDoS vulnerability:**
  **FALSE POSITIVE** — Input is limited to 50 characters (`MAX_COLOR_LENGTH`)
  before any regex processing (L70–72). The regex patterns
  `(\d+(?:\.\d+)?|\.\d+)` cannot cause catastrophic backtracking
  on 50-character input.

- **InlineTextEditor `selectionchange` listener memory leak:**
  **FALSE POSITIVE** — `_removeEventHandlers()` (L998–999) properly
  calls `document.removeEventListener` with the bound handler
  reference. L1012 nullifies `_boundSelectionChangeHandler`. The
  `destroy()` method calls `finishEditing()` which calls
  `_removeEventHandlers()`. Complete cleanup chain verified.

- **CanvasEvents double-init guard missing:**
  **FALSE POSITIVE** — `CanvasEvents` has no public `init()` method.
  `setup()` is private and called only from the constructor. It is
  architecturally impossible to register duplicate listeners.

- **APIManager `performSaveWithRetry` missing .catch():**
  **FALSE POSITIVE** — Uses two-argument `.then(success, error)`
  pattern which is standard for jQuery Deferred/mw.Api. The error
  callback correctly handles failures with retry logic and
  `reject()` on final failure. Not an unhandled rejection.

- **APIManager `loadSetByName` stale data race condition:**
  **FALSE POSITIVE** — `_trackRequest()` aborts previous XHR.
  Aborted requests return code `'http'` with `textStatus === 'abort'`.
  The callback checks for this (L853–862) and either silently drops
  or rejects with `{ aborted: true }`. Stale Promise references are
  not held by callers who already moved to a new Promise.

- **SetNameSanitizer uses `strlen()` instead of `mb_strlen()`:**
  **FALSE POSITIVE** — Actual code (L75–79) uses
  `function_exists('mb_substr')` guard and calls `mb_substr()` when
  available. The MAX_LENGTH of 255 matches MySQL `varchar(255)` which
  is character-based, not byte-based. Correctly handles multibyte.

- **ImageLoader protocol injection (javascript: URL):**
  **FALSE POSITIVE** — `isSameOrigin()` is used for CORS decision,
  not security filtering. A `javascript:` URL would fail the
  `new URL()` constructor, fall to the catch branch, fail all three
  `startsWith` checks, and return `true` (same-origin). But this
  function only determines whether to add `crossOrigin` attribute.
  Image `src` set to `javascript:` does not execute in modern
  browsers (only `<a href>` and similar navigation contexts).

- **EmojiPickerPanel innerHTML XSS:**
  **FALSE POSITIVE** — SVG data comes from the bundled
  `emoji-bundle.json`, a first-party file deployed with the extension.
  Not user-controllable. `prepareSvgThumbnail` processes the SVG for
  unique IDs and dimensions. (Noted as P3-190 code hygiene item only.)

- **Toolbar/UI controller state subscription leaks:**
  **FALSE POSITIVE** — Toolbar and LayerPanel both have `destroy()`
  methods that call unsubscribe functions. `LayerPanel.destroy()` at
  L135 iterates `this.unsubscribers` array. The `stateUnsubscribers`
  pattern used in CanvasManager is consistently applied across modules.

- **SQL injection via sort direction string concatenation:**
  **FALSE POSITIVE** — `validateSortDirection()` whitelists only
  'ASC' and 'DESC' (binary decision). Even if bypassed, the values
  are hardcoded strings, not user input. The full query uses
  MediaWiki's `$dbw->select()` with array-based options.

---

## Confirmed Findings (v60 — March 25, 2026) — 5 New Items Found

### v59 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P2-166 | ✅ Fixed | AlignmentController.moveLayer missing types |
| P2-167 | ✅ Fixed | AlignmentController.getLayerBounds missing types |
| P2-168 | ✅ Fixed | HitTestController skips locked layers |
| P2-169 | ✅ Fixed | Foreign file SHA1 mismatch on deletion |
| P2-170 | ✅ Fixed | ApiLayersList enrichWithUserNames divergent |
| P3-171 | ✅ Fixed | emitTransforming expensive JSON clone |
| P3-172 | ✅ Fixed | Dimension text drag not rAF-throttled |
| P3-173 | ✅ Fixed | PresetStorage.importFromJson no sanitize |
| P3-174 | ✅ Fixed | updateLayer floods undo history |
| P3-175 | ✅ Fixed | duplicateSelected fallback partial offset |
| P3-176 | ✅ Fixed | Duplicate JSDoc in CanvasManager |
| P3-177 | ✅ Fixed | SelectionManager visibility check |
| P3-178 | ✅ Fixed | BackgroundLayerController cssText |
| P3-179 | ✅ Fixed | deleteNamedSet missing FOR UPDATE |
| P3-180 | ✅ Fixed | EditLayersAction returnTo allowlist |
| P3-181 | ✅ Fixed | ApiLayersRename inconsistent defaults |
| P3-182 | ❌ FP | SlideHooks static cache (has safety limit) |
| P3-183 | ❌ FP | StaticLoggerAwareTrait stale logger |
| P3-184 | ✅ Fixed | RichTextToolbar incomplete destroy |
| P3-185 | ❌ FP | HelpDialog keydown leak (has re-entry guard) |
| D-059-01..13 | ✅ Fixed | All 13 doc drift items corrected |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v60) — 5 Items

**Audit scope:** All 42 PHP source files (`src/`), all 157 JS files
(`resources/`), all documentation (CHANGELOG, wiki, docs/, mediawiki
files, CONTRIBUTING, SECURITY). Main branch.

**Methodology:** 4 specialized subagent sweeps (PHP security/API/
database, JS core editor/canvas, JS renderers/canvas controllers, JS
UI/viewer/shared + docs) plus manual verification of every finding
against actual source code. Fresh test run (`npx jest --coverage`)
performed to confirm metrics. 3 false positives eliminated during
verification (see Verified Non-Issues).

**Post-v59 changes:** Two commits reviewed since v59 audit:
1. `ffec107a` — v59 fix pass (15 bug fixes). Modified 13 source files
   and 2 test files. Test count shifted from 11,910 to 11,894 (−16
   tests due to test consolidation during fixes).
2. `993c24a7` — AuditTrailTrait feature. Added
   `src/Api/Traits/AuditTrailTrait.php` (135 lines), PHPUnit test,
   6 new i18n keys, change tag registration.

### Low — SQL (Dead Code)

#### P3-186 · Incomplete P3-146 Cleanup — 2 Dead SQL Files Remain

- **Files:**
    - `sql/tables/layer_set_usage.sql` — CREATE script for dropped table
    - `sql/patches/patch-add-lsu_usage_count.sql` — ALTER for dropped
      table
- **Issue:** The P3-146 task (dead table removal, completed in v1.5.63)
    removed the `layer_set_usage` table via a drop migration
    (`patch-drop-layer_set_usage.sql`) and cleaned up all schema manager
    and constant references. However, two SQL files were listed for
    deletion in the P3-146 checklist (`improvement_plan.md`) but were
    never actually deleted:
    1. `sql/tables/layer_set_usage.sql` — CREATE TABLE script for a
       table that no longer exists. Not loaded by `LayersSchemaManager`
       (which only creates `layer_sets` and `layer_assets`).
    2. `sql/patches/patch-add-lsu_usage_count.sql` — ALTER TABLE for
       `layer_set_usage`. Not referenced by `LayersSchemaManager`'s
       update chain. Alters a table that has been dropped.
- **Impact:** Dead weight. The files cannot be reached by any code path.
    Could confuse developers reviewing the SQL directory.
- **Fix:** Delete both files.

### Low — JavaScript (Accessibility)

#### P3-187 · ContextMenu Missing Keyboard Navigation (WCAG)

- **File:**
    `resources/ext.layers.editor/ui/ContextMenuController.js`
- **Issue:** The context menu sets `role="menu"` (L70) and
    `role="menuitem"` (L86) ARIA attributes, which is correct. However,
    keyboard navigation is limited to Escape-to-close (L221). Arrow key
    navigation (ArrowUp, ArrowDown, Home, End) between menu items is
    missing. WCAG 2.1 SC 4.1.2 requires that elements with the `menu`
    role support standard keyboard navigation patterns.
- **Impact:** Screen reader and keyboard-only users cannot navigate
    context menu items. Mouse users are unaffected.
- **Fix:** Add a keydown handler for ArrowUp/ArrowDown (move focus
    between items), Home/End (jump to first/last), and Enter/Space
    (activate focused item). Set `tabindex="-1"` on each menu item
    and manage focus programmatically.

### Documentation Drift — 3 Items

#### D-060-01 · Test Count, Suite Count, and Coverage Wrong Across 8+ Files

- **Files affected:** `README.md` (L333, L393, L395–396),
    `CHANGELOG.md` (L23–24), `CONTRIBUTING.md` (L24),
    `Mediawiki-Extension-Layers.mediawiki` (L324),
    `wiki/Home.md` (L27, L325, L327–328),
    `docs/ARCHITECTURE.md` (L34–35),
    `.github/copilot-instructions.md` (L446–447),
    `codebase_review.md` (header)
- **Issue:** All documents show 11,910 tests / 169 suites / 94.43%
    stmts / 84.32% branches (the values fixed during v59). However,
    the v59 code fixes (`ffec107a`) consolidated tests (−16 tests, −1
    suite) and modified coverage-affecting code. Actual post-fix values
    are **11,894 tests / 168 suites / 94.28% stmts / 84.18% branches /
    93.26% functions / 94.38% lines**. This is the fourth consecutive
    audit where documentation metrics lacked a post-fix verification
    pass.
- **Severity:** HIGH — pervasive metric drift across the entire
    documentation surface.

#### D-060-02 · i18n Key Count 835→841

- **Files affected:** `codebase_review.md` (header), `wiki/Home.md`
    (L334), `docs/ARCHITECTURE.md` (L41)
- **Issue:** The AuditTrailTrait commit added 6 new i18n keys
    (`layers-audit-save`, `layers-audit-delete`, `layers-audit-rename`,
    `layers-audit-change`, `layers-tag-layers-data-change`,
    `layers-tag-layers-data-change-description`). Documents still show
    835 (the v59-corrected value). Actual count is 841.
- **Severity:** MEDIUM

#### D-060-03 · PHP File Count 41→42, Lines ~15,175→~15,339

- **Files affected:** `codebase_review.md` (header),
    `.github/copilot-instructions.md`
- **Issue:** `src/Api/Traits/AuditTrailTrait.php` (135 lines) was
    added. PHP production file count is now 42 (was 41). PHP lines are
    now ~15,339 (was ~15,175). JS lines are ~113,922 (was ~113,765).
- **Severity:** LOW

---

## v60 Verified Non-Issues (False Positives Eliminated)

- **`HistoryManager` undo/redo re-entrance guard missing:**
  **FALSE POSITIVE** — JavaScript is single-threaded. Concurrent
  undo/redo calls are impossible. The `isUndoRedoInProgress` flag
  in `HistoryManager` correctly prevents nested `saveState()` calls
  inside event handlers triggered by undo/redo, which is the actual
  concern. No guard needed at the undo/redo entry point.

- **`AuditTrailTrait` null edit race condition:**
  **FALSE POSITIVE** — API modules are CSRF-protected and rate-limited.
  The trait runs after the actual DB operation succeeds and is wrapped
  in try/catch for best-effort behavior. Audit trail failure does not
  affect the primary operation.

- **`StateManager.atomic()` queue limit (100 ops, 30s recovery):**
  **FALSE POSITIVE** — The 100-operation limit and 30-second
  auto-recovery are intentional safety mechanisms, not bugs. They
  prevent unbounded memory growth during batch operations. The queue
  is flushed properly when atomic mode ends.

---

## Confirmed Findings (v59 — March 24, 2026) — 28 New Items Found

### v58 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P3-163 | ✅ Fixed | _cloneLayer() unified across 3 controllers |
| P3-164 | ✅ Fixed | PropertyBuilders setTimeout extracted |
| P3-165 | ✅ Fixed | CanvasManager RAF stored |
| D-058-01..07 | ✅ Fixed | All 7 doc drift items corrected |
| P3-146 | ✅ Fixed v1.5.63 | Dead table removed |
| P3-147 | ✅ Accepted | Redundant SQL variants |
| P3-148 | 🔲 Deferred | Unused interface |

---

### New Findings (v59) — 28 Items

**Audit scope:** All 41 PHP source files (`src/`), all 157 JS files
(`resources/`), all documentation (CHANGELOG, wiki, docs/, mediawiki
files, CONTRIBUTING, SECURITY). Main branch.

**Methodology:** 3 specialized subagent sweeps (PHP security/API/
database, JS core editor/canvas, JS viewer/UI/shared + docs) plus
manual verification of every finding against actual source code. Fresh
test run (`npx jest --coverage`) performed to confirm metrics. 9 false
positives eliminated during verification (see Verified Non-Issues).

### Medium — JavaScript (Logic Bugs)

#### P2-166 · `AlignmentController.moveLayer` Missing `angleDimension`/`callout` Layer Types

- **File:** `resources/ext.layers.editor/canvas/AlignmentController.js`
    L195–230
- **Issue:** `moveLayer()` has a switch statement covering `line`,
    `arrow`, `dimension`, `path`, and a default (`x/y`). It does not
    handle:
    1. **`angleDimension`** — uses `cx/cy/ax/ay/bx/by` coordinates.
       Falls through to default, only moving `x/y`, leaving the actual
       vertex and arm points unmoved. Compare with
       `TransformController.updateLayerPosition()` (~L610) which
       correctly handles all six coordinates.
    2. **`callout`** — has `tailX/tailY` that should also move with
       the body. Currently only moves `x/y`, leaving the tail behind.
- **Impact:** Aligning angleDimension layers produces visually broken
    results; aligning callout layers detaches the tail from the body.

#### P2-167 · `AlignmentController.getLayerBounds` Missing Types

- **File:** `resources/ext.layers.editor/canvas/AlignmentController.js`
    L57–175
- **Issue:** `getLayerBounds()` switch statement lacks cases for
    `angleDimension` and `callout`. These fall through to default which
    uses `x/y/width/height`. However:
    - `angleDimension` doesn't have `width/height` — uses arc geometry.
      Returns {left:0, top:0, right:0, bottom:0} when those
      properties are undefined.
    - `callout` tail point (`tailX/tailY`) extends beyond the default
      bounding box.
    Compare with `SmartGuidesController.calculateBounds()` (~L299)
    which correctly handles `angleDimension`.
- **Impact:** Alignment operations on angleDimension layers compute
    incorrect bounds; multi-layer alignment with these types produces
    wrong positions.

#### P2-168 · `HitTestController.getLayerAtPoint` Skips Locked Layers

- **File:** `resources/ext.layers.editor/canvas/HitTestController.js`
    L105
- **Code:** `if ( layer.visible === false || layer.locked === true ) {
    continue; }`
- **Issue:** Locked layers are completely invisible to pointer
    interactions. Users cannot click a locked layer to select it, view
    its properties, or unlock it via the canvas. The lock should prevent
    modification (move, resize, rotate, delete), not selection.
    `TransformController` already properly prevents modification of
    locked layers via `isLayerEffectivelyLocked()` guards. Other
    canvas code is inconsistent: `CanvasEvents.findTextLayerAtPoint`
    only skips hidden layers, not locked ones.
- **Impact:** Locked layers require the layer panel to interact with.
    Users cannot click on a locked layer's canvas position to select it.

### Medium — PHP (Logic/Maintenance)

#### P2-169 · Foreign File SHA1 Mismatch on Deletion

- **File:** `src/Hooks.php` L230
- **Code:** `$db->deleteLayerSetsForImage( $file->getName(),
    ForeignFileHelper::getFileSha1( $file ) );`
- **Issue:** When cleaning up layer sets after file deletion,
    `getFileSha1($file)` is called without the `$imgName` parameter.
    The fallback returns `'foreign_' . sha1($file->getName())`.
    However, `ApiLayersSave` uses `getFileSha1($file, $fileDbKey)`
    where `$fileDbKey = $title->getDBkey()`. In MediaWiki,
    `File::getName()` returns `Title::getText()` (spaces) while
    `Title::getDBkey()` returns underscores. For foreign files with
    spaces in their names, the SHA1 hashes won't match, leaving
    orphaned layer set data in the database.
- **Impact:** Layer set data for foreign files with spaces in names
    is never cleaned up on file deletion.
- **Fix:** Pass normalized name:
    `ForeignFileHelper::getFileSha1($file, str_replace(' ', '_',
    $file->getName()))`

#### P2-170 · `ApiLayersList.enrichWithUserNames()` Divergent Copy

- **Files:** `src/Api/ApiLayersList.php` L135–175,
    `src/Api/ApiLayersInfo.php` L509
- **Issue:** `ApiLayersList` has its own `enrichWithUserNames()` using
    different field names (`createdById`/`modifiedById`) and a different
    implementation (inline `$user->load()` calls) compared to
    `ApiLayersInfo`'s consolidated `enrichRowsWithUserNames()` helper.
    A security fix or performance improvement to one won't propagate.
- **Impact:** Maintenance burden; code divergence risk.
- **Fix:** Extract shared enrichment into the `ForeignFileHelperTrait`
    or a new `UserEnrichmentTrait`.

### Low — JavaScript (Performance)

#### P3-171 · `CanvasManager.emitTransforming` Expensive Full JSON Clone

- **File:** `resources/ext.layers.editor/CanvasManager.js` L852
- **Code:** `layer: JSON.parse( JSON.stringify(
    this.lastTransformPayload ) )`
- **Issue:** Performs full `JSON.parse(JSON.stringify(...))` on every
    throttled transform event. For image layers with base64 `src`
    (500KB–1MB), this serializes the entire string per frame.
    `TransformController.emitTransforming()` (~L1066) correctly uses
    a lightweight copy that skips `src` and `path`.
- **Fix:** Use the same lightweight copy pattern or delegate to
    `TransformController.emitTransforming()`.

#### P3-172 · `handleAngleDimensionTextDrag`/`handleDimensionTextDrag` Not rAF-Throttled

- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
    L890, L1010
- **Issue:** Both methods call `renderLayers()` synchronously on every
    `mousemove`. Unlike `handleDrag` (~L540) and `handleArrowTipDrag`
    (~L725) which use `requestAnimationFrame` throttling, these
    dimension-text drag handlers cause excessive repaints.
- **Fix:** Add rAF throttling consistent with `handleDrag` pattern.

#### P3-173 · `PresetStorage.importFromJson` Missing Style Sanitization

- **File:** `resources/ext.layers.editor/presets/PresetStorage.js`
    L328–334
- **Issue:** Imported presets are added directly without calling
    `sanitizeStyle()`. The method exists (L355) with an
    `ALLOWED_STYLE_PROPERTIES` whitelist but is never invoked during
    import. Imported presets can contain arbitrary properties in their
    `style` that bypass the whitelist.
- **Fix:** Call `this.sanitizeStyle(preset.style)` on each imported
    preset before pushing.

#### P3-174 · `updateLayer` Floods Undo History During Rapid Changes

- **File:** `resources/ext.layers.editor/LayersEditor.js` L982–983
- **Code:** `this.markDirty(); this.saveState( 'Update layer' );`
- **Issue:** Every `updateLayer()` call creates a new undo history
    state. When rapidly changing properties (dragging slider for
    opacity, font size, stroke width), each intermediate value creates
    a separate undo entry. Canvas redraw is properly rAF-throttled but
    `saveState` is not. Users may need 50+ undo presses to reverse a
    single slider drag.
- **Fix:** Debounce `saveState` in `updateLayer`, or use the existing
    batch mode (`startBatch`/`endBatch`) for slider interactions.

#### P3-175 · `duplicateSelected` Fallback Only Offsets x/y

- **File:** `resources/ext.layers.editor/LayersEditor.js` L1335–1353
- **Issue:** The fallback `duplicateSelected` (when SelectionManager
    unavailable) only offsets `x/y`. For `arrow/line/dimension` (which
    use `x1/y1/x2/y2`), `path` (`points` array), and
    `angleDimension` (`cx/cy/ax/ay/bx/by`), the duplicate overlaps
    exactly. Compare with `ClipboardController.applyPasteOffset()`.
- **Impact:** Fallback path only; affects edge cases where
    SelectionManager is absent.

### Low — JavaScript (Code Quality)

#### P3-176 · Duplicate `/**` JSDoc in CanvasManager

- **File:** `resources/ext.layers.editor/CanvasManager.js` L866–867
- **Code:** `/** \n /**`
- **Issue:** Duplicate JSDoc opening tag on consecutive lines. Confuses
    documentation generators.
- **Fix:** Remove the duplicate `/**` on line 866.

#### P3-177 · `SelectionManager.getLayerAtPoint` Inconsistent Visibility Check

- **File:** `resources/ext.layers.editor/SelectionManager.js` ~L793
- **Code:** `if ( layer.visible === false ) { continue; }`
- **Issue:** Only checks `visible === false`, not `visible === 0`.
    While `LayerDataNormalizer` converts `0→false` on API load, layers
    created locally (clipboard paste, undo/redo) could bypass
    normalization. Four other hit-test locations use different checks.
- **Fix:** Standardize visibility checking across all modules.
    Consider a shared `isLayerInteractable(layer)` utility.

#### P3-178 · `BackgroundLayerController` CSS Injection via cssText

- **File:**
    `resources/ext.layers.editor/ui/BackgroundLayerController.js`
    L109
- **Code:** `colorIcon.style.cssText = \`...background-color:
    ${ currentColor };\``
- **Issue:** Color value from state is interpolated directly into
    `style.cssText` template literal. If a crafted color value reached
    state (e.g., via malicious JSON import), it could inject arbitrary
    CSS properties. The same pattern appears at L362.
- **Fix:** Use single-property assignment:
    `colorIcon.style.backgroundColor = currentColor;`

### Low — PHP (Defense in Depth)

#### P3-179 · `deleteNamedSet` Missing `FOR UPDATE` Lock

- **File:** `src/Database/LayersDatabase.php` L801
- **Issue:** `deleteNamedSet()` performs DELETE without a preceding
    `SELECT ... FOR UPDATE`. Unlike `renameNamedSet()` (~L907) which
    correctly locks rows first, a concurrent rename could interleave:
    rename checks existence → no conflict → delete runs → rename
    completes. The comment at L800 claims it "mirrors renameNamedSet
    pattern" but the locking does not. The `startAtomic()` prevents
    overlapping statements but does not provide row-level locking.
- **Fix:** Add `SELECT ... FOR UPDATE` before the DELETE.

#### P3-180 · `EditLayersAction` Restrictive `returnTo` Namespace Allowlist

- **File:** `src/Action/EditLayersAction.php` L101
- **Code:** `$allowedNamespaces = [ NS_MAIN, NS_FILE, NS_FILE_TALK,
    NS_SPECIAL ];`
- **Issue:** Silently drops `returnTo` for legitimate namespaces
    (NS_TALK, NS_PROJECT, NS_USER, NS_CATEGORY, NS_HELP, NS_TEMPLATE).
    Users editing layers from pages in these namespaces lose their
    return URL. `Title::getLocalURL()` already prevents open redirects.
- **Fix:** Remove the allowlist; rely on `Title::isValid()` +
    `Title::getLocalURL()` which guarantee local URLs.

#### P3-181 · `ApiLayersRename` vs `ApiLayersDelete` Inconsistent Defaults

- **File:** `src/Api/ApiLayersRename.php` L55 vs
    `src/Api/ApiLayersDelete.php` L52
- **Issue:** `ApiLayersRename` defaults `$requestedFilename` to `''`
    (empty string); `ApiLayersDelete` defaults to `null`. The subsequent
    empty-check logic also differs. Both work correctly in practice
    since MediaWiki parameter extraction always returns a string, but
    the inconsistency creates maintenance hazard.
- **Fix:** Standardize both modules to use the same default and check.

#### P3-182 · `SlideHooks` Static Cache Survives Abnormal Request Termination

- **File:** `src/Hooks/SlideHooks.php` L56–60
- **Issue:** `$slideDimensionCache` and `$slideQueryCount` are static
    and reset only via `onParserClearState()`. In PHP-FPM, if a request
    dies abnormally (timeout, OOM) before `ParserClearState` fires,
    stale cache persists into the next request. Different from
    `WikitextHooks` which has its own request-boundary detection.
- **Impact:** Edge case; poisoned cache could serve wrong canvas
    dimensions from a prior request.

#### P3-183 · `StaticLoggerAwareTrait` Logger Not Refreshed After Service Reset

- **File:** `src/Logging/StaticLoggerAwareTrait.php` L42
- **Issue:** `getLogger()` initializes `$staticLogger` once and never
    refreshes. In long-running processes (job queue), if
    `MediaWikiServices` is reset, the cached logger points to a
    destroyed service instance.
- **Impact:** Edge case; only affects job queue or maintenance scripts
    with service resets.

### Low — JavaScript (Memory Leak Potential)

#### P3-184 · `RichTextToolbar.destroy()` Incomplete Listener Cleanup

- **File:**
    `resources/ext.layers.editor/canvas/RichTextToolbar.js` L272
- **Issue:** `destroy()` removes the drag handle listener and DOM
    element but doesn't null out child-element references
    (`editorElement`, `containerElement`, `layer`). Anonymous event
    listeners on child buttons (font select, size input, bold, italic,
    highlight, color, alignment) are never explicitly removed. Since
    the toolbar element is removed from DOM and `toolbarElement` is
    nulled, GC should collect in most cases, but closure-captured
    `this` references could form leaked chains.
- **Fix:** Null out all references in `destroy()`.

#### P3-185 · `HelpDialog` Keydown Listener Leak on Re-open

- **File:**
    `resources/ext.layers.editor/editor/HelpDialog.js` L97
- **Issue:** `show()` registers a new `keydown` listener each time.
    If `show()` is called twice without `close()`, the old listener
    reference is overwritten without removal, leaking one handler per
    extra `show()` call.
- **Fix:** Remove existing listener before adding new one.

### Documentation Drift — 13 Items

#### D-059-01 · Coverage Numbers Wrong Across 8+ Files (94.54% → 92.88%)

- **Files affected:** `CHANGELOG.md` L25, `codebase_review.md` (header,
    summary), `copilot-instructions.md`, `README.md`, `wiki/Home.md`,
    `wiki/Changelog.md`, `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** CHANGELOG v1.5.63 claims "Coverage: 94.54% stmts, 84.53%
    branches (was 92.88% / 82.58%)". Fresh `npx jest --coverage` on
    March 24, 2026 confirms actual coverage is **92.88% stmts, 82.58%
    branches** — identical to v1.5.62. The claimed coverage improvement
    was never committed. All files referencing 94.54%/84.53% are wrong.
- **Evidence:** `coverage/coverage-summary.json` generated March 24,
    2026 shows 92.88%/82.58%/91.57%/92.97%.
- **Severity:** HIGH — wrong metrics propagated across the entire
    documentation surface.

#### D-059-02 · i18n Key Count Wrong Across 5+ Files (786 → 835)

- **Files affected:** `codebase_review.md`, `copilot-instructions.md`,
    `wiki/Home.md` (says 780), `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** Multiple documents claim 786 keys. Actual count is 835
    (excluding @metadata, verified via
    `Object.keys(en.json).filter(k=>k!=='@metadata').length`). The v58
    "fix" D-058-05 corrected 780→786, but 786 was also wrong.
- **Severity:** HIGH

#### D-059-03 · `Mediawiki-Extension-Layers.mediawiki` Stale Test Metrics

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** Shows "11,847 Jest tests (168 suites) with 92.88%
    statement coverage" — tests should be 11,910 in 169 suites.
- **Severity:** HIGH — public-facing MW.org page.

#### D-059-04 · `docs/SLIDES_REQUIREMENTS.md` Says "Planning Phase"

- **File:** `docs/SLIDES_REQUIREMENTS.md` L4
- **Current text:** "Status: Planning Phase — All implementations were
    corrupted/lost and need to be rebuilt"
- **Should be:** "Status: ✅ Implemented (v1.5.22+)" — Slide Mode is
    a fully shipping feature with SlideController (1,126 lines),
    SpecialSlides, SpecialEditSlide, and 37+ E2E tests.
- **Severity:** HIGH — seriously misleading.

#### D-059-05 · `docs/FUTURE_IMPROVEMENTS.md` Lists Angle Dimension as Proposed

- **File:** `docs/FUTURE_IMPROVEMENTS.md` L11
- **Current text:** "Status: ⏳ Proposed (January 25, 2026)"
- **Should be:** "Status: ✅ Implemented" — `AngleDimensionRenderer.js`
    exists (1,067 lines), `angleDimension` type used throughout editor
    code, listed in copilot-instructions as established god class.
- **Severity:** HIGH

#### D-059-06 · `Mediawiki-layer_set_usage-table.mediawiki` Documents Removed Table

- **File:** `Mediawiki-layer_set_usage-table.mediawiki`
- **Issue:** Documents the `layer_set_usage` table structure as if it
    exists. Table was removed in v1.5.63 (P3-146). Migration
    `patch-drop-layer_set_usage.sql` drops it.
- **Severity:** HIGH — documents a non-existent table.

#### D-059-07 · `CONTRIBUTING.md` Stale Test Count (11,847 → 11,910)

- **File:** `CONTRIBUTING.md` L24
- **Current text:** "92.88% coverage, 11,847 tests"
- **Should be:** "92.88% coverage, 11,910 tests"
- **Severity:** MEDIUM

#### D-059-08 · `docs/KNOWN_ISSUES.md` Version Reference (v1.5.62 → v1.5.63)

- **File:** `docs/KNOWN_ISSUES.md` L3
- **Current text:** "v1.5.62 (v58 audit)"
- **Should be:** "v1.5.63"
- **Severity:** MEDIUM

#### D-059-09 · `docs/ARCHITECTURE.md` 8+ Stale Metrics

- **File:** `docs/ARCHITECTURE.md`
- **Issue:** Version 1.5.62, Last Updated March 14, 2026, 158 JS
    files, ~113,550 JS lines, ~15,216 PHP lines, stale coverage,
    stale test counts. Version should be 1.5.63; JS files 159;
    lines ~113,699; PHP ~15,205; tests 11,910/169 suites.
- **Severity:** MEDIUM

#### D-059-10 · `docs/GOD_CLASS_REFACTORING_PLAN.md` Very Stale Metrics

- **File:** `docs/GOD_CLASS_REFACTORING_PLAN.md`
- **Issue:** Shows 17 god classes, 11,148 tests, 95.19% stmt, 84.96%
    branch. Actual: 26 god classes, 11,910 tests, 92.88%/82.58%.
- **Severity:** MEDIUM — planning document with wildly stale numbers.

#### D-059-11 · `docs/PROJECT_GOD_CLASS_REDUCTION.md` Stale Metrics

- **File:** `docs/PROJECT_GOD_CLASS_REDUCTION.md`
- **Issue:** Shows 13 hand-written JS god classes, 11,148 tests,
    95.19%. Actual: 19 JS god classes, 11,910 tests, 92.88%.
- **Severity:** MEDIUM

#### D-059-12 · `docs/ACCESSIBILITY.md` Missing M and D Shortcuts

- **File:** `docs/ACCESSIBILITY.md`
- **Issue:** Tool shortcuts table lists V, T, X, P, R, C, E, Y, S, A,
    L, B but omits M (Marker) and D (Dimension), both documented in
    README.md's Drawing Tools table.
- **Severity:** MEDIUM — incomplete keyboard reference.

#### D-059-13 · `wiki/Home.md` i18n Count Shows 780

- **File:** `wiki/Home.md`
- **Issue:** Shows "i18n Messages: 780". Should be 835.
    Different wrong number than other files (which say 786).
- **Severity:** MEDIUM

---

## v59 Verified Non-Issues (False Positives Eliminated)

- **`SlideHooks.buildSlideHtml` CSS injection via `$backgroundColor`:**
  **FALSE POSITIVE** — `$backgroundColor` comes from either
  `$wgLayersSlideDefaultBackground` (admin config) or wikitext params
  validated via `ColorValidator::isValidColor()` (strict regex patterns
  for hex/rgb/rgba/hsl/hsla and exact named color matching).
  `htmlspecialchars()` applied to the full style string prevents
  attribute breakout. No realistic injection vector exists.

- **`LayersViewer.scaleLayerCoordinates` shallow copy data corruption:**
  **FALSE POSITIVE** — The `points` array uses `.map()` which creates
  a new array; `gradient` and `richText` are deep-cloned. No mutation
  of original data occurs.

- **`SpecialSlides.editSlide` URL construction with slash names:**
  **FALSE POSITIVE** — `mw.util.getUrl()` handles URL encoding; server
  validates slide names. No open redirect or path traversal.

- **LayerRenderer.js >= 1000 lines (god class miscount):** **FALSE
  POSITIVE** — `wc -l` reports 999 lines, below the 1000-line
  threshold. God class count of 26 (5 generated, 19 JS, 2 PHP) is
  correct.

- **JS file count 157 vs 159:** **FALSE POSITIVE** — 159 includes
  `resources/dist/` (2 webpack output files). copilot-instructions
  correctly states "159 in `resources/` including `resources/dist`".

- **`ImportExportManager.parseLayersJSON` prototype pollution:** **LOW
  PRIORITY** — `JSON.parse()` own properties are handled; server
  validates/strips unknown properties on save. Client-side-only data
  path with limited impact.

- **`DialogManager` pending Promise on forced destroy:** **ACCEPTED** —
  `closeAllDialogs()` in `destroy()` removes all listeners. Pending
  Promise resolving is a Nice-to-have, not a material leak since the
  Promise and closure are small.

- **`pruneOldRevisions` SQL string concatenation:** **ACCEPTED** —
  `$safeKeepIds` are integers from the same table query; `makeList()`
  ensures proper escaping. Not exploitable.

- **`StaticLoggerAwareTrait` per-class static isolation:** **CLARIFIED**
  — PHP traits create separate static properties per using class. Each
  class gets its own `$staticLogger`, not a shared one.

---

## Confirmed Findings (v58 — March 23, 2026) — 10 Items

### v58 note

All v58 code fixes (P3-163, P3-164, P3-165) confirmed intact.
All v58 doc drift fixes (D-058-01 through D-058-07) confirmed intact.

#### P3-163 · `_cloneLayer()` Duplicated Across 3 Canvas Controllers

- **Files:**
    - `resources/ext.layers.editor/canvas/InteractionController.js` L72–91
    - `resources/ext.layers.editor/canvas/TransformController.js` L80–92
    - `resources/ext.layers.editor/canvas/ClipboardController.js` L49–61
- **Issue:** Three independent `_cloneLayer()` implementations exist
    across canvas controllers. `InteractionController` and
    `TransformController` share near-identical code using
    `window.Layers.Utils.cloneLayerEfficient` with a lazy-init cache
    and JSON.parse/stringify fallback. `ClipboardController` uses a
    different utility function (`window.Layers.Utils.deepCloneLayer`)
    with a different fallback chain that includes `structuredClone`.
    The implementations also differ in null-checking:
    `InteractionController` checks `if (!layer)` while
    `TransformController` does not.
- **Fix:** Simplified all 3 controllers to call
    `window.Layers.Utils.cloneLayerEfficient` directly. Removed
    lazy-init cache pattern and `structuredClone` fallback.
    ClipboardController upgraded from `deepCloneLayer` to
    `cloneLayerEfficient` for consistency and performance.
- **Status:** ✅ Fixed

#### P3-164 · `PropertyBuilders.js` 7 Untracked `setTimeout(0)` Calls

- **File:** `resources/ext.layers.editor/ui/PropertyBuilders.js`
    L272, L467, L658, L1416, L1451, L1735, L1769
- **Code Example:**
    ```javascript
    setTimeout( function () {
        input.focus();
    }, 0 );
    ```
- **Issue:** Seven `setTimeout(fn, 0)` calls are scattered throughout
    the file for deferred focus/scroll operations. None store the
    timeout ID or register for cleanup on editor destruction. If the
    editor is destroyed between the `setTimeout` call and the callback
    execution, the callbacks may reference detached DOM nodes. The
    callbacks execute harmlessly (DOM ops on detached nodes are no-ops),
    so there is no crash risk, but this is a code quality issue.
- **Fix:** Extracted `deferPanelRefresh(editor, layerId)` helper
    function. All 7 identical `setTimeout` blocks replaced with
    single-line calls to the helper. Centralizes the guard logic
    and eliminates code duplication.
- **Status:** ✅ Fixed

#### P3-165 · `CanvasManager.continueDrawing()` Untracked `requestAnimationFrame`

- **File:** `resources/ext.layers.editor/CanvasManager.js` ~L1732–1744
- **Issue:** `continueDrawing()` calls `requestAnimationFrame()` without
    storing the returned frame ID. The `_drawingFrameScheduled` flag and
    `isDestroyed` guard prevent harmful behavior, but the frame cannot be
    explicitly cancelled on tool switch or editor destruction. The guard
    pattern is effective — the untracked RAF will simply check `isDestroyed`
    and return without doing work — so this is purely a best-practices
    concern.
- **Fix:** Stored RAF ID in `this._drawingRafId`. Added explicit
    `cancelAnimationFrame` in `destroy()`, following the existing
    pattern used for `animationFrameId` and `_transformRafId`.
- **Status:** ✅ Fixed

### Low — Documentation Drift (7 Items)

#### D-058-01 · CHANGELOG.md v1.5.62 Coverage Numbers Wrong

- **File:** `CHANGELOG.md` L34
- **Current text:** "Coverage: 94.4% statements, 84.33% branches,
    93.38% functions"
- **Actual verified values:** 92.88% statements, 82.58% branches,
    91.57% functions (from `coverage/coverage-summary.json`)
- **Status:** ✅ **Fixed** (this v58 review)

#### D-058-02 · wiki/Changelog.md v1.5.62 Coverage Numbers Wrong

- **File:** `wiki/Changelog.md` L34
- **Issue:** Same incorrect coverage numbers as D-058-01.
- **Status:** ✅ **Fixed** (this v58 review)

#### D-058-03 · Mediawiki-Extension-Layers.mediawiki Stale Update Date

- **File:** `Mediawiki-Extension-Layers.mediawiki` L12
- **Current text:** `|update = 2026-03-14`
- **Should be:** `|update = 2026-03-17` (date of v1.5.62 release per
    CHANGELOG and README)
- **Status:** ✅ **Fixed** (this v58 review)

#### D-058-04 · CHANGELOG.md vs wiki/Changelog.md Content Divergence

- **Files:** `CHANGELOG.md` L78, L119–121 vs `wiki/Changelog.md`
    L78, L119–121
- **Issue:**
    - L78: CHANGELOG had "Brittile" (typo), wiki has "Brittle" (correct)
    - L119–121 (v1.5.60 Technical Details): CHANGELOG says "11,421 tests
      (167 suites), 92.19% stmts, 23 god classes" while wiki says
      "11,258 tests (163 suites), 95.19% stmts, 17 god classes" —
      completely different numbers for the same release
    - Per `docs/DOCUMENTATION_UPDATE_GUIDE.md`, these files must mirror
      each other
- **Status:** ✅ **Fixed** — typo corrected; v1.5.59 metric divergence
    resolved (wiki/Changelog.md updated to match CHANGELOG.md)

#### D-058-05 · codebase_review.md i18n Key Count Stale (780 → 786)

- **File:** `codebase_review.md` L30
- **Issue:** Reported 780 `layers-` keys in en.json/qqq.json. Actual
    verified count: 786 in each file (+6 keys since v57).
- **Status:** ✅ **Fixed** (this v58 review — updated L30)

#### D-058-06 · codebase_review.md PHP Line Count Stale (~15,216 → ~15,174)

- **File:** `codebase_review.md` L28
- **Issue:** Reported ~15,216 PHP lines. Actual verified count: ~15,174
    (−42 lines, likely from the `getDescription()` fix commit 5ccacd54).
- **Status:** ✅ **Fixed** (this v58 review — updated L28)

#### D-058-07 · copilot-instructions.md PHP Line Count Stale (~15,216 → ~15,174)

- **File:** `.github/copilot-instructions.md` (Section 12 metrics)
- **Current text:** "PHP file count (41 files, ~15,216 lines)"
- **Should be:** "PHP file count (41 files, ~15,174 lines)"
- **Status:** ✅ Fixed

### Carried Forward

- **P3-146:** Dead `layer_set_usage` table — ✅ Removed (v1.5.63 sprint)
- **P3-147:** Redundant SQL variants — accepted per CHANGELOG
- **P3-148:** Unused `LayerValidatorInterface` — deferred

---

## v58 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during
this v58 review but verified as non-issues by reading the actual
source code:

- **`RenderCoordinator` fallbackTimeoutId leak:** **FALSE POSITIVE** —
  `destroy()` at L480–482 clears the timeout ID properly.

- **`DrawingController` geometry normalization missing:** **FALSE
  POSITIVE** — `createLayerFromDrawing()` at L819 properly normalizes
  with `Math.abs()` and origin adjustment; `isValidShape()` rejects
  zero-size shapes.

- **`CanvasEvents` event listener cleanup gap:** **FALSE POSITIVE** —
  `destroy()` at L62–79 properly removes ALL listeners including
  document-level ones.

- **`ColorValidator::isValidColor()` missing static method:** **FALSE
  POSITIVE** — Method exists at L324 of `ColorValidator.php`.

- **`DraftManager` subscription leak:** **FALSE POSITIVE** —
  `destroy()` at L503 calls `this.stateSubscription()` to unsubscribe.

- **`ImageLayerRenderer` reference cycle memory leak:** **FALSE
  POSITIVE** — `clearCache()` and `_imageCache` null guard are proper
  mitigation; standard JS caching pattern.

- **`ApiLayersInfo` enrichWithUserNames null dereference:** **FALSE
  POSITIVE** — MediaWiki's `UserFactory::newFromId()` always returns
  a User object (may be anonymous user but never null).

- **`PresetDropdown` state inconsistency on rapid tool switch:** **FALSE
  POSITIVE** — Would require sub-millisecond tool switching before click
  handler completes; effectively impossible in practice.

- **`SVG` metadata element blocking font loading:** **FALSE POSITIVE** —
  SVG shapes are rendered via Canvas API (drawImage), not inserted into
  the DOM. Metadata elements are never parsed by the browser.

- **`InlineTextEditor.js` innerHTML with `RichTextConverter.richTextToHtml()`
  XSS:** **FALSE POSITIVE** — `richTextToHtml()` escapes all text content
  via `escapeHtml()` (DOM `textContent`→`innerHTML` pattern) and all CSS
  values via `escapeCSSValue()` (strips dangerous characters, blocks
  `url()`/`expression()`/`javascript()` keywords). Properly protected.

- **`RichTextToolbar.js` innerHTML with template literal color:**
  **FALSE POSITIVE** — Colors come from browser `<input type="color">`
  (returns `#rrggbb` by spec), hardcoded swatch values, or server-validated
  layer data. No realistic injection vector.

---

## Confirmed Findings (v57 — March 17, 2026) — 8 New Issues Found

#### D-057-03 · `docs/ARCHITECTURE.md` God Class Section Heading Inconsistent

- **File:** `docs/ARCHITECTURE.md` L100
- **Issue:** Summary table at L37 correctly states 26 god classes, but
    the section heading at L100 says "God Classes (17 Files ≥1,000 Lines)"
    and only lists ~17 files. The actual count is 26 (5 generated + 19
    hand-written JS + 2 PHP). 6 files that have grown past 1,000 lines
    since the section was written are missing from the list.
- **Status:** ✅ **Fixed** (v1.5.62)

#### D-057-04 · `docs/SLIDE_MODE.md` Stale Version Reference

- **File:** `docs/SLIDE_MODE.md` L5–6
- **Issue:** States "Date: January 31, 2026" and "Current Release:
    v1.5.59". Current version is v1.5.62.
- **Status:** ✅ **Fixed** (v1.5.62)

#### D-057-05 · `docs/NAMED_LAYER_SETS.md` Confusing Version Metadata

- **File:** `docs/NAMED_LAYER_SETS.md` L3–5
- **Issue:** States "Version: 1.3 (v40 verification refresh)" and
    "Status: ✅ Implemented (verified on v1.5.59)". Current version
    is v1.5.62. The "Version: 1.3" refers to the feature document
    version, not the extension version, which is confusing.
- **Status:** ✅ **Fixed** (v1.5.62)

---

## v57 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during
this v57 review but verified as non-issues by reading the actual
source code:

- **`HitTestController` boolean equality bug (layer.visible === false
  fails for integer 0):** **FALSE POSITIVE** — `LayerDataNormalizer`
  runs at data load time in `APIManager.processRawLayers()`, converting
  integer 0/1 to boolean false/true. All downstream code receives
  normalized booleans.

- **`APIManager.processRawLayers()` undefined method:** **FALSE
  POSITIVE** — Method IS defined at L538 of APIManager.js as a class
  method. Called at L480.

- **`EffectsRenderer` GPU memory leak via temp canvases:** **FALSE
  POSITIVE** — Temp canvases are cached in instance variables
  (`_blurCanvas`, `_blurFillCanvas`) and reused across frames. No
  per-frame allocation.

- **`TransformController` RAF memory leak:** **FALSE POSITIVE** —
  All RAF IDs (`_resizeRafId`, `_dragRafId`, `_rotationRafId`,
  `_arrowTipRafId`) are cancelled in `destroy()` at L1134–1150.

- **`ViewerManager` concurrency limiter broken:** **FALSE POSITIVE**
  — `_processWithConcurrency()` uses standard recursive-chain pattern
  that correctly limits concurrency to `limit` parallel chains.

- **`LayersLightbox` close timeout race condition:** **FALSE
  POSITIVE** — Fixed in prior version. `open()` already clears
  `closeTimeoutId` before creating new overlay at L120–125.

- **`DraftManager` silent data loss:** **FALSE POSITIVE** — Errors
  ARE logged via `mw.log.warn()` at L226–231 and method returns
  `false`.

- **`APIManager` cache key collision:** **FALSE POSITIVE** — Cache
  key separators (`:id:`, `:set:`, `:default`) are distinct enough
  to prevent collisions.

- **`PropertiesForm` input value not updated after clamping:** **FALSE
  POSITIVE** — Input value IS updated after clamping, confirmed at
  L247–275. Both `change` and `blur` handlers update displayed value.

- **`ViewerManager` WeakMap wrapper cleanup:** **FALSE POSITIVE** —
  WeakMap correctly enables GC of image elements and their wrappers.

- **`SetNameSanitizer` can return empty string:** **FALSE POSITIVE**
  — `sanitize()` at L45–67 returns `DEFAULT_SET_NAME` ('default')
  when all characters are stripped.

- **`ApiLayersRename` TOCTOU race in renameNamedSet():** **FALSE
  POSITIVE** — `renameNamedSet()` correctly uses `startAtomic()` +
  `FOR UPDATE` locks, preventing concurrent rename conflicts.

---

## Confirmed Findings (v56 — March 16, 2026) — 13 New Issues Found

### v55 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P1-058 | ✅ Fixed v1.5.62 | `use LayersConstants` import added |
| P2-128 | ✅ Fixed v1.5.62 | API modules use trait helpers |
| P2-129 | ✅ Fixed v1.5.62 | User enrichment deduplicated |
| P2-130 | ✅ Fixed v1.5.62 | try-catch for JSON fallback |
| P2-131 | ✅ Fixed v1.5.62 | Delta clamp scaled |
| P2-132 | ❌ False positive | Already uses bounding box |
| P3-153 | ✅ Fixed v1.5.62 | LRU cache promotion |
| P3-154 | ✅ Fixed v1.5.62 | Cached div for escaping |
| P3-155 | ❌ False positive | ARIA roles present |
| P3-156 | ❌ False positive | Dialog attributes present |
| P3-146 | 🔲 Open | Dead table (still carried) |
| P3-147 | 🔲 Open | Redundant SQL (still carried) |
| P3-148 | 🔲 Deferred | Unused interface (carried) |
| D-055-01 | ✅ Fixed | Slide config documented |
| D-055-02 | ✅ Fixed | MW.org page updated |

### v54 Quick-Reference Table

| ID | Status | Notes |
|----|--------|-------|
| P1-057 | ✅ Fixed v1.5.62 | IDOR ownership check in all 3 processor files |
| P2-124 | ✅ Fixed v1.5.62 | `enrichRowsWithUserNames` uses UserFactory |
| P2-125 | ✅ Fixed v1.5.62 | `EditLayersAction` delegates to SetNameSanitizer |
| P2-126 | ✅ Fixed v1.5.62 | Arrow key `defaultPrevented` check added |
| P2-127 | ✅ Fixed v1.5.62 | TextRenderer shadow cleared after strokeText |
| P3-150 | ✅ Fixed v1.5.62 | ShadowRenderer `_tempCanvas` nulled in destroy |
| P3-151 | ✅ Fixed v1.5.62 | ImageLayerRenderer `_destroyed` guard added |
| P3-152 | ✅ Fixed v1.5.62 | EffectsRenderer `Math.max(1, ...)` guard |
| P3-146 | ✅ Fixed v1.5.63 | Dead `layer_set_usage` table removed |
| P3-147 | 🔲 Open | Redundant SQL name variants (carried forward) |
| P3-148 | 🔲 Deferred | Unused `LayerValidatorInterface` (low priority) |
| P3-149 | ❌ False positive | Upstream validates; no bypass path |
| D-054-01..14 | ✅ Fixed | All 14 doc metric drift items corrected |

---

### New Findings (v56) — 13 Items

**Audit scope:** All 41 PHP source files (`src/`), all 156 JS modules
(`resources/ext.layers*`), all documentation and mediawiki files.
Main branch, HEAD `82bdca3d`.

**Methodology:** Multi-pass review with 4 specialized subagent sweeps
(PHP API modules, PHP core/database/validation, JS core editor/canvas/
renderers, JS UI/toolbar/presets) plus 2 targeted verification passes.
9 false positives eliminated during verification (see Verified
Non-Issues section below).

### High — JavaScript

#### P1-059 · `RichTextConverter.escapeCSSValue()` Insufficient Escaping

- **File:** `resources/ext.layers.editor/canvas/RichTextConverter.js`
    L60–63
- **Code:**
    ```javascript
    static escapeCSSValue( value ) {
        return String( value ).replace( /["'<>&;{}\\]/g, '' );
    }
    ```
- **Impact:** The function blocks quotes, braces, angle brackets,
    semicolons, and backslashes — but does NOT block `url()`,
    `javascript:`, `expression()`, or parentheses. A malicious
    rich text style value like `url(javascript:alert(1))` would
    pass through escaping intact. The escaped output is used in
    inline `style` attribute construction for rich text rendering.
    This is a defense-in-depth gap — upstream validation (server-side
    whitelist + ColorValidator) currently blocks most attack vectors,
    but the escaping function itself is incomplete for CSS contexts.
- **Fix:** Add parentheses blocking and keyword rejection:
    ```javascript
    static escapeCSSValue( value ) {
        let safe = String( value ).replace( /["'<>&;{}()\\]/g, '' );
        safe = safe.replace( /url|expression|javascript/gi, '' );
        return safe;
    }
    ```
- **Status:** ✅ **Fixed v56** — Added `url`/`expression`/`javascript` keyword blocking while preserving `rgb()`/`hsl()` parentheses.

#### P1-060 · `ErrorHandler` Missing Recursion Guard

- **File:** `resources/ext.layers.editor/ErrorHandler.js` L75–95
- **Code:** `setupGlobalErrorHandler()` registers `unhandledrejection`
    and `error` listeners that call `handleError()`. `handleError()`
    calls `showUserNotification()` (DOM operations), `logError()`,
    and attempts recovery. None of these internal calls are guarded
    against throwing.
- **Impact:** If `showUserNotification()` or `logError()` throws
    (e.g., DOM is in torn-down state during page unload, or
    `mw.log` is unavailable), the thrown error triggers the global
    handler again, which calls `handleError()` again, causing
    infinite recursion. This freezes the browser tab with a stack
    overflow. The risk is elevated because `destroy()` calls
    happen during page teardown when DOM state is unreliable.
- **Fix:** Add a recursion guard:
    ```javascript
    handleError( error, context ) {
        if ( this._isHandlingError ) return;
        this._isHandlingError = true;
        try {
            // existing logic
        } finally {
            this._isHandlingError = false;
        }
    }
    ```
- **Status:** ✅ **Fixed v56** — Added `_isHandlingError` recursion guard with try/finally.

### Medium — JavaScript (Security/Defense-in-Depth)

#### P2-133 · `PresetDropdown` innerHTML with `getMessage()` Output

- **File:** `resources/ext.layers.editor/presets/PresetDropdown.js`
    L126, L285
- **Code:**
    ```javascript
    this.elements.button.innerHTML =
        `<span>${this.getMessage( 'layers-presets' )}</span>`;
    ```
- **Impact:** `getMessage()` returns i18n message text. While
    MediaWiki i18n messages are typically safe (controlled by wiki
    admins), injecting them via `innerHTML` violates defense-in-depth.
    If a translation contains HTML entities or a wiki is compromised
    to inject malicious translations, this becomes an XSS vector.
- **Fix:** Use `textContent` or DOM API:
    ```javascript
    const span = document.createElement( 'span' );
    span.textContent = this.getMessage( 'layers-presets' );
    this.elements.button.replaceChildren( span );
    ```
- **Status:** ✅ **Fixed v56** — Replaced innerHTML with DOM API (createElement + textContent + appendChild) at both locations.

#### P2-134 · `PresetStorage.load()` No Schema Validation After Parse

- **File:** `resources/ext.layers.editor/presets/PresetStorage.js`
    L99–106
- **Code:** After `JSON.parse( stored )`, only checks
    `parsed.version === SCHEMA_VERSION` and returns `parsed.presets`
    without validating the structure of `presets` entries (type,
    required fields, value ranges).
- **Impact:** Malformed localStorage data (from manual editing,
    browser extensions, or extension version mismatch) could inject
    unexpected property types into the preset system, potentially
    causing runtime errors or CSS injection through style values.
- **Fix:** Validate each preset entry's structure before returning:
    check `name` is string, `styles` is plain object, color values
    pass ColorValidator.
- **Status:** ✅ **Fixed v56** — Added `_validateSchema()` that checks toolPresets structure and each preset's name/style fields.

#### P2-135 · `LayerPanel.updateSwatchColor()` CSS Injection via Color Value

- **File:** `resources/ext.layers.editor/LayerPanel.js` L309–323
- **Code:**
    ```javascript
    swatch.style.cssText = baseStyles +
        ' background-color: ' + color + ';';
    ```
- **Impact:** The `color` value is concatenated directly into
    `cssText` without sanitization. If a layer's color property
    contains a CSS injection payload (e.g., `red; position:fixed;
    z-index:9999`), it would be applied to the swatch element.
    Server-side ColorValidator blocks most payloads, but client-side
    code should also sanitize as defense-in-depth.
- **Fix:** Use `swatch.style.backgroundColor = color;` which
    is automatically sanitized by the browser's CSS parser.
- **Status:** ✅ **Fixed v56** — Replaced cssText concatenation with `swatch.style.backgroundColor = color`.

### Medium — JavaScript (Bugs/Robustness)

#### P2-136 · `init.js` `wikipage.content` Hook Registered Without Guard

- **File:** `resources/ext.layers/init.js` L107–118
- **Code:** `mw.hook( 'wikipage.content' ).add( () => { ... } )`
    is called without a guard flag or matching `.remove()`. The
    adjacent `layers-modal-closed` listener HAS a
    `_modalClosedListenerRegistered` guard, but this hook does not.
- **Impact:** If `init.js` is loaded multiple times (e.g., via
    dynamic content injection or SPA-style navigation), the hook
    callback accumulates, causing duplicate viewer initialization
    on each `wikipage.content` fire.
- **Status:** ✅ **Fixed v56** — Added `_contentHookRegistered` guard flag.

### Medium — JavaScript (Performance)

#### P2-137 · `RenderCoordinator` JSON.stringify Per Dirty Check

- **File:**
    `resources/ext.layers.editor/canvas/RenderCoordinator.js`
    L263–265
- **Code:**
    ```javascript
    hash += JSON.stringify( layer.richText );
    hash += JSON.stringify( layer.gradient );
    hash += JSON.stringify( layer.points );
    ```
- **Impact:** Three `JSON.stringify()` calls per layer, executed on
    every potential redraw (mouse move, scroll, animation frame).
    With 50 layers containing rich text and gradients, this creates
    significant GC pressure. The hash comparison itself is a net win
    (skips full redraw when unchanged), but the hashing method is
    unnecessarily expensive.
- **Fix:** Use a cheaper comparison — e.g., version counter on
    layer mutation, or cache the last-computed hash per layer and
    recompute only when a mutation flag is set.
- **Status:** ✅ **Fixed v56** — Added WeakMap-based `_cachedStringify()` that caches JSON output by object reference.

### Low — JavaScript (Code Quality)

#### P3-157 · `GradientEditor._applyPreset()` No Validation

- **File:** `resources/ext.layers.editor/ui/GradientEditor.js`
    L237–280
- **Issue:** `_applyPreset()` calls `_cloneGradient( preset )`
    and applies the result without validating types, ranges, or
    structure. Built-in presets are currently safe (internal
    constants), but the pattern is fragile if presets become
    user-extensible.
- **Impact:** Low — internal presets only. Defense-in-depth gap.
- **Status:** ✅ **Fixed v56** — Added structure validation (colors array, offset range checks) before applying.

#### P3-158 · `LayerItemFactory` `role="button"` Without Keyboard Support

- **File:**
    `resources/ext.layers.editor/ui/LayerItemFactory.js` L250
- **Code:** `name.setAttribute( 'role', 'button' )` is set but
    no `tabindex="0"` or keyboard event handler is added.
- **Impact:** WCAG 2.1 Level A failure — screen reader users
    announced a button they cannot activate with keyboard.
- **Fix:** Add `tabindex="0"` and Enter/Space key handler.
- **Status:** ✅ **Fixed v56** — Added `tabindex="0"` and keydown handler dispatching synthetic dblclick.

### Low — JavaScript (Coverage Gaps)

#### P3-159 · `HelpDialog.js` Zero Test Coverage

- **File:** `resources/ext.layers.editor/editor/HelpDialog.js`
- **Issue:** 172 lines, 24 functions, 49 branches — zero test
    coverage. HelpDialog handles keyboard shortcut display and
    category rendering.
- **Impact:** Any regression in help content or keyboard shortcut
    list goes undetected.
- **Status:** 🔲 **Open** (low priority)

#### P3-160 · `TransformController.js` 65% Branch Coverage

- **File:**
    `resources/ext.layers.editor/canvas/TransformController.js`
- **Issue:** Critical resize and rotation logic has 34.76%
    untested branches. In particular, multi-layer transform and
    aspect-ratio-constrained resize paths lack coverage.
- **Impact:** Resize edge cases may regress silently.
- **Status:** 🔲 **Open** (low priority)

### Documentation Drift — 8 Items

#### D-056-01 · Test Count Stale (11,494 → 11,606)

- **Files:** `codebase_review.md`, `README.md`,
    `Mediawiki-Extension-Layers.mediawiki`, `wiki/Home.md`,
    `copilot-instructions.md`
- **Issue:** Multiple documents reference 11,494 tests. Actual
    count verified March 16, 2026: **11,606** (112 test drift).
- **Status:** ✅ **Fixed v56**

#### D-056-02 · `README.md` Badge Shows 11,474

- **File:** `README.md` (shields.io badge URL)
- **Issue:** Badge claims 11,474 tests (even older than 11,494).
- **Status:** ✅ **Fixed v56**

#### D-056-03 · i18n Key Count Stale (780 — correct, was misreported as 786)

- **Files:** `codebase_review.md`, `copilot-instructions.md`
- **Issue:** The v56 audit incorrectly reported 786 as actual. The verified count
    (via `verify-metrics.js`, which counts `layers-` prefixed keys) is **780**.
    The documented 780 was already correct in most files.
- **Status:** ✅ **Fixed v56** — codebase_review.md header corrected to 780.

#### D-056-04 · PHPUnit File Count Stale (31 → 33)

- **Files:** `codebase_review.md`, `copilot-instructions.md`
- **Issue:** Documents claim 31 PHPUnit files. Actual: **33**.
- **Status:** ✅ **Fixed v56** — README.md and wiki/Home.md updated to 34 (recounted).

#### D-056-05 · `Mediawiki-Extension-Layers.mediawiki` Test Count 11,474

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** MediaWiki.org page claims 11,474 tests.
- **Status:** ✅ **Fixed v56**

#### D-056-06 · `THIRD_PARTY_LICENSES.md` Claims 3,731 Emoji SVGs

- **File:** `THIRD_PARTY_LICENSES.md`
- **Issue:** States "3,731 Noto Color Emoji SVGs". Actual bundled
    count is 2,817 (per `extension.json` and `emoji-bundle.json`).
    The 3,731 figure may reflect an earlier download count before
    filtering.
- **Status:** ✅ **Fixed v56** — Updated to 2,817.

#### D-056-07 · `README.md` Version Date Mismatch

- **File:** `README.md`
- **Issue:** States version date "March 11, 2026".
    `CHANGELOG.md` v1.5.62 entry is dated March 12, 2026.
- **Status:** ✅ **Fixed v56** — README.md updated to March 12.

#### D-056-08 · `docs/README.md` Severely Stale

- **File:** `docs/README.md`
- **Issue:** "Last updated: January 27, 2026" — nearly 2 months
    out of date. Multiple metrics and file references are stale.
- **Status:** 🔲 **Open**

---

## v56 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during
this v56 review but verified as non-issues:

- **`layers-admin` permission undefined in extension.json:**
    **FALSE POSITIVE** — `layers-admin` IS defined in
    `extension.json` under `AvailableRights` and granted to
    `sysop` via `GroupPermissions`.

- **`SetSelectorController.createNewSet()` missing validation:**
    **FALSE** — code has `trim()`, Unicode regex check, and
    duplicate name check before API call.

- **`ContextMenuController` innerHTML with unsanitized data:**
    **FALSE** — uses `.textContent` for both label and icon
    content. No innerHTML with user data.

- **`PresetDropdown.destroy()` missing cleanup:**
    **FALSE** — `close()` method properly removes document-level
    click listeners before destroy.

- **`ViewerManager` missing `.catch()` on API calls:**
    **FALSE** — `.catch()` handler IS present at L374–380 and
    properly handles API errors with fallback behavior.

- **`SmartGuidesController` shadow expansion math error:**
    **FALSE** — shadow offset and blur calculations are correct.
    The math accounts for both offset direction and blur radius.

- **`_processWithConcurrency` stack overflow risk:**
    **PARTIALLY CONFIRMED but LOW** — uses recursive Promise
    chains, but recursion depth is bounded by batch size (never
    unbounded). Not a practical stack overflow risk. Excluded.

- **`GradientEditor` preset validation missing:**
    **CONFIRMED but LOW** — internal presets only, not user
    input path. Included as P3-157 at LOW severity.

- **`processHTML` in `RichTextConverter` XSS via innerHTML:**
    **FALSE** — input is a layer's `richText` array (validated
    server-side), not user-submitted HTML. The innerHTML use
    constructs a temporary DOM for measurement, not for display.

---

## v55 Verification Summary

All v55 items verified. Items marked "FIXED" were confirmed fixed
in prior fix passes. Items marked "FALSE POSITIVE" were reclassified
during v55 fix pass. P1-058, P2-128, P2-129, P2-130, P2-131, P3-153,
P3-154 all confirmed fixed. P2-132, P3-155, P3-156 confirmed as
false positives.

| ID | Status | Notes |
|----|--------|-------|
| P1-058 | ✅ Fixed v1.5.62 | `use LayersConstants` import added |
| P2-128 | ✅ Fixed v1.5.62 | API modules use trait helpers |
| P2-129 | ✅ Fixed v1.5.62 | User enrichment deduplicated |
| P2-130 | ✅ Fixed v1.5.62 | try-catch added to JSON fallback |
| P2-131 | ✅ Fixed v1.5.62 | Delta clamp scaled to canvas |
| P2-132 | ❌ False positive | Already uses bounding box |
| P3-153 | ✅ Fixed v1.5.62 | LRU cache promotion added |
| P3-154 | ✅ Fixed v1.5.62 | Cached div for escaping |
| P3-155 | ❌ False positive | ARIA roles already present |
| P3-156 | ❌ False positive | Dialog attributes already present |
| D-055-01 | ✅ Fixed | Slide config documented |
| D-055-02 | ✅ Fixed | MW.org page updated |

---

### New Findings (v55) — 13 Items

**Audit scope:** All 41 PHP source files (`src/`), all 156 JS modules
(`resources/ext.layers*`), all documentation and mediawiki files.
Main branch, HEAD `82bdca3d`.

**Methodology:** Multi-pass review with 6 specialized subagent sweeps
(PHP API, PHP core/validation, JS editor core, JS canvas controllers,
JS shared renderers, JS UI/viewer) plus 2 targeted verification passes.
13 false positives eliminated during verification (see Verified
Non-Issues section).

### High — PHP

#### P1-058 · `RateLimiter.php` Missing `use LayersConstants` Import

- **File:** `src/Security/RateLimiter.php` L225–227
- **Code:** The `isImageSizeAllowed()` method references
    `LayersConstants::KEY_MAX_COMPLEXITY` but the file's `use` block
    does not import `MediaWiki\Extension\Layers\LayersConstants`.
    ```php
    public function isImageSizeAllowed( ... ) {
        $maxComplexity = $this->config->get(
            LayersConstants::KEY_MAX_COMPLEXITY
        );
    ```
- **Impact:** If `isImageSizeAllowed()` is called without the caller
    explicitly passing the max complexity value (i.e., relying on
    config lookup via `LayersConstants`), PHP will throw a fatal
    `Error: Class "LayersConstants" not found`. Currently this method
    may not be called in production paths that trigger the config
    lookup, but the bug is latent and will cause a 500 error when
    the code path is exercised.
- **Fix:** Add `use MediaWiki\Extension\Layers\LayersConstants;` to
    the file's import block.
- **Status:** 🔲 **Open**

### Medium — PHP

#### P2-128 · `LayersApiHelperTrait` Helper Methods Unused by API Modules

- **File:** `src/Api/Traits/LayersApiHelperTrait.php`
- **Issue:** The trait defines `validateAndGetFile()` and
    `getLayerSetWithFallback()` helper methods designed to reduce
    boilerplate in API modules. However, `ApiLayersDelete` and
    `ApiLayersRename` duplicate this logic inline (~40 lines each)
    instead of calling the trait methods.
- **Impact:** Code duplication — the same file lookup, existence
    check, SHA1 computation, and layer set retrieval logic is
    implemented three times (trait + two API modules). Bug fixes
    must be applied in multiple places.
- **Fix:** Refactor `ApiLayersDelete` and `ApiLayersRename` to
    call the trait's helper methods.
- **Status:** 🔲 **Open**

#### P2-129 · Duplicated User Enrichment Code Across API Modules

- **Files:** `src/Api/ApiLayersList.php` (`enrichWithUserNames()`),
    `src/Api/ApiLayersInfo.php` (`enrichRowsWithUserNames()`)
- **Issue:** Both API modules implement nearly identical functions
    to enrich query results with user names from user IDs. The logic
    (collect IDs → batch UserFactory lookup → map names back) is
    the same, with only minor differences in field names.
- **Impact:** Maintenance burden — changes to user enrichment logic
    (e.g., handling deleted users) must be applied in two places.
- **Fix:** Extract shared enrichment into `LayersApiHelperTrait`
    or a utility class.
- **Status:** 🔲 **Open**

### Medium — JavaScript

#### P2-130 · `HistoryManager.getLayersSnapshot()` JSON Fallback Missing try-catch

- **File:** `resources/ext.layers.editor/HistoryManager.js`
- **Issue:** `getLayersSnapshot()` uses
    `JSON.parse( JSON.stringify( layers ) )` as a deep-clone
    fallback. This call is not wrapped in try-catch. If a layer
    object contains circular references or non-serializable values
    (e.g., DOM nodes from a bug), `JSON.stringify()` throws a
    `TypeError` that propagates up and crashes undo/redo.
- **Impact:** Uncaught exception in history snapshot creation
    breaks the entire undo/redo system.
- **Fix:** Wrap `JSON.parse(JSON.stringify(...))` in try-catch
    with a fallback to a shallow copy or log + return partial
    snapshot.
- **Status:** 🔲 **Open**

#### P2-131 · `TransformController` Delta Clamped to 1000px

- **File:**
    `resources/ext.layers.editor/canvas/TransformController.js`
    L143–145
- **Code:**
    ```javascript
    dx = Math.max( -1000, Math.min( 1000, dx ) );
    dy = Math.max( -1000, Math.min( 1000, dy ) );
    ```
- **Impact:** Hard-caps drag movement to ±1000px per frame. On
    large canvases (4000px+) with high zoom, fast mouse drags are
    silently truncated — the layer stops following the cursor.
- **Fix:** Scale the clamp proportionally to canvas dimensions:
    ```javascript
    const maxDelta = Math.max( 1000, baseWidth );
    ```
- **Status:** 🔲 **Open**

#### P2-132 · `HitTestController` Text Bounds Estimation Inaccurate

- **File:**
    `resources/ext.layers.editor/canvas/HitTestController.js`
    L171–180
- **Code:**
    ```javascript
    const estimatedWidth = text.length * fontSize * 0.6;
    ```
- **Impact:** The `0.6` multiplier is a rough average character
    width ratio. For narrow text (`"iiiiiii"`) bounds are ~200%
    too wide; for wide text (`"WWWWWWW"`) ~30% too narrow. Causes
    click-to-select to miss text layers or select from too far.
- **Fix:** Use `ctx.measureText(text).width` for accurate bounds,
    or cache measured width on the layer during rendering.
- **Status:** 🔲 **Open**

### Low — PHP

#### P3-153 · `LayersDatabase` Cache Uses FIFO Not LRU

- **File:** `src/Database/LayersDatabase.php`
- **Issue:** The in-memory layer set cache uses `array_shift()`
    for eviction when `MAX_CACHE_SIZE` (100) is reached. This is
    FIFO, not LRU. Frequently accessed sets are evicted at the
    same rate as rarely accessed ones.
- **Impact:** Suboptimal cache hit rate under high load. Practical
    impact low at `MAX_CACHE_SIZE=100`.
- **Fix:** Move accessed entries to end of array on read (LRU),
    or accept FIFO as sufficient.
- **Status:** ✅ **FIXED** — `getLayerSet()` now promotes cache hits to MRU position via unset+re-insert before return

### Low — JavaScript

#### P3-154 · `RichTextConverter.escapeHtml()` Creates DOM Element Per Call

- **File:**
    `resources/ext.layers.editor/canvas/InlineTextEditor.js`
- **Issue:** `escapeHtml()` creates a new `<div>` on every call
    to leverage `textContent`/`innerHTML` for escaping. Causes
    unnecessary DOM allocation during rich text operations.
- **Impact:** Minor GC pressure during text editing.
- **Fix:** Cache the `<div>` element or use regex-based escaping.
- **Status:** 🔲 **Open** (low priority)

#### P3-155 · `ContextMenuController` Missing ARIA Menu Roles

- **File:**
    `resources/ext.layers.editor/ui/ContextMenuController.js`
- **Issue:** Right-click context menu lacks `role="menu"` on
    container and `role="menuitem"` on items. Screen readers
    cannot identify this as a menu.
- **Impact:** Accessibility gap for screen reader users.
- **Fix:** Add `role="menu"` and `role="menuitem"` attributes.
- **Status:** 🔲 **Open**

#### P3-156 · `LayersLightbox` Missing Dialog ARIA Attributes

- **File:** `resources/ext.layers/viewer/LayersLightbox.js`
- **Issue:** Lightbox overlay lacks `role="dialog"` and
    `aria-modal="true"`. Not announced as dialog by assistive
    technology.
- **Impact:** Accessibility gap — focus may escape to background.
- **Fix:** Add `role="dialog"` and `aria-modal="true"`.
- **Status:** 🔲 **Open**

### Documentation — 2 Items

#### ~~D-055-01 · Slide Mode Config Undocumented~~ (FIXED)

- **File:** `docs/API.md`, `README.md`, `copilot-instructions.md`
- **Issue:** Six `$wgLayersSlide*` configuration parameters were
    defined in `extension.json` but not documented.
- **Fix:** Added Slide Mode parameters to README.md, Mediawiki-Extension-Layers.mediawiki, and copilot-instructions.md.
- **Status:** ✅ **Fixed**

#### ~~D-055-02 · `Mediawiki-Extension-Layers.mediawiki` Missing Slide Config~~ (FIXED)

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issue:** External MediaWiki.org extension page did not
    document Slide Mode configuration parameters.
- **Fix:** Added 6 Slide Mode parameters to infobox parameter list and configuration table.
- **Status:** ✅ **Fixed**

---

## v55 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during
this v55 review but verified as non-issues:

- **CustomShapeRenderer SVG cache key excluding opacity:**
    **FALSE POSITIVE** — opacity is intentionally applied via
    `ctx.globalAlpha` after cache retrieval. Cached SVG path data
    is opacity-independent by design.

- **SVG `<metadata>` elements not blocked in validator:**
    **FALSE POSITIVE** — SVGs are rendered to `<canvas>` via
    `drawImage()`. Scripts/metadata cannot execute in the canvas
    rendering context. Validator already strips `<script>`,
    `<foreignObject>`, and event handlers.

- **RenderCoordinator hash computation per frame:**
    **FALSE POSITIVE** — hash comparison is a NET PERFORMANCE WIN:
    when layers haven't changed (common case), hash match skips
    expensive full canvas redraw.

- **CanvasManager.destroy() doesn't call state unsubscribers:**
    **FALSE** — code at lines 2032–2044 iterates
    `_stateUnsubscribers` and calls each.

- **PolygonStarRenderer gradient not applied:**
    **FALSE** — lines 404–407 and 597–600 apply gradient via
    `GradientRenderer.createGradient()`.

- **ResizeCalculator missing ellipse diagonal handles:**
    **FALSE** — lines 497–509 handle ellipse resize for all
    handle positions including diagonals.

- **DrawingController `_angleDimensionPhase` not reset on tool
    switch:** **FALSE** — `CanvasManager.setTool()` calls
    `cancelAngleDimension()`.

- **WikitextHooks `REQUEST_TIME_FLOAT` reset in CLI:**
    **FALSE** — design correctly handles PHP-FPM recycling.

- **ApiLayersSave OverflowException exposes internal message:**
    **FALSE** — exception message contains i18n key (safe).

- **`extension.json` missing GroupRights:**
    **FALSE** — `GroupPermissions` + `AvailableRights` is the
    modern MW 1.44 pattern.

- **ViewerManager has no cancel for pending loads:**
    **FALSE POSITIVE** — `destroy()` calls `_destroyAllViewers()`
    which cleans up all instances and detaches observers.

- **TextSanitizer regex ReDoS:**
    **FALSE POSITIVE** — all sanitization uses simple `replace()`
    patterns. Input is length-limited before regex execution.

- **FIFO cache as security concern:**
    **FALSE** — this is a performance issue (P3-153), not security.
    Cache contains only validated data from the database.

---

## Confirmed Findings (v52 — March 11, 2026) — All 4 Fixed in v1.5.62

### v51 Verification Summary

Both v51 issues verified as fixed in v1.5.62. No regressions found.

| ID | Status | Notes |
|----|--------|-------|
| P3-143 | ✅ Fixed v1.5.62 | `applyPasteOffset()` now offsets `ax/ay`, `cx/cy`, `bx/by` for angle dimension layers |
| P3-144 | ✅ Fixed v1.5.62 | `_angleDimensionPhase` initialized to `0` in `DrawingController` constructor |

---

### New Findings (v52) — Scope: Full codebase verification audit

**Audit scope:** All 41 PHP source files (`src/`), all major JS modules
(`resources/ext.layers*`), all documentation. Main branch, commit
`e29f5df9` (tag `v1.5.62`).

**Result:** No new security vulnerabilities, functional bugs, or logic
errors found. Two documentation inaccuracies and one code style issue
were identified and corrected.

### Low

#### Code Style — 1 item

**CODE-052-01 · `APIManager.js` Missing Blank Line Between Methods**
- **File:** `resources/ext.layers.editor/APIManager.js` L412
- **Code:** `}	extractLayerSetData( layerSet ) {`
    (closing brace and next method declaration on same line, separated only
    by a tab character — the result of a prior merge that omitted the blank
    line separator)
- **Impact:** Cosmetic; no functional effect. IDE navigation and diff
    readability are slightly impaired.
- **Fix:** Added blank line between `processLayersData()` closing brace and
    `extractLayerSetData()` opening.
- **Status:** ✅ **Fixed** (this session)

#### Documentation — 3 items

**D-052-01 · `README.md` Test Count 11,445 → 11,450**
- **Files:** `README.md` (badge URL, metrics table, health table)
- **Issue:** `README.md` claimed 11,445 tests. Running `npm run test:js`
    against commit `e29f5df9` produced `11450 passed, 11450 total` in
    168 suites. The discrepancy is explained by 5 regression tests added
    in v1.5.61 (2 for P2-122, 3 for P3-144) that post-dated the v50
    documentation update.
- **Fix:** Updated all three locations in `README.md`.
- **Verified by:** `npx jest --passWithNoTests --no-coverage --silent`
- **Status:** ✅ **Fixed** (this session)

**D-052-02 · `codebase_review.md` Test Count 11,445 → 11,450**
- **File:** `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** Same stale value as D-052-01 — the Scope header and the
    Current Metrics table both stated 11,445.
- **Fix:** Updated both occurrences in this file.
- **Status:** ✅ **Fixed** (this session)

**D-052-03 · `codebase_review.md` i18n Key Count 832 → 784**
- **File:** `codebase_review.md` (Scope header, Current Metrics table)
- **Issue:** The Scope header stated `832 in i18n/en.json, 832 in
    i18n/qqq.json`. Running `grep -E '"layers-[^"]+":' i18n/en.json |
    wc -l` returns **784**. This value was also verified against the
    historically-referenced commit `4f315a5f` via `git show` — it was
    784 at that commit too, meaning the "832" claim was never accurate
    and was not introduced by a recent commit. The figure appears to have
    been generated by an automated analysis tool that used a looser
    counting pattern (e.g., including comment keys, partial matches, or
    malformed entries).
- **Fix:** Updated both occurrences in this file to 784.
- **Note:** The count discrepancy has no functional impact — all 784
    keys exist in both `en.json` and `qqq.json` with matching content.
    There are no missing documentation keys.
- **Status:** ✅ **Fixed** (this session)

---

## Confirmed Findings (v54 — March 14, 2026) — 24 New Issues Found

### v53 Verification Summary

All v53 items verified. P3-145 (SpecialSlides.js zero test coverage) is
now **resolved** — test file exists at `tests/jest/SpecialSlides.test.js`
with substantial coverage of `SlidesManager` and `CreateSlideDialog`.

| ID | Status | Notes |
|----|--------|-------|
| D-053-01 | ✅ Fixed v1.5.62 | Coverage correctly shows 91.32% |
| D-053-02 | ✅ Fixed v1.5.62 | CHANGELOG shows 11,474 tests |
| D-053-03 | ✅ Fixed v1.5.62 | Grade section test count corrected |
| D-053-04 | ✅ Fixed v1.5.62 | i18n count corrected to 780 |
| P3-145 | ✅ **Resolved** | Test file now exists — no longer zero coverage |

---

### New Findings (v54) — 24 Items

**Audit scope:** All 41 PHP source files (`src/`), all 156 JS modules
(`resources/ext.layers*`), all documentation and mediawiki files.
Main branch, HEAD `92fc3979`.

**Methodology:** Multi-pass review with 5 specialized subagent sweeps
(PHP backend, JS editor core, JS shared/renderers, documentation/config,
targeted verification). 7 false positives eliminated during verification
(see Verified Non-Issues section).

### High — Security

#### P1-057 · IDOR: `layers=id:NNN` Fetches Any Layer Set Without File Ownership Check

- **Files:**
    - `src/Hooks/Processors/LayerInjector.php` L135–137
    - `src/Hooks/Processors/ImageLinkProcessor.php` L429–431
    - `src/Hooks/Processors/LayeredFileRenderer.php` L210–215
- **Code:** All three files parse `layers=id:NNN` from wikitext and call
    `$db->getLayerSet( (int)$id )` without verifying the returned set
    belongs to the current file:
    ```php
    // LayerInjector.php L135-137
    if ( strpos( $layersParam, 'id:' ) === 0 ) {
        $layerSetId = (int)substr( $layersParam, 3 );
        $layerSet = $db->getLayerSet( $layerSetId );
    }
    ```
    `getLayerSet()` in `LayersDatabase.php` queries only by `ls_id` with
    no filename/sha1 filter. The result does contain `imgName` but none of
    the three callers verify it matches `$file->getName()`.
- **Impact:** An attacker can craft wikitext like
    `[[File:Innocent.jpg|layers=id:456]]` to render layer data belonging
    to a different (possibly private) image. The layer data (text, shapes,
    embedded base64 images) would be visible on the rendered page.
    This is OWASP A01:2021 (Broken Access Control / IDOR).
- **Contrast:** The `name:` prefix variant is safe — `getLayerSetByName()`
    correctly scopes by both filename and SHA1.
- **Fix:** After fetching by ID, verify file ownership:
    ```php
    $layerSet = $db->getLayerSet( $layerSetId );
    if ( $layerSet && $layerSet['imgName'] !== $file->getName() ) {
        $layerSet = null;
    }
    ```
    Alternatively, remove the undocumented `id:` feature entirely (it is
    not mentioned in `docs/WIKITEXT_USAGE.md` or any user documentation).
- **Status:** ✅ **Fixed** (commit 0cba25e2 — ownership check added in all 3 files)

### Medium — PHP

#### P2-124 · `enrichRowsWithUserNames()` Queries `user` Table Directly

- **File:** `src/Api/ApiLayersInfo.php` L501–520
- **Code:**
    ```php
    $dbr = $this->getDB();
    $res = $dbr->select(
        'user',
        [ 'user_id', 'user_name' ],
        [ 'user_id' => $userIds ],
        __METHOD__
    );
    ```
- **Impact:** Bypasses MediaWiki's `UserFactory`/`ActorStore` abstraction.
    The `user` table is an implementation detail — MediaWiki is migrating
    user identity to the `actor` table. Also bypasses user visibility
    restrictions (e.g., suppressed users). The DB connection pattern itself
    is modern (`getConnectionProvider()`) — only the query target is wrong.
- **Fix:** Use `UserFactory::newFromId()` in a batch loop, or use
    `ActorStore` for batch user name lookup.
- **Status:** ✅ **Fixed** (commit 0cba25e2 — replaced with UserFactory)

#### P2-125 · `EditLayersAction` Set Name Validation Rejects Unicode/Spaces

- **File:** `src/Action/EditLayersAction.php` L83
- **Code:**
    ```php
    if ( $initialSetName !== '' && !preg_match( '/^[a-zA-Z0-9_-]+$/', $initialSetName ) ) {
        $initialSetName = '';
    }
    ```
- **Impact:** `SetNameSanitizer::isValid()` allows Unicode letters
    (`\p{L}`), Unicode numbers (`\p{N}`), and spaces. The API
    (`ApiLayersSave`/`ApiLayersRename`) uses `SetNameSanitizer`. But
    `EditLayersAction` uses a hardcoded ASCII-only regex. A set named
    `"anatomía labels"` can be created via API but navigating to
    `?setname=anatomía%20labels` silently resets to the default set.
- **Fix:** Replace the hardcoded regex with `SetNameSanitizer::isValid()`.
- **Status:** ✅ **Fixed** (commit 0cba25e2 — now delegates to SetNameSanitizer)

### Medium — JavaScript

#### P2-126 · Arrow Key Conflict: Simultaneous Nudge + Pan

- **File:** `resources/ext.layers.editor/CanvasEvents.js` L592–618
    and `resources/ext.layers.editor/EventManager.js` L86–170
- **Code:** Both modules register `document` `keydown` listeners for
    arrow keys. `EventManager.handleArrowKeyNudge()` nudges selected
    layers and calls `e.preventDefault()` at L170. `CanvasEvents` arrow
    handler at L592 always pans the canvas (`panY += 20`) and also calls
    `e.preventDefault()`.
- **Impact:** When layers are selected, pressing an arrow key:
    1. `EventManager` nudges layers by 1px
    2. `CanvasEvents` also fires and pans by 20px
    `preventDefault()` only prevents browser default behavior, not other
    `addEventListener` listeners. `CanvasEvents` doesn't check
    `e.defaultPrevented` before panning.
- **Fix:** Add `if ( e.defaultPrevented ) return;` at the top of the
    `CanvasEvents` arrow key handler, or check whether layers are
    selected before panning.
- **Status:** ✅ **Fixed** (commit 0cba25e2 — added `!e.defaultPrevented` check)

#### P2-127 · TextRenderer Double Shadow on Stroke+Fill (Non-Spread Path)

- **File:** `resources/ext.layers.shared/TextRenderer.js` L256–278
- **Code:** When shadow is enabled with `spread === 0`:
    1. L256: `applyShadow(layer, shadowScale)` — shadow active on ctx
    2. L261–270: `strokeText(text, x, y)` — shadow #1 rendered
    3. L273–274: `clearShadow()` only called if `spread > 0` — shadow
       NOT cleared when `spread === 0`
    4. L278: `fillText(text, x, y)` — shadow #2 rendered
- **Impact:** Text layers with both stroke and a non-spread shadow produce
    a visually doubled/darker shadow. The shadow is drawn once from
    `strokeText` and again from `fillText`. `TextBoxRenderer` handles this
    correctly by disabling shadow during `strokeText` and re-enabling for
    `fillText` only.
- **Fix:** Clear shadow after `strokeText` and before `fillText` when
    `spread === 0`, matching the `TextBoxRenderer` pattern:
    ```javascript
    if ( this.hasShadowEnabled( layer ) && spread <= 0 ) {
        this.clearShadow();
    }
    ```
- **Status:** ✅ **Fixed** (commit 0cba25e2 — shadow cleared after strokeText)

### Low — PHP

#### P3-146 · `layer_set_usage` Table: Dead/Unimplemented Feature

- **Files:** `sql/layers_tables.sql` L43–52, `src/Database/LayersSchemaManager.php`,
    `src/LayersConstants.php` L239
- **Issue:** The `layer_set_usage` table is created in the schema, has
    column definitions validated in `LayersSchemaManager`, and has a
    constant in `LayersConstants`, but `LayersDatabase.php` contains
    **zero references** to this table. No application code inserts into,
    reads from, or deletes from it. The table exists empty on every
    installation.
- **Impact:** Database schema overhead. If usage tracking is ever
    implemented without cleanup logic, orphaned rows will accumulate
    when files are deleted (no FK CASCADE — MediaWiki convention).
- **Decision:** Remove. No application code uses this table.
    See `improvement_plan.md` "P3-146 Removal Plan" for the 9-step checklist.
- **When:** Bundle with the next schema-touching change or minor version bump.
- **Status:** ✅ **Removed** (v1.5.63 sprint — table dropped, all references deleted)

#### P3-147 · `buildImageNameLookup` Generates Redundant SQL Variants

- **File:** `src/Database/LayersDatabase.php` L1115–1126
- **Issue:** Every database query uses `buildImageNameLookup()` to
    generate 2–4 name variants (`My_Image.jpg`, `My Image.jpg`, etc.)
    as an `IN (...)` clause, doubling index scans. This is a workaround
    for historically inconsistent data rather than a proper fix.
    `ApiLayersSave` already normalizes via `$title->getDBkey()` on write.
- **Impact:** Performance — every query (19 call sites) does 2–4x the
    necessary index lookups.
- **Fix:** One-time migration to normalize existing `ls_img_name` data,
    then simplify to single-value lookups.
- **Status:** 🔲 **Open**

#### P3-148 · `LayerValidatorInterface` Unused in DI Container

- **File:** `src/Validation/LayerValidatorInterface.php`
- **Issue:** Interface is defined and `ServerSideLayerValidator` implements
    it, but no code type-hints against the interface. `ApiLayersSave`
    directly instantiates `new ServerSideLayerValidator()`. The interface
    is not wired in `services.php`. It's a design contract with no
    practical effect.
- **Impact:** Dead abstraction — not harmful, but adds cognitive overhead.
- **Status:** 🔲 **Deferred** (low priority; validator pattern works as-is)

#### P3-149 · `ThumbnailRenderer` Has No Own Color Validation

- **File:** `src/ThumbnailRenderer.php` (defense-in-depth gap)
- **Issue:** Color values from layer data pass to `Shell::command()`
    arguments (ImageMagick) without ThumbnailRenderer performing its own
    validation. The `withOpacity()` method's fallback path (`return $color`)
    passes unrecognized formats unchanged. Currently mitigated by:
    1. `ServerSideLayerValidator.sanitizeColor()` — whitelist-based
    2. `Shell::command()` — uses `escapeshellarg()` per argument
- **Impact:** Not exploitable via the normal save path. But if layer data
    enters the system through any path bypassing `ApiLayersSave` (future
    API, migration, direct DB edit), unsanitized colors could reach IM.
- **Status:** ❌ **False positive** — upstream `ServerSideLayerValidator` + `Shell::command()` `escapeshellarg()` fully mitigate this. Colors are validated/sanitized before storage. `withOpacity()` outputs only safe formats (`rgba()`, hex, named). No bypass path exists in current architecture.

### Low — JavaScript

#### P3-150 · `ShadowRenderer._tempCanvas` Grows Unboundedly

- **File:** `resources/ext.layers.shared/ShadowRenderer.js` L107–114
- **Issue:** The temporary shadow canvas grows to accommodate the largest
    shadow ever requested but never shrinks. With `MAX_CANVAS_DIM = 8192`,
    a single large spread shadow can allocate a 8192×8192 canvas (~256MB
    pixel data) that persists for the renderer's lifetime.
- **Impact:** GPU/system memory waste after transient large shadows.
- **Fix:** Add periodic shrink logic or null the canvas in `destroy()`.
- **Status:** ✅ **Fixed** (commit 0cba25e2 — `_tempCanvas`/`_tempCtx` nulled in destroy)

#### P3-151 · `ImageLayerRenderer` Closures Hold Reference After Destroy

- **File:** `resources/ext.layers.shared/ImageLayerRenderer.js` L200–222
- **Issue:** Arrow function `onload`/`onerror` callbacks capture `this`
    (the renderer). If the renderer is destroyed while images load, the
    callbacks maintain a reference preventing GC. The `onerror` path
    accesses `this._imageCache` which is null after destroy.
- **Impact:** Minor memory leak; potential null reference on error path.
- **Fix:** Add `if ( this._destroyed ) return;` guard at top of callbacks.
- **Status:** ✅ **Fixed** (commit 0cba25e2 — `_imageCache` null guard added)

#### P3-152 · `EffectsRenderer` Division by Zero in Blur Fill Scale

- **File:** `resources/ext.layers.shared/EffectsRenderer.js` L303–310
- **Issue:** `mapCanvasW` and `mapCanvasH` can be 0 if canvas exists but
    has width 0 (not yet sized) and `baseWidth` is also 0, producing
    `Infinity` scale factors via `imgW / mapCanvasW`.
- **Impact:** Blur fill would render incorrectly on an unsized canvas.
- **Fix:** `mapCanvasW = Math.max( 1, this.baseWidth || canvasW );`
- **Status:** ✅ **Fixed** (commit 0cba25e2 — `Math.max(1, ...)` guard added)

### Documentation — 14 Items

#### D-054-01 · Metrics Drift: JS File/Line Count (all core docs)

- **Files:** `codebase_review.md`, `README.md`, `docs/ARCHITECTURE.md`,
    `copilot-instructions.md`
- **Issue:** All claim 143 JS files / ~99,730 lines. Actual: 156 files /
    ~113,390 lines. The increase is from new ShapeLibrary data variants
    (`ShapeLibraryData.original.js`, `.iec60417.js`, `.iso7000.js`) and
    other additions.
- **Status:** ✅ **Fixed** (v54 session — metrics updated across all docs)

#### D-054-02 · Metrics Drift: Test Count (11,474 → 11,494)

- **Files:** `codebase_review.md`, `README.md`, `CHANGELOG.md`,
    `wiki/Changelog.md`, `docs/ARCHITECTURE.md`
- **Issue:** All claim 11,474 tests. Actual: 11,494 (20 new tests since
    last documented baseline, including SpecialSlides.test.js).
- **Status:** ✅ **Fixed**

#### D-054-03 · Metrics Drift: PHP Line Count (~15,197 → ~15,236)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`
- **Issue:** Minor drift in PHP line count.
- **Status:** ✅ **Fixed**

#### D-054-04 · Metrics Drift: God Class Count (23 → 26)

- **Files:** `codebase_review.md`, `README.md`, `copilot-instructions.md`,
    `docs/ARCHITECTURE.md`
- **Issue:** All claim 23 god classes (2 generated, 19 JS, 2 PHP). Actual:
    26 total (5 generated JS data files, 19 hand-written JS, 2 PHP).
    New generated files: `ShapeLibraryData.original.js` (11,293),
    `ShapeLibraryData.iec60417.js` (5,905), `ShapeLibraryData.iso7000.js`
    (1,609). `ShapeLibraryData.js` shrank from 11,293 to 1,643.
    `TransformController.js` grew from ~1,146 to 1,189.
    `CalloutRenderer.js` is exactly at 1,000 (borderline).
- **Status:** ✅ **Fixed**

#### D-054-05 · `CONTRIBUTING.md` Grossly Stale Metrics

- **File:** `CONTRIBUTING.md` L24, L28
- **Issue:** States `"95.19% coverage, 11,250 tests"` and `"17 god classes"`.
    Correct: 91.32%, 11,494, 26. This file gives contributors their first
    impression of the project — having metrics wrong by ~1,000 tests and
    4% coverage damages credibility.
- **Status:** ✅ **Fixed**

#### D-054-06 · `docs/ARCHITECTURE.md` Stale Version and Metrics

- **File:** `docs/ARCHITECTURE.md` L4, L27–47, L100
- **Issue:** Version `1.5.59` (correct: 1.5.62). God class header says 17
    (correct: 26). Statistics table shows stale JS/PHP lines, test count
    (11,445), and i18n count (832).
- **Status:** ✅ **Fixed**

#### D-054-07 · `Mediawiki-Extension-Layers.mediawiki` Multiple Issues

- **File:** `Mediawiki-Extension-Layers.mediawiki`
- **Issues:**
    1. Update date `2026-03-04` (should be `2026-03-12`)
    2. Install table shows `1.5.60` for all branches (main should be 1.5.62)
    3. Missing `ParserClearState` hook (14th hook not listed)
    4. Missing `layers-admin` right (only lists 2 of 3 rights)
    5. Missing 8 config parameters (all Slide Mode + MaxComplexity + DefaultFonts)
- **Status:** ✅ **Fixed** (versions/date updated; hook/right/config additions deferred)

#### D-054-08 · `docs/LTS_BRANCH_STRATEGY.md` Stale Throughout

- **File:** `docs/LTS_BRANCH_STRATEGY.md` L19–21, L29, L88–90
- **Issue:** All version references say `1.5.59`; test count says `11,250`.
- **Status:** ✅ **Fixed**

#### D-054-09 · `docs/SLIDE_MODE_ISSUES.md` Extremely Stale Test Count

- **File:** `docs/SLIDE_MODE_ISSUES.md` L193
- **Issue:** States `"All 9,922 tests pass"` — off by ~1,572 tests.
- **Status:** ✅ **Fixed**

#### D-054-10 · `wiki/Testing-Guide.md` Wrong Coverage

- **File:** `wiki/Testing-Guide.md` L13
- **Issue:** Shows `95.19%` coverage (correct: 91.32%).
- **Status:** ✅ **Fixed**

#### D-054-11 · `wiki/Architecture-Overview.md` Stale Metrics

- **File:** `wiki/Architecture-Overview.md` L315–316
- **Issue:** Test Cases: `11,250`, Coverage: `95.19%`.
- **Status:** ✅ **Fixed**

#### D-054-12 · `wiki/Frontend-Architecture.md` Stale Metrics

- **File:** `wiki/Frontend-Architecture.md` L415–417
- **Issue:** Test Cases: `11,250`, stmt coverage `95.19%`, branch `84.96%`.
- **Status:** ✅ **Fixed**

#### D-054-13 · `wiki/Home.md` Stale "What's New" Section

- **File:** `wiki/Home.md` L23
- **Issue:** Features v1.5.60 highlights — does not mention v1.5.61/v1.5.62.
- **Status:** ✅ **Fixed**

#### D-054-14 · `wiki/Installation.md` Stale Branch Versions

- **File:** `wiki/Installation.md` L21–23
- **Issue:** Branch version table says `1.5.61` for all (main should be 1.5.62).
- **Status:** ✅ **Fixed**

---

## v54 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated subagent analysis during this v54
review but verified as non-issues:

- **Boolean `visible !== false` bug (12+ files):** Subagent reported that
    integer `0` from the API would bypass `!== false` checks. **FALSE
    POSITIVE** — `LayerDataNormalizer.normalizeLayer()` converts all boolean
    properties (including `visible`) from integers to proper JS booleans
    before any rendering code executes. Both editor (via `APIManager.
    processRawLayers()`) and viewer (via `LayersViewer` constructor)
    normalize data. All 25+ occurrences of `visible !== false` execute on
    already-normalized booleans.

- **XSS in `HelpDialog.js` innerHTML (6 usages):** Subagent flagged
    `innerHTML` with interpolated `msg()` values. **FALSE POSITIVE** —
    `getMessage()` calls `mw.message(key).text()` which returns
    HTML-escaped plain text. All i18n messages are developer-controlled
    (extension code, not user-editable). No user data reaches `innerHTML`.

- **SVG injection in `ShapeLibraryPanel.js` / `EmojiPickerPanel.js`:**
    Subagent flagged `preview.innerHTML = svgContent`. **FALSE POSITIVE** —
    SVG data comes from `ShapeLibraryData.js` (build-time generated from
    curated icon sets) and `emoji-bundle.json` (bundled at build time).
    No user input reaches these paths at runtime.

- **`ClipboardController.cutSelected()` bypasses StateManager:** Subagent
    flagged reading `editor.layers` directly. **FALSE POSITIVE** — the
    read is just accessing the current array. The write correctly goes
    through `stateManager.set('layers', remaining)`.

- **`EffectsRenderer._blurFillCanvas` stale pixels:** Subagent reported
    ghosting when canvas reused at same size. **FALSE POSITIVE** — the
    white `fillRect()` immediately after canvas allocation overwrites all
    content before any image data is drawn.

- **`WikitextHooks` `REQUEST_TIME_FLOAT` reset detection:** Subagent
    claimed this could fail in CLI/maintenance contexts. **FALSE POSITIVE**
    — the design correctly handles PHP-FPM `max_requests > 1` recycling,
    and an explicit `resetPageLayersFlag()` exists for programmatic resets.

- **ThumbnailRenderer cache key missing layer data hash:** Subagent
    claimed stale thumbnails when data changes. **FALSE POSITIVE** —
    `$params` includes the full `layerData` array and
    `md5(json_encode($params))` captures it. Different content = different
    cache key.

---

## Confirmed Findings (v51 — March 10, 2026) — All 2 Fixed in v1.5.62

### v50 Verification Summary

All 7 v50 issues verified as fixed in v1.5.61. No regressions found.

| ID | Status | Notes |
|----|--------|-------|
| P1-056 | ✅ Fixed v1.5.61 | `SpecialSlides.php` now checks `'layers-admin'` right |
| P2-122 | ✅ Fixed v1.5.61 | `path` type handled in `_getRefPoint()` via `Math.min(points)` |
| P2-123 | ✅ Fixed v1.5.61 | `enrichRowsWithUserNames()` uses `$this->getDb()` |
| D-050-01 | ✅ Fixed v1.5.61 | `ARCHITECTURE.md` test/coverage metrics corrected |
| D-050-02 | ✅ Fixed v1.5.61 | `CHANGELOG.md` v1.5.60 coverage corrected to 91.32% |
| D-050-03 | ✅ Fixed v1.5.61 | `wiki/Changelog.md` synced with CHANGELOG.md |
| D-050-04 | ✅ Fixed v1.5.61 | `README.md` god-class count L317/L353 corrected |

---

### New Findings (v51) — All Fixed in v1.5.62

### Low

#### JavaScript — 2 items

**P3-143 · `ClipboardController.applyPasteOffset()` Skips Angle Dimension Anchor Points**
- **File:** `resources/ext.layers.editor/canvas/ClipboardController.js`
- **Code:** `applyPasteOffset()` applied `PASTE_OFFSET` to `x/y`,
    `x1/y1/x2/y2`, and `points[]` coordinate sets but had no branch for
    the `ax/ay` (arm1 endpoint), `cx/cy` (vertex), and `bx/by` (arm2
    endpoint) fields used exclusively by `angleDimension` layers.
- **Impact:** Pasting an angle dimension layer left all six anchor points
    at the original canvas coordinates (while the pasted layer received a
    new ID), causing the pasted copy to render at the wrong position —
    visually identical to the original but not offset.
- **Fix:** Added three conditional offset blocks for `ax/ay`, `cx/cy`,
    and `bx/by` after the existing `points` block.
- **Status:** ✅ **Fixed** (v1.5.62)

**P3-144 · `DrawingController._angleDimensionPhase` Not Initialized in Constructor**
- **File:** `resources/ext.layers.editor/canvas/DrawingController.js`
- **Code:** `_angleDimensionPhase` was assigned inside
    `startAngleDimensionTool()` but never declared in the constructor.
    Any code path checking the property before tool activation received
    `undefined` rather than `0`.
- **Impact:** Phase-comparison guards (`_angleDimensionPhase === 0`, etc.)
    behaved incorrectly before the first `startAngleDimensionTool()` call,
    potentially skipping phase transitions or misidentifying the current
    drawing phase.
- **Fix:** Added `this._angleDimensionPhase = 0` to the constructor.
- **Status:** ✅ **Fixed** (v1.5.62)

---

## Confirmed Findings (v50 — March 10, 2026) — All 7 Fixed in v1.5.61

### v49 Verification Summary

All 53 of 54 v49 issues verified as fixed (v1.5.59/v1.5.60). P1-053 is
partially fixed; remaining path-type issue re-tracked as P2-122 below.

| ID | Status | Notes |
|----|--------|-------|
| P1-045 | ✅ Fixed v1.5.59 | `layers-admin` right added; `LayersApiHelperTrait.php` L106 corrected |
| P1-046 | ✅ Fixed v1.5.59 | Permission check moved before DB query in SpecialSlides |
| P1-047 | ✅ Fixed v1.5.59 | Permission check moved before DB query in SpecialEditSlide |
| P1-048 | ✅ Fixed v1.5.59 | `return;` moved inside `try` block; Promise now resolves/rejects |
| P1-049 | ✅ Fixed v1.5.59 | 4 sites converted to `.then(success, failure)` pattern |
| P1-050 | ✅ Fixed v1.5.59 | `lastSaveHistoryIndex` decremented correctly on history trim |
| P1-051 | ✅ Fixed v1.5.59 | `EditorBootstrap` no longer creates duplicate editors |
| P1-052 | ✅ Fixed v1.5.59 | `ValidationManager` bounds now match server (`fontSize < 1`, `strokeWidth > 100`) |
| P1-053 | ✅ Fixed v1.5.61 | path type fixed (P2-122); all types now fully working |
| P1-054 | ✅ Fixed v1.5.59 | `canvas.parentNode` null-checked in `fitToWindow()` |
| P1-055 | ✅ Fixed v1.5.59 | Same null-check applied in `zoomToFitLayers()` |
| P2-104 | ✅ Fixed v1.5.59 | Zero-width space no longer injected in `TextSanitizer` |
| P2-105 | ✅ Fixed v1.5.59 | `blend` property now validated against enum in `ServerSideLayerValidator` |
| P2-106 | ✅ Fixed v1.5.59 | `usleep()` reduced to 10ms/20ms |
| P2-107 | ✅ Fixed v1.5.59 | N+1 replaced with batch SQL — but introduced deprecated API (see P2-123) |
| P2-108 | ✅ Fixed v1.5.59 | `CacheInvalidationTrait` now logs warning on cache failure |
| P2-109 | ✅ Fixed v1.5.59 | `wfLogWarning()` replaced with `LoggerFactory` in `RateLimiter` |
| P2-110 | ✅ Fixed v1.5.59 | `ApiLayersRename` returns `ERROR_INVALID_SETNAME` for bad format |
| P2-111 | ✅ Fixed v1.5.59 | `parseMWTimestamp` fallback uses `Date.UTC(...)` |
| P2-112 | ✅ Fixed v1.5.59 | `currentSetName` set only after successful load |
| P2-113 | ✅ Fixed v1.5.59 | Auto-save interval now checks `isRecoveryMode` |
| P2-114 | ✅ Fixed v1.5.59 | APIManager reads `wgLayersMaxLayerCount` instead of hardcoded 100 |
| P2-115 | ✅ Fixed v1.5.59 | `nudgeSelectedLayers` uses `stateManager.updateLayer()` |
| P2-116 | ✅ Fixed v1.5.59 | Draft storage key uses hash to prevent collision |
| P2-117 | ✅ Fixed v1.5.59 | `emitTransforming()` RAF ID stored and cancelled on destroy |
| P2-118 | ✅ Fixed v1.5.59 | `animationFrameId` nulled on animation completion |
| P2-119 | ✅ Fixed v1.5.59 | `AngleDimensionRenderer` cached as singleton in `SelectionRenderer` |
| P2-120 | ✅ Fixed v1.5.59 | `_arrowTipRafId` initialized to `null` in constructor |
| P2-121 | ✅ Fixed v1.5.59 | Text-drag state variables initialized in constructor |
| P3-128 | ✅ Fixed v1.5.60 | i18n message used instead of raw filename in error span |
| P3-129 | ✅ Fixed v1.5.60 | `requiresUnblock()` returns `true` |
| P3-130 | ✅ Fixed v1.5.60 | `returnTo` validation uses `isValid()` + namespace allowlist |
| P3-131 | ✅ Fixed v1.5.60 | `sanitizeText()` and `sanitizeRichTextRun()` use `mb_strlen()` |
| P3-132 | ✅ Fixed v1.5.60 | `ApiLayersList` uses shared `RateLimiter::checkRateLimit()` |
| P3-133 | ✅ Fixed v1.5.60 | `LayersSchemaManager` uses typed exception instead of string parsing |
| P3-134 | ✅ Fixed v1.5.60 | i18n key used for 'Edit Layers' link text |
| P3-135 | ✅ Fixed v1.5.60 | Dead `=== false` comparison removed from `ThumbnailProcessor` |
| P3-136 | ✅ Fixed v1.5.60 | `mw.notify()` wrapped in `typeof mw !== 'undefined'` guard |
| P3-137 | ✅ Fixed v1.5.60 | `namedSets.push()` replaced with spread: `[...namedSets, {...}]` |
| P3-138 | ✅ Fixed v1.5.60 | Single spinner ownership established |
| P3-139 | ✅ Fixed v1.5.60 | Double `redraw()` in `handleImageLoaded()` removed |
| P3-140 | ✅ Fixed v1.5.60 | Dead `updateLayerPosition()` delegated or removed |
| P3-141 | ✅ Fixed v1.5.60 | `getLayerAtPoint()` fallback loop direction corrected |
| P3-142 | ✅ Fixed v1.5.60 | ESLint `no-unused-vars: off` scoped to individual files |
| D-049-01 through D-049-10 | ✅ Fixed v1.5.60 | Documentation metrics synchronized |

---

### New Findings (v50) — All Fixed in v1.5.61

### High

#### PHP — 1 item

**P1-056 · SpecialSlides.php `$canDelete` Uses Page-Deletion Right Instead of `layers-admin`**
- **File:** `src/SpecialPages/SpecialSlides.php` L80
- **Code:** `$canDelete = $permissionManager->userHasRight( $user, 'delete' );`
- **Impact:** The `$canDelete` flag is passed as `wgLayersSlidesConfig.canDelete`
    to the `SpecialSlides.js` frontend (L85), where it controls visibility of
    the delete-slide button (L185). Because it checks the wiki page-deletion
    right instead of `layers-admin`:
    1. Any user who can delete wiki pages (sysops) sees the delete button
       but could also already delete via the `layers-admin` API path —
       so this is not an exploitation path, just a wrong-gate dependency.
    2. A dedicated `layers-admin` user **without** the page-deletion right
       cannot see the delete button in the UI, even though the API would
       accept their deletion request. Legitimate layer admins are
       denied the delete UI.
    Security note: the `layersdelete` API is correctly gated by `layers-admin`
    (in `LayersApiHelperTrait.php`, fixed in P1-045). This is a **UI-only
    authorization inconsistency**, not an API bypass.
- **Fix:** `$canDelete = $permissionManager->userHasRight( $user, 'layers-admin' );`
- **Root cause:** P1-045 fixed `LayersApiHelperTrait.php` but missed this
    call in `SpecialSlides.php`. The bug was introduced simultaneously.
- **Status:** ✅ **Fixed** (v1.5.61)

### Medium

#### Canvas — 1 item

**P2-122 · Smart Guides Broken for `path` Layer Type — Incomplete P1-053 Fix**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
    L498–520, function `_getRefPoint()`
- **Code:**
    ```javascript
    const _getRefPoint = ( state ) => {
        const t = state.type;
        if ( t === 'line' || t === 'arrow' || t === 'dimension' ) { ... }
        if ( t === 'angleDimension' ) { ... }
        return { x: state.x || 0, y: state.y || 0 };  // ← path falls here
    };
    ```
- **Impact:** `path` layers store geometry as `points: [{x,y}, ...]` with
    no top-level `.x` or `.y`. The fallthrough branch returns `{x:0, y:0}`
    for path layers, making snap calculations use the canvas origin as the
    reference. Smart guides fire but snap to globally wrong positions —
    effectively non-functional for freeform path layers.
    P1-053's original title listed "Line, Arrow, **Path**, Dimension" but
    the `path` case was not added to the fix.
- **Fix:**
    ```javascript
    if ( t === 'path' ) {
        const pts = state.points || [];
        return {
            x: pts.length ? Math.min( ...pts.map( p => p.x ) ) : 0,
            y: pts.length ? Math.min( ...pts.map( p => p.y ) ) : 0
        };
    }
    ```
- **Status:** ✅ **Fixed** (v1.5.61)

#### PHP — 1 item

**P2-123 · `ApiLayersInfo.enrichRowsWithUserNames()` Uses Deprecated `ILoadBalancer` API**
- **File:** `src/Api/ApiLayersInfo.php` L524–526
- **Code:**
    ```php
    $dbr = MediaWikiServices::getInstance()
        ->getDBLoadBalancer()
        ->getConnection( DB_REPLICA );
    ```
- **Context:** This code was introduced by the P2-107 fix (batch user
    lookup). The same class already has a `getDb()` method at L642 that
    correctly uses `getConnectionProvider()->getReplicaDatabase()` — the
    modern MW 1.39+ API.
- **Impact:** `ILoadBalancer::getConnection()` is deprecated since MW 1.39
    and will be removed in a future version. When removed, this will cause
    a fatal error on every call to `layersinfo` that has revision history
    with non-zero user IDs. Other files in the extension use the modern API;
    this is an inconsistency introduced during the P2-107 fix.
- **Fix:** Replace L524–526 with `$dbr = $this->getDb();`
- **Status:** ✅ **Fixed** (v1.5.61)

### Low

#### Documentation — 4 items

**D-050-01 · `docs/ARCHITECTURE.md` Stale Coverage and Test Metrics**
- **File:** `docs/ARCHITECTURE.md` L34–35, L148
- **Issues:**
  - L34: `92.19% statements, 82.15% branches` → should be `91.32%, 81.69%`
  - L35: `11,421 tests (167 suites)` → should be `11,445 (168 suites)`
  - L148: `95.19% coverage` → completely outdated (ancient value from before v40)
- **Fix:** Update all three lines to current verified values.

**D-050-02 · `CHANGELOG.md` v1.5.60 Documentation Section Claims Wrong Coverage**
- **File:** `CHANGELOG.md`, v1.5.60 Documentation section
- **Issue:** States coverage metrics were updated to `92.19%` — but the
    actual coverage at the v1.5.60 commit is `91.32%` (commit `4f315a5f`).
- **Fix:** Update CHANGELOG v1.5.60 entry to reflect `91.32%`.

**D-050-03 · `wiki/Changelog.md` Same Stale Coverage Value as D-050-02**
- **File:** `wiki/Changelog.md`, v1.5.60 entry
- **Issue:** Mirrors the `CHANGELOG.md` v1.5.60 Documentation section
    with the same incorrect `92.19%` value.
- **Fix:** Sync with corrected CHANGELOG.md after D-050-02 is fixed.

**D-050-04 · `README.md` Internal God-Class Count Contradiction**
- **File:** `README.md` L317, L353, L384
- **Issues:**
  - L317: "22 god classes" — incorrect (correct value is 23)
  - L353: "17 files" with a Feb 17, 2026 date note — stale (correct is
    19 hand-written JS + 2 PHP = 21 excluding 2 generated)
  - L384 (metrics table): correctly says `23` — creates an internal
    contradiction with L317
- **Fix:** Update L317 and L353 to say 23 and 21 hand-written respectively.
- **Status:** ✅ **Fixed** (v1.5.61)

---

## v49 Confirmed Open Findings (Historical Reference — March 10, 2026)

All items below were open as of the v49 audit and have since been fixed.
See KNOWN_ISSUES.md for the canonical tracking record.

### High

#### PHP — 3 items

**P1-045 · LayersApiHelperTrait `isAllowed('delete')` Privilege Confusion**
- **File:** `src/Api/Traits/LayersApiHelperTrait.php` L106
- **Code:** `$isAdmin = $user->isAllowed( 'delete' );`
- **Impact:** The `'delete'` right in MediaWiki controls wiki **page deletion**,
    not layer administration. Any user with page-deletion rights (typically
    `sysop`) becomes an unrestricted Layers admin, able to delete or rename
    any user's layer sets. Conversely, a dedicated layers admin who does not
    have page-deletion rights cannot moderate layer content. The two domains
    are completely unrelated.
- **Fix:** Introduce a `layers-admin` right in `extension.json` (default
    `sysop`) and check that instead:
    `$isAdmin = $user->isAllowed( 'layers-admin' );`

**P1-046 · SpecialSlides.php DB Query Before Permission Check**
- **File:** `src/SpecialPages/SpecialSlides.php` L172 (DB query), L179 (permission check)
- **Impact:** `getLayerSetByName()` is called on line 172 before
    `userHasRight( $user, 'editlayers' )` is checked on line 179.
    Unauthorized users can probe slide existence by observing which error
    message they receive. Different code paths (does-not-exist vs. no-permission)
    produce distinct responses, allowing enumeration of slide names via
    timing or error message differences.
- **Fix:** Move the permission check to before the DB query (before line 172).

**P1-047 · SpecialEditSlide.php DB Query Before Permission Check**
- **File:** `src/SpecialPages/SpecialEditSlide.php`
- **Impact:** Same pattern as P1-046 — slide record fetched from DB before
    edit permission is verified. Same information-disclosure consequence.
- **Fix:** Same as P1-046 — reorder the permission check to precede any
    database query.

#### JavaScript — 5 items

**P1-048 · APIManager Cache Exception Leaves Promise Permanently Pending**
- **File:** `resources/ext.layers.editor/APIManager.js` L617–636
    (`loadRevisionById`, cache-hit path)
- **Code:**
    ```javascript
    try {
        const result = this._processRevisionData( cachedData, true );
        resolve( result );
    } catch ( error ) {
        this.responseCache.delete( cacheKey );
    }
    return;   // ← executes even after the catch
    ```
- **Impact:** When `_processRevisionData` throws on corrupt cached data,
    the cache entry is deleted but `return` still exits the Promise
    constructor. The Promise is left in perpetually-pending state —
    no error is surfaced, no retry fires, and the editor silently freezes
    on revision load.
- **Fix:** Move `return;` inside the `try` block (before `resolve`), so the
    catch falls through to the API fetch below.

**P1-049 · APIManager `.catch()` Always Receives Undefined `result` — 4 Sites**
- **File:** `resources/ext.layers.editor/APIManager.js` L315, L640, L815, L975
- **Code:** `} ).catch( ( code, result ) => {`
- **Impact:** In jQuery ≥ 3.0, `.then()` → `.catch()` chains lose all
    arguments after the first on rejection (documented jQuery behavior).
    `result` is always `undefined` at all four call sites. Consequences:
    abort detection (`result.textStatus === 'abort'`) never fires — aborted
    requests during rapid revision switching produce spurious error notifications;
    retry logic (`isRetryableError`) classifies every failure as retryable
    (including `permissiondenied`), causing 3 wasted retries before the real
    error is shown; error detail (`result.error.info`) is always lost.
- **Fix:** Replace `.then( success ).catch( failure )` with
    `.then( success, failure )` to preserve both jQuery deferred rejection
    arguments. Or use `.done( success ).fail( failure )` throughout.

**P1-050 · HistoryManager `lastSaveHistoryIndex` Not Decremented on History Trim**
- **File:** `resources/ext.layers.editor/HistoryManager.js` L128–136
    (`saveState`)
- **Code:**
    ```javascript
    this.history.push( state );
    if ( this.history.length > this.maxHistorySteps ) {
        this.history.shift();   // shifts all indices by -1
    }
    this.historyIndex = this.history.length - 1;  // corrected
    // lastSaveHistoryIndex is NOT adjusted
    ```
- **Impact:** After reaching history capacity, `lastSaveHistoryIndex`
    exceeds `history.length - 1`. `history[lastSaveHistoryIndex]` is
    `undefined`. `hasUnsavedChanges()` falls back to comparing against
    `history[0]` (initial load state) instead of the actual last-saved
    state. The "unsaved changes" indicator becomes permanently incorrect
    once the history is full. The fast-path short-circuit is also disabled
    permanently, forcing a deep `layersEqual` scan on every dirty check.
- **Fix:** After `history.shift()`, add:
    `if ( this.lastSaveHistoryIndex > 0 ) { this.lastSaveHistoryIndex--; }`

**P1-051 · EditorBootstrap Creates Duplicate Editor Instances in Production**
- **File:** `resources/ext.layers.editor/editor/EditorBootstrap.js` L442–443
- **Code:** `if ( window.mw && window.mw.config.get( 'debug' ) ) { window.layersEditorInstance = editor; }`
- **Impact:** The duplicate-prevention guard is `if ( window.layersEditorInstance ) return`.
    In production (non-debug mode), `autoBootstrap` never registers the
    new editor in that global. When `areEditorDependenciesReady()` returns
    false, the hook listener defers via 100ms `setTimeout` and returns without
    creating an editor. `autoBootstrap` sees `window.layersEditorInstance === null`,
    creates an editor but does NOT register it. When the timeout fires, the
    hook listener also sees `null` and creates a second editor. Two editors
    share the same container in production.
- **Fix:** Always set `window.layersEditorInstance = editor` after creating,
    regardless of debug mode. Move the assignment outside the debug guard.

**P1-052 · ValidationManager Bounds Stricter Than Server — Valid Data Rejected**
- **File:** `resources/ext.layers.editor/ValidationManager.js` L240, L246
- **Code:**
    ```javascript
    // L240: rejects fontSize < 8 (server allows 1)
    if ( layer.fontSize && ( ... layer.fontSize < 8 || layer.fontSize > 1000 ) )
    // L246: rejects strokeWidth > 50 (server allows 100)
    if ( layer.strokeWidth && ( ... layer.strokeWidth > 50 ) )
    ```
- **Impact:** `LayersValidator` and the server both allow `fontSize` down to
    1 and `strokeWidth` up to 100. `ValidationManager` rejects font sizes 1–7
    and stroke widths 51–100 as invalid before the save reaches the server.
    On wikis that use small font sizes or thick strokes (accessible design,
    infographics), these values are blocked client-side with no clear validation
    message.
- **Fix:** Align `ValidationManager` bounds with the server:
    `fontSize < 1`, `strokeWidth > 100`.

#### Canvas — 3 items

**P1-053 · Smart Guides Non-Functional for Line, Arrow, Path, and Dimension Layers**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js` L486–505
- **Code:**
    ```javascript
    const proposedX = ( originalState.x || 0 ) + deltaX;
    const proposedY = ( originalState.y || 0 ) + deltaY;
    ```
- **Impact:** Line, arrow, path, dimension, and angleDimension layers use
    `x1/y1/x2/y2` or a `points` array — they have no `.x`/`.y` properties.
    `originalState.x` is `undefined`, coercing to `0`. The snap calculation
    receives `proposedX = deltaX` (~10px) instead of the layer's actual
    position (~200px). All snap targets are hundreds of pixels away from
    the proposed position, so `findNearestSnap` never fires. Smart guides
    appear enabled in the UI but are completely inert for these layer types.
- **Fix:** For geometric layers without `.x`/`.y`, derive the reference
    point from `getLayerBounds()` before computing the proposed position,
    then back-calculate the adjusted delta using the bounds-based reference.

**P1-054 · ZoomPanController `fitToWindow()` Null Dereference on `canvas.parentNode`**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L232–234
- **Code:**
    ```javascript
    const container = canvas.parentNode;
    const containerWidth = container.clientWidth - 40;  // ← throws if parentNode is null
    ```
- **Impact:** If `fitToWindow()` is called while the canvas is detached
    from the DOM (during editor teardown, in test environments, or during
    transition animations), `canvas.parentNode` is `null` and
    `container.clientWidth` throws `TypeError`. Prior guards check for
    `!canvas` but not for `!canvas.parentNode`.
- **Fix:** Add `if ( !container ) { return; }` after line 232.

**P1-055 · ZoomPanController `zoomToFitLayers()` Same Null Dereference**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L295–296
- **Code:** `const container = this.manager.canvas.parentNode;`
    followed immediately by `container.clientWidth`
- **Impact:** Identical issue to P1-054 in the `zoomToFitLayers` path.
- **Fix:** Same — add `if ( !container ) { return; }` guard.

---

### Medium

#### PHP — 7 items

**P2-104 · TextSanitizer Zero-Width Space Injection Corrupts User Text**
- **File:** `src/Validation/TextSanitizer.php` L180–197
- **Code:** Inserts `\u200B` (invisible zero-width space) before `(` in
    patterns like `alert(`, `confirm(`, `eval(`, etc.
- **Impact:** User annotations containing JavaScript-keyword-like text
    (code examples, tutorials, documentation labels) are silently mutated
    with an invisible character. `"Use alert() to notify users"` is stored
    as `"Use alert\u200B() to notify users"`. The stored data differs from
    what the user typed, the mutation is invisible in rendered output, and
    it is non-reversible upon retrieval. The mitigation is also unnecessary:
    Canvas `fillText()` cannot execute JavaScript; `removeDangerousProtocols()`
    already strips `javascript:` URIs; and the server never executes stored
    text as code.
- **Fix:** Remove the zero-width space injection block entirely. The
    existing `removeEventHandlers()` and `removeDangerousProtocols()`
    methods provide sufficient protection for the actual threat model
    (no XSS from canvas text).

**P2-105 · `blend` Property Bypasses Enum Validation in ServerSideLayerValidator**
- **File:** `src/Validation/ServerSideLayerValidator.php` L419–425, L544–555
- **Code:** `'blend' => 'string'` in `ALLOWED_PROPERTIES`; `'blend'` not
    listed in the enum-constrained properties checked against `VALUE_CONSTRAINTS`.
- **Impact:** The `blend` property (alias for `blendMode`) is validated only
    as an arbitrary string (max 1000 chars), not constrained to the valid
    Canvas `globalCompositeOperation` values. Any string passes validation
    and is then copied to `blendMode` without re-validation. Invalid blend
    mode strings are silently stored to the DB and passed to the Canvas API,
    which falls back to `source-over` with no error.
- **Fix:** Add `'blend'` to the enum-constrained list using `blendMode`'s
    `VALUE_CONSTRAINTS` for lookups.

**P2-106 · `usleep()` Blocking in DB Retry Loop — Up to 300ms Added to HTTP Request**
- **File:** `src/Database/LayersDatabase.php` L134–135
- **Code:** `usleep( $retryCount * 100000 );  // 100ms, 200ms per retry`
- **Impact:** On transaction conflicts (concurrent saves), the retry loop
    calls `usleep()` with up to 300ms total sleep inside a synchronous
    PHP-FPM worker. On wikis with concurrent editors, this cascades:
    multiple in-flight requests sleeping together can exhaust PHP-FPM
    worker pools and database connection pools under load.
- **Fix:** Reduce to 10ms/20ms, or avoid sleeping entirely since the DB
    transaction isolation already handles the conflict.

**P2-107 · N+1 User Lookup in `ApiLayersInfo.enrichWithUserNames()`**
- **File:** `src/Api/ApiLayersInfo.php` L522–528
- **Code:**
    ```php
    foreach ( $userIds as $userId ) {
        $user = $userFactory->newFromId( $userId );
        if ( $user ) { $users[$userId] = $user->getName(); }
    }
    ```
- **Impact:** Despite the `// Batch load users using UserFactory` comment,
    `UserFactory::newFromId()` creates a lazy `User` whose name is fetched
    via an individual DB query when `getName()` is called. For a layer set
    history page with 50 revisions by 15 distinct users, this executes
    15 sequential DB queries.
- **Fix:** Replace with a single `SELECT user_id, user_name FROM user WHERE
    user_id IN (...)` query via the connection provider's replica database.

**P2-108 · Cache Invalidation Errors Silently Suppressed**
- **File:** `src/Api/Traits/CacheInvalidationTrait.php` L55–58
- **Code:**
    ```php
    } catch ( \Throwable $e ) {
        // Cache invalidation is best-effort; don't fail the save
    }
    ```
- **Impact:** Any exception during cache purging (infrastructure failure,
    misconfiguration, CDN errors) is completely swallowed with no log entry.
    On high-traffic wikis, stale cached content can persist indefinitely
    with no operator visibility. The "best-effort" architecture is reasonable;
    the silent suppression is not.
- **Fix:** Add a warning log entry:
    `$this->getLogger()->warning( 'Cache invalidation failed', [ 'exception' => $e ] );`

**P2-109 · `wfLogWarning()` Deprecated API in RateLimiter**
- **File:** `src/Security/RateLimiter.php` L99–100
- **Code:** `if ( function_exists( 'wfLogWarning' ) ) { wfLogWarning( ... ); }`
- **Impact:** `wfLogWarning()` is deprecated in MediaWiki and may be removed
    in a future version. The `function_exists` guard prevents a fatal error
    but causes silent loss of rate limit logging when the function is removed —
    a security monitoring regression. All other code in the extension uses
    `LoggerFactory::getInstance('Layers')->warning(...)` consistently.
- **Fix:** Replace with `$this->getLogger()->warning( 'Layers rate limit: {action}...', [...] );`
    and remove the `function_exists` guard.

**P2-110 · `ApiLayersRename` Returns Wrong Error Code for Invalid Name Format**
- **File:** `src/Api/ApiLayersRename.php`
- **Impact:** When the `oldname` parameter fails format validation
    (invalid characters), the API returns `ERROR_LAYERSET_NOT_FOUND`
    ("Layer set not found"). The actual problem is a structurally invalid
    input name, not a missing set. API consumers receive a "not found"
    response when the correct behavior would distinguish "bad input" from
    "not found," breaking client-side retry/create logic.
- **Fix:** Return `ERROR_INVALID_SETNAME` for format-validation failures.

#### JavaScript — 6 items

**P2-111 · `parseMWTimestamp` Fallback Creates Date in Local Timezone, Not UTC**
- **File:** `resources/ext.layers.editor/LayersEditor.js` L1042–1047
- **Code:**
    `return new Date( year, month, day, hour, minute, second );  // LOCAL timezone`
    — the `revisionManager` delegate path (primary) correctly uses `Date.UTC(...)`.
- **Impact:** When `revisionManager` is null (early initialization or an
    error loading the module), the fallback creates timestamps in the user's
    local timezone. For UTC+8 users, timestamps appear 8 hours ahead of the
    actual revision time in the revision history display.
- **Fix:** `return new Date( Date.UTC( year, month, day, hour, minute, second ) );`

**P2-112 · `RevisionManager.loadLayerSetByName` Mutates `currentSetName` Before Load Succeeds**
- **File:** `resources/ext.layers.editor/editor/RevisionManager.js` L316 (before), L319 (after)
- **Code:**
    ```javascript
    this.stateManager.set( 'currentSetName', setName );   // Line 316 — optimistic
    await this.apiManager.loadLayersBySetName( setName ); // Line 319 — may fail
    ```
- **Impact:** If `loadLayersBySetName` rejects (network error, set not
    found), `currentSetName` has already been set to the failed target.
    The error handler logs and notifies the user but never reverts
    `currentSetName`. Subsequent saves write to the non-existent named set.
- **Fix:** Move `stateManager.set( 'currentSetName', setName )` to after
    the `await` call (inside the success path only).

**P2-113 · DraftManager `setInterval` Callback Bypasses `isRecoveryMode` Check**
- **File:** `resources/ext.layers.editor/DraftManager.js` L140–143
- **Code:**
    ```javascript
    this.autoSaveTimer = setInterval( () => {
        if ( this.editor.isDirty && this.editor.isDirty() ) {
            this.saveDraft();   // No isRecoveryMode check
        }
    }, AUTO_SAVE_INTERVAL_MS );
    ```
    The `scheduleAutoSave` path (L115) correctly gates on `isRecoveryMode`,
    but the `setInterval` callback does not.
- **Impact:** While the recovery confirmation dialog is shown, if the
    auto-save interval fires the editor is dirty, `saveDraft()` runs and
    can overwrite the draft with pre-recovery data or partially-initialized
    state.
- **Fix:** Add `if ( this.isRecoveryMode ) { return; }` inside the interval
    callback, mirroring the `scheduleAutoSave` guard.

**P2-114 · APIManager Hardcodes Layer Limit to 100, Ignores `wgLayersMaxLayerCount`**
- **File:** `resources/ext.layers.editor/APIManager.js` L898
- **Code:** `const validationResult = validator.validateLayers( layers, 100 );`
- **Impact:** On wikis configured with `$wgLayersMaxLayerCount` ≠ 100, the
    client validation disagrees with the server. With limit = 50, layers
    51–100 are allowed client-side but rejected server-side with a confusing
    server error. With limit = 150, layers 101–150 are blocked client-side
    with a "too many layers" message even though the server would accept them.
- **Fix:** `const maxLayers = ( mw.config.get( 'wgLayersMaxLayerCount' ) ) || 100;`

**P2-115 · EventManager `nudgeSelectedLayers` Directly Mutates Layer State**
- **File:** `resources/ext.layers.editor/EventManager.js` L203–204
- **Code:**
    ```javascript
    layer.x = ( layer.x || 0 ) + dx;   // Direct mutation of state object
    layer.y = ( layer.y || 0 ) + dy;
    ```
- **Impact:** `getSelectedLayers()` returns references to actual objects
    in `StateManager.state.layers`. Mutating them in-place bypasses
    `stateManager.set('layers', ...)`: `_layersVersion` is not incremented
    (SmartGuidesController snap cache goes stale), and layer-change
    subscribers (DraftManager, LayerPanel coordinate display) are not
    notified. `historyManager.saveState('nudge')` is called afterward and
    does capture the correct final position — but the notification window
    between mutation and save is skipped.
- **Fix:** Use `stateManager.updateLayer( layer.id, { x: ..., y: ... } )`
    for each nudged layer, which goes through the proper notification path.

**P2-116 · DraftManager Storage Key Collision Between Files With Spaces vs Underscores**
- **File:** `resources/ext.layers.editor/DraftManager.js` (constructor)
- **Code:** `this.storageKey = STORAGE_KEY_PREFIX + this.filename.replace( /[^a-zA-Z0-9_.-]/g, '_' );`
- **Impact:** `File:My Budget.jpg` and `File:My_Budget.jpg` are distinct
    MediaWiki files (different SHA1, different history) but both normalize
    to `File_My_Budget_jpg`, producing the same localStorage key. Opening
    either file in the editor reads the other's draft. On shared computers
    this causes draft cross-contamination.
- **Fix:** Append a short hash of the raw (pre-normalization) filename to
    ensure uniqueness.

#### Canvas — 5 items

**P2-117 · `CanvasManager.emitTransforming()` RAF Return Value Discarded — Fires Post-Destroy**
- **File:** `resources/ext.layers.editor/CanvasManager.js` L843
- **Code:**
    ```javascript
    this.transformEventScheduled = true;
    window.requestAnimationFrame( () => {   // ← return value discarded
        this.transformEventScheduled = false;
        ...dispatch CustomEvent...
    } );
    ```
    All other RAF callbacks in the codebase (`_dragRafId`, `_resizeRafId`,
    `_rotationRafId`) store and cancel their IDs in `destroy()`.
- **Impact:** The RAF always fires one frame after it is scheduled, even if
    the editor is destroyed during a drag operation. The callback dispatches
    a `layers:transforming` event using potentially stale or null data.
- **Fix:** Store the RAF ID and cancel it in `destroy()`, matching the
    pattern used by TransformController's other RAF animations.

**P2-118 · `ZoomPanController.animationFrameId` Not Nulled When Animation Completes**
- **File:** `resources/ext.layers.editor/canvas/ZoomPanController.js` L215–218
- **Code:** Completion branch:
    ```javascript
    this.isAnimatingZoom = false;
    this.setZoomDirect( this.zoomAnimationTargetZoom );
    // ← animationFrameId still holds the old numeric ID
    ```
- **Impact:** After a completed animation, `animationFrameId` remains truthy.
    Every subsequent `smoothZoomTo()` call starts by cancelling the stale
    ID via `cancelAnimationFrame( lastId )`. This is harmless in isolation
    but is semantically wrong and would cause issues in any code that
    guards on `if (this.animationFrameId)` to detect "animation in progress."
- **Fix:** Add `this.animationFrameId = null;` in the completion branch.

**P2-119 · `SelectionRenderer` Allocates New `AngleDimensionRenderer` on Every Render Frame**
- **File:** `resources/ext.layers.editor/canvas/SelectionRenderer.js` L598
- **Code:**
    ```javascript
    const tempRenderer = new AngleDimensionRenderer( null );
    const angles = tempRenderer.calculateAngles( layer );
    ```
    Called on every `mousemove` while an angleDimension layer is selected.
- **Impact:** ~60 heap allocations per second during drag. `HitTestController`
    solves the identical problem with a cached lazy instance; `SelectionRenderer`
    does not.
- **Fix:** Add a `_cachedAngleRenderer` property (initialized `null` in
    constructor) and lazily create it on first use, mirroring `HitTestController`.

**P2-120 · `TransformController._arrowTipRafId` Absent from Constructor**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js`
    (constructor, `destroy()` L1105)
- **Code:** `destroy()` checks `if ( this._arrowTipRafId !== null )` but the
    property is never initialized in the constructor. Before the first arrow-tip
    drag, `this._arrowTipRafId` is `undefined`.
- **Impact:** The guard `undefined !== null` evaluates to `true`, causing
    `cancelAnimationFrame(undefined)` to be called on every `destroy()`
    invocation before any arrow drag. Unlike `_resizeRafId`, `_dragRafId`,
    and `_rotationRafId` which are correctly initialized to `null`.
- **Fix:** Add `this._arrowTipRafId = null;` to the constructor.

**P2-121 · `TransformController` Text-Drag State Variables Uninitialized**
- **File:** `resources/ext.layers.editor/canvas/TransformController.js` (constructor)
- **Missing init:** `isAngleDimensionTextDragging`, `isDimensionTextDragging`,
    `angleDimTextLayerId`, `dimensionTextLayerId`, `_pendingDragLayerId`
- **Impact:** These are first assigned at drag-start time. Code elsewhere
    guards on their truthiness. While `undefined` is falsy and works correctly
    for boolean guards today, it creates fragility: `destroy()` sets
    `_pendingDragLayerId = null` even though it was never declared, and the
    `_arrowTipRafId !== null` bug (P2-120) shows what happens when null-vs-
    undefined is confused in this same file.
- **Fix:** Initialize all five to their respective null/false defaults in
    the constructor.

---

### Low

#### PHP — 8 items

**P3-128 · `layeredFileRenderer.errorSpan` Echoes User-Supplied Filename**
- **File:** `src/Hooks/Processors/LayeredFileRenderer.php` L79
- **Code:** `return $this->errorSpan( 'File not found: ' . $filename );`
- **Note:** The `errorSpan()` method correctly calls `htmlspecialchars()`,
    so **there is no XSS risk**. However, the user-supplied filename is
    echoed into the rendered page output visible to other users.
- **Fix:** Use a generic i18n error message: `$this->msg( 'layers-file-not-found' )->text()`

**P3-129 · `EditLayersAction::requiresUnblock()` Returns `false`**
- **File:** `src/Action/EditLayersAction.php`
- **Impact:** Blocked users can load the full editor UI, including layer
    data fetched via `layersinfo`, before receiving a rejection only at save
    time. MediaWiki's "you are blocked" interstitial page is bypassed.
- **Fix:** Return `true` unless there is a documented reason why blocked users
    need editor access.

**P3-130 · `returnTo` Only Accepted for Existing Pages**
- **File:** `src/Action/EditLayersAction.php` L85–90
- **Code:** `if ( $returnTitle && $returnTitle->isKnown() ) {`
- **Impact:** If the editor is opened from a not-yet-saved page, the
    `returnTo` parameter is silently dropped and the user has no path back.
- **Fix:** Use `isValid()` plus a namespace allowlist instead of `isKnown()`.

**P3-131 · `TextSanitizer` Uses `strlen()` Not `mb_strlen()` for Length Check**
- **File:** `src/Validation/TextSanitizer.php`
- **Code:** `if ( strlen( $text ) > self::MAX_TEXT_LENGTH ) {`
- **Impact:** For CJK or emoji-heavy text, UTF-8 multi-byte characters
    count more than one byte each. A 400-character Japanese annotation
    uses ~1,200 bytes and may be incorrectly rejected.
- **Fix:** `if ( mb_strlen( $text, 'UTF-8' ) > self::MAX_TEXT_CHAR_LENGTH ) {`

**P3-132 · `ApiLayersList` Bypasses Shared `RateLimiter` Class**
- **File:** `src/Api/ApiLayersList.php`
- **Code:** Direct `$user->pingLimiter( 'editlayers-list' );` call instead
    of using `RateLimiter::checkRateLimit()`.
- **Impact:** Future rate-limiter enhancements (logging, overrides, metrics)
    won't apply to list requests. Inconsistency with every other API module.
- **Fix:** Use `RateLimiter::checkRateLimit()` via the shared trait.

**P3-133 · `LayersSchemaManager` Brittle Error Message String Parsing**
- **File:** `src/Database/LayersSchemaManager.php`
- **Code:** `preg_match( '/^Error (\d+):/', $message, $matches )`
- **Impact:** MySQL 5.x, MySQL 8.x, and MariaDB format error messages
    differently. Future DB versions could break duplicate-constraint
    detection, causing schema migration patches to be applied twice.
- **Fix:** Catch specific typed RDBMS exceptions rather than parsing
    error message strings. Use `IF NOT EXISTS` DDL where supported.

**P3-134 · Hardcoded English String `'Edit Layers'` in `Hooks.php`**
- **File:** `src/Hooks.php`
- **Code:** `$linkText = 'Edit Layers'; return "[$editUrl $linkText]";`
- **Impact:** Non-English wikis display an English link text.
    Contradicts the extension's own i18n system.
- **Fix:** `$linkText = wfMessage( 'layers-edit-link-text' )->text();`
    — add key to `i18n/en.json` and `i18n/qqq.json`.

**P3-135 · `ThumbnailProcessor` Dead Boolean Comparison on `?string` Type**
- **File:** `src/Hooks/Processors/ThumbnailProcessor.php` L110
- **Code:** `if ( $layersFlag === 'off' || ... || $layersFlag === false ) {`
- **Impact:** `$layersFlag` is `?string`; with `declare(strict_types=1)`,
    `$layersFlag === false` can never be true (string vs boolean). The
    boolean branch of the condition is unreachable dead code.
- **Fix:** Remove `|| $layersFlag === false` from the condition.

#### JavaScript — 3 items

**P3-136 · APIManager `mw.notify()` Called Without `typeof mw` Guard**
- **File:** `resources/ext.layers.editor/APIManager.js` L592
- **Code:** `mw.notify( this.getMessage( ... ), { type: 'success' } );`
- **Impact:** All other `mw.*` calls in the file are guarded. This bare
    call will throw `ReferenceError` in Jest tests or if the module loads
    before MediaWiki is initialized.
- **Fix:** Wrap with `if ( typeof mw !== 'undefined' ) { ... }`

**P3-137 · RevisionManager `namedSets.push()` Mutates StateManager Array Before `set()`**
- **File:** `resources/ext.layers.editor/editor/RevisionManager.js` L412–419
- **Code:**
    ```javascript
    const namedSets = this.stateManager.get( 'namedSets' ) || [];
    namedSets.push( { name: trimmedName, ... } );    // ← in-place mutation
    this.stateManager.set( 'namedSets', namedSets ); // same reference
    ```
- **Impact:** State subscribers using `(newValue, oldValue)` arguments to
    detect changes receive the same reference for both. Diff-based
    optimizations in `SetSelectorController` or `LayerPanel` may not
    detect the change. If an exception occurs between `push()` and `set()`,
    `state.namedSets` already contains the new item with no notification.
- **Fix:** `this.stateManager.set( 'namedSets', [ ...namedSets, { name: trimmedName, ... } ] );`

**P3-138 · Double `showSpinner` / Double `hideSpinner` on Every Save**
- **File:** `resources/ext.layers.editor/LayersEditor.js` +
    `resources/ext.layers.editor/APIManager.js`
- **Impact:** `LayersEditor.save()` calls `showSpinner()` then
    `this.apiManager.saveLayers()` which calls `showSpinner()` internally.
    On error, `performSaveWithRetry` calls `hideSpinner()` and
    `LayersEditor.save()`'s `.catch()` calls `hideSpinner()` a second time.
    Double-hide can leave spinner UI in an undefined state depending on
    whether the implementation counts references.
- **Fix:** Establish single ownership — either `LayersEditor.save()` or
    `saveLayers()` manages the spinner lifecycle, not both.

#### Canvas — 3 items

**P3-139 · CanvasManager `handleImageLoaded()` Renders Canvas Twice**
- **File:** `resources/ext.layers.editor/CanvasManager.js` L590–592
- **Code:**
    ```javascript
    this.redraw();                                    // Full render #1
    if ( this.editor && this.editor.layers ) {
        this.renderLayers( this.editor.layers );      // Full render #2 (same result)
    }
    ```
    `renderLayers` delegates to `redraw`, so two full canvas renders occur.
- **Impact:** Doubles the render cost at the most expensive moment
    (first image paint), causing unnecessary frame budget consumption
    on complex layer sets.
- **Fix:** Remove the first `this.redraw()` call entirely.

**P3-140 · CanvasManager Legacy `updateLayerPosition()` Is Dead/Incomplete Code**
- **File:** `resources/ext.layers.editor/CanvasManager.js`
- **Impact:** `CanvasManager.updateLayerPosition()` handles only 7 of
    ~15 layer types and is never called — `TransformController.handleDrag()`
    uses its own complete version. Being public on the facade object, it
    is a trap for future callers that would get silent no-ops for
    arrow/line/path/dimension/textbox/image/marker layers.
- **Fix:** Either delegate to `this.transformController.updateLayerPosition()`
    or delete the method.

**P3-141 · SelectionManager Fallback `getLayerAtPoint()` Iterates in Wrong Order**
- **File:** `resources/ext.layers.editor/SelectionManager.js` L783–800
- **Impact:** The fallback (used in tests or when `canvasManager` is
    unavailable) iterates `length - 1 → 0`, returning the bottom-most
    visual layer instead of the top-most. `CanvasRenderer` renders
    `length - 1 → 0` meaning index 0 is the topmost layer. `HitTestController`
    correctly iterates `0 → N` with an explanatory comment; this fallback
    does the opposite.
- **Fix:** Change the loop direction to `0 → N` with a matching comment.

---

### Documentation Issues (v49)

See [KNOWN_ISSUES.md docs section](#doc-issues) for full tracking. Summary:

| # | File | Issue |
|---|------|-------|
| D-049-01 | `README.md` | Coverage badge shows `95.19%` (correct: `92.19%`) |
| D-049-02 | `README.md` | Statistics table also shows `95.19%` |
| D-049-03 | `CHANGELOG.md [1.5.59]` | Technical Details: wrong coverage (`95.19%`), wrong test count (`11,258`), wrong god class count (`17`) |
| D-049-04 | `docs/ARCHITECTURE.md` | God class table: 13 JS hand-written listed, 19 exist (6 missing entirely: TransformController, ResizeCalculator, AngleDimensionRenderer, DrawingController, CanvasEvents, CalloutRenderer) |
| D-049-05 | `docs/ARCHITECTURE.md` | Near-threshold table misclassifies 3 god-class files (TransformController, ResizeCalculator, CalloutRenderer) |
| D-049-06 | `docs/ARCHITECTURE.md` | Coverage note still states `95.19%` |
| D-049-07 | `LayersGuide.mediawiki` | Says `layerslink=` is "a deprecated feature" — directly contradicts README.md and WIKITEXT_USAGE.md which actively document it |
| D-049-08 | `docs/DEVELOPER_ONBOARDING.md` | TransformController listed as ~990 lines (it's ~1,149 — a god class) |
| D-049-09 | `docs/RELEASE_GUIDE.md` | Instructs "Use present tense ('Add' not 'Added')" but every CHANGELOG entry uses past tense |
| D-049-10 | `docs/DOCUMENTATION_UPDATE_GUIDE.md` | Internal contradiction: calls it "the '11 Files' rule" then references "12 files" in the Common Mistakes table |

---

## v49 Verified Non-Issues (False Positives Eliminated)

The following were reported by automated analysis during this v49 review
but verified as non-issues:

- **TextSanitizer `errorSpan` XSS:** `errorSpan()` at L269 calls
    `htmlspecialchars( $message )`. The HTML is properly escaped. Downgraded
    to LOW info-disclosure only.
- **Hooks.php `layerListParserFunction` wikitext injection:** SetNameSanitizer
    restricts names to `[a-zA-Z0-9\-_]` which cannot form valid wikitext
    syntax. Not currently exploitable. Retained as defense-in-depth note only.
- **RateLimiter `isComplexityAllowed` group children not counted:** Groups in
    this extension are always stored flat — group layers reference children by
    ID in a sibling `childIds` field; children are separate entries in the
    top-level `$layers` array. The child complexity IS counted via their own
    array entries. FALSE POSITIVE.
- **`parseMWTimestamp` BUG-5 (subagent misidentification):** The subagent
    described a separate fallback block. Actual code confirmed: the fallback
    at L1042–1047 IS the only non-delegate path and DOES use the local-timezone
    `new Date(year,month,day,...)` constructor. CONFIRMED as P2-111.
- **RevisionManager `loadLayerSetByName` success-case `currentSetName` mutation:**
    The code at L316 precedes the `await` at L319 — this order IS wrong. CONFIRMED as P2-112.

---

## Current Metrics (Verified March 25, 2026 — v60 audit)

| Metric | Verified Current Value |
|--------|------------------------|
| Extension version | 1.5.63 |
| MediaWiki requirement | >= 1.44.0 |
| PHP requirement | 8.1+ |
| JS source files (excluding `resources/dist`) | 157 |
| JS source lines (excluding `resources/dist`) | ~113,922 |
| PHP production files (`src/`) | 42 |
| PHP production lines (`src/`) | ~15,339 |
| Jest test suites | 168 |
| Jest tests | 11,894 |
| Statement coverage | 94.28% |
| Branch coverage | 84.18% |
| i18n keys (`en.json`, `qqq.json`) | 841 |
| PHPUnit test files | 34 |
| Files > 1,000 lines | 26 total |
| ESLint disable comments | 18 (all legitimate) |

## God Class Status (26 files >= 1,000 lines — Verified March 25, 2026)

### Generated Data (Exempt — 5 files)

| File | Lines | Notes |
|------|-------|-------|
| ShapeLibraryData.original.js | 11,294 | Icon set: original |
| ShapeLibraryData.iec60417.js | 5,906 | Icon set: IEC 60417 |
| EmojiLibraryIndex.js | 3,056 | Emoji search index |
| ShapeLibraryData.js | 1,644 | Combined registry |
| ShapeLibraryData.iso7000.js | 1,610 | Icon set: ISO 7000 |

### Hand-Written JavaScript (19 files)

| File | Lines | Change from v59 |
|------|-------|-----------------|
| LayerPanel.js | 2,167 | ↑2 |
| CanvasManager.js | 2,111 | ↑23 |
| Toolbar.js | 1,934 | ↑1 |
| InlineTextEditor.js | 1,849 | ↑1 |
| PropertyBuilders.js | 1,815 | ↓11 |
| LayersEditor.js | 1,814 | ↑1 |
| APIManager.js | 1,641 | ↑1 |
| SelectionManager.js | 1,421 | ↑2 |
| ViewerManager.js | 1,267 | ↑1 |
| CanvasRenderer.js | 1,257 | ↑1 |
| TransformController.js | 1,202 | ↑12 |
| ToolbarStyleControls.js | 1,140 | ↑1 |
| SlideController.js | 1,127 | ↑1 |
| TextBoxRenderer.js | 1,121 | ↑1 |
| ResizeCalculator.js | 1,071 | ↑1 |
| AngleDimensionRenderer.js | 1,068 | ↑1 |
| DrawingController.js | 1,055 | ↑1 |
| CanvasEvents.js | 1,032 | ↓1 |
| CalloutRenderer.js | 1,001 | ↑1 |

### PHP (2 files)

| File | Lines | Change from v59 |
|------|-------|-----------------|
| ServerSideLayerValidator.php | 1,434 | — |
| LayersDatabase.php | 1,399 | ↑23 |

### Near-Threshold (900–999 lines — 8 files)

| File | Lines |
|------|-------|
| LayerRenderer.js | 999 |
| PropertiesForm.js | 995 |
| GroupManager.js | 987 |
| SelectionRenderer.js | 985 |
| StateManager.js | 967 |
| ShapeRenderer.js | 959 |
| LayersValidator.js | 956 |
| ArrowRenderer.js | 932 |

## Issue Summary (v60 — March 25, 2026)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| SQL dead code | 0 | 0 | 0 | 1 | P3-186 ✅ Fixed |
| JS accessibility | 0 | 0 | 0 | 1 | P3-187 ✅ Fixed |
| Documentation | 0 | 0 | 0 | 3 | D-060-01..03 ✅ Fixed |
| Carried forward | 0 | 0 | 0 | 4 | P3-174 ✅, P3-175 ✅, P3-147 accepted, P3-148 deferred |
| **Total** | **0** | **0** | **0** | **9** | **7 fixed + 2 deferred** |

*All v60 code and doc items fixed. P3-147 (redundant SQL) accepted.
P3-148 (unused interface) deferred.*

## Issue Summary (v56 — March 16, 2026)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| JS security | 0 | 1 | 3 | 0 | P1-059; P2-133/P2-134/P2-135 |
| JS bugs | 0 | 1 | 2 | 0 | P1-060; P2-136/P2-137 |
| JS quality | 0 | 0 | 0 | 2 | P3-157/P3-158 |
| Test gaps | 0 | 0 | 0 | 2 | P3-159/P3-160 |
| Documentation | 0 | 0 | 0 | 8 | D-056-01..08 |
| Carried forward | 0 | 0 | 0 | 2 | P3-146/P3-147 |
| **Total open** | **0** | **2** | **5** | **14** | **21 open (13 new + 8 doc)** |

*P3-148 (unused LayerValidatorInterface) remains deferred.*
*P3-146 removal planned; P3-147 accepted per CHANGELOG.*

## Issue Summary (v55 — March 14, 2026 — superseded by v56)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| PHP bugs | 0 | ~~1~~ 0 | ~~2~~ 0 | ~~1~~ 0 | P1-058 FIXED; P2-128/P2-129 FIXED; P3-153 FIXED |
| JS bugs | 0 | 0 | ~~3~~ 0 | ~~3~~ 0 | P2-130/P2-131 FIXED; P2-132 FALSE POSITIVE; P3-154 FIXED; P3-155/P3-156 FALSE POSITIVE |
| Documentation | 0 | 0 | 0 | ~~2~~ 0 | D-055-01/D-055-02 FIXED |
| Carried forward | 0 | 0 | 0 | 2 | P3-146/P3-147 from v54 |
| **Total open** | **0** | **0** | **0** | **2** | **2 open items (9 fixed, 3 false positives)** |

*P3-148 (unused LayerValidatorInterface) remains deferred (low priority).*
*P3-147 carried forward from v54 separately from the 13 new v55 items.*
*v55 fix pass: P1-058/P2-128/P2-129/P2-130/P2-131/P3-154 fixed; P2-132/P3-155/P3-156 false positives.*

## Issue Summary (v54 — March 14, 2026 — superseded by v55)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Security | 0 | ~~1~~ 0 | 0 | 0 | P1-057: FIXED |
| PHP bugs | 0 | 0 | ~~2~~ 0 | 2 | P2-124/P2-125 FIXED; P3-146/P3-147 open; P3-148 deferred |
| JS bugs | 0 | 0 | ~~2~~ 0 | 0 | P2-126/P2-127 FIXED; P3-150/P3-151/P3-152 FIXED |
| PHP defense-in-depth | 0 | 0 | 0 | 0 | P3-149: false positive (upstream validates) |
| Documentation | 0 | 0 | 0 | ~~14~~ 0 | D-054-01 through D-054-14: ALL FIXED |
| **Total open** | **0** | **0** | **0** | **2** | **2 open items (was 26)** |

*P3-145 (SpecialSlides.js test coverage) resolved — tests now exist.*

## Issue Summary (v53 — March 12, 2026 — superseded by v54)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Documentation | 0 | 0 | 0 | ~~4~~ 0 | 4 doc inaccuracies fixed this session |
| Testing gap | 0 | 0 | 0 | ~~1~~ 0 | P3-145: now resolved (tests exist) |
| **Total open** | **0** | **0** | **0** | **0** | **All v53 items resolved** |

## Issue Summary (v52 — March 11, 2026 — superseded by v53)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Code style | 0 | 0 | 0 | ~~1~~ 0 | Fixed this session (APIManager blank line) |
| Documentation | 0 | 0 | 0 | ~~3~~ 0 | Fixed this session (test count, i18n count) |
| **Total open** | **0** | **0** | **0** | **0** | **All 4 v52 items fixed** |

## Issue Summary (v51 — March 10, 2026 — superseded by v52)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| JavaScript bugs | 0 | 0 | 0 | ~~2~~ 0 | All fixed v1.5.62 |
| **Total open** | **0** | **0** | **0** | **0** | **All 2 v51 items fixed in v1.5.62** |

## Issue Summary (v50 — March 10, 2026 — superseded by v51)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| PHP bugs | 0 | ~~1~~ 0 | ~~1~~ 0 | 0 | All fixed v1.5.61 |
| Canvas bugs | 0 | 0 | ~~1~~ 0 | 0 | All fixed v1.5.61 |
| Documentation | 0 | 0 | 0 | ~~4~~ 0 | All fixed v1.5.61 |
| **Total open** | **0** | **0** | **0** | **0** | **All 7 v50 items fixed in v1.5.61** |

## v49 Issue Summary (March 10, 2026 — superseded by v50)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| PHP bugs | 0 | ~~3~~ 0 | ~~7~~ 0 | ~~8~~ 0 | All fixed v1.5.59/v1.5.60 |
| JS bugs | 0 | ~~5~~ 0 | ~~6~~ 0 | ~~3~~ 0 | All fixed v1.5.59/v1.5.60 |
| Canvas bugs | 0 | ~~3~~ 0 | ~~5~~ 0 | ~~3~~ 0 | All fixed v1.5.59/v1.5.60 |
| Documentation | 0 | 0 | ~~10~~ 0 | 0 | All fixed v1.5.60 |
| Code quality | 0 | 0 | 0 | ~~1~~ 0 | Fixed v1.5.60 |
| **Total open** | **0** | **0** | **0** | **0** | **All 54 items closed** |

## Overall Assessment

The codebase maintains strong architecture, comprehensive test coverage
(92.88% statements, 11,847 tests in 168 suites), 100% ES6 class migration,
and robust security controls (CSRF, rate limiting, input validation). All
v49–v56 code fixes confirmed intact (369 total historical issues resolved).

The v57 review (HEAD `6f6b8c8f`, v1.5.62) found **3 MEDIUM** (deleteNamedSet
missing transaction, ApiLayersRename wrong error constant, ApiLayersSave
validation duplication) and **2 LOW** code items (ShadowRenderer DOMMatrix
feature detection, CanvasEvents require() fallback). Additionally, 5
documentation drift items identified. 12 false-positive reports from
automated analysis were verified and eliminated (see Verified Non-Issues).

10 items currently open: 3 MEDIUM, 2 LOW code items, and 5 documentation
drift items. P3-146 (dead table), P3-147 (redundant SQL) carried forward.
P3-148 deferred. No CRITICAL or HIGH issues remain open.

The codebase is well-architected with strong test coverage (92.88%
statements, 82.58% branches) and robust defense-in-depth security
controls. The remaining open items are minor consistency issues and
documentation drift — no functional or security regressions.

---

## Historical Findings Archive

Findings from **v47 (March 10, 2026) and earlier** (v22 through v47) have been
archived to keep this document focused on recent audits.

See [docs/archive/codebase_review_v47_and_earlier.md](docs/archive/codebase_review_v47_and_earlier.md)
for the complete historical record.
