# Layers Extension - Improvement Plan

**Last Updated:** December 11, 2025  
**Status:** Active  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 11, 2025.

### Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | Extension works in production |
| **Test Suite** | ✅ Strong | 3,869 tests, 88.4% coverage, all passing |
| **Security (PHP)** | ✅ Excellent | CSRF, rate limiting, validation |
| **Code Splitting** | ✅ Done | Viewer ~3.2K lines, Editor ~31.6K lines |
| **JavaScript Architecture** | 🟡 Improving | 36 ES6 classes, ShadowRenderer extracted |
| **Namespace** | 🟡 In Progress | 48 direct window.X exports remain (1 migrated) |

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

**Resolution:** Dead `getNextRevision()` method was removed. Only `getNextRevisionForSet()` remains.

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

**Resolution:** Created `utils/NamespaceHelper.js` with shared implementation. Files updated to use it.

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

**Resolution:**
Updated 3 test blocks in IconFactory.test.js to match current Feather-style implementation:
- Eye icon: Changed from ellipse+circle to path+circle expectations
- Lock icon: Fixed color expectations (#888 not #27ae60), updated path expectations
- Delete icon: Removed style/opacity check that doesn't exist
- Grab icon: Changed from 4 to 6 circles (2x3 grid pattern)

All 18 IconFactory tests now pass.

---

## Phase 1: High-Impact Improvements (P1)

### P1.1 Eliminate Direct Global Exports

**Status:** 🟡 IN PROGRESS (Started Dec 11, 2025)  
**Effort:** 2-3 weeks  
**Impact:** Enables future ES modules, prevents conflicts

**Progress:**
- ✅ CanvasRenderer.js updated to use `getClass()` for TextUtils and GeometryUtils
- ✅ Added DEPRECATED comments to direct window.X exports
- ✅ All 3,869 tests still pass

**Remaining:** 48 files still export directly to `window.ClassName`

**Problem:**
49 files export to both `window.Layers.X` AND `window.X`:
```javascript
window.Layers.Canvas.Manager = CanvasManager;  // Good (178 instances)
window.CanvasManager = CanvasManager;          // Bad - remove (49 instances)
```

**Action Plan:**

1. **Week 1: Audit and prepare**
   - Create deprecation warnings for direct global access
   - Update `compat.js` with console warnings
   - Document all 49 direct exports

2. **Week 2: Update consumers**
   - Search for all `window.CanvasManager` etc. usage
   - Replace with `window.Layers.Canvas.Manager` or `getClass()` from NamespaceHelper
   - Update test mocks to use namespaced imports

3. **Week 3: Remove direct exports**
   - Remove `window.X = X;` lines from all files
   - Keep only `window.Layers.*` exports
   - Run full test suite

**Success Criteria:**
- [ ] 0 direct `window.X` exports (currently 49)
- [ ] All tests pass
- [ ] No runtime errors in browser

---

### P1.2 Add Integration Tests

**Status:** NOT STARTED  
**Effort:** 2 weeks  
**Impact:** Catch multi-component bugs

**Problem:**
Limited integration test coverage. No coverage for:
- CanvasManager ↔ Controller interactions
- StateManager ↔ HistoryManager synchronization
- Error propagation across modules

**Action Plan:**

1. Create `tests/jest/integration/` directory (if not exists)
2. Add tests for:
   - Layer creation flow (ToolManager → CanvasManager → StateManager)
   - Undo/redo flow (HistoryManager ↔ StateManager)
   - Selection flow (HitTestController → SelectionManager)
   - Save flow (StateManager → APIManager → validation)

**Target:** 10+ integration tests covering critical paths

---

### P1.3 Standardize PHP Logging

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 1 day  
**Impact:** Debugging consistency

**Resolution:** All `wfDebugLog('Layers', ...)` calls replaced with injected logger.

---

## Phase 2: Major Refactoring (P2)

### P2.1 Continue ES6 Class Migration

**Status:** ~6% COMPLETE (36 classes of ~604 prototype patterns)  
**Effort:** 6-8 weeks  
**Impact:** Modern code, TypeScript readiness

**Already Using ES6 Classes (36 total):**
- AccessibilityAnnouncer, APIManager, CanvasUtilities
- ClipboardController, DialogManager, ErrorHandler
- EventManager, EventTracker, GeometryUtils
- HistoryManager, HitTestController, ImageLoader
- ImportExportManager, LayerItemEvents, LayerPanel
- MarqueeSelection, MessageHelper, ModuleRegistry
- RevisionManager, SelectionHandles, SelectionState
- StateManager, StyleController, TextUtils
- UIManager, ValidationManager, ZoomPanController
- and more...

**Still Using Prototype Pattern (17 constructor functions):**
- CanvasManager.js (2,071 lines) - HIGH PRIORITY
- CanvasRenderer.js (939 lines)
- CanvasEvents.js (573 lines)
- LayersEditor.js (1,268 lines) - HIGH PRIORITY
- LayersValidator.js (953 lines)
- LayerSetManager.js (570 lines)
- Toolbar.js (955 lines)
- ToolbarStyleControls.js (759 lines)
- SelectionManager.js (1,261 lines)
- ToolManager.js (currently unknown)
- TransformController.js (1,332 lines)
- And others in canvas/, tools/, ui/ directories

**Migration Order (by test coverage, lowest risk first):**

| Phase | Files | Coverage | Weeks |
|-------|-------|----------|-------|
| 1 | LayersValidator, LayerSetManager | High | 1 |
| 2 | CanvasEvents, CanvasRenderer | High | 1 |
| 3 | Toolbar, ToolbarStyleControls | Medium | 1 |
| 4 | SelectionManager | High | 1 |
| 5 | CanvasManager | High | 2 |
| 6 | LayersEditor | High | 1 |

**Conversion Pattern:**
```javascript
// Before:
function LayersValidator( options ) { this.options = options; }
LayersValidator.prototype.validate = function( data ) { ... };
window.LayersValidator = LayersValidator;

// After:
class LayersValidator {
    constructor( options ) {
        this.options = options;
    }
    validate( data ) { ... }
}
window.Layers.Validation.LayersValidator = LayersValidator;
```

---

### P2.2 Split LayerRenderer.js (1,948 lines)

**Status:** 🟡 IN PROGRESS (ShadowRenderer extracted - Dec 11, 2025)  
**Effort:** 4 weeks  
**Impact:** Maintainability, isolated testing

**Progress:**
- ✅ ShadowRenderer.js extracted (517 lines of shadow logic)
- ✅ LayerRenderer.js reduced from ~2,195 to ~1,948 lines
- ⬜ Shape renderers still to extract

**Proposed Structure:**
```
ext.layers.shared/
├── LayerRenderer.js           # Facade, 300 lines max
├── ShadowRenderer.js          # ✅ DONE - Shadow effects
└── renderers/
    ├── BaseRenderer.js        # Shared utilities
    ├── RectangleRenderer.js
    ├── CircleRenderer.js
    ├── EllipseRenderer.js
    ├── PolygonRenderer.js
    ├── StarRenderer.js
    ├── ArrowRenderer.js
    ├── LineRenderer.js
    ├── PathRenderer.js
    ├── TextRenderer.js
    ├── HighlightRenderer.js
    └── BlurRenderer.js
```

**Migration Strategy:**
1. ✅ Create ShadowRenderer with delegation pattern
2. Extract one shape renderer at a time
3. Maintain 100% test compatibility
4. Target: No renderer file > 300 lines

---

### P2.3 Continue CanvasManager Extraction

**Status:** ~45% COMPLETE (9 controllers extracted)  
**Effort:** 3-4 weeks  
**Target:** CanvasManager < 500 lines (currently 2,071)

**Already Extracted Controllers:**
| Controller | Lines | Coverage |
|------------|-------|----------|
| ZoomPanController | ~340 | 97% |
| GridRulersController | ~385 | 94% |
| TransformController | ~1,332 | 86% |
| HitTestController | ~380 | 98% |
| DrawingController | ~632 | 100% |
| ClipboardController | ~210 | 98% |
| RenderCoordinator | ~390 | 93% |
| InteractionController | ~490 | 100% |
| TextInputController | ~??? | 86% |

**Note:** TransformController at 1,332 lines has become a god class itself - should be split.

**Still in CanvasManager (~1,500+ lines to extract):**
- Background image loading (~150 lines)
- Layer operations (add/remove/reorder) (~200 lines)
- Style state management (~100 lines)
- Bounds calculations (~100 lines)
- Event coordination (~300+ lines)
- And more...

---

### P2.4 Split TransformController (1,332 lines)

**Status:** NOT STARTED  
**Effort:** 2 weeks  
**Impact:** Reduce complexity in largest controller

TransformController has grown to 1,332 lines. Consider extracting:
- ResizeController (~400 lines)
- RotationController (~300 lines)
- DragController (~300 lines)

---

## Phase 3: Modernization (P3)

### P3.1 Complete ES6 Migration

**Timeline:** After P2.1 proves pattern  
**Effort:** 4-6 weeks  
**Target:** 0 prototype methods

Convert remaining files after initial batch succeeds.

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

### P3.4 Unified Client/Server Validation

**Timeline:** 6+ months  
**Effort:** 2-3 weeks

**Problem:**
Dual validation systems must stay in sync manually.

**Solution:**
Generate client validation from server rules:
```php
// Server defines rules
$rules = ServerSideLayerValidator::ALLOWED_PROPERTIES;
// Export to JSON for build process
```

```javascript
// Client consumes generated rules
import rules from './generated/validation-rules.json';
```

---

## Progress Tracking

### Visual Progress

```
Phase 0 (Quick Wins):
P0.1 Remove Dead PHP Code:    ████████████████████ 100% ✓
P0.2 Empty Catch Blocks:      ████████████████████ 100% ✓
P0.3 Extract getClass():      ████████████████████ 100% ✓
P0.4 Remove Skipped Test:     ████████████████████ 100% ✓
P0.5 Fix IconFactory Tests:   ░░░░░░░░░░░░░░░░░░░░ 0% (6 failing)

Phase 1 (High Impact):
P1.1 Global Export Cleanup:   ░░░░░░░░░░░░░░░░░░░░ 0% (49 exports)
P1.2 Integration Tests:       ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 PHP Logging:             ████████████████████ 100% ✓

Phase 2 (Refactoring):
P2.1 ES6 Class Migration:     ██░░░░░░░░░░░░░░░░░░ 6% (36/~604)
P2.2 Split LayerRenderer:     ███░░░░░░░░░░░░░░░░░ 15% (ShadowRenderer done)
P2.3 CanvasManager Extraction: █████████░░░░░░░░░░░ 45% (9 controllers)
P2.4 Split TransformController: ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (Modernization):
P3.1 Complete ES6 Migration:  █░░░░░░░░░░░░░░░░░░░ 6%
P3.2 TypeScript Definitions:  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Unified Validation:      ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [x] Dead `getNextRevision()` method removed ✓
- [x] 0 empty catch blocks ✓
- [x] `getClass()` in single shared file ✓
- [x] 0 skipped tests ✓
- [ ] 0 failing tests (currently 6)

### Phase 1 Complete When:
- [ ] Direct `window.X` exports = 0 (currently 49)
- [ ] Integration tests ≥ 10
- [x] All PHP logging uses injected logger ✓

### Phase 2 Complete When:
- [ ] ES6 classes ≥ 50% of codebase (currently ~6%)
- [ ] LayerRenderer.js < 500 lines (currently 1,948)
- [ ] CanvasManager < 500 lines (currently 2,071)
- [ ] TransformController < 500 lines (currently 1,332)

### Project "Healthy" When:
- [ ] 0 files > 1,000 lines (currently 6)
- [ ] ES6 classes throughout
- [ ] 0 direct global exports (currently 49)
- [ ] 0 prototype methods (currently ~604)
- [ ] All tests passing (currently 6 failing)

---

## Estimated Timeline

| Phase | Duration | Start After |
|-------|----------|-------------|
| Phase 0 | 1 day remaining | Now (1 task left) |
| Phase 1 | 4 weeks | Phase 0 |
| Phase 2 | 8-12 weeks | Phase 1 |
| Phase 3 | 12+ weeks | Phase 2 |

**Total to "Healthy" state: 6-8 months**

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ES6 conversion introduces bugs | Medium | Medium | Convert high-coverage files first |
| Global removal breaks runtime | Medium | High | Add deprecation warnings first |
| LayerRenderer split causes regressions | Medium | High | Visual regression tests |
| Test coverage drops during refactoring | Medium | Medium | CI gate on coverage |

---

## Quick Start: What to Do Today

1. **Fix IconFactory tests** (P0.5) - 6 failing tests
2. **Run `npm run test:js -- --coverage`** - verify baseline
3. **Review global exports** - prepare for P1.1
4. **Pick one ES6 migration candidate** - low-risk utility

---

## Verification Commands

```bash
# Run all tests
npm run test:js -- --coverage

# Check test failures
npm run test:js 2>&1 | grep -A5 "FAIL"

# Check for remaining direct global exports
grep -rE "window\.[A-Z][a-zA-Z]+ ?=" resources --include="*.js" | grep -v "window\.Layers" | wc -l

# Count prototype vs class methods
echo "Prototypes: $(grep -r "\.prototype\." resources --include="*.js" | wc -l)"
echo "Classes: $(grep -rE "^\s*class\s+[A-Z]" resources --include="*.js" | wc -l)"

# Find god classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | awk '$1 >= 1000 {print}' | sort -rn

# Check for empty catch blocks
grep -rE "catch\s*\([^)]*\)\s*\{\s*\}" resources --include="*.js"
```

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*  
*Last updated: December 11, 2025*
