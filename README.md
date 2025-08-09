# Layers – MediaWiki Extension

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today’s most popular image editors.*

---

## Overview

Layers is a **full-featured, non-destructive annotation editor** for images on a MediaWiki installation. It enables users to add captions, callouts, highlights, shapes, and freehand drawings **without altering the original image**.

All edits are stored as **SVG vector graphics** for infinite scalability, precise positioning, and small file sizes. The system fully integrates into MediaWiki’s file pages and parser, allowing per-layer display control through wikitext parameters.

**Primary Goals:**

1. Preserve original images while allowing unlimited annotations.
2. Provide a modern, intuitive, and responsive editor UI.
3. Offer a full range of drawing, text, and shape tools with customizable properties.
4. Follow industry-standard UX conventions so users familiar with tools like Figma, Canva, Photoshop, or Google Drawings feel at home.

---

## UI & UX Design

### Editor Layout

The editor follows a **three-panel industry-standard design**:

- **Left Sidebar – Layer Management**

  - Collapsible list of all layers (with thumbnails)
  - Drag-and-drop reordering
  - Eye icon for visibility toggle
  - Lock icon to prevent edits
  - Right-click context menu (rename, duplicate, merge down, delete)

- **Center Canvas – Editing Area**

  - Infinite canvas with zoom and pan
  - Responsive scaling with grid and snap-to-grid
  - Semi-transparent checkerboard background for transparency awareness
  - Rulers along top and left edges with draggable guides

- **Right Sidebar – Properties & Styles**

  - Context-sensitive panel:
    - **Object Properties Tab** (position, size, rotation)
    - **Style Tab** (fill, stroke, shadow, blend modes)
    - **Text Tab** (font, size, spacing, alignment)
    - **Effects Tab** (glow, shadow, outline)

- **Top Toolbar – Tools & Actions**

  - Tool icons with hover tooltips and shortcut keys
  - Color pickers with saved swatches
  - Undo/redo, copy/paste, save/cancel buttons
  - Zoom controls, fit-to-screen, and 100% view

- **Bottom Bar – Status & Context**

  - Current zoom level
  - Mouse coordinates in image space
  - Selected object count and dimensions

---

## Drawing Tools

| Tool          | Purpose                                                      | Key Features                                             |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Pointer       | Select and manipulate objects                                | Multi-select, bounding box handles, rotate, resize, snap |
| Text          | Add multi-line captions/labels                               | Rich text, live font preview, stroke/fill, drop shadow   |
| Pen/Brush     | Freehand drawing                                             | Pressure sensitivity, smoothing, custom brushes          |
| Shape Tools   | Rectangle, Rounded Rectangle, Circle, Ellipse, Polygon, Star | Adjustable radii, gradient fills, strokes, shadows       |
| Arrow         | Annotation arrows                                            | Configurable heads, line style, curve or straight        |
| Line          | Straight connectors                                          | Dashed/dotted patterns, arrow ends                       |
| Highlighter   | Semi-transparent emphasis                                    | Blend modes for overlay effects                          |
| Image Import  | Add overlay images                                           | Scaling, opacity, blend modes                            |
| Callout Tool  | Speech & thought bubbles                                     | Adjustable tails, styles, fill/stroke options            |
| Blur/Pixelate | Sensitive info obfuscation                                   | Adjustable radius or pixel size                          |
| Marquee       | Area selection                                               | Intersect/contain modes, transform multiple objects      |

---

## Styling & Effects

**Fill Options:**

- Solid color
- Linear/radial gradients
- Image pattern fill (SVG pattern or uploaded swatch)

**Stroke Options:**

- Solid, dashed, dotted, dash-dot
- Custom dash arrays
- Stroke alignment: inside, center, outside

**Text Typography:**

- Fonts: Full system & Google Fonts support
- Font size, weight, style, letter spacing, line height
- Horizontal & vertical alignment
- Text outline and shadow

**Effects:**

- Drop shadow (color, offset, blur, spread)
- Outer glow / inner glow
- Opacity (per-object & per-layer)
- Blend modes (normal, multiply, screen, overlay, etc.)

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

| Action                   | Shortcut                     |
| ------------------------ | ---------------------------- |
| Select Tool              | V                            |
| Text Tool                | T                            |
| Rectangle Tool           | R                            |
| Ellipse Tool             | E                            |
| Arrow Tool               | A                            |
| Line Tool                | L                            |
| Pen Tool                 | P                            |
| Highlighter Tool         | H                            |
| Undo / Redo              | Ctrl+Z / Ctrl+Y              |
| Copy / Paste / Duplicate | Ctrl+C / Ctrl+V / Ctrl+D     |
| Zoom In / Out / Reset    | Ctrl+`+` / Ctrl+`-` / Ctrl+0 |
| Pan                      | Space + Drag                 |

---

## Technical Architecture

**Frontend:**

- Modern ES6+ JavaScript with Webpack build
- HTML5 Canvas + SVG rendering
- Modular tool components with isolated state

**Backend:**

- PHP for MediaWiki integration
- API endpoints for load/save layer JSON
- Secure database layer storage with versioning

**Performance Considerations:**

- Incremental save to reduce data load
- Object diffing for minimal network payload
- Lazy-loading large image resources

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

---

## Security Features

- Input validation on all layer data
- CSRF protection for API endpoints
- MediaWiki permissions integration
- Rate limiting on save operations
- File validation for supported types

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

Use `test-installation.php` to verify your installation is working correctly.

### Developer quick checks

After installing PHP and Node dev dependencies, you can run the basic static checks:

```bash
composer test
npm test
```

To run the smoke test in a MediaWiki maintenance environment:

```bash
php maintenance/runScript.php extensions/Layers/tests/LayersTest.php
```

---

## License

GPL-2.0-or-later

