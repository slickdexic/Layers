# Troubleshooting: Layers not visible with `layers=all`

This guide captures the root cause and the precise fixes that resolved the long‑standing issue where overlays showed in the editor but did not render on article pages when using `layers=all`.

## Symptoms

- Wikitext like `[[File:Image.jpg|thumb|layers=all]]` renders the base image only.
- The editor loads layers correctly on File: pages.
- The final HTML for the article image contains `data-layer-data="{...}"` (sometimes HTML‑escaped) and often has `class="layers-thumbnail"`.
- The browser console shows either:
  - `Skipped unavailable module ext.layers`, or
  - `Unknown module: mediawiki` or `Unknown module: mediawiki.hook`.

## Root causes (there were several)

1. ResourceLoader dependency mismatch
   - The front‑end module `ext.layers` declared dependencies that are not present or are named differently in the target MediaWiki build (e.g., `mediawiki` and/or `mediawiki.hook`).
   - Result: RL refused to load `ext.layers`, so the viewer never initialized, despite server attributes being present.

2. Bootstrap selector too strict
   - The client bootstrap only scanned `img.layers-thumbnail[data-layer-data]`. In some code paths the class gets added after attributes are set or not added at all.
   - Result: even when the JSON payload was present, no viewer was created.

3. JSON parsing edge case
   - Some render paths HTML‑escape the JSON inside `data-layer-data` (e.g., `&quot;` instead of `"`).
   - Result: `JSON.parse` failed unless we decoded entities first.

4. Minor scoping bug in the viewer bootstrap
   - During entity‑decode fallback, `this.decodeHtmlEntities` was called from a nested function with the wrong `this` binding.
   - Result: a silent failure prevented retry parse.

5. Inconsistent base dimensions (older paths)
   - In a late HTML rewrite path, payloads sometimes lacked `baseWidth`/`baseHeight` so overlays could misalign.

## Fixes applied

- ResourceLoader dependencies simplified
  - `extension.json`: `ext.layers` now depends only on `jquery`. Optional use of `mw.hook` is guarded.
  - Guarded `mw.hook('wikipage.content')` calls in `init.js` so missing hook module doesn’t break.

- Broadened bootstrap matching
  - `init.js`: scan `img[data-layer-data]` and add `layers-thumbnail` class if missing.

- Robust JSON parsing
  - `init.js`: on `JSON.parse` failure, decode common HTML entities and retry; debug logs gated by `wgLayersDebug`.

- Scoping fix
  - `init.js`: capture `self = this` and use it in nested callbacks for entity decode.

- Base dimensions ensured
  - Server hooks (e.g., MakeImageLink2/LinkerMakeImageLink/ThumbnailBeforeProduceHTML) include `baseWidth`/`baseHeight` with the payload when available.

## Why this was elusive

- The failure depended on environment specifics:
  - Some MediaWiki builds don’t expose `mediawiki`/`mediawiki.hook` as separate RL modules; declaring them made `ext.layers` unloadable.
  - Server output looked correct (attributes present), so attention focused on PHP, while the real blocker was RL refusing the client module.
- Multiple small issues compounded:
  - Even when RL loaded, a strict selector could miss elements.
  - Escaped JSON broke parsing unless decoded.
  - A scoping bug suppressed the fallback parse.
- Caching hid changes:
  - ResourceLoader and OPcache can serve stale manifests; until caches were flushed, fixes didn’t take effect, reinforcing confusion.

## How to confirm it’s fixed

1. Verify the module serves
   - Open: `/load.php?modules=ext.layers&only=scripts&debug=2` — expect JS, not "Unknown module".

2. Reload the page with cache bypass
   - Add `&debug=2` and hard refresh (Ctrl+F5).

3. In browser console:
   - `mw.loader && mw.loader.getState && mw.loader.getState('ext.layers')` → `"ready"` or `"loaded"` (if `mw.loader` exists).
   - `typeof window.LayersViewer` → `"function"`.

4. Inspect the DOM:
   - Images should have `data-layer-data` (possibly entity‑encoded) and a sibling `<canvas class="layers-viewer-canvas">` after init.

5. Optional debug logging
   - Set `$wgLayersDebug = true` and reload with `?debug=2` to see `[Layers]` console messages confirming discovery and initialization.

## If the issue resurfaces

- Clear caches/opcache or restart web/PHP service.
- Re-check the load.php test for `ext.layers`.
- Ensure `init.js` exists in the shipped ResourceLoader bundle and that `LayersViewer.js` defines `window.LayersViewer`.
- Confirm `data-layer-data` is valid JSON or decodable from escaped entities.
- Make sure payload includes `baseWidth`/`baseHeight` for correct scaling.

## Change references

- `resources/ext.layers/init.js` — bootstrap fixes, decode, debug, guard hooks.
- `resources/ext.layers/LayersViewer.js` — renderer (unchanged in this fix set).
- `extension.json` — ResourceLoader dependency simplification.
- `src/Hooks/WikitextHooks.php` — ensured attribute injection and base dimensions across paths.

## One-line health check

Run in browser console on an affected page:

```js
({
  state: (window.mw && mw.loader && mw.loader.getState) ? mw.loader.getState('ext.layers') : 'no-mw',
  imgs: Array.from(document.querySelectorAll('img[data-layer-data]')).length,
  initialized: Array.from(document.querySelectorAll('img[data-layer-data]')).filter(img => img.layersViewer).length,
  canvases: document.querySelectorAll('canvas.layers-viewer-canvas').length,
  viewer: typeof window.LayersViewer
})
```

Expected: state "ready/loaded", viewer "function", counts > 0 for imgs/initialized/canvases.
