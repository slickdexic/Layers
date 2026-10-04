# J113K — Native PDF metadata producer evidence

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8 and SRCH-1 preparation.
**Status:** ready for JE2; bounded test/report assignment, no caller activation.

JE2, turn the corrected J113I caller map into native regression evidence for the
next lead integration. Read `AGENTS.md`, the charter's “Read this first”, the
active handoff, the lead corrections appended to J113I, J113G and J113J. Preserve
the approved owner/file/name identity: PDF pages are internal members of one
layer set and all members share one name. This assignment changes no runtime
architecture, protected UI, wording, syntax, metadata budget or output behavior.

## Allowed permanent changes

Add `tests/phpunit/core/ShownPdfMetadataProducerTest.php`. Extend
`tests/phpunit/core/PdfPageRoutingTest.php` only when reusing its routing fixtures
avoids unnecessary duplication. Append your report to this packet. Production,
configuration, shared fixtures, other tests/packets and Git state are read-only.
Do not modify JE1's search tests or run production controls. Current producers
must continue emitting legacy triples; G's optional fourth field stays inactive.

## Required native journeys

1. Use actual native uploads and shared legacy rows for one two-page PDF layer
   set named `Notes`. Give its two member pages independently identifiable text.
   Parse direct embeds for pages 1 and 2, a repeated page-2 embed and a template
   expansion mixed with an ordinary embed. Assert rendered thumbnail pages and
   the selected layer payloads, then assert the complete decoded shown-set property.
   The current triple collapses those member occurrences to one exact shared
   file/name selector. Do not invent different layer-set names for PDF pages.
2. Parse an ordinary gallery and a helper-hinted gallery using the supported
   native `page=2` line syntax. Interleave ordinary embeds and assert each actual
   thumbnail page/payload and unchanged metadata. Include malformed repeated
   options and an out-of-range page where supported, and compare with the existing
   native adapter's effective page. Record any page-1 fallback only where a real
   successful native render or the existing adapter demonstrates it.
3. Exercise the existing Cargo gallery formatter with its actual installed field
   contract. Prove rendered default page 1 and unchanged metadata; a repeated row
   is not evidence of a per-row PDF-page selector. If Cargo is unavailable, record
   the precise missing dependency and defer that journey; do not fabricate coverage.
4. Distinguish a successful named/latest gallery, hide intent, a missing name and
   a failed thumbnail. Assert actual output plus metadata so scan-time syntactic
   intent is not confused with a successful render. Existing failed-transform
   queue isolation must keep the following successful gallery's payload correct.
5. Add bounded syntax evidence for separate ID mechanisms: `layerset=id:<rowID>`,
   `layerset=Notes|layersetid=<rowID>`, numeric owner/name references and the
   existing binding path. Assert the actual producer behavior separately from
   migration's pinned-option refusal. Do not normalize/fix producer semantics or
   change ordinary show/hide/default behavior in this test assignment.
6. Test repeated occurrences of one file with two independently named layer sets
   to characterize the filename-keyed gallery hint concern. If it demonstrates a
   current payload mismatch, report the precise ordered input/output and a bounded
   reproducer for lead correction. Do not encode wrong payloads as successful
   expected behavior, weaken an expectation or leave a failing test in the normal
   discovered suite. Preserve such a failure reproducer under ignored `tmp/` and
   include its exact source/command/results in your return. Complete the other
   independent journeys and report the defect separately.

Use independent expected page numbers, exact payload identity and exact decoded
metadata. Do not obtain expected values from the helper under test, assert only
that some attribute exists, or claim an absent-transform fallback is rendered
page proof. Reuse native adapters and fixtures; do not build a new options parser.
The 50-stored-tuple activation constraint remains a lead integration decision;
existing sorted/truncated triples and current search scope are unchanged here.

## Coordination and verification

You may prepare your separate tests/report on the host during JE1's J113J work.
Do not run host full/shared gates or any native test while JE1 has a temporary
production control in place. Your native window begins after JE1 returns its
complete report with byte-exact restoration and window release. That return
releases the queue; no additional permission request is needed. Pass a fresh
idle preflight before starting. No native/browser automation may overlap.

Run the complete filter `ShownPdfMetadataProducerTest|PdfPageRoutingTest|DrawingSearchTest|PageCopyMigrationPdfPageTest`,
then full standalone PHPUnit, changed-test PHPCS/syntax, PHP-reference,
parallel-list, atomicity, documentation and whitespace gates. No mutation is
required for read-only characterization; do not invent restoration evidence.
Keep source fingerprints for `WikitextHooks.php`, `ShownLayerSets.php` and
`PageCopyMigration.php` unchanged from your start to final readback. Preserve
accepted search and H work. No browser/wiki/migration/audit/tidy/undo commands,
activation, configuration or Git index changes, commit or push are authorized.

Append exact inspected paths, permanent changes, native inputs/payload/property
evidence, commands/counts, fingerprints, failures or dependency deferrals and
the remaining producer-integration gaps. Return for lead review. This task does
not complete migration, search security or the Layers 2.0 charter.
