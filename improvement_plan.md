# Layers Extension - Improvement Plan

**Last Updated:** January 26, 2026  
**Version:** 1.5.28  
**Status:** ✅ Production-Ready, High Quality (8.5/10)

> **📋 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready and high quality** with **excellent security and test coverage**. All P0, P1, and P2 items have been completed. Only P3 (low-priority) items remain.

**Verified Metrics (January 26, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **10,135** (156 suites) | ✅ Excellent |
| Statement coverage | **92.25%** | ✅ Excellent |
| Branch coverage | **82.47%** | ✅ Good |
| Function coverage | **90.52%** | ✅ Excellent |
| Line coverage | **92.38%** | ✅ Excellent |
| JS files | 126 | Excludes dist/ |
| JS lines | ~113,870 | Includes generated data |
| PHP files | 40 | ✅ |
| PHP lines | ~13,908 | ✅ |
| God classes (≥1,000 lines) | 21 | 3 generated, 18 hand-written |
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

No critical issues remaining. The codebase is production-ready.

**Previously Resolved P0 Issues:**
- ✅ ApiLayersDelete/Rename rate limiting added
- ✅ Template images CSP issue fixed
- ✅ Memory leaks fixed (TransformationEngine, ZoomPanController, LayerRenderer)
- ✅ CanvasManager async race condition fixed
- ✅ SelectionManager infinite recursion fixed
- ✅ Export filename sanitization added
- ✅ Timer cleanup in destroy() methods
- ✅ APIManager save race condition fixed (saveInProgress flag)
- ✅ GroupManager circular reference fixed (isDescendantOf check)

---

## Phase 1 (P1): Test Coverage Improvements

### P1.1 SlidePropertiesPanel.js Coverage ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 24, 2026  
**Previous Coverage:** 79.21% statements, 44.16% branches

**Resolution:** Added 27 new tests covering:
- Debounced dimension input handlers with timer tests
- `updateCanvasSize` with various parameter combinations  
- `openBackgroundColorPicker` interaction with toolbar
- `setBackgroundColor` state updates and UI sync
- Edge cases: missing editor, missing toolbar
- Clipboard fallback on error
- Lock mode indicators

**Result:** 75 tests now passing for SlidePropertiesPanel

---

### P1.2 InlineTextEditor.js Branch Coverage ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 26, 2026  
**Previous Coverage:** 74.74% branches, 54.54% functions

**Resolution:** Added 61 new tests covering:
- All toolbar building methods (`_createFontSelect`, `_createFontSizeInput`, `_createFormatButton`, `_createAlignButton`, `_createColorPicker`)
- ColorPickerDialog integration with mock dialog
- Font select and size input blur handling with fake timers
- Event handler removal (`_removeEventHandlers`)
- Container fallback paths (`_getContainer`)
- Toolbar drag setup and offset calculation
- Textbox empty text edge case
- Destroy while editing
- Redraw fallback when renderLayers unavailable

**Result:** 176 tests now passing for InlineTextEditor
- 94.66% statement coverage
- 86.85% branch coverage  
- 81.81% function coverage (above 80% threshold ✅)
- 96.02% line coverage

---

### P1.3 StateManager Lock Recovery ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 24, 2026

**Resolution:** Implemented comprehensive lock recovery:
1. ✅ Added `forceUnlock()` method for manual emergency recovery
2. ✅ Added 30-second auto-recovery timeout for stuck locks
3. ✅ Added `isStateLocked()` and `getPendingOperationCount()` diagnostics
4. ✅ Added constants: `LOCK_DETECTION_TIMEOUT_MS` (5s), `LOCK_AUTO_RECOVERY_TIMEOUT_MS` (30s)

**Behavior:** 5s timeout logs warning, 30s timeout forces unlock with error log.

---

## Phase 2 (P2): Architecture Improvements

### P2.1 pendingOperations Queue Limit ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 24, 2026

**Resolution:** Implemented queue protection:
1. ✅ Added `MAX_PENDING_OPERATIONS = 100` constant
2. ✅ When exceeded, drops oldest operations with warning log
3. ✅ Logs warning: `[StateManager] pendingOperations queue full (100), dropping oldest`

**Protection:** Prevents memory exhaustion in pathological lock scenarios.

---

### P2.2 Canvas Context Null Checks ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 24, 2026

**Resolution:** Added defensive null checks:
1. ✅ CanvasManager.js: Added null check in `initializeCanvas()` with `mw.log.error` warning
2. ✅ CanvasRenderer.js: Added null check in `initializeCanvas()` with `mw.log.error` warning

**Pattern Applied:**
```javascript
this.ctx = this.canvas.getContext( '2d' );
if ( !this.ctx ) {
    mw.log.error( '[Module] Failed to get 2D context - hardware acceleration may be disabled' );
}
```

---

### P2.3 EffectsRenderer Canvas Pooling � DEFERRED

**Status:** Deferred  
**Decision Date:** January 24, 2026

**Reason for Deferral:** Complex refactoring with low ROI. The current implementation:
- Creates temporary canvases only when blur effects are used (rare)
- Canvases are garbage collected after use
- No memory leaks identified in testing

**Future Consideration:** If memory profiling shows issues in long blur-heavy sessions, revisit.

**Benefit if Implemented:** Reduced memory pressure in long editing sessions with blur effects.

---

### P2.4 Documentation Sync ✅ COMPLETE

**Status:** Complete  
**Resolution Date:** January 24, 2026

Metrics synchronized across all documentation files:
- README.md — Updated version, coverage badges
- codebase_review.md — Fresh comprehensive audit
- .github/copilot-instructions.md — Updated metrics

---

## Phase 3 (P3): Long-Term Improvements

### P3.1 i18n Fallback Centralization

**Status:** Open  
**Priority:** P3 - Low

**Options:**
1. Create `FallbackMessages.js` constant file
2. Document current pattern as acceptable defense-in-depth
3. Remove fallbacks and trust mw.message()

**Recommendation:** Document as acceptable — fallbacks are rare and provide safety net.

---

### P3.2 Null Checking Style Guide

**Status:** Open  
**Priority:** P3 - Low

**Issue:** Inconsistent null/undefined checking patterns across codebase.

**Action Items:**
1. Document preferred pattern in CONTRIBUTING.md
2. Recommended: `!= null` for checking both null/undefined
3. Use explicit checks when type distinction matters

---

### P3.3 TypeScript Migration

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

### P3.4 Visual Regression Testing

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

### P3.5 Real-Time Collaboration

**Status:** Not Started  
**Priority:** P3+

Architecture considerations:
- Operational Transforms (OT) or CRDT
- WebSocket integration
- Conflict resolution strategy

---

## God Class Status (21 Files ≥1,000 Lines)

### Generated Data Files (Exempt from Refactoring)

| File | Lines | Notes |
|------|-------|-------|
| EmojiLibraryData.js | ~26,277 | Generated emoji metadata |
| ShapeLibraryData.js | ~11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | ~3,003 | Generated search index |

### Hand-Written Files with Delegation (18 total)

| File | Lines | Delegation Status | Notes |
|------|-------|-------------------|-------|
| CanvasManager.js | ~2,039 | ✅ 10+ controllers | Facade pattern, at limit |
| ViewerManager.js | ~2,004 | ✅ Delegates to renderers | OK |
| LayersEditor.js | ~1,800 | ✅ 3 modules | OK |
| Toolbar.js | ~1,847 | ✅ 4 modules | OK |
| LayerPanel.js | ~1,806 | ✅ 9 controllers | OK |
| APIManager.js | ~1,513 | ✅ APIErrorHandler | OK |
| SelectionManager.js | ~1,431 | ✅ 3 modules | OK |
| ArrowRenderer.js | ~1,310 | N/A - math complexity | OK |
| CalloutRenderer.js | ~1,291 | N/A - rendering logic | OK |
| InlineTextEditor.js | ~1,273 | N/A - feature complexity | ⚠️ Branch coverage |
| PropertyBuilders.js | ~1,284 | N/A - UI builders | OK |
| ToolManager.js | ~1,224 | ✅ 2 handlers | OK |
| GroupManager.js | ~1,172 | N/A - group operations | OK |
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
| Slide Mode | v1.5.22 | ✅ |
| Dimension Tool | v1.5.25 | ✅ |

---

## Success Criteria for World-Class Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| No critical security issues | ✅ | innerHTML, CSRF audited |
| Statement coverage >90% | ✅ 92.25% | Excellent |
| Branch coverage >80% | ✅ 82.47% | Good |
| No race conditions | ✅ | All fixed |
| ESLint clean | ✅ | 0 errors |
| No console.log in prod | ✅ | Scripts only |
| localStorage quota handling | ✅ | Try-catch implemented |
| SlidePropertiesPanel tests | ✅ 75 tests | P1.1 COMPLETE |
| InlineTextEditor coverage | ✅ 81.81% func | P1.2 COMPLETE |
| StateManager lock recovery | ✅ | P1.3 COMPLETE |
| Canvas context null checks | ✅ | P2.2 COMPLETE |

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

### The parseInt Rule

When using parseInt():
1. **Always** specify radix parameter: `parseInt(value, 10)`
2. **Consider** `Number()` or `+value` for simple conversions
3. **Validate** input before parsing

### The Canvas Context Rule (NEW)

When calling getContext('2d'):
1. **Check** if return value is null
2. **Log** warning if context unavailable
3. **Return** gracefully or show user-friendly error

---

## Summary

**Rating: 8.5/10** — Production-ready, feature-complete, high quality

**Strengths:**
- ✅ 10,135 passing tests with 92.25% statement coverage
- ✅ 15 working drawing tools + Slide Mode
- ✅ Professional security (CSRF, rate limiting, validation)
- ✅ Named layer sets with version history
- ✅ Shape library with 1,310 shapes
- ✅ Emoji picker with 2,817 emoji
- ✅ Mobile touch support
- ✅ All security audit findings resolved
- ✅ innerHTML usage audited and safe
- ✅ SlidePropertiesPanel tests complete (75 tests)
- ✅ InlineTextEditor coverage improved (81.81% function)
- ✅ StateManager lock recovery with auto-timeout
- ✅ Canvas context null checks added

**Remaining P3 (Low Priority):**
- 🟡 i18n fallback centralization (optional)
- 🟡 Null checking style guide (documentation)
- 🟡 TypeScript migration (long-term)
- 🟡 Visual regression testing (nice-to-have)
- 🟡 EffectsRenderer canvas pooling (deferred)

**All P0, P1, P2 items are now COMPLETE.**

---

*Plan updated: January 26, 2026*  
*Version: 1.5.28*  
*Based on verified test run: 10,135 tests, 92.25% statement coverage, 82.47% branch coverage*
