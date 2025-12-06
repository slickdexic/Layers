# Layers Extension - Improvement Plan

**Last Updated:** January 9, 2025  
**Status:** Actively Implementing - P0 Complete, P1.2 & P1.3 Complete  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. **Phase 0 (Critical Blockers), P1.2 (ES6 Migration), and P1.3 (Split LayersEditor) are now complete** - the codebase has been significantly improved with:

- **Shared LayerRenderer created** - Eliminated ~900 lines of duplicate rendering code
- **CanvasManager decomposed** - Reduced from 5,462 to 1,899 lines via 8 controller extractions
- **Namespace consolidation** - `LayersNamespace.js` provides unified `window.Layers` namespace
- **ES6 class migration** - 7 utility classes converted to modern ES6 class syntax (1,579 lines)
- **LayersEditor split** - Extracted 3 modules reducing LayersEditor.js from 1,889 to 1,203 lines (-36%)

The extension is now in a much healthier state for future development.

---

## Priority Legend

| Priority | Meaning | Timeline | Status |
|----------|---------|----------|--------|
| **P0** | Critical blocker | ~~This week~~ | ✅ COMPLETE |
| **P1** | High impact | 2-4 weeks | 🟡 Partially complete |
| **P2** | Medium impact | 1-2 months | 📋 Planned |
| **P3** | Nice to have | 3+ months | 📋 Backlog |

---

## Current Metrics (Updated January 9, 2025)

### JavaScript Codebase

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Total JS lines | 29,371 | ~30,500 | - | - |
| Total JS bytes | 909KB | ~1,000KB | <400KB | 🟡 Still oversized |
| Files > 800 lines | 11 | 8 | 0 | 🟢 Improving |
| Files > 1,000 lines | 6 | 4 | 0 | 🟢 Improving |
| Global exports | 34 | 34 | Namespaced | 🟢 All namespaced |
| CanvasManager lines | 5,462 | 1,899 | 400 | 🟢 -65% |
| LayersViewer lines | 1,225 | 330 | 400 | ✅ Complete |
| ES6 classes converted | 0 | 7 | all utilities | 🟢 Phase 1+2 complete |

### Controller Extractions Complete (P0.2)

| Controller | Lines | Status |
|------------|-------|--------|
| ZoomPanController.js | 343 | ✅ |
| GridRulersController.js | 385 | ✅ |
| TransformController.js | 965 | ✅ |
| HitTestController.js | 382 | ✅ |
| DrawingController.js | 622 | ✅ |
| ClipboardController.js | 212 | ✅ |
| RenderCoordinator.js | 387 | ✅ |
| InteractionController.js | 487 | ✅ |
| **Total Extracted** | **~4,200** | **✅** |

### ES6 Class Migration Progress (P1.2)

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| GeometryUtils.js | 393 | Static utility | ✅ Converted |
| TextUtils.js | 166 | Static utility | ✅ Converted |
| EventTracker.js | 207 | Instance class | ✅ Converted |
| MessageHelper.js | 158 | Instance class | ✅ Converted |
| **Phase 1 Total** | **924** | **4 files** | **✅ Complete** |
| StyleController.js | 100 | Instance class | ✅ Converted |
| ImageLoader.js | 275 | Instance class | ✅ Converted |
| CanvasUtilities.js | 280 | Static utility | ✅ Converted |
| **Phase 2 Total** | **655** | **3 files** | **✅ Complete** |
| **Combined Total** | **1,579** | **7 files** | **✅ Complete** |

### Test Status

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,715 | 2,500+ | 🟢 Passing |
| Jest test files | 62 | 50+ | 🟢 Good |
| ESLint | Passing | Passing | 🟢 |
| E2E test files | 1 | 5+ | 🔴 Needs work |

---

## ✅ Phase 0: Critical Blockers - COMPLETE

### ✅ P0.1 Extract Shared LayerRenderer

**Priority:** P0 - COMPLETE  
**Status:** ✅ DONE  
**Completed:** January 9, 2025

**What was done:**
- Created `resources/ext.layers.shared/LayerRenderer.js` (1,168 lines)
- Unified rendering engine for all 11 layer types
- Refactored `LayersViewer.js` from 1,225 → 330 lines (-73%)
- Updated `extension.json` with new `ext.layers.shared` module
- All tests pass (ESLint, Jest 2,715 tests)

**Files Created:**
- `resources/ext.layers.shared/LayerRenderer.js`

**Files Modified:**
- `resources/ext.layers/LayersViewer.js` (73% reduction)
- `extension.json` (added ext.layers.shared module)

**Remaining Work (P1.1):**
- `ShapeRenderer.js` still has ~900 lines of similar rendering code
- Full unification requires careful testing due to editor-specific features (TextUtils, rotation transforms)
- Deferred to P1.1 as bundle size reduction

---

### ✅ P0.2 Split CanvasManager.js

**Priority:** P0 - COMPLETE  
**Status:** ✅ DONE  
**Completed:** Prior to January 2025

**What was done:**
- CanvasManager reduced from 5,462 → 1,899 lines (-65%)
- 8 controllers extracted to `canvas/` directory (~4,200 lines)
- CanvasManager now acts as a thin facade
- Full documentation in `resources/ext.layers.editor/canvas/README.md`

**Extracted Controllers:**
1. `ZoomPanController.js` - Zoom and pan operations
2. `GridRulersController.js` - Grid and ruler rendering
3. `TransformController.js` - Resize, rotation, drag transforms
4. `HitTestController.js` - Selection and layer hit testing
5. `DrawingController.js` - Shape creation and tool preview
6. `ClipboardController.js` - Copy/cut/paste operations
7. `RenderCoordinator.js` - Render scheduling and optimization
8. `InteractionController.js` - Mouse/touch event handling

**Remaining in CanvasManager:**
- Initialization and setup (~200 lines)
- Delegation methods to controllers (~500 lines)
- Selection state coordination (~200 lines)
- Canvas/viewport utilities (~200 lines)
- History integration (~100 lines)

---

### ✅ P0.3 Namespace Consolidation

**Priority:** P0 - COMPLETE  
**Status:** ✅ DONE  
**Completed:** Prior to January 2025

**What was done:**
- Created `LayersNamespace.js` with export registry for 45+ classes
- Unified `window.Layers` namespace structure
- Deprecation warnings available in debug mode (`wgLayersDebug`)
- Auto-initializes on DOM ready

**Namespace Structure:**
```javascript
window.Layers = {
  VERSION: '0.8.1-dev',
  
  // Top-level
  Editor: LayersEditor,
  ToolManager: LayersToolManager,
  StyleController, APIManager, MessageHelper, LayerSetManager,
  
  // Core namespace
  Core: { StateManager, HistoryManager, EventManager, ModuleRegistry, Constants },
  
  // UI namespace
  UI: { Manager, Toolbar, LayerPanel, ToolbarKeyboard, StyleControls, ... },
  
  // Canvas namespace
  Canvas: { Manager, Renderer, Events, SelectionManager, ShapeRenderer, ... },
  
  // Utils namespace
  Utils: { Geometry, Text, ImageLoader, ErrorHandler, EventTracker, ... },
  
  // Validation namespace
  Validation: { LayersValidator, Manager }
};
```

---

## 🟡 Phase 1: High Priority (P1) - Partially Complete

### P1.1 Bundle Size Reduction

**Priority:** P1 - HIGH  
**Status:** Ready to start  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM

**Current State:** ~1,000KB total JavaScript (target: <400KB)

**Opportunities Identified:**
1. **ShapeRenderer/LayerRenderer overlap** (~36KB) - Editor loads both
2. **Unused fallback code** in CanvasManager (~80 lines)
3. **Lazy loading** for ImportExportManager, PropertiesForm, ToolbarStyleControls
4. **Dead code** in deprecated paths

**Tasks:**
- [ ] Audit all modules for dead code paths
- [ ] Implement lazy loading for optional features
- [ ] Consider webpack code splitting for editor vs. viewer
- [ ] Document bundle size targets in CI

**Acceptance Criteria:**
- [ ] Total JS < 600KB (40% reduction)
- [ ] Viewer bundle < 100KB
- [ ] Editor initial load < 400KB

---

### ✅ P1.2 ES6 Class Migration

**Priority:** P1 - HIGH  
**Status:** ✅ Phase 1 & 2 COMPLETE  
**Completed:** January 9, 2025  
**Effort:** 2 sessions  
**Risk:** LOW (incremental)

**What was done:**
- Converted 7 utility classes to modern ES6 class syntax
- Total: 1,579 lines refactored across 7 files
- All 2,715 Jest tests still pass
- ESLint and Stylelint clean

**Files Converted:**

| File | Lines | Pattern | Changes |
|------|-------|---------|---------|
| GeometryUtils.js | 393 | Static methods only | `function`→`class`, `.prototype.`→`static` |
| TextUtils.js | 166 | Static methods only | Object literal→`class` with static methods |
| EventTracker.js | 207 | Instance class | `function`→`class`, `prototype`→class methods |
| MessageHelper.js | 158 | Instance class | `function`→`class`, added rest parameters |
| StyleController.js | 100 | Instance class | `function`→`class`, module-level constants |
| ImageLoader.js | 275 | Instance class | `function`→`class`, module-level constants |
| CanvasUtilities.js | 280 | Static methods only | `function`→`class`, module-level arrays |

**Benefits:**
- Cleaner, more readable code
- Better IDE support and type inference
- Modern JavaScript patterns for new contributors
- Arrow functions eliminate `const self = this` anti-pattern

**Next Steps (P1.2 Phase 3 - Optional):**
- [ ] Convert remaining controllers to ES6 classes
- [ ] Convert Manager classes (StateManager, HistoryManager)
- [ ] Update CONTRIBUTING.md with ES6 class patterns

**Acceptance Criteria:**
- [x] 7 utility files converted (Phase 1+2 complete)
- [ ] 50% of files using ES6 classes (Phase 3)
- [ ] All new code uses ES6 classes
- [x] Pattern proven with tests passing

---

### ✅ P1.3 Split LayersEditor.js

**Priority:** P1 - MEDIUM  
**Status:** ✅ DONE  
**Completed:** January 9, 2025  
**Effort:** 1 session  
**Risk:** MEDIUM

**Problem Solved:** 1,889 lines handling UI orchestration, state management, API coordination.

**What was done:**
- Created `RevisionManager.js` (471 lines) - Handles revision and named layer set management
- Created `DialogManager.js` (421 lines) - Handles modal dialogs with ARIA accessibility
- Created `EditorBootstrap.js` (403 lines) - Initialization, hooks, global error handlers, cleanup
- Refactored LayersEditor.js from 1,889 → 1,203 lines (-36%)
- All 2,715 Jest tests pass
- Updated test mocks for new module architecture

**Files Created:**
```
resources/ext.layers.editor/editor/
├── EditorBootstrap.js     # Initialization & hooks (~400 lines)
├── RevisionManager.js     # Revision/set management (~470 lines)
└── DialogManager.js       # Modal dialogs (~420 lines)
```

**Files Modified:**
- `resources/ext.layers.editor/LayersEditor.js` (36% reduction)
- `extension.json` (added 3 new scripts)
- `tests/jest/LayersEditorUI.test.js` (added mocks)
- `tests/jest/LayersEditorExtended.test.js` (added mocks)
- `tests/jest/LayersEditorCoverage.test.js` (added mocks)

**Delegation Pattern:**
- LayersEditor.js retains delegation methods that forward to extracted managers
- Uses getters in tests to ensure managers access current editor state
- Fallback behavior when managers unavailable (graceful degradation)

**Remaining (Optional):**
- Further extraction could bring LayersEditor.js below 800 lines
- Consider extracting KeyboardManager.js for shortcut handling

**Acceptance Criteria:**
- [x] LayersEditor.js significantly reduced (1,889 → 1,203 lines)
- [x] All 2,715 tests pass
- [x] ESLint and Stylelint clean

---

### Editor Module Extraction Progress (P1.3)

| File | Lines | Responsibility | Status |
|------|-------|----------------|--------|
| EditorBootstrap.js | 403 | Init, hooks, cleanup | ✅ New |
| RevisionManager.js | 471 | Revisions, named sets | ✅ New |
| DialogManager.js | 421 | Modal dialogs, ARIA | ✅ New |
| LayersEditor.js | 1,203 | Orchestration | ✅ Reduced 36% |
| **Total New Lines** | **1,295** | **3 modules** | **✅ Complete** |

---

## 📋 Phase 2: Medium Priority (P2)

### P2.1 Accessibility Improvements

**Priority:** P2 - HIGH for compliance  
**Status:** Not Started  
**Effort:** 1 week

**Problem:** Canvas has no accessibility support. No screen reader support, no keyboard navigation.

**Tasks:**
- [ ] Add hidden layer description region for screen readers
- [ ] Add Tab navigation between layers
- [ ] Add keyboard shortcuts help (Shift+?)
- [ ] Test with NVDA/VoiceOver

---

### P2.2 E2E Test Expansion

**Priority:** P2 - MEDIUM  
**Status:** 4/11 layer types covered

**Missing:**
- Ellipse, Polygon, Star, Line, Highlight, Path, Blur
- Named layer sets workflow
- Revision history navigation

**Target:** 30+ E2E tests covering all layer types and major workflows

---

### P2.3 Performance Benchmarks

**Priority:** P2 - LOW  
**Status:** Not Started

**Tasks:**
- [ ] Create benchmarks for render time (10, 50, 100 layers)
- [ ] Add benchmark job to CI
- [ ] Set regression alerts (>20% slower)

---

## Visual Progress

```
Phase 0 (Critical) - COMPLETE:
P0.1 Shared LayerRenderer:     ████████████████████ ✅ DONE
P0.2 Split CanvasManager:      ████████████████████ ✅ DONE
P0.3 Namespace Plan:           ████████████████████ ✅ DONE

Phase 1 (High) - IN PROGRESS:
P1.1 Bundle Size Reduction:    ░░░░░░░░░░░░░░░░░░░░ Ready
P1.2 ES6 Class Migration:      ████████████████████ ✅ Phase 1+2 (7 files)
P1.3 Split LayersEditor:       ░░░░░░░░░░░░░░░░░░░░ Not Started

Phase 2 (Medium):
P2.1 Accessibility:            ░░░░░░░░░░░░░░░░░░░░ Not Started
P2.2 E2E Test Expansion:       ████████░░░░░░░░░░░░ 4/11 types
P2.3 Performance Benchmarks:   ░░░░░░░░░░░░░░░░░░░░ Not Started

File Size Progress (Lines):
LayersViewer:     ███░░░░░░░░░░░░░░░░░ 330 ← from 1,225 ✅
CanvasManager:    ████████████████░░░░ 1,899 ← from 5,462 (65% reduction)
LayersEditor:     ████████████████████ 1,889 (target: 800)
CanvasRenderer:   ██████████████████░░ 1,776 (target: 400)
```

---

## Success Metrics

### ✅ Phase 0 Complete:
- [x] Shared LayerRenderer eliminates ~900 lines of duplication
- [x] CanvasManager.js reduced by 65% (5,462 → 1,899)
- [x] Namespace structure established

### Phase 1 Success When:
- [ ] Bundle size < 600KB (40% reduction from current)
- [ ] 50% ES6 class adoption
- [ ] LayersEditor.js < 800 lines

### Phase 2 Success When:
- [ ] All 11 layer types have E2E tests
- [ ] Basic canvas accessibility implemented
- [ ] Performance benchmarks in CI

---

*Plan updated by GitHub Copilot (Claude Opus 4.5) on January 9, 2025*
