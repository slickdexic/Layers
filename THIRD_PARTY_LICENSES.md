# Third-party assets and notices

Updated October 25, 2026 for the independent page-history release. Components
retain their individual licenses; this inventory does not relicense them or
infer public-domain status from a standards number. The extension software is
GPL-2.0-or-later; see [COPYING](COPYING).

| Bundled component | Shipped scope | Notice and license |
| --- | --- | --- |
| Mozilla pdf.js 4.10.38 | API bundle and module worker | [Apache-2.0](resources/lib/pdfjs/LICENSE); [build/provenance](resources/lib/pdfjs/README.md) |
| Self-hosted fonts | 106 WOFF2 files, 32 family filename prefixes | 31 families / 102 files: OFL-1.1; Ubuntu / four files: UFL-1.0. [Copyrights and licenses](resources/ext.layers.shared/fonts/NOTICES.md) |
| Google Noto emoji SVG images | 2,817 images in 19 category JSON shards | [Apache-2.0 and upstream SVG notice](resources/ext.layers.editor/shapeLibrary/emoji/NOTICE); [regional-flag exceptions](resources/ext.layers.editor/shapeLibrary/emoji/FLAGS-LICENSE) |
| Commons-sourced symbols | 1,385 SVG files and generated category JavaScript copies | Individual source claims: 1,015 public domain, 359 CC0, nine CC BY-SA 4.0, one CC BY-SA 3.0, one GPL-2.0-or-later. [Credits and license texts](resources/ext.layers.editor/shapeLibrary/NOTICES.md) |

The [machine-readable inventory](resources/asset-licenses.json) binds the font,
symbol, emoji-shard, pdf.js and notice files to their audited hashes. Run
`npm run check:assets` before publishing or changing bundled assets. Keep
copyright/credit notices and applicable license texts with redistributed copies.

## Fonts

Font-specific copyrights and reserved font names were read from the bundled
WOFF2 name tables and reproduced in the adjacent notices. The full OFL 1.1 and
Ubuntu Font Licence 1.0 texts are included. The font bytes, CSS declarations,
families and selectable styles are unchanged by this notice correction.

Google Fonts availability alone does not identify the license. In particular,
the bundled Ubuntu 0.83 files identify Canonical and UFL 1.0. Their upstream
[license text](https://github.com/google/fonts/blob/main/ufl/ubuntu/UFL.txt)
is included; they are not labelled OFL.

## Emoji images

The picker ships SVG image data, not the Noto Color Emoji font. Upstream's
[SVG directory notice](https://github.com/googlefonts/noto-emoji/blob/v2.047/svg/LICENSE)
uses Apache-2.0, while the font has a separate OFL license. The original import
commit was not retained; v2.047 is a pinned upstream notice reference, not a
claim that every shipped image is byte-identical to that release. The original
SVG filenames remain in the category shards. Changes include minification and
grouping into JSON; the notices include upstream regional-flag exceptions.

## Symbols

The prior blanket public-domain statement was incorrect for eleven files.
Per-file Commons license and author records were checked, and those eleven SVGs
were matched to upstream sources through the existing sanitizer. One uses its
matching historical image and description revision. Credits and license terms
cover the raw SVG and the copy embedded in category JavaScript.

The source catalog distinguishes those exact comparisons from filename/metadata
provenance for the other symbols. It records upstream claims rather than
guaranteeing copyright status or other rights in every jurisdiction. No symbol,
tool or entry point was removed, and no visible attribution caption was added
to wiki content. Follow the applicable asset terms when reusing the artwork.

## pdf.js

The worker and upstream license match the installed locked `pdfjs-dist`
4.10.38 package. The API library reproduces byte-for-byte through the documented
UMD wrapper and worker-import-comment loader. Do not hand-edit either bundle;
follow [the vendoring procedure](resources/lib/pdfjs/README.md).

See [the bounded release audit](docs/SHIPPED_ASSET_AUDIT.md) for verification and
remaining security/acceptance limits. Report attribution corrections through
[the issue tracker](https://github.com/slickdexic/Layers/issues).
