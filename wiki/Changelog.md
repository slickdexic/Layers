# Changelog

Version history for the Layers extension.

---

## Version 1.5.10 (January 14, 2026)

### Added
- **Marker Auto-Number** — New feature for placing multiple markers quickly
  - "Auto-number" checkbox in toolbar when marker tool is selected
  - Marker values auto-increment (1→2→3... or A→B→C...)
  - Tool remains active after placing a marker for rapid sequential placement

### Fixed
- **Arrow Fill** — Arrows now properly support fill colors for fat/storage styles
- **Marker Incrementing** — Fixed markers showing same value instead of incrementing
- **Marker Controls** — Fixed auto-number checkbox disappearing after first marker
- **Ellipse Resize** — Fixed ellipse resize to keep opposite edge fixed

### Refactored
- **ForeignFileHelperTrait** — Extracted duplicate code from 4 API modules into shared trait
  - Eliminates ~90 lines of duplicated code
  - Consistent InstantCommons/foreign file handling across all API endpoints

### Tests
- **Test Count** — 9,469 tests passing (147 suites)
- Added PHPUnit tests for StaticLoggerAwareTrait (10 test methods)
- Added PHPUnit tests for ForeignFileHelperTrait and ApiLayersRename validation

---

## Version 1.5.9 (January 13, 2026)

### Removed
- **SVG Export Dead Code** — Removed 1,535 lines of unreachable code
  - The SVG export feature was never registered in extension.json
  - Code had significant bugs with stars, gradients, text boxes, and arrows
  - Removal improved branch coverage from 83.96% to 85.11%

### Improved
- **Code Quality** — All coverage targets now met
  - Statement coverage: 95.10%
  - Branch coverage: 85.11%
  - Function coverage: 93.51%
  - Line coverage: 95.23%

### Tests
- **Test Count** — 9,451 tests passing (147 suites)

---

## Version 1.5.8 (January 12, 2026)

### Added
- **Gradient Fills** — New feature for adding gradient fills to shapes
  - Support for linear gradients (customizable angle 0-360°)
  - Support for radial gradients (customizable center position and radius)
  - Interactive UI controls: gradient type selector, color stop editor, angle/position sliders
  - `GradientRenderer.js` — Core utility class for creating Canvas gradients
  - `GradientEditor.js` — UI component for editing gradient properties in the properties panel
  - 6 built-in gradient presets: sunset, ocean, forest, fire, steel, rainbow
  - Gradient validation on both client and server sides
  - PHP whitelist updated with `gradient` property (array type)
  - Supported layer types: Rectangle, Circle, Ellipse, Polygon, Star, Text Box

### Fixed
- **GradientRenderer Namespace** — Fixed 6 incorrect namespace references
- **Fill Type Toggle** — Properties panel now properly refreshes when switching between solid and gradient fill types
- **Scale Parameter Handling** — Fixed scale object extraction in ShapeRenderer.applyFillStyle() for proper gradient rendering

### Tests
- **Test Count** — 9,602 tests passing (149 suites)
- Added GradientRenderer test suite with 40 tests
- Added GradientEditor test suite with 31 tests

---

## Version 1.5.7 (January 11, 2026)

### Refactored
- **Codebase Cleanup** — Code quality improvements
  - Reduced god class count
  - Improved test coverage

### Tests
- **Test Count** — 9,489 tests passing (147 suites)

---

## Version 1.5.6 (January 10, 2026)

### Fixed
- **ShapeLibraryPanel Memory Leak Prevention** — Comprehensive cleanup improvements
  - Added `isDestroyed` check to `open()` to prevent DOM access after destruction
  - Store bound event handlers for proper removal in `destroy()`

### Tests
- **Test Count** — 9,319 tests passing (145 suites)

---

## Version 1.5.5 (January 12, 2026)

### Fixed
- **Custom Shape Shadow Rendering** — Multiple shadow rendering issues fixed
  - Shadow blur at 0 no longer defaults to 8 (uses proper `typeof` check)
  - Shadow spread now uniformly extends around all edges using dilation technique
  - Shadow spread now scales correctly on article pages (non-editor views)

- **Marker Shadow Scaling** — Marker shadows now scale correctly on article pages
  - MarkerRenderer now uses `shadowScale` from render options instead of hardcoded values

- **Dimension Layer Improvements**
  - Removed shadow controls from dimension properties (shadows not applicable to dimensions)
  - Fixed selection handles and hit testing to target actual dimension line position
  - Selection handles now appear at arrow/tick endpoints instead of extension line tips
  - Click detection works on the visible dimension line, not the measurement points

### Tests
- **Test Count** — 9,319 tests passing (144 suites)
- **Coverage** — Maintained 94%+ statement coverage
- Added extensive tests for shadow rendering, hit testing, and properties forms

---

## Version 1.5.4 (January 11, 2026)

### Added
- **Marker Tool** — New annotation tool for numbered/lettered sequence markers
  - Styles: Circled numbers (①②③), Letters (A B C), Parentheses ((1)(2)(3)), Plain (1. 2. 3.), Circled letters (Ⓐ Ⓑ Ⓒ)
  - Optional arrow/leader lines pointing to target locations
  - Auto-numbering for sequential markers
  - Full shadow support with all shadow controls
  - Keyboard shortcut: M

- **Dimension Tool** — Technical measurement annotation tool
  - End styles: Arrow, Tick, Dot, None
  - Text positions: Above, Below, Center
  - Orientation: Free, Horizontal, Vertical
  - Tolerance display: Symmetric (±), Deviation (+/-), Limits (min-max), Basic
  - Configurable units, scale, and precision
  - Extension lines with adjustable length
  - Keyboard shortcut: D

### Fixed
- **Marker Shadow Controls** — Shadow offset, spread, and blur now properly affect marker layers
  - MarkerRenderer now integrates with ShadowRenderer for consistent shadow rendering

### Changed
- **CanvasManager.js Refactored** — Reduced from 2,072 to 1,927 lines (now under 2K limit)
  - Removed deprecated fallback code and dead branches

### Tests
- **Test Count** — 8,603 tests passing (144 suites)
- **Coverage** — 94.53% statement, 83.16% branch

---

## Version 1.5.3 (January 9, 2026)

### Added
- **Shape Library with 374 Shapes** — Comprehensive built-in shape library with searchable categories
  - 10 categories: Arrows, Basic Shapes, Callouts, Flowchart, ISO 7010 Mandatory, ISO 7010 Prohibition, ISO 7010 Warning, Math, Miscellaneous, Stars & Banners
  - Professional ISO 7010 safety symbols (warning, prohibition, mandatory signs)
  - All shapes render as crisp SVG vectors that scale without quality loss
  - Search by name or browse by category
  - **More shapes to come soon!**

### Fixed
- **Shape Rendering Performance** — Fixed critical performance issue with custom shape rendering
  - Added pending load tracking to prevent duplicate image loads during drag/resize
  - Eliminated cascade of async loads that caused canvas white screen crashes
  - Shape images now cache efficiently with compact cache keys
  - Smooth dragging and resizing for all custom shapes

### Changed
- **Aspect Ratio for Images/Shapes** — Images and custom shapes now maintain aspect ratio by default
  - Hold Shift to allow free-form resizing (inverted from standard shapes)
  - Matches expected behavior for imported images and library shapes

---

## Version 1.5.2 (January 7, 2026)

### Tests
- **Improved Coverage** — Added 114 new tests targeting low-coverage modules
  - Test Count: 8,677 tests passing (146 suites), up from 8,563
  - Statement Coverage: 94.55%, up from 94.05%
  - Branch Coverage: 83.19%, up from 82.62%
  - Files enhanced: LayersEditor, APIManager, GroupManager, ShapeLibraryManager, LayerRenderer, Toolbar, CanvasManager
  - Coverage improvements focused on fallback branches, error handling, and edge cases

### Changed
- **Documentation Updates** — Updated all documentation files with latest metrics
  - Updated version numbers across 12 mandatory files
  - Synchronized test counts and coverage metrics in 6 documentation files
  - Prepared for point release with comprehensive documentation review

---

## Version 1.5.1 (January 7, 2026)

### Fixed
- **Double-Headed Curved Arrow Rendering** — Fixed crossover artifact in double-headed curved arrows
  - Curved shaft path now correctly connects top-to-top and bottom-to-bottom between heads
  - Fixed vertex order issue caused by inverted perpendicular direction on backward-facing tail head
  - All three head types (pointed, chevron, standard) work correctly
- **Tail Width Control Visibility** — Tail Width control now properly hides when Arrow Ends is set to "Double"
  - Previously the control remained visible even though it had no effect
  - Properties panel now refreshes when arrow style changes

### Tests
- 8,563 tests passing (146 suites)
- 94.6% statement coverage, 83.3% branch coverage

---

## Version 1.5.0 (January 7, 2026)

### Added
- **Layer Set List on File Pages** — File: pages now show available layer annotations
  - Collapsible "Layer Annotations" section appears below file info
  - Shows all named sets with author, revision count, and last modified date
  - "Edit" link opens the editor for each set directly
  - Usage hint displays wikitext syntax for embedding layers
  - Full dark mode support for Vector 2022
  - Implements Yaron's feedback request #4

### Refactored
- **ImageLayerRenderer Extraction** — Extracted image layer rendering from LayerRenderer.js
  - New `ImageLayerRenderer.js` (~280 lines) with LRU caching
  - Reduced LayerRenderer.js from 998 to 867 lines

### Changed
- **Simplified Permissions** — Consolidated `createlayers` into `editlayers`
  - Users with `editlayers` can now create and edit layer sets
  - `managelayerlibrary` retained for future asset library feature

### Fixed
- **Layer Lock Now Works** — Fixed layer locking feature that was completely broken
  - Locked layers can no longer be dragged, resized, rotated, or deleted
  - Folder locking now affects all child layers

### Tests
- 8,551 tests passing (146 suites)
- 94.6% statement coverage, 83.3% branch coverage

---

## Version 1.5.0-beta.3 (January 6, 2026)

### Changed
- **"Edit Layers" → "Edit layers"** — Changed to sentence case per MediaWiki UI conventions
  - Thank you to Yaron Koran for the feedback
- **Wikitext Parameter Renamed** — `layerset=` is now the primary parameter for displaying layers in wikitext
  - `layerset=on` is now the preferred syntax (e.g., `[[File:Example.jpg|layerset=on]]`)
  - `layers=` and `layer=` remain fully supported for backwards compatibility
  - All existing wikitext using `layers=` will continue to work unchanged
  - Thank you to Yaron Koran for suggesting this improvement
- **Simplified Permissions** — Consolidated `createlayers` into `editlayers`
  - Users with `editlayers` can now create and edit layer sets
  - Simpler permission model per community feedback

### Fixed
- **Layer Lock Now Works** — Fixed layer locking feature that was completely broken
  - Locked layers can no longer be dragged, resized, or rotated
  - Locked layers can no longer be deleted
  - Folder locking now affects all child layers — if a folder is locked, all layers inside are effectively locked
- **New Layer Set Starts Blank** — Creating a new named layer set now starts with an empty canvas
  - Previously, new sets would retain layers from the previous set
  - Clearer UX: new sets are truly new, not copies

### Removed
- **Cancel Button** — Removed redundant Cancel button from toolbar
  - The X close button already provides this functionality
  - Simplifies the interface per community feedback
- **Redundant Shapes from Custom Shape Tool** — Removed 4 shapes that duplicate existing dedicated tools:
  - `geometric/pentagon`, `geometric/hexagon`, `geometric/octagon` — Use the Polygon tool instead
  - `symbols/star` — Use the dedicated Star tool instead

### Improved
- **Drag Performance** — Fixed canvas sluggishness when dragging layers
  - Moved `emitTransforming()` inside `requestAnimationFrame` callback
  - Eliminates redundant UI updates during rapid mouse movements

---

## Version 1.4.8 (January 5, 2026)

### Fixed
- **ContextMenuController Memory Leak** — Fixed memory leak where document event listeners were not removed when context menu was closed
  - Event handlers (`closeHandler`, `escHandler`) now stored as instance properties and properly cleaned up
  - Added cleanup in `closeLayerContextMenu()` method
  - 3 new tests added to verify memory leak prevention

### Improved
- **Magic Number Constants** — Consolidated mathematical constants into single source of truth
  - Added `MathUtils.MATH` namespace with `SCALE_EPSILON` (0.0001) and `INTEGER_EPSILON` (1e-9)
  - Removed duplicate constant definitions from `ShapeRenderer.js`, `PropertiesForm.js`, `LayerPanel.js`
  - `LayersConstants.MATH` now references `MathUtils.MATH` for backward compatibility
  - Updated `types/layers.d.ts` with Constants namespace definitions
- **Test Count** — 8,304 tests passing

---

## Version 1.4.7 (January 5, 2026)

### Fixed
- **Template Images Not Displaying on File Pages** — Removed overly restrictive Content Security Policy from file description pages
  - The CSP was blocking template images from Commons (e.g., `File:Ambox important.svg` used in Information/Imbox templates)
  - CSP is now only applied in the editor action (`?action=editlayers`) where it's properly scoped

---

## Version 1.4.6 (January 5, 2026)

### Added
- **TIFF Image Support** — Full support for TIFF format images in the editor and viewer
  - TIFF files are now correctly identified and loaded using MediaWiki thumbnail URLs
  - `ImageLoader.js` detects non-web formats (TIFF, BMP, etc.) and automatically uses `Special:Redirect/file`
- **SHA1 Fallback Lookup** — Added `findSetSha1()` method in `LayersDatabase.php` to find layer sets saved before InstantCommons support

### Fixed
- **Foreign File Delete/Rename Failing** — Fixed validation to not require local wiki page existence for foreign files
- **Delete Confirmation Dialog Button Label** — Added missing `layers-delete` i18n key
- **CanvasRenderer TIFF Support** — Enhanced `getImageFormat()` to detect TIFF files

---

## Version 1.4.5 (January 5, 2026)

### Added
- **InstantCommons/Foreign File Support** — Full support for files from Wikimedia Commons and other foreign repositories (GitHub issue #34)
  - Foreign files (ForeignAPIFile, ForeignDBFile) are now detected and handled correctly
  - Added `isForeignFile()` detection method across all 11 PHP files that access layer data
  - Added `getFileSha1()` helper that generates stable fallback identifiers
  - Editor now uses `Special:Redirect/file` URLs to load foreign images
- **Dynamic CSP for Foreign Files** — CSP dynamically includes foreign file origins when editing

### Fixed
- **Foreign file layerslink URL generation** — Correctly generates local File: page URLs with `action=editlayers`
- **Special:Redirect/file URL generation** — Fixed to use `$file->getName()` instead of prefixed key
- **Filename normalization in wikitext parsing** — Normalized filenames (spaces to underscores) for consistent lookups
- **MediaWiki 1.44 Title class namespace** — Fixed `ThumbnailProcessor.php` for MW 1.44+ compatibility

---

## Version 1.4.4 (January 4, 2026)

### Fixed
- **FR-10 Live Preview: Duplicate layer rendering after save** — Fixed by properly removing canvas in `LayersViewer.destroy()`
- **FR-10 Live Preview: Base image not visible after save** — Fixed by storing/restoring original image styles
- **FR-10 Live Preview: Stale layer data after save** — Fixed by clearing sessionStorage cache in `APIManager.handleSaveSuccess()`
- **Cache invalidation timing** — Changed server-side cache invalidation from deferred to synchronous

---

## Version 1.4.3 (January 3, 2026)

### Added
- **Draggable Callout Tail** — Callout tail can now be positioned by dragging the tip directly on the canvas
  - Tail tip position stored in local coordinates for proper rotation support
  - Tail can attach to any edge (top, bottom, left, right) or corner arc
  - Purple handle appears when callout is selected for easy tail repositioning
- **Tail Styles** — Three tail style options for callouts
  - Triangle: Classic speech bubble pointer (default)
  - Curved: Smooth quadratic Bézier curves for organic look
  - Line: Simple single-line pointer
  - Styles work correctly on both straight edges and rounded corners

### Fixed
- **Corner Arc Tail Rendering** — Tail now renders correctly when positioned on rounded corners
  - Proper angle normalization ensures symmetric behavior at all four corners
  - Arc splitting algorithm correctly handles all tail positions along corner radii
- **Tail Style on Corners** — Line and curved tail styles now render correctly when tail is on a corner arc

---

## Version 1.4.2 (January 2, 2026)

### Added
- **Callout/Speech Bubble Tool** — New annotation layer type for creating chat bubbles and callouts
  - Rounded rectangle container with configurable corner radius
  - Triangular tail/pointer with 8 direction options
  - Configurable tail position and size
  - Full text support with alignment, font, and color controls
  - Keyboard shortcut: `B`
- **Vector 2022 Dark Mode** — Full support for Vector 2022 skin's night mode
- **Windows High Contrast Mode** — WCAG 1.4.11 compliance for forced-colors mode
- **Color Picker Hex Input** — Keyboard-accessible hex color input field
- **Toolbar Dropdown Grouping** — Text, shapes, and lines grouped into dropdown menus

### Fixed
- **Text with apostrophes showing HTML entities** — Text containing apostrophes (e.g., "I'M HERE") no longer displays as `I&apos;M HERE` after saving and reopening
- **Wrong layer set displayed after `layerslink=editor`** — When opening the editor via a link for a specific layer set, then editing a different set, the article now correctly displays the original set

### Removed
- **Blur Tool** — The standalone blur tool has been removed as redundant
  - Use any shape with `fill: 'blur'` for the same effect with more flexibility
  - Blur fill supports strokes, rounded corners, shadows, and rotation

---

## Version 1.4.0 (December 31, 2025)

### Added
- **Live Color Picker Preview (FR-9)** — Canvas updates in real-time as colors are selected
- **Live Article Preview (FR-10)** — Layer changes visible immediately after saving, without page reload
- **Curved Arrows (FR-4)** — Arrows now support curved paths via draggable control point

### Fixed
- **Curved arrow scaling bug** — Control points now properly scaled when viewing on resized images
- **Curved arrow blur fill** — Blur effect now works correctly on curved arrows
- **PHP line endings** — Fixed CRLF line endings in 14 PHP files

### Improved
- **Accessibility: Reduced Motion Support** — Respects `prefers-reduced-motion` preference
- **Test coverage** — 7,923 tests (136 suites), 94.3% statement coverage
- **TypeScript definitions** — Updated to v1.4.0 with full curved arrow support

---

## Version 1.3.2 (December 31, 2025)

### Added
- **Release Guide** — New `docs/RELEASE_GUIDE.md` with comprehensive checklist to prevent missed documentation updates

### Documentation
- Updated all documentation for release consistency
- Wiki documentation synchronized with main repo

---

## Version 1.3.1 (December 31, 2025)

### Fixed
- **ToolRegistry textbox tool registration** — Added missing textbox tool for consistency with Toolbar
- **PHP code quality** — Fixed ALL PHP warnings (45 → 0)

### Added
- **localStorage color validation** — ColorPickerDialog validates saved colors from localStorage
- **Folder tip i18n message** — Added `layers-folder-empty-tip` for localized folder help text

### Changed
- **PropertiesForm debounce** — Number inputs use 100ms debounce to reduce render thrashing
- **Test count** — 7,711 tests (135 suites, all passing)

---

## Version 1.3.0 (December 31, 2025)

### Added
- **REL1_43 branch** — New LTS branch for MediaWiki 1.43.x with full feature parity
- **Deep linking documentation** — Added `layerslink` parameter guide to extension page
- **Branch selection guide** — Clear guidance for choosing the right branch per MW version

### Changed
- **Extension page updated** — Now shows MW 1.39+ support with branch selection table
- **LTS strategy updated** — REL1_39 now covers MW 1.39-1.42 only (community maintained)

### Documentation
- Added `$wgEditPageFrameOptions` requirement for `layerslink=editor-modal`
- Configuration-Reference.md — New "MediaWiki Core Settings" section
- All wiki docs updated with new branch structure

---

## Version 1.2.18 (December 30, 2025)

### Added
- **17 new GroupManager edge case tests** — Coverage improved from 84.9% → 89.1% statement, 69.3% → 75.1% branch

### Changed
- **Test count increased** — 7,671 → 7,688 tests (all passing)
- **Rating improved** — 8.75/10 → 9/10 (architecture diagrams recognized as complete)

### Documentation
- **P2.2 Architecture Diagram marked complete** — ARCHITECTURE.md already contains 9 comprehensive Mermaid diagrams
- All documentation updated with accurate metrics

---

## Version 1.2.17 (December 30, 2025)

### Added
- **`omitProperty` utility function** — New utility in DeepClone.js for clean property removal without eslint-disable comments
- **Documentation index** — New `docs/README.md` with categorized navigation

### Changed
- **eslint-disable comments reduced** — 17 → 13 (below <15 target)
- **Test count increased** — 7,663 → 7,671 tests (all passing)
- **Rating improved** — 8.5/10 → 8.75/10

---

## Version 1.2.16 (December 30, 2025)

### Added
- **GitHub Issue Templates** — Structured bug report and feature request forms with component selection, version fields, and contribution interest options
- **Pull Request Template** — Comprehensive PR checklist enforcing code quality standards, testing requirements, and documentation updates
- **Wiki Auto-Sync Workflow** — GitHub Action automatically syncs wiki/ directory to GitHub Wiki on releases and wiki file changes
- **Full Code of Conduct** — Replaced minimal placeholder with complete Contributor Covenant v2.1

### Changed
- README badges updated with accurate coverage (94.3%) and formatted test count
- CONTRIBUTING.md updated with current test count (7,658)

### Infrastructure
- `.github/ISSUE_TEMPLATE/` — Bug report and feature request forms
- `.github/PULL_REQUEST_TEMPLATE.md` — PR quality checklist
- `.github/workflows/wiki-sync.yml` — Automatic wiki synchronization

---

## Version 1.2.15 (December 30, 2025)

### Fixed
- **Background layer label showing raw message key** — The background layer item in the layer panel was displaying `⧼layers-background-layer⧽` instead of "Background Image" because the i18n message was not included in the ResourceLoader module.

### Removed
- **9 deprecated/non-existent MediaWiki hooks removed** — Cleaned up extension.json and hook handlers:
  - 7 non-existent hooks: `FileLink`, `GetLinkParamDefinitions`, `GetLinkParamTypes`, `ParserGetImageLinkParams`, `ParserGetImageLinkOptions`, `MakeImageLink2`, `LinkerMakeImageLink`
  - 2 deprecated hooks: `SkinTemplateNavigation` (removed MW 1.41), `UnknownAction` (removed MW 1.32)
  - ~130 lines of dead code removed from UIHooks.php
- **Debug console.log statements removed** — Cleaned up folder/grouping debug logging

### Changed
- **Mediawiki-Extension-Layers.txt** — Updated hook list to 12 valid, documented hooks

### Testing
- All tests continue to pass

---

## Version 1.2.14 (December 30, 2025)

### Features
- **Layer Folder UI Improvements** — Complete folder/group visual enhancements:
  - Folders display with distinctive styling (orange border, gradient background, folder icon)
  - Child layers appear indented under parent folders with color-coded backgrounds
  - Expand/collapse toggles now functional — click the triangle to collapse/expand
  - Folder visibility toggle cascades to all child layers
  - "Add Folder" button moved to left of title for better layout

### Added
- **Folder Delete Dialog** — When deleting a folder containing layers, choose between:
  - "Delete folder only (keep layers)" — Unparents children
  - "Delete folder and all layers inside" — Recursively deletes all
- **Batch Undo for Folder Operations** — Folder deletes are single undo steps

### Fixed
- Folder expand toggle not responding to clicks
- Folder visibility toggle had no effect on children
- Deleted folder left children indented
- Multiple undo clicks needed for folder delete

### Testing
- **7,506 tests passing** (+23 from v1.2.13)
- **133 test suites**

---

## Version 1.2.13 (December 29, 2025)

### Features
- **Layer Grouping (Complete)** — Group multiple layers for bulk operations:
  - Keyboard shortcuts: Ctrl+G to group, Ctrl+Shift+G to ungroup
  - Selection integration: Selecting a group selects all children
  - Max nesting depth: 3 levels, max children per group: 100

### Added
- GroupManager.js (~600 lines) — Full grouping API
- Folder icons and expand toggles in Layer Panel
- PHP validation for 'group' layer type

### Testing
- **7,483 tests passing**
- **132 test suites**

---

## Version 1.2.12 (December 29, 2025)

### Changed
- **Context-Aware Toolbar behavior refined** — Style controls hidden when layer selected (Properties panel provides same controls)

### Testing
- **7,382 tests passing**

---

## Version 1.2.11 (December 29, 2025)

### Bug Fixes
- **Fixed blend modes not rendering on article pages** — Layer blend modes (exclusion, multiply, screen, etc.) were not being applied when viewing images on article pages. The viewer now properly draws the background image onto the canvas when blend modes are used.
- **Fixed blend mode property normalization** — The server stores blend mode as `blendMode` but client code was reading `blend`. Added property alias normalization for consistency.
- **Removed redundant 'blur' from blend mode dropdown** — The 'blur' option was redundant with blur fill feature (v1.2.6+).

### Testing
- **7,377 tests passing** (+80 from v1.2.10)
- **131 test suites**

---

## Version 1.2.10 (December 28, 2025)

### Features
- **Context-Aware Toolbar** — Toolbar shows only relevant controls based on the active tool or selected layers

### Bug Fixes
- **Fixed MediaWiki 1.39-1.43 LTS compatibility** — Fixed TypeError in hook where `$linkAttribs` could be `false`

### Configuration
- Added `$wgLayersContextAwareToolbar` — Enable/disable context-aware toolbar (default: true)

### Testing
- **7,297 tests passing** (+20 new tests)

---

## Version 1.2.9 (December 28, 2025)

### Testing
- **7,270 tests passing** (+23 from v1.2.8)
- **130 test suites** (up from 128)
- **94.45% statement coverage**, 82.88% branch, 91.98% function, 94.73% line
- **PropertiesForm.js coverage improved** (68% → 72% function coverage)
- **ImageLoader.js: First dedicated test file** — 47 tests
- **LayerItemFactory.js: First dedicated test file** — 51 tests

### Documentation
- Updated all documentation with accurate metrics
- Full release preparation with wiki sync

---

## Version 1.2.8 (December 27, 2025)

### Bug Fixes
- **Fixed arrow rendering with blur blend mode** — Arrows with blur blend mode no longer display rectangular bounding boxes in the editor
- **Fixed arrow fill property** — Arrows are now properly filled instead of just stroked

### Testing
- **7,247 tests passing** (+491 from v1.2.7)

---

## Version 1.2.7 (December 26, 2025)

### New Feature - Blur Fill for Arrows

Extended blur fill support to **arrow shapes**. Arrows can now use the "frosted glass" blur effect.

### Bug Fixes
- **Fixed validation error blocking save** — Layer sets with blur-filled arrows could not be saved due to incorrect blend mode validation

### UI Improvements
- **Compact layer panel** — Redesigned with smaller layer items (28px vs 36px), smaller buttons, and better space allocation for the properties panel

### Testing
- **6,756 tests passing** (+105 from v1.2.6)

---

## Version 1.2.6 (December 25, 2025)

### New Feature - Blur Fill for Shapes

Added **blur fill mode** for all filled shapes — a "frosted glass" effect that blurs the content beneath the shape instead of using a solid color fill.

**Supported Shapes:**
- Rectangle
- Circle / Ellipse
- Polygon / Star
- Text Box

**How to Use:**
1. Select a shape layer
2. In the Properties panel, set **Fill** to `blur`
3. Optionally adjust **Blur Radius** (default: 12px, range: 1-64px)
4. Adjust **Fill Opacity** to control the effect intensity

**Technical Details:**
- Works with rotation — blur correctly follows rotated shapes
- Works in both editor and article view
- Captures all content beneath (background image + other layers)

### Bug Fixes
- **Fixed blur fill with rotated shapes** — Blur now correctly captures and clips content for shapes with any rotation angle

### Testing
- **6,651 tests passing** (+5 from v1.2.5)

---

## Version 1.2.5 (December 24, 2025)

### Improved Editor Navigation

**Breaking Change (UX Improvement):** When using `layerslink=editor` from an article page, closing the editor now returns you to the article page instead of the File: page.

### New Features - Advanced Editor Link Modes

- `layerslink=editor-newtab` — Opens editor in a new tab
- `layerslink=editor-modal` — Opens editor in an iframe overlay (perfect for Page Forms)

---

## Version 1.2.4 (December 23, 2025)

### Code Quality - Major Testing & Documentation Update

- **DialogManager.js** — Coverage increased to 96.14%
- **PropertiesForm.js** — Coverage increased to 68.22%
- **6,623 tests passing**

---

## Version 1.2.3 (December 23, 2025)

### Bug Fixes
- **Fixed text box rendering when image is scaled down** — Text boxes with vertical centering (middle alignment) now display correctly when images are resized in article view. Previously, the top line of text would be cut off because the `padding` property was not being scaled along with other dimensions.

### Code Quality
- **UIManager refactored** — Extracted `SetSelectorController.js` (~567 lines) from `UIManager.js`, reducing it from 1,029 to 681 lines

### Testing
- **6,549 tests passing** (+70 from v1.2.2)

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
