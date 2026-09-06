# Canvas modules

Reviewed September 6, 2026. These modules separate canvas input, transforms, selection, rendering support and viewport behavior from the editor coordinator. Use the actual files and their tests for current interfaces; previous extraction-phase line counts were historical snapshots.

- `ZoomPanController.js`: viewport zoom/pan and coordinate conversions.
- `SmartGuidesController.js`: snapping and alignment guides.
- `TransformController.js`: resize/rotate interactions.
- Other controllers in this directory own the corresponding selection, drawing or input responsibilities; consult their class headers before adding behavior to `CanvasManager`.

Keep source coordinates distinct from displayed pixels. Changes must work on images, standalone slide canvases and PDF pages. Preserve history/state consistency, explicit zero/false settings and cleanup of asynchronous work.

See [architecture](../../../docs/ARCHITECTURE.md), [contribution rules](../../../CONTRIBUTING.md), and [test guidance](../../../wiki/Testing-Guide.md). Run focused tests for the affected controller and `npm test` before publishing behavior changes.
