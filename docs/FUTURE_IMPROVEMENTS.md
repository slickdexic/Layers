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

## Related Issues

- None currently linked

---

*Document created: December 13, 2025*  
*Last updated: December 16, 2025*
