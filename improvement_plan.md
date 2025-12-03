# Layers Extension - Improvement Plan

**Last Updated:** December 2, 2025  
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

## Current Metrics (Verified December 2, 2025)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,352 | 1,500+ | ✅ Met |
| Statement coverage | 91% | 80% | ✅ Met |
| CanvasManager.js lines | 1,899 | <800 | 🔴 137% over |
| LayersEditor.js lines | 1,756 | <800 | 🔴 119% over |
| Toolbar.js lines | 1,678 | <800 | 🔴 110% over |
| WikitextHooks.php lines | 775 | <400 | 🟡 94% over |
| init.js lines | 201 | <400 | ✅ Met |
| Window.* exports | 54 | <15 | 🔴 260% over |
| Silent catch blocks | 0 | 0 | ✅ Fixed |
| ESLint errors | 0 | 0 | ✅ Met |

---

## Phase 0: Critical (P0) — This Week

### P0.1 Fix Documentation Accuracy

**Priority:** P0 - CRITICAL  
**Status:** ✅ COMPLETE  
**Effort:** 2-3 hours  
**Risk:** None  
**Completed:** December 2, 2025

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
- [x] Audit README.md for accuracy
- [x] Mark unimplemented features as "Planned" or remove
- [ ] Update line counts in copilot-instructions.md (deferred - minor impact)
- [ ] Add "Documentation Accuracy" section to CONTRIBUTING.md (deferred)

**Acceptance Criteria:**
- [x] All documented features are implemented or marked as "Planned"
- [x] Line counts updated where visible to users
- [x] Aspirational features clearly marked

---

### P0.2 Consolidate Window Exports

**Priority:** P0 - HIGH  
**Status:** ✅ COMPLETE  
**Effort:** 1-2 hours  
**Risk:** LOW (aliases only)  
**Completed:** December 2, 2025

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
- [x] All tests pass (2,352 tests verified)

---

### P0.3 Extract mw.message Helper

**Priority:** P0 - MEDIUM  
**Status:** ✅ COMPLETE  
**Effort:** 2 hours  
**Risk:** LOW  
**Completed:** December 2, 2025

**Problem:** 20+ occurrences of verbose message fallback pattern across multiple files.

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
- [ ] Replace 20+ occurrences in Toolbar.js (deferred - low risk)
- [ ] Replace occurrences in other files (deferred - low risk)
- [ ] Add Jest tests for MessageHelper (deferred)

**Acceptance Criteria:**
- [x] Single source of truth for message retrieval
- [x] Module available globally
- [x] All existing tests pass (2,352 tests verified)

**Note:** Actual replacement of existing patterns is deferred to P1 to avoid widespread changes. The helper is available for new code and incremental migration.

---

## Phase 1: High Priority (P1) — 2-4 Weeks

### P1.1 Continue CanvasManager Decomposition

**Priority:** P1 - HIGH  
**Status:** 🟡 In Progress  
**Effort:** 3-5 days  
**Risk:** MEDIUM  
**Current:** 1,899 lines | **Target:** <800 lines

**Already Extracted (8 controllers, 91-100% coverage):**
- ✅ ZoomPanController.js (341 lines, 100%)
- ✅ DrawingController.js (614 lines, 100%)
- ✅ InteractionController.js (487 lines, 100%)
- ✅ HitTestController.js (376 lines, 99%)
- ✅ ClipboardController.js (220 lines, 99%)
- ✅ GridRulersController.js (383 lines, 98%)
- ✅ RenderCoordinator.js (387 lines, 92%)
- ✅ TransformController.js (1,157 lines, 91%)

**Next Extractions:**

| Module | Est. Lines | Source Methods | Risk |
|--------|------------|----------------|------|
| StyleController | ~150 | `setStroke*`, `setFill*`, style getters | LOW |
| LayerOrderController | ~100 | `moveLayerUp/Down`, `bringToFront/Back` | LOW |
| CanvasStateManager | ~200 | State initialization, getters/setters | MEDIUM |

**Tasks:**
- [ ] Extract StyleController with stroke/fill methods
- [ ] Extract LayerOrderController with ordering methods
- [ ] Migrate state properties to StateManager
- [ ] Write tests for extracted modules (target: 95%+)
- [ ] Update CanvasManager to delegate

**Acceptance Criteria:**
- [ ] CanvasManager.js <1,400 lines (intermediate goal)
- [ ] Each extracted module >90% coverage
- [ ] No functionality regressions

---

### P1.2 Split Toolbar.js

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 2-3 days  
**Risk:** LOW  
**Current:** 1,678 lines | **Target:** <500 lines

**Proposed Split:**

| New File | Est. Lines | Responsibilities |
|----------|------------|------------------|
| ToolbarCore.js | ~300 | Base toolbar, button management, layout |
| ToolButtons.js | ~400 | Tool button creation, icons, tooltips |
| StyleControls.js | ~400 | Color picker, stroke, fill, font |
| ViewControls.js | ~200 | Zoom, grid, rulers toggles |
| ToolbarKeyboard.js | ~150 | Keyboard shortcut handling |

**Tasks:**
- [ ] Create `ToolbarCore.js` with base functionality
- [ ] Extract tool buttons to `ToolButtons.js`
- [ ] Extract style controls to `StyleControls.js`
- [ ] Extract view controls to `ViewControls.js`
- [ ] Extract keyboard handling to `ToolbarKeyboard.js`
- [ ] Update `Toolbar.js` to compose modules
- [ ] Write tests for each new module

**Acceptance Criteria:**
- [ ] Toolbar.js <500 lines
- [ ] Each extracted module >85% coverage
- [ ] No UI regressions

---

### P1.3 Complete StateManager Migration

**Priority:** P1 - MEDIUM  
**Status:** ✅ COMPLETE  
**Effort:** 3-4 days  
**Risk:** MEDIUM  
**Completed:** December 3, 2025

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
- [x] All 2,352 tests pass
- [x] No state desync bugs

---

### P1.4 Extract PHP Shared Services

**Priority:** P1 - LOW  
**Status:** 🔴 Not Started  
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
- [ ] At least 3 files converted to ES modules
- [ ] MediaWiki loads modules correctly
- [ ] Existing tests pass
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

## Quick Reference

### P0 — This Week (Critical)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P0.1 | Fix documentation accuracy | 2-3 hours | None | 🔴 |
| P0.2 | Remove duplicate window exports | 1-2 hours | LOW | 🔴 |
| P0.3 | Extract mw.message helper | 2 hours | LOW | 🔴 |

### P1 — 2-4 Weeks (High)

| # | Task | Effort | Risk | Status |
|---|------|--------|------|--------|
| P1.1 | Continue CanvasManager decomposition | 3-5 days | MEDIUM | 🟡 |
| P1.2 | Split Toolbar.js | 2-3 days | LOW | 🔴 |
| P1.3 | Complete StateManager migration | 3-4 days | MEDIUM | 🔴 |
| P1.4 | Extract PHP shared services | 1-2 days | LOW | 🔴 |

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

---

## Notes

- **P0 tasks should be completed before feature development**
- All refactoring must maintain backward compatibility
- Each extraction should have corresponding tests
- Document breaking changes in CHANGELOG.md
- Run both `npm test` and `npm run test:php` before PRs

---

*Plan created by GitHub Copilot (Claude Opus 4.5 Preview) on December 2, 2025*
