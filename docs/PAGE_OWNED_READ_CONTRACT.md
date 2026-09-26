# Internal exact-revision read contract

## Source renditions in read bundles — September 26, 2026

The pilot's `PageReadService` now adds core renditions of each image/PDF surface's exact pinned source version (see the [delivery decision](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md)):

| Where | Field | Content |
| --- | --- | --- |
| `read()` / `layersread owner+revid` | `sourceRenditions` | Map keyed by image/PDF surface ID: `url` (absolute http(s) core URL of that version, archived versions included), `width`, `height` (display pixels, at most 2048 wide) |
| `readBoundSurfaces()` / `layersread binding=` | `source` on each image/PDF entry | Same shape |
| `PageOwnedPilot::prepareViewer()` | `source` | Same shape; required for image/PDF surfaces |

Slides have no rendition. A rendition failure is treated like an unavailable source: `read()` rejects the bundle, a bound read omits only that binding. `sourceGeometry` is unchanged and still gives handler pixels. The historical viewer draws image/PDF surfaces over the rendition, scaled to the surface canvas, both in `Special:ViewLayersPage` and for bound file embeds on page views (`img.layers-bound-file`).

## Inline bound-slide display implemented; browser gate pending — September 25, 2026

Lead connected native SlideHooks to the ordered binding adapter. In the existing enabled/scoped pilot, valid bindings produce identity-only placeholders with the exact native parser revision (including core's explicit revision-record callback path). Preview/no-revision, foreign PageID, disabled/out-of-scope and malformed/conflicting bindings fail closed. Shared legacy slides continue through the original path.

BoundSlideHooks runs on OutputPageParserOutput and requires its cached parser revision to equal the displayed OutputPage revision. It reads through prepareBoundViewer with the actual reader Authority and PageID-checked exact read service. Authorized drawing bundles are added only to the current response's JS configuration; the shared ParserOutput retains no drawing data. Bound responses disable client/CDN caching. The existing history bootstrap now mounts each matching inline host independently; mismatched/denied hosts keep the unavailable placeholder. This is read-only and still limited to slides; no adoption UI or legacy save fallback was added.

Fresh verification: **31 native tests / 329 assertions** for bound output, binding reads, direct slide parsing and pilot; **128 JS tests** for bootstrap/view/renderer; **120 PHP unit tests / 228 assertions** for SlideHooks/binding options. Native coverage drives addParserOutput, checks no-store response headers, exact old drawing after a later save, disabled/denied output, mismatched display revision and absence of drawing data from serialized parser cache. Style, class references (95 classes) and compatibility checks passed.

**Unresolved verification:** PageOwnedPilotRegistrationTest independently fails in the currently configured test runner (duplicate native Layers slot installation and an already-defined content model when testing an empty scope). Do not report the registration suite or all checks as passing; lead must isolate its bootstrap from the original wiki's installed pilot without changing user configuration. No browser acceptance is claimed yet.

**Junior J67 is ready** in the handoff plan for real original-wiki inline binding acceptance. J64/J65 remain blocked on ordinary adoption/editor interfaces. Lead retains those interfaces, pinned image/PDF delivery, visual parity and the registration-test isolation fix. No user content/configuration, manifest, commit or push changed. Docker is only the test host.

## Exact bound-surface read implemented — September 25, 2026

Lead added `PageReadService::readBoundSurface(owner, revisionId, binding, authority)`. It requires a canonical binding whose PageID matches the displayed owner, selects only the requested surface from that exact revision, and reuses native revision visibility/source authorization. Missing, foreign, malformed and denied bindings return the same fixed unavailable error without diagnostic chaining. The binding PageID also reaches PageHistoryAccess, where it is checked against the same owner identity used for the revision comparison, rather than relying solely on an earlier title preflight.

Native tests publish successive drawings, read the older drawing after a later edit and removal, reject missing/foreign surfaces and revisions, deny unauthorized readers and hidden revision text, and check mismatched expected PageID. A pre-existing test setup unconditionally redefined the registered Layers slot; lead corrected it to define only when absent. Fresh combined read/history/parser/preparation regression: **62 tests / 301 assertions passed**. Changed PHP style passed.

**Still internal:** this method registers no route, changes no parser output and grants no new access. Its owner/revision must come from trusted native displayed-page context; it is not proof that a binding appeared in that revision's main text. Output is authority-specific and must not enter a shared parser cache. The parser continues to refuse reserved bindings until lead completes the displayed-revision transport and view mounting. J66 remains accepted; J64/J65 remain blocked. No ordinary overlay testing readiness or commit/push; no user wiki content/configuration changes. Docker remains only the test host.

## JSON transport requirement — September 21, 2026

JSON consumers must request `formatversion=2` for lossless snapshot values. MediaWiki's legacy JSON format converts true to an empty string and removes false properties. The production read client now explicitly supplies version 2 for every read, including reconciliation. Real browser edit/save/history acceptance caught and verified this fix. Do not repair boolean values heuristically after reading: that cannot recover omitted values or distinguish intentional empty strings. Existing HTTP acceptance already used version 2, which is why it did not reveal the client request bug.

## R01 exact-revision API boundary — September 20, 2026

Implemented `src/Api/ApiLayersRead.php`, action `layersread`, now registered through native extension initialization and disabled by default. The explicit permitted-owner list defaults empty. Actual localhost HTTP returns `layers-reading-disabled` with `Cache-Control: must-revalidate, max-age=0, private`, including when requested maxage/smaxage are nonzero. The disposable SQLite HTTP harness also verifies authenticated exact historical reading after a newer save; broader lifecycle and supported-version acceptance remain. Editor/historical viewer integration remains outstanding.

| Request field | Contract |
| --- | --- |
| `owner` | Required local page title, at most 512 UTF-8 bytes; must resolve to an explicitly permitted owner key; special/invalid/fragment targets reject |
| `revid` | Required integer 1–2147483647; no latest/default revision fallback |

The read action uses the request's original Authority and the existing `PageReadService`. Read permission is required; `editlayers` and write permission are not required to view authorized content. It returns `{ "layersread": { "revisionId": ..., "snapshot": ..., "sourceGeometry": ... } }` with exactly the underlying bundle described below. It adds no asset URLs, filesystem paths, author metadata or current-revision substitution. It is read-only and requires no write token.

Before checking the gate or reading data, the module sets core API cache mode to private and maximum age to zero. Core tests verify that a prior public cache-mode choice is overridden even when the request supplies maxage/smaxage. Actual HTTP headers and browser/cache behavior remain to be verified during controlled registration; internal ApiMain tests are not that evidence.

Fixed errors: `layers-reading-disabled` when disabled; `layers-revision-unavailable` for invalid/out-of-scope owners or unavailable/denied historical content/sources; `layers-reading-failed` for operational exceptions. Core supplies standard missing/range/byte-limit errors. Unexpected exception details are logged server-side and never copied into the API response. English and translator messages are included.

Fresh full core verification: **351 tests / 2,557 assertions / one existing permission-test skip**, no failures on MediaWiki 1.45.3/PHP 8.3.31. Tests cover an old slide's exact text after a newer different snapshot, read-only users, wrong owners, hidden historical text, private cache mode, disabled/empty/outside scope, required/ranged fields, generic source failures and operational diagnostic redaction. Hidden revision flags are set in isolated test tables; RevisionDelete UI and full lifecycle execution are not claimed. PHP style and message/class-reference guards pass.

Next lead work remains R01's native registration and lifecycle admission: guarded publishing now uses the same exact owner-key/empty-denies-all scope semantics; shared registration remains pending, and import/undelete/other alternate insertion paths must be protected before a normal HTTP request can reach either experimental module. Source review confirms a PageUndelete veto hook and a separate WikiImporter/old-revision insertion path; no new lifecycle enforcement is claimed in this read-boundary change. No Docker feature architecture, new packages or host process infrastructure was introduced.

**September 12 continuation:** internal `PageAssetService::prepare()` now binds raster preparation to an exact authorized owner/revision/surface and rechecks revision visibility and all sources after rendering. See the [delivery contract](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md) for the implemented boundary and remaining gates. This is not an HTTP endpoint or production enablement; resource/configuration and lifecycle work remains lead-owned. Earlier checkpoint notes below retain their historical scope.

September 12, 2026. **Implemented internally; not a public endpoint or historical viewer.** `src/Revision/PageReadService.php` combines the existing owner/revision access boundary and exact source resolver. It has no production registration, asset delivery or shared cache.

## Request and authorization

`read(Title $owner, int $revisionId, Authority $authority)` requires an explicit positive revision ID belonging to the requested owner. It delegates owner access, revision visibility, slot presence and schema checks to `PageHistoryAccess::read` before touching sources. It passes the same original Authority to `SourceVersionResolver` for local source/version/visibility/byte/page checks. It never resolves an omitted ID to latest or substitutes a current file for a missing archived version.

The first implementation is all-or-nothing: any denied/missing revision, source or usable source dimensions rejects the complete bundle with `layers-revision-unavailable`. There is no partial/degraded rendering response yet. Raw stored revision access remains a separate internal operation. Infrastructure exceptions remain exceptions for a future transport boundary to map safely; do not return exception chains to clients.

## Result

| Field | Meaning |
| --- | --- |
| `revisionId` | The exact requested revision ID, not the current page revision |
| `snapshot` | Validated canonical snapshot decoded to an array, preserving surface and reading order, text, source identities and document canvas coordinates |
| `sourceGeometry` | Map keyed by image/PDF surface ID, containing `page`, positive integer `width`, positive integer `height`, and `units: file-handler-pixels` |

Slides have no entry in `sourceGeometry`; their canvas is defined by the snapshot. The reader adds no file URLs, storage paths, temporary credentials or File objects. Existing document text/link values remain document content; this is not a claim that user-authored text cannot contain URLs.

Source geometry and annotation canvas geometry are distinct. PDF dimensions come from core `File::getWidth(page)` / `getHeight(page)` for the exact resolved file. Installed PdfHandler derives them from PDF metadata and configured DPI; they are not a measurement of a browser canvas or proof of a rendered thumbnail. The J27 tests pin DPI to 150 using test-scoped configuration. A future renderer must map the stored canvas onto the requested source page; it must not overwrite stored coordinates with current handler dimensions.

## Verification and limits

The full core suite passes **130 tests / 663 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. New reader tests publish an image/PDF/slide document, replace the PDF and publish a newer owner revision, then read both exact revisions and compare their snapshots and source geometry. Losing only old source bytes rejects the old bundle while the current bundle remains readable. A denied owner read must not invoke source resolution. J27 separately verifies archived/current PDF bytes, page counts and missing-archive fallback rejection.

This evidence does not establish source retention, served asset permissions, public/cache headers, suppression races, nonlocal files, browser rendering or other MediaWiki versions. The bundle is ephemeral and must not be cached across users or requests. Availability/permission checks cannot guarantee that a file will still exist or remain visible later; asset delivery must reauthorize at delivery time.

## Ordered next work

1. **J28 accepted:** invalid/foreign/deleted-text revisions, denied source access, invalid handler dimensions and slide-only bundles are covered. Lead added real source-authorization denial alongside mocked exception mapping.
2. **Lead L02a/L02b:** implement the [private asset delivery design](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md). The private renderer primitive now exists; authorized delivery and the endpoint remain unimplemented.
3. **Junior J29a ready:** private-renderer probes; J29b delivery probes remain blocked on lead L02b.
4. **Lead, then junior J06 phase 2:** disposable HTTP registration/credentials/teardown contract and transport acceptance. Normal localhost registration remains prohibited for these tests.

The main rollout gates remain historical delivery, adoption/lifecycle isolation (including import and undelete bypasses), transport/browser acceptance and supported-version review. This internal reader does not close gate A or change existing `layer_sets` saves.

## J45 read-client acceptance — September 13, 2026

The unregistered `PageOwnedReadClient` is accepted with corrections. It requires an exact response revision match and validates the contracted envelope without duplicating the document schema or converting geometry. Local input errors remain local; a server error impersonating the local validation code is mapped to a fresh fixed `layers-reading-failed` Error. Synchronous and asynchronous diagnostic-redaction regressions pass. Fresh results: 38 read-client tests, 85 combined read/publish-client tests, ESLint clean. This does not enable an endpoint or historical viewer.
