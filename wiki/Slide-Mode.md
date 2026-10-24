# Slide mode

Reviewed October 24, 2026 against the page-owned candidate. Tagged 1.5.95 uses
shared slides. Follow [UPGRADING.md](../docs/UPGRADING.md) to complete the native
migration. Milestone 1 acceptance remains open.

## Page-owned slides after completion

A slide is a standalone canvas owned by the wiki page whose saved snapshot
contains it. It needs no uploaded base image. Equal slide names on different
pages are independent; editing one does not update another.

```wikitext
{{#Slide: Safety overview}}
{{#Slide: Safety overview | noedit}}
```

Save the embed on its owning page, then use **Edit layers** on hover, focus or
tap. Save publishes a native owner-page revision. Reopen from the same page;
inspect earlier saved content through that page's history. **View full size**
provides viewing, Print, Download PNG first and a separate Download PDF choice.
No technical owner/revision heading is added above an ordinary slide.

The first argument names the saved page-owned slide. Migration can turn shared
variants into names such as `Safety overview (english)`; use the actual saved
name. Do not add page IDs or internal binding tokens to author wikitext.
Saved canvas geometry and background come from the exact snapshot, rather than
being replaced by a legacy shared set. Existing size/noedit syntax remains part
of the protected interface; qualify its result on the intended candidate page.
`noedit` suppresses the edit overlay and does not change server authorization.

Creating/editing requires owner-page read/edit authority and `editlayers`,
with fresh source/base checks. See [Permissions](Permissions.md) and
[Named Layer Sets](Named-Layer-Sets.md). A shared `Special:EditSlide` URL is not
an alternate route to another page's native slide. After completion the old
shared storage is read-only.

## Legacy shared-slide reference

The remaining sections describe the older shared model, its management pages,
parameters, API examples and retained history. They do **not** override the
page-owned workflow above. The old per-set revision cap does not prune native
owner history. Search/Cargo release acceptance belongs to later milestones;
`Special:Slides` name listing is not proof of instruction-text indexing.

*New in v1.5.22*

Create standalone canvas graphics without requiring a base image. Perfect for diagrams, infographics, flowcharts, and presentations.

---

## Overview

Slide Mode allows you to create graphics from scratch using all 17 drawing tools, without needing an existing image file. Slides are stored separately from image layer sets and have their own version history.

**Like images, slides support multiple named layer sets** — you can create different annotation variations (e.g., "english", "spanish", "detailed", "simplified") for the same slide.

---

## Wikitext Syntax

Use the `{{#Slide:}}` parser function to embed slides:

```wikitext
{{#Slide: MySlideName}}
```

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `layerset` | Named layer set to display (omitted/on: current set) | `layerset=anatomy` |
| `canvas` | Canvas size (width×height) | `canvas=1920x1080` |
| `size` | Display size on page | `size=800x600` |
| `background` | Background color | `background=#f0f0f0` |
| `noedit` | Hide the edit overlay button | `noedit` |
| `class` | CSS classes | `class=my-diagram` |

### Examples

```wikitext
<!-- Basic slide (current layer set) -->
{{#Slide: MyDiagram}}

<!-- Specific named layer set -->
{{#Slide: MyDiagram | layerset=english}}
{{#Slide: MyDiagram | layerset=spanish}}

<!-- Custom canvas size -->
{{#Slide: Presentation | canvas=1920x1080}}

<!-- Display at specific size -->
{{#Slide: Infographic | size=800x600}}

<!-- With background color -->
{{#Slide: Blueprint | background=#e8f4fc}}

<!-- View-only (no edit overlay) -->
{{#Slide: Published | noedit}}

<!-- Combined parameters -->
{{#Slide: Technical-Drawing 
| layerset=detailed
| canvas=1200x900 
| size=600x450 
| background=#ffffff
}}
```

---

## Named Layer Sets for Slides

Just like images, slides support multiple named layer sets:

### Use Cases

| Use Case | Example Sets |
|----------|--------------|
| **Multilingual** | `english`, `spanish`, `french` |
| **Detail Levels** | `overview`, `detailed`, `expert` |
| **Versions** | `draft`, `reviewed`, `approved` |
| **Audiences** | `student`, `instructor`, `admin` |

### Creating Named Sets

1. Open the slide in the editor (`Special:EditSlide/SlideName`)
2. Click the layer set dropdown (shows current set name)
3. Click **"Create New Set..."**
4. Enter a name and click **Create**

### Direct Editing

You can open a specific layer set directly:

```
Special:EditSlide/MySlideName?layerset=annotations
```

---

## Management Pages

### Special:Slides

Browse, search, create, and delete all slides:

- **Grid view** with thumbnails and metadata
- **Search** by slide name
- **Sort** by name, last modified, or creation date
- **Create** new slides with preset or custom sizes
- **Delete** slides with confirmation

Access via: `Special:Slides`

### Special:EditSlide

Direct editor access for a specific slide:

```
Special:EditSlide/MySlideName
```

This opens the full Layers editor with the slide loaded.

---

## Features

| Feature | Description |
|---------|-------------|
| **All 17 Drawing Tools** | Full access to shapes, text, arrows, etc. |
| **Custom Canvas Sizes** | Configurable dimensions; standard maximum defaults to 4096×4096. Entry-point limits differ, so verify unusual sizes in the editor |
| **Background Colors** | Validated colors such as `#ffffff` or `transparent`; not every CSS expression is accepted |
| **Refresh after saving** | The editor updates after saving; already-open article views may need a reload |
| **Lightbox View** | Full-size viewing with hover overlay |
| **Version History** | Each slide maintains revision history |
| **Shape Library** | 1,385 built-in shapes available |
| **Emoji Library** | 2,817 Noto Color Emoji available |

---

## Use Cases

### Diagrams
Create flowcharts, org charts, and system diagrams without needing placeholder images.

### Infographics
Build data visualizations with custom sizes optimized for your content.

### Presentations
Create slide-like graphics with consistent branding across your wiki.

### Technical Drawings
Start from a blank canvas for schematics, blueprints, and technical illustrations.

---

## Behavior Notes

### Canvas vs Size

- **`canvas=WxH`** — Sets the actual working resolution of the editor canvas
- **`size=WxH`** — Sets the display size on the article page (scales proportionally)

Once a slide is saved, subsequent edits load the canvas dimensions from the database, not from the wikitext.

### Hiding the Edit Button

Use the `noedit` flag to hide the edit overlay button, making the slide view-only for readers:

```wikitext
{{#Slide: MyPublishedSlide | noedit}}
```

Note: Users with edit permissions can still access the slide editor via `Special:EditSlide/SlideName`.

### Permissions

Users need the `editlayers` right to create and edit slides (same as image layers).

---

## Technical Details

### Storage

Slides are stored in the `layer_sets` database table with:
- Slide name as the identifier (instead of image filename)
- Canvas dimensions stored in layer data
- Retained Layers revisions (50 per set by default), separate from article history

### API

Slides use the same API endpoints as image layers:
- `action=layersinfo` with `slidename` parameter
- `action=layerssave` with `slidename` parameter
- `action=layerslist` for listing all slides

---

## See Also

- [[Wikitext Syntax]] — Full wikitext reference
- [[Drawing Tools]] — All available tools
- [[Named Layer Sets]] — Version history and sets
