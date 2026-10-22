# Whole-PDF Import: first Save into an absent layer set

This inactive native service advances page ownership and revision history,
data preservation and authorization. It adds no caller, endpoint or interface.

PageMissingPdfImportPublicationService publishes a complete proposed document
through the existing MediaWiki page publisher. Its target is an existing owner
whose saved direct PDF embedding names a layer set with no stored member.
The request supplies the current revision, exact embedding bytes and byte
offset, plus exact source owners, revisions and member anchors.

Native admission supplies every PDF page. All internal pages keep the same
visible layer-set name and native current-base member IDs. Different readable
versions of the same PDF are permitted. Source layers match destination pages
by page number; the destination retains its admitted file version, canvas and
background. Layer coordinates are not automatically scaled. Both file versions
remain subject to independent exact-version and visibility checks. The approved
version-difference notice belongs to the separate interface integration.
Pending renames and older temporary member IDs remain separate integration work.

The proposed document must retain the complete original root and sibling layer
sets. Only canvas, layers and reading order may change on the admitted members.
Even an empty source page has a destination member. Unsupported fields, omitted
pages, stale revisions and altered file or owner identities refuse the Save.

Each distinct source owner/revision/file/name group receives one native revision
summary citation. Repeated member anchors do not duplicate it. Optional owner
words are appended; provenance is never truncated to fit.

The service repeats current-owner authorization, original-base visibility,
source visibility and exact file witnesses immediately before publication and
again afterward inside a cancelable native transaction. A late refusal rolls
back the entire Save. The normal publisher retains its secure write and rate
checks; the service does not retry against a newer revision.

Preparation results are detached evidence, not authorization tokens. Complete
editor application, Undo/drafts, HTTP delivery and browser acceptance remain
required before activation.

## Registered native request boundary

Separate native API callers extend the service-only scope above. They are
registered; production editor and Import controls remain unconnected to them.
Existing stored-target APIs and interfaces keep their existing behavior.

The POST-only layersmissingpdfimportread action requires targetpageid, baserevid,
embedstart, embedtext, sourcepageid, sourcerevid and sourcesurface. It repeats
native admission and returns a version-1 ASCII-JSON data envelope containing
targetAdmission, source, sourceBundle and sourceGroup. Responses request private
zero-age caching. The native read rate limiter still applies. A preparation is
never a token authorizing application, recovery or Save.

Embed text, source member IDs and submitted JSON use native raw parameters:
their exact UTF-8 bytes are preserved without Unicode normalization. Native byte
limits and the services' syntax, identity and authorization checks still apply.

The layersmissingpdfimportpublish action requires POST, a CSRF token, editlayers
and native Save rate checks. It takes targetpageid, baserevid, embedstart,
embedtext, data and importsources, with optional summary. Each source record
contains exactly sourcePageId, sourceRevisionId and sourceSurfaceId. Literal
duplicate JSON member names and malformed records refuse before publication;
identical repeated records receive only one native source citation. Arbitrary
maintext replacement is refused.

A successful write returns version 1, result Success and the new revid. If
publication committed but the success response cannot be delivered, the result
is layers-publication-outcome-unknown. Callers must not treat that as a refused
Save or retry automatically. Exact embedding bytes, current revision and fresh
per-side visibility/file checks are repeated by the native services.

Native API execution does not qualify final HTTP/session headers, editor
application, pending names, historical temporary IDs, browser/mobile or owner
acceptance. Those remain required before complete Import activation.

## Literal Unicode in existing Save requests

The existing layerspublish data parameter and
layersworkingcopypdfimportpublish data parameter preserve literal UTF-8 snapshot
text using MediaWiki's native raw parameter type. The ordinary layerspublish
maintext parameter likewise preserves submitted wikitext. A decomposed accent
and its composed equivalent remain distinct, whether the caller uses literal
Unicode or JSON escape sequences. Snapshot serialization still uses the existing
canonical JSON format; content strings are not normalized or repaired.

Existing byte limits, schema validation, owner/source checks, CSRF requirements,
rate limits and failure handling continue to apply. Titles and edit summaries
retain their existing native parameter handling. This preservation correction
does not activate additional editor callers or change the Import interface.

Creation Import for image and slide targets also preserves literal saved content.
The layersworkingcopyimportcreationread embedtext parameter,
layersworkingcopyimportcreationpublish embedtext and data parameters, and
layersworkingcopyimportcreationrebase origintext parameter use native raw
handling. Exact embedding witnesses retain their original UTF-8 byte offsets
and Unicode spelling; valid captions are not normalized before comparison with
the saved revision. Imported layer text and unrelated sibling content retain
their original spelling at first Save. The existing native byte limits,
authorization, schema, source, provenance and refusal checks remain in force.

Creation read and historical rebase callers can request exacttext=1. In this
mode the existing private POST route returns version 1 and an ASCII-JSON data
string; decode data to obtain the same service result. This preserves Unicode
and stored keys through native API result handling. Result-size checks remain
enabled, and an oversized result is refused without a partial module payload.
The default response remains compatible; exact transport requires opt-in.
Omit exacttext for the legacy response. As with native boolean flags, supplying
the parameter enables it regardless of its value.
First Save still uses its existing result/revid response. Editor callers must
explicitly adopt exact read transport before claiming complete Import support.

## Exact transport in existing image and slide Import clients

Saved working-copy Import read and historical creation-draft rebase also accept
exacttext=1. Omission keeps their legacy response shapes. Exact mode returns
version 1 and an ASCII-JSON data string with native result limits still enforced.
Saved read keeps GET; creation read, historical rebase and draft rebase keep POST.
All existing authorization and visibility checks remain in place.

The existing image/slide Import clients request exact mode for saved read,
creation read, historical rebase and historical draft rebase. They require the
exact version/data envelope, ASCII JSON and unique literal object keys, including
equivalent escaped keys. Malformed, partial, non-ASCII and legacy plain responses
are refused; there is no fallback that silently normalizes stored content.
Decoded data still passes the original shape, identity and participant checks.
Preparation, revalidation, cancellation and refusal retain their existing draft,
selection, Undo and publication safeguards. First Save and its receipt are unchanged.

This transport correction does not establish complete missing-PDF Import,
HTTP/session privacy, browser/mobile, supported-version, upgrade or owner acceptance.

## Exact admission reads for a new PDF layer set

The existing POST-only `layerspdfcreationread` action accepts optional
`exacttext`. Omitted by legacy callers, it retains their structured response.
Exact mode returns only version 1 and an ASCII-JSON `data` string, preserving
literal main text, original layers content, sibling layer sets and native PDF
admissions through MediaWiki formatting. Normal result-size limits still apply;
an oversized result refuses rather than returning a partial preparation.

The saved embedding uses a native raw parameter with its existing byte limit.
Its exact bytes and offset remain subject to native saved-embedding admission;
canonically equivalent Unicode is not substituted for the stored occurrence.

The existing PDF creation reader requests exact mode. It rejects malformed,
non-ASCII, duplicate-key and legacy responses before the original owner, revision,
selection, page and model checks. Empty admissions remain separate from the real
saved base, including an absent layers slot. Page turns, drafts and first-Save
revalidation use that same fresh read. No new Import control is activated here.

This advances page ownership and data preservation. Complete missing-target PDF
Import, final HTTP/session delivery and browser/owner acceptance remain open.
<!-- Existing contract remains above; this section is an additive client boundary. -->

## Native read connection for a completely missing PDF layer set

`PageOwnedMissingPdfImportReadClient` is a separate, explicitly constructed
client for the registered missing-target read action. It is not installed in
the editor and does not change the existing stored-target Import path.

Its request contains exact target and source owner/revision/member descriptors
and the target's saved embedding bytes and UTF-8 byte offset. Every read uses
a fresh native POST. The response must be the version-1 ASCII JSON envelope;
malformed data, decoded duplicate object keys, identity changes, mismatched
group inventories and missing or inconsistent target pages refuse with the
fixed Import-unavailable error. It does not cache, retry, apply work or publish.
Disposal, a newer read and replacement of the captured transport invalidate
pending replies.

The result retains the genuine saved base separately from the complete empty
target-page admissions. The client validates each admitted page through the
creation transaction's existing model; it never inserts a saved target anchor.
The existing whole-PDF read client exposes a source-only validator that checks
a real stored source bundle and its complete group inventory independently of
any stored target. All original stored-target read behavior remains in place.

The source must belong to another owner and match the destination's canonical
file and normalized layer-set name. Different readable versions are allowed;
source pages must fit the admitted target page count. Canvas geometry and
native rendition dimensions remain separate, including one-pixel thumbnail
rounding. Literal main text, base text, unknown values and nulls are preserved.

This is a read connection, not an editor application or publication token.
Complete-group application, Undo, drafts, recovery and source-aware first Save
must repeat their own live-work and native authorization checks. The approved
version-difference notice must also be qualified for empty-target Import
before the editor route is activated.

## Explicit creation-model Import transactions

The existing PDF creation transaction has a separate `enableImports(api)`
opt-in for model-only complete-group Import. Existing callers do not enable it.
Ordinary creation methods and their defaults remain in place.

`prepareImport` reads the native missing-target preparation twice around private
whole-PDF planning. Both complete results must agree. The original saved main
text and nullable layers slot are retained separately from the admitted pages.
The candidate contains every target PDF page, including blank ones, as required
by the native missing-target publication boundary. Append retains existing
layers and source references; Replace resets the complete group's active source
references. Destination pins, geometry, unrelated sets and unknown values stay
intact; imported groups and reading-order references receive consistent new IDs.

Only an owned, single-use `commitImportPlan` can change the model. A final
synchronous guard runs before private member, page and source-reference changes,
with no await or notification inside that commit. Edits, page changes, disposal,
changed source evidence and stale handles refuse without overwriting newer work.

Owned before/after checkpoints retain the entire group together with its source
references. A separate version-1 recovery capsule contains the ordinary creation
draft and `sources`, each binding the provisional target anchor to an exact source
descriptor including its owner. Serialized data is never authorization. Explicit
Import recovery rereads the native target and each historical source, validates
the complete candidate and repeats source evidence before issuing a commit plan.
Append deduplicates each source owner/revision/file/name group; at most 32 groups
can be retained. Missing or changed associations refuse rather than being repaired.

The ordinary draft export, draft-recovery and Save methods refuse in this explicit mode.
They cannot erase the source references or publish through the ordinary writer.
Actual editor/Undo routing, draft-controller integration, source-aware first Save,
unknown-outcome citation proof and saved-session handoff remain required before
activating this route. A matching saved payload alone cannot prove provenance.

## Explicit first Save for a missing PDF Import target

A separate publication client and creation-transaction `saveImport` method
connect complete imported groups to the registered native first-Save boundary.
They remain explicitly enabled components with no active editor callers.
The existing ordinary Save, recovery and creation defaults remain unchanged.

The request preserves the original embedding byte offset and exact text,
complete snapshot and bounded source revision/member identities. Backup
persistence precedes two fresh native source/target reads. Only an owned
confirmation from the actual client, bound to its complete captured request,
acknowledges a successful Save. Returned JSON alone is not confirmation authority.

The complete attempted capsule and request remain inspectable separately from
newer live work. Source references are retained even after success until the
saved-session handoff can acknowledge and remap them. Native stale-base refusal
holds the conflict; interrupted or malformed responses hold an uncertain outcome.
There is no automatic retry or snapshot-only acknowledgement of attribution.

Publication-state deserialization and recovery, native citation reconciliation,
saved-session handoff, actual editor/Undo/draft routing and complete native/browser
acceptance remain required before activating this path.

## Same-base recovery of a complete Import publication backup

The explicit creation transaction can privately prepare and atomically commit
the complete publication-state envelope against the unchanged native base.
The live capsule and attempted capsule are independently reauthorized, including
their complete page snapshots, source associations and original embedding/base.
The attempted request must match its snapshot bytes and source descriptors exactly.

Newer live work remains separate from the sent snapshot. Every non-null serialized
attempt restores with an uncertain hold, including data that claims confirmed or
refused status. The complete original attempt remains available as evidence, but
serialized fields never grant confirmation, a saved marker or permission to retry.
A null attempt can restore ready work only before any live attempt exists.

Preparation and cancellation change no work. Only a transaction-owned, single-use
plan can apply all pages, source references and attempt/hold state together after
the final live-work guard. Refusal preserves both current work and backup data.
The methods do not write to the wiki or local storage and have no active UI callers.

Changed-base admission remains a refusal. After the attempted Save advanced the
owning page, a source-aware saved/outcome route is required; a matching stored PDF
alone cannot prove attribution. Advanced-base recovery, citation reconciliation,
saved-session handoff and editor/history/draft-controller acceptance remain open.

## Native revision-comment evidence

The guarded missing-target PDF Import publisher stores a small versioned request
digest in MediaWiki's native structured revision-comment data, in the same
cancelable save as the page revision. Readable attribution and owner words stay
unchanged. Normal publication callers omit structured data by default.

The digest binds the native target page, original revision, embedding byte offset
and text, original submitted snapshot string, ordered source descriptors including
duplicates, and native parsed note before trimming. Descriptor object key order
does not change native values. Snapshot and embedding string bytes remain exact.
The existing API string processing may normalize the note before publication;
the digest describes the parsed request, not the original HTTP note bytes.
Only the digest is stored here; source descriptors and content are not duplicated.

This metadata is reproducible evidence, never authorization or a client proof.
Any outcome reader must independently verify owner/parent, visible revision text
and comment, saved content, original embedding/base and fresh source/file checks.
No confirmation reader, saved-session handoff or editor caller is activated by
this internal persistence mechanism. Recovery after an advancing Save remains open.

## Checking a lost Import Save response

The existing Import publication client has a separate read-only Check request.
It preserves the attempted snapshot, native request and complete current draft.
No publication request is retried. The registered private POST boundary requires
CSRF, the Layers editing right, current owner/edit access and bounded inputs.

Confirmation requires the current owning-page revision to be the original base's
direct successor. Both revisions' visible page text and exact saved embedding
must agree. The base must have no member of the new PDF group; existing sibling
surfaces and document fields must survive unchanged. Native current embedding
admission, all original-base-derived page IDs, the complete PDF inventory, exact
saved snapshot, visible native comment and full request receipt must agree.
Fresh source-owner, historical revision and pinned-file checks are repeated after
media callbacks. A matching payload or reproducible receipt alone proves nothing.
The transport uses the same raw strings, descriptor capture/deduplication and
native parsed note processing as Save, including its Unicode normalization.

The client returns an opaque confirmation bound to its actual request, owner and
client instance. Serialized fields, cloned objects and ordinary publication
responses cannot supply this confirmation. A private reconciliation plan repeats
complete live-work, participant, method and independent-backup checks before one
synchronous model/state/history transition. Only the sent snapshot receives saved
markers; newer work, source references, per-page timelines and whole-group history
stay intact. The existing saved-session handoff independently reauthorizes the
current saved revision before taking over the editor.

A source-free Save after Import Undo uses the ordinary outcome reader and keeps
the group Redo branch. A base-current read leaves the Import hold intact because
the delayed request may still arrive. A later successor, refusal, changed live
work or invalid backup preserves work and every hold without another Save.
Existing non-Import behavior and UI callers remain unchanged.

This connects retained-session checking and saved handoff. Restoring a creation
backup into a newly opened, advanced saved session still requires its explicit
recovery integration; unchanged-base restoration is not relaxed here. Complete
reload/reopen, HTTP/browser, supported-version and owner acceptance remain required.
