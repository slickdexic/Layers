# Whole-PDF Import Save transport

This native request boundary advances Milestone 1 / HIST-4 / DATA-1 / SEC-2. It
exposes the qualified whole-PDF publication service through MediaWiki's API. The
separate client transport has no editor, controller, draft or ordinary Save
callers. Existing publication APIs and visible controls remain unchanged.

## Native request

`layersworkingcopypdfimportpublish` is a POST-only, CSRF-protected write action.
It requires `editlayers` and the native Save rate limiter; the publication
service makes the final owning-page write and source-access decisions. The
module requests private caching with zero maximum age in its constructor and
execution path. Final HTTP/session headers require separate HTTP acceptance.

| Parameter | Meaning |
| --- | --- |
| `targetpageid` | Positive current owning page ID. |
| `baserevid` | Positive exact current target revision ID. |
| `data` | Complete proposed layer document, within the native document limit. |
| `importsources` | JSON array of 1 to 32 source descriptors. |
| `admissionrevisions` | Optional JSON array of up to 100 historical native page-ID origins; defaults to `[]`. |
| `summary` | Optional note, at most 500 characters; native source citations are retained. |

Source descriptors contain exactly `targetSurfaceId`, `sourcePageId`,
`sourceRevisionId` and `sourceSurfaceId`. Historical origins contain exactly
`surfaceId` and `revisionId`. Duplicate JSON member names, including escaped
duplicates, are rejected before decoding can discard their evidence. Records
must be objects in literal JSON arrays. The existing native service validates
all identity, membership, count and historical association rules. A `maintext`
parameter is refused; this request cannot replace the page's main content.

Success returns `{ "version": 1, "result": "Success", "revid": 123 }` under the
requested module name. The revision must advance beyond the base. Source access
is checked inside the existing cancelable publication transaction, including
after the write; a failed check rolls back the Save. The source page is never
written. If response capacity is exhausted after a committed Save, the API
reports `layers-publication-outcome-unknown`, rather than claiming the write was
refused. Callers must reconcile an uncertain outcome and must not retry it
automatically.

## Client transport

`PageOwnedWholePdfImportPublishClient` is separately instantiated with a native
API object. `publish()` accepts `pageId`, `baseRevisionId`, `snapshotJson`,
`sources`, optional `admissionRevisions` and optional `summary`. It captures the
literal request and descriptor fields before dispatch, preserves the complete
snapshot string, and sends one CSRF request to the native action. It neither
rewrites the document nor treats source descriptors as authorization.

Accessor-backed fields, malformed/decorated arrays, extra descriptor members,
invalid IDs, duplicate origins and invalid bounds refuse before dispatch.
Success requires the version-1 envelope and an advancing revision ID. Known
native refusal codes are mapped safely; malformed or missing responses and
unknown transport failures are uncertain. No response initiates an automatic
retry. Existing publisher behavior and API routing remain intact.

## Integration and acceptance

Ordinary PDF Save must explicitly obtain the real binding's current publication
claims, preserve complete live work through the pending request, and acknowledge
claims only after a confirmed revision. Saved-base/history reconciliation,
approved recovery/storage controls, missing target sets and native browser,
supported-version/mobile, upgrade and owner acceptance remain separate required
work. Registering this request boundary does not complete Milestone 1 or enable
the whole-PDF Import editor flow.
