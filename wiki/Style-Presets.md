# Style Presets

Save and reuse style configurations to maintain consistency across your annotations.

---

## What Are Style Presets?

Style presets let you save a combination of style properties (colors, stroke width, shadow settings, etc.) and apply them with a single click. This ensures:

- **Consistency** — Same styles across multiple images
- **Efficiency** — No need to manually set properties each time
- **Collaboration** — Share styles with other editors (via browser localStorage)

---

## Using Style Presets

### Accessing the Preset Dropdown

The preset dropdown is located in the toolbar, next to the style controls.

```
[Pointer][Text][Rectangle]...  [Preset: Default ▼] [Color][Fill][Width]...
```

### Applying a Preset

1. Select one or more layers (or have no selection to affect new layers)
2. Click the preset dropdown
3. Choose a preset from the list
4. The style is immediately applied

### Built-in Presets

Each tool type has built-in presets:

| Tool Type | Available Presets |
|-----------|-------------------|
| **Shapes** | Default, Bold Outline, Subtle, Warning, Success, Info |
| **Text** | Default, Heading, Caption, Label, Highlighted |
| **Arrows** | Default, Bold, Subtle, Callout, Pointer |
| **Lines** | Default, Thin, Thick, Dashed, Dotted |

---

## Creating Custom Presets

### From Current Style

1. Configure the style you want (colors, stroke, shadow, etc.)
2. Click the preset dropdown
3. Click **"Save Current Style..."**
4. Enter a name for your preset
5. Click **Save**

### From Selected Layer

1. Select a layer with the style you want to save
2. Click the preset dropdown
3. Click **"Save from Selection..."**
4. Enter a name for your preset
5. Click **Save**

---

## Managing Presets

### Viewing All Presets

Click the preset dropdown to see all available presets, organized by:
- **Built-in Presets** — Cannot be deleted
- **Custom Presets** — Your saved presets

### Deleting a Custom Preset

1. Click the preset dropdown
2. Hover over the preset you want to delete
3. Click the **×** button that appears
4. Confirm deletion

> **Note:** Built-in presets cannot be deleted.

### Renaming a Preset

Currently, presets cannot be renamed. Delete and recreate with the new name.

---

## Style Properties Included in Presets

When you save a preset, these properties are captured:

### Stroke Properties
- `stroke` — Stroke color
- `strokeWidth` — Line thickness
- `strokeOpacity` — Stroke transparency

### Fill Properties
- `fill` — Fill color
- `fillOpacity` — Fill transparency

### Shadow Properties
- `shadow` — Shadow enabled
- `shadowColor` — Shadow color
- `shadowBlur` — Blur radius
- `shadowOffsetX` — Horizontal offset
- `shadowOffsetY` — Vertical offset
- `shadowSpread` — Spread distance

### Text Properties
- `fontFamily` — Font name
- `fontSize` — Text size
- `fontWeight` — Normal/Bold
- `fontStyle` — Normal/Italic
- `textStrokeColor` — Text outline color
- `textStrokeWidth` — Text outline width
- `textShadow` — Text shadow enabled
- `textShadowColor` — Text shadow color
- `textShadowBlur` — Text shadow blur
- `textShadowOffsetX` — Text shadow X offset
- `textShadowOffsetY` — Text shadow Y offset

### Other Properties
- `opacity` — Overall layer opacity
- `blendMode` — Blend mode
- `arrowStyle` — Arrow line style (solid/dashed/dotted)
- `arrowhead` — Arrow head type
- `arrowSize` — Arrow head size

---

## Preset Storage

### Where Are Presets Stored?

Custom presets are stored in your browser's **localStorage**. This means:

- ✅ Presets persist across browser sessions
- ✅ Presets are available on the same computer
- ❌ Presets don't sync between browsers
- ❌ Presets don't sync between computers
- ❌ Clearing browser data deletes presets

### Exporting/Importing Presets

Currently, there's no built-in export/import feature. For backup:

1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Find keys starting with `layers-presets-`
4. Copy the JSON values

---

## Tips for Effective Preset Usage

### Create a Style Guide

For team projects, document your preset names and when to use them:

| Preset Name | Use Case |
|-------------|----------|
| `important-callout` | Critical warnings and alerts |
| `subtle-note` | Minor explanatory notes |
| `measurement` | Dimension lines and labels |
| `highlight-yellow` | Text highlighting |

### Name Presets Descriptively

Good names:
- `red-warning-box`
- `blue-info-arrow`
- `transparent-highlight`

Poor names:
- `style1`
- `my-preset`
- `new`

### Keep Presets Minimal

Create presets for specific purposes rather than trying to capture every style variation.

### Use Built-in Presets as Starting Points

1. Apply a built-in preset
2. Modify as needed
3. Save as a new custom preset

---

## Troubleshooting

### Preset Not Applying

- Ensure a layer is selected (or no selection for new layers)
- Check that the preset is compatible with the layer type
- Try refreshing the page

### Presets Disappeared

- Browser localStorage may have been cleared
- Try a different browser profile
- Check if private/incognito mode is enabled (presets won't persist)

### Preset Looks Different Than Expected

- Some properties may be layer-type specific
- Text presets won't fully apply to shapes
- Shape presets won't fully apply to text

---

## See Also

- [[Drawing Tools]] — Tool reference
- [[Keyboard Shortcuts]] — Speed up your workflow
