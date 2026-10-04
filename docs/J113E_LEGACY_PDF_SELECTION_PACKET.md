# J113E — exact legacy File-page PDF selection

**Date:** October 4, 2026. **Advances:** HIST-4/HIST-8 and DATA-1.
**Status:** implemented and verified locally by the lead. External read-only
review returned October 4; the assigned runtime evidence/test strengthening and
both negative controls remain deferred because the existing engine is unavailable.

Read the [charter](PROJECT_CHARTER.md), especially **Read this first**, the
[approved behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md), and the active
[handoff](IMPLEMENTATION_HANDOFF_PLAN.md). Work from this uncommitted tree;
preserve all prior lead and junior changes. Layers runs through MediaWiki;
Docker is only the existing test environment.

## Implementation and its limits

The old `action=editlayers` selector constructed a different layer-set name for
PDF page 2 and above. It could not select page 2 of a PDF whose stored pages all
have the same name. Its identity-only list also could not distinguish files or
internal PDF pages. J113D separately corrects parser group counting; this work
corrects the existing legacy editor entry point.

- `PageOwnedPilot::getFileSurfaceSelections()` reads the exact authorized
  revision through the same boundary as `getHistorySurfaces()`. It returns the
  ordered supported identities, adding only canonical stored file title and
  internal page for image/PDF entries. It does not resolve source media, expose
  payloads/pins or write. `getHistorySurfaces()` and existing list shapes stay
  unchanged.
- `FilePageDrawings::select()` restricts selection to the File owner, that
  canonical file, normalized layer-set name and exact internal page. An exact
  unique match wins. Duplicate exact matches refuse selection. Empty requests
  retain the existing entire-list-single-entry rule, and must still match the
  owner's file and requested page. Slides/other files never substitute.
- Older split PDF labels remain reachable by the old request only when exactly
  one candidate has the legacy generated name and `FileMigrationAudit` reports
  a retained-row match at that exact owner revision. The retained original name
  must normalize to the requested name. Deterministic owner-bound ID, source
  file, kind, page, SHA-1 and local repository are checked by the audit. A literal
  suffix alone is no evidence; duplicate aliases refuse even when only one has
  retained evidence. Newer legacy rows do not replace the exact matched row.
- The audit is read evidence for compatibility, **not sealed provenance, proof
  of unedited names/payloads, a source-availability check or write eligibility**.
  Selection returns only identity metadata. The editor still checks the selected
  source and current revision through its existing admission path.
- `EditLayersAction` uses canonical positive-integer validation and native PDF
  page-count clamping; non-PDF images select page 1. The pre-migration path,
  listing entries/messages, tabs and links remain in place. An unavailable or
  ambiguous request leaves the existing list available. No entry point is
  removed. The old public `find()` remains available but has no production
  caller; the action now uses the exact selector.

This does not rename records or complete whole-set migration allocation/resume,
numbered-alias bound-editor parity, Default/show-intent, template/gallery page
metadata, writer output activation, tidy/undo or owner acceptance. C2 screen
approval remains separate. No production configuration or ordinary wiki content
was changed; no migration command, browser write, commit or push was performed.

## Lead evidence

The delegated engineer implemented the metadata projection and its test class.
The lead implemented selector/action integration and the native action tests.
A subsequent read-only internal review found an invalid remote-repository
fixture and a duplicate-alias edge; both were corrected. The reviewer found no
remaining actionable issue in the corrected files and ran no tests.

Two action regressions failed before the selector fix: grouped PDF page 2 and
an out-of-range PDF page request both failed to open their effective page.
Before-fix result: **2 tests / 6 assertions / 2 failures**, in
`tmp/J113E-before.log`.

The first expanded focused run had **43 / 516 / 1 failure**: the schema correctly
rejected a historical fixture using a remote repository before selection ran.
The test now uses a structurally valid PDF surface with mismatched retained-row
MIME evidence. No schema or production validation was relaxed. A further case
checks one proven plus one unproven duplicate alias. Final focused native:
**43 tests / 519 assertions**, no failures/errors/skips;
`tmp/J113E-focused-final.log`.

The complete unchanged J113D fourteen-class gate, plus both new test classes and
`PageOwnedPilotTest`, passed **191 tests / 2,357 assertions**, no failures,
errors or skips; `tmp/J113DE-native-gate.log`. Native runs were serial, used
isolated core tables, and did not overlap browser acceptance or ordinary wiki
maintenance. Preflight checked host processes, container processes and recent
wiki activity. Runtime: MediaWiki 1.45.3 / PHP 8.3.31 / PHPUnit 9.6.36.

Full standalone: **1,486 tests / 3,662 assertions / 1 existing skip**, no
failures/errors; `tmp/J113E-standalone.log`. The inherited no-coverage-driver
warning is not a new coverage result. Seven-file PHP style, PHP references
(126 files/classes), parallel-list, atomic-section and diff checks passed.
Final documentation/mirror checks are recorded with the lead acceptance.
No fresh JavaScript, browser, full-native or MediaWiki 1.44 acceptance is claimed.

On October 4 the completed native log was read back successfully, but the
existing Docker engine was unavailable. Do not count that as a fresh native
preflight or repeat tests until the existing environment is available and idle.

## Lead completion — October 4, 2026

The lead reviewed the implemented projection, selector/action integration and
final native/standalone logs. Verification above passes. Final documentation
checks pass for **84 maintained/policy documents and 53 historical records**;
status and changelog mirrors match, references agree, and `git diff --check`
passes. External review remains ready to dispatch. This is bounded local
implementation completion, not owner screen sign-off or charter completion.

## Junior assignment — review and strengthen evidence

Review J113E independently. Strengthen only the tests below where a concrete
gap remains. Do not redesign identity, change production code, add messages or
activate migration output. If you find a demonstrated production defect, return
its reproducer and recommended correction to the lead.

**Allowed writes:**

- `tests/phpunit/core/LegacyPdfSelectionTest.php`;
- `tests/phpunit/core/FileSurfaceSelectionProjectionTest.php`;
- append your report to this packet.

Read the three production files above and `FileMigrationAudit`/`PageHistoryAccess`
as needed. Do not change shared fixture helpers, legacy listing tests or unrelated
work. Do not create ordinary wiki pages, invoke migration/audit/tidy commands,
change configuration, run browser acceptance, commit or push.

1. Check exact owner/revision/file/name/page boundaries, normalization, duplicate
   refusal and exact-name precedence. Check that the evidence-backed old suffix
   path cannot select another file/page or infer an original name from its text.
   Include an ID made for another owner with otherwise matching retained source
   metadata; it must not qualify. Literal suffix names remain directly usable
   under their actual names.
2. Follow one grouped page-2 action redirect and one retained split-name redirect
   into `prepareCurrentEditor()`. Assert the selected surface ID, source page,
   payload/layer properties and source pin against the stored selected member.
   Confirm the revision is the owner revision used by the current editor. A
   sibling page's distinct layer content must never be returned. Use isolated
   native fixtures, not an ordinary-wiki request.
3. Extend ordered full-byte no-write evidence to grouped selection, evidence-backed
   alias selection and denied/missing/ambiguous selection. Capture owner head,
   exact main/layers content, retained legacy rows, revision/slot rows and migration
   state after fixture/deferred writes finish. Compare deterministic ordered
   state before/after. Distinguish test fixture publications from selector writes.
4. Check current and old-revision metadata reads and unavailable/suppressed owner
   handling without a latest fallback. Preserve `getHistorySurfaces()`'s old
   projection and existing full-list behavior. Test requests with no name and
   multiple entries; do not consolidate listings or activate Default.
5. Demonstrate a restored negative control that bypasses the retained-name/evidence
   guard: the literal suffix/unproven identity case must fail. Demonstrate one
   that omits the source-page filter: exact grouped-page selection must fail.
   Use minimal temporary edits, restore each exactly before the next step, and
   rerun the affected filter. Do not weaken assertions to obtain failures/pass.
   These temporary controls are the only permitted production edits.
6. Run the gates below serially after an idle native preflight. If the test engine
   is unavailable, complete read-only review and host/static work, record the
   limitation, and return without claiming native verification. Report unrelated
   failures precisely; do not remove a required test class.

```sh
php vendor/bin/phpunit -c phpunit.xml
php vendor/bin/phpcs -sp src/Migration/FilePageDrawings.php src/Action/EditLayersAction.php \
  src/Revision/PageOwnedPilot.php tests/phpunit/core/LegacyPdfSelectionTest.php \
  tests/phpunit/core/FileSurfaceSelectionProjectionTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml \
  --filter 'LegacyPdfSelectionTest|FileSurfaceSelectionProjectionTest|GroupedPdfCompatibilityTest|LegacyEntryPointsAfterMigrationTest|FileMigrationAuditTest|RetainedMigrationRowsTest|PdfPageRoutingTest|PageOwnedPilotTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

Return actionable findings with exact file/line and a failing native reproducer,
or state that you found none within this scope. List added cases, final results,
negative-control failures/restoration, no-write evidence and remaining limits.
Append the report here and return to the lead. Do not mark broader HIST-4/HIST-8
or Layers 2.0 complete.

## External review return - October 4, 2026

**Disposition:** read-only review and available host checks completed; native
evidence strengthening is blocked by the unavailable existing test engine.
No demonstrated production defect was found on inspection. This is not native
acceptance, completion of the junior assignment or lead sign-off. Work remains
against HIST-4/HIST-8 and DATA-1 as specified above.

### Environment blocker

Before attempting any native test or negative control, this review ran:

```sh
docker info --format '{{.ServerVersion}}'
```

It exited **1**: connection to `npipe:////./pipe/dockerDesktopLinuxEngine`
failed because the named pipe did not exist. The existing container cannot be
verified available or idle through that engine. No alternate engine/container
was provisioned, configuration changed or Docker startup attempted.

Host inspection using `Get-CimInstance Win32_Process` found no active PHP/Node/
Docker test/maintenance command or automated-browser main process. That is
host-only evidence, not a successful native preflight. Container process and
recent wiki-activity checks could not be established. Per assignment item 6,
the review continued read-only and with host/static checks, without native runs.

### Review findings

No actionable production defect with a failing native reproducer can be
reported from this environment. The following are concrete **evidence gaps**,
not demonstrated runtime defects; they remain pending rather than being hidden
behind the earlier lead totals:

1. `LegacyPdfSelectionTest.php:91` and `:170` check grouped and retained-split
   redirect URLs but do not follow those identities into `prepareCurrentEditor()`.
   Add one grouped page-two and one evidence-backed split-page journey, comparing
   surface ID, actual current owner revision, selected source page, complete
   layer properties and source pin with the stored selected member. The sibling
   page's distinct payload must not be returned.
2. `LegacyPdfSelectionTest.php:248` hashes full selected table rows but supplies
   no deterministic ordering and does not capture actual main/layers content.
   Its no-write assertion currently covers the image action only (`:233`).
   `FileSurfaceSelectionProjectionTest.php:193` compares revision/slot counts
   and owner head rather than full bytes. After fixture/deferred updates finish,
   extend both to deterministic ordered row state, exact owner head and
   main/layers text, retained rows and completion state. Exercise grouped,
   evidence-backed alias, denied, missing and ambiguous reads. Include underlying
   stored content/blob bytes as appropriate so unchanged slot pointers cannot
   mask a same-count content mutation. Keep fixture writes outside the interval.
3. `LegacyPdfSelectionTest.php:197`/`:219` covers arbitrary ID, SHA, page, MIME
   and other-file refusal, but not an ID derived from a real retained row and a
   different owner. Add that case with otherwise matching retained file/kind/
   page/SHA metadata: it must not qualify under the requested owner. Preserve
   direct selection under a literal suffix name's actual name and the existing
   no-name/multiple-entry listing rule.

No test cases were added or modified under the packet's unavailable-engine
fallback. Their native behavior, additional full-byte assertions and required
controls remain unverified. The lead's earlier native results were not rerun
or represented as this review's results.

### Inspected boundaries

The action obtains the listing revision and passes that same ID into the exact
selector. Effective-page normalization/clamping stays in the action, with images
restricted to page one. The selector restricts candidates to the File owner,
canonical file and internal page, then tests normalized exact-name uniqueness
before the legacy alias path. Empty-name requests still require one entry in
the entire authorized list; they do not consolidate a multi-page group.

The old alias path refuses multiple candidates before consulting evidence and
requires both `retained-row-match` and a normalized retained original-name match.
The audit derives IDs from each retained row plus this owner and separately
checks canonical file, kind, page, SHA and local repository. A literal suffix or
matching SHA alone does not establish origin. Audit evidence remains unsealed
retained metadata, not proof of untouched payloads or write eligibility.

`getFileSurfaceSelections()` uses the same exact authorized reader and empty
source-rendition request as history listing. Its projection adds stored file
title/page only; it does not return layer payloads or pins or resolve media.
The prior `getHistorySurfaces()` projection and ordered full-list behavior are
unchanged. `PageHistoryAccess` checks owner, revision, visibility and readable
content without latest substitution. `prepareCurrentEditor()` separately
resolves the current head and enters existing editor admission. The redirect
journeys still need runtime proof that these boundaries compose correctly.

### Negative controls and restoration status

**Neither required negative control was attempted.** There are no newly observed
control failures, passing restoration runs or restored-control evidence to
claim. Production code was never temporarily modified during this review.

When the existing engine is available and a fresh idle preflight passes, the
remaining control work is:

- Temporarily bypass only the retained-name/evidence guard in
  `FilePageDrawings::select()`. Run the literal-suffix and unproven-ID refusal
  cases; require failures, restore the exact original bytes and rerun the same
  filter successfully before proceeding.
- Temporarily omit only the candidate source-page condition. Run exact grouped
  page selection; require failure, restore the original bytes and rerun the
  affected filter. Do not weaken duplicate or missing-page assertions.
- Then run the complete eight-class native filter printed in the assignment,
  without dropping any class. Host/static success cannot replace that gate.

Initial and final production fingerprints from this command were identical:

```sh
git hash-object src/Migration/FilePageDrawings.php \
  src/Action/EditLayersAction.php src/Revision/PageOwnedPilot.php
```

In that order, the fingerprints were:

```text
74cfe1f5b6e1b496a9ff37ca67b5fdcacded8886
616c8b54ee3342eb6a9e9543e0282d082ba8905d
03b9283e2d804109741b0aeb29294c88129d37b9
```

This confirms production preservation, not negative-control restoration.

### Available verification

Host gates were run serially:

- `php.exe vendor/bin/phpunit -c phpunit.xml`: **1,486 tests / 3,662 assertions
  / 1 existing skip**, no failures. PHPUnit 9.6.36 reports the inherited missing
  coverage-driver warning; no new coverage measurement is claimed.
- The exact assigned five-file `php.exe vendor/bin/phpcs -sp` command: passed,
  zero errors/warnings.
- `node.exe scripts/check-php-class-refs.js`: passed, **126 files/classes**.
- `node.exe scripts/check-parallel-lists.js`: passed.
- `node.exe scripts/check-atomicity.js`: passed.
- `node.exe scripts/verify-docs.js`: passed after the report append, **84
  maintained/policy documents / 53 historical records**, mirrors/references and
  source checks agree.
- `git diff --check`: passed after the report append.
- Editor diagnostics for the three production and two allowed test files:
  no errors.
- Packet diagnostics: three inherited MD013 warnings in the assignment's command
  block are preserved; the new report's line-length warning was corrected.

The only workspace edit by this review is this appended report. Production,
both test files, shared fixtures and unrelated prior work were preserved. No
ordinary wiki page, migration/audit/tidy/undo/cleanup command, browser workflow,
configuration change, Default/output activation, commit or push was performed.

Return to the lead with the native environment blocker and remaining evidence
work explicit. No broader HIST-4/HIST-8 or Layers 2.0 completion is claimed.

## Lead response to external review — October 4, 2026

The read-only review is received and its scope/limitations are accepted. It
demonstrates no production defect, but does not complete the junior assignment
or supply new native evidence. All three evidence gaps and both negative
controls remain assigned under the existing packet. The earlier **191 / 2,357**
lead native result remains valid historical evidence for that tree; it cannot
stand in for the missing external journeys, ordered full-byte comparisons or
restoration runs. The junior's **1,486 / 3,662 / 1 existing skip** standalone and
host gates remain attributed to the junior.

Resume after the existing engine is available and a fresh idle preflight passes.
No new production change, configuration change or alternate environment is
authorized by this status update. The
[team update](TEAM_STATUS_2026-10-04.md) records preservation and the remaining
testing milestones. This remains bounded local implementation with incomplete
independent runtime evidence; no final J113E or charter completion is declared.

### Environment restored and baseline rerun — later October 4

The lead restarted the existing installed test engine, verified idle native
preflight and reran the complete compatibility/pilot gate: **191 tests / 2,357
assertions**, passed. Fresh standalone **1,486 / 3,662 / 1 existing skip**, full
JavaScript/static **15,190 / 208 suites** and repository PHP syntax/style gates
also pass. No source/test behavior changed in this continuation. This removes
the environment blocker; it does not complete the three independent evidence
gaps or either negative control. Resume the assignment above and return the
additional evidence separately for lead review. No new browser/wiki write or
final J113E acceptance is claimed.
