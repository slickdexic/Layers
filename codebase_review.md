# Layers MediaWiki Extension - Critical Code Review

**Review Date:** December 10, 2025  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. This is a **comprehensive, honest assessment** of the codebase quality, architecture, and technical debt.

### Overall Assessment: 6.5/10

The extension is **functional but carries significant technical debt**. While test coverage numbers are impressive (89.6%), they mask deeper architectural issues that will hamper long-term maintainability.

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## The Good ✅

| Area | Score | Notes |
|------|-------|-------|
| **Test Coverage** | 9/10 | 89.6% statements, 3,877 tests passing - genuinely excellent |
| **PHP Backend Security** | 9/10 | CSRF protection, rate limiting, parameterized queries, strict validation |
| **PHP Architecture** | 8/10 | Clean DI, service wiring, no god classes (largest 829 lines) |
| **Documentation** | 8/10 | Comprehensive copilot-instructions.md, architecture docs |
| **Code Splitting** | 8/10 | Viewer (~4K lines) vs Editor (~31K lines) properly separated |
| **Memory Management Pattern** | 7/10 | EventTracker pattern exists and is used in critical paths |

### What's Actually Working

1. **The extension works** - users can annotate images, save, load, view
2. **Security is solid** - PHP backend demonstrates professional practices
3. **Tests catch regressions** - 3,877 tests provide real safety
4. **Viewer is lightweight** - reading articles doesn't load editor bloat

---

## The Bad 🔴

| Area | Score | Notes |
|------|-------|-------|
| **Code Modernization** | 3/10 | 622 prototype methods vs 34 ES6 classes (5% modern) |
| **Global Namespace** | 4/10 | 54 direct `window.X` exports polluting global scope |
| **God Classes** | 4/10 | 7 files over 1,000 lines (largest 2,195 lines) |
| **Event Listener Balance** | 5/10 | 94 addEventListener vs 33 removeEventListener |
| **Code Duplication** | 5/10 | `getClass()` helper duplicated in 4 files |
| **JSDoc Coverage** | 6/10 | ~52% of functions documented |

---

## Verified Metrics (December 10, 2025)

### JavaScript Codebase

| Metric | Actual Value | Target | Status |
|--------|--------------|--------|--------|
| Total JS files | **65** | - | - |
| Viewer module | **~3,955 lines** | - | ✅ Lightweight |
| Editor module | **~31,067 lines** | - | Expected for full editor |
| Files > 1,000 lines | **7** | 0 | 🔴 God classes |
| Files 500-1,000 lines | **17** | 5 | 🟠 Needs attention |
| Prototype patterns | **622** | 0 | 🔴 Legacy code |
| ES6 classes | **34** | 622+ | 🔴 5% modernized |
| Direct window.X exports | **54** | 0 | 🔴 Namespace pollution |
| addEventListener calls | **94** | - | - |
| removeEventListener calls | **33** | 94 | 🔴 61 potential leaks |
| JSDoc annotations | **1,686** | ~3,264 | 🟠 52% documented |
| ESLint errors | **0** | 0 | ✅ Clean |

### Test Coverage

| Category | Value | Target | Status |
|----------|-------|--------|--------|
| Jest tests passing | **3,877** | - | ✅ Excellent |
| Jest test suites | **79** | - | ✅ Good |
| Statement coverage | **89.6%** | 80% | ✅ Exceeded |
| Branch coverage | **76.5%** | 65% | ✅ Exceeded |
| Line coverage | **89.8%** | 80% | ✅ Exceeded |
| Function coverage | **87.5%** | 80% | ✅ Exceeded |

### PHP Backend

| Metric | Value | Status |
|--------|-------|--------|
| Largest file | **829 lines** (LayersDatabase.php) | ✅ Acceptable |
| Files > 500 lines | **4** | ✅ Reasonable |
| SQL injection risks | **0** | ✅ Parameterized |
| Dead code found | **1 method** | 🟠 Minor |

---

## Critical Issues

### 1. 🔴 Legacy JavaScript Architecture (622 Prototype Methods)

The codebase is stuck in 2015-era JavaScript patterns:

```javascript
// Current pattern (95% of codebase):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (only 5%):
class APIManager {
    addLayer( layer ) { ... }
}
```

**Impact:**
- Poor IDE support (autocomplete, refactoring)
- No `super()` for inheritance
- Blocks TypeScript migration
- Makes code reviews harder for modern developers
- Prevents tree-shaking optimization

### 2. 🔴 God Classes (7 Files Over 1,000 Lines)

| File | Lines | Concern |
|------|-------|---------|
| LayerRenderer.js | **2,195** | Handles ALL shape rendering |
| CanvasManager.js | **2,061** | Still too large after extraction |
| LayerPanel.js | **1,576** | Complex UI component |
| LayersEditor.js | **1,265** | Main entry point |
| SelectionManager.js | **1,261** | Core selection logic |
| TransformController.js | **1,231** | Complex transforms |
| ToolManager.js | **1,154** | Tool registry and handling |

**LayerRenderer.js** is particularly problematic - it's a monolithic file handling rectangles, circles, ellipses, polygons, stars, arrows, lines, paths, highlights, blur, and text rendering all in one place. Any bug fix risks affecting unrelated shapes.

### 3. 🔴 Global Namespace Pollution (54 Direct Exports)

Every module exports to both `window.Layers.*` AND directly to `window.*`:

```javascript
// Good (namespaced):
window.Layers.Canvas.Manager = CanvasManager;

// Bad (also done - pollutes global):
window.CanvasManager = CanvasManager;
```

**Files doing direct global exports include:**
- All 10 canvas controllers
- CanvasManager, CanvasRenderer, CanvasEvents
- LayerPanel, LayersEditor, ToolManager
- All UI components
- All utility classes

### 4. 🟠 Event Listener Imbalance (94 vs 33)

Analysis shows **94 addEventListener calls but only 33 removeEventListener calls**, a gap of 61 potential memory leaks.

**However**, investigation reveals the architecture is better than raw numbers suggest:
- EventTracker pattern is used in critical components
- Many listeners are on elements that get removed from DOM (GC handles cleanup)
- Some are intentionally permanent (error handlers, beforeunload)

**Still concerning:**
- `PropertiesForm.js` - 12 addEventListener, no explicit cleanup
- `TextInputController.js` - listeners may not be cleaned if modal closed unexpectedly

### 5. 🟠 Code Duplication

The `getClass()` helper function is duplicated identically in 4 files:
- `LayersEditor.js`
- `Toolbar.js`
- `UIManager.js`
- `CanvasManager.js`

This is a classic DRY violation that should be extracted to a shared utility.

### 6. 🟠 Empty Catch Blocks

Found in `CanvasManager.js`:
```javascript
try { this.canvas.removeEventListener( 'mousedown', ... ); } catch ( err ) {}
try { this.canvas.removeEventListener( 'mousemove', ... ); } catch ( err ) {}
try { this.canvas.removeEventListener( 'mouseup', ... ); } catch ( err ) {}
```

Silent error swallowing makes debugging difficult.

### 7. 🟠 PHP Dead Code

`LayersDatabase.php` contains a dead method:
```php
private function getNextRevision( string $imgName, string $sha1, $dbw ): int
```

This is superseded by `getNextRevisionForSet()` and is never called. Dead code adds confusion.

### 8. 🟠 Inconsistent Logging

PHP code mixes three logging patterns:
1. Injected `LayersLogger` service
2. Direct `wfDebugLog('Layers', ...)` calls
3. Anonymous fallback logger class in `Hooks.php`

---

## PHP Backend Assessment

The PHP backend is **well-architected** and demonstrates professional practices:

### Security Excellence ✅

| Measure | Status |
|---------|--------|
| CSRF protection | ✅ Required on all writes |
| Rate limiting | ✅ Via MediaWiki pingLimiter |
| Property whitelist | ✅ 45+ fields, unknown dropped |
| SQL injection | ✅ All queries parameterized |
| XSS prevention | ✅ Text sanitization |
| Color injection | ✅ Strict validation |

### PHP Code Quality

| File | Lines | Quality Notes |
|------|-------|---------------|
| LayersDatabase.php | 829 | Clean DI, retry logic with exponential backoff |
| WikitextHooks.php | 779 | Complex but well-organized, uses static state |
| ThumbnailRenderer.php | 602 | ImageMagick logic, repetitive but functional |
| ServerSideLayerValidator.php | 600 | Comprehensive whitelist approach |
| ApiLayersSave.php | 475 | Excellent security documentation |

### PHP Issues Found

1. **Dead code:** `getNextRevision()` method never called
2. **Inconsistent logging:** Mix of wfDebugLog and injected logger
3. **Static state:** WikitextHooks uses `$pageHasLayers`, `$fileSetNames` static properties (testability concern)
4. **TOCTOU race:** Named set limit check happens before transaction

---

## Test Suite Assessment

### Strengths ✅

- **3,877 passing tests** - substantial coverage
- **89.6% statement coverage** - genuinely high
- **Well-organized** - dedicated directories for each component
- **Controllers well-tested** - 85%+ coverage on extracted controllers

### Weaknesses 🟠

| Issue | Severity |
|-------|----------|
| Integration tests | Only 2 exist vs 70+ unit tests |
| PHP test coverage | ~8 test files, many classes untested |
| Boundary tests | Missing max layer count, max points tests |
| Assertion quality | Some tests only check existence, not values |
| Skipped tests | 1 empty skipped test should be removed |

### Coverage Gaps

| Module | Coverage | Notes |
|--------|----------|-------|
| compat.js | 0% | Intentional (deprecation shim) |
| TextInputController.js | 86% | Modal cleanup paths untested |
| PropertiesForm.js | - | Missing destroy/cleanup tests |

---

## Technical Debt Summary

| Debt Type | Severity | Effort to Fix |
|-----------|----------|---------------|
| ES6 class migration | 🔴 Critical | 6-8 weeks |
| God class splitting | 🔴 High | 4-6 weeks |
| Global export cleanup | 🟠 Medium | 2-3 weeks |
| Code duplication | 🟠 Medium | 1 week |
| Event listener audit | 🟠 Medium | 1 week |
| PHP dead code | 🟡 Low | 1 day |
| Empty catch blocks | 🟡 Low | 1 day |
| Integration tests | 🟠 Medium | 2 weeks |

**Total estimated effort: 16-22 weeks**

---

## Recommendations

### Immediate (This Week)

1. **Remove dead `getNextRevision()` method** - trivial fix
2. **Add logging to empty catch blocks** - quick improvement
3. **Extract `getClass()` to shared utility** - stops duplication

### Short-term (1-2 Months)

1. **Begin ES6 class migration** - start with well-tested utilities
2. **Eliminate direct `window.X` exports** - keep only namespaced
3. **Add integration tests** - controller interaction coverage

### Medium-term (3-6 Months)

1. **Split LayerRenderer.js** - extract shape-specific renderers
2. **Complete ES6 migration** - systematic conversion
3. **Reduce CanvasManager** - continue controller extraction

### Long-term (6+ Months)

1. **TypeScript migration** - requires ES6 complete first
2. **ES modules** - requires globals eliminated
3. **Unified validation** - generate client from server rules

---

## Verification Commands

```bash
# Test coverage
npm run test:js -- --coverage

# God classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | sort -rn | head -10

# Prototype vs class ratio
echo "Prototypes: $(grep -r "\.prototype\." resources --include="*.js" | wc -l)"
echo "Classes: $(grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l)"

# Global exports (non-namespaced)
grep -rE "window\.[A-Z][a-zA-Z]+ =" resources --include="*.js" | grep -v "window\.Layers" | wc -l

# Event listener balance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c

# Viewer vs Editor size
cat resources/ext.layers.shared/*.js resources/ext.layers/*.js resources/ext.layers/viewer/*.js | wc -l
find resources/ext.layers.editor -name "*.js" -exec cat {} + | wc -l
```

---

## Conclusion

The Layers extension is a **working product with solid security** but **legacy architecture**. The high test coverage provides a safety net for refactoring, which is the silver lining.

**The core problem:** The codebase shows signs of rapid feature development without corresponding architectural investment. The result is 2015-era JavaScript patterns, god classes, and namespace pollution that will make future development increasingly expensive.

**Priority recommendation:** Begin the ES6 class migration systematically. The test suite provides excellent safety for this refactoring, and modern patterns will unlock TypeScript, tree-shaking, and better IDE support.

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*
