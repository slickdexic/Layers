# Known Issues

**Last Updated:** December 17, 2025  
**Version:** 1.1.0

This document lists known functionality issues and their current status.

---

## Architecture Concerns

### ⚠️ God Classes (Technical Debt)

**Status:** Ongoing concern  
**Severity:** Medium-High for maintainability

The codebase has **9 files exceeding 1,000 lines**, which impacts:
- New contributor onboarding
- Test thoroughness
- Code review efficiency
- Risk of unintended side effects

| File | Lines | Notes |
|------|-------|-------|
| CanvasManager.js | 1,893 | Facade pattern, delegates to 10+ controllers |
| LayerPanel.js | 1,720 | Delegates to 7 controllers |
| APIManager.js | 1,385 | Needs API/state separation |
| ShapeRenderer.js | 1,367 | **Grew with Text Box feature** |
| LayersEditor.js | 1,296 | Main entry point |
| SelectionManager.js | 1,266 | Core selection logic |
| ToolManager.js | 1,180 | Needs tool extraction |
| CanvasRenderer.js | 1,132 | Rendering logic |
| Toolbar.js | 1,126 | UI controls |

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

### ⚠️ E2E Tests Not in CI

**Status:** Not started  
**Severity:** Medium

Playwright tests exist in `tests/e2e/layers.spec.js` but are not running in CI. This means browser-level bugs may go undetected.

**Recommendation:** Set up GitHub Actions workflow with Docker-based MediaWiki.

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
*Last updated: December 17, 2025*
