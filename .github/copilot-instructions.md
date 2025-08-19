# MediaWiki Layers Extension - Copilot Instructions

This guide is for contributors (human and AI) working on the Layers extension. It explains the architecture, API/data contracts, configuration, testing/build workflow, and security/i18n conventions you must follow.

## 1) Architecture overview

Separation of concerns is strict: PHP integrates with MediaWiki and storage; JavaScript implements the editor UI/state.

- Backend (PHP, `src/`)
  - Manifest: `extension.json` (hooks, resource modules, API modules, rights, config; requires MediaWiki >= 1.44)
  - API modules (`src/Api/`)
    - `ApiLayersInfo`: read-only fetch of layer data and revision list for a file
    - `ApiLayersSave`: write endpoint to save a new layer set revision (requires CSRF token + rights)
  - Database access: `src/Database/LayersDatabase.php` (CRUD and JSON validation; schema in `sql/` + `sql/patches/`)
  - Hooks and Actions: `src/Hooks/*` and `Action/EditLayersAction.php` wire the editor into File pages and parser/wikitext
  - Security helpers: `src/Security/RateLimiter.php` (uses MediaWiki's pingLimiter + config)

- Frontend (JS, `resources/`)
  - Entry points: `ext.layers/init.js` (viewer bootstrap) and `ext.layers.editor/LayersEditor.js` (full editor)
  - Core editor modules: `CanvasManager.js` (rendering/interactions), `ToolManager.js`, `RenderEngine.js`, `SelectionManager.js`, `HistoryManager.js`
  - UI: `Toolbar.js`, `LayerPanel.js`, plus editor CSS (fixed/clean/simple themes)
  - Validation/Error handling: `LayersValidator.js`, `ErrorHandler.js`
  - Data flow: the editor keeps an in-memory `layers` array and uses `mw.Api` to GET `layersinfo` and POST `layerssave` with a JSON string of that state

Note on bundling: Webpack outputs `resources/dist/*.js`, but ResourceLoader modules (defined in `extension.json`) load the source files under `resources/ext.layers*`. Dist builds are optional for debugging/testing outside RL.

## 2) API contracts (client ↔ server)

Base route: MediaWiki Action API. Client uses `new mw.Api()`.

- layersinfo (read)
  - Params: filename (string, required), layersetid (int, optional)
  - Success payload (keyed by module name `layersinfo`):
    - layerset: null or object { id, imgName, userId, timestamp, revision, name, data, baseWidth, baseHeight }
      - data: server-decoded JSON structure of a saved set: { revision, schema: 1, created, layers: Array<Layer> }
      - baseWidth/baseHeight are source image dimensions to help client scale overlay accurately
    - all_layersets: Array of revisions for the image (includes ls_id, ls_revision, ls_name, ls_user_id, ls_timestamp, and ls_user_name for convenience)
  - Errors: 'layers-file-not-found', 'layers-layerset-not-found'

- layerssave (write)
  - Rights: user must have 'editlayers'
  - Token: needs CSRF token (client calls `api.postWithToken('csrf', ...)`)
  - Params: filename (string), data (stringified JSON, see data model), setname (optional short label), token (csrf)
  - Validation/limits (server-side; see also client validator):
    - Max payload bytes: `$wgLayersMaxBytes` (default 2MB)
    - Max layers per set: `$wgLayersMaxLayerCount` (default 100)
    - Strict property whitelist and type/length/range checks; unknown props are dropped; extreme values are rejected
    - Colors are strictly validated/sanitized; text is stripped of HTML and dangerous protocols
    - Rate limiting enforced via MediaWiki limiter (see RateLimits below)
  - Success payload (keyed by module name `layerssave`): { success: 1, layersetid, result: 'Success' }
  - Errors: 'layers-invalid-filename', 'layers-data-too-large', 'layers-json-parse-error', 'layers-invalid-data', 'layers-rate-limited', 'layers-file-not-found', 'layers-save-failed', 'dbschema-missing'

Contract note: The server persists a wrapped structure `{ revision, schema, created, layers }`. The client sends only the layers array as JSON string; the server performs validation/sanitization and constructs the full structure.

## 3) Data model (Layer objects)

Layer objects are a sanitized subset of the client model. Common fields (whitelist on server):
- id (string), type (enum: text, arrow, rectangle, circle, ellipse, polygon, star, line, highlight, path, blur)
- Geometry: x, y, width, height, radius, radiusX, radiusY, x1, y1, x2, y2, rotation (numbers in safe ranges)
- Style: stroke, fill, color, opacity/fillOpacity/strokeOpacity (0..1), strokeWidth, blendMode or blend (mapped), fontFamily, fontSize
- Arrow/line: arrowhead (none|arrow|circle|diamond|triangle), arrowStyle (solid|dashed|dotted), arrowSize
- Text: text (sanitized), textStrokeColor, textStrokeWidth, textShadow (bool), textShadowColor
- Effects: shadow (bool), shadowColor, shadowBlur, shadowOffsetX/Y, shadowSpread, glow (bool)
- Shapes/paths: points: Array<{x,y}> (capped ~1000)
- Flags: visible (bool), locked (bool), name (string)

Important: Unknown or invalid fields are dropped server-side. Keep editor state within these fields to avoid data loss.

## 4) Configuration and permissions

Set in `LocalSettings.php` (see `extension.json` for defaults):
- $wgLayersEnable (LayersEnable): master switch (default true)
- $wgLayersDebug (LayersDebug): verbose logging to 'Layers' channel (default true)
- $wgLayersMaxBytes (LayersMaxBytes): max JSON size per set (default 2MB)
- $wgLayersMaxLayerCount (LayersMaxLayerCount): max layers per set (default 100)
- $wgLayersDefaultFonts (LayersDefaultFonts): allowed fonts list used by the editor
- $wgLayersMaxImageSize (LayersMaxImageSize): max image size for editing (px)
- $wgLayersThumbnailCache (LayersThumbnailCache): cache composite thumbs
- $wgLayersImageMagickTimeout (LayersImageMagickTimeout): seconds for IM ops
- $wgLayersMaxImageDimensions (LayersMaxImageDimensions): max width/height for processing

Permissions (see `extension.json`):
- Rights: 'editlayers', 'createlayers', 'managelayerlibrary'
- Defaults: anonymous: editlayers=false; user: editlayers=true; autoconfirmed: createlayers=true; sysop: all true

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
- JS lint/style/i18n check: `npm test` (grunt runs eslint, stylelint, banana)
- JS unit tests (Jest): `npm run test:js` (optional `:watch` or `:coverage`)
- PHP style/lint: `composer test` (parallel-lint, phpcs, minus-x). PHP unit tests live under `tests/phpunit/` and require a MediaWiki test env.

Build
- Dev build: `npm run build:dev` (sources under `resources/ext.layers*`)
- Prod build: `npm run build` (writes `resources/dist/*.js`; not used by ResourceLoader modules by default)

Database
- Initial schema: `sql/layers_tables.sql`; patches in `sql/patches/`
- Apply/upgrade via MediaWiki: `php maintenance/update.php` from the MediaWiki root

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

- ESLint is configured to ignore:
  - `resources/dist/**`
  - `tests/jest/**`
  - `resources/ext.layers.editor/LayerPanel.js`
  - `resources/ext.layers/init.js`
- If you refactor ignored files, update the ignore list or conform to the code style before re-enabling linting

## 10) Troubleshooting tips

- Composer on Windows: ensure invoking PHP Composer (composer.phar) not a Python package named "composer" on PATH
- Database errors on save: confirm tables exist and run `maintenance/update.php`; server returns 'dbschema-missing' if not detected
- Missing messages: add to i18n and ResourceModules messages arrays; run `npm test` to see Banana warnings
- Rate limited: adjust `$wgRateLimits['editlayers-save']` etc. or use an account with appropriate rights

## 11) Quick reference (contracts)

- GET action=layersinfo&filename=File.jpg[&layersetid=ID]
  - Returns: { layersinfo: { layerset: { id, data:{revision,schema,created,layers:[]}, baseWidth, baseHeight, ... }, all_layersets:[...] } }
- POST action=layerssave (CSRF)
  - Params: filename, data='[ {...layer...} ]', setname?, token
  - Returns: { layerssave: { success: 1, layersetid } }

Keep this doc aligned with code. When you change public behavior (API, schema, messages), update this file and add tests where feasible.
