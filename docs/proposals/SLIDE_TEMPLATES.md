# Slide Templates — Design Proposal

**Author:** GitHub Copilot (Claude Opus 4.5)  
**Date:** January 26, 2026  
**Status:** Draft for Review  
**Version:** 0.3

> **Naming Decision (v0.2):** Parser function is `{{#slidetemplate:}}` (lowercase, no separator).
> MediaWiki parser functions are case-insensitive, so `{{#SlideTemplate:}}` also works.

> **Behavioral Scenarios (v0.3):** Added comprehensive Section 13 covering binding behavior,
> state machine, canvas size scope, and 9 detailed real-world scenarios.

---

## Executive Summary

Slide Templates provide reusable design blueprints that can be applied to multiple slides, ensuring visual consistency across a wiki while allowing controlled content customization. This document proposes a complete implementation including terminology, storage, API, UI, and wikitext syntax.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Terminology](#terminology)
3. [Core Concepts](#core-concepts)
4. [Wikitext Syntax](#wikitext-syntax)
5. [Template Structure](#template-structure)
6. [Editability Model](#editability-model)
7. [Template Inheritance](#template-inheritance)
8. [Storage Design](#storage-design)
9. [API Design](#api-design)
10. [UI/UX Design](#uiux-design)
11. [Permission Model](#permission-model)
12. [Migration & Compatibility](#migration--compatibility)
13. [Behavioral Scenarios & Strategies](#behavioral-scenarios--strategies) ← NEW
14. [Technical Constraints & Edge Cases](#technical-constraints--edge-cases)
15. [Implementation Phases](#implementation-phases)
16. [Open Questions](#open-questions)
17. [Alternatives Considered](#alternatives-considered)

---

## 1. Motivation

### Current Pain Points

1. **No design consistency** — Each slide is independent; maintaining brand consistency requires manual effort
2. **Duplication** — Common elements (logos, headers, footers) must be recreated on every slide
3. **Update burden** — Changing a common element requires editing every slide individually
4. **No separation of concerns** — Designers and content authors work in the same space

### Goals

1. **Reusability** — Create once, use many times
2. **Consistency** — Enforce visual standards across slides
3. **Maintainability** — Update template, all slides update
4. **Flexibility** — Allow controlled content customization
5. **Simplicity** — Intuitive for non-technical users

### Non-Goals (for v1)

- Template inheritance chains (template extending template)
- Conditional/dynamic template logic
- Multi-template composition (one slide, multiple templates)

---

## 2. Terminology

### Proposed Terms

| Term | Definition |
|------|------------|
| **Slide Template** | A reusable design blueprint defining canvas size, locked visual elements, and editable content regions |
| **Master Layer** | A layer defined in the template that appears on all slides using it; typically locked |
| **Content Region** | A designated area in a template where slide-specific content can be placed or edited |
| **Placeholder** | A special layer type (text, image, shape) that defines position/style but allows content replacement |
| **Template Instance** | A slide that uses a template |
| **Bound Slide** | Alternative term for Template Instance |
| **Unbound Slide** | A slide created without a template (current behavior) |

### Why "Slide Template" and not alternatives?

| Alternative | Reasoning |
|-------------|-----------|
| "Master Slide" | PowerPoint terminology; "master" has problematic connotations |
| "Blueprint" | Less intuitive for non-technical users |
| "Layout" | Implies only positioning, not styling |
| "Design" | Too generic |
| "Theme" | Usually refers to colors/fonts globally, not per-slide |

**Recommendation:** Use **"Slide Template"** as the primary term, shortened to **"template"** in context.

---

## 3. Core Concepts

### 3.1 Template as a First-Class Entity

Templates are **separate from slides** — they have their own:
- Storage (database table or distinct type)
- Namespace (conceptually, like `SlideTemplate:`)
- Editing interface
- Permissions
- Revision history

### 3.2 Live Inheritance (Not Snapshot)

When a slide uses a template:
- Template layers render **live** from the template's current state
- Editing the template **immediately** affects all slides using it
- Slides do NOT store a copy of template layers

This is like CSS: change the stylesheet, all pages update.

### 3.3 Separation of Layers

A bound slide has TWO layer sources:

```
┌─────────────────────────────────────────┐
│              RENDERED SLIDE             │
├─────────────────────────────────────────┤
│  [Template Layers]  ← From template     │
│     └── Background                      │
│     └── Header (locked)                 │
│     └── Footer (locked)                 │
│     └── Logo (locked)                   │
│     └── Title Placeholder               │
├─────────────────────────────────────────┤
│  [Slide Layers]     ← From this slide   │
│     └── Content shapes                  │
│     └── User annotations                │
│     └── Placeholder content fills       │
└─────────────────────────────────────────┘
```

### 3.4 Z-Order Control

Templates can define where slide content appears in the stack:

- **Below template** — Rare; slide content behind template elements
- **Above template** (default) — Slide content on top of template background
- **Interleaved** — Template defines specific z-index insertion points

For v1, recommend **"Above template"** as the default and only option.

---

## 4. Wikitext Syntax

### 4.0 Parser Function Naming

The parser function is **`{{#slidetemplate:}}`** (lowercase, single word, no separator).

This follows MediaWiki conventions:
- Matches the pattern of `{{#slide:}}` (single word)
- Avoids hyphens/underscores which are uncommon in MW parser functions
- Case-insensitive: `{{#slidetemplate:}}`, `{{#SlideTemplate:}}`, `{{#SLIDETEMPLATE:}}` all work

**Canonical documentation form:** `{{#slidetemplate:}}` (lowercase)

### 4.1 Creating/Editing Templates

```wikitext
{{#slidetemplate: TemplateName | canvas=1920x1080 | bgcolor=#ffffff}}
```

This creates or links to a template. Clicking opens the template editor.

### 4.2 Using Templates in Slides

```wikitext
{{#Slide: MySlideName | template=TemplateName}}
{{#Slide: MySlideName | template=TemplateName | layerset=anatomy}}
{{#Slide: MySlideName | template=TemplateName | size=800x600}}
```

**Parameter behavior when template is specified:**

| Parameter | Behavior |
|-----------|----------|
| `template` | Required to use a template |
| `canvas` | **IGNORED** — Template controls canvas size |
| `size` | Display size (still valid — scales output) |
| `bgcolor` | **IGNORED** — Template controls background |
| `layerset` | Names the layer set for this slide's content |
| `lock` | Still valid — controls edit mode (`lock=view`) |

### 4.3 Inline Placeholder Content (Advanced)

For simple text placeholders, allow inline content:

```wikitext
{{#Slide: Presentation/Slide1 
  | template=CorpPresentation
  | title=Q4 Financial Results
  | subtitle=Confidential
}}
```

Where `title` and `subtitle` are placeholder names defined in the template.

This creates a slide and pre-fills placeholders without opening the editor.

---

## 5. Template Structure

### 5.1 Template JSON Schema

```javascript
{
  "schema": 2,
  "type": "slide-template",
  "canvas": {
    "width": 1920,
    "height": 1080
  },
  "background": {
    "color": "#ffffff",
    // or gradient, or image
  },
  "layers": [
    // Master layers (locked)
    {
      "id": "header-bar",
      "type": "rectangle",
      "locked": true,
      "templateLock": "full",  // Cannot be modified by slides
      // ... geometry, style
    },
    // Placeholder layers
    {
      "id": "title-placeholder",
      "type": "textbox",
      "locked": false,
      "templateLock": "style",  // Position/style locked, content editable
      "placeholder": {
        "name": "title",
        "hint": "Enter slide title",
        "required": true
      },
      // ... geometry, style
    },
    {
      "id": "content-region",
      "type": "group",
      "locked": false,
      "templateLock": "none",  // Free editing zone
      "placeholder": {
        "name": "content",
        "hint": "Add your content here"
      }
    }
  ],
  "metadata": {
    "author": "Designer",
    "description": "Standard presentation template",
    "tags": ["corporate", "presentation"]
  }
}
```

### 5.2 Template Lock Levels

| Level | Meaning | Use Case |
|-------|---------|----------|
| `full` | Completely locked; invisible in slide editor layer panel | Logos, decorative elements |
| `visible` | Visible but not selectable or editable | Headers, footers |
| `style` | Position/style locked; content editable | Title text boxes, image placeholders |
| `position` | Position locked; style/content editable | Content zones with fixed location |
| `none` | Fully editable (rare for template layers) | Optional starting content |

### 5.3 Folder Organization

Templates should use folders to organize layers:

```
📁 Background (templateLock: full)
   └── Background Rectangle
   └── Decorative Pattern
📁 Header (templateLock: visible)
   └── Header Bar
   └── Logo
📁 Content Placeholders (templateLock: style)
   └── Title (placeholder: title)
   └── Subtitle (placeholder: subtitle)
📁 Footer (templateLock: visible)
   └── Footer Bar
   └── Page Number Placeholder
```

---

## 6. Editability Model

### 6.1 When Editing a Template

- All layers are editable (normal editor behavior)
- Special UI shows placeholder configuration
- Preview shows how template looks with sample content
- Warning before save: "This will update X slides"

### 6.2 When Editing a Bound Slide

| Template Layer Type | Appearance | Interaction |
|---------------------|------------|-------------|
| `full` locked | Not shown | None |
| `visible` locked | Dimmed, behind slide layers | None |
| `style` placeholder | Shown, selectable | Content only (text, image replacement) |
| `position` placeholder | Shown, selectable | Style and content |
| `none` | Shown, selectable | Full editing |

**Slide-specific layers:**
- Added normally
- Always render above template layers (v1)
- Saved only to the slide, not the template

### 6.3 Placeholder Editing

When user selects a placeholder:

```
┌─────────────────────────────────────────┐
│ Properties Panel                        │
├─────────────────────────────────────────┤
│ [Template Placeholder]                  │
│                                         │
│ Title: [Q4 Financial Results_____]      │
│                                         │
│ ℹ️ Style controlled by template          │
│                                         │
│ Font: Inter Bold (locked 🔒)            │
│ Size: 48px (locked 🔒)                  │
│ Color: #1a1a1a (locked 🔒)              │
└─────────────────────────────────────────┘
```

---

## 7. Template Inheritance

### 7.1 Live vs Snapshot (Recommendation: Live)

**Live Inheritance (Recommended):**
```
Template updated → All bound slides immediately show new template
```

Pros:
- Single source of truth
- Easy maintenance
- Consistent behavior

Cons:
- Template changes can unexpectedly affect slides
- No "freeze" option (yet)

**Snapshot Inheritance (Not Recommended for v1):**
```
Slide stores template version → Manual update required
```

We can add snapshot/versioning in v2 if needed.

### 7.2 Template Versioning (Future)

For v2, consider:
- `template=CorpTemplate@v3` — Pin to specific version
- `template=CorpTemplate@latest` — Always use latest (default)
- Template revision history with diff view
- "Update all slides to version X" bulk action

---

## 8. Storage Design

### 8.1 New Database Table: `layer_templates`

```sql
CREATE TABLE layer_templates (
    lt_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lt_name VARCHAR(255) NOT NULL,           -- Template name (unique)
    lt_user_id INT UNSIGNED NOT NULL,        -- Creator
    lt_data MEDIUMBLOB NOT NULL,             -- JSON template definition
    lt_canvas_width INT UNSIGNED NOT NULL,   -- Canvas width
    lt_canvas_height INT UNSIGNED NOT NULL,  -- Canvas height
    lt_revision INT UNSIGNED DEFAULT 1,      -- Revision number
    lt_timestamp BINARY(14) NOT NULL,        -- Last modified
    lt_deleted TINYINT(1) DEFAULT 0,         -- Soft delete flag
    
    UNIQUE INDEX lt_name (lt_name),
    INDEX lt_user (lt_user_id),
    INDEX lt_timestamp (lt_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=binary;
```

### 8.2 Template Revision History: `layer_template_revisions`

```sql
CREATE TABLE layer_template_revisions (
    ltr_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ltr_template_id INT UNSIGNED NOT NULL,   -- FK to layer_templates
    ltr_revision INT UNSIGNED NOT NULL,      -- Revision number
    ltr_user_id INT UNSIGNED NOT NULL,       -- Editor
    ltr_data MEDIUMBLOB NOT NULL,            -- JSON at this revision
    ltr_timestamp BINARY(14) NOT NULL,       -- When saved
    ltr_comment VARCHAR(255),                -- Edit summary
    
    FOREIGN KEY (ltr_template_id) REFERENCES layer_templates(lt_id),
    UNIQUE INDEX ltr_template_revision (ltr_template_id, ltr_revision),
    INDEX ltr_timestamp (ltr_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=binary;
```

### 8.3 Extended Slides Table

Add to existing `layer_slides`:

```sql
ALTER TABLE layer_slides 
ADD COLUMN ls_template_id INT UNSIGNED DEFAULT NULL,
ADD COLUMN ls_template_revision INT UNSIGNED DEFAULT NULL,  -- NULL = latest
ADD FOREIGN KEY (ls_template_id) REFERENCES layer_templates(lt_id);
```

### 8.4 Slide JSON with Template Reference

```javascript
// Slide data when using template
{
  "schema": 2,
  "type": "slide",
  "template": {
    "name": "CorpPresentation",
    "version": "latest"  // or specific revision number
  },
  "placeholders": {
    "title": "Q4 Financial Results",
    "subtitle": "Confidential",
    "image-main": "data:image/png;base64,..."
  },
  "layers": [
    // Only slide-specific layers stored here
    // Template layers are NOT duplicated
  ]
}
```

---

## 9. API Design

### 9.1 New API Modules

#### `slidetemplateinfo` (Read)

```
GET action=slidetemplateinfo&templatename=CorpPresentation
```

Response:
```json
{
  "slidetemplateinfo": {
    "template": {
      "id": 42,
      "name": "CorpPresentation",
      "revision": 5,
      "canvas": { "width": 1920, "height": 1080 },
      "data": { ... },
      "user": { "id": 1, "name": "Designer" },
      "timestamp": "20260126143000",
      "usage_count": 47
    },
    "revisions": [
      { "revision": 5, "user": "Designer", "timestamp": "20260126143000" },
      { "revision": 4, "user": "Designer", "timestamp": "20260125120000" }
    ]
  }
}
```

#### `slidetemplatesave` (Write)

```
POST action=slidetemplatesave
  &templatename=CorpPresentation
  &data={...}
  &comment=Updated header colors
  &token=CSRF
```

#### `slidetemplateDelete` (Write)

```
POST action=slidetemplatedelete
  &templatename=CorpPresentation
  &token=CSRF
```

Returns error if template is in use by slides (unless `force=1`).

#### `slidetemplateusage` (Read)

```
GET action=slidetemplateusage&templatename=CorpPresentation&limit=50
```

Returns list of slides using this template.

### 9.2 Extended `slidesinfo`

When querying a bound slide:

```json
{
  "slidesinfo": {
    "slide": {
      "name": "Presentation/Slide1",
      "template": {
        "name": "CorpPresentation",
        "revision": 5,
        "canvas": { "width": 1920, "height": 1080 }
      },
      "templateLayers": [ ... ],  // Merged from template
      "slideLayers": [ ... ],     // This slide only
      "placeholders": {
        "title": { "value": "Q4 Results", "type": "text" }
      }
    }
  }
}
```

---

## 10. UI/UX Design

### 10.1 Template Gallery

New special page: `Special:SlideTemplates`

```
┌─────────────────────────────────────────────────────────────┐
│ Slide Templates                                      [+ New]│
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Preview │ │ Preview │ │ Preview │ │ Preview │            │
│ │  (16:9) │ │  (16:9) │ │  (16:9) │ │  (16:9) │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│ Corporate   Marketing   Technical   Blank 16:9             │
│ 47 slides   23 slides   12 slides   156 slides             │
│ [Edit]      [Edit]      [Edit]      [Edit]                 │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Template Editor Mode

Same as slide editor, with additions:

1. **Mode indicator** — "Editing Template: CorpPresentation"
2. **Placeholder tools** — Mark layers as placeholders
3. **Lock controls** — Set templateLock level per layer
4. **Preview panel** — Show with sample content
5. **Usage warning** — "47 slides use this template"

### 10.3 Bound Slide Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Layers Panel                                                │
├─────────────────────────────────────────────────────────────┤
│ 📁 Template: CorpPresentation (v5) [🔗 Edit Template]       │
│    └── 🔒 Header (from template)                            │
│    └── 🔒 Footer (from template)                            │
│    └── ✏️ Title Placeholder                                 │
│    └── ✏️ Subtitle Placeholder                              │
├─────────────────────────────────────────────────────────────┤
│ 📁 Slide Layers                                 [+ Add]     │
│    └── Rectangle 1                                          │
│    └── Text annotation                                      │
│    └── Arrow                                                │
└─────────────────────────────────────────────────────────────┘

🔒 = Locked (from template, not editable)
✏️ = Placeholder (content editable)
```

### 10.4 "Apply Template" Dialog

When creating a new slide or changing template:

```
┌─────────────────────────────────────────────────────────────┐
│ Choose Template                                    [Cancel] │
├─────────────────────────────────────────────────────────────┤
│ [Search templates...                               🔍]      │
│                                                             │
│ ○ No template (blank canvas)                               │
│                                                             │
│ Recent:                                                     │
│ ● Corporate Presentation (1920×1080)                       │
│ ○ Marketing One-Pager (1200×630)                           │
│ ○ Technical Diagram (1600×900)                             │
│                                                             │
│ All Templates:                                              │
│ ○ Annual Report                                            │
│ ○ Event Banner                                             │
│ ○ Social Media Post                                        │
│                                                             │
│                                            [Apply Template] │
└─────────────────────────────────────────────────────────────┘
```

### 10.5 Placeholder Configuration UI

When editing a template and selecting a layer:

```
┌─────────────────────────────────────────────────────────────┐
│ Properties                                                  │
├─────────────────────────────────────────────────────────────┤
│ Template Settings                                           │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ☑️ Make this a placeholder                              ││
│ │                                                         ││
│ │ Placeholder name: [title_______________]                ││
│ │ Hint text: [Enter slide title__________]                ││
│ │ ☐ Required                                              ││
│ │                                                         ││
│ │ Lock level: [Style locked (content editable) ▼]         ││
│ │   ○ Fully locked (hidden from slide authors)            ││
│ │   ○ Visible only (decorative, not selectable)           ││
│ │   ● Style locked (content editable)                     ││
│ │   ○ Position locked (style & content editable)          ││
│ │   ○ Unlocked (fully editable)                           ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Permission Model

### 11.1 New Rights

| Right | Description | Default Groups |
|-------|-------------|----------------|
| `editslidetemplate` | Create and edit slide templates | `user` |
| `deleteSlidetemplate` | Delete slide templates | `sysop` |
| `manageslidetemplates` | Manage all templates (including others') | `sysop` |

### 11.2 Template Ownership

- Creator becomes owner
- Owner can edit/delete their templates
- `manageslidetemplates` can edit/delete any template

### 11.3 Usage Protection

- Templates in use cannot be deleted without `force=1`
- Deleted templates: slides using them render without template (graceful degradation)
- Consider "archive" state vs hard delete

---

## 12. Migration & Compatibility

### 12.1 Backward Compatibility

- Existing slides continue to work unchanged
- `{{#Slide:}}` without `template=` works as before
- No breaking changes to existing API

### 12.2 Migration Path

1. **Schema migration** — Add `layer_templates` and `layer_template_revisions` tables
2. **No data migration** — Templates are new; no conversion needed
3. **Optional** — Tool to convert existing slide into template

### 12.3 Graceful Degradation

If template is missing:
- Slide renders with just its own layers
- Warning in editor: "Template 'X' not found"
- API returns `template_missing: true`

---

## 13. Behavioral Scenarios & Strategies

This section addresses critical behavioral questions through concrete scenarios.

### 13.1 Fundamental Design Decisions

Before examining scenarios, we must establish core principles:

#### Decision 1: Where is Template Binding Stored?

**Options:**
- A) In wikitext only (each `{{#slide:}}` invocation specifies template)
- B) In slide data (template is a property of the slide itself)
- C) Hybrid (slide stores binding, wikitext can override for display)

**Recommendation: Option B — Slide stores binding**

Rationale:
- A slide is ONE entity, regardless of how many pages embed it
- Template binding affects the slide's structure (canvas size, layers)
- Multiple pages shouldn't be able to create conflicting states
- Wikitext `template=` becomes a binding action, not a display option

**Implication:** Once a slide is bound to a template, it stays bound until explicitly unbound through the editor. The wikitext `template=` parameter:
- Binds an unbound slide to a template (first-time action)
- Is ignored if slide is already bound to that template
- Shows a warning if slide is bound to a DIFFERENT template
- Can use `template=none` to explicitly unbind

#### Decision 2: Canvas Size Scope

**Question:** Where does canvas size live? Slide level, layer set level, or both?

**Options:**
- A) One canvas size per slide (all layer sets share it)
- B) Canvas size per layer set (each set can differ)
- C) Template controls canvas, slide inherits

**Recommendation: Option A — One canvas per slide**

Rationale:
- Layer sets are annotation variations, not layout variations
- Different canvas sizes per set would be confusing
- Template binding changes the slide's canvas (destructive but clear)
- Simpler mental model for users

**Implication:** When a slide binds to a template with a different canvas size:
- Slide canvas resizes to match template
- Existing layers may need repositioning (warn user)
- All layer sets inherit the new canvas size

#### Decision 3: Template Binding Permanence

**Question:** Once bound, can you unbind? Can you change templates?

**Recommendation: Flexible but explicit**

| Action | Allowed | Behavior |
|--------|---------|----------|
| Bind unbound slide to template | ✅ Yes | Template layers appear, canvas adopts template size |
| Unbind bound slide | ✅ Yes | Template layers "flatten" into slide as regular layers |
| Change to different template | ✅ Yes | Old template layers removed, new template applied |
| Accidental rebinding via wikitext | ❌ No | Ignored if already bound; warning if different template |

**Unbinding behavior:** When a bound slide is unbound:
- Template layers are copied INTO the slide as regular editable layers
- Placeholder content becomes regular layers
- Canvas size is preserved
- This is a one-way "flatten" operation

---

### 13.2 Scenario Walkthroughs

#### Scenario 1: Adding `template=` to Existing Slide with Layers

**Setup:**
- Slide "MyDiagram" exists with 10 layers of content
- User edits wikitext to add `template=CorpPresentation`

**What happens:**

```
BEFORE:                         AFTER:
┌─────────────────┐            ┌─────────────────┐
│ [Slide Layers]  │            │ [Template]      │ ← NEW
│  └── Layer 10   │            │  └── Header     │
│  └── Layer 9    │            │  └── Footer     │
│  └── ...        │            │  └── Logo       │
│  └── Layer 1    │            ├─────────────────┤
└─────────────────┘            │ [Slide Layers]  │ ← PRESERVED
                               │  └── Layer 10   │
                               │  └── Layer 9    │
                               │  └── ...        │
                               │  └── Layer 1    │
                               └─────────────────┘
```

**Behavior:**
1. Template layers are inserted BELOW existing slide layers
2. Existing layers become "slide layers" (preserved, editable)
3. Canvas resizes to template canvas (if different)
4. User sees confirmation: "Slide bound to template. Canvas resized from 800×600 to 1920×1080."

**Edge case — Canvas resize impact:**
- If template canvas is larger: layers stay at original positions (top-left anchor)
- If template canvas is smaller: layers may be outside visible area (warn user)
- Recommendation: Offer "Scale layers to fit" option

---

#### Scenario 2: Same Slide, Multiple Wikitext Invocations

**Setup:**
- Page A: `{{#slide: SharedDiagram | template=CorpPresentation}}`
- Page B: `{{#slide: SharedDiagram}}` (no template specified)
- Page C: `{{#slide: SharedDiagram | template=MarketingTemplate}}`

**What happens:**

1. **First render (Page A):** Slide is unbound. The `template=CorpPresentation` binds it. Slide now stores `template: "CorpPresentation"` in its data.

2. **Page B renders:** No `template=` specified. Slide is already bound. **Renders with template** because binding is stored in slide, not wikitext.

3. **Page C renders:** Different template specified. **Warning logged**, but slide renders with its stored template (CorpPresentation), not MarketingTemplate.

**Key principle:** Wikitext specifies intent, but slide state is authoritative.

**User experience on Page C:**
- Slide renders with CorpPresentation (its bound template)
- Editor shows info: "This slide is bound to 'CorpPresentation'. To change template, edit the slide."
- No silent corruption or conflicting states

---

#### Scenario 3: Wikitext Specifies Different Canvas Size

**Setup:**
- Slide "MySlide" is bound to template "Wide" (1920×1080)
- User writes: `{{#slide: MySlide | template=Wide | canvas=800×600}}`

**What happens:**

| Parameter | Specified | Actual | Reason |
|-----------|-----------|--------|--------|
| `template` | Wide | Wide | Matches binding ✓ |
| `canvas` | 800×600 | 1920×1080 | Template controls canvas |

**Behavior:** `canvas=` parameter is **ignored** for bound slides. Template is authoritative for canvas size.

**If user wants 800×600:**
- Option 1: Create a template with 800×600 canvas
- Option 2: Unbind the slide and set canvas manually
- Option 3: Use `size=800×600` for display scaling (doesn't change actual canvas)

---

#### Scenario 4: Template Deleted While Slides Use It

**Setup:**
- Template "OldBrand" has 47 slides using it
- Admin deletes the template

**What happens (Graceful Degradation):**

```
BEFORE (bound):                 AFTER (orphaned):
┌─────────────────┐            ┌─────────────────┐
│ [Template]      │            │ ⚠️ Template      │
│  └── Header     │    →       │    "OldBrand"   │
│  └── Footer     │            │    NOT FOUND    │
├─────────────────┤            ├─────────────────┤
│ [Slide Layers]  │            │ [Slide Layers]  │
│  └── Content    │            │  └── Content    │
└─────────────────┘            └─────────────────┘
```

**Behavior:**
1. Slide still references template "OldBrand" in its data
2. Renderer shows slide layers only (template layers missing)
3. Editor shows warning: "Template 'OldBrand' not found. Slide may appear incomplete."
4. API returns: `"template_missing": true, "template_name": "OldBrand"`

**Recovery options:**
- Recreate template with same name → slides automatically reconnect
- Unbind slides → template reference cleared, slide layers preserved
- Bind to different template

---

#### Scenario 5: Layer Sets and Templates

**Question:** Does template binding apply to all layer sets, or per layer set?

**Recommendation: Template binding is at slide level, not layer set level**

**Rationale:**
- Template defines canvas size, which must be consistent across layer sets
- Template provides structural elements (header, footer) that should appear in all sets
- Layer sets are for content variations (e.g., English vs Spanish labels), not layout variations

**Behavior:**
```
Slide: "AnatomyDiagram"
Template: "EducationalSlide" (bound)

Layer Set "default":
  [Template: Header, Footer]
  [Slide: Heart diagram, English labels]

Layer Set "spanish":
  [Template: Header, Footer]     ← Same template
  [Slide: Heart diagram, Spanish labels]

Layer Set "simplified":
  [Template: Header, Footer]     ← Same template
  [Slide: Heart diagram, fewer labels]
```

All layer sets share the same template layers. Content layers vary per set.

---

#### Scenario 6: Placeholder Content When Template Changes

**Setup:**
- Template "V1" has placeholders: title, subtitle, main-image
- Slide has content for all three placeholders
- Designer updates template to "V2": removes subtitle, adds author placeholder

**What happens:**

| Placeholder | V1 | V2 | Slide Content | Result |
|-------------|----|----|---------------|--------|
| title | ✓ | ✓ | "Q4 Results" | Preserved, mapped to V2 placeholder |
| subtitle | ✓ | ✗ | "Confidential" | Becomes orphaned slide layer |
| main-image | ✓ | ✓ | Image data | Preserved, mapped to V2 placeholder |
| author | ✗ | ✓ | — | Empty placeholder (shows hint) |

**Orphaned content handling:**
- Content for removed placeholders becomes regular slide layers
- Positioned at original placeholder location
- Fully editable (no longer style-locked)
- User notified: "1 placeholder was removed. Content preserved as slide layer."

---

#### Scenario 7: Copy/Duplicate a Bound Slide

**Setup:**
- Slide "Original" is bound to template "Corp"
- User duplicates to create "Copy"

**What happens:**

| Property | Original | Copy |
|----------|----------|------|
| Template binding | Corp | Corp (inherited) |
| Canvas size | 1920×1080 | 1920×1080 |
| Template layers | Reference | Reference (same) |
| Slide layers | Content A | Content A (copied) |
| Placeholder content | Values X | Values X (copied) |

**Behavior:** The copy maintains template binding. Both slides now share the same template reference. Editing the template affects both.

**If user wants independent copy:**
- Duplicate, then unbind → template layers flatten into slide
- Now fully independent, no template connection

---

#### Scenario 8: Permission Conflicts

**Setup:**
- User A can edit slides but NOT templates
- User A opens a bound slide in editor

**What happens:**

| Element | Visible | Editable |
|---------|---------|----------|
| Template layers (full lock) | No | No |
| Template layers (visible lock) | Yes (dimmed) | No |
| Template placeholders | Yes | Content only |
| Slide layers | Yes | Full |
| "Edit Template" button | Visible | Disabled |
| "Unbind from Template" | Visible | Allowed* |

*Unbinding is allowed because it only affects this slide, not the template.

**User A's experience:** Can edit slide content and placeholders, but cannot modify template-controlled elements. Clear visual distinction between template (locked) and slide (editable) layers.

---

#### Scenario 9: Recursive or Circular References

**Setup:**
- Attempt to create template that references a slide
- Or slide that references a template that references it

**Prevention:**

| Invalid Pattern | Detection | Error |
|-----------------|-----------|-------|
| Template embeds a slide | Parser rejects | "Templates cannot embed slides" |
| Template extends another template | Not supported v1 | "Template inheritance not supported" |
| Slide A → Template → Slide A | N/A | Templates don't reference slides |

**Validation:** Templates are self-contained. They define layers, not references to other content. No recursion possible.

---

### 13.3 Binding State Machine

```
                    ┌─────────────┐
                    │  UNBOUND    │
                    │  (no template)│
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │ template=X      │ First embed     │
         │ in wikitext     │ with template=  │
         │                 ▼                 │
         │          ┌─────────────┐          │
         └─────────►│   BOUND     │◄─────────┘
                    │ (template X) │
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌─────────┐         ┌─────────────┐        ┌─────────────┐
│ UNBIND  │         │  REBIND     │        │ TEMPLATE    │
│ (via    │         │  (via editor│        │ DELETED     │
│ editor) │         │  change     │        │ (external)  │
└────┬────┘         │  template)  │        └──────┬──────┘
     │              └──────┬──────┘               │
     ▼                     ▼                      ▼
┌─────────────┐     ┌─────────────┐        ┌─────────────┐
│  UNBOUND    │     │   BOUND     │        │  ORPHANED   │
│ (template   │     │ (template Y)│        │ (template X │
│  flattened) │     └─────────────┘        │  missing)   │
└─────────────┘                            └─────────────┘
```

**State transitions:**
1. **UNBOUND → BOUND:** First `template=X` in wikitext or via editor
2. **BOUND → BOUND:** Change template via editor (not wikitext)
3. **BOUND → UNBOUND:** Explicit unbind action (flattens template)
4. **BOUND → ORPHANED:** Template deleted externally
5. **ORPHANED → BOUND:** Template recreated OR rebound to different template
6. **ORPHANED → UNBOUND:** Explicit unbind (clears dead reference)

---

### 13.4 Summary: Key Behavioral Rules

| Rule | Behavior |
|------|----------|
| Template binding is stored in slide | Not in wikitext; wikitext triggers initial binding only |
| Canvas size lives at slide level | All layer sets share one canvas; template controls it |
| One template per slide | Not per layer set; template applies to entire slide |
| Wikitext cannot override binding | If already bound, `template=` parameter is informational |
| Unbinding flattens template | Template layers become regular slide layers |
| Template changes propagate live | No snapshots; always uses current template version |
| Orphaned slides degrade gracefully | Render without template; warn in editor |
| Layer sets share template | Content varies per set, template structure is shared |

---

## 14. Technical Constraints & Edge Cases

### 14.1 Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max templates per wiki | 500 | Prevent abuse |
| Max placeholders per template | 20 | UI complexity |
| Template name length | 1-100 chars | Reasonable limit |
| Template name format | `[A-Za-z0-9_-/]+` | URL-safe |

### 14.2 Additional Edge Cases

| Scenario | Behavior |
|----------|----------|
| Delete template with slides using it | Require `force=1`; slides become orphaned |
| Rename template | Update all slide references |
| Circular reference (template uses itself) | Invalid; reject at save time |
| Template with 0 layers | Valid; just provides canvas size |
| Slide content overlaps template locked area | Allowed; z-order is defined |
| Template canvas size change | All bound slides resize |

### 14.3 Conflict Resolution Summary

| Conflict | Resolution |
|----------|------------|
| Slide has `canvas=800x600` but template is `1920x1080` | Template wins |
| Slide has `bgcolor=#fff` but template has `bgcolor=#000` | Template wins |
| Placeholder has content but template removes placeholder | Content becomes orphaned layer |

---

## 15. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

- [ ] Database schema for templates
- [ ] `ApiSlideTemplateInfo` (read)
- [ ] `ApiSlideTemplateSave` (write)
- [ ] `ApiSlideTemplateDelete` (write)
- [ ] Basic template editor (reuse slide editor)
- [ ] `{{#slidetemplate:}}` parser function

**Deliverable:** Can create, edit, save, delete templates via API and wikitext.

### Phase 2: Template Usage (2-3 weeks)

- [ ] `template=` parameter for `{{#Slide:}}`
- [ ] Slide editor shows template layers (read-only)
- [ ] API merges template layers into slide response
- [ ] Renderer composites template + slide layers

**Deliverable:** Slides can use templates; template changes propagate.

### Phase 3: Placeholders (2 weeks)

- [ ] Placeholder schema (`templateLock`, `placeholder` properties)
- [ ] Placeholder configuration UI in template editor
- [ ] Placeholder editing UI in slide editor
- [ ] Property panel shows locked/editable status

**Deliverable:** Full placeholder system working.

### Phase 4: Polish (1-2 weeks)

- [ ] `Special:SlideTemplates` gallery page
- [ ] Template preview thumbnails
- [ ] Usage tracking (`slidetemplateusage` API)
- [ ] "Apply Template" dialog
- [ ] Inline placeholder content in wikitext

**Deliverable:** Production-ready feature.

### Phase 5: Documentation & Testing

- [ ] User documentation in wiki
- [ ] Developer documentation
- [ ] Unit tests for API modules
- [ ] Integration tests
- [ ] E2E tests for editor

---

## 16. Open Questions

### For Product Decision

1. **Should templates be wiki-wide or per-category?**
   - Proposal: Wiki-wide, but support folder naming like `Category/TemplateName`

2. **Can anonymous users create templates?**
   - Proposal: No, require `user` group minimum

3. **Should we support "template of templates" (inheritance)?**
   - Proposal: No for v1; evaluate for v2

4. **Should slides track which template version they were created with?**
   - Proposal: Store reference but always use latest (v1)

### For Technical Decision

5. **Where to store template thumbnails for gallery?**
   - Option A: Generate on-demand (like current slide thumbnails)
   - Option B: Cache in `layer_templates` table
   - Proposal: Option A for simplicity

6. **How to handle template renames?**
   - Option A: Update all slide references
   - Option B: Use template ID internally, name is display only
   - Proposal: Option B (more robust)

7. **Rate limits for template operations?**
   - Proposal: Same as `editlayers-save` (30/hour for users)

---

## 17. Alternatives Considered

### Alternative A: Templates as Special Slides

**Idea:** Mark regular slides as "template" with a flag; no separate storage.

**Pros:**
- Simpler schema
- Reuse existing code

**Cons:**
- Pollutes slide namespace
- Harder to list/manage templates
- No template-specific metadata

**Decision:** Rejected; separate storage is cleaner.

### Alternative B: Snapshot-Based Inheritance

**Idea:** Slides store a copy of template layers at creation time.

**Pros:**
- Predictable; template changes don't surprise
- Works offline

**Cons:**
- Duplicates data
- Template updates don't propagate
- Loses main value proposition

**Decision:** Rejected; live inheritance is the key feature.

### Alternative C: CSS-Like External Styling

**Idea:** Templates only define styles; slides define structure.

**Pros:**
- True separation of style and content
- Very flexible

**Cons:**
- Complex mental model
- Doesn't match how designers think about templates
- Harder to implement

**Decision:** Rejected; layer-based templates are more intuitive.

---

## Appendix A: Example Template JSON

```json
{
  "schema": 2,
  "type": "slide-template",
  "name": "CorporatePresentation",
  "canvas": {
    "width": 1920,
    "height": 1080
  },
  "background": {
    "type": "gradient",
    "gradient": {
      "type": "linear",
      "angle": 135,
      "colors": [
        { "offset": 0, "color": "#1a365d" },
        { "offset": 1, "color": "#2d3748" }
      ]
    }
  },
  "layers": [
    {
      "id": "header-bar",
      "type": "rectangle",
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 120,
      "fill": "#ffffff",
      "opacity": 0.95,
      "locked": true,
      "templateLock": "full"
    },
    {
      "id": "logo",
      "type": "image",
      "x": 40,
      "y": 25,
      "width": 200,
      "height": 70,
      "src": "data:image/svg+xml;base64,...",
      "locked": true,
      "templateLock": "full"
    },
    {
      "id": "title",
      "type": "textbox",
      "x": 100,
      "y": 300,
      "width": 1720,
      "height": 150,
      "text": "",
      "fontSize": 72,
      "fontWeight": "bold",
      "fill": "#ffffff",
      "textAlign": "center",
      "locked": false,
      "templateLock": "style",
      "placeholder": {
        "name": "title",
        "hint": "Enter your slide title",
        "required": true
      }
    },
    {
      "id": "subtitle",
      "type": "textbox",
      "x": 100,
      "y": 470,
      "width": 1720,
      "height": 80,
      "text": "",
      "fontSize": 36,
      "fill": "#e2e8f0",
      "textAlign": "center",
      "locked": false,
      "templateLock": "style",
      "placeholder": {
        "name": "subtitle",
        "hint": "Optional subtitle",
        "required": false
      }
    },
    {
      "id": "footer-bar",
      "type": "rectangle",
      "x": 0,
      "y": 1020,
      "width": 1920,
      "height": 60,
      "fill": "#1a365d",
      "locked": true,
      "templateLock": "visible"
    },
    {
      "id": "footer-text",
      "type": "text",
      "x": 40,
      "y": 1035,
      "text": "Confidential | © 2026 Company Name",
      "fontSize": 14,
      "fill": "#a0aec0",
      "locked": true,
      "templateLock": "visible"
    }
  ],
  "metadata": {
    "description": "Standard corporate presentation template with header, title area, and footer",
    "author": "Design Team",
    "tags": ["corporate", "presentation", "16:9"],
    "created": "2026-01-26T14:30:00Z",
    "version": "1.0"
  }
}
```

---

## Appendix B: Wikitext Examples

### Creating a Template

```wikitext
== Presentation Templates ==

{{#slidetemplate: Corporate/Standard | canvas=1920x1080}}

{{#slidetemplate: Corporate/WideFormat | canvas=2560x1080}}

{{#slidetemplate: Social/Instagram | canvas=1080x1080 | bgcolor=#ffffff}}
```

### Using Templates in Slides

```wikitext
== Q4 2026 Presentation ==

=== Title Slide ===
{{#Slide: Q4-2026/Title 
  | template=Corporate/Standard 
  | title=Q4 2026 Results
  | subtitle=Board Meeting - January 2026
}}

=== Overview ===
{{#Slide: Q4-2026/Overview | template=Corporate/Standard}}

=== Charts ===
{{#Slide: Q4-2026/Charts 
  | template=Corporate/Standard 
  | size=800x450
}}
```

### Gallery Page

```wikitext
{{#slidetemplategallery: 
  | category=Corporate
  | columns=3
}}
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.2 | 2026-01-26 | Copilot | Parser function naming: `{{#slidetemplate:}}` (lowercase, no separator) |
| 0.1 | 2026-01-26 | Copilot | Initial draft |

---

*This document is a proposal for discussion. Implementation details may change based on review feedback.*
