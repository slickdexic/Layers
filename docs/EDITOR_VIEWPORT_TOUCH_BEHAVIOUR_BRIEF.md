# Editor viewport and touch navigation

**Status:** approved November 20, 2026: “Approve the follow-up brief”.
Implemented and qualified in bounded native/browser scope; owner device recheck
remains pending. Advances UI-6, UI-8 and UI-10.
The owner's November 20 Galaxy Tab S4 / Chrome landscape report describes a
large gap beside the properties panel, misplaced canvas, zoom that loses its
centre and impractical panning. The owner accepts these mobile usability limits
as nonblocking for PC-focused v1.8, while requesting a follow-up correction.
This brief does not reopen that release decision or declare tablet acceptance.

## Reader and editor behavior

Readers keep the existing wiki overlays and full-size viewer. This proposal
changes the editor workspace only; it adds no viewer or publication behavior.

- On opening, fit and centre the complete canvas in the space actually available
  beside/below the existing panels and beneath the header/toolbars. Account for
  workspace padding and canvas borders, including large images and portrait PDFs.
  Canvas dimensions must not enlarge the workspace beyond the visible editor.
- Keep the canvas reachable after orientation changes, resizing or panel collapse.
  Before a manual zoom/pan, retain the fitted view. Afterwards preserve the zoom
  and the content point at the workspace centre; the existing Fit action explicitly
  fits and recentres the complete canvas again.
- Anchor toolbar zoom to the visible workspace centre. Retain the existing zoom
  range, percentage meaning, controls and smooth animation. Mouse-wheel zoom stays
  anchored under its pointer. No tool, panel, control or shortcut is removed,
  reordered or relabelled; existing narrow/wide panel arrangements remain.
- Two fingers starting on the canvas or its blank workspace pan by their midpoint
  movement and pinch-zoom around that midpoint. Touch navigation does not move
  layers, dirty the layer set or create an Undo step. Starting it cancels only an
  unfinished one-finger preview, preserving completed edits and their Undo history.
  Lifting/cancelling fingers ends navigation without a stray edit or double-tap.
- One finger continues to select, move, resize, draw and type using existing tools.
  Desktop mouse, keyboard, middle-button and Space-drag behavior remain available.
  Touches on panels/controls keep their existing scrolling and activation behavior;
  canvas gesture handling does not disable browser zoom elsewhere.

**Exact new Help sentence:** “Touch: use two fingers to pan or pinch the canvas
to zoom. Use one finger to edit layers.” Other wording stays unchanged. Nothing
goes away. Save, recovery, source selection, stored geometry and exports retain
their existing contracts.

## Evidence and acceptance

The prior source anchored transformed scaling at the top-left. Pinch handling changed
scale without tracking midpoint translation, and touch listeners are attached to
the canvas rather than its surrounding workspace. Read-only Chromium observations
confirm that toolbar zoom enlarges the canvas to the right/down with its upper-left
point fixed, including on desktop. They do not yet reproduce the owner's exact
large initial gap: the affected page/media and actual device viewport are unknown.
Emulation is diagnostic evidence, not a Galaxy Tab hardware pass. The corrected
geometry passes three regressions that failed before the repair. Eight maintained
8080 browser cases pass across image, slide, landscape PDF and portrait PDF
fixtures: initial/Fit placement, anchored zoom, real touch pan/pinch, subsequent
one-finger editing with Undo/Redo, desktop wheel/Space-drag and resize preservation.
Each saved revision and slot payload is unchanged; no Save is performed.

The full local Jest selection retains 335 passing classes / 19,241 passing tests
and one fixture error: a prototype-only event fixture omitted the new controller.
Its corrected complete class passes 22 cases with the same assertions. Focused
viewport/input/transform tests pass 450 cases. Source lint, CSS/i18n, registration,
shipped assets and unchanged size/growth limits pass. Earlier browser observers
failed before opening the editor (assertion import), then used extra CDP coordinate
scaling and an unfocused Space shortcut; corrected observers pass without changing
the application or relaxing geometric assertions. Original outputs remain local.

Before closing the repair, show initial/Fit/zoom screenshots and verify image,
slide and portrait/landscape PDF geometry in desktop and tablet-sized workspaces.
Exercise actual touch events for pinch, two-finger translation, cancellation and
subsequent one-finger editing. Check unchanged content/history for navigation,
normal Save/Undo/Redo for edits, and desktop wheel/keyboard/pan regressions.
Obtain the owner's screen/flow acceptance on the reported tablet when available.

The charter's prior behavior approval is recorded above. The repair remains a
nonblocking follow-up; PC release checks retain priority and owner screen/flow
acceptance is required before declaring it complete.
