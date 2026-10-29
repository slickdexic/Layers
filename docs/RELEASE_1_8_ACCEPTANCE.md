# Layers 1.8 release acceptance

**Owner scope decision: October 25, 2026.** Page ownership and native revision
history will ship independently, with **1.8** as the working version. The
[charter's independent release gate](PROJECT_CHARTER.md#32-independent-page-history-release)
is authoritative. Final version/tag assignment follows acceptance; the manifest
remains unchanged by this document.

This is the release closeout ledger, consolidating existing requirements and
retained evidence. It introduces no new feature or quality target. Runtime
baseline: reviewed code at `b04679d`, with passing exact-commit CI. The
[page-history evidence map](PAGE_HISTORY_RELEASE_EVIDENCE.md) records the exact
backend/editor reuse boundary from `62f7ba1`; later viewer changes have their own
acceptance. The current candidate also includes the
[post-migration rename/copy output correction](PILOT_DATA_REVIEW.md), qualified
separately from that dated byte-comparison baseline. Documentation commits may
follow without invalidating unchanged runtime evidence.

**Recorded pass** means the linked journey passed in its recorded environment,
not every possible version/device combination. **Partial** means some required
evidence is present. **Pending** means a release action or owner decision remains.
Missing evidence alone does not establish a production defect. Reuse accepted
results; run only missing or affected checks and keep original failures.

**Current candidate update:** Public commit `ab76060` passed exact-commit CI
after the approved revision-check bar. The subsequently approved quiet slide
loading change is published as `04665a3` with [passing exact-commit CI](https://github.com/slickdexic/Layers/actions/runs/40613892452). On the 1.45 test page, delayed loading,
successful rendering, a failed read and disabled JavaScript were checked in a
browser. The full client suite passed 19,028 tests in 319 suites; standalone
PHP passed 1,675 tests with one existing skip. A native 1.44 parser run using
the changed source passed 5 tests and 77 assertions in isolated test tables.
The installed 1.44 candidate has not yet been updated. Reconcile the final
artifact and affected checks; the earlier green CI run predates the slide change.

**Package correction:** The earlier candidate archive included tracked historical
test-evidence ZIPs with screenshots and logs. The earlier claim that the archive
contained no captures or logs was wrong. Their presence does not establish that
they contain private information; review their public-history exposure and exclude
them from the release package. The current public candidate tree removes those
files while their local copies and public Git history remain. Verify final source
archives as well as the custom package. See [release preparation](RELEASE_PREPARATION.md).

**New review findings:** A strict MySQL temporary-table test confirms that the
legacy foreign-file fallback exceeds its 32-character storage column. A local
schema correction passed a focused native MySQL test. On the maintained 1.44
wiki, a read-only schema check subsequently found `VARBINARY(32)`, which the
first correction failed to recognize. The corrected updater preserves the
existing `VARBINARY` or `VARCHAR` type while widening it; both cases pass on
native temporary tables, and the binary case failed before the fix. The actual
wiki updater and cross-version acceptance remain open. The editor
can alter some literal layer text before publication; native strict validation
also refuses other text that server sanitization would change. An approved local
literal-text correction has passed focused editor, publication and export tests;
its broader compatibility, output-context and screen acceptance remain open.
See [Gemini review triage](GEMINI_REVIEW_TRIAGE.md).

**Affected native checks, October 28:** On MediaWiki 1.44, the combined
publication, migration and identifier-upgrade slice ran 80 tests / 812
assertions with one historical-reader error. That error reproduced with the
installed baseline: the test assumed anonymous read access without enabling it.
The corrected fixture explicitly enables anonymous reading for that case and
passes its isolated replay (1 test / 12 assertions). The full combined slice
subsequently passed 80 tests / 819 assertions on 1.44 / MySQL using the
installed candidate, the corrected test fixture and the selected current
reader, validator and schema-manager files preloaded. A first follow-up ran
all 80 tests but had three errors because its temporary test directory lacked
adoption fixtures; after adding those public fixtures, the full rerun passed.
This is not a final installed-release artifact or full updater qualification.
Separately, the native
literal-text publication/history test passes (2 tests / 7 assertions); legacy
conversion and affected standalone PHP tests pass (193 tests / 447 assertions).
These results do not establish full updater, browser or owner acceptance.

**Owner-reported slide Save failure:** On the 1.45 test wiki the owner added
arrows to a slide; the Save button appeared unresponsive and the work remained
unsaved. After reopening, Ctrl+S and the on-screen Save button each saved an
arrow in a new revision. The initial failure is not yet explained and remains
open. In a separate
1.44 browser session, the same saved slide snapshot and an added arrow reached
an intercepted Save request. Nearly full browser storage also reproduced a
pre-request refusal with draft-storage notifications, but has not been shown
to be the cause in the owner's session. Do not declare release acceptance on
the strength of the later successful attempt alone.

**Large-image Save failure and candidate correction:** A later owner test
confirmed that an image's Undo backup exceeded browser storage quota. The
candidate losslessly compacts repeated data only when a normal draft write is
refused for quota, leaving existing records intact. A synthetic browser test
reproduced the refusal and exercised the in-session correction without wiki
writes; the owner then applied it to the open editor and confirmed Save. A
read-only check verified the resulting page revision contains the changed layer
set. Full client tests passed 19,050 tests; broader browser/recovery acceptance
and the earlier intermittent slide failure remain open.

**Large-draft recovery follow-up:** A fresh client-side store and controller,
with a new writer identity, discover and decode the previous session's compact
backup without changing any stored records. This verifies the cross-session
storage boundary in an integration test; actual browser restart and Restore
remain unqualified.

**Text selection correction:** The owner reported and approved correcting a
plain-text selection box that wrapped its measurement while rendering one
line. The affected layer's browser measurement now matches the rendered width;
the editor view, including rotation, was shown and the owner confirmed it
looked good. The full client suite passed 19,052 tests in 325 suites. This
does not qualify the remaining release gates.

**Reader efficiency correction:** Selected file sources are now resolved in one
snapshot pass, with per-surface authorization and failure isolation retained.
Affected 1.44 native reader and source-refusal tests passed 31 tests / 187
assertions; standalone PHP passed 1,697 tests / 4,217 assertions with one skip.
This is a bounded reduction in repeated work; representative timing and the
remaining reader performance checks are still open.

**Native CI candidate:** A new workflow provisions MediaWiki 1.44 and a
disposable SQLite wiki to run selected native history-access, publication and
batched-read tests. Its exact test selection passed locally on 1.44 / MySQL:
47 tests / 132 assertions, with the current reader files preloaded into the
installed test candidate. GitHub-hosted execution and SQLite compatibility are
not yet verified; exact-commit CI acceptance remains pending.

**Shipped dependency check:** A synthetic local advisory now verifies that the
real production `npm audit` command rejects a high-severity finding for the
shipped PDF library, while a clean response passes. All eight release-package
tests and the 225-reference shipped-asset check pass. A fresh production audit
found zero vulnerabilities after using the system certificate store; its first
attempt failed certificate verification. Recheck at the release cut.

**Concurrent PDF cache check:** Two independent PHP processes exercised the
actual cache publication helper against the same temporary target. Controlled
overlapping partial renders stayed private; a failed render did not replace a
completed result, and overlapping successes exposed only completed test bytes.
Both checks passed on Windows and in the existing 1.44 Linux test environment;
the ten release-package tests passed on Windows. This does not establish
real-converter concurrency stress, full PDF validity or browser export
acceptance.

**Creation tool presets:** The owner approved clearing the previous selection
when choosing a creation tool. A 1.44 test-editor session using the current
toolbar source selected an Arrow preset after a text selection; the text and
existing Undo history stayed unchanged, and a new arrow used the selected
non-default preset. The new arrow remained selected for editing. Owner screen
review and final-artifact/browser qualification remain open. Keyboard selection
of Rectangle also cleared a multi-selection in that test session. The full
client suite passed 19,067 tests across 325 suites; the editor bundle remains
within its existing size limit.

**Public candidate reconciliation:** The public branch and the remote both
pointed to `4122f6d8` at this check. A preliminary comparison of 41 selected
audit/editor source and test files against that branch found 21 changed, 18
new and two unchanged files. It compares actual working-file Git hashes, not
the private checkout's index: some files present and Git-blob-equivalent to the
public branch appear as deletions in an ordinary cross-branch working-tree
diff. This is a scoped inventory, not a complete publication list or privacy
review. Final dependency, documentation, artifact and exact-commit checks remain.

| Check | Current evidence/state | Work before the 1.8 release |
| --- | --- | --- |
| Page ownership, native Save/history/diff/restore and owner isolation | **Recorded passes:** [1.44 native journeys](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md), [whole-PDF Import](PDF_IMPORT_NATIVE_ACCEPTANCE.md) and retained image/slide journeys. The [candidate evidence map](PAGE_HISTORY_RELEASE_EVIDENCE.md) ties retained results to current source: four existing ordinary edits on 1.45 match recent changes/contributions; eight migration revisions on 1.44 match those feeds, with six watchlist matches. | Complete remaining intended-wiki HIST scenarios and applicable notification acceptance. The watchlist check covers migration revisions; Echo is absent on that wiki and no notification delivery is claimed. Close only missing or affected checks. |
| Import, first-Save attribution, recovery and refusal preservation | **Recorded passes:** whole-PDF Import/Undo/Redo, saved handoff, complete recovery, stale Save, reconciliation and lost-success-reply handling. | Reuse the recorded desktop and narrow-layout results; reconcile only missing supported-version/device combinations. |
| Upgrade and recovery | **Recorded passes:** [1.5.95/MySQL rehearsal and current-candidate migration check](UPGRADING.md#current-candidate-migration-check--october-25-2026), fresh 1.44 installation, and [intended-wiki data/application read restoration](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026) on 1.45.3. Restored native/HTTP image, slide and PDF reads pass with all 66 persistent-table witnesses and 7,832 retained uploads unchanged. Temporary services were removed. Migration sources match the retained fresh rehearsal; the current rerun adds zero revisions. | Reconcile the retained upgrade/recovery with the final release artifact and review earlier pilot data without relabeling or repair. Operators still preserve their own matching private configuration/software before cutover; reconstructed test settings do not constitute that backup. A new fresh database transition or exhaustive restored-site/browser check was not claimed. |
| Viewer, Download and Print | **Recorded passes:** inspected exports, exact historical-source viewing, and [complete 1.44 PDF Download/native Print preparation](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md#complete-pdf-download-and-native-print-preparation--october-25-2026). Both pages retain saved layers; Print and Download composites match byte for byte. | Obtain the applicable manual Print/export owner acceptance. The headless check does not qualify the operating-system dialog, physical pagination or paper output. Retain earlier observer failures without repeating that stalled loop. |
| Supported UI, touch and accessibility | **Partial:** [phone-viewer panning](PHONE_VIEWER_ACCEPTANCE.md#approved-correction-and-bounded-verification), the owner-approved [bounded toolbar](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md) and [revision-check bar](REVISION_CHECK_BAR.md) pass their recorded browser scopes. The bar retains its action and fits image/slide/PDF editors in tested light/dark desktop, tablet and narrow layouts. | Finish remaining tablet-touch editing, physical-device and manual accessibility acceptance. Browser emulation is not physical-device sign-off. Phone editing is not required. |
| Security, privacy and data integrity | **Recorded engineering review:** [HTTP roles/visibility/lifecycle and native Save admission](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md); the [candidate review](PAGE_HISTORY_SECURITY_REVIEW.md) now covers request/access/admission, validation/output, bounds, I/O, configuration/logging and dependencies. Import quotas, renderer text interpretation and SVG resource lookup are corrected; locked npm and PHP audits are clear at this checkpoint. | Reconcile final source/artifact consistency and recheck dated dependency results at the release cut. Reopen affected checks after changes and fix/retest release-blocking findings. No open high/critical finding or known data-loss defect may ship; this is not independent penetration-test or owner acceptance. |
| Performance | **Recorded installed-desktop passes / reader misses retained:** [asset and editor-entry checks](PAGE_HISTORY_PERFORMANCE.md#installed-asset-and-editor-entry-checks--october-27-2026) measure 102,129 gzip bytes of Layers modules, none on the plain page, and all fifteen warm image/slide/PDF editor openings at 800–930 ms, below three seconds. Eighteen clean Closings return to the owner without Saves. The [earlier authorized read](PAGE_HISTORY_PERFORMANCE.md#earlier-authorized-read--october-27-2026) still has two of five visits above 300 ms (300.4/301.8 ms); all slower baselines and withdrawn experiments remain retained. | Close the remaining measured reader misses and applicable cold-server/reference-device/media checks without changing controls or weakening read admission. These are representative desktop passes, not physical-device or blanket PDF acceptance. Source/assets are local; retained private data/configuration storage and reference hardware remain explicit limits. Keep environment costs distinct from product defects and obtain owner disposition of unproved limits. |
| Package and documentation | **Recorded candidate package pass / final cut pending:** the [clean public snapshot archive](RELEASE_PREPARATION.md#reviewed-candidate-archive--october-27-2026) at `ff57fa0` contains 2,859 exact public files and passes the 225-reference asset guard. Non-guide files match the installed tested candidate; 26 retained upgrade/recovery source files reconcile. Primary guides, upgrade instructions and [draft release notes](RELEASE_NOTES_1_8.md) are refreshed. | Regenerate and verify the exact versioned release artifact after acceptance and version/tag assignment. Keep the [native regression package](NATIVE_REGRESSION_TESTING.md) and [asset/notice inventory](SHIPPED_ASSET_AUDIT.md) intact. The candidate snapshot still reports manifest 1.5.95; it is not a released 1.8 build. Private captures, credentials, configuration and database exports stay local. |
| Owner acceptance | **Pending.** | Complete the Milestone 1 portions of charter scenarios S1–S7 on the intended wiki. Search, Cargo and new link portions belong to their later milestones. Record acceptance of the release scope and remaining disclosed limits. |
| Final release cut | **Pending.** | Freeze the reviewed artifact, run required gates and exact-commit CI, confirm version/tag with the owner and publish the independent release. Preserve a consistent upgrade/rollback reference. |

The October 27 [server/filesystem investigation](PAGE_HISTORY_PERFORMANCE.md#server-and-linked-filesystem-investigation--october-27-2026)
rules out a full web OPcache for the measured requests and demonstrates a large
general-debug-logging cost for API reads. Identical-file comparisons also measure
substantial linked-path I/O overhead. Script responses remain slow with general
logging off; neither the USB device alone nor an extension regression is thereby
established as the remaining cause. Original test settings were restored exactly.
These diagnostic results do not establish a 300 ms pass or qualify reference
hardware. The charter already excludes shared mounts from its reference install;
the development result alone must not be described as a proven reference-install
release blocker. Keep environment costs distinct from product defects.

## Scope control

The [read-only pilot review](PILOT_DATA_REVIEW.md) covers 28 current owners and
identifies three retained groups with split PDF names. Their disposition needs
a reference-aware repair proposal and owner review; no automatic rename,
merge or historical rewrite has been performed. This is separate from the
current writer correction and the qualified fresh upgrade path.

The pilot review's separate ten-member comparison now establishes equality to
earliest saved surfaces and strict retained-row conversion, with exact source
versions available. A reference-aware repair proposal and owner disposition
remain. The [candidate security review](PAGE_HISTORY_SECURITY_REVIEW.md) records
the demonstrated Import information-quota correction and compatible
development-tool security updates. The full locked npm audit now has zero
known vulnerabilities; the broader application review remains explicit rather
than being marked complete by the earlier HTTP checks or a dependency scan.

Harmless HTTP canaries also exposed the shared checkout's raw log/document
paths. A local [development HTTP guard](DEVELOPMENT_ENVIRONMENTS.md#private-working-material-and-http-access)
now denies those working paths while preserving required assets on both
supported-version ports. No real private artifact was requested or moved.
This is development-server protection, separate from the extension's API
authorization and the clean release package.

The [registered request and revision review](PAGE_HISTORY_SECURITY_REVIEW.md#registered-request-and-native-revision-review)
now accounts for all 23 action APIs and both exact-PDF REST paths. Native metadata
and 54 fresh HTTP refusals verify the nine write routes' method/token boundary
on both maintained versions. Current backend sources match the published
candidate; existing authority, visibility and final-admission evidence is reused
within its recorded scope. No new blocker was demonstrated in that partition.
The subsequent content/output and resource/external-I/O/configuration/logging
pass completes the relevant source-led application review. It corrects literal
text interpretation in server-generated thumbnails/PDFs and versions their
cache keys. The final 1,655-test standalone run passes with one existing skip; six text
argument paths pass native pixel checks. SVG file/relative references refuse
before conversion, while fragment controls and existing renderable library
shapes remain supported. The twelve pre-existing native XML failures are recorded. No unresolved high/critical finding or
demonstrated data-loss defect was identified in the reviewed scope. Final
artifact/dependency reconciliation and owner release acceptance remain.

The [upgrade-path acceptance matrix](UPGRADE_PATH_ACCEPTANCE.md) identifies
1.5.95 as the fully tested starting release. Older released schemas pass native
update/rerun checks, but their full application migrations are not thereby
qualified. `mw-config` or CLI `update` handles schema only; link/job refresh and
the separately reviewed Layers migration remain required.

Milestones 2–5 remain ordered: built-in text search, Cargo readiness, Cargo
integration, then on-page layer-object links. Broader 2.0 improvements outside
Milestone 1 remain later roadmap work. They do not block this independent release;
preservation and security of existing shipped functionality still apply.

Bulk private-evidence archival and unused-code cleanup are separate reviewable
tasks. Keeping the release package free of private/generated material is a release
gate; deleting all local working evidence is not. Preserve recoverable evidence
before any later cleanup.

Only the project owner declares Milestone 1 accepted. This ledger does not claim
that 1.8 is released or that the broader Layers 2.0 finish line has been met.
