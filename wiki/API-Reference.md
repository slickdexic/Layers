# API Reference

Complete reference for the Layers extension API endpoints.

---

## Overview

Layers provides four API endpoints through MediaWiki's Action API:

| Action | Method | Purpose | Auth Required |
|--------|--------|---------|---------------|
| `layersinfo` | GET | Read layer data | Read access |
| `layerssave` | POST | Save layer data | `editlayers` + CSRF |
| `layersdelete` | POST | Delete layer set | Owner or admin + CSRF |
| `layersrename` | POST | Rename layer set | Owner or admin + CSRF |

---

## layersinfo

Retrieve layer data and revision history for an image.

### Request

```
GET /api.php?action=layersinfo&filename=File:Example.jpg
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | File title (with or without `File:` prefix) |
| `layersetid` | integer | No | Specific revision ID to retrieve |
| `setname` | string | No | Named set to retrieve (default: `default`) |
| `limit` | integer | No | Max revisions to return (default: 50, max: 200) |

### Response

```json
{
    "layersinfo": {
        "layerset": {
            "id": 123,
            "imgName": "Example.jpg",
            "name": "default",
            "userId": 1,
            "timestamp": "20251220120000",
            "revision": 5,
            "data": {
                "revision": 5,
                "schema": 1,
                "created": "2025-12-20T12:00:00Z",
                "layers": [
                    {
                        "id": "layer_1",
                        "type": "rectangle",
                        "x": 100,
                        "y": 100,
                        "width": 200,
                        "height": 150,
                        "stroke": "#ff0000",
                        "strokeWidth": 2,
                        "fill": "#ffff00",
                        "fillOpacity": 0.5
                    }
                ]
            },
            "baseWidth": 1920,
            "baseHeight": 1080
        },
        "all_layersets": [
            {
                "ls_id": 123,
                "ls_revision": 5,
                "ls_name": "default",
                "ls_user_id": 1,
                "ls_user_name": "Admin",
                "ls_timestamp": "20251220120000"
            },
            {
                "ls_id": 122,
                "ls_revision": 4,
                "ls_name": "default",
                "ls_user_id": 1,
                "ls_user_name": "Admin",
                "ls_timestamp": "20251219150000"
            }
        ],
        "named_sets": [
            {
                "name": "default",
                "revision_count": 5,
                "latest_revision": 5,
                "latest_timestamp": "20251220120000",
                "latest_user_id": 1,
                "latest_user_name": "Admin"
            },
            {
                "name": "anatomy",
                "revision_count": 3,
                "latest_revision": 3,
                "latest_timestamp": "20251218100000",
                "latest_user_id": 2,
                "latest_user_name": "Editor"
            }
        ]
    }
}
```

### Response Fields

#### layerset

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Database row ID |
| `imgName` | string | Image filename (without `File:`) |
| `name` | string | Named set name |
| `userId` | integer | User ID who saved this revision |
| `timestamp` | string | MediaWiki timestamp format |
| `revision` | integer | Revision number within this set |
| `data` | object | The layer data structure |
| `baseWidth` | integer | Original image width in pixels |
| `baseHeight` | integer | Original image height in pixels |

#### data.layers[]

Each layer object contains properties based on its type. See [[Layer Data Format]] for complete field reference.

### Errors

| Code | Message | Cause |
|------|---------|-------|
| `layers-file-not-found` | File not found | Invalid filename |
| `layers-layerset-not-found` | Layer set not found | Specified set/revision doesn't exist |

### Examples

**Get default set:**
```
/api.php?action=layersinfo&filename=File:Diagram.png
```

**Get specific named set:**
```
/api.php?action=layersinfo&filename=File:Diagram.png&setname=anatomy
```

**Get specific revision:**
```
/api.php?action=layersinfo&filename=File:Diagram.png&layersetid=42
```

---

## layerssave

Save a layer set revision.

### Request

```
POST /api.php
Content-Type: application/x-www-form-urlencoded

action=layerssave
&filename=File:Example.jpg
&setname=default
&data=[{"id":"layer_1","type":"rectangle",...}]
&token=CSRF_TOKEN
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | File title |
| `data` | string | Yes | JSON array of layer objects |
| `setname` | string | No | Named set (default: `default`) |
| `token` | string | Yes | CSRF token |

### Response

```json
{
    "layerssave": {
        "success": 1,
        "layersetid": 124,
        "result": "Success"
    }
}
```

### Validation

The server validates all incoming data:

1. **Size check** — Total payload ≤ `$wgLayersMaxBytes` (default 2 MB)
2. **JSON parsing** — Must be valid JSON
3. **Layer count** — ≤ `$wgLayersMaxLayerCount` (default 100)
4. **Property whitelist** — Unknown properties are stripped
5. **Type validation** — Each property must match expected type
6. **Range validation** — Numeric values must be within bounds
7. **Color sanitization** — Colors validated/sanitized
8. **Text sanitization** — HTML and dangerous protocols stripped

### Errors

| Code | Message | Cause |
|------|---------|-------|
| `layers-invalid-filename` | Invalid filename | Bad filename format |
| `layers-file-not-found` | File not found | File doesn't exist |
| `layers-data-too-large` | Data too large | Exceeds `$wgLayersMaxBytes` |
| `layers-json-parse-error` | JSON parse error | Invalid JSON |
| `layers-invalid-data` | Invalid data | Validation failed |
| `layers-rate-limited` | Rate limited | Too many saves |
| `layers-max-sets-reached` | Max sets reached | Exceeds `$wgLayersMaxNamedSets` |
| `layers-invalid-setname` | Invalid set name | Bad characters in name |
| `layers-save-failed` | Save failed | Database error |
| `dbschema-missing` | Schema missing | Run maintenance/update.php |

### JavaScript Example

```javascript
const api = new mw.Api();

try {
    const response = await api.postWithToken('csrf', {
        action: 'layerssave',
        filename: 'File:Example.jpg',
        setname: 'default',
        data: JSON.stringify(layers)
    });
    
    if (response.layerssave.success) {
        console.log('Saved revision:', response.layerssave.layersetid);
    }
} catch (error) {
    console.error('Save failed:', error);
}
```

---

## layersdelete

Delete a named layer set and all its revisions.

### Request

```
POST /api.php
Content-Type: application/x-www-form-urlencoded

action=layersdelete
&filename=File:Example.jpg
&setname=anatomy
&token=CSRF_TOKEN
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | File title |
| `setname` | string | Yes | Named set to delete |
| `token` | string | Yes | CSRF token |

### Response

```json
{
    "layersdelete": {
        "success": 1,
        "revisionsDeleted": 5
    }
}
```

### Permissions

User must be:
- **Owner** — Created the first revision of the set, OR
- **Admin** — Has the `delete` right

### Errors

| Code | Message | Cause |
|------|---------|-------|
| `layers-file-not-found` | File not found | Invalid filename |
| `layers-layerset-not-found` | Layer set not found | Set doesn't exist |
| `permissiondenied` | Permission denied | Not owner or admin |
| `layers-delete-failed` | Delete failed | Database error |

### Warning

⚠️ **This action is permanent.** All revisions of the named set are deleted and cannot be recovered.

---

## layersrename

Rename a named layer set.

### Request

```
POST /api.php
Content-Type: application/x-www-form-urlencoded

action=layersrename
&filename=File:Example.jpg
&oldname=anatomy
&newname=anatomical-labels
&token=CSRF_TOKEN
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | File title |
| `oldname` | string | Yes | Current set name |
| `newname` | string | Yes | New set name |
| `token` | string | Yes | CSRF token |

### Response

```json
{
    "layersrename": {
        "success": 1,
        "oldname": "anatomy",
        "newname": "anatomical-labels"
    }
}
```

### Name Validation

New name must:
- Be 1-50 characters
- Contain only `a-z`, `A-Z`, `0-9`, `-`, `_`
- Not be `default` (reserved)
- Not already exist for this image

### Permissions

User must be:
- **Owner** — Created the first revision of the set, OR
- **Admin** — Has the `delete` right

### Errors

| Code | Message | Cause |
|------|---------|-------|
| `layers-file-not-found` | File not found | Invalid filename |
| `layers-layerset-not-found` | Layer set not found | Old name doesn't exist |
| `layers-invalid-setname` | Invalid set name | Bad characters or reserved name |
| `layers-setname-exists` | Name already exists | Conflict with existing set |
| `permissiondenied` | Permission denied | Not owner or admin |

---

## Layer Data Format

### Common Properties

All layer types share these properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique layer identifier |
| `type` | string | Layer type (see below) |
| `visible` | boolean | Layer visibility |
| `locked` | boolean | Layer locked state |
| `name` | string | Optional layer name |
| `opacity` | number | Overall opacity (0-1) |
| `rotation` | number | Rotation in degrees |
| `blendMode` | string | Blend mode |

### Layer Types

| Type | Properties |
|------|------------|
| `rectangle` | x, y, width, height, stroke, fill, strokeWidth, cornerRadius |
| `circle` | x, y, radius, stroke, fill, strokeWidth |
| `ellipse` | x, y, radiusX, radiusY, stroke, fill, strokeWidth |
| `polygon` | x, y, radius, sides, stroke, fill, cornerRadius |
| `star` | x, y, radius, innerRadius, points, pointRadius, valleyRadius |
| `line` | x1, y1, x2, y2, stroke, strokeWidth |
| `arrow` | x1, y1, x2, y2, stroke, strokeWidth, arrowhead, arrowSize, arrowStyle |
| `path` | points[], stroke, strokeWidth |
| `text` | x, y, text, fontFamily, fontSize, fontWeight, fontStyle, fill |
| `textbox` | x, y, width, height, text, textAlign, verticalAlign, padding |
| `blur` | x, y, width, height, blurRadius |
| `image` | x, y, width, height, src (base64), originalWidth, originalHeight |

### Style Properties

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `stroke` | string | — | Stroke color (hex, rgba) |
| `strokeWidth` | number | 0-50 | Stroke width in pixels |
| `strokeOpacity` | number | 0-1 | Stroke opacity |
| `fill` | string | — | Fill color |
| `fillOpacity` | number | 0-1 | Fill opacity |

### Shadow Properties

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `shadow` | boolean | — | Enable shadow |
| `shadowColor` | string | — | Shadow color |
| `shadowBlur` | number | 0-50 | Blur radius |
| `shadowOffsetX` | number | -50 to 50 | X offset |
| `shadowOffsetY` | number | -50 to 50 | Y offset |
| `shadowSpread` | number | 0-20 | Spread distance |

### Text Properties

| Property | Type | Options | Description |
|----------|------|---------|-------------|
| `fontFamily` | string | Arial, Roboto, etc. | Font name |
| `fontSize` | number | 8-144 | Font size in pixels |
| `fontWeight` | string | normal, bold | Font weight |
| `fontStyle` | string | normal, italic | Font style |
| `textAlign` | string | left, center, right | Horizontal alignment |
| `verticalAlign` | string | top, middle, bottom | Vertical alignment |
| `textStrokeColor` | string | — | Text outline color |
| `textStrokeWidth` | number | 0-10 | Text outline width |
| `textShadow` | boolean | — | Enable text shadow |

---

## Rate Limiting

API endpoints respect MediaWiki's rate limiting:

| Action | Default Limit |
|--------|---------------|
| `editlayers-save` | 30/hour (users), 5/hour (newbies) |
| `editlayers-create` | 10/hour |

Configure in `LocalSettings.php`:
```php
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];
```

---

## CSRF Protection

All POST endpoints require a valid CSRF token. Obtain via:

```javascript
const api = new mw.Api();
const token = await api.getToken('csrf');
```

Or use `postWithToken` which handles this automatically:

```javascript
await api.postWithToken('csrf', { action: 'layerssave', ... });
```

---

## See Also

- [[Architecture Overview]] — System design
- [[Named Layer Sets]] — Working with named sets
- [[Configuration Reference]] — Server configuration
