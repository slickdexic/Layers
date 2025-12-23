# Wikitext Syntax

Complete reference for using Layers in wikitext.

---

## Basic Syntax

Add the `layers` parameter to any file link to display annotations:

```wikitext
[[File:Example.jpg|layers=on]]
```

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
[[File:Diagram.png|layers=on]]

<!-- Explicit default set -->
[[File:Diagram.png|layers=default]]

<!-- Named set -->
[[File:Heart.png|layers=anatomy]]
[[File:Heart.png|layers=blood-flow]]

<!-- Disable layers (image only) -->
[[File:Diagram.png|layers=off]]
[[File:Diagram.png|layers=none]]
```

---

## Combining with Image Parameters

The `layers` parameter works with all standard MediaWiki image parameters:

### Thumbnails

```wikitext
[[File:Diagram.png|thumb|layers=on|Diagram with annotations]]
[[File:Diagram.png|thumb|300px|layers=anatomy|Anatomical labels]]
```

### Alignment

```wikitext
[[File:Diagram.png|left|layers=on]]
[[File:Diagram.png|center|layers=on]]
[[File:Diagram.png|right|layers=on]]
```

### Size

```wikitext
[[File:Diagram.png|200px|layers=on]]
[[File:Diagram.png|300x200px|layers=on]]
[[File:Diagram.png|upright=1.5|layers=on]]
```

### Border and Framing

```wikitext
[[File:Diagram.png|border|layers=on]]
[[File:Diagram.png|frame|layers=on|Caption text]]
[[File:Diagram.png|frameless|layers=on]]
```

### Complete Example

```wikitext
[[File:Human_Heart.png|thumb|400px|right|border|layers=anatomy|
Human heart with anatomical labels]]
```

---

## Link Behavior (layerslink)

*New in v1.2.0*

Control what happens when users click on layered images with the `layerslink` parameter:

| Value | Effect |
|-------|--------|
| (none) | Standard MediaWiki link to File page |
| `editor` | Opens the layer editor for this image |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

### Examples

```wikitext
<!-- Click opens the layer editor -->
[[File:Diagram.png|layers=anatomy|layerslink=editor]]

<!-- Click opens fullscreen lightbox viewer -->
[[File:Diagram.png|layers=anatomy|layerslink=viewer]]

<!-- Lightbox is an alias for viewer -->
[[File:Diagram.png|layers=anatomy|layerslink=lightbox]]

<!-- Default behavior: click goes to File page -->
[[File:Diagram.png|layers=anatomy]]
```

### Use Cases

**Educational content** — Let students view annotations in a lightbox:
```wikitext
[[File:Cell_Diagram.png|thumb|300px|layers=organelles|layerslink=viewer|
Click to view labeled organelles]]
```

**Collaborative editing** — Direct users to the editor:
```wikitext
[[File:Project_Map.png|thumb|400px|layers=draft|layerslink=editor|
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
- `layers` — Alias for `setname`

---

## File Pages

On **File:** pages, layers are **NOT automatically displayed**. You must explicitly enable them.

### Display layers on a File page

Add to the file description:

```wikitext
== With Annotations ==
[[File:{{PAGENAME}}|600px|layers=on]]
```

### Show multiple layer sets

```wikitext
== Annotation Sets ==

=== Anatomical Labels ===
[[File:{{PAGENAME}}|500px|layers=anatomy]]

=== Blood Flow ===
[[File:{{PAGENAME}}|500px|layers=blood-flow]]
```

---

## Templates

### Basic Layer Template

Create `Template:LayeredImage`:

```wikitext
<includeonly>[[File:{{{1}}}|{{{size|400px}}}|{{{align|center}}}|layers={{{set|on}}}|{{{caption|}}}]]</includeonly>
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
File:Image1.png|layers=on|First image
File:Image2.png|layers=labels|Second image
File:Image3.png|layers=off|Third image (no layers)
</gallery>
```

---

## Conditional Display

### Show layers only for logged-in users

Using ParserFunctions extension:

```wikitext
[[File:Diagram.png|400px|layers={{#if:{{#username}}|on|off}}]]
```

### Different sets for different contexts

```wikitext
{{#switch: {{{level|basic}}}
 | basic = [[File:Diagram.png|layers=overview]]
 | advanced = [[File:Diagram.png|layers=detailed]]
 | expert = [[File:Diagram.png|layers=technical]]
}}
```

---

## Behavior Notes

### Non-existent Sets

If a named set doesn't exist, **no layers are displayed** (silent failure). The image shows without annotations.

```wikitext
<!-- If "nonexistent" set doesn't exist, shows image only -->
[[File:Diagram.png|layers=nonexistent]]
```

### Case Sensitivity

Set names are **case-sensitive**:

```wikitext
[[File:Diagram.png|layers=Anatomy]]   <!-- Different from -->
[[File:Diagram.png|layers=anatomy]]   <!-- this -->
```

### Parameter Order

The `layers` parameter can appear anywhere in the parameter list:

```wikitext
<!-- These are equivalent -->
[[File:Diagram.png|layers=on|thumb|300px]]
[[File:Diagram.png|thumb|layers=on|300px]]
[[File:Diagram.png|thumb|300px|layers=on]]
```

---

## Comparison Table

| Wikitext | Result |
|----------|--------|
| `[[File:X.png]]` | Image only, no layers |
| `[[File:X.png\|layers=on]]` | Image + default layers |
| `[[File:X.png\|layers=default]]` | Image + default layers |
| `[[File:X.png\|layers=anatomy]]` | Image + "anatomy" layers |
| `[[File:X.png\|layers=off]]` | Image only, explicitly no layers |
| `[[File:X.png\|layers=none]]` | Image only, explicitly no layers |

---

## Troubleshooting

### Layers not showing

1. **Check the set exists** — Open the File: page and verify annotations are saved
2. **Check the set name** — Names are case-sensitive
3. **Check permissions** — User needs read access to the file

### Wrong layers showing

1. **Verify set name** — Ensure you're using the correct named set
2. **Check for typos** — `layers=anotomy` ≠ `layers=anatomy`
3. **Clear cache** — Purge the page: add `?action=purge` to URL

### Layers parameter ignored

1. **Check extension is enabled** — Verify in Special:Version
2. **Check `$wgLayersEnable`** — Must be `true` in LocalSettings.php
3. **Check file exists** — Layers only work on existing files

---

## See Also

- [[Named Layer Sets]] — Creating and managing sets
- [[Quick Start Guide]] — Getting started
- [[Configuration Reference]] — Extension settings
