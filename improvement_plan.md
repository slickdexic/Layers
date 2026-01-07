# Layers Extension - Improvement Plan

**Last Updated:** January 7, 2026  
**Status:** ✅ Production-Ready  
**Version:** 1.5.2  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** and actively maintained. A comprehensive critical code review on January 7, 2026 confirmed stable operation with excellent test coverage. Technical debt is managed but present.

**Current Rating: 8.5/10**

**✅ Strengths:**
- 8,563 unit tests passing with 93.8% statement coverage, 82.4% branch coverage
- All 13 drawing tools fully functional
- Professional security (CSRF, rate limiting, validation on all 4 API endpoints)
- Zero critical bugs or security vulnerabilities
- Layer Set List on File pages for discoverability
- WCAG 2.5.5 compliant touch targets (44×44px minimum)

**⚠️ Technical Debt:**
- 12 god classes (28% of JS codebase) - all use delegation patterns
- 7 files in 800-999 line range approaching god class threshold

**✅ Recent Improvements (January 7, 2026):**
- Fixed double-headed curved arrow crossover rendering artifact
- Fixed tail width control visibility for double-headed arrows
- Fixed TransformController.js RAF scheduling cleanup bug
- Fixed RenderCoordinator.js setTimeout fallback tracking
- Added Layer Set List on File pages (implements Yaron feedback request #4)
- Extracted `ImageLayerRenderer.js` (280 lines) from `LayerRenderer.js`
- LayerRenderer.js reduced from 998 to 867 lines (no longer at risk)
- Simplified permissions: consolidated `createlayers` into `editlayers`
- Fixed layer locking feature with 15 new tests
- Fixed PHP code style errors (line endings)

---

## Current State (January 7, 2026)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 13 tools + layer grouping + curved arrows + callouts |
| **Security** | ✅ Excellent | CSRF, rate limiting, validation on all 4 endpoints |
| **Testing** | ✅ Excellent | 8,563 tests, 93.8% statement coverage, 82.4% branch |
| **ES6 Migration** | ✅ Complete | 94+ classes, 0 prototype patterns |
| **God Classes** | ⚠️ Debt | 12 files >1,000 lines (all with delegation patterns) |
| **Mobile Support** | ✅ Complete | WCAG 2.5.5 touch targets, 768px + 480px responsive CSS |
| **Codebase Size** | ✅ Healthy | ~61,480 JS lines (113 files), well under 75K target |
| **PHP Backend** | ✅ Healthy | ~11,519 lines (32 files), 0 errors |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | ✅ All resolved |
| **P1** | 1-4 weeks | Active monitoring |
| **P2** | 1-3 months | Planned |
| **P3** | 3-6 months | Future |

---

## Phase 0: Critical Issues (P0) - ✅ ALL RESOLVED

All P0 issues have been resolved. The extension is production-ready.

| Issue | Status | Resolution |
|-------|--------|------------|
| ApiLayersDelete rate limiting | ✅ FIXED | Added rate limiting |
| ApiLayersRename rate limiting | ✅ FIXED | Added rate limiting |
| Template images CSP issue | ✅ FIXED | Removed restrictive CSP from File pages |
| TransformationEngine memory leak | ✅ FIXED | Added cancelAnimationFrame in destroy() |
| ZoomPanController memory leak | ✅ FIXED | Same fix applied |
| LayerRenderer image cache leak | ✅ FIXED | LRU cache with 50 entry limit |
| CanvasManager async race condition | ✅ FIXED | Added isDestroyed flag |
| SelectionManager infinite recursion | ✅ FIXED | Added visited Set |
| Export filename sanitization | ✅ FIXED | Added sanitizeFilename() helper |
| console.warn in CustomShapeRenderer | ✅ FIXED | Changed to mw.log.warn() |
| TransformController RAF cleanup | ✅ FIXED | Added RAF flag reset in destroy() (Jan 6) |
| RenderCoordinator setTimeout fallback | ✅ FIXED | Added fallbackTimeoutId tracking (Jan 6) |

---

## Phase 1: Active Monitoring (P1)

### P1.1 LayerRenderer.js Extraction ✅ COMPLETE

**Status:** ✅ RESOLVED  
**Lines:** 867 (was 998)  
**File:** `resources/ext.layers.shared/LayerRenderer.js`

**Resolution (January 6, 2026):**
- Extracted `ImageLayerRenderer.js` (280 lines) for image layer caching and rendering
- LayerRenderer.js reduced by 131 lines (998 → 867)
- Added 17 new tests with full coverage
- No longer at risk of becoming a god class

### P1.2 Files Approaching 1,000 Lines

Monitor these files to prevent additional god classes:

| File | Lines | Risk | Trend |
|------|-------|------|-------|
| TransformController.js | 987 | ⚠️ MEDIUM | +10 (RAF fix) |
| ResizeCalculator.js | 935 | ⚠️ MEDIUM | Stable |
| PropertiesForm.js | 926 | ⚠️ MEDIUM | Stable |
| ShapeRenderer.js | 924 | ⚠️ MEDIUM | Stable |
| **LayerRenderer.js** | **867** | ✅ RESOLVED | Extracted |
| LayersValidator.js | 853 | ✅ OK | Stable |
| PropertyBuilders.js | 819 | ✅ OK | Stable |

### P1.3 God Class Status

12 files exceed 1,000 lines. All use delegation patterns:

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,193** | Facade → 9 controllers | 🚨 Over 2K limit |
| **CanvasManager.js** | **1,964** | Facade → 10+ controllers | ⚠️ Approaching 2K |
| Toolbar.js | 1,802 | UI consolidation | ✅ OK |
| LayersEditor.js | 1,632 | Orchestrator → managers | ✅ OK |
| SelectionManager.js | 1,405 | Facade → selection helpers | ✅ OK |
| ArrowRenderer.js | 1,356 | Rendering (curved arrows) | ✅ OK |
| APIManager.js | 1,356 | APIErrorHandler | ✅ OK |
| CalloutRenderer.js | 1,291 | Rendering (callouts) | ✅ OK |
| ToolManager.js | 1,214 | Facade → tool handlers | ✅ OK |
| GroupManager.js | 1,132 | v1.2.13 | ✅ OK |
| CanvasRenderer.js | 1,117 | SelectionRenderer | ✅ OK |
| ToolbarStyleControls.js | 1,014 | Style controls | ✅ OK |

**Total in god classes: ~17,476 lines** (28% of JS codebase)

### P1.4 Timer Cleanup Consistency

**Status:** ⚠️ MINOR  
**Severity:** Low Risk

Some components have short setTimeout calls (0-100ms) without tracking. These are fire-and-forget patterns with minimal leak risk.

| File | Timer Duration | Risk |
|------|----------------|------|
| AccessibilityAnnouncer.js | 50ms | Low |
| PropertiesForm.js | 0-100ms | Very Low |
| ContextMenuController.js | 0ms | Very Low |
| ImportExportManager.js | 100ms | Very Low |

---

## Phase 2: Code Quality (P2)

### P2.1 Mobile-Optimized UI

**Status:** ✅ COMPLETE (Comprehensive responsive CSS implemented)  
**Priority:** RESOLVED  

**Implemented (editor-fixed.css):**
- ✅ Touch-to-mouse event conversion
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch handlers in CanvasEvents.js and LayerPanel.js
- ✅ Touch-adaptive selection handles
- ✅ Collapsible layer panel on mobile
- ✅ **768px breakpoint**: Responsive toolbar (flex-wrap, scroll), 40x40px touch buttons, 22x22px icons, vertical layout stacking, 44x44px touch targets
- ✅ **480px breakpoint**: Compact toolbar, hidden separators, reduced panel height (160px), compact layer items

**Minor Enhancement (Low Priority):**
- ⚠️ On-screen keyboard handling could be improved for text input

### P2.2 PHP Code Quality

**Status:** ✅ RESOLVED  
**Severity:** Fixed

All PHP code style issues have been fixed:
- ✅ Line endings (auto-fixed with phpcbf)
- ✅ Line length warnings (refactored long debug log statements)
- ✅ Comment placement (moved inline comments to separate lines)

### P2.3 ESLint Disable Comments

**Status:** ✅ Well below target  
**Count:** 9 eslint-disable comments (target: <15)

All remaining disable comments are intentional fallbacks for DialogManager unavailability.

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

### P3.5 SVG Export

Export layers as SVG for vector editing.  
**Status:** Not started  
**Effort:** 1 week

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

### FR-11: Wikitext Parameter Rename ✅ (v1.5.0-beta.3)

`layerset=` is now the primary parameter (backwards compatible with `layers=`).

---

## Progress Tracking

```
Phase 0 (CRITICAL):         ████████████████████ 100% ✅ All resolved

Phase 1 (MONITORING):
P1.1 LayerRenderer watch:   ██████████████████░░ 90%  ⚠️ At 998 lines
P1.2 Files approaching 1K:  ██████████████████░░ 90%  ⚠️ 5 files at 900+ lines
P1.3 God class delegation:  ████████████████████ 100% ✅ All well-delegated
P1.4 Timer cleanup:         ██████████████████░░ 90%  ⚠️ Minor inconsistencies

Phase 2 (MEDIUM):
P2.1 Mobile UI:             ██████████████░░░░░░ 70%  ⚠️ Basic touch + some responsive
P2.2 PHP warnings:          ██████████████████░░ 90%  ⚠️ 3 minor warnings
P2.3 ESLint disables:       ████████████████████ 100% ✅ At 9 (target <15)

Phase 3 (LOW):
P3.1 TypeScript:            █░░░░░░░░░░░░░░░░░░░ 5%   ⏳ Low Priority
P3.2 WCAG Audit:            ███████████████████░ 95%  ⏳ Nearly complete
P3.3 Gradient Fills:        ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.4 Custom Fonts:          ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.5 SVG Export:            ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
```

---

## Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Unit tests (Jest) | 8,563 | ✅ |
| E2E tests (Playwright) | 2,658 lines (7 files) | ✅ |
| Statement coverage | 93.8% | ✅ Excellent |
| Branch coverage | 82.4% | ✅ Good |
| Function coverage | 92.7% | ✅ |
| Line coverage | 93.9% | ✅ |
| Test suites | 146 | ✅ |

---

## What Would Make This 10/10

### Already Have ✅

- 8,563 passing tests with 93.8% statement coverage
- 13 working drawing tools
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
- ✅ LayerRenderer.js reduced from 998 to 867 lines
- ✅ HistoryManager isDestroyed guard (prevents post-destroy operations)
- ✅ APIManager canvas export null context check
- ✅ parseMWTimestamp edge case validation (length check)
- ✅ Reload failure user notifications (mw.notify)
- ✅ AccessibilityAnnouncer timer tracking (pendingTimeoutId cleanup)
- ✅ Double bootstrap prevention (EditorBootstrap)
- ✅ WCAG 2.5.5 touch targets (44×44px minimum for mobile)
- ✅ Double-headed curved arrow crossover fixed (v1.5.1)

### Still Needed for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Reduce LayerPanel.js below 2K | MEDIUM | 1 week | P2 |
| Improve branch coverage to 85%+ | MEDIUM | 2-3 weeks | P2 |

---

## Next Actions

### Immediate (This Week)

1. ✅ Complete critical review documentation
2. ✅ Fix console.warn in CustomShapeRenderer
3. ✅ Fix TransformController.js RAF cleanup bug
4. ✅ Fix RenderCoordinator setTimeout fallback tracking
5. ✅ Add HistoryManager isDestroyed guard
6. ✅ Add APIManager exportAsImage canvas context null check
7. ✅ Fix parseMWTimestamp edge case for short timestamps
8. ✅ Add user notification on reload failure after delete/rename

### Short-Term (1-4 Weeks)

9. Continue monitoring files approaching 1K lines (4 files in 920-987 range)
10. Consider extracting logic from LayerPanel.js (2,193 lines)
11. ✅ Timer cleanup in AccessibilityAnnouncer complete
12. ✅ WCAG 2.5.5 touch targets implemented
11. ✅ Timer cleanup in AccessibilityAnnouncer complete

### Long-Term (1-3 Months)

12. Mobile-responsive toolbar and layer panel UX improvements
13. WCAG 2.1 AA audit completion
10. Consider TypeScript migration

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

The Layers extension is **production-ready** with excellent test coverage and security. Technical debt is managed with 12 god classes using delegation patterns. No critical issues remain - the extension is stable and fully functional.

**Honest Rating: 8.5/10**

Deductions:
- -0.5 for 12 god classes (28% of codebase)
- -0.4 for 7 files approaching 1K threshold
- -0.3 for branch coverage at 82.4% (target: 85%+)
- -0.3 for mobile toolbar UX not fully optimized

---

*Plan updated: January 7, 2026*  
*Status: ✅ **Production-ready** - No critical issues*  
*Version: 1.5.1*
