# MediaWiki 1.44 native acceptance

This checkpoint advances Milestone 1: page ownership and native revision history,
including HIST-1, HIST-4, DATA-1, UI-10 and installation compatibility.

The published candidate at `27721b0` was installed on a separate MediaWiki 1.44.6
wiki using the native SQLite installer, extension database update and migration.
The migration dry run passed; HTTP then confirmed completion with no added
content revision. Layers code was mounted read-only from the exact public tree.
The test wiki had its own database, uploads, credentials and logs. Existing
wikis and private configuration were excluded from its mounts.

## Qualified journeys

| Journey | Result |
| --- | --- |
| Image editing | Native overlay entry, text edit, immediate Save, owning-page return and overlay reopen passed. One owner revision was added, with the complete payload otherwise unchanged. |
| Slide editing | Native overlay entry, text edit, immediate Save, owning-page return and overlay reopen passed. One owner revision was added, with the complete payload otherwise unchanged. |
| Independent ownership | Another page using the same file and layer-set name remained byte-equivalent in its native revision payload. Unrelated layer sets and the source owner were preserved. |
| Whole-PDF Import | A missing target opened on page 2 of 2. The native catalog imported both source pages. One Undo removed the complete Import; page traversal and Redo restored both members. |
| PDF first Save | A narrow 390 × 844 browser viewport completed Save, owning-page return and overlay reopen. One revision included the source owner, source revision and layer-set attribution. Both members kept one visible name. |
| PDF preservation | Native readback preserved main text, file-version pins, both complete layer payloads and reading order. Target dimensions matched pre-Import native metadata; imported coordinates were not scaled, as required by the existing Import contract. |
| PDF history and diff | Native history showed the attributed layer-set edit. The native diff included the layer-set change region and both members' stored changes. |
| Saved PDF viewing | Reopen and page traversal showed both saved members. The full-size viewer reached the saved second page with its layers. |
| Complete PDF draft recovery | Explicit Restore in a fresh editor recovered edits on both pages and each page's Undo/Redo history. Recovery and Undo/Redo added no revision. One explicit Save preserved both complete members, pins and main text; Close returned to the owner. |
| Stale Save and reconciliation | A concurrent revision changed the other PDF page. Stale Save refused with `layers-edit-conflict`, retaining visible work and Undo history and adding no revision. Explicit Check reconciled the disjoint changes; one subsequent Save retained both the concurrent and local work. |
| Selective historical restore | Native history opened the selected earlier PDF member. Restore created one owner revision containing that member's exact historical payload, while preserving the other PDF member, main text and independent owners. Overlay reopen confirmed the resulting saved content. |

Each successful browser Save was performed once. Fixture setup and readback used
native APIs; browser actions used the actual editor and overlays. No Layers
runtime, schema, maintained test or existing interface change was required.
Existing exact-commit CI results were retained; unchanged suites were not
repeated locally for this environment-only qualification.

## Remaining acceptance

Download file collection remains unqualified on 1.44. A second attempt timed out
in the browser observation tool before a Download click; this establishes no
export defect and supplies no delivered-file evidence. Further collection must
avoid that stalled observation path. Print, the remaining version/device
combinations, a 1.5.x upgrade, combined security, privacy/performance checks and
owner acceptance remain on the
[Milestone 1 release checklist](MILESTONE_1_RELEASE_CHECKLIST.md).
This checkpoint qualifies the recorded journeys and does not complete the
supported-version matrix or Milestone 1.
