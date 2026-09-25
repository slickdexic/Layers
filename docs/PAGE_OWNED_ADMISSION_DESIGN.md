# Page-owned publication admission: L01 decision record

## Authenticated HTTP history acceptance — September 20, 2026

The lead verified a fresh native MediaWiki startup with retained owners and publication disabled: the content model, importer wrapper, merge factory and paired merge API adapter were installed. A separate disposable SQLite wiki then passed real authenticated HTTP acceptance: two complete Layers publications created two core page-history revisions with the correct actor and summaries; exact reading returned the first saved snapshot after the second save; reads remained private/zero-age; a stale save failed without a third revision.

The reusable harness is `scripts/test-page-owned-http.py`. Run `python3 scripts/test-page-owned-http.py /path/to/mediawiki` with a native core checkout, PHP CLI with SQLite support and Python 3. It installs a temporary SQLite wiki with its own configuration, starts a loopback-only PHP test server, creates a temporary test administrator and removes its temporary files/process afterward. Credentials are generated locally and not printed. These are test-harness requirements, not Layers runtime dependencies. The existing wiki's configuration, accounts and database are not changed. Our invocation used the existing Docker test host; Docker is not needed by the extension or harness.

This is API/history acceptance on MediaWiki 1.45.3, not completed editor or historical-viewer acceptance, and not a guarantee for every supported core/database version. The public pilot remains disabled. Normal editor saves still use legacy storage. Priority remains page history first, searchable textbox/callout text second, Cargo text support third.

### Next lead work: R02 editor and historical-viewer integration

Connect a page-owned editing mode with an explicit immutable owner, base page revision and selected surface ID. Load through the exact revision reader; preserve the complete multi-surface snapshot through the accepted adapter. Route its save only through the publication client, with no fallback to legacy `layerssave` and no automatic publication retry. Advance the base revision only after a confirmed save; preserve edits made while the request is in flight. Conflicts and uncertain outcomes must retain the draft and require deliberate reconciliation. Keep legacy set/revision controls out of this mode because their IDs refer to a different storage system.

Historical viewing must use the requested page revision and remain read-only; it must never replace missing/denied history with the latest snapshot. Start acceptance with a general-purpose slide to avoid source-media delivery dependencies, then carry the same owner/revision contract to images and PDFs. Freeze actual controls and state transitions before handing J43 to juniors; J44 still needs a usable browser URL and reset instructions. No new junior assignment is ready yet.

## Native registration checkpoint — September 20, 2026

The extension now registers the default-off `layersread` and `layerspublish` APIs through its native registration callback and installs the MediaWikiServices bootstrap hook through the manifest. With no retained owners, no Layers content role or lifecycle wrappers are installed and core mergehistory remains unchanged. With retained owners, registration also installs the merge adapter; the service hook installs the paired guards even when publication is disabled. API name collisions reject before partial module installation.

Fresh native regression: **140 tests / 588 assertions passed** on MediaWiki 1.45.3 / PHP 8.3.31. Real localhost HTTP verifies module discovery, default-disabled reading, private zero-age read caching despite requested public cache ages, and native bad-token rejection. No page was published by these HTTP probes. Retained-owner fresh-process startup, authenticated HTTP publication/history and browser/editor integration still require acceptance; R01 is not complete.

Priority remains **page revision history, then searchable textbox/callout text, then Cargo text projection/binding**. All apply to images, PDFs and general-purpose slides. Docker is only the test host. Existing Cargo gallery formatting is not the requested annotation-text integration.

Normal editor saves still use legacy storage. Do not enable the experimental pilot as a production feature. The new `LayersPageOwnedPilotEnabled` setting defaults false; `LayersPageOwnedPilotOwners` defaults empty. Retained owner keys must not be removed while current or archived pilot revisions exist. Earlier unregistered/unchanged-manifest checkpoints below are historical, superseded by this entry.

## Native bootstrap composition — September 19, 2026

`PageOwnedPilotRegistration` implements the native MediaWikiServices hook. With retained owners it installs lazy manipulators for ContentHandlerFactory, SlotRoleRegistry, both native import services and MergeHistoryFactory, and registers MultiContentSave, PageUndelete and MovePageIsValidMove callbacks using the shared pilot service. The non-derived Layers slot is hidden from default slot display. Empty owner scope installs none of these components; disabling APIs does not remove retained-owner protection.

`apiModules()` supplies the publish/read factories and the merge adapter definition. Initial registration must install these definitions alongside the service hook before dependent services initialize. The hook intentionally avoids eagerly constructing the pilot or dependent services during container setup. This class is not registered in the manifest yet; it is not an administrator enablement recipe.

Bootstrap tests now publish/read through this composition without the manual registration helper and verify disabled retained/empty scope behavior. Native regression: **128 tests / 512 assertions passed**. J48 extends installed-boundary acceptance; lead owns initial startup, registration conflicts/order, configuration failure handling, supported-version and HTTP verification. Public editor saves remain legacy; no browser pilot is ready.

## Controlled merge API denial — September 19, 2026

J47 demonstrated that the factory's original ErrorPageError was classified as an internal API failure and included a trace when ShowExceptionDetails was enabled. The factory now throws the dedicated `PageOwnedMergeDenied` (a localized ErrorPageError subtype). The unregistered `ApiLayersMergeHistory` adapter delegates to core and catches only that denial, issuing controlled `layers-admission-unauthorized` via dieWithError. Unexpected errors retain core behavior. Page consumers retain the localized exception.

Bootstrap must wire both the merge factory decorator and the merge API adapter; factory-only wiring does not complete the API error contract. Core dispatch and formatter tests verify denial invariants, safe error code/no trace under both debug settings, ordinary merges, bad tokens and missing permissions. HTTP response headers, real Special:MergeHistory output and other supported core versions remain unverified.


## Pilot merge factory restriction — September 19, 2026

`PageOwnedPilotMergeFactory` decorates the native `MergeHistoryFactory`. It checks both source and destination against retained exact owner keys before asking the inner factory for a command. A pilot match throws core's localized `ErrorPageError` using the fixed admission message; an unrelated operation delegates all four arguments unchanged. `PageOwnedPilot::wrapMergeFactory` composes this protection from the same owner list regardless of the API enable flag.

Direct native tests verify rejected source/destination merges leave revision ownership unchanged and an unrelated merge actually succeeds. Focused result: 4 tests / 7 assertions including the harness safeguard. The test composition uses disabled APIs to verify retained protection. The factory remains unregistered for normal requests. J47 will verify internal merge API dispatch and classify error presentation; actual HTTP/Special-page behavior is not yet accepted.

This protects consumers of the decorated public factory, including the inspected core API/special-page paths. Direct construction or other extensions using the underlying page-command factory require separate review. It is a pilot veto, not supported history merging of page-owned Layers documents.


## Shared native service composition — September 14, 2026

The lazy `LayersPageOwnedPilot` service in `services.php` owns a `PageOwnedPilot` composition. Internal configuration inputs are `LayersPageOwnedPilotEnabled` (boolean, absent defaults false) and `LayersPageOwnedPilotOwners` (array of exact canonical local prefixed DB keys, absent defaults empty). These are preparation for controlled registration, not supported administrator settings or an invitation to manually enable a pilot.

One captured list feeds both API factories, move/restore guards and importer wrappers; one publication context feeds the publisher and save-admission hook. An API-disabled composition still constructs protection for retained owners. Malformed types/keys fail construction. Composition does not register a content model, slot, API, hook or importer override; full bootstrap wiring must install them together before enablement. The service itself is available through native extension wiring and introduces no runtime dependency beyond MediaWiki.

Integration evidence: composed API publication creates two real revisions; exact reading returns the older snapshot. Both APIs reject disabled/empty/outside scope, and disabled composition retains move/import protection. Native history regression passes 112 tests / 454 assertions. HTTP, history-merge protection and complete bootstrap acceptance remain outstanding.


## Native rollback verification — September 14, 2026

The existing save-admission hook was verified through core `rollbackIfAllowed`, using two real authors and actual owner revisions. Rollback to a pre-adoption revision rejects slot removal; rollback to a different snapshot rejects unauthorized replacement. Both leave the current revision and main text intact and insert no revision. A main-text-only rollback with unchanged Layers content succeeds, creates a new revision and preserves the snapshot.

Fresh focused result: **4 tests / 18 assertions passed** (three rollback cases plus the test harness safeguard), PHP style clean. No runtime change was necessary. This is pilot behavior: authorized user-facing restoration of an older Layers snapshot still needs an explicit publication workflow. HTTP rollback UI, undo, merge-history and other core versions are not covered by these tests. All pilot registration remains internal; normal editor saves still use legacy storage.


## R01 pilot move restriction — September 14, 2026

The unregistered `PageOwnedPilotLifecycleHooks` now also implements native `MovePageIsValidMoveHook`. A move rejects with a fatal admission error when either source or destination is an exact configured pilot owner key. This prevents a pilot page escaping its name-based API/import/restore scope, and prevents an unrelated page taking a reserved pilot name. Unrelated moves remain allowed. This is a temporary pilot restriction, not the final owner-binding behavior for production page moves.

Real-core tests invoke `moveIfAllowed` and inspect the persisted page identity: source-scoped and destination-scoped moves reject; an unrelated move succeeds. Combined move/restore verification: **8 tests / 27 assertions passed** on MediaWiki 1.45.3. PHP style passes. Normal hook registration remains absent. Subpage/talk/file move workflows, title reuse, merge-history, rollback and supported-version acceptance still require review; the simple move tests do not establish those cases.


## R01 native import restriction — September 13, 2026

MediaWiki 1.45's `ImportableOldRevisionImporter` inserts pages and revisions directly; `MultiContentSave` is not an admission boundary for this path. `PageOwnedPilotImporter` now decorates the native `OldRevisionImporter` interface. Before invoking the original importer it rejects exact pilot owner keys, the `layers` role under any owner/model, and the `layers-document` model under any role. Ordinary imports delegate to core unchanged. Rejection throws a fixed `layers-admission-unauthorized` exception rather than returning the duplicate/skip result.

Test-only wiring wraps both `OldRevisionImporter` and `WikiRevisionOldRevisionImporterNoUpdates` on MediaWiki 1.45. Tests invoke `WikiRevision::importOldRevision()` through each native service mode: ordinary imports succeed; pilot creation, imports into existing pilot pages, foreign-model Layers slots and Layers content in the main slot reject before insertion. Existing pilot latest revisions and slots remain intact; rejected imports add neither pages nor historical revisions.

Fresh native API/admission/publication/writer/restore/import regression: **96 tests / 405 assertions passed**. PHP style, class-reference and compatibility checks pass.

The decorator remains unregistered for normal requests. Shared configuration/service decoration, XML/HTTP import error presentation, other supported core versions, direct importer construction by other extensions, moved owner names and file-upload import remain unverified. These are explicit limits, not a claim of complete import/export support. The guard must be registered before exposing the pilot and remain active when publication is disabled. No host process or Docker runtime is involved.


## R01 pilot restore restriction — September 13, 2026

`PageOwnedPilotLifecycleHooks` implements core `PageUndeleteHook`, currently registered only in isolated tests. It rejects restoration of exact configured pilot owner keys with fatal `layers-admission-unauthorized` and returns false, as required by core. The restriction covers every revision selection for those page names, including pre-adoption revisions; it does not inspect archive contents or purport to implement production restore. Unrelated page names continue normally. The guard has no write-enable flag; eventual registration must keep it active for the retained owner scope when publishing is disabled.

Real-core tests publish/delete a Layers revision, complete deferred deletion, and attempt full and selected-timestamp restore through `undeleteIfAllowed`. Denied revisions remain in archive and absent from live revision rows; equivalent ordinary-page restores succeed with a different pilot owner configured. Fresh native regression selection: 85 tests / 370 assertions. These tests do not cover file-version restoration, associated talk pages, moved pilot names, suppression or HTTP UI.

This is a bounded pilot veto, not completion of R01. Shared scope/registration, import admission and remaining lifecycle cases must be resolved before normal API enablement. Production restoration preserving the owner/history rules remains later release work. No Docker or supervisor runtime is involved.


September 11, 2026. **Internal PageUpdater admission accepted after review; production registration remains blocked.** Reviewed against Layers manifest 1.5.95 and installed MediaWiki 1.45.3 source. The experimental publisher, content model and slot remain unregistered for production. Existing editor saves still use `layer_sets`.

This records the lead's chosen boundary for L01. The [history implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) controls milestone completion; the [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md) controls assignments. Images, PDF annotations and general-purpose slides use the same admission policy. A slide needs no backing file or SOP-specific workflow.

## Problem and decision

The internal publication service checks the caller's authority, owner, explicit base revision, document schema and exact sources. Registering the content model without a second boundary would let another save route submit a valid document without going through those checks. Schema validation alone does not establish permission to publish.

Use a request-local, single-use publication scope around the revision writer, matched by a `MultiContentSave` admission hook. Only the publication service may open this scope after its final authorization check. Ordinary edits retaining the exact inherited Layers content pass without a publication scope. New, replaced or removed Layers content must be classified explicitly; removal is initially unsupported and denied.

This is an integration boundary for trusted MediaWiki code, not protection from malicious PHP extensions or direct database writes. Other installed hooks can run afterward; compatible hook ordering and alternate persistence paths must be tested before public registration. Do not claim that one hook covers import or undelete paths that do not call it.

## Core evidence and constraints

Read directly from the running installation under `/var/www/html/includes/`:

| Core source | Consequence |
| --- | --- |
| `content/ValidationParams.php` | Contains page identity, flags and parent revision ID; no original Authority or slot role. Keep content-handler validation structural. |
| `Storage/Hook/MultiContentSaveHook.php` | Receives a rendered proposed revision, author `UserIdentity`, summary, flags and failure status. The author is not the original caller's Authority. |
| `Storage/PageUpdater.php` | Captures the parent, prepares content and invokes `MultiContentSave` before creating/modifying the page; other save hooks follow. Inherited slots are present in the proposed revision. |
| `Revision/RenderedRevision.php` | `getRevision()` exposes the proposed revision. It has not yet acquired its final committed revision identity. |

Never reconstruct unrestricted user authority from the author, use a global request user for a job, or treat a rendering audience as publication authorization. The writer's existing primary-parent comparison and core conflict detection remain mandatory. A matching scope is not a substitute for concurrency checks. These observations establish the 1.45.3 design baseline; supported-version parity remains unproven.

## Scope contract

Implemented components are `src/Revision/PublicationAdmissionIntent.php`, `src/Revision/PublicationAdmissionContext.php`, and `src/Hooks/PageOwnedAdmissionHooks.php`. The context is service-instance state, never a static flag, client parameter, persisted token or user preference. Its only write entry point is a callback-scoped operation used by `PagePublicationService`.

The immutable intent contains:

- The original Authority and expected revision-author identity, without widening rights.
- The owner page identity: existing page ID plus namespace/database title; for creation, namespace/database title and base zero. Do not match only a display title.
- The explicit parent revision ID and permitted action (add or replace the `layers` role).
- The expected model and canonical Layers content, compared exactly or through a collision-resistant digest of canonical bytes with model/role bound separately.
- Expected changes to other slots, including the exact core-prepared text for an optional wikitext main-slot replacement. An unrelated or additional slot mutation cannot borrow the scope.

The writer captures the primary parent, installs the requested slots and calls core `PageUpdater::prepareUpdate()` once. The publication callback checks the prepared Layers bytes against the already validated canonical snapshot, performs final owner authorization once, and captures the prepared main text. It opens the scope only around commit of that same updater. Core `saveRevision()` reuses the prepared update, including its transformed text. The hook matches the complete proposed save, consumes the scope once on admission and fails closed on mismatch. Close it in `finally`, including failed saves, exceptions and no-ops. Initially reject nested publication scopes explicitly; supporting nesting is unnecessary for one atomic owner-page publication. A retry must repeat validation and open a fresh scope.

An unchanged Layers save must not consume a scope intended for a different mutation. If the intended publication itself is a no-op, scope cleanup still happens even if core skips a hook or creates no revision. Tests must cover both paths. Do not put authority objects, document JSON, tokens or private source details in admission logs.

## Classification and admission rules

Compare the proposed slots with the exact captured parent belonging to the same owner. Use an internal parent read only for classification; never return privileged parent content or hidden-source details to the caller. Parent lookup failures fail safely where classification cannot be established. Do not use a replica's latest revision as the parent.

| Proposed change | Initial behavior |
| --- | --- |
| Neither parent nor proposed revision contains the Layers role/model | Leave core behavior unchanged. Avoid source resolution or Layers authorization work. |
| Same Layers role, model and exact serialized content inherited; only main/other ordinary slots change | Allow normal core save processing without fresh `editlayers` or source checks. Retaining old annotations must not depend on old asset availability. |
| Add or change Layers content | Require the matching, unconsumed service scope and correct role/model placement. Structural validation and core conflict checks still apply. |
| Remove Layers role, replace it with a foreign model, or put the Layers model in another role | Deny initially, including through an otherwise authorized service scope. |
| Creation with Layers | Require base zero, exact target identity, expected main content and admitted snapshot. |
| Undo, rollback, import, maintenance or restore attempts that change Layers | No implicit bypass based on username, bot/sysop status or edit flags. A future explicit adapter must authorize a new publication. |

Use exact stored content equality for the unchanged fast path, not only a document ID, layer count or source hash. Canonical formatting changes count as a replacement if stored bytes change. Existing malformed/wrong-role content has no sanctioned production history yet; repair policy is deferred, not a hidden bypass. Schema validation may independently reject invalid inherited content.

Source-free slides follow the same owner/base checks. For changed image/PDF content the existing resolver must verify exact local source versions; J06 phase 1 now verifies real two-page PDF bounds in the isolated harness. This does not promise retained bytes, historical rendering or safe delivery; those remain L02/lifecycle work.

## Failure behavior and lifecycle limits

Reject through a fatal hook status without committing any slot or advancing the owner revision. Add a localized, generic admission failure message and explicit publication-service error mapping. Do not report every denial as an edit conflict or expose internal exception text. A real parent conflict keeps its existing conflict meaning. Test responses and database effects together.

## Core save route inventory and enablement blockers (J26)

Inspected installed MediaWiki 1.45.3 source files directly under `/var/www/html/includes/` on container `mediawiki-145` (PHP 8.3.31). Class existence is not routing evidence; each path below was inspected at concrete call sites. These are source-inspection conclusions, not executed web/API/lifecycle acceptance results:

| Operation | Source file and method | Relevant call chain | Hook status & consequence |
| --- | --- | --- | --- |
| **Web edit** | `includes/editpage/EditPage.php` (`internalAttemptSave`, line 2552) | Web UI / `SpecialEditPage` -> `EditPage::attemptSave()` -> `EditPage::internalAttemptSave()` -> `PageUpdater::saveRevision()` | **Source inspection: hook reached on this save path.** `MultiContentSaveHook` executes. Denials stop save, set fatal hook status, and return `EditPage::AS_HOOK_ERROR`. |
| **API edit** | `includes/api/ApiEditPage.php` (`execute`, line 526) | `api.php?action=edit` -> `ApiEditPage::execute()` -> `EditPage::attemptSave()` -> `EditPage::internalAttemptSave()` -> `PageUpdater::saveRevision()` | **Source inspection: hook reached on this save path.** `MultiContentSaveHook` executes. Hook denials return structured API failure (`AS_HOOK_ERROR`). |
| **Rollback** | `includes/page/RollbackPage.php` (`rollback`, line 299) | `Special:Rollback` / `ApiRollback` -> `RollbackPage::rollback()` -> `PageUpdater::saveRevision()` | **Source inspection: hook reached on this save path.** `MultiContentSaveHook` executes. Unadmitted Layers slot mutation or removal fails closed. |
| **Undo** | `includes/editpage/EditPage.php` (`getUndoContent`, line 1663; `internalAttemptSave`, line 2552) | Web undo / `ApiEditPage` undo -> merges `SlotRecord::MAIN` only; inherits unchanged slots via `PageUpdater::saveRevision()` | **Source inspection: hook reached on this save path.** Inherited unchanged `layers` slot passes via fast-path; any attempted mutation/removal of `layers` fails closed. |
| **XML import** | `includes/import/ImportableOldRevisionImporter.php` (`import`, insertion at line 174) | `Special:Import` / `ApiImport` / `importDump.php` -> `WikiImporter::importRevision()` -> `ImportableOldRevisionImporter::import()` -> `RevisionStore::insertRevisionOn()` | **BYPASSES PageUpdater and MultiContentSaveHook.** Direct revision insert to DB. **Enablement blocker** requiring L03 adapters. |
| **Undelete** | `includes/page/UndeletePage.php` (`undeleteRevisions`, line 606) | `Special:Undelete` / `ApiUndelete` -> `UndeletePage::undeleteRevisions()` -> `RevisionStore::insertRevisionOn()` | **BYPASSES PageUpdater and MultiContentSaveHook.** Direct revision insert from archive. **Enablement blocker** requiring L03 adapters. |

### Reproducible read-only inspection steps

Inspect the concrete call sites directly in the running MediaWiki container without modifying state:
- Web edit: `docker exec mediawiki-145 grep -n -C 3 'saveRevision' /var/www/html/includes/editpage/EditPage.php`
- API edit: `docker exec mediawiki-145 grep -n -C 3 'attemptSave' /var/www/html/includes/api/ApiEditPage.php`
- Rollback: `docker exec mediawiki-145 grep -n -C 3 'saveRevision' /var/www/html/includes/page/RollbackPage.php`
- Undo: `docker exec mediawiki-145 grep -n -C 3 'getUndoContent' /var/www/html/includes/editpage/EditPage.php`
- XML import: `docker exec mediawiki-145 grep -n -C 3 'insertRevisionOn' /var/www/html/includes/import/ImportableOldRevisionImporter.php`
- Undelete: `docker exec mediawiki-145 grep -n -C 3 'insertRevisionOn' /var/www/html/includes/page/UndeletePage.php`

Direct revision-store paths (`ImportableOldRevisionImporter`, `UndeletePage`) do not invoke `PageUpdater` or `MultiContentSaveHook`. They are explicitly classified as **enablement blockers** that must have dedicated L03 lifecycle adapters or policy prohibition before page-owned publication is registered in production.

## Ordered implementation and review gates

1. **L01a, lead:** implement scope lifecycle and hook classification, including exact parent/owner matching, one-use intent and safe status mapping. Integrate only with the internal service and isolated test registration. Inventory bypassing core routes; document unresolved lifecycle gates. *(Accepted internally after prepared-main correction)*
2. **L01b, lead:** prove the security matrix below against real core revisions, including scoped Authority and concurrent writes. Correct the architecture if the hook cannot bind the complete planned save. Freeze the test registration helper and safe fixture teardown contract. *(Accepted for the internal 1.45.3 PageUpdater boundary; 114 tests / 424 assertions)*
3. **J06, junior, only after L01b:** implement the existing real-image/PDF/slide and HTTP fixture packet using the frozen harness. No new permission policy, live-wiki registration or source-retention design. Return unexpected core behavior to the lead. *(Phase 1 accepted with corrections; phase 2 requires lead disposable HTTP setup)*
4. **L02, lead:** historical read/asset delivery and controlled enablement. Public history remains blocked until the later ownership/lifecycle and release gates also pass.

J06 phase 1 is accepted using the reviewed test-only registration helper; its corrected real fixtures extend the earlier synthetic evidence. J27 is next for archived PDF geometry. Real source evidence remains distinct from the synthetic metadata used in J25. Lead owns the disposable HTTP transport setup before J06 phase 2 and the L02 historical delivery contract.

## Real-core acceptance matrix and L01 evidence

Fresh lead verification: **114 core tests / 424 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. All tests pass with 0 errors and 0 failures. See the [review record](JUNIOR_IMPLEMENTATION_REVIEW.md).

Verified in J25:
1. **Actual failed parent lookup** (`testFailedExactParentLookupFailsClosed`): Injected `RevisionLookup` returns `null` for parent; save fails closed at hook boundary (`layers-admission-unauthorized`, reason `parent_lookup_failed`); zero revision advance; slot models/bytes preserved; scope cleared.
2. **Inherited image/PDF snapshot with unavailable resolver** (`testInheritedImagePdfSnapshotPreservedWithoutSourceResolver`): Image and PDF surfaces with synthetic source metadata preserved across ordinary main-only edit; `SourceVersionResolver::resolve()` never invoked; attempting Layers mutation while resolver is unavailable fails before hook (`layers-source-unavailable`).
3. **Admission-enabled race after parent capture** (`testConcurrentWinnerAfterParentCaptureWithAdmissionEnabled`): Loser `PageUpdater` captures parent CAS token; intervening winner commits revision; loser attempts save inside active scope; hook validates parent, but core's `PageUpdater` CAS fails with `edit-conflict` after hook; winner preserved; loser creates no revision; scope cleared.
4. **No-op scope cleanup and out-of-scope mutation denial** (`testNoOpScopeCleanupFollowedByDeniedMutation`): No-op publication does not advance revision ID; scope cleaned up; subsequent direct `PageUpdater` replace and removal denied at hook boundary (`layers-admission-unauthorized`, `layers-slot-removal-denied`); zero database mutations.

Prepared-main binding is now implemented through the same core updater's cached `PreparedUpdate`. New tests verify real substitution/signature expansion runs once, revocation during preparation prevents publication, and tampering after preparation is rejected without a revision. Existing scoped-Authority tests continue to pass with final write authorization performed once per action.

**L01 accepted internally on MediaWiki 1.45.3; `TestingAdmissionRegistration` is frozen for the J06 core-fixture contract.** The helper registers only in isolated tests and returns the shared context, hook and publisher; optional resolver injection remains supported. Production registration remains off. Import/undelete adapters, historical asset delivery, HTTP evidence, other-version compatibility and lifecycle acceptance remain later gates.

J06 phase 1 review: corrected asset fixtures and strengthened real-source tests bring the full core suite to **121 tests / 515 assertions**. See the [fixture provenance and reproducibility instructions](../tests/fixtures/assets/README.md) and [review](JUNIOR_IMPLEMENTATION_REVIEW.md). Existing 114-test L01 results above are the earlier admission checkpoint, not the latest full count.
