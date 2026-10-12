# Pending working-copy Import citations

This opt-in client integration advances milestone 1 / HIST-4 and the approved
first-Save source citation requirement. `enablePublicationProvenance()` on the
native Import coordinator enables it for a clean, existing image/slide target.
No editor or UI caller enables it by default. Native API/schema/configuration
remain unchanged.

Native owner IDs, revision IDs and literal member IDs stay separate from the
existing Import preview. Actual Import privately records the source association,
fresh imported layer IDs and any copied empty-slide canvas. Complete certified
Undo checkpoints carry these facts: Undo removes pending citations and Redo
restores them. Append combines contributions; Replace removes obsolete layer
contributions while preserving the already copied slide canvas. Repeated source
associations are deduplicated. Normal edits retain their originating association.

The first Save containing those contributions sends the literal source IDs via
the explicit publication transport. Fresh native reads verify target identity
and base, authorized historical sources, matching original native names and image
files. The server repeats its own authoritative checks and creates the native
history citations. Imported image pins stay with the target. Removing all image
contributions omits their citation; a copied empty-slide canvas still carries its
source. A no-op does not create a false first-copy revision.

Only confirmed publication acknowledges the captured pending associations.
Refusal, uncertain responses, failed backups, disposal and late changes do not
acknowledge them. A same-revision response cannot confirm a required first-copy
Save. Newer live edits are retained. Older Undo checkpoints cease requesting
already acknowledged citations; a subsequent real Import can establish a new
pending contribution.

Opted-in complete draft data uses version 2 with explicit pending associations
in every working-state checkpoint. All referenced historical associations,
including Redo entries, are freshly checked before any live recovery commit.
Recovery privately prepares, checks every live participant after native awaits,
then commits the session, display, selection and actual history synchronously.
Serialized facts never grant authority. Malformed or incomplete version-2 data
and a downgrade of an Import timeline are refused. Existing version-1 plain-edit
drafts can be recovered; the original non-provenance draft route stays unchanged.

Qualification is client/component scope. Native J116O evidence remains a retained
dependency. Browser/HTTP, final UI activation, missing/new target members,
whole-PDF Import, MediaWiki 1.44/mobile and owner acceptance remain open.
