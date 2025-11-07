# MediaWiki Layers Extension - Modular Architecture Documentation

## Overview

The Layers extension has been refactored into a modular architecture to improve maintainability, performance, and separation of concerns. This document describes the new modular components and their interactions.

## Architecture Overview

The extension follows a strict separation of concerns with the following main components:

### Backend (PHP)

- **API Modules**: `ApiLayersInfo`, `ApiLayersSave` - Handle data persistence and retrieval
- **Database Layer**: `LayersDatabase.php` - CRUD operations and JSON validation
- **Hooks**: Integration points with MediaWiki core
- **Security**: Rate limiting and validation helpers

### Frontend (JavaScript)

The frontend has been modularized into several key components:

#### Core Components

1. **CanvasManager** - Main orchestrator and canvas operations
2. **UIManager** - User interface management and DOM interactions
3. **EventManager** - Event handling and coordination
4. **APIManager** - API communication and data synchronization
5. **ValidationManager** - Client-side validation and data integrity
6. **StateManager** - Centralized state management
7. **ErrorHandler** - Error handling and user notifications

#### Supporting Components

1. **RenderingCore** - Basic shape rendering
2. **LayerRenderer** - Complex shape rendering
3. **TransformationEngine** - Zoom and pan operations
4. **SelectionSystem** - Layer selection and manipulation
5. **ToolManager** - Tool-specific operations

## Component Descriptions

### CanvasManager

**File**: `resources/ext.layers.editor/CanvasManager.js`

The main orchestrator that coordinates all canvas operations. Key features:

- **Dirty Region Tracking**: Optimizes rendering by only redrawing changed areas
- **Performance Optimization**: Implements caching and selective redraws
- **Module Coordination**: Manages interactions between all modular components
- **Legacy Compatibility**: Maintains backward compatibility with existing code

**Key Methods**:

- `performRedraw()`: Optimized redraw with dirty region support
- `renderLayersOptimized()`: Selective layer rendering
- `markDirtyRegion()`: Mark specific areas for redraw
- `needsFullRedraw()`: Determine if full redraw is required

### UIManager

**File**: `resources/ext.layers.editor/UIManager.js`

Manages all user interface elements and DOM interactions:

- Toolbar management
- Layer panel updates
- Status bar updates
- Modal dialogs
- UI state synchronization

### EventManager

**File**: `resources/ext.layers.editor/EventManager.js`

Centralized event handling system:

- Mouse and keyboard event processing
- Event delegation and bubbling
- Cross-component event coordination
- Event filtering and throttling

### APIManager

**File**: `resources/ext.layers.editor/APIManager.js`

Handles all API communications:

- Layer data loading/saving
- Error handling and retries
- Request queuing and batching
- Authentication and CSRF token management

### ValidationManager

**File**: `resources/ext.layers.editor/ValidationManager.js`

Client-side validation and data integrity:

- Layer data validation
- Configuration validation
- Input sanitization
- Schema compliance checking

### StateManager

**File**: `resources/ext.layers.editor/StateManager.js`

Centralized state management with observer pattern:

- Layer state management
- UI state coordination
- Undo/redo functionality
- State persistence and restoration

**Key Features**:

- Observable state changes
- Automatic UI updates
- State validation
- Conflict resolution

### ErrorHandler

**File**: `resources/ext.layers.editor/ErrorHandler.js`

Comprehensive error handling system:

- User-friendly error messages
- Error logging and reporting
- Recovery strategies
- Graceful degradation

## Performance Optimizations

### Dirty Region Tracking

The CanvasManager implements intelligent dirty region tracking to minimize unnecessary redraws:

```javascript
// Mark specific regions as dirty
this.markDirtyRegion({ x: 100, y: 100, width: 50, height: 50 });

// Check if full redraw is needed
if (this.needsFullRedraw()) {
    // Full canvas redraw
} else {
    // Selective redraw of dirty regions
}
```

### Layer Caching

Layers are cached and only re-rendered when their properties change:

- Bounds calculation caching
- Render state caching
- Selective layer updates

### Selective Rendering

Only layers that intersect with dirty regions are re-rendered:

```javascript
const layersToRender = this.getLayersInDirtyRegions(layers, dirtyRegions);
```

## Data Flow

### Layer Operations

1. User interaction → EventManager
2. Event processing → CanvasManager
3. State update → StateManager
4. Validation → ValidationManager
5. API call → APIManager
6. UI update → UIManager
7. Canvas redraw → CanvasManager

### State Synchronization

- All state changes go through StateManager
- Automatic propagation to dependent components
- Conflict detection and resolution
- Undo/redo support

## Configuration

### ResourceLoader Modules

All modular components are loaded via MediaWiki's ResourceLoader:

```json
{
    "ext.layers.editor": {
        "scripts": [
            "resources/ext.layers.editor/CanvasManager.js",
            "resources/ext.layers.editor/UIManager.js",
            "resources/ext.layers.editor/EventManager.js",
            "resources/ext.layers.editor/APIManager.js",
            "resources/ext.layers.editor/ValidationManager.js",
            "resources/ext.layers.editor/StateManager.js",
            "resources/ext.layers.editor/ErrorHandler.js"
        ]
    }
}
```

### Initialization Order

Components are initialized in dependency order:

1. CanvasManager (main orchestrator)
2. StateManager (state foundation)
3. EventManager (event handling)
4. UIManager (UI components)
5. APIManager (data layer)
6. ValidationManager (validation)
7. ErrorHandler (error handling)

## Error Handling

### Centralized Error Management

All errors are routed through the ErrorHandler:

- Network errors
- Validation errors
- Rendering errors
- User interaction errors

### Recovery Strategies

- Automatic retry for transient errors
- Graceful degradation for critical failures
- User notification for recoverable errors
- Logging for debugging

## Testing

### Unit Tests

Each module has comprehensive unit tests:

- Component isolation
- Mock dependencies
- Edge case coverage
- Performance benchmarks

### Integration Tests

End-to-end testing of component interactions:

- Data flow validation
- State synchronization
- Error recovery
- Performance metrics

## Migration Guide

### From Monolithic to Modular

1. **Identify Dependencies**: Map existing code to new modules
2. **Extract Components**: Move code to appropriate modules
3. **Update References**: Use new module APIs
4. **Test Integration**: Validate component interactions

### Backward Compatibility

- Legacy APIs maintained
- Gradual migration path
- Feature flags for new functionality

## Best Practices

### Component Development

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Injection**: Explicit dependencies
3. **Event-Driven**: Loose coupling through events
4. **Error Boundaries**: Isolated error handling

### Performance

1. **Minimize DOM Access**: Cache DOM references
2. **Batch Updates**: Group state changes
3. **Lazy Loading**: Load components on demand
4. **Memory Management**: Clean up event listeners

### Code Quality

1. **ESLint Compliance**: Follow coding standards
2. **Documentation**: Comprehensive JSDoc comments
3. **Testing**: Unit test coverage > 80%
4. **Type Safety**: Use JSDoc types for validation

## Future Enhancements

### Planned Improvements

- **WebWorkers**: Offload heavy computations
- **WebGL Rendering**: Hardware-accelerated graphics
- **Progressive Loading**: Load layers on demand
- **Real-time Collaboration**: Multi-user editing

### Extensibility

- **Plugin Architecture**: Third-party module support
- **Custom Tools**: Extensible tool system
- **Theme Support**: UI customization
- **Export Formats**: Additional output formats

## Troubleshooting

### Common Issues

1. **Module Loading**: Check ResourceLoader configuration
2. **Event Conflicts**: Verify event handler priorities
3. **State Corruption**: Use StateManager validation
4. **Performance**: Enable dirty region debugging

### Debugging Tools

- **Console Logging**: Enable verbose logging
- **Performance Profiling**: Use browser dev tools
- **State Inspection**: StateManager debugging API
- **Error Tracking**: ErrorHandler logging

## Contributing

### Development Setup

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Build assets: `npm run build`
4. Lint code: `npm run lint`

### Code Standards

- Follow ESLint configuration
- Use JSDoc for documentation
- Write comprehensive tests
- Follow Git commit conventions

### Review Process

- Code review required for all changes
- Test coverage must be maintained
- Performance impact assessment
- Documentation updates required

---

This modular architecture provides a solid foundation for future enhancements while maintaining backward compatibility and improving code maintainability.
