# Quick Start Guide

Create your first image annotation in 5 minutes!

---

## Step 1: Open the Editor

1. Navigate to any **File:** page (e.g., `File:Example.jpg`)
2. Click the **"Edit Layers"** tab at the top of the page

![Editor Tab Location](https://via.placeholder.com/600x100?text=Edit+Layers+Tab)

---

## Step 2: Understand the Interface

The editor has three main areas:

```
┌──────────────────────────────────────────────────────────────┐
│  TOOLBAR (top)                                                │
│  [Pointer][Zoom][Text][Shapes...][Style Controls][Actions]   │
├────────────────────────────────────────────┬─────────────────┤
│                                            │  LAYER PANEL    │
│                                            │                 │
│               CANVAS                       │  • Layer 1      │
│           (your image)                     │  • Layer 2      │
│                                            │  • Background   │
│                                            │                 │
└────────────────────────────────────────────┴─────────────────┘
```

- **Toolbar**: Drawing tools and style controls
- **Canvas**: Your image with annotations
- **Layer Panel**: Manage layers, visibility, and order

---

## Step 3: Add Your First Annotation

### Add a Text Label

1. Click the **Text tool** (T) in the toolbar, or press `T`
2. Click on the canvas where you want the text
3. Type your label text
4. Press **Enter** or click **OK**

### Add a Rectangle Highlight

1. Click the **Rectangle tool** (R) in the toolbar, or press `R`
2. Click and drag on the canvas to draw
3. Release to complete the shape

### Add an Arrow Callout

1. Click the **Arrow tool** (A) in the toolbar, or press `A`
2. Click the starting point
3. Drag to the ending point
4. Release to complete

---

## Step 4: Style Your Annotations

With a layer selected:

1. **Stroke Color**: Click the color picker in the toolbar
2. **Fill Color**: Click the fill color picker
3. **Stroke Width**: Adjust the slider (0-50px)
4. **Shadow**: Toggle on/off and adjust blur/offset

> **Tip:** Save frequently-used styles as presets! See [[Style Presets]].

---

## Step 5: Save Your Work

1. Click the **Save** button in the toolbar, or press `Ctrl+S`
2. Your annotations are now saved and visible to all users

---

## Step 6: Display in Wiki Pages

To show your annotations in a wiki article:

```wikitext
[[File:Example.jpg|layers=on]]
```

Or use a specific named layer set:

```wikitext
[[File:Example.jpg|layers=anatomy]]
```

---

## Essential Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Pointer Tool | `V` |
| Text Tool | `T` |
| Rectangle Tool | `R` |
| Arrow Tool | `A` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Save | `Ctrl+S` |
| Delete Selected | `Delete` |
| Multi-Select | `Ctrl+Click` |

Press `Shift+?` to see all shortcuts.

---

## Tips for Better Annotations

### Use Consistent Colors
Create a color scheme for your project and save it as presets.

### Layer Order Matters
Layers on top appear in front. Drag layers in the panel to reorder.

### Use Named Sets for Different Purposes
Create separate layer sets for different annotation purposes:
- `default` — General annotations
- `labels` — Text labels only
- `highlights` — Color highlights
- `tutorial` — Step-by-step guides

### Zoom for Precision
Use `Z` to switch to zoom mode, or scroll the mouse wheel to zoom in/out.

---

## Next Steps

- [[Drawing Tools]] — Master all 13 tools
- [[Keyboard Shortcuts]] — Speed up your workflow
- [[Style Presets]] — Save and reuse styles
- [[Named Layer Sets]] — Organize multiple annotation sets
