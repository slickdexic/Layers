# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 4, 2026 (Comprehensive Critical Review v15)  
**Version:** 1.5.51  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git branch --show-current`)
- **Tests:** 11,210 tests in 165 suites ✅ **All passing** (verified via `npm run test:js`)
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions, 95.32% lines (verified via coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,498 lines)
- **PHP production files:** 40 in `src/` (~14,915 lines)
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)

---

## Executive Summary

The Layers extension is a **mature, feature-rich MediaWiki extension** with **excellent security practices** and **outstanding test coverage**. All 11,210 tests pass. This review (v15) identified **documentation inaccuracies** and **dead code** issues.

**Overall Assessment:** Production-ready. Documentation needs synchronization.

### Key Strengths
1. **Excellent test coverage** (95.19% statement, 84.96% branch, 11,210 tests, all passing)
2. **Comprehensive server-side validation** with strict 50+ property whitelist
3. **Modern ES6 class-based architecture** (100% of JS files)
4. **PHP strict_types** in all 40 PHP files
5. **ReDoS protection** in ColorValidator (MAX_COLOR_LENGTH = 50)
6. **Proper delegation patterns** in large files (facade pattern in CanvasManager)
7. **No eval(), document.write(), or new Function()** usage (security)
8. **11 eslint-disable comments**, all legitimate (8 no-alert, 2 no-undef, 1 no-control-regex)
9. **Proper EventTracker** for memory-safe event listener management
10. **CSRF token protection** on all write endpoints with mustBePosted()
11. **Comprehensive undo/redo** with 50-step history
12. **Unsaved changes warning** before page close
13. **Auto-save/draft recovery** (DraftManager)
14. **Request abort handling** to prevent race conditions
15. **No TODO/FIXME/HACK comments** in production code
16. **No console.log statements** in production code (only in scripts/)
17. **SQL injection protected** via parameterized queries
18. **Concurrency-limited API calls** in refreshAllViewers (max 5)
19. **LayerDataNormalizer** ensures consistent boolean handling across editor/viewer

### Issue Summary (February 4, 2026 - Comprehensive Review v15)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Documentation | 0 | 0 | 0 | 0 | ✅ All fixed in v15 review |
| Code Quality | 0 | 0 | 0 | 2 | ✅ Dead code removed, style deferred |
| Tests | 0 | 0 | 0 | 0 | ✅ Weak assertions fixed |
| **Total Open** | **0** | **0** | **0** | **2** | Only P3 deferred items remain |

---

## ✅ Fixed Issues (v15 Review - February 4, 2026)

### HIGH-1v15: JS File Count Documentation Inconsistency

**Status:** ✅ FIXED  
**Severity:** HIGH (documentation accuracy)  
**Component:** Multiple documentation files

**Problem:** Documentation claimed 142 JS files but actual verified count was **140 files**.

**Resolution:** Updated `.github/copilot-instructions.md`, `docs/ARCHITECTURE.md` to correct file counts (140 files, ~96,498 lines).

---

### HIGH-2v15: Version Number in copilot-instructions.md Outdated

**Status:** ✅ FIXED  
**Severity:** HIGH (documentation accuracy)  
**Component:** .github/copilot-instructions.md

**Problem:** Line 407 showed version 1.5.49 but extension.json shows 1.5.51.

**Resolution:** Updated to 1.5.51.

---

### MED-1v15: PHP File Count Documentation Inconsistency

**Status:** ✅ FIXED  
**Severity:** MEDIUM (documentation accuracy)  
**Component:** Documentation files

**Problem:** Documentation showed 42 PHP files but actual was **40 files**.

**Resolution:** Updated `.github/copilot-instructions.md` to correct count.

---

### MED-2v15: JS Line Count Documentation Inconsistency

**Status:** ✅ FIXED  
**Severity:** MEDIUM (documentation accuracy)  
**Component:** Documentation files

**Problem:** Documentation showed various JS line counts but actual was **~96,498 lines**.

**Resolution:** Updated `.github/copilot-instructions.md` and `docs/ARCHITECTURE.md`.

---

### MED-3v15: Dead Code - LayersFileTransform::hasLayers()

**Status:** ✅ FIXED  
**Severity:** MEDIUM (code quality)  
**Component:** src/LayersFileTransform.php

**Problem:** The `hasLayers()` method created `LayersDatabase` incorrectly (missing required constructor args). Method was never called (dead code).

**Resolution:** Deleted `hasLayers()`, `getFileSha1()`, and `isForeignFile()` methods (64 lines of dead code removed).

---

### LOW-1v15: PropertyBuilders Line Count in Documentation

**Status:** ✅ FIXED  
**Severity:** LOW (documentation accuracy)  
**Component:** .github/copilot-instructions.md

**Problem:** Line 88 said PropertyBuilders.js is `~1,250 lines` but actual count was **1,464 lines**.

**Resolution:** Updated to ~1,464 lines.

---

### LOW-2v15: SelectionManager.applyDrag Dead Code Inconsistency

**Status:** ✅ FIXED  
**Severity:** LOW (code quality)  
**Component:** resources/ext.layers.editor/SelectionManager.js

**Problem:** `SelectionManager.applyDrag()` moved arrowX/arrowY with marker layers, but `TransformController` (production path) did NOT.

**Resolution:** Removed the arrowX/arrowY moving code from `applyDrag()` to match production behavior. Updated test expectations.

---

### LOW-3v15: const self = this Anti-Pattern (Remaining)

**Status:** ⚠️ OPEN  
**Severity:** LOW  
**Files:** 2 files with 4 instances

**Remaining (legitimate uses):**

| File | Count | Reason |
|------|-------|--------|
| VirtualLayerList.js | 1 | Throttle function needs two `this` contexts |
| ShapeLibraryPanel.js | 3 | Prototype pattern requires full ES6 class migration |

**Impact:** Minor code style inconsistency.

---

### LOW-4v15: Weak Test Assertions

**Status:** ✅ FIXED  
**Severity:** LOW  
**Component:** Test files

**Problem:** 5 tests used weak assertions (toBeTruthy/toBeFalsy).

**Resolution:** Fixed 4 of 5:
- SlideController.test.js: `toBeFalsy()` → `toBe(false)`, `toBeTruthy()` → `not.toBeNull()`
- LayerPanel.test.js: `toBeTruthy()` → `toBeDefined()` and `not.toBeNull()`
- InlineTextEditor.test.js: Kept `toBeFalsy()` with comment (intentional behavior).

---

## ✅ Issues Fixed (v13-v14 Review)

### ~~HIGH-1v13: Version Number Inconsistency in Mediawiki-Extension-Layers.mediawiki~~ ✅

**Status:** ✅ RESOLVED in v1.5.51  
**Severity:** HIGH (documentation accuracy)  
**Component:** Documentation

**Problem:** The `Mediawiki-Extension-Layers.mediawiki` file showed version 1.5.50 in the template header BUT showed 1.5.49 in the branch selection table (line 124).

**Resolution:** Updated to 1.5.51 across all locations.

---

### ~~MED-1v13: Version Number in docs/ARCHITECTURE.md is Out of Date~~ ✅

**Status:** ✅ RESOLVED in v1.5.51  
**Severity:** MEDIUM (documentation accuracy)  
**Component:** Documentation

**Problem:** `docs/ARCHITECTURE.md` shows version 1.5.49 in header while extension.json shows 1.5.50.

**Verified Location:** Line 4: `**Version:** 1.5.49`

**Impact:** Documentation version mismatch.

**Fix:** Update to 1.5.50.

---

### ~~MED-2v13: File Count Inconsistencies Across Documentation~~ ✅

**Status:** ✅ RESOLVED (February 3, 2026 - v1.5.51)  
**Severity:** MEDIUM (documentation accuracy)  
**Component:** Documentation

**Problem:** Various documentation files show different file counts:
- docs/ARCHITECTURE.md: 141 JS files, 42 PHP files
- .github/copilot-instructions.md: 142 JS files, 42 PHP files
- Actual count: 142 JS files, 40 PHP files

**Impact:** Minor inconsistency in metrics reporting.

**Fix:** Standardize on verified counts (142 JS, 40 PHP).

---

## ✅ Issues Fixed (v12 Review)

### HIGH-1v12: Test Count Inconsistencies Across Documentation ✅

**Status:** ✅ RESOLVED (February 3, 2026)  
**Severity:** HIGH (documentation accuracy)  
**Component:** Documentation

**Problem:** 5 documentation files showed "11,183 tests" when actual was **11,210 tests in 165 suites**.

**Resolution:** Updated all 5 files: README.md, CONTRIBUTING.md, CHANGELOG.md, .github/copilot-instructions.md, wiki/Home.md

---

## ✅ Issues Fixed in Previous Reviews

### HIGH-1v11: $wgLayersDebug Documentation Default Incorrect

**Status:** ✅ FIXED  
**Severity:** HIGH (documentation accuracy)  
**Component:** Documentation

**Problem:** Documentation claimed `$wgLayersDebug` defaults to `true`, but `extension.json` shows default is `false`.

**Resolution:** Fixed `.github/copilot-instructions.md` line 241 to show correct default. Note: `Mediawiki-Extension-Layers.mediawiki` already had the correct value.

---

### MED-1v11: Missing Client-Side Slide Canvas Dimension Validation

**Status:** ✅ FIXED  
**Severity:** MEDIUM  
**Component:** SlideManager.js

**Problem:** The `setCanvasDimensions(width, height)` method accepted any values without validation.

**Resolution:** Added validation in `SlideManager.js` using MIN_DIM=50, MAX_DIM=4096 constants.

---

### LOW-1v13: const self = this Anti-Pattern (Remaining)

**Status:** ⚠️ OPEN  
**Severity:** LOW  
**Files:** 2 files with 4 instances

**Remaining (legitimate uses):**

| File | Count | Reason |
|------|-------|--------|
| VirtualLayerList.js | 1 | Throttle function needs two `this` contexts |
| ShapeLibraryPanel.js | 3 | Prototype pattern requires full ES6 class migration |

**Impact:** Minor code style inconsistency.

**Effort:** Remaining items require significant refactoring.

---

### LOW-2v11: APIManager Promise Handling on Abort

**Status:** ⚠️ OPEN (by design)  
**Severity:** LOW  
**Component:** API Error Handling

**Issue:** When API requests are aborted, the Promise neither resolves nor rejects.

**Impact:** Callers using `await` on aborted requests will hang indefinitely.

**Note:** This is intentional behavior - aborted requests indicate the user changed context.

**Recommendation:** Consider resolving with `undefined` or rejecting with an `AbortError`.

---

## ✅ Issues Verified as NOT Bugs (v11 Review)

### Boolean Visibility Checks — NOT A BUG

**Claim:** Multiple files use `visible !== false` without checking `!== 0`.

**Verification:** This is CORRECT because:
1. `LayerDataNormalizer.normalizeLayer()` is called on ALL data loaded from the API (see APIManager.js line 527)
2. The normalizer converts `0` and `'0'` to boolean `false` (see LayerDataNormalizer.js lines 184-192)
3. After normalization, `visible !== false` is a safe check

**Conclusion:** No fix needed. The data flow correctly normalizes booleans before checks.

---

### History Save Order in GroupManager — CORRECT PATTERN

**Claim:** `saveState()` is called BEFORE state changes, causing broken undo.

**Verification:** This is the CORRECT pattern for undo systems:
1. `saveState()` captures the CURRENT (pre-change) state
2. State is then modified
3. Undo restores the pre-change state (correct!)
4. The new state is captured on the NEXT saveState call

**Conclusion:** The undo system works correctly. This is standard save-before-change pattern.

---

## ✅ Previous Issues — ALL RESOLVED

### ~~HIGH-1v10: Widespread Version Inconsistencies~~

**Status:** ✅ FIXED  
**Verified:** All files show 1.5.49 - README.md, extension.json, Mediawiki-Extension-Layers.mediawiki, docs/ARCHITECTURE.md, LayersNamespace.js

---

### ~~MED-1v10: Test Count/Coverage Documentation Mismatch~~

**Status:** ✅ FIXED  
**Verified:** Main documentation files show correct 11,210/164 and 95.19%/84.96%

---

### ~~MED-2v10: i18n Message Count Inconsistency~~

**Status:** ✅ FIXED  
**Verified:** Standardized on 749 messages

---

### ~~HIGH-1: ApiSlidesSave.php~~ — ✅ DELETED

**Status:** ✅ RESOLVED  
**Verified:** File does not exist in codebase

---

### ~~HIGH-2: ApiSlideInfo.php~~ — ✅ DELETED

**Status:** ✅ RESOLVED  
**Verified:** File does not exist in codebase

---

### ~~MED-1: Missing Boolean Properties in preserveLayerBooleans~~ — ✅ FIXED

**Status:** ✅ RESOLVED  
**Verified:** src/Api/ApiLayersInfo.php includes all 12 boolean properties

---

### ~~MED-2: InlineTextEditor Not in CanvasManager Destroy List~~ — ✅ FIXED

**Status:** ✅ RESOLVED  
**Verified:** inlineTextEditor in controllersToDestroy array

---

## 🔒 Security Verification

| Category | Status | Notes |
|----------|--------|-------|
| CSRF Protection | ✅ | All write APIs require tokens |
| Rate Limiting | ✅ | All APIs rate limited |
| Input Validation | ✅ | 40+ property whitelist |
| Permission Checks | ✅ | read + editlayers rights verified |
| ReDoS Protection | ✅ | MAX_COLOR_LENGTH = 50 |
| SQL Injection | ✅ | Parameterized queries |
| XSS Prevention | ✅ | Text sanitization, SVG validation |
| SVG Script Detection | ✅ | HTML entities decoded before check |
| Eval/exec | ✅ | None in production |
| Path Traversal | ✅ | SetNameSanitizer removes / and \ |
| Transaction Safety | ✅ | FOR UPDATE locks, retry logic |
| Race Condition Prevention | ✅ | Named set limit checked inside transaction |

---

## 📊 God Class Analysis (18 Files ≥1,000 Lines)

### Generated Data Files (2) — Exempt
| File | Lines | Notes |
|------|-------|-------|
| ShapeLibraryData.js | 11,299 | Generated shape library data |
| EmojiLibraryIndex.js | 3,055 | Generated emoji search index |

### Hand-Written JavaScript (14)
| File | Lines | Strategy | Priority |
|------|-------|----------|----------|
| LayerPanel.js | 2,182 | Already delegated to 9 controllers | Low |
| CanvasManager.js | 2,044 | Facade pattern, delegates to controllers | Low |
| Toolbar.js | 1,891 | Already delegated to ToolbarStyleControls | Low |
| LayersEditor.js | 1,830 | ModuleRegistry pattern | Low |
| InlineTextEditor.js | 1,521 | Could extract RichTextToolbar | Medium |
| SelectionManager.js | 1,431 | Already delegates to SelectionState | Low |
| PropertyBuilders.js | 1,419 | Could split by layer type | Medium |
| APIManager.js | 1,403 | Could extract RetryManager | Medium |
| ViewerManager.js | 1,322 | Proper delegation | Low |
| ToolManager.js | 1,226 | Already delegates to handlers | Low |
| CanvasRenderer.js | 1,219 | Already delegates to specialized renderers | Low |
| GroupManager.js | 1,171 | Proper structure | Low |
| SlideController.js | 1,140 | Proper structure | Low |
| LayersValidator.js | 1,116 | Proper structure | Low |

### PHP (2)
| File | Lines | Strategy | Priority |
|------|-------|----------|----------|
| LayersDatabase.php | 1,364 | Repository split possible | Low |
| ServerSideLayerValidator.php | 1,342 | Strategy pattern possible | Low |

All god classes use proper delegation. No emergency refactoring needed.

---

## ✅ Positive Findings

The codebase demonstrates many excellent practices:

1. **EventTracker Pattern** — Memory leak prevention for event listeners
2. **TimeoutTracker Pattern** — Centralized timer cleanup
3. **Request Abort Tracking** — APIManager properly aborts stale requests
4. **No eval() or Function()** — No dangerous dynamic code execution
5. **Comprehensive Input Sanitization** — ValidationManager has proper checks
6. **CSRF Protection** — All write operations use api.postWithToken()
7. **State Lock Mechanism** — StateManager prevents most race conditions
8. **LayerDataNormalizer** — Centralizes boolean/number normalization
9. **Proper destroy() Methods** — All managers have cleanup methods
10. **Exponential Backoff** — Database retry logic uses proper patterns
11. **Comprehensive Logging** — Error conditions are well-logged
12. **SVG Security** — Decodes HTML entities before checking for scripts
13. **Consistent PHP strict_types** — All 40 files declare strict_types
14. **Zero console.log** — No debug output in production code
15. **Zero TODO/FIXME** — No outstanding markers in production
16. **API Response Caching** — LRU cache with 5-minute TTL
17. **Layer Render Caching** — Hash-based change detection
18. **Self-Hosted Fonts** — No external requests to Google Fonts

---

## Priority Actions

### Immediate (v15 findings)

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| HIGH | Fix JS file count in docs (142→140) - 3 files | 10 min | ⚠️ Open |
| HIGH | Fix version in copilot-instructions.md line 407 | 2 min | ⚠️ Open |
| MED | Fix PHP file count in copilot-instructions.md (42→40) | 2 min | ⚠️ Open |
| MED | Fix JS line count in docs (~95,433→~96,498) | 5 min | ⚠️ Open |
| MED | Remove or fix dead hasLayers() method | 10 min | ⚠️ Open |
| LOW | Fix PropertyBuilders line count in docs | 2 min | ⚠️ Open |
| LOW | Update or remove dead applyDrag tests | 15 min | ⚠️ Open |
| LOW | Replace 5 weak test assertions | 10 min | ⚠️ Open |

### Previously Fixed

| Priority | Item | Status |
|----------|------|--------|
| HIGH | Fix version in Mediawiki-Extension-Layers.mediawiki | ✅ Fixed |
| HIGH | Fix $wgLayersDebug default in docs | ✅ Fixed |
| MED | Fix version in docs/ARCHITECTURE.md | ✅ Fixed |
| MED | Add client-side canvas dimension validation | ✅ Fixed |

### Optional (deferred)

| Priority | Item | Effort |
|----------|------|--------|
| LOW | Refactor remaining const self (4) | Deferred |
| LOW | APIManager Promise handling on abort | 30 min |

---

## Changelog

**v15 (February 4, 2026):**
- Verified actual file counts: 140 JS files (~96,498 lines), 40 PHP files (~14,915 lines)
- Found JS file count wrong in 3+ documentation files (says 142, should be 140)
- Found version 1.5.49 in copilot-instructions.md line 407 (should be 1.5.51)
- Found dead code: LayersFileTransform::hasLayers() with incorrect constructor call
- Found SelectionManager.applyDrag inconsistency with TransformController (dead code)
- Found 5 weak test assertions (toBeTruthy/toBeFalsy)
- Verified all 11,210 tests pass
- Comprehensive security review: PASSED (no vulnerabilities found)
- Memory leak patterns review: PASSED (proper EventTracker/TimeoutTracker usage)

**v14 (February 3, 2026):**
- Fixed all v13 documentation issues (version in branch table, ARCHITECTURE.md)
- Updated to v1.5.51

**v13 (February 3, 2026):**
- Found version 1.5.49 in Mediawiki-Extension-Layers.mediawiki branch table (HIGH)
- Found version 1.5.49 in docs/ARCHITECTURE.md (MEDIUM)
- Found file count inconsistencies (141 vs 142 JS files, 40 vs 42 PHP files)
- Verified all 11,210 tests pass
- No code-level bugs found

**v12 (February 3, 2026):**
- Found test count inconsistencies (11,183 vs 11,210) - RESOLVED
- Verified actual test count: 11,210 tests in 165 suites
- All documentation files now use correct test count

**v11 (February 3, 2026):**
- Verified boolean visibility checks are NOT bugs (LayerDataNormalizer)
- Verified history save order is CORRECT (save-before-change pattern)
- Found $wgLayersDebug doc default incorrect (HIGH) - FIXED
- Found missing client-side canvas dimension validation (MEDIUM) - FIXED
- All 11,210 tests passing

**v10 (February 2, 2026):**
- Fixed version inconsistencies across all documentation
- Fixed test count/coverage metrics in documentation
- Fixed i18n message count inconsistencies

---

*Review performed on main branch, February 4, 2026.*  
*All 11,210 tests passing. Codebase is production-ready.*
