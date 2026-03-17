# Layers — Professional Image Annotation for MediaWiki

<p align="center">
  <img src="https://img.shields.io/badge/MediaWiki-1.44%2B-blue" alt="MediaWiki 1.44+">
  <img src="https://img.shields.io/badge/PHP-8.1%2B-purple" alt="PHP 8.1+">
  <img src="https://img.shields.io/badge/License-GPL--2.0-green" alt="GPL-2.0">
  <img src="https://img.shields.io/badge/Tests-11%2C606%20passing-brightgreen" alt="11,606 Tests">
   <img src="https://img.shields.io/badge/Coverage-91.32%25-brightgreen" alt="91.32% Coverage">
</p>

**Layers** is a professional-grade, non-destructive image annotation system for MediaWiki. Add captions, callouts, highlights, shapes, and drawings to images **without modifying the original files**.

---

## ✨ Highlights

| 🎨 **Professional Tools** | 🔒 **Non-Destructive** | 🖼️ **Slide Mode** | ♿ **Accessible** |
|---------------------------|------------------------|-------------------|------------------|
| **17 drawing tools**, style presets, alignment & distribution | Original images never modified | Create standalone graphics without a base image | WCAG 2.1 compliant, full keyboard support |

---

## 🆕 What's New in v1.5.62

- **v54 Audit** — Security fix (IDOR ownership check), 7 code-quality fixes, grade restored to A
- **Test Suite** — 11,606 tests passing (168 suites), 91.32% statement coverage

### Previous v1.5.60 Highlights

- **16 Bug Fixes** — Zoom-to-pointer anchor drift, 15 P3 code-quality fixes
- **Test Suite** — 11,445 tests passing (168 suites)

### Previous v1.5.59 Highlights

- **5 Bug Fixes** — RichText font size cap (200→1000px), arrow key nudge for dimension/line/arrow layers, thumbnail TextBox stroke bleed, thumbnail ellipse shadow missing, AlignmentController dimension/marker layer support
- **Test Suite** — 11,421 tests passing (167 suites), all bugs covered by regression tests

### Previous v1.5.58 Highlights

- **Documentation Sync** — All metrics synchronized across 97+ files (February 13, 2026)
- **VERSION Constant** — LayersNamespace.js now matches extension.json
- **v37 Audit** — Fresh comprehensive code review, grade A maintained

### Previous v1.5.56 Highlights

- **10 Bug Fixes** — Transaction safety, TextSanitizer XSS, info disclosure, boolean serialization
- **FontSize Bug** — Rich text fontSize no longer overwritten on deselect (user-reported P1-025)

### Previous v1.5.49 Highlights

- **Documentation Synchronization** — Comprehensive audit and sync of all version/metrics across 97+ files

- **Branch Coverage Improvement** — 39 new tests, coverage increased from 84.96% to 85.20%
- **Documentation Audit** — All 97 files verified and synchronized with correct metrics
- **Point Release** — Synchronized releases across main, REL1_43, and REL1_39 branches

### Previous v1.5.44 Highlights

- **Code Quality Fixes** — MED-2 (ToolDropdown listeners), MED-8 (Logger consistency)
- **Documentation Audit** — All 97 files verified and updated for version/metric accuracy
- **P2 Issue Tracker** — 16 of 18 issues now resolved (89% complete)

### Previous v1.5.42 Highlights

- **P2.1 Fix** — `isComplexityAllowed()` now properly handles all 15 layer types
- **P2.8 Fix** — Rate limiting added to `ApiLayersList`
- **P2.10 Fix** — Paths array limit (max 100) for DoS prevention
- **P3.5 Fix** — `refreshAllViewers()` limited to 5 concurrent requests
- **Production-ready** with comprehensive test coverage

### Previous v1.5.41 Highlights

- **P1.1 Fix** — Race condition in `saveLayerSet` named set limit check
- **P1.2 Fix** — Missing permission check in `ApiLayersList`
- **P2.5 Fix** — Raw SQL fragments in `listSlides()` refactored
- **P3.12 Fix** — Configurable complexity threshold ($wgLayersMaxComplexity)

### Previous v1.5.40 Highlights

- **All P0-P3 Issues Resolved** — TailCalculator, API bugs, N+1 queries, and UX issues all fixed
- **UX Improvements** — Easier drag handle clicking (4px tolerance), smaller overlay buttons
- **Code Quality** — New `LayersApiHelperTrait` extracts common API patterns
- **Comprehensive test coverage maintained** with all CI checks passing

### Previous v1.5.39 Highlights

- **Critical Bugfixes** — TailCalculator and ApiLayersList.getLogger() bugs fixed
- **Performance Improvements** — N+1 database queries eliminated
- **Security Hardening** — LIKE query wildcard escaping

### Previous v1.5.38 Highlights

- **Inline Text Alignment Fix** — Fixed double rendering when changing alignment during editing
- **Text Loss Fix** — Fixed losing typed text when changing properties during inline editing
- **Rich Text Inline Display** — Fixed styled text runs displaying on separate lines
- **Slide Layer Order** — Fixed layers appearing in reverse order on article pages

### Previous v1.5.36 Highlights

- **Callout Inline Editing** — Double-click inline text editing for callout layers
- **Documentation Accuracy Audit** — Updated all stale metrics
- **Critical Review v42** — Comprehensive codebase audit completed

### Previous v1.5.35 Highlights

- **Version Consistency** — Fixed version number inconsistencies across all project files
- **Documentation Audit** — Updated all stale metrics in documentation
- **Critical Review v39** — Comprehensive codebase audit with all issues documented

### Previous v1.5.31 Highlights

- **REL1_43 Branch Sync** — Updated REL1_43 branch to include all changes from v1.5.30
- **Draft Recovery Fix** — Fixed false draft recovery prompts
- **Layer Panel Header** — Redesigned with full Layers logo branding
- **Canvas Accessibility** — Completed P3.5 accessibility improvements
- **10,860 tests passing** (157 suites), 95.85% statement coverage, 85.37% branch coverage

### Previous v1.5.30 Highlights

- **Layer Search Filter** — Search/filter layers in the layer panel with real-time filtering
- **Jest Coverage Thresholds** — Raised coverage thresholds to protect against regression

### Previous v1.5.29 Highlights

- **DraftManager Auto-Save** — Automatic draft recovery system with localStorage auto-save every 30 seconds
- **Canvas Snap** — Snap layers to canvas edges and center with visual green guides
- **Visual Bounds Snapping** — Snapping now respects stroke width and shadows

### 🖼️ Slide Mode (v1.5.22+)

**Create standalone canvas graphics without requiring a base image!** This major feature includes:

- **`{{#Slide: SlideName}}`** — Wikitext parser function for embedding slides
- **`Special:Slides`** — Browse, search, create, and delete slides
- **`Special:EditSlide/SlideName`** — Direct editor access
- **Custom canvas sizes** — Any size from 100×100 to 4096×4096
- **Background colors** — Any CSS color or transparent
- **Instant refresh** — Changes appear immediately after saving ✨

Perfect for diagrams, infographics, flowcharts, and presentations!

### Previous v1.5.24 Highlights

- **Virtual Scrolling for Layer Lists (P2.1)** — Layer panel now uses virtual scrolling for 30+ layers, preventing UI slowdowns with large layer counts
- **Duplicate Close Button Fix** — Modal overlay no longer shows redundant close button
- **9,783 tests passing** (153 suites), 92.80% statement coverage, 83.75% branch coverage

### Previous v1.5.19 Highlights

- **Shared IdGenerator Utility** — New centralized ID generation with monotonic counter guarantees unique layer IDs even during rapid operations (paste, duplicate, bulk imports)
- **ViewerManager Error Tracking** — `refreshAllViewers()` now returns detailed result object with error tracking for better debugging

### Previous v1.5.17 Highlights

- **Collapsible Shadow Settings** — Drop shadow and text shadow settings now hidden until enabled, reducing UI clutter
- **StateManager Exception Handling (HIGH)** — Fixed potential deadlock in unlockState()
- **Missing mw Object Guard (MEDIUM)** — Fixed ReferenceError in Node.js/Jest environments

### Previous v1.5.15 Highlights

- **Hover Overlay Actions** — Edit/View icons appear on hover over layered images
  - **Edit button** (pencil icon): Opens layer editor — respects `editlayers` permission
  - **View button** (expand icon): Opens full-size lightbox viewer
  - Touch support with auto-hide, modal editor on article pages
  - Full accessibility: ARIA labels, keyboard nav, reduced-motion, dark mode
- **Floating Text Formatting Toolbar** — When editing text inline, a draggable floating toolbar appears with:
  - Font family dropdown, font size input (8-200px), bold/italic toggles
  - Text alignment buttons (left, center, right)
  - Color picker button with full swatch palette and OK/Cancel
  - Draggable via grab handle for optimal positioning
  - Full dark mode support
- **Textbox Background Visibility** — Textbox layers keep their background visible during editing

### Previous v1.5.13 Highlights

- **Inline Canvas Text Editing (FR-8)** — Double-click text or textbox layers to edit directly on the canvas
  - Figma/Canva-style editing experience — no modal dialogs required
  - Real-time canvas preview as you type
  - Mobile-optimized with keyboard-aware positioning (Visual Viewport API)
  - Keyboard shortcuts: Enter to confirm, Escape to cancel
  - InlineTextEditor controller with full undo/redo integration

### Previous v1.5.11 Highlights

- **Expanded Shape Library** — 951 new shapes across 4 new categories:
  - IEC 60417 Symbols (735 shapes): International Electrotechnical Commission graphical symbols
  - ISO 7000 Symbols (198 shapes): Equipment and graphical symbols
  - GHS Hazard Pictograms (8 shapes): Chemical hazard warning pictograms
  - ECB Hazard Symbols (10 shapes): European chemical hazard symbols
  - Total library now contains **1,385 shapes** across **12 categories**
- **Shape Library Rendering Fix** — Fixed critical bug where custom shapes failed to render

### Previous v1.5.10 Highlights

- **Marker Auto-Number** — New feature for placing multiple markers quickly
  - "Auto-number" checkbox in toolbar when marker tool is selected
  - Marker values auto-increment (1→2→3... or A→B→C...)
  - Tool remains active after placing a marker for rapid sequential placement
- **Arrow Fill Fix** — Arrows now properly support fill colors for fat/storage styles
- **9,469 tests passing** (147 suites)

### Previous v1.5.8 Highlights

- **Gradient Fills** — Beautiful gradient fills for shapes
  - Linear gradients with customizable angle (0-360°)
  - Radial gradients with adjustable center and radius
  - Interactive UI: color stop editor, angle/position sliders
  - 6 built-in presets: sunset, ocean, forest, fire, steel, rainbow
  - Supported on: Rectangle, Circle, Ellipse, Polygon, Star, Text Box

### Previous v1.5.1 Highlights

- **Layer Set List on File Pages** — File: pages now show a collapsible "Layer Annotations" section listing all named sets with author, revision count, and direct edit links
- **Simplified Permissions** — Consolidated `createlayers` into `editlayers` — users with `editlayers` can now create and edit layer sets
- **Layer Lock Fixed** — Locked layers now properly prevent dragging, resizing, rotating, and deletion; folder locks cascade to children
- **ImageLayerRenderer Extraction** — Improved code architecture with dedicated image rendering module

### Previous v1.5.0-beta Highlights

- **`layerset=` Parameter** — The wikitext parameter is now `layerset=on` (or `layerset=setname`), with `layers=` still supported for backwards compatibility
- **"Edit Layers" → "Edit layers"** — Changed to sentence case per MediaWiki UI conventions
- **New Layer Set Starts Blank** — Creating a new named layer set now starts with an empty canvas
- **Cancel Button Removed** — The X close button already provides this functionality
- **Custom Shape Tool (v1.5.0)** — Built-in shape library with searchable categories

### Previous v1.4.8 Highlights

- **InstantCommons Support** — Full support for files from Wikimedia Commons and other foreign repositories
- **TIFF Image Support** — TIFF format images work correctly in editor and viewer
- **Template Images Fix** — Removed overly restrictive CSP that was blocking template images on File pages
- **FR-10 Live Preview Fixes** — Multiple fixes for live preview duplicate rendering and stale data issues

### Previous v1.4.3 Highlights

- **Draggable Callout Tail** — Position the callout tail by dragging the tip directly on the canvas
- **Tail Styles** — Three options: triangle (classic), curved (smooth Bézier), and line (simple pointer)
- **Corner Arc Tail Rendering** — Tail now renders correctly when positioned on rounded corners

### Previous v1.4.0-1.4.2 Highlights

- **Callout/Speech Bubble Tool** — New annotation type for chat bubbles and callouts with configurable tail direction
- **Vector 2022 Dark Mode** — Full support for MediaWiki's Vector 2022 skin night mode
- **Windows High Contrast Mode** — WCAG 1.4.11 compliance for forced-colors mode
- **Color Picker Hex Input** — Keyboard-accessible hex color input field
- **Curved Arrows (FR-4)** — Arrows now support curved paths via draggable control point
- **Live Color Picker Preview (FR-9)** — Canvas updates in real-time during color selection
- **Live Article Preview (FR-10)** — Layer changes visible immediately after saving

### Previous v1.3 Highlights

- **REL1_43 Branch** — New LTS branch for MediaWiki 1.43.x with full feature parity (v1.3.0)
- **Release Guide** — Comprehensive release checklist for maintainers (v1.3.2)
- **Zero PHP Warnings** — All 45 phpcs warnings fixed (v1.3.1)

### Previous v1.2 Highlights

- **GroupManager Coverage Improvement** — 89% statement coverage with 17 new edge case tests (v1.2.18)
- **Community-Ready Infrastructure** — Issue templates, PR template, wiki auto-sync (v1.2.17)
- **Background Layer i18n Fix** — Proper internationalization support (v1.2.15)
- **Layer Folders with Full UI** — Collapsible folders, visibility cascade, delete options (v1.2.14)
- **Blend Modes on Article Pages** — All blend modes now render correctly in article view (v1.2.11)
- **Context-Aware Toolbar** — Shows only relevant controls based on active tool (v1.2.10)
- **Blur Fill Mode** — "Frosted glass" effect for shapes including arrows (v1.2.8)
- **Compact Layer Panel** — Redesigned UI inspired by Figma/Photoshop (v1.2.8)
- **Deep Linking to Editor** — Open the editor with a specific layer set via URL parameters
- **Fullscreen Lightbox Viewer** — View annotated images in a modal overlay
- **Wikitext Link Options** — Control click behavior with `layerslink=editor` or `layerslink=viewer`
- **Modal Editor Mode** — Open editor in overlay without navigation (v1.2.5)

See [[Changelog]] for full details.

---

## 📚 Wiki Contents

### Getting Started
- [[Installation]] — Download, configure, and set up Layers
- [[Quick Start Guide]] — Create your first annotation in 5 minutes
- [[Configuration Reference]] — All configuration parameters explained

### User Guide
- [[Drawing Tools]] — Complete guide to all 17 tools
- [[Keyboard Shortcuts]] — Master the keyboard for faster editing
- [[Style Presets]] — Save and reuse style configurations
- [[Named Layer Sets]] — Multiple annotation sets per image
- [[Alignment and Distribution]] — Professional layout tools

### Developer Documentation
- [[Architecture Overview]] — System design and code organization
- [[API Reference]] — Backend API endpoints and contracts
- [[Frontend Architecture]] — JavaScript module structure
- [[Contributing Guide]] — How to contribute to Layers
- [[Testing Guide]] — Running and writing tests

### Reference
- [[Wikitext Syntax]] — Using layers in wiki pages
- [[Permissions]] — User rights and group configuration
- [[Troubleshooting]] — Common issues and solutions
- [[FAQ]] — Frequently asked questions
- [[Changelog]] — Version history

---

## 🚀 Quick Links

| Resource | Description |
|----------|-------------|
| [GitHub Repository](https://github.com/slickdexic/Layers) | Source code and issue tracker |
| [README](https://github.com/slickdexic/Layers/blob/main/README.md) | Project overview |
| [CHANGELOG](https://github.com/slickdexic/Layers/blob/main/CHANGELOG.md) | Version history |
| [Issue Tracker](https://github.com/slickdexic/Layers/issues) | Report bugs or request features |

---

## 📊 Project Status

| Metric | Value |
|--------|-------|
| **Version (main)** | 1.5.62 |
| **Version (REL1_43)** | 1.5.60 |
| **Version (REL1_39)** | 1.5.60 |
| **Release Date** | March 10, 2026 |
| **Test Suites** | 168 |
| **Total Tests** | 11,606 |
| **PHPUnit Test Files** | 34 |
| **Statement Coverage** | 91.32% |
| **Branch Coverage** | 81.69% |
| **Function Coverage** | 90.62% |
| **Line Coverage** | 91.39% |
| **JavaScript Files** | 158 |
| **ES6 Classes** | 140 |
| **God Classes** | 26 (5 generated, 19 JS, 2 PHP) |
| **i18n Messages** | 780 |

---

## 🎯 Use Cases

- **Educational Content** — Annotate diagrams, label anatomy, highlight key concepts
- **Documentation** — Add numbered steps, highlight UI elements
- **Visual Effects** — Apply blur effects, draw attention to specific areas
- **Maps & Geography** — Add markers, routes, region highlights
- **Scientific Imagery** — Label specimens, mark measurement points
- **Collaborative Review** — Multiple annotators with named layer sets

---

## 💡 Inspired By

Layers draws inspiration from industry-leading design tools:

- [Figma](https://www.figma.com/) — Collaborative design
- [Canva](https://www.canva.com/) — Accessible design tools
- [Adobe Photoshop](https://www.adobe.com/products/photoshop.html) — Professional image editing

Users familiar with these tools will feel right at home with Layers.
