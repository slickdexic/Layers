# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 8, 2025  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural and Security Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. This review reveals a project with **significant technical debt** that, despite partial cleanup efforts, still suffers from fundamental architectural problems that impede maintainability, modernization, and long-term viability.

### Overall Assessment: 5/10

**Strengths:**
- ✅ Strong server-side security (PHP validation, CSRF, rate limiting)
- ✅ Comprehensive Jest test suite (2,647 tests, ~90% statement coverage)
- ✅ Good documentation (architecture docs, copilot-instructions)
- ✅ Proper logging patterns (uses `mw.log.*` instead of `console.*`)

**Critical Weaknesses:**
- ❌ **God class problem remains unsolved** - CanvasManager.js at 1,974 lines with 100+ methods
- ❌ **Massive bundle size** - ~932KB of JavaScript for an annotation tool
- ❌ **130 global `window.X` exports** - severe namespace pollution
- ❌ **646 prototype methods** vs only 4 ES6 classes (0.6% modernization)
- ❌ **Memory leak risks** - 71 `addEventListener` calls with only 29 `removeEventListener`
- ❌ **CSP security weakness** - `unsafe-eval` and `unsafe-inline` enabled
- ❌ **Missing critical tests** - LayersValidator.js (953 lines) has no dedicated test file

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## Verified Metrics (December 8, 2025)

### JavaScript Codebase

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total JS files | 54 | - | - |
| Total JS lines | 30,017 | - | - |
| Total JS bytes | **932KB** | <400KB | 🔴 **133% over target** |
| Files > 500 lines | **18** | 0 | 🔴 Critical |
| Files > 1,000 lines | **9** | 0 | 🔴 God classes |
| Global `window.X =` exports | **130** | 0 | 🔴 Namespace pollution |
| Prototype methods | **646** | 0 | 🔴 Legacy pattern |
| ES6 `class` declarations | **4** | 646+ | 🔴 **0.6% modernization** |
| `const self = this` | **0** | 0 | 🟢 Fixed |
| `console.log/error` in prod | **0** | 0 | 🟢 Clean |
| `JSON.parse(JSON.stringify())` | **21** | 0 | 🟠 Inefficient cloning |

### God Classes (Files > 1,000 Lines)

| File | Lines | Methods | Severity |
|------|-------|---------|----------|
| CanvasManager.js | **1,974** | ~100+ | 🔴 CRITICAL |
| LayerRenderer.js | **1,839** | ~60 | 🟠 Shared engine, tolerable |
| LayerPanel.js | **1,464** | ~90+ | 🔴 Needs decomposition |
| TransformController.js | **1,231** | ~40 | 🟠 Recently extracted |
| LayersEditor.js | **1,217** | ~50 | 🟠 Entry point, complex |
| ToolManager.js | **1,027** | ~40 | 🔴 Needs decomposition |
| SelectionManager.js | **1,026** | ~35 | 🔴 Needs decomposition |
| LayersValidator.js | **953** | ~30 | 🟠 Single purpose, but **NO TESTS** |
| APIManager.js | **916** | ~25 | 🟠 Could be smaller |

### Memory Leak Risk Indicators

| Pattern | Add Count | Remove Count | **Imbalance** |
|---------|-----------|--------------|---------------|
| addEventListener | 100+ | 29 | **71 potential leaks** |
| setTimeout/setInterval | 19 | 3 | **16 potential leaks** |
| requestAnimationFrame | 12 | 4 | 8 potential issues |

**Issue:** The severe imbalance in event listener management suggests memory leaks, especially in long-running editor sessions.

### PHP Codebase

| Metric | Value | Status |
|--------|-------|--------|
| Total PHP files | 29 | - |
| Total PHP lines | 8,450 | - |
| try/catch blocks | 54/56 | 🟢 Good error handling |
| `JSON_THROW_ON_ERROR` usage | 4 of 10 `json_decode` calls | 🟠 Inconsistent |
| Direct SQL injection risk | 0 | 🟢 Uses MediaWiki DB abstraction |

### Test Coverage

| Category | Value | Status |
|----------|-------|--------|
| Jest tests passing | 2,647 | 🟢 Excellent |
| Statement coverage | 89.66% | 🟢 Good |
| Branch coverage | **75.06%** | 🟠 1,497 uncovered branches |
| Function coverage | 85.92% | 🟢 Good |
| E2E test files | **2** | 🔴 Minimal |
| PHPUnit test files | 17 | 🟢 Decent |
| **LayersDatabaseTest.php** | **EMPTY** | 🔴 Critical gap |
| **LayersValidator.js dedicated tests** | **NONE** | 🔴 Critical gap |

---

## Critical Issues (Must Fix)

### 1. 🔴 God Class: CanvasManager.js (1,974 lines)

**Severity:** BLOCKER

CanvasManager is a textbook "God Object" anti-pattern with approximately 100+ methods handling 15+ distinct concerns:

- Canvas initialization and setup
- Coordinate transformations
- Selection handle management
- Drag/resize/rotate operations
- Style management
- Clipboard operations
- Grid and ruler rendering
- Zoom and pan
- Layer operations (add, remove, duplicate)
- Event handling
- Rendering coordination
- History integration
- And more...

**Impact:**
- Any modification carries high regression risk
- New developers cannot understand the file without days of study
- Testing is extremely difficult due to tight coupling
- Cannot be properly typed for TypeScript migration

**Root Cause:** Previous extraction of 8 controllers (4,200 lines) did NOT make CanvasManager a "thin facade" - it still contains massive amounts of implementation logic.

---

### 2. 🔴 Memory Leak Risk (71 Unmatched Event Listeners)

**Severity:** HIGH

Analysis shows ~100 `addEventListener` calls but only ~29 `removeEventListener` calls across the codebase. This is a **71-event imbalance** that likely causes memory leaks in long-running editor sessions.

**Affected Areas:**
- PropertiesForm.js - Multiple form inputs with listeners, no cleanup
- UIManager.js - UI event listeners without removal
- ToolbarStyleControls.js - Many listeners, unclear cleanup

**Note:** `EventTracker.js` exists for proper cleanup, but it is **not consistently used** across all modules.

---

### 3. 🔴 Global Namespace Pollution (130 Exports)

**Severity:** BLOCKER for modernization

The codebase exports **130 classes/functions directly to `window.*`**:

```javascript
// This pattern appears 130 times across the codebase:
window.CanvasManager = CanvasManager;
window.LayersEditor = LayersEditor;
// ... 128 more
```

While `LayersNamespace.js` creates a `window.Layers.*` namespace, **both patterns coexist**. Every file does both:

```javascript
window.Layers.Core.CanvasManager = CanvasManager;
window.CanvasManager = CanvasManager;  // Still pollutes global
```

**Impact:**
- **Blocks ES modules** - Cannot use `import`/`export` until resolved
- **Blocks TypeScript** - Cannot properly type global pollution
- **Blocks tree-shaking** - All 932KB loads regardless of what's used
- **Namespace collision risk** - Other extensions may conflict

---

### 4. 🔴 Legacy Prototype Pattern (646 Methods)

**Severity:** HIGH

The codebase has **646 prototype-based methods** but only **4 ES6 class declarations** (APIManager, EventManager, StateManager, UIManager). This is a **0.6% ES6 adoption rate**.

```javascript
// Current legacy pattern (646 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (only 4 classes):
class APIManager {
    addLayer( layer ) { ... }
}
```

**Impact:**
- IDE navigation/autocomplete severely degraded
- Inconsistent coding patterns confuse contributors
- Cannot use private fields, getters/setters, static methods naturally
- Future TypeScript migration will be painful

---

### 5. 🔴 CSP Security Weakness

**Severity:** MEDIUM-HIGH

The Content Security Policy in Hooks.php (line 66) allows dangerous directives:

```php
$policy[] = "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
```

- `unsafe-eval` allows `eval()` and `Function()` - enables code injection attacks
- `unsafe-inline` allows inline scripts - weakens XSS protection

**Why this exists:** MediaWiki core generates inline scripts, and OOUI may use `eval()` for templates. However, this should be investigated and tightened if possible.

---

### 6. 🔴 Critical Testing Gaps

**Severity:** HIGH

| Gap | Impact |
|-----|--------|
| **LayersValidator.js** (953 lines) has **no dedicated test file** | Validation logic is critical for security; untested code here is high-risk |
| **LayersDatabaseTest.php** is **empty** | Database operations entirely untested |
| Only **2 E2E test files** | Most user workflows untested end-to-end |
| Only **75% branch coverage** | 1,497 code branches never executed in tests |

---

## Medium Issues

### 7. 🟠 Excessive Bundle Size (932KB)

The JavaScript bundle is **932KB unminified** (~465KB minified). For comparison:
- Draw.io editor: ~400KB minified
- Figma web app: Code-split, lazy-loaded
- Excalidraw: ~280KB minified

**Causes:**
- No code splitting (viewer loads editor code)
- No lazy loading of dialogs
- 18 files over 500 lines (lots of redundant code)
- All globals loaded regardless of usage

---

### 8. 🟠 Inefficient Deep Cloning

**21 instances** of `JSON.parse(JSON.stringify(obj))` for deep cloning:

```javascript
// This is slow and has edge cases (loses undefined, functions, dates)
const clone = JSON.parse( JSON.stringify( layer ) );
```

Should use `structuredClone()` (modern browsers) or a utility function with proper handling.

---

### 9. 🟠 Inconsistent Error Handling in PHP

6 of 10 `json_decode()` calls **do not use `JSON_THROW_ON_ERROR`**:

```php
// Safe - errors are thrown
$data = json_decode( $json, true, 512, JSON_THROW_ON_ERROR );

// Unsafe - errors return null silently
$data = json_decode( $json, true );  // Found in 6 places
```

**Affected files:**
- ThumbnailProcessor.php (line 124)
- LayersParamExtractor.php (lines 102, 190)
- ImageLinkProcessor.php (line 431)
- ApiLayersSave.php (line 151)

---

### 10. 🟠 Dual Validation Systems

The codebase has **two separate validation systems** that must be kept in sync:

| System | File | Lines |
|--------|------|-------|
| Client-side | LayersValidator.js | 953 |
| Server-side | ServerSideLayerValidator.php | 730 |

This creates maintenance burden - any validation rule change must be made in both places. Consider generating client validation from server rules.

---

## What's Working Well

### ✅ Server-Side Security (8/10)

The PHP backend demonstrates excellent security practices:

- **CSRF tokens** required on all write operations
- **Rate limiting** via MediaWiki's `pingLimiter`
- **Strict property whitelist** with 47+ validated fields
- **Type/range validation** on all numeric fields
- **Text sanitization** (HTML stripped, protocol checks)
- **Parameterized SQL** (no injection vulnerabilities)
- **Defense in depth** with multiple validation layers

### ✅ Test Coverage (Quality Issues Aside)

**2,647 Jest tests** is impressive:
- 89.66% statement coverage
- 85.92% function coverage
- All tests passing

### ✅ Documentation

- `copilot-instructions.md` is comprehensive
- `docs/ARCHITECTURE.md` explains module structure
- `docs/ACCESSIBILITY.md` documents WCAG efforts

### ✅ Code Hygiene

- No `console.log` statements in production code
- `const self = this` anti-pattern eliminated (was 62, now 0)
- All logging uses proper `mw.log.*` (205 calls)
- ESLint passes with 0 errors

### ✅ Accessibility Efforts

- `AccessibilityAnnouncer.js` for ARIA live regions
- Keyboard navigation in layer panel
- Keyboard shortcuts help dialog (Shift+?)

---

## Technical Debt Summary

| Debt Type | Count | Est. Fix Time |
|-----------|-------|---------------|
| God classes (>1,000 lines) | 9 files | 4-6 weeks |
| Files >500 lines needing split | 18 files | 2-3 weeks |
| Global window.X elimination | 130 exports | 1 week |
| Prototype→class migration | 646 methods | 3-4 weeks |
| Memory leak fixes | ~71 listeners | 1 week |
| Missing test coverage | Critical paths | 2 weeks |
| JSON_THROW_ON_ERROR | 6 files | 2 hours |
| Efficient deep clone | 21 sites | 4 hours |

**Total estimated refactoring: 12-16 weeks**

---

## Recommendations Priority

### P0 - Critical (Block Development)

1. **Split CanvasManager.js** - It must become a true facade <500 lines
2. **Fix memory leaks** - Use EventTracker consistently everywhere
3. **Add LayersValidator.js tests** - Critical validation code untested
4. **Fill LayersDatabaseTest.php** - Database code untested

### P1 - High (Next 2-4 Weeks)

1. Split LayerPanel.js, SelectionManager.js, ToolManager.js
2. Eliminate duplicate global exports (use only `window.Layers.*`)
3. Pilot ES6 class conversion on 10 mid-size files
4. Fix PHP `json_decode` without error handling

### P2 - Medium (1-2 Months)

1. Bundle size reduction to <500KB
2. E2E test infrastructure (mock API for CI)
3. Replace `JSON.parse(JSON.stringify())` with `structuredClone()`
4. Investigate CSP restrictions (reduce unsafe-eval if possible)

### P3 - Long Term

1. Complete ES6 class migration
2. TypeScript migration (after ES6 complete)
3. ES modules with tree-shaking
4. Consider validation rule generation (server→client)

---

## Conclusion

The Layers extension is **functional but architecturally compromised**. The extensive test suite masks underlying structural problems that make the codebase:

1. **Hard to maintain** - 9 god classes, 18 files over 500 lines
2. **Hard to modernize** - 130 global exports, 646 prototype methods
3. **Memory-unsafe** - 71 unmatched event listeners
4. **Oversized** - 932KB for an annotation tool

The path forward requires **honest assessment** (this document) and **systematic refactoring** starting with CanvasManager decomposition and memory leak fixes.

**Without addressing the god class and memory leak problems, every new feature will increase technical debt and regression risk.**

See [`improvement_plan.md`](./improvement_plan.md) for the prioritized action plan.

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 8, 2025*
