# J112C1 — File-specific embed rename component

**Status: accepted after two senior-review corrections and subsequently integrated by lead-owned J112C — October 2, 2026.** See the [integration review](J112C_INTEGRATION_REVIEW.md) for current caller behavior and gates. The senior report at the end of this packet, assignment and junior report retain their original component-only scope and evidence; statements that it was inactive describe that earlier review.

**Advances:** HIST-7 (rename and matching embeds change together), as a prerequisite for HIST-4's full identity model. The owner authorized proceeding and delegation. The lead retains publication integration and acceptance; the owner retains architecture and larger behavior decisions.

## Outcome and boundary

Provide a tested, pure source-rewrite component that can rename one file's layer set without touching another file's set or a slide with the same name. All matching direct embeds of a PDF set are renamed together, preserving their PDF page options. The component receives the rename decision from its caller; it does not decide which PDF records belong to a publication operation.

The identity rule is settled: **owning wiki page + canonical file + layer-set name**. A PDF page is an internal part of that one set; it never gets a separate set name. Slides use owning wiki page + slide name. Equal names across different full identities are valid. Filename case is significant after native title normalization; layer-set name comparison uses `DrawingName::key()`.

This component must be independently reviewable while the lead prepares the coordinated write path. **Do not wire it into publication or relax publication uniqueness in this packet.** The current `renameReferences()` API and its production caller continue behaving as before. The lead will replace that caller only when complete PDF rename, source admission, creation and copy behavior are covered together. This is a dependency boundary, not a new runtime backend or a change in the product model.

## Starting point

Read `AGENTS.md`, the charter's **Read this first**, the approved [behavior brief](LAYER_SET_BEHAVIOUR_BRIEF.md) sections 1 and 9, and the current [handoff](IMPLEMENTATION_HANDOFF_PLAN.md). Read the [J112B senior review](J112B_PDF_PAGE_ROUTING_PACKET.md#senior-review-and-corrections--october-1-2026). The earlier J112 proposal is historical planning context; its broad holds do not supersede this assignment.

The working tree contains accepted, **uncommitted** J112A/J112B work above checkpoint `364fb385`, plus lead documentation. Obtain that actual working-tree patch if working elsewhere; the checkpoint alone is insufficient. Preserve it. Do not reset, stash away, commit or push unrelated changes.

Accepted baseline: standalone PHPUnit **1,392 tests / 3,282 assertions / 1 skip**; native PHPUnit **475 tests / 3,955 assertions / 1 skip**, both without failures/errors. The native environment is MediaWiki 1.45.3 / PHP 8.3.31 in the existing `mediawiki-145` development container. JavaScript evidence from the J112B junior report is **15,124 tests / 206 suites**, not a fresh measurement for this packet.

## Why this component comes first

`DirectEmbeddingRewriter::renameReferences()` currently receives `old normalized label => new label` and matches only owner and label. `PagePublicationService::withRenamedEmbeds()` is its only production caller and constructs the same page-wide map. Once publication admits equal names on different files, that map would rewrite unrelated references. The new component closes this prerequisite before the lead enables the complete identity change.

Copy, adoption and creation remain coupled work: `PageDrawingCopy` currently allocates names across the page and copies one surface; its named PDF lookup omits the source page. Adoption allocates names in both preparation and publication. `NewPageDrawing::surfaceId()` currently hashes owner, base revision and name without file/PDF-page identity. The lead must reconcile those together and preserve saved IDs and unsaved drafts. Do not work around them by broadening this assignment.

## Allowed files

| File | Permitted work |
| --- | --- |
| `src/Revision/DirectEmbeddingRewriter.php` | Add the pure scoped method below. Small private factoring of replacement construction is permitted if legacy behavior is preserved exactly; no scanner expansion. |
| `tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php` | Add exact source-byte, scope, ambiguity and order-independence tests. Retain existing tests and old-API assertions. |
| `tests/phpunit/core/DirectEmbeddingRewriterTest.php` | Verify native canonical file-title aliases and the scoped method against real MediaWiki title rules. No publication bypass fixtures are needed. |
| This packet | Append the junior implementation report. The lead updates shared status, review ledger and handoff after review. |

Do not edit `PagePublicationService`, `DrawingName`, `PageOwnedBindingOptions`, `PageOwnedPilot`, `NewPageDrawing`, copy/adoption/migration classes, JavaScript, CSS, messages, manifests, schemas or shared status documents. No new class, database table, endpoint, feature flag or runtime dependency. If implementation cannot fit this boundary, return the concrete conflict to the lead instead of widening it.

## Frozen component contract

Add this method to `DirectEmbeddingRewriter`:

```php
public function renameScopedReferences(
    string $text,
    int $pageId,
    array $renames,
    callable $resolveFile,
    bool $bareNames = false
): string
```

`$text` is original main-slot source. `$pageId` is the owning page, not a target to write or fetch. `$resolveFile` has the existing scanner contract: native title rules return canonical `File:<DB key>` or null. `$renames` is a list of records with this shape:

```php
[
    [
        'kind' => 'file',
        'fileTitle' => 'File:Manual.pdf',
        'oldName' => 'ABC',
        'newName' => 'XYZ'
    ],
    [
        'kind' => 'slide',
        'fileTitle' => null,
        'oldName' => 'Overview',
        'newName' => 'Introduction'
    ]
]
```

1. **Validate the entire request before rewriting.** Require a valid positive owner ID under the existing binding bounds, a list of correctly typed records, the `file`/`slide` kinds, and the matching `fileTitle` shape. For `file`, require a canonical title that the supplied resolver returns unchanged; for `slide`, require null. Reject invalid new names using the existing writable-name rules. Throw `InvalidArgumentException` with the existing internal helper code `layers-embedding-source-unavailable`; no new user-facing error wording is introduced by this unconnected component.
2. **Match the full scope.** Index by kind, canonical file where applicable, and `DrawingName::key(oldName)`. Both image and PDF embeds use `file`. Do not include PDF page, timestamp, SHA, surface ID or repository version in this scope. Do not lowercase file titles or concatenate ambiguous unescaped tuple fields.
3. **Old spelling is comparison input.** `oldName` must be a string, but need not already have canonical spacing or display case. Compare it with `DrawingName::key()`. Do not require that a legacy stored display name already satisfies new-name rules merely to permit its repair. A name no valid embed can express simply has no matching candidate; never derive a different target from it.
4. **Resolve duplicate instructions before scanning.** Repeated instructions for the same normalized old identity may coalesce only when their new display names are byte-identical. Conflicting destinations, including `Plans` versus `plans`, refuse regardless of descriptor order and even when no embed matches. Never choose the first or last instruction silently.
5. **Use the existing conservative scanner.** Match only complete direct literal candidates it already supports. Preserve exclusion of templates/dynamic embeds, nested links, opaque tag bodies, comments and literal examples. Do not use a global source replacement or implement a second wikitext parser.
6. **Admit selectors conservatively.** Any `layersbinding` candidate stays byte-identical, including mixed raw/named forms. For file candidates, skip repeated or mixed set-selector options that make selection ambiguous, whether their values are explicit or bare. `PageOwnedBindingOptions::named()` alone does not reject every such form; local admission in this new method must cover them without changing that shared helper. Valid ordinary `layerset=` and legacy `layers=` remain supported. Slide target identity is separate from a file's selector options; retain its other options verbatim.
7. **Respect owner and migration interpretation.** Explicit names belonging to another page stay untouched. With `$bareNames=false`, bare names remain untouched; with true, admit this page's bare names through existing named-option semantics. Preserve current generic show/hide interpretation; Default/show-intent changes belong to J113. An explicit own-page name that is literally `on` remains a literal name.
8. **Preserve the existing output policy for this component.** As with the current rename helper, a rewritten reference uses `<pageId>:<newName>`, including when a bare input was admitted. This preserves the current caller boundary; it does not introduce new author syntax or satisfy HIST-9. J113 owns the coordinated change to bare-name output. `rewrite()` and old `renameReferences()` must retain their current behavior.
9. **Apply once against original text.** Build edits from the original candidates and apply them in reverse byte-offset order. A legitimate `A ↔ B` rename must swap, not cascade. Descriptors for separate files with the same old name remain independent. Preserve all non-selected bytes, filename spelling, PDF page options, captions, presentation options and slide options. Retain the old helper's formatting convention for the selected name itself.

No lookup, authorization, save or migration occurs here. The future publication caller remains responsible for exact base revision, full PDF-set rename, source permissions, collision checks, admission and one atomic revision.

## Required tests

All tests must call production methods and compare exact output or exact refusal. Same-name source strings are valid fixtures for this pure helper; do not bypass publication uniqueness to create database fixtures.

| Case | Required evidence |
| --- | --- |
| Full file identity | Rename A/ABC to XYZ with direct embeds for A/ABC, B/ABC and slide ABC in the same text. Only A changes. Reverse descriptor order and repeat the same A embed. Explicit foreign-owner A/ABC stays unchanged. |
| Independent descriptors | Rename A/ABC to X and B/ABC to Y in one operation, with the same-name slide still unchanged. Reverse descriptor and embed order. Filename case distinctions survive native canonicalization. |
| One PDF-set name | PDF/ABC embeds on pages 1, 2, omitted page and repeated/alternative page-option spellings all become XYZ. Preserve every page option byte-for-byte. An unrelated PDF file named ABC stays unchanged. No page suffix is generated. |
| Slides and swaps | A scoped slide rename leaves file names/selectors unchanged. Preserve the existing slide A/B swap result using the new record contract. File-set swaps also use original identities without cascading. |
| Native aliases | In the core test, `Image:Thing with spaces.png` and `File:Thing_with_spaces.png` resolve to the same file, while their original source spelling remains. Use the installed title factory, including a localized file namespace test. No filename lowercasing in the test resolver. |
| Migration interpretation | Bare names untouched before the gate, matched afterward; own explicit references work in both states; foreign explicit references untouched. Generic show/hide inputs keep current interpretation. Explicit literal `on` is covered separately. Output spelling remains the current helper policy. |
| Protected source | Comments, nowiki, templates, nested captions, non-file links, other owners and raw bindings remain byte-identical. Include UTF-8 text before multiple replacements to catch character-offset mistakes. |
| Ambiguous selectors | Mixed raw/named, repeated explicit selectors, repeated bare selectors and mixed `layers`/`layerset` candidates stay unchanged. Other independent valid candidates in the same source still rename. Do not rewrite only the first ambiguous option. |
| Descriptor validation | Invalid owner/kind/title/new name refuses; canonically equivalent duplicate old scopes with identical targets coalesce; conflicting targets refuse even without a matching embed. Test both orders and differing display case. Legacy old-name comparison input is accepted without weakening new-name validation. |
| Legacy API compatibility | All existing `scan()`, `rewrite()` and `renameReferences()` tests retain their assertions. New helpers cannot silently change the existing production path or its swap/byte-preservation behavior. |

**Required sensitivity evidence:** temporarily omit the file-scope comparison, show the full-identity regression fails because B's same-name reference is changed, then restore it and rerun the relevant suite. Also demonstrate that a sequential replace approach would fail the swap assertion (a separate production mutation is optional if the exact expected/incorrect strings are reported).

## Verification and environment

Run from the extension checkout, substituting `php.exe` if Git Bash aliases `php`. Native suites use isolated core test tables in the existing development container. Run them serially; do not start browser write tests, a second native suite or migration commands on the same wiki.

```powershell
php vendor/bin/phpunit --no-coverage -c phpunit.xml --filter DirectEmbeddingRewriterTest
php vendor/bin/phpunit --no-coverage -c phpunit.xml
php vendor/bin/phpcs -sp src/Revision/DirectEmbeddingRewriter.php tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php tests/phpunit/core/DirectEmbeddingRewriterTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter 'DirectEmbeddingRewriterTest|PagePublicationServiceTest|BareNamesAfterMigrationTest|CopyFromListTest|PageOwnedAdoptionFlowTest|PageOwnedAdoptionServiceTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

In Git Bash, prefix Docker with `MSYS_NO_PATHCONV=1` so host path conversion does not corrupt container paths. Docker is only the existing test environment, never extension runtime architecture.

A full native rerun is required if factoring changes code exercised by the legacy `renameReferences()`/`rewrite()` paths beyond unchanged replacement assembly, or if focused checks expose a wider concern. No JavaScript rerun or browser acceptance is assigned to this pure inactive component. Report scope and actual evidence precisely rather than claiming whole-feature acceptance from unit tests.

## Return to the lead

Append a report with:

1. Changed files and the exact new method signature/record validation; any private factoring and proof that the old API is unchanged.
2. Test names, exact native title behavior and the mutation failure; all commands, runtime versions, test/assertion totals and skips.
3. Any concrete unresolved defect or boundary conflict. Do not relax tests or broaden publication to force a pass.
4. Confirmation of no publication wiring, altered uniqueness, new IDs, migration/configuration/ordinary-page writes, UI changes, commit or push.

The lead reviews this component before integrating it. **Completion here does not accept J112C as a whole**, PDF save/rename/creation, unsaved-draft compatibility, migration, browser acceptance, UI-10 or Layers 2.0.

## Junior implementation report - October 1, 2026

**Status: returned for lead review, not accepted.** Advances HIST-7 as an
inactive prerequisite to the lead's HIST-4 integration. The assignment header
and shared status documents are unchanged.

### Changes and boundary

Only the four permitted files were changed for C1:

- `src/Revision/DirectEmbeddingRewriter.php`: added the frozen method below.
    There is no private factoring or production caller. The scanner, `rewrite()`
    and `renameReferences()` remain byte-for-byte unchanged.
- `tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php`: added scoped
    exact-output/refusal tests and a record-construction helper; all existing
    assertions are retained.
- `tests/phpunit/core/DirectEmbeddingRewriterTest.php`: added native title-factory
    scoped tests for English, German and French. The existing test is unchanged.
- This packet: appended this report only.

```php
public function renameScopedReferences(
        string $text,
        int $pageId,
        array $renames,
        callable $resolveFile,
        bool $bareNames = false
): string
```

Before scanning, the method validates owner IDs in `1..2147483647`, a list of
records with exactly the four contracted fields, `file`/`slide` kinds, string
old/new names, canonical writable new names, and file titles returned unchanged
by the supplied resolver (`File:<DB key>`). Slide titles must be null. Old names
are comparison input through `DrawingName::key()`, not revalidated as new names.
Invalid records or conflicting normalized old scopes throw
`InvalidArgumentException('layers-embedding-source-unavailable')`;
byte-identical destinations coalesce. Nested kind/file/name maps avoid ambiguous
tuple concatenation and retain filename case.

Only original scanner candidates are considered. Any `layersbinding` option
remains untouched. File candidates need exactly one set selector; repeated/mixed
`layerset`, `layers`, `layer` and `layersetid` options are skipped. A valid single
ordinary or legacy named selector is resolved through the unchanged shared
helper. Slide identity remains its target, and other options remain verbatim.
Foreign owners and gated-off bare names do not change. PDF page options are
neither interpreted nor added to identity. Replacements preserve the existing
selected-name formatting and `<pageId>:<newName>` output policy; reverse original
byte offsets prevent cascading swaps. No new author-facing syntax or HIST-9
completion is claimed.

### Tests and sensitivity

The unit cases are:

- `testScopedRenameChangesOnlyTheMatchingFileAndOwner`: repeated A/ABC, B/ABC,
    slide ABC, an alias, foreign owner and reversed instructions.
- `testIndependentFileRenamesAreDescriptorAndEmbedOrderIndependent`: A/ABC to X
    and B/ABC to Y, both descriptor/embed orders.
- `testScopedPdfRenamePreservesEveryPageOptionAcrossTheWholeSet`: page 1, page 2,
    omitted, repeated, space syntax, localized spelling and caption-like `page =2`;
    unrelated PDF unchanged.
- `testScopedSlideRenamePreservesItsOptionsAndLeavesFilesUntouched` and
    `testScopedSwapsUseOriginalIdentitiesWithoutCascading`: slide options and
    independent slide/file A/B swaps.
- `testScopedBareNamesFollowTheGateWithoutChangingGenericIntents`: both gate
    states, `name:` input, foreign owner, generic `on`/`off` and explicit literals.
- `testScopedRenamePreservesProtectedSourceAndUtf8Offsets`: UTF-8 prefixes between
    replacements, comments, nowiki/ref, templates, dynamic filenames, nested
    captions, ordinary links and raw bindings.
- `testScopedRenameSkipsAmbiguousSelectorsAndRenamesIndependentCandidates`:
    14 ambiguous combinations, with a valid independent embed still renamed.
- `testScopedEquivalentDuplicateInstructionsCoalesceButKeepDisplayCase`,
    `testScopedConflictingInstructionsRefuseInEitherOrderWithoutEmbeds`,
    `testScopedRequestValidationRefusesBeforeScanning` and
    `testScopedIdentityFieldsCannotCollideThroughConcatenation`: normalized
    duplicates, byte-distinct destinations in both orders, invalid
    types/shapes/owner/title/new-name records, legacy comparison names and
    tuple-field separation. Invalid-record tests explicitly forbid a scanner call.

Native `testScopedRenameUsesNativeAliasesAndCaseSensitiveCanonicalFiles` uses the
installed title factory. `Image:thing with spaces.png`,
`Datei:thing with spaces.png` and `Fichier:thing with spaces.png` normalize to
`File:Thing_with_spaces.png`, as does the underscore spelling. Original
namespace/filename spelling and other bytes remain unchanged.
`File:Thing_with_Spaces.png` remains a distinct canonical file and can receive an
independent rename. Noncanonical alias, spacing, first-letter and fragment
descriptors refuse. No test resolver lowercases filenames.

**File-scope mutation:** temporarily replaced the candidate's canonical target
lookup with the first instructed file. The full-identity test failed exactly
once (**1 test / 1 assertion / 1 failure**): expected
`[[File:B.jpg|layerset=7:ABC]]`, actual `[[File:B.jpg|layerset=7:XYZ]]`. The mutation
was immediately restored; the complete rewriter suite then passed
**96 tests / 248 assertions**.

**Swap sensitivity:** production expects `{{#Slide:7:B}}{{#Slide:7:A}}` from
`{{#Slide:7:A}}{{#Slide:7:B}}` under A-to-B/B-to-A instructions. A separately
executed sequential `str_replace(['7:A', '7:B'], ['7:B', '7:A'], input)` produced
the incorrect `{{#Slide:7:A}}{{#Slide:7:A}}`. The production test also asserts
original-identity file swaps on PDF pages 1 and 2, in both instruction orders.
No mutation remains.

### Verification

Local PHP **8.4.11**, PHPUnit **9.6.36**, Node **24.20.0**; existing native test
container `mediawiki-145`, MediaWiki **1.45.3**, PHP **8.3.31**, PHPUnit **9.6.36**.
Native suites ran serially against isolated core test tables; no browser or
migration writes ran alongside them.

All required commands in "Verification and environment" above were run, using
`php.exe` locally and `MSYS_NO_PATHCONV=1` before Docker. The extra focused native
run used the same Docker command with `--filter DirectEmbeddingRewriterTest`.
The required file-scope mutation run used the standalone command with
`--filter testScopedRenameChangesOnlyTheMatchingFileAndOwner`.

| Check | Result |
| --- | --- |
| Initial legacy rewriter suite | 42 tests / 126 assertions. |
| Final scoped/legacy rewriter suite | **96 tests / 248 assertions**. |
| Standalone suite | **1,446 tests / 3,404 assertions / 1 existing skip**. |
| Three-file PHPCS | Pass, zero errors/warnings after local style repairs. |
| Focused native rewriter suite | **5 tests / 36 assertions**. |
| Required native group | **57 tests / 309 assertions**. |
| `node scripts/check-php-class-refs.js` | Pass: 122 files / 122 classes. |
| `node scripts/check-parallel-lists.js` | Pass: all three list groups agree. |
| `node scripts/check-atomicity.js` | Pass. |
| `node scripts/verify-docs.js` | Pass, including after appending this report. |
| `git diff --check` | Pass, including after appending this report. |

There were no test failures/errors and no skips except the one noted above.
Editor diagnostics report no errors in the three PHP files. Final diff
inspection confirms no changes to active legacy methods. No factoring changed
their execution, and focused native checks exposed no wider concern, so the
conditional full-native rerun was not triggered. JavaScript and browser
acceptance were not assigned or run for this inactive component. MediaWiki 1.44
remains unverified.

### Return and remaining work

No unresolved defect or boundary conflict was found within this packet. This is
junior verification, not lead acceptance or integrated publication evidence.
The lead retains whole-PDF publication/rename, collision/source/admission checks,
creation/copy/adoption allocation and draft compatibility. J113 retains
migration, generic/Default semantics and bare-name output;
viewer/browser/owner acceptance remains pending.

No publication wiring, altered uniqueness, new IDs, migration/configuration or
ordinary-page writes, UI changes, commits or pushes were made. All pre-existing
accepted/senior working-tree changes were preserved. No stop-gap was introduced.

## Senior review and acceptance — October 2, 2026

**Accepted for this bounded, inactive component.** Advances HIST-7 as a prerequisite for HIST-4. The lead reviewed the actual implementation and tests, preserved the junior's evidence above, and delegated an independent read-only review. Two defects were reproduced and corrected within the new method; existing methods and existing test assertions remain unchanged.

### Corrections and failure evidence

1. **Leading whitespace in slides.** The existing scanner recognizes `{{ #Slide: 7:ABC |width=400|noedit}}`, but the new replacement expression began at `#Slide` and left the old name untouched. The regression first failed (**1 test / 2 assertions / 1 failure**). The scoped replacement now includes leading whitespace in its preserved prefix. The regression covers spaces, a tab and a newline/indent, with explicit and bare names, preserving other source bytes (**12 assertions**). The legacy replacement expressions are unchanged.
2. **Impossible old names selecting `_`.** The independent reviewer found that empty, whitespace-only or invalid-UTF-8 old names can collapse to the same comparison key as the valid underscore-only name. The regression first failed (**1 test / 1 assertion / 1 failure**): an instruction for an empty old name renamed file and slide references to `7:_`. The new method now keeps descriptor-conflict validation separate from matchable source identities. Unusable old names cannot match; usable old names with noncanonical spacing/case still compare normally. Conflicting unusable instructions still refuse, and an unusable instruction does not mask a valid underscore instruction. Tests cover both descriptor orders, invalid bytes and punctuation, file/slide identities, and legitimate underscore renames.

The independent reviewer examined the corrected code and regression tests, ran read-only probes for both fixes and valid underscore behavior, and found no remaining actionable finding. This is component acceptance, not approval of an integrated write path.

### Final verification and limits

| Check | Lead result |
| --- | --- |
| Full standalone PHPUnit | **1,449 tests / 3,425 assertions / 1 existing skip**, no failures/errors. |
| Required native group from this packet | **57 tests / 309 assertions**, no failures/errors, on MediaWiki 1.45.3 / PHP 8.3.31. |
| PHPCS on the three PHP files | Pass, zero errors/warnings. |
| PHP class references | Pass: 122 files / 122 classes. |
| Parallel lists and atomicity checks | Pass. |
| Documentation, exact status mirror and diff checks | Pass. |

The first lead native run after the whitespace correction passed **57 / 309**. A later run after both fixes completed **57 tests / 305 assertions / 1 failure**: `PageOwnedAdoptionFlowTest::testFileAdoptionOpenedBeforeAReuploadIsRefused` hit the previously documented `backend-fail-alreadyexists` archive collision for `Shared_adoption.png` during its replacement upload. That test does not call the inactive scoped helper. It passed when rerun alone (**1 test / 6 assertions**), then the full required group passed **57 / 309**. No test fixture, upload content or configuration was changed to obtain the pass. Native suites ran serially; no browser writes ran alongside them.

No existing API was refactored and the new method still has no production caller, so the packet's conditional full-native rerun was not triggered. No fresh JavaScript, browser, MediaWiki 1.44 or owner screen acceptance is claimed. The junior's required scope mutation and swap-sensitivity evidence remain applicable; the review added the two failures above rather than replacing those checks.

### Next handoff

J112C remains lead-owned: derive whole-PDF rename groups from the exact base and stable surface IDs, validate the complete result, rebuild changed IDs and canonical content before source admission, and apply scoped source rewriting in the same native revision. Creation, copy, adoption and recoverable draft identity must agree with that model before publication uniqueness is relaxed. The lead will issue a junior integrated-acceptance packet once that coordinated implementation is reviewable. J113 retains migration/Default semantics and author-facing bare-name output; J111 retains restored viewer work.

No active publication wiring, UI/message change, schema/configuration change, ordinary wiki content write, browser write, migration write, commit or push was made. Earlier uncommitted work is preserved. No stop-gap was introduced; HIST-4 and HIST-7 remain partial.
