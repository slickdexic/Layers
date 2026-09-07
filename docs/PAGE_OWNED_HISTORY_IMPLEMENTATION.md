# Page-owned Layers history: implementation contract

Updated September 6, 2026. Feature status: **not available to users**. H1 is an internal, core-tested persistence primitive. No public endpoint, slot registration, editor change, adoption or migration is enabled. Existing Layers saves still use `layer_sets` and do not meet the page-history guarantee.

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

## Proposed document contract — H2 must finalize and version this

The owner comes from the MediaWiki page/revision, not an editable JSON field. A slot contains a schema version and an ordered collection of stable documents/surfaces. Each surface records its stable ID, kind, label, dimensions, layer data, background settings and reading order where provided. Image/PDF surfaces also record the source file identity, immutable version reference and PDF page number where applicable. Slides do not require a fabricated file attachment.

Do not freeze a public JSON schema from the H1 test fixtures: they are intentionally small, synthetic mixed-surface records that test storage, not annotation validation. H2 must specify required/optional properties, unknown-field behavior, numeric bounds, asset retention/retrieval, legacy import, canonical serialization and future schema migration. Render order, reading order and optional step numbering are separate concepts.

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
| H2: content model | Versioned schema, strict whole-document validation, canonicalization, custom content model and normal-slot registration | Pending; malformed content rejected through all supported core editing paths, not only a custom API |
| H3: authorized service/API | Owner resolution, read/edit/create authority, CSRF, limits, base revision, stable error mapping, suppression-safe historical reads | Pending; denied requests cannot read/write content, stale requests cannot overwrite |
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

## Outstanding risks and next implementation task

H2 is next: finalize the versioned mixed-surface schema and custom content validation with examples for a presentation, diagram, annotated image and PDF. Establish source-version retention and namespace/ownership rules before exposing H3. The main compatibility floor is 1.44; the core-backed proof currently covers only 1.45.3. LTS work is separate.

This change cannot make existing Layers edits visible in page history. No existing rows or user pages are migrated. H1 adds no public feature toggle because there is nothing safe to enable yet. Later rollout must include an opt-in gate, preflight adoption checks and a rollback policy that never silently falls back to mutable legacy content for adopted documents.
