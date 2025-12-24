# Layers – MediaWiki Extension

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml)

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today's most popular image editors.*

> **Version:** 1.2.5 (December 2025)  
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

- **Smart Guides**: Automatic snapping to object edges and centers (toggle with `;`)
- **Key Object Alignment**: Last selected layer becomes the reference (Adobe pattern)
- **Arrange Menu**: Consolidated toolbar dropdown for alignment/distribution

### Style Presets

- **Built-in Presets**: Ships with default presets for common annotation styles
- **User Presets**: Create, save, rename, delete, import/export your own presets
- **Per-tool Presets**: Different presets for different tools

### Layer Management

- **Named Layer Sets**: Multiple annotation sets per image (e.g., "default", "anatomy-labels")
- **Version History**: Each named set maintains revision history (up to 50 revisions)
- **Import/Export**: Add external images as layers, export annotated images as PNG
- **Delete/Rename**: Manage your layer sets with full CRUD operations

### Accessibility

- Skip links for keyboard navigation
- ARIA landmarks on all major sections
- Full keyboard support with help dialog (Shift+?)
- Screen reader compatible

---

## Wikitext Integration

```wikitext
[[File:MyImage.jpg|500px|layers=on|Annotated image]]     <!-- Default layer set -->
[[File:MyImage.jpg|500px|layers=anatomy|Anatomy labels]] <!-- Named set -->
[[File:MyImage.jpg|500px|layers=none]]                   <!-- No layers -->
```

### Deep Linking (v1.2.0+)

Control what happens when users click on layered images:

```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor]]  <!-- Click opens editor -->
[[File:Diagram.png|layers=anatomy|layerslink=viewer]]  <!-- Click opens lightbox -->
```

| Value | Effect |
|-------|--------|
| `editor` | Opens the layer editor for this image |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

You can also link directly to the editor via URL:
```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy
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
| Select All               | Ctrl+A                |
| Deselect All             | Escape                |
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

// Debug logging (disable in production)
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

// Rate limits (optional)
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];
```

---

## Technical Details

**Architecture:**

- **Backend:** PHP with 4 API endpoints (`layersinfo`, `layerssave`, `layersdelete`, `layersrename`)
- **Frontend:** HTML5 Canvas editor with 96 JS files (~47K lines), 87 ES6 classes
- **Code Splitting:** Viewer module loads separately from Editor for performance
- **Shared Rendering:** LayerRenderer used by both editor and viewer for consistency

**Test Coverage:**

| Metric | Value |
|--------|-------|
| Jest tests | 6,623 passing |
| Statement coverage | 91.19% |
| Branch coverage | 79.48% |
| Test suites | 127 |

**Security:**

- CSRF protection on all write endpoints
- Server-side validation with 50+ field whitelist
- Rate limiting via MediaWiki's pingLimiter
- Text sanitization and color validation
- SVG imports disabled (XSS prevention)

---

## Known Limitations

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for full tracking.

**Current limitations:**

- ⚠️ **No mobile/touch support** - editor is desktop-only
- ⚠️ **SVG images not supported** - removed for security (XSS prevention)
- ⚠️ **Large images** - performance may degrade with images >4096px

---

## Development

### Running Tests

```bash
# JavaScript lint and unit tests
npm test
npm run test:js

# PHP lint and style checks
npm run test:php

# Run with coverage
npm run test:js -- --coverage
```

### Project Health

| Metric | Value | Status |
|--------|-------|--------|
| Total JS files | 95 | ✅ |
| Total JS lines | ~48,000 | ✅ |
| ES6 classes | 87 | ✅ |
| God classes (>1000 lines) | 6 | ⚠️ |
| Tests passing | 6,623 | ✅ |
| Tests failing | 0 | ✅ |
| Files with 0% coverage | 4 | ⚠️ |

For detailed technical assessment, see [codebase_review.md](codebase_review.md).

### Generate API Documentation

```bash
npm run docs          # HTML docs in docs/api/
npm run docs:markdown # Markdown in docs/API.md
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API.md](docs/API.md) | Auto-generated API reference |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Accessibility features |
| [DEVELOPER_ONBOARDING.md](docs/DEVELOPER_ONBOARDING.md) | Getting started for contributors |
| [NAMED_LAYER_SETS.md](docs/NAMED_LAYER_SETS.md) | Named sets feature documentation |
| [WIKITEXT_USAGE.md](docs/WIKITEXT_USAGE.md) | Wikitext syntax guide |
| [codebase_review.md](codebase_review.md) | Technical assessment |
| [improvement_plan.md](improvement_plan.md) | Development roadmap |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## API Endpoints

### layersinfo (GET)

Fetch layer data for an image.

```javascript
new mw.Api().get({
    action: 'layersinfo',
    filename: 'Example.jpg',
    setname: 'default'  // optional
}).then(function(result) {
    console.log(result.layersinfo);
});
```

### layerssave (POST)

Save layer data to an image.

```javascript
new mw.Api().postWithToken('csrf', {
    action: 'layerssave',
    filename: 'Example.jpg',
    setname: 'my-annotations',
    data: JSON.stringify(layers)
});
```

### layersdelete (POST)

Delete a named layer set.

```javascript
new mw.Api().postWithToken('csrf', {
    action: 'layersdelete',
    filename: 'Example.jpg',
    setname: 'my-annotations'
});
```

### layersrename (POST)

Rename a named layer set.

```javascript
new mw.Api().postWithToken('csrf', {
    action: 'layersrename',
    filename: 'Example.jpg',
    oldname: 'my-annotations',
    newname: 'anatomy-labels'
});
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

**Quick start:**

1. Fork the repository
2. Create a feature branch
3. Run `npm install && composer install`
4. Make changes and add tests
5. Run `npm test && npm run test:php`
6. Submit a pull request

---

## License

GPL-2.0-or-later
