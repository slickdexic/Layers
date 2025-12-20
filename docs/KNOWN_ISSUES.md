# Known Issues

**Last Updated:** December 20, 2025  
**Version:** 1.1.7

This document lists known functionality issues and their current status.

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
| CanvasManager.js | 1,830 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,821 | ✅ 7 controllers | Stable |
| LayersEditor.js | 1,329 | ✅ 3 modules | Stable |
| Toolbar.js | 1,298 | ✅ 4 modules | Stable |
| ToolManager.js | 1,275 | ✅ 2 handlers | Stable |
| SelectionManager.js | 1,181 | ✅ 3 modules | Stable |
| APIManager.js | 1,161 | ✅ APIErrorHandler | Stable |

**Total in god classes: ~10,895 lines** (24% of JS codebase)

**CI Protection:** `npm run check:godclass` blocks PRs that grow files beyond limits.

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

---

## Recently Fixed Issues

The following issues have been **fixed** and are now working:

### 1. Eyedropper Tool (NEW - December 20, 2025)

**Status:** ✅ Implemented  
**Keyboard:** I (fill), Shift+I (stroke)  
**Button:** Next to color controls in toolbar

**Implementation:**
- `EyedropperController.js` (~480 lines) provides color sampling from canvas
- 8x magnified preview with crosshair shows sampling area
- Color swatch displays hex value and target (fill/stroke)
- Toolbar button for easy discovery (right-click for stroke mode)
- 59 comprehensive tests

---

### 2. Smart Guides (NEW - December 20, 2025)

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
