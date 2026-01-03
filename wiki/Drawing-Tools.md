# Drawing Tools

Layers provides 12 professional drawing tools for comprehensive image annotation.

---

## Tool Overview

| Tool | Shortcut | Icon | Category | Description |
|------|----------|------|----------|-------------|
| **Pointer** | `V` | ➡️ | Selection | Select, move, resize, and rotate layers |
| **Text** | `T` | T | Annotation | Single-line text labels |
| **Text Box** | `X` | 📝 | Annotation | Multi-line text with container |
| **Callout** | `B` | 💬 | Annotation | Speech bubbles with draggable tail |
| **Pen** | `P` | ✏️ | Drawing | Freehand path drawing |
| **Rectangle** | `R` | ▢ | Shape | Rectangles and squares |
| **Circle** | `C` | ○ | Shape | Perfect circles |
| **Ellipse** | `E` | ⬭ | Shape | Ovals with independent radii |
| **Polygon** | `Y` | ⬡ | Shape | Multi-sided polygons |
| **Star** | `S` | ★ | Shape | Star shapes |
| **Arrow** | `A` | ➔ | Line | Arrows with customizable heads |
| **Line** | `L` | ╱ | Line | Straight lines |

> **Note:** Use `+`/`-` or mouse wheel to zoom, and hold `Space` to pan the canvas.

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

### Zooming and Panning

Navigate large images with precision using keyboard shortcuts and mouse controls.

**Zoom Controls:**
- `+` or `=` — Zoom in
- `-` — Zoom out
- `0` — Fit to window
- Mouse wheel — Zoom at cursor position

**Pan Controls:**
- Hold `Space` and drag — Pan the canvas
- Click and drag on empty canvas area — Pan (when using Pointer tool)

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

### Callout Tool (B)

Create speech bubbles and callouts with a draggable tail pointer.

**Properties:**
| Property | Options | Default |
|----------|---------|---------|
| Corner Radius | 0-50px | 10px |
| Tail Style | Triangle, Curved, Line | Triangle |
| Fill | Any color or `blur` | #ffffff |
| Stroke | Color and width | #000000, 2px |

**Tail Styles:**
```
Triangle:  ▼ Classic speech bubble pointer (default)
Curved:    ⌒ Smooth Bézier curves for organic look
Line:      │ Simple single-line pointer
```

**Draggable Tail (v1.4.3+):**
- Select the callout to see the purple tail handle
- Drag the handle to reposition the tail tip anywhere
- Tail can attach to any edge (top, bottom, left, right) or rounded corner
- Tail follows the callout when rotated

**Text Properties:**
- Same as Text Box (font, alignment, padding, etc.)
- Multi-line text with word wrap

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
- Corner radius
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

### Polygon Tool (Y)

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
| arrowStyle | `single`, `double`, `none` | `single` |
| headType | `pointed`, `chevron`, `standard` | `pointed` |
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

**Head Type (headType):** Controls arrow head shape
```
pointed:   ──────▶     (sharp pointed arrow - default)
chevron:   ──────❯     (V-shaped chevron)
standard:  ──────➤     (classic filled arrow head)
```

### Pen Tool (P)

Draw freehand paths with point-by-point control.

**How to Use:**
1. Click to place the first point
2. Click to add additional points
3. Double-click or press Enter to finish the path
4. Press Escape to cancel

**Properties:**
- Stroke color and width
- Opacity
- Closed path option

---

### Line Tool (L)

Draw straight lines between two points.

**Properties:**
- Stroke color and width
- Opacity
- No fill (lines have no area)

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
| fill | Fill color or `blur` | Any color or "blur" |
| fillOpacity | Fill transparency | 0-1 |
| blurRadius | Blur intensity (when fill=blur) | 1-64px |

### Blur Fill Mode (New in v1.2.6)

Any filled shape can use **blur fill** instead of a solid color — creating a "frosted glass" effect that blurs the content beneath.

**How to Use:**
1. Select a shape (rectangle, circle, ellipse, polygon, star, text box, or arrow)
2. Set **Fill** to `blur` in the properties panel
3. Adjust **Blur Radius** to control intensity (default: 12px)
4. Adjust **Fill Opacity** to fine-tune the effect

**Supported Shapes:**
- Rectangle (with corner radius support)
- Circle / Ellipse
- Polygon / Star (with rounded corners support)
- Text Box (with corner radius and rotation support)
- Arrow (v1.2.7+)

**Tips:**
- Lower fill opacity makes the blur more subtle
- Works with rotation — blur correctly follows rotated shapes
- Blur captures everything beneath, including other annotation layers

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
| Speech bubble | Callout (B) |
| Point to something | Arrow (A) |
| Highlight area | Rectangle (R) with semi-transparent fill |
| Blur background | Any shape with `fill: blur` |
| Freehand annotation | Pen (P) |

---

## See Also

- [[Keyboard Shortcuts]] — Complete shortcut reference
- [[Style Presets]] — Save and reuse tool styles
- [[Alignment and Distribution]] — Precise positioning
