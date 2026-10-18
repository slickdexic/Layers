# Whole-PDF Import session transactions

This inactive, explicitly invoked boundary advances milestone 1, HIST-4,
DATA-1 and SEC-2. It extends `PageOwnedWholePdfImportSession` without changing
its original preparation methods or activating an editor caller. One layer set
still belongs to one owner and one file and has one visible name across the PDF.

## Prepare, inspect and commit

After `prepare()`, pass its opaque handle to `prepareImportCommit()`. Null
represents Cancel and returns null without work. Preparation freshly revalidates
the complete native source, target and temporary-page associations. It captures
the full live document, saved base, active page, target version and method and
map identities. It changes neither the session nor the editor and does not lock
out later edits. Later work makes the prepared transaction stale.

`inspectImportCommit()` returns a detached preview including the complete
candidate snapshot, active `editorState`, `activeSurfaceId`, `activePage`,
`preparedMembers`, `beforeSnapshot`, `dirty`, group-level `sources` and historical
`admissionRevisions`. Append preserves target-only work. Replace clears every
member of the selected group, including target-only members. Unrelated files,
slides, sets and document metadata remain as they were in the live document.

`commitPreparedImport(token, beforeCommit)` requires a synchronous participant
guard that returns `undefined` or throws. A Promise or any other return value
refuses the operation. The guard must check all visible editor, canvas,
selection and history participants and must not change work. The component
repeats its own complete source/session checks after that callback. All clones,
callbacks and admission checks finish before the first live assignment.

An accepted transaction replaces only the complete session snapshot and the
two PDF temporary/admission maps. It retains active page/context, owner, saved
revision, target file version, source geometry and existing member identities.
Session-held native blanks and historical origins remain available for later
page selection. An untouched temporary page absent from both the document and
the source stays temporary; it is not promoted into saved work. No visible
editor, selection or history state changes here.

A source preparation can commit once. Concurrent preparation, changed reads,
changed methods or participants, nonwritable assignment slots, stale work,
foreign/released handles and component disposal refuse with
`layers-working-copy-import-unavailable`. Refusal preserves subsequent work.
`releaseImportCommit()` discards a pending transaction. The original `release()`
still releases its source preparation, including after a successful commit.

## Private checkpoints and publication claims

Commit returns opaque `beforeCheckpoint` and `checkpoint` tokens as well as a
detached preview. `inspectImportCheckpoint()` returns detached complete
`snapshot`, temporary/admission entries, source citations and historical
admission claims. Tokens belong to their issuing component and saved-base
scope; they cannot restore work, serialize permission or authorize publication.
`releaseImportCheckpoint()` releases a token, including after disposal.

`getImportPublication()` returns the actual session owner, page, saved revision
and anchor, plus these proposed native publication arguments:

- `sources`: one four-field descriptor per contributing source layer set:
  `targetSurfaceId`, `sourcePageId`, `sourceRevisionId`, `sourceSurfaceId`.
  Append retains earlier sources and deduplicates by source owner, revision,
  file and normalized set name, including different anchors in the same PDF
  set. Replace starts a new list. At most 32 source sets are retained.
- `admissionRevisions`: one `surfaceId`/`revisionId` pair for each selected
  member retained from an authorized earlier target revision. Current-revision
  native admissions need no historical claim.

Pending citations are held privately against the actual session, so constructing
another component for that session retains them. A different session does not
inherit them. A saved-base change refuses old claims until future integration
explicitly reconciles them. The native publication service must freshly
authorize all sources and member associations; client claims grant no authority.

## Activation dependencies

The visible editor must eventually commit the returned active state, selection
and whole-group history in the same guarded transaction. Existing per-page
history and navigation do not implement this operation: capturing unchanged
visible work after a session-only commit could overwrite its active member.
There is deliberately no registered caller in this checkpoint.

Whole-group Undo/Redo, draft persistence/recovery of content and citations,
saved-base reconciliation, source release and ordinary Save request integration
remain required. Existing draft restoration also needs qualification for a newly
admitted member intentionally left empty by Replace. This checkpoint does not
claim draft recovery or complete editor compatibility. Missing target sets and
native/browser, supported-version/mobile and owner acceptance remain open.

## Separate application and group restoration

An explicitly invoked [whole-PDF application component](WHOLE_PDF_IMPORT_APPLICATION.md)
now stages and commits active editor state, selection and PDF timelines with the
session transaction. Its explicit group Undo/Redo APIs use private expected/target
checkpoint tokens and restore only the selected group, preserving unrelated live
work and the active page. The original inspection-only checkpoint API remains;
no serialized data can create a restore token. All previous default methods and
existing editor/Undo/draft/Save callers remain unchanged. Existing Undo routing,
draft and publication integration are still required before activation.
