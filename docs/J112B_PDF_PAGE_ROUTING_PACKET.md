# J112B — Route named PDF embeds to the page MediaWiki renders

**Status: accepted by the lead for this bounded implementation after two senior-review corrections, October 1, 2026. Browser and whole-feature acceptance remain pending.**

**Advances:** HIST-4. Preserves HIST-6 and SEC-2. The owner authorized proceeding on October 1, 2026. The lead owns integration and final review; the owner remains the software architect. This packet is the current bounded assignment, superseding the broad J112 read-first hold only for the scope below.

## Outcome

An embed of a named PDF layer set selects the internal record for the PDF page actually displayed by MediaWiki. The page's existing editor entry point selects that same record. A gallery also uses its rendered PDF page. A lookup never substitutes another PDF page merely because it is the only stored one.

The product model is settled: **owning wiki page + file + layer-set name** identifies one layer set. A PDF page selects a part inside it. All PDF pages retain the same layer-set name. Equal labels on different files or owning pages are valid. This task asks you to implement the approved rule, not redesign it.

## Read first and starting state

Read `AGENTS.md`, the charter's **Read this first**, [behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md) sections 1 and 9, and the current top of the [handoff](IMPLEMENTATION_HANDOFF_PLAN.md). Then inspect the production paths and tests listed below. The earlier [identity proposal](J112_IDENTITY_IMPLEMENTATION_PROPOSAL.md) is background, not permission to expand this packet.

The lead's J112A change is present in the working tree on top of `364fb385`: `src/Revision/PageOwnedBinding.php` and `tests/phpunit/unit/Revision/NamedDrawingReferenceTest.php`. It is not committed. Verify the fifth argument below exists before starting. If using another checkout, obtain the lead's actual patch first; do not recreate it or use a checkout lacking it. Preserve the existing uncommitted documentation and all unrelated work.

J112A verification: the new tests first produced **4 failures** against the old resolver, then passed **8 tests / 58 assertions** with the fix. Full standalone PHPUnit: **1,383 tests / 3,269 assertions / 1 skip**. Focused native reader/editor/migration-compatibility group: **54 tests / 635 assertions**, all passed on MediaWiki 1.45.3 / PHP 8.3.31. PHP style, references and diff checks passed. This is foundation evidence, not J112B acceptance.

## Frozen resolver contract

```php
PageOwnedBinding::resolveNamed(
    array $named,
    array $surfaces,
    ?string $kind,
    ?string $fileTitle,
    ?int $sourcePage = null
): ?string
```

- `$named` is `['pageId' => ..., 'name' => ...]`. `$surfaces` must come from that owner's authorized, exact revision. The helper is not an authorization check; keep the callers' owner/revision checks.
- `$kind` is `file` or `slide`. `$fileTitle` is the canonical `File:<DB key>` for files. Normalize titles through MediaWiki before this call, never by lowercasing a filename.
- Name comparison still uses `DrawingName::key()`. File and kind are filtered before ambiguity is evaluated.
- For PDFs, an explicit positive `$sourcePage` selects that exact `source.page`. No stored matching page returns null; two matching records return null. Zero/negative input returns null. No first/latest/nearest-page fallback.
- Images and slides retain their existing identity; a PDF page selector does not rename or split a layer set.
- Omitted/null page preserves callers that have not yet been adapted: a single matching stored surface can resolve, while multiple matches remain ambiguous. **Newly adapted file-rendering and existing-editor paths in this packet must pass the effective page explicitly.** Do not change the default to 1 inside the shared resolver; default-page interpretation belongs at the embed boundary.
- `$kind = null` remains a compatibility lookup for other callers. Do not use it to choose a file's set in the new routing code.

Do not change this public helper contract without reporting the concrete problem to the lead. No new key class, database table, endpoint or schema version is needed here.

## Allowed files

| Production file | Allowed change |
| --- | --- |
| `src/Hooks/WikitextHooks.php` | Carry an unresolved named reference with its occurrence to the native render boundary; resolve it using the effective PDF page. Pass that page through the gallery path. Preserve all existing queues and legacy boundaries. |
| `src/Hooks/BoundFileHooks.php` | Pass the effective source page through `resolveNamed()`. Preserve explicit raw-binding behavior. |
| `src/Hooks/BoundSlideHooks.php` | Pass the optional source page through `named()` to the frozen resolver. Preserve owner/revision/scope checks and slide behavior. |
| `src/Revision/PageOwnedPilot.php` | Existing-surface `embedBinding()` page selection only. Keep its callers' authorization/current-revision checks. Do not change creation, copy, adoption or allocation behavior. |
| `src/Revision/PageOwnedBindingOptions.php` | A small pure helper for reading a scanned file embed's effective page, only if needed by `embedBinding()`. Verify default and repeated-option behavior against native core. Do not change `named()` show/hide interpretation in this packet. |
| `src/Hooks/Processors/ThumbnailProcessor.php` | Only share/reuse its existing page extraction if necessary; no legacy injection/rendering changes. |
| Tests | Existing unit `WikitextHooksTest`, `PageOwnedBindingOptionsTest`, `NamedDrawingReferenceTest`; core `BoundFileHooksTest`, `BoundSlideHooksTest`, `PageOwnedPilotTest`, `BareNamesAfterMigrationTest`. A small dedicated core test class is allowed if it keeps fixtures clearer. |
| Documentation | Append the implementation report to this packet only. The lead updates shared status, handoff and review ledger after reviewing the result. |

No JavaScript, CSS, messages, manifests, new UI or changed labels. No migration writes, new-surface IDs, publication uniqueness/rename changes, `DrawingName` changes, or broad refactoring. In particular, do not edit `NewPageDrawing`, `PageDrawingCopy`, `PagePublicationService`, `DirectEmbeddingRewriter`, or migration classes in this packet.

## Implementation steps

1. **Carry the identity until the page is known.** `WikitextHooks::onInternalParseBeforeLinks()` currently resolves the named binding while populating `fileBindings`, before MediaWiki's effective page is available. Retain enough named-reference context per occurrence to resolve later. Use the thumbnail's `getParams()['page']` at `onThumbnailBeforeProduceHTML()`; inspect `ThumbnailProcessor::extractPageFromThumbnail()` for current extraction. Core's `ImageBeforeProduceHTML` also receives `$page`: prove the non-thumbnail path and avoid consuming one occurrence twice.
2. **Keep queue states distinct.** Existing `null` means no page-owned selector, `false` means refused, and admitted arrays contain binding/revision. If adding a deferred named state, give it an explicit shape and consume it before `markImage()`. A refused or unresolved page-owned selector must not enter legacy shared-set rendering. A plain same-file embed must still occupy its own slot. Preserve separate parse/render counters and reset every new state in `onParserClearState()`.
3. **Pass page through the adapters.** `BoundFileHooks::resolveNamed()` calls `BoundSlideHooks::named()`, which calls the shared resolver. Preserve the exact parser revision, foreign-owner refusal and scope admission in `named()`/`register()`. Cached parser output keeps identities only, never reader-specific rights or layer data.
4. **Handle galleries separately.** `markGalleryDrawing()` is reached from the non-wikitext thumbnail path, using parser context recorded by `onBeforeParserFetchFileAndTitle()`. Pass the actual rendered thumbnail's page. Native/Cargo galleries and `#layers_hint` must not consume the ordinary file-occurrence queue. Do not assume a gallery's textual `page=` syntax has the same meaning as a File embed; use and test the page core renders. The current filename-level gallery hint map is outside this task's redesign scope.
5. **Match existing editor selection.** `PageOwnedPilot::embedBinding()` receives canonical targets and raw options from `DirectEmbeddingRewriter::scan()`. Derive the effective page from those options, defaulting to 1, and pass it to the resolver. `NewPageDrawing::page()` is a reference for current ordered option handling (later page options overwrite earlier ones), not authority to change creation. Prove the chosen handling against native output. Keep stable surface IDs and exact saved-source offsets for existing sets.

## Compatibility and boundaries

- Keep `MigrationState::forParser()`, `bareOwner()` and the parser cache variation. Before migration, legacy show-intent behavior and `ShownLayerSets` tracking remain intact.
- Do not remove `BoundSlideHooks::drawingOfFileNamed()`'s numbered-name compatibility or change `onlyDrawingOf()` in this packet. Current migrated pages can depend on them. The approved eventual Default semantics and migration reconciliation are delivered together in the lead's transition step; changing one side here would strand existing embeds.
- Do not strip `(page N)` from stored labels. Do not write or renumber anything.
- Do not alter `PageOwnedPilot::missingName()` or its creation-list deduplication. Those still need coordinated creation/ID/draft work. An unannotated PDF page is part of an existing layer set; this packet must not create a differently named set or claim to implement its first-save UI.
- `PageDrawingCopy::source()` is another resolver caller. Its page routing belongs with copy/allocation integration; leave its omitted-page compatibility intact here.
- No second wiki and no change to Docker/runtime architecture. Docker is only the existing development environment.

## Required tests

Tests must exercise production methods and assert exact identities, not merely the presence of a canvas or a nonempty array. Remove an explicit page argument temporarily and show that at least one new negative test fails; restore it before reporting.

**Core fixtures before publication is updated:** use the existing two-page `tests/fixtures/assets/test-multipage.pdf`. Publish two distinct document-wide layer sets, `Alpha` and `Beta`, with annotations only on page 1 of Alpha and page 2 of Beta. These are two sets on the same PDF, not two names for pages of one set. The old publication gate still forbids repeated labels within a snapshot; do not bypass it or weaken it to make this packet's fixtures. J112A's pure tests already exercise pages 1 and 3 of one same-name PDF set; the coordinated publication packet adds its native end-to-end coverage.

| Test | Required evidence |
| --- | --- |
| Explicit PDF page | `Beta` with `page=2` selects Beta's page-2 surface. `Beta` with `page=1` or omitted page never substitutes page 2. `Alpha` with omitted page selects its page-1 record. Refused results contain no legacy layer payload. |
| Occurrence order | Render the same file as Beta/page2, a plain embed, Alpha/page1, Beta/page2. Assert each actual image's binding and exact revision in order; a deduplicated parser metadata map alone cannot prove this. Include a template-expanded occurrence. |
| Default and repeated options | Compare selected surface to the page core rendered, including omitted `page=`, repeated page options and native malformed/out-of-range handling. Never silently choose a different valid page to avoid a failure. |
| Gallery | Verify named native-gallery and existing hint/Cargo paths use the effective thumbnail page. A default gallery page cannot select Beta's page 2. A gallery render of the same filename between ordinary embeds does not shift their queue. |
| Existing editor | A valid saved Alpha/page1 or Beta/page2 embed opens the matching `pageOwned.surfaceId`, layers and pinned rendition. Repeated identical embeds select the same existing surface; either exact saved occurrence can open it. Do not pass wrong-page tests by creating content. |
| Authorization/history | Retain foreign-owner, malformed selector, mixed raw/named selector, hidden revision, old-revision and revision-mismatch refusals. No latest fallback or permission data in shared parser output. |
| Legacy transition | Keep the pre-migration shared-set test, migrated two-files/template numbered-name test, gallery migration test and current show-intent behavior tests unchanged. Report any failure instead of deleting expectations. |
| Parse isolation | Every new per-parse state resets. Existing authoritative-null, template ordering, interleaved gallery and repeated-file unit cases still pass. |

## Verification commands and environment

Run from the extension checkout. Native tests use isolated core test tables in the existing `mediawiki-145` development container. Do not run two native suites or any browser write suites simultaneously on that wiki.

```powershell
php vendor/bin/phpunit --no-coverage -c phpunit.xml
php vendor/bin/phpcs -sp src/Hooks/WikitextHooks.php src/Hooks/BoundFileHooks.php src/Hooks/BoundSlideHooks.php src/Revision/PageOwnedPilot.php src/Revision/PageOwnedBindingOptions.php tests/phpunit/unit/Hooks/WikitextHooksTest.php tests/phpunit/core/BoundFileHooksTest.php
docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter 'BoundFileHooksTest|BoundSlideHooksTest|PageOwnedPilotTest|BareNamesAfterMigrationTest|CopyFromListTest|SourceRenditionsTest'
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

Add every changed PHP test/helper to the style check; include any new core class in the native run. After focused gates pass, run the full native suite and `npm test`, since parser hooks affect shared page behavior. Report exact totals, skips and failures. No browser writes are assigned here: the lead schedules browser acceptance serially after publication and migration integration. Native HTML assertions are required now; screenshots alone cannot replace them.

## Return to the lead

Append a report containing:

1. Changed files and the final queue/adapter flow, including how effective page and exact revision reach the resolver.
2. Every new test, the defect it catches, and the demonstrated failing case when page propagation is removed.
3. Actual commands, versions, totals, skips and failures. Distinguish standalone, native, and unrun browser evidence.
4. Any behavior that could not be preserved, with a concrete reproduction. Do not invent a fallback, hide an entry point, or widen scope to finish the packet.
5. Confirmation that no wiki configuration, ordinary owner-page content, migration record, public interface wording or unrelated file was changed. No commit or push unless separately requested.

**Done for junior review:** implementation and the listed automated evidence are returned. **Not done:** HIST-4 as a whole, PDF editing across all pages, naming migration, UI-10, owner screen acceptance or release readiness. The lead reviews the patch before recording acceptance and issuing the next packet.

## Junior implementation report - October 1, 2026

**Returned for lead review; not lead acceptance. Advances HIST-4 and preserves HIST-6/SEC-2.** Read the charter, approved behaviour brief and current handoff before implementation. The existing uncommitted J112A patch and documentation were preserved. Work remained on the existing `codex/l01-publication-admission` branch; no branch, commit or push was created.

### Changed files and final flow

- `src/Hooks/WikitextHooks.php`: queues an explicit deferred `['named' => reference, 'parser' => exactParser]` state per file occurrence. Absent selectors remain null, refused selectors false, and admitted raw bindings retain binding/revision identity. Plain occurrences still occupy slots. Core's image hook stages and consumes each occurrence once; thumbnail output consumes that staged occurrence, or the existing pending queue for direct callers. A new image render discards any stale staged occurrence left by a failed transform. All staged state resets at ParserClearState. Named lookup happens before markImage and cannot fall into shared-set rendering when refused.
- `src/Hooks/BoundFileHooks.php` and `src/Hooks/BoundSlideHooks.php`: pass optional sourcePage through the existing named adapters to J112A's frozen resolver. Owner, scope, exact parser revision and raw-binding admission remain unchanged. Deferred parser references live only in per-parse state; cached output contains binding/revision identities, not parser objects, layer data or reader permissions.
- `src/Revision/PageOwnedBindingOptions.php`: pure ordered-option helper defaults to page 1, accepts canonical positive integers and ignores malformed options like native PdfHandler. The last valid option wins. Named/show/hide interpretation is unchanged.
- `src/Revision/PageOwnedPilot.php`: existing-surface embedBinding passes that page explicitly. A canonical MediaWiki title/file lookup supplies the native page-count upper bound, matching core's ImageHandler normalization. This is only render-page selection: layers and rendition URLs still come from the caller-authorized exact saved revision and pinned source. No creation, allocation, copy, adoption or publication behavior changed.
- Tests: extended `tests/phpunit/unit/Hooks/WikitextHooksTest.php` and `tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php`; added `tests/phpunit/core/PdfPageRoutingTest.php` with real publication and the existing two-page PDF asset. This report is the only documentation edit made for J112B. `ThumbnailProcessor.php` has no final diff.

**Native boundary findings:** on MediaWiki 1.45.3, ImageBeforeProduceHTML runs before transformation and receives frame/handler parameter arrays; its final argument is a thumbnail-size preference, not the PDF page. Successful full-size and framed PDF images both pass through thumbnail output, so neither consumes its occurrence twice. Native ThumbnailImage has no getParams(); routing uses getParams() where supplied and otherwise extracts the page from MediaTransformOutput's public description-link attributes using parse_url/parse_str. No thumbnail-filename heuristic is used. Native gallery page=2 does render PDF page 2. A two-page PDF requested with page=3 is clamped to page 2 by core, and both reader routing and existing editor selection now follow that actual core page. The resolver itself never clamps or substitutes an unmatched stored page.

### Regression evidence

The native fixture publishes distinct document-wide sets Alpha and Beta, annotated only on PDF pages 1 and 2 respectively. Publication uniqueness is not relaxed, and labels/IDs are not rewritten.

| New test | Defect caught |
| --- | --- |
| Explicit/default PDF pages, framed and full-size | Beta/page2 binds beta; Beta/page1 and omitted page remain unbound; omitted Alpha binds alpha. Every actual image carries the exact expected revision and no legacy layer payload. |
| Template occurrence order | Beta/page2, plain same-file embed, Alpha/page1 and template-expanded Beta/page2 retain their individual image identities in order. |
| Repeated/malformed/native out-of-range options | Last valid option controls lookup; junk, zero, negative and leading-zero values match core's rendered default. Native page3 clamping is asserted from the image URL, not invented as a resolver fallback. |
| Native gallery interleaving | A same-file page2 gallery between ordinary embeds binds beta without shifting their queue; a default Alpha gallery binds alpha. |
| layers_hint gallery | Actual native gallery thumbnails on pages 1 and 2 respectively refuse/admit Beta. |
| Cargo gallery formatter | A test-only parser tag invokes the real CargoLayersGalleryFormat; its default-page Alpha gallery binds alpha, while Beta cannot substitute page2. Ordinary surrounding embeds retain their exact bindings. No Cargo table/query or production parser registration is added. |
| Existing editor and repeated saved occurrences | Alpha/page1, repeated Beta/page2 and core-clamped Beta/page3 open their matching stable surface IDs and pinned rendition URLs. Authorized viewer reads verify the saved layers; no newSurface is returned. Either exact saved Beta occurrence opens the same existing record. |
| Wrong-page editor | Beta with omitted page, explicit page1 or page2 followed by page1 offers no existing selection and refuses prepareBoundEditor, without creating content. |
| Exact old/hidden revision | Removing Beta later leaves the old revision's beta binding intact and the new revision unbound. The authorized viewer refuses hidden old layer content. Parser identity metadata is not a layer-data read; existing identity-only parser behavior is retained. |
| Unit page options and parse isolation | Eight option-provider cases cover default, ordering, malformed values and whitespace. Reset assertions include bindings, fetching parsers and staged occurrences; a separate image-hook test detects stale staging without advancing the ordinary queue. |

**Required mutation demonstrated:** temporarily omitted sourcePage in BoundFileHooks' call to BoundSlideHooks::named and ran `--filter testExplicitAndDefaultPagesNeverSubstituteTheOnlyStoredPage`. It failed **1 test / 5 assertions / 1 failure**: the page1 image incorrectly carried `v1:<owner>:beta` instead of an empty binding. Restored the argument and reran the required native group successfully. J112A's pure multi-page same-name tests remained untouched.

### Commands and results

Local runtime: **PHP 8.4.11, Node 24.20.0, npm 11.5.2, PHPUnit 9.6.36**. Native runtime: **MediaWiki 1.45.3, PHP 8.3.31, PHPUnit 9.6.36**, existing mediawiki-145 container. Git Bash requires php.exe to avoid its winpty alias and MSYS_NO_PATHCONV=1 to preserve Docker's working-directory paths. The first Docker invocation without that environment flag failed before PHPUnit started; no wiki operation occurred.

```bash
php.exe vendor/bin/phpunit --no-coverage -c phpunit.xml
php.exe vendor/bin/phpcs -sp src/Hooks/WikitextHooks.php src/Hooks/BoundFileHooks.php src/Hooks/BoundSlideHooks.php src/Revision/PageOwnedPilot.php src/Revision/PageOwnedBindingOptions.php tests/phpunit/unit/Hooks/WikitextHooksTest.php tests/phpunit/unit/Revision/PageOwnedBindingOptionsTest.php tests/phpunit/core/PdfPageRoutingTest.php tests/phpunit/core/BoundFileHooksTest.php
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml --filter 'PdfPageRoutingTest|BoundFileHooksTest|BoundSlideHooksTest|PageOwnedPilotTest|BareNamesAfterMigrationTest|CopyFromListTest|SourceRenditionsTest'
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html -w /var/www/html/extensions/Layers mediawiki-145 php vendor/bin/phpunit -c tests/phpunit/core.xml
node scripts/check-php-class-refs.js
node scripts/check-parallel-lists.js
node scripts/check-atomicity.js
node scripts/verify-docs.js
git diff --check
```

- Final standalone: **1,392 tests / 3,282 assertions / 1 existing skip**, zero failures/errors.
- Final focused native group: **64 tests / 859 assertions**, zero skips/failures/errors. Existing foreign-owner, malformed/mixed selectors, exact-revision admission, pre-migration shared sets, migrated numbered names/templates, galleries, show intents, copy and pinned-source tests pass unchanged.
- Full native: **469 tests / 3,893 assertions / 1 skip**, zero failures/errors. Native suites ran serially; no browser write suite was launched.
- `npm test`, run through the existing VS Code task: **206 Jest suites / 15,124 tests passed**, zero failures and zero snapshots. Grunt lint/style/banana and all subsequent consistency, compatibility, size and emoji gates passed. The i18n checker reports **72 non-blocking unused-message declaration warnings**. Its coverage drift check reads existing coverage files; this run is not a fresh coverage measurement.
- Changed-file PHPCS: **9 files, zero errors/warnings**. PHPCBF was used only on the new test class to normalize its line endings. PHP references, parallel lists and atomicity checks passed. Documentation verification reports **76 maintained/policy documents and 53 historical records**. Final documentation/diff checks are rerun after this report is appended.
- Browser acceptance and screenshots: **not run**, as assigned. No claim is made for MediaWiki 1.44 or whole-PDF editing/publication acceptance.

### Preservation and handoff

No known behavior had to be removed or replaced, and no stop-gap was introduced. No wiki configuration, ordinary owner-page content, persistent migration record, public interface wording, UI asset, manifest, schema or unrelated file was changed. MigrationState changes in the native fixtures use isolated test tables and are cleared on teardown. No migration or reconciliation command was run. Existing owner/lead work, including J112A, is preserved.

The lead should review the native API adaptation and editor page-count normalization as part of this patch. This returns J112B's bounded implementation and automated evidence only. HIST-4 as a whole, multi-page publication/creation/rename integration, naming migration, UI-10, browser acceptance, owner screen approval and release readiness remain outside this completion claim.

## Senior review and corrections — October 1, 2026

Advances **HIST-4**, preserving HIST-6 and SEC-2. The lead inspected every production change, the native render-hook implementation on MediaWiki 1.45.3, the editor admission path and the junior's mutation evidence. The initial focused rerun passed **64 tests / 859 assertions**, but two additional native cases exposed defects not covered by that suite:

1. **Editor page-option parity.** Native `page 2` rendered Beta's page 2 correctly, while `prepareBoundEditor()` refused it because the new helper recognized only `page=2`. The first regression failed with `layers-editor-unavailable` after **8 assertions**. The helper now receives MediaWiki's `img_page` magic-word matcher from `PageOwnedPilot`, retaining pure ordered positive-integer validation and the native page-count bound. Five native cases verify English space syntax, German space/equals syntax, last-valid-option ordering, and `page =2` remaining a caption rather than being misread as page 2. Each compares the actual rendered page and binding with the editor's exact surface. All five pass (**45 assertions**).
2. **Abandoned render state reaching a gallery.** An extension-generated fragment containing a failed PDF thumbnail followed by a separately rendered native gallery of the same file left the failed embed's staged binding in place. The following gallery lost its own Alpha binding. A control gallery passed, then the failure case failed after **10 assertions**. `BeforeParserFetchFileAndTitle` now clears abandoned staging for that filename before the next occurrence, including galleries that bypass the image hook. The native control and failure case now pass together (**1 test / 14 assertions**).

These are bounded implementation corrections within the approved packet, with no product-model or visible-interface decision. One layer set still has one name across its PDF pages. The lead preserved the junior implementation, J112A, compatibility branches and unrelated work. The delegated independent reviewer could not run because of a usage limit; this acceptance review is the lead's direct review, not a claimed second review.

**Lead acceptance:** no unresolved actionable defect was found within J112B's bounded scope after the two corrections. The final full native suite completed **475 tests / 3,955 assertions / 1 skip**, with no failures or errors, on MediaWiki 1.45.3 / PHP 8.3.31. The final standalone suite completed **1,392 tests / 3,282 assertions / 1 existing skip**, with no failures or errors. Changed-file PHPCS (8 files), PHP class references, parallel-list consistency, atomicity, documentation and diff checks pass. The option-fix focused native group passed **69 tests / 904 assertions** before the additional gallery regression was added. The junior's full JavaScript result (**15,124 tests / 206 suites**) is retained as reported evidence; no JavaScript changed during senior review and that suite has not been rerun by the lead in this review.

No commit, push, browser writes, ordinary wiki-content changes, configuration changes or persistent migration changes were made. Native fixtures use isolated test tables. This review does not complete HIST-4, whole-PDF publication/creation/rename, J113's naming transition, UI-10, MediaWiki 1.44 verification, browser acceptance or owner screen sign-off.
