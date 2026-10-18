# Whole-PDF Import application

This explicitly invoked, unregistered component advances milestone 1, HIST-4,
DATA-1 and SEC-2. It connects the qualified whole-PDF session transaction to the
actual active editor, selection and PDF page timelines. No existing Import,
Undo, Redo, draft, Save or UI caller is changed or activated.

## Application contract

Construct `PageOwnedWholePdfImportApplication(bridge, binding)` with the loaded
page-owned PDF bridge and its `PageOwnedWholePdfImportSession`. The component
requires the actual session association and real coordinator, StateManager,
HistoryManager and SelectionManager instances belonging to that editor.
Matching serialized IDs or a same-class component from another editor do not
establish the association.

Capture current editor work through the existing bridge before preparation.
`prepare(request)` accepts the same exact five data properties as the session
binding: `source`, `mode`, `maxLayers`, `allocateId` and `assertCurrent`. A getter
is refused without invoking it. Cancel returns null without requests or work.
The mandatory synchronous participant callback returns `undefined` or throws.
Preparation and `inspect(handle)` do not change live editor or session state.
Inspection returns a detached complete preview.

`apply(handle)` freshly revalidates the native complete source/target read and
all temporary/historical admissions. It privately prepares the complete session
commit, active editor patch, valid active-page selection and every affected page
timeline. The session, visible work, histories, component identities, methods,
background, navigation state and writable assignment slots are checked before
and after awaits and callbacks. Active transforms, batched history, locked or
destroyed state, page loading, concurrent application and later work refuse.

After the final preflight, one synchronous sequence commits the complete session
snapshot/admission maps/source claims, active editor state and selection, the
coordinator timeline map and the active history. No rendering, notification,
native read or other external callback occurs between these data writes.
Append/Replace retain their approved complete-set meaning and preserve target
pins, geometry and unrelated document content. The active PDF page, URL and
background rendition remain selected. Imported IDs on offscreen pages are not
selected in the active editor.

Notifications and rendering run after all data commits. Failures are returned
as diagnostics and do not turn an accepted data commit into a claimed refusal.
The result contains detached transaction data, an opaque group `command` and
`diagnostics`. A consumed source handle cannot apply again. `release(handle)`
and `dispose()` clean up owned preparations without disposing the provided
session, bridge or binding.

## Explicit group Undo and Redo

`undo(command)` and `redo(command)` are synchronous, explicitly invoked APIs.
They restore the selected PDF layer set as one operation, including every
affected member, temporary/historical associations, source citations, page
timelines and active display. The currently viewed page stays selected, including
an admitted page that was blank before Import. A native blank association may
remain temporary to keep that page view valid; it is not promoted into saved work.

The complete selected group and affected histories must still match the expected
side of the command. Later edits to any group member refuse rather than discard
work. Unrelated live files, layer sets and document metadata are preserved.
Commands belong to their issuing application and saved-base scope. Foreign,
released or disposed commands, the wrong Undo/Redo order, stale checkpoints,
changed participants and competing operations refuse without partial restoration.
`releaseCommand(command)` releases both private session checkpoints.

The binding adds separately invoked `ownsSession`, `prepareImportRestore`,
`inspectImportRestore`, `commitImportRestore` and `releaseImportRestore` methods.
Restore accepts only privately issued expected/target checkpoint tokens from the
same binding and saved-base scope; serialized checkpoint data grants no authority.
Its mandatory final synchronous callback and complete witness precede every write.
Original preparation and session commit methods remain unchanged.

## Activation dependencies

These APIs do not reroute the existing toolbar or HistoryManager Undo/Redo. Those
existing methods still operate per page. The new application must remain without
editor callers until complete-group command routing, interaction with later
ordinary edits, history trimming and command disposal are qualified. Applying it
through the current per-page Undo route could leave a partially undone Import.

Draft persistence/recovery of content, source claims and group history; ordinary
Save request/provenance wiring and saved-base reconciliation; missing target sets;
and native/browser, supported-version/mobile and owner acceptance remain open.
Explicit client application and group restoration do not establish native Save,
draft recovery, existing Undo routing or milestone-1 completion.

## Opt-in history routing follow-up

`enableHistory()` now separately enables the actual HistoryManager route before
preparation or application. Existing editor callers do not invoke it. With this
opt-in, ordinary Undo/Redo reaches a complete-group transaction at Import markers
and preserves later ordinary redo entries. Page-turn preflight, retirement after
trimming or branching, and surviving refusal barriers are documented in
[whole-PDF Import history routing](WHOLE_PDF_IMPORT_HISTORY.md).

The earlier activation warning still applies to existing flows without this
opt-in. Draft persistence/recovery, ordinary Save and saved-base reconciliation,
missing target sets and native/browser/owner acceptance remain prerequisites to
activating the complete editor Import flow.
