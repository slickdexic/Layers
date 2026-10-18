# Whole-PDF Import preparation in an editor session

This unregistered component advances milestone 1, HIST-4, DATA-1 and SEC-2.
`PageOwnedWholePdfImportSession` binds the qualified read/planning path to a
real `PageOwnedEditorSession` in PDF mode. Existing editor callers, image/slide
Import, PDF editing, Undo, drafts and Save remain unchanged. There is no apply,
commit, publication or registration method in this component.

## Contract

Construct the component with the loaded PDF session, a
`PageOwnedWholePdfImportSource` instance and a native
`PageOwnedPdfEditorReadClient` instance. The caller captures visible work into
the session through the existing bridge before preparing Import.

`prepare()` accepts exactly `source`, `mode`, `maxLayers`, `allocateId` and
`assertCurrent`. The source descriptor contains `pageId`, `revisionId` and
`surfaceId`. The target owner, page, revision, anchor, saved base and complete
working document come from the actual session. No caller-supplied target
document or serialized admission facts are accepted as authority.

The mandatory `assertCurrent` callback synchronously checks all live editor,
canvas, selection and history participants. It returns `undefined` on success
and throws otherwise. It must not mutate work. The component separately
captures session field and method identities, complete snapshot content,
PDF selection/context/pin state, and both temporary/admission maps, including
their entry identities and complete values. It checks these before and after
asynchronous boundaries and callbacks. Preparation does not lock or alter
the live session; later user edits remain possible and refuse stale results.

Cancel returns null without payload reads, native requests or allocation.
The other modes retain the approved empty/Append/Replace semantics from
[whole-PDF planning](WHOLE_PDF_WORKING_COPY_IMPORT.md). Append preserves
existing target-only page layers. Replace prepares replacement of all layers
in the selected group, including clearing target-only page layers. Both
operations only produce a detached preview here.

## Temporary pages and historical association

For pages absent from the saved target group, the component checks the native
admission, target file version, geometry, rendition, member inventory and
deterministic member ID. An edited temporary member keeps its existing ID,
canvas and local layers. The planner omits only the redundant newly prepared
empty member for that same page. It never substitutes a blank for live work.

Temporary pages absent from the source group receive a separate fresh native
editor-page read. Unedited temporary pages remain temporary; they are not
inserted into the document merely because Import was prepared. Their exact
context is retained for the active-page preview and future application.

A member retained from an earlier target revision must match its session-held
blank and admission record. Its deterministic native ID and association with
the fresh current context are checked. The exact earlier owner revision is
freshly read and checked through the existing historical-origin rule: the
correct anchor/file/version/name must exist there and the admitted PDF page
must have been absent. A plausible ID or serialized prior association alone
does not pass. Revalidation repeats these reads and checks.

## Preview and lifecycle

`prepare()` returns a frozen opaque instance-owned handle. `inspect(handle)`
returns the complete source preview plus `activeSurfaceId`, `activePage`,
`editorState` and `preparedMembers`. Each prepared missing/temporary member
has its retained `surfaceId`, `page`, fresh native `context` and original
`origin` record. Stored target members use the native bundle's existing
geometry/rendition inventories. The complete candidate preserves unrelated
files, slides, layer sets and metadata.

`getReadEvidence(handle)` returns detached exact request/read data.
`revalidate(handle)` repeats the whole native read, page admissions and any
historical checks. Complete read drift, target-only rendition/context drift,
denial, changed participants, upstream handle disposal, transport replacement,
release and component disposal refuse the result. Inspecting a preview also
checks the underlying source handle's liveness. `release()` remains available
after live-work refusal; `dispose()` invalidates owned pending work and handles.
The provided source and session remain owned by their existing callers.

Every returned value is detached. Failures expose only
`layers-working-copy-import-unavailable`. Read evidence and previews do not
grant permission to apply or publish a candidate.

## Before activation

Whole-group checkpoints must connect atomic session, display, selection,
Undo/Redo and draft recovery. First-Save provenance must include every
contributing source page and repeat native authorization through the ordinary
owning-page publication path. Wholly missing target layer sets still require
creation admission. These dependencies must be qualified before editor callers
activate this preparation. Native/browser, supported-version/mobile and owner
acceptance remain open. This checkpoint does not complete milestone 1.

## Separately invoked session transaction

The read-only contract above describes the original preparation methods. A
separate opt-in transaction now applies a prepared complete PDF group to the
session snapshot and its temporary/admission maps together. See
[whole-PDF session transactions](WHOLE_PDF_IMPORT_TRANSACTION.md) for the added
methods and their guards. Existing callers and all default preparation methods
remain unchanged. The transaction does not update the visible editor, selection,
Undo, drafts or Save; those integrations remain required before activation.
