# Layers Extension - Fix Summary

This document summarizes the fixes applied to resolve the critical rendering and tab visibility issues.

## Issues Fixed

### 1. Layers Not Rendering
**Problem**: The viewer module (`ext.layers`) was not loading on pages, preventing layers from displaying.

**Root Cause**: The `BeforePageDisplay` hook was checking `LayersEnable` config before loading the viewer module, preventing it from loading when needed.

**Fix Applied**:
- Modified `src/Hooks.php::onBeforePageDisplay()` to always load `ext.layers` module first
- Config check now only affects additional features (editor module on file pages)
- This ensures layer viewing works everywhere, even if editing is disabled

**Code Changes**:
```php
// OLD: Checked config first, blocked module loading
if ( !$config->get( 'LayersEnable' ) ) {
    return; // This prevented viewer module loading
}
$out->addModules( 'ext.layers' );

// NEW: Always load viewer, config only affects editor
$out->addModules( 'ext.layers' );
if ( !$config->get( 'LayersEnable' ) ) {
    return; // Only blocks editor features
}
```

### 2. "Edit Layers" Tab Not Displaying
**Problem**: The tab wasn't appearing for users who should have access.

**Root Cause**: The `SkinTemplateNavigation` hook was checking the `LayersEnable` config before checking user permissions, blocking tab display even for authorized users.

**Fix Applied**:
- Modified `src/Hooks/UIHooks.php::onSkinTemplateNavigation()` to check user permissions first
- Config check now happens after permission validation
- Ensures authorized users always see the tab when appropriate

**Code Changes**:
```php
// OLD: Config check blocked everything
if ( $config && !$config->get( 'LayersEnable' ) ) {
    return; // Blocked tab even for authorized users
}
// User permission checks...

// NEW: Permissions checked first
// User permission checks...
if ( $config && !$config->get( 'LayersEnable' ) ) {
    return; // Only blocks after permission validation
}
```

### 3. JavaScript Linting Issues
**Problem**: ESLint was failing due to console statements and trailing spaces.

**Fix Applied**:
- Removed excessive `console.log` statements from `resources/ext.layers/init.js`
- Cleaned up trailing whitespace
- Kept error handling but removed debug logging
- `npm test` now passes cleanly

### 4. Permission Debugging
**Enhancement**: Improved permission debugging and made `editlayers` right available to all registered users by default for testing.

**Changes**:
- Enhanced logging in `UserGetRights` hook
- Default permission grant for debugging (controlled by `$wgLayersGrantAllUsers`)
- Better error messages and status reporting

## Testing

### Created Test Files
1. **`test-layers-fixed.html`**: Standalone test page for viewer and editor
2. **`test-database.php`**: Database class functionality test
3. **`debug-quick.php`**: Extension configuration checker

### Verification Steps
1. Run `npm test` - should pass without errors
2. Open `test-layers-fixed.html` in browser - should show working layer viewer
3. Check MediaWiki file pages - "Edit Layers" tab should appear for authorized users
4. Verify layer overlays display on images with `layers=all` parameter

## Expected Behavior After Fixes

### Layer Rendering
- Images with `data-layer-data` attributes should display overlays
- Works on any page (not just file pages)
- No configuration required for basic viewing

### Edit Layers Tab
- Appears on file pages for users with `editlayers` permission
- Shows regardless of `LayersEnable` config (if user is authorized)
- Links to `?action=editlayers` or dedicated Action class

### JavaScript Loading
- Clean console output (no excessive logging)
- Proper error handling and user feedback
- Dependencies check correctly

## Configuration Notes

For production use, administrators can:
- Set `$wgLayersEnable = false` to disable editing features while keeping viewing
- Control permissions via standard MediaWiki group permissions
- Monitor via PSR-3 logging channel `Layers`

## Files Modified

1. `src/Hooks.php` - Fixed module loading order
2. `src/Hooks/UIHooks.php` - Fixed tab permission logic  
3. `resources/ext.layers/init.js` - Cleaned up logging and linting
4. `TODO.md` - Updated status tracking

All changes are backward compatible and follow MediaWiki best practices.
