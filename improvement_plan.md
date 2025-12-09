# Layers Extension - Improvement Plan

**Last Updated:** December 8, 2025 (Revised with verified metrics)  
**Status:** Active development with significant technical debt  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. All metrics have been verified against the actual codebase on December 8, 2025.

### Critical Insight

The codebase has **strong test coverage** (2,647 tests, 90% statement coverage) but **severe structural problems** that make it unmaintainable. The priority is reducing complexity and fixing safety issues before adding features.

---

## Verified Baseline Metrics (December 8, 2025)

### JavaScript

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total bundle size | **943KB** | <400KB | 543KB over |
| Files >1,000 lines | **8** | 0 | 8 god classes |
| Files >500 lines | **23** | 5 | 18 need splitting |
| Global window.X exports | **103** | 0 | 103 to remove |
| Prototype methods | **671** | 0 | ES6 migration needed |
| ES6 classes | **23** | 671+ | 3.4% adoption |
| addEventListener imbalance | **75** | 0 | Memory leak risk |
| JSON clone anti-pattern | **21** | 0 | Use structuredClone |
| ESLint errors | **2** | 0 | Build broken |
| `const self = this` | **1** | 0 | Nearly fixed |

### Tests

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 2,647 | - | ✅ Good |
| Jest test files | 63 | - | ✅ Good |
| Statement coverage | 89.66% | 95% | 5.34% gap |
| Branch coverage | **75.06%** | 90% | 14.94% gap |
| LayersValidator.js tests | **0** | Dedicated file | 🔴 Critical |
| LayersDatabaseTest.php | **Empty (0 lines)** | Full coverage | 🔴 Critical |
| E2E test files | **2** | 10+ | 🔴 Minimal |
| PHPUnit test files | 17 | - | 🟢 Decent |

### PHP

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| json_decode with error handling | **10 of 10** | 10/10 | ✅ Fixed |
| CSP unsafe-eval/unsafe-inline | Yes | Investigate | 🟠 Security risk |

---

## Priority Legend

| Priority | Timeline | Definition |
|----------|----------|------------|
| **P0** | Immediate | Blocks development or causes runtime issues |
| **P1** | 2-4 weeks | Significantly impacts maintainability |
| **P2** | 1-2 months | Important improvements |
| **P3** | 3+ months | Long-term modernization |

---

## Phase 0: Critical Blockers (P0)

### P0.1 Fix ESLint Build Errors

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL - BUILD BROKEN  
**Effort:** 30 minutes  
**Risk:** LOW

**Problem:**
ESLint fails with 2 errors preventing clean builds:

```
LayerRenderer.js
  301:11  error  'scaleX' is assigned a value but never used  no-unused-vars
  302:11  error  'scaleY' is assigned a value but never used  no-unused-vars
```

**Solution:**
Either use the variables or prefix with underscore to indicate intentional unused:
```javascript
// Option 1: Remove if not needed
// Option 2: Prefix with underscore
const _scaleX = ...;  // Intentionally unused
```

**Acceptance Criteria:**
- [ ] `npm test` passes without errors
- [ ] CI/CD builds succeed

---

### P0.2 Fix Memory Leaks (Event Listeners)

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 1 week  
**Risk:** HIGH - Runtime issues in long sessions

**Problem:**
The codebase has 104 `addEventListener` calls but only 29 `removeEventListener` calls. This 75-event imbalance causes memory leaks in long editor sessions.

**Solution:**
1. Audit all files for addEventListener without cleanup
2. Use existing `EventTracker.js` consistently
3. Add cleanup in destroy/dispose methods

**Files to audit (highest risk):**
- `ui/PropertiesForm.js` - Form inputs with no cleanup
- `UIManager.js` - UI listeners without removal
- `ToolbarStyleControls.js` - Multiple listeners
- `CanvasManager.js` - Canvas event handlers
- `Toolbar.js` - Button event listeners
- `LayerPanel.js` - List item listeners

**Acceptance Criteria:**
- [ ] All addEventListener calls have matching removeEventListener
- [ ] EventTracker used for all long-lived listeners
- [ ] No memory growth in 1-hour editor session (Chrome DevTools)
- [ ] All 2,647 tests still pass

---

### P0.3 Add LayersValidator.js Test Coverage

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 3 days  
**Risk:** HIGH - Security-critical code untested

**Problem:**
LayersValidator.js (954 lines) is the client-side validation layer and has **no dedicated test file**. Validation bugs can lead to security issues or data corruption.

**Solution:**
Create `tests/jest/LayersValidator.test.js` covering:
- All layer types validation (11 types)
- Coordinate bounds checking
- Text/color sanitization
- Points array validation
- Font family validation
- Blend mode validation
- Edge cases (null, undefined, extreme values)

**Acceptance Criteria:**
- [ ] `tests/jest/LayersValidator.test.js` exists with 200+ tests
- [ ] 95%+ coverage on LayersValidator.js
- [ ] All validation rules have positive and negative tests
- [ ] Tests mirror ServerSideLayerValidator coverage patterns

---

### P0.4 Fill LayersDatabaseTest.php

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 2 days  
**Risk:** MEDIUM - Database operations untested

**Problem:**
`tests/phpunit/unit/Database/LayersDatabaseTest.php` is **completely empty (0 lines)**. The database layer is critical for data persistence.

**Solution:**
Add tests for:
- CRUD operations (create, read, update, delete layer sets)
- JSON validation and sanitization
- Named set limits enforcement
- Revision pruning logic
- Error handling paths
- Transaction retry logic

**Acceptance Criteria:**
- [ ] LayersDatabaseTest.php has 50+ test methods
- [ ] All public methods have @covers annotations
- [ ] Edge cases tested (max limits, invalid data)
- [ ] `npm run test:phpunit` passes

---

### P0.5 Remove Last `const self = this`

**Status:** ❌ NOT STARTED  
**Priority:** LOW  
**Effort:** 30 minutes  
**Risk:** LOW

**Problem:**
One remaining instance at CanvasManager.js line 1737.

**Solution:**
Convert callback to arrow function or use `.bind(this)`.

**Acceptance Criteria:**
- [ ] `grep -r "const self = this" resources` returns 0 results
- [ ] All tests pass

---

## Phase 1: High Priority (P1)

### P1.1 Split CanvasManager.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 2-3 weeks  
**Risk:** HIGH - Many dependencies, core file

**Problem:**
CanvasManager.js at 2,109 lines with 112 prototype methods is unmaintainable. It handles 15+ distinct concerns despite previous controller extractions.

**Current state:**
```
CanvasManager (2,109 lines, 112 methods)
├── Still handles: initialization, style, viewport, layer ops, events, 
│                  text input modal, marquee selection, zoom animation...
└── Delegates to: ZoomPan, Grid, Transform, HitTest, Drawing, 
                  Clipboard, Interaction, RenderCoordinator
```

**Target architecture:**
```
CanvasManager (<500 lines) - True thin facade
├── TextInputManager.js - Modal text input handling (~150 lines)
├── MarqueeSelectionManager.js - Marquee selection logic (~100 lines)
├── ZoomAnimator.js - Smooth zoom animations (~100 lines)
├── LayerOperationsManager.js - Add, remove, duplicate, reorder (~200 lines)
├── ViewportManager.js - Coordinate transforms, bounds (~150 lines)
├── StyleStateManager.js - Current style, style application (~150 lines)
└── CanvasSetupManager.js - Initialization, canvas creation (~100 lines)
```

**Extraction plan by method count:**

| New Module | Methods to Extract | Est. Lines |
|------------|-------------------|------------|
| TextInputManager.js | createTextInputModal, finishTextInput, hideTextInputModal | ~150 |
| MarqueeSelectionManager.js | startMarquee*, updateMarquee*, finishMarquee*, getMarqueeRect, getLayersInRect | ~150 |
| ZoomAnimator.js | smoothZoomTo, animateZoom, zoomToFitLayers | ~100 |
| LayerOperationsManager.js | selectLayer, selectAll, deselectAll, handleLayerSelection | ~200 |
| ViewportManager.js | getLayerBounds, _getRawLayerBounds, _computeAxisAlignedBounds, rectsIntersect, _rectToAabb | ~150 |
| EffectsManager.js | applyLayerEffects, drawLayerWithEffects, withLocalAlpha | ~100 |
| CanvasStateManager.js | saveState, updateUndoRedoButtons, undo, redo, deepCloneLayers | ~150 |

**Acceptance Criteria:**
- [ ] CanvasManager.js < 500 lines
- [ ] Only delegation calls, no business logic
- [ ] Each new module < 300 lines
- [ ] All 2,647 Jest tests pass
- [ ] No ESLint errors
- [ ] Performance unchanged (benchmark before/after)

---

### P1.2 Eliminate Duplicate Global Exports

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3-5 days  
**Risk:** MEDIUM - Load order dependencies

**Problem:**
Every file exports to both `window.Layers.*` AND `window.ClassName`. 103 direct `window.X` assignments.

**Current pattern (every file):**
```javascript
window.Layers.Core.CanvasManager = CanvasManager;
window.CanvasManager = CanvasManager;  // Duplicate - 103 of these!
```

**Target pattern:**
```javascript
window.Layers.Core.CanvasManager = CanvasManager;
// Remove direct window.X export
```

**Migration steps:**
1. Create inventory of all 103 window.X exports
2. Audit all internal usages of `window.ClassName`
3. Update to use `window.Layers.Category.ClassName`
4. Remove direct window exports (keep only for true public API if needed)
5. Update tests to use namespace

**Acceptance Criteria:**
- [ ] `grep -rE "^\s*window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l` returns <10
- [ ] All code uses `window.Layers.*` namespace
- [ ] All tests pass
- [ ] Extension loads correctly in MediaWiki

---

### P1.3 Split LayerPanel.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 4-5 days

**Problem:** 1,464 lines handling UI, state, events, and rendering.

**Extraction plan:**

| New Module | Responsibility | Est. Lines |
|------------|---------------|------------|
| LayerListRenderer.js | DOM creation for layer list items | ~300 |
| LayerItemEvents.js | Click, drag, context menu handlers | ~250 |
| LayerContextMenu.js | Right-click context menu | ~150 |
| LayerDragDrop.js | Drag-and-drop reordering | ~150 |

**Acceptance Criteria:**
- [ ] LayerPanel.js < 600 lines
- [ ] Each extracted module < 400 lines
- [ ] All tests pass
- [ ] Drag-drop reordering still works
- [ ] Context menu still works

---

### P1.4 Split SelectionManager.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3 days

**Problem:** 1,026 lines mixing selection state with selection UI.

**Extraction plan:**

| New Module | Responsibility | Est. Lines |
|------------|---------------|------------|
| SelectionState.js | Selection data management, getters/setters | ~200 |
| SelectionRenderer.js | Handle rendering, bounds display | ~250 |
| MultiSelectManager.js | Multi-layer selection logic, group operations | ~200 |

**Acceptance Criteria:**
- [ ] SelectionManager.js < 500 lines
- [ ] Selection functionality unchanged
- [ ] Multi-select still works
- [ ] All tests pass

---

### P1.5 Split ToolManager.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3 days

**Problem:** 1,027 lines handling all tool logic.

**Extraction plan:**

| New Module | Responsibility | Est. Lines |
|------------|---------------|------------|
| ToolRegistry.js | Tool registration, lookup, metadata | ~150 |
| ToolStateManager.js | Active tool, tool switching, cursor | ~200 |
| ToolInputHandler.js | Mouse/keyboard input routing to tools | ~200 |

**Acceptance Criteria:**
- [ ] ToolManager.js < 500 lines
- [ ] Tool switching still works
- [ ] All tools functional
- [ ] All tests pass

---

### P1.6 ES6 Class Conversion Pilot (15 More Files)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 4-5 days

**Problem:** Only 23 of 54 files use ES6 classes (43% by file count, but only 3.4% by method count).

**Pilot candidates (mid-size, fewer dependencies):**
1. TextUtils.js (~100 lines)
2. IconFactory.js (~200 lines)
3. ImageLoader.js (~150 lines)
4. MessageHelper.js (~100 lines)
5. CanvasUtilities.js (~200 lines)
6. StyleController.js (~200 lines)
7. ModuleRegistry.js (~200 lines)
8. ErrorHandler.js (~571 lines)
9. LayerSetManager.js (~570 lines)
10. ColorPickerDialog.js (~563 lines)
11. InteractionController.js (~498 lines)
12. UrlParser.js (~478 lines)
13. CanvasEvents.js (~573 lines)
14. HistoryManager.js (~625 lines)
15. TransformationEngine.js (~642 lines)

**Conversion pattern:**
```javascript
// Before
function HistoryManager( editor ) {
    this.editor = editor;
}
HistoryManager.prototype.undo = function () { ... };

// After
class HistoryManager {
    constructor( editor ) {
        this.editor = editor;
    }
    undo() { ... }
}
```

**Acceptance Criteria:**
- [ ] 15 more files converted to ES6 class syntax
- [ ] Total ES6 classes: 38+
- [ ] All tests pass
- [ ] Pattern documented for remaining files

---

## Phase 2: Medium Priority (P2)

### P2.1 Bundle Size Reduction

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2-3 weeks  

**Current:** 943KB unminified (~470KB minified)  
**Target:** <500KB unminified (~250KB minified)

**Strategies:**
1. **Lazy load ColorPickerDialog** (~563 lines) - Only needed when user opens color picker
2. **Lazy load ImportExportManager** (~400 lines) - Only needed for import/export
3. **Separate viewer bundle from editor bundle** - Viewers don't need editing tools
4. **Dead code elimination** - Analyze coverage reports for unused code
5. **Replace JSON.parse(JSON.stringify())** - 21 instances with structuredClone

**Acceptance Criteria:**
- [ ] Bundle < 500KB unminified
- [ ] Viewer loads without editor code
- [ ] All functionality preserved
- [ ] Load time reduced by 30%+

---

### P2.2 E2E Test Infrastructure

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1-2 weeks

**Problem:** Only 2 E2E test files, require live MediaWiki server.

**Solution:**
1. Create mock API layer for E2E tests
2. Add Playwright tests for critical workflows
3. Enable E2E tests in CI pipeline

**Workflows to test:**
- Create new layer set
- Add each layer type (11 types)
- Save and load layer set
- Named sets management
- Revision history navigation
- Keyboard shortcuts
- Undo/redo operations
- Copy/paste operations

**Acceptance Criteria:**
- [ ] Mock API enables offline E2E testing
- [ ] 10+ E2E test files covering critical paths
- [ ] E2E tests run in CI

---

### P2.3 Replace JSON Clone Pattern

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 4 hours

**Problem:** 21 instances of inefficient `JSON.parse(JSON.stringify())` cloning.

**Solution:**
```javascript
// Create utility in utilities/DeepClone.js
function deepClone( obj ) {
    if ( typeof structuredClone === 'function' ) {
        return structuredClone( obj );
    }
    // Fallback for older browsers
    return JSON.parse( JSON.stringify( obj ) );
}

// Export
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.Utils.deepClone = deepClone;
```

**Files to update (search results):**
- StateManager.js
- SelectionManager.js  
- LayersEditor.js
- HistoryManager.js
- CanvasManager.js
- TransformController.js
- InteractionController.js
- ClipboardController.js

**Acceptance Criteria:**
- [ ] deepClone utility created and documented
- [ ] All JSON clone patterns replaced
- [ ] Tests verify clone correctness
- [ ] Performance improved (benchmark)

---

### P2.4 Investigate CSP Restrictions

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1 week (investigation)

**Problem:** CSP allows `unsafe-eval` and `unsafe-inline`, weakening XSS protection.

**Investigation tasks:**
1. Identify what requires unsafe-eval (OOUI? MediaWiki core? Layers code?)
2. Identify inline script sources
3. Test with stricter CSP to find failures
4. Determine if nonce-based CSP is feasible
5. Document findings and recommendations

**Acceptance Criteria:**
- [ ] Document listing all unsafe-eval/unsafe-inline dependencies
- [ ] Recommendation: tighten or document why not possible
- [ ] If possible, implement stricter CSP

---

### P2.5 Improve Branch Coverage

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1-2 weeks

**Problem:** Branch coverage at 75.06% means 1,497 code branches never tested.

**Solution:**
1. Run Jest with coverage report
2. Identify files with lowest branch coverage
3. Add tests for uncovered branches (error paths, edge cases)

**Focus areas (likely low coverage):**
- Error handling paths
- Edge cases in validation
- Rarely-used features
- Platform-specific code

**Acceptance Criteria:**
- [ ] Branch coverage > 85%
- [ ] All critical paths covered
- [ ] Error handling tested

---

## Phase 3: Long Term (P3)

### P3.1 Complete ES6 Class Migration

**Target:** All 671 prototype methods converted to ES6 classes  
**Effort:** 4-6 weeks  
**Prerequisites:** P1.6 pilot successful

**Migration order:**
1. Utility classes (low risk)
2. Manager classes (medium risk)
3. Core classes like CanvasManager (high risk, after splitting)

---

### P3.2 TypeScript Migration

**Target:** Type safety across codebase  
**Effort:** 2-3 months  
**Prerequisites:** ES6 migration complete, globals eliminated

**Approach:**
1. Add TypeScript configuration
2. Rename files .js → .ts incrementally
3. Add type annotations
4. Enable strict mode progressively

---

### P3.3 ES Modules

**Target:** Full import/export syntax, tree-shaking  
**Effort:** 1 month  
**Prerequisites:** Globals eliminated, ResourceLoader ES module support verified

**Benefits:**
- Tree-shaking reduces bundle size
- Better IDE support
- Clearer dependency graph
- Modern development experience

---

### P3.4 Validation Rule Generation

**Target:** Generate client validation from server rules  
**Effort:** 2 weeks  
**Benefit:** Eliminates dual maintenance of validation logic

**Approach:**
1. Define validation rules in JSON schema
2. Server reads schema at runtime
3. Build step generates client validator from schema
4. Remove manually-written client validation

---

## Progress Tracking

### Verification Commands

```bash
# Check for ESLint errors
npm test

# God classes remaining
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | awk '$1 > 1000' | wc -l
# Target: 0

# Global exports remaining  
grep -rE "^\s*window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l
# Target: <10

# Prototype methods remaining
grep -r "\.prototype\." resources --include="*.js" | wc -l
# Target: 0

# ES6 classes
grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l
# Target: 50+

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c
# Target: <512000

# Memory leak risk (addEventListener imbalance)
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"
# Target: Add ≈ Remove

# const self = this
grep -r "const self = this" resources --include="*.js" | wc -l
# Target: 0
```

---

## Visual Progress

```
Phase 0 (Critical):
P0.1 Fix ESLint Errors:           ░░░░░░░░░░░░░░░░░░░░ 0%
P0.2 Fix Memory Leaks:            ░░░░░░░░░░░░░░░░░░░░ 0%
P0.3 LayersValidator Tests:       ░░░░░░░░░░░░░░░░░░░░ 0%
P0.4 LayersDatabaseTest.php:      ░░░░░░░░░░░░░░░░░░░░ 0%
P0.5 Remove const self = this:    ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 1 (High):
P1.1 Split CanvasManager:         ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Eliminate Global Exports:    ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 Split LayerPanel:            ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 Split SelectionManager:      ░░░░░░░░░░░░░░░░░░░░ 0%
P1.5 Split ToolManager:           ░░░░░░░░░░░░░░░░░░░░ 0%
P1.6 ES6 Class Pilot (15 files):  ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Medium):
P2.1 Bundle Size Reduction:       ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 E2E Test Infrastructure:     ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 Replace JSON Clone:          ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 CSP Investigation:           ░░░░░░░░░░░░░░░░░░░░ 0%
P2.5 Improve Branch Coverage:     ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (Long-term):
P3.1 Complete ES6 Migration:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:        ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 ES Modules:                  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Validation Generation:       ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [ ] `npm test` passes (0 ESLint errors)
- [ ] No memory leaks in 1-hour session
- [ ] LayersValidator.js has dedicated tests (95%+ coverage)
- [ ] LayersDatabaseTest.php has 50+ tests
- [ ] `const self = this` count = 0

### Phase 1 Complete When:
- [ ] No file > 600 lines (except LayerRenderer - shared engine)
- [ ] Global window.X exports < 10
- [ ] ES6 classes ≥ 40 files
- [ ] All tests pass

### Phase 2 Complete When:
- [ ] Bundle size < 500KB
- [ ] 10+ E2E test files
- [ ] No JSON.parse(JSON.stringify()) for cloning
- [ ] CSP documented/improved
- [ ] Branch coverage > 85%

### Project "Healthy" When:
- [ ] No god classes (>1,000 lines except shared LayerRenderer)
- [ ] Bundle < 400KB
- [ ] 90%+ branch coverage
- [ ] ES6 classes throughout
- [ ] TypeScript types for core modules
- [ ] All tests pass consistently

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 2 weeks | None |
| Phase 1 | 5-7 weeks | Phase 0 complete |
| Phase 2 | 4-6 weeks | Parallel with Phase 1 |
| Phase 3 | 2-3 months | Phases 1-2 complete |

**Total: 5-6 months for healthy codebase state**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CanvasManager split breaks functionality | High | High | Incremental extraction, extensive testing |
| Global removal breaks load order | Medium | High | Careful dependency analysis, staged rollout |
| Memory leak fixes cause regressions | Low | Medium | Test each fix individually |
| ES6 conversion breaks IE11 support | Low | Low | IE11 not supported by MediaWiki 1.44+ |

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 8, 2025*
