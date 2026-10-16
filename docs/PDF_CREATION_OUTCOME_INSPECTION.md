# PDF creation outcome inspection

This work advances milestone 1 and the charter criteria HIST-4, HIST-1, DATA-1 and
UI-10. It defines read-only inspection and recovery evidence for a first Save while
creating PDF layer sets. The code remains inactive: no caller or user interface is
connected, and native/browser acceptance remains open.

## Retained Save evidence

Each publication attempt retains an immutable copy of the exact layer-set snapshot sent
to the publisher, its base revision, sequence, dispatch state and result code. Later
editor changes remain in the draft and history; they do not replace the attempted
snapshot. A restored attempt is checked against the original base, sent-page contexts
and surface content before it is accepted.

The draft controller keeps its existing version-1 backup by default. Opt in with
`retainPublicationAttempt: true` to retain the attempt in a version-2 PDF creation
envelope. The host can also capture that envelope explicitly with
`captureDraftEnvelope({ publicationAttempt: true })`. Version-1 envelopes and default
controller behavior are unchanged. A non-ready version-2 envelope must include a valid
attempt; a ready envelope may have no attempt when Save has not started.

During explicit recovery, native preparation revalidates both draft pages and pages
present only in the sent snapshot. The host also supplies its history-only pages, so
recovery checks pages represented only by Undo history. A malformed or stale sent
snapshot prevents restoration; it is never silently dropped to make recovery succeed.

## Read-only inspection

The inactive host operation is `inspectPublication({ api, reader, pdfReader },
ownerGuard)`. It uses the current-page query plus native PDF creation or saved-PDF
admission and exact Layers reads. It repeats current-page and relevant native reads
before returning. A failed or inconsistent read is unavailable; it is not evidence that
publication did not happen.

The result is one of:

- `base-current`: the original base revision and embedding are still current, with the
  requested layer set still missing at inspection time.
- `payload-current`: the current direct child revision contains the exact attempted
  snapshot and the original main text remains intact.
- `changed`: the current authorized page state differs from the unchanged base and exact
  attempted payload cases.

`payload-current` describes the current saved content. It does not prove that this
client request created the revision. `base-current` describes only the observed state at
check time; an earlier delayed POST may still arrive after inspection.

Inspection never retries publication, grants write authority, changes the transaction
phase, clears a publication or recovery hold, or modifies draft/history state.
Connecting this operation to editor controls and qualifying actual HTTP behavior,
browser recovery, and owner acceptance remain future work.
