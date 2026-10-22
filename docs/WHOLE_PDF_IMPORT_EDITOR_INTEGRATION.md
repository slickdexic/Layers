# Whole-PDF Import editor composition

This component advances Milestone 1: page ownership and native page revision
history, including HIST-4, DATA-1, UI-10 and SEC-2. It assembles the qualified
whole-PDF components with the existing approved Import dialog. The page-owned
ResourceLoader module registers them, and APIManager selects this composition
for writable saved PDF editors. The missing-target creation integration mounts
the same control. Client startup tests do not establish native browser acceptance.

## Composition contract

`PageOwnedWholePdfImportIntegration` accepts a loaded, writable, stored PDF
bridge, a MediaWiki API client and the editor class registry. Images, slides,
historical views retain their existing paths. Completely absent PDF targets use
the creation host described below. One PDF layer set still belongs to an owner, canonical file and
normalized name; its internal pages never become separate named choices.

Construction connects the grouped catalog, exact-source reader, actual session
binding and whole-group application. It enables complete-group history before
installing the qualified publication route. `enableDrafts(controller)` must run
before constructing the draft lifecycle. `mount(...)` accepts that same
controller's lifecycle and mounts the existing `PageOwnedImportControl`.
The existing dialog, translations, Append/Replace/Cancel actions and confirmation
steps remain unchanged. Empty Import still applies immediately. When the native
preview identifies a different file version, successful empty Import shows the
existing translated warning in a standard informational notification, retained
until dismissed. Nonempty Import keeps its existing version line in the dialog.

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

## Startup and remaining acceptance

Startup enables the qualified complete-group reconciliation and pending-name
routes. A durable first-Save handoff adopts the actual delivered application and
binding; it does not install a competing history owner. Fresh saved-editor startup
also enables earlier creation-backup recovery before the existing draft review.
Ordinary per-page base confirmation cannot replace complete-group reconciliation.

Complete actual native/browser
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
draft recovery. APIManager now selects that qualified route for saved PDF editing;
complete native/browser release acceptance remains required.

## Pending target names

The composition also exposes a separate `enablePendingRenames()` opt-in. It
preserves exact saved-name discovery and native evidence while importing into a
coherently renamed live target. Construction keeps the original refusal path.
See [pending-name preparation and recovery](WHOLE_PDF_IMPORT_PENDING_NAME.md)
for identity, Undo, draft and authorization boundaries. APIManager enables it on
the selected PDF composition without changing controls or wording.

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

Native creation startup now mounts the approved Import control. The host enables
Import lazily on the first selection, preserving ordinary creation and its older
draft/Save paths when Import is unused. Before initial review, a same-scope
version-3 or version-4 Import backup enables the required host mode so that its
fresh native admission and explicit Restore can run. Catalog choices remain
privately associated with this control and grant no source authority.

Client startup checks cover actual catalog selection, whole-PDF application,
first Save, native outcome Check, durable saved-session adoption and fresh
earlier-backup recovery. They do not establish a native browser journey or
complete Milestone 1. Images, slides and historical views retain their routes.

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

This qualification covers client creation history, drafts and Save. Complete
group transfer into the saved editor session is described below. The creation
integration connects these methods to the approved control; complete native
browser journeys remain required.

## Complete group history through first Save

For the creation history opt-in, confirmed first-Save handoff now uses the
existing saved-PDF Import recovery contract. Fresh native reads admit the saved
revision, every checkpoint side and each source reference. Prospective members
use their newly admitted native page identities; the saved document's source,
geometry, unrelated layer sets and metadata remain intact. Before/after group
capsules become private saved-session checkpoints rather than serialized
authority. Surviving markers from trimmed histories remain refusal barriers.

The new saved session, checkpoint bank, remapped timelines and certified history
route are prepared before replacing the creation editor. Complete participant,
timeline and publication-method checks repeat across asynchronous reads. The
final ownership transfer is synchronous. Refusal preserves the confirmed Save,
current layers, history, original route and complete creation backup. After
transfer, later edits remain ahead of group Undo, and both-page navigation keeps
the complete group association.

The returned `importApplication` and `importBinding` belong to the saved editor's
lifecycle. The application uses the existing saved draft controller, publication
and reconciliation routes. Group Undo/Redo remains complete after Save and local
draft recovery. Subsequent Save uses ordinary publication when no source claims
remain and source-aware publication when Redo restores them. Saved bases and
history markers advance only after success. Callers retain the complete creation
backup and dispose the returned group resources with the saved editor.

Client qualification covers those integrated paths and native-admission refusal
through real transport classes with controlled responses. It does not establish
HTTP/browser acceptance. Existing handoff without the history opt-in retains its
default path. Native startup now connects the Import control, outcome Check,
version notice and saved handoff. Complete HTTP/browser, supported-version,
mobile, upgrade and owner acceptance remain open.
