# Layers Extension - Improvement Plan

**Last Updated:** January 5, 2026  
**Status:** ✅ Production-Ready  
**Version:** 1.4.8  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** and actively maintained. A critical code review on January 4, 2026 identified remaining issues that have been documented. All P0 issues have been resolved.

**Current Rating: 8.7/10**

**✅ Issues Fixed (January 2026):**
- ✅ All P0 security and stability issues resolved
- ✅ Rate limiting on all write API endpoints
- ✅ Memory leaks fixed (animation frames, timers, context menu)
- ✅ TIFF and InstantCommons support added
- ✅ Template images CSP issue fixed

**⚠️ Known Technical Debt:**
- ⚠️ **12 god classes** (30% of JS codebase) - All use delegation patterns
- ⚠️ **Mobile UI not responsive** - Basic touch works, but toolbar not mobile-optimized

---

## Current State (January 4, 2026)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 12 tools + layer grouping + curved arrows + callouts |
| **Security** | ✅ Excellent | CSRF, rate limiting, validation on all endpoints |
| **Testing** | ✅ Excellent | 8,304 tests, 94.62% statement coverage |
| **ES6 Migration** | ✅ Complete | 94+ classes, 0 prototype patterns |
| **God Classes** | ⚠️ Debt | 12 files >1,000 lines (all with delegation patterns) |
| **Memory Leaks** | ✅ Resolved | All identified leaks fixed (Jan 4, 2026) |
| **Mobile Support** | ⚠️ Partial | Touch works, but UI not responsive |
| **Codebase Size** | ✅ Healthy | ~57,950 lines (105 files), well under 75K target |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | ✅ All resolved |
| **P1** | 1-4 weeks | Active development |
| **P2** | 1-3 months | Planned |
| **P3** | 3-6 months | Future |

---

## Phase 0: Critical Issues (P0) - ✅ ALL RESOLVED

All P0 issues have been resolved:

| Issue | Status | Resolution |
|-------|--------|------------|
| ApiLayersDelete rate limiting | ✅ FIXED | Added rate limiting |
| ApiLayersRename rate limiting | ✅ FIXED | Added rate limiting |
| Template images CSP issue | ✅ FIXED | Removed restrictive CSP from File pages |
| TransformationEngine memory leak | ✅ FIXED | Added cancelAnimationFrame in destroy() |
| ZoomPanController memory leak | ✅ FIXED | Same fix applied |
| EffectsRenderer.js coverage | ✅ FIXED | Now 98.9% statement coverage |
| CanvasRenderer.js coverage | ✅ FIXED | Now 94.2% coverage |
| LayerDragDrop.js coverage | ✅ FIXED | Now 94.4% coverage |

---

## Phase 1: High Priority Issues (P1)

### P1.1 ContextMenuController Memory Leak

**Status:** ✅ FIXED (January 4, 2026)  
**Severity:** MEDIUM  
**File:** `resources/ext.layers.editor/ui/ContextMenuController.js`

**Problem:** When a context menu was open and `destroy()` was called, the `closeHandler` and `escHandler` event listeners added to `document` were not removed.

**Solution Applied:** Handler references stored as instance properties (`_boundCloseHandler`, `_boundEscHandler`) and removed in `closeLayerContextMenu()`:

```javascript
// Handlers now stored and cleaned up properly
this._boundCloseHandler = closeHandler;
this._boundEscHandler = escHandler;

// Removed in closeLayerContextMenu():
document.removeEventListener('click', this._boundCloseHandler);
document.removeEventListener('keydown', this._boundEscHandler);
```

**Tests Added:** 3 new tests in `ContextMenuController.test.js` covering memory leak prevention.

### P1.2 Files Approaching 1,000 Lines

Monitor these files to prevent additional god classes:

| File | Lines | Risk |
|------|-------|------|
| ShapeRenderer.js | **909** | ⚠️ MEDIUM - Approaching limit |
| LayersValidator.js | **853** | ✅ OK |
| LayerRenderer.js | **845** | ✅ OK |

### P1.3 God Class Status

12 files exceed 1,000 lines. All use delegation patterns:

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,141** | Facade → 9 controllers | ⚠️ At 2K limit |
| **CanvasManager.js** | **1,934** | Facade → 10+ controllers | ⚠️ Approaching 2K |
| Toolbar.js | 1,658 | UI consolidation | ✅ OK |
| LayersEditor.js | 1,482 | Orchestrator → managers | ✅ OK |
| SelectionManager.js | 1,359 | Facade → selection helpers | ✅ OK |
| ArrowRenderer.js | 1,356 | Rendering (curved arrows) | ✅ OK |
| CalloutRenderer.js | 1,291 | Rendering (callouts) | ✅ OK |
| APIManager.js | 1,254 | APIErrorHandler | ✅ OK |
| ToolManager.js | 1,214 | Facade → tool handlers | ✅ OK |
| GroupManager.js | 1,132 | v1.2.13 | ✅ OK |
| CanvasRenderer.js | 1,113 | SelectionRenderer | ✅ OK |
| ToolbarStyleControls.js | 1,014 | Style controls | ✅ OK |

**Total in god classes: ~17,148 lines** (30% of JS codebase)

---

## Phase 2: Code Quality (P2)

### P2.1 Mobile-Optimized UI

**Status:** ⚠️ PARTIAL (40% complete)  
**Priority:** HIGH (Opens to 50% more users)  
**Effort:** 2-3 weeks remaining

**Already Implemented:**
- ✅ Touch-to-mouse event conversion
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch handlers in CanvasEvents.js and LayerPanel.js
- ✅ Responsive toolbar layout (768px and 480px breakpoints) - January 5, 2026
- ✅ Touch-friendly button sizes (44px minimum touch targets)
- ✅ Coarse pointer detection with larger hit areas

**Still Needed:**
- Collapsible layer panel on mobile
- Touch-friendly selection handles (larger hit areas for resize/rotate)
- On-screen keyboard handling for text input

### P2.2 Magic Number Adoption

**Status:** ⚠️ LOW PRIORITY (Partially Complete)  
**Effort:** 2-3 days remaining

`LayersConstants.js` (368 lines) provides comprehensive constants. Gradual adoption in progress:

**✅ Completed (January 5, 2026):**
- MATH constants (SCALE_EPSILON, INTEGER_EPSILON) consolidated in `MathUtils.MATH`
- Removed duplicate definitions from ShapeRenderer.js, PropertiesForm.js, LayerPanel.js
- LayersConstants.MATH now references MathUtils.MATH as single source of truth

**Still Available for Adoption:**

| File | Magic Number | Constant Available |
|------|-------------|-------------------|
| TextRenderer.js:194 | `16` | `DEFAULTS.LAYER.FONT_SIZE` ✅ |
| ShapeFactory.js:624-625 | `100`, `50` | `DEFAULTS.SIZES.*` ✅ |

### P2.3 Architecture Documentation

**Status:** ✅ COMPLETE

`docs/ARCHITECTURE.md` contains 9 Mermaid diagrams with ASCII fallbacks:
- High-level module architecture
- Controller delegation pattern
- Rendering pipeline
- Data flow diagrams

---

## Phase 3: Features (P3)

### P3.1 TypeScript Migration

**Status:** 5% complete  
**Priority:** LOW - ES6 with JSDoc provides adequate type safety

### P3.2 WCAG 2.1 AA Audit

**Status:** 95% complete  
**Effort:** 1 week remaining

Recent improvements:
- ✅ Windows High Contrast Mode support
- ✅ Color picker hex input for keyboard access
- ✅ Reduced motion preference support

### P3.3 Gradient Fills

Support for linear and radial gradients.  
**Status:** Not started  
**Effort:** 1 week

### P3.4 Custom Fonts

Allow users to specify custom fonts.  
**Status:** Not started  
**Effort:** 2 weeks

---

## Completed Feature Requests (Recent)

### FR-4: Curved Arrows ✅ (v1.3.3)

Arrows support curved paths via draggable control point.

### FR-5: Toolbar Dropdown Grouping ✅ (v1.4.2)

Reorganized toolbar using dropdown menus for better scalability.

### FR-6: Callout/Speech Bubble Tool ✅ (v1.4.2)

Full callout rendering with draggable tail and 3 tail styles.

### FR-9: Live Color Preview ✅ (v1.3.3)

Canvas updates in real-time as colors are selected.

### FR-10: Live Article Preview ✅ (v1.3.3)

Layer changes visible on article pages immediately after saving.

---

## Progress Tracking

```
Phase 0 (CRITICAL):         ████████████████████ 100% ✅ All resolved

Phase 1 (HIGH):
P1.1 ContextMenuController: ████████████████████ 100% ✅ Fixed (Jan 4, 2026)
P1.2 Files approaching 1K:  ██████████████████░░ 90%  ⚠️ ShapeRenderer at 909 lines
P1.3 God class delegation:  ████████████████████ 100% ✅ All well-delegated

Phase 2 (MEDIUM):
P2.1 Mobile UI:             ████████░░░░░░░░░░░░ 40%  ⏳ Responsive CSS added
P2.2 Magic numbers:         ██████████░░░░░░░░░░ 50%  ⏳ Infrastructure exists
P2.3 Architecture docs:     ████████████████████ 100% ✅ 9 Mermaid diagrams

Phase 3 (LOW):
P3.1 TypeScript:            █░░░░░░░░░░░░░░░░░░░ 5%   ⏳ Low Priority
P3.2 WCAG Audit:            ███████████████████░ 95%  ⏳ Color picker hex added
P3.3 Gradient Fills:        ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.4 Custom Fonts:          ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
```

---

## Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Unit tests (Jest) | 8,314 | ✅ |
| E2E tests (Playwright) | 2,658 lines (7 files) | ✅ |
| Statement coverage | 94.63% | ✅ Excellent |
| Branch coverage | 83.30% | ✅ Good |
| Function coverage | 93.13% | ✅ |
| Test suites | 140 | ✅ |

---

## What Would Make This 10/10

### Already Have ✅

- 8,314 passing tests with 94.63% coverage
- 12 working drawing tools
- Professional security implementation
- Named layer sets with version history
- Layer grouping with folder UI
- Smart guides and key object alignment
- Style presets with import/export
- Curved arrows with Bézier curves
- Live color preview
- Live article preview
- Callout/speech bubble tool
- TIFF and InstantCommons support

### Still Needed for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Mobile-responsive UI | **HIGH** | 3-4 weeks | P2 |
| Reduce god classes | MEDIUM | 2-3 weeks | P2 |
| WCAG 2.1 AA certification | MEDIUM | 1 week | P3 |

---

## Next Actions

### Immediate (This Week)

1. ✅ Complete critical review documentation
2. ❌ Fix ContextMenuController memory leak
3. Monitor ShapeRenderer.js (909 lines)

### Short-Term (1-4 Weeks)

4. Consider mobile-responsive toolbar prototype
5. Continue gradual magic number adoption
6. Monitor god class growth

### Long-Term (1-3 Months)

7. Mobile-optimized UI - **Biggest impact for users**
8. WCAG 2.1 AA audit completion
9. Consider TypeScript migration

---

## Rules

### ⚠️ The God Class Rule

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to ~2,000 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Soft limit:** Files should ideally stay under 2,000 lines with good delegation

**Current Status:** 12 god classes exist, ALL use delegation patterns.

### ✅ The Timer Rule

When adding setTimeout/setInterval:
1. Store timer ID in instance variable
2. Add clearTimeout/clearInterval in destroy()
3. Document the cleanup

### ✅ The Dialog Rule

All user-facing dialogs must:
1. Use DialogManager or fallback wrapper
2. Have ARIA attributes
3. Support keyboard navigation
4. Match MediaWiki styling

---

## Summary

The Layers extension is **production-ready** with excellent test coverage and security. Technical debt is managed with 12 god classes using delegation patterns. One minor memory leak remains in ContextMenuController.

**Honest Rating: 8.7/10**

Deductions:
- -0.5 for 12 god classes (30% of codebase)
- -0.4 for mobile UI not responsive
- -0.4 for remaining magic numbers

---

*Plan updated: January 4, 2026*  
*Status: ✅ **Production-ready** - All P0 issues resolved, 8,303 tests passing*  
*Version: 1.4.8*
