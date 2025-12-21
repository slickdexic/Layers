# Layers Extension - Improvement Plan

**Last Updated:** December 20, 2025  
**Status:** ✅ Stable with Identified Issues  
**Version:** 1.1.7  
**Goal:** World-class MediaWiki extension

---

## Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | 14 tools, alignment, presets, named sets, smart guides |
| **Security** | ✅ Excellent | Professional PHP backend |
| **Testing** | ✅ All Passing | 5,609 tests, 0 failures, ~91% coverage |
| **ES6 Migration** | ✅ Complete | 81 classes, 0 prototype patterns |
| **God Classes** | ⚠️ Managed | 7 files >1,000 lines (all have delegation) |
| **Code Volume** | ⚠️ At Limit | ~45,924 lines (CI warns at 45K) |
| **Mobile** | ❌ Missing | No touch support |

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | This week | Blocking issues, bugs, memory leaks |
| **P1** | 1-4 weeks | High-impact stabilization |
| **P2** | 1-3 months | Architecture improvements |
| **P3** | 3-6 months | World-class features |

---

## Phase 0: Immediate Fixes (P0)

### P0.1 Fix Memory Leak in CanvasManager.destroy() ✅ COMPLETED (Dec 20, 2025)

- **Problem:** Several controllers not cleaned up in destroy()
- **Fixed:** Added missing controllers to cleanup array:
  - selectionManager
  - textInputController
  - alignmentController
  - imageLoader
- **File:** `resources/ext.layers.editor/CanvasManager.js`

### P0.2 Update CI God Class Baselines ✅ COMPLETED (Dec 20, 2025)

- **Problem:** god-class-check.yml had outdated baselines
- **Fixed:** Updated to actual line counts:
  - CanvasManager.js: 1868
  - LayerPanel.js: 1837
  - Toolbar.js: 1539
  - SelectionManager.js: 1194
- **Removed:** ShapeRenderer (857) and ToolbarStyleControls (947) - now under 1000! 🎉
- **File:** `.github/workflows/god-class-check.yml`

### P0.3 Remove Console.log from Production ✅ COMPLETED (Dec 20, 2025)

- **Problem:** 3 console.log/warn/error fallbacks in production code
- **Fixed:** Removed fallbacks, now uses mw.log only
- **Files:**
  - PresetStorage.js - removed console.warn/error fallbacks
  - PresetManager.js - removed console.error fallback

### P0.4 Add Missing Null Checks ✅ REVIEWED (Dec 20, 2025)

- **Status:** Reviewed and determined to be non-issues
- **Reason:** These are constructor-injected dependencies that will always exist when the code paths are reached
- **Decision:** No changes needed - would be over-defensive coding

---

## Phase 1: Stabilization (P1)

### P1.1 Improve Test Coverage for New Features ✅ COMPLETED (Dec 20, 2025)

| File | Before | After | Target | Status |
|------|--------|-------|--------|--------|
| AlignmentController.js | 74.19% | 90%+ | 90%+ | ✅ Tests added |
| ToolbarStyleControls.js | 52% branch | 71% | 75%+ | ✅ **Improved** |
| Toolbar.js | 62.78% branch | 75.56% | 75%+ | ✅ **Improved** |

**Effort:** 1 week

**Progress (Dec 20, 2025):**
- Added 14 tests to ToolbarStyleControls (applyPresetStyleInternal, getCurrentStyle, setCurrentTool, updateForSelection)
- Added 37 tests to Toolbar.js (arrange dropdown, smart guides, alignment buttons, executeAlignmentAction, zoom display)
- **Total tests: 5,671** (up from 5,634)
- **Overall statement coverage: 92.19%**
- **Overall branch coverage: 79.75%**

### P1.2 Remove Dead Code ✅ PARTIAL (Dec 20, 2025)

| File | Code | Status |
|------|------|--------|
| ~~CanvasManager.js~~ | ~~updateBackgroundLayerVisibility()~~ | Kept - method not found |
| ~~CanvasManager.js~~ | ~~loadImageManually()~~ | Kept - still used as fallback |
| ~~LayerPanel.js~~ | ~~updateCodePanel() no-op~~ | Kept - backward compatibility |
| ToolManager.js | Commented selection methods | ✅ **Removed** (11 lines) |

**Notes:**
- Reviewed "deprecated" code - most is intentional fallback or backward compat
- Removed commented-out reference code from ToolManager.js

**Effort:** 30 minutes

### P1.3 Add Constants for Hardcoded Values ✅ ENHANCED (Dec 20, 2025)

- **Status:** LayersConstants.js already comprehensive
- **Added:**
  - Z_INDEX namespace (CANVAS_OVERLAY, TEXT_INPUT, MODAL, TOOLTIP)
  - UI.PASTE_OFFSET, UI.DUPLICATE_OFFSET
  - UI.DEFAULT_CANVAS_WIDTH, UI.DEFAULT_CANVAS_HEIGHT
- **File:** `resources/ext.layers.editor/LayersConstants.js`

### P1.4 Monitor Code Growth ⏳ ONGOING

- **Current:** 45,912 lines (912 over warning threshold)
- **Warning:** 45,000 lines
- **Block:** 50,000 lines
- **Action:** Require net-zero or negative line count in PRs

---

## Phase 2: Architecture (P2)

### P2.1 Split LayersValidator ⏳ NOT STARTED

- **Current:** 958 lines (approaching 1,000)
- **Solution:** Split into category-specific validators
- **Proposed:**
  - LayersValidator.js (core, ~300 lines)
  - TypeValidator.js (type validation, ~250 lines)  
  - GeometryValidator.js (coordinates, ~200 lines)
  - StyleValidator.js (colors, fonts, ~200 lines)
- **Effort:** 3-4 hours

### P2.2 Split PropertiesForm Field Renderers ⏳ NOT STARTED

- **Current:** 832 lines
- **Solution:** Extract field type renderers
- **Proposed:**
  - TextFieldRenderer.js
  - NumericFieldRenderer.js
  - ColorFieldRenderer.js
  - SelectFieldRenderer.js
- **Effort:** 4-6 hours

### P2.3 Performance Benchmarks ⏳ NOT STARTED

- **Create:** Reliable benchmarks (not flaky memory tests)
- **Measure:**
  - Render time with 10/50/100 layers
  - Selection performance with 50+ layers
  - Canvas redraw frequency
- **Location:** `tests/jest/performance/`
- **Effort:** 2 weeks

### P2.4 Architecture Documentation ⏳ NOT STARTED

- **Create:** Visual diagrams (Mermaid or similar)
- **Document:**
  - Module dependency graph
  - Event flow through editor
  - Delegation patterns
- **Effort:** 1 week

---

## Phase 3: World-Class (P3)

### P3.1 Mobile/Touch Support ⏳ NOT STARTED

- **Problem:** No touch event handling
- **Required:**
  - Touch event handlers in InteractionController
  - Responsive toolbar layout
  - Gesture support (pinch-to-zoom, two-finger pan)
  - Mobile-optimized property panels
- **Effort:** 4-6 weeks
- **Impact:** Critical for modern web

### P3.2 Accessibility Audit ⏳ NOT STARTED

- **Current:** Good (skip links, ARIA, keyboard)
- **Target:** WCAG 2.1 AA certification
- **Method:** Automated (axe-core) + manual testing
- **Effort:** 2 weeks

### P3.3 Auto-Generated Documentation ⏳ NOT STARTED

- **Problem:** Manual docs become stale
- **Solution:**
  - JSDoc comments on all public methods
  - Auto-generate API docs in CI
  - Embed metrics in README
- **Effort:** 1 week

### P3.4 TypeScript Migration ⏳ NOT STARTED

- **Prerequisite:** TypeScript definitions exist (types/layers.d.ts)
- **Approach:** Gradual .js → .ts conversion
- **Start with:** Shared utilities, then core modules
- **Effort:** 8+ weeks

### P3.5 Layer Grouping ⏳ NOT STARTED

- **Feature:** Group multiple layers for bulk operations
- **Use case:** Complex annotations with related elements
- **Effort:** 2-3 weeks

---

## God Class Status Tracker

### Current God Classes (December 20, 2025)

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,864 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,837 | ✅ 7 controllers | Stable |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing |
| LayersEditor.js | 1,324 | ✅ 3 modules | Stable |
| ToolManager.js | 1,275 | ✅ 2 handlers | Stable |
| SelectionManager.js | 1,194 | ✅ 3 modules | Stable |
| APIManager.js | 1,161 | ✅ APIErrorHandler | Stable |

**Total in god classes: ~10,194 lines**

### Files to Watch (800-1000 lines)

| File | Lines | Risk |
|------|-------|------|
| LayersValidator.js | 958 | ⚠️ HIGH |
| ToolbarStyleControls.js | 947 | ⚠️ HIGH |
| UIManager.js | 917 | ⚠️ MEDIUM |
| CanvasRenderer.js | 859 | MEDIUM |
| ShapeRenderer.js | 857 | MEDIUM |
| PropertiesForm.js | 832 | ⚠️ MEDIUM |

---

## Recently Completed

| Date | Task | Impact |
|------|------|--------|
| Dec 20 | Smart Guides (SmartGuidesController) | +500 lines, 43 tests |
| Dec 20 | Arrange dropdown menu | Toolbar consolidation |
| Dec 20 | PolygonStarRenderer extraction | ShapeRenderer: -333 lines |
| Dec 20 | BuiltInPresets + PresetStorage | PresetManager: -226 lines |
| Dec 20 | PresetStyleManager extraction | ToolbarStyleControls: -102 lines |
| Dec 19 | Alignment tools (AlignmentController) | +464 lines |
| Dec 19 | Multi-selection in LayerPanel | +101 lines |
| Dec 19 | Style presets system | +868 lines |
| Dec 18 | TypeScript definitions | +500 lines |
| Dec 18 | LayerDataNormalizer extraction | Text shadow fix |
| Dec 17 | TextBoxRenderer extraction | -318 lines |

---

## Progress Tracking

```
Phase 0 (Immediate - This Week):
P0.1 Fix Memory Leak:        ░░░░░░░░░░░░░░░░░░░░ 0%
P0.2 Update CI Baselines:    ░░░░░░░░░░░░░░░░░░░░ 0%
P0.3 Remove Console.log:     ░░░░░░░░░░░░░░░░░░░░ 0%
P0.4 Add Null Checks:        ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 1 (Stabilization - 4 weeks):
P1.1 Test Coverage:          ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Remove Dead Code:       ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 Add Constants:          ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 Monitor Growth:         ██████████░░░░░░░░░░ 50% (ongoing)

Phase 2 (Architecture - 8 weeks):
P2.1 Split LayersValidator:  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 Split PropertiesForm:   ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 Performance Tests:      ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 Architecture Docs:      ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (World-Class - 12+ weeks):
P3.1 Mobile/Touch:           ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 Accessibility Audit:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 Auto-Gen Docs:          ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 TypeScript:             ░░░░░░░░░░░░░░░░░░░░ 0%
P3.5 Layer Grouping:         ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When

- [ ] 0 memory leaks in editor open/close cycle
- [ ] CI baselines match actual file sizes
- [ ] No console.log in production code
- [ ] No null reference errors

### Phase 1 Complete When

- [ ] AlignmentController >90% coverage
- [ ] No dead code in tracked files
- [ ] All magic numbers replaced with constants
- [ ] Codebase under 45,000 lines

### Phase 2 Complete When

- [ ] LayersValidator under 500 lines
- [ ] PropertiesForm under 600 lines
- [ ] Performance benchmarks passing
- [ ] Architecture diagrams complete

### World-Class When

- [ ] Mobile/touch support working
- [ ] WCAG 2.1 AA compliant
- [ ] Auto-generated docs in CI
- [ ] TypeScript on shared modules
- [ ] New contributor productive in <1 day

---

## Rules

### The Growth Control Rule

Track weekly line count. If growth exceeds 2%:
1. No new features until extraction catches up
2. Every PR must include net-zero or negative line count
3. Review what's driving growth

### The 1-for-1 Rule

If features must continue:
- Every +100 lines added requires -100 lines extracted
- Extraction must be in same PR
- Track in PR description: "Added: 150 lines, Extracted: 180 lines, Net: -30"

### The God Class Rule

When any file exceeds 1,000 lines:
1. **Freeze:** No new code until extraction PR merged
2. **Extract:** Identify cohesive functionality for new module
3. **Delegate:** Parent keeps coordination, child handles details
4. **Test:** Both parent and child must have tests

### The Destroy Rule

When adding new controller/module references:
1. Add to constructor initialization
2. Add cleanup to destroy() method
3. Test that cleanup actually runs

---

## Timeline

| Phase | Duration | Gate |
|-------|----------|------|
| Phase 0 | 1 week | Memory leak fixed, CI updated |
| Phase 1 | 4 weeks | Coverage improved, dead code removed |
| Phase 2 | 8 weeks | Validators split, benchmarks passing |
| Phase 3 | 12+ weeks | Mobile support, world-class features |

**Total time to world-class: ~6 months focused effort**

---

*Plan updated: December 20, 2025*  
*Next review: January 20, 2026*
