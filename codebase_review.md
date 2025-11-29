# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** November 27, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis  

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While the **backend has solid security foundations**, the **frontend suffers from critical architectural debt** that creates significant maintenance burden, testing difficulties, and scalability concerns.

**Overall Assessment: 4.5/10** — The extension functions but carries severe technical debt. The backend is reasonably production-ready; the frontend requires substantial refactoring before being maintainable at scale.

**Key Strengths:**
- Backend security (CSRF, rate limiting, strict validation)
- 1,178 passing tests with 53% coverage (inflated by utility classes)
- Zero ESLint warnings
- Good documentation in copilot-instructions.md

**Critical Issues:**
- **4,048-line CanvasManager.js god class** with only 22% coverage
- **2,001-line WikitextHooks.php** with highly repetitive code
- **IIFE pattern with 29+ window globals** blocking ES module adoption
- **Performance infrastructure defined but 100% unused** (dirty regions, layer caching)
- **Three separate undo/redo implementations** creating conflict potential
- **20+ empty catch blocks** silently swallowing errors
- **ErrorHandler exists but is never used** by editor modules

**Detailed improvement tasks are documented in [`improvement_plan.md`](./improvement_plan.md).**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 3/10 | 🔴 Poor | God classes, IIFE globals, no ES modules, triplicate history systems |
| Code Quality | 6/10 | 🟡 Fair | 0 ESLint warnings, but 20+ empty catch blocks |
| Security | 8/10 | 🟢 Good | Defense-in-depth backend, but frontend TODOs unresolved |
| Performance | 2/10 | 🔴 Poor | dirtyRegion/layersCache defined but **never used** |
| Accessibility | 5/10 | 🟡 Fair | Documented but canvas fundamentally inaccessible |
| Documentation | 7/10 | 🟢 Good | copilot-instructions.md is comprehensive |
| Testing | 5/10 | 🟡 Fair | Core modules severely undertested (14-22% coverage) |
| Error Handling | 3/10 | 🔴 Poor | ErrorHandler unused; 20+ empty catch blocks |
| Maintainability | 3/10 | 🔴 Poor | God classes, triplicate systems make changes high-risk |

---

## 🔴 Critical Issues (Production Blockers)

### 1. CanvasManager.js: 4,048-Line God Class

**Severity:** 🔴 CRITICAL

```bash
$ wc -l resources/ext.layers.editor/CanvasManager.js
4048
```

This single file handles **at least 15 distinct responsibilities**:
- Canvas initialization and context management
- Rendering and redraws
- Mouse/touch event handling  
- Selection state and manipulation
- Zoom and pan functionality
- Grid and ruler display
- Undo/redo history (one of THREE implementations!)
- Clipboard operations
- Drawing mode state machine
- Tool management delegation
- Transform operations
- Hit testing fallbacks
- Image loading
- Coordinate transformation
- Error logging

**Test Coverage: Only 22.24%** — Testing this monolith is extremely difficult.

**Impact:**
- Any change risks regressions across unrelated features
- New developers cannot understand the codebase
- Performance optimization is nearly impossible
- Coverage will never improve without splitting
- Debugging is a nightmare

**Six controllers were previously extracted** (ZoomPanController, GridRulersController, TransformController, HitTestController, DrawingController, ClipboardController) achieving **97-100% coverage**, proving the pattern works. Yet CanvasManager remains at 4,000+ lines with extensive fallback implementations that duplicate the controller logic.

---

### 2. WikitextHooks.php: 2,001-Line God Class with Code Duplication

**Severity:** 🔴 CRITICAL

```bash
$ wc -l src/Hooks/WikitextHooks.php
2001
```

This PHP file contains **19+ hook methods** with **massive code duplication**. The same `<img>` attribute injection pattern appears nearly identically in:
- `onImageBeforeProduceHTML()` (lines 52-185)
- `onMakeImageLink2()` (lines 238-411)  
- `onLinkerMakeImageLink()` (lines 420-582)
- `onLinkerMakeMediaLinkFile()` (lines 590-842)
- `onThumbnailBeforeProduceHTML()` (lines 870-1180)

Each method repeats the same regex operations and class/attribute injection logic with minor variations. This is a maintenance nightmare — any change must be replicated 5 times.

---

### 3. IIFE Pattern with 29+ Window Globals

**Severity:** 🔴 CRITICAL (Architecture)

Every JavaScript file uses the 2015-era IIFE pattern:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;
}());
```

The `.eslintrc.json` declares **29+ global variables** as readonly:

```json
"globals": {
    "CanvasRenderer": "readonly",
    "LayersSelectionManager": "readonly",
    "ZoomPanController": "readonly",
    // ... 26 more
}
```

**Actual `window.` assignments in codebase: 233+ occurrences**

**Problems:**
- No explicit dependency management
- Cannot use ES modules or tree-shaking
- Global namespace pollution
- Makes testing harder (requires manual global setup)
- Blocks modern tooling and bundler optimizations
- 2025 JavaScript code using 2015 patterns
- Load order is fragile and error-prone

---

### 4. Performance Infrastructure: 100% Defined, 0% Implemented

**Severity:** 🔴 CRITICAL

CanvasManager.js lines 37-42 define performance optimization variables:

```javascript
this.dirtyRegion = null;          // ❌ NEVER ASSIGNED OR READ
this.animationFrameId = null;     // ❌ NEVER ASSIGNED OR READ
this.layersCache = Object.create(null);  // ❌ NEVER ASSIGNED OR READ
this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 }; // ❌ NEVER USED
```

**Grep verification:**
- `dirtyRegion` appears **only once** (the declaration)
- `layersCache` appears **only once** (the declaration)

Every canvas change triggers a **full redraw** via `performRedraw()`. For images with many layers or complex paths:
- Laggy interactions during drawing
- High CPU usage during pan/zoom
- Poor performance on mobile devices
- No frame throttling

The documentation (`MODULAR_ARCHITECTURE.md`) claims dirty region tracking exists — this is false.

---

### 5. Three Separate Undo/Redo Implementations

**Severity:** 🔴 HIGH

| Location | Implementation |
|----------|---------------|
| `HistoryManager.js` | 524 lines - Primary implementation |
| `LayersEditor.js:255-277` | `undo()` and `redo()` methods |
| `CanvasManager.js:2268-2326` | Separate `undo()` and `redo()` implementations |

```javascript
// LayersEditor.js:255
LayersEditor.prototype.undo = function () { ... }

// CanvasManager.js:2268  
CanvasManager.prototype.undo = function () { ... }

// HistoryManager.js:131
HistoryManager.prototype.undo = function () { ... }
```

**Problems:**
- Unclear which implementation gets called when
- State can become inconsistent between systems
- History arrays may diverge
- Testing is complicated by multiple paths
- Memory usage is multiplied

---

### 6. Error Handling: ErrorHandler Exists but is Never Used

**Severity:** 🔴 HIGH

`ErrorHandler.js` (556 lines) provides comprehensive error handling:

```javascript
window.ErrorHandler = ErrorHandler;
```

However, searching the editor modules shows **zero usage**:

| File | Uses ErrorHandler | Empty catch blocks |
|------|-------------------|-------------------|
| CanvasManager.js | ❌ No | 2 |
| LayersEditor.js | ❌ No | 4 |
| CanvasEvents.js | ❌ No | 0 |
| LayerPanel.js | ❌ No | 3 |
| TransformController.js | ❌ No | 1 |
| LayersViewer.js | ❌ No | 4 |
| ValidationManager.js | ❌ No | 1 |
| Toolbar.js | ❌ No | 2 |
| ColorPickerDialog.js | ❌ No | 2 |
| PropertiesForm.js | ❌ No | 1 |

**Total: 20+ empty catch blocks swallowing errors silently**

Example patterns found:
```javascript
} catch ( _e ) { /* ignore */ }
} catch ( _err ) {}
} catch ( e ) {}
```

---

## 🟡 High Priority Issues

### 7. Test Coverage Gaps in Critical Modules

| File | Lines | Coverage | Risk Assessment |
|------|-------|----------|-----------------|
| CanvasManager.js | 4,048 | 22.24% | 🔴 Critical - core functionality |
| LayersEditor.js | 1,660 | 14.62% | 🔴 High - main orchestrator |
| CanvasEvents.js | 547 | 19.15% | 🔴 High - user interactions |
| Toolbar.js | 1,671 | ~30% | 🟡 Medium - UI |
| LayerPanel.js | 1,091 | 50.21% | 🟡 Fair |

Meanwhile, extracted canvas controllers have **97-100% coverage**, proving the god class structure is the problem.

**Overall coverage (53.4%) is misleading** — it's inflated by near-100% coverage on utility classes while core modules remain dangerously undertested.

---

### 8. Security TODOs in Production Code

**Severity:** 🟡 HIGH

```javascript
// resources/ext.layers.editor/LayersEditor.js:1082
// TODO: Implement more comprehensive keyboard navigation and screen reader support

// resources/ext.layers.editor/LayersEditor.js:1092
// TODO: Ensure all user-generated content is sanitized before rendering in the DOM or canvas
```

The sanitization TODO is particularly concerning. While backend validation exists via `ServerSideLayerValidator.php` and `TextSanitizer.php`, the frontend rendering path should also sanitize.

---

### 9. Five Event Systems with Overlapping Responsibilities

**Severity:** 🟡 HIGH

| File | Lines | Purpose |
|------|-------|---------|
| EventHandler.js | 508 | Low-level DOM events |
| EventManager.js | 119 | Event registration |
| EventSystem.js | 699 | Custom event bus |
| CanvasEvents.js | 547 | Canvas-specific events |
| CanvasManager.js (inline) | ~500+ | Direct event handling |

This creates:
- Confusion about where event logic belongs
- Duplicate event handling in some cases
- Complex debugging when events don't fire
- Memory leaks from uncleared listeners

---

## 🟡 Medium Priority Issues

### 10. State Management: Partial Migration to StateManager

`StateManager.js` exists (652 lines, 85% coverage) with:
- Atomic operations with locking
- Subscription pattern for reactive updates
- Layer CRUD operations

However, components bypass it:

| Component | Bypasses StateManager |
|-----------|----------------------|
| CanvasManager | Maintains own `selectedLayerIds`, `currentTool`, `zoom`, `pan` |
| LayerPanel | Sometimes calls canvas directly |
| HistoryManager | Has own layer snapshot array |
| Toolbar | Direct canvas manipulation |

The migration is incomplete, leading to potential state inconsistencies.

---

### 11. Magic Numbers with Silent Fallbacks

Constants fail silently:

```javascript
// resources/ext.layers.editor/ui/PropertiesForm.js:604
const LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
const DEFAULTS = window.LayersConstants ? window.LayersConstants.DEFAULTS : {};
const LIMITS = window.LayersConstants ? window.LayersConstants.LIMITS : {};
```

If `LayersConstants` fails to load, code continues with empty objects instead of failing fast. This masks configuration issues.

---

### 12. Canvas Accessibility is Fundamentally Limited

The `<canvas>` element is inherently inaccessible to screen readers. `docs/ACCESSIBILITY.md` documents this honestly but the layer panel could serve as an accessible alternative — this is not implemented.

---

## 🟢 Positive Aspects

### Backend Security (Good)

1. **CSRF Token Enforcement:**
   ```php
   public function needsToken() { return 'csrf'; }
   ```

2. **Rate Limiting:**
   ```php
   $rateLimiter = new RateLimiter();
   if ($rateLimiter->isLimited($user, 'editlayers-save')) {
       $this->dieWithError('layers-rate-limited');
   }
   ```

3. **Strict Property Whitelist:** 
   `ServerSideLayerValidator.php` defines `ALLOWED_PROPERTIES` with 40+ fields — unknown fields are silently dropped.

4. **Input Sanitization:**
   `TextSanitizer` strips HTML and dangerous protocols.

5. **Parameterized Queries:**
   All database operations use prepared statements.

---

### Test Suite (Good Numbers, Poor Distribution)

- **1,178 tests passing**
- **53.4% statement coverage** (misleading — see distribution)
- Canvas controllers: 97-100% coverage
- StateManager: 85% coverage
- GeometryUtils: 96% coverage
- ValidationManager: 99% coverage

**But core modules are dangerously undertested.**

---

### Documentation (Good)

- `.github/copilot-instructions.md`: Comprehensive 500+ line guide
- `docs/ACCESSIBILITY.md`: Honest about limitations
- `docs/MODULAR_ARCHITECTURE.md`: Architecture overview (though claims don't match reality)
- Inline JSDoc on ~40% of functions

---

## Codebase Statistics

| Metric | Value | Assessment |
|--------|-------|------------|
| JavaScript files (editor) | 36+ files | Fragmented |
| Total JS lines (editor) | 19,920 | High complexity |
| Largest JS file | 4,048 lines | 🔴 God class |
| Second largest JS file | 1,671 lines | 🟡 Large |
| PHP source files | ~20 files | Reasonable |
| Largest PHP file | 2,001 lines | 🔴 God class |
| Jest tests | 1,178 | Good count |
| Jest coverage | 53.4% | Misleading (inflated) |
| Core module coverage | 14-22% | 🔴 Dangerous |
| ESLint warnings | 0 | ✅ Clean |
| Window globals | 29+ declared, 233+ assignments | 🔴 Excessive |
| Empty catch blocks | 20+ | 🔴 Error hiding |
| Undo/redo implementations | 3 separate | 🔴 Duplicative |

---

## Conclusion

The Layers extension demonstrates **adequate backend engineering** with defense-in-depth security, but the **frontend has accumulated severe technical debt** that will impede future development.

**Critical observations:**

1. The 4,048-line `CanvasManager.js` is the single biggest risk — any change carries high regression probability
2. Performance optimization infrastructure was planned but **never implemented**
3. Three separate undo/redo systems create conflict potential
4. 20+ empty catch blocks mean errors are silently swallowed
5. The `ErrorHandler` class exists but is completely unused
6. 29+ window globals make dependency management impossible
7. Test coverage numbers are misleading — core modules have 14-22% coverage

**Before production deployment at scale:**
1. Split CanvasManager.js (reduces risk, enables testing)
2. Implement actual performance optimization (dirty regions)
3. Consolidate undo/redo into single StateManager-based solution
4. Replace empty catch blocks with ErrorHandler calls
5. Address security TODOs

**For long-term health:**
1. Migrate from IIFE to ES modules
2. Extract common logic from WikitextHooks.php
3. Consolidate event systems
4. Complete StateManager migration

The extension works today for simple use cases, but scaling or onboarding new contributors will be extremely difficult without addressing these structural issues.

---

*Review performed by GitHub Copilot using Claude Opus 4.5 (Preview) on November 27, 2025*
