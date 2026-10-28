# Architecture overview

Reviewed for the page-history candidate. After migration completion, image, PDF and slide layer sets are owned by a wiki page and saved in that page's native revision history. The target release is Layers 1.8; the current manifest remains 1.5.95 until the release cut. See [[Current Status]] for acceptance limits.

## Data and authority

After migration, the owning page's `layers` slot is authoritative for its layer sets. A successful Save publishes the complete snapshot in a native page revision. Identity is scoped to the owning page and its file or slide and set name. PDF page numbers select members of the same named set; they are not wiki page IDs or separate visible set names. Source versions and reader permissions are checked for historical viewing.

Before migration, `layer_sets` is the shared store. A row is a revision identified by source name/hash, set name and source document page. Slides use `Slide:{name}` and the `slide` hash sentinel. Legacy rows retain their metadata and configured retention rules; those rules do not prune native page history. Shared writes become read-only after migration completion, while old rows remain for history and recovery.

Native editing checks the owning page's read/edit authority, `editlayers`, source visibility and the current base revision. Legacy delete/rename also enforce their creator or `layers-admin` rules. The [upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md) explains migration and the distinction between schema updates and completion.

## Server components

| Component | Responsibility |
| --- | --- |
| `extension.json`, `services.php` | ResourceLoader modules, hooks, settings, rights and service wiring |
| `src/Api/` | Native and legacy Action API endpoints for authorized reads, publication, migration support and exports |
| `src/Content/`, `src/Revision/` | Native slot content, revision access, source checks and complete-snapshot publication |
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

`LayersEditor` coordinates state/managers. `APIManager` applies fetched data only when its request and navigation generation are current. For page-owned content, PDF page changes preserve the working members and Save publishes the complete owner snapshot in one native revision. Refused or uncertain saves must preserve local work; the legacy shared-storage save path is separate.

`LayersViewer` draws on a canvas sized to the displayed image using stored coordinate dimensions. `LayersLightbox` can replace a server thumbnail with a browser PDF raster. Detached image callbacks and superseded requests must not initialize an overlay on the replacement view. The shared drawing pipeline also supports standalone slides without a parent file.

## Render, cache and export boundaries

Native saves create an owning-page revision; cache invalidation and search indexing are separate concerns. Legacy shared-set changes use their existing File-page/backlink invalidation paths. Cache invalidation alone is neither a revision nor a layer-text search guarantee.

Client flattening and server ImageMagick export are separate implementations; server output still has property/failure limitations. Cached PDF delivery is bound to its source title and checked through `Special:LayersExport`. Do not expose the private cache directory directly.

The legacy audit trait re-saves unchanged File-page content after a layer mutation. That is best-effort and does not guarantee a new MediaWiki revision. Do not build compliance or history-dependent integrations on it.

## Development and future changes

Use the [repository architecture guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/ARCHITECTURE.md) and source for implementation details. See [[Current Status]] and the [release checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/RELEASE_1_8_ACCEPTANCE.md).

Page-owned history is the independent 1.8 release milestone. Built-in layer-text search, Cargo readiness, Cargo integration and on-page layer links follow as separate milestones; existing legacy helpers do not establish acceptance of those later features.
