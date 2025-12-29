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

## ~~3. Blur as Blend Mode for All Shapes~~

**Priority:** Medium  
**Complexity:** Medium-High  
**Status:** ✅ Implemented in v1.2.6

### Description
Allow any shape (rectangle, circle, ellipse, polygon, star) to use "blur" as a blend mode, creating blurred regions in any shape. This generalizes the current blur tool and enables creative use cases like privacy masks, focus effects, and stylized callouts.

### Implementation Summary
- Added 'blur' to valid blend modes in `LayersValidator.js`, `LayersConstants.js`, and `ServerSideLayerValidator.php`
- Added `drawBlurWithShape()` and `hasBlurBlendMode()` methods to `EffectsRenderer.js`
- Added blur blend mode support to `LayerRenderer.js` with shape path drawing helpers
- Added blur blend mode support to `CanvasRenderer.js` for editor preview
- Shapes with `blendMode: 'blur'` use shape geometry as clip path, apply blur filter within
- Uses `blurRadius` property (default 12, clamped 1-64)
- Fallback: gray semi-transparent overlay when no background image available

### User Story
As a user, I want to apply blur effect to any shape (not just rectangles) so I can create circular privacy masks, star-shaped focus effects, or complex path-based blur regions.

### Layer Example
```javascript
{
  type: 'ellipse',
  x: 200,
  y: 150,
  radiusX: 80,
  radiusY: 60,
  blendMode: 'blur',
  blurRadius: 15,  // optional, default 12
  opacity: 1
}
```

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
| **Enhanced Layerslink Navigation** | **High** | **Low-High** | **High** | ⏳ **Proposed** |
| Deep Linking to Editor | High | Medium | High | ⏳ Proposed |
| Lightbox Viewer | High | Medium | High | ⏳ Proposed |
| ~~Blur as Blend Mode~~ | Medium | Medium | Medium | ✅ v1.2.6 |
| Layer Templates | Medium | Medium | High | 💡 Idea |
| Measurement Tools | Medium | Medium | High | 💡 Idea |
| Layer Linking/Hotspots | Medium | Medium | High | 💡 Idea |
| Mobile Touch Support | Medium | High | High | 💡 Idea |
| Version Comparison | Low | Medium | Medium | 💡 Idea |
| Animation Mode | Low | High | Medium | 💡 Idea |
| Collaborative Editing | Low | Very High | High | 💡 Idea |
| AI-Assisted Annotations | Low | High | Very High | 💡 Idea |

### Recommended Next Features
1. **Enhanced Layerslink Navigation** - Critical for Page Forms integration (Phase 1: newtab is quick win)
2. **Deep Linking to Editor** - Enables form integration workflow
3. **Lightbox Viewer** - Major UX improvement for readers
4. **Layer Templates** - High productivity gain for common annotations

---

## 7. Enhanced Layerslink Navigation Modes

**Priority:** High  
**Complexity:** Low to High (phased)  
**Status:** ⏳ Proposed  
**Full Specification:** [FEATURE_REQUEST_LAYERSLINK_RETURN.md](FEATURE_REQUEST_LAYERSLINK_RETURN.md)

### Description
Extend the `layerslink` parameter to support better navigation workflows when editing layers from within wiki pages, especially for Page Forms integration.

### User Story
As a user editing a Page Forms form, I want to click on a layered image to edit its annotations, then return to my form without losing my unsaved form data.

### Proposed Values

| Value | Behavior | Effort |
|-------|----------|--------|
| `editor-newtab` | Opens editor in new browser tab | Low (1 hour) |
| `editor-return` | Returns to original page after save/close | Medium (4-6 hours) |
| `editor-modal` | Opens editor in overlay modal on current page | High (2-3 days) |

### Wikitext Examples

```wikitext
<!-- Open in new tab (simple, preserves original page) -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-newtab]]

<!-- Return to this page after editing -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-return]]

<!-- Best UX: Modal overlay, form data preserved -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-modal]]
```

### Benefits
- **Form compatibility**: Edit layers without losing form data
- **Better flow**: Return to original context after editing
- **Multi-image editing**: Edit several images without navigation ping-pong

### Recommended Implementation Order
1. **Phase 1 (v1.2.1)**: `editor-newtab` — Quick win, no risk
2. **Phase 2 (v1.3.0)**: `editor-return` — Better UX, familiar MediaWiki pattern
3. **Phase 3 (v1.4.0)**: `editor-modal` — Best experience for form workflows

See full specification document for implementation details, security considerations, and accessibility requirements.

---

## 8. Auto-Create Layer Set on Editor Link

**Priority:** Medium  
**Complexity:** Medium  
**Status:** ✅ Implemented (v1.2.9)  
**Full Specification:** [FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md](FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md)

### Description
When a wikitext link references a layer set that doesn't exist yet using `layerslink=editor`, automatically create that layer set when the user opens the editor (if they have `createlayers` permission).

### User Story
As a wiki author, I want to add `[[File:Diagram.png|layers=heart-diagram|layerslink=editor]]` to my article and have the `heart-diagram` layer set auto-created when I first click the link, so I don't have to manually create it on the File: page first.

### Key Benefits
- **Streamlined workflow**: No manual set creation step required
- **Template-friendly**: Article templates can define layer set names that get created on first use
- **Page Forms integration**: Form-generated layer set names work automatically
- **Collaborative workflows**: Team members can be assigned specific sets via links

### Wikitext Example

```wikitext
<!-- Link to non-existent set - auto-created on first editor open -->
[[File:Anatomy.png|layers=heart-diagram|layerslink=editor]]
```

### Permission Requirements
- User must have `createlayers` right (not just `editlayers`)
- Rate limiting applies via existing `editlayers-create` limiter
- Set name validated against allowed pattern

### Implementation Estimate
~12 hours total (backend, frontend, testing, documentation)

See full specification document for implementation details, edge cases, and security considerations.

---

## 9. Layer Groups (Folders)

**Priority:** High  
**Complexity:** High (~50 hours)  
**Status:** ⏳ Proposed  
**Full Specification:** [FEATURE_REQUEST_LAYER_GROUPS.md](FEATURE_REQUEST_LAYER_GROUPS.md)

### Description
Allow users to organize layers into collapsible groups (folders) in the Layer Panel. Groups behave as a single unit for selection, movement, visibility, and other operations.

### Key Features
- Create/rename/delete layer groups
- Drag layers into/out of groups
- Expand/collapse groups to reduce clutter
- Selecting a group selects all child layers
- Moving a group moves all children together
- Group visibility toggle affects all children
- Support for nested groups (2-3 levels deep)
- Keyboard shortcuts: Ctrl+G to group, Ctrl+Shift+G to ungroup

### Industry References
- Adobe Photoshop: Layer Groups with folder metaphor
- Figma: Frames and Groups with nesting
- Sketch: Groups with double-click to enter

---

## 10. Context-Aware Toolbar

**Priority:** Medium  
**Complexity:** Medium (~4 hours actual)  
**Status:** ✅ Implemented (v1.2.10)  
**Full Specification:** [FEATURE_REQUEST_CONTEXT_AWARE_TOOLBAR.md](FEATURE_REQUEST_CONTEXT_AWARE_TOOLBAR.md)

### Description
Show only relevant toolbar controls based on the currently selected tool or layer. Hide stroke width, stroke color, fill color, and other style controls when they are not applicable.

### Implementation Summary
- Added `updateContextVisibility()` to `ToolbarStyleControls.js`
- Added `updateContextForSelectedLayers()` for selection-based visibility
- CSS transitions via `context-hidden` class with opacity/max-width animation
- Configuration: `$wgLayersContextAwareToolbar` (default: true)
- 20 new Jest tests added

### Context Examples
| Context | Controls Shown |
|---------|----------------|
| Select tool (nothing selected) | Tool buttons only |
| Rectangle/shape tools | Stroke, Fill, Width, Presets |
| Text tool | Font size, Text stroke, Shadow |
| Arrow/Pen tools | Stroke, Width (no fill) |
| Shape layer selected | Full style controls |

### Configuration
```php
// Disable context-aware toolbar (show all controls always)
$wgLayersContextAwareToolbar = false;
```

---

*Document created: December 13, 2025*  
*Last updated: December 28, 2025*
