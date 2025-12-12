# Changelog

All notable changes to the Layers MediaWiki Extension will be documented in this file.

## [0.8.4] - 2025-12-11

### Bug Fixes
- Fixed blur layer showing raw i18n message keys (⧼layers-prop-blur-radius⧽)
- Fixed unnecessary decimals on blur width/height properties
- Fixed unnecessary decimals on arrow/line X/Y coordinates
- Fixed keyboard shortcuts (?) button not responding to clicks
- Fixed keyboard shortcuts dialog showing raw message keys
- Fixed 6 failing IconFactory tests

### i18n
- Added missing messages to ResourceLoader: `layers-type-blur`, `layers-prop-blur-radius`
- Added keyboard shortcut messages: `layers-shortcut-select-all`, `layers-shortcut-deselect`, `layers-shortcut-zoom`
- Added action messages: `layers-undo`, `layers-redo`, `layers-delete-selected`, `layers-duplicate-selected`
- Updated DialogManager to use existing i18n keys instead of non-existent ones

### Architecture
- CanvasRenderer now uses `getClass()` helper for namespace resolution
- Added DEPRECATED comments to direct `window.X` exports
- Added DialogManager backward compatibility export

### Documentation
- Updated all docs to reflect accurate codebase metrics
- Updated copilot-instructions.md with current architecture details
- Fixed README.md status and feature documentation
- Updated improvement_plan.md with current progress

### Tests
- All 3,869 Jest tests passing
- 88.4% statement coverage maintained

## [0.8.3] - 2025-12-10

### Features
- Named layer sets: Multiple annotation sets per image
- Version history: Up to 25 revisions per named set

### Bug Fixes
- Fixed shadow rendering issues (spread = 0)
- Fixed undo/redo functionality
- Fixed duplicate layer functionality
- Fixed selection state management

## [0.8.2] - 2025-12-09

### Features
- ShadowRenderer extracted from LayerRenderer
- Improved shadow effect calculations

### Bug Fixes
- Fixed shadow context issues
- Fixed shadow fill overlap

## [0.8.1-beta.1] - 2025-12-08

### Initial Beta Release
- Core annotation functionality
- 14 drawing tools
- MediaWiki integration
- Database persistence
