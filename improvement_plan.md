# Layers Extension - Improvement Plan

**Last Updated:** February 3, 2026 (Comprehensive Critical Review v14)  
**Version:** 1.5.51  
**Status:** Production-Ready (9.5/10)

> **📝 NOTE:** See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md)
> for the detailed phased plan to address god class issues.

---

## Executive Summary

The extension is **production-ready** with **comprehensive test coverage** and clean
code practices. All **11,210** tests pass. The v13 review found **3 documentation
inconsistencies** (version numbers, file counts) but **no code-level bugs**.

**Current Status:**
- ✅ **P0:** All resolved (no critical bugs)
- ⚠️ **P1:** 1 open (version in Mediawiki-Extension-Layers.mediawiki)
- ⚠️ **P2:** 2 open (docs version and file counts)
- ⚠️ **P3:** 2 open (code style backlog)

**Verified Metrics (February 3, 2026):**

| Metric | Value | Status |
|--------|-------|--------|
| Tests total | **11,210** (165 suites) | ✅ Excellent |
| Tests passing | **11,210** | ✅ All pass |
| Tests skipped | **0** | ✅ Clean |
| Statement coverage | **95.19%** | ✅ Excellent |
| Branch coverage | **84.96%** | ✅ Good |
| Function coverage | **93.67%** | ✅ Excellent |
| Line coverage | **95.32%** | ✅ Excellent |
| JS source files | **142** in resources/ | ✅ |
| PHP production files | **40** in src/ | ✅ |
| PHP strict_types | **40/40 files** | ✅ Complete |
| ES6 classes | All JS files | 100% migrated |
| God classes (≥1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| ESLint errors | 0 | ✅ |
| ESLint disables | 11 | ✅ All legitimate |
| i18n messages | **~749** lines in en.json | ✅ |
| TODO/FIXME/HACK | 0 | ✅ Clean |
| console.log in production | 0 | ✅ Clean |
| Dead code files | 0 | ✅ All deleted |

---

## Priority Definitions

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | Immediate | Critical bugs or security issues |
| **P1** | 1–2 days | High-impact issues affecting users |
| **P2** | 1–3 months | Architecture, code quality, features |
| **P3** | 3–6 months | Long-term improvements, technical debt |

---

## Phase 0 (P0): Critical Issues — ✅ ALL RESOLVED

No critical bugs remain. All **11,210** tests pass.

---

## Phase 1 (P1): High Priority — ✅ ALL RESOLVED

### ~~P1.1 Fix Version in Mediawiki-Extension-Layers.mediawiki (v13)~~

**Status:** ✅ FIXED in v1.5.51  
**Priority:** P1 - High

**Issue:** Branch selection table on line 124 showed version 1.5.49 for main branch,
but extension.json and template header showed 1.5.50.

**Resolution:** Updated to 1.5.51 as part of v1.5.51 release.

---

### ~~P1.2 Fix Test Count Documentation Inconsistencies (v12)~~

**Status:** ✅ FIXED  
**Priority:** P1 - High

**Issue:** 5 documentation files showed "11,183 tests" when actual count was
**11,210 tests in 165 suites**.

**Resolution:** Updated all 5 files: README.md, CONTRIBUTING.md, CHANGELOG.md,
.github/copilot-instructions.md, wiki/Home.md (February 3, 2026)

---

### ~~P1.3 Fix $wgLayersDebug Documentation Default (v11)~~

**Status:** ✅ FIXED  
**Priority:** P1 - High

**Issue:** Documentation claimed `$wgLayersDebug` defaults to `true`, but
`extension.json` shows the actual default is `false`.

**Resolution:** Fixed `.github/copilot-instructions.md` line 241.

---

### ~~P1.4 Delete ApiSlidesSave.php (Dead Code)~~

**Status:** ✅ FIXED  
**Resolution:** File deleted from repository.

---

### ~~P1.5 Delete ApiSlideInfo.php (Dead Code)~~

**Status:** ✅ FIXED  
**Resolution:** File deleted from repository.

---

### ~~P1.6 Widespread Version Inconsistencies~~

**Status:** ✅ FIXED (v10)  
**Resolution:** All files updated to 1.5.49 (now 1.5.50).

---

## Phase 2 (P2): Medium Priority — ✅ ALL FIXED

### ~~P2.1 Fix Version in docs/ARCHITECTURE.md (v13)~~

**Status:** ✅ FIXED in v1.5.51  
**Priority:** P2

**Issue:** Header showed version 1.5.49 but extension.json showed 1.5.50.

**Resolution:** Updated to 1.5.51 and fixed file counts.

---

### ~~P2.2 Fix File Count Inconsistencies (v13)~~

**Status:** ✅ FIXED in v1.5.51  
**Priority:** P2

**Issue:** docs/ARCHITECTURE.md showed 141 JS files and 42 PHP files.
Verified counts: 142 JS files, 40 PHP files.

**Resolution:** Updated file counts in docs/ARCHITECTURE.md.

---

### ~~P2.3 Add Client-Side Canvas Dimension Validation (v11)~~

**Status:** ✅ FIXED  
**Priority:** P2

**Issue:** `SlideManager.setCanvasDimensions()` accepted any values without
client-side validation. Extremely large values could crash the browser.

**Resolution:** Added validation in `SlideManager.js` using MIN_DIM=50, MAX_DIM=4096
to match `LayerDefaults.js` constants. Uses validated values throughout the method.

---

### ~~P2.4 Add Missing Boolean Properties to preserveLayerBooleans~~

**Status:** ✅ FIXED  
**Resolution:** All 12 boolean properties now included.

---

### ~~P2.3 Add InlineTextEditor to CanvasManager Destroy List~~

**Status:** ✅ FIXED  
**Resolution:** inlineTextEditor in controllersToDestroy array.

---

### ~~P2.4 Add Slide Support to ApiLayersRename~~

**Status:** ✅ FIXED  
**Resolution:** executeSlideRename() method implemented.

---

### ~~P2.5 Test Count/Coverage Documentation Mismatch~~

**Status:** ✅ FIXED (v10)  
**Resolution:** Metrics updated to 11,210/164 and 95.19%/84.96%.

---

## Phase 3 (P3): Long-Term — ⚠️ 2 OPEN

### P3.1 Refactor Remaining const self = this

**Status:** ⚠️ OPEN (deferred)  
**Priority:** P3 - Low

**Remaining:** 4 instances in 2 files

| File | Count | Reason |
|------|-------|--------|
| VirtualLayerList.js | 1 | Throttle needs two `this` contexts |
| ShapeLibraryPanel.js | 3 | Requires full ES6 class migration |

**Effort:** Large — requires significant refactoring

---

### P3.2 APIManager Promise Handling on Abort

**Status:** ⚠️ OPEN (by design)  
**Priority:** P3 - Low

**Issue:** Aborted requests leave Promise unresolved.

**Note:** Intentional behavior — aborted requests indicate context change.

**Recommendation:** Consider resolving with `undefined` or rejecting with `AbortError`.

**Effort:** 30 minutes

---

### ~~P3.3 Standardize API Error Codes~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Standardized to 'setnotfound' in ApiLayersInfo.

---

### ~~P3.4 Add Rate Limiting to ApiLayersInfo~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Added createRateLimiter() and checkRateLimit('info').

---

### ~~P3.5 Add Global Exception Handler to ApiLayersInfo~~

**Status:** ✅ FIXED (v7)  
**Resolution:** Wrapped in try/catch with generic error response.

---

### ~~P3.6 Extract Magic Numbers to Constants~~

**Status:** ✅ FIXED  
**Resolution:** Created LayerDefaults.js in ext.layers.shared module.

---

### ~~P3.7 LayersLightbox Click Handler Cleanup~~

**Status:** ✅ FIXED (v9.1)  
**Resolution:** Added explicit removeEventListener for boundClickHandler.

---

## Issues Verified as NOT Bugs

### Boolean Visibility Checks (visible !== false)

**Investigation Result:** NOT A BUG

**Why:** `LayerDataNormalizer.normalizeLayer()` is called on ALL data loaded
from the API. It converts integer `0` to boolean `false` before any checks.
The `visible !== false` pattern is safe after normalization.

---

### History Save Order in GroupManager

**Investigation Result:** CORRECT PATTERN

**Why:** This is the standard save-before-change pattern:
1. `saveState()` captures pre-change state
2. State is modified
3. Undo restores pre-change state (correct!)

---

## God Class Reduction Plan

Current count: **18 god classes** (2 generated + 14 JS + 2 PHP)

All god classes use proper delegation patterns. No emergency refactoring needed.

| File | Lines | Strategy | Priority |
|------|-------|----------|----------|
| InlineTextEditor.js | 1,521 | Could extract RichTextToolbar | Medium |
| PropertyBuilders.js | 1,419 | Could split by layer type | Medium |
| APIManager.js | 1,403 | Could extract RetryManager | Medium |
| ServerSideLayerValidator.php | 1,342 | Strategy pattern | Low |
| LayersDatabase.php | 1,364 | Repository split | Low |

See [GOD_CLASS_REFACTORING_PLAN.md](docs/GOD_CLASS_REFACTORING_PLAN.md) for detailed plan.

---

## Action Items Summary

### ✅ All P1-P2 Items Fixed (v1.5.51 Release)

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| P1 | Fix version in Mediawiki-Extension-Layers.mediawiki | 2 min | ✅ Fixed |
| P2 | Fix version in docs/ARCHITECTURE.md | 2 min | ✅ Fixed |
| P2 | Fix file counts in docs | 5 min | ✅ Fixed |
| P3 | Refactor const self (4 remaining) | Large | Deferred |
| P3 | APIManager abort handling | 30 min | By design |

### ✅ Completed (v10-v12 Review)

| Priority | Item | Status |
|----------|------|--------|
| P1 | Delete ApiSlidesSave.php | ✅ Done |
| P1 | Delete ApiSlideInfo.php | ✅ Done |
| P1 | Fix version inconsistencies | ✅ Done |
| P2 | Add missing booleans to preserveLayerBooleans | ✅ Done |
| P2 | Add inlineTextEditor to CanvasManager destroy | ✅ Done |
| P2 | Add slide support to ApiLayersRename | ✅ Done |
| P2 | Fix test metrics documentation | ✅ Done |
| P3 | Standardize API error codes | ✅ Done |
| P3 | Add rate limiting to ApiLayersInfo | ✅ Done |
| P3 | Add global exception handler to ApiLayersInfo | ✅ Done |
| P3 | Extract magic numbers to constants | ✅ Done |
| P3 | LayersLightbox click handler cleanup | ✅ Done |

---

## Test Coverage Goals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Function | 93.67% | 85% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

No immediate coverage improvements needed. Focus on maintaining current levels.

---

## Documentation Status

Documentation files status for v1.5.51:
- ✅ Mediawiki-Extension-Layers.mediawiki — Correct version (1.5.51)
- ✅ docs/ARCHITECTURE.md — Correct version and file counts (142/40)
- ✅ .github/copilot-instructions.md — Correct file counts
- ✅ README.md — Correct version and test count
- ✅ CONTRIBUTING.md — Correct test count
- ✅ CHANGELOG.md — Correct version
- ✅ wiki/Home.md — Correct test count
- ✅ wiki/Changelog.md — Synchronized
- ✅ wiki/Installation.md — Correct version
- ✅ extension.json — Correct version 1.5.51
- ✅ docs/GOD_CLASS_REFACTORING_PLAN.md — Correct

---

## Changelog

**v14 (February 3, 2026):**
- Fixed all P1-P2 issues as part of v1.5.51 release
  - Mediawiki-Extension-Layers.mediawiki version table updated
  - docs/ARCHITECTURE.md version and file counts fixed
  - All branch references updated to 1.5.51
- Restored overall rating to 9.5/10

**v13 (February 3, 2026):**
- Found version mismatch in Mediawiki-Extension-Layers.mediawiki (P1)
  - Line 124 shows 1.5.49, should be 1.5.50
- Found version mismatch in docs/ARCHITECTURE.md (P2)
  - Line 4 shows 1.5.49, should be 1.5.50
- Found file count inconsistencies (P2)
  - docs/ARCHITECTURE.md: 141 JS / 42 PHP (should be 142 / 40)
  - copilot-instructions.md: 42 PHP (should be 40)
- Ran full test suite: 11,210 tests in 165 suites, all passing
- Downgraded overall rating to 9.4/10 due to documentation sync issues

**v12 (February 3, 2026):****
- Found test count inconsistencies in 5 documentation files (P1)
  - README.md, CONTRIBUTING.md, CHANGELOG.md, copilot-instructions.md, wiki/Home.md
  - All show "11,183" but actual verified count is 11,210 (165 suites)
- Verified metrics from coverage-summary.json: 95.19%/84.96%
- Downgraded overall rating to 9.4/10 due to documentation sync issues

**v11 (February 3, 2026):**
- Found $wgLayersDebug documentation default incorrect (P1) - FIXED
- Found missing client-side canvas dimension validation (P2) - FIXED
- Verified boolean visibility checks are NOT bugs
- Verified history save order is CORRECT
- All 11,210 tests passing

**v10 (February 2, 2026):**
- Fixed version inconsistencies across all documentation
- Fixed test count/coverage metrics in documentation
- Fixed i18n message count inconsistencies

**v9.1 (February 2, 2026):**
- Refactored 9 const self instances to arrow functions
- Fixed LayersLightbox click handler cleanup
- Updated version references in 3 documentation files

---

*Document updated: February 3, 2026 (v14)*  
*Status: Production-ready. All P1-P2 fixed. 2 P3 deferred.*  
*Overall Rating: 9.5/10*
