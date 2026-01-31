# Changelog

All notable changes to the Layers MediaWiki Extension will be documented in this file.

## [1.5.42] - 2026-01-31

### Security
- **P1.1: Race Condition in saveLayerSet()** — Moved named set limit check inside transaction with FOR UPDATE lock to prevent concurrent insertions exceeding the limit
- **P1.2: Missing Permission Check in ApiLayersList** — Added `checkUserRightsAny('read')` permission verification before listing slides
- **P2.8: Missing Rate Limiting on ApiLayersList** — Added `pingLimiter('editlayers-list')` rate limiting to prevent abuse

### Added
- **$wgLayersMaxComplexity** — New config option to set maximum complexity score for layer sets (default 100). Each layer type has a cost (text: 2, image: 3, shapes: 1, etc). (P3.12)

### Fixed
- **P2.1: isComplexityAllowed() Incomplete Coverage** — Expanded layer type handling from 5 to all 15 types with proper complexity scoring:
  - Text/textbox/callout: +2 complexity
  - CustomShape/image/path: +3 complexity (resource-intensive)
  - Arrow/group: +2 complexity
  - Simple shapes (rectangle, circle, ellipse, line, polygon, star, marker, dimension, blur): +1 complexity
  - Unknown types: +3 complexity (defensive default for future layer types)
- **P2.10: Missing paths Array Length Validation** — Added 100-path maximum limit before validation loop to prevent DoS via excessive customShape paths
- **P2.5: Raw SQL Fragments in listSlides()** — Refactored correlated subqueries to batch queries following the collect→batch→merge pattern:
  - Replaced inline SQL string concatenation with proper `$dbr->select()` calls
  - Added separate batch queries for revision counts and first timestamps
  - Performance improvement: eliminates N+1 correlated subqueries

### Technical Details
- All 11,112 tests pass (163 test suites)
- Test coverage: 95.42% statement, 85.25% branch
- All P1 HIGH priority security issues now resolved
- P2 issues reduced from 9 open to 5 open
- P3 issues: 9 resolved, 3 open
- Rating upgraded from 8.5/10 to 8.8/10

---

## [1.5.41] - 2026-01-30

### Security
- **SVG Entity Encoding Bypass** — Extended entity decoding to ALL SVG security checks (script tags, event handlers, foreignObject, use elements), not just javascript: URLs
- **vbscript: URL Blocking** — Added explicit blocking of vbscript: URLs in SVG content

### Added
- **LayersConstants.php** — New central constants file consolidating magic strings (TYPE_SLIDE, SLIDE_PREFIX, DEFAULT_SET_NAME, error codes, rate limit keys, config keys)
- **Total Points Validation** — Added MAX_TOTAL_POINTS (10,000) aggregate limit across all layers to prevent resource exhaustion
- **SVG Security Tests** — Added 5 PHPUnit tests for entity-encoded bypass scenarios

### Fixed
- **Documentation Metrics Sync** — Corrected god class count (17 → 18) and test count (11,069 → 11,112) across 10 files:
  - README.md, CHANGELOG.md, wiki/Changelog.md, wiki/Home.md
  - docs/ARCHITECTURE.md, CONTRIBUTING.md, codebase_review.md
  - improvement_plan.md, copilot-instructions.md

### Refactored
- **SetNameSanitizer** — Now uses LayersConstants::DEFAULT_SET_NAME instead of private constant
- **SlideHooks** — Uses LayersConstants::SLIDE_PREFIX and LayersConstants::TYPE_SLIDE

### Technical Details
- All tests pass (163 test suites)
- Test coverage: 95.42% statement, 85.25% branch
- New file: `src/LayersConstants.php`
- God class count corrected to 18 (2 generated + 14 JS + 2 PHP)

---

## [1.5.40] - 2026-01-30

### Fixed
- **P0: TailCalculator Bounds Check** — Fixed failing test by adding early return when tip position is inside the rectangle (no tail needed)
- **P1: ApiLayersList.getLogger() Bug** — Removed erroneous `->getLogger()` call on LayersLogger which already implements LoggerInterface
- **P2: N+1 Query in getNamedSetsForImage()** — Rewrote with batch query using `IDatabase::LIST_AND` and `LIST_OR` for proper SQL construction
- **P2: N+1 Query in listSlides()** — Refactored with collect→batch→merge pattern for first revision lookup
- **P2: LIKE Query Wildcard Escaping** — Changed from `addQuotes()` to proper `buildLike()` to escape SQL wildcards
- **P2: Slides-in-Tables Display Bug** — Fixed retry filter to catch containers with `undefined` init status (not just `false`)

### Improved
- **Drag Handle Hit Areas** — Added 4px hit tolerance padding around selection handles for easier clicking (16px total clickable area vs 8px visual)
- **Overlay Button Size** — Reduced hover buttons from 32px to 26px (desktop) and 28px to 24px (mobile) for less visual intrusion
- **API Code Extraction** — Created `LayersApiHelperTrait` with shared methods for permission checking, schema validation, and SHA1 fallback
- **Window Load Fallback** — Added `window.load` event listener to catch slides that appear after DOMContentLoaded

### Verified
- **Cursor Rotation for Rotated Objects** — Confirmed existing implementation in `TransformController.getResizeCursor()` correctly rotates cursors

### Technical Details
- All 11,112 tests pass (163 test suites)
- Test coverage: 95.42% statement, 85.25% branch
- All P0, P1, P2, and P3 priority items resolved
- Created new file: `src/Api/Traits/LayersApiHelperTrait.php`

---

## [1.5.39] - 2026-01-29

### Changed
- **God Class Reduction Initiative Complete** — Reduced hand-written god classes from 20 to 12 (40% reduction)
  - Extracted 12+ focused modules with clear single responsibilities
  - InlineTextEditor: RichTextConverter, RichTextToolbar, FormattingEngine
  - ViewerManager: SlideController
  - APIManager: ExportController
  - CalloutRenderer: TailCalculator
  - ArrowRenderer: ArrowGeometry
  - TextBoxRenderer: RichTextUtils
  - All remaining large files use proper delegation patterns

### Technical Details
- All 10,939 tests pass (162 test suites)
- Test coverage: 94.65% statement, 84.49% branch
- 139 JavaScript files (~94,137 lines)
- Documentation fully synchronized with current metrics

---

## [1.5.38] - 2026-01-29

### Fixed
- **Double Text Rendering During Inline Editing** — Fixed bug where changing alignment while inline editing textbox caused double rendering
  - Text appeared both on canvas and in HTML overlay simultaneously
  - Root cause: `richText` wasn't cleared alongside `text` in `_applyFormat()` for textbox layers
  - Also fixed `updateLayer()` to keep text/richText cleared during inline editing to prevent canvas rendering
- **Text Loss During Inline Editing** — Fixed bug where changing properties (like vertical alignment) while inline editing a textbox would lose all typed text
  - Added `getPendingTextContent()` method to `InlineTextEditor.js` to retrieve current editor content without closing
  - Modified `LayersEditor.updateLayer()` to merge pending text content when inline editing is active
- **Vertical Alignment During Editing** — Fixed visual mismatch where text appeared at top during editing even when layer had `verticalAlign: middle`
  - Added flexbox CSS with `justify-content` to `_positionEditor()` matching the layer's `verticalAlign` property
- **Rich Text Inline Display** — Fixed bug where styled text runs displayed on separate lines during editing instead of inline
  - The flex container for vertical alignment was treating each span as a flex child
  - Added inner content wrapper div so flex has one block child, preserving inline text flow
- **Slide Layer Rendering Order** — Fixed layers appearing in reverse order on article pages using `{{#slide:}}` parser function
  - Changed `forEach` loop to reverse `for` loop in `initializeSlideViewer()` and `reinitializeSlideViewer()`
  - Now layers[0] (top in panel) is correctly drawn last (appears on top), matching editor behavior

### Technical Details
- All 10,939 tests pass (162 test suites)
- Test coverage: 94.65% statement, 84.49% branch, 92.93% function, 94.77% line
- God Class Reduction Initiative complete: reduced from 20 to 12 god classes
- ESLint passes on all modified files

---

## [1.5.36] - 2026-01-27

### Added
- **Callout Inline Text Editing** — Callout layers now support double-click inline text editing with floating toolbar, matching textbox behavior
  - Added `callout` to `canEdit()` method in `InlineTextEditor.js`
  - Added `_isMultilineType()` helper method for textbox/callout type checking
  - Updated `CanvasEvents.js` to allow double-click on callout layers
  - Added 12 new tests for callout editing support

### Changed
- **Slide Parameter Simplification** — Replaced `lock=none|size|all` parameter with simpler `noedit` flag
  - `noedit` hides the edit overlay button for view-only slides
  - Removed complex lock mode logic from SlideHooks.php, ViewerManager.js, SlidePropertiesPanel.js
  - Updated wiki documentation (Slide-Mode.md, Wikitext-Syntax.md)

### Fixed
- **Slide Revision Loading** — Fixed "Revision not found" error when loading specific slide revisions
  - Changed API response key from `set_revisions` to `all_layersets` for JS compatibility
  - Added `layersetid` parameter support to `executeSlideRequest()` with security check
  - Ensures slide revision history works correctly in the editor

### Technical Details
- All 10,667 tests pass (157 test suites)
- Test coverage: 95.86% statement, 85.40% branch, 93.99% function, 95.97% line
- Codebase review v42: 8.6/10 overall
- ESLint/Stylelint/Banana all pass

---

## [1.5.35] - 2026-01-26

### Fixed
- **Slide Editor New Layer Set Selector** — Fixed issue where specifying a new (unsaved) layer set name via `layerset=X` would show 'default' in the dropdown instead of 'X'
  - Root cause: `buildSetSelector()` hardcoded 'default' when `namedSets` was empty or when `currentSetName` wasn't in the list
  - Fix: Dropdown now shows the specified set name with a "(new)" suffix for unsaved sets
  - Added i18n message `layers-set-new-unsaved` for translatable "(new)" label
- **Version Inconsistencies (P0)** — Fixed version number mismatches across 6 project files (ranging from 1.5.26 to 1.5.31)
  - Updated all files to match extension.json source of truth (1.5.35)
  - Added `scripts/update-version.js` to automate version synchronization
  - Added `npm run check:version` and `npm run update:version` commands
  - Added version consistency check to CI workflow

### Improved
- **Documentation Metrics** — Updated all stale metrics in documentation files
  - Test count: 10,658 tests in 157 suites
  - Coverage: 93.52% statement, 84.24% branch, 91.79% function, 93.66% line
  - JS files: 127, ~115,282 lines
  - PHP files: 40, ~14,388 lines
  - ESLint disables: 11 (all legitimate)
  - i18n messages: 697
- **Codebase Review** — Comprehensive critical review (v40) with all issues documented
  - Overall score: 8.5/10
  - 0 critical issues, 0 high issues, 7 medium issues, 9 low issues
  - Updated codebase_review.md and improvement_plan.md

---

## [1.5.34] - 2026-01-26

### Fixed
- **Slide Editor `layerset=` Still Not Applied** — Fixed additional issue where `currentSetName` was being initialized to 'default' before the config's `initialSetName` was used
  - Root cause: `LayersEditor.initializeState()` hardcoded `currentSetName` to 'default' regardless of config
  - Fix: Now uses `this.config.initialSetName || 'default'` during state initialization

---

## [1.5.33] - 2026-01-25

### Fixed
- **Slide Editor `layerset=` Parameter Not Applied** — Fixed issue where the slide editor opened to the default layer set instead of the specified one (e.g., `layerset=001`)
  - Root cause: `SpecialEditSlide.php` used `setName` but `EditorBootstrap.js` expected `initialSetName`
  - Fix: Changed PHP to use `initialSetName` to match `EditLayersAction.php` pattern

---

## [1.5.32] - 2026-01-25

### Fixed
- **Critical: Slide `layerset=` Parameter Bug** — Fixed issue where `layerset=` parameter in `{{#slide:}}` parser functions was being stripped before the parser could read it
  - Root cause: Global regex in WikitextHooks.php was stripping `|layerset=...` from ALL wikitext, not just `[[File:...]]` links
  - Fix: Changed to targeted `preg_replace_callback()` that only processes within `[[File:...]]` or `[[Image:...]]` contexts
  - Added 28 new PHPUnit tests to prevent regression

### Improved
- **Safari Compatibility** — Added `-webkit-user-select: none` prefix for Safari/iOS support
- **Test Quality** — Fixed SVG creation in tests to use proper `createElementNS()` for JSDOM compliance

### Technical Details
- All 10,643 tests pass (157 test suites)
- Test coverage: 94.17% statement, 84.43% branch, 92.18% function, 94.31% line
- PHP and JS lint checks pass cleanly

---

## [1.5.31] - 2026-01-25

### Added
- **Lowercase Slide Parser Function (FR-12)** — `{{#slide:}}` now works in addition to `{{#Slide:}}`, matching MediaWiki conventions

### Improved
- **REL1_43 Branch Sync** — Updated REL1_43 branch to include all changes from v1.5.30

### Fixed
- **Draft Recovery False Prompts** — Fixed issue where draft recovery prompts appeared when no actual draft existed
- **Layer Panel Header** — Redesigned with full Layers logo branding
- **Canvas Accessibility** — Completed P3.5 accessibility improvements for canvas interactions

### Technical Details
- All 10,643 tests pass (157 test suites)
- Test coverage: 94.17% statement, 84.43% branch, 92.18% function, 94.31% line
- ESLint/Stylelint/Banana all pass
- REL1_43 branch fully synced with main

---

## [1.5.30] - 2026-01-25

### Added
- **Layer Search Filter** — Search/filter layers in the layer panel
  - Real-time search input filters layers by name or text content
  - Shows "Showing N of M layers" count during filtering
  - Clear button to reset filter
  - Full dark mode support (night and OS themes)
  - 3 new i18n messages

### Improved
- **Jest Coverage Thresholds** — Raised thresholds to protect against regression
  - Branches: 65% → 80%
  - Functions: 80% → 90%
  - Lines: 80% → 92%
  - Statements: 80% → 92%

### Technical Details
- All 10,626 tests pass (157 test suites) — 13 new tests for layer search
- Test coverage: 94.19% statement, 84.43% branch, 92.19% function, 94.32% line
- ESLint/Stylelint/Banana all pass

---

## [1.5.29] - 2026-01-25

### Added
- **DraftManager Auto-Save** — Automatic draft recovery system
  - Auto-saves to localStorage every 30 seconds with debounce
  - Shows recovery dialog when reopening editor with unsaved drafts
  - Clears draft on successful save, 24-hour expiry for stale drafts
  - 25 new unit tests
- **Canvas Snap** — Snap layer edges and center to canvas edges and center with visual green guides
  - Toggle via Arrange & Snap dropdown or `'` (apostrophe) keyboard shortcut
  - Independent from Smart Guides (both can be enabled simultaneously)
  - Green guides distinguish canvas snapping from magenta object snapping
- **Visual Bounds Snapping** — Snapping now respects visual bounds including stroke width
  - Thick strokes no longer get cut off when snapped to canvas edges
  - Follows industry standard (Figma, Sketch, Illustrator)

### Fixed
- **Set Selector Race Condition** — Prevent concurrent delete/rename/clear operations
  - Added pending operation state that disables controls during API calls
  - 7 new unit tests
- **PHP 8.4 strict_types Compatibility** — Fixed save failures caused by TypeError when `declare(strict_types=1)` enabled
  - `ColorValidator::isValidHexColor()` was returning `int` (from `preg_match`) instead of `bool`
  - Added `(int)` casts to `config->get()` calls for `LayersMaxBytes`, `LayersMaxImageBytes`, and slide dimension configs
- **Canvas Snap Shadow/Stroke** — Fixed canvas snap not accounting for shadow and stroke expansion when snapping to edges
- **Canvas Snap Trigger** — Fixed canvas snap not working during drag operations (TransformController now checks `canvasSnapEnabled` flag)
- **Slide Editor i18n** — Added missing `special-editslide-title` message for slide editor page title
- **PHP Error Return Types** — `countNamedSets()` and `countSetRevisions()` now return -1 on DB error

### Improved
- **StateManager Batching** — Replaced 8 sequential `set()` calls with 2 batched `update()` calls in APIManager
- **Clipboard Error Logging** — Added `mw.log.warn()` for clipboard API failures
- **PHP Code Quality** — Added `JSON_DECODE_MAX_DEPTH` constant to all PHP files using json_decode

### Technical Details
- All 10,613 tests pass (157 test suites)
- Added 32+ new tests for DraftManager and SetSelectorController
- Test coverage: 94%+ statement, 84%+ branch
- ESLint/Stylelint/Banana all pass

---

## [1.5.28] - 2026-01-24

### Fixed
- **Inline Text Editor: Text Duplication During Formatting** — Fixed bug where using the floating toolbar (font, bold, italic, alignment, etc.) during inline text editing caused text to appear twice with slight misalignment. Root cause: `_applyFormat()` called `updateLayer()` which read the layer from StateManager (containing original text), merged only the style change, and re-rendered the layer with text while the textarea overlay also showed text. Fix: Include editing state preservation in the changes object (`text: ''` for textbox, `visible: false` for simple text) to maintain the hidden/cleared state during format changes.
- **Empty Slide Overlay** — Fixed missing edit overlay on empty slides. Changed `renderEmptySlide()` to use `setupSlideOverlay()` instead of deprecated `setupSlideEditButton()`.
- **Empty Slide i18n** — Added missing `layers-slide-empty` and `layers-slide-empty-hint` i18n messages that were showing raw message keys.

### Technical Details
- All 9,995 tests pass (156 test suites)
- Added 1 new test for textbox layer format changes
- Test coverage: 92.96% statement, 83.27% branch
- ESLint/Stylelint/Banana all pass

---

## [1.5.27] - 2026-01-24

### Fixed
- **Slide Mode: Background Opacity Not Updating After Save** — Fixed bug where changing the background opacity slider in the slide editor would save correctly but not visually update on the article page until a hard refresh. Root cause: the container's CSS `background-color` (set by PHP during initial page render) was showing through the canvas, which draws the background with `globalAlpha` for opacity. Solution: in `ViewerManager.js`, both `reinitializeSlideViewer()` and `initializeSlideViewer()` now set `container.style.backgroundColor = 'transparent'` when opacity < 1, ensuring only the canvas-drawn background (with proper opacity) is visible.
- **parseInt Radix Parameter** — Added explicit radix (10) to all 9 parseInt calls in ValidationHelpers.js and NumericValidator.js for robustness.

### Added
- **EmojiPickerPanel E2E Tests** — Added 17 Playwright E2E tests covering emoji picker functionality: opening/closing, panel structure, category navigation, search, emoji selection, and performance testing.
- **Error Handling Documentation** — Added comprehensive error handling guidelines to CONTRIBUTING.md with three documented patterns and clear rules.

### Technical Details
- All 9,994 tests pass (156 test suites)
- Added 4 new tests for `drawSlideBackground()` opacity handling
- Updated ViewerManager mock contexts to include `save`, `restore`, `globalAlpha`
- Test coverage: 92.96% statement, 83.27% branch
- ESLint/Stylelint/Banana all pass

---

## [1.5.26] - 2026-01-23

### Fixed
- **CORE-6: StateManager Dead Code** — Removed dead `undo()`, `redo()`, and `restoreState()` methods from StateManager. These methods were never called since `saveToHistory()` is disabled. HistoryManager handles all undo/redo functionality.
- **CORE-7: StateManager Lock Timeout Recovery** — Added recovery check at start of `lockState()` that detects and logs when recovery from a stuck lock occurs. When `lockStuckSince` is set and a new lock succeeds, it logs the stuck duration and clears the flag.
- **CORE-9: HistoryManager Bounds Check** — Added defensive bounds check in `undo()` and `redo()` methods. If the state at the computed index is undefined, the method logs an error, restores the index, and returns `false`.
- **CORE-8: API Timeout Handling** — Verified already handled by mw.Api default 30-second timeout. Added missing i18n messages for `layers-timeout-error` and `layers-network-error`.

### Changed
- **SM-1, SM-5 Closed** — User testing confirmed these were not reproducible bugs

### Technical Details
- All 9,967 tests pass (156 test suites)
- Added 4 new CORE-9 bounds check tests for HistoryManager
- Updated StateManager and LayerWorkflow integration tests for removed methods
- Test coverage: 92.59% statement, 83.02% branch
- ESLint/Stylelint/Banana all pass

---

## [1.5.25] - 2026-01-24

### Fixed
- **Slide Mode: Slides Not Refreshing After Editor Close** — Fixed critical bug where slides required a full page refresh to see changes after closing the editor, unlike images which update immediately. Root cause: slides use `window.location.href` navigation to `Special:EditSlide` (full page navigation) while images use a modal editor. When the slide editor closes via `history.back()`, the browser restores the page from bfcache (back-forward cache), which does NOT re-execute JavaScript. Solution: added `pageshow` event listener in `init.js` that detects bfcache restoration (`event.persisted === true`) and calls `refreshAllViewers()`. Also updated `refreshAllSlides()` to refresh ALL slide containers without requiring the `layersSlideInitialized` property (which may be lost on bfcache restoration).

### Technical Details
- All 9,951 tests pass (155 test suites)
- Added 13 new tests for slide refresh functionality (ViewerManager: 11, init: 2)
- Test coverage: 93.52% statement, 83.89% branch
- ESLint/Stylelint/Banana all pass

---

## [1.5.24] - 2026-01-24

### Fixed
- **SVG Custom Shapes: Dashed Placeholder Boxes on Article Pages** — Fixed custom SVG shapes (from Shape Library) displaying a visible dashed rectangle placeholder on article pages while the SVG loaded. The placeholder was appropriate during development but caused visual artifacts in production. Solution: removed placeholder drawing code from `CustomShapeRenderer.js`; SVGs now load directly from cached blob URLs without intermediate placeholders.

### Added
- **Slide Mode: Special:Slides Management Page** — Added `Special:Slides` page for listing, searching, creating, and deleting slides. Features:
  - Grid-based slide listing with metadata (dimensions, layer count, last modified)
  - Real-time search filtering
  - Sort by name, last modified, or date created
  - Create slide dialog with preset sizes and custom dimensions
  - Delete confirmation with OOUI dialogs
  - Pagination for large slide collections
  
- **Slide Mode: Special:EditSlide Direct Editor Access** — Added `Special:EditSlide/SlideName` for direct slide editing without going through the listing page. Loads slide data from database and initializes the editor in slide mode.

- **Slide Mode: SlideNameValidator** — Server-side validation for slide names:
  - Alphanumeric characters, hyphens, and underscores only
  - 1-100 character length limit
  - Reserved name checking (`new`, `delete`, `edit`, `list`, etc.)
  - Sanitization method for unsafe characters

- **Slide Mode: API layerslist Endpoint** — New API module for listing slides with filtering and pagination support.

### Technical Details
- All 9,922 tests pass (155 test suites)
- Test coverage: 93.52% statement, 83.89% branch
- ESLint/Stylelint/Banana all pass
- PHP parallel-lint/phpcs pass

---

## [1.5.23] - 2026-01-22

### Fixed
- **Slide Mode: Canvas Dimensions Not Persisting** — Fixed critical bug where canvas dimensions reverted to 800×600 after save/close/reopen despite being saved correctly. Root cause: `buildSlideEditorUrl()` was passing wikitext `canvas=WxH` parameters in the editor URL, which overrode saved database values. Solution: removed `canvaswidth`, `canvasheight`, and `bgcolor` URL parameters; now the server loads saved dimensions from the database when parameters are missing.
- **Slide Mode: View Icon Inconsistency** — Fixed the "view full size" icon on slides to match the fullscreen icon used on regular layered images. Now uses `IconFactory.createFullscreenIcon()` when available, with fallback to identical SVG.
- **Slide Mode: LayersLightbox Not Available** — Fixed "LayersLightbox not available for slide view" error. Root cause: `ViewerManager.handleSlideViewClick()` looked for `window.Layers.LayersLightbox` but class exports to `window.Layers.Viewer.Lightbox`. Updated lookup chain to check both paths.
- **Slide Mode: Edit Icon Mismatch** — Fixed edit (pencil) icon on slide overlays being different from image overlays. `ViewerManager._createPencilIcon()` now uses `IconFactory.createPencilIcon()` when available, with identical 24×24 stroke-based SVG fallback.
- **Slide Mode: Background Color Not Saving** — Fixed slide background color not persisting after save. Root cause: `APIManager.buildSavePayload()` read `backgroundColor` from state but `LayersEditor.initializeState()` stores it as `slideBackgroundColor`. Updated state key lookup.
- **Slide Mode: False Dirty State on Open** — Fixed editor prompting to save changes immediately after opening (without any modifications). Root cause: `Toolbar.updateSlideControlValues()` called `setSlideBackgroundColor()` during initialization, which marks the document dirty. Added `updateSlideBackgroundSwatch()` helper method for UI-only updates during initialization.

### Changed
- **Canvas Parameter Behavior** — `canvas=WxH` in wikitext now only applies to NEW slides (first creation). Once a slide is saved, subsequent edits load dimensions from the database, not the wikitext. This allows users to change canvas size in the editor without the wikitext overriding it.
- **Size vs Canvas Clarification** — `size=WxH` remains purely display-only (scales the rendered slide), while canvas dimensions are stored in the database and control the actual editing canvas.

### Technical Details
- All 9,922 tests pass (155 test suites)
- All 116 ViewerManager tests pass
- All 486 Toolbar tests pass
- ESLint/Stylelint/Banana all pass
- Codebase review: continues at 9.2/10

---

## [1.5.22] - 2026-01-22

### Fixed
- **Slide Mode: Canvas Size Not Applied** — Fixed critical bug where slides with `canvas=600x400` would always display as 800×600 in the editor. Root cause was timing issue where `CanvasManager.init()` was called before slide dimensions could be set. Solution: pass slide dimensions through CanvasManager config and set `baseWidth`/`baseHeight` before `init()`.
- **Slide Mode: Edit Button Always Visible** — Fixed the edit overlay on slides to only appear on hover, matching the behavior of regular layered images. Complete restructure of SlideViewer.css with new `.layers-slide-overlay` container and fade-in/out transitions.
- **Slide Mode: CSS Lint Error** — Fixed Stylelint `no-descending-specificity` error in SlideViewer.css by adding targeted disable comment for deprecated button styles.

### Added
- **Slide Mode: View Full Size Button** — Added "View full size" button to slide overlays that opens the slide in LayersLightbox. Exports current canvas state to PNG data URL for full-size viewing.
- **ViewerManager Slide Overlay System** — New JavaScript-based overlay system for slides:
  - `setupSlideOverlay()` — Creates overlay with edit/view buttons
  - `handleSlideEditClick()` — Opens slide editor  
  - `handleSlideViewClick()` — Opens lightbox with canvas data URL
  - `_msg()` — i18n helper for slide overlay messages
  - `_createPencilIcon()` / `_createExpandIcon()` — SVG icon generators

### Changed
- **SlideHooks.php** — Removed server-side edit button HTML generation; now handled by JavaScript overlay system

### Documentation
- **SLIDE_MODE_ISSUES.md** — Updated status to "Feature Complete - All Critical Issues Resolved", documented all 10 fixes with code examples and data flow diagrams
- **codebase_review.md** — Updated to v17 audit with January 22, 2026 test results (9,922 tests, 93.52% coverage), documented slide mode fixes

### Technical Details
- All 9,922 tests pass (155 test suites)
- Test coverage: 93.52% statement, 83.89% branch
- ESLint/Stylelint/Banana all pass
- Codebase review rating: 9.2/10

---

## [1.5.21] - 2026-01-21

### Fixed
- **PHPUnit SlideHooksTest.php** — Complete rewrite of broken unit tests for SlideHooks:
  - Fixed `testParseCanvasDimensions` passing int instead of Config mock
  - Fixed `testParseArguments` missing required PPFrame mock parameter
  - Fixed `testSanitizeCssClasses` expecting string but method returns array
  - Removed `testIsValidLockMode` for non-existent method

### Documentation
- **SLIDE_MODE.md Troubleshooting** — Added comprehensive "Appendix B: Troubleshooting" section (~80 lines) covering:
  - Parser function rendering as plain text (cache rebuild solutions)
  - Edit button not appearing (permission requirements)
  - Edit button hidden with `lock=all` (admin rights required)
  - Database and JavaScript debugging steps
- **codebase_review.md** — Added findings from Slide Mode investigation, documented test fixes

### Added
- **Debug Logging in SlideHooks.php** — Added `staticLog()` calls to `renderSlide()` method for troubleshooting parser function issues

### Technical Details
- All 73 PHP files pass parallel-lint syntax check
- All 116 ViewerManager Jest tests pass (includes 20 Slide Mode tests)
- ESLint/Stylelint/Banana all pass

---

## [1.5.20] - 2026-01-20

### Added
- **Virtual Scrolling for Layer Lists (P2.1)** — Layer panel now uses virtual scrolling for lists with 30+ layers, dramatically improving performance and preventing browser slowdowns with large layer counts
  - DOM element recycling prevents memory issues
  - Automatic activation threshold at 30 layers
  - Smooth scroll performance maintained regardless of layer count

### Technical Details
- Created `VirtualLayerList.js` in `ext.layers.editor/ui` (381 lines)
- Integrated with `LayerListRenderer.js` for seamless activation
- Added 30 tests for VirtualLayerList (9,783 total tests, 153 suites)
- Test coverage: 93.52% statement, 83.89% branch
- Codebase review rating: 9.0/10

---

## [1.5.19] - 2026-01-20

### Added
- **Shared IdGenerator Utility** — New centralized ID generation with monotonic counter guarantees unique layer IDs even during rapid operations (paste, duplicate, bulk imports)

### Improved
- **ViewerManager Error Tracking** — `refreshAllViewers()` now returns detailed result object `{refreshed, failed, total, errors}` instead of just a count, enabling better debugging of viewer refresh failures

### Technical Details
- Created `IdGenerator.js` in `ext.layers.shared` with session-level counter + timestamp + random suffix
- Updated `StateManager`, `APIManager`, `ToolManager`, `SelectionManager` to use shared generator
- Added 13 new tests for IdGenerator
- Added 35 new tests for EmojiPickerPanel (9,753 total tests)
- Codebase review Audit v12: rating 9.2/10

---

## [1.5.18] - 2026-01-19

### Fixed
- **Critical: Edit Overlay Fails for Non-Existent Layer Sets** — Fixed a serious production bug where clicking the edit overlay for a non-existent layer set (e.g., `layerset=888`) would produce a "Bad title: contains invalid characters" error. Multiple issues were corrected:
  - PHP: `ThumbnailProcessor` now sets `data-file-name` attribute even when no layer data exists, preventing fallback filename extraction from failing
  - PHP: `ThumbnailProcessor` now sets `data-layers-intent` for named sets (not just 'on'/'all')
  - JS: `ViewerOverlay` now passes the pre-built URL to the modal instead of an options object
  - JS: Added defensive sanitization to strip wikitext bracket characters from filenames
  - JS: `ApiFallback` now calls `initializeOverlayOnly()` when layer set doesn't exist but intent was specified

### Technical Details
- Updated `ThumbnailProcessor.php`: Added `data-file-name` to else branch (no layer data case)
- Updated `ThumbnailProcessor.php`: Changed intent detection to allow any non-disabled layersFlag value
- Updated `ViewerOverlay.js`: `_handleEditClick()` builds URL with `_buildEditUrl()` instead of passing options object
- Updated `ViewerOverlay.js`: Constructor sanitizes filename with `/[\x5B\x5D]/g` regex (hex escapes for brackets)
- Updated `ViewerManager.js`: `extractFilenameFromImg()` sanitizes extracted filenames to strip brackets
- Updated `ViewerManager.js`: `initializeOverlayOnly()` sets `data-layer-autocreate='1'` for non-existent sets
- Updated `ApiFallback.js`: Calls `initializeOverlayOnly()` when API returns no data but intent exists
- Added 2 new tests for bracket sanitization in `ViewerManager.test.js`
- All viewer-related tests passing (209 tests: 96 ViewerManager + 64 ApiFallback + 51 ViewerOverlay)

---

## [1.5.17] - 2026-01-19

### Added
- **Collapsible Shadow Settings** — Drop shadow and text shadow settings are now hidden until the "Enable" checkbox is checked, reducing visual clutter in the properties panel

### Fixed
- **StateManager Exception Handling (HIGH)** — Fixed potential deadlock in `StateManager.unlockState()` where an exception in a pending operation would leave the state permanently locked. Added try-catch wrapper that logs errors and continues processing remaining operations.
- **Missing mw Object Guard (MEDIUM)** — Fixed `ReferenceError` in Node.js/Jest environments by adding `typeof mw !== 'undefined'` guard before accessing `mw.log` in StateManager timeout handler.
- **Drawing RAF Callback After Destroy (MEDIUM)** — Fixed potential null reference errors after editor closure by adding `isDestroyed` guard at start of `CanvasManager.continueDrawing()` RAF callback and resetting `_drawingFrameScheduled` in `destroy()`.
- **TransformController RAF Null Access (MEDIUM)** — Fixed potential crashes during rapid editor close by adding null/destroyed guards to all three RAF callbacks in TransformController (drag, resize, rotation).

### Technical Details
- Updated `PropertiesForm.js`: Shadow settings (color, blur, spread, offset) hidden until "Drop Shadow" enabled
- Updated `PropertyBuilders.js`: Text shadow settings hidden until "Enable Text Shadow" checked
- Panel auto-refreshes when toggling shadow checkboxes to show/hide relevant controls
- Updated `StateManager.js`: `unlockState()` now wraps operations in try-catch
- Updated `StateManager.js`: Timeout handler checks `typeof mw !== 'undefined'`  
- Updated `CanvasManager.js`: RAF callback checks `this.isDestroyed`, `destroy()` resets flag
- Updated `TransformController.js`: All 3 RAF callbacks check `!this.manager || this.manager.isDestroyed || !this.manager.editor`
- All 9,693 tests passing after changes (verified via `npm run test:js`)
- Codebase review rating increased from 8.8 to 9.0/10

---

## [1.5.16] - 2026-01-18

### Added
- **Additional Font Support** — Added Courier, Georgia, Verdana, and Helvetica to the allowed fonts list

### Fixed
- **Font Not Saving in TextBox Layers** — Fixed issue where fonts (especially Courier) were silently rejected by server validation and fell back to Arial. The server's `$wgLayersDefaultFonts` whitelist now includes all commonly-used web fonts.
- **Rotated Text Box Inline Editing** — The inline text editor now correctly rotates to match the layer's rotation angle, allowing proper editing of rotated text
- **Layer Deselection When Editing Rotated Text** — Fixed issue where clicking elsewhere on canvas while editing a rotated text layer would not deselect it. The mousedown handler now properly finishes inline editing before processing new selections.

### Technical Details
- Updated `extension.json`: Added Courier, Georgia, Verdana, Helvetica to `LayersDefaultFonts`
- Updated `FontConfig.js`: Added Courier to `DEFAULT_FONTS` constant for consistency
- Updated `InlineTextEditor.js`: `_positionEditor()` now applies CSS `transform: rotate()` for rotated layers
- Updated `CanvasEvents.js`: `handleMouseDown()` calls `finishEditing(true)` before processing clicks

---

## [1.5.15] - 2026-01-18

### Added
- **Hover Overlay Actions** — Edit/View icons appear on hover over layered images
  - **Edit button** (pencil icon): Opens layer editor — respects `editlayers` permission
  - **View button** (expand icon): Opens full-size lightbox viewer
  - Touch support with auto-hide after 3 seconds
  - Modal editor integration on article pages, direct navigation on File: pages
  - Full accessibility: ARIA labels, keyboard navigation, reduced-motion support
  - Dark mode and high-contrast mode support
- **Floating Text Formatting Toolbar** — When editing text inline, a draggable floating toolbar appears with:
  - Font family dropdown (Arial, Helvetica, Times New Roman, Georgia, Verdana, Courier New, Comic Sans MS, Impact)
  - Font size input (8-200px)
  - Bold and Italic toggle buttons
  - Text alignment buttons (left, center, right)
  - Color picker button with full swatch palette (uses ColorPickerDialog)
  - Draggable via grab handle for optimal positioning
  - Full dark mode support

### Fixed
- **Textbox Background Visibility** — Textbox layers now keep their background visible during inline editing (text is cleared instead of hiding the layer)
- **Font Selector Focus** — Fixed font dropdown closing immediately after opening
- **Color Picker Integration** — Color button now opens the full ColorPickerDialog with swatches, saved colors, and OK/Cancel buttons

### Technical Details
- New files: `ViewerOverlay.js` (~490 lines) in `resources/ext.layers/viewer/`
- Added `wgLayersCanEdit` config variable in PHP for permission-aware client UI
- 24 new unit tests for ViewerOverlay
- New icons in `IconFactory.js`: `createPencilIcon()`, `createFullscreenIcon()`

---

## [1.5.13] - 2026-01-18

### Added
- **Inline Canvas Text Editing** — Figma/Canva-style direct text editing on the canvas
  - Double-click any text or textbox layer to edit in place
  - HTML textarea overlay matches layer position, size, and styling
  - Real-time preview while typing
  - Keyboard shortcuts: Enter to confirm (text), Ctrl+Enter (textbox), Escape to cancel
  - Mobile keyboard optimization with Visual Viewport API support
  - Full Unicode and special character support
  - Proper undo/redo integration with history system

### Technical Details
- New files: `InlineTextEditor.js` (~600 lines) in `resources/ext.layers.editor/canvas/`
- Extended `CanvasEvents.js` with double-click handling for text layers
- Added `setTextEditingMode()` and `isTextEditing` state to `CanvasManager.js`
- CSS styles for `.layers-inline-text-editor` with dark mode support
- 66 new unit tests covering all functionality

---

## [1.5.12] - 2026-01-17

### Added
- **Emoji Picker** — New toolbar button opens a searchable emoji library with 2,817 Noto Color Emoji SVGs
  - Lazy-loaded SVG thumbnails using IntersectionObserver for performance
  - 19 well-organized categories: Smileys, Gestures, People, Animals, Nature, Food, Travel, Places, Weather, Sports, Entertainment, Objects, Hearts, Symbols, Zodiac, Arrows, Warnings, Household, Miscellaneous
  - Priority-based category matching ensures accurate emoji categorization (e.g., footballs in Sports, not People)
  - Full-text search with descriptive names and keywords (587 emoji have searchable names)
  - Gradient colors preserved in SVG thumbnails via unique ID renaming
  - Filters out 914 problematic emoji (regional indicators, complex ZWJ sequences, Unicode 13.0+ blocks)
  - Lightweight index architecture: 196.7KB metadata file, SVGs loaded on-demand from server

### Technical Details
- New files: `EmojiPickerPanel.js`, `EmojiLibraryIndex.js`, `emoji-names.json`, `generate-emoji-index.js`
- 3,731 Noto Color Emoji SVG files in `assets/noto_emoji/` (~38MB total)
- Toolbar integration via `createEmojiPickerButton()` and `openEmojiPicker()` methods
- Modal dialog matches existing Shape Library panel UI (800×600px)
- Creates image layers with proper Canvas rendering

---

## [1.5.11] - 2026-01-17

### Added
- **Expanded Shape Library** — Added 951 new shapes across 4 new categories:
  - **IEC 60417 Symbols** (735 shapes): International Electrotechnical Commission graphical symbols for equipment
  - **ISO 7000 Symbols** (198 shapes): Equipment and graphical symbols
  - **GHS Hazard Pictograms** (8 shapes): Chemical hazard warning pictograms
  - **ECB Hazard Symbols** (10 shapes): European chemical hazard symbols
  - Total library now contains **1,310 shapes** across **10 categories**

### Fixed
- **Shape Library Rendering** — Fixed critical bug where custom shapes failed to render
  - Root cause: `ShapeLibraryData.js` was overwriting `window.Layers.ShapeLibrary` object, destroying the `CustomShapeRenderer` reference
  - Solution: Changed to use `Object.assign()` to merge data methods while preserving existing properties
- **SVG Cleanup** — Sanitized 214 SVG files, removing unnecessary metadata (saved ~242KB)

### Changed
- **Shape Library Generator** — Updated `generate-library.js` to use `Object.assign()` pattern for namespace safety

---

## [1.5.10] - 2026-01-14

### Added
- **Marker Auto-Number** — New feature for placing multiple markers quickly
  - Added "Auto-number" checkbox in toolbar when marker tool is selected
  - When enabled, marker values auto-increment (1→2→3... or A→B→C...) using existing `MarkerRenderer.getNextValue()` logic
  - Tool remains active after placing a marker, allowing rapid sequential placement
  - New `addLayerWithoutSelection()` method to support continuous marker placement
  - New i18n messages: `layers-marker-autonumber`, `layers-marker-autonumber-tooltip`
  - UI supports both light and dark modes (Vector 2022 compatible)

### Fixed
- **Arrow Fill Inconsistency** — Arrows now properly support fill colors for fat/storage arrow styles
  - Fixed `updateContextVisibility()` to show fill control for arrow tool
  - Fixed `applyColorPreview()` to apply fill color to arrow layers
- **Marker Incrementing Bug** — Fixed markers showing same value (1,1,1) instead of incrementing
  - Fixed `DrawingController.startMarkerTool()` to use correct layers path (`editor.layers`)
- **Marker Controls Visibility** — Fixed auto-number checkbox disappearing after first marker
  - Added CSS rule for `.style-control:not(.context-hidden)` visibility
  - Use `addLayerWithoutSelection()` in auto-number mode to keep controls visible
- **Ellipse Resize Behavior** — Fixed ellipse resize to keep opposite edge fixed (matches rectangles and preview)
- **Canvas Size Hardcoding** — Canvas dimensions now configurable via `LayersConstants.LIMITS`
- **Race Condition in updateLayer** — Added guard to handle layer removal during atomic operations
- **Database Return Type Inconsistency** — `deleteNamedSet()` now returns `?int` (null on error) consistently

### Improved
- **Code Review Complete** — All 28 identified issues resolved (17 fixed, 11 verified correct)
  - 3 CRITICAL, 7 HIGH, 11 MEDIUM, 7 LOW issues addressed
  - Overall rating improved from 7.5/10 to 9.0/10
- **Test Coverage** — Branch coverage improved from 84.92% to 84.98%
  - Added 9 new tests for GradientEditor edge cases

### Refactored
- **ForeignFileHelperTrait** — Extracted duplicate code from 4 API modules into shared trait
  - New `src/Api/Traits/ForeignFileHelperTrait.php` with `isForeignFile()` and `getFileSha1()` methods
  - Eliminates ~90 lines of duplicated code across ApiLayersSave, ApiLayersInfo, ApiLayersDelete, ApiLayersRename
  - Consistent InstantCommons/foreign file handling across all API endpoints

### Tests
- **Test Count** — 9,469 tests passing (147 suites)
- Added PHPUnit tests for `LayersContinuationTrait` (14 test methods covering pagination parsing and formatting)
- Added PHPUnit tests for `StaticLoggerAwareTrait` (10 test methods covering static logger injection and log methods)
- Added PHPUnit tests for `ForeignFileHelperTrait` (8 test methods covering foreign file detection and SHA1 fallback)
- Added PHPUnit tests for `ApiLayersRename` set name validation (12 test methods covering valid/invalid patterns)
- Added PHPUnit tests for `ValidationResult` class (19 test methods covering factory methods, merge, metadata)
- Added PHPUnit tests for `LoggerAwareTrait` (7 test methods covering log methods and prefix formatting)
- Added 4 CanvasManager tests for autoNumber property and finishDrawing behavior
- Added 5 ToolbarStyleControls tests for marker controls UI and visibility
- Added 9 GradientEditor tests for edge cases and defensive code
- Fixed 3 arrow fill tests (StyleController, ToolbarStyleControls)
- Updated DrawingController tests for new `editor.layers` path

---

## [1.5.9] - 2026-01-13

### Removed
- **SVG Export** — Removed 1,535 lines of dead code. The SVG export feature was never registered in extension.json and was not accessible to users. The code had significant bugs with stars, gradients, text boxes, and arrows.

### Improved
- **Code Quality** — Branch coverage improved from 83.96% to 85.11% after removing dead code
- **Test Suite** — Now 9,451 tests passing (147 suites) with 95.10% statement coverage

---

## [1.5.8] - 2026-01-12

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
- **GradientRenderer Namespace** — Fixed 6 incorrect namespace references (`window.Layers.GradientRenderer` → `window.Layers.Renderers.GradientRenderer`)
- **Fill Type Toggle** — Properties panel now properly refreshes when switching between solid and gradient fill types
- **Scale Parameter Handling** — Fixed scale object extraction in ShapeRenderer.applyFillStyle() for proper gradient rendering

### Tests
- **Test Count** — 9,562 tests passing (149 suites)
- Added GradientRenderer test suite with 40 tests covering gradient creation, validation, presets, and cloning
- Added GradientEditor test suite with 31 tests covering UI interactions and callbacks

---

## [1.5.7] - 2026-01-11

### Refactored
- **Codebase Cleanup** — Code quality improvements
  - Reduced god class count
  - Improved test coverage

### Tests
- **Test Count** — 9,489 tests passing (147 suites)

---

## [1.5.6] - 2026-01-10

### Fixed
- **ShapeLibraryPanel Memory Leak Prevention** — Comprehensive cleanup improvements
  - Added `isDestroyed` check to `open()` to prevent DOM access after destruction
  - Added null checks in `close()` for overlay and panel to handle edge cases gracefully
  - Store bound event handlers for proper removal in `destroy()`
  - Fixed method name in tests: `truncateName` (was incorrectly `_truncateName`)

### Changed
- **Dependencies Updated**
  - @types/node: 25.0.3 → 25.0.6
  - @babel/preset-env: 7.28.5 → 7.28.6
  - mediawiki/minus-x: 1.1.1 → 2.0.0 (PHP 8.4 compatible)
  - mediawiki/mediawiki-codesniffer: 41.0.0 → 49.0.0 (PHP 8.4 compatible)

### Tests
- **Test Count** — 9,376 tests passing (145 suites)
- **Coverage** — 95.16% statement, 85.17% branch, 93.52% function, 95.29% line
- Added comprehensive ShapeLibraryPanel test suite with 57 tests

---

## [1.5.5] - 2026-01-12

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

## [1.5.4] - 2026-01-12

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
  - All shadow properties (shadowColor, shadowBlur, shadowOffsetX/Y, shadowSpread) work correctly

### Changed
- **CanvasManager.js Refactored** — Reduced from 2,072 to 1,927 lines (now under 2K limit)
  - Removed deprecated fallback code and dead branches
  - No functionality changes, all tests passing

### Tests
- **Test Count** — 9,303 tests passing (144 suites)
- **Coverage** — 94.03% statement, 85.01% branch (target achieved!)
- Added 700+ new tests for edge cases across 7 modules

---

## [1.5.3] - 2026-01-09

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

## [1.5.2] - 2026-01-07

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

## [1.5.1] - 2026-01-07

### Fixed
- **Double-Headed Curved Arrow Rendering** — Fixed crossover artifact in double-headed curved arrows
  - Curved shaft path now correctly connects top-to-top and bottom-to-bottom between heads
  - Fixed vertex order issue caused by inverted perpendicular direction on backward-facing tail head
  - Both main path and shadow path render correctly without crossing
  - All three head types (pointed, chevron, standard) work correctly
- **Tail Width Control Visibility** — Tail Width control now properly hides when Arrow Ends is set to "Double"
  - Previously the control remained visible even though it had no effect
  - Properties panel now refreshes when arrow style changes
  - tailWidth is automatically reset to 0 when switching to double-headed mode

### Tests
- **Test Count** — 8,563 tests passing (146 suites)
- **Coverage** — 94.6% statement, 83.3% branch

---

## [1.5.0] - 2026-01-07

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
  - Added 6 new tests for image delegation

### Changed
- **Simplified Permissions** — Consolidated `createlayers` into `editlayers`
  - Removed redundant `createlayers` right
  - Users with `editlayers` can now create and edit layer sets
  - `managelayerlibrary` retained for future asset library feature

### Fixed
- **Layer Lock Now Works** — Fixed layer locking feature that was completely broken
  - Locked layers can no longer be dragged, resized, rotated, or deleted
  - Folder locking now affects all child layers
  - Added `isLayerEffectivelyLocked()` helper and 15 new tests

### Documentation
- Updated all documentation with current metrics
- Marked Layer Set List as implemented in YARON_FEEDBACK.md

### Tests
- **Test Count** — 8,551 tests passing (146 suites)
- **Coverage** — 94.6% statement, 83.3% branch

---

## [1.5.0-beta.4] - 2026-01-06
- Updated all documentation to reflect simplified permissions model
- Updated test count to 8,537 across all documentation files

### Tests
- **Test Count** — 8,537 tests passing (up from 8,522)
- Added 15 new tests for layer lock protection in `TransformController.test.js`

---

## [1.5.0-beta.3] - 2026-01-06

### Changed
- **"Edit Layers" → "Edit layers"** — Changed to sentence case per MediaWiki UI conventions
  - Updated i18n messages and all hardcoded fallback strings
  - Thank you to Yaron Koran for the feedback
- **Wikitext Parameter Renamed** — `layerset=` is now the primary parameter for displaying layers in wikitext
  - `layerset=on` is now the preferred syntax (e.g., `[[File:Example.jpg|layerset=on]]`)
  - `layers=` and `layer=` remain fully supported for backwards compatibility
  - All existing wikitext using `layers=` will continue to work unchanged
  - Updated regex patterns to match `layerset=`, `layers=`, and `layer=`
  - Thank you to Yaron Koran for suggesting this improvement
- **Simplified Permissions** — Consolidated `createlayers` into `editlayers`
  - Removed redundant `createlayers` right
  - Users with `editlayers` can now create and edit layer sets (previously required both rights)
  - `managelayerlibrary` retained for future asset library feature
  - Simpler permission model per community feedback

### Fixed
- **Layer Lock Now Works** — Fixed layer locking feature that was completely broken
  - Locked layers can no longer be dragged, resized, or rotated
  - Locked layers can no longer be deleted via keyboard (Delete/Backspace) or panel button
  - Folder locking now affects all child layers — if a folder is locked, all layers inside are effectively locked
  - Added `isLayerEffectivelyLocked()` helper that checks both direct lock and parent folder lock
  - Added 15 new tests for lock protection
  - Added i18n message `layers-layer-locked-warning` for lock feedback
- **New Layer Set Starts Blank** — Creating a new named layer set now starts with an empty canvas
  - Previously, new sets would retain layers from the previous set
  - Clearer UX: new sets are truly new, not copies
- **Console Warning Fix** — Changed `console.warn` to `mw.log.warn` in zoom handler for MediaWiki compliance

### Removed
- **Cancel Button** — Removed redundant Cancel button from toolbar
  - The X close button already provides this functionality
  - Simplifies the interface per community feedback
- **Redundant Shapes from Custom Shape Tool** — Removed 4 shapes that duplicate existing dedicated tools:
  - `geometric/pentagon`, `geometric/hexagon`, `geometric/octagon` — Use the Polygon tool instead (can create any n-sided polygon)
  - `symbols/star` — Use the dedicated Star tool instead
  - Geometric shapes remaining: triangle, triangle-right, cross, trapezoid, parallelogram

### Improved
- **Drag Performance** — Fixed canvas sluggishness when dragging layers
  - Moved `emitTransforming()` inside `requestAnimationFrame` callback in `TransformController.handleDrag()`
  - Now matches the optimized pattern used by resize and rotation handlers
  - Eliminates redundant UI updates during rapid mouse movements

### Documentation
- Added `docs/YARON_FEEDBACK.md` documenting community feedback for future improvements
- Updated `docs/WIKITEXT_USAGE.md` with new `layerset=` syntax
- Updated `.github/copilot-instructions.md` with new parameter documentation
- Updated wiki files with new syntax examples

### Tests
- **Test Count** — 8,537 tests passing
- Added 15 new tests for layer lock protection in `TransformController.test.js`
- Updated `ShapeLibraryData.test.js` to reflect removed shapes

---

## [1.4.9] - 2026-01-05

### Fixed
- **LayerRenderer Memory Leak** — Added LRU cache eviction to `_imageCache` with 50 entry limit
  - Previously unbounded Map would grow indefinitely with image layers
  - Cache now evicts oldest entries when limit exceeded, using Map iteration order for LRU semantics
  - 2 new tests for cache eviction and entry refresh behavior
- **CanvasManager Async Race Condition** — Added `isDestroyed` flag to guard async callbacks
  - `handleImageLoaded` now returns early if component was destroyed during image load
  - Prevents "setting property of null" errors after editor close
  - 3 new tests for isDestroyed flag initialization and behavior
- **SelectionManager Infinite Recursion** — Added visited Set to `_getGroupDescendantIds()`
  - Prevents stack overflow when circular group references exist (corrupted data)
  - 2 new tests for circular and self-referencing group edge cases
- **Export Filename Sanitization** — Added `sanitizeFilename()` helper in APIManager
  - Removes Windows-forbidden characters: `< > : " / \ | ? *`
  - Strips control characters and leading/trailing dots/whitespace
  - Truncates to 200 characters, preserves user-provided extensions
  - 6 new tests for sanitization edge cases
- **LayerPanel Event Listener Accumulation** — Converted direct listeners to event delegation
  - Moved keyboard reordering (ArrowUp/Down on grab area) from LayerListRenderer to LayerItemEvents
  - Moved folder expand/collapse click from LayerListRenderer to LayerItemEvents
  - Prevents listener accumulation when layer items are recreated during re-render
  - Event delegation uses single listener on container instead of per-item listeners
  - 5 new tests for delegation behavior
- **APIManager Request Race Condition** — Added request tracking with auto-abort for API calls
  - `loadRevisionById` and `loadLayersBySetName` now abort pending requests of same type
  - Prevents out-of-order response handling when users switch sets/revisions quickly
  - Uses `pendingRequests` Map to track jqXHR by operation type
  - Aborted requests are silently ignored instead of showing error notifications
  - 6 new tests for request tracking and abort behavior
- **State Mutation Pattern** — Fixed in-place array mutation in LayersEditor and LayerSetManager
  - Changed `namedSets.push(...)` to immutable pattern `[...existingNamedSets, newSet]`
  - Ensures state management with reference equality checks works correctly
- **CanvasManager Text Layer Bounds** — Added null checks for canvas context in text bounds calculation
  - `_getRawLayerBounds()` now returns fallback bounds when `this.ctx` is null
  - Prevents errors when called before canvas initialization or after destroy
  - 2 new tests for null context fallback behavior
- **LayerRenderer Sub-Renderer Cleanup** — Added proper cleanup for all 8 sub-renderers in `destroy()`
  - Calls `destroy()` on sub-renderers that have the method (shadowRenderer, arrowRenderer, etc.)
  - Nulls out all sub-renderer references to prevent memory leaks
  - 2 new tests for sub-renderer cleanup behavior
- **Layer Update Immutability** — Changed `updateLayer()` to use immutable update pattern
  - Creates new layer object and new array instead of mutating in place
  - Ensures state management with reference equality checks works correctly
  - 2 new tests for immutable update behavior
- **Zoom Animation Cleanup** — Reset zoom animation properties in CanvasManager `destroy()`
  - Clears `zoomAnimationStartTime`, `zoomAnimationStartZoom`, `zoomAnimationTargetZoom`
  - Prevents stale animation state after editor close
- **Revision Reload Notification** — Show user notification when revision list refresh fails
  - Changed silent failure to subtle warning notification
  - Added new i18n key `layers-revision-reload-failed`

### Improved
- **Background Opacity Performance** — Slider now uses `redrawOptimized()` for RAF-batched redraws
  - Prevents multiple synchronous redraws per frame during slider drag
- **Test Count** — 8,377 tests passing (up from 8,346), 39 new tests for bug fixes

---

## [1.4.8] - 2026-01-05

### Fixed
- **ContextMenuController Memory Leak** — Fixed memory leak where document event listeners were not removed when context menu was closed
  - Event handlers (`closeHandler`, `escHandler`) now stored as instance properties and properly cleaned up
  - Added cleanup in `closeLayerContextMenu()` method
  - 3 new tests added to verify memory leak prevention
- **ARCHITECTURE.md Mermaid Diagram** — Fixed parse error on GitHub caused by `style` node ID
  - Renamed node from `style["StyleController"]` to `styleCtrl["StyleController"]`
  - `style` is a reserved keyword in Mermaid syntax

### Improved
- **Magic Number Constants** — Consolidated mathematical constants into single source of truth
  - Added `MathUtils.MATH` namespace with `SCALE_EPSILON` (0.0001) and `INTEGER_EPSILON` (1e-9)
  - Removed duplicate constant definitions from `ShapeRenderer.js`, `PropertiesForm.js`, `LayerPanel.js`
  - `LayersConstants.MATH` now references `MathUtils.MATH` for backward compatibility
  - Updated `types/layers.d.ts` with Constants namespace definitions
- **Test Coverage Enhancement** — Added tests for MATH constant fallback branches
  - LayersConstants branch coverage improved from 30% to 65%
  - New tests verify fallback behavior when MathUtils unavailable
- **Mobile Responsive CSS** — Enhanced mobile experience with responsive breakpoints
  - Added 768px and 480px responsive breakpoints for toolbar
  - Touch device detection using `pointer: coarse` media query
  - 44px minimum touch targets for buttons (WCAG 2.5.5 compliant)
  - Scrollable toolbar with horizontal overflow on small screens
  - Compact layer panel on mobile (160px height on small screens)
- **Touch-Adaptive Selection Handles** — Selection handles now auto-size for touch devices
  - Added `SELECTION_HANDLE_SIZE_TOUCH` constant (14px, up from 8px for mouse)
  - `SelectionHandles` and `SelectionManager` detect touch devices via `pointer: coarse`
  - Larger handles make resize/rotate easier on tablets and phones
  - 11 new tests for touch detection and handle sizing
- **Collapsible Layer Panel (Mobile)** — Layer panel can now be collapsed on mobile to maximize canvas space
  - Added collapse/expand toggle button (visible only on screens ≤768px)
  - Collapsed state hides layer list and properties, showing only header
  - Proper ARIA attributes (`aria-expanded`, `aria-label`) for accessibility
  - Dark mode support for collapse button
  - 6 new tests for mobile collapse functionality
- **Mobile Keyboard Handling** — Text input now handles on-screen keyboard properly
  - Added Visual Viewport API integration to detect keyboard appearance
  - Text input scrolls into view when keyboard would obscure it
  - Mobile-optimized input attributes: `inputmode`, `enterkeyhint`, `autocomplete`
  - Input auto-capitalizes sentences for better mobile UX
  - 9 new tests for keyboard handling
- **Test Count** — 8,340 tests passing (up from 8,304)

---

## [1.4.7] - 2026-01-05

### Fixed
- **Template Images Not Displaying on File Pages (GitHub issue #34 regression)** — Removed overly restrictive Content Security Policy from file description pages
  - The CSP was blocking template images from Commons (e.g., `File:Ambox important.svg` used in Information/Imbox templates)
  - The CSP only included the main file's origin but not other foreign origins used by templates on the page
  - CSP is now only applied in the editor action (`?action=editlayers`) where it's properly scoped
  - File description pages now rely on MediaWiki's site-wide CSP configuration

---

## [1.4.6] - 2026-01-05

### Added
- **TIFF Image Support** — Full support for TIFF format images in the editor and viewer
  - TIFF files are now correctly identified and loaded using MediaWiki thumbnail URLs
  - `ImageLoader.js` detects non-web formats (TIFF, BMP, etc.) and automatically uses `Special:Redirect/file` with width parameter
  - Background images render correctly for TIFF files in both editor and article pages
- **SHA1 Fallback Lookup** — Added `findSetSha1()` method in `LayersDatabase.php` to find layer sets saved before InstantCommons support was added
  - Handles migration scenarios where SHA1 format changed from empty to `foreign_` prefix
  - API endpoints now gracefully fall back to stored SHA1 when expected SHA1 doesn't match

### Fixed
- **Foreign File Delete/Rename Failing** — Fixed `ApiLayersDelete.php` and `ApiLayersRename.php` to not require local wiki page existence for foreign files
  - Changed validation from `$title->exists()` to `$title->getNamespace() !== NS_FILE`
  - Foreign files from InstantCommons don't have local pages, so the old check always failed
- **Delete Confirmation Dialog Button Label** — Added missing `layers-delete` i18n key for the confirmation dialog button
- **CanvasRenderer TIFF Support** — Enhanced `getImageFormat()` to detect TIFF files from both extension and MIME type

---

## [1.4.5] - 2026-01-05

### Added
- **InstantCommons/Foreign File Support** — Full support for files from Wikimedia Commons and other foreign repositories (GitHub issue #34)
  - Foreign files (ForeignAPIFile, ForeignDBFile) are now detected and handled correctly
  - Added `isForeignFile()` detection method across all 11 PHP files that access layer data
  - Added `getFileSha1()` helper that generates stable fallback identifiers (`foreign_` + sha1(filename)) for files without SHA1
  - Editor now uses `Special:Redirect/file` URLs to load foreign images, avoiding CORS issues with direct Commons URLs
  - Layer sets can be saved, loaded, renamed, and deleted for foreign files
  - All database operations use consistent fallback SHA1 for foreign files
  - Affected files: `ApiLayersInfo.php`, `ApiLayersSave.php`, `ApiLayersDelete.php`, `ApiLayersRename.php`, `LayerInjector.php`, `ThumbnailProcessor.php`, `LayeredFileRenderer.php`, `ImageLinkProcessor.php`, `Hooks.php`, `LayersFileTransform.php`, `ThumbnailRenderer.php`, `EditLayersAction.php`, `WikitextHooks.php`
- **Dynamic CSP for Foreign Files** — Content Security Policy is dynamically updated to include foreign file origins (e.g., `https://upload.wikimedia.org`) when editing foreign files, allowing the editor to load images without CSP violations

### Fixed
- **Foreign file layerslink URL generation** — For foreign files from InstantCommons, the `layerslink=editor` parameter now correctly generates local File: page URLs with `action=editlayers` rather than potentially broken foreign file title URLs
- **Special:Redirect/file URL generation** — Fixed `EditLayersAction::getLocalRedirectUrl()` to use `$file->getName()` instead of `$title->getPrefixedDBkey()` to avoid including the "File:" namespace prefix which broke the redirect URL
- **Filename normalization in wikitext parsing** — Fixed `WikitextHooks.php` to normalize filenames (spaces to underscores) when building the queue for `layers=` and `layerslink=` parameters, ensuring consistent queue lookups
- **MediaWiki 1.44 Title class namespace** — Fixed `ThumbnailProcessor.php` to use `MediaWiki\Title\Title` namespace for MW 1.44+ compatibility

---

## [1.4.4] - 2026-01-04

### Fixed
- **FR-10 Live Preview: Duplicate layer rendering after save** — After saving layers in the editor, both old and new layer sets would render simultaneously on the article page until refresh. Fixed by properly removing the canvas element from the DOM in `LayersViewer.destroy()`.
- **FR-10 Live Preview: Base image not visible after save** — After saving layers, the base image would become invisible while layers rendered correctly. Fixed by:
  - Storing and restoring original image visibility/opacity styles in `LayersViewer`
  - Clearing the FreshnessChecker sessionStorage cache on save to ensure fresh API data is fetched
  - Re-applying background settings after image load completes
  - Adding fail-safe to show image when no layer data is present
- **FR-10 Live Preview: Stale layer data after save** — The sessionStorage cache in FreshnessChecker could return stale revision info, causing reinitializeViewer to be skipped. Fixed by clearing the cache in `APIManager.handleSaveSuccess()`.
- **Cache invalidation timing** — Changed server-side cache invalidation from deferred to synchronous execution in `ApiLayersSave.php` to prevent race conditions where users navigate before cache purge completes.

---

## [1.4.3] - 2026-01-03

### Added
- **Draggable Callout Tail** — Callout tail can now be positioned by dragging the tip directly on the canvas
  - Tail tip position stored in local coordinates for proper rotation support
  - Tail can attach to any edge (top, bottom, left, right) or corner arc
  - Purple handle appears when callout is selected for easy tail repositioning
  - Throttled rendering for smooth drag performance
- **Tail Styles** — Three tail style options for callouts: triangle (default), curved, and line
  - Triangle: Classic speech bubble pointer
  - Curved: Smooth quadratic Bézier curves for organic look
  - Line: Simple single-line pointer
  - Styles work correctly on both straight edges and rounded corners

### Fixed
- **B Key Shortcut Mapping** — The `B` key now correctly selects the Callout tool (was incorrectly mapped to Blur tool)
- **Console.error Security Issue** — Replaced `console.error` with `mw.log.error` in CalloutRenderer.js error handling to follow MediaWiki security best practices (prevents potential information disclosure in production)
- **Corner Arc Tail Rendering** — Tail now renders correctly when positioned on rounded corners
  - Proper angle normalization ensures symmetric behavior at all four corners
  - Arc splitting algorithm correctly handles all tail positions along corner radii
  - No more visual artifacts (gaps, double tails, or misaligned segments)
- **Tail Style on Corners** — Line and curved tail styles now render correctly when tail is on a corner arc (previously defaulted to triangle)

---

## [1.4.2] - 2026-01-02

### Fixed
- **Vector 2022 Dark Mode Compatibility** — Editor now fully supports Vector 2022 skin's night mode (GitHub issue)
  - Added comprehensive dark mode styles for the entire editor UI (toolbar, layer panel, properties panel, dialogs, canvas area)
  - Follows MediaWiki's recommended approach using both class-based selectors (`html.skin-theme-clientpref-night`) and media queries (`@media (prefers-color-scheme: dark)` with `html.skin-theme-clientpref-os`)
  - Uses CSS custom properties for consistent theming across all editor components
  - Updated `editor-fixed.css` with ~550 lines of dark mode CSS
  - Updated `presets.css` to use proper Vector 2022 night mode selectors
  - Updated `modal.css` and `LayersLightbox.css` for dark mode support
  - Dark theme uses professional dark colors: `#1a1a1a` (primary bg), `#27292d` (secondary), `#3a3d43` (tertiary), `#eaecf0` (text)
- **Text with apostrophes showing HTML entities after save** — Text containing apostrophes (e.g., "I'M HERE") would display as `I&apos;M HERE` after saving and reopening the editor. The issue was that `TextSanitizer.php` was calling `htmlspecialchars()` before storing text in the JSON database. HTML encoding should only happen at render time, not storage time. Fixed by removing the `htmlspecialchars()` call from `sanitizeText()`.
- **Wrong layer set displayed after editing via `layerslink=editor`** — When opening the editor via a `layerslink=editor` link for a specific layer set (e.g., `layers=anatomy`), then switching to edit a different set, saving, and closing, the article page would display the edited set instead of the set specified in the wikitext. Fixed `ApiFallback.js` to extract the `setname` from the `data-layers-intent` attribute and pass it to the API request.

### Added
- **Callout/Speech Bubble Tool** — New annotation layer type for creating chat bubbles and callouts
  - Rounded rectangle container with configurable corner radius
  - Triangular tail/pointer with 8 direction options (top, bottom, left, right, and corners)
  - Configurable tail position (0-1 along edge) and tail size (5-100px)
  - Full text support with alignment, font, and color controls
  - Supports all standard layer effects: fill, stroke, opacity, shadow, blur fill
  - Keyboard shortcut: `B`
  - 29 new tests in `CalloutRenderer.test.js`
  - New component: `resources/ext.layers.shared/CalloutRenderer.js`
- **Windows High Contrast Mode Support** — Full support for `@media (forced-colors: active)` across all CSS files
  - `editor-fixed.css`: Toolbar buttons, layer panel items, inputs, buttons, dialogs, canvas area, sliders, dropdowns
  - `LayersLightbox.css`: Lightbox overlay, close button, loading states, error display
  - `modal.css`: Modal overlay, header, title, close button, iframe border
  - `presets.css`: Preset dropdowns, menu items, swatches, actions, dividers
  - Uses system colors (ButtonText, Highlight, Canvas, etc.) for automatic adaptation to user's color scheme
  - Added WCAG 1.4.11 Non-text Contrast (AA) compliance to ACCESSIBILITY.md
- **Color Picker Hex Input** — Keyboard-accessible hex color input alongside the native color picker
  - Users can type hex values directly (e.g., `#FF5500`) without using mouse
  - Auto-adds `#` prefix when typing without it
  - Real-time validation with visual feedback for invalid values
  - Syncs bidirectionally with native color picker for consistent UX
  - Live preview updates as you type valid colors
  - Proper ARIA labels and keyboard focus management
  - 11 new tests for hex input functionality

### Removed
- **Blur Tool** — The standalone blur tool (`B` shortcut) has been removed as redundant
  - Blur fill (`fill: 'blur'`) on any shape provides the same functionality with more flexibility
  - Use any shape (rectangle, circle, ellipse, polygon, star, arrow) with `fill: 'blur'` instead
  - Blur fill supports strokes, rounded corners, shadows, and rotation that the blur tool lacked
  - The `B` keyboard shortcut is now available for future use

### Added
- **Toolbar Dropdown Grouping** — Reorganized the toolbar using dropdown menus for better scalability
  - Text tools grouped: Text, Text Box
  - Shape tools grouped: Rectangle, Circle, Ellipse, Polygon, Star
  - Line tools grouped: Arrow, Line
  - Most recently used tool in each group is shown as the visible button
  - MRU persisted in localStorage across sessions
  - Full keyboard navigation support (Arrow keys, Home, End, Escape)
  - 35 new tests in `ToolDropdown.test.js`
  - New component: `resources/ext.layers.editor/ui/ToolDropdown.js`

---

## [1.4.1] - 2026-01-01

### Fixed
- **Real-time property panel updates** — Transform values (x, y, width, height, rotation) now update in the properties panel immediately during drag/resize/rotate operations
  - Fixed event dispatch/listen target mismatch: `editor.container` was undefined (property was `containerElement`)
  - Added `container` getter on LayersEditor that aliases to `containerElement` for backward compatibility
  - Changed `emitTransforming` to dispatch synchronously instead of throttled via requestAnimationFrame
  - Reordered event/render flow in handleDrag to emit BEFORE renderLayers for immediate UI updates
- **Curved arrow control point during drag** — Control point (`controlX`, `controlY`) now moves with the arrow when dragging, maintaining curve shape
- **Arrow head shadow with spread** — Arrow heads now included in shadow spread calculations for curved arrows via `_buildHeadVertices()`
- **Decimal places in property fields** — Properties panel now displays whole numbers instead of excessive decimal precision (e.g., `123` instead of `123.456789`)

---

## [1.4.0] - 2025-12-31

### Added
- **Live Color Picker Preview (FR-9)** — Canvas now updates in real-time as colors are selected in the color picker, matching professional editor UX
  - ColorPickerDialog tracks original color for cancel restoration
  - Preview updates on swatch selection and custom color input
  - Original color restored when user cancels or presses Escape
  - ToolbarStyleControls applies preview to selected layers without affecting undo history
- **Live Article Preview (FR-10)** — Layer changes now visible on article pages immediately after saving, without needing to edit and save the wiki page
  - New `FreshnessChecker.js` module compares inline revision with API
  - ViewerManager automatically detects and refreshes stale viewers
  - ThumbnailProcessor embeds revision metadata (`data-layer-revision`, `data-layer-setname`, `data-file-name`)
  - 30-second sessionStorage cache prevents excessive API calls
  - 45 new tests for FreshnessChecker (33) and ViewerManager FR-10 integration (12)
- **Curved Arrows (FR-4)** — Arrows now support curved paths via draggable control point
  - Purple circular control handle at arrow midpoint enables curve shaping
  - Quadratic Bézier curves with tangent-following arrow heads
  - Works with all arrow head types (pointed, chevron, standard)
  - Single and double-headed curved arrows supported
  - `controlX`, `controlY` properties added to layer data model
  - 27 new tests (18 ArrowRenderer + 6 SelectionRenderer + 3 ResizeCalculator)

### Changed
- **Test count** — 7,923 tests (136 suites, all passing)
- **ESLint config** — Added underscore-prefix pattern (`_paramName`) for intentionally unused parameters
- **ESLint-disable comments** — Reduced from 13 to 8 by using underscore convention instead of inline disables

### Fixed
- **Curved arrow scaling bug** — Control point (`controlX`, `controlY`) was not scaled in `LayersViewer.scaleLayerCoordinates()`, causing dramatic distortion when viewing curved arrows on scaled images
- **Curved arrow blur fill** — Blur fill (frosted glass effect) was not working for curved arrows in `ArrowRenderer.drawCurved()` — now properly calls `effectsRenderer.drawBlurFill()`
- **PHP line endings** — Fixed CRLF line endings in 14 PHP files (auto-fixed with phpcbf)

### Improved
- **Accessibility: Reduced Motion Support** — Added `@media (prefers-reduced-motion: reduce)` to respect user motion preferences (WCAG 2.3.3)
  - `editor-fixed.css`: Disables slide-in animation, removes all toolbar/button transitions
  - `LayersLightbox.css`: Disables fade transitions, stops spinner animation
  - `presets.css`: Disables dropdown/button transitions
  - Updated ACCESSIBILITY.md to mark item #8 as resolved
- **Developer onboarding** — Updated DEVELOPER_ONBOARDING.md with accurate line counts for all key modules
- **ToolbarStyleControls coverage** — Added 5 new tests for destroy, fallback paths, and context-aware mode
- **PropertiesForm coverage** — Branch coverage improved from 72.41% → 81.69% (+9.28pp)
  - Added 5 tests for folder/group layer properties panel
  - Added test for formatOneDecimal NaN edge case
- **FolderOperationsController coverage** — Branch coverage improved from 72.56% → 88.49% (+15.93pp)
  - Added 10 tests for default fallbacks, callback invocation, missing managers
  - 100% statement and function coverage now achieved
- **LayerItemFactory coverage** — Function coverage improved from 71.42% → 100%
  - Added 5 tests for createFolderIconFallback and default callbacks
  - Statement coverage improved 97.58% → 98.79%
- **SmartGuidesController coverage** — Branch coverage improved from 70.55% → 76.64%
  - Added 8 tests for getLayerBounds, text/arrow bounds, edge cases
- **GeometryUtils coverage** — Branch coverage improved from 72.09% → 85.27% (+13.18pp)
  - Added 10 tests for textbox, image, path fallbacks, and edge cases
- **ContextMenuController coverage** — Branch coverage improved from 74% → 80% (+6pp)
  - Added tests for Escape key handling and inside-click behavior
- **TypeScript definitions** — Updated `types/layers.d.ts` to v1.4.0 with comprehensive property coverage
  - Added ArrowProperties: `controlX`, `controlY` (curved arrows), `arrowhead`/`arrowHeadType` aliases
  - Added StarProperties: `innerRadius`, `outerRadius`, `pointRadius`, `valleyRadius`
  - Added BlurProperties: `blurRadius`, `_previousFill` (frosted glass effect)
  - Added GroupProperties: `children`, `expanded`, `parentGroup`
  - Extended PathProperties: `sides`, `startAngle`, `endAngle` (polygon support)

---

## [1.3.2] - 2025-12-31

### Added
- **Release Guide** — New `docs/RELEASE_GUIDE.md` with comprehensive checklist to prevent missed documentation updates

### Documentation
- Updated all documentation for release consistency
- Wiki documentation synchronized with main repo

---

## [1.3.1] - 2025-12-31

### Fixed
- **ToolRegistry textbox tool registration** — Added missing textbox tool to `registerDefaultTools()` for consistency with Toolbar
- **PHP code quality** — Fixed ALL PHP warnings (45 → 0)
  - Fixed 29 source file warnings (line length, comment placement, variable naming)
  - Fixed 16 test file warnings (inline comments, line length, indentation, duplicate class)
  - All files now pass phpcs with 0 errors and 0 warnings

### Added
- **localStorage color validation** — ColorPickerDialog now validates saved colors from localStorage, filtering out malformed data
- **Folder tip i18n message** — Added `layers-folder-empty-tip` for localized folder help text

### Changed
- **PropertiesForm debounce** — Number inputs now use 100ms debounce to reduce render thrashing during rapid value changes
- **PropertiesForm DOM methods** — Replaced innerHTML usage with DOM methods (createElement/textContent) for folder tip display
- **Test count** — 7,711 tests (135 suites, all passing)

---

## [1.3.0] - 2025-12-31

### Added
- **REL1_43 branch** — New LTS branch for MediaWiki 1.43.x with full feature parity
- **Deep linking documentation** — Added `layerslink` parameter guide to extension page
- **Branch selection guide** — Clear guidance for choosing the right branch per MW version
- **$wgEditPageFrameOptions documentation** — Required setting for `layerslink=editor-modal`

### Changed
- **Extension page updated** — Now shows MW 1.39+ support with branch selection table
- **LTS strategy updated** — REL1_39 now covers MW 1.39-1.42 only (community maintained after EOL)

### Documentation
- Wikitext-Syntax.md — Added iframe configuration warning for modal mode
- Configuration-Reference.md — New "MediaWiki Core Settings" section
- All wiki docs updated with new branch structure

---

## [1.2.18] - 2025-12-30

### Added
- **17 new GroupManager edge case tests** — Coverage improved from 84.9% → 89.1% statement, 69.3% → 75.1% branch
  - Lazy getter resolution from editor
  - Max nesting depth rejection
  - Max children per group limit
  - Group bounds calculation with empty groups
  - getLayerBounds fallback behavior
  - getTopLevelLayers functionality

### Changed
- **Test count increased** — 7,671 → 7,688 tests (all passing)
- **Rating improved** — 8.75/10 → 9/10 (architecture diagrams recognized as complete)

### Documentation
- **P2.2 Architecture Diagram marked complete** — ARCHITECTURE.md already contains 9 comprehensive Mermaid diagrams with ASCII fallbacks
- **codebase_review.md updated** — ESLint disable table corrected (was outdated), GroupManager coverage added
- **improvement_plan.md updated** — Accurate progress tracking, P2.2 completed

### Quality
- All 135 test suites passing
- 94.1% statement coverage, 82.5% branch coverage
- Zero TODO/FIXME/HACK comments
- 13 eslint-disable comments (below <15 target)

---

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
