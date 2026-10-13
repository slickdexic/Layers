# Creation Import conflict reconciliation

Advances milestone 1: HIST-4, HIST-1, DATA-1 and SEC-2.

Before the first Save, an imported image or slide layer set is working editor
data. Its temporary member ID and saved embed selection belong to the revision
at which editing began. If another edit changes the owning page, reconciliation
must prove that association and obtain the current canonical member ID before
an explicit Save can publish the work into native page history.

The editor uses the read-only creation re-admission boundary described in
[the native contract](IMPORT_CREATION_REBASE_CONTRACT.md). It validates the
historical page, revision, member ID, exact embed text and original offset, then
the explicit current owner revision, exact embed and current admission. The
saved layer-set name remains unchanged. Internal member IDs do not appear in
the author-facing embed syntax.

Preparation does not modify the live session, saved base, selection, editor
configuration or Undo history. The current genuine native bundle remains
separate from the admitted empty member, including when the page has no Layers
slot. The proposed working bundle combines the complete current native base
with the existing local layers, canvas and reading order. Unknown metadata,
null values and unrelated or unavailable members remain intact.

The destination kind, name, immutable metadata, original empty geometry and
native source pin must still match. Occupied IDs or conflicting file/slide
names refuse. A reuploaded image cannot silently replace the captured source.
Every pending Import source is freshly authorized, including sources reachable
only through retained Undo or Redo entries. At most 32 distinct sources are
accepted for one transaction; larger retained histories refuse without pruning.

Complete participant observations repeat after asynchronous reads and before
commit. New editor work, changed selection/history/configuration/methods,
pending operations, locks, disposal or destruction refuse without replacing
the user's newer data. Session, provenance, retained checkpoint identities,
history entries, creation transport selection and editor configuration commit
synchronously after all preflights, without an await or notification between
participant commits. Display notifications follow the completed transaction.

Reconciliation performs no publication and acknowledges no saved history entry.
Undo and Redo keep their original layers and canvas under the newly admitted
identity. Existing draft handling preserves the prior draft and writes a draft
scoped to the new revision and member. An explicit first Save uses current
native creation admission and retained source citations. Refused or uncertain
Saves retain work and saved markers; successful publication alone establishes
the stored member.

Scope: existing creation Import for directly saved image and slide embeds.
Stored-target and PDF reconciliation keep their existing paths. This does not
qualify discovery of a prior-revision draft after the editor has been closed,
first-Save rename, expanded or nested embed admission, whole-PDF Import, actual
HTTP/browser/mobile journeys, physical printing or MediaWiki 1.44 acceptance.
Those remain separate milestone-one work. Existing tools, overlays, wording,
Import preview and ordinary draft discovery are preserved.
