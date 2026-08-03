# Vendored pdf.js (Mozilla PDF.js)

These files are a **vendored, unmodified copy** of Mozilla's [pdf.js](https://github.com/mozilla/pdf.js)
distribution (`pdfjs-dist`), used by the Layers extension to render PDF pages
client-side in the in-wiki viewer so that annotations can be overlaid without
leaving the wiki.

| File | Purpose |
| --- | --- |
| `pdf.min.js` | Main pdf.js API library (UMD build, exposes the `pdfjsLib` global). |
| `pdf.worker.min.js` | pdf.js background worker. Referenced by URL via `GlobalWorkerOptions.workerSrc`. pdf.js falls back to main-thread rendering automatically if the worker cannot be started (e.g. a strict Content-Security-Policy). |
| `LICENSE` | Apache License 2.0 (the license pdf.js is distributed under). |

## Provenance

- Package: `pdfjs-dist`
- Version: **3.11.174** (the last release providing a UMD "legacy" build
  compatible with MediaWiki ResourceLoader and older browsers).
- Build used: `legacy/build/pdf.min.js` and `legacy/build/pdf.worker.min.js`.
- License: Apache-2.0 (compatible with this extension's `GPL-2.0-or-later`
  via the "or later" upgrade path to GPL-3.0).

## Updating

`pdfjs-dist` is pinned as a `devDependency` in the extension's `package.json`
purely to re-vendor these files. To update:

```sh
npm install --save-dev pdfjs-dist@<version>
cp node_modules/pdfjs-dist/legacy/build/pdf.min.js        resources/lib/pdfjs/pdf.min.js
cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js resources/lib/pdfjs/pdf.worker.min.js
cp node_modules/pdfjs-dist/LICENSE                        resources/lib/pdfjs/LICENSE
```

Then bump the version noted above and re-run the test suite.

**Do not hand-edit these files.** They are build artifacts.
