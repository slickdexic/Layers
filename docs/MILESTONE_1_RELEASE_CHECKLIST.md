# Milestone 1 release checklist

**Lead review: October 24, 2026.** This implements the existing charter scope;
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
| Qualify the release candidate | Upgrade a 1.5.x wiki without losing layer sets; test declared MediaWiki 1.44 and 1.45, desktop/mobile and keyboard access; verify permissions, HTTP privacy, relevant security/data checks and charter performance budgets. | The actual 1.5.95 / MySQL upgrade on MediaWiki 1.44.6 preserves all recorded data and passes post-upgrade PDF Save/reopen and safe reruns; see the [upgrade guide](UPGRADING.md). The [HTTP privacy checkpoint](MILESTONE_1_HTTP_PRIVACY_ACCEPTANCE.md) retains 52 read-only baseline cases with all seven owners and 17 tables unchanged. Twenty role/protection/revocation and twenty-four visibility/deletion cases also pass. A detected post-migration legacy-row deletion defect is corrected; thirteen fresh HTTP lifecycle cases prove preservation, cache purging and deleted-file refusal. Remaining version/device, broader security/data and reference-performance combinations are open. These are bounded results, not blanket acceptance. |
| Deliver and accept | Publish a reviewed extension-only release candidate with exact-commit CI, installation/upgrade directions, the test matrix and explicit remaining limitations. The owner then completes the charter acceptance scenarios. | Intermediate code is being preserved publicly. Milestone 1 has not passed. |

The native HTTP checkpoint also closes a demonstrated request-limit bypass in
six page-owned read paths. Existing information/render quotas now refuse work
after exhaustion, while metadata remains independent of the render budget.
Configured limits, permissions and UI are unchanged. This bounded correction
does not close the broader security-review package.

Ready **for owner testing** means the integrated candidate and technical checks
above are complete. **Milestone 1 accepted** additionally requires the owner's
acceptance. Neither waits for milestone 2–5 functionality.

[Performance](PAGE_HISTORY_PERFORMANCE.md) records five 100-layer
Saves at 98–122 ms and exact historical-page responses at 97–447 ms on local
disk, within the one-second server budget. The separate browser checkpoint records
97.7 KB gzip of Layers modules, no Layers modules on a plain page, warm image paint
at 93–100 ms, warm editor opening at 187–202 ms, roughly 60 frames/second with
100 layers and a 16.4 ms maximum typed-character delay. These pass their respective
budgets on the recorded desktop. The controlled follow-up with production logging
passed five fresh-browser visits at 254–273 ms on a warmed server. The reusable
read-only benchmark passed another five at 274–296 ms. Earlier slower observations
remain retained; cold-server, reference-device and the other performance
combinations remain open. [Release preparation](RELEASE_PREPARATION.md)
tracks generated-output cleanup, the remaining documentation audit and the
explicit upgrade/recovery instructions; these are delivery work within this
milestone, not additional product scope.

The native twenty-slide check now defers offscreen vector/text painting: two sets
paint initially on desktop and three at the narrow viewport, with all twenty
correct after traversal. Geometry, overlays, keyboard activation and Print
preparation are preserved. No long task was reported during either traversal;
the observer detected a deliberate 240 ms control. This is bounded PERF-6
qualification; asynchronous image/SVG preparation and the other media/device
combinations retain their separate scope in the performance report.

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
