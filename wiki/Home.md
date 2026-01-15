# Layers — Professional Image Annotation for MediaWiki

<p align="center">
  <img src="https://img.shields.io/badge/MediaWiki-1.44%2B-blue" alt="MediaWiki 1.44+">
  <img src="https://img.shields.io/badge/PHP-8.1%2B-purple" alt="PHP 8.1+">
  <img src="https://img.shields.io/badge/License-GPL--2.0-green" alt="GPL-2.0">
  <img src="https://img.shields.io/badge/Tests-9%2C469%20Passing-brightgreen" alt="9,469 Tests">
  <img src="https://img.shields.io/badge/Coverage-95%25-brightgreen" alt="95% Coverage">
</p>

**Layers** is a professional-grade, non-destructive image annotation system for MediaWiki. Add captions, callouts, highlights, shapes, and drawings to images **without modifying the original files**.

---

## ✨ Highlights

| 🎨 **Professional Tools** | 🔒 **Non-Destructive** | ♿ **Accessible** |
|---------------------------|------------------------|------------------|
| **15 drawing tools**, style presets, alignment & distribution | Original images never modified | WCAG 2.1 compliant, full keyboard support |

---

## 🆕 What's New in v1.5.10

- **Marker Auto-Number** — New feature for placing multiple markers quickly
  - "Auto-number" checkbox in toolbar when marker tool is selected
  - Marker values auto-increment (1→2→3... or A→B→C...)
  - Tool remains active after placing a marker for rapid sequential placement
- **Arrow Fill Fix** — Arrows now properly support fill colors for fat/storage styles
- **9,469 tests passing** (147 suites)

### Previous v1.5.9 Highlights

- **Dead Code Removal** — Removed 1,535 lines of unreachable SVG export code
- All coverage targets now met: 95.10% statement, 85.11% branch

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
- [[Drawing Tools]] — Complete guide to all 13 tools
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
| **Version (main)** | 1.5.10 |
| **Version (REL1_43)** | 1.5.10-REL1_43 |
| **Version (REL1_39)** | 1.1.14 |
| **Release Date** | January 2026 |
| **Test Suites** | 147 |
| **Total Tests** | 9,469 |
| **PHPUnit Test Files** | 23 |
| **Statement Coverage** | 95% |
| **Branch Coverage** | 85% |
| **JavaScript Files** | 115 |
| **ES6 Classes** | 100+ |

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
