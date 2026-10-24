# Milestone 1: native HTTP privacy acceptance

This checkpoint advances SEC-1, SEC-2, HIST-4 and DATA-1 for page-owned layer
sets. It covers the published page-history candidate on native MediaWiki 1.44.6,
MySQL 8 and Apache. The wiki requires authentication to read. Existing saved
image, slide and two-page PDF owners supply the test data.

The 52 verified cases use real HTTP responses and complete native owner
readbacks. No content was published, no role or visibility setting changed,
and no runtime correction was needed. This is bounded acceptance, not a full
security audit.

## Read and publication boundaries

| Case | Observed result |
| --- | --- |
| Current snapshot, full-size viewer and editing controls | Authenticated reads preserve the saved payload. Responses remain private with zero cache age despite client-supplied cache ages. |
| Historical viewer | Returns the exact older revision, with private zero-age caching. Newer edits are absent. |
| Foreign revision, foreign or missing binding, invalid owner fragment or PDF page, invalid revision and missing required owner | Refused without layer payload. Invalid binding-only selections are omitted according to the existing read contract. |
| Anonymous snapshot, viewer and control requests on the private wiki | Refused without exposing layer payload or editor data. |
| Publication by GET, POST without a token and POST with an invalid token | Refused; no publication result or new content revision. |

Ordinary binding-only reads of the current revision retain the existing
configured cache policy. A logged-in response stays private; the module's
300-second limit overrides a client request for a longer age in this fixture.
Viewer, editing-control and historical responses retain zero age. This check
does not change the cache policy or qualify public-wiki anonymous caching.

## Exact PDF source delivery

The source endpoint reauthorizes the owner revision and stored binding. This
delivers the original pinned PDF, not the viewer's annotated Download output.

| Case | Observed result |
| --- | --- |
| Authenticated GET | HTTP 200; complete bytes match the pinned source exactly. |
| Authenticated HEAD | HTTP 200 with no body, the PDF content type and the same privacy policy. This server omits Content-Length on HEAD. |
| Start, suffix and unsatisfiable ranges; Range with If-Range | Returns the complete verified PDF as HTTP 200 with Accept-Ranges: none. Partial-range support is intentionally absent. |
| Client-supplied maxage and smaxage | Cannot relax the endpoint's privacy policy. |
| If-Match, If-None-Match, If-Modified-Since and If-Unmodified-Since | Refused with HTTP 400 after authorization; no reusable 304 or PDF body. |
| Foreign owner/revision association, missing binding, invalid revision, extra query parameter or owner fragment | Generic HTTP 404 without PDF bytes. |
| Missing or array-shaped parameters, unsupported method, unmatched route descendant and incomplete creation-source request | Refused with privacy headers, including framework-generated errors. |
| Anonymous GET, HEAD, conditional and range requests | Generic HTTP 404; no source bytes. |

Every checked PDF success and refusal uses private, no-store, no-cache,
zero-age cache control, Pragma: no-cache, an expired Expires value and
X-Content-Type-Options: nosniff. ETag and Last-Modified are absent.

The compressed response was checked after Fetch decompression against the
original source. Direct length checks requested identity encoding. HEAD's
Content-Length omission is allowed by
[HTTP semantics, sections 9.3.2 and 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.2);
when that header is sent on HEAD, it must describe the corresponding GET
representation.

## Preservation and limits

All seven owners retain their complete contents and native revision histories.
All 17 captured database tables remain exact. Legacy sets, file versions, main
text, source pins, geometry and offscreen PDF members remain unchanged.

The earlier harness expectations for current binding cache age, compressed
Content-Length and optional HEAD length were corrected against the maintained
native contract and HTTP semantics. Original responses and failures remain
retained. Passed cases were reused; no unchanged full suite was rerun locally.

Still open: a separate read-only role, permission/visibility revocation and
suppression/deletion transitions, broader security review, other release
combinations, performance and owner acceptance. This checkpoint does not
qualify annotated Download, Print preparation, the OS print dialog or physical
output. The in-app browser's download observer stalled outside Layers; that
observation path is excluded from subsequent checks.
