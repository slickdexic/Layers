# Layers Extension - Improvement Plan

**Last Updated:** January 5, 2026  
**Status:** ✅ Production-Ready  
**Version:** 1.4.8  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** and actively maintained. A comprehensive critical code review on January 5, 2026 identified 23 issues across 6 major files. Most P0 issues have been resolved, with 3 new HIGH priority issues identified.

**Current Rating: 8.5/10**

**✅ Issues Fixed (January 2026):**
- ✅ All rate limiting issues resolved
- ✅ Memory leaks fixed (animation frames, timers, context menu)
- ✅ TIFF and InstantCommons support added
- ✅ Template images CSP issue fixed

**🚨 Newly Identified (January 5, 2026):**
- ⚠️ **LayerRenderer unbounded image cache** (memory leak potential)
- ⚠️ **LayerPanel event listener accumulation** (memory leak on re-renders)
- ⚠️ **APIManager missing request abort** (race condition potential)
- ⚠️ **12 god classes** (30% of JS codebase) - All use delegation patterns

---

## Current State (January 5, 2026)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 12 tools + layer grouping + curved arrows + callouts |
| **Security** | ✅ Excellent | CSRF, rate limiting, validation on all endpoints |
| **Testing** | ✅ Excellent | 8,346 tests, 94.69% statement coverage |
| **ES6 Migration** | ✅ Complete | 94+ classes, 0 prototype patterns |
| **God Classes** | ⚠️ Debt | 12 files >1,000 lines (all with delegation patterns) |
| **Memory Leaks** | ⚠️ Partial | Animation frame leaks fixed, image cache unbounded |
| **Mobile Support** | ⚠️ Basic | Touch works, UI not responsive |
| **Codebase Size** | ✅ Healthy | ~58,260 lines (107 files), well under 75K target |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | ✅ All resolved |
| **P1** | 1-4 weeks | Active development |
| **P2** | 1-3 months | Planned |
| **P3** | 3-6 months | Future |

---

## Phase 0: Critical Issues (P0) - ✅ MOSTLY RESOLVED

All previously identified P0 issues have been resolved. New issues identified in Jan 5 review are tracked below.

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

## Phase 1: High Priority Issues (P1) - 🚨 NEW ISSUES IDENTIFIED

### P1.1 LayerRenderer.js Unbounded Image Cache

**Status:** 🚨 NEW (January 5, 2026)  
**Severity:** HIGH  
**File:** `resources/ext.layers.shared/LayerRenderer.js` (lines 465-475)

**Problem:** The `_imageCache` Map grows unboundedly as new image layers are added. Over a long editing session with many image layers, this causes memory bloat and potential browser slowdown.

**Suggested Fix:** Implement LRU cache with max size:
```javascript
const MAX_CACHE_SIZE = 50;
if (this._imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = this._imageCache.keys().next().value;
    this._imageCache.delete(firstKey);
}
```

### P1.2 LayerPanel.js Event Listener Accumulation

**Status:** 🚨 NEW (January 5, 2026)  
**Severity:** HIGH  
**File:** `resources/ext.layers.editor/LayerPanel.js`

**Problem:** The `addLayerItemEventListeners` function adds event listeners to layer items, but when the layer list is re-rendered, new elements get new listeners without cleaning old ones. The `data-has-listeners` attribute check is fragile as elements may be recreated on render.

**Suggested Fix:** Use event delegation on the layer list container instead of individual item listeners.

### P1.3 APIManager.js Missing Request Abort

**Status:** 🚨 NEW (January 5, 2026)  
**Severity:** MEDIUM-HIGH  
**File:** `resources/ext.layers.editor/APIManager.js`

**Problem:** `loadLayerSet()`, `loadNamedSet()`, and `loadRevision()` don't track or abort pending API requests. If user switches sets quickly, multiple concurrent requests could complete out of order, causing state inconsistencies.

**Suggested Fix:** Track active XHR handles and abort previous requests when a new one starts.

### P1.4 ContextMenuController Memory Leak

**Status:** ✅ FIXED (January 4, 2026)  
**Severity:** MEDIUM  
**File:** `resources/ext.layers.editor/ui/ContextMenuController.js`

**Solution Applied:** Handler references stored as instance properties and removed in `closeLayerContextMenu()`.

### P1.5 Files Approaching 1,000 Lines

Monitor these files to prevent additional god classes:

| File | Lines | Risk |
|------|-------|------|
| ResizeCalculator.js | **934** | ⚠️ HIGH - Approaching limit |
| PropertiesForm.js | **926** | ⚠️ MEDIUM |
| ShapeRenderer.js | **924** | ⚠️ MEDIUM |
| LayersValidator.js | **853** | ✅ OK |
| LayerRenderer.js | **845** | ✅ OK |

### P1.6 God Class Status

12 files exceed 1,000 lines. All use delegation patterns:

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,191** | Facade → 9 controllers | 🚨 Over 2K limit |
| **CanvasManager.js** | **1,934** | Facade → 10+ controllers | ⚠️ Approaching 2K |
| Toolbar.js | 1,658 | UI consolidation | ✅ OK |
| LayersEditor.js | 1,482 | Orchestrator → managers | ✅ OK |
| **SelectionManager.js** | **1,388** | Facade → selection helpers | ⚠️ Could extract group logic |
| ArrowRenderer.js | 1,356 | Rendering (curved arrows) | ✅ OK |
| CalloutRenderer.js | 1,291 | Rendering (callouts) | ✅ OK |
| **APIManager.js** | **1,254** | APIErrorHandler | ⚠️ Could extract request handling |
| ToolManager.js | 1,214 | Facade → tool handlers | ✅ OK |
| GroupManager.js | 1,132 | v1.2.13 | ✅ OK |
| CanvasRenderer.js | 1,113 | SelectionRenderer | ✅ OK |
| ToolbarStyleControls.js | 1,014 | Style controls | ✅ OK |

**Total in god classes: ~17,556 lines** (30% of JS codebase)

---

## Phase 2: Code Quality (P2)

### P2.1 Mobile-Optimized UI

**Status:** ⚠️ PARTIAL (Basic touch works, UI not responsive)  
**Priority:** HIGH (Opens to 50% more users)  

**Implemented:**
- ✅ Touch-to-mouse event conversion
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch handlers in CanvasEvents.js and LayerPanel.js

**Still Missing:**
- ❌ Responsive toolbar layout (768px and 480px breakpoints)
- ❌ Collapsible layer panel on mobile
- ❌ Touch-friendly selection handles (larger hit areas)
- ❌ On-screen keyboard handling for text input

### P2.2 MEDIUM Priority Issues from Code Review

8 MEDIUM priority issues identified in January 5 review:

| Issue | File | Description | Effort |
|-------|------|-------------|--------|
| Export filename not sanitized | APIManager.js | Special chars in filenames not escaped | 15 min |
| Potential infinite recursion | SelectionManager.js | `_getGroupDescendantIds` has no depth limit | 30 min |
| Destroyed state check missing | CanvasManager.js | Async callbacks may fire after destroy | 30 min |
| Background opacity no debounce | LayerPanel.js | Slider causes excessive redraws | 30 min |
| State mutation pattern | LayersEditor.js | Array modified in place vs new array | 30 min |
| Text layer bounds fragile | CanvasManager.js | Missing null checks | 15 min |
| Sub-renderers not cleaned | LayerRenderer.js | destroy() doesn't clean sub-renderers | 30 min |
| Star points property conflict | LayerRenderer.js | `points` used for count and array | 1 hr |

### P2.3 LOW Priority Issues

12 LOW priority issues identified - see codebase_review.md for full list.

### P2.4 Architecture Documentation

**Status:** ✅ COMPLETE

`docs/ARCHITECTURE.md` contains 9 Mermaid diagrams with ASCII fallbacks.
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
P1.1 LayerRenderer cache:   ░░░░░░░░░░░░░░░░░░░░ 0%   🚨 NEW - unbounded cache
P1.2 LayerPanel listeners:  ░░░░░░░░░░░░░░░░░░░░ 0%   🚨 NEW - event accumulation
P1.3 APIManager abort:      ░░░░░░░░░░░░░░░░░░░░ 0%   🚨 NEW - race conditions
P1.4 ContextMenuController: ████████████████████ 100% ✅ Fixed (Jan 4, 2026)
P1.5 Files approaching 1K:  ██████████████████░░ 90%  ⚠️ 3 files at 920+ lines
P1.6 God class delegation:  ████████████████████ 100% ✅ All well-delegated

Phase 2 (MEDIUM):
P2.1 Mobile UI:             ██████████░░░░░░░░░░ 50%  ⚠️ Touch works, UI not responsive
P2.2 Medium priority fixes: ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ 8 issues identified
P2.3 Low priority fixes:    ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ 12 issues identified
P2.4 Architecture docs:     ████████████████████ 100% ✅ 9 Mermaid diagrams

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
| Unit tests (Jest) | 8,346 | ✅ |
| E2E tests (Playwright) | 2,658 lines (7 files) | ✅ |
| Statement coverage | 94.69% | ✅ Excellent |
| Branch coverage | 83.35% | ✅ Good |
| Function coverage | 93.09% | ✅ |
| Test suites | 140 | ✅ |

---

## What Would Make This 10/10

### Already Have ✅

- 8,346 passing tests with 94.69% coverage
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
| Fix unbounded image cache | HIGH | 1 hour | P1 |
| Fix event listener accumulation | HIGH | 2 hours | P1 |
| Add request abort handling | MEDIUM | 2 hours | P1 |
| Mobile-responsive UI | MEDIUM | 3-4 weeks | P2 |
| Reduce god classes | MEDIUM | 2-3 weeks | P2 |
| WCAG 2.1 AA certification | MEDIUM | 1 week | P3 |

---

## Next Actions

### Immediate (This Week)

1. ✅ Complete critical review documentation
2. ✅ Fix ContextMenuController memory leak
3. 🚨 Fix LayerRenderer unbounded image cache
4. 🚨 Fix LayerPanel event listener accumulation
5. Monitor files approaching 1K lines (3 files at 920+)

### Short-Term (1-4 Weeks)

6. Add request abort handling to APIManager
7. Fix remaining 8 MEDIUM priority issues
8. Continue god class monitoring

### Long-Term (1-3 Months)

9. Mobile-responsive toolbar and layer panel
10. WCAG 2.1 AA audit completion
11. Consider TypeScript migration

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

The Layers extension is **production-ready** with excellent test coverage and security. Technical debt is managed with 12 god classes using delegation patterns. Three new HIGH priority issues were identified in the January 5, 2026 critical review that should be addressed.

**Honest Rating: 8.5/10**

Deductions:
- -0.5 for 12 god classes (30% of codebase)
- -0.5 for mobile UI not fully responsive
- -0.3 for unbounded image cache (memory leak)
- -0.2 for missing request abort handling

---

*Plan updated: January 5, 2026*  
*Status: ⚠️ **Production-ready with new issues identified** - 3 HIGH priority issues found*  
*Version: 1.4.8*
