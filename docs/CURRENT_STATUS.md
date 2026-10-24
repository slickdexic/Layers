# Current release status

**Reviewed October 24, 2026. Milestone 1 remains open.** The candidate implements
page-owned layer sets with native page revisions. Its manifest still reports
1.5.95; it is not a tagged Layers 2.0 release. Select an exact reviewed commit
with passing CI, then follow the upgrade instructions.

The [Milestone 1 release checklist](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_RELEASE_CHECKLIST.md) defines the
remaining work. This summary does not add requirements or turn a scoped result
into complete release acceptance. Older dated investigation notes describe their
original checkpoint, not the current activation state.

## Implemented and qualified in recorded scopes

| Area | Current evidence and limits |
| --- | --- |
| Native ownership/history | Images, slides and PDF layer sets use complete owner snapshots and atomic native publication after migration completion. The owner/file/name scope keeps equal names independent. Exact historical views, source pins and native history operations have recorded coverage; complete lifecycle/version/device acceptance is still scoped by the checklist. |
| Integrated PDF Import | Desktop journeys cover whole-group Import, Undo/Redo, page turns, drafts, first-Save attribution, saved-session handoff, owning-page return and reopen. Missing-target PDF workflows have native acceptance evidence. These are integrated journeys, not inactive-helper counts. |
| Save outcomes/recovery | Native consecutive Saves, stale refusal, disjoint Check/reconciliation, explicit recovery Save and the committed-Save/lost-response case pass in recorded desktop scopes. Refusals preserve local work and history. |
| MediaWiki versions/upgrade | Native 1.44.6 and 1.45.3 checkpoints exist. The 1.5.95/MySQL upgrade rehearsal on 1.44.6 preserves recorded data and passes post-upgrade Save/reopen and safe reruns. Other deployment combinations and intended-wiki recovery still need their applicable checks. |
| HTTP/access/data | Recorded checks cover private reads, exact PDF delivery, token/method refusal, role/protection/revocation and visibility/deletion transitions. A retained-legacy-row deletion defect and six request-limit bypasses were corrected and replayed. This is bounded coverage, not a complete current security audit. |
| Viewer and page presentation | Approved overlays are the normal owner-page entry points. Ordinary embeds add no owner/revision captions or temporary set list. Image/slide Download offers PNG first and PDF separately; PDF Download is PDF only. Output/navigation checks retain their recorded scopes. |
| Server performance | Five 100-layer Saves take 98–122 ms; historical page responses take 97–447 ms on the isolated local-disk fixture. This meets the measured one-second server budget, not browser-paint/device or formal cold-cache acceptance. |
| Delivery documentation | Primary installation/upgrade, author syntax, named sets, permissions, native API, settings, FAQ and troubleshooting guidance distinguish the candidate from legacy storage. Upgrade instructions include exact version selection, backup, rehearsal, completion, verification and recovery. |

See the [native PDF checkpoint](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PDF_IMPORT_NATIVE_ACCEPTANCE.md),
[MediaWiki 1.44 checkpoint](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MEDIAWIKI_144_NATIVE_ACCEPTANCE.md),
[HTTP checkpoint](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md) and
[performance scope](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_HISTORY_PERFORMANCE.md) for the boundaries of those
results. Repository publication does not prove separate GitHub-wiki or
mediawiki.org publication.

## Remaining before Milestone 1 acceptance

1. Close only the unproved native version/device/keyboard and viewer/export
   combinations in the existing release matrix. Print preparation is not
   physical Print/OS-dialog acceptance; an emulated narrow viewport is not a
   complete physical touch-device qualification.
2. Complete the relevant current security/data review and remaining reference
   performance checks. Reuse valid evidence and rerun a passing suite only when
   a new change or unresolved concern justifies it.
3. Finish release packaging and external publication-source checks, verify
   required assets/tests and private-data exclusion, and rehearse recovery on
   the intended wiki copy. Previously migrated data needs its own reconciliation
   review; a successful fresh migration does not relabel old history.
4. Publish the reviewed release candidate with exact-commit CI and explicit
   limitations, then complete owner acceptance. Assign the final release/tag
   only at that checkpoint.

Use [known limits](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/KNOWN_ISSUES.md) for qualifications and
[release preparation](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/RELEASE_PREPARATION.md) for the delivery checklist.
Intermediate commits preserve reviewed work; they do not declare the milestone
accepted.

## Required milestone order

1. Page ownership and native page history.
2. Layer text discoverable through MediaWiki built-in search.
3. Cargo integration readiness.
4. Cargo integration.
5. Clickable layer-object links on wiki-page images, slides and PDF pages,
   never in the lightbox.

Later functionality must not hold up earlier milestones. A source listing or an
implemented hook is not proof that search, Cargo or links have passed acceptance.
The [project charter](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PROJECT_CHARTER.md) remains the finish line.

## Dated records

Previous investigation status remains in
[Git history before this refresh](https://github.com/slickdexic/Layers/blob/2493998a9dad7f36182c0e1d88cef689b2694429/docs/CURRENT_STATUS.md).
Retained private fixtures, logs, reports and local Git ancestry are not release
contents. Their preservation does not require publishing them.
