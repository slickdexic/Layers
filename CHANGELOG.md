# Changelog

All notable changes to the Layers MediaWiki Extension will be documented in this file.

## [1.2.17] - 2025-12-30

### Added
- **`omitProperty` utility function** — New utility in DeepClone.js for clean property removal without eslint-disable comments
- **Documentation index** — New `docs/README.md` with categorized navigation for all documentation files
- **8 new unit tests** — Comprehensive test coverage for omitProperty utility

### Changed
- **eslint-disable comments reduced** — 17 → 13 (below <15 target), refactored GroupManager.js to use omitProperty utility
- **Test count increased** — 7,663 → 7,671 tests (all passing)
- **Documentation reorganized** — 4 completed feature docs moved to archive (Layer Groups, Auto-Create, Context-Aware Toolbar, Named Sets Implementation)
- **Rating improved** — 8.5/10 → 8.75/10 (earned +0.1 for reaching eslint-disable target)

### Documentation
- All documentation files updated with accurate metrics (test counts, eslint-disable counts)
- docs/ARCHITECTURE.md updated to v1.2.16 with current statistics
- copilot-instructions.md updated with DeepClone.omitProperty documentation
- Active docs reduced from 24 to 20 (cleaner navigation)

### Quality
- All linting passes (ESLint, Stylelint, Banana)
- 94.4% statement coverage maintained
- Zero TODO/FIXME comments in codebase
- Zero console.log statements in production code

---

## [1.2.16] - 2025-12-30

### Added
- **GitHub Issue Templates** — Structured bug report and feature request forms with component selection, version fields, and contribution interest options
- **Pull Request Template** — Comprehensive PR checklist enforcing code quality standards, testing requirements, and documentation updates
- **Wiki Auto-Sync Workflow** — GitHub Action automatically syncs wiki/ directory to GitHub Wiki on releases and wiki file changes
- **Full Code of Conduct** — Replaced minimal placeholder with complete Contributor Covenant v2.1

### Changed
- **README badges updated** — Coverage badge corrected to 94.3% (accurate rounding), test count formatted with comma separator
- **CONTRIBUTING.md updated** — Test count updated from 7,270 to 7,658

### Documentation
- All wiki pages now auto-sync to GitHub Wiki via workflow
- Issue templates guide contributors with structured forms
- PR template ensures consistent quality across contributions

### Infrastructure
- `.github/ISSUE_TEMPLATE/bug_report.yml` — Bug report form with component, version, browser fields
- `.github/ISSUE_TEMPLATE/feature_request.yml` — Feature request form with priority and contribution options
- `.github/ISSUE_TEMPLATE/config.yml` — Links to wiki, discussions, and existing issues
- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist for code quality
- `.github/workflows/wiki-sync.yml` — Automatic wiki synchronization

---

## [1.2.15] - 2025-12-30

### Fixed
- **Background layer label showing raw message key** — The background layer item in the layer panel was displaying `⧼layers-background-layer⧽` instead of "Background Image" because the i18n message was not included in the ResourceLoader module's messages array.

### Removed
- **9 deprecated/non-existent MediaWiki hooks removed** — Cleaned up extension.json and hook handlers:
  - 7 non-existent hooks: `FileLink`, `GetLinkParamDefinitions`, `GetLinkParamTypes`, `ParserGetImageLinkParams`, `ParserGetImageLinkOptions`, `MakeImageLink2`, `LinkerMakeImageLink`
  - 2 deprecated hooks: `SkinTemplateNavigation` (removed MW 1.41), `UnknownAction` (removed MW 1.32)
  - ~130 lines of dead code removed from UIHooks.php
- **Debug console.log statements removed** — Cleaned up folder/grouping debug logging from LayerDragDrop.js and LayerPanel.js

### Changed
- **Mediawiki-Extension-Layers.txt** — Updated hook list to 12 valid, documented hooks
- **docs/guide.md** — Updated to reference EditLayersAction instead of deprecated UnknownAction hook

### Testing
- All existing tests continue to pass
- PHP linting passes with no syntax errors

---

## [1.2.14] - 2025-12-30

### Features
- **Layer Folder UI Improvements** — Complete folder/group visual enhancements:
  - Folders now display with distinctive styling (orange border, gradient background, folder icon)
  - Child layers appear indented under parent folders with color-coded backgrounds
  - Expand/collapse toggles now functional — click the triangle to collapse/expand folders
  - Folder visibility toggle cascades to all child layers
  - "Add Folder" button moved to left of title for better layout
  - Reduced header padding for more compact layer panel

### Added
- **Folder Delete Dialog** — When deleting a folder containing layers, users now choose between:
  - "Delete folder only (keep layers)" — Unparents children, making them top-level layers
  - "Delete folder and all layers inside" — Recursively deletes folder and all contents
- **Batch Undo for Folder Operations** — Folder deletes are now single undo steps using HistoryManager batch mode
- **i18n messages** — `layers-delete-folder-title`, `layers-delete-folder-message`, `layers-delete-folder-keep-children`, `layers-delete-folder-delete-all`
- **LayerListRenderer `onToggleGroupExpand` callback** — Enables folder expand/collapse from rendered layer items
- **CSS for `.layers-btn-icon`** — Compact icon-only buttons in layer panel header

### Fixed
- **Folder expand toggle not responding to clicks** — Added missing click event handler in LayerListRenderer
- **Folder visibility toggle had no effect** — `toggleLayerVisibility()` now cascades visibility to all child layers
- **Deleted folder left children indented** — Children are properly unparented or deleted based on user choice
- **Multiple undo clicks needed for folder delete** — Now uses batch mode for single-step undo

### Testing
- **7,506 tests passing** (+23 from v1.2.13)
- **133 test suites**
- Updated LayerPanelConfirmations.test.js with `getLayerById` mock

---

## [1.2.13] - 2025-12-29

### Features
- **Layer Grouping (Complete)** — Group multiple layers for bulk operations:
  - **GroupManager.js** (~600 lines) — Full grouping API with `createGroup()`, `ungroup()`, `addToGroup()`, `removeFromGroup()`, `toggleExpanded()`, `getGroupChildren()`, `groupSelected()`, `ungroupSelected()`, `renameGroup()`, `deleteGroup()`, `getGroupBounds()`
  - **Keyboard shortcuts** — **Ctrl+G** to group selected layers, **Ctrl+Shift+G** to ungroup
  - **Selection integration** — Selecting a group automatically selects all children; deselecting a group deselects all children
  - **Server-side validation** — 'group' type with `children` (array), `expanded` (boolean), `parentGroup` (string) properties
  - **Layer Panel UI** — Groups display with folder icons, expand/collapse toggles (▼/▶), and child layer indentation (20px per level)
  - Max nesting depth: 3 levels, max children per group: 100

### Added
- **IconFactory.createFolderIcon()** — Golden folder icon for group layers (expanded/collapsed states)
- **IconFactory.createExpandIcon()** — Triangle toggle icon for expand/collapse
- **LayerItemFactory group support** — Groups render with folder icon, expand toggle, and CSS classes
- **SelectionManager group support** — `_getGroupBounds()`, `isChildOfSelectedGroup()`, `_getGroupDescendantIds()` helpers
- **ToolbarKeyboard group shortcuts** — `groupSelected()`, `ungroupSelected()` methods
- **CSS for group layers** — `.layer-item-group`, `.layer-item-child`, `.layer-expand-toggle` styles
- **i18n messages** — `layers-type-group`, `layers-expand-group`, `layers-collapse-group`
- **PHP validation tests** — 6 new tests for 'group' layer type validation

### Testing
- **7,483 tests passing** (+101 from v1.2.12)
- **132 test suites**
- 48 new tests for GroupManager
- 20 new tests for SelectionManager group handling
- 16 new tests for LayerItemFactory group support
- 10 new tests for IconFactory folder/expand icons
- 7 new tests for ToolbarKeyboard group shortcuts

---

## [1.2.12] - 2025-12-29

### Changed
- **Context-Aware Toolbar behavior refined** — Toolbar style controls (stroke, fill, presets) are now **hidden** when an existing layer is selected, since the Properties panel in the Layer Manager provides all the same controls. This eliminates redundancy and focuses users on the appropriate UI. Style controls only appear when a drawing tool is active for creating new layers.

### Documentation
- **Enhanced Architecture diagrams** — Added three new Mermaid diagrams to ARCHITECTURE.md:
  - **Rendering Pipeline** — Shows how render triggers flow through RenderCoordinator to LayerRenderer dispatch
  - **Layer State Machine** — Documents states (Idle, Selected, Drawing, Editing, etc.) and transitions
  - **Data Flow Overview** — Shows client-server data flow between StateManager, APIManager, and PHP endpoints

### Testing
- **7,382 tests passing** (+5 new tests)
- Added 6 new tests for `hideAll()` and `updateForSelectedTypes()` in TextEffectsControls
- Updated context-aware toolbar tests to reflect new behavior (hide on layer selection)

---

## [1.2.11] - 2025-12-29

### Bug Fixes
- **Fixed blend modes not rendering on article pages** — Layer blend modes (exclusion, multiply, screen, etc.) were not being applied when viewing images on article pages. The viewer used a transparent canvas overlay on top of the DOM image element, but canvas `globalCompositeOperation` only blends with content already on the canvas, not DOM elements. The viewer now detects when any layer uses a non-default blend mode and draws the background image onto the canvas first, enabling proper blend mode rendering.
- **Fixed blend mode property normalization** — The server stores blend mode as `blendMode` but client code was reading `blend`. Added property alias normalization to ensure both property names work correctly in both editor and viewer.
- **Removed redundant 'blur' from blend mode dropdown** — The 'blur' option in the blend mode dropdown was redundant with the blur fill feature (introduced in v1.2.6) and caused confusion. Blur effects should be applied via Fill → blur, not blend mode.

### Technical
- Added `normalizeAliases()` method to `LayerDataNormalizer.js` for consistent blend/blendMode handling
- Updated `LayersViewer.js` with `drawBackgroundOnCanvas()` method for blend mode support
- Updated `fallbackNormalize()` in viewer to include blend mode alias handling
- Added blend alias normalization tests to LayerDataNormalizer.test.js

### Testing
- **7,377 tests passing** (+80 from v1.2.10)
- **131 test suites**
- Added 5 new tests for blend mode alias normalization

---

## [1.2.10] - 2025-12-28

### Features
- **Context-Aware Toolbar** — Toolbar now shows only relevant controls based on the active tool or selected layers. When using the pointer tool with nothing selected, only tool buttons are visible. Drawing tools reveal stroke/fill controls, text tools show font controls, etc. Smooth CSS transitions (0.2s) animate control visibility changes. Configurable via `$wgLayersContextAwareToolbar` (default: true, set to false for classic mode).

### Bug Fixes
- **Fixed MediaWiki 1.39-1.43 LTS compatibility** — Fixed TypeError in `onThumbnailBeforeProduceHTML` hook where `$linkAttribs` parameter could be `false` (boolean) instead of an array when images have no link. The hook now accepts both types for backward compatibility with LTS versions.

### Configuration
- Added `$wgLayersContextAwareToolbar` — Enable/disable context-aware toolbar (default: true)

### Testing
- **7,297 tests passing** (+20 new tests)
- Added 20 new tests for context-aware toolbar functionality covering `updateContextVisibility`, `setContextAwareEnabled`, `isContextAwareEnabled`, `updateContextForSelectedLayers`, and `showAllControls`

---

## [1.2.9] - 2025-12-28

### Features
- **Auto-create layer set on editor link** — When a user clicks a `layerslink=editor` link to a non-existent layer set (e.g., `[[File:Example.jpg|layers=anatomy|layerslink=editor]]`), the set is automatically created if the user has `createlayers` permission. Shows a notification informing the user the set was created. This enables pre-planned article templates with layer set placeholders.

### Testing
- **7,277 tests passing** (+7 from previous)
- **130 test suites**
- **94.45% statement coverage**, 82.88% branch coverage, 91.98% function coverage, 94.73% line coverage
- **PropertiesForm.js: Improved coverage (68% → 72% function coverage)** — 25 new tests for ColorPickerDialog integration, validation edge cases, blur fill panel refresh, opacity change handling
- **ImageLoader.js: First dedicated test file** — 47 tests organized for background image loading, URL building, same-origin detection, SVG placeholders, abort/destroy cleanup
- **LayerItemFactory.js: First dedicated test file** — 51 tests for layer item DOM creation, updates, icon delegation, keyboard navigation, ARIA accessibility
- **LayersEditor.js: Auto-create tests** — 6 new tests for showAutoCreateNotification, autoCreateLayerSet, and finalizeInitialState

### Documentation
- Updated all documentation with accurate metrics (7,277 tests, 94% coverage)
- Updated improvement_plan.md with test coverage progress and feature requests section
- Updated codebase_review.md with current state
- **ARCHITECTURE.md**: Updated to v1.2.9 with accurate file counts (99 JS files), god class count (8), and controller line counts
- **KNOWN_ISSUES.md**: Fixed ESLint disable count (12), updated CanvasRenderer line count (1,242)
- **FUTURE_IMPROVEMENTS.md**: Added section 8 for auto-create layer set feature
- **New feature request**: Auto-create layer set on editor link ([FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md](docs/FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md))
- **README.md**: Added coverage (94%), test count (7,277), and license badges
- **CONTRIBUTING.md**: Updated god class table with accurate line counts, fixed broken documentation links
- **SECURITY.md**: Enhanced with proper vulnerability reporting section and improved formatting

---

## [1.2.8] - 2025-12-27

### Bug Fixes
- **Fixed rectangle blur fill appearing transparent** — Rectangles with blur fill were appearing completely transparent because rotation transformation modified x/y coordinates to local space before passing to EffectsRenderer.drawBlurFill. Now stores world coordinates (worldX, worldY) BEFORE rotation and passes those to drawBlurFill for correct canvas capture bounds.
- **Fixed arrow rendering with blur blend mode** — Arrows with blur blend mode (set via Blend Mode dropdown) no longer display rectangular bounding boxes in the editor. The issue was that the blur blend mode path used rectangular clip regions instead of the arrow's actual shape. Arrows and lines now render normally and ArrowRenderer handles blur fill correctly via EffectsRenderer.
- **Fixed arrow fill property** — Arrows were being created without a `fill` property, causing ArrowRenderer to only stroke (not fill) the polygon outline. Added explicit `fill: style.color` to ShapeFactory.createArrow() and BuiltInPresets arrow definitions.

### Technical
- Updated ShapeRenderer.drawRectangle() to store world coordinates before rotation transformation
- Updated CanvasRenderer.js to skip arrows/lines from blur blend mode rendering path
- Updated LayerRenderer.js (shared) with same fix for consistency
- Added fill and arrowSize properties to arrow presets in BuiltInPresets.js
- **Replaced console.log with mw.log** — Toolbar.js and LayersEditorModal.js now use MediaWiki's logging system instead of console methods for consistency and proper production logging

### Security
- **Fixed npm security vulnerabilities** — Updated `glob` 10.4.5 → 10.5.0 (high: command injection via CLI) and `js-yaml` 3.14.1 → 3.14.2 (moderate: prototype pollution)

### Testing
- **7,247 tests passing** (+371 since start of v1.2.8 development)
- Added 3 blur fill tests for ShapeRenderer (verifying world coordinate handling with rotation)
- **CanvasManager.js coverage improved: 79.6% → 86.3% statement, 64.8% → 71.9% branch**
- Added 52 new tests for CanvasManager covering: `withLocalAlpha`, `applyLayerEffects`, `notifyToolbarOfSelection`, `selectLayer`, renderer delegation, text input controller delegation, marquee selection, rect intersection
- **ImageLoader.js: First test coverage (0% → 100% statement, 92.8% branch)** — 47 new tests covering URL building, same-origin detection, image loading, SVG placeholder creation, timeout handling, abort, destroy
- **LayersEditor.js coverage improved: 79.2% → 87% statement, 54.5% → 66.9% function** — 29 new tests for stub managers, fallback registry, navigation, cancel dialog
- **LayerItemFactory.js: First test coverage (0% → 98.7% statement, 100% lines)** — 51 new tests for layer item DOM creation, updates, icon delegation, keyboard navigation
- **CanvasEvents.js: Improved coverage (99% → 100% statement)** — 4 new tests for resize error handling and marquee tool
- **LayersLightbox.js: Improved coverage (86.8% → 96.7% statement)** — 4 new tests for image onload handling and viewer initialization
- **PresetManager.js: Improved coverage (82.6% → 93.8% statement, 100% function)** — 21 new tests for fallback behavior without storage/builtInPresets, edge cases
- **ToolbarStyleControls.js: Improved coverage (87.7% → 93.8% statement, 79.1% → 83.7% function)** — 25 new tests for ColorControlFactory integration, PresetStyleManager integration, getClass fallback, addListener fallback, setStrokeColor/setFillColor with colorFactory
- **ColorControlFactory.js: Improved coverage (87.2% → 88.4% statement, 80% → 85% function)** — 5 new tests for click handler and fallback
- **PropertiesForm.js: Improved coverage (86.8% → 89.4% statement, 75.2% → 79% branch)** — 13 new tests for blur fill checkbox and color picker fallback
- **ToolRegistry.js: Improved coverage (89.6% → 97.4% statement, 80% → 95% function)** — 8 new tests for isShapeTool, getCursorMap, clear, reset
- **SelectionManager.js: Improved coverage (87.5% → 91.7% statement, 84.3% → 90% function)** — 11 new tests for accessibility, layer naming, toolbar notification
- **ToolManager.js: Improved coverage (86.5% → 90.6% statement, 74.3% → 76.9% branch)** — 20 new tests for path handler delegation, destroy cleanup, initialization fallbacks, module availability (ToolStyles, ShapeFactory, ToolRegistry, TextToolHandler, PathToolHandler)
- **CanvasRenderer.js: Improved coverage (88.5% → 93.5% statement, 92.5% → 96.2% function)** — 18 new tests for destroy, blur content rendering, _getLayerById
- **LayerSetManager.js: Improved coverage (88.5% → 94% statement, 95.8% → 100% function)** — 13 new tests for getMessageWithParams, createNewLayerSet validation, loadRevisionById, reloadRevisions
- **TextBoxRenderer.js: Improved coverage (88.4% → 93.8% statement)** — 8 new tests for drawTextOnly, shadow with spread
- **ColorControlFactory.js: Improved coverage (88.4% → 91.9% statement)** — 6 new tests for openColorPicker, click handler
- **HistoryManager.js: Improved coverage (87.2% → 100% statement, 97.1% → 100% function)** — 22 new tests for constructor branches, getEditor/getCanvasManager edge cases, endBatch early returns, cancelBatch restoration paths, compressHistory, destroy
- **LayersNamespace.js: Improved coverage (83.6% → 98.4% statement, 70% → 100% function)** — 10 new tests for _createDeprecatedProxy direct invocation, warnDeprecated triggering, shouldWarn branches
- Overall statement coverage: 92.8% → 94.4%
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)

---

## [1.2.7] - 2025-12-26

### New Feature - Blur Fill for Arrows

Extended the blur fill feature (introduced in v1.2.6) to support **arrow shapes**. Arrows can now use the "frosted glass" blur effect just like rectangles, circles, and other shapes.

**How to Use:**
1. Select an arrow layer
2. In the Properties panel, check **Blur Fill**
3. Adjust **Blur Radius** (default: 12px, range: 1-64px)

### Bug Fixes
- **Fixed "Invalid blend mode" validation error blocking save** — Layer sets containing arrows with blur fill could not be saved due to `blur` being incorrectly rejected as an invalid blend mode. Updated both client-side (`LayersValidator.js`) and server-side (`ServerSideLayerValidator.php`) validators to:
  - Include all Canvas 2D `globalCompositeOperation` values (`source-over`, `multiply`, etc.)
  - Add special case handling for `blur` as a fill type indicator (not a blend mode)

### UI Improvements
- **Compact layer panel** — Layer manager redesigned with a more compact look inspired by Figma and Photoshop:
  - Layer item height reduced from 36px to 28px
  - Control buttons reduced from 28px to 22px
  - Padding and gaps reduced throughout
  - Properties panel given flex priority (more space for properties, less for layer list)
  - Default view shows ~6 layers before scrolling

### Testing
- **6,756 tests passing** (+38 from v1.2.6)
- Added blur fill tests for ArrowRenderer
- Added blur fill tests for TextBoxRenderer
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)

---

## [1.2.6] - 2025-12-25

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
- Falls back to gray placeholder if no background available

### Bug Fixes
- **Fixed blur fill with rotated shapes** — Blur now correctly captures and clips content for shapes with any rotation angle. Previously, rotated shapes would show distorted or misaligned blur content.

### Testing
- **6,718 tests passing** (+72 from v1.2.5)
- Added comprehensive blur fill tests for TextBoxRenderer
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)

---

## [1.2.5] - 2025-12-24

### Improved Editor Navigation

**Breaking Change (UX Improvement):** When using `layerslink=editor` from an article page, closing the editor now returns you to the article page instead of the File: page. This is the expected behavior - the editor should return you to where you came from.

### New Features - Advanced Editor Link Modes

Added new `layerslink` values for additional control:

#### `layerslink=editor-newtab`
Opens the editor in a new browser tab, preserving the original page:
```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor-newtab]]
```

#### `layerslink=editor-modal`
Opens the editor in an iframe overlay without any page navigation — perfect for Page Forms:
```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor-modal]]
```

**Modal Mode Features:**
- No page navigation (form data is preserved)
- Escape key closes the modal
- Full ARIA accessibility support
- JavaScript events for integration: `layers-modal-closed`, `layers-saved`

### Technical
- **New module**: `ext.layers.modal` — Modal overlay component with postMessage communication
- **New files**:
  - `resources/ext.layers.modal/LayersEditorModal.js` — Modal class with iframe management
  - `resources/ext.layers.modal/modal.css` — Modal overlay styles
- **Modified files**:
  - `src/Hooks/Processors/LayersParamExtractor.php` — Added `isEditorNewtab()`, `isEditorReturn()`, `isEditorModal()` methods
  - `src/Hooks/Processors/ThumbnailProcessor.php` — ALL editor links now include `returnto` parameter
  - `src/Hooks/Processors/ImageLinkProcessor.php` — ALL editor links now include `returnto` parameter
  - `src/Hooks/WikitextHooks.php` — Accept new layerslink values in validation
  - `src/Action/EditLayersAction.php` — Added `returnto` URL validation, `isModalMode` flag, new JS config vars
  - `resources/ext.layers.editor/LayersEditor.js` — Modified `navigateBackToFileWithName()` for modal/return modes
  - `i18n/en.json`, `i18n/qqq.json` — Added 5 new message keys
  - `extension.json` — Added `ext.layers.modal` ResourceModule
  - `jest.config.js` — Added `ext.layers.modal` to coverage tracking
  - `docs/WIKITEXT_USAGE.md` — Documented new layerslink modes

### Testing
- **6,646 tests passing** (+23 from v1.2.4)
- Added comprehensive Jest tests for `LayersEditorModal`
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)

---

## [1.2.4] - 2025-12-23

### Code Quality - Major Testing & Documentation Update

This release focuses on improving test coverage for critical components and ensuring documentation accuracy.

#### Native Dialog Accessibility ✅
- **PresetDropdown.js** — Replaced `prompt()` and `confirm()` calls with async DialogManager dialogs
- **RevisionManager.js** — Replaced `confirm()` call with async DialogManager dialog
- Both now have proper fallbacks using `eslint-disable-next-line no-alert` comments

#### Test Coverage Improvements
- **DialogManager.js** — Coverage increased from 53% to **96.14%** statement coverage (+35 tests)
- **PropertiesForm.js** — Function coverage increased from 41% to **68.22%** (+39 tests)
- **Total test count** — 6,549 → **6,623** (+74 tests)

#### Memory Leak Prevention
- **CanvasManager.js** — Added `fallbackTimeoutId` tracking for setTimeout cleanup
- **LayersLightbox.js** — Added `closeTimeoutId` tracking for setTimeout cleanup

#### Documentation Accuracy
- **codebase_review.md** — Updated with accurate current metrics (was outdated)
- **KNOWN_ISSUES.md** — Rewrote to reflect all P0 issues now resolved
- Changed overall rating from 7.5/10 to **8.5/10** based on verified improvements

### Technical Details
- **Modified files**:
  - `resources/ext.layers.editor/presets/PresetDropdown.js` — Async DialogManager integration
  - `resources/ext.layers.editor/ui/PresetStyleManager.js` — Pass dialogManager to PresetDropdown
  - `resources/ext.layers.editor/editor/RevisionManager.js` — Async confirm dialog
  - `resources/ext.layers.editor/CanvasManager.js` — Timer ID tracking
  - `resources/ext.layers/viewer/LayersLightbox.js` — Timer ID tracking
  - `tests/jest/DialogManager.test.js` — 35 new tests for Promise-based APIs
  - `tests/jest/PropertiesForm.test.js` — 39 new tests for layer forms
  - `codebase_review.md` — Accurate metrics
  - `docs/KNOWN_ISSUES.md` — All P0 issues marked resolved

---

## [1.2.3] - 2025-12-23

### Bug Fixes
- **Fixed text box rendering when image is scaled down** — Text boxes with vertical centering (middle alignment) now display correctly when images are resized in article view. Previously, the top line of text would be cut off because the `padding` property was not being scaled along with other dimensions.

### Technical
- **Modified files**:
  - `resources/ext.layers/LayersViewer.js` — Added `padding` to `scaleLayerCoordinates()` to scale with the image
  - `tests/jest/LayersViewer.test.js` — Added regression test for padding scaling

### Code Quality
- **UIManager refactored** — Extracted `SetSelectorController.js` (~567 lines) from `UIManager.js`, reducing it from 1,029 to 681 lines. This improves separation of concerns for named layer set management.

### Testing
- **6,549 tests passing** (+70 from v1.2.2)
- **All linting passes** (ESLint, Stylelint, PHP CodeSniffer)

---

## [1.2.2] - 2025-12-23

### Bug Fixes
- **Fixed `layerslink=editor` and `layerslink=viewer` not working** — Deep linking parameters now correctly modify the image link destination. Previously, clicking layered images with these parameters would still navigate to the File: page instead of opening the editor or lightbox viewer. The fix ensures the `ThumbnailBeforeProduceHTML` hook properly modifies the anchor `href` attribute.
- **Fixed editor dropdown showing 'default' on deep link** — When using `layerslink=editor` with a specific layer set (e.g., `layers=anatomy`), the set selector dropdown in the editor now correctly shows the loaded set name instead of always showing 'default'.

### Technical
- **Hook flow discovery**: MediaWiki 1.44 uses `ThumbnailBeforeProduceHTML` for thumbnail rendering instead of `MakeImageLink2`. The `$linkAttribs` parameter must be modified to change anchor destinations.
- **Queue synchronization**: Added `$fileLinkTypes` queue in `WikitextHooks.php` to track `layerslink` values per file occurrence, synchronized with the existing `$fileSetNames` queue.
- **Modified files**:
  - `src/Hooks/WikitextHooks.php` — Added `$fileLinkTypes` queue and `getFileParamsForRender()` method for synchronized parameter retrieval
  - `src/Hooks/Processors/ThumbnailProcessor.php` — Added `applyLayersLink()` method that modifies `$linkAttribs['href']` for deep linking
  - `src/Hooks/Processors/ImageLinkProcessor.php` — Added `$linkTypeFromQueue` parameter support
  - `src/Hooks/Processors/LayersParamExtractor.php` — Enhanced `extractLayersLink()` to check nested parameter locations
  - `resources/ext.layers.editor/APIManager.js` — Fixed ordering: `currentSetName` is now set before `buildSetSelector()` is called
  - `wiki/Wikitext-Syntax.md` — Clarified that `layerslink` must be used with `layers`

### Testing
- **6,479 tests passing** (Jest)
- **All PHP linting and style checks pass**

---

## [1.2.1] - 2025-12-23

### Bug Fixes
- **Fixed corner radius scaling on article pages** — Shape corner radii (`cornerRadius`, `pointRadius`, `valleyRadius`) now scale correctly when images are resized in article view. Previously, stars, polygons, textboxes, and rounded rectangles would display with full-size radii even when the image was scaled smaller, causing visual artifacts.

### Developer Experience
- **Added Docker-based PHP test scripts** — New npm scripts `test:php:docker` and `fix:php:docker` for Windows developers who may have composer conflicts (Python's `composer` package can shadow PHP's Composer). These scripts run PHP linting tools inside the MediaWiki Docker container.

### Testing
- **E2E test improvements** — Fixed race conditions in editor E2E tests, improved login handling, corrected save response detection for MediaWiki API POST requests, and fixed path/pen tool test expectations.

### Technical
- **Modified files**:
  - `resources/ext.layers/LayersViewer.js` — Added scaling for `cornerRadius`, `pointRadius`, `valleyRadius` in `scaleLayerCoordinates()`
  - `resources/ext.layers.shared/PolygonStarRenderer.js` — Added scaling in `drawPolygon()` and `drawStar()` when `scaled: false`
  - `package.json` — Added `test:php:docker` and `fix:php:docker` scripts
  - `tests/e2e/editor.spec.js` — Fixed test stability issues
  - `tests/e2e/fixtures.js` — Fixed save() response detection

---

## [1.2.0] - 2025-12-22

### New Features
- **Deep Linking to Editor** — URL parameters now allow opening the editor with a specific layer set pre-loaded:
  - `?action=editlayers&setname=anatomy` — Opens editor with "anatomy" layer set
  - Also supports `layerset` and `layers` parameter aliases
  - Set name validation: alphanumeric characters, hyphens, and underscores only (max 50 chars)

- **Wikitext Link Options** — New `layerslink` parameter for controlling click behavior on images with layers:
  - `[[File:Example.jpg|layers=setname|layerslink=editor]]` — Opens layer editor for this image
  - `[[File:Example.jpg|layers=setname|layerslink=viewer]]` — Opens fullscreen lightbox viewer
  - `[[File:Example.jpg|layers=setname|layerslink=lightbox]]` — Alias for viewer mode
  - Default behavior (no layerslink): Standard MediaWiki link to File page

- **Fullscreen Lightbox Viewer** — New modal viewer for viewing layered images in full size:
  - Keyboard accessible: Escape key closes the lightbox
  - Click outside image to close
  - Loading states and error handling
  - Proper accessibility attributes (ARIA)

### Technical
- **New files added**:
  - `resources/ext.layers/viewer/LayersLightbox.js` — Lightbox component (~450 lines)
  - `resources/ext.layers/viewer/LayersLightbox.css` — Lightbox styling (~140 lines)
- **Modified files**:
  - `EditLayersAction.php` — URL parameter parsing for setname
  - `WikitextHooks.php` — layerslink parameter registration
  - `LayersParamExtractor.php` — layerslink extraction methods
  - `ImageLinkProcessor.php` — Link modification for deep linking
  - `EditorBootstrap.js` — Pass initialSetName to editor
  - `LayersEditor.js` — Load initial set by name on startup

### Documentation
- Added i18n messages for link titles and lightbox UI

---

## [1.1.12] - 2025-12-22

### Code Quality
- **Memory leak prevention (P2.4)** — Added timeout tracking to `APIManager.js` and `ImageLoader.js` with proper cleanup in `destroy()` methods. Added `_scheduleTimeout()`, `_clearAllTimeouts()`, and `activeTimeouts` tracking.
- **Reduced god classes (P2.2)** — Removed 189 lines of dead `_validateNumericPropertiesFallback` code from `LayersValidator.js`, reducing it from 1,036 to 843 lines (now under 1,000 threshold).
- **Magic numbers extracted (P2.5)** — Added `TIMING` section to `LayersConstants.js` with 9 named delay constants: `IMAGE_LOAD_TIMEOUT`, `BOOTSTRAP_RETRY_DELAY`, `HOOK_LISTENER_DELAY`, `DEPENDENCY_WAIT_DELAY`, `API_RETRY_DELAY`, `DEBOUNCE_DEFAULT`, `NOTIFICATION_DURATION`, `ANIMATION_DURATION`, `SAVE_BUTTON_DISABLE_DELAY`.
- **Updated files to use timing constants** — `ImageLoader.js` and `EditorBootstrap.js` now use `LayersConstants.TIMING` instead of magic numbers.

### Testing
- **6,479 tests passing** (+2 from v1.1.11)
- **92% statement coverage, 80% branch coverage**
- Added 2 new tests for TIMING constants validation

### Documentation
- Updated `FUTURE_IMPROVEMENTS.md` with 2 new feature requests:
  - **Deep Linking to Editor** — URL parameters to open editor with specific file/layer set/layer
  - **Lightbox Viewer** — `link=layers` option for inline viewing without navigation
- Added 8 world-class feature ideas: collaborative editing, layer templates, AI-assisted annotations, animation mode, measurement tools, layer linking/hotspots, version comparison, mobile touch support
- Updated all documentation with current metrics (96 JS files, 87 ES6 classes, 6,479 tests)

---

## [1.1.11] - 2025-12-22

### Bug Fixes
- **Fixed ToolStyles.js constructor initialization order** — Fixed bug where `this.update()` was called before `this.listeners = []` was initialized, causing a crash when `initialStyle` was provided to the constructor.
- **Added opacity extraction to ToolStyles** — `extractFromLayer()` now properly extracts the `opacity` property from layers.

### Testing
- **Test coverage improved to 92.19%** — Up from 90.09% statements
- **Branch coverage now exceeds 80%** — 80.19% (up from 77.53%)
- **6,337 tests passing** — Added 238 new tests
- Added comprehensive `APIErrorHandler.test.js` — 56 new tests (0% → 98.03%)
- Added comprehensive `NamespaceHelper.test.js` — 19 new tests (73.91% → 95.65%)
- Extended `ToolStyles.test.js` — +33 tests (78.67% → 100%)
- Extended `LayersViewer.test.js` — +13 tests (80.15% → 91.26%)

### Code Quality
- Updated `codebase_review.md` with current metrics
- Updated `improvement_plan.md` — P2.1 (Add Tests) now marked complete

---

## [1.1.10] - 2025-12-21

### Security
- **Removed SVG from allowed image imports** — SVG files can contain embedded JavaScript, creating XSS vulnerabilities. Removed `image/svg+xml` from allowed MIME types in `ServerSideLayerValidator.php`. Users requiring SVG support should implement proper sanitization.

### Bug Fixes
- **Fixed foreign repository file lookup** — `ApiLayersDelete` and `ApiLayersRename` now use `getRepoGroup()->findFile()` instead of `getLocalRepo()->findFile()`, enabling proper support for files from foreign repositories like Wikimedia Commons.

### Code Quality
- **Improved Jest coverage configuration** — Updated `collectCoverageFrom` in `jest.config.js` to track all source directories using comprehensive glob patterns, providing more accurate coverage reporting.

### Documentation
- Updated `codebase_review.md` with comprehensive technical assessment
- Updated `improvement_plan.md` with P1 items marked complete
- Updated `README.md` with accurate metrics and security notes

### Testing
- **5,766 tests passing** (maintained from v1.1.9)

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
