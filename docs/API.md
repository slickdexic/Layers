# Layers API and code reference

Reviewed October 24, 2026. Start with the [page-owned API guide](PAGE_OWNED_API_GUIDE.md)
for native snapshot reads, atomic publication, Import, source delivery, privacy
and permissions. The [legacy Action API reference](../wiki/API-Reference.md)
retains shared-storage contracts for older/pre-completion deployments. The
candidate's dynamic registration includes more than the static legacy modules.

The previous contents of this file were a generated snapshot of selected JavaScript modules, not a complete PHP Action API reference. They were frequently mistaken for endpoint documentation. Generate JavaScript documentation from the checkout you are developing:

```sh
npm ci
npm run docs
```

`jsdoc.config.json` controls the input and output directories. Do not edit generated output to change API behavior. `npm run docs:markdown` writes a selected top-level JavaScript snapshot to `docs/API.generated.md`, leaving this maintained entry point intact. The generated artifact is ignored by Git; review it locally against the source.

## Source entry points

| Area | Source |
| --- | --- |
| Native registration/configuration | [extension.json](../extension.json) · [PageOwnedPilotRegistration.php](../src/Hooks/PageOwnedPilotRegistration.php) · [services.php](../services.php) |
| Native publish/read APIs | [ApiLayersPublish.php](../src/Api/ApiLayersPublish.php) · [ApiLayersRead.php](../src/Api/ApiLayersRead.php) |
| Owner/source admission | [PageOwnedPilot.php](../src/Revision/PageOwnedPilot.php) · [PageHistoryAccess.php](../src/Revision/PageHistoryAccess.php) |
| Native document/identity | [DocumentSchema.php](../src/Revision/DocumentSchema.php) · [LayerSetIdentity.php](../src/Revision/LayerSetIdentity.php) |
| Legacy save/read | [ApiLayersSave.php](../src/Api/ApiLayersSave.php) · [ApiLayersInfo.php](../src/Api/ApiLayersInfo.php) |
| Legacy delete/rename | [ApiLayersDelete.php](../src/Api/ApiLayersDelete.php) · [ApiLayersRename.php](../src/Api/ApiLayersRename.php) |
| Legacy slide listing/export | [ApiLayersList.php](../src/Api/ApiLayersList.php) · [ApiLayersExport.php](../src/Api/ApiLayersExport.php) |
| Validation | [ServerSideLayerValidator.php](../src/Validation/ServerSideLayerValidator.php) · [LayerLinkValidator.php](../src/Validation/LayerLinkValidator.php) |
| Native/legacy persistence | [PageRevisionWriter.php](../src/Revision/PageRevisionWriter.php) · [LayersDatabase.php](../src/Database/LayersDatabase.php) |
| Viewer | [LayersViewer.js](../resources/ext.layers/LayersViewer.js) · [LayersLightbox.js](../resources/ext.layers/viewer/LayersLightbox.js) |
| Editor | [LayersEditor.js](../resources/ext.layers.editor/LayersEditor.js) · [APIManager.js](../resources/ext.layers.editor/APIManager.js) |

Use [UPGRADING](UPGRADING.md) for completion prerequisites and the
[release checklist](MILESTONE_1_RELEASE_CHECKLIST.md) for remaining acceptance.
The [architecture](ARCHITECTURE.md) and older proposals contain dated design
records; their old unregistered/default-off statements do not override the
current source and API guide. Later search/Cargo/link milestones do not hold up
the page-ownership release.
