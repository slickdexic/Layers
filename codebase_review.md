# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 9, 2025  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural and Security Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. This review reveals a project with **significant technical debt** that, despite having a substantial test suite (3,437 tests), suffers from fundamental architectural problems and an unresolved rendering bug that impede maintainability and user experience.

### Overall Assessment: 5/10

**Strengths:**
- ✅ Strong server-side security (PHP validation, CSRF, rate limiting)
- ✅ Good Jest test suite (3,437 tests passing)
- ✅ Good documentation (architecture docs, copilot-instructions)
- ✅ Proper logging patterns (uses `mw.log.*` instead of `console.*`)
- ✅ 32 ES6 class declarations (up from 23)
- ✅ ESLint passing
- ✅ Safe DOM manipulation (textContent over innerHTML)

**Critical Weaknesses:**
- ❌ **CRITICAL BUG: Stroke shadow renders over fill** - documented fix never applied
- ❌ **God class problem** - 8 files over 1,000 lines (CanvasManager.js at 2,027 lines)
- ❌ **Massive bundle size** - **1.06MB** of JavaScript (1,059,962 bytes)
- ❌ **123 global `window.X` exports** - severe namespace pollution
- ❌ **680 prototype methods** vs only 32 ES6 classes (4.5% modernization)
- ❌ **Memory leak risks** - 106 `addEventListener` calls with only 31 `removeEventListener`
- ❌ **Test coverage failing** - function coverage at 79.46% (target: 80%)
- ❌ **Major modules with 0% coverage** (EventManager, AccessibilityAnnouncer, MessageHelper)

**For the detailed, prioritized improvement plan, see [`improvement_plan.md`](./improvement_plan.md)**

---

## Verified Metrics (December 9, 2025)

### JavaScript Codebase

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total JS files | ~60 | - | - |
| Total JS lines | **34,547** | - | - |
| Total JS bytes | **1,059,962** (1.06MB) | <400KB | 🔴 **165% over target** |
| Files > 1,000 lines | **8** | 0 | 🔴 God classes |
| Files > 500 lines | **18** | 5 | 🔴 Needs decomposition |
| Global `window.X =` exports | **123** | 0 | 🔴 Namespace pollution |
| Prototype methods | **680** | 0 | 🔴 Legacy pattern |
| ES6 `class` declarations | **32** | 680+ | 🟠 **4.5% modernization** |
| `console.log/error` in prod | **0** | 0 | 🟢 Clean |
| ESLint errors | **0** | 0 | 🟢 Passing |

### God Classes (Files > 1,000 Lines)

| File | Lines | Methods | Severity |
|------|-------|---------|----------|
| CanvasManager.js | **2,027** | ~100+ | 🔴 CRITICAL |
| LayerRenderer.js | **1,958** | ~60 | 🔴 Shared engine - complex |
| LayerPanel.js | **1,555** | ~90+ | 🔴 Needs decomposition |
| SelectionManager.js | **1,261** | ~35 | 🟠 Recently refactored |
| LayersEditor.js | **1,231** | ~50 | 🟠 Entry point |
| TransformController.js | **1,231** | ~40 | 🟠 Complex transforms |
| ToolManager.js | **1,154** | ~40 | 🔴 Needs decomposition |
| LayersValidator.js | **953** | ~30 | 🟡 Close to threshold |

### Memory Leak Risk Indicators

| Pattern | Add Count | Remove Count | **Imbalance** |
|---------|-----------|--------------|---------------|
| addEventListener | **106** | 31 | **75 potential leaks** |

**Issue:** The severe imbalance in event listener management suggests memory leaks in long-running editor sessions. `EventTracker.js` exists but is not consistently used across all modules.

### Test Coverage (December 9, 2025)

| Category | Value | Target | Status |
|----------|-------|--------|--------|
| Jest tests passing | **3,437** | - | 🟢 Good |
| Jest test suites | **76** | - | 🟢 Good |
| Statement coverage | **~84%** | 80% | 🟢 Met |
| Branch coverage | **~69%** | 65% | 🟢 Met |
| Line coverage | **~84%** | 80% | 🟢 Met |
| **Function coverage** | **79.46%** | 80% | 🔴 Below threshold |

### Modules with Critical Coverage Gaps

| Module | Lines | Coverage | Risk |
|--------|-------|----------|------|
| EventManager.js | 126 | **0%** | 🔴 Event system untested |
| AccessibilityAnnouncer.js | 223 | **0%** | 🔴 A11y untested |
| LayersConstants.js | 331 | **0%** | 🟡 Constants file |
| MessageHelper.js | 168 | **0%** | 🔴 Messaging untested |
| compat.js | 35 | **0%** | 🟡 Low risk |
| APIManager.js | 921 | **27%** | 🔴 Critical API layer at 1/4 coverage |
| ErrorHandler.js | 576 | **57%** | 🟠 Error handling gaps |
| SelectionManager.js | 1,261 | **68%** | 🟠 Core selection logic |

---

## Critical Issues (Must Fix)

### 1. 🔴 CRITICAL BUG: Stroke Shadow Renders Over Fill

**Severity:** CRITICAL - User-visible rendering bug

**Problem:** When a shape has both a stroke and fill with shadows enabled, the stroke shadow renders ON TOP OF the fill instead of behind it. This causes:
- Visible shadow artifacts inside shapes with opaque fill
- Incorrect visual appearance when fill opacity is 100%
- The shadow should only be visible outside the shape's bounds

**Location:** `resources/ext.layers.shared/LayerRenderer.js` lines 630-680

**Root Cause:** In the no-spread shadow case (`spread === 0`), the code comment says:
```javascript
// We do NOT clear shadow between fill and stroke - both should cast shadows.
// The shadow will be drawn with each operation, but they overlap so visually it's correct.
```

This is **incorrect**. When `stroke()` is called after `fill()` with shadow enabled, the stroke's shadow renders AFTER (on top of) the already-drawn fill.

**Evidence:** A fix document exists at `docs/archive/BUG_SHADOW_FILL_OVERLAP_2025-12-09.md` describing the solution using `destination-over` composite mode, but **the fix was never actually applied to the codebase**.

The fix pattern documented but NOT implemented:
```javascript
// 1. Apply shadow → Draw fill (fill + fill shadow rendered)
// 2. Clear shadow → Draw stroke (stroke only, no shadow yet)
// 3. Use destination-over → Draw stroke with shadow (shadow goes BEHIND everything)
this.ctx.globalCompositeOperation = 'destination-over';
```

A grep for `destination-over` in LayerRenderer.js returns **0 matches** - confirming the fix was never applied.

**Affected Shapes:** Rectangle, Circle, Ellipse, Polygon, Star - all use the same flawed pattern.

**Impact:** User-facing visual bug affecting all shadowed shapes with both fill and stroke.

---

### 2. 🔴 God Class: CanvasManager.js (2,027 lines)

**Severity:** BLOCKER for maintainability

CanvasManager is a textbook "God Object" anti-pattern with **100+ prototype methods** handling 15+ distinct concerns:

- Canvas initialization and setup
- Coordinate transformations  
- Selection handle management
- Drag/resize/rotate operations
- Style management
- Grid and ruler rendering
- Zoom and pan
- Layer operations (add, remove, duplicate)
- Event handling
- Rendering coordination
- History integration
- Text input modal management
- Marquee selection
- Background image loading

**Impact:**
- Any modification carries high regression risk
- New developers cannot understand the file without significant study
- Testing is extremely difficult due to tight coupling
- Cannot be properly typed for TypeScript migration

**Note:** 9 controllers have been extracted to `canvas/` directory, but CanvasManager still contains too much logic. It should be a thin facade (<500 lines) that delegates to controllers.

---

### 3. 🔴 Massive Bundle Size (1.06MB)

**Severity:** HIGH - Performance impact

The JavaScript bundle is **1,059,962 bytes (1.06MB) unminified**. For comparison:
- Target: <400KB
- Current: 165% over target
- Similar tools (Excalidraw): ~280KB minified

**Causes:**
- No code splitting (viewer loads full editor code)
- No lazy loading of dialogs or modals
- 18 files over 500 lines
- All globals loaded regardless of actual usage
- 34,547 total lines of JavaScript

---

### 4. 🔴 Memory Leak Risk (75 Unmatched Event Listeners)

**Severity:** HIGH - Runtime stability issues

Analysis shows **106 `addEventListener` calls but only 31 `removeEventListener`** calls. This 75-event imbalance suggests memory leaks in long editor sessions.

**Note:** `EventTracker.js` exists for proper cleanup but is **not consistently used** across all modules. Some modules (Toolbar, LayerPanel, CanvasEvents) use it correctly; others don't.

---

### 5. 🔴 Global Namespace Pollution (123 Exports)

**Severity:** HIGH - Blocks modernization

Despite having `LayersNamespace.js` that creates a `window.Layers.*` namespace system, **every file still exports directly to `window.*`**:

```javascript
// Current pattern in every module:
window.Layers.Canvas.Manager = CanvasManager;  // Namespace (good)
window.CanvasManager = CanvasManager;          // Still pollutes global (bad)
```

**Impact:**
- **Blocks ES modules** - Cannot use `import`/`export` until resolved
- **Blocks tree-shaking** - All 1.06MB loads regardless of what's used
- **Namespace collision risk** - Other extensions may conflict

---

### 6. 🔴 Legacy Prototype Pattern (680 Methods)

**Severity:** HIGH - Technical debt

The codebase has **680 prototype-based methods** but only **32 ES6 class declarations**. This is a **4.5% ES6 adoption rate**.

```javascript
// Legacy pattern (680 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (only 32 classes):
class APIManager {
    addLayer( layer ) { ... }
}
```

**Impact:**
- IDE navigation/autocomplete degraded
- Inconsistent coding patterns confuse contributors
- Cannot use private fields, getters/setters naturally
- Future TypeScript migration will be painful

---

### 7. 🔴 Function Coverage Below Threshold

**Severity:** MEDIUM-HIGH - CI failing

Function coverage is at **79.46%**, failing the 80% threshold. Critical gaps:

| Module | Coverage | Issue |
|--------|----------|-------|
| EventManager.js | 0% | Core event system completely untested |
| AccessibilityAnnouncer.js | 0% | Accessibility features untested |
| MessageHelper.js | 0% | User messaging untested |
| APIManager.js | 27% | Only 1/4 of API code tested |
| ErrorHandler.js | 57% | Error handling partially tested |

---

## Medium Issues

### 8. 🟠 LayerRenderer.js Complexity (1,958 lines)

While this is a shared rendering engine, its size makes it difficult to:
- Add new shape types
- Fix rendering bugs (like the shadow issue above)
- Test comprehensively

Consider extracting shape-specific renderers (RectangleRenderer, CircleRenderer, etc.).

### 9. 🟠 Dual Validation Systems

The codebase has **two separate validation systems** that must be kept in sync:

| System | File | Lines |
|--------|------|-------|
| Client-side | LayersValidator.js | 953 |
| Server-side | ServerSideLayerValidator.php | 589 |

Any validation rule change must be made in both places, creating maintenance burden.

### 10. 🟠 Inconsistent Error Handling

`CanvasEvents.js` silently swallows errors instead of propagating to `ErrorHandler`:
```javascript
try {
    tc.handleResize( point, e );
} catch ( error ) {
    if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
        mw.log.error( '[CanvasEvents] handleResize error:', error.message || error );
    }
    // Error swallowed - not propagated to ErrorHandler
}
```

### 11. 🟠 No Canvas Pooling for Shadow Rendering

In `LayerRenderer.js`, `drawSpreadShadow()` and `drawSpreadShadowStroke()` create new temporary canvases on every call:
```javascript
const tempCanvas = document.createElement( 'canvas' );
```

This is not pooled, unlike the main canvas pool. For shapes with spread shadows, this creates garbage collection pressure.

---

## What's Working Well

### ✅ Server-Side Security (8/10)

The PHP backend demonstrates excellent security practices:
- **CSRF tokens** required on all write operations
- **Rate limiting** via MediaWiki's `pingLimiter`
- **Strict property whitelist** with 45+ validated fields
- **Type/range validation** on all numeric fields
- **Text sanitization** (HTML stripped, protocol checks)
- **Parameterized SQL** (no injection vulnerabilities)

### ✅ Test Suite Size

**3,437 Jest tests passing** across 76 test suites is impressive. Key well-tested modules:
- TransformationEngine.js: 97.2%
- CanvasUtilities.js: 100%
- StyleController.js: 100%
- DrawingController.js: 100%
- InteractionController.js: 100%
- HitTestController.js: 98.36%

### ✅ Controller Extraction Pattern

The extraction of controllers from CanvasManager to `canvas/` directory shows good refactoring direction:
- ZoomPanController.js (97% coverage)
- GridRulersController.js (94% coverage)
- TransformController.js (86% coverage)
- HitTestController.js (98% coverage)
- DrawingController.js (100% coverage)
- ClipboardController.js (98% coverage)
- RenderCoordinator.js (93% coverage)
- InteractionController.js (100% coverage)
- TextInputController.js (86% coverage)

### ✅ Documentation

- `copilot-instructions.md` is comprehensive and accurate
- `docs/ARCHITECTURE.md` explains module structure
- `docs/ACCESSIBILITY.md` documents WCAG efforts
- API contracts well documented

---

## Technical Debt Summary

| Debt Type | Count | Est. Fix Time |
|-----------|-------|---------------|
| Shadow rendering bug | 1 critical bug | 2-3 days |
| Function coverage to 80% | ~0.54% gap | 2-3 days |
| God classes (>1,000 lines) | 8 files | 4-6 weeks |
| Files >500 lines needing split | 18 files | 3-4 weeks |
| Global window.X elimination | 123 exports | 1-2 weeks |
| Prototype→class migration | 680 methods | 3-4 weeks |
| Memory leak fixes | ~75 listeners | 1 week |
| Test coverage gaps (0% modules) | 5 modules | 1-2 weeks |

**Total estimated refactoring: 14-18 weeks**

---

## Recommendations Priority

### P0 - Critical (This Week)

1. **Fix stroke shadow over fill bug** - User-visible rendering issue, documented solution exists
2. **Raise function coverage to 80%** - CI is failing
3. **Add tests for 0% coverage modules** - EventManager, AccessibilityAnnouncer, MessageHelper

### P1 - High (Next 2-4 Weeks)

1. **Improve APIManager.js coverage** (27% → 70%+)
2. **Fix memory leaks** - Ensure EventTracker used consistently
3. **Split CanvasManager.js** - Extract remaining logic to controllers

### P2 - Medium (1-2 Months)

1. **Bundle size reduction** to <500KB via code splitting
2. **Eliminate duplicate global exports** - Keep only `window.Layers.*`
3. **ES6 class conversion pilot** for 10 more files

### P3 - Long Term

1. **Complete ES6 class migration**
2. **TypeScript migration** (after ES6 complete)
3. **ES modules with tree-shaking**

---

## Conclusion

The Layers extension is **functional but architecturally compromised** with a critical user-facing bug. The immediate priorities are:

1. **Fix the shadow rendering bug** - This is a documented defect where the fix was never applied
2. **Meet test coverage thresholds** - CI is currently failing
3. **Address memory leaks** - Long sessions will have issues

The path forward requires **immediate bug fixes** followed by **systematic refactoring**.

**The shadow rendering bug is the most urgent issue - it's a user-visible defect with a documented solution that was never implemented.**

See [`improvement_plan.md`](./improvement_plan.md) for the detailed, prioritized action plan.

---

## Verification Commands

Run these to verify current metrics:

```bash
# Bundle size (bytes)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c

# God classes (>1000 lines)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | sort -rn | head -20

# Global exports
grep -rE "window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Prototype methods
grep -r "\.prototype\." resources --include="*.js" | wc -l

# ES6 classes
grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l

# Event listener imbalance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Test coverage
npm run test:js -- --coverage

# Lint check
npm test
```

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 9, 2025*
