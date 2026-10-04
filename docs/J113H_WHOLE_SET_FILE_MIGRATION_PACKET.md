# J113H — Whole-set first-pass file migration and conservative resume

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8/HIST-9 and DATA-1.
**Status:** bounded first-pass implementation and completed independent evidence
accepted; broader copy/reconciliation and charter acceptance remain open.

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

## JE1 preparation return - October 4, 2026

**Status:** test evidence strengthened, host syntax/style checked; runtime work
held for coordination. Asked whether JE2 was clear of control/test activity and
received **"JE2 is active; hold controls and native tests"**. No native test or
temporary production edit was attempted. This does not complete the assignment
or provide restored-control evidence. Resume only after that window is released
and a fresh host/container/wiki idle preflight passes.

### Read-only findings and bounded test changes

No production defect was demonstrated by this read-only pass. Inspection shows
literal-name grouping, all-member conversion before allocation, one allocation
per incoming group, and prior-group presence refusal without reliance on an
unchanged historical name/payload. Existing tests cover exact reruns, edited
prior payloads, newer saves, earlier source versions, incomplete imports,
missing retained metadata and complete historical split-name preservation.
Their prior lead results are not fresh independent verification.

The meaningful gaps addressed in the allowed test file are:

- Full preservation: strengthened the common-name/rerun case with independently
  expected complete members, source repository/file/timestamp/SHA/page pins,
  native geometry, distinct background visibility/opacity and complete layers.
  Added font/style, opacity, rotation, false visibility and lock properties to
  the retained payload so a text-only assertion cannot conceal their loss.
  The expected members are not generated by the converter under review.
  Retained rows/blobs are compared unchanged across fixture publication too.
- File/slide isolation: added a native fixture whose destination already has a
  same-name member on another file and a same-name slide. Both existing members
  must remain byte-equivalent, while the incoming PDF retains one unsuffixed
  name across both pages. Plan state and retained rows are compared as well.
- Invalid names: added whitespace-only literal names for both PDF members;
  expect fixed `invalid-layer-set-name` reasons, no document/additions, null
  commit and identical persistent state, without an ID-derived fallback.
- Structured refusal: strengthened both changed-name/mixed-topology cases with
  an independently valid group sorted ahead of the problematic group. Whole-plan
  refusal must still leave no document/additions, no publisher invocation and
  exact unchanged state, rather than admitting that earlier valid group.

These additions are **native-unverified**. The existing state helper already
drains deferred updates and compares ordered complete `page`, `revision`,
`slots`, `content`, `text`, `layer_sets` and `updatelog` rows, including blob
bytes and flags; no count-only or same-pointer comparison was substituted.
Its refusal/rerun comparisons remain intact.

### Host checks and production preservation

Engine availability: `docker info --format '{{.ServerVersion}}'` returned
**29.8.0**, exit 0. Availability is not an idle/coordination clearance.

After each test edit, this scoped host check passed, exit 0:

```sh
php.exe vendor/bin/phpcs -sp tests/phpunit/core/WholeSetFileMigrationTest.php
php.exe -l tests/phpunit/core/WholeSetFileMigrationTest.php
```

PHPCS: zero errors/warnings. PHP syntax: no syntax errors. Editor diagnostics:
no errors. These checks do not validate native behavior or fixture publication.

Raw production fingerprints initially and after host preparation match the
packet's lead baselines:

```text
src/Migration/FilePageMigration.php
bb6ad6edba2c6d86b1b866cee872e6601302e779a1bf869d5a8ed43e32161e33
src/Migration/MigrationNameAllocator.php
2bbfee098592f58f2f497ea4b7be0a29d7a5ca3ec6220ee86426aba91fe4d71d
```

No production control was applied, so these are preservation fingerprints,
**not restoration evidence**. Both required controls, restored identical-filter
runs, the complete twelve-class native filter and final shared standalone/
style/reference/parallel/atomicity/documentation/diff gates remain pending.
No earlier lead or J113E result is attributed to this J113H continuation.

### Changed paths and remaining limits

Permanent edits are confined to the existing whole-set test file and this
appendix. Other tests, shared fixtures, production code and unrelated work were
preserved. No browser/wiki write, migration/audit/tidy/undo command, configuration
change, source-version update, feature/Default/output activation, commit or push
was made. The code review and test preparation advance HIST-4/HIST-8/HIST-9 and
DATA-1, but acceptance remains pending runtime evidence and lead review.

## Lead coordination release — October 4, 2026

JE2 returned J113G with both controls restored. Lead and delegated read-only
review found no production defect; the helper's actual SHA-256 matches the
reported final baseline. Strengthened G unit coverage and fresh shared host
gates pass. JE2's control window is complete; **JE1's coordination hold is
released**.

JE1, resume this existing H assignment after a fresh host/container/wiki idle
preflight. Preserve the prepared tests and production baselines. Complete both
required controls separately, prove exact-byte restoration and successful
identical-filter reruns, then run the complete twelve-class native filter and
all final shared gates. Append the complete return here for lead review.

The lead read the prepared test changes and confirmed their bounded scope;
three-file host style/syntax checks pass. Those tests remain native-unverified,
and H independent acceptance is pending. The earlier **612 / 5,586 / one skip**
native result predates this preparation and is not evidence for the new tests.
No control or native/browser test was executed by this coordination review.

## JE1 completed runtime return - October 4, 2026

**Findings:** no actionable production defect found within the assigned scope.
The prepared preservation/isolation/refusal tests now pass natively. Both
required controls failed for the intended behavior, were restored separately
to exact baseline bytes, and passed their identical-filter reruns. The complete
twelve-class native gate and shared host gates pass. Returned for lead review,
not lead/owner acceptance or broader migration/charter completion. Advances
HIST-4/HIST-8/HIST-9 and DATA-1. Earlier reports above remain historical.

### Fresh preflight and coordination

The owner's release and the lead's coordination entry were read before running
tests. Docker availability returned **29.8.0**. Host process inspection found
no competing test/maintenance command or automated-browser main process.
Container `ps -eo pid,etime,args` showed only Apache and the inspection command.
All native tests and final gates ran serially, without browser/wiki writes.

Read-only activity checks used the installed `T01revision` table:

```sql
SELECT UTC_TIMESTAMP() AS checked_utc, MAX(rev_timestamp) AS latest_revision,
  SUM(rev_timestamp >= DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 10 MINUTE,
    "%Y%m%d%H%i%s")) AS revisions_last_ten_minutes FROM T01revision
```

At **17:29:36 UTC**, the latest ordinary revision was **20261003150345** and
the last-ten-minute count was **0**. A refreshed host/container/wiki preflight
before the complete native filter, **17:32:07 UTC**, had the same idle result.
Post-native readback at **17:36:12 UTC** still showed that exact latest revision
and zero recent revisions. Native fixture publication used isolated tables;
no ordinary-wiki migration command was invoked.

### Prepared evidence now verified

The unchanged prepared `WholeSetFileMigrationTest` passed **15 tests / 104
assertions**, exit 0, before either control. This validates the previously held
test preparation, not merely its syntax/style. It covers complete rich layer
properties, false visibility/locks, distinct canvas/background settings and
repository/file/timestamp/SHA/page pins against independently expected members.
Both PDF members receive one name, collision allocation applies once, and
other-file/slide names neither reserve that name nor mutate existing members.

Exact reruns and refusals compare complete, explicitly ordered native rows,
including actual `text` blobs/flags, `content` pointers, revision/slot rows,
owner heads, retained JSON bytes and migration state after deferred setup.
There is no count-only or same-pointer shortcut. Successful fixture publication
is outside the no-write interval, with retained rows checked unchanged.

Passing cases include prior edited names/payloads, newer saves, older source
versions, partial imports, missing retained metadata, invalid literal names,
failed conversion, independent valid groups, complete historical split names
and distinct literal names that normalize alike. Both changed-name and
mixed-topology cases refuse the whole plan even with an independent valid group
ahead of them; no publisher call occurs. Presence blocks extension without
being treated as original naming/payload provenance or authority to repair.

### Control 1 - old page suffix

Temporarily replaced only the allocation's label assignment: later PDF members
received the existing `layers-migration-pdf-page-name` message using the allocated
name and their page number; other members kept the allocation. Command:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter \
'testAllPdfMembersReceiveOneNameAndRerunWritesNothing|'\
'testOneCollisionNameAppliesToEveryIncomingPdfPage'
```

Result: exit **1**, **2 tests / 5 assertions / 2 failures**. Expected second
names `Notes` and `Notes 2`, actual `Notes (page 2)` and `Notes 2 (page 2)`.
Restored the original `$surface->label = $allocation['name'];` assignment and
reran the identical command: exit **0**, **2 tests / 20 assertions**.
Raw migration SHA-256 matched its pre-control baseline before control 2 began.

### Control 2 - prior-group presence bypass

Temporarily inserted only `$priorGroups = [];` immediately after the retained
and current-row presence maps were built, before group admission. Exact existing
ID handling and conversion/source checks remained intact. Command:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter \
'testNewLegacySavesDoNotCreateAnotherBranchOfAnAlreadyImportedGroup|'\
'testPriorSourceVersionImportBlocksAnAutomaticNewVersionBranch|'\
'testCurrentImportedIdBlocksExtensionWithoutRetainedMetadata'
```

Result: exit **1**, **3 tests / 10 assertions / 3 failures**:

- Newer saves returned two additions where none were permitted, despite the
  previously imported owner-edited group.
- With retained metadata absent, the missing-member path returned an addition
  where none was permitted, including the first member's row/page metadata.
- The older-source-version case lost `existing-migration-group` and returned
  `incomplete-layer-set`/`source-unavailable`. This demonstrates admission reached
  conversion; it does **not** demonstrate a successful older-version re-import.

Removed the injected map reset, restored exact bytes and reran the identical
command: exit **0**, **3 tests / 20 assertions**. No assertions were weakened.

### Raw-byte restoration and JE2 preservation

`sha256sum` initially, after each restoration and at final readback agreed:

```text
src/Migration/FilePageMigration.php
bb6ad6edba2c6d86b1b866cee872e6601302e779a1bf869d5a8ed43e32161e33
src/Migration/MigrationNameAllocator.php
2bbfee098592f58f2f497ea4b7be0a29d7a5ca3ec6220ee86426aba91fe4d71d
src/Search/ShownLayerSets.php
ec86dd69099caba402735789d5d729b7a46365c1f2514d6a743f45e019f9e300
```

The first two match the packet's lead baselines; the third matches accepted
JE2's restored helper. These are raw file-byte hashes, not Git-filtered hashes.
No temporary control remained during the shared final gates. The prepared
test file and accepted JE2 implementation/tests were not changed in this resume.

### Complete native and shared gates

The complete assigned twelve-class filter ran unchanged; the adjacent quoted
fragments below concatenate to its exact executed argument:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter \
'WholeSetFileMigrationTest|FilePageMigrationTest|FileMigrationAuditTest|'\
'LegacyPdfSelectionTest|FileSurfaceSelectionProjectionTest|'\
'GroupedPdfCompatibilityTest|PageCopyMigrationPdfPageTest|'\
'PageCopyMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|'\
'PdfPageRoutingTest|PageOwnedPilotTest'
```

Exit **0**, **176 tests / 2,238 assertions**, no failures/errors/skips.
Runtime reports **PHP 8.3.31 / PHPUnit 9.6.36**, existing `mediawiki-145`.
This is fresh independent scoped evidence, not a rerun or reattribution of the
lead's earlier complete-native count.

Shared host commands/results, run serially after both controls were restored:

```sh
php.exe vendor/bin/phpunit -c phpunit.xml
php.exe vendor/bin/phpcs -sp src/Migration/FilePageMigration.php \
  src/Migration/MigrationNameAllocator.php \
  tests/phpunit/core/WholeSetFileMigrationTest.php
php.exe -l src/Migration/FilePageMigration.php
php.exe -l src/Migration/MigrationNameAllocator.php
php.exe -l tests/phpunit/core/WholeSetFileMigrationTest.php
node.exe scripts/check-php-class-refs.js
node.exe scripts/check-parallel-lists.js
node.exe scripts/check-atomicity.js
```

- Standalone: **1,542 tests / 3,810 assertions / 1 existing skip**, exit 0,
  no failures/errors. The inherited missing coverage-driver warning remains;
  no new coverage is claimed. Accepted JE2 tests are included in this suite.
- Three-file PHPCS: zero errors/warnings. All three PHP syntax checks pass.
- PHP references: **127 files / 127 classes**, passed. Parallel-list and
  atomicity checks pass. Editor diagnostics for the prepared test: no errors.
- Documentation and whitespace gates are recorded after this appendix below.

### Changed paths and limits

The permanent JE1 footprint remains the prepared whole-set native test and
appended reports in this packet. This resume changes only the report permanently;
both allowed production controls were restored exactly. Unrelated work and
accepted JE2 work were preserved. No configuration/source-version change,
feature/Default/output activation, ordinary wiki content write, migration/audit/
tidy/undo command, browser acceptance, commit or push occurred.

No full native suite, JavaScript/browser, MediaWiki 1.44 or owner screen gate was
rerun. Copy-pass allocation, proven historical resume/reconciliation and broader
HIST-8/HIST-9/Layers 2.0 completion remain outside this return. The conservative
existing-group refusal remains the implementation's documented limitation.
Return to the lead for bounded J113H review.

### Post-append shared gates

- `node.exe scripts/verify-docs.js`: passed, **91 maintained/policy documents /
  53 historical records**; mirrors, references and MediaWiki source checks agree.
- `git diff --check`: passed, exit 0.

## Lead acceptance of completed independent evidence — October 4, 2026

The lead accepts JE1's completed bounded J113H evidence. An independent
read-only reviewer found no actionable defect in the strengthened test diff
or final return. Complete independently expected member payloads/pins, file/slide
isolation, invalid-name refusal and ordered native row/blob comparisons address
the assigned evidence gaps. The second control correctly distinguishes reaching
conversion from successfully importing an older source version.

JE1's two control executions and identical restored reruns retain their junior
attribution; the lead did not repeat those temporary mutations. The current raw
production hashes match the accepted H/F/G baselines. JE1's assigned twelve-class
native **176 / 2,238** remains its own completed execution evidence.

The lead independently ran the same twelve classes plus
`ShownSetSearchQueryTest|DrawingSearchTest`: **195 tests / 2,341 assertions**,
no failures/errors/skips, PHP 8.3.31 / PHPUnit 9.6.36 on the existing MediaWiki
1.45 test environment. Exact filter and log:

```sh
docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml --filter \
'WholeSetFileMigrationTest|FilePageMigrationTest|FileMigrationAuditTest|LegacyPdfSelectionTest|FileSurfaceSelectionProjectionTest|GroupedPdfCompatibilityTest|PageCopyMigrationPdfPageTest|PageCopyMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|PdfPageRoutingTest|PageOwnedPilotTest|ShownSetSearchQueryTest|DrawingSearchTest'
```

`tmp/J113HJ-lead-native.log` preserves the fresh combined result. Fresh full
standalone passes **1,542 / 3,810 / 1 existing skip**; the inherited missing
coverage-driver warning remains. Three-file changed PHP style/syntax and
reference/parallel-list/atomicity checks pass. Final documentation checks pass
for **93 maintained/policy documents / 53 historical records**; exact mirrors
and whitespace checks pass after the new packets/status updates. The fresh lead
logs are preserved in [the H/J archive](acceptance/2026-10-04-j113hj.zip) with
[its SHA-256 manifest](acceptance/2026-10-04-j113hj-manifest.json).

This acceptance advances HIST-4/HIST-8/HIST-9 and DATA-1 within H's first-pass
scope. Copy allocation, proven historical/partial reconciliation, Default/output,
browser/owner acceptance and broader charter completion remain open. No H source
change, ordinary wiki write, activation or migration command occurred in this
lead review. The separately bounded lead search fix is recorded in [J113J](J113J_SHARED_SEARCH_QUERY_PACKET.md).
