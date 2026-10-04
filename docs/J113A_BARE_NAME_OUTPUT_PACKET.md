# J113A: inactive bare-name output component

**Status: implemented and accepted for its inactive component scope — October 3, 2026.** The external junior returned the implementation and evidence below. Lead review and an independent code review found no remaining component blocker. The lead corrected three stale migration-summary test expectations and passed the complete required native group. All production callers still omit the new output argument. This acceptance does not authorize migration activation or complete HIST-8/HIST-9. The original assignment contract and junior evidence remain below.

**Advances:** HIST-9 (author-facing embeds contain names rather than owner IDs), as a prerequisite for the coordinated HIST-8 migration transition. Component acceptance does not complete either criterion.

## Read first

Read [AGENTS.md](../AGENTS.md), the charter's [Read this first](PROJECT_CHARTER.md#read-this-first-the-rules-for-everyone), the [approved behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md), the active [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md), and the [J112 identity proposal](J112_IDENTITY_IMPLEMENTATION_PROPOSAL.md). The proposal's introductory status supersedes its historical hold language. Read the implementation and existing tests listed below before editing.

Use the actual current working tree, including the uncommitted accepted J112A/B/C1/C integration, C2 lead corrections and October 3 terminology corrections above checkpoint `364fb385`. That commit alone is insufficient. If working elsewhere, obtain the complete working-tree patch through the owner/lead before starting. Do not reset, stash, replace unrelated files or regenerate the tree from the checkpoint.

The model is settled: an owning page, canonical file and layer-set name identify a file's layer set; slides have an owning page and name. One PDF layer set has one name across all internal PDF pages. Equal names on different files are valid. This packet asks for no new identity decision.

The earlier broad J113 section names `renameReferences()` as a writer to change. Current publication instead calls the accepted `renameScopedReferences()`. Its existing `$bareNames` argument controls **which input references are eligible**, not how output is spelled. This packet adds a separate output argument and preserves that distinction.

## Deliverable and allowed files

Provide default-off bare-name output support in the pure rewriter, with evidence that existing callers behave exactly as before. Only tests may opt in during this assignment.

Allowed changes:

- `src/Revision/DirectEmbeddingRewriter.php`
- `tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php`
- `tests/phpunit/core/DirectEmbeddingRewriterTest.php`
- This packet, only to append the junior report and verification evidence.

Read, but do not edit, `PageOwnedBindingOptions.php`, `PageOwnedBinding.php`, `DrawingName.php`, `LayerSetIdentity.php`, `SetNameResolver.php`, `PagePublicationService.php`, `PageDrawingCopy.php`, `DirectAdoptionPreparationService.php`, `src/Migration/`, and `maintenance/migrateLayersToPageHistory.php`.

No production caller changes, migration-state changes, new service, manifest registration, API, JavaScript, UI, message, stored-content modification, cleanup command, commit or push. No browser writes or ordinary wiki-content writes. Native tests use the existing isolated core test tables only and must run serially, as specified below. Preserve all unrelated work already in this checkout.

## Exact public contracts

Append one optional argument to each of these two methods; retain their existing parameter names, order and return types:

```php
public function rewrite(
    string $text,
    int $start,
    string $expected,
    int $pageId,
    string $name,
    callable $resolveFile,
    bool $emitBareNames = false
): string;

public function renameScopedReferences(
    string $text,
    int $pageId,
    array $renames,
    callable $resolveFile,
    bool $bareNames = false,
    bool $emitBareNames = false
): string;
```

Do not change `scan()` or the signature or behavior of old `renameReferences()`. Small private factoring is allowed inside the same class if existing behavior remains covered. No additional public method is required.

| Scoped-rename arguments | Eligible input | Replacement spelling |
| --- | --- | --- |
| `$bareNames=false`, `$emitBareNames=false` | Existing explicit references to this owner | Existing `<ownerId>:<newName>` |
| `$bareNames=true`, `$emitBareNames=false` | Existing explicit references plus this owner's bare references under existing parser rules | Existing `<ownerId>:<newName>` |
| `$bareNames=false`, `$emitBareNames=true` | Existing explicit references to this owner; bare input remains untouched | Bare `<newName>` |
| `$bareNames=true`, `$emitBareNames=true` | Existing explicit references plus eligible bare references | Bare `<newName>` |

`rewrite()` remains the single scanner-verified occurrence replacement operation: `$start` is a UTF-8 byte offset into the exact supplied `$text`, and `$expected` must match a complete candidate there. Its caller supplies the intended final owner and canonical name. This method does not independently authorize adoption/copy or prove source content ownership. Preserve that boundary; unlike scoped rename, the selected occurrence may be the explicit source reference that a separately authorized copy is replacing.

Both methods return the complete resulting string on success. Scoped rename returns the original string when valid instructions select no eligible occurrence. **They do not return `false` or a partial result.** Existing refusal is `InvalidArgumentException` with the exact token `layers-embedding-source-unavailable`, thrown by `reject()`. Retain it for unsafe requested bare output; add no error wording or exception type.

## Implementation requirements

1. **Default behavior is unchanged.** Omitting `$emitBareNames` and passing `false` must both preserve existing output, input validation, scanner handling, matching and refusal behavior. Existing explicit-ID expectations remain valid; add opted-in expectations rather than replacing them.
2. **Change output spelling only when opted in.** For an eligible file replacement, write the requested name without an owner prefix. For a slide, write the requested bare slide target. Retain each method's current option policy: `rewrite()` writes a file's selector as `layerset=` and removes a slide's legacy set selector; scoped rename preserves the matching selector's existing key/assignment prefix and existing slide options. Do not use this packet to normalize surrounding whitespace or syntax.
3. **Prove the emitted reference is actually bare and represents the requested name.** Reuse `PageOwnedBindingOptions::named()` with the supplied owner for bare interpretation. Check the resulting candidate's kind, canonical file target where applicable, and exact returned owner/name. Merely checking that `named()` returns the requested identity is insufficient: an unchanged explicit reference can also pass that test. Require the emitted selector or slide target to be the requested bare spelling, with presentation whitespace retained where the method already preserves it. A replacement must remain exactly one complete scanner-recognized candidate, and must not acquire a `layersbinding` binding.
4. **Round-trip the replacement, not a synthetic option array unrelated to it.** Build and verify the actual replacement bytes before returning or applying collected replacements. Retain original source coordinates while planning scoped edits; apply them from the end only after all matched replacements are safe. The native file normalizer supplied by the caller remains authoritative for namespaces, aliases and case-sensitive canonical filenames.
5. **Unsafe matched output refuses the whole call.** File names that are generic selectors (`on`, `true`, `all`, `1`, `off`, `none`, `false`, `0`, including case variants) do not round-trip as literal bare set names under the current parser. A matched request to emit one must throw the existing exception, even when other matched replacements would be safe. Preserve the original inputs. Do not silently keep the explicit spelling, skip only the unsafe matched replacement, rename the set, add an escape such as `name:`, or change selector interpretation. A valid unused instruction remains unused; absence of an eligible occurrence is still a no-op.
6. **Do not forbid valid stored names.** The refusal above concerns the opted-in output operation only. Explicit owner references to a literal file set named `on` or `off` remain accepted in the default mode; an explicit old name `on` can be renamed to a safely representable new name. Slide names such as `on` remain literal and can be emitted bare. A normal file name `Default` is safely representable; emitting it does not implement the later show-intent transition.
7. **Preserve scope and whole-PDF reference matching.** A scoped file rename changes only that canonical file's matching references on this owner, across all their PDF page options. Other files, slides and explicit foreign owners keep their bytes. Do not parse, clamp, reorder or rewrite PDF page options. The component does not group stored surfaces, change labels or select a source revision; publication already supplies the scoped rename records.
8. **Keep existing scanner exclusions and ambiguity handling.** Comments, literal/extension-tag bodies, dynamic or nested expressions, templates, gallery bodies, colon-prefixed file links and fragment targets retain current treatment. Scoped rename continues skipping ambiguous candidates while handling independent valid candidates. Existing malformed-source/request refusal remains. This is not a general wikitext rewriter or a gallery/template migration implementation.
9. **Use the original identity map for swaps.** Equivalent instructions coalesce; conflicting destinations retain their existing refusal. `A -> B` and `B -> A` must not cascade through earlier replacement text. Descriptor and embed order must not change which full identities are selected.
10. **Handle the known slide formatting trap only within the opted-in path.** The scanner accepts leading whitespace before `#Slide`, but `rewrite()` currently uses an anchored replacement expression without that leading-whitespace support. Scoped rename already supports it. For opted-in `rewrite()`, correctly replace a scanner-accepted target such as `{{ #Slide:7:ABC |width=400}}` and preserve its surrounding whitespace. The positive fixture for this supported literal form must succeed. Do not silently return an unchanged explicit target as a successful bare rewrite. Other replacements that cannot pass verification refuse. Do not broaden or repair the default-off path as part of this assignment; report its existing behavior separately.

## Immutable inputs and caller guarantees

The helper receives text and rename instructions from a caller's exact snapshot. It performs no revision lookup, authorization, publication, database update or migration-state read. Inputs are not passed by reference and must remain byte-for-byte/value-for-value unchanged on success and refusal. Add assertions comparing the original text and serialized descriptors before and after calls, including a mixed safe/unsafe request in both source orders.

All existing production calls omit the new final output argument and therefore remain explicit-output calls. Inspect the call sites in publication, copy, adoption and migration and list them in the report; do not modify them. Do not confuse this default-off guarantee with a claim that the new mode is safe to activate before migration: the caller must later establish when bare names have the intended reader meaning.

No saved surface ID, layer, source pin, canvas, label, history revision or draft record is an input that this helper may mutate. Pure source tests demonstrate matching and byte preservation, not publication atomicity or rendered browser acceptance.

## Required regression matrix

| Case | Assertions |
| --- | --- |
| Compatibility | Existing tests stay intact. Omitted and explicit-false output arguments agree for both methods. Old `renameReferences()` retains current results. Test all four input/output flag combinations on explicit-own, explicit-foreign and bare references together. |
| Single occurrence | `rewrite()` replaces only the selected exact occurrence in repeated identical embeds using UTF-8 byte offsets; keeps captions, layout options and PDF page options; rejects stale/partial expected bytes and existing conflicting bindings as before. |
| Files and slides | Opted-in file output uses `layerset=<name>` for `rewrite()`; scoped `layers=` remains `layers=`. Slides emit `{{#Slide:<name>}}` with existing options and whitespace policy. Include Unicode names, underscores, display case and the leading-whitespace trap above. |
| Full identity | Same-name file A, case-distinct file B and a slide are independent. Canonical namespace/space aliases for A match A only. Explicit foreign owners and `layersbinding` remain untouched in scoped rename. |
| PDF | Several embeds of one PDF set on pages 1 and 3, repeated page 3 and a different set: one requested new name replaces all and only the intended set's references. All page-option bytes remain unchanged, including native alternate `page 3` syntax. No page suffix is generated. |
| Safe representation | Ordinary names including `Default` round-trip; each generic file show/hide spelling and uppercase variants refuses when requested as matched bare output. Explicit old `on -> Notes` works; literal slide `on` works. Unmatched valid unsafe-output instructions do not change unrelated text. |
| Whole-call refusal | One safe matched rename plus one unsafe matched file destination throws the exact existing exception in either candidate order. No partial returned text and no mutation of text/descriptors. The default-off operation still supports these explicit destination names. |
| Source safety | Malformed source, ambiguous selectors, literal/dynamic examples and registered extension tags retain existing behavior. A separate eligible safe candidate still renames when an ambiguous candidate is skipped, as existing scoped tests require. |
| Swaps/order | File and slide swaps are evaluated against original names; descriptor order and occurrence order do not cascade or cross scopes. |
| Native namespace proof | Extend the existing English `Image`, German `Datei` and French `Fichier` cases using real native Title normalization; retain the case-distinct canonical file trap, invalid descriptor refusal and unrelated bytes. |

Use actual rewriter methods and the actual named-option parser for the round-trip assertions. Do not mock the output validator into approving every result. Existing method implementations and assertions are the compatibility baseline, not old test counts.

## Meaningful negative controls

Run these serially against temporary local mutations, restoring each mutation immediately. Do not run a native or browser suite while the implementation is temporarily mutated. Preserve unrelated edits; do not reset or overwrite the checkout to restore a mutation.

1. Temporarily force the new output mode to the old explicit spelling. Demonstrate that the opted-in bare-output positive assertions fail because the owner prefix remains. Restore and pass the focused standalone suite.
2. Temporarily bypass only the new representation/round-trip refusal. Demonstrate that a matched literal file destination `on` or `off`, and the mixed safe/unsafe atomic-refusal case, fail because the call returns an unsafe result instead of refusing. Restore and pass the focused standalone suite.
3. Temporarily make output opt-in also enable bare **input** matching, regardless of `$bareNames`. Demonstrate that the `false/true` matrix case fails because a pre-existing bare reference was rewritten without input eligibility. Restore and pass the focused standalone suite.

Record the exact temporary change, test name, expected failure and observed failure. A syntax error, unrelated exception or skipped test is not evidence of sensitivity. The existing J112C1 file-scope mutation evidence remains historical; keep its identity regressions passing here.

## Commands and scheduling

Run from `F:\Docker\mediawiki\extensions\Layers`. The native command uses isolated core test tables in the existing `mediawiki-145` test container. This assignment authorizes the native group below once you verify that no other native suite, browser acceptance or migration command is active. Run it serially. If the environment is occupied or you cannot establish that it is idle, continue independent code/standalone work and report the test window needed; do not start a competing run. Docker is test infrastructure only.

```powershell
php vendor/bin/phpunit --no-coverage -c phpunit.xml --filter DirectEmbeddingRewriterTest
php vendor/bin/phpunit --no-coverage -c phpunit.xml
php vendor/bin/phpcs -sp src/Revision/DirectEmbeddingRewriter.php tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php tests/phpunit/core/DirectEmbeddingRewriterTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter 'DirectEmbeddingRewriterTest|ScopedPublicationTest|PagePublicationServiceTest|BareNamesAfterMigrationTest|CopyFromListTest|ScopedCreationCopyTest|PageOwnedAdoptionFlowTest|PageOwnedAdoptionServiceTest|FilePageMigrationTest|PageCopyMigrationTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

If the local `php` command is unavailable, report that environment fact and use the lead's existing approved PHP test runtime; do not install or reconfigure the environment. No JavaScript change is allowed, so this component does not require another full JavaScript run or browser acceptance. A full native suite is required if factoring touches the default paths beyond unchanged replacement assembly, or focused failures expose wider coupling; coordinate it with the lead rather than running competing suites. Default-path behavior must remain unchanged. Do not expand scope to fix a failing unrelated test.

## Lead-owned next stages

The following remain outside this packet and must be planned together before enabling bare output in production callers:

- `MigrationState` gating and the transition from legacy show intent to this file's `Default`, preserving what pages currently display.
- Group-aware allocation and resume in `FilePageMigration` and `PageCopyMigration`, including source provenance, exact PDF page selection and the existing multi-set slide rule.
- Treatment of already migrated numbered and PDF-suffixed labels, including `FilePageDrawings::find()` and the current `BoundSlideHooks::drawingOfFileNamed()` compatibility fallback. Never infer a migration-generated label by stripping a suffix; uncertain provenance stays unchanged and is reported.
- Template/gallery-produced references whose current meaning cannot be preserved by a direct-source rewrite. This component must not silently make them invisible or alter their meaning.
- Handling literal file names that cannot be represented by the plain bare spelling. This packet implements safe component refusal only; it chooses no new visible syntax or rename policy.
- Wiring publication, copy, adoption and migration to the new output mode; proving reader equivalence against exact owner revisions and exact internal PDF pages, with permissions and source-version checks intact.
- `--tidy-names` planning, stale-base refusal, idempotence, resumability, migration undo, reports and owner-reviewed actual dry runs. This packet authorizes no tidy or reconciliation commit on any wiki.
- Documentation for authors and final browser/owner acceptance. No HIST-8/HIST-9 completion claim follows from passing these component tests.

## Junior return report

Append the report here. Include changed files; exact signatures; any private factoring; proof that default callers and old tests retain their behavior; the four-flag matrix and native canonical-title results; exact exception token and input-preservation evidence; every command with test/assertion totals and skips; all negative-control results and successful restoration; and any genuine boundary conflict or pre-existing defect found.

State explicitly that the output mode remains inactive in production callers, no migration/browser/ordinary wiki writes occurred, no stored names or IDs changed, and no commit or push was made. Return to the lead for review. Do not start the next stage yourself.

### Junior implementation return

**Returned for lead review, not acceptance or activation.** This implements the
inactive HIST-9 component and prepares HIST-8; neither criterion is completed.
Work used accepted uncommitted J112 code and October 3 terminology corrections,
not checkpoint `364fb385` alone. Unrelated edits were preserved.

Changed only the three authorized PHP files and appended this report. The scanner
and old `renameReferences()` implementation/signature are unchanged. Existing
explicit-output assertions remain intact; native opted-in assertions were added.

Exact public signatures:

```php
public function rewrite(
        string $text, int $start, string $expected, int $pageId, string $name,
        callable $resolveFile, bool $emitBareNames = false
): string;

public function renameScopedReferences(
        string $text, int $pageId, array $renames, callable $resolveFile,
        bool $bareNames = false, bool $emitBareNames = false
): string;
```

Private `assertBareReplacement()` rescans actual assembled replacement bytes.
It requires one complete candidate at byte zero with matching raw bytes, length
and kind; the original canonical file target for files; exactly the requested
bare selector/slide target; no binding; and exact owner/name returned by
`PageOwnedBindingOptions::named()` with the supplied owner. It runs only on
opt-in. Scoped edits retain original coordinates and reverse application, after
every matched replacement passes validation. Default assembly retains its bytes
and validation. No publication, allocation, permission or migration logic was
added.

`testScopedInputAndOutputFlagsAreIndependent` passes all four combinations:
false/false and true/false retain explicit output; false/true emits bare output
only for explicit-own input and leaves bare input untouched; true/true also
handles eligible bare input. Each includes files, slides and foreign owners.
Separate tests compare omitted/false output, preserve the old helper and assert
unchanged text/serialized descriptors on success and refusal.

The matrix covers repeated identical embeds at UTF-8 byte offsets, Unicode and
underscore/display-case names, selector-key/slide-option policy, registered tags,
dynamic/literal/ambiguous source, stale/partial/bound selections and swaps in
both descriptor and occurrence orders. PDF cases cover pages 1/3/repeated 3 and
a different set, retaining `page 3`, duplicate, spaced and localized page-option
bytes. No page suffix is generated.

Safe `Default`, explicit old `on -> Notes`, literal slide `on` and valid unused
unsafe instructions succeed. All 14 distinct generic file spellings (eight
lowercase values and six extra uppercase variants) refuse matched bare output
in both methods. Mixed safe/unsafe requests refuse in both source/descriptor
orders with original arguments unchanged. The exact refusal remains
`InvalidArgumentException('layers-embedding-source-unavailable')`.
No partial result, escape syntax or explicit-output fallback is returned.

Native English `Image`, German `Datei` and French `Fichier` cases use the real
Title factory. Aliases, first-letter normalization and filename spaces match
only the intended canonical file. Case-distinct files, slides, fragments and
colon links remain independent. Emitted candidates round-trip through the real
named-option parser. This is component proof, not rendered reader acceptance.

#### Production callers remain inactive

Inspected without editing; all omit the new output argument:

- `PagePublicationService::withRenamedEmbeds()` calls scoped rename with text,
    owner ID, renames, resolver and `MigrationState::isCompleteNow()`. Migration
    state remains only the existing input gate.
- `PageDrawingCopy` direct preparation calls `rewrite()` with main, start,
    expected, page ID, `source['label']` and fileTargets.
- `DirectAdoptionPreparationService::prepare()` calls `rewrite()` with main
    text, start, expected, page ID, name and resolveFile.
- `PageCopyMigration::plan()` calls `rewrite()` with text, candidate start/raw,
    page ID, `names[key]` and fileTargets.

The migration directory and maintenance driver were read only. File-page
allocation/PDF suffixes, slide planning and completion policy are unchanged.
No production caller enables bare output.

#### Verification

Local: PHP **8.4.11**, PHPUnit **9.6.36**, Node **24.20.0**.
Native: MediaWiki **1.45.3**, PHP **8.3.31**, PHPUnit **9.6.36**,
existing `mediawiki-145` container.

Focused standalone command:

```bash
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml \
    --filter DirectEmbeddingRewriterTest
```

First small edit: **104 tests / 287 assertions** passed. Final matrix and each
mutation restoration: **127 / 475**, no failures/errors/skips.

Full standalone command:

```bash
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml
```

Result: **1,486 tests / 3,662 assertions / 1 skip**, no failures/errors.

Changed-file style command:

```bash
php.exe vendor/bin/phpcs -sp \
    src/Revision/DirectEmbeddingRewriter.php \
    tests/phpunit/unit/Revision/DirectEmbeddingRewriterTest.php \
    tests/phpunit/core/DirectEmbeddingRewriterTest.php
```

Final result: **0 errors / 0 warnings**, exit 0.

Required native command (wrapped filter concatenates to the assigned argument):

```bash
filter='DirectEmbeddingRewriterTest|ScopedPublicationTest|'\
'PagePublicationServiceTest|BareNamesAfterMigrationTest|'\
'CopyFromListTest|ScopedCreationCopyTest|PageOwnedAdoptionFlowTest|'\
'PageOwnedAdoptionServiceTest|FilePageMigrationTest|PageCopyMigrationTest'
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
    -w /var/www/html/extensions/Layers mediawiki-145 \
    php vendor/bin/phpunit -c tests/phpunit/core.xml --filter "$filter"
```

Result: **95 tests / 596 assertions / 3 failures**, no errors/skips reported.
The out-of-scope terminology fixtures are listed below. Repeated the native
invocation with `--filter DirectEmbeddingRewriterTest`: **5 / 65 passed**,
no failures/errors/skips.

Static/documentation commands:

```bash
node.exe scripts/check-php-class-refs.js
node.exe scripts/check-parallel-lists.js
node.exe scripts/check-atomicity.js
node.exe scripts/verify-docs.js
git diff --check
```

All passed. Class references: **124 files / 124 extension classes**. Parallel
lists agree for booleans, layer types and page-owned renderable types. Docs:
**80 maintained/policy documents / 53 historical records**, including the report
in the subsequent check. Diff checking was repeated after the report.

Before native tests, read-only `Get-CimInstance Win32_Process` checks inspected
host PHP/Node/Docker commands and automated browser main processes.
`docker top mediawiki-145 -eo pid,etime,args` showed Apache and old log readers,
but no native/migration test process. Persistent generic browser-control
runtimes were present, so an additional automated-browser process check and
`docker logs --since 5m --tail 30 mediawiki-145` were used. Neither showed active
browser acceptance/recent wiki activity. Both native runs were serial, after
all mutations were restored. No native/browser run overlapped a mutation.

The native group does **not** pass as a whole. The following assertions in
`tests/phpunit/core/PageCopyMigrationTest.php` expect retired terminology,
while the accepted October 3 catalog returns approved layer-set terms:

- `testDirectEmbedsGetOneCopyPerSetAndNameIt`, assertion at line 95:
    actual summary begins `Copied 3 shared layer sets into this page:`.
- `testSlidesAreCopiedFromTheirRowsAndNamedAfterTheSlide`, line 133:
    same summary terminology mismatch; source/name details agree.
- `testFilePageEmbeddingItsOwnSetOnlyNamesItsDrawing`, line 182:
    actual summary is `Pointed embeds at this page's own layer sets`.

These assertions are outside the allowed files and were left untouched. No
catalog wording was reverted. This is an outstanding lead-review gate, not
permission to activate bare output or change migration tests. No full native
suite was run: default-path changes are limited to unchanged replacement
assembly/default-off dispatch. These failures concern pre-existing summary
expectations, not wider rewriter coupling.

Development checks initially caught a missing array-closing bracket in new
test data, then one 123-character line. Both were corrected locally; the same
focused suite/style command passed afterward. `php.exe -v` and
`node.exe --version` recorded local runtimes. A read-only probe loading core
`Defines.php` without MediaWiki autoloading failed with missing
`Wikimedia\Rdbms\IDatabase`; the following source query confirmed `1.45.3`:

```bash
MSYS_NO_PATHCONV=1 docker exec mediawiki-145 \
    grep -n 'MW_VERSION' /var/www/html/includes/Defines.php
```

No environment installation/reconfiguration occurred. Scoped `git diff` review
and PHP editor diagnostics found no mutation residue or relevant errors. The
new report was wrapped separately; inherited packet line-length diagnostics
were not repaired by reformatting the lead-issued text.

#### Negative controls and restoration

**Control 1: Force explicit output.** Temporarily assign
`$emitBareNames = false;` at the start of both methods. The command below ran
**5 tests / 9 assertions / 3 failures**. Opted-in matrix cases and the repeated
UTF-8 occurrence received `7:Notes`, `7:Plans` and `7:Notes_Été` instead of bare
names. These were string diffs, not exceptions. Removed both assignments
immediately.

```bash
filter='testScopedInputAndOutputFlagsAreIndependent|'\
'testBareSingleOccurrenceUsesUtf8ByteOffsetsAndPreservesInput'
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml --filter "$filter"
```

**Control 2: Bypass representation refusal.** Temporarily insert `return;` at
the start of private `assertBareReplacement()` only. The command below ran
**15 tests / 44 assertions / 15 failures**. Generic tests returned unsafe values
including `[[File:A.jpg|layerset=on]]` and `layerset=off`. The mixed request
returned `[[File:A.jpg|layerset=Notes]] [[File:B.jpg|layerset=off]]` rather than
refusing. Removed the early return immediately.

```bash
filter='testMatchedGenericFileBareOutputRefusesWithoutMutatingInputs|'\
'testMixedSafeAndUnsafeBareOutputRefusesTheWholeCallInBothOrders'
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml --filter "$filter"
```

**Control 3: Conflate output/input gates.** Temporarily change scoped `named()`'s
owner argument from `$bareNames ? $pageId : null` to
`( $bareNames || $emitBareNames ) ? $pageId : null`. The command below ran
**4 tests / 10 assertions / 1 failure**, specifically false/true. Existing bare
file `ABC` incorrectly changed to `Notes`, and bare slide `ABC` to `Plans`.
Restored the original input-only condition immediately.

```bash
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml \
    --filter testScopedInputAndOutputFlagsAreIndependent
```

After **each** restoration, reran the focused standalone command:
**127 tests / 475 assertions passed**, no failures/errors/skips. No reset,
file replacement or unrelated edit was used to restore mutations.

#### Existing boundary and return status

`testLeadingWhitespaceDefaultTrapRemainsInactive` documents the default-off
`rewrite()` trap: `{{ #Slide:7:ABC |width=400}}` requested as owner 7/name ABC
returns unchanged explicit text. Requesting Plans refuses because the anchored
expression does not replace its target. Opted-in mode correctly emits bare
ABC/Plans while preserving whitespace. The default-off defect was not repaired.

Output remains **inactive in production callers**. No migration command, browser
or ordinary wiki-content write occurred. Authorized native fixture writes used
isolated core test tables only. No ordinary wiki names/IDs, pins, layers, drafts
or configuration changed. No cleanup command, commit or push was made. J113A
made no UI/message/terminology change. This return is for lead review with the
native terminology-fixture gate explicitly outstanding. Integration, activation,
migration transition, dry runs and final owner acceptance remain lead-owned.

## Lead acceptance — October 3, 2026

**Accepted for the inactive component.** The lead inspected the actual replacement validator, default dispatch, original-coordinate scoped edits, exact file/owner matching and production call sites. An independent engineer reviewed those boundaries and the regression matrix without finding an actionable defect; their focused standalone rerun passed **127 tests / 475 assertions**. Neither review enables the output mode. The junior's three negative-control results and restored runs above remain their evidence; the lead did not repeat the mutations.

The three reported failures were stale literal expectations in `tests/phpunit/core/PageCopyMigrationTest.php`, outside the junior's allowed files. The lead changed only the two `Copied 3 shared layer sets into this page` expectations and the `Pointed embeds at this page's own layer sets` expectation to match the already approved English catalog. All source/name/revision details and migration behavior assertions remain intact. No message or migration production code was changed during lead review.

Fresh lead verification:

- Full standalone, using the assigned command: **1,486 tests / 3,662 assertions / 1 existing skip**, no failures/errors.
- Complete required native group, using the assigned filter: **95 tests / 606 assertions**, no failures/errors/skips, on MediaWiki 1.45.3 / PHP 8.3.31. This supersedes the junior's three-failure gate. Host test-process checks, container process inspection and recent wiki activity checks preceded the run; no native/browser/migration overlap occurred.
- PHP style for the three implementation/test files plus `PageCopyMigrationTest.php`: passed. PHP class references (**124 files / 124 classes**), parallel lists and atomic-section checks: passed. Final documentation/mirror and diff checks: passed.

Logs: `tmp/j113a-lead-standalone.log` and `tmp/j113a-lead-native.log`. No full-native, JavaScript or browser rerun is claimed or needed for this inactive PHP component and the three literal fixture corrections. The independent reviewer performed no native tests or wiki writes.

The already documented default-off leading-whitespace slide replacement defect remains outside this component; the opted-in path is covered and works. Migration allocation/resume, Default show intent, proven treatment of existing migrated names, caller activation, tidy planning and owner-reviewed dry runs remain lead integration work. Existing user-visible behavior and stored content remain unchanged. No ordinary wiki write, configuration change, commit or push occurred.
