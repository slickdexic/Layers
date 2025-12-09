# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 8, 2025 (Revised)  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural and Security Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. This review reveals a project with **significant technical debt** that, despite partial cleanup efforts, still suffers from fundamental architectural problems that impede maintainability, modernization, and long-term viability.

### Overall Assessment: 5.5/10

**Strengths:**
- ✅ Strong server-side security (PHP validation, CSRF, rate limiting)
- ✅ Comprehensive Jest test suite (2,647 tests passing, ~90% statement coverage)
- ✅ Good documentation (architecture docs, copilot-instructions)
- ✅ Proper logging patterns (uses `mw.log.*` instead of `console.*`)
- ✅ All `json_decode` calls now use `JSON_THROW_ON_ERROR`
- ✅ ES6 class adoption improved (23 classes, up from 4)
- ✅ `const self = this` anti-pattern nearly eliminated (only 1 remaining)

**Critical Weaknesses:**
- ❌ **God class problem remains unsolved** - CanvasManager.js at 2,109 lines with 112+ methods
- ❌ **Massive bundle size** - ~943KB of JavaScript for an annotation tool
- ❌ **103 global `window.X` exports** - severe namespace pollution
- ❌ **671 prototype methods** vs only 23 ES6 classes (3.4% modernization)
- ❌ **Memory leak risks** - 104 `addEventListener` calls with only 29 `removeEventListener`
- ❌ **CSP security weakness** - `unsafe-eval` and `unsafe-inline` enabled
- ❌ **Missing critical tests** - LayersValidator.js (954 lines) has no dedicated test file
- ❌ **LayersDatabaseTest.php is empty** - 0 lines of database layer tests
- ❌ **ESLint failing** - 2 unused variable errors in LayerRenderer.js

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## Verified Metrics (December 8, 2025)

### JavaScript Codebase

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total JS files | 54 | - | - |
| Total JS lines | 30,339 | - | - |
| Total JS bytes | **943KB** | <400KB | 🔴 **136% over target** |
| Files > 500 lines | **23** | 5 | 🔴 Critical |
| Files > 1,000 lines | **8** | 0 | 🔴 God classes |
| Global `window.X =` exports | **103** | 0 | 🔴 Namespace pollution |
| Prototype methods | **671** | 0 | 🔴 Legacy pattern |
| ES6 `class` declarations | **23** | 671+ | 🟠 **3.4% modernization** |
| `const self = this` | **1** | 0 | 🟢 Nearly fixed |
| `console.log/error` in prod | **0** | 0 | 🟢 Clean |
| `JSON.parse(JSON.stringify())` | **21** | 0 | 🟠 Inefficient cloning |
| ESLint errors | **2** | 0 | 🔴 Broken build |

### God Classes (Files > 1,000 Lines)

| File | Lines | Methods | Severity |
|------|-------|---------|----------|
| CanvasManager.js | **2,109** | ~112 | 🔴 CRITICAL |
| LayerRenderer.js | **1,939** | ~60 | 🟠 Shared engine, tolerable |
| LayerPanel.js | **1,464** | ~90+ | 🔴 Needs decomposition |
| TransformController.js | **1,231** | ~40 | 🟠 Recently extracted |
| LayersEditor.js | **1,231** | ~50 | 🟠 Entry point, complex |
| ToolManager.js | **1,027** | ~40 | 🔴 Needs decomposition |
| SelectionManager.js | **1,026** | ~35 | 🔴 Needs decomposition |
| LayersValidator.js | **954** | ~30 | 🟠 Single purpose, but **NO TESTS** |

### Large Files (500-1000 Lines) - 15 files

| File | Lines | Notes |
|------|-------|-------|
| APIManager.js | 916 | Complex but well-structured |
| CanvasRenderer.js | 860 | Rendering engine core |
| Toolbar.js | 788 | UI complexity |
| PropertiesForm.js | 759 | Form handling |
| ToolbarStyleControls.js | 692 | Style UI |
| StateManager.js | 662 | State management |
| TransformationEngine.js | 642 | Transform logic |
| DrawingController.js | 627 | Drawing tools |
| HistoryManager.js | 625 | Undo/redo |
| UIManager.js | 604 | UI coordination |
| CanvasEvents.js | 573 | Event handling |
| ErrorHandler.js | 571 | Error management |
| LayerSetManager.js | 570 | Layer sets |
| ColorPickerDialog.js | 563 | Color picker UI |
| InteractionController.js | 498 | Input handling |

### Memory Leak Risk Indicators

| Pattern | Add Count | Remove Count | **Imbalance** |
|---------|-----------|--------------|---------------|
| addEventListener | 104 | 29 | **75 potential leaks** |
| setTimeout/setInterval | ~20 | ~5 | **~15 potential leaks** |
| requestAnimationFrame | ~12 | ~4 | ~8 potential issues |

**Issue:** The severe imbalance in event listener management suggests memory leaks in long-running editor sessions.

### PHP Codebase

| Metric | Value | Status |
|--------|-------|--------|
| Total PHP files | 29 | - |
| Total PHP lines | 8,460 | - |
| `json_decode` with error handling | **10 of 10** | 🟢 All fixed |
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
| **LayersDatabaseTest.php** | **EMPTY (0 lines)** | 🔴 Critical gap |
| **LayersValidator.js dedicated tests** | **NONE** | 🔴 Critical gap |
| Jest test files | 63 | 🟢 Good |

---

## Critical Issues (Must Fix)

### 1. 🔴 God Class: CanvasManager.js (2,109 lines)

**Severity:** BLOCKER

CanvasManager is a textbook "God Object" anti-pattern with **112 prototype methods** handling 15+ distinct concerns:

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
- Text input modal management
- Marquee selection
- And more...

**Impact:**
- Any modification carries high regression risk
- New developers cannot understand the file without days of study
- Testing is extremely difficult due to tight coupling
- Cannot be properly typed for TypeScript migration

**Root Cause:** Previous extraction of 8 controllers did NOT make CanvasManager a "thin facade" - it still contains massive amounts of implementation logic (2,109 lines, up from claimed 1,974).

---

### 2. 🔴 ESLint Build Failure

**Severity:** HIGH

The project currently fails ESLint with 2 errors:

```
LayerRenderer.js
  301:11  error  'scaleX' is assigned a value but never used  no-unused-vars
  302:11  error  'scaleY' is assigned a value but never used  no-unused-vars
```

**Impact:** CI/CD pipelines fail, preventing clean builds and merges.

**Fix:** Either use these variables or remove them.

---

### 3. 🔴 Memory Leak Risk (75 Unmatched Event Listeners)

**Severity:** HIGH

Analysis shows 104 `addEventListener` calls but only 29 `removeEventListener` calls across the codebase. This is a **75-event imbalance** that causes memory leaks in long editor sessions.

**Affected Areas:**
- `PropertiesForm.js` - Form inputs with listeners, no cleanup
- `UIManager.js` - UI event listeners without removal
- `ToolbarStyleControls.js` - Many listeners, unclear cleanup
- `CanvasManager.js` - Canvas event handlers

**Note:** `EventTracker.js` exists for proper cleanup, but it is **not consistently used** across all modules.

---

### 4. 🔴 Global Namespace Pollution (103 Exports)

**Severity:** BLOCKER for modernization

The codebase exports **103 classes/functions directly to `window.*`**:

```javascript
// This pattern appears 103 times across the codebase:
window.CanvasManager = CanvasManager;
window.LayersEditor = LayersEditor;
// ... 101 more
```

While `LayersNamespace.js` creates a `window.Layers.*` namespace, **both patterns coexist**. Every file does both:

```javascript
window.Layers.Core.CanvasManager = CanvasManager;
window.CanvasManager = CanvasManager;  // Still pollutes global
```

**Impact:**
- **Blocks ES modules** - Cannot use `import`/`export` until resolved
- **Blocks TypeScript** - Cannot properly type global pollution
- **Blocks tree-shaking** - All 943KB loads regardless of what's used
- **Namespace collision risk** - Other extensions may conflict

---

### 5. 🔴 Legacy Prototype Pattern (671 Methods)

**Severity:** HIGH

The codebase has **671 prototype-based methods** but only **23 ES6 class declarations**. This is a **3.4% ES6 adoption rate**.

```javascript
// Current legacy pattern (671 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (only 23 classes):
class APIManager {
    addLayer( layer ) { ... }
}
```

**Impact:**
- IDE navigation/autocomplete severely degraded
- Inconsistent coding patterns confuse contributors
- Cannot use private fields, getters/setters, static methods naturally
- Future TypeScript migration will be painful

**Progress:** ES6 classes increased from 4 to 23, but this is still only 3.4% of the codebase.

---

### 6. 🔴 CSP Security Weakness

**Severity:** MEDIUM-HIGH

The Content Security Policy in [Hooks.php](src/Hooks.php#L66) allows dangerous directives:

```php
$policy[] = "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
$policy[] = "style-src 'self' 'unsafe-inline'";
```

- `unsafe-eval` allows `eval()` and `Function()` - enables code injection attacks
- `unsafe-inline` allows inline scripts - weakens XSS protection

**Why this exists:** MediaWiki core generates inline scripts, and OOUI may use `eval()` for templates. However, this should be investigated and tightened if possible.

---

### 7. 🔴 Critical Testing Gaps

**Severity:** HIGH

| Gap | Impact |
|-----|--------|
| **LayersValidator.js** (954 lines) has **no dedicated test file** | Validation logic is critical for security; untested code here is high-risk |
| **LayersDatabaseTest.php** is **completely empty (0 lines)** | Database operations entirely untested |
| Only **2 E2E test files** | Most user workflows untested end-to-end |
| Only **75% branch coverage** | 1,497 code branches never executed in tests |

---

## Medium Issues

### 8. 🟠 Excessive Bundle Size (943KB)

The JavaScript bundle is **943KB unminified** (~470KB minified). For comparison:
- Draw.io editor: ~400KB minified
- Figma web app: Code-split, lazy-loaded
- Excalidraw: ~280KB minified

**Causes:**
- No code splitting (viewer loads editor code)
- No lazy loading of dialogs
- 23 files over 500 lines (lots of redundant code)
- All globals loaded regardless of usage

---

### 9. 🟠 Inefficient Deep Cloning

**21 instances** of `JSON.parse(JSON.stringify(obj))` for deep cloning:

```javascript
// This is slow and has edge cases (loses undefined, functions, dates)
const clone = JSON.parse( JSON.stringify( layer ) );
```

Should use `structuredClone()` (modern browsers) or a utility function with proper handling.

---

### 10. 🟠 Dual Validation Systems

The codebase has **two separate validation systems** that must be kept in sync:

| System | File | Lines |
|--------|------|-------|
| Client-side | LayersValidator.js | 954 |
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
- **All json_decode uses JSON_THROW_ON_ERROR** (verified)

### ✅ Test Coverage (Quality Issues Aside)

**2,647 Jest tests** is impressive:
- 89.66% statement coverage
- 85.92% function coverage
- All tests passing
- 63 test files

### ✅ Documentation

- `copilot-instructions.md` is comprehensive
- `docs/ARCHITECTURE.md` explains module structure
- `docs/ACCESSIBILITY.md` documents WCAG efforts
- 14 archived analysis documents showing project history

### ✅ Code Hygiene

- No `console.log` statements in production code
- `const self = this` nearly eliminated (only 1 remaining in CanvasManager.js line 1737)
- All logging uses proper `mw.log.*` (205 calls)

### ✅ Accessibility Efforts

- `AccessibilityAnnouncer.js` for ARIA live regions
- Keyboard navigation in layer panel
- Keyboard shortcuts help dialog (Shift+?)

---

## Technical Debt Summary

| Debt Type | Count | Est. Fix Time |
|-----------|-------|---------------|
| God classes (>1,000 lines) | 8 files | 4-6 weeks |
| Files >500 lines needing split | 23 files | 3-4 weeks |
| Global window.X elimination | 103 exports | 1 week |
| Prototype→class migration | 671 methods | 3-4 weeks |
| Memory leak fixes | ~75 listeners | 1 week |
| Missing test coverage | Critical paths | 2 weeks |
| ESLint errors | 2 | 30 minutes |
| Efficient deep clone | 21 sites | 4 hours |
| Last `const self = this` | 1 | 30 minutes |

**Total estimated refactoring: 14-18 weeks**

---

## Recommendations Priority

### P0 - Critical (Block Development)

1. **Fix ESLint errors** - Broken build is unacceptable
2. **Split CanvasManager.js** - It must become a true facade <500 lines
3. **Fix memory leaks** - Use EventTracker consistently everywhere
4. **Add LayersValidator.js tests** - Critical validation code untested
5. **Fill LayersDatabaseTest.php** - Database code untested

### P1 - High (Next 2-4 Weeks)

1. Split LayerPanel.js, SelectionManager.js, ToolManager.js
2. Eliminate duplicate global exports (use only `window.Layers.*`)
3. Continue ES6 class conversion (target: 50+ files)
4. Remove last `const self = this` in CanvasManager.js

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

1. **Hard to maintain** - 8 god classes, 23 files over 500 lines
2. **Hard to modernize** - 103 global exports, 671 prototype methods
3. **Memory-unsafe** - 75 unmatched event listeners
4. **Oversized** - 943KB for an annotation tool
5. **Build-broken** - ESLint currently failing

The path forward requires **honest assessment** (this document) and **systematic refactoring** starting with ESLint fixes, CanvasManager decomposition, and memory leak fixes.

**Without addressing the god class and memory leak problems, every new feature will increase technical debt and regression risk.**

See [`improvement_plan.md`](./improvement_plan.md) for the prioritized action plan.

---

## Verification Commands

Run these to verify current metrics:

```bash
# Bundle size (bytes)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c

# God classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | awk '$1 > 1000'

# Global exports
grep -rE "^\s*window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Prototype methods
grep -r "\.prototype\." resources --include="*.js" | wc -l

# ES6 classes
grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l

# Event listener imbalance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Lint check
npm test
```

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 8, 2025*
