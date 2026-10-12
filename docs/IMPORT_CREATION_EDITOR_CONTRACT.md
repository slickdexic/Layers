# Import before a layer set's first Save

This advances milestone 1: page ownership, native history, independent Import
and preservation of local work. Missing image and slide layer sets use the
existing approved Import preview, with Undo/Redo and recoverable drafts.

Native editor admission supplies the exact saved embed's UTF-8 byte offset
and text as internal `creationSelection` data. Authors keep writing only the
file or slide and layer-set name. The admitted empty member stays separate
from the genuine stored base; an absent Layers slot is explicit null in native
reads. No virtual member is presented as a stored historical member.

Creation reads use the registered private POST route. The client retains
complete native source/base metadata, including unknown values, renditions and
unavailable siblings, and repeats authorization through the native boundary.
The editor compares owner, revision, exact selection, original admitted member
and complete saved base before applying a preview. Changes to live editor,
history or selection participants during asynchronous work cause refusal.

Import remains local until Save. The existing planner allocates independent
layer IDs and preserves groups and reading order. An empty slide takes the
source canvas; Append and Replace in a populated working copy preserve its
canvas. Image identity and native source pin remain those of the target.

The initial new member has no saved Undo entry. Drafts retain working history
and pending source claims; recovering in another editor revalidates those
claims before synchronously applying the prepared state. Undo before first
Save does not fabricate a saved native member. A refused or uncertain Save
keeps local content, history and source attribution and is never retried.

First Save with active imported content uses the native creation publication
route with CSRF, native rights/rate limits, exact embed selection and complete
source claims. Native publication creates one owning-page revision and places
source citations before the editor note. Only confirmed publication establishes
the stored member and acknowledges captured claims. Later edits remain dirty.
Subsequent Import reads and Saves use the existing stored-member boundaries.
If all imported work was undone, ordinary creation Save remains available.

The existing stored-target path, tools, Copy action and preview wording are
preserved. No new deployment backend, schema, shared live association or
configuration switch is introduced. This scope requires an existing current
owning page and the qualified literal direct embed. It excludes PDF Import,
expanded/nested admission and target rename during an imported first Save.
Those gaps are not claimed complete or silently enabled.

Client and native CLI qualification does not establish final HTTP/session
headers, browser/mobile, MediaWiki 1.44 or owner acceptance. Those checks and
the remaining milestone 1 work are required before product sign-off.
