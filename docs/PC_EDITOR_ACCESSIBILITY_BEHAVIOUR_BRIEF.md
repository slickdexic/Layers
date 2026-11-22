# PC editor keyboard and layer-list accessibility

**Status:** approved November 21, 2026: “Approve the PC accessibility brief”.
Implemented and verified in bounded native/browser scope. Manual screen-reader
acceptance remains open.
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

## Implemented verification — November 21

Eight native 8080 editor cases pass: light/dark image, slide and PDF in Vector
2022, plus both PDF themes in legacy Vector. They check forward/reverse Tab,
skip-link wrapping, Help/colour-picker focus and Escape return, named selection
and visibility controls, and actual visibility edits with keyboard Undo/Redo. Multiword rename cancellation
and visible focus on name/Canvas controls also pass. The slide
journey additionally checks Cancel retaining edits, explicit Discard, restored
wiki keyboard access and reopening the exact saved copy. No Save occurs; every
saved revision/slot remains unchanged with no page/request errors. Axe reports
no serious/critical finding in these recorded editor scopes. PDF counter checks
cover normal, annotated and unsaved states; deliberately restoring the old dark
blue fails the contrast observer. Screens in light/dark were shown to the owner.
An additional native desktop viewport case preserves wheel zoom, Space-drag and
resize anchors. Prior six viewer checks retain their scope.

The full local selection passes 337 suites / 19,254 tests. After the final
keyboard changes, all 17 affected suites pass 1,116 tests. The Windows discovery
wrapper changes only absolute test globs; hosted exact-code checks remain
separate. Source lint, styles/messages, asset registration and unchanged reader/
growth limits pass. The reviewed editor-only source allowance is documented in
[the growth policy](CODE_GROWTH_POLICY.md); no charter timing limit changes.

Retained failures include outdated role/dependency fixtures, a newly exposed
colour-preview swatch missing its accessibility role, both global shortcut handlers closing the editor on Help
Escape, and legacy Vector lacking dark Codex colour tokens. Those findings are
corrected. Keyboard rename cancellation also exposed a default display name
ending in a space being committed on Cancel; cancellation now preserves exact
layer data, keeps its key out of global handlers and uses the textbox role while
editing. A focus observer now waits for the existing CSS transition before
checking the unchanged two-pixel requirement. One Close observer initially expected a lowercase dialog instead of
the existing `alertdialog` named “Unsaved Changes”; correcting it changes no
product behavior. These checks establish no manual screen-reader or stable
release acceptance.

Application `64e03968989eaccb829abb6c05fba3d20b5ba541` passes exact-code
[CI](https://github.com/slickdexic/Layers/actions/runs/44955746151),
[native MediaWiki](https://github.com/slickdexic/Layers/actions/runs/44955746223)
and [browser](https://github.com/slickdexic/Layers/actions/runs/44955746089) gates;
hosted JavaScript passes 340 suites / 19,279 tests. Its qualification archive's
2,974 files and executable modes match Git and the installed 1.44.6 package.
Four installed image-editor theme/skin checks pass exact reader pixels, focus/
dialog handling, rename cancellation and axe. All fifteen content-table witnesses,
nine pages, sixteen revisions and three retained uploads remain exact; the HTTP
guard and public assets pass, with other services/configuration preserved.
This extends the recorded compatibility scope, not manual accessibility acceptance.

The existing disposable MediaWiki editor CI job also runs the dedicated light/
dark keyboard/axe journey on a separate seeded owning page. Its text deliberately
has a default display name ending in a space, retaining the cancellation
regression. Credentials come from the existing generated CI account; the seeder
checks the disposable wiki's identity before writing. Reports are kept separately
from the existing editor suite. This adds UI-3/OPS-4 continuous coverage without
running CI against the maintained wiki or creating another local environment.

## Agent keyboard-only check on the maintained wiki — November 21, 2026

An agent used Edge 158.0.4370.33, Vector 2022 and the dedicated test account on
MediaWiki 1.45.3 (8080). After sign-in, the browser admitted only same-origin
GET requests. All control activation and focus movement used keypresses. DOM
reads observed focus and layer state. Both journeys preserved the saved revision
ID and all slot hashes, and the request guard recorded no errors.

- On a synthetic owning page, Tab reached **View full size**. Enter opened the
  viewer. Focus stayed inside for 21 forward and 21 reverse Tabs, and Escape
  returned focus to the invoking button. **Edit layers** opened the editor
  using Tab and Enter.
- In the slide editor, Help kept focus during forward and reverse Tab and
  returned focus to Help on Escape. Space on a layer's visibility control
  changed its state. Undo, Redo and a final Undo each reproduced the expected
  complete layer state.
- Both Emoji and Shape Library opened from their toolbar buttons with Enter.
  Two presses of Shift+Tab from each picker's initial focus reached **Check
  saved page** behind the open picker. After tabbing back into the picker and
  pressing Escape, Emoji left focus on the document body. Shape Library left
  focus on its hidden Close button. Both failed the approved focus behavior.

Engineering owns keyboard-only replay after the picker repairs. Include the
draft recovery dialog's Escape and Save shortcut routing found during review.
The charter's manual screen-reader pass remains open under UI-3.

## Repair and keyboard replay on 8080

Emoji and Shape Library now identify their open panels as modal and keep their
invoking toolbar button for focus return. Native draft recovery also participates
in the editor's modal focus boundary. The document, canvas and toolbar
shortcuts defer to the native dialog.

Light and dark Chromium journeys on the maintained 1.45.3 wiki open both
pickers through the keyboard, wait for items to appear, cross their Tab boundaries in both directions
and return to the invoking button on Escape. In draft recovery, Delete and
Ctrl+S on the confirmation's Cancel button leave the decision intact. Escape
returns to the recovery choices with Cancel focused. The first repair replay
caught forward Tab stuck on Cancel in the native dialog. Declaring that dialog
modal to the editor's existing focus boundary corrected the failure.

The tests run on synthetic content, check the saved revision and slots, and
exercise the existing Help, colour dialog, layer visibility and Undo/Redo.
The separate manual screen-reader pass remains open.
