# Current release status

Updated November 8, 2026. **[v1.8rc1](https://github.com/slickdexic/Layers/releases/tag/v1.8rc1)
is published for testing**, manifest **1.8.0-rc.1**, commit
`cfdf8f2bd31b1d9616871e769317b52c64aba0bd`. It uses the qualified internal rc.3
application code. Internal rc.1–rc.3 were local test builds, not earlier public
releases. Publication was November 7 locally / November 8 UTC.

Changes on main after this tag, including the documentation/editor-help refresh,
are Unreleased and do not silently replace the downloadable candidate.

## Included behavior

- Layer sets on images, standalone slides and PDFs belong to their owning wiki
  page. Save publishes the complete owner snapshot in one native revision,
  preserving unrelated sets and all members of an edited PDF group.
- Edit layers and View full size overlays are the owner-page entry points.
  Native history supplies earlier saved content, comparisons and restoration.
  Ordinary embeds add no generated owner/revision heading or set list.
- Import makes independent copies from another readable page. Images/PDFs
  require the same file and matching layer-set name; slides require the same
  slide name. PDF Import copies the complete group by page number. Arbitrary
  other names/files/media types are not offered. Append/Replace, Undo and Save
  retain their existing roles. Local draft recovery is separate from Save.
- After migration and cleanup, built-in MediaWiki search includes current
  page-owned layer text and ordinary page text. Retained legacy rows and old
  page revisions do not contribute obsolete terms. Layer text follows the
  owning page revision's permissions; hiding a referenced file does not hide
  readable page-owned text. Media viewing separately checks source visibility.
- The viewer retains zoom, pan, Fit, PDF navigation, Print and Download.
  Images/slides offer PNG first and PDF separately; PDFs offer PDF only.
  Saved source identity is retained. Failed PDF pages refuse complete assembly.

## Deployment and verification

Requires MediaWiki **1.44+**, its PHP/database requirements and normal media
handler dependencies for the file formats used. Docker is a development/test
environment, not a runtime dependency.

**Keep readers and editors restricted until migration and search cleanup finish.**
The schema updater alone is insufficient, including on a fresh empty wiki.
Back up and rehearse, drain old-code work, complete migration, clean search and
verify before reopening. Preserve legacy recovery rows and retained uploads.
Use the [upgrade runbook](https://github.com/slickdexic/Layers/blob/main/docs/UPGRADING.md).

The exact release commit passed [CI](https://github.com/slickdexic/Layers/actions/runs/42446168558),
[native MediaWiki tests](https://github.com/slickdexic/Layers/actions/runs/42446168520),
[browser tests](https://github.com/slickdexic/Layers/actions/runs/42446168517) and
[lint/style](https://github.com/slickdexic/Layers/actions/runs/42446168555).
The [release wiki synchronization](https://github.com/slickdexic/Layers/actions/runs/42446565479)
also passed. The published archive/checksum were downloaded and verified.
All 2,941 packaged files matched the installed 1.44.6 candidate; content/uploads
were preserved. The affected native search/migration selection passed 59 tests /
531 assertions on 1.44.6 and 59 / 543 on 1.45.3. These scoped results do not
assert every deployment or database combination has been tested.

## Remaining before final stable 1.8

- Resolve the retained reference-performance measurement: 312.4 ms from image
  load to layer paint against the 300 ms target. Normal-use owner feedback is
  positive; slow forced reloads also affect plain pages. No general current
  Layers-specific slowdown or blanket performance waiver is established.
- Complete applicable physical-device, manual accessibility and OS/physical
  Print acceptance. Narrow emulation and Print preparation do not prove these.
- Apply each site's backup/upgrade/recovery checks. Previously migrated pilot
  PDF naming needs its recorded disposition; no historical rewrite is included.
- Record final owner acceptance and qualify the eventual stable artifact.

Publicly served unmigrated legacy search and arbitrary external search backends
are outside v1.8rc1 qualification. Cargo readiness/integration and clickable
layer-object links retain their later charter milestones; no final 2.0 acceptance
is claimed. Layer-object links are excluded from the lightbox.

The [acceptance ledger](https://github.com/slickdexic/Layers/blob/main/docs/RELEASE_1_8_ACCEPTANCE.md),
[known limits](https://github.com/slickdexic/Layers/blob/main/docs/KNOWN_ISSUES.md) and
[candidate checklist](https://github.com/slickdexic/Layers/blob/main/docs/V1_8_CANDIDATE_TESTING.md)
record evidence and open scope. Dated design, review and investigation documents
retain their original results; they are not current activation instructions.
The [documentation audit](https://github.com/slickdexic/Layers/blob/main/docs/DOCUMENTATION_1_8_AUDIT.md)
covers repository, wiki, MediaWiki publication sources and editor help.
