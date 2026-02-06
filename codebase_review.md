# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 5, 2026 (Comprehensive Critical Review v22)
**Version:** 1.5.52
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch:** main (verified via `git branch --show-current`)
- **Tests (Feb 5, 2026):**
  - `npm test` → eslint/stylelint/banana ✅ (warnings only for ignored scripts)
  - `CI=true npm run test:js` → **165/165 Jest suites**, 11,243 tests ✅
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,582 lines)
- **PHP production files:** 40 in `src/` (~14,888 lines)
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The Layers extension is a **feature-rich, well-tested system** with high test
coverage (95.19%). However, this v22 review—the most thorough to date—has
uncovered **significant issues** that previous reviews missed or underreported.

**The v21 review's claim of "No exploitable security vulnerabilities" was
premature.** This review identifies real security weaknesses, a critical
compatibility issue with the extension's stated minimum MediaWiki version, and
several genuine bugs in both frontend and backend code.

### Key Strengths
1. **High Test Coverage:** 95.19% statement coverage, 11,243 tests
2. **Server-Side Validation:** `ServerSideLayerValidator` is thorough (50+ properties)
3. **Modern Architecture:** 100% ES6 classes, facade/controller patterns
4. **CSRF Protection:** All write endpoints require tokens
5. **SQL Parameterization:** All database queries use parameterized queries

### Key Weaknesses Found (New in v22)
1. ~~**Critical MW Compatibility:** `getDBLoadBalancer()` removed in MW 1.42, but extension requires ≥1.44~~ — **FIXED**
2. ~~**Security Gaps:** TextSanitizer protocol bypass, CSP `unsafe-eval`, missing normalizer properties~~ — **FIXED**
3. ~~**Real Bugs:** Canvas pool memory leak, InlineTextEditor broken input, wrong lightbox URLs~~ — **FIXED**
4. **Dead Code:** SlideManager.js tested but never loaded by ResourceLoader
5. **Documentation Decay:** Line counts, dates, and status trackers are stale across 15+ files

### Issue Summary (February 5, 2026 - v22 Review)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Compatibility | 1 | 1 | 0 | 0 | MW 1.44 breakage |
| Security | 1 | 2 | 3 | 0 | Protocol bypass, CSP, validation gaps |
| Bugs | 1 | 4 | 3 | 2 | Memory leak, rendering, input handling |
| Code Quality | 0 | 0 | 4 | 5 | Duplication, dead code, inconsistencies |
| Performance | 0 | 1 | 3 | 1 | Canvas allocation, O(n) lookups |
| Documentation | 0 | 2 | 5 | 5 | Stale counts, dates, status tracking |
| Database | 0 | 1 | 2 | 1 | Schema mismatch, CASCADE, TINYINT |
| **Total** | **3** | **11** | **20** | **14** | **48 issues total** |

---

## ��� CRITICAL Issues

### CRIT-1: getDBLoadBalancer() Fatal Error on MW >= 1.42

**Status:** ✅ FIXED
**Severity:** CRITICAL (Extension Non-Functional)
**Files:** services.php:24, ApiLayersInfo.php:639, LayersSchemaManager.php:400, tests/LayersTest.php:80

**Problem:** `MediaWikiServices::getDBLoadBalancer()` was deprecated in MW 1.39
and **removed** in MW 1.42. Since `extension.json` declares
`"requires": { "MediaWiki": ">= 1.44.0" }`, this extension **will fatal error
on any supported MediaWiki version**.

```php
// services.php line 24 — Fatal on MW 1.44+
$services->getDBLoadBalancer()
```

**Impact:** The extension is completely non-functional on MW 1.44+. It only works
on MW versions it claims not to support (1.39-1.41).

**Fix:** Migrate to `$services->getConnectionProvider()` / `IConnectionProvider`
(available since MW 1.39).

---

### CRIT-2: TextSanitizer Protocol Removal Can Be Bypassed via Nesting

**Status:** ✅ FIXED
**Severity:** CRITICAL (XSS Risk)
**File:** src/Validation/TextSanitizer.php:82-92

**Problem:** `removeDangerousProtocols()` uses single-pass `str_ireplace()`.
Nested protocol strings survive:

```
Input:  "javajavaScript:script:alert(1)"
After:  "javascript:alert(1)"       ← bypass!
```

**Fix:** Loop until no more replacements occur:
```php
do {
    $before = $text;
    foreach ( $dangerousProtocols as $protocol ) {
        $text = str_ireplace( $protocol, '', $text );
    }
} while ( $text !== $before );
```

---

### CRIT-3: SQL Schema Mismatch Between layers_tables.sql and tables/layer_sets.sql

**Status:** ✅ FIXED
**Severity:** CRITICAL (Data Integrity)
**Files:** sql/layers_tables.sql:19 vs sql/tables/layer_sets.sql:16

**Problem:** The per-table schema file uses the **old** unique key:
```sql
-- sql/tables/layer_sets.sql (WRONG)
UNIQUE KEY ls_img_name_revision (ls_img_name, ls_img_sha1, ls_revision)

-- sql/layers_tables.sql (CORRECT)
UNIQUE KEY ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision)
```

If MediaWiki's schema manager uses the per-table files for new installs, named
layer sets will break (revision number conflicts across different named sets).

---

## ��� HIGH Priority Issues

### HIGH-1: CSP Policy Includes unsafe-eval and unsafe-inline

**Status:** ✅ FIXED
**Severity:** HIGH (Security)
**File:** src/Action/EditLayersAction.php:348

**Problem:** The CSP header for foreign files includes `'unsafe-eval' 'unsafe-inline'`
in `script-src`, negating XSS protection from CSP.

**Scope:** Only applied for foreign files (InstantCommons), not all pages. But any
XSS within those pages bypasses CSP entirely.

---

### HIGH-2: Canvas Pool destroy() Doesn't Free Canvas Memory

**Status:** ✅ FIXED
**Severity:** HIGH (Memory Leak)
**File:** resources/ext.layers.editor/CanvasManager.js:2014-2017

**Problem:** Pool items are `{canvas, context}` wrappers, but `destroy()` sets
properties on the wrapper, not the actual canvas element:

```javascript
this.canvasPool.forEach( function ( pooledCanvas ) {
    pooledCanvas.width = 0;   // sets on wrapper, NOT on canvas element
    pooledCanvas.height = 0;  // canvas memory NOT released
} );
```

**Fix:** `pooledCanvas.canvas.width = 0; pooledCanvas.canvas.height = 0;`

---

### HIGH-3: InlineTextEditor _handleInput() Broken for Multiline Types

**Status:** ✅ FIXED
**Severity:** HIGH (Feature Bug)
**File:** resources/ext.layers.editor/canvas/InlineTextEditor.js:883-887

**Problem:** For textbox/callout types, `editorElement` is a `<div contentEditable>`,
which has no `.value` property. `this.editorElement.value` returns `undefined`,
silently erasing the text property during editing:

```javascript
_handleInput() {
    if ( this.editingLayer && this.editorElement ) {
        this.editingLayer.text = this.editorElement.value; // undefined for contentEditable!
    }
}
```

**Fix:** Use `_getPlainTextFromEditor()` for contentEditable elements.

---

### HIGH-4: Lightbox md5First2() Generates Wrong File URLs

**Status:** ✅ FIXED
**Severity:** HIGH (Feature Bug)
**File:** resources/ext.layers/viewer/LayersLightbox.js:277-282

**Problem:** Takes first 2 characters of filename instead of computing an actual
MD5 hash. MediaWiki uses MD5 hashes for file path structure. This generates wrong
URLs (404 errors) for lightbox images:

```javascript
md5First2( filename ) {
    const clean = filename.replace( /[^a-zA-Z0-9]/g, '' ).toLowerCase();
    return clean.substring( 0, 2 ) || 'aa';  // NOT an MD5 hash!
}
```

---

### HIGH-5: ViewerOverlay Memory Leak — focusin/focusout Listeners Never Removed

**Status:** ✅ FIXED
**Severity:** HIGH (Memory Leak)
**File:** resources/ext.layers/viewer/ViewerOverlay.js:305-321, 475-496

**Problem:** `attachEventListeners()` adds `focusin` (tracked) and `focusout`
(anonymous function) listeners but `destroy()` only removes `mouseenter`,
`mouseleave`, and `touchstart`. The `focusout` anonymous function can never be
removed at all.

---

### HIGH-6: Rate Limiter Defaults Not Registered with MediaWiki

**Status:** ✅ FIXED
**Severity:** HIGH (Security Gap)
**File:** src/Security/RateLimiter.php:131-143

**Problem:** `RateLimiter` defines default limits but calls `$user->pingLimiter()`
which only checks `$wgRateLimits`. The computed `$limits` variable is never
actually used. On default installations without manual `$wgRateLimits`
configuration, **rate limiting is completely disabled**.

---

### HIGH-7: blurRadius and tailWidth Missing from LayerDataNormalizer

**Status:** ✅ FIXED
**Severity:** HIGH (Data Bug)
**File:** resources/ext.layers.shared/LayerDataNormalizer.js:49-61

**Problem:** `blurRadius` and `tailWidth` are not in `NUMERIC_PROPERTIES`. If the
API returns them as strings (which it does for integer-typed PHP values), they
won't be normalized to numbers. This causes scaling calculations to produce
`NaN` and comparison operators to behave incorrectly.

---

### HIGH-8: Hardcoded /wiki/ Path in LayeredFileRenderer

**Status:** ✅ FIXED
**Severity:** HIGH (Compatibility Bug)
**File:** src/Hooks/Processors/LayeredFileRenderer.php:260

**Problem:** `$href = '/wiki/File:' . rawurlencode( $filename );` hardcodes
`/wiki/` as the article path. MediaWiki installations with custom `$wgArticlePath`
will have broken file page links.

**Fix:** Use `Title::newFromText($filename, NS_FILE)->getLocalURL()`.

---

### HIGH-9: DB CHECK Constraint Hardcodes 2MB vs Configurable Limit

**Status:** ✅ FIXED
**Severity:** HIGH (Configuration Bug)
**File:** sql/patches/patch-add-check-constraints.sql:14, LayersSchemaManager.php:97

**Problem:** `CHECK (ls_size <= 2097152)` is hardcoded at the database level, but
`$wgLayersMaxBytes` is configurable up to 4MB per documentation. Admins who
increase `LayersMaxBytes` will experience DB-level rejections.

---

### HIGH-10: GradientRenderer Rejects Valid radius Values

**Status:** ✅ FIXED
**Severity:** HIGH (Data Inconsistency)
**File:** resources/ext.layers.shared/GradientRenderer.js:341-347

**Problem:** Client validates `gradient.radius` as 0-1, but server-side
`ServerSideLayerValidator.php:857` clamps it to 0-2. Data saved via the API with
`radius: 1.5` (valid server-side) is rejected by the client-side validator.

---

### HIGH-11: Path Tool Accumulates Unlimited Points During Drawing

**Status:** ✅ FIXED
**Severity:** HIGH (UX Bug)
**File:** resources/ext.layers.editor/canvas/DrawingController.js:555-557

**Problem:** Every mousemove adds a point to `tempLayer.points` with no cap.
The server caps at ~1000 points. A long freehand stroke can generate thousands
of points that are silently dropped on save, making the saved shape differ
from what the user drew.

---

## ��� MEDIUM Priority Issues

### MED-1: ApiLayersInfo Missing Schema Check

**File:** src/Api/ApiLayersInfo.php
**Problem:** Unlike all other API modules, `ApiLayersInfo` never calls `isSchemaReady()`.
Missing DB tables produce a generic error instead of `dbschema-missing`.

### MED-2: Rate Limiting Applied After Expensive DB Work

**Files:** src/Api/ApiLayersDelete.php, src/Api/ApiLayersRename.php
**Problem:** Rate limit checks happen after permission checks and multiple DB lookups.
Attackers can trigger expensive queries before being rate-limited.

### MED-3: Slide Save Lacks backgroundColor/Dimension Validation

**File:** src/Api/ApiLayersSave.php:432-436
**Problem:** `backgroundColor` bypasses color validation; `canvasWidth/canvasHeight`
have no upper bounds. Arbitrary strings/values stored without sanitization.

### MED-4: ApiLayersRename Race Condition on Target Name

**File:** src/Api/ApiLayersRename.php:140-143
**Problem:** `namedSetExists` check and `renameNamedSet` are not atomic. Two
concurrent renames to the same target could both succeed.

### MED-5: isForeignFile() Duplicated in 5+ Files

**Files:** ForeignFileHelperTrait, LayerInjector, ImageLinkProcessor,
ThumbnailProcessor, LayeredFileRenderer
**Problem:** Each uses fragile `strpos($className, 'Foreign')` string matching.
Should be consolidated into a single trait.

### MED-6: enrichWithUserNames Uses Deprecated Direct user Table Query

**File:** src/Api/ApiLayersInfo.php:430-444
**Problem:** Directly queries user table instead of using `UserFactory`. Will
break with future MW core changes.

### MED-7: WikitextHooks Static State Persists Across Requests

**File:** src/Hooks/WikitextHooks.php
**Problem:** Static properties never cleared between parser invocations. Stale
state leaks in long-running processes (job queue, maintenance scripts).

### MED-8: ThumbnailProcessor json_encode Without Error Handling

**File:** src/Hooks/Processors/ThumbnailProcessor.php:390
**Problem:** No JSON_THROW_ON_ERROR flag. Invalid UTF-8 produces `false` stored
as `data-layer-data="false"`.

### MED-9: CanvasRenderer _computeLayerHash Misses Nested Properties

**File:** resources/ext.layers.editor/CanvasRenderer.js
**Problem:** Hash concatenates top-level values. Nested objects (`gradient`,
`richText`) become `"[object Object]"`, so changes don't invalidate cache.

### MED-10: ShadowRenderer Creates Temp Canvas Per Call

**File:** resources/ext.layers.shared/ShadowRenderer.js
**Problem:** Creates `document.createElement('canvas')` each call (~60/sec during
transforms). GC pressure from temporary canvas elements.

### MED-11: DeepClone Falls Back to Returning Original Object

**File:** resources/ext.layers.shared/DeepClone.js:53-58
**Problem:** When both `structuredClone` and JSON roundtrip fail, returns the
original uncloned object. Callers expect a separate copy.

### MED-12: getMessage() Missing Null Check in Some Locations

**Files:** LayersEditor.js:1159, APIManager.js:1527
**Problem:** `window.layersMessages.get(key, fallback)` without null guard.
Other locations in same files correctly guard this.

### MED-13: Arrow Tip Drag Lacks rAF Throttling

**File:** resources/ext.layers.editor/canvas/TransformController.js:754-770
**Problem:** Calls `renderLayers()` on every mousemove without `requestAnimationFrame`
throttling, unlike all other drag operations.

### MED-14: applyToSelection() Mutates Layers In-Place

**File:** resources/ext.layers.editor/LayersEditor.js:1269-1286
**Problem:** Gets layers from StateManager, mutates them via callback, then
sets them back. Breaks immutable state assumptions.

### MED-15: Duplicate generateLayerId() Implementations

**Files:** SelectionManager.js, ToolManager.js
**Problem:** Identical fallback ID generation logic duplicated.

### MED-16: SlideManager.js and init.js Never Loaded by ResourceLoader

**Files:** resources/ext.layers.slides/SlideManager.js, resources/ext.layers.slides/init.js
**Problem:** Files exist and are tested (SlideManager.test.js) but NOT registered
in the `ext.layers.slides` ResourceLoader module. Dead code from production
perspective.

### MED-17: Inconsistent getLayerSet Return Types

**File:** src/Database/LayersDatabase.php
**Problem:** `getLayerSet()` returns `array|false`, `getLayerSetByName()` returns
`?array`. Key names differ (`name` vs `setName`). Fragile fallback handling.

### MED-18: ON DELETE CASCADE on User FK May Destroy Layer Data

**File:** sql/layers_tables.sql:25
**Problem:** If admin account is deleted/merged, all their layer sets, assets,
and usage records are silently destroyed.

### MED-19: ls_layer_count Uses TINYINT UNSIGNED (Max 255)

**File:** sql/layers_tables.sql:17
**Problem:** Current max is 100 layers. TINYINT caps at 255 and will silently
overflow if config is ever raised.

### MED-20: parseContinueParameter Duplicated (Trait + Local)

**File:** src/Api/ApiLayersInfo.php:537-558
**Problem:** Shadows identical methods from `LayersContinuationTrait`. Dead code.

---

## ��� LOW Priority Issues

### LOW-1: Redundant AutoloadClasses with PSR-4 AutoloadNamespaces
**File:** extension.json:15-57. ~30 manual class entries duplicate PSR-4.

### LOW-2: Unnecessary IE11 Compatibility Code
**Files:** SelectionManager.js, ToolManager.js. MW >= 1.44 dropped IE11.

### LOW-3: Redundant method_exists Checks for getWidth/getHeight
**Files:** ApiLayersSave.php, ApiLayersInfo.php. Always true for File objects.

### LOW-4: createRateLimiter() Defined Redundantly
Exists in trait and local definitions across multiple API modules.

### LOW-5: editLayerName Event Listener Leak
**File:** LayerPanel.js:1938-1968. Adds new listeners without removing old ones.

### LOW-6: Toolbar destroy() Doesn't Clean Up Panels/Dropdowns
**File:** Toolbar.js:215-224. Missing cleanup for shape/emoji panels.

### LOW-7: GroupManager Triple Global Registration
**File:** GroupManager.js:1194-1196. Registers on window, Layers, Layers.Core.

### LOW-8: InlineTextEditor Uses Deprecated document.execCommand
No replacement available yet. Long-term technical debt.

### LOW-9: Lightbox close/open Race During Animation
300ms animation window allows duplicate overlays.

### LOW-10: duplicateSelected() Uses JSON Roundtrip for Large Objects
Efficient clone utility `HistoryManager.cloneLayersEfficient()` already exists.

### LOW-11: scaleLayerCoordinates Shallow Copy of Nested Objects
Shares `gradient` and `richText` by reference after scaling.

### LOW-12: Verbose Debug Logging Pattern Repeated 15+ Times
APIManager.js. A helper would reduce ~60 lines.

### LOW-13: SelectionManager duplicateSelected Doesn't Sync to StateManager
Sets selectedLayerIds but doesn't call notifySelectionChange().

### LOW-14: Fallback Boolean Property List Stale in LayersViewer
Missing `expanded`, `isMultiPath`, `strokeOnly`, `showUnit`, `showBackground`.

---

## ��� Documentation Issues

### DOC-1: JS File Count Inconsistent (HIGH)
Actual: 140 files. Multiple docs say 142. KNOWN_ISSUES P2.1 incorrectly claims
142 is the correct count.

### DOC-2: NAMED_LAYER_SETS.md Badly Outdated (HIGH)
Uses `layers=` instead of `layerset=`. References nonexistent `{{#layers:}}`
parser function. Implementation checklist unchecked despite feature being done.

### DOC-3: God Class Line Counts Stale in 6+ Files (MEDIUM)
InlineTextEditor: claims 1,396-1,521 (actual 1,665). APIManager: claims
1,394-1,403 (actual 1,570). CanvasRenderer: claims 1,219 (actual 1,342).

### DOC-4: Version Date Wrong in 3+ Files (MEDIUM)
README, wiki/Home, Mediawiki-Extension-Layers.mediawiki say "February 3" but
CHANGELOG says "February 5, 2026".

### DOC-5: RELEASE_GUIDE References Wrong Filename (MEDIUM)
References "Mediawiki-Extension-Layers.txt" three times. Actual:
"Mediawiki-Extension-Layers.mediawiki". Also shows wrong MW/PHP requirements.

### DOC-6: ACCESSIBILITY.md Wrong Shortcut (MEDIUM)
Lists `B` as blur tool. Actually Callout. Missing 6+ shortcuts.

### DOC-7: KNOWN_ISSUES and improvement_plan Out of Sync (MEDIUM)
improvement_plan marks items FIXED that KNOWN_ISSUES shows OPEN.

### DOC-8: SLIDE_MODE.md Version Stale (LOW)
Says "v1.5.43". Should be 1.5.52.

### DOC-9: wiki/Home.md Test Suite Count Wrong (LOW)
Says "164" suites. Should be 165.

### DOC-10: WIKITEXT_USAGE.md Uses Legacy Syntax (LOW)
Uses `layers=anatomy` instead of `layerset=anatomy`.

### DOC-11: DEVELOPER_ONBOARDING ArrowRenderer Listed as God Class (LOW)
Claims ~1,301 lines. Actual is 974 (NOT a god class).

### DOC-12: Last Updated Dates Stale in Multiple Files (LOW)
DEVELOPER_ONBOARDING, ACCESSIBILITY, RELEASE_GUIDE, DOCUMENTATION_UPDATE_GUIDE
all say "January 2026".

---

## ✅ Verified Security Controls

| Category | Status | Notes |
|----------|--------|-------|
| CSRF Protection | ✅ PASS | All write APIs require tokens |
| SQL Injection | ✅ PASS | 100% parameterized queries |
| Input Validation (Server) | ✅ PASS | Strict whitelist (50+ fields) |
| Rate Limiting (Code) | ⚠️ PARTIAL | Code exists but defaults not registered |
| Authorization | ✅ PASS | Owner/admin checks |
| XSS via Canvas | ✅ PASS | ctx.fillText is inherently safe |
| Text Sanitization | ⚠️ FLAWED | Protocol removal bypassable (CRIT-2) |
| CSP | ⚠️ WEAKENED | unsafe-eval/unsafe-inline for foreign files |
| Data Normalization | ⚠️ INCOMPLETE | Missing blurRadius, tailWidth |

---

## God Class Status (18 files >= 1,000 lines)

### Generated Data (Exempt)
| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (14 files)
| File | Lines | Delegation |
|------|-------|------------|
| LayerPanel.js | 2,180 | 9 controllers |
| CanvasManager.js | 2,051 | 10 controllers |
| Toolbar.js | 1,891 | Style controls |
| LayersEditor.js | 1,830 | Module registry |
| InlineTextEditor.js | 1,665 | Rich text editor |
| APIManager.js | 1,570 | Request management |
| PropertyBuilders.js | 1,464 | Form builders |
| SelectionManager.js | 1,426 | State/handles |
| CanvasRenderer.js | 1,342 | Selection renderer |
| ViewerManager.js | 1,320 | Viewer lifecycle |
| ToolManager.js | 1,226 | Tool handlers |
| GroupManager.js | 1,206 | Group operations |
| SlideController.js | 1,131 | Slide rendering |
| LayersValidator.js | 1,116 | Validation rules |

### PHP (2 files)
| File | Lines |
|------|-------|
| LayersDatabase.php | 1,363 |
| ServerSideLayerValidator.php | 1,346 |

### Near Threshold (9 files, 950-999 lines)
TransformController (1,104), ToolbarStyleControls (998), TextBoxRenderer (996),
ShapeRenderer (995), ResizeCalculator (995), PropertiesForm (994),
ArrowRenderer (974), LayerRenderer (966), CalloutRenderer (961)

---

## Recommendations

### Immediate (Before Any Release)
1. **CRIT-1:** Migrate `getDBLoadBalancer()` to `getConnectionProvider()`
2. **CRIT-2:** Fix TextSanitizer with iterative protocol removal
3. **CRIT-3:** Fix sql/tables/layer_sets.sql unique key to match main schema

### Priority 1 (Next Release)
4. Fix canvas pool memory leak (HIGH-2)
5. Fix InlineTextEditor `_handleInput()` for contentEditable (HIGH-3)
6. Fix lightbox `md5First2()` (HIGH-4)
7. Fix ViewerOverlay listener cleanup (HIGH-5)
8. Add `blurRadius` and `tailWidth` to LayerDataNormalizer (HIGH-7)
9. Fix hardcoded `/wiki/` path (HIGH-8)
10. Align GradientRenderer radius validation with server (HIGH-10)

### Priority 2 (Near Term)
11. Register rate limit defaults with MediaWiki (HIGH-6)
12. Remove DB CHECK constraint or make it dynamic (HIGH-9)
13. Add client-side point cap during path drawing (HIGH-11)
14. Fix documentation inconsistencies (DOC-1 through DOC-7)
15. Remove CSP `unsafe-eval` / `unsafe-inline` (HIGH-1)

### Priority 3 (Quality Improvements)
16. Consolidate `isForeignFile()` into a single trait
17. Pool shadow canvases instead of creating per-call
18. Address remaining LOW issues
19. Clean up dead code (SlideManager.js)

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test coverage and
thoughtful architecture. However, this v22 review reveals that **previous reviews
were overly generous** in their security and compatibility assessments.

The **most critical finding** is that the extension declares MW >= 1.44 as a
requirement but uses APIs removed in MW 1.42, making it non-functional on its
stated platform. The TextSanitizer protocol bypass is a genuine XSS vector that
must be fixed. Multiple frontend bugs (canvas memory leak, broken input handling,
wrong lightbox URLs) affect real users.

The documentation ecosystem suffers from significant decay — line counts, dates,
version numbers, and status trackers are inconsistent across 15+ files.

**Overall Grade:** B+ (down from A- in v21). Excellent test coverage and
architecture, but critical compatibility bug and accumulated technical debt
prevent it from reaching "world-class" status.
