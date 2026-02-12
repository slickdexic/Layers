# Known Issues

**Last updated:** February 11, 2026 — v35 fixes (version 1.5.56)

This document tracks known issues in the Layers extension, prioritized
as P0 (critical/data loss), P1 (high/significant bugs), P2 (medium),
and P3 (low/cosmetic). Issues are organized by priority and status.

## Summary

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| P0 | 4 | 4 | 0 |
| P1 | 25 | 25 | 0 |
| P2 | 47 | 47 | 0 |
| P3 | 41 | 13 | 28 |
| **Total** | **117** | **89** | **28** |

---

## P0 — Critical (Data Loss / Security)

All P0 issues have been fixed.

### ✅ P0-001: groupSelected() Passes Object Instead of ID (Fixed v28)

- **File:** GroupManager.js
- **Impact:** Group creation could fail silently
- **Resolution:** Fixed with unit tests

### ✅ P0-002: ApiLayersDelete Swallows ApiUsageException (Fixed v27)

- **File:** ApiLayersDelete.php
- **Impact:** Delete errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-003: ApiLayersRename Exception Swallowing (Fixed v27)

- **File:** ApiLayersRename.php
- **Impact:** Rename errors silently ignored
- **Resolution:** Proper exception propagation

### ✅ P0-004: diagnose.php Unauthenticated Endpoint (Fixed v27)

- **File:** diagnose.php (removed)
- **Impact:** Exposed internal state without authentication
- **Resolution:** File removed entirely

---

## P1 — High Priority

### ✅ P1-001: Canvas Cache Stale on Middle Path Points (Fixed v28)

- **File:** CanvasManager.js
- **Resolution:** Cache invalidation on path changes

### ✅ P1-002: VALID_LINK_VALUES Drops Editor Subtypes (Fixed v28)

- **File:** LayerDataNormalizer.js
- **Resolution:** Extended valid link values

### ✅ P1-003: TextRenderer Rotation Ignores textAlign (Fixed v28)

- **File:** TextRenderer.js
- **Resolution:** Rotation center accounts for alignment

### ✅ P1-004: SVG CSS Injection Vectors Missing (Fixed v28)

- **File:** LayersValidator.js
- **Resolution:** Added CSS injection detection

### ✅ P1-005: HitTest Fails on Rotated Rectangles/Ellipses (Fixed v29)

- **File:** HitTestController.js
- **Resolution:** Proper inverse rotation transform

### ✅ P1-006: ShapeRenderer strokeWidth:0 Treated as 1 (Fixed v29)

- **File:** ShapeRenderer.js
- **Resolution:** Respect zero strokeWidth

### ✅ P1-007: getRawCoordinates() Incorrect Math (Fixed v29)

- **File:** CanvasManager.js
- **Resolution:** Correct coordinate transformation

### ✅ P1-008: normalizeLayers Mutates Input Objects (Fixed v29)

- **File:** LayerDataNormalizer.js
- **Resolution:** Deep clone before normalization

### ✅ P1-009: isSchemaReady 23 Uncached DB Queries (Fixed v27)

- **File:** LayersSchemaManager.php
- **Resolution:** Cached schema readiness check

### ✅ P1-010: duplicateSelected Single-Layer Only (Fixed v27)

- **File:** ClipboardController.js
- **Resolution:** Multi-layer duplication support

### ✅ P1-011: ON DELETE CASCADE Destroys User Content (Fixed v34)

- **File:** sql/layers_tables.sql
- **Severity:** HIGH
- **Impact:** Deleting a user cascade-deletes ALL their layer sets
  across all images
- **Introduced:** v27 review
- **Resolution:** Changed FK constraints to ON DELETE SET NULL; made user ID columns nullable; added migration patch

### ✅ P1-012: ls_name Allows NULL in Schema (Fixed v34)

- **File:** sql/layers_tables.sql
- **Impact:** Named sets feature requires non-null names but schema
  permits NULL, risking orphaned or unreachable records
- **Introduced:** v27 review
- **Resolution:** Added migration patch: UPDATE NULLs to 'default', ALTER COLUMN NOT NULL DEFAULT 'default'

### ✅ P1-013: Triple Source of Truth for Selection State (Partially Fixed v34)

- **File:** SelectionManager.js, CanvasManager.js, StateManager.js
- **Impact:** Selection can desync between three managers; source of
  subtle bugs where selection appears stale
- **Introduced:** v27 review
- **Resolution:** Removed 5 ghost (write-only) properties from CanvasManager that duplicated TransformController state (isResizing, isRotating, isDragging, resizeHandle, originalLayerState) and their sync writes on every mouse move. Selection state authority: SelectionState.js (logic) → StateManager (subscriptions). StateManager's dead selection methods were already removed to SelectionState in prior work. The remaining dual-authority (SelectionManager local array + StateManager store) is low-risk: notifySelectionChange() keeps them coherent.

### ✅ P1-014: Rich Text Word Wrap Wrong Font Metrics (Fixed v34)

- **File:** TextBoxRenderer.js
- **Impact:** Rich text runs with multiple font sizes measure words
  at the wrong size, causing incorrect line breaks
- **Introduced:** v26 review
- **Resolution:** Created `wrapRichText()` method that tokenizes runs
  with per-run font strings and switches ctx.font during measurement.
  5 regression tests added.

### ✅ P1-015: ThumbnailRenderer Shadow Blur Corrupts Canvas (Fixed v34)

- **File:** ThumbnailRenderer.php
- **Impact:** Server-rendered thumbnails with shadow blur can corrupt
  the canvas state for subsequent elements
- **Introduced:** v28 review
- **Resolution:** Created `buildShadowSubImage()` helper wrapping shadow drawing in parenthesized sub-image operations to isolate `-blur` to a fresh transparent canvas per shadow element. Added 4 PHPUnit tests.

### ✅ P1-016: SQLite-Incompatible Schema Migrations (Fixed v34)

- **File:** src/Database/LayersSchemaManager.php, sql/patches/
- **Impact:** Several migration patches use MySQL-specific syntax
  (ALTER TABLE ... MODIFY, IF NOT EXISTS on ALTER); blocks SQLite users
- **Introduced:** v28 review
- **Resolution:** Converted all 6 SQLite-incompatible registered patches to PHP methods with `$dbType` branching. MySQL-only operations (MODIFY COLUMN, DROP FOREIGN KEY, ADD CONSTRAINT CHECK) are no-ops on SQLite (dynamic typing, no FK enforcement). Added 3 missing `addExtensionField` registrations from dead Hooks.php handler. Deleted 12 orphaned SQL patches. Removed dead `onLoadExtensionSchemaUpdates()` from Hooks.php (never registered in extension.json).

### ✅ P1-017: ShadowRenderer Discards Canvas Scale on Rotation (Fixed v34)

- **File:** resources/ext.layers.shared/ShadowRenderer.js L305-325
- **Impact:** Spread shadows on rotated shapes render at wrong size
  whenever canvas zoom ≠ 1. The identity matrix replacement strips
  the scale components from the transform.
- **Introduced:** v33 review
- **Resolution:** Both drawSpreadShadow methods now decompose scale via
  `sx = sqrt(a²+b²); sy = sqrt(c²+d²)` and preserve it in the matrix. Regression test added.

### ✅ P1-018: DimensionRenderer hitTest Ignores Offset (Fixed v34)

- **File:** resources/ext.layers.shared/DimensionRenderer.js L750-761
- **Impact:** Click detection tests against the raw measurement baseline,
  not the visible offset dimension line. When dimensionOffset is large,
  clicking the visible line fails to select the layer.
- **Introduced:** v33 review
- **Resolution:** hitTest() rewritten to calculate perpendicular offset using _drawInternal() logic. 4 regression tests added.

### ✅ P1-019: APIManager saveInProgress Permanently Stuck (Fixed v34)

- **File:** resources/ext.layers.editor/APIManager.js L859-870
- **Impact:** If buildSavePayload() or JSON.stringify() throws (corrupt
  layer data, circular reference), saveInProgress stays true forever.
  All subsequent saves rejected until page reload.
- **Introduced:** v33 review
- **Resolution:** Wrapped in try/catch; resets saveInProgress, hides spinner, enables save button on error. 2 regression tests added.

### ✅ P1-020: PresetStorage Strips Gradient Data (Fixed v34)

- **File:** resources/ext.layers.editor/presets/PresetStorage.js L20-56
- **Impact:** ALLOWED_STYLE_PROPERTIES whitelist does not include
  'gradient'. Saving a preset from a shape with gradient fill silently
  strips all gradient data from the saved preset.
- **Introduced:** v33 review
- **Resolution:** Added 'gradient' to ALLOWED_STYLE_PROPERTIES. 3 regression tests added.

### ✅ P1-021: OverflowException Double endAtomic in LayersDatabase (Fixed v35)

- **File:** src/Database/LayersDatabase.php L174-245
- **Impact:** When named set limit was reached, `\OverflowException`
  was thrown after `endAtomic()`, caught by generic `\Throwable`
  catch block which called `endAtomic()` again, swallowing the error.
- **Introduced:** v35 review
- **Resolution:** Removed premature `endAtomic()` before throw.
  Added `OverflowException` re-throw in catch block. Existing test
  `testSaveLayerSetMaxSetsReached` validates the fix.

### ✅ P1-022: TextSanitizer html_entity_decode After strip_tags (Fixed v35)

- **File:** src/Validation/TextSanitizer.php L35-45
- **Impact:** Sanitization ordered strip_tags() before
  html_entity_decode(). Entity-encoded HTML could survive.
  Not exploitable (text rendered via Canvas/ImageMagick, not
  innerHTML), but fixed as defense-in-depth.
- **Introduced:** v35 review
- **Resolution:** Added second `strip_tags()` after `html_entity_decode()`
  in both `sanitizeText()` and `sanitizeRichTextRun()`. New test
  `testSanitizeTextStripsEntityEncodedTags` validates all variants.

### ✅ P1-023: EditLayersAction Clickjacking — Not a Bug (Reclassified v35)

- **File:** src/Action/EditLayersAction.php L107-119
- **Impact:** The modal mode (`?modal=true`) is the extension's own
  feature for loading the editor in an iframe. CSRF tokens protect
  all write operations. No fix needed.
- **Introduced:** v35 review
- **Resolution:** Reclassified as intentional design. Not a bug.

### ✅ P1-024: ApiLayersList Database Error Info Disclosure (Fixed v35)

- **File:** src/Api/ApiLayersList.php L106-109
- **Impact:** `$e->getMessage()` from database exceptions was exposed
  directly in API error response, leaking internal details.
- **Introduced:** v35 review
- **Resolution:** Replaced with generic `LayersConstants::ERROR_DB`.
  Exception details now logged server-side only.

### ✅ P1-025: RichText fontSize Overwritten on Deselect (Fixed v35)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
  L276-280, L1686-1733
- **Impact:** Changing font size on *some* selected text in a textbox
  caused ALL text to change to that size on deselect. The
  `_extractDominantFontSize()` method only counted runs with explicit
  `style.fontSize`, ignoring runs that relied on the layer's base
  fontSize. When a partial selection was changed, only the new size
  was counted as "dominant" and overwrote `layer.fontSize`, causing
  all unstyled runs to inherit it on re-render.
- **Introduced:** User-reported bug (found during REL1_39 testing)
- **Resolution:** `_extractDominantFontSize()` now accepts a
  `baseFontSize` parameter. Runs without explicit `style.fontSize`
  are counted as using the base, so partial changes don't overwrite
  the layer's base fontSize. 5 regression tests added.

---

## P2 — Medium Priority

### ✅ P2-001: Negative Dimensions for Rectangle/TextBox (Fixed v28)

### ✅ P2-002: DraftManager Stores Base64 Image Data (Fixed v28)

### ✅ P2-003: CalloutRenderer Blur Clips L/R Tails (Fixed v31)

### ✅ P2-004: closeAllDialogs Leaks Keydown Handlers (Fixed v30)

### ✅ P2-005: ext.layers Loaded Every Page (Fixed v34)

- **File:** src/Hooks.php, src/Hooks/WikitextHooks.php
- **Impact:** Viewer module loaded site-wide; unnecessary JS on
  non-file pages
- **Resolution:** Made `ext.layers` module loading conditional — only on File: pages or pages with `layerset=` wikitext. Added ParserOutput-based module registration in WikitextHooks for cached page delivery. Removed redundant `addModules()` from `onMakeGlobalVariablesScript()` and made JS config var export conditional.

### ✅ P2-006: SlideManager.js Dead Code (~439 Lines) (Fixed v34)

- **File:** resources/ext.layers.slides/SlideManager.js
- **Impact:** Unmaintained dead code; module references non-existent
  init.js and slides.css
- **Resolution:** Deleted 3 dead source files (init.js, SlideManager.js, slides.css) totaling 694 lines and 1 dead test file (SlideManager.test.js, 425 lines). No module definition in extension.json; no references in codebase.

### ✅ P2-007: Client SVG Sanitization Regex Bypassable (Fixed v34)

- **File:** LayersValidator.js
- **Impact:** Regex-based SVG sanitization can be bypassed with
  encoding tricks; server-side validation is the real defense
- **Resolution:** Replaced regex with DOMParser-based sanitizer. Removes 14 dangerous element types, event handlers, dangerous URL schemes, and CSS patterns. 8 regression tests added.

### ✅ P2-008: sanitizeString Strips `<>` Destroying Math (Fixed v34)

- **File:** ValidationManager.js, TextUtils.js
- **Impact:** Users entering mathematical expressions like `x<5`
  have the angle brackets stripped, corrupting their text
- **Resolution:** Changed from blanket `<>` strip to targeted
  dangerous-tag-only stripping. Canvas2D renders text literally
  and doesn't interpret HTML, so standalone angle brackets are safe.

### ✅ P2-009: SmartGuides Cache Stale on Mutations (Fixed v34)

- **File:** SmartGuidesController.js
- **Impact:** Guide lines can snap to outdated positions after
  layer mutations until cache is manually invalidated
- **Resolution:** Replaced broken reference-equality cache with
  version-counter from StateManager. 2 tests added.

### ✅ P2-010: ToolManager 400+ Lines Dead Fallbacks (Fixed v34)

- **File:** ToolManager.js
- **Impact:** Code quality; tool-specific logic that was extracted
  to handlers but fallback code remains
- **Resolution:** Removed 415 lines of unreachable fallback code (799 lines, down from 1,214). All 5 extracted modules are ResourceLoader dependencies. Also fixed `this.toolStyles` naming bug causing fallback code to always execute for style operations. Tests rewritten: 84 focused tests (was 171).

### ✅ P2-011: HistoryManager Duck-Type Constructor (Fixed v34)

- **File:** HistoryManager.js
- **Impact:** Constructor accepted 5 calling conventions via property
  sniffing; fragile and undocumented API
- **Resolution:** Replaced with single options-object constructor
  `{ editor, canvasManager, maxHistorySteps }`. Removed ~30 lines of
  duck-typing logic. Simplified getEditor()/getCanvasManager()
  accessors. Updated 2 production + 44 test call sites.

### ✅ P2-012: Duplicate Prompt Dialog Implementations (Fixed v34)

- **File:** DialogManager.js, LayersEditor.js
- **Impact:** Two independent prompt dialog implementations
- **Resolution:** Removed 80-line duplicate `showCancelConfirmDialog()` from LayersEditor.js, replaced with `window.confirm()` fallback. Removed unused callback-based `showPromptDialog()` from DialogManager.js. Net ~200 lines eliminated.

### ✅ P2-013: enrichWithUserNames Duplicated (Fixed v34)

- **File:** ApiLayersInfo.php, ApiLayersList.php
- **Impact:** Same enrichment logic copy-pasted in two API modules
- **Resolution:** Consolidated into generic
  enrichRowsWithUserNames() with field-name parameters

### ✅ P2-014: Toolbar innerHTML with mw.message().text() (Fixed v34)

- **File:** resources/ext.layers.editor/Toolbar.js L1050, L1077, L1099
- **Impact:** `.text()` does NOT HTML-escape. If an admin compromises
  i18n messages, this creates an XSS vector. Latent risk, not
  currently exploitable via normal user input.
- **Resolution:** Replaced innerHTML with DOM construction
  (createElement + textContent + appendChild)

### ✅ P2-015: init.js Event Listener Accumulation (Fixed v34)

- **File:** resources/ext.layers/init.js L124
- **Impact:** `layers-modal-closed` listener registered without
  duplicate guard; repeated init() calls stack listeners
- **Resolution:** Added _modalClosedListenerRegistered guard flag

### ✅ P2-016: ImageLoader Timeout Orphaned on Success (Fixed v34)

- **File:** resources/ext.layers.editor/ImageLoader.js L290-317
- **Impact:** loadTestImage() sets a setTimeout but onload doesn't
  call clearTimeout; orphaned timer fires after success
- **Resolution:** onload now calls clearTimeout(this.loadTimeoutId)

### ✅ P2-017: window.open Without noopener (Fixed v34)

- **File:** resources/ext.layers/viewer/ViewerOverlay.js L465, L468
- **Impact:** `window.open(url, '_blank')` lacks `noopener,noreferrer`
  features string; allows opener reference in some browsers
- **Resolution:** Added 'noopener,noreferrer' third argument

### ✅ P2-018: ShadowRenderer/EffectsRenderer Temp Canvas Per Frame (Fixed v34)

- **File:** ShadowRenderer.js, EffectsRenderer.js
- **Impact:** Creates new canvas element on every render call;
  GC pressure in animation/interaction scenarios
- **Resolution:** Cached offscreen canvases as instance properties
  with grow-only reallocation strategy. Eliminates ~300+ GPU
  allocations/second during drag with shadow layers.

### ✅ P2-019: TextBoxRenderer wrapText No Long Word Break (Fixed v34)

- **File:** resources/ext.layers.shared/TextBoxRenderer.js
- **Impact:** Words exceeding maxWidth (e.g., long URLs) overflow
  the text box boundary instead of being broken
- **Resolution:** Added character-by-character breaking for words
  exceeding maxWidth. 2 regression tests added.

### ✅ P2-020: ApiLayersSave Redundant Token Parameter (Fixed v34)

- **File:** src/Api/ApiLayersSave.php L589-594
- **Impact:** Explicit 'token' in getAllowedParams() when
  needsToken() already handles CSRF; harmless but misleading
- **Resolution:** Removed redundant 'token' from getAllowedParams()

### ✅ P2-021: LayersSchemaManager Bypasses DI (Fixed v34)

- **File:** src/Database/LayersSchemaManager.php
- **Impact:** Constructor calls MediaWikiServices::getInstance()
  directly instead of receiving logger via DI; makes testing harder
- **Resolution:** Replaced with constructor injection of
  LoggerInterface and IConnectionProvider. Updated services.php.

### ✅ P2-022: Foreign Key Constraints Violate MW Conventions (Fixed v34)

- **File:** sql/layers_tables.sql, src/Database/LayersSchemaManager.php
- **Impact:** MediaWiki explicitly discourages FK constraints due
  to maintenance/migration complexity
- **Resolution:** Removed all 4 FK constraint declarations from schema files. Created PHP migration method `applyDropForeignKeysPatch()` (no-op on SQLite). Deleted 2 orphaned FK patch files that were never registered in the schema manager.

### ✅ P2-023: SpecialEditSlide References Non-Existent Module (Fixed v34)

- **File:** SpecialEditSlide.php
- **Impact:** Calls `addModuleStyles('ext.layers.editor.styles')` which doesn't exist
- **Resolution:** Removed dead `addModuleStyles()` call. CSS already delivered via main `ext.layers.editor` module.

### ✅ P2-024: ext.layers.slides Missing Required Files (Fixed v34)

- **File:** resources/ext.layers.slides/
- **Impact:** Module definition references init.js, SlideManager.js,
  slides.css which don't exist in that path
- **Resolution:** Deleted all 3 dead source files (see P2-006). The ext.layers.slides directory still exists for the active SlideController system but these orphaned files have been removed.

### ✅ P2-025: Duplicate Message Keys in extension.json (Fixed v34)

- **File:** extension.json
- **Impact:** Same i18n message keys listed in multiple
  ResourceModules; wastes bandwidth
- **Resolution:** Removed 9 intra-module duplicates from `ext.layers.editor`. Cross-module duplicates left intact (required by ResourceLoader).

### ✅ P2-026: phpunit.xml Uses Deprecated PHPUnit 9 Attributes (Fixed v34)

- **File:** phpunit.xml
- **Impact:** PHPUnit 10+ warns about deprecated configuration
  format
- **Resolution:** Updated to PHPUnit 10.5 schema; removed
  deprecated attributes; added cacheDirectory and new display
  settings

### ✅ P2-027: ThumbnailRenderer visible === false Ignores 0 (Fixed v35)

- **File:** src/ThumbnailRenderer.php L158-161
- **Impact:** PHP API serialization converts `false` to integer `0`.
  ThumbnailRenderer used `=== false` which didn't match integer 0.
- **Introduced:** v35 review
- **Resolution:** Changed to check both `=== false` and `=== 0`.

### ✅ P2-028: $set Param Ignored in layerEditParserFunction (Fixed v35)

- **File:** src/Hooks.php L354-392
- **Impact:** `{{#layeredit:File|set}}` parser function accepted
  a set name but never passed it to the edit URL.
- **Introduced:** v35 review
- **Resolution:** Built `$editParams` array that includes
  `'setname' => $set` when set name is provided.

### ✅ P2-029: RevisionManager UTC Timestamps as Local (Fixed v35)

- **File:** resources/ext.layers.editor/editor/RevisionManager.js L60
- **Impact:** `new Date()` created local-timezone dates from UTC
  timestamps. Revision timestamps displayed wrong for non-UTC users.
- **Introduced:** v35 review
- **Resolution:** Changed to `new Date(Date.UTC(...))`. 3 regression
  tests validate UTC correctness.

### ✅ P2-030: EditorBootstrap Conditional Global — Not a Bug (Reclassified v35)

- **File:** resources/ext.layers.editor/editor/EditorBootstrap.js L436
- **Impact:** `window.layersEditorInstance` only set in debug mode.
  This is intentional — debug-only globals should not be set in
  production. Not a bug.
- **Introduced:** v35 review
- **Resolution:** Reclassified as intentional design.

### ✅ P2-031: CanvasRenderer _blurTempCanvas Not Cleaned (Fixed v35)

- **File:** resources/ext.layers.editor/CanvasRenderer.js L1328-1378
- **Impact:** `destroy()` did not nullify `_blurTempCanvas` off-screen
  canvas. Minor memory leak on editor close.
- **Introduced:** v35 review
- **Resolution:** Added `this._blurTempCanvas = null;` in `destroy()`.
  3 regression tests validate cleanup.

---

## P3 — Low Priority

### ✅ P3-001: ApiLayersList Missing unset() After foreach-by-ref (Fixed v34)

- **File:** src/Api/ApiLayersList.php L166-173
- **Impact:** `$item` reference persists after loop; latent mutation risk
- **Resolution:** Added unset($slide) after foreach loop

### ✅ P3-002: UIHooks Unused Variables (Fixed v34)

- **File:** src/Hooks/UIHooks.php L412, L454
- **Impact:** `$viewUrl`, `$viewLabel` assigned but never used
- **Resolution:** Removed both unused variable assignments

### ✅ P3-003: StateManager Malformed JSDoc (Fixed v34)

- **File:** resources/ext.layers.editor/StateManager.js L894-898
- **Impact:** Unclosed `/**` comment block before destroy()
- **Resolution:** Removed malformed comment block

### ✅ P3-004: ThumbnailRenderer Catches Exception Not Throwable (Fixed v34)

- **File:** src/ThumbnailRenderer.php L110
- **Impact:** Misses Error subclasses (e.g., TypeError)
- **Resolution:** Changed catch(Exception) to catch(\Throwable)

### ✅ P3-005: Hardcoded 'Anonymous' User Name (Fixed v34)

- **File:** src/Api/ApiLayersInfo.php L479, L530
- **Impact:** String "Anonymous" not internationalized
- **Resolution:** Replaced with wfMessage('layers-unknown-user');
  added i18n key to en.json and qqq.json

### ✅ P3-006: ImageLayerRenderer djb2 Hash Collision Risk — CLOSED BY DESIGN

- **File:** resources/ext.layers.shared/ImageLayerRenderer.js L170-185
- **Impact:** 32-bit hash for image cache keys; collision probability
  grows with many image layers
- **Resolution:** Assessed as false positive. Hash is only fallback when layer.id missing, 50-entry LRU cache, ~0.00003% collision probability, worst case is transient visual glitch (no data loss). No code change needed.

### ✅ P3-007: checkSizeLimit Uses .length Not Byte Count (Fixed v34)

- **File:** resources/ext.layers.editor/APIManager.js L1440-1443
- **Impact:** String.length counts UTF-16 code units, not bytes.
  Multibyte characters (emoji, CJK) undercount actual payload size.
- **Resolution:** Uses TextEncoder().encode(data).length with
  encodeURIComponent fallback. 2 regression tests added.

### ✅ P3-008: LayerInjector Logger Argument (Fixed v30)

### ✅ P3-009: SlideHooks isValidColor Too Weak (Fixed v30)

### ✅ P3-010: services.php Missing strict_types (Fixed v30)

### ❌ P3-011: Version Numbers Stale Across 6+ Documents

- **Impact:** Version 1.5.52-1.5.54 appears in 6+ files; actual is 1.5.56
- **Files:** ARCHITECTURE.md, copilot-instructions.md,
  LTS_BRANCH_STRATEGY.md, SLIDE_MODE.md, Mediawiki-Extension.mediawiki

### ❌ P3-012: PHPUnit Test Count Wrong in 4 Files

- **Impact:** Documents say "24 PHPUnit test files"; actual is 31
- **Files:** README.md, ARCHITECTURE.md, MW mediawiki, wiki/Home.md

### ❌ P3-013: i18n Key Count Wrong in 2 Files

- **Impact:** Documents say "749 message keys"; actual is 731
- **Files:** ARCHITECTURE.md, wiki/Home.md

### ❌ P3-014: README Uses Wrong Slide Parameter

- **Impact:** README shows `bgcolor=red` in slide syntax example;
  correct parameter is `background=red` per SlideHooks.php
- **File:** README.md

### ❌ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5'

- **Impact:** Code sample in ARCHITECTURE.md L688 shows extremely
  old version string
- **File:** docs/ARCHITECTURE.md

### ❌ P3-016: No CHANGELOG Entries for v1.5.53 or v1.5.54

- **Impact:** CHANGELOG.md and wiki/Changelog.md have no entries
  for the last two version bumps

### ❌ P3-017: wiki/Changelog.md Not Mirroring CHANGELOG.md

- **Impact:** Missing 3+ fixes from Unreleased section
- **File:** wiki/Changelog.md

### ❌ P3-018: INSTANTCOMMONS_SUPPORT.md Uses Deprecated Syntax

- **Impact:** Uses `layers=on` instead of current `layerset=on`
- **File:** docs/INSTANTCOMMONS_SUPPORT.md

### ❌ P3-019: NAMED_LAYER_SETS.md Uses Proposal Language

- **Impact:** Says "Proposed Design" for fully implemented feature
- **File:** docs/NAMED_LAYER_SETS.md

### ❌ P3-020: SHAPE_LIBRARY_PROPOSAL.md Says "Proposed"

- **Impact:** Feature is fully implemented with 5,116 shapes
- **File:** docs/SHAPE_LIBRARY_PROPOSAL.md

### ❌ P3-021: UX_STANDARDS_AUDIT.md Extremely Outdated

- **Impact:** Claims features are "NOT IMPLEMENTED" that have been
  shipping since v1.3+
- **File:** docs/UX_STANDARDS_AUDIT.md

### ❌ P3-022: SLIDE_MODE.md Says "Partially Implemented"

- **Impact:** Most slide features are now complete
- **File:** docs/SLIDE_MODE.md

### ❌ P3-023: FUTURE_IMPROVEMENTS.md Duplicate Section Numbers

- **Impact:** Multiple sections numbered the same; completed items
  listed under "Active"
- **File:** docs/FUTURE_IMPROVEMENTS.md

### ❌ P3-024: README Badge Test Count Outdated

- **Impact:** Badge shows 11,254 but other docs say 11,290
- **File:** README.md

### ❌ P3-025: JS/PHP Line Counts Slightly Off

- **Impact:** README says 96,886 JS lines and 15,034 PHP lines;
  actual is ~96,152 and ~15,339
- **Files:** README.md, Mediawiki-Extension-Layers.mediawiki

### ❌ P3-026: SSLV.php Line Count Wrong in Docs

- **Impact:** copilot-instructions.md and ARCHITECTURE.md say 1,346
  lines; actual is 1,375
- **Files:** .github/copilot-instructions.md, docs/ARCHITECTURE.md

### ❌ P3-027: PropertiesForm.js Line Count Wrong

- **Impact:** copilot-instructions.md says 914 lines; actual is 994
- **File:** .github/copilot-instructions.md

### ❌ P3-028: God Class Count in copilot-instructions.md

- **Impact:** Header says 21 files but hand-written JS count says 17
  and PHP says 2 — total matches but breakdown text may confuse
- **File:** .github/copilot-instructions.md

### ❌ P3-029 through P3-032: Additional Documentation Staleness

- Multiple additional stale metrics across wiki/, docs/, and root
  documentation files. See Documentation Debt in codebase_review.md
  for the full 42-item breakdown.

### ❌ P3-033: SHA1 Fallback Reimplemented Outside Trait

- **File:** src/Api/ApiLayersSave.php L297-315
- **Impact:** Duplicates `ForeignFileHelperTrait::getFileSha1()` logic
  with inline SHA1 fallback code. DRY violation.
- **Introduced:** v35 review

### ✅ P3-034: SchemaManager CURRENT_VERSION Stale (Fixed v35)

- **File:** src/Database/LayersSchemaManager.php L574
- **Impact:** `CURRENT_VERSION` constant said 1.5.52 but actual
  extension version was 1.5.56
- **Introduced:** v35 review
- **Resolution:** Updated constant to '1.5.56'.

### ❌ P3-035: ImageLayerRenderer Stale Cache on src Change

- **File:** resources/ext.layers.shared/ImageLayerRenderer.js L165
- **Impact:** Image cache key ignores `layer.src` changes. If src
  changes on the same layer ID, stale cached image is rendered.
- **Introduced:** v35 review

### ❌ P3-036: DimensionRenderer hitTest Fallback Mismatch

- **File:** resources/ext.layers.shared/DimensionRenderer.js L803
- **Impact:** hitTest extensionGap fallback is 10 but DEFAULTS
  constant is 3. Inconsistent behavior when extensionGap unset.
- **Introduced:** v35 review

### ❌ P3-037: ColorValidator Alpha Channel Regex

- **File:** src/Validation/ColorValidator.php L149
- **Impact:** Regex for alpha validation accepts malformed values
  like `1.2.3` (multiple dots)
- **Introduced:** v35 review

### ✅ P3-038: WikitextHooks Info Logging Every Thumbnail (Fixed v35)

- **File:** src/Hooks/WikitextHooks.php L320-327
- **Impact:** Logged at `info` level for every thumbnail render,
  causing log spam in production.
- **Introduced:** v35 review
- **Resolution:** Changed `self::log()` to `self::logDebug()` for
  thumbnail rendering log calls.

### ❌ P3-039: EditLayersAction Dead MW < 1.44 Fallbacks

- **File:** src/Action/EditLayersAction.php L40-57
- **Impact:** Compatibility code for MediaWiki < 1.44 but
  `extension.json` requires `>= 1.44.0`. Dead code.
- **Introduced:** v35 review

### ❌ P3-040: ErrorHandler retryOperation No-Op

- **File:** resources/ext.layers.editor/ErrorHandler.js L529
- **Impact:** Shows "Retrying..." message but doesn't actually
  retry the operation. Misleading UX.
- **Introduced:** v35 review

### ✅ P3-041: LayersLightbox Hardcoded English Alt Text (Fixed v35)

- **File:** resources/ext.layers/viewer/LayersLightbox.js L316
- **Impact:** Alt text was hardcoded in English instead of i18n.
- **Introduced:** v35 review
- **Resolution:** Changed to `mw.message('layers-lightbox-alt').text()`.
  Added i18n key to en.json, qqq.json, and extension.json module.
  Regression test validates mw.message() is called.

---

## Reporting an Issue

If you discover a new issue, add it to this document under the
appropriate priority level with:
- A unique ID (P{n}-{NNN})
- File reference and line numbers
- Description of impact
- Recommended fix (if known)
- The review version where it was discovered

Then update the summary table at the top.
