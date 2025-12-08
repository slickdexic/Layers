# Layers Extension - Improvement Plan

**Last Updated:** December 8, 2025  
**Status:** RESET - Honest baseline established  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. It was reset on December 8, 2025 to reflect accurately verified metrics after critical review found previous claims did not match measurable reality.

### Key Insight

The codebase has **functional coverage** (2,647 tests) but **structural problems** that make it unmaintainable. The priority is reducing complexity and fixing safety issues, not adding features.

---

## Verified Baseline Metrics (December 8, 2025)

### JavaScript

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total bundle size | 932KB | <400KB | 532KB over |
| Files >1,000 lines | 9 | 0 | 9 god classes |
| Files >500 lines | 18 | 5 | 13 need splitting |
| Global window.X exports | 130 | 0 | 130 to remove |
| Prototype methods | 646 | 0 | ES6 migration needed |
| ES6 classes | 4 | 646+ | 0.6% adoption |
| addEventListener imbalance | 71 | 0 | Memory leak risk |
| JSON clone anti-pattern | 21 | 0 | Use structuredClone |

### Tests

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 2,647 | - | ✅ Good |
| Statement coverage | 89.66% | 95% | 5.34% gap |
| Branch coverage | 75.06% | 90% | 14.94% gap |
| LayersValidator.js tests | 0 | Dedicated file | 🔴 Critical |
| LayersDatabaseTest.php | Empty | Full coverage | 🔴 Critical |
| E2E test files | 2 | 10+ | 🔴 Minimal |

### PHP

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| json_decode without error handling | 6 | 0 | 6 to fix |
| CSP unsafe-eval/unsafe-inline | Yes | Investigate | Security risk |

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

### P0.1 Fix Memory Leaks (Event Listeners)

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 1 week  
**Risk:** HIGH - Runtime issues in long sessions

**Problem:**
The codebase has ~100 `addEventListener` calls but only ~29 `removeEventListener` calls. This 71-event imbalance causes memory leaks in long editor sessions.

**Solution:**
1. Audit all files for addEventListener without cleanup
2. Use existing `EventTracker.js` consistently
3. Add cleanup in destroy/dispose methods

**Files to audit (highest risk):**
- `ui/PropertiesForm.js` - Form inputs with no cleanup
- `UIManager.js` - UI listeners without removal
- `ToolbarStyleControls.js` - Multiple listeners
- `CanvasManager.js` - Canvas event handlers

**Acceptance Criteria:**
- [ ] All addEventListener calls have matching removeEventListener
- [ ] EventTracker used for all long-lived listeners
- [ ] No memory growth in 1-hour editor session (Chrome DevTools)
- [ ] All 2,647 tests still pass

---

### P0.2 Add LayersValidator.js Test Coverage

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 3 days  
**Risk:** HIGH - Security-critical code untested

**Problem:**
LayersValidator.js (953 lines) is the client-side validation layer and has **no dedicated test file**. Validation bugs can lead to security issues or data corruption.

**Solution:**
Create `tests/jest/LayersValidator.test.js` covering:
- All layer types validation
- Coordinate bounds checking
- Text/color sanitization
- Points array validation
- Edge cases (null, undefined, extreme values)

**Acceptance Criteria:**
- [ ] `tests/jest/LayersValidator.test.js` exists with 200+ tests
- [ ] 95%+ coverage on LayersValidator.js
- [ ] All validation rules have positive and negative tests
- [ ] Tests mirror ServerSideLayerValidator coverage

---

### P0.3 Fill LayersDatabaseTest.php

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL  
**Effort:** 2 days  
**Risk:** MEDIUM - Database operations untested

**Problem:**
`tests/phpunit/unit/Database/LayersDatabaseTest.php` is **completely empty**. The database layer is critical for data persistence.

**Solution:**
Add tests for:
- CRUD operations (create, read, update, delete layer sets)
- JSON validation and sanitization
- Named set limits enforcement
- Revision pruning logic
- Error handling paths

**Acceptance Criteria:**
- [ ] LayersDatabaseTest.php has 50+ test methods
- [ ] All public methods have @covers annotations
- [ ] Edge cases tested (max limits, invalid data)

---

### P0.4 Fix PHP json_decode Error Handling

**Status:** ✅ COMPLETED (December 8, 2025)  
**Priority:** HIGH  
**Effort:** 2 hours  
**Risk:** LOW

**Problem:**
6 of 10 `json_decode()` calls don't use `JSON_THROW_ON_ERROR`, causing silent failures.

**Files fixed:**
1. ✅ `src/Hooks/Processors/ThumbnailProcessor.php:124`
2. ✅ `src/Hooks/Processors/LayersParamExtractor.php:102`
3. ✅ `src/Hooks/Processors/LayersParamExtractor.php:190`
4. ✅ `src/Hooks/Processors/ImageLinkProcessor.php:431`
5. ✅ `src/Api/ApiLayersSave.php:151`

**Pattern:**
```php
// Before (silent failure)
$data = json_decode( $json, true );

// After (proper error handling)
try {
    $data = json_decode( $json, true, 512, JSON_THROW_ON_ERROR );
} catch ( \JsonException $e ) {
    // Handle error appropriately
}
```

**Acceptance Criteria:**
- [ ] All json_decode calls use JSON_THROW_ON_ERROR
- [ ] Appropriate error handling for each case
- [ ] PHPUnit tests pass

---

## Phase 1: High Priority (P1)

### P1.1 Split CanvasManager.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 1-2 weeks  
**Risk:** HIGH - Many dependencies

**Problem:**
CanvasManager.js at 1,974 lines with 100+ methods is unmaintainable. It handles 15+ distinct concerns despite previous controller extractions.

**Current architecture:**
```
CanvasManager (1,974 lines)
├── Still handles: initialization, style, viewport, layer ops, events...
└── Delegates to controllers: zoom, grid, transform, hit test, drawing...
```

**Target architecture:**
```
CanvasManager (<400 lines) - True facade
├── LayerOperationsManager - Add, remove, duplicate, reorder
├── ViewportManager - Coordinate transforms, bounds
├── StyleStateManager - Current style, style application
├── CanvasSetupManager - Initialization, canvas creation
└── [Existing controllers]
```

**Extraction plan:**

| New Module | Methods to Extract | Est. Lines |
|------------|-------------------|------------|
| LayerOperationsManager.js | addLayer, removeLayer, duplicateLayer, reorderLayer, getLayerById, getLayers | ~200 |
| ViewportManager.js | getCanvasPoint, getViewportBounds, isPointInCanvas | ~150 |
| StyleStateManager.js | getCurrentStyle, setStyle, applyStyleToLayer | ~150 |
| CanvasSetupManager.js | init, createCanvas, setupContext | ~100 |

**Acceptance Criteria:**
- [ ] CanvasManager.js < 400 lines
- [ ] Only delegation calls, no business logic
- [ ] Each new module < 300 lines
- [ ] All 2,647 Jest tests pass
- [ ] No ESLint errors

---

### P1.2 Eliminate Duplicate Global Exports

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3-5 days  
**Risk:** MEDIUM - Load order dependencies

**Problem:**
Every file exports to both `window.Layers.*` AND `window.ClassName`. This provides no benefit and maintains 130 global exports.

**Current pattern (every file):**
```javascript
window.Layers.Core.CanvasManager = CanvasManager;
window.CanvasManager = CanvasManager;  // Duplicate!
```

**Target pattern:**
```javascript
window.Layers.Core.CanvasManager = CanvasManager;
// No direct window.X export
```

**Migration steps:**
1. Audit all internal usages of `window.ClassName`
2. Update to use `window.Layers.Category.ClassName`
3. Remove direct window exports (keep only for true public API)
4. Update tests to use namespace

**Acceptance Criteria:**
- [ ] `grep -c "^window\.[A-Z][A-Za-z]* =" resources` returns <10 (public API only)
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

| New Module | Responsibility |
|------------|---------------|
| LayerListRenderer.js | DOM creation for layer list |
| LayerItemEvents.js | Click, drag, context menu handlers |
| LayerPropertiesPanel.js | Properties panel rendering |

**Acceptance Criteria:**
- [ ] LayerPanel.js < 600 lines
- [ ] Each extracted module < 400 lines
- [ ] All tests pass

---

### P1.4 Split SelectionManager.js

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3 days

**Problem:** 1,026 lines mixing selection state with selection UI.

**Extraction plan:**

| New Module | Responsibility |
|------------|---------------|
| SelectionState.js | Selection data management |
| SelectionRenderer.js | Handle rendering, bounds display |
| MultiSelectManager.js | Multi-layer selection logic |

**Acceptance Criteria:**
- [ ] SelectionManager.js < 500 lines
- [ ] Selection functionality unchanged
- [ ] All tests pass

---

### P1.5 ES6 Class Pilot (10 Files)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH  
**Effort:** 3-4 days

**Problem:** Only 4 of 50+ files use ES6 classes (0.6% adoption).

**Pilot candidates (mid-size, fewer dependencies):**
1. TextUtils.js (~100 lines)
2. IconFactory.js (~200 lines)
3. ImageLoader.js (~150 lines)
4. MessageHelper.js (~100 lines)
5. CanvasUtilities.js (~200 lines)
6. CanvasEvents.js (~150 lines)
7. StyleController.js (~200 lines)
8. LayersConstants.js (convert to module object)
9. ModuleRegistry.js (~200 lines)
10. HistoryManager.js (~400 lines)

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
- [ ] 10 files converted to ES6 class syntax
- [ ] All tests pass
- [ ] Pattern documented for remaining files

---

## Phase 2: Medium Priority (P2)

### P2.1 Bundle Size Reduction

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2-3 weeks  

**Current:** 932KB unminified  
**Target:** <500KB unminified

**Strategies:**
1. Lazy load ColorPickerDialog (~600 lines)
2. Lazy load ImportExportManager (~400 lines)
3. Separate viewer bundle from editor bundle
4. Remove dead code (analyze coverage reports)
5. Replace JSON.parse(JSON.stringify()) with structuredClone

**Acceptance Criteria:**
- [ ] Bundle < 500KB
- [ ] Viewer loads without editor code
- [ ] All functionality preserved

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
// Create utility
function deepClone( obj ) {
    if ( typeof structuredClone === 'function' ) {
        return structuredClone( obj );
    }
    return JSON.parse( JSON.stringify( obj ) );
}
```

**Files to update:**
- StateManager.js (3 instances)
- SelectionManager.js (2 instances)
- LayersEditor.js (1 instance)
- HistoryManager.js (3 instances)
- CanvasManager.js (2 instances)
- TransformController.js (5 instances)
- InteractionController.js (3 instances)
- ClipboardController.js (2 instances)

**Acceptance Criteria:**
- [ ] deepClone utility created
- [ ] All JSON clone patterns replaced
- [ ] Tests pass

---

### P2.4 Investigate CSP Restrictions

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1 week (investigation)

**Problem:** CSP allows `unsafe-eval` and `unsafe-inline`, weakening XSS protection.

**Investigation:**
1. Identify what requires unsafe-eval (OOUI? MediaWiki core?)
2. Identify inline script sources
3. Determine if nonce-based CSP is feasible
4. Document findings and recommendations

**Acceptance Criteria:**
- [ ] Document listing all unsafe-eval/unsafe-inline dependencies
- [ ] Recommendation: tighten or document why not possible

---

### P2.5 Split ToolManager.js

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 3 days

**Problem:** 1,027 lines handling all tool logic.

**Extraction plan:**

| New Module | Responsibility |
|------------|---------------|
| ToolRegistry.js | Tool registration, lookup |
| ToolStateManager.js | Active tool, tool switching |
| ToolInputHandler.js | Mouse/keyboard input routing |

---

## Phase 3: Long Term (P3)

### P3.1 Complete ES6 Class Migration

**Target:** All 646 prototype methods converted to ES6 classes  
**Effort:** 3-4 weeks  
**Prerequisite:** P1.5 pilot successful

### P3.2 TypeScript Migration

**Target:** Type safety across codebase  
**Effort:** 2-3 months  
**Prerequisites:** ES6 migration complete, globals eliminated

### P3.3 ES Modules

**Target:** Full import/export syntax, tree-shaking  
**Effort:** 1 month  
**Prerequisites:** Globals eliminated, ResourceLoader ES module support

### P3.4 Validation Rule Generation

**Target:** Generate client validation from server rules  
**Effort:** 2 weeks  
**Benefit:** Eliminates dual maintenance of validation logic

---

## Progress Tracking

### Verification Commands

```bash
# God classes remaining
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | awk '$1 > 1000' | wc -l
# Target: 0

# Global exports remaining
grep -r "^window\.[A-Z][A-Za-z]* =" resources --include="*.js" | wc -l
# Target: <10

# Prototype methods remaining
grep -r "\.prototype\." resources --include="*.js" | wc -l
# Target: 0

# ES6 classes
grep -r "^class \|^[[:space:]]*class " resources --include="*.js" | wc -l
# Target: 50+

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c
# Target: <512000

# Memory leak risk (addEventListener imbalance)
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"
# Target: Add ≈ Remove
```

---

## Visual Progress

```
Phase 0 (Critical):
P0.1 Fix Memory Leaks:            ░░░░░░░░░░░░░░░░░░░░ 0%
P0.2 LayersValidator Tests:       ░░░░░░░░░░░░░░░░░░░░ 0%
P0.3 LayersDatabaseTest.php:      ░░░░░░░░░░░░░░░░░░░░ 0%
P0.4 json_decode Error Handling:  ████████████████████ 100% ✅

Phase 1 (High):
P1.1 Split CanvasManager:         ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Eliminate Global Exports:    ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 Split LayerPanel:            ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 Split SelectionManager:      ░░░░░░░░░░░░░░░░░░░░ 0%
P1.5 ES6 Class Pilot:             ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Medium):
P2.1 Bundle Size Reduction:       ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 E2E Test Infrastructure:     ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 Replace JSON Clone:          ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 CSP Investigation:           ░░░░░░░░░░░░░░░░░░░░ 0%
P2.5 Split ToolManager:           ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (Long-term):
P3.1 Complete ES6 Migration:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:        ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 ES Modules:                  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Validation Generation:       ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [ ] No memory leaks in 1-hour session
- [ ] LayersValidator.js has dedicated tests (95%+ coverage)
- [ ] LayersDatabaseTest.php has 50+ tests
- [x] All json_decode use JSON_THROW_ON_ERROR ✅ (December 8, 2025)

### Phase 1 Complete When:
- [ ] No file > 600 lines (except LayerRenderer)
- [ ] Global window.X exports < 10
- [ ] ES6 classes ≥ 15 files
- [ ] All tests pass

### Phase 2 Complete When:
- [ ] Bundle size < 500KB
- [ ] 10+ E2E test files
- [ ] No JSON.parse(JSON.stringify()) for cloning
- [ ] CSP documented/improved

### Project "Healthy" When:
- [ ] No god classes (>1,000 lines)
- [ ] Bundle < 400KB
- [ ] 90%+ branch coverage
- [ ] ES6 classes throughout
- [ ] TypeScript types for core modules

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 2 weeks | None |
| Phase 1 | 4-6 weeks | Phase 0 complete |
| Phase 2 | 4-6 weeks | Parallel with Phase 1 |
| Phase 3 | 2-3 months | Phases 1-2 complete |

**Total: 4-5 months for healthy codebase state**

---

*Plan reset by GitHub Copilot (Claude Opus 4.5) on December 8, 2025*
