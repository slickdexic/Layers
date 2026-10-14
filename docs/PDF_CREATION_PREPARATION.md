# Missing PDF layer-set preparation

`PageMissingPdfSetPreparation` is an internal, inactive read-only component.
No service, endpoint, overlay or editor caller is registered. It prepares one
still-missing named PDF layer set from a saved direct embedding on a current,
authorized owning page. A stored set, including one missing an internal page,
uses the existing PDF read path instead.

The returned target and saved selection are native identities. `mainText`,
`baseText` (null for an absent Layers slot) and the complete `baseBundle` remain
separate from the new empty pages. Every prepared page has the same name and
source version, its own deterministic internal ID, exact native source geometry
and a checked rendition. The initial page follows the native embed selection.
Rendition pixel rounding does not redefine the saved canvas geometry.

Preparation repeats admission, source/count/geometry and complete-result checks.
Permission loss, a stale/foreign owner, changed selection/source, existing set,
invalid/unknown count or any unavailable page refuses the entire result with
the existing generic unavailable code. Nothing is saved and no stored page is
substituted. Prepared results confer no write authority and must never enter
shared caches. Future editor application and publication must revalidate them.

This complete preparation fits within the existing 100-surface document limit,
including preserved siblings. Larger and unknown-count documents are refused;
no schema expansion or general large-document support is claimed. All-page
preparation cost is unqualified for interactive use. Editor/overlay integration,
first Save, Undo/drafts, whole-PDF Import and browser acceptance remain separate
work. Existing image/slide and saved-PDF behavior stays unchanged.
