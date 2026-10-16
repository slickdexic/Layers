# Confirmed PDF creation: saved-session handoff

This component advances milestone 1 / HIST-4, HIST-1, DATA-1 and UI-10. It is
inactive: ResourceLoader registration, bootstrap, existing editor callers and
visible controls are unchanged. It does not qualify the browser journey.

## Contract

After a known successful first Save, call the creation host's asynchronous
`handoffSavedSession({ reader, pdfReader, publisher })`. Use the exact-revision
page reader, saved-PDF editor page reader and existing publisher. Missing-PDF
creation reads must not be used once the group exists.

The host requires a confirmed creation transaction, a retained native receipt,
live unchanged editor participants, no recovery/publication hold and no pending
Save. Local confirmation is not authorization. A private saved session loads the
real stored initial anchor through the existing admission guard. Fresh native
reads must return the exact confirmed full snapshot and matching owner PageID,
revision, binding, source pin, group inventory, count and internal page.

The adapter applies current canvas/layer edits privately to that fresh base,
retaining root fields, other layer sets, unknown values and confirmed surface IDs.
Only unpublished optional pages can acquire a new temporary ID; the association
must match native owner/revision/file/name/internal-page identity. Layer IDs and
complete Undo/Redo branches stay intact. Blank pages with Redo history still
receive native admission. For a confirmed optional page reverted to empty, use
its retained exact creation canvas, rather than guessing another page's defaults.

The visible editor remains on its active page while the initial anchor loads
privately. The actual target background is decoded with native canvas geometry
kept separate from rounded rendition dimensions. Complete live-work witnesses run
across reads and decoding. Native authorization repeats after decoding. State,
per-page history, dimensions and ownership transfer synchronously after final
preflight; refresh notifications happen afterward. Current selection is retained.

The returned object contains `bridge`, `coordinator`, isolated `creationBackup`,
validated `remapping`, and `needsRefresh`. The bridge/coordinator own the saved
session. The old creation host is retired only after commitment. Callers must
retain the returned owners and backup; this component does not install itself in
APIManager or retire/delete local draft records. The saved bridge preserves finite
layer values exactly instead of applying the older cleared-field normalization.
Subsequent explicit Save uses the existing native revision publisher and preserves
newer work and success-only saved markers.

Before commitment, any refusal leaves the creation editor, known confirmation,
all histories, backups and participants intact. A refresh failure after commitment
returns the saved owners and known receipt with `needsRefresh: true`, and holds
further publication. Do not report that outcome as an unsaved first Save.

The existing sparse-page association helper uses registered dependencies under
ResourceLoader and relative require only when actual CommonJS support exists.
Its ID calculation and native association rules are unchanged.

## Open integration

Explicit reconciliation of uncertain/held outcomes and confirmed backups is
separate. No automatic retry or local hold clearing is provided. Earlier-revision
PDF recovery still requires native historical association proofs. Autosave,
pagehide/close, owning-page return, ResourceLoader/bootstrap/overlay wiring and
real isolated HTTP/browser acceptance remain open. Mobile, MediaWiki 1.44 and
owner acceptance are not claimed. This checkpoint does not complete milestone 1.
