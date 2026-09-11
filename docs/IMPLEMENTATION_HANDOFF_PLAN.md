# Layers implementation handoff plan

Prepared September 10, 2026 against `main` at `e03504ec` (manifest 1.5.95). Review update is on `codex/j05-exact-draft-cleanup` at `9819921f` plus local corrections; it is not yet merged to main.

This is the execution queue for the [product roadmap](../improvement_plan.md). It assigns bounded implementation work to junior engineers and retains architectural, authorization and data-migration decisions with the lead engineer. Tasks are **not started or assigned** merely because they appear here. No feature is enabled by this document.

Images, PDF annotations and standalone slides are equal content types. Slides are general-purpose canvases: presentations, diagrams, educational material, posters, dashboards and visual documents are all valid uses. No task may require SOP-specific fields or workflow.

## Start here

**Review update — September 10:** J01–J05 have been implemented and reviewed; corrections and remaining limits are recorded in [the junior implementation review](JUNIOR_IMPLEMENTATION_REVIEW.md). Give the next junior engineer **J16**, then **J17**, then **J18**. J18 can run independently in an isolated test environment. The lead resumes **L01**. The original task packets below remain context; do not reassign them as untouched work.

The main delivery order remains **revision history → native MediaWiki search → Cargo query/filter support**. Small current-behavior fixes do not substitute for that foundation. The lead should resume with L01, not start another broad feature.

### Assignment template

Copy this instruction together with the selected task packet:

> Implement task [ID] from docs/IMPLEMENTATION_HANDOFF_PLAN.md. Read its dependencies and linked contracts first. Confirm that dependencies have merged; otherwise report the missing dependency without guessing its design. Work only within this packet, use a codex/ branch, and submit one reviewable pull request. Exercise production behavior and include the commands, results and remaining limitations. Preserve unrelated changes. Do not enable page-owned publishing, migrate real data, change release numbers or publish documentation externally as part of this task. Update this plan's progress ledger with evidence, not just a completion claim.

Paths below are repository-relative. New files are explicitly described as proposed. For J16–J18, start from the reviewed corrections once committed on the current branch, or from main after those corrections merge. Do not branch from the older main checkpoint and lose J01–J05. For later work, start from the then-current merged base. A lead review is required before merging security, persistence or data-format changes. If a packet grows into a redesign, return the concrete problem to the lead and split the work before continuing.

## What already exists

The internal implementation includes a genuine MediaWiki revision writer, strict versioned document model, owner/revision access checks, exact local asset-version validation, publication service and experimental request boundary. Read these contracts instead of redesigning them:

- [History implementation and milestone evidence](PAGE_OWNED_HISTORY_IMPLEMENTATION.md).
- [Internal document format](PAGE_OWNED_DOCUMENT_FORMAT.md).
- [Experimental API contract](PAGE_OWNED_API_CONTRACT.md).
- [History, search and Cargo proposal](proposals/CARGO_SEARCH_PAGE_HISTORY.md).

**Existing user saves still use `layer_sets`.** The experimental endpoint and content model are not registered for production. Alternate save admission, historical viewers, migration and lifecycle acceptance remain incomplete. Existing Cargo gallery support in `src/Hooks/CargoHooks.php` and `src/Cargo/CargoLayersGalleryFormat.php` is not annotation-text indexing or field binding.

Previously recorded evidence at the baseline: 96 real-core tests / 244 assertions; standalone PHP 868 tests / 1,952 assertions / one existing skip; JavaScript 180 suites / 14,310 tests. These are historical results, not tests run when writing this plan. Core API tests use internal ApiMain dispatch, not HTTP/browser requests. Coverage, full browser acceptance and LTS parity are not established by these counts.

## Ordered queue and gates

Junior packets should normally fit one focused PR. Lead packets are milestones and may need several PRs; their outputs must make dependent junior work concrete before assignment.

| Order / ID | Owner | Deliverable | Dependency / assignment status |
| --- | --- | --- | --- |
| 1 J01 | Junior | Literal explicit set names (R6.09) | Reviewed and corrected; J17 follows |
| 2 J02 | Junior | Configured initial set name (R6.17) | Reviewed and corrected |
| 3 J03 | Junior | Slide creation rate limit (R6.14) | Reviewed; unit evidence |
| 4 J04 | Junior | Production rename regression tests (R6.15) | Reviewed; live acceptance remains J18 |
| 5 L01 | Lead | Alternate-path admission design and enforcement | Next lead task; independent of J01–J04 |
| 6 J05 | Junior | Identity-specific draft cleanup (R6.10) | Corrected; identity format remains J16 |
| 7 J06 | Junior | Source and transport acceptance fixtures | L01 test registration contract |
| 8 L02 | Lead | Historical read, asset delivery and controlled registration | L01 + J06; gate A |
| 9 J07 | Junior | Page-owned API client adapter | Gate A and frozen read/write response contracts |
| 10 J08 | Junior | Publish-state and conflict UI | J07 and lead-approved state diagram |
| 11 J09 | Junior | Historical viewer acceptance tests | L02 viewer adapter implemented by lead |
| 12 L03 | Lead | Ownership adoption, lifecycle and viewer integration | Gate A; incorporates J07–J09; gate B |
| 13 J10 | Junior | Adoption report and operator instructions | L03 migration/report contract |
| 14 J11 | Junior | Browser acceptance and release documentation | L03 + J08–J10; no public enablement |
| 15 L04 | Lead | History release decision and rollout | J11 evidence; gate C |
| 16 L05 | Lead | Search projection and visibility contract | Gate C; gate D for implementation |
| 17 J12 | Junior | Deterministic text extractor | Gate D |
| 18 J13 | Junior | Accessible text view | J12 + approved viewer output contract |
| 19 L06 | Lead | Search backend integration and invalidation | J12; gate E |
| 20 J14 | Junior | Search rebuild verification and user examples | Gate E |
| 21 L07 | Lead | Cargo projection and audience design | J14; gate F |
| 22 J15 | Junior | Cargo query examples and integration fixtures | Gate F and lead's adapter implementation |
| 23 L08 | Lead | Cargo rollout; separate binding proposal | J15; field bindings remain a later feature |

## Ready and bounded junior packets

### J01 — Honor explicit API set names literally

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Utility/SetNameResolver.php`, `src/Validation/SetNameSanitizer.php`; API tests under `tests/phpunit/unit/Api/` and resolver tests under `tests/phpunit/unit/Utility/`.

**Decision for this task:** explicit API identifiers are literal names; wikitext display switches keep their existing parsing. Do not introduce reserved names or migrate existing sets.

**Implement:** separate explicit-name resolution from display-intent parsing. Cover `on`, `off`, `all`, `true`, `false`, `1`, `0` and an ordinary name. Create another latest set and prove an explicitly named save updates only its intended target. Include image and standalone-slide API paths; cover PDF page identity where that path differs.

**Done when:** production save/load agree on the target, other sets are unchanged, omitted-name behavior remains tested, and wikitext switches still work. Do not globally change `isSpecificName()` semantics without checking its callers. Submit focused PHPUnit results and PHP QA.

### J02 — Respect the configured seed name

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Validation/SetNameSanitizer.php`, `src/Database/LayersDatabase.php` and corresponding API tests.

**Implement:** first unnamed saves use the existing validated `LayersDefaultSetName` configuration policy. Reuse its authoritative resolution rather than adding another hardcoded fallback. Preserve explicit names and existing-set selection. If invalid-configuration behavior is undefined, flag that decision to the lead instead of silently coercing it.

**Done when:** with configuration `annotations`, initial unnamed image and slide saves create that name; explicit names and subsequent saves retain their targets. Verify default configuration too. No database migration or global rename is needed.

### J03 — Apply creation limits to slides

**Read/change:** `src/Api/ApiLayersSave.php`, `src/Security/RateLimiter.php` and API guard tests.

**Implement:** apply the existing creation bucket to creation of a slide or a new named slide set; preserve the ordinary save limit. Existing-set updates must not consume the creation bucket merely because they are saves. Use the existing error mapping.

**Done when:** a denied creation bucket prevents persistence, allowed creation succeeds, and an existing-set update follows the save-only policy. Test the production route, not the presence of a rate-limit string. Do not alter global rate settings or the experimental publisher.

### J04 — Replace misleading rename tests

**Read/change:** `tests/phpunit/unit/Api/ApiLayersRenameValidationTest.php`, production rename API/validator, `tests/e2e/named-sets.spec.js`.

**Implement:** remove duplicated validation logic from test harnesses. Exercise production validation and rename execution, including Unicode/spaces and actual length boundaries. Browser tests must fail if required controls are absent and verify the persisted renamed set after reload.

**Done when:** a broken rename implementation fails the test; a missing button cannot produce a passing test. Keep fixtures isolated and make unavailable browser prerequisites explicit. If the production route reveals another defect, report it separately rather than expanding this test PR into a rename redesign.

### J05 — Clean drafts by the exact saved/discarded identity

**Read/change:** `resources/ext.layers.editor/DraftManager.js`, `APIManager.js`, `LayersEditor.js` and associated Jest tests.

**Implement:** permit explicit file/set/page identity when deleting a draft. Clear drafts for each successful buffered save and each explicitly discarded buffered entry; retain failed entries. A silent save must still perform persistence cleanup. Reuse existing key construction.

**Done when:** a save from a different displayed page, partial failure, full discard and editor restart each produce the correct recovery choices. Include same-page/different-set isolation, and slide/image behavior wherever supported. Do not delete drafts through broad storage-prefix clearing or clear a newer draft created while an earlier save is in flight; test that race using the existing draft identity/version mechanism or request a lead decision if none exists.

## Next junior batch after review

### J16 — Make draft identities unambiguous

**Ready now; first priority.** Read `resources/ext.layers.editor/DraftManager.js`, its recovery/load/clear methods, `LayersEditor.js`, and associated Jest tests. Existing keys collide for set `A B` versus `A_B`, Unicode names, and set `x-p2` on page 1 versus set `x` on page 2.

**Approved design:** use a versioned key containing an injective encoding of the complete tuple (wiki scope, user scope, original filename, original set name, normalized page). An encoded JSON array is suitable; lossy replacement or a truncated hash alone is not. Capture scope at manager creation. All write/read/cleanup paths must share the same encoder. Preserve original strings and version the storage key independently of the publication document schema.

For legacy lookup, check the stored payload's original file/set/page against the requested tuple before offering recovery or deletion. Ambiguous/missing identity must not be auto-deleted or applied to a different target. Define a visible recovery/report path for ambiguous legacy records. Write a successfully validated legacy recovery to the new key before any old-record cleanup; a quota failure must preserve the old data. Do not sweep all users' drafts. If the old format lacks wiki identity, do not infer ownership across wikis silently; document that limit and return any unresolved migration choice to the lead.

**Acceptance:** exact tuple collision cases, multiple users/wikis, restart recovery, save/discard isolation, legacy matching/mismatch, malformed legacy payload and quota failure. Retain the newly added exact-value buffered-save guard. Also audit foreground save cleanup for the same stale completion problem; if it needs changes to the full editor save state machine, report it for lead design rather than claiming all races fixed. One focused PR, no publication schema changes.

### J17 — Align mutation identifiers without silent rewriting

**After J16 for the default single-engineer queue; technically independent.** Inspect `ApiLayersRename.php`, `ApiLayersDelete.php`, `ApiLayersInfo.php`, and the corrected save/resolver behavior. The lead decision is that a supplied canonical set identifier is literal; malformed or noncanonical identifiers fail before mutation. Only documented omission/empty-name paths may resolve a target implicitly. Wikitext display switches are separate.

Add production-route tests first for stripping/truncation, empty/whitespace input, Unicode and `0`, with another set present to catch accidental redirection. Apply validation to both old and new rename identifiers and relevant delete scopes. Preserve documented omission behavior and do not reserve names. If normalizing read parameters disagrees with writes, return an explicit validation error rather than selecting another set. Reuse a small shared boundary helper if it eliminates duplicate policy; do not refactor unrelated APIs.

**Acceptance:** invalid requests produce no rename/delete/save call; valid names round-trip and retain scope across images, PDF pages and slides. Update the API reference and compatibility notes. This task is not an excuse to redesign valid Unicode naming or migrate stored sets.

### J18 — Prove the named-set workflow in a browser

**Ready independently in an isolated test wiki.** Read `tests/e2e/named-sets.spec.js` and the actual set-selector/dialog components. Use a disposable image fixture and test account; never rename a user's real set. Verify creation, save, rename and reload against persisted state. Required controls must have unconditional assertions. Replace outdated assumptions such as a permanently undeletable literal `default` set with the actual documented policy.

**Acceptance:** the test fails if a required control is removed or the rename does not persist; cleanup affects only test-owned sets; report the browser/MediaWiki version and exact command. If authentication/fixtures are unavailable, mark this task blocked rather than reporting a skipped suite as acceptance. Reuse current harness setup; no enabling experimental publishing.

## Lead-owned history work

### L01 — Close alternate publication paths

**Primary files:** `src/Revision/PagePublicationService.php`, `PageRevisionWriter.php`, `PageHistoryAccess.php`, the content handler under `src/Content/`, and `tests/phpunit/core/`.

Write an admission decision record before implementation. Installed MediaWiki inspection found that content `ValidationParams` lacks the original Authority and slot role, while `MultiContentSave` receives author UserIdentity rather than the original request Authority. Do not reconstruct unrestricted user authority from an author or assume the global request user represents a job or scoped API caller.

Evaluate a scoped publication context carrying the original Authority and exact owner/base/snapshot intent, checked at the core save hook. This is a candidate, not a settled API. Prove exception-safe cleanup, nested/repeated-save isolation, correct model/slot placement, creation, changed content and removal. An unrestricted boolean bypass is unacceptable.

Distinguish a new/changed/removed Layers slot from an unchanged inherited snapshot: ordinary main-only edits must not require fresh access to an unavailable historical source merely to retain old Layers content. Specify trusted import/restore paths explicitly; do not accidentally permit them or block all maintenance forever.

**Exit evidence:** direct unauthorized slot mutations fail without a revision; authorized writes still work; restricted Authority is not widened; ordinary edits preserve existing content; wrong-role/model insertion fails; stale/racing writes remain rejected. Update the implementation/API contracts with the tested boundary and remaining lifecycle limits.

### L02 — Read and asset delivery, then gate A

Define the exact owner/revision/surface read response and failure contract, including hidden revisions and inaccessible/missing assets. Implement permission-aware asset delivery and cache identity. Resolver metadata alone is not a historical file-retention or public-thumbnail security guarantee.

Decide supported sources and retention before claiming reproducible history: local archives can be deleted, PDFs require real page-count/render evidence, and foreign-file adoption needs an explicit support policy. Never silently fall back to current assets or a legacy set.

Register services, model, slot, admission hook and endpoint coherently only in controlled testing until acceptance passes. Separate disabling new writes from maintaining the ability to read already-stored historical content. Check supported MediaWiki versions explicitly; baseline tests only establish 1.45.3 behavior.

**Gate A:** lead signs off on admission, stable read/write contracts, HTTP authorization/CSRF tests, asset-delivery rules and reversible controlled enablement. J07 can then implement transport without inventing security semantics.

### L03 — Viewer integration, adoption and lifecycle; gate B

Lead implements owner/revision propagation and viewer adapters across inline viewing, lightbox and export. Cache keys and asynchronous callbacks must include the requested revision/surface/source identity; navigation cannot apply stale dimensions or annotations to a different surface.

Design copy versus adoption versus pinned reuse, stable owner identity across moves, and the relationship to legacy shared sets. Adoption must prevent old save/rename/delete routes becoming a second writable authority. An ordinary page containing a live shared reference cannot claim consumer-page revision immutability.

Specify transaction/conflict boundaries, dry-run reports, idempotency, recoverable failures and rollback before writing migration tools. Exercise move, delete/undelete, revision hiding/suppression, rollback/undo, import/export and asset loss. Restoring annotations must produce a new authorized revision without modifying the old record.

**Gate B:** lifecycle tests and mixed-surface historical rendering pass; migration has a tested recovery procedure; no orphaned dual authority. Unsupported operations are explicitly blocked/documented, not silently treated as complete.

### L04 — Gate C: history release decision

Review J11 and gates A/B, then decide staged rollout. Require genuine HTTP/browser evidence, backup/restore and upgrade/disable-write exercises, performance bounds and a stated support matrix. Verify user docs, wiki mirrors and `.mediawiki` publication sources agree. Distinguish repository edits from externally published documentation.

Only advertise the history guarantee for owner-bound published content and supported operations actually tested. Existing legacy shared content remains clearly identified. Release numbers, public feature enablement and publishing are separate lead actions, not junior task side effects.

## Junior history packets unlocked by lead work

### J06 — Real assets and HTTP acceptance fixtures

After L01 freezes the test-only registration setup, extend `tests/phpunit/core/` and test fixtures with small locally generated image/PDF assets; include a source-free slide. Synthetic hashes in `tests/fixtures/revisions/mixed-document-v1.json` are schema examples, not real files.

Exercise upload/replacement, exact archived source, missing bytes and invalid PDF page. Add HTTP cases for the experimental request contract using a disposable wiki/test registration: POST, GET rejection, CSRF, anonymous/unauthorized access, stale base and safe error body. Do not enable the endpoint on the normal development wiki to make tests pass.

**Done when:** fixtures reproduce cleanly, tests verify both response and revision effects, cleanup is limited to owned test data, and the report separates mock/core-dispatch/HTTP evidence. Harness architecture or new dependency installation decisions go to the lead.

### J07 — Client transport adapter

After gate A, add a separate adapter beside `resources/ext.layers.editor/APIManager.js` with Jest tests. The lead must provide the exact read response contract first; the existing experimental API contract defines publication, not an invented read endpoint.

Send explicit owner/base and one complete snapshot, use the MediaWiki token mechanism, and return the committed revision ID. Map documented errors into typed client results. Do not automatically retry an uncertain write, infer success from an empty response, or fall back to legacy saving. Test conflict, timeout, malformed response and no-op success. Keep editor wiring for J08.

### J08 — Publish-state UI

Lead first approves a state diagram covering clean, dirty, saving, success, conflict, denied and outcome-unknown, including edits made during an in-flight save. Wire J07 into that diagram using existing editor components; add localized English messages and `qqq` explanations.

**Done when:** unsaved work remains recoverable on every failure; a late success cannot mark newer edits clean; duplicate submission is controlled; published revision identity updates only on confirmed success; conflict recovery offers an explicit action. Test keyboard focus and status announcements. Do not implement automatic geometry merges or cross-owner publication.

### J09 — Historical viewer regression suite

After the lead's viewer adapter exists, test inline view, lightbox and export using two revisions with different text, geometry and backgrounds. Include image, multi-page PDF and source-free slides. Visit surfaces rapidly and revisit them after delayed source loads; assert annotation bounds and revision identity, not just screenshot existence.

**Done when:** an old revision never acquires current annotations/assets, denied/missing content has an explicit result, and stale asynchronous work cannot overwrite the selected surface. Source-delivery/security defects return to the lead. Export omissions must fail or remain explicitly identified according to the approved export contract.

### J10 — Adoption report and operator guide

After L03 defines the tool/report interface, implement only its read-only report presentation and documentation. Show each source set, intended owner, conflicts, unsupported assets and intended action using the lead's structured output. No writes in dry run. Avoid including private annotation content in ordinary logs.

**Done when:** fixture reports cover success, conflict, partial prior execution and unsupported inputs; instructions identify backup, dry run, execution, verification and recovery commands that actually exist. The lead retains migration writes, locking and rollback implementation.

### J11 — End-to-end acceptance and documentation

Run isolated browser scenarios for create/edit/publish/reopen, stale editor, historical view, restore, denied access and navigation, across all three surface types. Add required assertions to existing `tests/e2e/` rather than optional controls that can skip the behavior.

Update `docs/CURRENT_STATUS.md` and its exact `wiki/Current-Status.md` mirror, API/history guides, and affected `.mediawiki` sources. Use actual results and clearly label untested compatibility. Do not change release dates/version values or say GitHub wiki/mediawiki.org was published without verifying publication. Submit the evidence table for L04; passing tests alone do not authorize rollout.

## Search: contracts first, bounded implementation second

### L05 — Gate D: projection design

Choose and prove the MediaWiki indexing path on the supported backend. Determine whether indexing consumes a slot directly or requires an additional projection; do not rewrite user-authored main text implicitly. Define extraction of plain/rich text, callouts, hidden objects, groups, whitespace, Unicode, reading-order omissions, duplicates, length limits and stable result anchors. Hidden on-canvas visibility is not automatically a confidentiality policy.

Define what happens on protection changes, deletion, suppression, restoration and delayed/out-of-order indexing. Search snippets and direct links must not leak inaccessible content. Freeze extractor input/output and fixture expectations for J12. Reading order is separate from drawing stack order and optional instructional sequence.

### J12 — Pure text extractor

Implement a proposed new extractor and tests at the paths chosen by L05. No database, search backend, Cargo or external queries in this function. Consume validated snapshots and output deterministic ordered text plus owner-independent surface/layer anchors per the approved contract.

**Done when:** multilingual text, rich-text runs, callouts, empty text, groups, omitted reading-order entries and limits match reviewed fixture expectations. Include a presentation, diagram and annotated source document. Do not infer new schema fields or strip content by ad hoc regular expressions.

### J13 — Accessible text view

Use J12's projection through the lead-approved permission-checked viewer response. Provide an ordered text view and links back to annotations, preserve Unicode, escape output and support keyboard navigation. Test text-only malicious strings, empty surfaces and meaningful heading/focus behavior.

**Done when:** text and canvas describe the same requested revision, inaccessible content never appears in the DOM, and tests cover actual navigation. Do not add a separate unauthenticated projection endpoint.

### L06 — Gate E: search integration

Implement indexing and invalidation with retryable, idempotent updates tied to committed revisions. Stale jobs must not overwrite a newer projection. Prove search finds text present only in Layers, removes deleted/suppressed content as required by the supported backend's visibility model, and can rebuild from authoritative records. Define backend-specific limitations and result destinations; do not promise untested backend compatibility.

### J14 — Rebuild verification and examples

Using L06's approved rebuild tool, add isolated acceptance fixtures and operator instructions. Search for text only in an image label, PDF callout and slide presentation; edit/remove it and verify incremental and full rebuild results agree. Include interruption/retry and stale-job cases supplied by the lead.

**Done when:** each query reaches its intended surface and permission-negative cases match the approved backend contract. Report indexing delays honestly. Tool concurrency, authorization and destructive rebuild changes remain lead-owned.

## Cargo: queryable published annotations before live bindings

### L07 — Gate F: projection and audience contract

Inspect the installed Cargo version and existing gallery integration before choosing hooks/schema. Define records for owner, published revision, surface/layer identity, type and extracted text; optional structured fields require a versioned design. Decide current versus historical rows, deletion/suppression, rebuild ownership and stale-job handling.

Cargo query audiences can differ from page readers. Prove the chosen exposure policy or restrict/disable indexing where it cannot be enforced; filtering a result page after private data has entered an unrestricted table is insufficient. Implement the adapter and security-sensitive lifecycle hooks. Preserve the existing gallery behavior and operation without Cargo installed.

### J15 — Query examples and acceptance fixtures

After gate F and the adapter implementation, add tested query/filter examples for image labels, PDF callouts and general-purpose slide text, using only documented fields. Cover absent Cargo, empty results, publish/update/delete, rebuild and duplicate prevention with approved fixtures. Extend the relevant wiki/API guide without describing gallery hints as text indexing.

**Done when:** examples run against the stated Cargo version, results match the committed projection, and no unsupported permission guarantee is implied. Do not invent tables or change audience policy to get an example working.

### L08 — Cargo rollout and later bindings

Review projection evidence and operational recovery before enablement. Then write a separate binding design: restricted field selection, parameterized queries, failure states, type/length bounds, permissions, refresh review and snapshots of resolved values at publication. Historical views must not execute today's query and present its result as yesterday's content. A visibly identified live dashboard mode can be considered separately. Do not assign binding implementation within J15.

## Deferred defects and later product work

These remain visible but do not interrupt the history/search/Cargo order without a new lead triage decision. Consult [R6 findings](../codebase_review.md) for the original reproductions; confirm they still apply before coding.

| Work | Owner and next bounded action |
| --- | --- |
| R6.11 export completeness | Lead defines fail/degraded-output/cache metadata contract; junior can then add fault-injection tests. Never silently omit pages or annotations. |
| R6.12 export fidelity | Lead defines supported-property matrix and renderer strategy; junior prepares visual fixtures after that decision. Include backgrounds, rich text, rotation and gradients across supported outputs. |
| R6.13 foreign-file cache invalidation | Lead reviews backlink/permission/cache behavior; junior implements the narrowly approved fix with no-local-description-page regression. |
| R6.16 shipped dependency audit | Junior may inventory vendored runtime versions/build provenance now; lead chooses a blocking advisory policy. Final CI task must prove a simulated applicable advisory fails. No automatic dependency upgrade or claim of a new CVE. |
| Editor usability, collections and templates | After foundations, select one measured user problem per PR. Preserve blank-canvas use and optional structure. |
| Performance | Measure representative many-layer/many-surface workloads first; lead sets budgets, then assign specific cache/render/memory fixes. Avoid speculative broad rewrites. |

## Verification and handoff record

Use the repository's [testing guide](../wiki/Testing-Guide.md) and [contribution guide](../CONTRIBUTING.md). For a focused task run relevant tests plus applicable lint/guards; broaden testing for shared behavior. Do not rerun every suite for a Markdown-only change. Unit tests with stubs cannot prove real revision persistence or HTTP authorization.

Available entry points include `npm run test:js -- --runInBand <test-path>`, `php vendor/bin/phpunit --configuration phpunit.xml <test-path>`, `npm run check:docs` and `npm run check:version`. Core integration uses `tests/phpunit/core.xml` with the environment setup described in the testing guide. Some package Docker shortcuts name `mediawiki`; the current environment uses `mediawiki-145`, so inspect running containers rather than renaming them. Never run integration fixtures against production data.

Each PR should state: problem and resulting behavior; task ID/dependencies; actual test commands/results and environment; changed contract/docs; unresolved limits. A reviewer should be able to reproduce the decisive failure and success without reading the entire conversation. Record blocked work as blocked with a specific missing decision, not completed.

| Task IDs | Reviewed status (September 10, 2026) | Evidence / next action |
| --- | --- | --- |
| J01 | Reviewed with corrections | `6486046f`; invalid explicit names now rejected before resolution; see review record |
| J02 | Reviewed with corrections | `0ca2b3a4`; explicit configuration injection and failure propagation |
| J03 | Reviewed | `9b8a0d5e`; production-route unit tests pass; live concurrency not claimed |
| J04 | Unit work reviewed; browser acceptance pending | `be126dd6`; required button assertions strengthened; J18 remains |
| J05 | Partially complete after corrections | `9819921f`; buffered snapshot/draft races corrected; storage identity remains J16 |
| J16 | Complete on branch | `codex/j16-unambiguous-draft-identity`; injective v2 tuple encoding, safe legacy migration/quota fallback, user/wiki sweep isolation, foreground save audit documented |
| J17 | Ready after J16 in default queue | Remaining mutation identifier validation |
| J18 | Ready with isolated browser prerequisites | Live rename persistence and named-set test corrections |
| L01 | Next lead work; not implemented | Write and prove admission design |
| J06–J15, L02–L08 | Blocked on original dependencies | No production history enablement |

When completing a task, record its PR/commit and specific evidence here, then update the active history contract or feature guide as appropriate. This plan is the assignment queue; those contracts remain the authority for implemented behavior.
