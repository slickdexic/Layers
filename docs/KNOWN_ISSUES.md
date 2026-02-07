# Known Issues

**Last Updated:** February 7, 2026 (Comprehensive Critical Review v25)
**Version:** 1.5.52

This document lists known issues and current gaps for the Layers
extension. Cross-reference with
[codebase_review.md](../codebase_review.md) and
[improvement_plan.md](../improvement_plan.md) for details and fix
plans.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **2** | ✅ FIXED — Phantom API, callout scaling |
| P1 (High Priority) | **8** | 4 ✅ FIXED, 4 ❌ OPEN |
| P2 (Medium Priority) | **9** | 2 ✅ FIXED, 7 ❌ Open |
| P3 (Low Priority) | **11** | Deferred |
| Performance | **7** | ❌ 1 HIGH, 2 MEDIUM, 4 LOW |
| Documentation | **51** | ❌ 18 HIGH, 27 MEDIUM, 6 LOW |

---

## Security Controls Status (v25 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ✅ PASS | Registered via onRegistration() |
| XSS Prevention | ✅ PASS | TextSanitizer iterative removal |
| Input Validation | ✅ PASS | Strict whitelist, setname sanitized |
| Authorization | ✅ PASS | Owner/admin checks; API framework reads |
| CSP | ⚠️ PARTIAL | Raw header() bypass; may conflict with MW |
| Data Normalization | ✅ PASS | All properties normalized |
| SVG Sanitization | ⚠️ PARTIAL | Checks href; missing CSS injection vectors |
| Server File Access | ✅ PASS | IM `@` disclosure fixed |

---

## Previously Fixed Issues (v22-v24)

All CRITICAL and HIGH issues from v22-v24 reviews have been verified
as fixed in the v25 review:

- 4 CRITICAL from v24 (2 fixed, 2 false positives — confirmed)
- 11 HIGH from v24 (all 11 fixed — confirmed)
- 3 CRITICAL from v22 (all fixed)
- 11 HIGH from v22 (all fixed)
- 12 of 16 MEDIUM from v24 (fixed)

---

## ✅ P0 — Critical Issues (FIXED)

### P0.1 LayeredFileRenderer Phantom API `action=layersthumbnail`

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review CRIT-v25-1
**File:** src/Hooks/Processors/LayeredFileRenderer.php (L236)

`generateLayeredThumbnailUrl()` constructs URLs with a non-existent API
action. The five registered modules are: layersinfo, layerssave,
layersdelete, layersrename, layerslist. No `layersthumbnail` exists.

---

### P0.2 Callout tailTipX/tailTipY Not Scaled in Viewer

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review CRIT-v25-2
**File:** resources/ext.layers/LayersViewer.js (L558-691)

`scaleLayerCoordinates()` scales x, y, width, height, arrowX, arrowY,
controlX, controlY, and many other properties but does NOT scale
tailTipX or tailTipY. Callout tails point to wrong positions when
the viewer scales the image.

---

## ❌ P1 — High Priority Issues (NEW in v25)

### P1.1 TextRenderer Rotation Ignores textAlign

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v25-1
**File:** resources/ext.layers.shared/TextRenderer.js (L205-228)

Rotation center always calculated as `x + textWidth/2` (left-aligned
assumption). For `textAlign='center'`, pivot should be `x`; for
`textAlign='right'`, should be `x - textWidth/2`. Rotated text with
non-left alignment rotates around the wrong point.

---

### P1.2 ToolStyles SHADOW_OFFSET Constant Missing

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review HIGH-v25-2
**File:** resources/ext.layers.editor/tools/ToolStyles.js (L53-54)

References `getDefaults().SHADOW_OFFSET` but only `SHADOW_OFFSET_X`
and `SHADOW_OFFSET_Y` exist in LayerDefaults.js. Shadow offsets for
new shapes become `undefined` instead of `2`. Downstream fallbacks
in PropertiesForm mask the visual impact but the data model is wrong.

---

### P1.3 ValidationManager.getMessage() Null Guard Missing

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review HIGH-v25-3
**File:** resources/ext.layers.editor/modules/ValidationManager.js (L311)

`window.layersMessages.get()` called without null check. Every other
module guards against undefined layersMessages. Will throw TypeError
if i18n module fails to load.

---

### P1.4 CSP Header Uses Raw header() Instead of MW Abstraction

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v25-4
**File:** src/Action/EditLayersAction.php (L356-360)

Falls back to raw PHP `header()` since `addExtraHeader` doesn't exist
on OutputPage. Should use `$out->getRequest()->response()->header()`.
Custom CSP may conflict with MediaWiki's own CSP settings.

---

### P1.5 SVG Validation Missing CSS Injection Vectors

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v25-5
**File:** src/Validation/ServerSideLayerValidator.php (~L1215)

Does not block `expression()`, `-moz-binding:url()`, `behavior:`,
or `@import` in SVG style elements. Mitigated by canvas rendering
(not DOM SVG injection), but defense gap remains.

---

### P1.6 SlideHooks isValidColor() Weaker Than ColorValidator

**Status:** ❌ OPEN
**Ref:** codebase_review HIGH-v25-6
**File:** src/Hooks/SlideHooks.php (L317)

Only 14 named colors, no length limit (ReDoS risk), no HSL/HSLA.
Compare ColorValidator: 148 colors, 50-char limit, HSL/HSLA support.

---

### P1.7 PropertyBuilders Underline/Strikethrough Mutually Exclusive

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review HIGH-v25-7
**File:** resources/ext.layers.editor/ui/PropertyBuilders.js (L415-430)

Both write `textDecoration` with single values. Enabling one removes
the other. Users cannot apply both simultaneously.

---

### P1.8 PresetManager.SUPPORTED_TOOLS Incomplete

**Status:** ✅ FIXED (Feb 7, 2026)
**Ref:** codebase_review HIGH-v25-8
**File:** resources/ext.layers.editor/presets/PresetManager.js (L637-641)

Static constant missing `'dimension'` and `'marker'` despite both
having presets in BuiltInPresets.js and being returned by the instance
method getSupportedTools().

---

## ❌ P2 — Medium Priority Issues (Open)

### P2.1 8x isForeignFile()/getFileSha1() Code Duplication
**Ref:** MED-v25-1. 7 standalone implementations + 1 trait in 8 files.
Any fix must be applied in 8 places. Trait exists but only API modules
use it.

### P2.2 enrichWithUserNames() Duplicated Across 3 Files
**Ref:** MED-v25-2. ApiLayersInfo, ApiLayersList, UIHooks each have
their own implementation with slightly different logic.

### P2.3 GradientEditor Stale Event Listener Accumulation
**Ref:** MED-v25-3. `_build()` clears DOM without clearing eventTracker.
Memory leak on repeated color stop add/remove.

### P2.4 EffectsRenderer Unconditional Debug Logging
**Ref:** MED-v25-4. ✅ FIXED (Feb 7, 2026). Guarded with wgLayersDebug check.

### P2.5 CanvasRenderer getBackgroundVisible() Defensive Gap
**Ref:** MED-v25-5. ✅ FIXED (Feb 7, 2026). Added `visible !== 0` check.

### P2.6 ext.layers Module Loaded on Every Page View (2x)
**Ref:** MED-v25-6 (carried from MED-v24-2). Unconditional addModules
in two hooks. Performance impact on all wiki pages.

### P2.7 APIManager reloadRevisions Wrong Catch Signature
**Ref:** MED-v25-7. Single-arg catch vs mw.Api two-arg rejection.
Error handler receives code string, not Error object.

### P2.8 PropertiesForm Validation Errors Not Internationalized
**Ref:** MED-v25-8. Hardcoded English validation messages should use
i18n keys for localization.

### P2.9 SelectionManager selectAll() Fallback Skips Filter
**Ref:** MED-v25-9. Fallback path (null _selectionState) selects all
layers without filtering locked/invisible.

---

## ⚠️ P3 — Low Priority Issues (Deferred)

### P3.1 Dead $viewUrl variable in UIHooks.php
### P3.2 5+ inconsistent getClass() implementations
### P3.3 ConfirmDialog.js indentation inconsistency
### P3.4 Duplicate JSDoc blocks in StateManager
### P3.5 Stream-of-consciousness comments in CanvasRenderer
### P3.6 Triplicated checker pattern drawing code
### P3.7 Layer hash temp arrays per frame (GC pressure)
### P3.8 GroupManager O(n×m) getGroupChildren()
### P3.9 DimensionRenderer has no shadow support
### P3.10 GradientRenderer wrong namespace depth (3 vs 2)
### P3.11 document.execCommand() deprecated in InlineTextEditor

---

## Performance Issues

| ID | Severity | Issue | File |
|----|----------|-------|------|
| PERF-1 | HIGH | TextRenderer shadow spread O(n) fillText | TextRenderer.js L247 |
| PERF-2 | MEDIUM | SelectionManager JSON clone vs efficient clone | SelectionManager.js ~L1092 |
| PERF-3 | MEDIUM | LayersViewer JSON clone for gradients per frame | LayersViewer.js ~L532 |
| PERF-4 | LOW | Checker pattern individual rectangles | CanvasRenderer.js ~L550 |
| PERF-5 | LOW | ViewerManager queries all img elements | ViewerManager.js ~L410 |
| PERF-6 | LOW | LayersViewer recomputes scale per layer | LayersViewer.js ~L502 |
| PERF-7 | LOW | Layer hash temp array allocation per frame | CanvasRenderer.js ~L165 |

---

## Documentation Issues (51 total)

### HIGH — Factually Wrong or Misleading (18)

| ID | File | Issue |
|----|------|-------|
| DOC-1 | All docs | God class count says 19 — actual is 21 (ResizeCalculator=1,017, ShapeRenderer=1,010 crossed threshold) |
| DOC-2 | wiki/Home.md | "What's New in v1.5.52" lists wrong features (doesn't match CHANGELOG) |
| DOC-3 | wiki/Home.md | "v1.5.51 Highlights" misattributed — features are from v1.5.50 |
| DOC-4 | wiki/Home.md | "v1.5.49 Highlights" fabricated — features don't match CHANGELOG |
| DOC-5 | copilot-instructions.md | PHP file count says 40 — actual is 39 |
| DOC-6 | copilot-instructions.md | DialogManager.js says ~420 lines — actual is 736 (+75%) |
| DOC-7 | copilot-instructions.md | LayersViewer.js wrong path (not in viewer/ subdirectory) and wrong size (~571 vs actual 690) |
| DOC-8 | copilot-instructions.md | `callout` type missing from layer type enum |
| DOC-9 | copilot-instructions.md | ResizeCalculator listed near-threshold (~995) but is 1,017 (god class) |
| DOC-10 | copilot-instructions.md | ShapeRenderer listed near-threshold (~995) but is 1,010 (god class) |
| DOC-11 | docs/ARCHITECTURE.md | Namespace VERSION shows '0.8.5' — should be 1.5.52 |
| DOC-12 | docs/ARCHITECTURE.md | Controller table line counts severely stale (up to +414 lines off) |
| DOC-13 | docs/ARCHITECTURE.md | Viewer section says "~2,500 lines" — actual is 4,000+ |
| DOC-14 | KNOWN_ISSUES.md (v24) | All P0/P1 marked "❌ OPEN" but codebase_review says "✅ FIXED" |
| DOC-15 | improvement_plan.md (v24) | Contradicts codebase_review on fix status |
| DOC-16 | README.md | Drawing tool table heading says "15 tools" but lists 16 rows |
| DOC-17 | codebase_review.md (v24) | Conclusion says "11,252 tests" vs "11,228" everywhere else |
| DOC-18 | docs/SLIDE_MODE.md | `lock` parameter extensively documented but NOT IMPLEMENTED |

### MEDIUM — Outdated or Incomplete (27)

| ID | File | Issue |
|----|------|-------|
| DOC-19 | README.md, mediawiki page | Missing `$wgLayersMaxComplexity` config |
| DOC-20 | README.md, mediawiki page | Missing all 7 Slide Mode configs |
| DOC-21 | copilot-instructions.md | JS line count says ~96,619 — actual is 96,787 |
| DOC-22 | copilot-instructions.md | PHP line count says ~14,946 — actual is 15,019 |
| DOC-23 | copilot-instructions.md | Several module line counts 20-25% stale |
| DOC-24 | docs/ARCHITECTURE.md | Facade table line counts stale |
| DOC-25 | docs/ARCHITECTURE.md | File tree line counts stale |
| DOC-26 | docs/NAMED_LAYER_SETS.md | Written as proposal despite being implemented |
| DOC-27 | docs/NAMED_LAYER_SETS.md | Says "10-20 sets" but config default is 15 |
| DOC-28 | docs/SLIDE_MODE.md | "Partially Implemented" but Phases 1-3 all COMPLETED |
| DOC-29 | docs/SLIDE_MODE.md | Phase 4 says bump to v1.6.0; current is 1.5.52 |
| DOC-30 | docs/FUTURE_IMPROVEMENTS.md | FR-14, FR-16 marked completed but retain full plans |
| DOC-31 | docs/FUTURE_IMPROVEMENTS.md | Inconsistent section numbering |
| DOC-32 | docs/ACCESSIBILITY.md | Missing Marker (M) and Dimension (D) shortcuts |
| DOC-33 | docs/WIKITEXT_USAGE.md | Missing `{{#Slide:}}` parser function syntax |
| DOC-34 | docs/INSTANTCOMMONS_SUPPORT.md | Uses deprecated `layers=` instead of `layerset=` |
| DOC-35 | docs/RELEASE_GUIDE.md | Example version 1.3.2 very outdated |
| DOC-36 | docs/API.md | Filename misleading — contains JSDoc, not HTTP API docs |
| DOC-37 | docs/CSP_GUIDE.md | Recommends `'unsafe-eval'` in script-src |
| DOC-38 | docs/PROJECT_GOD_CLASS_REDUCTION.md | Test count stale (says "10,840+") |
| DOC-39 | docs/PROJECT_GOD_CLASS_REDUCTION.md | God class target mismatched with actual |
| DOC-40 | README.md | Test coverage date inconsistency (Feb 2 vs Feb 6) |
| DOC-41 | docs/DOCUMENTATION_UPDATE_GUIDE.md | "11 Files Rule" but 14 steps listed |
| DOC-42 | CONTRIBUTING.md | Near-threshold list missing PropertiesForm |
| DOC-43 | SECURITY.md | No Slide Mode security considerations |
| DOC-44 | docs/DEVELOPER_ONBOARDING.md | Stale line counts for DialogManager, RevisionManager |
| DOC-45 | wiki/Home.md | 15+ "What's New" sections — should archive old entries |

### LOW — Style/Formatting (6)

| ID | File | Issue |
|----|------|-------|
| DOC-46 | CHANGELOG.md | Unreleased has exact test count (instantly stale) |
| DOC-47 | docs/ACCESSIBILITY.md | "Last Updated: February 2026" without specific day |
| DOC-48 | docs/NAMED_LAYER_SETS.md | "Version: 1.1" ambiguous |
| DOC-49 | docs/RELEASE_GUIDE.md | Version history table has only one entry |
| DOC-50 | docs/FUTURE_IMPROVEMENTS.md | FR-16 completed but full plan retained |
| DOC-51 | Various | Minor date/count inconsistencies across wiki pages |

---

## Test Coverage

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

All coverage targets met or exceeded.
