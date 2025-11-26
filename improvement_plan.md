# Layers Extension - Improvement Plan

**Last Updated:** November 26, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Priority Legend

- 🔴 **P0 - Critical:** Production blockers, security issues - must fix before any release
- 🟠 **P1 - High:** Significant impact on maintainability or reliability
- 🟡 **P2 - Medium:** Quality of life improvements, technical debt reduction
- 🟢 **P3 - Low:** Nice to have, long-term improvements

---

## Phase 0: Immediate Security & Cleanup (THIS WEEK)

### 0.1 🔴 P0: Remove Production Debug Logging from PHP

**Problem:** `file_put_contents()` and `error_log()` calls in production code create security and performance risks.

**Files to fix:**
- `src/Api/ApiLayersSave.php` (lines 87, 101, 130, 328-357)
- `src/Database/LayersDatabase.php` (lines 77, 83, 87)

**Tasks:**
- [x] Remove all `file_put_contents( $logFile, ... )` calls from `ApiLayersSave.php`
- [x] Remove all `error_log( "LAYERS DEBUG..." )` calls from both files
- [x] Replace with `$this->logger->debug()` or `wfDebugLog( 'Layers', ... )` guarded by config
- [x] Delete the `layers.log` file if it exists
- [x] Verify debug logging respects `$wgLayersDebug` config flag
- [x] Test that saves still work after changes

**Estimated Effort:** 2 hours  
**Risk:** Low - straightforward removal
**Status:** ✅ COMPLETE (November 26, 2025)

---

### 0.2 🔴 P0: Remove Console Logging from JavaScript

**Problem:** 20+ `console.log()` statements expose internal details to users.

**Files to fix:**
- `resources/ext.layers.editor/LayersEditor.js` (lines 1453-1507, ~20 statements)
- `resources/ext.layers.editor/UIManager.js` (line 484)

**Tasks:**
- [x] Remove or convert all `console.log()` to `mw.log()` with debug guard
- [x] Ensure bootstrap debugging uses `this.debugLog()` pattern
- [x] Search for any other `console.log|warn|error` in resources/**
- [x] Run `npm test` to verify no regressions

**Estimated Effort:** 1 hour  
**Risk:** Low
**Status:** ✅ COMPLETE (November 26, 2025)

---

### 0.3 🟠 P1: Clean Up Unused Dependencies

**Problem:** `zustand` (5.0.8) is installed but appears unused.

**Tasks:**
- [x] Search codebase for any `zustand` or `store.js` usage
- [x] If unused, remove from `package.json` and delete `store.js`
- [x] If intended for future use, document in README or comment
- [x] Run `npm install` to update lockfile

**Estimated Effort:** 30 minutes  
**Risk:** Low
**Status:** ✅ COMPLETE (November 26, 2025)

---

## Phase 1: Critical Refactoring (Week 1-2)

### 1.1 🔴 P0: Complete CanvasManager.js Extraction

**Current State:** 3,877 lines → Partially extracted to `ZoomPanController.js` (334 lines), `GridRulersController.js` (385 lines), and `TransformController.js` (745 lines)

**Target Structure:**
```
resources/ext.layers.editor/
├── canvas/
│   ├── README.md              # ✅ Created - documents architecture
│   ├── ZoomPanController.js   # ✅ Extracted - zoom/pan/viewport
│   ├── GridRulersController.js # ✅ Extracted - grid/rulers/guides
│   ├── TransformController.js  # ✅ Extracted - resize/rotation/drag
│   ├── CanvasEventHandler.js  # ⬜ Extract - mouse/touch/keyboard events
│   └── HitTestController.js   # ⬜ Extract - selection hit testing
├── CanvasManager.js           # Reduced to ~800 lines as facade
```

**Tasks:**
- [x] Create `canvas/` directory structure
- [x] Extract `ZoomPanController.js`
- [x] Extract `GridRulersController.js`
- [x] Extract `TransformController.js` (~745 lines)
  - [x] Move `calculateRectangleResize()` and similar methods
  - [x] Move resize handle hit-testing
  - [x] Move rotation logic
  - [x] Move drag logic with multi-selection support
- [ ] Extract `CanvasEventHandler.js` (~400 lines)
  - [ ] Move mouse event handlers
  - [ ] Move touch event handlers
  - [ ] Move keyboard handlers
- [ ] Extract `HitTestController.js` (~200 lines)
  - [ ] Move layer hit testing
  - [ ] Move handle hit testing
- [ ] Remove fallback code from CanvasManager once extraction complete
- [x] Update extension.json ResourceModules
- [ ] Add unit tests for each new controller
- [x] Run full test suite to verify no regressions (184 tests pass)

**Estimated Effort:** 5 days  
**Risk:** High - core functionality, needs extensive testing

---

### 1.2 🔴 P0: Consolidate State Management

**Problem:** State scattered across StateManager, LayerPanel, CanvasManager.

**Solution:** Make `StateManager.js` the single source of truth.

**Tasks:**
- [ ] Audit all `this.layers =` usage (found in LayerPanel lines 20, 452, 550, 1749)
- [ ] Audit all `this.selectedLayerId =` usage (found in LayerPanel line 773, CanvasManager lines 46, 2220, 2372, 2390, 2400, 2427, 2431)
- [ ] Create StateManager subscriptions for LayerPanel
- [ ] Create StateManager subscriptions for CanvasManager
- [ ] Replace direct state mutations with StateManager.set()
- [ ] Remove local state copies from LayerPanel and CanvasManager
- [ ] Add state change debugging (when debug enabled)
- [ ] Test multi-selection works correctly
- [ ] Test layer panel updates when canvas selection changes
- [ ] Test canvas updates when layer panel selection changes

**Estimated Effort:** 3 days  
**Risk:** Medium - affects data flow throughout app

---

### 1.3 🟠 P1: Improve Test Infrastructure

**Current State:**
- 184 Jest tests exist and pass
- ESLint enabled for Jest tests ✅
- PHPUnit tests exist for API and validation
- No coverage metrics or thresholds

**Tasks:**
- [ ] Add Jest coverage configuration to `jest.config.js`
- [ ] Set minimum coverage threshold (start at 50%, increase over time)
- [ ] Add coverage reporting to CI/CD (if applicable)
- [ ] Add PHPUnit coverage configuration
- [ ] Create `tests/phpunit/integration/` directory
- [ ] Add integration test for full save/load cycle
- [ ] Add integration test for API rate limiting
- [ ] Add validation edge case tests:
  - [ ] XSS attempt in text layer
  - [ ] Max layer count exceeded
  - [ ] Max payload size exceeded
  - [ ] Invalid color values
  - [ ] Duplicate layer IDs

**Estimated Effort:** 3 days  
**Risk:** Low - improves confidence

---

## Phase 2: Code Quality (Week 3-4)

### 2.1 🟠 P1: Extract LayerPanel Components

**Current State:** 1,875 lines with embedded dialogs and forms.

**Target Structure:**
```
resources/ext.layers.editor/
├── ui/
│   ├── ColorPickerDialog.js   # ~200 lines - color picker widget
│   ├── PropertiesForm.js      # ~400 lines - property editor
│   ├── LayerListItem.js       # ~150 lines - single layer row
│   └── ConfirmDialog.js       # ~100 lines - confirmation modal
├── LayerPanel.js              # Reduced to ~600 lines as composition
```

**Tasks:**
- [ ] Extract `ColorPickerDialog.js` from `createPropertiesForm()`
- [ ] Extract `PropertiesForm.js` with section builders
- [ ] Extract `LayerListItem.js` for layer row rendering
- [ ] Extract `ConfirmDialog.js` for delete confirmations
- [ ] Refactor LayerPanel.js to compose these components
- [ ] Add unit tests for each component
- [ ] Verify accessibility features preserved (focus trap, ARIA)

**Estimated Effort:** 3 days  
**Risk:** Medium - UI components with accessibility requirements

---

### 2.2 🟠 P1: Add JSDoc Types

**Approach:** Gradual adoption starting with public APIs.

**Tasks:**
- [ ] Add JSDoc to `LayersEditor.js` public methods
- [ ] Add JSDoc to `StateManager.js` methods
- [ ] Add JSDoc to all canvas/ controller methods
- [ ] Create `types/layers.d.ts` for layer object shape
- [ ] Configure VS Code `jsconfig.json` to use types
- [ ] Add JSDoc to API response handlers
- [ ] Document configuration object shapes

**Example:**
```javascript
/**
 * @typedef {Object} Layer
 * @property {string} id - Unique layer identifier
 * @property {'text'|'rectangle'|'circle'|...} type - Layer type
 * @property {number} x - X position
 * @property {number} y - Y position
 * ...
 */
```

**Estimated Effort:** 4 days  
**Risk:** Low - documentation only

---

### 2.3 🟠 P1: Consolidate Constants

**Problem:** Magic numbers scattered across files despite `LayersConstants.js` existing.

**Tasks:**
- [ ] Audit `CanvasManager.js` for hardcoded values:
  - [ ] `this.minZoom = 0.1` → `LayersConstants.ZOOM.MIN`
  - [ ] `this.maxZoom = 5.0` → `LayersConstants.ZOOM.MAX`
  - [ ] `this.maxHistorySteps = 50` → `LayersConstants.LIMITS.MAX_HISTORY`
  - [ ] `this.maxPoolSize = 5` → `LayersConstants.LIMITS.MAX_POOL_SIZE`
  - [ ] `this.zoomAnimationDuration = 300` → `LayersConstants.UI.ANIMATION.ZOOM_DURATION`
- [ ] Audit `LayerPanel.js` for hardcoded values
- [ ] Audit `Toolbar.js` for hardcoded values
- [ ] Add missing constants to `LayersConstants.js`
- [ ] Update all usages to reference constants

**Estimated Effort:** 1 day  
**Risk:** Low

---

### 2.4 🟠 P1: Remove Code Duplication

**Problem:** Similar logic exists in multiple files.

**Duplication Map:**

| Concern | Primary File | Duplicates | Action |
|---------|--------------|------------|--------|
| Rendering | `CanvasRenderer.js` | `CanvasManager.js` (delegators) | Remove pass-through methods |
| Events | `CanvasEvents.js` | `EventHandler.js`, `EventManager.js` | Consolidate or document roles |
| Selection | `SelectionManager.js` | `CanvasManager.js`, `LayerPanel.js` | Single source of truth |

**Tasks:**
- [ ] Document the intended role of each event-related file
- [ ] Remove or merge `EventHandler.js` if redundant
- [ ] Remove pass-through methods from `CanvasManager.js`:
  - [ ] `drawText()`, `drawRectangle()`, `drawCircle()`, etc.
- [ ] Make `SelectionManager.js` the single selection authority
- [ ] Update `LayerPanel.js` to use SelectionManager
- [ ] Update `CanvasManager.js` to use SelectionManager

**Estimated Effort:** 3 days  
**Risk:** Medium

---

## Phase 3: User Experience & Quality (Week 5-6)

### 3.1 🟡 P2: Accessibility Improvements

**Current State:**
- Some ARIA roles present
- Focus trap in color picker ✅
- Keyboard shortcuts for layer reorder ✅
- Many gaps remain

**Tasks:**
- [ ] Add skip links for keyboard users
- [ ] Add `aria-live` regions for status updates (save, selection changes)
- [ ] Complete keyboard navigation for all tools
- [ ] Ensure all buttons have `aria-label` or visible text
- [ ] Add high contrast mode support (respect system preference)
- [ ] Test with NVDA/VoiceOver screen readers
- [ ] Document keyboard shortcuts in help dialog
- [ ] Add `role="application"` to canvas container
- [ ] Provide text alternatives for color-only information

**Estimated Effort:** 4 days  
**Risk:** Medium - requires accessibility testing expertise

---

### 3.2 🟡 P2: Performance Optimization

**Current State:**
- `dirtyRegion` property defined but unused
- Full canvas redraws on every change
- No layer caching

**Tasks:**
- [ ] Implement dirty region tracking in `CanvasRenderer`
- [ ] Only redraw layers that intersect dirty region
- [ ] Add layer rendering cache (skip unchanged layers)
- [ ] Debounce property panel updates during drag operations
- [ ] Use `requestAnimationFrame` consistently
- [ ] Profile with Chrome DevTools
- [ ] Document performance benchmarks
- [ ] Consider offscreen canvas for complex layers

**Estimated Effort:** 3 days  
**Risk:** Medium - rendering changes need visual testing

---

### 3.3 🟡 P2: Standardize Error Handling

**Problem:** Inconsistent patterns across frontend code.

**Tasks:**
- [ ] Create error handling utility in `ErrorHandler.js`:
  - [ ] `ErrorHandler.showUserError(messageKey)` - user-facing
  - [ ] `ErrorHandler.logError(error, context)` - debug logging
  - [ ] `ErrorHandler.captureException(error)` - future telemetry hook
- [ ] Replace all `console.error` with `ErrorHandler.logError`
- [ ] Replace all raw `mw.notify` errors with `ErrorHandler.showUserError`
- [ ] Add error boundaries around major components
- [ ] Ensure all API failures show user-friendly messages
- [ ] Document error handling patterns in README

**Estimated Effort:** 2 days  
**Risk:** Low

---

## Phase 4: Architecture Improvements (Month 2)

### 4.1 🟢 P3: ES Modules Migration

**Problem:** IIFE pattern prevents tree-shaking and explicit dependencies.

**Current:**
```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;
}());
```

**Target:**
```javascript
import { StateManager } from './StateManager.js';
import { CanvasRenderer } from './CanvasRenderer.js';

export class CanvasManager {
    constructor( config ) { ... }
}
```

**Tasks:**
- [ ] Update webpack config for ES modules
- [ ] Convert `LayersConstants.js` first (no dependencies)
- [ ] Convert utility files (`GeometryUtils.js`, `ErrorHandler.js`)
- [ ] Convert managers (`StateManager.js`, `SelectionManager.js`)
- [ ] Convert controllers (`ZoomPanController.js`, etc.)
- [ ] Convert main files (`CanvasManager.js`, `LayersEditor.js`)
- [ ] Update `extension.json` ResourceModules configuration
- [ ] Enable tree-shaking in webpack
- [ ] Verify MediaWiki ResourceLoader compatibility

**Estimated Effort:** 5 days  
**Risk:** High - affects entire frontend build

---

### 4.2 🟢 P3: TypeScript Migration

**Approach:** Incremental migration after ES modules.

**Tasks:**
- [ ] Set up TypeScript build pipeline
- [ ] Create `tsconfig.json` with strict settings
- [ ] Start with `StateManager.ts` (well-defined interface)
- [ ] Create shared types (`types/Layer.ts`, `types/Tool.ts`)
- [ ] Migrate canvas controllers to TypeScript
- [ ] Migrate UI components
- [ ] Enable strict type checking
- [ ] Update CI to type-check

**Estimated Effort:** 2 weeks  
**Risk:** High - requires build system changes

---

### 4.3 🟢 P3: Component Library Extraction

**Opportunity:** Reusable components could be extracted.

**Candidates:**
- `ColorPickerDialog` - reusable color picker
- `ConfirmDialog` - generic confirmation modal
- `ResizablePanel` - panel with drag handles
- `LayerListItem` - could be a generic sortable list item

**Tasks:**
- [ ] Evaluate if components should be a separate package
- [ ] Consider Storybook for component documentation
- [ ] Create component testing in isolation
- [ ] Document component APIs

**Estimated Effort:** 1 week  
**Risk:** Low - nice to have

---

## Named Layer Sets Feature (In Progress)

> **Design Document:** `docs/NAMED_LAYER_SETS.md`  
> **Implementation Plan:** `docs/IMPLEMENTATION_PLAN_NAMED_SETS.md`

The Named Layer Sets feature allows multiple named annotation sets per image with version history.

### Key Features
- **Named Sets**: Up to 15 named annotation sets per image (e.g., "default", "anatomy-labels")
- **Version History**: Up to 25 revisions stored per named set
- **Direct Linking**: `[[File:Example.jpg|layers=anatomy-labels]]`

### Implementation Status
| Phase | Description | Status |
|-------|-------------|--------|
| Database | Schema + migration | ✅ Complete |
| API Backend | layersinfo/layerssave updates | ✅ Complete |
| Frontend | Set selector UI | 🟡 In Progress |
| Parser | Wikitext `layers=` parameter | ⬜ Not Started |
| Testing | Integration tests | ⬜ Not Started |

---

## Progress Summary

| Phase | Status | Priority Items Remaining |
|-------|--------|-------------------------|
| 0. Security Cleanup | ✅ 100% | All tasks completed |
| 1. Critical Refactoring | 🟡 60% | CanvasEventHandler, HitTestController, State consolidation |
| 2. Code Quality | ⬜ Not Started | LayerPanel components, JSDoc, Deduplication |
| 3. User Experience | ⬜ Not Started | Accessibility, Performance, Error handling |
| 4. Architecture | ⬜ Not Started | ES Modules, TypeScript |

---

## Quick Reference: High-Impact Tasks

### Completed (November 26, 2025)
1. ~~Remove `file_put_contents()` from `ApiLayersSave.php`~~ ✅
2. ~~Remove `error_log()` debug statements from PHP~~ ✅
3. ~~Remove `console.log()` from JavaScript~~ ✅
4. ~~Remove unused `zustand` dependency~~ ✅
5. ~~Extract `TransformController.js` (resize/rotation/drag)~~ ✅

### Next Up (P0/P1 - Maintainability)
6. Extract CanvasEventHandler.js (mouse/touch/keyboard events)
7. Extract HitTestController.js (selection hit testing)
8. Consolidate state to StateManager
9. Add test coverage metrics

### Next Month (P1/P2 - Quality)
10. Extract LayerPanel components
11. Add JSDoc types
12. Improve accessibility

---

## How to Contribute

1. Pick a task from Phase 0 or Phase 1 (critical items first)
2. Create a branch: `feature/improve-{task-name}` or `fix/{task-name}`
3. Implement changes with tests
4. Run `npm test` and `npm run test:php` before committing
5. Submit PR with reference to this plan

---

## Notes

- All refactoring should maintain backward compatibility
- Each change should have corresponding tests
- Document any breaking changes in CHANGELOG
- Phase 0 tasks are security-related and should be prioritized
- Coordinate with maintainers before starting major refactoring tasks

---

*Last updated: November 26, 2025*
