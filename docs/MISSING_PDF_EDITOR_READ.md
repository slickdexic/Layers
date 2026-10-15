# Requested-page preparation for a missing PDF layer set

`PageMissingPdfEditorReadService` is an inactive MediaWiki-native read component.
It advances page ownership/history (HIST-4, HIST-1), DATA-1 and UI-10. No route,
editor caller or publication path uses it yet. Existing entry points and the
all-page `PageMissingPdfSetPreparation` component remain unchanged.

The caller supplies an existing owner and explicit current revision, the exact
saved direct embedding's byte offset/text, an internal page number and the
requesting authority. Native editor admission derives the layer-set name,
initial page, source pin and stable internal IDs. A supplied surface ID or
client snapshot is never binding proof.

The result keeps four things separate:

- The native owner/anchor identity and exact embedding selection.
- The original main text and Layers text, including explicit absent-slot null.
- The complete unchanged stored base bundle, or null when no Layers slot exists.
- The empty anchor and one requested-page context. Both have the same layer-set
  name and source version; internal page numbers select different members.

The requested-page context resembles the stored-PDF read context but has
`stored=false` and an empty stored member inventory. It is not accepted by the
existing saved-anchor client session. A later integration must explicitly handle
creation; it must not claim this temporary context is already stored or rewrite
the base snapshot to make it appear stored.

The component renders the initial embed page through existing native admission
and prepares only the requested page, repeating both captures for consistency.
It does not enumerate or render the remaining PDF pages. This bounds the number
of distinct requested backgrounds to the initial and selected pages, independent
of document length. It is not a measured interactive performance budget or a
claim that the handler can render every unvisited page.

Native count must be known and positive. Existing schema limits remain: the
whole PDF plus preserved sibling surfaces must fit the current document limit.
Unknown/unrepresentable counts, existing sets (including sparse or stored-empty
sets), stale/foreign owners, changed selections, source/permission changes,
failed requested renditions or changed capture results refuse without writes.
It never substitutes another stored page or a different file version.

Native source geometry and delivered rendition pixels are separate. A PDF
handler's one-pixel rendition rounding does not change saved canvas coordinates.
The same file/name on another owner, or another file/slide of the same name on
this owner, remains independent. Complete stored siblings are returned unchanged.

No preparation authorizes Save. Before editor application or publication, future
callers must repeat native authorization/selection/source checks, preserve newer
local edits and retain the exact original base. First-Save provenance,
Undo/drafts/recovery, whole-PDF Import and browser/owner acceptance require
separate integration and qualification. Nothing is saved until explicit Save.
