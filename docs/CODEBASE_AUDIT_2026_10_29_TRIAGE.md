# October 29 codebase audit: release triage

This review advances Milestone 1 data integrity, security and release assurance.
It is distinct from the [October 28 review](CODEBASE_AUDIT_TRIAGE.md); their
finding numbers have different meanings. The external audit and private evidence
stay local. The table records disposition, not a claim of release acceptance.

| Finding | Current disposition |
| --- | --- |
| A01: empty legacy drafts | The owner approved the [recovery behavior](LEGACY_DRAFT_PRESERVATION_BEHAVIOUR_BRIEF.md) and [dismissal correction](LEGACY_RECOVERY_DISMISSAL_BEHAVIOUR_BRIEF.md). The candidate preserves dirty empty sets and background settings. Focused tests and an isolated browser harness cover Restore, Escape, explicit Discard and a backup replaced while the dialog is open, without wiki writes. A real pre-migration legacy-editor journey and owner screen acceptance remain pending. |
| A02: legacy image draft loss | The same approved correction retains complete image sources and refuses failed backup writes without sweeping other drafts. Focused tests cover reload and Restore, prior-byte retention and failure reporting; page-owned recovery uses a separate path. A real pre-migration legacy-editor journey and owner screen acceptance remain pending. |
| A03: server-rendered rotation | The owner approved the [rotation correction](SERVER_RENDER_ROTATION_BEHAVIOUR_BRIEF.md). The candidate renders rectangle and image rotation; native pixel tests cover 0, 45 and 90 degrees, scaled canvases, a partly off-canvas image, subsequent-layer isolation and a synthetic two-page PDF on 1.44 and 1.45. The cache version changed so older output is not reused. Owner acceptance, real-media and other-property fidelity remain open. |
| A04: browser CI fixture | The workflow seeds a file but the current editor test expects a separately provisioned owner and an obsolete edit link. Clean-fixture and overlay assertions require repair; old successful workflow runs do not qualify this candidate. |
| A05: native CI breadth | The current 1.44 / SQLite job is a selected slice, not the complete compatibility matrix. Additional native and installed-wiki results remain separately scoped. |
| A06: coverage enforcement | Ordinary CI does not enable Jest coverage, so its configured thresholds are not enforced. The effective configuration confirms both projects and the existing global thresholds. Babel and V8 instrumented runs were stopped after several slow suites; neither produced a coverage result. Measure the complete suite before changing the gate or its targets. |
| A07: renderer failure logs | Corrected in the candidate: renderer and PDF-stitch failure messages no longer include converter arguments, stderr, exception messages or temporary paths. Both suppress MediaWiki's per-command shell logger, which otherwise logged the complete command and converter output. Native converters deliberately echoed synthetic markers and exited 23; the extension retained failure categories and exit codes while both loggers omitted the markers and paths. Separate pre-fix failures demonstrated each logging path; corrected checks passed on 1.44 and 1.45. This is not a claim about every extension logger. |
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
The approved legacy draft changes passed 207 affected tests and the full client
suite of 19,076 tests in 325 suites. An initial full run exposed one outdated
PDF test expecting dirty empty drafts to be skipped; the test was updated for
the approved behavior before the passing replay.
