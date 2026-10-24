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

The published candidate now also passes the
[native HTTP privacy checkpoint](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md):
52 verified cases cover API privacy, CSRF refusals, exact PDF source delivery,
cache forcing, conditional requests and owner/revision identity refusals.
All seven owners and 17 captured tables remain exact in that read-only baseline.
Separate native transition checks now pass twenty role/protection/block/read-
revocation cases and twenty-four visibility/deletion cases. A file-deletion
exercise exposed loss of retained legacy rows after migration. The bounded
correction preserves those rows without bypassing cache purging or deleted-file
read refusal. Thirteen fresh corrected-runtime HTTP cases, five native tests
and the full standalone PHP suite pass. These are bounded results, not a
complete security review; the linked checkpoint distinguishes the unchanged
baseline from intentionally mutated disposable fixtures.

The actual 1.5.95/MySQL upgrade, post-upgrade PDF Save/reopen and reruns preserving
newer edits also pass in their recorded scope; see the [upgrade guide](UPGRADING.md).

Download file collection remains unqualified on 1.44. The browser's download
observer stalled both before a Layers Download click and when coupled with a
native MediaWiki Export click. That establishes an observer limitation outside
Layers and supplies no delivered annotated PDF. Do not repeat that waiting path.
The actual Print button reached Preparing pages, but further script inspection
was blocked and no prepared document was retained. Print is unqualified; no
production defect is established by this incomplete observation.

Remaining version/device combinations, broader security/performance checks
and owner acceptance stay on the
[Milestone 1 release checklist](MILESTONE_1_RELEASE_CHECKLIST.md).
This checkpoint qualifies the recorded journeys and does not complete the
supported-version matrix or Milestone 1.
