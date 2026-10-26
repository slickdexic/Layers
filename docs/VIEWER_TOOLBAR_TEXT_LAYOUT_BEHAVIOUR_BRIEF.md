# Full-size viewer: readable toolbar labels

**Status:** Bounded revision approved October 25, 2026; implementation and bounded
verification are recorded in [toolbar acceptance](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md).
**Date:** October 25, 2026. Advances Milestone 1 / UI-3 / UI-8 / UI-10.

## Observed problem

At 320 pixels wide with doubled body text, the viewer's existing top toolbar
clips Download wording. Its buttons keep a fixed 30-pixel height after their
labels wrap. The centered toolbar also wraps before using the available width.
This was captured on the maintained wiki; the approved Pan strip is separate
and already fits. This brief records the subsequently approved repair.

## Owner direction and size limits

The earlier tall-toolbar proposal was **not approved**. The owner specified that
enlarged controls leave too little room for the image, slide or PDF and must have
size limits. The media remains the primary content.

- Normal toolbar text uses a deliberate **14 CSS-pixel UI base**, independent
  of the wiki article's text size. The oversized earlier example was a 200%
  accessibility stress case, not a proposed default.
- The toolbar's outer height is limited to **96 CSS pixels or one quarter of
  the viewer height, whichever is smaller**. Padding and borders count toward
  that limit. It must not grow into a tall stack that consumes the media area.
- When enlarged or translated labels need more space, they remain inside a
  scrollable toolbar at that height limit. All actions remain accessible by
  touch, mouse wheel and keyboard; focusing a control brings it into view.
- Browser magnification remains available. These limits bound the toolbar's
  footprint; they do not disable user zoom or crop labels to simulate compliance.

## Revised reader behavior

- Keep the toolbar at the top, with every existing control, label, shortcut and
  control order. Keep Close in its current corner and Pan at the bottom.
- Let the toolbar use the available width before wrapping, leaving the existing
  clearance around Close. A fitting desktop toolbar keeps its compact width.
- Keep Previous page, the page counter and Next page together in one PDF
  navigation group. Allow the counter text to wrap within that group if needed;
  preserve the existing control and keyboard order.
- Normal controls retain a compact size, with at least 32-pixel-high button
  targets. Labels may wrap inside a button when needed, but extra rows remain
  within the capped, scrollable toolbar. Show every word without clipping,
  ellipses or abbreviation; do not shrink enlarged text back to its base size.
- Show a small edge cue when more controls lie above or below the visible
  toolbar area; it is decorative, not another action. Scrolling over the toolbar scrolls
  its actions rather than zooming the media. Close and the Pan strip remain
  independently reachable; the underlying wiki does not scroll behind the viewer.
- Fit uses the actual space below the measured toolbar and above the visible
  Pan strip. Enlarged media can still pan beneath the controls, as it does now.
  This does not change the saved canvas or export geometry.
- Preserve mouse, touch, browser magnification, keyboard focus, Escape and focus
  return. PDF Left/Right and Shift+Arrow retain their current separate actions.

## Editor behavior, wording and preserved actions

The editor and saved layers do not change. There are no new buttons, menus,
notices, confirmations or wiki-page additions, and nothing is removed.

All wording stays exact: Zoom out, Reset zoom and its percentage, Zoom in, Fit,
Previous page, the existing page counter, Next page, Print, Download PNG,
Download PDF, Close, Pan and its four direction names/tooltips. Existing
translations remain. Images/slides retain PNG and PDF choices; PDFs retain
PDF-only Download. Print and Download keep their complete-document routes.

## Standards basis

[W3C resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
requires usable enlargement up to 200% through a supported mechanism. It does
not require an oversized default toolbar. The chosen 14/96-pixel limits are this
project's approved design values, not numbers prescribed by WCAG.

## Acceptance after approval

Reuse the maintained wiki and existing image, slide and PDF examples. Keep the
original clipped capture. Check 320 × 568, 390 × 844, 844 × 390 and fitting
desktop layouts, with normal UI text, enlarged article text and separately
enlarged UI text, plus actual browser magnification and long translated labels.
Check both themes, visible focus and forced-colors mode.
Every label must fit inside its button; rectangle-only checks are insufficient.
Check the outer height against both limits and prove that scrolling and keyboard
focus reach every action without hiding Close/Pan. Fit must use the remaining
visible area. Do not equate a larger article font with an intentionally enlarged
viewer UI, or present the stress-test typography as its normal appearance.

Retain the accepted pan/export results and rerun affected layout, focus,
keyboard and viewer regressions. Show actual native screens before acceptance.
No content Save, configuration change or additional wiki is needed. A design
mockup and browser emulation do not establish physical-device or full manual
accessibility acceptance.

The owner approved this bounded revision with **“Approve bounded toolbar”** before
implementation, satisfying prior approval under
[charter Rule 1](PROJECT_CHARTER.md#rule-1-nothing-users-have-is-taken-away-without-the-owners-approval):
“Nothing is built until the owner has approved it.”
