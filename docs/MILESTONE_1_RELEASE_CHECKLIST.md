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
| Complete PDF Import in the editor | The approved catalog/dialog imports a complete PDF layer set into a missing target. One Undo reverses Import; Redo, page turns and drafts preserve every member and its source association. The approved version notice is shown when required. | Creation and saved sessions now preserve group Undo/Redo, source references, draft recovery and both Save routes through confirmed first-Save handoff in client integration checks. The actual native editor startup now connects the approved catalog/dialog and persistent version notice in client checks. The desktop native Import, group Undo/Redo, first Save, owner return, overlay reopen, history/diff and complete annotated Download passed in bounded scope ([native checkpoint](PDF_IMPORT_NATIVE_ACCEPTANCE.md)). Recovery Save also passed, but subsequent in-place Save exposed an unfinished creation-to-saved handoff. The complete native journey remains open. |
| Finish Save and recovery | First Save records source attribution in one owner-page revision. Reopen and saved-session handoff work. A refusal preserves work; a lost response cannot mark unsaved work as saved or cause duplicate publication. Current and earlier drafts recover safely, including after the attempted Save advanced the page. | Known-success handoff and subsequent grouped Save/recovery pass client integration checks. Native publication and unchanged-base recovery are qualified in bounded scopes. Native request evidence, rollback and retained-session lost-response Check/reconciliation now pass native/client qualification. Reloaded creation-backup recovery now passes controller/lifecycle/dialog client qualification. Actual native startup now connects first Save, lost-response Check, durable handoff and earlier-backup recovery in client checks. Complete native browser acceptance remains open. |
| Qualify complete native journeys | Images, slides and PDFs complete create/edit, Save, owning-page return, reopen, history/diff/restore, scoped rename/copy/Import, recovery/conflict and viewer/export journeys. Same names on different owners/files remain independent. | Many bounded native journeys pass. The complete missing-PDF Import journey and combined release acceptance remain open. Reuse valid prior evidence; repeat only what integration affects. |
| Qualify the release candidate | Upgrade a 1.5.x wiki without losing layer sets; test declared MediaWiki 1.44 and 1.45, desktop/mobile and keyboard access; verify permissions, HTTP privacy, relevant security/data checks and charter performance budgets. | Still open in combined release scope. Historical results are evidence, not current blanket acceptance. |
| Deliver and accept | Publish a reviewed extension-only release candidate with exact-commit CI, installation/upgrade directions, the test matrix and explicit remaining limitations. The owner then completes the charter acceptance scenarios. | Intermediate code is being preserved publicly. Milestone 1 has not passed. |

Ready **for owner testing** means the integrated candidate and technical checks
above are complete. **Milestone 1 accepted** additionally requires the owner's
acceptance. Neither waits for milestone 2–5 functionality.

Work proceeds through these packages to completion. New internal helpers must
close a named gap in one of these journeys; they do not create additional scope.
Do not run unchanged full suites repeatedly or grow evidence machinery as a
substitute for integration. Retain meaningful regression and data-preservation
checks, existing work, private data and reviewable extension-only commits.

Ordinary page embeds display their content and approved overlays. They do not
add owner/revision information above slides, images or PDF pages. The owner
explicitly requested removal of the slide caption on October 21. Dedicated
history/diff views retain their appropriate revision context.
