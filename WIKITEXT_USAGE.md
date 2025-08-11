# Using Layers in Wiki Articles

## Layer Control in File Syntax

The Layers extension supports controlling which layers are displayed using the `layers=` parameter in standard MediaWiki file syntax:

```text
[[File:ImageTest02.jpg|500px|layers=all|Your caption]]
```

Note: Overlays are opt-in. Layers are rendered only when the `layers` parameter is present and set to a supported value (e.g., `all` or a list of IDs). If `layers` is omitted or set to `none`, only the original image is shown.

## Layer Parameter Options

### Show All Layers

```text
[[File:MyImage.jpg|500px|layers=all|Caption]]
```

### Hide All Layers (Normal Image)

```text
[[File:MyImage.jpg|500px|layers=none|Caption]]
```
or simply omit the layers parameter:

```text
[[File:MyImage.jpg|500px|Caption]]
```

### Show Specific Layers
Use short layer IDs (first 4 characters) separated by commas:

```text
[[File:MyImage.jpg|500px|layers=4bfa,77e5,0cf2|Caption]]
```

## Getting Layer IDs

When editing layers in the MediaWiki editor:

1. Open any file page and click "Edit Layers"
2. In the layer panel on the right, you'll see a "Wikitext Code" section
3. Toggle layer visibility to see different code examples
4. Click "Copy" to copy the layers parameter to your clipboard
5. Use this in your wikitext

## Editor Features for Wikitext

The layer editor automatically shows you the correct wikitext code:

- **All layers visible**: Shows `layers=all`
- **Some layers visible**: Shows `layers=4bfa,77e5,0cf2` (example IDs)
- **No layers visible**: Shows message to enable layers

Click the "Copy" button next to any code sample to copy just the `layers=` parameter.

## Examples

Display a technical diagram with only annotation layers:

```text
[[File:Circuit-Board.jpg|800px|layers=anno,labels|PCB with annotations]]
```

Show all layers of an artwork:

```text
[[File:My-Artwork.png|thumb|layers=all|Complete layered artwork]]
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


## Performance Notes

- Layered thumbnails are cached just like normal thumbnails
- Only images with layer data are processed
- Fallback to normal images if layer rendering fails
- Specific layer selection is more efficient than `layers=all`
