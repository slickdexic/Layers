# Yaron's Feedback on Layers Extension

This document captures feedback from Yaron (MediaWiki community member) during the 1.5.0-beta.3 review period. Items implemented immediately are noted; others are documented here for future consideration.

## Implemented in This Release

### ✅ "Edit Layers" → "Edit layers"
Changed to sentence case per MediaWiki conventions.
- Updated: `i18n/en.json`, fallback strings in `LayersEditorModal.js`, `UIHooks.php`, `EditLayersAction.php`

### ✅ New layer set starts blank
When creating a new named layer set, the canvas now starts empty instead of copying the previous set's layers.
- Updated: `SetSelectorController.js`

### ✅ Cancel button removed
Removed the Cancel button from the toolbar since the X close button already provides this functionality.
- Updated: `Toolbar.js`, `editor-fixed.css`, `fixtures.js`

---

## Documented for Future Work

### 🔮 MCR (Multi-Content Revisions) / Slots Storage
**Suggestion:** Store layer data in wiki slots using Multi-Content Revisions instead of a custom database table.

**Decision:** Keep current implementation for v1.x. Consider for v2.0 if/when the extension becomes part of MediaWiki core or when significant refactoring is needed.

**Rationale:**
- Current approach works well and is proven
- MCR migration would be significant effort
- Slots approach would provide better integration with MediaWiki's revision system
- Worth exploring if Layers becomes widely adopted

**Related:** [MediaWiki MCR documentation](https://www.mediawiki.org/wiki/Multi-Content_Revisions)

---

### 📋 Layer Set List on File Pages ✅ IMPLEMENTED
**Suggestion:** Show a list of available layer sets directly on the File: page, not just in the editor.

**Decision:** Implemented in v1.5.0-beta.5.

**Implementation:**
- Added `ImagePageAfterImageLinks` hook to show layer sets on File: pages
- Collapsible section appears below file info when layer sets exist
- Shows: set name, author, revision count, last modified date
- "Edit" link opens the editor for each set with `?action=editlayers&setname=...`
- Includes usage hint showing wikitext syntax: `[[File:Example.jpg|layerset=setname]]`
- Full dark mode support for Vector 2022

**Files Modified:**
- `extension.json` - registered `ImagePageAfterImageLinks` hook
- `src/Hooks/UIHooks.php` - added `onImagePageAfterImageLinks()`, `enrichNamedSetsWithUserNames()`, `buildLayerSetsSection()`
- `i18n/en.json` - added 8 new message keys (`layers-filepage-*`)
- `i18n/qqq.json` - added translator documentation
- `resources/ext.layers/viewer/LayersLightbox.css` - added File page section styles

**Priority:** Completed - improves discoverability of layer sets

---

### 🔐 Permissions Review ✅ SIMPLIFIED
**Suggestion:** Consider consolidating to fewer permission rights (previously had `editlayers`, `createlayers`, `managelayerlibrary`).

**Decision:** Consolidated `createlayers` into `editlayers`.

**Changes Made:**
- Removed `createlayers` right entirely
- `editlayers` now covers all layer operations (view, create, edit, save)
- `managelayerlibrary` kept for future asset library feature
- Simplified permission model: users with `editlayers` can do everything layer-related

**Files Modified:**
- `extension.json` - removed createlayers from AvailableRights and GroupPermissions
- `src/Action/EditLayersAction.php` - simplified auto-create permission check
- `i18n/en.json` and `i18n/qqq.json` - removed createlayers messages
- `wiki/Permissions.md` - updated documentation
- `.github/copilot-instructions.md` - updated permissions section

**New Default Permissions:**
- Anonymous: `editlayers=false`
- Logged-in users: `editlayers=true`
- Sysop: `editlayers=true`, `managelayerlibrary=true`

---

### 🔒 Lock Layer Feature ✅ FIXED
**Observation:** Lock layer feature was not working - locked layers could still be moved, resized, rotated, and deleted.

**Root Cause:** Transform operations (`startDrag`, `startResize`, `startRotation`) and delete operations were not checking `layer.locked` status.

**Solution Implemented:**
- Added `isLayerEffectivelyLocked()` helper to TransformController, FolderOperationsController, and LayersEditor
- Lock checks added to: `startDrag`, `startResize`, `startRotation`, `handleDrag`, `deleteLayer`, `deleteSelected`
- Folder lock inheritance: When a folder is locked, all children are effectively locked
- Added 15 new tests for lock protection behavior

**Files Modified:**
- `resources/ext.layers.editor/canvas/TransformController.js`
- `resources/ext.layers.editor/ui/FolderOperationsController.js`
- `resources/ext.layers.editor/LayersEditor.js`
- `i18n/en.json` (added `layers-layer-locked-warning` message)
- `tests/jest/TransformController.test.js` (15 new tests)

**Priority:** Completed - critical fix for core feature.

---

### 🌐 Global Variables
**Observation:** Uses global `window.Layers` namespace.

**Decision:** Keep for now; follows MediaWiki patterns.

**Rationale:**
- MediaWiki extensions commonly use namespaced globals
- `mw.*` pattern is similar
- Module system through ResourceLoader handles dependency management
- Refactoring to ES modules would require significant changes

**Future:** When MediaWiki standardizes ES modules, consider migration.

---

### 📖 `layerslink` Parameter Documentation
**Observation:** The `layerslink=modal` wikitext parameter could use better documentation.

**Decision:** Already documented but should be more prominent.

**Action:**
- Update `wiki/Wikitext-Syntax.md` with clearer examples
- Add to Quick Start Guide
- Include in generated API documentation

---

## Discussion Notes

These points represent valuable community feedback. The implemented items ("Edit layers", blank new sets, remove Cancel) were quick wins that improve UX without significant refactoring.

The larger items (MCR storage, File page layer list) would require architectural changes and should be considered for future major releases.

---

*Feedback received: January 2026*
*Document created: January 2026*
*Last updated: January 6, 2026*
