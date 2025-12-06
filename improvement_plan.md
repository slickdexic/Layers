# Layers Extension - Improvement Plan

**Last Updated:** December 4, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

**Current State:** The extension is functional with excellent backend security and unit test coverage (2,707 tests). The primary technical debt is architectural: god classes (10 files over 800 lines) and 43 global exports blocking modern tooling.

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
| Total JS files | 43 | - | - |
| Total JS lines | 26,292 | - | - |
| Total JS bytes | 801KB | <480KB minified | 🔴 67% over |
| CanvasManager.js | 1,980 | <800 | 🔴 147% over |
| LayersEditor.js | 1,879 | <800 | 🔴 135% over |
| CanvasRenderer.js | 1,505 | <800 | 🔴 88% over |
| TransformController.js | 1,225 | <600 | 🔴 104% over |
| LayerPanel.js | 1,121 | <600 | 🔴 87% over |
| LayersValidator.js | 1,001 | <500 | 🔴 100% over |
| SelectionManager.js | 998 | <500 | 🔴 100% over |
| ToolManager.js | 996 | <500 | 🔴 99% over |
| Global exports | 43 | <10 | 🔴 330% over |

### Testing

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest test files | 61 | 50+ | 🟢 Excellent |
| Jest tests total | 2,711 | 2,500+ | 🟢 Excellent |
| E2E tests (real) | ~20 | 50+ | 🟡 Needs expansion |
| E2E CI workflow | Configured | Running | 🟡 Verify |

### Memory Management

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Classes with destroy() | All major | All | 🟢 Good |
| Dead code (archive/) | Removed | None | 🟢 Complete |

---

## Phase 0: Critical (P0) - This Week

### P0.1 Verify E2E Tests in CI

**Priority:** P0  
**Status:** In Progress  
**Effort:** 1 day  
**Risk:** LOW

**Problem:** E2E workflow is configured in `.github/workflows/e2e.yml` but needs verification that it runs successfully.

**Current State:**
- `e2e.yml` configures MediaWiki container with mariadb service
- Environment variables: `MW_SERVER`, `MW_USERNAME`, `MW_PASSWORD`, `TEST_FILE`
- Tests skip gracefully when environment not configured

**Tasks:**
- [ ] Trigger E2E workflow manually or via PR
- [ ] Verify all 20+ editor tests pass in CI
- [ ] Fix any environment/timing issues
- [ ] Add status badge to README.md

**Acceptance Criteria:**
- [ ] E2E tests run in GitHub Actions on every PR
- [ ] Test results visible in PR checks
- [ ] At least 15 tests passing consistently

---

### P0.2 Document Architecture Decisions

**Priority:** P0  
**Status:** ✅ COMPLETE  
**Effort:** 2-3 hours  
**Risk:** NONE  
**Completed:** January 2025

**Problem:** Current architecture evolved organically. New contributors need to understand why certain patterns exist.

**Tasks:**
- [x] Create `docs/ARCHITECTURE.md`
- [x] Document module dependency graph
- [x] Explain controller extraction pattern
- [x] Document namespace strategy (window.Layers.*)
- [x] Explain StateManager/editor bridge pattern

**Deliverable:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

**Contents:**
- Module dependency graph (visual ASCII diagram)
- Core patterns: Module Registry, Controller Extraction, StateManager Bridge, MessageHelper, PHP LoggerTrait
- Namespace strategy (current vs target state)
- Data flow diagrams (save/load)
- Testing architecture
- File organization
- Configuration reference
- Migration notes

**Acceptance Criteria:**
- [x] Architecture doc covers all major modules
- [x] Dependency relationships are clear
- [x] Migration path from legacy globals documented

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
- GridRulersController.js (407 lines)
- TransformController.js (1,225 lines) - needs further splitting
- HitTestController.js (376 lines)
- DrawingController.js (620 lines)
- ClipboardController.js
- RenderCoordinator.js
- InteractionController.js (490 lines)
- StyleController.js

**Remaining Extractions Needed:**

| Module | Est. Lines | Methods to Extract |
|--------|------------|-------------------|
| LayerOperationsController | ~150 | addLayer, removeLayer, duplicateLayer, moveLayerUp/Down |
| ViewportController | ~100 | getViewportInfo, screenToCanvas, canvasToScreen |
| CanvasLifecycleManager | ~100 | initialize, setupCanvas, resize |

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
- [ ] All 2,707+ tests pass

---

### P1.2 Decompose LayersEditor.js

**Priority:** P1 - HIGH  
**Status:** Not Started  
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
**Current:** 1,225 lines | **Target:** <600 lines

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

### P1.4 Complete MessageHelper Migration

**Priority:** P1 - MEDIUM  
**Status:** ✅ COMPLETE  
**Effort:** 4-6 hours  
**Risk:** LOW  
**Completed:** January 2025

**Problem:** Duplicate message fallback pattern in 6+ files:
```javascript
return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
```

**Files Updated:**
- ✅ `APIManager.js` - Uses `window.layersMessages.get()`
- ✅ `ErrorHandler.js` - Uses `window.layersMessages.get()`
- ✅ `ImportExportManager.js` - Uses `window.layersMessages.get()` via `msg()`
- ✅ `LayerPanel.js` - Uses `window.layersMessages.get()` via `msg()`
- ✅ `LayersEditor.js` - Uses `window.layersMessages.get()` via `getMessage()`
- ✅ `LayerSetManager.js` - Uses `window.layersMessages.get()` via `getMessage()` and `getMessageWithParams()`
- ✅ `UIManager.js` - Uses `this.getMessage()`
- ✅ `PropertiesForm.js` - Uses `window.layersMessages.get()` via `msg()`
- ✅ `LayersValidator.js` - Uses `window.layersMessages.getWithParams()` via `getMessage()`
- ✅ `Toolbar.js` - Uses `window.layersMessages.get()` via `msg()`

**Acceptance Criteria:**
- [x] No verbose mw.message patterns outside MessageHelper (all use MessageHelper with fallback)
- [x] All messages use MessageHelper.get() (or getWithParams() for parameterized messages)
- [x] All 2,711 tests pass

---

### P1.5 Extract PHP LoggerTrait

**Priority:** P1 - MEDIUM  
**Status:** ✅ COMPLETE  
**Effort:** 2-3 hours  
**Risk:** LOW  
**Completed:** January 2025

**Problem:** Duplicate getLogger() code in 5+ PHP classes.

**Solution Implemented:**
- Created `src/Logging/LoggerAwareTrait.php` for instance methods
- Created `src/Logging/StaticLoggerAwareTrait.php` for static contexts
- Updated 4 PHP files to use the traits:
  - `ApiLayersInfo.php`
  - `ApiLayersSave.php`
  - `LayersDatabase.php`
  - `ThumbnailRenderer.php`

**Acceptance Criteria:**
- [x] LoggerAwareTrait created with getLogger() and setLogger()
- [x] StaticLoggerAwareTrait created for static contexts
- [x] PHP classes updated to use traits
- [x] All PHP tests pass
    private ?LoggerInterface $logger = null;
    
    protected function getLogger(): LoggerInterface {
        if ($this->logger === null) {
            try {
                $this->logger = MediaWikiServices::getInstance()
                    ->getService('LayersLogger');
            } catch (\Exception $e) {
                $this->logger = new NullLogger();
            }
        }
        return $this->logger;
    }
}
```

**Tasks:**
- [ ] Create `src/Traits/LoggerAwareTrait.php`
- [ ] Refactor ImageLinkProcessor.php to use trait
- [ ] Refactor ThumbnailProcessor.php to use trait
- [ ] Refactor LayeredFileRenderer.php to use trait
- [ ] Refactor LayersHtmlInjector.php to use trait
- [ ] Refactor ApiLayersSave.php to use trait
- [ ] Run PHP tests to verify

**Acceptance Criteria:**
- [ ] No duplicate getLogger() implementations
- [ ] All PHP tests pass
- [ ] Trait is documented in copilot-instructions.md

---

### P1.6 Consolidate Global Exports

**Priority:** P1 - MEDIUM  
**Status:** Partially Complete  
**Effort:** 3-4 days  
**Risk:** MEDIUM

**Current State:**
- 43 unique `window.X =` exports
- `LayersNamespace.js` has partial consolidation
- Deprecation warnings partially implemented

**Target Structure:**
```javascript
window.Layers = {
    VERSION: '0.8.1-dev',
    Editor: LayersEditor,
    Core: { StateManager, HistoryManager, EventManager, ModuleRegistry, Constants },
    UI: { Manager, Toolbar, LayerPanel, ColorPickerDialog, PropertiesForm },
    Canvas: { Manager, Renderer, SelectionManager, DrawingController, ... },
    Utils: { Geometry, Text, ImageLoader, ErrorHandler, EventTracker },
    Validation: { LayersValidator, ValidationManager }
};
```

**Tasks:**
- [ ] Audit all 43 global exports
- [ ] Map each to appropriate namespace location
- [ ] Update LayersNamespace.js with complete registry
- [ ] Add deprecation warnings for all legacy exports
- [ ] Update tests to use new namespace
- [ ] Document migration in CONTRIBUTING.md

**Acceptance Criteria:**
- [ ] All exports organized under window.Layers.*
- [ ] Legacy window.X access emits deprecation warnings
- [ ] Migration guide documented
- [ ] All tests updated and passing

---

## Phase 2: Medium Priority (P2) - 1-2 Months

### P2.1 Begin ES Module Migration

**Priority:** P2 - MEDIUM  
**Status:** Not Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM  
**Depends On:** P1.6 (Namespace consolidation)

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

**Current Coverage (4 of 11 layer types):**
- ✅ Rectangle
- ✅ Circle
- ✅ Text
- ✅ Arrow

**Missing Coverage (7 layer types):**
- ❌ Ellipse
- ❌ Polygon
- ❌ Star
- ❌ Line
- ❌ Highlight
- ❌ Path
- ❌ Blur

**Additional Missing Tests:**
- ❌ Named layer sets workflow
- ❌ Revision history navigation
- ❌ Import/export functionality
- ❌ Multi-layer selection
- ❌ Copy/paste operations
- ❌ Zoom and pan interactions

**Tasks:**
- [ ] Add tests for ellipse, polygon, star creation
- [ ] Add tests for line, highlight, path, blur creation
- [ ] Add named layer set creation/switching tests
- [ ] Add revision history navigation tests
- [ ] Add import/export tests

**Acceptance Criteria:**
- [ ] All 11 layer types have creation tests
- [ ] Named layer set workflow tested end-to-end
- [ ] At least 40 E2E tests total

---

## Phase 3: Long Term (P3) - 3+ Months

### P3.1 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** Not Started  
**Effort:** Ongoing  
**Depends On:** P2.1 (ES Modules)

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

**Acceptance Criteria:**
- [ ] tsconfig.json configured
- [ ] Core interfaces defined
- [ ] At least 3 files converted to TypeScript
- [ ] CI runs TypeScript checks

---

### P3.2 Full E2E Test Suite

**Priority:** P3 - LOW  
**Status:** Not Started  
**Effort:** 2-3 weeks  
**Depends On:** P2.4

**Test Coverage Goals:**
- All 11 layer types with property variations
- All keyboard shortcuts
- Multi-layer selection (drag select, Ctrl+click)
- Undo/redo for 20+ operation types
- Named layer sets full workflow
- Revision history navigation
- Import/export JSON
- Cross-browser testing (Chrome, Firefox)

**Acceptance Criteria:**
- [ ] 50+ E2E tests
- [ ] 80%+ feature coverage
- [ ] Tests run in Chrome and Firefox

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

**Acceptance Criteria:**
- [ ] Delete API works with proper permissions
- [ ] Rename API works with validation
- [ ] UI allows managing sets
- [ ] All operations have tests

---

## Quick Reference

### P0 - This Week (Critical)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P0.1 | Verify E2E tests in CI | 1 day | Not Started |
| P0.2 | Document architecture | 2-3 hours | Not Started |

### P1 - 2-4 Weeks (High)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P1.1 | Decompose CanvasManager.js (1,980→<800) | 1-2 weeks | In Progress |
| P1.2 | Decompose LayersEditor.js (1,879→<800) | 1-2 weeks | Not Started |
| P1.3 | Decompose TransformController.js (1,225→<600) | 3-4 days | Not Started |
| P1.4 | Complete MessageHelper migration | 4-6 hours | Not Started |
| P1.5 | Extract PHP LoggerTrait | 2-3 hours | Not Started |
| P1.6 | Consolidate global exports (43→~10) | 3-4 days | Partial |

### P2 - 1-2 Months (Medium)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P2.1 | Begin ES module migration | 1-2 weeks | Not Started |
| P2.2 | Add canvas accessibility | 3-4 days | Not Started |
| P2.3 | Add performance benchmarks | 2-3 days | Not Started |
| P2.4 | Expand E2E coverage (7 more types) | 1 week | Partial |

### P3 - 3+ Months (Low)

| # | Task | Effort | Status |
|---|------|--------|--------|
| P3.1 | TypeScript migration | Ongoing | Not Started |
| P3.2 | Full E2E test suite (50+ tests) | 2-3 weeks | Not Started |
| P3.3 | Layer set management API | 1 week | Not Started |

---

## Visual Progress Dashboard

```
God Classes (Lines → Target):
CanvasManager.js:       ████████████████████████░░░░░░░░ 1,980/800 (247%)
LayersEditor.js:        ███████████████████████░░░░░░░░░ 1,879/800 (235%)
CanvasRenderer.js:      ██████████████████░░░░░░░░░░░░░░ 1,505/800 (188%)
TransformController.js: ████████████████████░░░░░░░░░░░░ 1,225/600 (204%)
LayerPanel.js:          ██████████████████░░░░░░░░░░░░░░ 1,121/600 (187%)
LayersValidator.js:     ████████████████████░░░░░░░░░░░░ 1,001/500 (200%)
SelectionManager.js:    ████████████████████░░░░░░░░░░░░   998/500 (200%)
ToolManager.js:         ████████████████████░░░░░░░░░░░░   996/500 (199%)

Global Namespace:
Unique exports:         █████████████████░░░░░░░░░░░░░░░ 43/10 (430%)

Test Coverage:
Unit tests (Jest):      ████████████████████████████████ 2,707 tests 🟢 EXCELLENT
E2E layer types:        ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4/11 types 🟡 PARTIAL

Memory Management:
destroy() methods:      ████████████████████████████████ All major ✅
Dead code removed:      ████████████████████████████████ archive/ ✅
```

---

## Success Criteria

**Phase 0 Complete When:**
- [ ] E2E tests verified running in CI
- [ ] Architecture documented

**Phase 1 Complete When:**
- [ ] CanvasManager.js < 1,200 lines
- [ ] LayersEditor.js < 1,000 lines
- [ ] TransformController.js < 600 lines
- [ ] No duplicate message patterns
- [ ] No duplicate PHP logger patterns
- [ ] Namespace consolidation complete

**Phase 2 Complete When:**
- [ ] At least 5 ES modules
- [ ] Basic canvas accessibility
- [ ] Performance benchmarks in CI
- [ ] 40+ E2E tests
- [ ] All 11 layer types tested

---

## How to Contribute

1. Pick an unassigned task (prioritize P0 first, then P1)
2. Create a branch: `fix/P1.1-canvas-manager-decompose` or `feature/P2.2-accessibility`
3. Implement with tests (target 90%+ coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Closes P1.4")
6. Update this document when task complete

**Guidelines:**
- P0 tasks block other work - prioritize them
- Keep PRs small and focused (one extraction per PR)
- All new code needs tests
- Update line count metrics when files change significantly
- Follow patterns established in existing controller extractions

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 4, 2025*
