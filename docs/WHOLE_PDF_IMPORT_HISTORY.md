# Whole-PDF Import history routing

This opt-in client boundary advances Milestone 1 / HIST-4 / DATA-1 / SEC-2.
It is not enabled by existing editor callers, registration or UI. Ordinary
editor behavior remains unchanged until the complete Import flow is qualified.

## Enabling the route

Construct the typed `PageOwnedWholePdfImportApplication` with its actual editor
bridge and whole-PDF session binding, then call `enableHistory()` before preparing
or applying Import. The application and actual HistoryManager exchange a private
certificate. Serialized history markers cannot register or authorize a command.
An application cannot attach to a foreign, destroyed, batching or incompatible
working-copy history, or attach twice.

The existing HistoryManager `undo`, `redo`, `canUndo` and `canRedo` methods consult
this private route. At an Import boundary, one action restores the complete PDF
layer set, its source claims and all affected page histories. The active PDF page
stays selected. Ordinary edits before and after Import use the existing per-page
history path. Later ordinary redo entries survive group Undo and Redo.

## Complete-group checks

Each affected timeline receives one opaque group marker. Its private record binds
the exact entry, member page, issuing application, saved base and session-owned
before/after checkpoints. A group action requires every affected page to be at
the corresponding boundary. Later edits on another member must first be undone
there. Source identity, complete group work, component identity and participant
methods are revalidated before synchronous session/editor/history assignment.

Copied timelines and page turns retain the group association. The coordinator
preflights a destination timeline before changing the session page or display.
Unknown, modified, released or phase-inconsistent markers refuse without falling
through to a partial page-only Undo. Direct timeline/state restoration cannot
cross the group phase. History jumps across an Import remain guarded; broader
history-navigation integration and its presentation are not qualified here.

## Trimming, branches and disposal

Leading history trimming remains compatible while every Import boundary and its
preceding state remain reachable. If a new branch, clear or capacity limit removes
a marker or its preceding state, the complete command is retired and both private
checkpoints are released. Ordinary edits remain undoable. Surviving markers remain
refusal barriers; reconstructing a removed marker cannot regain authority.

Explicit `releaseCommand` and application disposal release owned checkpoints.
They do not destroy the supplied editor, session, bridge or binding. No serialized
draft is allowed to manufacture a private history command.

## Qualification and remaining work

Focused tests exercise the real HistoryManager and coordinator with complete PDF
session fixtures, ordinary edits, page turns, consecutive Imports, malformed or
foreign markers, history trimming, branching, release and disposal. Copied-source
negative controls cover group dispatch, redo-tail preservation and phase refusal.

This boundary has no existing editor activation, new controls, Save integration
or draft persistence. Draft recovery must restore content, source claims and group
history together; ordinary Save must preserve provenance and reconcile the saved
base. Missing target sets and native/browser, supported-version/mobile and owner
acceptance remain open. Client routing alone does not complete Milestone 1.
