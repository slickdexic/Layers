# Page-owned API guide

Reviewed October 24, 2026 against the release candidate. This describes the
implemented native boundary, not a declaration that Milestone 1 or Layers 2.0
has passed acceptance. Tagged 1.5.95 uses shared storage. Complete the
[upgrade procedure](UPGRADING.md), including migration completion, before
expecting bare embeds and the integrated editor to use page ownership.

## Registration and identity

Load Layers through `wfLoadExtension( 'Layers' )`. Static modules are in
[extension.json](../extension.json); additional native actions are installed by
[PageOwnedPilotRegistration](../src/Hooks/PageOwnedPilotRegistration.php).
[services.php](../services.php) supplies the native owner scope. The historical
`Pilot` class names do not mean these APIs are currently unregistered or that
normal saves must use legacy storage.

By default, new ownership is available in content namespaces and File. Existing
owners retain their stored content when moved to another namespace. See
`LayersPageDrawingNamespaces` in the [configuration guide](../wiki/Configuration-Reference.md).

The owning page, its exact revision and the file/slide/name scope identify
content. A member ID identifies a record within the snapshot. A legacy Layers
row ID is not a native revision ID. PDF pages are members of one visible set
name. Equal names on different owners or different files are independent.
Native IDs and binding tokens are internal transport values, never author
wikitext and never permission tokens.

Use MediaWiki's `api.php` and `format=json`. Inspect native `paraminfo` on the
exact installed candidate rather than copying a dated example from another
version:

```text
api.php?action=paraminfo&modules=layersread|layerspublish&format=json
```

## Read an exact saved revision

`layersread` is GET. Required `owner` is a native page title (maximum 512 UTF-8
bytes); required `revid` is a positive native revision ID, at most 2147483647.
The revision must belong to that owner and remain readable. An unavailable
revision must not fall back to latest content.

| Optional parameter | Contract |
| --- | --- |
| `binding` | Up to 50 internal binding strings, each at most 128 bytes. Unavailable, foreign or malformed entries are omitted. An empty result does not authorize creation. |
| `controls` | Requires bindings; asks for freshly authorized edit controls. |
| `viewer` | Requires exactly one binding; prepares the full-size viewer. |
| `viewpage` | Positive PDF page number; allowed only with `viewer`. |
| `editorpage` | Positive PDF page number; requires one binding and excludes viewer/control modes. Preparation does not publish changes. |

The response is keyed by `layersread`. Its shape depends on the selected mode:
an exact bundle, `bindings`, `viewer`, or `editor`. Preserve supplied geometry,
source versions and false/zero/null values. Do not infer PDF dimensions from a
JPEG's rounded natural dimensions or substitute another stored PDF member.

Metadata reads consume the existing `editlayers-info` quota. Source-render
preparation has a separate `editlayers-render` quota. Native exemption/default
configuration still applies; an ordinary API HTTP 200 is not proof of success.
Check MediaWiki's `error` result and the module-specific response.

## Publish the complete owner snapshot

`layerspublish` requires POST and a native CSRF token. The publisher rechecks
ordinary owner read/edit authority, `editlayers`, owner identity, the base
revision, schema, source visibility and exact source identity. Preparation or an
earlier read grants no authority that survives those checks.

| Parameter | Contract |
| --- | --- |
| `owner` | Required native title, maximum 512 bytes. |
| `pageid` | Original server-derived owner ID for bound editors. Optional for older internal callers; an identity assertion, not authority. It cannot be combined with new-page `baserevid=0`. |
| `baserevid` | Required current revision, or zero only for an admitted new owner. A stale base refuses publication. |
| `data` | Required JSON for the **complete** proposed document, not one layer or a partial member update. |
| `maintext` | Optional main-slot wikitext. Omission preserves it; an explicit empty string is different. |
| `summary` | Optional edit summary, up to 500 characters. |
| `importsources` | Optional guarded Import provenance, JSON up to 16384 bytes; requires existing owner identity/current base and excludes `maintext`. Do not invent descriptors. |

The schema is defined by [DocumentSchema](../src/Revision/DocumentSchema.php)
and [JsonSnapshotCodec](../src/Revision/JsonSnapshotCodec.php). Limits are
2 MiB, 100 members, 100 layers per member, 1000 total layers and dimensions up to
4096. Strict validation rejects unsupported fields and malformed/duplicate JSON;
it does not repair a payload by dropping unrelated content.

A successful changed publication creates one atomic native page revision,
preserving the complete PDF set and unrelated owner content. Treat a refused,
conflicting or transport-failed Save as unconfirmed. Preserve current work and
drafts; do not retry blindly, advance saved Undo markers, or replace the base
with an unverified latest revision. Use the integrated reconciliation flow.

## Import and missing-content preparation

The registered families below support the integrated workflow. Use native
module help for their exact parameters; an endpoint name alone does not prove
every editor/device journey is qualified.

| Area | Registered actions |
| --- | --- |
| Source listing | `layersdrawings` (`purpose=import` for Import choices); PDF catalog: `layersworkingcopypdfimportcatalog` |
| Existing image/slide Import | `layersworkingcopyimportread`, followed by guarded application and native publication |
| Empty image/slide target | `layersworkingcopyimportcreationread`, `layersworkingcopyimportcreationpublish`, `layersworkingcopyimportcreationrebase`, `layersworkingcopyimportcreationdraftrebase` |
| Whole-PDF working copy | `layersworkingcopypdfimportread`, `layersworkingcopypdfimportpublish` |
| Missing PDF target | `layersmissingpdfimportread`, `layersmissingpdfimportpublish`, `layersmissingpdfimportoutcome` |
| Empty PDF viewer/editor | `layerspdfcreationview`, `layerspdfcreationread` |

`layersdrawings` is an internal compatibility name; its results are **layer
sets**, not a different content type. Listings are not built-in full-text
search and do not grant Import or publication authority. Source reads require
exact readable revisions/members; target reads require fresh edit authority
and a current base. Whole-PDF preparation must retain every member and refuse
partial output. A catalog or preparation response creates no page revision.

`layerspdfcreationview` uses a read-only POST with `pageid`, `baserevid`,
`embedstart` and the complete saved `embedtext`; it does not need a CSRF token.
It admits the exact saved occurrence, not a caller-selected file version.
See [PDF creation viewer](PDF_CREATION_VIEWER.md).

## Privacy and delivery

Exact snapshots, historical/control/viewer/editor responses and Import
preparation use private zero-age API caching. One deliberate exception is a
current-revision binding-only read without controls: `LayersBindingReadMaxAge`
can allow bounded anonymous public caching; logged-in reads remain private.
The read module starts private, and errors do not become public merely because
the request supplied a cache age. Final HTTP/session headers must still match
the applicable endpoint policy.

Use returned exact-source descriptors and delivery URLs. Never synthesize a
path into private capture/export storage. The native PDF path captures a
private source, verifies its digest and repeats visibility/authorization checks;
a reupload must not silently change historical bytes. Viewer Download/Print
uses admitted source plus saved layers. Images/slides offer PNG first and PDF;
PDFs offer PDF only. A failed page must refuse complete PDF assembly rather
than emit a shortened document.

## Legacy and release boundaries

`layersinfo`, `layerslist` and the legacy export endpoints do not replace
native snapshot reads. After completion, `layerssave`, `layersrename` and
`layersdelete` refuse shared writes; they are not owner-page mutation APIs.
The [legacy API reference](../wiki/API-Reference.md) retains their contracts
for older/pre-completion deployments.

The guarded native `mergehistory` adapter preserves core behavior outside its
Layers scope; it is not a custom set-copy API. History, restore, suppression and
other native lifecycle actions retain their own checks.

Refer to the [release checklist](MILESTONE_1_RELEASE_CHECKLIST.md) for qualified
version/device/security/data combinations. Dated implementation notes are
historical evidence, not current registration instructions or complete release
acceptance. Search, Cargo readiness, Cargo and on-page links remain later
milestones.
