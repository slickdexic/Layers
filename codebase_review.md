# Layers MediaWiki Extension - Critical Code Review

**Review Date:** December 4, 2025  
**Reviewer:** GitHub Copilot  
**Review Type:** Comprehensive Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While the codebase shows evidence of active development and some good practices, **significant architectural problems and technical debt** remain that create maintenance burden and impede future development.

**Overall Assessment: 5.5/10** - Functional with good security and test coverage, but serious architectural debt that will become increasingly costly to maintain.

**Detailed improvement plan: [`improvement_plan.md`](./improvement_plan.md)**

### Critical Findings Summary

| Area | Status | Critical Issue |
|------|--------|----------------|
| **God Classes** | CRITICAL | 8 files exceed 800 lines each; 3 exceed 1,400 lines |
| **Global Pollution** | CRITICAL | 222 `window.*` references; **68 unique global exports** |
| **E2E Tests** | WARNING | Real tests exist but require MediaWiki instance (skipped in CI) |
| **Memory Management** | WARNING | 11+ manager classes missing `destroy()` methods |
| **Backend Security** | GOOD | Excellent CSRF, rate limiting, input validation |
| **Unit Test Coverage** | EXCELLENT | 2,709 Jest tests across 61 test files |
| **Code Organization** | MIXED | Good modular structure but inconsistent patterns |

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 4/10 | Poor | God classes, IIFE globals, inconsistent DI |
| Code Quality | 5/10 | Mixed | Good test coverage but fragile architecture |
| Security | 8/10 | Good | Defense-in-depth backend validation |
| Performance | 4/10 | Concerning | Full canvas redraws, no benchmarks, large JS payload |
| Accessibility | 4/10 | Partial | Some ARIA attributes, canvas inherently inaccessible |
| Documentation | 6/10 | Mixed | Good docs but some metrics outdated |
| Testing | 7/10 | Good | Excellent unit tests; E2E tests need CI integration |
| Error Handling | 8/10 | Good | Uses mw.log consistently; no console.* in production |
| Maintainability | 3/10 | Critical | Large files, duplicated patterns, 68 global exports |

---

## Verified Metrics (December 4, 2025)

### JavaScript Codebase Size

| Metric | Value |
|--------|-------|
| Total JS files in editor | 47 |
| Total lines of JS code | **27,317** |
| Files over 800 lines | **10** |
| Files over 1,000 lines | **8** |
| Global exports (`window.X =`) | **68 unique** |
| Total `window.*` references | **222** |

### File Size Analysis

| File | Lines | Target | % Over |
|------|-------|--------|--------|
| CanvasManager.js | **1,980** | <800 | 148% over |
| LayersEditor.js | **1,879** | <800 | 135% over |
| CanvasRenderer.js | **1,465** | <800 | 83% over |
| TransformController.js | **1,204** | <800 | 51% over |
| LayerPanel.js | **1,121** | <600 | 87% over |
| LayersValidator.js | **1,001** | <500 | 100% over |
| SelectionManager.js | **980** | <500 | 96% over |
| ToolManager.js | **970** | <500 | 94% over |
| APIManager.js | **891** | <500 | 78% over |
| Toolbar.js | **769** | <500 | 54% over |
| PropertiesForm.js | **753** | <500 | 51% over |
| ShapeRenderer.js | **734** | <500 | 47% over |
| ToolbarStyleControls.js | **694** | <500 | 39% over |
| StateManager.js | **656** | <400 | 64% over |

### PHP Codebase Size

| Metric | Value |
|--------|-------|
| Total PHP source files | 26 |
| Total lines of PHP code | **8,328** |
| Largest file | LayersDatabase.php (829 lines) |

### Test Coverage

| Metric | Value |
|--------|-------|
| Jest test files | 61 |
| Total Jest tests | **2,709** |
| E2E spec files | 3 |
| E2E real tests | ~20 (require MW instance) |

---

## CRITICAL Issues

### 1. God Classes - Fundamental Architecture Problem

The codebase contains multiple "god classes" with far too many responsibilities:

**CanvasManager.js (1,980 lines):**
- Canvas initialization and lifecycle
- Zoom and pan management (partially extracted)
- Selection handling coordination
- Layer manipulation
- Clipboard operations
- Grid and ruler management
- Event coordination
- Drawing delegation
- Style management
- Hit testing coordination

**LayersEditor.js (1,879 lines):**
- UI orchestration
- Module dependency resolution (17 module factories inline)
- State management bridging
- API coordination
- Revision and layer set management
- Navigation handling
- Modal dialog management
- Keyboard shortcut handling
- Error handling

**CanvasRenderer.js (1,465 lines):**
- Shape rendering delegation
- Layer iteration
- Selection visualization
- Text rendering
- Grid rendering
- Transform application

**TransformController.js (1,204 lines):**
- Resize operations
- Rotation operations
- Drag operations
- Multi-layer transformations
- Snap-to-grid logic
- Transform event handling

**Impact:**
- Changes to any feature require understanding thousands of lines
- Code reviews are difficult due to mixed concerns
- Testing is complex due to tight coupling
- New contributors face steep learning curve
- Risk of regressions on any modification

---

### 2. Global Namespace Pollution - Critical Blocking Issue

**Verified Count:** 222 `window.*` references across the codebase, with **68 unique global exports**.

```javascript
// Typical pattern (outdated, problematic)
( function () {
    'use strict';
    function CanvasManager( config ) { /* 1,980 lines */ }
    window.CanvasManager = CanvasManager;  // Global pollution
}());
```

**Problems Caused:**
1. **Load order fragility** - Files must be loaded in exact order
2. **No tree-shaking** - All code loaded regardless of usage
3. **TypeScript blocked** - Cannot migrate incrementally
4. **Namespace collision risk** - Other extensions could conflict
5. **Testing friction** - Global mocks required everywhere
6. **ES modules blocked** - Cannot use modern import/export

**Note:** A `LayersNamespace.js` consolidation was started but the underlying globals still exist.

---

### 3. E2E Tests - Incomplete CI Integration

The E2E tests in `tests/e2e/editor.spec.js` are **real functional tests** (not placeholders), but they:

1. Require `MW_SERVER` environment variable
2. Skip automatically when MediaWiki instance unavailable
3. Are not integrated into CI pipeline

```javascript
// tests/e2e/editor.spec.js
const describeEditor = process.env.MW_SERVER ? test.describe : test.describe.skip;
```

**Actual E2E Tests Available:**
- Editor loading tests
- Layer creation tests (rectangle, circle, text, arrow)
- Layer manipulation tests (select, delete, undo, redo)
- Save/load persistence tests
- Keyboard shortcuts tests

**What's Missing:**
- CI integration with MediaWiki test instance
- All 11 layer types (only 4 tested)
- Named layer set tests
- Import/export tests
- Multi-layer selection tests

---

### 4. Memory Leak Risks - Missing destroy() Methods

**Classes WITH proper destroy() methods (17 found):**
- CanvasManager, CanvasEvents, LayersEditor, LayerPanel, Toolbar, ToolbarStyleControls
- StateManager, UIManager, EventManager, EventTracker, ErrorHandler
- ImageLoader, LayerSetManager, TransformationEngine
- RenderCoordinator, InteractionController, DrawingController, ClipboardController

**Classes MISSING destroy() methods (11+ found):**

| File | Lines | Issue |
|------|-------|-------|
| SelectionManager.js | 980 | No destroy() |
| HistoryManager.js | 528 | Has clearHistory() but no cleanup |
| ToolManager.js | 970 | No destroy() |
| APIManager.js | 891 | No destroy() |
| ValidationManager.js | 240 | No destroy() |
| CanvasRenderer.js | 1,465 | No destroy() |
| ShapeRenderer.js | 734 | No destroy() |
| TransformController.js | 1,204 | No destroy() |
| ZoomPanController.js | 341 | No destroy() |
| GridRulersController.js | 383 | No destroy() |
| HitTestController.js | 376 | No destroy() |

**Note:** CanvasManager.destroy() attempts to call destroy on controllers, but silently catches errors when they don't exist.

---

### 5. StateManager Singleton - FIXED

The previous critical bug where `StateManager` created a singleton at module load time has been fixed:

```javascript
// StateManager.js - Now correct
if ( typeof window !== 'undefined' ) {
    window.StateManager = StateManager;
    // NOTE: Do NOT create a global singleton here.
    // Each LayersEditor instance creates its own StateManager via the ModuleRegistry.
}
```

---

## MEDIUM Issues

### 6. Inconsistent Error Handling Patterns

**Good:** No `console.log/warn/error` calls in production code (verified by comments noting fixes).

**Issue:** The `mw.message` fallback pattern is duplicated in 4+ files:
```javascript
return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
```

**Found in:**
- APIManager.js
- ErrorHandler.js  
- LayerSetManager.js
- MessageHelper.js

MessageHelper exists but adoption is incomplete.

### 7. PHP Code Duplication

**getLogger() pattern duplicated in 4 classes:**
- ImageLinkProcessor.php
- ThumbnailProcessor.php
- LayeredFileRenderer.php
- LayersHtmlInjector.php

**getDatabase() pattern duplicated in 3 classes:**
- ApiLayersSave.php
- ApiLayersInfo.php
- LayersDatabase.php

Should be extracted to shared services.

### 8. Archive Directory With Dead Code

The `resources/ext.layers.editor/archive/` directory contains 2 files:
- EventHandler.js (512 lines)
- EventSystem.js (702 lines)

These are excluded from ESLint but remain in the repository. Should be either deleted or moved to a branch.

### 9. Hidden God Class: TransformController.js

At **1,204 lines**, `TransformController.js` is a significant god class not mentioned in previous reviews. It handles:
- Resize operations (all 8 handles)
- Rotation operations
- Drag operations (single and multi-layer)
- Transform state management
- Event throttling

---

## Strengths

### Backend Security (Excellent)

The PHP backend demonstrates security best practices:

1. **CSRF Token Enforcement** - All write operations require tokens
2. **Rate Limiting** - Per-action limits via MediaWiki's rate limiter
3. **Strict Property Whitelist** - 47 validated fields in ServerSideLayerValidator
4. **Multi-layer Input Validation:**
   - Size limit before JSON parsing (DoS prevention)
   - Set name sanitization (path traversal prevention)
   - Enum validation for types, blend modes
   - Points array capped at 1,000
5. **Parameterized Queries** - All DB operations use prepared statements
6. **Generic Error Messages** - Internal details logged, not exposed

### Unit Test Coverage (Excellent)

**2,709 Jest tests** across 61 test files covering:
- All major managers and controllers
- Integration workflows (save/load)
- Security and robustness scenarios
- Edge cases and regressions

### No Console Usage in Production

All `console.log/warn/error` calls have been replaced with `mw.log.*` equivalents, with security fix comments documenting the changes.

### Good Documentation

- Comprehensive README.md
- Detailed copilot-instructions.md for AI contributors
- Architecture docs in docs/ directory
- NAMED_LAYER_SETS.md for new features

---

## Recommendations by Priority

### P0 - Critical (This Week)

1. **Integrate E2E tests into CI** - Set up MediaWiki test instance
2. **Add destroy() to all managers** - Prevent memory leaks
3. **Delete archive/ directory** - Remove dead code

### P1 - High (2-4 Weeks)

1. **Continue god class decomposition:**
   - Split CanvasManager (1,980 -> <800)
   - Split LayersEditor (1,879 -> <800)
   - Split TransformController (1,204 -> <600)
   - Split CanvasRenderer (1,465 -> <800)
2. **Consolidate global exports** - Move to `window.Layers.*` namespace
3. **Complete MessageHelper migration** - Remove duplicate patterns
4. **Extract PHP shared services** - LoggerFactory, FileResolver

### P2 - Medium (1-2 Months)

1. **Begin ES module migration** - Start with leaf modules
2. **Add canvas accessibility** - ARIA labels, keyboard navigation
3. **Add performance benchmarks** - Canvas rendering, large layer sets
4. **Expand E2E test coverage** - All 11 layer types

### P3 - Long Term (3+ Months)

1. **TypeScript migration** - New code in TS
2. **Full E2E test suite** - 50+ comprehensive tests
3. **Layer set management API** - Delete/rename operations

---

## Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,709 | 2,500+ | GOOD |
| CanvasManager.js | 1,980 | <800 | 148% over |
| LayersEditor.js | 1,879 | <800 | 135% over |
| TransformController.js | 1,204 | <600 | 100% over |
| Global exports | 68 | <10 | 580% over |
| Classes missing destroy() | 11 | 0 | Missing |
| E2E tests in CI | 0 | 20+ | Not integrated |

---

## Conclusion

The Layers extension is **functional and secure** for basic annotation tasks. The backend demonstrates excellent security practices, and unit test coverage is impressive at 2,709 tests.

**Critical blockers remain:**

1. **God classes** - 8 files over 800 lines, 3 over 1,400 lines
2. **Global pollution** - 68 exports blocking modern tooling
3. **Memory leaks** - 11+ classes missing destroy() methods
4. **E2E tests** - Real tests exist but not in CI

**Positive developments since last review:**
- StateManager singleton bug fixed
- Console usage eliminated
- EventTracker utility created
- ShapeRenderer extracted
- LayerSetManager extracted

**The extracted controllers and utilities prove the path forward.** Apply the same decomposition pattern aggressively before adding new features.

---

*Review performed by GitHub Copilot on December 4, 2025*
