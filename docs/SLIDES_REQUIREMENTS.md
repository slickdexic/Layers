# Slides Feature Requirements

**Created:** January 22, 2026  
**Status:** Planning Phase — All implementations were corrupted/lost and need to be rebuilt  
**Priority:** HIGH

---

## Executive Summary

The Slides feature allows creating canvas-based graphics directly in wikitext without requiring a base image file. This feature was partially implemented but all PHP infrastructure was corrupted or lost. This document captures the original requirements to guide reimplementation.

---

## Core Wikitext Syntax

```mediawiki
{{#Slide: SlideName | canvas=WxH | size=WxH | background=#color}}
```

### Parameters

| Parameter | Description | When Evaluated | Default |
|-----------|-------------|----------------|---------|
| `SlideName` | Unique identifier for the slide | Always | (required) |
| `canvas=WxH` | Canvas/editing resolution | Only on NEW slide creation | `$wgLayersSlideDefaultWidth × $wgLayersSlideDefaultHeight` (800×600) |
| `size=WxH` | Display size for rendering | Every render | Canvas dimensions |
| `background=#color` | Background color | Only on NEW slide creation | Transparent |

---

## Requirement Details

### REQ-1: Canvas Dimension Handling

**Description:** The `canvas=WxH` parameter sets the internal canvas resolution used for editing.

**Behavior:**
1. On **first creation** (slide doesn't exist in database): Use the `canvas=WxH` value to set initial canvas size
2. On **subsequent renders** (slide exists): IGNORE the wikitext `canvas=WxH` parameter; use saved database values instead
3. If `canvas=WxH` is omitted on first creation: Use default from `$wgLayersSlideDefaultWidth` × `$wgLayersSlideDefaultHeight`
4. If defaults not configured in LocalSettings.php: Use 800×600

**Rationale:** This allows users to change canvas size in the editor without the wikitext overriding their changes. The wikitext only provides initial sizing hints.

**Configuration:**
```php
// LocalSettings.php
$wgLayersSlideDefaultWidth = 800;   // Default if not set
$wgLayersSlideDefaultHeight = 600;  // Default if not set
```

---

### REQ-2: Display Size Handling

**Description:** The `size=WxH` parameter controls how the slide is rendered on article pages.

**Behavior:**
1. Scale the slide to fit within the specified `size=WxH` dimensions
2. **Maintain aspect ratio** — the canvas will not be stretched or distorted
3. Use the **saved canvas dimensions** (from database) to calculate aspect ratio, NOT the wikitext `canvas=WxH` values
4. If only width is specified (`size=400`), scale proportionally
5. If only height is specified (`size=x300`), scale proportionally

**Example:**
- Canvas saved as 1200×800 (3:2 ratio)
- `size=600x600` specified
- Result: Render at 600×400 (fits within 600×600 while maintaining 3:2 ratio)

---

### REQ-3: Background Handling

**Description:** Slide backgrounds can be transparent or a solid color.

**Behavior:**
1. **New slides** default to **transparent background** (no color)
2. `background=#color` parameter only applies on **first creation**
3. Once created, background color is managed in the editor
4. When background is transparent in the editor:
   - Display standard **checkerboard pattern** (gray/white squares)
   - Do NOT show a solid color or placeholder image

**Background Layer Controls (Editor):**
When the background layer is selected, show:
- ✅ **Color picker** (replaces image icon for regular layers)
- ✅ **Visibility toggle**
- ✅ **Opacity slider**
- ❌ NO delete icon (cannot delete background)
- ❌ NO lock icon (background behavior is fixed)

---

### REQ-4: Canvas Dimension Controls in Editor

**Description:** Users must be able to change canvas dimensions from within the editor.

**Options (decide based on UX best practices):**
1. **Option A:** Canvas dimension inputs in top toolbar (always visible)
2. **Option B:** Canvas dimension inputs in properties panel when background layer is selected

**Recommendation:** Option B is more consistent with Figma/Canvas-based editors where artboard size is a property of the artboard.

**Behavior:**
- Changing dimensions in editor updates the saved canvas size
- Previous wikitext `canvas=WxH` values are completely ignored after initial creation
- Dimension changes should trigger immediate canvas resize (with confirmation if shrinking would clip content)

---

### REQ-5: Editor Experience

**Description:** The slide editor should be a modal/overlay, not a page navigation.

**Current Problem:** The previous implementation used `window.location.href` navigation to `Special:EditSlide`, causing:
- bfcache issues (page restored from cache doesn't re-run JavaScript)
- Inconsistent experience compared to image layer editing (which uses modal)
- User has to click back button instead of X/close

**Required Behavior:**
1. Editor opens as **modal overlay** (like image layer editor)
2. Same iframe-based approach used for image editing
3. On save/close, modal closes and parent page updates

---

### REQ-6: Post-Edit Refresh

**Description:** When the editor closes, slides on the article page must update immediately.

**Required Behavior:**
1. After save/close, all `{{#Slide:}}` renders on the page refresh with new content
2. User should NOT need to refresh the page manually
3. Behavior must match image layer sets (which already update immediately)

**Technical Notes:**
- Image layers work because modal editor has a close callback that triggers `refreshAllViewers()`
- For slides, ensure the same callback mechanism is used
- If page navigation is used instead, bfcache will prevent JavaScript from running on return

**Past Struggle Warning:**
This was difficult to implement previously. The key insight is:
1. Use modal editor (not page navigation)
2. If page navigation is unavoidable, use `pageshow` event to detect bfcache restoration
3. Call `refreshAllViewers()` which should also refresh slides

---

### REQ-7: Slide Storage

**Description:** Slides are stored in the same `layer_sets` table as image layer sets.

**Differences from image layer sets:**
| Aspect | Image Layer Sets | Slides |
|--------|-----------------|--------|
| `ls_img_name` | Filename (e.g., "Example.jpg") | Slide name (e.g., "MySlide") |
| `ls_img_sha1` | SHA1 hash of image file | Deterministic hash from slide name |
| Base image | Required, exists in MediaWiki | None |
| Canvas size | From image dimensions | Stored in layer data metadata |

**Slide metadata in layer data:**
```json
{
  "revision": 1,
  "schema": 1,
  "created": "2026-01-22T...",
  "canvasWidth": 1200,
  "canvasHeight": 800,
  "backgroundColor": "#ffffff",
  "backgroundVisible": true,
  "backgroundOpacity": 1,
  "layers": [...]
}
```

---

### REQ-8: Slide Name Validation

**Description:** Slide names must be validated to prevent security issues and conflicts.

**Validation Rules:**
- Alphanumeric characters, hyphens, underscores only: `[A-Za-z0-9_-]+`
- Length: 1-100 characters
- Case-sensitive
- Reserved names blocked: `new`, `delete`, `edit`, `list`, `create`, `save`, `all`, `default`
- No path traversal characters: `/`, `\`, `..`

**Error Messages:**
- `layers-slide-name-invalid` — Invalid characters
- `layers-slide-name-too-long` — Exceeds 100 characters
- `layers-slide-name-reserved` — Reserved name used
- `layers-slide-name-empty` — Empty name

---

### REQ-9: API Support

**Description:** The API must support slide operations.

**Required API Modules:**

1. **`action=layersinfo`** — Existing, needs slide support
   - Accept `slidename` parameter (alternative to `filename`)
   - Return slide layer data the same as image layer data
   - Return canvas dimensions in response

2. **`action=layerssave`** — Existing, needs slide support
   - Accept `slidename` parameter (alternative to `filename`)
   - Validate slide name
   - Store canvas dimensions in layer data metadata

3. **`action=layersdelete`** — Existing, needs slide support
   - Accept `slidename` parameter (alternative to `filename`)
   - Delete slide and all its revisions

4. **`action=layerslist`** — NEW
   - List all slides (paginated)
   - Filter by creator, date range
   - Return slide name, dimensions, layer count, last modified

---

### REQ-10: Special Pages

**Description:** Admin/management pages for slides.

**Special:Slides**
- List all slides in the wiki
- Grid view with thumbnails
- Search/filter by name
- Sort by name, date created, last modified
- Create new slide (dialog with preset sizes)
- Delete slides (with confirmation)
- Pagination for large collections

**Special:EditSlide/SlideName**
- Direct URL access to edit a specific slide
- Opens editor in full-page mode OR redirects to article with modal
- Creates slide if it doesn't exist (with default dimensions)

---

## Implementation Priority

### Phase 1: Core Infrastructure (Must Have)
1. ✅ Remove phantom extension.json references (DONE)
2. Create `SlideHooks.php` with `{{#Slide:}}` parser function
3. Create `SlideNameValidator.php` for name validation
4. Add `slide` magic word to `Layers.i18n.magic.php`
5. Update API modules to support `slidename` parameter
6. Create slide container HTML generation

### Phase 2: Editor Integration
1. Add slide mode detection to `LayersEditor.js`
2. Implement transparent background checkerboard pattern
3. Add canvas dimension controls to properties panel
4. Implement background layer controls (color picker, opacity, visibility)
5. Use modal editor instead of page navigation

### Phase 3: Viewer & Refresh
1. Implement slide rendering on article pages
2. Implement post-edit refresh (modal close callback)
3. Add slide support to `ViewerManager.js`
4. Add slide lightbox support

### Phase 4: Management
1. Create `ApiLayersList.php` for listing slides
2. Create `SpecialSlides.php` for slide management
3. Create `SpecialEditSlide.php` for direct editing

---

## Known Past Struggles (Warnings)

### Canvas Dimension Persistence Issue

**Symptom:** Canvas dimensions kept reverting to 800×600 after save/close/reopen.

**Root Cause:** Timing issue in `CanvasManager.init()` — it was called in the constructor BEFORE slide dimensions could be set. The `handleImageLoadError()` callback would overwrite dimensions to defaults.

**Solution:** Pass slide dimensions through CanvasManager config and set `baseWidth`/`baseHeight` BEFORE calling `init()`.

**Files Affected:**
- `resources/ext.layers.editor/CanvasManager.js`
- `resources/ext.layers.editor/LayersEditor.js`

### Post-Edit Refresh Issue

**Symptom:** Slides didn't refresh after editor close; required page reload.

**Root Cause:** Slides used `window.location.href` navigation to `Special:EditSlide` (full page navigation) while images use a modal editor with a callback. When the slide editor closes via `history.back()`, the browser restores the page from bfcache (back-forward cache), which does NOT re-execute JavaScript.

**Solution:** 
1. Use modal editor (preferred) — has close callback
2. If page navigation required — add `pageshow` event listener to detect bfcache restoration and call `refreshAllViewers()`

**Files Affected:**
- `resources/ext.layers/init.js`
- `resources/ext.layers/viewer/ViewerManager.js`

---

## Configuration Summary

```php
// LocalSettings.php - Slide configuration options

// Master switch for Slides feature
$wgLayersSlidesEnable = true;

// Default canvas dimensions (used when canvas=WxH not specified)
$wgLayersSlideDefaultWidth = 800;
$wgLayersSlideDefaultHeight = 600;

// Maximum allowed canvas dimensions
$wgLayersSlideMaxWidth = 4096;
$wgLayersSlideMaxHeight = 4096;

// Default background color (only for new slides without background= param)
// Set to empty string or null for transparent
$wgLayersSlideDefaultBackground = "";
```

---

## i18n Messages Needed

```json
{
  "layers-slide-empty": "This slide is empty. Click to add content.",
  "layers-slide-empty-hint": "Use the editor to add shapes, text, and images.",
  "layers-slide-name-invalid": "Slide name contains invalid characters. Use only letters, numbers, hyphens, and underscores.",
  "layers-slide-name-too-long": "Slide name must be 100 characters or less.",
  "layers-slide-name-reserved": "This slide name is reserved and cannot be used.",
  "layers-slide-name-empty": "Slide name cannot be empty.",
  "layers-slide-not-found": "Slide \"$1\" was not found.",
  "layers-slide-create-confirm": "Slide \"$1\" does not exist. Create it?",
  "layers-slide-canvas-width": "Canvas width",
  "layers-slide-canvas-height": "Canvas height",
  "layers-slide-background-color": "Background color",
  "layers-slide-background-transparent": "Transparent",
  "layers-special-slides": "Slides",
  "layers-special-slides-desc": "Manage slide graphics",
  "layers-special-editslide": "Edit Slide",
  "layers-special-editslide-desc": "Edit a slide graphic"
}
```

---

*Document created January 22, 2026 after reverting to commit f7daf30.*  
*All previous Slides implementation was corrupted/lost and must be rebuilt from this specification.*
