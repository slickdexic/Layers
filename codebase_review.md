# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 26, 2026 (Comprehensive Critical Audit v40)  
**Version:** 1.5.35  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 10,643 tests in 157 suites (all passing, verified January 26, 2026)
- **Coverage:** 93.52% statements, 84.24% branches (verified January 26, 2026)
- **JS files:** 127 (excludes `resources/dist/` and `resources/*/scripts/`)
- **JS lines:** ~115,282 total (~40,579 generated, ~74,703 hand-written)
- **PHP files:** 40 (all with `declare(strict_types=1)`)
- **PHP lines:** ~14,388 total
- **i18n messages:** 697 keys in en.json (all documented in qqq.json, verified via Banana checker)

---

## Executive Summary

The Layers extension is a **mature, feature-rich MediaWiki extension** with **excellent security practices** and **outstanding test coverage**. This is a production-ready extension suitable for deployment.

**Overall Assessment:** **8.5/10** — Production-ready, high quality. Critical and high issues resolved.

### Key Strengths
1. **Excellent test coverage** (93.52% statement, 84.24% branch, 10,658 tests)
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
15. **Request abort handling** to prevent race conditions on rapid operations
16. **Proper async/await and Promise error handling** throughout

### Key Weaknesses
1. **21 god classes** (19 JS + 2 PHP files >1,000 lines) indicate architectural complexity
2. **Inconsistent database method return types** (null vs false vs -1 for errors)
3. **Unhandled Promise rejections** in some `.then()` chains without `.catch()`
4. **Limited TypeScript adoption** — complex modules would benefit from types
5. **Missing visual regression testing** for canvas rendering
6. **5 deprecated code markers** without scheduled removal dates
7. **Inconsistent event listener cleanup** in some UI components
8. **No custom font support** beyond configured allowlist

### Issue Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Async/Error Handling | 0 | 0 | 2 | 1 |
| Performance/Memory | 0 | 0 | 1 | 1 |
| Architecture | 0 | 0 | 2 | 2 |
| Code Quality | 0 | 0 | 1 | 3 |
| Testing | 0 | 0 | 1 | 1 |
| Documentation | 0 | 0 | 0 | 1 |
| **Total** | **0** ✅ | **0** ✅ | **7** | **9** |

---

## 📊 Detailed Metrics

### Test Coverage (January 26, 2026)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statements | 93.52% | 90% | ✅ Exceeds |
| Branches | 84.06% | 80% | ✅ Exceeds |
| Functions | 91.58% | 85% | ✅ Exceeds |
| Lines | 93.48% | 90% | ✅ Exceeds |
| Test Count | 10,643 | - | ✅ Excellent |
| Test Suites | 157 | - | ✅ |
| Skipped Tests | 0 | 0 | ✅ |

### Code Size Analysis

| Category | Files | Lines | Notes |
|----------|-------|-------|-------|
| JavaScript (Production) | 127 | ~115,282 | Excludes dist/ and scripts/ |
| JavaScript (Generated) | 3 | ~40,579 | EmojiLibraryData, ShapeLibraryData, EmojiLibraryIndex |
| JavaScript (Hand-written) | 124 | ~74,703 | Actual application code |
| PHP (Production) | 40 | ~14,388 | All source code |
| Tests (Jest) | 157 suites | ~50,300+ | Comprehensive |
| Documentation | 28+ files | - | Markdown docs in docs/ + wiki/ |
| i18n Messages | 697 | - | All documented in qqq.json |

---

## 🔴 Critical Issues (0) — ✅ ALL RESOLVED

No critical issues identified.

---

## 🟠 High Severity Issues (0) — ✅ ALL RESOLVED

No high-severity issues identified.

---

## 🟡 Medium Severity Issues (6)

### MED-1: ~~Unhandled Promise Rejections in .then() Chains~~ ✅ RESOLVED

**Severity:** Medium (RESOLVED)  
**Category:** Error Handling / Reliability  
**Resolution Date:** January 26, 2026

**Status:** Upon verification, most files identified in the initial review already had proper `.catch()` handlers:
- SetSelectorController.js - Lines 427, 499, 583 all have `.catch()` handlers ✓
- Toolbar.js - Lines 793, 864 have `.catch()` handlers ✓
- SlidePropertiesPanel.js - Line 656 has `.catch()` handler ✓

**One actual issue found and fixed:**
- SpecialSlides.js - Line 274: `OO.ui.confirm().then()` - Added `.catch()` handler ✅

---

### MED-2: ~~Async Functions Without Try-Catch~~ ✅ ALREADY HANDLED

**Severity:** Medium (FALSE POSITIVE)  
**Category:** Error Handling

**Status:** Upon verification, these async functions already have proper error handling:
- LayerSetManager.js - `loadLayerSetByName()` and `createNewLayerSet()` have try-catch ✓
- RevisionManager.js - `loadLayerSetByName()` and `createNewLayerSet()` have try-catch ✓
- DraftManager.js - `checkAndRecoverDraft()` - Uses only sync operations and safe dialog wrappers ✓
- UIManager.js dialog methods - Thin wrappers with native fallbacks, no error risk ✓

---

### MED-3: Inconsistent Database Method Return Types

**Severity:** Medium  
**Category:** Error Handling / API Consistency  
**Location:** `src/Database/LayersDatabase.php`

**Problem:** Different database methods return inconsistent types on error/not-found:

| Method | Returns on Not Found | Returns on Error |
|--------|---------------------|------------------|
| `getLayerSet()` | `false` | `false` |
| `getLayerSetByName()` | `null` | `null` |
| `getLatestLayerSet()` | `false` | `false` |
| `namedSetExists()` | `false` | `null` |
| `countNamedSets()` | N/A | `-1` |
| `countSetRevisions()` | N/A | `-1` |
| `saveLayerSet()` | N/A | `null` |
| `deleteNamedSet()` | N/A | `null` |

**Impact:** Callers must handle multiple error patterns, increasing complexity and bug potential.

**Recommendation:** Standardize return types:
- `null` for "not found" 
- Throw `\RuntimeException` for database errors
- Or create a consistent `Result<T>` pattern

**Estimated Effort:** 1-2 days (breaking change, requires updating 15+ call sites)

---

### MED-4: HistoryManager JSON Cloning for Large Images

**Severity:** Medium  
**Category:** Performance / Memory  
**Location:** `resources/ext.layers.editor/HistoryManager.js` lines 237-250

**Problem:** When DeepClone module fails to use structuredClone, falls back to JSON cloning which copies entire base64 image data (potentially 1MB+ per image per undo step).

**Current Mitigation:** Warning log added when fallback is used with image layers.

**Recommendation:** 
1. Make DeepClone a hard dependency in extension.json module loading order
2. Consider reference-counting for immutable image data
3. Add maximum image layer size warning in UI

**Estimated Effort:** 4 hours for hard dependency; 2 days for reference counting

---

### MED-5: JavaScript God Classes (18 hand-written)

**Severity:** Medium  
**Category:** Architecture  
**Files:** Multiple (see God Class Status section)

**Problem:** 18 hand-written JavaScript files exceed 1,000 lines. While many use proper delegation patterns, this indicates accumulated complexity.

**Accurate Line Counts (January 26, 2026):**

| File | Actual Lines | Notes |
|------|-------------|-------|
| LayerPanel.js | 2,166 | Well-delegated to 9 controllers |
| CanvasManager.js | 2,044 | Facade with 10+ controllers |
| ViewerManager.js | 2,014 | Could extract SlideRenderer |
| Toolbar.js | 1,891 | Could split by category |
| LayersEditor.js | 1,795 | Main entry point |
| APIManager.js | 1,523 | Could extract retry logic |
| SelectionManager.js | 1,431 | Good delegation |
| ArrowRenderer.js | 1,301 | Math-heavy (acceptable) |
| PropertyBuilders.js | 1,293 | UI builders (acceptable) |
| CalloutRenderer.js | 1,291 | Complex geometry (acceptable) |
| InlineTextEditor.js | 1,288 | Rich text complexity |
| ToolManager.js | 1,224 | Good delegation |
| CanvasRenderer.js | 1,219 | Delegates to SelectionRenderer |
| GroupManager.js | 1,171 | Feature scope |
| TransformController.js | 1,110 | Math-heavy |
| ResizeCalculator.js | 1,105 | 100% coverage |
| ToolbarStyleControls.js | 1,098 | Could split |
| PropertiesForm.js | 1,004 | Delegates to PropertyBuilders |

**Impact:** Increased cognitive load, harder to reason about behavior, longer test files.

**Recommendation:** See docs/GOD_CLASS_REFACTORING_PLAN.md for phased approach.

**Estimated Effort:** 2-3 days per major class

---

### MED-6: PHP God Classes Need Refactoring

**Severity:** Medium  
**Category:** Architecture  
**Files:** `LayersDatabase.php` (1,242 lines), `ServerSideLayerValidator.php` (1,163 lines)

**Problem:** These classes handle too many responsibilities:
- **LayersDatabase:** CRUD, named sets, revisions, caching, queries, normalization
- **ServerSideLayerValidator:** All 16 layer types + all property types

**Impact:** Difficult to test individual components, high cognitive load for maintenance.

**Recommendation:** 
- Split LayersDatabase into focused repositories (LayerSetRepository, NamedSetRepository)
- Use strategy pattern for layer type validators

**Estimated Effort:** 2-3 days per class

---

### MED-7: Missing E2E Tests for Shape Library

**Severity:** Medium  
**Category:** Testing  
**Location:** `resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js`

**Problem:** The ShapeLibraryPanel has limited unit test coverage due to tight OOUI integration. E2E tests exist but additional scenarios needed.

**Impact:** UI regressions in shape library could go undetected. Feature has 1,310 shapes across 10 categories.

**Recommended Additional Tests:**
- Keyboard navigation through shape grid
- Multiple shape insertions in sequence
- Shape library state persistence
- Error handling for failed SVG loads

**Estimated Effort:** 2-3 days for additional E2E tests

---

## 🟢 Low Severity Issues (9)

### LOW-1: ~~Deprecated Code Without Removal Schedule~~ ✅ RESOLVED

**Status:** Resolved January 26, 2026  
**Count:** 5 deprecation markers  
**Files:** ToolbarStyleControls.js, ModuleRegistry.js (2), LayerPanel.js, TransformationEngine.js  
**Resolution:** Added `@deprecated since X.X.X - ... Will be removed in v2.0.` to all markers.

---

### LOW-2: Native Alerts as Fallbacks — BY DESIGN ✅

**Status:** Verified as correct design pattern  
**Files:** UIManager.js, PresetDropdown.js, LayerSetManager.js, ImportExportManager.js, RevisionManager.js  
**Finding:** All 8 `eslint-disable no-alert` occurrences are defensive fallbacks when DialogManager is unavailable. This is the correct pattern.

---

### LOW-3: Event Listener Cleanup Inconsistency

**Location:** PropertiesForm.js, SlidePropertiesPanel.js  
**Problem:** Event listeners added to dynamically created form elements aren't tracked for explicit cleanup.  
**Mitigation:** Forms are recreated on layer selection (old elements garbage collected with listeners).  
**Recommendation:** Use EventTracker pattern consistently for new code.

---

### LOW-4: Magic Numbers in Some Calculations

**Examples:**
- `100` backlink limit in cache invalidation (ApiLayersSave.php)
- Various timeout values not centralized (100ms, 200ms, 1000ms)
- Canvas padding values (20, 50, etc.)

**Recommendation:** Extract to named constants in LayersConstants.js or PHP config.

---

### LOW-5: innerHTML Usage Count (57)

**Location:** Multiple UI files  
**Assessment:** All 57 usages reviewed and categorized as safe:
- ~12: Clear container (`innerHTML = ''`) — Safe
- ~25: Static SVG icons (hardcoded strings) — Safe
- ~8: Unicode characters ('×', '▼', '⋮⋮') — Safe
- ~7: i18n messages from mw.message() — Safe (MW sanitizes)
- ~5: Other static UI elements — Safe

**No action needed** — all usages are secure patterns.

---

### LOW-6: setTimeout/setInterval Tracking Inconsistent

**Count:** ~58 uses of setTimeout/setInterval  
**Assessment:** Audit shows most are properly handled:
- 15 tracked via instance properties with cleanup
- 20 short-lived `setTimeout(..., 0)` for UI sync (safe)
- 8 self-limiting retry chains (bounded)
- 10 module-level with proper cleanup
- 5 fire-and-forget (short operations)

**Low risk** but inconsistent pattern. TimeoutTracker utility is available for new code.

---

### LOW-7: Missing aria-live for Some Dynamic Updates

**Location:** Various UI components  
**Problem:** Some dynamic content updates (e.g., error messages) don't announce to screen readers.  
**Status:** LayerPanel now has announceToScreenReader() but other components may benefit.

---

### LOW-8: Missing TypeScript for Complex Modules

**Files:** StateManager (829 lines), APIManager (1,523 lines), GroupManager (1,171 lines)  
**Problem:** Complex state management would benefit from TypeScript's type safety.  
**Recommendation:** Consider TypeScript migration for core modules in v2.0.

---

### LOW-9: Visual Regression Testing Missing

**Problem:** No visual snapshot testing for canvas rendering. Rendering bugs could slip through.  
**Recommendation:** Add jest-image-snapshot or Percy for canvas output testing.

---

## 🟢 Resolved Issues (From Previous Reviews)

### ✅ BUG-1: Slide `canvas=WxH` Parameter Ignored for New Slides — FIXED (Jan 25, 2026)
### ✅ BUG-2: Slide `layerset=` Parameter Ignored — FIXED (Jan 25, 2026)
### ✅ CRIT-1: Version Number Inconsistencies — FIXED (Jan 26, 2026)
### ✅ HIGH-1: Documentation Metrics Stale — FIXED (Jan 26, 2026)

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

### Hand-Written JavaScript Files (18 files)

| File | Lines | Delegation Status | Notes |
|------|-------|-------------------|-------|
| LayerPanel.js | 2,166 | ✅ 9 controllers | Well-delegated |
| CanvasManager.js | 2,044 | ✅ 10+ controllers | Facade pattern |
| ViewerManager.js | 2,014 | ⚠️ Could improve | Extract renderers |
| Toolbar.js | 1,891 | ✅ 4 modules | Could split further |
| LayersEditor.js | 1,795 | ✅ 3 modules | Main entry point |
| APIManager.js | 1,523 | ⚠️ Could improve | Extract retry logic |
| SelectionManager.js | 1,431 | ✅ 3 modules | Good delegation |
| ArrowRenderer.js | 1,301 | N/A (math complexity) | Rendering logic |
| PropertyBuilders.js | 1,293 | N/A (UI builders) | 98% coverage |
| CalloutRenderer.js | 1,291 | N/A (rendering logic) | Complex geometry |
| InlineTextEditor.js | 1,288 | N/A (feature complexity) | Rich text editing |
| ToolManager.js | 1,224 | ✅ 2 handlers | Good delegation |
| CanvasRenderer.js | 1,219 | ✅ SelectionRenderer | OK |
| GroupManager.js | 1,171 | N/A (group operations) | Feature scope |
| TransformController.js | 1,110 | N/A (transforms) | Math-heavy |
| ResizeCalculator.js | 1,105 | N/A (math) | 100% coverage |
| ToolbarStyleControls.js | 1,098 | ✅ Style controls | Could split |
| PropertiesForm.js | 1,004 | ✅ PropertyBuilders | OK |

### PHP God Classes (2 files)

| File | Lines | Status |
|------|-------|--------|
| LayersDatabase.php | 1,242 | 🟡 P2 refactoring planned |
| ServerSideLayerValidator.php | 1,163 | 🟡 P2 refactoring planned |

---

## 📊 Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent CSRF, validation, sanitization |
| Test Coverage | 9.4/10 | 20% | 93.52% statements, 10,658 tests |
| Functionality | 9.2/10 | 20% | 15 tools, Slide Mode, Shape Library, Emoji Picker |
| Architecture | 7.3/10 | 15% | 21 god classes, unhandled promises |
| Code Quality | 8.2/10 | 10% | Good patterns, some error handling gaps |
| Performance | 8.3/10 | 5% | Query optimization done, large images mitigated |
| Documentation | 8.5/10 | 5% | All metrics updated, version script added |

**Weighted Total: 8.69/10 → Overall: 8.5/10**

### Score History

| Date | Version | Score | Notes |
|------|---------|-------|-------|
| Jan 26, 2026 | v40 | **8.5/10** | Thorough v40 audit, found promise handling issues |
| Jan 26, 2026 | v39 | 8.6/10 | Thorough v39 audit, updated metrics |
| Jan 26, 2026 | v38.1 | 8.6/10 | Fixed version inconsistencies, updated docs |
| Jan 25, 2026 | v37 | 8.5/10 | Thorough critical review |

---

## 🎯 Recommendations by Priority

### P0 (Immediate) — ✅ ALL COMPLETED
All critical issues resolved.

### P1 (High) — ✅ ALL COMPLETED
All high-priority issues resolved.

### P2 (Medium — Next Milestone)
1. **MED-1:** Add .catch() to all Promise chains (4-6 hours)
2. **MED-2:** Wrap async functions in try-catch (2-4 hours)
3. **MED-3:** Standardize database method return types (1-2 days)
4. **MED-4:** Make DeepClone a hard dependency (4 hours)
5. **MED-5/6:** God class refactoring per plan (2-3 days each)
6. **MED-7:** Add more E2E tests for ShapeLibraryPanel (2-3 days)

### P3 (Long-Term)
1. Add visual regression testing with jest-image-snapshot
2. Consider TypeScript migration for complex modules
3. Implement custom fonts feature (F3)
4. Create deprecated code removal plan for v2.0
5. Standardize timeout tracking across all modules

---

## Honest Assessment: What Keeps This From Being "World-Class"

### Current Status: **Production-Ready with Areas for Improvement (8.5/10)**

The extension is production-ready and professionally built. Remaining areas for improvement:

1. **Architectural Complexity:** 21 god classes (18 JS + 2 PHP) is higher than ideal. While most use delegation patterns, the sheer number indicates the codebase has grown organically.

2. **Promise Error Handling:** Multiple `.then()` chains lack `.catch()` handlers, and some async functions lack try-catch wrappers. This is a reliability concern.

3. **Inconsistent Error Handling:** The PHP database layer uses mixed return types (null, false, -1, exceptions) for errors. This is a maintenance burden and potential bug source.

4. **Missing Visual Testing:** For a canvas-based drawing application, the lack of visual regression testing is a gap.

5. **Technical Debt:** 5 deprecated APIs without removal schedule.

### What Would Make It World-Class (9.0+/10)

1. Add proper error handling to all Promise chains
2. Reduce hand-written god classes from 18 to ≤12
3. Standardize all database methods to consistent error handling
4. Add visual regression testing for canvas rendering
5. Achieve >90% coverage on ShapeLibraryPanel via E2E tests
6. Migrate core state management modules to TypeScript
7. Remove all deprecated code with migration guides

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
wc -l resources/ext.layers*/*.js resources/ext.layers*/*/*.js | tail -1
# Result: 115282 total

# PHP file count and line count
find src -name "*.php" | wc -l  # Result: 40
wc -l src/*.php src/*/*.php | tail -1  # Result: ~14,388 total

# Verify PHP strict types (all files should have it)
find src -name "*.php" -exec grep -L "declare( strict_types=1 )" {} \;
# Result: (no output = all files have it)

# Find eslint-disable comments (production code only)
grep -rn "eslint-disable" resources/ext.layers* --include="*.js" | wc -l  # Result: 11

# Count innerHTML usages
grep -rn "innerHTML\s*=" resources/ext.layers* --include="*.js" | wc -l  # Result: 57

# Count deprecated markers
grep -rn "@deprecated" resources/ext.layers* --include="*.js" | wc -l  # Result: 5

# Count god classes (>= 1000 lines)
wc -l resources/ext.layers*/*.js resources/ext.layers*/*/*.js | awk '$1 >= 1000 {count++} END {print count}'
# Result: 21 (3 generated + 18 hand-written)

# Count PHP god classes
wc -l src/*.php src/*/*.php | awk '$1 >= 1000 {count++} END {print count}'
# Result: 2
```

---

## Conclusion

The Layers extension is a **well-engineered, production-ready MediaWiki extension** with excellent test coverage (93.52%) and security practices.

The codebase demonstrates professional software development practices including:

- Comprehensive input validation and sanitization
- Proper error handling and logging
- Modern JavaScript patterns (ES6 classes, delegation)
- Extensive test coverage (10,643 tests, 93%+ statement coverage)
- Complete i18n with 697 message keys
- **Automated version consistency** with CI enforcement
- **No dangerous code patterns** (eval, document.write, new Function)

**New Issues Identified (v40):**
- Unhandled Promise rejections in several `.then()` chains
- Some async functions missing try-catch wrappers
- These are medium-priority reliability concerns, not security issues

All **critical and high-priority issues have been resolved**.

Areas for **medium-term improvement**:
- Promise error handling (add .catch() handlers)
- Architectural complexity (21 god classes)
- Testing gaps (ShapeLibraryPanel limited unit coverage, no visual regression tests)
- Technical debt (inconsistent DB error handling, deprecated code)

**Verdict:** Production-ready and recommended for deployment. The core functionality is solid, well-tested, and secure. Recommended for MediaWiki installations requiring advanced image annotation capabilities.

---

*Review performed on `main` branch, January 26, 2026.*  
*Rating: 8.5/10 — Production-ready, high quality.*
