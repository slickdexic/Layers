# Duplicate "Edit Layers" Tabs Fix - August 4, 2025

## Issue Identified ❌
**Problem**: Two identical "Edit Layers" tabs appearing on file pages
**Root Cause**: Duplicate tab creation from both PHP hooks and JavaScript code

## Analysis

### Two Tab Creation Systems Found:
1. **PHP Hook System** (Proper MediaWiki integration)
   - File: `src/Hooks/UIHooks.php` 
   - Method: `onSkinTemplateNavigation()`
   - Creates tab via MediaWiki's standard navigation system
   - **NOT REGISTERED** in extension.json

2. **JavaScript System** (Client-side hack)
   - File: `resources/ext.layers/init.js`
   - Method: `addEditLayersTab()`
   - Manually creates DOM elements and inserts them
   - **ACTIVELY RUNNING** and creating tabs

### Why Both Were Running:
- JavaScript system was active and working
- PHP hook system existed but was not registered
- Both tried to create the same tab functionality
- No duplicate detection between the two systems

## Solution Implemented ✅

### 1. Registered PHP Hooks in extension.json
**Changes:**
```json
"Hooks": {
    "SkinTemplateNavigation": "MediaWiki\\Extension\\Layers\\Hooks\\UIHooks::onSkinTemplateNavigation",
    "UnknownAction": "MediaWiki\\Extension\\Layers\\Hooks\\UIHooks::onUnknownAction"
}
```

### 2. Disabled JavaScript Tab Creation
**File**: `resources/ext.layers/init.js`
**Changes:**
- Removed call to `addEditLayersTab()` in `initializeFilePageIntegration()`
- Added comment explaining tabs are now handled via PHP hook
- Kept the function available but unused (for backward compatibility)

### 3. Improved Integration Between Systems
**Changes:**
- Added hook listener for `layers.editor.init` from PHP system
- Modified `createEditor()` to accept optional container parameter
- Ensured PHP-initiated editor and JavaScript-initiated editor use same code path

### 4. Enhanced Error Prevention
**Improvements:**
- Added existence check in `addEditLayersTab()` to prevent duplicates (as backup)
- Better logging to identify which system created tabs
- Cleaner separation between server-side and client-side initialization

## Technical Details

### PHP Hook Flow (Now Active):
```
File Page Load 
  → UIHooks::onSkinTemplateNavigation() 
    → Check NS_FILE, permissions, file exists
    → Add tab to $links['views']['editlayers']
    → MediaWiki renders tab in UI

Tab Click 
  → action=editlayers URL
  → UIHooks::onUnknownAction()
    → Load ext.layers.editor module
    → Create container div
    → Fire mw.hook('layers.editor.init')
    → JavaScript creates LayersEditor instance
```

### JavaScript Hook Flow (Now Listening):
```
Module Load 
  → mw.layers.init()
  → Listen for mw.hook('layers.editor.init')
  → When fired: createEditor(filename, container)
  → Initialize LayersEditor with proper container
```

## Benefits Achieved

### 1. Single Tab Creation ✅
- Only one "Edit Layers" tab appears
- Uses MediaWiki's standard navigation system
- Proper integration with skin themes

### 2. Better User Experience ✅
- Consistent tab styling with other MediaWiki tabs
- Proper keyboard navigation support
- Standard MediaWiki URL handling (action=editlayers)

### 3. Improved Architecture ✅
- Server-side logic handles permissions and validation
- Client-side code focused on UI functionality
- Clear separation of concerns

### 4. Enhanced Compatibility ✅
- Works with all MediaWiki skins (Vector, MonoBook, etc.)
- Proper permission integration
- Standard MediaWiki hook system

## Testing Validation

### Before Fix:
```
❌ Two "Edit Layers" tabs visible
❌ Inconsistent styling between tabs
❌ Both tabs triggered same functionality
❌ JavaScript DOM manipulation visible
```

### After Fix:
```
✅ Single "Edit Layers" tab
✅ Consistent MediaWiki styling
✅ Proper permission checking
✅ Clean URL structure (action=editlayers)
✅ Better error handling
```

## Backward Compatibility

### Maintained Features:
- All existing editor functionality preserved
- Same JavaScript API for LayersEditor
- Same user permissions system
- Same file page integration

### Improved Features:
- Better tab placement and styling
- Proper MediaWiki URL handling
- Enhanced permission validation
- Cleaner initialization flow

## Future Benefits

### Extensibility:
- Easy to add more file page actions using same pattern
- Standard MediaWiki hook system for future features
- Proper separation allows independent testing

### Maintenance:
- Less code duplication
- Standard MediaWiki patterns
- Easier debugging with proper hook registration
- Better integration with MediaWiki updates

The fix eliminates the duplicate tabs while improving the overall architecture and user experience. The extension now follows MediaWiki best practices for UI integration.
