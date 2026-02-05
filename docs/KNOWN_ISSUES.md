# Known Issues

**Last Updated:** February 5, 2026 (Comprehensive Critical Review v19 - UPDATED)
**Version:** 1.5.51

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None |
| P1 (High Priority) | **0** | ✅ All fixed |
| P2 (Medium Priority) | **0** | ✅ All fixed |
| P3 (Low Priority) | **2** | ⚠️ Deferred |

---

## ✅ Fixed Issues (v19 Review - February 5, 2026)

### P1.1 Dead File Reference - GridRulersController.js

**Status:** ✅ FIXED  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** `GridRulersController.js` was referenced in 11 places but didn't exist.

**Resolution:** Removed all dead references from:
- docs/ARCHITECTURE.md (4 locations)
- wiki/Frontend-Architecture.md
- wiki/Architecture-Overview.md
- resources/ext.layers.editor/canvas/README.md (2 locations)
- docs/archive/MODULAR_ARCHITECTURE.md
- .eslintrc.json

---

### P1.2 Dead File Reference - EmojiLibraryData.js

**Status:** ✅ FIXED  
**Severity:** P1 (High)  
**Component:** Documentation

**Issue:** Documentation claimed `EmojiLibraryData.js` with ~26,277 lines existed.

**Resolution:** Updated docs/ARCHITECTURE.md and .github/copilot-instructions.md
to reflect actual file structure (~14,354 lines total).

---

### P2.1 Missing layerslist API Documentation

**Status:** ✅ FIXED  
**Severity:** P2 (Medium)  
**Component:** API Documentation

**Issue:** `ApiLayersList.php` (5th API module) was not documented.

**Resolution:** Added documentation to README.md, copilot-instructions.md, and
docs/README.md.

---

### P2.2 LayerRenderer viewBox Array Access Without Validation

**Status:** ✅ FIXED  
**Severity:** P2 (Medium)  
**Component:** Renderer

**Issue:** viewBox array accessed without length validation.

**Resolution:** Added array validation check before accessing viewBox elements.

---

### P2.3 ArrowRenderer Division by Zero

**Status:** ✅ FIXED  
**Severity:** P2 (Medium)  
**Component:** Renderer

**Issue:** Division by zero when arrowSize is 0.

**Resolution:** Added guard to check arrowSize > 0 before division.

---

### P3.1 ShapeRenderer Negative Radius Edge Case

**Status:** ✅ FIXED  
**Severity:** P3 (Low)  
**Component:** Renderer

**Issue:** `ctx.arc()` throws if radius is negative.

**Resolution:** Added `Math.max(0, ...)` guard for radius.

---

### P3.3 ShadowRenderer Unbounded Canvas Dimensions

**Status:** ✅ FIXED  
**Severity:** P3 (Low)  
**Component:** Renderer

**Issue:** No cap on temp canvas dimensions.

**Resolution:** Added MAX_CANVAS_DIM (8192px) cap to prevent browser crashes.

---

---

## ⚠️ Deferred Issues (Low Priority)

### P3.2 ShadowRenderer Creates Temp Canvas Every Call

**Status:** ⚠️ DEFERRED  
**Severity:** P3 (Low)  
**Component:** Performance  
**File:** [ShadowRenderer.js](../resources/ext.layers.shared/ShadowRenderer.js)

**Issue:** New canvas created on every shadow draw call, causing GC pressure
with many shadowed shapes.

**Recommendation:** Reuse single offscreen canvas, resize only when needed.

**Deferred Reason:** Performance optimization, not a correctness issue.

---

### P3.4 APIManager Promise Handling on Abort

**Status:** ⚠️ DEFERRED (by design)  
**Severity:** P3 (Low)  
**Component:** API Error Handling

**Issue:** Aborted requests leave Promise unresolved.

**Note:** Intentional behavior to prevent state updates after context switch.
Consider explicit rejection for debugging.

**Deferred Reason:** By design; changing could introduce regressions.

---

## ✅ Fixed Issues (v18/v19 Review)

### P1 README.md Metric Inconsistencies

**Status:** ✅ FIXED (v18)  
**Resolution:** Updated to reflect **140 JS files** and **40 PHP files**.

### P3 const self Anti-Pattern

**Status:** ✅ FIXED (v18)  
**Resolution:** Replaced with lexical `this` and arrow functions.

---

## ✅ Fixed Issues (v16 Review)

### P1 Test Count Wrong in Documentation

**Status:** ✅ FIXED  
**Resolution:** Updated all 10+ files to show **11,231 tests**.

---

## Security Status

| Check | Status |
|-------|--------|
| CSRF Protection | ✅ Verified |
| SQL Injection | ✅ Parameterized queries |
| XSS Prevention | ✅ Text sanitization |
| Rate Limiting | ✅ All actions |
| Authorization | ✅ Owner/admin checks |

No security vulnerabilities identified in v19 review.
