# Layers MediaWiki Extension – Functional Specification

## 1 Purpose and Scope

Layers is a **non‑destructive image‑annotation extension** for MediaWiki whose **primary purpose** is to let contributors rapidly add text annotations, arrows, lines, solid or bordered boxes, circles/ovals, and highlights to images directly in the wiki—no external tool required. It equips wiki users with an in‑browser editor that supports adding, re‑ordering, hiding, and re‑using overlay “layers” (text, arrows, shapes, highlights, icons, etc.) on top of raster (`.png`, `.jpg`, `.gif`) and vector (`.svg`) files already stored in the wiki. The goal is to eliminate round‑trips to external editors while preserving the original media file intact.

---

## 2 Core Feature Set

| Area                     | Capability                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overlay Elements**     | • Text with font, size, weight, style, color, stroke, drop‑shadow.• Basic shapes: line, arrow (single / double‑headed), rectangle, ellipse, polygon, free‑hand pen, highlighter (semi‑transparent).• Image/SVG icons imported from the (optional) Layer Library.• Call‑outs / speech bubbles with pointer tail. |
| **Layer Management**     | • Create, rename, reorder (drag‑and‑drop), group, lock, hide/show layers.• Named layers **may** be saved to the Layer Library for reuse across files (optional advanced feature).• Smart‑Guides for alignment / equal spacing.• Per‑layer opacity, blend mode, transform (translate, scale, rotate, flip).      |
| **Editing Workflow**     | • Infinite undo/redo (in‑session) + revision‑based history stored in MediaWiki.• Snap to pixel / 5‑px grid / underlying SVG path vertices.• Keyboard shortcuts (Ctrl+Z, Ctrl+Y, arrow keys ±⇧=10 px).• Context menu for copy / paste / duplicate.                                                               |
| **Import/Export**        | • Export composite as PNG (for download) without overwriting source.• Server‑side thumbnail generation for `thumbmode=withlayers`.• REST API endpoints: `POST /layers/v1/save`, `GET /layers/v1/:file/layers`.                                                                                                  |
| **Internationalisation** | • All UI strings through `i18n` JSON files.• RTL‑aware canvas mirroring.• Per‑text‑layer language tag to allow different scripts in one image.                                                                                                                                                                  |
| **Accessibility**        | • Each text layer accepts alt text.• Keyboard‑only editing path.• SVG export retains text as `<text>` elements for screen readers.                                                                                                                                                                              |
| **Permissions**          | New rights:• `editlayers` – add/modify layers.• `createlayers` – save named layers to library.• `managelayerlibrary` – delete/rename/curate library assets.                                                                                                                                                     |

---

## 3 User Personas and Stories

### 3.1 Technical Writer “Sam”

> *Goal:* Highlight parts of a schematic and number call‑outs for assembly instructions.

1. Opens **File**\*\*:MotorAssembly\*\*\*\*.png\*\*.
2. Clicks **Edit Layers** tab (next to *View history*).
3. Adds translucent yellow rectangles over the PCB area; numbers each with text layers.
4. Saves as new Layer Set *pcb‑callouts*.
5. On product manual page uses:

   ```wikitext
   [[File:MotorAssembly.png|layers=pcb-callouts|thumb|Annotated PCB region]]
   ```

### 3.2 Educator “Anika”

> *Goal:* Reuse a pre‑drawn arrow bundle on multiple microscope images.

* (Optional) Imports **arrow‑trio** from the library, adjusts rotation on each file, then saves.

---

## 4 UI/UX Overview

### 4.1 Entry Points

* **File Page Tab** – Adds *Edit Layers* alongside *Edit*, *History*.
* **Parser Function Link** – `{{#layeredit:File=…}}` for power users.

### 4.2 Editor Layout

```
┌───────────────────────────┐
│ Global Toolbar           │
├────────┬──────────────────┤
│ Layers │  Canvas          │
│ Panel  │                  │
└────────┴──────────────────┘
```

* **Global Toolbar:** tool icons (Pointer, Text, Arrow,…), color picker, font menu, undo/redo, zoom, save.
* **Layers Panel:** sortable list with eye (visibility), lock, thumbnail, name. Context menu → *Save to Library*.
* **Canvas:** Fabric.js‑powered HTML `<canvas>` sized to file’s resolution; realtime overlay rendering.
* **Properties Inspector:** appears as right drawer when an element is selected.

---

## 5 Data Model & Storage Strategy

### 5.1 Terminology

* **Layer Set:** Ordered collection of Layers attached to one base file revision.
* **Library Asset:** Stand‑alone Layer JSON + optional SVG/PNG asset stored in `Layer:` namespace.

### 5.2 On‑Disk Representation

1. **Side‑car JSON** (default) – `Filename.jpg.layers.json` stored in `$wgUploadDirectory/layers/`.

   ```jsonc
   {
     "revision": 3,
     "schema": 1,
     "created": "2025-08-04T19:27:00Z",
     "layers": [
       {
         "id": "uuid‑1",
         "type": "text",
         "text": "Step 1",
         "font": "Roboto",
         "size": 18,
         "fill": "#ff0000",
         "x": 120,
         "y": 80,
         "shadow": { "blur": 2, "offsetX": 1, "offsetY": 1, "color": "#00000080" }
       },
       …
     ]
   }
   ```
2. **Binary Overlay Files** (optional compatibility mode) – `Filename.jpg.l01.png`, `.l02.svg`, … up to `.l99`. Enabled via `$wgLayersUseBinaryOverlays`.

### 5.3 Database Tables

* `layer_sets` – id, img\_name, img\_major\_mime, img\_minor\_mime, img\_sha1, json\_blob MEDIUMBLOB, user\_id, timestamp.
* `layer_assets` – id, title, json\_blob, preview\_sha1, user\_id, timestamp.
* `layer_set_usage` – (layer\_set\_id, page\_id) for *What links here?* tracking.

### 5.4 Revisioning & History

* Every save inserts a new row in `layer_sets`; no overwrite.
* File page gains **Layers** tab showing diff viewer (Fabric.js diff or JSON‑text diff with highlight).

---

## 6 Wikitext Invocation Syntax

### 6.1 Basic

```wikitext
[[File:Example.jpg|layers=on|thumb|Caption]]
```

*Renders with the latest Layer Set bound to current file revision.*

### 6.2 Specify Layer Set ID or Name

```wikitext
[[File:Blueprint.svg|layers=id:1234]]
[[File:Blueprint.svg|layers=name:pcb-callouts]]
```

### 6.3 Selective Layer Subset

```wikitext
[[File:Map.png|layers=+roads,-labels]]   <!-- show only layer group "roads" -->
```

*Syntax accepts **`+`** include / **`-`** exclude by layer name or group tag.*

### 6.4 Legacy Binary Overlay Mode

```wikitext
[[File:Photo.jpg|layers=l01,l03,l07]]
```

*Only available when **`$wgLayersUseBinaryOverlays = true`**.*

### 6.5 Parser Function Helpers

```wikitext
{{#layerlist:File=Example.jpg}}   <!-- returns comma list of layer names -->
{{#layeredit:File=Example.jpg|set=pcb-callouts}}   <!-- edit link button -->
```

---

## 7 Extension Architecture & Integration Points

1. **ResourceLoader (RL):** `ext.layers.editor` bundles Fabric.js, Coloris, Tippy.js; lazy‑loaded only on layer edit pages.
2. **Hooks**

   * `ParserFirstCallInit` – register `layers` attribute + parser functions.
   * `BeforePageDisplay` – enqueue RL if page transcludes a file with `layers=`.
   * `FilePageTabs` – inject *Edit Layers* tab.
   * `FileDeleteComplete` – prune orphaned `layer_sets` rows.
3. **API**

   * `ApiLayersSave` – CSRF‑protected; accepts JSON payload; validates schema; stores side‑car + DB row.
   * `ApiLayersInfo` – returns layer set metadata for thumbnails.
4. **Thumbnail Pipeline** – Extends `File::transform()`; when `layers=` param present, merge overlay via ImageMagick (`convert`) or librsvg for SVGs; result cached in `thumb_hash` directory.

---

## 8 Permissions and Security

* Each JSON payload is sanitised; text layers are HTML‑escaped.• SVG icons pass through *Safe SVG* sanitizer.• Max JSON size (`$wgLayersMaxBytes`, default 2 MiB) enforced.
* Rights integrated with `$wgGroupPermissions`.
* Rate limiting via `$wgRateLimits['editlayers']` bucket.

---

## 9 Accessibility & Internationalisation

* All icons are `<svg>` with `aria‑label`.
* Text layers store language code; rendered `<text xml:lang="…">`.
* Contrast checker warns if fill # luminance ratio < 4.5.
* UI texts made translatable via Translate extension.

---

## 10 Performance Considerations

* Debounced auto‑save (every 30 s) to avoid large JSON blobs.
* Client‑side off‑screen canvas for live preview; server merge only on save or thumbnail generation.
* Purge layer thumbnails when base file or layer set updated.

---

## 11 Configuration Variables

| Variable                     | Type  | Default                         | Description                  |
| ---------------------------- | ----- | ------------------------------- | ---------------------------- |
| `$wgLayersEnable`            | bool  | true                            | Master switch.               |
| `$wgLayersUseBinaryOverlays` | bool  | false                           | Enable `.l01` overlay files. |
| `$wgLayersMaxBytes`          | int   | 2 \* 1024²                      | Max JSON size per save.      |
| `$wgLayersDefaultFonts`      | array | \["Arial","Roboto","Noto Sans"] | Font list shown in editor.   |
| `$wgLayersAllowedGroups`     | array | \["editor","sysop"]             | Groups with `editlayers`.    |

---

## 12 Install & Upgrade (sysadmin view)

```bash
cd extensions
git clone https://github.com/your-org/Layers.git
cd Layers && composer install
```

Add to `LocalSettings.php`:

```php
wfLoadExtension( 'Layers' );
$wgLayersEnable = true;
$wgGroupPermissions['editor']['editlayers'] = true;
```

Run update:

```
php maintenance/update.php
```

---

## 13 Roadmap / Future Work

1. **Vector‑Markup Export** – Full SVG export with embedded layers.
2. **Comment Threads** on individual layers for peer review.
3. **Batch Layer Application** across file categories.
4. **Mobile Editing UI** (utilizing OOUI mobile widgets).
5. **AI Suggest** – Auto‑detect objects & propose annotation shapes.

---

### Appendix A – JSON Schema Snippet

```jsonc
"layer": {
  "type": "object",
  "required": ["id", "type"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-f0-9-]{36}$" },
    "type": { "enum": ["text", "arrow", "shape", "icon", "highlight"] },
    "x": { "type": "number" },
    "y": { "type": "number" },
    "rotation": { "type": "number" },
    "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
    …
  }
}
```

---

**End of Specification – v0.9 (2025‑08‑04)**
