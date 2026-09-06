# Frontend architecture

Reviewed September 6, 2026. See [[Architecture Overview]] for storage/server boundaries and [[API Reference]] for request contracts.

## Modules

ResourceLoader declarations in `extension.json` determine execution order. The viewer lives under `resources/ext.layers`, the editor under `resources/ext.layers.editor`, and rendering shared between them under `resources/ext.layers.shared`. PDF browser assets are vendored and loaded on demand; slides and ordinary images must remain usable without PDF initialization.

## State and lifecycle rules

- Use the editor's state/store and manager interfaces. Do not add a parallel dirty flag or bypass the API manager's state processing.
- Keep source coordinate dimensions separate from display size and zoom. A slide has canvas dimensions; an image has source dimensions; each PDF page can differ.
- Navigation must retain the selected set, backgrounds, dimensions and unsaved layers. Buffered-page saving is currently sequential and can partially succeed.
- Tag asynchronous work with request/session generations. Ignore stale success and failure paths before they mutate state, hide loading indicators or attach overlays.
- Destroy viewers/listeners when replacing content. A detached thumbnail may still fire its load handler; it must not attach a full-resolution canvas to the current view.
- Preserve explicit false/zero values. `opacity || 1` is incorrect when zero is valid.
- Keep layer mutations, undo/redo and UI selection synchronized; test real user paths rather than only controller internals.

## Rendering and export

`LayersViewer` renders overlays; the lightbox controls images, navigation, zoom, print and download. Shared renderer classes implement layer geometry and effects. Export must wait for asynchronous assets where required. Browser and server export are not interchangeable and do not have identical fidelity; see [[Current Status]].

## Text and SOPs

Textbox/callout text is structured data, including rich-text runs. Canvas drawing does not make that text available to ordinary MediaWiki search or screen readers automatically. A reusable text extractor, accessible transcript and explicit indexing are planned. Keep images, standalone slides and PDF pages in the acceptance matrix.

## Tests and source

See [[Testing Guide]]. Relevant regressions include `tests/jest/DocumentSafety.test.js`, `LayersLightbox.test.js`, `LayersViewer.test.js` and manager/renderer suites. The checked-in source is the reference for namespace exports and manager signatures; old line-count tables are not maintained.
