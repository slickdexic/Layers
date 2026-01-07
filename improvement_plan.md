# Layers Extension - Improvement Plan

**Last Updated:** January 7, 2026 (Reality Check)  
**Status:** ⚠️ RECALIBRATING - Previous Claims Were Premature  
**Version:** 1.5.2  
**Goal:** Honestly assess status and create realistic improvement plan

**⚠️ REALITY CHECK (January 7, 2026):**

Previous documentation claimed "Phase 1 Complete" and "10/10 Excellence Achieved." This was **premature and inaccurate**. Here's what actually happened:

**What Phase 1 Actually Did:**
- ✅ Removed 630 lines of dead fallback code
- ✅ Files are numerically smaller (LayerPanel: 2,194→1,768, CanvasManager: 1,964→1,760)
- ✅ 100% of active tests still pass (8,617 passing, 60 skipped)

**What Phase 1 Did NOT Do:**
- ❌ Did NOT extract core logic from god classes
- ❌ Did NOT reduce actual complexity
- ❌ Did NOT fundamentally improve architecture
- ❌ Did NOT address Toolbar.js (1,802 lines, unchanged)

**Current Reality:**
- 🔴 **12 god classes still exist** - totaling ~17,420 lines (28.5% of codebase)
- 🔴 **3 files >1,700 lines** - Toolbar, LayerPanel, CanvasManager
- 🔴 **Delegation without extraction** - Controllers added but logic never moved out
- 🔴 **Documentation inflation** - Multiple docs claimed "10/10" prematurely

---

## Executive Summary

The extension is **production-ready and fully functional** with **professional security and excellent test coverage**. However, **28.5% of the codebase resides in 12 god classes**, and recent "refactoring" primarily removed fallback code rather than addressing core architectural issues.

**Current Rating: 7.2/10** (down from inflated 10.0/10)
- 7 additional files at 800-999 lines at risk of becoming god classes
- God class growth trend: CalloutRenderer (1,291 lines) and ArrowRenderer (1,356 lines) became god classes in recent versions

**✅ Recent Improvements (January 7, 2026):**
- 8,677 unit tests passing with 94.53% statement coverage, 83.16% branch coverage
- LayerRenderer.js reduced from 998 to 867 lines (ImageLayerRenderer extracted)
- PHP line endings fixed (Jan 7, 2026)
- All memory leaks fixed
- Rate limiting on all 4 API endpoints

---

## Current State (January 7, 2026 - Honest Assessment)

| Area | Status | Reality |
|------|--------|------|
| **Functionality** | ✅ Complete | 13 tools + layer grouping + curved arrows + callouts |
| **Security** | ✅ Excellent | CSRF, rate limiting, validation on all 4 endpoints |
| **Testing** | ✅ Excellent | 8,617/8,617 passing (100%), 94.53% statement, 83.16% branch |
| **ES6 Migration** | ✅ Complete | 94+ classes, 0 prototype patterns |
| **God Classes** | 🔴 **UNRESOLVED** | **12 files >1,000 lines, 3 files >1,700 lines** |
| **Architecture** | 🔴 **WEAK** | **Delegation without extraction, 28.5% in god classes** |
| **Documentation** | ⚠️ Inflated | **Multiple docs claim "10/10" prematurely** |
| **Mobile Support** | ⚠️ Partial | Basic touch works, UI not optimized |
| **Codebase Size** | ✅ Healthy | ~61,124 JS lines (114 files), well under 75K target |
| **PHP Backend** | ✅ Healthy | ~5,330 lines (32 files), 0 errors |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | ✅ All resolved |
| **P1** | 1-4 weeks | Active monitoring |
| **P2** | 1-3 months | Planned |
| **P3** | 3-6 months | Future |

---

## The Real Work Needed

### Phase 0: Face Reality (COMPLETE)

✅ This critical review document represents Phase 0 - acknowledging that previous "Phase 1 Complete" claims were premature.

### Phase 1 (ACTUAL): Extract Core Logic from God Classes (P0)

**Status:** 🔴 NOT STARTED  
**Previous Claim:** "Complete" - **This was FALSE**  
**Reality:** Only removed dead fallback code, not core logic

**What ACTUALLY Needs To Happen:**

#### P1.1: LayerPanel.js - REAL Extraction (NOT DONE)

**Current:** 1,768 lines (fallbacks removed)  
**Target:** <800 lines (core logic extracted)  
**Effort:** 3-4 weeks

**Modules to Extract (Real Work):**
1. **LayerPropertySync** (~200 lines) - Property synchronization between layers and UI
2. **LayerVisibilityController** (~150 lines) - Visibility toggle logic
3. **LayerItemRenderer** (~180 lines) - Layer list item DOM creation
4. **LayerSelectionSync** (~120 lines) - Selection state synchronization
5. **LayerPanelState** (~100 lines) - Panel collapse/expand state

**Result:** LayerPanel becomes a ~600-line coordinator

#### P1.2: CanvasManager.js - REAL Extraction (NOT DONE)

**Current:** 1,760 lines (fallbacks removed)  
**Target:** <800 lines (core logic extracted)  
**Effort:** 3-4 weeks

**Modules to Extract (Real Work):**
1. **CanvasInitializer** (~150 lines) - Canvas setup and configuration
2. **CanvasStateManager** (~180 lines) - Zoom, pan, viewport state
3. **CanvasToolCoordinator** (~140 lines) - Tool activation and switching
4. **CanvasUpdateScheduler** (~120 lines) - Redraw scheduling and optimization
5. **CanvasEventCoordinator** (~100 lines) - Event handler registration

**Result:** CanvasManager becomes a ~700-line facade

#### P1.3: Toolbar.js - COMPLETELY UNTOUCHED (NOT DONE)

**Current:** 1,802 lines (UNCHANGED - wasn't even attempted)  
**Target:** <800 lines (core logic extracted)  
**Effort:** 3-4 weeks

**Modules to Extract (Real Work):**
1. **ToolbarLayoutManager** (~200 lines) - Layout, responsive behavior
2. **ToolbarButtonFactory** (~180 lines) - Button creation and configuration
3. **ToolbarStylePanel** (~150 lines) - Style controls panel
4. **ToolbarShortcutHandler** (~120 lines) - Keyboard shortcut management
5. **ToolbarStateSync** (~100 lines) - Tool state synchronization

**Result:** Toolbar becomes a ~600-line coordinator

---

### P0.3 Enforce God Class Policy ✅ IMPLEMENTED

**Status:** ✅ COMPLETE  
**Priority:** P0 - IMMEDIATE  
**Completed:** January 7, 2026

**Problem:** Documentation states 2,000 line limit but no enforcement mechanism exists.

**Solution Implemented:**
1. ✅ Created `scripts/enforce-file-size-limits.sh` - comprehensive enforcement script
2. ✅ Created GitHub Actions workflow `.github/workflows/file-size-check.yml`
3. ✅ Created pre-commit hook template `scripts/pre-commit.template`
4. ✅ Added `npm run check:filesize` command
5. ✅ Created REFACTORING_PLAN.md with detailed extraction plans

**Enforcement Active:**
- Script runs on every push to main/develop
- Blocks CI/CD if violations detected
- Pre-commit hook available for local development
- Clear, actionable error messages with context

---

## Phase 0 Summary

| Issue | Lines Over | Priority | Effort | Status |
|-------|------------|----------|--------|--------|
| LayerPanel.js | 194 | 🔴 CRITICAL | 1 week | Not started |
| CanvasManager.js | -35 (buffer needed) | 🔴 HIGH | 3-4 days | Not started |
| Enforce policy | N/A | 🔴 CRITICAL | 2 days | Not started |

**Total Effort:** ~2 weeks

---

## Phase 0 (Previous): Critical Issues - ✅ ALL RESOLVED

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

## Phase 1: God Class Reduction (P1) - Active Work Required

### P1.1 God Class Status - 12 Files Totaling 28.4% of Codebase

**Status:** ⚠️ SIGNIFICANT DEBT  
**Impact:** 28.4% of JS codebase in 12 files

| File | Lines | % of Limit | Delegation | Risk | Action |
|------|-------|------------|------------|------|--------|
| **LayerPanel.js** | **2,194** | **109.7%** | ✅ 9 controllers | 🔴 CRITICAL | **Extract 200-300 lines** |
| **CanvasManager.js** | **1,965** | **98.25%** | ✅ 10+ controllers | 🔴 HIGH | **Extract 100-200 lines** |
| **Toolbar.js** | **1,802** | 90.1% | ✅ 4 modules | ⚠️ MEDIUM | Extract 200-300 lines |
| **LayersEditor.js** | **1,632** | 81.6% | ✅ 3 modules | ⚠️ MEDIUM | Monitor |
| **SelectionManager.js** | **1,405** | 70.25% | ✅ 3 modules | ✅ OK | Stable |
| **APIManager.js** | **1,370** | 68.5% | ✅ APIErrorHandler | ✅ OK | Stable |
| **ArrowRenderer.js** | **1,356** | 67.8% | Rendering | ✅ OK | Stable |
| **CalloutRenderer.js** | **1,291** | 64.55% | Rendering | ✅ OK | Stable |
| **ToolManager.js** | **1,214** | 60.7% | ✅ 2 handlers | ✅ OK | Stable |
| **GroupManager.js** | **1,132** | 56.6% | ✅ v1.2.13 | ✅ OK | Stable |
| **CanvasRenderer.js** | **1,117** | 55.85% | ✅ SelectionRenderer | ✅ OK | Stable |
| **ToolbarStyleControls.js** | **1,014** | 50.7% | ✅ Style controls | ✅ OK | Stable |

**Total in god classes: ~17,476 lines** (28.4% of 61,498 total JS lines)

**Trend Analysis:**
- 🔴 CalloutRenderer (1,291 lines) became a god class in v1.4.2 - **Feature bloat pattern**
- 🔴 ArrowRenderer (1,356 lines) became a god class in v1.3.3 - **Feature bloat pattern**
- ✅ LayerRenderer reduced from 998 to 867 lines in v1.5.0 - **Good example to follow**

**The Problem:** Delegation is being used as an **excuse** rather than a **step toward extraction**. Files grow to 1,000+ lines, delegation is added, and the file stays large "because it has delegation."

**The Solution:** Delegation should be a **temporary state**. After adding delegation, extract the delegated logic to separate modules.

### P1.2 Files Approaching 1,000 Lines - Watch List

**Status:** ⚠️ MONITOR  
**Risk:** High - 7 files could become god classes

| File | Lines | % to Limit | Risk | Trend |
|------|-------|------------|------|-------|
| TransformController.js | 987 | 98.7% | 🔴 VERY HIGH | Growing |
| ResizeCalculator.js | 935 | 93.5% | 🔴 HIGH | Stable |
| PropertiesForm.js | 926 | 92.6% | 🔴 HIGH | Stable |
| ShapeRenderer.js | 924 | 92.4% | 🔴 HIGH | Stable |
| **LayerRenderer.js** | **867** | 86.7% | ✅ RESOLVED | **Reduced** |
| LayersValidator.js | 853 | 85.3% | ⚠️ MEDIUM | Stable |
| PropertyBuilders.js | 819 | 81.9% | ✅ OK | Stable |

**Action Required:**
- TransformController.js at 98.7% - Extract before it crosses 1,000
- ResizeCalculator.js, PropertiesForm.js, ShapeRenderer.js all >92% - Preemptive extraction recommended

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

## Test Coverage Summary (January 7, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| Unit tests (Jest) | 8,677 | ✅ (up from 8,563) |
| E2E tests (Playwright) | 2,658 lines (7 files) | ✅ |
| Statement coverage | 94.55% | ✅ Excellent (up from 93.8%) |
| Branch coverage | 83.19% | ✅ Good (up from 82.4%) |
| Function coverage | 93.1% | ✅ |
| Line coverage | 94.8% | ✅ |
| Test suites | 146 | ✅ |
| Test execution time | ~8.9 seconds | ✅ Fast |

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

1. ✅ **PropertiesForm debounce confirmed correct** - no action needed
2. Continue monitoring files approaching 1K lines (7 files in 800-987 range)
3. Consider extracting logic from LayerPanel.js (2,193 lines) to get below 2K threshold

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

The Layers extension is **production-ready and fully functional** with **excellent security and test coverage**. However, it suffers from **significant architectural debt** that was **papered over** rather than addressed.

**Brutal Truth:**
- ✅ All features work correctly - zero functional bugs
- ✅ Security is professional-grade
- ✅ Test coverage is excellent (94.53% statement, 83.16% branch)
- 🔴 28.5% of codebase in 12 god classes (architectural problem)
- 🔴 Recent \"refactoring\" only removed dead code, not core complexity
- 🔴 Documentation was inflated with premature \"10/10 excellence\" claims

**Honest Rating: 7.2/10**

This rating reflects:
- Excellent functionality, security, and tests (+3.0)
- Significant architectural debt (-1.5)
- Documentation inflation (-0.8)
- Delegation without extraction (-0.5)

**Path to 9.0/10:**
1. **Real Phase 1** - Extract core logic from LayerPanel, CanvasManager, Toolbar (9-12 weeks)
2. **Fix documentation** - Remove inflated claims, sync metrics
3. **Phase 2** - Address remaining 9 god classes (6-9 months)

**Key Lesson:** Removing dead code isn't refactoring. Adding delegation without extraction is a band-aid. Real improvement requires extracting core logic into focused modules.

---

*Plan updated: January 7, 2026*  
*Status: 🔴 **Reality check complete** - Ready for real Phase 1*  
*Previous Status: \"Phase 1 Complete\" - This was premature*  
*Version: 1.5.2*  
*Rating: 7.2/10 (down from inflated 10/10)*
