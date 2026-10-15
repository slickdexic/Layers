# Missing-PDF creation transaction

`PageOwnedPdfCreationTransaction` is an unregistered client component for the
first Save of a wholly missing PDF layer set. It advances page ownership and
native revision history. It has no editor, overlay or endpoint callers.

The input is an explicit native requested-page preparation from
`PageMissingPdfEditorReadService`. The original main text, raw Layers text or
absent-slot null, complete stored document and selection remain separate from
temporary PDF members. An existing set, including an empty or sparse one, is
refused. A stored-anchor session is never fabricated.

The component starts on the requested page. All internal pages share the
original label and exact source version. Deterministic member IDs include the
owner, base revision, file, normalized label and internal page. It prepares only
requested pages; visiting an empty optional page does not add it to Save. The
initial anchor is retained so an explicit first Save can create an empty set.
Original stored siblings, document metadata and unknown values are preserved.
Native source geometry and rounded rendition dimensions are distinct.

`preparePage()` and `prepareDraft()` return single-use, transaction-bound handles.
They do not change the visible model. The host stages the background and validates
the complete editor and per-page Undo state before calling synchronous `commit()`.
Edits, another preparation, Save, cancellation or disposal invalidate the relevant
handle. Same-base draft recovery rechecks each recovered page through the native
reader and preserves backups and current work on refusal or cancellation.

`save()` captures a complete document before asynchronous draft storage, repeats
native admission for every member being added, then uses the existing native
publication transport. It omits main-text replacement. Only a successful response
with a newer revision confirms the captured base. Newer local edits remain in the
current snapshot. Refused Saves retain the model; conflicts and uncertain outcomes
require explicit reconciliation rather than automatic retry. The native publisher
remains responsible for authorization, source validation and competing revisions;
client preparation is never authorization to write.

After success the transaction is `confirmed`, and returns the confirmed document,
revision and current work for an explicit host handoff. It does not silently start
another creation Save or reuse an old creation selection against a new revision.

## Integration still required

The injected reader must call the authorized native boundary on every request;
a cached preparation is insufficient. This component does not register that
transport or integrate `PageOwnedPdfEditorCoordinator`, `HistoryManager`, draft
storage/dialogs, saved-session handoff or the editor entry point. It neither
captures nor confirms Undo markers. The host must qualify those boundaries
together, including late edits at image/history staging, permission/source changes,
first Save and reopen, owning-page return and full-document exports.

Historical creation recovery, whole-PDF Import, browser/mobile acceptance and
supported-version qualification remain separate work. A 99-page count test proves
requested-page call bounds only; it does not measure real large-PDF rendering.
This component does not establish a completed page-history milestone.
