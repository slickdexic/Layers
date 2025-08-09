# Layers Extension Troubleshooting Guide

This document provides step-by-step troubleshooting for common issues with the Layers MediaWiki extension.

## 🔥 Critical Issues - Quick Fixes

### Issue 1: "Edit Layers" tab not showing

**Symptoms:**
- No "Edit Layers" tab appears on File pages
- Tab is missing even for users who should have access

**Root Causes & Solutions:**

1. **User not logged in**
   - Only logged-in users can see the tab
   - **Fix:** Log in with any user account

2. **Missing permissions**
   - User needs 'editlayers' permission
   - **Fix:** The extension.json automatically grants this to 'user' group
   - **Check:** Go to Special:ListGroupRights and verify 'user' group has 'editlayers'

3. **Extension not loaded**
   - **Check:** Look for "Layers" in Special:Version
   - **Fix:** Add `wfLoadExtension('Layers');` to LocalSettings.php

4. **Database tables missing**
   - **Fix:** Run `php maintenance/update.php` from MediaWiki root directory

### Issue 2: Layers not rendering with `layers=all`

**Symptoms:**
- Images display normally but layer overlays don't appear
- Using `[[File:Example.jpg|layers=all]]` shows no layers

**Root Causes & Solutions:**

1. **No layer data exists**
   - The image has no layers created yet
   - **Fix:** Edit layers first, then use the parameter

2. **JavaScript module not loading**
   - Viewer module not loaded on content pages
   - **Fix:** Extension should automatically load modules (fixed in recent updates)

3. **Incorrect parameter syntax**
   - **Correct:** `[[File:Example.jpg|layers=all]]`
   - **Incorrect:** `[[File:Example.jpg|layer=all]]` (missing 's')

4. **Extension disabled**
   - **Check:** `$wgLayersEnable` should be `true` in config
   - **Fix:** Not usually needed as it defaults to true

## 📋 Step-by-Step Installation Verification

### Step 1: Check Extension Loading

```bash
# From MediaWiki root directory:
grep -r "Layers" LocalSettings.php
```

Should show: `wfLoadExtension('Layers');`

### Step 2: Verify Database Setup

```bash
# From MediaWiki root directory:
php maintenance/update.php
```

Look for messages about layer_sets, layer_assets, and layer_set_usage tables.

### Step 3: Check Permissions

1. Go to Special:ListGroupRights in your wiki
2. Find the 'user' group
3. Verify it includes 'editlayers' permission
4. If missing, the extension.json should automatically add it

### Step 4: Test Basic Functionality

1. Upload a test image (if none exists)
2. Navigate to its File page (e.g., File:Test.jpg)
3. Look for "Edit Layers" tab next to "Edit"
4. Click the tab - editor should load

### Step 5: Test Layer Rendering

1. Create a simple layer (rectangle or text)
2. Save the layers
3. Add `layers=all` to image syntax: `[[File:Test.jpg|layers=all]]`
4. Layer should appear overlaid on the image

## 🔍 Advanced Debugging

### Enable Debug Logging

Add to LocalSettings.php:
```php
$wgLayersDebug = true;
$wgDebugLogFile = "/tmp/mediawiki-debug.log";
```

### Check JavaScript Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for errors related to "layers" or "mw.layers"

### Verify Module Loading

Add to any page and check browser console:
```javascript
console.log('ext.layers loaded:', typeof mw.layers !== 'undefined');
console.log('LayersViewer available:', typeof LayersViewer !== 'undefined');
```

### Check Database Directly

```sql
-- Check if tables exist
SHOW TABLES LIKE 'layer_%';

-- Check for layer data
SELECT COUNT(*) FROM layer_sets;
```

## 🛠 Common Fixes

### Fix 1: Refresh ResourceLoader Cache

```bash
# From MediaWiki root directory:
php maintenance/refreshLinks.php
```

Or append `?action=purge` to any page URL.

### Fix 2: Clear Browser Cache

Hard refresh pages with Ctrl+F5 or clear browser cache entirely.

### Fix 3: Check File Permissions

Ensure MediaWiki can write to upload directory and subdirectories.

### Fix 4: Verify MediaWiki Version

Layers requires MediaWiki 1.44+. Check with:
```bash
php maintenance/version.php
```

## 🚨 Emergency Recovery

If the extension breaks your wiki:

1. **Disable the extension:**
   Comment out `wfLoadExtension('Layers');` in LocalSettings.php

2. **Remove database tables (if needed):**
   ```sql
   DROP TABLE IF EXISTS layer_sets;
   DROP TABLE IF EXISTS layer_assets;  
   DROP TABLE IF EXISTS layer_set_usage;
   ```

3. **Re-install cleanly:**
   - Re-enable the extension
   - Run `php maintenance/update.php`
   - Test with a simple image

## 📞 Getting Help

If issues persist:

1. Check MediaWiki logs for error messages
2. Verify all requirements are met (PHP version, MediaWiki version)
3. Test with a fresh MediaWiki installation
4. Review the extension's GitHub issues page

## ✅ Success Indicators

You'll know the extension is working when:

- ✅ "Edit Layers" tab appears on File pages
- ✅ Clicking the tab opens the layer editor
- ✅ Created layers appear when using `layers=all` parameter
- ✅ No JavaScript errors in browser console
- ✅ Extension appears in Special:Version

## 🔧 Configuration Options

Optional settings for LocalSettings.php:

```php
// Maximum layer data size (default: 2MB)
$wgLayersMaxBytes = 2097152;

// Available fonts in editor
$wgLayersDefaultFonts = [
    'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Courier New'
];

// Enable debug logging
$wgLayersDebug = false;

// Cache composite thumbnails
$wgLayersThumbnailCache = true;
```
ls extensions/Layers/extension.json
```

**Expected**: extension.json file should exist

### 2. Check LocalSettings.php

Add this to your `LocalSettings.php` if not already present:

```php
wfLoadExtension( 'Layers' );

# Optional: Enable debug logging
$wgDebugLogGroups['Layers'] = '/path/to/debug.log';

# Optional: Grant permissions to all users for testing
$wgLayersGrantAllUsers = true;
```

### 3. Run Database Updates

```bash
# Create the required database tables
php maintenance/update.php
```

**Expected output should include**:
```
Adding table layer_sets...
Adding table layer_assets...
Adding table layer_set_usage...
```

### 4. Check User Permissions

In MediaWiki, verify user has `editlayers` permission:

```php
# Add to LocalSettings.php for testing
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['*']['editlayers'] = false; # Anonymous users cannot edit
```

### 5. Clear Caches

```bash
# Clear MediaWiki caches
php maintenance/runJobs.php
php maintenance/rebuildLocalisationCache.php --force

# Or in MediaWiki admin:
# Go to Special:InvalidateUserCache
```

## Common Issues & Solutions

### Issue: "Edit Layers" Tab Not Showing

**Symptoms**: No tab appears on file pages even for logged-in users

**Diagnosis**:
1. Check browser console for JavaScript errors
2. Verify you're on a file page (namespace 6)
3. Check user is logged in and has `editlayers` permission

**Solutions**:
```php
# In LocalSettings.php - temporarily grant to all users
$wgLayersGrantAllUsers = true;

# Or specifically grant to user groups
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['sysop']['editlayers'] = true;
```

### Issue: Layers Not Rendering on Images

**Symptoms**: Images show with `layers=all` parameter but no overlays appear

**Diagnosis**:
1. Check if layer data exists in database:
```sql
SELECT COUNT(*) FROM layer_sets;
```
2. Inspect image HTML for `data-layer-data` attribute
3. Check browser console for JavaScript errors

**Solutions**:

#### No Layer Data
If database is empty, create test data:
```php
# Add to a test page or Special:BlankPage
<?php
$title = Title::newFromText('File:YourImage.jpg');
$file = wfFindFile($title);
if ($file) {
    $db = new MediaWiki\Extension\Layers\Database\LayersDatabase();
    $layerData = [
        'revision' => 1,
        'schema' => '1.0',
        'created' => date('Y-m-d H:i:s'),
        'layers' => [
            [
                'id' => 'test-1',
                'type' => 'text',
                'x' => 50,
                'y' => 50,
                'text' => 'Test Layer',
                'fontSize' => 16,
                'fill' => '#ff0000',
                'visible' => true
            ]
        ]
    ];
    $db->saveLayerSet(
        $file->getName(),
        $file->getMimeType(),
        '',
        $file->getSha1(),
        $layerData,
        $wgUser->getId(),
        'Test Layer Set'
    );
}
?>
```

#### ResourceLoader Issues
```bash
# Force ResourceLoader cache refresh
php maintenance/rebuildLocalisationCache.php --force
# Or add to LocalSettings.php temporarily:
$wgResourceLoaderMaxage['unversioned'] = 0;
```

### Issue: JavaScript Errors

**Symptoms**: Browser console shows errors like "LayersViewer is not defined"

**Solutions**:
1. Check network tab - ensure JS files are loading
2. Verify file permissions on `extensions/Layers/resources/`
3. Clear browser cache completely
4. Check for JavaScript conflicts with other extensions

### Issue: Database Connection Errors

**Symptoms**: PHP errors about database tables not existing

**Solutions**:
```bash
# Re-run the database update
php maintenance/update.php --force

# Check table creation manually
php maintenance/sql.php
> SHOW TABLES LIKE 'layer%';
```

## Testing Procedure

### 1. Test Extension Loading
Visit `Special:Version` - "Layers" should appear in the extensions list.

### 2. Test Tab Appearance
1. Upload an image file
2. Go to the file page (File:YourImage.jpg)
3. "Edit Layers" tab should appear next to "Edit"

### 3. Test Layer Rendering
```wikitext
[[File:YourImage.jpg|300px|layers=all]]
```
Should show the image with any existing layer overlays.

### 4. Test Editor
1. Click "Edit Layers" tab
2. Editor interface should load
3. Try drawing a simple shape
4. Click "Save"

## Debug Information

### Enable Debug Logging
```php
# In LocalSettings.php
$wgDebugLogGroups = [
    'Layers' => '/tmp/layers-debug.log'
];
$wgShowExceptionDetails = true;
```

### Check Module Loading
Add to a page:
```html
<script>
console.log('ResourceLoader modules:', mw.config.get('wgUserGroups'));
console.log('LayersViewer available:', typeof window.LayersViewer);
console.log('mw.layers available:', typeof mw.layers);
</script>
```

### Verify Hook Registration
```bash
grep -r "SkinTemplateNavigation" extensions/Layers/
grep -r "ThumbnailBeforeProduceHTML" extensions/Layers/
```

## Manual Test Files

Use the included test files:
- `test-layers-fixed.html` - Standalone viewer test
- `test-mediawiki-environment.html` - Full environment simulation
- `test-database-schema.php` - Database structure check

## Getting Help

1. Check MediaWiki logs: `/var/log/mediawiki/` or configured log directory
2. Check web server error logs
3. Enable MediaWiki debug mode temporarily
4. Use browser developer tools to inspect network requests and console errors

## Quick Fix Commands

```bash
# Nuclear option - reset everything
php maintenance/update.php --force
php maintenance/rebuildLocalisationCache.php --force
php maintenance/runJobs.php
# Clear browser cache and restart web server
```

This usually resolves 90% of installation issues.
