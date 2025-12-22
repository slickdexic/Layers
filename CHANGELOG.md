# Changelog

All notable changes to the Layers MediaWiki Extension will be documented in this file.

## [1.1.10] - 2025-12-21

### Security
- **Removed SVG from allowed image imports** — SVG files can contain embedded JavaScript, creating XSS vulnerabilities. Removed `image/svg+xml` from allowed MIME types in `ServerSideLayerValidator.php`.

### Bug Fixes
- **Fixed foreign repository file lookup** — `ApiLayersDelete` and `ApiLayersRename` now use `getRepoGroup()->findFile()` instead of `getLocalRepo()->findFile()`, enabling proper support for files from foreign repositories like Wikimedia Commons.

---

## [1.1.9] - 2025-12-21

### Bug Fixes
- **Background visibility resetting to visible when re-opening editor** — Fixed bug where background saved as hidden would show as visible when returning to the editor.
  - **Root cause:** JavaScript used `visible !== false` which returns `true` for integer `0` because strict equality doesn't convert types.
  - **Solution:** Fixed three locations to check `visible !== false && visible !== 0` and normalize integers to booleans at API boundary in `APIManager.extractLayerSetData()`.
  - **Files fixed:** `APIManager.js`, `BackgroundLayerController.js`, `LayerPanel.js`
  - **See:** `docs/POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md` for full analysis

### Security
- **Added setname sanitization** — `ApiLayersDelete.php` and `ApiLayersRename.php` now sanitize user-supplied set names

### Code Quality
- **Extracted MathUtils.js** — Created shared utility module for `clampOpacity()` and other math functions (DRY improvement)
- **Fixed memory leak** — Added `cancelAnimationFrame()` to `CanvasManager.destroy()`
- **Fixed console.error** — Replaced with `mw.log.error()` in `ViewerManager.js`
- **Added BackgroundLayerController** — Added missing file to ResourceLoader modules

### Testing
- Added 4 new tests in `APIManager.test.js` for integer 0/1 normalization
- Added 2 new tests in `BackgroundLayerController.test.js` for integer 0/1 handling
- Fixed failing test in `LayersViewer.test.js` (opacity assertion)
- **5,766 tests passing**

### Documentation
- Added `docs/POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md` — Comprehensive post-mortem preventing recurrence
- Updated `copilot-instructions.md` with critical PHP→JS boolean serialization warning
- Updated `improvement_plan.md` — P0 items now marked complete

---

## [1.1.8] - 2025-12-21

### Bug Fixes
- **Background visibility not applied on article pages** — Fixed critical bug where `backgroundVisible: false` was not being honored on article pages when using the API fallback path (for large layer sets >100KB).
  - **Root cause:** MediaWiki's API result system drops boolean `false` values during JSON serialization. The `preserveLayerBooleans()` method in `ApiLayersInfo.php` was only converting layer-level booleans to integers, but missed `backgroundVisible` at the data level.
  - **Solution:** Extended `preserveLayerBooleans()` to also convert `backgroundVisible` to 0/1 integer, ensuring it serializes correctly through the API.
  - **Affected:** Layer sets larger than 100KB that use the API fallback path for data fetching.

### Testing
- Added `ApiLayersInfoBooleanPreservationTest.php` with 8 tests to prevent regression of boolean serialization issues

---

## [1.1.7] - 2025-12-20

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

## [1.1.6] - 2025-12-20

### New Features
- **Key Object Alignment**: Industry-standard alignment behavior (Adobe Illustrator/Photoshop pattern)
  - When multiple layers are selected, the last selected layer becomes the "key object"
  - Other layers align TO the key object, which stays fixed
  - Key object is visually distinguished with an orange border instead of blue
  - Works for all alignment operations: left, center, right, top, middle, bottom
  - Fallback to combined bounds when no key object is available
- **Text Layer Alignment**: Text layers now properly participate in alignment operations
  - Text dimensions are measured using canvas context for accurate bounds
  - Fallback estimation for environments without canvas context

### Bug Fixes
- **Alignment buttons working**: Fixed AlignmentController constructor to accept both CanvasManager directly and config object
- **Selection tracking**: Fixed `lastSelectedId` not being updated in multiple code paths:
  - LayerPanel.selectLayer now updates lastSelectedId
  - MarqueeSelection callback updates lastSelectedId
  - handleLayerSelection updates lastSelectedId for canvas clicks
  - selectAll/deselectAll maintain lastSelectedId correctly
  - ClipboardController.paste sets lastSelectedId for pasted layers

### Code Quality
- **ColorControlFactory.js extracted** (~244 lines): New UI module for color picker control creation
  - Reduces ToolbarStyleControls.js complexity
  - Reusable color button creation with proper ARIA support
- **AlignmentController.test.js added** (~395 lines): Comprehensive test suite
  - Tests for key object alignment pattern
  - Tests for all alignment and distribution operations
  - Tests for bounds calculation for different layer types
- **Debug logging cleanup**: Removed all console.log statements from AlignmentController.js

---

## [1.1.3] - 2025-12-18

### Bug Fixes
- **Text shadow rendering fix**: Text shadows on text box layers now render correctly in article view. Previously, text shadows would display in the editor but not when viewing the annotated image on article pages.
  - Root cause: Boolean properties like `textShadow` were stored as strings ("true"/"1") but rendering code used strict equality (`=== true`)
  - Solution: Created shared `LayerDataNormalizer.js` utility used by both editor and viewer
- **Image layer shadows**: Shadows on image layers now render correctly in article view

### Code Quality
- **LayerDataNormalizer.js extracted** (~228 lines): New shared utility in `ext.layers.shared/` for consistent data type normalization
  - Normalizes boolean properties: `shadow`, `textShadow`, `glow`, `visible`, `locked`, `preserveAspectRatio`
  - Normalizes numeric properties: 20+ properties including coordinates, dimensions, opacity, shadow values
  - Single source of truth - both editor and viewer use this
- **SelectionRenderer.js extracted** (~349 lines): Selection UI rendering extracted from CanvasRenderer
  - CanvasRenderer reduced from 1,132 to **834 lines** (no longer a god class!)
- **APIErrorHandler.js extracted** (~347 lines): Error handling extracted from APIManager
  - APIManager reduced from 1,385 to **1,168 lines**
- **God classes reduced from 9 to 7**: CanvasRenderer and TextBoxRenderer both now under 1,000 lines
- **47 new tests added**: LayerDataNormalizer (46 tests), SelectionRenderer (28 tests), LayersViewer shadow tests
- **Total test count: 5,297 tests passing** (+61 from v1.1.2)

### Technical Notes
- The text shadow bug was a classic type coercion issue - JSON serialization loses type information
- LayerDataNormalizer is loaded first in ext.layers.shared module to ensure availability
- Fallback normalization preserved for testing environments where shared module may not load

---

## [CRITICAL REVIEW] - 2025-12-18

### Project Health Assessment

**Status:** \u26a0\ufe0f **Accumulating Technical Debt**

A comprehensive critical review revealed that while the extension is **functional and production-ready**, the rate of feature development is outpacing debt reduction efforts. See [`CRITICAL_REVIEW_2025-12-18.md`](CRITICAL_REVIEW_2025-12-18.md) for full analysis.

**Key Findings:**
- \u2705 Core functionality works well, users satisfied
- \u2705 5,236 tests passing, 92% coverage
- \u2705 Professional security practices
- \u26a0\ufe0f **Codebase grew 14% in 30 days** (35.7K → 40.7K LOC)
- \u274c **9 god classes** (~12K LOC) - CI now blocks growth (Dec 18)
- \u274c No E2E tests in CI

**Recommended Actions:**
1. 2705 **P0:** Add CI check preventing god class growth - **DONE**
2. **P0:** Set up E2E tests in CI
3. **P1:** Split APIManager and SelectionManager
4. **Consider:** Feature freeze until debt controlled

See improvement_plan.md for detailed remediation roadmap.

---

## [1.1.2] - 2025-12-18

### Code Quality
- **Tool handlers extracted from ToolManager**: Improved code organization with delegation pattern
  - `TextToolHandler.js` (~210 lines): Handles inline text input UI for creating text layers
  - `PathToolHandler.js` (~230 lines): Handles freeform path drawing with click-to-add points
  - ToolManager now delegates to handlers when available, with inline fallback for backwards compatibility
- **Test coverage improvements across multiple files**:
  - CanvasRenderer.js: 77.81% → 91.12% (+13.3%)
  - LayersNamespace.js: 78.68% → 81.96% (+3.3%)
  - Toolbar.js: 82.82% → 90% (+7.2%)
  - UIManager.js: 81.34% → 95.44% (+14.1%)
- **Overall coverage**: 90.4% → 91.84%
- **Total test count: 5,236 tests passing** (+72 new tests)

### Technical Notes
- Tool handlers registered in extension.json for ResourceLoader
- Handlers use the established pattern from ShapeFactory, ToolRegistry, ToolStyles
- No breaking changes - ToolManager maintains full backwards compatibility

---

## [1.1.1] - 2025-12-18

### Bug Fixes
- **Background layer visibility/opacity now works in article viewer**: Previously, changing the base image layer's visibility or opacity in the editor was saved but not displayed when viewing the annotated image on article pages. Now these settings are correctly applied.
  - LayersViewer.js: Added `applyBackgroundSettings()` method
  - ViewerManager.js: Updated file page fallback to include background settings
  - ThumbnailProcessor.php: Updated to extract and inject background settings
  - LayersHtmlInjector.php: Extended payload building to support background settings

### Code Quality
- **TextBoxRenderer extracted from ShapeRenderer**: ShapeRenderer.js reduced from 1,367 to 1,049 lines (22% reduction)
- **50 new unit tests** for TextBoxRenderer
- **9 new unit tests** for background settings in LayersViewer
- **God classes reduced from 9 to 8** (ShapeRenderer now under 1,100 lines)

### Documentation
- Added P3.5 Tool Defaults System to improvement_plan.md (future feature)
- Updated codebase_review.md with current metrics

---

## [1.1.0] - 2025-12-17

### New Feature: Text Box Tool
- **Text Box Tool** (`X` key): New drawing tool combining rectangle container with multi-line text
  - Multi-line text with automatic word wrapping
  - Font family selector (Arial, Roboto, Noto Sans, Times New Roman, Courier New)
  - Bold and italic text formatting options
  - Text alignment: horizontal (left/center/right) and vertical (top/middle/bottom)
  - Adjustable corner radius for rounded rectangles
  - Configurable padding between text and box edges
  - Text is clipped to box boundaries

### Text Styling Enhancements
- **Text stroke**: Outline effect for text with customizable width and color
- **Text shadow**: Drop shadow effect for text with:
  - Enable/disable toggle
  - Shadow color picker
  - Blur radius control (0-50px)
  - X and Y offset controls (-100 to +100px)

### Bug Fixes
- Fixed text box stroke shadow (now matches rectangle shadow behavior)
- Fixed wide textarea alignment in properties panel (now right-justified like other fields)

### Technical Notes
- 19 files modified across frontend and backend
- New i18n messages for all text box properties
- Server-side validation updated for new properties (50+ whitelisted fields)
- **ShapeRenderer.js grew from ~1,050 to 1,367 lines** - extraction of TextBoxRenderer recommended

---

## [1.0.0] - 2025-12-17

### 🎉 First Stable Release

This is the first production-ready release of the Layers extension.

### Highlights
- **~91% test coverage** with ~4,800 passing tests
- **67 ES6 classes** with zero legacy prototype patterns
- **12 drawing tools**: Select, Zoom, Text, Pen, Rectangle, Circle, Ellipse, Polygon, Star, Arrow, Line, Blur
- **Named layer sets**: Multiple annotation sets per image with version history
- **Image layer import**: Add external images as annotation layers
- **Full accessibility**: Skip links, ARIA landmarks, keyboard navigation
- **Security hardened**: CSRF protection, rate limiting, strict validation

### Code Quality Improvements (December 17, 2025)
- **Extracted BackgroundLayerController.js** (380 lines) from LayerPanel.js
  - LayerPanel.js now delegates to 7 controllers for better separation of concerns
  - Added 40 unit tests for the new controller
- **God classes identified**: 9 files exceed 1,000 lines (see improvement_plan.md)
- **Test suite expanded**: ~4,800 tests across 99 test suites

### Known Technical Debt
- 9 god classes (>1,000 lines each) need refactoring
- E2E tests exist but not running in CI
- See `codebase_review.md` for detailed assessment

### CI/CD Improvements
- Fixed composer test script for CI environments
- Improved Playwright E2E workflow reliability
- Added HTML reporter for better test diagnostics

---

## [0.9.0] - 2025-12-17

### Accessibility Improvements
- **Skip Links**: Added skip links for keyboard navigation (WCAG 2.4.1 Bypass Blocks)
  - Skip to toolbar, canvas, and layers panel
  - Visually hidden until focused, then appear prominently
- **ARIA Landmarks**: Added semantic landmark roles to major sections (WCAG 1.3.1)
  - Header: `role="banner"`
  - Toolbar: `role="navigation"`
  - Main content: `role="main"`
  - Canvas: `role="region"`
  - Layers panel: `role="complementary"`
  - Status bar: `role="contentinfo"`

### Bug Fixes
- Fixed potential duplicate global handler registration in EditorBootstrap

### Technical Improvements
- Event listener audit completed: 25/27 files have proper cleanup patterns
- Added 16 new tests for image layer rendering
- Test coverage for LayerRenderer improved: 62% → 95%
- Total Jest tests: 4,591 → 4,607
- Added 8 new i18n messages for accessibility labels

---

## [0.8.9] - 2025-12-16

### New Features
- **Import Image Layer**: Add external images (logos, icons, photos) as layers via the new "Import Image" button
  - Supports PNG, JPEG, GIF, WebP formats
  - Images stored as base64 data URLs within the layer set
  - Full resize, move, and rotate support with Shift key for aspect ratio lock
- **Configurable Image Size Limit**: New `$wgLayersMaxImageBytes` setting (default 1MB)
  - Allows wiki admins to customize max imported image size
  - Recommended range: 512KB - 2MB depending on storage capacity

### Bug Fixes
- Fixed image layers not responding to resize handles
- Fixed image layers not responding to drag-to-move
- Fixed undo not working properly after importing an image
- Fixed config not being exposed on EditLayersAction page

### Technical Improvements
- Added 'image' layer type with src, originalWidth, originalHeight, preserveAspectRatio properties
- Added image rendering with caching and placeholder support in LayerRenderer
- Added 'image' case to HitTestController, GeometryUtils, ResizeCalculator, TransformController
- Updated ServerSideLayerValidator with base64 data URL validation

---

## [0.8.8] - 2025-12-16

### New Features
- **Per-Layer-Set Background Settings**: Background visibility and opacity are now saved independently for each layer set
- **Background Toggle Shortcut**: Added Shift+B keyboard shortcut to toggle background image visibility

### Bug Fixes
- Fixed image export showing blank/transparent images instead of layers
- Fixed image export showing checkerboard pattern instead of transparency
- Fixed export filename format (now uses `{filename}-layers-{timestamp}.png`)
- Fixed `updateBackgroundLayerItem` error when loading layer sets
- Added `setContext()` method to LayerRenderer for proper export context switching

### Technical Improvements
- Updated data format to include background settings: `{layers: [...], backgroundVisible, backgroundOpacity}`
- Backward compatible with old layer set format (arrays)
- Added `renderLayersToContext()` method for clean layer export rendering

---

## [0.8.7] - 2025-12-14

### New Features
- **Delete Layer Sets**: Added ability to delete named layer sets (owner/admin only)
- **Rename Layer Sets**: Added ability to rename named layer sets (owner/admin only)
- **Export as Image**: Added "Export as Image" button to download annotated images
- **Improved UI Icons**: Replaced emoji icons with proper SVG icons for better accessibility

### API Changes
- Added `layersdelete` API endpoint for deleting layer sets
- Added `layersrename` API endpoint for renaming layer sets
- Increased revision limit from 25 to 50 per layer set
- Enhanced permission checks using PermissionManager service

### Bug Fixes
- Fixed MediaWiki 1.44+ compatibility issues (getGroups → getEffectiveGroups)
- Fixed permission error handling (throws PermissionsError)
- Fixed tab ordering in file pages (Edit Layers now appears after Read/View)
- Fixed filename retrieval in API calls
- Fixed default set clearing to save immediately instead of requiring manual save

### Technical Improvements
- Added `renameNamedSet()` and `getNamedSetOwner()` methods to LayersDatabase
- Enhanced UIManager with rename/delete/clear functionality
- Added comprehensive i18n messages for all new features
- Updated documentation with new API contracts

---

## [0.8.6] - 2025-12-14

### Test Coverage & Stability
- Added 101 new tests for StateManager (68% → 98% coverage)
- Added 19 new tests for APIManager save/load workflows (84% → 87% coverage)
- Added 27 new tests for LayersNamespace registration (27% → 78% coverage)
- **4,617 Jest tests passing** across 92 test suites
- **91.22% statement coverage**, 79.18% branch coverage
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)

---

## [0.8.5] - 2025-12-13

### ES6 Migration Complete
- **100% ES6 class migration** - All 66 modules now use ES6 syntax
- Converted LayersViewer.js from prototype pattern to ES6 class
- 0 prototype patterns remaining in codebase

### Architecture Improvements
- **LayerRenderer split** - Reduced from 1,953 to 371 lines (81% reduction)
- Extracted ShapeRenderer.js (1,050 lines) for shape rendering
- Extracted ArrowRenderer.js (702 lines) for arrow rendering  
- Extracted TextRenderer.js (343 lines) for text rendering
- Extracted EffectsRenderer.js (245 lines) for blur effects
- **TransformController split** - Extracted ResizeCalculator.js (806 lines)
- Reduced CanvasManager from 2,109 to 1,975 lines

### Namespace Migration Complete
- **0 deprecated global exports** (down from 50)
- Removed last 2 legacy exports: LayerItemFactory and PolygonGeometry
- 215 namespaced exports using window.Layers.* pattern
- All modules now export exclusively to window.Layers.* namespace

### Dead Code Removal
- Removed unused `deepCloneLayers()` method from CanvasManager (30 lines)
- Removed unused `undo()`, `redo()`, `updateUndoRedoButtons()` delegation methods (50 lines)
- CanvasManager reduced from 1,975 to 1,895 lines (4% reduction)

### Bug Fixes
- **Fixed CORS/CSP issues when accessing wiki from different hostname**
  - ImageLoader now prioritizes same-origin URLs using `window.location.origin`
  - Added `isSameOrigin()` method for smart origin detection
  - Implements CORS retry logic: first tries without crossOrigin, retries with CORS if needed
  - CSP header now dynamically includes `$wgServer` for cross-origin image loading
  - Fixes "No Access-Control-Allow-Origin header" errors when `$wgServer` differs from access URL

### Test Coverage
- Added 78 new tests for ShadowRenderer (72.72% → 100% coverage)
- Added 76 new tests for ResizeCalculator (75% → 93% coverage)
- Added 28 new tests for LayerPanel keyboard navigation (77% → 87% coverage)
- Added 38 new tests for LayersViewer class
- Added 4 new fallback tests for DeepClone (81% → 100% coverage)
- Added 9 new tests for ToolManager destroy/getToolDisplayName (84% → 90% coverage)
- Added 38 new tests for TextUtils (88% → 99% statements, 63% → 91% branches)
- Added 9 new tests for TextInputController event handlers (86% → 100% coverage)
- Added 9 new tests for LayerRenderer shadow methods (87% → 96% coverage)
- Added 9 new tests for ShapeRenderer shadow integration (65% → 80% coverage)
- Added 101 new tests for StateManager (68% → 98% statements, 57% → 84% branches)
- Added 19 new tests for APIManager save/load workflows (84% → 87% statements, 67% → 71% branches)
- Added 27 new tests for LayersNamespace registration (27% → 78% statements)
- Removed 17 tests for dead code
- All **4,617 Jest tests passing**
- 92 test suites, 91.22% statement coverage, 79.18% branch coverage

### Documentation
- Updated all documentation with accurate metrics
- Corrected codebase_review.md with verified counts
- Updated improvement_plan.md with current progress

---

## [0.8.4] - 2025-12-11

### Bug Fixes
- Fixed blur layer showing raw i18n message keys (⧼layers-prop-blur-radius⧽)
- Fixed unnecessary decimals on blur width/height properties
- Fixed unnecessary decimals on arrow/line X/Y coordinates
- Fixed keyboard shortcuts (?) button not responding to clicks
- Fixed keyboard shortcuts dialog showing raw message keys
- Fixed 6 failing IconFactory tests

### i18n
- Added missing messages to ResourceLoader: `layers-type-blur`, `layers-prop-blur-radius`
- Added keyboard shortcut messages: `layers-shortcut-select-all`, `layers-shortcut-deselect`, `layers-shortcut-zoom`
- Added action messages: `layers-undo`, `layers-redo`, `layers-delete-selected`, `layers-duplicate-selected`
- Updated DialogManager to use existing i18n keys instead of non-existent ones

### Architecture
- CanvasRenderer now uses `getClass()` helper for namespace resolution
- Added DEPRECATED comments to direct `window.X` exports
- Added DialogManager backward compatibility export

### Documentation
- Updated all docs to reflect accurate codebase metrics
- Updated copilot-instructions.md with current architecture details
- Fixed README.md status and feature documentation
- Updated improvement_plan.md with current progress

### Tests
- All 3,913 Jest tests passing
- 87.84% statement coverage maintained

## [0.8.3] - 2025-12-10

### Features
- Named layer sets: Multiple annotation sets per image
- Version history: Up to 25 revisions per named set

### Bug Fixes
- Fixed shadow rendering issues (spread = 0)
- Fixed undo/redo functionality
- Fixed duplicate layer functionality
- Fixed selection state management

## [0.8.2] - 2025-12-09

### Features
- ShadowRenderer extracted from LayerRenderer
- Improved shadow effect calculations

### Bug Fixes
- Fixed shadow context issues
- Fixed shadow fill overlap

## [0.8.1-beta.1] - 2025-12-08

### Initial Beta Release
- Core annotation functionality
- 14 drawing tools
- MediaWiki integration
- Database persistence
