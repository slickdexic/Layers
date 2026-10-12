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
