# Known Issues

**Last Updated:** February 4, 2026 (Comprehensive Critical Review v15)  
**Version:** 1.5.51

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None |
| P1 (High Priority) | **0** | ✅ All fixed |
| P2 (Medium Priority) | **0** | ✅ All fixed |
| P3 (Low Priority) | **2** | ⚠️ Code patterns (deferred) |
| Feature Gaps | 3 | Backlog |

---

## ✅ Fixed Issues (v15 Review)

### P1.1 JS File Count Wrong in Documentation

**Status:** ✅ FIXED (v15 review)  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Multiple documentation files claimed 142 JS files, but actual count was **140 files**.

**Resolution:** Updated `.github/copilot-instructions.md` and `docs/ARCHITECTURE.md` to correct file counts.

---

### P1.2 Version Number Wrong in copilot-instructions.md

**Status:** ✅ FIXED (v15 review)  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** `.github/copilot-instructions.md` showed version 1.5.49 but extension.json showed 1.5.51.

**Resolution:** Updated to 1.5.51.

---

### P2.1 PHP File Count Wrong in Documentation

**Status:** ✅ FIXED (v15 review)  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** `.github/copilot-instructions.md` showed 42 PHP files but actual was **40 files**.

**Resolution:** Updated to correct count.

---

### P2.2 JS Line Count Inconsistent in Documentation

**Status:** ✅ FIXED (v15 review)  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Documentation showed various JS line counts (~95,433) but actual was **~96,498 lines**.

**Resolution:** Updated to correct line count.

---

### P2.3 Dead Code - LayersFileTransform::hasLayers()

**Status:** ✅ FIXED (v15 review)  
**Severity:** P2 (Medium)  
**Component:** src/LayersFileTransform.php

**Issue:** The `hasLayers()` method incorrectly created `LayersDatabase` without required constructor arguments. This method was never called (dead code).

**Resolution:** Deleted `hasLayers()`, `getFileSha1()`, and `isForeignFile()` methods (64 lines of dead code removed). The proper implementations exist in `ForeignFileHelperTrait`.

---

### P3.1 SelectionManager.applyDrag Inconsistent with Production

**Status:** ✅ FIXED (v15 review)  
**Severity:** P3 (Low)  
**Component:** resources/ext.layers.editor/SelectionManager.js

**Issue:** `SelectionManager.applyDrag()` moved arrowX/arrowY with marker layers, but `TransformController` (the production path) intentionally does NOT move them.

**Resolution:** Removed the arrowX/arrowY moving code from `applyDrag()` to match production behavior. Updated test expectations to verify arrow position independence.

---

### P3.2 const self = this Anti-Pattern

**Status:** ⚠️ OPEN  
**Severity:** P3 (Low)  
**Component:** Code Style

**Remaining instances (4 total in 2 files):**

| File | Count | Reason |
|------|-------|--------|
| VirtualLayerList.js | 1 | Throttle function needs two `this` contexts |
| ShapeLibraryPanel.js | 3 | Prototype pattern - requires ES6 class migration |

---

### P3.3 Weak Test Assertions

**Status:** ✅ FIXED (v15 review)  
**Severity:** P3 (Low)  
**Component:** Test files

**Issue:** 5 tests used `toBeTruthy()`/`toBeFalsy()` which can mask bugs.

**Resolution:**
- SlideController.test.js line 83: Changed `toBeFalsy()` → `toBe(false)`
- SlideController.test.js line 1266: Changed `toBeTruthy()` → `not.toBeNull()`
- LayerPanel.test.js line 3759: Changed `toBeTruthy()` → `toBeDefined()`
- LayerPanel.test.js line 3944: Changed `toBeTruthy()` → `not.toBeNull()`
- InlineTextEditor.test.js line 426: Kept `toBeFalsy()` with comment (intentional - method returns `null` for null input via short-circuit evaluation)

---

### P3.4 APIManager Promise Handling on Abort

**Status:** ⚠️ OPEN (by design)  
**Severity:** P3 (Low)  
**Component:** API Error Handling

**Issue:** When API requests are aborted, the Promise neither resolves nor rejects.

**Note:** This is intentional — aborted requests indicate context change.

---

## ✅ Fixed in v1.5.51 (v13→v14 Review)

### ~~P1.1 Version Mismatch in Mediawiki-Extension-Layers.mediawiki~~ ✅

**Status:** ✅ FIXED in v1.5.51  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Branch selection table showed version 1.5.49 for main branch.

**Resolution:** Updated to 1.5.51.

---

### ~~P2.1 Version Mismatch in docs/ARCHITECTURE.md~~ ✅

**Status:** ✅ FIXED in v1.5.51  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Header showed version 1.5.49 but extension.json showed 1.5.50.

**Resolution:** Updated to 1.5.51.

---

### ~~P2.2 File Count Inconsistencies Across Documentation~~ ✅

**Status:** ✅ FIXED in v1.5.51  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Different documentation files showed different file counts.

**Resolution:** Standardized on verified counts (142 JS, 40 PHP).

---

## ✅ Recently Fixed (v12 Review)

### P1.1 Test Count Documentation Inconsistencies ✅

**Status:** ✅ RESOLVED (February 3, 2026)  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** 5 documentation files showed "11,183" instead of verified **11,210 tests in 165 suites**.

**Resolution:** Updated README.md, CONTRIBUTING.md, CHANGELOG.md, .github/copilot-instructions.md, wiki/Home.md

---

## ✅ Previously Fixed (v11 Review)

### P1.1 $wgLayersDebug Documentation Default Incorrect

**Status:** ✅ FIXED  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Documentation claimed `$wgLayersDebug` defaults to `true`, but the actual
default in `extension.json` is `false`.

**Resolution:** Fixed `.github/copilot-instructions.md` line 241 to show correct default.
Note: `Mediawiki-Extension-Layers.mediawiki` already showed the correct value (`false`).

---

### P2.1 Missing Client-Side Slide Canvas Dimension Validation

**Status:** ✅ FIXED  
**Severity:** P2 (Medium)  
**Component:** SlideManager.js

**Issue:** The `setCanvasDimensions(width, height)` method accepted any values
without validation. Extremely large values could crash the browser.

**Resolution:** Added validation in `SlideManager.js`:
```javascript
setCanvasDimensions(width, height) {
    const MIN_DIM = 50;
    const MAX_DIM = 4096;
    this.canvasWidth = Math.max(MIN_DIM, Math.min(MAX_DIM, parseInt(width, 10) || 800));
    this.canvasHeight = Math.max(MIN_DIM, Math.min(MAX_DIM, parseInt(height, 10) || 600));
    // ...uses validated values throughout
}
```

---

### P3.1 const self = this Anti-Pattern

**Status:** ⚠️ OPEN  
**Severity:** P3 (Low)  
**Component:** Code Style

**Remaining instances (4 total in 2 files):**

| File | Count | Reason |
|------|-------|--------|
| VirtualLayerList.js | 1 | Throttle function needs two `this` contexts |
| ShapeLibraryPanel.js | 3 | Prototype pattern requires full ES6 class migration |

**Impact:** Minor code style inconsistency in remaining files.

**Resolution:** Deferred — requires significant refactoring.

---

### P3.2 APIManager Promise Handling on Abort

**Status:** ⚠️ OPEN (by design)  
**Severity:** P3 (Low)  
**Component:** API Error Handling

**Issue:** When API requests are aborted, the Promise neither resolves nor rejects.

**Impact:** Callers using `await` on aborted requests will hang indefinitely.

**Note:** This is intentional behavior — aborted requests indicate the user
changed context and moved on. The UI state is updated separately.

**Recommendation:** Consider resolving with `undefined` or rejecting with
an `AbortError` for code that needs to handle abortion explicitly.

---

## ✅ Issues Verified as NOT Bugs (v11 Review)

### Boolean Visibility Checks

**Initial Concern:** Multiple files use `visible !== false` without checking `!== 0`.

**Verification Result:** **NOT A BUG**

**Reason:** `LayerDataNormalizer.normalizeLayer()` is called on ALL data loaded
from the API (see APIManager.js line 527). The normalizer converts integer `0`
and string `'0'` to boolean `false` before any visibility checks occur.

After normalization, `visible !== false` is a safe and correct check.

---

### History Save Order in GroupManager

**Initial Concern:** `saveState()` is called BEFORE state changes, causing broken undo.

**Verification Result:** **NOT A BUG — CORRECT PATTERN**

**Reason:** This is the standard save-before-change pattern for undo systems:
1. `saveState()` captures the CURRENT (pre-change) state
2. State is then modified
3. Undo restores the pre-change state (correct!)
4. The new state is captured on the NEXT `saveState()` call

The undo system works correctly.

---

## ✅ P1: High Priority Issues — PREVIOUSLY RESOLVED

### ~~P1.1 ApiSlidesSave.php — Dead Code~~

**Status:** ✅ FIXED (DELETED)  
**Resolution:** File deleted. Dead code no longer exists in the repository.

---

### ~~P1.2 ApiSlideInfo.php — Dead Code~~

**Status:** ✅ FIXED (DELETED)  
**Resolution:** File deleted. Dead code no longer exists in the repository.

---

### ~~P1.3 Widespread Version Inconsistencies~~

**Status:** ✅ FIXED (v10)  
**Resolution:** All files updated to show 1.5.49.

---

## ✅ P2: Medium Priority Issues — PREVIOUSLY RESOLVED

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

### ~~P2.4 Test Count/Coverage Documentation Mismatch~~

**Status:** ✅ FIXED (v10)  
**Resolution:** Updated to 11,210 tests, 95.19%/84.96% coverage.

---

## ✅ P3: Low Priority Issues — PREVIOUSLY RESOLVED

### ~~P3.1 Inconsistent API Error Codes~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Standardized to 'setnotfound' across all API modules.

---

### ~~P3.2 ApiLayersInfo Lacks Rate Limiting~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Added rate limiting via createRateLimiter().

---

### ~~P3.3 ApiLayersInfo Lacks Global Exception Handler~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Wrapped in try/catch with generic error response.

---

### ~~P3.4 Silent Catch Blocks~~

**Status:** ✅ RESOLVED (false positive)  
**Resolution:** All silent catches are intentional (feature detection, clipboard).

---

### ~~P3.5 Magic Numbers~~

**Status:** ✅ FIXED  
**Resolution:** Extracted to LayerDefaults.js in ext.layers.shared module.

---

### ~~P3.6 LayersLightbox Click Handler Cleanup~~

**Status:** ✅ FIXED (v9.1)  
**Resolution:** Added explicit removeEventListener for boundClickHandler.

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

## Test Coverage Status (February 3, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,210** (165 suites) | ✅ |
| Tests passing | **11,210** | ✅ All pass |
| Tests failing | **0** | ✅ |
| Statement coverage | **95.19%** | ✅ Excellent |
| Branch coverage | **84.96%** | ✅ Good |
| Function coverage | **93.67%** | ✅ Excellent |
| Line coverage | **95.32%** | ✅ Excellent |

---

## Code Quality Metrics (Verified February 3, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | **142** | ✅ |
| PHP files | **40** | ✅ |
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

*Document updated: February 3, 2026 (Comprehensive Critical Review v13)*  
*Status: 1 P1, 2 P2 (documentation), 2 P3 issues remaining.*
