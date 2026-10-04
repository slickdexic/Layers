# J113G — Inactive PDF page metadata for shown layer sets

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8 and DATA-1; prepares SRCH-1.
**Status:** ready for junior implementation; production callers stay unchanged.

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
