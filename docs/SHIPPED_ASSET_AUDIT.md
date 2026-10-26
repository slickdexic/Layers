# Shipped asset and notice audit

Recorded October 25, 2026 for Milestone 1 / OPS-2 / OPS-3 and SEC-7 inventory.
Baseline: public source `dea0aba`; application runtime and artwork remain
unchanged. This closes the package's asset-presence and notice review; it does
not constitute the full release security review or owner acceptance.

| Component | Bounded result |
| --- | --- |
| ResourceLoader | All 222 registered local file references and relative stylesheet assets resolve within the package. |
| Fonts | All 106 WOFF2 files remain byte-exact; their 32 family copyright records are included. 102 files use OFL-1.1; four Ubuntu files use UFL-1.0. Full license texts ship beside them. |
| Symbols | All 1,385 raw SVGs and all 1,385 unique indexed/rendered shapes remain. All matching Commons file descriptions were checked. The eleven attribution-bearing sources match after the existing sanitizer, including M002's historical source. Credits and applicable GPL/CC terms accompany the raw and embedded copies. |
| Emoji | All 2,817 indexed SVGs resolve through 19 unchanged category shards. The Apache SVG notice and regional-flag notice are included; the font's OFL is not substituted for the image notice. Original import revision is unrecorded, as disclosed in the inventory. |
| pdf.js | Locked version 4.10.38: API bundle reproduces exactly, worker and license match upstream package bytes. Bundle/version/hash checks run without rebuilding or downloading code. |

The corrected [attribution index](../THIRD_PARTY_LICENSES.md) links individual
copyrights and legal texts. The [file/hash catalog](../resources/asset-licenses.json)
records source-license claims and distinguishes exact source comparison from
filename/metadata provenance. It is not a warranty of copyright status in every
jurisdiction. Source/reference links and change notices are retained; the
software license and product interface are unchanged.

## Current candidate refresh

The `e9ecad5` candidate's successful exact-commit CI runs the same package guard
with **223 ResourceLoader file references**. The additional reference is the
approved viewer's `ViewerPanController.js`, extension code rather than a new
third-party dependency. Its four decorative direction icons are inline SVG
control geometry; the external font, symbol, emoji and pdf.js inventory stays
unchanged. The earlier 222-reference review above remains a dated record.

This carries the inventory forward without repeating unchanged artwork/source
reviews or treating it as a complete security audit. Recheck advisories at the
release cut as described below.

The subsequently approved bounded-toolbar implementation adds
`ViewerToolbarController.js`, bringing the checked registration count to **224**.
It adds extension UI code and small inline direction cues, with no new third-party
dependency or external artwork. The same package guard checks this candidate;
the dated inventory and source/notice review above remain intact.

## Repeatable package guard

```sh
npm run check:assets
```

This read-only development check is also included in `npm test`. It verifies
registered files, CSS assets, font/SVG inventory, indexed shape/emoji coverage,
notice/license hashes and the pinned pdf.js files/version. It requires Node.js
for development checks, not as a Layers runtime dependency. `--root path` checks
an extracted artifact using the same guard. No wiki connection is needed.

On an asset update, retain source URLs/revisions and copyright notices, review
the actual license, regenerate affected data with the existing generators and
update the catalog deliberately. Do not refresh hashes to conceal an unexplained
change. Keep required fonts, artwork, workers and licenses in release archives.

## Security scope

The GitHub global advisory API was queried for `pdfjs-dist@4.10.38` on this date;
it returned no published affected-version matches. This explicitly includes the
vendored runtime library even though its npm entry is a development dependency.
[Affected-version query](https://api.github.com/advisories?ecosystem=npm&affects=pdfjs-dist%404.10.38&per_page=100).
That result is time-bound and does not establish absence of unknown issues or
complete SEC-6/SEC-7 qualification. Recheck advisories at the release cut.

The October 26 [candidate security review](PAGE_HISTORY_SECURITY_REVIEW.md)
repeats the exact-version pdf.js query with no affected matches and preserves
all shipped assets. It separately patches the documentation generator's
Handlebars dependency from 4.7.9 to 4.7.10, resolving its critical advisories.
The follow-up compatible development-tool updates resolve the remaining 21
warnings; the full locked npm audit now reports zero vulnerabilities. Grunt's
direct pin moves to 1.6.3, while other declared ranges and the pdf.js/Handlebars
entries stay unchanged. No runtime assets are rebuilt. A runtime-only audit is
not used to dismiss the vendored PDF library or the build toolchain.

The retained native/browser/security results remain in the
[1.8 acceptance ledger](RELEASE_1_8_ACCEPTANCE.md). Missing supported-scope
acceptance, intended-wiki upgrade/restore, final artifact/version/tag and owner
sign-off remain separate release actions. No later milestone feature is added.

Copied license texts normalize trailing spaces and terminal blank lines only;
all non-whitespace characters are preserved.
