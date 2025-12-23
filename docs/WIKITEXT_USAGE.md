# Using Layers in Wiki Articles

## Layer Control in File Syntax

The Layers extension supports controlling which layers are displayed using the `layers=` parameter in standard MediaWiki file syntax:

```text
[[File:ImageTest02.jpg|500px|layers=on|Your caption]]
```

Note: Overlays are opt-in. Layers are rendered only when the `layers` parameter is present and set to a supported value (e.g., `on`, a named set, or a list of layer IDs). If `layers` is omitted or set to `none`/`off`, only the original image is shown.

## Layer Parameter Options

### Show Default Layer Set

```text
[[File:MyImage.jpg|500px|layers=on|Caption]]
```

### Show a Named Layer Set

If you have multiple named layer sets for an image (e.g., "anatomy", "labels"), specify the set name:

```text
[[File:MyImage.jpg|500px|layers=anatomy|Caption]]
[[File:MyImage.jpg|500px|layers=labels|Caption]]
```

If the named set doesn't exist, no layers are displayed (the image shows without any overlays).

### Hide All Layers (Normal Image)

```text
[[File:MyImage.jpg|500px|layers=none|Caption]]
```
or:
```text
[[File:MyImage.jpg|500px|layers=off|Caption]]
```
or simply omit the layers parameter:

```text
[[File:MyImage.jpg|500px|Caption]]
```

### Show Specific Layers by ID
Use short layer IDs (first 4 characters) separated by commas:

```text
[[File:MyImage.jpg|500px|layers=4bfa,77e5,0cf2|Caption]]
```

## File: Pages

Layers are **not** automatically displayed on File: pages. To show layers on a file page, you must explicitly add the `layers=on` or `layers=setname` parameter in the wikitext.

## Getting Layer IDs

When editing layers in the MediaWiki editor:

1. Open any file page and click "Edit Layers"
2. In the layer panel on the right, you'll see a "Wikitext Code" section
3. Toggle layer visibility to see different code examples
4. Click "Copy" to copy the layers parameter to your clipboard
5. Use this in your wikitext

## Editor Features for Wikitext

The layer editor automatically shows you the correct wikitext code:

- **All layers visible**: Shows `layers=on`
- **Some layers visible**: Shows `layers=4bfa,77e5,0cf2` (example IDs)
- **No layers visible**: Shows message to enable layers

Click the "Copy" button next to any code sample to copy just the `layers=` parameter.

## Examples

Display a technical diagram with only annotation layers:

```text
[[File:Circuit-Board.jpg|800px|layers=anno,labels|PCB with annotations]]
```

Show layers from the default set:

```text
[[File:My-Artwork.png|thumb|layers=on|Complete layered artwork]]
```

Show layers from a specific named set:

```text
[[File:Anatomy-Diagram.jpg|600px|layers=organs|Organ overlay]]
[[File:Anatomy-Diagram.jpg|600px|layers=skeleton|Skeletal overlay]]
```

Display base image without any layers:

```text
[[File:Photo.jpg|600px|layers=none|Original photo without annotations]]
```

## How It Works

The extension automatically:

1. Detects the `layers=` parameter in your wikitext
2. Looks up layer data for the specified image
3. Renders only the requested layers
4. Generates a composite thumbnail on the server (cached like normal thumbs)
5. Caches the result for performance


## Deep Linking with layerslink

*New in v1.2.2*

Control what happens when users click on layered images:

```text
<!-- Click opens the layer editor with the specified set -->
[[File:Diagram.png|layers=anatomy|layerslink=editor]]

<!-- Click opens fullscreen lightbox viewer -->
[[File:Diagram.png|layers=anatomy|layerslink=viewer]]
```

| Value | Effect |
|-------|--------|
| (none) | Standard link to File: page |
| `editor` | Opens layer editor for this image/set |
| `viewer` | Opens fullscreen lightbox viewer |
| `lightbox` | Alias for `viewer` |

> **Note:** `layerslink` requires `layers=on` or `layers=<setname>` to be present.

You can also link directly to the editor via URL:
```
/wiki/File:Example.jpg?action=editlayers&setname=anatomy
```

## Performance Notes

- Layered thumbnails are cached just like normal thumbnails
- Only images with layer data are processed
- Fallback to normal images if layer rendering fails
- Specific layer selection is more efficient than `layers=all`
