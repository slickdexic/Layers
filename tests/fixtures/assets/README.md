# Original real-asset fixtures

These small, locally authored assets exercise storage and publication in the isolated MediaWiki core harness. They are not downloaded samples or evidence of production historical rendering.

| File | Content |
| --- | --- |
| `test-image.png` | Valid 1×1 RGB blue pixel, 72 bytes |
| `test-image-replacement.png` | Valid 1×1 RGB orange pixel, 72 bytes; genuinely different pixel data |
| `test-multipage.pdf` | Two labeled pages, 840 bytes; page 1 is 200×100 points, page 2 is 100×200 points |
| `test-multipage-replacement.pdf` | One labeled page, 593 bytes; page 1 is 300×150 points (distinct geometry and page count) |

Regenerate from the repository root with `php tests/fixtures/assets/generate.php`. Verify byte-for-byte reproducibility without writes with `php tests/fixtures/assets/generate.php --check`. The generator uses only PHP standard functions, explicit PNG checksums and computed PDF object/cross-reference offsets. It writes only these four files beside itself.

The September 11 lead review verified PNG chunk CRCs and decoded pixel streams independently, then ran the installed `pdfinfo` and decoded both PDF pages with `pdftoppm`. Both pages parsed without repair warnings. The original submitted PNG had an invalid IDAT checksum, and the original PDF had incorrect offsets; those files were replaced rather than treating parser recovery as fixture validity.

`RealAssetAdmissionTest` uploads these into a temporary FSFileBackend and isolated test tables. It checks current/archived image bytes, PDF page-count bounds, publication effects, and preservation of stored annotations after actual source-byte deletion. File deletion in these tests is limited to the fixture backend. It does not establish retention, historical thumbnails, browser behavior or future availability of source files. PDF handling requires the already-configured PdfHandler and PDF tools in the core test environment; unavailable prerequisites must not become a passing claim.

The source-free slide example is [slide-document-v1.json](../revisions/slide-document-v1.json). Slides remain general-purpose visual content.

The September 12 J27 review pins PdfHandlerDpi to 150 within the isolated tests. Width/height assertions refer to handler-reported metadata pixels, not a rendered image or browser canvas. The replacement PDF was independently parsed and decoded without repair warnings.
