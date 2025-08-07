# Layers MediaWiki Extension

A **non-destructive image editing extension** for MediaWiki that allows users to add annotation layers to images without modifying the original files. Layers are stored as SVG-based vector graphics and can be selectively displayed through wikitext parameters.

## Overview

The Layers extension provides a comprehensive image annotation system that:

- **Preserves original images**: All modifications are stored as separate layer data
- **Supports selective display**: Show all layers, specific layers, or no layers via wikitext
- **Uses vector graphics**: Layers are stored in SVG format for scalability and quality
- **Integrates seamlessly**: Works with MediaWiki's existing file system and thumbnails
- **Provides professional tools**: Full-featured editor with advanced drawing and editing capabilities

## ⚠️ Current Status: DEVELOPMENT VERSION (v0.8.1-dev)

**This extension is currently ~75% complete and is NOT ready for production use.**

### What Actually Works Now

#### ✅ Comprehensive Drawing Tools
- **Pointer Tool** - Object selection, transformation, and multi-selection
- **Text Tool** - Multi-line text with comprehensive typography controls
- **Pen Tool** - Freehand drawing with pressure-sensitive strokes
- **Shape Tools** - Rectangle, Circle, Ellipse, Polygon, Star with full parameter control
- **Arrow Tool** - Configurable arrows (single, double, line-only)
- **Line Tool** - Straight lines with stroke styling
- **Highlight Tool** - Semi-transparent highlighting rectangles
- **Marquee Tool** - Area selection for multiple objects

#### ✅ Professional Editing Features
- **Object Manipulation** - Move, resize, rotate with visual handles
- **Multi-selection** - Ctrl+click, marquee selection, group operations
- **Layer Management** - Create, delete, reorder, show/hide layers
- **Copy/Paste System** - Multi-object clipboard with smart positioning
- **Undo/Redo** - 50-step history with keyboard shortcuts
- **Zoom & Pan** - Mouse wheel zoom, space+drag panning, fit-to-window
- **Grid System** - Visual grid with snap-to-grid functionality
- **Keyboard Shortcuts** - Professional hotkeys (Ctrl+Z/Y/S/D, tool shortcuts)

#### ✅ Backend Infrastructure

- **Database Storage** - Secure layer data storage with versioning
- **API Integration** - RESTful endpoints for save/load operations
- **Security Framework** - Input validation, CSRF protection, user permissions
- **MediaWiki Integration** - "Edit Layers" tab on file pages

### Critical Missing Features (Blocking Production)

#### ❌ Integration and Testing Gaps

- **Integration Testing**: End-to-end functionality verification needed
- **ImageMagick Configuration**: MediaWiki ImageMagick settings verification
- **Parser Integration**: Final wikitext support completion
- **File Path Resolution**: Thumbnail URL generation refinement

#### ❌ Production Deployment Issues

- **Code Quality**: ESLint violations and PHP code standards
- **Testing Coverage**: Comprehensive unit and integration tests
- **Browser Compatibility**: ES2015+ polyfills for older browsers
- **Performance**: Memory management for large images and complex scenes

## Wikitext Usage

The extension integrates seamlessly with MediaWiki's file syntax:

### Display All Layers
```wikitext
[[File:MyImage.jpg|500px|layers=all|Caption]]
```

### Display Specific Layers
```wikitext
[[File:MyImage.jpg|500px|layers=01,03,05|Caption with selected layers]]
```

### Display No Layers (Original Image)
```wikitext
[[File:MyImage.jpg|500px|layers=none|Original image]]
<!-- or simply omit the layers parameter -->
[[File:MyImage.jpg|500px|Original image]]
```

## Layer Management System

### Layer ID System

- **Layer 00**: Reserved for parent image (read-only base layer)
- **Layer IDs**: Hexadecimal IDs from 01-FF (255 maximum layers per image)
- **ID Assignment**: Incremental assignment, deleted IDs recycled after FF
- **Persistence**: Layer IDs remain constant for reliable wikitext references

### Layer Storage Format

- **Primary Format**: SVG-based vector graphics for scalability
- **Fallback**: JSON object definitions for complex shapes
- **Versioning**: Complete layer history with undo/redo support
- **Compression**: Optimized storage for efficient database usage

## Drawing Tools and Parameters

### Text Tool

**Purpose**: Create multi-line text annotations with full typography control

**Parameters**:

- **Font**
  - `fontFamily`: Arial, Roboto, Noto Sans, Times New Roman, Courier New
  - `fontSize`: 8-72px, default 16px
  - `fontStyle`: normal, italic
  - `fontWeight`: normal, bold
  - `textAlign`: left, center, right
  - `lineHeight`: 1.0-3.0, default 1.2
- **Stroke (Outline)**
  - `strokeColor`: Any hex color or 'none' for transparent
  - `strokeWidth`: 0-10px, default 0 (no stroke)
  - `strokeOpacity`: 0-100%, default 100%
- **Fill**
  - `fillColor`: Any hex color or 'none' for transparent
  - `fillOpacity`: 0-100%, default 100%
- **Drop Shadow**
  - `shadowEnabled`: true/false
  - `shadowColor`: Any hex color, default #000000
  - `shadowOffsetX`: -20 to 20px, default 2px
  - `shadowOffsetY`: -20 to 20px, default 2px
  - `shadowBlur`: 0-20px, default 4px
  - `shadowOpacity`: 0-100%, default 50%

### Rectangle Tool

**Purpose**: Create rectangular shapes with customizable appearance

**Parameters**:

- **Stroke**
  - `strokeStyle`: solid, dashed, dotted, dash-dot
  - `strokeColor`: Any hex color or 'none'
  - `strokeWidth`: 0-20px, default 2px
  - `strokeOpacity`: 0-100%, default 100%
  - `dashArray`: Custom dash pattern (e.g., "5,5" for equal dashes)
- **Fill**
  - `fillColor`: Any hex color or 'none' for transparent
  - `fillOpacity`: 0-100%, default 100%
  - `gradient`: linear, radial, or none
  - `gradientStops`: Array of color stops for gradients
- **Corners**
  - `cornerRadius`: 0-50px, 0 for sharp corners
  - `cornerStyle`: rounded, beveled, chamfered
- **Drop Shadow**
  - `shadowEnabled`: true/false
  - `shadowColor`: Any hex color
  - `shadowOffsetX`: -50 to 50px
  - `shadowOffsetY`: -50 to 50px
  - `shadowBlur`: 0-50px
  - `shadowSpread`: -20 to 20px (inset/outset)
  - `shadowOpacity`: 0-100%

### Circle/Ellipse Tool

**Purpose**: Create circular and elliptical shapes

**Parameters**:

- **Dimensions**
  - `radiusX`: For ellipses, horizontal radius
  - `radiusY`: For ellipses, vertical radius
  - `radius`: For circles, uniform radius
- **Stroke** (same as Rectangle)
- **Fill** (same as Rectangle)
- **Drop Shadow** (same as Rectangle)

### Polygon Tool

**Purpose**: Create multi-sided polygons

**Parameters**:

- **Shape**
  - `sides`: 3-20 sides, default 6
  - `starMode`: true/false for star vs. polygon
  - `innerRadius`: For stars, ratio of inner to outer radius (0.1-0.9)
- **Stroke** (same as Rectangle)
- **Fill** (same as Rectangle)
- **Drop Shadow** (same as Rectangle)

### Star Tool

**Purpose**: Create star shapes with configurable points

**Parameters**:

- **Shape**
  - `points`: 3-20 points, default 5
  - `outerRadius`: Outer point radius
  - `innerRadius`: Inner point radius (0.1-0.9 ratio)
  - `rotation`: 0-360 degrees
- **Stroke** (same as Rectangle)
- **Fill** (same as Rectangle)
- **Drop Shadow** (same as Rectangle)

### Arrow Tool

**Purpose**: Create directional arrows for annotations

**Parameters**:

- **Arrow Style**
  - `arrowType`: single, double, line-only
  - `headStyle`: triangle, circle, diamond, square
  - `headSize`: 5-50px, default 15px
  - `headWidth`: 0.5-3.0 ratio to head size
- **Line**
  - `strokeStyle`: solid, dashed, dotted
  - `strokeColor`: Any hex color
  - `strokeWidth`: 1-20px
  - `strokeOpacity`: 0-100%
- **Drop Shadow** (same as Rectangle)

### Line Tool

**Purpose**: Create straight lines

**Parameters**:

- **Stroke**
  - `strokeStyle`: solid, dashed, dotted, dash-dot
  - `strokeColor`: Any hex color
  - `strokeWidth`: 1-20px
  - `strokeOpacity`: 0-100%
  - `lineCap`: butt, round, square
  - `dashArray`: Custom dash patterns
- **Drop Shadow** (same as Rectangle)

### Pen Tool

**Purpose**: Freehand drawing with natural stroke simulation

**Parameters**:

- **Stroke**
  - `strokeColor`: Any hex color
  - `strokeWidth`: 1-50px with pressure sensitivity
  - `strokeOpacity`: 0-100%
  - `smoothing`: 0-100%, automatic curve smoothing
  - `pressureSensitive`: true/false
- **Brush**
  - `brushType`: round, square, calligraphy
  - `hardness`: 0-100%, edge softness
  - `spacing`: 1-100%, dot spacing for textured strokes
- **Drop Shadow** (optional, same as other tools)

### Highlight Tool

**Purpose**: Create semi-transparent highlighting overlays

**Parameters**:

- **Fill**
  - `fillColor`: Any hex color, typically bright colors
  - `fillOpacity`: 10-80%, default 30%
  - `blendMode`: multiply, screen, overlay, soft-light
- **Stroke** (optional)
  - `strokeColor`: Usually same as fill or slightly darker
  - `strokeWidth`: 0-5px, default 0
  - `strokeOpacity`: 0-100%

### Marquee Selection Tool

**Purpose**: Area-based selection of multiple objects

**Parameters**:

- **Selection Behavior**
  - `selectionMode`: intersect, contain, touch
  - `addToSelection`: true/false (Ctrl modifier)
  - `subtractFromSelection`: true/false (Alt modifier)

## Layer Properties

Each layer supports the following global properties:

### Visibility and Opacity

- **Visible**: true/false, layer visibility toggle
- **Opacity**: 0-100%, overall layer transparency
- **BlendMode**: normal, multiply, screen, overlay, soft-light, hard-light, color-dodge, color-burn, darken, lighten, difference, exclusion

### Layer Effects

- **Drop Shadow**: Global layer shadow (separate from object shadows)
- **Glow**: Outer glow effect with color and intensity
- **Stroke**: Global stroke effect applied to all layer objects

### Layer Management

- **Name**: User-friendly layer name
- **Locked**: Prevent editing of layer contents
- **Cloned**: Indicates if layer is a clone of another layer (including layer 00)

## Editor Interface

### Layout

- **Left Panel**: Layer management with drag-reorder functionality
- **Center Canvas**: Zoomable/pannable image editing area with grid
- **Bottom Panel**: Properties panel for selected objects/layers
- **Top Toolbar**: Drawing tools, style controls, and action buttons

### Toolbar Sections

1. **Tools**: All drawing and selection tools with keyboard shortcuts
2. **Style**: Color picker, stroke width, tool-specific parameters
3. **Effects**: Layer opacity, blend modes, effect toggles
4. **Zoom**: Zoom controls, fit-to-window, grid toggle
5. **Actions**: Undo/redo, delete, duplicate, save/cancel

### Keyboard Shortcuts

- **Tools**: V (pointer), T (text), P (pen), R (rectangle), C (circle), A (arrow), L (line), H (highlight), G (grid toggle)
- **Actions**: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+S (save), Ctrl+D (duplicate), Delete (delete selected)
- **Selection**: Ctrl+A (select all), Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut)
- **View**: Ctrl++ (zoom in), Ctrl+- (zoom out), Ctrl+0 (reset zoom), Space+Drag (pan)

## Technical Architecture

### Frontend (JavaScript)

- **LayersEditor.js**: Main editor orchestration and state management
- **CanvasManager.js**: HTML5 Canvas rendering and user interaction
- **Toolbar.js**: Tool selection and parameter controls
- **LayerPanel.js**: Layer management interface

### Backend (PHP)

- **ApiLayersInfo.php**: Load layer data for specific images
- **ApiLayersSave.php**: Save layer modifications with validation
- **LayersDatabase.php**: Database operations and schema management
- **UIHooks.php**: MediaWiki integration (Edit Layers tab)

### Data Flow

1. **Load**: Editor requests layer data via ApiLayersInfo
2. **Edit**: User modifies layers using drawing tools
3. **State**: All changes tracked in JavaScript layer array
4. **Save**: Complete layer state posted to ApiLayersSave as JSON
5. **Display**: Wikitext parser requests specific layers for thumbnails

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

## Development Setup

For code quality checks:

```bash
npm test          # JavaScript linting
composer test     # PHP code standards
```

## Configuration Options

Available in `LocalSettings.php`:

```php
// Master enable/disable switch
$wgLayersEnable = true;

// Maximum JSON size per layer set (2MB default)
$wgLayersMaxBytes = 2097152;

// Available fonts in editor
$wgLayersDefaultFonts = [
    'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Courier New'
];

// Maximum image dimensions for layer editing
$wgLayersMaxImageSize = 4096;
$wgLayersMaxImageDimensions = 8192;

// Enable thumbnail caching
$wgLayersThumbnailCache = true;

// ImageMagick timeout for composite operations
$wgLayersImageMagickTimeout = 30;
```

## Permissions

```php
// Grant layer editing permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
```

## Security Features

- **Input Validation**: All layer data sanitized before storage
- **CSRF Protection**: API endpoints protected against cross-site requests
- **Permission Integration**: Respects MediaWiki user rights system
- **Rate Limiting**: Prevents abuse of layer save operations
- **File Validation**: Only processes valid MediaWiki files

## Contributing

This extension is under active development. Contributors welcome!

### Priority Development Areas

1. **Server-side rendering completion** - ImageMagick thumbnail generation
2. **Parser integration finalization** - Complete wikitext layer support
3. **Code quality improvements** - Resolve linting violations
4. **Comprehensive testing** - Unit and integration test coverage
5. **Performance optimization** - Large image and complex scene handling

## License

GPL-2.0-or-later

---

**Note**: This is a development version. The extension provides comprehensive layer editing capabilities but requires completion of server-side rendering and final integration testing before production deployment.
