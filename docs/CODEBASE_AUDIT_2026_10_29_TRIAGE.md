# October 29 codebase audit: release triage

This review advances Milestone 1 data integrity, security and release assurance.
It is distinct from the [October 28 review](CODEBASE_AUDIT_TRIAGE.md); their
finding numbers have different meanings. The external audit and private evidence
stay local. The table records disposition, not a claim of release acceptance.

| Finding | Current disposition |
| --- | --- |
| A01: empty legacy drafts | Confirmed by source inspection. The owner is reviewing a proposed recovery behavior; no correction has been applied. |
| A02: legacy image draft loss | Confirmed by source inspection. The same proposal covers complete image data and failed-backup preservation; page-owned recovery uses a separate path. |
| A03: server-rendered rotation | The server rectangle builder does not apply the browser's rotation. Export fidelity needs a bounded correction and owner-approved behavior before implementation. |
| A04: browser CI fixture | The workflow seeds a file but the current editor test expects a separately provisioned owner and an obsolete edit link. Clean-fixture and overlay assertions require repair; old successful workflow runs do not qualify this candidate. |
| A05: native CI breadth | The current 1.44 / SQLite job is a selected slice, not the complete compatibility matrix. Additional native and installed-wiki results remain separately scoped. |
| A06: coverage enforcement | Ordinary CI does not enable Jest coverage, so its configured thresholds are not established as enforced. Measure the current suite before changing the gate or its targets. |
| A07: renderer failure logs | Corrected in the candidate: renderer failure messages no longer include converter arguments, stderr, exception messages or temporary paths. The renderer also suppresses MediaWiki's per-command shell logger, which otherwise logged the complete command and converter output. A native converter deliberately echoed a synthetic layer marker and exited 23; the extension retained the failure and exit code while both loggers omitted the marker and path. Separate pre-fix failures demonstrated each logging path, and the corrected checks passed on 1.44 and 1.45. A synthetic thumbnail exception is also redacted. This is not a claim about every extension logger. |
| A08: shared-set search fan-out | The 500-page cutoff is source-confirmed. The search milestone owns the bounded continuation repair; no page-owned Save defect has been demonstrated here. |
| A09: empty search projection | The maintenance caller skips empty text. The search milestone owns a native stale-term and visibility investigation; no confidentiality exploit has been established. |
| A10: link-policy fallback | A failure-mode risk remains for the later layer-link milestone. No normal-request authorization bypass was demonstrated. |
| A11: candidate identity | The public release candidate and package have exact-commit checks; local working files and installed test builds are not automatically identical. Reconcile affected files for final acceptance. |
| A12: performance | The installed 1.44 reader measured 319.8–326.1 ms in five visits against the 300 ms target. The test environment does not satisfy all charter reference conditions; the reference assessment remains open. |
| A13: intermittent slide Save | The original owner report remains unexplained despite later successful Saves. Do not attribute it to the separately reproduced image-draft quota issue without evidence. |
| A14: manual, upgrade and owner acceptance | Partial evidence exists; the [release ledger](RELEASE_1_8_ACCEPTANCE.md) retains the remaining scoped checks and owner decisions. |
| A15: maintenance wording and comments | Review by meaning and obtain any required owner approval for visible wording. Historical names and saved history are not globally renamed. |

The renderer change does not alter export choices, rendering or authorization.
The complete standalone PHP suite passed 1,697 tests / 4,217 assertions with
one existing skip. Native privacy tests passed on both maintained supported
MediaWiki versions; the existing 1.44 PDF-export test passed with the corrected
renderer preloaded. The 1.45 test harness used a temporary test-access wrapper.
