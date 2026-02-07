# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 7, 2026 (Comprehensive Critical Review v25)
**Version:** 1.5.52
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** main
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,787 lines) *(excludes dist/)*
- **PHP production files:** 39 in `src/` (~15,019 lines)
- **Jest test files:** 163 suites
- **PHPUnit test files:** 31
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The v25 review is an independent, holistic audit of the entire codebase
performed on the main branch. It builds on the v24 review, verifying which
previously-reported issues were truly fixed and identifying **new issues**
missed by all prior reviews.

Prior reviews suffered from two systematic biases: (1) incremental
verification (confirming reported fixes but not hunting for new issues), and
(2) accepting sub-agent claims without line-level verification, producing
false positives (e.g., v24 CRIT-v24-2 and CRIT-v24-3 were later confirmed
as false positives). This v25 review verifies every finding at the source
code level before reporting.

### Key Strengths (Genuine)
1. **High Test Coverage:** 95.19% statement coverage across 163 test suites
2. **Server-Side Validation:** `ServerSideLayerValidator` is thorough (50+ properties, strict whitelist)
3. **Modern Architecture:** 100% ES6 classes, facade/controller delegation patterns
4. **CSRF Protection:** All write endpoints require tokens via `api.postWithToken('csrf', ...)`
5. **SQL Parameterization:** All database queries use parameterized queries
6. **Defense in Depth:** TextSanitizer, ColorValidator, property whitelist, LayerDataNormalizer

### Key Weaknesses (Newly Identified in v25)
1. **~~Phantom API endpoint:~~** ✅ FIXED — replaced with client-side viewer data attributes
2. **~~Callout viewer rendering:~~** ✅ FIXED — tailTipX/tailTipY scaling added
3. **TextRenderer rotation bug:** Rotation center ignores `textAlign`, producing wrong rotation for center/right-aligned text
4. **8x code duplication:** `isForeignFile()`/`getFileSha1()` in 8 locations despite trait existing
6. **~~ToolStyles shadow bug:~~** ✅ FIXED — changed to SHADOW_OFFSET_X/Y
7. **Documentation drift:** 21 god classes (docs say 19), stale line counts, contradictory status across docs

### Issue Summary (February 7, 2026 — v25 Review)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Bugs | 2 | 5 | 4 | 3 | Slide rendering, callout scaling, text rotation |
| Security | 1 | 3 | 1 | 0 | CSP conflict, SVG CSS injection, weak color validation |
| Code Quality | 0 | 0 | 5 | 8 | 8x duplication, dead code, inconsistent patterns |
| Performance | 0 | 1 | 4 | 2 | TextRenderer shadow spread O(n) |
| Documentation | 0 | 18 | 27 | 6 | 51 documentation issues |
| **Total** | **3** | **27** | **41** | **19** | **90 total issues** |

**Overall Grade:** B+ (strong foundation; critical bugs in slide/callout
rendering; most v24 issues properly fixed)

---

## v24 Issues — Status Verification

### v24 Critical Issues — Final Status

| ID | Issue | v24 Status | v25 Verified |
|----|-------|------------|--------------|
| CRIT-v24-1 | ImageMagick `@` file disclosure | ✅ FIXED | ✅ Confirmed fixed |
| CRIT-v24-2 | Slide permission bypass | ⚪ FALSE POSITIVE | ✅ Correct — API framework enforces read |
| CRIT-v24-3 | Rate limiting disabled | ⚪ FALSE POSITIVE | ✅ Correct — registered via onRegistration() |
| CRIT-v24-4 | preg_replace corruption | ✅ FIXED | ✅ Confirmed fixed |

### v24 High Issues — All 11 Previously Marked Fixed

| ID | Issue | v25 Status |
|----|-------|------------|
| HIGH-v24-1 | GroupManager undo order | ✅ Remains fixed |
| HIGH-v24-2 | Double rotation blur blend | ✅ Remains fixed |
| HIGH-v24-3 | Alignment bounds for ellipse/polygon/star | ✅ Remains fixed |
| HIGH-v24-4 | SetName validation inconsistency | ✅ Remains fixed |
| HIGH-v24-5 | Short ID matching inconsistency | ✅ Remains fixed |
| HIGH-v24-6 | `noedit` bare flag ignored | ✅ Remains fixed |
| HIGH-v24-7 | Import sanitization missing | ✅ Remains fixed |
| HIGH-v24-8 | SVG2 href check missing | ✅ Remains fixed |
| HIGH-v24-9 | 20-layer hash cap | ✅ Remains fixed |
| HIGH-v24-10 | Missing try/finally context swap | ✅ Remains fixed |
| HIGH-v24-11 | richText cache hash truncation | ✅ Remains fixed |

### v24 Medium Issues — Status

12 of 16 medium issues confirmed fixed. 4 remain open (carried forward).

---

## NEW Issues — v25

### CRITICAL

#### CRIT-v25-1: LayeredFileRenderer References Non-Existent API `action=layersthumbnail`

**Status:** ✅ FIXED (Feb 7, 2026 — replaced with client-side viewer approach using data attributes)
**Severity:** CRITICAL (Dead code path produces non-functional URLs)
**File:** src/Hooks/Processors/LayeredFileRenderer.php (line 236)

**Problem:** `generateLayeredThumbnailUrl()` constructs URLs with
`'action' => 'layersthumbnail'`, but no such API module is registered in
`extension.json`. The five registered modules are: `layersinfo`, `layerssave`,
`layersdelete`, `layersrename`, `layerslist`.

**Verified:** TRUE — confirmed in LayeredFileRenderer.php line 236 and extension.json
APIModules section (lines 210-215).

**Fix:** Either register a `layersthumbnail` API module or remove/replace this
URL generation with the correct endpoint.

---

#### CRIT-v25-2: Callout `tailTipX`/`tailTipY` Not Scaled in Viewer

**Status:** ✅ FIXED (Feb 7, 2026 — added tailTipX/tailTipY scaling in scaleLayerCoordinates)
**Severity:** CRITICAL (Rendering bug — viewer shows wrong callout tail positions)
**File:** resources/ext.layers/LayersViewer.js (scaleLayerCoordinates, lines 558-691)

**Problem:** `scaleLayerCoordinates()` scales many coordinate properties (x, y,
width, height, x1, y1, x2, y2, controlX, controlY, arrowX, arrowY, etc.) but
does NOT scale `tailTipX` or `tailTipY`. Callout layers with custom tail tip
positions render with unscaled tail positions in the viewer, causing tails to
point to wrong locations when the viewer scales the image.

**Verified:** TRUE — grep for `tailTip` in LayersViewer.js returns no matches.

**Fix:** Add scaling:
```javascript
if ( typeof scaled.tailTipX === 'number' ) { scaled.tailTipX *= sx; }
if ( typeof scaled.tailTipY === 'number' ) { scaled.tailTipY *= sy; }
```

---

### HIGH

#### HIGH-v25-1: TextRenderer Rotation Ignores `textAlign`

**Status:** ❌ OPEN
**Severity:** HIGH (Rendering bug)
**File:** resources/ext.layers.shared/TextRenderer.js (lines 205-228)

**Problem:** `ctx.textAlign` is set from `layer.textAlign` (could be `'center'`
or `'right'`), but the rotation center is always calculated as
`centerX = x + (textWidth / 2)`, which assumes left-aligned text. For
center-aligned text, the pivot should be `x`; for right-aligned, `x - textWidth/2`.

**Impact:** Rotated text with non-left alignment rotates around the wrong point,
producing visually incorrect results.

**Verified:** TRUE — confirmed at TextRenderer.js lines 205-228.

---

#### HIGH-v25-2: ToolStyles `SHADOW_OFFSET` Constant Does Not Exist

**Status:** ✅ FIXED (Feb 7, 2026 — changed to SHADOW_OFFSET_X/SHADOW_OFFSET_Y)
**Severity:** HIGH (Bug — shadow offsets become `undefined`)
**File:** resources/ext.layers.editor/tools/ToolStyles.js (lines 53-54)

**Problem:** References `getDefaults().SHADOW_OFFSET` but `LayerDefaults.js`
only defines `SHADOW_OFFSET_X` (line 107) and `SHADOW_OFFSET_Y` (line 114).
No `SHADOW_OFFSET` property exists anywhere in the codebase. Shadow offsets
for new shapes default to `undefined` instead of `2`. Downstream fallbacks in
PropertiesForm mask the visual impact, but the data model is incorrect.

**Verified:** TRUE — confirmed in ToolStyles.js lines 53-54 and LayerDefaults.js.

**Fix:** Replace `.SHADOW_OFFSET` with `.SHADOW_OFFSET_X` and `.SHADOW_OFFSET_Y`.

---

#### HIGH-v25-3: ValidationManager.getMessage() Crashes Without Null Guard

**Status:** ✅ FIXED (Feb 7, 2026 — added null guard returning fallback)
**Severity:** HIGH (Runtime crash potential)
**File:** resources/ext.layers.editor/modules/ValidationManager.js (line 311)

**Problem:** `window.layersMessages.get(key, fallback)` called without null
guard on `window.layersMessages`. Every other module that accesses this global
checks `window.layersMessages && typeof window.layersMessages.get === 'function'`
first. This will throw `TypeError` if the i18n module fails to load or in
test environments.

**Verified:** TRUE — confirmed at ValidationManager.js line 311.

---

#### HIGH-v25-4: CSP Header via Raw `header()` Bypasses MediaWiki

**Status:** ❌ OPEN (carried from MED-v24-3, upgraded)
**Severity:** HIGH (Security — CSP may not apply reliably)
**File:** src/Action/EditLayersAction.php (lines 356-360)

**Problem:** Falls back to raw PHP `header()` when `$out->addExtraHeader()` is
unavailable. Since `addExtraHeader` doesn't exist on standard MediaWiki
`OutputPage`, the fallback always runs. The custom CSP may conflict with
MediaWiki's own CSP settings, and `header()` can fail silently if output
buffering sends headers early.

**Should use:** `$out->getRequest()->response()->header()`.

**Verified:** TRUE — confirmed at EditLayersAction.php lines 356-360.

---

#### HIGH-v25-5: SVG Validation Missing CSS Injection Vectors

**Status:** ❌ OPEN
**Severity:** HIGH (Security defense gap)
**File:** src/Validation/ServerSideLayerValidator.php (~line 1215)

**Problem:** SVG validation checks for `<script`, `javascript:`, and event
handlers, but does NOT block CSS-based vectors in SVG `<style>` elements:
- `expression()` — IE CSS expression execution
- `-moz-binding:url()` — Firefox XBL binding
- `behavior:` — IE HTC behavior
- `@import url()` — external stylesheet injection

**Mitigating factor:** SVGs are stored as data URLs and rendered via Canvas
(not DOM injection), significantly reducing attack surface.

**Verified:** TRUE — `expression(`, `behavior:`, `-moz-binding` not in blocklist.

---

#### HIGH-v25-6: SlideHooks `isValidColor()` Weaker Than ColorValidator

**Status:** ❌ OPEN
**Severity:** MEDIUM (Inconsistency)
**File:** src/Hooks/SlideHooks.php (line 317)

**Problem:** Accepts only 14 named colors, basic hex, and rgb/rgba. No length
limit (ReDoS risk), no HSL/HSLA, no 4-digit hex. Compare with `ColorValidator`
which has 148 named colors, 50-char limit, HSL/HSLA, and range validation.

**Fix:** Replace `SlideHooks::isValidColor()` with `ColorValidator::isValidColor()`.

---

#### HIGH-v25-7: PropertyBuilders — Underline/Strikethrough Mutually Exclusive

**Status:** ✅ FIXED (Feb 7, 2026 — added toggleDecoration() helper for combined values)
**Severity:** MEDIUM (UX limitation)
**File:** resources/ext.layers.editor/ui/PropertyBuilders.js (lines 415-430)

**Problem:** Both underline and strikethrough write `textDecoration` with a
single value. Enabling one removes the other; disabling either sets `'none'`.
Users cannot apply both text decorations simultaneously.

---

#### HIGH-v25-8: PresetManager.SUPPORTED_TOOLS Missing `dimension` and `marker`

**Status:** ✅ FIXED (Feb 7, 2026 — added 'dimension' and 'marker' to SUPPORTED_TOOLS)
**Severity:** MEDIUM (Inconsistency)
**File:** resources/ext.layers.editor/presets/PresetManager.js (lines 637-641)

**Problem:** Static constant doesn't include `'dimension'` or `'marker'`, but
`BuiltInPresets.js` defines presets for both tools and the instance method
`getSupportedTools()` returns them. Code checking the static constant gets
wrong results.

---

### MEDIUM

#### MED-v25-1: 8x `isForeignFile()`/`getFileSha1()` Code Duplication

**Status:** ❌ OPEN (carried from LOW-v24-1, upgraded to MEDIUM)
**Severity:** MEDIUM (Maintenance risk — any fix must be applied in 8 places)

7 standalone implementations + 1 trait. The `ForeignFileHelperTrait` exists
specifically to share this logic but only API modules use it. Hooks, processors,
ThumbnailRenderer, and EditLayersAction each have their own copy.

---

#### MED-v25-2: `enrichWithUserNames()` Duplicated Across 3 Files

**Status:** ❌ OPEN
**Files:** ApiLayersInfo.php, ApiLayersList.php, UIHooks.php

Three different implementations with slightly different logic. Should be
consolidated into a shared trait or utility method.

---

#### MED-v25-3: GradientEditor Accumulates Stale Event Listeners

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/ui/GradientEditor.js (lines 126-128)

`_build()` clears container via `innerHTML = ''` without calling
`eventTracker.destroy()` first. Each color stop add/remove triggers rebuild,
accumulating stale listener entries until the component is fully destroyed.

---

#### MED-v25-4: EffectsRenderer Unconditional Debug `mw.log()` Calls

**Status:** ✅ FIXED (Feb 7, 2026 — guarded with wgLayersDebug check)
**File:** resources/ext.layers.shared/EffectsRenderer.js (lines 215, 226, 399, 413)

Four `mw.log()` calls (not `mw.log.warn()`) fire on every blur fill render
unconditionally, creating console spam during normal panning/zooming.

---

#### MED-v25-5: CanvasRenderer `getBackgroundVisible()` Missing `!== 0` Check

**Status:** ✅ FIXED (Feb 7, 2026 — added visible !== 0 check)
**File:** resources/ext.layers.editor/CanvasRenderer.js (line 363)

Defensive gap — `return visible !== false` without `visible !== 0`. Currently
safe because upstream normalizes, but violates the project's documented pattern.

---

#### MED-v25-6: ext.layers Module Loaded on Every Page View (2x)

**Status:** ❌ OPEN (carried from MED-v24-2)
**File:** src/Hooks.php (~L88 and ~L262)

`addModules('ext.layers')` called unconditionally in both `onBeforePageDisplay()`
AND `onMakeGlobalVariablesScript()`. Forces viewer JS on every wiki page.

---

#### MED-v25-7: APIManager `reloadRevisions` Wrong Catch Signature

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/APIManager.js (line 1130)

`.catch()` uses `(error) =>` but `mw.Api` rejection passes `(code, data)`.
The error handler receives the error code string, not an Error object.

---

#### MED-v25-8: PropertiesForm Validation Errors Hardcoded English

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/ui/PropertiesForm.js (lines 195-220)

Validation messages like `'This field is required'`, `'Please enter a valid
number'` are not internationalized. Should use `msg()` with i18n keys.

---

#### MED-v25-9: SelectionManager `selectAll()` Fallback Path Doesn't Filter

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/SelectionManager.js (lines 341-343)

Main path correctly filters locked/invisible layers via SelectionState. Fallback
path (when `_selectionState` is null) selects ALL layers without filtering.

---

### LOW

| ID | Issue | File | Notes |
|----|-------|------|-------|
| LOW-v25-1 | Dead `$viewUrl` variable | UIHooks.php ~L472 | Assigned, never used |
| LOW-v25-2 | 5+ inconsistent `getClass()` implementations | Multiple modules | Varying sophistication |
| LOW-v25-3 | ConfirmDialog.js indentation inconsistency | ConfirmDialog.js | Constructor 2 tabs, methods 1 tab |
| LOW-v25-4 | Duplicate JSDoc for `destroy()` | StateManager.js | Two consecutive doc blocks |
| LOW-v25-5 | Stream-of-consciousness comments | CanvasRenderer.js ~L570 | Debug notes, not architectural docs |
| LOW-v25-6 | Triplicated checker pattern code | CanvasRenderer.js | Dimension inconsistency between methods |
| LOW-v25-7 | `_computeLayerHash()` temp arrays per frame | CanvasRenderer.js | O(n) string concat per layer per render |
| LOW-v25-8 | GroupManager O(n×m) `getGroupChildren()` | GroupManager.js | `find()` in loop; use Map |
| LOW-v25-9 | DimensionRenderer no shadow support | DimensionRenderer.js | All other renderers support shadow |
| LOW-v25-10 | `GradientRenderer` wrong namespace depth | GradientRenderer.js | 3 levels vs. 2 for all others |
| LOW-v25-11 | `document.execCommand()` deprecated | InlineTextEditor.js | No modern alternative yet |

---

## Performance Issues

| ID | Severity | Issue | File |
|----|----------|-------|------|
| PERF-1 | HIGH | TextRenderer shadow spread O(n) fillText calls vs. offscreen canvas | TextRenderer.js L247-269 |
| PERF-2 | MEDIUM | SelectionManager uses JSON deep clone instead of efficient clone | SelectionManager.js ~L1092 |
| PERF-3 | MEDIUM | LayersViewer JSON clone for gradient/richText per frame | LayersViewer.js ~L532 |
| PERF-4 | LOW | Checker pattern individual rectangles (should use createPattern) | CanvasRenderer.js ~L550 |
| PERF-5 | LOW | ViewerManager queries all `<img>` elements on page | ViewerManager.js ~L410 |
| PERF-6 | LOW | LayersViewer recomputes scale per layer (compute once) | LayersViewer.js ~L502 |
| PERF-7 | LOW | Layer hash creates temporary arrays per layer per frame | CanvasRenderer.js ~L165 |

---

## Security Controls Status (v25)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All write APIs require tokens |
| SQL Injection | ✅ PASS | 100% parameterized queries |
| Input Validation | ✅ PASS | Strict whitelist; setname sanitized |
| Rate Limiting | ✅ PASS | Registered via onRegistration() in Hooks.php |
| Authorization | ✅ PASS | Owner/admin for writes; API framework for reads |
| XSS via Canvas | ✅ PASS | `ctx.fillText` inherently safe |
| Text Sanitization | ✅ PASS | Iterative protocol removal + `@` stripped for IM |
| CSP | ⚠️ PARTIAL | Custom header via raw `header()` may conflict with MW CSP |
| SVG Sanitization | ⚠️ PARTIAL | Checks href/xlink:href; missing CSS injection vectors |
| Server File Access | ✅ PASS | IM `@` file disclosure fixed |
| Data Normalization | ✅ PASS | Boolean/type normalization in LayerDataNormalizer |

---

## God Class Status (21 files >= 1,000 lines)

### Generated Data (Exempt — 2 files)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (17 files)

| File | Lines |
|------|-------|
| LayerPanel.js | 2,180 |
| CanvasManager.js | 2,053 |
| Toolbar.js | 1,891 |
| LayersEditor.js | 1,836 |
| InlineTextEditor.js | 1,672 |
| APIManager.js | 1,575 |
| PropertyBuilders.js | 1,464 |
| SelectionManager.js | 1,415 |
| CanvasRenderer.js | 1,390 |
| ViewerManager.js | 1,320 |
| ToolManager.js | 1,214 |
| GroupManager.js | 1,207 |
| SlideController.js | 1,131 |
| TransformController.js | 1,117 |
| LayersValidator.js | 1,116 |
| ResizeCalculator.js | 1,017 |
| ShapeRenderer.js | 1,010 |

### PHP (2 files)

| File | Lines |
|------|-------|
| LayersDatabase.php | 1,364 |
| ServerSideLayerValidator.php | 1,348 |

### Near-Threshold (< 1,000 lines)

| File | Lines |
|------|-------|
| ToolbarStyleControls.js | 998 |
| TextBoxRenderer.js | 996 |
| PropertiesForm.js | 994 |
| ArrowRenderer.js | 974 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 961 |

---

## Recommendations

### Immediate (This Week)

1. **CRIT-v25-1:** Fix or remove `action=layersthumbnail` reference in `LayeredFileRenderer.php`
2. **CRIT-v25-2:** Add `tailTipX`/`tailTipY` scaling in `LayersViewer.scaleLayerCoordinates()`

### Priority 2 (Next Sprint)

3. **HIGH-v25-1:** Fix TextRenderer rotation center for non-left textAlign
4. **HIGH-v25-2:** Fix ToolStyles SHADOW_OFFSET → SHADOW_OFFSET_X/Y
5. **HIGH-v25-3:** Add null guard to ValidationManager.getMessage()
6. **HIGH-v25-4:** Fix CSP header to use MediaWiki response abstraction
7. **HIGH-v25-5:** Add CSS injection vectors to SVG blocklist
8. **HIGH-v25-6:** Replace SlideHooks::isValidColor() with ColorValidator
9. **MED-v25-1:** Consolidate `isForeignFile()` (8 copies → 1 trait)

### Priority 3 (Ongoing)

11. Fix 51 documentation issues (see KNOWN_ISSUES.md)
12. Address performance issues (PERF-1 TextRenderer shadow spread is highest priority)
13. Continue god class reduction (Toolbar.js, PropertyBuilders.js best candidates)
14. Internationalize PropertiesForm validation messages

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test coverage
(95.19%), modern ES6 architecture, comprehensive server-side validation, and
proper CSRF/SQL injection protection. All v24 CRITICAL and HIGH issues were
properly resolved.

The v25 review identifies **2 critical issues** (phantom API endpoint,
callout scaling), **8 high-priority bugs** (TextRenderer
rotation, shadow offset constant, CSP, SVG gaps), and **51 documentation
issues**. The phantom API reference in `LayeredFileRenderer.php`
generates non-functional URLs for layered file parser functions.

Note: `SlideManager.js` contains a wrong namespace reference
(`window.LayerRenderer` → should be `window.Layers.LayerRenderer`)
but is not registered in any ResourceLoader module and is dead code.
Production slide rendering uses `SlideController.js` which has the
correct namespace lookup.

The god class count has increased from 19 (documented) to **21** (actual) with
`ResizeCalculator.js` (1,017 lines) and `ShapeRenderer.js` (1,010 lines)
crossing the 1,000-line threshold. Documentation across the project has
significant drift — line counts, version highlights, and cross-document
status contradictions require a focused documentation sprint.

**Overall Grade:** B+ (strong core; phantom API and
documentation drift prevent A-)

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|---------|
| v25 | 2026-02-07 | B+ | Independent re-audit on main; 2 CRIT, 8 HIGH, 9 MED, 11 LOW code issues; 51 doc issues |
| v24 | 2026-02-07 | B→A- | Deep audit; 4 CRIT (2 false positive), 11 HIGH found and fixed |
| v23 | 2026-02-06 | A- | Previous review (overly optimistic) |
| v22 | 2026-02-05 | B+ | Initial comprehensive review |
