# J113D — grouped PDF compatibility lookup

**Date:** October 3, 2026. **Advances:** HIST-4/HIST-8 and DATA-1.
**Status:** implemented by the external junior and accepted by the lead on
October 4, 2026, for the bounded parser compatibility scope. The assignment and
junior evidence below are retained; the lead acceptance is appended at the end.

Implement group-aware counting in the two existing parser compatibility helpers.
A PDF layer set has one name across its pages. Those pages must not make one
matching name appear ambiguous. Keep the current compatibility precedence and
the native exact-page routing already accepted in J112B.

Read the [charter](PROJECT_CHARTER.md), especially **Read this first**, the
[approved brief](LAYER_SET_BEHAVIOUR_BRIEF.md), sections 7 and 9, and the active
[handoff](IMPLEMENTATION_HANDOFF_PLAN.md). Work from the current uncommitted tree;
do not reconstruct the task from HEAD or discard unrelated work.

## Allowed scope

- `src/Hooks/BoundSlideHooks.php`: only `drawingOfFileNamed()`, `onlyDrawingOf()`
  and a small private helper if useful. Update their comments to describe layer
  sets accurately; keep existing method names and signatures.
- New `tests/phpunit/core/GroupedPdfCompatibilityTest.php` and necessary focused
  additions to `tests/phpunit/core/BareNamesAfterMigrationTest.php` or
  `tests/phpunit/core/PdfPageRoutingTest.php`.
- Append your implementation report to this packet.

The lead retains migration writers, allocation/resume, Default semantics,
`FilePageDrawings`, the legacy action's selection projection, template/gallery
metadata changes, numbered-alias editor parity, output activation and tidy/undo.
Do not change those paths, service wiring, messages, UI or configuration.

## Exact contract

### Named compatibility lookup

`BoundSlideHooks::drawingOfFileNamed()` currently filters by canonical source
file. It returns an exact normalized label if one exists. Otherwise, it accepts
one matching numeric-suffix label, such as `ABC 2` for requested `ABC`; more than
one candidate leaves the requested name unchanged. Retain that precedence.

Count **distinct normalized labels**, using `DrawingName::key()`, rather than
member surfaces. Keep the first stored spelling as the return value for each
normalized label; do not rewrite labels or manufacture a normalized display name.

- `ABC 2` on PDF pages 1 and 2 is one numbered candidate.
- `ABC 2` and `ABC 3` are two candidates, even when only one has the selected page.
- An exact `ABC` group wins over numbered alternatives. If its selected page is
  missing, resolution remains unavailable; do not select a numbered alternative.
- Names on other canonical files, or on slides, do not participate.
- Preserve the existing numeric-suffix pattern exactly. Do not add suffix
  stripping, recognize new numbering formats or add a `(page N)` fallback.

### Transitional single-set lookup

`BoundSlideHooks::onlyDrawingOf()` must count distinct normalized labels within
the requested canonical file. A single PDF layer set spanning several pages
counts once. Return its first stored spelling, or null for none/multiple names.
Do not count other files or slides. Do not choose the first surface of several
different names.

This helper still supplies the **existing transitional** interpretation of
show intent (`on` and unnamed galleries). This assignment does not activate or
replace the owner's approved final `on` → `Default` rule. That coordinated
transition remains open, including preservation of what old embeds showed.

### Exact page and revision boundaries

Do not add a page argument to either helper or filter candidate names by page.
That would change existing file-wide ambiguity precedence. The rendering path
already routes the native transformed PDF page through `BoundFileHooks` and
`PageOwnedBinding::resolveNamed()`. Keep that path unchanged: selection must
return the requested page's own stored surface, or no binding when unavailable.

Preserve `VARY_REVISION`, exact parser-revision reads, existing unavailable
handling, return types and behavior outside the grouped-label correction.
Do not consult the latest revision, legacy SQL, J113C evidence, or a different
file to resolve a parser name. Nothing in this assignment changes stored data.

## Required regression evidence

Use native MediaWiki fixtures with distinct page payloads. Check actual parsed
bindings and their selected surfaces/payloads, not only helper return strings.

1. A two-page PDF group named `ABC 2`, embedded with bare `ABC`, resolves each
   page to its own surface and complete payload. It must fail before the fix.
2. Exact `ABC` takes precedence over `ABC 2`. A missing page of the exact group
   stays unbound even if the numbered group has that page. Duplicate matches for
   the selected page remain ambiguous; never take a first match.
3. `ABC 2` and `ABC 3` remain ambiguous even when only one has the selected page.
4. A single group spanning several pages works through transitional `on`; two
   names remain ambiguous. The multi-page single-group case must fail before the
   fix. Explicitly record that this is not final Default acceptance.
5. Another file's equal name, and an equal slide name, do not affect selection.
   Include normalized-equivalent spelling in a historical snapshot; do not
   silently merge distinct labels or alter existing publication validation.
6. Parsing an old revision preserves its historical selection after the current
   revision changes. Preserve unreadable/missing-revision handling and revision
   variation behavior.
7. Exercise a native page alias/repeated valid option, an invalid option after a
   valid one, page-count clamping, and at least one gallery occurrence. Compare
   the page core rendered with the binding/payload selected, using the established
   J112B test patterns. Never invent a stored page to satisfy an embed.

Demonstrate two separate before-fix failures (numbered fallback and single-set
lookup). A temporary negative control that restores surface counting is also
acceptable if necessary; restore it fully and rerun its filter. Do not weaken
ambiguous/missing-page expectations to make the new group case pass.

## Verification

Before native tests, inspect host test/browser processes, container processes and
recent wiki activity. Run native tests serially, using isolated core tables only.
Do not overlap a native run with browser acceptance or ordinary wiki maintenance.

```sh
php vendor/bin/phpunit -c phpunit.xml
php vendor/bin/phpcs -sp src/Hooks/BoundSlideHooks.php \
  tests/phpunit/core/GroupedPdfCompatibilityTest.php \
  tests/phpunit/core/BareNamesAfterMigrationTest.php tests/phpunit/core/PdfPageRoutingTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml \
  --filter 'GroupedPdfCompatibilityTest|BoundSlideHooksTest|LegacyEntryPointsAfterMigrationTest|FileMigrationAuditTest|RetainedMigrationRowsTest|PageCopyMigrationPdfPageTest|PageCopyMigrationTest|FilePageMigrationTest|SlidePageMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|PdfPageRoutingTest|ScopedCreationCopyTest|DirectEmbeddingRewriterTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

If a required check fails outside this scope, identify the exact assertion and
reason. Do not delete it or silently reduce the required filter. The lead has
already aligned the stale `has no drawings` assertion in
`LegacyEntryPointsAfterMigrationTest` with approved `has no layer sets` wording;
preserve that correction. No JavaScript or browser change is assigned.

## Return report

Append changed paths, before/after evidence, exact commands/results, concurrency
preflight, preserved boundaries and remaining limitations. Report any discovered
parser/editor difference without changing editor selection in this packet.
State whether both active helpers now meet the contract, and return for lead
review. Do not claim migration, Default, editor parity or HIST-8/HIST-9 complete.

Do not run migration/tidy/undo/cleanup commands, alter ordinary wiki content or
configuration, activate bare output, commit or push. Native fixture publications
in isolated test tables are permitted. Preserve the current worktree throughout.

## Lead integration notes

The delegated reader audit found that `FilePageDrawings::current()` receives only
id/label/kind, so it cannot establish canonical file or PDF page. The lead will
add an authorized internal selection projection without changing history-list
output or removing current File-page listing entries. Exact-page selection and
the established synthetic PDF-label fallback must be reconciled with retained
evidence; a literal name such as `Notes (page 2)` proves no origin.

The parser's numbered fallback is also absent from the current bound-editor
selection path. This packet fixes parser counting only; that compatibility and
the approved Default transition remain explicit lead integration requirements.

**Lead baseline:** before this assignment, the native filter
`LegacyEntryPointsAfterMigrationTest|BareNamesAfterMigrationTest|BoundSlideHooksTest|PdfPageRoutingTest`
passed **31 tests / 422 assertions** after the one stale terminology assertion
was corrected. Log: `tmp/j113d-reader-baseline.log`. This baseline does not cover
the new grouped-label regressions; demonstrate those before implementing the fix.

## Implementation return - October 3, 2026

**Disposition:** both active compatibility helpers now meet the grouped-label
contract. No unresolved blocker was found within this packet. Returned for lead
review, not lead acceptance or completion of HIST-8/HIST-9. This implementation
advances HIST-4/HIST-8 and DATA-1 without changing stored layer sets.

### Changed paths

- `src/Hooks/BoundSlideHooks.php`: changes are confined to
  `drawingOfFileNamed()`, `onlyDrawingOf()` and their comments. Both count
  distinct `DrawingName::key()` values within the canonical file, excluding
  slides, and retain the first stored spelling. The named lookup keeps exact
  normalized-name precedence and the original numeric-suffix expression.
  First spelling is also retained when the suffix-bearing equivalent occurs
  after another historical spelling. No private helper was needed.
- `tests/phpunit/core/GroupedPdfCompatibilityTest.php`: new native regressions
  compare core-rendered PDF pages, actual binding/revision identities and the
  complete selected surface, including layers, canvas, reading order and pins.
  Parsed output must contain identities only, not private payload text.
- This appended report in `docs/J113D_GROUPED_PDF_READ_PACKET.md`.

`BareNamesAfterMigrationTest.php` and `PdfPageRoutingTest.php` were checked but
not edited. Existing exact-page plumbing in `BoundSlideHooks::named()` and the
lead's corrected legacy-entry-point terminology expectation were preserved.
All unrelated current work, including the accepted J113C packet, is unchanged.

### Required before/after evidence

Before either production helper was edited, the focused native run reported
**3 tests / 10 assertions / 2 failures**. The two failures were separate:

1. `testNumberedGroupResolvesEachPageAndCompletePayload`: a two-page `ABC 2`
   group embedded as bare `ABC` had no binding where its page-one identity was
   expected. Core rendered pages one and two correctly.
2. `testTransitionalOnCountsOneGroupAcrossPages`: the same multi-page shape
   embedded with transitional `on` also had no binding instead of its own
   page-one identity. This demonstrates the independent single-set count bug.

Immediately after the helper correction, the same filter passed **3 tests /
34 assertions**, including each page's binding and full payload. No temporary
production negative control was needed. With the remaining regressions added,
the final focused run passed **13 tests / 360 assertions**, no failures, errors
or skips. Native totals include the inherited core coverage-annotation check.

The expanded suite verifies:

- Exact `ABC` wins even when numbered alternatives precede it; an absent page
  of the exact group remains unbound despite that numbered page being present.
- `ABC 2` and `ABC 3` remain file-wide ambiguous for bare `ABC` and `on`, even
  when only one group contains the requested page.
- Duplicate historical records on the selected page remain ambiguous; a unique
  sibling page still selects its own complete payload, never the first record.
- Historical case/underscore-equivalent labels count once and retain their
  first stored spelling, including an underscore-first example. Distinct labels
  are not collapsed, and no stored spelling is rewritten.
- Equal names on another canonical PDF and on a slide do not participate.
  Each file independently supplies its own binding/payload.
- Old revision selection/payload remains historical after the current groups
  change. Missing slots, unreadable content and nonexistent revisions never use
  the current group instead.
- Native space aliases, repeated valid options, an invalid option after a valid
  option, page-count clamping, a named gallery and an unnamed transitional
  gallery select the same pages core rendered. No missing surface is invented.
- The suffix expression has not expanded: `(page N)`, underscore-only numbering,
  joined numbers and alphanumeric suffixes alone do not supply bare fallback.

### Fixture corrections and preserved variation

Initial expanded test runs exposed fixture assumptions, not further production
defects. Native `Parser::parse()` clears its revision state after parsing, so
supplemental helper-spelling assertions now use a test-only in-parse tag. Core
refused an attempted unreadable-content insertion; that fixture was replaced
with the native exact-revision callback, without storing invalid content or
changing publication validation. Readable historical duplicates/equivalences
use isolated native revision rows and do not change `page_latest`.

The first expanded run reported **13 tests / 208 assertions / 4 errors /
2 failures**; the invalid insertion also produced transaction/teardown notices.
The next run reported **13 tests / 339 assertions / 2 failures**, identifying
map ordering and a revision-variation assumption. The final **13 / 360** run
and full compatibility gate have no such errors or notices.

Binding maps are compared with sorted keys because gallery registration order
need not match DOM occurrence order; individual occurrence identities, revisions
and payloads remain strict. The existing missing-revision path returns before
the compatibility helpers when there is no owner PageID, so its ordinary parse
has a false `VARY_REVISION` flag. That behavior is preserved, not changed here.
Active helpers, including missing/unreadable-content probes, set revision
variation; existing slot-less owner parsing and historical bindings retain it.
No ambiguity or missing-page expectation was relaxed.

### Verification commands and results

The focused command, before and after production changes, was:

```sh
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
  -w /var/www/html/extensions/Layers mediawiki-145 \
  php vendor/bin/phpunit -c tests/phpunit/core.xml \
  --filter GroupedPdfCompatibilityTest
```

The final native run used the complete, unchanged fourteen-class `--filter`
command in the assignment above, with `MSYS_NO_PATHCONV=1` for Git Bash:
**136 tests / 1,832 assertions**, no failures, errors or skips. Native runtime
was PHP 8.3.31 / PHPUnit 9.6.36 in the existing MediaWiki 1.45 test environment.
No assigned class or assertion was removed from the gate.

- `php.exe vendor/bin/phpunit -c phpunit.xml`: **1,486 tests / 3,662 assertions**,
  no failures, one existing skip. The command warns that no coverage driver is
  available; no fresh coverage measurement is claimed.
- The assigned four-file `php.exe vendor/bin/phpcs -sp` command: zero errors
  and warnings. New-file newline/line-length formatting was corrected before
  the first failing native run; no unrelated formatting was performed.
- `node.exe scripts/check-php-class-refs.js`: passed, **126 files/classes**.
- `node.exe scripts/check-parallel-lists.js`: passed.
- `node.exe scripts/check-atomicity.js`: passed.
- `node.exe scripts/verify-docs.js`: passed after this report was appended.
- `git diff --check`: passed.
- Editor diagnostics for all four scoped PHP files: no errors.

Host PHP/Node/Docker test and automated-browser processes were inspected with
`Get-CimInstance Win32_Process`; container processes with
`docker top mediawiki-145 -eo pid,etime,args`; recent wiki activity with
`docker logs --since 10m --tail 30 mediawiki-145`. Checks before the first native
run and a fresh preflight before the complete gate found no competing suite,
browser acceptance or ordinary wiki maintenance. Persistent agent/log readers
were not test activity. Native runs were serial and used isolated core tables
and randomly named uploaded assets. Parallel standalone/static checks did not
use those tables. No browser or ordinary-wiki maintenance workflow was run.

### Boundaries and remaining limitations

Helper names/signatures, file-wide precedence, exact-page selection, exact
parser-revision reads, unavailable handling and revision-variation mechanisms
are retained. Neither helper takes a page argument or reads latest content,
legacy SQL, J113C evidence or another file to resolve a name. No migration-writer
output, stored name, payload, pin, message, UI, service wiring or production
configuration was changed by this assignment.

Transitional `on` and unnamed-gallery tests are explicitly **not final Default
acceptance**. The lead's recorded parser/editor difference remains: numbered
fallback is absent from bound-editor selection. That path was not changed or
independently certified here; no editor parity claim is made. Legacy entry-point
selection, allocation/resume, template/gallery migration metadata, Default,
writer output activation and tidy/undo remain lead-owned.

No ordinary wiki content/configuration change, migration/tidy/undo/cleanup
maintenance command, output activation, commit or push was performed. Existing
native migration tests ran only as the assigned isolated compatibility gate.
Return to the lead for review; no migration or charter completion is claimed.

## Lead acceptance — October 4, 2026

Accepted for the two parser compatibility helpers. The lead reviewed the
distinct normalized-name counting, first stored spelling, file-wide exact-name
precedence and unchanged suffix pattern. The native tests check actual parsed
bindings against complete selected viewer payloads and source pages. No required
production correction was found. The junior's two before-fix failures remain
their evidence; the lead did not repeat those controls.

Fresh lead focused integration passes **43 native tests / 519 assertions**,
including `GroupedPdfCompatibilityTest`, both J113E classes and the unchanged
legacy entry-point class. The complete required J113D gate plus the new classes
and `PageOwnedPilotTest` passes **191 / 2,357**, no failures/errors/skips. Full
standalone passes **1,486 / 3,662 / 1 existing skip**. PHP style, class references,
parallel lists, atomic-section, documentation/mirror and diff checks pass. Logs:
`tmp/J113E-focused-final.log`, `tmp/J113DE-native-gate.log` and
`tmp/J113E-standalone.log`. Native runs used isolated core tables serially, with
no overlapping browser or ordinary wiki maintenance. On October 4 the finished
gate log was read back; the test engine was then unavailable, so no additional
native run is claimed.

The dependent legacy File-page selector is now implemented separately in
[J113E](J113E_LEGACY_PDF_SELECTION_PACKET.md). It uses exact file/page metadata
and bounded retained-row evidence for older split-name compatibility; J113D's
parser helpers still do not query legacy SQL or read latest content. An internal
review of J113E found no remaining issue after the lead corrected duplicate-alias
refusal and an invalid fixture; external review is ready to dispatch.

Transitional `on` remains transitional. Numbered-alias bound-editor parity,
whole-set migration allocation/resume, Default/show-intent, template/gallery
page metadata, output activation and owner-reviewed tidy/undo remain open. No
ordinary wiki/configuration change, migration command, browser write, Default
activation, commit or push occurred. This acceptance advances HIST-4/HIST-8 and
DATA-1 within the documented read-selection scope; it does not complete them.
