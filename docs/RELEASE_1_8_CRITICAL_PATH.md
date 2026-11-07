# Layers 1.8: critical path to release

November 6, 2026. Advances the independent Milestone 1 HIST/TYPES/DATA/SEC/PERF/OPS
gates. This is the current execution guide for closing the release, not a new
charter or permission to waive existing gates. Detailed evidence remains in
[RELEASE_1_8_ACCEPTANCE.md](RELEASE_1_8_ACCEPTANCE.md).

## Diagnosis

The main delay is not a lack of implemented editor/history functionality.
Much of the 1.44/1.45 journey, upgrade, Save/refusal/recovery and export work has
recorded passes. The remaining work is being obscured by four problems:

1. **A policy/design decision was being treated as another small bug.** The
   owner-approved page-revision privacy rule and the stricter search-discovery
   rule differ. Repeated source-scan/hook experiments cannot resolve that
   choice. The latest hook experiment proves why asynchronous repair alone
   cannot meet the latter rule. **Resolved November 6: the owner approved A** in
   the [decision brief](RELEASE_1_8_SEARCH_DECISION.md). Page-owned search follows
   page/revision access. Qualify that behavior; do not implement B for it.
2. **Local, public and installed candidates differ.** The private working HEAD
   is old; hundreds of changed/untracked entries are not one reviewed release.
   The ledger records public/installed candidate `5d13e58`; the later reader,
   batch and audit fixes are local. A local pass cannot qualify the installed
   1.44 tree. Repeated tests against different trees accumulate incomparable evidence.
3. **The 2.0 backlog has leaked into 1.8 closeout.** The charter explicitly
   excludes new search qualification, Cargo and links from Milestone 1.
   Existing functionality's real security/data-loss defects still matter, but
   a full PHP coverage program, blanket backend acceptance, every refactor and
   every unproved usability suspicion are not automatically new release gates.
   Applicable gates come from charter section 3.2, not from the number of audit rows.
4. **Qualification boundaries are mixed.** Synthetic server timings, linked
   development-mount HTTP timings, browser paint, native tests and physical
   device acceptance answer different questions. A controlled browser fixture
   is useful but does not qualify actual wiki Print. An unchanged successful
   suite need not be rerun because another unrelated document changed.

My earlier audit contributed to the confusion: N01 was not clearly separated
into page-owned discovery versus legacy confidentiality, and its roadmap read
as though every 2.0 assurance item were required for 1.8. The latest ownership
clarification and charter release scope must govern the remaining work.

## What is already delivered and should not be rebuilt

- Page-owned image/slide/whole-PDF publication and native history journeys have
  recorded 1.44/1.45 evidence. Retain the exact scope and reconcile changed files.
- Approved independent batch mounting is implemented. Complete native acceptance;
  do not commission another batching helper.
- Reader snapshot reuse is implemented with fresh owner/revision/source checks.
  Its synthetic speedup is useful; the next step is actual candidate measurement.
- Growth-guard reconciliation, link-policy refusal and eligible empty-index
  repair are present and locally tested. They need candidate qualification,
  not a second implementation.
- Native CI selection has grown from 15 to **18 files**, adding snapshot reuse,
  source revalidation and retained-file deletion. The handoff reports the
  selection passing **232 tests / 1,836 assertions on 1.45**. Its public 1.44
  execution remains outstanding. This supersedes the earlier audit's 15-file status.

## One owner for the release, five exit gates

### Candidate inventory already performed

A fresh read-only comparison against public commit
`5d13e58250bd2cb5322b2d84b7fd7f32599c9981` used its Git tree and Git-computed
working-file blob hashes (including normal Git text filtering), rather than
the private index. Scope: `src/`, `resources/`, `maintenance/`, `sql/`,
`services.php` and `extension.json`. Result: **1,929 unchanged files, 14 changed,
6 added, zero missing**. This bounds the runtime review; it is not yet a full
release manifest or proof of installation. Tests, tooling, guides, packaging
and provenance must be reviewed separately. No files were staged or committed.

| Runtime group | Exact changed/added files | Qualification focus |
| --- | --- | --- |
| Reader reuse | `src/Revision/PageHistoryAccess.php`, `PageReadService.php`, `SourceVersionResolver.php`, `PageOwnedPilot.php` | Fresh owner/revision/source refusal, changed bytes, detached snapshots, Import/publication interactions; native common-page timing. |
| Independent batches | `resources/ext.layers/viewer/PageOwnedInlineRead.js`, `PageOwnedRevisionBootstrap.js` | Early/fallback batches, navigation/disposal, repeated embeds and native controls/Print. |
| Link-policy refusal | `src/Validation/LayerLinkValidator.php`, `src/Revision/DocumentSchema.php` | Restrictive/failing policy, valid unlinked work, rejected Save keeps work; 1.44 compatibility. |
| Eligible empty-index repair | `maintenance/reindexPageDrawings.php` | Empty projection removes stale terms while main text remains; idempotence. Does not by itself close all discovery/privacy cases. |
| Search foundation | `src/Database/LayersDatabase.php`, `src/Revision/PageDrawingSearchText.php`; added `src/Search/LegacySearchSourceAdmission.php`, `LegacySourceScan.php`, `PageOwnedSourceScan.php`, `VisibleLegacySearchProjection.php`, `VisiblePageSearchProjection.php`, `VisibleSearchText.php` | Existing caller equivalence and inactive-helper tests; final inclusion/integration follows R1. Preserve the local work either way. |
| Descriptions/comments | `extension.json`, `src/Revision/PinnedPdfSource.php`, `src/Hooks/WikitextHooks.php` | Inspected diffs are cache-setting description and comments/examples; review public wording. No functional retest solely for those comment differences. |

The hundreds of working-tree differences largely reflect divergence from the
old private HEAD and retained local material. They must not be interpreted as
hundreds of new runtime changes since the public candidate. This smaller,
explicit comparison is the starting point for R2.

### Gate ownership

The lead owns policy integration, candidate identity and acceptance decisions.
Juniors receive bounded execution tasks against that candidate. Each task
states its criterion, exact input files/commit, expected observable outcome and
the single evidence gap it closes. Do not ask juniors to infer privacy policy.

| Gate | Concrete work | Exit condition |
| --- | --- | --- |
| **R1 — verify approved search policy and close privacy risk** | A is approved. Verify the active page-owned path against owning-page/revision permissions. Independently reproduce and resolve any legacy shared-set disclosure; retain its source-visibility requirement. Use the bounded tasks below. | Integrated evidence for A and a disposition of legacy confidentiality. No known high/critical confidentiality defect may be waived as a search feature deferral. Policy approval is complete; technical qualification remains open. |
| **R2 — freeze one reviewable candidate** | Make an explicit public-file manifest of accepted changes from the last qualified candidate. Include runtime, registration, tests, fixtures and required assets. Review exclusions and generate the package using the existing release tool. | One candidate commit/tree and package hash, with a change list and test-to-change map. No wholesale staging of the dirty private checkout. Preserve local evidence and unrelated work. |
| **R3 — qualify that candidate** | Run applicable automated/native/browser gates and current dependency/asset checks. Install the reviewed package in the existing 8082 arrangement. Reuse unaffected earlier results by verified source identity. | Exact-candidate CI and installed-file verification; 1.44 and 1.45 affected regressions/journeys pass with explicit skip disposition. Reader-reuse changes include Import/publication refusal coverage. |
| **R4 — close performance and owner evidence** | Measure actual reader behavior with representative authenticated and anonymous roles on the charter reference conditions. Finish the ledger's remaining tablet/phone-viewer, keyboard/screen-reader, Print and intended-wiki scenarios. Reconcile the existing upgrade/restore evidence and pilot-data disposition. | Existing numeric budgets met, or any remaining disclosed measurement limitation explicitly decided by the owner as the charter requires; applicable manual/owner sign-off recorded. Do not infer physical acceptance from emulation. |
| **R5 — cut the release** | Apply final version/release notes, regenerate and verify the artifact, run checks affected by those final changes, then owner acceptance and publication. | Version/tag, clean extension-only artifact, installation/upgrade/rollback directions and final exact-commit gates. Until then manifest 1.5.95 remains deliberate. |

R1 no longer awaits a policy choice. Candidate inventory and the manual
acceptance checklist can progress alongside its verification. R3 depends on R2;
final R4 evidence uses the selected candidate; R5 depends on all earlier gates.
The runtime inventory exists; the full candidate manifest and remaining
qualification determine the release date. Use these exit gates instead of
open-ended “one more helper” assignments.

## R1 assignments after approval of A

The lead owns the privacy assessment. Start with the active registered
`DrawingSearchText` / `DrawingSearchHooks` / `DrawingSearchIngress` path, not
`VisibleSearchText` or a test-installed filtering callback. The current
page-owned extractor has no file-source admission check, which is consistent
with A. It excludes text-suppressed revisions, but that local condition alone
does not prove index invalidation or per-reader result privacy.

| Task | Observable acceptance | Boundary |
| --- | --- | --- |
| **R1a — page-owned source independence** | Publish image/PDF layer text plus ordinary page and slide text. Suppress the exact saved file version. Current page-owned matches remain through native list/generator search and Special:Search; current/old readable Layers slots remain readable; media is refused without version substitution. Test before/after deferred updates and restoration. | Use active registration, no manual filtered reindex or test-only source callback. Include anonymous and permitted readers. Existing archival experiments are supporting evidence, not this acceptance pass. |
| **R1b — owner/revision privacy** | A newer revision removes obsolete terms from current search. Restrict an older page revision: denied readers cannot retrieve its Layers slot; authorized reviewers retain native access. Deny page read access and delete/restore the owner: disallowed layer text cannot appear in search results/snippets, and eligible results return on restoration. | Use real native transitions where supported. Core ordinarily disallows hiding the current revision's text; a directly altered test row only tests defensive behavior, not a supported suppression workflow. Include list/generator API and Special:Search; inspect counts/continuation if a result filter is involved. |
| **R1c — legacy confidentiality** | On an unconverted legacy set, exercise active File-page and embedded-set search with an exact archived source suppressed, a denied reader and independent permitted terms. Record index terms, matches and snippets before/after updates and restoration. | Existing legacy helper tests do not establish active-path privacy. If disclosure is confirmed, implement and qualify its complete boundary; do not apply A to legacy rows or call an asynchronous purge a complete fix. |

Run the affected slice on 1.45's existing isolated test tables and fixture
repository, then qualify the reviewed installed 1.44 candidate under R3.
Keep prototype tests and local work, explicitly marked as historical where
their asserted behavior is B. No new source-dependent page-owned backend,
scan integration or search pause is assigned. Promote stable acceptance cases
into the native regression selection after they pass.

**November 6 fresh evidence:** `PageOwnedSearchPolicyTest` passes on maintained
MediaWiki 1.45.3 / PHP 8.3.31 / PHPUnit 9.6.36: **3 tests / 65 assertions**
(two policy cases plus core teardown). It uses active search registration,
native list/generator search, real archived-file suppression/restoration,
current/old revision API reads, native old-page-revision suppression and a
private-wiki read denial. It does not manually repair the search index.
File-associated page text stays searchable before/after deferred updates;
the exact suppressed image remains unavailable. Obsolete revision terms leave
current search; anonymous old-revision reads are refused while an authorized
reviewer can read them. Both search API modes refuse a reader without wiki read
permission. No runtime change was needed for those cases.

This is partial R1a/R1b evidence, **not R1 closure**: PDF parity, actual
Special:Search output, page-specific permission integrations, owner
deletion/restoration, legacy active-path confidentiality, external backends
and exact installed 1.44 qualification remain unproved by this run. The normal
native configuration discovers the new class; the selected CI list remains
18 files pending candidate/backend qualification.

The run used default temporary `unittest_` tables (asserted in the fixture),
framework-owned temporary media and the existing external test log/cache
wrapper. No normal-table mode, wiki configuration change or new installation
was needed. Initial attempts found a missing test-only dependency loader and
then two fixture issues (cached permission options and a localized exception
message assertion); loading the existing test dependency and correcting the
fixture produced the pass. These were not runtime access-control repairs.

## Retained design evidence for source-dependent legacy risk

The following investigation originally evaluated B. B is not selected for
page-owned text. These constraints remain relevant only where R1c establishes
a legacy source-dependent privacy requirement; they are not a new assignment
to integrate the old page-owned filtering prototype.

The following was checked read-only in the installed core, not inferred from
an extension API name:

- MediaWiki 1.44 and 1.45 `SearchEngineFactory` construct engines through
  configured mappings/ObjectFactory. This is a possible extension mechanism,
  **not proof** that a generic wrapper preserves every backend contract.
- `ApiQuerySearch` calls the engine directly. `APIQueryAfterExecute` is after
  module execution; post-processing a snippet is too late to claim that the
  underlying match, count and generator behavior are correct.
- The inspected 1.45 `SearchMySQL::searchInternal()` obtains result rows and a
  separate total before returning a `SqlSearchResultSet`; its query builders
  are private. A naive result filter or subclass cannot be assumed to preserve
  counts, limits and query semantics.
- The retained native experiment shows `LocalFilePurgeThumbnails` can notify
  archived suppression/restoration after deferred updates. That notification
  is useful for eventual index repair, but leaves the observed pre-refresh window.

**If R1c confirms a legacy defect:** one integrated synthetic fixture through both native
search interfaces with a main-text marker, slide marker, permitted-file marker
and subsequently suppressed-file marker. Verify both list and generator API,
before/after deferred updates, restoration, mixed/phrase/negative queries and
counts/continuation. Read the index from the primary where required for the
test and distinguish same-transaction behavior from concurrent requests.

**Implementation design review must answer:** where stale source-dependent
matches are prevented, how permitted matches on the same page survive, how
backend query semantics and pagination are preserved, what source dependency
inventory is maintained, and how existing stale indexes are repaired on upgrade.
Choosing only a hook, only a projection, or only an owner scan is incomplete.

A dedicated engine integration or a different indexed-document representation
may be necessary; that is substantial search work. Do not silently activate it
with a regex matcher, suppress whole result pages, patch core, or introduce an
external worker. Preserve existing backend integrations. Any compatibility or
behavior tradeoff must be explicit and owner-approved. This is the point for
lead implementation/review, not another series of junior exploratory packets.

## Work that does not independently block 1.8

General search-feature completion and 500-page fan-out (Milestone 2), Cargo
readiness/integration (3/4), and on-page links (5) retain their order. General
refactoring, extending a PHP coverage program and speculative image-swap fixes
remain backlog unless tied to an applicable release criterion or reproduced
release defect. Existing protected capabilities are never removed to reduce scope.

The 300 ms target is not waived. The charter defines local-disk production
reference conditions; the shared-mount 8080 lane is diagnostic, not by itself
the reference acceptance environment. Use the already-maintained installed
8082 lane where applicable and record remaining hardware/configuration limits.
Do not build another wiki fleet or silently alter core versions.

## Evidence discipline

Use the existing release ledger rather than a new evidence system. Each open
row needs just: candidate identity, one missing observable result, test/manual
procedure, outcome, remaining limitation and accountable role. Stopped,
overlapping or source-changing runs are not passes. Re-run only affected tests,
then the final candidate gates once stable. Preserve previous failures and
ordinary wiki data. No native tests were run or wiki settings changed while
writing this plan; the core mechanism checks were read-only.
