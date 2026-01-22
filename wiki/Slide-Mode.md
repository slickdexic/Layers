# Slide Mode

*New in v1.5.22*

Create standalone canvas graphics without requiring a base image. Perfect for diagrams, infographics, flowcharts, and presentations.

---

## Overview

Slide Mode allows you to create graphics from scratch using all 15 drawing tools, without needing an existing image file. Slides are stored separately from image layer sets and have their own version history.

---

## Wikitext Syntax

Use the `{{#Slide:}}` parser function to embed slides:

```wikitext
{{#Slide: MySlideName}}
```

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `canvas` | Canvas size (width×height) | `canvas=1920x1080` |
| `size` | Display size on page | `size=800x600` |
| `bgcolor` | Background color | `bgcolor=#f0f0f0` |
| `lock` | Lock mode | `lock=view` or `lock=all` |
| `class` | CSS classes | `class=my-diagram` |

### Examples

```wikitext
<!-- Basic slide -->
{{#Slide: MyDiagram}}

<!-- Custom canvas size -->
{{#Slide: Presentation | canvas=1920x1080}}

<!-- Display at specific size -->
{{#Slide: Infographic | size=800x600}}

<!-- With background color -->
{{#Slide: Blueprint | bgcolor=#e8f4fc}}

<!-- View-only (no edit overlay) -->
{{#Slide: Published | lock=view}}

<!-- Combined parameters -->
{{#Slide: Technical-Drawing 
| canvas=1200x900 
| size=600x450 
| bgcolor=#ffffff
}}
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
| **All 15 Drawing Tools** | Full access to shapes, text, arrows, etc. |
| **Custom Canvas Sizes** | Any size from 100×100 to 4096×4096 pixels |
| **Background Colors** | Any CSS color or transparent |
| **Instant Refresh** | Changes appear immediately after saving ✨ |
| **Lightbox View** | Full-size viewing with hover overlay |
| **Version History** | Each slide maintains revision history |
| **Shape Library** | 1,310 built-in shapes available |
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

### Lock Modes

| Mode | Effect |
|------|--------|
| `lock=none` | Full editing (default) |
| `lock=view` | View-only, no edit overlay |
| `lock=all` | No overlay at all |

### Permissions

Users need the `editlayers` right to create and edit slides (same as image layers).

---

## Technical Details

### Storage

Slides are stored in the `layer_sets` database table with:
- Slide name as the identifier (instead of image filename)
- Canvas dimensions stored in layer data
- Full revision history support

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
