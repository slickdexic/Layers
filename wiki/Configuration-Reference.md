# Configuration reference

Reviewed October 24, 2026 against the candidate's `extension.json` and callers.
These are extension defaults, not MediaWiki defaults. Set overrides after
`wfLoadExtension( 'Layers' );` in `LocalSettings.php`.

The candidate still reports 1.5.95 in its manifest; use an exact reviewed commit
with passing CI. Tagged 1.5.95 uses the older shared model. Follow the
[upgrade guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md), including migration completion on an empty
new wiki. Changing a setting does not record completion or migrate content.

## Native page ownership and caching

| Setting | Default | Scope |
| --- | --- | --- |
| `$wgLayersPageDrawingNamespaces` | `null` | Namespaces where new ownership may start. `null` means content namespaces and File; `[]` admits no new owners. Existing owners retain their content in any namespace, subject to permissions. |
| `$wgLayersBindingReadMaxAge` | `300` | Maximum seconds of anonymous public caching for a current-revision binding read. `0` disables this caching. Logged-in, historical, snapshot, control, viewer/editor, error and private-wiki responses are not publicly cached. |

Native history, the `layers` slot and save/import/merge/restore guards are
registered through supported MediaWiki mechanisms. No pilot switch or owner
allowlist is needed. The retired `$wgLayersPageOwnedPilotEnabled`,
`$wgLayersPageOwnedPilotOwners` and `$wgLayersPageOwnedPilotNamespaces` are ignored.

A cached anonymous current-binding response can remain for the configured age
after a deletion or visibility change. Exact PDF delivery has separate no-store
responses and fresh authorization. Choose the binding cache age for the wiki's
visibility requirements; it is not an authorization override.

## Native document bounds

These are fixed schema bounds, independent of the legacy settings below:

| Bound | Candidate limit |
| --- | --- |
| Complete serialized owner snapshot | 2097152 bytes (2 MiB) |
| Members in one owner snapshot | 100 |
| Layers in one member | 100 |
| Layers across the complete snapshot | 1000 |
| Canvas width or height | 4096 |
| Serialized image data URL accepted by the strict layer validator | 1048576 bytes (1 MiB) |

The image-data limit measures the complete data URL, including base64 text,
not just decoded image bytes. PDF pages are internal members sharing one visible
set name. Raising a legacy
count, payload or export setting does not expand these native bounds. Client
import controls and format-specific MediaWiki handlers can impose additional
constraints. Preserve unsaved work when investigating a refused payload; do not
remove unrelated members or bypass validation to make a Save fit.

## General controls and client import

| Setting | Default | Scope |
| --- | --- | --- |
| `$wgLayersEnable` | `true` | Enables the hooks/UI paths that consult it. It does not unregister stored native content or replace API permissions. |
| `$wgLayersDebug` | `false` | Additional Layers logging. Keep diagnostic logs private and bound their collection. |
| `$wgLayersDefaultFonts` | `36 font names; listed below` | Editor font choices: 32 self-hosted fonts plus four system fonts. Adding a name does not install the font. |
| `$wgLayersMaxImageBytes` | `1048576` | Imported-image validation/client paths using this setting. Native strict validation still has its own 1 MiB bound. |
| `$wgLayersMaxImportSide` | `2048` | Client image-import downscaling on the longest side. It does not change saved native canvas bounds. |
| `$wgLayersImportJpegQuality` | `0.8` | JPEG quality used by client import re-encoding, when that result is smaller. This is not the full-size viewer's PNG Download setting. |

## Legacy shared storage

After migration completion, shared sets remain read-only. These settings do
not provide a way to write them again or alter native page history.

| Setting | Default | Scope |
| --- | --- | --- |
| `$wgLayersMaxBytes` | `2097152` | Legacy stored payload limit; also exposed to client paths. Increasing it does not raise the native 2 MiB schema bound. |
| `$wgLayersMaxLayerCount` | `100` | Legacy validation/client callers. Native per-member count remains capped at 100. |
| `$wgLayersMaxComplexity` | `100` | Legacy request complexity budget: simple shapes cost 1, text/arrow types 2, image/path/custom shapes 3. |
| `$wgLayersMaxNamedSets` | `15` | Shared-file set allocation and client controls that read it; not the native member limit. |
| `$wgLayersMaxRevisionsPerSet` | `50` | Pruning of retained legacy set revisions. Never prunes native owner-page history. |
| `$wgLayersDefaultSetName` | `"default"` | Seed for a new unnamed shared set. Does not redefine the post-completion `layerset=on` shortcut, which selects `Default`. |
| `$wgLayersTrackChangesInRecentChanges` | `false` | Old experimental File-page null-edit audit attempt. Native history does not depend on it; leave it out of a native-history setup. |

## Server rendering and legacy PDF export

These settings apply to the Layers renderer/export callers that use them.
Native PdfHandler/source rendering also follows MediaWiki's own handler limits.
The page-owned viewer's Download/Print is a separate path from the cached legacy
`layerspdfexport` endpoint.

| Setting | Default | Scope |
| --- | --- | --- |
| `$wgLayersMaxImageSize` | `4096` | Image-admission fallback edge limit when the dimensions helper has no positive scalar limit. |
| `$wgLayersMaxImageDimensions` | `8192` | Dimensions helper's default edge limit. The helper also accepts width/height arrays; native schema bounds remain separate. |
| `$wgLayersImageMagickTimeout` | `30` | Seconds for Layers ImageMagick operations that use this setting. |
| `$wgLayersPdfExportWidth` | `1600` | Raster width for cached legacy server PDF export. |
| `$wgLayersPdfExportMaxPages` | `100` | Legacy server export page cap; `0` disables that cap. It does not remove native document bounds. |
| `$wgLayersExportDirectory` | `""` | Legacy export cache. Empty uses `$wgTmpDirectory/layers-export`; a configured directory must be writable and outside the document root. |

Serve legacy cached exports through `Special:LayersExport`, which checks source
access; do not expose the cache directory directly. Old filenames from before
the source-title binding fix need regeneration. Inspect critical legacy output
rather than treating it as a native historical export.

## Slides

| Setting | Default | Scope |
| --- | --- | --- |
| `$wgLayersSlidesEnable` | `true` | Slide parser/management entry points. Does not delete stored native history. |
| `$wgLayersSlideDefaultWidth` | `800` | Default width for eligible new slide canvases; saved geometry remains authoritative. |
| `$wgLayersSlideDefaultHeight` | `600` | Default height for eligible new slide canvases. |
| `$wgLayersSlideDefaultBackground` | `"#ffffff"` | Default background for new slides. |
| `$wgLayersSlideMaxWidth` | `4096` | Legacy slide dimension parser/management bound; native schema also caps dimensions at 4096. |
| `$wgLayersSlideMaxHeight` | `4096` | Legacy slide dimension parser/management bound. |

## Fonts

Arial, Verdana, Times New Roman, Courier New, Roboto, Open Sans, Lato, Montserrat,
Noto Sans, Source Sans 3, PT Sans, Ubuntu, Inter, Poppins, Work Sans, Nunito,
Raleway, DM Sans, Merriweather, Playfair Display, Lora, Libre Baskerville,
EB Garamond, Crimson Text, Bebas Neue, Oswald, Archivo Black, Fredoka, Caveat,
Dancing Script, Pacifico, Indie Flower, Source Code Pro, Fira Code, JetBrains Mono,
IBM Plex Mono.

Check that custom fonts are available to the browser and the renderer used for
an export. A configured name alone does not supply the font bytes.

## Permissions, quotas and framing

The registered rate buckets are `editlayers-save`, `editlayers-render`,
`editlayers-list`, `editlayers-info`, `editlayers-delete`, `editlayers-rename`
and `editlayers-create`. Defaults are in `extension.json` under `RateLimits`;
MediaWiki's `$wgRateLimits` supplies overrides. Page-owned metadata uses the
information budget; exact PDF delivery and missing-PDF editor preparation use
the separate render budget. Do not raise quotas as the first response to a
retry loop. See [native HTTP acceptance](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md).

See [[Permissions]] for owner-page rights. No setting above bypasses owner,
revision, source or CSRF checks. `LayersRejectAbortedRequests` is not a
registered server setting.

The legacy `layerslink=editor-modal` uses a same-origin iframe. Review the core
`$wgEditPageFrameOptions = 'SAMEORIGIN';` setting together with proxy/CSP
`frame-ancestors` rules if that mode is blocked. Do not disable framing
protection globally. The owner-page overlay remains the normal native entry.
