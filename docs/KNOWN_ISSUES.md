# Known Issues

**Last Updated:** December 27, 2025  
**Version:** 1.2.8

This document lists known functionality issues and their current status.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Coverage Gaps) | **0** | ✅ Resolved |
| P1 (Stability) | 2 | ⚠️ Monitored |
| P2 (Code Quality) | 4 | ⏳ Tracked |
| Feature Gaps | 5 | ⏳ Planned |

---

## ✅ P0 Issues (Coverage Gaps) - RESOLVED

### P0.1 EffectsRenderer.js - FIXED ✅

**Status:** Resolved  
**Before:** 48.7% statement, 43% branch  
**After:** **97.3% statement, 91.5% branch**  
**Solution:** Added 26 comprehensive tests for drawBlurFill method and stroke styles.

### P0.2 CanvasRenderer.js - FIXED ✅

**Status:** Resolved  
**Before:** 58.5% statement, 47% branch  
**After:** **88.6% statement, 73.9% branch**  
**Solution:** Added 40 tests for blur blend mode methods (_drawBlurClipPath, _drawBlurStroke, _drawBlurContent, _drawRoundedRectPath).

---

## ⚠️ P1 Issues (Stability)

### P1.1 God Classes (8 files >1,000 lines)

**Status:** Stable - using delegation pattern  
**Severity:** MEDIUM - Manageable with delegation

| File | Lines | Delegation Pattern |
|------|-------|-------------------|
| CanvasManager.js | 1,877 | ✅ 10+ controllers |
| LayerPanel.js | 1,838 | ✅ 7 controllers |
| Toolbar.js | 1,549 | ✅ 4 modules |
| LayersEditor.js | 1,355 | ✅ 3 modules |
| ToolManager.js | 1,261 | ✅ 2 handlers |
| CanvasRenderer.js | 1,211 | ✅ SelectionRenderer (89% coverage) |
| APIManager.js | 1,207 | ✅ APIErrorHandler |
| SelectionManager.js | 1,194 | ✅ 3 modules |

**Total in god classes:** ~11,492 lines (23% of JS codebase)

All god classes now use delegation patterns and have acceptable test coverage.

### P1.2 ToolbarStyleControls.js Approaching Limit

**Status:** Should split proactively  
**Severity:** MEDIUM  
**File:** `resources/ext.layers.editor/ToolbarStyleControls.js`  
**Lines:** 947 (53 away from 1,000 line threshold)

This file is growing and should be split before it becomes a god class.

---

## P2 Issues (Code Quality)

### P2.1 ESLint Disable Comments

**Status:** Acceptable  
**Count:** 13 eslint-disable comments

| Rule | Count | Reason |
|------|-------|--------|
| no-alert | 9 | ✅ Intentional fallbacks when DialogManager unavailable |
| no-unused-vars | 4 | ✅ API compatibility (parameters required by interface) |

All eslint-disable comments have been reviewed and are acceptable.

### P2.2 Deprecated Code Present

**Status:** Tracked  
**Severity:** LOW  
**Count:** ~8 deprecated items

Deprecated items include:
- `window.layersModuleRegistry` → Use `window.layersRegistry`
- Legacy global exports → Use `window.Layers.*` namespace

All deprecated items emit console warnings when used. Removal timeline: v2.0.

### P2.3 Some Timer Cleanup Missing

**Status:** Partially addressed  
**Severity:** LOW  
**Impact:** Minor memory considerations during long editing sessions

Major files (CanvasManager, LayersLightbox) now have timer cleanup. Remaining cases are in:
- EditorBootstrap.js (initialization delays - run once)
- AccessibilityAnnouncer.js (screen reader debouncing)
- PropertiesForm.js (input debouncing)

These are acceptable because they either run once at startup or are short-lived UI timers.

### P2.4 Codebase Size

**Status:** Warning  
**Current:** ~49,500 lines  
**Threshold:** 50,000 lines

Approaching the complexity threshold. Adding significant new features may push past this limit.

---

## ✅ Recently Fixed Issues

### December 23, 2025 (Today)

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

### ❌ No Mobile/Touch Support

**Status:** Not Implemented  
**Priority:** HIGH  
**Effort:** 4-6 weeks

The editor does not handle touch events. Mobile users cannot:
- Draw or select layers with touch
- Use pinch-to-zoom or two-finger pan
- Access mobile-optimized toolbar

**Workaround:** Use desktop browser or browser with desktop mode.

### ❌ Missing Features

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| Layer Grouping | MEDIUM | 2-3 weeks | Not started |
| Gradient Fills | LOW | 1 week | Not started |
| Custom Fonts | LOW | 2 weeks | Not started |
| SVG Export | LOW | 1 week | Not started |

### ❌ SVG Images Not Supported

**Status:** By Design (Security)  
**Reason:** SVG can contain embedded JavaScript

**Workaround:** Convert SVG to PNG before importing.

---

## Test Coverage Status

### Overall Coverage (December 26, 2025)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Tests passing | 6,729 | - | ✅ |
| Statement coverage | 90.9% | 85%+ | ✅ |
| Branch coverage | 78.6% | 75%+ | ✅ |
| Function coverage | 89.7% | 80%+ | ✅ |
| Line coverage | 91.2% | 85%+ | ✅ |

### Files Needing Attention

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| **EffectsRenderer.js** | **48.7%** | **43%** | 🔴 CRITICAL |
| **CanvasRenderer.js** | **58.5%** | **47%** | 🔴 CRITICAL |
| LayersNamespace.js | 83.6% | 60.6% | ⚠️ Dead code |
| CanvasManager.js | 79.6% | 64.8% | ⚠️ Monitor |

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

*Document updated: December 26, 2025*  
*P0 items identified. Coverage gaps in EffectsRenderer and CanvasRenderer need attention.*
