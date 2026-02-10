# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 9, 2026 (Comprehensive Critical Review v33)
**Version:** 1.5.54
**Reviewer:** GitHub Copilot (Claude Opus 4.6)

---

## Scope & Verification

- **Branch Reviewed:** main
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,916 lines) *(excludes dist/)*
- **PHP production files:** 39 in `src/` (~15,096 lines)
- **Jest test suites:** 165
- **PHPUnit test files:** 31
- **i18n message keys:** 730 (in en.json, all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The v33 review is a fully independent, line-level audit of the entire
codebase performed on the main branch at version 1.5.54. Every finding
has been verified against actual source code with specific file and
line-number evidence. False positives from sub-agent reviews were filtered
through a dedicated verification pass — two false positives were caught
and excluded (NamespaceHelper null caching is intentional; EditLayersAction
getImageBaseUrl is used at L164).

**Methodology:** Four parallel sub-agent reviews (PHP backend, JS core
editor, JS renderers/canvas/UI, documentation/config), followed by a
targeted cross-verification pass confirming each finding against the
actual source code, then a final spot-check verification of 17 specific
claims.

### Key Strengths (Genuine)
1. **High Test Coverage:** 95.19% statement coverage across 165 suites
   (11,290 tests)
2. **Server-Side Validation:** ServerSideLayerValidator is thorough
   (110+ properties, strict whitelist)
3. **Modern Architecture:** 100% ES6 classes, facade/controller
   delegation patterns
4. **CSRF Protection:** All write endpoints require tokens via
   `api.postWithToken('csrf', ...)`
5. **SQL Parameterization:** All database queries parameterized
6. **Defense in Depth:** TextSanitizer, ColorValidator, property
   whitelist, LayerDataNormalizer
7. **Transaction Safety:** Atomic with retry/backoff and FOR UPDATE
8. **Rate Limiting:** All 5 API endpoints rate-limited with per-role
9. **IM Injection Protection:** Shell::command escapes all args;
   `@` prefix stripped from text inputs
10. **CSP via MW API:** EditLayersAction prefers addExtraHeader(),
    raw header() only as guarded fallback
11. **Font Sanitization:** sanitizeIdentifier() strips fontFamily to
    `[a-zA-Z0-9_.-]` at save time
12. **Renderer Context Cascading:** ShapeRenderer.setContext()
    propagates to PolygonStarRenderer automatically
13. **WikitextHooks State Reset:** resetPageLayersFlag() resets all
    6 static properties + 6 singletons on each page render
14. **Batch Deletion Undo:** StateManager.saveToHistory() is a no-op;
    single history snapshot via HistoryManager.saveState()
15. **Boolean Serialization:** preserveLayerBooleans() robustly
    handles MW API's boolean serialization behavior

### Key Weaknesses (Verified)
1. **ShadowRenderer discards canvas scale on rotation:** Spread
   shadows render at wrong size when zoom ≠ 1
   (ShadowRenderer.js L305-325)
2. **DimensionRenderer hitTest ignores offset:** Click detection uses
   raw baseline, not the visible offset dimension line
   (DimensionRenderer.js L750-761)
3. **APIManager saveInProgress permanently stuck on throw:** If
   buildSavePayload() or JSON.stringify() throws, saveInProgress
   remains true forever (APIManager.js L859-870)
4. **PresetStorage strips gradient data:** ALLOWED_STYLE_PROPERTIES
   missing 'gradient', so gradient presets lose their fill
   (PresetStorage.js L20-56)
5. **ON DELETE CASCADE deletes user content:** Deleting a user
   cascade-deletes ALL their layer sets (layers_tables.sql)
6. **Toolbar innerHTML with i18n text:** mw.message().text() does NOT
   HTML-escape; template literaling into innerHTML is a latent XSS
   vector (Toolbar.js L1050, L1077, L1099)
7. **init.js event listener accumulation:** layers-modal-closed
   listener on document has no duplicate guard (init.js L124)
8. **ImageLoader timeout orphaned on success:** loadTestImage()
   clearTimeout not called on successful load
   (ImageLoader.js L290-317)
9. **StateManager malformed JSDoc:** Unclosed comment block before
   destroy() method (StateManager.js L894-898)
10. **README uses wrong slide parameter:** `bgcolor=` should be
    `background=` per SlideHooks.php L185

### Issue Summary (February 9, 2026 — v33 Review)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Bugs | 0 | 4 | 8 | 6 | 2 new rendering issues |
| Security | 0 | 2 | 4 | 2 | innerHTML pattern, CASCADE |
| Code Quality | 0 | 1 | 5 | 7 | Dead code, missing unset() |
| Performance | 0 | 1 | 4 | 3 | Temp canvas per frame |
| Infrastructure | 0 | 2 | 3 | 0 | FK constraints, SQLite |
| Documentation | 0 | 14 | 18 | 14 | 46 total doc issues |
| **Total** | **0** | **24** | **49** | **32** | **98 issues** (16 previously fixed, 53 fixed in v34) |

**Overall Grade: B** (strong foundation; excellent test coverage and
security posture; 16 previously fixed bugs with regression tests;
this review surfaces new verified rendering, security, and reliability
issues; documentation debt remains the largest quality drag)

---

## Confirmed False Positives (v24-v33)

| Report | Claimed Issue | Why It's False |
|--------|---------------|----------------|
| v33 | NamespaceHelper null caching prevents late-load | Intentional: uses Map.has() for cached null; clearClassCache() available |
| v33 | EditLayersAction getImageBaseUrl() unused | Called at L164 for wgLayersImageBaseUrl |
| v33 | Map mutation during iteration in _invalidateCache | ES6 spec permits deletion during Map.keys() iteration |
| v29 | AlignmentController.moveLayer missing dimension/marker | Default case sets x/y which dimension/marker use |
| v28 | PolygonStarRenderer missing from setContext() | ShapeRenderer.setContext() cascades to it |
| v28 | Non-atomic batch deletion creates N undo entries | StateManager.saveToHistory() is a no-op |
| v28 | ThumbnailRenderer font not re-validated | sanitizeIdentifier() strips at save time |
| v28 | WikitextHooks static state fragile | resetPageLayersFlag() exists, called per page |
| v28 | CSP uses raw header() | Prefers addExtraHeader(); raw is guarded fallback |
| v28 | ShapeRenderer.drawRectangle missing x/y scaling | CSS transform handles positional scaling |
| v27 | IM color injection via ThumbnailRenderer | Shell::command escapes each arg |
| v27 | CSP header injection | $fileUrl from File::getUrl() |
| v27 | Retry on all errors in DB save | Only retries on isDuplicateKeyError() |
| v27 | isLayerEffectivelyLocked stale this.layers | Getter delegates to StateManager |
| v27 | StateManager.set() locking inconsistency | Correct lock pattern |
| v24 | TypeScript compilation failure | Pure JS project |
| v24 | Event Binding Loss | Verified working correctly |

| Claimed Issue | Why It's False |
|---------------|----------------|
| isLayerEffectivelyLocked stale `this.layers` | Object.defineProperty getter delegates to StateManager live (L267-278) |
| StateManager.set() locking inconsistency | Standard setter pattern; update() acquires lock, set() respects it |
| IM color injection via ThumbnailRenderer | Shell::command escapes all args individually; colors passed as separate args |
| CSP header injection | $fileUrl comes from File::getUrl(), not user input; parse_url extracts host only |
| Retry on all errors in DB save | Only retries on `isDuplicateKeyError()`, fails immediately otherwise |

## NEW Issues — v33

### HIGH (New in v33)

#### HIGH-v33-1: ShadowRenderer Discards Canvas Scale on Rotation

**Status:** ✅ FIXED v34 (P1-017)
**Severity:** HIGH (Bug — spread shadows wrong size at zoom ≠ 1)
**File:** resources/ext.layers.shared/ShadowRenderer.js L305-325

**Problem:** `drawSpreadShadow()` detects rotation in the canvas
transform and replaces it with an identity+translation matrix:
```js
transformWithoutRotation = new DOMMatrix([
    1, 0, 0, 1,
    currentTransform.e,
    currentTransform.f
]);
```
This discards the scale components. When the editor applies zoom
(`ctx.setTransform(zoom, 0, 0, zoom, panX, panY)`), the shadow
renders at 1:1 size on the temp canvas regardless of zoom level.
Same issue exists in `drawSpreadShadowStroke` at L465-480.

**Impact:** Spread shadows on rotated shapes appear at wrong size
whenever the canvas zoom ≠ 1. The shadow is drawn unscaled on the
temp canvas and then composited onto the zoomed main canvas.

**Fix:** Decompose scale from the matrix and preserve it:
```js
const sx = Math.sqrt(a*a + b*b);
const sy = Math.sqrt(c*c + d*d);
transformWithoutRotation = new DOMMatrix([
    sx, 0, 0, sy, e, f
]);
```

---

#### HIGH-v33-2: DimensionRenderer hitTest Ignores Offset

**Status:** ✅ FIXED v34 (P1-018)
**Severity:** HIGH (Bug — click detection on wrong line)
**File:** resources/ext.layers.shared/DimensionRenderer.js L750-761

**Problem:** `hitTest()` checks point-to-line distance against the
raw measurement line `(x1,y1)→(x2,y2)`, but the visible dimension
line is rendered offset perpendicularly by `dimensionOffset` (or
`extensionGap + extensionLength/2`).

When `dimensionOffset` is significant (e.g., 30+ px), clicking the
visible dimension line misses the hit test.

**Fix:** Calculate the offset dimension line coordinates in hitTest
and test against those instead of the raw baseline.

---

#### HIGH-v33-3: APIManager saveInProgress Permanently Stuck

**Status:** ✅ FIXED v34 (P1-019)
**Severity:** HIGH (Bug — permanently blocks saves)
**File:** resources/ext.layers.editor/APIManager.js L859-870

**Problem:** The save method sets `this.saveInProgress = true` at
L859, then calls `buildSavePayload()` and `JSON.stringify()` at
L863-864 without try/catch. If either throws, `saveInProgress`
remains `true` permanently — all subsequent save attempts are
rejected with "Save already in progress". The only fix is to
reload the page.

**Fix:** Wrap the payload construction in try/catch.

---

#### HIGH-v33-4: PresetStorage Strips Gradient Data

**Status:** ✅ FIXED v34 (P1-020)
**Severity:** HIGH (Feature gap — gradient presets broken)
**File:** resources/ext.layers.editor/presets/PresetStorage.js L20-56

**Problem:** The `ALLOWED_STYLE_PROPERTIES` whitelist does not include
`'gradient'`. When a user saves a preset from a shape with a gradient
fill, `sanitizeStyle()` silently strips the gradient data.

**Fix:** Add `'gradient'` to `ALLOWED_STYLE_PROPERTIES`.

---

### MEDIUM (New in v33)

| ID | Issue | File | Details |
|----|-------|------|---------|
| MED-v33-1 | Toolbar innerHTML with mw.message().text() | Toolbar.js L1050, L1077, L1099 | ✅ Fixed v34 — DOM construction with textContent |
| MED-v33-2 | init.js layers-modal-closed listener accumulates | init.js L124 | ✅ Fixed v34 — guard flag prevents duplicate registration |
| MED-v33-3 | ImageLoader timeout not cleared on success | ImageLoader.js L290-317 | ✅ Fixed v34 — clearTimeout on load success |
| MED-v33-4 | window.open without noopener in ViewerOverlay | ViewerOverlay.js L465, L468 | ✅ Fixed v34 — noopener,noreferrer added |
| MED-v33-5 | ShadowRenderer/EffectsRenderer temp canvas per frame | ShadowRenderer.js, EffectsRenderer.js | ✅ Fixed v34 — cached as instance properties |
| MED-v33-6 | TextBoxRenderer wrapText doesn't break long words | TextBoxRenderer.js | ✅ Fixed v34 — character-by-character breaking |
| MED-v33-7 | ApiLayersSave redundant token parameter | ApiLayersSave.php L589-594 | ✅ Fixed v34 — removed explicit token param |
| MED-v33-8 | LayersSchemaManager bypasses DI | LayersSchemaManager.php | ✅ Fixed v34 — constructor injection |

### LOW (New in v33)

| ID | Issue | File | Details |
|----|-------|------|---------|
| LOW-v33-1 | ApiLayersList missing unset() after foreach-by-ref | ApiLayersList.php L166-173 | ✅ Fixed v34 (P3-001) |
| LOW-v33-2 | UIHooks unused $viewUrl, $viewLabel | UIHooks.php L412, L454 | ✅ Fixed v34 (P3-002) |
| LOW-v33-3 | StateManager malformed JSDoc at destroy() | StateManager.js L894-898 | ✅ Fixed v34 (P3-003) |
| LOW-v33-4 | ThumbnailRenderer catches Exception not Throwable | ThumbnailRenderer.php L110 | ✅ Fixed v34 (P3-004) |
| LOW-v33-5 | Hardcoded 'Anonymous' fallback user name | ApiLayersInfo.php L479, L530 | ✅ Fixed v34 (P3-005) |
| LOW-v33-6 | ImageLayerRenderer djb2 hash collision risk | ImageLayerRenderer.js L170-185 | 32-bit fallback cache key |
| LOW-v33-7 | checkSizeLimit compares .length not byte count | APIManager.js L1440-1443 | ✅ Fixed v34 (P3-007) |

---

## Inherited Issues — Still Open from v25-v29

### HIGH

| ID | Issue | Status |
|----|-------|--------|
| HIGH-v27-1 | ON DELETE CASCADE destroys user annotations | ✅ Fixed v34 |
| HIGH-v27-2 | ls_name allows NULL in schema | ✅ Fixed v34 |
| HIGH-v27-5 | Triple source of truth for selection state | ✅ FIXED v34 |
| HIGH-v26-2 | Rich text word wrap wrong font metrics | ✅ Fixed v34 |
| HIGH-v28-4 | ThumbnailRenderer shadow blur corrupts canvas | ✅ Fixed v34 |
| HIGH-v28-5 | SQLite-incompatible schema migrations | ✅ FIXED v34 |

### MEDIUM

| ID | Issue | Status |
|----|-------|--------|
| MED-v25-6 | ext.layers loaded every page | ✅ FIXED v34 |
| MED-v27-1 | SlideManager.js dead code (439 lines) | ✅ FIXED v34 |
| MED-v28-1 | Client SVG sanitization regex bypassable | ✅ Fixed v34 |
| MED-v28-2 | sanitizeString strips `<>` destroying math | ✅ Fixed v34 |
| MED-v29-2 | SmartGuides cache stale on mutations | ✅ Fixed v34 |
| MED-v29-5 | ToolManager 400+ lines dead fallbacks | ✅ FIXED v34 |
| MED-v29-6 | HistoryManager duck-type constructor | ✅ FIXED v34 |
| MED-v29-7 | Duplicate prompt dialog implementations | ✅ Fixed v34 |
| MED-v29-20 | enrichWithUserNames duplicated | ✅ Fixed v34 |

### Infrastructure

| ID | Issue | Status |
|----|-------|--------|
| INFRA-v29-1 | Foreign key constraints violate MW conventions | ✅ FIXED v34 |
| INFRA-v29-2 | SpecialEditSlide references non-existent module | ✅ Fixed v34 |
| INFRA-v29-3 | ext.layers.slides missing init.js, SlideManager.js, slides.css | ✅ FIXED v34 |
| INFRA-v29-4 | Duplicate message keys in extension.json | ✅ Fixed v34 |
| INFRA-v29-5 | phpunit.xml uses deprecated PHPUnit 9 attributes | ✅ Fixed v34 |

---

## NEW Issues — v27

| ID | Issue | Fixed In |
|----|-------|----------|
| CRIT-v28-2 | groupSelected() passes object instead of ID | v28-fix |
| HIGH-v28-2 | Canvas cache stale on middle path points | v28-fix |
| HIGH-v26-1 | VALID_LINK_VALUES drops editor subtypes | v28-fix |
| HIGH-v25-1 | TextRenderer rotation ignores textAlign | v28-fix |
| HIGH-v25-5 | SVG CSS injection vectors missing | v28-fix |
| MED-v28-8 | Negative dimensions for rectangle/textbox | v28-fix |
| MED-v28-9 | DraftManager stores base64 image data | v28-fix |
| HIGH-v29-1 | HitTest fails on rotated rectangles/ellipses | v29-fix |
| HIGH-v29-2 | ShapeRenderer strokeWidth:0 treated as 1 | v29-fix |
| HIGH-v29-3 | getRawCoordinates() incorrect coordinate math | v29-fix |
| HIGH-v29-4 | normalizeLayers mutates input objects | v29-fix |
| MED-v29-1 | CalloutRenderer blur clips L/R tails | v31 |
| MED-v29-4 | closeAllDialogs leaks keydown handlers | v30+ |
| MED-v29-8 | LayerInjector logger arg discarded | v30+ |
| MED-v29-9 | SlideHooks isValidColor too weak | v30+ |
| MED-v29-10 | services.php missing strict_types | v30+ |
| CRIT-v27-1 | ApiLayersDelete swallows ApiUsageException | v27 |
| CRIT-v27-2 | ApiLayersRename exception swallowing | v27 |
| CRIT-v27-3 | diagnose.php unauthenticated | v27 |
| HIGH-v27-3 | isSchemaReady 23 uncached DB queries | v27 |
| HIGH-v27-4 | duplicateSelected single-layer only | v27 |
| HIGH-v27-6 | Text length limit 500 vs 1000 | v27 |
| HIGH-v26-3 | Save button 2s timeout | v27 |
| HIGH-v26-4 | Clipboard paste missing coordinates | v27 |
| HIGH-v26-5 | toggleLayerLock bypasses StateManager | v27 |

---

## Security Controls Status (v33 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries throughout |
| Rate Limiting | ✅ PASS | All 5 endpoints, per-role limits |
| XSS Prevention | ✅ PASS | TextSanitizer iterative removal |
| Input Validation | ✅ PASS | 110+ property strict whitelist |
| Authorization | ✅ PASS | Owner/admin checks; API framework for reads |
| Transaction Safety | ✅ PASS | Atomic + FOR UPDATE locking |
| Boolean Normalization | ✅ PASS | API serialization handled |
| IM File Disclosure | ✅ PASS | `@` stripped, Shell::command escapes |
| CSP Header | ✅ PASS | Prefers addExtraHeader(); raw fallback guarded |
| Font Sanitization | ✅ PASS | sanitizeIdentifier() strips to [a-zA-Z0-9_.-] |
| SVG Sanitization | ✅ PASS | CSS injection vectors blocked |
| IM Font Path | ⚠️ GAP | fontFamily not validated against allowlist before ImageMagick |
| Client-Side SVG | ✅ FIXED v34 | DOMParser-based sanitizer (P2-007) |
| User Deletion | ✅ FIXED v34 | ON DELETE SET NULL preserves content (P1-011) |
| innerHTML Pattern | ✅ FIXED v34 | All 4 sites use DOM construction (MED-v33-1) |
| window.open | ✅ FIXED v34 | noopener,noreferrer added (MED-v33-4) |

---

## God Class Status (16 files >= 1,000 lines)

### Generated Data (Exempt — 2 files)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (12 files)

| File | Lines |
|------|-------|
| LayerPanel.js | 2,180 |
| CanvasManager.js | 2,053 |
| Toolbar.js | 1,891 |
| LayersEditor.js | 1,836 |
| InlineTextEditor.js | 1,672 |
| APIManager.js | 1,575 |
| PropertyBuilders.js | 1,495 |
| SelectionManager.js | 1,415 |
| CanvasRenderer.js | 1,391 |
| ViewerManager.js | 1,320 |
| TextBoxRenderer.js | 1,120 |
| SlideController.js | 1,131 |

### PHP (2 files)

| File | Lines |
|------|-------|
| LayersDatabase.php | 1,364 |
| ServerSideLayerValidator.php | 1,348 |

### Near-Threshold (900–1,000 lines — 10 files)

| File | Lines |
|------|-------|
| ToolbarStyleControls.js | 998 |
| PropertiesForm.js | 994 |
| GroupManager.js | 987 |
| TransformController.js | 985 |
| ArrowRenderer.js | 974 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 961 |
| ShapeRenderer.js | 959 |
| ResizeCalculator.js | 963 |
| LayersValidator.js | 935 |

---

The v33 review is a fresh comprehensive audit that discovered **4 new
high-priority issues** (shadow scale on rotation, dimension hitTest
offset, save flag stuck on throw, gradient presets stripped), **8 new
medium issues** (innerHTML pattern, event listener leak, timeout
orphan, window.open security, temp canvas allocation, word wrapping,
redundant token param, DI bypass), and **7 new low issues**.

Combined with inherited open items from v25-v29, the open issue
count is **98 total** (24 HIGH, 42 MEDIUM, 32 LOW).

**All 6 high-priority inherited issues from prior reviews are now fixed:**
ON DELETE CASCADE, ls_name NULL, ThumbnailRenderer shadow blur,
SQLite schema, triple selection state, rich text word wrap.

Documentation debt has grown to **46 inaccuracies** with several
critically stale documents, version numbers stuck at 1.5.52 across
6+ files, and no CHANGELOG entries for versions 1.5.53-1.5.54.

**Overall Grade: B** — Strong core with excellent test coverage and
security fundamentals. The 4 new high-priority issues affect
rendering correctness (shadows, dimension hit testing), save
reliability (stuck flag), and feature completeness (gradient presets).
Documentation staleness remains the single largest quality drag.

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|---------|
| v33 | 2026-02-09 | B | Fresh audit; 4 HIGH, 8 MED, 7 LOW new; 46 doc issues; 2 false positives caught |
| v32 | 2026-02-09 | B | 2 P2 fixes (callout tailSize, related) |
| v29 | 2026-02-08 | B | Full audit; 4H, 10M, 8L new; 5 infra; 42 doc issues |
| v28-fix | 2026-02-09 | B+ | Fixed 7 issues (1C, 4H, 2M); 26 regression tests |
| v28 | 2026-02-08 | B | Full independent audit; 1 CRIT, 10 HIGH, 9 MED, 6 LOW |
| v27 | 2026-02-07 | B | 3 CRIT (all fixed), 15 HIGH, 20 MED, 17 LOW |
| v26 | 2026-02-07 | B+ | 0 CRIT, 9 HIGH, 12 MED, 12 LOW |
| v25 | 2026-02-07 | B+ | 2 CRIT (fixed), 8 HIGH, 9 MED, 11 LOW |
| v24 | 2026-02-07 | B→A- | 4 CRIT (2 false positive), 11 HIGH |
| v22 | 2026-02-05 | B+ | Initial comprehensive review |
