# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** November 29, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis  

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While the **backend has solid security foundations**, the **frontend suffers from significant architectural debt** that creates maintenance burden, testing difficulties, and scalability concerns.

**Overall Assessment: 5/10** — The extension functions and has made some progress on technical debt, but still carries significant issues. The backend is reasonably production-ready; the frontend requires continued refactoring for maintainability at scale.

**Key Strengths:**
- Backend security (CSRF, rate limiting, strict property whitelist validation)
- 1,202 passing Jest tests with 53.4% statement coverage
- Canvas controllers extracted with excellent coverage (97%+)
- Zero ESLint errors
- Comprehensive documentation in copilot-instructions.md
- ErrorHandler is now properly integrated (6 call sites)
- Integration tests added for save/load workflow

**Critical Issues:**
- **4,003-line CanvasManager.js god class** with only 22% coverage
- **2,001-line WikitextHooks.php** with highly repetitive code
- **IIFE pattern with 48 unique window.* exports** blocking ES module adoption
- **Performance infrastructure defined but 100% unused** (dirtyRegion, layersCache never called)
- **Dead code in LayersEditor** (undoStack/redoStack declared at line 379-380 but never used)
- **4 remaining empty catch blocks** silently swallowing errors
- **Documentation claims features that don't exist** (e.g., MODULAR_ARCHITECTURE.md claims `markDirtyRegion()` method)

**Detailed improvement tasks are documented in [`improvement_plan.md`](./improvement_plan.md).**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 4/10 | 🔴 Poor | God classes, IIFE globals, no ES modules |
| Code Quality | 6/10 | 🟡 Fair | 0 ESLint errors, but dead code and empty catches remain |
| Security | 8/10 | 🟢 Good | Defense-in-depth backend, comprehensive validation |
| Performance | 2/10 | 🔴 Poor | dirtyRegion/layersCache defined but **never implemented** |
| Accessibility | 5/10 | 🟡 Fair | Documented but canvas fundamentally inaccessible |
| Documentation | 6/10 | 🟡 Fair | Good guides but some docs claim non-existent features |
| Testing | 5/10 | 🟡 Fair | Core modules severely undertested (14-22% coverage) |
| Error Handling | 5/10 | 🟡 Fair | ErrorHandler now used, but 4 empty catches remain |
| Maintainability | 4/10 | 🔴 Poor | God classes make changes high-risk |

---

## 🔴 Critical Issues (Production Blockers)

### 1. CanvasManager.js: 4,003-Line God Class

**Severity:** 🔴 CRITICAL

```bash
$ wc -l resources/ext.layers.editor/CanvasManager.js
4003
```

This single file handles **at least 15 distinct responsibilities**:
- Canvas initialization and context management
- Rendering and redraws
- Mouse/touch event handling  
- Selection state and manipulation
- Zoom and pan functionality
- Grid and ruler display
- Clipboard operations
- Drawing mode state machine
- Tool management delegation
- Transform operations
- Hit testing fallbacks
- Image loading
- Coordinate transformation
- Error logging
- Undo/redo bridge methods

**Test Coverage: Only 22.24%** — Testing this monolith is extremely difficult.

**Impact:**
- Any change risks regressions across unrelated features
- New developers cannot understand the codebase
- Performance optimization is nearly impossible
- Coverage will never improve without splitting
- Debugging is a nightmare

**Six controllers were previously extracted** (ZoomPanController, GridRulersController, TransformController, HitTestController, DrawingController, ClipboardController) achieving **97-100% coverage**, proving the extraction pattern works. Yet CanvasManager remains at 4,000+ lines with extensive fallback implementations that duplicate controller logic.

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

### 3. IIFE Pattern with 48 Unique Window.* Exports

**Severity:** 🔴 CRITICAL (Architecture)

Every JavaScript file uses the 2015-era IIFE pattern:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;
}());
```

**Actual counts:**
- Total `window.` references in JS files: **250**
- Unique `window.X =` assignments: **48**

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
this.dirtyRegion = null;          // ❌ NEVER USED (grep: 1 occurrence - only declaration)
this.animationFrameId = null;     // ❌ NEVER USED
this.layersCache = Object.create(null);  // ❌ NEVER USED (grep: 1 occurrence - only declaration)
this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 }; // ❌ NEVER USED
```

**Verification:**
- `dirtyRegion` appears **only once** (the declaration)
- `layersCache` appears **only once** (the declaration)
- `markDirtyRegion()` **does not exist** despite being documented in MODULAR_ARCHITECTURE.md

Every canvas change triggers a **full redraw** via `performRedraw()`. For images with many layers or complex paths:
- Laggy interactions during drawing
- High CPU usage during pan/zoom
- Poor performance on mobile devices
- No frame throttling

**Documentation Mismatch:** `docs/MODULAR_ARCHITECTURE.md` claims features like "Dirty Region Tracking" and `markDirtyRegion()` that simply don't exist in the codebase. This misleading documentation is a red flag.

---

### 5. Dead Code: Unused Undo/Redo Stacks in LayersEditor

**Severity:** 🟡 HIGH

LayersEditor.js lines 379-381:
```javascript
// Initialize undo/redo system
this.undoStack = [];
this.redoStack = [];
this.maxUndoSteps = 50;
```

These arrays are **declared but never populated**. The actual undo/redo system uses HistoryManager correctly. This dead code:
- Allocates memory for unused arrays
- Confuses developers about which system to use
- Creates maintenance overhead
- Is cleaned up at destroy (lines 1398-1399) despite never being used

---

### 6. Remaining Empty Catch Blocks

**Severity:** 🟡 HIGH

After previous cleanup, 4 empty catch blocks remain:

| Location | Line | Context |
|----------|------|---------|
| CanvasRenderer.js | 187 | `} catch ( _e ) {}` |
| LayersViewer.js | 127 | `} catch ( e ) {}` |
| init.js | 31 | `} catch ( e ) {}` |
| init.js | 768 | `} catch ( e ) {}` |

These silent failures mask bugs and make debugging difficult.

---

## 🟡 High Priority Issues

### 7. Test Coverage Gaps in Critical Modules

| File | Lines | Coverage | Risk Assessment |
|------|-------|----------|-----------------|
| CanvasManager.js | 4,003 | 22.24% | 🔴 Critical - core functionality |
| LayersEditor.js | 1,707 | 14.62% | 🔴 High - main orchestrator |
| CanvasEvents.js | 547 | 19.15% | 🔴 High - user interactions |
| Toolbar.js | 1,674 | ~30% | 🟡 Medium - UI |
| LayerPanel.js | 1,091 | 50.21% | 🟡 Fair |

Meanwhile, extracted canvas controllers have **97-100% coverage**, proving the god class structure is the problem.

**Overall coverage (53.4%) is misleading** — it's inflated by near-100% coverage on utility classes while core modules remain dangerously undertested.

---

### 8. Documentation Inaccuracies

**Severity:** 🟡 HIGH

`docs/MODULAR_ARCHITECTURE.md` contains several claims about features that don't exist:

| Claimed Feature | Reality |
|-----------------|---------|
| `markDirtyRegion()` method | Does not exist |
| "Dirty Region Tracking" | Not implemented |
| `renderLayersOptimized()` | Does not exist |
| `needsFullRedraw()` | Does not exist |
| "Selective layer rendering" | Not implemented |

This misleading documentation can waste developer time and create false confidence in the codebase.

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
| LayersEditor | Has unused local undoStack/redoStack |
| Toolbar | Direct canvas manipulation in some cases |

The migration is incomplete, leading to potential state inconsistencies.

---

### 11. Silent Constant Fallbacks

Constants fail silently in multiple places:

```javascript
// resources/ext.layers.editor/ui/PropertiesForm.js:604
const LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
const DEFAULTS = window.LayersConstants ? window.LayersConstants.DEFAULTS : {};
const LIMITS = window.LayersConstants ? window.LayersConstants.LIMITS : {};
```

If `LayersConstants` fails to load, code continues with empty objects instead of failing fast. This masks configuration issues.

**Note:** A dependency validation function was added to LayersEditor but it logs warnings rather than blocking, so silent failures can still occur in edge cases.

---

### 12. PHP Code Style Warnings

Running `npm run test:php` produces multiple warnings:
- Comments formatting issues (SpaceBeforeSingleLineComment)
- Line length warnings (Generic.Files.LineLength)
- assertEmpty usage warnings (PHPUnit assertions)

While not blocking, these indicate inconsistent code style.

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

### Test Suite Progress

- **1,202 tests passing** (up from 1,178)
- **53.4% statement coverage**
- Canvas controllers: 97-100% coverage
- StateManager: 85% coverage
- GeometryUtils: 96% coverage
- ValidationManager: 99% coverage
- **New integration tests added** for save/load workflow (24 tests)

**But core modules remain dangerously undertested.**

---

### Error Handling Improvements

ErrorHandler is now properly integrated with 6 call sites:
- LayerPanel.js (dialog cleanup, properties sync)
- Toolbar.js (dialog cleanup)
- TransformController.js (transform events)
- CanvasManager.js (transform events)
- APIManager.js (API errors)

---

### Documentation

- `.github/copilot-instructions.md`: Comprehensive 500+ line contributor guide
- `docs/ACCESSIBILITY.md`: Honest about canvas limitations
- API contracts well-documented in copilot-instructions.md
- Good inline JSDoc coverage on utility functions

---

## Codebase Statistics

| Metric | Value | Assessment |
|--------|-------|------------|
| JavaScript files (editor) | 36+ files | Fragmented |
| Total JS lines (editor) | ~20,000 | High complexity |
| Largest JS file | 4,003 lines | 🔴 God class |
| Second largest JS file | 1,707 lines | 🟡 Large |
| PHP source files | ~20 files | Reasonable |
| Largest PHP file | 2,001 lines | 🔴 God class |
| Jest tests | 1,202 | Good count |
| Jest statement coverage | 53.4% | Misleading (inflated) |
| Core module coverage | 14-22% | 🔴 Dangerous |
| ESLint errors | 0 | ✅ Clean |
| Window.* exports | 48 unique | 🔴 Excessive |
| Empty catch blocks | 4 remaining | 🟡 Needs attention |
| Dead code | undoStack/redoStack, dirtyRegion, layersCache | 🟡 Cleanup needed |

---

## Conclusion

The Layers extension has made progress since the last review:
- ErrorHandler integration improved
- Integration tests added
- Undo/redo routing consolidated (though dead code remains)
- Some empty catch blocks fixed

However, **fundamental architectural issues remain unaddressed**:

1. The **4,003-line CanvasManager.js** is still the single biggest risk — any change carries high regression probability
2. **Performance optimization was planned but never implemented** — the infrastructure is dead code
3. **48 window.* exports** make the codebase a maintenance nightmare
4. **Documentation makes false claims** about features that don't exist
5. **Core modules have 14-22% coverage** while the overall number looks acceptable

**Before production deployment at scale:**
1. Split CanvasManager.js into focused modules (reduces risk, enables testing)
2. Either implement dirty region rendering OR remove the dead code
3. Remove dead undo/redo stacks from LayersEditor
4. Fix remaining 4 empty catch blocks
5. Update MODULAR_ARCHITECTURE.md to reflect reality

**For long-term health:**
1. Migrate from IIFE to ES modules
2. Extract common logic from WikitextHooks.php
3. Consolidate event systems
4. Complete StateManager migration

The extension works for simple use cases today, but scaling or onboarding new contributors will be extremely difficult without addressing these structural issues.

---

*Review performed by GitHub Copilot using Claude Opus 4.5 (Preview) on November 29, 2025*
