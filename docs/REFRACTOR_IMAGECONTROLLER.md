CanvasImageController extraction

Summary

- Extracted background image loading and lifecycle management into a new module: `resources/ext.layers.editor/canvas/CanvasImageController.js`.
- `CanvasManager` now attempts to initialize `CanvasImageController` if available and delegates `loadBackgroundImage()` to it. If the controller is not present, `CanvasManager` continues using its previous `ImageLoader` logic and fallback.

Why

- Image loading is an independent concern. Moving it into a dedicated controller simplifies testing and makes the `CanvasManager` smaller and more focused.

What changed

- New file: `resources/ext.layers.editor/canvas/CanvasImageController.js` — implements `load(filename, backgroundImageUrl)`, `_handleLoaded`, `_handleError`, and `destroy`.
- `CanvasManager.js`:
  - Added `CanvasImageController` to `CLASS_NAMESPACE_MAP`.
  - Initializes `imageController` during `init()` when available.
  - Delegates `loadBackgroundImage()` to `imageController` when present; preserves existing `ImageLoader` fallback.

Testing

- Extraction implemented as non-breaking; running the test suite verifies behavior.

Next steps

- Add unit tests for `CanvasImageController`.
- Consider consolidating other image-related helpers into this controller (resize logic, image caching).
- Update `improvement_plan.md` with this refactor step.
