# Earlier creation draft inspection

This inactive client boundary supports page-owned native history and safe
recovery of image/slide creation Import work. Existing editor callers, prompts,
exact-base backup selection and application remain unchanged. Inspection does
not restore layers or Undo, publish a revision, retire a backup or advance a base.

## Discovery and retained bytes

Private discovery scans canonical backup keys for the current wiki, user and
owning-page title, at earlier positive revisions only. Foreign, malformed,
current and future keys are excluded before reading their payloads. Independent
writer partitions and older unpartitioned records remain separate. A candidate
requires a matching envelope scope, retained creation origin and working-copy
backup. Corrupt or insufficient records remain untouched and unadvertised.
Storage failures refuse discovery; they are not reported as successful emptiness.

Candidates are opaque handles bound to one store, writer destination, key and
exact raw value. Inspection rereads the same value and refuses changed/deleted
records, forged handles or another store's handles. It never selects another
writer for ordinary reads or transfers that writer's backup destination.

## Native proof and live participants

The client sends a read-only POST to
`layersworkingcopyimportcreationdraftrebase`, carrying only page ID, current
revision, historical revision and the internal original member ID. Local names
and selection offsets never establish authority. Native derivation must return
the exact retained historical embed association and the current embed selection.
The empty admitted member's complete metadata, source pin and geometry must
match; only its canonical revision-dependent internal ID may differ. No file
version or geometry is substituted. The genuine current base remains separate.

The controller additionally checks current session admission and complete stored
siblings. It captures live editor state, configuration, session, Undo history,
methods and exact backup bytes before the request, then repeats those checks
after every request and during later inspection/revalidation. New edits, history
changes, disposal or changed backups refuse without undoing those changes.
The controller independently matches a genuine certificate to the exact
backup's claimed historical selection. Certificates and detached inspection
results cannot be fabricated or transferred to authorize another backup.
Complete native revalidation detects changes in
unknown fields, siblings and rendition metadata. Source reads are constrained
to the confirmed current target and repeat its complete native admission.

## Remaining integration

These methods have no active editor/UI caller. Inspection is not permission to
apply a backup: every retained Import citation and Undo checkpoint still needs
native source revalidation, authorized identity remapping and atomic private
session/editor/history preparation before explicit application. Publication
remains subject to existing first-Save admission. Backups without sufficient
original pin or geometry stay preserved. Whole-PDF Import, owner renames,
first-Save rename, native HTTP/browser/mobile/1.44 and owner acceptance remain
separate. Any visible recovery-flow change requires the charter's approved
behaviour brief and screen review.
