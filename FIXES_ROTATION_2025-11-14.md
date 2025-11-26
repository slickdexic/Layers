# Rotation Handle Fix - 2025-11-14

## Issue
User reported that "Layer rotation by grab-handle does not work".
This was caused by `CanvasEvents.js` using `CanvasManager.hitTestSelectionHandles` which did not correctly delegate to `SelectionManager` when the renderer was not providing handles (or when `SelectionManager` was the source of truth for handles).

## Fix
1.  **Unified Hit Testing in `CanvasManager.js`**:
    *   Updated `hitTestSelectionHandles` to check for handles in the following order:
        1.  `this.renderer.selectionHandles` (if available)
        2.  `this.selectionManager.selectionHandles` (if available)
        3.  `this.selectionHandles` (fallback)
    *   Updated `hitTestSelectionHandles` to support handle objects that contain a `rect` property (used by `SelectionManager`), in addition to handles that are rects themselves.

2.  **Simplified `updateCursor` in `CanvasManager.js`**:
    *   Refactored `updateCursor` to use the unified `hitTestSelectionHandles` method instead of manually checking `selectionManager`.

3.  **Updated Tests**:
    *   Updated `tests/jest/RotationHandle.test.js` to correctly mock `selectionManager.selectionHandles` instead of the method `hitTestSelectionHandles`.
    *   Fixed `updateCursor` test usage to pass a point object `{x, y}` instead of an event object, matching the method signature.

## Verification
*   Ran `npm run test:js` and all 184 tests passed.
*   Verified that `RotationHandle.test.js` passes with the new logic.

## Files Modified
*   `resources/ext.layers.editor/CanvasManager.js`
*   `tests/jest/RotationHandle.test.js`
