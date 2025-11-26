# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** November 25, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis

---

## Executive Summary

The "Layers" extension is a complex MediaWiki extension for non-destructive image annotation. While the backend (PHP) demonstrates solid architecture with proper security measures, the frontend (JavaScript) suffers from significant technical debt, maintainability issues, and inconsistent patterns. The test coverage is inadequate, and the codebase shows signs of rapid development without sufficient refactoring.

**Verdict:** The extension is functional but requires substantial refactoring before it can be considered production-ready for enterprise deployments.

### Overall Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 5/10 | 🟠 | Backend: solid DI pattern. Frontend: monolithic, fragmented |
| Code Quality | 4/10 | 🔴 | PHP: Good. JS: Inconsistent, massive files, code smell |
| Security | 7/10 | 🟢 | Backend well-secured; some frontend concerns |
| Performance | 5/10 | 🟠 | API pagination exists; frontend renders inefficiently |
| Accessibility | 4/10 | 🔴 | Some ARIA present but incomplete, keyboard gaps |
| Documentation | 6/10 | 🟡 | copilot-instructions.md is excellent; inline docs patchy |
| Testing | 3/10 | 🔴 | PHP unit tests exist but limited; JS tests incomplete |
| Error Handling | 6/10 | 🟡 | Backend good; frontend inconsistent |
| Maintainability | 3/10 | 🔴 | CanvasManager (3,864 lines) is a red flag |

**Overall Score: 4.8/10** — Functional prototype, but needs significant engineering investment.

---

## 🔴 Critical Issues (Blockers)

### 1. Frontend Monolith: `CanvasManager.js` (3,864 lines)

**Location:** `resources/ext.layers.editor/CanvasManager.js`

**Problem:** This single file handles:
- Canvas initialization and sizing
- Background image loading
- Event handling (mouse, touch, keyboard)
- All shape rendering (rectangles, circles, polygons, arrows, text, etc.)
- Resize/rotate/drag operations for all layer types
- Selection management
- Zoom and pan
- Grid and rulers
- History/undo system
- Canvas pooling

**Impact:**
- **Unmaintainable:** No engineer can safely modify this without extensive testing
- **Duplicated logic:** Rendering code exists here AND in `CanvasRenderer.js`, `RenderingCore.js`
- **Hard to test:** Tightly coupled responsibilities make unit testing nearly impossible
- **Performance:** No dirty-region optimization actually used despite properties being defined

**Evidence:**
```javascript
// Line 1: 3,864 lines in one file
CanvasManager.prototype.calculateRectangleResize = function(...) // 150+ lines
CanvasManager.prototype.calculateCircleResize = function(...) // Similar complexity for each shape
```

**Fix:** Extract into modules: `CanvasRenderer.js`, `CanvasEventHandler.js`, `ResizeController.js`, `ZoomPanController.js`, `GridRulersController.js`, per-shape resize handlers.

---

### 2. Inconsistent State Management

**Problem:** The codebase has multiple competing patterns:
- `StateManager.js` exists with proper reactive state
- `LayersEditor.js` defines `Object.defineProperty` bridge for `this.layers`
- `CanvasManager.js` maintains its own selection state (`selectedLayerId`, `selectedLayerIds`)
- `LayerPanel.js` maintains `this.layers` and `this.selectedLayerId` separately
- Zustand (`store.js`) is a dependency but appears unused

**Evidence:**
```javascript
// LayersEditor.js - defines property accessor
Object.defineProperty(this, 'layers', {
    get: function() { return this.stateManager.getLayers(); },
    set: function(layers) { this.stateManager.set('layers', layers); }
});

// LayerPanel.js - maintains separate state
this.layers = [];
this.selectedLayerId = null;

// CanvasManager.js - yet another state copy
this.selectedLayerId = null;
this.selectedLayerIds = [];
```

**Impact:** State synchronization bugs, data inconsistency, debugging nightmares.

**Fix:** Consolidate on `StateManager.js`, remove all local state copies, use proper subscriptions.

---

### 3. Test Coverage Inadequate

**PHPUnit Tests:**
- `tests/phpunit/unit/` has some structure but coverage is unclear
- `tests/LayersTest.php` is a smoke test that uses `MediaWikiServices::getInstance()->getService('LayersDatabase')` - this is good, but:
  - Only tests existence of methods/classes, not actual functionality
  - No integration tests for API endpoints
  - No tests for validation edge cases

**Jest Tests:**
- 15 test files exist in `tests/jest/`
- But `eslintIgnore` includes `"tests/jest/**"` - tests aren't even linted!
- Tests use mocks but don't test actual rendering behavior

**Missing Test Coverage:**
- API endpoint integration tests
- Validation boundary tests (max layers, max size, XSS attempts)
- Canvas rendering regression tests
- Event handler interaction tests

---

### 4. Duplicated Code Across Files

**Evidence:**

1. **Rendering Logic:**
   - `CanvasManager.js` has `renderLayers()`, shape drawing
   - `CanvasRenderer.js` also has rendering logic
   - `RenderingCore.js` - more rendering code

2. **Event Handling:**
   - `CanvasManager.js` has `setupEventHandlers()`
   - `CanvasEvents.js` has event handling
   - `EventHandler.js` - more event code
   - `EventManager.js` - yet more

3. **Selection Logic:**
   - `SelectionManager.js` exists
   - `CanvasManager.js` has `hitTestSelectionHandles()`, selection state
   - `LayerPanel.js` has selection management

**Impact:** Bugs fixed in one place may not be fixed in duplicates. Confusion about which module owns what.

---

## 🟠 Serious Issues (High Priority)

### 5. LayerPanel.js Complexity (1,200+ lines)

**Problems:**
- Creates DOM programmatically without template system
- Color picker dialog is 200+ lines embedded in `createPropertiesForm()`
- No componentization - everything inline
- Accessibility partially implemented but incomplete

**Evidence:**
```javascript
// 200+ lines just for the color picker
var createColorPickerDialog = function() {
    var buttonRect = colorButton.getBoundingClientRect();
    // ... 200 more lines
};
```

---

### 6. Missing TypeScript / JSDoc Types

**Problem:** No type safety anywhere in frontend code. 

**Evidence:**
```javascript
// No type info - what is config? What properties are required?
function CanvasManager(config) {
    this.config = config || {};
    this.container = this.config.container;
    // ...
}
```

**Impact:** Runtime errors that could be caught at build time, poor IDE support, documentation gaps.

---

### 7. Inconsistent Error Handling in Frontend

**Evidence:**
```javascript
// Some places use try-catch with logging
try {
    // code
} catch (error) {
    if (this.debug) { this.errorLog('Error:', error); }
}

// Other places silently swallow errors
} catch (_err) {
    // Ignore cleanup errors to avoid cascading failures
}

// Some use mw.notify for user feedback, some don't
```

---

### 8. Event Listener Cleanup Incomplete

**Problem:** While `LayerPanel.js` has proper listener tracking, `CanvasManager.js` and others don't consistently clean up.

**Evidence:**
```javascript
// LayerPanel.js - good pattern
this.addDocumentListener(event, handler, options);
this.removeDocumentListeners(); // cleanup exists

// CanvasManager.js - events instance handles some, but...
CanvasManager.prototype.setupEventHandlers = function() {
    if (typeof CanvasEvents !== 'undefined') {
        this.events = new CanvasEvents(this);
        return;
    }
    // What happens if CanvasEvents not found? No fallback cleanup!
};
```

---

### 9. Security: Client-Side Validation Alone is Insufficient

**Good:** Server-side `ServerSideLayerValidator.php` has comprehensive validation.

**Concern:** `LayersValidator.js` (client-side) duplicates some logic but:
- Could be bypassed by direct API calls
- Text sanitization in `sanitizeText()` may differ from server
- No CSP headers configured

---

## 🟡 Moderate Issues (Medium Priority)

### 10. Configuration Inconsistency

**extension.json version:** `0.8.1-dev`
**Multiple MD files reference:** `0.8.2-dev` or other versions

---

### 11. Deprecated Patterns

**Evidence:**
```javascript
// Using IIFE pattern throughout - works but outdated
(function() {
    'use strict';
    // ...
    window.LayerPanel = LayerPanel;
}());
```

Modern ES modules would be cleaner and enable tree-shaking.

---

### 12. Magic Numbers Throughout

**Evidence:**
```javascript
// CanvasManager.js
this.maxPoolSize = 5;
this.maxHistorySteps = 50;
var maxDelta = 1000; // "Reasonable maximum delta"

// LayerPanel.js
var maxLength = 100; // name length
var minListHeight = 60;
var minPropsHeight = 80;
```

These should be in `LayersConstants.js` or configurable.

---

### 13. Commented Debug Code

**Evidence:** Multiple files have commented `console.log` statements:
```javascript
// console.log('Layers: Canvas found/created:', this.canvas);
// console.log('Layers: Context:', this.ctx);
```

Should be removed or converted to proper debug logging.

---

## 🟢 Positive Aspects

### What's Working Well

1. **Backend Architecture:**
   - Clean DI with `services.php`
   - Proper use of MediaWiki services pattern
   - `LayersDatabase.php` has retry logic, caching, proper transactions
   - `ServerSideLayerValidator.php` has comprehensive property whitelist

2. **Security:**
   - CSRF token enforcement
   - Rate limiting via `RateLimiter.php`
   - XSS prevention in text sanitization
   - Generic error messages to prevent info disclosure

3. **Documentation:**
   - `.github/copilot-instructions.md` is excellent - comprehensive API contracts, security notes
   - Clear i18n message patterns

4. **Some Good Patterns:**
   - `ModuleRegistry.js` for dependency injection
   - `LayerPanel.js` listener tracking pattern
   - Accessible color picker dialog (focus trap, ARIA)

---

## Recommendations

See **`improvement_plan.md`** for detailed prioritized action items.

### Quick Wins (1-2 days each)
1. Remove commented debug code
2. Consolidate magic numbers into constants
3. Fix version inconsistencies
4. Enable ESLint on test files

### Medium Effort (1-2 weeks each)
1. Extract `CanvasManager.js` into modules
2. Consolidate state management
3. Add integration tests for API endpoints

### Major Refactoring (1+ month)
1. Consider TypeScript migration
2. Replace IIFE with ES modules
3. Full accessibility audit and fixes

---

## Appendix: File Size Analysis

| File | Lines | Assessment |
|------|-------|------------|
| CanvasManager.js | 3,864 | 🔴 Critical - must split |
| LayerPanel.js | 1,284 | 🟠 Large - consider splitting |
| LayersEditor.js | 1,065 | 🟡 Acceptable |
| Toolbar.js | 1,200+ | 🟠 Large - consider splitting |
| ServerSideLayerValidator.php | 530 | 🟢 Good |
| LayersDatabase.php | 370 | 🟢 Good |
| ApiLayersSave.php | 310 | 🟢 Good |
