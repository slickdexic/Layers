# Known Issues

**Last Updated:** February 2, 2026 (Comprehensive Critical Review v10)  
**Version:** 1.5.49

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None |
| P1 (High Priority) | **1** | ⚠️ Version sync issue |
| P2 (Medium Priority) | **2** | ⚠️ Documentation metrics |
| P3 (Low Priority) | **2** | ⚠️ Code style |
| Feature Gaps | 3 | Backlog |

---

## ⚠️ Open Issues (v10 Review)

### P1.1 Widespread Version Inconsistencies (NEW)

**Status:** ⚠️ OPEN  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Version was bumped to 1.5.49 in extension.json but not propagated to other files.

**Files requiring update to 1.5.49:**
- README.md (line 11)
- Mediawiki-Extension-Layers.mediawiki (lines 11, 124, 126, 128)
- wiki/Home.md (lines 23, 297-299)
- wiki/Installation.md (lines 19-21)
- docs/ARCHITECTURE.md (line 4)
- docs/GOD_CLASS_REFACTORING_PLAN.md (line 15)
- improvement_plan.md (line 4)
- LayersNamespace.js (line 19) - const VERSION = '1.5.47'

**Impact:** MediaWiki.org extension page shows wrong version.

**Fix:** Update all files to 1.5.49.

---

### P2.1 Test Count/Coverage Documentation Mismatch (NEW)

**Status:** ⚠️ OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Documentation shows outdated test metrics:

| Metric | Documentation | Actual |
|--------|--------------|--------|
| Test count | 11,157 | 11,183 |
| Test suites | 163 | 164 |
| Statement coverage | 95.44% | 95.19% |
| Branch coverage | 85.20% | 84.96% |

**Impact:** Misleading quality metrics in 20+ documentation files.

**Fix:** Update all documentation with current test values.

---

### P2.2 i18n Message Count Inconsistency (NEW)

**Status:** ⚠️ OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Documentation shows inconsistent i18n counts (667 vs 750).

**Fix:** Audit en.json and standardize count across all docs.

---

### P3.1 const self = this Anti-Pattern

**Resolution (v9.1):** Refactored 9 instances to use arrow functions:
- LayersEditor.js (1) → arrow functions
- SlideController.js (6) → arrow functions
- ViewerManager.js (2) → arrow functions

**Remaining (legitimate uses - 4 instances):**
- VirtualLayerList.js (1) - throttle function needs two `this` contexts
- ShapeLibraryPanel.js (3) - prototype pattern requires full class migration

**Impact:** Minor code style inconsistency in remaining files.

---

### P3.7 LayersLightbox Click Handler Cleanup

**Status:** ✅ RESOLVED (v9.1)  
**Severity:** P3 (Low)  
**Component:** Memory Management

**Issue:** The `close()` method removed `boundKeyHandler` explicitly but not `boundClickHandler`.

**Resolution (v9.1):** Added explicit `removeEventListener` call for `boundClickHandler`.

**Impact:** None functional (handler was garbage collected with DOM element anyway).

**Recommendation:** Add explicit `removeEventListener` for consistency.

---

### P3.8 APIManager Promise Handling on Abort

**Status:** ⚠️ OPEN (by design)  
**Severity:** P3 (Low)  
**Component:** API Error Handling

**Issue:** When API requests are aborted, the Promise neither resolves nor rejects.

**Impact:** Callers using `await` on aborted requests will hang indefinitely.

**Note:** This is intentional behavior - aborted requests indicate the user changed context.

**Recommendation:** Consider resolving with `undefined` or rejecting with an `AbortError`.

---

## ✅ P1: High Priority Issues — ALL RESOLVED

### ~~P1.1 ApiSlidesSave.php — Dead Code~~

**Status:** ✅ FIXED (DELETED)  
**Resolution:** File deleted. Dead code no longer exists in the repository.

---

### ~~P1.2 ApiSlideInfo.php — Dead Code~~

**Status:** ✅ FIXED (DELETED)  
**Resolution:** File deleted. Dead code no longer exists in the repository.

---

## ✅ P2: Medium Priority Issues — ALL RESOLVED

### ~~P2.1 Missing Boolean Properties in preserveLayerBooleans~~

**Status:** ✅ FIXED  
**Resolution:** All 12 boolean properties are now included in the array.  
**Verified:** src/Api/ApiLayersInfo.php lines 366-369.

---

### ~~P2.2 InlineTextEditor Not in CanvasManager Destroy List~~

**Status:** ✅ FIXED  
**Resolution:** inlineTextEditor is now included in controllersToDestroy array.  
**Verified:** resources/ext.layers.editor/CanvasManager.js line 1971.

---

### ~~P2.3 ApiLayersRename Lacks Slide Support~~

**Status:** ✅ FIXED  
**Resolution:** executeSlideRename() method implemented.  
**Verified:** src/Api/ApiLayersRename.php lines 56-68 and 272-330.

---

### ~~P2.4 Documentation Version Inconsistencies~~

**Status:** ✅ FIXED  
**Resolution:** All documentation files now show v1.5.47.

---

### ~~P2.5 Font Family Validation Too Restrictive~~

**Status:** ✅ FIXED  
**Resolution:** Font validation now allows any sanitized font name.  
**Verified:** src/Validation/ServerSideLayerValidator.php lines 502-506.

---

### ~~P2.6 wiki/Changelog.md Missing Entries~~

**Status:** ✅ FIXED  
**Resolution:** wiki/Changelog.md is now synchronized with CHANGELOG.md.

---

### ~~P2.7 Branch Version Table Inconsistencies~~

**Status:** ✅ FIXED  
**Resolution:** All branch version references are now consistent.

---

## ⚠️ P3: Low Priority Issues (6 Open)

### P3.1 Inconsistent API Error Codes

**Status:** ✅ FIXED (v7 session 2)  
**Severity:** P3 (Low)  
**Component:** API Modules

**Issue:** Minor inconsistency in error codes for "layer set not found":
- ApiLayersInfo.php: used 'layersetnotfound' → now uses 'setnotfound'
- ApiLayersDelete.php, ApiLayersRename.php: use 'setnotfound'

**Resolution:** Standardized to 'setnotfound' in ApiLayersInfo.

**Files:** src/Api/ApiLayersInfo.php lines 125, 131

---

### P3.2 ApiLayersInfo Lacks Rate Limiting

**Status:** ✅ FIXED (v7 session 2)  
**Severity:** P3 (Low)  
**Component:** API Security

**Issue:** Unlike write operations, the read endpoint did not apply rate limiting.

**Resolution:** Added rate limiting via createRateLimiter() and checkRateLimit('info').

**Files:** src/Api/ApiLayersInfo.php

---

### P3.3 ApiLayersInfo Lacks Global Exception Handler

**Status:** ✅ FIXED (v7 session 2)  
**Severity:** P3 (Low)  
**Component:** API Error Handling

**Issue:** The main execute() method did not have a global try/catch block.

**Resolution:** Wrapped main logic in try/catch with generic error response. Added ERROR_INFO_FAILED constant and i18n message.

**Files:** src/Api/ApiLayersInfo.php

---

### P3.4 Silent Catch Blocks

**Status:** ✅ RESOLVED (v7 session 2)  
**Severity:** P3 (Low)  
**Component:** JavaScript Error Handling

**Issue:** Originally reported as silent catch blocks making debugging difficult.

**Investigation Results:**
- localStorage checks (DraftManager.js, ToolDropdown.js) - **intentionally silent** (standard browser feature detection pattern)
- Clipboard operations (ToolbarStyleControls.js) - **intentionally silent** (clipboard may not be available)
- Canvas operations (EffectsRenderer.js) - **already has logging** via mw.log.warn()
- Feature detection (ValidationManager.js) - **intentionally silent** (purpose is to detect availability)

**Resolution:** No changes needed. Silent catches are either intentional for feature detection or already have proper logging.

---

### P3.5 Magic Numbers

**Status:** ⚠️ OPEN  
**Severity:** P3 (Low)  
**Component:** Code Quality

**Issue:** 11+ hardcoded numeric values without named constants:
- fontSize: 16 appears in multiple files
- shadowBlur: 64 max value inline
- Slide dimension limits (50, 4096) inline

**Recommendation:** Extract to LayersConstants.js for maintainability.

---

### P3.6 const self = this Anti-Pattern

**Status:** ⚠️ OPEN  
**Severity:** P3 (Low)  
**Component:** Code Style

**Issue:** Despite using ES6 classes, 7+ files use const self = this instead of arrow functions.

**Impact:** Code style inconsistency.

**Recommendation:** Refactor to arrow functions during future maintenance.

---

## ⏳ Feature Gaps

### F1. Enhanced Dimension Tool

**Status:** ⏳ PROPOSED

Make the dimension line draggable independently from the anchor points.

---

### F2. Angle Dimension Tool

**Status:** ⏳ PROPOSED

New tool for measuring and annotating angles.

---

### F3. Custom Variable Fonts

**Status:** ⏳ PROPOSED

Support for variable font axes (weight, width, slant) in text layers.

---

## ✅ Previously Resolved Issues

All issues from previous reviews (v1-v6) are now resolved:

- **Dead code files** (ApiSlidesSave.php, ApiSlideInfo.php) — Deleted
- **Boolean serialization** — All 12 properties preserved
- **Memory leaks** — inlineTextEditor in destroy list
- **Slide rename support** — executeSlideRename() implemented
- **Font validation** — Allows any sanitized font name
- **Documentation consistency** — All files synchronized

---

## Test Coverage Status (February 2, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests total | **11,183** (164 suites) | ✅ |
| Tests passing | **11,183** | ✅ All pass |
| Tests failing | **0** | ✅ |
| Statement coverage | **95.19%** | ✅ Excellent |
| Branch coverage | **84.96%** | ✅ Good |
| Function coverage | **93.67%** | ✅ Excellent |
| Line coverage | **95.32%** | ✅ Excellent |

---

## Code Quality Metrics (Verified February 2, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | **142** (140 source + 2 dist) | ✅ |
| PHP files | **42** | ✅ |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| ESLint disables | 11 | All legitimate |
| i18n messages | **749** | All documented |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |
| Dead code files | 0 | ✅ All deleted |

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

*Document updated: February 2, 2026 (Comprehensive Critical Review v7, Session 2)*  
*Status: 0 P1/P2 issues, 2 P3 issues remaining.*  
*Overall Rating: 9.5/10*
