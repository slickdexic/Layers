# Configuration Reference

Complete reference for all Layers extension configuration parameters.

---

## Core Settings

### $wgLayersEnable

Master switch to enable or disable the extension.

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

```php
// Disable Layers extension entirely
$wgLayersEnable = false;
```

### $wgLayersDebug

Enable debug logging to the 'Layers' log channel.

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

```php
// Disable debug logging in production
$wgLayersDebug = false;
```

Logs are written to MediaWiki's logging system. View with:
```bash
tail -f /var/log/mediawiki/debug.log | grep Layers
```

---

## Size Limits

### $wgLayersMaxBytes

Maximum size of the JSON payload for a single layer set.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `2097152` (2 MB) |

```php
// Increase to 4 MB for complex annotations
$wgLayersMaxBytes = 4194304;
```

### $wgLayersMaxLayerCount

Maximum number of layers allowed in a single layer set.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `100` |

```php
// Allow up to 200 layers per set
$wgLayersMaxLayerCount = 200;
```

### $wgLayersMaxNamedSets

Maximum number of named layer sets per image.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `15` |

```php
// Allow up to 25 named sets per image
$wgLayersMaxNamedSets = 25;
```

### $wgLayersMaxRevisionsPerSet

Maximum number of revisions to keep per named layer set. Older revisions are automatically pruned.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `50` |

```php
// Keep up to 100 revisions per set
$wgLayersMaxRevisionsPerSet = 100;
```

### $wgLayersMaxImageBytes

Maximum size for imported image layers (stored as base64 data URLs).

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `1048576` (1 MB) |

```php
// Allow larger imported images (2 MB)
$wgLayersMaxImageBytes = 2097152;
```

**Storage Impact:**

| Setting | Actual Image Size | Use Case |
|---------|-------------------|----------|
| 512 KB | ~380 KB | Small icons, low bandwidth |
| 1 MB (default) | ~750 KB | Balanced for most cases |
| 2 MB | ~1.5 MB | High-quality images |
| 4 MB | ~3 MB | Maximum recommended |

> **Note:** Base64 encoding adds ~33% overhead.

---

## User Interface

### $wgLayersContextAwareToolbar

Enable context-aware toolbar that shows only relevant controls for the active tool.

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

```php
// Disable context-aware toolbar (show all controls always)
$wgLayersContextAwareToolbar = false;
```

When enabled (default):
- **Pointer tool**: Only tool buttons visible
- **Shape tools** (rectangle, circle, etc.): Stroke/fill colors, stroke width
- **Text tool**: Font size, text stroke, text shadow controls
- **Arrow tool**: Stroke color, stroke width, arrow style
- **Layer selection**: Controls adapt to selected layer types

When disabled: All style controls are always visible (classic mode).

---

## Image Processing

### $wgLayersMaxImageSize

Maximum image dimension (width or height) for editing.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `4096` |

```php
// Allow larger images (8K)
$wgLayersMaxImageSize = 8192;
```

### $wgLayersMaxImageDimensions

Maximum dimensions for image processing operations.

| Property | Value |
|----------|-------|
| Type | `array` |
| Default | `[ 'width' => 4096, 'height' => 4096 ]` |

```php
$wgLayersMaxImageDimensions = [
    'width' => 8192,
    'height' => 8192
];
```

### $wgLayersImageMagickTimeout

Timeout in seconds for ImageMagick operations.

| Property | Value |
|----------|-------|
| Type | `integer` |
| Default | `30` |

```php
// Increase timeout for very large images
$wgLayersImageMagickTimeout = 60;
```

---

## Naming

### $wgLayersDefaultSetName

Default name for layer sets when none is specified.

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `'default'` |

```php
// Change default set name
$wgLayersDefaultSetName = 'main';
```

### $wgLayersDefaultFonts

List of fonts available in the editor.

| Property | Value |
|----------|-------|
| Type | `array` |
| Default | `['Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Courier New']` |

```php
// Customize available fonts
$wgLayersDefaultFonts = [
    'Arial',
    'Helvetica',
    'Georgia',
    'Verdana',
    'Comic Sans MS'
];
```

---

## Caching

### $wgLayersThumbnailCache

Enable caching of composite thumbnails.

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

```php
// Disable thumbnail caching
$wgLayersThumbnailCache = false;
```

---

## Rate Limiting

Configure rate limits using MediaWiki's built-in rate limiter.

### Available Limit Keys

| Key | Action |
|-----|--------|
| `editlayers-save` | Saving layer sets |
| `editlayers-create` | Creating new layer sets |
| `editlayers-render` | Rendering operations |

### Configuration

```php
// Limit saves to 30 per hour for regular users
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];

// Limit saves to 5 per hour for new users
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];

// Limit to 10 per hour for anonymous users (if allowed)
$wgRateLimits['editlayers-save']['anon'] = [ 10, 3600 ];

// No limit for bots
$wgRateLimits['editlayers-save']['bot'] = [ 0, 0 ];
```

### Format

```php
$wgRateLimits['key']['group'] = [ $count, $seconds ];
```

- `$count` — Maximum number of actions
- `$seconds` — Time period in seconds

---

## Permissions

### Available Rights

| Right | Description |
|-------|-------------|
| `editlayers` | Edit existing layer sets |
| `createlayers` | Create new layer sets |
| `managelayerlibrary` | Manage the layer library |

### Default Configuration

```php
// From extension.json defaults
$wgGroupPermissions['*']['editlayers'] = false;        // Anonymous: no
$wgGroupPermissions['user']['editlayers'] = true;      // Logged in: yes
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
```

### Custom Configuration Examples

**Restrictive (only autoconfirmed can edit):**
```php
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['autoconfirmed']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
```

**Open (anyone can view, registered can edit):**
```php
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['user']['createlayers'] = true;
```

**Very restrictive (only specific group):**
```php
$wgGroupPermissions['*']['editlayers'] = false;
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['layer-editors']['editlayers'] = true;
$wgGroupPermissions['layer-editors']['createlayers'] = true;
```

---

## Complete Example Configuration

```php
// Load extension
wfLoadExtension( 'Layers' );

// Basic settings
$wgLayersEnable = true;
$wgLayersDebug = false; // Disable in production

// Size limits
$wgLayersMaxBytes = 4194304;        // 4 MB
$wgLayersMaxLayerCount = 150;
$wgLayersMaxNamedSets = 20;
$wgLayersMaxRevisionsPerSet = 75;
$wgLayersMaxImageBytes = 2097152;   // 2 MB

// Image processing
$wgLayersMaxImageSize = 8192;
$wgLayersImageMagickTimeout = 45;

// Fonts
$wgLayersDefaultFonts = [
    'Arial', 'Helvetica', 'Roboto', 'Open Sans',
    'Times New Roman', 'Georgia',
    'Courier New', 'Monaco'
];

// Permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

// Rate limiting
$wgRateLimits['editlayers-save']['user'] = [ 60, 3600 ];
$wgRateLimits['editlayers-save']['newbie'] = [ 10, 3600 ];
```

---

## See Also

- [[Installation]] — Setup guide
- [[Permissions]] — Detailed permissions configuration
- [[Troubleshooting]] — Common issues
