# J112C2 — Integrated identity and PDF layer-set acceptance

**Status: accepted for the bounded technical implementation after lead corrections — October 3, 2026.** The strengthened browser minimum passes. Owner screen sign-off remains pending; this does not complete HIST-4/HIST-7, the full TYPES-4 journey or Layers 2.0. Earlier reports below retain their dated evidence.

**Advances:** HIST-4 (owning page/file/name identity), HIST-7 (atomic rename), TYPES-4 and DATA-3 (PDF pages and draft preservation). The owner retains architecture and larger behavior decisions. This is acceptance of the lead's integration, not a request to reconsider the settled model.

## Owner wording correction — October 3, 2026

The owner objected to “Copy a drawing from another page” in the review gallery. The vocabulary had already been settled by charter Rule 2 and the approved brief's section 8. Deferring that correction to a later packet was a lead error. This follow-up advances HIST-4/HIST-5/HIST-7 and the charter vocabulary requirement; it does not reopen the product terminology or require new approval to apply it.

Corrected **67 English messages** and **61 translator descriptions**, preserving every message key and parameter. Both copy titles now read **Copy a layer set from another page**; the editor heading reads **Layer set: …**; edit/create/rename/history/restore/errors and new summaries use layer-set terminology. The existing copy catalog counts results, so its status now says **Results: …**, without misrepresenting stored PDF-page entries as separate layer sets. A Pen path is **Freehand layer**, with matching JavaScript fallbacks. Five legitimate drawing-tool/action/canvas messages stay unchanged. Internal classes/API/message/tag identifiers and stored historical text remain unchanged. Scope-specific name errors no longer suggest a name must be unique across unrelated files.

Verification:

- Full `npm test`: **15,190 tests / 208 suites**, including style, message validation/wiring and static/budget gates. One old path-label expectation initially failed and was aligned with the approved layer terminology; the final full run passes.
- Focused native copy/history/summary/restore tests: **61 tests / 538 assertions**, all passed. Changed PHP test style passes. No production PHP logic changed.
- Serial Chromium C2 rerun: **2 tests in 2.9 minutes**, **19 original screenshots**, now also capturing the copy picker. Assertions check the actual picker and confirmation titles, editor heading and newly stored copy-summary wording. Both draft recoveries, stale-save retention, PDF rename/copy and style preservation still pass. No browser or cleanup errors.
- Authorized readback: all **15 recorded revisions** agree with the ledger. Destination baseline **2819** was restored at **2834**; source baseline **2820** was restored at **2835**. Every captured slot and snapshot matches; isolation **230/2740** remains unchanged. Both restored revisions were still current.

Current gallery: `tmp/J112C2-owner-review.html` (also `tmp/J112C2-owner-review-corrected.html`). All 19 images and gallery navigation were checked; the lead inspected the rendered copy picker, confirmation and corrected editor. The earlier gallery is preserved as `tmp/J112C2-owner-review-before-terminology.html`. Evidence: `tmp/j112c2-terminology-browser/`, `tmp/j112c2-terminology-browser.log`, `tmp/j112c2-terminology-readback.json`, `tmp/terminology-npm.log`, `tmp/terminology-native.log` and `tmp/terminology-message-audit.json`. No older write specs were rerun; their literal message expectations were aligned without changing their actions or cleanup. The separately known unsafe cleanup in the older copy-list spec is still excluded.

The two delegated engineers reached their usage limits before editing, so the lead completed this correction and review directly; no independent review is claimed for this follow-up. No ordinary content/configuration/migration changes, commit or push. Owner screen approval remains pending. Existing layer-set vocabulary is now corrected rather than deferred; page-ID output, the migration transition and J111's viewer remain separate unfinished work. Earlier reports below retain their dated evidence.

## Lead review findings — October 3, 2026

The junior's completed minimum provides substantive evidence for independent equal names, exact PDF pages, empty page 3 joining the same set, whole-set rename/copy, two explicit recoveries and a refused stale save. The lead inspected all 18 original screenshots and independently read back all 15 recorded revisions through the authorized API. Both final baselines matched exactly at destination 2804/source 2805; isolation page 230 remained main-only revision 2740. No acceptance test or live write was needed to establish those original results. Readback evidence is in `tmp/j112c2-lead-readback-original.json`.

Two findings required correction before final lead acceptance:

1. **Unrelated text styles changed during Font Size.** Revision 2792's page-two text used supported `color:#11a261` with no `fill`; font-only save 2794 introduced `fill:#000000` and a default font family. Red page-one text suffered the same change. The later rename preserved the already altered content. This was a pre-existing editor defect exposed by the fixture, not invalid test data. `CanvasManager.updateStyleOptions()` was applying all merged tool defaults to selected layers. It now applies only the requested fields, while retaining merged defaults for new layers; `StyleController` no longer injects unrequested font fields. No saved content is automatically rewritten. All five new integration cases failed before the correction and then passed, covering supported color fallback, explicit/transparent fill precedence, fonts, selected siblings and intentional color changes. A caller audit found no lost partial-shadow update in the current call paths.
2. **Cleanup-only mode trusted receipt targets.** A receipt could name an ordinary page instead of the two authorized fixtures. The new pure validator rejects nonallowlisted title/PageID pairs, duplicate owners, wrong/absent baseline slots, mismatched snapshots, invalid revision IDs and discontinuous acknowledgements before any write. The cleanup-only path also verifies historical baseline bytes and every current acknowledged revision/content before its first write, retaining a fresh exact-base check for each owner. Its mode skips the ordinary scenarios. The initial source quiet exception is restricted to 272/2742; subsequent quick runs require an exact cleanup receipt. All 26 validator tests pass.

The lead delegated these two bounded corrections to separate engineers and inspected their changes. The necessary production scope extension is limited to `CanvasManager.js` and `StyleController.js` to preserve existing text-editing behavior; there is no new control, wording, schema, migration or architecture decision. The browser spec now verifies every text property through a Font Size edit and the full saved PDF surface afterward. Changing the fixture to avoid the discovered defect would not be acceptable evidence.

Full `npm test` now passes **15,190 tests across 208 suites**, with Grunt lint and static/budget checks. The existing junior native **98 / 790** and focused client **142 / 2 suites** remain their reported runs; PHP did not change during this lead correction. Broader native-only cases, legacy draft aliases, permission-denial browser coverage, J111 and J113 remain outside the minimum browser claim.

### Final lead verification and owner review

The strengthened Chromium run passed **2 tests in 3.1 minutes**, serially with no native tests running, and captured **18 fresh screenshots**. It verifies the complete selected layer after a Font Size edit and the complete saved PDF surface. The saved/recovered red and green text now retains its color. Both PDF pages retain one set name through rename and whole-set copy; two local drafts recover independently; a stale save after revision 2818 returns `layers-edit-conflict` and keeps the 46px page-two edit. Browser and cleanup error arrays are empty. A delegated reviewer independently audited the final ledger, assertions and cleanup validator and found no remaining blocker within this scope.

| Owner | Captured baseline | Last acknowledged scenario revision | Exact restoration |
| --- | --- | --- | --- |
| Destination 228 | 2804 | 2818 | 2819, parent 2818 |
| Source 272 | 2805 | 2815 | 2820, parent 2815 |
| Isolation witness 230 | 2740, main only | No write | Still 2740, unchanged |

Independent authorized readback verified all **15 recorded revisions**, historical baselines and restoration parentage, plus every final slot's roles/models/formats/bytes and complete Layers snapshots. Both restored revisions were still current. The isolation witness was independently checked at 230/2740. This is restoration of captured content, not deletion of the test revisions/history. No ordinary content pages, uploads, configuration or migration were changed; no commit or push.

Local evidence:

- Browser log: `tmp/j112c2-lead-browser.log`; result and original screenshots: `tmp/j112c2-lead-browser/page-owned-scoped-identity-182e1-e-copy-and-draft-acceptance-chromium/`.
- Final independent readback: `tmp/j112c2-lead-readback-final.json`; full JavaScript/static log: `tmp/j112c2-lead-npm.log`.
- Owner gallery: `tmp/J112C2-owner-review.html`. All 18 original images and navigation were checked locally. Review in order: independent equal names; save/add-page/rename; exact-preview whole-set copy; separate draft recovery and refused stale save. The screenshots demonstrate retained work; the ledger records the conflict response.

Final documentation verification passes: **80 maintained/policy documents and 53 historical records**, with mirrors/references/source checks agreeing; changed-file lint and `git diff --check` pass.

**Owner screen decision remains open.** The charter's Read this first, Rule 1 requires: “After building, show the owner the screens before calling the work done.” Technical acceptance does not supply that approval. At this earlier checkpoint the lead incorrectly deferred the “Drawing” wording; the owner correction and fresh gallery above supersede that deferral. Page-ID output remains J113 work. J111's missing hover controls and full-size PDF viewer remain open. The lead-reviewed [J113A packet](J113A_BARE_NAME_OUTPUT_PACKET.md) is ready for external delegation independently of screen review.

## Resume here — lead review and fixture decision, October 2, 2026

The junior correctly stopped: owner 230/revision 2740 has no Layers slot. `PageOwnedAdmissionHooks` refuses slot removal, and publication can restore an empty snapshot but cannot recreate an absent slot. No removal exception, hook bypass, database edit or change of product behavior is authorized for cleanup.

The lead instead created one reusable source fixture through the normal authenticated `layerspublish` API with `baserevid=0`. This is deliberate test-fixture provisioning, not a temporary edit that must remove its page afterward. It preserves the original isolation fixture and requires no upload or configuration change.

| Role | Dedicated title | Page ID | Verified checkpoint | Baseline |
| --- | --- | --- | --- | --- |
| Destination | `Layers_browser_acceptance` | 228 | 2741 | Existing full `Welcome Slide` snapshot; exact main text `Dedicated automated Layers history acceptance page.` |
| Source | `Layers_browser_scoped_source` | 272 | 2742 | Actual `layers` slot containing `{"schemaVersion":1,"surfaces":[]}`; exact main text `Dedicated automated Layers scoped source acceptance page.` |
| Read-only isolation witness | `Layers_browser_acceptance_isolation` | 230 | 2740 | Still `main` only; exact main text `Dedicated automated Layers isolation page.` |

These revision IDs are checkpoints, not hardcoded future cleanup bases. Capture fresh baselines before each run. Both writable owners must be at their provisioned content with readable complete snapshots; all test saves and cleanup use their original PageIDs and the last acknowledged revision written by that run. Existing suitable PDFs remain available: `File:Layers migration fixture B.pdf` has three pages, and `File:Somepdf.pdf` has eleven. Revalidate metadata and record the actual selected pin.

**Junior resumption:** extend the current preflight-only spec into the browser journey specified below. Use page 272 for the source-side equal-name and exact-preview copy scenarios, and page 228 for destination/edit/recovery scenarios. Restore each to its captured actual Layers baseline. Do not enroll or seed page 230. Complete the remaining matrix, save screenshots and append a new report; the full browser task has not been performed by the lead.

The reviewed exact-preview native case is accepted: it changes both source PDF pages and their name after preview, then proves the destination uses the earlier authorized revision with all pages and pins intact. The junior's test-only negative control demonstrates a completeness assertion failing; it is not a mutation of the production copy path. An independent reviewing engineer agreed that the original baseline blocker was real and found no production defect in this bounded review.

**Lead verification:** a delegated test engineer strengthened preflight to require valid snapshot/serialized-content agreement, complete slot metadata and quiet-owner checks, and added a native empty-baseline restoration/stale-cleanup test. The lead ran that case, the junior's exact-preview case and the existing direct-write/slot-removal guard serially: **3 tests / 52 assertions passed**. Only after that run finished did the lead create page 272. Fresh reads verified its `main`/`layers` roles, exact baseline, parent 0 and successful authorized `layersread`; pages 228 and 230 stayed byte-identical at revisions 2741 and 2740. Chromium-configured read-only preflight then passed **1 test / 0 skips**. It uses the authenticated request context and is not evidence of editor interaction or rendered screenshots.

Local provisioning evidence is retained in ignored `tmp/j112c2-source-baseline.json`; new preflight evidence is under `tmp/j112c2-resume-preflight/`. The original failed junior artifact remains intact under `test-results/`. No production/configuration changes, commit or push. The only ordinary-wiki write in this lead follow-up was creation of the named dedicated source fixture.

## Read first and obtain the correct tree

Read `AGENTS.md`, the charter's **Read this first**, the approved [behavior brief](LAYER_SET_BEHAVIOUR_BRIEF.md), the current [handoff](IMPLEMENTATION_HANDOFF_PLAN.md), [C1's reviewed contract](J112C1_SCOPED_RENAME_PACKET.md) and the [integration review](J112C_INTEGRATION_REVIEW.md). The working tree contains uncommitted accepted J112A/B/C1 work and the lead's C integration above checkpoint `364fb385`; the checkpoint alone is insufficient. Obtain the actual working-tree patch when working elsewhere. Preserve unrelated changes. No reset, stash, commit or push.

One PDF layer set has **one name across all its pages**. Its identity is owning wiki page + canonical file + name. A PDF page number selects an internal part, not another named layer set. Slides use owning page + slide name. Equal names on different files or owning pages are ordinary and valid. File-title case is significant after native normalization; set names use the existing case/space/underscore comparison. Do not invent another product model or ask the architect to reconfirm this one.

## Deliverable and permitted files

Independently inspect the integrated changes, add meaningful missing acceptance cases, and exercise the approved behavior in Chromium. Report concrete defects to the lead with a reproducible case. Do not patch production code or weaken assertions to obtain a pass.

Permitted changes:

- New `tests/e2e/page-owned-scoped-identity.spec.js` and a focused draft recovery browser spec if needed. Reuse the established authenticated test-owner setup and exact-base cleanup pattern.
- New focused cases in `tests/phpunit/core/ScopedPublicationTest.php`, `ScopedCreationCopyTest.php`, and the existing affected unit/Jest tests, only to close a demonstrated coverage gap.
- Append the junior report to this packet. Shared status, charter, behavior brief and handoff remain lead-owned.

No source, schema, migration, message, configuration, service, viewer or UI implementation. No uploads to the ordinary test wiki unless separately authorized for a named fixture; reuse existing readable local image/PDF fixtures. Native PHPUnit uploads belong to its isolated test environment and are permitted. No external messages, commits or pushes; wiki writes are limited to the provisioned acceptance owners specified below.

## Native and client acceptance matrix

The implementation already has orchestration tests and real-upload tests. Read their assertions before adding duplicates. Check the following through real publication and exact authorized reads, never by inserting a slot to bypass admission:

1. **Independent equal names.** Publish `ABC` on file A, file B and a slide, plus another owning page's `ABC`. Each opens its own layers. Saving A changes neither B nor the slide. Canonical file case remains distinct. Repeated A embeds identify one set.
2. **A PDF set across pages.** Publish page 1 and page 2 of one PDF under `ABC`, with different recognizable layers. Resolve each page exactly. Open an unannotated page empty under `ABC`, save it, and reopen that page; never substitute another stored page or allocate another set name. Preserve the existing pinned source when extending a consistently pinned set. Mixed old pins must refuse new-page preparation without altering existing pages or choosing an arbitrary version.
3. **Atomic rename.** Rename from either PDF page. All retained pages get the same new display name and retain IDs, layers, canvases, source versions and internal page numbers. All matching direct embeds for that file change in the same native revision; unrelated files, slides, owners, options and source bytes stay unchanged. Historical revision reads retain the original names and content. Test case-only names and A/B swaps through publication.
4. **Refusals.** Reject a merge into another existing same-file set even if its annotated PDF pages do not overlap. Reject inconsistent explicit destinations inside one group, duplicate internal pages, unavailable sibling sources, a required rewrite the scanner cannot perform, edit-filter refusal, denied writes and stale bases. Neither slot nor current revision may change. A near-limit snapshot whose rename expansion exceeds the document limit must return the normal invalid-snapshot refusal before source work.
5. **Copy and adoption.** Picking either PDF page in the current copy entry points copies every stored page of that one set from the exact authorized source revision. One destination name applies to all copied pages; IDs are distinct and new. Another file's identical name does not force a suffix. An occupied same-file set causes one scoped suffix for list copy; direct embed copy refuses an occupied destination. Source changes after preview cannot substitute a newer revision. Pre-migration adoption prepares one final name before rewriting text; final publication verifies it instead of silently reallocating it. Another PDF page joins the same set name. Preserve existing legacy selector refusals.
6. **Editor reconciliation.** Rename all PDF pages in the submitted client snapshot. Save again after success and verify no sibling name reverts. Preserve local selected-page edits and newer sibling content through deliberate reconciliation. Refuse conflicting sibling renames, deleted members and changed source identities without discarding the draft. After a lost response, if the server saved the rename and created a separate set reusing its old name, leave that new set unchanged. An unsaved new PDF page must not become a separate old-name set after its original set was renamed remotely.
7. **Draft isolation and compatibility.** Different files, slides and PDF pages with the same label have distinct new draft identities; repeated embeds of one target share the identity. Existing persisted IDs are unchanged. A uniquely provable old ID appears in the existing explicit recovery chooser; restored work writes to the new current scope and independent writer record. Same-writer old/new records remain separately selectable. Ambiguous old IDs, changed bases, and file versions not proved to predate the base are not applied automatically. Original records remain byte-identical after cancellation, failed storage or refused recovery. Never scan another user's/wiki's draft scope. Do not claim recovery of ambiguous records: the old payload has no file/page/source identity.

## Browser procedure and evidence

Use the original provisioned test wiki and its existing acceptance configuration. Existing named-embed, create, rename and copy-list specs show login and UI interactions. **Do not copy their cleanup blindly:** the copy-list spec's old `finally` rereads the latest revision and can overwrite an intervening writer. C2 must implement the stricter cleanup contract below. Do not run that older write spec as part of C2. Do not print credentials. Verify the configured host is the approved local wiki, not a replacement installation. Run browser writes serially, with no native PHPUnit writes running at the same time.

Use `Layers_browser_acceptance` as destination and the lead-provisioned `Layers_browser_scoped_source` as source. `Layers_browser_acceptance_isolation` remains a main-only witness and must not receive a Layers slot. Before changing either authorized owner, capture its PageID, exact current revision, every slot's serialized bytes/model/format and complete authorized Layers snapshot; enforce the quiet-owner rule. A successful response without a valid snapshot is not a baseline. Require both `main` and `layers` roles and agreement between the serialized Layers content and `layersread`. If a prerequisite is missing, stop before writes. Record fixture titles and source timestamps without exposing credentials.

Exercise the current protected editor/copy entry points. J111's restored hover controls and full-size PDF viewer are not implemented by this packet; do not create substitutes or require them as a prerequisite to identity testing. Author-facing bare-name output and Default semantics remain J113; verify existing compatibility instead of changing syntax here.

Browser minimum: open the distinct equal-name editors, edit/save/reopen both PDF pages, rename one set and inspect the resulting page text and history, copy its complete set, recover two independently stored drafts, and show a denied/stale save retaining work. Inspect actual rendered labels/content, not only API success or a DOM node's existence. Record screenshots of the relevant editor states for the owner's screen review; screenshots and the junior report do not themselves constitute owner sign-off.

Track `lastOwnedRevision` independently for both owners, updating it only from a successful publication response or a verified UI-save response belonging to this run. In `finally`, attempt cleanup independently for each owner changed by the run, so one refused cleanup does not prevent checking the other. First require the current PageID/revision to match that tracked owner/revision; then publish the captured snapshot/main with that same `pageid` and `baserevid`. Never replace the expected base with a newly read latest revision. Require a successful response and verify all captured slot roles/models/formats/bytes, the full snapshot and parentage through fresh reads. Revisions/history naturally retain the test and cleanup revisions.

If another writer intervened or a save outcome is unknown, do not infer ownership from the username or take the newest revision as the cleanup base. Stop writes to that owner and report its baseline, last acknowledged revision and observed current revision. Surface cleanup failures as failures, even when the scenario already failed; never swallow them. An empty source snapshot is restored only because it was positively captured from an actual Layers slot. Do not remove slots, reset to an assumed empty snapshot, force-save, or delete pages/uploads/history. State whether recovery records were created only in this run's isolated browser context; never clear the user's browser storage.

## Verification and report

Run changed-file lint/style, the focused native identity/publication/creation/copy/adoption group, focused editor/draft Jest suites, and the new browser spec serially with one worker. Run `node scripts/verify-docs.js` and `git diff --check`. The lead's full-suite evidence lives in the integration review; rerun full suites only if the acceptance work reveals a broader concern or changes shared test infrastructure.

Use a negative control for at least one new acceptance assertion: e.g. a local test-only mutation that omits sibling renaming or copies only the selected page must fail the asserted behavior. Restore it immediately and rerun the affected check. Never commit a mutation or apply one during ordinary wiki/browser writes. Report the exact expected/actual difference.

Return:

- Changed test files and the concrete gap each closes; commands, runtimes, test/assertion counts, skips and failed-then-passing evidence.
- Actual identity, source pin, selected PDF page, stored names and main text for the create/rename/copy steps; revision parentage and unchanged historical reads.
- Screenshots and a concise owner-review sequence; browser errors, denied-write results and exact cleanup verification.
- Draft cases proved, which ambiguous records remain untouched, and any missing fixture or unresolved defect.
- Confirmation that production/configuration/migration data, protected controls and unrelated work were unchanged; no commit or push.

Return to the lead for review. This packet cannot mark HIST-4/HIST-7, J111, J113 or Layers 2.0 complete.

## Junior return - October 2, 2026

**Blocked at browser fixture preflight; automated evidence returned for review.**
Advances HIST-4/HIST-7 and TYPES-4 through exact-revision whole-PDF copy evidence.
This is not integrated browser acceptance or owner screen sign-off. The lead's
full-suite evidence above is preserved, not claimed as a fresh junior rerun.

### Changed tests and independent checks

**Native case:** `tests/phpunit/core/ScopedCreationCopyTest.php` adds only
`testWholePdfCopyRetainsPreviewedRevisionAfterSourceSetChanges`.
Existing tests did not change the source between a whole-set preview and copy.
The new test publishes two PDF pages named ABC through the guarded API,
previews page 2, then publishes a source rename and newer content on both
pages. Copy uses the earlier exact source revision. An authorized `layersread`
of the destination proves both pages retain ABC, original layers, canvases and
exact pins, with distinct new IDs. Another file's ABC is unchanged and causes
no suffix. Parent revisions and the destination's entire unchanged main text
are checked; the historical source retains original content, while the newer
source has the expanded name on both pages. Uploads are isolated native test
fixtures with randomized names, not ordinary-wiki uploads.

**Browser preflight:** `tests/e2e/page-owned-scoped-identity.spec.js` uses
the established original configuration, login and authenticated API context.
It requires the original local port/root, captures both provisioned owners'
current IDs, complete main bytes, slot roles and readable snapshots/errors,
and discovers existing local multi-page PDF metadata. Missing prerequisites
fail; they are never reported as a skip or acceptance pass. Diagnostic JSON
and Playwright's last-run manifest are generated artifacts, with no credentials.

**Report:** appended here only. No shared status or implementation files
were edited for C2.

Read the reviewed C1 corrections and integration review before inspecting the
scoped publisher, exact-revision list-copy preparation and client reconciliation
assertions. The inspected copy path reads the supplied source revision under
authority before collecting its group and allocating a scoped name. Publisher
source checks and final admission use expanded canonical content. Existing
native assertions cover both-slot refusal and original-group swaps. Client
assertions cover whole-set renames, newer sibling content, conflicting identity
changes, a new set reusing the old name, and preservation of unsaved-page drafts.
No production defect was reproduced in these inspected paths. This is bounded
inspection and automated evidence, not a claim of full independent acceptance.

### Negative control

The new native test first passed **1 test / 21 assertions**. A temporary,
test-only filter then removed page 1 from the observed copied result, simulating
selected-page-only output. The completeness assertion failed exactly:
**actual size 1, expected size 2** (**1 test / 5 assertions / 1 failure**).
The filter was immediately removed; the same case passed **1 / 21** again.
This controls the assertion's sensitivity, not a production mutation. No
production code changed, no mutation remains, and no browser writes ran during
the control.

### Browser blocker and exact baseline

The original provisioned configuration exists and points to
`http://localhost:8080`; no replacement installation was used.

| Dedicated owner | Page ID | Exact current revision | Slot roles |
| --- | --- | --- | --- |
| `Layers_browser_acceptance` | 228 | 2741 | `layers`, `main` |
| `Layers_browser_acceptance_isolation` | 230 | 2740 | `main` only |

Owner 228 has main bytes
`Dedicated automated Layers history acceptance page.` and the complete readable
snapshot containing `presentation`, slide `Welcome Slide`, canvas 800 by 600,
with its existing title layer and reading order. Its revision timestamp is
`2026-10-01T12:13:04Z`.

Owner 230 has main bytes `Dedicated automated Layers isolation page.` and
timestamp `2026-10-01T12:13:01Z`. Its exact current revision has no `layers` slot;
`layersread` returns `layers-revision-unavailable`. Existing journey setup uses
this owner for ordinary text isolation, not an established Layers source
baseline. No unreadable response was treated as an assumed empty snapshot.

The following existing local PDFs were discovered; no upload is needed:

`File:Layers migration fixture B.pdf`: 3 pages, timestamp
`2026-09-29T18:06:20Z`, SHA1 `70439186e1b36cada4d61623390f5fa99fba4e74`.

`File:Somepdf.pdf`: 11 pages, timestamp `2026-07-22T18:40:58Z`,
SHA1 `7cd2ef4f72e402ffa647a4e6f0dc82731834f708`.

The final Chromium preflight failed **1 test / 0 skips** on owner 230's exact
baseline error, before any content write. `provisioned-fixtures.json` is retained
in `test-results/`, under this generated test directory:

```text
page-owned-scoped-identity-a26be-ner-and-local-PDF-preflight-chromium/
```

The JSON includes complete baseline data and the PDF metadata, and is also
attached to the failed test. Initial and subsequent read-only probes returned
the same owner revisions. This is a fixture refusal, not a proven implementation
defect. The preflight deliberately refuses to seed an initially absent slot
without a defined exact-baseline restoration plan.

**Lead action needed:** provision a second dedicated source owner with a
readable, restorable Layers baseline, or approve an explicit setup/cleanup plan
for owner 230's absent slot. Do not use an ordinary page or an assumed empty
snapshot to bypass this boundary. The existing PDFs satisfy the file requirement.

### Commands and results

Local PHP **8.4.11**, Node **24.20.0**, Playwright **1.58.2**; native PHP
**8.3.31**, PHPUnit **9.6.36**, existing MediaWiki **1.45.3** container.
The focused native group ran serially with no browser writes alongside it.

Native command (the filter below is the same executed regular expression):

```bash
FILTER='ScopedPublicationTest|ScopedCreationCopyTest|'
FILTER+='PagePublicationServiceTest|PdfPageRoutingTest|CopyFromListTest|'
FILTER+='PageOwnedAdoptionFlowTest|PageOwnedAdoptionServiceTest|'
FILTER+='BareNamesAfterMigrationTest|DirectEmbeddingRewriterTest'
MSYS_NO_PATHCONV=1 docker exec -e MW_INSTALL_PATH=/var/www/html \
-w /var/www/html/extensions/Layers mediawiki-145 \
php vendor/bin/phpunit -c tests/phpunit/core.xml --filter "$FILTER"
```

Result: **97 tests / 771 assertions**, no skips, failures or errors. Focused
new-case runs used the same Docker command with
`--filter testWholePdfCopyRetainsPreviewedRevisionAfterSourceSetChanges`.

```bash
node.exe node_modules/jest/bin/jest.js --runInBand \
PageOwnedEditorSession PageOwnedDraftController
php.exe vendor/bin/phpcs -sp tests/phpunit/core/ScopedCreationCopyTest.php
node.exe node_modules/eslint/bin/eslint.js --no-ignore \
tests/e2e/page-owned-scoped-identity.spec.js
node.exe node_modules/@playwright/test/cli.js test \
tests/e2e/page-owned-scoped-identity.spec.js --project=chromium --workers=1
node.exe scripts/verify-docs.js
git diff --check
```

Jest: **142 tests / 2 suites**, all pass, no skips. Changed-file PHPCS and ESLint
pass. Editor diagnostics report no errors in the changed tests. Documentation
and diff checks pass, including after appending this report. Full suites were
not rerun: no shared test infrastructure changed and no broader production
concern was demonstrated. Browser preflight is intentionally **failed**, not
accepted, for the fixture boundary above.

### Unproved scenarios and cleanup

Live equal-name editors, both PDF-page edit/save/reopen flows, empty third-page
creation, rename text/history, whole-set copy through the protected UI, denied
or stale browser saves, independent draft recovery and relevant screenshots
remain **not run**. There is no owner-review screenshot sequence yet. The
browser spec currently contains only the prerequisite check, not the full
pending acceptance journey.

Existing focused client tests prove scoped rename reconciliation, rejected
changes retaining drafts, explicit authorized legacy aliases, separate
same-writer records and preservation on failed storage. Native tests prove
unique-target alias guards and source timestamp constraints. Those are not
browser chooser/recovery evidence. Ambiguous records remain intentionally
unrecovered; no user's storage was inspected or cleared, and no browser draft
records were created by this run.

No ordinary wiki content writes occurred, so CAS cleanup was not needed. Both
dedicated owners remained at revisions 2741 and 2740; their captured main bytes,
slot roles and available full snapshot are retained as read-only evidence.
No uploads/history were deleted. Native test writes used isolated core tables.
Production, configuration, migrations, protected controls and unrelated work
were unchanged. No commit or push. Return remains blocked for lead review;
HIST-4/HIST-7, J111, J113 and Layers 2.0 are not marked complete.

## Junior resume return - October 3, 2026

**Browser minimum completed; returned for lead review, not owner sign-off.**
Advances HIST-4/HIST-7, TYPES-4 and DATA-3. The earlier blocked report and
lead checkpoint above remain historical evidence. No production defect was
demonstrated in this bounded run; this does not accept the entire feature.

### Changed acceptance test and safety decision

Only `tests/e2e/page-owned-scoped-identity.spec.js` and this appended report
were edited during resumption. The spec now follows the existing positional
page edit links, exercises real properties/tool/rename/catalog/recovery
controls, checks recognizable editor canvas pixels and captures screenshots.
It preserves the strengthened read-only preflight and adds independently
acknowledged revisions, strict cleanup and inspectable JSON evidence.

After the first verified cleanup, the junior asked about the ten-minute
quiet window between serial iterations. The owner answered, "You decide
what makes sense." The chosen narrow exception is an explicitly supplied
own-cleanup receipt: current PageID, revision, actor, every slot and complete
snapshot must match the byte-verified receipt. A changed revision is still
refused; no latest-revision fallback exists. Without that receipt, the
existing quiet rule applies. No broader authorization exception was added.

An opt-in cleanup-only test can restore an aborted run from its saved
acknowledgements. It requires exact current revision equality and compares
all slots/snapshots afterward; it does not infer ownership from a username.
Normal scenarios reserve additional timeout time for their `finally` block.

### Browser proof and measured revision ledger

Original wiki: `http://localhost:8080`, Chromium, one worker. No native test
writes ran concurrently. Fresh final baselines were destination **228/2789**
and source **272/2790**; page **230** was read-only throughout.

Existing local PDF: `File:Layers_migration_fixture_B.pdf`, three pages,
timestamp **20260929180620**, SHA1 **d43bvflrbfz7b7o4uzam9u0148hl20k**
(API hexadecimal `70439186e1b36cada4d61623390f5fa99fba4e74`). Existing image:
`File:B010.jpg`, timestamp **20260621023142**, API SHA1
`6f445a43f4a74a24b576dc09c7fd87b2c7e88ab4`. No uploads were made.

Destination IDs `c2_pdf_one`/`c2_pdf_two`, image `c2_photo` and slide
`c2_slide` all started as ABC. Source IDs `c2_source_one`/`c2_source_two`
also started as ABC. Recognizable labels/content and distinct red, green,
blue, gold and source-magenta rectangles were inspected in the editors;
canvas pixel checks require more than 100 matching opaque layer pixels.
Both PDF pages were edited through Font Size, saved and reopened at 36px.
Image, slide and original Welcome Slide remained exactly unchanged.

| Revision | Parent | Measured operation |
| --- | --- | --- |
| 2791 | 2790 | Source ABC, PDF pages 1 and 2 |
| 2792 | 2789 | Destination independent equal-name scopes |
| 2793 | 2792 | Save/reopen destination PDF page 1 |
| 2794 | 2793 | Save/reopen destination PDF page 2 |
| 2795 | 2794 | Open page 3 empty, create rectangle, save/reopen in ABC |
| 2796 | 2795 | Rename from page 2: all three pages become Renamed PDF |
| 2797 | 2796 | Save again at 38px; sibling names do not revert |
| 2798 | 2791 | Change source name/content after preview of 2791 |
| 2799 | 2797 | Catalog page-2 choice copies both original pages as ABC |
| 2800 | 2798 | Restore source ABC for occupied-scope copy |
| 2801 | 2799 | Catalog page-1 choice copies both pages as ABC 2 |
| 2802 | 2801 | Fresh base for two independent browser drafts |
| 2803 | 2802 | Deliberate concurrent main-slot change |
| 2804 | 2803 | Exact destination baseline restoration |
| 2805 | 2800 | Exact source baseline restoration |

The created page 3 retains the existing file timestamp/SHA1/name and internal
page number 3. Rename preserves every retained ID, canvas, layer and source
pin. The seed main text includes PDF pages 1/2/3, a repeated page-1 embed,
the image, slide and an explicit other-owner reference. All matching PDF
selectors become `layerset=228:Renamed PDF`; captions, widths, page options,
`layerset=ABC` on B010.jpg, `{{#Slide:ABC|width=300}}` and
`layerset=272:ABC` remain byte-identical. The exact full seed/renamed main
text and snapshots are retained in the JSON ledger. Historical read 2792
retains the original ABC names/content; source history 2791 is unchanged.

Catalog confirmation is a real HTML POST, not an API substitute. The test
verifies its page/base/source/page-selection fields, 302 response, unique
note, native parent, tag, unchanged main text, complete added snapshot and
new distinct IDs before acknowledging the revision. Copy 2799 uses **2791**,
not changed source 2798. The image/slide ABC names do not force a suffix.
Copy 2801 assigns **one ABC 2** name across both added PDF pages. Copied page
2 is opened in the existing editor with its original recognizable content.

Two drafts at base **2802** use separate persisted IDs `c2_pdf_one` and
`c2_pdf_two`, separate writer records and 44px/46px edits. Both are explicitly
restored through the existing dialog; each original stored envelope remains
byte-identical, and recovery alone writes no wiki revision. Records were
created only in this run's isolated browser context; no user's storage was
cleared. A browser save still based on 2802 receives **layers-edit-conflict**
after 2803. Current revision/snapshot stay unchanged, and the editor retains
the unsaved 46px work.

### Results, failures and inspection sequence

Final browser command:

```bash
RECEIPT_DIR=tmp/j112c2-browser-copy-fixed
RECEIPT_TEST=page-owned-scoped-identity-182e1-e-copy-and-draft-acceptance-chromium
RECEIPT="$RECEIPT_DIR/$RECEIPT_TEST/journey-evidence.json"
LAYERS_ACCEPTANCE_CLEANUP_RECEIPT="$RECEIPT" \
node.exe node_modules/@playwright/test/cli.js test \
tests/e2e/page-owned-scoped-identity.spec.js --project=chromium --workers=1 \
--output=tmp/j112c2-browser-resume
```

**2 tests passed / 0 skips**, 3.1 minutes overall (preflight 6.0 seconds;
journey 3.0 minutes). Playwright does not report an assertion count.
Browser page errors: **0**; cleanup errors: **0**. Final changed-file ESLint
and browser-test editor diagnostics pass. Existing MD013 long-line warnings
in the unchanged lead-authored sections remain; this return adds none.

Focused native identity/publication/creation/copy/adoption command is the
same filter printed in the historical report: **98 tests / 790 assertions**,
78.083 seconds, no skips/failures/errors. Focused client command is unchanged:
**142 tests / 2 suites**, 1.467 seconds, no skips. These are fresh session
runs, not the lead's full-suite totals. No PHP file was edited on resumption.
Documentation and whitespace gates were rerun after this appended report.
Full suites were not rerun; no shared infrastructure or production changed.

Staged failures were test defects, not weakened product assertions:
hexadecimal rather than base-36 SHA1 (14.9s run), noncanonical File pin
(15.1s), wrong `surface=` page-control locator (1.4m), and ambiguous rename
CSS class shared by Copy (1.8m). Corresponding corrected scope/PDF stages
passed in 1.3m and 2.0m. The first copy run verified copy 2775 but used
`pageid=` rather than `owner=` for direct surface editing and timed out at
10.1m. Its cancelled request context prevented normal cleanup. The saved
acknowledgement ledger was used by the opt-in cleanup-only test to restore
exact current revisions **2775** and **2774**, independently: **1 pass**,
12.1s overall. Nothing unacknowledged was adopted. Corrected copy stage then
passed **2 tests**, 2.7m; the complete journey above subsequently passed.
The reviewed native completeness negative control remains the required
assertion-sensitivity evidence; no production mutation was made.

Final artifact directory:
`tmp/j112c2-browser-resume/page-owned-scoped-identity-182e1-e-copy-and-draft-acceptance-chromium/`.
It contains the complete `journey-evidence.json` and 18 named screenshots.
Suggested owner-review sequence:

1. `c2_pdf_one.png`, `c2_pdf_two.png`, `c2_photo.png`, `c2_slide.png`,
`c2_source_two.png`: equal names, independent actual contents.
2. `c2_pdf_one_saved.png`, `c2_pdf_two_saved.png`,
`pdf_page_three_created.png`, `pdf_whole_set_renamed.png`: saved pages,
empty-page extension and rename.
3. `copy_preview_c2_source_two.png`, `copied_ABC.png`,
`copy_preview_c2_source_one.png`, `copied_ABC_2.png`: confirmation and copies.
4. Both `c2_pdf_*_recovery_offer.png` and `c2_pdf_*_recovered.png`, then
`stale_save_retains_recovered_work.png`: explicit recovery and retained edit.

Renamed-page and stale-work screenshots were manually inspected, as was the
copy confirmation. Existing compatibility wording remains visible; J113
owns that change, and this packet does not change or accept its wording.

### Cleanup and remaining boundaries

Final cleanup first required PageID/current revision equality with the last
acknowledgement, then published each captured baseline with that exact base.
**228: 2803 -> 2804** restores all slots and the full snapshot from **2789**.
**272: 2800 -> 2805** restores all slots and the empty snapshot from **2790**.
Slot roles, models, formats and serialized bytes, authorized snapshots and
native parentage all match. **230** remains revision **2740**, main only,
byte-identical. Test/cleanup revisions intentionally remain in native history.

Case-only names, swaps, merges, unavailable/mixed pins, limits, edit-filter
refusals, adoption, lost-response reconciliation and ambiguous/legacy draft
guards rely on native/client evidence; they were not new live browser
scenarios. No ambiguous legacy draft was fabricated or recovered. Permission
denial was not a separate browser fixture; stale-write refusal was exercised.
No assertions about J111's pending viewer/overlay work are made.

Production, configuration, schema, migrations, protected controls and
unrelated work were preserved. No pages, uploads, slots or history were
deleted; no commit, branch change or push. Lead review and owner screen
sign-off remain pending. This report does not mark HIST-4/HIST-7, J111, J113
or Layers 2.0 complete.
