# Layers Extension - Improvement Plan

**Last Updated:** November 29, 2025  
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
| Jest tests | 1,232 | 1,500+ | +268 |
| Overall Coverage | 53.4% | 70% | +16.6% |
| Core Module Coverage | 14-22% | 60% | +38-46% |
| CanvasManager.js lines | 3,523 | <800 | -2,723 |
| WikitextHooks.php lines | 2,001 | <400 | -1,601 |
| ESLint errors | 0 | 0 | ✅ Met |
| Window.* exports | 49 | <10 | -39 |
| Empty catch blocks | 0 | 0 | ✅ Met |
| Dead code variables | 0 | 0 | ✅ Met |
| Misleading docs | No | No | ✅ Met |

**Recent Progress (Nov 29, 2025):**
- Fixed 4 empty catch blocks (all now have comments or logging)
- Removed 4 dead performance variables from CanvasManager
- Removed dead undoStack/redoStack from LayersEditor
- Rewrote MODULAR_ARCHITECTURE.md to reflect actual (not aspirational) state
- Extracted ImageLoader.js module (~280 lines) with comprehensive tests
- Removed 464 lines of fallback code from CanvasManager (3,987 → 3,523 lines)
- Fixed LayersConstants dependency timing issue in LayersEditor.js
- Test count increased from 1,202 to 1,232 (+30 tests)

---

## Phase 0: Critical Fixes (P0)

### 0.1 Split CanvasManager.js God Class

**Priority:** P0 - CRITICAL  
**Status:** ⏳ In Progress (~25% complete)  
**Effort:** 1 week (40 hours)  
**Risk:** HIGH

**Problem:** 3,523 lines (down from 3,987) with many methods violates SOLID principles. Only 22.24% coverage.

**Impact:** High regression risk, harder to test, blocks new contributors, debugging nightmare.

**Progress:**
- ✅ ImageLoader.js extracted (~280 lines) - handles background image loading with fallbacks
- ✅ Fallback code removed (-464 lines) - controllers are guaranteed to load in ResourceLoader

**Proposed Extraction (Remaining):**

| New Module | Est. Lines | Responsibilities | Priority |
|------------|------------|------------------|----------|
| CanvasCore.js | ~600 | Canvas setup, context, resize, init | First |
| InteractionController.js | ~800 | Mouse/touch events, drag handling | Second |
| RenderCoordinator.js | ~500 | Render scheduling, dirty regions | Third |
| DrawingModeController.js | ~400 | Tool state machine, drawing state | Fourth |

**Note:** SelectionController extraction may not be needed - SelectionManager.js already exists but is underutilized. Consider making CanvasManager delegate to it instead.

**Existing Good Extractions (97-100% coverage):**
- ZoomPanController.js (343 lines)
- GridRulersController.js (385 lines)
- TransformController.js (965 lines)
- HitTestController.js (382 lines)
- DrawingController.js (620 lines)
- ClipboardController.js (222 lines)
- ImageLoader.js (280 lines)

**Tasks:**
- [x] Remove fallback implementations that duplicate controller logic (-464 lines)
- [ ] Map all remaining methods to proposed modules
- [ ] Extract CanvasCore.js with init(), resize(), setupContext()
- [ ] Extract InteractionController.js with event handlers
- [ ] Extract RenderCoordinator.js with performRedraw()
- [ ] Update CanvasManager to compose extracted modules
- [ ] Add tests for each extracted module (target 80% coverage)
- [ ] Verify all existing tests still pass

**Dependencies:** None

---

### 0.2 Remove Dead Performance Code OR Implement It

**Priority:** P0 - CRITICAL  
**Status:** ✅ COMPLETE  
**Effort:** 2 hours (chose remove option)  
**Risk:** LOW

**Resolution:** Removed all 4 dead performance variables. Added comment pointing to this plan for future implementation if needed.

```javascript
// Note: Performance optimizations like dirty region tracking and layer caching
// can be added in RenderCoordinator.js when needed. See improvement_plan.md #0.2
```

---

### 0.3 Remove Dead Undo/Redo Stacks from LayersEditor

**Priority:** P0 - HIGH  
**Status:** ✅ COMPLETE  
**Effort:** 30 minutes  
**Risk:** LOW

**Resolution:** Removed dead undoStack/redoStack variables. HistoryManager is the single source of truth.

---

### 0.4 Fix Remaining 4 Empty Catch Blocks

**Priority:** P0 - HIGH  
**Status:** ✅ COMPLETE  
**Effort:** 1 hour  
**Risk:** LOW

**Resolution:** All empty catch blocks now have `/* ignore */` comments or logging. ESLint passes.

---

### 0.5 Fix Misleading Documentation

**Priority:** P0 - HIGH  
**Status:** ✅ COMPLETE  
**Effort:** 2 hours  
**Risk:** LOW

**Resolution:** Completely rewrote MODULAR_ARCHITECTURE.md to accurately reflect the current state. Removed false claims about non-existent features.

---

## Phase 1: High Priority (P1)

### 1.1 Split WikitextHooks.php and Eliminate Duplication

**Priority:** P1 - HIGH  
**Status:** ⏳ Not Started  
**Effort:** 2 days  
**Risk:** MEDIUM

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

**Tasks:**
- [ ] Identify duplicated regex and attribute injection code
- [ ] Create LayersHtmlInjector with `injectLayersAttributes($html, $options)` method
- [ ] Extract ImageLinkProcessor with onImageBeforeProduceHTML logic
- [ ] Extract ThumbnailProcessor with thumbnail hooks
- [ ] Update WikitextHooks to delegate to new classes
- [ ] Add PHPUnit tests for extracted classes
- [ ] Verify all wikitext embedding scenarios still work

---

### 1.2 Consolidate Event Systems

**Priority:** P1 - HIGH  
**Status:** ⏳ Not Started  
**Effort:** 3 days  
**Risk:** HIGH

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

---

### 1.3 Increase Core Module Coverage to 50%+

**Priority:** P1 - HIGH  
**Status:** ⏳ Not Started  
**Effort:** 3 days  
**Risk:** LOW

**Current Coverage Gaps:**

| File | Current | Target | Gap |
|------|---------|--------|-----|
| CanvasManager.js | 22.24% | 50% | +27.76% |
| LayersEditor.js | 14.62% | 50% | +35.38% |
| CanvasEvents.js | 19.15% | 50% | +30.85% |

**Tasks:**
- [ ] Add CanvasManager tool switching tests
- [ ] Add CanvasManager render cycle tests
- [ ] Add LayersEditor initialization tests
- [ ] Add LayersEditor save workflow tests
- [ ] Add CanvasEvents mouse event tests
- [ ] Update jest.config.js coverage thresholds
- [ ] Add coverage gates to CI pipeline

**Note:** Coverage improvement is easier AFTER 0.1 (CanvasManager split).

---

### 1.4 Complete StateManager Migration

**Priority:** P1 - HIGH  
**Status:** ⏳ Not Started  
**Effort:** 2 days  
**Risk:** MEDIUM

**Problem:** StateManager exists but components bypass it, leading to inconsistent state.

**Components Bypassing StateManager:**

| Component | Local State | Should Use StateManager |
|-----------|-------------|------------------------|
| CanvasManager | selectedLayerIds, currentTool, zoom, pan | Yes |
| LayerPanel | Sometimes calls canvas directly | Yes |
| Toolbar | Direct canvas manipulation | Yes |

**Tasks:**
- [ ] Move CanvasManager zoom/pan state to StateManager
- [ ] Move currentTool state to StateManager
- [ ] Ensure LayerPanel always reads from StateManager
- [ ] Add state change subscriptions where needed
- [ ] Remove duplicate state variables
- [ ] Add tests for state consistency

---

## Phase 2: Medium Priority (P2)

### 2.1 Migrate to ES Modules

**Priority:** P2 - MEDIUM  
**Status:** ⏳ Not Started  
**Effort:** 1 week  
**Risk:** MEDIUM

**Problem:** IIFE pattern with 48 window.* exports (250 total window. references) blocks modern tooling.

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

---

### 2.2 Remove Silent Constant Fallbacks

**Priority:** P2 - MEDIUM  
**Status:** ⏳ Not Started  
**Effort:** 4 hours  
**Risk:** LOW

**Problem:** Constants fail silently with fallback values, masking configuration issues.

**Current Pattern (found 10+ times):**

```javascript
const LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
this.minZoom = uiConsts ? uiConsts.MIN_ZOOM : 0.1;
```

**Tasks:**
- [ ] Create centralized constants getter with validation
- [ ] Replace all fallback patterns with centralized getter
- [ ] Add clear error messages when constants missing
- [ ] Document required ResourceLoader dependencies

---

### 2.3 Implement Canvas Accessibility Workaround

**Priority:** P2 - MEDIUM  
**Status:** ⏳ Not Started  
**Effort:** 3 days  
**Risk:** LOW

**Problem:** `<canvas>` is inaccessible to screen readers.

**Proposed Solution:** Create a screen-reader-only layer list that mirrors canvas content.

**Tasks:**
- [ ] Add visually-hidden layer description list
- [ ] Sync descriptions with canvas layer changes
- [ ] Add `aria-live="polite"` for layer updates
- [ ] Add keyboard navigation for layer selection
- [ ] Test with NVDA and VoiceOver
- [ ] Document in ACCESSIBILITY.md

---

### 2.4 Fix PHP Code Style Warnings

**Priority:** P2 - LOW  
**Status:** ⏳ Not Started  
**Effort:** 2 hours  
**Risk:** LOW

**Current Warnings:**
- Comments formatting (SpaceBeforeSingleLineComment)
- Line length exceeding 120 characters
- assertEmpty usage in tests

**Tasks:**
- [ ] Run `npm run fix:php`
- [ ] Fix remaining warnings manually
- [ ] Consider adding phpcs to CI with strict mode

---

## Phase 3: Long Term (P3)

### 3.1 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** ⏳ Not Started  
**Effort:** Ongoing  
**Risk:** LOW

**Approach:** New code only, gradual migration.

**Tasks:**
- [ ] Add tsconfig.json with strict settings
- [ ] Create shared types: `types/Layer.ts`, `types/Tool.ts`
- [ ] Write new features in TypeScript
- [ ] Add .ts file handling to webpack
- [ ] Document TypeScript conventions
- [ ] Migrate one existing file as proof of concept

**Dependencies:** 2.1 (ES Modules) recommended first

---

### 3.2 Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW  
**Status:** ⏳ Not Started  
**Effort:** 2 weeks  
**Risk:** MEDIUM

**Tasks:**
- [ ] Color contrast audit of all UI elements
- [ ] Implement high contrast mode
- [ ] Add skip links to main regions
- [ ] Comprehensive keyboard navigation
- [ ] Screen reader testing (NVDA, VoiceOver, JAWS)
- [ ] Create accessibility conformance statement
- [ ] Document all keyboard shortcuts in UI

**Dependencies:** 2.3 (Canvas accessibility)

---

### 3.3 Performance Profiling and Optimization

**Priority:** P3 - LOW  
**Status:** ⏳ Not Started  
**Effort:** 1 week  
**Risk:** LOW

**Tasks:**
- [ ] Profile with Chrome DevTools
- [ ] Implement layer caching for unchanged layers
- [ ] Add virtual scrolling to layer panel (for >50 layers)
- [ ] Optimize path rendering for complex shapes
- [ ] Add performance metrics logging
- [ ] Document performance benchmarks

**Dependencies:** Decision from 0.2 (implement or remove dirty regions)

---

## Phase 4: Future Features (Backlog)

These features have been requested but should be implemented **after P0-P1 fixes** are complete to avoid building on an unstable foundation.

### 4.1 Layer Set Management: Delete and Rename

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 3-5 days  
**Risk:** MEDIUM  
**Requested:** November 29, 2025

**Problem:** Users can create named layer sets but cannot delete or rename them.

**Proposed Design:**

#### Delete Layer Set
- **Permission model:**
  - Only the original author can delete their own layer sets
  - Users with `deletelayersets` right (new) can delete any set
  - Sysops inherit `deletelayersets` by default
- **Behavior:**
  - Deleting a set removes ALL revisions permanently (hard delete)
  - Show confirmation dialog warning about permanent data loss
  - Log deletion to MediaWiki logging system for audit trail
- **Edge cases:**
  - If author account is deleted, only sysops can delete orphaned sets
  - Cannot delete the last/only set for an image (must have at least one)

#### Rename Layer Set
- **Permission model:** Same as delete (author + `deletelayersets` right)
- **Behavior:**
  - Rename updates `ls_name` in database
  - Preserves all revision history under new name
  - Update any cached references

**Implementation Tasks:**
- [ ] Add new API module: `ApiLayersDelete.php`
- [ ] Add new API module: `ApiLayersRename.php`
- [ ] Add `deletelayersets` right to `extension.json`
- [ ] Add permission checks (author verification via `ls_user_id`)
- [ ] Add UI: Delete button with confirmation dialog
- [ ] Add UI: Rename button with input dialog
- [ ] Add MediaWiki logging entries for audit trail
- [ ] Update frontend StateManager for set changes
- [ ] Add i18n messages for new UI elements
- [ ] Write tests for new API endpoints

**Database considerations:**
- Delete: `DELETE FROM layer_sets WHERE ls_name = ? AND ls_img_name = ?`
- Rename: `UPDATE layer_sets SET ls_name = ? WHERE ls_name = ? AND ls_img_name = ?`

**Related configuration:**
- `$wgLayersMaxRevisionsPerSet` (default: 25) - already implemented, 25 is adequate

---

### 4.2 Revision History UI Improvements

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 1 day  
**Risk:** LOW  
**Requested:** November 29, 2025

**Problem:** Revision dropdown may show revisions from all sets instead of filtering by active set.

**Verification needed:** Check if `buildRevisionSelector()` in LayersEditor.js correctly filters by current set name.

**Tasks:**
- [ ] Verify revision filtering works correctly (may already be implemented)
- [ ] If not, update `buildRevisionSelector()` to filter by `currentSetName`
- [ ] Add visual indicator showing "X of Y revisions" for current set
- [ ] Consider adding revision diff/compare feature (future)

---

## Quick Reference: Priority Summary

### Must Do (P0) - Before Production Release

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| 0.1 | Split CanvasManager.js | 1 week | HIGH | ⏳ ~16% |
| 0.2 | Remove dead perf code | 2 hours | LOW | ✅ Done |
| 0.3 | Remove dead undo/redo stacks | 30 min | LOW | ✅ Done |
| 0.4 | Fix 4 empty catch blocks | 1 hour | LOW | ✅ Done |
| 0.5 | Fix misleading documentation | 2 hours | LOW | ✅ Done |

**P0 Progress:** 4/5 complete. Only 0.1 (CanvasManager split) remains.

### Should Do (P1) - Next Sprint

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| 1.1 | Split WikitextHooks.php | 2 days | MEDIUM | ⏳ |
| 1.2 | Consolidate event systems | 3 days | HIGH | ⏳ |
| 1.3 | Increase core coverage to 50% | 3 days | LOW | ⏳ |
| 1.4 | Complete StateManager migration | 2 days | MEDIUM | ⏳ |

**Total P1 Effort:** ~2 weeks

### Nice to Have (P2-P3)

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 2.1 | ES Modules migration | 1 week | P2 | ⏳ |
| 2.2 | Remove silent fallbacks | 4 hours | P2 | ⏳ |
| 2.3 | Canvas accessibility | 3 days | P2 | ⏳ |
| 2.4 | Fix PHP style warnings | 2 hours | P2 | ⏳ |
| 3.1 | TypeScript migration | Ongoing | P3 | ⏳ |
| 3.2 | Full WCAG compliance | 2 weeks | P3 | ⏳ |
| 3.3 | Performance optimization | 1 week | P3 | ⏳ |

---

## Completed Tasks (Archive)

### Session: November 29, 2025

- [x] P0.2: Dead performance variables removed from CanvasManager
- [x] P0.3: Dead undoStack/redoStack removed from LayersEditor  
- [x] P0.4: All 4 empty catch blocks fixed with comments
- [x] P0.5: MODULAR_ARCHITECTURE.md completely rewritten
- [x] ImageLoader.js extracted (~280 lines) from CanvasManager
- [x] ImageLoader.test.js added (30+ tests)
- [x] Fixed LayersConstants dependency timing issue in LayersEditor bootstrap
  - Added `areEditorDependenciesReady()` function for pre-instantiation checks
  - Hook listener now defers if dependencies not ready
  - Auto-bootstrap retries up to 20 times (1 second total) waiting for dependencies
- [x] Removed 464 lines of fallback code from CanvasManager (3,987 → 3,523)
  - Simplified delegation to controllers (HitTestController, TransformController, ZoomPanController)
  - Controllers guaranteed to load before CanvasManager via ResourceLoader module order
  - Added minimal defensive guards for test environments where controllers may not be initialized
  - Updated tests (ResizeHandles.test.js, RotationHandle.test.js) to load required controllers
- [x] Test count: 1,202 → 1,232 (+30)

### Previously Completed

- [x] ESLint errors: 1,077 -> 0
- [x] dist/ removed from git tracking
- [x] StateManager selection state integration
- [x] Six canvas controllers extracted (97-100% coverage)
- [x] ACCESSIBILITY.md created
- [x] ErrorHandler integration (6 call sites)
- [x] Integration tests for save/load (24 tests)
- [x] Undo/redo routing consolidated to HistoryManager
- [x] Empty catch blocks reduced from 20+ to 4
- [x] Security TODOs audited (no issues found)
- [x] N+1 query already fixed in LayersDatabase

---

## Metrics Dashboard

Track progress against targets:

```
Coverage Progress:
Overall:       53.4% ============-------- 70% target
CanvasManager: 22.2% ====---------------- 50% target
LayersEditor:  14.6% ===----------------- 50% target
CanvasEvents:  19.2% ====---------------- 50% target

Code Size Progress:
CanvasManager: 3,987 lines ==================== 800 target (needs -3,187)
WikitextHooks: 2,001 lines ==================== 400 target (needs -1,601)

Technical Debt:
Window.* exports:  49 ==================== 10 target
Empty catches:     4  ====---------------- 0 target
Dead code vars:    4  ====---------------- 0 target
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

**Last updated:** November 29, 2025
