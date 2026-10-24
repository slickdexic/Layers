# Wikitext Syntax

> **Candidate guidance — October 24, 2026:** After [migration completion](../docs/UPGRADING.md), bare names select this page's own layer sets. Save captures changes in native owner-page history. `layerset=on` selects `Default`; it does not select the most recently saved shared set. Tagged 1.5.95 uses the older shared model. `noedit` and hidden controls are not authorization. Milestone 1 acceptance remains open.

Use **Edit layers** and **View full size** on the embed (hover, focus or tap). Author-facing wikitext contains names only, never owner page IDs or internal binding tokens. The same name on another owner or another file identifies an independent set. A PDF keeps one visible set name across all its pages.

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
| `on` | After completion, display this owner/file's `Default` set; eligible editors can create it when absent |
| `default` | Explicit name; compares alike with `Default` in native storage |
| `<setname>` | Display a specific named layer set |
| `off` | Explicitly disable layers |
| `none` | Explicitly disable layers (alternative) |

### Examples

```wikitext
<!-- Display this page's Default layer set -->
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

## PDF page selection

Use MediaWiki's native `page=` option with the same visible set name:

```wikitext
[[File:Manual.pdf|page=1|400px|layerset=001]]
[[File:Manual.pdf|page=2|400px|layerset=001]]
```

Page 2 selects its own member of `001`, never page 1's stored layers. Empty
members are not replacements for other members. Historical views use the saved
source version; a new upload must not silently replace it.

Use one unambiguous layer selector per occurrence. Conflicting duplicate
`layerset`/`layers` options are refused in the native Default path. A pipe
inside a linked caption is not another top-level selector. Templates and
galleries retain occurrence-specific names and native PDF page options. The
owning page is the page whose revision is being rendered, not a global file set.

## Legacy host-link options (layerslink)

*New in v1.2.0, improved in v1.2.5*

The following options belong to the retained host-link compatibility path. They are separate from the page-owned **Edit layers** and **View full size** overlay buttons. Use the overlay for the exact owning-page entry; do not assume a legacy File action selects another article's set. The table describes the legacy link modes, not new page-owned admission authority.

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

<!-- Click opens the layer editor with the current set -->
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

## Deep linking to the editor

For page-owned content, use the generated **Edit layers** overlay URL. It retains the owner, exact admitted embed and return destination. Do not construct an article editor URL by substituting a File title.

The following older File action remains a compatibility entry point. After completion it selects only content owned by that File page, or shows its available entries; it does not select another article's set:

```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy
```

Supported URL parameters:
- `setname` — Layer set name to load
- `layerset` — Alias for `setname`
- `layers` — Alias for `setname` (backwards compatibility)

---

## File Pages

An explicit layered embed on a **File:** description belongs to that File page after completion. It is independent of the same file embedded on an article. The old File-page edit tab is retired; use the embed overlay. Existing MediaWiki file links and descriptions remain. These optional headings are author-written examples, not headings automatically added by Layers.

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

### Gallery with layers

```wikitext
<gallery mode="packed" heights=200>
File:Image1.png|layerset=on|First image
File:Image2.png|layerset=labels|Second image
File:Image3.png|layerset=off|Third image (no layers)
</gallery>
```

---

## Conditional Display

### Reader-specific visibility

Layers does not provide a user-name parser function or per-reader access rules for individual annotations. Do not use conditional wikitext as access control; page output may be cached and shared. Use the wiki's permission system for protected content.

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

An absent named set must not substitute another saved set. An eligible authorized editor can use its creation overlay to open an empty set. Readers do not gain editing permission. Source, owner or revision failures may instead make the view unavailable.

```wikitext
<!-- Select this name only; do not substitute another saved set -->
[[File:Diagram.png|layerset=nonexistent]]
```

### Name comparison

Page-owned names compare without case differences; spaces and underscores normalize alike. Stored spelling remains the visible label. These select the same name within the same owner/file scope:

```wikitext
[[File:Diagram.png|layerset=Anatomy]]
[[File:Diagram.png|layerset=anatomy]]
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

## Slide mode

Create standalone graphics without a base image using the `{{#Slide:}}` parser function:

```wikitext
{{#Slide: MySlideName}}
```

After completion the first argument selects this page's saved slide name. Migrated variants may have names such as `MyDiagram (english)`; use the actual saved name, without an owner ID. See [Slide Mode](Slide-Mode.md) for the current workflow and the separately labelled legacy options.

The following option table/examples describe the older shared-slide model.
They do not override the saved native slide name or geometry after completion.

### Legacy shared-slide parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `layerset` | Named layer set to display | `layerset=english` |
| `canvas` | Canvas size (WxH) | `canvas=1920x1080` |
| `size` | Display size | `size=800x600` |
| `background` | Background color | `background=#f0f0f0` |
| `noedit` | Hide edit overlay button | `noedit` |
| `class` | CSS classes | `class=my-diagram` |

### Examples

```wikitext
<!-- Basic slide (current layer set) -->
{{#Slide: MyDiagram}}

<!-- Specific named layer set -->
{{#Slide: MyDiagram | layerset=english}}
{{#Slide: MyDiagram | layerset=spanish}}

<!-- Custom canvas and display size -->
{{#Slide: Infographic | canvas=1200x800 | size=600x400}}

<!-- With background color -->
{{#Slide: Blueprint | background=#e8f4fc}}

<!-- View-only mode (no edit button) -->
{{#Slide: Published | noedit}}

<!-- Combined: specific layer set with styling -->
{{#Slide: Technical | layerset=detailed | size=800x600 | background=#fff}}
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
| `[[File:X.png\|layerset=on]]` | Image + this owner/file's `Default` layers after completion |
| `[[File:X.png\|layerset=default]]` | Image + the set whose normalized name is `default` |
| `[[File:X.png\|layerset=anatomy]]` | Image + "anatomy" layers |
| `[[File:X.png\|layerset=off]]` | Image only, explicitly no layers |
| `[[File:X.png\|layerset=none]]` | Image only, explicitly no layers |
| `[[File:X.png\|layers=on]]` | Same Default selection after completion (older spelling) |

---

## Troubleshooting

### Layers not showing

1. **Check completion** — Verify the migration-completion state, including on a fresh wiki.
2. **Check this owner and name** — Reopen the same page's overlay; a same-named set on another page is independent.
3. **Check visibility** — The owner, exact revision and source must be readable. Verify the requested PDF page.

### Wrong layers showing

1. **Verify set name** — Ensure you're using the correct named set
2. **Check for typos** — `layerset=anotomy` ≠ `layerset=anatomy`
3. **Check saved revision/source** — Reuploads do not change the pinned source of old content. Retain any unsaved work and local drafts when investigating; do not clear browser storage.

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
