# Future Improvements

This document tracks planned feature enhancements for the Layers extension.

---

## 1. Save as Image

**Priority:** Medium  
**Complexity:** Low-Medium  
**Status:** ✅ Completed (v0.8.6)

> **Implementation Note:** This feature was already implemented in APIManager.js as `saveAsImage()`. Users can access it via the toolbar's save menu.

### Description
Add a "Save as Image" button in the editor that exports the current canvas (background image + all visible layers) as a downloadable image file (PNG/JPEG).

### User Story
As a user, I want to export my annotated image as a standalone file so I can share it outside of MediaWiki or use it in other contexts.

### Technical Approach
- Add export button to toolbar or file menu
- Use `canvas.toDataURL()` or `canvas.toBlob()` to generate image
- Create temporary download link with appropriate filename
- Support format selection (PNG for transparency, JPEG for smaller size)
- Consider adding quality/resolution options

### UI Considerations
- Button location: Toolbar actions group or File menu dropdown
- Icon: Download/export icon
- Format dialog: Optional advanced options for format, quality, scale

### Implementation Notes
```javascript
// Basic approach
const dataUrl = canvas.toDataURL('image/png');
const link = document.createElement('a');
link.download = 'annotated-image.png';
link.href = dataUrl;
link.click();
```

---

## 2. Import Image to Layer

**Priority:** Medium  
**Complexity:** Medium  
**Status:** ✅ Completed (v0.8.9)

### Description
Allow users to import external images as new layers, enabling composite annotations with logos, icons, reference images, or other visual elements.

### User Story
As a user, I want to import images (logos, icons, reference diagrams) as layers so I can create richer annotations by combining multiple visual elements.

### Technical Approach
- Add "Import Image" button to toolbar or layer panel
- File input accepting common image formats (PNG, JPEG, GIF, SVG, WebP)
- Create new layer type: `type: 'image'`
- Store image data as base64 or reference to uploaded file
- Support drag-and-drop import onto canvas
- Implement resize handles for imported images

### Layer Properties
```javascript
{
  type: 'image',
  id: 'layer-uuid',
  name: 'Imported Image',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  opacity: 1,
  rotation: 0,
  locked: false,
  visible: true,
  // Image-specific
  src: 'data:image/png;base64,...', // or URL reference
  preserveAspectRatio: true,
  originalWidth: 400,
  originalHeight: 300
}
```

### UI Considerations
- Import via: Button click, drag-and-drop, paste from clipboard
- Show loading indicator for large images
- Warn about file size limits (consider $wgLayersMaxBytes)
- Preview before adding to canvas

### Server-Side Considerations
- Validate image data in ApiLayersSave
- Add image data to allowed properties whitelist
- Consider separate storage for large images (reference vs inline)
- Size limits for base64 data

---

## 3. Background Image Layer Controls

**Priority:** Medium  
**Complexity:** Low  
**Status:** ✅ Completed (v0.8.8)

> **Implementation Note:** Added in v0.8.7, enhanced in v0.8.8. Background appears as a special layer in the layer panel with opacity slider and visibility toggle. Keyboard shortcut: Shift+B to toggle background visibility. **v0.8.8 adds per-layer-set background settings** - each named layer set now saves its own background visibility and opacity independently.

### Description
Treat the background image as a special bottom layer with adjustable controls for opacity and visibility, while keeping it locked from direct editing (no move, resize, delete).

### User Story
As a user, I want to adjust the background image opacity so I can make my annotations more visible against busy images, or temporarily hide the background to focus on my layer work.

### Technical Approach
- Create virtual "Background" layer entry in LayerPanel
- Always positioned at bottom of layer list
- Locked icon always shown (cannot be unlocked)
- Add opacity slider control
- Add visibility toggle (eye icon)
- Store background settings in layer set data or separate config

### Background Layer Properties
```javascript
{
  type: 'background',
  id: '__background__',
  name: 'Background Image',
  locked: true,        // Always true, cannot be changed
  visible: true,       // Toggleable
  opacity: 1.0,        // Adjustable 0-1
  // No position/size - determined by image dimensions
}
```

### UI Considerations
- Display in layer panel with distinct styling (grayed background, lock icon)
- Opacity control: Slider in properties panel when selected, or inline in layer panel
- Visibility: Standard eye icon toggle
- Prevent: drag reordering, delete, rename, unlock
- Consider keyboard shortcut for quick background toggle (e.g., B)

### Implementation Notes
- Modify CanvasRenderer to apply background opacity
- Update LayerPanel to render background layer entry
- Store background settings in layer set JSON
- Apply opacity via `ctx.globalAlpha` before drawing background

### Migration
- Existing layer sets: Default to visible=true, opacity=1.0
- Background settings optional in schema (backwards compatible)

---

## Implementation Priority

| Feature | Priority | Effort | Dependencies | Status |
|---------|----------|--------|--------------|--------|
| Save as Image | Medium | Low | None | ✅ Completed (v0.8.6) |
| Background Controls | Medium | Low | None | ✅ Completed (v0.8.8) |
| Import Image Layer | Medium | Medium | Schema update, validation | ✅ Completed (v0.8.9) |

### Recommended Order
1. ~~**Save as Image**~~ - ✅ Implemented in v0.8.6
2. ~~**Background Controls**~~ - ✅ Implemented in v0.8.7, enhanced in v0.8.8 (per-set settings)
3. ~~**Import Image Layer**~~ - ✅ Implemented in v0.8.9

---

## 3. Blur as Blend Mode for All Shapes

**Priority:** Medium  
**Complexity:** Medium-High  
**Status:** ⏳ Proposed

### Description
Allow any shape (rectangle, circle, ellipse, polygon, star, path) to use "blur" as a blend mode, creating blurred regions in any shape. This would generalize the current blur tool and enable creative use cases like privacy masks, focus effects, and stylized callouts.

### User Story
As a user, I want to apply blur effect to any shape (not just rectangles) so I can create circular privacy masks, star-shaped focus effects, or complex path-based blur regions.

### Technical Challenges

| Challenge | Approach |
|-----------|----------|
| Blur is a `filter`, not a blend mode | Intercept "blur" blend mode in renderer, use filter path |
| Shape clipping for non-rectangles | Use shape geometry as clip path before applying blur |
| Performance | Blur is expensive; consider caching or limiting blur radius |
| Text layers | Apply blur to bounding box, or skip text (TBD) |

### Implementation Approach

1. **Add "blur" to blend mode options**
   - Update LayersValidator.validBlendModes to include 'blur'
   - Update blend mode dropdown in ToolbarStyleControls
   - Update LayersConstants.BLEND_MODES

2. **Modify ShapeRenderer**
   - Detect `blendMode === 'blur'` before drawing
   - Instead of normal fill/stroke, use shape as clip path
   - Delegate to EffectsRenderer for blur effect within clip

3. **Generalize EffectsRenderer.drawBlur()**
   - Accept optional clip path (array of points or shape geometry)
   - Use `ctx.clip()` with shape path before blur operation

4. **Deprecate standalone blur tool?**
   - Keep for backward compatibility
   - Rectangle with blur blend mode is equivalent

### Layer Example
```javascript
{
  type: 'ellipse',
  x: 200,
  y: 150,
  radiusX: 80,
  radiusY: 60,
  blendMode: 'blur',
  blurRadius: 15,  // reuse existing property
  opacity: 1
}
```

### Estimated Effort
- **3-5 days** for full implementation
- Files to modify: ShapeRenderer, EffectsRenderer, LayersValidator, ToolbarStyleControls, LayersConstants

### Benefits
- Unique differentiation from other annotation tools
- Privacy masking with arbitrary shapes
- Creative effects (vignettes, spotlight-inverse)
- Consolidates blur functionality

---

## Related Issues

- None currently linked

---

## 4. Deep Linking to Editor with Layer Selection

**Priority:** High  
**Complexity:** Medium  
**Status:** ⏳ Proposed

### Description
Enable URL parameters to open the Layers editor directly to a specific file, layer set, and optionally select a specific layer. This enables integration with forms, documentation workflows, and cross-linking between wiki pages.

### User Story
As a user editing a form, I want to click a link that opens the Layers editor for a specific image in a new tab, so I can quickly annotate the image and return to my form without losing my work.

As a documentation author, I want to link directly to a specific annotation on an image so readers can see exactly what I'm referring to.

### URL Parameter Design

```
/wiki/Special:EditLayers?file=Example.jpg
/wiki/Special:EditLayers?file=Example.jpg&set=anatomy
/wiki/Special:EditLayers?file=Example.jpg&set=anatomy&layer=layer-abc123
/wiki/Special:EditLayers?file=Example.jpg&set=anatomy&layer=layer-abc123&zoom=2&pan=100,200
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `file` | Target filename (with or without `File:` prefix) | Yes |
| `set` | Named layer set to load (default: 'default') | No |
| `layer` | Layer ID to select on load | No |
| `zoom` | Initial zoom level | No |
| `pan` | Initial pan position (x,y) | No |
| `newtab` | Hint for link generators to use `target="_blank"` | No |

### Technical Approach

1. **Create Special:EditLayers page**
   - New SpecialPage class in `src/Special/SpecialEditLayers.php`
   - Parse URL parameters
   - Validate file exists and user has permissions
   - Render editor container with config vars

2. **Modify LayersEditor initialization**
   - Read URL parameters from `mw.config` or `URLSearchParams`
   - After loading layer set, find and select specified layer
   - Apply initial zoom/pan if specified

3. **Add helper for generating links**
   - PHP: `Layers::getEditorUrl($filename, $options)`
   - JS: `window.Layers.getEditorUrl(filename, options)`
   - Wikitext: `{{#layerslink:File.jpg|set=anatomy|layer=id|text=Edit}}`

### Wikitext Helper (Parser Function)

```wikitext
{{#layerslink:Example.jpg|set=anatomy|layer=layer-123|Edit this annotation}}
```

Generates:
```html
<a href="/wiki/Special:EditLayers?file=Example.jpg&set=anatomy&layer=layer-123" 
   target="_blank" rel="noopener">Edit this annotation</a>
```

### Implementation Steps

1. Create `SpecialEditLayers.php` extending `SpecialPage`
2. Register in `extension.json` under `SpecialPages`
3. Add URL parameter handling in EditorBootstrap.js
4. Add layer selection logic to LayersEditor initialization
5. Create `{{#layerslink}}` parser function (optional)
6. Add permissions check (require 'editlayers' right)

### Security Considerations
- Validate filename exists and is an image
- Check user has 'editlayers' permission
- Sanitize layer ID parameter
- Rate limit Special page access

### Estimated Effort
- **3-4 days** for core functionality
- **+1 day** for parser function helper
- Files: New SpecialPage, EditorBootstrap.js, LayersEditor.js, extension.json

---

## 5. Lightbox Viewer with Layers Overlay

**Priority:** High  
**Complexity:** Medium  
**Status:** ⏳ Proposed

### Description
Add a `link=layers` option for embedded images that opens a full-size lightbox overlay showing the image with its layer annotations, without requiring navigation to a separate page.

### User Story
As a reader, I want to click on an annotated image and see it full-size with all annotations visible in a lightbox, so I can examine details without leaving the current page.

As an author, I want to embed annotated images that viewers can enlarge without creating separate gallery pages for each image.

### Wikitext Syntax

```wikitext
[[File:Diagram.jpg|thumb|layers=anatomy|link=layers|Caption text]]
```

| Option | Description |
|--------|-------------|
| `layers=setname` | Which layer set to display |
| `link=layers` | Open lightbox with layers instead of file page |
| `link=layers-edit` | Open lightbox with "Edit" button linking to editor |

### Technical Approach

1. **Extend LayersFileTransform.php**
   - Detect `link=layers` or `link=layers-edit` option
   - Add click handler data attribute to thumbnail
   - Include layer set name in data attributes

2. **Create LayersLightbox.js module**
   - Listen for clicks on images with `data-layers-lightbox`
   - Create modal overlay with close button
   - Load full-size image and layer data via API
   - Render using existing LayersViewer/LayerRenderer
   - Support zoom/pan within lightbox
   - Keyboard: Escape to close, arrow keys for gallery

3. **Lightbox UI Components**
   - Semi-transparent backdrop
   - Centered image container (max 90% viewport)
   - Close button (X) in corner
   - Optional "Edit" button if `link=layers-edit`
   - Layer set selector if multiple sets exist
   - Zoom controls (+/- buttons or scroll)

### Lightbox HTML Structure
```html
<div class="layers-lightbox-overlay" role="dialog" aria-modal="true">
  <div class="layers-lightbox-backdrop"></div>
  <div class="layers-lightbox-content">
    <button class="layers-lightbox-close" aria-label="Close">×</button>
    <div class="layers-lightbox-canvas-container">
      <canvas class="layers-lightbox-canvas"></canvas>
    </div>
    <div class="layers-lightbox-controls">
      <button class="layers-lightbox-edit">Edit Layers</button>
      <div class="layers-lightbox-zoom">
        <button>−</button>
        <span>100%</span>
        <button>+</button>
      </div>
    </div>
  </div>
</div>
```

### Implementation Steps

1. Modify Hooks/LayersHookHandler.php to detect `link=layers`
2. Create `resources/ext.layers.lightbox/` module
3. Implement LayersLightbox.js with modal, canvas, controls
4. Add CSS for lightbox styling
5. Register module in extension.json
6. Add documentation for new syntax

### Accessibility
- Focus trap within lightbox
- Escape key to close
- ARIA labels and roles
- Announce lightbox open/close to screen readers

### Estimated Effort
- **4-5 days** for full implementation
- Files: New Lightbox module, hook modifications, CSS

---

## 6. World-Class Feature Ideas

These are aspirational features that would differentiate Layers from other annotation tools.

### 6.1 Collaborative Real-Time Editing

**Complexity:** Very High  
**Value:** High for team environments

Enable multiple users to edit the same layer set simultaneously with live cursor positions and conflict resolution.

- WebSocket or Server-Sent Events for real-time sync
- Operational Transform or CRDT for conflict resolution
- Show other users' cursors and selections
- Lock layers being actively edited
- Presence indicators (who's viewing/editing)

### 6.2 Layer Templates / Stamps

**Complexity:** Medium  
**Value:** High for repeated workflows

Pre-built annotation templates that can be dropped onto images.

- Callout bubbles with customizable text
- Measurement rulers/scales
- Icon library (checkmarks, X marks, arrows, numbers)
- Custom template creation and sharing
- Organization-wide template library
- Recent templates for quick access

### 6.3 AI-Assisted Annotations

**Complexity:** High  
**Value:** Very High for productivity

Leverage AI to suggest or auto-generate annotations.

- **Object detection**: Suggest bounding boxes around detected objects
- **OCR integration**: Extract text from images for annotation
- **Smart labeling**: Suggest labels based on image content
- **Auto-sizing**: Fit callouts to detected regions
- **Accessibility**: Auto-generate alt text from annotations

### 6.4 Animation / Presentation Mode

**Complexity:** Medium-High  
**Value:** High for educational content

Animate layer visibility for step-by-step presentations.

- Define reveal order for layers
- Transition effects (fade, slide, zoom)
- Play/pause/step controls
- Export as GIF or video
- Embed animated presentations in wiki pages
- Timeline editor for sequencing

### 6.5 Measurement Tools

**Complexity:** Medium  
**Value:** High for technical/scientific use

Add calibrated measurement capabilities.

- Set scale reference (e.g., "100px = 1cm")
- Ruler tool that shows real-world measurements
- Area measurement for shapes
- Angle measurement tool
- Export measurements as data

### 6.6 Layer Linking / Hotspots

**Complexity:** Medium  
**Value:** High for documentation

Make layers clickable to navigate to wiki pages or other resources.

- Click a layer to navigate to linked wiki page
- Tooltip preview on hover
- Image maps with multiple clickable regions
- External URL linking with confirmation
- Cross-image layer linking (click to view related image)

### 6.7 Version Comparison / Diff View

**Complexity:** Medium  
**Value:** Medium-High

Compare layer sets across revisions.

- Side-by-side revision comparison
- Highlight added/removed/modified layers
- Slider overlay comparison (like image diff tools)
- Revert individual layers from previous revisions
- Visual diff in revision history

### 6.8 Mobile Touch Support

**Complexity:** High  
**Value:** High for accessibility

Full touch support for tablets and phones.

- Pinch-to-zoom, two-finger pan
- Touch-optimized toolbar
- On-screen keyboard integration for text
- Gesture support (two-finger rotate)
- Responsive layout for small screens
- Progressive Web App capabilities

---

## Implementation Priority (Updated)

| Feature | Priority | Effort | Value | Status |
|---------|----------|--------|-------|--------|
| Deep Linking to Editor | High | Medium | High | ⏳ Proposed |
| Lightbox Viewer | High | Medium | High | ⏳ Proposed |
| Blur as Blend Mode | Medium | Medium | Medium | ⏳ Proposed |
| Layer Templates | Medium | Medium | High | 💡 Idea |
| Measurement Tools | Medium | Medium | High | 💡 Idea |
| Layer Linking/Hotspots | Medium | Medium | High | 💡 Idea |
| Mobile Touch Support | Medium | High | High | 💡 Idea |
| Version Comparison | Low | Medium | Medium | 💡 Idea |
| Animation Mode | Low | High | Medium | 💡 Idea |
| Collaborative Editing | Low | Very High | High | 💡 Idea |
| AI-Assisted Annotations | Low | High | Very High | 💡 Idea |

### Recommended Next Features
1. **Deep Linking to Editor** - Enables form integration workflow
2. **Lightbox Viewer** - Major UX improvement for readers
3. **Layer Templates** - High productivity gain for common annotations

---

*Document created: December 13, 2025*  
*Last updated: December 22, 2025*
