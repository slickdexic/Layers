# Refactoring Playbook: Best Practices Guide

**Purpose:** Comprehensive guide for maintaining code quality and managing file size in the Layers extension  
**Audience:** Contributors, maintainers, and future refactoring efforts  
**Status:** Living document based on Phase 1 learnings (January 2026)

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [When to Refactor](#when-to-refactor)
3. [The Controller Extraction Pattern](#the-controller-extraction-pattern)
4. [Removing Fallback Code](#removing-fallback-code)
5. [Testing Strategy](#testing-strategy)
6. [File Organization](#file-organization)
7. [Common Pitfalls](#common-pitfalls)
8. [Case Studies](#case-studies)

---

## Quick Reference

### File Size Limits

| Threshold | Status | Action |
|-----------|--------|--------|
| <500 lines | ✅ Ideal | No action needed |
| 500-800 lines | ✅ Good | Monitor for growth |
| 800-1,000 lines | ⚠️ Warning | Plan extraction before hitting 1,000 |
| 1,000-2,000 lines | 🟡 God Class | Must not grow; extract before adding |
| >2,000 lines | 🔴 Policy Violation | Immediate action required |

### The 1-for-1 Rule

**For every 50 lines you add to a god class, extract 50 lines first.**

This maintains zero net growth while paying down technical debt.

### Enforcement

- **CI checks** block PRs that grow god classes or create new ones
- **scripts/enforce-file-size-limits.sh** runs in GitHub Actions
- **Pre-commit hook** available in `scripts/` directory

---

## When to Refactor

### Triggers

1. **File approaching 1,000 lines** — Extract before crossing threshold
2. **Adding features to god class** — Extract first, then add
3. **Code duplication detected** — Consolidate via extraction
4. **Merge conflicts frequent** — File too large, needs splitting
5. **Review feedback: "hard to review"** — File too complex

### Don't Refactor When

- ❌ File is <800 lines and well-structured
- ❌ No clear extraction candidates exist
- ❌ Breaking changes would harm architecture
- ❌ Just to hit arbitrary line counts

**Rule:** Only refactor when it improves code quality, not just to reduce lines.

---

## The Controller Extraction Pattern

### Overview

The **controller extraction pattern** separates concerns by moving cohesive functionality into dedicated controller classes. The parent class becomes a facade that delegates to controllers.

### Pattern Structure

**Before: God Class**
```javascript
class LayerPanel {
    constructor(config) {
        this.editor = config.editor;
        this.container = config.container;
        // 50+ property initializations...
    }

    // 200 lines of background layer logic
    updateBackgroundOpacity(opacity) { /* ... */ }
    toggleBackgroundVisibility() { /* ... */ }
    createBackgroundLayerItem() { /* ... */ }
    
    // 150 lines of drag/drop logic
    startDrag(layerId) { /* ... */ }
    handleDrag(event) { /* ... */ }
    finishDrag() { /* ... */ }
    
    // 180 lines of rendering logic
    renderLayerList() { /* ... */ }
    createLayerItem(layer) { /* ... */ }
    updateLayerItem(layerId) { /* ... */ }
    
    // ...50 more methods...
}
```

**After: Facade + Controllers**
```javascript
// LayerPanel.js (facade)
class LayerPanel {
    constructor(config) {
        this.editor = config.editor;
        this.container = config.container;
        
        // Initialize controllers
        this.backgroundLayerController = new BackgroundLayerController({
            editor: this.editor,
            layerList: this.layerList
        });
        
        this.dragDropController = new LayerDragDrop({
            editor: this.editor,
            layerList: this.layerList
        });
        
        this.listRenderer = new LayerListRenderer({
            editor: this.editor,
            layerList: this.layerList
        });
    }

    // Thin delegation methods
    updateBackgroundOpacity(opacity) {
        if (this.backgroundLayerController) {
            this.backgroundLayerController.setBackgroundOpacity(opacity);
        }
    }
    
    startDrag(layerId) {
        if (this.dragDropController) {
            this.dragDropController.startDrag(layerId);
        }
    }
    
    renderLayerList() {
        if (this.listRenderer) {
            this.listRenderer.render();
        }
    }
}

// BackgroundLayerController.js
class BackgroundLayerController {
    constructor(config) {
        this.editor = config.editor;
        this.layerList = config.layerList;
    }
    
    setBackgroundOpacity(opacity) {
        // 50 lines of background opacity logic
    }
    
    toggleBackgroundVisibility() {
        // 40 lines of visibility toggle logic
    }
    
    createBackgroundLayerItem() {
        // 60 lines of UI creation logic
    }
}

// LayerDragDrop.js
class LayerDragDrop {
    // 150 lines of drag/drop logic
}

// LayerListRenderer.js
class LayerListRenderer {
    // 180 lines of rendering logic
}
```

### Benefits

✅ **Single Responsibility** — Each controller has one clear purpose  
✅ **Testability** — Controllers can be tested in isolation  
✅ **Maintainability** — Changes localized to relevant controller  
✅ **Reusability** — Controllers can be used by multiple parents  
✅ **File Size** — Parent facade stays small with delegation methods

---

## Removing Fallback Code

### The Fallback Anti-Pattern

**Problem:** Defensive programming that duplicates controller logic

```javascript
// ANTI-PATTERN: Delegate OR fallback
if (this.controller) {
    this.controller.doWork();  // Production path
} else {
    // 50-100 lines of fallback code duplicating controller logic
    // This code NEVER runs in production (controller always loads)
    // But it must be maintained, tested, and adds to file size
}
```

**Why fallbacks exist:**
- Test environments without full controller loading
- Historical: before ResourceLoader dependency guarantees
- Defensive programming (\"what if controller doesn't load?\")

**Why they're technical debt:**
- Controller loading is **guaranteed** via `extension.json` in production
- Fallback code duplicates controller implementation
- Must maintain two code paths for same functionality
- Adds 50-200 lines per controller to god classes
- Never executes in production (dead code)

### The Solution: Strict Delegation

**Pattern: Fail fast with error logging**

```javascript
// CORRECT: Strict delegation
if (!this.controller) {
    if (typeof mw !== 'undefined' && mw.log && mw.log.error) {
        mw.log.error('Controller not found');
    }
    return; // Fail fast
}
this.controller.doWork(); // Only path
```

**Benefits:**
- ✅ Single code path (controller only)
- ✅ Clear failure mode (error logged)
- ✅ No code duplication
- ✅ Smaller file size (50-200 lines saved per controller)

### Refactoring Steps

1. **Verify controller always loads**
   - Check `extension.json` for ResourceLoader dependencies
   - Confirm controller in same module or dependency

2. **Remove fallback implementation**
   ```javascript
   // Before
   if (controller) {
       controller.work();
   } else {
       // 50 lines of fallback
   }
   
   // After
   if (!controller) {
       mw.log.error('Controller not found');
       return;
   }
   controller.work();
   ```

3. **Update tests**
   - Skip tests that specifically test fallback code
   - Add clear comment explaining why skipped
   - Example:
     ```javascript
     // SKIP (2026-01-14): Test removed because fallback code was
     // removed during Phase 1 refactoring. Controller now guaranteed
     // to load via extension.json in production.
     test.skip('should use fallback when controller unavailable', () => {
         // ...
     });
     ```

4. **Verify no regressions**
   - Run full test suite
   - Check coverage maintains >90%
   - Verify production behavior unchanged

### Phase 1 Results

Removing fallback code from 2 files saved **630 lines**:

| File | Fallbacks Removed | Lines Saved |
|------|-------------------|-------------|
| LayerPanel.js | BackgroundLayerController, LayerListRenderer, LayerDragDrop, ConfirmDialog | 426 lines |
| CanvasManager.js | CanvasEvents, ImageLoader, StyleController | 204 lines |

---

## Testing Strategy

### Test Philosophy

**Principle:** Test what the code does, not what it used to do.

When removing fallback code:
- ✅ **Skip tests** that specifically test fallback behavior
- ✅ **Add comments** explaining why skipped
- ✅ **Keep tests** that test delegation (call forwarding)
- ✅ **Maintain coverage** target (>90% statement, >80% branch)

### Test Skipping Pattern

```javascript
describe('MyComponent', () => {
    test('should delegate to controller', () => {
        const mockController = { doWork: jest.fn() };
        component.controller = mockController;
        
        component.performAction();
        
        expect(mockController.doWork).toHaveBeenCalled();
    });
    
    // SKIP (2026-01-14): Test removed because fallback code was removed
    // during Phase 1 refactoring. MyComponent now strictly delegates to
    // MyController, which is guaranteed to load via extension.json.
    test.skip('should use fallback when controller unavailable', () => {
        component.controller = null;
        
        component.performAction();
        
        // This tested fallback logic that no longer exists
    });
});
```

### Mock Enhancement

When controllers are extracted, update test mocks:

```javascript
// Before: No controller mocks needed (fallback handles it)
beforeEach(() => {
    component = new MyComponent({ editor: mockEditor });
});

// After: Add controller mocks
beforeEach(() => {
    const MyController = require('./MyController.js');
    window.Layers.UI.MyController = MyController;
    
    component = new MyComponent({ editor: mockEditor });
});
```

### Coverage Guidelines

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| Statement | 85%+ | 90%+ | 95%+ |
| Branch | 75%+ | 80%+ | 85%+ |
| Function | 80%+ | 85%+ | 90%+ |
| Line | 85%+ | 90%+ | 95%+ |

**Phase 1 Results:** 94.53% statement, 83.16% branch (excellent)

---

## File Organization

### Directory Structure

```
resources/ext.layers.editor/
├── LayersEditor.js          # Main editor facade
├── CanvasManager.js         # Canvas operations facade
├── LayerPanel.js            # Layer list panel facade
├── Toolbar.js               # Toolbar facade
├── StateManager.js          # Centralized state
├── HistoryManager.js        # Undo/redo
├── canvas/                  # Canvas controllers
│   ├── ZoomPanController.js
│   ├── TransformController.js
│   ├── HitTestController.js
│   └── ...
├── ui/                      # UI controllers
│   ├── BackgroundLayerController.js
│   ├── LayerListRenderer.js
│   ├── LayerDragDrop.js
│   ├── ConfirmDialog.js
│   └── ...
└── tools/                   # Tool handlers
    ├── TextToolHandler.js
    ├── PathToolHandler.js
    └── ...
```

### Naming Conventions

**Controllers:** `[Feature]Controller.js`
- BackgroundLayerController.js
- ZoomPanController.js
- TransformController.js

**Renderers:** `[What]Renderer.js`
- LayerListRenderer.js
- SelectionRenderer.js
- ArrowRenderer.js

**Handlers:** `[Tool]Handler.js` or `[Action]Handler.js`
- TextToolHandler.js
- PathToolHandler.js
- ErrorHandler.js

**Utilities:** `[Purpose]Utils.js` or `[Purpose]Helper.js`
- GeometryUtils.js
- ColorUtils.js
- NamespaceHelper.js

### Module Registration

**Always register in `extension.json`:**

```json
{
    "ext.layers.editor": {
        "scripts": [
            "ext.layers.editor/LayersEditor.js",
            "ext.layers.editor/ui/BackgroundLayerController.js",
            "ext.layers.editor/ui/LayerListRenderer.js"
        ],
        "dependencies": [
            "ext.layers.shared"
        ]
    }
}
```

**Load order matters:** Dependencies must load before dependents.

---

## Common Pitfalls

### Pitfall 1: Over-Extraction

**Problem:** Creating too many tiny files

❌ **Bad:** 20-line controller file  
✅ **Good:** Combine related 20-line pieces into 100-line controller

**Rule:** Controllers should be 100-500 lines. Don't extract for extraction's sake.

### Pitfall 2: Breaking Encapsulation

**Problem:** Exposing internal state to facilitate extraction

❌ **Bad:**
```javascript
class BackgroundController {
    constructor(config) {
        this.panel = config.panel; // Tight coupling!
        this.panel.internalState = ...; // Modifying parent!
    }
}
```

✅ **Good:**
```javascript
class BackgroundController {
    constructor(config) {
        this.editor = config.editor; // Loose coupling
        this.stateManager = config.editor.stateManager;
    }
    
    getOpacity() {
        return this.stateManager.get('backgroundOpacity');
    }
    
    setOpacity(opacity) {
        this.stateManager.set('backgroundOpacity', opacity);
    }
}
```

### Pitfall 3: Circular Dependencies

**Problem:** Controller A needs Controller B, which needs Controller A

❌ **Bad:**
```javascript
// BackgroundController.js
const ListRenderer = require('./ListRenderer.js');
class BackgroundController {
    constructor(config) {
        this.renderer = new ListRenderer({ background: this }); // Circular!
    }
}

// ListRenderer.js
const BackgroundController = require('./BackgroundController.js');
class ListRenderer {
    constructor(config) {
        this.background = config.background; // Circular!
    }
}
```

✅ **Good:**
```javascript
// Pass shared dependencies, not controllers to each other
class BackgroundController {
    constructor(config) {
        this.editor = config.editor;
        this.stateManager = config.editor.stateManager;
    }
}

class ListRenderer {
    constructor(config) {
        this.editor = config.editor;
        this.stateManager = config.editor.stateManager;
    }
}
```

### Pitfall 4: Inconsistent Patterns

**Problem:** Mixing delegation styles

❌ **Bad:**
```javascript
// Inconsistent: some direct, some via getter
updateOpacity(val) {
    this.bgController.setOpacity(val);
}

getOpacity() {
    return this.stateManager.get('backgroundOpacity'); // Skips controller!
}
```

✅ **Good:**
```javascript
// Consistent: always delegate to controller
updateOpacity(val) {
    this.bgController.setOpacity(val);
}

getOpacity() {
    return this.bgController.getOpacity(); // Consistent delegation
}
```

---

## Case Studies

### Case Study 1: LayerPanel.js (Phase 1A)

**Context:** 2,194 lines, 194 lines over policy limit

**Problem:**
- Mixed background layer logic, rendering, drag/drop, dialogs
- 50+ methods, cognitive overload
- Difficult code reviews
- Approaching 2,000-line enforcement limit

**Solution:**
1. Extracted BackgroundLayerController (~380 lines)
2. Extracted LayerListRenderer (~500 lines)
3. Extracted LayerDragDrop (~400 lines)  
4. Removed ConfirmDialog fallback (~86 lines)
5. Removed other fallback implementations

**Results:**
- ✅ 2,194 → 1,768 lines (426-line reduction, 19.4%)
- ✅ Now 232 lines below limit (was 194 over)
- ✅ 99.6% test pass rate maintained
- ✅ 9 specialized controllers handle complexity
- ✅ LayerPanel now a clean facade with delegation

**Lessons:**
- Extract cohesive units (background, rendering, drag/drop)
- Remove fallback code (controllers guaranteed via extension.json)
- Maintain test coverage during extraction
- Update mocks to include new controllers

**Time Investment:** 2 days (planning + execution + testing + docs)

---

### Case Study 2: CanvasManager.js (Phase 1B)

**Context:** 1,964 lines, at 98% of policy limit

**Problem:**
- At capacity with no headroom for new features
- Event handling, image loading, style management fallbacks
- Would exceed limit with next feature addition
- Duplication between controller implementations and fallbacks

**Solution:**
1. Removed setupEventHandlers() fallback (~65 lines)
2. Removed loadBackgroundImageFallback() (~48 lines)
3. Removed tryLoadImageFallback() (~37 lines)
4. Simplified updateStyleOptions() fallback (~54 lines)

**Results:**
- ✅ 1,964 → 1,760 lines (204-line reduction, 10.4%)
- ✅ Now 240 lines below limit (was at 98% capacity)
- ✅ 99.88% test pass rate maintained
- ✅ Strict delegation to 14 controllers
- ✅ Zero code duplication

**Lessons:**
- Fallback code is often low-hanging fruit
- Controllers loaded via extension.json eliminate need for fallbacks
- Fail-fast with error logging is cleaner than silent fallbacks
- Test skipping is valid for removed intentional fallback code

**Time Investment:** 1 day (execution + testing + docs)

---

## Checklist: Controller Extraction

Use this checklist when extracting a controller:

### Planning Phase

- [ ] Identify cohesive functionality (50-500 lines)
- [ ] Verify no circular dependencies will be created
- [ ] Check extension.json for proper module loading
- [ ] Review existing controllers for similar patterns
- [ ] Estimate line reduction (aim for 100+ lines)

### Extraction Phase

- [ ] Create new controller file in appropriate directory
- [ ] Move cohesive methods to controller
- [ ] Update constructor to initialize controller
- [ ] Replace implementation with delegation calls
- [ ] Add error handling for missing controller
- [ ] Update JSDoc comments

### Registration Phase

- [ ] Add controller to extension.json scripts array
- [ ] Verify module dependencies are correct
- [ ] Check load order (dependencies first)

### Testing Phase

- [ ] Add controller mocks to test files
- [ ] Update tests to test delegation (not implementation)
- [ ] Skip tests specific to removed fallback code
- [ ] Run full test suite (`npm run test:js`)
- [ ] Verify coverage maintains >90%
- [ ] Check for no regressions

### Documentation Phase

- [ ] Update file size metrics in docs
- [ ] Add extraction to CHANGELOG.md
- [ ] Update god class tables in docs
- [ ] Create refactoring summary if major
- [ ] Update architecture diagrams if needed

### Review Phase

- [ ] Run `scripts/enforce-file-size-limits.sh`
- [ ] Verify file size reduced as expected
- [ ] Code review with focus on delegation correctness
- [ ] Check for consistent patterns
- [ ] Verify no performance regressions

---

## Appendix: Useful Commands

### Check File Sizes

```bash
# Check all JavaScript files over 1,000 lines
find resources -name '*.js' -exec wc -l {} \; | awk '$1 > 1000' | sort -rn

# Check specific file
wc -l resources/ext.layers.editor/LayerPanel.js

# Run enforcement script
bash scripts/enforce-file-size-limits.sh
```

### Test Commands

```bash
# Run all tests
npm run test:js

# Run specific test file
npm run test:js -- LayerPanel.test.js

# Run with coverage
npm run test:js:coverage

# Watch mode
npm run test:js:watch
```

### Linting

```bash
# JavaScript lint
npm run test

# PHP lint
npm run test:php

# Fix auto-fixable issues
npm run fix:php
```

---

## Summary

**Key Principles:**

1. **Facade Pattern** — Large classes should delegate to specialized controllers
2. **Fail Fast** — Remove fallback code, error log when controllers missing
3. **Test Discipline** — Skip tests for removed code, maintain coverage
4. **Incremental** — Extract one controller at a time, test thoroughly
5. **Document** — Update metrics, create summaries, share learnings

**Success Metrics:**

- ✅ File size reduced by 100+ lines
- ✅ Test pass rate >99%
- ✅ Coverage maintained >90%
- ✅ No circular dependencies
- ✅ Consistent delegation patterns
- ✅ Clear documentation

**Remember:** The goal is not just smaller files, but better architecture. Extract when it improves code quality, not just to hit line counts.

---

*Last Updated: January 14, 2026*  
*Based on Phase 1 refactoring learnings*  
*Living document — update as patterns evolve*
