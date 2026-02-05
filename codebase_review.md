# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 5, 2026 (Comprehensive Critical Review v19 - UPDATED)  
**Version:** 1.5.51  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git branch --show-current`)
- **Tests (Feb 5, 2026):**
  - `npm test` → eslint/stylelint/banana ✅ (warnings only for ignored scripts)
  - `CI=true npm run test:js` → **165/165 Jest suites**, 11,231 tests ✅
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 140 files in `resources/` (~96,498 lines, excluding dist/)
- **PHP production files:** 40 in `src/` (~14,915 lines)
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The Layers extension is a **mature, production-ready system** with **high
test coverage** and a **strong security posture**. All lint, i18n, and Jest
suites pass on February 5, 2026.

**Overall Assessment:** ✅ Production-ready. All P1/P2 issues from v19 review
have been resolved. Security posture remains excellent.

### Key Strengths
1. **Strict Validation:** `ServerSideLayerValidator` enforces a whitelist of
    50+ properties and 15+ constraints.
2. **Security by Design:**
    - CSRF protection (verified tokens on write).
    - XSS prevention (SVG sanitization, no `eval()`).
    - ReDoS protection (`MAX_COLOR_LENGTH`, input length limits).
    - Resource limits (`MAX_TOTAL_POINTS` = 10000, `MAX_TOTAL_LENGTH` = 50000).
    - Rate limiting on all write/read operations.
    - Owner/admin authorization for destructive ops.
3. **Test Coverage:** 95%+ statement coverage provides high confidence in
    refactoring.
4. **Modern Architecture:** 100% ES6 classes, facade patterns for complex
    managers.

### Issue Summary (February 5, 2026 - v19 Review UPDATED)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Documentation | 0 | 0 | 0 | 0 | ✅ All fixed |
| Code Quality | 0 | 0 | 0 | 1 | Promise abort (deferred) |
| Security | 0 | 0 | 0 | 0 | ✅ All controls verified |
| Tests | 0 | 0 | 0 | 0 | ✅ All passing |
| **Total Open** | **0** | **0** | **0** | **1** | |

---

## ✅ Issues Fixed in v19 (February 5, 2026)

### HIGH-1v19: Dead File Reference - GridRulersController.js

**Status:** ✅ FIXED  
**Severity:** HIGH (Documentation Integrity)  
**Component:** Multiple documentation files

**Problem:** `GridRulersController.js` was referenced in **11 places** but the
file did not exist in the codebase.

**Resolution:** Removed all dead references from:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Mermaid diagrams (4 locations)
- [wiki/Frontend-Architecture.md](wiki/Frontend-Architecture.md) - Table
- [wiki/Architecture-Overview.md](wiki/Architecture-Overview.md) - Tree
- [resources/ext.layers.editor/canvas/README.md](resources/ext.layers.editor/canvas/README.md)
- [docs/archive/MODULAR_ARCHITECTURE.md](docs/archive/MODULAR_ARCHITECTURE.md)
- [.eslintrc.json](.eslintrc.json) - Global variable declaration

---

### HIGH-2v19: Dead File Reference - EmojiLibraryData.js

**Status:** ✅ FIXED  
**Severity:** HIGH (Documentation Integrity)  
**Component:** Documentation

**Problem:** Documentation claimed `EmojiLibraryData.js` (~26,277 lines) and
~40,000 total generated lines, but this file doesn't exist.

**Actual state:** Only 2 generated data files:
- `ShapeLibraryData.js` (11,299 lines)
- `EmojiLibraryIndex.js` (3,055 lines)
- `emoji-bundle.json` (bundled emoji SVG data)
- **Total: ~14,354 lines**

**Resolution:** Updated [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[.github/copilot-instructions.md](.github/copilot-instructions.md) to reflect
actual file structure and line counts.

---

### MEDIUM-1v19: Missing API Endpoint Documentation

**Status:** ✅ FIXED  
**Severity:** MEDIUM  
**Component:** API Documentation

**Problem:** `ApiLayersList` (5th API module) was not documented.

**Resolution:** Added `layerslist` documentation to:
- [README.md](README.md) - Updated to "5 API endpoints"
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Added module
- [docs/README.md](docs/README.md) - Added to quick links

---

### MEDIUM-2v19: LayerRenderer viewBox Null Check Missing

**Status:** ✅ FIXED  
**Severity:** MEDIUM (Runtime Crash)  
**Component:** [LayerRenderer.js](resources/ext.layers.shared/LayerRenderer.js)

**Problem:** `viewBox` array accessed without length validation.

**Resolution:** Added array validation:
```javascript
if ( !Array.isArray( viewBox ) || viewBox.length < 4 ) {
    return;
}
```

---

### MEDIUM-3v19: ArrowRenderer Division by Zero

**Status:** ✅ FIXED  
**Severity:** MEDIUM (Runtime Error)  
**Component:** [ArrowRenderer.js](resources/ext.layers.shared/ArrowRenderer.js)

**Problem:** Division by zero when `arrowSize` is 0.

**Resolution:** Added guard:
```javascript
const expandedHeadScale = arrowSize > 0
    ? ( arrowSize + extraSpread ) / arrowSize * effectiveHeadScale
    : effectiveHeadScale;
```

---

### LOW-1v19: ShapeRenderer Negative Radius Crash

**Status:** ✅ FIXED  
**Severity:** LOW  
**Component:** [ShapeRenderer.js](resources/ext.layers.shared/ShapeRenderer.js)

**Problem:** `ctx.arc()` throws if radius is negative.

**Resolution:** Added `Math.max(0, ...)` guard for radius.

---

### LOW-2v19: ShadowRenderer Creating Temp Canvas Every Call

**Status:** ⚠️ DEFERRED  
**Severity:** LOW (Performance)  
**Component:** [ShadowRenderer.js](resources/ext.layers.shared/ShadowRenderer.js)

**Note:** Performance optimization deferred. Canvas dimension cap added instead.

---

### LOW-3v19: ShadowRenderer Unbounded Canvas Dimensions

**Status:** ✅ FIXED  
**Severity:** LOW  
**Component:** [ShadowRenderer.js](resources/ext.layers.shared/ShadowRenderer.js#L239-L242)

**Problem:** No cap on temp canvas size. Extreme `shadowBlur` or `shadowOffset`
values could exceed browser limits (16384-32768px).

**Fix:** Add `Math.min(MAX_CANVAS_DIM, ...)` cap.

---

## ✅ Issues Closed in v18/v19

### HIGH-1v17: README.md Metric Inconsistencies

**Status:** ✅ CLOSED (v18)  
**Component:** README.md

**Resolution:** Updated to reflect current counts: **140 JS files**, **40 PHP files**.

### P3-Low: const self Anti-Pattern

**Status:** ✅ CLOSED (v18)  
**Resolution:** Replaced with lexical `this` and arrow functions.

---

## ✅ Verified Security Controls

| Category | Status | Notes |
|----------|--------|-------|
| **CSRF Protection** | ✅ | All write APIs require tokens. |
| **SQL Injection** | ✅ | All queries use parameterized MediaWiki API. |
| **Input Validation** | ✅ | Whitelist + type enforcement (40+ fields). |
| **Rate Limiting** | ✅ | Per-action limits (save/delete/rename/render). |
| **Authorization** | ✅ | Owner/admin checks for destructive ops. |
| **ReDoS Protection** | ✅ | `ColorValidator` trims input length (50 chars). |
| **XSS Prevention** | ✅ | SVG paths strict regex, text sanitization. |
| **Resource Exhaustion** | ✅ | Layer/point/payload limits enforced. |
| **Transaction Safety** | ✅ | FOR UPDATE locks prevent race conditions. |

---

## 📊 God Class Status

**Count:** 18 files ≥1,000 lines (Stable)

| File | Lines | Strategy | Status |
|------|-------|----------|--------|
| `LayerPanel.js` | ~2,182 | Delegates to 9 controllers | Separated |
| `CanvasManager.js` | ~2,044 | Facade Pattern | Stable |
| `Toolbar.js` | ~1,891 | Extracted ToolbarStyleControls | Stable |
| `LayersEditor.js` | ~1,829 | Extracted EditorBootstrap | Stable |
| `ServerSideLayerValidator.php` | ~1,341 | Strategy candidates | Stable |
| `LayersDatabase.php` | ~1,360 | Repository Pattern | Stable |

Refactoring is deferred as delegation patterns are properly implemented.

---

## Best Practices Review

| Area | Status | Notes |
|------|--------|-------|
| **Memory Management** | ✅ | All classes have `destroy()` methods |
| **Event Tracking** | ✅ | `EventTracker` prevents leaks |
| **Async Handling** | ✅ | `StateManager` uses lock queue with timeout |
| **Error Handling** | ✅ | Generic errors to client, detailed server logs |
| **Logging** | ✅ | `LayersLogger` provides structured output |
| **Code Style** | ✅ | No `console.log` or `TODO` in production |

---

## Recommendations

### ✅ All Priority 1 and Priority 2 Items Completed

The following items have been fixed in v19:
1. ✅ Removed all `GridRulersController.js` dead references
2. ✅ Updated generated file documentation (14,354 lines)
3. ✅ Added `layerslist` API to documentation
4. ✅ Added viewBox array validation in `LayerRenderer.js`
5. ✅ Added division by zero guard in `ArrowRenderer.js`
6. ✅ Added negative radius guard in `ShapeRenderer.js`
7. ✅ Added canvas dimension cap in `ShadowRenderer.js` (8192px max)

### Deferred (P3)
1. Consider explicit Promise rejection on abort for debugging
2. Consider reusing temp canvas in `ShadowRenderer.js` for performance
