# Layers architecture

Reviewed September 6, 2026. The current architecture supports images, PDF pages and standalone slides. It does not yet store annotations as MediaWiki article revisions.

## Data and authority

`layer_sets` is the authoritative annotation store. A row is a revision identified by source name/hash, set name and source document page. Slides use `Slide:{name}` and the `slide` hash sentinel. `ls_page` is a PDF page number, not a wiki page ID.

The serialized envelope contains layers, background/canvas settings and revision metadata. New saves preserve a server-generated `ownerId`; the row's user is the editor of that revision. Pruning retains the configured number of revisions, so references to arbitrary old rows are not permanent history.

File reads and writes apply the appropriate source permissions. Delete/rename also enforce creator or `layers-admin` authority across the affected scope. Slides currently have global Layers identities, not SOP-page ownership. The proposed page-owned mode is a different architecture and must not be inferred from current parser output.

## Server components

| Component | Responsibility |
| --- | --- |
| `extension.json`, `services.php` | ResourceLoader modules, hooks, settings, rights and service wiring |
| `src/Api/` | Six Action API endpoints for reading, saving, deleting, renaming, listing slides and exporting files |
| `src/Validation/` | Payload, text, color, set-name and slide-name validation |
| `src/Database/` | Layer persistence, pruning, ownership and schema migration |
| `src/Hooks/` | File/wikitext integration, slide parser function and Cargo gallery hints |
| `src/SpecialPages/` | Slide management/editor and checked export delivery |
| `src/ThumbnailRenderer.php`, `src/Utility/RenderCache.php` | Server rendering/cache support |

Cargo's current integration chooses gallery sets from query-result fields. It is not a text-binding engine or a projection of annotation text into Cargo tables.

## Browser components

| Area | Responsibility |
| --- | --- |
| `resources/ext.layers.editor/` | Editor UI, state, history, input, selection and API orchestration |
| `resources/ext.layers/` | Inline viewer and viewer integration |
| `resources/ext.layers/viewer/` | Lightbox, PDF rasterization, printing/download and supporting utilities |
| `resources/ext.layers.shared/` | Shared drawing primitives and rendering |
| `resources/lib/pdfjs/` | Vendored PDF browser assets, loaded on demand |

`LayersEditor` coordinates state/managers. `APIManager` applies fetched data only when its request and navigation generation are current. PDF page changes buffer edited pages; Save sends per-page writes, not a single atomic transaction. A successful current-page write does not establish that every buffered page saved.

`LayersViewer` draws on a canvas sized to the displayed image using stored coordinate dimensions. `LayersLightbox` can replace a server thumbnail with a browser PDF raster. Detached image callbacks and superseded requests must not initialize an overlay on the replacement view. The shared drawing pipeline also supports standalone slides without a parent file.

## Render, cache and export boundaries

Layer changes invalidate the File page and its embedding backlinks where the current invalidation path can identify them. Cache invalidation is neither a page revision nor an annotation-search indexing contract.

Client flattening and server ImageMagick export are separate implementations; server output still has property/failure limitations. Cached PDF delivery is bound to its source title and checked through `Special:LayersExport`. Do not expose the private cache directory directly.

The legacy audit trait re-saves unchanged File-page content after a layer mutation. That is best-effort and does not guarantee a new MediaWiki revision. Do not build compliance or history-dependent integrations on it.

## Development and future changes

Use [the API guide](API.md), [developer onboarding](DEVELOPER_ONBOARDING.md) and the source directories above for implementation details. See [current limitations](https://github.com/slickdexic/Layers/wiki/Current-Status) and the [page-owned history/search/Cargo proposal](https://github.com/slickdexic/Layers/blob/main/docs/proposals/CARGO_SEARCH_PAGE_HISTORY.md).

The next storage design must make page revisions authoritative, then derive search text and Cargo rows from published revisions. Those features are not implemented. Absolute line counts and old coverage snapshots are omitted here because they are not architectural guarantees.
