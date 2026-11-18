# Earlier image and slide creation recovery

After native admission of an unsaved image or slide layer set, the existing
recovery dialog can also offer eligible local drafts from earlier revisions of
the same owning page. Current-revision drafts keep their order and labels;
eligible earlier drafts follow them. Stored-member and PDF recovery keep their
existing paths.

Discovery never selects another writer or changes a backup. Historical native
association, exact source version and geometry, current saved siblings, and all
retained Import citations, including Redo, are checked before a preview is
offered. Unprovable drafts remain intact. Previews are bounded plain text.

Reviewing is separate from Restore. Explicit Restore repeats current admission,
every retained source, and the complete historical/current native proof before
synchronously applying the session, layers, selection and Undo/Redo history.
Closing the editor or changing live work during any read refuses the operation.
No automatic Save occurs. An explicit Save uses the current owning-page revision
and its normal publication checks.

Owner-approved November 18: the [recovery choices](KEEP_DRAFTS_EDITING_BEHAVIOUR_BRIEF.md)
now provide Continue draft, confirmed Discard draft and open saved version, and
Cancel returning to the owning page. Discard removes only the selected reviewed
backup. Cancel and Escape preserve backups and do not enter an uninitialized
editor. Continuing an interrupted or uncertain Save retains its publication
hold and the existing Check saved page workflow. Refusal keeps newer work and
backups intact and reports the localized recovery failure.

This flow advances milestone 1 / HIST-4, HIST-1, DATA-1, SEC-2 and UI-10.
Automated qualification and controlled screens do not establish native HTTP,
browser, mobile, MediaWiki 1.44 or owner acceptance. Whole-PDF Import and the
broader page-history milestone remain separate.

## Recovery dialog presentation

The dialog identifies the selected layer set when its name is available,
explains local browser storage, and labels its bounded layer-text preview.
Shapes and other non-text layers are not represented by that text preview.
Earlier-revision recovery explains what Restore applies, what current page
content it preserves, and why Save remains explicit. Publication holds retain
their warning and the Check saved page action. Current and earlier cancellation
explanations match their existing safeguards.

The themed panel follows the Import dialog. Its heading and actions remain
visible around independently scrollable draft content. Narrow layouts stack
the existing buttons, with visible keyboard focus and touch-sized targets.
The November 18 amendment changes the decision actions and cancellation results
as linked above. Selection order, bounded preview, safe initial focus and native
publication checks remain. Names and preview text
are inserted as plain text; private identifiers and guessed dates are omitted.
Browser/mobile/owner acceptance remains separate from automated client checks.
