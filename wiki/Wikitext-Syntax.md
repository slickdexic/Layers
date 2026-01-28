# Wikitext Syntax

Complete reference for using Layers in wikitext.

---

## Basic Syntax

Add the `layerset` parameter to any file link to display annotations:

```wikitext
[[File:Example.jpg|layerset=on]]
```

> **Note:** `layers=` is also supported for backwards compatibility. Both parameters work identically.

---

## Parameter Values

| Value | Effect |
|-------|--------|
| `on` | Display the default layer set |
| `default` | Display the default layer set (explicit) |
| `<setname>` | Display a specific named layer set |
| `off` | Explicitly disable layers |
| `none` | Explicitly disable layers (alternative) |

### Examples

```wikitext
<!-- Enable default layers -->
[[File:Diagram.png|layerset=on]]

<!-- Explicit default set -->
[[File:Diagram.png|layerset=default]]

<!-- Named set -->
[[File:Heart.png|layerset=anatomy]]
[[File:Heart.png|layerset=blood-flow]]

<!-- Disable layers (image only) -->
[[File:Diagram.png|layerset=off]]
[[File:Diagram.png|layerset=none]]
```

---

## Combining with Image Parameters

The `layerset` parameter works with all standard MediaWiki image parameters:

### Thumbnails

```wikitext
[[File:Diagram.png|thumb|layerset=on|Diagram with annotations]]
[[File:Diagram.png|thumb|300px|layerset=anatomy|Anatomical labels]]
```

### Alignment

```wikitext
[[File:Diagram.png|left|layerset=on]]
[[File:Diagram.png|center|layerset=on]]
[[File:Diagram.png|right|layerset=on]]
```

### Size

```wikitext
[[File:Diagram.png|200px|layerset=on]]
[[File:Diagram.png|300x200px|layerset=on]]
[[File:Diagram.png|upright=1.5|layerset=on]]
```

### Border and Framing

```wikitext
[[File:Diagram.png|border|layerset=on]]
[[File:Diagram.png|frame|layerset=on|Caption text]]
[[File:Diagram.png|frameless|layerset=on]]
```

### Complete Example

```wikitext
[[File:Human_Heart.png|thumb|400px|right|border|layerset=anatomy|
Human heart with anatomical labels]]
```

---

## Link Behavior (layerslink)

*New in v1.2.0, improved in v1.2.5*

Control what happens when users click on layered images with the `layerslink` parameter:

> **Note:** `layerslink` must be used together with `layerset`. It controls the click behavior for images that have layers enabled. Without `layerset=on` or `layerset=<setname>`, the `layerslink` parameter has no effect.

| Value | Effect |
|-------|--------|
| (none) | Standard MediaWiki link to File page |
| `editor` | Opens the layer editor; returns to originating page on close |
| `editor-newtab` | Opens editor in a new browser tab |
| `editor-modal` | Opens editor in overlay without navigation |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

> **v1.2.5 Change:** When using `layerslink=editor` from an article page, closing the editor now returns you to the article (not the File: page). This is the default behavior.

### Examples

```wikitext
<!-- Click opens the layer editor with the 'anatomy' set -->
<!-- Closing the editor returns you to THIS page -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor]]

<!-- Click opens the layer editor with the default set -->
[[File:Diagram.png|layerset=on|layerslink=editor]]

<!-- Click opens fullscreen lightbox viewer -->
[[File:Diagram.png|layerset=anatomy|layerslink=viewer]]

<!-- Lightbox is an alias for viewer -->
[[File:Diagram.png|layerset=anatomy|layerslink=lightbox]]

<!-- Default behavior: click goes to File page -->
[[File:Diagram.png|layerset=anatomy]]
```

### Advanced Editor Modes (v1.2.5+)

For additional control over editor behavior:

```wikitext
<!-- Opens editor in a new browser tab -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor-newtab]]

<!-- Opens editor in modal overlay (no navigation) -->
[[File:Diagram.png|layerset=anatomy|layerslink=editor-modal]]
```

**Modal Mode** is ideal for Page Forms because:
- No page navigation occurs
- Your unsaved form data is preserved
- Press Escape or the X button to close
- JavaScript events for integration (`layers-modal-closed`, `layers-saved`)

> **⚠️ Configuration Required:** Modal mode uses an iframe, which MediaWiki blocks by default. Add to `LocalSettings.php`:
> ```php
> $wgEditPageFrameOptions = 'SAMEORIGIN';
> ```

### Use Cases

**Educational content** — Let students view annotations in a lightbox:
```wikitext
[[File:Cell_Diagram.png|thumb|300px|layerset=organelles|layerslink=viewer|
Click to view labeled organelles]]
```

**Collaborative editing** — Direct users to the editor:
```wikitext
[[File:Project_Map.png|thumb|400px|layerset=draft|layerslink=editor|
Click to add your annotations]]
```

---

## Deep Linking to Editor

*New in v1.2.0*

You can link directly to the editor with a specific layer set pre-loaded using URL parameters:

```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy
```

Supported URL parameters:
- `setname` — Layer set name to load
- `layerset` — Alias for `setname`
- `layers` — Alias for `setname` (backwards compatibility)

---

## File Pages

On **File:** pages, layers are **NOT automatically displayed**. You must explicitly enable them.

### Display layers on a File page

Add to the file description:

```wikitext
== With Annotations ==
[[File:{{PAGENAME}}|600px|layerset=on]]
```

### Show multiple layer sets

```wikitext
== Annotation Sets ==

=== Anatomical Labels ===
[[File:{{PAGENAME}}|500px|layerset=anatomy]]

=== Blood Flow ===
[[File:{{PAGENAME}}|500px|layerset=blood-flow]]
```

---

## Templates

### Basic Layer Template

Create `Template:LayeredImage`:

```wikitext
<includeonly>[[File:{{{1}}}|{{{size|400px}}}|{{{align|center}}}|layerset={{{set|on}}}|{{{caption|}}}]]</includeonly>
<noinclude>
== Usage ==
<code><nowiki>{{LayeredImage|Filename.png|size=300px|set=anatomy|caption=Description}}</nowiki></code>

=== Parameters ===
* '''1''' (required) - Filename
* '''size''' - Image size (default: 400px)
* '''align''' - Alignment (default: center)
* '''set''' - Layer set name (default: on)
* '''caption''' - Image caption
</noinclude>
```

Usage:
```wikitext
{{LayeredImage|Heart.png|size=500px|set=anatomy|caption=Human heart}}
```

### Gallery with Layers

```wikitext
<gallery mode="packed" heights=200>
File:Image1.png|layerset=on|First image
File:Image2.png|layerset=labels|Second image
File:Image3.png|layerset=off|Third image (no layers)
</gallery>
```

---

## Conditional Display

### Show layers only for logged-in users

Using ParserFunctions extension:

```wikitext
[[File:Diagram.png|400px|layerset={{#if:{{#username}}|on|off}}]]
```

### Different sets for different contexts

```wikitext
{{#switch: {{{level|basic}}}
 | basic = [[File:Diagram.png|layerset=overview]]
 | advanced = [[File:Diagram.png|layerset=detailed]]
 | expert = [[File:Diagram.png|layerset=technical]]
}}
```

---

## Behavior Notes

### Non-existent Sets

If a named set doesn't exist, **no layers are displayed** (silent failure). The image shows without annotations.

```wikitext
<!-- If "nonexistent" set doesn't exist, shows image only -->
[[File:Diagram.png|layerset=nonexistent]]
```

### Case Sensitivity

Set names are **case-sensitive**:

```wikitext
[[File:Diagram.png|layerset=Anatomy]]   <!-- Different from -->
[[File:Diagram.png|layerset=anatomy]]   <!-- this -->
```

### Parameter Order

The `layerset` parameter can appear anywhere in the parameter list:

```wikitext
<!-- These are equivalent -->
[[File:Diagram.png|layerset=on|thumb|300px]]
[[File:Diagram.png|thumb|layerset=on|300px]]
[[File:Diagram.png|thumb|300px|layerset=on]]
```

---

## Slide Mode (v1.5.22+)

Create standalone graphics without a base image using the `{{#Slide:}}` parser function:

```wikitext
{{#Slide: MySlideName}}
```

**Like images, slides support multiple named layer sets** for different annotation variations.

### Slide Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `layerset` | Named layer set to display | `layerset=english` |
| `canvas` | Canvas size (WxH) | `canvas=1920x1080` |
| `size` | Display size | `size=800x600` |
| `bgcolor` | Background color | `bgcolor=#f0f0f0` |
| `noedit` | Hide edit overlay button | `noedit` |
| `class` | CSS classes | `class=my-diagram` |

### Examples

```wikitext
<!-- Basic slide (default layer set) -->
{{#Slide: MyDiagram}}

<!-- Specific named layer set -->
{{#Slide: MyDiagram | layerset=english}}
{{#Slide: MyDiagram | layerset=spanish}}

<!-- Custom canvas and display size -->
{{#Slide: Infographic | canvas=1200x800 | size=600x400}}

<!-- With background color -->
{{#Slide: Blueprint | bgcolor=#e8f4fc}}

<!-- View-only mode (no edit button) -->
{{#Slide: Published | noedit}}

<!-- Combined: specific layer set with styling -->
{{#Slide: Technical | layerset=detailed | size=800x600 | bgcolor=#fff}}
```

See [[Slide Mode]] for complete documentation.

---

## Backwards Compatibility

The `layers=` parameter is still fully supported for backwards compatibility:

```wikitext
<!-- These are equivalent -->
[[File:Diagram.png|layerset=on]]
[[File:Diagram.png|layers=on]]
```

---

## Comparison Table

| Wikitext | Result |
|----------|--------|
| `[[File:X.png]]` | Image only, no layers |
| `[[File:X.png\|layerset=on]]` | Image + default layers |
| `[[File:X.png\|layerset=default]]` | Image + default layers |
| `[[File:X.png\|layerset=anatomy]]` | Image + "anatomy" layers |
| `[[File:X.png\|layerset=off]]` | Image only, explicitly no layers |
| `[[File:X.png\|layerset=none]]` | Image only, explicitly no layers |
| `[[File:X.png\|layers=on]]` | Image + default layers (backwards compatible) |

---

## Troubleshooting

### Layers not showing

1. **Check the set exists** — Open the File: page and verify annotations are saved
2. **Check the set name** — Names are case-sensitive
3. **Check permissions** — User needs read access to the file

### Wrong layers showing

1. **Verify set name** — Ensure you're using the correct named set
2. **Check for typos** — `layerset=anotomy` ≠ `layerset=anatomy`
3. **Clear cache** — Purge the page: add `?action=purge` to URL

### Layers parameter ignored

1. **Check extension is enabled** — Verify in Special:Version
2. **Check `$wgLayersEnable`** — Must be `true` in LocalSettings.php
3. **Check file exists** — Layers only work on existing files

---

## See Also

- [[Named Layer Sets]] — Creating and managing sets
- [[Slide Mode]] — Standalone graphics without base images
- [[Quick Start Guide]] — Getting started
- [[Configuration Reference]] — Extension settings
