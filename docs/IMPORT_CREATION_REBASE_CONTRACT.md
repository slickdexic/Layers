# Native re-admission before a layer set's first Save

This advances milestone 1 / HIST-4, HIST-1, DATA-1 and SEC-2. An unsaved image
or slide member has an internal ID derived from its opening page revision.
After another edit advances that page, retaining the old ID does not satisfy
current creation admission. No historical member or revision is fabricated to
make the old ID appear stored.

The registered `layersworkingcopyimportcreationrebase` route is a read-only
POST. Its request identifies the owning page, explicit current revision,
opening revision, original unsaved member ID, and exact original embed text
and UTF-8 byte offset. The original requesting authority must be authenticated
and currently allowed to read and edit the owner within the page-owned scope.
The historical revision must be readable and belong to that same page.

Native saved source proves that the opening embed selected a genuinely missing
member and that its computed opening ID matches. The unchanged literal embed
must still occur as a supported top-level embed in current saved source.
Removed, changed, opaque or nested occurrences do not substitute for it.
Current creation admission repeats through the existing editor/creation
preparer. A stored target, old-ID collision, stale current revision, denied
authority or inconsistent capture refuses with a fixed unavailable result.

The response has two separate fields:

- `origin`: page ID, opening revision, old member ID and original selection.
- `creation`: the existing five-field creation admission, with the current
  canonical member ID and selection, genuine current stored base bundle or
  explicit absent-slot null, and separate empty native member.

Complete captures repeat. API policy is private with zero cache age, including
refusal. The route does not publish, accept a snapshot, require a write token,
modify a working copy, or expand the existing publication route's admission.
Existing creation read and Save continue to require the current canonical ID.
Native first Save from that admitted base still creates one owner revision,
preserving main text, complete siblings and source citations.

No editor caller uses this new route yet. Integration must compare the original
member kind and source pin, revalidate retained Import provenance, and prepare
the complete session, Undo history and draft identity privately. Only after
fresh live-work checks may those participants be rebound synchronously to the
current canonical ID. Refusal must retain all local work. The response grants
no authority to apply or publish later, and no automatic Save/retry is allowed.

The qualified scope is the native CLI read boundary and its compatibility with
existing creation publication. Atomic editor reconciliation, drafts across
that transition, final HTTP/session headers, browser/mobile, MediaWiki 1.44 and
owner acceptance remain open. PDF Import, imported first-Save rename and
expanded/nested creation admission are separate remaining milestone work.
