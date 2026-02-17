# Known Issues

**Last updated:** February 17, 2026 — v1.5.58 release

This document tracks known issues in the Layers extension, prioritized
as P0 (critical/data loss), P1 (high/significant bugs), P2 (medium),
and P3 (low/cosmetic). Issues are organized by priority and status.

## Summary

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| P0 | 5 | 4 | 1 |
| P1 | 38 | 34 | 4 |
| P2 | 87 | 70 | 17 |
| P3 | 105 | 75 | 30 |
| **Total** | **235** | **183** | **52** |

---

## Newly Confirmed in v42

### P0-005: CacheInvalidationTrait.php Missing — All Write APIs Broken

- **Files:** `src/Api/ApiLayersSave.php` L9+L67, `src/Api/ApiLayersDelete.php`
  L8+L40, `src/Api/ApiLayersRename.php` L8+L41
- **Impact:** All three write API modules declare `use CacheInvalidationTrait`
  and call `$this->invalidateCachesForFile()`. The trait file does NOT exist
  on disk. PHP autoloader fails when any write API class is instantiated,
  producing a fatal error. **The entire write API is non-functional.**
- **Evidence:** `ls src/Api/Traits/` shows 4 trait files; CacheInvalidationTrait.php
  is absent. `grep -rn CacheInvalidationTrait src/` confirms 3 files reference it.
- **Root Cause:** v41 review documented P1-033 as "✅ Fixed v41" claiming the
  trait was extracted. The fix was **never committed** — the trait file was never
  created. Reopens and escalates P1-033 to P0.
- **Status:** Open
- **Introduced:** v41 (documented as fixed but never committed); confirmed v42

### P1-035: ApiLayersInfo Null Dereference on Line 280

- **File:** `src/Api/ApiLayersInfo.php` L280
- **Impact:** When no layers exist for an image (`$layerSet` is null from
  line 249 branch), code at line 280 attempts `$layerSet['name']` on null.
  In PHP 8+ this triggers a TypeError. Any `layersinfo` API call for an
  image without layers will produce an error.
- **Evidence:** Code reads `$currentSetName = $layerSet['name'] ?? $layerSet['setName'] ?? null;`
  outside the `if ($layerSet)` guard.
- **Recommended Fix:** Wrap lines 280-310 in `if ( $layerSet ) { ... }`.
- **Status:** Open
- **Introduced:** v42 review

### ~~P1-036: Arrow Keys Always Pan, Never Nudge Selected Layers~~ (RESOLVED)

- **File:** `resources/ext.layers.editor/EventManager.js`
- **Status:** ✅ Resolved in v42 fixes
- **Resolution:** Implemented `handleArrowKeyNudge()` and `nudgeSelectedLayers()`
  methods in EventManager.js. Arrow keys now nudge selected layers by 1px
  (or 10px with Shift held). Includes proper history recording for undo/redo,
  locked layer protection, and status bar updates. 17 new tests added.

### P1-037: Color Preview Mutates Layers Without StateManager

- **File:** `resources/ext.layers.editor/ToolbarStyleControls.js` L522-563
- **Impact:** `applyColorPreview()` directly writes `layer.fill = color`
  and `layer.stroke = color` without StateManager. Changes are not tracked
  by HistoryManager (no undo/redo). Canceling the color picker leaves the
  preview color applied with no way to rollback.
- **Evidence:** Lines 521-564 directly mutate layer objects and call
  `renderLayers()` without any saveState or StateManager interaction.
- **Recommended Fix:** Store original colors before preview, restore on cancel,
  commit via StateManager on confirm.
- **Status:** Open
- **Introduced:** v42 review

### P1-038: ThumbnailRenderer Font Name Not Validated Against Whitelist

- **File:** `src/ThumbnailRenderer.php`
- **Impact:** Font names from layer data are passed to ImageMagick's `-font`
  flag without validation against `$wgLayersDefaultFonts`. While
  `sanitizeIdentifier()` strips at save time, ThumbnailRenderer has no
  secondary check. If data bypasses validation (direct DB edit), an
  arbitrary font path could reach ImageMagick.
- **Recommended Fix:** Validate against whitelist; fall back to 'DejaVu-Sans'.
- **Status:** Open
- **Introduced:** v42 review

### P2-074: Double Render on Every Undo/Redo

- **Files:** `resources/ext.layers.editor/EventManager.js` L140-165,
  `resources/ext.layers.editor/HistoryManager.js` L307-322
- **Impact:** EventManager calls `renderLayers()` + `markDirty()` after
  undo/redo, but HistoryManager.restoreState() already calls both.
  Every undo/redo triggers two full canvas renders.
- **Recommended Fix:** Remove redundant calls in EventManager.
- **Status:** Open
- **Introduced:** v42 review

### P2-075: CustomShapeRenderer Spread Shadow Ignores Rotation/Scale

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** `drawSpreadShadowForImage()` only copies translation (e,f)
  from the transform matrix, discarding rotation and scale. ShadowRenderer
  was fixed to properly decompose transforms but this was never ported.
  Rotated custom shapes render shadows at wrong angle.
- **Recommended Fix:** Port ShadowRenderer's rotation decomposition.
- **Status:** Open
- **Introduced:** v42 review

### P2-076: ThumbnailRenderer TextBox Stroke Bleeds Into Text

- **File:** `src/ThumbnailRenderer.php` (buildTextBoxArguments)
- **Impact:** After drawing rectangle with `-stroke`, the text annotate
  inherits stroke settings. Text renders with rectangle's stroke outline.
- **Recommended Fix:** Insert `'-stroke', 'none', '-strokewidth', '0'`
  before text `-annotate`.
- **Status:** Open
- **Introduced:** v42 review

### P2-077: ThumbnailRenderer Missing Ellipse Shadow Support

- **File:** `src/ThumbnailRenderer.php` (buildEllipseArguments)
- **Impact:** Ellipse is the only shape handler without shadow rendering.
  All others (rectangle, circle, text, textbox, polygon, star) support
  shadows. Inconsistent server-side rendering.
- **Recommended Fix:** Add standard shadow pattern from buildCircleArguments().
- **Status:** Open
- **Introduced:** v42 review

### P2-078: AlignmentController Missing Dimension/Marker Types

- **File:** `resources/ext.layers.editor/canvas/AlignmentController.js`
- **Impact:** `moveLayer()` has no case for dimension layers (x1/y1/x2/y2
  endpoints) or marker arrow layers. Dimension layers fall through to
  default case which moves `layer.x` — but dimensions use x1/y1/x2/y2.
  Alignment operations produce incorrect results for these 2 layer types.
- **Note:** Previously dismissed as false positive in v29. Reclassified
  as real issue — dimension layers DO use x1/y1/x2/y2, not x/y.
- **Status:** Open
- **Introduced:** v42 review (reclassified from v29 FP)

### P2-079: ClipboardController Paste Offset on Local Coordinates

- **File:** `resources/ext.layers.editor/canvas/ClipboardController.js` L253-257
- **Impact:** `applyPasteOffset()` adds PASTE_OFFSET (20px) to tailTipX
  and tailTipY. These are center-relative local coordinates. World-space
  offset is already applied via layer.x/y. Pasted callouts have tails
  displaced 20px from their intended position.
- **Recommended Fix:** Remove tailTipX/tailTipY from paste offset.
- **Status:** Open
- **Introduced:** v42 review

### P2-080: parseMWTimestamp Uses Local Time Instead of UTC

- **File:** `resources/ext.layers.editor/LayerSetManager.js` L119-138
- **Impact:** MediaWiki timestamps are UTC but `new Date(year, month, ...)`
  creates local-time Date. Revision timestamps display with timezone offset
  error for all non-UTC users.
- **Recommended Fix:** Use `new Date(Date.UTC(year, month, ...))`.
- **Status:** Open
- **Introduced:** v42 review

### P2-081: CalloutRenderer Blur Bounds Ignore Dragged Tail

- **File:** `resources/ext.layers.shared/CalloutRenderer.js`
- **Impact:** When callout has `fill='blur'` and uses draggable tail,
  blur capture bounds use `tailDirection` instead of actual tailTipX/Y.
  Blur effect clips when tail is dragged to different side.
- **Recommended Fix:** Compute bounds from actual tip coordinates.
- **Status:** Open
- **Introduced:** v42 review

### P2-082: CSS Font Shorthand Order Wrong in InlineTextEditor

- **File:** `resources/ext.layers.editor/canvas/InlineTextEditor.js` L815-819
- **Impact:** Canvas font string has fontWeight before fontStyle. CSS spec
  requires font-style before font-weight. May cause incorrect text
  measurement in strict canvas engines.
- **Recommended Fix:** Swap fontStyle and fontWeight order.
- **Status:** Open
- **Introduced:** v42 review

### P2-083: Hardcoded English in ToolbarKeyboard.js

- **File:** `resources/ext.layers.editor/ToolbarKeyboard.js`
- **Impact:** User-visible strings ("Layers grouped", "Smart Guides: On/Off")
  are hardcoded English instead of mw.message() i18n keys. Breaks
  internationalization for non-English wikis.
- **Status:** Open (supersedes P3-076)
- **Introduced:** v42 review

### P3-080: ~140 Lines Dead Layer Cache Code in CanvasRenderer

- **File:** `resources/ext.layers.editor/CanvasRenderer.js`
- **Impact:** layerCache, _getCachedLayer, _setCachedLayer,
  invalidateLayerCache defined but never called. Dead code.
- **Status:** Open
- **Introduced:** v42 review

### P3-081: StyleController.updateStyleOptions Triple-Applies Properties

- **File:** `resources/ext.layers.editor/StyleController.js` L85-144
- **Impact:** Three redundant passes over style properties. Low perf impact.
- **Status:** Open
- **Introduced:** v42 review

### P3-082: Duplicate sanitizeLogMessage in 3 Files

- **Files:** `LayersEditor.js`, `APIErrorHandler.js`, `ValidationManager.js`
- **Impact:** Identical function duplicated. Bug fixes must be applied 3x.
- **Recommended Fix:** Extract to shared utility.
- **Status:** Open
- **Introduced:** v42 review

### P3-083: SelectionManager Boolean Handling Inconsistency

- **File:** `resources/ext.layers.editor/SelectionManager.js`
- **Impact:** `selectAll()` correctly checks `!== 0` but `selectLayer()`
  fallback only checks `!== true` / `!== false`, missing integer API values.
- **Status:** Open
- **Introduced:** v42 review

### P3-084: DimensionRenderer Uses || for Falsy-Sensitive Defaults

- **File:** `resources/ext.layers.shared/DimensionRenderer.js`
- **Impact:** `extensionGap: opts.extensionGap || 10` rejects valid 0.
  Same file uses `!== undefined` for precision/toleranceValue correctly.
- **Status:** Open
- **Introduced:** v42 review

### P3-085: CustomShapeRenderer Opacity Not Clamped

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** getOpacity() returns unclamped value. All other renderers
  use clampOpacity() from MathUtils.
- **Status:** Open
- **Introduced:** v42 review

### P3-086: ExportController Blob URL Leak on Error

- **File:** `resources/ext.layers.editor/ExportController.js`
- **Impact:** If removeChild throws, revokeObjectURL is skipped. Minor leak.
- **Status:** Open
- **Introduced:** v42 review

### P3-087: RenderCoordinator Hash Misses Visual Properties

- **File:** `resources/ext.layers.editor/canvas/RenderCoordinator.js`
- **Impact:** Hash omits radiusX/Y, controlX/Y, tailTipX/Y, cornerRadius,
  lineHeight, color, arrowhead/style/size, gradient stops, shadow offsets.
  Changes to these may not trigger re-renders. Supersedes P3-072.
- **Status:** Open
- **Introduced:** v42 review

### P3-088: Escape Closes Modal Without Unsaved Changes Check

- **File:** `resources/ext.layers.modal/LayersEditorModal.js`
- **Impact:** Pressing Escape immediately closes modal without checking
  for unsaved changes via postMessage.
- **Status:** Open
- **Introduced:** v42 review

### P3-089: Duplicated SVG Icon Code in ViewerManager/SlideController

- **Files:** `ViewerManager.js`, `SlideController.js`
- **Impact:** Identical _createPencilIcon() and _createExpandIcon() methods.
  Should use IconFactory.js.
- **Status:** Open
- **Introduced:** v42 review

### P3-090: Dead Code renderCodeSnippet with XSS Vector

- **File:** `resources/ext.layers.editor/LayerPanel.js` L2161
- **Impact:** Never called but contains unescaped filename in innerHTML.
  Remove or fix before any caller is added.
- **Status:** Open
- **Introduced:** v42 review

### P3-091: RichTextToolbar Potential Drag Listener Leak

- **File:** `resources/ext.layers.editor/canvas/RichTextToolbar.js`
- **Impact:** Document-level mouse handlers during drag not cleaned in
  destroy() if destroyed mid-drag.
- **Status:** Open
- **Introduced:** v42 review

### P3-092: Touch Events Missing Key Modifier Properties

- **File:** `resources/ext.layers.editor/CanvasEvents.js` L600-614
- **Impact:** Synthetic mouse events from touch lack ctrlKey, metaKey,
  shiftKey. Multi-select via touch impossible.
- **Status:** Open
- **Introduced:** v42 review

### P3-093: SlideController.refreshAllSlides No Concurrency Limit

- **File:** `resources/ext.layers.slides/SlideController.js`
- **Impact:** Uses bare Promise.all(). ViewerManager has proper concurrency
  limiting (5 parallel via _processWithConcurrency).
- **Status:** Open
- **Introduced:** v42 review

### P3-094: CustomShapeRenderer Creates Oversized Temp Canvas

- **File:** `resources/ext.layers.shared/CustomShapeRenderer.js`
- **Impact:** Creates new canvas 5000+ px wider than needed per call,
  no reuse or size limit. GC pressure.
- **Status:** Open
- **Introduced:** v42 review

### P3-095: Unguarded mw.log.warn in CanvasRenderer

- **File:** `resources/ext.layers.editor/CanvasRenderer.js`
- **Impact:** Uses `mw.log.warn()` without typeof guard. ReferenceError
  in Jest test environment.
- **Status:** Open
- **Introduced:** v42 review

### P3-096: ToolManager Module References at IIFE Load Time

- **File:** `resources/ext.layers.editor/ToolManager.js`
- **Impact:** Window references resolved at IIFE execution. If module
  loads before dependencies, references are undefined.
- **Status:** Open
- **Introduced:** v42 review

---

## Newly Confirmed in v40 (Verification Pass)

### ✅ P2-064: `scripts/verify-docs.sh` Exits Early Under `set -e` (Fixed v40)

- **File:** `scripts/verify-docs.sh`
- **Impact:** Documentation verification can stop after the first failure,
  producing incomplete results.
- **Evidence:** `bash scripts/verify-docs.sh` exits with code 1 immediately
  after the first check.
- **Root Cause:** `check_file ... || ((ERRORS++))` interacts badly with
  `set -e`; arithmetic command status can be non-zero.
- **Introduced:** v40 review
- **Resolution:** Replaced `((ERRORS++))` pattern with safe increment function,
  removed `package.json` version check, and aligned to the 11-file rule.

### ✅ P2-065: Documentation Rule Mismatch (`11 files` vs `12 files`) (Fixed v40)

- **Files:** `docs/DOCUMENTATION_UPDATE_GUIDE.md`, `scripts/verify-docs.sh`,
  `package.json`
- **Impact:** Release tooling and documentation disagree; false failure for
  `package.json` version checks even though this project has no version field.
- **Evidence:** Guide states package.json has no version and uses an 11-file
  rule; script enforces 12 files and checks `package.json` for `1.5.57`.
- **Introduced:** v40 review
- **Resolution:** `scripts/verify-docs.sh` now checks the same 11 files defined
  in `docs/DOCUMENTATION_UPDATE_GUIDE.md`, including `.github/copilot-instructions.md`.

### P3-064: `codebase_review.md` Contains a Stale False-Positive Claim

- **File:** `codebase_review.md`
- **Impact:** Misleads maintainers about CI/test behavior.
- **Evidence:** Prior claim said "npm test skips Jest"; actual script is
  `grunt test && jest --passWithNoTests`.
- **Status:** ✅ Corrected in v40 addendum.

### P3-065: `improvement_plan.md` Has Resolved Items Marked Open

- **File:** `improvement_plan.md`
- **Impact:** Planning data is inaccurate and inflates outstanding docs debt.
- **Evidence:** Claims like "wiki/Installation.md says 1.5.52" and missing
  v1.5.53/v1.5.54 changelog entries are stale relative to current docs.
- **Status:** ✅ Corrected in v40 addendum.

### ✅ P3-066: Import Fallback Render Path (Fixed v40)

- **File:** `resources/ext.layers.editor/ImportExportManager.js`
- **Impact:** In fallback mode, import can apply layers but render nothing.
- **Evidence:** `applyImportedLayers()` sets `editor.layers = layers` when
  `stateManager` is absent, then computes `currentLayers` as `[]` before render.
- **Introduced:** v40 review
- **Resolution:** `applyImportedLayers()` now renders `editor.layers` when
  `stateManager` is absent. Added regression test in
  `tests/jest/ImportExportManager.test.js`.

---

## Newly Confirmed in v41

### ✅ P1-032: Rate Limiter `$defaultLimits` Dead Code (Fixed v41)

- **File:** `src/Security/RateLimiter.php`
- **Impact:** The 90-line `$defaultLimits` array was never used — rate limits
  must be configured in `$wgRateLimits` in LocalSettings.php.
- **Resolution:** Removed dead code (~68 lines), added clear documentation
  in class docblock with example `$wgRateLimits` configuration.
- **Introduced:** v41 review

### ⚠️ P1-033: Missing Cache Invalidation After Delete/Rename — NOT FIXED (Reopened v42 → P0-005)

- **Files:** `src/Api/ApiLayersDelete.php`, `src/Api/ApiLayersRename.php`,
  `src/Api/Traits/CacheInvalidationTrait.php` (MISSING)
- **Impact:** v41 claimed this was fixed by extracting cache invalidation
  to a shared trait. The trait file was **never created or committed**.
  All 3 write API modules (Save, Delete, Rename) now `use` the
  nonexistent trait, causing PHP fatal errors on ALL write operations.
- **Status:** ⚠️ REOPENED as P0-005 — escalated from P1 to P0.
  See P0-005 above for full details.
- **Introduced:** v41 review (falsely marked fixed)

### ✅ P1-034: Rich Text Per-Run `fontSize` Not Scaled in Viewer (Fixed v41)

- **File:** `resources/ext.layers/LayersViewer.js`
- **Impact:** RichText layers with mixed font sizes rendered incorrectly at zoom != 1.
- **Resolution:** Added loop in `scaleLayerCoordinates()` to scale per-run
  `fontSize` in richText array. Added regression test.
- **Introduced:** v41 review

### P2-067: SQL Schema Inconsistencies Between Base and Patch Files ✅ FIXED

- **Files:** `sql/layers_tables.sql`, `sql/tables/layer_assets.sql`,
  `sql/patches/patch-add-lsu_usage_count.sql`
- **Impact:** `la_user_id`: base schema says `DEFAULT NULL`, but
  `tables/layer_assets.sql` said `NOT NULL`. `lsu_usage_count`:
  base table says `DEFAULT 1`, but patch file said `DEFAULT 0`.
  Fresh installs vs. upgraded installs got different schemas.
- **Evidence:** `grep -n "la_user_id\|lsu_usage_count"` across SQL
  files showed contradictions.
- **Status:** Fixed — Reconciled `layer_assets.sql` to use `DEFAULT NULL` for
  `la_user_id` (matching main schema), and updated patch file to use `DEFAULT 1`.
- **Introduced:** v41 review

### P2-068: ApiLayersList Missing Permission Check for Slide Requests ✅ FIXED

- **File:** `src/Api/ApiLayersList.php`
- **Impact:** The list API intended for the Special:Slides page does
  not verify that the requesting user has appropriate read permissions
  for the listed files. Relies solely on MediaWiki's default API
  auth, which may not enforce file-level access on private wikis.
- **Status:** Fixed — Already had `checkUserRightsAny('read')` call at line 64.
  Verified via v41 review.
- **Introduced:** v41 review

### P2-069: ApiLayersList Missing Top-Level Exception Handler ✅ FIXED

- **File:** `src/Api/ApiLayersList.php`
- **Impact:** Unlike `ApiLayersInfo`, `ApiLayersSave`, `ApiLayersDelete`,
  and `ApiLayersRename` which all wrap their `execute()` body in
  try/catch, `ApiLayersList::execute()` has no top-level exception
  handler. An unexpected DB or runtime error produces an unformatted
  MediaWiki error instead of a structured API error.
- **Status:** Fixed (low priority) — DB query is already wrapped in try/catch.
  Verified existing handler at `doListSlides()` method.
- **Introduced:** v41 review

### P2-070: Missing Numeric Constraints for Text Effect Properties ✅ FIXED

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `textStrokeWidth`, `shadowBlur`, `shadowOffsetX`,
  `shadowOffsetY`, and `shadowSpread` were validated as numeric
  types but had no upper/lower bounds. Extreme values could cause
  rendering performance issues or layout breakage.
- **Status:** Fixed — Added numeric constraints: `textStrokeWidth` (0-50),
  `shadowBlur` (0-100), `shadowOffsetX/Y` (-500 to 500), `shadowSpread` (0-100).
- **Introduced:** v41 review

### P2-071: SVG Validation Missing Dangerous Elements ✅ FIXED

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** SVG sanitization stripped `<script>`, `<foreignObject>`,
  and event handlers but did not filter `<embed>`, `<object>`,
  `<iframe>`, or `<applet>` elements, which can also execute
  arbitrary code or load external resources in SVG contexts.
- **Status:** Fixed — Added blocklist for `embed`, `object`, `iframe`, and
  `applet` elements in `validateSvgString()` method.
- **Introduced:** v41 review

### P2-072: SlideHooks Static State Not Reset Between Pages ✅ FIXED

- **File:** `src/Hooks/SlideHooks.php`
- **Impact:** `SlideHooks` uses static properties to track state
  across hook invocations. If MediaWiki processes multiple pages
  in a single request (e.g., job queue, API batch), state from
  the first page leaks into subsequent pages.
- **Status:** Fixed — Added `onParserClearState()` hook handler to reset
  `$slideDimensionCache` and `$slideQueryCount`. Registered in extension.json.
- **Introduced:** v41 review

### P2-073: Debug URL Parameter Cannot Disable Debug Mode ✅ FIXED

- **File:** `src/Hooks/UIHooks.php`
- **Impact:** The `?layersdebug=1` URL parameter enables debug
  mode, but there was no way to explicitly disable it via URL
  when the global config had debug enabled. Minor operational
  inconvenience.
- **Status:** Fixed — Refactored logic to properly handle `?layersdebug=0`
  to disable debug mode even when config has it enabled.
- **Introduced:** v41 review

### P3-067: ~200 Lines Duplicated Validation Logic in ApiLayersSave.php

- **File:** `src/Api/ApiLayersSave.php`
- **Impact:** Client-facing validation logic (property checks,
  bounds enforcement) is partially duplicated between
  `ApiLayersSave` and `ServerSideLayerValidator`. Changes to
  validation rules must be synchronized across both files.
- **Status:** Open
- **Introduced:** v41 review

### P3-068: ToolbarStyleControls.js Crossed God Class Threshold (1,006 Lines)

- **File:** `resources/ext.layers.editor/ui/ToolbarStyleControls.js`
- **Impact:** At 1,006 lines, this file now exceeds the 1,000-line
  god class threshold (god class #17). Further extractions like
  `PresetStyleManager.js` and `ArrowStyleControl.js` already exist
  but the core file has grown back.
- **Status:** Open
- **Introduced:** v41 review

### P3-069: `drawRoundedRectPath()` Duplicated in Three Files

- **Files:** `CanvasRenderer.js`, `SelectionRenderer.js`,
  `InlineTextEditor.js`
- **Impact:** Identical rounded-rectangle path logic duplicated
  across three canvas rendering files. Bug fixes must be
  applied to all three copies.
- **Status:** Open
- **Introduced:** v41 review

### P3-070: `duplicateSelected()` Duplicated in Two Files

- **Files:** `CanvasManager.js`, `ClipboardController.js`
- **Impact:** Layer duplication logic exists in both files.
  Behavioral drift is possible if only one is updated.
- **Status:** Open
- **Introduced:** v41 review

### P3-071: GradientRenderer Namespace Registration Inconsistency

- **File:** `resources/ext.layers.shared/GradientRenderer.js`
- **Impact:** Registered under `mw.ext.layers.GradientRenderer`
  (shared namespace) but instantiated differently in editor vs.
  viewer contexts. Minor inconsistency in module loading.
- **Status:** Open
- **Introduced:** v41 review

### P3-072: RenderCoordinator Hash Misses Deep Object Changes

- **File:** `resources/ext.layers.editor/canvas/RenderCoordinator.js`
- **Impact:** `_computeLayersHash()` hashes selected top-level
  properties but does not deep-hash `gradient` or `richText`
  sub-objects. Changes to gradient stops or richText runs may
  not trigger re-renders.
- **Status:** Open
- **Introduced:** v41 review

### P3-073: Inconsistent Service Resolution Pattern

- **Files:** Various PHP `src/` files
- **Impact:** Some files use `MediaWikiServices::getInstance()` to
  get services directly; others use the DI `services.php` wiring.
  Inconsistent but functional.
- **Status:** Open
- **Introduced:** v41 review

### P3-074: Response Format Inconsistency Across API Modules

- **Files:** `src/Api/ApiLayersSave.php`, `src/Api/ApiLayersDelete.php`,
  `src/Api/ApiLayersRename.php`
- **Impact:** Save returns `{ success: 1, result: 'Success' }`,
  Delete returns `{ success: 1, revisionsDeleted: N }`, Rename
  returns `{ success: 1, oldname, newname }`. No consistent
  success envelope. Clients must handle each shape individually.
- **Status:** Open
- **Introduced:** v41 review

### P3-075: Missing CommonJS Export in LayerDefaults.js

- **File:** `resources/ext.layers.shared/LayerDefaults.js`
- **Impact:** No `module.exports` fallback for Jest test
  environments. Tests must mock or re-create the defaults
  object rather than importing it directly.
- **Status:** Open
- **Introduced:** v41 review

### P3-076: Hard-Coded English Strings in UI Components

- **Files:** Various `resources/ext.layers.editor/` files
- **Impact:** Some status messages, tooltips, or error strings
  are hard-coded in English rather than using `mw.message()`
  i18n keys. Minor i18n gap.
- **Status:** Open
- **Introduced:** v41 review

### P3-077: Font Size Validation Type Check Gap

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `fontSize` is validated as numeric and range-checked,
  but string values like `"12px"` or `"1em"` pass the initial
  type filter and may cause unexpected behavior downstream.
- **Status:** Open
- **Introduced:** v41 review

### P3-078: `getNamedSetOwner()` Reads from Replica DB

- **File:** `src/Database/LayersDatabase.php`
- **Impact:** `getNamedSetOwner()` uses `getReadDb()` (replica)
  to determine ownership for delete/rename authorization. Under
  replication lag, a just-created set might not be found,
  causing a false permission denial.
- **Status:** Open
- **Introduced:** v41 review

### P3-079: ValidationResult Mixed Error Structure

- **File:** `src/Validation/ServerSideLayerValidator.php`
- **Impact:** `ValidationResult` sometimes contains flat error
  strings and sometimes structured objects with `field` and
  `message` properties. Consumers must handle both formats.
- **Status:** Open
- **Introduced:** v41 review

---

## P0 — Critical (Data Loss / Security)

### P0-005: CacheInvalidationTrait.php Missing (Open — v42)

See "Newly Confirmed in v42" section above for full details.

### ✅ P0-001: groupSelected() Passes Object Instead of ID (Fixed v28)

- **File:** GroupManager.js
- **Impact:** Group creation could fail silently
- **Resolution:** Fixed with unit tests

### ✅ P0-002: ApiLayersDelete Swallows ApiUsageException (Fixed v27)

- **File:** ApiLayersDelete.php
- **Impact:** Delete errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-003: ApiLayersRename Exception Swallowing (Fixed v27)

- **File:** ApiLayersRename.php
- **Impact:** Rename errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-004: diagnose.php Unauthenticated Endpoint (Fixed v27)

- **File:** diagnose.php (removed)
- **Impact:** Exposed internal state without authentication
- **Resolution:** File removed entirely

---

## P1 — High Priority

### ✅ P1-026: ClipboardController paste() Bypasses StateManager (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/ClipboardController.js
- **Resolution:** Rewrote paste() to build a new layers array and
  set via `editor.stateManager.set('layers', newLayers)`, consistent
  with cutSelected(). Fallback to direct assignment if no StateManager.

### ✅ P1-027: RenderCoordinator Hash Omits Rendering Properties (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/RenderCoordinator.js
- **Resolution:** Expanded `_computeLayersHash()` from 8 to 30+
  properties including fill, stroke, text, fontSize, fontFamily,
  strokeWidth, shadow, gradient, src, richText, points, locked, name,
  blendMode, radius, endpoints, and more.

### ✅ P1-028: SecurityAndRobustness.test.js Tests Mocks Not Code (Fixed v36)

- **File:** tests/jest/SecurityAndRobustness.test.js (DELETED)
- **Resolution:** File deleted entirely (490 lines, 18 tests, zero
  require() calls). Existing focused test suites already provide
  real coverage of the same code.

### ✅ P1-029: PHPUnit Version Mismatch (Fixed v36)

- **File:** phpunit.xml, tests/phpunit/unit/HooksTest.php
- **Resolution:** Downgraded phpunit.xml schema from 10.5 to 9.6.
  Removed PHPUnit 10-only attributes. Replaced withConsecutive()
  in HooksTest.php with willReturnCallback() + assertContains().

### ✅ P1-030: npm test --force Bypasses Lint Failures (Fixed v36)

- **File:** package.json, Gruntfile.js
- **Resolution:** Removed `--force` from npm test script. Fixed
  Gruntfile.js ESLint glob to exclude patterns matching .eslintrc.json
  ignorePatterns (scripts/**, TempToolIcons/**, etc.). Grunt now passes
  cleanly without --force.

### ✅ P1-031: ErrorHandler Auto-Reload Loses Unsaved Work (Fixed v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Added `_saveDraftBeforeReload()` method that saves
  draft via `window.layersEditorInstance.draftManager.saveDraft()`
  before reload. Best-effort with try/catch.

### ✅ P1-001: Canvas Cache Stale on Middle Path Points (Fixed v28)

- **File:** CanvasManager.js
- **Resolution:** Cache invalidation on path changes

### ✅ P1-002: VALID_LINK_VALUES Drops Editor Subtypes (Fixed v28)

- **File:** LayerDataNormalizer.js
- **Resolution:** Extended valid link values

### ✅ P1-003: TextRenderer Rotation Ignores textAlign (Fixed v28)

- **File:** TextRenderer.js
- **Resolution:** Rotation center accounts for alignment

### ✅ P1-004: SVG CSS Injection Vectors Missing (Fixed v28)

- **File:** LayersValidator.js
- **Resolution:** Added CSS injection detection

### ✅ P1-005: HitTest Fails on Rotated Rectangles/Ellipses (Fixed v29)

- **File:** HitTestController.js
- **Resolution:** Proper inverse rotation transform

### ✅ P1-006: ShapeRenderer strokeWidth:0 Treated as 1 (Fixed v29)

- **File:** ShapeRenderer.js
- **Resolution:** Respect zero strokeWidth

### ✅ P1-007: getRawCoordinates() Incorrect Math (Fixed v29)

- **File:** CanvasManager.js
- **Resolution:** Correct coordinate transformation

### ✅ P1-008: normalizeLayers Mutates Input Objects (Fixed v29)

- **File:** LayerDataNormalizer.js
- **Resolution:** Deep clone before normalization

### ✅ P1-009: isSchemaReady 23 Uncached DB Queries (Fixed v27)

- **File:** LayersSchemaManager.php
- **Resolution:** Cached schema readiness check

### ✅ P1-010: duplicateSelected Single-Layer Only (Fixed v27)

- **File:** ClipboardController.js
- **Resolution:** Multi-layer duplication support

### ✅ P1-011: ON DELETE CASCADE Destroys User Content (Fixed v34)

- **File:** sql/layers_tables.sql
- **Resolution:** Changed to ON DELETE SET NULL; migration patch

### ✅ P1-012: ls_name Allows NULL in Schema (Fixed v34)

- **File:** sql/layers_tables.sql
- **Resolution:** NOT NULL DEFAULT 'default'; migration patch

### ✅ P1-013: Triple Source of Truth for Selection State (Fixed v34)

- **File:** SelectionManager.js, CanvasManager.js, StateManager.js
- **Resolution:** Removed ghost properties; single authority

### ✅ P1-014: Rich Text Word Wrap Wrong Font Metrics (Fixed v34)

- **File:** TextBoxRenderer.js
- **Resolution:** Per-run font measurement in wrapRichText()

### ✅ P1-015: ThumbnailRenderer Shadow Blur Corrupts Canvas (Fixed v34)

- **File:** ThumbnailRenderer.php
- **Resolution:** buildShadowSubImage() helper

### ✅ P1-016: SQLite-Incompatible Schema Migrations (Fixed v34)

- **File:** LayersSchemaManager.php, sql/patches/
- **Resolution:** PHP methods with $dbType branching

### ✅ P1-017: ShadowRenderer Discards Scale on Rotation (Fixed v34)

- **File:** ShadowRenderer.js L305-325
- **Resolution:** Decompose and preserve scale matrix

### ✅ P1-018: DimensionRenderer hitTest Ignores Offset (Fixed v34)

- **File:** DimensionRenderer.js L750-761
- **Resolution:** hitTest uses perpendicular offset

### ✅ P1-019: APIManager saveInProgress Permanently Stuck (Fixed v34)

- **File:** APIManager.js L859-870
- **Resolution:** try/catch with reset on error

### ✅ P1-020: PresetStorage Strips Gradient Data (Fixed v34)

- **File:** PresetStorage.js L20-56
- **Resolution:** Added 'gradient' to ALLOWED_STYLE_PROPERTIES

### ✅ P1-021: OverflowException Double endAtomic (Fixed v35)

- **File:** LayersDatabase.php L174-245
- **Resolution:** Removed premature endAtomic; re-throw in catch

### ✅ P1-022: TextSanitizer html_entity_decode (Fixed v35)

- **File:** TextSanitizer.php L35-45
- **Resolution:** Second strip_tags() after html_entity_decode()

### ✅ P1-023: EditLayersAction Clickjacking — Not a Bug (v35)

- **File:** EditLayersAction.php L107-119
- **Resolution:** Reclassified as intentional modal editor design

### ✅ P1-024: ApiLayersList DB Error Info Disclosure (Fixed v35)

- **File:** ApiLayersList.php L106-109
- **Resolution:** Generic error; server-side logging

### ✅ P1-025: RichText fontSize Overwritten on Deselect (Fixed v35)

- **File:** InlineTextEditor.js L276-280, L1686-1733
- **Resolution:** _extractDominantFontSize() accepts baseFontSize

---

## P2 — Medium Priority

### ✅ P2-032: ErrorHandler Singleton Lifecycle — False Positive (v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Not a bug. Singleton is re-created on module load
  via `if (!window.layersErrorHandler) { ... }`. destroy() only runs
  when editor closes (page unload). Subsequent editor sessions get
  a new instance automatically.

### ✅ P2-033: InlineTextEditor Blur setTimeout Tracked (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Assigned setTimeout return value to `this._blurTimeout`.
  Added `clearTimeout(this._blurTimeout)` in `_removeEventHandlers()`.

### ✅ P2-034: No Default Rate Limits — Not a Bug (v36)

- **Resolution:** Rate limiting is intentionally admin-configurable
  via LocalSettings.php. Not all wikis need the same limits.
  RateLimiter.php infrastructure exists and works when configured.

### ✅ P2-035: CanvasManager JSON Clone Per Frame — Overstated (v36)

- **Resolution:** The JSON clone runs inside rAF but is gated by
  `transformEventScheduled` flag, so it runs at most once per
  animation frame. Not per-event. Acceptable performance.

### ✅ P2-036: HistoryManager JSON.stringify for richText — Low Impact (v36)

- **Resolution:** Only runs on `hasUnsavedChanges()` checks, not
  per-frame. Called infrequently (tab close, periodic save check).
  Not a performance concern.

### ✅ P2-037: ext.layers.slides Added to Jest Coverage (Fixed v36)

- **File:** jest.config.js
- **Resolution:** Added `'resources/ext.layers.slides/**/*.js'` to
  collectCoverageFrom array.

### ✅ P2-038: NAMED_LAYER_SETS.md Stale Throughout (Fixed v39)

- **File:** docs/NAMED_LAYER_SETS.md
- **Impact:** Uses "Proposed Design" header for implemented feature.
  Shows `ls_name VARCHAR(255), DEFAULT NULL` (actual: NOT NULL
  DEFAULT 'default'). References nonexistent config keys
  `$wgLayersSetNameMaxLength` and `$wgLayersSetNamePattern`.
  Says "10-20 named sets" (actual limit: 15).
- **Introduced:** v36 review
- **Recommended Fix:** Major rewrite to document actual
  implementation, correct schema, and real config keys.
- **Resolution:** Rewrote document: corrected schema to actual
  NOT NULL DEFAULT 'default', removed nonexistent config keys,
  added SetNameSanitizer validation details, replaced Option A/B
  with actual implementation, updated set count to 15, marked
  deletion/renaming as implemented, changed header to Architecture.

### ✅ P2-039: Missing SlideNameValidator in API Modules (Fixed v39)

- **Files:** src/Api/ApiLayersInfo.php, src/Api/ApiLayersRename.php
- **Resolution:** SlideNameValidator added to ApiLayersInfo L104-117
  and ApiLayersRename L63-75. All 4 API modules now consistently
  validate slide names.

### ✅ P2-040: ApiLayersRename Missing oldName Validation in Slide Path (Fixed v39)

- **File:** src/Api/ApiLayersRename.php
- **Resolution:** executeSlideRename() L290-295 now validates oldName
  with SetNameSanitizer::isValid(), matching the file rename path.

### ✅ P2-041: TransformController Missing _arrowTipRafId Cleanup (Fixed v39)

- **File:** resources/ext.layers.editor/canvas/TransformController.js
- **Resolution:** destroy() at L948-950 now cancels _arrowTipRafId
  alongside the other 3 RAF IDs.

### ✅ P2-042: wiki/Configuration-Reference.md LayersDebug Default (Fixed v39)

- **File:** wiki/Configuration-Reference.md
- **Fix:** Already shows correct default of `false`.

### ✅ P2-043: wiki/Installation.md LayersDebug Default (Fixed v39)

- **File:** wiki/Installation.md
- **Fix:** Already shows correct default of `false`.

### ✅ P2-001: Negative Dimensions for Rectangle/TextBox (Fixed v28)

### ✅ P2-002: DraftManager Stores Base64 Image Data (Fixed v28)

### ✅ P2-003: CalloutRenderer Blur Clips L/R Tails (Fixed v31)

### ✅ P2-004: closeAllDialogs Leaks Keydown Handlers (Fixed v30)

### ✅ P2-005: ext.layers Loaded Every Page (Fixed v34)

### ✅ P2-006: SlideManager.js Dead Code (~439 Lines) (Fixed v34)

### ✅ P2-007: Client SVG Sanitization Regex Bypassable (Fixed v34)

### ✅ P2-008: sanitizeString Strips `<>` Destroying Math (Fixed v34)

### ✅ P2-009: SmartGuides Cache Stale on Mutations (Fixed v34)

### ✅ P2-010: ToolManager 400+ Lines Dead Fallbacks (Fixed v34)

### ✅ P2-011: HistoryManager Duck-Type Constructor (Fixed v34)

### ✅ P2-012: Duplicate Prompt Dialog Implementations (Fixed v34)

### ✅ P2-013: enrichWithUserNames Duplicated (Fixed v34)

### ✅ P2-014: Toolbar innerHTML with mw.message().text() (Fixed v34)

### ✅ P2-015: init.js Event Listener Accumulation (Fixed v34)

### ✅ P2-016: ImageLoader Timeout Orphaned on Success (Fixed v34)

### ✅ P2-017: window.open Without noopener (Fixed v34)

### ✅ P2-018: ShadowRenderer/EffectsRenderer Temp Canvas (Fixed v34)

### ✅ P2-019: TextBoxRenderer wrapText No Long Word Break (Fixed v34)

### ✅ P2-020: ApiLayersSave Redundant Token Parameter (Fixed v34)

### ✅ P2-021: LayersSchemaManager Bypasses DI (Fixed v34)

### ✅ P2-022: Foreign Key Constraints Violate MW Conventions (Fixed v34)

### ✅ P2-023: SpecialEditSlide References Non-Existent Module (Fixed v34)

### ✅ P2-024: ext.layers.slides Missing Required Files (Fixed v34)

### ✅ P2-025: Duplicate Message Keys in extension.json (Fixed v34)

### ✅ P2-026: phpunit.xml Uses Deprecated PHPUnit 9 Attributes (Fixed v34)

### ✅ P2-027: ThumbnailRenderer visible === false Ignores 0 (Fixed v35)

### ✅ P2-028: $set Param Ignored in layerEditParserFunction (Fixed v35)

### ✅ P2-029: RevisionManager UTC Timestamps as Local (Fixed v35)

### ✅ P2-030: EditorBootstrap Conditional Global — Not a Bug (v35)

### ✅ P2-031: CanvasRenderer _blurTempCanvas Not Cleaned (Fixed v35)

---

## P3 — Low Priority

### ✅ P3-042: console.log in Toolbar.js Removed (Fixed v36)

- **File:** resources/ext.layers.editor/Toolbar.js
- **Resolution:** Removed unguarded `console.log('[Layers] Help
  button clicked')` statement.

### ✅ P3-043: ValidationManager IIFE Wrapping (Fixed v39)

- **File:** resources/ext.layers.editor/ValidationManager.js
- **Fix:** Wrapped class in IIFE for scope isolation consistency.

### ✅ P3-044: AlignmentController getCombinedBounds Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/AlignmentController.js
- **Resolution:** Computed actual `width: right - left` and
  `height: bottom - top` instead of hardcoded zeros.

### ✅ P3-045: HistoryManager cancelBatch Double Redraw Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/HistoryManager.js
- **Resolution:** Removed redundant `redraw()` call after
  `renderLayers()` which already calls redraw() internally.

### ✅ P3-046: InlineTextEditor Optional Chaining Removed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Replaced `?.` operator with explicit null checks
  for backward compatibility.

### ✅ P3-047: ViewerManager DOM Properties — False Positive (v36)

- **File:** resources/ext.layers/viewer/ViewerManager.js
- **Resolution:** Not a bug. `img.layersViewer` is properly nulled
  in cleanup code at lines 235 and 331. No GC leak.

### ✅ P3-048: ts-jest Removed (Fixed v36)

- **File:** package.json
- **Resolution:** Removed unused ts-jest dependency from
  devDependencies.

### ✅ P3-049: Gruntfile ESLint Cache Enabled (Fixed v36)

- **File:** Gruntfile.js
- **Resolution:** Changed `cache: false` to `cache: true`.

### ✅ P3-050: Test Files Not Linted by Grunt (Resolved)

- **File:** Gruntfile.js
- **Fix:** Removed `!tests/jest/**` exclusion from Gruntfile.js. Updated
  `.eslintrc.json` test override: ecmaVersion 2020→2022, added `OO` global,
  `no-unused-vars`/`no-redeclare` set to warn (test-specific patterns).
  129 warnings, 0 errors. All 11,122 tests still pass.

### ✅ P3-051: PHP Tests Use Only Existence Assertions (Fixed v40)

- **File:** tests/phpunit/unit/Api/ApiLayersSaveTest.php
- **Fix:** Replaced existence-only assertions with behavior-based API
  contract tests:
  - `testWriteModeSecurityContract()` validates CSRF token requirement,
    write mode, and POST enforcement.
  - `testGetAllowedParamsContract()` validates required/optional API
    parameter definitions and types.
- **Introduced:** v36 review

### ✅ P3-052: SchemaManager CURRENT_VERSION Updated (Fixed v36)

- **File:** src/Database/LayersSchemaManager.php
- **Resolution:** Updated CURRENT_VERSION from '1.5.56' to '1.5.57'.

### ✅ P3-053: RichTextConverter innerHTML Replaced (Fixed v39)

- **File:** resources/ext.layers.editor/canvas/RichTextConverter.js
- **Fix:** Replaced `innerHTML` with `DOMParser` in `htmlToRichText()`
  and `getPlainText()` for safer HTML parsing.

### ✅ P3-054: PropertiesForm setTimeout Guards (Fixed v39)

- **File:** resources/ext.layers.editor/ui/PropertiesForm.js
- **Fix:** Moved `editor.layerPanel` guard inside `setTimeout` callbacks
  to prevent stale reference access if panel is destroyed.

### ✅ P3-055: PropertyBuilders setTimeout Guards (Fixed v39)

- **File:** resources/ext.layers.editor/ui/PropertyBuilders.js
- **Fix:** Moved `editor.layerPanel` guard inside all 5 `setTimeout`
  callbacks to prevent stale reference access.

### ✅ P3-056: DraftManager Missing Editor Reference Cleanup (Fixed v39)

- **File:** resources/ext.layers.editor/DraftManager.js
- **Resolution:** destroy() now nulls editor and filename references.

### ✅ P3-057: LayersValidator Listener Accumulation (Fixed v39)

- **File:** resources/ext.layers.editor/LayersValidator.js
- **Fix:** Added WeakMap-based tracking. `createInputValidator()` now
  auto-destroys any previous validator on the same input element.

### ✅ P3-058: ErrorHandler DOM Initialization Timing (Fixed v39)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Fix:** Added `document.body` guard with DOMContentLoaded fallback.

### ✅ P3-059: README.md Test Count Badge (Fixed v39)

- **File:** README.md
- **Fix:** Updated badge and tables to 11,122 tests (162 suites).

### ✅ P3-001: ApiLayersList Missing unset() (Fixed v34)

### ✅ P3-002: UIHooks Unused Variables (Fixed v34)

### ✅ P3-003: StateManager Malformed JSDoc (Fixed v34)

### ✅ P3-004: ThumbnailRenderer Exception Not Throwable (Fixed v34)

### ✅ P3-005: Hardcoded 'Anonymous' User Name (Fixed v34)

### ✅ P3-006: ImageLayerRenderer djb2 Hash Collision — CLOSED BY DESIGN

### ✅ P3-007: checkSizeLimit .length Not Byte Count (Fixed v34)

### ✅ P3-008: LayerInjector Logger Argument (Fixed v30)

### ✅ P3-009: SlideHooks isValidColor Too Weak (Fixed v30)

### ✅ P3-010: services.php Missing strict_types (Fixed v30)

### ✅ P3-011: Version Numbers Stale Across 10+ Documents (Resolved)

- **Fix:** Updated 1.5.56→1.5.57 in UX_STANDARDS_AUDIT.md, SLIDE_MODE.md,
  LTS_BRANCH_STRATEGY.md (6 version references). Other files already correct.

### ✅ P3-012: PHPUnit Test Count Wrong in Files (Resolved)

### ✅ P3-013: i18n Key Count Wrong (Resolved)

- **Fix:** All key docs already show 816 (matching en.json). Original
  731/741 counts were corrected in earlier sessions.

### ✅ P3-014: README Uses Wrong Slide Parameter (Resolved)

### ✅ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5' (Resolved)

### ❌ P3-016: No CHANGELOG Entries for v1.5.53 or v1.5.54 — ✅ CLOSED

- **Resolution:** No git tags exist for v1.5.53 or v1.5.54. These version
  bumps were never formally released. No changelog content can be created.

### ❌ P3-017: wiki/Changelog.md Not Mirroring CHANGELOG.md — ✅ RESOLVED

- **Fix:** The 37% gap is primarily from pre-1.0 versions (0.8.x-0.9.x, 10
  entries) and minor releases (1.1.1, 1.4.1, etc.) that predate the mirroring
  rule. Recent versions (1.5.32-34) are already summarized at 1.5.35. All
  versions from 1.5.35 onward are present in both files.

### ❌ P3-018: INSTANTCOMMONS_SUPPORT.md Deprecated Syntax — ✅ RESOLVED

### ❌ P3-019: NAMED_LAYER_SETS.md Uses Proposal Language — ✅ RESOLVED

- **Fix:** Full rewrite in P2-038 commit: "Proposed Design" → "Architecture",
  schema corrected, removed nonexistent config keys, marked delete/rename
  as implemented.

### ❌ P3-020: SHAPE_LIBRARY_PROPOSAL.md Says "Proposed" — ✅ RESOLVED

### ❌ P3-021: UX_STANDARDS_AUDIT.md Outdated — ✅ RESOLVED

### ❌ P3-022: SLIDE_MODE.md Partially Implemented — ✅ RESOLVED

### ❌ P3-023: FUTURE_IMPROVEMENTS.md Duplicate Section Numbers — ✅ RESOLVED

- **Fix:** Removed 5 completed items (FR-8, FR-12, FR-13, FR-14, FR-16)
  from Active Proposals. Renumbered remaining proposals. Added to
  Recently Completed table.

### ❌ P3-024: README Badge Test Count Outdated — ✅ RESOLVED

- **Fix:** Already fixed in P3-059 (updated to 11,122 tests / 162 suites).

### ❌ P3-025: JS/PHP Line Counts Slightly Off — ✅ RESOLVED

- **Fix:** Updated across 8 files: JS 96,943 lines, PHP 40 files / 15,081 lines.

### ❌ P3-026: SSLV.php Line Count Wrong in Docs — ✅ RESOLVED

- **Fix:** Updated SSLV 1,346/1,375→1,383 and LayersDatabase 1,363→1,369
  across ARCHITECTURE.md, codebase_review.md, copilot-instructions.md.

### ❌ P3-027: PropertiesForm.js Line Count Wrong — ✅ RESOLVED

- **Fix:** Updated PropertiesForm 914/994/1,001→993 across 5 files.
  Updated PropertyBuilders 1,284→1,495 in ARCHITECTURE.md.

### ❌ P3-028: God Class Count Wrong in Multiple Docs — ✅ RESOLVED

- **Fix:** Updated 21→16 across README.md, CONTRIBUTING.md (including
  god class table), ARCHITECTURE.md, GOD_CLASS_REFACTORING_PLAN.md,
  codebase_review.md, wiki/Changelog.md, wiki/Frontend-Architecture.md.

### ❌ P3-029 through P3-032: Additional Documentation Staleness — ✅ RESOLVED

- **Fix:** All specific documentation staleness addressed in v39 review:
  version numbers, line counts, god class counts, tool counts, i18n counts,
  NAMED_LAYER_SETS.md, FUTURE_IMPROVEMENTS.md, and test counts.

### ✅ P3-033: SHA1 Fallback Outside Trait (Fixed v35)

### ✅ P3-034: SchemaManager CURRENT_VERSION Stale at 1.5.52 (Fixed v35)

### ✅ P3-035: ImageLayerRenderer Stale Cache on src (Fixed v35)

### ✅ P3-036: DimensionRenderer hitTest Fallback Mismatch (Fixed v35)

### ✅ P3-037: ColorValidator Alpha Regex (Fixed v35)

### ✅ P3-038: WikitextHooks info→debug Log Level (Fixed v35)

### ✅ P3-039: EditLayersAction Dead MW < 1.44 Code (Fixed v35)

### ✅ P3-040: ErrorHandler retryOperation No-Op (Fixed v35)

### ✅ P3-041: LayersLightbox Hardcoded English Alt (Fixed v35)

### ✅ P2-044: RichText fontFamily CSS Attribute Injection (Fixed v39)

- **Files:** src/Validation/ServerSideLayerValidator.php L899,
  resources/ext.layers.editor/canvas/RichTextConverter.js L89-108
- **Impact:** Server validates richText `fontFamily` as type `string`
  only, NOT sanitized with `sanitizeIdentifier()` like top-level
  fontFamily. Client interpolates into HTML style attributes without
  escaping. A crafted fontFamily could break out of the style
  attribute. Requires compromised API or direct DB access.
- **Introduced:** v39 review
- **Recommended Fix:** Apply `sanitizeIdentifier()` to richText
  fontFamily server-side; escape CSS values client-side.

### ✅ P2-045: ForeignFileHelper Code Duplication (Fixed v39)

- **Files:** Hooks.php, EditLayersAction.php, LayerInjector.php,
  LayeredFileRenderer.php, ThumbnailProcessor.php, ThumbnailRenderer.php,
  ImageLinkProcessor.php
- **Impact:** `isForeignFile()` and/or `getFileSha1()` duplicated in
  7 files outside the existing ForeignFileHelperTrait.
- **Fix:** Created `src/Utility/ForeignFileHelper.php` static utility class
  with canonical 3-step detection. All 7 files + trait now delegate to it.
  ~280 lines of duplicate code removed.

### ✅ P2-046: ThumbnailRenderer Ignores Opacity for Named Colors (Fixed v39)

- **File:** src/ThumbnailRenderer.php L645-722
- **Impact:** `withOpacity()` returns named CSS colors unchanged
  regardless of opacity value. Visual mismatch between thumbnails
  (full opacity) and canvas viewer (correct opacity).
- **Introduced:** v39 review
- **Recommended Fix:** Add CSS named color → RGB lookup table.

### ✅ P2-047: No Rate Limiting on {{#Slide:}} Parser Function (Fixed v39)

- **File:** src/Hooks/SlideHooks.php L150, L327-360
- **Impact:** One uncached DB query per `{{#Slide:}}` invocation
  with no per-page counter or result cache. 200+ invocations on
  one page generates 200+ queries.
- **Introduced:** v39 review
- **Recommended Fix:** Add static counter (max 50/page) and cache.

### ✅ P2-048: wiki/Drawing-Tools.md Missing 2 Tool Docs (Fixed v39)

- **File:** wiki/Drawing-Tools.md
- **Impact:** Claims 15 tools but Marker and Dimension tools have
  zero documentation. Both have dedicated renderers (601 and 927
  lines respectively).
- **Introduced:** v39 review
- **Recommended Fix:** Add Marker and Dimension sections.
- **Resolution:** Added comprehensive Marker and Dimension tool
  documentation sections. Updated tool count from 15 → 17 across
  all documentation files (13 files).

### ✅ P2-049: Double HTML-Escaping in LayeredFileRenderer (Fixed v39)

- **File:** src/Hooks/Processors/LayeredFileRenderer.php L78
- **Impact:** `htmlspecialchars()` called on filename before passing
  to `errorSpan()` which calls `htmlspecialchars()` again. Filenames
  with `&` display as `&amp;amp;`.
- **Introduced:** v39 review
- **Recommended Fix:** Remove `htmlspecialchars()` from call site L78.

### ✅ P2-050: Hooks.php Fallback Logger Incomplete PSR-3 (Fixed v39)

- **File:** src/Hooks.php L139-172
- **Impact:** Fallback logger only implements `info()`, `error()`,
  `warning()` — missing `debug()`, `notice()`, `critical()`,
  `alert()`, `emergency()`, `log()`. Any code calling missing
  methods via this fallback triggers fatal error.
- **Introduced:** v39 review
- **Recommended Fix:** Use `\Psr\Log\NullLogger` as fallback.

### ✅ P2-051: ToolbarStyleControls Validator Cleanup Leak (Fixed v39)

- **File:** resources/ext.layers.editor/ToolbarStyleControls.js L973
- **Impact:** `destroy()` sets `this.inputValidators = []` without
  calling `.destroy()` on each validator, leaving event listeners
  attached to old input elements.
- **Introduced:** v39 review
- **Recommended Fix:** Add `this.inputValidators.forEach(v => v.destroy())`
  before clearing.

### ✅ P2-052: npm test Skips Jest Unit Tests (Fixed v39)

- **Files:** package.json L8, Gruntfile.js L47
- **Impact:** `npm test` = grunt (eslint, stylelint, banana) only.
  11,122 Jest tests require separate `npm run test:js`. CI using
  only `npm test` has zero unit test coverage.
- **Introduced:** v39 review
- **Recommended Fix:** Add `&& npx jest --passWithNoTests` to npm test.

### ✅ P2-053: UIHooks Excessive Defensive Coding (Fixed v39)

- **File:** src/Hooks/UIHooks.php
- **Impact:** 28 `method_exists()`/`is_object()` checks for APIs
  guaranteed since MW 1.18+. Extension requires MW >= 1.44.0.
  Dead code noise reduces readability.
- **Introduced:** v39 review
- **Recommended Fix:** Remove pre-1.44 compatibility guards.

### ✅ P3-060: console.log/warn Globally Mocked in Test Setup (Fixed v39)

- **File:** tests/jest/setup.js
- **Fix:** Replaced `global.console = Object.assign(...)` with
  individual `jest.spyOn()` calls that auto-restore between tests.

### ✅ P3-061: BasicLayersTest.test.js Tautological Tests (Fixed v39)

- **File:** tests/jest/BasicLayersTest.test.js (DELETED)
- **Fix:** Deleted 275-line file that tested inline objects without
  importing any production code. Test count: 11,139 → 11,122.

### ✅ P3-062: jest.config.js Coverage Comment Stale (Fixed v39)

- **File:** jest.config.js L36
- **Impact:** Comment says 94.19% statements; actual is 95.19%.
- **Introduced:** v39 review

### ✅ P3-063: Hooks.php/UIHooks.php Unnecessary NS_FILE Guard (Fixed v39)

- **Files:** src/Hooks.php L21-23, src/Hooks/UIHooks.php L21-23
- **Impact:** Both define NS_FILE if not set. MW >= 1.44.0 always
  defines it. Dead code.
- **Introduced:** v39 review

---

## Documentation Issues Summary (updated v41)

Documentation issues identified across reviews, tracked for
completeness and referenced in the improvement plan.

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 1 | Version drift (10+ files) — fixed v36 |
| MEDIUM | 2 | Metrics drift (fixed v36); ARCHITECTURE.md module line counts wrong (v41) |
| LOW | 13+ | CHANGELOG mirror; FUTURE_IMPROVEMENTS; stale counts; copilot-instructions nonexistent dir; RELEASE_GUIDE.md stale reqs; DEVELOPER_ONBOARDING.md line counts; mediawiki page says "15 drawing tools" (should be 17) |

---

## Reporting an Issue

If you discover a new issue, add it to this document under the
appropriate priority level with:
- A unique ID (P{n}-{NNN})
- File reference and line numbers
- Description of impact
- Recommended fix (if known)
- The review version where it was discovered

Then update the summary table at the top.
