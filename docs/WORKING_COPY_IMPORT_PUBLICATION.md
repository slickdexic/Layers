# Native working-copy Import publication

`PageWorkingCopyImportPublicationService` is an inactive internal helper for
first-Save provenance on existing page-owned image/slide members. It uses
supported MediaWiki page revisions and the existing Layers publication boundary.
It does not register an API, activate an editor caller or change ordinary saves.

An invocation supplies the target page ID and exact current base revision,
complete proposed snapshot, original authority, optional editor note, and source
records with `targetSurfaceId`, `sourcePageId`, `sourceRevisionId` and
`sourceSurfaceId`. IDs are internal; they are not author wikitext.

The existing native Import reader resolves each source and target. The selected
members must have matching normalized names and kinds, and images must refer to
the same canonical file. The proposed target retains its own complete source
pin, including when the source uses another file version. Native page ownership,
revision ownership, visibility, read/edit permissions and publication scope
remain enforced. A source requires read permission; target edit permission does
not grant source edit rights.

Source titles, labels and revision numbers in the history summary come from the
authorized native records. The editor's note follows that provenance. Repeated
identical citations are deduplicated. At most 32 records are accepted, and the
complete summary must fit MediaWiki's comment limit. Overflow refuses the save
instead of truncating provenance or the note. Unchanged work cannot claim an
Import revision.

Source checks repeat after native preparation and after synchronous save
callbacks. A cancelable native database transaction covers the save and its
post-save check. Source suppression or changed ownership refuses the operation
without retaining a partial destination revision. The normal publisher retains
schema, source-version, stale-base, actor, change-tag and slot admission checks.

This boundary validates source citations and publication, not the origin of
every edited layer. Source descriptors are untrusted inputs, not retained
certificates. The editor integration must tie pending citations to actual Import
history, Undo/Redo and draft recovery; clear only the provenance confirmed by a
successful save; and preserve newer pending work on refusal or uncertainty.

Missing target members, whole-PDF Import, API transport, client/editor wiring,
HTTP/browser/1.44/mobile qualification and owner acceptance remain open. These
limits do not change existing editor or viewer behavior.
