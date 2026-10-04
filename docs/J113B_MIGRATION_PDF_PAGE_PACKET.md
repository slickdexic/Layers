# J113B: preserve the effective PDF page during direct-embed migration

**Status: implemented and accepted for the bounded correction — October 3, 2026.**
Lead and independent code review found no blocker. Fresh lead verification
passed the complete required native group and standalone suite. The production
migration factory now supplies the existing native effective-page calculation;
no migration command or ordinary wiki write occurred. The original assignment
and junior evidence remain below.

The delegated audit identified the source-page mismatch and prepared this draft.
The lead checked the production factory, existing native callback, constructor
call sites, PdfHandler parameter rules and accepted native page-option tests
before issuing it. The implementation return and lead acceptance below supersede
the earlier assignment status.

**Advances:** HIST-8 (migration preserves the layer content the page shows), with
exact-page preservation under HIST-4. This does not complete either criterion or
activate J113A's bare-name output.

## Read first

Read [AGENTS.md](../AGENTS.md), the charter's
[Read this first](PROJECT_CHARTER.md#read-this-first-the-rules-for-everyone), the
[approved behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md), the active
[handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md), the accepted page-routing evidence
in [J112B](J112B_PDF_PAGE_ROUTING_PACKET.md), and the
[J113A packet](J113A_BARE_NAME_OUTPUT_PACKET.md).

Work from the actual current tree in
`F:\Docker\mediawiki\extensions\Layers`, including accepted uncommitted J112,
J113A and the lead's terminology-fixture corrections. Checkpoint `364fb385` alone
is insufficient. Preserve unrelated edits; do not reset, stash or replace them.

The identity model is settled: owning wiki page, canonical file and layer-set
name identify a file's layer set. PDF pages are internal parts of that set and
share its name. This task corrects which part supplies migrated content. It does
not create a PDF-page naming rule.

## Problem and deliverable

`PageCopyMigration::plan()` currently takes the first raw option named `page`,
casts it to an integer, and passes it to `fileSource()`. That differs from the
native page selection already used by the accepted editor and copy paths.
Examples include `page 2`, German `seite=2`, repeated page options, and a caption
such as `page =2`. The result can be a copy of another stored PDF page or a
failure to find the page that is actually displayed.

Wire the existing native effective-page calculation into the active direct-file
branch of migration step 2. Prove that the planned and committed surface comes
from the exact effective page of that file. This is an active correction to
`PageOwnedPilot::newPageCopyMigration()`, not a new dormant helper or feature
flag. No migration command or ordinary wiki-content write is authorized by this
assignment.

For example, `page=1|page=2` on a two-page PDF currently asks migration for page
1 even though MediaWiki displays page 2. Correcting that lookup must preserve
the selected page's complete source and layer payload; a matching layer-set
name alone cannot demonstrate the correct result.

## Allowed files and integration contract

Change only:

- `src/Migration/PageCopyMigration.php`
- `src/Revision/PageOwnedPilot.php`, limited to `newPageCopyMigration()` wiring
- New `tests/phpunit/core/PageCopyMigrationPdfPageTest.php`
- This packet, only to append the junior report and verification evidence

Use the existing `LegacyMigrationFixtures` trait without changing it. If a test
needs a small extra fixture helper, put it in the new test class. Existing test
assets include `tests/fixtures/assets/test-multipage.pdf`, a two-page PDF.

Append an optional `?callable $sourcePages = null` constructor dependency to
`PageCopyMigration`, preserving existing parameter order and callers that omit
it. Its contract is `(array $candidate): int`, with the complete scanner
candidate including canonical file target and ordered options. The production
factory must supply:

```php
fn ( array $candidate ): int => $this->effectiveSourcePage( $candidate )
```

Invoke this dependency only for a direct file candidate. Feed its returned page
to the existing `fileSource()` lookup. Keep the old extraction only as the
compatibility path for a directly constructed object that omits the dependency;
do not silently route the production factory through that path. Document this
constructor compatibility limit in the report. Do not make
`effectiveSourcePage()` public or change its accepted behavior.

The relevant existing paths are:

| Path | Existing responsibility |
| --- | --- |
| `src/Revision/PageOwnedPilot.php`, `effectiveSourcePage()` | Uses the wiki's `getMagicWordFactory()->newArray( [ 'img_page' ] )` and `matchVariableStartToEnd()`, resolves the candidate's own file, treats a non-PDF as page 1 and applies the known multipage file's page-count bound. |
| `src/Revision/PageOwnedBindingOptions.php`, `sourcePage()` | Reads options in order; defaults to page 1; accepts canonical positive integers; ignores malformed values; the last valid option wins. |
| `src/Revision/PageOwnedPilot.php`, `newDrawingCopy()` | Already injects the same effective-page callback into the accepted interactive copy path. Follow this integration pattern. |
| `src/Migration/PageCopyMigration.php`, `fileSource()` | Resolves the legacy set for that file/version/page, then locates its exact deterministic migration surface ID in the file-page document or pending step-1 document. Preserve this exact-source lookup. |
| `tests/phpunit/core/PdfPageRoutingTest.php` | Existing native parser proof for duplicate/invalid options, English and German aliases, captions and out-of-range page handling. Use its assertions as a reference, not as a replacement for migration tests. |
| `F:\Docker\mediawiki\extensions\PdfHandler\includes\PdfHandler.php` | Read-only native dependency: `getParamMap()` maps `img_page` to `page`; `validateParam()` rejects noncanonical integers and nonpositive values. The parser's effective page and transform output remain the integration oracle. Do not edit PdfHandler. |

Use the native factory and MediaWiki services in the new tests. A test-only
callback that always returns the desired page does not prove the production
wiring. Do not introduce another English-only option parser, independently
hard-code localized aliases, or choose a page by the order of stored surfaces.

## Required preservation

1. Preserve all page-option bytes, captions, layout options and surrounding
   wikitext under the current rewriter policy. Only source-page selection changes
   in this packet. J113A's output option remains omitted by migration.
2. Keep migration name allocation, existing numbered/PDF-suffixed compatibility,
   source pins, layer JSON, canvas data, deterministic IDs, summaries and tags
   unchanged. Do not replace expected names simply to align tests with the
   eventual J113 naming transition.
3. Use each candidate's own canonical file when determining its page count.
   Do not reuse another file's page or metadata because names or options match.
   Ordinary images remain page 1 even if they contain a page-looking option.
4. Distinguish native effective-page clamping from substituting a stored layer
   surface. A two-page PDF with a valid request above its range follows the
   native effective page. A valid effective page with no corresponding shared
   set or migrated source surface must never borrow another stored page's
   layers. Preserve existing `no-current-set` / `file-not-migrated` reporting as
   applicable, without a new visible message.
5. Keep dry-run planning read-only, exact-base publication and rerun idempotence.
   A stale destination plan must still refuse without a partial write. This
   packet does not change existing source-revision admission or retry policy.
6. Do not alter slides, selector interpretation, pinned-revision skips, explicit
   bindings, foreign-file behavior, reader resolution, creation or adoption.

## Required native regression matrix

Construct a PDF whose page 1 and page 2 have visibly distinct layer text under
the same legacy set name. Use the actual step-1 migration and step-2 factory.
Assert selected legacy row ID, deterministic destination surface ID,
`source.fileTitle`, `source.page`, exact layer payload and source-version pin;
checking the count or allocated label alone is insufficient.

| Case | Required evidence |
| --- | --- |
| Default and ordinary options | No page option selects page 1; `page=1` and `page=2` select their exact pages. |
| Native aliases | English `page 2`, German `seite 2` and `seite=2` select page 2 using the real content-language matcher. |
| Caption boundary | English `page =2` remains a caption and selects page 1. Its bytes remain in the resulting embed. |
| Ordering | `page=1|page=2` selects 2; the reverse selects 1; `page=2|page 1` selects 1. A later invalid value does not erase an earlier valid value. |
| Invalid values | Cover `page=02`, `page=0`, `page=-1`, `page=2x`, `page=oops` and an empty page value. With no prior valid value they select the native default. Also cover valid surrounding value whitespace such as `page= 2 `. |
| Out of range | A valid page 3 or a larger canonical positive integer on the two-page PDF follows its native effective page, not a nonexistent page 3 row. Avoid architecture-dependent overflow values. |
| File-specific handling | In the same main text, interleave this PDF and an ordinary image with matching set names and page-looking options. The image uses page 1 and each file supplies only its own payload. |
| Missing legacy page | Store the set only on page 2, request effective page 1, and assert that page 2 is not copied or substituted. Cover the converse as well. |
| Missing migrated page | Keep both legacy page rows but supply a pending step-1 document containing only the other page. Assert `file-not-migrated`, no selected copy and no rewrite of that occurrence. |
| Multiple occurrences | Repeated identical embeds and different aliases selecting the same page produce the existing single copy per exact source row. Embeds selecting different pages keep their distinct source content; unrelated embeds and byte offsets remain correct. |
| Dry run, commit and resume | A pending step-1 document selects the same source as committed step 1; planning leaves revisions and legacy rows unchanged; commit stores the expected source; a rerun creates no duplicate. |
| Stale base | Change the destination after planning; commit still raises the existing conflict and preserves the newer revision. |

For representative English, localized and out-of-range cases, compare the
native parser's rendered thumbnail page with the selected migration source page
in the same fixture. Existing J112B tests are evidence for the expected native
behavior, but the new tests must exercise migration through its production
factory. Do not substitute an assertion about a private helper for this proof.

Demonstrate the original wrong-page failure before applying the fix, preferably
with the English space alias and repeated-option cases. Record the actual
expected-versus-observed page/payload failure. A syntax error, missing fixture,
unrelated summary mismatch or skipped test does not count. Then apply the fix
and rerun the same tests. If evidence requires temporarily restoring the old
selection expression, confine that mutation to this change, restore it
immediately, and rerun the focused suite. Never overlap mutation verification
with any other test or browser run.

## Coupled work that stays with the lead

`ShownLayerSets` stores only kind, file/slide name and set name; it does not store
a PDF page number. `PageCopyMigration` currently passes page 1 for entries known
only through those page properties. Do not invent a page for template/gallery
occurrences, change this metadata format or claim those paths are fixed by the
direct-embed correction. Report the limitation explicitly. The lead must handle
it together with whole-set migration and rendered-content preservation.

The lead also retains the coordinated work on `FilePageMigration` and
`PageCopyMigration` group allocation/resume, existing-record provenance,
`FilePageDrawings` compatibility, `MigrationState`, Default/show-intent reader
semantics, author-facing output activation, tidy planning, the maintenance
driver and undo. Do not remove suffix-based compatibility, rename stored data,
enable bare output, add a completion record or run a migration to make this
packet pass. If the scoped correction exposes a dependency on any of these,
provide the concrete failing case and return it for lead integration review.

## Verification and scheduling

This assignment authorizes native tests in the existing isolated core test
tables. Verify that no native suite, browser acceptance or migration command is
active before starting, and run all native checks serially. If the environment
is occupied, continue independent implementation work and report the needed
test window; do not start a competing run. Docker is test infrastructure only.

Run from `F:\Docker\mediawiki\extensions\Layers`:

```powershell
php vendor/bin/phpunit --no-coverage -c phpunit.xml
php vendor/bin/phpcs -sp src/Migration/PageCopyMigration.php src/Revision/PageOwnedPilot.php tests/phpunit/core/PageCopyMigrationPdfPageTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter PageCopyMigrationPdfPageTest
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter 'PageCopyMigrationPdfPageTest|PageCopyMigrationTest|FilePageMigrationTest|SlidePageMigrationTest|MigrationUndoTest|BareNamesAfterMigrationTest|PdfPageRoutingTest|ScopedCreationCopyTest|DirectEmbeddingRewriterTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

Do not install or reconfigure a runtime. No JavaScript, UI or browser change is
in scope; no browser acceptance or full JavaScript rerun is required for this
PHP correction. Do not expand scope to repair unrelated test failures. Record
the exact failure and discuss it with the lead. The lead determines whether a
new failure or a necessary scope expansion requires broader native validation.

## Return report

Append a report here with changed files and constructor/factory wiring; the
native page cases and actual selected payloads; before-fix or mutation failure
evidence and restored passing result; test/assertion counts and skips; dry-run,
commit, rerun and stale-plan evidence; and all coupled-scope limitations.

Confirm that migration naming/output and reader compatibility remain unchanged,
that only isolated native fixtures were written, and that there were no ordinary
wiki-content writes, configuration changes, migration commands, commits or
pushes. Return for lead review; do not mark HIST-8/HIST-4 complete or begin the
larger migration transition.

## Junior implementation return - October 3, 2026

**Returned for lead review, not criterion completion or output activation.**
This bounded correction advances HIST-8 and exact-page preservation under
HIST-4. Accepted uncommitted J112/J113A work and the lead's three terminology
fixture corrections remain intact. No branch change, reset or stash occurred.

### Changed files and production flow

- `src/Migration/PageCopyMigration.php`: appends the final optional constructor
   dependency `?callable $sourcePages = null`, stores it, and calls it with the
   complete scanned candidate only in the direct-file branch. Its result reaches
   the unchanged `fileSource()` exact file/version/page and deterministic-ID
   lookup. The existing argument order is preserved.
- `src/Revision/PageOwnedPilot.php`: J113B changes only
   `newPageCopyMigration()`, supplying
   `fn ( array $candidate ): int => $this->effectiveSourcePage( $candidate )`.
   The existing private method, native matcher, positive-integer handling,
   candidate-specific file resolution and page-count bound are unchanged.
- `tests/phpunit/core/PageCopyMigrationPdfPageTest.php`: new native class using
   the unchanged `LegacyMigrationFixtures`, random upload names, actual step-1
   migration and production step-2 factory. Small fixture/assertion helpers live
   in this class only. No test substitutes a desired-page callback.
- This packet: appended this report only; the lead's assignment is unchanged.

Direct constructors omitting the callback retain the previous first-raw-page
extraction. That compatibility path is intentionally not corrected here; the
production factory always supplies native selection. The callback is not
invoked for slides or property-only sources. No new parser or public method was
introduced.

### Original failure and corrected evidence

Before either production edit, the new native regressions used English
`page 2` and `page=1|page=2`. Both first asserted an actual rendered page-2
thumbnail, then failed the full layer-array comparison: expected text
`PDF page two`, observed `PDF page one`, under the same `Notes` set name.
The run reported **3 tests / 19 assertions / 2 failures**, exit 1. These are
wrong-content failures, not syntax, summary, setup or skipped-test failures.

Immediately after wiring, both payload and exact legacy/destination-ID checks
passed. Later fixture assertions exposed canonical source-key ordering and an
incorrect assumption that legacy conversion supplied `readingOrder`. These
were repaired by matching canonical ordering and comparing the entire actual
step-1 surface, not by changing production conversion or dropping content
checks. The original two cases then passed **3 tests / 35 assertions**.
Their provider labels remain in the expanded
`testNativePageOptionsCopyExactSelectedPayload()` matrix.

The expanded 20-case native-option matrix passed **21 tests / 361 assertions**.
Every case compares the actual native rendered thumbnail with the migrated
page, exact row ID, deterministic destination ID, complete layer array,
canonical file title, timestamp/SHA pin, canvas and complete surface. It also
compares the entire rewritten embed, retaining explicit owner-prefixed output
and every other option/caption byte.

Cases cover default/explicit pages; English space and German space/equals
aliases; `page =2` as a caption; both duplicate-option orders; a later alias;
invalid-after-valid; leading zero, zero, negative, junk, noninteger and empty
values; surrounding value whitespace; and native clamping of pages 3 and 1000
to page 2. Page 1 always retains `PDF page one`; page 2 retains `PDF page two`.

The complete focused class passed **28 tests / 561 assertions**, without
failures, errors or skips. Its additional evidence is:

- Missing legacy pages in both directions return `no-current-set`, without a
   copy, rewrite or revision. Pending step-1 documents containing only the other
   page return `file-not-migrated` in both directions, also without substitution
   or writes. The pending documents are derived from actual step-1 plans.
- Interleaved PDF pages, repeated occurrences, an `Image:` filename alias and
   an ordinary image share `Notes`. Each selects its own exact payload/pin;
   the image stays on page 1 despite page-looking options. Three page-2 embeds,
   two image embeds and one page-1 embed produce three exact-row copies.
   Full-text comparison preserves layout/captions, surrounding offsets, the
   colon file link and the opaque `nowiki` embed.
- Pending and committed step-1 sources produce identical proposed document
   and main text. Planning leaves both page revisions and all legacy row fields
   unchanged. Commit stores the exact proposed slots, parent revision and
   migration tag/summary. Both migration steps resume without duplicates or a
   new revision; legacy rows remain unchanged.
- A planned page-2 copy becomes stale after a newer page-1 copy is committed.
   Its commit raises `layers-edit-conflict`; the newer revision, full main text,
   complete layers slot, source revision and legacy rows remain intact.

### Commands, runtimes and final gates

Local: **PHP 8.4.11, PHPUnit 9.6.36, Node 24.20.0**. Native:
**MediaWiki 1.45.3, PHP 8.3.31, PHPUnit 9.6.36**, existing `mediawiki-145`.
Git Bash uses `php.exe` to avoid the interactive winpty alias and
`MSYS_NO_PATHCONV=1` for Docker paths. The long native filter below is wrapped
for readability without changing its value.

```bash
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml
php.exe vendor/bin/phpcs -sp src/Migration/PageCopyMigration.php \
      src/Revision/PageOwnedPilot.php tests/phpunit/core/PageCopyMigrationPdfPageTest.php
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
      -w /var/www/html/extensions/Layers mediawiki-145 \
      php vendor/bin/phpunit -c tests/phpunit/core.xml --filter PageCopyMigrationPdfPageTest
native_filter='PageCopyMigrationPdfPageTest|PageCopyMigrationTest|'\
'FilePageMigrationTest|SlidePageMigrationTest|MigrationUndoTest|'\
'BareNamesAfterMigrationTest|PdfPageRoutingTest|ScopedCreationCopyTest|'\
'DirectEmbeddingRewriterTest'
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
      -w /var/www/html/extensions/Layers mediawiki-145 \
      php vendor/bin/phpunit -c tests/phpunit/core.xml --filter "$native_filter"
node.exe scripts/check-php-class-refs.js
node.exe scripts/check-parallel-lists.js
node.exe scripts/check-atomicity.js
node.exe scripts/verify-docs.js
git diff --check
```

- Full standalone: **1,486 tests / 3,662 assertions / 1 existing skip**, no
   failures/errors.
- Required native compatibility group, after all PHP edits: **90 tests /
   1,222 assertions**, no failures/errors/skips. Native runs were serial.
- Changed-file PHPCS: **3 files, zero errors/warnings**. Initial new-file
   newline and assertion/line-length diagnostics were corrected locally.
   PHPCBF normalized only the new class's line endings/final newline using
   `--sniffs=Generic.Files.LineEndings,PSR2.Files.EndFileNewline`.
- PHP references: **124 files / 124 extension classes**, passed. Parallel
   lists and atomicity: passed. Editor PHP diagnostics: none. Documentation:
   **81 maintained/policy documents / 53 historical records**, passed.
   Documentation and whitespace gates are repeated with this appended report.

Before native checks, read-only host `Get-CimInstance Win32_Process` queries
inspected PHP/Node/Docker commands and automated browser main processes.
`docker top mediawiki-145 -eo pid,etime,args` showed no competing native test
or migration process. Persistent generic browser-control runtimes were present,
but no automated browser main process or recent wiki activity was found;
`docker logs --since 5m --tail 30 mediawiki-145` was empty. These checks were
repeated before the required broader group. No browser or competing native
run overlapped this work. Local standalone/static checks do not use core tables.

### Preserved boundaries and return status

Migration allocation, numbered/PDF-suffixed labels, summaries/tags, IDs, source
pins, layer JSON and canvas data remain unchanged. Migration still omits
J113A's output argument. Reader compatibility, selector interpretation, pinned
revision skips, explicit bindings, slides, foreign-file handling, creation and
adoption are unchanged; the required compatibility group passes with the
accepted rewriter and lead-corrected fixtures intact.

**Property-only template/gallery sources are not fixed:** `ShownLayerSets`
has no PDF-page metadata and those sources still use page 1. Whole-set group
allocation/resume, provenance, suffix compatibility, Default/show-intent
semantics, migration completion, output activation, tidy planning, the
maintenance driver and undo transition remain lead-owned. This introduces no
stop-gap or new fallback; it uses the assigned compatibility boundary.

Only isolated native fixtures and their standard test uploads/publications were
written. No ordinary wiki-content write, configuration change, migration
command, completion record, cleanup command, browser acceptance, commit or push
occurred. No full-native/full-JavaScript or MediaWiki 1.44 acceptance is claimed.
All assigned automated gates pass; this returns the bounded patch for lead
review, not HIST-8/HIST-4 completion or permission to begin the larger transition.

## Lead acceptance — October 3, 2026

**Accepted without further code changes.** The lead reviewed the constructor
addition, factory wiring and complete native test class. A delegated independent
reviewer also found no blocking defect. The callback receives the full scanned
file candidate; the existing exact file/version/page and deterministic source-ID
lookup remains intact. Slides and property-only references keep their previous
paths. The optional constructor fallback preserves earlier direct construction;
the production factory always supplies native selection.

The tests compare real native thumbnail selection with the exact legacy row and
complete migrated surface, including layer payload, source pin, canvas and
rewritten main text. They also cover missing pages without substitution,
interleaved files, pending/committed source equivalence, idempotent reruns and
preservation of newer main/layers content after a stale plan. The junior's two
before-fix wrong-payload failures remain their recorded evidence; neither lead
review repeated a temporary mutation.

Fresh lead verification on the returned tree:

- Complete required native group: **90 tests / 1,222 assertions**, no failures,
  errors or skips, MediaWiki 1.45.3 / PHP 8.3.31. Host test/browser process checks,
  container process inspection and recent wiki activity checks confirmed an idle
  native window; the run used isolated core tables and did not overlap browser
  acceptance or a migration command.
- Full standalone: **1,486 tests / 3,662 assertions / 1 existing skip**, no
  failures/errors.
- Three-file PHP style: passed. PHP class references (**124 files / 124
  classes**), parallel lists and atomic-section checks: passed. Final
  documentation/mirror and diff checks: passed.

Logs: `tmp/j113b-lead-native.log` and `tmp/j113b-lead-standalone.log`. The
independent reviewer performed read-only inspection, with no test run or write.
No full-native, JavaScript, browser or MediaWiki 1.44 run is claimed.

This advances HIST-8/HIST-4 only within direct-embed source selection. Naming,
output and reader compatibility are unchanged, and J113A output remains inactive.
Property-only template/gallery sources still lack PDF-page metadata. Whole-set
allocation/resume, provenance for earlier migrated records, Default/show-intent
semantics, output activation, tidy/undo and the actual owner-reviewed dry run
remain coordinated lead work. No ordinary wiki write, migration command,
configuration change, commit or push occurred.
