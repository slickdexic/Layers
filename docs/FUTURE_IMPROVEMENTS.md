# Future Improvements

This document tracks **active** feature ideas for the Layers extension. For completed features, see `CHANGELOG.md` or the `docs/archive/` folder.

**Last Updated:** February 3, 2026

---

## Active Proposals

### 1. ~~Lowercase Slide Parser Function Syntax (FR-12)~~ ✅ COMPLETED

**Priority:** MEDIUM  
**Complexity:** Low  
**Status:** ✅ Completed (January 25, 2026)

Added backwards compatibility with lowercase 's' in `{{#slide: ...}}` parser function.

**Rationale:**
- MediaWiki convention typically uses lowercase for parser functions (e.g., `{{#if:}}`, `{{#switch:}}`)
- Current `{{#Slide:}}` syntax may feel inconsistent with MediaWiki standards
- Now supports both variants: `{{#Slide:}}` and `{{#slide:}}`

**Implementation:**
- Updated `Layers.i18n.magic.php` to add lowercase 'slide' as primary alias
- Backwards compatible: existing `{{#Slide:}}` usage continues to work

---

### ~~2. Zoom to Mouse Pointer (FR-13)~~ ✅ COMPLETED

**Priority:** HIGH  
**Complexity:** Medium  
**Status:** ✅ Completed (January 26, 2026)

Zoom now anchors at the mouse pointer position.

**Implementation:**
- `CanvasEvents.handleWheel()` captures mouse position via `cm.getMousePoint(e)`
- `ZoomPanController.zoomBy(delta, point)` calculates screen position before zoom
- Pan offset adjusted after zoom to keep point under cursor stable
- Full test coverage in `ZoomAndCoords.test.js` and `ZoomPanController.test.js`

**Location:** `resources/ext.layers.editor/canvas/ZoomPanController.js`

---

### 3. Draggable Dimension Tool (FR-14)

**Priority:** MEDIUM  
**Complexity:** Medium  
**Status:** ⏳ Proposed (January 25, 2026)

Enhance the Dimension tool to support dragging the dimension line independently from the anchor points.

**Current Behavior:**
- Dimension has two anchor points (x1,y1) and (x2,y2)
- Extension/leader lines extend perpendicular from the measured segment

**Desired Behavior:**

```
        ┌─── leader length ───┐
        │                     │
    ────┼─────────────────────┼────  ← dimension line (draggable)
        │      "100.5"        │
        │                     │
        ●                     ●
     anchor1               anchor2
```

**Features:**
1. **Draggable dimension line** — The horizontal/angled dimension line can be dragged perpendicular to the measured segment
2. **Independent anchor points** — Each endpoint can be dragged to reposition
3. **Leader lines** — Extend from anchors to the dimension line
4. **Leader length property** — Controls how far the leader extends beyond the dimension line (on the opposite side from the anchor)

**Properties to Add:**
- `dimensionOffset` — Distance from measured segment to dimension line (positive = one side, negative = other)
- `leaderExtension` — Length of leader line beyond the dimension line

**Implementation:**
- Add drag handle on the dimension line itself
- Calculate offset perpendicular to the measurement axis
- Update `DimensionRenderer.js` to respect offset
- Add properties to `PropertiesForm.js`

**Effort:** ~2-3 days

---

### 4. Angle Dimension Tool (FR-15)

**Priority:** MEDIUM  
**Complexity:** High  
**Status:** ⏳ Proposed (January 25, 2026)

Add an angle dimension tool for measuring and annotating angles.

**Geometry:**
```
                endpoint1
                   ●
                  /
                 / ←─ extension line
                /
         ──────╱  arc (dimension line)
              / "45.0°"
     ────────●────────────●
           vertex       endpoint2
```

**Three Anchor Points:**
1. **endpoint1** — First arm endpoint
2. **vertex** — The angle vertex (center point of the arc)
3. **endpoint2** — Second arm endpoint

**Features:**
1. **Arc dimension line** — Follows an arc with vertex as radial center
2. **Extension lines** — Extend from endpoints toward the arc
3. **Draggable arc** — Arc radius can be adjusted by dragging the dimension line
4. **Extension beyond arc** — Leader lines can extend beyond the dimension arc

**Properties:**
- `arcRadius` — Distance from vertex to dimension arc
- `extensionLength` — How far extension lines extend beyond the arc
- `displayValue` — 'actual' (measured angle), 'override' (custom value)
- `decimals` — Number of decimal places (0-4)
- `angleUnit` — 'degrees' (default), 'radians' (future)
- All existing dimension styling: font, color, stroke, text position

**Behavior:**
- Calculates angle between the two arms automatically
- Displays angle value along the arc or at midpoint
- Supports angles 0-360° (can handle reflex angles)
- Dragging the arc adjusts `arcRadius` while maintaining the angle

**Implementation:**
1. Add new layer type: `angleDimension`
2. Create `AngleDimensionRenderer.js`
3. Extend `DimensionRenderer.js` or create shared base class
4. Add tool to toolbar (potentially grouped with Dimension tool)
5. Add properties panel support
6. Add validation and server-side whitelist support

**Effort:** ~1-2 weeks

---

### 5. TIFF Image Support (FR-11) - PARTIALLY IMPLEMENTED ✅

**Priority:** HIGH  
**Complexity:** Medium  
**Status:** ✅ Basic support implemented (January 4, 2026)

Enable layers editing on TIFF images. Browsers don't natively support TIFF rendering, so we use MediaWiki's thumbnail API.

**What's Implemented:**
- ✅ ImageLoader.js detects TIFF, XCF, PSD, PDF, EPS, AI files
- ✅ Automatically requests a 2048px thumbnail from MediaWiki
- ✅ Falls back to thumbnail URL before trying direct file URL
- ✅ 6 unit tests added for TIFF handling

**How It Works:**
1. ImageLoader detects non-web-native file extensions (tif, tiff, xcf, psd, ai, eps, pdf)
2. Adds thumbnail URL with `&width=2048` parameter as first priority
3. MediaWiki's Special:Redirect/file handler returns a PNG/JPEG thumbnail
4. Canvas can now render the image for annotation

**Remaining Work:**
- Test with actual TIFF files on a live wiki
- Verify coordinate mapping works correctly for large TIFFs
- Consider making thumbnail size configurable
- Add user notification when using thumbnail mode

**Effort:** Remaining work ~1 week

---

### 2. Inline Canvas Text Editing (FR-8) — ✅ COMPLETED

**Priority:** HIGH  
**Complexity:** High  
**Status:** ✅ Completed (January 2026)

Inline text editing is now implemented via `InlineTextEditor.js`.

**What's Implemented:**
- Double-click text layer to edit directly on canvas
- Transparent textarea overlay matches layer position/styling
- Real-time rendering as you type
- Floating formatting toolbar with bold/italic/underline controls
- Works for Text, Text Box, and Callout layers
- Escape to cancel, Enter/Ctrl+Enter to save

**Location:** `resources/ext.layers.editor/canvas/InlineTextEditor.js` (~1,300 lines)

---

### 6. Rich Text Formatting (FR-16) — ✅ COMPLETED

**Priority:** HIGH  
**Complexity:** High  
**Status:** ✅ Completed (February 2026)

Mixed text formatting is now fully implemented! Different parts of text within Text Box or Callout layers can have different styles (font size, color, bold, italic, underline, strikethrough, highlight).

**What's Implemented:**
- ✅ Selection-based formatting via floating RichTextToolbar
- ✅ Mixed styles within same text box (font, size, color, weight, style)
- ✅ Toolbar integration (bold/italic/underline/strikethrough/highlight/color)
- ✅ Font size and font family per-selection
- ✅ Rich text data persists through save/load cycle
- ✅ Backward compatible — plain text layers continue to work
- ✅ richText array in data model validated server-side
- ✅ Highlight toggle (click again to remove)
- ✅ Cursor-only formatting (set typing state for next characters)

**Key Components:**
- `InlineTextEditor.js` — Canvas overlay editing with rich text support
- `RichTextToolbar.js` — Floating formatting toolbar (bold, italic, color, etc.)
- `RichTextConverter.js` — Converts between HTML and richText array format
- `TextBoxRenderer.js` — Renders richText runs with per-run styling
- `ServerSideLayerValidator.php` — Validates richText structure

**Desired Behavior:**

```
┌────────────────────────────────────────┐
│ **Important:** This is a warning       │
│ message with _italic emphasis_ and     │
│ some ^small^ subscript text.           │
└────────────────────────────────────────┘
```

**Features:**
1. **Selection-based formatting** — Select text → apply formatting to selection only
2. **Mixed styles** — Different fonts, sizes, colors, weights within same text box
3. **Toolbar integration** — Bold/italic/underline/color tools apply to selection
4. **Preserved on save** — Rich text data persists through save/load cycle
5. **Backward compatible** — Plain text layers continue to work

**Applies To:**
- Text Box (`textbox`)
- Callout (`callout`)
- Optionally: Simple Text (`text`) — though single-line makes this less useful

**Effort:** 3-4 weeks (see detailed implementation plan below)

---

### FR-16 Implementation Plan: Rich Text Formatting

#### Phase 1: Data Model (1 week)

**Current Data Model:**
```javascript
{
  type: 'textbox',
  text: 'Hello World',           // Plain string
  fontFamily: 'Arial',           // Applied to ALL text
  fontSize: 16,                  // Applied to ALL text
  fontWeight: 'bold',            // Applied to ALL text
  color: '#ff0000',              // Applied to ALL text
  ...
}
```

**Proposed Rich Text Data Model:**
```javascript
{
  type: 'textbox',
  text: 'Hello World',           // Plain fallback for compatibility
  richText: [                    // NEW: Array of styled text runs
    {
      text: 'Hello ',
      // No style overrides = use layer defaults
    },
    {
      text: 'World',
      style: {
        fontWeight: 'bold',
        color: '#ff0000'
      }
    }
  ],
  // Default styles (used when richText run has no override)
  fontFamily: 'Arial',
  fontSize: 16,
  fontWeight: 'normal',
  color: '#000000',
  ...
}
```

**Key Design Decisions:**
- `richText` is **optional** — if absent, use `text` with uniform styling (backward compatible)
- Each run specifies only **overrides**, inheriting defaults from layer
- Plain `text` property is always kept in sync for search, backward compat
- Maximum 100 runs per layer (prevent abuse)

**Server-Side Validation Updates:**
- Add `richText` to ServerSideLayerValidator whitelist
- Validate run structure: `text` (string), `style` (object, optional)
- Validate style properties match existing text style whitelist
- Cap run count and total character length

#### Phase 2: Rich Text Rendering (1 week)

**Update TextBoxRenderer.js and CalloutRenderer.js:**

```javascript
renderText(layer) {
  const runs = layer.richText || [{ text: layer.text }];
  let x = startX;
  let y = startY;
  
  for (const run of runs) {
    const style = this.mergeStyles(layer, run.style);
    this.ctx.font = this.buildFont(style);
    this.ctx.fillStyle = style.color;
    
    // Handle word-wrap within run
    const words = run.text.split(' ');
    for (const word of words) {
      const metrics = this.ctx.measureText(word + ' ');
      if (x + metrics.width > maxX) {
        x = startX;
        y += lineHeight;
      }
      this.ctx.fillText(word + ' ', x, y);
      x += metrics.width;
    }
  }
}
```

**Challenges:**
- Word wrap across run boundaries
- Cursor positioning for editing
- Text measurement for bounding box calculation
- Line-height consistency with mixed font sizes

#### Phase 3: Inline Editor Integration (1.5 weeks)

**Option A: ContentEditable Div (Recommended)**

Replace `<textarea>` with `<div contenteditable="true">`:

```html
<div contenteditable="true" class="layers-inline-editor">
  <span>Hello </span>
  <span style="font-weight: bold; color: red;">World</span>
</div>
```

**Pros:**
- Native browser selection/cursor support
- `document.execCommand()` for formatting (or modern `Selection` API)
- Familiar editing experience

**Cons:**
- ContentEditable is notoriously quirky
- Need to sanitize HTML on save
- Cross-browser differences

**Option B: Custom Canvas Text Selection**

Implement custom selection tracking on canvas:
- Track cursor position by character index
- Render selection highlight manually
- Apply formatting to index range

**Pros:**
- Full control over behavior
- No HTML quirks

**Cons:**
- Significantly more complex (~2 weeks extra)
- Reinventing the wheel

**Recommendation:** Start with ContentEditable (Option A), which is industry-standard for rich text editors.

#### Phase 4: Toolbar Integration (0.5 weeks)

**Update InlineTextEditor floating toolbar:**

```javascript
applyFormat(format) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  // Apply formatting to selection
  document.execCommand(format, false, null);  // 'bold', 'italic', etc.
  
  // Or use modern Selection API for colors:
  const range = selection.getRangeAt(0);
  const span = document.createElement('span');
  span.style.color = this.currentColor;
  range.surroundContents(span);
  
  this.syncRichTextToLayer();
}

syncRichTextToLayer() {
  // Parse contenteditable HTML into richText array
  const editor = this.editorElement;
  const runs = [];
  
  for (const node of editor.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent });
    } else if (node.tagName === 'SPAN') {
      runs.push({
        text: node.textContent,
        style: this.extractStyle(node)
      });
    }
  }
  
  this.editingLayer.richText = runs;
  this.editingLayer.text = runs.map(r => r.text).join('');
}
```

#### Phase 5: Properties Panel Support (0.5 weeks)

When editing a layer with richText:
- Show "Mixed" in properties panel if selection has varied formatting
- Changing font size when mixed → option to apply to all or just selection
- Consider "Clear Formatting" button to reset to uniform style

#### Migration & Compatibility

**Backward Compatibility:**
- Layers without `richText` render exactly as before
- Old API responses work unchanged
- `text` property always contains plain text for search/export

**Forward Compatibility:**
- Old viewers seeing `richText` can fall back to `text` with default styling
- Graceful degradation on older extension versions

#### Testing Strategy

**Unit Tests:**
- RichTextRenderer parsing and rendering
- Run merging and style inheritance
- Word wrap across run boundaries
- Sync from contenteditable to richText array

**Integration Tests:**
- Full edit cycle: select text → format → save → reload → verify
- Copy/paste preserves formatting
- Undo/redo with rich text changes

**E2E Tests:**
- Format text in editor, verify saved to server
- Open layer in different browser, verify rendering matches

#### File Changes Summary

| File | Change Type | Effort |
|------|-------------|--------|
| TextBoxRenderer.js | Major | Add rich text run rendering |
| CalloutRenderer.js | Major | Add rich text run rendering |
| InlineTextEditor.js | Major | Replace textarea with contenteditable |
| ServerSideLayerValidator.php | Medium | Add richText validation |
| LayerDataNormalizer.js | Minor | Normalize richText format |
| PropertiesForm.js | Medium | Handle mixed formatting display |
| LayersValidator.js | Minor | Client-side richText validation |
| copilot-instructions.md | Minor | Document richText data model |

---

## World-Class Aspirational Features

These are longer-term ideas that would differentiate Layers from other annotation tools.

### Mobile-Optimized UI

**Complexity:** High | **Value:** Very High

Full touch support for tablets and phones.
- Responsive toolbar layout for small screens
- Mobile-optimized layer panel
- Touch-friendly selection handles
- On-screen keyboard integration

**Status:** Basic touch works (pinch-to-zoom, touch-to-mouse). UI needs responsive design.

### Measurement Tools

**Complexity:** Medium | **Value:** High for technical/scientific use

Calibrated measurement capabilities.
- Set scale reference (e.g., "100px = 1cm")
- Ruler tool with real-world measurements
- Area measurement for shapes
- Angle measurement tool

### Layer Templates / Stamps

**Complexity:** Medium | **Value:** High for repeated workflows

Pre-built annotation templates.
- Callout bubbles, measurement rulers, icon library
- Custom template creation and sharing
- Organization-wide template library

### Layer Linking / Hotspots

**Complexity:** Medium | **Value:** High for documentation

Make layers clickable to navigate to wiki pages.
- Click a layer to navigate to linked page
- Tooltip preview on hover
- Image maps with multiple clickable regions

### Gradient Fills ✅ COMPLETED

**Complexity:** Low | **Value:** Medium | **Status:** ✅ Completed (v1.5.x)

Linear and radial gradient fills for shapes.

**What's Implemented:**
- ✅ `GradientRenderer.js` — Shared gradient rendering utility
- ✅ `GradientEditor.js` — UI for editing gradient color stops
- ✅ Linear gradients with angle control
- ✅ Radial gradients with center position and radius
- ✅ 6 built-in presets (sunset, ocean, forest, fire, steel, rainbow)
- ✅ Custom color stops (2-10 stops)
- ✅ Server-side validation of gradient properties

### Custom Fonts ✅ COMPLETED

**Complexity:** Medium | **Value:** Medium | **Status:** ✅ Completed (v1.5.47)

Self-hosted font library with 32 Google Fonts bundled as WOFF2 files.

**What's Implemented:**
- ✅ 32 fonts across 5 categories (Sans-serif, Serif, Display, Handwriting, Mono)
- ✅ 106 WOFF2 font files (~2.5MB total)
- ✅ No external requests to Google (privacy-focused)
- ✅ `FontConfig.js` manages font categories and display names
- ✅ Font selector dropdown in toolbar and properties panel

### SVG Export

**Complexity:** Low | **Value:** Medium

Export annotations as SVG for use in vector graphics software.

---

## Recently Completed

The following features have been completed and archived:

| Feature | Version | Notes |
|---------|---------|-------|
| Rich Text Formatting (FR-16) | v1.5.49 | Selection-based formatting, floating toolbar |
| Self-Hosted Font Library | v1.5.47 | 32 fonts, 106 WOFF2 files, no Google requests |
| Gradient Fills | v1.5.x | Linear/radial gradients, 6 presets |
| Callout/Speech Bubble Tool | v1.4.2-1.4.3 | Draggable tail, 3 styles |
| Toolbar Dropdown Grouping (FR-5) | v1.5.0 | Grouped tools with MRU, keyboard nav |
| Curved Arrows (FR-4) | v1.3.3 | Bézier curves with control point |
| Live Color Preview (FR-9) | v1.3.3 | Real-time canvas preview |
| Live Article Preview (FR-10) | v1.3.3 | Auto-refresh stale viewers |
| Layer Groups/Folders | v1.2.13 | Ctrl+G to group, folders in panel |
| Context-Aware Toolbar | v1.2.10 | Show only relevant controls |
| Auto-Create Layer Set | v1.2.9 | Create set on first editor open |
| Enhanced Layerslink | v1.2.11 | editor-newtab, editor-modal, return-to |
| Blur Fill Mode | v1.2.6 | Frosted glass effect for shapes |
| Save as Image | v0.8.6 | Export PNG via toolbar |
| Import Image Layer | v0.8.9 | Import external images as layers |
| Background Controls | v0.8.8 | Opacity slider, visibility toggle |

---

*For implementation details on completed features, see the archived feature request documents in `docs/archive/`.*
