# Alignment and Distribution

Professional layout tools for precise positioning of layers.

---

## Overview

Layers provides industry-standard alignment and distribution tools, matching the behavior of professional design software like Adobe Illustrator, Photoshop, and Figma.

---

## Key Object Alignment (v1.1.6+)

When multiple layers are selected, the **last selected layer** becomes the "key object":

- **Key object stays fixed** — It doesn't move during alignment
- **Other layers align TO the key object** — They move to match its position
- **Visual distinction** — Key object has an **orange border**, others have blue

### Example

1. Select Layer A (blue border)
2. Ctrl+Click Layer B (adds to selection, blue border)
3. Ctrl+Click Layer C (adds to selection, becomes key object, **orange border**)
4. Click "Align Left"
5. **Result:** Layers A and B move to align with Layer C's left edge. Layer C doesn't move.

---

## Alignment Tools

### Horizontal Alignment

| Button | Action | Behavior |
|--------|--------|----------|
| **Align Left** | Align left edges | All layers align to key object's left edge |
| **Align Center** | Align horizontal centers | All layers center horizontally on key object |
| **Align Right** | Align right edges | All layers align to key object's right edge |

### Vertical Alignment

| Button | Action | Behavior |
|--------|--------|----------|
| **Align Top** | Align top edges | All layers align to key object's top edge |
| **Align Middle** | Align vertical centers | All layers center vertically on key object |
| **Align Bottom** | Align bottom edges | All layers align to key object's bottom edge |

---

## Distribution Tools

Distribution spreads layers evenly across a span.

### Horizontal Distribution

**Distribute Horizontally** — Equalizes the horizontal spacing between layer centers.

```
Before:  [A]    [B][C]      [D]
After:   [A]   [B]   [C]   [D]
```

### Vertical Distribution

**Distribute Vertically** — Equalizes the vertical spacing between layer centers.

```
Before:     [A]              After:    [A]
            [B]                        
            [C]                        [B]
                                       
                                       [C]
            [D]                        [D]
```

---

## Accessing Alignment Tools

### Toolbar Buttons

The alignment buttons appear in the toolbar when multiple layers are selected:

```
[←] [↔] [→] [↑] [↕] [↓] | [⇔] [⇕]
 │   │   │   │   │   │     │   │
 │   │   │   │   │   │     │   └─ Distribute Vertically
 │   │   │   │   │   │     └───── Distribute Horizontally
 │   │   │   │   │   └─────────── Align Bottom
 │   │   │   │   └─────────────── Align Middle
 │   │   │   └─────────────────── Align Top
 │   │   └─────────────────────── Align Right
 │   └─────────────────────────── Align Center (Horizontal)
 └─────────────────────────────── Align Left
```

### Requirements

- **Alignment:** Requires 2+ layers selected
- **Distribution:** Requires 3+ layers selected

---

## Alignment Examples

### Center Multiple Labels

1. Create several text labels
2. Select all labels (Ctrl+Click or marquee select)
3. Click the last label to make it the key object
4. Click **Align Center**
5. All labels are now horizontally centered on the key object

### Create a Vertical Stack

1. Select all layers to stack
2. Click the topmost layer last (becomes key object)
3. Click **Align Left**
4. All layers left-align to the top layer

### Evenly Space Buttons

1. Position first and last buttons where you want them
2. Select all buttons
3. Click **Distribute Horizontally**
4. Middle buttons space evenly between first and last

---

## Tips

### Selecting the Right Key Object

The key object determines the reference point:
- For **Align Left**: Select the layer at the leftmost position last
- For **Align Top**: Select the layer at the top last
- For **Align Center**: Select the layer you want others to center on last

### Using with Rotation

Alignment uses the bounding box of rotated layers:
- The bounding box is axis-aligned (not rotated)
- Edges align to the bounding box edges, not the visual edges

### Undo Support

All alignment operations can be undone:
- `Ctrl+Z` to undo
- `Ctrl+Y` or `Ctrl+Shift+Z` to redo

### Combining Operations

Common workflow:
1. **Align** first (get layers in line)
2. **Distribute** second (space them evenly)

---

## Comparison with Other Tools

| Feature | Layers | Photoshop | Illustrator | Figma |
|---------|--------|-----------|-------------|-------|
| Key object | Last selected | Last selected | Click to designate | Last selected |
| Visual indicator | Orange border | Thicker border | Double border | Thicker outline |
| Alignment | 6 options | 6 options | 6 options | 6 options |
| Distribution | 2 options | 2+ options | 6+ options | Multiple |

---

## Troubleshooting

### Buttons Grayed Out

- **Alignment buttons gray:** Select at least 2 layers
- **Distribution buttons gray:** Select at least 3 layers

### Wrong Layer Moving

The key object (orange border) should stay fixed. If the wrong layer moves:
1. Deselect all (`Escape`)
2. Reselect layers in the desired order
3. Select the layer you want to stay fixed **last**

### Layers Not Aligning Properly

- Check that layers aren't locked
- Ensure all layers are visible
- For rotated layers, alignment uses bounding boxes

---

## See Also

- [[Drawing Tools]] — Tool reference
- [[Keyboard Shortcuts]] — Speed up your workflow
- [[Quick Start Guide]] — Getting started tutorial
