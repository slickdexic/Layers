# Event Listener Audit Report

**Date:** December 16, 2025  
**Auditor:** Comprehensive static analysis  
**Total addEventListener calls:** 94  
**Total removeEventListener calls:** 33  

---

## Summary Table

| File | add | remove | Pattern | Status |
|------|-----|--------|---------|--------|
| **CanvasEvents.js** | 11 | 11 | Manual cleanup in destroy() | ✅ OK |
| **CanvasManager.js** | 4 | 3 | Fallback handlers with destroy() | ✅ OK |
| **EventManager.js** | 1 | 1 | registerListener with destroy() | ✅ OK |
| **EventTracker.js** | 2 | 4 | Utility class (provides cleanup) | ✅ OK |
| **ErrorHandler.js** | 2 | 1 | registerWindowListener with destroy() | ✅ OK |
| **LayersValidator.js** | 2 | 2 | Returns cleanup function | ✅ OK |
| **LayersEditor.js** | 6 | 1 | Uses EventTracker + dialog cleanup | ✅ OK |
| **LayerPanel.js** | 6 | 1 | Uses EventTracker with destroy() | ✅ OK |
| **Toolbar.js** | 2 | 0 | Uses EventTracker with destroy() | ✅ OK |
| **ToolManager.js** | 2 | 0 | DOM removal cleanup pattern | ⚠️ OK (DOM) |
| **ToolbarStyleControls.js** | 1 | 0 | Uses EventTracker with destroy() | ✅ OK |
| **UIManager.js** | 2 | 0 | Uses EventTracker with destroy() | ✅ OK |
| **ValidationManager.js** | 1 | 0 | Feature detection only | ✅ OK |
| **ImportExportManager.js** | 3 | 0 | DOM removal cleanup | ⚠️ REVIEW |
| **AccessibilityAnnouncer.js** | 1 | 0 | DOMContentLoaded with {once: true} | ✅ OK |
| **LayersNamespace.js** | 1 | 0 | DOMContentLoaded (permanent) | ✅ OK |
| **EditorBootstrap.js** | 5 | 0 | Global handlers (intentionally permanent) | ✅ OK |
| **DialogManager.js** | 8 | 3 | Per-dialog cleanup pattern | ✅ OK |
| **ColorPickerDialog.js** | 9 | 2 | close() method cleanup | ✅ OK |
| **ConfirmDialog.js** | 3 | 1 | close() method cleanup | ✅ OK |
| **PropertiesForm.js** | 10 | 0 | Factory pattern (DOM removal) | ⚠️ REVIEW |
| **LayerListRenderer.js** | 1 | 0 | Factory pattern (DOM removal) | ✅ OK |
| **LayerDragDrop.js** | 2 | 0 | Uses external EventTracker | ✅ OK |
| **LayerItemEvents.js** | 2 | 2 | destroy() method cleanup | ✅ OK |
| **TextInputController.js** | 4 | 0 | Modal DOM removal cleanup | ✅ OK |
| **LayersViewer.js** | 2 | 0 | destroy() method cleanup | ✅ OK |
| **init.js** | 1 | 0 | DOMContentLoaded (permanent) | ✅ OK |

---

## Detailed Analysis by Category

### 1. ✅ OK - Uses EventTracker (Automatic Cleanup)

These files properly use the EventTracker utility for managed cleanup:

| File | Cleanup Method | Notes |
|------|----------------|-------|
| **Toolbar.js** | `destroy()` → `eventTracker.destroy()` | All listeners via `addListener()` helper |
| **LayerPanel.js** | `destroy()` → `removeAllListeners()` | Uses `addDocumentListener()` and `addTargetListener()` |
| **UIManager.js** | `destroy()` → `eventTracker.destroy()` | Centralized event management |
| **ToolbarStyleControls.js** | `destroy()` → `eventTracker.destroy()` | Style control events |
| **LayersEditor.js** | Uses EventTracker via UIManager | Dialog cleanup via `registerDialogCleanup()` |
| **LayerDragDrop.js** | Uses external `addTargetListener` | Delegates to LayerPanel's EventTracker |

### 2. ✅ OK - Manual Cleanup in destroy()

These files manually track and remove listeners:

| File | Pattern | Notes |
|------|---------|-------|
| **CanvasEvents.js** | Stores bound handlers, removes in `destroy()` | 11 add, 11 remove - Perfect balance |
| **EventManager.js** | `registerListener()` stores in array | `destroy()` iterates and removes all |
| **ErrorHandler.js** | `registerWindowListener()` stores in array | `destroy()` cleans global listeners |
| **LayerItemEvents.js** | Bound handlers removed in `destroy()` | Tracks if external tracker was used |
| **LayersViewer.js** | Stores `boundWindowResize` reference | `destroy()` removes + ResizeObserver cleanup |

### 3. ✅ OK - Permanent/Global Handlers

These handlers are intentionally permanent for the page lifecycle:

| File | Handler Type | Justification |
|------|--------------|---------------|
| **EditorBootstrap.js** | `window.unhandledrejection` | Global error catching |
| **EditorBootstrap.js** | `window.error` | Global error catching |
| **EditorBootstrap.js** | `window.beforeunload` | Cleanup on navigation |
| **EditorBootstrap.js** | `DOMContentLoaded` | One-time initialization |
| **EditorBootstrap.js** | `mw.hook` | MediaWiki navigation |
| **LayersNamespace.js** | `DOMContentLoaded` | Namespace initialization |
| **init.js** | `DOMContentLoaded` | Viewer initialization |
| **AccessibilityAnnouncer.js** | `DOMContentLoaded` with `{once: true}` | Self-removing |

### 4. ✅ OK - Dialog/Modal Pattern

These use the standard dialog cleanup pattern where handlers are added per-dialog and removed on close:

| File | Pattern | Notes |
|------|---------|-------|
| **ColorPickerDialog.js** | `close()` removes keydown handlers | Focus trap, escape handlers |
| **ConfirmDialog.js** | `close()` removes keydown handler | Registered via `registerCleanup()` |
| **DialogManager.js** | Per-dialog `handleKey` cleanup function | Focus trap pattern |
| **LayersEditor.js** | `showCancelConfirmDialog` | Cleanup function removes handler |
| **LayerPanel.js** | `showRenameDialog` | Cleanup function removes handler |

### 5. ✅ OK - DOM Removal Cleanup (GC Handles)

These add listeners to elements that are removed from DOM, allowing garbage collection:

| File | Element Type | Notes |
|------|--------------|-------|
| **ToolManager.js** | Text input element | `showTextEditor()` creates temp input, removed on finish |
| **TextInputController.js** | Modal element | `hideTextInputModal()` removes entire modal from DOM |
| **LayerListRenderer.js** | Grab area keydown | Element recreated on each render, old removed |

### 6. ✅ OK - Factory Pattern (Parent Manages Lifecycle)

These are factory patterns where the parent component manages element lifecycle:

| File | Factory Method | Parent Cleanup |
|------|----------------|----------------|
| **LayerListRenderer.js** | `_createGrabArea()` | LayerPanel re-renders, replacing elements |
| **LayerDragDrop.js** | `setup()` | Uses external EventTracker from parent |

---

## ⚠️ Files Requiring Review

### 1. ImportExportManager.js (Minor)

**Issue:** Creates buttons with click handlers but no destroy() method.

```javascript
// Line 319-323
button.addEventListener( 'click', () => { input.click(); } );
input.addEventListener( 'change', () => { ... } );

// Line 367
button.addEventListener( 'click', () => { ... } );
```

**Risk:** LOW - These buttons are part of the toolbar UI which persists for the editor session. The editor's `destroy()` removes the entire UI container.

**Recommendation:** No action needed - DOM removal cleanup applies.

---

### 2. PropertiesForm.js (Minor)

**Issue:** Factory methods add listeners to form elements without explicit cleanup.

```javascript
// Lines 182, 217, 258, 317, 398, 405, 412, 448, 510, 513
input.addEventListener( 'input', function () { ... } );
input.addEventListener( 'change', function () { ... } );
// etc.
```

**Risk:** LOW - PropertiesForm creates form elements that are replaced when a different layer is selected. The inspector panel calls `renderPropertiesPanel()` which replaces the entire form, allowing GC to clean up old listeners.

**Recommendation:** No action needed - DOM removal cleanup applies.

---

## Architecture Notes

### EventTracker Utility

The codebase has a well-designed `EventTracker` utility class that:
- Tracks all added listeners
- Provides `destroy()` for bulk cleanup
- Supports `removeAllForElement()` and `removeAllOfType()`
- Used consistently across major components

### Cleanup Patterns Used

1. **EventTracker pattern**: Preferred for complex components
2. **Manual tracking array**: Used in EventManager, ErrorHandler
3. **Dialog cleanup registration**: `registerDialogCleanup(fn)` pattern
4. **DOM removal**: For temporary UI elements (modals, text inputs)
5. **Permanent handlers**: For global error handling and page lifecycle

---

## Conclusion

**Overall Status:** ✅ GOOD

The event listener management in the Layers extension is well-architected:

1. **No memory leaks identified** - All persistent components have proper cleanup
2. **Consistent patterns** - EventTracker used for complex components
3. **Dialog cleanup works** - Modal/dialog handlers properly removed
4. **Global handlers intentional** - Error handlers meant to persist

### Minor Improvements (Optional)

1. Add `destroy()` method to ImportExportManager for consistency
2. Consider EventTracker integration for PropertiesForm if it gets more complex
3. Document the cleanup patterns in ARCHITECTURE.md

---

## Files Scanned

```
resources/ext.layers.editor/
├── AccessibilityAnnouncer.js    ✅
├── CanvasEvents.js              ✅
├── CanvasManager.js             ✅
├── ErrorHandler.js              ✅
├── EventManager.js              ✅
├── EventTracker.js              ✅
├── ImportExportManager.js       ⚠️ Minor
├── LayerPanel.js                ✅
├── LayersEditor.js              ✅
├── LayersNamespace.js           ✅
├── LayersValidator.js           ✅
├── Toolbar.js                   ✅
├── ToolbarStyleControls.js      ✅
├── ToolManager.js               ✅
├── UIManager.js                 ✅
├── ValidationManager.js         ✅
├── canvas/
│   └── TextInputController.js   ✅
├── editor/
│   ├── DialogManager.js         ✅
│   └── EditorBootstrap.js       ✅
├── panel/
│   └── LayerItemEvents.js       ✅
└── ui/
    ├── ColorPickerDialog.js     ✅
    ├── ConfirmDialog.js         ✅
    ├── LayerDragDrop.js         ✅
    ├── LayerListRenderer.js     ✅
    └── PropertiesForm.js        ⚠️ Minor

resources/ext.layers/
├── init.js                      ✅
└── LayersViewer.js              ✅
```
