# Layers Extension - Improvement Plan

**Last Updated:** January 24, 2026  
**Version:** 1.5.27  
**Status:** ✅ Production-Ready, High Quality (8.0/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **excellent security and test coverage**. A comprehensive critical audit (January 24, 2026) verified that most previously identified issues have been resolved. The codebase is well-positioned for world-class status.

**Verified Metrics (January 24, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **9,994** (156 suites) | ✅ Excellent |
| Statement coverage | **92.17%** | ✅ Excellent |
| Branch coverage | **82.45%** | ✅ Good |
| Function coverage | **90.49%** | ✅ Good |
| Line coverage | **92.31%** | ✅ Good |
| ViewerManager coverage | **82.99%** | ✅ Fixed (was 63.73%) |
| JS files | 126 | Excludes dist/ |
| JS lines | ~113,847 | Includes generated data |
| PHP files | 33 | ✅ |
| God classes (≥1,000 lines) | 20 | 3 generated, 17 hand-written |
| ESLint errors | 0 | ✅ |
| ESLint disables | 9 | ✅ All legitimate |
| innerHTML usages | 20+ | ✅ Audited - all safe |
| console.log in prod | 0 | ✅ Scripts only |

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

No critical issues remaining. Previous critical issues resolved:
- ✅ ApiLayersDelete/Rename rate limiting added
- ✅ Template images CSP issue fixed
- ✅ Memory leaks fixed (TransformationEngine, ZoomPanController, LayerRenderer)
- ✅ CanvasManager async race condition fixed
- ✅ SelectionManager infinite recursion fixed
- ✅ Export filename sanitization added
- ✅ Timer cleanup in destroy() methods
- ✅ CORE-3 APIManager save race condition fixed
- ✅ CORE-4 GroupManager circular reference fixed
- ✅ ViewerManager coverage improved to 82.99%

---

## Phase 1 (P1): Code Quality — ✅ RESOLVED

### P1.1 parseInt Radix Parameter ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** 9 parseInt calls missing radix parameter.

**Resolution:** Added `, 10` radix to all parseInt calls in:
- ValidationHelpers.js (8 occurrences)
- NumericValidator.js (1 occurrence)

### P1.2 EmojiPickerPanel Coverage 🟡 E2E NEEDED

**Severity:** Medium  
**File:** [resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js](resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js)

**Issue:** Low test coverage due to OOUI integration complexity.

**Action:**
1. Add Playwright E2E tests for emoji picker user flows
2. Consider mocking OOUI for unit testing

### P1.3 Error Handling Guidelines ✅ DOCUMENTED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** Inconsistent error handling patterns across codebase.

**Resolution:** Added comprehensive error handling guidelines to CONTRIBUTING.md with:
- Three documented patterns (Log and Continue, Log and Reject, Validate and Return)
- Clear rules for when to use each pattern
- Examples from existing codebase

---

## Phase 2 (P2): Architecture & Documentation

### P2.1 i18n Fallback Centralization

**Status:** Open  
**Priority:** Low

**Issue:** Hardcoded English fallback strings scattered across files.

**Options:**
1. Create `FallbackMessages.js` constant file
2. Document that mw.message() with qqq.json is sufficient
3. Accept current pattern as acceptable

### P2.2 Documentation Sync

**Status:** Partially Done  
**Priority:** Medium

Keep these files synchronized with actual metrics:
- README.md
- wiki/Home.md
- Mediawiki-Extension-Layers.mediawiki
- .github/copilot-instructions.md

**Current verified values:**
- Tests: 9,994 passing
- Coverage: 92.17% statement, 82.45% branch
- JS files: 126
- JS lines: ~113,847

### P2.3 ShapeRenderer Size Monitoring

**Status:** Watch  
**Priority:** Low

**File:** ShapeRenderer.js (~994 lines)

Currently at 994 lines, approaching the 1,000-line threshold. If it grows:
- Extract blur effect to EffectsRenderer
- Extract hit testing to dedicated module

---

## Phase 3 (P3): Future Improvements

### P3.1 TypeScript Migration

**Status:** Not Started  
**Priority:** P3

Consider TypeScript for complex modules:
- StateManager
- APIManager
- GroupManager
- SelectionManager

Benefits:
- Catch type errors at compile time
- Better IDE support
- Self-documenting interfaces

### P3.2 Visual Regression Testing

**Status:** Not Started  
**Priority:** P3

Add visual snapshot tests for:
- Canvas rendering
- Shape rendering
- Text rendering
- Dark mode compatibility

Tools to consider:
- Percy
- Chromatic
- jest-image-snapshot

### P3.3 Real-Time Collaboration

**Status:** Not Started  
**Priority:** P3+

Architecture considerations:
- Operational Transforms (OT) or CRDT
- WebSocket integration
- Conflict resolution strategy

---

## God Class Status (20 Files ≥1,000 Lines)

### Generated Data Files (Exempt)

| File | Lines | Notes |
|------|-------|-------|
| EmojiLibraryData.js | ~26,277 | Generated emoji metadata |
| ShapeLibraryData.js | ~11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | ~3,003 | Generated search index |

### Hand-Written Files with Delegation

| File | Lines | Delegation Status | Notes |
|------|-------|-------------------|-------|
| CanvasManager.js | ~2,011 | ✅ 10+ controllers | At threshold |
| ViewerManager.js | ~1,996 | ✅ Delegates to renderers | ✅ Fixed coverage |
| Toolbar.js | ~1,847 | ✅ 4 modules | OK |
| LayerPanel.js | ~1,806 | ✅ 9 controllers | OK |
| LayersEditor.js | ~1,768 | ✅ 3 modules | OK |
| APIManager.js | ~1,513 | ✅ APIErrorHandler | ✅ Fixed race condition |
| SelectionManager.js | ~1,431 | ✅ 3 modules | OK |
| ArrowRenderer.js | ~1,310 | N/A - complexity | OK |
| CalloutRenderer.js | ~1,291 | N/A - rendering | OK |
| PropertyBuilders.js | ~1,284 | N/A - builders | OK |
| InlineTextEditor.js | ~1,258 | N/A - feature | OK |
| ToolManager.js | ~1,224 | ✅ 2 handlers | OK |
| GroupManager.js | ~1,172 | N/A - operations | ✅ Fixed circular ref |
| CanvasRenderer.js | ~1,132 | ✅ SelectionRenderer | OK |
| TransformController.js | ~1,110 | N/A - transforms | OK |
| ResizeCalculator.js | ~1,105 | N/A - math | OK |
| ToolbarStyleControls.js | ~1,099 | ✅ Style controls | OK |
| PropertiesForm.js | ~1,001 | ✅ PropertyBuilders | OK |

### Watch List (Approaching 1,000 Lines)

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | ~994 | ⚠️ Near threshold |
| LayerRenderer.js | ~963 | Watch |

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
| Virtual Layer List | v1.5.21 | ✅ |

---

## Success Criteria for World-Class Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| ViewerManager coverage >80% | ✅ 82.99% | Fixed |
| No critical security issues | ✅ | innerHTML audited |
| No race conditions | ✅ | CORE-3, CORE-4 fixed |
| Consistent error handling | 🟡 | Needs documentation |
| Documentation accuracy | 🟡 | Needs sync |
| Test coverage >90% | ✅ 92.17% | Excellent |
| ESLint clean | ✅ | 0 errors, 9 legitimate disables |
| No console.log in prod | ✅ | Scripts only |
| localStorage quota handling | ✅ | Already implemented |

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

### The innerHTML Rule

When setting innerHTML:
1. **Never** with user-provided content
2. **Prefer** DOM construction (createElement, textContent, appendChild)
3. **Document** why innerHTML is necessary if used
4. **Consider** Trusted Types policy for CSP compliance

### The Error Handling Rule

When handling errors:
1. **Log** with mw.log (never console.log in production)
2. **Notify** user if action failed (don't swallow silently)
3. **Propagate** if caller needs to handle
4. **Document** expected error types

### The parseInt Rule (NEW)

When using parseInt():
1. **Always** specify radix parameter: `parseInt(value, 10)`
2. **Consider** `Number()` or `+value` for simple conversions
3. **Validate** input before parsing

---

## Summary

**Rating: 8.0/10** — Production-ready, feature-complete, high quality

**Strengths:**
- ✅ 9,994 passing tests with 92.17% statement coverage
- ✅ 15 working drawing tools
- ✅ Professional security (CSRF, rate limiting, validation)
- ✅ Named layer sets with version history
- ✅ Shape library with 1,310 shapes
- ✅ Emoji picker with 2,817 emoji
- ✅ Mobile touch support
- ✅ All race conditions fixed
- ✅ innerHTML usage audited and safe

**Open Issues (Low Priority):**
- 🟡 parseInt radix parameter (9 calls)
- 🟡 EmojiPickerPanel E2E tests needed
- 🟡 Error handling documentation needed
- 🟡 i18n fallback centralization (optional)

**Next Actions:**
1. Add radix to parseInt calls in ValidationHelpers.js
2. Add Playwright E2E tests for EmojiPickerPanel
3. Document error handling guidelines
4. Sync documentation metrics

---

*Plan updated: January 24, 2026*  
*Version: 1.5.27*  
*Based on verified test run: 9,994 tests, 92.17% statement coverage, 82.45% branch coverage*
