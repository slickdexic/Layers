# Debugging the Layers Extension Issues

## Current Status

The Layers extension has been updated with extensive debugging to help identify why:
1. Layers are not rendering on images
2. The "Edit Layers" tab is not appearing on file pages

## Debug Changes Made

### JavaScript Debugging (resources/ext.layers/init.js)
- Added console logging to track module initialization
- Added logging for layer viewer scanning and creation
- Added logging for editor initialization

### PHP Debugging
- Added logging to `Hooks::onBeforePageDisplay()` to track module loading
- Added logging to `UIHooks::onSkinTemplateNavigation()` to track tab creation
- Added logging to `WikitextHooks::onThumbnailBeforeProduceHTML()` to track layer data processing
- Added logging to `Hooks::onUserGetRights()` to track permission granting

### Permission Changes (temporary for debugging)
- Modified `Hooks::onUserGetRights()` to grant `editlayers` permission to all registered users by default

## How to Debug

### 1. Check MediaWiki Logs
Look in your MediaWiki logs (usually configured in LocalSettings.php) for entries with "Layers:" prefix.

### 2. Use Browser Console
1. Open a page with images in your MediaWiki installation
2. Open browser developer tools (F12)
3. Check the Console tab for "Layers:" messages
4. Look for module loading and initialization messages

### 3. Test with Debug HTML Page
1. Place `debug-layers.html` in your MediaWiki webroot or accessible directory
2. Open it in a browser where MediaWiki modules are available
3. Check console output and module availability

### 4. Check File Page Tabs
1. Go to any file page (e.g., File:ImageTest01.png)
2. Look for "Edit Layers" tab in the page tabs/actions
3. Check browser console for tab creation debug messages

### 5. Test Image with Layers Parameter
Try adding a wikitext image with layers parameter:
```
[[File:ImageTest01.png|200px|layers=on]]
```

## Expected Debug Output

### On Any Page Load:
```
Layers: Initializing extension...
Layers: Scanning for layer viewers...
Layers: Found X images total
Layers: Found Y images with layers-thumbnail class
Layers: Found Z images with layer data
Layers: Initialization complete
```

### On File Pages:
```
Layers: SkinTemplateNavigation hook called
Layers: Title exists: yes
Layers: User exists: yes
Layers: Title namespace: 6, NS_FILE: 6
Layers: Is file namespace: yes
Layers: User can editlayers: yes
Layers: Adding edit layers tab
```

### When Images with Layer Data are Present:
```
Layers: ThumbnailBeforeProduceHTML hook called
Layers: layersFlag = on
Layers: Retrieved layer data from database: X layers
Layers: Added layer data attribute with X layers
```

## Common Issues and Solutions

### Issue: No debug output at all
- Extension may not be loaded by MediaWiki
- Check that extension.json is valid
- Verify extension is listed in LocalSettings.php

### Issue: "Edit Layers" tab not appearing
- Check user permissions in logs
- Verify user is logged in and has editlayers permission
- Check namespace detection in logs

### Issue: Layers not rendering
- Check if images have `layers-thumbnail` class in HTML
- Check if `data-layer-data` attribute is present
- Verify layer data format in browser inspector

### Issue: Module not loading
- Check ResourceLoader configuration
- Verify JavaScript files exist and are readable
- Check browser network tab for 404 errors on module files

## Temporary Debug Configuration

Add to LocalSettings.php for more verbose debugging:
```php
$wgDebugLogGroups['Layers'] = '/path/to/layers-debug.log';
$wgLayersGrantAllUsers = true; // Temporary: grant permission to all users
```

## Next Steps

After gathering debug information:
1. Check what specific messages appear or don't appear
2. Identify which hooks are/aren't being called
3. Verify module loading and permission issues
4. Fix the root cause based on debug output

## Rollback Debug Changes

When debugging is complete, remove/comment out console.log statements and revert the permission changes in `Hooks::onUserGetRights()`.
