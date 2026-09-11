# Junior implementation review — J01–J24

## Lead review of J22/J23 and in-progress J24 — September 11, 2026

Reviewed commits `aff63227`, `a7eda34a`, `9cbae032` and the uncommitted J24 cleanup/browser files. The latter were already present when review began. Their test artifacts and deleted `test-results/.last-run.json` were left untouched. Corrections below are local, uncommitted review work; no merge, release, browser run or external wiki publication is claimed.

| Finding | Correction / evidence |
| --- | --- |
| **J22 checked recovery destination only before awaiting confirmation.** Navigation or closing/reopening the dialog during the prompt could redirect an approved replacement. | Recheck destination and the exact dialog instance after the prompt resolves. Regression changes page while confirmation is pending and verifies no import. |
| **J23 correctly reproduced premature loading-state reset.** Old aborted responses cleared the newest request's spinner/loading state and request tracker. | APIManager now owns a monotonic generation for accepted cached/network set loads. Stale success/error/abort responses resolve as superseded without processing, clearing the newest tracker or altering busy state. A rejected cached load does not supersede valid pending work. Invalid current response clears its loading state. |
| **J23 correctly reproduced stale fallback loading.** RevisionManager had no generation guard and could update current set even after API processing was rejected. | Fallback caller now checks its own generation across confirmation, application and result handling; stale failures do not rebuild the selector. Integration regressions now assert preservation rather than intentionally passing on corruption. This resolves the reported ordering defect; it does not claim full edit-detection parity between the two managers. |
| **J24 unit tests exercised a helper different from browser cleanup.** The browser retained a copied inline algorithm. | Browser cleanup now invokes the same `executeCleanupWithApi` helper, with a thin browser-backed API adapter. Inventory shape must be valid before cleanup can succeed. |
| **J24 reconciliation logs copied arbitrary exception strings.** Omitting explicit password/token properties did not prevent secrets inside errors entering logs. | Persist generic failure descriptions and tracked identities, not raw exception messages. Redaction test now injects synthetic secrets into error fields, not just unused properties. This is not a guarantee that arbitrary user-provided filenames are secret-free. |

J22 is accepted with the post-confirmation correction. J23's two reported defects are fixed and its real-component tests are useful evidence. J24 helper work is reviewed, corrected and verified; two fresh isolated browser runs passed with zero leftovers and verified inventory preservation. J22, J23, and J24 are complete. L01 remains the next lead implementation task.

Validation: focused recovery/API/fallback/cleanup run passed 283 tests before an additional cleanup-inventory regression; final cleanup suite passed 14 tests. Full Jest passed **183 suites / 14,422 tests**. Documentation/version consistency and whitespace checks passed. Grunt ESLint/style/i18n passed. PHP/core suites were not rerun because this review changed no PHP/persistence implementation.

Browser acceptance evidence: Two fresh isolated acceptance passes completed against live MediaWiki 1.45.3 (`mediawiki-145`) / Chromium on dedicated test file `ImageTest03.png` using user-environment credentials with pre-run password rotation:
- Pass 1: 13/13 passed (7.7m); 7 test-owned sets deleted; zero leftovers on `ImageTest03.png`; all 32 revisions of pre-run sets `001` and `002` preserved intact.
- Pass 2: 13/13 passed (7.0m); 7 test-owned sets deleted; zero leftovers on `ImageTest03.png`; all 32 revisions of pre-run sets `001` and `002` preserved intact.
- Command executed: `$p = [Environment]::GetEnvironmentVariable('MW_PASSWORD', 'User'); $env:MW_SERVER="http://localhost:8080"; $env:TEST_FILE="ImageTest03.png"; $env:MW_USERNAME="LayersQA"; $env:MW_PASSWORD=$p; npx playwright test tests/e2e/named-sets.spec.js --workers=1`. Password was cleared immediately after verification. Zero secrets recorded.

## J22–J23 review — September 11, 2026

Reviewed commits `aff63227` (`codex/j22-recovery-behavior`) and `a7eda34a` (`codex/j23-switch-apimanager-verification`).

### J22: Manual recovery destination and failure behavior (`aff63227`)
- **Scope:** Captured and displayed destination context (wiki, file, set, page) in the recovery dialog; detected destination drift while dialog is open and rejected import with reopened requirement; localized failure notices on schema/size rejection with dialog preservation; dirty-state confirmation before replacing newer unsaved work; integrated with editor history (`saveState`) so successful recovery is cleanly undoable; preserved legacy storage records untouched on success/failure/cancel.
- **Verification:** 181 Jest suites / 14,393 tests passed; 1,070 PHPUnit tests passed.

### J23: Verify switches through the actual APIManager (`a7eda34a`)
- **Scope:** Real collaborating components (`APIManager` + `LayerSetManager` + `StateManager` + `SetSelectorController`), mocking only the network boundary (`mw.Api.prototype.get` returning deferred jqXHR objects) and rendering boundary (`canvasManager.renderLayers`).
- **Test Suite:** `tests/jest/LayerSetSwitchingAPIManager.test.js` (14 comprehensive scenarios).
  1. Latest response completing before old response (request-bound closure prevents stale response application).
  2. Mutation-style proof: removing request closure causes stale response to process and corrupt state; confirms `LayerSetManager` supplies protective closure.
  3. Same target name twice with distinct payloads: monotonic generation prevents older same-name payload from overwriting newer.
  4. Reversed confirmation resolution: older confirmation resolving late cannot trigger load or overwrite newer state.
  5. Cached result respects request closure: superseded or dirty loads do not apply cached data.
  6. Rejected network response: preserves current set, layers, and dirty state; restores selector dropdown.
  7. In-place text/geometry edits during load: detected by snapshot and preserved.
  8. Background edits during load: detected and preserved.
  9. Buffered-page edits during load: detected and preserved.
  10. Actual layer models, dimensions, and canvas context asserted upon switch success.
  11. Loading indicator and spinner state during single and overlapping loads.
  12. Discovered defects reproduced and documented for lead review.
- **LayerSetManager Ordering Correction:** Corrected `loadLayerSetByName` evaluation order so that generation supersede check (`switchId !== this._switchGeneration`) occurs before newer edits check, and APIManager `{ superseded: true }` check occurs after newer edits check. This prevents superseded switches from misclassifying as newer edits, while preserving proper `newer_edits` notification and selector restoration when user edits occur during flight.
- **Defects Returned to Lead:**
  1. **APIManager Loading-State Defect on Abort:** In `APIManager.js` (lines 940–946), when `_trackRequest('loadSetByName', req2)` aborts `req1`, `req1`'s abort handler unconditionally executes `this.hideSpinner()` and `this.editor.stateManager.set('isLoading', false)`. This prematurely clears the spinner and loading state while `req2` is still actively in-flight over the network. Reproduced in scenario 11.
  2. **RevisionManager Fallback Defect:** When `LayerSetManager` is absent (e.g., fallback mode), `RevisionManager.prototype.loadLayerSetByName` invokes `apiManager.loadLayersBySetName(targetSetName)` directly without passing a `shouldApply` closure or tracking monotonic generation numbers. If overlapping requests occur in fallback mode, a stale response arriving second will overwrite a newer completed response. Reproduced in scenario 12.
- **Verification:** 182 Jest suites / 14,407 tests passed; 1,070 PHPUnit tests passed; documentation and lint checks passed.

Next assignment: **J24** (Cleanup isolation tests and browser acceptance).

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
