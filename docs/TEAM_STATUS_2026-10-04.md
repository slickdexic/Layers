# Layers team update — October 4, 2026

**Purpose:** preserve the completed engineering work and reach a coherent branch
for systematic integration and owner testing. Advances OPS-2/OPS-3/OPS-4 and
tracks HIST-4/HIST-8/HIST-9, DATA-1 and UI-10. The
[project charter](PROJECT_CHARTER.md) remains the Layers 2.0 finish line.

## Current state

**Continuation later October 4:** the existing Docker engine was restarted and
the native environment passed a fresh idle preflight. The lead reran the scoped
native compatibility/pilot gate (**191 / 2,357**), standalone PHP
(**1,486 / 3,662 / one existing skip**), full JavaScript/static gates
(**15,190 / 208 suites**) and repository PHP syntax/style checks; all pass.
No browser run or new J113E control evidence is claimed. The remaining J113E
assignment can resume, followed by the new pure inactive
[J113F allocation helper](J113F_MIGRATION_NAME_ALLOCATION_PACKET.md).

The curated development checkpoint also preserves
[selected acceptance evidence](CHECKPOINT_ACCEPTANCE_EVIDENCE_2026-10-04.md),
including the corrected gallery and original restoration receipts. Git's remote
branch check succeeded using the Windows certificate store without changing
configuration; the checked remote head is an ancestor of the local branch.
Publication of a development checkpoint does not activate a feature or complete
the charter. The earlier inventory and outage observations below retain their
original audit context.

The page-history foundation is implemented. Scoped owner/file/name identity,
native PDF-page selection, atomic whole-PDF rename, creation/copy/adoption and
draft recovery have bounded lead acceptance through J112. PDF pages inside a
layer set share one name. Search, native link tracking/searchable targets (J108)
and opt-in per-layer Cargo rows (J109) are implemented and accepted for their
documented scopes.

J113A–D are accepted components: inactive name-only output support, effective
PDF pages during direct migration, retained-row audit evidence, and grouped
parser name counting. J113E's legacy File-page selector is implemented and
previously verified locally. Its independent read-only review found no
demonstrated production defect, but **the junior assignment is incomplete**:
redirect-to-current-editor journeys, another-owner migration IDs, deterministic
full-byte no-write comparisons and both restored negative controls remain.
Production and tests were unchanged by that review.

Last recorded results, rather than a fresh combined full-suite claim:

| Verification | Result and scope |
| --- | --- |
| Native PHP | Lead compatibility/pilot group: **191 tests / 2,357 assertions**, passed before the environment outage. This is a scoped group, not the entire native suite. |
| Standalone PHP | Junior review: **1,486 tests / 3,662 assertions / one existing skip**, passed. |
| JavaScript | Earlier C2 full run: **15,190 tests / 208 suites**, passed. Not rerun for J113E. |
| Browser | C2 minimum: **2 tests / 19 screenshots**, technically accepted; owner screen approval remains pending. This is not full-browser-suite acceptance. |
| Host/static/docs | Junior style, static, documentation and whitespace checks passed. PHP coverage remains unmeasured. |

At the initial team review the existing Docker test engine was unavailable and
its named pipe absent. The later continuation above supersedes that blocker.
Docker remains only the development/test environment, not a Layers runtime
dependency or a new architecture workstream.

## Checkpoint recommendation: preserve the work today

Create a clearly labelled development checkpoint on
`codex/l01-publication-admission`, then push that branch after checking the
current remote state. Do not wait for migration completion, J111 or release
acceptance to preserve work. A checkpoint records the implemented components
and their explicit unfinished verification; it does not activate output,
deploy, merge to `main`, run a migration or declare Layers 2.0 complete.

Read-only Git inventory before this status update:

- HEAD is `364fb385`; the local tracking reference shows **two existing commits
  ahead of the upstream**, with no remote-only commit. No fetch was performed,
  so current remote state and push authorization/connectivity are unverified.
- **71 tracked modifications and 32 untracked files** were present; nothing
  was staged. Excluding three generated browser-result files leaves **100
  engineering/documentation/test files**, plus this new team update.
- Preserve all reviewed implementation packets, production source, translations,
  test cases and helpers, the migration audit command, and exact documentation
  mirrors. Review the explicit paths before staging; avoid a blanket add.
- Exclude the changed `test-results/.last-run.json` and the two generated
  `provisioned-fixtures` JSON files in the untracked browser-result directory.
  Leave local artifacts intact. Checkpointing source does not require deleting
  anything.
- Archive the selected final acceptance evidence intentionally. Ignored `tmp/`
  galleries/screenshots/receipts/logs will not be preserved by a normal source
  commit. Keep the corrected gallery with its relative screenshot dependencies,
  owner restoration readbacks and the final native logs together.

Evidence worth retaining includes `tmp/J112C2-owner-review-corrected.html`,
`tmp/j112c2-terminology-browser/`, `tmp/j112c2-terminology-readback.json`,
`tmp/j112c2-lead-browser/`, `tmp/J113DE-native-gate.log`,
`tmp/J113E-focused-final.log` and `tmp/J113E-before.log`. Reports contain the
test results but do not replace the screenshots or raw restoration evidence.

Budget **1–2 hours** for a curated checkpoint/evidence review; the actual
commit and branch push can follow in the same work session if the remote check
and access succeed. No Git-operation blocker was demonstrated by this audit.
No commit, index change, fetch or push was performed for this update.

Afterward, make smaller checkpoints at each reviewed milestone. Keep unresolved
verification recorded beside the implementation instead of accumulating another
large uncommitted tree.

## Milestones to reach a healthy broad-testing branch

For this planning milestone, "healthy for testing" means consistent identity and
name behavior across reads, editing and migration; restored protected viewer
entry points; reproducible serial tests with safe cleanup; an explicit remaining
issue list; and a preserved branch that the team can test together.

| Milestone | Remaining deliverable | Lead / junior responsibility | Planning effort |
| --- | --- | --- | --- |
| 1. Resume native verification | Restore the existing test environment; finish J113E editor journeys, foreign-owner-ID refusal, full-byte no-write tests and both negative controls. | Junior completes the existing packet; lead reviews. Environment availability is a prerequisite. | **0.5–1 working day**, excluding environment downtime. |
| 2. Complete the coordinated J113 transition | Whole-set allocation/resume; numbered-alias editor parity; template/gallery PDF page metadata; preserve old show intent before activating Default; activate name-only writers; tested tidy/reconciliation dry run, stale-plan refusal and undo. | Lead owns integration; delegate bounded metadata/test work once the contract is fixed. Any actual content reconciliation/write still requires the owner-reviewed dry run. | **3–5 working days**. |
| 3. Restore the approved reader experience | J111 Edit/View overlays and full-size viewer; exact-version PDF navigation; complete print/download; editor access for missing sets; retain existing entry points until replacements pass acceptance. | Architect settles the remaining J111 version/render/export contract; lead owns server admission; junior implements the client against the tested response contract. | **3–5 working days**, after the contract is settled. |
| 4. Consolidate integration testing | Repair unsafe cleanup in the older copy-list spec; run current native/standalone/client/browser gates, verify migration/undo on disposable fixtures, refresh examples/docs and present screens for owner review. | Lead sequences native/browser work; junior owns assigned regression/acceptance cases. Owner reviews screens. | **1–2 working days**. |

**Lead planning estimate: approximately 8–13 focused engineering working days,
or about 2–3 calendar weeks with a lead and a junior actively available.** Some
work can overlap; native tests and browser/wiki writes must remain serial. This
range assumes the existing environment is restored promptly, the J111 contract
is settled without a redesign, and no major regression appears. Environment,
architect-decision and owner-review waiting time is additional. Confidence is
moderate to low until the first consolidated gate and J113 migration dry run.

Targeted regression testing can resume as soon as the environment is available;
it need not wait for every milestone above. The estimate covers broad testing
of a coherent integrated feature path, rather than just restarting a test runner.

## Further Layers 2.0 milestones

The charter also requires the following work beyond that broad-testing milestone:

- **Features and reliable data:** interactive layer links with keyboard/hover,
  link diffs and PDF link export; clipboard/selection transfer and PDF-page
  copy/move; inserting wiki images by reference; conflict comparison; faithful
  exports; full page/file revision-deletion, backup and recovery behavior.
- **Search and Cargo lifecycle:** deletion/suppression updates, historical
  query isolation and supported-version acceptance. J109 per-layer/link rows
  already exist; they are not waiting on a field-name decision.
- **UI/accessibility:** consistent tokens/skins, keyboard and screen-reader
  acceptance, a reading-order text alternative, RTL, touch, navigation/error
  cleanup and owner approval of all screens in light/dark themes.
- **Performance/security:** reference-install measurements and remaining
  loading/save/storage budgets, link security integration, shipped dependency
  review and a complete release-candidate security review.
- **Release/upgrade acceptance:** supported MediaWiki versions, coverage and all
  full-suite gates, upgrade/undo on a copy of a 1.5.x wiki, then the owner's S1–S7
  scenarios. The owner declares charter completion.

These are additional engineering and acceptance milestones. A dependable
Layers 2.0 release date needs their own bounded assignments and the results of
the integrated testing phase; the 2–3-week range above is a testing-readiness
estimate.

## Immediate directions to the team

**Lead engineer:** prepare the curated preservation checkpoint; keep the J113
transition as the implementation priority; review J113E's deferred evidence when
native execution resumes. Keep all activation and content-write limits explicit.

**Junior engineer:** resume the unfinished assignment in
[J113E](J113E_LEGACY_PDF_SELECTION_PACKET.md#junior-assignment--review-and-strengthen-evidence)
when the existing environment is available and a fresh idle preflight passes.
Complete the three recorded evidence gaps and both negative controls. Restore
temporary controls exactly, run the complete assigned filter, append evidence
and return for lead review. Do not change production behavior, configuration or
ordinary wiki content, or overlap browser/native activity.
Return J113E separately for review, then implement the bounded inactive helper
in [J113F](J113F_MIGRATION_NAME_ALLOCATION_PACKET.md). Its host-only tests can
also be assigned to another junior independently; it must not activate migration
callers or modify the destination snapshot.

**Project owner / architect:** retain the agreed owner/file/name model and larger
design authority. The remaining architect input is the
[J111 proposal](J111_VIEWER_READ_PROPOSAL.md)'s exact-version/mixed-version and
render/export delivery contract. C2's existing screen review remains outstanding.
No new layer-set naming decision is needed.

## Update verification

This update reviewed the latest junior report, current charter/queue, accepted
milestone records, Git inventory and existing engine availability. Two delegated
read-only audits checked checkpoint scope and remaining milestones. It changes
status documentation only. The junior's host verification and the earlier native
and browser evidence are attributed above; no new native/browser or complete
release acceptance is claimed.

Final documentation verification passes for **85 maintained/policy documents and
53 historical records**; the status mirror matches and `git diff --check` passes.
