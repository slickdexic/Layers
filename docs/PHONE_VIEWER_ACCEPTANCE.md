# Phone viewer acceptance

Recorded October 25, 2026; advances Milestone 1 / UI-2 / UI-3 / UI-8 / UI-10.
The release remains **partially qualified**. The demonstrated touch-panning
defect is corrected in the bounded browser scope below, following the owner's
approval of the [accessible repair](VIEWER_TOUCH_PANNING_BEHAVIOUR_BRIEF.md).
Physical-device, tablet-editor and manual accessibility acceptance remain open.

## Native Minerva checks

The maintained MediaWiki 1.44.6 wiki served the actual Layers checkout matching
published baseline `9ea8f23`. Its already-installed Minerva skin was enabled
for these checks; default Vector and the main wiki's settings stayed unchanged.
No new wiki, database clone, installation, content Save or source repair was
needed. Installed Chromium 145.0.7632.6 emulated a 390 × 844 phone viewport
with touch input. Actual Minerva markup and viewport width were asserted;
an unsupported-skin fallback was not counted as a mobile pass.

All six image, slide and PDF combinations in light and dark passed:

- The first tap reveals the existing layer actions without following the file
  link. View full size opens the saved media.
- Zoom and Fit work through their existing buttons. Every visible toolbar
  control and Close stays inside the viewport. Images/slides keep PNG/PDF
  choices, and PDFs retain PDF-only Download.
- PDF navigation changes page 2 to page 1 and changes the actual canvas from
  portrait to landscape, rather than changing only the page counter.
- Tab focus remains inside the viewer with a visible outline. Escape returns
  focus to the invoking View full size button; Enter reopens it.
- Axe's WCAG 2.2 A/AA rule set reports zero violations in each viewer. Its
  transparent-background contrast items require review; recorded enabled
  toolbar text meets 4.5:1 after accounting for both the dark scrim and button
  fill. This is not a complete accessibility or manual screen-reader sign-off.

Every owner revision and exact main/layers slot payload remains unchanged.
These results use emulated browser touch, not physical phone hardware. Tablet
editing, the editor's accessibility, other supported version/device combinations
and manual acceptance remain separate.

## Original touch-panning failure

Before the correction, after Zoom enlarged media above 100%, a one-finger drag
did not move it. This failed for all three media types in both themes. A separate native-browser
control sends the same 60 × 40-pixel drag to the same image coordinates. Touch
events reached the media but left its transform unchanged; mouse input changed
the transform by the expected amount. The original reader bound panning to
mouse events only. This established a product defect rather than a failed touch
observer; the original evidence is retained.

## Approved correction and bounded verification

The owner approved the revised design before implementation. One-finger pan
now moves enlarged media, and the separate bottom **Pan** strip offers four
44-pixel direction buttons and keyboard access. The existing top toolbar and
Close stay in place. Shift+Arrow pans; unmodified Left/Right still navigate PDF
pages. Pan buttons reveal content in the named direction and stop at the media
edge. The strip hides at 100% or below; hiding a focused Pan button returns
focus to the existing zoom indicator. No wiki-page content or saved data changes.

On the same maintained 1.44.6 Minerva wiki and browser, all six image/slide/PDF
light/dark cases pass native touch translation of 60 × 40 pixels and an identical
mouse control. Native button taps, Enter/Space activation, Shift+Arrow separation
from PDF navigation, reset/focus and close pass. Axe reports zero violations in
each case; this remains scoped automated evidence.

Native layouts pass at 320 × 568, 844 × 390 and 1100 × 800, plus a 320-pixel
layout with doubled body text. Every new button remains at least 44 × 44 pixels
and the strip stays inside the viewport. The enabled-text worst-case contrast
is 6.08:1; the new blue focus ring has a black backing, giving 3.91:1 contrast.
Forced-colors rendering was captured; it is not a complete manual sign-off.

Actual two-finger input preserves browser magnification, increasing the browser
viewport scale from 1 to about 1.70 without moving the viewer transform. A
separate check first confirms a 60-pixel single-finger pan, then adds a second
finger: browser magnification works and viewer translation stops. The initial
synthetic pinch command produced no magnification even on a plain page. That
failed observer remains recorded; only actual two-finger input qualifies the
pinch behavior. An initial journey also retained mouse hover from its preceding
positive control; clearing that hover allowed the remaining native cases to run.

The new 21-case regression suite and existing viewer/export suites pass together:
216 tests. All 18,973 client tests pass. Three isolated copied-source controls
demonstrate the original missing touch movement, unbounded button movement and
lost keyboard panning; production sources stay unchanged during these controls
and pass the positive replay. Existing owner revisions and complete main/layers
slot bytes remain exact. No new wiki, configuration change or content Save is
needed. Browser touch emulation does not qualify physical phone hardware, the
tablet editor or the required manual screen-reader pass.

The [1.8 ledger](RELEASE_1_8_ACCEPTANCE.md) and
[known issues](KNOWN_ISSUES.md) retain this open item. Physical-device and owner
acceptance are not replaced by the six positive browser checks. Private captures,
credentials and test configuration remain local.
