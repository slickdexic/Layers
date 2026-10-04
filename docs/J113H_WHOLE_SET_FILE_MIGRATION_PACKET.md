# J113H — Whole-set first-pass file migration and conservative resume

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8/HIST-9 and DATA-1.
**Status:** lead implementation verified; ready for independent junior review.

## Bounded implementation

The first migration pass previously gave every non-first PDF page a different
name and allocated collisions per page. It could also add the missing member
of an incomplete import under another name or start another branch after a
newer legacy save. The owner-approved PDF model requires one set name.

`FilePageMigration::plan()` now groups current-version rows by exact literal
legacy name within its canonical file. It converts every member before admitting
a wholly new group and calls the accepted J113F allocator once for the complete
request. Every PDF member receives its group's single allocation. Equal labels
on other destination files/slides do not reserve that name. Names that compare
alike but have distinct literal source spellings remain separate incoming groups.
IDs, source pins, canvas data, layers and exact owner-base publication are retained.
The existing summary counts unique imported set names, rather than PDF pages.

An existing deterministic ID is used only to block automatic extension. The
retained-row query includes earlier saves and source versions. Current row IDs
independently mark the whole prior group, even if retained metadata is incomplete.
Complete current IDs remain a no-op, including historical split names. Missing/new
IDs in an already imported literal group are reported as `existing-migration-group` and
left untouched. This presence check is not proof of original allocation,
untouched payloads or authority to rename/join existing entries. Reconciliation
and a proven extension/resume plan remain separate lead-owned work.

If a new group's conversion fails, no member of that group is added. The failed
member keeps its specific reason and other members receive `incomplete-layer-set`.
Invalid names are refused as `invalid-layer-set-name`, without an ID fallback.
An independent valid group may still be planned. If final allocator validation
detects a changed literal name or incompatible converted topology, the whole
file plan returns `changed-legacy-group`, empty additions and no document;
commit refuses it. No raw validation text or partial publication escapes.

These fixed diagnostic codes use the existing maintenance report fields. No
button, viewer, UI flow, API route, message catalog or entry point changes.
The conservative refusal is a current limitation reported to the owner the same
day: incomplete imports still need reviewed reconciliation, not automatic repair.
The copy pass remains per stored member; Default/name-only output and ordinary
migration commands remain inactive/unrun in this continuation.

## Lead paths and regression evidence

- `src/Migration/FilePageMigration.php`: grouping, refusal, allocation and summary.
- New `tests/phpunit/core/WholeSetFileMigrationTest.php`: names/collisions, exact
  rerun, partial imports, newer legacy saves with different prior names/payloads,
  conversion failure, historical splits, earlier PDF versions, distinct literal
  names, independent valid groups and changed-group refusal.
- `FilePageMigrationTest.php`: replace the superseded page-suffix expectation
  with one collision name across both PDF members, retaining geometry assertions.
- `LegacyPdfSelectionTest.php` and `FileMigrationAuditTest.php`: explicitly seed
  old split-name fixtures so historical selection/audit coverage does not rely
  on new migration continuing to reproduce the old naming defect.
- `PageCopyMigrationTest.php`: retain the selected-page/output/summary assertions
  using the now-unchanged source name for its single stored PDF page.

Before the correction, the new group class ran **7 tests / 17 assertions / 5
failures**. Failures demonstrated page-suffixed names, inconsistent collision
names, partial extension, duplicate import after newer saves and partial import
when another member cannot convert. Existing complete split-name preservation
passed. A first focused migration/audit/selection/copy/undo gate passed
**91 tests / 1,024 assertions**.

Read-only delegated review then identified an uncaught allocator refusal when
a primary legacy name changes after metadata selection. The maintenance caller
would abort the run. New changed-name and mixed-topology cases demonstrated
**2 tests / 2 assertions / 2 errors** before the structured-refusal fix. The
reviewer subsequently confirmed that the exception is caught before appending
any member, with no publisher invocation. Historical controls and native runs
remain attributed to their executing engineer. Final gates are recorded below.

A final lead regression supplied no retained metadata while the current rows
still included an already imported member. Before the independent current-ID
guard, **1 test / 3 assertions / 1 failure** demonstrated an addition with the
first page's row metadata for the second page's payload. After correction, the
identical filter passed **1 test / 8 assertions**, including complete ordered
state preservation and no publisher call. Read-only review confirmed that prior
groups cannot enter allocation and admitted members retain matching row order.

## Final lead verification — October 4, 2026

The complete native suite passes **612 tests / 5,586 assertions / one existing
skip**, exit 0, with the final current-ID guard. Runtime: MediaWiki 1.45.3 /
PHP 8.3.31 / PHPUnit 9.6.36. Full standalone passes **1,513 / 3,753 / one
existing skip**. The standalone coverage-driver warning is inherited; no new
coverage result is claimed. No JavaScript or browser gate was rerun for this
PHP-only continuation.

```text
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter testCurrentImportedIdBlocksExtensionWithoutRetainedMetadata
php vendor/bin/phpunit -c phpunit.xml
```

Changed-file PHPCS and syntax checks pass for the nine PHP paths in this
continuation (the two migration sources, allocator unit test and six native
tests). Minus-x checks pass for both migration directories. PHP class references
(127 classes/files), parallel-list and atomicity checks pass. Documentation,
exact mirrors and whitespace checks pass: **90 maintained/policy documents /
53 historical records**.
Selected raw logs are preserved in the
[continuation evidence archive](J113EFH_CHECKPOINT_EVIDENCE_2026-10-04.md).

Raw production SHA-256 baselines for the independent controls:

```text
src/Migration/FilePageMigration.php
BB6AD6EDBA2C6D86B1B866CEE872E6601302E779A1BF869D5A8ED43E32161E33
src/Migration/MigrationNameAllocator.php
2BBFEE098592F58F2F497EA4B7BE0A29D7A5CA3EC6220EE86426ABA91FE4D71D
```

The actual migration commands were not run; isolated native fixture publication
does not modify ordinary wiki content. No Default/name-only output, configuration,
browser write, deployment or release acceptance occurred. Independent junior
review and the remaining copy/reconciliation work are still required.

## Junior assignment — independent review and evidence strengthening

Junior engineer, read the charter's “Read this first”, `AGENTS.md`, this packet,
the J113F contract and the active queue. Review this bounded first-pass change,
preserving JE1/JE2 and lead work. Do not implement the copy pass or activate
any broader transition.

Permanent edits are allowed only in `tests/phpunit/core/WholeSetFileMigrationTest.php`
and an appended report here. Read all production paths as needed. If you find
a production defect, provide the exact counterexample and return it to the lead;
do not silently broaden the implementation scope.

1. Verify full member/source/layer preservation and one allocation across PDF
   pages, file/slide isolation, literal-name grouping and exact rerun behavior.
   Strengthen a real gap, not assertions that merely restate helper internals.
2. Check prior IDs from older saves/source versions, edited prior payloads,
   incomplete groups, invalid names, failed conversion and independently valid
   groups. Whole-state comparisons must capture ordered rows/blob bytes after
   fixture/deferred setup; no count-only or same-pointer shortcut.
3. Check structured refusal for changed source names and incompatible converted
   topology. Do not treat deterministic IDs or retained metadata as original
   naming/payload provenance. No suffix stripping, historic merge or repair.
4. Demonstrate two focused controls separately: assign the old page suffix to
   later PDF members (the common-name regression fails), and bypass prior-group
   presence blocking (the newer-save/older-version refusal regression fails).
   Temporary edits to `FilePageMigration.php` are allowed only for these controls.
   Preserve and restore exact production bytes after each control, prove the
   fingerprint and rerun the identical filter successfully before proceeding.
5. Run full standalone, changed-file PHP style, PHP reference/parallel/atomicity,
   documentation and diff gates. Run this complete native filter serially in
   the existing idle environment:

```text
WholeSetFileMigrationTest|FilePageMigrationTest|FileMigrationAuditTest|LegacyPdfSelectionTest|FileSurfaceSelectionProjectionTest|GroupedPdfCompatibilityTest|PageCopyMigrationPdfPageTest|PageCopyMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|PdfPageRoutingTest|PageOwnedPilotTest
```

Do not overlap native tests with browser/wiki writes. No browser acceptance,
ordinary wiki write, migration/audit/tidy/undo command, configuration change,
source-version update, Default/output activation, commit or push is authorized.
Native fixture publications use isolated tables and are not ordinary wiki writes.

Coordinate temporary control windows with the other junior. Run final shared
gates only after both engineers have restored their controls; do not attribute
failures from another engineer's temporary mutation to the submitted baseline.

Append changed paths, findings, exact commands/results, control failures and
restoration, and remaining limitations. Return for lead review; do not claim
the copy pass, proven historical resume/reconciliation, HIST-8/HIST-9, browser
acceptance or Layers 2.0 complete.
