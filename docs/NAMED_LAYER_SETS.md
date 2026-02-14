# Named Layer Sets Architecture

**Created:** January 2025  
**Status:** ✅ Implemented (v1.5.0+)  
**Version:** 1.2 (updated to reflect actual implementation)

---

## Overview

This document describes the Named Layer Sets feature, which restructures the layer save system from anonymous revisions to named layer sets with version history.

### Key Concepts

- **Named Layer Set**: A logical grouping of layer annotations identified by a human-readable name (e.g., "default", "anatomy-labels", "tourist-highlights")
- **Revision**: A specific saved state of a named layer set, identified by timestamp
- **Version History**: Up to 50 most recent revisions stored per named set
- **Layer Set Slot**: Each image can have up to 15 named layer sets (configurable via `$wgLayersMaxNamedSets`)

### User Value

1. **Organized Annotations**: Multiple named annotation sets per image (e.g., "english-labels", "french-labels")
2. **Version History**: Undo to previous saves, compare revisions
3. **Direct Linking**: Use `[[File:Example.jpg|layerset=anatomy-labels]]` to embed specific annotation sets
4. **Collaboration**: Different users can work on different named sets
5. **Migration Path**: Existing anonymous revisions become "default" set

---

## System Details

### Database Schema

```sql
CREATE TABLE /*_*/layer_sets (
    ls_id int unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ls_img_name varchar(255) NOT NULL,
    ls_img_sha1 varchar(40) NOT NULL DEFAULT '',
    ls_img_major_mime varchar(20) DEFAULT NULL,
    ls_img_minor_mime varchar(100) DEFAULT NULL,
    ls_json_blob mediumblob NOT NULL,
    ls_user_id int unsigned DEFAULT NULL,
    ls_timestamp binary(14) NOT NULL,
    ls_revision int unsigned NOT NULL DEFAULT 1,
    ls_name varchar(255) NOT NULL DEFAULT 'default',
    ls_size int unsigned NOT NULL DEFAULT 0,
    ls_layer_count smallint unsigned NOT NULL DEFAULT 0,
    UNIQUE KEY ls_img_name_set_revision
        (ls_img_name, ls_img_sha1, ls_name, ls_revision)
) ENGINE=InnoDB DEFAULT CHARSET=binary;
```

Additional indexes:
- `idx_layer_sets_named (ls_img_name, ls_img_sha1, ls_name, ls_timestamp DESC)`
- `idx_layer_sets_setname_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision DESC)`
- `ls_img_lookup (ls_img_name, ls_img_sha1)`
- `ls_user_timestamp (ls_user_id, ls_timestamp)`
- `ls_size_performance (ls_img_name, ls_size)`

### Pre-Implementation History

Before v1.5.0, the system stored anonymous revisions per image:
- `ls_name` was nullable and unused
- All revisions were shown in a flat `all_layersets` list
- No revision limits — unbounded growth
- No `layerset=` wikitext parameter

These limitations motivated the named sets feature.

---

## Architecture

### Data Model

```
Image (File:Example.jpg)
├── Named Set: "default" (auto-created for existing/new users)
│   ├── Revision 25 (latest) ← loaded by default
│   ├── Revision 24
│   ├── ... (up to 50 revisions kept)
│   └── Revision 1 (oldest kept)
├── Named Set: "anatomy-labels"
│   ├── Revision 3 (latest)
│   ├── Revision 2
│   └── Revision 1
└── Named Set: "tourist-poi" (up to 15 named sets per image)
    └── Revision 1
```

### Configuration Constants

| Setting | Value | Description |
|---------|-------|-------------|
| `$wgLayersMaxNamedSets` | 15 | Maximum named sets per image |
| `$wgLayersMaxRevisionsPerSet` | 50 | Maximum revisions kept per named set |
| `$wgLayersDefaultSetName` | "default" | Name for auto-created sets |

**Set Name Validation** (hardcoded in `SetNameSanitizer`):
- Max length: 255 characters (matches DB column)
- Allowed characters: Unicode letters, numbers, underscores, dashes, spaces
- Regex: `/^[\p{L}\p{N}_\-\s]+$/u`
- Empty names default to "default"
- Consecutive whitespace collapsed to single space

### Database Implementation

The `ls_name` column directly on `layer_sets` provides named set
support with a compound unique index ensuring no duplicate revisions.
Revision pruning and named set counting are handled in application
logic (`LayersDatabase.php`).

Key methods:
- `getNamedSetsForImage()` — lists all named sets with metadata
- `getSetRevisions()` — revision history for a specific set
- `pruneOldRevisions()` — removes oldest revisions beyond limit
- `countNamedSetsForImage()` — enforces per-image set limit
- `namedSetExists()` — checks for name conflicts before rename

---

## API Contract Changes

### layersinfo API

**New Parameters:**
- `setname` (string, optional): Return specific named set and its revisions

**Changed Response Structure:**

```json
{
  "layersinfo": {
    "layerset": {
      "id": 456,
      "imgName": "Example.jpg",
      "userId": 123,
      "timestamp": "20250108123456",
      "revision": 3,
      "name": "default",
      "data": { "revision": 3, "schema": 1, "created": "...", "layers": [...] },
      "baseWidth": 1920,
      "baseHeight": 1080
    },
    "named_sets": [
      {
        "name": "default",
        "revision_count": 25,
        "latest_revision": 25,
        "latest_timestamp": "20250108123456",
        "latest_user_id": 123,
        "latest_user_name": "Alice"
      },
      {
        "name": "anatomy-labels",
        "revision_count": 3,
        "latest_revision": 3,
        "latest_timestamp": "20250107100000",
        "latest_user_id": 456,
        "latest_user_name": "Bob"
      }
    ],
    "set_revisions": [
      {
        "ls_id": 456,
        "ls_revision": 3,
        "ls_timestamp": "20250108123456",
        "ls_user_id": 123,
        "ls_user_name": "Alice"
      },
      {
        "ls_id": 455,
        "ls_revision": 2,
        "ls_timestamp": "20250107120000",
        "ls_user_id": 123,
        "ls_user_name": "Alice"
      }
    ]
  }
}
```

### layerssave API

**Changed Behavior:**
1. `setname` becomes meaningful (default: "default")
2. Check if named set exists and count revisions
3. If revisions exceed limit, prune oldest after successful save
4. Check named set count per image, reject if limit exceeded

**New Error Codes:**
- `layers-max-sets-reached`: Too many named sets for this image
- `layers-invalid-setname`: Set name contains invalid characters

---

## Wikitext Integration

### Standard File Syntax

Named layer sets use the standard MediaWiki file syntax with the `layerset=` parameter:

```wikitext
[[File:Example.jpg|layerset=on]]              <!-- Show default layer set -->
[[File:Example.jpg|layerset=anatomy-labels]]  <!-- Show specific named set -->
[[File:Example.jpg|layerset=none]]            <!-- Explicitly disable layers -->
```

**Parameters:**
- `layerset=on`: Load the default layer set
- `layerset=<setname>`: Load a specific named set (e.g., `anatomy-labels`, `french-labels`)
- `layerset=none` or `layerset=off`: Explicitly hide layers
- Omitting `layerset=` means no layers are displayed (opt-in model)

**Note:** The `layerset=all` syntax is deprecated. Use `layerset=on` or a specific set name instead. If a set named "all" exists, `layerset=all` will load that set.

### File: Page Behavior

Layers are NOT automatically displayed on File: pages. Users must explicitly add `layerset=on` or `layerset=setname` in the wikitext to display layers.

---

## UI Changes

### Editor Interface

1. **Set Selector Dropdown** (top of editor, near filename)
   - Shows all named sets for current image
   - "New Set..." option to create
   - Current set highlighted

2. **Version History Panel** (in layer panel sidebar)
   - Shows revisions for current named set
   - Click to load/preview revision
   - "Restore" button to make revision current

3. **Save Dialog Enhancement**
   - Default: save to current set
   - Option to "Save as new set" with name input
   - Validation: unique name, allowed characters

### Mockup

```
┌─────────────────────────────────────────────────┐
│ Layers Editor - Example.jpg                      │
├─────────────────────────────────────────────────┤
│ Set: [default ▼] [+ New Set]  📂 History (25)   │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Canvas Area]                                   │
│                                                  │
├─────────────────────────────────────────────────┤
│ Layers          │ Properties     │ History      │
│ ───────────────│────────────────│──────────────│
│ □ Text: Label  │ Font: Arial    │ v25 Jan 8    │
│ □ Arrow: ptr   │ Size: 14px     │ v24 Jan 7    │
│ □ Circle: c1   │ Color: #ff0000 │ v23 Jan 6    │
│                │                │ v22 Jan 5    │
│                │                │ [Restore]    │
└─────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Database Migration

1. Add index for efficient queries (non-breaking)
2. Update existing rows: set `ls_name = 'default'` where NULL
3. No schema-breaking changes

```sql
-- Migration script: patch-named-sets-migration.sql
UPDATE layer_sets SET ls_name = 'default' WHERE ls_name IS NULL OR ls_name = '';

CREATE INDEX IF NOT EXISTS idx_layer_sets_named 
ON layer_sets (ls_img_name, ls_img_sha1, ls_name, ls_timestamp DESC);
```

### Phase 2: API Updates

1. Update `LayersDatabase.php` with new methods
2. Update `ApiLayersInfo.php` with named set grouping
3. Update `ApiLayersSave.php` with revision pruning
4. Maintain backward compatibility for existing clients

### Phase 3: UI Updates

1. Add set selector to editor
2. Add version history panel
3. Update save flow

### Phase 4: Parser Integration

1. Add `layerset=` parameter to file syntax handler
2. Update wikitext examples in documentation

---

## Implementation Checklist

### Database Layer
- [x] Add migration script for default name assignment
- [x] Add new index for named set queries
- [x] Add `getNamedSetsForImage()` method
- [x] Add `getSetRevisions()` method
- [x] Add `pruneOldRevisions()` method
- [x] Add `countNamedSetsForImage()` method
- [x] Update `saveLayerSet()` to handle revision pruning

### API Layer
- [x] Update `ApiLayersInfo` to return named_sets structure
- [x] Update `ApiLayersInfo` to support setname parameter
- [x] Update `ApiLayersSave` to enforce named set limits
- [x] Update `ApiLayersSave` to trigger revision pruning
- [x] Add new error messages to i18n

### Frontend
- [x] Add set selector dropdown component
- [x] Add version history panel
- [x] Update save dialog with set name option
- [x] Update `APIManager.js` to handle new response format
- [x] Add set switching logic to editor

### Parser/Hooks
- [x] Update file syntax handler to support `layerset=` parameter
- [x] Update hook to pass set name to renderer

### Testing
- [x] Add unit tests for new database methods
- [x] Add API tests for named set operations
- [x] Add Jest tests for UI components
- [x] Add integration test for full workflow

### Documentation
- [x] Update `copilot-instructions.md` with new API contracts
- [x] Update `README.md` with named sets feature
- [x] Update `WIKITEXT_USAGE.md` with `layerset=` parameter
- [x] Add user guide for named sets

---

## Security Considerations

1. **Set Name Validation**: Strict character whitelist prevents XSS/injection
2. **Per-Image Limits**: Prevent storage abuse via named set limits
3. **Revision Pruning**: Automatic cleanup prevents unbounded growth
4. **Permission Checks**: Creating and editing layer sets requires `editlayers` right
5. **Rate Limiting**: Apply existing rate limits to set creation

---

## Performance Considerations

1. **Index Usage**: New index ensures efficient named set queries
2. **Lazy Loading**: Don't load all revisions upfront, paginate
3. **Caching**: Cache named set metadata (not full JSON blobs)
4. **Pruning Strategy**: Prune asynchronously or on write, not on read

---

## Open Questions

1. ~~**Set Deletion**: Should users be able to delete entire named sets?~~ **Implemented** via `ApiLayersDelete` — set owner or admin can delete.
2. ~~**Set Renaming**: Allow renaming named sets?~~ **Implemented** via `ApiLayersRename` — set owner or admin can rename (cannot rename to "default").
3. **Cross-Image Sets**: Should a named set be able to apply to multiple related images? (Future consideration)
4. **Revision Comparison**: Visual diff between revisions? (Future enhancement)

---

## Appendix: Configuration Examples

### LocalSettings.php

```php
// Named Layer Sets Configuration
$wgLayersMaxNamedSets = 15;           // Max named sets per image
$wgLayersMaxRevisionsPerSet = 50;     // Max revisions kept per set
$wgLayersDefaultSetName = 'default';  // Auto-created set name

// Existing settings remain unchanged
$wgLayersMaxBytes = 2 * 1024 * 1024;
$wgLayersMaxLayerCount = 100;
```

### Example API Calls

```javascript
// Load default set
mw.Api().get({
    action: 'layersinfo',
    filename: 'Example.jpg'
});

// Load specific named set
mw.Api().get({
    action: 'layersinfo',
    filename: 'Example.jpg',
    setname: 'anatomy-labels'
});

// Save to existing named set
mw.Api().postWithToken('csrf', {
    action: 'layerssave',
    filename: 'Example.jpg',
    setname: 'anatomy-labels',
    data: JSON.stringify(layers)
});

// Create new named set
mw.Api().postWithToken('csrf', {
    action: 'layerssave',
    filename: 'Example.jpg',
    setname: 'french-labels',  // Will be created if doesn't exist
    data: JSON.stringify(layers)
});
```
