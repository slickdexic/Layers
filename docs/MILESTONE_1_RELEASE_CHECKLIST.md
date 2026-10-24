# Milestone 1 release checklist

**Lead review: October 22, 2026.** This implements the existing charter scope;
it adds no feature requirement. The preceding rolling calendar estimate is
withdrawn because it was not based on measured delivery of integrated journeys.
Tests and inactive components do not count as a completed user journey.

The target is page-owned layer sets with native page history, preserving images,
slides, whole PDFs and existing editing/viewing capabilities. Search, Cargo and
layer-object links remain later milestones and cannot delay this checkpoint.

| Remaining package | Observable completion condition | Current state |
| --- | --- | --- |
| Complete PDF Import in the editor | The approved catalog/dialog imports a complete PDF layer set into a missing target. One Undo reverses Import; Redo, page turns and drafts preserve every member and its source association. The approved version notice is shown when required. | Desktop MediaWiki 1.45.3 now passes actual Import, group Undo/Redo, page turns, first-Save handoff, a second Save in the same editor, complete draft recovery with later edits, owning-page return, overlay reopen and complete annotated Download. Source, main text and unrelated layer sets remain exact. See the [native checkpoint](PDF_IMPORT_NATIVE_ACCEPTANCE.md). Mobile and supported-version acceptance remain in the release-candidate package below. |
| Finish Save and recovery | First Save records source attribution in one owner-page revision. Reopen and saved-session handoff work. A refusal preserves work; a lost response cannot mark unsaved work as saved or cause duplicate publication. Current and earlier drafts recover safely, including after the attempted Save advanced the page. | Consecutive native Saves each create one owner revision. Genuine stale Save refuses without changing visible work/history or creating a revision. Disjoint Check reconciliation, fresh complete-draft recovery, group/later-edit Redo and explicit recovery Save passed natively. Actual desktop lost-success-reply acceptance now passes: one committed Save, an empty HTTP 200 response body after the committed Save, one explicit Check, no republishing, newer local work kept dirty, and complete Import/later-edit Undo/Redo across page turns. Earlier-backup qualification is retained. Supported-version/mobile combinations remain in the release-candidate package. |
| Qualify complete native journeys | Images, slides and PDFs complete create/edit, Save, owning-page return, reopen, history/diff/restore, scoped rename/copy/Import, recovery/conflict and viewer/export journeys. Same names on different owners/files remain independent. | The missing-PDF desktop journey now reaches saved handoff, recovery, conflict preservation and inspected complete Download. Prior image/slide/history results remain valid in their recorded scopes. Consolidate the release matrix and close only its unproved combinations; do not repeat successful Saves or unchanged suites. |
| Qualify the release candidate | Upgrade a 1.5.x wiki without losing layer sets; test declared MediaWiki 1.44 and 1.45, desktop/mobile and keyboard access; verify permissions, HTTP privacy, relevant security/data checks and charter performance budgets. | The actual 1.5.95 / MySQL upgrade on MediaWiki 1.44.6 now preserves seven legacy rows, all migrated payloads, source versions, geometry, page text and independent owners. Whole-PDF editing, one post-upgrade Save, owner return/reopen and reruns preserving newer work pass. See the [upgrade guide](UPGRADING.md). Remaining version/device, HTTP privacy/security/data and reference-performance combinations are still open. Historical results are not blanket acceptance. |
| Deliver and accept | Publish a reviewed extension-only release candidate with exact-commit CI, installation/upgrade directions, the test matrix and explicit remaining limitations. The owner then completes the charter acceptance scenarios. | Intermediate code is being preserved publicly. Milestone 1 has not passed. |

Ready **for owner testing** means the integrated candidate and technical checks
above are complete. **Milestone 1 accepted** additionally requires the owner's
acceptance. Neither waits for milestone 2–5 functionality.

Work proceeds through these packages to completion. New internal helpers must
close a named gap in one of these journeys; they do not create additional scope.
Do not run unchanged full suites repeatedly or grow evidence machinery as a
substitute for integration. Retain meaningful regression and data-preservation
checks, existing work, private data and reviewable extension-only commits.

The first-Save reading-order handoff defect is corrected and the native
continuation passes. New inventory/button regressions reproduce their
respective refresh defects; all 712 affected cases pass after correction.
The lost-success-reply browser case also passes without a runtime correction.
Remaining acceptance is limited to the existing release-candidate matrix above
and owner acceptance. Reuse valid evidence and close only unproved combinations.

The owner-approved [narrow editor repair](EDITOR_NARROW_LAYOUT.md) restores a
full-width canvas below the existing layer panel and wraps the existing header
controls at widths up to 768 pixels. Native image, slide and PDF Save/return/
overlay-reopen checks qualify the recorded browser viewport scope. This closes
the demonstrated 20-pixel canvas/header-overlap gap; it does not claim physical
touch-device or complete supported-version release acceptance.

A separate [MediaWiki 1.44.6 native checkpoint](MEDIAWIKI_144_NATIVE_ACCEPTANCE.md)
now passes fresh install/update/migration, image and slide Save/return/reopen,
whole-PDF Import with group Undo/Redo, first-Save attribution, saved page
traversal and native history/diff. Complete PDF draft recovery with both-page
Undo/Redo and one explicit Save, genuine stale-Save refusal, disjoint Check/
Save and selective historical restore now pass on 1.44. Download byte/render
inspection, Print and the remaining release-candidate combinations remain open.
No runtime correction was required.

Ordinary page embeds display their content and approved overlays. They do not
add owner/revision information above slides, images or PDF pages. The owner
explicitly requested removal of the slide caption on October 21. Dedicated
history/diff views retain their appropriate revision context.

The upgrade exercise reproduced migration inserting owner IDs into otherwise
correct local references. Native migration now opts into verified bare-name
output, retains already-correct author syntax and the Default shortcut, and
refuses completion when safe output cannot be produced. The original failed
upgrade and the separate corrected replay are retained; no live wiki was migrated.
