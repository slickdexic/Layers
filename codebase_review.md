# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** November 26, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis

---

## Executive Summary

The "Layers" extension is an ambitious MediaWiki extension for non-destructive image annotation. While the backend (PHP) demonstrates solid architecture with proper security measures and dependency injection, the frontend (JavaScript) suffers from **significant technical debt**, **poor separation of concerns**, and **incomplete refactoring**. The codebase shows clear signs of rapid feature development without corresponding architectural improvements.

**Verdict:** The extension is functional but requires **substantial refactoring** before it can be considered production-ready. The core issues are addressable, but require dedicated engineering effort.

**Detailed improvement tasks are documented in [`improvement_plan.md`](./improvement_plan.md).**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 5/10 | 🟠 Needs Work | Backend: solid DI. Frontend: monolithic, fragmented state |
| Code Quality | 4/10 | 🔴 Poor | PHP: Good. JS: Massive files, duplicated logic, debug code in production |
| Security | 6/10 | 🟡 Acceptable | Backend secured; **debug logging in production code is a concern** |
| Performance | 5/10 | 🟠 Needs Work | Dirty-region optimization exists but unused; frontend inefficient |
| Accessibility | 4/10 | 🔴 Poor | Some ARIA present but incomplete, keyboard navigation gaps |
| Documentation | 6/10 | 🟡 Acceptable | copilot-instructions.md is excellent; inline docs inconsistent |
| Testing | 4/10 | 🔴 Poor | 184 Jest tests + PHPUnit tests exist; coverage is unclear, gaps evident |
| Error Handling | 5/10 | 🟠 Needs Work | Backend excellent; frontend inconsistent |
| Maintainability | 3/10 | 🔴 Critical | CanvasManager (3,829 lines) is a blocker; state management fragmented |

**Overall Score: 4.7/10** — Functional prototype requiring significant engineering investment.

---

## 🔴 Critical Issues (Production Blockers)

### 1. Debug Logging Left in Production Code

**Severity:** 🔴 Critical (Security & Performance)

**Problem:** Production PHP code contains `file_put_contents()` and `error_log()` calls that:
- Write to a hardcoded `layers.log` file (security risk - information disclosure)
- Use `error_log()` directly instead of MediaWiki's logging infrastructure
- Are NOT controlled by the `LayersDebug` config flag

**Evidence from `ApiLayersSave.php`:**
```php
// Line 87
$logFile = __DIR__ . '/../../layers.log';
file_put_contents( $logFile, "$timestamp ApiLayersSave::execute() CALLED\n", FILE_APPEND );

// Line 130
error_log( "LAYERS DEBUG ApiLayersSave: params[setname]=" . var_export( ... ) );
```

**Evidence from `LayersDatabase.php`:**
```php
// Lines 77, 83, 87
error_log( "LAYERS DEBUG saveLayerSet: setName_param=" . var_export( $setName, true ) );
```

**Impact:**
- **Security:** Log files may expose sensitive data (usernames, file paths, parameters)
- **Performance:** Synchronous file writes on every API call
- **Disk:** Log file grows unbounded without rotation
- **Compliance:** May violate data retention policies

**Fix Required:** Remove all `file_put_contents()` and direct `error_log()` calls. Use `$this->logger->debug()` with proper MediaWiki logger configuration.

---

### 2. Frontend Monolith: `CanvasManager.js` (3,829 lines)

**Severity:** 🔴 Critical (Maintainability)

**Current State:** This single file handles:
- Canvas initialization and sizing (~200 lines)
- Background image loading (~100 lines)
- All event handling (mouse, touch, keyboard) (~600 lines)
- All shape rendering (delegated but still complex) (~400 lines)
- Resize operations for ALL layer types (~800 lines)
- Rotation handling (~200 lines)
- Selection and hit-testing (~400 lines)
- Zoom and pan (~300 lines)
- Grid, rulers, and guides (~300 lines)
- History/undo integration (~100 lines)
- Canvas pooling (~50 lines)

**Partial Refactoring Started:**
- `ZoomPanController.js` and `GridRulersController.js` extracted (good!)
- But `CanvasManager.js` still has fallback code for when controllers not found
- Delegation pattern incomplete

**Impact:**
- **Unmaintainable:** No engineer can safely modify without extensive testing
- **Untestable:** Too many responsibilities to unit test effectively
- **Merge conflicts:** Any canvas-related change touches this file

---

### 3. Fragmented State Management

**Severity:** 🔴 Critical (Data Integrity)

**Problem:** The codebase has **four** competing state patterns:

1. **`StateManager.js`** - Intended single source of truth (542 lines, well-designed with atomic operations)
2. **`LayersEditor.js`** - Bridge property that routes to StateManager
3. **`LayerPanel.js`** - Maintains `this.layers` and `this.selectedLayerId` **separately**
4. **`CanvasManager.js`** - Has `this.selectedLayerId` and `this.selectedLayerIds[]`

**Evidence from `LayerPanel.js`:**
```javascript
// Line 20-21
this.layers = [];
this.selectedLayerId = null;

// Line 452
this.layers = layers || [];

// Line 773
this.selectedLayerId = layerId;
```

**Evidence from `CanvasManager.js`:**
```javascript
// Line 46
this.selectedLayerId = null;

// Line 2372
this.selectedLayerId = layerId || null;
```

**Impact:**
- **Data Inconsistency:** Selection state can differ between components
- **Race Conditions:** Updates may not propagate correctly
- **Debugging Nightmare:** Which component has the "real" state?

**Unused Dependency:** `zustand` (5.0.8) is installed in `package.json` but appears unused in the codebase.

---

### 4. Console Logging in Production JavaScript

**Severity:** 🟠 High (Security & Polish)

**Problem:** Multiple `console.log()` statements remain in production code:

**Evidence from `LayersEditor.js` (lines 1453-1507):**
```javascript
console.log( 'LayersEditor: Auto-bootstrap starting...' );
console.log( 'LayersEditor: Current URL:', window.location.href );
console.log( 'LayersEditor: wgLayersDebug config:', debug );
// ... 15+ more console.log statements
```

**Evidence from `UIManager.js` (line 484):**
```javascript
console.log( '[UIManager] Created new set:', { ... } );
```

**Impact:**
- Exposes internal workings to users
- Clutters browser console
- May expose URLs, config values, DOM structure

---

## 🟠 Serious Issues (High Priority)

### 5. Code Duplication Across Multiple Files

**Problem:** Similar logic exists in multiple places:

| Concern | Files Involved | Lines of Duplication |
|---------|----------------|---------------------|
| Rendering | `CanvasManager.js`, `CanvasRenderer.js` (1,355 lines) | ~400 lines overlap |
| Events | `CanvasManager.js`, `CanvasEvents.js`, `EventHandler.js`, `EventManager.js` | ~300 lines overlap |
| Selection | `CanvasManager.js`, `SelectionManager.js`, `LayerPanel.js` | ~200 lines overlap |

**Evidence:** `CanvasManager.js` still has `drawText()`, `drawRectangle()`, etc. that just delegate:
```javascript
CanvasManager.prototype.drawText = function ( layer ) {
    if ( this.renderer ) {
        this.renderer.drawText( layer );
    }
};
```
This pattern is repeated for 10+ shape types without adding value.

---

### 6. Large Files Without Clear Boundaries

| File | Lines | Problem |
|------|-------|---------|
| `CanvasManager.js` | 3,829 | Monolith - handles everything canvas-related |
| `LayerPanel.js` | 1,875 | Contains inline color picker, property forms, layer list |
| `Toolbar.js` | 1,674 | Contains all tool buttons and their handlers |
| `LayersEditor.js` | 1,609 | Main orchestrator with bootstrap/debug code |
| `CanvasRenderer.js` | 1,355 | All shape rendering logic |
| `LayersValidator.js` | 1,001 | Validation rules and error messages |

**Target:** No file should exceed 500-800 lines for maintainability.

---

### 7. IIFE Pattern Throughout (Outdated)

**Current Pattern:**
```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    // ...
    window.CanvasManager = CanvasManager;
}());
```

**Problems:**
- No tree-shaking possible
- Dependencies not explicit
- Module loading order matters
- Global namespace pollution via `window.*`

**Modern Alternative:** ES modules with explicit imports/exports.

---

### 8. Incomplete Test Coverage

**Jest Tests (184 tests):**
- 15 test files exist covering basic functionality
- Tests use mocks but don't verify actual rendering
- No integration tests for editor workflows
- No visual regression tests

**PHPUnit Tests:**
- `ApiLayersSaveTest.php`, `ApiLayersInfoTest.php` exist (good!)
- `ServerSideLayerValidatorTest.php`, `ColorValidatorTest.php`, `TextSanitizerTest.php` exist (good!)
- But no coverage metrics enforced
- No integration tests for full save/load cycle

**Missing Coverage:**
- Canvas interaction tests (clicks, drags, resizes)
- Cross-browser compatibility tests
- Accessibility (keyboard navigation, screen reader) tests
- Performance benchmarks

---

## 🟡 Moderate Issues (Medium Priority)

### 9. Magic Numbers and Hardcoded Values

**Evidence from `CanvasManager.js`:**
```javascript
this.minZoom = 0.1;
this.maxZoom = 5.0;
this.maxHistorySteps = 50;
this.maxPoolSize = 5;
this.zoomAnimationDuration = 300;
```

These should reference `LayersConstants.js` which already has:
```javascript
ZOOM: { MIN: 0.1, MAX: 10, DEFAULT: 1, STEP: 0.1 }
```

---

### 10. Inconsistent Error Handling

**Backend (Good):**
```php
// All errors use i18n keys
$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
```

**Frontend (Inconsistent):**
```javascript
// Some places use mw.notify
mw.notify( mw.message( 'layers-save-error' ).text(), { type: 'error' } );

// Some places silently swallow errors
} catch ( _err ) {
    // Ignore cleanup errors
}

// Some places throw
throw new Error( 'Atomic update requires a function' );
```

---

### 11. Accessibility Gaps

**Present:**
- Some ARIA roles on buttons
- Focus trap in color picker dialog
- Keyboard shortcuts for layer reordering

**Missing:**
- Skip links for keyboard users
- Live regions for status updates
- Complete keyboard navigation for all tools
- Screen reader testing documentation
- High contrast mode support

---

## 🟢 Positive Aspects

### What's Working Well

1. **Backend Architecture (PHP):**
   - Clean dependency injection via `services.php`
   - `LayersDatabase.php` has retry logic with exponential backoff
   - `ServerSideLayerValidator.php` has comprehensive 40+ field whitelist
   - Proper MediaWiki hook integration

2. **Security Implementation:**
   - CSRF token enforcement via `needsToken()`
   - Rate limiting via `RateLimiter.php`
   - XSS prevention in `TextSanitizer.php`
   - Generic error messages to prevent info disclosure
   - Named set limit prevents abuse

3. **Documentation:**
   - `.github/copilot-instructions.md` is **excellent** - comprehensive API contracts
   - `docs/NAMED_LAYER_SETS.md` for new feature architecture
   - i18n with 100+ properly defined message keys

4. **Recent Improvements:**
   - `ZoomPanController.js` and `GridRulersController.js` extracted
   - `StateManager.js` has proper atomic operations
   - Event listener cleanup in `LayerPanel.js`
   - ESLint enabled on Jest tests

5. **Configuration:**
   - Comprehensive config options in `extension.json`
   - Reasonable defaults for limits (100 layers, 2MB max, 15 sets)

---

## Recommendations Summary

### Immediate (This Week)
1. **CRITICAL:** Remove all `file_put_contents()` and debug `error_log()` from PHP
2. **CRITICAL:** Remove `console.log()` statements from JS
3. Clean up unused `zustand` dependency or migrate to it

### Short-Term (2-4 Weeks)
4. Complete `CanvasManager.js` extraction (see improvement_plan.md Phase 1.1)
5. Consolidate state management to single StateManager
6. Add code coverage metrics and thresholds

### Medium-Term (1-2 Months)
7. Migrate to ES modules
8. Split large files (LayerPanel, Toolbar, CanvasRenderer)
9. Add integration tests for full workflows

### Long-Term (3+ Months)
10. Consider TypeScript migration
11. Full accessibility audit
12. Performance optimization with dirty-region rendering

---

## File Size Analysis

| File | Lines | Assessment | Priority to Split |
|------|-------|------------|-------------------|
| CanvasManager.js | 3,829 | 🔴 Critical | P0 - Blocking maintainability |
| LayerPanel.js | 1,875 | 🟠 Large | P1 - After CanvasManager |
| Toolbar.js | 1,674 | 🟠 Large | P2 |
| LayersEditor.js | 1,609 | 🟡 Acceptable | P3 - Debug code removal only |
| CanvasRenderer.js | 1,355 | 🟡 Acceptable | P3 |
| LayersValidator.js | 1,001 | 🟢 Good | N/A |

---

## Conclusion

The Layers extension has a **solid foundation** in its backend architecture and security model. However, the frontend codebase has accumulated significant technical debt that makes it difficult to maintain, test, and extend safely.

**Priority order for improvement:**
1. Remove production debug logging (security/compliance)
2. Split CanvasManager.js (maintainability blocker)
3. Consolidate state management (data integrity)
4. Add test coverage metrics (quality gate)

See **[`improvement_plan.md`](./improvement_plan.md)** for detailed task breakdown with effort estimates.

---

*Review performed by GitHub Copilot using Claude Opus 4.5 (Preview)*
