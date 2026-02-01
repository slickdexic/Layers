# Known Issues

**Last Updated:** February 1, 2026 (Comprehensive Critical Review v4)  
**Version:** 1.5.45

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ All resolved |
| P1 (High Priority) | **0** | ✅ All resolved |
| P2 (Medium Priority) | **0** | ✅ All resolved |
| P3 (Low Priority) | **7** | 🟢 Low priority backlog |
| Feature Gaps | 3 | Planned |

---

## ✅ P1: High Priority Issues — ALL RESOLVED

### P1.3 Missing Enum Validation for Constrained String Properties

**Status:** ✅ RESOLVED (January 31, 2026)  
**Severity:** P1 (High)  
**Component:** ServerSideLayerValidator / Security

**Issue:** The `VALUE_CONSTRAINTS` constant defined allowed values for 15 enum-like properties, but only 9 were validated. Fixed in v1.5.44.

**Resolution:** Added all 8 missing properties (`tailDirection`, `tailStyle`, `style`, `endStyle`, `textPosition`, `orientation`, `textDirection`, `toleranceType`) to the validation check in `validateStringProperty()`.

**Files:** `src/Validation/ServerSideLayerValidator.php` lines 510-519

---

## ✅ P1: Previously Resolved Issues

All critical bugs identified in previous reviews have been resolved.
All **11,157** tests pass as of February 1, 2026.

---

## ✅ P1: Previously Resolved High Priority Issues

All high priority issues from previous reviews have been resolved:

| Issue | Resolution Date |
|-------|-----------------|
| Race condition in saveLayerSet | January 31, 2026 |
| Missing permission check in ApiLayersList | January 31, 2026 |
| Documentation metrics drift | January 30, 2026 |
| MediaWiki version inconsistency | January 30, 2026 |

---

## ✅ P2: Medium Priority Issues — ALL RESOLVED

### P2.19 ZoomPanController Animation Frame Not Canceled ✅

**Status:** ✅ RESOLVED (February 1, 2026)  
**Severity:** P2 (Medium)  
**Component:** ZoomPanController / Animation

**Issue:** `smoothZoomTo()` starts a new animation via `requestAnimationFrame` without canceling any existing animation. Rapid zoom operations can cause multiple animation loops running simultaneously, causing jittery zoom behavior.

**Resolution:** Added `cancelAnimationFrame(this.animationFrameId)` before starting new animation.

**Files:** `resources/ext.layers.editor/canvas/ZoomPanController.js` line 155

---

### P2.20 TransformController Stale Layer Reference in rAF ✅

**Status:** ✅ RESOLVED (February 1, 2026)  
**Severity:** P2 (Medium)  
**Component:** TransformController / Race Condition

**Issue:** `_pendingResizeLayer` may become stale if the layer is deleted between scheduling the rAF and execution. The callback emits events with potentially invalid layer references.

**Resolution:** Added layer existence validation in rAF callback using `this.manager.editor.layers.some((l) => l.id === layerId)` before emitting transform events.

**Files:** `resources/ext.layers.editor/canvas/TransformController.js` lines 213-227

---

### P2.21 Version Inconsistency in Mediawiki-Extension-Layers.mediawiki ✅

**Status:** ✅ RESOLVED (February 1, 2026)  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Version info box at top shows 1.5.44, but the branch version table shows 1.5.43.

**Resolution:** Updated all version references to 1.5.45 for consistency.

**Files:** `Mediawiki-Extension-Layers.mediawiki`

---

### P2.1 Untracked Timeouts in SlideController ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** Already implemented - `_retryTimeouts` array tracks IDs, `destroy()` clears all.

---

### P2.2 Untracked Event Listeners in ToolDropdown ✅ RESOLVED

**Status:** ✅ RESOLVED (v1.5.44)  
**Resolution:** Added `boundHandleTriggerClick` and `_menuItemHandlers` Map.

---

### P2.3 VirtualLayerList rAF Callback Missing Destroyed Check ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** `if (this.destroyed) return;` check added at line 239.

---

### P2.4 Inconsistent Set Name Validation Standards ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** ApiLayersRename now uses SetNameSanitizer consistently.

---

### P2.5 Slide Name Not Validated in ApiLayersSave ✅ RESOLVED

**Status:** ✅ RESOLVED (January 31, 2026)  
**Resolution:** SlideNameValidator now validates slidename before processing.

---

### P2.6 Promise Constructor Anti-Pattern in APIManager ✅ RESOLVED

**Status:** ✅ RESOLVED (Verified as valid pattern)  
**Resolution:** Pattern is legitimate - enables request tracking, abort support.

---

### P2.7 Aborted Request Handling Shows Spurious Errors ✅ RESOLVED

**Status:** ✅ RESOLVED (Already implemented)  
**Resolution:** Both `loadRevision()` and `loadSetByName()` include abort detection.

---

### P2.8 Inconsistent Logger Usage in API Modules ✅ RESOLVED

**Status:** ✅ RESOLVED (v1.5.44)  
**Resolution:** Replaced `LoggerFactory::getInstance()` with `$this->getLogger()`.

---

### P2.9 Inconsistent Database Method Return Types ✅ RESOLVED

**Status:** ✅ RESOLVED (Documentation issue - code is consistent)  
**Resolution:** Database methods follow MediaWiki standard patterns. `false` for not-found in `getLayerSet()`, `null` for not-found in `getLayerSetByName()`, `-1` for error in `countNamedSets()` all align with MediaWiki conventions.

---

## 🟢 P3: Low Priority Issues (7 Open)

### P3.1 SchemaManager Global Service Access

**Status:** 🟡 OPEN  
**Severity:** P3 (Low)  
**Component:** Architecture

**Issue:** Uses `MediaWikiServices::getInstance()` in constructor,
making unit testing harder.

**Fix:** Inject logger via constructor.

---

### P3.2 Hardcoded Transaction Timeout Values

**Issue:** 3 retries, 5000ms timeout hardcoded in LayersDatabase.

**Status:** Acceptable defaults but could be configurable.

---

### P3.3 TINYINT for ls_layer_count Column

**Issue:** Max 255; should be smallint for future-proofing.

**Fix:** Add schema patch to change to smallint.

---

### P3.4 Inconsistent @codeCoverageIgnore Usage

**Issue:** Some unreachable returns annotated, others not.

**Fix:** Standardize usage across all API modules.

---

### P3.5 Empty String Boolean Normalization

**Issue:** Client normalizes `''` → `true` (legacy path, dead code).

**Fix:** Remove dead code path (low priority).

---

### P3.6 CHECK Constraints Hardcoded in SQL

**Issue:** SQL CHECK constraints don't match PHP config values.

**Fix:** Document dependency or remove CHECK constraints.

---

### P3.7 Missing null Check in extractLayerSetData

**Status:** ✅ RESOLVED (February 1, 2026)

**Issue:** Potential null access in edge cases.

**Resolution:** `extractLayerSetData()` already handles null/undefined input safely with early return.

---

### P3.8 $prefix in listSlides() Not Length-Limited

**Status:** ✅ RESOLVED (February 1, 2026)

**Issue:** Very long prefix could cause performance issues.

**Resolution:** Added `if (strlen($prefix) > 200) { $prefix = substr($prefix, 0, 200); }` at line 1198.

---

### P3.9 Unused ALLOWED_ENTITIES Constant

**Status:** ✅ RESOLVED (February 1, 2026)

**Issue:** TextSanitizer defines ALLOWED_ENTITIES but never uses it.

**Resolution:** Constant was already removed. TextSanitizer.php no longer contains this constant.

---

### P3.10 Inconsistent Class Resolution Patterns

**Issue:** Some files use `window.layersGetClass`, others use
`window.Layers.Utils.getClass`.

**Fix:** Standardize to single pattern.

---

### P3.11 Inefficient Class Resolution in LayersNamespace

**Issue:** `findClass()` traverses namespace path repeatedly without caching.

**Fix:** Add cache for resolved classes.

---

### P3.12 JSON Fallback for Layer Cloning

**Issue:** Fallback to JSON.parse/stringify is expensive for large base64 images.

**Fix:** Improve DeepClone to handle all cases without JSON fallback.

---

### P3.13 getBoundingClientRect Unchecked

**Status:** ✅ RESOLVED (February 1, 2026)

**Issue:** Canvas getBoundingClientRect could return zero dimensions if not in DOM.

**Resolution:** Added defensive guard in `GeometryUtils.clientToCanvas()` that returns canvas center if rect has zero dimensions.

---

### P3.14 Information Disclosure in Error Logging

**Issue:** User IDs + filenames logged together could enable correlation.

**Fix:** Consider hashing user identifiers in logs.

---

## ⏳ Feature Gaps

### F1. Custom Fonts (F3)

**Status:** ⏳ NOT STARTED

Not yet available beyond the default font allowlist in `$wgLayersDefaultFonts`.

---

### F2. Enhanced Dimension Tool (FR-14)

**Status:** ⏳ PROPOSED

Make the dimension line draggable independently from the anchor points.

---

### F3. Angle Dimension Tool (FR-15)

**Status:** ⏳ PROPOSED

New tool for measuring and annotating angles.

---

## ✅ Recently Resolved Issues (January 2026)

| Issue | Date | Notes |
|-------|------|-------|
| Race condition in saveLayerSet | Jan 31 | FOR UPDATE inside transaction |
| ApiLayersList permission check | Jan 31 | read + rate limiting added |
| isComplexityAllowed() coverage | Jan 31 | All 15 layer types |
| listSlides() SQL refactored | Jan 31 | Batch queries |
| ApiLayersList rate limiting | Jan 31 | pingLimiter added |
| paths array limit validation | Jan 31 | Max 100 paths |
| TailCalculator test failing | Jan 30 | Bounds check added |
| N+1 query patterns | Jan 30 | Batch refactoring |
| LIKE query escaping | Jan 30 | buildLike() used |
| API code duplication | Jan 30 | LayersApiHelperTrait |
| refreshAllViewers parallelism | Jan 31 | Limited to 5 |
| Magic complexity threshold | Jan 31 | Configurable |

---

## Test Coverage Status (February 1, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests total | **11,157** (163 suites) | ✅ |
| Tests passing | **11,157** | ✅ All pass |
| Tests failing | **0** | ✅ |
| Statement coverage | **95.44%** | ✅ Excellent |
| Branch coverage | **85.20%** | ✅ Good |
| Function coverage | **93.75%** | ✅ Excellent |
| Line coverage | **95.56%** | ✅ Excellent |

---

## Code Quality Metrics (Verified February 1, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | **141** (139 source + 2 dist) | ✅ |
| PHP files | **42** | ✅ |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| Near-threshold files (900-999) | 9 | ⚠️ Watch |
| innerHTML usages | 73 | Safe patterns |
| ESLint disables | 11 | All legitimate |
| i18n messages | **667** | All documented |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✅ Fully supported |
| Firefox | 120+ | ✅ Fully supported |
| Safari | 17+ | ✅ Fully supported |
| Edge | 120+ | ✅ Fully supported |

---

## Performance Recommendations

| Resource | Recommended | Maximum |
|----------|-------------|---------|
| Image size | < 2048px | 4096px |
| Layer count | < 50 | 100 |
| Layer set size | < 1MB | 2MB |
| Imported image size | < 500KB | 1MB |

---

## Reporting Issues

If you encounter issues:

1. Check this document first
2. Search existing [GitHub issues](https://github.com/slickdexic/Layers/issues)
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and MediaWiki version
   - Console errors (F12 → Console tab)
   - Screenshots if applicable

---

*Document updated: February 1, 2026 (Comprehensive Critical Review v4)*  
*Status: ✅ All tests passing. No P0 or P1 bugs. All critical issues resolved.*
