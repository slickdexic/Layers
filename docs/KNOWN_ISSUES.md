# Known Issues

**Last updated:** February 13, 2026 — v37 fresh audit (version 1.5.57)

This document tracks known issues in the Layers extension, prioritized
as P0 (critical/data loss), P1 (high/significant bugs), P2 (medium),
and P3 (low/cosmetic). Issues are organized by priority and status.

## Summary

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| P0 | 4 | 4 | 0 |
| P1 | 31 | 31 | 0 |
| P2 | 55 | 53 | 2 |
| P3 | 64 | 50 | 14 |
| **Total** | **154** | **138** | **16** |

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

### ✅ P1-026: ClipboardController paste() Bypasses StateManager (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/ClipboardController.js
- **Resolution:** Rewrote paste() to build a new layers array and
  set via `editor.stateManager.set('layers', newLayers)`, consistent
  with cutSelected(). Fallback to direct assignment if no StateManager.

### ✅ P1-027: RenderCoordinator Hash Omits Rendering Properties (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/RenderCoordinator.js
- **Resolution:** Expanded `_computeLayersHash()` from 8 to 30+
  properties including fill, stroke, text, fontSize, fontFamily,
  strokeWidth, shadow, gradient, src, richText, points, locked, name,
  blendMode, radius, endpoints, and more.

### ✅ P1-028: SecurityAndRobustness.test.js Tests Mocks Not Code (Fixed v36)

- **File:** tests/jest/SecurityAndRobustness.test.js (DELETED)
- **Resolution:** File deleted entirely (490 lines, 18 tests, zero
  require() calls). Existing focused test suites already provide
  real coverage of the same code.

### ✅ P1-029: PHPUnit Version Mismatch (Fixed v36)

- **File:** phpunit.xml, tests/phpunit/unit/HooksTest.php
- **Resolution:** Downgraded phpunit.xml schema from 10.5 to 9.6.
  Removed PHPUnit 10-only attributes. Replaced withConsecutive()
  in HooksTest.php with willReturnCallback() + assertContains().

### ✅ P1-030: npm test --force Bypasses Lint Failures (Fixed v36)

- **File:** package.json, Gruntfile.js
- **Resolution:** Removed `--force` from npm test script. Fixed
  Gruntfile.js ESLint glob to exclude patterns matching .eslintrc.json
  ignorePatterns (scripts/**, TempToolIcons/**, etc.). Grunt now passes
  cleanly without --force.

### ✅ P1-031: ErrorHandler Auto-Reload Loses Unsaved Work (Fixed v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Added `_saveDraftBeforeReload()` method that saves
  draft via `window.layersEditorInstance.draftManager.saveDraft()`
  before reload. Best-effort with try/catch.

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
- **Resolution:** Changed to ON DELETE SET NULL; migration patch

### ✅ P1-012: ls_name Allows NULL in Schema (Fixed v34)

- **File:** sql/layers_tables.sql
- **Resolution:** NOT NULL DEFAULT 'default'; migration patch

### ✅ P1-013: Triple Source of Truth for Selection State (Fixed v34)

- **File:** SelectionManager.js, CanvasManager.js, StateManager.js
- **Resolution:** Removed ghost properties; single authority

### ✅ P1-014: Rich Text Word Wrap Wrong Font Metrics (Fixed v34)

- **File:** TextBoxRenderer.js
- **Resolution:** Per-run font measurement in wrapRichText()

### ✅ P1-015: ThumbnailRenderer Shadow Blur Corrupts Canvas (Fixed v34)

- **File:** ThumbnailRenderer.php
- **Resolution:** buildShadowSubImage() helper

### ✅ P1-016: SQLite-Incompatible Schema Migrations (Fixed v34)

- **File:** LayersSchemaManager.php, sql/patches/
- **Resolution:** PHP methods with $dbType branching

### ✅ P1-017: ShadowRenderer Discards Scale on Rotation (Fixed v34)

- **File:** ShadowRenderer.js L305-325
- **Resolution:** Decompose and preserve scale matrix

### ✅ P1-018: DimensionRenderer hitTest Ignores Offset (Fixed v34)

- **File:** DimensionRenderer.js L750-761
- **Resolution:** hitTest uses perpendicular offset

### ✅ P1-019: APIManager saveInProgress Permanently Stuck (Fixed v34)

- **File:** APIManager.js L859-870
- **Resolution:** try/catch with reset on error

### ✅ P1-020: PresetStorage Strips Gradient Data (Fixed v34)

- **File:** PresetStorage.js L20-56
- **Resolution:** Added 'gradient' to ALLOWED_STYLE_PROPERTIES

### ✅ P1-021: OverflowException Double endAtomic (Fixed v35)

- **File:** LayersDatabase.php L174-245
- **Resolution:** Removed premature endAtomic; re-throw in catch

### ✅ P1-022: TextSanitizer html_entity_decode (Fixed v35)

- **File:** TextSanitizer.php L35-45
- **Resolution:** Second strip_tags() after html_entity_decode()

### ✅ P1-023: EditLayersAction Clickjacking — Not a Bug (v35)

- **File:** EditLayersAction.php L107-119
- **Resolution:** Reclassified as intentional modal editor design

### ✅ P1-024: ApiLayersList DB Error Info Disclosure (Fixed v35)

- **File:** ApiLayersList.php L106-109
- **Resolution:** Generic error; server-side logging

### ✅ P1-025: RichText fontSize Overwritten on Deselect (Fixed v35)

- **File:** InlineTextEditor.js L276-280, L1686-1733
- **Resolution:** _extractDominantFontSize() accepts baseFontSize

---

## P2 — Medium Priority

### ✅ P2-032: ErrorHandler Singleton Lifecycle — False Positive (v36)

- **File:** resources/ext.layers.editor/ErrorHandler.js
- **Resolution:** Not a bug. Singleton is re-created on module load
  via `if (!window.layersErrorHandler) { ... }`. destroy() only runs
  when editor closes (page unload). Subsequent editor sessions get
  a new instance automatically.

### ✅ P2-033: InlineTextEditor Blur setTimeout Tracked (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Assigned setTimeout return value to `this._blurTimeout`.
  Added `clearTimeout(this._blurTimeout)` in `_removeEventHandlers()`.

### ✅ P2-034: No Default Rate Limits — Not a Bug (v36)

- **Resolution:** Rate limiting is intentionally admin-configurable
  via LocalSettings.php. Not all wikis need the same limits.
  RateLimiter.php infrastructure exists and works when configured.

### ✅ P2-035: CanvasManager JSON Clone Per Frame — Overstated (v36)

- **Resolution:** The JSON clone runs inside rAF but is gated by
  `transformEventScheduled` flag, so it runs at most once per
  animation frame. Not per-event. Acceptable performance.

### ✅ P2-036: HistoryManager JSON.stringify for richText — Low Impact (v36)

- **Resolution:** Only runs on `hasUnsavedChanges()` checks, not
  per-frame. Called infrequently (tab close, periodic save check).
  Not a performance concern.

### ✅ P2-037: ext.layers.slides Added to Jest Coverage (Fixed v36)

- **File:** jest.config.js
- **Resolution:** Added `'resources/ext.layers.slides/**/*.js'` to
  collectCoverageFrom array.

### ❌ P2-038: NAMED_LAYER_SETS.md Stale Throughout

- **File:** docs/NAMED_LAYER_SETS.md
- **Impact:** Uses "Proposed Design" header for implemented feature.
  Shows `ls_name VARCHAR(255), DEFAULT NULL` (actual: NOT NULL
  DEFAULT 'default'). References nonexistent config keys
  `$wgLayersSetNameMaxLength` and `$wgLayersSetNamePattern`.
  Says "10-20 named sets" (actual limit: 15).
- **Introduced:** v36 review
- **Recommended Fix:** Major rewrite to document actual
  implementation, correct schema, and real config keys.

### ❌ P2-039: Missing SlideNameValidator in API Modules (NEW v37)

- **Files:** src/Api/ApiLayersInfo.php, src/Api/ApiLayersRename.php
- **Impact:** ApiLayersSave.php and ApiLayersDelete.php use
  `SlideNameValidator::isValid()` to validate slidename parameters,
  but ApiLayersInfo.php and ApiLayersRename.php don't validate
  slidename. This creates an inconsistency where malformed slide
  names could be queried (though impact is limited since names
  are only used for DB lookup with prefixed imgName).
- **Introduced:** v37 review
- **Recommended Fix:** Add `SlideNameValidator::isValid()` check
  to `executeSlideRequest()` in ApiLayersInfo.php and
  `executeSlideRename()` in ApiLayersRename.php for consistency.

### ✅ P2-001: Negative Dimensions for Rectangle/TextBox (Fixed v28)

### ✅ P2-002: DraftManager Stores Base64 Image Data (Fixed v28)

### ✅ P2-003: CalloutRenderer Blur Clips L/R Tails (Fixed v31)

### ✅ P2-004: closeAllDialogs Leaks Keydown Handlers (Fixed v30)

### ✅ P2-005: ext.layers Loaded Every Page (Fixed v34)

### ✅ P2-006: SlideManager.js Dead Code (~439 Lines) (Fixed v34)

### ✅ P2-007: Client SVG Sanitization Regex Bypassable (Fixed v34)

### ✅ P2-008: sanitizeString Strips `<>` Destroying Math (Fixed v34)

### ✅ P2-009: SmartGuides Cache Stale on Mutations (Fixed v34)

### ✅ P2-010: ToolManager 400+ Lines Dead Fallbacks (Fixed v34)

### ✅ P2-011: HistoryManager Duck-Type Constructor (Fixed v34)

### ✅ P2-012: Duplicate Prompt Dialog Implementations (Fixed v34)

### ✅ P2-013: enrichWithUserNames Duplicated (Fixed v34)

### ✅ P2-014: Toolbar innerHTML with mw.message().text() (Fixed v34)

### ✅ P2-015: init.js Event Listener Accumulation (Fixed v34)

### ✅ P2-016: ImageLoader Timeout Orphaned on Success (Fixed v34)

### ✅ P2-017: window.open Without noopener (Fixed v34)

### ✅ P2-018: ShadowRenderer/EffectsRenderer Temp Canvas (Fixed v34)

### ✅ P2-019: TextBoxRenderer wrapText No Long Word Break (Fixed v34)

### ✅ P2-020: ApiLayersSave Redundant Token Parameter (Fixed v34)

### ✅ P2-021: LayersSchemaManager Bypasses DI (Fixed v34)

### ✅ P2-022: Foreign Key Constraints Violate MW Conventions (Fixed v34)

### ✅ P2-023: SpecialEditSlide References Non-Existent Module (Fixed v34)

### ✅ P2-024: ext.layers.slides Missing Required Files (Fixed v34)

### ✅ P2-025: Duplicate Message Keys in extension.json (Fixed v34)

### ✅ P2-026: phpunit.xml Uses Deprecated PHPUnit 9 Attributes (Fixed v34)

### ✅ P2-027: ThumbnailRenderer visible === false Ignores 0 (Fixed v35)

### ✅ P2-028: $set Param Ignored in layerEditParserFunction (Fixed v35)

### ✅ P2-029: RevisionManager UTC Timestamps as Local (Fixed v35)

### ✅ P2-030: EditorBootstrap Conditional Global — Not a Bug (v35)

### ✅ P2-031: CanvasRenderer _blurTempCanvas Not Cleaned (Fixed v35)

---

## P3 — Low Priority

### ✅ P3-042: console.log in Toolbar.js Removed (Fixed v36)

- **File:** resources/ext.layers.editor/Toolbar.js
- **Resolution:** Removed unguarded `console.log('[Layers] Help
  button clicked')` statement.

### ❌ P3-043: ValidationManager Not Wrapped in IIFE

- **File:** resources/ext.layers.editor/ValidationManager.js
- **Impact:** Class declaration at module top level without IIFE
  wrapper; inconsistent with project convention (all other modules
  use IIFE or equivalent scoping).
- **Introduced:** v36 review

### ✅ P3-044: AlignmentController getCombinedBounds Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/AlignmentController.js
- **Resolution:** Computed actual `width: right - left` and
  `height: bottom - top` instead of hardcoded zeros.

### ✅ P3-045: HistoryManager cancelBatch Double Redraw Fixed (Fixed v36)

- **File:** resources/ext.layers.editor/HistoryManager.js
- **Resolution:** Removed redundant `redraw()` call after
  `renderLayers()` which already calls redraw() internally.

### ✅ P3-046: InlineTextEditor Optional Chaining Removed (Fixed v36)

- **File:** resources/ext.layers.editor/canvas/InlineTextEditor.js
- **Resolution:** Replaced `?.` operator with explicit null checks
  for backward compatibility.

### ✅ P3-047: ViewerManager DOM Properties — False Positive (v36)

- **File:** resources/ext.layers/viewer/ViewerManager.js
- **Resolution:** Not a bug. `img.layersViewer` is properly nulled
  in cleanup code at lines 235 and 331. No GC leak.

### ✅ P3-048: ts-jest Removed (Fixed v36)

- **File:** package.json
- **Resolution:** Removed unused ts-jest dependency from
  devDependencies.

### ✅ P3-049: Gruntfile ESLint Cache Enabled (Fixed v36)

- **File:** Gruntfile.js
- **Resolution:** Changed `cache: false` to `cache: true`.

### ❌ P3-050: Test Files Not Linted by Grunt

- **File:** Gruntfile.js
- **Impact:** tests/jest/** excluded from eslint.all pattern. Test
  files can accumulate style violations unnoticed.
- **Introduced:** v36 review

### ❌ P3-051: PHP Tests Use Only Existence Assertions

- **File:** tests/phpunit/unit/Api/ApiLayersSaveTest.php L382-393
- **Impact:** testDataSizeValidation and testRateLimitingIntegration
  only assert method_exists()/class_exists(). Zero behavioral
  coverage from these specific tests.
- **Introduced:** v36 review

### ✅ P3-052: SchemaManager CURRENT_VERSION Updated (Fixed v36)

- **File:** src/Database/LayersSchemaManager.php
- **Resolution:** Updated CURRENT_VERSION from '1.5.56' to '1.5.57'.

### ❌ P3-053: RichTextConverter innerHTML for HTML Parsing

- **File:** resources/ext.layers.editor/canvas/RichTextConverter.js
  L120-125
- **Impact:** htmlToRichText() creates a temporary div and sets
  innerHTML to parse rich text from contentEditable. DOMParser
  would be safer. Risk is academic since HTML comes from user's
  own browser session, not external sources.
- **Introduced:** v36 review

### ❌ P3-054: Untracked setTimeout in PropertiesForm.js (NEW v37)

- **File:** resources/ext.layers.editor/ui/PropertiesForm.js L316
- **Impact:** Multiple setTimeout calls without tracking. If the
  form is destroyed while timeouts are pending, callbacks may
  execute on stale/destroyed components, potentially causing
  errors or unexpected behavior.
- **Introduced:** v37 review
- **Recommended Fix:** Track timeout IDs in an array property and
  clear them in a cleanup/destroy method.

### ❌ P3-055: Same setTimeout Pattern in PropertyBuilders.js (NEW v37)

- **File:** resources/ext.layers.editor/ui/PropertyBuilders.js L273
- **Impact:** Same issue as P3-054 — 5 instances of untracked
  setTimeout calls that could execute after component destruction.
- **Introduced:** v37 review
- **Recommended Fix:** Same as P3-054.

### ✅ P3-001: ApiLayersList Missing unset() (Fixed v34)

### ✅ P3-002: UIHooks Unused Variables (Fixed v34)

### ✅ P3-003: StateManager Malformed JSDoc (Fixed v34)

### ✅ P3-004: ThumbnailRenderer Exception Not Throwable (Fixed v34)

### ✅ P3-005: Hardcoded 'Anonymous' User Name (Fixed v34)

### ✅ P3-006: ImageLayerRenderer djb2 Hash Collision — CLOSED BY DESIGN

### ✅ P3-007: checkSizeLimit .length Not Byte Count (Fixed v34)

### ✅ P3-008: LayerInjector Logger Argument (Fixed v30)

### ✅ P3-009: SlideHooks isValidColor Too Weak (Fixed v30)

### ✅ P3-010: services.php Missing strict_types (Fixed v30)

### ❌ P3-011: Version Numbers Stale Across 10+ Documents

- **Impact:** Version 1.5.56 or older in 10+ files; actual is 1.5.57
- **Files:** README.md, ARCHITECTURE.md, copilot-instructions.md,
  LTS_BRANCH_STRATEGY.md, SLIDE_MODE.md, wiki/Home.md,
  wiki/Installation.md (worst: 1.5.52), Mediawiki-Extension.mediawiki

### ❌ P3-012: PHPUnit Test Count Wrong in Files — ✅ RESOLVED

### ❌ P3-013: i18n Key Count Wrong — WORSE (v36 update)

- **Impact:** Documents claim 731 or 741 keys; actual is 816.
  ~10% undercount across 4+ files.
- **Files:** codebase_review.md (was 731), ARCHITECTURE.md,
  wiki/Home.md, copilot-instructions.md

### ❌ P3-014: README Uses Wrong Slide Parameter — ✅ RESOLVED

### ❌ P3-015: ARCHITECTURE.md Contains VERSION: '0.8.5' — ✅ RESOLVED

### ❌ P3-016: No CHANGELOG Entries for v1.5.53 or v1.5.54

### ❌ P3-017: wiki/Changelog.md Not Mirroring CHANGELOG.md

- **Impact:** CHANGELOG.md is 2,941 lines; wiki/Changelog.md is
  1,843 lines (37% gap). Violates "must mirror" rule in
  DOCUMENTATION_UPDATE_GUIDE.md.

### ❌ P3-018: INSTANTCOMMONS_SUPPORT.md Deprecated Syntax — ✅ RESOLVED

### ❌ P3-019: NAMED_LAYER_SETS.md Uses Proposal Language

### ❌ P3-020: SHAPE_LIBRARY_PROPOSAL.md Says "Proposed" — ✅ RESOLVED

### ❌ P3-021: UX_STANDARDS_AUDIT.md Outdated — ✅ RESOLVED

### ❌ P3-022: SLIDE_MODE.md Partially Implemented — ✅ RESOLVED

### ❌ P3-023: FUTURE_IMPROVEMENTS.md Duplicate Section Numbers

- **Impact:** Completed items listed under "Active Proposals"

### ❌ P3-024: README Badge Test Count Outdated

### ❌ P3-025: JS/PHP Line Counts Slightly Off

- **Impact:** Multiple documents show stale line counts. Actual:
  140 JS files (~96,805 lines), 39 PHP files (~15,330 lines).

### ❌ P3-026: SSLV.php Line Count Wrong in Docs

### ❌ P3-027: PropertiesForm.js Line Count Wrong

### ❌ P3-028: God Class Count Wrong in Multiple Docs

- **Impact:** README, wiki/Home, ARCHITECTURE, CONTRIBUTING all
  claim 21 god classes. Actual is 16 (12 JS + 2 PHP + 2 generated).
  5 files were refactored below 1,000 lines in v1.5.55.

### ❌ P3-029 through P3-032: Additional Documentation Staleness

### ✅ P3-033: SHA1 Fallback Outside Trait (Fixed v35)

### ✅ P3-034: SchemaManager CURRENT_VERSION Stale at 1.5.52 (Fixed v35)

### ✅ P3-035: ImageLayerRenderer Stale Cache on src (Fixed v35)

### ✅ P3-036: DimensionRenderer hitTest Fallback Mismatch (Fixed v35)

### ✅ P3-037: ColorValidator Alpha Regex (Fixed v35)

### ✅ P3-038: WikitextHooks info→debug Log Level (Fixed v35)

### ✅ P3-039: EditLayersAction Dead MW < 1.44 Code (Fixed v35)

### ✅ P3-040: ErrorHandler retryOperation No-Op (Fixed v35)

### ✅ P3-041: LayersLightbox Hardcoded English Alt (Fixed v35)

---

## Documentation Issues Summary (from v36 Review)

The following documentation issues were identified during the v36
review. They are tracked here for completeness and also referenced
in the improvement plan.

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 2 | Version drift (10+ files); wiki/Config debug default wrong |
| MEDIUM | 7 | God class count (6 files); i18n count (4 files); CONTRIBUTING metrics; DEVELOPER_ONBOARDING deleted file ref; GOD_CLASS_REFACTORING_PLAN stale; 3 MediaWiki table docs stale; NAMED_LAYER_SETS.md major rewrite needed |
| LOW | 13 | CHANGELOG mirror; FUTURE_IMPROVEMENTS; typo; line counts; various staleness |

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
