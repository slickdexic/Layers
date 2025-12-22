# Layers – MediaWiki Extension

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml)

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today's most popular image editors.*

> **Version:** 1.1.10 (December 2025)  
> **Status:** ✅ Production-ready. All P0 and P1 issues resolved.  
> **Requires:** MediaWiki 1.44+, PHP 8.1+
>
> **For MediaWiki 1.39.x - 1.43.x:** Use the [`REL1_39` branch](https://github.com/slickdexic/Layers/tree/REL1_39).

---

## Overview

Layers is a **full-featured, non-destructive annotation editor** for images on MediaWiki. It enables users to add captions, callouts, highlights, shapes, and freehand drawings **without altering the original image**.

All annotations are stored as validated JSON and rendered client-side using HTML5 Canvas. The system integrates with MediaWiki's file pages and parser, allowing per-layer display control through wikitext parameters.

**Key Benefits:**

- ✅ Original images preserved (non-destructive)
- ✅ Modern, intuitive editor UI
- ✅ 14 drawing tools with customizable properties
- ✅ Multiple named layer sets per image with version history
- ✅ Industry-standard UX (familiar to Figma, Photoshop, Canva users)

---

## Features

### Drawing Tools (14 Available)

| Tool          | Shortcut | Purpose                                      |
| ------------- | -------- | -------------------------------------------- |
| Pointer       | V        | Select and manipulate objects                |
| Zoom          | Z        | Zoom and pan the canvas                      |
| Text          | T        | Add text labels                              |
| Text Box      | X        | Multi-line text in container                 |
| Pen           | P        | Freehand drawing                             |
| Rectangle     | R        | Draw rectangles                              |
| Circle        | C        | Draw circles                                 |
| Ellipse       | E        | Draw ellipses                                |
| Polygon       | G        | Draw polygons                                |
| Star          | S        | Draw star shapes                             |
| Arrow         | A        | Annotation arrows                            |
| Line          | L        | Straight lines                               |
| Blur          | B        | Apply blur effect                            |
| Marquee       | M        | Area selection                               |

### Smart Guides & Alignment

- **Smart Guides**: Automatic snapping to object edges and centers
- **Key Object Alignment**: Last selected layer becomes the reference (Adobe pattern)
- **Arrange Menu**: Consolidated toolbar dropdown for alignment/distribution

### Style Presets

- **Built-in Presets**: Ships with default presets for common annotation styles
- **User Presets**: Create, save, rename, delete, import/export your own presets

### Layer Management

- **Named Layer Sets**: Multiple annotation sets per image (e.g., "default", "anatomy-labels")
- **Version History**: Each named set maintains revision history (up to 50 revisions)
- **Import/Export**: Add external images as layers, export annotated images as PNG

### Accessibility

- Skip links for keyboard navigation
- ARIA landmarks on all major sections
- Full keyboard support with help dialog (Shift+?)

---

## Wikitext Integration

```wikitext
[[File:MyImage.jpg|500px|layers=on|Annotated image]]     <!-- Default layer set -->
[[File:MyImage.jpg|500px|layers=anatomy|Anatomy labels]] <!-- Named set -->
[[File:MyImage.jpg|500px|layers=none]]                   <!-- No layers -->
```

> **Note:** On File: pages, layers are NOT auto-displayed. You must explicitly use `layers=on` or `layers=setname`.

---

## Keyboard Shortcuts

| Action                   | Shortcut              |
| ------------------------ | --------------------- |
| Toggle Smart Guides      | ;                     |
| Toggle Background        | Shift+B               |
| Undo                     | Ctrl+Z                |
| Redo                     | Ctrl+Y / Ctrl+Shift+Z |
| Copy                     | Ctrl+C                |
| Paste                    | Ctrl+V                |
| Delete                   | Delete                |
| Show Keyboard Help       | Shift+?               |

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

### Configuration

```php
// Master switch
$wgLayersEnable = true;

// Debug logging
$wgLayersDebug = false;

// Limits
$wgLayersMaxBytes = 2 * 1024 * 1024;  // 2 MB per layer set
$wgLayersMaxLayerCount = 100;          // Max layers per set
$wgLayersMaxNamedSets = 15;            // Max named sets per image
$wgLayersMaxRevisionsPerSet = 50;      // Max revisions per set
$wgLayersMaxImageBytes = 1048576;      // 1 MB for imported images

// Permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

// Rate limits
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];
```

---

## Technical Details

**Architecture:**

- **Backend:** PHP with 4 API endpoints (`layersinfo`, `layerssave`, `layersdelete`, `layersrename`)
- **Frontend:** HTML5 Canvas editor with 93 JS files (~46K lines), 84 ES6 classes
- **Code Splitting:** Viewer module loads separately from Editor for performance

**Test Coverage:**

| Metric | Value |
|--------|-------|
| Jest tests | 5,766 passing |
| Statement coverage | ~91% |
| Branch coverage | ~78% |
| Test suites | 115 |

**Security:**

- CSRF protection on all write endpoints
- Server-side validation with 50+ field whitelist
- Rate limiting via MediaWiki's pingLimiter
- Text sanitization and color validation

---

## Known Issues

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for full tracking.

**Current limitations:**

- ⚠️ **No mobile/touch support** - editor is desktop-only
- ⚠️ **SVG images not supported** - removed for security (XSS prevention)

---

## Development

### Running Tests

```bash
# JavaScript lint and unit tests
npm test
npm run test:js

# PHP lint and style checks
npm run test:php
```

### Project Health

| Metric | Value | Status |
|--------|-------|--------|
| Total JS files | 93 | ✅ |
| Total JS lines | 46,062 | ✅ |
| ES6 classes | 84 | ✅ |
| God classes (>1000 lines) | 7 | ⚠️ |
| Tests passing | 5,766 | ✅ |
| Tests failing | 0 | ✅ |

For detailed technical assessment, see [codebase_review.md](codebase_review.md).

### Generate API Documentation

```bash
npm run docs          # HTML docs in docs/api/
npm run docs:markdown # Markdown in docs/API.md
```

---

## Documentation

- [API.md](docs/API.md) - Auto-generated API reference
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture
- [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) - Accessibility features
- [DEVELOPER_ONBOARDING.md](docs/DEVELOPER_ONBOARDING.md) - Getting started
- [NAMED_LAYER_SETS.md](docs/NAMED_LAYER_SETS.md) - Named sets feature
- [codebase_review.md](codebase_review.md) - Technical assessment
- [improvement_plan.md](improvement_plan.md) - Roadmap

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

---

## License

GPL-2.0-or-later
