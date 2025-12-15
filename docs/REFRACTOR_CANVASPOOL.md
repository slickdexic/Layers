**CanvasPoolController extraction**

Summary

- Extracted temporary canvas pooling logic from `CanvasManager` into a new module: `resources/ext.layers.editor/canvas/CanvasPoolController.js`.
- `CanvasManager` now attempts to initialize `CanvasPoolController` if available and delegates `getTempCanvas` and `returnTempCanvas` to it. If the controller is not present, the original fallback logic remains in `CanvasManager`.

Why

- `CanvasManager` is large and contains multiple responsibilities. Pooling of temporary canvases is an isolated concern and a safe first extraction.
- Extraction reduces surface area for future refactors and makes pooling behavior easier to test and reason about.

What changed

- New file: `resources/ext.layers.editor/canvas/CanvasPoolController.js` — implements `getTempCanvas`, `returnTempCanvas`, and `destroy`.
- `CanvasManager.js`:
  - Added `CanvasPoolController` to `CLASS_NAMESPACE_MAP`.
  - Initializes `canvasPoolController` during `init()` when available.
  - Delegates `getTempCanvas` and `returnTempCanvas` to the controller if present.
  - Ensures `canvasPoolController` is destroyed during `destroy()`.

Testing

- The extraction is implemented with a non-breaking fallback. Running the test suite should confirm no regressions.

Next steps

- Add unit tests for `CanvasPoolController` specifically (create `tests/jest/CanvasPoolController.test.js`).
- Consider extracting other responsibilities one-by-one (e.g., rendering coordinator, transform helpers).
- Track progress in `improvement_plan.md` and update the refactor checklist.
