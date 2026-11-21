# PC editor keyboard and layer-list accessibility

**Status:** proposed November 21, 2026; awaiting owner approval before implementation.
Advances UI-3 and preserves the PC interface required by the 1.8 release gate.

## What people experience

Readers keep the existing overlays and full-size viewer. Editors see the same
header, toolbar, canvas, layer list and properties, with the same controls,
order and visible wording. The page-counter colours adapt to the theme for
readable contrast. No tool or action goes away.

- While the full-screen editor is open, Tab and Shift+Tab stay in its usable
  controls rather than reaching the hidden wiki underneath. Existing skip links
  remain reachable. Closing the editor restores the underlying page's normal
  keyboard access. Browser shortcuts remain available.
- Help, colour pickers, recovery and other editor dialogs keep their own focus
  behavior while open; dismissing them returns to their invoking control. The
  editor boundary must also include its open menus and dialogs when those are
  mounted outside its main container. Existing Escape and unsaved-work decisions
  retain their behavior.
- Screen readers encounter a list of named layers containing separately reachable
  controls, rather than listbox options that contain other interactive controls.
  Each layer's current selection state remains available to assistive technology,
  including after selection changes, Undo/Redo and list rebuilds.
- Existing reorder, visibility, rename, lock, delete and folder controls retain
  their keyboard commands and mouse behavior. Their accessible names identify
  the associated layer using its existing name and existing translated action
  labels. Selection announcements continue. Multi-selection stays available.
- The existing Canvas name in a slide's background row can receive keyboard
  focus and activate the same properties view as clicking that name. Background
  visibility/opacity and image-background controls remain separate and usable.
- The PDF page counter uses theme-aware colours with at least 4.5:1 text
  contrast in its normal, annotated and unsaved states. Keep the existing
  annotation-blue/unsaved-red distinction, bold status and exact page wording.

**Exact wording:** retain all existing visible wording. Use the existing layer
names and translated control labels for accessible names; selection/toggle states
use accessibility properties. No new instructional sentence or dialog is proposed.
Save, recovery choices, layer data, history, source identity and exports retain
their contracts.

## Evidence and completion

The owner reports PC keyboard/screen-reader testing **not yet performed**.
A read-only Chromium inspection of a saved synthetic slide on the maintained
8080 wiki records 100 Tab presses: focus reaches the underlying wiki's navigation
and search jump links. Axe reports serious `nested-interactive` violations on
both the ordinary layer row and the Canvas row. Saved revision/slots and layer
data are unchanged, with no page/request errors. These are automated findings,
not a manual screen-reader pass; the layer-role issue was already listed in the
charter's UI-3 baseline. Additional dark-theme image/slide/PDF editor audits
reproduce it. The PDF page counter also fails text contrast at 2.71:1. Six
light/dark image/slide/PDF viewer checks report no axe violations, keep forward/
reverse Tab within the viewer and return focus to its opener on Escape. All
nine additional cases retain saved content. An initial observer waited for a
hidden overlay action without first focusing its host; correcting that observer
requires no product change, and its failed output is retained.

The [WAI listbox guidance](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
explains the nested-control limitation. Its
[modal-dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
describes isolation of underlying content and dialog focus handling.

Before calling the repair complete, verify forward/reverse focus traversal,
skip links, nested dialogs, close/reopen cleanup, layer selection and controls,
and Undo/Redo on native image/slide/PDF editors. Repeat axe in light/dark themes,
including the PDF counter's normal, annotated and unsaved states,
retain unchanged saved-content witnesses, and show the owner the resulting
screens. A real manual screen-reader pass remains a separate release check.
