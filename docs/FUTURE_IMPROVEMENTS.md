# Future Improvements

This document tracks **active** feature ideas for the Layers extension. For completed features, see `CHANGELOG.md` or the `docs/archive/` folder.

**Last Updated:** January 4, 2026

---

## Active Proposals

### 1. TIFF Image Support (FR-11) - PARTIALLY IMPLEMENTED ✅

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
