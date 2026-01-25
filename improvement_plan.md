# Layers Extension - Improvement Plan

**Last Updated:** January 24, 2026  
**Version:** 1.5.29  
**Status:** Production-Ready, High Quality (8.7/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **comprehensive test coverage** and clean code practices. All P1 items identified in the January 24, 2026 critical review have been addressed.

**Current Status:**
- ✅ All P0 items complete (security issues fixed)
- ✅ All P1 items complete (PHP strict types, ReDoS protection, weak assertions fixed)
- 🟡 P2 items for medium-term improvement
- 🟡 P3 items for long-term improvement

**Verified Metrics (January 24, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,574** (156 suites) | ✅ Excellent |
| Statement coverage | **94.40%** | ✅ Excellent |
| Branch coverage | **84.80%** | ✅ Excellent |
| Function coverage | **92.52%** | ✅ Excellent |
| Line coverage | **94.54%** | ✅ Excellent |
| JS files | 126 | Excludes dist/ and scripts/ |
| JS lines | ~114,334 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~13,947 | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | 126 files | 100% migrated |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint disables | 9 | ✅ All legitimate |
| innerHTML usages | 57 | ✅ Audited - all safe |
| Skipped tests | 0 | ✅ All tests run |
| Weak assertions (toBeTruthy/toBeFalsy) | **0** | ✅ All fixed |
| Real setTimeout in tests | 0 | ✅ Fixed |
| i18n messages | 621 | ✅ All documented in qqq.json |
| Deprecated code markers | 20+ | 🟡 Technical debt |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 weeks | High-impact code quality and security hardening |
| **P2** | 1–3 months | Architecture improvements, refactoring |
| **P3** | 3–6 months | New features and major improvements |

---

## Phase 0 (P0): Critical Issues — ✅ NONE CURRENTLY

No critical security vulnerabilities or stability issues identified.

**Previously Fixed P0 Issues:**
- ✅ Missing `mustBePosted()` on Write API Modules (Fixed January 24, 2026)
- ✅ console.log in Production Code (Fixed January 24, 2026)

---

## Phase 1 (P1): High Priority — ✅ ALL COMPLETE

### P1.1 Add PHP Strict Types Declarations ✅ COMPLETE

**Status:** Complete (January 24, 2026)  
**Priority:** P1 - High  
**Category:** Security / Code Quality  
**Count:** 40/40 PHP files have strict_types

**Solution Applied:**
Added `declare(strict_types=1);` to all 40 PHP files in `src/` directory.

---

### P1.2 Add ReDoS Protection to Color Validator ✅ COMPLETE

**Status:** Complete (January 24, 2026)  
**Priority:** P1 - High  
**Category:** Security  
**Location:** `src/Validation/ColorValidator.php`

**Solution Applied:**
- Added `MAX_COLOR_LENGTH = 50` constant
- Added length checks before regex processing in `sanitizeColor()`, `isValidRgbColor()`, `isValidHslColor()`

---

### P1.3 Replace Weak Test Assertions ✅ COMPLETE

**Status:** Complete (January 24, 2026)  
**Priority:** P1 - High  
**Category:** Testing Quality  

**Progress:** 231 → 0 (100% complete)

All weak `toBeTruthy()` and `toBeFalsy()` assertions replaced with specific matchers across 9 test files.

**Additional Fix:** `GradientRenderer.hasGradient()` now returns explicit `true`/`false` (wrapped in `Boolean()`) instead of truthy/falsy chain result.
| GradientRenderer.test.js | 2 |
| LayerListRenderer.test.js | 1 |
| ImageLoader.test.js | 1 |
| ColorControlFactory.test.js | 1 |
| InlineTextEditor.test.js | 1 |

**Replacement Pattern:**
```javascript
// BEFORE (weak)
expect( element ).toBeTruthy();

// AFTER (specific)
expect( element ).toBeInstanceOf( HTMLElement );
// or
expect( element ).not.toBeNull();
```

**Estimated Effort:** 1-2 hours

---

## Phase 2 (P2): Medium Priority — 🟡 OPEN

### P2.1 Standardize PHP Error Return Types

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Robustness  
**Location:** `src/Database/LayersDatabase.php`

**Problem:** Inconsistent error return types across methods:
- `deleteNamedSet()` returns `null` on error
- `renameNamedSet()` returns `false` on error
- `countNamedSets()` returns `0` on error (indistinguishable from "no sets")

**Solution Options:**
1. Throw exceptions for unrecoverable errors
2. Use Result/Either pattern for recoverable errors
3. Consistently return `null` for errors

**Estimated Effort:** 2-4 hours

---

### P2.2 Replace JSON.parse/stringify Deep Cloning

**Status:** Open  
**Priority:** P2 - Medium  
**Category:** Performance  

**Problem:** Several files use slow JSON.parse/stringify for cloning despite having DeepClone.js utility.

**Files to Update:**
- `GroupManager.js`
- `SelectionManager.js`
- `HistoryManager.js`

**Solution:**
```javascript
// Replace:
const clone = JSON.parse( JSON.stringify( layer ) );

// With:
const { cloneLayerEfficient } = window.Layers?.Utils || {};
const clone = cloneLayerEfficient ? cloneLayerEfficient( layer ) : 
    JSON.parse( JSON.stringify( layer ) );
```

**Estimated Effort:** 1-2 hours

---

### P2.3 Update KNOWN_ISSUES.md Metrics ✅ COMPLETE

**Status:** Complete (January 24, 2026)  
**Priority:** P2 - Medium  
**Category:** Documentation  

Updated to current metrics:
- Tests: 9,967 → 10,574
- Statement coverage: 92.59% → 94.40%
- Branch coverage: 83.02% → 84.80%

---

### P2.4 Fix Missing qqq.json Documentation ✅ N/A

**Status:** N/A - All messages documented  
**Priority:** P2 - Medium  
**Category:** i18n  

**Finding:** Verified 621 message keys exist in both en.json and qqq.json. The 667 vs 663 line count difference was due to @metadata section formatting, not missing messages.

---

## Phase 3 (P3): Long-Term Improvements

### P3.1 Refactor PHP God Classes

**Status:** Planned  
**Priority:** P3 - Low  
**Category:** Architecture  

**Target Classes:**
1. `LayersDatabase.php` (1,062 lines) → Split into focused repositories
2. `ServerSideLayerValidator.php` (1,137 lines) → Strategy pattern for layer types

**Estimated Effort:** 2-3 days per class

---

### P3.2 Plan Deprecated Code Removal

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Technical Debt  

**Deprecated APIs to Address:**
- `TransformationEngine.js` coordinate transforms
- `ToolbarStyleControls.js` `hideControlsForTool`
- `ModuleRegistry.js` `layersModuleRegistry` global
- `LayersNamespace.js` window.* exports
- `LayerPanel.js` `createNewFolder()`

**Plan:** Create migration guide and schedule removal for v2.0.

**Estimated Effort:** 1 sprint for migration guide + removal

---

### P3.3 TypeScript Migration

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Code Quality  

Consider TypeScript for complex modules:
- StateManager (830 lines)
- APIManager (1,512 lines)
- GroupManager (1,171 lines)
- SelectionManager (1,431 lines)

**Benefits:**
- Catch type errors at compile time
- Better IDE support
- Self-documenting interfaces

**Estimated Effort:** 2-3 sprints per module

---

### P3.4 Visual Regression Testing

**Status:** Not Started  
**Priority:** P3 - Low  
**Category:** Testing  

Add visual snapshot tests for:
- Canvas rendering
- Shape rendering
- Text rendering
- Dark mode compatibility

**Tools to Consider:**
- Percy
- Chromatic
- jest-image-snapshot

**Estimated Effort:** 1-2 sprints for initial setup

---

## God Class Status (21 Files ≥1,000 Lines)

### Generated Data Files (3 files - Exempt from Refactoring)

| File | Lines | Notes |
|------|-------|-------|
| EmojiLibraryData.js | 26,277 | Generated emoji metadata |
| ShapeLibraryData.js | 11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | 3,003 | Generated search index |

### Hand-Written Files with Delegation (18 total)

| File | Lines | Delegation Status | Coverage |
|------|-------|-------------------|----------|
| CanvasManager.js | 2,044 | ✅ 10+ controllers | 88.65% |
| LayerPanel.js | 2,039 | ✅ 9 controllers | 77.86% |
| ViewerManager.js | 2,003 | ✅ Delegates to renderers | 88.79% |
| Toolbar.js | 1,887 | ✅ 4 modules | 89.81% |
| LayersEditor.js | 1,767 | ✅ 3 modules | 88.96% |
| APIManager.js | 1,512 | ✅ APIErrorHandler | 88.34% |
| SelectionManager.js | 1,431 | ✅ 3 modules | 91.57% |
| ArrowRenderer.js | 1,301 | N/A - math complexity | 91.22% |
| PropertyBuilders.js | 1,293 | N/A - UI builders | 98.13% |
| CalloutRenderer.js | 1,291 | N/A - rendering logic | 90.45% |
| InlineTextEditor.js | 1,288 | N/A - feature complexity | 94.66% |
| ToolManager.js | 1,224 | ✅ 2 handlers | 95.27% |
| CanvasRenderer.js | 1,219 | ✅ SelectionRenderer | 93.92% |
| GroupManager.js | 1,171 | N/A - group operations | 97.16% |
| TransformController.js | 1,110 | N/A - transforms | 97.78% |
| ResizeCalculator.js | 1,105 | N/A - math | 100% |
| ToolbarStyleControls.js | 1,098 | ✅ Style controls | 96.35% |
| PropertiesForm.js | 1,004 | ✅ PropertyBuilders | 92.79% |

### PHP God Classes (2 files)

| File | Lines | Status |
|------|-------|--------|
| LayersDatabase.php | 1,062 | 🟡 P3 refactoring planned |
| ServerSideLayerValidator.php | 1,137 | 🟡 P3 refactoring planned |

### Watch List (Approaching 1,000 lines)

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | 994 | ⚠️ Near threshold |
| LayerRenderer.js | 966 | Watch |

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
- ✅ mustBePosted() added to all write API modules

### Previously Resolved P1/P2 Issues
- ✅ 231 weak test assertions fixed (209 of 231, 22 remaining)
- ✅ 62 real setTimeout in tests fixed (100% complete)
- ✅ Promise chain error handling added
- ✅ Z-index constants centralized
- ✅ SlidePropertiesPanel.js coverage improved
- ✅ InlineTextEditor.js branch coverage above 80%
- ✅ ViewerManager.js branch coverage 80.14%
- ✅ LayerPanel.js branch coverage 80.27%
- ✅ APIManager.js branch coverage 80.95%
- ✅ StateManager lock recovery implemented
- ✅ pendingOperations queue protection added
- ✅ Canvas context null checks added
- ✅ DEBUG comments cleaned up
- ✅ Tautological assertions (expect(true).toBe(true)) fixed
- ✅ ShapeLibraryPanel DocumentFragment performance fix
- ✅ InlineTextEditor resize debouncing added

---

## Rules & Guidelines

### The Strict Types Rule (PHP)

All PHP files should declare strict types:
```php
<?php
declare(strict_types=1);
```

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

### The innerHTML Rule

When setting innerHTML:
1. **Never** with user-provided content
2. **Prefer** DOM construction (createElement, textContent, appendChild)
3. **Document** why innerHTML is necessary if used
4. **Verify** all inputs are static strings or sanitized (mw.message())

### The Test Assertion Rule

When writing test assertions:
1. **Avoid** toBeTruthy() / toBeFalsy() — too permissive
2. **Use** toBeDefined() for existence checks
3. **Use** toBeInstanceOf() for type checks
4. **Use** toBe() or toEqual() for specific value checks
5. **Use** toBeNull() or toBeUndefined() for null checks
6. **Use** not.toBeNull() instead of toBeTruthy() for DOM elements

### The Test Timer Rule

When testing async code with delays:
1. **Use** jest.useFakeTimers() for timer-dependent tests
2. **Use** jest.runAllTimers() to advance timers
3. **Avoid** real setTimeout in tests — causes flakiness
4. **Remember** to call jest.useRealTimers() in afterEach

### The ReDoS Protection Rule

When using regex for user input validation:
1. **Add** length check before regex matching
2. **Prefer** simple patterns over complex nested quantifiers
3. **Test** with adversarial inputs
4. **Consider** non-regex validation where possible

### The Error Handling Rule (PHP)

When handling errors in database operations:
1. **Be consistent** with return types (null vs false vs 0)
2. **Throw exceptions** for unrecoverable errors
3. **Return null** for "not found" vs throw for "error"
4. **Log** all errors with appropriate context

### The API Security Rule

When creating write API modules:
1. **Require** CSRF token: `needsToken() { return 'csrf'; }`
2. **Declare** write mode: `isWriteMode() { return true; }`
3. **Enforce** POST: `mustBePosted() { return true; }`
4. **Check** permissions before any action

### The i18n Rule

When adding user-facing strings:
1. **Always** use mw.message() for user-visible text
2. **Add** key to i18n/en.json
3. **Document** in i18n/qqq.json
4. **Register** in extension.json ResourceModules messages

---

## Success Criteria for World-Class Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| No critical security issues | ✅ | All fixed |
| PHP strict_types declaration | 🔴 | 0/40 files |
| ReDoS protection | 🔴 | Needs color validator fix |
| Statement coverage >90% | ✅ 94.40% | Excellent |
| Branch coverage >80% | ✅ 84.80% | Excellent |
| No race conditions | ✅ | All fixed |
| ESLint clean | ✅ | 0 errors |
| No console.log in prod | ✅ | Fixed |
| localStorage quota handling | ✅ | Try-catch implemented |
| Memory leak prevention | ✅ | EventTracker, TimeoutTracker |
| Destroy methods complete | ✅ | All components have cleanup |
| Animation frame cleanup | ✅ | cancelAnimationFrame in destroy |
| Zero skipped tests | ✅ | All tests run |
| All priority files at 80%+ branch | ✅ | Complete |
| i18n complete | 🟡 | 4 messages missing qqq.json |
| Strong test assertions | 🟡 | 22 weak assertions remain |
| Fake timers in tests | ✅ | 100% migrated |
| Consistent PHP error types | 🟡 | Needs standardization |

### Gaps Preventing World-Class Status

| Gap | Priority | Status | Impact |
|-----|----------|--------|--------|
| Missing PHP strict_types | P1 | 🔴 Open | High - type safety |
| ReDoS vulnerability | P1 | 🔴 Open | Medium - security |
| Weak test assertions | P1 | 🟡 Open | Medium - false positives |
| PHP god classes | P3 | 🟡 Planned | Low - maintainability |
| Deprecated code | P3 | 🟡 Documented | Low - technical debt |

---

## Summary

**Rating: 8.5/10** — Production-ready, high quality

**Strengths:**
- ✅ 10,574 passing tests with 94.40% statement coverage
- ✅ 84.80% branch coverage
- ✅ 15 working drawing tools + Slide Mode
- ✅ Professional architecture (facades, delegation, controllers)
- ✅ Named layer sets with version history
- ✅ Shape library with 1,310 shapes
- ✅ Emoji picker with 2,817 emoji
- ✅ Mobile touch support
- ✅ innerHTML usage audited and safe
- ✅ 100% ES6 class migration (126 files)
- ✅ Proper memory management (EventTracker, TimeoutTracker, cancelAnimationFrame)
- ✅ Zero skipped tests
- ✅ All previous P0 security issues fixed
- ✅ mustBePosted() on all write API modules
- ✅ No console.log in production code
- ✅ Good JSDoc documentation

**Immediate Priorities (P1):**
1. 🔴 Add `declare(strict_types=1)` to all 40 PHP files
2. 🔴 Add ReDoS protection to ColorValidator
3. 🟡 Replace remaining 22 weak test assertions

**Medium-Term Priorities (P2):**
- 🟡 Standardize PHP error return types
- 🟡 Replace JSON.parse/stringify cloning
- 🟡 Update outdated documentation
- 🟡 Fix missing qqq.json entries

**Long-Term Priorities (P3):**
- 🟡 Refactor PHP god classes
- 🟡 Remove deprecated code
- 🟡 TypeScript migration
- 🟡 Visual regression testing

---

*Plan updated: January 24, 2026*  
*Version: 1.5.29*  
*Based on verified test run: 10,574 tests, 94.40% statement coverage, 84.80% branch coverage*
