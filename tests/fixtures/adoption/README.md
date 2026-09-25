# Legacy Adoption Conversion Fixtures and Loss Matrix (Junior J62)

## Purpose and Scope

This directory contains synthetic test fixtures and a field-by-field compatibility matrix for converting legacy MediaWiki Layers annotations (`layer_sets` database records, legacy save payloads, and slide controller states) into the native page-owned document format ([`docs/PAGE_OWNED_DOCUMENT_FORMAT.md`](../../../docs/PAGE_OWNED_DOCUMENT_FORMAT.md)).

These fixtures provide concrete inputs and expected outputs for the lead's upcoming adoption converter (B01/B02) and explicitly identify data loss risks, representability gaps, and current runtime rendering gates.

### Subsystem Boundaries

To avoid conflating storage, schema validation, and runtime rendering, this matrix distinguishes five distinct subsystems:

1. **Legacy Storage**: The `layer_sets` database table ([`src/Database/LayersDatabase.php`](../../../src/Database/LayersDatabase.php)), where annotations are serialized in `ls_json_blob` and grouped by `(ls_img_name, ls_img_sha1, ls_name, ls_page)`, with `ls_revision` also part of the unique revision key.
2. **Legacy API Envelopes**: The `action=layerssave` and `action=layersinfo` endpoints ([`src/Api/ApiLayersSave.php`](../../../src/Api/ApiLayersSave.php), [`src/Api/ApiLayersInfo.php`](../../../src/Api/ApiLayersInfo.php)) which wrap drawing data in transport metadata.
3. **Page-Owned Document Schema**: The canonical version 1 schema enforced by [`src/Revision/DocumentSchema.php`](../../../src/Revision/DocumentSchema.php) and [`src/Revision/JsonSnapshotCodec.php`](../../../src/Revision/JsonSnapshotCodec.php).
4. **Source Version Authorization**: The strict local asset verification performed by [`src/Revision/SourceVersionResolver.php`](../../../src/Revision/SourceVersionResolver.php).
5. **Runtime Rendering & Editor Admission**: The historical viewer adapter ([`resources/ext.layers/viewer/PageOwnedRevisionRenderer.js`](../../../resources/ext.layers/viewer/PageOwnedRevisionRenderer.js)) and editor bootstrap admission ([`src/Revision/PageOwnedPilot.php`](../../../src/Revision/PageOwnedPilot.php)).

---

## Fixture Inventory

All fixtures use synthetic non-resolvable timestamps (`20260924...`) and synthetic SHA-1 hashes (e.g. `0123456789abcdef...`). In a real environment, `SourceVersionResolver` strictly checks these against the local MediaWiki file repository and requires physical files on disk.

| Fixture File | Surface Kind | Scenario & Coverage | Schema Status | Historical Viewer Status |
| :--- | :--- | :--- | :--- | :--- |
| [`image-text-callout.json`](image-text-callout.json) | `image` | Image annotation on `File:Diagram.png` with text, callout, fractional coordinates (`120.5`, `80.25`), and Unicode text (`概要`, `⚙️`). | Admitted | **Blocked** (`kind !== 'slide'`) |
| [`slide-falsy-zero.json`](slide-falsy-zero.json) | `slide` | Standalone canvas with explicit boolean `false`, numeric `0` opacity, `0` stroke width, `"fill": "none"`, and empty label (`""`). | Admitted | **Admitted** |
| [`pdf-multipage-distinct.json`](pdf-multipage-distinct.json) | `pdf` | Multi-page PDF with 2 distinct pages having different orientations (portrait 800x1131 vs landscape 1131x800). Captures real per-page legacy storage. | Admitted | **Blocked** (`kind !== 'slide'`) |
| [`name-collision-different-sets.json`](name-collision-different-sets.json) | `image` | Two distinct legacy set records sharing identical set name (`"default"`) and display label (`"Figure 1: Revenue"`). | Admitted (with distinct surface IDs) | **Blocked** (`kind !== 'slide'`) |
| [`group-hierarchy.json`](group-hierarchy.json) | `slide` | Multi-level group DAG (`grp_root` -> `grp_sub` -> child items). Tests `children` and `parentGroup` references. | Admitted | **Blocked** (`group` and `parentGroup` rejected) |
| [`resource-backed-layer.json`](resource-backed-layer.json) | `slide` | Resource-backed layers: embedded base64 image layer, SVG path `customShape`, and numbered `marker`. | Admitted | **Blocked** (`image`, `customShape`, `marker` rejected) |

---

## Field-by-Field Loss and Compatibility Matrix

### Classification Legend
- **Directly Preserved**: Field transfers 1:1 into the page-owned snapshot format without alteration or data loss.
- **Decision Required**: Field requires an explicit representation or normalization decision by Lead B01 (e.g. key derivation, PDF grouping, or unit normalization).
- **Blocks Adoption**: Field or value cannot be represented in `DocumentSchema` v1, fails `SourceVersionResolver`, or triggers an unhandled editor/rendering failure.

### 1. Document Root and Surface Envelope

| Source / Legacy Field | DocumentSchema v1 Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| N/A (implicit) | `schemaVersion` | **Directly Preserved** | Must be integer `1`. Any other version is rejected. | `DocumentSchema::VERSION` (line 12) |
| Multi-set query / single set | `surfaces` | **Directly Preserved** | JSON array of surface objects (0–100 surfaces per document). | `DocumentSchema::canonicalize` (line 40) |
| `ls_name` (set name) | `surface.id` | **Decision Required** | Legacy set names (e.g. `"default"`) collide across different files/pages. Surface `id` must be 1–64 ASCII characters (`[A-Za-z0-9_-]`) and strictly unique within the document. The converter must generate stable surface IDs; it cannot map `ls_name` directly to `surface.id`. | `DocumentSchema::identifier` (line 201), `PAGE_OWNED_BINDING_PLAN.md` |
| `ls_name` (set name) | `surface.label` | **Decision Required** | UTF-8 string up to 512 bytes. Empty string is allowed; ASCII control characters forbidden. Preserves user-visible set name. | `DocumentSchema::surface` (line 69) |
| File type / Slide prefix | `surface.kind` | **Directly Preserved** | Must be strictly `'slide'`, `'image'`, or `'pdf'`. | `DocumentSchema::surface` (line 66) |
| Implicit order | `surface.readingOrder` | **Decision Required** | Optional array of layer IDs for accessibility/search. Omission does not establish a reading-order policy; extraction order remains a separate contract. Do not manufacture readingOrder during adoption. | `DocumentSchema::references` (line 187) |
| Wiki page / PageID | `owner` | **Blocks Adoption (if placed in JSON)** | Owning PageID and page title are MediaWiki page/revision metadata, NOT document JSON fields. Adding an `owner` key to JSON throws `invalid-document-fields` or `invalid-surface-fields`. | `DocumentSchema::objectKeys` (line 236) |

### 2. Canvas Background Properties

| Source / Legacy Field | DocumentSchema v1 Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| `canvasWidth` / `File::getWidth()` | `canvas.width` | **Directly Preserved** | Required integer `1..4096`. Floating point dimensions (e.g. `1920.5`) reject. Slides default to 800. | `DocumentSchema::surface` (line 76), `ApiLayersSave::executeSlideSave` (line 491) |
| `canvasHeight` / `File::getHeight()` | `canvas.height` | **Directly Preserved** | Required integer `1..4096`. Floating point dimensions reject. Slides default to 600. | `DocumentSchema::surface` (line 76), `ApiLayersSave::executeSlideSave` (line 493) |
| `backgroundColor` | `canvas.backgroundColor` | **Directly Preserved** | Required valid color string (hex `#rrggbb`, `#rgb`, or rgb/rgba). Slides default to `#ffffff`. Null values reject. | `ColorValidator::isValidColor`, `DocumentSchema::surface` (line 78) |
| `backgroundVisible` | `canvas.backgroundVisible` | **Directly Preserved** | Required native boolean (`true` or `false`). String `"false"` or integer `0` reject without coercion. | `DocumentSchema::surface` (line 80) |
| `backgroundOpacity` | `canvas.backgroundOpacity` | **Directly Preserved** | Required finite number `0..1`. Explicit `0` is preserved. Negative numbers reject. | `DocumentSchema::surface` (line 84) |

### 3. Source Version Block (`source`)

| Source / Legacy Field | DocumentSchema v1 Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| Slide surface | `surface.source` | **Blocks Adoption (if present)** | Slide surfaces **must not** contain a `source` block. If `property_exists($surface, 'source')`, throws `slide-must-not-have-source`. | `DocumentSchema::surface` (line 90) |
| Image / PDF surface | `surface.source` | **Directly Preserved** | Required for `image` and `pdf` surfaces. Must be an object with exactly 5 properties. | `DocumentSchema::surface` (line 93) |
| Local repository | `source.repository` | **Directly Preserved** | Must be strictly string `'local'`. Foreign repositories (e.g. InstantCommons) are not admitted in v1. | `DocumentSchema::source` (line 106), `SourceVersionResolver` (line 59) |
| `ls_img_name` / `File:Title` | `source.fileTitle` | **Decision Required** | Must begin with `File:`, use canonical DB-key spelling (underscores for spaces), <= 255 bytes, no forbidden title delimiters (`#<>[]{}|`). | `DocumentSchema::source` (line 108), `SourceVersionResolver` (line 48) |
| Exact file revision timestamp (not `ls_timestamp`) | `source.timestamp` | **Decision Required** | Exactly 14 UTC digits (`YYYYMMDDHHMMSS`). Must match the exact MediaWiki file revision timestamp. ls_timestamp records an annotation save and cannot supply this value; resolve the source independently. | `DocumentSchema::source` (line 114), `SourceVersionResolver` (line 61) |
| `ls_img_sha1` / File sha1 | `source.sha1` | **Decision Required** | Exactly 31 lowercase base-36 characters. Must match the physical file hash. In legacy storage, slides use `'slide'` which is invalid for an image/PDF source. | `DocumentSchema::source` (line 111), `SourceVersionResolver` (line 61) |
| `ls_page` | `source.page` | **Directly Preserved** | Integer. Must be `1` for image surfaces. Must be `1..100000` and `<= file.pageCount()` for PDF surfaces. | `DocumentSchema::source` (line 121), `SourceVersionResolver` (line 70) |

### 4. Layer Common Geometry and Presentation

| Source / Legacy Field | DocumentSchema Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| `layer.id` | `layer.id` | **Directly Preserved** | Required string, 1–64 ASCII `[A-Za-z0-9_-]`. Must be unique within the surface. | `DocumentSchema::layers` (line 132) |
| `layer.type` | `layer.type` | **Directly Preserved** | Must be one of the 17 supported types. | `ServerSideLayerValidator::SUPPORTED_LAYER_TYPES` (line 27) |
| `x`, `y` | `layer.x`, `layer.y` | **Directly Preserved** | Finite numbers in range `[-100000, 100000]`. Fractional values (e.g. `120.5`) are preserved. | `ServerSideLayerValidator::validateNumericProperty` (line 748) |
| `width`, `height` | `layer.width`, `layer.height` | **Directly Preserved** | Finite numbers in range `[0, 10000]`. CSS suffixes (`px`) are stripped by validator; raw strings reject in DocumentSchema if lossy. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 220) |
| `rotation` | `layer.rotation` | **Directly Preserved** | Finite number in degrees `[-100000, 100000]`. | `ServerSideLayerValidator` (line 776) |
| `opacity`, `fillOpacity`, `strokeOpacity` | Same | **Directly Preserved** | Finite numbers in range `[0, 1]`. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 214) |
| `visible` | `layer.visible` | **Directly Preserved** | Boolean. Explicit `false` is preserved. | `ServerSideLayerValidator::validateBooleanProperty` (line 790) |
| `locked` | `layer.locked` | **Directly Preserved** | Boolean. | `ServerSideLayerValidator::validateBooleanProperty` (line 790) |
| `blend` (legacy alias) | `layer.blendMode` | **Decision Required** | Legacy alias `blend` is normalized to `blendMode` by `ServerSideLayerValidator`. Because this drops/renames a property, `DocumentSchema` rejects raw payloads containing `blend`. Any alias conversion requires an explicit, tested semantic-preservation rule, including conflicting alias/canonical fields; until then reject rather than silently normalize. | `ServerSideLayerValidator` (line 454), `DocumentSchema::layers` (line 145) |

### 5. Vector, Shape, and Text Specific Properties

| Source / Legacy Field | DocumentSchema Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| `stroke`, `fill`, `color` | Same | **Directly Preserved** | Validated color strings or `"none"` / `"blur"`. Safe color sanitizer applied. | `ServerSideLayerValidator` (lines 598-615) |
| `strokeWidth` | `layer.strokeWidth` | **Directly Preserved** | Number in range `[0, 100]`. `0` is preserved. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 219) |
| `text` | `layer.text` | **Directly Preserved** | Sanitized UTF-8 text. Cannot be empty or whitespace-only for text layers. Unicode and emoji preserved. | `ServerSideLayerValidator` (lines 550-555) |
| `fontSize` | `layer.fontSize` | **Directly Preserved** | Number in range `[1, 1000]`. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 218) |
| `fontFamily` | `layer.fontFamily` | **Directly Preserved** | Sanitized font name. Spaces preserved (e.g. `"Times New Roman"`). | `ServerSideLayerValidator` (line 564) |
| `textAlign`, `verticalAlign` | Same | **Directly Preserved** | Enums: `left`/`center`/`right`, `top`/`middle`/`bottom`. | `ServerSideLayerValidator::VALUE_CONSTRAINTS` (line 194) |
| `tailDirection`, `tailPosition`, `tailSize`, `tailStyle`, `tailTipX`, `tailTipY` | Same | **Directly Preserved** | Callout properties. `tailDirection` must be one of 8 enum values (`bottom`, `top`, `left`, `right`, `bottom-left`, `bottom-right`, `top-left`, `top-right`). | `ServerSideLayerValidator::VALUE_CONSTRAINTS` (line 199) |
| Unknown / Custom properties | N/A | **Blocks Adoption** | `DocumentSchema` rejects any layer property not in `ServerSideLayerValidator::ALLOWED_PROPERTIES` because sanitizer drops it and strict hash comparison fails. | `DocumentSchema::layers` (line 145) |

### 6. Group Hierarchy Properties

| Source / Legacy Field | DocumentSchema Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| `layer.children` | `layer.children` | **Directly Preserved in Schema; Blocks Historical Viewer** | Validated array of string layer IDs (max 100). Only permitted on `type: 'group'`. All child IDs must exist. No cycles. Single parent per child. | `DocumentSchema::references` (lines 159-170) |
| `layer.parentGroup` | `layer.parentGroup` | **Directly Preserved in Schema; Blocks Historical Viewer** | String ID of parent group. Must reciprocate parent's `children` entry. | `DocumentSchema::references` (lines 173-176) |
| `layer.expanded` | `layer.expanded` | **Directly Preserved in Schema** | Boolean UI state flag. | `ServerSideLayerValidator::ALLOWED_PROPERTIES` (line 123) |
| Group rendering | N/A | **Blocks Historical Viewer** | `PageOwnedRevisionRenderer.js` line 45 explicitly throws if `layer.type === 'group'` or `layer.parentGroup` is set. | `PageOwnedRevisionRenderer.js` (line 45) |

### 7. Resource-Backed Layers (Image, Marker, CustomShape)

| Source / Legacy Field | DocumentSchema Target | Classification | Behavior / Gap / Normalization Rule | Code References |
| :--- | :--- | :--- | :--- | :--- |
| `image.src` | `layer.src` | **Directly Preserved in Schema; Blocks Historical Viewer** | Base64 data URL with verified magic number bytes (`image/png`, `image/jpeg`, `image/gif`, `image/webp`). Max 1 MiB. SVG data URLs strictly rejected. | `ServerSideLayerValidator::validateImageSrc` (line 626), `matchesImageSignature` (line 685) |
| `image.originalWidth`, `originalHeight` | Same | **Directly Preserved** | Positive numbers in range `[1, 16384]`. Strict properties. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 261) |
| `customShape.shapeId`, `path` | Same | **Directly Preserved in Schema; Blocks Historical Viewer** | Sanitized category/shape ID and safe SVG path string starting with M/m. Whitelisted path characters only. Max 1000 commands. | `ServerSideLayerValidator::validateSvgPath` (line 712) |
| `marker.value`, `style`, `size` | Same | **Directly Preserved in Schema; Blocks Historical Viewer** | Number 1..999, style enum (`circled`, `parentheses`, etc.), size 10..200. | `ServerSideLayerValidator::NUMERIC_CONSTRAINTS` (line 246) |
| Resource layer rendering | N/A | **Blocks Historical Viewer** | `PageOwnedRevisionRenderer.js` line 45 explicitly throws if `layer.type` is not in synchronous vector set. Image, marker, and customShape layers block historical rendering. | `PageOwnedRevisionRenderer.js` (line 45) |

### 8. Legacy Database Columns (`layer_sets`) vs Page-Owned Native Revisions

| Legacy Database Column | Page-Owned Native Equivalent | Classification | Architectural Transition Rule |
| :--- | :--- | :--- | :--- |
| `ls_id` | MediaWiki `rev_id` | **Decision Required** | Legacy auto-increment ID is retired for page-owned content. The page-owned document revision is identified by MediaWiki's native revision ID (`rev_id`). |
| `ls_user_id` | Adoption provenance, if explicitly designed | **Decision Required** | New revision actor is the authenticated adopting editor, not the legacy author. Do not impersonate the original author. |
| `ls_timestamp` | Adoption provenance, if explicitly designed | **Decision Required** | New revision timestamp is the adoption publication time. Legacy annotation time is neither this timestamp nor the source-file version time. |
| `ls_revision` | MediaWiki revision history | **Decision Required** | Per-set incrementing revision integer (1, 2, 3...) is replaced by native page history. |
| `ls_name` | Page wikitext binding / surface `label` | **Decision Required** | Legacy set name is replaced by surface ID in wikitext embedding binding, and preserved as surface `label`. |
| `ls_page` | `source.page` | **Directly Preserved** | 1-based page number stored in surface `source.page`. |
| `ls_size`, `ls_layer_count` | Rebuildable projections | **Recomputed** | Byte size changes with serialization; layer count derives from retained layers. Neither is copied into document JSON. |

---

## Architectural Gaps and Converter Requirements for Lead B01/B02

### 1. Multi-Page PDF Assembly vs Page Selection
- **The Gap**: Legacy storage stores each PDF page in an independent row in `layer_sets`. MediaWiki wikitext embeddings usually reference a specific page (`[[File:Doc.pdf|page=2]]`).
- **Converter Requirement**: Lead decision: initial adoption copies only the explicitly selected PDF page into a new surface in the complete owner document, preserving all existing surfaces. The two-page fixture is a collection of independently selected inputs, not an instruction to adopt every PDF page automatically.
- **Surface Identity**: Each PDF surface must retain its explicit 1-based `source.page` and distinct dimensions queried from `File::getWidth($page)` and `File::getHeight($page)`.

### 2. Source Version Strictness and Retention
- **The Gap**: `SourceVersionResolver` requires:
  1. `repository === 'local'`
  2. `fileTitle === 'File:' . $file->getDBkey()`
  3. Physical file existing on disk in `LocalRepo`
  4. Exact timestamp match (`$file->getTimestamp() === $source->timestamp`)
  5. Exact SHA-1 match (`$file->getSha1() === $source->sha1`)
  6. File not deleted or suppressed
- **Adoption Preflight**: An adoption transaction cannot succeed if the source file has been modified or replaced without an exact historical file archive, or if it is served from InstantCommons. Foreign files cannot be adopted without local mirroring.

### 3. Layer Count and JSON Size Bounds
- `DocumentSchema` enforces:
  - Max 100 surfaces per document
  - Max 100 layers per surface
  - Max 1,000 total layers per document
  - Max 2,097,152 bytes (2 MiB) canonical JSON
- Legacy limits are configurable (LayersMaxLayerCount and LayersMaxBytes); do not assume every stored set fits the fixed document profile. Legacy slide width permits 7680 while the document profile permits 4096, so some otherwise valid slides require rejection pending a profile decision, never downscaling. Combining multiple legacy sets into a single document must check total layer count and size bounds during preflight.

### 4. Group Hierarchy and Resource Layer Rendering Gates
- `DocumentSchema` admits group hierarchies and resource-backed layers (`image`, `customShape`, `marker`).
- However, `PageOwnedRevisionRenderer.js` and `PageOwnedPilot::prepareEditor` explicitly fail closed on:
  - Any non-slide surface (`kind !== 'slide'`)
  - Any group layer or grouped child (`layer.parentGroup`)
  - Any resource-backed layer (`image`, `marker`, `customShape`)
- **Recommendation for B01/B02**: Reject user-facing adoption until the selected content can be both edited and historically rendered without loss. Schema-valid storage alone is insufficient; do not publish a drawing that the promised workflow cannot display.

### 5. Name Collision Avoidance
- In legacy storage, `ls_name` (e.g. `"default"`) was scoped by file and page.
- In page-owned documents, `surface.id` must be globally unique across the document.
- **Conversion Rule**: The converter must generate unique, stable surface IDs (e.g. `surface_image_01`, `surface_pdf_p2`) and use `ls_name` as the initial `surface.label` unless the adoption UI explicitly supplies another label. Labels in these candidate snapshots are illustrative choices, not inferred legacy fields.

---

## Verification Evidence

1. **JSON Syntax and Structure Verification**:
   - All 6 JSON files parse cleanly with zero syntax errors.
   - All proposed page-owned snapshots conform to `DocumentSchema` v1 structure.
2. **Symbol and Path Integrity**:
   - All referenced PHP classes (`DocumentSchema`, `ServerSideLayerValidator`, `SourceVersionResolver`, `LayersDatabase`, `ApiLayersSave`, `ApiLayersInfo`, `PageOwnedPilot`) and JavaScript files exist in the extension codebase.
   - Database columns match `sql/tables/layer_sets.sql`.
3. **Documentation Check**:
   - `npm run check:docs` executed cleanly with zero broken links or markdown errors.

## Lead review corrections — September 24, 2026

Accepted as synthetic structural fixtures with corrections, not end-to-end adoption evidence. All eight stored rows had incorrect ls_size values. Lead reserialized blobs using the database writer's PHP JSON flags and recalculated exact byte lengths; layer counts and repeated drawing payloads match. Six candidate documents passed a fresh DocumentSchema::canonicalize call through the standalone test bootstrap; all candidate layer arrays equal their source row arrays.

Candidate labels, white image/PDF canvas backgrounds and readingOrder lists were illustrative additions, not preserved legacy data. Lead removed the invented readingOrder lists and recorded the remaining mapping decisions explicitly in each fixture. Empty-label coverage is an explicit user-selected label. White canvas defaults for media-backed surfaces need visual-parity acceptance; do not interpret them as authorization to paint over a source image. Legacy ownerId identifies the shared-set creator user, NOT the owning article PageID.

Schema success does not validate PNG decoding, source existence, file access, historical rendering or actual legacy API acceptance. Rejection examples are descriptions, not executed negative tests. Code references with line numbers are navigation hints, not verified assertions about each line; use named methods and current code. Historical editor admission and painter support are separate gates. No production code or user wiki content was changed in this review.
