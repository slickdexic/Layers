# Layers – MediaWiki Extension

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml)

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today's most popular image editors.*

> **Status:** Stable. Version 1.1.0. Requires MediaWiki 1.44+.
>
> **Branch:** REL1_39 (for MediaWiki 1.39.x - 1.43.x). For MediaWiki 1.44+, use the `main` branch.

---

## Overview

Layers is a **full-featured, non-destructive annotation editor** for images on a MediaWiki installation. It enables users to add captions, callouts, highlights, shapes, and freehand drawings **without altering the original image**.

All edits are stored as a validated JSON structure server-side and rendered client-side for precise positioning and small payloads. The system fully integrates into MediaWiki's file pages and parser, allowing per-layer display control through wikitext parameters.

**Primary Goals:**

1. Preserve original images while allowing unlimited annotations.
2. Provide a modern, intuitive, and responsive editor UI.
3. Offer a full range of drawing, text, and shape tools with customizable properties.
4. Follow industry-standard UX conventions so users familiar with tools like Figma, Canva, Photoshop, or Google Drawings feel at home.

---

## Features

### Drawing Tools (13 Available)

| Tool          | Shortcut | Purpose                                      | Key Features                                    |
| ------------- | -------- | -------------------------------------------- | ----------------------------------------------- |
| Pointer       | V        | Select and manipulate objects                | Multi-select, bounding box handles, resize, move |
| Zoom          | Z        | Zoom and pan the canvas                      | Mouse wheel zoom, pan with drag                 |
| Text          | T        | Add text labels                              | Font selection, size, color, stroke, shadow     |
| **Text Box**  | **X**    | **Multi-line text in container** (NEW v1.1)  | Word wrap, alignment, padding, corner radius    |
| Pen           | P        | Freehand drawing                             | Smooth paths, adjustable stroke                 |
| Rectangle     | R        | Draw rectangles                              | Adjustable stroke and fill                      |
| Circle        | C        | Draw circles                                 | Radius-based drawing                            |
| Ellipse       | E        | Draw ellipses                                | Independent X/Y radius control                  |
| Polygon       | G        | Draw polygons                                | Configurable number of sides                    |
| Star          | S        | Draw star shapes                             | Configurable points and radii                   |
| Arrow         | A        | Annotation arrows                            | Configurable arrowheads and line styles         |
| Line          | L        | Straight lines                               | Stroke width and color options                  |
| Blur          | B        | Blur/redact areas                            | Privacy protection tool                         |

### New in v1.1.0: Text Box Tool

The Text Box tool combines a rectangle container with rich text:

- **Multi-line text** with automatic word wrapping
- **Font options**: Arial, Roboto, Noto Sans, Times New Roman, Courier New
- **Text formatting**: Bold and italic
- **Alignment**: Horizontal (left/center/right) and vertical (top/middle/bottom)
- **Container styling**: Corner radius, padding, stroke, fill
- **Text effects**: Stroke outline and drop shadow with customizable blur/offset

### Layer Management

- **Named Layer Sets**: Multiple annotation sets per image (e.g., "default", "anatomy-labels")
- **Version History**: Each named set maintains revision history (up to 50 revisions by default)
- **Per-Set Background Settings**: Background visibility and opacity saved independently per layer set
- **Import Image Layer**: Add external images (logos, icons, photos) as new layers
- **Layer Operations**: Visibility toggles, lock/unlock, reorder via drag-and-drop, duplicate
- **Export as Image**: Download annotated images as PNG with optional background
- **UUID-based IDs**: Reliable layer referencing

### Style Options

- Stroke color and width
- Fill colors with transparency
- Shadow effects (with spread, offset, color)
- Text stroke and text shadow (NEW v1.1)
- Blend modes
- Font family and size selection
- Opacity controls

### Accessibility

- **Skip Links**: Jump directly to toolbar, canvas, or layer panel
- **ARIA Landmarks**: Semantic regions for screen reader navigation
- **Keyboard Navigation**: Full keyboard support with discoverable shortcuts
- **Focus Management**: Visible focus indicators throughout the interface
- **Live Regions**: Status updates announced to assistive technologies

---

## Wikitext Integration

Layers are displayed using standard MediaWiki file syntax with the `layers=` parameter:

```wikitext
[[File:MyImage.jpg|500px|layers=on|Annotated image]]     <!-- Default layer set -->
[[File:MyImage.jpg|500px|layers=anatomy|Anatomy labels]] <!-- Named set -->
[[File:MyImage.jpg|500px|layers=none]]                   <!-- No layers -->
```

> **Note:** On File: pages, layers are NOT auto-displayed. You must explicitly use `layers=on` or `layers=setname` in wikitext to show annotations.

---

## Keyboard Shortcuts

| Action                   | Shortcut              |
| ------------------------ | --------------------- |
| Select Tool              | V                     |
| Zoom Tool                | Z                     |
| Text Tool                | T                     |
| Text Box Tool            | X                     |
| Pen Tool                 | P                     |
| Rectangle Tool           | R                     |
| Circle Tool              | C                     |
| Ellipse Tool             | E                     |
| Polygon Tool             | G                     |
| Star Tool                | S                     |
| Arrow Tool               | A                     |
| Line Tool                | L                     |
| Blur Tool                | B                     |
| Marquee Select           | M                     |
| Toggle Background        | Shift+B               |
| Undo                     | Ctrl+Z                |
| Redo                     | Ctrl+Y / Ctrl+Shift+Z |
| Copy                     | Ctrl+C                |
| Paste                    | Ctrl+V                |
| Delete                   | Delete                |
| Show Keyboard Help       | Shift+?               |

---

## Technical Details

**Architecture:**
- **Backend (PHP):** MediaWiki extension integration, 4 API endpoints (`layersinfo`, `layerssave`, `layersdelete`, `layersrename`), database persistence
- **Frontend (JavaScript):** HTML5 Canvas-based editor with 76 JS files (~40K lines total)
- **Code Splitting:** Viewer module (682 lines) + Shared module (~5K lines) loads separately from Editor (~34K lines)

**Test Coverage (December 2025):**
- Jest: ~4,800 tests, ~91% statement coverage, ~78% branch coverage (99 test suites)
- PHPUnit: 17 test files covering API, database, validation

**Accessibility (WCAG 2.1):**
- Skip links for keyboard navigation (WCAG 2.4.1)
- ARIA landmarks on all major sections (WCAG 1.3.1)
- Keyboard shortcuts with help dialog (Shift+?)
- Live regions for status updates

**Requirements:**
- MediaWiki 1.39.0 or later (this branch supports 1.39.x - 1.43.x)
- PHP 8.1+
- MySQL/MariaDB

---

## Installation

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

### Configuration Examples

```php
// Master switch
$wgLayersEnable = true;

// Debug logging (to MediaWiki 'Layers' channel)
$wgLayersDebug = true;

// Server-side validation limits
$wgLayersMaxBytes = 2 * 1024 * 1024; // 2 MB per layer set JSON
$wgLayersMaxLayerCount = 100;        // Max layers per set
$wgLayersMaxNamedSets = 15;          // Max named sets per image
$wgLayersMaxRevisionsPerSet = 50;    // Max revisions per set

// Image layer limits
$wgLayersMaxImageBytes = 1048576;    // 1 MB for imported images

// Image processing limits
$wgLayersMaxImageSize = 4096;        // Max px for editing
$wgLayersMaxImageDimensions = [ 8192, 8192 ];
$wgLayersImageMagickTimeout = 30;    // Seconds

// Permissions (defaults enable edit for logged-in users)
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

// Rate limits
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];
```

---

## Security

- CSRF protection on all write endpoints
- Server-side validation with strict property whitelist (50+ fields)
- Rate limiting via MediaWiki's pingLimiter system
- Text sanitization and color validation
- MediaWiki permissions integration

For Content Security Policy guidance, see [docs/CSP_GUIDE.md](docs/CSP_GUIDE.md).

---

## Development

### Running Tests

```bash
# JavaScript lint and unit tests
npm test
npm run test:js

# PHP lint and style checks
npm run test:php

# Or via composer
composer test
```

### Troubleshooting

- See [docs/layers-all-troubleshooting.md](docs/layers-all-troubleshooting.md) for common issues
- See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for tracked bugs

**Windows Composer Conflict:** Some Windows systems have a Python package named "composer" that shadows PHP Composer. Use `npm run test:php` as an alternative.

---

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture
- [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) - Accessibility features
- [DEVELOPER_ONBOARDING.md](docs/DEVELOPER_ONBOARDING.md) - Getting started
- [NAMED_LAYER_SETS.md](docs/NAMED_LAYER_SETS.md) - Named sets feature
- [WIKITEXT_USAGE.md](docs/WIKITEXT_USAGE.md) - Wikitext syntax

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

---

## License

GPL-2.0-or-later

