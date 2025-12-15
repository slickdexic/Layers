# Event Listener Audit (quick scan)

Generated: 2025-12-15

This file contains a short, reproducible audit of `addEventListener` and `removeEventListener` usage found under `resources/` in the workspace snapshot.

Summary (top files by occurrence)

ADD (top entries):
- `resources/ext.layers.editor/CanvasEvents.js`: 11
- `resources/ext.layers.editor/ui/PropertiesForm.js`: 10
- `resources/ext.layers.editor/ui/ColorPickerDialog.js`: 9
- `resources/ext.layers.editor/editor/DialogManager.js`: 8
- `resources/ext.layers.editor/LayersEditor.js`: 6
- `resources/ext.layers.editor/LayerPanel.js`: 6
- `resources/ext.layers.editor/editor/EditorBootstrap.js`: 5
- `resources/ext.layers.editor/CanvasManager.js`: 4
- `resources/ext.layers.editor/canvas/TextInputController.js`: 4
- `resources/ext.layers.editor/ui/ConfirmDialog.js`: 3

REMOVE (top entries):
- `resources/ext.layers.editor/CanvasEvents.js`: 11
- `resources/ext.layers.editor/EventTracker.js`: 4
- `resources/ext.layers.editor/editor/DialogManager.js`: 3
- `resources/ext.layers.editor/CanvasManager.js`: 3
- `resources/ext.layers.editor/ui/ColorPickerDialog.js`: 2
- `resources/ext.layers.editor/panel/LayerItemEvents.js`: 2
- `resources/ext.layers.editor/LayersValidator.js`: 2

Observations

- Many files register and also remove listeners (`CanvasEvents.js` shows matching counts for add/remove).
- Dialogs and UI modules (`ColorPickerDialog.js`, `ConfirmDialog.js`, `DialogManager.js`) register DOM listeners and usually remove them on cleanup — these are typical and expected.
- `PropertiesForm.js` shows many `addEventListener` calls; review this file to confirm paired cleanup when the form is destroyed.
- `EventTracker.js` registers multiple listeners and provides a centralized cleanup (it appears in the remove list).
- Tests include explicit teardown checks (see `tests/jest/EventTeardown.test.js`) which assert listener counts don't grow across create/destroy cycles.

Actionable next steps

1. Review `resources/ext.layers.editor/ui/PropertiesForm.js` for proper teardown hooks.
2. Confirm editor lifecycle calls destroy/cleanup on `EditorBootstrap` and `LayersEditor` so UI listeners are removed when the editor is destroyed or reinitialized.
3. Add a short CI smoke test that runs the existing `EventTeardown.test.js` (already present) in a headless environment to prevent regressions.

How I generated these counts

From the repository root (copiable):

```bash
grep -R -n --include='*.js' -E 'addEventListener' resources | cut -d: -f1 | sort | uniq -c | sort -rn | head -n 40
grep -R -n --include='*.js' -E 'removeEventListener' resources | cut -d: -f1 | sort | uniq -c | sort -rn | head -n 40
```

Notes

- This is a quick, static grep-based audit. It intentionally includes only `resources/` files and excludes generated vendor artifacts and tests for clarity.
- The presence of unmatched `addEventListener` is not necessarily a bug if the listener is intended to be global or permanent; focus the review on listeners attached to ephemeral DOM elements or on objects that are destroyed and recreated.
