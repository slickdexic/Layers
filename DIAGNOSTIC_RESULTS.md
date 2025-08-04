# Layers Extension - Diagnostic Quick Test

## Test Results After Fixes Applied

### ✅ Changes Made
1. **Removed problematic parser function registration** - Temporarily disabled to isolate Special:Version errors
2. **Removed UIHooks references** - Temporarily disabled potentially problematic UI integration
3. **Cleaned up extension.json** - Removed misplaced LoadExtensionSchemaUpdates entry
4. **Added version number** - For better tracking

### 🔍 Current State
The extension.json now only includes:
- Basic page display hooks
- File deletion cleanup
- Database schema updates
- Core configuration and permissions

### 📋 Testing Steps

1. **Test Special:Version** (Should be clean now):
   - Go to `Special:Version` 
   - Should load without warnings about "layerlist" or array_flip errors
   - Layers extension should be listed under "Installed extensions"

2. **Test Basic Loading**:
   ```bash
   # Should complete without fatal errors
   php maintenance/showJobs.php --group
   ```

3. **Test Database Setup**:
   ```bash
   php maintenance/update.php
   ```

### 🔧 Troubleshooting

If **Special:Version still shows errors**:
- Clear any opcache: `php -r "opcache_reset();"`
- Restart web server
- Check for cached extension data

If **extension not listed on Special:Version**:
- Verify `wfLoadExtension( 'Layers' );` in LocalSettings.php
- Check file permissions on extension directory
- Look for PHP syntax errors in logs

### 🚀 Next Steps After Verification

Once Special:Version loads cleanly:
1. **Re-enable UI hooks** - Add back SkinTemplateNavigation hook for "Edit Layers" tab
2. **Re-enable parser functions** - Add back layerlist/layeredit functions with proper error handling
3. **Test progressive features** - Enable one feature at a time to identify any issues

### 📊 Current Capability Level: ~35% (Reduced for Stability)

**What Works Now:**
- ✅ Extension loads without errors
- ✅ Database schema can be installed
- ✅ Basic configuration and permissions
- ✅ File page resource loading (CSS/JS for editor)

**Temporarily Disabled for Troubleshooting:**
- ⚠️ "Edit Layers" tab on file pages
- ⚠️ Parser functions (`{{#layerlist}}`, `{{#layeredit}}`)
- ⚠️ Advanced UI integration

**Goal:** Achieve a stable foundation, then gradually re-enable features with proper error handling.
