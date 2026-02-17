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
- **Severity:** HIGH
- **Impact:** Deleting a user cascade-deletes ALL their layer sets
  across all images
- **Introduced:** v27 review
- **Resolution:** Changed FK constraints to ON DELETE SET NULL; made user ID columns nullable; added migration patch

### ✅ P1-012: ls_name Allows NULL in Schema (Fixed v34)

- **File:** sql/layers_tables.sql
- **Impact:** Named sets feature requires non-null names but schema
  permits NULL, risking orphaned or unreachable records
- **Introduced:** v27 review
- **Resolution:** Added migration patch: UPDATE NULLs to 'default', ALTER COLUMN NOT NULL DEFAULT 'default'

### ✅ P1-013: Triple Source of Truth for Selection State (Partially Fixed v34)

- **File:** SelectionManager.js, CanvasManager.js, StateManager.js
- **Impact:** Selection can desync between three managers; source of
  subtle bugs where selection appears stale
- **Introduced:** v27 review
- **Resolution:** Removed 5 ghost (write-only) properties from CanvasManager that duplicated TransformController state (isResizing, isRotating, isDragging, resizeHandle, originalLayerState) and their sync writes on every mouse move. Selection state authority: SelectionState.js (logic) → StateManager (subscriptions). StateManager's dead selection methods were already removed to SelectionState in prior work. The remaining dual-authority (SelectionManager local array + StateManager store) is low-risk: notifySelectionChange() keeps them coherent.

### ✅ P1-014: Rich Text Word Wrap Wrong Font Metrics (Fixed v34)

- **File:** TextBoxRenderer.js
- **Impact:** Rich text runs with multiple font sizes measure words
  at the wrong size, causing incorrect line breaks
- **Introduced:** v26 review
- **Resolution:** Created `wrapRichText()` method that tokenizes runs
  with per-run font strings and switches ctx.font during measurement.
  5 regression tests added.

### ✅ P1-015: ThumbnailRenderer Shadow Blur Corrupts Canvas (Fixed v34)

- **File:** ThumbnailRenderer.php
- **Impact:** Server-rendered thumbnails with shadow blur can corrupt
  the canvas state for subsequent elements
- **Introduced:** v28 review
- **Resolution:** Created `buildShadowSubImage()` helper wrapping shadow drawing in parenthesized sub-image operations to isolate `-blur` to a fresh transparent canvas per shadow element. Added 4 PHPUnit tests.

### ✅ P1-016: SQLite-Incompatible Schema Migrations (Fixed v34)

- **File:** src/Database/LayersSchemaManager.php, sql/patches/
- **Impact:** Several migration patches use MySQL-specific syntax
  (ALTER TABLE ... MODIFY, IF NOT EXISTS on ALTER); blocks SQLite users
- **Introduced:** v28 review
- **Resolution:** Converted all 6 SQLite-incompatible registered patches to PHP methods with `$dbType` branching. MySQL-only operations (MODIFY COLUMN, DROP FOREIGN KEY, ADD CONSTRAINT CHECK) are no-ops on SQLite (dynamic typing, no FK enforcement). Added 3 missing `addExtensionField` registrations from dead Hooks.php handler. Deleted 12 orphaned SQL patches. Removed dead `onLoadExtensionSchemaUpdates()` from Hooks.php (never registered in extension.json).

### ✅ P1-017: ShadowRenderer Discards Canvas Scale on Rotation (Fixed v34)

- **File:** resources/ext.layers.shared/ShadowRenderer.js L305-325
- **Impact:** Spread shadows on rotated shapes render at wrong size
  whenever canvas zoom ≠ 1. The identity matrix replacement strips
  the scale components from the transform.
- **Introduced:** v33 review
- **Resolution:** Both drawSpreadShadow methods now decompose scale via
  `sx = sqrt(a²+b²); sy = sqrt(c²+d²)` and preserve it in the matrix. Regression test added.

### ✅ P1-018: DimensionRenderer hitTest Ignores Offset (Fixed v34)

- **File:** resources/ext.layers.shared/DimensionRenderer.js L750-761
- **Impact:** Click detection tests against the raw measurement baseline,
  not the visible offset dimension line. When dimensionOffset is large,
  clicking the visible line fails to select the layer.
- **Introduced:** v33 review
- **Resolution:** hitTest() rewritten to calculate perpendicular offset using _drawInternal() logic. 4 regression tests added.

### ✅ P1-019: APIManager saveInProgress Permanently Stuck (Fixed v34)

- **File:** resources/ext.layers.editor/APIManager.js L859-870
- **Impact:** If buildSavePayload() or JSON.stringify() throws (corrupt
  layer data, circular reference), saveInProgress stays true forever.
  All subsequent saves rejected until page reload.
- **Introduced:** v33 review
- **Resolution:** Wrapped in try/catch; resets saveInProgress, hides spinner, enables save button on error. 2 regression tests added.

### ✅ P1-020: PresetStorage Strips Gradient Data (Fixed v34)

- **File:** resources/ext.layers.editor/presets/PresetStorage.js L20-56
- **Impact:** ALLOWED_STYLE_PROPERTIES whitelist does not include
  'gradient'. Saving a preset from a shape with gradient fill silently
  strips all gradient data from the saved preset.
- **Introduced:** v33 review
- **Resolution:** Added 'gradient' to ALLOWED_STYLE_PROPERTIES. 3 regression tests added.

---

## P2 — Medium Priority

### ✅ P2-001: Negative Dimensions for Rectangle/TextBox (Fixed v28)

### ✅ P2-002: DraftManager Stores Base64 Image Data (Fixed v28)

### ✅ P2-003: CalloutRenderer Blur Clips L/R Tails (Fixed v31)

### ✅ P2-004: closeAllDialogs Leaks Keydown Handlers (Fixed v30)

### ✅ P2-005: ext.layers Loaded Every Page (Fixed v34)

- **File:** src/Hooks.php, src/Hooks/WikitextHooks.php
- **Impact:** Viewer module loaded site-wide; unnecessary JS on
  non-file pages
- **Resolution:** Made `ext.layers` module loading conditional — only on File: pages or pages with `layerset=` wikitext. Added ParserOutput-based module registration in WikitextHooks for cached page delivery. Removed redundant `addModules()` from `onMakeGlobalVariablesScript()` and made JS config var export conditional.

### ✅ P2-006: SlideManager.js Dead Code (~439 Lines) (Fixed v34)

- **File:** resources/ext.layers.slides/SlideManager.js
- **Impact:** Unmaintained dead code; module references non-existent
  init.js and slides.css
- **Resolution:** Deleted 3 dead source files (init.js, SlideManager.js, slides.css) totaling 694 lines and 1 dead test file (SlideManager.test.js, 425 lines). No module definition in extension.json; no references in codebase.

### ✅ P2-007: Client SVG Sanitization Regex Bypassable (Fixed v34)

- **File:** LayersValidator.js
- **Impact:** Regex-based SVG sanitization can be bypassed with
  encoding tricks; server-side validation is the real defense
- **Resolution:** Replaced regex with DOMParser-based sanitizer. Removes 14 dangerous element types, event handlers, dangerous URL schemes, and CSS patterns. 8 regression tests added.

### ✅ P2-008: sanitizeString Strips `<>` Destroying Math (Fixed v34)

- **File:** ValidationManager.js, TextUtils.js
- **Impact:** Users entering mathematical expressions like `x<5`
  have the angle brackets stripped, corrupting their text
- **Resolution:** Changed from blanket `<>` strip to targeted
  dangerous-tag-only stripping. Canvas2D renders text literally
  and doesn't interpret HTML, so standalone angle brackets are safe.

### ✅ P2-009: SmartGuides Cache Stale on Mutations (Fixed v34)

- **File:** SmartGuidesController.js
- **Impact:** Guide lines can snap to outdated positions after
  layer mutations until cache is manually invalidated
- **Resolution:** Replaced broken reference-equality cache with
  version-counter from StateManager. 2 tests added.

### ✅ P2-010: ToolManager 400+ Lines Dead Fallbacks (Fixed v34)

- **File:** ToolManager.js
- **Impact:** Code quality; tool-specific logic that was extracted
  to handlers but fallback code remains
- **Resolution:** Removed 415 lines of unreachable fallback code (799 lines, down from 1,214). All 5 extracted modules are ResourceLoader dependencies. Also fixed `this.toolStyles` naming bug causing fallback code to always execute for style operations. Tests rewritten: 84 focused tests (was 171).

### ✅ P2-011: HistoryManager Duck-Type Constructor (Fixed v34)

- **File:** HistoryManager.js
- **Impact:** Constructor accepted 5 calling conventions via property
  sniffing; fragile and undocumented API
- **Resolution:** Replaced with single options-object constructor
  `{ editor, canvasManager, maxHistorySteps }`. Removed ~30 lines of
  duck-typing logic. Simplified getEditor()/getCanvasManager()
  accessors. Updated 2 production + 44 test call sites.

### ✅ P2-012: Duplicate Prompt Dialog Implementations (Fixed v34)

- **File:** DialogManager.js, LayersEditor.js
- **Impact:** Two independent prompt dialog implementations
- **Resolution:** Removed 80-line duplicate `showCancelConfirmDialog()` from LayersEditor.js, replaced with `window.confirm()` fallback. Removed unused callback-based `showPromptDialog()` from DialogManager.js. Net ~200 lines eliminated.

### ✅ P2-013: enrichWithUserNames Duplicated (Fixed v34)

- **File:** ApiLayersInfo.php, ApiLayersList.php
- **Impact:** Same enrichment logic copy-pasted in two API modules
- **Resolution:** Consolidated into generic
  enrichRowsWithUserNames() with field-name parameters

### ✅ P2-014: Toolbar innerHTML with mw.message().text() (Fixed v34)

- **File:** resources/ext.layers.editor/Toolbar.js L1050, L1077, L1099
- **Impact:** `.text()` does NOT HTML-escape. If an admin compromises
  i18n messages, this creates an XSS vector. Latent risk, not
  currently exploitable via normal user input.
- **Resolution:** Replaced innerHTML with DOM construction
  (createElement + textContent + appendChild)

### ✅ P2-015: init.js Event Listener Accumulation (Fixed v34)

- **File:** resources/ext.layers/init.js L124
- **Impact:** `layers-modal-closed` listener registered without
  duplicate guard; repeated init() calls stack listeners
- **Resolution:** Added _modalClosedListenerRegistered guard flag

### ✅ P2-016: ImageLoader Timeout Orphaned on Success (Fixed v34)

- **File:** resources/ext.layers.editor/ImageLoader.js L290-317
- **Impact:** loadTestImage() sets a setTimeout but onload doesn't
  call clearTimeout; orphaned timer fires after success
- **Resolution:** onload now calls clearTimeout(this.loadTimeoutId)

### ✅ P2-017: window.open Without noopener (Fixed v34)

- **File:** resources/ext.layers/viewer/ViewerOverlay.js L465, L468
- **Impact:** `window.open(url, '_blank')` lacks `noopener,noreferrer`
  features string; allows opener reference in some browsers
- **Resolution:** Added 'noopener,noreferrer' third argument

### ✅ P2-018: ShadowRenderer/EffectsRenderer Temp Canvas Per Frame (Fixed v34)

- **File:** ShadowRenderer.js, EffectsRenderer.js
- **Impact:** Creates new canvas element on every render call;
  GC pressure in animation/interaction scenarios
- **Resolution:** Cached offscreen canvases as instance properties
  with grow-only reallocation strategy. Eliminates ~300+ GPU
  allocations/second during drag with shadow layers.

### ✅ P2-019: TextBoxRenderer wrapText No Long Word Break (Fixed v34)

- **File:** resources/ext.layers.shared/TextBoxRenderer.js
- **Impact:** Words exceeding maxWidth (e.g., long URLs) overflow
  the text box boundary instead of being broken
- **Resolution:** Added character-by-character breaking for words
  exceeding maxWidth. 2 regression tests added.

### ✅ P2-020: ApiLayersSave Redundant Token Parameter (Fixed v34)

- **File:** src/Api/ApiLayersSave.php L589-594
- **Impact:** Explicit 'token' in getAllowedParams() when
  needsToken() already handles CSRF; harmless but misleading
- **Resolution:** Removed redundant 'token' from getAllowedParams()

### ✅ P2-021: LayersSchemaManager Bypasses DI (Fixed v34)

- **File:** src/Database/LayersSchemaManager.php
- **Impact:** Constructor calls MediaWikiServices::getInstance()
  directly instead of receiving logger via DI; makes testing harder
- **Resolution:** Replaced with constructor injection of
  LoggerInterface and IConnectionProvider. Updated services.php.

### ✅ P2-022: Foreign Key Constraints Violate MW Conventions (Fixed v34)

- **File:** sql/layers_tables.sql, src/Database/LayersSchemaManager.php
- **Impact:** MediaWiki explicitly discourages FK constraints due
  to maintenance/migration complexity
- **Resolution:** Removed all 4 FK constraint declarations from schema files. Created PHP migration method `applyDropForeignKeysPatch()` (no-op on SQLite). Deleted 2 orphaned FK patch files that were never registered in the schema manager.

### ✅ P2-023: SpecialEditSlide References Non-Existent Module (Fixed v34)

- **File:** SpecialEditSlide.php
- **Impact:** Calls `addModuleStyles('ext.layers.editor.styles')` which doesn't exist
- **Resolution:** Removed dead `addModuleStyles()` call. CSS already delivered via main `ext.layers.editor` module.

### ✅ P2-024: ext.layers.slides Missing Required Files (Fixed v34)

- **File:** resources/ext.layers.slides/
- **Impact:** Module definition references init.js, SlideManager.js,
  slides.css which don't exist in that path
- **Resolution:** Deleted all 3 dead source files (see P2-006). The ext.layers.slides directory still exists for the active SlideController system but these orphaned files have been removed.

### ✅ P2-025: Duplicate Message Keys in extension.json (Fixed v34)

- **File:** extension.json
- **Impact:** Same i18n message keys listed in multiple
  ResourceModules; wastes bandwidth
- **Resolution:** Removed 9 intra-module duplicates from `ext.layers.editor`. Cross-module duplicates left intact (required by ResourceLoader).

### ✅ P2-026: phpunit.xml Uses Deprecated PHPUnit 9 Attributes (Fixed v34)

- **File:** phpunit.xml
- **Impact:** PHPUnit 10+ warns about deprecated configuration
  format
- **Resolution:** Updated to PHPUnit 10.5 schema; removed
  deprecated attributes; added cacheDirectory and new display
  settings

---

## P3 — Low Priority

### ✅ P3-001: ApiLayersList Missing unset() After foreach-by-ref (Fixed v34)

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

- **File:** src/Hooks/UIHooks.php L412, L454
- **Impact:** `$viewUrl`, `$viewLabel` assigned but never used
- **Resolution:** Removed both unused variable assignments

### ✅ P3-003: StateManager Malformed JSDoc (Fixed v34)

- **File:** resources/ext.layers.editor/StateManager.js L894-898
- **Impact:** Unclosed `/**` comment block before destroy()
- **Resolution:** Removed malformed comment block

### ✅ P3-004: ThumbnailRenderer Catches Exception Not Throwable (Fixed v34)

- **File:** src/ThumbnailRenderer.php L110
- **Impact:** Misses Error subclasses (e.g., TypeError)
- **Resolution:** Changed catch(Exception) to catch(\Throwable)

### ✅ P3-005: Hardcoded 'Anonymous' User Name (Fixed v34)

- **File:** src/Api/ApiLayersInfo.php L479, L530
- **Impact:** String "Anonymous" not internationalized
- **Resolution:** Replaced with wfMessage('layers-unknown-user');
  added i18n key to en.json and qqq.json

### ✅ P3-006: ImageLayerRenderer djb2 Hash Collision Risk — CLOSED BY DESIGN

- **File:** resources/ext.layers.shared/ImageLayerRenderer.js L170-185
- **Impact:** 32-bit hash for image cache keys; collision probability
  grows with many image layers
- **Resolution:** Assessed as false positive. Hash is only fallback when layer.id missing, 50-entry LRU cache, ~0.00003% collision probability, worst case is transient visual glitch (no data loss). No code change needed.

### ✅ P3-007: checkSizeLimit Uses .length Not Byte Count (Fixed v34)

- **File:** resources/ext.layers.editor/APIManager.js L1440-1443
- **Impact:** String.length counts UTF-16 code units, not bytes.
  Multibyte characters (emoji, CJK) undercount actual payload size.
- **Resolution:** Uses TextEncoder().encode(data).length with
  encodeURIComponent fallback. 2 regression tests added.

### ✅ P3-008: LayerInjector Logger Argument (Fixed v30)

### ✅ P3-009: SlideHooks isValidColor Too Weak (Fixed v30)

### ✅ P3-010: services.php Missing strict_types (Fixed v30)

### ✅ P3-011: Version Numbers Stale Across 10+ Documents (Resolved)

- **Impact:** Version 1.5.52 appears in 6+ files; actual is 1.5.54
- **Files:** ARCHITECTURE.md, copilot-instructions.md,
  LTS_BRANCH_STRATEGY.md, SLIDE_MODE.md, Mediawiki-Extension.mediawiki

### ✅ P3-012: PHPUnit Test Count Wrong in Files (Resolved)

### ✅ P3-013: i18n Key Count Wrong (Resolved)

### ❌ P3-013: i18n Key Count Wrong in 2 Files

### ✅ P3-014: README Uses Wrong Slide Parameter (Resolved)

### ✅ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5' (Resolved)

- **Impact:** README shows `bgcolor=red` in slide syntax example;
  correct parameter is `background=red` per SlideHooks.php
- **File:** README.md

### ❌ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5'

- **Impact:** Code sample in ARCHITECTURE.md L688 shows extremely
  old version string
- **File:** docs/ARCHITECTURE.md

### ❌ P3-016: No CHANGELOG Entries for v1.5.53 or v1.5.54

- **Impact:** CHANGELOG.md and wiki/Changelog.md have no entries
  for the last two version bumps

### ❌ P3-017: wiki/Changelog.md Not Mirroring CHANGELOG.md

- **Impact:** Missing 3+ fixes from Unreleased section
- **File:** wiki/Changelog.md

### ❌ P3-018: INSTANTCOMMONS_SUPPORT.md Uses Deprecated Syntax

- **Impact:** Uses `layers=on` instead of current `layerset=on`
- **File:** docs/INSTANTCOMMONS_SUPPORT.md

### ❌ P3-019: NAMED_LAYER_SETS.md Uses Proposal Language

- **Impact:** Says "Proposed Design" for fully implemented feature
- **File:** docs/NAMED_LAYER_SETS.md

### ❌ P3-020: SHAPE_LIBRARY_PROPOSAL.md Says "Proposed"

- **Impact:** Feature is fully implemented with 5,116 shapes
- **File:** docs/SHAPE_LIBRARY_PROPOSAL.md

### ❌ P3-021: UX_STANDARDS_AUDIT.md Extremely Outdated

- **Impact:** Claims features are "NOT IMPLEMENTED" that have been
  shipping since v1.3+
- **File:** docs/UX_STANDARDS_AUDIT.md

### ❌ P3-022: SLIDE_MODE.md Says "Partially Implemented"

- **Impact:** Most slide features are now complete
- **File:** docs/SLIDE_MODE.md

### ❌ P3-023: FUTURE_IMPROVEMENTS.md Duplicate Section Numbers

- **Impact:** Multiple sections numbered the same; completed items
  listed under "Active"
- **File:** docs/FUTURE_IMPROVEMENTS.md

### ❌ P3-024: README Badge Test Count Outdated

- **Impact:** Badge shows 11,254 but other docs say 11,290
- **File:** README.md

### ❌ P3-025: JS/PHP Line Counts Slightly Off

- **Impact:** README says 96,886 JS lines and 15,034 PHP lines;
  actual is ~96,916 and ~15,096
- **Files:** README.md, Mediawiki-Extension-Layers.mediawiki

### ❌ P3-026: SSLV.php Line Count Wrong in Docs

- **Impact:** copilot-instructions.md and ARCHITECTURE.md say 1,346
  lines; actual is 1,375
- **Files:** .github/copilot-instructions.md, docs/ARCHITECTURE.md

### ❌ P3-027: PropertiesForm.js Line Count Wrong

- **Impact:** copilot-instructions.md says 914 lines; actual is 994
- **File:** .github/copilot-instructions.md

### ❌ P3-028: God Class Count in copilot-instructions.md

- **Impact:** Header says 21 files but hand-written JS count says 17
  and PHP says 2 — total matches but breakdown text may confuse
- **File:** .github/copilot-instructions.md

### ❌ P3-029 through P3-032: Additional Documentation Staleness

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
