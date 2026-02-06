# Layers MediaWiki Extension - Codebase Review

**Review Date:** February 5, 2026 (Comprehensive Critical Review v21)
**Version:** 1.5.52
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git branch --show-current`)
- **Tests (Feb 5, 2026):**
  - `npm test` → eslint/stylelint/banana ✅ (warnings only for ignored scripts)
  - `CI=true npm run test:js` → **165/165 Jest suites**, 11,231 tests ✅
- **Coverage:** 95.19% statements, 84.96% branches, 93.67% functions,
    95.32% lines (coverage/coverage-summary.json)
- **JS source files:** 142 files in `resources/` (~96,498 lines)
- **PHP production files:** 40 in `src/` (~14,915 lines)
- **i18n messages:** ~749 lines in en.json (all documented in qqq.json)
- **API Modules:** 5 (layersinfo, layerssave, layersdelete, layersrename, layerslist)

---

## Executive Summary

The Layers extension is a **mature, production-ready system** with **high
test coverage** (95.19%) and a **strong security posture**. All lint, i18n, and
Jest suites pass on February 5, 2026.

**Overall Assessment:** The v21 review confirms this is a high-quality codebase.
The PHP backend shows exemplary security practices. The primary issues are
documentation accuracy discrepancies and minor JavaScript edge cases.

### Key Strengths
1. **Strict Validation:** `ServerSideLayerValidator` enforces 50+ properties.
2. **Security by Design:**
    - CSRF protection on all writes
    - Rate limiting on ALL operations (read and write) ✅
    - XSS prevention, ReDoS protection
    - Owner/admin authorization for destructive ops
3. **Test Coverage:** 95%+ statement coverage
4. **Modern Architecture:** 100% ES6 classes, facade patterns
5. **No Production console.log:** Only in Node.js build scripts

### Issue Summary (February 5, 2026 - v21 Review)

| Category | Critical | High | Medium | Low | Notes |
|----------|----------|------|--------|-----|-------|
| Documentation | 0 | 2 | 3 | 2 | File counts, API docs, version |
| Code Quality | 0 | 2 | 2 | 2 | Recursive guards, cache keys |
| Security | 0 | 0 | 0 | 0 | All controls verified ✅ |
| Tests | 0 | 0 | 0 | 0 | ✅ All 11,231 passing |
| **Total Open** | **0** | **4** | **5** | **4** | |

---

## ✅ Verified Security Controls (v21)

| Category | Status | Evidence |
|----------|--------|----------|
| CSRF Protection | ✅ PASS | All write APIs require tokens |
| SQL Injection | ✅ PASS | 100% parameterized queries |
| Input Validation | ✅ PASS | SetNameSanitizer, SlideNameValidator |
| Rate Limiting | ✅ PASS | All 5 APIs have limits |
| Authorization | ✅ PASS | Owner/admin checks |
| ReDoS Protection | ✅ PASS | ColorValidator limits to 50 chars |
| XSS Prevention | ✅ PASS | SVG strict regex, text sanitization |
| Resource Exhaustion | ✅ PASS | Layer/point/payload limits |
| Transaction Safety | ✅ PASS | FOR UPDATE locks |

**No critical security vulnerabilities identified.**

---

## ✅ Previously Reported Issues - Now Verified Fixed

| Issue | Status | Evidence |
|-------|--------|----------|
| Shape Library Count | ✅ FIXED | All docs show 5,116 shapes |
| Rate Limits for Read APIs | ✅ FIXED | RateLimiter.php has editlayers-info/list |
| ApiLayersRename oldname | ✅ FIXED | SetNameSanitizer::isValid() check added |
| ApiLayersDelete slidename | ✅ FIXED | SlideNameValidator::isValid() check added |

---

## ��� HIGH Priority Issues (v21 Review)

### HIGH-1v21: API-Reference.md Missing layerslist Endpoint

**Status:** ❌ OPEN  
**Severity:** HIGH (Documentation)  
**Component:** [wiki/API-Reference.md](wiki/API-Reference.md#L9-L17)

**Problem:** Claims "four" API endpoints but there are five. The `layerslist`
endpoint is undocumented.

---

### HIGH-2v21: GroupManager Recursive Functions Lack Depth Guards

**Status:** ❌ OPEN  
**Severity:** HIGH (Potential Stack Overflow)  
**Component:** [GroupManager.js](resources/ext.layers.editor/GroupManager.js)

**Problem:** `isDescendantOf()`, `getGroupChildren()`, `getMaxChildDepth()`, and
`collectChildren()` lack depth guards. Circular refs would cause stack overflow.

---

### HIGH-3v21: APIManager Aborted Request Promises Never Settle

**Status:** ❌ OPEN  
**Severity:** HIGH (Promise Leak)  
**Component:** [APIManager.js](resources/ext.layers.editor/APIManager.js#L641)

**Problem:** Aborted requests leave promises pending forever; can cause memory
leaks and stuck UI states.

---

### HIGH-4v21: ImageLayerRenderer Cache Key Collision Risk

**Status:** ❌ OPEN  
**Severity:** HIGH (Rendering Bug Risk)  
**Component:** [ImageLayerRenderer.js](resources/ext.layers.shared/ImageLayerRenderer.js#L159)

**Problem:** Cache uses `layer.src.substring(0, 50)` as fallback. Base64 URLs
share prefixes, risking collision.

---

## ��� MEDIUM Priority Issues (v21 Review)

### MEDIUM-1v21: JavaScript File Count Wrong

**Status:** ❌ OPEN  
**Severity:** MEDIUM  

**Problem:** Docs say 140 JS files; actual is 142.

---

### MEDIUM-2v21: Version 1.5.51 in copilot-instructions

**Status:** ❌ OPEN  
**Severity:** MEDIUM  
**Component:** [.github/copilot-instructions.md](.github/copilot-instructions.md#L408)

---

### MEDIUM-3v21: "4 API modules" in copilot-instructions

**Status:** ❌ OPEN  
**Severity:** MEDIUM  
**Component:** [.github/copilot-instructions.md](.github/copilot-instructions.md#L30)

---

### MEDIUM-4v21: EventManager isInputElement Incomplete

**Status:** ❌ OPEN  
**Severity:** MEDIUM (Edge Case)  
**Component:** [EventManager.js](resources/ext.layers.editor/EventManager.js#L120)

**Problem:** Misses SELECT, role="textbox", OOUI widgets.

---

### MEDIUM-5v21: StateManager forceUnlock Re-lock Risk

**Status:** ❌ OPEN  
**Severity:** MEDIUM  
**Component:** [StateManager.js](resources/ext.layers.editor/StateManager.js#L397)

**Problem:** Queued operations may call lockState() during recovery.

---

## ��� LOW Priority Issues (v21 Review)

### LOW-1v21: README Date Says February 3

**Status:** ❌ OPEN  
**Problem:** Should be February 5.

---

### LOW-2v21: wiki/Home.md v1.5.51 Headline

**Status:** ❌ OPEN  
**Problem:** Should say v1.5.52.

---

### LOW-3v21: ApiLayersRename Error Code Inconsistency

**Status:** ❌ OPEN  
**Problem:** Uses filenotfound for missing param; ApiLayersSave uses missingparam.

---

### LOW-4v21: ShadowRenderer Temp Canvas Per Call

**Status:** ⚠️ DEFERRED  
**Note:** Performance optimization; dimension cap already added.

---

## ��� Code Quality Metrics

### God Class Count: 18 files ≥1,000 lines (Stable)

All use delegation patterns appropriately.

### Security Audit

| Check | Status |
|-------|--------|
| No console.log in production | ✅ |
| No TODO/FIXME comments | ✅ |
| CSRF on all writes | ✅ |
| Rate limits everywhere | ✅ |

---

## Recommendations

### Priority 1 (High)
1. Add `layerslist` to wiki/API-Reference.md
2. Add depth guards to GroupManager recursive functions
3. Document or fix APIManager abort behavior
4. Improve ImageLayerRenderer cache key

### Priority 2 (Medium)
5. Update JS file count from 140 to 142
6. Update version to 1.5.52 in copilot-instructions.md
7. Update "4 API modules" to "5 API modules"
8. Expand EventManager isInputElement
9. Fix StateManager forceUnlock re-locking

### Priority 3 (Low)
10. Fix README date
11. Update wiki/Home.md headline
12. Standardize error codes

---

## Conclusion

The Layers extension is a **high-quality, secure, well-tested codebase**. The v21
review found **no critical security issues**. The PHP backend demonstrates exemplary
security practices. Primary findings are documentation accuracy issues and minor
JavaScript edge cases. The codebase is production-ready.
