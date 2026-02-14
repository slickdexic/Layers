# Future Improvements

This document tracks **active** feature ideas for the Layers extension. For completed features, see `CHANGELOG.md` or the `docs/archive/` folder.

**Last Updated:** February 12, 2026

---

## Active Proposals

### 1. Angle Dimension Tool (FR-15) — 🔴 HIGH VALUE

**Priority:** HIGH  
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

### 2. TIFF Image Support (FR-11) - PARTIALLY IMPLEMENTED ✅

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

**Complexity:** Medium | **Value:** Low | **Priority:** Backlog

Make layers clickable to navigate to wiki pages. Low priority - may revisit later.
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

---

## Recently Completed

The following features have been completed and archived:

| Feature | Version | Notes |
|---------|---------|-------|
| Lowercase Slide Syntax (FR-12) | v1.5.x | Both `{{#Slide:}}` and `{{#slide:}}` |
| Zoom to Mouse Pointer (FR-13) | v1.5.x | ZoomPanController anchored zoom |
| Draggable Dimension Tool (FR-14) | v1.5.50 | dimensionOffset property |
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
