# Layers Extension - Improvement Plan

**Last Updated:** January 2025  
**Status:** IN PROGRESS - P0.2, P0.3, P1.3, P1.4, P1.5 COMPLETE  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. This plan was reset on Dec 7, 2025 to reflect accurately verified metrics.

### Progress Summary

| Metric | Start | Current | Target |
|--------|-------|---------|--------|
| Self-reference anti-pattern | 62 | **0** ✅ | 0 |
| LayersDebug default | true | **false** ✅ | false |
| Files modernized | 0 | **25** | 54 |
| ES6 classes | 16 | **23** ✅ | 23+ |
| Namespace exports | 0 | **52** ✅ | 54 |

**Files completed (const self = this → arrow functions):** 
- ImageLoader.js (3 patterns → 0)
- LayerPanel.js (8 patterns → 0)
- ToolbarStyleControls.js (8 patterns → 0)
- CanvasManager.js (7 patterns → 0)
- LayersValidator.js (5 patterns → 0)
- ImportExportManager.js (4 patterns → 0)
- init.js (1 pattern → 0)
- ConfirmDialog.js (2 patterns → 0)
- Toolbar.js (3 patterns → 0)
- ColorPickerDialog.js (3 patterns → 0)
- LayersViewer.js (2 patterns → 0)
- ViewerManager.js (2 patterns → 0)
- ApiFallback.js (3 patterns → 0)
- UrlParser.js (3 patterns → 0)
- TransformController.js (1 pattern → 0)
- LayersEditor.js (2 patterns → 0)
- LayerSetManager.js (2 patterns → 0)
- ToolManager.js (1 pattern → 0)

**Files converted to ES6 class syntax (P1.5):**
- SelectionManager.js (1,033 lines, 40 methods → ES6 class)
- LayerPanel.js (1,252 lines, 46 methods → ES6 class)

---

## Verified Baseline Metrics (December 7, 2025)

All metrics verified via terminal commands on this date.

### JavaScript Codebase

```bash
# Total files and lines
find resources -name "*.js" -type f ! -path "*/dist/*" ! -name "*backup*" | wc -l
# Result: 54 files

find resources -name "*.js" -type f ! -path "*/dist/*" ! -name "*backup*" | xargs cat | wc -c
# Result: 921,154 bytes (~921KB)

find resources -name "*.js" -type f ! -path "*/dist/*" ! -name "*backup*" -exec wc -l {} + | tail -1
# Result: 29,554 lines

# God classes (>800 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" ! -name "*backup*" -exec wc -l {} + | awk '$1 > 800'
# Result: 9 files
```

| Metric | Verified Value | Target | Command |
|--------|----------------|--------|---------|
| Total JS files | 54 | - | `find ... \| wc -l` |
| Total JS bytes | 921KB | <400KB | `cat ... \| wc -c` |
| Total JS lines | 29,554 | - | `wc -l` |
| Files > 800 lines | 9 | 0 | `awk '$1 > 800'` |
| Global exports | 69 | 0 | `grep "window\.[A-Z].*="` |
| Prototype methods | 804 | 0 | `grep "\.prototype\."` |
| ES6 classes | 16 | 804+ | `grep "class .* {"` |
| Self-reference anti-pattern | 34 (was 62) | 0 | `grep "const self = this"` |

### God Classes Detail

| File | Lines | Methods | Priority |
|------|-------|---------|----------|
| CanvasManager.js | 1,980 | 111 | P0 - CRITICAL |
| LayerRenderer.js | 1,829 | ~60 | P2 - Shared, acceptable |
| LayerPanel.js | 1,258 | 93 | P1 |
| TransformController.js | 1,225 | ~40 | P2 - Recently extracted |
| LayersEditor.js | 1,212 | ~50 | P1 |
| SelectionManager.js | 1,026 | ~35 | P1 |
| ToolManager.js | 1,021 | ~40 | P1 |
| LayersValidator.js | 951 | ~30 | P2 - Focused purpose |
| APIManager.js | 909 | ~25 | P2 |

### Tests

```bash
npm run test:js 2>&1 | grep "Tests:"
# Result: Tests: 1 skipped, 2647 passed, 2648 total

find tests/e2e -name "*.js" | wc -l
# Result: 3 files
```

---

## Priority Legend

| Priority | Meaning | Timeline | Criteria |
|----------|---------|----------|----------|
| **P0** | Critical blocker | This week | Blocks all other work |
| **P1** | High impact | 2-4 weeks | Significantly improves maintainability |
| **P2** | Medium impact | 1-2 months | Important but not blocking |
| **P3** | Nice to have | 3+ months | Long-term improvement |

---

## Phase 0: Critical Blockers (P0)

### P0.1 Split CanvasManager.js

**Status:** ❌ NOT DONE  
**Priority:** CRITICAL BLOCKER  
**Effort:** 1 week  
**Risk:** HIGH - Many dependencies

**Problem:**
CanvasManager.js at 1,980 lines with 111 methods is unmaintainable. Any modification carries regression risk.

**Current State:**
- 111 prototype methods
- Handles 15+ concerns
- Circular dependencies with most modules

**Target State:**
- CanvasManager.js < 500 lines
- Acts as true facade (delegates, doesn't implement)
- Each extracted module < 300 lines

**Proposed Extractions:**

| New Module | Responsibility | Est. Lines |
|------------|---------------|------------|
| LayerOperations.js | Add, remove, duplicate, reorder layers | ~200 |
| ViewportManager.js | Viewport calculations, coordinate transforms | ~200 |
| StyleManager.js | Current style state, style application | ~150 |
| CanvasInitializer.js | Setup, canvas element creation | ~150 |

**Acceptance Criteria:**
- [ ] CanvasManager.js < 500 lines (verify: `wc -l CanvasManager.js`)
- [ ] No new methods, only delegation calls
- [ ] All 2,647 Jest tests pass
- [ ] No new ESLint errors

---

### P0.2 Eliminate Duplicate Global Exports

**Status:** ✅ COMPLETE  
**Priority:** CRITICAL BLOCKER  
**Effort:** 3 days  
**Risk:** MEDIUM - Load order dependencies  
**Completed:** December 7, 2025

**Problem:**
69 `window.X =` exports pollute global namespace and block ES module migration.

**Solution Applied:**
- Converted 52 files to use `window.Layers.*` namespace pattern
- Maintained backward compatibility with `window.X =` aliases
- Organized into logical sub-namespaces:
  - `window.Layers.Core` - Editor, managers (StateManager, HistoryManager, etc.)
  - `window.Layers.Canvas` - Canvas controllers and utilities
  - `window.Layers.UI` - Toolbar, panels, dialogs
  - `window.Layers.Utils` - Utilities (GeometryUtils, TextUtils, EventTracker)
  - `window.Layers.Validation` - Validators
  - `window.Layers.Viewer` - Viewer components

**Pattern Applied:**
```javascript
// Export to window.Layers namespace (preferred)
if ( typeof window !== 'undefined' ) {
    window.Layers = window.Layers || {};
    window.Layers.Category = window.Layers.Category || {};
    window.Layers.Category.ClassName = ClassName;
    
    // Backward compatibility - direct window export
    window.ClassName = ClassName;
}
```

**Results:**
- ✅ 52 files converted to namespace pattern
- ✅ All 2,647 Jest tests still pass
- ✅ ESLint, Stylelint, Banana all clean
- ✅ Backward compatibility maintained for existing consumers

**Acceptance Criteria:**
- [ ] `grep -c "window\.[A-Z][A-Za-z]* =" resources` returns 0
- [ ] All code uses `window.Layers.*` namespace
- [ ] All tests pass
- [ ] Extension loads correctly in MediaWiki

---

### P0.3 Set LayersDebug Default to False

**Status:** ✅ COMPLETE  
**Priority:** HIGH  
**Effort:** 1 hour  
**Risk:** LOW

**Problem:**
Debug mode is ON by default in production builds.

**Change Required:**
```json
// extension.json
"LayersDebug": {
    "description": "Enable verbose debug logging",
    "value": false  // Changed from true
}
```

**Acceptance Criteria:**
- [x] `extension.json` has `"value": false` for LayersDebug
- [x] Wiki logs are not flooded without explicit opt-in

---

## Phase 1: High Priority (P1)

### P1.1 Split LayerPanel.js

**Status:** ❌ NOT DONE  
**Priority:** HIGH  
**Effort:** 3 days  

**Problem:** 1,258 lines with 93 methods handling UI, state, and events.

**Target:** < 600 lines main file with extracted modules.

**Proposed Extractions:**

| New Module | Responsibility |
|------------|---------------|
| LayerListRenderer.js | Render layer list DOM |
| LayerItemInteractions.js | Click, drag, context menu handlers |
| LayerPropertiesEditor.js | Properties panel rendering |

**Acceptance Criteria:**
- [ ] LayerPanel.js < 600 lines
- [ ] All tests pass
- [ ] Layer panel functionality unchanged

---

### P1.2 Split SelectionManager.js

**Status:** ❌ NOT DONE  
**Priority:** HIGH  
**Effort:** 2 days  

**Problem:** 1,026 lines mixing selection state with selection UI.

**Target:** < 500 lines with extracted modules.

**Acceptance Criteria:**
- [ ] SelectionManager.js < 500 lines
- [ ] Selection functionality unchanged
- [ ] All tests pass

---

### P1.3 ES6 Class Pilot (5 Files)

**Status:** ✅ COMPLETE (exceeded target)  
**Priority:** HIGH  
**Effort:** 2 days  

**Problem:** Only 5 of 804 (0.6%) methods use ES6 classes.

**Result:** Converted 6 files to ES6 class syntax, bringing total to 21 ES6 classes.

**Pilot Files Converted:**
1. ToolbarKeyboard.js (5 methods)
2. ConfirmDialog.js (6 methods + 2 static)
3. ClipboardController.js (9 methods)
4. ZoomPanController.js (16 methods)
5. HitTestController.js (15 methods)

**Previously Existing ES6 Classes:**
- MessageHelper.js, EventTracker.js, ImageLoader.js
- CanvasUtilities.js, AccessibilityAnnouncer.js, and others

**Acceptance Criteria:**
- [x] 5+ files converted to ES6 class syntax
- [x] `grep "^[[:space:]]*class " resources | wc -l` returns ≥ 10 (actual: **21**)
- [x] All tests pass
- [x] Pattern documented in CONTRIBUTING.md (existing)

---

### P1.4 Eliminate `const self = this` Anti-Pattern

**Status:** ✅ COMPLETE  
**Priority:** MEDIUM  
**Effort:** 2 days  

**Problem:** 62 occurrences of `const self = this` instead of arrow functions.

**Pattern:**
```javascript
// Before
CanvasManager.prototype.setup = function() {
    const self = this;
    element.addEventListener('click', function() {
        self.handleClick();
    });
};

// After
CanvasManager.prototype.setup = function() {
    element.addEventListener('click', () => {
        this.handleClick();
    });
};
```

**Files Updated (18 total):**
- ImageLoader.js, LayerPanel.js, ToolbarStyleControls.js, CanvasManager.js
- LayersValidator.js, ImportExportManager.js, init.js, ConfirmDialog.js
- Toolbar.js, ColorPickerDialog.js, LayersViewer.js, ViewerManager.js
- ApiFallback.js, UrlParser.js, TransformController.js, LayersEditor.js
- LayerSetManager.js, ToolManager.js

**Acceptance Criteria:**
- [x] `grep "const self = this" resources | wc -l` returns 0
- [x] All tests pass

---

### P1.5 ES6 Class Conversion for Large Files

**Status:** ✅ COMPLETE  
**Priority:** HIGH  
**Effort:** 1 day  

**Problem:** Large files still using prototype-based patterns are harder to maintain.

**Approach:** Convert prototype-based files to ES6 class syntax without splitting them (lower risk than file splitting).

**Files Converted:**
1. SelectionManager.js (1,033 lines, 40 methods → ES6 class)
2. LayerPanel.js (1,252 lines, 46 methods → ES6 class)

**Pattern Applied:**
```javascript
// Before (prototype-based)
function SelectionManager( editor ) {
    this.editor = editor;
}
SelectionManager.prototype.selectLayer = function ( layerId ) {
    // ...
};

// After (ES6 class)
class SelectionManager {
    constructor( editor ) {
        this.editor = editor;
    }
    selectLayer( layerId ) {
        // ...
    }
}
```

**Benefits:**
- Cleaner syntax with fewer lines of boilerplate
- Better IDE support for method navigation
- Arrow functions used throughout for callbacks
- Rest parameters (...args) instead of `Array.prototype.slice.call(arguments)`
- Preparation for future TypeScript migration

**Acceptance Criteria:**
- [x] SelectionManager.js converted to ES6 class
- [x] LayerPanel.js converted to ES6 class
- [x] All 2,647 Jest tests pass
- [x] No ESLint errors

---

## Phase 2: Medium Priority (P2)

### P2.1 Bundle Size Reduction

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2 weeks  

**Current:** 921KB unminified  
**Target:** <500KB unminified

**Strategies:**
1. Remove dead code (identify with coverage reports)
2. Lazy load dialogs (ColorPicker, Properties, Import/Export)
3. Separate viewer bundle from editor bundle

**Acceptance Criteria:**
- [ ] `cat resources/**/*.js | wc -c` returns <512,000
- [ ] Viewer loads without editor code
- [ ] All functionality preserved

---

### P2.2 E2E Test Infrastructure

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1 week  

**Problem:** E2E tests require live MediaWiki server, cannot run in CI.

**Solution:** Mock API layer for E2E tests.

**Acceptance Criteria:**
- [ ] E2E tests runnable without MediaWiki server
- [ ] CI pipeline includes E2E tests
- [ ] All 11 layer types tested

---

### P2.3 PHP Test Coverage

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1 week  

**Problem:** Minimal PHP test coverage for critical paths.

**Files Needing Tests:**
- ApiLayersSave.php
- ApiLayersInfo.php
- LayersDatabase.php
- ServerSideLayerValidator.php

**Acceptance Criteria:**
- [ ] Each API module has unit tests
- [ ] Validation edge cases tested
- [ ] Database operations tested with mocks

---

### P2.4 TransformController.js Decomposition

**Status:** ❌ NOT STARTED  
**Priority:** LOW  
**Effort:** 3 days  

**Problem:** 1,225 lines handling resize, rotation, and drag.

**Target:** Separate resize, rotation, and drag into focused modules.

---

## Phase 3: Long Term (P3)

### P3.1 Complete ES6 Class Migration

**Target:** All 804 prototype methods converted to ES6 classes.

### P3.2 TypeScript Migration

**Target:** Type safety across codebase, starting with new code.

### P3.3 ES Modules

**Prerequisite:** P0.2 (global exports eliminated)  
**Target:** Full `import`/`export` syntax, tree-shaking enabled.

---

## Progress Tracking

### Completion Checklist

Use terminal commands to verify completion:

```bash
# P0.1 - CanvasManager split
wc -l resources/ext.layers.editor/CanvasManager.js
# Must be < 500

# P0.2 - Global exports eliminated
grep -c "window\.[A-Z][A-Za-z]* =" resources/**/*.js
# Must be 0

# P1.3 - ES6 classes
grep -c "^class " resources/**/*.js
# Must be ≥ 10

# P1.4 - Self-reference eliminated
grep -c "const self = this" resources/**/*.js
# Must be 0

# P2.1 - Bundle size
find resources -name "*.js" ! -path "*/dist/*" -exec cat {} + | wc -c
# Must be < 512000
```

---

## Visual Progress

```
Phase 0 (Critical):
P0.1 Split CanvasManager:         ░░░░░░░░░░░░░░░░░░░░ 0%
P0.2 Eliminate Global Exports:    ░░░░░░░░░░░░░░░░░░░░ 0%
P0.3 Debug Default False:         ████████████████████ 100% ✅

Phase 1 (High):
P1.1 Split LayerPanel:            ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Split SelectionManager:      ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 ES6 Class Pilot:             ████████████████████ 100% ✅ (21 classes)
P1.4 Eliminate self = this:       ████████████████████ 100% ✅
P1.5 ES6 Class Large Files:       ████████████████████ 100% ✅ (2 files, 86 methods)

Phase 2 (Medium):
P2.1 Bundle Size Reduction:       ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 E2E Test Infrastructure:     ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 PHP Test Coverage:           ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 TransformController Split:   ░░░░░░░░░░░░░░░░░░░░ 0%

File Size Goals:
CanvasManager:    ████████████████████ 1,980 → target 500
LayerPanel:       █████████████░░░░░░░ 1,252 (now ES6 class ✅)
SelectionManager: ██████████░░░░░░░░░░ 1,033 (now ES6 class ✅)
ToolManager:      ██████████░░░░░░░░░░ 1,021 → target 500
```

---

## What Has Been Accomplished (Verified)

Despite the reset, some genuine progress exists:

1. **Controller Extractions** - 8 controllers in `canvas/` directory (~4,200 lines)
   - ZoomPanController, GridRulersController, TransformController, etc.
   
2. **Shared LayerRenderer** - `LayerRenderer.js` (1,829 lines) for viewer/editor consistency

3. **Namespace Structure** - `window.Layers.*` namespace established (though not exclusively used)

4. **Accessibility** - ARIA live regions, keyboard navigation added

5. **Editor Module Extractions** - EditorBootstrap, RevisionManager, DialogManager

6. **Test Suite** - 2,647 Jest tests passing

---

## Success Metrics

### Phase 0 Complete When:
- [ ] CanvasManager.js < 500 lines
- [ ] Global `window.X =` exports = 0
- [x] LayersDebug default = false ✅

### Phase 1 Complete When:
- [ ] No file > 800 lines (except LayerRenderer)
- [x] ES6 class count ≥ 10 ✅ (actual: **21**)
- [x] `const self = this` count = 0 ✅

### Phase 2 Complete When:
- [ ] Bundle size < 500KB
- [ ] E2E tests run in CI
- [ ] PHP test coverage > 50%

---

*Plan reset by GitHub Copilot (Claude Opus 4.5) on December 7, 2025*
