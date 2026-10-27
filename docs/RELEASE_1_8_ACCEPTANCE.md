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

| Check | Current evidence/state | Work before the 1.8 release |
| --- | --- | --- |
| Page ownership, native Save/history/diff/restore and owner isolation | **Recorded passes:** [1.44 native journeys](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md), [whole-PDF Import](PDF_IMPORT_NATIVE_ACCEPTANCE.md) and retained image/slide journeys. The [candidate evidence map](PAGE_HISTORY_RELEASE_EVIDENCE.md) ties retained results to current source: four existing ordinary edits on 1.45 match recent changes/contributions; eight migration revisions on 1.44 match those feeds, with six watchlist matches. | Complete remaining intended-wiki HIST scenarios and applicable notification acceptance. The watchlist check covers migration revisions; Echo is absent on that wiki and no notification delivery is claimed. Close only missing or affected checks. |
| Import, first-Save attribution, recovery and refusal preservation | **Recorded passes:** whole-PDF Import/Undo/Redo, saved handoff, complete recovery, stale Save, reconciliation and lost-success-reply handling. | Reuse the recorded desktop and narrow-layout results; reconcile only missing supported-version/device combinations. |
| Upgrade and recovery | **Recorded passes:** [1.5.95/MySQL rehearsal and current-candidate migration check](UPGRADING.md#current-candidate-migration-check--october-25-2026), fresh 1.44 installation, and [intended-wiki data/application read restoration](INTENDED_WIKI_RECOVERY_CHECKPOINT.md#application-level-restore--october-26-2026) on 1.45.3. Restored native/HTTP image, slide and PDF reads pass with all 66 persistent-table witnesses and 7,832 retained uploads unchanged. Temporary services were removed. Migration sources match the retained fresh rehearsal; the current rerun adds zero revisions. | Reconcile the retained upgrade/recovery with the final release artifact and review earlier pilot data without relabeling or repair. Operators still preserve their own matching private configuration/software before cutover; reconstructed test settings do not constitute that backup. A new fresh database transition or exhaustive restored-site/browser check was not claimed. |
| Viewer, Download and Print | **Recorded passes:** inspected exports, exact historical-source viewing, and [complete 1.44 PDF Download/native Print preparation](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md#complete-pdf-download-and-native-print-preparation--october-25-2026). Both pages retain saved layers; Print and Download composites match byte for byte. | Obtain the applicable manual Print/export owner acceptance. The headless check does not qualify the operating-system dialog, physical pagination or paper output. Retain earlier observer failures without repeating that stalled loop. |
| Supported UI, touch and accessibility | **Partial:** [phone-viewer panning](PHONE_VIEWER_ACCEPTANCE.md#approved-correction-and-bounded-verification) and the owner-approved [bounded toolbar](VIEWER_TOOLBAR_LAYOUT_ACCEPTANCE.md) pass native type/theme, narrow/landscape/enlarged-text, scrolling, focus, Fit, PDF shortcuts and browser-magnification checks. The enlarged-text toolbar clipping is corrected in the recorded browser scope. | Finish remaining tablet-touch editing, physical-device and manual accessibility acceptance. Browser emulation is not physical-device sign-off. Phone editing is not required. |
| Security, privacy and data integrity | **Recorded engineering review:** [HTTP roles/visibility/lifecycle and native Save admission](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md); the [candidate review](PAGE_HISTORY_SECURITY_REVIEW.md) now covers request/access/admission, validation/output, bounds, I/O, configuration/logging and dependencies. Import quotas, renderer text interpretation and SVG resource lookup are corrected; locked npm and PHP audits are clear at this checkpoint. | Reconcile final source/artifact consistency and recheck dated dependency results at the release cut. Reopen affected checks after changes and fix/retest release-blocking findings. No open high/critical finding or known data-loss defect may ship; this is not independent penetration-test or owner acceptance. |
| Performance | **Failed current lane / partial earlier evidence:** [maintained 1.44 reader measurements](PAGE_HISTORY_PERFORMANCE.md#maintained-144-lane--october-26-2026) take 2,803–3,447 ms against 300 ms. Identity/pixels and read-only admission pass. Earlier cache-preserving 269–296 ms observations remain dated evidence. | Diagnose shared server and additional Layers response delay; rerun the unchanged gate after a demonstrated correction. Close cold-server, reference-device and remaining applicable media/deferral measurements. Keep numeric budgets and explicit scope; record any required owner disposition of unproved limits. |
| Package and documentation | **Partial:** primary guides, upgrade instructions and public/private separation are refreshed; [draft 1.8 release notes](RELEASE_NOTES_1_8.md) now consolidate behavior, upgrade requirements and disclosed limits. | The [native regression package](NATIVE_REGRESSION_TESTING.md) and [asset/notice inventory](SHIPPED_ASSET_AUDIT.md) are recorded. Keep both guards green on the final artifact. Finalize the draft after acceptance, version consistency, clean distributable and public documentation. Private captures, credentials and database exports stay local. |
| Owner acceptance | **Pending.** | Complete the Milestone 1 portions of charter scenarios S1–S7 on the intended wiki. Search, Cargo and new link portions belong to their later milestones. Record acceptance of the release scope and remaining disclosed limits. |
| Final release cut | **Pending.** | Freeze the reviewed artifact, run required gates and exact-commit CI, confirm version/tag with the owner and publish the independent release. Preserve a consistent upgrade/rollback reference. |

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
