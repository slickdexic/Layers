# Whole-PDF Import editor composition

This component advances Milestone 1: page ownership and native page revision
history, including HIST-4, DATA-1, UI-10 and SEC-2. It assembles the qualified
whole-PDF components with the existing approved Import dialog. It is separately
invoked and has no production editor callers or ResourceLoader registration.
Client composition tests do not establish native or browser acceptance.

## Composition contract

`PageOwnedWholePdfImportIntegration` accepts a loaded, writable, stored PDF
bridge, a MediaWiki API client and the editor class registry. Images, slides,
historical views and creation of a completely absent target set retain their
existing paths. One PDF layer set still belongs to an owner, canonical file and
normalized name; its internal pages never become separate named choices.

Construction connects the grouped catalog, exact-source reader, actual session
binding and whole-group application. It enables complete-group history before
installing the qualified publication route. `enableDrafts(controller)` must run
before constructing the draft lifecycle. `mount(...)` accepts that same
controller's lifecycle and mounts the existing `PageOwnedImportControl`.
The existing dialog, translations, Append/Replace/Cancel actions and confirmation
steps remain unchanged. No new UI is activated by loading this file alone.

The adapter converts the dialog's `prepare(source, options)` call into the
application's exact request. Catalog display metadata is kept out of that
request. A privately associated catalog label supplies the dialog's preview
wording; it grants no read, application or publication authority. Exact source
and target reads remain authoritative. Discovery uses the saved target name;
the working name remains separately available for presentation.

Target emptiness and replacement counts cover the complete live PDF group,
including offscreen members and the active native temporary member. Other
files and other layer sets do not contribute. The active editor's latest layers
take precedence over its captured session state. Preparation and Apply recheck
the same dialog generation, lifecycle readiness and actual editor participants.
Cancellation, superseded dialogs, disposal and fresh source refusal preserve
current content and history.

## Save and recovery

Import changes local complete-group work. The existing lifecycle persists the
complete draft after application, and the qualified Save route persists a
saving-phase backup before publication. First Save submits one citation for
each imported source group, preserves target source versions and unrelated
content, and updates saved bases/history only after success. Sparse internal
pages retain their native admitted identity. Native authorization and ordinary
page revision writes remain the server's responsibility.

The actual draft controller/lifecycle recovers complete content, source claims
and usable group Undo/Redo after the existing explicit confirmation. Earlier
backups remain intact. Uncertain publication remains held for explicit revision
checking; it is never automatically retried.

## Activation prerequisites

Production callers must remain inactive until complete-group reconciliation
updates private source claims, checkpoints and routed history together with
the saved session base. Ordinary per-page base confirmation is insufficient.
Applying only a post-reconciliation history fix could leave partially changed
state if its later preflight fails; the complete operation must prepare before
committing any participant.

Pending group renames currently fail exact Import preparation without losing
the rename or layers. Qualify their complete identity/name handling before
activation; do not silently rewrite names or relax exact native admissions.
Creating a completely absent target PDF layer set is also a separate open
boundary from admitting missing internal pages of an existing set.

After those boundaries are qualified, register the required modules and connect
the existing editor composition point. Complete actual native/browser
selection, Append/Replace/Cancel, Save/reopen, recovery/conflict and export
journeys, supported-version/mobile and upgrade checks, final HTTP privacy
checks, and owner screen/flow acceptance. Preserve the existing image/slide
Import, ordinary PDF editing, tools, viewers and entry points throughout.

## Revision-check composition qualification

The separately invoked composition now also enables the application's private
whole-PDF revision-check route. Its staged session/checkpoint/source/history
contract is documented in [whole-PDF reconciliation](WHOLE_PDF_IMPORT_RECONCILIATION.md).
The existing non-opted reconciliation bodies remain intact. Client checks cover
success, complete refusal, late work, uncertain outcomes, group Undo/Redo and
draft recovery. Production APIManager callers and ResourceLoader activation
remain off pending the other activation and native/browser prerequisites above.

## Pending target names

The composition also exposes a separate `enablePendingRenames()` opt-in. It
preserves exact saved-name discovery and native evidence while importing into a
coherently renamed live target. Construction keeps the original refusal path.
See [pending-name preparation and recovery](WHOLE_PDF_IMPORT_PENDING_NAME.md)
for identity, Undo, draft and authorization boundaries. This does not activate
production editor callers or change existing controls or wording.

## Missing-target creation host connection

The existing PDF creation host now has an explicit Import connection to the
qualified missing-target reader, model and publisher. It prepares the complete
PDF group privately, applies the active editor state and every page timeline
together, and preserves destination geometry, unrelated content and source
references. Cancellation, late edits, changed native evidence and a newly imposed
recovery hold refuse before applying the prepared Import. A page turn invalidates
the preview; releasing it afterward is safe.

Version-3 creation drafts retain both the live Import capsule and the exact sent
publication attempt alongside complete per-page history. The actual creation
draft controller stores and explicitly restores that envelope through fresh
native admission. Serialized attempts restore only as uncertain. Ready older
source-free drafts remain recoverable without inventing source references;
older ambiguous attempts are not converted into Import authority.

First Save writes the complete backup before the source-aware publication
request. Only the actual publisher's request-bound confirmation acknowledges
success. A lost response retains the complete work and attempt and prevents
another Save; the older snapshot-only check cannot clear this Import hold.
After known success, fresh saved-session admission preserves newer edits and
both-page history. The returned creation backup keeps all original source
references and the sent attempt through that handoff.

This connects the real host, editor state/history classes, local draft controller
and transport in client tests. It does not activate an Import control, establish
a native browser journey, or complete Milestone 1. Advanced-base outcome
confirmation, the approved version notice and final UI connection remain open.
Existing ordinary creation and stored-target editor paths retain their defaults.

## Creation Import group history and source-free Save

The creation host's separate `enableImportHistory()` opt-in connects the existing
Undo/Redo controls to one complete Import operation. Undo restores all PDF members
and the prior source references; Redo reauthorizes the imported source and restores
the complete group. The current page, destination dimensions and unrelated layer
sets remain intact. Later edits on another page must be undone before crossing the
group boundary. Ordinary edits and their Redo branches keep their existing order.

History markers are bound to the host's private group records. Direct timeline,
state and jump operations cannot reverse only one member. Trimming or branching
away from a member makes that group unavailable, retaining surviving markers as
refusal barriers while ordinary later history remains usable. A refused or stale
restore preserves the complete editor state. If presentation fails after a
completed transition, the host records that a refresh is needed and reports the
completed transition accurately.

Version-4 drafts retain the complete before/after group capsules, exact timeline
entries, source references and publication attempt. The actual draft controller
stores and restores them after explicit confirmation. Restoring a group performs
fresh native admission; serialized source associations grant no authority.
Earlier version-3 Import drafts remain readable without fabricated group history.

When no source references remain, including after group Undo, Save uses the
ordinary publisher. Its version-2 retained attempt contains the exact ordinary
request and attempted source-free capsule. The backup is written before dispatch;
newer work and group Redo associations remain separate. Source-bearing Save keeps
its existing version-1 request-bound confirmation. Any non-null serialized attempt
restores uncertain and cannot authorize an automatic retry or mark work saved.

This qualification covers client creation history, drafts and Save. A host with
retained group history currently refuses saved-session handoff rather than
silently converting group Undo into per-page Undo. Complete group transfer into
the saved editor session is the next integration step. Production Import callers
remain inactive until that transfer, outcome confirmation and the remaining
approved UI/native/browser journeys are qualified.
