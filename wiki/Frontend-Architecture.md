# Frontend Architecture

Detailed JavaScript module structure and patterns used in the Layers extension.

---

## Module Organization

The Layers extension uses three ResourceLoader modules with clear separation of concerns:

```
ext.layers (Viewer)
    └── init.js                      # Entry point for viewer

ext.layers.shared (Shared Code)
    ├── LayerRenderer.js             # Main renderer dispatcher
    ├── ShapeRenderer.js             # Rectangles, circles, ellipses, etc.
    ├── ArrowRenderer.js             # Arrows and lines
    ├── TextRenderer.js              # Single-line text
    ├── TextBoxRenderer.js           # Multi-line text boxes
    ├── ShadowRenderer.js            # Shadow effects
    ├── EffectsRenderer.js           # Blur regions
    └── LayerDataNormalizer.js       # Type normalization

ext.layers.editor (Full Editor)
    ├── LayersEditor.js              # Main editor entry point
    ├── CanvasManager.js             # Canvas facade → controllers
    ├── ToolManager.js               # Tool facade → handlers
    ├── SelectionManager.js          # Selection facade → components
    ├── Toolbar.js                   # Main toolbar UI
    ├── LayerPanel.js                # Layer list and properties
    └── [many more modules...]
```

---

## Core Patterns

### Facade Pattern

Large manager classes act as facades, delegating to specialized controllers:

```javascript
// CanvasManager delegates to 10+ controllers
class CanvasManager {
    constructor() {
        this.zoomController = new ZoomPanController(this);
        this.transformController = new TransformController(this);
        this.drawingController = new DrawingController(this);
        // ...
    }
    
    // Delegation
    zoomIn() {
        return this.zoomController.zoomIn();
    }
}
```

### Controller Pattern

Each controller handles a specific responsibility:

| Controller | Responsibility | Lines |
|------------|---------------|-------|
| `ZoomPanController` | Zoom, pan, fit-to-window | ~340 |
| `TransformController` | Resize, rotation, multi-layer | ~761 |
| `DrawingController` | Shape creation, drawing preview | ~635 |
| `HitTestController` | Selection handle hit testing | ~380 |
| `ClipboardController` | Copy, cut, paste | ~210 |
| `RenderCoordinator` | Render scheduling, dirty regions | ~390 |
| `InteractionController` | Mouse/touch event handling | ~490 |
| `AlignmentController` | Align and distribute layers | ~464 |
| `GridRulersController` | Grid, rulers, snap-to-grid | ~385 |

### Module Registry

The editor uses a registry for dependency management:

```javascript
class LayersEditor {
    constructor() {
        this.modules = new ModuleRegistry();
        this.modules.register('ui', new UIManager(this));
        this.modules.register('events', new EventManager(this));
        this.modules.register('api', new APIManager(this));
        // ...
    }
}
```

---

## Canvas Controllers

### ZoomPanController

Handles viewport navigation:

- **Zoom in/out** with configurable steps
- **Pan** via drag or scroll
- **Fit to window** calculation
- **Coordinate transforms** between canvas and screen space

### TransformController

Handles layer transformations:

- **Resize** with handle dragging
- **Rotation** with rotation handle
- **Multi-layer transforms** maintaining relative positions
- **Aspect ratio** preservation with Shift key

### DrawingController

Handles shape creation:

- **Drawing preview** during drag
- **Shape creation** on mouse up
- **Tool-specific logic** via delegation to ShapeFactory

### HitTestController

Handles hit testing for selection:

- **Handle detection** (resize, rotation)
- **Layer detection** by bounding box
- **Z-order** aware hit testing

---

## Tool Handlers

Tools are managed by `ToolManager` which delegates to specialized handlers:

### TextToolHandler

Inline text input for text layers:

```javascript
class TextToolHandler {
    activateInlineInput(x, y) {
        // Create input element at canvas position
        // Handle Enter key for completion
        // Create text layer on submit
    }
}
```

### PathToolHandler

Freeform path drawing:

```javascript
class PathToolHandler {
    handleClick(x, y) {
        // Add point to current path
        // Double-click or Escape to finish
    }
}
```

### ShapeFactory

Creates layer objects based on tool type:

```javascript
const layer = ShapeFactory.create('rectangle', {
    x: 100, y: 100,
    width: 200, height: 150,
    stroke: '#000000',
    fill: 'transparent'
});
```

---

## UI Controllers

### LayerPanel Controllers

The LayerPanel delegates to 7 specialized controllers:

| Controller | Purpose |
|------------|---------|
| `BackgroundLayerController` | Background visibility/opacity |
| `LayerItemFactory` | Layer list item DOM creation |
| `LayerListRenderer` | Layer list rendering |
| `LayerDragDrop` | Drag and drop reordering |
| `PropertiesForm` | Layer properties panel |
| `ConfirmDialog` | Confirmation dialogs |
| `IconFactory` | SVG icon generation |

### Toolbar Components

| Component | Purpose |
|-----------|---------|
| `ToolbarStyleControls` | Style controls (color, stroke, etc.) |
| `ToolbarKeyboard` | Keyboard shortcut handling |
| `PresetStyleManager` | Preset dropdown integration |

---

## Preset System

Style presets use a modular architecture:

```
PresetManager (facade)
    ├── BuiltInPresets    # Built-in preset definitions
    └── PresetStorage     # localStorage operations

PresetDropdown            # UI component
PresetStyleManager        # Toolbar integration
```

### BuiltInPresets

Static class with default presets:

```javascript
BuiltInPresets.getForTool('arrow');  // [{ id, name, style }, ...]
BuiltInPresets.getDefault('text');   // First text preset
BuiltInPresets.isBuiltIn('builtin-arrow-default'); // true
```

### PresetStorage

Handles persistence:

```javascript
const storage = new PresetStorage();
storage.load();               // Load from localStorage
storage.save(data);           // Save to localStorage
storage.exportToJson(data);   // Export for sharing
storage.importFromJson(json); // Import presets
```

---

## Rendering Pipeline

### LayerRenderer (Entry Point)

Dispatches to specialized renderers based on layer type:

```javascript
render(layer, scale) {
    switch(layer.type) {
        case 'rectangle':
        case 'circle':
        case 'ellipse':
            return this.shapeRenderer.render(layer, scale);
        case 'arrow':
        case 'line':
            return this.arrowRenderer.render(layer, scale);
        case 'text':
            return this.textRenderer.render(layer, scale);
        // ...
    }
}
```

### Renderer Specialization

| Renderer | Layer Types | Lines |
|----------|-------------|-------|
| `ShapeRenderer` | rectangle, circle, ellipse, polygon, star | ~1,049 |
| `ArrowRenderer` | arrow, line | ~702 |
| `TextRenderer` | text | ~343 |
| `TextBoxRenderer` | textbox | ~430 |
| `ShadowRenderer` | (all - shadow effects) | ~521 |
| `EffectsRenderer` | blur | ~245 |

---

## State Management

### StateManager

Centralized state with observer pattern:

```javascript
class StateManager {
    setLayers(layers) {
        this.layers = layers;
        this.notify('layers-changed', layers);
    }
    
    subscribe(event, callback) {
        this.listeners[event].push(callback);
    }
}
```

### HistoryManager

Undo/redo with state snapshots:

```javascript
class HistoryManager {
    pushState(layers, action) {
        this.undoStack.push({ layers, action });
        this.redoStack = [];
    }
    
    undo() {
        const state = this.undoStack.pop();
        this.redoStack.push(this.currentState);
        return state;
    }
}
```

---

## Event System

### EventManager

Centralized event bus:

```javascript
const events = new EventManager();
events.on('layer-selected', (layer) => { ... });
events.emit('layer-selected', layer);
events.off('layer-selected', handler);
```

### EventTracker

Prevents memory leaks by tracking listeners:

```javascript
class MyComponent {
    constructor() {
        this.eventTracker = new EventTracker();
    }
    
    init() {
        this.eventTracker.add(element, 'click', handler);
    }
    
    destroy() {
        this.eventTracker.removeAll(); // Cleanup
    }
}
```

---

## Error Handling

### ErrorHandler

Centralized error handling:

```javascript
ErrorHandler.handle(error, {
    context: 'save',
    layer: currentLayer,
    notify: true
});
```

### APIErrorHandler

API-specific error handling:

```javascript
APIErrorHandler.handleApiError(response, {
    filename: 'File:Example.jpg',
    action: 'save'
});
```

---

## Testing Architecture

### Unit Tests (Jest)

```
tests/jest/
├── CanvasManager.test.js      # Canvas operations
├── ToolManager.test.js        # Tool switching
├── SelectionManager.test.js   # Selection logic
├── PresetManager.test.js      # Preset operations
├── canvas/                    # Controller tests
├── tools/                     # Tool handler tests
└── integration/               # Integration tests
```

### Test Utilities

```javascript
// Mock setup (tests/jest/setup.js)
global.mw = {
    Api: jest.fn(),
    message: jest.fn(),
    // ...
};
```

---

## Code Metrics

| Metric | Value |
|--------|-------|
| Total JS Files | 85+ |
| Total Lines | ~44K |
| ES6 Classes | 76+ |
| Test Files | 109 |
| Test Cases | 5,505 |
| Coverage | ~92% |

### God Classes (>1,000 lines)

All god classes use the delegation pattern:

| Class | Lines | Delegates To |
|-------|-------|--------------|
| CanvasManager | 1,861 | 10+ controllers |
| LayerPanel | 1,837 | 7 controllers |
| LayersEditor | 1,324 | 3 modules |
| Toolbar | 1,298 | 4 modules |
| ToolManager | 1,275 | 2 handlers |
| ShapeRenderer | 1,191 | ShadowRenderer |
| SelectionManager | 1,194 | 3 modules |
| APIManager | 1,161 | APIErrorHandler |

---

## Best Practices

### Creating New Controllers

1. Accept parent manager in constructor
2. Store reference to parent
3. Expose focused public methods
4. Use parent's utilities (logging, events)

```javascript
class MyController {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
    }
    
    doSomething() {
        const layers = this.canvasManager.getLayers();
        // ...
    }
}
```

### Adding New Tools

1. Add to `ToolRegistry` configuration
2. Create handler if complex logic needed
3. Add keyboard shortcut in `ToolbarKeyboard`
4. Add built-in presets in `BuiltInPresets`

### Memory Management

1. Use `EventTracker` for DOM listeners
2. Implement `destroy()` method
3. Nullify references in cleanup
4. Remove from parent registries

---

## See Also

- [[Architecture Overview]] — High-level system architecture
- [[API Reference]] — API documentation
- [[Testing Guide]] — Running and writing tests
- [[Contributing Guide]] — How to contribute

