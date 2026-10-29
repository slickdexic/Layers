# Text layer selection bounds: proposed correction

**Status:** Approved and owner screen review completed October 28, 2026.
**Charter criterion:** Preserve editing capabilities for images, slides and PDF
pages (Milestone 1 and Rule 1's protected Editing register).

## Problem

The editor can measure a plain text layer as multiple wrapped lines even though
it displays that layer on one line. Its selection box and handles can therefore
be much narrower and taller than the visible text. The owner reported this on
an image layer set; a browser measurement of its saved text reproduced the
discrepancy.

## Proposed behavior

- When an editor selects a plain text layer, its existing box and handles
  follow the text actually displayed, including its alignment and rotation.
- Long plain text is measured as it is rendered; selecting it does not cause
  the text itself to wrap or change. Existing text-box wrapping stays as it is.
- Existing selection, move, resize, rotation, keyboard actions, controls,
  wording and saved layer data stay available. No new message or control is
  added. Readers see no change to page content.
- Test ordinary and long text, alignments, rotation and existing text boxes;
  show the owner the resulting editor screen before declaring the work done.

## Decision

The owner approved the proposed correction and confirmed that the resulting
editor view looked good on October 28, 2026.
