# Whole-PDF working-copy Import planning

This advances milestone 1, HIST-4 and DATA-1. A PDF layer set belongs to an owning
wiki page, file and name. Its PDF page numbers select internal members of that
one layer set. They are not separate layer-set names.

`PageOwnedWholePdfImportPlan` is an unregistered, detached preparation component.
It has no editor or API callers. The existing image/slide Import path is
unchanged. This component alone does not enable whole-PDF Import.

## Input and result

`prepare(request)` receives complete target and source snapshots, their selected
PDF anchor IDs, `admittedTargetSurfaces`, `mode`, `maxLayers` and `allocateId`.
Snapshots use the existing schema version 1 document shape. Admissions are
separately prepared empty target PDF members for source pages missing from the
target. The planner never constructs dimensions, file pins or surface IDs.

The result is `{ snapshot, importedLayerIds, pages }`. The snapshot is detached
from all input objects. Each `pages` entry contains `page`, `surfaceId` and
`importedLayerIds`, in source PDF page-number order. Existing target surface
order is preserved; new admitted members are appended in page-number order.

The supported modes implement the approved Import contract:

| Mode | Complete selected target layer set | Result |
| --- | --- | --- |
| `cancel` | Any | Returns null without inspecting payload or allocator. |
| `empty` | No layers on any member page | Imports into matching page numbers. |
| `append` | Has layers on at least one member page | Adds imported layers above each matching page's existing layers; target-only pages stay unchanged. |
| `replace` | Has layers on at least one member page | Replaces all layers throughout the selected target set, including clearing target pages absent from the source. |

## Preservation and refusal

Only the selected target group's layers and reading order change. Document
metadata, other layer sets, other files, slides, target member identity, source
version, dimensions, backgrounds and unknown finite metadata are retained.
Different source and target file versions are permitted; target file pins are
never replaced. Imported coordinates are not scaled.

Each group must contain only PDF members, with unique positive page numbers,
one exact visible label and identical source pin fields except page number.
Pins require the native version 1 local repository, file-title constraints,
31-character lowercase base36 SHA-1, calendar-valid timestamp and page bounds.
Source and target must have the same canonical file title and normalized
layer-set name. File-title comparison preserves case and underscores. The
source and target may belong to different owners; owner identity and access
must be established by the native read boundary, not by this planner.

Every source page must map to an existing target member or a matching empty
admission. Duplicate, conflicting, unused or nonempty admissions refuse the
whole plan. The planner does not prove that a supplied admission is authorized
or that its geometry came from the native media handler.

Finite JSON, complete selected groups, group/parent references, reading order,
page mappings and resulting imported-page layer limits are checked before ID
allocation. `maxLayers` is the existing per-page limit, not a new whole-document
limit. Imported IDs must be fresh across both complete snapshots and admitted
members. Repeated source IDs on different pages are mapped independently.
Only structural layer IDs, group references and reading order are remapped;
ID-like text and arbitrary layer payload are unchanged.

Malformed input, missing mappings or failed allocation returns the fixed
`layers-invalid-whole-pdf-import-plan` error. No partial candidate is returned
and no input is mutated. Allocators are external callbacks: a caller must not
use an allocator that modifies live work.

## Integration still required

Before activation, the existing Import boundary must read and freshly
authorize complete PDF groups, admit missing target pages against the exact
target PDF version, and repeat complete live-work checks after asynchronous
preparation. Apply the whole result atomically with editor state, Undo/Redo,
drafts and source provenance. The ordinary owning-page Save remains the only
publication path. The existing picker must show one source choice per whole
layer set, with the approved different-version notice and existing
Append/Replace all layers/Cancel choices.

Native, browser, supported-version and owner acceptance of complete Import
remain necessary. A detached planner checkpoint does not complete milestone 1.
