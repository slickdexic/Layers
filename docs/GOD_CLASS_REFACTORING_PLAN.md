# God Class Refactoring Plan

**Created:** January 11, 2026  
**Updated:** February 4, 2026  
**Author:** GitHub Copilot (Claude Opus 4.5)  
**Status:** ✅ Coverage Target Exceeded (95.19% statement, 84.96% branch)  
**Target:** Reduce god classes, maintain branch coverage at 80%+

---

## Executive Summary

This document outlines a comprehensive, phased plan to address the god class files (files >1,000 lines) in the Layers extension.

### Current State (February 4, 2026) - v1.5.51

| Metric | Previous | Current | Target | Status |
|--------|----------|---------|--------|--------|
| God classes | 21 files* | 18 files* | <12 files | 📊 Tracked |
| Branch coverage | 84.48% | **84.96%** | 80%+ | ✅ Exceeded |
| Tests | 10,448 | **11,231** | Maintain 100% pass | ✅ Passing |
| Statement coverage | 94.19% | **95.19%** | Maintain 90%+ | ✅ Excellent |

*18 god classes includes 2 generated data files (ShapeLibraryData.js, EmojiLibraryIndex.js) that are exempt from refactoring, plus 2 PHP god classes (LayersDatabase.php, ServerSideLayerValidator.php).

**Key Changes since v1.5.35:**
- Improved overall branch coverage: 84.48% → 85.20%
- Improved overall statement coverage: 94.19% → 95.44%
- Expanded test coverage from 10,448 to 11,157 tests
- Reduced god class count from 23 to 18 through proper delegation patterns

### God Classes by Branch Coverage (Updated)

| File | Lines | Branch % | Gap to 80% | Priority |
|------|-------|----------|------------|----------|
| **CanvasManager.js** | ~2,045 | 76.87% | -3.13% | 🟡 P2 |
| **Toolbar.js** | ~1,788 | 78.52% | -1.48% | 🟡 P2 |
| **LayersEditor.js** | ~1,800 | 77.70% | -2.30% | 🟡 P2 |
| LayerPanel.js | ~2,036 | **80.27%** | ✅ | ✅ OK |
| APIManager.js | ~1,513 | **80.18%** | ✅ | ✅ OK |
| ViewerManager.js | ~2,004 | **80.14%** | ✅ | ✅ OK |
| TransformController.js | ~1,110 | 83.72% | ✅ | ✅ OK |
| ToolbarStyleControls.js | ~1,099 | 82.18% | ✅ | ✅ OK |
| PropertyBuilders.js | ~1,284 | 85.71% | ✅ | ✅ OK |
| ResizeCalculator.js | ~1,105 | 90.25% | ✅ | ✅ OK |
| Others (8 files) | Various | >80% | ✅ | ✅ OK |

---

## Analysis: Why These Files Have Low Coverage

### The 5 Problem Files (69-73% Branch Coverage)

After analyzing the uncovered lines in each file, the low coverage falls into these categories:

#### 1. **CanvasManager.js** (69.61% branch, 1,927 lines)

**Root Cause:** Defensive null checks and environment fallbacks that never execute in tests.

| Uncovered Lines | Category | Description |
|-----------------|----------|-------------|
| 17, 72, 79-84 | Environment | Module export checks (window/module) |
| 346-382 | Null guards | Controller initialization fallbacks |
| 431-483 | Null guards | Manager availability checks |
| 521-566 | Null guards | State manager null handling |
| 614-666 | Error paths | Error recovery for failed operations |
| 702-773 | Null guards | Various component null checks |
| 954-990 | Error paths | Fallback render paths |
| 1352-1480 | Null guards | Event handler null checks |
| 1597-1680 | Cleanup | Destroy method edge cases |
| 1735-1880 | Null guards | Late initialization fallbacks |

**Pattern:** CanvasManager is a **facade** that coordinates 10+ controllers. The uncovered branches are primarily:
- Defensive programming (null checks that should never trigger)
- Environment detection (testing in Node.js vs browser)
- Cleanup paths (destroy after partial initialization)

#### 2. **Toolbar.js** (69.73% branch, 1,788 lines)

**Root Cause:** UI state branches and DOM event handling fallbacks.

| Uncovered Lines | Category | Description |
|-----------------|----------|-------------|
| 19 | Environment | Module export check |
| 282-289 | DOM | Container availability fallback |
| 324 | Null guard | Manager null check |
| 648-714 | UI State | Tool state update branches |
| 760-865 | UI State | Selection state update branches |
| 1125-1191 | UI State | Style control update branches |
| 1477-1504 | Null guards | Component availability checks |
| 1555-1594 | Cleanup | Destroy edge cases |
| 1767 | Export | Module export fallback |

**Pattern:** Toolbar has many **UI state synchronization branches** that handle various combinations of selection state, tool state, and style values. Testing every combination is combinatorially expensive.

#### 3. **LayersEditor.js** (70.38% branch, 1,690 lines)

**Root Cause:** Initialization fallbacks and save/cancel workflow branches.

| Uncovered Lines | Category | Description |
|-----------------|----------|-------------|
| 111, 219, 265, 306 | Init | Module registry fallbacks |
| 434-538 | Init | Manager initialization fallbacks |
| 551-620 | Init | Component availability checks |
| 692-845 | Workflow | Save/cancel dialog edge cases |
| 894-908 | Workflow | Confirmation dialog branches |
| 1024-1192 | Workflow | Layer operation fallbacks |
| 1231-1283 | Workflow | Export/import edge cases |
| 1332-1435 | Cleanup | Destroy method branches |
| 1577-1678 | Fallback | Event handling fallbacks |

**Pattern:** LayersEditor orchestrates the entire editor lifecycle. Uncovered branches are **initialization fallbacks** (when managers fail to load) and **workflow edge cases** (cancel during save, error during export).

#### 4. **LayerPanel.js** (72.24% branch, 1,806 lines)

**Root Cause:** Layer list rendering branches and drag-drop edge cases.

| Uncovered Lines | Category | Description |
|-----------------|----------|-------------|
| 14 | Environment | Module export |
| 144-183 | Init | Component initialization fallbacks |
| 232-261 | Render | Layer list empty state |
| 539-648 | Render | Layer item type branches |
| 690-853 | DragDrop | Drag-drop edge cases |
| 910-1004 | Selection | Multi-select edge cases |
| 1057-1200 | Context | Context menu branches |
| 1417-1689 | Render | Property panel branches |
| 1738 | Export | Module export |

**Pattern:** LayerPanel has **many rendering branches** for different layer types, selection states, and drag-drop scenarios. The combinatorial explosion makes 100% coverage impractical.

#### 5. **APIManager.js** (72.26% branch, 1,379 lines)

**Root Cause:** Error handling paths and retry logic branches.

| Uncovered Lines | Category | Description |
|-----------------|----------|-------------|
| 117, 158 | Init | Module loading fallbacks |
| 257-338 | Error | Error categorization branches |
| 379-420 | Retry | Retry logic edge cases |
| 513-596 | Network | Network error handling |
| 623-725 | Timeout | Timeout handling branches |
| 752-798 | Response | Response parsing fallbacks |
| 840-972 | Error | Error recovery paths |
| 1121-1165 | Cleanup | Request cleanup edge cases |
| 1309-1344 | Fallback | API fallback paths |

**Pattern:** APIManager has extensive **error handling and retry logic**. Many branches handle rare error conditions (network failures, timeouts, malformed responses) that are difficult to trigger in tests.

---

## The Core Problem

The low coverage in these files is NOT because:
- ❌ The code is poorly written
- ❌ There are dead code paths
- ❌ The tests are inadequate

The low coverage IS because:
- ✅ **Defensive programming:** These files have extensive null checks and fallbacks
- ✅ **Error handling:** Many branches handle rare error conditions
- ✅ **Facade pattern:** These files coordinate many components, requiring fallbacks when any component is unavailable
- ✅ **Environment differences:** Some branches only execute in specific environments (browser vs Node.js)

### Strategic Options

| Option | Approach | Coverage Impact | Risk | Effort |
|--------|----------|-----------------|------|--------|
| **A** | Add more tests for edge cases | +2-5% | Low | Medium |
| **B** | Extract defensive code into testable modules | +3-7% | Medium | High |
| **C** | Refactor god classes into smaller focused modules | +5-10% | High | Very High |
| **D** | Accept current coverage for defensive code | 0% | Low | None |

**Recommendation:** Hybrid approach - Options A + B

---

## Phased Refactoring Plan

### Phase 1: Low-Hanging Fruit (Week 1-2)
**Goal:** Add targeted tests for uncovered branches that represent real functionality

#### 1.1 APIManager Error Handling Tests
**File:** `tests/jest/APIManager.test.js`
**Target:** 72.26% → 78%+

Add tests for:
- [ ] Network error categorization (lines 257-338)
- [ ] Retry exhaustion scenarios (lines 379-420)
- [ ] Timeout handling (lines 623-725)
- [ ] Malformed response parsing (lines 752-798)

**Estimated effort:** 4-6 hours  
**Expected coverage gain:** +5-6%

#### 1.2 LayersEditor Workflow Tests
**File:** `tests/jest/LayersEditor.test.js`
**Target:** 70.38% → 76%+

Add tests for:
- [ ] Cancel during active save operation
- [ ] Save failure with dirty state
- [ ] Export with no layers
- [ ] Import with validation errors

**Estimated effort:** 4-6 hours  
**Expected coverage gain:** +5-6%

#### 1.3 LayerPanel Rendering Tests
**File:** `tests/jest/LayerPanel.test.js`
**Target:** 72.24% → 78%+

Add tests for:
- [ ] Empty layer list rendering
- [ ] Layer type-specific rendering (image, group, text)
- [ ] Context menu on different layer types
- [ ] Multi-select edge cases

**Estimated effort:** 4-6 hours  
**Expected coverage gain:** +5-6%

#### 1.4 Toolbar State Tests
**File:** `tests/jest/Toolbar.test.js`
**Target:** 69.73% → 76%+

Add tests for:
- [ ] Tool state updates with null selection
- [ ] Style control updates with multi-selection
- [ ] Mobile/touch mode state
- [ ] Disabled state handling

**Estimated effort:** 4-6 hours  
**Expected coverage gain:** +6-7%

#### 1.5 CanvasManager Controller Tests
**File:** `tests/jest/CanvasManager.test.js`
**Target:** 69.61% → 76%+

Add tests for:
- [ ] Partial controller initialization
- [ ] Fallback rendering without ZoomPanController
- [ ] State manager unavailable scenarios
- [ ] Destroy with partial initialization

**Estimated effort:** 6-8 hours  
**Expected coverage gain:** +6-7%

**Phase 1 Total:**
- **Effort:** 22-32 hours (~1-2 weeks)
- **Expected gain:** +2.5-3.5% overall branch coverage
- **Target:** 82.98% → 85-86%

---

### Phase 2: Architectural Improvements (Week 3-6)
**Goal:** Extract cohesive functionality to improve testability

#### 2.1 Extract CanvasManager Event Handling

**Current:** CanvasManager handles mouse/touch events directly (lines 1352-1680)

**Proposed:** Create `InputEventRouter.js` (~300 lines)
- Routes mouse/touch events to appropriate controllers
- Handles event normalization
- Manages input state (dragging, hovering, etc.)

**Benefits:**
- InputEventRouter is independently testable
- CanvasManager reduced by ~300 lines
- Clear separation of concerns

**Effort:** 8-12 hours

#### 2.2 Extract APIManager Retry Logic

**Current:** APIManager has inline retry logic (lines 379-596)

**Proposed:** Create `RetryPolicy.js` (~150 lines)
- Configurable retry strategies
- Exponential backoff with jitter
- Circuit breaker pattern

**Benefits:**
- RetryPolicy is unit testable
- Reusable across different API calls
- Clear retry semantics

**Effort:** 4-6 hours

#### 2.3 Extract LayerPanel Rendering

**Current:** LayerPanel renders layer items inline (lines 539-853)

**Proposed:** Already extracted to `LayerListRenderer.js` and `LayerItemFactory.js`

**Action:** Add tests for existing extracted modules

**Effort:** 4-6 hours

#### 2.4 Extract Toolbar State Management

**Current:** Toolbar manages UI state inline (lines 648-1191)

**Proposed:** Create `ToolbarStateSync.js` (~250 lines)
- Syncs toolbar with editor state
- Handles selection → UI mapping
- Manages tool activation state

**Benefits:**
- ToolbarStateSync is testable in isolation
- Clear state flow

**Effort:** 6-8 hours

#### 2.5 Extract LayersEditor Workflow

**Current:** LayersEditor handles save/cancel/export inline (lines 692-1283)

**Proposed:** Already extracted to `RevisionManager.js` and `DialogManager.js`

**Action:** Add tests for workflow edge cases in existing modules

**Effort:** 4-6 hours

**Phase 2 Total:**
- **Effort:** 26-38 hours (~2-3 weeks)
- **Expected gain:** +3-5% overall branch coverage
- **Target:** 85-86% → 88-90%

---

### Phase 3: Deep Refactoring (Month 2-3)
**Goal:** Reduce god class count and establish sustainable architecture

#### 3.1 Decompose CanvasManager

**Current:** 1,927 lines, facade with 10+ dependencies

**Target:** <1,500 lines

**Extraction Plan:**
| New Module | Lines | Responsibility |
|------------|-------|----------------|
| InputEventRouter.js | 300 | Event routing |
| CanvasLifecycle.js | 200 | Init/destroy |
| CanvasStateSync.js | 150 | State coordination |
| **Total extracted** | 650 | |
| **CanvasManager after** | ~1,277 | Pure facade |

**Effort:** 20-30 hours

#### 3.2 Decompose Toolbar

**Current:** 1,788 lines

**Target:** <1,400 lines

**Extraction Plan:**
| New Module | Lines | Responsibility |
|------------|-------|----------------|
| ToolbarStateSync.js | 250 | State management |
| ToolButtonFactory.js | 150 | Button creation |
| **Total extracted** | 400 | |
| **Toolbar after** | ~1,388 | Pure UI |

**Effort:** 12-18 hours

#### 3.3 Decompose LayerPanel

**Current:** 1,806 lines (already has 9 controllers)

**Target:** <1,500 lines

**Extraction Plan:**
| New Module | Lines | Responsibility |
|------------|-------|----------------|
| LayerPanelState.js | 200 | State management |
| LayerPanelKeyboard.js | 150 | Keyboard nav |
| **Total extracted** | 350 | |
| **LayerPanel after** | ~1,456 | Pure UI |

**Effort:** 12-18 hours

**Phase 3 Total:**
- **Effort:** 44-66 hours (~3-4 weeks)
- **God class reduction:** 16 → 13 (3 files below 1K threshold)
- **Coverage target:** 88-90%

---

## Risk Mitigation

### Testing Strategy

Every refactoring step must follow this process:

1. **Before extraction:**
   - Ensure 100% existing tests pass
   - Add tests for functionality to be extracted
   - Document current behavior

2. **During extraction:**
   - Extract to new module
   - Update imports in original file
   - Ensure new module has 90%+ coverage

3. **After extraction:**
   - Run full test suite
   - Verify no regressions
   - Update documentation

### Rollback Plan

- Each phase is independently deployable
- Feature branches for each extraction
- Revert capability at any point
- No changes to API contracts

### Dependencies

| Phase | Depends On | Blocks |
|-------|------------|--------|
| Phase 1 | None | Phase 2 |
| Phase 2 | Phase 1 complete | Phase 3 |
| Phase 3 | Phase 2 complete | None |

---

## Success Metrics

### Phase 1 Completion Criteria
- [ ] Branch coverage ≥ 85%
- [ ] All 8,896+ tests passing
- [ ] No new god classes created
- [ ] Documentation updated

### Phase 2 Completion Criteria
- [ ] Branch coverage ≥ 87%
- [ ] 2+ new extracted modules with 90%+ coverage
- [ ] CanvasManager ≤ 1,700 lines
- [ ] Clear module boundaries documented

### Phase 3 Completion Criteria
- [ ] Branch coverage ≥ 89%
- [ ] God class count ≤ 13
- [ ] No file > 1,800 lines
- [ ] Architecture documentation updated

---

## Immediate Next Steps

1. **Start Phase 1.1:** Add APIManager error handling tests
2. **Track progress:** Update this document after each milestone
3. **Review weekly:** Assess coverage gains and adjust plan

---

## Appendix: Verification Commands

```bash
# Current coverage
npm run test:js -- --coverage 2>&1 | grep "All files"

# Coverage by file
npm run test:js -- --coverage 2>&1 | grep -E "(CanvasManager|Toolbar|LayersEditor|LayerPanel|APIManager)"

# God class count
wc -l resources/**/*.js resources/**/**/*.js | sort -rn | awk '$1 >= 1000' | wc -l

# File line counts
wc -l resources/**/*.js resources/**/**/*.js | sort -rn | head -20
```

---

*Plan created: January 11, 2026*  
*Version: 1.0*  
*Next review: After Phase 1 completion*
