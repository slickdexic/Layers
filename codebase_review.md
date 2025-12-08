# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 7, 2025  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. After reviewing the current state of the codebase, I find a project with **significant architectural debt** partially addressed, but with **critical issues remaining** that impede maintainability and modernization.

### Overall Assessment: 5.5/10

The score reflects:
- ✅ Excellent backend security (PHP)
- ✅ Strong unit test coverage (2,647 tests)
- ✅ Some architectural improvements completed
- ❌ Persistent god class problem (9 files over 800 lines)
- ❌ Massive global namespace pollution (69 window.X exports)
- ❌ Pervasive legacy prototype patterns (804 occurrences)
- ❌ Excessive bundle size (~921KB unminified)
- ❌ Minimal E2E test coverage (3 test files, MediaWiki instance required)

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## Assessment Scores

| Category | Score | Trend | Notes |
|----------|-------|-------|-------|
| **Architecture** | 4/10 | 🟡 Stalled | CanvasManager still 1,980 lines with 111 methods |
| **Code Quality** | 5/10 | 🟡 Mixed | ES6 class adoption at 0.6% (5 of 804 prototypes) |
| **Security** | 8/10 | 🟢 Excellent | Strong server-side validation, CSRF, rate limiting |
| **Performance** | 4/10 | 🔴 Poor | 921KB bundle, no lazy loading, no code splitting |
| **Accessibility** | 5/10 | 🟢 Improved | ARIA live regions added, keyboard nav implemented |
| **Documentation** | 7/10 | 🟢 Good | Architecture docs present, copilot-instructions comprehensive |
| **Testing** | 6/10 | 🟡 Skewed | 2,647 unit tests, but only 3 E2E test files |
| **Maintainability** | 4/10 | 🔴 Critical | God classes block development velocity |

---

## Verified Current Metrics (December 7, 2025)

### JavaScript Codebase

| Metric | Verified Value | Target | Gap |
|--------|----------------|--------|-----|
| Total JS files | 54 | - | - |
| Total JS lines | 29,554 | - | - |
| Total JS bytes | 921KB | <400KB | **521KB over** |
| Files > 1,000 lines | 9 | 0 | 9 god classes |
| Files > 800 lines | 9 | 0 | Same 9 files |
| Global `window.X =` exports | 69 | 0 | Namespace pollution |
| `.prototype.` assignments | 804 | 0 | Legacy pattern |
| ES6 `class` declarations | 5 | 804+ | **0.6% adoption** |
| `const self = this` anti-pattern | 62 | 0 | Arrow functions needed |

### God Classes (Files > 800 Lines) - Verified

| File | Lines | Status |
|------|-------|--------|
| CanvasManager.js | 1,980 | 🔴 CRITICAL - 111 prototype methods |
| LayerRenderer.js (shared) | 1,829 | 🟠 Acceptable - shared rendering engine |
| LayerPanel.js | 1,258 | 🔴 Needs decomposition |
| TransformController.js | 1,225 | 🟠 Recently extracted controller |
| LayersEditor.js | 1,212 | 🟠 Partially split |
| SelectionManager.js | 1,026 | 🔴 Needs decomposition |
| ToolManager.js | 1,021 | 🔴 Needs decomposition |
| LayersValidator.js | 951 | 🟠 Complex but single-purpose |
| APIManager.js | 909 | 🟠 Could be smaller |

### Test Coverage - Verified

| Metric | Value | Assessment |
|--------|-------|------------|
| Jest unit tests | 2,647 passing | 🟢 Excellent |
| Jest test files | 66 | 🟢 Good |
| E2E test files | 3 | 🔴 Minimal |
| E2E requires | MediaWiki server | 🔴 Not CI-ready |
| PHP unit tests | Minimal | 🔴 Gap |

---

## CRITICAL Issues

### 1. God Class Problem Is Unsolved 🔴

**Severity: BLOCKER**

CanvasManager remains a monolithic class at **1,980 lines with 111 prototype methods**. While 8 controllers were extracted, CanvasManager still:

- Handles 15+ concerns (zoom, pan, selection, clipboard, grid, rulers, transforms...)
- Acts as a tightly-coupled hub with circular dependencies
- Contains 111 methods - far exceeding the ~20 method guideline for maintainability
- Makes testing and modification extremely difficult

```
Verified: grep -c "\.prototype\." CanvasManager.js = 111 methods
```

**Impact:** Every bug fix or feature addition carries regression risk. New developers cannot understand this file without days of study.

---

### 2. Global Namespace Pollution Is Severe 🔴

**Severity: BLOCKER for modernization**

The codebase has **69 instances of `window.X =` exports**, polluting the global namespace:

```javascript
// This pattern appears 69 times:
window.CanvasManager = CanvasManager;
window.LayersEditor = LayersEditor;
// etc.
```

**Why this is critical:**
- **Blocks ES modules:** Cannot use `import`/`export` until resolved
- **Blocks TypeScript:** Cannot type global namespace pollution
- **Blocks tree-shaking:** All 921KB loads regardless of what's used
- **Causes namespace collisions:** Other extensions will conflict
- **Makes testing brittle:** Every test needs global mocks

The `LayersNamespace.js` file creates a `window.Layers` namespace but **does not eliminate the individual exports**. Both patterns coexist, providing no real consolidation benefit.

---

### 3. Legacy Prototype Pattern Is Pervasive 🔴

**Severity: HIGH - Development velocity killer**

The codebase has **804 prototype assignments** but only **5 ES6 class declarations**. This is a 0.6% ES6 adoption rate.

```javascript
// Current pattern (804 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (5 occurrences):
class GeometryUtils {
    static normalize() { ... }
}
```

**Related anti-patterns:**
- 62 uses of `const self = this` (instead of arrow functions)
- Inconsistent constructor patterns
- No private fields (everything is `this.x`)

**Impact:**
- IDE navigation/autocomplete degraded
- New developers confused by mixed patterns
- Refactoring is error-prone
- Cannot use modern JS features

---

### 4. Bundle Size Is Excessive 🔴

**Severity: HIGH - User experience impact**

**921KB of unminified JavaScript** for an annotation editor is excessive. Even with 50% minification, users download 460KB+ of code.

**Problems:**
- No code splitting (viewer loads editor code)
- No lazy loading (all dialogs loaded upfront)
- MediaWiki ResourceLoader loads all scripts synchronously
- No tree-shaking possible due to global exports

---

### 5. Previous Improvement Plan Contains Inaccuracies 🟠

**Severity: MEDIUM - Trust and planning issue**

The existing `improvement_plan.md` contains claims that don't match measurable reality:

| Claim | Verified Reality |
|-------|------------------|
| "P0, P1.2, P1.3, P2 ALL COMPLETE" | Multiple items incomplete |
| "7 utility classes converted to ES6" | Only 5 `class` declarations found |
| "Bundle ~875KB" | Verified at 921KB |
| "CanvasManager acts as thin facade" | 111 methods is not "thin" |

The plan needs to be reset with honest, verifiable metrics and acceptance criteria.

---

## MEDIUM Issues

### 6. E2E Testing Is Inadequate 🟠

Only 3 E2E test files exist, requiring a running MediaWiki server. This means:
- No CI pipeline can run E2E tests automatically
- Most layer types untested end-to-end
- Critical workflows (named sets, revisions) untested

### 7. PHP Test Coverage Is Minimal 🟠

The PHP backend has strong validation code but minimal test coverage:
- `LayersDatabaseTest.php` appears empty (PHPCS found no code)
- No integration tests for API modules
- Missing @covers annotations

### 8. Inconsistent Error Handling 🟠

While `ErrorHandler.js` exists (564 lines), error handling is inconsistent:
- Some modules use ErrorHandler, others have inline try/catch
- 113 try/catch blocks scattered across codebase
- No centralized error reporting

### 9. Debug Mode ON by Default 🟠

`extension.json` has `LayersDebug: true` as default. This should be `false` for production, with explicit opt-in for development.

---

## What's Working Well

### 1. Backend Security (8/10) 🟢

The PHP backend demonstrates excellent security practices:

- **CSRF tokens** required on all write operations
- **Rate limiting** via MediaWiki's `pingLimiter`
- **Strict property whitelist** with 47+ validated fields
- **Type/range validation** on all numeric fields
- **Text sanitization** (HTML stripped, protocol checks)
- **Parameterized SQL** (no injection vulnerabilities found)
- **Defense in depth** with multiple validation layers

```php
// Example from ServerSideLayerValidator.php - strict whitelist
private const ALLOWED_PROPERTIES = [
    'type' => 'string', 'x' => 'numeric', 'y' => 'numeric',
    // 44+ more validated fields...
];
```

### 2. Unit Test Coverage (6/10) 🟢

**2,647 Jest tests** is genuinely impressive for an extension this size:
```
Test Suites: 63 passed, 63 total
Tests:       1 skipped, 2647 passed, 2648 total
```

### 3. Documentation 🟢

- `copilot-instructions.md` is comprehensive (API contracts, data model, security)
- `docs/ARCHITECTURE.md` explains module structure
- `docs/ACCESSIBILITY.md` documents WCAG efforts

### 4. No Console Leaks 🟢

All logging correctly uses `mw.log.*` instead of `console.*`.

### 5. Accessibility Progress 🟢

Recent additions:
- `AccessibilityAnnouncer.js` for ARIA live regions
- Layer panel keyboard navigation (Arrow, Home/End, Enter)
- Keyboard shortcuts help dialog (Shift+?)

### 6. EventTracker for Memory Safety 🟢

`EventTracker.js` provides proper event listener cleanup, preventing memory leaks.

---

## Recommendations by Priority

### P0 - Critical (Block Further Development Until Fixed)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | **Split CanvasManager.js** into focused modules | Make code maintainable | 1 week |
| 2 | **Eliminate duplicate window.X exports** | Enable modernization | 3 days |
| 3 | **Reset improvement_plan.md** with verified metrics | Enable accurate planning | 1 day |

### P1 - High (Next Sprint)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Split LayerPanel.js (1,258 lines) | Reduce complexity | 3 days |
| 2 | Split SelectionManager.js (1,026 lines) | Reduce complexity | 2 days |
| 3 | Pilot ES6 class conversion (5 small files) | Prove pattern | 2 days |
| 4 | Set LayersDebug default to false | Production safety | 1 hour |

### P2 - Medium (This Quarter)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Bundle size reduction to <500KB | Performance | 2 weeks |
| 2 | E2E test infrastructure (mock API) | CI readiness | 1 week |
| 3 | PHP test coverage | Backend confidence | 1 week |
| 4 | Eliminate `const self = this` pattern | Modern code | 3 days |

### P3 - Long Term

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Complete ES6 class migration | Modern patterns | 3 weeks |
| 2 | TypeScript migration | Type safety | 2+ months |
| 3 | ES modules (after globals resolved) | Tree-shaking | 1 month |

---

## Technical Debt Quantified

| Debt Type | Count | Estimated Fix Time |
|-----------|-------|-------------------|
| God classes (>800 lines) | 9 files | 3-4 weeks |
| Global window.X exports | 69 | 1 week |
| Prototype→class migrations | 804 methods | 3-4 weeks |
| `const self = this` pattern | 62 | 2 days |
| Missing E2E tests | ~80% workflows | 2 weeks |
| Missing PHP tests | Critical paths | 1 week |

**Total estimated refactoring time: 10-14 weeks**

---

## Conclusion

The Layers extension is **functional but architecturally compromised**. It works because of the extensive Jest test suite that catches regressions, but the codebase is:

1. **Unmaintainable** - 9 god classes with files up to 1,980 lines
2. **Unmodernizable** - 69 global exports block ES modules/TypeScript
3. **Legacy-bound** - 804 prototype methods vs. 5 ES6 classes (0.6%)
4. **Oversized** - 921KB bundle for an annotation tool

**The path forward requires:**
1. Honest assessment of current state (this document)
2. Reset improvement plan with verifiable acceptance criteria
3. Systematic god class decomposition starting with CanvasManager
4. Eliminate global namespace pollution before any ES module work

**Without addressing the god class and global pollution problems, every new feature will increase technical debt.**

See [`improvement_plan.md`](./improvement_plan.md) for the reset, prioritized action plan.

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 7, 2025*
