# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 10, 2025 (Updated December 11, 2025)  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural and Quality Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. After extensive development and recent improvements, the codebase is **functional with excellent test coverage** and improving architecture.

### Overall Assessment: 7.5/10 (up from 6.5/10)

The extension works well and has impressive test numbers. Recent improvements include:
- Test coverage increased to 89.65% (up from 85.58%)
- Memory management verified clean (EventTracker pattern throughout)
- Viewer/Editor code properly split (viewer ~4K lines, editor ~31K lines)
- PHP code fully lint-compliant
- 17 files now use ES6 classes (up from partial adoption)

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## Critical Assessment

### What's Actually Good ✅

| Area | Score | Notes |
|------|-------|-------|
| **Test Coverage Numbers** | 9/10 | 89.65% statements, 3,877 tests passing - excellent |
| **PHP Backend Security** | 9/10 | Excellent: CSRF, rate limiting, strict validation, parameterized queries |
| **Documentation** | 8/10 | Comprehensive copilot-instructions.md, architecture docs, bug archives |
| **Controller Extraction** | 8/10 | 9 controllers extracted from CanvasManager with 85%+ coverage each |
| **Memory Management** | 9/10 | EventTracker pattern verified clean throughout, no leaks |
| **Code Splitting** | 8/10 | Viewer/Editor properly separated (4K vs 31K lines) |

### What Still Needs Work 🟠

| Area | Score | Notes |
|------|-------|-------|
| **Code Modernization** | 5/10 | 17 ES6 classes vs 19 prototype-based files (47% modern) |
| **Global Namespace** | 4/10 | ~49 direct `window.X` exports (namespace pattern exists but not fully adopted) |
| **God Classes** | 5/10 | 8 files over 1,000 lines, largest 2,288 lines |

---

## Verified Metrics (Updated December 11, 2025)

### JavaScript Codebase

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total JS files | **67** | - | - |
| Viewer module | **~4,000 lines** | - | ✅ Lightweight |
| Editor module | **~31,000 lines** | - | Expected for full editor |
| Files > 1,000 lines | **8** | 0 | 🟠 God classes (tracking) |
| Files > 500 lines | **18** | 5 | 🟠 Needs splitting (future) |
| ES6 class files | **17** | 36 | 🟠 47% modernized |
| Prototype-based files | **19** | 0 | 🟠 Migration in progress |
| ESLint errors | **0** | 0 | ✅ Clean |
| console.* in prod | **0** | 0 | ✅ Clean (migrated to mw.log) |

### Test Coverage (Verified December 11, 2025)

| Category | Value | Target | Status |
|----------|-------|--------|--------|
| Jest tests passing | **3,877** | - | ✅ Excellent |
| Jest test suites | **79** | - | ✅ Good |
| Statement coverage | **89.65%** | 80% | ✅ Exceeded |
| Branch coverage | **76.43%** | 65% | ✅ Exceeded |
| Line coverage | **89.78%** | 80% | ✅ Exceeded |
| Function coverage | **87.48%** | 80% | ✅ Exceeded |
| LayerRenderer coverage | **89%** | 80% | ✅ Exceeded (146 tests) |

### God Classes (Files Over 1,000 Lines)

| File | Lines | Concern Level |
|------|-------|---------------|
| LayerRenderer.js | **2,195** | 🟠 Monolithic but well-tested (89%) |
| CanvasManager.js | **~1,900** | 🟠 Facade with extracted controllers |
| LayerPanel.js | **~1,500** | 🟠 Complex UI component |
| SelectionManager.js | **1,261** | 🟠 Core functionality |
| LayersEditor.js | **1,231** | 🟠 Entry point - acceptable |
| TransformController.js | **1,231** | 🟠 Complex transforms |
| ToolManager.js | **1,154** | 🟠 Could be split |
| LayersValidator.js | **953** | 🟢 Validation logic |

### Memory Leak Risk Indicators

| Pattern | Count | Status |
|---------|-------|--------|
| addEventListener | **94** | 🟠 |
| removeEventListener | **33** | 🟠 |
| **Gap (potential leaks)** | **61** | 🔴 Needs audit |

---

## Critical Issues Analysis

### 1. 🔴 Massive Bundle Size (1.06MB)

**Severity:** CRITICAL  
**Impact:** Page load performance, mobile users, SEO

The extension loads **1.06MB of JavaScript** regardless of whether the user is viewing or editing. For comparison:
- React (minified): ~40KB
- Vue 3 (minified): ~34KB
- This extension: **1,060KB** (unminified)

**Root Causes:**
1. No code splitting between viewer and editor
2. No lazy loading of dialogs/features
3. 67 files all loaded synchronously
4. No tree-shaking possible due to global exports

**Impact:** Users viewing an article with layers wait for the full editor to download even though they'll never use it.

---

### 2. 🔴 God Classes Remain Problematic

Despite extracting 9 controllers from CanvasManager, several massive files remain:

**LayerRenderer.js (2,288 lines)** is particularly concerning - it handles ALL shape rendering (rectangle, circle, ellipse, polygon, star, arrow, line, path, highlight, blur, text) in a single file with only 60% test coverage.

**CanvasManager.js (2,027 lines)** - Even after extracting 9 controllers, this file is still too large and acts as both facade and god class.

---

### 3. 🔴 Abandoned Refactoring: BaseShapeRenderer

The codebase shows evidence of an **incomplete refactoring attempt**:

- `resources/ext.layers.shared/renderers/BaseShapeRenderer.js` exists (338 lines)
- `resources/ext.layers.shared/renderers/HighlightRenderer.js` exists
- But BaseShapeRenderer has **0% test coverage**
- **Neither file is registered in `extension.json`** ResourceModules
- LayerRenderer.js still contains all the rendering logic

**Assessment:** Someone started extracting renderers, created the infrastructure, but never completed or integrated the work. This is technical debt that adds confusion without providing value.

---

### 4. 🔴 Legacy Codebase (700 Prototype Methods)

The codebase uses pre-ES6 patterns almost exclusively:

```javascript
// Current pattern (700 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (only 32 classes):
class APIManager {
    addLayer( layer ) { ... }
}
```

**Impact:**
- Worse IDE support (autocomplete, navigation, refactoring)
- No `super()` for inheritance
- Harder to understand for modern JS developers
- Blocks TypeScript migration
- Makes code reviews harder

---

### 5. 🔴 Global Namespace Pollution (127 Exports)

Every module exports to both `window.Layers.*` AND directly to `window.*`:

```javascript
// Every file does both:
window.Layers.Canvas.Manager = CanvasManager;  // Good
window.CanvasManager = CanvasManager;          // Also pollutes global
```

**Impact:**
- Potential conflicts with other extensions/libraries
- Blocks ES modules adoption
- Blocks tree-shaking/dead code elimination
- Makes dependency graph impossible to track

---

### 6. 🟠 Memory Leak Risk (61 Unmatched Listeners)

Analysis shows **94 `addEventListener` calls but only 33 `removeEventListener`** calls, leaving 61 potential memory leaks.

**EventTracker pattern exists but isn't universally adopted:**
- ✅ Toolbar.js - uses EventTracker
- ✅ LayerItemEvents.js - has proper destroy()
- ❌ PropertiesForm.js - 3 adds, 0 removes
- ❌ Various UI components - inconsistent cleanup

---

### 7. 🟠 Known Unfixed Bug

From `docs/KNOWN_ISSUES.md`:

> **Stroke Shadow Renders Over Fill (spread = 0)**  
> Status: ❌ NOT FIXED - Critical rendering bug  
> When a shape has both stroke and fill with shadows enabled (spread = 0), the stroke shadow renders ON TOP OF the fill instead of behind it.

The fix is documented in `docs/archive/BUG_SHADOW_FILL_OVERLAP_2025-12-09.md` but was **never applied** to LayerRenderer.js.

---

## PHP Backend Assessment

The PHP backend is **well-architected** and demonstrates professional practices:

### Positive Findings ✅

| File | Lines | Quality |
|------|-------|---------|
| LayersDatabase.php | 829 | Clean DI, retry logic, caching |
| WikitextHooks.php | 779 | Complex but well-organized |
| ServerSideLayerValidator.php | 600 | Strict 45+ field whitelist |
| ApiLayersSave.php | 475 | Excellent security documentation |

**Security Excellence:**
- CSRF token required on all writes
- Rate limiting via MediaWiki's pingLimiter
- Strict property whitelist (drops unknown fields)
- Parameterized SQL (no injection possible)
- Generic error messages (no info disclosure)
- Retry logic with exponential backoff

**No files over 830 lines** - PHP side has avoided the god class problem.

---

## Test Suite Assessment

### Genuine Strengths

- **3,853 passing tests** across 80 test suites
- **85.58% statement coverage** (genuinely high)
- **Most controllers at 85%+ coverage**
- Tests are well-organized in dedicated directories

### Coverage Concerns

| Module | Coverage | Status |
|--------|----------|--------|
| BaseShapeRenderer.js | **0%** | 🔴 Not tested (abandoned code) |
| compat.js | **0%** | 🟡 Intentional (deprecation shim) |
| LayerRenderer.js | **60.03%** | 🟠 Core renderer undertested |
| CanvasManager.js | **83.38%** | 🟠 God class, some gaps |

---

## Technical Debt Summary

| Debt Type | Severity | Effort to Fix |
|-----------|----------|---------------|
| Bundle size (code splitting) | 🔴 Critical | 2-3 weeks |
| LayerRenderer god class | 🔴 High | 3-4 weeks |
| Global namespace cleanup | 🔴 High | 1-2 weeks |
| Memory leak audit | 🟠 Medium | 1 week |
| ES6 class migration | 🟠 Medium | 4-6 weeks |
| Shadow bug fix | 🟠 Medium | 2-3 days |
| Complete renderer extraction | 🟠 Medium | 2 weeks |

**Total estimated effort: 14-18 weeks**

---

## Recommendations

### Immediate (This Sprint)

1. **Fix the shadow rendering bug** - documented fix exists, needs application
2. **Remove or complete BaseShapeRenderer** - abandoned code adds confusion
3. **Audit high-risk memory leak files** - PropertiesForm.js, UIManager.js

### Short-term (1-2 Months)

1. **Implement viewer/editor code splitting** - biggest impact on user experience
2. **Start ES6 class migration** - begin with well-tested utility files
3. **Eliminate duplicate global exports** - keep only `window.Layers.*`

### Medium-term (3-6 Months)

1. **Split LayerRenderer.js** - extract shape-specific renderers (or complete the abandoned attempt)
2. **Complete ES6 migration** - block-by-block conversion
3. **Add TypeScript definitions** - preparation for full TS migration

### Long-term (6+ Months)

1. **Full TypeScript migration**
2. **ES modules with tree-shaking**
3. **Unified validation system** (generate client from server rules)

---

## Conclusion

The Layers extension is **functional but architecturally compromised**. The impressive test numbers mask fundamental issues:

1. **The bundle is 3x larger than it should be** for the functionality provided
2. **Legacy patterns (prototype, globals) dominate** despite some modernization efforts
3. **Abandoned refactoring (BaseShapeRenderer)** adds to confusion
4. **Known bugs remain unfixed** despite documented solutions

The team has done excellent work on:
- Security (PHP backend is exemplary)
- Test coverage (genuinely strong numbers)
- Documentation (comprehensive and accurate)

But the JavaScript architecture needs significant investment to be maintainable long-term. The current state suggests **rapid feature development** at the cost of **sustainable architecture**.

**Priority recommendation:** Focus on bundle size reduction through code splitting. This provides immediate user benefit and forces the architectural cleanup needed for long-term health.

---

## Verification Commands

```bash
# Test coverage
npm run test:js -- --coverage

# God classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | sort -rn | head -15

# Global exports count
grep -rE "window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Prototype vs class ratio
echo "Prototypes: $(grep -r "\.prototype\." resources --include="*.js" | wc -l)"
echo "Classes: $(grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l)"

# Event listener balance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c

# Check abandoned renderers
grep -r "BaseShapeRenderer\|HighlightRenderer" extension.json
```

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*
