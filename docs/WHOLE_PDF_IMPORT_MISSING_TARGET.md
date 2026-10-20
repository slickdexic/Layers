# Whole-PDF Import into an absent layer set

This inactive native preparation boundary advances Milestone 1, HIST-4, DATA-1
and SEC-2. It does not activate an editor, API endpoint or Save caller.

`PageMissingPdfImportPreparation::prepare()` accepts the current target page and
revision, the byte offset and complete bytes of its saved direct PDF embedding,
and an exact source owner, revision and stored PDF member. The source must belong
to another owner and the same canonical file and normalized layer-set name.
Internal PDF pages retain one visible layer-set name.

The destination must have no stored member of that group. A sparse or stored
empty group uses the existing stored-target path. Native saved-embedding admission
prepares all empty internal pages with the target's pinned file version and
deterministic member IDs. The original main text, original layers content and
original read bundle stay separate; an absent layers slot remains absent.

The result contains `targetAdmission`, `source`, `sourceBundle` and `sourceGroup`.
The source bundle preserves its complete snapshot, native geometry and renditions
for the selected group. Historical reads use the explicitly requested revision;
they do not substitute newer payloads. Source member pages must fit the target
PDF. Preparation neither copies layers into the target nor synthesizes a saved
target snapshot.

The separately invoked `PageWorkingCopyPdfImportReadService::readSource()` reuses
the existing native group reader. It validates permissions, revision visibility,
owner/file/name identity, complete stored membership, file pins, page counts,
geometry and file addresses after rendition work. The composite repeats target
admission and source authorization after rendering and refuses any changed
witness. Refusal returns only `layers-working-copy-import-unavailable`.

These detached results are not publication or recovery tokens. Complete client
application, Undo and drafts, first-Save provenance, fresh native publication
admission and actual HTTP/browser acceptance remain integration work. Existing
stored-target reads, publication methods, registration and UI stay unchanged.
