# Layers Extension - Improvement Plan

**Last Updated:** December 10, 2025  
**Status:** Active  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 10, 2025.

### Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | Extension works in production |
| **Test Suite** | ✅ Strong | 3,877 tests, 89.6% coverage |
| **Security (PHP)** | ✅ Excellent | CSRF, rate limiting, validation |
| **Code Splitting** | ✅ Done | Viewer ~4K lines, Editor ~31K lines |
| **JavaScript Architecture** | � Improving | ShadowRenderer extracted, ES6 classes growing |
| **Namespace** | 🔴 Polluted | 54 direct window.X exports |

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

~~**Problem:**
The `getNextRevision()` method (lines 309-324) is never called. It's been superseded by `getNextRevisionForSet()`.~~

**Resolution:** Dead method removed.

---

### P0.2 Add Logging to Empty Catch Blocks

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 30 minutes  
**File:** `resources/ext.layers.editor/CanvasManager.js`

~~**Problem:**
Three empty catch blocks silently swallow errors.~~

**Resolution:** Added `mw.log.warn()` to all catch blocks.

---

### P0.3 Extract Duplicated `getClass()` Helper

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 2-3 hours  
**Impact:** Stops code duplication

~~**Problem:**
The `getClass()` helper is duplicated in 4 files.~~

**Resolution:** Created `NamespaceHelper.js` with shared implementation. Updated all 4 files.

---

### P0.4 Remove Empty Skipped Test

**Status:** ✅ COMPLETED (Dec 11, 2025)  
**Effort:** 5 minutes  
**File:** `tests/jest/CanvasRenderer.test.js`

~~**Problem:**
Empty skipped test.~~

**Resolution:** Test removed.

---

## Phase 1: High-Impact Improvements (P1)

### P1.1 Eliminate Direct Global Exports

**Status:** NOT STARTED  
**Effort:** 2-3 weeks  
**Impact:** Enables future ES modules, prevents conflicts

**Problem:**
54 files export to both `window.Layers.X` AND `window.X`:
```javascript
window.Layers.Canvas.Manager = CanvasManager;  // Good
window.CanvasManager = CanvasManager;          // Bad - remove
```

**Action Plan:**

1. **Week 1: Audit and prepare**
   - Create deprecation warnings for direct global access
   - Update `compat.js` with console warnings
   - Document all 54 direct exports

2. **Week 2: Update consumers**
   - Search for all `window.CanvasManager` etc. usage
   - Replace with `window.Layers.Canvas.Manager` or `getClass()`
   - Update test mocks to use namespaced imports

3. **Week 3: Remove direct exports**
   - Remove `window.X = X;` lines from all 54 files
   - Keep only `window.Layers.*` exports
   - Run full test suite

**Success Criteria:**
- [ ] 0 direct `window.X` exports (currently 54)
- [ ] All tests pass
- [ ] No runtime errors in browser

---

### P1.2 Add Integration Tests

**Status:** NOT STARTED  
**Effort:** 2 weeks  
**Impact:** Catch multi-component bugs

**Problem:**
Only 2 integration tests exist vs 70+ unit tests. No coverage for:
- CanvasManager ↔ Controller interactions
- StateManager ↔ HistoryManager synchronization
- Error propagation across modules

**Action Plan:**

1. Create `tests/jest/integration/` directory
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

~~**Problem:**
Three logging patterns mixed.~~

**Resolution:** All `wfDebugLog('Layers', ...)` calls replaced with injected logger. Anonymous fallback removed from Hooks.php.

---

## Phase 2: Major Refactoring (P2)

### P2.1 Begin ES6 Class Migration

**Status:** NOT STARTED  
**Effort:** 6-8 weeks  
**Impact:** Modern code, TypeScript readiness

**Problem:**
622 prototype methods vs 34 ES6 classes (5% modern).

**Migration Order (by test coverage, lowest risk first):**

| Phase | Files | Coverage | Weeks |
|-------|-------|----------|-------|
| 1 | StyleController, EventManager, EventTracker | 96-100% | 1 |
| 2 | TextUtils, ImageLoader, GeometryUtils | 89-91% | 1 |
| 3 | ModuleRegistry, AccessibilityAnnouncer | 94% | 1 |
| 4 | CanvasUtilities, DeepClone | ~90% | 1 |
| 5 | HistoryManager, ValidationManager | 90-97% | 2 |
| 6 | SelectionManager, ToolManager | 85-90% | 2 |

**Conversion Pattern:**
```javascript
// Before:
function TextUtils() { this.maxLength = 1000; }
TextUtils.prototype.truncate = function( text ) { ... };
window.TextUtils = TextUtils;

// After:
class TextUtils {
    constructor() {
        this.maxLength = 1000;
    }
    truncate( text ) { ... }
}
window.Layers.Utils.Text = TextUtils;
```

**Rules:**
- [ ] Convert one file at a time
- [ ] Run full test suite after each conversion
- [ ] No functionality changes during conversion
- [ ] Update JSDoc to use `@class` and `@method`

---

### P2.2 Split LayerRenderer.js (2,195 lines)

**Status:** 🟡 IN PROGRESS (ShadowRenderer extracted - Dec 11, 2025)  
**Effort:** 4 weeks  
**Impact:** Maintainability, isolated testing

**Progress:**
- ✅ ShadowRenderer.js extracted (~500 lines of shadow logic)
- ✅ LayerRenderer.js reduced to ~1,850 lines
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
**Target:** CanvasManager < 500 lines

**Already Extracted:**
- ZoomPanController (97% coverage)
- GridRulersController (94% coverage)
- TransformController (86% coverage)
- HitTestController (98% coverage)
- DrawingController (100% coverage)
- ClipboardController (98% coverage)
- RenderCoordinator (93% coverage)
- InteractionController (100% coverage)
- TextInputController (86% coverage)

**Still in CanvasManager (~1,000 lines to extract):**
- Background image loading (~150 lines)
- Layer operations (add/remove/reorder) (~200 lines)
- Style state management (~100 lines)
- Bounds calculations (~100 lines)

---

## Phase 3: Modernization (P3)

### P3.1 Complete ES6 Migration

**Timeline:** After P2.1 proves pattern  
**Effort:** 4-6 weeks  
**Target:** 0 prototype methods

Convert remaining files:
- CanvasManager.js (2,061 lines)
- LayerPanel.js (1,576 lines)
- LayersEditor.js (1,265 lines)
- All UI components
- All controller files

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

Phase 1 (High Impact):
P1.1 Global Export Cleanup:   ░░░░░░░░░░░░░░░░░░░░ 0% (54 exports)
P1.2 Integration Tests:       ░░░░░░░░░░░░░░░░░░░░ 0% (0/10 tests)
P1.3 PHP Logging:             ████████████████████ 100% ✓

Phase 2 (Refactoring):
P2.1 ES6 Class Migration:     ██░░░░░░░░░░░░░░░░░░ 10% (ErrorHandler converted)
P2.2 Split LayerRenderer:     ███░░░░░░░░░░░░░░░░░ 15% (ShadowRenderer extracted)
P2.3 CanvasManager Extraction: █████████░░░░░░░░░░░ 45% (9/~15 controllers)

Phase 3 (Modernization):
P3.1 Complete ES6 Migration:  █░░░░░░░░░░░░░░░░░░░ 5%
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

### Phase 1 Complete When:
- [ ] Direct `window.X` exports = 0 (currently 54)
- [ ] Integration tests ≥ 10
- [x] All PHP logging uses injected logger ✓

### Phase 2 Complete When:
- [ ] ES6 classes ≥ 50% of methods
- [ ] LayerRenderer.js split into ≤ 300-line files (15% - ShadowRenderer done)
- [ ] CanvasManager < 500 lines

### Project "Healthy" When:
- [ ] 0 files > 1,000 lines (except entry points)
- [ ] ES6 classes throughout
- [ ] 0 direct global exports
- [ ] 0 prototype methods
- [ ] TypeScript definitions complete

---

## Estimated Timeline

| Phase | Duration | Start After |
|-------|----------|-------------|
| Phase 0 | 1 week | Immediately |
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

1. **Delete dead PHP code** (P0.1) - 5 minutes
2. **Add catch block logging** (P0.2) - 15 minutes
3. **Delete empty skipped test** (P0.4) - 2 minutes
4. **Create GitHub issue for P1.1** - tracking
5. **Run `npm run test:js -- --coverage`** - verify baseline

---

## Verification Commands

```bash
# Run all tests
npm run test:js -- --coverage

# Check for remaining direct global exports
grep -rE "window\.[A-Z][a-zA-Z]+ =" resources --include="*.js" | grep -v "window\.Layers" | wc -l

# Count prototype vs class methods
echo "Prototypes: $(grep -r "\.prototype\." resources --include="*.js" | wc -l)"
echo "Classes: $(grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l)"

# Find god classes
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | sort -rn | head -10

# Check for empty catch blocks
grep -rE "catch.*\{\s*\}" resources --include="*.js"
```

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*
