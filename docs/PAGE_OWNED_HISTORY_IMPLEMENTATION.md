# Page-owned Layers history: implementation contract

Updated September 10, 2026. Feature status: **not available to users**. H1 provides an internal, core-tested persistence primitive; H2 adds strict snapshot validation and a custom content model tested at the core save boundary. H3a adds an internal owner-permission and exact-revision access boundary; H3b adds exact local source-version validation. H3c connects these components in an internal publication service; H3d adds a tested, unregistered request boundary. No public endpoint, slot registration, editor change, adoption or migration is enabled. Existing Layers saves still use `layer_sets` and do not meet the page-history guarantee.

This document is the implementation tracker for revision history. It supersedes SOP-specific framing in earlier proposals. Images, PDF annotations and general-purpose slides are equal participants. Presentations, diagrams, educational material, visual documents and SOPs are acceptance examples; none defines the universal data model.

## Outcome and non-negotiable invariants

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
| H3: authorized service/API | Owner resolution, read/edit/create authority, CSRF, limits, base revision, stable error mapping, suppression-safe historical reads | In progress: H3a/H3b access/source gates and H3c publication service tested internally; request boundary tested internally; alternate-path admission, registration and further source/lifecycle acceptance pending |
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
