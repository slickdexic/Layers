# Changelog

Version history for the Layers extension.

---

## Version 1.2.2 (December 23, 2025)

### Bug Fixes
- **Fixed `layerslink=editor` and `layerslink=viewer` not working** — Deep linking parameters now correctly modify the image link destination. Previously, clicking layered images with these parameters would still navigate to the File: page instead of opening the editor or lightbox viewer.
- **Fixed editor dropdown showing 'default' on deep link** — When using `layerslink=editor` with a specific layer set (e.g., `layers=anatomy`), the set selector dropdown in the editor now correctly shows the loaded set name instead of always showing 'default'.

### Technical
- MediaWiki 1.44 uses `ThumbnailBeforeProduceHTML` for thumbnail rendering instead of `MakeImageLink2`. The `$linkAttribs` parameter must be modified to change anchor destinations.
- Added `$fileLinkTypes` queue in `WikitextHooks.php` to track `layerslink` values per file occurrence, synchronized with the existing `$fileSetNames` queue.

---

## Version 1.2.1 (December 23, 2025)

### Bug Fixes
- **Fixed corner radius scaling on article pages** — Shape corner radii (`cornerRadius`, `pointRadius`, `valleyRadius`) now scale correctly when images are resized in article view. Stars, polygons, textboxes, and rounded rectangles display properly at all sizes.

### Developer Experience
- **Docker-based PHP test scripts** — New npm scripts `test:php:docker` and `fix:php:docker` for Windows developers with composer conflicts

### Testing
- E2E test stability improvements

---

## Version 1.2.0 (December 22, 2025)

### New Features
- **Deep Linking to Editor** — URL parameters allow opening the editor with a specific layer set pre-loaded:
  - `?action=editlayers&setname=anatomy` — Opens editor with "anatomy" layer set
  - Also supports `layerset` and `layers` parameter aliases
  - Set name validation: alphanumeric, hyphens, and underscores only (max 50 chars)

- **Wikitext Link Options** — New `layerslink` parameter for controlling click behavior:
  - `[[File:Example.jpg|layers=setname|layerslink=editor]]` — Opens layer editor
  - `[[File:Example.jpg|layers=setname|layerslink=viewer]]` — Opens fullscreen lightbox
  - `[[File:Example.jpg|layers=setname|layerslink=lightbox]]` — Alias for viewer mode
  - Default behavior (no layerslink): Standard MediaWiki link to File page

- **Fullscreen Lightbox Viewer** — New modal viewer for viewing layered images:
  - Keyboard accessible: Escape key closes the lightbox
  - Click outside image to close
  - Loading states and error handling
  - Proper accessibility attributes (ARIA)

---

## Version 1.1.13-REL1_39 (December 23, 2025)

### Bug Fixes
- **Fixed corner radius scaling on article pages** — Backport of the corner radius scaling fix from v1.2.1. Shape corner radii now scale correctly when images are resized in article view.

> **Note:** This is a maintenance release for the REL1_39 branch (MediaWiki 1.39-1.43).

---

## Version 1.1.12 (December 22, 2025)

### Code Quality
- **Memory leak prevention** — Added timeout tracking to `APIManager.js` and `ImageLoader.js` with proper cleanup in `destroy()` methods
- **Reduced god classes** — Removed 189 lines of dead code from `LayersValidator.js` (1,036 → 843 lines)
- **Magic numbers extracted** — Added `TIMING` section to `LayersConstants.js` with 9 named delay constants

### Testing
- **6,479 tests passing** (+142 from v1.1.11)
- **92% statement coverage**, 80% branch coverage
- Added tests for new TIMING constants

### Documentation
- Added deep linking feature request to `FUTURE_IMPROVEMENTS.md`
- Added lightbox viewer feature request
- Added 8 world-class feature ideas (templates, AI, collaboration, etc.)

---

## Version 1.1.11 (December 22, 2025)

### Bug Fixes
- **Fixed ToolStyles.js constructor initialization order** — Fixed crash when `initialStyle` was provided

### Testing
- **6,337 tests passing** (+238 from v1.1.10)
- **92% statement coverage**, 80% branch coverage
- Added comprehensive tests for APIErrorHandler, NamespaceHelper, ToolStyles, LayersViewer

---

## Version 1.1.10 (December 21, 2025)

### Security
- **Removed SVG from allowed image imports** — SVG files can contain embedded JavaScript (XSS risk). Removed from allowed MIME types for security. Users requiring SVG support should implement proper sanitization.

### Bug Fixes
- **Fixed foreign repository file lookup** — Delete and Rename APIs now properly find files from foreign repositories like Wikimedia Commons

### Code Quality
- **Improved Jest coverage configuration** — Now tracks all source directories for accurate coverage reporting

### Documentation
- Updated `codebase_review.md`, `improvement_plan.md`, and `README.md` with accurate metrics

---

## Version 1.1.9 (December 21, 2025)

### Bug Fixes
- **Background visibility resetting to visible** — Fixed critical bug where background saved as hidden would show as visible when returning to the editor
  - Root cause: JavaScript used `visible !== false` which returns `true` for integer `0`
  - Fixed three locations to check `visible !== false && visible !== 0`
  - See `docs/POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md` for full analysis

### Security
- **Added setname sanitization** — Delete and Rename APIs now sanitize user-supplied set names

### Code Quality
- **Extracted MathUtils.js** — Shared utility module for `clampOpacity()` (DRY improvement)
- **Fixed memory leak** — Added `cancelAnimationFrame()` to `CanvasManager.destroy()`
- **Fixed console.error** — Replaced with `mw.log.error()` in ViewerManager.js

### Testing
- **5,766 tests passing** (+157 from v1.1.7)

---

## Version 1.1.8 (December 21, 2025)

### Bug Fixes
- **Background visibility not applied on article pages** — Fixed critical bug where `backgroundVisible: false` was not being honored on article pages for large layer sets (>100KB)
  - Root cause: MediaWiki's API drops boolean `false` values during JSON serialization
  - Solution: Extended `preserveLayerBooleans()` to convert `backgroundVisible` to 0/1 integer

### Testing
- Added `ApiLayersInfoBooleanPreservationTest.php` with 8 tests

---

## Version 1.1.7 (December 20, 2025)

### New Features
- **Smart Guides** — Intelligent snapping to other objects
  - Snap to object edges (left, right, top, bottom)
  - Snap to object centers (horizontal, vertical)
  - Visual guide lines: magenta for edges, cyan for centers
  - 8px snap threshold, **off by default** — toggle with `;` key
- **Arrange Dropdown Menu** — Consolidated toolbar UI
  - New "Arrange & Snap" dropdown replaces 8 individual alignment buttons
  - Contains: Smart Guides toggle, Align options, Distribute options
  - Saves toolbar space for future features
  - Shows disabled state when insufficient layers selected

### Changes
- Removed standalone eyedropper button from toolbar (use the eyedropper within the browser's color picker instead)
- Removed **I**/**Shift+I** keyboard shortcuts (eyedropper available via native color picker)
- Smart guides now **off by default** — press `;` to toggle or use Arrange menu
- Added `;` keyboard shortcut to toggle Smart Guides
- Updated blur tool documentation — now described as visual effect only, removed "redaction" and "privacy" terminology

### Cleanup
- Removed unused `EyedropperController` module (~480 lines, 66 tests) — redundant with browser's native color picker
- Removed eyedropper CSS styles and ToolRegistry entry

### Refactoring
- Extracted `SmartGuidesController` (~500 lines)
- Consolidated alignment buttons into dropdown menu

### Testing
- Added 43 new tests for Smart Guides
- Total tests: 5,609 passing

---

## Version 1.1.6 (December 20, 2025)

### New Features
- **Key Object Alignment** — Industry-standard alignment matching Adobe Illustrator/Photoshop
  - Last selected layer becomes the "key object" with orange border
  - Other layers align TO the key object, which stays fixed
  - Works for all alignment operations

### Bug Fixes
- Fixed text layer alignment not working correctly
- Fixed `lastSelectedId` tracking when adding to selection

### Refactoring
- Extracted `ColorControlFactory` from `ToolbarStyleControls` for better maintainability
- Extracted `PresetStyleManager` from `ToolbarStyleControls` (now under 1,000 lines)

### Testing
- Added comprehensive tests for alignment and selection
- Total tests: 5,437 passing

---

## Version 1.1.5 (December 18, 2025)

### New Features
- **Alignment Tools** — Align layers left/center/right, top/middle/bottom
- **Distribution Tools** — Distribute layers evenly horizontally or vertically
- **Style Presets System** — Save and reuse style configurations

### Improvements
- Enhanced toolbar with alignment buttons
- Better multi-selection handling

---

## Version 1.1.3 (December 18, 2025)

### Bug Fixes
- Fixed text shadow rendering in viewer
- Fixed shadow opacity handling

### Refactoring
- Extracted `LayerDataNormalizer` for consistent data type handling
- Shared between editor and viewer for consistent rendering

---

## Version 1.1.0 (December 10, 2025)

### New Features
- **Text Box Tool** — Multi-line text with container
  - Word wrap and text alignment
  - Vertical alignment options
  - Padding and corner radius
  - Container styling
- **Named Layer Sets** — Multiple annotation sets per image
  - Create, rename, delete sets
  - Independent revision history per set
  - Wikitext support: `[[File:X.png|layers=setname]]`
- **Import Images** — Add external images as layers
- **Export as PNG** — Download annotated images

### Improvements
- Enhanced revision management
- Per-set background settings
- Better error handling

### Configuration
- Added `$wgLayersMaxNamedSets`
- Added `$wgLayersMaxRevisionsPerSet`
- Added `$wgLayersMaxImageBytes`

---

## Version 1.0.5 (November 15, 2025)

### Improvements
- Performance optimizations for large images
- Better zoom/pan handling
- Improved keyboard navigation

### Bug Fixes
- Fixed rotation handle positioning
- Fixed circle tool centering
- Fixed path tool memory leak

---

## Version 1.0.0 (November 1, 2025)

### Initial Release

#### Features
- **13 Drawing Tools**
  - Pointer, Zoom
  - Text, Pen
  - Rectangle, Circle, Ellipse
  - Polygon, Star
  - Arrow, Line
  - Blur

- **Layer Management**
  - Visibility toggles
  - Lock/unlock
  - Drag-and-drop reorder
  - Duplicate layers

- **Style Options**
  - Stroke and fill colors
  - Opacity controls
  - Shadow effects
  - Blend modes

- **Integration**
  - "Edit Layers" tab on File: pages
  - Wikitext support: `[[File:X.png|layers=on]]`
  - API endpoints

- **Accessibility**
  - WCAG 2.1 compliance
  - Full keyboard navigation
  - Screen reader support

#### Technical
- PHP 8.1+ required
- MediaWiki 1.39+ supported
- Validated JSON storage
- CSRF protection
- Rate limiting

---

## Upgrade Notes

### Upgrading to 1.1.x

1. Run database update:
   ```bash
   php maintenance/run.php update.php
   ```

2. Clear caches:
   ```bash
   php maintenance/run.php rebuildLocalisationCache.php
   ```

### Upgrading from Pre-1.0

Complete reinstall recommended:

1. Backup existing layer data (if any)
2. Remove old extension
3. Install fresh from GitHub
4. Run database update

---

## See Also

- [Full CHANGELOG on GitHub](https://github.com/slickdexic/Layers/blob/main/CHANGELOG.md)
- [[Installation]] — Setup guide
- [[Configuration Reference]] — All settings
