# J111: exact-version full-size viewer proposal

**October 1, 2026 — draft for the project owner as software architect. Not an approved contract or implementation assignment.** Advances UI-10, HIST-6, TYPES-2, FEAT-3d and SEC-2. The [approved behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md) remains authoritative. This proposal resolves the server dependency recorded in the [J111 hold](IMPLEMENTATION_HANDOFF_PLAN.md); it does not lift that hold.

## What is already approved

Images, slides and PDF pages regain **Edit layers** and **View full size** on hover, focus and tap. Edit depends on the reader's permissions and is absent on old revisions, diffs and `noedit` slides. Full size retains zoom, pan, fit, PDF navigation, Print and Download. It shows the file version the layers belong to. The current link box stays until the missing-layer-set editor path can replace all its functions. No entry point is removed in J111.

## Findings from the current source

| Component | Existing boundary and missing piece |
| --- | --- |
| `src/Api/ApiLayersRead.php` | Exact `owner` + `revid` reads exist. Batched `binding` reads return selected stored surfaces. Only anonymous current-revision binding reads can opt into public caching. There is no viewer-page request. |
| `src/Revision/PageReadService.php` | Authorizes the revision and selected sources. It returns a rendition for a stored surface, but cannot request an unannotated page of the same PDF. |
| `src/Revision/SourceVersionResolver.php` | Resolves the exact local timestamp/SHA, checks read rights, visibility, bytes and PDF page count, and refuses a different version. Reuse it. |
| `src/Revision/SourceRenditions.php` | Calls the exact resolved file's `transform()` and returns a core URL and size. Current width is limited to the stored canvas width or 2048, whichever is smaller. |
| `resources/ext.layers/viewer/LayersLightbox.js` | Later-page reads and export composition use `layersinfo`. PDF sharpening uses a filename redirect to the current upload. Print filters missing pages; PDF building skips invalid page entries. None of those paths can be reused unchanged for page-owned content. |
| `resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js` | Mounts authorized exact-revision surfaces. Field substitution already uses the displayed page's values. Overlay integration must retain these values and the same revision. |

MediaWiki 1.45.3 source inspection confirms `OldLocalFile::getUrlRel()` uses the archive name, while `File::getUrl()` constructs a repository URL. This alone does **not** prove an immutable URL for a version that is still the current upload, or HTTP authorization after a later visibility change. Do not add an unqualified raw-file URL to claim exact PDF rendering.

## Proposed API extension

Add a mutually exclusive viewer mode to the existing `layersread` action. Ordinary snapshot and binding requests keep their contracts.

| Request field | Proposed meaning |
| --- | --- |
| `owner`, `revid` | Existing required owner title and explicit positive revision. Never substitute latest. |
| `viewer` | One canonical `v1:<pageId>:<surfaceId>` binding identifying a stored anchor surface. Mutually exclusive with `binding`. |
| `page` | Required positive page number for viewer mode. Exactly 1 for an image or slide; within the exact pinned PDF's page count for a PDF. Reject it outside viewer mode. |
| `formatversion=2` | Required by the client to preserve snapshot booleans and objects. |

No caller-supplied filename, source timestamp, SHA, URL or label chooses the source. The server selects everything from the anchor in the authorized revision. PDF page selection is a bounded navigation parameter, not permission to choose a different file.

Proposed success envelope under `layersread.viewer`:

| Field | Value |
| --- | --- |
| `pageId`, `revisionId`, `binding` | Validated owner, exact requested revision and anchor binding, echoed for client matching. |
| `kind`, `label` | Anchor kind and layer-set label from that revision. |
| `page`, `pageCount` | Requested page and count from the exact file; both 1 for images/slides. |
| `surface` | Exact stored surface for that PDF page, or the anchor for an image/slide. Null for an unannotated PDF page. Never invent or store a synthetic surface ID. |
| `canvas` | Stored canvas when a surface exists. For an unannotated page, dimensions from that exact file's handler, with an empty layer list in the client adapter. |
| `source` | Core rendition `{ url, width, height }` for image/PDF; absent for a slide. |

The envelope carries only one page. No whole-document thumbnail batch and no other layer sets' data are returned. Each navigation or export page request reauthorizes independently. Duplicate page identities, an unavailable anchor, foreign owner, hidden revision/source, missing bytes and out-of-range pages fail with the existing generic unavailable error. Operational failures use the existing generic read-failed error; no internal paths or diagnostic chains reach the client.

Viewer responses, including failures, stay private with maximum age zero even for an anonymous current revision or request-selected cache ages. Shared parser output remains identity-only and cacheable. Authorization is rechecked after rendition work before returning the response. The media bytes continue to use MediaWiki's existing repository protection and deletion/purge behavior, as in the accepted September 26 delivery decision; this does not promise revocation of bytes already delivered.

## PDF grouping and version consistency

**Owner clarification, October 1:** wiki page 150's `layerset=001` on `Filename.pdf` is one layer set across all 99 PDF pages. The viewer navigates those pages within `001`; page-specific internal IDs never become separate layer-set names. Another wiki page's `001` on the same PDF is a separate layer set. The name/ownership model is settled, as recorded in the [behaviour brief](LAYER_SET_BEHAVIOUR_BRIEF.md#owner-clarification--october-1-2026-one-name-for-the-whole-pdf-layer-set). References below to source versions concern uploaded file revisions, not layer-set names or PDF page identities.

Use J112's accepted group identity: owning page, canonical file title and normalized layer-set name. Within the group, `source.page` selects the page surface. A second file with the same name is excluded. An unannotated page shows the same pinned document with no layers.

**Architect decision required:** the current schema permits individual surfaces to pin different versions. The approved brief describes one file version for a whole PDF layer set, but the packets do not define how existing mixed-version groups are handled. Recommended rule for newly assembled groups: require one timestamp/SHA across the group; refuse conflicting input without changing any stored content. For existing mixed-version content, retain current individual-surface access and report the inconsistency; do not enable a whole-document viewer that combines versions or silently drops surfaces. A repair or file-update flow needs its own approved behavior. This is a release gate for affected content, not permission to introduce a new unavailable screen silently.

J113 must also address already-migrated PDF labels such as `ABC (page 2)` before those surfaces can be treated as pages of `ABC`. Do not infer membership by stripping suffixes from arbitrary user names. See the companion [J112 proposal](J112_IDENTITY_IMPLEMENTATION_PROPOSAL.md).

## Rendering and export

**Recommended for architect review:** render PDF pages through MediaWiki's existing exact-file transform path for the page-owned viewer. Reuse `LayersLightbox`, its overlay renderer and PDF builder, with an injected page loader. Preserve the existing legacy viewer independently.

Full-size requests need a viewer rendition size, not the potentially tiny inline canvas width. Match the existing `PdfRenderer` sampling budget: nominal width 1600 pixels, largest side at most 4000 pixels, aspect ratio preserved; never alter stored layer coordinates. This fits the existing rendition width ceiling but needs a distinct internal viewer sizing policy. Compare native and current browser-rendered output on the same PDF fixtures before accepting visual parity. If the native result loses visible detail, return to the architect; do not silently ship a lower-quality replacement. An exact-version raw-PDF path for pdf.js would be a separate alternative requiring a delivery contract and evidence.

For page-owned mode, the loader must be used for initial opening, navigation, Print and Download. It must never enter `layersinfo`, the current-file redirect or the legacy server export fallback. Every response is checked against owner, revision, anchor and requested page before painting. Closing, reopening or changing page invalidates old asynchronous responses.

Export pages in order with one composition in flight, releasing each page's canvas after encoding. Preserve every page, including unannotated pages. Validate all page results and image encodings before saving a PDF or opening the print dialog. An unavailable page or failed composition produces no partial document. No page is filtered out. Memory still grows with the encoded output, so large-document limits must be measured and documented; serial composition is not a claim of constant-memory export.

Proposed additional behavior/error wording for approval: **"Could not prepare the complete document. No file was downloaded. Try again."** and **"Could not prepare the complete document for printing. Try again."** Use translated messages and retain focus on the triggering control. This is explicit failure reporting, not a replacement viewer or stop-gap.

Page field substitution must use the same displayed-revision values as the inline view, including historical views, without running today's Cargo query for an old revision. `noedit` remains an embed attribute, while permission comes from an authorized reader request, never shared cached output. Escape restores focus to the exact opener.

## Proposed implementation and delegation boundary

1. **Lead, after architect approval and the J112 identity contract:** extend `ApiLayersRead`, `PageReadService`, `SourceRenditions` and service wiring in `PageOwnedPilot` as necessary. Own permission checks, PDF grouping, failure behavior and native integration tests. Do not register abandoned rendering prototypes.
2. **Junior, after the tested response contract is frozen:** adapt `LayersLightbox`, `PageOwnedRevisionBootstrap`, `ViewerOverlay`, the page-owned slide bootstrap where required, their styles and focused Jest tests. Permit only the narrow `SlideHooks`/`BoundSlideHooks` work needed to retain `noedit`. ResourceLoader declarations and translated messages are in scope. Do not remove the link box or File-page entry points.
3. **Junior, after lead code review:** serial browser acceptance on the original test wiki using the existing isolated owner-page/CAS cleanup rules. Run twice, then give the architect exact screen URLs. No owner sign-off is inferred from test results.

## Required discriminating evidence

| Layer | Tests and failure that must be detected |
| --- | --- |
| Native server | Extend `ApiLayersReadTest`, `SourceRenditionsTest` and focused read tests. Pin a multi-page PDF, upload different bytes/page count, then request annotated and unannotated old pages. Assert archived rendition identity, page geometry and exact annotation data. |
| Native refusal | Wrong owner/revision, hidden revision/source, missing archive, page out of bounds, duplicate page identity, conflicting version group, transform error and visibility change during transform return no viewer data. Unrelated inaccessible layer sets do not block the selected set. |
| HTTP | Verify private/zero-age headers on success and failure, even with explicit `maxage`/`smaxage`; verify media loading under the test wiki's actual repository configuration. Core dispatcher tests alone are insufficient. |
| Jest | Exact request/response matching, empty PDF page, stale success/failure, close/reopen, field substitution, `noedit`, permissions and focus. Assert prohibited legacy requests never occur. One failed export page must prevent both saving and printing. |
| Browser | Image, slide and multi-page PDF: stroke-colour evidence, navigation between annotated and empty pages, zoom/pan/fit, complete downloaded PDF, historical file after reupload, anonymous view-only controls, keyboard/touch controls and focus return. |
| Gates | Relevant native and standalone suites, PHP style, full `npm test`, bundle budgets, docs/reference checks, existing page-owned viewer/journey regressions serially. Owner screen review is still required. |

## Decisions requested before implementation

1. Approve the narrow server-backed viewer scope and native PDF rendition approach, subject to visual parity evidence.
2. Approve one pinned file version per newly assembled PDF layer set, with existing inconsistent data reported for explicit treatment rather than modified automatically.
3. Approve the complete-document export failure behavior and exact messages above.

The endpoint fields and class placement are lead implementation details once these decisions and J112's identity rules are accepted. No production code or wiki data was changed to prepare this proposal.
