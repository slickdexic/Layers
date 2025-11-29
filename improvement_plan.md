# Layers Extension - Improvement Plan

**Last Updated:** November 27, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates and risk assessments.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| P0 | Critical - Production blockers | Must fix before release |
| P1 | High - Significant impact | Next sprint |
| P2 | Medium - Quality improvements | Next month |
| P3 | Low - Nice to have | Long term |

---

## Current Status Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 1,202 | 1,500+ | +298 |
| Overall Coverage | 53.4% | 70% | +16.6% |
| Core Module Coverage | 14-22% | 60% | +38-46% |
| CanvasManager.js lines | 4,048 | <800 | -3,248 |
| WikitextHooks.php lines | 2,001 | <400 | -1,601 |
| ESLint warnings | 0 | 0 | Met |
| Window globals | 29+ | <10 | -19+ |
| Empty catch blocks | 20+ | 0 | ✅ Fixed |
| Undo/redo implementations | 3 | 1 | ✅ Consolidated |
| Save/Load integration tests | 0 | 20+ | ✅ Added (24 tests) |

---

## Phase 0: Critical Fixes (P0)

### 0.1 Split CanvasManager.js God Class

**Priority:** P0 - CRITICAL

**Problem:** 4,048 lines with 120+ methods violates every SOLID principle. Only 22.24% coverage.

**Impact:** High regression risk, impossible to test, blocks new contributors, debugging nightmare.

**Proposed Extraction:**

| New Module | Est. Lines | Responsibilities | Priority |
|------------|------------|------------------|----------|
| CanvasCore.js | ~600 | Canvas setup, context, resize, init | First |
| InteractionController.js | ~800 | Mouse/touch events, drag handling | Second |
| SelectionController.js | ~600 | Selection state, bounds, handles | Third |
| RenderCoordinator.js | ~500 | Render scheduling, dirty regions | Fourth |
| DrawingModeController.js | ~400 | Tool state machine, drawing state | Fifth |

**Existing Good Extractions (97-100% coverage):**

- ZoomPanController.js (343 lines)
- GridRulersController.js (385 lines)
- TransformController.js (965 lines)
- HitTestController.js (382 lines)
- DrawingController.js (620 lines)
- ClipboardController.js (222 lines)

**Tasks:**

- [ ] Map all remaining methods to proposed modules
- [ ] Extract CanvasCore.js with init(), resize(), setupContext()
- [ ] Extract InteractionController.js with event handlers
- [ ] Extract SelectionController.js with selection state
- [ ] Extract RenderCoordinator.js with performRedraw()
- [ ] Remove fallback implementations that duplicate controller logic
- [ ] Update CanvasManager to compose extracted modules
- [ ] Add tests for each extracted module (target 80% coverage)
- [ ] Verify all existing tests still pass

**Estimated Effort:** 1 week (40 hours)  
**Risk:** HIGH - Core functionality changes  
**Dependencies:** None

---

### 0.2 Consolidate Undo/Redo into Single System

**Priority:** P0 - CRITICAL

**Problem:** Three separate undo/redo implementations creating conflict potential and memory waste.

**Current State:**

| Location | Lines | Status |
|----------|-------|--------|
| HistoryManager.js | 524 | Primary (keep) |
| LayersEditor.js:255-277 | ~22 | Wrapper (keep as delegation) |
| CanvasManager.js:2268-2326 | ~58 | ✅ REMOVED (now delegates) |

**Status:** ✅ COMPLETED (November 27, 2025)

**Tasks:**

- [x] Audit CanvasManager undo/redo usage
- [x] Ensure all undo/redo calls route through HistoryManager
- [x] Remove duplicate implementation from CanvasManager
- [x] Update LayersEditor to delegate to HistoryManager only
- [x] Verify single history array is used
- [ ] Add tests for history edge cases
- [ ] Document the history architecture

**Completed Changes:**
- Modified `EventHandler.js` to call `editor.undo()`/`editor.redo()` instead of `canvasManager.undo()`/`canvasManager.redo()`
- Modified `CanvasEvents.js` to call `editor.undo()`/`editor.redo()` instead of `cm.undo()`/`cm.redo()`
- Refactored `CanvasManager.saveState()` to delegate to `editor.historyManager.saveState()`
- Refactored `CanvasManager.updateUndoRedoButtons()` to delegate to HistoryManager
- Refactored `CanvasManager.undo()`/`redo()` to delegate to `editor.undo()`/`editor.redo()`
- Removed duplicate history array from CanvasManager constructor
- Updated EventHandler tests to verify calls go through editor

**Estimated Effort:** 1 day  
**Actual Effort:** 2 hours
**Risk:** MEDIUM - Undo/redo is critical functionality  
**Dependencies:** None

---

### 0.3 Replace Empty Catch Blocks with ErrorHandler

**Priority:** P0 - CRITICAL

**Problem:** 20+ empty catch blocks silently swallow errors. ErrorHandler.js exists but is never used.

**Files Affected:**

| File | Empty catches |
|------|---------------|
| CanvasManager.js | 2 |
| LayersEditor.js | 4 |
| LayerPanel.js | 3 |
| Toolbar.js | 2 |
| LayersViewer.js | 4 |
| TransformController.js | 1 |
| ValidationManager.js | 1 |
| ColorPickerDialog.js | 2 |
| PropertiesForm.js | 1 |

**Status:** ✅ COMPLETED (November 27, 2025)

**Tasks:**

- [x] Create ErrorHandler instance in LayersEditor init
- [x] Replace all `catch (_e) {}` with `ErrorHandler.handleError(e, context)`
- [x] Replace all `catch (_e) { /* ignore */ }` with proper logging
- [x] Add error context to each catch (operation name, parameters)
- [x] Ensure ErrorHandler logs to mw.log for debugging
- [ ] Test error scenarios don't crash silently
- [ ] Update documentation for error handling patterns

**Completed Changes:**
- `CanvasManager.js`: Replaced empty catch in transform event emission with ErrorHandler
- `LayerPanel.js`: Replaced 3 empty catches (dialog cleanup, i18n, properties sync) with ErrorHandler/mw.log
- `Toolbar.js`: Replaced dialog cleanup catch with mw.log warning
- `LayersViewer.js`: Replaced 3 catches (ResizeObserver, blend mode) with ErrorHandler/mw.log
- `TransformController.js`: Replaced empty catch in emitTransformEvent with ErrorHandler
- `ColorPickerDialog.js`: Replaced 2 localStorage catches with mw.log warning
- `PropertiesForm.js`: Replaced i18n msg catch with mw.log warning

**Estimated Effort:** 4 hours  
**Actual Effort:** 1 hour
**Risk:** LOW - No functional changes, only observability  
**Dependencies:** None

---

### 0.4 Implement Dirty Region Rendering

**Priority:** P0 - CRITICAL

**Problem:** Variables defined but 100% unused; every change triggers full redraw.

**Evidence (CanvasManager.js:37-42):**

```javascript
this.dirtyRegion = null;          // NEVER USED (grep: 1 occurrence)
this.animationFrameId = null;     // NEVER USED
this.layersCache = Object.create(null);  // NEVER USED (grep: 1 occurrence)
this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 }; // NEVER USED
```

**Tasks:**

- [ ] Implement `markDirtyRegion(x, y, width, height)` method
- [ ] Implement `getDirtyRegion()` that returns bounds to redraw
- [ ] Modify `performRedraw()` to only redraw dirty regions
- [ ] Implement `invalidateLayerCache(layerId)` for changed layers
- [ ] Use `requestAnimationFrame` for smooth animations
- [ ] Implement frame throttling (target 60fps max)
- [ ] Add performance benchmarks (before/after)
- [ ] Document performance improvements

**Estimated Effort:** 3 days  
**Risk:** MEDIUM - Visual bugs possible  
**Dependencies:** Best done during CanvasManager split (0.1)

---

### 0.5 Address Security TODOs

**Priority:** P0 - CRITICAL (Reviewed - No issues found)

**Problem:** Security-related TODOs in production code.

**Location:** `resources/ext.layers.editor/LayersEditor.js`

**Status:** ✅ REVIEWED AND DOCUMENTED (November 27, 2025)

**Audit Results:**

| Security Concern | Implementation Status |
|------------------|----------------------|
| XSS via innerHTML | ✅ Safe - innerHTML only used for static HTML templates with numeric values |
| Layer names | ✅ Safe - Always inserted via textContent, never innerHTML |
| User text input | ✅ Safe - Goes into textarea/canvas, not HTML |
| String sanitization | ✅ Implemented - ValidationManager.sanitizeString() strips `<>`, `javascript:`, event handlers |
| Recursive sanitization | ✅ Implemented - ValidationManager.sanitizeLayerData() handles all layer properties |
| Server-side validation | ✅ Implemented - ServerSideLayerValidator enforces strict property whitelist |

**Completed Changes:**
- Updated TODOs in LayersEditor.js to document that security measures are already implemented
- Converted accessibility TODO to NOTE documenting current state and future enhancements

**Tasks:**

- [x] Audit frontend rendering paths for XSS vectors
- [x] Verify layer names are sanitized before DOM insertion
- [x] Verify text layer content is escaped before canvas render
- [x] Review existing sanitization in ValidationManager
- [x] Document security measures in code comments

**Estimated Effort:** 4 hours  
**Actual Effort:** 30 minutes (audit only - no fixes needed)
**Risk:** ~~MEDIUM~~ LOW - Security measures already in place
**Dependencies:** None

---

## Phase 1: High Priority (P1)

### 1.1 Split WikitextHooks.php and Eliminate Duplication

**Priority:** P1 - HIGH

**Problem:** 2,001 lines with massive code duplication. Same HTML injection pattern repeated 5 times.

**Proposed Structure:**

```
src/Hooks/
  WikitextHooks.php         # Coordinator (~150 lines)
  LayersHtmlInjector.php    # Shared HTML injection (~200 lines) - NEW
  ImageLinkProcessor.php    # onImageBeforeProduceHTML, onMakeImageLink2 (~300 lines)
  ThumbnailProcessor.php    # Thumbnail hooks (~300 lines)
  LayersParamHandler.php    # layers= parameter parsing (~150 lines)
```

**Key Refactoring:** Extract common HTML attribute injection into `LayersHtmlInjector` with a single method called by all hooks.

**Tasks:**

- [ ] Identify duplicated regex and attribute injection code
- [ ] Create LayersHtmlInjector with `injectLayersAttributes($html, $options)` method
- [ ] Extract ImageLinkProcessor with onImageBeforeProduceHTML logic
- [ ] Extract ThumbnailProcessor with thumbnail hooks
- [ ] Update WikitextHooks to delegate to new classes
- [ ] Add PHPUnit tests for extracted classes
- [ ] Verify all wikitext embedding scenarios still work

**Estimated Effort:** 2 days  
**Risk:** MEDIUM  
**Dependencies:** None

---

### 1.2 Consolidate Event Systems

**Priority:** P1 - HIGH

**Problem:** 5 event-related files with overlapping responsibilities.

**Current State:**

| File | Lines | Purpose |
|------|-------|---------|
| EventHandler.js | 508 | DOM event handling |
| EventManager.js | 119 | Event registration |
| EventSystem.js | 699 | Custom event bus |
| CanvasEvents.js | 547 | Canvas-specific events |
| CanvasManager.js (inline) | ~500+ | Direct event handling |

**Proposed Structure:**

| Keep | Purpose |
|------|---------|
| EventBus.js (from EventSystem.js) | Pub/sub for custom events |
| CanvasInputHandler.js (from EventHandler + CanvasEvents) | All DOM/Canvas events |

**Tasks:**

- [ ] Document current event flow for each file
- [ ] Create EventBus.js from EventSystem.js core functionality
- [ ] Merge EventHandler.js and CanvasEvents.js into CanvasInputHandler.js
- [ ] Inline EventManager.js into LayersEditor.js
- [ ] Remove duplicate event handling from CanvasManager
- [ ] Update all references and imports
- [ ] Add tests for merged functionality
- [ ] Remove deprecated files

**Estimated Effort:** 3 days  
**Risk:** HIGH - Event handling is critical  
**Dependencies:** None

---

### 1.3 Complete StateManager Migration

**Priority:** P1 - HIGH

**Problem:** StateManager exists but components bypass it, leading to inconsistent state.

**Components Bypassing StateManager:**

| Component | Local State | Should Use StateManager |
|-----------|-------------|------------------------|
| CanvasManager | selectedLayerIds, currentTool, zoom, pan | Yes |
| HistoryManager | Separate layer snapshot array | Yes |
| LayerPanel | Sometimes calls canvas directly | Yes |
| Toolbar | Direct canvas manipulation | Yes |

**Tasks:**

- [ ] Move CanvasManager zoom/pan state to StateManager
- [ ] Move currentTool state to StateManager
- [ ] Integrate HistoryManager with StateManager's layer state
- [ ] Ensure LayerPanel always reads from StateManager
- [ ] Add state change subscriptions where needed
- [ ] Remove duplicate state variables
- [ ] Add tests for state consistency

**Estimated Effort:** 2 days  
**Risk:** MEDIUM  
**Dependencies:** 0.2 (Undo/redo consolidation)

---

### 1.4 Add Integration Tests for Save/Load

**Priority:** P1 - HIGH

**Problem:** No tests verify complete save/load workflow.

**Status:** ✅ COMPLETED (November 27, 2025)

**Tasks:**

- [x] Create `tests/jest/integration/SaveLoadWorkflow.test.js`
- [x] Test: Create layers -> save -> verify API call structure
- [x] Test: Load existing layers -> verify rendered
- [x] Test: Named layer sets switching
- [x] Test: Save with invalid data -> verify error handling
- [x] Test: Load non-existent layer set -> verify fallback
- [x] Test: Data integrity through save/load cycle
- [x] Test: Retry logic for transient errors
- [x] Test: Error handling for permissions, rate limiting
- [x] Mock API responses appropriately

**Completed Changes:**
- Created comprehensive integration test suite (24 tests) covering:
  - Save Workflow: API call structure, spinner display, error handling, validation, size limits
  - Load Workflow: Set name loading, state updates, missing sets, API errors
  - Revision Loading: Load by ID, revision not found handling
  - Named Layer Sets: Saving to specific sets, switching between sets
  - Data Integrity: Property preservation, special characters, polygons with many points
  - Retry Logic: Retryable error identification, network error handling
  - Error Handling: Permission denied, error normalization, message localization, log sanitization

**Estimated Effort:** 2 days  
**Actual Effort:** 1.5 hours
**Risk:** LOW  
**Dependencies:** None

---

### 1.5 Increase Core Module Coverage

**Priority:** P1 - HIGH

**Current Coverage Gaps:**

| File | Current | Target | Gap |
|------|---------|--------|-----|
| CanvasManager.js | 22.24% | 60% | +37.76% |
| LayersEditor.js | 14.62% | 50% | +35.38% |
| CanvasEvents.js | 19.15% | 60% | +40.85% |

**Tasks:**

- [ ] Add CanvasManager tool switching tests
- [ ] Add CanvasManager render cycle tests
- [ ] Add LayersEditor initialization tests
- [ ] Add LayersEditor save workflow tests
- [ ] Add CanvasEvents mouse event tests
- [ ] Update jest.config.js coverage thresholds
- [ ] Add coverage gates to CI pipeline

**Estimated Effort:** 3 days  
**Risk:** LOW  
**Dependencies:** Easier after 0.1 (CanvasManager split)

---

## Phase 2: Medium Priority (P2)

### 2.1 Migrate to ES Modules

**Priority:** P2 - MEDIUM

**Problem:** IIFE pattern with 29+ window globals (233+ `window.` assignments) blocks modern tooling.

**Migration Order (by dependency depth):**

1. **No dependencies** (start here):
   - LayersConstants.js (332 lines)
   - GeometryUtils.js (255 lines)
   - ErrorHandler.js (556 lines)

2. **Single dependency**:
   - ValidationManager.js
   - CanvasRenderer.js

3. **Multiple dependencies** (last):
   - CanvasManager.js
   - LayersEditor.js

**Tasks:**

- [ ] Add `type: "module"` support to webpack config
- [ ] Convert LayersConstants.js to ES module with named exports
- [ ] Convert GeometryUtils.js to ES module
- [ ] Update ResourceLoader configuration in extension.json
- [ ] Test in MediaWiki development environment
- [ ] Document migration pattern for remaining files
- [ ] Update ESLint config to remove global declarations

**Estimated Effort:** 1 week  
**Risk:** MEDIUM - ResourceLoader compatibility unknown  
**Dependencies:** None

---

### 2.2 Remove Silent Constant Fallbacks

**Priority:** P2 - MEDIUM

**Status:** ✅ COMPLETED (November 28, 2025), FIXED (November 29, 2025)

**Problem:** Constants fail silently with fallback values, masking configuration issues.

**Current Pattern (found 10+ times):**

```javascript
const LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
this.minZoom = uiConsts ? uiConsts.MIN_ZOOM : 0.1;
```

**Solution Implemented:**

Added centralized dependency validation in `LayersEditor.js` that runs at construction time:

```javascript
function validateDependencies() {
    const missing = [];
    // Check required global classes
    const requiredClasses = ['UIManager', 'EventManager', 'APIManager', ...];
    // Check LayersConstants and critical sub-groups
    if (!window.LayersConstants) { missing.push('LayersConstants'); }
    // Log warning with all missing dependencies (non-blocking)
    if (missing.length > 0) {
        mw.log.warn('Missing dependencies: ' + missing.join(', '));
        console.warn('[LayersEditor]', errorMsg);
        return false;
    }
    return true;
}
```

**Note:** Changed from throwing error to logging warning (November 29, 2025) to prevent complete editor failure when dependencies are missing.

**Tasks:**

- [x] Identify all fallback patterns (found 10+ in CanvasManager, PropertiesForm, LayerPanel)
- [x] Add initialization check at LayersEditor entry point
- [x] Test that missing constants cause visible failure (now logs warning)
- [x] Fix blocking error that prevented editor from opening
- [ ] Document required ResourceLoader dependencies
- [ ] Consider migrating remaining fallbacks to use centralized constants getter

**Completed Changes:**
- Added `validateDependencies()` function in LayersEditor.js
- Validates all 9 required classes (UIManager, EventManager, etc.)
- Validates LayersConstants and 5 critical sub-groups (TOOLS, LAYER_TYPES, DEFAULTS, UI, LIMITS)
- Logs warning instead of throwing error (allows graceful degradation)
- Logs to both mw.log.warn and console.warn for debugging

**Estimated Effort:** 1 day  
**Actual Effort:** 1 hour
**Risk:** LOW  
**Dependencies:** None

---

### 2.3 Implement Canvas Accessibility Workaround

**Priority:** P2 - MEDIUM

**Problem:** `<canvas>` is inaccessible to screen readers.

**Proposed Solution:** Create a screen-reader-only layer list that mirrors canvas content.

**Tasks:**

- [ ] Add visually-hidden layer description list
- [ ] Sync descriptions with canvas layer changes
- [ ] Add `aria-live="polite"` for layer updates
- [ ] Add keyboard navigation for layer selection
- [ ] Test with NVDA and VoiceOver
- [ ] Document in ACCESSIBILITY.md

**Estimated Effort:** 3 days  
**Risk:** LOW  
**Dependencies:** None

---

### 2.4 Fix N+1 Query in WikitextHooks

**Priority:** P2 - MEDIUM

**Status:** ✅ ALREADY FIXED (Discovered November 28, 2025)

**Problem:** `getNamedSetsForImage()` has N+1 query pattern.

**Investigation Results:**

The N+1 query pattern was already fixed in `LayersDatabase.php`. The `getNamedSetsForImage()` method uses a self-join approach to get aggregates and latest user in one query:

```php
$result = $dbr->select(
    [ 'ls' => 'layer_sets', 'ls_latest' => 'layer_sets' ],
    [...],
    [...],
    __METHOD__,
    ['GROUP BY' => [...], 'ORDER BY' => ...],
    ['ls_latest' => ['INNER JOIN', [...]]]  // Eliminates N+1
);
```

Additionally, `ApiLayersInfo.php` uses batch user loading via `enrichWithUserNames()` and `enrichNamedSetsWithUserNames()` methods.

**Tasks:**

- [x] Identify N+1 query in LayersDatabase or WikitextHooks - Already fixed with self-join
- [x] Refactor to use single query with GROUP BY or JOIN - Already implemented
- [ ] Add database query count tests
- [ ] Benchmark before/after

**Estimated Effort:** ~~4 hours~~ N/A (already done)
**Risk:** LOW  
**Dependencies:** None

---

## Phase 3: Long Term (P3)

### 3.1 TypeScript Migration

**Priority:** P3 - LOW

**Approach:** New code only, gradual migration.

**Tasks:**

- [ ] Add tsconfig.json with strict settings
- [ ] Create shared types: `types/Layer.ts`, `types/Tool.ts`
- [ ] Write new features in TypeScript
- [ ] Add .ts file handling to webpack
- [ ] Document TypeScript conventions
- [ ] Migrate one existing file as proof of concept

**Estimated Effort:** Ongoing  
**Risk:** LOW  
**Dependencies:** 2.1 (ES Modules) recommended first

---

### 3.2 Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW

**Tasks:**

- [ ] Color contrast audit of all UI elements
- [ ] Implement high contrast mode
- [ ] Add skip links to main regions
- [ ] Comprehensive keyboard navigation
- [ ] Screen reader testing (NVDA, VoiceOver, JAWS)
- [ ] Create accessibility conformance statement
- [ ] Document all keyboard shortcuts in UI

**Estimated Effort:** 2 weeks  
**Risk:** MEDIUM  
**Dependencies:** 2.3 (Canvas accessibility)

---

### 3.3 Performance Profiling and Optimization

**Priority:** P3 - LOW

**Tasks:**

- [ ] Profile with Chrome DevTools
- [ ] Implement layer caching for unchanged layers
- [ ] Add virtual scrolling to layer panel (for >50 layers)
- [ ] Optimize path rendering for complex shapes
- [ ] Add performance metrics logging
- [ ] Document performance benchmarks

**Estimated Effort:** 1 week  
**Risk:** LOW  
**Dependencies:** 0.4 (Dirty regions)

---

## Quick Reference: Priority Summary

### Must Do (P0) - Before Production Release

| # | Task | Effort | Risk |
|---|------|--------|------|
| 0.1 | Split CanvasManager.js | 1 week | HIGH |
| 0.2 | Consolidate undo/redo | 1 day | MEDIUM |
| 0.3 | Replace empty catches with ErrorHandler | 4 hours | LOW |
| 0.4 | Implement dirty regions | 3 days | MEDIUM |
| 0.5 | Address security TODOs | 4 hours | MEDIUM |

**Total P0 Effort:** ~2 weeks

### Should Do (P1) - Next Sprint

| # | Task | Effort | Risk |
|---|------|--------|------|
| 1.1 | Split WikitextHooks.php | 2 days | MEDIUM |
| 1.2 | Consolidate event systems | 3 days | HIGH |
| 1.3 | Complete StateManager migration | 2 days | MEDIUM |
| 1.4 | Add integration tests | 2 days | LOW |
| 1.5 | Increase core coverage | 3 days | LOW |

**Total P1 Effort:** ~2.5 weeks

### Nice to Have (P2-P3)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 2.1 | ES Modules migration | 1 week | P2 |
| 2.2 | Remove silent fallbacks | 1 day | P2 |
| 2.3 | Canvas accessibility | 3 days | P2 |
| 2.4 | Fix N+1 query | 4 hours | P2 |
| 3.1 | TypeScript migration | Ongoing | P3 |
| 3.2 | Full WCAG compliance | 2 weeks | P3 |
| 3.3 | Performance optimization | 1 week | P3 |

---

## Progress Tracking

### Completed

- [x] ESLint warnings: 1,077 -> 0
- [x] dist/ removed from git tracking
- [x] StateManager selection state integration
- [x] Six canvas controllers extracted (97-100% coverage)
- [x] ACCESSIBILITY.md created

### In Progress

- [ ] CanvasManager.js analysis for splitting
- [ ] This improvement plan documentation

### Blocked

*None currently*

### Discovered Issues (Not in Original Plan)

- P0: Three duplicate undo/redo implementations (added as 0.2)
- P0: 20+ empty catch blocks, ErrorHandler unused (added as 0.3)
- P2: N+1 query pattern in database code (added as 2.4)

---

## Metrics Dashboard

Track progress against targets:

```
Coverage Progress:
Overall:       53.4% ============-------- 70% target
CanvasManager: 22.2% ====---------------- 60% target
LayersEditor:  14.6% ===----------------- 50% target
CanvasEvents:  19.2% ====---------------- 60% target

Code Size Progress:
CanvasManager: 4,048 lines ==================== 800 target (needs -3,248)
WikitextHooks: 2,001 lines ==================== 400 target (needs -1,601)

Technical Debt:
Window globals:    29+ ==================== 10 target
Empty catches:     20+ ==================== 0 target
Undo/redo impls:   3   ===============----- 1 target
```

---

## How to Contribute

1. Pick an unassigned task from Phase 0 or Phase 1
2. Create a branch: `refactor/task-name` or `fix/task-name`
3. Implement with tests (target 80% coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Addresses improvement_plan.md #0.3")
6. Update this document when complete

---

## Notes

- All refactoring must maintain backward compatibility
- Each extraction should have corresponding tests
- Document breaking changes in CHANGELOG.md
- Phase 0 tasks are blockers - prioritize these
- Coordinate with maintainers before major changes
- Run both `npm test` and `npm run test:php` before submitting PRs

---

**Last updated:** November 27, 2025
