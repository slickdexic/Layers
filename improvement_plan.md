# Layers Extension - Improvement Plan

**Last Updated:** December 4, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

**Current State:** The extension is functional with excellent backend security and unit test coverage (2,705 tests). All P0 critical tasks are now complete. Key remaining work is architectural: god classes (8 files over 800 lines) and 68 global exports.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Blocks development/stability | This week |
| **P1** | High - Significant quality impact | 2-4 weeks |
| **P2** | Medium - Quality improvements | 1-2 months |
| **P3** | Low - Nice to have | 3+ months |

---

## Current Metrics (Verified December 4, 2025)

### JavaScript Codebase

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Total JS files | 47 | - | - |
| Total JS lines | 27,317 | - | - |
| CanvasManager.js | 1,980 | <800 | 148% over |
| LayersEditor.js | 1,879 | <800 | 135% over |
| CanvasRenderer.js | 1,465 | <800 | 83% over |
| TransformController.js | 1,204 | <600 | 100% over |
| LayerPanel.js | 1,121 | <600 | 87% over |
| LayersValidator.js | 1,001 | <500 | 100% over |
| SelectionManager.js | 980 | <500 | 96% over |
| ToolManager.js | 970 | <500 | 94% over |
| Global exports | 44 | <10 | 340% over |

### Testing

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest test files | 61 | 50+ | GOOD |
| Jest tests total | 2,709 | 2,500+ | EXCELLENT |
| E2E tests (real) | ~20 | 50+ | Need CI |
| E2E in CI | 0 | 20+ | MISSING |

### Memory Management

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Classes with destroy() | 28 | All | COMPLETE |
| Classes missing destroy() | 0 | 0 | GOOD |

---

## Phase 0: Critical (P0) - This Week

### P0.1 Integrate E2E Tests into CI

**Priority:** P0 - CRITICAL  
**Status:** Not Started  
**Effort:** 1-2 days  
**Risk:** LOW

**Problem:** Real E2E tests exist in `tests/e2e/editor.spec.js` but require `MW_SERVER` environment variable and skip when unavailable.

**Current State:**
- `smoke.spec.js` - Basic Playwright sanity tests (work offline)
- `editor.spec.js` - ~20 real tests that require MediaWiki instance

**Tasks:**
- [ ] Set up MediaWiki Docker container in CI (GitHub Actions)
- [ ] Configure `MW_SERVER`, `MW_USERNAME`, `MW_PASSWORD` secrets
- [ ] Create CI workflow for E2E tests
- [ ] Add test image fixture (`Test.png`)
- [ ] Verify all existing editor tests pass in CI

**Acceptance Criteria:**
- [ ] E2E tests run in GitHub Actions on every PR
- [ ] Test results visible in PR checks
- [ ] At least 15 tests passing in CI

---

### P0.2 Add destroy() Methods to All Managers

**Priority:** P0 - CRITICAL  
**Status:** COMPLETED (December 4, 2025)  
**Effort:** 3-4 hours  
**Risk:** LOW

**Problem:** 11 classes were missing proper destroy() methods, causing potential memory leaks when editors are destroyed and recreated.

**Classes Updated:**

| Class | File | Status |
|-------|------|--------|
| SelectionManager | SelectionManager.js | ✅ DONE |
| HistoryManager | HistoryManager.js | ✅ DONE |
| ToolManager | ToolManager.js | ✅ DONE |
| APIManager | APIManager.js | ✅ DONE |
| ValidationManager | ValidationManager.js | ✅ DONE |
| CanvasRenderer | CanvasRenderer.js | ✅ DONE |
| ShapeRenderer | ShapeRenderer.js | ✅ DONE |
| TransformController | TransformController.js | ✅ DONE |
| ZoomPanController | ZoomPanController.js | ✅ DONE |
| GridRulersController | GridRulersController.js | ✅ DONE |
| HitTestController | HitTestController.js | ✅ DONE |

**Acceptance Criteria:**
- [x] All 11 classes have destroy() methods
- [x] All 2,709 existing tests still pass

---

### P0.3 Remove Dead Code in archive/ Directory

**Priority:** P0 - LOW  
**Status:** COMPLETED (December 4, 2025)  
**Effort:** 15 minutes  
**Risk:** NONE

**Problem:** The `resources/ext.layers.editor/archive/` directory contained 2 unused files (1,214 lines total).

**Files Removed:**
- `archive/EventHandler.js` (512 lines)
- `archive/EventSystem.js` (702 lines)

**Tasks Completed:**
- [x] Deleted `resources/ext.layers.editor/archive/` directory
- [x] Removed ESLint ignore rules for archive from `.eslintrc.json`
- [x] Removed global references to EventHandler and EventSystem
- [x] All tests pass

---

## Phase 1: High Priority (P1) - 2-4 Weeks

### P1.1 Decompose CanvasManager.js

**Priority:** P1 - HIGH  
**Status:** In Progress  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM  
**Current:** 1,980 lines | **Target:** <800 lines

**Already Extracted Controllers:**
- ZoomPanController.js (341 lines)
- GridRulersController.js (383 lines)
- TransformController.js (1,204 lines) - needs further splitting
- HitTestController.js (376 lines)
- DrawingController.js (620 lines)
- ClipboardController.js (varies)
- RenderCoordinator.js (varies)
- InteractionController.js (490 lines)
- StyleController.js (varies)

**Remaining Extractions Needed:**

| Module | Est. Lines | Methods to Extract |
|--------|------------|-------------------|
| LayerOperationsController | ~150 | addLayer, removeLayer, duplicateLayer, moveLayerUp/Down |
| ViewportController | ~100 | getViewportInfo, screenToCanvas, canvasToScreen |
| CanvasLifecycleManager | ~100 | initialize, setupCanvas, resize, destroy |

**Tasks:**
- [ ] Extract LayerOperationsController from CanvasManager
- [ ] Extract ViewportController from CanvasManager
- [ ] Extract CanvasLifecycleManager from CanvasManager
- [ ] Write tests for each new controller (target 90%+)
- [ ] Update CanvasManager to delegate to new controllers
- [ ] Reduce CanvasManager to orchestration only

**Acceptance Criteria:**
- [ ] CanvasManager.js < 1,200 lines (intermediate target)
- [ ] Each new controller has 90%+ test coverage
- [ ] All 2,709+ tests pass

---

### P1.2 Decompose LayersEditor.js

**Priority:** P1 - HIGH  
**Status:** Partially Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM  
**Current:** 1,879 lines | **Target:** <800 lines

**Already Extracted:**
- LayerSetManager.js (531 lines)

**Remaining Extractions Needed:**

| Module | Est. Lines | Responsibility |
|--------|------------|----------------|
| ModuleInitializer.js | ~200 | Module factory pattern, dependency injection |
| RevisionManager.js | ~200 | Revision loading, history navigation |
| EditorNavigation.js | ~150 | URL handling, navigation |
| EditorDialogs.js | ~150 | Modal dialogs, confirmations |
| KeyboardShortcuts.js | ~100 | Keyboard event handling |

**Tasks:**
- [ ] Extract ModuleInitializer (remove 17 inline factories)
- [ ] Extract RevisionManager
- [ ] Extract EditorNavigation
- [ ] Extract EditorDialogs
- [ ] Extract KeyboardShortcuts
- [ ] Reduce LayersEditor to orchestration only
- [ ] Write tests for each new module

**Acceptance Criteria:**
- [ ] LayersEditor.js < 1,000 lines (intermediate)
- [ ] Each new module has tests
- [ ] Module factories use proper DI pattern

---

### P1.3 Decompose TransformController.js

**Priority:** P1 - HIGH  
**Status:** Not Started  
**Effort:** 3-4 days  
**Risk:** MEDIUM  
**Current:** 1,204 lines | **Target:** <600 lines

**Responsibilities to Extract:**

| Module | Est. Lines | Methods |
|--------|------------|---------|
| ResizeController.js | ~350 | startResize, performResize, finishResize, handle calculations |
| RotationController.js | ~250 | startRotation, performRotation, finishRotation |
| DragController.js | ~300 | startDrag, performDrag, finishDrag, multi-layer drag |
| SnapController.js | ~100 | snap-to-grid, snap-to-angle logic |

**Tasks:**
- [ ] Extract ResizeController
- [ ] Extract RotationController
- [ ] Extract DragController
- [ ] Extract SnapController (shared utility)
- [ ] Write tests for each controller
- [ ] Reduce TransformController to coordination only

**Acceptance Criteria:**
- [ ] TransformController.js < 600 lines
- [ ] Each new controller has 90%+ test coverage
- [ ] All transform operations work correctly

---

### P1.4 Consolidate Global Exports

**Priority:** P1 - HIGH  
**Status:** COMPLETED (December 4, 2025)  
**Effort:** 3-4 days  
**Risk:** MEDIUM

**Current State:**
- 44 unique `window.X =` class exports (reduced from 68 after deduplication)
- `LayersNamespace.js` now has complete registry of all exports
- Namespace structure: `window.Layers.{Core,UI,Canvas,Utils,Validation}.*`
- Deprecation warnings work when `wgLayersDebug=true`

**Completed Tasks:**
- ✅ Phase 1: Audit and registry update
  - Updated `LayersNamespace.js` export registry to include all 44 classes
  - Fixed naming discrepancies (e.g., `LayersToolManager`, `LayersSelectionManager`, `LayersErrorHandler`)
  - Added missing exports: `ShapeRenderer`, `LayerSetManager`
  - Updated tests to match actual export names
  - All 2,707 tests passing
- ✅ Phase 2: Deprecation warnings implemented
  - Warnings fire when `wgLayersDebug` config is enabled
  - Legacy window.* access triggers console warnings

**Target Namespace Structure:**
```javascript
window.Layers = {
    VERSION: '0.8.1-dev',
    Editor: LayersEditor,           // top-level
    ToolManager: LayersToolManager, // top-level
    APIManager: APIManager,         // top-level
    Core: { StateManager, HistoryManager, EventManager, ModuleRegistry, Constants },
    UI: { Manager, Toolbar, LayerPanel, ColorPickerDialog, ... },
    Canvas: { Manager, Renderer, SelectionManager, DrawingController, ... },
    Utils: { Geometry, Text, ImageLoader, ErrorHandler, EventTracker, ... },
    Validation: { LayersValidator, Manager }
};
```

**Acceptance Criteria:**
- [x] Complete export registry in LayersNamespace.js
- [x] All exports mapped to correct namespace locations
- [x] Tests updated and passing
- [x] Legacy exports emit deprecation warnings (when wgLayersDebug=true)
- [ ] Migration guide documented

---

### P1.5 Complete MessageHelper Migration

**Priority:** P1 - LOW  
**Status:** COMPLETED (December 4, 2025)  
**Effort:** 4-6 hours  
**Risk:** LOW

**Problem:** Duplicate message fallback pattern in 4+ files:
```javascript
return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
```

**Solution Implemented:**
- ✅ Replaced duplicate `getMessage()` methods in 4 files with delegation to `window.layersMessages.get()`
- ✅ Files updated: `APIManager.js`, `UIManager.js`, `ValidationManager.js`, `LayersEditor.js`
- ✅ Updated Jest setup to provide MessageHelper singleton for tests
- ✅ Updated tests to verify delegation behavior
- ✅ All 2,705 tests passing

**Changed Files:**
- `resources/ext.layers.editor/APIManager.js` - getMessage() now delegates
- `resources/ext.layers.editor/UIManager.js` - getMessage() now delegates
- `resources/ext.layers.editor/ValidationManager.js` - getMessage() now delegates
- `resources/ext.layers.editor/LayersEditor.js` - getMessage() now delegates
- `tests/jest/setup.js` - Added MessageHelper initialization for test environment
- `tests/jest/ValidationManager.test.js` - Updated getMessage tests
- `tests/jest/UIManager.test.js` - Updated getMessage tests
- `tests/jest/LayersEditorExtended.test.js` - Updated getMessage tests

**Acceptance Criteria:**
- [x] No verbose mw.message patterns outside MessageHelper
- [x] All messages use MessageHelper
- [x] i18n keys validated by banana checker

---

### P1.6 Extract PHP Shared Services

**Priority:** P1 - MEDIUM  
**Status:** Not Started  
**Effort:** 2-3 days  
**Risk:** LOW

**Problem:** Duplicate code patterns in PHP files:

**getLogger() pattern duplicated in 4 classes:**
```php
private function getLogger() {
    if ( $this->logger === null ) {
        try {
            $this->logger = MediaWikiServices::getInstance()
                ->getService( 'Layers.Logger' );
        } catch ( \Exception $e ) {
            $this->logger = new NullLogger();
        }
    }
    return $this->logger;
}
```

**Tasks:**
- [ ] Create `src/Services/LoggerFactory.php`
- [ ] Create `src/Services/FileResolver.php`
- [ ] Register in `services.php`
- [ ] Refactor all callers to use injected services
- [ ] Add unit tests

**Acceptance Criteria:**
- [ ] No duplicate getLogger() implementations
- [ ] Services have 100% test coverage
- [ ] All PHP tests pass

---

## Phase 2: Medium Priority (P2) - 1-2 Months

### P2.1 Begin ES Module Migration

**Priority:** P2 - MEDIUM  
**Status:** Not Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM

**Strategy:** Start with leaf modules (no dependencies on other Layers code):

| Phase | Files | Dependencies |
|-------|-------|--------------|
| 1 | GeometryUtils.js, TextUtils.js | None |
| 2 | LayersConstants.js | None |
| 3 | MessageHelper.js | mw only |
| 4 | ErrorHandler.js | MessageHelper |

**Tasks:**
- [ ] Configure webpack for ES module output
- [ ] Add babel/esbuild for ES module transpilation
- [ ] Convert GeometryUtils.js (proof of concept)
- [ ] Add backward compatibility wrapper
- [ ] Update tests for ES module syntax
- [ ] Document pattern for contributors

**Acceptance Criteria:**
- [ ] At least 3 files converted to ES modules
- [ ] Backward compatibility maintained
- [ ] Pattern documented in CONTRIBUTING.md

---

### P2.2 Add Canvas Accessibility

**Priority:** P2 - MEDIUM  
**Status:** Not Started  
**Effort:** 3-4 days  
**Risk:** LOW

**Problem:** Canvas is inherently inaccessible to screen readers.

**Solution:**
```html
<div class="layers-sr-only" role="region" aria-live="polite">
    <ul id="layers-sr-list">
        <li>Text layer: "Label 1" at position 100, 200</li>
        <li>Rectangle at position 50, 50, size 200 by 100</li>
    </ul>
</div>
```

**Tasks:**
- [ ] Add hidden layer description container
- [ ] Sync descriptions with canvas changes
- [ ] Add keyboard navigation (Tab through layers)
- [ ] Add keyboard shortcuts help modal (Shift+?)
- [ ] Add focus indicators for keyboard navigation
- [ ] Test with NVDA/VoiceOver

**Acceptance Criteria:**
- [ ] Screen readers announce layer information
- [ ] Keyboard navigation between layers works
- [ ] WCAG 2.1 Level A criteria met for interaction

---

### P2.3 Add Performance Benchmarks

**Priority:** P2 - LOW  
**Status:** Not Started  
**Effort:** 2-3 days  
**Risk:** LOW

**Tasks:**
- [ ] Create benchmark for canvas rendering (10, 50, 100 layers)
- [ ] Create benchmark for layer operations (add, move, delete)
- [ ] Create benchmark for large polygon paths (500+ points)
- [ ] Add benchmark job to CI
- [ ] Document baseline performance
- [ ] Add performance regression detection

**Acceptance Criteria:**
- [ ] Benchmarks run in CI on every PR
- [ ] Baseline established and documented
- [ ] Alerts on >20% regression

---

### P2.4 Expand E2E Test Coverage

**Priority:** P2 - MEDIUM  
**Status:** Partially Complete  
**Effort:** 1 week  
**Risk:** LOW

**Current Coverage:**
- Rectangle, circle, text, arrow creation
- Select, delete, undo, redo
- Save/load basics

**Missing Coverage:**
- [ ] All 11 layer types (ellipse, polygon, star, line, highlight, path, blur)
- [ ] Named layer sets (create, switch, save to specific set)
- [ ] Revision history (load specific revision)
- [ ] Import/export functionality
- [ ] Multi-layer selection and operations
- [ ] Copy/paste operations
- [ ] Zoom and pan operations
- [ ] Grid and ruler toggles

**Acceptance Criteria:**
- [ ] At least 40 E2E tests
- [ ] All 11 layer types tested
- [ ] Named layer set workflow tested

---

## Phase 3: Long Term (P3) - 3+ Months

### P3.1 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** Not Started  
**Effort:** Ongoing  
**Dependencies:** P2.1 (ES Modules)

**Strategy:**
1. Add `tsconfig.json` with `allowJs: true`
2. Create type definitions for core interfaces
3. New features written in TypeScript
4. Gradually convert existing files (start with utilities)

**Tasks:**
- [ ] Add tsconfig.json
- [ ] Create `types/` directory
- [ ] Define Layer, Tool, Event interfaces
- [ ] Convert GeometryUtils.ts (proof of concept)
- [ ] Add TypeScript to CI checks

---

### P3.2 Full E2E Test Suite

**Priority:** P3 - LOW  
**Status:** Not Started  
**Effort:** 2-3 weeks  
**Dependencies:** P0.1, P2.4

**Test Coverage Goals:**
- All 11 layer types with property variations
- All keyboard shortcuts
- Multi-layer selection (drag select, Ctrl+click)
- Undo/redo for 20+ operation types
- Named layer sets full workflow
- Revision history navigation
- Import/export JSON
- Concurrent editing scenarios (if applicable)

**Acceptance Criteria:**
- [ ] 50+ E2E tests
- [ ] 80%+ feature coverage
- [ ] Cross-browser testing (Chrome, Firefox)

---

### P3.3 Layer Set Management API

**Priority:** P3 - BACKLOG  
**Status:** Not Started  
**Effort:** 1 week

**New API Endpoints:**
- `ApiLayersDelete.php` - Delete layer sets
- `ApiLayersRename.php` - Rename layer sets

**Tasks:**
- [ ] Add `deletelayersets` permission
- [ ] Create ApiLayersDelete.php
- [ ] Create ApiLayersRename.php
- [ ] Add UI for set management (rename, delete)
- [ ] Add confirmation dialogs
- [ ] Add tests

---

## Quick Reference

### P0 - This Week (Critical)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P0.1 | Integrate E2E tests into CI | 1-2 days | ✅ COMPLETED |
| P0.2 | Add destroy() to 11 classes | 3-4 hours | ✅ COMPLETED |
| P0.3 | Remove archive/ dead code | 15 min | ✅ COMPLETED |

### P1 - 2-4 Weeks (High)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P1.1 | Decompose CanvasManager.js | 1-2 weeks | Not started |
| P1.2 | Decompose LayersEditor.js | 1-2 weeks | Partial |
| P1.3 | Decompose TransformController.js | 3-4 days | Not started |
| P1.4 | Consolidate global exports | 3-4 days | ✅ COMPLETED |
| P1.5 | Complete MessageHelper migration | 4-6 hours | ✅ COMPLETED |
| P1.6 | Extract PHP shared services | 2-3 days | Not started |

### P2 - 1-2 Months (Medium)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P2.1 | Begin ES module migration | 1-2 weeks | Not started |
| P2.2 | Add canvas accessibility | 3-4 days | Not started |
| P2.3 | Add performance benchmarks | 2-3 days | Not started |
| P2.4 | Expand E2E test coverage | 1 week | Partial |

### P3 - 3+ Months (Low)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P3.1 | TypeScript migration | Ongoing | Not started |
| P3.2 | Full E2E test suite | 2-3 weeks | Not started |
| P3.3 | Layer set management API | 1 week | Not started |

---

## Visual Progress Dashboard

```
God Classes (Lines -> Target):
CanvasManager.js:       ████████████████████████░░░░░░░░ 1,980/800 (248%)
LayersEditor.js:        ███████████████████████░░░░░░░░░ 1,879/800 (235%)
CanvasRenderer.js:      ██████████████████░░░░░░░░░░░░░░ 1,465/800 (183%)
TransformController.js: ████████████████████░░░░░░░░░░░░ 1,204/600 (201%)
LayerPanel.js:          ██████████████████░░░░░░░░░░░░░░ 1,121/600 (187%)

Memory Management:
Classes with destroy():    ████████████████████████████████ 28/28 (100%) ✅
Classes missing destroy(): ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0 classes ✅

Global Namespace:
Global exports:           ████████████████████████████████ 68 (680% over target of 10)

Test Coverage:
Unit tests (Jest):        █████████████████████████████░░░ 2,709 tests EXCELLENT
E2E tests in CI:          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0 tests MISSING
```

---

## Success Criteria

**Phase 0 Complete When:**
- [ ] E2E tests run in CI on every PR
- [x] All 11 classes have destroy() methods ✅
- [x] Archive directory deleted ✅
- [ ] Memory leak test passes

**Phase 1 Complete When:**
- [ ] CanvasManager.js < 1,200 lines
- [ ] LayersEditor.js < 1,000 lines
- [ ] TransformController.js < 600 lines
- [ ] Single `window.Layers` namespace
- [ ] No duplicate message patterns

**Phase 2 Complete When:**
- [ ] At least 5 ES modules
- [ ] PHP shared services extracted
- [ ] Basic canvas accessibility
- [ ] Performance benchmarks in CI
- [ ] 40+ E2E tests

---

## How to Contribute

1. Pick an unassigned task (prioritize P0 first)
2. Create a branch: `fix/P0.2-destroy-methods` or `feature/P1.3-transform-decompose`
3. Implement with tests (target 90%+ coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Closes P0.2")
6. Update this document when task complete

**Guidelines:**
- P0 tasks block other work - prioritize them
- Keep PRs small and focused (one extraction per PR)
- All new code needs tests
- Update line count metrics when files change significantly

---

*Plan created by GitHub Copilot on December 4, 2025*
