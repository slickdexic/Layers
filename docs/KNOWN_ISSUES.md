# Known Issues

**Last Updated:** December 18, 2025  
**Version:** 1.1.3

This document lists known functionality issues and their current status.

---

## Architecture Concerns

### ⚠️ God Classes (Technical Debt)

**Status:** Ongoing concern - being addressed  
**Severity:** Medium-High for maintainability

The codebase has **8 files exceeding 1,000 lines**, which impacts:
- New contributor onboarding
- Test thoroughness
- Code review efficiency
- Risk of unintended side effects

| File | Lines | Notes |
|------|-------|-------|
| CanvasManager.js | 1,805 | Facade pattern, delegates to 10+ controllers |
| LayerPanel.js | 1,720 | Delegates to 7 controllers |
| LayersEditor.js | 1,301 | Partial delegation |
| ToolManager.js | 1,275 | Delegates to 2 handlers |
| APIManager.js | 1,168 | Delegates to APIErrorHandler |
| SelectionManager.js | 1,147 | ⚠️ **No delegation - needs split** |
| Toolbar.js | 1,115 | Needs split |
| ShapeRenderer.js | 1,049 | Needs split |

**Recently Addressed:**
- ✅ CanvasRenderer.js: 1,132 → 834 lines (SelectionRenderer extracted)
- ✅ APIManager.js: 1,385 → 1,168 lines (APIErrorHandler extracted)
- ✅ ShapeRenderer.js: 1,367 → 1,049 lines (TextBoxRenderer extracted)

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

### ⚠️ E2E Tests Not Fully Enabled

**Status:** Smoke tests only  
**Severity:** Medium

Playwright tests exist but editor tests have `continue-on-error: true` in CI, effectively disabling them.

**Recommendation:** Fix editor tests and remove `continue-on-error`.

### ⚠️ One Flaky Test

**Status:** Known  
**File:** `tests/jest/performance/RenderBenchmark.test.js`

Memory assertion is unreliable due to GC timing. Needs fix or removal.

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
