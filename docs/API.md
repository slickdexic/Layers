# Layers API and code reference

Updated September 6, 2026. The maintained server interface is the [Action API reference](../wiki/API-Reference.md), covering all six registered modules, slide/file identifiers, document-page scoping, permissions, CSRF, payloads and exports.

The previous contents of this file were a generated snapshot of selected JavaScript modules, not a complete PHP Action API reference. They were frequently mistaken for endpoint documentation. Generate JavaScript documentation from the checkout you are developing:

```sh
npm ci
npm run docs
```

`jsdoc.config.json` controls the input and output directories. Do not edit generated output to change API behavior. `npm run docs:markdown` writes a selected top-level JavaScript snapshot to `docs/API.generated.md`, leaving this maintained entry point intact. The generated artifact is ignored by Git; review it locally against the source.

## Source entry points

| Area | Source |
| --- | --- |
| Registered actions/configuration | [extension.json](../extension.json) |
| Save API | [ApiLayersSave.php](../src/Api/ApiLayersSave.php) |
| Read API | [ApiLayersInfo.php](../src/Api/ApiLayersInfo.php) |
| Delete/rename | [ApiLayersDelete.php](../src/Api/ApiLayersDelete.php) · [ApiLayersRename.php](../src/Api/ApiLayersRename.php) |
| Slide listing | [ApiLayersList.php](../src/Api/ApiLayersList.php) |
| Server export | [ApiLayersExport.php](../src/Api/ApiLayersExport.php) |
| Validation | [ServerSideLayerValidator.php](../src/Validation/ServerSideLayerValidator.php) · [LayerLinkValidator.php](../src/Validation/LayerLinkValidator.php) |
| Persistence | [LayersDatabase.php](../src/Database/LayersDatabase.php) |
| Viewer | [LayersViewer.js](../resources/ext.layers/LayersViewer.js) · [LayersLightbox.js](../resources/ext.layers/viewer/LayersLightbox.js) |
| Editor | [LayersEditor.js](../resources/ext.layers.editor/LayersEditor.js) · [APIManager.js](../resources/ext.layers.editor/APIManager.js) |

See [Architecture](ARCHITECTURE.md), [current limitations](CURRENT_STATUS.md), and [the future revision/search/Cargo design](proposals/CARGO_SEARCH_PAGE_HISTORY.md). Proposed APIs are not available in the current implementation.
