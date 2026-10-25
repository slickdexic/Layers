# Phone viewer acceptance

Recorded October 25, 2026; advances Milestone 1 / UI-2 / UI-3 / UI-8 / UI-10.
The release remains **partially qualified**: touch panning is a demonstrated
defect awaiting the owner's approval of the
[bounded repair](VIEWER_TOUCH_PANNING_BEHAVIOUR_BRIEF.md).

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

## Demonstrated touch-panning defect

After Zoom enlarges the media above 100%, a one-finger drag does not move it.
This fails for all three media types in both themes. A separate native-browser
control sends the same 60 × 40-pixel drag to the same image coordinates. Touch
events reach the media but leave its transform unchanged; mouse input changes
the transform by the expected amount. The reader currently binds panning to
mouse events only. This is a product defect, not a failed touch observer.

The proposed repair extends the existing pan to one-finger touch, preserves taps
and browser-native multi-touch handling, and clears unfinished gestures on
cancel, close or page change. It adds no controls, wording or layout. It has not
been implemented: charter Rule 1 requires prior approval for the interaction
change. Retain the no-movement evidence and the working mouse control for the
post-repair comparison; do not describe phone viewing as fully accepted yet.

The [1.8 ledger](RELEASE_1_8_ACCEPTANCE.md) and
[known issues](KNOWN_ISSUES.md) retain this open item. Physical-device and owner
acceptance are not replaced by the six positive browser checks. Private captures,
credentials and test configuration remain local.
