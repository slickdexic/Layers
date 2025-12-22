# Known Issues

**Last Updated:** December 21, 2025  
**Version:** 1.1.10

This document lists known functionality issues and their current status.

---

## All P0 and P1 Issues Resolved ✅

As of version 1.1.10, all critical (P0) and high-priority (P1) issues have been fixed. The extension is production-ready.

---

## Recently Fixed (v1.1.10 - December 21, 2025)

### ✅ SVG XSS Security Risk

**Status:** FIXED  
**File:** src/Validation/ServerSideLayerValidator.php

Removed `image/svg+xml` from allowed MIME types. SVG images can contain embedded JavaScript, creating XSS vulnerabilities.

### ✅ Foreign Repository File Lookup

**Status:** FIXED  
**Files:** src/Api/ApiLayersDelete.php, src/Api/ApiLayersRename.php

Changed from `getLocalRepo()->findFile()` to `getRepoGroup()->findFile()` to support files from foreign repositories like Wikimedia Commons.

### ✅ Jest Coverage Configuration

**Status:** FIXED  
**File:** jest.config.js

Updated `collectCoverageFrom` to track all source directories using comprehensive glob patterns.

---

## Recently Fixed (v1.1.9 - December 21, 2025)

### ✅ Background Visibility Bug

**Status:** FIXED  
**Files:** APIManager.js, BackgroundLayerController.js, LayerPanel.js

Background saved as hidden would show as visible when re-opening editor. Fixed by checking both `!== false` and `!== 0` for PHP→JS boolean handling.

### ✅ Missing AutoloadClasses Entry

**Status:** FIXED  
**File:** extension.json

Added `ApiLayersRename` to `AutoloadClasses` alongside the `APIModules` registration.

### ✅ Console.error in Production

**Status:** FIXED  
**File:** resources/ext.layers/viewer/ViewerManager.js line 210

Replaced `console.error()` with `mw.log.error()` to comply with MediaWiki coding standards.

### ✅ Failing Test

**Status:** FIXED  
**File:** tests/jest/LayersViewer.test.js line 1025

Updated test expectation from `''` to `'1'` to match actual behavior (opacity is set explicitly).

### ✅ Memory Leak - Animation Frame

**Status:** FIXED  
**File:** resources/ext.layers.editor/CanvasManager.js

Added `cancelAnimationFrame()` call in `destroy()` method to prevent memory leaks when editor is closed.

### ✅ Missing Setname Sanitization

**Status:** FIXED  
**Files:** src/Api/ApiLayersDelete.php, src/Api/ApiLayersRename.php

Added `sanitizeSetName()` method and calls to both APIs for security consistency.

### ✅ Duplicated clampOpacity() Function

**Status:** FIXED  
**Files:** Created resources/ext.layers.shared/MathUtils.js

Extracted shared utility function to new MathUtils module. All 6 renderer files now delegate to the shared implementation.

### ✅ ESLint Error in MathUtils.js

**Status:** FIXED  
**File:** resources/ext.layers.shared/MathUtils.js

Added eslint-disable comments for `module` exports to resolve no-undef error.

---

## P1 Issues (Important)

### ⚠️ SVG XSS Risk

**Status:** Not Fixed  
**Severity:** HIGH (Security)  
**File:** src/Validation/ServerSideLayerValidator.php

SVG images are allowed in image imports but SVG can contain JavaScript, creating XSS risk.

**Fix:** Remove SVG from allowed MIME types or add SVG sanitization.

### ⚠️ Inconsistent File Lookup

**Status:** Not Fixed  
**Severity:** MEDIUM  
**Files:** ApiLayersDelete.php, ApiLayersRename.php

Uses `getLocalRepo()->findFile()` instead of `getRepoGroup()->findFile()`, which won't find files from foreign repositories like Wikimedia Commons.

---

## Active Issues

### ⚠️ No Mobile/Touch Support

**Status:** Not Implemented  
**Severity:** Medium for desktop-focused, High for mobile users

The editor does not handle touch events. Users on tablets and phones cannot:

- Draw or select layers with touch
- Use pinch-to-zoom or two-finger pan
- Access mobile-optimized toolbar

**Workaround:** Use desktop browser or browser with desktop mode.

---

## Architecture Concerns

### ⚠️ God Classes (Technical Debt)

**Status:** Monitored with CI enforcement  
**Severity:** Medium for maintainability

The codebase has **7 files exceeding 1,000 lines**. All have delegation patterns:

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,875 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,838 | ✅ 7 controllers | Stable |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing |
| LayersEditor.js | 1,324 | ✅ 3 modules | Stable |
| ToolManager.js | 1,264 | ✅ 2 handlers | Stable |
| SelectionManager.js | 1,194 | ✅ 3 modules | Stable |
| APIManager.js | 1,174 | ✅ APIErrorHandler | Stable |

**Total in god classes: ~10,208 lines** (22% of JS codebase)

**CI Protection:** `npm run check:godclass` blocks PRs that grow files beyond limits.

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

---

## Recently Fixed Issues

The following issues have been **fixed** and are now working:

### 1. Eyedropper Tool

**Status:** ✅ Available via browser's native color picker  
**Note:** Eyedropper functionality built into `<input type="color">` element

---

### 2. Smart Guides (December 20, 2025)

**Status:** ✅ Implemented  
**Behavior:** Automatic snapping when moving objects

**Implementation:**
- `SmartGuidesController.js` (~500 lines) provides object-to-object snapping
- Edge snapping: left, right, top, bottom (magenta guide lines)
- Center snapping: horizontal and vertical centers (cyan guide lines)
- 8px snap threshold (auto-activates when grid snap is off)
- 43 comprehensive tests

---

### 3. Undo (Ctrl+Z)

**Status:** ✅ Fixed  
**Button:** Toolbar undo button  
**Keyboard:** Ctrl+Z

**Fix Summary:**
- HistoryManager refactored with `getEditor()` and `getCanvasManager()` helper methods
- Proper reference chain established: `HistoryManager → editor → canvasManager`
- `updateUndoRedoButtons()` now correctly finds toolbar at `this.getEditor().toolbar`

---

### 4. Redo (Ctrl+Y / Ctrl+Shift+Z)

**Status:** ✅ Fixed  
**Button:** Toolbar redo button  
**Keyboard:** Ctrl+Y or Ctrl+Shift+Z

**Fix Summary:** Same as Undo - HistoryManager refactoring resolved both issues.

---

### 5. Duplicate Layer (Ctrl+D)

**Status:** ✅ Fixed  
**Button:** Toolbar duplicate button  
**Keyboard:** Ctrl+D

**Fix Summary:**
- Fixed `LayersEditor.duplicateSelected()` to use `getSelectedLayerIds()` properly
- Selection state now correctly reads from `canvasManager.getSelectedLayerIds()` method
- Duplicated layer receives new ID and is properly added to layer stack

---

### 6. Shadow Rendering Issues

**Status:** ✅ Fixed (December 8-10, 2025)

Multiple shadow-related bugs were fixed:
- Shadow offset not rotating with shape (spread > 0)
- Rectangle/shape stroke shadow not visible (spread = 0)
- Text shadow spread having no effect

See archived bug analyses in `docs/archive/` for details.

---

## Technical Details of Fixes

### Selection State Bug (Fixed)

**Root Cause:** StateManager uses `selectedLayerIds` (plural, array) while LayersEditor methods were incorrectly using `stateManager.get('selectedLayerId')` (singular) which returned `undefined`.

**Resolution:**
- `getSelectedLayerIds()` now delegates to `canvasManager.getSelectedLayerIds()` method
- `selectLayer()` delegates to CanvasManager or sets `selectedLayerIds` array directly
- `deleteSelected()` uses `getSelectedLayerIds()` and properly clears selection
- `duplicateSelected()` uses `getSelectedLayerIds()[last]` for primary selection
- `updateUIState()` uses `getSelectedLayerIds().length > 0` for hasSelection check
- `initializeState()` initializes `selectedLayerIds: []` instead of singular

### HistoryManager Integration Bug (Fixed)

**Root Cause:** Constructor stored editor as `canvasManager` but methods expected a different reference chain (`this.canvasManager.editor`).

**Resolution:**
- Added `getEditor()` helper that handles both old and new initialization patterns
- Added `getCanvasManager()` helper that properly retrieves canvas manager
- All methods updated to use helpers instead of direct property access

---

## Reporting Issues

If you encounter issues:

1. Check this document first
2. Search existing GitHub issues
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and MediaWiki version
   - Console errors (F12 → Console tab)

---

*Document created: December 8, 2025*  
*Last updated: December 20, 2025*
