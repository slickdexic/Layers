# Configuration reference

## Guarded editor entry — September 20, 2026

`Special:EditLayersPage` is registered but page-owned editing remains disabled by default. It requires LayersPageOwnedPilotEnabled, an exact retained owner entry in LayersPageOwnedPilotOwners, a registered user authorized to read/edit/editlayers, an existing Layers slot and a selected slide surface in the explicit current revision. Supply owner, revid and surface query parameters; no default/latest fallback or automatic creation is provided. Responses are not cacheable. Asset-backed surfaces, migration and historical viewing are not enabled by this entry. Do not enable it for production; see the current handoff/status for browser acceptance gates. Docker is not required by this route.

## Experimental page-owned revision pilot

`$wgLayersPageOwnedPilotEnabled` defaults to `false`. It gates the experimental read/publication APIs; it does not connect editor saves or enable a historical viewer. Keep it disabled outside lead-controlled acceptance.

`$wgLayersPageOwnedPilotOwners` defaults to `[]`. Entries are exact canonical local prefixed DB keys. A retained scope installs the native content role and save/import/move/restore/merge guards even with publication disabled. Never remove retained owners while current or archived pilot revisions exist. These pilot restrictions are not completed production lifecycle support. See [Current Status](Current-Status.md) before considering enablement. No Docker runtime is involved.

Reviewed September 6, 2026 against `extension.json` on main. Set overrides in `LocalSettings.php` after `wfLoadExtension( 'Layers' );`. Values below are extension defaults, not MediaWiki core defaults.

## Registered settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `$wgLayersEnable` | `true` | Master switch for Layers extension functionality |
| `$wgLayersDebug` | `false` | Enable verbose debug logging to the 'Layers' log channel. Set to true in LocalSettings.php for development. |
| `$wgLayersMaxBytes` | `2097152` | Maximum JSON size per layer set in bytes |
| `$wgLayersMaxLayerCount` | `100` | Maximum number of layers per layer set |
| `$wgLayersMaxComplexity` | `100` | Maximum complexity score for a layer set. Each layer type has a cost (text: 2, image: 3, shapes: 1, etc). Total must not exceed this value. |
| `$wgLayersMaxImageBytes` | `1048576` | Maximum size in bytes for imported image layers (base64 encoded). Default 1MB. Recommended: 512KB-2MB depending on storage capacity. |
| `$wgLayersMaxImportSide` | `2048` | Maximum width/height in pixels for client-side downscaling of imported image layers before upload. Images larger than this on their longest side are resized to fit. Default 2048. |
| `$wgLayersImportJpegQuality` | `0.8` | JPEG quality (0.1-1.0) used when re-encoding downscaled imported images to reduce payload size. Only applied when the re-encoded result is smaller than the original. Default 0.8. |
| `$wgLayersMaxNamedSets` | `15` | Maximum number of named layer sets per image |
| `$wgLayersMaxRevisionsPerSet` | `50` | Maximum revisions to keep per named layer set (older ones are pruned) |
| `$wgLayersDefaultSetName` | `"default"` | Seed name for a new set, not an alias for the current set. Some paths remain inconsistent; use explicit descriptive set names. |
| `$wgLayersDefaultFonts` | `36 font names; see font list below` | Available fonts in the layer editor. 32 fonts self-hosted as WOFF2 files (OFL) plus 4 system fonts. |
| `$wgLayersMaxImageSize` | `4096` | Maximum image size for layer editing in pixels |
| `$wgLayersImageMagickTimeout` | `30` | Timeout in seconds for ImageMagick operations |
| `$wgLayersMaxImageDimensions` | `8192` | Maximum width/height for layer processing |
| `$wgLayersPdfExportWidth` | `1600` | Render width in pixels for each page when exporting a marked-up file to PDF |
| `$wgLayersPdfExportMaxPages` | `100` | Maximum number of pages allowed when exporting a marked-up file to PDF (0 = unlimited) |
| `$wgLayersExportDirectory` | `""` | Directory for cached PDF exports. Must be outside the document root; exports are served through Special:LayersExport after a permission check. Empty uses $wgTmpDirectory/layers-export. |
| `$wgLayersSlidesEnable` | `true` | Enable Slide Mode for creating canvas-based layers without a parent image |
| `$wgLayersSlideDefaultWidth` | `800` | Default width for slides when not specified |
| `$wgLayersSlideDefaultHeight` | `600` | Default height for slides when not specified |
| `$wgLayersSlideMaxWidth` | `4096` | Maximum allowed slide width |
| `$wgLayersSlideMaxHeight` | `4096` | Maximum allowed slide height |
| `$wgLayersSlideDefaultBackground` | `"#ffffff"` | Default background color for slides |
| `$wgLayersTrackChangesInRecentChanges` | `false` | Experimental legacy null-edit attempt, disabled by default. Does not provide reliable Recent Changes, watchlist or page-history records. See Current Status. |

## Examples

```php
wfLoadExtension( 'Layers' );
$wgLayersMaxLayerCount = 200;
$wgLayersMaxComplexity = 200;
$wgLayersMaxNamedSets = 25;
$wgLayersDebug = false;
```

Increasing layer count alone may not admit a complex drawing: size, complexity and imported-image limits also apply. Increasing limits raises storage/rendering costs. The client may impose additional limits.

## Fonts

Arial, Verdana, Times New Roman, Courier New, Roboto, Open Sans, Lato, Montserrat, Noto Sans, Source Sans 3, PT Sans, Ubuntu, Inter, Poppins, Work Sans, Nunito, Raleway, DM Sans, Merriweather, Playfair Display, Lora, Libre Baskerville, EB Garamond, Crimson Text, Bebas Neue, Oswald, Archivo Black, Fredoka, Caveat, Dancing Script, Pacifico, Indie Flower, Source Code Pro, Fira Code, JetBrains Mono, IBM Plex Mono.

Use fonts available to the browser and relevant export renderer. Browser and server font availability may differ; verify exports before distributing them.

## Export storage

`LayersExportDirectory` must be writable by the wiki and outside the web document root. An empty value uses the extension's directory under MediaWiki's temporary directory. Deliver exports through `Special:LayersExport`, which checks access; do not publish the cache directory directly. `LayersPdfExportMaxPages=0` removes the configured page cap, so use a finite limit for untrusted uploads.

Old export filenames from before the source-title binding fix are no longer served. Regenerate exports. See [[Current Status]] for remaining fidelity and failed-page issues.

## Same-origin editor modal

`layerslink=editor-modal` uses an iframe. Where MediaWiki's framing policy blocks it, configure the core setting:

```php
$wgEditPageFrameOptions = 'SAMEORIGIN';
```

Also check your reverse proxy and CSP `frame-ancestors` policy. Do not disable framing protection globally. Core settings and their defaults depend on your MediaWiki version.

## Rate limits and permissions

The registered rate-limit buckets are `editlayers-save`, `editlayers-render`, `editlayers-list`, `editlayers-info`, `editlayers-delete`, `editlayers-rename` and `editlayers-create`. Defaults are in the manifest's `RateLimits` section and can be overridden through MediaWiki's `$wgRateLimits`. The slide-creation enforcement gap is tracked in [[Current Status]].

See [[Permissions]] for group rights. Do not use an undocumented setting as a security boundary. In particular, `LayersRejectAbortedRequests` is not a registered server configuration setting in the current manifest.
