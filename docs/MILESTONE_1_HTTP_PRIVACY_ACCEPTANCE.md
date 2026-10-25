# Milestone 1: native HTTP privacy acceptance

This checkpoint advances SEC-1, SEC-2, SEC-4, SEC-6, HIST-4 and DATA-1 for page-owned layer
sets. It covers the published page-history candidate on native MediaWiki 1.44.6,
MySQL 8 and Apache. The wiki requires authentication to read. Existing saved
image, slide and two-page PDF owners supply the test data.

The initial 52 verified cases use real HTTP responses and complete native owner
readbacks. No content was published, no role or visibility setting changed,
and no runtime correction was needed for that baseline. Separate transition
checks now cover roles, permission revocation, revision visibility and file
deletion/restoration. They exposed a retained-data deletion defect, corrected
and replayed as described below. This is bounded acceptance, not a full security
audit.

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

## Native request limits

Page-owned snapshot, binding, control, viewer and editor-page reads use the
existing `editlayers-info` limit. Missing-PDF viewer admission uses that same
information budget. Missing-PDF editor preparation uses `editlayers-render`,
because it can prepare a native PDF rendition. Metadata does not spend the
separate PDF source-render budget. Existing configured values, exemptions,
authorization and private-response policies are unchanged.

Native HTTP controls first demonstrated that the information and render
counters were active. Six page-owned paths nevertheless succeeded after their
relevant counter was exhausted. The corrected paths now return the existing
`ratelimited` error before invoking the reader. Nine corrected HTTP checks pass,
including a fresh read-only account below its information limit and metadata
access after render exhaustion. The same exhausted sessions retain their native
counters after the source correction.

The new native regression suite covers seven read branches, including editing
controls: refusal before reader work, successful admission spending the correct
budget, and isolation from the other exhausted budget. Fourteen meaningful
failures before correction become 22 passing tests / 78 assertions afterward.
The full standalone suite passes 1,611 tests / 3,994 assertions with one existing
skip. No client code changed; the prior 18,923-test client result is retained.

All 160 affected cases across seven native classes are qualified with 1,619
assertions. This combines 149 retained passes with eleven successful replays;
it is not a single green 160-case run. The first run inherited a private-wiki
setting and read revocation from the HTTP fixture, causing MediaWiki to refuse
eleven public-read/authority cases before Layers ran. Only a separate native
test configuration was corrected. The eleven unchanged cases then passed with
126 assertions; existing tests and production permissions were unchanged.

All original fixture rows remain exact, including seven retained legacy rows.
Setup adds three disposable accounts and one main-only missing-PDF owner revision;
no Layers publication occurs. The accepted original fixture remains exact across
all 17 captured tables. Ordinary wiki content and configuration are unchanged.
This closes the demonstrated quota bypass, not the broader security review.

## Permission and visibility transitions

Twenty HTTP cases passed using native accounts and valid CSRF tokens. They
cover a read-only role, separate page-edit and layer-edit denials, page
protection, blocking and read-permission revocation. Reusing the same logged-in
session across transitions confirmed that authorization is checked again.
Refused publication attempts added no layer-set revision.

Twenty-four further cases passed for hidden and suppressed historical revisions,
authorized oversight reads, restored visibility and native file deletion and
restoration. Current and historical PDF reads were refused while the file was
deleted; unrelated image and slide owners remained readable. Native visibility
and role changes were confined to a disposable wiki. Page protection produced
two native metadata revisions whose complete main and layers contents remained
unchanged; these were not Layers publications.

## Retained legacy data during file deletion

The first deletion/restoration exercise found a production defect: the file-delete
hook removed two retained legacy rows after migration. Native file restoration
did not restore those rows. The original failed fixture remains retained.

Legacy deletion now reads migration completion from the primary database before
changing rows. After completion it preserves the read-only migration sources;
an unavailable completion check also refuses deletion. Pre-migration cleanup
keeps its existing behavior. Generated-cache purging remains active in both
cases.

A fresh corrected fixture passed thirteen HTTP lifecycle cases. All seven
legacy rows remained exact both while the PDF was deleted and after native
restoration. Deleted-file snapshot and exact-source requests still refused;
legacy reads also refused despite the retained rows. Both generated-cache
families were purged, and an existing cache URL stopped serving its marker.
Unrelated image and slide reads remained exact. After restoration, current and
historical PDF bytes, complete owner contents, native content/text tables and
file records matched their opening state.

Two standalone regressions and two post-migration native data sets demonstrated
the failure before correction. The corrected native slice passed five tests /
37 assertions, including image/PDF and pre/post-migration cleanup. The full
standalone suite passed 1,611 tests / 3,994 assertions with one existing skip.

## Preservation and limits

In the original read-only baseline, all seven owners, their histories and all
17 captured database tables remain exact. The transition fixtures intentionally
change native account, visibility, protection and deletion metadata. Their
content-preservation checks are reported separately above; whole-database
equality is not claimed for those fixtures. Existing wikis and the accepted
original fixture were not modified.

The earlier harness expectations for current binding cache age, compressed
Content-Length and optional HEAD length were corrected against the maintained
native contract and HTTP semantics. Original responses and failures remain
retained. Passed cases were reused; no unchanged full suite was rerun locally.

Still open: broader security review, other release combinations, performance
and owner acceptance. The earlier 52 baseline cases and 44 transition cases
are retained without repeating unchanged checks; the thirteen-case corrected
replay specifically qualifies the file lifecycle and preservation fix.
This checkpoint does not
qualify annotated Download, Print preparation, the OS print dialog or physical
output. The in-app browser's download observer stalled outside Layers; that
observation path is excluded from subsequent checks.

## Native Save source admission

A separate native publication check reproduced a preparation-time race on
ordinary Save. Changed image/PDF sources passed initial admission, then lost
read permission, visibility or accessible bytes during native preparation.
The ordinary API supplied no specialized caller guard, so publication continued.
Six revocation cases and two final-check assertions demonstrated the gap.

Publication now rechecks the exact changed surfaces with the original authority
after preparation and any stricter caller check, before granting the native
publication scope. Refusal uses the existing source-unavailable error and
preserves complete content/history rows. Unchanged inherited sources retain
their exemption, so an unavailable file does not prevent an unrelated slide
edit. Existing stricter caller refusals retain their error contract.

The regression uses the real native page writer and preparation/admission
boundary, with controlled repository availability. It does not claim source-byte
disclosure, a concurrent HTTP/browser reproduction or full-release security
acceptance. Ordinary wiki data and configuration are outside the test database.

The affected native classes pass 99 tests / 340 assertions. The unchanged retained
migration/copy guard class passes another 12 tests / 122 assertions, including
its stricter post-preparation refusals. Standalone PHP passes 1,611 tests /
3,994 assertions with one existing skip. The grouped-PDF regression now requires
the same expanded sibling/source selection at both admission checks.
