# Layers – MediaWiki Extension

[![CI](https://github.com/slickdexic/Layers/actions/workflows/ci.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml/badge.svg)](https://github.com/slickdexic/Layers/actions/workflows/e2e.yml)
[![Coverage](https://img.shields.io/badge/coverage-95.87%25-brightgreen)](coverage/lcov-report/index.html)
[![Tests](https://img.shields.io/badge/tests-14%2C054%20passing-brightgreen)](tests/)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](COPYING)

*A modern, non-destructive image annotation and markup system for MediaWiki, designed to match the power and usability of today's most popular image editors.*

> **Version:** 1.5.89 (August 9, 2026)  
> **Status:** ✅ Production-ready  
> **Requires:** MediaWiki 1.44.0+, PHP 8.1+  
> **Primary branch:** `main` — all development and testing happens here
>
> **For MediaWiki 1.43.x (LTS):** Use the [`REL1_43` branch](https://github.com/slickdexic/Layers/tree/REL1_43). Receives security backports.  
> **For MediaWiki 1.39.x - 1.42.x:** [`REL1_39`](https://github.com/slickdexic/Layers/tree/REL1_39) is **no longer maintained**. MediaWiki 1.39 reached end-of-life on December 31, 2025; the branch is left in place for existing installs but receives no fixes, including security fixes. Upgrade to MediaWiki 1.43+ and switch to `REL1_43`.  
> Changes are developed/tested on `main` first, then cherry-picked to `REL1_43`.

---

## Overview

Layers is a **full-featured, non-destructive annotation editor** for images on MediaWiki. It enables users to add captions, callouts, highlights, shapes, and freehand drawings **without altering the original image**.

All annotations are stored as validated JSON and rendered client-side using HTML5 Canvas. The system integrates with MediaWiki's file pages and parser, allowing per-layer display control through wikitext parameters.

**Key Benefits:**

- ✅ Original images preserved (non-destructive)
- ✅ Modern, intuitive editor UI
- ✅ **17 drawing tools** with customizable properties
- ✅ Multiple named layer sets per image with version history
- ✅ **PDF markup** — annotate PDF files page-by-page (multi-page supported)
- ✅ **Slide Mode** — Create standalone canvas graphics without a base image
- ✅ Industry-standard UX (familiar to Figma, Photoshop, Canva users)

---

## 🆕 Slide Mode (v1.5.22+)

**Create standalone canvas graphics without requiring a base image.** Slides are perfect for:

- **Diagrams and flowcharts** without needing a placeholder image
- **Infographics** with custom canvas sizes
- **Presentations** with consistent branding
- **Technical drawings** starting from a blank canvas

### Slide Wikitext Syntax

```wikitext
{{#Slide: MySlide}}                              <!-- Render slide "MySlide" (its current layer set) -->
{{#Slide: MySlide | layerset=annotations}}       <!-- Render specific named layer set -->
{{#Slide: MySlide | size=800x600}}               <!-- Render at specific display size -->
{{#Slide: MySlide | canvas=1920x1080}}           <!-- Create with specific canvas size -->
{{#Slide: MySlide | background=#f0f0f0}}         <!-- Custom background color -->
{{#Slide: MySlide | size=800x600 | noedit}}      <!-- View-only (no edit overlay) -->
```

### Slide Management

- **`Special:Slides`** — Browse, search, and manage all slides
- **`Special:EditSlide/SlideName`** — Direct link to edit a specific slide
- **`Special:EditSlide/SlideName?layerset=setname`** — Edit a specific layer set
- Slides support multiple named layer sets (just like images)
- Each slide has its own version history per layer set

### Key Features

| Feature | Description |
|---------|-------------|
| Custom canvas sizes | Any size from 100×100 to 4096×4096 |
| Background colors | Any CSS color or transparent |
| All 17 drawing tools | Full access to shapes, text, arrows, etc. |
| Instant refresh | Changes appear immediately after saving ✨ |
| Lightbox view | Full-size viewing without editing |

---

## Features

### Drawing Tools (17 Available)

| Tool          | Shortcut | Purpose                                      |
| ------------- | -------- | -------------------------------------------- |
| Pointer       | V        | Select, move, resize, rotate layers          |
| Text          | T        | Add text labels                              |
| Text Box      | X        | Multi-line text in container                 |
| Callout       | B        | Speech bubbles with draggable tail           |
| Pen           | P        | Freehand drawing                             |
| Rectangle     | R        | Draw rectangles                              |
| Circle        | C        | Draw circles                                 |
| Ellipse       | E        | Draw ellipses                                |
| Polygon       | Y        | Draw polygons                                |
| Star          | S        | Draw star shapes                             |
| Arrow         | A        | Annotation arrows                            |
| Line          | L        | Straight lines                               |
| Marker    | M        | Numbered/lettered markers with optional arrows |
| **Dimension** | D        | Technical measurement annotations            |
| Image         | —        | Import images from clipboard or file         |
| Custom Shape  | —        | 1,385 built-in shapes (ISO 7010, IEC 60417, ISO 7000, GHS, ECB, ANSI) |
| Emoji         | —        | 2,817 Noto Color Emoji with search and categories |

> **Note:** Use `+`/`-` to zoom, `0` to fit, and hold `Space` to pan. The Pointer tool includes marquee selection (drag to select multiple layers).

### Blur Fill Mode (v1.2.6+)

Any filled shape can use **blur fill** instead of a solid color — creating a "frosted glass" effect:

```
Fill: blur  →  Blurs content beneath the shape
```

Supported on: Rectangle, Circle, Ellipse, Polygon, Star, Text Box, Arrow (v1.2.7+)

> **Note:** All blur fill coordinate bugs have been fixed as of v1.2.8. The feature is production-ready.

### Gradient Fills (v1.5.8+)

Shapes can be filled with beautiful linear or radial gradients:

- **Linear Gradients**: Customizable angle (0-360°) for directional color transitions
- **Radial Gradients**: Adjustable center position and radius for circular color spreads
- **Color Stops**: Add multiple color stops to create complex gradient effects
- **Built-in Presets**: 6 presets included (sunset, ocean, forest, fire, steel, rainbow)

Supported on: Rectangle, Circle, Ellipse, Polygon, Star, Text Box

### Curved Arrows (v1.3.3+)

Arrows can now be curved by dragging the purple control point at the arrow's midpoint:

- **Quadratic Bézier curves** for smooth, organic arrow paths
- **Tangent-following arrow heads** that point along the curve direction
- Works with all arrow head types (pointed, chevron, standard)
- Single and double-headed curved arrows supported
- Perfect for pointing to off-axis targets and creating flowing diagrams

### Live Color Preview (v1.3.3+)

The canvas updates in real-time as you select colors in the color picker:

- Preview changes on the canvas before applying
- Cancel or press Escape to restore the original color
- Matches professional editor UX (Figma, Photoshop, Illustrator)

### Hover Overlay Actions (v1.5.15+)

Images with layers display action buttons on hover for quick access:

- **Edit button** (pencil icon): Opens the layer editor — only visible if you have `editlayers` permission
- **View button** (expand icon): Opens the full-size lightbox viewer
- Touch-friendly: tap and hold to reveal buttons on mobile
- Fully accessible with ARIA labels and keyboard support
- Respects dark mode and high-contrast preferences

### Live Article Preview (v1.3.3+)

Layer changes are visible on article pages immediately after saving, without needing to edit and save the wiki page:

- Viewer detects stale inline data via revision comparison
- Automatic refresh of viewers with latest layer data
- Streamlined workflow for annotators with immediate feedback

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
- Respects `prefers-reduced-motion` user preference (WCAG 2.3.3)

---

## Wikitext Integration

```wikitext
[[File:MyImage.jpg|500px|layerset=on|Annotated image]]     <!-- The image's current layer set -->
[[File:MyImage.jpg|500px|layerset=anatomy|Anatomy labels]] <!-- Named set -->
[[File:MyImage.jpg|500px|layerset=none]]                   <!-- No layers -->
```

> **Note:** As of v1.5.0, `layerset=` is the preferred parameter name. The older `layers=` syntax remains fully supported for backwards compatibility.

### PDF Markup (v1.5.77+)

PDF files can be annotated exactly like images — the PDF page is the canvas.
For multi-page PDFs, each page has its own independent named layer sets and
revision history. Use the standard MediaWiki `page` parameter to target a page:

```wikitext
[[File:Manual.pdf|500px|page=2|layerset=on]]        <!-- Layers for page 2 -->
[[File:Manual.pdf|500px|page=3|layerset=anatomy]]   <!-- Named set on page 3 -->
```

In the editor, multi-page files show a **page navigator** (previous / next and
a "Page X / N" indicator) in the toolbar. Switching pages loads that page's
background, dimensions, and layer set.

**In-wiki PDF viewer (v1.5.78+).** Clicking a layered PDF thumbnail opens the
page inside the full-screen viewer with its overlay, rather than sending the
reader to the browser's native PDF view (where the overlay does not exist). The
page is rendered client-side with a bundled copy of Mozilla's
[pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), loaded on demand only
when a PDF is first opened. The viewer supports paging, zoom, print and export
of the marked-up page. If pdf.js cannot load, it falls back to the
server-rasterized page image automatically.

> **Requires the [PdfHandler](https://www.mediawiki.org/wiki/Extension:PdfHandler)
> extension** (with Ghostscript/ImageMagick) for PDF rasterization and page
> dimensions. Without it, PDFs are treated as single-page files.

### Gallery Support (v1.5.73–1.5.75)

Named layer sets work in galleries as well as inline file links:

**Native `<gallery>` blocks** — add `|layerset=setname` per image line (v1.5.75):
```wikitext
<gallery mode="packed" widths=200>
File:Diagram.jpg|layerset=anatomy|Anatomical labels
File:Chart.jpg|layerset=physiology
</gallery>
```

**Cargo `format=gallery`** — include `layerset` in your fields list (v1.5.74):
```wikitext
{{#cargo_query:tables=MyImages|fields=Image,layerset|format=gallery|...}}
```
The extension auto-detects the `layerset` field and shows the correct named
set per image with no template changes required. Use `layerset field=name` if
your column has a different name.

**Manual hint registration** — for other gallery sources (v1.5.73):
```wikitext
{{#layers_hint:Foo.jpg|anatomy}}
```
Call this before the gallery renders. Returns empty string (no visible output).

### Deep Linking (v1.2.0+)

Control what happens when users click on layered images:

```wikitext
[[File:Diagram.png|layerset=anatomy|layerslink=editor]]  <!-- Click opens editor -->
[[File:Diagram.png|layerset=anatomy|layerslink=viewer]]  <!-- Click opens lightbox -->
```

| Value | Effect |
|-------|--------|
| `editor` | Opens the layer editor for this image |
| `editor-newtab` | Opens the layer editor in a new browser tab |
| `editor-modal` | Opens the layer editor in a modal overlay |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

You can also link directly to the editor via URL:
```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy&returnto=Main_Page
```

> **Note:** On File: pages, layers are NOT auto-displayed. You must explicitly use `layerset=on` or `layerset=setname`.

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
```

> **Note:** `composer install` and `npm install` are **optional** — only needed for development/testing. The extension works without them.

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
$wgLayersMaxImportSide = 2048;         // Max px before client-side downscale
$wgLayersImportJpegQuality = 0.8;      // JPEG quality for downscaled imports

// Seed name for an image's first layer set when the user did not name one.
// Set names are user-defined and nothing is reserved.
$wgLayersDefaultSetName = 'default';

// Image and rendering limits
$wgLayersMaxImageSize = 4096;          // Max image size for editing (px)
$wgLayersImageMagickTimeout = 30;      // ImageMagick timeout (seconds)
$wgLayersMaxImageDimensions = 8192;    // Max width/height for processing

// PDF export
$wgLayersPdfExportWidth = 1600;        // Render width per page (px)
$wgLayersPdfExportMaxPages = 100;      // Max pages per export (0 = unlimited)
$wgLayersExportDirectory = '';         // Export cache dir; MUST be outside the
                                       // document root. Empty uses
                                       // $wgTmpDirectory/layers-export.

// Slide Mode
$wgLayersSlidesEnable = true;            // Enable Slide Mode
$wgLayersSlideDefaultWidth = 800;       // Default slide width (px)
$wgLayersSlideDefaultHeight = 600;      // Default slide height (px)
$wgLayersSlideMaxWidth = 4096;          // Maximum slide width (px)
$wgLayersSlideMaxHeight = 4096;         // Maximum slide height (px)
$wgLayersSlideDefaultBackground = '#ffffff'; // Default slide background

// Permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['sysop']['layers-admin'] = true;   // Delete/rename any set

// Rate limits. Sensible defaults ship with the extension since v1.5.83 — set
// these only to override. Keys: editlayers-save, -render, -list.
$wgRateLimits['editlayers-render']['user'] = [ 5, 60 ];   // PDF export is expensive
```

> **Permissions note:** saving, renaming or deleting a layer set requires both
> the `editlayers` right **and** ordinary `edit` permission on the file's page.
> Layer data changes what a File page renders, so page protection, namespace
> protection, cascading protection and blocks all apply. If a group can draw
> layers on some pages but not others, check `edit` permission first.

### Maintenance

The extension writes composited thumbnails to `<upload>/thumb/layers/` and
exported PDFs to `<upload>/thumb/layers/export/`. Renders belonging to a deleted
file are purged automatically. Export filenames incorporate the layer set
revision, so each save orphans the previous export; run the reaper periodically
(for example from cron) to reclaim that space:

```bash
# Delete generated renders not touched in the last 30 days
php extensions/Layers/maintenance/purgeLayersRenderCache.php

# Preview what a 7-day cutoff would remove
php extensions/Layers/maintenance/purgeLayersRenderCache.php --max-age-days=7 --dry-run
```

Purged files are regenerated on demand, so the cutoff only trades disk space
against re-render cost.

---

## Technical Details

**Architecture:**

- **Backend:** PHP with 6 API endpoints (`layersinfo`, `layerssave`, `layersdelete`, `layersrename`, `layerslist`, `layerspdfexport`), **~17,300 lines across 48 files**
- **Frontend:** HTML5 Canvas editor with **159 JS files (~105,000 lines)**, 140 ES6 classes
- **Code Splitting:** Viewer module loads separately from Editor for performance
- **Shared Rendering:** LayerRenderer used by both editor and viewer for consistency
- **Technical Debt:** **28 god classes** (files >=1,000 lines), all use proper delegation patterns
  - 4 generated data files (ShapeLibraryData variants + EmojiLibraryIndex) are exempt from refactoring
  - All other god classes (20 JS + 4 PHP) have proper facade/delegation patterns

**Validation Snapshot:**

| Metric | Value |
|--------|-------|
| Jest tests | 14,227 passing (178 suites) |
| PHPUnit tests | 666 passing (33 test files) |
| Statement coverage | 95.87% |
| Branch coverage | 87.20% |
| Function coverage | 94.00% |
| Line coverage | 95.98% |

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

- ⚠️ **Limited mobile/touch support** - basic touch-to-mouse, pinch-to-zoom, and double-tap zoom work, but UI is not mobile-optimized
- ⚠️ **SVG images not supported** - removed for security (XSS prevention)
- ⚠️ **Large images** - performance may degrade with images >4096px

**Resolved Issues:**
- ✅ **God class monitoring** - 28 god classes (4 generated, 20 JS, 4 PHP) with proper delegation patterns
- ✅ **Rate limiting** - now applied to save, delete, AND rename endpoints  
- ✅ **Background image load failure** - user now notified via mw.notify()
- ✅ **Memory leaks fixed** - all animation frames and event listeners properly cleaned up
- ✅ **PHP line endings** - 4 files fixed automatically with phpcbf (Jan 7, 2026)

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
| Total JS files | 158 | ✅ |
| Total JS lines | ~105,000 | ✅ Hand-written + generated data |
| ES6 classes | 140 | ✅ 100% migrated |
| God classes (>=1000 lines) | 28 | ✅ Well-delegated facades |
| Tests passing | 14,227 | ✅ |
| Tests failing | 0 | ✅ |
| Statement coverage | 95.87% | ✅ Excellent |
| Branch coverage | 87.20% | ✅ Target met |

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
| [codebase_review.md](codebase_review.md) | Technical assessment (March 9, 2026 addendum) |
| [improvement_plan.md](improvement_plan.md) | Development roadmap with priorities |
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

### layerslist (GET)

List slides/presentations (used by Special:Slides).

```javascript
new mw.Api().get({
    action: 'layerslist',
    prefix: 'Process',  // optional - filter by name prefix
    limit: 20,          // optional - results per page
    sort: 'modified'    // optional - sort by: name, created, modified
}).then(function(result) {
    console.log(result.layerslist.slides);
});
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

**Quick start:**

1. Fork the repository
2. Create a feature branch
3. Install dev dependencies: `npm install && composer install`
4. Make changes and add tests
5. Run `npm test && npm run test:php`
6. Submit a pull request

---

## License

GPL-2.0-or-later
