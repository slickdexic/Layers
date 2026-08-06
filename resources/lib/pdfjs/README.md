# Vendored pdf.js (Mozilla PDF.js)

These files are a **vendored copy** of Mozilla's [pdf.js](https://github.com/mozilla/pdf.js)
distribution (`pdfjs-dist`), used by the Layers extension to render PDF pages
client-side in the in-wiki viewer so that annotations can be overlaid without
leaving the wiki.

| File | Purpose |
| --- | --- |
| `pdf.min.js` | Main pdf.js API library, re-bundled as UMD. Loaded as a plain `<script>`, so it assigns the `window.pdfjsLib` global. |
| `pdf.worker.min.js` | pdf.js background worker, copied verbatim. Referenced by URL via `GlobalWorkerOptions.workerSrc` and started as an **ES module worker**. pdf.js falls back to main-thread rendering automatically if the worker cannot be started (e.g. a strict Content-Security-Policy). |
| `LICENSE` | Apache License 2.0 (the license pdf.js is distributed under). |

## Provenance

- Package: `pdfjs-dist`
- Version: **4.10.38**
- Build used: `legacy/build/pdf.min.mjs` and `legacy/build/pdf.worker.min.mjs`.
- License: Apache-2.0 (compatible with this extension's `GPL-2.0-or-later`
  via the "or later" upgrade path to GPL-3.0).

## Why the main library is re-bundled

pdf.js stopped shipping a UMD build in 4.0 and `pdfjs-dist` is now ESM-only,
which neither a classic `<script>` tag nor ResourceLoader can consume.
`scripts/webpack.pdfjs.config.js` therefore wraps `legacy/build/pdf.min.mjs` in a
UMD shell. The bundle is *not* re-minified, so the emitted code is
byte-comparable to upstream apart from the wrapper.

One upstream call is patched during the vendor build by
`scripts/pdfjs-worker-import-loader.js`: `await import( this.workerSrc )`, the
main-thread worker fallback, needs a `webpackIgnore` magic comment that does not
survive upstream minification. Without it webpack rewrites the call into a
context module and the fallback breaks. The loader throws if the call ever stops
matching, so a future pdf.js release cannot regress this silently.

The **worker is not bundled**: pdf.js starts it with
`new Worker( src, { type: 'module' } )`, so it must remain a standalone ES module.
It is copied verbatim and renamed from `.mjs` to `.js` purely so that web servers
serve it with a JavaScript MIME type — module-ness comes from the `Worker`
constructor, not the file extension.

## Why this is NOT a ResourceLoader module

It used to be (`ext.layers.pdfjs`, a `packageFiles` module) and that silently
broke every PDF. ResourceLoader pipes module content through
`Wikimedia\Minify\JavaScriptMinifier`, which is token-based rather than a real
parser, and it corrupts this bundle: it loses string-boundary sync partway
through — `getContext("2d")` came back as `getContext("2 d")` — and truncated the
remainder, so a 403 KB module was served as 68 KB of unparseable JavaScript.
Because the script died with `Uncaught SyntaxError` before executing,
`mw.loader.using()` never settled, and the viewer's "fall back to the
server-rendered image" path — which only triggers on rejection — never ran.

MediaWiki 1.44 has a `ResourceLoader::FILTER_NOMIN` (`/*@nomin*/`) opt-out, but
1.45.3 does not, and neither do the 1.43/1.39 branches this extension is
cherry-picked to. So `PdfRenderer` injects a plain `<script>` tag pointing at
`$wgExtensionAssetsPath` instead, exactly as it already does for the worker. It
appends `?version=` (pinned to `PDFJS_VERSION` in `PdfRenderer.js`) because
static assets get no ResourceLoader versioning.
`tests/jest/pdfjsBundle.test.js` fails if the bundle is added back to
`extension.json`, or if that version constant drifts from `pdfjs-dist`.

## Updating

`pdfjs-dist` is pinned as a `devDependency` in the extension's `package.json`
purely to re-vendor these files. To update:

```sh
npm install --save-dev pdfjs-dist@<version>
npm run vendor:pdfjs
```

`npm run vendor:pdfjs` runs the webpack config and copies the worker and the
`LICENSE`. Then bump the version noted above and `PDFJS_VERSION` in
`resources/ext.layers/viewer/PdfRenderer.js`, update `THIRD_PARTY_LICENSES.md`,
and re-run the test suite.

**Do not hand-edit `pdf.min.js` or `pdf.worker.min.js`.** They are build
artifacts.

## Browser support note

Module workers require Chrome 80+, Edge 80+, Safari 15+ and Firefox 114+. Older
browsers fail to start the worker and pdf.js silently falls back to main-thread
rendering, which is slower but correct — the same path a strict CSP takes.
