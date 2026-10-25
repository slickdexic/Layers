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

The earlier download observer stalled before Layers Download and with native
MediaWiki Export. Those failures remain recorded; do not repeat that waiting
path. The October 25 check below instead collected the actual delivered PDF from
disk and verified both complete pages. The actual Print button also reached the
native beforeprint event with both page images decoded and retained. These close
Download collection and Print preparation in the recorded browser scope;
operating-system dialog and physical Print acceptance remain unproved.

Remaining version/device combinations, broader security/performance checks
and owner acceptance stay on the
[Milestone 1 release checklist](MILESTONE_1_RELEASE_CHECKLIST.md).
This checkpoint qualifies the recorded journeys and does not complete the
supported-version matrix or Milestone 1.

## Complete PDF Download and native Print preparation — October 25, 2026

This read-only check reused the maintained MediaWiki 1.44.6 / MySQL wiki and its
existing saved two-page PDF. The shared checkout matched published baseline
`2a25d28`; no installation, database clone, content Save or runtime change was
needed. Browser: installed Chromium 145.0.7632.6 in headless mode on Windows.
This is browser acceptance against native MediaWiki services, not a mock server.

One actual **Download PDF** click delivered a strict-parseable, complete two-page
PDF. The file was collected from the browser's download directory without a
download-event waiter or substituted export. Each page contains its complete
composite at 1600 × 800 and 1600 × 3200 pixels respectively. The full-bleed image
transforms preserve the saved landscape/portrait proportions without cropping.
Independent Poppler rendering and visual inspection confirm both native
backgrounds and both saved layer-text labels.

One actual **Print** click prepared the same two decoded page images and invoked
the browser's native beforeprint event. A passive event listener retained the
prepared images and document; the print method was not replaced. The original
JPEG stream of each downloaded PDF page matches its corresponding Print image
byte for byte. This verifies complete Print preparation and agreement with
Download. It does not establish the operating-system print dialog, printer
selection, physical pagination or paper output.

The initial viewer opened on page 2 of 2 and offered PDF Download without PNG,
as required for PDFs. The owner retained every revision and exact main/layers
slot payload, including both members and their source pins. Unordered API tag
sets were compared independently of their response ordering. The browser was
closed after the single Download/Print journey. Credentials, PDF captures and
screenshots remain local and outside the published extension.

Both built-in browser-control kernels were unavailable. The installed direct
browser run avoided the earlier stalled observer. Preliminary checks stopped
before either action on an unordered-tag comparison and a hidden-overlay
selector; both observations remain retained. Independent verification uses the
PDF's original encoded JPEG streams, not an image library's recompressed copy.
Existing native/client suites were retained without another unchanged full run;
the remaining release matrix and owner acceptance are still separate.
