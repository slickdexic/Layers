# Layers “layers=all” Rendering — Diagnosis & Fix Plan

Date: 2025-08-18
Updated: 2025-08-19

Scope: MediaWiki Layers extension (frontend viewer + backend hooks, API, DB, server composites)

## Executive summary

Images annotated with `layers=all` (and other supported values) should render overlays either via server-side composite thumbnails or client-side canvas. Rendering gaps typically come from parameter propagation, attribute injection on certain HTML shapes, or overly strict client fallbacks/filename inference. This doc maps the current implementation, ranks likely causes, proposes fixes, and lists tests and instrumentation to close the gaps.

Accepted values for the `layers` parameter today (as implemented):

- on | all | true | 1 | yes → show latest layer set
- id:NUMBER → show a specific layer set by ID
- name:STRING → show a specific layer set by name
- CSV of hex short IDs (e.g., 4bfa,77e5,0cf2) → show a subset from the latest set
- off | none | false | 0 → disable overlays

## Symptoms & quick checks

- Wikitext or URL includes `layers=all`, but overlays don’t appear.
- File page vs. non-file page behavior differs (works on File: pages, not elsewhere).
- Some thumbnails render overlays while others (galleries, links) don’t.
- Console/network show no request to fetch layer data (client fallback didn’t trigger).
- Server logs don’t show LayeredThumbnail or ImageMagick activity when expected.

Quick triage:

- Confirm the extension is enabled and modules load: browser devtools → Network → check `ext.layers` resource.
- File has at least one saved layer set: use the editor or API to verify latest layer set exists.
- Database schema up-to-date: run the MediaWiki maintenance update script.
- Ensure ImageMagick and MediaWiki Shell are available if relying on server composites (`$wgUseImageMagick`, `$wgImageMagickConvertCommand`).

## End-to-end flow (high level)

1. Wikitext/URL provides `layers=` parameter.
1. Hooks normalize/propagate params and either:
   - inject data attributes for the client viewer and/or
   - pass `layerData` to the file transform for server-side composites.
1. Client bootstrap (`resources/ext.layers/init.js`) locates eligible images; if data attributes missing but intent is present, fetches layer data via `ApiLayersInfo` and overlays via canvas.
1. DB/API provide the latest layer set and base image dimensions for correct scaling.

## Current implementation map (as of 2025-08-18)

- Hook coverage (server-side attribute injection paths):
  - ParserMakeImageParams (normalize/attach `layerData`, `layersjson`, `layersetid`)
  - ThumbnailBeforeProduceHTML (adds `data-layer-data` or marks `data-layers-intent="on"` on `<img>`, DB fallback if needed)
  - ImageBeforeProduceHTML (adds attributes for non-thumbnail images and file pages when requested)
  - MakeImageLink2, LinkerMakeImageLink, LinkerMakeMediaLinkFile (last-chance mutation of generated `<img>` HTML, including galleries and various core paths)
- Client viewer/bootstrap:
  - `resources/ext.layers/init.js` and `LayersViewer.js`
  - Moves `data-layer-data` from wrapping `<a>` to `<img>` when needed
  - API fallback runs when either per-image explicit intent is present or (with guardrails) page-level `layers` is present
  - Uses `wgLayersParam` and `wgLayersDebug` (exposed by server) for gating and logs
- API:
  - `action=layersinfo` returns latest/specific layerset and includes `baseWidth`/`baseHeight` for scaling
- Server composite pipeline:
  - `LayersFileTransform::onBitmapHandlerTransform` → `ThumbnailRenderer::generateLayeredThumbnail()` (ImageMagick via MW Shell) → `LayeredThumbnail` for URL resolution
  - Controlled by `LayersImageMagickTimeout`, `UseImageMagick`, and core shell limits

Code references (as implemented):

- Hooks (server-side attribute injection and param propagation)
  - `src/Hooks/WikitextHooks.php`
    - `onParserMakeImageParams` (normalize/attach `layers`, `layersjson`, `layersetid`, `layerData`)
    - `onImageBeforeProduceHTML` (injects `data-layer-data`/marks intent on full-size images)
    - `onThumbnailBeforeProduceHTML` (injects/marks for thumbnails; DB fallback when needed)
    - `onMakeImageLink2`, `onLinkerMakeImageLink`, `onLinkerMakeMediaLinkFile` (last-chance HTML mutation for diverse render paths)
  - `src/Hooks/UIHooks.php`
    - Adds “Edit Layers” tab/action on File pages
  - `src/Hooks/ParserHooks.php`
    - Minimal stub (normalization is handled in `WikitextHooks`)
- Transform/renderer
  - `src/LayersFileTransform.php` → custom transform via `onBitmapHandlerTransform`
  - `src/ThumbnailRenderer.php`, `src/LayeredThumbnail.php`
- API/DB
  - `src/Api/ApiLayersInfo.php`, `src/Api/ApiLayersSave.php`
  - `src/Database/LayersDatabase.php`
- Client
  - `resources/ext.layers/init.js` (bootstrap and fallbacks)
  - `resources/ext.layers/LayersViewer.js` (viewer runtime)

## Ranked likely causes and fixes

1. Parameter propagation or normalization gaps on certain render paths

   - Why: Different MediaWiki hooks produce image/link HTML in different contexts (thumbnail, gallery, media links). If a path isn’t covered or `layers` isn’t normalized to actionable params, overlays won’t render.
   - Evidence to add: Log when hooks see `layers=` (value + title), when they inject attributes, and when they skip.
   - Fixes (many already implemented, verify coverage):
     - Confirm `ParserMakeImageParams` always normalizes `layer` → `layers`, attaches `layerData`/`layersjson`/`layersetid` for: `on|all|id:|name:|csv`.
     - Ensure `MakeImageLink2`, `LinkerMakeImageLink`, `LinkerMakeMediaLinkFile`, and `ThumbnailBeforeProduceHTML` all inject either `data-layer-data` or `data-layers-intent="on"`.
     - Keep `layersjson` compact JSON flowing to transform params when present.

1. Attribute injection is skipped for some HTML shapes

   - Why: Output generated by galleries, templated wrappers, or lazy-load patterns may bypass specific hooks.
   - Fixes:
     - Broaden injection to all active hook surfaces (already covered by 3 hooks). When injection is risky, add a conservative `data-layers-intent="on"` marker so the client can perform the API fallback.

1. Client fallback gating too strict

   - Why: `init.js` restricts when API fallback triggers to avoid false positives.
   - Today’s behavior (documented):
     - On File pages (NS 6), page-level `layers` in URL is sufficient to allow API fallback for the main image.
     - On non-File pages, either per-image intent (`data-layers-intent`, `href` with `layers=...`, or wikitext evidence in `data-mw`) or page-level `layers` plus “looks like a file link/image” gating is required.
   - Fixes:
     - Keep this conservative gating, but add clearer debug logs when page-level intent is present yet a candidate is skipped (reason + which gate failed).

1. Filename inference failures in the client

   - Why: Responsive images, `<a>` wrappers, lazy loaders, or rewritten URLs (thumbs vs originals) may prevent `init.js` from finding the source title needed for API fetch.
   - Fixes (partly implemented):
     - Check nearest `<a href>` for title/path to File:, anchor `title`, common `data-*` attributes, and image `src` fallback.
     - Fallback to `wgPageName` on File pages.
     - Add explicit debug reasons when inference fails for a candidate.

1. Base dimensions missing or mismatched

   - Why: Viewer needs original baseWidth/baseHeight to scale coordinates properly. Missing/mismatched dims make overlays render off-scale or seemingly invisible.
   - Fixes (already in place):
     - `ApiLayersInfo` includes `baseWidth`/`baseHeight` from the File.
     - Viewer scales coordinates when base dims are provided; otherwise uses natural image size.
   - Additional hardening:
     - If computed scale is < 0.25x or > 4x, emit a debug note to aid diagnosis.

1. Server composite path not engaged or failing

   - Why: Without `layerData` on the transform, or if ImageMagick/shell is unavailable/timeout, the composite won’t be produced; client may not be given data attributes either.
   - Fixes:
     - Confirm `BitmapHandlerTransform` hook is registered and that transforms with `layers`+`layerData` route to `LayeredThumbnail`.
     - Add logging around shell invocation, timeouts, and output path creation (stderr on failures) — log channel `Layers`.
     - If server composite fails, ensure HTML still carries `data-layers-intent="on"` so the client can fetch via API.

- Note: `onBitmapHandlerTransform` currently proceeds only when both `layers` and `layerData` are set in transform params; ensure upstream param population via `onParserMakeImageParams` is consistent for `on|all|id:|name:|csv`.

1. Database/JSON constraints block rendering

   - Why: No latest layer set, JSON too large, invalid shape, or schema not migrated.
   - Fixes:
     - Validate and clamp JSON size in save path (already present); on read, handle decode errors gracefully and log.
     - Provide clear UI/editor prompts when no layersets available.
     - Ensure schema migrations are applied.

1. Resource loading/CSP issues prevent viewer from initializing

   - Why: `ext.layers` not loaded, or CSP blocks inline styles/scripts.
   - Fixes:
     - Ensure the viewer module loads via `BeforePageDisplay` and CSP is configured appropriately by the hook.

## Instrumentation improvements (low-risk)

- Server (PHP): at each hook where layers are considered, log: page title, image title, layers param value, action taken (inject attributes / mark intent / skip + reason). Use the `Layers` log channel controlled by `$wgLayersDebug`/`LayersDebug`.
- Server (thumbnail): log shell command success/failure, stderr, timing.
- Client (JS): when `layers=` is present but viewer not initialized, log why (e.g., filename inference failed, gated by NS/DOM checks). Honor `wgLayersDebug` to control verbosity; use `wgLayersParam` for page-level detection.

## Tests to add (or update)

- JS (Jest, under `tests/jest/`):
  - Fallback detection across DOM shapes: plain `<img>`, linked `<img>` inside `<a>`, images with `srcset`, lazy-loaded attrs, `thumbimage`/`mw-file-element` classes, File vs non-File page.
  - Filename inference matrix: anchor href title=File:, path `/wiki/File:`, anchor title prefix, `data-image-name`, parse from `src`.
  - Gating logic: allow on File pages with page-level `layers`; on non-File pages require per-image intent or page-level + file-link heuristics.
  - Ensure `data-layer-data` on `<a>` moves to `<img>` and viewer initializes once.

- PHP (PHPUnit):
  - Param normalization: all accepted `layers` forms result in `params["layerData"]` and `params["layersjson"]` where expected.
  - HTML attribute injection on `MakeImageLink2`, `LinkerMakeImageLink`, `LinkerMakeMediaLinkFile`, and `ThumbnailBeforeProduceHTML` pathways.
  - Transform wiring: transforms with `layers` + `layerData` short-circuit to `LayeredThumbnail`.

Encoding/escaping note:

- In HTML string mutation code paths we `htmlspecialchars()` the JSON payload; when setting `$attribs['data-layer-data']` (array form) we pass raw JSON and let core escape on render. Keep this consistent and avoid double-escaping; the client already decodes common entities in `init.js`.

## Troubleshooting checklist

- Confirm there is at least one saved layer set for the image (use editor or `ApiLayersInfo`).
- Check the page URL and wikitext include `layers=all` (or `layers=on`).
- Inspect the rendered HTML: does the `<img>` have `data-layer-data` or `data-layers-intent`? If not, hook injection is missing on that path (check `MakeImageLink2`/`LinkerMakeImageLink`/`LinkerMakeMediaLinkFile`/`ThumbnailBeforeProduceHTML`).
- On non-File pages, verify the client fallback logs whether it found a filename and why a candidate was skipped.
- If relying on server composites, confirm ImageMagick and shell are available and no timeouts occur (see `LayersImageMagickTimeout`).
- Ensure DB migrations applied: run MediaWiki’s maintenance update.

## Environment notes (Windows)

`composer test` may fail if a Python package named `composer` shadows PHP Composer on PATH. Ensure PHP Composer is used to run:

- Lint: parallel-lint
- Code style: phpcs
- minus-x: file permission checks

If needed, invoke vendor binaries directly (e.g., `vendor/bin/phpcs`, `vendor/bin/parallel-lint`).

MediaWiki CLI reminders:

- Apply DB schema updates from the MediaWiki root: `php maintenance/update.php`
- Clear caches if ResourceLoader modules don’t refresh after changes.

## Concrete repair tasks

- Hooks
  - [ ] Audit coverage of image/link HTML generation across hooks; add injection or intent markers everywhere needed (MakeImageLink2, LinkerMakeImageLink, LinkerMakeMediaLinkFile, ThumbnailBeforeProduceHTML, ImageBeforeProduceHTML).
  - [ ] Normalize `layers` consistently to “on” and ensure layer data is attached when available (including `id:`, `name:`, CSV forms).
- Client
  - [ ] Keep conservative gating but improve debug reasons when skipping candidates (no filename, not a file link, page-level-only on non-File page, etc.).
  - [ ] Improve filename inference: anchor title prefix, path/title query, data attributes, src fallback; prefer 1x from srcset if added.
  - [ ] Add targeted console debug logs under `wgLayersDebug`.
- Server composite
  - [ ] Ensure transform receives `layerData`; add robust logging and timeouts; fall back to client overlay on failure.
- API/DB
  - [ ] Guarantee base dims in `ApiLayersInfo` payloads; handle JSON decode/size issues gracefully with clear logs.
- Tests
  - [ ] Add Jest tests for fallback detection and filename inference variants.
  - [ ] Add PHPUnit tests for param normalization/injection/transform.

Low-risk hygiene and developer UX

- [ ] Remove stale `eslint-disable` directives in `resources/ext.layers/init.js` if no longer needed (warnings observed: “Unused eslint-disable directive (no-console)”).
- [ ] Align ESLint ignore lists between Grunt and package.json so `tests/jest/**` and `resources/dist/**` don’t spam warnings.
- [ ] Add a short README note on Windows “Composer” PATH conflicts (PHP Composer vs Python package) and how to verify/call `composer.phar`.

Quality gates snapshot (local runs)

- JS lint/style/i18n (npm test → grunt):
  - ESLint: mostly warnings for ignored files; one run showed indentation errors in `resources/ext.layers/init.js` which did not reproduce consistently; subsequent runs only reported “unused eslint-disable” warnings.
  - Stylelint: clean (“Linted 3 files without errors”).
  - Banana (i18n): OK (“1 message directory checked”).
- PHP (composer test):
  - Failed due to Python “composer” on PATH. Action: ensure PHP Composer is installed/used; alternatively run vendor binaries directly.

## Configuration toggles and defaults (extension.json)

- `LayersEnable` (bool, default true): master switch for the extension.
- `LayersDebug` (bool, default true): enables verbose logging and exposes `wgLayersDebug` to the client.
- `LayersMaxBytes` / `LayersMaxLayerCount`: JSON size and layer count guards on save paths.
- `LayersThumbnailCache` (bool): whether to cache composite thumbnails.
- `LayersImageMagickTimeout` (int seconds): per-operation IM timeout used by renderer in addition to core shell limits.
- `LayersMaxImageDimensions`: guardrails for processing very large images.

Server exposes to JS via `MakeGlobalVariablesScript`:

- `wgLayersEnabled`, `wgLayersDebug`, `wgLayersParam` (raw page-level query param if present).

## Acceptance criteria

- On pages where `layers` is enabled and a relevant layer set exists:
  - Either the server composite is produced and used, or the client overlay initializes and renders correctly.
  - On File pages, page-level `layers` triggers overlays for the main image when attributes are missing.
  - On non-File pages, per-image explicit intent or page-level + “looks like file link/image” gating triggers overlays.
  - Missing cases produce actionable logs (server: which hook/path and decision; client: gate that failed and filename inference result).

## Appendix: Minimal reproduction (suggested)

- Create an image with at least one saved layer set via the editor.
- Embed on a normal wiki page with `[[File:Example.png|thumb|layers=all]]` and load the page:
  - Expect overlays via server composite or client overlay.
- Link to the File: page using `[[File:Example.png|link=Media:Example.png|layers=all]]` and verify overlays still render on the thumbnail.
- Add `?layers=all` to a File: page and to a standard page containing the image; confirm client fallback initializes when attributes are missing.

Additional wikitext variants supported:

- `[[File:Example.png|thumb|layers=on]]` (latest)
- `[[File:Example.png|thumb|layers=id:123]]` (specific set)
- `[[File:Example.png|thumb|layers=name:callouts]]` (named set)
- `[[File:Example.png|thumb|layers=4bfa,77e5]]` (subset from latest)
