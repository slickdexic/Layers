# Slide Mode Implementation Plan

> **Status:** Implemented (Core Features)  
> **Version:** 1.0  
> **Date:** January 31, 2026  
> **Current Release:** v1.5.56

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| `{{#Slide:}}` parser function | ✅ Implemented | Full support |
| `canvas`, `size`, `background` params | ✅ Implemented | |
| `noedit` flag | ✅ Implemented | Hides edit button |
| `class`, `placeholder`, `layerset` | ✅ Implemented | |
| `Special:Slides` listing page | ✅ Implemented | |
| `Special:EditSlide/Name` editor | ✅ Implemented | |
| **`lock` parameter** | ❌ NOT IMPLEMENTED | Aspirational |
| **Lock mode indicators** | ❌ NOT IMPLEMENTED | Aspirational |

> **Note:** Sections describing the `lock` parameter document **proposed future behavior** that has not been implemented. Search for "NOT IMPLEMENTED" in this document to identify these sections.

## Executive Summary

Slide Mode enables creating canvas-based visual content without requiring a parent image. This allows the Layers extension to be used for diagrams, infographics, presentations, and other standalone visual content directly within wiki pages.

## Table of Contents

1. [Use Cases](#1-use-cases)
2. [Wikitext Syntax](#2-wikitext-syntax)
3. [Hide Edit Button](#3-hide-edit-button)
4. [Database Design](#4-database-design)
5. [API Changes](#5-api-changes)
6. [Editor Changes](#6-editor-changes)
7. [Special Page](#7-special-page)
8. [Configuration](#8-configuration)
9. [File Changes](#9-file-changes)
10. [Implementation Phases](#10-implementation-phases)
11. [Template Examples](#11-template-examples)
12. [Migration & Compatibility](#12-migration--compatibility)
13. [Testing Strategy](#13-testing-strategy)
14. [Appendix A: Design Decisions](#appendix-a-design-decisions)
15. [Appendix B: Troubleshooting](#appendix-b-troubleshooting)
16. [Appendix C: Glossary](#appendix-c-glossary)

---

## 1. Use Cases

### 1.1 Template Authors (Technical Users)
- Create reusable diagram templates with fixed dimensions
- Lock canvas sizes to ensure consistency across pages
- Define branded backgrounds and default layer sets

### 1.2 Content Editors (Non-Technical Users)
- Use pre-built templates to add diagrams to articles
- Edit layer content within template-defined constraints
- No need to understand canvas sizing or parser syntax

### 1.3 Power Users
- Create custom slides from scratch
- Full control over canvas dimensions and styling
- Build complex infographics and presentations

---

## 2. Wikitext Syntax

### 2.1 Parser Function

```wikitext
{{#Slide: SlideName
 | canvas = WIDTHxHEIGHT
 | size = WIDTHxHEIGHT
 | background = COLOR
 | class = CSS_CLASSES
 | placeholder = MESSAGE
 | layerset = SETNAME
 | noedit
}}
```

> **Note:** The lowercase `{{#slide:}}` syntax is also supported.

### 2.2 Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `SlideName` | Yes | — | Unique identifier (alphanumeric, hyphens, underscores) |
| `canvas` | No | `800x600` | Canvas dimensions in pixels (`WIDTHxHEIGHT`) |
| `size` | No | canvas size | Display size - scales the slide to fit within bounds |
| `noedit` | No | — | Hide the edit overlay button (boolean flag, no value) |
| `background` | No | `#ffffff` | Background color (hex, rgb, named colors, or `transparent`) |
| `class` | No | — | Additional CSS classes for the container |
| `placeholder` | No | i18n default | Text shown when slide is empty |
| `layerset` | No | `default` | Named layer set to display |

### 2.3 Naming Rules

- **Allowed characters:** `a-z`, `A-Z`, `0-9`, `-`, `_`
- **Length:** 1-100 characters
- **Case-sensitive:** `MySlide` and `myslide` are different slides
- **Namespace-scoped:** Slides are unique per wiki namespace

### 2.4 Examples

```wikitext
{{!-- Basic slide with default settings --}}
{{#Slide: ProcessDiagram }}

{{!-- Custom canvas size --}}
{{#Slide: OrgChart | canvas=1200x800 }}

{{!-- Transparent background for overlay use, no edit button --}}
{{#Slide: Watermark | canvas=400x100 | background=transparent | noedit }}

{{!-- Full-featured slide --}}
{{#Slide: ArchitectureDiagram
 | canvas = 1600x900
 | background = #f5f5f5
 | class = diagram-shadow diagram-bordered
 | placeholder = Click to add architecture diagram
 | layerset = v2-design
}}
```

---

## 3. Hide Edit Button

### 3.1 The `noedit` Flag

Use the `noedit` flag to hide the edit overlay button from viewers:

```wikitext
{{#Slide: PublishedContent | noedit }}
```

**Behavior:**
- The edit overlay button is hidden from all users
- The view/fullscreen button is still available
- Users with `editlayers` permission can still access the editor via `Special:EditSlide/SlideName`
- This is purely a UI convenience, not a security feature

### 3.2 Use Cases for `noedit`

| Use Case | Example |
|----------|--------|
| Published content | Finalized diagrams that shouldn't show edit affordances |
| Embedded displays | Slides used as decorative elements |
| Kiosk/presentation mode | Read-only display contexts |

### 3.3 Comparison with Image Layers

The `noedit` flag for slides is analogous to hiding the edit overlay for images. Both:
- Hide the edit button from the UI
- Allow direct access via special pages for authorized users
- Are not security mechanisms (permissions still control actual editing)

---

## 4. Database Design

### 4.1 Approach: Reuse Existing Table

Slides are stored in the existing `layer_sets` table with the following conventions:

| Column | Slide Value | Purpose |
|--------|-------------|---------|
| `ls_img_name` | `Slide:SlideName` | Identifies as slide, stores name |
| `ls_img_sha1` | `slide` | Marker distinguishing from image-based sets |
| `ls_json_blob` | JSON with slide metadata | Contains layers + canvas size |

### 4.2 JSON Schema v2

```json
{
  "schema": 2,
  "revision": 1,
  "created": "2026-01-20T12:00:00Z",
  "isSlide": true,
  "canvasWidth": 800,
  "canvasHeight": 600,
  "backgroundColor": "#ffffff",
  "layers": [
    { "id": "layer1", "type": "rectangle", ... }
  ]
}
```

#### New Fields in Schema v2

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `isSlide` | boolean | `false` | Distinguishes slides from image-based sets |
| `canvasWidth` | integer | `800` | Canvas width in pixels |
| `canvasHeight` | integer | `600` | Canvas height in pixels |
| `backgroundColor` | string | `#ffffff` | Canvas background color |

### 4.3 Schema Migration

- Schema v1 data continues to work (isSlide defaults to false)
- No database migration required
- Upgrade happens automatically on first save

### 4.4 Why Not a New Table?

1. **Simpler architecture** - Layer rendering code works unchanged
2. **Shared revision history** - Same versioning system applies
3. **Named sets support** - Slides can have multiple layer sets
4. **Existing API reuse** - `layersinfo`/`layerssave` work with minimal changes
5. **Fewer migration headaches** - Production wikis don't need schema updates

---

## 5. API Changes

### 5.1 Modified Endpoints

#### `action=layersinfo`

**New parameter:**
```
slidename=SlideName  (alternative to filename for slides)
```

**Response changes:**
```json
{
  "layersinfo": {
    "layerset": {
      "isSlide": true,
      "canvasWidth": 800,
      "canvasHeight": 600,
      "backgroundColor": "#ffffff",
      ...existing fields...
    }
  }
}
```

#### `action=layerssave`

**New parameter:**
```
slidename=SlideName  (alternative to filename for slides)
```

**Behavior changes:**
- Skip file existence check when `slidename` is provided
- Validate slide name format
- Store with `ls_img_name = 'Slide:' + slidename`
- Store with `ls_img_sha1 = 'slide'`

#### `action=layersdelete`

**New parameter:**
```
slidename=SlideName  (alternative to filename for slides)
```

### 5.2 New Endpoint

#### `action=layerslist` (Special:Slides backend)

**Parameters:**
```
action=layerslist
prefix=SEARCH_PREFIX (optional)
limit=50 (optional, max 500)
offset=0 (optional)
sort=name|created|modified (optional, default=name)
```

**Response:**
```json
{
  "layerslist": {
    "slides": [
      {
        "name": "ProcessDiagram",
        "canvasWidth": 800,
        "canvasHeight": 600,
        "revisionCount": 5,
        "created": "2026-01-15T10:00:00Z",
        "modified": "2026-01-20T14:30:00Z",
        "createdBy": "AdminUser",
        "modifiedBy": "EditorUser"
      }
    ],
    "total": 42,
    "continue": 50
  }
}
```

---

## 6. Editor Changes

### 6.1 Entry Points

| Context | Entry Method |
|---------|--------------|
| Parser output | Click slide container → Opens editor |
| Special:Slides | "Edit" button → Opens editor |
| Direct URL | `Special:EditSlide/SlideName` |

### 6.2 Toolbar Additions

New toolbar section for slides:

```
┌─────────────────────────────────────────────────┐
│ [Canvas: 800×600 ▼] [Background: █ #fff ▼]     │
│ [Grid ☐] [Snap ☑] [Guides ☑]                   │
└─────────────────────────────────────────────────┘
```

#### Canvas Size Dropdown
- Preset sizes: 800×600, 1024×768, 1280×720, 1920×1080, Custom...
- Custom opens dialog with width/height inputs
- Disabled when `lock=size` or `lock=all`

#### Background Color Picker
- Color picker with presets and custom input
- "Transparent" option for overlay slides
- Disabled when `lock=all`

### 6.3 Canvas Resize Handles

For `lock=none` slides:
- Corner resize handles appear on canvas edges
- Drag to resize canvas (distinct from layer resize)
- Shift+drag maintains aspect ratio
- Status bar shows current dimensions

### 6.4 Slide Properties Panel

New collapsible section in layer panel:

```
┌─ Slide Properties ──────────────────────────────┐
│ Name:       ProcessDiagram (read-only)          │
│ Width:      [800] px                            │
│ Height:     [600] px                            │
│ Background: [█ #ffffff    ] [picker]            │
│ Lock:       🔒 Size locked by template          │
│                                                 │
│ [Copy Embed Code]                               │
└─────────────────────────────────────────────────┘
```

### 6.5 Lock Indicators

Visual feedback for lock modes:

| Lock Mode | Indicator |
|-----------|-----------|
| `none` | No indicator |
| `size` | 🔒 icon on canvas dimensions, "Size locked by template" tooltip |
| `all` | Banner: "This slide is locked. Contact an admin to edit." |

### 6.6 Empty State

When slide has no layers:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              📊 Empty Slide                    │
│                                                 │
│     Click the edit button to add content        │
│         or use the drawing tools                │
│                                                 │
│              [Start Editing]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7. Special Page

### 7.1 Special:Slides

Management interface for all slides on the wiki.

#### List View

```
┌─────────────────────────────────────────────────────────────────────┐
│ Special:Slides                                     [+ Create New]   │
├─────────────────────────────────────────────────────────────────────┤
│ Search: [________________] [🔍]                                     │
│ Sort by: [Name ▼]  Show: [All ▼]                                   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────┐                                                            │
│ │ 📊  │ ProcessDiagram                              [Edit] [Delete] │
│ │      │ 800×600 • 12 layers • Modified 2h ago by User1            │
│ └──────┘                                                            │
│ ┌──────┐                                                            │
│ │ 📊  │ OrgChart                                    [Edit] [Delete] │
│ │      │ 1200×800 • 45 layers • Modified 1d ago by User2           │
│ └──────┘                                                            │
│ ┌──────┐                                                            │
│ │ 📊  │ ArchitectureDiagram                         [Edit] [Delete] │
│ │      │ 1600×900 • 23 layers • Modified 3d ago by User3           │
│ └──────┘                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ Showing 1-20 of 42 slides                    [< Prev] [Next >]     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Create Dialog

```
┌─────────────────────────────────────────────────┐
│ Create New Slide                           [×]  │
├─────────────────────────────────────────────────┤
│ Name: [____________________]                    │
│                                                 │
│ Canvas Size:                                    │
│ ○ 800×600 (Standard)                           │
│ ○ 1024×768 (4:3)                               │
│ ○ 1280×720 (16:9 HD)                           │
│ ○ 1920×1080 (16:9 Full HD)                     │
│ ● Custom: [1200] × [800]                       │
│                                                 │
│ Background:                                     │
│ [█ #ffffff    ] [picker]                       │
│                                                 │
│               [Cancel] [Create & Edit]          │
└─────────────────────────────────────────────────┘
```

### 7.2 URL Structure

```
Special:Slides                    → List all slides
Special:Slides/SlideName          → View/edit specific slide
Special:EditSlide/SlideName       → Direct edit mode (alias)
Special:Slides?action=create      → Create dialog
```

### 7.3 Permissions

| Action | Required Right |
|--------|----------------|
| View Special:Slides | `read` |
| Create slide | `editlayers` |
| Edit slide | `editlayers` |
| Delete slide | `editlayers` + (owner OR `delete`) |
| Override lock=all | `delete` (admin) |

---

## 8. Configuration

### 8.1 New Configuration Options

Add to `extension.json`:

```json
{
  "config": {
    "LayersSlidesEnable": {
      "value": true,
      "description": "Enable Slide Mode feature"
    },
    "LayersSlideDefaultWidth": {
      "value": 800,
      "description": "Default canvas width for new slides"
    },
    "LayersSlideDefaultHeight": {
      "value": 600,
      "description": "Default canvas height for new slides"
    },
    "LayersSlideMaxWidth": {
      "value": 4096,
      "description": "Maximum allowed canvas width"
    },
    "LayersSlideMaxHeight": {
      "value": 4096,
      "description": "Maximum allowed canvas height"
    },
    "LayersSlideDefaultBackground": {
      "value": "#ffffff",
      "description": "Default background color for new slides"
    }
  }
}
```

### 8.2 LocalSettings.php Examples

```php
// Disable Slide Mode entirely
$wgLayersSlidesEnable = false;

// Set larger default canvas
$wgLayersSlideDefaultWidth = 1280;
$wgLayersSlideDefaultHeight = 720;

// Allow larger canvases (for high-res displays)
$wgLayersSlideMaxWidth = 8192;
$wgLayersSlideMaxHeight = 8192;

// Dark theme default
$wgLayersSlideDefaultBackground = '#1a1a1a';
```

---

## 9. File Changes

### 9.1 PHP Files

| File | Change Type | Description |
|------|-------------|-------------|
| `extension.json` | Modify | Add config, hooks, special page, messages |
| `src/Hooks/SlideHooks.php` | **New** | Parser function implementation |
| `src/Api/ApiLayersSave.php` | Modify | Handle `slidename` parameter |
| `src/Api/ApiLayersInfo.php` | Modify | Handle `slidename` parameter |
| `src/Api/ApiLayersDelete.php` | Modify | Handle `slidename` parameter |
| `src/Api/ApiLayersList.php` | **New** | Special:Slides backend |
| `src/SpecialPages/SpecialSlides.php` | **New** | Special page implementation |
| `src/Validation/SlideNameValidator.php` | **New** | Slide name validation |

### 9.2 JavaScript Files

| File | Change Type | Description |
|------|-------------|-------------|
| `resources/ext.layers.editor/LayersEditor.js` | Modify | Slide mode detection, lock handling |
| `resources/ext.layers.editor/canvas/CanvasManager.js` | Modify | Canvas resize for slides |
| `resources/ext.layers.editor/ui/Toolbar.js` | Modify | Canvas size/background controls |
| `resources/ext.layers.editor/ui/SlidePropertiesPanel.js` | **New** | Slide properties UI |
| `resources/ext.layers.editor/editor/SlideController.js` | **New** | Slide-specific logic |
| `resources/ext.layers/viewer/ViewerManager.js` | Modify | Slide rendering |
| `resources/ext.layers.slides/SpecialSlides.js` | **New** | Special:Slides UI |

### 9.3 CSS Files

| File | Change Type | Description |
|------|-------------|-------------|
| `resources/ext.layers.editor/styles/slide-mode.css` | **New** | Slide-specific styles |
| `resources/ext.layers.slides/special-slides.css` | **New** | Special:Slides styles |

### 9.4 i18n Files

Add to `i18n/en.json`:

```json
{
  "layers-slide-parser-desc": "Embeds a Layers slide canvas",
  "layers-slide-empty": "This slide is empty. Click to add content.",
  "layers-slide-locked": "This slide is locked by template settings.",
  "layers-slide-size-locked": "Canvas size is controlled by the template.",
  "layers-slide-size-changed": "Canvas size was changed by the template. Some layers may need repositioning.",
  "layers-slide-create": "Create New Slide",
  "layers-slide-name": "Slide Name",
  "layers-slide-canvas-size": "Canvas Size",
  "layers-slide-background": "Background",
  "layers-slide-invalid-name": "Invalid slide name. Use only letters, numbers, hyphens, and underscores.",
  "layers-slide-name-exists": "A slide with this name already exists.",
  "layers-slide-not-found": "Slide not found.",
  "special-slides": "Slides",
  "special-slides-desc": "Manage Layers slides",
  "special-slides-search": "Search slides...",
  "special-slides-create": "Create New",
  "special-slides-edit": "Edit",
  "special-slides-delete": "Delete",
  "special-slides-delete-confirm": "Are you sure you want to delete the slide \"$1\"? This cannot be undone.",
  "special-slides-empty": "No slides found.",
  "special-slides-count": "Showing $1-$2 of $3 slides"
}
```

---

## 10. Implementation Phases

### Phase 1: Core Infrastructure (8-10 hours) ✅ COMPLETED

**Goal:** Basic slide creation and editing works

**Status:** Completed January 20, 2025

**Tasks:**
1. ✅ Add `SlideHooks.php` with `{{#Slide:}}` parser function
2. ✅ Modify `ApiLayersSave.php` to handle slides
3. ✅ Modify `ApiLayersInfo.php` to handle slides
4. ✅ Add slide detection in `LayersEditor.js` (APIManager.js updated)
5. ✅ Add slide rendering in `ViewerManager.js`
6. ✅ Add basic i18n messages
7. ✅ Add configuration options to `extension.json`
8. ✅ Write unit tests for new PHP code

**Milestone:** `{{#Slide: Test }}` renders a canvas and can be edited

**Files Created:**
- `src/Hooks/SlideHooks.php` (~402 lines)
- `src/Validation/SlideNameValidator.php` (~125 lines)
- `tests/phpunit/unit/Validation/SlideNameValidatorTest.php`
- `tests/phpunit/unit/Hooks/SlideHooksTest.php`

**Files Modified:**
- `extension.json` - Added 6 config options, hooks, autoload classes
- `src/Api/ApiLayersSave.php` - Added `slidename` parameter
- `src/Api/ApiLayersInfo.php` - Added `slidename` parameter
- `resources/ext.layers.editor/APIManager.js` - Added slide mode support
- `resources/ext.layers/viewer/ViewerManager.js` - Added slide initialization
- `i18n/en.json` - Added 21 slide-related messages
- `i18n/qqq.json` - Added message documentation

---

### Phase 2: Editor Enhancements (6-8 hours) ✅ COMPLETED

**Goal:** Full slide editing experience

**Status:** Completed January 20, 2026

**Tasks:**
1. ✅ Add canvas resize controls to toolbar
2. ✅ Add background color picker
3. ✅ Implement `SlidePropertiesPanel.js`
4. ✅ Add lock mode handling (hide resize when locked)
5. ✅ Add size conflict notification banner
6. ✅ Update status bar for slide dimensions
7. ✅ Add empty state UI
8. ✅ Write unit tests for new JS code

**Milestone:** Complete editing experience with all lock modes working

---

### Phase 3: Special:Slides (6-8 hours) ✅ COMPLETED

**Goal:** Slide management interface

**Status:** Completed January 21, 2026

**Tasks:**
1. ✅ Create `ApiLayersList.php` - API module for listing slides
2. ✅ Create `SpecialSlides.php` - Special page for slide management
3. ✅ Create `SpecialEditSlide.php` - Direct slide editor access
4. ✅ Create `SpecialSlides.js` - Frontend UI (SlidesManager, CreateSlideDialog)
5. ✅ Create `special-slides.css` - Styles with dark mode support
6. ✅ Add search/filter functionality
7. ✅ Add pagination
8. ✅ Add delete confirmation with OO.ui
9. ✅ Write PHP unit tests
10. ✅ Write Jest unit tests

**Files Created:**
- `src/Api/ApiLayersList.php` (~220 lines)
- `src/SpecialPages/SpecialSlides.php` (~280 lines)
- `src/SpecialPages/SpecialEditSlide.php` (~180 lines)
- `resources/ext.layers.slides/SpecialSlides.js` (~500 lines)
- `resources/ext.layers.slides/special-slides.css` (~420 lines)
- `tests/phpunit/unit/Database/SlideListingTest.php`
- `tests/phpunit/unit/SpecialPages/SpecialSlidesTest.php`
- `tests/phpunit/unit/SpecialPages/SpecialEditSlideTest.php`
- `tests/jest/SpecialSlides.test.js` (36 tests)

**Files Modified:**
- `src/Database/LayersDatabase.php` - Added `listSlides()` and `countSlides()` methods (~200 lines)
- `extension.json` - Added SpecialPages, APIModules, AutoloadClasses, ResourceModules
- `i18n/en.json` - Added ~50 new messages
- `i18n/qqq.json` - Added message documentation

**Milestone:** Full slide management without using wikitext

---

### Phase 4: Polish & Documentation (4-6 hours)

**Goal:** Production-ready release

**Tasks:**
1. Add keyboard shortcuts for slide operations
2. Performance optimization for large slide lists
3. Accessibility audit (ARIA labels, focus management)
4. Update extension documentation
5. Create user guide wiki pages
6. Add integration tests
7. Update CHANGELOG.md
8. Bump version to 1.6.0

**Milestone:** Feature complete, documented, ready for release

---

## 11. Template Examples

### 11.1 Basic Diagram Template

```wikitext
{{!-- Template:Diagram --}}
<noinclude>
Creates a standard diagram canvas. 

'''Usage:'''
<code><nowiki>{{Diagram|name=MyDiagram}}</nowiki></code>

'''Parameters:'''
* '''name''' - Unique identifier for this diagram
</noinclude><includeonly>{{#Slide: {{{name|}}}
 | canvas = 800x600
 | lock = size
 | placeholder = Add your diagram content here
}}</includeonly>
```

**Usage:**
```wikitext
== Process Overview ==
{{Diagram|name=MainProcess}}
```

### 11.2 Org Chart Template

```wikitext
{{!-- Template:OrgChart --}}
<noinclude>
Creates an organization chart canvas with horizontal layout.

'''Usage:'''
<code><nowiki>{{OrgChart|name=DepartmentChart}}</nowiki></code>
</noinclude><includeonly><div class="orgchart-container">
{{#Slide: OrgChart-{{{name|}}}
 | canvas = 1200x600
 | lock = size
 | background = #f9f9f9
 | class = orgchart-slide
 | placeholder = Click to build your org chart
}}
</div></includeonly>
```

### 11.3 Infobox Diagram Template

```wikitext
{{!-- Template:InfoboxDiagram --}}
<noinclude>
Small diagram for use inside infoboxes.

'''Usage:'''
<code><nowiki>{{InfoboxDiagram|name=LocationMap}}</nowiki></code>
</noinclude><includeonly>{{#Slide: Infobox-{{{name|}}}
 | canvas = 300x200
 | lock = size
 | background = transparent
 | class = infobox-diagram
}}</includeonly>
```

### 11.4 Page Forms Integration

```wikitext
{{!-- Template with Page Forms --}}
{{{for template|Project}}}
{| class="formtable"
|-
! Project Name:
| {{{field|name}}}
|-
! Architecture Diagram:
| {{#Slide: Project-{{{field|name}}}-arch
   | canvas = 1000x700
   | lock = size
}}
|-
! Status:
| {{{field|status}}}
|}
{{{end template}}}
```

---

## 12. Migration & Compatibility

### 12.1 Backward Compatibility

| Aspect | Impact |
|--------|--------|
| Existing layer sets | ✅ No impact - schema v1 continues working |
| Database schema | ✅ No changes required |
| Existing templates | ✅ No impact |
| API consumers | ✅ New parameters are optional |

### 12.2 Schema Version Handling

```php
// In LayersDatabase.php or ServerSideLayerValidator.php
if ( !isset( $data['schema'] ) || $data['schema'] < 2 ) {
    // v1 data: default slide fields
    $data['isSlide'] = false;
    $data['canvasWidth'] = 800;
    $data['canvasHeight'] = 600;
    $data['backgroundColor'] = '#ffffff';
}
```

### 12.3 Feature Flag

Slide Mode can be disabled entirely:

```php
// LocalSettings.php
$wgLayersSlidesEnable = false;
```

When disabled:
- `{{#Slide:}}` outputs an error message
- Special:Slides returns a "feature disabled" message
- Existing slides are hidden but data is preserved

### 12.4 Upgrade Path

1. **Upgrade extension** - No database migration needed
2. **Test with feature enabled** - Default `$wgLayersSlidesEnable = true`
3. **Create templates** - Set up reusable slide templates
4. **Train users** - Document available templates

---

## 13. Testing Strategy

### 13.1 Unit Tests

**PHP Tests:**
- `SlideHooksTest.php` - Parser function behavior
- `SlideNameValidatorTest.php` - Name validation rules
- `ApiLayersSaveSlideTest.php` - Slide save operations
- `ApiLayersInfoSlideTest.php` - Slide info retrieval
- `ApiLayersListTest.php` - Slide listing

**JavaScript Tests:**
- `SlideController.test.js` - Slide mode logic
- `SlidePropertiesPanel.test.js` - Properties UI
- `CanvasManager.slide.test.js` - Canvas resize for slides

### 13.2 Integration Tests

- Create slide via parser function → Edit → Save → Reload
- Lock mode enforcement (size, all)
- Size conflict resolution
- Special:Slides CRUD operations
- Permission checks

### 13.3 E2E Tests (Playwright)

- `slide-creation.spec.js` - Create slide via Special:Slides
- `slide-editing.spec.js` - Edit slide layers
- `slide-template.spec.js` - Use template to embed slide
- `slide-lock.spec.js` - Lock mode behavior

### 13.4 Coverage Targets

| Metric | Target |
|--------|--------|
| Statement coverage | ≥90% |
| Branch coverage | ≥80% |
| New PHP files | 100% covered |
| New JS files | 100% covered |

---

## Appendix A: Open Questions

These items should be resolved during implementation:

1. **Slide thumbnails** - Should Special:Slides show preview thumbnails?
   - Pro: Better UX
   - Con: Performance cost, caching complexity
   - Decision: Defer to Phase 4 as optional enhancement

2. **Slide export** - Should slides be exportable as PNG/SVG?
   - Already exists for image-based layers
   - Should work the same for slides
   - Decision: Verify existing export works, document

3. **Slide duplication** - Should there be a "Duplicate" feature?
   - Useful for creating variations
   - Decision: Add to Special:Slides in Phase 3

4. **Slide templates** - Should slides support predefined layer templates?
   - Example: "Start with blank" vs "Start with grid" vs "Start with org chart structure"
   - Decision: Future enhancement (post-1.6.0)

---

## Appendix B: Troubleshooting

### Problem: `{{#Slide:}}` renders as plain text instead of a slide

**Symptoms:**
- The wikitext `{{#Slide: MySlideName}}` appears literally on the page
- Or it renders as partial text with missing `}}`

**Solutions:**

1. **Rebuild the localisation cache:**
   ```bash
   php maintenance/rebuildLocalisationCache.php
   ```

2. **Purge the page cache:**
   - Add `?action=purge` to the page URL, or
   - Edit and save the page without changes

3. **Verify the extension is loaded:**
   - Check `Special:Version` for "Layers" in the extension list
   - Ensure `wfLoadExtension( 'Layers' );` is in LocalSettings.php

4. **Check if Slide Mode is enabled:**
   ```php
   // In LocalSettings.php, ensure this is NOT set to false:
   $wgLayersSlidesEnable = true;  // Default is true
   ```

5. **Clear MediaWiki object cache:**
   ```bash
   php maintenance/run.php PurgeParserCache
   ```

### Problem: Edit button doesn't appear on slides

**Symptoms:**
- The slide renders correctly (shows "Empty slide" message)
- No edit button (pencil icon) appears in the top-right corner

**Solutions:**

1. **Verify user permissions:**
   - The user must be logged in
   - The user must have the `editlayers` right
   - Anonymous users cannot edit by default

2. **Check LocalSettings.php permissions:**
   ```php
   // Default: logged-in users can edit
   $wgGroupPermissions['user']['editlayers'] = true;
   
   // To allow anonymous editing (not recommended):
   // $wgGroupPermissions['*']['editlayers'] = true;
   ```

3. **Check if slide is locked:**
   - If `lock=all` is set, only admins with `delete` right can edit
   - If `editable=no` is set, the edit button is hidden

4. **Verify CSS is loading:**
   - Open browser DevTools → Network tab
   - Look for `ext.layers` module loading
   - Check for CSS loading errors

5. **Check JavaScript console:**
   - Open browser DevTools → Console
   - Look for JavaScript errors that might prevent initialization
   - Enable debug mode: `$wgLayersDebug = true;`

### Problem: Slide data not saving

**Symptoms:**
- Edit button works, editor opens
- Changes don't persist after saving

**Solutions:**

1. **Check database tables exist:**
   ```bash
   php maintenance/update.php
   ```

2. **Verify CSRF token:**
   - If you see "Invalid token" errors, try logging out and back in

3. **Check rate limits:**
   - Default: 30 saves per hour for regular users
   - Adjust in LocalSettings.php if needed:
   ```php
   $wgRateLimits['editlayers-save']['user'] = [ 60, 3600 ];
   ```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| Slide | A canvas-based visual element without a parent image |
| Layer Set | A named collection of layers (applies to both image-based and slides) |
| Lock Mode | Template-controlled restrictions on slide editing |
| Canvas | The drawing area with defined dimensions and background |
| Parser Function | MediaWiki wikitext syntax `{{#FunctionName:}}` |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | AI Assistant | Initial plan |

