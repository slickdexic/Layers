# Whole-PDF Import source discovery

This boundary advances Milestone 1 / HIST-4 / DATA-1 / SEC-2. The native
`layersworkingcopypdfimportcatalog` read action lists other eligible pages'
current PDF layer sets. Existing copy and image/slide Import catalogs retain
their established response formats and behavior.

## Identity and matching

Each choice belongs to one owning page, canonical file title and normalized
layer-set name. Internal PDF page numbers select members inside that set; they
never create separately named layer sets. The lowest stored PDF page supplies
a deterministic internal source anchor. Another file or owning page may have
its own layer set with the same name.

All members of an offered group must have one exact label spelling, unique
internal pages and IDs, and a common retained source version after removing the
PDF page number. Mixed upload versions, ambiguous groups and incompatible kinds
are omitted as complete groups. They are never split into extra choices. Visible
exact file versions are resolved without creating thumbnails; unavailable or
denied files omit their groups while independent groups remain eligible.

## Native request and response

The action requires a named user with `editlayers`, applies the existing list
rate limit and sets private zero-age API caching in its constructor and execute
path. Required `exclude` is the current owning page ID; `search` is a bounded
page-title prefix and `limit` is at most 20 pages. Native discovery examines at
most 40 candidates through the existing MediaWiki query. No content is written.

The response is a version-1 envelope with an ASCII JSON `data` string. Decoding
that string gives `pages`, each with `title`, canonical `owner`, `pageid`, exact
current `revid`, and `layerSets`. Each layer-set entry contains only its internal
anchor `id`, visible `label`, `kind: pdf`, anchor `canvas` width/height, and
canonical `fileTitle`. It includes no layers, file paths or source-version pins. Escaping Unicode inside
the ASCII envelope preserves exact stored spelling through native API formatting.

`PageOwnedWholePdfImportCatalogClient.search({search,target})` accepts a PDF
matching target with `pageId`, `kind`, `label` and `fileTitle`. It returns the
existing picker choice shape, including the four-field source descriptor
`{owner,pageId,revisionId,surfaceId}`. Names match by the existing spacing,
underscore and case rules; files match exactly. Target and source versions need
not be equal. Invalid, ambiguous, superseded or disposed results refuse.

## Authority and integration

A choice is detached discovery metadata. It never authorizes Import, editor
mutation or Save. The selected `layersworkingcopypdfimportread` call must freshly
resolve and authorize both complete groups, including the target's current base,
source visibility, exact retained versions and missing member admissions.

The native catalog is registered; editor/picker callers and the separate client
remain inactive until the approved full-PDF composition is qualified. No new
visible controls or wording are introduced. Native/browser Import, supported
reconciliation and missing targets, final HTTP/session headers, mobile,
supported-version/upgrade and owner acceptance remain separate Milestone 1 work.
