# Layers Extension - Improvement Plan

**Last Updated:** December 16, 2025  
**Status:** Active  
**Version:** 0.8.9  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 16, 2025.

### Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | Extension works in production |
| **Test Suite** | ✅ Strong | 4,591 tests, 91% statement coverage, all passing |
| **Security (PHP)** | ✅ Excellent | CSRF, rate limiting, validation |
| **Code Splitting** | ✅ Done | Viewer 682 lines, Shared 3,886 lines, Editor 32,465 lines |
| **ES6 Migration** | ✅ Complete | 66 ES6 classes, 0 prototype methods |
| **God Classes** | ⚠️ Needs Work | 6 files over 1,000 lines |
| **Event Listeners** | ⚠️ Needs Audit | 94 add vs 33 remove (imbalance) |

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | This week | Blocking issues, trivial fixes, quick wins |
| **P1** | 1-4 weeks | High-impact improvements |
| **P2** | 1-3 months | Important refactoring |
| **P3** | 3-6 months | Modernization efforts |

---

## Phase 0: Quick Wins (P0)

### P0.1 Remove Dead PHP Code

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 1 hour  
**File:** `src/Database/LayersDatabase.php`

**Resolution:** Dead `getNextRevision()` method was removed.

---

### P0.2 Add Logging to Empty Catch Blocks

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 30 minutes  
**File:** `resources/ext.layers.editor/CanvasManager.js`

**Resolution:** Added `mw.log.warn()` to all catch blocks.

---

### P0.3 Extract Duplicated `getClass()` Helper

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 2-3 hours  
**Impact:** Stops code duplication

**Resolution:** Created `utils/NamespaceHelper.js` with shared implementation.

---

### P0.4 Remove Empty Skipped Test

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 5 minutes

**Resolution:** Empty skipped test removed.

---

### P0.5 Fix Failing IconFactory Tests

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 30 minutes  
**Files:** `tests/jest/IconFactory.test.js`

**Resolution:** All 18 IconFactory tests now pass.

---

### P0.6 Convert LayersViewer.js to ES6

**Status:** ✅ COMPLETE  
**Effort:** 2 hours  
**File:** `resources/ext.layers/LayersViewer.js`

**Details:**
Converted from prototype pattern to ES6 class. Added 38 new tests.

**Migration Pattern:**
```javascript
// Before:
function LayersViewer( container, config ) { ... }
LayersViewer.prototype.init = function() { ... };

// After:
class LayersViewer {
    constructor( container, config ) { ... }
    init() { ... }
}
```

---

## Phase 1: High-Impact Improvements (P1)

### P1.1 Eliminate Direct Global Exports

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 2 days  
**Impact:** Enables future ES modules, prevents conflicts

**Resolution:**
- Removed all 50 deprecated `window.ClassName` exports
- Updated 15+ test files to use namespaced paths (`window.Layers.*`)
- Fixed `getClass()` helper to dynamically resolve namespace paths
- All 4,300 tests pass

**Success Criteria:**
- [x] Direct `window.X` exports = 0 (was 50) ✓
- [x] All tests pass ✓
- [x] No runtime errors in browser ✓

---

### P1.2 Add Integration Tests

**Status:** ✅ COMPLETED (Dec 12, 2025)  
**Effort:** 2 weeks  
**Impact:** Catch multi-component bugs

**Resolution:**
Created 3 integration test files with **138 tests total**:

1. **SelectionWorkflow.test.js** (44 tests)
   - HitTestController layer detection for all 11 layer types
   - Multi-selection workflows
   - Selection toggle behavior

2. **LayerWorkflow.test.js** (70 tests)
   - Layer CRUD operations
   - Reordering workflows
   - Visibility/lock state management

3. **SaveLoadWorkflow.test.js** (24 tests)
   - API mock integration
   - State persistence verification

---

### P1.3 Standardize PHP Logging

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 1 day  
**Impact:** Debugging consistency

**Resolution:** All `wfDebugLog('Layers', ...)` calls replaced with injected logger.

---

## Phase 2: Major Refactoring (P2)

### P2.1 ES6 Class Migration

**Status:** ✅ 98% COMPLETE (Dec 12, 2025)  
**Effort:** Completed over 4 days  
**Impact:** Modern code, TypeScript readiness

**Migration Summary:**
| Phase | Files | Status |
|-------|-------|--------|
| Utilities | GeometryUtils, EventTracker, etc. | ✅ Done |
| Managers | APIManager, HistoryManager, etc. | ✅ Done |
| Controllers | All 9 canvas controllers | ✅ Done |
| Core | CanvasManager, LayersEditor, SelectionManager | ✅ Done |
| Renderers | LayerRenderer, ShadowRenderer | ✅ Done |
| Viewer | LayersViewer.js | ⚠️ P0.6 |

**Remaining:** 1 file (`LayersViewer.js`) with 10 prototype methods

---

### P2.2 Split LayerRenderer.js

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 2 weeks  
**Impact:** Maintainability, isolated testing

**Resolution:**
LayerRenderer reduced from 1,953 lines to **371 lines** (81% reduction)

**Extracted Renderers:**
| Renderer | Lines | Purpose |
|----------|-------|---------|
| LayerRenderer | 371 | Facade/dispatcher |
| ShapeRenderer | 1,050 | Rectangle, circle, ellipse, polygon, star, line, path |
| ArrowRenderer | 702 | Arrow polygons with heads |
| ShadowRenderer | 521 | Shadow effects (blur, spread, glow) |
| TextRenderer | 343 | Text with stroke/shadow |
| EffectsRenderer | 245 | Blur effects |

**Tests:** All 4,300 tests pass

---

### P2.3 Continue CanvasManager Extraction

**Status:** ~50% COMPLETE  
**Effort:** 3-4 weeks  
**Target:** CanvasManager < 1,500 lines (currently 1,895)

**Already Extracted Controllers:**
| Controller | Lines | Coverage |
|------------|-------|----------|
| ZoomPanController | ~340 | 97% |
| GridRulersController | ~385 | 93% |
| TransformController | ~761 | 88% |
| HitTestController | ~380 | 98% |
| DrawingController | ~635 | 100% |
| ClipboardController | ~210 | 98% |
| RenderCoordinator | ~390 | 92% |
| InteractionController | ~490 | 100% |
| StyleController | ~100 | 100% |
| TextInputController | ~120 | 100% |
| ResizeCalculator | ~806 | 93% |

**Progress (Dec 16, 2025):**
- Many controllers already extracted
- Remaining 1,895 lines are primarily orchestration logic
- Further extraction may yield diminishing returns

**Remaining in CanvasManager (~1,895 lines):**
- Constructor/init (~200 lines) - Core, cannot extract
- Event coordination (~200 lines) - Orchestration logic
- Selection coordination (~150 lines) - Ties to SelectionManager
- Render coordination (~150 lines) - Ties to RenderCoordinator
- Delegation methods (~500 lines) - Facade pattern
- Utility methods (~100 lines) - Various helpers

**Note:** Getting below 1,000 lines would require fundamental architectural changes.
Current target revised to <1,500 lines.

---

### P2.4 Split TransformController

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 1 hour  
**Impact:** Reduced TransformController from 1,333 lines to 761 lines

**Resolution:**
Extracted `ResizeCalculator.js` (806 lines) with all shape-specific resize calculation methods:
- `calculateResize()` - dispatcher by layer type
- `calculateRectangleResize()`, `calculateCircleResize()`, `calculateEllipseResize()`
- `calculatePolygonResize()`, `calculateLineResize()`, `calculatePathResize()`, `calculateTextResize()`
- `applyRotatedResizeCorrection()` - rotation anchor correction

**Result:**
- TransformController: 1,333 → **761 lines** ✅
- ResizeCalculator: (new) **806 lines**
- All 4,025 tests pass

---

### P2.5 Improve ShadowRenderer Coverage

**Status:** ✅ COMPLETE  
**Effort:** 1 day  
**Impact:** Increased coverage from 72.72% to 100%

**Result:** Added 78 new tests covering all shadow rendering functionality.

---

### P2.6 Improve ResizeCalculator Coverage

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 2 hours  
**Impact:** Coverage improved from 75% to 93%

**Result:**
- Added 76 new tests in `ResizeCalculator.test.js`
- Statement coverage: 92.78%
- Function coverage: 100%
- Branch coverage: 85.71%
- Remaining uncovered lines: Complex rotation math in `applyRotatedResizeCorrection()`

---

### P2.9 Improve StateManager Coverage

**Status:** ✅ COMPLETE (December 14, 2025)  
**Effort:** 3 hours  
**Impact:** Coverage improved from 68% to 98%

**Result:**
- Added 101 new tests in `StateManager.test.js`
- Statement coverage: 98.03%
- Function coverage: 100%
- Branch coverage: 85.29%
- Tests cover: constructor, get/set, update, atomic operations, locking, subscribe, layer operations, selection, history, export/import, destroy

---

### P2.10 Improve APIManager Coverage

**Status:** ✅ COMPLETE (December 14, 2025)  
**Effort:** 2 hours  
**Impact:** Coverage improved from 84% to 87%

**Result:**
- Added 19 new tests for save/load workflows
- Tests cover: loadLayersBySetName, buildSavePayload, performSaveWithRetry, handleSaveSuccess, enable/disableSaveButton

---

### P2.11 Improve LayersNamespace Coverage

**Status:** ✅ COMPLETE (December 14, 2025)  
**Effort:** 1 hour  
**Impact:** Coverage improved from 27% to 78%

**Result:**
- Added 27 new tests for namespace registration
- Tests cover: getExportRegistry, registerExport, initializeNamespace, exportRegistry structure

---

### P2.8 Improve LayerPanel Coverage

**Status:** ✅ COMPLETE (December 13, 2025)  
**Effort:** 1 hour  
**Impact:** Coverage improved from 77% to 87%

**Result:**
- Added 28 new tests in `LayerPanelKeyboard.test.js`
- Statement coverage: 86.64%
- Branch coverage: 74.29%
- Tests cover keyboard navigation (ArrowUp/Down, Home/End, Enter/Space, Delete, V for visibility, L for lock)

---

## Phase 3: Modernization (P3)

### P3.1 Complete ES6 Migration

**Status:** ⚠️ 1 file remaining  
**Effort:** 2 hours  
**Target:** 0 prototype methods

Convert `LayersViewer.js` after P0.6.

---

### P3.2 Add TypeScript Definitions

**Timeline:** After P3.1 complete  
**Effort:** 2-3 weeks  

Create `.d.ts` files for:
- All exported classes
- API contracts
- Layer data structures

Benefits:
- IDE autocomplete without full TS migration
- Type checking in consuming code
- Documentation generation

---

### P3.3 TypeScript Migration

**Timeline:** 6+ months  
**Prerequisites:** ES6 complete, globals eliminated

**Approach:**
1. Add `tsconfig.json` with `allowJs: true`
2. Convert files incrementally (`.js` → `.ts`)
3. Start with utilities, end with UI
4. Maintain 100% test coverage during migration

---

### P3.4 Set Up E2E Tests in CI

**Status:** NOT STARTED  
**Effort:** 1 week  
**Impact:** Catch browser-level regressions

**Current State:**
- Playwright tests exist in `tests/e2e/layers.spec.js`
- Not currently running in CI

**Action:**
- Add GitHub Actions workflow for Playwright
- Set up MediaWiki test environment in Docker
- Run on PR merge to main

---

## Progress Tracking

### Visual Progress

```
Phase 0 (Quick Wins):
P0.1 Remove Dead PHP Code:    ████████████████████ 100% ✓
P0.2 Empty Catch Blocks:      ████████████████████ 100% ✓
P0.3 Extract getClass():      ████████████████████ 100% ✓
P0.4 Remove Skipped Test:     ████████████████████ 100% ✓
P0.5 Fix IconFactory Tests:   ████████████████████ 100% ✓
P0.6 LayersViewer ES6:        ████████████████████ 100% ✓

Phase 1 (High Impact):
P1.1 Global Export Cleanup:   ████████████████████ 100% ✓
P1.2 Integration Tests:       ████████████████████ 100% ✓ (138 tests)
P1.3 PHP Logging:             ████████████████████ 100% ✓

Phase 2 (Refactoring):
P2.1 ES6 Class Migration:     ████████████████████ 100% ✓
P2.2 Split LayerRenderer:     ████████████████████ 100% ✓ (371 lines)
P2.3 CanvasManager Extraction: ██████████░░░░░░░░░░ 50% (1,895 lines)
P2.4 Split TransformController: ████████████████████ 100% ✓ (761 lines)
P2.5 ShadowRenderer Coverage: ████████████████████ 100% ✓
P2.6 ResizeCalculator Coverage: ██████████████████░░ 93% ✓ (76 tests)
P2.8 LayerPanel Coverage:     █████████████████░░░ 87% ✓ (28 tests)
P2.9 StateManager Coverage:   ████████████████████ 98% ✓ (101 tests)
P2.10 APIManager Coverage:    █████████████████░░░ 87% ✓ (19 tests)
P2.11 LayersNamespace Coverage: ███████████████░░░░░ 78% ✓ (27 tests)

Phase 3 (Modernization):
P3.1 Complete ES6 Migration:  ████████████████████ 100% ✓
P3.2 TypeScript Definitions:  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 E2E Tests in CI:         ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [x] Dead `getNextRevision()` method removed ✓
- [x] 0 empty catch blocks ✓
- [x] `getClass()` in single shared file ✓
- [x] 0 skipped tests ✓
- [x] 0 failing tests ✓
- [x] LayersViewer.js converted to ES6 ✓

### Phase 1 Complete When:
- [x] Direct `window.X` exports = 0 ✓
- [x] Integration tests ≥ 50 ✓ (138 tests)
- [x] All PHP logging uses injected logger ✓

### Phase 2 Complete When:
- [x] ES6 classes = 100% ✓
- [x] LayerRenderer.js < 500 lines ✓ (371 lines)
- [ ] CanvasManager < 1,500 lines (currently 1,895)
- [x] TransformController < 800 lines ✓ (761 lines)
- [x] ShadowRenderer coverage > 90% ✓ (100%)
- [x] ResizeCalculator coverage > 90% ✓ (93%)

### Project "Healthy" When:
- [ ] 0 files > 1,000 lines (currently 6)
- [x] ES6 classes throughout ✓ (100%)
- [x] 0 prototype methods ✓
- [x] All tests passing ✓ (4,624)
- [ ] >90% statement coverage (currently 89.29%)
- [x] >75% branch coverage ✓ (77.16%)
- [ ] Event listener balance (currently 94 add vs 33 remove)

---

## Estimated Timeline

| Phase | Duration | Start After |
|-------|----------|-------------|
| Phase 0 | ✅ COMPLETE | - |
| Phase 1 | ✅ COMPLETE | - |
| Phase 2 | 4-6 weeks | Now |
| Phase 3 | 8+ weeks | Phase 2 |

**Remaining to "Healthy" state: Split 6 god classes, audit event listeners**

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ~~Global removal breaks runtime~~ | ~~Medium~~ | ~~High~~ | ✅ Completed without issues |
| LayerRenderer split causes regressions | Low | Medium | ✅ Complete, tests pass |
| Test coverage drops during refactoring | Medium | Medium | CI gate on coverage |
| TransformController refactor introduces bugs | Low | Medium | ✅ Complete, tests pass |

---

## Quick Start: What to Do Next

**Current God Classes (6 files >1000 lines) - Verified December 16, 2025:**
| File | Lines | Priority |
|------|-------|----------|
| CanvasManager.js | 1,895 | High - Primary orchestrator |
| LayerPanel.js | 1,430 | High - UI complexity |
| APIManager.js | 1,323 | Medium - API + state mix |
| LayersEditor.js | 1,296 | Medium - Main entry point |
| SelectionManager.js | 1,266 | Medium - Selection logic |
| ToolManager.js | 1,155 | Medium - Tool state |

*Note: ShapeRenderer.js at 1,049 lines is borderline and appropriately sized for a shared renderer.*

**Recommended Next Actions:**
1. **Audit event listeners** - Document 94 addEventListener calls
2. **Extract controllers from CanvasManager** - Look for remaining extraction opportunities
3. **Split LayerPanel** - Extract layer item rendering
4. **Improve branch coverage** - Target 85% (currently 77.16%)

---

## Recent Coverage Improvements

### December 14, 2025 (v0.8.6)

| Module | Before | After | Tests Added |
|--------|--------|-------|-------------|
| StateManager.js | 68% | 98% | +101 tests |
| APIManager.js | 84% | 87% | +19 tests |
| LayersNamespace.js | 27% | 78% | +27 tests |

### December 13, 2025 (v0.8.5)

| Module | Before | After | Tests Added |
|--------|--------|-------|-------------|
| DeepClone.js | 81% | 100% | +4 fallback tests |
| ToolManager.js | 84% | 90% | +9 destroy/getToolDisplayName tests |
| ShadowRenderer.js | 72% | 100% | +78 tests |
| ResizeCalculator.js | 75% | 93% | +76 tests |
| TextUtils.js | 88% | 99% | +38 tests |

---

## Verification Commands

```bash
# Run all tests
npm run test:js -- --coverage

# Check prototype methods remaining
grep -rE "\.prototype\.[a-zA-Z]+ = function" resources --include="*.js"

# Count integration tests
grep -c "test(" tests/jest/integration/*.test.js

# Check for remaining direct global exports
grep -rE "window\.[A-Z][a-zA-Z]+ ?=" resources --include="*.js" | grep -v "window\.Layers" | wc -l

# Count ES6 classes
grep -rE "^\s*class\s+[A-Z]" resources --include="*.js" | wc -l

# Find god classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | awk '$1 >= 1000 {print}' | sort -rn
```

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*  
*Last updated: December 16, 2025 (v0.8.7)*
