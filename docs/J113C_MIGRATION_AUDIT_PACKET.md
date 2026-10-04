# J113C — retained file-migration evidence

**Date:** October 3, 2026. **Advances:** HIST-8 and DATA-1; prepares HIST-9.
**Status:** accepted for its read-only scope after external junior and lead
review; see the lead acceptance at the end. The earlier assignment is retained
as review history. The next junior implementation is J113D.
This is a read-only prerequisite to coordinated migration integration, not a
completed migration, a reconciliation plan or permission to change stored names.

Read the [charter](PROJECT_CHARTER.md), especially **Read this first**, and the
[approved behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md), sections 7 and 9.
The identity remains owning wiki page + canonical file + layer-set name. PDF
pages are internal members of one named layer set. Equal names on different
files or owners are valid. Never infer origin by removing numbers or suffixes.

## Implemented scope

- `LayersDatabase::listRetainedFileSetRows()` selects metadata for all retained
  rows of one file, including older layer revisions and source SHA versions.
  It uses the existing filename lookup, excludes slides, orders by row ID and
  never selects or decodes legacy layer JSON.
- `FileMigrationAudit::inspect()` reads the requested owner's exact authorized
  Layers revision. It matches the deterministic migration ID derived from each
  retained row and this owner, then compares canonical file, kind, internal page,
  SHA and local repository. A match uses the retained row, not only the latest
  legacy save. Missing/foreign/hidden owner revisions never fall back to latest;
  denied source-file access never queries retained names.
- The report preserves current names and literal legacy names separately. It
  groups matched evidence by canonical file and exact retained name, and reports
  split current names, multiple source pins, repeated internal pages, names used
  by entries outside the evidence group, and other entries with equivalent
  retained names. Case-equivalent legacy names are reported, not merged.
- Slides are explicitly outside this file/PDF audit. Unknown IDs, unmatched
  records, source mismatches and all existing content remain untouched.
- `maintenance/auditLayerSetMigration.php` is a native administrative command
  requiring an owning page title and exact revision ID. It prints JSON. It has
  no commit/undo option, actor creation, publication, cleanup or completion-state
  mutation. It does not call the migration driver.

The report contains **evidence, not write eligibility**. Retained metadata is
what the legacy table contains now; it is not a sealed record of original
migration-time names. A deterministic-ID/source match does not prove that the
current name, layers or canvas were never edited. `payloadCompared` and
`sourceAvailabilityChecked` are false. Source upload timestamps are not inferred
from layer-save timestamps. File media availability, rename intent, missing
members and a safe final transition still need separate checks. No consumer may
treat an empty `issues` array as authorization to rename, merge or overwrite.

## Use

On the configured MediaWiki installation, run:

```sh
php maintenance/run.php Layers:auditLayerSetMigration \
  --page 'File:Example.pdf' --revision 123
```

Substitute a real owning title and its exact revision. The administrator report
contains internal IDs for review; it does not produce author-facing wikitext.
Like the existing migration dry run, the command uses administrative read
authority without creating a user. Treat the output as administrative metadata.
An unavailable/unsupported owner snapshot stops with an error; an empty Layers
snapshot returns empty entries/groups. There is no implicit latest-revision mode.

## Lead verification

- Focused native: **19 tests / 116 assertions**, no failures or skips.
- Full standalone: **1,486 tests / 3,662 assertions / 1 existing skip**.
- Negative control: temporarily bypassing source-page comparison failed the
  page-mismatch test because it incorrectly reported `retained-row-match`.
  The original source was restored automatically. The SHA and kind cases stayed
  green, so the failure specifically demonstrates the missing page check.
- Required native compatibility group after source restoration: **109 tests /
  1,338 assertions**, no failures or skips (MediaWiki 1.45.3 / PHP 8.3.31).
- Changed-file PHP style, PHP class references (**126 files/classes**), parallel
  lists, atomic-section and diff checks passed. Documentation checks passed:
  **82 maintained/policy documents / 53 historical records**, with mirrors equal.
- Actual maintenance runner refuses `--revision 0` and unsupported `--commit`,
  both with exit 1. Logs: `tmp/j113c-audit-invalid-revision.log` and
  `tmp/j113c-audit-rejected-write-option.log`. The latter never starts the audit.

Native tests use isolated MediaWiki core tables. The lead checked host processes,
container processes and recent activity before testing; no browser acceptance or
ordinary wiki write overlaps the native run. Tests include both actual migration
publications and explicitly marked synthetic historical snapshots, since some
historical combinations are rejected by current publication. Neither source
pins nor names were changed on the ordinary wiki.

Logs: `tmp/j113c-audit-native.log`, `tmp/j113c-audit-standalone.log`,
`tmp/j113c-audit-negative-page.log`, `tmp/j113c-audit-compatibility.log`.
The query implementer passed syntax/style checks; the lead owns native execution.
An attempted second delegated code review stopped at the agent usage limit
without returning findings. No independent acceptance is claimed.

### Development-wiki read-only evidence

After all native testing ended, the command was run against three existing
owners. It used `php maintenance/run.php Layers:auditLayerSetMigration` with
the exact `--page`/`--revision` pairs below. No migration driver or write option
was used. These are examples of retained evidence, not a wiki-wide audit.

| Owning page | Exact revision | Result |
| --- | --- | --- |
| `File:Somepdf.pdf` | 2527 | Six retained source-page matches, all legacy name `001`; stored names are `001`, `001 (page 2)` through `001 (page 6)`. Reports one evidence group with `split-current-names`. |
| `File:Layers_migration_fixture_B.pdf` | 2526 | Two retained matches (pages 1 and 3), both legacy name `notes`; reports the existing split `notes` / `notes (page 3)`. No page-2 member is invented. |
| `File:ImageTest02.jpg` | 2523 | Eight retained matches in eight distinct name groups, with no reported group issue. This does not establish payload equality or readiness to rewrite. |

Exact JSON reports are in `tmp/j113c-audit-somepdf-2527.json`,
`tmp/j113c-audit-fixture-pdf-2526.json` and
`tmp/j113c-audit-image-2523.json`. All current names and content were preserved.
The PDF results give concrete retained-source evidence for the known old
per-page naming defect; they do not authorize a rename or merge.

## Direct assignment to the junior engineer

Review J113C independently and strengthen only missing, meaningful audit tests.
Work from the current uncommitted tree. Read this packet, the charter's **Read
this first**, the approved brief and the active handoff before editing.

**Allowed files:** `src/Migration/FileMigrationAudit.php`,
`src/Database/LayersDatabase.php` (only the new metadata method),
`maintenance/auditLayerSetMigration.php`,
`tests/phpunit/core/FileMigrationAuditTest.php`,
`tests/phpunit/core/RetainedMigrationRowsTest.php`, and an appended report here.
Do not rewrite the lead report or alter unrelated work. Correct a bounded defect
inside this scope if your evidence demonstrates it; report broader findings to
the lead without changing dependent migration/read/write behavior.

1. Trace the exact-revision and permission boundary. Verify there is no latest
   fallback and no legacy metadata query after an owner/source access refusal.
   Check CLI invalid/missing revision handling and rejection of write options.
2. Check provenance claims: current retained rows are metadata evidence, not
   proof of untouched payloads or original naming intent. A prefix, number,
   suffix, label match or matching SHA alone is insufficient. Review historical
   source changes, case/underscore-equivalent names, and source filename changes.
3. Check PDF grouping and file/owner isolation. One retained name may span PDF
   pages; same names on other files or owners are independent. Detect conflicting
   members without silently normalizing them. Do not add any write-plan output.
4. Review the metadata SQL projection and query bounds. Preserve older saves and
   source versions, literal names and typed fields; never load legacy payloads
   just to establish metadata matches.
5. Add a regression only for a real missing risk. Demonstrate it failing before
   a correction, or use a controlled negative case and restore the source.
   Verify unchanged full owner content, legacy row bytes, users and migration
   state around an audit, not merely a successful command exit.
6. Run the focused native tests and the required compatibility filter below,
   serially after checking host/container test and browser activity. Use isolated
   core tables only. Run standalone PHPUnit, changed-file PHPCS, PHP references,
   parallel-list/atomicity, documentation and diff checks. Do not overlap native
   tests with browser acceptance or ordinary wiki maintenance.

```sh
php vendor/bin/phpunit -c phpunit.xml
php vendor/bin/phpcs -sp src/Migration/FileMigrationAudit.php \
  src/Database/LayersDatabase.php maintenance/auditLayerSetMigration.php \
  tests/phpunit/core/FileMigrationAuditTest.php tests/phpunit/core/RetainedMigrationRowsTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml \
  --filter 'FileMigrationAuditTest|RetainedMigrationRowsTest|PageCopyMigrationPdfPageTest|PageCopyMigrationTest|FilePageMigrationTest|SlidePageMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|PdfPageRoutingTest|ScopedCreationCopyTest|DirectEmbeddingRewriterTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

Do not run migration, tidy, undo, cleanup or configuration commands. Do not
activate bare output, add a production caller, change a stored name, open a
browser write workflow, commit or push. Read-only CLI investigation is allowed
after native testing has ended, using an explicitly identified owner/revision.

Append your return report with findings ordered by severity, exact changed
paths, before/after evidence, commands/results, concurrency preflight, preserved
boundaries and remaining limitations. State plainly if there are no blockers.
Return for lead review; do not mark HIST-8 or HIST-9 complete.

## Work retained by the lead

Whole-set allocation/resume in both migration passes and compatible reading of
older numbered/PDF-suffixed entries must move together. The current audit is not
consumed by those writers. Preserve native effective-page admission from J113B;
never expand a group to hide a missing selected page. Retain payloads and pins,
and refuse uncertain reconciliation instead of inferring intent from labels.

Default/show-intent preservation, template/gallery page metadata, completion
accounting, coordinated bare-output activation, tidy/undo and an actual reviewed
write dry run remain open. C2 owner screen approval and the UI-10 viewer remain
separate outstanding charter work. This audit changes none of those decisions.

## Independent review return - October 3, 2026

**Disposition:** no blockers or demonstrated production defects found within
the assigned scope. Returned for lead review, not independent lead acceptance.
This work advances HIST-8 and DATA-1 evidence and prepares HIST-9; it does not
complete HIST-8 or HIST-9 or authorize migration output activation.

### Findings and changes

1. The existing no-write check needed stronger evidence: unchanged row counts
   cannot detect same-count payload or user-row mutations. The test now compares
   SHA-256 digests of complete, ordered legacy and user rows, including legacy
   JSON bytes, and complete main/layers content at the exact old and current
   owner revisions. Existing revision/slot/recent-change counts and the exact
   migration completion value remain checked. This is a corrected test gap,
   not a demonstrated mutation by the audit.
2. Missing boundary coverage was added for zero/nonexistent exact revisions,
   noncanonical source titles, a readable owner with denied source access through
   the real revision reader, and changing source filename while preserving
   identical media SHA/timestamp. Metadata queries are explicitly forbidden on
   access/canonical-title refusal. A changed filename cannot reuse another
   file's deterministic row ID as provenance.
3. The existing case-equivalence regression now also covers underscore/space
   equivalence. Literal retained names remain separate evidence groups, while
   equivalent-name conflicts are reported. A metadata-query regression verifies
   that filename case and literal `%`/`_` characters do not widen the lookup.

Permanent changes in this review are limited to:

- `tests/phpunit/core/FileMigrationAuditTest.php`
- `tests/phpunit/core/RetainedMigrationRowsTest.php`
- This appended report in `docs/J113C_MIGRATION_AUDIT_PACKET.md`

Production audit, metadata method and CLI behavior are unchanged. The temporary
audit mutation described below was fully restored. Shared fixtures, accepted
J113A/J113B work, the lead's updated PDF-page test/report, terminology fixtures
and all unrelated work were preserved.

### Boundary review

The exact revision reader checks owner identity, read authority, visibility and
readable Layers content before retained metadata is available; it does not
substitute latest. Source read authority and canonical file identity are checked
before the filename-bounded query. The SQL projection contains metadata only,
excludes slides, retains older saves/source versions and preserves literal names
and typed fields. No payload is selected or decoded by the audit query.

Evidence requires the owner-derived migration ID and matching file, kind,
internal PDF page, SHA and local repository. Same names on other files/owners
remain independent. A PDF group's pages do not become independently named layer
sets, and missing members are not invented. The stored-document reader already
requires local source repositories; an invalid foreign-repository fixture was
not introduced merely to exercise an unreachable audit branch.

Current retained metadata is not sealed migration-time provenance. Neither
suffixes, case-normalized names nor identical SHA alone prove origin, naming
intent or unchanged layers/canvas. Upload timestamps are not inferred from
legacy layer-save timestamps. Payload comparison and media availability remain
explicitly unchecked, and an empty group issue list is not write eligibility.

### Before/after evidence

- The strengthened focused native suite passed **26 tests / 172 assertions**.
  An earlier run had one incorrect new fixture expectation: changing a filename
  left an unmatched entry using a proven same-file group's current name. The
  audit correctly reported `current-name-used-outside-group`; only the test
  expectation was corrected. Production code was not changed to suppress it.
- Controlled negative case: temporarily replacing normalized retained-name
  comparison with literal equality made both case/underscore cases fail:
  **2 tests / 10 assertions / 2 failures**, each missing
  `other-entry-for-legacy-name`. Restoring the source made the same command pass
  **2 tests / 14 assertions**.
- Controlled negative case: a test-only legacy payload update after the CLI
  audit left counts unchanged but changed the retained-row digest. The no-write
  test failed **1 test / 18 assertions / 1 failure**. Removing that injection
  made the same command pass **1 test / 21 assertions**. No mutation remains.

### Commands and verification

Native commands used this wrapper from the extension directory:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter '<filter>'
```

The focused filter was `FileMigrationAuditTest|RetainedMigrationRowsTest`.
Control filters were `testEquivalentRetainedNamesAreReportedWithoutMerging`
and `testExactOldRevisionFindsRetainedRowsAndCommandWritesNothing`, respectively.
The final compatibility run used the complete, unmodified eleven-class filter
printed in the assignment above: **116 tests / 1,394 assertions**, no failures,
errors or skips, on native PHP 8.3.31 / PHPUnit 9.6.36.

- `php.exe vendor/bin/phpunit -c phpunit.xml`: **1,486 tests / 3,662 assertions**,
  no failures, one existing skip. The exact required command reports no coverage
  driver available; no new coverage measurement is claimed.
- Required five-file `php.exe vendor/bin/phpcs -sp` command: zero errors/warnings.
- `node.exe scripts/check-php-class-refs.js`: passed, **126 files/classes**.
- `node.exe scripts/check-parallel-lists.js`: passed.
- `node.exe scripts/check-atomicity.js`: passed.
- `node.exe scripts/verify-docs.js`: passed, **82 maintained/policy documents /
  53 historical records**, mirrors/references/source checks equal.
- `git diff --check`: passed. Editor diagnostics for all five allowed PHP files
  reported no errors.
- Packet diagnostics: four existing MD013 line-length warnings in the lead's
  table/command text; no appended-section diagnostics. The lead text was
  preserved rather than reformatted.

Before native testing, host processes were inspected with
`Get-CimInstance Win32_Process`, container processes with
`docker top mediawiki-145 -eo pid,etime,args`, and recent activity with
`docker logs --since 5m --tail 30 mediawiki-145`. No active native suite,
automated-browser acceptance or ordinary wiki maintenance was found; only
persistent agent/log-reader processes remained. Native suites and controls ran
serially on isolated core tables. Standalone/static checks did not use those
tables. No native run overlapped the ordinary-wiki CLI checks below.

After all native testing ended, the actual administrative runner was checked:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html mediawiki-145 \
  php maintenance/run.php Layers:auditLayerSetMigration \
  --page File:Somepdf.pdf --revision 2527
```

This read-only command returned exact revision **2527**, six retained-row
matches and one literal `001` evidence group with `split-current-names`.
`readOnly` remained true; `payloadCompared` and `sourceAvailabilityChecked`
remained false. Three argument variants were independently checked: revision
`0` was refused with the positive/exact-revision error; omitting `--revision`
was refused as a required-option error; adding `--commit` to the explicit
2527 command was refused as an unexpected option before audit execution.
All three refusals exited **1**. Testing option rejection did not invoke any
migration/write command. These checks do not constitute a wiki-wide audit.

### Preserved limits and return

No ordinary wiki content, stored name, source pin, configuration or migration
state was changed. No production caller was added; no migration, tidy, undo or
cleanup command, browser write workflow, commit or push was performed.

Whole-set allocation/resume, compatibility reading, Default/show-intent,
template/gallery metadata, accounting, coordinated output activation and any
reviewed write/undo plan remain with the lead. Payload equality, source media
availability and original naming intent remain unproven. The report must not
be consumed as authorization to rename, merge or overwrite. Lead review is the
next step.

## Lead acceptance — October 3, 2026

**Accepted for the read-only audit scope.** The lead reviewed the appended
independent report, both test classes and the unchanged audit/query/CLI code.
No blocking defect or required production correction was found. Full ordered
row digests and exact old/current owner content strengthen the no-write evidence;
the source-file identity, authorization and normalized-name tests preserve the
approved owner/file/name model without turning the report into a write plan.

Fresh lead verification: focused native **26 tests / 172 assertions**, no
failures, errors or skips; five-file PHP style, class references (**126
files/classes**), parallel-list, atomic-section, docs/mirror and diff checks pass.
The junior's broader **116 / 1,394** native and **1,486 / 3,662 / 1 existing
skip** standalone runs remain their evidence; the lead did not repeat them or
the two restored negative controls. Log: `tmp/j113c-lead-review-native.log`.
Native preflight found no competing test/browser work; tests used isolated tables.

While preparing the next reader assignment, the lead ran an additional native
baseline. Its only failure was an inherited expectation of `has no drawings`
against the already approved `has no layer sets` message. The lead corrected
that one test assertion, without changing production code. The final reader
baseline passed **31 tests / 422 assertions**; log:
`tmp/j113d-reader-baseline.log`. That correction is outside the junior's return
and must be preserved.

The [J113D packet](J113D_GROUPED_PDF_READ_PACKET.md) assigns the separable parser
group-counting correction directly to the external junior. A delegated read-only
audit checked its current helper precedence and downstream page routing; the
lead retains the dependent legacy entry-point/provenance transition. No ordinary
wiki read/write command, migration activation, configuration change, browser
acceptance, commit or push occurred during this lead review. J113C acceptance
does not complete HIST-8/HIST-9 or authorize name reconciliation.
