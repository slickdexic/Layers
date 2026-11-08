# v1.8 search: approved migration boundary

**Status:** approved by the project owner November 7, 2026: “Approve migration
and cleanup before reopening (recommended)”. Qualification remains separate.
**Advances:** Milestone 1 / HIST-4, HIST-8–HIST-9, SEC-2, SEC-6, OPS-1–OPS-3.

**Installed qualification:** rc.3 `de7fce5a1cf049c143f883a8705f565bdd47aa85`
passes the affected native selection on 1.44.6 (59 tests / 531 assertions) and
matching affected source on 1.45.3 (59 / 543). See the current
[acceptance receipt](RELEASE_1_8_ACCEPTANCE.md). Later results supersede the
pre-installation status below. Live-site migration and cleanup remain required.

## Finding and correction already tested

The approved D3 migration copies file sets onto File pages and independent
copies onto their embedding pages; slides also acquire page owners. The old
tables remain for recovery. Nevertheless, current search still reads those old
tables after completion. A native regression proves that deleting layers from
the current File-page revision leaves their original text searchable through
the recovery row. A second regression proves that reindex misses an obsolete
entry once all its Layers associations are gone. Both failed before correction.

The local correction uses only the current owning page's Layers slot after
migration completion and makes post-migration reindex scan every current page
in bounded batches. Original rows, page history, files and existing controls
are preserved. Cleanup refuses disabled search updates and propagates write
failures. The expanded affected native 1.45 run passes **59 tests / 544 assertions**;
PHP style passes. Installed 1.44 qualification is not yet claimed.

The subsequent rc.2 installed 1.44 run exposed an older-core event mismatch and
test scenarios inheriting private-wiki read denial. Rc.3 handles both native
revision-event names and makes public-read fixtures explicit. The corrected
1.45 run passes 59 tests / 543 assertions. Use the rc.3 build receipt for the
installed 1.44 result; the rc.2 failure remains recorded in release acceptance.

## Approved release and upgrade behavior

Readers retain ordinary MediaWiki search. Current page-owned layer text remains
searchable under approved policy A, including when a referenced file is hidden
but the owning page remains readable. Obsolete recovery records do not supply
current search matches. Editors retain the same tools, Save, history and Import.
There is no new index, search screen, backend replacement or runtime service.

For an upgrade from shared sets, the operator completes the existing reviewed
migration, drains old-code work and cleans/rebuilds the search index before
reopening the upgraded site to readers. An edit freeze alone is insufficient
while old searchable entries can still be read. Incomplete or refused migration
does not qualify for public v1.8 operation. Legacy compatibility and rollback
code/data are retained, but a publicly served unmigrated state is not certified
by this solution. A clean new installation also needs a verified completed
migration state (the empty migration can establish it).

**Approved operator wording:** “Keep the upgraded wiki unavailable to
ordinary readers until layer-set migration and search-index cleanup have both
completed successfully. Retained legacy rows are recovery data; after migration,
search uses the current owning page revisions. Do not reopen an incomplete
migration as a qualified v1.8 installation.”

## Proof still required

The owner approved this migrated-only release boundary. Publicly served live
legacy mode remains outside the qualified v1.8 path; the fixes above do not
close its query-time privacy issue.
No outage, migration, live reindex, legacy-table deletion or candidate replacement
has been performed. This approval is not permission to waive page/revision
privacy or to declare the release ready.

Acceptance must demonstrate current image/PDF/slide text, removal of obsolete
terms, native API/Special:Search behavior, cleanup without lost associations,
rerun safety, recovery-row preservation and supported-version compatibility.
Final cutover must stop old code/workers before cleanup, preserve backups and
withhold public access on a failed cleanup. Existing supported MediaWiki search
and normal site maintenance mechanisms remain in use.

## Reproducible local evidence

`tests/phpunit/core/MigratedSearchIsolationTest.php` reproduces the two defects,
checks ordinary text and recovery preservation, queries Special:Search and both
native search API modes (including list counts and absence of continuation),
and exercises native file suppression/restoration before any refresh job.
Its cleanup failure checks cover disabled indexing and an injected write error.
Additional cases preserve both PDF members' searchable text, reject stale slide
properties, and refuse a legacy projection prepared before completion but
delivered after cleanup. The cleanup is also exercised with one-page batches.
The baseline two defect tests failed; the complete affected selection now passes.

The existing 1.45 test configuration uses `unittest_` tables and temporary file
repositories. Selection: `MigratedSearchIsolationTest|PageOwnedSearchPolicyTest|
SearchWriteFenceTest|SearchReindexEmptyTest|LegacySearchSuppressionAuditTest|
LegacyArchivedSourceSuppressionTest|FilePageMigrationTest|SlidePageMigrationTest|MigrationUndoTest|
SearchText|DrawingSearch|ShownSetSearch`. This is a scope description, not a
claim of full-suite or 1.44 validation. Two older upload tests initially failed
against the protected installed upload path; their helper now uses the existing
isolated repository fixture and the final selection passes.

No rollback window is certified safe for public legacy search. A rollback must
retain the reader-access restriction until the restored version/data/index have
been reviewed together. Reopening and any live cutover are not authorized by
this boundary approval alone.
