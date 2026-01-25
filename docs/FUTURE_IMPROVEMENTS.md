# Future Improvements

This document tracks **active** feature ideas for the Layers extension. For completed features, see `CHANGELOG.md` or the `docs/archive/` folder.

**Last Updated:** January 25, 2026

---

## Active Proposals

### 1. Lowercase Parser Function Syntax (FR-12)

**Priority:** MEDIUM  
**Complexity:** Low  
**Status:** ⏳ Proposed (January 25, 2026)

Add backwards compatibility with lowercase 'l' in `{{#layers: ...}}` parser function.

**Rationale:**
- MediaWiki convention typically uses lowercase for parser functions (e.g., `{{#if:}}`, `{{#switch:}}`)
- Current `{{#Layers:}}` syntax may feel inconsistent with MediaWiki standards
- Should support both variants: `{{#Layers:}}` and `{{#layers:}}`

**Implementation:**
- Register magic word with case-insensitive matching
- Update `Layers.i18n.magic.php` to handle both cases
- Add tests for lowercase variant

**Effort:** ~2-4 hours

---

### 2. Zoom to Mouse Pointer (FR-13)

**Priority:** HIGH  
**Complexity:** Medium  
**Status:** ⏳ Proposed (January 25, 2026)

Zoom should anchor at the mouse pointer position (or pinch point on mobile).

**Current Behavior:**
- Mouse wheel zoom is anchored at the top-left corner of the canvas
- Pinch-to-zoom on mobile may have similar anchor issues

**Desired Behavior:**
- Zoom in: canvas zooms toward mouse cursor position (cursor stays over same content)
- Zoom out: canvas zooms away from mouse cursor position
- Pinch-to-zoom: zoom anchored at the midpoint between the two touch points

**Implementation:**
- Modify `ZoomPanController.js` to calculate zoom anchor point
- Get mouse position in canvas coordinates before zoom
- Apply zoom transformation
- Adjust pan offset so mouse position maps to same canvas coordinates after zoom

**Reference:** This is standard behavior in Figma, Illustrator, Photoshop, and most design tools.

**Effort:** ~1-2 days

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

### 2. Inline Canvas Text Editing (FR-8)

**Priority:** HIGH  
**Complexity:** High  
**Status:** ⏳ Proposed

Allow direct text editing on the canvas instead of only in the properties panel.

**Features:**
- Click text layer to enter edit mode
- Cursor and selection within text
- Inline formatting toolbar
- Real-time rendering as you type
- Works for both Text and Text Box layers

**Effort:** 3-4 weeks

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

### Gradient Fills

**Complexity:** Low | **Value:** Medium

Linear and radial gradient fills for shapes.

### Custom Fonts

**Complexity:** Medium | **Value:** Medium

Allow users to specify custom fonts beyond the default list.

### SVG Export

**Complexity:** Low | **Value:** Medium

Export annotations as SVG for use in vector graphics software.

---

## Recently Completed

The following features have been completed and archived:

| Feature | Version | Notes |
|---------|---------|-------|
| Callout/Speech Bubble Tool | v1.4.2-1.4.3 | Draggable tail, 3 tail styles (triangle, curved, line), corner arc support |
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
