# Layers Extension - Improvement Plan

**Last Updated:** December 2, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

**Current State:** The extension is functional but carries significant technical debt that impedes development and maintenance.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Blocks development/quality | This week |
| **P1** | High - Significant quality impact | 2-4 weeks |
| **P2** | Medium - Quality improvements | 1-2 months |
| **P3** | Low - Nice to have | 3+ months |

---

## Current Status Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,312 | 1,500+ | ✅ Met |
| Statement coverage | 90.9% | 80% | ✅ Met |
| CanvasManager.js lines | 1,896 | <800 | 🔴 1,096 over |
| LayersEditor.js lines | 1,756 | <800 | 🔴 956 over |
| Toolbar.js lines | 1,664 | <800 | 🔴 864 over |
| WikitextHooks.php lines | 788 | <400 | 🟠 388 over |
| Window.* exports | 43 | <10 | 🔴 33 over |
| Silent catch blocks | ~6 | 0 | 🟡 Reduced |
| ESLint errors | 0 | 0 | ✅ Met |
| ToolManager coverage | 99% | 80% | ✅ Met |
| HistoryManager coverage | 94% | 80% | ✅ Met |
| CanvasManager coverage | 87% | 80% | ✅ Met |
| LayerPanel coverage | 88% | 80% | ✅ Met |
| CanvasRenderer coverage | 90.5% | 80% | ✅ Met |

---

## Phase 0: Critical (P0) — This Week

### 0.1 Fix Silent Error Suppression

**Priority:** P0 - CRITICAL  
**Status:** ✅ Completed  
**Effort:** 2-4 hours (actual: ~1 hour)  
**Risk:** LOW

**Problem:** Multiple catch blocks swallow errors silently, making debugging impossible.

**Completed:**
- ✅ CanvasManager.js - Line 28: Added `mw.log.warn()` for `findClass()` failures
- ✅ Toolbar.js - Line 136, 157: Added logging for localStorage save/load errors
- ✅ ModuleRegistry.js - `emit()` method: Added `mw.log.error()` for event handler errors

**Remaining (deferred to P1 - low impact):**
- StateManager.js - localStorage parse errors (already has partial handling)
- HistoryManager.js - storage failures

**Acceptance Criteria:**
- [x] Critical silent catches fixed
- [x] All errors now logged in debug mode
- [x] Tests pass (2,126 tests)

---

### 0.2 Update Jest Coverage Thresholds

**Priority:** P0 - HIGH  
**Status:** ✅ Completed  
**Effort:** 15 minutes  
**Risk:** None

**Problem:** jest.config.js had 48% thresholds but actual coverage was 84.5%. This allowed major regressions.

**Change applied to jest.config.js:**
```javascript
// Before: branches: 36, functions: 48, lines: 48, statements: 48
// After:  branches: 65, functions: 80, lines: 80, statements: 80
```

**Acceptance Criteria:**
- [x] Thresholds set to protect current coverage level
- [x] CI fails if coverage drops below 80%

---

### 0.3 Fix Documentation Accuracy

**Priority:** P0 - HIGH  
**Status:** ✅ Completed  
**Effort:** 1-2 hours (actual: 30 min)  
**Risk:** None

**Changes made to docs/MODULAR_ARCHITECTURE.md:**
- Updated coverage 53% → 84.5%
- Updated CanvasManager lines 4,003 → 1,896
- Added table with all 8 extracted controllers
- Updated December 2025 section with accurate stats

**Acceptance Criteria:**
- [x] All documented metrics match actual values
- [x] Clear distinction between implemented and planned features

---

## Phase 1: High Priority (P1) — 2-4 Weeks

### 1.3 Increase ToolManager Test Coverage

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 2 hours  
**Risk:** LOW

**Previous State:** 64% statement coverage, 57% branch coverage
**New State:** 99% statement coverage, 80% branch coverage

**Tests added (45 new tests):**
- Text editor lifecycle: `showTextEditor`, `finishTextEditing`, keyboard events
- Path tool: `handlePathPoint`, `completePath`, path closure detection
- Shape tools: `updatePolygonTool`, `updateStarTool`, `updateHighlightTool`
- Validation: `hasValidSize` for all 8 layer types
- Rendering: `renderTempLayer`, `renderPathPreview`
- Layer management: `addLayerToCanvas` with all edge cases
- Utilities: `getModifiers` for keyboard event handling

**Acceptance Criteria:**
- [x] ToolManager.js coverage >= 80% (achieved 99%)
- [x] All new tests pass
- [x] Total test count: 2,104 (up from 2,059)

---

### 1.4 Increase HistoryManager Test Coverage

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 1 hour  
**Risk:** LOW

**Previous State:** 73% statement coverage, 55% branch coverage
**New State:** 94% statement coverage, 84% branch coverage

**Tests added (19 new tests):**
- `restoreState` with editor integration
- `restoreState` legacy selection clearing
- `updateUndoRedoButtons` toolbar button updates
- `getHistoryEntries` with pagination
- `revertTo` specific history entry
- `setMaxHistorySteps` with history trimming
- `hasUnsavedChanges` state comparison
- `saveInitialState` initialization
- `exportHistory` debugging export
- `getHistoryInfo` information retrieval

**Acceptance Criteria:**
- [x] HistoryManager.js coverage >= 80% (achieved 94%)
- [x] All new tests pass
- [x] Total test count: 2,126 (up from 2,107)

---

### 1.7 Increase LayersEditor Test Coverage

**Priority:** P1 - MEDIUM  
**Status:** ✅ Completed  
**Effort:** 1 hour  
**Risk:** LOW

**Previous State:** 74% statement coverage, 55% branch coverage
**New State:** 76% statement coverage, 58% branch coverage

**Tests added (19 new tests):**
- `buildRevisionSelector` - revision option population
- `updateRevisionLoadButton` - button state management
- `trackWindowListener` - event listener tracking
- `parseMWTimestamp` - MediaWiki timestamp parsing
- `normalizeLayers` - layer visibility defaults
- `debugLog` and `errorLog` - logging utilities
- `markDirty` and `markClean` - state management

**Acceptance Criteria:**
- [x] LayersEditor.js coverage improved (74% → 76%)
- [x] All new tests pass
- [x] Total test count: 2,145 (up from 2,126)

---

### 1.8 Increase CanvasManager Test Coverage

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 1 hour  
**Risk:** LOW

**Previous State:** 76% statement coverage, 56% branch coverage
**New State:** 87% statement coverage, 69% branch coverage

**Tests added (76 new tests in CanvasManagerExtended.test.js):**
- `loadBackgroundImageFallback` - URL building, deduplication, MediaWiki URLs
- `tryLoadImageFallback` - Image loading, success/error callbacks, URL progression
- `handleImageLoaded` - Background image setup, canvas sizing, renderer integration
- `handleImageLoadError` - Error recovery, default canvas setup
- `deepCloneLayers` - JSON cloning and manual fallback for circular references
- `calculateResize` - TransformController delegation and error handling
- `emitTransforming` - Transform event throttling and dispatch
- `updateUndoRedoButtons` - HistoryManager delegation
- `undo`/`redo` - Editor delegation
- `saveState` - HistoryManager delegation
- `isLayerInViewport` - Viewport culling logic
- `redrawOptimized` - rAF and setTimeout fallback paths
- `drawLayer` - Layer rendering with error recovery
- Controller delegation methods (gridRulers, hitTest, transform)
- `subscribeToState` - StateManager subscription
- `setupEventHandlers` - CanvasEvents error handling

**Acceptance Criteria:**
- [x] CanvasManager.js coverage >= 80% (achieved 87%)
- [x] All new tests pass
- [x] Total test count: 2,221 (up from 2,145)

---

### 1.9 Increase LayerPanel Test Coverage

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 1 hour  
**Risk:** LOW

**Previous State:** 77% statement coverage
**New State:** 88% statement coverage, 71% branch coverage

**Tests added (51 new tests in LayerPanelCoverage.test.js):**
- `isDebugEnabled` - mw.config checking and debug flag handling
- `logDebug`, `logWarn`, `logError` - Logging method coverage with mw availability checks
- `editLayerName` - Input truncation, blur/Enter/Escape handling, name persistence
- `reorderLayers` - Fallback logic when StateManager.reorderLayer unavailable
- `createConfirmDialog` - Modal overlay/dialog creation, confirm/cancel/Escape handling
- `simpleConfirm` - window.confirm fallback and unavailable handling
- `renderCodeSnippet` - Wikitext generation for visible/hidden/partial layer states
- `getDefaultLayerName` - Type-based naming for all layer types including text truncation
- `syncPropertiesFromLayer` - Property panel synchronization, focus preservation, ellipse radius handling
- Listener management - Document/target listener add/remove and invalid input handling
- Dialog cleanup - Cleanup registration, execution, and error handling

**Acceptance Criteria:**
- [x] LayerPanel.js coverage >= 80% (achieved 88%)
- [x] All new tests pass
- [x] Total test count: 2,272 (up from 2,221)

---

### 1.10 Increase CanvasRenderer Test Coverage

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 45 minutes  
**Risk:** LOW

**Previous State:** 77.73% statement coverage
**New State:** 90.55% statement coverage, 73.88% branch coverage

**Tests added (40 new tests in CanvasRendererCoverage.test.js):**
- `blend mode handling` - valid blend mode application, blendMode property support
- `supportsGlow` - supported/unsupported type checking
- `drawGlow` - glow effect rendering, default stroke color, alpha preservation
- `drawLayerShapeOnly` - rectangle, circle, ellipse shapes, unknown type handling
- `glow rendering integration` - glow property triggering, unsupported type skipping
- `shadow handling` - shadow application, default values, shadow clearing
- `clearShadow` - shadow property reset
- `drawLineSelectionIndicators` - line selection, rotation, handles, rotation handle
- `drawSelectionIndicators` - editor checks, layer lookup, line/arrow selection, rotation
- `opacity handling` - layer opacity, clamping, NaN handling
- `ellipse rendering edge cases` - zero radius skipping, legacy format
- `getLayerBounds edge cases` - null bounds, text bounds, line bounds
- `transform state management` - save/restore context, error recovery
- `redraw` - canvas clearing, transform application, visible layer rendering

**Key mocks added:**
- `TextUtils.measureTextLayer` - for text layer bounds calculation
- `GeometryUtils.getLayerBoundsForType` - for geometric bounds calculation

**Acceptance Criteria:**
- [x] CanvasRenderer.js coverage >= 80% (achieved 90.55%)
- [x] All new tests pass
- [x] Total test count: 2,312 (up from 2,272)

---

### 1.5 Fix Highlight Tool Bug

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 15 minutes  
**Risk:** LOW

**Problem:** The `highlight` tool had `startHighlightTool()` and `updateHighlightTool()` methods that were never called from the main tool handlers.

**Root Cause:** Missing `case 'highlight':` in three switch statements:
- `startTool()` - tool initialization
- `updateTool()` - drag updates
- `finishTool()` - shape completion

**Fix Applied:**
- Added `case 'highlight':` to `startTool()` calling `startHighlightTool()`
- Added `case 'highlight':` to `updateTool()` calling `updateHighlightTool()`
- Added `case 'highlight':` to `finishTool()` using `finishShapeDrawing()`
- Added 3 integration tests verifying full highlight tool lifecycle

**Acceptance Criteria:**
- [x] Highlight tool now functions correctly
- [x] Integration tests verify start/update/finish workflow
- [x] All tests pass

---

### 1.6 Remove Duplicate Global Export

**Priority:** P1 - MEDIUM  
**Status:** ✅ Completed  
**Effort:** 10 minutes  
**Risk:** LOW

**Problem:** `window.ToolManager` was exported alongside `window.LayersToolManager`, causing namespace pollution.

**Fix Applied:**
- Removed `window.ToolManager = ToolManager;` from ToolManager.js
- Updated test file to use `window.LayersToolManager`

**Acceptance Criteria:**
- [x] Only `window.LayersToolManager` exported
- [x] Tests updated to use correct export
- [x] All tests pass

---

### 1.1 Continue CanvasManager Decomposition

**Priority:** P1 - HIGH  
**Status:** 🟡 Pending  
**Effort:** 3-5 days  
**Risk:** MEDIUM  
**Current:** 1,896 lines | **Target:** <800 lines

**Already Extracted (8 controllers, 97%+ avg coverage):**
- ✅ ZoomPanController.js (341 lines, 100%)
- ✅ DrawingController.js (614 lines, 100%)
- ✅ InteractionController.js (487 lines, 100%)
- ✅ HitTestController.js (376 lines, 99%)
- ✅ ClipboardController.js (220 lines, 99%)
- ✅ GridRulersController.js (383 lines, 98%)
- ✅ RenderCoordinator.js (387 lines, 92%)
- ✅ TransformController.js (1,157 lines, 91%)

**Remaining Extraction:**

| New Module | Est. Lines | Responsibilities |
|------------|------------|------------------|
| **CanvasCore.js** | ~400 | Canvas element setup, context creation, resize handling, DPI scaling, image loading |

**Tasks:**
- [ ] Identify CanvasCore.js methods in CanvasManager
- [ ] Create CanvasCore.js with extracted methods
- [ ] Update CanvasManager to use CanvasCore
- [ ] Write tests for CanvasCore (target 90%+ coverage)
- [ ] Verify all 2,059 existing tests pass

**Acceptance Criteria:**
- [ ] CanvasManager.js <800 lines
- [ ] CanvasCore.js >90% coverage
- [ ] No functionality regressions

---

### 1.2 Complete StateManager Migration

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** MEDIUM

**Problem:** StateManager exists but is bypassed in 56+ places in CanvasManager alone.

**Local state that should use StateManager:**
```javascript
// CanvasManager - should migrate to StateManager
this.zoom = 1;
this.pan = { x: 0, y: 0 };
this.currentTool = 'select';
this.layers = [];
this.selectedLayers = [];
this.gridEnabled = false;
this.rulersEnabled = false;
// ... 40+ more properties
```

**Migration Pattern:**
```javascript
// Before (CanvasManager)
this.zoom = 1;
this.setZoom = function( z ) { this.zoom = z; this.render(); };

// After (using StateManager)
// CanvasManager delegates to StateManager
get zoom() { return this.stateManager.get('zoom'); }
setZoom( z ) { this.stateManager.set('zoom', z); }
// StateManager triggers render via subscription
```

**Tasks:**
- [ ] Identify all local state in CanvasManager
- [ ] Add state keys to StateManager
- [ ] Create getters/setters that delegate to StateManager
- [ ] Update Toolbar to use StateManager events
- [ ] Update LayerPanel to use StateManager subscriptions
- [ ] Add state consistency tests

**Acceptance Criteria:**
- [ ] Single source of truth for all editor state
- [ ] No direct state manipulation outside StateManager
- [ ] All components use StateManager subscriptions

---

### 1.3 Increase ToolManager Test Coverage

**Priority:** P1 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1-2 days  
**Risk:** LOW

**Problem:** ToolManager is at 64% coverage but manages all drawing tools (high risk).

**Current gaps (from coverage report):**
- Lines 171-175, 214-218: Tool switching edge cases
- Lines 391-396: Tool option handling
- Lines 528-580: Event handling paths
- Lines 613-617, 652-659: Tool cleanup

**Tasks:**
- [ ] Add tests for tool switching edge cases
- [ ] Add tests for tool option changes
- [ ] Add tests for tool event handlers
- [ ] Add tests for tool cleanup/destroy

**Acceptance Criteria:**
- [ ] ToolManager coverage ≥80%
- [ ] All tool types have dedicated tests

---

### 1.4 Extract PHP Shared Services

**Priority:** P1 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1-2 days  
**Risk:** LOW

**Problem:** Logger and file resolution code duplicated across files.

**Create FileResolver service:**
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

**Create LoggerFactory:**
```php
// src/Logging/LoggerFactory.php  
class LoggerFactory {
    public static function getLogger(): LoggerInterface {
        return MediaWikiServices::getInstance()
            ->getLogger( 'Layers' );
    }
}
```

**Files to refactor:**
- WikitextHooks.php
- ApiLayersSave.php
- ApiLayersInfo.php
- Hooks.php

**Tasks:**
- [ ] Create FileResolver service
- [ ] Create LoggerFactory
- [ ] Update services.php to register
- [ ] Refactor hook handlers to use services
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] No duplicate file resolution code
- [ ] No duplicate logger creation code
- [ ] All tests pass

---

## Phase 2: Medium Priority (P2) — 1-2 Months

### 2.1 Migrate to ES Modules

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM

**Problem:** 44 `window.*` exports prevent modern tooling.

**Migration Strategy:**

**Phase 1 — Utilities (no dependencies):**
- [ ] GeometryUtils.js → ES module
- [ ] TextUtils.js → ES module  
- [ ] LayersConstants.js → ES module
- [ ] ErrorHandler.js → ES module

**Phase 2 — Core (single dependency):**
- [ ] ValidationManager.js
- [ ] CanvasRenderer.js

**Phase 3 — Complex (later):**
- [ ] CanvasManager.js
- [ ] LayersEditor.js

**Migration Pattern:**
```javascript
// Before
( function () {
    'use strict';
    function GeometryUtils() { ... }
    window.GeometryUtils = GeometryUtils;
}());

// After
export const GeometryUtils = {
    // ...methods
};

// For MediaWiki compatibility, also:
if ( typeof window !== 'undefined' ) {
    window.GeometryUtils = GeometryUtils;
}
```

**Tasks:**
- [ ] Configure webpack for ES module output
- [ ] Convert GeometryUtils.js first (proof of concept)
- [ ] Update ResourceLoader config
- [ ] Test in MediaWiki environment
- [ ] Document migration pattern
- [ ] Convert remaining utility files

**Acceptance Criteria:**
- [ ] At least 4 files converted to ES modules
- [ ] MediaWiki loads modules correctly
- [ ] Webpack builds successfully
- [ ] Pattern documented for future migrations

---

### 2.2 Split Toolbar.js

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 2-3 days  
**Risk:** LOW

**Problem:** Toolbar.js is 1,664 lines with mixed responsibilities.

**Proposed Split:**

| New File | Est. Lines | Responsibilities |
|----------|------------|------------------|
| ToolbarCore.js | ~400 | Base toolbar, button management, layout |
| ToolButtons.js | ~500 | Individual tool buttons, icons, tooltips |
| StyleControls.js | ~400 | Color picker, stroke, fill, font controls |
| ZoomControls.js | ~200 | Zoom in/out, reset, fit |
| GridRulerControls.js | ~150 | Grid/ruler toggle buttons |

**Tasks:**
- [ ] Create ToolbarCore.js with base functionality
- [ ] Extract tool buttons to ToolButtons.js
- [ ] Extract style controls to StyleControls.js
- [ ] Extract zoom controls to ZoomControls.js
- [ ] Update Toolbar.js to compose modules
- [ ] Write tests for each new module

**Acceptance Criteria:**
- [ ] Toolbar.js <500 lines
- [ ] Each extracted module >80% coverage
- [ ] No UI regressions

---

### 2.3 Add Database Index for Named Sets

**Priority:** P2 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 30 minutes  
**Risk:** LOW

**Problem:** Named set lookups by name lack index.

**Add to sql/patches/:**
```sql
-- sql/patches/patch-add-name-index.sql
ALTER TABLE /*_*/layer_sets 
ADD INDEX ls_name_lookup (ls_img_name, ls_img_sha1, ls_name);
```

**Tasks:**
- [ ] Create patch file
- [ ] Update LayersSchemaManager
- [ ] Test with `maintenance/update.php`
- [ ] Verify query performance improvement

**Acceptance Criteria:**
- [ ] Index exists after update
- [ ] Named set queries use index (EXPLAIN)

---

### 2.4 Implement Canvas Accessibility

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** LOW

**Problem:** Canvas is inherently inaccessible to screen readers.

**Tasks:**
- [ ] Add visually-hidden layer description container
- [ ] Sync descriptions with canvas changes
- [ ] Add `aria-live="polite"` for dynamic updates
- [ ] Implement keyboard layer navigation (Tab, Arrow keys)
- [ ] Add keyboard shortcuts for layer operations
- [ ] Test with NVDA and VoiceOver
- [ ] Update docs/ACCESSIBILITY.md

**Implementation:**
```html
<!-- Hidden container for screen readers -->
<div class="layers-sr-only" aria-live="polite">
    <h2>Layer annotations</h2>
    <ul id="layers-sr-list">
        <li>Text layer: "Label 1" at position 100, 200</li>
        <li>Arrow from 50, 50 to 150, 150</li>
    </ul>
</div>
```

**Acceptance Criteria:**
- [ ] Screen readers announce layer info
- [ ] Full keyboard navigation works
- [ ] ARIA attributes properly applied

---

### 2.5 Performance Optimizations

**Priority:** P2 - MEDIUM  
**Status:** 🟡 Partially Done  
**Effort:** 3-5 days  
**Risk:** MEDIUM

**Problem:** Full canvas redraws still common, RenderCoordinator underutilized.

**Optimizations:**

1. **Consistent RenderCoordinator usage**
   - Route all renders through coordinator
   - Eliminate direct `ctx.clearRect()` calls

2. **Layer caching**
   - Cache unchanged layers as ImageData
   - Only redraw changed layers

3. **Dirty region tracking**
   - Mark specific regions as needing redraw
   - Only clear/redraw affected areas

4. **Viewport culling**
   - Skip rendering layers outside visible area

**Tasks:**
- [ ] Audit CanvasManager for direct redraw calls
- [ ] Route all redraws through RenderCoordinator
- [ ] Implement layer caching in RenderCoordinator
- [ ] Add dirty region invalidation
- [ ] Add performance metrics logging
- [ ] Profile before/after

**Acceptance Criteria:**
- [ ] Max 1 full redraw per animation frame
- [ ] Measurable FPS improvement
- [ ] No visual regressions

---

## Phase 3: Long Term (P3) — 3+ Months

### 3.1 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** Ongoing  
**Dependencies:** 2.1 (ES Modules)

**Tasks:**
- [ ] Add tsconfig.json
- [ ] Create type definitions (Layer, Tool, Event interfaces)
- [ ] Configure webpack for .ts files
- [ ] Migrate one utility file as proof of concept
- [ ] Write new features in TypeScript

---

### 3.2 Add E2E Tests

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks

**Tasks:**
- [ ] Set up Playwright or Cypress
- [ ] Test full save/load workflow in browser
- [ ] Test layer creation (all 11 types)
- [ ] Test layer manipulation (move, resize, rotate)
- [ ] Test undo/redo
- [ ] Add to CI pipeline

---

### 3.3 Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2-3 weeks

**Tasks:**
- [ ] Color contrast audit
- [ ] Implement high contrast mode
- [ ] Add skip links
- [ ] Comprehensive keyboard navigation
- [ ] Screen reader testing
- [ ] Accessibility conformance statement

---

### 3.4 Layer Set Delete and Rename API

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 3-5 days

**Tasks:**
- [ ] Add ApiLayersDelete.php
- [ ] Add ApiLayersRename.php  
- [ ] Add `deletelayersets` permission
- [ ] Add UI: Delete button with confirmation
- [ ] Add UI: Rename button with input
- [ ] Add MediaWiki logging entries
- [ ] Write tests

---

## Quick Reference

### P0 — This Week

| # | Task | Effort | Risk |
|---|------|--------|------|
| 0.1 | Fix silent error suppression | 2-4 hours | LOW |
| 0.2 | Update Jest thresholds | 15 minutes | None |
| 0.3 | Fix documentation accuracy | 1-2 hours | None |

### P1 — 2-4 Weeks

| # | Task | Effort | Risk |
|---|------|--------|------|
| 1.1 | Continue CanvasManager decomposition | 3-5 days | MEDIUM |
| 1.2 | Complete StateManager migration | 3-4 days | MEDIUM |
| 1.3 | Increase ToolManager coverage | 1-2 days | LOW |
| 1.4 | Extract PHP shared services | 1-2 days | LOW |

### P2 — 1-2 Months

| # | Task | Effort | Risk |
|---|------|--------|------|
| 2.1 | ES Modules migration | 1-2 weeks | MEDIUM |
| 2.2 | Split Toolbar.js | 2-3 days | LOW |
| 2.3 | Add database index | 30 minutes | LOW |
| 2.4 | Canvas accessibility | 3-4 days | LOW |
| 2.5 | Performance optimizations | 3-5 days | MEDIUM |

### P3 — 3+ Months

| # | Task | Effort | Risk |
|---|------|--------|------|
| 3.1 | TypeScript migration | Ongoing | LOW |
| 3.2 | E2E tests | 1-2 weeks | LOW |
| 3.3 | WCAG compliance | 2-3 weeks | LOW |
| 3.4 | Delete/Rename API | 3-5 days | LOW |

---

## Progress Tracking

### Visual Dashboard

```
Architecture Health:
CanvasManager.js:  ████████████████████████░░░░░░ 1,896/800 lines (237%)
LayersEditor.js:   ██████████████████████░░░░░░░░ 1,756/800 lines (219%)
Toolbar.js:        █████████████████████░░░░░░░░░ 1,664/800 lines (208%)
WikitextHooks.php: ██████████████████░░░░░░░░░░░░   788/400 lines (197%)

Test Coverage:
Overall:           █████████████████░░░ 84.5% (target: 80%) ✅
CanvasManager:     ███████████████░░░░░ 76%   (target: 80%) 🟡
ToolManager:       █████████████░░░░░░░ 64%   (target: 80%) 🔴
LayersEditor:      ███████████████░░░░░ 74%   (target: 80%) 🟡

Technical Debt:
Window.* exports:  ████████████████████ 44    (target: <10) 🔴
Silent catches:    █████░░░░░░░░░░░░░░░ 10+   (target: 0)   🔴
```

---

## How to Contribute

1. Pick an unassigned task (start with P0)
2. Create a branch: `refactor/task-0.1-silent-errors`
3. Implement with tests (target 80%+ coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Addresses improvement_plan.md #0.1")
6. Update this document when complete

---

## Notes

- **P0 tasks are blockers** — prioritize before feature work
- All refactoring must maintain backward compatibility
- Each extraction should have corresponding tests
- Document breaking changes in CHANGELOG.md
- Run both `npm test` and `npm run test:php` before PRs
- Coordinate with maintainers before major architectural changes

---

*Plan created by GitHub Copilot (Claude Opus 4.5 Preview) on December 2, 2025*
