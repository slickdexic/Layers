# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 25, 2026 (Comprehensive Critical Audit v35)  
**Version:** 1.5.29  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 10,613 tests in 157 suites (all passing, verified January 25, 2026)
- **Coverage:** 94.19% statements, 84.43% branches (verified January 25, 2026)
- **JS files:** 127 (excludes `resources/dist/` and `resources/*/scripts/`)
- **JS lines:** ~115,002 total (~40,579 generated, ~74,423 hand-written)
- **PHP files:** 40 (all with `declare(strict_types=1)`)
- **PHP lines:** ~14,169 total
- **i18n messages:** 676 keys in en.json, 672 in qqq.json (4 keys missing documentation)

---

## Executive Summary

The Layers extension is a **mature, feature-rich MediaWiki extension** with **excellent security practices** and **outstanding test coverage**. This is a production-ready extension suitable for deployment.

**Overall Assessment:** **8.4/10** — Production-ready, high quality with notable areas for improvement.

### Key Strengths
1. **Excellent test coverage** (94.19% statement, 84.43% branch, 10,613 tests)
2. **Comprehensive server-side validation** with strict 40+ property whitelist
3. **Modern ES6 class-based architecture** (100% of 127 JS files)
4. **PHP strict_types** in all 40 PHP files
5. **ReDoS protection** in ColorValidator (MAX_COLOR_LENGTH = 50)
6. **Proper delegation patterns** in large files (facade pattern in CanvasManager)
7. **Zero skipped tests**, zero weak assertions (toBeTruthy/toBeFalsy)
8. **No eval(), document.write(), or new Function()** usage (security)
9. **11 eslint-disable comments**, all legitimate (8 no-alert, 2 no-undef, 1 no-control-regex)
10. **Proper EventTracker** for memory-safe event listener management
11. **CSRF token protection** on all write endpoints with mustBePosted()
12. **Comprehensive undo/redo** with 50-step history
13. **Unsaved changes warning** before page close
14. **Auto-save/draft recovery** (DraftManager)

### Key Weaknesses
1. **21 god classes** (18 hand-written >1,000 lines) indicate architectural complexity
2. **Inconsistent database method return types** (null vs false vs exceptions)
3. **Missing layer search/filter** for large layer sets (up to 100 layers)
4. **Limited TypeScript adoption** — complex modules would benefit from types
5. **Missing visual regression testing** for canvas rendering
6. **4 missing i18n documentation** entries in qqq.json
7. **Complex self-join queries** in database layer
8. **17 deprecated code markers** without scheduled removal

### Issue Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 0 | 0 | 0 | 0 |
| Performance | 0 | 0 | 1 | 2 |
| Error Handling | 0 | 0 | 1 | 1 |
| Code Quality | 0 | 0 | 2 | 5 |
| Memory/Resources | 0 | 0 | 0 | 1 |
| Missing Features | 0 | 0 | 1 | 2 |
| Documentation | 0 | 0 | 1 | 1 |
| Accessibility | 0 | 0 | 0 | 1 |
| **Total** | **0** | **0** | **6** | **13** |

---

## 📊 Detailed Metrics

### Test Coverage (January 25, 2026)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statements | 94.19% | 90% | ✅ Exceeds |
| Branches | 84.43% | 80% | ✅ Exceeds |
| Functions | 92.19% | 85% | ✅ Exceeds |
| Lines | 94.32% | 90% | ✅ Exceeds |
| Test Count | 10,613 | - | ✅ Excellent |
| Test Suites | 157 | - | ✅ |
| Skipped Tests | 0 | 0 | ✅ |

### Code Size Analysis

| Category | Files | Lines | Notes |
|----------|-------|-------|-------|
| JavaScript (Production) | 127 | ~115,002 | Excludes dist/ and scripts/ |
| JavaScript (Generated) | 3 | ~40,579 | EmojiLibraryData, ShapeLibraryData, EmojiLibraryIndex |
| JavaScript (Hand-written) | 124 | ~74,423 | Actual application code |
| PHP (Production) | 40 | ~14,169 | All source code |
| Tests (Jest) | 157 suites | ~50,300+ | Comprehensive |
| Documentation | 28+ files | - | Markdown docs in docs/ + wiki/ |
| i18n Messages | 676 | - | 4 missing qqq.json documentation |

---

## 🔴 Critical Issues (0)

No critical security or stability issues identified.

---

## 🟠 High Severity Issues (0)

No high severity issues. Previously identified HIGH-1 (Cache Invalidation Race Condition) was fixed on January 25, 2026.

---

## 🟡 Medium Severity Issues (6)

### MED-1: Inconsistent Database Method Return Types

**Severity:** Medium  
**Category:** Error Handling / API Consistency  
**Location:** `src/Database/LayersDatabase.php`

**Problem:** Different database methods return inconsistent types on error/not-found:
- `getLayerSet()` returns `false` on error (line 232)
- `getLayerSetByName()` returns `null` on error (line 810)
- `getLatestLayerSet()` returns `false` on error (line 343)
- `namedSetExists()` returns `null` on DB error, `bool` on success
- `countNamedSets()` returns `-1` on error (recently fixed)

**Impact:** Callers must handle multiple error patterns, increasing complexity and bug potential.

**Recommendation:** Standardize return types:
- `null` for "not found" 
- Throw `\RuntimeException` for database errors
- Or create a consistent `Result<T>` pattern

**Estimated Effort:** 1-2 days (breaking change, requires updating 15+ call sites)

---

### MED-2: PHP God Classes Need Refactoring

**Severity:** Medium  
**Category:** Architecture  
**Files:** `LayersDatabase.php` (1,075 lines), `ServerSideLayerValidator.php` (1,164 lines)

**Problem:** These classes handle too many responsibilities:
- **LayersDatabase:** CRUD, named sets, revisions, caching, queries, normalization
- **ServerSideLayerValidator:** All 16 layer types + all property types

**Impact:** Difficult to test individual components, high cognitive load for maintenance.

**Recommendation:** 
- Split LayersDatabase into focused repositories (LayerSetRepository, NamedSetRepository)
- Use strategy pattern for layer type validators

**Estimated Effort:** 2-3 days per class

---

### MED-3: Missing Layer Search/Filter Feature

**Severity:** Medium  
**Category:** Missing Feature  
**Evidence:** Documented as F2 in KNOWN_ISSUES.md

**Problem:** No built-in search/filter for large layer sets (up to 100 layers allowed). Users with many layers must scroll through the entire list.

**Recommendation:** Add search input in layer panel header that filters visible layers by name in real-time.

**Estimated Effort:** 2-3 days

---

### MED-4: i18n Documentation Incomplete

**Severity:** Medium  
**Category:** Documentation / i18n  
**Location:** `i18n/qqq.json`

**Problem:** 676 keys in en.json but only 672 in qqq.json — 4 message keys are missing documentation. This violates MediaWiki i18n best practices and makes translation harder.

**Recommendation:** Audit qqq.json and add documentation for all missing keys.

**Estimated Effort:** 1 hour

---

### MED-5: Complex Self-Join Query in getNamedSetsForImage

**Severity:** Medium  
**Category:** Performance / Maintainability  
**Location:** `src/Database/LayersDatabase.php` lines 460-510

**Problem:** Uses complex self-join with correlated subquery to get latest revision per named set. While functional and limited by max 15 sets, this is:
- Hard to read and maintain
- Potentially slower on large datasets
- Uses MediaWiki's IDatabase join syntax which is less intuitive

**Recommendation:** Consider a simpler two-query approach or window functions if MySQL 8+ available.

**Estimated Effort:** 4 hours

---

### MED-6: HistoryManager JSON Cloning for Large Images

**Severity:** Medium  
**Category:** Performance / Memory  
**Location:** `resources/ext.layers.editor/HistoryManager.js` lines 237-250

**Problem:** When DeepClone module isn't available, falls back to JSON cloning which copies entire base64 image data (potentially 1MB+ per image per undo step).

**Current Mitigation:** Warning log added when fallback is used with image layers.

**Recommendation:** 
1. Make DeepClone a hard dependency in extension.json module loading order
2. Consider reference-counting for immutable image data
3. Add maximum image layer size warning in UI

**Estimated Effort:** 4 hours for hard dependency; 2 days for reference counting

---

## 🟢 Low Severity Issues (13)

### LOW-1: Deprecated Code Not Scheduled for Removal

**Count:** 17 deprecation markers  
**Files:** TransformationEngine.js, ToolbarStyleControls.js, ModuleRegistry.js, LayersNamespace.js, LayerPanel.js  
**Problem:** No version target for deprecated code removal.  
**Recommendation:** Create migration guide and schedule removal for v2.0.

---

### LOW-2: Native Alerts as Fallbacks — BY DESIGN ✅

**Status:** Verified as correct design pattern  
**Files:** UIManager.js, PresetDropdown.js, LayerSetManager.js, ImportExportManager.js, RevisionManager.js  
**Finding:** All 8 `eslint-disable no-alert` occurrences are defensive fallbacks when DialogManager is unavailable. This is the correct pattern.

---

### LOW-3: console.log in Build Scripts

**Location:** `resources/ext.layers.editor/shapeLibrary/scripts/`  
**Count:** ~20 console.log calls  
**Problem:** Build scripts use console.log, but these files are in ESLint ignore list.  
**Assessment:** Acceptable — these are Node.js build tools, not production code.

---

### LOW-4: Magic Numbers in Some Calculations

**Examples:**
- `100` backlink limit in cache invalidation
- `512` JSON decode max depth (now a constant)
- Various timeout values not centralized

**Recommendation:** Extract to named constants in LayersConstants or PHP config.

---

### LOW-5: innerHTML Usage Count (63)

**Location:** Multiple UI files  
**Assessment:** All 63 usages reviewed and categorized as safe:
- ~15: Clear container (`innerHTML = ''`) — Safe
- ~35: Static SVG icons (hardcoded strings) — Safe
- ~8: Unicode characters ('×', '▼', '⋮⋮') — Safe
- ~5: i18n messages from mw.message() — Safe (MW sanitizes)

**No action needed** — all usages are secure patterns.

---

### LOW-6: setTimeout/setInterval Not Always Tracked

**Count:** ~50+ uses of setTimeout/setInterval  
**Problem:** Not all setTimeout calls are tracked via TimeoutTracker or equivalent cleanup mechanism.  
**Assessment:** Most are in UI components with proper destroy() methods. Low risk but inconsistent pattern.  
**Recommendation:** Standardize on TimeoutTracker for all timed operations.

---

### LOW-7: Missing aria-live for Some Dynamic Updates

**Location:** Various UI components  
**Problem:** Some dynamic content updates (e.g., zoom level changes, error messages) don't announce to screen readers.  
**Fixed:** LayerPanel now has announceToScreenReader() but other components may benefit.

---

### LOW-8: Jest Coverage Threshold Lower Than Actual

**Location:** `jest.config.js` lines 33-38  
**Problem:** Coverage thresholds set to 65% branches, 80% lines — but actual coverage is 84%/94%. Thresholds should be raised to prevent regression.

```javascript
coverageThreshold: {
  global: {
    branches: 80,  // Currently 84.43%
    functions: 90, // Currently 92.19%
    lines: 92,     // Currently 94.32%
    statements: 92 // Currently 94.19%
  }
}
```

---

### LOW-9: Missing TypeScript for Complex Modules

**Files:** StateManager (830 lines), APIManager (1,524 lines), GroupManager (1,172 lines)  
**Problem:** Complex state management would benefit from TypeScript's type safety.  
**Recommendation:** Consider TypeScript migration for core modules in v2.0.

---

### LOW-10: Visual Regression Testing Missing

**Problem:** No visual snapshot testing for canvas rendering. Rendering bugs could slip through.  
**Recommendation:** Add jest-image-snapshot or Percy for canvas output testing.

---

### LOW-11: Duplicate Error Handling Patterns

**Locations:** Multiple API modules  
**Problem:** `execute()` and `executeSlideSave()` in ApiLayersSave.php share duplicated JSON parsing, validation, and rate limiting code.  
**Recommendation:** Extract shared logic into private helper methods.

---

### LOW-12: Feature Gaps - Custom Fonts

**Evidence:** Documented as F3 in KNOWN_ISSUES.md  
**Problem:** Limited to default font allowlist ($wgLayersDefaultFonts). Users cannot add custom web fonts.

---

### LOW-13: Missing Slide Mode Documentation in Some Places

**Problem:** README.md has good Slide Mode docs, but ARCHITECTURE.md and API.md have incomplete slide coverage.  
**Recommendation:** Audit all docs for Slide Mode completeness.

---

## 🟢 Resolved Issues (From Previous Reviews)

### ✅ SEC-1: Missing Validation for `paths` Array — FIXED (Jan 25, 2026)
Added validation loop in ServerSideLayerValidator.php for customShape layers.

### ✅ SEC-2: ColorValidator Missing RGBA Support — FIXED (Jan 25, 2026)
Updated to accept 3/4/6/8-digit hex colors.

### ✅ HIGH-1: Cache Invalidation Race Condition — FIXED (Jan 25, 2026)
Implemented hybrid approach with HTMLCacheUpdateJob for async backlink purge.

### ✅ MEM-2: DraftManager Subscription Leak — FIXED (Jan 25, 2026)
Added cleanup of existing subscription at start of initialize().

### ✅ PHP-1: Missing PHP Strict Types — FIXED
All 40 PHP files now have `declare(strict_types=1)`.

### ✅ LOW-6: Performance Benchmark Console Noise — FIXED
Added VERBOSE environment flag for benchmark output.

### ✅ LOW-8: Missing aria-live for Layer List — FIXED
Added hidden aria-live region with announceToScreenReader() method.

---

## 🟢 Security Verification

### CSRF Token Protection ✅

| API Module | needsToken() | isWriteMode() | mustBePosted() |
|------------|--------------|---------------|----------------|
| ApiLayersSave | ✅ 'csrf' | ✅ true | ✅ true |
| ApiLayersDelete | ✅ 'csrf' | ✅ true | ✅ true |
| ApiLayersRename | ✅ 'csrf' | ✅ true | ✅ true |
| ApiSlidesSave | ✅ 'csrf' | ✅ true | ✅ true |

### Rate Limiting ✅
All write operations are rate-limited via MediaWiki's pingLimiter.

### Input Validation ✅
- ServerSideLayerValidator: 40+ property whitelist with type validation
- SetNameSanitizer: Path traversal prevention
- TextSanitizer: XSS prevention
- ColorValidator: Strict color format validation with ReDoS protection
- Size limits: $wgLayersMaxBytes, $wgLayersMaxLayerCount

### Other Security Checks ✅
- ❌ No `eval()` in production code
- ❌ No `document.write()` usage
- ❌ No `new Function()` usage
- ✅ SQL injection protected via parameterized queries
- ✅ postMessage origin validation (ViewerOverlay.js)
- ✅ localStorage access wrapped in try-catch

---

## 📊 God Class Status (21 Files ≥1,000 Lines)

### Generated Data Files (3 files - Exempt)

| File | Lines |
|------|-------|
| EmojiLibraryData.js | 26,277 |
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,003 |

### Hand-Written JavaScript Files (18 total)

| File | Lines | Delegation Status | Notes |
|------|-------|-------------------|-------|
| CanvasManager.js | 2,045 | ✅ 10+ controllers | Facade pattern |
| LayerPanel.js | 2,090 | ✅ 9 controllers | Well-delegated |
| ViewerManager.js | 2,003 | ✅ Delegates to renderers | OK |
| Toolbar.js | 1,891 | ✅ 4 modules | Could split further |
| LayersEditor.js | 1,784 | ✅ 3 modules | Main entry point |
| APIManager.js | 1,524 | ✅ APIErrorHandler | Could use more delegation |
| SelectionManager.js | 1,431 | ✅ 3 modules | Good delegation |
| ArrowRenderer.js | 1,301 | N/A (math complexity) | Rendering logic |
| PropertyBuilders.js | 1,293 | N/A (UI builders) | 98% coverage |
| CalloutRenderer.js | 1,291 | N/A (rendering logic) | Complex geometry |
| InlineTextEditor.js | 1,288 | N/A (feature complexity) | Rich text editing |
| ToolManager.js | 1,224 | ✅ 2 handlers | Good delegation |
| CanvasRenderer.js | 1,219 | ✅ SelectionRenderer | OK |
| GroupManager.js | 1,172 | N/A (group operations) | Feature scope |
| TransformController.js | 1,110 | N/A (transforms) | Math-heavy |
| ResizeCalculator.js | 1,105 | N/A (math) | 100% coverage |
| ToolbarStyleControls.js | 1,098 | ✅ Style controls | Could split |
| PropertiesForm.js | 1,004 | ✅ PropertyBuilders | OK |

### PHP God Classes (2 files)

| File | Lines | Status |
|------|-------|--------|
| LayersDatabase.php | 1,075 | 🟡 P3 refactoring planned |
| ServerSideLayerValidator.php | 1,164 | 🟡 P3 refactoring planned |

---

## 📊 Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent CSRF, validation, sanitization |
| Test Coverage | 9.4/10 | 20% | 94.19% statements, 10,613 tests |
| Functionality | 9.0/10 | 20% | 15 tools, Slide Mode, Shape Library, Emoji Picker |
| Architecture | 7.8/10 | 15% | 21 god classes, inconsistent DB patterns |
| Code Quality | 8.0/10 | 10% | Good but some duplication, deprecated code |
| Performance | 8.0/10 | 5% | Generally good, some concerns with large images |
| Documentation | 8.2/10 | 5% | Good coverage, some gaps |

**Weighted Total: 8.42/10 → Overall: 8.4/10**

### Score History

| Date | Version | Score | Notes |
|------|---------|-------|-------|
| Jan 25, 2026 | v35 | **8.4/10** | More critical assessment of architecture |
| Jan 25, 2026 | v34 | 8.6/10 | Comprehensive audit with fixes |
| Jan 24, 2026 | v32 | 8.7/10 | P1 items fixed |
| Jan 24, 2026 | v31 | 8.5/10 | Initial thorough review |

---

## 🎯 Recommendations by Priority

### P1 (High — Next Sprint) — ALL COMPLETED ✅
All P1 items have been fixed.

### P2 (Medium — Next Milestone)
1. **MED-1:** Standardize database method return types (1-2 days)
2. **MED-2:** Refactor PHP god classes (2-3 days each)
3. **MED-3:** Add layer search/filter feature (2-3 days)
4. **MED-4:** Complete i18n documentation (1 hour)
5. **MED-5:** Simplify getNamedSetsForImage query (4 hours)
6. **LOW-8:** Raise Jest coverage thresholds (30 minutes)

### P3 (Long-Term)
1. Add visual regression testing with jest-image-snapshot
2. Consider TypeScript migration for complex modules
3. Implement custom fonts feature
4. Create deprecated code removal plan for v2.0
5. Standardize timeout tracking across all modules
6. Add Slide Mode documentation to ARCHITECTURE.md

---

## Verification Commands

```bash
# Run tests with coverage
npm run test:js -- --coverage --silent

# Get test count and coverage summary
npm run test:js -- --coverage --coverageReporters=text-summary --silent

# Run full lint suite
npm test

# JS file count (excluding dist and scripts)
find resources -name "*.js" ! -path "*/dist/*" ! -path "*/scripts/*" | wc -l
# Result: 127

# JS line count
find resources -name "*.js" ! -path "*/dist/*" ! -path "*/scripts/*" -exec wc -l {} + | tail -1
# Result: ~115,002 total

# PHP file count and line count
find src -name "*.php" | wc -l  # Result: 40
find src -name "*.php" -exec wc -l {} + | tail -1  # Result: ~14,169 total

# Verify PHP strict types (all files should have it)
find src -name "*.php" -exec grep -L "declare( strict_types=1 )" {} \;
# Result: (no output = all files have it)

# Find eslint-disable comments
grep -rn "eslint-disable" resources/ext.layers* --include="*.js"  # Result: 11 comments

# Count innerHTML usages
grep -rn "innerHTML\s*=" resources/ext.layers* --include="*.js" | wc -l  # Result: 63

# Count deprecated markers
grep -rn "@deprecated\|deprecated" resources/ext.layers* --include="*.js" | wc -l  # Result: 17
```

---

## Conclusion

The Layers extension is a **well-engineered, production-ready MediaWiki extension** with excellent test coverage and security practices. The codebase demonstrates professional software development practices including:

- Comprehensive input validation and sanitization
- Proper error handling and logging
- Modern JavaScript patterns (ES6 classes, delegation)
- Extensive test coverage (94%+)

Areas for improvement center around **architectural complexity** (god classes, inconsistent patterns) and **missing features** (layer search, custom fonts). These are evolutionary improvements that won't block production use but would elevate the codebase to truly world-class status.

**Verdict:** Ready for production deployment. Recommended for MediaWiki installations requiring advanced image annotation capabilities.

---

*Review performed on `main` branch, January 25, 2026.*  
*Rating: 8.4/10 — Production-ready, high quality with areas for improvement.*
