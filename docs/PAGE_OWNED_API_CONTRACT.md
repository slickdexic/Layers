# Page-owned publishing API: internal contract

**September 12 continuation:** internal `PageAssetService::prepare()` now binds raster preparation to an exact authorized owner/revision/surface and rechecks revision visibility and all sources after rendering. See the [delivery contract](PAGE_OWNED_ASSET_DELIVERY_DESIGN.md) for the implemented boundary and remaining gates. This is not an HTTP endpoint or production enablement; resource/configuration and lifecycle work remains lead-owned. Earlier checkpoint notes below retain their historical scope.

Updated September 20, 2026. **Experimental, registered and disabled by default.** Native extension registration now exposes the API, while `LayersPageOwnedPilotEnabled` defaults false and `LayersPageOwnedPilotOwners` defaults empty. The service hook installs content/slot and lifecycle protection only for retained owners. No editor integration or production enablement is complete. Real HTTP verifies registration and native bad-token rejection; authenticated publication/history now passes in the disposable SQLite HTTP harness; editor integration remains outstanding. Retain owner keys while current or archived pilot revisions exist, even when publication is disabled.

See the [history implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) for the full rollout gates and the [document format](PAGE_OWNED_DOCUMENT_FORMAT.md) for snapshot data. Images, PDFs and general-purpose slides use the same request format. Existing `layerssave` requests are unchanged.

## Request shape

The experimental action is `layerspublish`. It requires POST and a MediaWiki CSRF token. The module also rejects non-POST internal requests explicitly, because core's internal ApiMain mode skips external HTTP response setup. Normal core write-mode protections still apply.

| Parameter | Required | Contract |
| --- | --- | --- |
| `owner` | Yes | Local owner-page title, at most 512 UTF-8 bytes. Invalid, special, interwiki or fragment-bearing targets are rejected. Redirects are not followed by the publication service. |
| `pageid` | No for existing pilot callers | Expected existing owner PageID, integer 1–2,147,483,647. Future bound-editor callers must supply the server-derived ID. It is an identity assertion, not permission or proof of a selected surface. Passed into native publication's preflight and commit-time identity checks; mismatches fail with `layers-invalid-publication-request`. Cannot be combined with creation (`baserevid=0`). |
| `baserevid` | Yes | Integer 0–2,147,483,647. Zero means creation and requires main text; updates require the current owner revision. Out-of-range values fail rather than clamp. |
| `data` | Yes | Complete versioned snapshot JSON, at most 2 MiB; the service validates the whole document. |
| `maintext` | For creation | Optional simultaneous wikitext main-slot edit, at most 2 MiB. Omission preserves existing main content; an explicit empty string supplies empty wikitext. Cannot change the owner's main content model. |
| `summary` | No | Edit summary, default empty, at most 500 UTF-8 bytes. |
| `token` | Yes | Core CSRF token for the request session/actor. |

Each field has its own bound. Application/PHP/web-server request-body limits also apply; the two 2 MiB limits do not imply every server accepts a 4 MiB body. No partial updates, implicit latest revision, live shared-set references or caller-supplied author are accepted as substitutes for these inputs. Unknown parameters retain core's standard API handling; they do not become snapshot fields.

A successful result contains only:

```json
{"layerspublish":{"result":"Success","revid":123}}
```

The ID is the committed revision, or the existing revision for a successful no-op. No file URLs, author/comment metadata, raw content, stack trace or internal exception message is added to this response.

## Authorization, limits and errors

After the enablement gate and parameter extraction, the module requires `editlayers` and checks the existing `editlayers-save` rate bucket. This shares the existing extension save budget instead of offering a second independent budget. Core/user exemptions and administrator rate-limit configuration still apply; this is not an unconditional hard cap. The publication service separately enforces owner read/edit/create rights and final authorization, then validates source access, protects the base revision and commits the slots together.

Core handles missing/bad tokens, missing required parameters, range/byte limits and write-mode failures. The tests observe `missingparam`, `badtoken`, `outofrange`, `maxbytes`, `permissiondenied` and `ratelimited` where applicable. The module's POST error is `mustbeposted`.

Expected publication failures use an explicit allowlist of the service's codes: `layers-owner-edit-denied`, `layers-invalid-publication-request`, `layers-main-model-change-denied`, `layers-invalid-snapshot`, `layers-source-unavailable`, `layers-edit-conflict`, and `layers-revision-save-failed`. Disabled construction or an owner outside the explicit permitted prefixed-DB-key list yields `layers-publication-disabled`. Empty lists permit no writes; entries are exact keys, never prefixes. The check runs before publication, after normal request/right/rate validation. This matches the read API scope semantics, though shared configuration registration remains pending. Unrecognized or unexpected failures yield `layers-publication-failed`. English messages and translator notes are included; other languages use normal MediaWiki fallback until translations exist.

Unexpected service failures are logged server-side. Exceptions and their previous-exception chains are not serialized into the API result. Save/operational failure messages avoid promising that no commit happened: clients must retain unsaved work and inspect the latest revision before retrying an uncertain result. A retry with an outdated base must conflict, not overwrite. Stale-base conflicts have a specific response; late core conflicts still share the generic revision-save-failed response.

## Evidence and remaining gates

On MediaWiki 1.45.3/PHP 8.3.31, the API suite passed **21 tests / 56 assertions**, including the harness database-prefix safeguard. The full core suite passed **96 tests / 244 assertions**. API scenarios cover successful update/no-op and creation with main text, invalid-snapshot preservation, stale-request preservation, disabled requests, GET requests, missing/bad tokens, missing owner/base, negative base, invalid targets, oversized fields, denied Layers rights, configured rate limiting, and hidden operational diagnostics. Rejected request-boundary cases assert that the publication service is never invoked. A manifest assertion guards against accidental normal registration.

These tests use ApiTestCase's real internal ApiMain dispatcher and isolated database tables, not an HTTP client or browser. Test-only registration happens in the active request service context, including token-discovery requests. The explicit module POST guard is exercised; external HTTP response setup, proxy/body limits and browser session handling still need acceptance tests.

The successful API examples use empty snapshots; H3c exercises slide publication and H3b separately exercises real archived images. A single end-to-end real-image/PDF API test is still required. The handler currently enforces schema validity, but complete source/owner admission for every alternate core editing path is not yet implemented. Production registration must stay closed until that gap, historical delivery, adoption isolation and applicable lifecycle gates are resolved. There is no migration, legacy-save interception, public viewer or user-facing history guarantee in this milestone.

L01 internal PageUpdater admission is accepted after lead corrections and prepared-main tests. See the [admission record](PAGE_OWNED_ADMISSION_DESIGN.md). The internal API allowlist also includes `layers-admission-unauthorized` and `layers-slot-removal-denied` for safe hook rejection mapping. Production registration remains off; J06 phase 1 provides real-source core publication evidence; HTTP transport, archived-PDF geometry, historical delivery and lifecycle evidence remain pending. Optional main wikitext is prepared once by core; the admission scope binds its transformed bytes rather than raw request text.

The unregistered [internal read contract](PAGE_OWNED_READ_CONTRACT.md) now defines an exact-revision snapshot/geometry bundle. It is not an HTTP read endpoint, a delivery URL contract or a client adapter API. Those remain L02 and transport gates.

## J42 client acceptance — September 13, 2026

The unregistered `PageOwnedPublishClient` now catches synchronous as well as asynchronous transport failures and always reconstructs recognized server errors with fixed messages. Invalid optional text types reject locally instead of silently dropping content. Omitted summary defaults to empty; absent/null main text is omitted and explicit empty main text is preserved. One immediate application-level API call is retained, without application retries or draft mutation. Lead regression verification passes 47 focused Jest tests and ESLint. Public registration and editor integration remain pending.

## R01 publish-owner scope verification — September 13, 2026

The unregistered constructor now accepts `array $ownerKeys = []` after the default-off gate. Test-only registration supplies explicit owner keys. Fresh publish API verification passes **24 tests / 65 assertions**, including empty/unrelated/prefix-only scope rejection without invoking the publisher, allowed update/no-op and allowed page creation. PHP style passes. Normal registration, alternate lifecycle admission and actual HTTP acceptance remain pending.
