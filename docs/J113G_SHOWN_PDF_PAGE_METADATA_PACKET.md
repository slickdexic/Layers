# J113G — Inactive PDF page metadata for shown layer sets

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8 and DATA-1; prepares SRCH-1.
**Status:** inactive foundation accepted by the lead October 4; production callers stay unchanged.

Junior engineer, implement the bounded metadata foundation in this packet and
return it for lead review. Read `AGENTS.md`, the charter's “Read this first” and
the active queue. Preserve the accepted J112/J113 work and other junior returns.

## Purpose and boundary

`ShownLayerSets` records parser metadata for files/slides shown through templates
and galleries. Its current tuple has kind, canonical file/slide name and set
selector, but no PDF page. Later migration therefore assumes page 1. The lead
will coordinate native effective-page extraction, gallery thumbnails, search
deduplication and migration consumption. Implement only a backwards-compatible
optional page representation now. Do not wire any production caller to it.

A PDF page is an internal member selector, never part of its layer-set name.
The owner/file/name identity and historical literal names remain unchanged.
This metadata is not authorization, a source pin or migration provenance.

## Allowed files

- `src/Search/ShownLayerSets.php` only.
- New `tests/phpunit/unit/Search/ShownLayerSetsTest.php`.
- Append your report to this packet.

Do not edit parser hooks, migration/search consumers, shared bootstrap, source
admission, APIs, messages, UI, configuration or other tests. The standalone
bootstrap already aliases the Parser namespace. Use a local PHPUnit mock with
an added `getOutput` method if required; do not expand shared stubs.

## Frozen representation and API

Retain `note()`, `decode()`, `fragment()`, the property name, deterministic
sorting/deduplication, Unicode/slash encoding and 50-entry limit.

1. Add optional `int $page = 1` to `note()`. Existing calls and page-1 output
   remain byte-identical triples `[kind, name, set]`. A file entry with page
   greater than 1 is `["file", name, set, page]`. Slide entries remain triples.
2. Refuse page 0/negative values and slide requests with page other than 1 using
   `InvalidArgumentException`, before changing parser output. The method's
   integer type remains explicit; do not accept arbitrary numeric strings.
3. `decode()` accepts old triples unchanged and file quadruples with an integer
   page greater than zero. A file quadruple explicitly using page 1 normalizes
   to its triple, so it cannot consume another entry beside the old form.
   Drop malformed tuples, string/float/bool/null pages, page 0/negative values,
   all slide quadruples and tuples with extra fields. Retain existing required
   kind/name/set validation and stored order; do not sort in `decode()`.
4. Add `public static function sourcePage( array $entry ): int`. For a valid
   decoded entry it returns the fourth field, otherwise the historical default
   1 when that field is absent. Its input contract is a decoded entry, not raw
   unvalidated JSON; do not invent media resolution or repair behavior.
5. Same kind/name/set/page entries deduplicate; distinct file pages remain
   distinct metadata entries. Note order must not affect stored bytes. A later
   ordinary page-1/slide note must preserve earlier valid quadruples.
6. Preserve `fragment()` exactly, including escaping behavior. Its existing
   database lookup must still match a file/slide across all supported tuples.

The unchanged limit applies to stored tuples. Caller activation remains gated
on native tests for page options, template/gallery selection, show intent,
direct/property deduplication and search text without duplicates. No claim of
complete migration or page-aware parser output is authorized by this component.

## Required tests and negative controls

Compare exact stored property bytes and exact decoded arrays. Cover:

- Old page-1/slide calls, reverse note order and duplicates: byte-identical
  output to the current implementation, including Unicode, quotes and slashes.
- Mixed old triples and pages 2/3; explicit fourth-field page 1 normalization;
  round trips; preservation of page 2 after an unrelated old-form note.
- All malformed page types/ranges, slide quadruples, extra fields and current
  invalid kind/name/set cases. Retain literal suffixes in names/selectors.
- The source-page accessor on old triples and valid page-2 metadata.
- Exactly 50 stored entries, deterministic sorting and no duplicate budget
  consumption for equivalent page-1 triple/quadruple forms.
- A refused `note()` leaves the complete parser property's bytes unchanged.
- Existing `fragment()` output bytes and matching against encoded quadruples.

Demonstrate two controls, one at a time: discard the file page during encoding
(the exact page-2 test fails), then restore; reject all quadruples during decode
(the mixed round-trip/preservation test fails), then restore. Record commands,
failures and exact-byte restoration fingerprints. Rerun each affected filter
successfully before the next control and the final gates. Do not weaken tests.

Run focused unit tests, full standalone, changed-file PHP style, reference,
parallel-list/atomicity, documentation and diff checks. No native/browser run
is required for this inactive foundation. No ordinary wiki writes, migration
command, caller activation, configuration change, commit or push.

Coordinate temporary control windows with the other junior. Run final shared
gates only after both engineers have restored their controls; do not attribute
failures from another engineer's temporary mutation to the submitted baseline.

## Return

Append exact changed paths, commands/results, both controls/restoration and
limitations. State that existing callers still emit old metadata and that the
lead owns page-aware caller integration. Return for bounded lead review; do not
declare any charter criterion complete.

## Junior implementation report — October 4, 2026

**Role:** Junior engineer 2 (JE2). **Status:** implemented and verified; inactive foundation; returned for lead review.
**Advances:** HIST-4/HIST-8 and DATA-1; prepares SRCH-1.

### 1. Changed paths

- `src/Search/ShownLayerSets.php` (updated helper with optional page parameter, normalization and accessor)
- `tests/phpunit/unit/Search/ShownLayerSetsTest.php` (new unit test class covering metadata encoding, decoding, normalization, limits, and refusals)
- `docs/J113G_SHOWN_PDF_PAGE_METADATA_PACKET.md` (this report appended)

No other files were created or modified.

### 2. Implemented representation and API

Implemented the frozen specification in `MediaWiki\Extension\Layers\Search\ShownLayerSets`:
- **`note( Parser $parser, string $kind, string $name, string $set, int $page = 1 ): void`:**
  - Added optional `int $page = 1`.
  - File entries with `$page > 1` are stored as quadruples `["file", name, set, page]`.
  - Existing calls, page-1 calls, and slide entries remain byte-identical triples `[kind, name, set]`.
  - Refuses `$page < 1` and slide requests with `$page !== 1` using `InvalidArgumentException` before accessing or mutating parser output.
  - Deduplicates identical entries deterministically and enforces the 50-entry stored limit.
- **`decode( $value ): array`:**
  - Accepts old triples `[kind, name, set]` unchanged.
  - Accepts file quadruples `["file", name, set, page]` where `page` is an integer greater than zero.
  - Normalizes explicit file page-1 quadruples `["file", name, set, 1]` to triples `["file", name, set]`, preventing double-budget consumption beside the triple form.
  - Drops malformed tuples, non-integer pages (string, float, bool, null), pages $\le 0$, all slide quadruples, extra fields ($> 4$ elements), and non-list arrays.
  - Preserves stored order without sorting.
  - Retains literal suffixes in names and selectors (e.g. `Notes (page 2)`).
- **`sourcePage( array $entry ): int`:**
  - Returns the fourth field if present, valid, and $> 0$; otherwise returns the historical default `1`.
- **`fragment( string $kind, string $name ): string`:**
  - Retained byte-for-byte; continues matching both triples and quadruples in database search queries.

### 3. Verification and gate results

- **Focused unit class:**
  `php vendor/bin/phpunit --configuration phpunit.xml tests/phpunit/unit/Search/ShownLayerSetsTest.php`
  `OK (26 tests, 48 assertions)`
- **Full standalone suite:**
  `php vendor/bin/phpunit --configuration phpunit.xml --testsuite Unit`
  `OK, but incomplete, skipped, or risky tests! Tests: 1539, Assertions: 3801, Skipped: 1`
  (Previous 1,513 tests / 3,753 assertions / 1 skip + 26 new tests / 48 assertions = 1,539 / 3,801 / 1 skip).
- **Changed-file PHPCS:**
  `php vendor/bin/phpcs -sp --cache --runtime-set ignore_warnings_on_exit 1 src/Search/ShownLayerSets.php tests/phpunit/unit/Search/ShownLayerSetsTest.php`
  `.. 2 / 2 (100%) - OK (0 errors, 0 warnings)`
- **Parallel lint:**
  `php -d error_reporting=8191 vendor/bin/parallel-lint src/Search/ShownLayerSets.php tests/phpunit/unit/Search/ShownLayerSetsTest.php`
  `Checked 2 files in 0.1 seconds - No syntax error found`
- **Minus-X whitespace check:**
  `php vendor/bin/minus-x check src/Search && php vendor/bin/minus-x check tests/phpunit/unit/Search`
  `All good!`
- **PHP references gate:**
  `node scripts/check-php-class-refs.js`
  `PHP class references OK (127 files, 127 extension classes).`
- **Parallel lists check:**
  `node scripts/check-parallel-lists.js`
  `Parallel lists agree (boolean properties, layer types, page-owned renderable types).`
- **Atomicity check:**
  `node scripts/check-atomicity.js`
  `Atomic section usage OK.`
- **Documentation check:**
  `node scripts/verify-docs.js`
  `Documentation checks passed: 90 maintained/policy documents, 53 historical records; mirrors, references and MediaWiki source checks agree.`
- **Git diff whitespace check:**
  `git diff --check`
  Clean (exit code 0).

### 4. Negative controls

Both negative controls were demonstrated, observed to fail as expected, and restored to identical SHA-256 fingerprints:

1. **Control 1: Discard file page during encoding**
   - Mutation: Temporarily omitted the `$page > 1` condition in `note()`, encoding all file entries as triples `[ $kind, $name, $set ]`.
   - Command: `php vendor/bin/phpunit --configuration phpunit.xml --filter testExactPageTwoStoredBytesAndSourcePageAccessor tests/phpunit/unit/Search/ShownLayerSetsTest.php`
   - Observed failure:
     ```text
     1) MediaWiki\Extension\Layers\Tests\Unit\Search\ShownLayerSetsTest::testExactPageTwoStoredBytesAndSourcePageAccessor
     Failed asserting that two strings are identical.
     --- Expected
     +++ Actual
     @@ @@
     -'[["file","Doc.pdf","ABC",2]]'
     +'[["file","Doc.pdf","ABC"]]'
     ```
   - Restoration: Restored quadruple encoding for `$page > 1`.
     SHA-256 fingerprint verified identical: `EC86DD69099CABA402735789D5D729B7A46365C1F2514D6A743F45E019F9E300`.
   - Rerun filter: `OK (1 test, 5 assertions)`.

2. **Control 2: Reject all quadruples during decode**
   - Mutation: Temporarily required `count( $entry ) === 3` only in `decode()`, dropping any quadruple.
   - Command: `php vendor/bin/phpunit --configuration phpunit.xml --filter testMixedTriplesAndPagesWithPageOneNormalizationAndPreservation tests/phpunit/unit/Search/ShownLayerSetsTest.php`
   - Observed failure:
     ```text
     1) MediaWiki\Extension\Layers\Tests\Unit\Search\ShownLayerSetsTest::testMixedTriplesAndPagesWithPageOneNormalizationAndPreservation
     Failed asserting that two arrays are identical.
     --- Expected
     +++ Actual
     @@ @@
      Array &0 (
          0 => Array &1 (
     -        0 => 'file'
     -        1 => 'Doc.pdf'
     -        2 => 'SetA'
     -    )
     -    1 => Array &2 (
     -        0 => 'file'
     -        1 => 'Doc.pdf'
     -        2 => 'SetB'
     -        3 => 2
     -    )
     -    2 => Array &3 (
     -        0 => 'file'
     -        1 => 'Doc.pdf'
     -        2 => 'SetC'
     -        3 => 3
     -    )
     -    3 => Array &4 (
              0 => 'slide'
              1 => 'S1'
              2 => ''
          )
      )
     ```
   - Restoration: Restored quadruple support in `decode()`.
     SHA-256 fingerprint verified identical: `EC86DD69099CABA402735789D5D729B7A46365C1F2514D6A743F45E019F9E300`.
   - Rerun filter: `OK (1 test, 3 assertions)`.

### 5. Explicit declarations and remaining scope

- Existing callers continue to emit old metadata (triples); no production callers were activated.
- No changes to UI, configuration, translation, API routes, or fixtures.
- No ordinary wiki writes, database writes, git commit, or git push occurred.
- Lead retains page-aware caller integration (native effective-page extraction, gallery thumbnails, search deduplication, and migration consumption).
- This implementation does not claim J113, migration, or any charter criterion complete. Returned for bounded lead review.

## Lead acceptance and coordination clearance — October 4, 2026

Source, caller and delegated read-only review found no production defect in the
bounded foundation. The actual helper SHA-256 matches the junior's recorded
restoration fingerprint:
`EC86DD69099CABA402735789D5D729B7A46365C1F2514D6A743F45E019F9E300`.
The two control failures and restorations remain attributed to JE2; the lead
did not repeat the mutations or claim their execution as fresh lead evidence.

The [lead log archive](acceptance/2026-10-04-j113g.zip) retains the focused and
full standalone runs below. Its
[SHA-256 manifest](acceptance/2026-10-04-j113g-manifest.json) verifies exact
source-log bytes and archive integrity; the original local logs remain intact.
It contains no newly executed negative controls or native/browser evidence.

Lead review added three meaningful unit cases: the same file/set on pages
1/2/3 stays distinct under reversed note order and duplicate notes; an initial
page-1 quadruple plus its triple consumes one entry at the 50-entry boundary;
and escaped quotes/Unicode/slashes round-trip and retain exact fragment bytes.
No production correction was required. Fresh focused **29 tests / 57
assertions** and full standalone **1,542 / 3,810 / one existing skip** pass,
exit 0. Three-file PHP style/syntax (including JE1's prepared H test), minus-x,
class references (127 classes/files), parallel-list and atomicity gates pass.
The coverage-driver warning is inherited; PHP coverage remains unmeasured.

```text
php vendor/bin/phpunit -c phpunit.xml tests/phpunit/unit/Search/ShownLayerSetsTest.php
php vendor/bin/phpunit -c phpunit.xml
```

J113G is accepted only as metadata representation/accessor support. Existing
production callers still emit triples. Native effective-page extraction,
template/gallery wiring, direct/property deduplication, migration consumption
and search without duplicate text remain lead-owned integration work. No
native/browser run, configuration change, ordinary wiki write, caller activation
or broader charter acceptance occurred in this review.

JE2's completed return and restored production fingerprint close its control
window. The lead releases JE1's coordination hold. JE1 must still pass a fresh
host/container/wiki idle preflight and complete the outstanding H native filter,
both separately restored controls and final shared gates. Its current prepared
native tests are unverified; earlier lead results are not their runtime evidence.

Final lead documentation checks pass for **91 maintained/policy documents /
53 historical records**; both mirrors match and `git diff --check` passes.
The curated G checkpoint excludes JE1's two partial H paths and the existing
generated browser outputs. Those local files remain intact for the completed
H return. J113I is the next documentation-only JE2 assignment; it does not
authorize tests or source changes during JE1's native window.
