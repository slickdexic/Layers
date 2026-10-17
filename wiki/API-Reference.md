# Action API reference

## Experimental page-owned revision APIs

`layersread` and `layerspublish` are now registered by the native extension callback, but disabled by default. They use an explicit retained owner scope. Normal editor saves still use legacy storage. The core merge API is replaced by a guarded adapter only with retained pilot owners. See [Current Status](Current-Status.md) for acceptance limits; this is not a production enablement guide.

The read contract requires an exact owner/revision and private zero-age caching. Publication requires native POST/CSRF handling and optimistic revision matching. Optional `pageid` asserts the existing owner identity (1–2147483647), is checked through native publication, and rejects mismatches or creation with `baserevid=0`. It does not grant permission or prove a surface binding. Existing pilot clients may omit it; bound-editor wiring remains in progress. Scoped editor/history and read-only inline slide workflows have acceptance evidence on the original test wiki; ordinary adoption and image/PDF binding integration remain unfinished. See the [publishing contract](../docs/PAGE_OWNED_API_CONTRACT.md).

Reviewed September 6, 2026 against the six modules in `extension.json`, their PHP implementations and the local wiki's `action=paraminfo` output. This describes current code, not the proposed page-owned API.

Use MediaWiki's `api.php` with `format=json`. From ResourceLoader JavaScript, wait for `mediawiki.api` and create `new mw.Api()`. Read endpoints require the applicable read access; writes require `editlayers`, applicable File-page edit authority, a CSRF token and rate-limit checks. Delete/rename additionally require creator ownership or **`layers-admin`**, not the ordinary `delete` right. Slides are not yet bound to SOP-page permissions; see [[Permissions]].

Never use a layer row ID as `oldid`. Responses and historical availability are affected by revision pruning. `layersinfo` may return `layerset: null`; handle that without treating it as a failed request. API errors appear under `error`; do not infer success from HTTP 200 alone.

## Actions and parameters

### layersinfo — GET

Read an image/PDF page or standalone slide and its Layers revisions.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `filename` | string | Not declared in metadata | Uploaded file title; a File: prefix is accepted. Use slidename instead for slides. |
| `slidename` | string | Not declared in metadata | Standalone slide name, without the Slide: storage prefix. |
| `layersetid` | integer | Not declared in metadata | Layers row ID, not a MediaWiki page revision ID. |
| `setname` | string | Not declared in metadata | Explicit set name. Omission selects the current set on applicable paths; do not assume a literal default set. |
| `limit` | integer | min 1; max 200 | Maximum results for this request. |
| `offset` | integer | min 0 | Legacy numeric offset; prefer the returned continuation. |
| `continue` | string | Not declared in metadata | Continuation returned by the previous response; return it unchanged. |
| `page` | integer | 1; min 1 | 1-based source PDF page; images use page 1. Not a wiki page ID. |

### layerssave — POST + CSRF

Save a layer revision for an image/PDF page or standalone slide.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `filename` | string | Not declared in metadata | Uploaded file title; a File: prefix is accepted. Use slidename instead for slides. |
| `slidename` | string | Not declared in metadata | Standalone slide name, without the Slide: storage prefix. |
| `data` | string | Not declared in metadata | JSON string; see payload example below. Required by layerssave. |
| `setname` | string | Not declared in metadata | Explicit set name. Omission selects the current set on applicable paths; do not assume a literal default set. |
| `page` | integer | 1; min 1 | 1-based source PDF page; images use page 1. Not a wiki page ID. |
| `token` | string | Not declared in metadata | CSRF token, supplied automatically by postWithToken. |

Save payloads must be a JSON array of layer objects, or an object containing a `layers` array of layer objects. `[]` and `{"layers":[]}` explicitly clear annotations. Scalars, `{}`, object maps and non-object layer entries are rejected with `validationfailed`; malformed JSON returns `invalidjson`. Post-1.5.95 main includes this guard. See the [save payload contract](https://github.com/slickdexic/Layers/blob/main/docs/SAVE_PAYLOAD_CONTRACT.md).

### layersdelete — POST + CSRF

Delete a named set and its retained revisions.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `filename` | string | Not declared in metadata | Uploaded file title; a File: prefix is accepted. Use slidename instead for slides. |
| `slidename` | string | Not declared in metadata | Standalone slide name, without the Slide: storage prefix. |
| `setname` | string | Not declared in metadata | Explicit set name. Omission selects the current set on applicable paths; do not assume a literal default set. |
| `page` | integer | 1; min 1 | 1-based source PDF page; images use page 1. Not a wiki page ID. |
| `allpages` | boolean | Not declared in metadata | Presence enables document-wide delete/rename. Omit entirely for a single page; do not send false/0 as a substitute for omission. |
| `token` | string | Not declared in metadata | CSRF token, supplied automatically by postWithToken. |

### layersrename — POST + CSRF

Rename a named set.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `filename` | string | Not declared in metadata | Uploaded file title; a File: prefix is accepted. Use slidename instead for slides. |
| `slidename` | string | Not declared in metadata | Standalone slide name, without the Slide: storage prefix. |
| `oldname` | string | Not declared in metadata | Existing set name. Required. |
| `newname` | string | Not declared in metadata | New set name. Required. |
| `page` | integer | 1; min 1 | 1-based source PDF page; images use page 1. Not a wiki page ID. |
| `allpages` | boolean | Not declared in metadata | Presence enables document-wide delete/rename. Omit entirely for a single page; do not send false/0 as a substitute for omission. |
| `token` | string | Not declared in metadata | CSRF token, supplied automatically by postWithToken. |

### layerslist — GET

List standalone slides by name prefix; this is not annotation full-text search.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `prefix` | string | Not declared in metadata | Slide-name prefix, not a text-content query. |
| `limit` | limit | 50; min 1; max 500 | Maximum results for this request. |
| `offset` | integer | 0; min 0 | Legacy numeric offset; prefer the returned continuation. |
| `sort` | created, modified, name | name | Slide sorting mode. |
| `continue` | string | Not declared in metadata | Continuation returned by the previous response; return it unchanged. |

### layersdrawings — GET

List other pages' current drawings that the editor may copy into the page being edited (D1). Requires the `editlayers` right and a named account, and shares the `editlayers-list` rate limit. Every page is read with the caller's own rights, so pages, revisions and files the caller cannot see are left out. The answer is private and never cached.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `search` | string | Empty; up to 255 bytes | Start of a page title, optionally with a namespace. Empty lists the pages edited last. |
| `exclude` | integer | 0 | ID of the page being edited, whose own drawings are not listed. |
| `limit` | limit | 10; min 1; max 20 | Maximum pages to list. |

Each page in `layersdrawings.pages` has `title`, `pageid`, `revid` and `drawings` (`id`, `label`, `kind`). The copy itself is confirmed on `Special:CopyLayersDrawing` with `pageid`, `sourcepage`, `sourcesurface` and `sourcerev`, which copies with a POST and the user's edit token.

### layerspdfexport — POST + CSRF

Generate a cached server-rendered PDF for an uploaded file. Standalone slides are not supported by this server endpoint.

| Parameter | Type | Default / range | Notes |
| --- | --- | --- | --- |
| `filename` | string | Not declared in metadata | Uploaded file title; a File: prefix is accepted. Use slidename instead for slides. |
| `setname` | string | Not declared in metadata | Explicit set name. Omission selects the current set on applicable paths; do not assume a literal default set. |
| `width` | integer | Not declared in metadata | Server render width in pixels; configured default and server limits apply. |
| `token` | string | Not declared in metadata | CSRF token, supplied automatically by postWithToken. |

## Read examples

```javascript
const api = new mw.Api();
api.get( { action: 'layersinfo', filename: 'Diagram.png', setname: 'annotations' } );
api.get( { action: 'layersinfo', slidename: 'SafetyProcedure', setname: 'instructions' } );
api.get( { action: 'layersinfo', filename: 'Manual.pdf', page: 2, setname: 'annotations' } );
api.get( { action: 'layerslist', prefix: 'Safety', limit: 20 } );
```

`layersinfo` returns layer data beneath `layersinfo.layerset.data`, with revision/set metadata. File responses include page-aware `baseWidth`, `baseHeight`, `imageUrl`, `page` and `pageCount`; use the supplied coordinate dimensions rather than assuming the thumbnail's natural size. Fields such as `named_sets`, `all_layersets` and `set_revisions` vary with request mode. Some booleans are serialized as 0/1; preserve false and zero-opacity values.

## Save payload

Example for a standalone slide; replace slidename with filename and page for file annotations:

```javascript
api.postWithToken( 'csrf', {
    action: 'layerssave',
    slidename: 'SafetyProcedure',
    setname: 'instructions',
    data: JSON.stringify( {
        canvasWidth: 1200,
        canvasHeight: 800,
        backgroundColor: '#ffffff',
        backgroundVisible: true,
        backgroundOpacity: 1,
        layers: [ {
            id: 'step-1', type: 'textbox', x: 40, y: 40,
            width: 500, height: 100, text: 'Isolate the equipment',
            fontSize: 28, fill: '#ffffff', stroke: '#000000'
        } ]
    } )
} ).then( ( response ) => {
    if ( !response.layerssave || !response.layerssave.success ) {
        throw new Error( 'The annotation was not saved' );
    }
} );
```

The data field accepts the supported layer-array or object-with-layers form. Send the object form when supplying background/canvas settings. Do not send JSON scalars: their handling is a known open issue. Only validated properties survive; inspect `ServerSideLayerValidator` for the current schema. `ownerId` is generated by the server and is not an assignable client field.

## Delete and rename scope

```javascript
api.postWithToken( 'csrf', {
    action: 'layersrename', filename: 'Manual.pdf', page: 2,
    oldname: 'draft-labels', newname: 'annotations'
} );
```

Omitting `allpages` confines the operation to page 2. A document-wide operation adds `allpages: true`, affects all matching PDF page sets, and checks every affected page's ownership under database locks. Delete removes retained revisions; confirm the intended scope in your application before submitting. Unknown legacy creator ownership requires `layers-admin` for destructive operations.

## Export

```javascript
api.postWithToken( 'csrf', {
    action: 'layerspdfexport', filename: 'Manual.pdf', setname: 'annotations'
} );
```

Use the returned delivery URL; do not construct a path into the export cache. `Special:LayersExport` rechecks source access and the cache filename binds the source title. Existing old cache files need regeneration. The server endpoint operates on the document rather than accepting a page parameter. Client lightbox print/download is a different path and can support slides. Failed pages and rendering-property limitations remain open: inspect critical output, even when the request reports success.

## Integration boundaries

No current parameter binds a set to a MediaWiki article revision, writes searchable annotation text, or creates Cargo annotation rows. These are proposals in [[Current Status]]. When integrating with a different deployed branch, inspect `api.php?action=paraminfo&modules=layersinfo|layerssave|layersdelete|layersrename|layerslist|layerspdfexport&format=json` and its source before relying on these contracts.

## Explicit save-name validation

On the local J01–J05 review branch (not yet merged to main), `layerssave` treats nonempty `setname` values as literal canonical identifiers, including `on`, `off`, `1` and `0`. Invalid or noncanonical names return `invalidsetname` before persistence; they are not stripped, truncated or redirected to the latest set. Omitted/empty names select the current set, or the validated `LayersDefaultSetName` seed when none exists. J17 extends the same canonical validation to info, rename (old and new names) and delete. Required mutation identifiers cannot be omitted. This is review-branch behavior, not a tagged release.

## Native working-copy Import read API

Added October 11, 2026 (J116K). This section describes the newly registered
native read endpoint, not activation of Import UI or editor callers. Earlier
dated sections above retain their historical scope and deployment statements.

### layersworkingcopyimportread - GET

Reads existing image/slide members through MediaWiki's native API module manager
and the `LayersPageOwnedPilot` service factory. This is a read preflight, not
application or publication authority. It creates no page revision and grants no
permission that survives the request. Whole-PDF Import is not supported here.

All six parameters are required. Page/revision IDs are integers from 1 through
2147483647; member IDs are strings of at most 128 UTF-8 bytes. Native page IDs
are internal transport identity, never author-facing wikitext or owner labels.

- `targetpageid`: native ID of the page owning the target layer set.
- `baserevid`: exact current target page revision; stale bases are refused.
- `targetsurface`: internal ID of the existing target image/slide member.
- `sourcepageid`: native ID of a different page owning the source layer set.
- `sourcerevid`: exact readable source revision, including readable history.
- `sourcesurface`: internal ID of the existing source image/slide member.

Each invocation freshly rechecks target ownership, current revision, scope,
ordinary page edit permission and `editlayers`, plus source read visibility and
exact revision/member identity. Equal owner IDs, wrong-owner revisions, missing
members, unavailable sources and out-of-scope targets are refused. No latest
revision or shared-set fallback is used.

With `formatversion=2`, success is keyed by `layersworkingcopyimportread`, holding
`target`, `source`, `targetBundle` and `sourceBundle`. Each canonical descriptor
has `pageId`, `owner` (current prefixed DB key), `revisionId` and `surfaceId`.
Bundles retain the complete exact snapshots, pinned sources, native geometry and
renditions; unrelated members and readable historical data are not discarded.
Do not treat these detached values as approval to apply or save an Import.

Admission/read failures use the fixed `layers-working-copy-import-unavailable`
error code with the generic unavailable-revision message; parameter validation
uses native API errors. No partially admitted Import bundle is returned.

The endpoint sets ApiMain's policy to private with zero `max-age` and `s-maxage`,
including refusals after module construction, regardless of requested cache ages.
This policy is qualified through native CLI tests. Final HTTP/session response
headers, browser behavior and MediaWiki 1.44/mobile acceptance are not claimed.
The Import picker/dialog, canonical source listing, empty-base admission,
drafts/first-Save provenance and whole-PDF integration remain separate work.

## Working-copy Import source listing

Use `action=layersdrawings&purpose=import&exclude=<target page ID>` with the
existing `search` and `limit` parameters to obtain current readable source
choices. This read-only mode returns `owner` (canonical native prefixed DB key)
beside each display `title`, native `pageid` and exact `revid`. Each image/slide
member has `id`, `label`, `kind`, `canvas` (`width`, `height`) and `fileTitle`
(`null` for slides). It returns no layer payload or application permission.

The default `purpose=copy` retains the existing response shape. Both modes
retain native editor access checks, source visibility, rate limiting and private
zero-age CLI cache policy. Final HTTP/session headers require separate testing.

The Import client matches the same image file and normalized layer-set name, or
the same slide name, and keeps choices from different owner IDs distinct. Native
IDs select internal data and are never author syntax. A selected choice must
still pass the exact `layersworkingcopyimportread` admission and guarded editor
application, with fresh visibility and target-base checks. Listing does not
authorize Save. Whole-PDF Import and editor UI activation remain separate work.

### layerspdfcreationview — POST (read-only)

Read an empty page-owned PDF viewer from an exact current saved direct embed.
Requires `pageid`, `baserevid`, UTF-8 byte offset `embedstart` and complete
`embedtext`. The owner and file must be readable, the native revision visible,
the owner eligible and migration complete; no stored member of that file/name
may exist. A permitted reader need not have edit rights. This endpoint writes
nothing and needs no CSRF token. Its response is private and zero-age.

The response contains native PDF count/page geometry, an empty ephemeral anchor
and an exact-source delivery descriptor. Opening/exporting revalidates it. The
separate GET/HEAD delivery URL resolves the saved occurrence and compares its
source digest; it does not accept a caller-selected file/version. See the
[PDF creation viewer contract](../docs/PDF_CREATION_VIEWER.md) for response
privacy, source capture, refusal rules and bounded acceptance limits.
