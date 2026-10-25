# Full-size viewer touch panning

**Status:** Proposed; owner approval required before implementation.
**Date:** October 25, 2026. Advances Milestone 1 / UI-8 / UI-10.

## Observed problem

On a phone-sized Minerva page, an image, slide or PDF opens through the existing
View full size overlay. Zoom buttons enlarge it, but a one-finger drag does not
move the enlarged media. The same drag with a mouse does move it. This was
reproduced for all three media types in light and dark, with a separate native
touch-event/mouse control at identical coordinates.

## Proposed reader behavior

- Keep the existing overlay, full-size viewer, controls, labels, ordering and
  appearance. No caption, notice, toolbar button or wiki-page content is added.
- When the viewer's zoom is above 100%, dragging with one finger moves the
  enlarged image, slide or current PDF page with the finger. This extends the
  existing mouse-panning behavior to touch; it does not introduce another view.
- A tap remains a tap. At 100% zoom or below, do not capture a drag for viewer
  panning. Keep the existing Zoom in, Zoom out and Fit actions.
- Preserve browser-native pinch and double-tap behavior where supported; do not
  replace it with a custom pinch-to-zoom feature. Multiple touches stop the
  viewer's single-finger pan and leave browser gesture handling available.
- Lifting or cancelling the touch ends the pan. Closing the viewer, switching a
  PDF page or starting another view clears any unfinished drag.
- Preserve mouse dragging, keyboard controls, Escape, focus return and the
  editor's independent touch behavior. Print and Download keep their current
  complete-document routes.

## Editor behavior and wording

The editor and saved layers do not change. No new text or error message is
introduced. Existing labels, including View full size, Print, Download PNG and
Download PDF, remain exact. Image/slide format choices and PDF-only Download
remain as approved.

## Acceptance before integration

Verify one-finger pan on enlarged images, slides and PDF pages in the maintained
Minerva wiki, in light and dark. Retain the original no-movement evidence and a
working mouse control. Check stationary taps, normal-scale gestures, multi-touch
handoff, touch cancellation, PDF page changes, viewer close/reopen and disposal.
Keep existing mouse/keyboard/focus and export regressions passing. No content
Save, new wiki or database clone is needed for these checks. Browser touch
emulation does not replace physical-device owner acceptance.

This brief changes viewer interaction and therefore requires the owner's prior
approval under [charter Rule 1](PROJECT_CHARTER.md#rule-1-nothing-users-have-is-taken-away-without-the-owners-approval).
