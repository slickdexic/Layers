# Editor toolbar reflow

The project owner approved this behaviour on October 17, 2026. It advances
milestone 1 and UI-10 by keeping the existing editor controls reachable.

When the toolbar groups do not fit on one row, whole groups continue onto the
next row. Their order, buttons, wording, tooltips and keyboard shortcuts stay
the same. Save remains the last button in its existing action group. There is
no overflow menu, hidden action, replacement Save or change to Save/Close.
Layouts that fit retain one row. Existing narrow-screen handling for an
individual oversized group remains.

The implementation uses flex wrapping. Toolbar rows and groups do not shrink
to fit their siblings; the existing flexible editor workspace takes the space
below the toolbar. It introduces no fixed toolbar height, JavaScript layout
observer, DOM reordering or alternative publication path.

Native image, slide and two-page PDF checks confirm Save creates the owning
page's revision and Close returns there. PDF page navigation preserves edits.
At 1280 and 1440 pixels the PDF toolbar wraps; at 1920 pixels its fitting
layout, control order and canvas geometry are unchanged. Save is also visible
at 768 and 390 pixels, with the canvas below the toolbar.

Page-owned Escape uses the same owning-page return as header Close. Legacy
Escape and unfinished angle-dimension cancellation retain their behavior.
This restores the existing navigation contract; it adds no new destination.

Source versions, prior layers, sibling PDF pages and main-page text are
preserved in the native Save checks. The narrow fine-pointer header/sidebar
layout remains outside this toolbar change. Wider mobile and owner screen
acceptance remain open; this checkpoint does not complete milestone 1.
