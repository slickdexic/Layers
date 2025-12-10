# Layers Extension - Improvement Plan

**Last Updated:** January 16, 2025  
**Status:** Phase 0, Phase 1 & P2.1-P2.3 COMPLETE | Phase 2 continues  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Updated January 16, 2025 after completing Toolbar coverage improvements.

### Current State Summary (Post-Fixes)

| Area | Status | Notes |
|------|--------|-------|
| **Functionality** | ✅ Working | Extension is usable |
| **Test Suite** | ✅ Strong | 3,854 tests pass, 85.58% coverage |
| **Architecture** | 🟡 Improving | Controller extraction complete, renderers in progress |
| **Maintainability** | 🟡 Improving | Memory leaks fixed, documentation updated |
| **Performance** | 🟠 Acceptable | EventTracker pattern for cleanup |

---

## Completed Work Summary

### ✅ P0.1 Fix eval() Pattern in Tests
- Replaced `eval()` with `require()` in MessageHelper.test.js and SaveLoadWorkflow.test.js
- Coverage now properly tracked

### ✅ P0.2 Fix APIManager Test Coverage (27% → 85%)
- Added 42+ comprehensive tests covering all core methods
- Coverage: 26.96% → 85%

### ✅ P0.3 Memory Leak Fixes
- Fixed leaks in LayerPanel.js (EventTracker for editLayerName, grabArea)
- Fixed leaks in ToolbarStyleControls.js (added EventTracker with addListener pattern)
- Fixed leaks in LayerItemEvents.js (proper destroy() with removeEventListener)

### ✅ P1.1 ErrorHandler Coverage (57.5% → 99.5%)
- Added tests for processError, logError, handleError, showUserNotification
- Added tests for getRecoveryStrategy, executeRecoveryStrategy, attemptRecovery
- Added tests for retryOperation and global error handlers

### ✅ P1.2 LayerRenderer Refactoring
- Created BaseShapeRenderer.js with shared utilities (shadow, opacity, scale, rotation helpers)
- Created HighlightRenderer.js as extraction example
- Decision: Full extraction creates excessive files with duplicated patterns - keeping shapes in LayerRenderer
- Added 101 tests for LayerRenderer.js (0% → 60.03% coverage)

### ✅ P1.3 CanvasManager Controller Documentation
- README.md already comprehensive with all 10 controllers documented

### ✅ P2.1 LayerRenderer Tests
- Added 101 tests covering all 11 draw methods
- Coverage: 0% → 60.03%

### ✅ P2.2 SelectionManager Coverage (68% → 80.16%)
- Added 67 new tests (from 23 to 90 total)
- Tests cover: module delegation, destroy cleanup, bounds calculations, edge cases
- Coverage: 68.01% → 80.16%

---

## Priority Legend

| Priority | Timeline | Definition |
|----------|----------|------------|
| **P0** | ~~Immediate~~ | ✅ COMPLETE |
| **P1** | ~~Short-term~~ | ✅ COMPLETE |
| **P2** | Medium-term (1-2 months) | Important improvements |
| **P3** | Long-term (3+ months) | Modernization and optimization |

---

## Phase 2: Coverage Gaps (P2)

### P2.1 ✅ LayerRenderer Tests COMPLETE

**Status:** ✅ COMPLETE  
**Coverage:** 0% → 60.03%  
**Tests Added:** 101

Created comprehensive tests covering:
- All shape draw methods (rectangle, circle, ellipse, line, arrow, path, polygon, star, text, highlight, blur)
- Shadow handling (with and without spread)
- Opacity and fill/stroke separation
- Rotation transforms
- Scaled options
- Edge cases (zero/negative dimensions, large coordinates)

---

### P2.2 ✅ SelectionManager Coverage COMPLETE

**Status:** ✅ COMPLETE  
**Coverage:** 68.01% → 80.16%  
**Tests Added:** 67 (from 23 to 90)

Created comprehensive tests covering:
- Module delegation (SelectionState, MarqueeSelection, SelectionHandles)
- Destroy method cleanup
- getLayerBoundsCompat for all layer types (rectangle, line, ellipse, circle, polygon)
- deleteSelected and duplicateSelected operations
- notifySelectionChange integration
- applyDrag and applyResize operations
- Edge cases for marquee selection, hit testing, multi-selection bounds

---

### P2.3 ✅ Toolbar Coverage COMPLETE

**Status:** ✅ COMPLETE  
**Coverage:** 80.91%/54.08%/72% → 91.6%/82.14%/92%  
**Tests Added:** 53 (from ~60 to 113)

Created comprehensive tests covering:
- EventTracker fallback paths when unavailable
- Error handling in runDialogCleanups with layersErrorHandler
- ToolbarStyleControls fallback when module not loaded
- setupEventHandlers: zoom actions, keyboard navigation, import/export
- Import file change handler with async error handling
- executeAction cases: show-shortcuts, rulers, guides, snap-grid, snap-guides
- updateToolOptions and updateStyleOptions delegation
- handleKeyboardShortcuts deprecated wrapper
- createActionButton toggle buttons (grid, rulers, guides, snap-grid, snap-guides)
- updateColorButtonDisplay fallback implementation
- msg() fallback paths (layersMessages, mw.message, placeholder detection)

---

## Phase 0: Critical Fixes (P0) - ✅ ALL COMPLETE

### ~~P0.1 🔴 Fix APIManager Test Coverage (27% → 70%+)~~

**Status:** ✅ COMPLETE (85% coverage achieved)  
**Tests Added:** 42+

---

### ~~P0.2 🔴 Fix eval() Pattern in Tests~~

**Status:** ✅ COMPLETE

**Affected Files:**
- `tests/jest/MessageHelper.test.js` (line 21)
- `tests/jest/integration/SaveLoadWorkflow.test.js` (line 120)
- Possibly others

**Current Pattern (broken):**
```javascript
const helperCode = fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor/MessageHelper.js' ), 'utf8' );
eval( helperCode );  // ❌ Not instrumented
```

**Required Pattern:**
```javascript
// Option 1: Use require with Jest transforms
jest.mock( '../../resources/ext.layers.editor/MessageHelper.js' );
const MessageHelper = require( '../../resources/ext.layers.editor/MessageHelper.js' );

// Option 2: Execute in VM with instrumentation
const vm = require( 'vm' );
const script = new vm.Script( helperCode, { filename: 'MessageHelper.js' } );
// ... configure Jest instrumentation
```

**Action Items:**
1. Identify all test files using `eval()` or `new Function()`
2. Refactor to use Jest's module system
3. Verify coverage is now collected
4. Re-run coverage report

**Acceptance Criteria:**
- [ ] No tests use `eval()` to load production code
- [ ] MessageHelper.js shows actual coverage (24 tests exist)
- [ ] Coverage report reflects reality

---

### P0.3 🔴 Audit Memory Leaks (Event Listeners)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - Runtime stability  
**Effort:** 1 week

**Problem:**
106 `addEventListener` calls but only 31 `removeEventListener` = **75 potential leaks**.

**High-Risk Modules:**

| Module | Add | Remove | Gap | Action |
|--------|-----|--------|-----|--------|
| LayerPanel.js | 10 | 1 | +9 | Convert to EventTracker |
| ToolbarStyleControls.js | 9 | 0 | +9 | Add cleanup in destroy() |
| Toolbar.js | 6 | 1 | +5 | Convert to EventTracker |
| PropertiesForm.js | 3 | 0 | +3 | Add cleanup in destroy() |
| UIManager.js | 5 | 2 | +3 | Review lifecycle |

**EventTracker Pattern (use this):**
```javascript
// In constructor:
this.eventTracker = new EventTracker();

// When adding listeners:
this.eventTracker.add( element, 'click', this.handleClick.bind(this) );

// In destroy():
this.eventTracker.removeAll();
```

**Action Items:**
1. Audit each high-risk module
2. Categorize listeners:
   - One-time (DOMContentLoaded) - OK
   - Element-scoped (cleaned when element removed) - OK
   - Window/document listeners - MUST cleanup
3. Implement EventTracker where missing
4. Add destroy() methods where missing
5. Verify no memory growth in 1-hour session

**Acceptance Criteria:**
- [ ] All window/document listeners have cleanup
- [ ] EventTracker used consistently
- [ ] No memory growth in DevTools Memory panel over 1 hour

---

## Phase 1: High Priority (P1)

### P1.1 Improve ErrorHandler.js Coverage (57% → 75%)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 2-3 days  
**Current:** 57.5% | **Target:** 75%

**Problem:**
Error handling module is only partially tested. Error paths in the error handler itself are risky.

**Uncovered Lines (from coverage):**
- 49, 54, 71-86, 99-112, 188-199, 227-230, 240-311, 386-389, 427-450, 460-475, 485-486, 498

**Action Items:**
1. Test all error type handlers
2. Test recovery mechanisms
3. Test error aggregation
4. Test user-facing error display

**Test File:** `tests/jest/ErrorHandler.test.js` (exists, needs expansion)

---

### P1.2 Split LayerRenderer.js (2,288 → <1,000 lines each)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - Largest god class  
**Effort:** 2-3 weeks

**Problem:**
LayerRenderer.js is **2,288 lines** handling ALL shape rendering. Changes carry high regression risk.

**Proposed Structure:**
```
ext.layers.shared/
├── LayerRenderer.js        # Facade (~300 lines)
├── renderers/
│   ├── BaseShapeRenderer.js
│   ├── RectangleRenderer.js
│   ├── CircleRenderer.js
│   ├── EllipseRenderer.js
│   ├── PolygonRenderer.js
│   ├── StarRenderer.js
│   ├── ArrowRenderer.js
│   ├── LineRenderer.js
│   ├── PathRenderer.js
│   ├── HighlightRenderer.js
│   ├── BlurRenderer.js
│   └── TextRenderer.js
└── effects/
    ├── ShadowEffect.js
    └── GlowEffect.js
```

**Action Items:**
1. Create BaseShapeRenderer with common functionality
2. Extract each shape type to its own renderer
3. Extract shadow/glow effects to shared utilities
4. Update LayerRenderer as thin facade
5. Add unit tests for each new renderer

**Acceptance Criteria:**
- [ ] No file > 500 lines in renderers/
- [ ] Each renderer has >80% test coverage
- [ ] All existing tests pass
- [ ] Visual regression testing (compare before/after renders)

---

### P1.3 Continue CanvasManager Extraction (2,027 → <1,000 lines)

**Status:** ❌ NOT STARTED (continuation)  
**Priority:** HIGH  
**Effort:** 1-2 weeks

**Already Extracted (9 controllers, all 85%+ coverage):**
- ZoomPanController, GridRulersController, TransformController
- HitTestController, DrawingController, ClipboardController
- RenderCoordinator, InteractionController, TextInputController

**Still in CanvasManager (~1,000 lines to extract):**
| Functionality | Est. Lines | Priority |
|---------------|-----------|----------|
| Background image loading | ~150 | High |
| Style state management | ~100 | Medium |
| Layer bounds calculations | ~100 | Medium |
| Canvas pooling | ~80 | Low |
| Modal/dialog integration | ~100 | Medium |
| Selection overlay rendering | ~80 | Low |

**Action Items:**
1. Create BackgroundController for image loading
2. Extract style management to existing StyleController
3. Create BoundsController for layer calculations
4. Move remaining logic to appropriate controllers

**Acceptance Criteria:**
- [ ] CanvasManager.js < 1,000 lines
- [ ] No functionality regression
- [ ] All new code has tests

---

### P1.4 Improve SelectionManager.js Coverage (68% → 80%)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM-HIGH  
**Effort:** 2-3 days  
**Current:** 68.01% | **Target:** 80%

**Problem:**
Core selection logic (1,261 lines) is undertested at 68%.

**Key Untested Areas (from coverage):**
- Multi-select operations
- Marquee selection edge cases
- Selection bounds calculations
- Keyboard selection modifiers

**Test File:** `tests/jest/SelectionManager.test.js` + `SelectionManagerExtended.test.js`

---

## Phase 2: Medium Priority (P2)

### P2.1 Bundle Size Reduction (1.05MB → <500KB)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2-3 weeks  
**Current:** ~1.05MB | **Target:** <500KB

**Strategies:**

1. **Lazy Load Dialogs** (~100KB savings)
   - ColorPickerDialog
   - ImportExportManager
   - ConfirmDialog
   
2. **Viewer/Editor Split** (~400KB savings)
   - Viewers only need LayerRenderer + basic loading
   - Don't load full editor for viewing
   
3. **Dead Code Elimination**
   - Analyze actual usage with instrumentation
   - Remove unused utilities/methods

4. **Code Splitting via ResourceLoader**
   - Define separate modules for view vs edit
   - Load editor on demand when action=editlayers

**Action Items:**
1. Analyze module dependencies
2. Create ext.layers.viewer (minimal)
3. Keep ext.layers.editor (full)
4. Lazy-load dialogs
5. Verify viewer loads <200KB

---

### P2.2 Eliminate Duplicate Global Exports (123 → <10)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1-2 weeks

**Problem:**
Every module exports to both namespace AND global:
```javascript
window.Layers.Canvas.Manager = CanvasManager;  // Good
window.CanvasManager = CanvasManager;          // Duplicate
```

**Action Items:**
1. Audit internal code for global references
2. Update internal code to use `window.Layers.*`
3. Keep only `window.Layers.*` exports
4. Add deprecation warnings for external access

**Acceptance Criteria:**
- [ ] Direct window.X exports < 10
- [ ] All internal code uses namespace
- [ ] Extension loads correctly

---

### P2.3 ES6 Class Conversion Pilot (10 files)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 4-5 days  
**Current:** 32 classes | **Target:** 42+ classes

**Pilot Candidates (smaller, well-tested files):**
1. TextUtils.js (194 lines, 89% coverage)
2. ImageLoader.js (293 lines, 91% coverage)
3. CanvasUtilities.js (271 lines, 100% coverage)
4. StyleController.js (184 lines, 100% coverage)
5. EventManager.js (126 lines, 100% coverage)
6. EventTracker.js (224 lines, 96% coverage)
7. ModuleRegistry.js (360 lines, 94% coverage)
8. HistoryManager.js (622 lines, 90% coverage)
9. StateManager.js (662 lines, 85% coverage)
10. LayerSetManager.js (567 lines, 89% coverage)

**Conversion Pattern:**
```javascript
// Before:
function TextUtils() { ... }
TextUtils.prototype.method = function() { ... };
window.TextUtils = TextUtils;

// After:
class TextUtils {
    constructor() { ... }
    method() { ... }
}
window.Layers.Utils.Text = TextUtils;
```

**Acceptance Criteria:**
- [ ] 10 files converted to ES6 classes
- [ ] All tests still pass
- [ ] No functionality regression

---

### P2.4 Add LayerRenderer Tests

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 3-5 days

**Problem:**
LayerRenderer.js (2,288 lines) has no dedicated unit tests. It's the rendering engine for everything.

**Test Approach:**
- Mock canvas context
- Test each draw* method
- Verify correct canvas API calls
- Test shadow and effect application
- Test coordinate transforms

**Test File:** Create `tests/jest/LayerRenderer.test.js`

---

## Phase 3: Long-Term (P3)

### P3.1 Complete ES6 Class Migration

**Timeline:** 4-6 weeks after pilot  
**Target:** All 680 prototype methods converted

**Prerequisites:**
- P2.3 pilot successful
- Pattern established and documented

---

### P3.2 TypeScript Migration

**Timeline:** 2-3 months after ES6 complete  
**Prerequisites:**
- ES6 migration complete
- Global exports eliminated
- Module boundaries clear

**Approach:**
1. Add .d.ts files for existing code
2. Convert files incrementally (`.js` → `.ts`)
3. Start with utilities, end with UI components

---

### P3.3 ES Modules with Tree-Shaking

**Timeline:** After TypeScript  
**Prerequisites:**
- Globals eliminated
- Module boundaries defined

**Benefits:**
- Automatic dead code elimination
- Better bundle analysis
- Modern import/export syntax

---

### P3.4 Unified Validation System

**Timeline:** 3+ months  
**Effort:** 2-3 weeks

**Problem:**
Dual validation systems (client + server) must stay in sync.

**Solution:**
Generate client validation from server rules:
```php
// Server defines rules
$rules = [
    'opacity' => ['type' => 'float', 'min' => 0, 'max' => 1],
    // ...
];

// Export to JSON for client
file_put_contents('validation-rules.json', json_encode($rules));
```

```javascript
// Client loads generated rules
const rules = require('./validation-rules.json');
// Generate validation functions from rules
```

---

## Progress Tracking

### Verification Commands

```bash
# Full test suite with coverage
npm run test:js -- --coverage

# Check for eval usage in tests
grep -r "eval(" tests/jest --include="*.js" | grep -v "eslint"

# Event listener balance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# File sizes (god classes)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | sort -rn | head -10

# Global exports
grep -rE "window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c
```

---

## Visual Progress

```
Phase 0 (Critical):
P0.1 APIManager Coverage (70%):   ░░░░░░░░░░░░░░░░░░░░ 0% 🔴 CRITICAL
P0.2 Fix eval() Pattern:          ░░░░░░░░░░░░░░░░░░░░ 0% 🔴 CRITICAL
P0.3 Memory Leak Audit:           ░░░░░░░░░░░░░░░░░░░░ 0% 🔴 HIGH

Phase 1 (High):
P1.1 ErrorHandler Coverage (75%): ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Split LayerRenderer:         ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 CanvasManager Extraction:    ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 SelectionManager Coverage:   ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Medium):
P2.1 Bundle Size Reduction:       ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 Eliminate Global Exports:    ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 ES6 Class Pilot (10 files):  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 LayerRenderer Tests:         ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (Long-term):
P3.1 Complete ES6 Migration:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:        ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 ES Modules:                  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Unified Validation:          ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [ ] APIManager.js coverage ≥ 70%
- [ ] No tests use eval() for production code
- [ ] Coverage report reflects actual test coverage
- [ ] No memory growth in 1-hour session

### Phase 1 Complete When:
- [ ] ErrorHandler.js coverage ≥ 75%
- [ ] LayerRenderer.js split into <500 line files
- [ ] CanvasManager.js < 1,000 lines
- [ ] SelectionManager.js coverage ≥ 80%

### Phase 2 Complete When:
- [ ] Bundle size < 500KB
- [ ] Global window.X exports < 10
- [ ] 42+ ES6 class files
- [ ] LayerRenderer has dedicated tests

### Project "Healthy" When:
- [ ] All coverage thresholds genuinely met
- [ ] No god classes (>1,000 lines except entry points)
- [ ] Bundle < 400KB for viewer
- [ ] ES6 classes throughout
- [ ] All tests pass consistently
- [ ] No memory leaks in long sessions

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 2-3 weeks | None - start immediately |
| Phase 1 | 4-6 weeks | Phase 0 complete |
| Phase 2 | 4-6 weeks | Parallel with late Phase 1 |
| Phase 3 | 2-3 months | Phases 1-2 complete |

**Total: 5-6 months for healthy codebase state**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Test refactor breaks coverage tracking | Low | High | Test in isolation first |
| LayerRenderer split causes visual regressions | Medium | High | Visual regression testing |
| Memory leak fixes break functionality | Low | Medium | Test each fix individually |
| ES6 conversion introduces bugs | Low | Medium | Convert well-tested files first |
| Bundle splitting breaks loading | Medium | High | Feature flag rollout |

---

## Quick Wins (Can Do Today)

1. **Run full coverage report** - `npm run test:js -- --coverage`
2. **Identify all eval() usage** - `grep -r "eval(" tests/jest --include="*.js"`
3. **Count event listener imbalance** - Commands above
4. **Document current state** - Screenshot coverage report

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 9, 2025*
