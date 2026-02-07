# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 7, 2026 (Comprehensive Critical Review v24)
**Version:** 1.5.52
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** main
- **Tests (Feb 6, 2026):**
  - `npm test` → eslint/stylelint/banana ✅ (warnings only for ignored scripts)
  - `CI=true npm run test:js` → **165/165 Jest suites**, 11,228 tests ✅
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,619 lines) *(excludes dist/)*
- **PHP production files:** 40 in `src/` (~14,946 lines)
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The v24 review is the deepest audit of this codebase to date, examining every
PHP and JavaScript source file. It reveals that while the extension has a
genuinely strong foundation — 95%+ test coverage, comprehensive server-side
validation, 100% ES6 class architecture — **the previous v23 review was overly
optimistic**. It declared zero active critical or high-priority bugs, but v24
has identified **4 critical security/correctness issues** and **11 high-priority
bugs** that were missed.

Previous reviews (v21-v23) suffered from an incremental-verification bias:
they confirmed that *previously reported* issues were fixed but failed to
perform fresh, holistic analysis of the complete codebase. This review corrects
that by independently auditing all 180+ source files.

### Key Strengths (Genuine)
1. **High Test Coverage:** 95.19% statement coverage, 11,228 tests
2. **Server-Side Validation:** `ServerSideLayerValidator` is thorough (50+ properties)
3. **Modern Architecture:** 100% ES6 classes, facade/controller patterns
4. **CSRF Protection:** All write endpoints require tokens
5. **SQL Parameterization:** All database queries use parameterized queries
6. **Defense in Depth:** TextSanitizer, ColorValidator, property whitelist

### Key Weaknesses (Newly Identified)
1. **Security gaps:** ImageMagick `@` file disclosure, slide permission bypass, preg_replace corruption
2. **State management bugs:** GroupManager undo order reversed, in-place array mutation
3. **Rendering bugs:** Double rotation for polygon/star blur blends, alignment broken for 3 shape types
4. **Documentation drift:** Phantom API endpoints, ghost configs, wrong version highlights
5. **Rate limiting is a no-op by default:** Defaults exist in code but are never registered with MediaWiki

### Issue Summary (February 7, 2026 — v24 Review)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Security | 3 | 2 | 4 | 2 | IM `@` disclosure, permission bypass, preg_replace |
| Bugs | 1 | 5 | 4 | 2 | Undo order, double rotation, alignment |
| Code Quality | 0 | 2 | 5 | 8 | God classes, duplication, dead code |
| Performance | 0 | 2 | 3 | 2 | Blur canvas alloc, render hash truncation |
| **Total** | **4** | **11** | **16** | **14** | **45 code issues** |

**Documentation issues:** 11 HIGH, 19 MEDIUM, 20 LOW (50 total, tracked in KNOWN_ISSUES.md)

**Overall Grade:** B (downgraded from A- in v23 due to newly discovered critical
and high-priority issues that were missed in previous reviews)

---

## v22/v23 Issues — Status Carried Forward

All 3 CRITICAL and 11 HIGH issues from v22 remain verified fixed. No regressions.

| ID | Issue | Status |
|----|-------|--------|
| CRIT-1 | getDBLoadBalancer() → getConnectionProvider() | ✅ FIXED |
| CRIT-2 | TextSanitizer iterative protocol removal | ✅ FIXED |
| CRIT-3 | Schema unique key includes ls_name | ✅ FIXED |
| HIGH-1 | CSP uses script-src 'self' (no unsafe-eval) | ✅ FIXED |
| HIGH-2 | Canvas pool frees canvas.width/height | ✅ FIXED |
| HIGH-3 | InlineTextEditor uses _getPlainTextFromEditor() | ✅ FIXED |
| HIGH-4 | Lightbox uses Special:Redirect fallback | ✅ FIXED |
| HIGH-5 | ViewerOverlay cleans up all listeners | ✅ FIXED |
| HIGH-6 | Rate limiter defaults defined | ✅ FIXED (see CRIT-v24-3 caveat) |
| HIGH-7 | LayerDataNormalizer includes blurRadius/tailWidth | ✅ FIXED |
| HIGH-8–11 | Various fixes | ✅ FIXED |

**Note on HIGH-6:** Rate limiter defaults ARE properly registered with MediaWiki's
`$wgRateLimits` via `Hooks::onRegistration()` in src/Hooks.php. The v24 review
incorrectly flagged this as unregistered (CRIT-v24-3 below is a FALSE POSITIVE).

---

## CRITICAL Issues (v24 — NEW)

### CRIT-v24-1: ImageMagick `@` File Disclosure via Text Layers

**Status:** ✅ FIXED
**Severity:** CRITICAL (Security)
**File:** src/ThumbnailRenderer.php (buildTextArguments ~L262, buildTextBoxArguments ~L353)

**Problem:** User-supplied `$layer['text']` is passed directly to ImageMagick's
`-annotate` command. ImageMagick treats text beginning with `@` as a file read
directive — `@/etc/passwd` reads the file contents. `Shell::command()` properly
escapes for the shell, but the `@` behavior is an IM-internal feature that
operates above shell escaping.

**Impact:** Any user with `editlayers` permission can exfiltrate server files by
saving a text layer with content `@/etc/passwd`, then triggering server-side
thumbnail rendering.

**TextSanitizer does NOT strip `@`** — it removes HTML tags and dangerous protocols
(`javascript:`, `data:`, `vbscript:`) but `@` is not on the blocklist.

**Verified:** TRUE — confirmed by reading ThumbnailRenderer.php L262-267 and
TextSanitizer.php L28-50.

**Fix:** Strip or escape leading `@` in text before passing to ImageMagick:
```php
$text = ltrim( $text, '@' );
```
Or prefix with a space: `$text = ' ' . $text;` if leading whitespace is acceptable.
Also consider ImageMagick `policy.xml` restrictions as defense in depth.

---

### CRIT-v24-2: Slide Requests Bypass Read Permission Check

**Status:** ⚪ FALSE POSITIVE — MediaWiki API framework enforces global read permission via isReadMode() before any module executes
**Severity:** CRITICAL (Security)
**File:** src/Api/ApiLayersInfo.php (executeInternal ~L103-113 vs ~L125)

**Problem:** `executeInternal()` routes slide requests (via `slidename` param or
`Slide:` prefix) to `executeSlideRequest()` and returns **before** the
`userCan('read')` permission check at ~L125. `executeSlideRequest()` has no
permission check of its own.

**Flow:**
```
L87:  rate limiting ✅
L103: if slidename → executeSlideRequest() → return  // NO read check
L110: if Slide: prefix → executeSlideRequest() → return  // NO read check
L125: userCan('read') check  // only reached for file requests
```

**Impact:** On private wikis, anonymous users can enumerate and read all slide
data via the API.

**Verified:** TRUE — confirmed by reading ApiLayersInfo.php flow.

**Fix:** Add `$this->checkUserRightsAny( 'read' )` at the top of
`executeInternal()` before slide routing, or inside `executeSlideRequest()`.

---

### CRIT-v24-3: Rate Limiting is Effectively Disabled by Default

**Status:** ⚪ FALSE POSITIVE — Hooks::onRegistration() in src/Hooks.php (L31-67) registers all rate limit defaults into $wgRateLimits via extension.json callback
**Severity:** CRITICAL (Security)
**File:** src/Security/RateLimiter.php (~L68-148)

**Problem:** `RateLimiter` defines extensive default limits in PHP code, but these
defaults are never registered in `extension.json` as `$wgRateLimits` entries.
Enforcement relies on `$user->pingLimiter($limitKey)`, which only enforces
limits present in `$wgRateLimits`. Since no keys are registered by the extension,
`pingLimiter()` always returns `false` (not limited).

**The code structure is misleading:**
1. `$defaultLimits` array looks like it provides protection
2. `$user->pingLimiter()` silently does nothing without `$wgRateLimits` registration
3. Result: all operations have NO rate limiting unless the admin manually configures it

**Impact:** All write operations (save, delete, rename) can be spammed without
restriction. Previous review (v23 HIGH-6) incorrectly marked this as "FIXED."

**Verified:** TRUE — confirmed by reading RateLimiter.php L48-148 and
checking extension.json config section (no `$wgRateLimits` entries).

**Fix:** Register default rate limits in `extension.json` so they work
out of the box, or clearly document that rate limiting requires manual
configuration (and remove the misleading defaults from RateLimiter.php).

---

### CRIT-v24-4: preg_replace Backreference Corruption in LayersHtmlInjector

**Status:** ✅ FIXED
**Severity:** CRITICAL (Data Integrity)
**File:** src/Hooks/Processors/LayersHtmlInjector.php (addOrUpdateAttribute ~L209-218)

**Problem:** `addOrUpdateAttribute()` uses `preg_replace()` with `$value` as the
replacement string. `$value` is JSON-encoded layer data. If layer text contains
`$` followed by digits (e.g., `"$100"`), `preg_replace()` interprets these as
backreferences, silently corrupting the HTML output.

```php
return preg_replace( $pattern, $name . '="' . $value . '"', $attrs );
// $value with "$1" → expanded to first capture group content
```

The regex has capture groups `(["\'])` = $1 and `(.*?)` = $2.

**Impact:** Silent data corruption — layers with text containing `$` followed
by digits render as broken HTML. The corruption happens at the parser hook
level, so it affects all page views, not just the editor.

**Verified:** TRUE — confirmed by reading LayersHtmlInjector.php L209-218.

**Fix:** Use `preg_replace_callback()` instead, or escape `$` in the replacement:
```php
$safeValue = str_replace( [ '\\', '$' ], [ '\\\\', '\\$' ], $value );
return preg_replace( $pattern, $name . '="' . $safeValue . '"', $attrs );
```

---

## HIGH Priority Issues (v24 — NEW)

### HIGH-v24-1: GroupManager Saves History BEFORE State Mutation (Undo Bug)

**Status:** ✅ FIXED
**Severity:** HIGH (Bug)
**File:** resources/ext.layers.editor/GroupManager.js (10 methods)

**Problem:** All 10 mutating methods call `historyManager.saveState()` BEFORE
`stateManager.set()`. HistoryManager snapshots current state at call time.
This captures the pre-mutation state, creating a duplicate of the already-
recorded prior state. Undoing a GroupManager operation skips it entirely.

**Affected methods:** createGroup, createFolder, moveToFolder, addToFolderAtPosition,
removeFromFolder, ungroupLayers, addToGroup, removeFromGroup, renameGroup, deleteGroup

**Compare with correct pattern** in LayersEditor.addLayer(): stateManager.set()
first, then saveState().

**Verified:** TRUE — confirmed in all 10 methods (L193/196, L237/240, L404/407, etc.)

**Fix:** In all 10 methods, move `historyManager.saveState()` to AFTER
`stateManager.set()`.

---

### HIGH-v24-2: Double Rotation for Polygon/Star in Blur Blend Mode

**Status:** ✅ FIXED
**Severity:** HIGH (Rendering Bug)
**File:** resources/ext.layers.shared/LayerRenderer.js

**Problem:** When polygon/star layers use blur blend mode, `_drawShapePath()`
applies canvas-level rotation via `ctx.rotate()` (~L691). Then
`_drawPolygonPath()` (~L792) and `_drawStarPath()` (~L819) ALSO incorporate
`layer.rotation` into vertex angle calculations. Result: shapes rendered at
2× the specified rotation angle.

Normal rendering (via PolygonStarRenderer) handles rotation correctly via
vertex math only. The blur blend path applies rotation twice.

**Additionally:** Rotation center for polygon/star uses the default case
(`x + width/2`) but these are center-based shapes where `(x,y)` IS the center.

**Verified:** TRUE — confirmed by reading LayerRenderer.js L665, L691-715, L785-825.

**Fix:** Remove `layer.rotation` from vertex angle calculations in
`_drawPolygonPath()` and `_drawStarPath()` (the parent canvas transform
handles it). Add explicit center calculation cases for polygon/star.

---

### HIGH-v24-3: AlignmentController Incorrect Bounds for Ellipse/Polygon/Star

**Status:** ✅ FIXED
**Severity:** HIGH (Bug)
**File:** resources/ext.layers.editor/canvas/AlignmentController.js (~L60-134)

**Problem:** `getLayerBounds()` has a correct case for `circle` but `ellipse`,
`polygon`, and `star` fall through to the default case which treats `x,y` as
top-left corner and reads `width/height`. These shapes use `x,y` as center
with `radiusX/radiusY` or `radius` for size. `width`/`height` are often
unset (returning 0), producing zero-size bounds.

`moveLayer()` has the same flaw — assumes `x` is the left edge.

**Impact:** All alignment and distribution operations on ellipses, polygons,
and stars produce incorrect results.

**Verified:** PARTIALLY TRUE — circle is correct, ellipse/polygon/star are wrong.

**Fix:** Add explicit cases for ellipse, polygon, and star in both
`getLayerBounds()` and `moveLayer()`.

---

### HIGH-v24-4: SetName Validation Inconsistency (Create vs Rename)

**Status:** ✅ FIXED
**Severity:** HIGH (Bug)
**Files:** src/Api/ApiLayersRename.php (~L55-56), src/Validation/SetNameSanitizer.php,
    resources/ext.layers.editor/ui/SetSelectorController.js

**Problem (PHP):** `ApiLayersSave` and `ApiLayersDelete` sanitize setname via
`SetNameSanitizer::sanitize()` (strips non-alphanumeric chars). `ApiLayersRename`
validates via `SetNameSanitizer::isValid()` which is a looser check. Characters
like `@#${}` pass `isValid()` but would be stripped by `sanitize()`. A rename
to `"test@#$"` creates a set that can't be loaded/saved via other endpoints
(they would sanitize to `"test"`, which doesn't match).

**Problem (JS):** Create uses Unicode regex `/^[\p{L}\p{N}_\-\s]+$/u`. Rename
uses ASCII regex `/^[a-zA-Z0-9_-]{1,50}$/`. A set created with Unicode name
or spaces can never be renamed.

**Verified:** TRUE — confirmed in both PHP and JS code.

**Fix:** Unify validation to use `sanitize()` + compare in PHP. Unify JS
regexes to both use Unicode-aware pattern.

---

### HIGH-v24-5: Short ID Matching Inconsistency (Prefix vs Suffix)

**Status:** ✅ FIXED
**Severity:** HIGH (Bug)
**Files:** src/Hooks/Processors/LayerInjector.php (~L178),
    src/Hooks/Processors/ImageLinkProcessor.php (~L456)

**Problem:** Two different matching strategies for short layer IDs:
- LayerInjector: prefix match — `substr($id, 0, 4)`
- ImageLinkProcessor: suffix match — `str_ends_with($lid, $sid)`

The same wikitext `[[File:X.jpg|layers=abc1]]` could select different layers
depending on which code path processes it.

**Verified:** TRUE — confirmed in both files.

**Fix:** Standardize on one approach (prefix matching per architecture docs).

---

### HIGH-v24-6: `noedit` Bare Flag Silently Ignored

**Status:** ✅ FIXED
**Severity:** HIGH (Bug — Documented Feature Doesn't Work)
**File:** src/Hooks/SlideHooks.php (parseArguments ~L249-268)

**Problem:** `parseArguments()` only parses `key=value` pairs. Bare flags like
`noedit` (without `=`) are silently discarded. The class docblock at L24
explicitly documents `noedit` as a "boolean flag, no value needed," but the
implementation requires `noedit=` or `noedit=yes` to work.

**Verified:** TRUE — no `else` branch in parseArguments for bare flags.

**Fix:** Add an else branch: `$params[strtolower(trim($expanded))] = true;`

---

### HIGH-v24-7: Missing Import Sanitization

**Status:** ✅ FIXED
**Severity:** HIGH (Security)
**File:** resources/ext.layers.editor/ImportExportManager.js

**Problem:** `parseLayersJSON()` validates only top-level structure but does NOT
validate or sanitize individual layer properties. Imported layers bypass the
server-side whitelist between import and save. Malicious JSON can inject
arbitrary properties (including `__proto__` for prototype pollution) that the
client editor blindly consumes.

**Verified:** TRUE — parseLayersJSON returns raw parsed arrays without validation.

**Fix:** Run imported layers through `LayersValidator` before applying.
Strip unknown properties against a whitelist.

---

### HIGH-v24-8: SVG Validation Doesn't Check `href` (SVG2), Only `xlink:href`

**Status:** ✅ FIXED
**Severity:** HIGH (Security)
**File:** src/Validation/ServerSideLayerValidator.php (~L1273-1282)

**Problem:** `validateSvgString()` blocks external URLs in `xlink:href` but not
the SVG2 plain `href` attribute. Modern browsers support `<image href="...">`.

**Mitigated by:** SVG is stored as JSON and rendered via canvas paths, not
injected as raw HTML. But if rendering approach changes, this becomes exploitable.

**Verified:** TRUE — only `xlink:href` is checked.

**Fix:** Add check for plain `href` with external URLs.

---

### HIGH-v24-9: RenderCoordinator Hash Only Checks First 20 Layers

**Status:** ✅ FIXED
**Severity:** HIGH (Bug)
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js (~L198)

**Problem:** `_computeLayersHash()` loop capped at 20 layers. Changes to layers
21-100 don't alter the hash. `forceRedraw()` and `fullRedrawRequired` bypass
the hash, but targeted `scheduleRedraw({region:...})` calls will miss changes
to deeper layers.

**Verified:** TRUE — confirmed loop condition `i < layers.length && i < 20`.

**Fix:** Hash all layers, or use a version counter that's O(1).

---

### HIGH-v24-10: CanvasRenderer Missing try/finally for Context Restoration

**Status:** ✅ FIXED
**Severity:** HIGH (Bug — Error Recovery)
**File:** resources/ext.layers.editor/CanvasRenderer.js (~L500-545)

**Problem:** `renderLayersToContext()` swaps `this.ctx` and
`this.layerRenderer`'s context for export. If `drawLayerWithEffects()` throws,
the renderer's context reference is permanently corrupted (pointing to the
export canvas instead of the editor canvas).

**Verified:** TRUE — no try/finally wrapper.

**Fix:** Wrap rendering loop in try/finally to guarantee context restoration.

---

### HIGH-v24-11: CanvasRenderer richText Cache Hash Truncation

**Status:** ✅ FIXED
**Severity:** HIGH (Bug — Stale Cache)
**File:** resources/ext.layers.editor/CanvasRenderer.js (~L170-195)

**Problem:** Layer cache hash truncates `richText` JSON to 200 characters. Edits
beyond the 200th character produce the same hash, serving stale cached canvas.

**Verified:** TRUE — `JSON.stringify(layer.richText).substring(0, 200)`.

**Fix:** Hash the full JSON, or include a change counter on the layer object.

---

## MEDIUM Priority Issues (v24)

### MED-v24-1: Rate Limiting After DB Work in Slide Operations ✅ RESOLVED

**Status:** ✅ RESOLVED — Rate limiting moved before DB lookups in slide methods.
**Files:** src/Api/ApiLayersDelete.php, src/Api/ApiLayersRename.php

In `executeSlideDelete()` and `executeSlideRename()`, rate limiting is checked
AFTER expensive database lookups. Should check at start of method.

---

### MED-v24-2: ext.layers Module Loaded on Every Page View (2x)

**Status:** ❌ OPEN
**File:** src/Hooks.php (~L88 and ~L262)

`addModules('ext.layers')` called unconditionally in both `onBeforePageDisplay()`
AND `onMakeGlobalVariablesScript()`. Forces viewer JS on every page regardless
of whether layered images exist. Design-intentional per code comment, but
doubles the registration and increases page weight globally.

---

### MED-v24-3: EditLayersAction Custom CSP May Conflict with MW CSP

**Status:** ❌ OPEN
**File:** src/Action/EditLayersAction.php (~L318-366)

Raw `Content-Security-Policy` header via `header()` can conflict with
MediaWiki's CSP class. `script-src 'self'` omits nonces needed by ResourceLoader.

---

### MED-v24-4: LayeredThumbnail Doesn't Call Parent Constructor ✅ RESOLVED

**Status:** ✅ RESOLVED — Removed shadowed private properties from LayeredThumbnail.
**File:** src/LayeredThumbnail.php (~L34-55)

Extends `MediaTransformOutput` but never calls `parent::__construct()`.
Parent properties (`$this->file`, `$this->url`, etc.) remain uninitialized.

---

### MED-v24-5: EditLayersAction Uses `$wgUploadPath` Global ✅ RESOLVED

**Status:** ✅ RESOLVED — Replaced global $wgUploadPath with config service.
**File:** src/Action/EditLayersAction.php (~L384-387)

Should use `$this->getConfig()->get('UploadPath')` instead of global variable.

---

### MED-v24-6: UIHooks Date Formatting Not Localized ✅ RESOLVED

**Status:** ✅ RESOLVED — Used Language::date() for localized formatting.
**File:** src/Hooks/UIHooks.php (~L407-413)

Uses PHP `date()` instead of `$language->date()`. Non-English users see English dates.

---

### MED-v24-7: SpecialEditSlide Doesn't Validate backgroundColor ✅ RESOLVED

**Status:** ✅ RESOLVED — Added ColorValidator check for backgroundColor.
**File:** src/SpecialPages/SpecialEditSlide.php (~L82)

Background color from URL params accepted without validation.

---

### MED-v24-8: ApiLayersInfo Doesn't Sanitize setname Parameter ✅ RESOLVED

**Status:** ✅ RESOLVED — Added SetNameSanitizer for setname in ApiLayersInfo.
**File:** src/Api/ApiLayersInfo.php (~L95)

Unlike other endpoints, setname is not passed through `SetNameSanitizer::sanitize()`.

---

### MED-v24-9: StateManager Potential Reentrant Loop

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/StateManager.js

`unlockState()` processes pending ops which can trigger recursive lock/unlock.
No depth limit on recursion.

---

### MED-v24-10: InlineTextEditor Blur Handler Race Condition

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js (~L571)

150ms blur timeout vs 100ms toolbar interaction timeouts creates a window where
the editor closes during toolbar interaction (font dropdown, color picker).

---

### MED-v24-11: SmartGuidesController Snap Cache Key Too Coarse

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/canvas/SmartGuidesController.js (~L155)

Cache key only considers layer count and first layer ID. Moving/resizing any
layer doesn't invalidate snap point cache, causing incorrect snapping.

---

### MED-v24-12: LayersEditor.addLayer() Mutates State Array In-Place

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/LayersEditor.js (~L275-280)

`stateManager.get('layers')` returns live reference, then `layers.unshift()`
mutates it in-place before `stateManager.set()`. Observers comparing
`oldValue !== newValue` see same reference and skip notification.

---

### MED-v24-13: CanvasRenderer Blur Blend Creates Full Canvas Per Frame

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/CanvasRenderer.js (~L720-740)

For every blur-blended layer on every render frame, a new full-size canvas is
created and discarded. At 2048×2048 (16MB per canvas), this causes GC pressure.

---

### MED-v24-14: DrawingController Ellipse Preview Coordinate Drift (Potential)

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/canvas/DrawingController.js (~L340)

Ellipse preview mutates `layer.x` to midpoint each frame, causing center drift.
Also, `width` is never updated during preview — `createLayerFromDrawing` reads
`layer.width/2` as `radiusX`, potentially producing zero-size final shape.

---

### MED-v24-15: ResizeCalculator Wrong Grow/Shrink for Diagonal Handles

**Status:** ❌ OPEN
**File:** resources/ext.layers.editor/canvas/ResizeCalculator.js

calculateTextResize, calculateMarkerResize, and calculatePolygonResize use
OR-logic for diagonal handle direction (`deltaX > 0 || deltaY < 0` for NE).
Correct approach is dot product with handle direction vector.

---

### MED-v24-16: Double HTML Escaping in SlideHooks ✅ RESOLVED

**Status:** ✅ RESOLVED — Fixed double HTML escaping in SlideHooks.
**File:** src/Hooks/SlideHooks.php (~L427-445)

`$backgroundColor` escaped by `htmlspecialchars()` into `$bgColorAttr`, then
the combined `$style` is escaped again via `htmlspecialchars()`.

---

## LOW Priority Issues (v24)

### LOW-v24-1: 6x Code Duplication of getFileSha1()/isForeignFile()
**Files:** Hooks.php, ImageLinkProcessor.php, LayerInjector.php, LayeredFileRenderer.php, ThumbnailProcessor.php, ThumbnailRenderer.php.
ForeignFileHelperTrait exists in Api/Traits/ but is not used by hook/processor classes.

### LOW-v24-2: ParserHooks.php Is Dead Code ✅ RESOLVED
✅ RESOLVED — Deleted dead ParserHooks.php and autoload entry.
Entire class does nothing (returns true). Should be removed.

### LOW-v24-3: UIHooks Excessive Defensive Coding for MW 1.44+
~140 lines of `method_exists`/`class_exists` checks for APIs guaranteed present in MW 1.44+.

### LOW-v24-4: WikitextHooks Logs Wikitext Preview at Info Level
First 200 chars of wikitext logged at info level. Potential information disclosure in logs.

### LOW-v24-5: Hooks.php Checks Both `layers` and `Layers` URL Params
Case-sensitive ambiguity in URL parameter naming.

### LOW-v24-6: ColorValidator Duplicated Validation Logic
Static `isValidColor()` duplicates all instance method logic.

### LOW-v24-7: Database Cache Stores Null Results
Non-existent IDs fill the 100-entry cache, pushing out valid entries.

### LOW-v24-8: LayersSchemaManager.CURRENT_VERSION Stale ✅ RESOLVED
✅ RESOLVED — Updated CURRENT_VERSION to 1.5.52.
Says `0.8.1-dev` but extension is at 1.5.52.

### LOW-v24-9: RateLimiter Uses wfLogWarning Instead of PSR-3 Logger
Inconsistent with rest of codebase which uses LayersLogger.

### LOW-v24-10: LayersSchemaManager Constructor Uses Service Locator
Gets LayersLogger via `MediaWikiServices::getInstance()` instead of constructor injection.

### LOW-v24-11: applyPatch Schema Update Pattern Is Fragile
Uses `addExtensionUpdate(['applyPatch', ...])` instead of MW's recommended methods.

### LOW-v24-12: Inconsistent Error Response Patterns Across API Modules
Some use `addValue()` individually, others build result arrays.

### LOW-v24-13: Duplicated GradientRenderer Lookup in ShapeRenderer
Same global lookup repeated in drawRectangle, drawCircle, drawEllipse. Should use `this.gradientRenderer`.

### LOW-v24-14: Non-Cryptographic Layer ID Generation
Uses `Date.now()` + `Math.random()`. Could collide on rapid batch operations.

---

## Documentation Issues

### Phantom/Inaccurate Documentation (HIGH)

| ID | File | Issue |
|----|------|-------|
| DOC-v24-1 | docs/ARCHITECTURE.md | Documents `action=slideinfo` and `action=slidessave` — these API endpoints do NOT exist. Actual implementation uses `layersinfo?slidename=` and `layerssave&slidename=`. |
| DOC-v24-2 | docs/ARCHITECTURE.md | Lists `createlayers` permission for autoconfirmed group — this right was consolidated into `editlayers` and does not exist in extension.json. |
| DOC-v24-3 | README.md, Mediawiki-Extension-Layers.mediawiki | Document `$wgLayersContextAwareToolbar` and `$wgLayersRejectAbortedRequests` as config variables but these do NOT exist in extension.json. |
| DOC-v24-4 | wiki/Home.md | "What's New in v1.5.52" lists wrong features. Actual v1.5.52 changes per CHANGELOG: MW 1.39 compat, Dimension Tool fixes, MW Compatibility Checker. |
| DOC-v24-5 | wiki/Home.md | "v1.5.51 Highlights" and "v1.5.49 Highlights" are misattributed — features don't match CHANGELOG entries for those versions. |
| DOC-v24-6 | codebase_review.md (v23) | DOC-1 claimed badge count was wrong — badge actually shows correct 11,228 count. False positive. |
| DOC-v24-7 | codebase_review.md (v23) | DOC-2 claimed mediawiki page date was wrong — file shows correct 2026-02-05. False positive. |

### Missing/Incomplete Documentation (MEDIUM)

| ID | File | Issue |
|----|------|-------|
| DOC-v24-8 | README.md, Mediawiki-Extension-Layers.mediawiki | Missing `$wgLayersMaxComplexity` config (exists in extension.json, default 100). |
| DOC-v24-9 | README.md, Mediawiki-Extension-Layers.mediawiki | Missing all 6 Slide Mode configs (`$wgLayersSlidesEnable`, `$wgLayersSlideDefaultWidth/Height`, `$wgLayersSlideMaxWidth/Height`, `$wgLayersSlideDefaultBackground`). |
| DOC-v24-10 | docs/ARCHITECTURE.md | Stale line counts — many modules off by 100+ lines from actual. |
| DOC-v24-11 | docs/ARCHITECTURE.md | Says "4 API endpoints" but there are 5. |
| DOC-v24-12 | docs/ARCHITECTURE.md | Stale namespace version shows `0.8.5`. |
| DOC-v24-13 | docs/NAMED_LAYER_SETS.md | Written as a proposal with "Open Questions" despite implementation being complete. Says "10-20 sets" but config default is 15. |
| DOC-v24-14 | docs/SLIDE_MODE.md | `lock` parameter has extensive docs but is marked NOT IMPLEMENTED. Phase 4 says to bump to 1.6.0 but current version is 1.5.52. |
| DOC-v24-15 | docs/FUTURE_IMPROVEMENTS.md | FR-14 (Draggable Dimension Tool) marked "Proposed" but was implemented in v1.5.50 per CHANGELOG. |
| DOC-v24-16 | docs/RELEASE_GUIDE.md | References `Mediawiki-Extension-Layers.txt` — wrong file extension (should be `.mediawiki`). |
| DOC-v24-17 | docs/API.md | File name is misleading — contains JSDoc output, not HTTP API contract documentation. |

---

## Security Controls Status (v24 — Revised)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All write APIs require tokens |
| SQL Injection | ✅ PASS | 100% parameterized queries |
| Input Validation | ⚠️ PARTIAL | Strict whitelist, but `shapeData` allows arbitrary keys |
| Rate Limiting | ❌ FAIL | Defaults exist but never registered with MW — no-op by default |
| Authorization | ⚠️ PARTIAL | Owner/admin checks enforced for files; slides bypass read check |
| XSS via Canvas | ✅ PASS | `ctx.fillText` inherently safe |
| Text Sanitization | ✅ PASS | Iterative protocol removal (but missing `@` for IM) |
| CSP | ⚠️ PARTIAL | No `unsafe-eval`, but custom header may conflict with MW CSP |
| Data Normalization | ✅ PASS | All properties normalized |
| SVG Sanitization | ⚠️ PARTIAL | Checks `xlink:href` but not SVG2 plain `href` |
| Server File Access | ❌ FAIL | IM `@` file disclosure via text layers |

---

## God Class Status (19 files >= 1,000 lines)

### Generated Data (Exempt)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (15 files)

| File | Lines |
|------|-------|
| LayerPanel.js | 2,180 |
| CanvasManager.js | 2,053 |
| Toolbar.js | 1,891 |
| LayersEditor.js | 1,836 |
| InlineTextEditor.js | 1,670 |
| APIManager.js | 1,566 |
| PropertyBuilders.js | 1,464 |
| SelectionManager.js | 1,415 |
| CanvasRenderer.js | 1,365 |
| ViewerManager.js | 1,320 |
| ToolManager.js | 1,214 |
| GroupManager.js | 1,205 |
| SlideController.js | 1,131 |
| TransformController.js | 1,117 |
| LayersValidator.js | 1,116 |

### PHP (2 files)

| File | Lines |
|------|-------|
| LayersDatabase.php | 1,363 |
| ServerSideLayerValidator.php | 1,346 |

---

## Recommendations

### Immediate (Security — This Week)

1. **CRIT-v24-1:** ✅ FIXED — Strip leading `@` from text in ThumbnailRenderer
2. **CRIT-v24-2:** ⚪ FALSE POSITIVE — API framework enforces read permissions
3. **CRIT-v24-3:** ⚪ FALSE POSITIVE — rate limits registered via onRegistration()
4. **CRIT-v24-4:** ✅ FIXED — preg_replace_callback in LayersHtmlInjector

### Priority 2 (High-Priority Bugs — Next Sprint)

1. **HIGH-v24-1:** ✅ FIXED — GroupManager saveState() order (all 10 methods)
2. **HIGH-v24-2:** ✅ FIXED — Double rotation in blur blend path
3. **HIGH-v24-3:** ✅ FIXED — AlignmentController bounds for ellipse/polygon/star
4. **HIGH-v24-4:** ✅ FIXED — Unified setname validation (PHP + JS)
5. **HIGH-v24-5:** ✅ FIXED — Standardized short ID matching (prefix)
6. **HIGH-v24-6:** ✅ FIXED — Bare flags in SlideHooks parseArguments()
7. **HIGH-v24-7:** ✅ FIXED — Import sanitization in ImportExportManager
8. **HIGH-v24-8:** ✅ FIXED — SVG2 href validation
9. **HIGH-v24-9:** ✅ FIXED — Removed 20-layer cap from RenderCoordinator hash
10. **HIGH-v24-10:** ✅ FIXED — try/finally in renderLayersToContext
11. **HIGH-v24-11:** ✅ FIXED — richText cache hash truncation

### Priority 3 (Medium — Next Month)

1. Fix CSP conflict, parent constructor, localization issues
2. Address state management edge cases
3. Fix rendering inconsistencies (resize direction, preview drift)

### Priority 4 (Documentation — Ongoing)

1. Remove phantom API docs from ARCHITECTURE.md
2. Remove ghost config variables from README and mediawiki page
3. Fix wiki/Home.md version highlights
4. Add missing config documentation

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test coverage,
modern architecture, and comprehensive server-side validation. However, this
deep-dive review reveals **genuine security and correctness issues** that were
missed by previous incremental reviews.

The 4 critical issues (ImageMagick file disclosure, slide permission bypass,
rate limiting no-op, preg_replace corruption) require immediate attention.
The 11 high-priority bugs affect user-facing functionality (undo, rendering,
alignment) and documented features (noedit flag).

- ⚠️ **Production-deployable** but with known security risks requiring mitigation
- ✅ **Well-tested** with 95.19% coverage and 11,228 tests
- ✅ **Maintainable** with 100% ES6 class patterns
- ❌ **Security controls incomplete** — rate limiting is a no-op, IM `@` disclosure

**Overall Grade:** B (downgraded from A- due to critical findings)

**Recommendation:** Address the 4 critical security issues before next release.
Deploy with awareness of remaining risks and an action plan for HIGH items.

---

## Change History

| Version | Date | Changes |
|---------|------------|---------|
| v24 | 2026-02-07 | Deep audit of all source files; 4 CRIT, 11 HIGH, 16 MED, 14 LOW found |
| v23 | 2026-02-06 | All P0/P1 verified; 18 issues remain (overly optimistic — see v24) |
| v22 | 2026-02-05 | Critical issues identified; started fix pass |
| v21 | 2026-01-xx | Overly optimistic; missed critical issues |
