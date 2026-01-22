# Slide Mode Feature - Current State and Known Issues

**Last Updated:** January 24, 2026  
**Status:** Feature Complete - All Critical Issues Resolved ✅

## Feature Overview

The `{{#Slide: SlideName}}` parser function allows creating canvas-based slide graphics directly in wikitext, without requiring a base image file.

### Wikitext Syntax
```mediawiki
{{#Slide: MySlideName
| canvas=600x400
| size=300x200
| background=#ffffff
| lock=none
| class=my-custom-class
| placeholder=Click to add content
| layerset=default
}}
```

### Parameters
- `canvas=WxH` - Editor canvas dimensions (working resolution)
- `size=WxH` - Display size on article pages (scales proportionally, preserving aspect ratio)
- `background=<color>` - Background color (hex, rgb, or named color)
- `lock=none|size|all` - Lock mode for editing restrictions
- `class=<classes>` - Additional CSS classes
- `placeholder=<text>` - Placeholder text shown when empty
- `layerset=<name>` - Named layer set to use (default: 'default')

---

## Completed Fixes

### Fix 11: Slides Not Refreshing on Editor Close ✅ (January 24, 2026)
- **Version:** 1.5.25
- **Files Modified:**
  - `resources/ext.layers/init.js` - Added `pageshow` event listener (~10 lines)
  - `resources/ext.layers/viewer/ViewerManager.js` - Added ~160 lines
    - `reinitializeSlideViewer(container, payload)` - Re-renders slide canvas with new layer data (~60 lines)
    - `refreshAllSlides()` - Fetches fresh data for all slide containers via API (~100 lines)
    - Modified `refreshAllViewers()` to chain `refreshAllSlides()` and combine results
  - `tests/jest/ViewerManager.test.js` - Added 11 new tests for slide refresh functionality
  - `tests/jest/init.test.js` - Added 2 new tests for pageshow event handler
- **Root Cause:** Slides use `window.location.href` navigation to `Special:EditSlide` (full page navigation) while images use a modal editor with a callback. When the slide editor closes via `history.back()`, the browser restores the page from **bfcache (back-forward cache)**, which does NOT re-execute JavaScript. The initial fix only addressed the `refreshAllViewers()` method, but missed the bfcache issue.
- **Solution:**
  1. Added `pageshow` event listener in `init.js` that detects bfcache restoration (`event.persisted === true`)
  2. When page is restored from bfcache, calls `refreshAllViewers()` to refresh all images and slides
  3. Modified `refreshAllSlides()` to refresh ALL slide containers without requiring `layersSlideInitialized` property (which may be lost on bfcache restoration)
  4. Added `reinitializeSlideViewer(container, payload)` method to clear and re-render slide canvas
- **Impact:** After closing the editor, slides now immediately reflect changes without requiring a page reload, matching the behavior of regular images.

### Fix 8: Canvas Size Not Applied from Wikitext Parameters ✅ (January 22, 2026)
- **Files Modified:**
  - `resources/ext.layers.editor/CanvasManager.js` - Lines 246-250
  - `resources/ext.layers.editor/LayersEditor.js` - Lines 554-555
- **Root Cause:** `CanvasManager.init()` was called in the constructor BEFORE slide dimensions could be set. The `handleImageLoadError()` callback would overwrite dimensions to defaults (800×600).
- **Solution:** Pass `slideCanvasWidth` and `slideCanvasHeight` through the CanvasManager config object. In the CanvasManager constructor, set `this.baseWidth` and `this.baseHeight` from these config values BEFORE calling `init()`.
- **Code Added to CanvasManager.js:**
  ```javascript
  // For slides, set base dimensions BEFORE init() so they're available
  // when loadBackgroundImage/handleImageLoadError runs
  if ( this.config.slideCanvasWidth && this.config.slideCanvasHeight ) {
      this.baseWidth = this.config.slideCanvasWidth;
      this.baseHeight = this.config.slideCanvasHeight;
  }
  ```

### Fix 9: Edit Button Always Visible on Slides ✅ (January 22, 2026)
- **Files Modified:**
  - `resources/ext.layers/viewer/SlideViewer.css` - Complete restructure of overlay styling
  - `resources/ext.layers/viewer/ViewerManager.js` - Added `setupSlideOverlay()` method (~100 lines)
  - `src/Hooks/SlideHooks.php` - Removed server-side edit button HTML generation
- **Root Cause:** The PHP-generated edit button had CSS with no hover behavior ("always visible for accessibility" comment was incorrect).
- **Solution:**
  1. Created JavaScript-based overlay system matching the regular image overlay pattern
  2. Added `.layers-slide-overlay` container with fade-in/out transitions
  3. Overlay is hidden by default (`opacity: 0; visibility: hidden;`) and shown on container hover
  4. Removed deprecated PHP-generated button HTML (now handled by JavaScript)

### Fix 10: No "View Full Size" Overlay on Hover ✅ (January 22, 2026)
- **Files Modified:**
  - `resources/ext.layers/viewer/ViewerManager.js` - Added ~150 lines
    - `setupSlideOverlay()` - Creates overlay with edit + view buttons
    - `handleSlideEditClick()` - Opens slide editor
    - `handleSlideViewClick()` - Opens lightbox with canvas data URL
    - `_msg()` - i18n helper
    - `_createPencilIcon()` - SVG pencil icon for edit button
    - `_createExpandIcon()` - SVG expand icon for view button
- **Root Cause:** Slides didn't have lightbox integration; only images had this feature.
- **Solution:** Added "View full size" button that:
  1. Exports current canvas state to PNG data URL
  2. Opens `LayersLightbox` with the exported image
  3. Passes layer data so lightbox can re-render if needed

### Fix 1: API `filename` Requirement for Slides
- **File:** `src/Api/ApiLayersSave.php`
- Made `filename` param optional; validates either `filename` OR `slidename`

### Fix 2: Navigation After Editor Close
- **File:** `resources/ext.layers.editor/LayersEditor.js`
- For slides, use `history.back()` instead of navigating to non-existent `File:` page

### Fix 3: Canvas URL Params Passed to Editor
- **File:** `src/SpecialPages/SpecialEditSlide.php`
- Accepts both `canvaswidth`/`canvasheight` (JS) and `width`/`height` (legacy)

### Fix 4: `reloadRevisions` Error for Slides
- **File:** `resources/ext.layers.editor/APIManager.js`
- Skip `reloadRevisions()` API call for slide mode (no file to query)

### Fix 5: `renderer.render is not a function`
- **File:** `resources/ext.layers/viewer/ViewerManager.js`
- Fixed LayerRenderer instantiation: `new LayerRenderer(ctx, {canvas, zoom: 1})` and `renderer.drawLayer(layer)`

### Fix 6: Separate `canvas` and `size` Parameters
- **File:** `src/Hooks/SlideHooks.php`
- Added `size=WxH` parameter for display scaling
- Added `calculateScaledDimensions()` method for proportional scaling
- Container CSS uses display dimensions; data attributes include both canvas and display dimensions

### Fix 7: ViewerManager Display Scaling
- **File:** `resources/ext.layers/viewer/ViewerManager.js`
- `initializeSlideViewer()` reads `data-display-width/height/scale` attributes
- Canvas CSS scaling applied when display size differs from canvas size

---

## Data Flow Documentation

### Wikitext → PHP → HTML
```
{{#Slide: MySlide | canvas=600x400 | size=300x200}}
    ↓
SlideHooks::renderSlide()
    ↓
parseCanvasDimensions("600x400") → canvasWidth=600, canvasHeight=400
parseCanvasDimensions("300x200") → sizeConstraints
calculateScaledDimensions(600, 400, 300, 200) → displayWidth=300, displayHeight=200
    ↓
buildSlideHtml() generates:
<div class="layers-slide-container"
     style="width: 300px; height: 200px; ..."    ← Display dimensions
     data-canvas-width="600" data-canvas-height="400"  ← Canvas dimensions
     data-display-width="300" data-display-height="200"
     data-display-scale="0.5000"
     data-slide-name="MySlide" ...>
```

### Edit Button Click → Editor
```
User clicks edit button on slide
    ↓
ViewerManager.handleSlideEditClick() fires
    ↓
openSlideEditor() builds URL: Special:EditSlide/MySlide?canvaswidth=600&canvasheight=400&...
    ↓
SpecialEditSlide::execute() reads URL params
    ↓
Sets wgLayersEditorInit = { canvasWidth: 600, canvasHeight: 400, ... }
    ↓
EditorBootstrap.autoBootstrap() reads config
    ↓
LayersEditor created with config.slideCanvasWidth = 600
    ↓
initializeState() sets stateManager.baseWidth = 600 ✓
    ↓
CanvasManager constructor receives slideCanvasWidth/Height in config ✓
    ↓
CanvasManager sets baseWidth/baseHeight BEFORE init() ✓
    ↓
Canvas correctly sized to 600×400 ✓
```

### Editor Save → API → Database
```
LayersEditor.save()
    ↓
APIManager.saveLayers(layers, setname, slidename)
    ↓
POST action=layerssave&slidename=MySlide&setname=default&data=[...]
    ↓
ApiLayersSave validates and stores in layers_sets table
    ↓
Data includes: { layers: [...], canvasWidth: 600, canvasHeight: 400 }
```

---

## Test Coverage

All 9,922 tests pass including 380 LayersEditor tests.

Key test file: `tests/jest/LayersEditorCoverage.test.js`
- Updated `navigateBackToFile` test to mock `isSlide` correctly

---

## Configuration Variables

```php
// In LocalSettings.php
$wgLayersSlidesEnable = true;              // Enable slide feature
$wgLayersSlideDefaultWidth = 800;          // Default canvas width
$wgLayersSlideDefaultHeight = 600;         // Default canvas height
$wgLayersSlideMaxWidth = 4096;             // Maximum canvas width
$wgLayersSlideMaxHeight = 4096;            // Maximum canvas height
$wgLayersSlideDefaultBackground = '#ffffff'; // Default background color
```

---

## Related Documentation

- [docs/SLIDE_MODE.md](SLIDE_MODE.md) - Full feature specification
- [docs/NAMED_LAYER_SETS.md](NAMED_LAYER_SETS.md) - Named layer sets architecture
- [copilot-instructions.md](../.github/copilot-instructions.md) - Development guidelines
