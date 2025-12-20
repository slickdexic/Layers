# Known Issues

**Last Updated:** December 19, 2025  
**Version:** 1.1.5

This document lists known functionality issues and their current status.

---

## Active Issues

### ⚠️ One Failing Test (JSDOM Issue)

**Status:** Active  
**Severity:** Low  
**File:** `tests/jest/ImportExportManager.test.js`

The test `createImportButton callbacks › should call onError callback on import failure` fails due to JSDOM limitations with async DOM cleanup.

**Root Cause:** `removeChild` is called on an element that's no longer in the DOM due to async timing in JSDOM.

**Impact:** Test environment only. Not a production bug.

**Fix:** Mock `document.body.removeChild` or check `parentNode` before removal.

### ⚠️ No Mobile/Touch Support

**Status:** Not Implemented  
**Severity:** Medium for desktop-focused, High for mobile users

The editor does not handle touch events. Users on tablets and phones cannot:

- Draw or select layers with touch
- Use pinch-to-zoom or two-finger pan
- Access mobile-optimized toolbar

**Workaround:** Use desktop browser or browser with desktop mode.

### ⚠️ Missing Eyedropper Tool

**Status:** Not Implemented  
**Severity:** Low  

Color picker lacks eyedropper functionality to sample colors from the canvas or image. Users must manually enter color values.

---

## Architecture Concerns

### ⚠️ God Classes (Technical Debt)

**Status:** Monitored with CI enforcement  
**Severity:** Medium for maintainability

The codebase has **9 files exceeding 1,000 lines**. All have delegation patterns but remain large:

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,830 | ✅ 10+ controllers | ↑ Growing |
| LayerPanel.js | 1,821 | ✅ 7 controllers | ↑ Growing |
| LayersEditor.js | 1,329 | ✅ 3 modules | Stable |
| Toolbar.js | 1,298 | ✅ 4 modules | ↑ Growing |
| ToolManager.js | 1,275 | ✅ 2 handlers | Stable |
| ShapeRenderer.js | 1,191 | ✅ ShadowRenderer | ↑ Growing |
| SelectionManager.js | 1,181 | ✅ 3 modules | Stable |
| APIManager.js | 1,161 | ✅ APIErrorHandler | Stable |
| ToolbarStyleControls.js | 1,049 | ⚠️ None | **NEW** |

**Total in god classes: ~12,135 lines** (28% of JS codebase)

**CI Protection:** `npm run check:godclass` blocks PRs that grow files beyond limits.

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

### ⚠️ Code Volume Growing

**Status:** Needs attention  
**Severity:** Medium

Codebase grew from 40,865 lines (Dec 18) to 43,641 lines (Dec 19) - 6.8% in one day.

**Recommendation:** Implement 1:1 extraction rule (new features require equivalent refactoring).

---

## Recently Fixed Issues

The following issues have been **fixed** and are now working:

### 1. Undo (Ctrl+Z)

**Status:** ✅ Fixed  
**Button:** Toolbar undo button  
**Keyboard:** Ctrl+Z

**Fix Summary:**
- HistoryManager refactored with `getEditor()` and `getCanvasManager()` helper methods
- Proper reference chain established: `HistoryManager → editor → canvasManager`
- `updateUndoRedoButtons()` now correctly finds toolbar at `this.getEditor().toolbar`

---

### 2. Redo (Ctrl+Y / Ctrl+Shift+Z)

**Status:** ✅ Fixed  
**Button:** Toolbar redo button  
**Keyboard:** Ctrl+Y or Ctrl+Shift+Z

**Fix Summary:** Same as Undo - HistoryManager refactoring resolved both issues.

---

### 3. Duplicate Layer (Ctrl+D)

**Status:** ✅ Fixed  
**Button:** Toolbar duplicate button  
**Keyboard:** Ctrl+D

**Fix Summary:**
- Fixed `LayersEditor.duplicateSelected()` to use `getSelectedLayerIds()` properly
- Selection state now correctly reads from `canvasManager.getSelectedLayerIds()` method
- Duplicated layer receives new ID and is properly added to layer stack

---

### 4. Shadow Rendering Issues

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
*Last updated: December 18, 2025*
