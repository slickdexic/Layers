# MediaWiki Layers Extension - Modular Architecture Documentation

**Last Updated:** November 29, 2025  
**Status:** Partially Implemented - See [improvement_plan.md](../improvement_plan.md) for roadmap

## Overview

The Layers extension provides non-destructive image annotation for MediaWiki. The architecture follows a separation of concerns between backend (PHP) and frontend (JavaScript) components.

## Current Architecture Status

> **⚠️ Honest Assessment:** The architecture is in transition. Some modules have been successfully extracted with excellent test coverage (97%+), while core orchestrator classes remain large and need further decomposition. See [codebase_review.md](../codebase_review.md) for detailed analysis.

### What's Working Well ✅

- **Canvas Controllers**: Six specialized controllers extracted with 97-100% test coverage
- **StateManager**: Centralized state with subscription pattern (85% coverage)
- **ValidationManager**: Comprehensive input validation (99% coverage)
- **APIManager**: API communication with retry logic
- **HistoryManager**: Undo/redo system
- **Backend Security**: CSRF, rate limiting, strict property whitelist

### What Needs Improvement ⚠️

- **CanvasManager.js**: 4,003 lines - needs decomposition (22% coverage)
- **WikitextHooks.php**: 2,001 lines with code duplication
- **Event Systems**: 5 overlapping event-related modules
- **IIFE Globals**: 48 window.* exports - needs ES module migration

---

## Backend (PHP)

### API Modules

| Module | File | Purpose |
|--------|------|---------|
| ApiLayersInfo | `src/Api/ApiLayersInfo.php` | Read layer data and revision history |
| ApiLayersSave | `src/Api/ApiLayersSave.php` | Write layer data with validation |

### Database Layer

**File**: `src/Database/LayersDatabase.php`

- CRUD operations for layer sets
- JSON validation and sanitization
- Retry logic with exponential backoff
- Named layer set support with revision history

### Security

| Component | File | Purpose |
|-----------|------|---------|
| RateLimiter | `src/Security/RateLimiter.php` | Request throttling |
| ServerSideLayerValidator | `src/Validation/ServerSideLayerValidator.php` | Strict property whitelist (40+ fields) |
| TextSanitizer | `src/Validation/TextSanitizer.php` | HTML stripping, protocol filtering |

---

## Frontend (JavaScript)

### Core Components

| Component | File | Lines | Coverage | Status |
|-----------|------|-------|----------|--------|
| LayersEditor | `LayersEditor.js` | 1,707 | 14.6% | Main orchestrator - needs tests |
| CanvasManager | `CanvasManager.js` | 4,003 | 22.2% | **God class - needs split** |
| StateManager | `StateManager.js` | 652 | 85% | ✅ Working well |
| HistoryManager | `HistoryManager.js` | 524 | ~80% | ✅ Undo/redo system |
| ValidationManager | `ValidationManager.js` | 553 | 99% | ✅ Input validation |
| APIManager | `APIManager.js` | 574 | ~70% | API communication |
| ErrorHandler | `ErrorHandler.js` | 556 | ~60% | Error management |

### Extracted Canvas Controllers (✅ Best Practice Examples)

These modules demonstrate the target architecture pattern:

| Controller | File | Lines | Coverage | Responsibility |
|------------|------|-------|----------|----------------|
| ZoomPanController | `canvas/ZoomPanController.js` | 343 | 97% | Zoom and pan operations |
| GridRulersController | `canvas/GridRulersController.js` | 385 | 97% | Grid and ruler display |
| TransformController | `canvas/TransformController.js` | 965 | 100% | Layer transformations |
| HitTestController | `canvas/HitTestController.js` | 382 | 98% | Click target detection |
| DrawingController | `canvas/DrawingController.js` | 620 | 97% | Shape drawing operations |
| ClipboardController | `canvas/ClipboardController.js` | 222 | 98% | Copy/paste operations |

### Rendering Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| CanvasRenderer | `CanvasRenderer.js` | 1,367 | Shape rendering |
| RenderingCore | `RenderingCore.js` | 963 | Basic render operations |
| LayerRenderer | `LayerRenderer.js` | 641 | Complex layer rendering |

### UI Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Toolbar | `Toolbar.js` | 1,674 | Tool selection and controls |
| LayerPanel | `LayerPanel.js` | 1,091 | Layer list management |
| PropertiesForm | `ui/PropertiesForm.js` | ~800 | Property editing |
| ColorPickerDialog | `ui/ColorPickerDialog.js` | ~500 | Color selection |

---

## Component Descriptions

### StateManager

**File**: `resources/ext.layers.editor/StateManager.js`

Centralized state management with observer pattern. **This is the recommended pattern for state access.**

**Core API**:

```javascript
// Get state value
const layers = stateManager.get('layers');
const selectedIds = stateManager.get('selectedLayerIds');

// Set state value (triggers subscribers)
stateManager.set('selectedLayerIds', ['layer1', 'layer2']);

// Subscribe to state changes
const unsubscribe = stateManager.subscribe('layers', (newValue) => {
    // React to layer changes
});

// Atomic operations (prevents race conditions)
stateManager.atomic((state) => {
    state.layers = newLayers;
    state.selectedLayerIds = newSelection;
});
```

**State Keys**:

| Key | Type | Description |
|-----|------|-------------|
| `layers` | `Array<Layer>` | All layer objects in the document |
| `selectedLayerIds` | `Array<string>` | IDs of currently selected layers |
| `currentTool` | `string` | Active tool name |
| `zoom` | `number` | Current zoom level |
| `pan` | `{x, y}` | Current pan offset |

### State Access Patterns

**IMPORTANT**: Components should NOT store local copies of shared state. Instead, use getter methods that route through StateManager.

**Deprecated Pattern** (do NOT use):

```javascript
// Bad: Direct state storage
this.selectedLayerId = 'layer1';
this.layers = [...layers];
```

**Current Pattern** (use this):

```javascript
// Good: Access through StateManager via getter methods
CanvasManager.prototype.getSelectedLayerIds = function () {
    if (this.editor && this.editor.stateManager) {
        return this.editor.stateManager.get('selectedLayerIds') || [];
    }
    return [];
};
```

### HistoryManager

**File**: `resources/ext.layers.editor/HistoryManager.js`

Single source of truth for undo/redo operations. All undo/redo calls should route through this manager.

```javascript
// Save state for undo
historyManager.saveState('move layer');

// Undo/redo
historyManager.undo();
historyManager.redo();

// Check state
historyManager.canUndo();
historyManager.canRedo();
```

### ErrorHandler

**File**: `resources/ext.layers.editor/ErrorHandler.js`

Centralized error handling with user-friendly messages. **Currently integrated at 6 call sites.**

```javascript
// Handle error with context
ErrorHandler.handleError(error, 'LayerPanel.propertiesSync');

// Log warning
mw.log.warn('[ComponentName] Warning message:', error.message);
```

---

## Data Flow

### Layer Operations

1. User interaction → EventHandler/CanvasEvents
2. Event processing → CanvasManager
3. State update → StateManager
4. Validation → ValidationManager
5. API call → APIManager
6. UI update → LayerPanel/Toolbar
7. Canvas redraw → CanvasManager.performRedraw()

### Rendering Pipeline

```
User Action
    ↓
CanvasManager.performRedraw()
    ↓
CanvasRenderer.render()
    ↓
RenderingCore (basic shapes) / LayerRenderer (complex)
    ↓
Canvas Context Operations
```

> **Note**: Currently, every change triggers a full canvas redraw. Performance optimization via dirty region tracking is planned but not yet implemented. See improvement_plan.md #0.2.

---

## Module Loading

### ResourceLoader Configuration

Modules are loaded via MediaWiki's ResourceLoader (see `extension.json`):

```json
{
    "ext.layers.editor": {
        "scripts": [
            "resources/ext.layers.editor/LayersConstants.js",
            "resources/ext.layers.editor/StateManager.js",
            "resources/ext.layers.editor/HistoryManager.js",
            // ... more modules
        ]
    }
}
```

### Current Module System

> **⚠️ Technical Debt**: The codebase uses IIFE (Immediately Invoked Function Expression) pattern with window.* exports. This is a 2015-era pattern that blocks ES module adoption and tree-shaking.

**Current Pattern**:
```javascript
( function () {
    'use strict';
    function MyComponent() { ... }
    window.MyComponent = MyComponent;
}());
```

**Future Target** (ES Modules):
```javascript
export class MyComponent { ... }
// or
export function createComponent() { ... }
```

Migration to ES modules is tracked in improvement_plan.md #2.1.

---

## Testing

### Current Coverage

| Category | Coverage | Notes |
|----------|----------|-------|
| Canvas Controllers | 97-100% | ✅ Best practice examples |
| Utilities | 90%+ | GeometryUtils, ValidationManager |
| Core Orchestrators | 14-22% | ⚠️ Needs improvement |
| Overall | 53.4% | Inflated by utility coverage |

### Running Tests

```bash
# All tests
npm test

# Jest unit tests only
npm run test:js

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# PHP tests
npm run test:php
```

---

## Best Practices

### For New Code

1. **Single Responsibility**: Each module should have one clear purpose
2. **Use StateManager**: Don't create local state copies
3. **Use HistoryManager**: Route all undo/redo through it
4. **Use ErrorHandler**: Don't swallow errors with empty catch blocks
5. **Write Tests First**: Target 80%+ coverage for new code
6. **Follow Existing Controllers**: ZoomPanController is a good template

### Code Quality

- ESLint: Zero warnings required
- JSDoc: Document all public methods
- Coverage: Maintain/improve overall coverage
- No empty catch blocks
- No unused variables

---

## Planned Improvements

See [improvement_plan.md](../improvement_plan.md) for the full roadmap.

### P0 - Critical (Before Production)

1. Split CanvasManager.js into focused modules
2. Remove or implement performance optimization code
3. Fix remaining code quality issues

### P1 - High Priority

1. Split WikitextHooks.php
2. Consolidate event systems
3. Increase core module coverage to 50%+

### P2 - Medium Priority

1. Migrate to ES modules
2. Canvas accessibility improvements

---

## Contributing

### Development Setup

```bash
# Install dependencies
npm install
composer install

# Run tests
npm test
npm run test:js

# Build
npm run build:dev
```

### Code Standards

- Follow `.eslintrc.json` configuration
- Use JSDoc for documentation
- Write tests for new functionality
- Update this documentation when architecture changes

---

*This document reflects the actual state of the codebase as of November 29, 2025. For aspirational features, see improvement_plan.md.*
