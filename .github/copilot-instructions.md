# MediaWiki Layers Extension - Copilot Instructions

This guide is for contributors (human and AI) working on the Layers extension. It explains the architecture, API/data contracts, configuration, testing/build workflow, and security/i18n conventions you must follow.

## Codebase Size Policy

**Target: <75,000 lines of JavaScript** — There is NO 50K limit.

This extension is feature-rich by design with 13 drawing tools, multiple rendering systems, comprehensive validation, and extensive test coverage. A well-structured, secure, thoroughly-tested codebase of this size is appropriate. Do NOT add warnings about approaching 50K lines or suggest arbitrary line limits. Focus on code quality metrics:
- God classes (files >1,000 lines) — minimize these
- Test coverage — maintain 90%+ statement coverage
- Security — CSRF, rate limiting, validation
- Proper delegation — use controller patterns

## 1) Architecture overview

Separation of concerns is strict: PHP integrates with MediaWiki and storage; JavaScript implements the editor UI/state.

- Backend (PHP, `src/`)
  - Manifest: `extension.json` (hooks, resource modules, API modules, rights, config; requires MediaWiki >= 1.43)
  - Service wiring: `services.php` registers 3 services: LayersLogger, LayersSchemaManager, LayersDatabase (uses DI pattern)
  - Logging: `src/Logging/` provides `LoggerAwareTrait` (for objects with getLogger/setLogger), `StaticLoggerAwareTrait` (for static contexts), and `LayersLogger` (factory via service container)
  - API modules (`src/Api/`)
    - `ApiLayersInfo`: read-only fetch of layer data and revision list for a file
    - `ApiLayersSave`: write endpoint to save a new layer set revision (requires CSRF token + rights)
    - `ApiLayersDelete`: delete endpoint to remove an entire named layer set (requires CSRF token, owner or admin)
    - `ApiLayersRename`: rename endpoint to rename a named layer set (requires CSRF token, owner or admin)
  - Database access: `src/Database/LayersDatabase.php` (CRUD and JSON validation; schema in `sql/` + `sql/patches/`)
    - Uses LoadBalancer for DB connections (lazy init pattern with getWriteDb/getReadDb)
    - Implements retry logic with exponential backoff (3 retries, 100ms base delay) for transaction conflicts
  - Hooks and Actions: `src/Hooks/*` and `Action/EditLayersAction.php` wire the editor into File pages and parser/wikitext
  - Security/Validation: `src/Security/RateLimiter.php` + `src/Validation/*` (TextSanitizer, ColorValidator, ServerSideLayerValidator)
    - Validator uses strict property whitelists (see ALLOWED_PROPERTIES constant with 40+ fields)
    - All validation errors use i18n keys (layers-validation-*) for consistent error messages

- Frontend (JS, `resources/`)
  - Entry points: `ext.layers/init.js` (viewer bootstrap) and `ext.layers.editor/LayersEditor.js` (full editor)
  - Module system: LayersEditor uses ModuleRegistry for dependency management (UIManager, EventManager, APIManager, ValidationManager, StateManager, HistoryManager)
  - Core editor modules: `CanvasManager.js` (~1,877 lines - facade coordinating controllers), `ToolManager.js` (~1,214 lines - delegates to tool handlers), `CanvasRenderer.js` (~1,105 lines - delegates to SelectionRenderer), `SelectionManager.js` (~1,359 lines - delegates to SelectionState, MarqueeSelection, SelectionHandles), `HistoryManager.js`, `GroupManager.js` (~1,132 lines)
  - Tool handlers (`resources/ext.layers.editor/tools/`): Extracted from ToolManager for tool-specific logic:
    - `TextToolHandler.js` (~207 lines) - inline text input UI for creating text layers
    - `PathToolHandler.js` (~229 lines) - freeform path drawing with click-to-add points
    - `ShapeFactory.js` (~531 lines) - shape creation factory
    - `ToolRegistry.js` (~371 lines) - tool configuration registry
    - `ToolStyles.js` (~508 lines) - style management for tools
  - Shared modules (`resources/ext.layers.shared/`): Used by both editor and viewer for consistent behavior:
    - `DeepClone.js` - Object cloning utilities including `omitProperty(obj, propName)` for creating copies without specific properties (avoids eslint-disable for destructuring)
    - `LayerDataNormalizer.js` (~229 lines) - **CRITICAL**: Normalizes layer data types (string→boolean, string→number). Both editor and viewer use this to ensure consistent rendering. Add new boolean properties here.
    - `LayerRenderer.js` (~867 lines), `ImageLayerRenderer.js` (~280 lines - extracted image caching/rendering), `ShadowRenderer.js` (~556 lines), `ArrowRenderer.js` (~1,310 lines - curved arrow support), `TextRenderer.js` (~345 lines), `TextBoxRenderer.js` (~659 lines), `ShapeRenderer.js` (~909 lines), `EffectsRenderer.js` (~538 lines)
  - Canvas controllers (`resources/ext.layers.editor/canvas/`): Extracted from CanvasManager for separation of concerns:
    - `ZoomPanController.js` (~370 lines) - zoom, pan, fit-to-window, coordinate transforms
    - `SmartGuidesController.js` (~568 lines) - smart guides and snap alignment
    - `TransformController.js` (~779 lines) - resize, rotation, multi-layer transforms
    - `ResizeCalculator.js` (~822 lines) - shape-specific resize calculations
    - `HitTestController.js` (~382 lines) - selection handle and layer hit testing
    - `DrawingController.js` (~630 lines) - shape/tool creation and drawing preview
    - `ClipboardController.js` (~248 lines) - copy/cut/paste operations
    - `RenderCoordinator.js` (~398 lines) - render scheduling and dirty region tracking
    - `InteractionController.js` (~501 lines) - mouse/touch event handling coordination
    - `TextInputController.js` (~194 lines) - text editing input handling
    - `SelectionRenderer.js` (~368 lines) - selection UI drawing (handles, marquee, rotation)
    - `AlignmentController.js` (~564 lines) - layer alignment and distribution
  - Editor modules (`resources/ext.layers.editor/editor/`): Extracted from LayersEditor:
    - `EditorBootstrap.js` (~400 lines) - initialization, hooks, cleanup
    - `RevisionManager.js` (~470 lines) - revision and named set management
    - `DialogManager.js` (~420 lines) - modal dialogs with ARIA
  - Utilities: `utils/NamespaceHelper.js` (shared getClass() utility), `EventTracker.js` (memory leak prevention), `ImageLoader.js` (background image loading)
  - UI: `Toolbar.js` (~1,652 lines), `LayerPanel.js` (~2,141 lines - delegates to 9 controllers), plus editor CSS (`editor-fixed.css` with full Vector 2022 dark mode support)
  - UI controllers (`resources/ext.layers.editor/ui/`): Extracted from LayerPanel.js and UIManager.js for separation of concerns:
    - `BackgroundLayerController.js` (~380 lines) - background layer visibility and opacity controls
    - `FolderOperationsController.js` (~383 lines) - folder create/delete, layer visibility toggle, ungroup operations
    - `ContextMenuController.js` (~246 lines) - right-click context menu for layer actions
    - `SetSelectorController.js` (~567 lines) - named layer set selection, creation, deletion, renaming (extracted from UIManager.js)
    - `LayerItemFactory.js` (~299 lines) - layer list item DOM creation
    - `LayerListRenderer.js` - layer list rendering
    - `LayerDragDrop.js` - drag and drop reordering
    - `PropertiesForm.js` (~914 lines) - layer properties panel factory, delegates to PropertyBuilders
    - `PropertyBuilders.js` (~819 lines) - reusable property group builders (dimensions, text, alignment, etc.)
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
  - Data flow: the editor keeps an in-memory `layers` array and uses `mw.Api` to GET `layersinfo` and POST `layerssave` with a JSON string of that state
  - ES6 rules: prefer const/let over var; no-unused-vars enforced except in Manager files (see .eslintrc.json overrides)
  - ES6 classes: All 83 modules with constructors use ES6 class pattern; ES6 migration is 100% complete (0 prototype patterns remaining)
  - **God classes:** 12 files exceed 1,000 lines (LayerPanel, CanvasManager, Toolbar, LayersEditor, SelectionManager, ArrowRenderer, CalloutRenderer, ToolManager, APIManager, GroupManager, CanvasRenderer, ToolbarStyleControls) - all use delegation patterns, see improvement_plan.md
  - Controller pattern: CanvasManager acts as a facade, delegating to specialized controllers. Each controller accepts a `canvasManager` reference and exposes methods callable via delegation. See `resources/ext.layers.editor/canvas/README.md` for architecture details.

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
  - Rights: user must have 'editlayers'
  - Token: needs CSRF token (client calls `api.postWithToken('csrf', ...)`)
  - Params: filename (string), data (stringified JSON, see data model), setname (optional, defaults to 'default' - CHANGED), token (csrf)
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
  - Rights: user must have 'editlayers' AND be either the set owner (creator of first revision) or have 'delete' right (admin)
  - Token: needs CSRF token
  - Params: filename (string, required), setname (string, required), token (csrf)
  - Success payload (keyed by module name `layersdelete`): { success: 1, revisionsDeleted: N }
  - Errors: 'layers-file-not-found', 'layers-layerset-not-found', 'permissiondenied', 'layers-delete-failed'
  - Deletes ALL revisions of the named set permanently - this action cannot be undone
  - The 'default' set can be deleted from the API but the UI prevents this

### Named Layer Sets

The named layer sets feature allows multiple named annotation sets per image, each with version history:

- **Named Set**: A logical grouping identified by a unique name (e.g., "default", "anatomy-labels")
- **Revision**: Each save creates a new revision within the named set
- **Limits**: Up to 15 named sets per image, 50 revisions per set (configurable)
- **Default Behavior**: If setname not provided, defaults to 'default' set
- **Migration**: Existing layer sets were migrated to ls_name='default'
- **Wikitext Syntax** (use `layerset=` as primary; `layers=` supported for backwards compatibility):
  - `[[File:Example.jpg|layerset=on]]` - Show default layer set
  - `[[File:Example.jpg|layerset=setname]]` - Show specific named set (e.g., `layerset=anatomy`)
  - `[[File:Example.jpg|layerset=none]]` or `layerset=off` - Explicitly disable layers
  - If the named set doesn't exist, no layers are displayed (silent failure)
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

## 3) Data model (Layer objects)

Layer objects are a sanitized subset of the client model. Common fields (whitelist on server):
- id (string), type (enum: text, textbox, arrow, rectangle, circle, ellipse, polygon, star, line, path, blur, image)
- Geometry: x, y, width, height, radius, radiusX, radiusY, x1, y1, x2, y2, rotation (numbers in safe ranges)
- Style: stroke, fill (color or 'blur'), color, opacity/fillOpacity/strokeOpacity (0..1), strokeWidth, blurRadius (1-64, for blur fill), blendMode or blend (mapped), fontFamily, fontSize, fontWeight (normal|bold), fontStyle (normal|italic)
- Arrow/line: arrowhead (none|arrow|circle|diamond|triangle), arrowStyle (solid|dashed|dotted), arrowSize
- Text: text (sanitized), textStrokeColor, textStrokeWidth, textShadow (bool), textShadowColor, textShadowBlur, textShadowOffsetX, textShadowOffsetY
- Text box: textAlign (left|center|right), verticalAlign (top|middle|bottom), padding, lineHeight, cornerRadius
- Effects: shadow (bool), shadowColor, shadowBlur, shadowOffsetX/Y, shadowSpread, glow (bool)
- Shapes/paths: points: Array<{x,y}> (capped ~1000)
- Image: src (base64 data URL), originalWidth, originalHeight, preserveAspectRatio (bool)
- Flags: visible (bool), locked (bool), name (string)
- Blur fill: When fill='blur', shapes display a "frosted glass" effect that blurs content beneath. blurRadius controls intensity (default 12px).

Important: Unknown or invalid fields are dropped server-side. Keep editor state within these fields to avoid data loss.

## 4) Configuration and permissions

Set in `LocalSettings.php` (see `extension.json` for defaults):
- $wgLayersEnable (LayersEnable): master switch (default true)
- $wgLayersDebug (LayersDebug): verbose logging to 'Layers' channel (default true)
- $wgLayersMaxBytes (LayersMaxBytes): max JSON size per set (default 2MB)
- $wgLayersMaxLayerCount (LayersMaxLayerCount): max layers per set (default 100)
- $wgLayersMaxImageBytes (LayersMaxImageBytes): max size for imported image layers (default 1MB, see recommendations below)
- $wgLayersMaxNamedSets (LayersMaxNamedSets): max named sets per image (default 15)
- $wgLayersMaxRevisionsPerSet (LayersMaxRevisionsPerSet): max revisions kept per named set (default 50)
- $wgLayersDefaultSetName (LayersDefaultSetName): default name for layer sets (default 'default')
- $wgLayersDefaultFonts (LayersDefaultFonts): allowed fonts list used by the editor
- $wgLayersMaxImageSize (LayersMaxImageSize): max image size for editing (px)
- $wgLayersThumbnailCache (LayersThumbnailCache): cache composite thumbs
- $wgLayersImageMagickTimeout (LayersImageMagickTimeout): seconds for IM ops
- $wgLayersMaxImageDimensions (LayersMaxImageDimensions): max width/height for processing

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
- Rights: 'editlayers', 'managelayerlibrary'
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
- JS lint/style/i18n check: `npm test` (grunt runs eslint, stylelint, banana; use `--force` to continue on warnings)
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

## 7) Security and robustness checklist

- Always require CSRF token for writes (server already enforces; use `api.postWithToken('csrf', ...)` on the client)
- Respect size limits and layer counts from config; give users clear errors using i18n keys (see `LayersEditor.js`)
- Do not add new layer fields without updating server whitelist/validation (or they will be discarded)
- Validate and sanitize text, colors, and identifiers; follow patterns in `ApiLayersSave`
- Consider rate limits for new operations; reuse pingLimiter keys pattern ('editlayers-<action>')
- Avoid N+1 DB calls; batch where possible (see user name enrichment in `ApiLayersInfo`)

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
- PHP: MediaWiki coding standards via phpcs; current codebase has ~21 doc errors, ~50 style warnings (mostly minor)
- If you refactor ignored files, update the ignore list or conform to the code style before re-enabling linting
- Backup files: ESLint ignores patterns like `*-backup.js` and `*.backup.js` for WIP code

## 10) Troubleshooting tips

- Composer on Windows: ensure invoking PHP Composer (composer.phar) not a Python package named "composer" on PATH
- Database errors on save: confirm tables exist and run `maintenance/update.php`; server returns 'dbschema-missing' if not detected
- Missing messages: add to i18n and ResourceModules messages arrays; run `npm test` to see Banana warnings
- Rate limited: adjust `$wgRateLimits['editlayers-save']` etc. or use an account with appropriate rights

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
  - Validates: new name format (alphanumeric, hyphens, underscores, 1-50 chars), no conflicts, cannot rename to 'default'

Keep this doc aligned with code. When you change public behavior (API, schema, messages), update this file and add tests where feasible.
## 12) Documentation update checklist

**IMPORTANT:** Before committing changes that affect version, metrics, features, or API, consult `docs/DOCUMENTATION_UPDATE_GUIDE.md` for the complete checklist of files that must be updated.

Key documents that frequently need updates:
- `README.md` — Main project documentation
- `Mediawiki-Extension-Layers.txt` — MediaWiki.org extension page content
- `CHANGELOG.md` + `wiki/Changelog.md` — Version history (must mirror each other)
- `wiki/Home.md` — GitHub Wiki homepage with metrics
- `codebase_review.md` and `improvement_plan.md` — Technical assessment documents
- `wiki/*.md` — Various wiki documentation pages

Common metrics to keep synchronized:
- Test count (currently 8,677 tests, 146 suites)
- Coverage (94.6% statement, 83.3% branch)
- JavaScript file count (113 files, ~61,452 lines)
- PHP file count (32 files, ~11,519 lines)
- Drawing tool count (13 tools)
- Version number (1.5.2)