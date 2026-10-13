# Historical creation draft read API

The read-only POST action `layersworkingcopyimportcreationdraftrebase` proves a
pending image or slide layer set's historical association with its owning page
and freshly admits the unchanged embed at an explicit current page revision.
It supports page ownership, native revision history and safe recovery. It does
not apply a backup, save layers, publish a revision or grant write authority.

## Request

All four parameters are required:

| Parameter | Meaning |
| --- | --- |
| `targetpageid` | Existing native owning-page ID. |
| `baserevid` | Exact current owning-page revision to revalidate. |
| `originrevid` | Exact readable historical revision on the same page. |
| `originsurface` | Canonical internal pending-member ID admitted at that historical revision. |

Revision and page IDs are positive bounded integers. The native service derives
the original literal embed and byte offset from the historical revision; the
request cannot supply replacement text, a layer-set name or a claimed offset.
The internal ID is never an author-visible layer-set name or wikitext parameter.

## Response and refusals

The action returns the established `{ origin, creation }` contract under its
registered module name. `origin` identifies the exact historical owner revision,
pending ID and native embed selection. `creation` contains fresh current
admission, the genuine stored base or absent-slot null, and a separate empty
pending member. Current siblings remain intact. This is admission evidence,
not an imported payload or a historical source-pin guarantee.

The route repeats the native service's complete historical capture and current
admission checks, current edit authority and historical visibility. Ambiguous
historical occurrences, forged or foreign IDs, changed embeds, stale current
revisions, stored-ID collisions and unavailable revisions refuse without a
successful result. A reader without edit authority cannot use the route.
The request is POST-only, read-only and token-free. Native API cache mode is
private with zero maximum age, including parameter and service refusals.
Final HTTP headers still require separate HTTP qualification.

## Integration boundary

The route is registered through the supported lazy MediaWiki API factory. It
does not activate editor callers, prior-base draft discovery or application.
Existing explicit-selection re-admission retains all its required parameters.
Before applying any recovered work, a caller must compare retained original
admission, source pin and geometry, freshly revalidate all participating editor
state, and keep failed or unprovable backups intact. Whole-PDF creation Import,
browser/mobile acceptance and supported-version qualification remain separate.
