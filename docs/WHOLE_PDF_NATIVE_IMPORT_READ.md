# Native whole-PDF Import preparation

This component advances milestone 1, HIST-4 and DATA-1. It is an unregistered
native read/preparation service with no API, editor or UI callers. It does not
enable whole-PDF Import. Existing image/slide Import behavior stays unchanged.

`PageWorkingCopyPdfImportReadService::read()` receives exact target/source
owner and revision IDs, their stored PDF anchor IDs and the original native
requesting authority. The target must still be current and editable. The source
must be a different readable owner in scope; an exact readable historical
source revision is permitted. IDs are internal and are not author syntax.

Within each authorized owner, one canonical file title and normalized layer-set
name selects the complete PDF group. Its stored members share one exact visible
label and one exact local upload pin, with distinct internal page numbers.
Source and target may use different upload versions. Internal pages never get
different layer-set names, and unrelated files, names and slides stay in the
complete snapshots without being selected or resolved.

## Result

| Field | Meaning |
| --- | --- |
| `target`, `source` | Exact native owner/revision/anchor descriptors. |
| `targetBundle`, `sourceBundle` | Complete snapshots, native geometry and renditions for every selected stored member. Snapshots preserve JSON objects, arrays, null and readable historical layer metadata. |
| `targetGroup`, `sourceGroup` | Visible label, exact file pin without page, native PDF page count and page-sorted stored member inventory. |
| `admittedTargetSurfaces` | Empty native target members needed by the source group but absent from the stored target group. |
| `admittedTargetGeometry`, `admittedTargetRenditions` | Native handler geometry and rendition data keyed by those admitted target IDs. |

Missing target members are prepared using the target's exact pinned PDF version,
native page dimensions and existing deterministic identity mechanism. Their
layers are empty. They are never written to the snapshot or wiki here. Source
page numbers outside the target version refuse the complete request before any
admission. Unavailable counts, source bytes, geometry or permissions also refuse
the complete result; there is no skipped-page or latest-upload fallback.

Preparation may generate native renditions, so both complete revision contents,
group pins/inventories, page counts, handler geometry, native file addresses and
owner identities are rechecked afterward. A reupload that moves a source into
the archive refuses stale rendition references even when geometry is unchanged.
New members' source visibility/count/geometry and final
target edit/source read authority are rechecked too. The response contains no
native File objects or backend paths. It is detached data, never permission
that survives transport or later editor changes.

## Integration still required

The native endpoint and client must preserve this complete response contract,
then repeat current editor/session checks before atomically applying the
detached whole-PDF planner result with Undo/Redo, drafts and Import provenance.
Ordinary owning-page Save remains the only publication path. Existing strict
publication validation remains in force; reading historical metadata does not
authorize silently stripping it or publishing unsupported fields.

HTTP, browser, supported-version and owner acceptance of complete whole-PDF
Import remain open. Wholly missing target layer sets need the corresponding
creation admission; this reader requires a stored target anchor. This boundary
alone does not complete milestone 1.
