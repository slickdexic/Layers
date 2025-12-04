# Layers Extension - Improvement Plan

**Last Updated:** December 3, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

**Current State:** The extension is functional with strong security and test coverage. Key blockers are architectural: god classes, global pollution, and state fragmentation.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Blocks development/quality | This week |
| **P1** | High - Significant quality impact | 2-4 weeks |
| **P2** | Medium - Quality improvements | 1-2 months |
| **P3** | Low - Nice to have | 3+ months |

---

## Current Metrics (Verified December 3, 2025)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,510 | 1,500+ | ✅ Met |
| Test suites | 57 | 40+ | ✅ Met |
| Statement coverage | 91% | 80% | ✅ Met |
| CanvasManager.js lines | 1,930 | <800 | 🔴 141% over |
| LayersEditor.js lines | 1,815 | <800 | 🔴 127% over |
| Toolbar.js lines | 745 | <500 | 🟡 49% over |
| WikitextHooks.php lines | 775 | <400 | 🟡 94% over |
| init.js lines | 201 | <400 | ✅ Met |
| Window.* exports | 56 | <15 | 🔴 273% over |
| Silent catch blocks | 0 | 0 | ✅ Fixed |
| ESLint errors | 0 | 0 | ✅ Met |

**Recent Progress (December 3, 2025):**
- Toolbar.js: 1,621 → 745 lines (-876 lines, 54% reduction achieved)
  - ColorPickerDialog delegation: -234 lines
  - msg() → MessageHelper delegation: -224 lines
  - Import/Export → ImportExportManager extraction: -77 lines
  - Style controls → ToolbarStyleControls extraction: -341 lines
- New modules created:
  - ToolbarKeyboard.js: 161 lines (keyboard shortcuts)
  - ImportExportManager.js: 288 lines (40 tests)
  - ToolbarStyleControls.js: 694 lines (62 tests)
  - MessageHelper.test.js: 37 tests
- Jest tests: 2,384 → 2,510 (+126 new tests)

---

## Phase 0: Critical (P0) — This Week

### P0.1 Fix Documentation Accuracy

**Priority:** P0 - CRITICAL  
**Status:** ✅ COMPLETE  
**Effort:** 2-3 hours  
**Risk:** None  
**Notes:** Audit completed; verified README, docs, and extension i18n messages for correctness, marking aspirational features as 'Planned'.

**Problem:** Documentation contains inaccurate or aspirational claims that mislead developers.

**Issues Fixed:**

| Document | Issue | Resolution |
|----------|-------|------------|
| README.md | "Layer IDs: 01–FF" | Updated to describe UUID-based IDs |
| README.md | "Layers can be grouped and nested" | Moved to "Planned Features" |
| README.md | "Layer thumbnails auto-generated" | Moved to "Planned Features" |
| README.md | "Merge layers or duplicate with one click" | Clarified: duplicate works, merge planned |
| README.md | Wikitext syntax examples | Updated to match actual `layers=on/setname/none` syntax |
| README.md | Architecture section | Updated with accurate metrics and technology stack |

**Tasks:**
**Tasks:**
- [x] Add deprecation comments to `layersModuleRegistry` alias
- [x] Update LayersEditor.js to prefer `layersRegistry` with deprecation warning
- [x] Document canonical export names in code comments
- [x] Add `compat.js` shim with runtime deprecation warnings
- [ ] Plan / write codemods for alias removal
- [x] Line counts updated where visible to users
- [x] Aspirational features clearly marked

---

### P0.2 Consolidate Window Exports

**Priority:** P0 - HIGH  
**Status:** 🟡 In Progress  
**Effort:** 1-2 hours  
**Risk:** LOW (aliases only)  
**Notes:** Plan a phased migration to ES modules with compatibility shims and deprecation timeline. Added a `compat.js` shim which warns on legacy `window.*` names during runtime; also added console warnings where legacy aliases are created. Next steps: add codemods to automatically migrate alias usages and start partial ES module migrations for leaf utilities.

**Problem:** Legacy compatibility exports cause confusion. Note: Investigation revealed classes only export with `Layers` prefix (e.g., `LayersToolManager`), not both prefixed and non-prefixed names. The actual issue was legacy aliases in ModuleRegistry.

**Analysis Result:**

| Export Pattern | Finding |
|----------------|---------|
| `window.LayersToolManager` | Only export - no duplicate |
| `window.LayersSelectionManager` | Only export - no duplicate |
| `window.LayersModuleRegistry` | Class export (keep) |
| `window.layersRegistry` | Primary singleton (keep) |
| `window.layersModuleRegistry` | Legacy alias (deprecated) |
| `window.LayersErrorHandler` | Class export (keep) |
| `window.layersErrorHandler` | Singleton instance (valid pattern) |

**Tasks:**
- [x] Add deprecation comments to `layersModuleRegistry` alias
- [x] Update LayersEditor.js to prefer `layersRegistry` with deprecation warning
- [x] Document canonical export names in code comments

**Acceptance Criteria:**
- [x] Legacy aliases have deprecation comments
- [x] Code prefers non-deprecated exports
- [ ] CI runs tests and passes after migration (expect 2,352 tests)

---

### P0.3 Extract mw.message Helper

**Priority:** P0 - MEDIUM  
**Status:** 🔴 Partially Implemented
**Effort:** 2 hours  
**Risk:** LOW  
**Notes:** `MessageHelper.js` exists but migration of call sites must be completed incrementally

**Problem:** 20+ occurrences of verbose message fallback pattern across multiple files.
### P0.4 Add CI / Gate and Security Scanning

**Priority:** P0 - CRITICAL
**Status:** ✅ COMPLETE
**Effort:** 1 day to add basic checks, 2-3 days for E2E pipeline
**Risk:** LOW

**Problem:** No enforced cross-file or E2E checks. Missing CI gating for PRs and dependency scanning.

**Tasks:**
- [x] Add GitHub Actions for `npm test`, `npm run test:php`, `composer validate`
- [x] Add Playwright smoke E2E job (minimal flows) as gating test
- [x] Add Dependabot for PHP and NPM updates
- [x] Add security scanning for composer and npm vulnerabilities

**Notes:** CI workflows, E2E smoke test, Dependabot config, and CODEOWNERS added. Playwright config and smoke test created.

**Acceptance Criteria:**
- [x] GitHub Actions runs tests on PRs and blocks merge on failure
- [x] Basic Playwright smoke test runs in CI
- [x] Dependabot PRs created for outdated dependencies


**Solution Implemented:**

Created `resources/ext.layers.editor/MessageHelper.js` with:
- `MessageHelper` class with caching support
- `get(key, fallback)` - simple message retrieval
- `getWithParams(key, ...params)` - message with parameter substitution
- `exists(key)` - check if message key exists
- `clearCache()` / `setCacheEnabled(enabled)` - cache management
- Exported as `window.LayersMessageHelper` (class) and `window.layersMessages` (singleton)

**Tasks:**
- [x] Create `MessageHelper.js` with full API
- [x] Add to extension.json script list (first in load order)
- [x] Add Jest tests for MessageHelper (24 tests)
- [ ] Replace 20+ occurrences in Toolbar.js (deferred - low risk)
- [ ] Replace occurrences in other files (deferred - low risk)

**Acceptance Criteria:**
- [x] Single source of truth for message retrieval
- [x] Module available globally
- [x] Tests added to cover MessageHelper behavior and message fallbacks
- [ ] Migration of most call sites to use MessageHelper (incremental)

**Note:** Actual replacement of existing patterns is deferred to P1 to avoid widespread changes. The helper is available for new code and incremental migration.

---

## Phase 1: High Priority (P1) — 2-4 Weeks

### P1.1 Continue CanvasManager Decomposition

**Priority:** P1 - HIGH  
**Status:** � In Progress  
**Effort:** 3-5 days  
**Risk:** MEDIUM  
**Current:** 1,912 lines | **Target:** <800 lines

**Already Extracted (9 controllers, 91-100% coverage):**
- ✅ ZoomPanController.js (341 lines, 100%)
- ✅ DrawingController.js (614 lines, 100%)
- ✅ InteractionController.js (487 lines, 100%)
- ✅ HitTestController.js (376 lines, 99%)
- ✅ ClipboardController.js (220 lines, 99%)
- ✅ GridRulersController.js (383 lines, 98%)
- ✅ RenderCoordinator.js (387 lines, 92%)
- ✅ TransformController.js (1,157 lines, 91%)
- ✅ StyleController.js (~100 lines) - NEW: extracted with updateStyleOptions, applyToLayer

**StyleController Integration (Complete):**
- [x] Created StyleController.js with style management
- [x] CanvasManager delegates to StyleController.updateStyleOptions()
- [x] Removed duplicate updateStyleOptions definition (~110 lines saved)
- [x] Tests pass with StyleController delegation

**Next Extractions:**

| Module | Est. Lines | Source Methods | Risk |
|--------|------------|----------------|------|
| LayerOrderController | ~100 | Already in StateManager | N/A |
| CanvasStateManager | ~200 | State initialization, getters/setters | MEDIUM |

**Tasks:**
- [x] Extract StyleController with stroke/fill methods
- [x] Remove duplicate updateStyleOptions from CanvasManager
- [ ] Migrate remaining state properties to StateManager
- [ ] Continue extracting remaining methods
- [ ] Write additional tests for StyleController (target: 95%+)

**Acceptance Criteria:**
- [ ] CanvasManager.js <1,400 lines (intermediate goal)
- [x] StyleController extracted and integrated
- [x] No functionality regressions (2,408 tests pass)

---

### P1.2 Split Toolbar.js

**Priority:** P1 - HIGH  
**Status:** 🟡 In Progress - Good Progress  
**Effort:** 2-3 days  
**Risk:** LOW  
**Current:** 1,086 lines | **Target:** <500 lines

**Proposed Split:**

| New File | Est. Lines | Responsibilities |
|----------|------------|------------------|
| ToolbarCore.js | ~300 | Base toolbar, button management, layout |
| ToolButtons.js | ~400 | Tool button creation, icons, tooltips |
| StyleControls.js | ~400 | Color picker, stroke, fill, font |
| ViewControls.js | ~200 | Zoom, grid, rulers toggles |
| ToolbarKeyboard.js | ~150 | Keyboard shortcut handling |

**Already Extracted:**
- ✅ ToolbarKeyboard.js (161 lines, 28 tests) - keyboard shortcuts
- ✅ ColorPickerDialog delegation - using existing ui/ColorPickerDialog.js (-234 lines)
- ✅ MessageHelper delegation - msg() now delegates to layersMessages singleton (-224 lines)
- ✅ ImportExportManager.js (288 lines, 40 tests) - import/export functionality (-77 lines)

**Tasks:**
- [ ] Create `ToolbarCore.js` with base functionality
- [ ] Extract tool buttons to `ToolButtons.js`
- [ ] Extract style controls to `StyleControls.js`
- [ ] Extract view controls to `ViewControls.js`
- [x] Extract keyboard handling to `ToolbarKeyboard.js`
- [x] Delegate to existing `ColorPickerDialog` module
- [x] Delegate msg() to MessageHelper singleton
- [x] Extract import/export to ImportExportManager.js
- [ ] Update `Toolbar.js` to compose modules
- [x] Write tests for ToolbarKeyboard module
- [x] Write tests for ImportExportManager module

**Progress:**
- Started: 1,621 lines
- After ColorPickerDialog: 1,387 lines (-234)
- After MessageHelper: 1,163 lines (-224)
- Current: 1,086 lines (-77 import/export)
- **Total reduction: -535 lines (33%)**
- Target: <500 lines (~590 lines remaining to extract)

**Acceptance Criteria:**
- [ ] Toolbar.js <500 lines
- [x] ToolbarKeyboard module with 100% coverage
- [x] ImportExportManager module with tests (40 tests)
- [ ] Each extracted module >85% coverage
- [ ] No UI regressions

---

### P1.3 Complete StateManager Migration

**Priority:** P1 - MEDIUM  
**Status:** 🟡 In Progress
**Effort:** 3-4 days  
**Risk:** MEDIUM  
**Notes:** All primary code paths should use state; add dev-only assertions and tests. Track migration via PR labels and code search.

**Problem:** StateManager exists with proper methods (`addLayer`, `removeLayer`, `updateLayer`, `getLayers`) but ~12 direct `.layers =` assignments bypassed it.

**Solution Implemented:**

Updated all direct `.layers =` assignments to use StateManager with proper fallbacks for test environments:

| File | Change |
|------|--------|
| ToolManager.js | Uses `stateManager.addLayer()` with fallback to `.set('layers', ...)` |
| SelectionManager.js | `deleteSelected()` uses `stateManager.removeLayer()` per layer |
| SelectionManager.js | `duplicateSelected()` uses `stateManager.addLayer()` per layer |
| HistoryManager.js | Undo/restore uses `stateManager.set('layers', ...)` |
| HistoryManager.js | `cancelBatch()` uses `stateManager.set('layers', ...)` |
| Toolbar.js | Import uses `stateManager.set('layers', ...)` |

**Pattern Used:**
```javascript
// Primary: Use StateManager
if ( editor.stateManager ) {
    editor.stateManager.addLayer( layer );
    // or: editor.stateManager.set( 'layers', newLayers );
} else if ( editor ) {
    // Fallback for tests without StateManager
    editor.layers = newLayers;
} else {
    // Fallback for tests without editor
    canvasManager.layers = newLayers;
}
```

**Acceptance Criteria:**
- [x] All primary code paths use StateManager methods
- [x] Fallbacks preserved for test compatibility
 - [ ] CI runs and passes existing tests (expect ~2,352 tests)
- [x] No state desync bugs

---

### P1.4 Extract PHP Shared Services

**Priority:** P1 - LOW  
**Status:** 🔴 Not Started  
### P1.5 Performance Profiling & Benchmarks

**Priority:** P1 - HIGH
**Status:** 🔴 Not Started
**Effort:** 2-4 days
**Risk:** LOW

**Problem:** No profiling and no performance regression tests for rendering/canvas flow. Hard to catch regressions and performance degradations.

**Tasks:**
- [ ] Add microbenchmarks for the canvas rendering (draw n shapes) and capture frame time
- [ ] Add a Playwright scenario that runs 1000 pointer events and measures response time
- [ ] Add a CI job to run benchmarks against a baseline and report regressions

**Acceptance Criteria:**
- Benchmarks added and run in CI; a baseline exists for monitoring regressions
### P1.6 Event Teardown Tests

**Priority:** P1 - HIGH
**Status:** ✅ COMPLETE
**Effort:** 1 day
**Risk:** LOW

**Problem:** Event listeners are not removed; creating and destroying the editor repeatedly increases active listeners and risks memory leaks.

**Tasks:**
- [x] Add tests to create/destroy the editor and assert the number of listeners does not grow
- [x] Add lifecycle `destroy()` hooks to major modules if missing
- [x] Add isDestroyed guards to async callbacks to prevent stateManager access after destroy
- [x] Fix EventTeardown test (safe DOM removal, StateManager fallback guards)

**Acceptance Criteria:**
- [x] No listener growth after repeated create/destroy cycles
- [x] All tests pass (2,356 tests)
**Effort:** 1-2 days  
**Risk:** LOW  

**Problem:** Logger and file resolution code duplicated across 5+ PHP files.

**Services to Create:**

```php
// src/Services/FileResolver.php
class FileResolver {
    public function findFile( string $filename ): ?File {
        $title = Title::newFromText( $filename, NS_FILE );
        if ( !$title ) return null;
        return MediaWikiServices::getInstance()
            ->getRepoGroup()->findFile( $title );
    }
}
```

**Files to Refactor:**
- WikitextHooks.php (3 occurrences)
- ApiLayersSave.php (2 occurrences)
- ApiLayersInfo.php (2 occurrences)
- Hooks.php (1 occurrence)
- Various processors (3+ occurrences)

**Tasks:**
- [ ] Create `FileResolver.php` service
- [ ] Create `LoggerFactory.php` utility
- [ ] Register services in `services.php`
- [ ] Refactor files to use services
- [ ] Add unit tests

**Acceptance Criteria:**
- [ ] No duplicate file resolution code
- [ ] No duplicate logger creation code
- [ ] Services have 100% test coverage

---

## Phase 2: Medium Priority (P2) — 1-2 Months

### P2.1 Begin ES Module Migration

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM  

**Problem:** 54 `window.*` exports prevent modern tooling.

**Migration Strategy — Start with leaf modules (no dependencies):**

| Phase | Files | Risk |
|-------|-------|------|
| Phase 1 | `GeometryUtils.js`, `TextUtils.js`, `LayersConstants.js` | LOW |
| Phase 2 | `ErrorHandler.js`, `ValidationManager.js`, `MessageHelper.js` | LOW |
| Phase 3 | `StateManager.js`, `HistoryManager.js` | MEDIUM |
| Phase 4 | Core classes (future) | HIGH |

**Pattern:**
```javascript
// Before (IIFE)
( function () {
    function GeometryUtils() { ... }
    window.GeometryUtils = GeometryUtils;
}());

// After (ES Module with backward compat)
export const GeometryUtils = { /* methods */ };

// Backward compatibility shim
if ( typeof window !== 'undefined' ) {
    window.GeometryUtils = GeometryUtils;
}
```

**Tasks:**
- [ ] Configure webpack for ES module output alongside IIFE
- [ ] Convert `GeometryUtils.js` (proof of concept)
- [ ] Update ResourceLoader config
- [ ] Test in MediaWiki environment
- [ ] Document pattern for contributors
- [ ] Convert remaining Phase 1 files

**Acceptance Criteria:**
- [ ] At least 5 files converted to ES modules
- [ ] MediaWiki loads modules correctly using ResourceLoader
- [ ] Backcompat shims are in place for a transition period
- [ ] Tooling and tests updated to accommodate ES module builds
- [ ] Pattern documented in CONTRIBUTING.md

---

### P2.2 Canvas Accessibility

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** LOW  

**Problem:** Canvas is inherently inaccessible to screen readers.

**Implementation:**
```html
<!-- Hidden container for screen readers -->
<div class="layers-sr-only" role="region" aria-live="polite" aria-label="Layer annotations">
    <ul id="layers-sr-list">
        <li>Text layer: "Label 1" at position 100, 200</li>
        <li>Arrow from 50, 50 to 150, 150</li>
    </ul>
</div>
```

**Tasks:**
- [ ] Add visually-hidden layer description container
- [ ] Sync descriptions with canvas changes
- [ ] Add `aria-live="polite"` for dynamic updates
- [ ] Implement keyboard layer navigation (Tab, Arrow keys)
- [ ] Add keyboard shortcuts help dialog (Shift+?)
- [ ] Test with NVDA and VoiceOver
- [ ] Update `docs/ACCESSIBILITY.md`

**Acceptance Criteria:**
- [ ] Screen readers announce layer info
- [ ] Keyboard navigation works for all operations
- [ ] ARIA attributes properly applied
- [ ] WCAG 2.1 A criteria met for canvas interactions

---

### P2.3 Split LayersDatabase.php

**Priority:** P2 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1-2 days  
**Risk:** LOW  
**Current:** 829 lines | **Target:** <400 lines per file

**Proposed Split:**

| New File | Est. Lines | Responsibilities |
|----------|------------|------------------|
| LayersDatabase.php | ~200 | Core DB operations, connection management |
| LayerSetRepository.php | ~300 | CRUD for layer sets, named sets |
| LayerRevisionRepository.php | ~200 | Revision queries, pruning |
| LayerQueryBuilder.php | ~150 | Complex query construction |

**Tasks:**
- [ ] Extract LayerSetRepository with set CRUD
- [ ] Extract LayerRevisionRepository with revision queries
- [ ] Keep core DB operations in LayersDatabase
- [ ] Update all callers to use appropriate class
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Each file <400 lines
- [ ] Clear separation of concerns
- [ ] All existing tests pass
- [ ] New tests for extracted classes

---

### P2.4 Add Database Performance Index

**Priority:** P2 - LOW  
**Status:** ✅ COMPLETE  
**Effort:** N/A  

**Resolution:** Index already exists in `sql/patches/patch-idx-layer-sets-named.sql`:
```sql
CREATE INDEX idx_layer_sets_named 
ON layer_sets (ls_img_name, ls_img_sha1, ls_name, ls_timestamp DESC);
```

---

## Phase 3: Long Term (P3) — 3+ Months

### P3.1 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** Ongoing  
**Dependencies:** P2.1 (ES Modules)

**Strategy:** Incremental adoption
1. Add `tsconfig.json` with `allowJs: true`
2. Create type definitions for core interfaces (`Layer`, `Tool`, `Event`)
3. New features written in TypeScript
4. Gradually convert existing files

**Tasks:**
- [ ] Add `tsconfig.json` configuration
- [ ] Create `types/` directory with interfaces
- [ ] Configure webpack for `.ts` files
- [ ] Migrate one utility file as proof of concept
- [ ] Document TypeScript conventions

---

### P3.2 Full E2E Test Suite

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks  

**Tests to Add:**
- [ ] Layer creation (all 11 types)
- [ ] Layer manipulation (move, resize, rotate)
- [ ] Undo/redo workflow
- [ ] Named layer sets
- [ ] Revision history
- [ ] Import/export
- [ ] Multi-layer selection
- [ ] Keyboard shortcuts
- [ ] Save/load persistence

**Tools:** Playwright or Cypress with MediaWiki Docker environment

---

### P3.3 Delete/Rename Layer Set API

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 3-5 days  

**Tasks:**
- [ ] Add `ApiLayersDelete.php`
- [ ] Add `ApiLayersRename.php`
- [ ] Add `deletelayersets` permission
- [ ] Add UI: Delete button with confirmation
- [ ] Add UI: Rename button with input
- [ ] Add MediaWiki logging entries
- [ ] Write tests

---

## Known Bugs

Tracked bugs requiring investigation and fixes.

### BUG-001: Rectangle resize corner drift (FIXED)

**Severity:** Low  
**Component:** TransformController  
**Status:** ✅ Fixed (December 3, 2025)  
**Reported:** December 3, 2025

**Description:**  
When resizing a **rotated** rectangle object by dragging one of the corner handles, the opposite corner (which should remain anchored) drifts during the resize operation.

**Root Cause:**  
The `applyRotatedResizeCorrection()` function in TransformController only applied position corrections for edge handles (n, s, e, w). Corner handles (nw, ne, sw, se) were explicitly skipped with `default: return;`, causing the opposite corner to drift on rotated shapes.

**Fix Applied:**  
Extended `applyRotatedResizeCorrection()` to handle corner handles. The fix calculates the world-space position of the opposite corner before and after resize, then applies a position correction to keep the opposite corner anchored.

**Files Changed:**  
- `resources/ext.layers.editor/canvas/TransformController.js` - Added corner handle cases to both switch statements in `applyRotatedResizeCorrection()`
- `tests/jest/RotatedResize.test.js` - Updated test to expect correction for corner handles

---

### BUG-002: Revision history shows all layer-sets

**Severity:** Medium  
**Component:** LayersEditor / APIManager  
**Status:** ✅ Fixed  
**Reported:** December 3, 2025  
**Fixed:** December 3, 2025

**Description:**  
The revision history panel displays revisions from ALL layer-sets for an image, rather than filtering to show only revisions belonging to the currently active layer-set.

**Root Cause:**  
Two issues:
1. PHP API (`ApiLayersInfo.php`) was returning ALL revisions in `all_layersets` regardless of which set was loaded
2. JS client wasn't using `set_revisions` (set-specific revisions) when available

**Fix Applied:**  
1. Updated `ApiLayersInfo.php` to filter `all_layersets` by current set name using `getSetRevisions()`
2. Updated `APIManager.js` `loadLayersBySetName()` to prefer `set_revisions` over `all_layersets`

**Files Changed:**
- `src/Api/ApiLayersInfo.php`
- `resources/ext.layers.editor/APIManager.js`

---

### BUG-003: No layer-set deletion or permissions management

**Severity:** Medium  
**Component:** API / LayersEditor  
**Status:** 🔴 Open (Feature Gap)  
**Reported:** December 3, 2025

**Description:**  
There is currently no way to:
1. Delete an existing layer-set
2. Manage permissions for layer-sets (owner controls, special permissions)

**Expected Behavior:**  
- Users should be able to delete layer-sets they own (or admins can delete any)
- Layer-sets should support ownership and permission controls (who can edit, who can view)

**Likely Location:**  
- New API module needed: `ApiLayersDelete.php`
- Permission checks in `ApiLayersSave.php`
- UI controls in `LayersEditor.js` or new management panel

**Notes:**  
This is a feature gap documented in `docs/NAMED_LAYER_SETS.md` as future work.

---

### BUG-004: False dirty state on selection without modification

**Severity:** Low  
**Component:** LayersEditor / StateManager  
**Status:** ✅ Fixed  
**Reported:** December 3, 2025  
**Fixed:** December 3, 2025

**Description:**  
When selecting an object (without making any modifications), then switching layer-set or clicking Cancel/X, the editor incorrectly prompts with a "Save changes?" dialog even though no actual changes were made.

**Root Cause:**  
`TransformController.finishDrag()` unconditionally called `markDirty()` even when no actual drag movement occurred. Clicking on a layer triggers `startDrag()` then `finishDrag()`, marking dirty even for simple selection clicks.

**Fix Applied:**  
Modified `TransformController.finishDrag()` to only call `markDirty()` if actual movement occurred (detected via `showDragPreview` flag which is only set in `handleDrag()` when movement happens).

**Files Changed:**
- `resources/ext.layers.editor/canvas/TransformController.js`

---

### BUG-005: Selection persists across layer-set switches

**Severity:** Low  
**Component:** LayersEditor / SelectionManager  
**Status:** ✅ Fixed  
**Reported:** December 3, 2025  
**Fixed:** December 3, 2025

**Description:**  
When an object is selected in one layer-set, then switching to a different layer-set that happens to have an object with the same ID, the object remains visually selected. Selection state should be cleared when switching layer-sets.

**Root Cause:**  
Two issues:
1. API loading methods didn't clear selection before rendering new layers
2. `SelectionManager.notifySelectionChange()` didn't sync selection state to StateManager, so UI components (LayerPanel) reading from StateManager saw stale data

**Fix Applied:**  
1. Added `selectionManager.clearSelection()` calls in all three API loading methods
2. Added StateManager sync in `notifySelectionChange()` to keep `selectedLayerIds` in sync

**Files Changed:**
- `resources/ext.layers.editor/APIManager.js`
- `resources/ext.layers.editor/SelectionManager.js`

---

## Quick Reference

### P0 — This Week (Critical)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P0.1 | Fix documentation accuracy | 2-3 hours | None | ✅ |
| P0.2 | Consolidate window exports | 1-2 hours | LOW | 🟡 |
| P0.3 | Extract mw.message helper | 2 hours | LOW | 🟡 |
| P0.4 | Add CI gating and security scanning | 1-3 days | LOW | ✅ |

### P1 — 2-4 Weeks (High)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P1.1 | Continue CanvasManager decomposition | 3-5 days | MEDIUM | 🟡 |
| P1.2 | Split Toolbar.js | 2-3 days | LOW | 🔴 |
| P1.3 | Complete StateManager migration | 3-4 days | MEDIUM | 🟡 |
| P1.4 | Extract PHP shared services | 1-2 days | LOW | 🔴 |
| P1.5 | Performance profiling & benchmarks | 2-4 days | LOW | 🔴 |
| P1.6 | Event teardown tests | 1 day | LOW | ✅ |

### P2 — 1-2 Months (Medium)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P2.1 | ES Modules migration | 1-2 weeks | MEDIUM | 🔴 |
| P2.2 | Canvas accessibility | 3-4 days | LOW | 🔴 |
| P2.3 | Split LayersDatabase.php | 1-2 days | LOW | 🔴 |
| P2.4 | Database index | N/A | N/A | ✅ |

### P3 — 3+ Months (Low)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P3.1 | TypeScript migration | Ongoing | LOW | 🔴 |
| P3.2 | Full E2E test suite | 1-2 weeks | LOW | 🔴 |
| P3.3 | Delete/Rename API | 3-5 days | LOW | 🔴 |

---

## Future Features (Roadmap)

These are planned feature enhancements that will elevate the Layers extension to a more comprehensive image annotation and editing tool. They are documented here to maintain vision clarity while current refactoring work continues.

### FEATURE-001: Base Image as Editable Layer

**Priority:** P3  
**Effort:** 1-2 weeks  
**Status:** 📋 Planned

**Description:**  
Transform the background/source image into a proper bottom layer that can be:
- Opacity-adjusted (0-100%)
- Made completely invisible
- Locked/unlocked like other layers
- Shown in the layer panel with controls

**Benefits:**
- Enables "tracing" workflows where users draw over semi-transparent reference images
- Allows layer-only exports without the original image
- Consistent layer model throughout the application

**Technical Considerations:**
- Base image currently rendered directly in `CanvasManager.renderBackground()`
- Need to introduce a special "background" layer type
- Layer panel needs to show the base image layer (always at bottom, non-deletable)
- Viewer and wikitext rendering need to respect base image opacity

---

### FEATURE-002: Image Import as Layer

**Priority:** P3  
**Effort:** 2-3 weeks  
**Status:** 📋 Planned

**Description:**  
Allow users to import external images as new layers that can be:
- Dragged/positioned anywhere on the canvas
- Scaled (proportionally or freely)
- Rotated
- Adjusted for opacity
- Layered above/below other content

**Benefits:**
- Enables composite image creation
- Allows adding logos, icons, reference images
- Supports complex annotation workflows

**Technical Considerations:**
- New layer type: `image` with properties: `src`, `x`, `y`, `width`, `height`, `rotation`, `opacity`
- Image data storage options:
  - Store as data URI in layer data (simple but increases payload size)
  - Reference MediaWiki File: pages (cleaner but requires file existence checks)
  - Hybrid: support both with preference for File: references
- Resize handles should maintain aspect ratio by default (shift to unlock)
- Security: validate image sources, prevent external URL injection
- Server-side rendering for thumbnails will need ImageMagick compositing

---

### FEATURE-003: Paragraph Text Boxes with Styling

**Priority:** P3  
**Effort:** 2-3 weeks  
**Status:** 📋 Planned

**Description:**  
Introduce a new "textbox" layer type distinct from current single-line text:
- Container that holds paragraph text
- Resizing the box reflows text (does NOT change font size)
- Text wraps within the box boundaries
- Multiple text bubble/box styles available

**Text Bubble Styles:**
- Plain rectangle (default)
- Rounded rectangle
- Speech bubble (with pointer)
- Thought bubble (cloud shape)
- Callout arrow
- Custom border styles

**Benefits:**
- Proper text annotations for longer descriptions
- Comic/manga-style speech bubbles
- Professional callout annotations
- Better text layout control

**Technical Considerations:**
- New layer type: `textbox` with properties:
  - `text`: string (multiline)
  - `x`, `y`, `width`, `height`: box dimensions
  - `bubbleStyle`: 'rectangle' | 'rounded' | 'speech' | 'thought' | 'callout'
  - `pointerDirection`: for speech/callout bubbles
  - `padding`: inner spacing
  - `fontSize`, `fontFamily`, `color`, `backgroundColor`
- Text rendering: canvas `fillText` with manual word-wrapping
- Resize behavior: only reflow text, never scale font
- Edit mode: inline text editing within the box

---

### Future Feature Ideas (Backlog)

Additional features to consider for future development:

| Feature | Description | Priority |
|---------|-------------|----------|
| Layer groups | Group multiple layers for collective operations | P3 |
| Layer effects | Drop shadows, glows, filters per layer | P3 |
| Measurement tool | Draw lines that show pixel/unit distances | P3 |
| Annotation templates | Save/load common annotation patterns | P3 |
| Collaborative editing | Real-time multi-user annotation | P4 |
| Version comparison | Visual diff between layer set revisions | P3 |
| Keyboard-only mode | Full accessibility without mouse | P2 |
| Touch gestures | Pinch-to-zoom, two-finger pan on mobile | P3 |

---

## Visual Dashboard

```
JavaScript God Classes:
CanvasManager.js:  █████████████████████████████░░ 1,899/800 lines (237%) 🔴
LayersEditor.js:   ████████████████████████████░░░ 1,756/800 lines (219%) 🔴
Toolbar.js:        ███████████████████████████░░░░ 1,678/800 lines (210%) 🔴

PHP Complexity:
WikitextHooks.php: ███████████████████░░░░░░░░░░░░   775/400 lines (194%) 🟡
LayersDatabase.php:████████████████████░░░░░░░░░░░   829/500 lines (166%) 🟡

Completed Refactors:
init.js:           █████░░░░░░░░░░░░░░░░░░░░░░░░░░   201/400 lines  (50%) ✅

Test Coverage:
Overall:           █████████████████████████░░░░░░ 91%   (target: 80%) ✅

Global Exports:
window.* assigns:  ██████████████████████████████░░  54   (target: <15) 🔴
```

---

## Success Criteria

**Phase 0 Complete When:**
- All documentation accurately reflects implementation
- Duplicate exports deprecated with warnings
- Message helper extracted and in use

**Phase 1 Complete When:**
- CanvasManager.js < 1,400 lines
- Toolbar.js < 500 lines (split into modules)
- StateManager used exclusively for state
- PHP services extracted and tested

**Phase 2 Complete When:**
- At least 5 files converted to ES modules
- Canvas accessible via keyboard and screen readers
- LayersDatabase split into focused classes

---

## How to Contribute

1. Pick an unassigned task (start with P0)
2. Create a branch: `improve/P0.1-doc-accuracy`
3. Implement with tests (target 90%+ coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Addresses improvement_plan.md P0.1")
6. Update this document when complete

7. Ensure CI runs and all jobs pass before requesting merge
8. Keep PRs small and focused (one controller or one small module per PR)
9. For large refactors, open a design PR and solicit review from `CODEOWNERS` before implementation

---

## Notes

- **P0 tasks should be completed before feature development**
- Add a `CODEOWNERS` file to solicit review from core maintainers for PRs touching god classes.
- Add `CHANGELOG.md` entry requirement for breaking or major API changes.
- All refactoring must maintain backward compatibility
- Each extraction should have corresponding tests
- Document breaking changes in CHANGELOG.md
- Run both `npm test` and `npm run test:php` before PRs

---

*Plan created by GitHub Copilot on December 3, 2025*
