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
