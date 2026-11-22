# Draft recovery: continue, discard or cancel

Approved November 18, 2026: the owner selected **Approve revised recovery flow**
after reviewing Continue draft, confirmed Discard draft and open saved version,
and Cancel returning to the page. This replaces the earlier unapproved proposal
to preserve declined drafts while continuing editing.
Advances HIST-4, DATA-1, DATA-3 and UI-7.

## What editors see and do

Keep the existing **Recover local layer edits** dialog, layer set context,
bounded preview and multi-draft selection/review. At the recovery decision,
present these actions in this order:

| Action | Result |
| --- | --- |
| **Continue draft** | Restore the selected local draft and its supported editing history, then continue editing. Ordinary Undo/Redo, new backups and explicit Save work. Restore itself never publishes. |
| **Discard draft and open saved version** | Ask for explicit discard confirmation. On success, delete only the selected local backup, load the latest authorized saved layer set, and initialize a normal editor with working Undo/Redo, new backups and Save. |
| **Cancel** | Preserve every draft and return to the owning page without entering an unusable editing session. Escape and closing recovery have the same result. |

For multiple drafts, **Review this draft** keeps its existing role. Discard
applies only to the reviewed draft. Other drafts, active editing sessions,
saved page revisions and unrelated layer sets remain intact. A changed backup
must be reviewed again before deletion. Failure to delete or load the saved
version preserves recoverable work and refuses a successful discard/open result.

Readers see no change. Images, slides and PDFs keep their tools, viewers,
controls and page entry points. Restoring an interrupted/uncertain Save retains
its existing Check saved page/reconciliation safeguards. Discard does not undo
a page revision: its fresh saved-version load and later Save still require the
normal native permissions, source, exact-base and conflict checks.

## Exact wording and replacements

Replace **Restore local edits** with **Continue draft** at the recovery decision.
Replace **Keep drafts unchanged** there with **Discard draft and open saved
version**, and add the separate **Cancel** action described above.

Introductory text:

> Choose whether to continue your local draft or discard it and open the saved layer set. Continuing a draft does not save a page revision.

Discard confirmation:

> Discard this local draft? Its unsaved edits will be deleted. Saved page revisions and other drafts will not be changed.

Confirmation actions: **Discard draft** and **Cancel**. Cancelling this
confirmation returns to recovery and deletes nothing. Its destructive action
is never the default focused control. Replace the old reopen-before-Save
cancellation explanation with:

> Cancel keeps your drafts unchanged and returns to the page.

Keep the existing Save reminders, interrupted-publication warning, themed panel,
scrollable preview, keyboard focus treatment and narrow-screen action layout.

## Verification required

Reproduce the reported current-revision Keep/gradient failure before repair.
Then exercise Continue and confirmed Discard through repeated gradient edits,
Undo/Redo, native Save and reopen using real browser storage on 8080. Verify
only the selected unchanged backup is removed and that new backups work. Check
selection/confirmation cancellation, Escape, multiple drafts, changed records,
storage failures, interrupted Saves, images, slides and whole PDFs. Inspect
screens before calling the UI complete. The owner's open editor is not a fixture.

## Verification record — November 18, 2026

The permanent browser journey passes on the maintained MediaWiki 1.45.3 wiki at
8080. In one browser context it creates a draft, continues it, uses Undo/Redo,
saves, confirms and cancels Discard, discards only the reviewed backup, edits
again, saves and reopens exact gradients, and cancels recovery back to the page.
Source backups and saved unrelated content are checked. No uncaught script
errors occur. The dedicated fixture is restored afterward.

Desktop and 390-pixel layouts and the destructive confirmation were inspected.
Affected recovery/storage/PDF startup tests pass, including changed records,
two-store deletion, rollback, preserved other drafts, native-entry refusal and
the existing modal return path. Lint/style, message wiring, documentation and
source/bundle budgets pass. Hosted exact-commit results are recorded separately.

The same journey exposed gradient comparisons treating native object-key
ordering as a change after Save. The repair compares values independently of
key order and retains the guards against changed gradients and detached controls.

## Failed destination after confirmed Discard — November 21, 2026

HIST-4 and DATA-1 require the reviewed backup to survive failure to open the
saved editor. The source now leaves the draft in its original store through
navigation. A one-use, tab-scoped record identifies the exact destination,
reviewed writer, storage locations and content digest. The ready destination
checks the reviewed copies again before removing them. A different draft from
the same writer or another tab stays available for review. The handoff carries
fixed-size digests even for large IndexedDB backups.

The maintained 8080 regression toggles an existing layer's visibility with
the keyboard in a slide, an image and a saved PDF. It waits for the timed
backup before reloading and confirming Discard. The PDF check exposed that
visibility edits mutated the layer without notifying draft subscribers.
The visibility control now sends one layer update after applying the change
to the layer and any affected children. After a successful preliminary request, the
test returns HTTP 503 for the destination document. The backup survives
byte-for-byte. A healthy reopen and a second confirmation load the saved
state and remove the reviewed copy. The saved revision and slot hashes match
throughout. The test also covers Escape inside discard confirmation and
checks that the editor issues no content writes.

## Basis for the recommendation

Microsoft Word's documented recovery flow allows opening recovered work,
explicit deletion with confirmation, or retaining recovery files for later.
This supports distinct continue/discard/cancel actions; it is an example of
established product behavior, not a universal industry standard.
See [Microsoft's recovery guidance](https://support.microsoft.com/en-us/word/recover-your-word-files-and-documents).
