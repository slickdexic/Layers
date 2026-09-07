# Current status and limitations

Baseline reviewed September 6, 2026 against `main` commit `a3b20963`. The extension manifest still reports **1.5.95**; fixes after the September 2 tag are on `main` and described under **Unreleased**. A checkout of the tag does not include those fixes.

## History implementation progress

**Page-owned history is not wired into the editor or public APIs. Existing Layers saves remain on the legacy path and are not revision-compliant.** Internal progress as of September 7, 2026:

| Stage | Implemented internally |
| --- | --- |
| H1/H2 | Genuine revision persistence and a strict versioned snapshot model |
| H3a | Owner edit/create authorization and visibility-aware exact historical reads |
| H3b | Exact local source validation, including a real archived-image upload/replacement test |
| H3c | Integrated publication service with final permission rechecks, combined-slot saves and conflict handling |

The combined core suite passed **75 tests / 188 assertions** on MediaWiki 1.45.3. Production registration/API, historical viewers, source retention and adoption remain pending. See the [format contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_DOCUMENT_FORMAT.md) and [implementation contract](https://github.com/slickdexic/Layers/blob/main/docs/PAGE_OWNED_HISTORY_IMPLEMENTATION.md) for exact evidence, limits and remaining gates.

## Supported content

Layers annotates **images**, individual **PDF pages**, and **standalone slides**. Slides do not need a background file. Text, callouts, drawing tools, named sets and the canvas viewer are shared across these uses. PDF rendering additionally depends on MediaWiki's document thumbnail support.

## Implemented versus planned

| Capability | Current behavior |
| --- | --- |
| Editing and viewing | Canvas editor, named sets, inline viewer, lightbox, client-side image export and print/download workflows |
| Layer revisions | Separate Layers database revisions; default retention is 50 per named set and document page |
| Owning article history | **Not implemented.** Saving annotations does not reliably create a revision of the embedding article |
| History tracking configuration | `LayersTrackChangesInRecentChanges` attempts unchanged-content saves; it is **not a reliable audit trail** |
| MediaWiki text search | No dedicated annotation-text indexing. Slide-name and layer-panel filters are not wiki full-text search |
| Cargo | Gallery integration can choose a named layer set from query results |
| Cargo annotation rows / field bindings | **Planned**, not currently implemented |
| Server export fidelity | Some saved properties and failure cases remain unsupported; inspect important exports |

For slide-based SOPs, do not treat the current extension as providing controlled-document revision history, searchable slide content, approval/sign-off or immutable records. These are the next development priorities: **page revisions → MediaWiki search → queryable Cargo annotation text**, across all three content types. See the [design proposal](https://github.com/slickdexic/Layers/blob/main/docs/proposals/CARGO_SEARCH_PAGE_HISTORY.md).

## Fixes on main after 1.5.95

- File-set renaming now performs its database update.
- Deleting/renaming across PDF pages verifies ownership of every affected page.
- New revisions retain server-generated creator metadata through pruning.
- Failed buffered saves keep unsaved work open; page restores retain set/background context.
- Stale editor page responses and lightbox image callbacks no longer overwrite the current view.
- Cached server exports are bound to the source title as well as file content/key.
- Zero-opacity lightbox backgrounds remain transparent.

Old unbound export cache files are intentionally not served; regenerate the export. Legacy sets whose creator revision was already pruned and which lack creator metadata require `layers-admin` for deletion/renaming. They remain editable. No schema migration was added by these fixes.

R6.08 follow-up on September 6: strict save-container validation now rejects malformed requests before writes. Explicit empty-list clears remain supported. Standalone PHPUnit passed 802 tests / 1,878 assertions with one skipped; see the [implementation record](https://github.com/slickdexic/Layers/blob/main/docs/SAVE_PAYLOAD_CONTRACT.md). The original checkpoint results below are retained as dated evidence.

## Open findings

The [codebase review](https://github.com/slickdexic/Layers/blob/main/codebase_review.md) records the evidence and severity. Remaining findings include intent-like set names, stale draft cleanup, incomplete/error-prone exports, foreign-file cache invalidation, slide creation rate limiting, misleading substitute tests, vendored dependency auditing, default-set naming inconsistencies, and the unreliable audit option (R6.19). This list is a scope statement, not an exhaustive security certification.

## Verification snapshot

On September 6, 2026: `npm test` passed **180 suites / 14,310 JavaScript tests** and repository guards. PHP lint/style/MinusX passed; PHPUnit ran **686 tests / 1,475 assertions, one skipped**. Two existing duplicate test-stub style warnings remain. Coverage was not remeasured, so no current coverage percentage is claimed.

A controlled Chromium probe reproduced and verified the lightbox scaling fix on the local wiki. A complete browser E2E suite, live database concurrency test and LTS backport verification were not performed for this checkpoint. Test counts do not establish that every workflow is correct.

## Branches and upgrades

`main` requires MediaWiki >=1.44 according to `extension.json`; use a supported MediaWiki release and that release's PHP/database requirements. `REL1_43` is the separate 1.43 branch; do not assume every main-branch fix is already backported. `REL1_39` is unmaintained. Check the destination branch's changelog before an upgrade.

Back up the wiki database, uploads and configuration. Update the extension and run MediaWiki's database updater before use. Preserve old assets and Layers rows in backups: an article-only wikitext export is not a complete backup of annotations.
