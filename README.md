# Layers – MediaWiki Extension

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today's most popular image editors.*

> **🔒 Security Update (November 10, 2025):** Critical security vulnerabilities have been fixed in this version. See [SECURITY_FIXES_2025-11-10.md](SECURITY_FIXES_2025-11-10.md) for details. Users running older versions should upgrade immediately.

---

## Overview

Layers is a **full-featured, non-destructive annotation editor** for images on a MediaWiki installation. It enables users to add captions, callouts, highlights, shapes, and freehand drawings **without altering the original image**.

All edits are stored as a validated JSON structure server-side and rendered client-side for precise positioning and small payloads. The system fully integrates into MediaWiki’s file pages and parser, allowing per-layer display control through wikitext parameters.

**Primary Goals:**

1. Preserve original images while allowing unlimited annotations.
2. Provide a modern, intuitive, and responsive editor UI.
3. Offer a full range of drawing, text, and shape tools with customizable properties.
4. Follow industry-standard UX conventions so users familiar with tools like Figma, Canva, Photoshop, or Google Drawings feel at home.

---

## UI & UX Design

### Current Editor Layout

The editor currently provides a functional single-panel design:

- **Canvas Area – Main Editing Interface**
  - HTML5 canvas with drawing capabilities
  - Zoom and pan functionality
  - Tool-based interaction system
  - Real-time layer rendering

- **Toolbar – Tool Selection**
  - 14 drawing and selection tools
  - Color picker and stroke width controls
  - Font selection for text tool
  - Keyboard shortcut support

- **Layer Management**
  - Basic layer list functionality
  - Layer visibility toggles
  - Layer selection and manipulation

### Development Roadmap for UI

**Phase 1 (Current) - Basic Editor:**
- ✅ Single-panel canvas interface
- ✅ Essential drawing tools
- ✅ Basic layer management

**Phase 2 (Planned) - Enhanced Layout:**
- Three-panel industry-standard design
- Dedicated layer panel with thumbnails
- Properties panel for detailed object editing
- Enhanced toolbar with grouped tools

**Phase 3 (Future) - Advanced Features:**
- Collapsible panels and workspace customization
- Grid and ruler system
- Smart guides and snapping
- Advanced layer operations (grouping, effects)

---

## Drawing Tools

The extension currently provides 14 drawing and selection tools:

| Tool          | Status | Purpose                                                      | Key Features                                             |
| ------------- | ------ | ------------------------------------------------------------ | -------------------------------------------------------- |
| Pointer       | ✅ Working | Select and manipulate objects                                | Multi-select, bounding box handles, resize, move        |
| Zoom          | ✅ Working | Zoom and pan the canvas                                      | Mouse wheel zoom, pan with drag                         |
| Text          | ✅ Working | Add text labels                                              | Font selection, size, color                             |
| Pen           | ✅ Working | Freehand drawing                                             | Smooth paths, adjustable stroke                         |
| Rectangle     | ✅ Working | Draw rectangles                                              | Adjustable stroke and fill                              |
| Circle        | ✅ Working | Draw circles                                                 | Radius-based drawing                                     |
| Ellipse       | ✅ Working | Draw ellipses                                                | Independent X/Y radius control                          |
| Polygon       | ✅ Working | Draw polygons                                                | Configurable number of sides                            |
| Star          | ✅ Working | Draw star shapes                                             | Configurable points and radii                           |
| Arrow         | ✅ Working | Annotation arrows                                            | Configurable arrowheads and line styles                 |
| Line          | ✅ Working | Straight lines                                               | Stroke width and color options                          |
| Highlight     | ✅ Working | Semi-transparent highlighting                                | Overlay highlighting with transparency                   |
| Blur          | ✅ Working | Blur/redact areas                                            | Privacy protection tool                                  |
| Marquee       | ✅ Working | Area selection                                               | Multi-object selection                                   |

### Current Tool Capabilities

**Implemented Drawing Features:**
- Basic shape drawing (rectangle, circle, ellipse, polygon, star)
- Freehand drawing with pen tool
- Text annotation with font options
- Arrow and line drawing
- Area highlighting and blurring
- Object selection and manipulation

**Style Options Currently Available:**
- Stroke color and width
- Fill colors and transparency
- Font family and size selection
- Basic transparency controls

### Planned Tool Enhancements

**Future Development:**
- Advanced text formatting (rich text, alignment options)
- Gradient fills and advanced patterns
- Custom brush options for pen tool
- More complex shape tools
- Layer effects (shadow, glow, etc.)
- Import/export capabilities

---

## Styling & Effects

### Current Styling Options

**Basic Stroke Options:**
- Solid color strokes
- Adjustable stroke width
- Color picker interface

**Fill Options:**
- Solid color fills
- Transparency controls
- Basic color selection

**Text Styling:**
- Font family selection
- Font size controls
- Text color options

**Basic Effects:**
- Layer transparency/opacity
- Highlight tool with transparency
- Blur tool for privacy

### Planned Styling Enhancements

**Advanced Fill Options:**
- Linear and radial gradients
- Pattern fills
- Image pattern integration

**Enhanced Stroke Options:**
- Dashed and dotted line styles
- Custom dash patterns
- Stroke alignment options

**Advanced Text Features:**
- Rich text formatting
- Text shadows and outlines
- Advanced alignment options

**Layer Effects:**
- Drop shadows with customizable offset/blur
- Glow effects (inner and outer)
- Blend modes (multiply, overlay, screen)
- Layer-level opacity controls

---

## Wikitext Integration

Layers are displayed using standard MediaWiki file syntax with the `layers=` parameter:

**Show default layer set:**

```wikitext
[[File:MyImage.jpg|500px|layers=on|Annotated image]]
```

**Show a specific named layer set:**

```wikitext
[[File:MyImage.jpg|500px|layers=anatomy|Anatomy annotations]]
```

**Explicitly disable layers (original image only):**

```wikitext
[[File:MyImage.jpg|500px|layers=none]]
```

> **Note:** On File: pages, layers are NOT auto-displayed. You must explicitly use `layers=on` or `layers=setname` in wikitext to show annotations.

---

## Layer Management

### Current Features

- **Layer IDs**: UUID-based unique identifiers for reliable referencing
- **Named Layer Sets**: Multiple named annotation sets per image (e.g., "default", "anatomy-labels")
- **Version History**: Each named set maintains revision history (up to 25 revisions by default)
- **Visibility Toggles**: Show/hide individual layers in the editor
- **Layer Ordering**: Drag-and-drop reordering in layer panel
- **Duplicate Layers**: Copy existing layers with offset positioning

### Wikitext Display Options

```wikitext
[[File:Example.jpg|layers=on]]           <!-- Show default layer set -->
[[File:Example.jpg|layers=anatomy]]      <!-- Show specific named set -->
[[File:Example.jpg|layers=none]]         <!-- Explicitly disable layers -->
```

### Planned Features

- Layer grouping and nesting
- Layer thumbnails for quick visual recognition
- Merge layers functionality
- Export/import layer sets

---

## Keyboard Shortcuts

### Currently Implemented Shortcuts

| Action                   | Shortcut  | Status |
| ------------------------ | --------- | ------ |
| Select Tool              | V         | ✅ Working |
| Zoom Tool                | Z         | ✅ Working |
| Text Tool                | T         | ✅ Working |
| Pen Tool                 | P         | ✅ Working |
| Rectangle Tool           | R         | ✅ Working |
| Circle Tool              | C         | ✅ Working |
| Ellipse Tool             | E         | ✅ Working |
| Polygon Tool             | G         | ✅ Working |
| Star Tool                | S         | ✅ Working |
| Arrow Tool               | A         | ✅ Working |
| Line Tool                | L         | ✅ Working |
| Highlight Tool           | H         | ✅ Working |
| Blur Tool                | B         | ✅ Working |
| Marquee Select           | M         | ✅ Working |
| Undo                     | Ctrl+Z    | ✅ Working |
| Redo                     | Ctrl+Y / Ctrl+Shift+Z | ✅ Working |
| Copy                     | Ctrl+C    | ✅ Working |
| Paste                    | Ctrl+V    | ✅ Working |
| Delete                   | Delete    | ✅ Working |

### Planned Shortcuts

| Action                   | Planned Shortcut |
| ------------------------ | ---------------- |
| Zoom In / Out / Reset    | Ctrl+`+` / Ctrl+`-` / Ctrl+0 |
| Duplicate                | Ctrl+D |
| Pan Mode                 | Space + Drag     |

---

## Technical Architecture

### Current Implementation

**Frontend (JavaScript):**
- HTML5 Canvas-based editor with SVG-like layer objects
- Hybrid module pattern: ES6 classes + IIFE wrappers with namespaced exports
- Tool-based interaction system with ModuleRegistry for dependency management
- StateManager for centralized state with property descriptors bridging legacy access
- HistoryManager for undo/redo operations
- **Viewer/Editor code splitting**: Viewer ~4K lines, Editor ~31K lines (separate modules)

**Backend (PHP):**
- MediaWiki extension integration via hooks and service wiring
- API endpoints: `ApiLayersInfo` (read) and `ApiLayersSave` (write with CSRF)
- Database storage with named layer sets and revision history
- Server-side validation with strict property whitelist (40+ allowed fields)
- Rate limiting via MediaWiki's pingLimiter system

**Test Coverage (December 2025):**
- Jest: 3,877 tests with 89.65% statement coverage
- PHPUnit: 17 test files covering API, database, and validation
- LayerRenderer.js: 89% coverage with 146 dedicated tests

**Architecture Notes:**
- 17 files use ES6 classes, 19 still use prototype pattern (migration in progress)
- Memory management verified clean (EventTracker pattern throughout)
- Controllers extracted from CanvasManager (9 specialized controllers with 85%+ coverage)

### Development Roadmap

**Phase 1 (Current):**
- ✅ Basic canvas editor functionality
- ✅ Essential drawing tools (14 tools)
- ✅ Database persistence with named sets
- ✅ MediaWiki integration
- ✅ Comprehensive test coverage

**Phase 2 (Planned - Architecture Refactoring):**
- Break down god classes into focused modules (~500 lines each)
- Consolidate global exports to single namespace
- Complete StateManager migration (remove direct property access)
- ES6 module migration with build pipeline

**Phase 3 (Future - Advanced Features):**
- Performance optimizations for large images
- Real-time collaborative editing capabilities
- Plugin API for custom tools

---

## Planned Enhancements

- Mobile/touch UI for tablets
- Collaborative real-time editing
- Plugin API for custom tools
- Asset library integration

---

## Installation (For Developers/Testers Only)

```bash
cd extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
composer install
npm install
```

Add to `LocalSettings.php`:

```php
wfLoadExtension( 'Layers' );
$wgLayersEnable = true;
$wgGroupPermissions['user']['editlayers'] = true;
```

Run database updates:

```bash
php maintenance/update.php
```

### Configuration (LocalSettings.php) examples

Add or adjust these optional settings to tune performance and limits. Values shown are safe defaults; increase carefully on large wikis.

```php
// Master switch
$wgLayersEnable = true;

// Debug logging (to MediaWiki 'Layers' channel)
$wgLayersDebug = true;

// Server-side validation limits
$wgLayersMaxBytes = 2 * 1024 * 1024; // 2 MB per layer set JSON
$wgLayersMaxLayerCount = 100;        // Max layers per set

// Image processing limits
$wgLayersMaxImageSize = 4096;        // Max px for editing
$wgLayersMaxImageDimensions = [ 8192, 8192 ];
$wgLayersImageMagickTimeout = 20;    // Seconds

// Caching
$wgLayersThumbnailCache = true;

// Permissions (defaults enable edit for logged-in users)
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

// Rate limits (examples; tune for your wiki size)
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];
```

---

## Security Features

- Input validation on all layer data
- CSRF protection for API endpoints
- MediaWiki permissions integration
- Rate limiting on save operations
- File validation for supported types

## Security: Content Security Policy (CSP)

See docs/CSP_GUIDE.md for recommended CSP settings and common pitfalls when running Layers under a strict CSP.

---

## Development Status

### Current Status (Updated December 2025)

The Layers MediaWiki extension is actively developed and production-ready with the following status:

#### ✅ Completed Features

- **Core Architecture**: Full separation between PHP backend and JavaScript frontend
- **Database Integration**: Complete schema with named layer sets and revision history
- **API Endpoints**: Working `ApiLayersInfo` and `ApiLayersSave` endpoints
- **MediaWiki Integration**: Hooks for UI, parser functions, and file handling
- **File Link Parameters**: Support for `layers=` parameter in standard file syntax
- **Full Editor UI**: Canvas-based drawing interface with 14 tools
- **Permissions System**: MediaWiki permissions integration with rate limiting
- **Named Layer Sets**: Multiple annotation sets per image (e.g., "default", "anatomy")
- **Version History**: Revision tracking per layer set (configurable, default 25)
- **Comprehensive Tests**: 3,877+ Jest tests, 89.65% coverage

#### 📋 Code Quality Status

- **JavaScript**: Fully ESLint compliant (no-var, prefer-const enforced)
- **CSS**: Fully compliant with MediaWiki style guidelines (Stylelint)
- **PHP**: All lint/style checks passing (phpcs, parallel-lint)
- **Tests**: Comprehensive Jest + PHPUnit coverage
- **Memory Management**: Verified clean (EventTracker pattern throughout)

#### 🚀 Production Ready

- Extension installs cleanly on MediaWiki 1.44+
- Database tables created via `maintenance/update.php`
- All 14 drawing tools functional
- Named layer sets and revision history working
- Viewer/Editor code properly split for performance

#### 🔄 Ongoing Development

See [improvement_plan.md](improvement_plan.md) for detailed roadmap:
1. ES6 class migration (17/36 files complete)
2. Global export consolidation to namespaced pattern
3. Large file refactoring (CanvasManager, LayerPanel)

To verify basic setup, use MediaWiki's maintenance update and open a File page to load the editor. A dedicated test script is not included; use the static checks below.

---

## Troubleshooting

- Quick guide: docs/layers-all-troubleshooting.md — end‑to‑end checks when images don’t show layers with layers=all.
- General tips: see docs/layers-all-troubleshooting.md.

### Developer quick checks

After installing PHP and Node dev dependencies, you can run the basic static checks:

```bash
npm run test:php
npm test
```

On Windows, some users have a Python package named "composer" on PATH that hijacks the `composer` command. If you hit errors running `composer test`, run the PHP checks via npm instead:

```bash
npm run test:php   # runs php-parallel-lint, phpcs, minus-x
```

To run the smoke test in a MediaWiki maintenance environment:

```bash
php maintenance/runScript.php extensions/Layers/tests/LayersTest.php
```

---

## License

GPL-2.0-or-later

