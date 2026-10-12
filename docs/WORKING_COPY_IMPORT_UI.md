# Page-owned working-copy Import

This integration advances milestone 1 / HIST-4, UI-10 and FEAT-4. It implements
the approved image/slide Import choice inside the editor and keeps the existing
Copy control and other entry points. It uses supported MediaWiki APIs and
ResourceLoader; no environment-specific runtime backend is added.

Existing writable, bound image/slide targets enable qualified full working-copy
history, pending native source citations and complete drafts before recovery.
The Import picker lists authorized matching names/files from other pages, with
page labels and slide sizes. Serialized choices never grant authorization.
Historical, legacy, PDF, missing-member and unbound-owner routes keep their
existing behavior in this bounded integration.

Selecting an empty target imports directly into the working copy. Populated
targets show both names and offer Append, Replace all layers and Cancel. Cancel
is initially focused; Escape cancels the choice. Replace displays the approved
warning. Populated slides keep their canvas; empty slides copy source canvas
and background. A differing image-file version gets a notice. Source IDs remain
internal and no wikitext is changed.

Native preparation and application revalidate complete participants and exact
source revisions. One-step Undo/Redo, group IDs, reading order, finite JSON,
target image pins and offscreen members are retained. Successful Import makes
an immediate local draft backup; it never publishes. Save uses the existing
publication transport and acknowledges native citations only after confirmation.
Destroy disposes in-flight source preparation/application before the editor.

Browser/HTTP and owner acceptance, missing/new target members, whole-PDF Import,
MediaWiki 1.44 and native mobile acceptance remain separate qualification work.

## Native desktop checkpoint: October 12, 2026

The revised Import preview's visual direction is approved. Native acceptance
now covers MediaWiki 1.45.3 at a 1440-wide desktop viewport, using a separate
test wiki with actual authorization, source reads and publication.

Four normal browser Saves passed: image Append, populated-slide Replace, and
direct Import into saved empty image and slide targets. Each operation passed
Undo/Redo, created exactly one owning-page revision with the native source
page/revision citation, returned to its owner on Close and reopened saved work.
Source pages, main wikitext, image pins and offscreen surfaces stayed exact.
Populated slides retained their canvas; the empty slide copied source geometry.
The image working-copy checks confirmed no revision before Save.

This checkpoint leaves native Import draft recovery and stale-save refusal,
missing/new target members, whole-PDF Import, mobile, MediaWiki 1.44 and overall
owner acceptance open. Save was outside the default 985-wide viewport; that
editor layout gap remains recorded under UI-6/UI-10. The temporary page box
still awaits qualified replacement closeout. No runtime change was required
by these desktop journeys. Private test data and evidence remain local.

## Native recovery and refusal checkpoint: October 12, 2026

Two independent-editor recovery journeys now pass on MediaWiki 1.45.3:
image Append into an existing populated target and direct Import into a saved
empty slide. The second editor explicitly restores the first editor's local
draft. Actual Undo/Redo restores the original and imported states, including
the empty slide's original and source canvas dimensions. Each recovered Save
creates one native owner revision with the exact source citation. Clean Close
returns to the owner, and reopening shows the saved layers and slide geometry.

The original editor then makes a late edit against its genuinely stale base.
Both normal Save activations refuse during native source/base revalidation,
before a publication request. The newer saved revisions stay exact; the late
local edits and usable Undo/Redo remain. This proves the pre-publication refusal
boundary, not the server's publication-conflict boundary or crash recovery.
Source pages, main text, target image pins and offscreen members stay exact.

The slide's stale Save used the normal button's keyboard action because its
pointer target lay outside the observed viewport. Narrow/mobile Save visibility
remains open. No runtime or maintained test change was required. Missing/new
targets, whole-PDF Import, MediaWiki 1.44, final UI-10 closeout and overall owner
acceptance remain open; milestone 1 is not complete. Private evidence stays local.
