# Native creation Import API contract

These routes advance milestone 1: missing-target image/slide Import saves into
the owning page's native revision history, with independent source provenance.
The registry and factories are additive. Existing read/publication contracts,
editor callers, UI, schema and embed syntax remain unchanged.

`action=layersworkingcopyimportcreationread` is a read-only POST route. It needs
`targetpageid`, `baserevid`, `targetsurface`, `embedstart`, `embedtext`,
`sourcepageid`, `sourcerevid` and `sourcesurface`. IDs are internal references;
the author never adds them to wikitext. The offset is a UTF-8 byte offset and
the text is the exact complete saved literal embed. POST keeps that text out
of a read URL. Reading does not require a CSRF token and does not publish.

Its three-field result contains the genuine creation admission, exact native
source descriptor and complete source bundle. An absent target Layers slot is
explicit null; the virtual empty member remains separate from stored history.
Native authorization, identity, scope, source visibility and capture checks
run anew. A stored member cannot use the missing-target route.

`action=layersworkingcopyimportcreationpublish` requires native POST/CSRF and
the `editlayers` right, applies the existing `editlayers-save` limiter, and uses
the original requesting authority. It accepts the same five target/embed
parameters, `data` (complete proposed snapshot), `importsources` (JSON list of
1–32 source descriptors) and optional `summary` (editor note). Each descriptor
has exactly `sourcePageId`, `sourceRevisionId` and `sourceSurfaceId`; the target
is supplied once. Duplicate JSON keys, including equivalent escaped names,
refuse before publication. A simultaneous `maintext` parameter also refuses.

The qualified native creation service enforces compatibility and preserves
main text, admitted identity/name/image pin, every sibling and complete source
captures. One cancelable native transaction spans final preparation, Save and
post-Save validation. Success returns `result: Success` and `revid` under the
requested module name. Source citations precede the editor note; no retry or
summary truncation occurs.

Both modules set private, zero-age native API cache policy in construction and
execution. Native CLI tests validate that policy and request behavior, not
final HTTP headers or MediaWiki session middleware. Parameters are bounded:
positive native IDs/current base, nonnegative byte offset, 128-byte internal
member references, document-size embed/snapshot fields, 16,384-byte source list
and 500-character note. Native admission imposes its stricter ID/name rules.

The existing native extension callback installs lazy definitions and refuses
the whole registration on any module-name collision. No new switch, table,
worker or deployment backend is introduced. Before migration completion,
native missing-target admission remains unavailable.

Editor/history/draft integration, actual HTTP/browser/mobile and MediaWiki
1.44 acceptance remain open. This scope excludes PDF Import, expanded/nested
embeds, new wiki pages, unrelated sibling edits and first-Save target rename.
These API routes alone do not complete milestone 1 or activate Import UI.
