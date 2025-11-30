# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** November 29, 2025 (Updated)  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis  

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While the **backend has reasonably solid security foundations**, the **frontend suffers from severe architectural debt** that creates significant maintenance burden, testing difficulties, and scalability concerns. **This extension is not production-ready at scale without substantial refactoring.**

**Overall Assessment: 4.5/10** — The extension functions for basic use cases but carries substantial technical debt that will compound over time. The backend is reasonable; the frontend architecture is problematic at its core.

**Key Strengths:**
- Backend security (CSRF, rate limiting, strict property whitelist with 40+ validated fields)
- 1,235 passing Jest tests with 54.78% statement coverage
- Extracted canvas controllers demonstrate excellent patterns (97%+ coverage)
- Zero ESLint errors
- Comprehensive documentation in copilot-instructions.md

**Critical Issues (In Progress):**
- **3,523-line CanvasManager.js god class** — 23.6% coverage, unmaintainable monolith
- **2,018-line WikitextHooks.php** — massive code duplication, **refactor in progress** (processor classes created)
- **51 unique `window.X =` global exports** — antiquated IIFE pattern blocking ES modules
- **5 overlapping event systems** — architectural confusion with EventHandler, EventManager, EventSystem, CanvasEvents, plus inline handlers
- **Core modules dangerously undertested** — LayersEditor at 14.3%, CanvasEvents at 19.1%
- ~~One remaining empty catch block~~ ✅ **FIXED** — Now logs errors properly
- ~~Debug console.warn statements~~ ✅ **FIXED** — Removed from production code

**📋 Detailed improvement tasks are documented in [`improvement_plan.md`](./improvement_plan.md).**

---

## Recent Improvements (November 29, 2025)

### Completed Fixes

1. **✅ Empty Catch Block Fixed** ([CanvasEvents.js#L182])
   - Silent error swallowing replaced with `mw.log.error()` logging
   - Errors are now visible for debugging

2. **✅ Debug Console Statements Removed** ([LayersEditor.js])
   - Removed `console.warn` fallbacks from production code paths
   - Now uses only `mw.log.*` methods as intended

3. **✅ WikitextHooks.php Processor Classes Created**
   - [LayersHtmlInjector.php](src/Hooks/Processors/LayersHtmlInjector.php) — ~260 lines, centralized HTML injection
   - [LayersParamExtractor.php](src/Hooks/Processors/LayersParamExtractor.php) — ~290 lines, parameter extraction
   - Both classes have comprehensive PHPUnit tests
   - WikitextHooks.php now has helper methods using these processors
   - `extractLayersParamFromHref()` now delegates to `LayersParamExtractor`

### In Progress

- **WikitextHooks.php refactor** — Helper methods added, gradual migration of hook handlers underway
- **CanvasManager.js split** — Extraction strategy documented, awaiting implementation

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 3/10 | 🔴 Poor | God classes, IIFE globals, 5 event systems |
| Code Quality | 5/10 | 🟡 Fair | 0 ESLint errors, but structural issues pervasive |
| Security | 7/10 | 🟢 Fair-Good | Defense-in-depth backend, debug leaks fixed |
| Performance | 3/10 | 🔴 Poor | Full redraws on every change, no optimization |
| Accessibility | 4/10 | 🟠 Poor-Fair | Canvas is fundamentally inaccessible |
| Documentation | 6/10 | 🟡 Fair | Good guides, architecture docs now accurate |
| Testing | 4/10 | 🔴 Poor | Core modules critically undertested |
| Error Handling | 6/10 | 🟡 Fair | ErrorHandler exists, catch blocks now log |
| Maintainability | 3/10 | 🔴 Poor | God classes make any change high-risk |

---

## 🔴 Critical Issues (Production Blockers)

### 1. CanvasManager.js: 3,523-Line God Class

**Severity:** 🔴 CRITICAL  
**Coverage:** 23.64%  
**Risk:** Any change has high probability of regressions

```
$ wc -l resources/ext.layers.editor/CanvasManager.js
3523 resources/ext.layers.editor/CanvasManager.js
```

This single file handles **at least 15 distinct responsibilities**:
- Canvas initialization and context management
- Rendering and redraws (full canvas redraws on every change)
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

**Impact:**
- Any change risks regressions across unrelated features
- New developers cannot understand the codebase without extensive study
- Performance optimization is nearly impossible (can't isolate bottlenecks)
- Coverage will never meaningfully improve without splitting
- Debugging is extremely difficult
- The 23.6% coverage means 76.4% of paths are completely untested

**Contrast with extracted controllers:** Six controllers were previously extracted (ZoomPanController, GridRulersController, TransformController, HitTestController, DrawingController, ClipboardController) achieving **97-100% coverage**. This proves the extraction pattern works and should be completed.

---

### 2. WikitextHooks.php: 2,018-Line God Class with Massive Duplication

**Severity:** 🟡 IN PROGRESS (was 🔴 CRITICAL)

```
$ wc -l src/Hooks/WikitextHooks.php
2185 src/Hooks/WikitextHooks.php  # Increased due to new helper methods
```

This PHP file contains **14 hook handlers** with **extensive code duplication**:

| Hook Method | Lines | Pattern |
|-------------|-------|---------|
| `onImageBeforeProduceHTML()` | 52-185 | HTML injection + logging |
| `onMakeImageLink2()` | 297-510 | HTML injection + DB fetch |
| `onLinkerMakeImageLink()` | 513-695 | HTML injection + DB fetch |
| `onLinkerMakeMediaLinkFile()` | 698-920 | HTML injection + DB fetch |
| `onThumbnailBeforeProduceHTML()` | 1231-1550 | HTML injection + DB fetch |
| Plus 9 more hook handlers... | | |

The same pattern repeats in each handler:
1. Extract layers parameter from various sources (href, params, data-mw)
2. Check for explicit off/none
3. Fetch layer data from database
4. Inject HTML attributes and classes
5. JSON encode payload

This is a DRY (Don't Repeat Yourself) violation of epic proportions. A change to the injection logic must be replicated across 5+ methods.

---

### 3. IIFE Pattern with 51 Window.* Global Exports

**Severity:** 🔴 CRITICAL (Architecture)

Every JavaScript file uses the 2015-era IIFE pattern:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;
}());
```

**Actual counts from grep:**
- Unique `window.X =` assignments: **51**
- Total `window.` references: **250+**

**Problems:**
- No explicit dependency management — load order is implicit and fragile
- Cannot use ES modules, tree-shaking, or modern bundler optimizations
- Global namespace pollution creates collision risks
- Makes unit testing harder (requires manual global setup in test files)
- Blocks adoption of TypeScript (which requires modules)
- 2025 codebase using 2015 JavaScript patterns
- This is technical debt that compounds over time

**Sample of globals exported:**
```
window.CanvasManager, window.LayersEditor, window.Toolbar, 
window.LayerPanel, window.StateManager, window.HistoryManager,
window.EventHandler, window.EventManager, window.EventSystem,
window.CanvasEvents, window.ValidationManager, window.APIManager,
window.UIManager, window.LayersConstants, window.GeometryUtils,
window.CanvasRenderer, window.TransformController, window.ZoomPanController,
window.HitTestController, window.DrawingController, window.ClipboardController,
window.GridRulersController, window.ImageLoader, window.ErrorHandler,
window.ColorPickerDialog, window.ConfirmDialog, window.PropertiesForm,
window.IconFactory, window.layersEditorInstance, window.layersErrorHandler,
window.stateManager, window.layersRegistry, window.layersModuleRegistry...
```

---

### 4. Five Overlapping Event Systems

**Severity:** 🔴 CRITICAL (Architecture Confusion)

The codebase has **five** files dealing with events, each with overlapping responsibilities:

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| EventHandler.js | 513 | Low-level DOM events | Duplicates EventSystem |
| EventManager.js | 120 | Global event registration | Minimal, could inline |
| EventSystem.js | 703 | Custom event bus + state | Overlaps EventHandler |
| CanvasEvents.js | 551 | Canvas-specific events | Has empty catch block |
| CanvasManager.js (inline) | ~500+ | Direct event handling | Should delegate |

**Problems:**
- Developers don't know which system to use for new functionality
- Event handling is scattered across 5+ files
- Some events are handled in multiple places
- Memory leaks possible from untracked listeners
- Difficult to debug when events don't fire as expected
- Testing requires understanding all 5 systems

**The overlap:**
- EventHandler and EventSystem both handle mouse/touch/keyboard
- EventManager and EventSystem both have event registration
- CanvasEvents duplicates some CanvasManager functionality
- CanvasManager still has inline event handlers despite these extractions

---

### 5. No Actual Performance Optimizations

**Severity:** 🔴 HIGH

Every canvas state change triggers a **full redraw**:

```javascript
// CanvasManager.js - performRedraw() redraws EVERYTHING
this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
// ... draws all layers from scratch
```

**What's missing:**
- **Dirty region tracking**: Only redraw areas that changed
- **Layer caching**: Cache rendered layers as images for unchanged layers
- **Frame throttling**: requestAnimationFrame batching
- **Viewport culling**: Don't render layers outside visible area

**Impact:**
- Laggy interactions on images with many layers
- High CPU usage during pan/zoom operations
- Poor experience on lower-powered devices
- Scalability ceiling for complex annotations

**Note:** Previous review mentioned dead performance variables — those have been cleaned up, but no actual performance optimizations have been implemented.

---

### 6. Core Module Test Coverage Crisis

**Severity:** 🔴 CRITICAL

The "54.78% overall coverage" is **misleading** — it's inflated by near-100% coverage on utility classes while core orchestrators are dangerously undertested:

| File | Lines | Coverage | Risk Level |
|------|-------|----------|------------|
| **LayersEditor.js** | 1,762 | **14.32%** | 🔴 CRITICAL |
| **CanvasEvents.js** | 551 | **19.09%** | 🔴 CRITICAL |
| **CanvasManager.js** | 3,523 | **23.64%** | 🔴 CRITICAL |
| LayerPanel.js | 1,103 | 49.78% | 🟡 Medium |
| CanvasRenderer.js | 1,591 | 78.88% | 🟢 Good |

**The core user interaction path (LayersEditor → CanvasManager → CanvasEvents) has 14-24% coverage.**

Meanwhile, extracted controllers have excellent coverage:
- TransformController: 100%
- HitTestController: 98%
- ZoomPanController: 97%
- GridRulersController: 97%
- DrawingController: 97%
- ClipboardController: 98%

This proves the god class structure is the problem — smaller, focused modules can be properly tested.

---

### 7. Remaining Empty Catch Block

**Severity:** 🟡 HIGH

One empty catch block remains, silently swallowing errors:

**CanvasEvents.js:182:**
```javascript
try {
    cm.handleResize( point, e );
} catch ( error ) {
}  // Error is silently discarded
```

This masks bugs and makes debugging extremely difficult when resize operations fail.

---

## 🟡 High Priority Issues

### 8. Console Logging in Production Code

**Files affected:** LayersEditor.js, UIManager.js, StateManager.js

While most console statements are now behind comments or `mw.log`, there are still fallback `console.warn` calls that can expose debugging information in production:

```javascript
// LayersEditor.js:48-49
if ( typeof console !== 'undefined' && console.warn ) {
    console.warn( '[LayersEditor]', errorMsg );
}
```

This should be behind a debug flag or removed entirely for production.

---

### 9. State Management: Incomplete Migration to StateManager

StateManager.js exists (652 lines, 85% coverage) with good patterns:
- Atomic operations with locking
- Subscription pattern for reactive updates
- Layer CRUD operations

**However, components bypass it:**

| Component | Bypasses StateManager |
|-----------|----------------------|
| CanvasManager | Maintains own `selectedLayerIds`, `currentTool`, `zoom`, `pan` |
| Toolbar | Direct canvas manipulation in some cases |
| LayerPanel | Sometimes calls canvas directly instead of StateManager |

This leads to potential state inconsistencies where the UI and canvas are out of sync.

---

### 10. PHP Code Style Warnings

Running `npm run test:php` produces **11 warnings** in test files:
- Comments formatting issues (SpaceBeforeSingleLineComment)
- Line length warnings (Generic.Files.LineLength)
- assertEmpty usage warnings (PHPUnit assertions)

Source files (`src/`) are clean with 0 errors and 0 warnings.

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
   All database operations use prepared statements via MediaWiki's database abstraction.

---

### Extracted Controllers (Excellent Pattern)

The six extracted canvas controllers are **examples of how the codebase should look**:

| Controller | Lines | Coverage | Quality |
|------------|-------|----------|---------|
| ZoomPanController | 343 | 97% | Excellent |
| GridRulersController | 385 | 97% | Excellent |
| TransformController | 1,027 | 100% | Excellent |
| HitTestController | 382 | 98% | Excellent |
| DrawingController | 620 | 97% | Excellent |
| ClipboardController | 222 | 98% | Excellent |

These prove that focused, single-responsibility modules can achieve excellent test coverage. The remaining CanvasManager code should be decomposed following this pattern.

---

### Test Infrastructure

- **1,235 tests passing**
- **Jest configuration** well set up with mocks and setup files
- **Integration tests** exist for save/load workflow
- **Good test organization** in tests/jest/

---

### Documentation

- `.github/copilot-instructions.md`: Comprehensive 500+ line contributor guide
- `docs/ACCESSIBILITY.md`: Honest about canvas limitations
- `docs/MODULAR_ARCHITECTURE.md`: Now accurately reflects current state
- API contracts well-documented

---

## Codebase Statistics

| Metric | Value | Assessment |
|--------|-------|------------|
| JavaScript files (editor) | 36+ files | Fragmented |
| Total JS lines (editor) | ~26,751 | High complexity |
| Largest JS file | 3,523 lines | 🔴 God class |
| Second largest JS file | 1,762 lines | 🟡 Large |
| PHP source files | 15 files | Reasonable |
| Largest PHP file | 2,018 lines | 🔴 God class |
| Jest tests | 1,235 | Good count |
| Jest statement coverage | 54.78% | Misleading (inflated) |
| Core module coverage | 14-24% | 🔴 Dangerous |
| ESLint errors | 0 | ✅ Clean |
| PHP source errors | 0 | ✅ Clean |
| Window.* exports | 51 unique | 🔴 Excessive |
| Empty catch blocks | 1 remaining | 🟡 Needs fix |
| Event systems | 5 overlapping | 🔴 Architectural debt |

---

## Recommendations

### Immediate Actions (Before Any Production Use at Scale)

1. **Fix the empty catch block** in CanvasEvents.js:182 — add proper error handling
2. **Increase LayersEditor.js coverage** to at least 50% — it's the main orchestrator
3. **Remove or guard console.warn fallbacks** in production paths

### Short-Term (Next 2-4 Weeks)

1. **Continue CanvasManager decomposition** — target reducing to <1,000 lines
2. **Consolidate event systems** — pick one pattern and migrate
3. **Extract common logic from WikitextHooks.php** — create a `LayersHtmlInjector` class

### Medium-Term (Next 2-3 Months)

1. **Migrate to ES modules** — start with utility classes that have no dependencies
2. **Implement dirty region rendering** — or at least layer caching
3. **Complete StateManager migration** — remove bypasses in CanvasManager/Toolbar

### Long-Term

1. **Consider TypeScript** for new code — improves type safety and IDE support
2. **Implement canvas accessibility workarounds** — screen-reader-only layer descriptions
3. **Add E2E tests** — Playwright or similar for full workflow testing

---

## Conclusion

The Layers extension has a **functional core** with **solid backend security**, but the **frontend architecture is a liability**. The god classes (CanvasManager.js, WikitextHooks.php) and the IIFE global pattern create:

- **High risk of regressions** on any change
- **Low testability** of critical paths
- **Onboarding difficulty** for new contributors
- **Performance ceiling** that will be hit with complex use cases

The extracted controllers prove that proper decomposition is achievable and leads to excellent test coverage. The recommendation is to **continue this pattern aggressively** before adding new features.

**The extension works for simple annotation tasks today, but scaling to production use with many users will expose these architectural weaknesses.**

---

*Review performed by GitHub Copilot using Claude Opus 4.5 (Preview) on November 29, 2025*
