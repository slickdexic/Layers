# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 24, 2026 (Comprehensive Critical Audit v30)  
**Version:** 1.5.29  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 10,574 tests in 156 suites (all passing, verified January 24, 2026)
- **Coverage:** 94.40% statements, 84.80% branches (verified January 24, 2026)
- **JS files:** 130 (excludes `resources/dist/`)
- **JS lines:** ~114,291 total
- **PHP files:** 40
- **PHP lines:** ~13,947 total
- **i18n messages:** 667 (en.json), 663 (qqq.json)

---

## Executive Summary

The Layers extension is a **mature, feature-rich MediaWiki extension** with **excellent security practices** and **outstanding test coverage**. This critical review identified several areas for improvement that distinguish a good codebase from a world-class one.

**Overall Assessment:** **8.7/10** — Production-ready, high quality. Minor issues prevent a higher score.

### Key Strengths
- Excellent test coverage (94.40% statement, 84.80% branch, 10,574 tests)
- Comprehensive server-side validation with strict property whitelists
- Modern ES6 class-based architecture (all 130 JS files use ES6 classes)
- Proper delegation patterns in large files (facade pattern in CanvasManager)
- Zero skipped tests
- No eval(), document.write(), or new Function() usage (security)
- 9 eslint-disable comments, all legitimate (8 no-alert, 1 no-control-regex)
- Canvas pool implemented and used correctly
- Proper EventTracker for memory-safe event listener management
- Animation frame cleanup with cancelAnimationFrame in all relevant destroy methods
- CSRF token protection on all write endpoints with mustBePosted()

### Issues Identified

| # | Issue | Severity | Status | Category |
|---|-------|----------|--------|----------|
| **NEW-1** | Weak toBeTruthy/toBeFalsy assertions (231 instances) | Medium | 🟡 Open | Testing |
| **NEW-2** | Real setTimeout in tests (50+ instances) | Medium | 🟡 Open | Testing |
| **NEW-3** | Event listener imbalance (212 add vs 64 remove) | Medium | ✅ By Design | Architecture |
| **NEW-4** | innerHTML usage (56 instances) | Low | ✅ Audited Safe | Security |
| **NEW-5** | God classes (22 files ≥1,000 lines) | Low | ✅ Documented | Architecture |
| **NEW-6** | parseFloat/parseInt NaN edge cases | Low | 🟡 Open | Robustness |
| CODE-4 | Magic z-index values (7+ locations) | Low | 🟡 Open | Code Quality |
| CODE-5 | Duplicated clampOpacity() function (8 files) | Low | 🟡 Documented | Code Quality |
| TEST-2 | Jest fake timers not used consistently | Low | 🟡 Open | Testing |
| TEST-3 | Promise chains missing .catch() handlers | Low | 🟡 Open | Error Handling |

---

## 📊 Detailed Metrics

### Test Coverage (January 24, 2026)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statements | 94.40% | 90% | ✅ Exceeds |
| Branches | 84.80% | 80% | ✅ Exceeds |
| Functions | 92.52% | 85% | ✅ Exceeds |
| Lines | 94.54% | 90% | ✅ Exceeds |
| Test Count | 10,574 | - | ✅ Excellent |
| Test Suites | 156 | - | ✅ |
| Skipped Tests | 0 | 0 | ✅ |

### Code Size Analysis

| Category | Files | Lines | Notes |
|----------|-------|-------|-------|
| JavaScript (Production) | 130 | ~114,291 | Excludes dist/ |
| JavaScript (Generated) | 3 | ~40,579 | EmojiLibraryData, ShapeLibraryData, EmojiLibraryIndex |
| JavaScript (Hand-written) | 127 | ~73,712 | Actual application code |
| PHP (Production) | 40 | ~13,947 | All source code |
| Tests (Jest) | 156 suites | ~50,000+ | Comprehensive |
| Documentation | 75 files | - | Markdown docs + wiki |
| i18n Messages | 667 | - | Fully documented (663 in qqq.json) |

---

## 🔴 Issues Requiring Attention

### NEW-1: Weak Test Assertions (231 instances)

**Severity:** Medium  
**Category:** Testing Quality  
**Count:** 231 uses of `toBeTruthy()` / `toBeFalsy()`

**Problem:** These assertions are too permissive. They pass for truthy/falsy values but don't verify the actual expected type or value.

```javascript
// BAD: Passes for any truthy value (object, string, number, true)
expect(result).toBeTruthy();

// GOOD: Verifies the actual expected value/type
expect(result).toBeDefined();
expect(result).toBeInstanceOf(LayerSet);
expect(result.id).toBe('expected-id');
```

**Risk:** False positives in tests - tests pass even when the result is wrong type.

**Locations:** Spread across test files in `tests/jest/`

**Recommendation:** Replace with specific matchers:
- `toBeTruthy()` → `toBeDefined()`, `toBeInstanceOf()`, or specific value checks
- `toBeFalsy()` → `toBeNull()`, `toBeUndefined()`, `toBe(false)`, or `toBe(0)`

---

### NEW-2: Real setTimeout in Tests (50+ instances)

**Severity:** Medium  
**Category:** Testing Quality  
**Count:** 50+ instances of real `setTimeout` in tests

**Problem:** Tests using real timers are slower and can be flaky due to timing variations.

**Pattern Found:**
```javascript
// BAD: Real timer - slow and potentially flaky
await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );
```

**Files Affected:**
- ApiFallback.test.js (17+ instances)
- APIManager.test.js (8+ instances)
- InlineTextEditor.test.js (2+ instances)
- Many other test files

**Recommendation:** Use Jest fake timers:
```javascript
jest.useFakeTimers();
// ... trigger async operation
jest.runAllTimers();
// ... assertions
```

---

### NEW-3: Event Listener Imbalance

**Severity:** Medium (but verified safe)  
**Category:** Architecture / Memory Management  
**Metrics:** 212 addEventListener calls vs 64 removeEventListener calls

**Analysis:** The 3:1 ratio initially suggests potential memory leaks, but investigation reveals:

1. **EventTracker pattern:** 110+ references to EventTracker which automatically handles cleanup
2. **Destroy methods:** All major components have proper destroy() methods
3. **isDestroyed guards:** Components check `this.isDestroyed` before operations

**Status:** ✅ By Design - The codebase uses EventTracker for automatic cleanup, which explains the apparent imbalance. The low removeEventListener count is because cleanup happens through `EventTracker.destroy()` rather than individual removeEventListener calls.

---

### NEW-4: innerHTML Usage (56 instances)

**Severity:** Low  
**Category:** Security  
**Count:** 56 instances (up from previously reported 20+)

**Audit Results:**

| Usage Type | Count | Risk Level |
|------------|-------|------------|
| Static SVG icons (hardcoded strings) | ~30 | None |
| Unicode characters ('×', '▼', '⋮⋮') | ~10 | None |
| i18n messages from mw.message() | ~5 | None (MW sanitizes) |
| Clear container (`innerHTML = ''`) | ~10 | None |
| Template literals (static content) | ~6 | Low |

**Verdict:** All innerHTML usages were audited and found safe. None use unsanitized user input. The pattern is acceptable but should not be extended carelessly.

**Recommendation:** Document the pattern as safe for static content only. Use DOM APIs for new code.

---

### NEW-5: God Classes (22 files ≥1,000 lines)

**Severity:** Low (well-managed)  
**Category:** Architecture  

**Generated Data Files (4 files - exempt from refactoring):**

| File | Lines | Purpose |
|------|-------|---------|
| EmojiLibraryData.js | 26,277 | Generated emoji metadata |
| ShapeLibraryData.js | 11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | 3,003 | Generated search index |
| *Total Generated* | *40,579* | *35% of JS codebase* |

**Hand-Written Files (18 files with proper delegation):**

| File | Lines | Delegation Status | Coverage |
|------|-------|-------------------|----------|
| CanvasManager.js | 2,044 | ✅ 10+ controllers | 88.65% |
| LayerPanel.js | 2,039 | ✅ 9 controllers | 77.86% |
| ViewerManager.js | 2,003 | ✅ Delegates to renderers | 88.79% |
| Toolbar.js | 1,887 | ✅ 4 modules | 89.81% |
| LayersEditor.js | 1,767 | ✅ 3 modules | 88.96% |
| APIManager.js | 1,512 | ✅ APIErrorHandler | 88.34% |
| SelectionManager.js | 1,431 | ✅ 3 modules | 91.57% |
| ArrowRenderer.js | 1,301 | N/A (math complexity) | 91.22% |
| PropertyBuilders.js | 1,293 | N/A (UI builders) | 98.13% |
| CalloutRenderer.js | 1,291 | N/A (rendering logic) | 90.45% |
| InlineTextEditor.js | 1,288 | N/A (feature complexity) | 94.66% |
| ToolManager.js | 1,224 | ✅ 2 handlers | 95.27% |
| CanvasRenderer.js | 1,219 | ✅ SelectionRenderer | 93.92% |
| GroupManager.js | 1,171 | N/A (group operations) | 97.16% |
| TransformController.js | 1,110 | N/A (transforms) | 97.78% |
| ResizeCalculator.js | 1,105 | N/A (math) | 100% |
| ToolbarStyleControls.js | 1,098 | ✅ Style controls | 96.35% |
| PropertiesForm.js | 1,004 | ✅ PropertyBuilders | 92.79% |

**Watch List (Approaching 1,000 lines):**

| File | Lines | Trend |
|------|-------|-------|
| ShapeRenderer.js | 994 | ⚠️ Near threshold |
| LayerRenderer.js | 966 | Stable |

---

### NEW-6: parseFloat/parseInt Edge Cases

**Severity:** Low  
**Category:** Robustness  

**Pattern found in renderers:**
```javascript
// Potentially problematic if strokeWidth is undefined or NaN
const strokeWidth = parseFloat( layer.strokeWidth ) || 0;
```

**Good pattern found (NumericValidator.js):**
```javascript
// Explicit NaN check with fallback
if ( typeof strokeWidth !== 'number' || isNaN( strokeWidth ) || strokeWidth <= 0 ) {
    strokeWidth = DEFAULTS.strokeWidth;
}
```

**Recommendation:** Audit parseFloat/parseInt calls and add explicit NaN checks where input could be undefined.

---

## ✅ Previously Fixed Issues

| Issue | Status | Fixed Date |
|-------|--------|------------|
| SEC-1: Missing mustBePosted() | ✅ Fixed | Jan 24, 2026 |
| CODE-1: console.log in production | ✅ Fixed | Jan 24, 2026 |
| CODE-2: Hardcoded i18n strings | ✅ Already i18n'd | Jan 24, 2026 |
| CODE-3: DEBUG comments | ✅ Fixed | Jan 24, 2026 |
| PERF-1: ShapeLibraryPanel DOM | ✅ Fixed | Jan 24, 2026 |
| PERF-2: InlineTextEditor resize | ✅ Fixed | Jan 24, 2026 |
| TEST-1: Tautological assertions | ✅ Fixed | Jan 24, 2026 |
| DOC-1: PHP line count | ✅ Fixed | Jan 24, 2026 |

---

## ✅ Security Verification

### CSRF Token Protection ✅

All write endpoints require CSRF tokens and POST method:

| API Module | needsToken() | isWriteMode() | mustBePosted() |
|------------|--------------|---------------|----------------|
| ApiLayersSave | ✅ 'csrf' | ✅ true | ✅ true |
| ApiLayersDelete | ✅ 'csrf' | ✅ true | ✅ true |
| ApiLayersRename | ✅ 'csrf' | ✅ true | ✅ true |
| ApiSlidesSave | ✅ 'csrf' | ✅ true | ✅ true |

### Rate Limiting ✅

All write operations are rate-limited:
- `editlayers-save`: Configurable via $wgRateLimits
- `editlayers-delete`: Configurable via $wgRateLimits

### Input Validation ✅

- ServerSideLayerValidator: 40+ property whitelist with type validation
- SetNameSanitizer: Path traversal prevention
- TextSanitizer: XSS prevention
- ColorValidator: Strict color format validation
- Size limits: $wgLayersMaxBytes, $wgLayersMaxLayerCount

### Other Security Checks ✅

- ❌ No `eval()` in production code
- ❌ No `document.write()` usage
- ❌ No `new Function()` usage
- ✅ SQL injection protected via parameterized queries
- ✅ postMessage origin validation (ViewerOverlay.js)
- ✅ localStorage access wrapped in try-catch

---

## 📊 Architecture Analysis

### Strengths

1. **Facade Pattern:** CanvasManager delegates to 10+ specialized controllers
2. **State Management:** StateManager with locking prevents race conditions
3. **Request Tracking:** APIManager tracks and aborts stale requests
4. **Memory Management:** EventTracker + TimeoutTracker + isDestroyed guards
5. **Error Handling:** Comprehensive error boundaries with user feedback

### Areas for Improvement

1. **God Class Count:** 22 files exceed 1,000 lines (though well-managed)
2. **Z-index Chaos:** 7+ different hardcoded z-index values
3. **DRY Violations:** clampOpacity() duplicated in 8 renderer files
4. **Test Quality:** Real timers and weak assertions reduce test reliability

---

## Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent - all endpoints protected |
| Test Coverage | 9.0/10 | 20% | 94.4% statements, but weak assertions |
| Functionality | 9.0/10 | 20% | Feature-complete, 15 tools |
| Architecture | 8.5/10 | 15% | Good patterns, proper cleanup |
| Performance | 8.5/10 | 5% | Minor optimization opportunities |
| Documentation | 9.0/10 | 5% | 75 markdown files, good coverage |
| Code Quality | 8.0/10 | 10% | God classes, weak test assertions |

**Weighted Total: 8.73/10 → Overall: 8.7/10**

### Score History

| Date | Version | Score | Notes |
|------|---------|-------|-------|
| Jan 24, 2026 | v30 | **8.7/10** | Critical review with new findings |
| Jan 24, 2026 | v29 | 9.0/10 | P2 items fixed |
| Jan 24, 2026 | v28 | 8.5/10 | Initial critical audit |

---

## Recommendations by Priority

### P0 (Critical — Immediate)
None. All critical issues have been resolved.

### P1 (High — Next Sprint)
1. **NEW-1:** Replace weak toBeTruthy/toBeFalsy assertions with specific matchers
2. **NEW-2:** Migrate tests to use Jest fake timers

### P2 (Medium — Next Milestone)
1. **NEW-6:** Add explicit NaN checks to parseFloat/parseInt calls
2. **TEST-3:** Audit Promise chains for missing .catch() handlers
3. **CODE-4:** Create centralized z-index constants file

### P3 (Long-Term)
1. Consider TypeScript migration for complex modules
2. Add visual regression testing
3. Continue god class delegation improvements

---

## Appendix: Verification Commands

```bash
# Verify branch and status
git status

# Run tests with coverage
npm run test:js -- --coverage --silent

# Get test count and coverage summary
npm run test:js -- --coverage --silent 2>&1 | grep -E "Tests:|All files"

# Run full lint suite
npm test

# JS file count (excluding dist)
find resources -name "*.js" ! -path "*/dist/*" | wc -l
# Result: 130

# JS line count
find resources -name "*.js" ! -path "*/dist/*" -exec wc -l {} + | tail -1
# Result: 114,291 total

# PHP file count and line count
find src -name "*.php" | wc -l  # Result: 40
find src -name "*.php" -exec wc -l {} + | tail -1  # Result: 13,947 total

# Find eslint-disable comments
grep -rn "eslint-disable" resources --include="*.js"  # Result: 9 comments

# Count toBeTruthy/toBeFalsy
grep -rn "toBeTruthy\|toBeFalsy" tests/jest/ | wc -l  # Result: 231

# Count addEventListener vs removeEventListener
grep -rn "addEventListener" resources/ext.layers* --include="*.js" | wc -l  # Result: 212
grep -rn "removeEventListener" resources/ext.layers* --include="*.js" | wc -l  # Result: 64

# Count innerHTML usages
grep -rn "innerHTML" resources/ext.layers* --include="*.js" | wc -l  # Result: 56

# Count EventTracker usage
grep -rn "eventTracker\|EventTracker" resources/ext.layers* --include="*.js" | wc -l  # Result: 110

# Check for skipped tests
grep -rn "it\.skip\|describe\.skip\|test\.skip\|xit\|xdescribe" tests/jest/
# Result: 0 skipped tests
```

---

*Review performed on `main` branch, January 24, 2026.*  
*Rating: 8.7/10 — Production-ready, high quality. Test quality improvements needed for world-class status.*
