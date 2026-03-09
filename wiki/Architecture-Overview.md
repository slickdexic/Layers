# Architecture Overview

Technical architecture of the Layers extension for developers.

---

## Design Principles

1. **Separation of Concerns** — PHP handles MediaWiki integration and storage; JavaScript implements the editor UI
2. **Non-Destructive Editing** — Original images are never modified
3. **Validated Data** — All layer data is validated server-side before storage
4. **Accessibility First** — WCAG 2.1 compliant with full keyboard support
5. **Progressive Enhancement** — Viewer loads separately from editor for performance

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MediaWiki Core                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │   Layers PHP     │    │      Layers JavaScript           │   │
│  │                  │    │                                   │   │
│  │  • API Modules   │◄───┤  • Editor (~64K lines)            │   │
│  │  • Hooks         │    │  • Viewer (~2.5K lines)           │   │
│  │  • Database      │    │  • Shared (~8K lines)             │   │
│  │  • Validation    │    │                                   │   │
│  │  • Security      │    │                                   │   │
│  └────────┬─────────┘    └──────────────────────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │    Database      │                                           │
│  │   layers_sets    │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture (PHP)

### Directory Structure

```
src/
├── Api/
│   ├── ApiLayersInfo.php      # Read layer data
│   ├── ApiLayersSave.php      # Save layer data
│   ├── ApiLayersDelete.php    # Delete layer sets
│   ├── ApiLayersRename.php    # Rename layer sets
│   ├── ApiLayersList.php      # List slides (NEW)
│   └── Traits/
│       └── ForeignFileHelperTrait.php  # Shared foreign file detection
├── Action/
│   └── EditLayersAction.php   # "Edit Layers" tab action
├── Database/
│   ├── LayersDatabase.php     # Database operations
│   └── LayersSchemaManager.php # Schema management
├── Hooks/
│   ├── ...                    # MediaWiki hook handlers
│   └── SlideHooks.php         # Slide parser function (NEW)
├── Logging/
│   ├── LayersLogger.php       # Logger factory
│   ├── LoggerAwareTrait.php   # Trait for objects
│   └── StaticLoggerAwareTrait.php # Trait for static contexts
├── Security/
│   └── RateLimiter.php        # Rate limiting
├── SpecialPages/              # (NEW)
│   ├── SpecialSlides.php      # Slide management page
│   └── SpecialEditSlide.php   # Direct slide editor
└── Validation/
    ├── ColorValidator.php     # Color validation
    ├── ServerSideLayerValidator.php # Layer validation
    ├── SetNameSanitizer.php   # Set name sanitization
    ├── SlideNameValidator.php # Slide name validation (NEW)
    ├── TextSanitizer.php      # Text sanitization
    └── ValidationResult.php   # Validation result container
```

### API Modules

| Module | Method | Purpose |
|--------|--------|---------|
| `ApiLayersInfo` | GET | Fetch layer data and revisions |
| `ApiLayersSave` | POST | Save layer set with CSRF token |
| `ApiLayersDelete` | POST | Delete named layer set |
| `ApiLayersRename` | POST | Rename named layer set |
| `ApiLayersList` | GET | List all slides (NEW) |

### Database Schema

```sql
CREATE TABLE layers_sets (
    ls_id INT PRIMARY KEY AUTO_INCREMENT,
    ls_img_name VARCHAR(255) NOT NULL,
    ls_name VARCHAR(50) NOT NULL DEFAULT 'default',
    ls_user_id INT NOT NULL,
    ls_timestamp BINARY(14) NOT NULL,
    ls_revision INT NOT NULL DEFAULT 1,
    ls_data MEDIUMBLOB NOT NULL,
    
    INDEX idx_img_name (ls_img_name),
    INDEX idx_img_name_name (ls_img_name, ls_name),
    UNIQUE idx_img_name_name_rev (ls_img_name, ls_name, ls_revision)
);
```

### Validation Pipeline

```
Input JSON
    │
    ▼
┌─────────────────┐
│ Size Validation │ ← $wgLayersMaxBytes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ JSON Parsing    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Layer Count     │ ← $wgLayersMaxLayerCount
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Property        │ ← ALLOWED_PROPERTIES whitelist
│ Whitelisting    │   (50+ fields)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Type Validation │ ← Numbers, strings, booleans
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Range Checks    │ ← Min/max values
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Color Sanitize  │ ← Prevent XSS via colors
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Text Sanitize   │ ← Strip HTML/dangerous protocols
└────────┬────────┘
         │
         ▼
Validated Output
```

---

## Frontend Architecture (JavaScript)

### Module System

```
┌────────────────────────────────────────────────────────────────┐
│                    ResourceLoader Modules                       │
├───────────────────────┬────────────────────┬───────────────────┤
│   ext.layers          │  ext.layers.shared │  ext.layers.editor│
│   (Viewer Entry)      │  (Shared Code)     │  (Full Editor)    │
│   ~2.5K lines         │  ~8K lines         │  ~64K lines       │
├───────────────────────┴────────────────────┴───────────────────┤
│                                                                 │
│  Viewer loads: ext.layers + ext.layers.shared                  │
│  Editor loads: ext.layers.editor (includes shared)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Classes

```
LayersEditor (entry point)
    │
    ├── ModuleRegistry
    │   ├── UIManager
    │   ├── EventManager
    │   ├── APIManager
    │   ├── ValidationManager
    │   ├── StateManager
    │   └── HistoryManager
    │
    ├── CanvasManager (facade → controllers)
    │   ├── ZoomPanController
    │   ├── TransformController
    │   ├── HitTestController
    │   ├── DrawingController
    │   ├── ClipboardController
    │   ├── RenderCoordinator
    │   ├── InteractionController
    │   ├── AlignmentController
    │   ├── SmartGuidesController
    │   └── TextInputController
    │
    ├── ToolManager (facade → handlers)
    │   ├── TextToolHandler
    │   ├── PathToolHandler
    │   ├── ShapeFactory
    │   ├── ToolRegistry
    │   └── ToolStyles
    │
    ├── SelectionManager (facade → components)
    │   ├── SelectionState
    │   ├── MarqueeSelection
    │   └── SelectionHandles
    │
    ├── Toolbar
    │   └── ToolbarStyleControls
    │       └── PresetStyleManager
    │
    └── LayerPanel
        ├── BackgroundLayerController
        ├── LayerItemFactory
        ├── LayerListRenderer
        ├── LayerDragDrop
        └── PropertiesForm
```

### Rendering Pipeline

```
Shared Renderers (ext.layers.shared)
─────────────────────────────────────
LayerRenderer
    ├── ShapeRenderer       ← Rectangles, circles, ellipses, polygons, stars
    ├── ArrowRenderer       ← Arrows and lines
    ├── TextRenderer        ← Single-line text
    ├── TextBoxRenderer     ← Multi-line text boxes
    ├── ShadowRenderer      ← Shadow effects
    └── EffectsRenderer     ← Blur regions
```

### Data Flow

```
User Action
    │
    ▼
EventManager (captures event)
    │
    ▼
CanvasManager/ToolManager (processes action)
    │
    ▼
StateManager (updates layer data)
    │
    ▼
HistoryManager (saves undo state)
    │
    ▼
CanvasRenderer (redraws canvas)
    │
    ▼
User sees update
```

### API Communication

```javascript
// Read layers
const api = new mw.Api();
const response = await api.get({
    action: 'layersinfo',
    filename: 'File:Example.jpg',
    setname: 'default'
});

// Save layers
await api.postWithToken('csrf', {
    action: 'layerssave',
    filename: 'File:Example.jpg',
    setname: 'default',
    data: JSON.stringify(layers)
});
```

---

## File Organization

### JavaScript Files by Category

| Category | Location | Purpose |
|----------|----------|---------|
| Entry Points | `ext.layers/`, `ext.layers.editor/` | Bootstrap code |
| Canvas Controllers | `ext.layers.editor/canvas/` | Canvas operations |
| Tools | `ext.layers.editor/tools/` | Tool implementations |
| UI Controllers | `ext.layers.editor/ui/` | Panel components |
| Editor Modules | `ext.layers.editor/editor/` | Editor utilities |
| Shared Renderers | `ext.layers.shared/` | Rendering code |
| Utilities | `ext.layers.editor/utils/` | Helper functions |

### Code Metrics

| Metric | Value |
|--------|-------|
| Total JavaScript Files | 143 |
| Total Lines of Code | ~99,699 |
| ES6 Classes | 140 (100% migrated) |
| Test Suites | 163 |
| Test Cases | 11,250 |
| Code Coverage | 95.19% |

---

## Design Patterns

### Facade Pattern
`CanvasManager`, `ToolManager`, and `SelectionManager` act as facades, delegating to specialized controllers.

### Controller Pattern
Each canvas controller handles a specific responsibility (zoom, drawing, hit testing, etc.).

### Observer Pattern
Style changes notify subscribers via `ToolStyles.subscribe()`.

### Factory Pattern
`ShapeFactory` creates layer objects based on tool type.

### Registry Pattern
`ToolRegistry` manages tool configurations.
`ModuleRegistry` manages editor modules.

---

## Security Model

### Server-Side

1. **CSRF Protection** — All write operations require valid tokens
2. **Property Whitelist** — Only 50+ explicitly allowed fields
3. **Type Validation** — Strict type checking for all values
4. **Range Validation** — Numeric values bounded to safe ranges
5. **Text Sanitization** — HTML and dangerous protocols stripped
6. **Color Validation** — Prevents XSS via style injection
7. **Rate Limiting** — MediaWiki's `pingLimiter` integration

### Client-Side

1. **Input Validation** — Pre-validation before API calls
2. **Error Boundaries** — Graceful degradation on errors
3. **CSP Compliance** — No inline scripts, safe blob URLs

---

## Performance Considerations

### Code Splitting

- Viewer (~2.5K lines) loads separately from Editor (~64K lines)
- Shared module (~8K lines) loaded by both
- Shape/Emoji data (~40K lines, generated) loaded on demand
- ResourceLoader handles dependency management

### Rendering Optimization

- Dirty region tracking via `RenderCoordinator`
- Throttled/debounced render calls
- Canvas state caching where possible

### Memory Management

- Event listener tracking via `EventTracker`
- Proper cleanup in `destroy()` methods
- Clipboard size limits

---

## Testing Architecture

### Unit Tests (Jest)

```
tests/jest/
├── *.test.js           # Component tests
├── unit/               # Pure unit tests
├── canvas/             # Canvas controller tests
└── tools/              # Tool handler tests
```

### Integration Tests (PHPUnit)

```
tests/phpunit/
├── ApiLayersInfoTest.php
├── ApiLayersSaveTest.php
└── ...
```

### E2E Tests (Playwright)

```
tests/e2e/
├── editor.spec.js
└── viewer.spec.js
```

---

## See Also

- [[API Reference]] — Detailed API documentation
- [[Frontend Architecture]] — JavaScript module details
- [[Contributing Guide]] — How to contribute
- [[Testing Guide]] — Running and writing tests
