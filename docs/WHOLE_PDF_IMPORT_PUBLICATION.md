# Whole-PDF Import publication boundary

`PageWorkingCopyPdfImportPublicationService` is an unregistered native service
for the first ordinary owning-page Save after whole-PDF Import. It advances
Milestone 1 / HIST-4 / DATA-1 / SEC-2. It has no endpoint, editor caller or UI
registration. Existing image/slide Import and ordinary Save callers are unchanged.

The service accepts the existing target page ID, its explicit current revision,
the complete proposed document, the requesting native authority and an optional
owner note. Each source descriptor contains exactly `targetSurfaceId`,
`sourcePageId`, `sourceRevisionId` and `sourceSurfaceId`. These are group anchors;
they do not describe separately named PDF page sets. At most 32 descriptors may
be supplied. Different anchors of the same source owner/revision/file/layer set
produce one native source citation, independent of the PDF's page count.

The native whole-PDF reader authorizes the current editable target and the exact
readable source revision. Source and target must identify the same file and
normalized layer-set name; their upload versions may differ. The proposed group
must retain every stored target member ID and exact source pin/page mapping,
include each source page exactly once, and keep all members within the target
file's page count. Each member has the same target label and upload pin, with
only the internal PDF page varying. Consistent unsaved target renaming is
permitted; the citation uses the original source label. The caller supplies the
complete intended working copy, including target-only pages and unrelated work.
The service does not infer Append or Replace from the citation list.

New target members must have the deterministic native ID for the target owner,
base revision, original group label, file and PDF page. Optional
`admissionRevisions` records, each containing exactly `surfaceId` and `revisionId`,
support IDs issued at an earlier target base. The service freshly reads that
authorized target-owner revision and verifies the same stored group anchor,
label and exact pin, absence of the proposed page then, and the deterministic
ID. Foreign, hidden, fabricated, duplicate and unused associations are refused.
These checks establish a native historical association, not possession of an
editor session or durable permission. A wholly missing target layer set is not
supported by this service; a stored target group anchor is required.

All snapshot fields pass the ordinary strict publication validator. Unknown or
unsupported fields are refused rather than silently removed. A citation cannot
be attached to an unchanged group. The native summary retains each source owner,
exact source revision and layer-set name, followed by the optional note; a
summary that would be truncated is refused.

The service uses the existing native publisher and its final source guard inside
one cancelable database transaction. It repeats source visibility, exact snapshot,
owner identity, file version/address/count/geometry, target file and historical
association checks immediately before admission and after Save. A failed late
check rolls back the entire Save. A successful Save adds one native owning-page
revision with the original actor and complete proposed layer document, using the
ordinary main-slot and embed-rename safeguards. It never writes to the source
owner and never retries automatically.

This boundary alone does not activate whole-PDF Import. Editor/session/selection
application, Undo/Redo, drafts, request controls, transport registration and
native/browser/owner acceptance must be qualified before connecting callers.
