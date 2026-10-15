# PDF creation read transport

`layerspdfcreationread` is a registered, read-only native API boundary for a
wholly missing PDF layer set. It advances page ownership and native history.
It does not activate an editor, overlay or first-Save caller.

The request uses POST to keep the complete saved embedding out of the query
string. Parameters are `pageid`, `baserevid`, `embedstart`, `embedtext` and
`pdfpage`. The start is a UTF-8 byte offset; text is the full literal saved
occurrence. IDs are positive native IDs, the offset is nonnegative, and the
requested PDF page is within the document schema's 100-member ceiling.

The existing `PageMissingPdfEditorReadService` freshly resolves the owning page,
current revision, edit/read rights, scope, saved occurrence and exact native
source. It prepares the requested page, preserving the real stored/absent base
separately. Existing sparse or stored-empty sets are refused. The result is the
same native preparation consumed by `PageOwnedPdfCreationTransaction`.

Registration is lazy through the existing native pilot service. No container,
host service or external backend is required. Ordinary ownership/scope and
migration-completion requirements remain in force. The original request authority
is passed through; no privileged substitute or latest-revision fallback is used.

The API selects private, zero-age cache policy in its constructor and execution,
including parameter and service failures. It returns fixed unavailable errors
without diagnostics or a partial preparation. It requires no write token because
it does not write. Native publication must still repeat authorization, source
validation and competing-revision checks; a read result is never a write token.

`PageOwnedPdfCreationReadClient` is an unregistered client transport. Each call
posts a new native request and captures its options as finite JSON data. It checks
the returned owner, page/revision, anchor, occurrence and requested page, then
reuses the creation model's strict preparation validation in a disposable instance.
No read or publication occurs in that validation instance. Main/base bytes, null
values, siblings, source geometry and rounded renditions retain their native form.
Wrong-page responses and malformed data refuse; safe API refusal codes survive,
while private diagnostic text does not.

The registered API does not change the saved-PDF read route or any existing
editor, coordinator, history, draft, publication, overlay or viewer caller.
It retains the current conservative source-admission subset: nested linked
captions are refused, even though native rendering supports those captions.
No expanded rendering occurrence is substituted for a saved source occurrence.
Final HTTP headers, browser/mobile and supported-version acceptance remain to be
qualified with the complete editor path. Native API policy tests alone do not
establish final HTTP header behavior or a completed page-history milestone.
