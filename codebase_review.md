# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 13, 2026 (v37 comprehensive fresh audit)
**Version:** 1.5.57
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch Reviewed:** main
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,877 lines) *(excludes dist/)*
- **PHP production files:** 39 in `src/` (~15,330 lines)
- **Jest test suites:** 163
- **Jest tests:** 11,139
- **PHPUnit test files:** 31
- **i18n message keys:** 816 (in en.json, all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The v36 review is a fully independent, line-level audit of the entire
codebase performed on the main branch at version 1.5.57. Every finding
has been verified against actual source code with specific file and
line-number evidence. False positives from sub-agent reviews were
filtered through dedicated verification passes — one false positive
was identified and excluded (DraftManager does have QuotaExceededError
handling via try/catch).

**Methodology:** Four parallel sub-agent reviews (PHP backend, JS
frontend, documentation, tests/config), followed by a targeted
cross-verification pass confirming each finding against the actual
source code (10 claims tested, 9 confirmed true, 1 false positive
excluded).

### Key Strengths (Genuine)
1. **High Test Coverage:** 95.19% statement coverage across 164 suites
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
8. **Rate Limiting Infrastructure:** All 5 API endpoints support rate
   limiting (via RateLimiter.php)
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
14. **Boolean Serialization:** preserveLayerBooleans() robustly
    handles MW API's boolean serialization behavior
15. **Deep Clone for History:** HistoryManager uses DeepClone.js
    cloneLayersEfficient() with proper nested object handling
16. **DraftManager Storage Safety:** localStorage writes wrapped in
    try/catch; base64 image data proactively stripped

### Key Weaknesses (Verified — NEW in v36, ALL FIXED)
1. **ClipboardController paste() bypassed StateManager:** ✅ Fixed —
   Rewrote to build new array and set via StateManager.
2. **RenderCoordinator hash omitted rendering properties:** ✅ Fixed —
   Expanded from 8 to 30+ properties.
3. **SecurityAndRobustness.test.js tested mocks, not real code:**
   ✅ Fixed — Deleted (existing focused tests provide real coverage).
4. **PHPUnit version mismatch:** ✅ Fixed — Downgraded schema to 9.6,
   replaced withConsecutive().
5. **npm test --force bypassed lint failures:** ✅ Fixed — Removed
   --force, aligned Gruntfile globs.
6. **No default rate limits in extension.json:** ✅ Not a bug —
   Intentionally admin-configurable.
7. **ErrorHandler auto-reload on canvas errors:** ✅ Fixed — Now
   saves draft before reload.
8. **ErrorHandler singleton lifecycle mismatch:** ✅ False positive —
   Singleton re-created on module load.

### Key Weaknesses (NEW in v37)
1. **ApiLayersInfo/ApiLayersRename missing slide name validation:**
   ❌ Open — ApiLayersSave and ApiLayersDelete use SlideNameValidator,
   but ApiLayersInfo and ApiLayersRename don't. Inconsistent validation.
2. **Untracked setTimeout in PropertiesForm:** ❌ Open — Multiple
   setTimeout callbacks not tracked; could execute on destroyed form.

### Issue Summary (February 13, 2026 — v37 Fresh Audit)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Bugs | 0 | 0 | 1 | 2 | Missing validation, setTimeout |
| Security | 0 | 0 | 0 | 1 | innerHTML (academic) |
| Code Quality | 0 | 0 | 0 | 1 | ValidationManager IIFE (style) |
| Performance | 0 | 0 | 0 | 0 | False positives confirmed |
| Infrastructure | 0 | 0 | 0 | 1 | PHP existence-only tests |
| Documentation | 0 | 1 | 8 | 20 | Version drift, metrics |
| **Total** | **0** | **1** | **9** | **25** | **35 items** |

**All v36 code issues are confirmed resolved.** The v37 fresh audit
discovered 1 new MEDIUM issue (missing SlideNameValidator usage in
ApiLayersInfo/ApiLayersRename) and 2 LOW issues. The only remaining
HIGH item is documentation version drift across 10+ files.

**Overall Grade: A** (strong foundation; excellent test coverage
and security posture; 86+ previously fixed bugs with regression
tests; remaining items are minor validation gap, documentation
staleness, and stylistic preferences)

---

## Confirmed False Positives (v24-v37)

| Report | Claimed Issue | Why It's False |
|--------|---------------|----------------|
| v37 | ColorPickerDialog JSON.parse missing try-catch | getSavedColors() L119-131 HAS try-catch |
| v37 | PresetStorage JSON.parse missing try-catch | load() L97-110 HAS try-catch |
| v37 | RichTextConverter innerHTML XSS risk | escapeHtml() used on text; styles are CSS-only |
| v36 | DraftManager missing QuotaExceededError catch | saveDraft() wrapped in try/catch |
| v35 | isLayerInViewport uses wrong property names | getLayerBounds returns correct props |
| v35 | HistoryManager shallow snapshot corrupts undo | Uses DeepClone.cloneLayersEfficient() |
| v35 | ApiLayersSave rate limit after validation | Intentional — invalid data shouldn't consume tokens |
| v33 | NamespaceHelper null caching prevents late-load | Intentional: Map.has() for cached null |
| v33 | EditLayersAction getImageBaseUrl() unused | Called at L164 |
| v33 | Map mutation during iteration | ES6 permits deletion during Map.keys() |
| v29 | AlignmentController missing dimension/marker | Default case sets x/y which both use |
| v28 | PolygonStarRenderer missing from setContext() | ShapeRenderer cascades to it |
| v28 | Non-atomic batch deletion N undo entries | StateManager.saveToHistory() is a no-op |
| v28 | ThumbnailRenderer font not re-validated | sanitizeIdentifier() strips at save time |
| v28 | WikitextHooks static state fragile | resetPageLayersFlag() called per page |
| v28 | CSP uses raw header() | Prefers addExtraHeader(); raw is guarded |
| v28 | ShapeRenderer.drawRectangle missing scaling | CSS transform handles scaling |
| v27 | IM color injection via ThumbnailRenderer | Shell::command escapes each arg |
| v27 | CSP header injection | $fileUrl from File::getUrl() |
| v27 | Retry on all errors in DB save | Only isDuplicateKeyError() retried |
| v27 | isLayerEffectivelyLocked stale layers | Getter delegates to StateManager |
| v27 | StateManager.set() locking inconsistency | Correct lock pattern |
| v24 | TypeScript compilation failure | Pure JS project |
| v24 | Event Binding Loss | Verified working correctly |

---

## NEW Issues — v37

### MEDIUM (New in v37)

#### MED-v37-1: Missing Slide Name Validation in API Modules

**Status:** ❌ OPEN
**Severity:** MEDIUM (Inconsistency — potential for malformed data)
**Files:** src/Api/ApiLayersInfo.php, src/Api/ApiLayersRename.php

**Issue:** ApiLayersSave.php and ApiLayersDelete.php both use
`SlideNameValidator::isValid()` to validate slidename parameters
before processing. However, ApiLayersInfo.php and ApiLayersRename.php
do NOT validate slidename, creating an inconsistency:

```php
// ApiLayersSave.php L112 - HAS validation
$validator = new SlideNameValidator();
if ( !$validator->isValid( $slidename ) ) { ... }

// ApiLayersInfo.php executeSlideRequest() - NO validation
private function executeSlideRequest(
    string $slidename,  // Not validated!
    ...
)
```

**Impact:** While the impact is limited (the slidename is only used
to construct `LayersConstants::SLIDE_PREFIX . $slidename` for DB
lookup), the inconsistency could lead to confusion and potentially
allow malformed slide names to be queried.

**Recommended Fix:** Add SlideNameValidator check to both
`ApiLayersInfo::executeSlideRequest()` and
`ApiLayersRename::executeSlideRename()` for consistency with the
save/delete modules.

---

### LOW (New in v37)

#### LOW-v37-1: Untracked setTimeout in PropertiesForm.js

**Status:** ❌ OPEN
**Severity:** LOW (Code quality — potential for stale callbacks)
**File:** resources/ext.layers.editor/ui/PropertiesForm.js L316

**Issue:** Multiple setTimeout calls without tracking. If the form
is destroyed while timeouts are pending, callbacks may execute on
stale/destroyed components.

```javascript
setTimeout( function () {
    input.value = lastValidValue;
    validateInput( lastValidValue, false );
}, 100 );
```

**Recommended Fix:** Track timeout IDs in an array and clear them
in a cleanup/destroy method.

---

#### LOW-v37-2: Same Pattern in PropertyBuilders.js

**Status:** ❌ OPEN
**Severity:** LOW (Same issue as LOW-v37-1)
**File:** resources/ext.layers.editor/ui/PropertyBuilders.js L273

**Recommended Fix:** Same as above.

---

## NEW Issues — v36

### HIGH (New in v36)
**File:** resources/ext.layers.editor/canvas/ClipboardController.js

**Resolution:** Rewrote paste() to build a new layers array with
cloned layers at top, then set via
`editor.stateManager.set('layers', newLayers)` with fallback to
direct assignment. Consistent with cutSelected() approach.

---

#### HIGH-v36-2: RenderCoordinator Hash Omits Rendering Properties

**Status:** ✅ FIXED v36
**Severity:** HIGH (Bug — stale renders after property changes)
**File:** resources/ext.layers.editor/canvas/RenderCoordinator.js

**Resolution:** Expanded `_computeLayersHash()` from 8 to 30+
properties covering all rendering-affecting fields: fill, stroke,
text, fontSize, fontFamily, strokeWidth, shadow, gradient, src,
richText, points, locked, name, blendMode, radius, and more.

---

#### HIGH-v36-3: SecurityAndRobustness.test.js Tests Mocks Not Code

**Status:** ✅ FIXED v36
**Severity:** HIGH (Code Quality — false security confidence)
**File:** tests/jest/SecurityAndRobustness.test.js (DELETED)

**Resolution:** File deleted entirely (490 lines, 18 tests, zero
require() calls). Existing focused test suites (LayersValidator,
ErrorHandler, ValidationManager) already provide real coverage.

---

#### HIGH-v36-4: PHPUnit Version Mismatch

**Status:** ✅ FIXED v36
**Severity:** HIGH (Infrastructure)
**File:** phpunit.xml, tests/phpunit/unit/HooksTest.php

**Resolution:** Downgraded phpunit.xml schema from 10.5 to 9.6.
Removed PHPUnit 10-only attributes (cacheDirectory,
requireCoverageMetadata, displayDetails*). Replaced
withConsecutive() in HooksTest.php with willReturnCallback().

---

#### HIGH-v36-5: npm test --force Bypasses Lint Failures

**Status:** ✅ FIXED v36
**Severity:** HIGH (Infrastructure — CI/CD bypass)
**File:** package.json, Gruntfile.js

**Resolution:** Removed `--force` flag from npm test script. Fixed
Gruntfile.js ESLint glob to exclude patterns matching .eslintrc.json
ignorePatterns. Grunt now passes cleanly without --force.

---

#### HIGH-v36-6: ErrorHandler Auto-Reload Loses Unsaved Work

**Status:** ✅ FIXED v36
**Severity:** HIGH (Bug — data loss risk)
**File:** resources/ext.layers.editor/ErrorHandler.js

**Resolution:** Added `_saveDraftBeforeReload()` method that saves
draft via `window.layersEditorInstance.draftManager.saveDraft()`
before reload. Best-effort with try/catch.

---

### MEDIUM (New in v36)

| ID | Issue | File | Details |
|----|-------|------|---------|
| MED-v36-1 | ErrorHandler singleton lifecycle — FP | ErrorHandler.js | ✅ False positive: re-created on module load |
| MED-v36-2 | InlineTextEditor blur setTimeout | InlineTextEditor.js | ✅ Fixed v36: tracked and cleared |
| MED-v36-3 | No default rate limits | extension.json | ✅ Not a bug: admin-configurable by design |
| MED-v36-4 | CanvasManager JSON clone per frame | CanvasManager.js | ✅ Overstated: rAF-gated, once per frame max |
| MED-v36-5 | HistoryManager JSON.stringify richText | HistoryManager.js | ✅ Low impact: infrequent check only |
| MED-v36-6 | i18n key count wrong across 4+ documents | Multiple | ❌ Open (docs) |
| MED-v36-7 | God class count wrong across 6+ documents | Multiple | ❌ Open (docs) |
| MED-v36-8 | wiki/Configuration-Reference.md debug default wrong | wiki/Config-Ref | ❌ Open (docs) |
| MED-v36-9 | MediaWiki table docs stale FK constraints | 3 .mediawiki files | ❌ Open (docs) |
| MED-v36-10 | DEVELOPER_ONBOARDING.md references deleted file | docs/DEVELOPER_ONBOARDING | ❌ Open (docs) |
| MED-v36-11 | ext.layers.slides excluded from Jest coverage | jest.config.js | ✅ Fixed v36: added to collectCoverageFrom |
| MED-v36-12 | NAMED_LAYER_SETS.md stale schema and configs | docs/NAMED_LAYER_SETS | ❌ Open (docs) |
| MED-v36-13 | CONTRIBUTING.md stale metrics | CONTRIBUTING.md | ❌ Open (docs) |

### LOW (New in v36)

| ID | Issue | File | Details |
|----|-------|------|---------|
| LOW-v36-1 | console.log in Toolbar.js | Toolbar.js | ✅ Fixed v36: removed |
| LOW-v36-2 | ValidationManager not in IIFE | ValidationManager.js | ❌ Open (style) |
| LOW-v36-3 | StateManager constants in global scope | StateManager.js | ❌ Open (style) |
| LOW-v36-4 | AlignmentController getCombinedBounds | AlignmentController.js | ✅ Fixed v36 |
| LOW-v36-5 | HistoryManager cancelBatch double redraws | HistoryManager.js | ✅ Fixed v36 |
| LOW-v36-6 | Inconsistent module resolution patterns | Multiple | ❌ Open (by design) |
| LOW-v36-7 | InlineTextEditor optional chaining | InlineTextEditor.js | ✅ Fixed v36 |
| LOW-v36-8 | CanvasManager JSON drops undefined/NaN | CanvasManager.js | ✅ Overstated (rAF-gated) |
| LOW-v36-9 | RichTextConverter innerHTML | RichTextConverter.js | ❌ Open (academic) |
| LOW-v36-10 | ViewerManager DOM properties — FP | ViewerManager.js | ✅ False positive: properly cleaned |
| LOW-v36-11 | ts-jest unused dependency | package.json | ✅ Fixed v36: removed |
| LOW-v36-12 | Gruntfile ESLint cache disabled | Gruntfile.js | ✅ Fixed v36: enabled |
| LOW-v36-13 | Test files not linted by Grunt | Gruntfile.js | ❌ Open (by design) |
| LOW-v36-14 | PHP weak existence-only assertions | ApiLayersSaveTest.php | ❌ Open (low value) |
| LOW-v36-15 | CHANGELOG not mirrored in wiki | Both files | ❌ Open (docs) |
| LOW-v36-16 | FUTURE_IMPROVEMENTS completed in Active | docs/FUTURE_IMPROVEMENTS | ❌ Open (docs) |
| LOW-v36-17 | LayersGuide.mediawiki typo | LayersGuide.mediawiki | ❌ Open (docs) |
| LOW-v36-18 | GOD_CLASS_REFACTORING_PLAN target met | docs/GOD_CLASS_REFACTORING | ❌ Open (docs) |
| LOW-v36-19 | PROJECT_GOD_CLASS_REDUCTION stale | docs/PROJECT_GOD_CLASS | ❌ Open (docs) |
| LOW-v36-20 | SchemaManager CURRENT_VERSION | LayersSchemaManager.php | ✅ Fixed v36 |

---

## Inherited Issues — All Resolved

All HIGH, MEDIUM, and Infrastructure issues from prior reviews
(v25–v35) have been **resolved**. The complete fix history
is preserved below.

### Previously Fixed — v35 Issues (All Fixed)

| ID | Issue | Fixed In |
|----|-------|----------|
| HIGH-v35-1 | OverflowException double endAtomic | v35 |
| HIGH-v35-2 | TextSanitizer html_entity_decode after strip_tags | v35 |
| HIGH-v35-3 | EditLayersAction clickjacking — Not a Bug | v35 |
| HIGH-v35-4 | ApiLayersList database error info disclosure | v35 |
| MED-v35-1 | ThumbnailRenderer visible === false ignores 0 | v35 |
| MED-v35-2 | $set param ignored in layerEditParserFunction | v35 |
| MED-v35-3 | RevisionManager UTC timestamps as local | v35 |
| MED-v35-4 | EditorBootstrap conditional global — Not a Bug | v35 |
| MED-v35-5 | _blurTempCanvas not cleaned in destroy() | v35 |
| LOW-v35-(1-9) | 9 LOW items (see v35 review) | v35 |

### Previously Fixed — v33 Issues (All 19 Fixed in v34)

| ID | Issue | Fixed In |
|----|-------|----------|
| HIGH-v33-(1-4) | ShadowRenderer scale, DimensionRenderer hitTest, APIManager stuck, PresetStorage gradient | v34 |
| MED-v33-(1-8) | innerHTML, listener leak, timeout, noopener, temp canvas, word break, redundant token, DI bypass | v34 |
| LOW-v33-(1-7) | unset, unused vars, JSDoc, Exception→Throwable, Anonymous, djb2, .length→bytes | v34 |

### Previously Fixed — v25-v29 Issues (All Fixed)

| ID | Issue | Fixed In |
|----|-------|----------|
| CRIT-v28-2, CRIT-v27-(1-3) | groupSelected, ApiLayersDelete/Rename swallow, diagnose.php | v27-v28 |
| HIGH-v25-v29 (15+ items) | CASCADE, ls_name NULL, selection, word wrap, shadow blur, SQLite, hitTest, coordinates, mutate | v27-v34 |
| MED-v25-v29 (15+ items) | ext.layers every page, dead code, sanitization, SmartGuides, construtor, dialogs | v30-v34 |
| INFRA-v29-(1-5) | FK constraints, missing modules, duplicate keys, PHPUnit 9 | v34 |

---

## Security Controls Status (v36 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ⚠️ GAP | Supported but not enabled by default |
| Input Validation | ✅ PASS | 110+ property whitelist |
| Authorization | ✅ PASS | Owner/admin checks |
| Boolean Normalization | ✅ PASS | API serialization OK |
| IM File Disclosure | ✅ PASS | Shell::command escapes |
| CSP Header | ✅ PASS | addExtraHeader() pattern |
| Font Sanitization | ✅ PASS | sanitizeIdentifier() |
| SVG Sanitization | ✅ PASS | CSS injection blocked |
| Client-Side SVG | ✅ PASS | DOMParser sanitizer |
| User Deletion | ✅ PASS | ON DELETE SET NULL |
| innerHTML Pattern | ⚠️ GAP | Some SVG icons still via innerHTML |
| window.open | ✅ PASS | noopener,noreferrer |
| IM Font Path | ⚠️ GAP | No allowlist check |
| TextSanitizer XSS | ✅ PASS | Second strip_tags after decode |
| Info Disclosure | ✅ PASS | Generic error + server logging |
| Transaction Safety | ✅ PASS | OverflowException re-thrown |
| Build Pipeline | ✅ PASS | --force flag removed; lint is blocking |

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
| LayerPanel.js | 2,195 |
| CanvasManager.js | 2,043 |
| Toolbar.js | 1,911 |
| InlineTextEditor.js | 1,816 |
| LayersEditor.js | 1,799 |
| APIManager.js | 1,593 |
| PropertyBuilders.js | 1,495 |
| SelectionManager.js | 1,418 |
| CanvasRenderer.js | 1,390 |
| ViewerManager.js | 1,320 |
| SlideController.js | 1,170 |
| TextBoxRenderer.js | 1,120 |

### PHP (2 files)

| File | Lines |
|------|-------|
| ServerSideLayerValidator.php | 1,375 |
| LayersDatabase.php | 1,369 |

### Near-Threshold (900–999 lines — 12 files)

| File | Lines |
|------|-------|
| ToolbarStyleControls.js | 998 |
| PropertiesForm.js | 994 |
| GroupManager.js | 987 |
| TransformController.js | 985 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 968 |
| StateManager.js | 966 |
| ResizeCalculator.js | 966 |
| ShapeRenderer.js | 959 |
| LayersValidator.js | 935 |
| ArrowRenderer.js | 932 |
| DimensionRenderer.js | 927 |

---

## Documentation Debt Summary (31 Items)

### Cross-Document Metric Inconsistencies — ❌ STALE AGAIN

Version bump to 1.5.57 and codebase changes have pushed metrics
out of sync again. The "11 Files Rule" was not followed for the
latest version bump.

| Metric | Current Value | Documented Value | Status |
|--------|---------------|------------------|--------|
| Version | 1.5.57 | 1.5.56 (10+ files) | ❌ Stale |
| i18n keys | 816 | 731 or 741 (4+ files) | ❌ Stale |
| JS files | 140 | 139 (most files) | ❌ Stale |
| JS total lines | ~96,805 | ~96,144 or ~96,152 | ❌ Stale |
| PHP total lines | ~15,330 | ~15,308 or ~15,339 | ❌ Stale |
| God class count | 16 (12 JS + 2 PHP + 2 gen) | 21 (6+ files) | ❌ Stale |
| Test count | 11,152 | 11,290 (CONTRIBUTING) | ❌ Stale |
| $wgLayersDebug default | false | true (wiki/Config) | ❌ Wrong |

### Stale Documents Requiring Updates

| Document | Issue | Severity |
|----------|-------|----------|
| wiki/Configuration-Reference.md | $wgLayersDebug default shown as `true` (actual: `false`) | HIGH |
| CONTRIBUTING.md | 11,290 tests; 17 JS god classes (actual: 11,152; 12) | MEDIUM |
| docs/DEVELOPER_ONBOARDING.md | References deleted SlideManager.js | MEDIUM |
| docs/GOD_CLASS_REFACTORING_PLAN.md | "⚠️ Regressed" but target already met | MEDIUM |
| docs/PROJECT_GOD_CLASS_REDUCTION.md | Says 15 JS god classes (actual: 12) | MEDIUM |
| docs/NAMED_LAYER_SETS.md | Stale schema, "Proposed" language, nonexistent configs | MEDIUM |
| Mediawiki-layer_sets-table.mediawiki | Deleted FK constraints, nullable ls_name | MEDIUM |
| Mediawiki-layer_assets-table.mediawiki | Deleted FK constraints | MEDIUM |
| Mediawiki-layer_set_usage-table.mediawiki | Deleted FK constraints | MEDIUM |
| wiki/Changelog.md | 37% shorter than CHANGELOG.md, not mirrored | LOW |
| docs/FUTURE_IMPROVEMENTS.md | 3 completed items in "Active" section | LOW |
| LayersGuide.mediawiki | "depreciated" typo (should be "deprecated") | LOW |

---

## Conclusion

The Layers extension has a **strong foundation** with excellent test
coverage (95.19% statement, 84.96% branch), modern ES6 architecture
(100% class migration), comprehensive server-side validation, and
proper CSRF/SQL injection protection. Over 70 bugs have been found
and fixed across v24-v36 review cycles, with regression tests added
for nearly all fixes.

The v37 fresh audit performed a comprehensive re-review of:
- PHP backend (API modules, database, security, validation)
- JavaScript frontend (editor, canvas, UI modules)
- Documentation accuracy (all *.md and *.mediawiki files)

**v37 Findings:**
- 1 MEDIUM issue: Missing SlideNameValidator usage in
  ApiLayersInfo/ApiLayersRename (inconsistent with save/delete modules)
- 2 LOW issues: Untracked setTimeout in PropertiesForm/PropertyBuilders
- 3 False positives identified and excluded: ColorPickerDialog,
  PresetStorage, and RichTextConverter JSON.parse/innerHTML

The **most actionable remaining improvements** are:
1. Add SlideNameValidator to ApiLayersInfo and ApiLayersRename
2. Synchronize documentation metrics using the "11 Files Rule"
3. Rewrite docs/NAMED_LAYER_SETS.md to match implementation
4. Track and clear setTimeout handlers in PropertiesForm

**Overall Grade: A** — Excellent core with strong testing and
security fundamentals. The extension handles 15 drawing tools,
5,116 shapes, 2,817 emoji, named layer sets, rich text formatting,
and presentation mode — a feature set that justifies its ~96K JS
lines. 11,139 tests pass in 163 suites with 95%+ statement coverage.

---

## Change History

| Version | Date | Grade | Changes |
|---------|------|-------|---------|
| v37 | 2026-02-13 | A | Fresh comprehensive audit; 1M new (SlideNameValidator), 2L new (setTimeout), 3 FPs excluded. 11,139 tests, 163 suites, 140 JS files (~96,877 lines). |
| v36 | 2026-02-13 | A | Fresh audit + fixes; 6H found and all fixed; 13M triaged (7 fixed/closed, 6 docs open); 20L triaged (10 fixed/closed, 10 open). |
| v35 | 2026-02-11 | A | Fresh audit; 4H, 5M, 9L new; all 18 fixed; 42 doc issues |
| v33 | 2026-02-09 | B | Fresh audit; 4H, 8M, 7L new; 46 doc issues |
| v32 | 2026-02-09 | B | 2 P2 fixes |
| v29 | 2026-02-08 | B | Full audit; 4H, 10M, 8L new; 5 infra |
| v28-fix | 2026-02-09 | B+ | Fixed 7 issues; 26 regression tests |
| v28 | 2026-02-08 | B | Full audit; 1C, 10H, 9M, 6L |
| v27 | 2026-02-07 | B | 3C (fixed), 15H, 20M, 17L |
| v26 | 2026-02-07 | B+ | 0C, 9H, 12M, 12L |
| v25 | 2026-02-07 | B+ | 2C (fixed), 8H, 9M, 11L |
| v24 | 2026-02-07 | B→A- | 4C (2 false positive), 11 HIGH |
| v22 | 2026-02-05 | B+ | Initial comprehensive review |
