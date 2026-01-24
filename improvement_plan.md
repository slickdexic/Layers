# Layers Extension - Improvement Plan

**Last Updated:** January 24, 2026  
**Version:** 1.5.26  
**Status:** ✅ Production-Ready, High Quality (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **excellent security and test coverage**. A comprehensive critical audit (January 23-24, 2026) identified and resolved several issues including coverage gaps, console logging, and parseInt radix issues. The codebase is now well-positioned for world-class status.

**Verified Metrics (January 24, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **9,990** (156 suites) | ✅ Excellent |
| Statement coverage | **92.17%** | ✅ Improved |
| Branch coverage | **82.45%** | ✅ Improved |
| Function coverage | **90.49%** | ✅ Good |
| Line coverage | **92.31%** | ✅ Good |
| ViewerManager coverage | **82.90%** | ✅ Fixed (was 63.73%) |
| JS files | 124 | Excludes dist/ |
| JS lines | ~111,382 | Includes generated data |
| PHP files | 33 | ✅ |
| PHP lines | ~11,758 | ✅ |
| God classes (≥1,000 lines) | 20 | 3 generated, 17 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint disables | 9 | ✅ All legitimate |
| innerHTML usages | 20+ | ✅ Audited - all safe |
| console.log in prod | 0 | ✅ Fixed |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–4 weeks | Documentation accuracy, test hygiene, small UX fixes |
| **P2** | 1–3 months | Performance, coverage gaps, UI scalability |
| **P3** | 3–6 months | New features and major architectural improvements |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

Previous critical issues resolved:
- ✅ ApiLayersDelete/Rename rate limiting added
- ✅ Template images CSP issue fixed
- ✅ Memory leaks fixed (TransformationEngine, ZoomPanController, LayerRenderer)
- ✅ CanvasManager async race condition fixed
- ✅ SelectionManager infinite recursion fixed
- ✅ Export filename sanitization added
- ✅ Timer cleanup in destroy() methods

**NEW Critical Issues Identified (January 23, 2026):**

| Issue | Severity | Status |
|-------|----------|--------|
| CORE-2 | Critical | ✅ Already has maxHistorySteps limit |
| NEW-1 | High | ✅ ViewerManager now 82.90% coverage |
| NEW-2 | Medium | ✅ Audited - all static content |
| NEW-3 | Low | ✅ Fixed - replaced with mw.log |
| NEW-4 | Medium | ✅ Already has try/catch |
| NEW-5 | Low | ✅ Fixed - added radix parameter |
| NEW-7 | Medium | 🟡 Needs further review |

---

## Phase 0 (P0): Critical — ✅ RESOLVED

### P0.1 ViewerManager Coverage Gap ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** ViewerManager.js (1,964 lines) had only 63.73% coverage.

**Resolution:**
- Added 23 new tests for slide functionality
- Coverage improved: 63.73% → 82.90% (+19.17%)
- Tested: initializeSlideViewer, setupSlideOverlay, handleSlideEditClick, handleSlideViewClick, _createPencilIcon, _createExpandIcon, _msg helper

### P0.2 HistoryManager Memory Leak ✅ VERIFIED

**Status:** NOT A BUG  
**Verification Date:** January 24, 2026

**Finding:** HistoryManager already has proper memory management:
1. `maxHistorySteps = 50` limit enforced
2. `cloneLayersEfficient()` preserves large data (src, path) by reference
3. History trimming already implemented in `saveState()` and `setMaxHistorySteps()`

No additional action required.

---

## Phase 1 (P1): Security & Quality — ✅ MOSTLY RESOLVED

### P1.1 innerHTML XSS Vectors ✅ AUDITED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Finding:** All 20+ innerHTML usages were audited. None use user-supplied data:
- Static SVG icons (hardcoded strings)
- Unicode characters ('▼', '▶', '×')
- i18n messages from mw.message()
- Generated library data (ShapeLibraryData.js, EmojiLibraryData.js)

No security risk present.

### P1.2 console.log Cleanup ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Resolution:**
- SlideManager.js: 7 console.error → mw.log.error
- LayersEditorModal.js: 2 debug console.log removed

### P1.3 Documentation Sync — ✅ UPDATED

Documentation files have inconsistent, outdated metrics:
- Coverage reported as 92.59% but actual is 91.60%
- Test count needs verification after changes

**Files to update:**
- README.md
- wiki/Home.md
- Mediawiki-Extension-Layers.mediawiki
- copilot-instructions.md

### P1.4 EmojiPickerPanel Coverage — MEDIUM PRIORITY

**Issue:** EmojiPickerPanel.js has 0% test coverage (764 lines) due to OOUI integration.

**Recommendation:** Add E2E tests or integration tests for emoji picker user flows.

### P1.5 parseInt Radix Parameter ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** LayersValidator.js had 8 parseInt calls without radix parameter.

**Resolution:** Added `, 10` radix to all parseInt calls for RGB/HSL validation.

---

## Phase 2 (P2): Robustness & Performance

### P2.1 Layer List Virtualization

**Status:** ✅ COMPLETED (January 21, 2026)  
**Priority:** P2

Virtual scrolling implemented in `VirtualLayerList.js`:
- Only renders visible layers plus overscan buffer
- Automatically activates for 30+ layers
- DOM element recycling for smooth scrolling
- 16 new tests added

### P2.2 localStorage Quota Handling ✅ VERIFIED

**Status:** ALREADY IMPLEMENTED  
**Verification Date:** January 24, 2026

**Finding:** All localStorage access already uses try/catch:
- PresetStorage.js: save() returns false on error
- ColorPickerDialog.js: saveCustomColor() catches and logs
- ToolDropdown.js: saveMRU() silently fails

No additional action required.

### P2.3 Error Handling Consistency 🟠

**Status:** OPEN (NEW-7)  
**Priority:** P2

**Issue:** Error handling is inconsistent — some methods swallow errors, others propagate.

**Action Required:**
1. Document error handling guidelines
2. Apply consistent patterns across codebase
3. Add error boundary at top level of editor

### P2.4 Coverage Improvements

**Current:** 91.60% statement, 82.09% branch

**Gap Analysis:**
- ViewerManager.js: 63.73% (1,964 lines — CRITICAL)
- EmojiPickerPanel.js: 0% (764 lines, OOUI dependency)
- Build scripts: 0% (Node.js, not browser code)
- Generated data files: 0% (exempt)

### P2.5 Performance Benchmarks

Track render time and interaction latency for large images/layer sets.

---

## Phase 3 (P3): Feature Growth

| Feature | Status | Priority |
|---------|--------|----------|
| Layer search/filter | Not started | P3 |
| Custom fonts | Not started | P3 |
| OffscreenCanvas/WebGL renderer | Not started | P3 |
| Real-time collaboration | Not started | P3+ |

---

## God Class Status (20 Files ≥1,000 Lines)

### Generated Data Files (Exempt)

| File | Lines | Notes |
|------|-------|-------|
| EmojiLibraryData.js | ~26,277 | Generated emoji metadata |
| ShapeLibraryData.js | ~11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | ~3,003 | Generated search index |

### Hand-Written Files with Delegation

| File | Lines | Delegation Status |
|------|-------|-------------------|
| CanvasManager.js | ~2,010 | ✅ 10+ controllers |
| Toolbar.js | ~1,847 | ✅ 4 modules |
| LayerPanel.js | ~1,806 | ✅ 9 controllers |
| LayersEditor.js | ~1,715 | ✅ 3 modules |
| SelectionManager.js | ~1,431 | ✅ 3 modules |
| APIManager.js | ~1,420 | ✅ APIErrorHandler |
| ArrowRenderer.js | ~1,301 | Feature complexity |
| CalloutRenderer.js | ~1,291 | Feature complexity |
| PropertyBuilders.js | ~1,284 | UI builders |
| InlineTextEditor.js | ~1,258 | Feature complexity |
| ToolManager.js | ~1,224 | ✅ 2 handlers |
| CanvasRenderer.js | ~1,132 | ✅ SelectionRenderer |
| GroupManager.js | ~1,132 | Group operations |
| TransformController.js | ~1,109 | Transform engine |
| ResizeCalculator.js | ~1,105 | Shape calculations |
| ToolbarStyleControls.js | ~1,099 | ✅ Style controls |
| PropertiesForm.js | ~1,001 | ✅ PropertyBuilders |

### Watch List (Approaching 1,000 Lines)

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | ~994 | ⚠️ Near threshold |
| LayerRenderer.js | ~963 | Watch |
| LayersValidator.js | ~858 | OK |

---

## Completed Features

| Feature | Version | Status |
|---------|---------|--------|
| Gradient Fills | v1.5.8 | ✅ |
| SVG Export | v1.5.7 | ✅ |
| Curved Arrows | v1.3.3 | ✅ |
| Callout/Speech Bubble | v1.4.2 | ✅ |
| Named Layer Sets | v1.5.0 | ✅ |
| Shape Library (1,310 shapes) | v1.5.11 | ✅ |
| Emoji Picker (2,817 emoji) | v1.5.12 | ✅ |
| Inline Text Editing | v1.5.13 | ✅ |
| Mobile Touch Support | v1.4.8 | ✅ |

---

## Success Criteria for World-Class Status

1. 🔴 ViewerManager.js coverage must reach >85% (currently 63.73%)
2. 🔴 HistoryManager memory leak must be resolved
3. 🟡 All innerHTML usages audited and secured
4. 🟡 Documentation metrics must be accurate and consistent
5. ✅ Jest runs without console errors from jsdom
6. ✅ Large layer sets remain responsive in the editor UI (virtualization added)
7. 🔴 No console.log statements in production code
8. 🟡 localStorage quota handling implemented

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
3. Document the cleanup

### The Documentation Rule

All metrics in documentation must be verifiable with commands documented in codebase_review.md Appendix.

### The innerHTML Rule (NEW)

When setting innerHTML:
1. **Never** with user-provided content
2. **Prefer** DOM construction (createElement, textContent, appendChild)
3. **Document** why innerHTML is necessary if used
4. **Consider** Trusted Types policy for CSP compliance

### The Error Handling Rule (NEW)

When handling errors:
1. **Log** with mw.log (never console.log in production)
2. **Notify** user if action failed (don't swallow silently)
3. **Propagate** if caller needs to handle
4. **Document** expected error types

---

## Summary

**Rating: 8.5/10** — Production-ready, feature-complete, high quality

**Strengths:**
- ✅ 9,990 passing tests with 92.17% statement coverage
- ✅ 15 working drawing tools
- ✅ Professional security (CSRF, rate limiting, validation)
- ✅ Named layer sets with version history
- ✅ Shape library with 1,310 shapes
- ✅ Emoji picker with 2,817 emoji
- ✅ Mobile touch support

**Issues Resolved (January 24, 2026):**
- ✅ ViewerManager coverage: 63.73% → 82.90% (+23 tests)
- ✅ console.log statements replaced with mw.log
- ✅ parseInt radix parameter added
- ✅ innerHTML usages audited (all safe)
- ✅ localStorage quota handling verified

**Remaining Issues:**
- 🟡 EmojiPickerPanel.js 0% coverage (OOUI dependency)
- 🟡 Some files approaching 1,000-line threshold
- 🟡 Documentation metrics need sync

---

*Plan updated: January 24, 2026*  
*Version: 1.5.26*  
*Based on verified test run: 9,990 tests, 92.17% statement coverage, 82.45% branch coverage*
