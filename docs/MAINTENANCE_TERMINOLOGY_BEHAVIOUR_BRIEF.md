# Maintenance command terminology correction

This correction advances Milestone 1 / OPS-2 and UI-7. It changes only text
printed by existing maintenance commands; options, migration, search and stored
wiki history remain unchanged. Existing technical class names remain unchanged.

Proposed operator-visible wording:

- Migration completion: `Migration recorded as complete: bare set and slide names now mean each page's own layer sets and slides.`
- Embed rewrite: `<page>: point embeds at its own layer sets and slides`
- File migration: `<page>: add layer set "<destination name>" from set "<source name>" page <PDF page> (layer_sets row <row>)`
- Search reindex help: `Index layer text together with page text: page-owned layer sets with their page, a file's layer sets with its file page, and shared sets and slides with the pages that show them.`
- Search reindex result: `Indexed layer text for <count> page(s).`

The `page` field in the file-migration line is the stored member page, not a
new layer-set name; the existing number is retained. Internal comments may be
corrected to explain current behavior without renaming historical identifiers.
The owner approved these wording corrections on October 29, 2026. The 1.45 native search/migration group passed 49 tests / 694 assertions. The command help displayed the approved wording (MediaWiki returned its normal help exit code 1). Exact-commit CI and publication remain pending.
