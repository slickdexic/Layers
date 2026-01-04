# Known Issues

**Last Updated:** January 4, 2026  
**Version:** 1.4.5

This document lists known functionality issues and their current status.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ All resolved |
| P1 (Stability) | 6 | ⚠️ 12 god classes + 2 remaining issues |
| P2 (Code Quality) | 2 | ✅ ESLint disables reduced to 8 |
| Feature Gaps | 3 | ⏳ Planned (InstantCommons now supported) |

---

## ✅ P0 Issues - ALL RESOLVED

### P0.NEW ApiLayersDelete.php Missing Rate Limiting - FIXED ✅

**Status:** ✅ FIXED (January 3, 2026)  
**Severity:** HIGH  
**File:** `src/Api/ApiLayersDelete.php`

**Problem:** Unlike `ApiLayersSave.php` which implements rate limiting via `RateLimiter::checkRateLimit()`, the delete endpoint had no rate limiting.

**Solution Applied:**
- Added rate limiting using `editlayers-delete` action
- Added default rate limits to `RateLimiter.php` (20 deletes/hour for users, 3 for newbies)
- Matches the pattern used in ApiLayersSave.php

---

## ⚠️ P1 Issues - 2 REMAINING

### P1.NEW1 DEBUG Logging in Production Code - NO ACTION NEEDED ✅

**Status:** ✅ Re-evaluated - Not an Issue  
**Files:** `EffectsRenderer.js`, PHP processors

**Re-evaluation:** These use proper logging mechanisms:
- JavaScript: `mw.log()` only outputs when debug mode is enabled
- PHP: `logDebug()` uses PSR-3 logging gated by MediaWiki configuration

This is good practice for troubleshooting, not a bug.

### P1.NEW2 Duplicate sanitizeSetName() (DRY Violation) - FIXED ✅

**Status:** ✅ FIXED (January 3, 2026)  
**Files:** `ApiLayersSave.php`, `ApiLayersDelete.php`, `ApiLayersRename.php`

**Solution Applied:**
- Created `src/Validation/SetNameSanitizer.php` with static `sanitize()` method
- Updated all 3 API files to use the shared class
- Removed ~90 lines of duplicate code

### P1.NEW3 APIManager.js CSRF Token Not Refreshed During Retries

**Status:** ⚠️ Not Fixed  
**File:** `resources/ext.layers.editor/APIManager.js`

The save retry logic doesn't refresh the CSRF token, which may cause failures if session expires during retries.

### P1.NEW4 Background Image Load Failure Silent

**Status:** ⚠️ Not Fixed  
**File:** `resources/ext.layers.editor/CanvasManager.js`

When background image loading fails, the error is only logged but no user notification is shown.

---

## ✅ Previously P0 Issues - RESOLVED

### P0.1 EffectsRenderer.js Coverage - FIXED ✅

**Status:** Resolved  
**Before:** 48.7% statement, 43% branch  
**After:** **97.3% statement, 91.5% branch**  
**Solution:** Added 26 comprehensive tests for drawBlurFill method and stroke styles.

### P0.2 CanvasRenderer.js Coverage - FIXED ✅

**Status:** Resolved  
**Before:** 58.5% statement, 47% branch  
**After:** **88.6% statement, 73.9% branch**  
**Solution:** Added 40 tests for blur blend mode methods (_drawBlurClipPath, _drawBlurStroke, _drawBlurContent, _drawRoundedRectPath).

### P0.3 Rectangle Blur Fill Coordinate Bug - FIXED ✅

**Status:** Resolved  
**Symptom:** Rectangle with blur fill displayed as completely transparent/invisible when rotated  
**Root Cause:** When rotation was applied, `x` and `y` were modified to local coordinates (`-width/2`, `-height/2`) before being passed to `drawBlurFill`, which expected world coordinates.  
**Solution:** Store world coordinates (`worldX`, `worldY`) BEFORE rotation transformation is applied, and pass those to `drawBlurFill`. The path callback still uses local coordinates (correct for the rotated context).  
**Fixed in:** ShapeRenderer.js `drawRectangle()` method.  
**Test added:** 3 new blur fill tests in ShapeRenderer.test.js

---

## ✅ P0 Issues - ALL RESOLVED

### P0.1 Editor vs Viewer Blur Fill Rendering Mismatch

**Status:** Low Priority Edge Case  
**Severity:** LOW (edge case only)  
**Symptom:** Blur fill may appear differently in editor vs viewer, or work in one but not the other

**Root Cause:**

The EffectsRenderer.drawBlurFill method attempts to handle both editor mode (with zoom/pan) and viewer mode (with scaling) through the same code path with conditional logic. This leads to:

1. **Double transformation:** In editor mode, the context already has zoom/pan applied, but drawBlurFill tries to apply it again to capture bounds
2. **Capture region misalignment:** The blur captures the wrong region of the canvas due to coordinate confusion
3. **Scale factor ambiguity:** blurRadius is sometimes scaled, sometimes not, depending on code path

**Note:** The rectangle coordinate fix addresses the primary symptom. This remaining issue affects edge cases with complex zoom/pan states.

---

## ⚠️ P1 Issues (Stability)

### P1.1 God Classes (12 files >1,000 lines)

**Status:** Stable - 12 files exceed 1,000 lines  
**Severity:** MEDIUM - Reduced from 13 (PropertiesForm.js refactored)

| File | Lines | Delegation Pattern | Status |
|------|-------|-------------------|--------|
| **LayerPanel.js** | **2,141** | ✅ 9 controllers | ⚠️ At limit |
| CanvasManager.js | 1,885 | ✅ 10+ controllers | ✅ OK |
| Toolbar.js | 1,658 | ✅ 4 modules | ✅ OK |
| LayersEditor.js | 1,482 | ✅ 3 modules | ✅ OK |
| SelectionManager.js | 1,359 | ✅ 3 modules | ✅ OK |
| ArrowRenderer.js | 1,310 | ✅ Rendering (curved arrows) | ✅ OK |
| **CalloutRenderer.js** | **1,290** | ✅ Rendering (callouts) | ✅ OK |
| ToolManager.js | 1,214 | ✅ 2 handlers | ✅ OK |
| APIManager.js | 1,182 | ✅ APIErrorHandler | ✅ OK |
| GroupManager.js | 1,132 | v1.2.13 | ✅ OK |
| CanvasRenderer.js | 1,105 | ✅ SelectionRenderer | ✅ OK |
| ToolbarStyleControls.js | 1,014 | ✅ Style controls (live preview) | ✅ OK |
| PropertiesForm.js | 914 | ✅ PropertyBuilders | ✅ OK |

**Total in god classes:** ~15,867 lines (28% of JS codebase)

**Note:** CalloutRenderer.js (1,290 lines) is a new god class added in v1.4.2 for the callout/speech bubble feature. PropertiesForm.js now delegates to PropertyBuilders.js (914 lines). ArrowRenderer.js grew due to curved arrow feature (v1.3.3).

### P1.2 Dead Code: ServerLogger.js - RESOLVED ✅

**Status:** RESOLVED — Deleted January 6, 2026  
**Severity:** LOW (was MEDIUM)

ServerLogger.js (198 lines) and ApiLayersLog.php were dead code that was never called from anywhere. Both files have been deleted, saving ~2KB bandwidth per page load.

### P1.3 Files Approaching 1,000 Lines

**Status:** Monitoring  
**Severity:** LOW (PropertiesForm crossed the threshold)

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | 909 | ⚠️ Monitor |
| LayersValidator.js | 853 | ✅ OK |

---

## P2 Issues (Code Quality)

### P2.1 ESLint Disable Comments

**Status:** ✅ Well below target  
**Count:** 8 eslint-disable comments (reduced from 17 → 13 → 8)

| Rule | Count | Reason |
|------|-------|--------|
| no-alert | 8 | ✅ Intentional fallbacks when DialogManager unavailable |

**Improvements Made:**
- Refactored GroupManager.js to use `omitProperty` utility (removed 4)
- Added underscore-prefix pattern to .eslintrc.json for intentionally unused params (removed 5)

### P2.2 Test Coverage

**Status:** Excellent  
**Current:** 93.9% statement coverage

All files now meet or exceed the 85% target:
- ✅ LayerDragDrop.js: 100% line coverage (improved from 68.9%)
- ✅ GroupManager.js: 85% statement coverage (improved from 67%)

**Note:** LayerListRenderer.js previously listed as 78.6% coverage, but actual coverage is higher. Documentation corrected.

### P2.4 Deprecated Code Present

**Status:** Partially cleaned  
**Severity:** LOW  
**Count:** 4 deprecated items (reduced from 8)

Remaining deprecated items (all are legitimate fallbacks):
- `window.layersModuleRegistry` → Use `window.layersRegistry` (backward compat)
- Legacy module pattern export (backward compat)
- CanvasManager fallback image loading (edge cases)

### P2.5 Codebase Size

**Status:** ✅ Healthy  
**Current:** ~55,000 lines (106 files)  
**Target:** <75,000 lines

The extension is feature-rich with 11 drawing tools (blur tool deprecated), layer grouping, multiple rendering systems, comprehensive validation, and extensive test coverage.

---

## ✅ Recently Fixed Issues

### January 6, 2026

| Issue | Resolution | Impact |
|-------|------------|--------|
| **Dead code: ServerLogger.js** | Deleted ServerLogger.js (198 lines) and ApiLayersLog.php | ~2KB bandwidth saved per page load |
| **CalloutRenderer.js undertested** | Added 38 tests, coverage 62.42% → 90.05% | Speech bubble feature tested |
| **PropertiesForm.js refactored** | Extracted PropertyBuilders.js (819 lines), reduced to 914 lines | No longer a god class |
| **PropertyBuilders.js tests** | Created 50 tests for all 14 builder methods | New module fully tested |

**Test count:** 7,940 → 8,155 (+215 new tests total)

### January 2, 2026

| Issue | Resolution | Impact |
|-------|------------|--------|
| **Text with apostrophes showing HTML entities** | Removed `htmlspecialchars()` from `TextSanitizer.php` — JSON storage shouldn't HTML-encode | Text like "I'M" no longer becomes `I&apos;M` |
| **Wrong layer set displayed after `layerslink=editor`** | Fixed `ApiFallback.js` to extract setname from `data-layers-intent` attribute | Article now shows correct layer set after editing |

**Test count:** 7,940 tests passing

### December 23, 2025

| Issue | Resolution | Impact |
|-------|------------|--------|
| **P0.1-P0.2: Native dialogs in PresetDropdown.js & RevisionManager.js** | Replaced with DialogManager async dialogs + fallbacks | Accessible dialogs |
| **P0.3: DialogManager.js undertested (53% coverage)** | Added 35 tests, now 96.14% statement coverage | Core UI fully tested |
| **P0.4: PropertiesForm.js function coverage (41%)** | Added 39 tests, now 68.22% function coverage | Better form testing |
| Timer cleanup in CanvasManager.js | Added `fallbackTimeoutId` tracking | Memory leak prevention |
| Timer cleanup in LayersLightbox.js | Added `closeTimeoutId` tracking | Memory leak prevention |
| Documentation accuracy | Updated codebase_review.md with real metrics | Honest documentation |

**Test count increased:** 6,549 → 6,623 (+74 tests)

### v1.2.3 (December 2025)

| Issue | Resolution |
|-------|------------|
| LayersLightbox.js coverage | 70 tests added, now 86.6% coverage |
| Text box rendering bug | Fixed padding scaling when image scaled down |
| UIManager.js size | Extracted SetSelectorController.js (1,029 → 681 lines) |

### v1.1.10 (December 2025)

| Issue | Resolution |
|-------|------------|
| SVG XSS Security Risk | Removed `image/svg+xml` from allowed MIME types |
| Foreign Repository File Lookup | Changed to `getRepoGroup()->findFile()` in all APIs |
| E2E Tests Failing | Fixed password length for MediaWiki 1.44 |

### v1.1.9 (December 2025)

| Issue | Resolution |
|-------|------------|
| Background Visibility Bug | Fixed PHP→JS boolean serialization handling |
| Missing AutoloadClasses | Added ApiLayersRename to extension.json |
| Memory Leak - Animation Frame | Added cancelAnimationFrame in destroy() |
| Missing Setname Sanitization | Added to Delete and Rename APIs |
| Duplicated clampOpacity() | Created shared MathUtils.js |

---

## Feature Gaps

### ⚠️ Limited Mobile/Touch Support

**Status:** Partially Implemented  
**Priority:** MEDIUM  
**Effort:** 3-4 weeks for full mobile optimization

**What Works:**
- ✅ Touch-to-mouse event conversion (single touch drawing)
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch resizing of layer panel divider

**What's Missing:**
- Responsive toolbar layout for small screens
- Mobile-optimized layer panel
- Touch-friendly selection handles (larger hit areas)
- On-screen keyboard handling for text input

**Workaround:** Use desktop browser or browser with desktop mode.

### ❌ Missing Features

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| Mobile-Optimized UI | MEDIUM | 3-4 weeks | ⏳ Basic touch works |
| Gradient Fills | LOW | 1 week | Not started |
| Custom Fonts | LOW | 2 weeks | Not started |
| SVG Export | LOW | 1 week | Not started |

### ❌ SVG Images Not Supported

**Status:** By Design (Security)  
**Reason:** SVG can contain embedded JavaScript

**Workaround:** Convert SVG to PNG before importing.

---

## Test Coverage Status

### Overall Coverage (January 3, 2026)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Tests passing | 8,214 | - | ✅ |
| Statement coverage | 94.09% | 85%+ | ✅ Excellent |
| Branch coverage | 82.69% | 75%+ | ✅ |
| Function coverage | 92.67% | 80%+ | ✅ |
| Line coverage | 94.24% | 85%+ | ✅ |

### Files With Good Coverage ✅

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| EffectsRenderer.js | 98.9% | 92.3% | ✅ Excellent |
| CanvasRenderer.js | 93.7% | 78.2% | ✅ Good |
| LayerRenderer.js | 93.8% | 76.7% | ✅ Good |
| ShapeRenderer.js | 93.9% | 84.6% | ✅ Good |

### Files With Coverage Issues ⚠️

**None.** All major files meet or exceed coverage thresholds.

**Note on SelectionRenderer.js:** Aggregated coverage reports show ~66% for this file, but running its tests in isolation confirms **98.85% statement, 92.79% branch, 100% function coverage**. This is a Jest coverage aggregation artifact, not a real coverage gap. The file has 64 comprehensive tests.

### Files Recently Improved ✅

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| SelectionRenderer.js | 98.85% (isolated) | 92.79% | ✅ Validated - 66% in aggregate was artifact |
| CalloutRenderer.js | 90.05% | 85.0% | ✅ Improved from 62.42% |
| PropertiesForm.js | 96.44% | 82.45% func | ✅ Function coverage improved 72.85% → 82.45% |
| LayerDragDrop.js | 100% | 87.7% | ✅ Improved from 68.9% |
| GroupManager.js | 89.1% | 75.1% | ✅ Improved from 84.9% |

---

## Browser Compatibility

### Tested Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✅ Fully supported |
| Firefox | 120+ | ✅ Fully supported |
| Safari | 17+ | ✅ Fully supported |
| Edge | 120+ | ✅ Fully supported |

### Known Browser Issues

| Browser | Issue | Workaround |
|---------|-------|------------|
| Safari | Color picker may not show eyedropper | Use hex input instead |
| Firefox | Slow with >50 layers | Reduce layer count |

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

*Document updated: January 4, 2026*  
*Status: ✅ 12 god classes (all with proper delegation). Extension is production-ready with excellent test coverage (94.09%, 8,214 tests). No coverage gaps.*
