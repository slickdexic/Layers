# Troubleshooting

> **Current guidance — September 6, 2026:** For a failed multi-page save, keep the editor open and retry. For lightbox scaling issues, refresh assets and verify your checkout includes the post-1.5.95 fix. Legacy export caches must be regenerated. See [[Current Status]] for remaining draft, export and history issues.

Solutions for common issues with the Layers extension.

---

## Installation Issues

### "Edit layers" Tab Not Visible

**Symptoms:** No "Edit layers" tab appears on File: pages.

**Solutions:**

1. **Check extension is loaded:**
   - Visit `Special:Version`
   - Look for "Layers" under "Installed extensions"
   - If missing, verify `wfLoadExtension( 'Layers' );` in LocalSettings.php

2. **Check extension is enabled:**
   ```php
   $wgLayersEnable = true;  // Must be true (default)
   ```

3. **Check user permissions:**
   ```php
   $wgGroupPermissions['user']['editlayers'] = true;
   ```

4. **Clear caches:**
   ```bash
   php maintenance/run.php rebuildLocalisationCache
   ```

### Database Errors on Save

**Symptoms:** Error message about missing tables or schema.

**Solutions:**

1. **Run database update:**
   ```bash
   # Run from the MediaWiki root on the supported main/1.43 installations
   php maintenance/run.php update
   ```

2. **Verify tables exist:**
   ```sql
   SHOW TABLES LIKE 'layer_sets';
   -- Include your configured MediaWiki table prefix, if any.
   ```

3. **Check database permissions:**
   - MediaWiki user needs CREATE TABLE permission for initial setup
   - Needs INSERT/UPDATE/DELETE for normal operation

### Composer Conflicts (Windows)

**Symptoms:** `composer install` runs a Python package instead of PHP Composer.

**Solutions:**

1. **Use PHP Composer directly:**
   ```bash
   php composer.phar install
   ```

2. **Install before testing:**
   `npm run test:php` runs installed PHP quality tools; it does not install Composer or dependencies.

3. **Check PATH order:**
   - Ensure PHP Composer comes before Python in PATH

---

## Editor Issues

### Blank Editor / Canvas Not Loading

**Symptoms:** Editor opens but canvas is empty or white.

**Solutions:**

1. **Check browser console (F12):**
   - Look for JavaScript errors
   - Look for failed resource loads

2. **Check ResourceLoader:**
   - Inspect failed `load.php` requests and their responses in the browser Network tab
   - Check for 404 errors in Network tab

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

4. **Check CSP headers:**
   - Layers requires `blob:` in img-src and connect-src
   - See [CSP Guide](https://github.com/slickdexic/Layers/blob/main/docs/CSP_GUIDE.md)

### Tools Not Responding

**Symptoms:** Clicking tools doesn't work or drawing doesn't appear.

**Solutions:**

1. **Refresh the page:**
   - Save or preserve unsaved work first; refreshing may discard it

2. **Check for JavaScript errors:**
   - Open DevTools (F12) → Console
   - Look for red error messages

3. **Try a different browser:**
   - Ensures it's not browser-specific

4. **Check if canvas is focused:**
   - Click on the canvas area to focus it

### Keyboard Shortcuts Not Working

**Symptoms:** Pressing `T`, `R`, etc. doesn't switch tools.

**Solutions:**

1. **Click inside the editor first:**
   - Shortcuts only work when editor is focused

2. **Check you're not in a text field:**
   - Shortcuts are disabled in input fields

3. **Check for browser conflicts:**
   - Some browser extensions capture shortcuts
   - Try in incognito/private mode

### Layers Not Saving

**Symptoms:** Save button doesn't work or returns error.

**Solutions:**

1. **Check network tab:**
   - Is the API request being made?
   - What's the response?

2. **Check permissions:**
   - User must have `editlayers`; file-backed changes also need File-page edit permission
   - User must not be blocked

3. **Check rate limiting:**
   ```php
   // Increase limits temporarily
   $wgRateLimits['editlayers-save']['user'] = [ 100, 3600 ];
   ```

4. **Check payload size:**
   - Very complex layers may exceed `$wgLayersMaxBytes`
   - Increase limit if needed:
   ```php
   $wgLayersMaxBytes = 4194304;  // 4 MB
   ```

---

## Display Issues

### Layers Not Showing in Articles

**Symptoms:** `[[File:X.png|layerset=on]]` shows image without layers.

**Solutions:**

1. **Verify layers exist:**
   - Open File: page
   - Click "Edit Layers"
   - Confirm there are saved layers

2. **Check set name:**
   - Names are case-sensitive
   - `layerset=anatomy` ≠ `layerset=Anatomy`

3. **Purge the page:**
   - Add `?action=purge` to the URL
   - Or use the purge link in sidebar

4. **Check JavaScript loads:**
   - Viewer JS must load on article pages
   - Check for JS errors in console

### Wrong Layers Showing

**Symptoms:** Different layers appear than expected.

**Solutions:**

1. **Verify set name spelling:**
   - Check exact name in editor dropdown

2. **Check for multiple sets:**
   - You may be viewing a different named set

3. **Clear caches:**
   - Browser cache + MediaWiki page cache

### Layers Look Different Than in Editor

**Symptoms:** Colors, positions, or sizes are off.

**Solutions:**

1. **Check image scaling:**
   - Viewer scales to display size
   - Editor works at full resolution

2. **Check for CSS conflicts:**
   - Wiki theme CSS may affect colors

3. **Check for transparency:**
   - Some viewers handle transparency differently

---

## Performance Issues

### Editor is Slow

**Symptoms:** Lag when drawing or selecting.

**Solutions:**

1. **Reduce layer count:**
   - Remove unnecessary layers after saving a backup
   - Aim for < 50 layers

2. **Reduce image size:**
   - Very large images (8K+) can be slow
   - Use appropriate `$wgLayersMaxImageSize`

3. **Close other tabs:**
   - Free up browser resources

4. **Check for memory leaks:**
   - Save successfully before reloading; reloading can discard unsaved work

### Saving Takes Too Long

**Symptoms:** Save operation is slow.

**Solutions:**

1. **Reduce data size:**
   - Remove unnecessary layers
   - Simplify complex paths

2. **Check server load:**
   - Database may be overloaded

3. **Check network:**
   - Slow connection affects upload time

---

## API Errors

### "layers-file-not-found"

**Cause:** File doesn't exist or filename is wrong.

**Solution:**
- Verify exact filename including extension
- Check File: page exists

### "layers-json-parse-error"

**Cause:** Invalid JSON data sent to server.

**Solution:**
- This is usually a client bug
- Refresh and try again
- Report if persistent

### "layers-rate-limited"

**Cause:** Too many saves in short period.

**Solution:**
- Wait before trying again
- Admin can increase limits:
```php
$wgRateLimits['editlayers-save']['user'] = [ 60, 3600 ];
```

### "layers-data-too-large"

**Cause:** Layer data exceeds size limit.

**Solution:**
- Remove some layers
- Reduce image layer sizes
- Increase limit:
```php
$wgLayersMaxBytes = 4194304;  // 4 MB
```

### "dbschema-missing"

**Cause:** Database tables don't exist.

**Solution:**
```bash
php maintenance/run.php update
```

---

## Browser-Specific Issues

### Safari

- Some older Safari versions have canvas issues
- Use a current Safari release; the old minimum-version claim was not verified

### Firefox

- Enable hardware acceleration for best performance
- Check `about:config` for canvas settings

### Chrome

- Generally best compatibility
- Enable hardware acceleration in settings

### Edge

- Use a current Chromium-based Edge release
- Legacy Edge not supported

---

## Getting More Help

### Enable Debug Logging

```php
$wgLayersDebug = true;
$wgDebugLogFile = '/var/log/mediawiki/debug.log';
```

Then check logs:
```bash
tail -f /var/log/mediawiki/debug.log | grep Layers
```

### Report a Bug

1. Check [existing issues](https://github.com/slickdexic/Layers/issues)
2. Gather information:
   - MediaWiki version
   - PHP version
   - Browser and version
   - Error messages
   - Steps to reproduce
3. [Open new issue](https://github.com/slickdexic/Layers/issues/new)

---

## See Also

- [[FAQ]] — Frequently asked questions
- [[Configuration Reference]] — All settings
- [[Installation]] — Setup guide
