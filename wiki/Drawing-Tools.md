# Drawing Tools

Layers provides **15 professional drawing tools** for comprehensive image annotation.

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
| **Custom Shape** | — | 📎 | Shape | Built-in shape library (1,310 shapes) |
| **Emoji** | — | 😀 | Media | Emoji picker (2,817 Noto Color Emoji) |
| **Image** | — | 🖼️ | Media | Import images from clipboard or file |
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

## Custom Shape Tool (v1.5.0+)

Access a built-in library of **1,310 pre-made shapes** organized by category.

### How to Use
1. Click the **Custom Shape** tool in the toolbar (or use the toolbar dropdown)
2. Browse categories or use the search box to find shapes
3. Click a shape to select it
4. Click and drag on the canvas to place the shape

### Shape Categories
| Category | Contents |
|----------|----------|
| **Arrows** | Curved arrows, block arrows, chevrons, pointers |
| **Basic Shapes** | Triangles, parallelograms, trapezoids, crosses |
| **Callouts** | Speech bubbles, thought clouds, banners |
| **Flowchart** | Process, decision, terminal, document shapes |
| **ISO 7010 Mandatory** | Blue circular mandatory action signs |
| **ISO 7010 Prohibition** | Red circular prohibition signs |
| **ISO 7010 Warning** | Yellow triangular warning signs |
| **Math** | Mathematical symbols and operators |
| **Miscellaneous** | Hearts, stars, decorative elements |
| **Stars & Banners** | Star shapes, ribbons, award badges |

### Tips
- Use the **search box** to quickly find shapes by name
- Recently used shapes appear at the top for quick access
- Custom shapes support all standard styling (stroke, fill, blur, shadow, etc.)
- Shapes are rendered as vector paths, so they scale without quality loss

---

## Emoji Picker (v1.5.12+)

Add expressive **Noto Color Emoji** to your annotations from a searchable library of **2,817 emoji**.

### How to Use
1. Click the **Emoji** button in the toolbar (😀 icon)
2. Browse by category or use the search box
3. Click an emoji to insert it at the canvas center
4. Resize and position the emoji like any other layer

### Emoji Categories
| Category | Examples |
|----------|----------|
| **Smileys & Emotion** | 😀 😂 🥰 😎 🤔 |
| **People & Body** | 👋 👍 🙌 🤝 💪 |
| **Animals & Nature** | 🐱 🐶 🌸 🌳 🦋 |
| **Food & Drink** | 🍕 🍔 🍎 ☕ 🍰 |
| **Travel & Places** | ✈️ 🚗 🏠 🏔️ 🌍 |
| **Activities** | ⚽ 🎮 🎨 🎵 🏆 |
| **Objects** | 💡 🔧 📱 💻 📚 |
| **Symbols** | ✅ ❌ ⚠️ ❤️ ⭐ |
| **Flags** | 🏁 🚩 🏳️ Country flags |

### Features
- **Full-text search** — Find emoji by name or keywords
- **Lazy loading** — Thumbnails load as you scroll for fast performance
- **SVG quality** — Emoji are vector graphics that scale perfectly
- **Standard layer controls** — Resize, rotate, adjust opacity like any layer

### Tips
- Emoji make great visual callouts for documentation
- Use emoji for status indicators (✅ ❌ ⚠️)
- Combine with text boxes for rich annotations
- Search works with descriptive words (e.g., "happy", "warning", "check")

---

## Image Tool (v1.3.0+)

Import external images into your annotations from clipboard or file.

### How to Use
1. Click the **Image** button in the toolbar (🖼️ icon)
2. Choose an image file (PNG, JPG, GIF, SVG, WebP)
3. The image is inserted at the canvas center
4. Resize and position as needed

### Alternative: Paste from Clipboard
- Copy any image to your clipboard
- Press `Ctrl+V` (or `Cmd+V` on Mac) in the editor
- The image is automatically inserted as a new layer

### Properties
| Property | Description |
|----------|-------------|
| preserveAspectRatio | Lock aspect ratio when resizing (default: true) |
| opacity | Transparency (0-1) |
| rotation | Rotation angle in degrees |

### Size Limits
Images are stored as base64 data URLs. The maximum size is configurable:
- Default: 1MB per image
- Server setting: `$wgLayersMaxImageBytes`

### Tips
- Use for logos, icons, or reference images
- Screenshots can be pasted directly from clipboard
- Hold `Shift` while resizing to maintain aspect ratio

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
| Decorative arrow | Custom Shape (arrows category) |
| Visual indicator/emotion | Emoji (✅ ⚠️ 😀) |
| External logo/screenshot | Image (paste or import) |
| Industry symbols | Custom Shape (ISO 7010 categories) |

---

## See Also

- [[Keyboard Shortcuts]] — Complete shortcut reference
- [[Style Presets]] — Save and reuse tool styles
- [[Alignment and Distribution]] — Precise positioning
