# Future Improvements

This document tracks **active** feature ideas for the Layers extension. For completed features, see `CHANGELOG.md` or the `docs/archive/` folder.

**Last Updated:** December 31, 2025

---

## Active Proposals

### 1. Deep Linking to Editor with Layer Selection

**Priority:** HIGH  
**Complexity:** Medium  
**Status:** ⏳ Proposed

Enable URL parameters to open the Layers editor directly to a specific file, layer set, and optionally select a specific layer.

**URL Parameter Design:**
```
/wiki/Special:EditLayers?file=Example.jpg&set=anatomy&layer=layer-abc123
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `file` | Target filename | Yes |
| `set` | Named layer set (default: 'default') | No |
| `layer` | Layer ID to select on load | No |
| `zoom` | Initial zoom level | No |

**Effort:** 3-4 days

---

### 2. Chat Bubble / Speech Balloon Tool

**Priority:** MEDIUM  
**Complexity:** Medium  
**Status:** ⏳ Proposed

A text box variant designed for speech/thought bubbles and diagram callouts.

**Features:**
- All text box properties (alignment, padding, font)
- Configurable tail/pointer (position, style, direction)
- Preset shapes: rounded rectangle, cloud (thought), oval, circle
- Leader line/arrow for pointing to targets

**Use Case:** Comic-style annotations, dialogue callouts, instructional content, diagram labeling.

**Effort:** 2-3 weeks

---

### 3. Inline Canvas Text Editing (FR-8)

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

### 4. Toolbar Dropdown Grouping (FR-5)

**Priority:** MEDIUM  
**Complexity:** Low-Medium  
**Status:** ⏳ Proposed

Reorganize the top toolbar using dropdown menus for better scalability.

**Features:**
- Group similar tools (Shapes: Rectangle, Circle, Ellipse, Polygon, Star)
- Group line tools (Arrow, Line)
- Show most recently used tool as visible button
- Keyboard shortcuts continue to work globally

**Use Case:** Accommodating future tool additions without toolbar overflow.

**Effort:** 1-2 weeks

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
