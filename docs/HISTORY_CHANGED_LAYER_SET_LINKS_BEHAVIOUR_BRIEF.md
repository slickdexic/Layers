# History links for changed layer sets

Advances Milestone 1 / HIST-3 / HIST-4 and the owner's request to avoid
unrelated layer-set links in page history. **Approved by the project owner.**

## What readers see

A page-history row shows the existing `View Layers: <name>` link only for each
layer set added or changed in that revision. Editing layer set `005` shows
`View Layers: 005`, not links to every other set saved on the page. A normal
text-only page revision adds no layer-set View links. If several independent
layer sets changed, each is represented. A multi-page PDF is one layer set;
when its pages change together, one link opens a changed page of that set.
Identical names belonging to different files, slides or owner pages remain
independent. No internal page IDs appear in the labels.

For a deleted set, there is no new version to view. The existing link to its
previous version remains where available through the current Undo action. If
the prior or current revision cannot be read, the row must not expose private
labels or infer changes from incomplete information. A first revision with no
parent treats the accessible current sets as additions.

## What editors see and do

Existing change summaries, tags, native page-history controls, permissions,
`undo layer set: <name>` links and historical viewer controls stay as they are.
The View link keeps its existing wording and opens the exact saved revision;
no additional heading, menu or confirmation is added. All unchanged sets remain
available from their own relevant history entries and through the existing
page/editor entry points. If a set was renamed, the new-version link uses its
saved name and the existing Undo action points to its previous version.

## Approval and acceptance

The project owner approved removing unrelated View links from history rows.
Test additions,
edits, removals, renamed sets, multiple changes, same-name different sources,
multi-page PDFs, text-only edits, inaccessible revisions and initial history.
Keep the original revision, owner and permission checks. Verify the actual
history presentation in MediaWiki 1.45 and the supported 1.44 candidate.
