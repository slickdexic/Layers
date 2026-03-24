# Revision Compliance Architecture

## Status: Tier 1 — Complete

This document describes the architecture for making Layers extension changes visible
in MediaWiki's revision tracking infrastructure (Recent Changes, page history, watchlists).

## Problem

Layer save/delete/rename operations are stored in a custom `layer_sets` table but do not
create entries in MediaWiki's standard revision/change tracking. This means:
- Changes are invisible in Recent Changes and Watchlists
- File page history does not reflect layer modifications
- Administrators cannot audit layer changes through standard tools

## Three-Tier Architecture

### Tier 1: Audit Trail (Current Implementation)

**Approach:** Null edits on File: pages with descriptive edit summaries and a change tag.

When `$wgLayersTrackChangesInRecentChanges` is enabled (default: `false`), each layer
save/delete/rename creates a null edit on the associated File: page. This makes the
change visible in:
- Recent Changes (`Special:RecentChanges`)
- Page history (`action=history`)
- Watchlists (`Special:Watchlist`)

**Change Tag:** `layers-data-change` — registered via `ChangeTagsAllowedAdd` hook,
allows filtering in Recent Changes.

**Configuration:**
```php
// Enable audit trail (default: false)
$wgLayersTrackChangesInRecentChanges = true;
```

**Files Modified:**
- `extension.json` — Config definition + hook registration
- `src/Hooks.php` — `onChangeTagsAllowedAdd()` handler
- `src/Api/Traits/AuditTrailTrait.php` — New trait implementing null edit logic
- `src/Api/ApiLayersSave.php` — Calls `createAuditTrailEntry()` after save
- `src/Api/ApiLayersDelete.php` — Calls `createAuditTrailEntry()` after delete
- `src/Api/ApiLayersRename.php` — Calls `createAuditTrailEntry()` after rename
- `i18n/en.json` + `i18n/qqq.json` — Edit summary and tag messages

**Edit Summary Messages:**
- Save: `Layers: Updated layer set "setname"`
- Delete: `Layers: Deleted layer set "setname"`
- Rename: `Layers: Renamed layer set "old" to "new"`

### Tier 2: Page Notification (Future)

Push layer changes to RecentChanges via `ManualLogEntry` log entries instead of null edits.

### Tier 3: Approval Gate (Future)

Content moderation workflow for layer changes (review/approve before public).

## Progress

| Item | Status |
|------|--------|
| Config toggle | Done |
| Change tag registration | Done |
| AuditTrailTrait | Done |
| ApiLayersSave integration | Done |
| ApiLayersDelete integration | Done |
| ApiLayersRename integration | Done |
| i18n messages | Done |
| PHP tests | Done |
| Lint/test pass | Done |
