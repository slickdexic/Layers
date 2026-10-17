# Viewing a PDF before its layer set exists

The page-owned overlay supports a wholly missing named PDF layer set. Readers
use **View full size**; permitted editors also use **Edit layers**. `noedit`
keeps the viewer and suppresses the edit control. The same visible layer-set
name belongs to the whole PDF. Internal PDF page identity never changes it.

The viewer opens the native effective page and retains the existing zoom, pan,
fit, page navigation, Print, Download and Escape controls. Viewing publishes
nothing. Saving through the editor creates a native revision of the owning
wiki page and returns to that page on Close.

## Read and delivery boundary

The separate read-only `layerspdfcreationview` API admits an exact direct embed
in the current saved revision. It requires migration completion, eligible owner
scope, fresh owner/file read permission, visible revision and source, and no
stored member for that file and normalized layer-set name. Edit permission is
checked separately for the editor link. Stored/historical viewer routes retain
their existing admission rules.

The response describes an ephemeral empty PDF anchor, native page count and
source pin. It is viewer input, not a stored surface or publication capability.
Opening and exporting revalidate it. No legacy file lookup or another stored
PDF page substitutes for the selected page.

`GET` and `HEAD /layers/v0/pdf/creation` resolve the saved occurrence internally.
The bounded URL contains owner, revision, UTF-8 occurrence offset and a digest
of the server-derived selection. Captions stay out of the URL. The digest is a
comparison, not permission to choose another file or version. Delivery captures
a private native copy, verifies its hash and rechecks authorization and selection
before handing over bytes. Changed owners, source uploads, existing sets and
revoked reads refuse delivery.

The endpoint uses the existing native rate limiter and private/no-store/nosniff
response policy. It delivers a verified complete body, ignores Range rather than
returning an unverified partial PDF, and refuses conditional validators.

## Qualification and remaining work

Client coverage includes exact admission, changed-source refusal, both-page
rendering, full Print/Download assembly and cleanup. Native coverage includes
read-only and permitted anonymous users, exact page selection, no-write checks,
reupload invalidation, captured bytes, revoked reads, registered API/REST and
long captions. Desktop MediaWiki 1.45 checks cover overlays, native full-size
navigation, complete two-page Download, exact editor entry, first Save and Close
to the owning page. The saved main text and unrelated same-named slide remain
unchanged.

A separately embedded untouched page of an already sparse saved PDF set still
lacks its overlay. The saved-page viewer can navigate that page, but this does
not qualify its own on-page entry. Desktop toolbar Save clipping also remains;
the native check used keyboard Save. Native Print-frame/OS-dialog acceptance,
mobile, MediaWiki 1.44, whole-PDF Import and owner acceptance remain open.
These are explicit milestone-1 gaps; page ownership/history is not yet complete.
