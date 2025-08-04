# Layers Extension - Implementation Checklist

## Phase 1: Foundation (Weeks 1-4) ✅ Ready to Start

### Database & Core API
- [ ] Create database schema SQL files in `/sql/` directory
- [ ] Implement `LayersDatabase.php` class for CRUD operations  
- [ ] Create `ApiLayersSave.php` and `ApiLayersInfo.php` classes
- [ ] Add JSON schema validation in `LayersValidator.php`
- [ ] Set up configuration variables in `extension.json`

### File Integration
- [ ] Create `LayersHooks.php` with file page tab integration
- [ ] Implement wikitext parser for `layers=` parameter
- [ ] Create file storage system for side-car JSON files
- [ ] Add file-layer association tracking

### Basic Editor UI
- [ ] Set up ResourceLoader modules for Fabric.js and dependencies
- [ ] Create `LayersEditor.js` main controller
- [ ] Build HTML templates for editor interface
- [ ] Implement canvas initialization and basic toolbar

## Quick Start Development Order

1. **Start Here:** Database schema and basic API endpoints
2. **Next:** File page integration (add the edit tab)
3. **Then:** Basic editor UI that can load and display images
4. **Finally:** Text layer functionality as first working feature

## Key Files to Create

```
src/
├── Api/
│   ├── ApiLayersSave.php
│   └── ApiLayersInfo.php
├── Database/
│   └── LayersDatabase.php
├── Hooks/
│   └── LayersHooks.php
├── Validation/
│   └── LayersValidator.php
└── Storage/
    └── LayersStorage.php

resources/
├── ext.layers.editor/
│   ├── LayersEditor.js
│   ├── CanvasManager.js
│   ├── LayerPanel.js
│   ├── Toolbar.js
│   └── editor.css
└── ext.layers.viewer/
    ├── LayersViewer.js
    └── viewer.css

sql/
├── layers_tables.sql
└── patches/
    └── initial_schema.sql

i18n/
├── en.json (update existing)
└── qqq.json (update existing)
```

## Development Environment Setup

1. Install MediaWiki 1.35+ locally
2. Clone this repository to `extensions/Layers/`
3. Add to LocalSettings.php: `wfLoadExtension( 'Layers' );`
4. Run: `php maintenance/update.php`
5. Enable debug mode: `$wgDebugMode = true;`

## Testing Strategy

- Start with unit tests for database operations
- Create integration tests for API endpoints  
- Manual testing in browser for UI components
- Test with various image formats (PNG, JPG, SVG)

## Quick Wins to Build Momentum

1. Get "Edit Layers" tab showing on file pages
2. Basic editor opens with image displayed
3. Simple text layer that can be added and positioned
4. Save functionality that persists layers to database

These early victories will prove the core concept works and motivate continued development.
