# Entry on an unstored page of a PDF layer set

This entry path advances page ownership/history (HIST-4, HIST-1, HIST-6) and
overlay entry (UI-10). A focused native gate passed 97 tests / 1,128
assertions, and a native desktop fixture verified the empty target page and
stored-page separation. Full native and browser release acceptance and owner
approval remain pending.

A PDF layer set may contain layers on some pages while another page remains
unstored. A native embed of that untouched page can still show the agreed
viewer and editor overlays. The layer-set name identifies the set across the
PDF; page number identifies a member within it.

## Exact source and read-only viewer

The marker is admitted from the current owning page revision, exact file title,
and normalized visible layer-set name. It resolves the requested page from the
same archived, visible PDF source pin as the stored set. It does not use the
current upload as a substitute, and it refuses conflicting members, an already
stored requested page, or a source/page that cannot be verified. `noedit` is
kept on the individual embed occurrence and suppresses only its edit control.

The viewer read accepts an optional `viewpage` alongside its exact owner,
revision and stored anchor binding. For an unstored page, its display DTO
contains that page's source pin, canvas and rendition, separate from the
stored `pages` inventory. It creates no surface ID, layer payload, or stored
member. Existing set members and their layers remain unchanged. The response
uses the viewer's private, zero-age read policy and normal history and source
authorization.

## Saved-session editor entry

The editor first prepares its session from an existing stored member, keeping
that member as the stable anchor and preserving the saved base snapshot. It
then validates the requested page against the same exact PDF pin and supplies
it as the session's entry page. The editor reads that page's source geometry
and rendition through the existing PDF-page read path; this does not insert a
temporary member into the base or save anything. Save still targets the native
owner page and its current authorized revision. A wholly missing set continues
to use the separate creation path.

Stale revisions, unauthorized or out-of-scope owners, invisible or changed
source pins, invalid pages, and inconsistent layer-set members fail closed.
The inline archived rendition suppresses the host image's current-upload
`srcset` and `sizes` while active, then restores them on teardown if they have
not been replaced externally. The viewer remains read-only; editing requires
normal edit admission. Browser qualification against an independently changed
archive and owner acceptance remain pending.
