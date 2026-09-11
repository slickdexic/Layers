# Junior implementation review — J01–J21

## J19–J21 review — September 11, 2026

Reviewed `22af7b31`, `de254bea`, `f318c8ae` after prior corrections `ca87c79e`. Corrections below are local working-tree changes on the J21 branch, not a release/merge or external wiki publication.

| Finding | Correction and limits |
| --- | --- |
| **High: import validation could be bypassed.** After the shared parser threw (including its layer-count rejection), J19 used a second permissive parser and imported anyway. | Removed fallback parsing. Missing/rejected validation returns failure without applying content. A rejected import leaves the recovery dialog open and raw data available for export. Success test now uses the real ImportExportManager parser. |
| **High: late set responses could apply after the latest switch completed.** J20 guarded using a mutable active-switch field; once cleared, `canApplyLoadedSet()` returned true. Identical target names also defeated name-only matching. | Every primary-manager load supplies a request-specific `shouldApply` closure checking generation and exact context before API processing. Same-name overlapping-request regression applies distinct payloads and verifies the old one cannot win. |
| **High: confirmation order could override selection order.** Request generation was allocated after awaiting confirmation. | Allocate generation on entry; an older confirmation cannot start a newer load. Stale errors do not restore an obsolete selector or emit an unrelated failure notice. |
| **Edit detection was incomplete.** The fallback fingerprint counted layer IDs, missing same-ID geometry/text changes and buffered content. | Compare serialized content, page, saved canvas/background settings and buffered snapshots alongside existing version/history guards. This is bounded switch-time work, not a new per-frame operation. |
| **High: cleanup crossed test-run ownership.** J21 deleted any `j21_` set and accepted absent author metadata as ownership. It performed this sweep before a run. | Remove automatic prior-run cleanup. Delete only exact registered names with the current run prefix. Capture the real pre-run inventory for preservation checks; no hardcoded `001`/`002` assumption. Top-level cleanup failure must fail teardown. Old interrupted runs require explicit inventory/reconciliation. |
| **Credential committed in test instructions.** A literal QA password appeared in the source comment. | Removed the value from current source. If the credential is active, rotate it before further use; it remains in git history. Do not copy it into commands, documents or test reports. Rotation has not been performed by this review. |
| **Lint failure in new CSS.** Extra blank lines at EOF failed Grunt's stylesheet check. | Removed trailing blank lines and reran lint. |

J19's new notice/export UI is useful, but destination lifetime, import failure feedback and undo/recovery behavior need J22. J20's new tests instantiate StateManager/selector/manager but mock APIManager; they are not proof of the real API processing boundary. J23 adds that focused integration evidence, with remaining fallback-manager and loading-state defects returned to the lead. J21's two reported 13-test browser passes used the earlier code and unsafe cleanup; corrected acceptance remains J24.

Verification: focused draft/switch tests passed (167 tests); the full JavaScript run initially found two old call-signature assertions, which were corrected and passed in the focused 84-test manager suite. Final full Jest rerun passed **181 suites / 14,377 tests**. Grunt ESLint/style/i18n, documentation/version consistency and whitespace checks passed. Bundle-size and i18n wiring checks pass (existing advisory unused-message notices). No new PHP implementation changed; prior PHP results remain historical. No browser/core integration or coverage measurement was performed in this review.

Next assignment order is **J22 → J23 → J24**; J22/J23 can run independently without editing the same production files. L01 remains lead-owned and page-owned publication remains unregistered.

## J16–J18 review — September 11, 2026

Scope: `e26eaa7d`, `f7a9a164`, `1baf0086`, followed by local review corrections. The prior review corrections were committed as `ee0604bd`. These statements concern the working branch, not a merged release or verified external wiki publication.

| Finding | Correction / remaining work |
| --- | --- |
| **High: legacy drafts could cross wiki boundaries.** J16 sweeps selected legacy keys using only user ID, despite those keys carrying no wiki identity. Matching file/set names were also enough to stamp the current wiki onto a legacy draft and remove the original. | Legacy keys are excluded from automatic expiry/quota sweeps. Automatic migration now requires explicit matching wiki/user/file/set/page fields. Ordinary old drafts lack that scope and remain preserved, unapplied; J19 supplies the manual recovery workflow. |
| **High: malformed recovery data was deleted.** Both load and cleanup removed unparseable legacy records. Missing page identity was treated as acceptable. | Preserve malformed and incomplete legacy records. Require explicit page identity for migration. Regression tests cover unscoped old data and cleanup beside a newer v2 draft. |
| **High: one saved draft could delete a different legacy record.** J16 compared the captured v2 value but then deleted the legacy key too. | Capture and successful-save cleanup now address only the v2 key. Legacy records require their separate validated recovery path. |
| **High: J18 cleared dirty state before loading the selected set.** A failed request left the old work present but marked clean, weakening save/leave protection. | Removed the premature reset; a regression assertion prevents its return. The pre-existing duplicate-confirmation problem remains J20 and requires coordinated set-switch handling. |
| **J17: reviewed with no additional production defect identified in this scope.** Canonical validation is shared by save, info, rename and delete, including old/new rename names. | PHP suite passes; this is production-path unit evidence with mocked persistence, not a new live database proof. Ledger commit corrected to `f7a9a164`. |
| **J18: live evidence is reported, not reverified here.** The engineer reports 10 passes on MediaWiki 1.45.3 / Chromium 145.0.7632.6. Tests defaulted to an existing-looking file and had no general cleanup for created sets. | Require an explicitly supplied test-owned `TEST_FILE` before writes. J21 must create/clean fixtures and rerun after J20. Do not treat the earlier run as evidence for the corrected dirty-switch behavior. |

J16's tuple encoding fixes set/page key collisions, but its completion claim was too broad. Legacy recovery currently exposes an internal record getter/log, not a finished user recovery interface. Wiki-scope discovery and strict v2 payload identity also need the J19 acceptance work; an editor-supplied scope in a unit fixture is not proof of real multi-wiki isolation.

Next assignments: **J19 (legacy recovery and real scope verification), J20 (safe set switching), J21 (isolated browser fixtures and acceptance)**. L01 remains lead-owned. No public page-owned history registration or data migration was enabled.

Verification for this review: standalone PHP **1,070 tests / 2,485 assertions, one existing skip**; focused draft/selector tests **202 passed**. Full Jest: **180 suites / 14,349 tests passed**. Grunt ESLint/style/i18n, PHP syntax/style/MinusX, documentation/version and whitespace checks passed; the two existing duplicate Config/HashConfig stub warnings remain. No fresh browser/core integration, coverage or LTS-backport claim is made.

## Earlier J01–J05 review (September 10)

Reviewed September 10, 2026. Scope: commits `6486046f`, `0ca2b3a4`, `9b8a0d5e`, `be126dd6`, and `9819921f`, plus the uncommitted corrections in this working tree on `codex/j05-exact-draft-cleanup`. Local `main` remains at `e03504ec`; this review does not claim these changes are merged or pushed. This is a review of five tasks, not a fresh audit of the entire extension.

## Findings and corrections

| Severity | Finding | Disposition |
| --- | --- | --- |
| High: wrong write target | J01 still sanitized explicit names before saving. `///` became unnamed and selected the latest set; `bad/name` became `badname`; long names could be truncated into an existing target. | Corrected. Only null/empty means unnamed. Malformed or noncanonical explicit save identifiers fail with `invalidsetname` before resolution/persistence. Regression cases cover image, PDF and slide entry routes. Literal `on`, `off`, `1` and `0` remain valid. |
| High: unsaved work loss | J05 unconditionally forgot a buffered page when an earlier save completed, even if navigation had put a newer snapshot in its place. | Corrected. Completion releases only the submitted entry; a replacement remains dirty and the batch reports incomplete. A deferred-promise test verifies this interleaving. |
| High: recovery data loss | J05 used wall-clock timestamps to protect draft cleanup. Different drafts can have the same timestamp, so a newer draft could still be deleted. | Corrected for buffered-save cleanup. Capture the exact stored value before sending and compare it at cleanup. Unavailable capture preserves the draft. Tests cover equal timestamps and failed capture. This is not a transactional cross-tab storage guarantee. |
| Medium: hidden configuration failure | J02 caught all configuration/service errors and quietly chose `default`, potentially routing a first save differently from the configured intent. | Corrected. Production callers pass configuration explicitly, including Special:EditSlide; lookup failures propagate rather than becoming a seed choice. No service-locator dependency remains in the sanitizer. |
| Test completeness | J04 improved rename assertions but retained optional create/confirm button fallbacks. | Corrected to require the actual controls. Browser execution remains unverified; changing selectors alone is not browser evidence. |
| Documentation accuracy | The ledger said completed/ready for merge, while current known-issues docs still described all five tasks as unfixed. J05's claimed exact targeting/race protection exceeded its evidence. | Reconciled with reviewed status and the remaining tasks below. Original reproduction sections remain historical. |

J03's creation-bucket placement is consistent with the approved scope: creation is checked after resolving the named slide set and before persistence; existing-set updates retain the save-only policy. Its tests exercise the production route with mocked dependencies. That does not establish concurrent rate-limit behavior against a live database.

J04 now invokes production validation/API execution rather than a duplicate regex. Persistence dependencies in these PHP tests are mocked; they do not prove an actual database/browser rename round trip. The reported rename sanitization issue remains a follow-up, not an accepted API behavior guarantee.

## Compatibility decisions

- Saves with omitted or empty `setname` retain latest-set/initial-seed behavior. Explicit canonical identifiers are literal, including names that resemble wikitext switches. Invalid identifiers now fail instead of being stripped, truncated, whitespace-normalized or redirected. Clients must send the stored canonical name.
- Configuration seed validation keeps J02's policy: valid configured strings are normalized through the existing sanitizer, invalid values raise ConfigException, and the absent/null setting retains `default`. The lead accepts this policy for this correction. An actual configuration read failure is not an absent setting.
- No database schema, document format, release version or production registration changed. Existing saves remain legacy `layer_sets` saves; these fixes do not complete page revision history.

## Remaining work, in assignment order

The exact task packets are in the [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md).

1. **J16 — Collision-free draft identity and safe legacy recovery.** The existing key replaces spaces and Unicode with underscores, so `A B` and `A_B` can share storage. The suffix also makes set `x-p2` on page 1 collide with set `x` on page 2. J05 extended cleanup to more identities without resolving that older format defect. Preserve recovery data while upgrading the key format; do not simply delete old keys.
2. **J17 — Consistent explicit-name validation on remaining mutation routes.** Rename still sanitizes before validation. Review save/read/rename/delete agreement and reject changed explicit identifiers before mutation, with production-route negative tests. Do not change wikitext display-intent parsing.
3. **J18 — Live rename acceptance and required-control assertions.** Run the corrected test in an isolated fixture environment and remove the remaining false-pass patterns in the named-set tests. Record skipped prerequisites honestly.

The lead retains **L01** (alternate-path admission). J06 and later history implementation packets remain blocked on its contract. Do not start a public page-owned endpoint, migration or Cargo schema as a substitute for these dependencies.

## Verification

The standalone PHP suite passed 973 tests / 2,298 assertions with one existing skip before one additional resolver regression was added; the focused resolver suite then passed 14 tests / 74 assertions. The full Jest suite passed 180 suites / 14,331 tests. PHP syntax/style/MinusX, Grunt lint/style/i18n checks and repository guards passed, with existing duplicate Config/HashConfig stub warnings and advisory i18n wiring notices. A new line-length warning was corrected afterward. Documentation/version consistency and whitespace checks passed. The metrics guard reads existing coverage artifacts; it does not measure new coverage.

These are local PHP 8.4.11 and Node/Jest results. Real-core tests were not rerun because no page-owned persistence implementation changed. Browser/HTTP tests were not run. The initial Docker inventory attempt was denied access by the current sandbox; this is not evidence that Docker is stopped. No new coverage percentage or LTS/backport claim is made. Repository documentation sources are updated locally; external wiki publication is a separate action.
