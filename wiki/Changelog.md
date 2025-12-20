# Changelog

Version history for the Layers extension.

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
