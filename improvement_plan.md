# Layers Extension - Improvement Plan

**Last Updated:** January 2025 (Named Layer Sets Feature)  
**Status:** Active Development - Phase 1 in Progress  
**Related:** See `codebase_review.md` for detailed analysis

---

## 🆕 NEW FEATURE: Named Layer Sets

> **Design Document:** `docs/NAMED_LAYER_SETS.md`  
> **Implementation Plan:** `docs/IMPLEMENTATION_PLAN_NAMED_SETS.md`

The Named Layer Sets feature restructures the layer save system to use named layer sets with version history instead of anonymous revisions.

### Key Features
- **Named Sets**: Up to 15 named annotation sets per image (e.g., "default", "anatomy-labels", "french")
- **Version History**: Up to 25 revisions stored per named set
- **Direct Linking**: `{{#layers:File.jpg|layers=anatomy-labels}}` to embed specific sets
- **Migration Path**: Existing layers automatically become the "default" set

### Implementation Phases
| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1. Database | Migration script, new methods | 2 days | ✅ Migration script created |
| 2. API | Update layersinfo/layerssave | 1-2 days | ⬜ Not started |
| 3. Frontend | Set selector, history panel | 2-3 days | ⬜ Not started |
| 4. Parser | `layers=` parameter | 0.5 days | ⬜ Not started |
| 5. Testing | Unit & integration tests | 1 day | ⬜ Not started |

### Configuration (extension.json)
```json
{
    "LayersMaxNamedSets": 15,
    "LayersMaxRevisionsPerSet": 25,
    "LayersDefaultSetName": "default"
}
```

---

## Priority Legend

- 🔴 **P0 - Critical:** Blocking production use, security issues
- 🟠 **P1 - High:** Significant impact on maintainability or user experience
- 🟡 **P2 - Medium:** Quality of life improvements
- 🟢 **P3 - Low:** Nice to have, long-term improvements

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 🔴 P0: Split CanvasManager.js Monolith

**Current State:** 3,864 lines → **3,864 lines** (CanvasManager) + 334 lines (ZoomPanController) + 385 lines (GridRulersController)
- New modules delegate to CanvasManager for backwards compatibility
- Fallback code preserved in CanvasManager for graceful degradation

**Target Structure:**
```
resources/ext.layers.editor/
├── canvas/
│   ├── README.md              # ✅ Created - documents planned architecture
│   ├── ZoomPanController.js   # ✅ Extracted - 334 lines, zoom/pan/viewport
│   ├── GridRulersController.js # ✅ Extracted - 385 lines, grid/rulers/guides
│   ├── CanvasCore.js          # Init, sizing, background loading (~300 lines)
│   ├── CanvasEventHandler.js  # Mouse/touch/keyboard events (~400 lines)
│   ├── CanvasRenderer.js      # Drawing shapes (merge with existing) (~500 lines)
│   ├── ResizeController.js    # Resize handles for all shapes (~600 lines)
│   └── RotationController.js  # Rotation logic (~150 lines)
├── CanvasManager.js           # Facade that composes above (~200 lines)
```

**Tasks:**
- [x] Create `canvas/` directory structure
- [x] Document planned module architecture in README.md
- [x] Extract `ZoomPanController.js` (zoomIn, zoomOut, setZoom, setZoomDirect, smoothZoomTo, animateZoom, resetZoom, fitToWindow, zoomToFitLayers, zoomBy, updateCanvasTransform)
- [x] Update CanvasManager to delegate to ZoomPanController
- [x] Add ZoomPanController.js to extension.json ResourceModules
- [x] Extract `GridRulersController.js` (toggleGrid, toggleRulers, toggleGuides, toggleSnapToGrid, toggleSnapToGuides, toggleSmartGuides, drawGrid, drawRulers, drawGuides, getGuideSnapDelta)
- [x] Update CanvasManager to delegate to GridRulersController
- [x] Add GridRulersController.js to extension.json ResourceModules
- [x] ESLint auto-fix on new modules (var → const/let)
- [ ] Extract `ResizeController.js` with per-shape handlers
- [ ] Extract `RotationController.js`
- [ ] Extract `CanvasEventHandler.js`
- [ ] Refactor `CanvasManager.js` as facade
- [ ] Update tests to cover new modules
- [ ] Add browser integration tests

**Estimated Effort:** ~~5 days~~ 3 days remaining  
**Risk:** High - core functionality, needs extensive testing
**Progress:** 40% complete

---

### 1.2 🔴 P0: Consolidate State Management

**Current Problem:** State scattered across StateManager, LayerPanel.layers, CanvasManager.selectedLayerId, etc.

**Solution:**
1. `StateManager.js` becomes single source of truth
2. All components subscribe to state changes
3. Remove all local state copies

**Tasks:**
- [ ] Audit all `this.layers =` and `this.selectedLayerId =` usage
- [ ] Replace direct state with StateManager.get()/set()
- [ ] Add subscription mechanism to StateManager
- [ ] Update LayerPanel to use subscriptions
- [ ] Update CanvasManager to use subscriptions
- [ ] Remove `store.js` (Zustand) if unused, or migrate to it fully
- [ ] Add state change logging for debugging

**Estimated Effort:** 3 days  
**Risk:** Medium - affects data flow throughout app

---

### 1.3 🔴 P0: Fix Test Infrastructure

**Current Issues:**
- ~~Jest tests ignored by ESLint~~ ✅ FIXED
- PHPUnit tests only check existence
- No integration tests

**Tasks:**
- [x] Remove `tests/jest/**` from eslintIgnore in package.json
- [x] Remove `tests/` from `.eslintrc.json` ignorePatterns
- [x] Add Jest env override with parserOptions.ecmaVersion 2020
- [x] Auto-fix 118 ESLint issues (var -> const/let)
- [x] Manually fix 23 remaining issues (unused vars, hasOwnProperty, escape chars)
- [x] All 184 Jest tests passing
- [ ] Add PHPUnit integration test for `layerssave` API
- [ ] Add PHPUnit integration test for `layersinfo` API
- [ ] Add validation edge case tests (XSS, size limits)
- [ ] Add Jest tests for StateManager
- [ ] Set up code coverage reporting
- [ ] Add coverage thresholds (e.g., 60% minimum)

**Estimated Effort:** ~~4 days~~ 2 days remaining  
**Risk:** Low - improves confidence without changing behavior

---

## Phase 2: Code Quality (Week 3-4)

### 2.1 🟠 P1: Extract LayerPanel Components

**Target Structure:**
```
resources/ext.layers.editor/
├── ui/
│   ├── LayerListItem.js       # Single layer row component
│   ├── PropertiesForm.js      # Properties panel
│   ├── ColorPickerDialog.js   # Extracted color picker
│   └── ConfirmDialog.js       # Confirmation dialog
├── LayerPanel.js              # Composition of above (~400 lines)
```

**Tasks:**
- [ ] Extract `ColorPickerDialog.js` (~200 lines)
- [ ] Extract `PropertiesForm.js` with section builders
- [ ] Extract `LayerListItem.js` for layer rows
- [ ] Extract `ConfirmDialog.js`
- [ ] Refactor LayerPanel.js as composition
- [ ] Add unit tests for each component

**Estimated Effort:** 3 days

---

### 2.2 🟠 P1: Add TypeScript / JSDoc Types

**Approach:** Start with JSDoc for gradual adoption

**Tasks:**
- [ ] Add JSDoc to all public APIs in LayersEditor.js
- [ ] Add JSDoc to StateManager.js
- [ ] Add JSDoc to all canvas/ modules
- [ ] Create `types.d.ts` for layer object shape
- [ ] Configure VS Code to use types
- [ ] Consider full TypeScript migration roadmap

**Estimated Effort:** 4 days

---

### 2.3 🟠 P1: Consolidate Constants and Magic Numbers

**Status:** ✅ Mostly Complete - `LayersConstants.js` already comprehensive

**Findings:**
- LayersConstants.js has: TOOLS, LAYER_TYPES, HANDLE_TYPES, DEFAULTS (layer props, colors, sizes), UI (grid, zoom, animation), UI_COLORS, BLEND_MODES, LINE_STYLES, ARROW_HEADS, TEXT_ALIGN, TEXT_BASELINE, CURSORS, EVENTS, KEY_CODES, KEYS, ERROR_MESSAGES, STATUS_MESSAGES, ACTION_MESSAGES, LIMITS, DATA, VALIDATION
- CanvasManager.js still uses local copies (e.g., `this.minZoom = 0.1`) that could reference constants
- Full migration requires refactoring CanvasManager - deferred to avoid introducing bugs

**Tasks:**
- [x] Review LayersConstants.js - found comprehensive coverage
- [ ] Refactor CanvasManager to import and use LayersConstants
- [ ] Add validation that config values are within safe ranges

**Estimated Effort:** ~~1 day~~ 0.5 days remaining

---

### 2.4 🟠 P1: Remove Code Duplication

**Duplicated Areas:**
1. Rendering logic (CanvasManager, CanvasRenderer, RenderingCore)
2. Event handling (CanvasManager, CanvasEvents, EventHandler, EventManager)
3. Selection management (SelectionManager, CanvasManager, LayerPanel)

**Tasks:**
- [ ] Audit all rendering code - consolidate into CanvasRenderer
- [ ] Remove RenderingCore.js if redundant (or merge)
- [ ] Consolidate event handling into CanvasEventHandler
- [ ] Remove EventHandler.js if redundant
- [ ] Make SelectionManager the single selection authority

**Estimated Effort:** 3 days

---

## Phase 3: User Experience (Week 5-6)

### 3.1 🟡 P2: Accessibility Improvements

**Current Gaps:**
- Keyboard navigation incomplete for layer reordering
- Focus management during dialogs
- Screen reader announcements for actions

**Tasks:**
- [ ] Add full keyboard support for layer reorder (Arrow + Ctrl)
- [ ] Ensure all buttons have aria-label
- [ ] Add live regions for status updates
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Add skip links for keyboard users
- [ ] Document keyboard shortcuts in help

**Estimated Effort:** 4 days

---

### 3.2 🟡 P2: Performance Optimization

**Tasks:**
- [ ] Implement dirty region tracking in CanvasRenderer
- [ ] Add layer rendering cache (only redraw changed layers)
- [ ] Debounce property panel updates during drag
- [ ] Use requestAnimationFrame consistently
- [ ] Profile with Chrome DevTools, document bottlenecks

**Estimated Effort:** 3 days

---

### 3.3 🟡 P2: Improve Error Handling

**Tasks:**
- [ ] Create ErrorHandler class for frontend
- [ ] Standardize try-catch patterns
- [ ] Add user-friendly error messages for all API failures
- [ ] Add error boundaries for UI components
- [ ] Add telemetry hook for error tracking (optional)

**Estimated Effort:** 2 days

---

## Phase 4: Long-Term Improvements (Month 2+)

### 4.1 🟢 P3: ES Modules Migration

**Tasks:**
- [ ] Convert IIFE modules to ES modules
- [ ] Update webpack config for ES modules
- [ ] Enable tree-shaking
- [ ] Update extension.json for proper loading order

**Estimated Effort:** 5 days

---

### 4.2 🟢 P3: Full TypeScript Migration

**Tasks:**
- [ ] Set up TypeScript build pipeline
- [ ] Migrate StateManager.ts
- [ ] Migrate LayersEditor.ts
- [ ] Migrate canvas modules
- [ ] Migrate UI components
- [ ] Add strict type checking

**Estimated Effort:** 2 weeks

---

### 4.3 🟢 P3: Component Library

**Consider:**
- Extract reusable components (ColorPicker, ConfirmDialog, etc.)
- Create storybook for component documentation
- Enable component testing in isolation

---

## Completed Items ✅

### Implementation Session - November 25, 2025

- [x] **Test Infrastructure:** Enabled ESLint for Jest tests
  - Removed `tests/` from `.eslintrc.json` ignorePatterns
  - Added Jest env override with `parserOptions.ecmaVersion: 2020`
  - Added `argsIgnorePattern: "^_"` for mock function params
  - Auto-fixed 118 var->const/let issues
  - Manually fixed 23 remaining issues (unused vars, hasOwnProperty, escape chars)
  - All 184 Jest tests passing

- [x] **Code Cleanup:** Removed 43 commented console.log statements from CanvasManager.js
  - File reduced from 3,864 to 3,800 lines
  - No regressions - all tests pass
  - Note: 387 pre-existing ESLint errors (mostly no-var) remain in CanvasManager.js

- [x] **Version Check:** Verified version consistency
  - extension.json: 0.8.1-dev ✓
  - LayersSchemaManager.php: 0.8.1-dev ✓
  - package.json: no version (private package) - correct

- [x] **Module Structure:** Created canvas/ directory with README.md
  - Documented planned module architecture
  - Listed methods to extract for ZoomPanController
  - Listed properties to extract for GridRulersController
  - Provides roadmap for future refactoring

### Previously Completed (as of Nov 22, 2025)
- [x] Backend limits enforced in `ApiLayersSave.php`
- [x] API pagination implemented
- [x] Security logging working
- [x] ESLint enabled on LayerPanel.js (per previous review)
- [x] DOM thrashing improved in renderLayerList (incremental updates)
- [x] Basic accessibility: labels with id/for, ARIA roles on editable names
- [x] Keyboard support for layer reordering (Arrow keys)
- [x] CanvasEvents.js extracted (events delegation exists)

---

## Progress Tracking

| Phase | Status | Started | Target | Actual |
|-------|--------|---------|--------|--------|
| 1.1 Split CanvasManager | � In Progress | Nov 25 | Week 1-2 | Directory created, README documented |
| 1.2 State Management | 🔴 Not Started | - | Week 1-2 | - |
| 1.3 Test Infrastructure | ✅ Partial | Nov 25 | Week 1-2 | ESLint fixed, tests passing |
| 2.1 LayerPanel Components | ⬜ Not Started | - | Week 3-4 | - |
| 2.2 TypeScript/JSDoc | ⬜ Not Started | - | Week 3-4 | - |
| 2.3 Constants | ✅ Reviewed | Nov 25 | Week 3-4 | Constants comprehensive, migration pending |
| 2.4 Remove Duplication | ⬜ Not Started | - | Week 3-4 | - |
| 3.1 Accessibility | ⬜ Not Started | - | Week 5-6 | - |
| 3.2 Performance | ⬜ Not Started | - | Week 5-6 | - |
| 3.3 Error Handling | ⬜ Not Started | - | Week 5-6 | - |

---

## How to Contribute

1. Pick a task from Phase 1 (critical) or Phase 2 (high priority)
2. Create a branch: `feature/improve-{task-name}`
3. Implement changes with tests
4. Run `npm test` and `npm run test:php`
5. Submit PR with reference to this plan

---

## Notes

- All refactoring should maintain backward compatibility
- Each change should have corresponding tests
- Document any breaking changes in CHANGELOG
- Coordinate with reviewers before starting Phase 1 tasks
