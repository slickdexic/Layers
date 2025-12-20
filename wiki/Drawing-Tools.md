# Drawing Tools

Layers provides 13 professional drawing tools for comprehensive image annotation.

---

## Tool Overview

| Tool | Shortcut | Icon | Category | Description |
|------|----------|------|----------|-------------|
| **Pointer** | `V` | ➡️ | Selection | Select, move, resize, and rotate layers |
| **Zoom** | `Z` | 🔍 | Navigation | Zoom and pan the canvas |
| **Text** | `T` | T | Annotation | Single-line text labels |
| **Text Box** | `X` | 📝 | Annotation | Multi-line text with container |
| **Pen** | `P` | ✏️ | Drawing | Freehand path drawing |
| **Rectangle** | `R` | ▢ | Shape | Rectangles and squares |
| **Circle** | `C` | ○ | Shape | Perfect circles |
| **Ellipse** | `E` | ⬭ | Shape | Ovals with independent radii |
| **Polygon** | `G` | ⬡ | Shape | Multi-sided polygons |
| **Star** | `S` | ★ | Shape | Star shapes |
| **Arrow** | `A` | ➔ | Line | Arrows with customizable heads |
| **Line** | `L` | ╱ | Line | Straight lines |
| **Blur** | `B` | ▦ | Effect | Blur/redact sensitive areas |

---

## Selection Tools

### Pointer Tool (V)

The primary tool for manipulating existing layers.

**Features:**
- Click to select a layer
- `Ctrl+Click` to add/remove from selection
- Drag selection handles to resize
- Drag rotation handle to rotate
- Drag layer body to move

**Selection Handles:**
```
    [rotate]
        │
  NW────N────NE
  │           │
  W     ●     E
  │           │
  SW────S────SE
```

**Key Object Alignment:**
When multiple layers are selected, the last-selected layer becomes the "key object" (shown with orange border). Other layers align TO the key object.

### Zoom Tool (Z)

Navigate large images with precision.

**Features:**
- Click to zoom in
- `Alt+Click` to zoom out
- Drag to pan
- Mouse wheel to zoom at cursor position
- Fit-to-window button in toolbar

---

## Annotation Tools

### Text Tool (T)

Add single-line text labels anywhere on the canvas.

**Properties:**
| Property | Range | Default |
|----------|-------|---------|
| Font Family | Arial, Roboto, Noto Sans, Times New Roman, Courier New | Arial |
| Font Size | 8-144px | 16px |
| Font Weight | Normal, Bold | Normal |
| Font Style | Normal, Italic | Normal |
| Color | Any color | #000000 |
| Text Stroke | On/Off, color, width | Off |
| Text Shadow | On/Off, blur, offset | Off |

**Usage:**
1. Press `T` or click the Text tool
2. Click on the canvas
3. Type your text in the modal
4. Click OK or press Enter

### Text Box Tool (X)

Multi-line text with a styled container — perfect for callouts and information boxes.

**Properties:**
| Property | Options | Default |
|----------|---------|---------|
| Text Alignment | Left, Center, Right | Left |
| Vertical Align | Top, Middle, Bottom | Top |
| Padding | 0-50px | 10px |
| Corner Radius | 0-50px | 0px |
| Line Height | 1.0-3.0 | 1.4 |
| Word Wrap | Automatic | Yes |

**Container Styling:**
- Stroke color and width
- Fill color with transparency
- All standard shape effects

---

## Shape Tools

### Rectangle Tool (R)

Draw rectangles and squares.

**Modifiers:**
- `Shift` — Constrain to square
- `Alt` — Draw from center

**Properties:**
- Stroke color, width, opacity
- Fill color, opacity
- Corner radius (coming soon)
- Shadow effects

### Circle Tool (C)

Draw perfect circles.

**Properties:**
- Radius-based (not width/height)
- Stroke and fill styling
- Shadow effects

### Ellipse Tool (E)

Draw ovals with independent X and Y radii.

**Properties:**
| Property | Description |
|----------|-------------|
| radiusX | Horizontal radius |
| radiusY | Vertical radius |

### Polygon Tool (G)

Draw multi-sided regular polygons.

**Properties:**
| Property | Range | Default |
|----------|-------|---------|
| Sides | 3-12 | 6 |
| Corner Radius | 0-50px | 0 |

**Examples:**
- 3 sides = Triangle
- 4 sides = Square/Diamond
- 5 sides = Pentagon
- 6 sides = Hexagon

### Star Tool (S)

Draw star shapes with customizable points.

**Properties:**
| Property | Range | Default |
|----------|-------|---------|
| Points | 3-12 | 5 |
| Inner Radius | 10-90% of outer | 50% |
| Point Radius | Rounding for points | 0 |
| Valley Radius | Rounding for valleys | 0 |

---

## Line Tools

### Arrow Tool (A)

Create annotation arrows with customizable endpoints.

**Properties:**
| Property | Options | Default |
|----------|---------|---------|
| arrowhead | `none`, `arrow`, `circle`, `diamond`, `triangle` | `arrow` |
| arrowStyle | `single`, `double`, `none` | `single` |
| arrowHeadType | `pointed`, `chevron`, `standard` | `pointed` |
| arrowSize | 1-100 | 10 |
| headScale | 0.1-5.0 | 1.0 |
| tailWidth | 0-100 | 0 |
| Stroke Width | 0-100px | 2px |

**Arrow Style (arrowStyle):** Controls head placement
```
single:   ──────▶     (head at end only)
double:   ◀─────▶     (heads at both ends)
none:     ───────     (line only, no heads)
```

**Head Shape (arrowhead):** Controls head icon shape
```
arrow:    ──────▶     (filled arrow)
circle:   ──────●     (filled circle)
diamond:  ──────◆     (filled diamond)
triangle: ──────▷     (open triangle)
none:     ───────     (no head)
```

**Head Type (arrowHeadType):** Controls rendering style
- `pointed` — Sharp pointed arrow (default)
- `chevron` — V-shaped chevron
- `standard` — Classic arrow head

### Line Tool (L)

Draw straight lines between two points.

**Properties:**
- Stroke color and width
- Opacity
- No fill (lines have no area)

---

## Effect Tools

### Blur Tool (B)

Blur or redact sensitive areas of an image.

**Use Cases:**
- Redact faces for privacy
- Hide license plates
- Obscure sensitive text
- Create focus effects

**Properties:**
| Property | Range | Default |
|----------|-------|---------|
| Blur Radius | 5-50px | 12px |
| Width | Drawn area | — |
| Height | Drawn area | — |

**How It Works:**
The blur tool creates a region that samples and blurs the underlying image. The original image is never modified.

---

## Common Properties

All tools share these style properties:

### Stroke Properties
| Property | Description | Range |
|----------|-------------|-------|
| stroke | Stroke color | Any color |
| strokeWidth | Line thickness | 0-50px |
| strokeOpacity | Stroke transparency | 0-1 |

### Fill Properties
| Property | Description | Range |
|----------|-------------|-------|
| fill | Fill color | Any color |
| fillOpacity | Fill transparency | 0-1 |

### Shadow Properties
| Property | Description | Range |
|----------|-------------|-------|
| shadow | Enable shadow | true/false |
| shadowColor | Shadow color | Any color |
| shadowBlur | Blur radius | 0-50px |
| shadowOffsetX | Horizontal offset | -50 to 50px |
| shadowOffsetY | Vertical offset | -50 to 50px |
| shadowSpread | Spread distance | 0-20px |

### Blend Modes
- Normal
- Multiply
- Screen
- Overlay
- Darken
- Lighten
- Color Dodge
- Color Burn
- Hard Light
- Soft Light
- Difference
- Exclusion

---

## Tips

### Drawing Efficiently
1. Learn the keyboard shortcuts — they're much faster
2. Use `Shift` for constrained proportions
3. Use `Alt` to draw from center
4. Double-click shapes to edit properties

### Choosing the Right Tool
| Need | Tool |
|------|------|
| Quick label | Text (T) |
| Paragraph/callout | Text Box (X) |
| Point to something | Arrow (A) |
| Highlight area | Rectangle (R) with semi-transparent fill |
| Redact content | Blur (B) |
| Freehand annotation | Pen (P) |

---

## See Also

- [[Keyboard Shortcuts]] — Complete shortcut reference
- [[Style Presets]] — Save and reuse tool styles
- [[Alignment and Distribution]] — Precise positioning
