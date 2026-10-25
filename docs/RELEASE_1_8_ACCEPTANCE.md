# Layers 1.8 release acceptance

**Owner scope decision: October 25, 2026.** Page ownership and native revision
history will ship independently, with **1.8** as the working version. The
[charter's independent release gate](PROJECT_CHARTER.md#32-independent-page-history-release)
is authoritative. Final version/tag assignment follows acceptance; the manifest
remains unchanged by this document.

This is the release closeout ledger, consolidating existing requirements and
retained evidence. It introduces no new feature or quality target. Runtime
baseline: reviewed code at `62f7ba1`, with passing exact-commit CI. Documentation
commits may follow without invalidating unchanged runtime evidence.

**Recorded pass** means the linked journey passed in its recorded environment,
not every possible version/device combination. **Partial** means some required
evidence is present. **Pending** means a release action or owner decision remains.
Missing evidence alone does not establish a production defect. Reuse accepted
results; run only missing or affected checks and keep original failures.

| Check | Current evidence/state | Work before the 1.8 release |
| --- | --- | --- |
| Page ownership, native Save/history/diff/restore and owner isolation | **Recorded passes:** [1.44 native journeys](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md), [whole-PDF Import](PDF_IMPORT_NATIVE_ACCEPTANCE.md) and retained image/slide journeys. | Map the retained results to the chosen candidate and applicable HIST scenarios, including watchlist/recent-changes evidence. Close only unmapped or affected checks. |
| Import, first-Save attribution, recovery and refusal preservation | **Recorded passes:** whole-PDF Import/Undo/Redo, saved handoff, complete recovery, stale Save, reconciliation and lost-success-reply handling. | Reuse the recorded desktop and narrow-layout results; reconcile only missing supported-version/device combinations. |
| Upgrade and recovery | **Partial:** [1.5.95/MySQL rehearsal and safe reruns](UPGRADING.md), plus fresh 1.44 installation. | Rehearse upgrade and matching backup restoration on a copy of the intended wiki. Audit earlier pilot/migrated data separately; do not silently relabel or repair it. |
| Viewer, Download and Print | **Partial:** inspected exports and exact historical-source viewing pass in recorded scopes. | Complete the unproved 1.44 PDF delivery/Print checks through a working observation path and obtain the applicable manual Print/export acceptance. Do not repeat the stalled observer loop. |
| Supported UI, touch and accessibility | **Partial:** approved overlays, narrow layout and recorded keyboard journeys are retained. | Finish missing tablet-touch editing, phone viewing/mobile-skin, keyboard/focus and manual accessibility checks for the supported scope. Phone editing is not required by the charter. |
| Security, privacy and data integrity | **Partial:** [HTTP roles/visibility/lifecycle and native Save admission](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md), including 117 current native cases. | Complete the current candidate's relevant API/data review and shipped dependency/asset audit; fix and retest release-blocking findings. No open high/critical finding or known data-loss defect may ship. |
| Performance | **Partial:** [recorded server/browser budgets](PAGE_HISTORY_PERFORMANCE.md), including cache-preserving 269–296 ms fresh-browser paint on a warm server. | Close cold-server, reference-device and remaining applicable media/deferral measurements. Keep numeric budgets and explicit scope; record any required owner disposition of unproved limits. |
| Package and documentation | **Partial:** primary guides, upgrade instructions and public/private separation are refreshed. | Verify the [portable native regression package](NATIVE_REGRESSION_TESTING.md) and remaining required assets/licenses. Finalize release notes, version consistency, clean distributable and public documentation. Private captures, credentials and database exports stay local. |
| Owner acceptance | **Pending.** | Complete the Milestone 1 portions of charter scenarios S1–S7 on the intended wiki. Search, Cargo and new link portions belong to their later milestones. Record acceptance of the release scope and remaining disclosed limits. |
| Final release cut | **Pending.** | Freeze the reviewed artifact, run required gates and exact-commit CI, confirm version/tag with the owner and publish the independent release. Preserve a consistent upgrade/rollback reference. |

## Scope control

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
