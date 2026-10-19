# Whole-PDF Import revision checking

This advances Milestone 1 / HIST-4 / DATA-1 / UI-10 / SEC-2. The PDF-only Import
composition explicitly enables a private reconciliation route on the actual
editor bridge. Ordinary image, slide and non-opted PDF reconciliation keep their
existing implementation. Production editor callers and ResourceLoader
registration for whole-PDF Import remain inactive.

## Prepare before changing the saved base

Checking a revision must update the complete session and its private Import
history together. Updating the session first would leave group Undo, Redo and
draft capture referring to the previous saved base.

The binding reads the exact requested revision through the session's trusted
reader. It runs the existing PDF merge implementation on private session copies,
then transforms both sides of every reachable Import checkpoint. The new saved
base, current merged work, source claims and their scope, checkpoint contents,
page timelines, saved markers and routed group records are prepared before the
first live assignment. The complete participant witness is checked across each
await and after the final synchronous preflight callback. Session, state,
selection and history then commit synchronously before observer notifications.

Reconciliation accepts the existing ready, conflict and uncertain phases. It
does not freeze editor work while reads are pending. Intervening edits, page
turns, disposal, replaced methods or changed participants refuse the prepared
operation and retain the latest work. Concurrent revision checks refuse.

## History, sources and native identities

Disjoint server content is carried into the merged document and both checkpoint
sides. A genuinely new server-owned group page remains present through Import
Undo and Redo. Remote-only layer changes on an untouched page also rebase its
reachable timeline entries and group markers. Existing ambiguous merge rules
continue to refuse conflicting checkpoint sides. If an older timeline state
cannot be rebased safely, the entire revision check refuses before committing.
The same refusal applies when a previously stored group page is removed or
replaced under a different internal identity while its Import timeline remains
reachable. Local content, source claims, drafts and both history sides stay
intact. This does not refuse a native temporary blank solely because it has no
saved member.

When exact server group content already equals current local content, both
explicit Undo sides remain available. Formerly absent members use their exact
native blank origin when an earlier checkpoint lacks that member. Target edit
and source access are checked through a fresh native editor read, and retained
temporary origins are checked against their authorized historical revision.
No serialized ID or matching payload grants admission authority.

The current complete-group name is carried through checkpoint sides: undoing
Import changes its layer/content delta, preserving a separate pending rename.
This does not enable Import preparation after a pending rename; that boundary
remains separately qualified work before production activation.

Reconciliation re-scopes private source citations without clearing them.
Matching server content is not a publication acknowledgment. Only a successful
response from the captured publication route confirms the submitted content and
acknowledges sources. The next Save still performs native source, target and
historical-admission authorization. There is no automatic Save or retry.

## Drafts and refusal

The existing draft lifecycle saves a complete backup before discovering the
current revision, and persists the final ready, conflict or uncertain work
afterward. A storage failure refuses discovery/dispatch. Successful revision
checking leaves complete drafts recoverable in another actual session, with
source citations and usable group Undo/Redo. Earlier backups remain intact.

Wrong revisions, changed source pins, another owner, missing anchors, denied
reads and overlapping changes refuse without advancing saved markers or private
checkpoint scope. A disposed session keeps its existing cleanup state; a late
read cannot revive it. Notification failures after a complete commit are
diagnostics, not a reason to repeat or roll back the committed transaction.

Client qualification does not establish native HTTP/browser, supported-version,
mobile, upgrade or owner acceptance. Pending-name preparation and creation of a
completely absent target group also remain activation prerequisites. Existing
controls, wording, image/slide Import, ordinary PDF editing and viewing stay
unchanged.
