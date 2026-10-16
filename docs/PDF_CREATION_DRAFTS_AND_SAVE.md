# Local drafts and first Save for a missing PDF layer set

This unregistered client integration advances milestone 1 / HIST-4, HIST-1,
DATA-1 and UI-10. It adds no visible caller or ResourceLoader/bootstrap wiring.
The existing saved-PDF, image and slide paths, recovery dialog, wording and
publication API remain unchanged. Native/browser acceptance is still required.

## Scoped backups and explicit recovery

`PageOwnedPdfCreationDraftController(host, store, {wiki, user})` uses an existing
`PageOwnedDraftStore` with an independent 32-hex writer ID. Scope includes the
exact wiki/user, owning page title and ID, base revision and initial surface ID.
The captured native preparation additionally retains the exact saved embedding,
real absent/stored base, full main/sibling content, source pin and layer-set name.
PDF pages keep one visible name; their internal IDs never become separate names.

Call `review(ui)` before persistence or Save. The supplied interface is the
existing recovery dialog's `choose(candidates)` and `confirm(candidate)`. Current
revision candidates stay separate by their complete writer key. Review and
explicit Restore are separate; no source backup is deleted or adopted as the
destination writer. Corrupt or unprovable records remain intact. Cancellation
preserves current work and every backup and retains the current-revision
publication hold. It does not authorize autosave to overwrite a recovery source.

`persist()` stores a versioned creation envelope and per-page timelines under the
controller's own writer. Existing unknown writer bytes are refused, not replaced.
Readback verifies the written bytes. There is no automatic deletion or retirement
in this component. Disposing the controller does not dispose editor work or erase
backups. Scheduling autosave/pagehide/close belongs to subsequent editor wiring.

Host recovery uses `prepareDraftRecovery(envelope)` for an isolated preview and
single-use handle, `commitDraftRecovery(handle, checkSource)` after explicit
confirmation, and `releaseDraftRecovery(handle)` on cancellation. Every recovered
member, active/initial page and history-only empty page receives fresh native
admission. Empty pages can retain Redo even when they are absent from the prospective
snapshot. Complete live work and exact backup bytes are checked across every await,
then layers, per-page Undo/Redo, background and selection commit synchronously.
Changed source, owner, revision, history, participants, backup or geometry refuses
before replacement. Unexpected refresh failures after commit retain the restored
work, set `needsRefresh` and require fresh admission rather than automatic retry.

The transaction's optional `prepareDraft(input, {pages, guard})` preserves its
default behavior. Additional pages are native-read history carriers, not authority
to invent members. The guard is synchronous, checked around each requested read;
asynchronous or refusing guard results cannot authorize a commit.

## Explicit first Save and confirmation

`controller.save(summary)` persists a saving-phase backup before dispatch and
persists the resulting phase and latest work afterward. A failed backup refuses
publication. `host.save(summary, beforePublish, checkOwner)` is the underlying
boundary; a persistence callback is required. The optional synchronous owner
check is repeated through revalidation before dispatch. Newer layer edits and
Undo/Redo during storage, source reads or publication remain separate from the
captured sent snapshot. No main replacement or automatic retry is introduced.

The optional transaction Save guard changes no default caller. All recognized
native definite refusal codes remain definite; a bounded native invalid-snapshot
description survives for text-only display. Unknown outcomes stay uncertain.
Refusals do not change active or offscreen saved markers. Only confirmed successful
publication plus live participant checks marks matching history payloads saved.
Newer work stays dirty, and Redo to the confirmed payload clears dirty correctly.

The confirmed receipt and current snapshot remain separate, with their original
creation identity and complete histories. A valid native confirmation arriving
after participant loss remains a confirmed receipt with `hostReady:false`;
histories are not marked saved and work is not replaced. A final backup failure is
reported as `draftPersisted:false` without relabeling a known confirmation as a
failed publication. Saving/uncertain/conflicted recovery retains its hold. A
ready backup cannot clear an already-held publication state.

## Integration limits

The host stops at confirmed first Save. It does not silently turn that receipt
into a saved-session base or enable another Save. A fresh native saved-group
handoff must retain confirmed/current snapshots and all newer histories, including
visited empty pages whose temporary IDs may change with the revision. Confirmed
drafts and uncertain outcomes require that native reconciliation; local receipts
or historical association claims are not native authority. Earlier-revision PDF
creation recovery is not implemented by this same-base boundary.

Bootstrap/overlay callers, autosave/close scheduling, complete reconciliation,
real HTTP privacy/error delivery, native Save/return/reopen/viewer/export journeys,
mobile/MediaWiki 1.44 and owner acceptance remain open. Raw linked-caption admission
is still excluded by the existing source path. No later product milestone is
needed to finish this work, and this code checkpoint does not complete milestone 1.
