# Working-copy Import publication API

This boundary advances milestone 1, HIST-4 and the approved first-Save source
citation requirement. It extends `layerspublish` through an explicit optional
`importsources` parameter. Existing requests keep their ordinary publication
path. Editor and Import UI callers remain inactive.

`importsources` is a JSON array of one to 32 objects, each containing exactly:

```json
[{"sourcePageId":9,"sourceRevisionId":42,"sourceSurfaceId":"source","targetSurfaceId":"target"}]
```

IDs are literal native identities, never authorization tokens. `owner`, `pageid`,
an existing `baserevid`, the complete proposed `data`, and the CSRF token are
required. The current owner title must still resolve to that PageID. Simultaneous
`maintext` edits are refused. The list is limited to 16,384 UTF-8 bytes; malformed
JSON, duplicate keys, object-shaped lists and malformed descriptors are refused.

The lazily composed native publication service verifies current target edit
authorization, historical source read access, owner/revision/member associations,
matching image file or slide name, target source pins and actual changed payload.
It derives each citation from native source labels, titles and revision IDs,
preserving the editor's note without silently truncating the complete summary.
Source checks repeat after native preparation and save hooks inside the accepted
cancelable database transaction. The ordinary snapshot and publication admission
checks remain in force. A refusal returns the fixed safe Import-unavailable error.

`PageOwnedPublishClient.publish()` accepts explicit `importSources` descriptors,
captures their primitive values before transport, requires a bound existing
target and refuses a simultaneous main-text edit. Omission keeps the existing
request shape. Native refusal is recognized without retaining diagnostic text;
uncertain transport outcomes are not automatically retried.

This transport does not certify client layer origins. Tracking pending citations
through actual Import, Undo/Redo, draft recovery and successful Save remains
separate integration work. Missing/new target members, whole-PDF Import, final
HTTP delivery, browser/mobile, MediaWiki 1.44 and owner acceptance are unqualified.
