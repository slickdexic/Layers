# Import creation-target admission

This inactive native helper advances milestone 1 / HIST-4, HIST-1, DATA-1 and
SEC-2. It prepares an empty image/slide layer-set member for an existing owning
page whose exact saved direct embed names a member that is still missing.
Existing editor, Import, read and publication callers are unchanged.

`PageWorkingCopyImportCreationTarget::prepare()` receives the native owning page
and current base revision, expected internal surface ID, UTF-8 byte offset,
complete saved embed bytes and the original requesting authority. It uses the
existing exact editor admission and owner resolver. Caller assertions cannot
establish ownership, existence, source visibility or edit rights.

The result contains:

- `target`: the native owner, revision and internally admitted member identity.
- `selection`: the exact saved offset and embed bytes to revalidate later.
- `hasLayersSlot`: whether the stored base actually carries a Layers slot.
- `baseBundle`: the complete unchanged stored read bundle, or `null` when no
  Layers slot exists. Other members' unavailable source files are not requested.
- `newSurface`: the separately admitted empty image/slide member, including its
  native image pin or configured slide canvas. It is absent from the stored base.

The helper repeats native preparation, compares both complete captures and
rechecks current owner/base authorization before returning detached JSON data.
It refuses stale or foreign bases, fabricated IDs, changed captures, existing
members, denied rights/scope and unsupported target types. It never publishes,
rewrites wikitext or represents a virtual member as stored historical content.

Every later preparation/application/recovery/publication boundary must freshly
authorize the exact target and source again. This result is neither a capability
nor a reusable grant. First-Save transport must retain source citations and
complete sibling, main-text, image-pin and local-history preservation.

The existing raw-source editor admission supports a conservative subset of
literal direct embeds. Nested caption links, templates and other expanded
occurrences remain outside this helper's qualified scope. Their inherited
refusal is preserved; rendering acceptance does not establish creation admission.
PDFs and new wiki pages with base revision zero are not admitted here.

Complete missing-target Import still needs read/publication transport, editor
application, Undo/drafts and first-Save provenance integration, followed by
native/browser qualification and owner acceptance. This foundation does not
complete milestone 1 or change the approved user behavior.
