# Page-owned Layers history: implementation contract

## Direct source rewrite implemented and independently reviewed — September 25, 2026

Lead implemented internal DirectEmbeddingRewriter for a conservative raw-wikitext subset. It records complete top-level literal file/slide spans with UTF-8 byte offsets and ordered raw options, distinguishes repeated identical embeds, excludes nested/template/comment/opaque-tag content, and requires exact original bytes and start position before replacement. It replaces one legacy selector with a canonical binding (or appends one if absent), retaining all other bytes. Duplicate selectors, already-bound targets, control bytes, malformed nesting and unsupported source structures reject.

Delegated adversarial review found an opaque-tag name-prefix defect (nowiki-x/ref:custom recognized as approved tags). Lead tightened the delimiter and added regressions, plus mixed nesting, quoted slashes and comment-contained closers. Fresh combined source-rewriter/binding verification passed **123 unit tests / 283 assertions**. Native namespace/filename normalization passed **2 tests / 6 assertions** including the harness check. Changed PHP style, references (92 classes) and compatibility checks pass.

**Explicit initial limits:** selected captions/options must be literal without nested markup. Unknown HTML containers and single-bracket/external-link syntax cause whole-page refusal; opaque tag support is allowlisted. This is conservative manipulation, not full MediaWiki parsing or evidence that every scanner candidate corresponds to the native rendered embed. Native Title normalization is supplied by a trusted caller; owner/source permissions remain separate. No parser hooks/public routes changed.

**Next remains lead-owned:** tie exact source span and normalized target/PDF page/set to the exact legacy revision, prepare the bound main text from the authorized base, and invoke atomic adoption only after rendering gates. J64/J65 remain blocked; delegated review in this turn is complete. No ordinary page-history testing readiness or commit/push is claimed. No user wiki data/configuration changed. Docker remains only the test host.

## Exact source preparation reviewed and verified — September 25, 2026

Resumed and reviewed the interrupted delegated LegacyMediaResolver work. Corrected its PNG fixture expectation from 200x100 to the documented 1x1 and added integrated image-preparation coverage. The resolver now supplies exact authorized source metadata and selected-page dimensions through the existing SourceVersionResolver; it checks MIME, refuses invalid/oversized geometry, never scales coordinates and never derives upload time from the annotation timestamp. Native tests resolve archived PDF page two after a replacement upload and reject hash/time/page/MIME/permission mismatches with fixed errors.

Lead connected LegacyAdoptionPreparationService: authorize owner PageID/base before reading any legacy row, read only the explicit legacy revision ID, resolve media where applicable, generate a new surface ID, perform strict conversion and recheck owner/base after potentially slow storage/media work. Slides require no file. It returns a server-prepared proposal, never saves, and must not trust a proposal returned through the browser. A missing/pruned revision cannot fall back to latest.

Fresh combined native regression passed **80 tests / 407 assertions** across media resolution, preparation, atomic adoption, publication, PageID preflight, API publication and admission. Tests include exact image preparation, unchanged owner revision during preparation, denial before legacy lookup, missing exact revision and intervening main-text conflict. Changed PHP style, references (91 classes) and compatibility checks passed. No browser acceptance is claimed here.

The delegated source-span audit found no existing raw-source walker suitable for adoption: current image handling uses expanded text/occurrence queues and slide arguments lose duplicate/source-span information. **Next lead task is the conservative direct-embedding source scanner/rewrite**, preserving exact bytes and rejecting ambiguous/template-generated targets. Public exposure also remains gated on rendering support and ordinary editor integration. J64/J65 remain blocked. No user wiki content/configuration, runtime registration, commit or push changed. Docker is only the test host; the original wiki remains the manual testing environment.

## Exact legacy capture and structural conversion implemented — September 24, 2026

Lead delegated a read-only storage/geometry audit and a bounded exact-row reader, then reviewed the implementation. LayersDatabase::getLayerSetForAdoption now reads the selected row ID from the primary database without cache/latest fallback, retains raw JSON bytes and includes filename/hash/MIME/page/revision metadata. Missing, non-string and oversized rows reject. This is an internal data primitive with no authority of its own; callers must authorize owner/source before use or exposure.

Lead implemented LegacySurfaceConverter against that raw-record contract. It checks exact envelope fields and metadata consistency, rejects duplicate JSON keys, copies layer values without sanitizing them, preserves set name as label, emits no invented reading order, and strictly validates the one-surface output. Slides retain stored dimensions/background. Images/PDFs require independently supplied exact source metadata and page geometry matching the row's filename/hash/page; file-version timestamp never comes from annotation save time. Oversized canvases and lossy/unknown data reject without scaling or stripping.

Fresh verification: **81 tests / 240 assertions** across database and converter suites, including all eight J62 stored rows, source mismatches, false/zero data, duplicate JSON keys, byte limits, selected PDF pages and oversized slides. Changed PHP style, references (89 classes) and compatibility checks passed. These are unit/structural tests; no new native/browser acceptance is claimed in this checkpoint.

**Next is lead-owned:** authorize and resolve the exact media version/geometry, prepare syntax-aware direct-embedding edits, and connect the reader/converter to the atomic adoption transaction with rendering gates. Converter success is not permission to adopt unrenderable groups/resources or media. Image/PDF white-background composition still requires visual parity. J64/J65 remain blocked; bounded delegated work in this turn is complete. No public registration, user-page/configuration changes or commit/push. Original-wiki manual testing and Docker-only-as-test-host rules remain unchanged.

## Atomic prepared-surface adoption connected — September 24, 2026

Lead added internal PageOwnedAdoptionService::publishPreparedSurface, connecting PageID edit preflight to expected-PageID publication. It reads the authoritative base revision, requires visible wikitext main content, loads the existing Layers snapshot from that revision (or starts an empty document before first adoption), validates exactly one proposed surface, rejects duplicate identity, appends without replacing existing surfaces, validates aggregate limits, and publishes the snapshot and prepared main text together. It never accepts replacement copies of existing surfaces from the caller.

Fresh native regression passed **71 tests / 337 assertions** across adoption, publication, identity, API publication and admission. Tests verify first/second appends, unchanged older snapshots and retained drawing data, actor/page/parent identity, and rejection of duplicate IDs, empty additions, stale bases and unresolved image sources without changing either slot. Changed PHP style, references (88 classes) and compatibility checks pass.

**Boundary:** this is an internal transaction component for trusted server-prepared data, not the complete legacy adoption workflow. It does not yet resolve a legacy row, prove an embedding source span, generate a surface ID, or enforce rendering availability. A future caller must perform those checks before invoking it; raw client main text is not proof of a valid binding. No public registration or user-page changes occurred. Ordinary image/PDF adoption remains unavailable.

**Next lead work:** immutable legacy selection/conversion and syntax-aware direct-embedding edits, followed by pinned source delivery and ordinary editor wiring. J64/J65 remain blocked until real integration callbacks exist. No commit/push or new manual-testing invitation. Docker remains solely the test environment.

## Expected PageID enforced by publication — September 24, 2026

Lead extended PagePublicationService::publish with an optional final expectedPageId argument for the upcoming binding-based workflow. When supplied, it requires an existing positive supported-range owner and nonzero base revision; checks current title identity before source work and after source preparation; then checks both the current title and the actual prepared page's ID/namespace/key before granting publication admission. Native revision compare-and-swap, authority checks and atomic main/Layers slot saving remain intact. Existing title-based callers remain compatible and do not yet supply this new argument; this is not public PageID routing or completed adoption.

Fresh native regression passed **65 tests / 311 assertions** across publication, identity preflight, API publication and admission. Added tests cover bound two-slot publication/no-op, wrong identity rejection before source work, forbidden bound-page creation, a real move during source preparation preserving the moved page and old-title redirect, and an injected mismatched prepared page that never reaches the commit callback. Changed PHP style, references (87 classes) and compatibility checks pass.

**Next remains lead-owned:** connect identity resolution and this mandatory expected ID in the adoption service, implement exact direct-embedding source edits, and deliver pinned image/PDF sources before exposing adoption. Do not remove lifecycle guards or expose an unrenderable snapshot. J64/J65 remain blocked. Ordinary embedded Layers saves still do not create owner-page history; there is no new user testing invitation or commit/push readiness. No wiki configuration, user content, manifest or runtime routing was changed. Docker remains only the test environment.

## B01 binding boundary implemented; J63 ready — September 24, 2026

Lead froze an internal separate layersbinding value, v1:<pageId>:<surfaceId>, and implemented PageOwnedBinding::parse. It preserves case-sensitive drawing identity and rejects malformed/coerced/oversized input with fixed errors. Parsing proves syntax only, never page existence or authority. It is not registered or connected to ordinary embeds yet. The binding plan now specifies native revision context, PageID route/draft migration, move/copy behavior and the requirement to replace title-based guards together.

Fresh verification: **31 tests / 63 assertions** passed for the binding boundary; changed PHP style, class references (85 extension classes) and compatibility checks passed. No browser/runtime change is claimed. Existing image/PDF/slide editing still needs adoption and ordinary-path integration.

**Junior J63 is ready** for the ordered-option adapter using the frozen value parser; the exact interface, conflict rules, allowed files and tests are at the top of the [handoff plan](../docs/IMPLEMENTATION_HANDOFF_PLAN.md). Lead retains native parser/source-span integration, PageID authority/lifecycle and atomic adoption. J64/J65 remain blocked. No commit/push occurred. Docker is only the test host; manual acceptance remains on the original wiki.

## Current direction: ordinary page-owned drawings — September 23, 2026

**User acceptance exposed the missing integration:** editing File:ImageTest02.jpg on DeleteMe004 still uses shared Layers storage and creates no DeleteMe004 revision. The slide pilot is not completion of the requested feature. The approved next milestone is explicit PageID-backed ownership, safe adoption of existing annotations and the normal embedding/edit/save/old-revision workflow for images, PDFs and general-purpose slides.

The [page ownership implementation plan](PAGE_OWNED_BINDING_PLAN.md) defines identity, atomic adoption, move/copy behavior, source pinning, implementation order and acceptance gates. Ownership uses native PageID plus stable surface identity; names are labels. Adoption copies an exact shared revision and commits the embedding binding and complete snapshot in one native page revision. Existing shared sets are preserved. Proposed ownership=page syntax is not implemented or available for use yet.

**Junior J62 is ready** for synthetic conversion fixtures and a loss/compatibility matrix. Lead B01/B02 retain the binding contract, title-to-PageID transition and atomic adoption. J63–J65 are explicitly blocked until their lead interfaces exist; see the handoff plan. Current title-scoped move guards and slide-only editor admission must be addressed, not bypassed. No ordinary image/PDF history readiness or commit/push readiness is claimed. The original wiki remains the manual testing environment. History first, searchable text second, Cargo third.

## Stable native editor entry — September 23, 2026

The registered editor route now accepts explicit `revid=current` alongside owner and surface. The shared pilot validates owner scope and the original authority, resolves the current page revision, then performs the same exact snapshot/source authorization as a numbered editor request. Bootstrap always contains a concrete numeric base revision. Missing, malformed and stale numeric revisions are not silently replaced. Exact historical reads/viewing remain unchanged. A concurrent publication can still produce a controlled conflict; this entry does not merge or retry writes.

Native verification passed 27 tests / 335 assertions across the editor entry and pilot suites. The original localhost:8080 wiki now has two bounded owners: Layers_history_test for manual work and Layers_browser_acceptance for automation. A native wiki page links to the stable current-editor entry; no alternate wiki or wrapper script is needed. See CURRENT_STATUS.md for the latest browser acceptance result. Earlier paragraphs describe earlier checkpoints.

## Guarded editor entry — September 20, 2026

**Superseded September 29, 2026 (D2):** drawings in page history are on by default; the pilot switch and owner lists are retired in favour of `$wgLayersPageDrawingNamespaces` (see the [configuration reference](../wiki/Configuration-Reference.md)). The text below records the pilot. `Special:EditLayersPage` is registered but page-owned editing remains disabled by default. It requires LayersPageOwnedPilotEnabled, an exact retained owner entry in LayersPageOwnedPilotOwners, a registered user authorized to read/edit/editlayers, an existing Layers slot and a selected slide surface in the explicit current revision. Supply owner, revid and surface query parameters; no default/latest fallback or automatic creation is provided. Responses are not cacheable. Asset-backed surfaces, migration and historical viewing are not enabled by this entry. Do not enable it for production; see the current handoff/status for browser acceptance gates. Docker is not required by this route.

**R01 implementation update:** a default-off, owner-scoped exact-revision read API now reuses the native history reader. Real core tests verify older slide content, hidden/wrong-owner rejection and safe responses; full result is 351 tests / 2,557 assertions / one existing skip. Registration, lifecycle admission and actual HTTP/editor/viewer wiring remain unfinished. See the [read boundary](PAGE_OWNED_READ_CONTRACT.md#r01-exact-revision-api-boundary--september-13-2026). This is extension work; no container supervisor is involved.

**Current delivery plan — September 13, 2026:** follow the [MediaWiki-native recovery plan](IMPLEMENTATION_HANDOFF_PLAN.md#active-recovery-plan--mediawiki-native-revision-history). Lead R01 implements guarded native registration/read/lifecycle admission; J42 builds the unregistered publish client; lead R02 integrates the first complete slide history/editor/viewer path. Images/PDFs, adoption and full lifecycle release gates follow. The container-supervisor direction is abandoned and supplies no feature dependency. Earlier milestones below remain evidence records, not current assignments.

**September 12 continuation:** internal `PageAssetService::prepare()` now binds raster preparation to an exact authorized owner/revision/surface and rechecks revision visibility and all sources after rendering. See the [delivery contract](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md) for the implemented boundary and remaining gates. This is not an HTTP endpoint or production enablement; resource/configuration and lifecycle work remains lead-owned. Earlier checkpoint notes below retain their historical scope.

Updated September 10, 2026. Feature status: **not available to users**. H1 provides an internal, core-tested persistence primitive; H2 adds strict snapshot validation and a custom content model tested at the core save boundary. H3a adds an internal owner-permission and exact-revision access boundary; H3b adds exact local source-version validation. H3c connects these components in an internal publication service; H3d adds a tested, unregistered request boundary. No public endpoint, slot registration, editor change, adoption or migration is enabled. Existing Layers saves still use `layer_sets` and do not meet the page-history guarantee.

This document is the implementation tracker for revision history. It supersedes SOP-specific framing in earlier proposals. Images, PDF annotations and general-purpose slides are equal participants. Presentations, diagrams, educational material, visual documents and SOPs are acceptance examples; none defines the universal data model.

L01 internal PageUpdater admission and J06 phase 1 real-source fixtures are accepted with lead corrections. Fresh core tests pass 121 tests / 515 assertions. Current/archived image bytes, real PDF page-count bounds, source-free slides and preservation after actual source loss are verified in isolated core tests. J27 extends archived PDF geometry evidence; public registration, HTTP transport, historical delivery and lifecycle gates remain open. See the [admission record](PAGE_OWNED_ADMISSION_DESIGN.md).

L02 internal exact-revision reading was added September 12; [read contract](PAGE_OWNED_READ_CONTRACT.md). The full core suite now passes 125 tests / 618 assertions. Authorized asset delivery, caching, HTTP and lifecycle gates remain open; this does not close gate A.

J28 reader acceptance is complete (130 core tests / 663 assertions). The [private asset delivery design](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md) now defines lead L02a/L02b and the later junior acceptance gate. Rendering/delivery implementation is still pending.

L02a now has an internal private raster renderer and real handler/cleanup evidence (132 core tests / 717 assertions). J29a extends acceptance; L02b authorization, budgets/configuration, HTTP and lifecycle gates remain pending. See the [renderer contract](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md).

## User testing checkpoint — not ready yet (September 12)

Current public editor saves still use `layer_sets`; they do not add owner-page revisions. The internal writer, admission checks, exact-revision reader, source validation and private renderer have core-test evidence. The experimental API still needs guarded MediaWiki registration, actual HTTP/editor/viewer integration and lifecycle protection. The abandoned supervisor work is not a prerequisite. Automated internal tests are not a user-testing release.

The first planned browser checkpoint is an **isolated page-owned slide pilot**, followed by images and multi-page PDFs before broader acceptance. Source-free slides let the first pilot exercise revision behavior without treating source rendering as complete. Slides remain universal canvases, not an SOP-specific feature. This is a proposed scope reduction for early feedback, not permission to register the production feature or bypass admission/lifecycle guards.

Before inviting the user, the lead must provide a disposable test wiki/page, controlled registration limited to that environment, working save/read transport and editor/viewer wiring, and protection against alternate save/import/undelete and legacy mutation paths affecting adopted content. Unsupported operations must be blocked explicitly. Main production registration stays disabled. The lead will supply the exact URL and supported/blocked operations when this exists; no test URL is available yet.

The user acceptance script will be:

1. Create a slide with a textbox and callout; publish and verify one new owner-page revision.
2. Change text, geometry and ordering; publish and verify a distinct revision.
3. Open the earlier revision and confirm its original text and layout remain unchanged after refresh.
4. Open two editors on the same base; save one, then verify the stale editor cannot overwrite it and retains its work.
5. Verify denied access and unsupported mutation routes cannot silently change revision-controlled content.
6. In the later asset checkpoint, repeat history/navigation checks with an image and a multi-page PDF, including source replacement and old-revision access.

Restoration, adoption/migration and full lifecycle acceptance remain separate release gates even after this pilot. The testing invitation must state any remaining restrictions explicitly.

## Outcome and non-negotiable invariants

For assignment order and bounded junior-engineer tasks, use the [implementation handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md). This document remains the authority for the history implementation and its evidence; planned assignments do not change milestone status.

1. Published owner-page Layers content exists only as part of a committed MediaWiki revision.
2. One owner-page editing session publishes its changed surfaces and any corresponding main-slot changes together.
3. Every historical render resolves the requested revision and its pinned assets. Missing/inaccessible content fails explicitly; it never falls back to latest.
4. Both a stale client base and an intervening concurrent write are rejected without losing the winning revision.
5. Permission checks apply to the owning page, relevant source assets and revision visibility. A caller-supplied owner identifier is not authority.
6. Adopted content cannot be mutated through legacy save, rename or delete routes. A migration must not leave two writable authorities.
7. Indexing, Cargo projections, caches and derived exports are rebuildable from committed revision data. Their failure cannot publish uncommitted content.
8. A normal content slot is required. A derived slot is unsuitable because its changes do not participate in normal revision history.

## Decisions and limits

| Decision | Reason / consequence |
| --- | --- |
| One `layers` slot per owner page | Store an ordered collection, not a globally registered slot for every image or slide |
| Normal, non-derived slot | Slot edits must affect page revision identity and history |
| MediaWiki revision is authoritative | Do not depend on prunable legacy rows for historical content |
| Stable IDs separate from display names | Renaming/reordering must not break references |
| Reject stale bases initially | Silent geometry merging is not safe; explicit conflict resolution comes later |
| Exact source versions | Replacing an uploaded image/PDF must not silently alter an older annotation snapshot |
| Pin or copy reusable content for revision-controlled pages | A live shared reference cannot promise an unchanged consumer-page history |
| No new public save route during H1 | Core PageUpdater does not itself authorize edits; schema and authority checks are release gates |
| Incremental adoption | Existing shared content continues until an explicit, verified migration is available |

MediaWiki's installed `Storage/PageUpdater.php` documents that `grabParentRevision()` captures a primary-database compare-and-swap token, while `saveRevision()` rejects changes after that capture. It also explicitly states that it does not check user permissions. `setOriginalRevisionId()` identifies restored content; it is not a client edit-conflict guard. Those distinctions govern the adapter design. See [MCR documentation](https://www.mediawiki.org/wiki/Multi-Content_Revisions) for background.

## Document contract — H2 internal version 1

The owner comes from the MediaWiki page/revision, not an editable JSON field. A slot contains a schema version and an ordered collection of stable documents/surfaces. Each surface records its stable ID, kind, label, dimensions, layer data, background settings and reading order where provided. Image/PDF surfaces also record the source file identity, immutable version reference and PDF page number where applicable. Slides do not require a fabricated file attachment.

The [internal version 1 format](PAGE_OWNED_DOCUMENT_FORMAT.md) now defines required/optional properties, strict rejection, numeric/resource bounds, source metadata, stable references and canonical serialization. Its mixed-surface fixture is separate from H1's synthetic storage records. Source resolution, retention, legacy import and future migrations remain explicit later gates. Render order, reading order and optional step numbering are separate concepts.

Cargo values/bindings and reusable components need versioned extension points. No live query is permitted to rewrite an old revision's displayed value. A live dashboard mode, if added, needs a visibly different contract.

## Save sequence for the eventual authorized service

1. Resolve owner page and document; verify the actor's Layers and ordinary page editing rights, blocks/protection and source-file access. Creation must check page-creation authority too.
2. Enforce CSRF, POST, rate, size and complexity limits at the public API boundary. Validate the complete requested snapshot, not only a delta that can bypass validation.
3. Create a fresh PageUpdater for the correct owner and actor. Capture the parent revision before deriving changes from it.
4. Compare the captured revision ID with the client's explicit base (zero only for creation); reject a mismatch.
5. Set the validated Layers slot and any intended main-slot changes. Preserve other slots. New pages require main-slot content in the same save.
6. Commit through PageUpdater. Core's compare-and-swap protects the interval between parent capture and insertion. Distinguish a successful no-op from an error.
7. Return the authoritative revision ID only after success; schedule retryable secondary work. Preserve unsaved client work on errors.

The server response must ultimately distinguish stale-base conflict, commit-time conflict, permission failure, invalid content and operational failure. H1 uses internal exceptions; a stable localized API error mapping belongs to H3. Do not expose raw exception details.

## Milestones and gates

| Milestone | Scope | Acceptance / status |
| --- | --- | --- |
| H1: core persistence proof | Internal writer, genuine core/database tests, no public registration | Implemented; detailed evidence below |
| H2: content model | Versioned schema, strict whole-document validation, canonicalization and custom content model | Internal implementation tested; direct core saves reject invalid snapshots. Production model/normal-slot registration deferred until H3 authority checks are ready |
| H3: authorized service/API | Owner resolution, read/edit/create authority, CSRF, limits, base revision, stable error mapping, suppression-safe historical reads | In progress: H3a/H3b access/source gates and H3c publication service tested internally; request boundary tested internally; L01 alternate-path admission enforced and core-verified; production registration and further source/lifecycle acceptance pending |
| H4: editor and historical viewer | Owner/revision context across editor, inline view, lightbox and export; stable IDs and pinned assets | Pending; oldid works for images, PDFs and slides with no latest-state fallback |
| H5: adoption and lifecycle | Copy/adopt/pin workflow, legacy-route isolation, move/delete/undelete/rollback/suppression/import/export and repair tooling | Pending; one authority and round-trip recovery proven |
| H6: release readiness | Browser and operational tests, feature flag, upgrade/rollback documentation, support matrix, staged rollout | Pending; no compliance claim until all required gates pass |

Search follows this foundation and must be tested against the supported search backend. Cargo indexing follows search. A text projection can be committed alongside the Layers slot when the chosen search approach requires it; H1's combined-slot primitive supports that without claiming search exists.

## H1 implementation

`src/Revision/PageRevisionWriter.php` is an internal persistence primitive. It accepts a fresh PageUpdater, an expected base revision, already-validated Content, a summary and optional main-slot content. It is not registered as a service, endpoint or hook and does not register the `layers` role. Only the core tests register that role, as non-derived JSON with hidden output, in their isolated service container.

The primitive rejects negative/stale bases, requires main content for new pages, preserves untouched slots, checks core save success and returns the committed revision or unchanged parent for a no-op. A late core conflict reports failure. The eventual authorized service must supply every missing permission/validation boundary; calling this internal primitive directly is not an authorized publication workflow.

Tests use core JsonContent rather than a provisional custom model. MediaWiki normalizes JSON formatting during save, so comparisons of newly constructed versus stored fixtures compare decoded content. This normalization must be accounted for when designing canonicalization and no-op behavior.

## H1 verification evidence

On the local MediaWiki **1.45.3**, PHP **8.3.31** runtime, the real core integration harness passed **8 tests / 21 assertions** (seven writer scenarios plus the harness's database-prefix safeguard). This is separate from the repository's standalone stub suite.

| Scenario | Evidence |
| --- | --- |
| Create owner and Layers content | Main and Layers slots written in the first genuine revision |
| Layers-only edit | New revision and correct parent, author and summary; main text preserved |
| Historical read and restoration | Reload older revision by ID with user-aware content access; restore its content in a new revision; intervening snapshot remains unchanged |
| Stale client base | Rejected before the write |
| Concurrent change after parent capture | Rejected by core; winning revision and content remain current |
| Identical content | Successful no-op returns the same revision ID |
| Combined main/Layers edit | Both changed slots belong to one revision |
| Missing main on creation / negative base | Rejected arguments |

Repository validation also passed: standalone PHPUnit 802 tests / 1,878 assertions / one existing skip; `npm test` 180 suites / 14,310 JavaScript tests and repository guards; PHP lint/style/MinusX and documentation/version checks. No coverage percentage was measured.

Several checks share one test method. Fixtures mention all three surface kinds but do not exercise real asset retrieval, layer sanitization, drawing or rendering. User-aware historical content access is exercised for a normal visible revision; suppression and denied-read cases are not yet covered. The race is a deterministic interleaving of two real updaters, not a multi-process load test. Recent Changes/watchlist visibility, arbitrary third-slot preservation and full core rollback UI remain later acceptance work.

### Reproducing core tests

Use a disposable development wiki with MediaWiki's test files/dependencies and database test-table permissions. Never run these against a production wiki. The core harness isolates test tables; this suite must not use the extension's lightweight standalone bootstrap.

```sh
MW_INSTALL_PATH=/path/to/mediawiki php vendor/bin/phpunit -c tests/phpunit/core.xml
```

If core test helpers are installed separately, `LAYERS_CORE_TEST_AUTOLOAD` may point to their Composer autoloader. In the local container the missing helpers were installed under `/tmp/layers-core-test-deps`, leaving production dependencies and LocalSettings unchanged:

```sh
mkdir -p /tmp/layers-core-test-deps
cd /tmp/layers-core-test-deps
composer require --no-interaction --no-plugins --no-scripts \
  wikimedia/testing-access-wrapper:^4.0 hamcrest/hamcrest-php:^2.0 \
  wmde/hamcrest-html-matchers:^1.0
```

Resolved versions for this run: testing-access-wrapper 4.0.0, hamcrest-php 2.1.1, hamcrest-html-matchers 1.1.0. The initial core test run stopped because a helper was missing; no placeholder implementation was substituted. The runtime image did not have its own PHPUnit executable, so the extension's installed PHPUnit 9.6.36 was used with core bootstrapping.

## H2 implementation and verification

The [format contract](PAGE_OWNED_DOCUMENT_FORMAT.md) documents the internal schema, examples, limits, loss prevention and source-retention gates. `DocumentSchema` rejects malformed/ambiguous snapshots; `JsonSnapshotCodec` produces deterministic JSON; `LayersDocumentContent` and its handler enforce validation at core save time. The existing layer validator accepts optional fixed limits; existing no-argument callers retain their configured behavior. Model and normal-slot registration occur only inside core tests.

Verification on September 6, 2026:

- Snapshot unit tests: **66 tests / 74 assertions**, covering all three surface kinds, count boundaries, invalid/lossy fields, identity/group/reading references, duplicate keys and numeric overflow.
- Full standalone PHP suite: **868 tests / 1,952 assertions / one existing skip**.
- Combined real-core H1/H2 suite on MediaWiki **1.45.3 / PHP 8.3.31**: **19 tests / 49 assertions**, including the per-class database-prefix safeguards. H2 adds typed snapshot round trips, canonical no-ops, fixed limits and direct invalid-save rejection. A generic JsonContent object claiming the model ID is also rejected.

Repository QA also passed: `npm test` (180 suites / 14,310 JavaScript tests and repository guards), PHP lint/style/MinusX, and documentation/version checks. PHP style reports two existing duplicate test-stub warnings; no new coverage percentage was measured.

These tests do not establish authorization, source existence/retention, suppression behavior, actual rendering or import compatibility for every legacy drawing type. H2 does not wire the schema into existing API saves. A structural source reference is not evidence that asset bytes have been retained. See the format contract for the policy and remaining work.

## H3a: owner authorization and historical snapshot access

Implemented September 7, 2026 in `src/Revision/PageHistoryAccess.php`, without production service/endpoint registration. This is one part of H3, not a complete authorized save service.

`assertCanEdit()` requires a title that can represent a local page, ordinary read access, `editlayers`, and the ordinary `edit` action. It uses Authority's authorization methods rather than UI-oriented permission hints. For an absent owner, it also requires `createpage` or `createtalk` as appropriate. Owner existence is refreshed from the primary database. A future save service must call this immediately before publication with the same owner and actor supplied to the writer; the helper does not itself write or eliminate all permission-change races.

`read()` requires an explicit positive revision ID and owner read access before looking up revision data. It refreshes owner identity and the requested revision from the primary database, verifies that the revision belongs to that owner, and requires a valid typed Layers snapshot. It never substitutes the current revision or legacy content. The returned value contains snapshot content only, not revision author/comment metadata whose visibility needs separate checks.

The stored revision visibility bitfield is checked explicitly, followed by core's user-aware content access. This also rejects inconsistent current revisions with hidden text flags, even though core normally prevents hiding the current revision and optimizes away that check. Missing, wrong-owner, hidden, unsupported and invalid snapshot requests share the internal `layers-revision-unavailable` error; edit denials use `layers-owner-edit-denied`. These are not yet localized public API errors. Operational storage exceptions still require mapping at the future request boundary.

### Verification and limits

The combined real-core suite passed **41 tests / 94 assertions** on MediaWiki **1.45.3 / PHP 8.3.31**. H3a contributes 22 tests including the harness safeguard. Coverage includes:

- Required read/edit/Layers rights, new-page and talk-page creation rights.
- A protected owner and a real database block denying an otherwise eligible editor.
- Exact historical content after a later revision, and no fallback for another owner's revision, a missing revision, an absent owner or a revision without a Layers slot.
- Ordinary readers denied hidden/suppressed historical content, while a reviewer with `deletedtext` can read ordinary hidden text.
- Denied read access performing no revision lookup (an Authority/lookup mock verifies call order).
- Defensive denial of an inconsistent current revision carrying hidden text flags.

Standalone PHPUnit also passed (868 tests / 1,952 assertions / one existing skip), along with PHP syntax/style/file-mode checks, PHP reference/compatibility guards, and documentation/version checks. PHP style retains two existing duplicate test-stub warnings. JavaScript tests were not rerun for this PHP-only internal change; the H2 result above remains dated evidence.

The visibility fixtures update isolated test-table flags; they do not exercise the RevisionDelete UI, log visibility, full suppression/undelete lifecycle or concurrent suppression. The absent-owner case uses a nonexistent page, not an actual deletion workflow. Page-move/restore races, partial blocks, cascading protection, restricted tokens, privileged suppressed-content reads and the 1.44 runtime remain additional acceptance work. Source-file existence, permission, version retention and PDF page validity are **not** established by this helper. Request controls (CSRF/POST/rate limits), combined publication orchestration, historical rendering and adoption remain pending.

## H3b: exact local source-version validation

Implemented September 7, 2026 in `src/Revision/SourceVersionResolver.php`. This remains an internal publication gate, not a registered service, API or historical renderer. It accepts a schema-valid complete snapshot and an Authority, returning resolved server-side File objects keyed by surface ID. Slides produce no file lookup and require no fabricated attachment. Image/PDF sources each undergo:

1. Canonical local File-title parsing (`File:` plus MediaWiki DB-key spelling, including underscores), followed by source-page read authorization before lookup.
2. LocalRepo lookup with the exact timestamp, redirects disabled and latest metadata requested. No foreign repository search or private-file option is used.
3. Verification of the returned repository, filename, timestamp and stored SHA-1, and rejection of invisible/deleted file content.
4. Physical backend existence checking, since a database file row alone does not prove bytes are present.
5. PDF MIME type and an available integer page count sufficient for the requested page; image media type must be BITMAP or DRAWING. An unknown PDF page count fails explicitly.

Hidden source versions cannot be republished through this gate, including by privileged users: ordinary rendering must not create public thumbnails from private bytes. Privileged historical asset inspection needs a separate protected delivery design. The resolver itself neither renders nor grants permission to expose a file URL. Source access must also be enforced when historical content is rendered, independently of owner-page access.

All unavailable/mismatched sources use `layers-source-unavailable`; invalid snapshots retain the schema validation failure. No snapshot is repaired or rewritten, and no partial result is returned when any source fails. Storage/handler operational exceptions still need mapping by the eventual request boundary. The stored hash is compared with metadata; bytes are not rehashed on each call. This does not detect arbitrary out-of-band storage corruption or provide retention.

### Verification and limits

The combined core suite passed **62 tests / 154 assertions** on MediaWiki **1.45.3 / PHP 8.3.31**. The source suite contributes **21 tests / 60 assertions**, including the core safeguard:

- Controlled repository/file doubles cover exact lookup options, valid image/PDF references, missing/foreign/hidden files, returned-title/timestamp/hash mismatches, missing paths/bytes, incompatible types, unavailable/insufficient PDF page counts, denied access before lookup, canonical titles, invalid snapshots and attachment-free slides.
- One genuine LocalRepo scenario uploads a PNG, replaces it at a later timestamp, resolves the original as an OldLocalFile with its original hash, then rejects it after its historical file-content flag is hidden. Storage is a temporary FSFileBackend and database tables are isolated by core. No live uploaded file is modified.

The real-upload test proves current/archived image lookup; PDF metadata/rendering, real file moves/deletion/undelete, concurrent visibility/storage changes, foreign-file adoption and retention remain unverified. The hidden-file flag is set directly in isolated test tables, not through the deletion UI. The resolver checks source reference identity and availability at lookup time; a later render or publication must not rely indefinitely on these results.

Standalone PHPUnit also passed (868 tests / 1,952 assertions / one existing skip), with PHP QA, reference/compatibility and documentation/version checks. JavaScript tests were not rerun for this internal PHP-only change. No coverage percentage was measured.

## H3c: integrated publication service

Implemented September 7, 2026 in `src/Revision/PagePublicationService.php`, with typed internal failures in `PublicationException.php`. The service is deliberately not registered or exposed as an endpoint. Existing API/editor saves still use the legacy store.

The service takes a resolved owner Title, request Authority, explicit base revision, complete snapshot JSON, summary and optional WikitextContent for the main slot. It returns only the committed revision ID (or unchanged ID for a successful no-op), rather than exposing revision metadata.

The sequence is now executable:

1. Check owner edit eligibility using `assertCanPrepareEdit()`. This uses core's non-committing `definitelyCan()` checks and denies ineligible callers before source lookup.
2. Reject negative bases and creation without main content. If main content is supplied, require the owner's current/default model to be wikitext; this interface cannot change content models. Existing non-wikitext main slots may be preserved when no main edit is supplied.
3. Validate and canonicalize the complete snapshot, then run exact local source resolution using the same Authority.
4. Recheck owner read/edit/create authorization with `assertCanEdit()` immediately before preparing the write. This uses secure core write checks; a permission revoked during validation prevents saving. Write authorization is counted once per action, rather than in both phases.
5. Build the page updater internally for that owner/actor and invoke the revision writer. Its base check and core compare-and-swap reject stale/competing changes. Both supplied slots commit together.

The service cannot make permissions, file storage and revision insertion one atomic system-wide transaction. Source disappearance or visibility changes after resolution and permission changes after final authorization remain lifecycle/concurrency acceptance work. The final owner check closes the validation interval but does not claim to eliminate every race. Core converts the supplied Authority to its actor identity for attribution inside the updater; authorization remains the service's responsibility.

### Internal failure contract

| Error | Meaning |
| --- | --- |
| `layers-owner-edit-denied` | Preliminary or final owner authorization failed |
| `layers-invalid-publication-request` | Invalid base/creation arguments rejected before or by the writer |
| `layers-main-model-change-denied` | A supplied main edit would target a non-wikitext owner |
| `layers-invalid-snapshot` | Whole-document validation failed |
| `layers-source-unavailable` | A required source is denied, missing or mismatched |
| `layers-edit-conflict` | Writer found a different parent from the requested base |
| `layers-revision-save-failed` | Core rejected the write, including the writer's generic late-conflict failure |

These are internal codes, not a public localized API contract. Previous exceptions retain diagnostics for server-side investigation and must never be serialized to clients. Unexpected infrastructure/handler failures can still escape these expected-failure mappings; the request boundary must supply a generic operational error and preserve unsaved work. Late commit conflicts still share the generic save-failure code; refine that distinction before finalizing the public response contract.

### Verification and limits

The combined core suite passed **75 tests / 188 assertions** on MediaWiki **1.45.3 / PHP 8.3.31**. H3c contributes **13 tests / 34 assertions**, including the harness safeguard. It proves genuine create/update/no-op revisions, actor/summary/main-slot preservation, and exact historical reads through the integrated service. Invalid snapshots, unavailable sources, denied permissions and stale/negative bases leave the current revision unchanged. New-owner requests without main content create no page.

A controlled source callback revokes permissions or performs a competing genuine revision during validation; the pending save is denied or conflicts, preserving the winner. A JSON owner cannot be changed to wikitext through this interface, but can receive a Layers slot while retaining its JSON main content. An Authority mock verifies one write-authorization call per action. The successful publication scenarios use general-purpose slides; real archived-image retrieval is covered separately by H3b, while end-to-end publication of real image/PDF sources still needs acceptance coverage.

Standalone PHPUnit passed **868 tests / 1,952 assertions / one existing skip**. PHP syntax/style/file-mode checks, PHP reference/compatibility guards and documentation/version checks passed. Two existing duplicate test-stub style warnings remain. JavaScript tests and browser tests were not rerun for this internal PHP-only change; no coverage percentage was measured.

## H3d request-boundary proof — September 10, 2026

`src/Api/ApiLayersPublish.php` now wraps the publication service with a closed-by-default constructor gate, explicit POST enforcement, core CSRF/write-mode protections, required owner/base inputs, bounded fields, the existing save-rate bucket and fixed localized errors. It remains unregistered. See the [API contract](PAGE_OWNED_API_CONTRACT.md) for exact inputs, responses, error/retry behavior and remaining admission requirements.

The API suite passed **21 tests / 56 assertions**; the full core suite passed **96 tests / 244 assertions** on MediaWiki **1.45.3 / PHP 8.3.31**. Successful/no-op/create requests produce genuine revisions. Invalid/stale requests preserve current content; boundary failures do not call the publication service. Tests cover disabled requests, GET, tokens, required/bounded fields, denied rights, configured rate limiting and diagnostic redaction. Manifest assertions protect against accidental production registration.

Core's ApiTestCase uses internal ApiMain mode; it does not exercise external HTTP response setup. The module's explicit POST guard is tested. A test-context registration problem initially rejected saves because the active slot registry lacked the Layers role; test registration now occurs in the active request context and handles repeated requests. Temporary diagnostics were removed after verification.

Local checks passed: standalone PHPUnit **868 tests / 1,952 assertions / one existing skip**, `npm test` **180 suites / 14,310 JavaScript tests** plus repository guards, PHP QA, PHP reference/compatibility and documentation/version checks. Two existing duplicate test-stub style warnings remain; no coverage percentage was measured.

This completes the internal request-validation proof, not all of H3d or H3. Alternate core editing paths still need source/owner admission enforcement before production model/slot registration. Actual HTTP/browser acceptance and end-to-end real image/PDF publication remain pending. No normal wiki request can select this module from the extension manifest, and no enablement setting is offered yet.

## Outstanding risks and next implementation task

Next is the remaining H3d admission work: define/test registration and enforce owner/source rules across alternate core editing paths, with controlled enablement. The request boundary is implemented internally; actual HTTP, source-lifecycle and rollout gates remain before exposing normal user writes. Production registration remains gated; source retention and lifecycle acceptance remain H5 requirements. The main compatibility floor is 1.44; the core-backed proof currently covers only 1.45.3. LTS work is separate.

This change cannot make existing Layers edits visible in page history. No existing rows or user pages are migrated. The internal milestones add no public feature toggle because there is nothing safe to enable yet. Later rollout must include an opt-in gate, preflight adoption checks and a rollback policy that never silently falls back to mutable legacy content for adopted documents.
