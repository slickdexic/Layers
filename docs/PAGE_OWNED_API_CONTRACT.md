# Page-owned publishing API: internal contract

Updated September 10, 2026. **Experimental and unregistered.** This is a tested request-boundary implementation, not an API available on a normal Layers installation. The module, content model and slot are registered only inside isolated core tests. Its constructor defaults to disabled; there is no administrator-facing enablement setting or supported manual registration procedure yet.

See the [history implementation contract](PAGE_OWNED_HISTORY_IMPLEMENTATION.md) for the full rollout gates and the [document format](PAGE_OWNED_DOCUMENT_FORMAT.md) for snapshot data. Images, PDFs and general-purpose slides use the same request format. Existing `layerssave` requests are unchanged.

## Request shape

The experimental action is `layerspublish`. It requires POST and a MediaWiki CSRF token. The module also rejects non-POST internal requests explicitly, because core's internal ApiMain mode skips external HTTP response setup. Normal core write-mode protections still apply.

| Parameter | Required | Contract |
| --- | --- | --- |
| `owner` | Yes | Local owner-page title, at most 512 UTF-8 bytes. Invalid, special, interwiki or fragment-bearing targets are rejected. Redirects are not followed by the publication service. |
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

Expected publication failures use an explicit allowlist of the service's codes: `layers-owner-edit-denied`, `layers-invalid-publication-request`, `layers-main-model-change-denied`, `layers-invalid-snapshot`, `layers-source-unavailable`, `layers-edit-conflict`, and `layers-revision-save-failed`. Disabled construction yields `layers-publication-disabled`. Unrecognized or unexpected failures yield `layers-publication-failed`. English messages and translator notes are included; other languages use normal MediaWiki fallback until translations exist.

Unexpected service failures are logged server-side. Exceptions and their previous-exception chains are not serialized into the API result. Save/operational failure messages avoid promising that no commit happened: clients must retain unsaved work and inspect the latest revision before retrying an uncertain result. A retry with an outdated base must conflict, not overwrite. Stale-base conflicts have a specific response; late core conflicts still share the generic revision-save-failed response.

## Evidence and remaining gates

On MediaWiki 1.45.3/PHP 8.3.31, the API suite passed **21 tests / 56 assertions**, including the harness database-prefix safeguard. The full core suite passed **96 tests / 244 assertions**. API scenarios cover successful update/no-op and creation with main text, invalid-snapshot preservation, stale-request preservation, disabled requests, GET requests, missing/bad tokens, missing owner/base, negative base, invalid targets, oversized fields, denied Layers rights, configured rate limiting, and hidden operational diagnostics. Rejected request-boundary cases assert that the publication service is never invoked. A manifest assertion guards against accidental normal registration.

These tests use ApiTestCase's real internal ApiMain dispatcher and isolated database tables, not an HTTP client or browser. Test-only registration happens in the active request service context, including token-discovery requests. The explicit module POST guard is exercised; external HTTP response setup, proxy/body limits and browser session handling still need acceptance tests.

The successful API examples use empty snapshots; H3c exercises slide publication and H3b separately exercises real archived images. A single end-to-end real-image/PDF API test is still required. The handler currently enforces schema validity, but complete source/owner admission for every alternate core editing path is not yet implemented. Production registration must stay closed until that gap, historical delivery, adoption isolation and applicable lifecycle gates are resolved. There is no migration, legacy-save interception, public viewer or user-facing history guarantee in this milestone.
