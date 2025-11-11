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

**Display all layers:**

```wikitext
[[File:MyImage.jpg|500px|layers=all|Annotated image]]
```

**Display specific layers by ID:**

```wikitext
[[File:MyImage.jpg|500px|layers=01,04,07|Selected annotations only]]
```

**Hide all layers (original image):**

```wikitext
[[File:MyImage.jpg|500px|layers=none]]
```

---

## Layer Management

- Layer IDs: `01`–`FF` (255 possible layers per image)
- Persistent IDs to ensure consistent embedding
- Layers can be grouped and nested
- Layer thumbnails auto-generated for quick recognition
- Merge layers or duplicate with one click

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

### Planned Shortcuts

| Action                   | Planned Shortcut |
| ------------------------ | ---------------- |
| Undo / Redo              | Ctrl+Z / Ctrl+Y  |
| Copy / Paste / Duplicate | Ctrl+C / Ctrl+V / Ctrl+D |
| Zoom In / Out / Reset    | Ctrl+`+` / Ctrl+`-` / Ctrl+0 |
| Pan Mode                 | Space + Drag     |
| Delete Selected          | Delete           |

---

## Technical Architecture

### Current Implementation

**Frontend (JavaScript):**
- HTML5 Canvas-based editor with SVG-like layer objects
- ES5-compatible JavaScript for MediaWiki compatibility
- Tool-based interaction system
- Basic layer management and rendering

**Backend (PHP):**
- MediaWiki extension integration
- API endpoints for layer data persistence
- Database storage with versioning support
- Security validation and rate limiting

**Current Architecture Challenges:**
- Large monolithic JavaScript files (CanvasManager.js: 5,462 lines)
- Limited modularization
- Basic state management

### Development Roadmap

**Phase 1 (Current):**
- ✅ Basic canvas editor functionality
- ✅ Essential drawing tools
- ✅ Database persistence
- ✅ MediaWiki integration

**Phase 2 (Planned - Architecture Refactoring):**
- Break down monolithic files into focused modules
- Implement proper state management patterns
- Add comprehensive testing coverage
- Webpack build optimization

**Phase 3 (Future - Advanced Features):**
- Modern ES6+ JavaScript with build pipeline
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

### Current Status (Updated August 2025)

The Layers MediaWiki extension is actively developed and functional with the following status:

#### ✅ Completed Features

- **Core Architecture**: Full separation between PHP backend and JavaScript frontend
- **Database Integration**: Complete schema with layers storage and retrieval
- **API Endpoints**: Working `ApiLayersInfo` and `ApiLayersSave` endpoints
- **MediaWiki Integration**: Hooks for UI, parser functions, and file handling
- **File Link Parameters**: Support for `layers=` parameter in standard file syntax
- **Basic Editor UI**: Canvas-based drawing interface with toolbar
- **Permissions System**: MediaWiki permissions integration
- **Installation Support**: Extension manifest and database schema
- **Magic Word Conflict Fixed**: Resolved parser initialization errors causing crashes

#### 📋 Code Quality Status

- **JavaScript**: 18 minor line-length warnings (ESLint compliant)
- **CSS**: Fully compliant with MediaWiki style guidelines
- **PHP**: 21 documentation errors, 50+ style warnings (mostly minor)
- **Tests**: Basic PHPUnit test framework in place
- **Linting**: All major violations resolved

#### 🔧 Known Issues

- Some PHP methods missing complete documentation
- Test methods need `@covers` tags for coverage analysis
- Minor line length violations in various files
- Debug/test files have class naming inconsistencies
- Parser functions ({{#layeredfile}}) temporarily disabled (use layers= parameter instead)

#### 🚀 Installation Ready

- Extension can be installed and activated
- Database tables created successfully
- Basic functionality operational
- Compatible with MediaWiki 1.44+

#### 🔄 Next Steps

1. Complete PHP documentation for all methods
2. Add comprehensive unit test coverage
3. Implement advanced drawing tools
4. Add layer export/import functionality
5. Enhance mobile responsiveness

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

