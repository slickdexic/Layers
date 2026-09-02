# MediaWiki Layers Extension - Copilot Instructions

This guide is for contributors (human and AI) working on the Layers extension. It explains the architecture, API/data contracts, configuration, testing/build workflow, and security/i18n conventions you must follow.

## Branch Strategy

**`main` is the primary branch.** All development, testing, and code review happens on `main`.

- **`main`** — Primary branch. Develop and test here first.
- **`REL1_43`** — Current MediaWiki LTS (1.43.x). Receives cherry-picks from `main`.
- **`REL1_39`** — Previous MediaWiki LTS (1.39.x-1.42.x). Receives cherry-picks from `main`.

Never suggest committing directly to REL branches. Always work on `main` first, then cherry-pick.

## Codebase Size Policy

**Target: <110,000 lines of JavaScript** — There is NO 50K or 75K limit.

This extension is feature-rich by design with **17 drawing tools**, multiple rendering systems, comprehensive validation, extensive test coverage, a **Shape Library with 1,385 shapes**, and an **Emoji Picker with 2,817 emoji**. The generated data files (ShapeLibraryData.js, EmojiLibraryIndex.js) account for ~14,000 lines. A well-structured, secure, thoroughly-tested codebase of this size is appropriate. Do NOT add warnings about approaching line limits or suggest arbitrary line limits. Focus on code quality metrics:
- God classes (files >1,000 lines) — minimize hand-written ones; generated data files are exempt
- Test coverage — maintain 90%+ statement coverage
- Security — CSRF, rate limiting, validation
- Proper delegation — use controller patterns

## 1) Architecture overview

Separation of concerns is strict: PHP integrates with MediaWiki and storage; JavaScript implements the editor UI/state.

- Backend (PHP, `src/`)
  - Manifest: `extension.json` (hooks, resource modules, API modules, rights, config; requires MediaWiki >= 1.44.0)
  - Service wiring: `services.php` registers 3 services: LayersLogger, LayersSchemaManager, LayersDatabase (uses DI pattern)
  - Logging: `src/Logging/` provides `LoggerAwareTrait` (for objects with getLogger/setLogger), `StaticLoggerAwareTrait` (for static contexts), and `LayersLogger` (factory via service container)
  - API modules (`src/Api/`)
    - `ApiLayersInfo`: read-only fetch of layer data and revision list for a file
    - `ApiLayersSave`: write endpoint to save a new layer set revision (requires CSRF token + rights)
    - `ApiLayersDelete`: delete endpoint to remove an entire named layer set (requires CSRF token, owner or admin)
    - `ApiLayersRename`: rename endpoint to rename a named layer set (requires CSRF token, owner or admin)
    - `ApiLayersList`: list slides for Special:Slides page (requires read permission, rate limited)
  - Shared traits (`src/Api/Traits/`)
    - `ForeignFileHelperTrait`: delegates to `ForeignFileHelper` static utility; used by API modules for convenient instance-method access
  - Utility classes (`src/Utility/`)
    - `ForeignFileHelper`: canonical static utility for `isForeignFile()` (3-step detection: instanceof, class name, repo isLocal) and `getFileSha1()` (deterministic fallback hash). Used by all API modules (via trait), Hooks, Processors, Actions, and ThumbnailRenderer.
    - `SetNameResolver`: canonical owner of layer-set-name resolution. `isShowIntent()`/`isHideIntent()`/`isGenericIntent()`/`isSpecificName()` classify a caller-supplied reference; `resolve()` and `latestName()` turn "no name" or a generic intent into the image's most recently saved set. **Never hardcode a set name and never assume one exists** — route new call sites through this class. Mirrored client-side by `resources/ext.layers.shared/SetNameUtil.js`.
    - `RenderCache`: canonical owner of the generated-render directories — composited thumbnails at `<upload>/thumb/layers` and PDF exports at `$wgLayersExportDirectory` (default `$wgTmpDirectory/layers-export`, deliberately **outside** the document root). Provides `getThumbDir()`, `getExportDir()`, `ensureDir()` (honours `$wgDirectoryMode`), `purgeBySha1()` (called from `Hooks::onFileDeleteComplete()`) and `purgeOlderThan()` (called from the reaper script; skips anything not matching the `<sha1>_<key>.<ext>` artefact pattern, since the export dir is admin-configurable). **Never re-derive these paths inline** — they were duplicated across three classes before v1.5.80. Uses `AtEase::quietCall()` rather than `@` so phpcs stays clean.
    - `SpecialPages\SpecialLayersExport`: unlisted delivery endpoint for generated PDFs (`Special:LayersExport?file=…&key=…`). Re-resolves the `File:` title, re-checks `read`, then streams from `RenderCache::getExportDir()`. Returns one generic `layers-export-not-found` for every failure mode.
  - Maintenance (`maintenance/`)
    - `purgeLayersRenderCache.php`: reaps generated renders older than `--max-age-days` (default 30). Supports `--dry-run`. Needed because export filenames embed the layer set revision, so every save orphans the previous export.
  - Database access: `src/Database/LayersDatabase.php` (CRUD and JSON validation; schema in `sql/` + `sql/patches/`)
    - Uses LoadBalancer for DB connections (lazy init pattern with getWriteDb/getReadDb)
    - Implements retry logic with exponential backoff (3 retries, 100ms base delay) for transaction conflicts
  - Hooks and Actions: `src/Hooks/*` and `Action/EditLayersAction.php` wire the editor into File pages and parser/wikitext
  - Security/Validation: `src/Security/RateLimiter.php` + `src/Validation/*` (TextSanitizer, ColorValidator, ServerSideLayerValidator)
    - Validator uses strict property whitelists (see ALLOWED_PROPERTIES constant with 40+ fields)
    - All validation errors use i18n keys (layers-validation-*) for consistent error messages

- Frontend (JS, `resources/`)
  - Entry points: `ext.layers/init.js` (viewer bootstrap) and `ext.layers.editor/LayersEditor.js` (full editor)
  - Viewer modules (`resources/ext.layers/viewer/`): Lightweight viewer for displaying layered images
    - `ViewerManager.js` (~1,320 lines) - manages viewer instances, lazy initialization [GOD CLASS]
    - `LayersViewer.js` (~571 lines) - canvas-based layer rendering for thumbnails
    - `LayersLightbox.js` (~560 lines) - full-screen lightbox viewer
    - `ViewerOverlay.js` (~510 lines) - hover action buttons (edit/view) with permission checking
    - `PdfBuilder.js` (~170 lines) - dependency-free PDF 1.4 writer used by the lightbox Download button; wraps client-composited JPEG pages via `/DCTDecode` at 150 dpi so Download matches Print exactly (the server export silently omits layer types with no ImageMagick primitive)
  - Module system: LayersEditor uses ModuleRegistry for dependency management (UIManager, EventManager, APIManager, ValidationManager, StateManager, HistoryManager, DraftManager)
  - Core editor modules: `CanvasManager.js` (~2,037 lines - facade coordinating controllers), `ToolManager.js` (~799 lines - delegates to tool handlers), `CanvasRenderer.js` (~1,390 lines - delegates to SelectionRenderer), `SelectionManager.js` (~1,418 lines - delegates to SelectionState, MarqueeSelection, SelectionHandles), `HistoryManager.js`, `GroupManager.js` (~987 lines), `DraftManager.js` (~476 lines - auto-save/draft recovery)
  - Tool handlers (`resources/ext.layers.editor/tools/`): Extracted from ToolManager for tool-specific logic:
    - `TextToolHandler.js` (~207 lines) - inline text input UI for creating text layers
    - `PathToolHandler.js` (~229 lines) - freeform path drawing with click-to-add points
    - `ShapeFactory.js` (~531 lines) - shape creation factory
    - `ToolRegistry.js` (~371 lines) - tool configuration registry
    - `ToolStyles.js` (~508 lines) - style management for tools
  - Shared modules (`resources/ext.layers.shared/`): Used by both editor and viewer for consistent behavior:
    - `LayerDefaults.js` (~210 lines) - **NEW**: Centralized constants for layer property defaults (FONT_SIZE, STROKE_WIDTH, OPACITY, shadow limits, slide dimensions, cache sizes, text lengths). Access via `mw.ext.layers.LayerDefaults`. Object.freeze() applied to prevent modification.
    - `SetNameUtil.js` (~120 lines) - Shared rules for interpreting a layer set reference. Mirrors `src/Utility/SetNameResolver.php`. `isSpecificName()` decides whether a value is a real user-defined name or a generic wikitext intent (`on`/`off`/…); `applyToParams()` adds `setname` to an API request only when a specific name was given, so the server resolves the image's current set otherwise. Access via `window.Layers.SetNameUtil` or `mw.ext.layers.SetNameUtil`.
    - `DeepClone.js` - Object cloning utilities including `omitProperty(obj, propName)` for creating copies without specific properties (avoids eslint-disable for destructuring)
    - `LayerDataNormalizer.js` (~325 lines) - **CRITICAL**: Normalizes layer data types (string→boolean, string→number). Both editor and viewer use this to ensure consistent rendering. Add new boolean properties here.
    - `GradientRenderer.js` (~392 lines) - Gradient fill utility for creating linear/radial Canvas gradients from layer definitions. Static `hasGradient()` check, `createGradient()` method, 6 built-in presets (sunset, ocean, forest, fire, steel, rainbow), validation and cloning utilities.
    - `LayerRenderer.js` (~973 lines), `ImageLayerRenderer.js` (~278 lines - extracted image caching/rendering), `ShadowRenderer.js` (~576 lines), `ArrowRenderer.js` (~932 lines - curved arrow support), `TextRenderer.js` (~345 lines), `TextBoxRenderer.js` (~1,120 lines - supports richText formatting), `ShapeRenderer.js` (~959 lines - now with gradient fill support), `EffectsRenderer.js` (~459 lines), `MarkerRenderer.js` (~601 lines - numbered/letter markers with shadow support), `DimensionRenderer.js` (~879 lines - technical measurement annotations)
  - Canvas controllers (`resources/ext.layers.editor/canvas/`): Extracted from CanvasManager for separation of concerns:
    - `ZoomPanController.js` (~385 lines) - zoom, pan, fit-to-window, coordinate transforms
    - `SmartGuidesController.js` (~745 lines) - smart guides and snap alignment
    - `TransformController.js` (~990 lines) - resize, rotation, multi-layer transforms
    - `ResizeCalculator.js` (~966 lines) - shape-specific resize calculations, cursor mapping
    - `HitTestController.js` (~580 lines) - selection handle and layer hit testing
    - `DrawingController.js` (~826 lines) - shape/tool creation and drawing preview
    - `ClipboardController.js` (~277 lines) - copy/cut/paste operations
    - `RenderCoordinator.js` (~404 lines) - render scheduling and dirty region tracking
    - `InteractionController.js` (~556 lines) - mouse/touch event handling coordination
    - `TextInputController.js` (~212 lines) - modal dialog for text input (fallback)
    - `InlineTextEditor.js` (~1,833 lines) - Figma-style inline canvas text editing with floating toolbar [GOD CLASS]
    - `SelectionRenderer.js` (~793 lines) - selection UI drawing (handles, marquee, rotation)
    - `AlignmentController.js` (~571 lines) - layer alignment and distribution
  - Editor modules (`resources/ext.layers.editor/editor/`): Extracted from LayersEditor:
    - `EditorBootstrap.js` (~400 lines) - initialization, hooks, cleanup
    - `RevisionManager.js` (~470 lines) - revision and named set management
    - `DialogManager.js` (~420 lines) - modal dialogs with ARIA
  - Utilities: `utils/NamespaceHelper.js` (shared getClass() utility with caching via Map, clearClassCache() for tests), `EventTracker.js` (memory leak prevention), `ImageLoader.js` (background image loading)
  - UI: `Toolbar.js` (~1,910 lines), `LayerPanel.js` (~2,195 lines - delegates to 9 controllers), plus editor CSS (`editor-fixed.css` with full Vector 2022 dark mode support)
  - UI controllers (`resources/ext.layers.editor/ui/`): Extracted from LayerPanel.js and UIManager.js for separation of concerns:
    - `BackgroundLayerController.js` (~380 lines) - background layer visibility and opacity controls
    - `FolderOperationsController.js` (~383 lines) - folder create/delete, layer visibility toggle, ungroup operations
    - `ContextMenuController.js` (~246 lines) - right-click context menu for layer actions
    - `SetSelectorController.js` (~567 lines) - named layer set selection, creation, deletion, renaming (extracted from UIManager.js)
    - `LayerItemFactory.js` (~299 lines) - layer list item DOM creation
    - `LayerListRenderer.js` - layer list rendering
    - `LayerDragDrop.js` - drag and drop reordering
    - `PropertiesForm.js` (~991 lines) - layer properties panel factory, delegates to PropertyBuilders
    - `PropertyBuilders.js` (~1,493 lines) - reusable property group builders (dimensions, text, alignment, etc.) [GOD CLASS]
    - `GradientEditor.js` (~350 lines) - gradient fill editor UI with color stops, type selection, angle/position sliders
    - `ConfirmDialog.js` - confirmation dialogs
    - `IconFactory.js` - SVG icon generation
    - `PresetStyleManager.js` (~275 lines) - preset dropdown UI integration (extracted from ToolbarStyleControls)
    - `ArrowStyleControl.js` (~209 lines) - arrow style dropdown UI (extracted from ToolbarStyleControls)
  - Preset modules (`resources/ext.layers.editor/presets/`): Style preset system:
    - `PresetManager.js` (~642 lines) - facade for preset operations, delegates to BuiltInPresets and PresetStorage
    - `BuiltInPresets.js` (~293 lines) - built-in preset definitions (arrow, text, shapes, etc.)
    - `PresetStorage.js` (~426 lines) - localStorage operations, import/export, style sanitization
    - `PresetDropdown.js` (~528 lines) - dropdown UI component for selecting presets
  - Validation/Error handling: `LayersValidator.js`, `ErrorHandler.js`, `APIErrorHandler.js`
  - Cache: `APICacheManager.js` (~152 lines) - extracted from APIManager, handles LRU response cache with TTL and sessionStorage freshness cache
  - Data flow: the editor keeps an in-memory `layers` array and uses `mw.Api` to GET `layersinfo` and POST `layerssave` with a JSON string of that state
  - ES6 rules: prefer const/let over var; no-unused-vars enforced except in Manager files (see .eslintrc.json overrides)
  - ES6 classes: All 83 modules with constructors use ES6 class pattern; ES6 migration is 100% complete (0 prototype patterns remaining)
  - **God classes:** 28 files >= 1,000 lines:
    - **Generated data files (4, exempt):** ShapeLibraryData.iec60417.js (~5,905 lines), EmojiLibraryIndex.js (~2,911 lines), ShapeLibraryData.js (~1,643 lines), ShapeLibraryData.iso7000.js (~1,609 lines)
    - **Hand-written JS files (20):** LayerPanel (~2,166), CanvasManager (~2,120), Toolbar (~2,041), PropertyBuilders (~1,976), LayersEditor (~1,939), InlineTextEditor (~1,847), APIManager (~1,684), SelectionManager (~1,491), LayersLightbox (~1,402), ViewerManager (~1,306), CanvasRenderer (~1,246), TransformController (~1,234), ToolbarStyleControls (~1,141), TextBoxRenderer (~1,128), SlideController (~1,127), ResizeCalculator (~1,073), AngleDimensionRenderer (~1,067), DrawingController (~1,064), CanvasEvents (~1,038), CalloutRenderer (~1,003)
    - **PHP god classes (4):** ServerSideLayerValidator.php (~1,569 lines), LayersDatabase.php (~1,487 lines), WikitextHooks.php (~1,114 lines), LayersSchemaManager.php (~1,018 lines)
    - **Near-threshold files (9):** LayerRenderer (~999), PropertiesForm (~993), GroupManager (~987), SelectionRenderer (~985), StateManager (~967), LayersValidator (~962), ShapeRenderer (~959), ArrowRenderer (~938), DimensionRenderer (~930)
    - All files use proper delegation patterns; see docs/PROJECT_GOD_CLASS_REDUCTION.md
  - Controller pattern: CanvasManager acts as a facade, delegating to specialized controllers. Each controller accepts a `canvasManager` reference and exposes methods callable via delegation. See `resources/ext.layers.editor/canvas/README.md` for architecture details.
  - **Emoji Picker module (`resources/ext.layers.editor/shapeLibrary/`)**: v1.5.12 feature adding 2,817 Noto Color Emoji SVGs
    - `EmojiLibraryIndex.js` (~2,911 lines) - Generated, **data only**: exposes `window.Layers.EmojiLibraryData` and nothing else. Never put logic here; the generator will overwrite it.
    - `EmojiLibraryLoader.js` (~215 lines) - Hand-written runtime API (`window.Layers.EmojiLibrary`): shard fetching, caching, cache-busting, `preloadCategory()`
    - `emoji/<category>.json` - 19 per-category SVG shards (20.7 MB total). Only the category the user is viewing is fetched. Regenerate/verify with `node scripts/shard-emoji-bundle.js [--check]`; `--check` runs as part of `npm test`.
    - `EmojiPickerPanel.js` (~500 lines) - OOUI PopupWidget-based emoji picker UI
    - `emoji-picker.css` (~300 lines) - Styles for the emoji picker panel
    - Architecture: Lazy-loaded SVG thumbnails using IntersectionObserver; 19 categories; full-text search

Note on bundling: Webpack outputs `resources/dist/*.js`, but ResourceLoader modules (defined in `extension.json`) load the source files under `resources/ext.layers*`. Dist builds are optional for debugging/testing outside RL.

## 2) API contracts (client ↔ server)

Base route: MediaWiki Action API. Client uses `new mw.Api()`.

- layersinfo (read)
  - Params: filename (string, required), layersetid (int, optional), setname (string, optional - NEW)
  - Success payload (keyed by module name `layersinfo`):
    - layerset: null or object { id, imgName, userId, timestamp, revision, name, data, baseWidth, baseHeight }
      - data: server-decoded JSON structure of a saved set: { revision, schema: 1, created, layers: Array<Layer> }
      - baseWidth/baseHeight are source image dimensions to help client scale overlay accurately
    - all_layersets: Array of revisions for the image (includes ls_id, ls_revision, ls_name, ls_user_id, ls_timestamp, and ls_user_name for convenience)
    - named_sets: Array of named set summaries (NEW): [{ name, revision_count, latest_revision, latest_timestamp, latest_user_id, latest_user_name }]
  - Errors: 'layers-file-not-found', 'layers-layerset-not-found'
  - When setname is provided, returns that specific named set's latest revision and its revision history

- layerssave (write)
  - Rights: user must have 'editlayers' AND ordinary 'edit' permission on the file's page (page/namespace/cascading protection and blocks apply)
  - Token: needs CSRF token (client calls `api.postWithToken('csrf', ...)`)
  - Params: filename (string), data (stringified JSON, see data model), setname (optional — when omitted the image's most recently saved set is reused; a first set is seeded from `$wgLayersDefaultSetName`), token (csrf)
  - Validation/limits (server-side; see also client validator):
    - Max payload bytes: `$wgLayersMaxBytes` (default 2MB)
    - Max layers per set: `$wgLayersMaxLayerCount` (default 100)
    - Max named sets per image: `$wgLayersMaxNamedSets` (default 15) - NEW
    - Max revisions per set: `$wgLayersMaxRevisionsPerSet` (default 50, older pruned)
    - Strict property whitelist and type/length/range checks; unknown props are dropped; extreme values are rejected
    - Colors are strictly validated/sanitized; text is stripped of HTML and dangerous protocols
    - Rate limiting enforced via MediaWiki limiter (see RateLimits below)
  - Success payload (keyed by module name `layerssave`): { success: 1, layersetid, result: 'Success' }
  - Errors: 'layers-invalid-filename', 'layers-data-too-large', 'layers-json-parse-error', 'layers-invalid-data', 'layers-rate-limited', 'layers-file-not-found', 'layers-save-failed', 'dbschema-missing', 'layers-max-sets-reached' (NEW), 'layers-invalid-setname' (NEW)

Contract note: The server persists a wrapped structure `{ revision, schema, created, layers }`. The client sends only the layers array as JSON string; the server performs validation/sanitization and constructs the full structure.

- layersdelete (write)
  - Rights: user must have 'editlayers', ordinary 'edit' permission on the file's page, AND be either the set owner (creator of first revision) or have 'delete' right (admin)
  - Token: needs CSRF token
  - Params: filename (string, required), setname (string, required), token (csrf)
  - Success payload (keyed by module name `layersdelete`): { success: 1, revisionsDeleted: N }
  - Errors: 'layers-file-not-found', 'layers-layerset-not-found', 'permissiondenied', 'layers-delete-failed'
  - Deletes ALL revisions of the named set permanently - this action cannot be undone
  - The 'default' set can be deleted from the API but the UI prevents this

### Named Layer Sets

The named layer sets feature allows multiple named annotation sets per image, each with version history:

- **Named Set**: A logical grouping identified by a unique name (e.g., "001", "anatomy-labels"). **Names are entirely user-defined and nothing is reserved** — an image whose only set is called "001" must behave exactly like one whose only set is called "default".
- **Revision**: Each save creates a new revision within the named set
- **Limits**: Up to 15 named sets per image, 50 revisions per set (configurable)
- **Default Behavior**: If setname is not provided (or a generic wikitext intent such as `on`/`true`/`all`/`1` is used), the extension operates on the image's **most recently saved set, whatever it is called**. No set name is ever assumed to exist. Resolution rules live in `src/Utility/SetNameResolver.php` (server) and `resources/ext.layers.shared/SetNameUtil.js` (client) — route every new call site through them rather than hardcoding a name.
- **Migration**: Layer sets that predate named sets are backfilled under a placeholder name so they stay addressable
- **Wikitext Syntax** (use `layerset=` as primary; `layers=` supported for backwards compatibility):
  - `[[File:Example.jpg|layerset=on]]` - Show the image's current layer set
  - `[[File:Example.jpg|layerset=setname]]` - Show specific named set (e.g., `layerset=anatomy`)
  - `[[File:Example.jpg|layerset=none]]` or `layerset=off` - Explicitly disable layers
  - If the named set doesn't exist, no layers are displayed (silent failure)
- **Gallery support** (v1.5.73–1.5.75):
  - **Native `<gallery>` blocks (v1.5.75)**: Add `|layerset=setname` per image line inside a `<gallery>` block. Implemented via `onParserBeforeInternalParse` regex scanning — `preprocessGalleryBlock()` in `WikitextHooks.php` extracts the param, calls `registerGalleryHint()`, then strips it from the line so it never renders as caption text.
  - **Cargo `format=gallery` (v1.5.74)**: `CargoLayersGalleryFormat` (in `src/Cargo/`) replaces the built-in `CargoGalleryFormat` via the `CargoSetFormatClasses` hook (registered in `src/Hooks/CargoHooks.php`). Before delegating to `parent::display()`, it iterates Cargo result rows, finds the `layerset` field (or `displayParams['layerset field']` override), and calls `registerGalleryHint()` per row.
  - **`{{#layers_hint:}}` parser function (v1.5.73)**: Manually pre-registers a filename → setname hint. Thin wrapper around `registerGalleryHint()`. Registered in `onParserFirstCallInit`.
  - **`$galleryHints` static map**: `WikitextHooks::$galleryHints` stores filename → setname. Read in `onThumbnailBeforeProduceHTML` when the gallery fallback path fires. Cleared in `ensureRequestStateReset()` and `resetPageLayersFlag()`.
- **File: pages**: Layers are NOT auto-displayed; explicit `layerset=on` or `layerset=setname` is required

See `docs/NAMED_LAYER_SETS.md` for full architecture documentation.

### ⚠️ CRITICAL: Boolean Serialization (PHP→JavaScript)

**MediaWiki's API drops boolean `false` values during JSON serialization.** To preserve false values, `ApiLayersInfo.php` converts booleans to integers using `preserveLayerBooleans()`:
- `true` → `1` (integer)
- `false` → `0` (integer)

**ALL JavaScript code that reads boolean flags from the API MUST handle both types:**
```javascript
// ❌ WRONG - will fail for integer 0 (0 !== false is TRUE in JavaScript!)
return visible !== false;

// ✅ CORRECT - handles both boolean and integer
return visible !== false && visible !== 0;

// ✅ BEST - normalize at source (APIManager.extractLayerSetData already does this)
if ( bgVal === false || bgVal === 0 || bgVal === '0' || bgVal === 'false' ) {
    backgroundVisible = false;
}
```

**Why this matters:** JavaScript's strict equality (`!==`) does NOT convert types. `0 !== false` evaluates to `true` because they are different types (number vs boolean), even though they both represent "falsy" values.

**See:** `docs/POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md` for the full story of how this bug resurfaced three times.

**It resurfaced a fourth time in 1.5.82** (`arrowsInside`, `reflexAngle`), because the remedy each time was documentation. As of 1.5.83 the three lists are checked by `scripts/check-parallel-lists.js` in `npm test`. Adding a boolean property means editing all three: the validator whitelist, `ApiLayersInfo::preserveLayerBooleans()`, and `LayerDataNormalizer.BOOLEAN_PROPERTIES`.

### ⚠️ CRITICAL: OutputPage Methods Change Between MW Versions

**MediaWiki frequently deprecates and removes OutputPage methods.** Always use `method_exists()` guards:

```php
// ❌ WRONG - will cause fatal error if method is removed
$out->allowClickjacking();

// ✅ CORRECT - gracefully handles method removal
if ( method_exists( $out, 'allowClickjacking' ) ) {
    $out->allowClickjacking();
} elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {
    $out->setPreventClickjacking( false );
}
```

**Notable removals:**
- `allowClickjacking()` - Deprecated MW 1.43, **removed MW 1.44** (use `setPreventClickjacking(false)`)

**Why this matters:** Fatal errors from removed methods often only occur in specific code paths (e.g., iframe modal mode), making them extremely hard to debug. The HTTP 500 response provides no useful error message.

**When updating MW compatibility code:**
1. Check ALL PHP files for the same pattern
2. Ensure `EditLayersAction.php` and `SpecialEditSlide.php` use identical guards
3. Test both direct navigation AND iframe modal opening

**See:** `docs/POSTMORTEM_IFRAME_MODAL_500_ERROR.md` for the full debugging story.

## 3) Data model (Layer objects)

Layer objects are a sanitized subset of the client model. Common fields (whitelist on server):
- id (string), type (enum: text, textbox, arrow, rectangle, circle, ellipse, polygon, star, line, path, blur, image)
- Geometry: x, y, width, height, radius, radiusX, radiusY, x1, y1, x2, y2, rotation (numbers in safe ranges)
- Style: stroke, fill (color or 'blur'), color, opacity/fillOpacity/strokeOpacity (0..1), strokeWidth, blurRadius (1-64, for blur fill), blendMode or blend (mapped), fontFamily, fontSize, fontWeight (normal|bold), fontStyle (normal|italic)
- **Gradient fill**: gradient (object) - alternative to solid fill color
  - gradient.type: 'linear' or 'radial' (required)
  - gradient.colors: Array<{offset: 0-1, color: string}> (required, min 2, max 10 stops)
  - gradient.angle: 0-360 (optional, for linear gradients)
  - gradient.centerX, gradient.centerY: 0-1 (optional, for radial gradients, normalized position)
  - gradient.radius: 0-2 (optional, for radial gradients, normalized)
- Arrow/line: arrowhead (none|arrow|circle|diamond|triangle), arrowStyle (solid|dashed|dotted), arrowSize
- Text: text (sanitized), textStrokeColor, textStrokeWidth, textShadow (bool), textShadowColor, textShadowBlur, textShadowOffsetX, textShadowOffsetY
- Text box: textAlign (left|center|right), verticalAlign (top|middle|bottom), padding, lineHeight, cornerRadius
- **Rich text** (textbox/callout only): richText (array) - enables mixed formatting within a single text layer
  - richText: Array<{text: string, style?: object}> (max 100 runs, max 50,000 total chars)
  - style.fontWeight: 'normal' | 'bold' | 'lighter' | 'bolder'
  - style.fontStyle: 'normal' | 'italic' | 'oblique'
  - style.fontSize: 1-500 (overrides layer fontSize for this run)
  - style.fontFamily: string (overrides layer fontFamily for this run)
  - style.color: CSS color string
  - style.textDecoration: 'none' | 'underline' | 'line-through' | 'overline'
  - style.backgroundColor: CSS color string (highlight effect)
  - style.textStrokeColor, style.textStrokeWidth: outline effect for individual runs
  - When richText is present, the `text` property is ignored and formatting comes from richText runs
- Effects: shadow (bool), shadowColor, shadowBlur, shadowOffsetX/Y, shadowSpread, glow (bool)
- Shapes/paths: points: Array<{x,y}> (capped ~1000)
- Image: src (base64 data URL), originalWidth, originalHeight, preserveAspectRatio (bool)
- Flags: visible (bool), locked (bool), name (string)
- Blur fill: When fill='blur', shapes display a "frosted glass" effect that blurs content beneath. blurRadius controls intensity (default 12px).

Important: Unknown or invalid fields are dropped server-side. Keep editor state within these fields to avoid data loss.

**Validation rejects rather than repairs for anything carrying user content.** `ServerSideLayerValidator::validateLayer()` drops a failing property with a warning by default, which is right for cosmetic hints and wrong for content: a ten-stop gradient with two typos used to become a two-stop gradient and still return `success: 1`. Properties listed in `STRICT_PROPERTIES` (`richText`, `gradient`, `points`, `originalWidth`, `originalHeight`) fail the whole layer instead. Add new content-bearing properties there.

**`ThumbnailRenderer` draws every layer type as of 1.5.88** and `UNSUPPORTED_SERVER_SIDE` is empty. Keep it and its gate: a new layer type that falls through to the `default:` arm vanishes from server-composited thumbnails and PDF exports, and nobody notices until they compare the editor with an export. A type that cannot be drawn must be added to `UNSUPPORTED_SERVER_SIDE` (declared, gated, reported), never dropped by a silent `default:`. Types that draw nothing anywhere — currently only `group` — go in `NON_VISUAL_TYPES` instead, so they are not reported as lost. Runtime drops (undecodable image data, an SVG shape on a wiki with no `$wgSVGConverter`) are still detected per render and returned as `incomplete`/`droppedtypes`.

## 4) Configuration and permissions

Set in `LocalSettings.php` (see `extension.json` for defaults):
- $wgLayersEnable (LayersEnable): master switch (default true)
- $wgLayersDebug (LayersDebug): verbose logging to 'Layers' channel (default false)
- $wgLayersMaxBytes (LayersMaxBytes): max JSON size per set (default 2MB)
- $wgLayersMaxLayerCount (LayersMaxLayerCount): max layers per set (default 100)
- $wgLayersMaxImageBytes (LayersMaxImageBytes): max size for imported image layers (default 1MB, see recommendations below)
- $wgLayersMaxImportSide (LayersMaxImportSide): max width/height (px) before client-side downscaling of imported images (default 2048); exported to JS via MakeGlobalVariablesScript
- $wgLayersImportJpegQuality (LayersImportJpegQuality): JPEG quality (0.1-1.0) for re-encoding downscaled imports (default 0.8); exported to JS via MakeGlobalVariablesScript
- $wgLayersMaxNamedSets (LayersMaxNamedSets): max named sets per image (default 15)
- $wgLayersMaxRevisionsPerSet (LayersMaxRevisionsPerSet): max revisions kept per named set (default 50)
- $wgLayersDefaultSetName (LayersDefaultSetName): seed name for an image's *first* layer set when the user did not name one (default 'default'). Never used as a lookup key.
- $wgLayersDefaultFonts (LayersDefaultFonts): allowed fonts list used by the editor
- $wgLayersMaxImageSize (LayersMaxImageSize): max image size for editing (px)
- $wgLayersImageMagickTimeout (LayersImageMagickTimeout): seconds for IM ops
- $wgLayersMaxImageDimensions (LayersMaxImageDimensions): max width/height for processing
- $wgLayersPdfExportWidth (LayersPdfExportWidth): render width per page for PDF export (default 1600)
- $wgLayersPdfExportMaxPages (LayersPdfExportMaxPages): max pages per PDF export (default 100, 0 = unlimited)
- $wgLayersExportDirectory (LayersExportDirectory): filesystem cache dir for generated PDFs. **Must be outside the document root.** Empty (default) uses `$wgTmpDirectory/layers-export`, falling back to `sys_get_temp_dir()`
- $wgLayersSlidesEnable (LayersSlidesEnable): enable Slide Mode (default true)
- $wgLayersSlideDefaultWidth (LayersSlideDefaultWidth): default slide canvas width in px (default 800)
- $wgLayersSlideDefaultHeight (LayersSlideDefaultHeight): default slide canvas height in px (default 600)
- $wgLayersSlideMaxWidth (LayersSlideMaxWidth): max slide canvas width in px (default 4096)
- $wgLayersSlideMaxHeight (LayersSlideMaxHeight): max slide canvas height in px (default 4096)
- $wgLayersSlideDefaultBackground (LayersSlideDefaultBackground): default slide background color (default '#ffffff')

### Image Layer Size Recommendations

The `$wgLayersMaxImageBytes` setting controls the maximum size of imported image layers (stored as base64 data URLs). Consider these factors:

| Setting | Raw Image | Use Case |
|---------|-----------|----------|
| 512KB | ~380KB | Small icons, logos, low-bandwidth environments |
| 1MB (default) | ~750KB | Balanced - good for most use cases |
| 2MB | ~1.5MB | High-quality images, enterprise/internal wikis |
| 4MB | ~3MB | Maximum recommended - high storage cost |

**Storage Impact**: Base64 encoding adds ~33% overhead. A 1MB setting allows ~750KB raw images.

**Configuration Examples**:
```php
// Conservative (public wikis with storage concerns)
$wgLayersMaxImageBytes = 512 * 1024;  // 512KB

// Default (balanced)
$wgLayersMaxImageBytes = 1048576;  // 1MB

// Generous (internal/enterprise wikis)
$wgLayersMaxImageBytes = 2 * 1024 * 1024;  // 2MB
// Also increase total set limit to accommodate:
$wgLayersMaxBytes = 4 * 1024 * 1024;  // 4MB
```

Permissions (see `extension.json`):
- Rights: 'editlayers', 'layers-admin'
- Defaults: anonymous: editlayers=false; user: editlayers=true; sysop: all true

Rate limits (MediaWiki core RateLimits; used by `RateLimiter` via pingLimiter):
- Keys: 'editlayers-save', 'editlayers-render', 'editlayers-create'
- Example in LocalSettings.php (adjust to your needs):
  - $wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
  - $wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];

## 5) Development workflow

Dependencies
- PHP: Composer (dev tools: phpcs, phan, parallel-lint, minus-x)
- JS: npm (grunt, eslint, stylelint, webpack, jest)

Install
- npm install
- composer install (PHP Composer; ensure it’s the PHP tool, not a Python package with the same name)

Lint & tests
- JS lint/style/i18n check: `npm test` (grunt runs eslint, stylelint, banana, then jest, `verify-metrics.js`, `verify-i18n-wiring.js`, `check-mw-compatibility.js`, `check-php-class-refs.js`, `check-parallel-lists.js`, `check-atomicity.js`, `check-rate-limits.js`, `check-state-keys.js`, `check-bundle-size.js` and the emoji shard check; use `--force` to continue on warnings)
- i18n wiring check alone: `npm run check:i18n` (see §6)
- MediaWiki API-drift check alone: `npm run check:mw-compat` (scans `src/` and `maintenance/`)
- PHP class-reference check alone: `npm run check:phprefs`. Flags any unqualified use of a Layers class the file has not imported (PHP would silently resolve it into the file's own namespace and fatal at runtime), and any `use MediaWiki\Extension\Layers\…` import pointing at a class that does not exist. `parallel-lint` and `phpcs` are both blind to this, and it took the wiki down in 1.5.81.
- **Parallel-list check alone: `npm run check:parallel`.** Several lists must agree across PHP and JS but live in different files, and every time one drifted it shipped a silent user-visible defect. This asserts set-equality of:
  1. boolean properties — `ServerSideLayerValidator::ALLOWED_PROPERTIES` (the `=> 'boolean'` entries) ↔ `ApiLayersInfo::preserveLayerBooleans()` ↔ `LayerDataNormalizer.BOOLEAN_PROPERTIES`;
  2. layer types — `ServerSideLayerValidator::SUPPORTED_LAYER_TYPES` ↔ `ThumbnailRenderer` (`buildLayerArguments()` cases **plus** `UNSUPPORTED_SERVER_SIDE`) ↔ `RateLimiter::isComplexityAllowed()` cases.
  If you add a boolean layer property or a layer type, you must edit every member of its group. The gate will tell you which one you missed.
- **Rate-limit check alone: `npm run check:ratelimits`.** `RateLimiter::checkRateLimit()` resolves to `User::pingLimiter()`, which reports "not limited" for a bucket nobody configured, so a limiter enforced in code but absent from `extension.json`'s `RateLimits` block does nothing. Defaults live in `extension.json` **only** — a second copy in `Hooks::onRegistration()` used different numbers and a different time window, so the effective limit depended on which list mentioned the bucket. That duplicate is gone; this gate keeps the single list honest in both directions (enforced-but-undeclared, and declared-but-unenforced).
- **State-key check alone: `npm run check:statekeys`.** `StateManager.get()` is a bare property read, so an undeclared key returns `undefined` forever, and the usual `|| false` turns that into a plausible permanent `false`. That is how `hasUnsavedChanges` shipped: read by four navigation guards, written by nothing, inert through 14,199 passing tests because the tests stubbed the getter. Every `stateManager.get()/set()` key must be declared in `StateManager`'s initial state.
- **Atomicity check alone: `npm run check:atomicity`.** Fails on any `endAtomic()` inside a `catch` block, and on `cancelAtomic()` in a file with no `ATOMIC_CANCELABLE` section. Added in 1.5.83 after the same defect was found in four places; it caught the fourth on its first run.
- ResourceLoader size budgets alone: `npm run check:bundlesize` (budgets in `bundlesize.config.json`, measured in raw source bytes; add `--report` to print sizes without failing)
- Emoji shard integrity alone: `npm run check:emoji` (verifies `emoji/*.json` matches `EmojiLibraryIndex.js`)
- JS unit tests (Jest): `npm run test:js` (optional `:watch` or `:coverage`)
- PHP style/lint: `composer test` or `npm run test:php` (parallel-lint, phpcs, minus-x)
- PHP unit tests: `npm run test:phpunit` (requires MediaWiki test env; use `:phpunit-coverage` for HTML report)
- PHP fixes: `npm run fix:php` (runs minus-x fix and phpcbf auto-formatter)
- VS Code tasks available: "npm test (Layers)", "npm test:php (Layers)", "npm fix:php (Layers)"

Build
- Dev build: `npm run build:dev` (sources under `resources/ext.layers*`)
- Prod build: `npm run build` (writes `resources/dist/*.js`; not used by ResourceLoader modules by default)
- Watch mode: `npm run watch` (auto-rebuild on changes; useful for testing outside ResourceLoader)

Database
- Initial schema: `sql/layers_tables.sql`; patches in `sql/patches/` (13 migration files for schema evolution)
- Apply/upgrade via MediaWiki: `php maintenance/update.php` from the MediaWiki root
- Schema manager: `src/Database/LayersSchemaManager.php` handles LoadExtensionSchemaUpdates hook

## 6) Internationalization (i18n)

- All user-facing strings must use MediaWiki message systems:
  - PHP: `wfMessage( 'key' )`
  - JS: `mw.message( 'key' )`
- Define keys in `i18n/en.json` and document in `i18n/qqq.json`
- Grunt Banana checker validates message usage; add new keys to ResourceModules messages arrays where needed in `extension.json`

### The three-way i18n contract

A message only reaches the browser when **all three** of these agree:

1. the key exists in `i18n/en.json` (and is documented in `qqq.json`),
2. it is declared in the `messages[]` array of the ResourceLoader module that
   loads the JS file using it (`extension.json`),
3. the JS actually references it.

`grunt banana` and `verify-metrics.js` validate only (1) — `en.json ↔ qqq.json`.
Before v1.5.80, 152 defects had accumulated in the (2)↔(3) gap with every gate
green, because almost every call site had an inline English fallback that
masked the breakage. `scripts/verify-i18n-wiring.js` now validates all three
and runs as part of `npm test`; run it alone with `npm run check:i18n`.

It reports four blocking categories — UNDEFINED (declared but not in `en.json`),
MISSING (used in JS but not in `en.json`), UNSHIPPED (in `en.json` and used in
JS but not declared by the loading module), FOREIGN (keys owned by core or
another extension) — and one warning category, UNUSED_DECL, which is blocking
only under `--strict`.

**When you add a message you must edit three files**: `i18n/en.json`,
`i18n/qqq.json`, and the right `messages[]` array in `extension.json`. Do not
rely on an inline fallback to tell you whether it worked; run the checker.

**Never reformat `extension.json`, `i18n/en.json` or `i18n/qqq.json` with
`JSON.stringify`.** They are hand-formatted (tab-indented, LF, short arrays
inline, blank lines grouping related keys). Edit them textually.

## 7) Security and robustness checklist

- Always require CSRF token for writes (server already enforces; use `api.postWithToken('csrf', ...)` on the client)
- **A "read" that spends unbounded server CPU or writes to disk is not a read.** `action=layerspdfexport` returns `isWriteMode() === false` because it mutates no layer data, but it still requires `mustBePosted()` and `needsToken() === 'csrf'`: as a token-less GET it rasterised up to `$wgLayersPdfExportMaxPages` pages with ImageMagick and wrote a PDF, so any third-party page could drive it from every logged-in visitor's browser via `<img src>`. Apply the same rule to any new expensive endpoint.
- **Rate limits must ship defaults.** `RateLimiter::checkRateLimit()` resolves to `User::pingLimiter()`, which reports "not limited" for a bucket nobody configured. Before 1.5.83 `extension.json` declared none, so all three Layers limits were decorative on every default install. New `editlayers-<action>` keys must be added to the `RateLimits` block in `extension.json` (merge strategy `array_plus_2d`, so admin overrides still win).
- Gate every new write endpoint on the per-title `edit` permission via `LayersApiHelperTrait::requireTitleEditPermission()`, not just the global `editlayers` right. Layer data changes what a File page renders, so page/namespace/cascading protection and blocks must apply. Use `Authority::definitelyCan()` — **not** `authorizeWrite()`, which would consume core's `edit` rate-limit bucket that Layers does not use, and **not** the deprecated `PermissionManager::getPermissionErrors()`.
- Respect size limits and layer counts from config; give users clear errors using i18n keys (see `LayersEditor.js`)
- Do not add new layer fields without updating server whitelist/validation (or they will be discarded)
- Validate and sanitize text, colors, and identifiers; follow patterns in `ApiLayersSave`
- Consider rate limits for new operations; reuse pingLimiter keys pattern ('editlayers-<action>')
- Avoid N+1 DB calls; batch where possible (see user name enrichment in `ApiLayersInfo`)
- In `LayersDatabase`, open atomic sections with `IDatabase::ATOMIC_CANCELABLE` and roll back with `cancelAtomic()`. `endAtomic()` in a catch block marks the section *successful* and commits partial writes; the retry-on-conflict loop also only works on MySQL without a savepoint. Enforced by `npm run check:atomicity` — this rule was written once and then violated in three more places, which is why it is now a gate.
- Anything written under `<upload>/thumb/layers/` must be purgeable. Derive the path from `Utility\RenderCache` and make sure `purgeBySha1()` covers it, otherwise deleting a file for copyright or privacy will leave the content retrievable.
- **Never build an artefact filename from a raw SHA1.** `ForeignFileHelper::getFileSha1()` falls back to `foreign_<sha1>` for foreign repos, which is 48 characters and contains an underscore. Three separate guards rejected that shape, so foreign-file renders were unpurgeable and foreign-file exports undeliverable. Every producer and consumer must go through `RenderCache::artefactKey()`.
- **Invalidating the `File:` page is not enough.** Layer data lives outside the wikitext, so pages that *embed* the file keep serving parser-cached HTML with the old set. `CacheInvalidationTrait` queues an `HTMLCacheUpdateJob` over the `imagelinks` backlinks; any new write path must call it.
- **Never hand the client a `$wgUploadPath` URL for generated content that reproduces file contents.** Upload-path URLs are served by the web server, not MediaWiki, so they bypass `read` permission entirely and stay valid forever. PDF exports are written to `RenderCache::getExportDir()` (outside the document root) and delivered by `SpecialPages\SpecialLayersExport`, which re-resolves the `File:` title and re-checks `read` on every request. New export/render formats must follow the same pattern, and their delivery endpoint must return one indistinguishable error for "missing", "expired" and "not permitted" so it cannot be used to probe for files.

## 8) Editor UX notes

- The editor sets ARIA roles and uses accessible labels for controls; maintain ARIA attributes when changing UI
- `LayersEditor` exposes status bar info (tool, zoom, pos, size, selection) and copyable wikitext code; keep message keys up to date
- Large images: scaling uses `baseWidth/baseHeight` from `layersinfo`; keep these populated when changing backend

## 9) Known lint/test conventions

- ESLint config (`.eslintrc.json`):
  - Globals: mw, $, jQuery (MediaWiki environment)
  - Enforces no-var, prefer-const, no-unused-vars (with overrides for Manager files)
  - Ignores: `resources/dist/**`, `tests/**`, backup files (`*-backup.js`, `*.backup.js`), `.stylelintrc.json`
  - Special overrides: init.js (indent/console off), Manager files (no-unused-vars off)
- Stylelint: extends wikimedia config; disables @stylistic/linebreaks (Windows line endings allowed)
- PHP: MediaWiki coding standards via phpcs; the codebase is clean — 0 errors and 2 warnings, both in `tests/phpunit/unit/stubs/`. Keep it that way; run `php vendor/squizlabs/php_codesniffer/bin/phpcs -sp --report=summary` (`composer test` currently fails at the phpcs step on Windows) and `npm run fix:php` to auto-format.
- If you refactor ignored files, update the ignore list or conform to the code style before re-enabling linting
- Backup files: ESLint ignores patterns like `*-backup.js` and `*.backup.js` for WIP code

## 10) Troubleshooting tips

**NEVER suggest browser cache clearing or hard refresh (Ctrl+Shift+R) as a solution.** The user always performs `?action=purge` and hard refresh before reporting any issues. Assume they have done this. If code changes don't take effect, the problem is in the code, not in caching. Suggesting cache clearing wastes time and is insulting to professionals.

- Composer on Windows: ensure invoking PHP Composer (composer.phar) not a Python package named "composer" on PATH
- Database errors on save: confirm tables exist and run `maintenance/update.php`; server returns 'dbschema-missing' if not detected
- Missing messages: add to i18n and ResourceModules messages arrays; run `npm test` to see Banana warnings
- Rate limited: adjust `$wgRateLimits['editlayers-save']` etc. or use an account with appropriate rights
- Iframe modal HTTP 500: If the editor loads via direct URL but returns 500 via iframe, check for removed OutputPage methods (e.g., `allowClickjacking`). Always use `method_exists()` guards. Enable PHP error logging to see the actual fatal error. See `docs/POSTMORTEM_IFRAME_MODAL_500_ERROR.md`.

## 11) Quick reference (contracts)

- GET action=layersinfo&filename=File.jpg[&layersetid=ID][&limit=50]
  - Respects File:Title read rights and will only return layer sets that belong to the requested file; optional `limit` caps `all_layersets` (default 50, max 200).
  - Returns: { layersinfo: { layerset: { id, data:{revision,schema,created,layers:[]}, baseWidth, baseHeight, ... }, all_layersets:[...] } }
- POST action=layerssave (CSRF)
  - Params: filename, data='[ {...layer...} ]', setname?, token
  - Returns: { layerssave: { success: 1, layersetid } }
- POST action=layersdelete (CSRF)
  - Params: filename, setname, token
  - Returns: { layersdelete: { success: 1, revisionsDeleted: N } }
  - Permission: owner (first revision creator) or admin ('delete' right)
- POST action=layersrename (CSRF)
  - Params: filename, oldname, newname, token
  - Returns: { layersrename: { success: 1, oldname, newname } }
  - Permission: owner (first revision creator) or admin ('delete' right)
  - Validates: new name format (alphanumeric, hyphens, underscores, 1-255 chars), no conflicts, cannot rename to 'default'
- POST action=layerspdfexport (CSRF) — **POST + token despite `isWriteMode() === false`**
  - Params: filename, setname?, width? (clamped 200-4096, snapped to 200px buckets), token
  - Returns: { layerspdfexport: { success: 1, url, pageCount, setname, cached, incomplete?, droppedtypes?[] } }
  - Permission: `read` on the file page. Rate limited under `editlayers-render`.
  - `incomplete`/`droppedtypes` report layer types the ImageMagick compositor could not draw (see §3). Not set on a cache hit.

Keep this doc aligned with code. When you change public behavior (API, schema, messages), update this file and add tests where feasible.
## 12) Documentation update checklist

**IMPORTANT:** Before committing changes that affect version, metrics, features, or API, consult `docs/DOCUMENTATION_UPDATE_GUIDE.md` for the complete checklist of files that must be updated.

⚠️ **CRITICAL: Don't forget `Mediawiki-Extension-Layers.mediawiki`** — This file is the source for the MediaWiki.org extension page and is frequently overlooked during updates!

Key documents that frequently need updates:
- `README.md` — Main project documentation
- `Mediawiki-Extension-Layers.mediawiki` — MediaWiki.org extension page content ⚠️
- `CHANGELOG.md` + `wiki/Changelog.md` — Version history (must mirror each other)
- `wiki/Home.md` — GitHub Wiki homepage with metrics
- `codebase_review.md` and `improvement_plan.md` — Technical assessment documents
- `wiki/*.md` — Various wiki documentation pages

Common metrics to keep synchronized:
- Test count (14,270 Jest tests in 178 suites; 675 PHPUnit tests)
- Coverage (95.87% statement, 87.20% branch — verified September 2, 2026)
- JavaScript file count (161 files total, ~107,000 lines)
- PHP file count (48 files, ~17,300 lines)
- God class count (28 files >=1,000 lines; 4 generated data files, 20 JS, 4 PHP)
- ESLint disable count (18 - all legitimate)
- Drawing tool count (17 tools)
- Shape library count (1,385 shapes in 12 categories)
- Emoji library count (2,817 emoji in 19 categories)
- Font library count (32 self-hosted fonts in 5 categories, 106 WOFF2 files)
- Version number (1.5.89)