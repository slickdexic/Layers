# J113I — Read-only PDF metadata caller audit

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8, DATA-1 and SRCH-1.
**Status:** ready for JE2; documentation-only work during JE1's native window.

JE2, audit the integration points for the accepted, inactive J113G foundation.
Read `AGENTS.md`, the charter's “Read this first”, the active queue and the
J113G/J113H packets. Return a concrete caller and regression map for lead
implementation. Do not activate the foundation or implement another helper.

## Purpose and frozen boundary

Shown-set metadata currently omits PDF pages. J113G can retain an internal
page selector while preserving old triples. Existing production callers still
emit those triples. Before activation, the lead must coordinate native effective
page extraction, template/gallery metadata, migration deduplication and search
without duplicated text. Your audit resolves the implementation map and gaps;
it does not reopen the approved owner/file/name identity or PDF naming model.

All PDF members of a layer set share one name. Page numbers select internal
members. Stored metadata is not authorization, a source-version pin or proof
that historical payloads are unchanged. Preserve existing show/hide intent,
entry points, literal names and selection behavior. J111 rendering/export and
the broader copy/reconciliation implementation remain outside this assignment.

## Allowed scope and starting paths

Append your report to this packet only. Read production, tests and native core
source as needed. Starting paths are:

- `src/Hooks/WikitextHooks.php`: direct/template note sites and `noteGallerySet()`.
- `src/Hooks/SlideHooks.php`: unchanged slide metadata.
- `src/Search/ShownLayerSets.php`: accepted representation and accessor.
- `src/Search/DrawingSearchText.php` and `DrawingSearchHooks.php`: consumers
  and reindex lookup through the unchanged fragment prefix.
- `src/Migration/PageCopyMigration.php`: direct/property shown keys, source
  page selection and property fallback.
- `src/Revision/PageOwnedPilot.php`, `PdfPageRoutingTest.php`,
  `PageCopyMigrationPdfPageTest.php` and existing gallery/search tests: native
  effective-page adapter and available regression fixtures.
  Trace the existing `PageOwnedBindingOptions::sourcePage()` adapter too;
  do not propose a second raw-options parser.

Do not edit source/tests, other packets, shared fixtures or configuration.
Do not run tests, mutations, Docker commands, browsers or wiki/migration
commands. Read-only Git inspection is allowed; no index/ref/configuration
change, commit or push. These limits let your audit run during JE1's control
window without changing or verifying its temporary baseline.

## Required report

1. List every metadata producer/consumer with verified paths and line numbers,
   exact tuple assumptions and the native page value available at each site.
   Trace direct embeds, template expansion, ordinary galleries and helper/Cargo
   gallery paths. Identify paths that still cannot prove an effective page;
   do not invent a fallback or silently assume a requested page was rendered.
2. Map direct/property deduplication and the selected source page in migration.
   Include one file/set shown on two PDF pages, repeated same-page embeds,
   direct plus property evidence, old triples, missing/invalid selected pages
   and independently named files/slides. Specify the existing behavior that
   each proposed regression must preserve and the wrong payload it would catch.
3. Trace search when the same file/set gains multiple page tuples. The current
   collector retrieves all shared-set pages for each kind/name/selector tuple;
   describe how activation would repeat that retrieval. Preserve the existing
   search text scope and permissions: do not propose narrowing it to only the
   selected page. Identify the exact regression needed to prove no duplicate
   text while retaining all previously indexed content and reindex lookup.
   Quantify the 50-stored-tuple limit: many pages of one PDF can consume entries
   that previously represented other files/sets. Include a counterexample with
   another previously indexed file/set; deduplicating text alone does not prove
   that producer truncation preserves it. Report this activation concern without
   changing G's frozen foundation or prescribing a new public behavior.
4. Record show/hide/latest/specific-name behavior, missing named sets and
   explicit ID references at producer sites. Distinguish existing triple
   compatibility from new page metadata; do not infer new Default behavior.
5. Give a bounded production-file list, existing test locations, missing
   counterexamples and a serial verification sequence for lead implementation.
   Report any concrete conflict or unresolved choice separately with evidence.
   Do not treat a report as permission for content reconciliation or activation.

Run only documentation and diff checks for your packet. Append exact inspected
paths, findings, proposed counterexamples, limitations and check results, then
return for lead review. This audit completes no charter criterion or migration.
