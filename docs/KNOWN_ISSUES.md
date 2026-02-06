# Known Issues

**Last Updated:** February 5, 2026 (Comprehensive Critical Review v21)
**Version:** 1.5.52

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **0** | ✅ None |
| P1 (High Priority) | **4** | ❌ Open |
| P2 (Medium Priority) | **5** | ❌ Open |
| P3 (Low Priority) | **4** | ⚠️ Deferred/Low |

---

## ✅ All Security Controls Verified (v21)

| Control | Status |
|---------|--------|
| CSRF Protection | ✅ All writes require tokens |
| SQL Injection | ✅ Parameterized queries |
| Rate Limiting | ✅ All 5 APIs have limits |
| XSS Prevention | ✅ Text/SVG sanitization |
| Input Validation | ✅ All parameters validated |
| Authorization | ✅ Owner/admin checks |

**No exploitable security vulnerabilities identified.**

---

## ✅ Previously Reported Issues - Fixed (v21 Verification)

| Issue | Status | Fixed In |
|-------|--------|----------|
| Shape Library Count Wrong | ✅ FIXED | v20 |
| Version Drift (1.5.51 vs 1.5.52) | ✅ FIXED | v20 |
| Rate Limits Missing for Read APIs | ✅ FIXED | v21 verification |
| ApiLayersRename oldname Not Validated | ✅ FIXED | v21 verification |
| ApiLayersDelete slidename Not Validated | ✅ FIXED | v21 verification |
| GridRulersController Dead References | ✅ FIXED | v19 |
| EmojiLibraryData Documentation | ✅ FIXED | v19 |
| layerslist API Missing from Docs | ✅ FIXED | v19 |
| LayerRenderer viewBox Validation | ✅ FIXED | v19 |
| ArrowRenderer Division by Zero | ✅ FIXED | v19 |
| ShapeRenderer Negative Radius | ✅ FIXED | v19 |
| ShadowRenderer Unbounded Canvas | ✅ FIXED | v19 |

---

## ��� P1 - High Priority Issues (v21 Review)

### P1.1 API-Reference.md Missing layerslist Endpoint

**Status:** ❌ OPEN  
**Severity:** P1 (High - Documentation Completeness)  
**File:** [wiki/API-Reference.md](../wiki/API-Reference.md#L9-L17)

**Issue:** The API Reference states "Layers provides **four** API endpoints" but
there are actually five. The `layerslist` endpoint is undocumented.

**Fix Required:** Add `layerslist` documentation and change "four" to "five".

---

### P1.2 GroupManager Recursive Functions Lack Depth Guards

**Status:** ❌ OPEN  
**Severity:** P1 (High - Potential Stack Overflow)  
**File:** [GroupManager.js](../resources/ext.layers.editor/GroupManager.js)

**Issue:** The following recursive functions lack depth guards:
- `isDescendantOf()` (lines 286-302)
- `getGroupChildren()` (lines 878-897)
- `getMaxChildDepth()` (lines 940-956)
- `collectChildren()` in deleteGroup (lines 1044-1054)

**Note:** `getLayerDepth()` correctly has a depth guard - same pattern should apply.

**Risk:** Corrupted data with circular references would cause stack overflow.

---

### P1.3 APIManager Aborted Request Promises Never Settle

**Status:** ❌ OPEN  
**Severity:** P1 (High - Promise Leak)  
**File:** [APIManager.js](../resources/ext.layers.editor/APIManager.js#L641-L646)

**Issue:** When requests are aborted and `rejectAbortedRequests` is false (default),
promises neither resolve nor reject:

```javascript
if ( code === 'http' && result && result.textStatus === 'abort' ) {
    if ( this.rejectAbortedRequests ) {
        reject( { aborted: true, code, result } );
    }
    return;  // Promise hangs forever!
}
```

**Impact:** Memory leaks, stuck UI loading states.

**Note:** This is intentional to prevent state updates on abort, but should be
documented and callers should use timeouts.

---

### P1.4 ImageLayerRenderer Cache Key Collision Risk

**Status:** ❌ OPEN  
**Severity:** P1 (High - Potential Bug)  
**File:** [ImageLayerRenderer.js](../resources/ext.layers.shared/ImageLayerRenderer.js#L159)

**Issue:** Cache key uses `layer.src.substring(0, 50)` as fallback when layer.id
is missing. Base64 data URLs share a common prefix (~23 chars), leaving only
~27 chars for differentiation.

**Impact:** Two different images could share the same cache key.

**Fix Required:** Use hash of full `src` as fallback key.

---

## ��� P2 - Medium Priority Issues (v21 Review)

### P2.1 JavaScript File Count Wrong in Documentation

**Status:** ❌ OPEN  
**Severity:** P2 (Medium - Documentation Accuracy)

**Issue:** Multiple files claim **140 JS files** but actual count is **142 files**.

**Affected Files:**
- .github/copilot-instructions.md (line 400)
- README.md (line 313)
- wiki/Changelog.md (line 44)
- docs/KNOWN_ISSUES.md (line 312 - now corrected)

---

### P2.2 Version 1.5.51 in copilot-instructions

**Status:** ❌ OPEN  
**Severity:** P2 (Medium - Documentation)  
**File:** [.github/copilot-instructions.md](../.github/copilot-instructions.md#L408)

**Issue:** Line 408 says "Version number (1.5.51)" but current is 1.5.52.

---

### P2.3 "4 API modules" in copilot-instructions

**Status:** ❌ OPEN  
**Severity:** P2 (Medium - Documentation)  
**File:** [.github/copilot-instructions.md](../.github/copilot-instructions.md#L30)

**Issue:** Line 30 says ForeignFileHelperTrait is "shared by all **4** API modules"
but there are 5 modules.

---

### P2.4 EventManager isInputElement Incomplete

**Status:** ❌ OPEN  
**Severity:** P2 (Medium - Edge Case Bug)  
**File:** [EventManager.js](../resources/ext.layers.editor/EventManager.js#L120)

**Issue:** The `isInputElement()` function misses:
- `<SELECT>` elements
- `role="textbox"` ARIA attribute
- `contenteditable="plaintext-only"`
- OOUI text widgets

**Impact:** Keyboard shortcuts may fire unexpectedly.

---

### P2.5 StateManager forceUnlock Re-lock Risk

**Status:** ❌ OPEN  
**Severity:** P2 (Medium - Potential Bug)  
**File:** [StateManager.js](../resources/ext.layers.editor/StateManager.js#L397-L412)

**Issue:** During `forceUnlock()`, queued `update()` operations call `lockState()`
internally, which could re-lock during the recovery loop.

---

## ⚠️ P3 - Low Priority / Deferred Issues

### P3.1 README Date Inconsistency

**Status:** ❌ OPEN  
**Severity:** P3 (Low)  
**File:** [README.md](../README.md#L11)

**Issue:** Says "February 3, 2026" but CHANGELOG says "February 5, 2026".

---

### P3.2 wiki/Home.md Headline Version

**Status:** ❌ OPEN  
**Severity:** P3 (Low)  
**File:** [wiki/Home.md](../wiki/Home.md#L23)

**Issue:** Headline says "v1.5.51" but current is 1.5.52.

---

### P3.3 ApiLayersRename Error Code Inconsistency

**Status:** ❌ OPEN  
**Severity:** P3 (Low - Informational)  
**File:** [ApiLayersRename.php](../src/Api/ApiLayersRename.php#L70)

**Issue:** Uses `ERROR_FILE_NOT_FOUND` for missing filename parameter; ApiLayersSave
uses `missingparam`. User experience issue only.

---

### P3.4 ShadowRenderer Temp Canvas Per Call

**Status:** ⚠️ DEFERRED  
**Severity:** P3 (Low - Performance)  
**File:** [ShadowRenderer.js](../resources/ext.layers.shared/ShadowRenderer.js)

**Issue:** New canvas created per shadow draw call (GC pressure).

**Note:** Performance optimization deferred. Canvas dimension cap (8192px) already
added to prevent browser crashes.

---

## Security Status Summary

| Check | Status |
|-------|--------|
| CSRF Protection | ✅ Verified |
| SQL Injection | ✅ Parameterized queries |
| XSS Prevention | ✅ Text sanitization |
| Rate Limiting | ✅ All endpoints covered |
| Authorization | ✅ Owner/admin checks |
| Input Validation | ✅ All parameters validated |

**No exploitable security vulnerabilities identified in v21 review.**
