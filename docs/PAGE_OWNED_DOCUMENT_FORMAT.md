# Page-owned document format, internal version 1

Updated September 6, 2026. **Internal implementation; not a public save format.** The `layers-document` content model is registered only in isolated core tests. Existing editor/API payloads remain governed by [the save payload contract](SAVE_PAYLOAD_CONTRACT.md). No page, file or legacy layer set is migrated by this work.

This is the H2 format contract for [page-owned history](PAGE_OWNED_HISTORY_IMPLEMENTATION.md). General-purpose slides, image annotations and PDF annotations share one collection. The schema does not assume instructional steps, presentations or any particular workflow.

## Authority and structure

The owning page and revision come from MediaWiki, never from an editable `owner` property. Each committed slot is a complete snapshot. `schemaVersion` must be the integer `1`; `surfaces` must be an ordered JSON array, including an empty array for an empty document. Unknown root, surface, canvas and source properties are rejected. Required properties cannot be omitted or replaced with null.

```json
{
  "schemaVersion": 1,
  "surfaces": [
    {
      "id": "canvas-1",
      "kind": "slide",
      "label": "Ideas",
      "canvas": {
        "width": 800,
        "height": 600,
        "backgroundColor": "#ffffff",
        "backgroundVisible": true,
        "backgroundOpacity": 1
      },
      "layers": [
        { "id": "heading", "type": "text", "x": 40, "y": 60, "text": "Explore the possibilities" }
      ],
      "readingOrder": ["heading"]
    }
  ]
}
```

The [mixed-surface fixture](../tests/fixtures/revisions/mixed-document-v1.json) also contains an image and a PDF surface. Its filenames and hashes are synthetic structural examples, not retrievable assets.

| Field | Contract |
| --- | --- |
| `id` | Required string, 1–64 ASCII letters, digits, underscores or hyphens. Surface IDs are unique within the document; layer IDs are unique within a surface. IDs survive renaming and reordering. |
| `kind` | Exactly `slide`, `image` or `pdf`. |
| `label` | Required UTF-8 string, up to 512 bytes, without ASCII control characters. Empty labels are structurally valid. |
| `canvas` | All five illustrated properties are required. Width/height are integers from 1 through 4096. Background color passes the existing server color validator. Visibility is boolean; opacity is a finite number from 0 through 1. |
| `layers` | Required ordered array of layer objects. Empty arrays are valid; object maps and scalar entries are rejected. Array order retains drawing order. |
| `readingOrder` | Optional ordered array of unique existing layer IDs. It may be empty or partial. This records an explicit preference without changing drawing order; text extraction and the treatment of unlisted layers belong to the later search/accessibility contract. |
| `source` | Required for image/PDF; forbidden for slides, including null. See below. |

Stable IDs are supplied by the future authoring service. The schema checks identity integrity; it does not generate IDs or authorize ownership. A label is not a unique lookup key.

## Source versions and retention

Image/PDF sources contain exactly these fields:

```json
{
  "repository": "local",
  "fileTitle": "File:Diagram.png",
  "timestamp": "20260906120000",
  "sha1": "0000000000000000000000000000000",
  "page": 1
}
```

Version 1 permits local uploads only. The title must begin with `File:`, be at most 255 UTF-8 bytes, and exclude control characters and the forbidden title delimiters checked by the schema. The timestamp must be a valid 14-digit UTC date/time. SHA-1 uses MediaWiki's 31-character lowercase base-36 representation. Image page must be integer 1; PDF page must be an integer from 1 through 100,000. That ceiling is a structural bound, not a claim that a particular PDF contains the requested page.

**Schema validation does not establish that the file exists, is accessible, matches its hash, or has that page.** H3 must resolve a canonical local File title, look up the exact timestamp, verify the hash/type/page and enforce source access before publication. A syntactically accepted title is not proof of a valid MediaWiki title. No network fetch is performed by this validator.

The historical viewer must resolve the same version. Missing, deleted or suppressed assets must yield an explicit unavailable state, respecting visibility permissions; there must be no fallback to the latest upload. Storing a hash does not retain bytes. H5 must test retention, deletion/undelete, suppression and administrative repair before adoption is released. Foreign assets require a separately authorized local copy or a later versioned retention design; they cannot silently become a live foreign URL in this format. The same lifecycle analysis must cover any asset references inside drawing layers.

## Layer validation and loss prevention

Layers use the existing server drawing-property validator with a fixed snapshot profile: 100 layers per surface and a 1 MiB limit on each embedded-image data URL (including its encoding). Current wiki editing limits still apply to legacy saves; changing those settings does not retroactively change these snapshot limits. The future publication service may impose stricter admission limits independently.

Every layer requires a stable ID and a supported type. Validation compares the original data with the sanitizer result after canonical serialization. If the sanitizer would drop, coerce, truncate or otherwise change data, the snapshot is rejected. Unknown drawing properties, unsafe values and numeric strings therefore cannot be silently repaired into a different committed document. Equivalent numeric representations such as layer coordinate `1.0` and `1` serialize identically. Fields explicitly required to be integers, such as schema version and canvas dimensions, must still parse as integers.

Group children must exist, occur once in the group graph, have exactly one parent, and reciprocate their `parentGroup` reference. Only groups can have children. Self-reference and cycles are rejected. These checks prevent ambiguous or broken references in stored revisions.

The shared validator is an implementation dependency, not an immutable public schema specification. Changes to its accepted properties or normalization must run the snapshot compatibility tests and explicitly decide whether a schema migration/version change is required. Security fixes may make unsafe old data unavailable; they must fail visibly, never substitute newer content. Before public rollout, representative legacy documents for all supported drawing types must have explicit import coverage.

## Bounds and serialization

| Resource | Version 1 bound |
| --- | --- |
| Input and canonical output | 2 MiB each |
| Native JSON decode depth | 64 |
| Surfaces | 100 |
| Layers per surface | 100 |
| Total layers | 1,000 |
| Canvas width/height | 1–4096 |

These are initial internal limits, not a new public limit for existing shared content. Large-document adoption needs a preflight report; it must not silently truncate. Limits will be reviewed before exposure.

Native parsing validates JSON syntax and UTF-8. A separate bounded scan rejects duplicate object members at every depth, including equivalent escaped key names. Overflowing JSON numbers are rejected as validation errors. Canonical JSON recursively sorts object keys, preserves array order and object-versus-array identity, and removes formatting whitespace. It uses unescaped Unicode/slashes and normalizes equivalent numbers. This makes property ordering/formatting changes no-ops without hiding drawing or surface reordering.

Legacy import is a separate, pending operation: normalize a copy, report changes, assign stable IDs, resolve/retain source versions, then validate the complete result before adoption. The revision validator itself must not serve as a lossy import tool. Future schema versions require explicit readers/migrations; unknown versions are rejected today. No Cargo binding or live-query extension point is currently accepted.

## Core save boundary and verification

`LayersDocumentContent` validates and caches canonical text. `LayersDocumentContentHandler` validates at MediaWiki's save boundary as well as during pre-save transformation. A generic `JsonContent` object claiming the same model cannot bypass that boundary. Invalid content is left intact for rejection, rather than transformed into an empty or repaired document.

The H2 unit suite covers mixed surfaces, canonicalization, invalid containers/fields, source metadata, IDs, group cycles, reading references, nested duplicate keys, overflowing numbers and count boundaries. Real MediaWiki tests cover typed revision round trips, no-op saves, fixed limits and rejection of invalid direct core writes without creating a new revision. See [verification evidence](PAGE_OWNED_HISTORY_IMPLEMENTATION.md#h2-implementation-and-verification) for measured results and limits.

There is no production model/slot registration, public API, owner authorization, historical renderer, migration or search projection in H2. Registration remains gated on the authorized H3 service and the subsequent rollout gates.
