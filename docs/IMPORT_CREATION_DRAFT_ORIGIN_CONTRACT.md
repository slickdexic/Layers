# Retained creation draft context

Advances milestone 1 / HIST-4, HIST-1, DATA-1 and SEC-2. This is preparation for
authorized recovery after the editor closes and the owning page changes.

The pending creation member ID belongs to its opening page revision. A draft's
layer-set label and local storage key cannot prove its relationship to a newer
native page revision. Existing draft envelopes also lack the exact raw embed
selection and original native empty member needed to retain source identity.

Creation Import backups now carry an optional `creationOrigin` field outside
the existing working-copy/history payload. It contains version 1, the original
page ID, owner, revision, member ID and exact UTF-8 byte selection, the original
admitted empty member including its native source pin, and the native Layers
slot-presence flag. These are detached finite JSON values from the retained
session admission, rather than the edited layers or imported source's pin.

Local layers, canvas, reading order, unknown properties, source citations and
Undo/Redo remain in the existing backup payload. Invalid but finite edits still
get backed up during ready, saving, conflict and uncertain phases. Successful
reconciliation records its newly admitted origin in the new draft scope while
retaining the previous draft. A confirmed first Save ends pending admission
and later stored-member backups omit this optional field. Existing Save backup
phase transitions and exact-base recovery remain unchanged. Older envelopes
without the field remain readable by the existing recovery path.

The new native `prepareCreationDraftRebase` helper is inactive: no registered
route, browser or editor caller uses it. It derives a unique eligible historical
direct embed from the exact original revision and canonical member ID, after
checking the same trusted page ID, readable history and fresh current editing
authority/scope. It requires the member and name to have been missing in that
historical Layers slot. It accepts no label or layer payload as association
evidence. Different files or slides sharing a name remain separate identities.

The helper composes the established explicit-selection creation re-admission
boundary. It compares complete historical main/bundle captures, repeats current
creation admission, and finishes with current authorization and historical
visibility checks. It returns the same historical origin/current creation
contract while keeping genuine native history separate from the empty pending
member. It writes no page revision, grant, draft or file.

Ambiguous historical occurrences refuse derivation; the established explicit-
selection route and repeated-embed editing behavior remain available. Nested,
expanded, changed or removed embeds, occupied names/IDs, foreign-owner revisions,
fabricated IDs, suppressed history and changed complete captures refuse.

Neither local origin hints nor this read response grant recovery or publication
authority. A future caller must revalidate every retained Import source,
compare the original native empty geometry/metadata/source pin, preserve the
current genuine base and prepare session/history/editor application privately.
Complete participant checks precede any synchronous commit. No automatic Save
or retry is permitted. Older envelopes lacking the original pin or geometry
must remain preserved when their association cannot be proved; this helper
alone does not qualify their recovery.

Prior-revision draft discovery, native request wiring, editor application,
actual HTTP/browser/mobile journeys and owner acceptance remain separate work.
Current UI, words, existing recovery candidates and publication contracts stay
unchanged. Whole-PDF Import, first-Save rename, expanded/nested admission and
MediaWiki 1.44 remain outside this checkpoint's qualification.
