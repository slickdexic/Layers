# Junior implementation review — J01–J05

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
