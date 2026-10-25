# Full-size viewer touch panning

**Status:** Owner-approved October 25, 2026; implementation and acceptance recorded
in [phone viewer acceptance](PHONE_VIEWER_ACCEPTANCE.md).
**Date:** October 25, 2026. Advances Milestone 1 / UI-3 / UI-8 / UI-10.

## Observed problem

On a phone-sized Minerva page, an image, slide or PDF opens through the existing
View full size overlay. Zoom buttons enlarge it, but a one-finger drag does not
move the enlarged media. The same drag with a mouse does move it. This was
reproduced for all three media types in light and dark, with a separate native
touch-event/mouse control at identical coordinates.

## Approved reader behavior

- Keep the existing overlay, full-size viewer, toolbar, Close, labels and control
  order in their current positions. No wiki-page content is added.
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

## Accessible panning controls

While viewer zoom is above 100%, show a compact **Pan** strip at the bottom
center of the viewer, separate from the existing top toolbar. It contains four
arrow buttons in this order: left, up, down, right. Each new button has a minimum
44 by 44 CSS-pixel target. The strip fits a 320-pixel viewport and stays clear
of its bottom safe area. It uses the viewer's existing dark, high-contrast chrome
and blue visible focus style, with a dark backing behind the new focus ring for
contrast over bright media. It appears on desktop as well as touch screens.

- The visible group label is **Pan**. The button accessible names are **Pan
  left**, **Pan up**, **Pan down**, **Pan right**. Tooltips add the corresponding
  shortcut, for example **Pan left (Shift+Left Arrow)**. All new wording is
  translatable.
- A tap or click shifts the viewed area in the arrow's direction by one fifth
  of the available viewing width or height, stopping at the media edge. Thus
  **Pan left** reveals content to the left; the media moves right. Repeated taps
  can reach each edge. Disable a direction that cannot reveal more content;
  the media must not disappear completely through button panning.
- Tab reaches the enabled buttons; Enter or Space activates them. Shift+Arrow
  provides the same panning while the viewer is active. Unmodified Left/Right
  retain PDF page navigation. Existing zoom, Fit and Escape shortcuts stay.
- At 100% or below, hide the strip and remove its buttons from keyboard focus.
  If a zoom or Fit shortcut hides a focused Pan button, focus the existing zoom
  indicator. Otherwise, showing or hiding the strip never moves focus.
- Close or a PDF page change clears an unfinished gesture. A new page keeps the
  existing zoom/pan reset; its strip visibility follows its resulting zoom.

This is an additional way to use the existing pan function. It adds no mode,
menu, confirmation, saved state or document content. The local design preview
places only the proposed strip over an unchanged native capture; it is not
runtime or browser acceptance evidence.

## Editor behavior and wording

The editor and saved layers do not change. New wording is limited to the Pan
group, four accessible button names and shortcut tooltips above. Existing labels,
including View full size, Print, Download PNG and Download PDF, remain exact.
Image/slide format choices and PDF-only Download remain as approved. Nothing
existing goes away or moves.

## Acceptance before integration

Verify one-finger pan on enlarged images, slides and PDF pages in the maintained
Minerva wiki, in light and dark. Retain the original no-movement evidence and a
working mouse control. Check stationary taps, normal-scale gestures, multi-touch
handoff, touch cancellation, PDF page changes, viewer close/reopen and disposal.
Verify all four buttons and shortcuts, media edges, disabled directions, focus
when the strip hides, 320-pixel width, landscape and enlarged browser text.
Check that unmodified PDF arrows still change pages and Shift+Arrow does not.
Keep existing mouse/keyboard/focus and export regressions passing. Run scoped
accessibility checks, including contrast over bright media. No content Save,
new wiki or database clone is needed. Browser touch emulation and automated
accessibility checks do not replace physical-device or manual acceptance.

## Standards review and accessibility refinement

The owner's direction is to follow established practice. The
[GNOME input guidelines](https://developer.gnome.org/hig/guidelines/pointer-touch.html#scrolling-panning-zooming)
map touchscreen panning to a single-finger drag and zooming to a pinch. The
recommended gesture repair therefore remains one-finger panning of enlarged
media, with browser-native zoom preserved. Do not disable browser magnification
globally; [MDN's touch-action guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action#accessibility)
explains its accessibility importance.

There is an additional requirement missing from the original narrow proposal:
[WCAG 2.2 dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
requires an equivalent single-pointer operation without dragging, apart from
its specified exceptions. Keyboard access is a separate requirement. The
existing Zoom and Fit buttons do not provide equivalent panning of enlarged
content, and existing PDF arrow-key page navigation must be preserved.

The Pan strip above is the concrete approved alternative. Its layout is an
engineering recommendation; the sources do not prescribe a particular toolbar.
It supersedes the original gesture-only proposal's no-new-control constraint.
The owner approved the revised brief before implementation: **“Approve the
revised design.”** The original gesture-only proposal remains superseded.

The recorded approval satisfies [charter Rule 1](PROJECT_CHARTER.md#rule-1-nothing-users-have-is-taken-away-without-the-owners-approval)
for this bounded interaction and control design. It does not approve changes
to unrelated controls or the editor.
