# Restore a historical whole-PDF layer set

**Status:** Approved and implemented, November 19, 2026; bounded 8080 verification passed.
**Advances:** HIST-3/HIST-4 (history and restoration), TYPES-4 (PDF journey)
and DATA-1 (preserve unrelated content).

## Confirmed problem

The owner successfully edited several PDF pages, saved, downloaded the annotated
PDF and rolled back the edit. The saved historical PDF still displays, but its
Restore this version action is absent. Read-only inspection on the maintained
8080 wiki confirms that rollback removed the newly added page members. The
current restore planner requires the selected historical member's internal ID
to remain in the current snapshot, so it refuses to offer restoration.

The planner also replaces only one member. That does not implement restoration
of the owner's approved single layer set covering the whole PDF. The reported
case has an unchanged page 1 and removed page 2/page 3 members; all three remain
available in the historical revision. No owner-page content was changed during
the investigation.

## Approved editor behaviour

1. In native page history, open the existing View Layers: <name> link for the
   revision containing the wanted changes. The historical viewer retains its
   existing PDF navigation and shows that exact saved version.
2. Offer the existing **Restore this version** action when the complete saved
   PDF layer set differs from the current one, including when Undo/rollback
   removed some or all of its stored page members. Opening an identical version
   remains a read-only view with no redundant restoration to submit.
3. Restore the complete selected PDF layer set from that revision in one new
   native owner-page revision. Include its stored page members and exact source
   associations; remove current-only members of that same set so the result is
   the selected saved version. Page text and other layer sets remain unchanged.
4. Resolve identity within the same owning page using the historical PDF file
   and layer-set name, following the existing whole-PDF identity contract.
   Reject conflicting identities instead of guessing or overwriting another set.
5. Retain the existing introduction, button wording, saved edit summary and
   return to the owning page. Historical revisions remain available afterward,
   including the version replaced by this restoration. Other history controls
   keep their existing presentation.

## Admission and verification

Existing edit/read permissions, hidden-revision checks, exact-source validation,
CSRF protection and current-base conflict refusal apply. A stale or invalid
restore publishes nothing and keeps existing content. There is no automatic
restore or retry.

Reproduce the absent action on an isolated PDF fixture with an unchanged first
page and two newly annotated pages removed by rollback. Verify the offered
historical action, one-revision complete restore, exact page/source values,
unrelated content, reopened viewer and annotated PDF download. Cover a changed
second page when the selected first page is identical, current-only members,
the whole set being absent, repeat/no-op views, stale forms and denied readers.
Retain image and slide restoration behaviour. The owner's page remains a
read-only diagnostic source unless the owner explicitly requests its restore.

## Approval

The owner approved the documented complete-set correction: “Approve the
whole-PDF restore fix”. This authorizes making the existing historical action
available for missing PDF members and restoring the selected whole layer set.

## Implementation and verification

The restore planner groups stored PDF members by the existing owning-page,
file and layer-set identity. It restores the complete historical membership,
including absent members, removes current-only members, and retains unrelated
members and their relative order. It refuses duplicate page identities, mixed
name spellings and historical IDs now held by another set. Image and slide
restoration keep their existing behaviour. Publication still uses the native
publisher with exact source, permission and base-revision admission.

Five native regression cases fail against the prior planner. The corrected
planner and existing restore forms pass 14 native tests / 131 assertions,
including missing members, absent sets, unchanged selected pages, current-only
members, recreated IDs, stale forms, renamed-ID collisions, hidden history and
denied source reads and equivalent reordered numeric member IDs. Both restore
suites now run in the hosted native selection.

The permanent browser journey runs only against an explicitly provisioned
synthetic acceptance owner. On 8080 it follows the native history View link,
submits the actual Restore form, checks exactly one new revision and exact PDF
values, preserves later unrelated edits, and verifies no redundant or anonymous
restore action. The pre-rollback and restored annotated downloads are identical
84,483-byte PDFs. The exact fixture baseline is restored afterward. The new
synthetic asset exposed a root-owned thumbnail hash directory; correcting that
single test-environment directory's ownership restored normal web-server writes
without changing source PDFs or layer data.

Read-only inspection of the owner's reported historical revision confirms the
Restore action is now present; the owner page remains at its rollback revision.
The implemented screen is supplied for review. These bounded results leave the
remaining overall v1.8 acceptance items open.
