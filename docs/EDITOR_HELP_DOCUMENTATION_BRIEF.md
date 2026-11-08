# Editor help factual corrections for v1.8

Advances Milestone 1 / OPS-1–OPS-2 and HIST-4–HIST-5. Requested by the owner:
make all documentation, including built-in editor help, current and factual.

**Approved:** owner replied “Approve the factual help corrections”.

## Behavior

The existing Help dialog retains its Overview, Tools, Shortcuts and Tips tabs,
Close button, keyboard behavior and layout. No editing action changes. The
Overview explains page ownership, Import and recovery; Tools adds the existing
Import Image action. The following English text and matching JavaScript
fallbacks replace inaccurate help. Translation descriptions explain the new
meaning; languages without these messages continue to fall back to English.

## Exact wording

- Introduction: “The Layers Editor adds text, shapes and other layers to images, PDF pages and standalone slides.”
- Canvas: “The main editing area shows the image, slide or PDF page with its layers.”
- Layer Panel: “Shows layers, visibility controls and properties. It is beside the canvas on wide screens and above it on narrow screens.”
- Save step: “Click Save and wait for confirmation. In page-owned editing, Save creates a revision of the owning wiki page.”
- Selection range: “In the layer panel, Shift+Click selects a range of layers.”
- Pen: “Press and drag to draw a freehand path. Release to finish.”
- Shape Library: “Browse 1,385 built-in shapes, including safety signs, technical symbols and arrows.”
- Import Image: “Use Import Image to add an image file as a layer. This is separate from importing a saved layer set from another wiki page.”
- Default embed: “After migration, shows this page and image's Default layer set.”
- Named embed: “After migration, shows the named layer set owned by this page for this image.”
- Save troubleshooting: “Keep the editor open and read the error. If the outcome is uncertain, use Check saved page when offered. Preserve your local drafts; do not clear browser storage.”

New Overview sections:

**Page ownership and history**

“After migration, open Edit layers on the saved image, slide or PDF embed on its owning wiki page. Layer sets on different pages are independent, even when their names match. Use that page's history for earlier saved versions. A PDF layer set uses one name across its pages; Save includes the whole set.”

**Import a layer set**

“Import copies saved work from another readable wiki page. Images and PDFs require the same file and layer-set name; slides require the same slide name. Other files, names and media types are not offered. Enter the beginning of the source page's title. Import makes an independent copy; later source edits do not update it.”

“For PDFs, Import copies the whole layer set and matches pages by page number. An empty target imports immediately; otherwise choose Append or Replace all layers. You can undo Import. Click Save to keep the result.”

**Local recovery**

“Review and Restore recover a local draft. Restoring is not a saved page revision until Save succeeds. Keep drafts and current work when a Save fails or its outcome is uncertain.”

## Verification

Check existing Help dialog tests, translated-message registration and lint.
Inspect all four tabs on the maintained 8080 wiki at desktop and narrow widths.
The published v1.8rc1 tag and download remain immutable; this correction belongs
to the next candidate unless separately released.

## Additional factual shortcut finding

Source review found no M/G/J dispatch in the shipped keyboard handlers.
Help keeps the Marker, Shape Library and Emoji entries, using an em dash in
place of those unsupported shortcut claims. Their toolbar actions remain.
This falls within the approved factual corrections; no shortcut is removed
from the implementation. The public shortcut guides record the discrepancy.

## Verified implementation — November 8, 2026

The approved text, fallbacks and eight new registered/documented messages are
implemented. The affected Help/version selection passes 45 tests; JS lint,
i18n wiring and source growth pass. The actual signed-in 8080 editor Help was
inspected in all four tabs and at 390 × 844: the dialog fits and scrolls with
its tabs and Close reachable. Resource-debug mode was used after slow normal
module loading; no storage was cleared and no wiki content was saved. Screens
were shown to the owner. This is bounded UI evidence, not physical-device or
screen-reader acceptance. The RC1 release archive and installed 8082 image are
unchanged; the correction is Unreleased on main and source-mounted 8080.
