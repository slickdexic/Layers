# Layers Extension - Improvement Plan

**Last Updated:** December 21, 2025  
**Status:** ✅ Stable with Minor Issues  
**Version:** 1.1.7  
**Goal:** World-class MediaWiki extension

---

## Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | 13 tools, alignment, presets, named sets, **smart guides** |
| **Security** | ✅ Excellent | Professional PHP backend |
| **Testing** | ✅ All Passing | 5,591 tests, 0 failures |
| **ES6 Migration** | ✅ Complete | 78 classes, 0 prototype patterns |
| **God Classes** | ⚠️ Managed | 7 files >1,000 lines (all have delegation) |
| **Code Volume** | ✅ Controlled | ~45,260 lines (CI warns at 45K) |
| **Mobile** | ❌ Missing | No touch support |

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | This week | Blocking issues, regressions |
| **P1** | 1-4 weeks | High-impact stabilization |
| **P2** | 1-3 months | Architecture improvements |
| **P3** | 3-6 months | World-class features |

---

## Phase 0: Immediate Fixes

### P0.1 Fix Alignment Buttons ✅ COMPLETED

- **Problem:** AlignmentController constructor received CanvasManager directly but expected config object with `editor` and `canvasManager` properties
- **Solution:** Updated constructor to detect and handle both formats
- **File:** `resources/ext.layers.editor/canvas/AlignmentController.js`
- **Status:** Fixed - alignment buttons now functional

### P0.2 Fix Failing Test ✅ COMPLETED

- **File:** `tests/jest/ImportExportManager.test.js`
- **Solution:** Added `if (a.parentNode)` check before removeChild
- **Status:** All 5,378 tests now passing

### P0.3 Sync Version Numbers ✅ COMPLETED

- **Action:** Updated extension.json to 1.1.5
- **Status:** Complete

### P0.4 Remove DEBUG Comments ✅ COMPLETED

- **Files:** LayersViewer.js, LayerRenderer.js, LayersEditor.js
- **Action:** Removed ~30 lines of DEBUG logging
- **Status:** Complete

---

## Phase 1: Stabilization (4 weeks)

### P1.1 Control Code Growth ✅ IMPLEMENTED

**CI Enforcement Active:**
- Total codebase size check (warns at 45K, blocks at 50K)
- God class growth prevention (9 tracked files with baselines)
- New god class detection (blocks any new file >1,000 lines)
  run: |
    TOTAL=$(find resources -name "*.js" ! -path "*/dist/*" -exec cat {} + | wc -l)
    if [ $TOTAL -gt 45000 ]; then
      echo "ERROR: Codebase exceeds 45,000 lines ($TOTAL)"
      exit 1
    fi
```

### P1.2 Split ToolbarStyleControls ✅ COMPLETED

- **Was:** 1,101 lines (NEW god class as of Dec 19)
- **Solution:** Extracted PresetStyleManager.js (~275 lines)
- **Now:** 947 lines (below 1,000 threshold)
- **Extract Performed:**
  - PresetStyleManager.js - preset dropdown, apply/save, style property list
- **Tests Added:** 25 new tests (PresetStyleManager.test.js)
- **Completed:** December 20, 2025

### P1.3 Split PresetManager ✅ COMPLETED

- **Was:** 868 lines (approaching limit)
- **Solution:** Extracted BuiltInPresets.js and PresetStorage.js
- **Now:** 642 lines (-26% reduction)
- **Extractions Performed:**
  - BuiltInPresets.js (~293 lines) - built-in preset definitions + utility methods
  - PresetStorage.js (~426 lines) - localStorage operations, import/export, sanitization
- **Tests Added:** 68 new tests (BuiltInPresets.test.js, PresetStorage.test.js)
- **Completed:** December 20, 2025

### P1.4 Fix Markdown Lint Warnings ⏳ NOT STARTED

- **Files:** README.md, CHANGELOG.md
- **Issues:** Missing blank lines around lists/headings
- **Effort:** 1 hour

---

## Phase 2: Architecture Improvement (8 weeks)

### P2.1 Reduce ShapeRenderer ✅ COMPLETED

- **Was:** 1,191 lines (+142 from Dec 18)
- **Solution:** Extracted PolygonStarRenderer.js
- **Now:** 858 lines (-28% reduction)
- **Extraction Performed:**
  - PolygonStarRenderer.js (~606 lines) - polygon and star shape rendering with shadow support
- **Tests Added:** 43 new tests (PolygonStarRenderer.test.js)
- **Completed:** December 20, 2025

### P2.2 Monitor High-Risk Files ⏳ ONGOING

| File | Lines | Threshold | Action if Exceeded |
|------|-------|-----------|-------------------|
| LayersValidator.js | 958 | 1,000 | Extract rule categories |
| UIManager.js | 917 | 1,000 | Extract dialog management |
| PropertiesForm.js | 832 | 1,000 | Extract field renderers |

### P2.3 Performance Benchmarks ⏳ NOT STARTED

- **Create:** Reliable benchmarks (not flaky memory tests)
- **Measure:**
  - Render time with 10/50/100 layers
  - Selection performance with 50+ layers
  - Canvas redraw frequency
- **Location:** `tests/jest/performance/`
- **Effort:** 2 weeks

### P2.4 TypeScript Definitions ✅ COMPLETED (Dec 18)

- **File:** `types/layers.d.ts` (~500 lines)
- **Includes:** All layer types, API responses, editor interfaces
- **Benefit:** IDE autocomplete, documentation
- **Status:** COMPLETE

### P2.5 Architecture Documentation ⏳ NOT STARTED

- **Create:** Visual diagrams (Mermaid or similar)
- **Document:**
  - Module dependency graph
  - Event flow through editor
  - Delegation patterns
- **Effort:** 1 week

---

## Phase 3: World-Class (12+ weeks)

### P3.1 Mobile/Touch Support ⏳ NOT STARTED

- **Problem:** No touch event handling
- **Required:**
  - Touch event handlers in InteractionController
  - Responsive toolbar layout
  - Gesture support (pinch-to-zoom, two-finger pan)
  - Mobile-optimized property panels
- **Effort:** 4-6 weeks
- **Impact:** Critical for modern web

### P3.2 Eyedropper Tool ⏳ NOT STARTED

- **Problem:** Missing from color picker (per UX audit)
- **Implementation:**
  - Canvas color sampling
  - EyeDropper API (modern browsers)
  - Fallback for older browsers
- **Effort:** 1 week

### P3.3 Smart Guides ✅ COMPLETED

- **Problem:** Only basic snap-to-grid
- **Features:**
  - ✅ Snap to object edges (left, right, top, bottom)
  - ✅ Center alignment guides (horizontal, vertical)
  - ✅ Visual guide lines (magenta for edges, cyan for centers)
  - Equal spacing indicators (future enhancement)
- **Effort:** 1 day
- **Implementation:**
  - SmartGuidesController.js (~500 lines)
  - Integrated with TransformController for drag operations
  - Integrated with CanvasRenderer for visual feedback
  - 8px snap threshold (configurable)
- **Tests Added:** 43 new tests
- **Completed:** December 21, 2025

### P3.4 Accessibility Audit ⏳ NOT STARTED

- **Current:** Good (skip links, ARIA, keyboard)
- **Target:** WCAG 2.1 AA certification
- **Method:** Automated (axe-core) + manual testing
- **Effort:** 2 weeks

### P3.5 Auto-Generated Documentation ⏳ NOT STARTED

- **Problem:** Manual docs become stale
- **Solution:**
  - JSDoc comments on all public methods
  - Auto-generate API docs in CI
  - Embed metrics in README
- **Effort:** 1 week

### P3.6 TypeScript Migration ⏳ NOT STARTED

- **Prerequisite:** P2.4 (TypeScript definitions) ✅
- **Approach:** Gradual `.js` → `.ts` conversion
- **Start with:** Shared utilities, then core modules
- **Effort:** 8+ weeks

---

## God Class Status Tracker

### Current God Classes (December 20, 2025)

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,830 | ✅ 10+ controllers | ↑ +25 |
| LayerPanel.js | 1,821 | ✅ 7 controllers | ↑ +101 |
| LayersEditor.js | 1,329 | ✅ 3 modules | ↑ +28 |
| Toolbar.js | 1,298 | ✅ 4 modules | ↑ +183 |
| ToolManager.js | 1,275 | ✅ 2 handlers | = |
| SelectionManager.js | 1,181 | ✅ 3 modules | ↑ +34 |
| APIManager.js | 1,161 | ✅ APIErrorHandler | ↓ -7 |
| ~~ShapeRenderer.js~~ | ~~858~~ | ✅ PolygonStarRenderer | **↓ -333** ✅ |
| ~~ToolbarStyleControls.js~~ | ~~947~~ | ✅ PresetStyleManager | **↓ -102** ✅ |

**Total in god classes: 10,895 lines** (-1,240 from Dec 19)

### Delegated Code Summary

| God Class | Delegated Lines | Ratio |
|-----------|----------------|-------|
| CanvasManager | ~5,116 | 2.8x |
| LayerPanel | ~2,598 | 1.4x |
| Toolbar | ~2,293 | 1.8x |
| ToolManager | ~1,850 | 1.5x |
| SelectionManager | ~975 | 0.8x |
| LayersEditor | ~1,371 | 1.0x |
| ShapeRenderer | ~1,127 | 1.3x (includes PolygonStarRenderer) |
| ToolbarStyleControls | ~275 | 0.3x |

**Key Insight:** All god classes now have delegation. ShapeRenderer dropped below 1,000 lines.

---

## Progress Tracking

### Visual Progress

```
Phase 0 (Immediate):
P0.1 Fix Alignment Buttons:   ████████████████████ 100% ✅
P0.2 Fix Failing Test:        ████████████████████ 100% ✅
P0.3 Sync Version Numbers:    ████████████████████ 100% ✅
P0.4 Remove DEBUG Comments:   ████████████████████ 100% ✅

Phase 1 (Stabilization):
P1.1 Control Code Growth:     ████████████████████ 100% ✅ CI Active
P1.2 Split ToolbarStyleCtrl:  ████████████████████ 100% ✅
P1.3 Split PresetManager:     ████████████████████ 100% ✅
P1.4 Fix Markdown Warnings:   ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Architecture):
P2.1 Reduce ShapeRenderer:    ████████████████████ 100% ✅
P2.2 Monitor High-Risk Files: ██████████░░░░░░░░░░ 50% (ongoing)
P2.3 Performance Benchmarks:  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 TypeScript Definitions:  ████████████████████ 100% ✅
P2.5 Architecture Docs:       ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (World-Class):
P3.1 Mobile/Touch Support:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 Eyedropper Tool:         ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 Smart Guides:            ████████████████████ 100% ✅
P3.4 Accessibility Audit:     ░░░░░░░░░░░░░░░░░░░░ 0%
P3.5 Auto-Generated Docs:     ░░░░░░░░░░░░░░░░░░░░ 0%
P3.6 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
```

### Recently Completed

| Date | Task | Impact |
|------|------|--------|
| Dec 21 | Smart Guides (SmartGuidesController) | +500 lines, 43 tests |
| Dec 20 | PolygonStarRenderer extraction | ShapeRenderer: -333 lines |
| Dec 20 | BuiltInPresets + PresetStorage | PresetManager: -226 lines |
| Dec 20 | PresetStyleManager extraction | ToolbarStyleControls: -102 lines |
| Dec 19 | Alignment tools (AlignmentController) | +464 lines |
| Dec 19 | Multi-selection in LayerPanel | +101 lines |
| Dec 19 | Style presets system | +868 lines |
| Dec 18 | TypeScript definitions | +500 lines |
| Dec 18 | E2E module tests (15 tests) | Testing |
| Dec 18 | Fix flaky RenderBenchmark | Stability |
| Dec 17 | TextBoxRenderer extraction | -318 lines |

---

## Success Metrics

### Phase 1 Complete When

- [ ] 0 failing tests
- [ ] Version numbers synchronized
- [ ] Total lines < 45,000
- [ ] ToolbarStyleControls < 600 lines with delegation
- [ ] No DEBUG comments in production code
- [ ] Growth rate < 1% per week

### Phase 2 Complete When

- [ ] 0 files > 1,000 lines without delegation
- [ ] ShapeRenderer < 700 lines
- [ ] Architecture documentation complete
- [ ] Performance benchmarks passing

### World-Class When

- [ ] Mobile/touch support working
- [ ] WCAG 2.1 AA compliant
- [ ] Eyedropper tool implemented
- [ ] Smart guides working
- [ ] New contributor productive in <1 day

---

## Rules

### The Growth Control Rule (NEW - December 19)

**Problem:** Codebase grew 6.8% in 1 day without corresponding cleanup.

**Rule:** Track weekly line count. If growth exceeds 2%:
1. No new features until extraction catches up
2. Every PR must include net-zero or negative line count
3. Review what's driving growth

### The 1-for-1 Rule

If features must continue:

- Every +100 lines added requires -100 lines extracted from a god class
- Extraction must be in same PR
- Track in PR description: "Added: 150 lines, Extracted: 180 lines, Net: -30"

### The God Class Rule

When any file exceeds 1,000 lines:

1. **Freeze:** No new code until extraction PR merged
2. **Extract:** Identify cohesive functionality for new module
3. **Delegate:** Parent keeps coordination, child handles details
4. **Test:** Both parent and child must have tests

### The Delegation Rule

When extracting:

1. Create specialist module
2. Pass parent reference to constructor
3. Parent delegates to specialist
4. Test both in isolation

---

## Timeline

| Phase | Duration | Gate |
|-------|----------|------|
| Phase 0 | 1 week | Tests stable, versions synced |
| Phase 1 | 4 weeks | Growth controlled, ToolbarStyleControls split |
| Phase 2 | 8 weeks | <7 god classes, docs complete |
| Phase 3 | 12+ weeks | World-class features |

**Total time to world-class: ~6 months focused effort**

---

*Plan updated: December 19, 2025*  
*Next review: January 19, 2026*
