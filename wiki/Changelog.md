# Changelog

Version history for the Layers extension.

---

## Unreleased

### Added
- **Abort Handling Toggle** — Optional `$wgLayersRejectAbortedRequests` (or `editor.config.rejectAbortedRequests`) surfaces aborted API requests as rejections for debugging. Default remains false to preserve legacy behavior.

### Fixed
- **API Error Handling** — Fixed bare `\Throwable` catch in ApiLayersDelete.php that swallowed `ApiUsageException`
- **Schema Cache Performance** — Added `schemaReadyResult` cache to LayersSchemaManager
- **Text Length Validation** — Changed `maxTextLength` from 500 to 10,000 to match server-side limit
- **Save Button Timer Leak** — Fixed `_scheduleTimeout` timer leak in APIManager.js `disableSaveButton()`
- **Multi-Selection Deletion** — Fixed `deleteSelectedLayers()` to operate on full selection array
- **ThumbnailProcessor Null Safety** — Fixed 4 `method_exists()` crashes when thumbnail is null
- **ThumbnailProcessor Undefined Variable** — Fixed `$file` scoping bug in `injectThumbnailLayerData()`
- **SlideNameValidator** — Fixed trailing hyphens not being trimmed; fixed consecutive spaces producing double hyphens
- **ESLint Error** — Fixed unused `backgroundImage` parameter in TransformationEngine

### Fixed (Tests)
- **ApiLayersSaveTest** — Complete rewrite: removed reflection on refactored methods, tests validators directly (12 tests)
- **ThumbnailProcessorTest** — Fixed mock helpers, parameter types, flag normalization assertions (29 tests)
- **ColorValidatorTest** — Fixed hex case and CSS4 #RGBA format expectations
- **SetNameSanitizerTest** — Fixed assertions for @/# character rejection
- **SlideNameValidatorTest** — Fixed PHPUnit 9.x method name
- **ServerSideLayerValidatorTest** — Fixed 3 test expectations
- **LayersParamExtractorTest** — Fixed 19 class/constant loading errors

### Removed
- **diagnose.php** — Removed diagnostic script (security risk; functionality covered by MediaWiki core)

### Technical Details
- Applies to APIManager abort handlers for revision and named set loading
- v27 code review: 3 CRITICAL + 6 HIGH issues fixed across 6 files
- PHP test suite: 0 failures (was 11), 549 tests, 765 assertions
- All 11,290 JS tests pass (165 test suites) ✅
- ESLint: 0 errors, phpcs: 0 errors

## Version 1.5.52 (February 5, 2026)

### Fixed
- **MediaWiki 1.39 Compatibility** — Fixed recurring 500 error on MW 1.39 installations:
  - Changed `use MediaWiki\Title\Title;` to `use Title;` (global namespace in MW 1.39)
  - Changed `use MediaWiki\Context\RequestContext;` to `use RequestContext;`
  - The MediaWiki\Title and MediaWiki\Context namespaces were introduced in MW 1.40

- **Dimension Tool Text Selection** — Fixed text selection when positioned outside extension lines
- **Dimension Tool Body Dragging** — Clicking on dimension line now only selects (no drag)

### Added
- **MW Compatibility Checker** — Enhanced pre-commit checks for MW version incompatibilities
- **Diagnostic Tool** — Added `diagnose.php` for troubleshooting server issues
- **Documentation** — Added MW 1.39 troubleshooting section

### Technical Details
- All compatibility fixes verified via automated checker
- Fixes deployed to all three branches: main, REL1_43, REL1_39

---

## Version 1.5.51 (February 3, 2026)

### Fixed
- **Documentation Sync** — Fixed version number mismatches and file counts:
  - Mediawiki-Extension-Layers.mediawiki branch table showed 1.5.49
  - docs/ARCHITECTURE.md showed 1.5.49 and incorrect file counts
  - Updated to correct counts: 140 JavaScript files, 40 PHP files

### Technical Details
- Comprehensive v13 code review completed
- All 11,254 tests pass (165 test suites) ✅
- 95.19% statement coverage, 84.96% branch coverage

---

## Version 1.5.50 (February 3, 2026)

### Improved
- **Unified Dimension Text Drag** — Dimension text now acts as a CAD-style drag handle
- **Arrow Position Control** — Dimension arrows can now point inside or outside

### Technical Details
- All 11,254 tests pass (165 test suites) ✅

---

## Version 1.5.49 (February 2, 2026)

### Fixed
- **Font Size Floating Toolbar** — Fixed regression where changing font size via floating toolbar didn't persist
- **Nested Span Cleanup** — Added `_removeFontSizeFromFragment()` to clean up nested font-size spans
- **Toolbar Sync** — Font size input no longer jumps back when using +/- buttons

### Added
- **Highlight Toggle** — Clicking highlight on already-highlighted text now removes the highlight
- **Cursor-Only Formatting** — Toggle formats (bold, italic, etc.) now set typing state for next characters when cursor is placed but no text selected

### Technical Details
- 11,254 tests passing (165 suites)
- 95.44% statement, 85.20% branch coverage
- InlineTextEditor.js: +45 lines for toggle format and backgroundColor detection
- RichTextToolbar.js: +25 lines for `updateFromSelection()` method

---

## Version 1.5.48 (February 2, 2026)

### Performance Improvements
- **API Response Caching** — LRU cache for API responses with 5-minute TTL
- **Layer Rendering Cache** — Layer caching framework in CanvasRenderer
- **Render Optimization** — Hash-based change detection in RenderCoordinator

### Technical Details
- 11,157 tests passing (163 suites)
- APIManager: +82 lines for cache implementation
- CanvasRenderer: +118 lines for layer caching
- RenderCoordinator: +57 lines for hash detection

---

## Version 1.5.47 (February 2, 2026)

### Added
- **Self-Hosted Font Library** — 32 Google Fonts bundled as WOFF2 files (~2.5MB, 106 files)
- **Privacy-Respecting** — No external font requests to Google
- **Font Categories** — Sans-serif (14), Serif (6), Display (4), Handwriting (4), Monospace (4)
- **Font Download Script** — `node scripts/download-fonts.js` for static fonts

### Technical Details
- 11,157 tests passing (163 suites)
- 95.44% statement, 85.20% branch coverage
- Uses Google Webfonts Helper API for static fonts (not variable fonts)

---

## Version 1.5.46 (February 1, 2026)

### Fixed
- **Removed Redundant Text Textarea** — Textbox/callout layers no longer show text textarea in properties panel (use inline canvas editing instead)

### Documentation
- Documentation sync with correct metrics (11,157 tests, 95.44%/85.20% coverage)
- Version consistency fixes in copilot-instructions.md and ARCHITECTURE.md

### Technical Details
- 11,157 tests passing (163 suites)
- 95.44% statement, 85.20% branch coverage
- Point release for main, REL1_43, REL1_39

---

## Version 1.5.45 (February 1, 2026)

### Improved
- **Branch Coverage** — Increased from 84.96% to 85.20% across 7 test files

### Added
- 39 new tests across multiple files:
  - SlideController: 14 tests (branch: 73%→81%)
  - ContextMenuController: 6 tests (branch: 81%→89%)
  - CanvasRenderer: 9 tests
  - APIManager: 3 tests
  - StateManager: 3 tests
  - DraftManager: 2 tests
  - ImportExportManager: 2 tests

### Documentation
- **Complete Audit** — All 97 documentation files verified and synchronized
- **Metrics Correction** — Fixed test counts (11,112→11,157) and coverage values across all docs

### Technical Details
- 11,157 tests passing (163 suites)
- 95.44% statement, 85.20% branch coverage
- Point release for main, REL1_43, REL1_39

---

## Version 1.5.44 (January 31, 2026)

### Fixed
- **MED-2: ToolDropdown Event Listeners** — Added proper tracking and cleanup for event listeners
- **MED-8: Logger Consistency** — Replaced LoggerFactory calls with $this->getLogger()

### Documentation
- **Comprehensive Audit** — Verified and updated all 97 documentation files
- **improvement_plan.md** — 16 of 18 P2 issues now resolved
- Multiple wiki and docs files updated with correct version, date, and metric values

### Verified (No Changes Needed)
- MED-1, MED-6, MED-12, MED-14, MED-15, MED-17, MED-18 all verified as already correct

### Technical Details
- All 11,112 tests pass (163 test suites)
- 95.42% statement coverage, 85.25% branch coverage
- P2 issues: only MED-9 (database types) and MED-10 (god class extraction) remain

---

## Version 1.5.43 (January 31, 2026)

### Documentation
- **Metrics Synchronization** — Updated all documentation with correct metrics:
  - Coverage: 95.42% statement, 85.25% branch
  - Test count: 11,112 tests in 163 suites
  - God classes: 21 total (2 generated, 17 JS hand-written, 2 PHP)
  - PHP files: 42 files
- **README.md Fix** — Replaced unimplemented `lock=view` with implemented `noedit` parameter
- **CONTRIBUTING.md Fix** — Updated from outdated 92.59%/9,967+ to current 95.42%/11,112

### Technical Details
- All 11,112 tests pass (163 test suites)
- 95.42% statement coverage, 85.25% branch coverage
- No functional changes; documentation-only release

---

## Version 1.5.42 (January 31, 2026)

### Security
- **P1.1: Race Condition in saveLayerSet()** — Moved named set limit check inside transaction with FOR UPDATE lock
- **P1.2: Missing Permission Check** — Added `checkUserRightsAny('read')` to ApiLayersList
- **P2.8: Missing Rate Limiting** — Added `pingLimiter('editlayers-list')` to ApiLayersList

### Added
- **$wgLayersMaxComplexity** — Configurable complexity threshold (default 100) (P3.12)

### Fixed
- **P2.1: isComplexityAllowed() Incomplete** — Expanded to all 15 layer types with proper complexity scoring
- **P2.10: paths Array Validation** — Added 100-path maximum limit to prevent DoS
- **P2.5: Raw SQL Fragments** — Refactored listSlides() correlated subqueries to batch queries

### Technical Details
- All 11,112 tests pass (163 test suites)
- All P1 HIGH priority security issues now resolved
- P2 issues reduced from 9 open to 5 open
- P3 issues: 9 resolved, 3 open

---

## Version 1.5.41 (January 30, 2026)

### Security
- **SVG Entity Encoding Bypass** — Extended entity decoding to all SVG security checks
- **vbscript: URL Blocking** — Added explicit blocking of vbscript: URLs

### Added
- **LayersConstants.php** — Central constants file for magic strings
- **Total Points Validation** — MAX_TOTAL_POINTS (10,000) aggregate limit
- **SVG Security Tests** — 5 new PHPUnit tests for entity-encoded bypasses

### Fixed
- **Documentation Metrics** — Corrected god class count (17→18) and test count across 10 files

### Refactored
- SetNameSanitizer and SlideHooks now use LayersConstants

---

## Version 1.5.40 (January 30, 2026)

### Fixed
- **P0: TailCalculator Bounds Check** — Fixed failing test by adding early return when tip is inside rectangle
- **P1: ApiLayersList.getLogger() Bug** — Removed erroneous method call on LayersLogger
- **P2: N+1 Query in getNamedSetsForImage()** — Rewrote with batch query
- **P2: N+1 Query in listSlides()** — Refactored with collect→batch→merge pattern
- **P2: LIKE Query Wildcard Escaping** — Changed to proper `buildLike()` method
- **P2: Slides-in-Tables Display Bug** — Fixed retry filter for `undefined` init status

### Improved
- **Drag Handle Hit Areas** — Added 4px hit tolerance for easier clicking
- **Overlay Button Size** — Reduced from 32px to 26px for less visual intrusion
- **API Code Extraction** — Created `LayersApiHelperTrait` for shared API logic
- **Window Load Fallback** — Added fallback for slides appearing after DOMContentLoaded

### Technical Details
- All 11,112 tests pass (163 test suites)
- Test coverage: 95.42% statement, 85.25% branch
- All P0, P1, P2, and P3 priority items resolved

---

## Version 1.5.39 (January 29, 2026)

### Changed
- **God Class Reduction Initiative Complete** — Reduced hand-written god classes from 20 to 12 (40% reduction)
  - Extracted 12+ focused modules with clear single responsibilities
  - All remaining large files use proper delegation patterns

### Technical Details
- All 10,939 tests pass (162 test suites)
- Test coverage: 94.65% statement, 84.49% branch
- 139 JavaScript files (~94,137 lines)
- Documentation fully synchronized with current metrics

---

## Version 1.5.38 (January 29, 2026)

### Fixed
- **Double Text Rendering During Inline Editing** — Fixed bug where changing alignment while inline editing textbox caused double rendering
  - Root cause: `richText` wasn't cleared alongside `text` in `_applyFormat()` for textbox layers
  - Also fixed `updateLayer()` to keep text/richText cleared during inline editing
- **Text Loss During Inline Editing** — Fixed bug where changing properties (like vertical alignment) while inline editing a textbox would lose all typed text
  - Added `getPendingTextContent()` method to retrieve current editor content without closing
  - Modified `LayersEditor.updateLayer()` to merge pending text content when inline editing is active
- **Vertical Alignment During Editing** — Fixed visual mismatch where text appeared at top during editing even when layer had `verticalAlign: middle`
  - Added flexbox CSS with `justify-content` to `_positionEditor()` matching the layer's `verticalAlign` property
- **Rich Text Inline Display** — Fixed bug where styled text runs displayed on separate lines during editing instead of inline
  - Added inner content wrapper div so flex has one block child, preserving inline text flow
- **Slide Layer Rendering Order** — Fixed layers appearing in reverse order on article pages using `{{#slide:}}` parser function
  - Now layers[0] (top in panel) is correctly drawn last (appears on top), matching editor behavior

### Technical Details
- All 10,939 tests pass (162 test suites)
- Test coverage: 94.65% statement, 84.49% branch, 92.93% function, 94.77% line
- God Class Reduction Initiative complete: reduced from 20 to 12 god classes
- ESLint passes on all modified files

---

## Version 1.5.36 (January 27, 2026)

### Added
- **Callout Inline Text Editing** — Callout layers now support double-click inline text editing with floating toolbar, matching textbox behavior
  - Added `_isMultilineType()` helper for consistent textbox/callout handling
  - Added 12 new tests for callout editing support

### Changed
- **Slide Parameter Simplification** — Replaced `lock=none|size|all` parameter with simpler `noedit` flag
  - `noedit` hides the edit overlay button for view-only slides
  - Removed complex lock mode logic from SlideHooks, ViewerManager, SlidePropertiesPanel

### Fixed
- **Slide Revision Loading** — Fixed "Revision not found" error when loading specific slide revisions
  - Changed API response key from `set_revisions` to `all_layersets` for JS compatibility
  - Added `layersetid` parameter support for slides

### Technical Details
- All 10,667 tests pass (157 test suites)
- Test coverage: 95.86% statement, 85.40% branch, 93.99% function, 95.97% line
- Codebase review v42 completed

---

## Version 1.5.35 (January 26, 2026)

### Fixed
- **Slide Editor New Layer Set Selector** — Fixed issue where specifying a new (unsaved) layer set name via `layerset=X` would show 'default' in the dropdown instead of 'X'
  - Dropdown now shows the specified set name with a "(new)" suffix for unsaved sets
  - Added i18n message `layers-set-new-unsaved` for translatable "(new)" label
- **Version Inconsistencies (P0)** — Fixed version number mismatches across 6 project files
  - Added `scripts/update-version.js` to automate version synchronization
  - Added `npm run check:version` and `npm run update:version` commands

### Improved
- **Documentation Metrics** — Updated all stale metrics in documentation files
  - Test count: 10,643 tests in 157 suites
  - Coverage: 94.45% statement, 84.87% branch, 92.55% function, 94.59% line
  - JS files: 127, ~115,282 lines
  - PHP files: 40, ~14,388 lines
  - i18n messages: 697
- **Codebase Review v39** — Comprehensive critical review with all issues documented
  - 0 critical issues, 0 high issues, 5 medium issues, 10 low issues

### Also Includes (v1.5.32-1.5.34)
- **Critical: Slide `layerset=` Parameter Bug** — Fixed global regex stripping `|layerset=...` from `{{#slide:}}` parser functions
- **Slide Editor Parameter Handling** — Fixed PHP/JS property name mismatch (`setName` → `initialSetName`)
- **State Initialization** — Fixed hardcoded 'default' in `LayersEditor.initializeState()`
- **Safari Compatibility** — Added `-webkit-user-select: none` prefix

---

## Version 1.5.31 (January 25, 2026)

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

## Version 1.5.30 (January 25, 2026)

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
- All 10,626 tests pass (157 test suites)
- Test coverage: 94.19% statement, 84.43% branch, 92.19% function, 94.32% line
- ESLint/Stylelint/Banana all pass

---

## Version 1.5.29 (January 25, 2026)

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
- **Canvas Snap Trigger** — Fixed canvas snap not working during drag operations
- **Slide Editor i18n** — Added missing `special-editslide-title` message
- **PHP Error Return Types** — `countNamedSets()` and `countSetRevisions()` now return -1 on DB error

### Improved
- **StateManager Batching** — Replaced 8 sequential `set()` calls with 2 batched `update()` calls in APIManager
- **Clipboard Error Logging** — Added `mw.log.warn()` for clipboard API failures
- **PHP Code Quality** — Added `JSON_DECODE_MAX_DEPTH` constant to all PHP files using json_decode

### Technical Details
- All 10,613 tests pass (157 test suites)
- Test coverage: 94%+ statement, 84%+ branch
- ESLint/Stylelint/Banana all pass

---

## Version 1.5.28 (January 24, 2026)

### Fixed
- **Inline Text Editor: Text Duplication During Formatting** — Fixed bug where using the floating toolbar (font, bold, italic, alignment, etc.) during inline text editing caused text to appear twice with slight misalignment. Fix: Include editing state preservation in the changes object to maintain the hidden/cleared state during format changes.
- **Empty Slide Overlay** — Fixed missing edit overlay on empty slides. Changed `renderEmptySlide()` to use `setupSlideOverlay()` instead of deprecated `setupSlideEditButton()`.
- **Empty Slide i18n** — Added missing `layers-slide-empty` and `layers-slide-empty-hint` i18n messages.

### Technical Details
- All 10,207 tests pass (156 test suites)
- Test coverage: 92.96% statement, 83.27% branch

---

## Version 1.5.27 (January 24, 2026)

### Fixed
- **Slide Mode: Background Opacity Not Updating After Save** — Fixed bug where changing the background opacity slider in the slide editor would save correctly but not visually update on the article page until a hard refresh.
- **parseInt Radix Parameter** — Added explicit radix (10) to all 9 parseInt calls in ValidationHelpers.js and NumericValidator.js for robustness.

### Added
- **EmojiPickerPanel E2E Tests** — Added 17 Playwright E2E tests covering emoji picker functionality: opening/closing, panel structure, category navigation, search, emoji selection, and performance testing.
- **Error Handling Documentation** — Added comprehensive error handling guidelines to CONTRIBUTING.md with three documented patterns and clear rules.

### Technical Details
- All 9,994 tests pass (156 test suites)
- Test coverage: 92.96% statement, 83.27% branch

---

## Version 1.5.26 (January 23, 2026)

### Fixed
- **CORE-6: StateManager Dead Code** — Removed dead `undo()`, `redo()`, and `restoreState()` methods from StateManager. HistoryManager handles all undo/redo functionality.
- **CORE-7: StateManager Lock Timeout Recovery** — Added recovery check for stuck locks with logging.
- **CORE-9: HistoryManager Bounds Check** — Added defensive bounds check in `undo()` and `redo()` methods.
- **CORE-8: API Timeout Handling** — Verified already handled by mw.Api default timeout. Added missing i18n messages.

### Technical Details
- All 9,967 tests pass (156 test suites)
- Test coverage: 92.59% statement, 83.02% branch

---

## Version 1.5.25 (January 24, 2026)

### Fixed
- **Slide Mode: Slides Not Refreshing After Editor Close** — Fixed critical bug where slides required a full page refresh to see changes after closing the editor, unlike images which update immediately. Root cause: slides use `window.location.href` navigation to `Special:EditSlide` (full page navigation) while images use a modal editor. When the slide editor closes via `history.back()`, the browser restores the page from bfcache (back-forward cache), which does NOT re-execute JavaScript. Solution: added `pageshow` event listener in `init.js` that detects bfcache restoration (`event.persisted === true`) and calls `refreshAllViewers()`. Also updated `refreshAllSlides()` to refresh ALL slide containers without requiring the `layersSlideInitialized` property (which may be lost on bfcache restoration).

### Technical Details
- All 9,951 tests pass (155 test suites)
- Added 13 new tests for slide refresh functionality (ViewerManager: 11, init: 2)
- Test coverage: 93.52% statement, 83.89% branch
- ESLint/Stylelint/Banana all pass

---

## Version 1.5.24 (January 24, 2026)

### Fixed
- **SVG Custom Shapes: Dashed Placeholder Boxes on Article Pages** — Fixed custom SVG shapes (from Shape Library) displaying a visible dashed rectangle placeholder on article pages while the SVG loaded

### Added
- **Slide Mode: Special:Slides Management Page** — Added `Special:Slides` page for listing, searching, creating, and deleting slides
- **Slide Mode: Special:EditSlide Direct Editor Access** — Added `Special:EditSlide/SlideName` for direct slide editing
- **Slide Mode: SlideNameValidator** — Server-side validation for slide names
- **Slide Mode: API layerslist Endpoint** — New API module for listing slides with filtering and pagination

---

## Version 1.5.23 (January 22, 2026)

### Fixed
- **Slide Mode: Canvas Dimensions Not Persisting** — Fixed critical bug where canvas dimensions reverted to 800×600 after save/close/reopen
- **Slide Mode: View Icon Inconsistency** — Fixed the "view full size" icon on slides to match the fullscreen icon used on regular layered images
- **Slide Mode: LayersLightbox Not Available** — Fixed "LayersLightbox not available for slide view" error
- **Slide Mode: Edit Icon Mismatch** — Fixed edit (pencil) icon on slide overlays being different from image overlays
- **Slide Mode: Background Color Not Saving** — Fixed slide background color not persisting after save
- **Slide Mode: False Dirty State on Open** — Fixed editor prompting to save changes immediately after opening

---

## Version 1.5.22 (January 22, 2026)

### Fixed
- **Slide Mode: Canvas Size Not Applied** — Fixed critical bug where slides with `canvas=600x400` would always display as 800×600 in the editor
- **Slide Mode: Edit Button Always Visible** — Fixed the edit overlay on slides to only appear on hover

### Added
- **Slide Mode: View Full Size Button** — Added "View full size" button to slide overlays that opens the slide in LayersLightbox
- **ViewerManager Slide Overlay System** — New JavaScript-based overlay system for slides

---

## Version 1.5.21 (January 21, 2026)

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

---

## Version 1.5.20 (January 20, 2026)

### Added
- **Virtual Scrolling for Layer Lists (P2.1)** — Layer panel now uses virtual scrolling for lists with 30+ layers, dramatically improving performance and preventing browser slowdowns with large layer counts
  - DOM element recycling prevents memory issues
  - Automatic activation threshold at 30 layers
  - Smooth scroll performance maintained regardless of layer count

### Technical Details
- Created `VirtualLayerList.js` in `ext.layers.editor/ui` (381 lines)
- Integrated with `LayerListRenderer.js` for seamless activation
- 30 tests for VirtualLayerList (9,783 total tests, 153 suites)
- Test coverage: 93.52% statement, 83.89% branch

---

## Version 1.5.19 (January 20, 2026)

### Added
- **Shared IdGenerator Utility** — New centralized ID generation with monotonic counter guarantees unique layer IDs even during rapid operations (paste, duplicate, bulk imports)

### Improved
- **ViewerManager Error Tracking** — `refreshAllViewers()` now returns detailed result object `{refreshed, failed, total, errors}` instead of just a count

### Technical Details
- Created `IdGenerator.js` in `ext.layers.shared` with session counter + timestamp + random suffix
- Updated StateManager, APIManager, ToolManager, SelectionManager to use shared generator
- 13 new tests for IdGenerator
- 35 new tests for EmojiPickerPanel (9,753 total tests)
- Codebase review Audit v12 completed

---

## Version 1.5.18 (January 19, 2026)

### Fixed
- **Critical: Non-Existent Layer Set Handling** — Fixed production issue where `layerset=X` with a non-existent set name would not show the edit overlay, preventing new set creation from wikitext
  - **Edit overlay not initializing** — When layer set doesn't exist but intent was specified, the overlay now correctly shows with edit button
  - **PHP `data-layers-intent` for named sets** — Now correctly sets intent for custom set names (was only triggering for 'on'/'all')
  - **`autocreate=1` parameter passing** — Editor now receives flag to auto-create the layer set on first save
  - **`data-file-name` attribute injection** — PHP now sets filename attribute even when no layer data exists
  - **Filename sanitization** — Added defensive sanitization to strip bracket characters from filenames
  - **Modal URL parameter** — Fixed modal receiving object instead of URL string, which caused "invalid characters" error

### Technical Details
- Files modified: ThumbnailProcessor.php, ViewerManager.js, ViewerOverlay.js, ApiFallback.js
- Added `initializeOverlayOnly()` method to ViewerManager for cases where layer data doesn't exist
- Fixed intent detection in ThumbnailProcessor to allow any non-disabled layersFlag value
- 6 commits for this fix, thoroughly tested across all browsers

---

## Version 1.5.17 (January 19, 2026)

### Added
- **Collapsible Shadow Settings** — Drop shadow and text shadow settings are now hidden until enabled, reducing properties panel clutter

### Fixed
- **StateManager Exception Handling (HIGH)** — Added try-catch in unlockState() to prevent potential deadlock if callback throws
- **Missing mw Object Guard (MEDIUM)** — Added typeof check for `mw` object to prevent ReferenceError in Node.js/Jest environments  
- **Drawing RAF Callback Cleanup (MEDIUM)** — Fixed null reference errors after editor closure in CanvasManager
- **TransformController RAF Guards (MEDIUM)** — Added isDestroyed checks to prevent crashes during rapid editor close

---

## Version 1.5.16 (January 18, 2026)

### Added
- **Additional Font Support** — Added Courier, Georgia, Verdana, and Helvetica to the allowed fonts list

### Fixed
- **Font Not Saving in TextBox Layers** — Fixed issue where fonts (especially Courier) were silently rejected by server validation and fell back to Arial
- **Rotated Text Box Inline Editing** — The inline text editor now correctly rotates to match the layer's rotation angle
- **Layer Deselection When Editing Rotated Text** — Fixed issue where clicking elsewhere on canvas while editing a rotated text layer would not deselect it

---

## Version 1.5.15 (January 18, 2026)

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
- **Textbox Background Visibility** — Textbox layers now keep their background visible during inline editing
- **Font Selector Focus** — Fixed font dropdown closing immediately after opening
- **Color Picker Integration** — Color button now opens the full ColorPickerDialog with swatches and OK/Cancel buttons

---

## Version 1.5.13 (January 18, 2026)

### Added
- **Inline Canvas Text Editing** — Figma/Canva-style direct text editing on the canvas
  - Double-click any text or textbox layer to edit in place
  - HTML textarea overlay matches layer position, size, and styling
  - Real-time preview while typing
  - Keyboard shortcuts: Enter to confirm (text), Ctrl+Enter (textbox), Escape to cancel
  - Mobile keyboard optimization with Visual Viewport API support
  - Full Unicode and special character support

---

## Version 1.5.12 (January 17, 2026)

### Added
- **Emoji Picker** — New toolbar button opens a searchable emoji library with 2,817 Noto Color Emoji SVGs
  - Lazy-loaded SVG thumbnails using IntersectionObserver for performance
  - 19 well-organized categories: Smileys, Gestures, People, Animals, Nature, Food, Travel, Places, Weather, Sports, Entertainment, Objects, Hearts, Symbols, Zodiac, Arrows, Warnings, Household, Miscellaneous
  - Full-text search with descriptive names and keywords
  - Gradient colors preserved in SVG thumbnails
  - Lightweight index architecture: 196.7KB metadata, SVGs loaded on-demand

---

## Version 1.5.11 (January 17, 2026)

### Added
- **Expanded Shape Library** — 951 new shapes across 4 new categories:
  - IEC 60417 Symbols (735 shapes): International Electrotechnical Commission graphical symbols for equipment
  - ISO 7000 Symbols (198 shapes): Equipment and graphical symbols
  - GHS Hazard Pictograms (8 shapes): Chemical hazard warning pictograms
  - ECB Hazard Symbols (10 shapes): European chemical hazard symbols
  - Total library now contains **1,310 shapes** across **10 categories**

### Fixed
- **Shape Library Rendering** — Fixed critical bug where custom shapes failed to render
  - Root cause: ShapeLibraryData.js was overwriting the CustomShapeRenderer reference
  - Solution: Use Object.assign() to preserve existing properties
- **SVG Cleanup** — Sanitized 214 SVG files (~242KB saved)

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
- Added PHPUnit tests for LayersContinuationTrait (14 test methods)
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
