# Native whole-PDF Import transport

This boundary advances milestone 1, HIST-4, DATA-1 and SEC-2. It connects the
qualified native whole-PDF read/admission service to a separate read-only API.
The corresponding client is unregistered and has no editor or UI callers.
Existing image/slide Import, editor state, Undo, drafts and Save are unchanged.

## Request and authorization

POST `action=layersworkingcopypdfimportread` with `targetpageid`, `baserevid`,
`targetsurface`, `sourcepageid`, `sourcerevid` and `sourcesurface`. IDs are bounded
positive native integers; anchors are nonempty strings of at most 128 UTF-8
bytes. They are internal identifiers, never author syntax. The target and source
must belong to different owners. A stored target group anchor is required.

The lazy native composition uses the existing owner scope, exact history access,
source-version resolver, native rendition handler, missing-page preparation and
render rate limiter. Current target edit rights and exact source read rights are
rechecked by the reader. The new request neither saves a revision nor applies
layers. Native rendition generation is confined to ordinary MediaWiki handlers.

Module construction and execution set private caching with zero maximum age.
This also applies before parameter failures. POST is required; no publication
token or write capability is issued by this read. The normal API result-size
limit remains enabled: an oversized result refuses the complete response.

## Lossless response

The response at `layersworkingcopypdfimportread` is an envelope:

```json
{ "version": 1, "data": "<encoded complete JSON read result>" }
```

`data` contains the exact read-service DTO encoded with escaped Unicode and
preserved floating-point representation. Its ASCII encoding prevents the API
formatter from normalizing stored Unicode text or interpreting user properties
such as `_type` and `_content` as API metadata. Empty objects, empty arrays,
numeric object properties, null and unknown readable layer metadata survive.
The envelope itself goes through the supported native result formatter and
retains its normal size checks. No result-validation bypass is used.

After decoding, the DTO has the descriptors, complete bundles, group inventories
and admitted target members documented in [native preparation](WHOLE_PDF_NATIVE_IMPORT_READ.md).
There is one visible layer-set name per PDF group; page numbers remain internal
members. Source and target may pin different versions of the same file.

## Client and detached planner

`PageOwnedWholePdfImportReadClient` requires an injected API with `post()`.
It captures the six request values synchronously, makes a fresh request each
time and accepts only the supported envelope and a complete, consistent DTO.
It checks requested owner/revision/anchor descriptors, scoped group membership,
pins, native page counts, geometry/rendition inventories and exact missing-page
admissions. Surface IDs are unique within each owner's snapshot; equal IDs
across different owners are valid. Native empty maps and numeric map keys are
accepted without changing their JSON types. Thumbnail dimensions may differ
from native page dimensions because of raster rounding.

Malformed, denied, stale, partial or failed requests produce the fixed
`layers-working-copy-import-unavailable` error. There is no retry, shared cache,
legacy route fallback, silent omission or payload repair. Client JSON validation
allows the native snapshot depth plus its bounded transport wrappers.

The complete source snapshot and admissions can feed the existing detached
whole-PDF planner. The target snapshot must come from current live work, not
from the stored target bundle: unsaved target edits must participate in Append
and the approved Replace behavior. A read response is neither an application
capability nor lasting authorization.

## Remaining integration

ResourceLoader/editor registration, asynchronous live-work revalidation, atomic
editor/session/Undo/draft application and whole-group provenance through
ordinary owning-page Save remain separate work. Wholly missing target groups
still require creation admission. Final HTTP headers, complete native/browser
Import, supported-version/mobile and owner acceptance remain open. This read
transport checkpoint does not complete milestone 1.
