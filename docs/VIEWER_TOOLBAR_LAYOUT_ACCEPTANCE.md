# Bounded viewer toolbar acceptance

Recorded October 25, 2026; advances Milestone 1 / UI-3 / UI-8 / UI-10.
The owner approved the [bounded behavior brief](VIEWER_TOOLBAR_TEXT_LAYOUT_BEHAVIOUR_BRIEF.md)
before implementation. The earlier tall-stack proposal was not approved.

## Result

Normal toolbar text is 14 CSS pixels on the maintained wiki's default root size,
independent of article/body text. The root-relative UI base still permits user
text enlargement. The toolbar's border-box height is at most 96 CSS pixels or
one quarter of the viewer height, whichever is smaller. Its existing actions
scroll within that region rather than making the toolbar grow indefinitely.

Existing controls, labels, order, shortcuts and format choices remain. PDF
Previous page/counter/Next page stay together. Close and Pan retain their
positions. Decorative edge cues indicate additional actions; they do not add
an action or keyboard stop. Wheel scrolling inside the toolbar scrolls its
actions, while media/surround wheel zoom and native browser zoom remain.
Keyboard focus scrolls the selected action into view.

Fit measures the real space below the toolbar and above Pan when needed,
scales the displayed media and centers it in that area. It does not change
saved canvas units, source identity, layers or export geometry. The choice
around 100% avoids repeatedly showing/hiding Pan during Fit.

## Native browser evidence

The maintained MediaWiki 1.44.6 Minerva wiki served the actual extension checkout.
Installed Chromium 145 used touch emulation; no additional wiki, content Save,
configuration change or installation was needed.

- Six image/slide/PDF light/dark cases pass the height limit, independent article
  text scaling, doubled UI text, full labels inside buttons, keyboard focus,
  wheel scrolling without media zoom, measured Fit, accepted touch panning and
  PDF page navigation. Scoped axe checks report no violations.
- Twelve additional type/viewport cases cover 320 × 568, 390 × 844, 844 × 390
  and 1100 × 800. The cap and fitted-media clearance pass at normal and enlarged
  UI text sizes. These are viewport-sized Minerva checks, not qualification of
  every desktop skin or physical device.
- Native finger scrolling moves the toolbar's overflow. A controlled longer
  German-style Download label fits and is brought fully into view; this is a
  layout stress case, not a claim of complete locale acceptance.
- Actual two-finger input preserves native browser magnification. Separately,
  the browser's magnification control reaches 200%; that programmatic check is
  distinguished from the native gesture evidence.
- Final cue geometry stays within the capped toolbar. Initial visual review
  caught the inline-SVG baseline placing a cue outside its box; block layout
  corrects that issue. The existing blue focus ring has the same black backing
  as Pan, confirmed in a final native focused-button capture.

Existing owner revisions and full main/layers slot bytes remain exact. Browser
contexts are closed. Physical-device, manual screen-reader, physical Print and
the remaining [1.8 acceptance](RELEASE_1_8_ACCEPTANCE.md) are still separate.

## Regression and refusal checks

All 18,987 client tests pass across 316 suites. The new 13-case toolbar suite
and existing viewer/pan/export suites pass together: 230 tests. Three isolated
copied-source controls reproduce wheel interception, Fit ignoring the toolbar
and lost focus scrolling. Production files remain unchanged during those
controls and pass the positive replay.

A separate browser-only style control removes the height cap and makes the
native cap qualification fail. Its exact prior inline style is restored and the
positive bound replays. This is deliberately faulty test state, not production
acceptance or a change to saved wiki content.

The publication contains extension code, generic tests and public documentation.
Private captures, configuration, credentials and retained investigation history
stay local. The manifest remains 1.5.95 until the independent release cut;
passing this bounded repair does not establish complete WCAG or Milestone 1
acceptance.
