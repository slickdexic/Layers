# J113J — Shared layer-set search query deduplication

**Date:** October 4, 2026. **Advances:** SRCH-1; supports HIST-4/HIST-8.
**Status:** bounded lead implementation accepted after fresh combined gates and
independent read-only review; JE1's independent test/control evidence is next.

## Lead implementation and fixed boundary

The inactive J113G representation can retain several internal PDF member pages
for one shared file/name selector. The existing search collector retrieves all
returned members of that shared layer set for each entry. Repeating the same
query repeats its text. The lead reproduced that failure and now queries each
exact `(kind, file-or-slide name, literal set selector)` once per `get()` call.
First occurrence order is retained. The internal PDF page is deliberately not
part of this query identity: it does not narrow the existing shared search query.

Named selectors, the empty latest selector, different files and file/slide kinds
stay distinct, even when two queries currently return identical text. No names
are normalized, and no text lines are deduplicated. Existing query row/blob/byte
caps, source-version behavior, file-description-page collection, page-owned
revision projection and permission boundaries are unchanged. This work does
not establish missing shared-read or suppression guarantees under SEC-2.

Production changes are limited to `src/Search/DrawingSearchText.php`. Optional
PDF-page metadata producers remain inactive. The 50-stored-tuple activation
concern in J113I, copy-pass allocation, migration property plumbing, gallery hint
association, Default and name-only output remain separate lead integration work.
No UI, wording, syntax, configuration or ordinary wiki content changes occur.
All members of a PDF layer set retain the same name.

## Lead regression evidence

`tests/phpunit/core/ShownSetSearchQueryTest.php` uses native uploads, legacy rows
and the actual search service. Its three new test methods verify:

- A single selected member retains both current PDF member texts, excludes a
  superseded row and agrees with the legacy triple's whole-set projection.
- Actual stored `page_props` containing triples, page-1 quadruples and repeated
  page-2 entries returns the shared text once.
- Multiple files, a slide with the same name, named/latest queries and a literal
  colon selector retain their first-query order and independently expected text.
  Named and latest deliberately retain repeated text when they are distinct queries.

Exact native command, on PHP 8.3.31 / PHPUnit 9.6.36:

```sh
docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter ShownSetSearchQueryTest
```

Before the fix: **4 tests / 9 assertions / 2 failures**, exit 1. Stored duplicate
entries repeated the two-member text four times; distinct-query preservation
also exposed additional repeated PDF and other-file text. After the fix, the
identical filter passes **4 / 9**, exit 0. This is the native runner's filter
count, including the inherited `testValidCovers`, not four newly authored methods.
The native list operation ignores `--filter`; its full listing independently
contains these three authored methods and that inherited case. The logs are
`tmp/J113J-before-native.log` and `tmp/J113J-after-native.log`.

A delegated read-only review found no actionable code defect: exact identity,
first order, named/latest distinction and unchanged scope/caps are preserved.
Every actual production provider supplies `ShownLayerSets::decode()` output;
the JSON key encoder cannot encounter invalid UTF-8 through a valid provider.
The reviewer ran no tests or controls. Lead execution evidence retains its attribution.

The fresh fourteen-class native gate covering H's complete twelve-class filter
plus `ShownSetSearchQueryTest|DrawingSearchTest` passes **195 / 2,341**, with no
failures/errors/skips. Full standalone passes **1,542 / 3,810 / 1 existing skip**;
the inherited coverage-driver warning remains. Changed three-file PHP style and
syntax, PHP references (**127 / 127**), parallel-list and atomicity gates pass.
No current full-native, JavaScript, browser, MediaWiki 1.44, owner screen or SEC-2
acceptance is claimed. Final documentation checks pass for **93 maintained/policy
documents / 53 historical records**; exact mirrors and whitespace checks pass.

The lead's accepted raw source SHA-256 is
`CAD1811D9D3FB6A1E40521F10AB1DCFD9936DBFCBEE5C9AC7367A571F2828B66`.
H/F/G raw hashes are unchanged. Before/after and combined/standalone evidence,
plus the native listing that identifies inherited `testValidCovers`, are
preserved in [the five-log archive](acceptance/2026-10-04-j113hj.zip) and its
[hash manifest](acceptance/2026-10-04-j113hj-manifest.json). The archive is
12,607 bytes; SHA-256
`7BC84739065AA329FAE78922DB5E935DDD4E0BAE112DBE1B8029AFD3D88C368C`.
Original logs remain intact; archive integrity and each entry hash were verified.
No future Git SHA or push is claimed in this entry.

## Direct assignment — JE1

JE1, independently review and strengthen this bounded search change. Read
`AGENTS.md`, the charter's “Read this first”, the active handoff, this packet and
the lead corrections appended to J113I. Preserve accepted H/G and unrelated work.

### Allowed permanent changes

Edit `tests/phpunit/core/ShownSetSearchQueryTest.php`, and add focused cases to
`tests/phpunit/core/DrawingSearchTest.php` if needed. Append your report to this
packet. Production code is available only for the two temporary controls below;
restore its exact original bytes before every normal gate and before returning.
Do not edit production permanently, metadata producers, the database search
reader, migration code, UI, configuration, other packets or shared fixtures.

### Required evidence

1. Verify the exact query identity against real results. Strengthen evidence that
   each distinct query executes once, while different literal selectors, files
   and file/slide kinds remain separate. Do not merely recreate the implementation's
   key algorithm in a test. Actual stored metadata and independent expected text
   must continue to exercise whole-member search with a superseded row excluded.
2. Exercise `DrawingSearchHooks::onSearchDataForIndex2()` with triple/quadruple
   metadata. Preserve pre-existing `auxiliary_text` fields and include all returned
   PDF members once for an exact shared query. Separately prove the unchanged
   fragment prefix finds a stored quadruple during reverse reindex lookup.
   Use isolated native fixtures; do not modify ordinary wiki pages.
3. Preserve named versus empty/latest queries when both currently return the same
   layer set. Preserve visible/rich-text projection and existing hidden-layer
   exclusion. Do not add source-version, permissions, normalization or search
   budget behavior to this assignment.
4. Control 1: temporarily bypass only the new duplicate-query guard in
   `DrawingSearchText::get()`. Your stored-metadata and hook regression must fail
   with repeated complete text. Restore raw bytes and pass the identical filter.
5. Control 2: temporarily omit only `$setName` from the new query key. A regression
   distinguishing named/latest and another literal selector must fail because
   an independently expected query's text is lost. Restore raw bytes and pass
   the identical filter. Do not weaken assertions or change fixture expectations.

### Coordination and gates

You have the first native verification window. Pass a fresh idle preflight;
JE2's J113K host preparation may proceed, but its native work waits until your
complete return releases the window. No browser automation or other native
test/control may overlap your controls. Record raw SHA-256 hashes before and
after each restoration for `DrawingSearchText.php`, `ShownLayerSets.php` and
`FilePageMigration.php`. Abort a control if the baseline changes unexpectedly.

Run the complete native filter `ShownSetSearchQueryTest|DrawingSearchTest|PdfPageRoutingTest|WholeSetFileMigrationTest|PageCopyMigrationPdfPageTest`.
Then run full standalone PHPUnit, changed-file PHPCS/syntax, PHP-reference,
parallel-list, atomicity, documentation and whitespace gates. No JavaScript or
browser rerun is needed for this PHP test/report assignment. No migration/audit/
tidy/undo commands, ordinary wiki writes, activation, Git index/config changes,
commit or push are authorized.

Append exact changes, commands, counts, both failures/restorations/identical
reruns, hashes, limitations and native-window release. Return for lead review.
Do not claim broader search security, producer activation or charter completion.
