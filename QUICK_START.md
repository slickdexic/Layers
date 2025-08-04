# Layers Extension - Quick Start Guide

## Current Status (August 2025)

**Development Version 0.8** - Core functionality implemented, server-side rendering in progress.

### What Works Now
- ✅ Full image editor with all drawing tools
- ✅ Layer management and persistence
- ✅ Database integration with versioning
- ⏳ Server-side thumbnail rendering (85% complete)
- ⏳ Wikitext integration (75% complete)

### Critical Limitations
- Images with layers may not display correctly in articles yet
- Mobile interface not implemented
- Limited production testing

## Installation

### Prerequisites
- MediaWiki 1.35.0 or later
- PHP 7.4+ with ImageMagick extension
- Composer and npm for development

### Step 1: Download Extension
```bash
cd /path/to/mediawiki/extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
```

### Step 2: Install Dependencies
```bash
composer install
npm install
```

### Step 3: Enable Extension
Add to `LocalSettings.php`:
```php
wfLoadExtension( 'Layers' );

// Basic configuration
$wgLayersEnable = true;
$wgLayersMaxBytes = 2 * 1024 * 1024; // 2MB limit
$wgLayersMaxImageSize = 4096; // Max image size in pixels

// User permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;

// Enable ImageMagick (required for thumbnail rendering)
$wgUseImageMagick = true;
$wgImageMagickConvertCommand = '/usr/bin/convert'; // Adjust path as needed
```

### Step 4: Update Database
```bash
php maintenance/update.php
```

### Step 5: Verify Installation
1. Go to any File: page (e.g., File:Example.jpg)
2. Look for "Edit Layers" tab next to "Edit" and "History"
3. Click tab to open the layer editor

## Testing the Extension

### Basic Editor Test
1. Upload an image to your wiki
2. Navigate to the file page
3. Click "Edit Layers" tab
4. Try each tool:
   - **V** - Select/pointer tool
   - **T** - Text tool
   - **R** - Rectangle tool
   - **C** - Circle tool
   - **A** - Arrow tool
   - **L** - Line tool
   - **H** - Highlight tool

### Layer Management Test
1. Add multiple layers with different tools
2. Test layer panel features:
   - Hide/show layers (eye icon)
   - Reorder layers (drag and drop)
   - Select layers (click in panel)
   - Edit layer properties
3. Test undo/redo (Ctrl+Z / Ctrl+Y)
4. Save and reload to verify persistence

### Wikitext Integration Test
1. Create/edit a wiki page
2. Add image with layers parameter:
   ```wikitext
   [[File:YourImage.jpg|layers=on|thumb|Test layered image]]
   ```
3. Save and view page
4. **Expected**: Image displays with layers overlaid
5. **Current limitation**: May show original image only

## Development Testing

### Code Quality Checks
```bash
npm test          # JavaScript linting and tests
composer test     # PHP code standards
```

### Enable Debug Mode
Add to `LocalSettings.php` for detailed error reporting:
```php
$wgShowExceptionDetails = true;
$wgDebugToolbar = true;
$wgShowDBErrorBacktrace = true;
```

### Check Database Tables
Verify these tables were created:
- `layer_sets` - Main layer data storage
- `layer_assets` - Reusable layer library (future)
- `layer_set_usage` - Usage tracking (future)

### Test API Endpoints
- `api.php?action=layersinfo&filename=Example.jpg`
- `api.php?action=layerssave` (POST with CSRF token)

## Troubleshooting

### "Edit Layers" Tab Missing
- Check user has `editlayers` permission
- Verify extension is loaded (`Special:Version`)
- Check file namespace (only works on File: pages)

### Editor Won't Load
- Check browser console for JavaScript errors
- Verify ResourceLoader modules are loading
- Check file permissions on `resources/` directory

### Can't Save Layers
- Check database permissions
- Verify CSRF tokens are working
- Check API error responses in browser network tab

### Layers Not Displaying in Articles
- This is a known limitation in current version
- Server-side rendering is 85% complete
- Check ImageMagick installation and permissions

### Performance Issues
- Large images (>4096px) may cause browser slowdown
- Consider reducing `$wgLayersMaxImageSize`
- Monitor server resource usage during thumbnail generation

## Known Issues & Workarounds

### Issue: Layers only visible in editor
**Status**: In development (server-side rendering 85% complete)
**Workaround**: Use editor for annotation, export screenshots manually

### Issue: Mobile interface missing
**Status**: Planned for Phase 3
**Workaround**: Use desktop browser for layer editing

### Issue: No layer library/reusable assets
**Status**: Planned for Phase 2
**Workaround**: Copy/paste layers between images manually

## Getting Help

### Log Files
Check these locations for error messages:
- MediaWiki debug log
- PHP error log
- Browser console (F12)

### Reporting Issues
Include this information:
- MediaWiki version
- PHP version
- Browser and version
- Steps to reproduce
- Error messages from logs

### Development Status
- Check PROGRESS.md for current completion status
- See IMPLEMENTATION_STATUS.md for known limitations
- Review guide.md for full feature specification

## Next Steps

Once basic functionality is confirmed:
1. Test with various image formats (PNG, JPG, SVG)
2. Try different layer combinations
3. Test with larger images (within limits)
4. Experiment with parser functions: `{{#layerlist:File=Example.jpg}}`
5. Provide feedback on user experience

Remember: This is a development version. Report any issues found and suggestions for improvement.
