# Image and slide working-copy draft recovery

This opt-in client path preserves unsaved image/slide layer edits, reading order
and the actual Undo/Redo timeline. It supports the page-owned Import workflow.
It does not activate Import controls or change existing PDF draft behavior.

## Admission

Enable working-copy history on the freshly loaded editor before explicitly
enabling working-copy drafts on its draft controller. The loaded session supplies
the owning page, native base revision and selected member identity. Draft data
supplies editable canvas/layer data and history, never permissions or checkpoint
certificates. The selected source pin and unrelated members remain native data.

Recovery rejects a different owner, page, base revision or selected member.
Every history entry is checked against the current selected member and receives
a new private checkpoint. A saved history marker must match the loaded native
base. Unknown finite JSON values, including null, remain intact. Reading order
is retained; removing layers removes their reading-order references.

## Recovery transaction

Prepare recovery before the confirmation dialog. Preparation changes no live
session, editor, selection or history data. Check all participants again after
confirmation and after exact-base revalidation. Commit prepared session data,
editor state, selection and history synchronously, then refresh the display.
Refresh failures are diagnostics on committed work, not a refused transaction.

Late edits, changed participants, destroyed editors, unavailable reads and stale
handles refuse recovery without replacing live work. Cancel preserves the source
draft and blocks publication until the existing reconciliation flow resolves it.
The destination writer owns only its own draft records.

## Save and history

Backup remains available during saving, conflict and uncertain outcomes. Edits
not yet recorded as an Undo step become a separate recovered step. A draft at
the saved canvas can still recover its Redo branch. Independent session
timestamps alone do not cause another recovery prompt.

A successful Save establishes the native base used by later draft recovery.
Newer pending edits remain unsaved. Refused Saves preserve the prior base and
Undo marker. Only the normal page-owned publisher creates a wiki revision.

## Qualification limits

The maintained component tests use actual session, editor-state, history,
selection and draft components with controlled reader/publisher responses.
Import controls, first-Save copy provenance, whole-PDF Import, native browser
acceptance and project-owner acceptance require their own qualification.
