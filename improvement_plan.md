# Layers Extension - Improvement Plan

**Last Updated:** December 27, 2025  
**Status:** ✅ P0 items RESOLVED, P1.1 COMPLETE  
**Version:** 1.2.8  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** with excellent test coverage. Recent improvements resolved critical coverage gaps and proactively prevented a god class from forming.

**Current Rating: 8.3/10** (improved from 8.2/10)

---

## Current State (December 26, 2025)

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Complete | 14 tools, alignment, presets, named sets, smart guides, blur fill |
| **Security** | ✅ Resolved | All known security issues fixed |
| **Testing** | ✅ Excellent | 6,837 tests, 92.4% statement coverage, 80.1% branch coverage |
| **ES6 Migration** | ✅ Complete | 87 classes, 0 prototype patterns |
| **Code Hygiene** | ✅ Excellent | 0 TODO/FIXME/HACK comments |
| **God Classes** | ⚠️ Technical Debt | 8 files >1,000 lines (no new ones added) |
| **Codebase Size** | ⚠️ High | ~49,700 lines, approaching 50K threshold |
| **Mobile** | ❌ Missing | No touch support |

---

## Priority Definitions

| Priority | Timeline | Status |
|----------|----------|--------|
| **P0** | Immediate | ✅ RESOLVED |
| **P1** | 1-4 weeks | ⚠️ In Progress |
| **P2** | 1-3 months | ⏳ Planned |
| **P3** | 3-6 months | ⏳ Not Started |

---

## Phase 0: Critical Issues (P0) - RESOLVED ✅

### P0.1 EffectsRenderer.js Coverage ✅ FIXED

**Before:** 48.7% statement coverage, 43% branch coverage  
**After:** **97.3% statement coverage, 91.5% branch coverage**  
**Solution:** Added 26 comprehensive tests for drawBlurFill method, stroke styles

### P0.2 CanvasRenderer.js Coverage ✅ FIXED

**Before:** 58.5% statement coverage, 47% branch coverage  
**After:** **88.6% statement coverage, 73.9% branch coverage**  
**Solution:** Added 40 tests for blur blend mode methods (_drawBlurClipPath, _drawBlurStroke, _drawBlurContent, _drawRoundedRectPath)

---

## Phase 1: Important Issues (P1) - In Progress

### P1.1 Split ToolbarStyleControls.js ✅ COMPLETE

**Before:** 947 lines (53 lines from god class territory)  
**After:** **798 lines** (well below 1,000 line threshold)  
**Solution:** Extracted text effects controls to new TextEffectsControls.js module (378 lines)

New module: `resources/ext.layers.editor/ui/TextEffectsControls.js`
- Handles: font size, text stroke color/width, text shadow toggle/color
- 42 new unit tests added for full coverage

### P1.2 ESLint Disable Count ✅ ACCEPTABLE

**Current:** 13 eslint-disable comments  
**Status:** All are legitimate fallbacks or API compatibility  
**Action:** None required

### P1.3 Remove Deprecated Code ⏳

8 deprecated items identified. Schedule removal for v2.0:

| File | Item | Action |
|------|------|--------|
| WikitextHooks.php | `getLayerSetNameFromParams()` | Remove in v2.0 |
| WikitextHooks.php | `getLinkTypeFromParams()` | Remove in v2.0 |
| Toolbar.js | `handleKeyboardShortcuts` | Remove now (unused) |
| ModuleRegistry.js | Legacy pattern | Remove in v2.0 |
| CanvasManager.js | Fallback image loading | Remove in v2.0 |
| APIManager.js | `normalizeBooleanProperties()` | Keep (still used) |

---

## Phase 2: Code Quality (P2) - Planned

### P2.1 Address God Classes

8 files now exceed 1,000 lines (was 7):

| File | Lines | Priority |
|------|-------|----------|
| CanvasManager.js | 1,877 | LOW (well-delegated) |
| LayerPanel.js | 1,838 | MEDIUM |
| Toolbar.js | 1,549 | MEDIUM |
| LayersEditor.js | 1,355 | LOW |
| ToolManager.js | 1,261 | LOW |
| **CanvasRenderer.js** | **1,211** | **HIGH - NEW** |
| APIManager.js | 1,207 | LOW |
| SelectionManager.js | 1,194 | LOW |

**Note:** CanvasRenderer.js is new to the god class list and also has low coverage - double priority.

### P2.2 Improve Shared Renderer Coverage

| File | Current | Target |
|------|---------|--------|
| LayerRenderer.js | 82% stmt, 63% branch | 90%+ |
| ShapeRenderer.js | varies | 85%+ |

---

## Phase 3: Features (P3) - Not Started

### P3.1 Mobile/Touch Support ⏳

**Priority:** HIGH (for mobile users)  
**Effort:** 4-6 weeks

Required:
- Touch event handlers in InteractionController
- Responsive toolbar layout
- Gesture support (pinch-to-zoom, two-finger pan)
- Touch-friendly selection handles
- Mobile-optimized layer panel

### P3.2 TypeScript Migration ⏳

**Status:** 5% complete (2 files migrated)  
**Priority:** LOW - ES6 with JSDoc provides adequate type safety

### P3.3 Layer Grouping ⏳

Group multiple layers for bulk operations.  
**Effort:** 2-3 weeks

### P3.4 WCAG 2.1 AA Audit ⏳

Full accessibility compliance audit.  
**Effort:** 2 weeks

---

## God Class Status Tracker

All god classes use the **controller delegation pattern** - they are facades that delegate to specialized controllers, not monolithic code.

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| CanvasManager.js | 1,877 | Facade → 10 controllers | ✅ Acceptable |
| LayerPanel.js | 1,838 | Facade → 7 controllers | ✅ Acceptable |
| Toolbar.js | 1,549 | UI consolidation | ⚠️ Monitor |
| LayersEditor.js | 1,355 | Orchestrator → managers | ✅ Acceptable |
| ToolManager.js | 1,261 | Facade → tool handlers | ✅ Acceptable |
| **CanvasRenderer.js** | **1,211** | SelectionRenderer | ⚠️ **NEW - needs attention** |
| APIManager.js | 1,207 | APIErrorHandler | ✅ Acceptable |
| SelectionManager.js | 1,194 | Facade → selection helpers | ✅ Acceptable |

### Files to Watch (800-1000 lines)

| File | Lines | Risk | Action |
|------|-------|------|--------|
| **ToolbarStyleControls.js** | **947** | 🔴 HIGH | Split proactively |
| ShapeRenderer.js | 903 | ⚠️ MEDIUM | Monitor |
| PropertiesForm.js | 870 | ⚠️ MEDIUM | Monitor |
| LayersValidator.js | 854 | ⚠️ LOW | Stable |
| ResizeCalculator.js | 822 | ⚠️ LOW | Stable |
| LayerRenderer.js | 818 | ⚠️ LOW | Stable |

---

## Progress Tracking

```
Phase 0 (CRITICAL):
P0.1 EffectsRenderer coverage: ░░░░░░░░░░░░░░░░░░░░ 0%   🔴 NEEDS TESTS (49%)
P0.2 CanvasRenderer coverage:  ░░░░░░░░░░░░░░░░░░░░ 0%   🔴 NEEDS TESTS (59%)

Phase 1 (Important):
P1.1 Split ToolbarStyleControls: ░░░░░░░░░░░░░░░░░░ 0%   ⏳ At 947 lines
P1.2 ESLint disables:          ████████████████████ 100% ✅ Acceptable (13)
P1.3 Deprecated removal:       ██░░░░░░░░░░░░░░░░░░ 10%  ⏳ Planned for v2.0

Phase 2 (Code Quality):
P2.1 Address god classes:      ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ 8 files
P2.2 Shared renderer coverage: ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Planned

Phase 3 (Features):
P3.1 Mobile/Touch:             ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.2 TypeScript:               █░░░░░░░░░░░░░░░░░░░ 5%   ⏳ Low Priority
P3.3 Layer Grouping:           ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.4 WCAG Audit:               ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
```

---

## What Would Make This World-Class (10/10)

### Already Have ✅

- 6,729 passing tests with ~91% statement coverage
- 0 TODO/FIXME/HACK comments (excellent code hygiene)
- 100% ES6 classes (86 classes, no legacy patterns)
- Comprehensive documentation (20+ markdown files)
- Accessible UI with ARIA support
- Named layer sets with version history
- Smart guides and key object alignment
- Style presets with import/export
- 4 API endpoints with full validation
- Modal editor mode for iframe editing
- Editor returns to originating page
- Rate limiting and security hardening
- Blur fill mode for all shapes

### Need for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| **Fix coverage gaps** | HIGH - Core rendering undertested | 1-2 weeks | P0 |
| **Mobile/touch support** | HIGH - Opens to 50% more users | 4-6 weeks | P3.1 |
| **Reduce god classes** | MEDIUM - Maintainability | 2-3 weeks | P2.1 |
| **WCAG 2.1 AA certification** | MEDIUM - Enterprise requirement | 2 weeks | P3.4 |
| **Full TypeScript** | LOW - JSDoc is sufficient | 40+ hours | P3.2 |

---

## Rules

### 🔴 The P0 Rule - VIOLATED

Two files have critically low test coverage:
- **EffectsRenderer.js:** 49% statement, 43% branch
- **CanvasRenderer.js:** 59% statement, 47% branch

These are core rendering files. New features should be blocked until coverage is addressed.

### The God Class Rule

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to 2,000 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Hard limit:** No file should exceed 2,000 lines

8 files now exceed 1,000 lines (was 7). ⚠️

### The Timer Rule ✅

When adding setTimeout/setInterval:
1. Store timer ID in instance variable
2. Add clearTimeout/clearInterval in destroy()
3. Document the cleanup

All major files have proper timer cleanup.

### The Dialog Rule ✅

All user-facing dialogs must:
1. Use DialogManager or fallback wrapper
2. Have ARIA attributes
3. Support keyboard navigation
4. Match MediaWiki styling

All dialogs now use DialogManager with fallbacks.

---

## Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total tests | 6,729 | ✅ |
| Statement coverage | 90.9% | ✅ |
| Branch coverage | 78.6% | ✅ |
| Function coverage | 89.7% | ✅ |
| Line coverage | 91.2% | ✅ |
| Test suites | 127 | ✅ |

### Files Needing Attention

| File | Statement | Branch | Risk |
|------|-----------|--------|------|
| **EffectsRenderer.js** | **48.7%** | **43%** | 🔴 CRITICAL |
| **CanvasRenderer.js** | **58.5%** | **47%** | 🔴 CRITICAL |
| LayersNamespace.js | 83.6% | 60.6% | ⚠️ Low (dead code) |
| CanvasManager.js | 79.6% | 64.8% | ⚠️ Medium |

### Good Coverage Files (for reference)

| File | Statement | Branch |
|------|-----------|--------|
| DialogManager.js | 96.1% | 77.2% |
| LayersValidator.js | 96.9% | 95.0% |
| APIManager.js | 86.8% | 74.4% |
| LayersEditor.js | 86.3% | 72.0% |

---

## Next Actions

### Immediate (P0) - REQUIRED

1. 🔴 **Add tests for EffectsRenderer.js** - 49% coverage is unacceptable for core visual effects
2. 🔴 **Add tests for CanvasRenderer.js** - 59% coverage for a 1,211-line file is risky

### Short-Term (P1)

3. ⚠️ Split ToolbarStyleControls.js proactively (947 lines)
4. ⚠️ Set removal timeline for deprecated code

### Medium Term (P2)

5. ⏳ Improve shared renderer coverage (LayerRenderer, ShapeRenderer)
6. ⏳ Consider splitting CanvasRenderer.js (now a god class)

### Long Term (P3)

7. ⏳ Mobile/touch support - **Biggest impact for users**
8. ⏳ WCAG 2.1 AA audit
9. ⏳ Layer grouping

---

## Summary

The Layers extension is **functional and production-ready** but has accumulated technical debt that was previously understated in documentation.

**Honest Rating: 8.0/10**

Deductions:
- -0.5 for 2 files with <60% coverage (EffectsRenderer, CanvasRenderer)
- -0.5 for 8 god classes (23% of codebase)
- -0.5 for no mobile support
- -0.5 for approaching 50K line complexity threshold

### What Would Improve the Rating

| Action | Impact |
|--------|--------|
| Fix EffectsRenderer/CanvasRenderer coverage | +0.5 |
| Reduce god classes to 5 or fewer | +0.25 |
| Add mobile/touch support | +0.75 |
| WCAG 2.1 AA certification | +0.25 |

---

*Plan updated: December 27, 2025*  
*Status: **P0 ITEMS IDENTIFIED** 🔴 - Coverage gaps need attention*  
*Version: 1.2.8*
