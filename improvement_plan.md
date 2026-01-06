# Layers Extension - Improvement Plan

**Last Updated:** January 6, 2026  
**Status:** ✅ Production-Ready  
**Version:** 1.5.0-beta.4  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** and actively maintained. A comprehensive critical code review on January 6, 2026 confirmed stable operation with excellent test coverage. Technical debt is managed but present.

**Current Rating: 8.5/10**

**✅ Strengths:**
- 8,522 unit tests passing with 94.6% statement coverage
- All 13 drawing tools fully functional
- Professional security (CSRF, rate limiting, validation on all endpoints)
- Zero critical bugs or security vulnerabilities

**⚠️ Technical Debt:**
- 12 god classes (28% of JS codebase) - all use delegation patterns
- LayerRenderer.js at 998 lines - approaching 1K threshold
- 7 additional files in 800-999 line range
- Mobile UI not fully responsive

---

## Current State (January 6, 2026)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 13 tools + layer grouping + curved arrows + callouts |
| **Security** | ✅ Excellent | CSRF, rate limiting, validation on all endpoints |
| **Testing** | ✅ Excellent | 8,522 tests, 94.6% statement coverage |
| **ES6 Migration** | ✅ Complete | 94+ classes, 0 prototype patterns |
| **God Classes** | ⚠️ Debt | 12 files >1,000 lines (all with delegation patterns) |
| **Mobile Support** | ⚠️ Basic | Touch works, UI not responsive |
| **Codebase Size** | ✅ Healthy | ~61,122 JS lines (112 files), well under 75K target |
| **PHP Backend** | ✅ Healthy | ~11,327 lines (32 files), 0 errors |

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

---

## Phase 1: Active Monitoring (P1)

### P1.1 LayerRenderer.js Approaching 1,000 Lines

**Status:** ⚠️ WATCH  
**Lines:** 998 (2 lines from threshold)  
**File:** `resources/ext.layers.shared/LayerRenderer.js`

**Action:** Monitor and consider extraction before adding new features.

**Extraction Candidates:**
- Image layer rendering logic (~100 lines)
- Layer type dispatch logic (~50 lines)

### P1.2 Files Approaching 1,000 Lines

Monitor these files to prevent additional god classes:

| File | Lines | Risk | Trend |
|------|-------|------|-------|
| **LayerRenderer.js** | **998** | ⚠️ HIGH | At limit |
| ResizeCalculator.js | 935 | ⚠️ MEDIUM | Stable |
| PropertiesForm.js | 926 | ⚠️ MEDIUM | Stable |
| ShapeRenderer.js | 924 | ⚠️ MEDIUM | Stable |
| TransformController.js | 901 | ⚠️ MEDIUM | Stable |
| LayersValidator.js | 853 | ✅ OK | Stable |
| PropertyBuilders.js | 819 | ✅ OK | Stable |

### P1.3 God Class Status

12 files exceed 1,000 lines. All use delegation patterns:

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,193** | Facade → 9 controllers | 🚨 Over 2K limit |
| **CanvasManager.js** | **1,964** | Facade → 10+ controllers | ⚠️ Approaching 2K |
| Toolbar.js | 1,809 | UI consolidation | ✅ OK |
| LayersEditor.js | 1,578 | Orchestrator → managers | ✅ OK |
| SelectionManager.js | 1,405 | Facade → selection helpers | ✅ OK |
| ArrowRenderer.js | 1,356 | Rendering (curved arrows) | ✅ OK |
| APIManager.js | 1,356 | APIErrorHandler | ✅ OK |
| CalloutRenderer.js | 1,291 | Rendering (callouts) | ✅ OK |
| ToolManager.js | 1,214 | Facade → tool handlers | ✅ OK |
| GroupManager.js | 1,132 | v1.2.13 | ✅ OK |
| CanvasRenderer.js | 1,117 | SelectionRenderer | ✅ OK |
| ToolbarStyleControls.js | 1,014 | Style controls | ✅ OK |

**Total in god classes: ~17,429 lines** (28% of JS codebase)

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

**Status:** ⚠️ PARTIAL (Basic touch works, UI not responsive)  
**Priority:** HIGH (Opens to 50% more users)  

**Implemented:**
- ✅ Touch-to-mouse event conversion
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch handlers in CanvasEvents.js and LayerPanel.js
- ✅ Touch-adaptive selection handles
- ✅ Collapsible layer panel on mobile

**Still Missing:**
- ❌ Responsive toolbar layout (768px and 480px breakpoints)
- ❌ Touch-friendly button sizes on small screens
- ❌ On-screen keyboard handling improvements

### P2.2 PHP Code Quality

**Status:** ⚠️ 3 WARNINGS  
**Severity:** Low

3 PHP files have warnings (line length exceeds 120 chars):
- EditLayersAction.php (comment placement)
- ThumbnailProcessor.php (136 chars)
- WikitextHooks.php (123 chars)

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
| Unit tests (Jest) | 8,522 | ✅ |
| E2E tests (Playwright) | 2,658 lines (7 files) | ✅ |
| Statement coverage | 94.6% | ✅ Excellent |
| Branch coverage | 83.3% | ✅ Good |
| Function coverage | 93.09% | ✅ |
| Test suites | 145 | ✅ |

---

## What Would Make This 10/10

### Already Have ✅

- 8,522 passing tests with 94.6% coverage
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

### Still Needed for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Prevent LayerRenderer from crossing 1K | HIGH | 2 hours | P1 |
| Mobile-responsive toolbar | MEDIUM | 2-3 weeks | P2 |
| Reduce LayerPanel.js below 2K | MEDIUM | 1 week | P2 |
| WCAG 2.1 AA certification | MEDIUM | 1 week | P3 |

---

## Next Actions

### Immediate (This Week)

1. ✅ Complete critical review documentation
2. ✅ Fix console.warn in CustomShapeRenderer
3. Monitor LayerRenderer.js (998 lines) for any additions

### Short-Term (1-4 Weeks)

4. Continue monitoring files approaching 1K lines
5. Consider extracting logic from LayerPanel.js
6. Address timer cleanup in AccessibilityAnnouncer if time permits

### Long-Term (1-3 Months)

7. Mobile-responsive toolbar and layer panel
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

The Layers extension is **production-ready** with excellent test coverage and security. Technical debt is managed with 12 god classes using delegation patterns. No critical issues remain - the extension is stable and fully functional.

**Honest Rating: 8.5/10**

Deductions:
- -0.5 for 12 god classes (28% of codebase)
- -0.5 for mobile UI not fully responsive
- -0.3 for 7 files approaching 1K threshold
- -0.2 for minor timer cleanup inconsistencies

---

*Plan updated: January 6, 2026*  
*Status: ✅ **Production-ready** - No critical issues*  
*Version: 1.5.0-beta.3*
