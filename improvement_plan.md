# Layers Extension - Improvement Plan

**Last Updated:** January 24, 2026  
**Version:** 1.5.29  
**Status:** Production-Ready, High Quality (8.9/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **excellent test coverage**. All P0 critical items have been resolved as of January 24, 2026.

**Current Status:**
- ✅ All P0 items complete (SEC-1, CODE-1 fixed)
- ✅ All P1 items complete (CODE-2 verified already i18n'd)
- 🟡 P2/P3 items for long-term improvement

**Verified Metrics (January 24, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,574** (156 suites) | ✅ Excellent |
| Statement coverage | **94.45%** | ✅ Excellent |
| Branch coverage | **84.87%** | ✅ Excellent |
| Function coverage | **92.55%** | ✅ Excellent |
| Line coverage | **94.59%** | ✅ Excellent |
| JS files | 130 | Excludes dist/ |
| JS lines | ~116,191 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~9,461 | ✅ Corrected from 13,908 |
| ES6 classes | 111 files | 100% migrated |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint warnings | 7 | Ignored files only |
| ESLint disables | 9 | ✅ All legitimate |
| innerHTML usages | 20+ | ✅ Audited - all safe |
| console.log in prod | 0 | ✅ Fixed |
| Skipped tests | 0 | ✅ All tests run |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–4 weeks | Code quality, coverage gaps, small fixes |
| **P2** | 1–3 months | Documentation, architecture improvements |
| **P3** | 3–6 months | New features and major improvements |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

### P0.1 Missing `mustBePosted()` on Write API Modules ✅ FIXED

**Status:** Fixed (January 24, 2026)  
**Priority:** P0 - Critical  
**Severity:** Medium Security  
**Files:**
- `src/Api/ApiLayersSave.php`
- `src/Api/ApiLayersDelete.php`
- `src/Api/ApiLayersRename.php`

**Resolution:** Added `mustBePosted()` method returning `true` to all three write API modules for defense-in-depth security.

---

### P0.2 console.log in Production Code ✅ FIXED

**Status:** Fixed (January 24, 2026)  
**Priority:** P0 - Critical  
**Severity:** High Code Quality  
**File:** `resources/ext.layers/viewer/ViewerManager.js`

**Resolution:** Replaced 3 `console.log` calls with `this.debugLog()` method that properly respects debug mode and uses mw.log.

---

## Phase 1 (P1): High Priority — ✅ ALL RESOLVED

### P1.1 Hardcoded User-Facing Strings ✅ VERIFIED

**Status:** Verified as already fixed  
**Priority:** P1 - High  
**Category:** i18n  

**Resolution:** Upon code verification, the reported hardcoded strings were either already using i18n or have been removed from the codebase.

---

### P1.2 Documentation Metric Corrections ✅ FIXED

**Status:** Fixed in this review  
**Priority:** P1 - High  
**Category:** Documentation  

**Corrections Made:**
- PHP lines: Was documented as 13,908, actual is 9,461
- This file and codebase_review.md now have correct values

---

## Phase 2 (P2): Medium Priority — 🟡 OPEN

### P2.1 DEBUG Comments in Production Code

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Code Quality  

**11 DEBUG comments to review:**

| File | Line | Action |
|------|------|--------|
| ShadowRenderer.js | 239 | Convert to mw.log with debug check |
| EffectsRenderer.js | 210 | Convert to mw.log with debug check |
| EffectsRenderer.js | 382 | Convert to mw.log with debug check |
| EffectsRenderer.js | 396 | Convert to mw.log with debug check |
| LayersViewer.js | 315 | Review and remove if stale |
| LayersLightbox.js | 45 | Review and remove if stale |
| ApiLayersInfo.php | 245 | Convert to $this->getLogger() |
| ParserHooks.php | 144 | Convert to $this->getLogger() |
| LayersFileTransform.php | 122 | Convert to $this->getLogger() |
| LayersFileTransform.php | 139 | Convert to $this->getLogger() |
| ThumbnailRenderer.php | 269 | Convert to $this->getLogger() |

**Estimated Effort:** 2 hours

---

### P2.2 Tautological Test Assertions ✅ COMPLETED

**Status:** ✅ Completed  
**Priority:** P2 - Medium  
**Category:** Testing  
**Completed:** January 24, 2026

All 9 instances of `expect(true).toBe(true)` have been replaced with meaningful assertions:

| File | Before | After |
|------|--------|-------|
| Toolbar.test.js | Tautological | Verifies toggleItem is undefined |
| PropertiesForm.test.js | Tautological | Verifies form sections exist |
| LayersEditorCoverage.test.js | Tautological | Verifies mock editor setup |
| CanvasRenderer.test.js (3x) | Tautological | Verifies ctx properties set/reset |
| CanvasManager.test.js | Tautological | Verifies imageLoader created |
| InlineTextEditor.test.js | Tautological | Verifies layer state after edit |
| APIManager.test.js | Tautological | Verifies API manager state |

---

### P2.3 ShapeLibraryPanel DOM Performance

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Performance  
**File:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js`

**Issue:** Creates DOM elements in loops without using DocumentFragment.

**Current Pattern:**
```javascript
container.innerHTML = '';
for (const shape of shapes) {
    container.appendChild(createElement());  // Triggers reflow each time
}
```

**Recommended Pattern:**
```javascript
const fragment = document.createDocumentFragment();
for (const shape of shapes) {
    fragment.appendChild(createElement());
}
container.innerHTML = '';
container.appendChild(fragment);  // Single reflow
```

**Impact:** Low — only affects initial load of 1,310 shapes. Modern browsers handle this well.

**Estimated Effort:** 30 minutes

---

### P2.4 EffectsRenderer Canvas Pooling ⏸️ DEFERRED

**Status:** Deferred  
**Decision Date:** January 24, 2026

**Reason for Deferral:** Low ROI. Blur effects are rare, modern browsers handle canvas GC well.

---

## Phase 3 (P3): Long-Term Improvements

### P3.1 Magic z-index Constants

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Code Quality  

**Current State:** 7+ different z-index values scattered across files.

**Recommended Solution:** Create a z-index scale file:
```css
/* resources/ext.layers.editor/z-index.css */
:root {
    --layers-z-editor-base: 10000;
    --layers-z-modal: 100000;
    --layers-z-overlay: 999999;
    --layers-z-color-picker: 1000000;
    --layers-z-shape-library: 1000010;
}
```

**Estimated Effort:** 2 hours

---

### P3.2 Jest Fake Timers

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Testing  

**Issue:** 30+ instances of real `setTimeout` in tests causing potential flakiness.

**Recommended Pattern:**
```javascript
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

it('should handle delayed operation', () => {
    triggerAsyncOperation();
    jest.runAllTimers();
    expect(result).toBe(expected);
});
```

**Estimated Effort:** 4 hours

---

### P3.3 Deprecated Method Removal

**Status:** Open  
**Priority:** P3 - Low  
**Category:** Maintenance  

**Methods to remove in v2.0:**

| File | Method | Replacement |
|------|--------|-------------|
| ToolManager.js | `getDrawingLayer()` | `createLayer()` |
| LayerPanel.js | `hideControlsForSelectedLayers` | Remove entirely |
| UIManager.js | Legacy folder method | `createFolder()` |

**Action:** Add `@deprecated` JSDoc tags with version and alternative method.

---

### P3.4 TypeScript Migration

**Status:** Not Started  
**Priority:** P3  

Consider TypeScript for complex modules:
- StateManager
- APIManager
- GroupManager
- SelectionManager

**Benefits:**
- Catch type errors at compile time
- Better IDE support
- Self-documenting interfaces

**Estimated Effort:** 2-3 sprints per module

---

### P3.5 Visual Regression Testing

**Status:** Not Started  
**Priority:** P3  

Add visual snapshot tests for:
- Canvas rendering
- Shape rendering
- Text rendering
- Dark mode compatibility

**Tools to Consider:**
- Percy
- Chromatic
- jest-image-snapshot

---

## God Class Status (21 Files ≥1,000 Lines)

### Generated Data Files (Exempt from Refactoring)

| File | Lines | Notes |
|------|-------|-------|
| EmojiLibraryData.js | ~26,277 | Generated emoji metadata |
| ShapeLibraryData.js | ~11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | ~3,003 | Generated search index |

### Hand-Written Files with Delegation (18 total)

| File | Lines | Delegation Status | Branch Coverage |
|------|-------|-------------------|-----------------|
| CanvasManager.js | ~2,039 | ✅ 10+ controllers | 75.15% |
| ViewerManager.js | ~2,004 | ✅ Delegates to renderers | 80.14% ✅ |
| LayersEditor.js | ~1,800 | ✅ 3 modules | 77.70% |
| Toolbar.js | ~1,847 | ✅ 4 modules | 78.20% |
| LayerPanel.js | ~2,036 | ✅ 9 controllers | 80.27% ✅ |
| APIManager.js | ~1,513 | ✅ APIErrorHandler | 80.95% ✅ |
| SelectionManager.js | ~1,431 | ✅ 3 modules | 83.96% ✅ |
| ArrowRenderer.js | ~1,310 | N/A - math complexity | 87.90% ✅ |
| CalloutRenderer.js | ~1,291 | N/A - rendering logic | 88.40% ✅ |
| InlineTextEditor.js | ~1,273 | N/A - feature complexity | 86.85% ✅ |
| PropertyBuilders.js | ~1,284 | N/A - UI builders | 85.71% ✅ |
| ToolManager.js | ~1,224 | ✅ 2 handlers | 81.28% ✅ |
| GroupManager.js | ~1,172 | N/A - group operations | 86.54% ✅ |
| CanvasRenderer.js | ~1,132 | ✅ SelectionRenderer | 76.78% |
| TransformController.js | ~1,110 | N/A - transforms | 83.72% ✅ |
| ResizeCalculator.js | ~1,105 | N/A - math | 90.25% ✅ |
| ToolbarStyleControls.js | ~1,099 | ✅ Style controls | 82.18% ✅ |
| PropertiesForm.js | ~1,001 | ✅ PropertyBuilders | 81.17% ✅ |

### Watch List (Approaching 1,000 Lines)

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | ~994 | ⚠️ Near threshold |
| LayerRenderer.js | ~963 | Watch |

---

## Completed Items (Historical)

### Previously Resolved P0 Issues
- ✅ ApiLayersDelete/Rename rate limiting added
- ✅ Template images CSP issue fixed
- ✅ Memory leaks fixed (TransformationEngine, ZoomPanController, LayerRenderer)
- ✅ CanvasManager async race condition fixed
- ✅ SelectionManager infinite recursion fixed
- ✅ Export filename sanitization added
- ✅ Timer cleanup in destroy() methods
- ✅ APIManager save race condition fixed (saveInProgress flag)
- ✅ GroupManager circular reference fixed (isDescendantOf check)

### Previously Resolved P1/P2 Issues
- ✅ SlidePropertiesPanel.js coverage improved
- ✅ InlineTextEditor.js branch coverage above 80%
- ✅ ViewerManager.js branch coverage 80.14%
- ✅ LayerPanel.js branch coverage 80.27%
- ✅ APIManager.js branch coverage 80.95%
- ✅ StateManager lock recovery implemented
- ✅ pendingOperations queue protection added
- ✅ Canvas context null checks added

---

## Success Criteria for World-Class Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| No critical security issues | ✅ | mustBePosted() added |
| Statement coverage >90% | ✅ 94.45% | Excellent |
| Branch coverage >80% | ✅ 84.87% | Excellent |
| No race conditions | ✅ | All fixed |
| ESLint clean | ✅ | 0 errors |
| No console.log in prod | ✅ | Fixed January 24, 2026 |
| localStorage quota handling | ✅ | Try-catch implemented |
| Memory leak prevention | ✅ | EventTracker, TimeoutTracker |
| Destroy methods complete | ✅ | All components have cleanup |
| Animation frame cleanup | ✅ | cancelAnimationFrame in destroy |
| Zero skipped tests | ✅ | All tests run |
| All priority files at 80%+ branch | ✅ | Complete |
| i18n complete | ✅ | Verified |

### Remaining Gaps for World-Class
| Gap | Priority | Status |
|-----|----------|--------|
| DEBUG comments cleanup | P2 | 🟡 Open |
| Tautological test assertions | P2 | 🟡 Open |
| TypeScript migration | P3 | Not started |
| Visual regression tests | P3 | Not started |

---

## Rules

### The God Class Rule

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to ~2,000 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Hard limit:** 2,000 lines maximum
4. **Document:** All god classes must be listed in documentation

### The Timer Rule

When adding setTimeout/setInterval:
1. Store timer ID in instance variable
2. Add clearTimeout/clearInterval in destroy()
3. Consider using TimeoutTracker for complex scenarios
4. Document the cleanup

### The Animation Frame Rule

When using requestAnimationFrame:
1. Store frame ID in instance variable
2. Add cancelAnimationFrame in destroy()
3. Consider pending flag pattern for throttling
4. Cancel before scheduling new frame in loops

### The Event Listener Rule

When adding event listeners:
1. Use EventTracker.add() for automatic cleanup
2. Store bound handler if manual cleanup needed
3. Remove in destroy() method
4. Never add listeners without cleanup plan

### The Documentation Rule

All metrics in documentation must be verifiable with commands documented in codebase_review.md Appendix.

### The innerHTML Rule

When setting innerHTML:
1. **Never** with user-provided content
2. **Prefer** DOM construction (createElement, textContent, appendChild)
3. **Document** why innerHTML is necessary if used
4. **Consider** Trusted Types policy for CSP compliance

### The Console Rule

When adding debug logging:
1. **Never** use console.log in production code
2. **Use** mw.log() for MediaWiki integration
3. **Wrap** in debug check: `if (this.debug && mw.log)`
4. **Consider** conditional compilation for verbose logging

### The Error Handling Rule

When handling errors:
1. **Log** with mw.log (never console.log in production)
2. **Notify** user if action failed (don't swallow silently)
3. **Propagate** if caller needs to handle
4. **Document** expected error types

### The i18n Rule

When adding user-facing strings:
1. **Always** use mw.message() for user-visible text
2. **Add** key to i18n/en.json
3. **Document** in i18n/qqq.json
4. **Register** in extension.json ResourceModules messages

### The API Security Rule

When creating write API modules:
1. **Require** CSRF token: `needsToken() { return 'csrf'; }`
2. **Declare** write mode: `isWriteMode() { return true; }`
3. **Enforce** POST: `mustBePosted() { return true; }`
4. **Check** permissions before any action

---

## Summary

**Rating: 8.9/10** — Production-ready, high quality, all critical issues resolved

**Strengths:**
- ✅ 10,574 passing tests with 94.45% statement coverage
- ✅ 84.87% branch coverage (all priority files at 80%+)
- ✅ 15 working drawing tools + Slide Mode
- ✅ Professional architecture (facades, delegation, controllers)
- ✅ Named layer sets with version history
- ✅ Shape library with 1,310 shapes
- ✅ Emoji picker with 2,817 emoji
- ✅ Mobile touch support
- ✅ innerHTML usage audited and safe
- ✅ 100% ES6 class migration (111 files)
- ✅ Proper memory management (EventTracker, TimeoutTracker, cancelAnimationFrame)
- ✅ Zero skipped tests
- ✅ All P0 security/code quality issues fixed
- ✅ mustBePosted() on all write API modules
- ✅ No console.log in production code

**P2/P3 for Long-Term:**
- 🟡 DEBUG comments cleanup
- 🟡 Tautological test assertions
- 🟡 z-index constants
- 🟡 Jest fake timers migration

---

*Plan updated: January 24, 2026*  
*Version: 1.5.29*  
*Based on verified test run: 10,574 tests, 94.45% statement coverage, 84.87% branch coverage*
