# Known Issues

**Last Updated:** January 2025  
**Version:** 0.8.1-dev

This document lists known functionality issues and their current status.

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

## Remaining Known Issues

### ~~Shadow Offset Not Rotating with Shape (Spread > 0 Only)~~ - FIXED

**Status:** ✅ Fixed (December 8, 2025)

**Original Issue:**
When rotating a shape with shadow **spread > 0**, the shadow would dramatically move vertically instead of staying aligned with the rotated shape.

**Root Cause:**
The `drawSpreadShadow()` method copied the full rotation transform to a temp canvas, then applied `translate(FAR_OFFSET, 0)` in the rotated coordinate space. But the shadow offset compensation assumed FAR_OFFSET was horizontal in screen space - these didn't align when rotated.

**Fix Applied:**
Extract rotation from transform matrix, use translation-only transform for temp canvas, apply rotation manually just for shape drawing. This keeps FAR_OFFSET horizontal so shadow offset compensation works correctly.

See [BUG_SHADOW_ROTATION_2025-12-08.md](archive/BUG_SHADOW_ROTATION_2025-12-08.md) for detailed analysis.

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
*Last updated: January 2025*
