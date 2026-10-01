# Using Layers in Wiki Articles

> **Current guidance — September 6, 2026:** For maintained user examples see [Wikitext syntax](../wiki/Wikitext-Syntax.md). Parameters choose shared image/PDF/slide content, not an owner-page revision. Intent-like set names can still be ambiguous; use descriptive names.

## Layer Control in File Syntax

The Layers extension supports controlling which layers are displayed using the `layerset=` parameter in standard MediaWiki file syntax:

```text
[[File:ImageTest02.jpg|500px|layerset=on|Your caption]]
```

> **Note:** `layers=` is also supported for backwards compatibility. Both parameters work identically; `layerset=` is preferred as it's more descriptive.

Note: Overlays are opt-in. Layers are rendered only when the `layerset` parameter is present and set to a supported value (e.g., `on`, a named set, or a list of layer IDs). If `layerset` is omitted or set to `none`/`off`, only the original image is shown.

## Layer Parameter Options

### Show Current Layer Set

```text
[[File:MyImage.jpg|500px|layerset=on|Caption]]
```

### Show a Named Layer Set

If you have multiple named layer sets for an image (e.g., "anatomy", "labels"), specify the set name:

```text
[[File:MyImage.jpg|500px|layerset=anatomy|Caption]]
[[File:MyImage.jpg|500px|layerset=labels|Caption]]
```

If the named set doesn't exist, no layers are displayed (the image shows without any overlays).

### Hide All Layers (Normal Image)

```text
[[File:MyImage.jpg|500px|layerset=none|Caption]]
```
or:
```text
[[File:MyImage.jpg|500px|layerset=off|Caption]]
```
or simply omit the layerset parameter:

```text
[[File:MyImage.jpg|500px|Caption]]
```

### Show Specific Layers by ID
Use short layer IDs (first 4 characters) separated by commas:

```text
[[File:MyImage.jpg|500px|layerset=4bfa,77e5,0cf2|Caption]]
```

## File: Pages

Layers are **not** automatically displayed on File: pages. To show layers on a file page, you must explicitly add the `layerset=on` or `layerset=setname` parameter in the wikitext.

## Getting Layer IDs

When editing layers in the MediaWiki editor:

1. Open any file page and click "Edit Layers"
2. In the layer panel on the right, you'll see a "Wikitext Code" section
3. Toggle layer visibility to see different code examples
4. Click "Copy" to copy the layerset parameter to your clipboard
5. Use this in your wikitext

## Editor Features for Wikitext

The layer editor automatically shows you the correct wikitext code:

- **All layers visible**: Shows `layerset=on`
- **Some layers visible**: Shows `layerset=4bfa,77e5,0cf2` (example IDs)
- **No layers visible**: Shows message to enable layers

Click the "Copy" button next to any code sample to copy just the `layerset=` parameter.

## Examples

Display a technical diagram with only annotation layers:

```text
[[File:Circuit-Board.jpg|800px|layerset=anno,labels|PCB with annotations]]
```

Show layers from the default set:

```text
[[File:My-Artwork.png|thumb|layerset=on|Complete layered artwork]]
```

Show layers from a specific named set:

```text
[[File:Anatomy-Diagram.jpg|600px|layerset=organs|Organ overlay]]
[[File:Anatomy-Diagram.jpg|600px|layerset=skeleton|Skeletal overlay]]
```

Display base image without any layers:

```text
[[File:Photo.jpg|600px|layerset=none|Original photo without annotations]]
```

## Using layerset= in Templates

`layerset=` works inside MediaWiki templates, including complex structures like
PageForms multi-instance templates. As of v1.5.66, template-embedded file
references are fully supported.

### Simple template usage

```wikitext
{{MyTemplate|image=Example.jpg|caption=Annotated diagram}}
```

Where the template contains:

```wikitext
[[File:{{{image|}}}|500px|layerset=on|{{{caption|}}}]]
```

### PageForms multi-instance template pattern

A common pattern is a manager/row template pair where the row template
contains the `[[File:...|layerset=...]]` reference:

**Row template** (`Template:MyImageRow`):
```wikitext
<includeonly>[[File:{{{image|}}}|x300px|layerset={{{layerset|on}}}]]</includeonly>
```

**Manager template** (`Template:MyImageTable`):
```wikitext
<noinclude>{{{instances|}}}</noinclude>
```

**Page wikitext:**
```wikitext
{{MyImageTable|instances=
  {{MyImageRow|image=Diagram1.jpg|layerset=default}}
  {{MyImageRow|image=Diagram2.jpg|layerset=anatomy}}
}}
```

> **Note:** The `<noinclude>` wrapper in the manager template prevents double
> rendering of the row templates (they expand once as argument values; without
> the wrapper they would expand a second time when the manager template body
> substitutes the `{{{instances}}}` variable).

### Limitations

- Each `[[File:...|layerset=...]]` call in a template is matched to its layer
  data by render order per file. If the same image appears multiple times on
  a page (both inside and outside templates), the overlays are matched by the
  order in which MediaWiki processes them.
- Template-embedded files are not visible to the wikitext pre-scan hook
  (which fires before template expansion). The extension handles this via a
  fallback registration in `onParserMakeImageParams`.

## Gallery Support (v1.5.73–1.5.75)

Named layer sets can be displayed in both native MediaWiki `<gallery>` blocks
and Cargo `format=gallery` queries using per-image `layerset=` options.

### Native `<gallery>` Blocks (v1.5.75)

Add `|layerset=setname` to any image line inside a `<gallery>` block:

```text
<gallery mode="packed" widths=200>
File:Anatomy-Diagram.jpg|layerset=anatomy|Anatomical labels
File:Physiology-Chart.jpg|layerset=physiology
File:Plain-Image.jpg|No layerset — shows latest available set
</gallery>
```

- Images with `|layerset=setname` show the named set.
- Images with no `layerset=` fall back to `layerset=on` semantics (latest
  available set, if any).
- The `layerset=` option is stripped before rendering so it does not appear
  as visible caption text.

### Cargo `format=gallery` (v1.5.74)

If your Cargo table has a `layerset` field, include it in your `format=gallery`
query and the correct named set is shown per image automatically — no template
changes required:

```text
{{#cargo_query:tables=MyImages
 |fields=Image, layerset, Caption
 |where=_pageName='{{PAGENAME}}'
 |format=gallery|mode=packed|image width=200|image height=200}}
```

The extension detects the `layerset` field in the query results and
pre-registers per-image hints before the gallery renders thumbnails.

**If your set-name field has a different name**, add `layerset field=yourfield`:

```text
{{#cargo_query:tables=MyImages|fields=Image, setname
 |format=gallery|layerset field=setname|...}}
```

### Pre-registering Hints: `{{#layers_hint:}}` (v1.5.73)

For custom gallery sources or other edge cases, you can pre-register a
per-image hint manually using the `{{#layers_hint:}}` parser function:

```text
{{#layers_hint:Foo.jpg|anatomy}}
```

This must appear before the gallery renders. It returns empty string (no
visible output). This is the low-level building block that v1.5.74 and
v1.5.75 use internally; in most cases you should prefer the automatic
detection described above.

### Page-owned layer-set data in Cargo: `{{#layers_cargo_store:}}` (pilot)

On a page whose layer sets are part of its revision history, Cargo can store
either one row per stored surface (the existing mode) or, in a separate table,
one row per layer that contains text or a link. For PDF content, each stored
annotated-page surface gets its own row in the existing mode. The parser
function shows no output for either supported mode and is available only when
Cargo is installed.
The two modes can be used on the same page by including both templates below;
they must use different Cargo tables because their fields differ.

Create a template for the existing one-row-per-surface mode. Keep its field
names when upgrading a table that already uses this mode:

```text
<noinclude>{{#cargo_declare:_table=Page_layer_sets
 |surface_id=String
 |surface_label=String
 |surface_kind=String
 |source_file=Page
 |source_page=Integer
 |drawing_text=Text}}</noinclude><includeonly>{{#layers_cargo_store:}}</includeonly>
```

The `drawing_text` column name is retained for compatibility with existing
tables. It contains visible text from text, text box and callout layers.
`surface_kind` is `slide`, `image` or `pdf`; `source_file` and `source_page`
are populated for image and PDF layer sets. Rows describe the page's current
revision and are replaced on page saves, including a save that changes only
a layer set. Recreating the table's data rebuilds them. Only page-owned layer
sets are stored; shared layer sets on files are not.

For per-layer rows, create a second template and table. The `page` field holds
the owning page's database key (underscores are retained); `text` follows the
existing search projection, and `link_target` is the layer's link value.
Cargo is given all eight fields, with unused fields empty:

```text
<noinclude>{{#cargo_declare:_table=Page_layer_rows
 |page=String
 |revision=Integer
 |layer_set=String
 |kind=String
 |layer=String
 |type=String
 |text=Text
 |link_target=Text}}</noinclude><includeonly>{{#layers_cargo_store:_table=Page_layer_rows|_rows=layers}}</includeonly>
```

Add both templates to the owner page, create or recreate each table from its
template page, then query either table:

```text
{{Page_layer_sets}}
{{Page_layer_rows}}

{{#cargo_query:tables=Page_layer_rows
 |fields=page, revision, layer_set, kind, layer, type, text, link_target
 |where=text LIKE '%valve%'}}
```

`_rows=layers` is the opt-in switch; without it, the existing one-row-per-stored-surface
projection is unchanged. Each per-layer row contains the layer ID and type,
plain visible text, and link target. A link-only layer is included with empty
`text`. Hidden text and layers with neither projected text nor a link create no
row. As with the existing mode, only the current readable page-owned revision
is stored; hidden revision content and shared layer sets are not exposed.
An unsupported `_rows` value produces a translated error rather than silently
falling back to either mode.

### Values from the page in drawing text: `{{#layers_fields:}}`

A drawing can show values that the page showing it supplies, such as data
from a Cargo query. Type `{{name}}` in a text, text box or callout layer in
the editor, then give the value on the page:

```text
{{#layers_fields: presentation
 | pressure = {{#cargo_query:tables=Pumps|fields=pressure|where=tag='P-101'|no html}}
 | status = Running
}}
```

- The first parameter names the drawing:
  - a shared layer set of a file: `File:Pump.png` (any file namespace alias
    works). The values apply to every layer set of that file the page shows;
  - a slide: `Slide:Line_overview`;
  - a page-owned drawing (page history pilot): its ID, the last part of its
    `layersbinding=` (`v1:228:presentation` → `presentation`).
- Each `name = value` is expanded like any wikitext and shown as plain text:
  links keep their text, formatting and tags are dropped. Names use letters,
  digits, spaces, dots, `-` and `_`; values are cut at 1,000 characters.
  Several calls may give values for the same drawing; if one name gets two
  different values, its token stays as typed.
- Values are ordinary page output, so they update whenever the page is
  rendered again (an edit, a purge or parser cache expiry), exactly like a
  `#cargo_query` shown in the page text.
- They are shown where the page shows the drawing, including its full-size
  view, print and download. The editor, the history viewer, diffs, search,
  server-rendered thumbnails and PDF exports, and `{{#layers_cargo_store:}}`
  see the `{{name}}` tokens as typed. A token whose name the page does not give stays
  as typed. Formatting must cover the whole token in rich text, because each
  formatted run is filled on its own.
- The function shows nothing, or an error in its place when a parameter is
  malformed. At most 100 fields per drawing and 50 drawings per page.

---

## How It Works

The extension automatically:

1. Detects the `layerset=` (or `layers=`) parameter in your wikitext
2. Looks up layer data for the specified image
3. Renders only the requested layers
4. Generates a composite thumbnail on the server (cached like normal thumbs)
5. Caches the result for performance


## Deep Linking with layerslink

*New in v1.2.2, improved in v1.2.5*

Control what happens when users click on layered images:

```text
<!-- Click opens the layer editor with the specified set -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor]]

<!-- Click opens fullscreen lightbox viewer -->
[[File:Diagram.png|layerset=anatomy|layerslink=viewer]]
```

| Value | Effect |
|-------|--------|
| (none) | Standard link to File: page |
| `editor` | Opens layer editor; closes back to originating page |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

> **Note:** `layerslink` requires `layerset=on` or `layerset=<setname>` to be present.

> **v1.2.5 Change:** When using `layerslink=editor` from an article page, closing the editor now returns you to the article (not the File: page). This is now the default behavior.

### Advanced Editor Link Modes (v1.2.5+)

For additional control over editor behavior:

```text
<!-- Opens editor in a new browser tab -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor-newtab]]

<!-- Opens editor in a modal overlay without navigating away -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor-modal]]
```

| Value | Effect |
|-------|--------|
| `editor-newtab` | Opens editor in new browser tab (original page preserved) |
| `editor-modal` | Opens editor in an iframe overlay on top of current page |

**Modal Mode Benefits:**
- **No page navigation** - Perfect for Page Forms or complex editing workflows
- **Preserves form data** - Your unsaved form data is protected
- **Inline editing** - Edit layers without leaving your current context
- **Keyboard support** - Press Escape to close the modal
- **Accessible** - Full ARIA support for screen readers

**JavaScript Events (Modal Mode):**

When using `layerslink=editor-modal`, your page can listen for these events:

```javascript
// Fires when the modal closes (saved or cancelled)
document.addEventListener('layers-modal-closed', function(e) {
    console.log('Modal closed, saved:', e.detail.saved);
    if (e.detail.saved) {
        // Optionally refresh layered image preview
    }
});

// Fires whenever layers are saved (can fire multiple times)
document.addEventListener('layers-saved', function(e) {
    console.log('Layers saved:', e.detail.filename);
});
```

You can also link directly to the editor via URL:
```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy
```

## Performance Notes

- Layered thumbnails are cached just like normal thumbnails
- Only images with layer data are processed
- Fallback to normal images if layer rendering fails
- Specific layer selection is more efficient than `layerset=all`
