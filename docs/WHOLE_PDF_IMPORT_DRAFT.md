# Whole-PDF Import draft capture

This inactive client boundary advances Milestone 1 / HIST-4 / DATA-1 / SEC-2.
It captures complete recovery data from the actual editor and its private Import
history. It does not write storage, restore a draft, read native data or publish
work. No existing editor, draft, recovery, Save or registration caller uses it.

## Capturing the actual working state

Construct the typed whole-PDF Import application with its actual bridge and
session binding, enable its history route before Import, then call
`application.captureDraft()`. The editor and session must be synchronized and
ready. Busy, destroyed, locked, batched, conflicting or unowned work refuses.
The capture is synchronous and leaves live work and existing backups unchanged.

The returned plain JSON object has the distinct format
`layers-whole-pdf-import-draft` and `version: 1`. It contains:

- `session`: exact owner/base/member scope, saved base, complete live snapshot,
  PDF context and active page, temporary member origins, native admission records,
  Import source citations and historical admission revisions.
- `history`: the active page, actual per-page timelines and complete group
  relationships, including both sides of every retained Import checkpoint and
  its associated timeline data.

Unrelated document content and metadata remain in the complete snapshots. The
active timeline is read from HistoryManager rather than a stale coordinator copy.
Offscreen work, redo tails and native blank members are preserved. Append and
Replace retain their current source citations; Undo captures the current side of
the group command rather than assuming every Import remains applied.

Retired commands have no checkpoint data. Any surviving marker is recorded only
as a refusal barrier. Unknown, modified or unowned markers and missing member
timelines refuse capture rather than emit an incomplete recovery record.

The binding also exposes separately invoked `captureImportDraft()`. It reads the
actual private session snapshot, maps and source-citation bank and returns detached
data. It does not include the application history; callers needing complete
recovery data must use the application capture.

## Data is not recovery authority

Returned objects share no mutable references with live session, history or private
checkpoints. They contain no opaque command or checkpoint tokens. Editing a JSON
copy cannot authorize Undo, restore source references or establish a native member
association. Source citations, origins, marker IDs and checkpoint contents remain
untrusted data when read back from storage.

This format must not be passed to the ordinary version-1 PDF draft restore path.
That path cannot rebuild the private Import commands or source citations, and
requires separate qualification for intentionally empty newly admitted members.
It must not partially commit a session before rejecting group-history markers.

## Integration still required

Storage, draft selection and explicit Restore/Keep controls remain unchanged.
Recovery must freshly authorize the saved target and each cited source group,
validate current/historical admissions, rebuild private capabilities and commit
session, editor and complete group history together. Cancellation or refusal must
preserve the backup and current work. Storage quota and size handling must retain
complete records or refuse; capture never silently truncates history or content.

Ordinary Save/provenance integration, saved-base reconciliation, missing target
sets and native/browser, supported-version/mobile and owner acceptance remain
open. Capture qualification alone does not activate Import recovery or complete
Milestone 1.

## Separately invoked recovery

The opt-in transaction described in
[whole-PDF draft recovery](WHOLE_PDF_IMPORT_DRAFT_RECOVERY.md) validates this inert
capture, freshly authorizes current and active-checkpoint references and native
origins, and reissues private capabilities before atomic recovery. It retains
retired refusal barriers without reconstructing their unreachable authority.
Existing draft storage, controls, editor callers and Save remain unchanged.

## Local storage and explicit recovery integration

The [complete local draft integration](WHOLE_PDF_IMPORT_DRAFT_STORAGE.md) connects
the existing controller, store and lifecycle to this record. It preserves saving,
conflict and uncertain work, independent backups and explicit native-authorized
Restore. Legacy PDF drafts retain their existing route. Production picker and
recovery callers remain inactive; full native/browser acceptance remains open.
