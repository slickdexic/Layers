# Frequently Asked Questions

Common questions about the Layers extension.

---

## General Questions

### What is Layers?

Layers is a professional-grade, non-destructive image annotation extension for MediaWiki. It allows you to add text, shapes, arrows, and other annotations to images without modifying the original files.

### What does "non-destructive" mean?

Non-destructive means your original images are never changed. All annotations are stored separately as data and rendered on top of the image when displayed. You can edit, remove, or version annotations at any time without affecting the source file.

### Which MediaWiki versions are supported?

- **MediaWiki 1.44+**: Use the `main` branch
- **MediaWiki 1.39 - 1.43**: Use the `REL1_39` branch

### What browsers are supported?

Layers works best in modern browsers:
- Chrome/Chromium 90+
- Firefox 90+
- Safari 14+
- Edge 90+ (Chromium-based)

---

## Usage Questions

### How do I add layers to an image?

1. Go to the File: page for your image
2. Click the "Edit Layers" tab
3. Use the drawing tools to add annotations
4. Click Save

### How do I show layers in a wiki article?

Add the `layers` parameter to your file link:

```wikitext
[[File:Example.jpg|layers=on]]
```

### Can I have multiple sets of annotations?

Yes! Named layer sets allow multiple independent annotation sets per image:

```wikitext
[[File:Diagram.png|layers=anatomy]]
[[File:Diagram.png|layers=measurements]]
```

See [[Named Layer Sets]] for details.

### How do I hide layers?

Use `layers=off` or `layers=none`:

```wikitext
[[File:Example.jpg|layers=off]]
```

### Can I copy layers between images?

Not directly through the UI. Workaround:
1. Export as PNG from the first image
2. Import the PNG as an image layer in the second image

### How do I undo changes?

- Press `Ctrl+Z` to undo
- Press `Ctrl+Y` or `Ctrl+Shift+Z` to redo
- Use revision history to restore previous versions

---

## Permission Questions

### Who can edit layers?

By default:
- All logged-in users can edit existing layer sets
- Autoconfirmed users can create new layer sets
- Administrators have full access

See [[Permissions]] for customization.

### Can anonymous users edit layers?

By default, no. You can enable it:

```php
$wgGroupPermissions['*']['editlayers'] = true;
```

However, this is not recommended for public wikis.

### Who can delete layer sets?

Only the owner (creator of the first revision) or administrators can delete layer sets.

### Why can't I see the "Edit Layers" tab?

Possible reasons:
- You're not logged in (if required)
- You don't have the `editlayers` permission
- The extension isn't properly installed
- You're not on a File: page

---

## Technical Questions

### Where is layer data stored?

Layer data is stored in a database table called `layers_sets`. Each row contains:
- Image filename
- Named set name
- Revision number
- User who saved
- Timestamp
- JSON layer data

### How large can layer data be?

By default, up to 2 MB per layer set. Configurable via:

```php
$wgLayersMaxBytes = 4194304;  // 4 MB
```

### How many layers can I have?

By default, up to 100 layers per set. Configurable via:

```php
$wgLayersMaxLayerCount = 200;
```

### Do layers work with thumbnails?

Yes! Layers scale automatically to match the displayed image size, whether thumbnail or full resolution.

### Can I use custom fonts?

The default fonts are configurable:

```php
$wgLayersDefaultFonts = ['Arial', 'Roboto', 'Georgia', 'Custom Font'];
```

Note: Custom fonts must be available on both server and client systems.

### Does Layers work offline?

No. Layers requires a connection to the MediaWiki server to load and save layer data.

---

## Performance Questions

### How many layers is too many?

There's no hard limit, but for best performance:
- **< 50 layers**: Excellent performance
- **50-100 layers**: Good performance
- **100+ layers**: May experience lag

### Do layers affect page load time?

Slightly. The viewer JavaScript must load, and layer data must be fetched. For typical usage, this adds ~100-200ms.

### How can I improve performance?

- Reduce layer count where possible
- Use appropriately sized images (not 8K for thumbnails)
- Enable caching: `$wgLayersThumbnailCache = true;`

---

## Comparison Questions

### How is Layers different from Extension:ImageAnnotator?

| Feature | Layers | ImageAnnotator |
|---------|--------|----------------|
| Tools | 13 drawing tools | Basic annotations |
| Style presets | Yes | No |
| Named sets | Yes | No |
| Non-destructive | Yes | Varies |
| Accessibility | WCAG 2.1 | Basic |

### Can I import annotations from other tools?

Not directly. You would need to:
1. Export from other tool as image
2. Import image as a layer in Layers

### Can I export to other formats?

Currently, you can:
- Export as PNG with background
- Export as PNG without background (transparent)

SVG and other format exports are not yet available.

---

## Accessibility Questions

### Is Layers accessible?

Yes! Layers follows WCAG 2.1 guidelines:
- Full keyboard navigation
- Screen reader support
- Focus indicators
- ARIA landmarks
- Skip links

### What are the keyboard shortcuts?

Press `Shift+?` in the editor to see all shortcuts. Key ones:
- `V` - Pointer tool
- `T` - Text tool
- `R` - Rectangle
- `Ctrl+Z` - Undo
- `Ctrl+S` - Save

### Does Layers work with screen readers?

Yes. The editor uses ARIA roles, labels, and live regions to announce changes to assistive technologies.

---

## Troubleshooting Questions

### My layers aren't showing, what's wrong?

See [[Troubleshooting]] for detailed solutions. Quick checks:
1. Layers are saved (check editor)
2. Correct set name in wikitext
3. JavaScript isn't blocked
4. Page cache is cleared

### I'm getting a "Permission denied" error

Check:
1. You have the `editlayers` permission
2. You're logged in
3. You're not blocked
4. Rate limits aren't exceeded

### The editor is really slow

Try:
1. Reduce number of layers
2. Use a smaller image
3. Close other browser tabs
4. Use a faster device/connection

---

## Future Questions

### Is mobile editing supported?

Not currently. Mobile/touch support is planned for a future release.

### Will there be collaboration features?

Real-time collaboration isn't planned, but named layer sets allow different users to maintain separate annotation sets.

### Can I request a feature?

Yes! Open a feature request on [GitHub Issues](https://github.com/slickdexic/Layers/issues).

---

## See Also

- [[Quick Start Guide]] — Getting started
- [[Troubleshooting]] — Problem solving
- [[Configuration Reference]] — All settings
