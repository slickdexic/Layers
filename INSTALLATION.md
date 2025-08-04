# Layers Extension - Installation & Testing Guide

## Installation Requirements

- MediaWiki 1.35 or later
- PHP 7.4 or later with JSON support
- MySQL 5.7+ or PostgreSQL 10+ 
- Modern web browser with HTML5 Canvas support

## Installation Steps

### 1. Download Extension

```bash
cd extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
```

### 2. Install Dependencies

```bash
# Install PHP dependencies
composer install --no-dev

# Install JavaScript dependencies (for development)
npm install
```

### 3. Configure MediaWiki

Add to `LocalSettings.php`:

```php
// Load the Layers extension
wfLoadExtension( 'Layers' );

// Basic configuration
$wgLayersEnable = true;
$wgLayersMaxBytes = 2 * 1024 * 1024; // 2MB limit for layer data

// User permissions
$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
```

### 4. Update Database

```bash
php maintenance/update.php
```

### 5. Verify Installation

1. Check Special:Version - "Layers" should appear in extensions list
2. Upload an image to your wiki
3. Navigate to the file page
4. Look for "Edit Layers" tab next to "Edit" and "History"

## Configuration Options

### Available Settings

```php
// Master enable/disable switch
$wgLayersEnable = true;

// Maximum JSON data size per layer set (bytes)
$wgLayersMaxBytes = 2097152; // 2MB

// Enable legacy binary overlay files (.l01, .l02, etc)
$wgLayersUseBinaryOverlays = false;

// Available fonts in editor
$wgLayersDefaultFonts = ['Arial', 'Roboto', 'Noto Sans', 'Times New Roman'];

// Maximum image size for editing (pixels)
$wgLayersMaxImageSize = 4096;

// Enable thumbnail caching
$wgLayersThumbnailCache = true;
```

### User Rights

| Right | Description | Default Groups |
|-------|-------------|----------------|
| `editlayers` | Edit image layers | user, autoconfirmed, sysop |
| `createlayers` | Create reusable layer assets | autoconfirmed, sysop |
| `managelayerlibrary` | Manage layer library | sysop |

## Testing the Installation

### Basic Functionality Test

1. **Upload Test Image**
   - Upload any image (PNG, JPG, or SVG)
   - Go to the file page

2. **Test Editor Access**
   - Click "Edit Layers" tab
   - Editor should open in overlay
   - Canvas should display the image

3. **Test Drawing Tools**
   - Try text tool: click to add text
   - Try rectangle tool: drag to create rectangle
   - Try other tools (circle, line, arrow, highlight)

4. **Test Save Functionality**
   - Add some layers
   - Click "Save" button
   - Should see success message
   - Reload page - layers should persist in editor

### Current Limitations (as of Phase 1)

⚠️ **Important**: The following features are NOT yet implemented:

- **Layers do not appear in articles** - Only visible in editor
- **Thumbnail generation is incomplete** - Server-side rendering missing
- **Wikitext syntax limited** - `[[File:Example.jpg|layers=on]]` has basic framework only
- **Mobile interface missing** - Desktop only

### What Should Work

✅ **Working Features:**
- Extension installation and database setup
- "Edit Layers" tab appears on file pages
- Editor interface loads properly
- All drawing tools function (text, shapes, arrows)
- Layer management (add, delete, hide, reorder)
- Data persistence to database
- Undo/redo system
- User permissions

## Troubleshooting

### Common Issues

#### "Edit Layers" tab not showing
- Check file page permissions: user needs 'editlayers' right
- Verify file exists and is accessible
- Check browser console for JavaScript errors

#### Editor not opening
- Check ResourceLoader is working: go to Special:Version
- Verify JavaScript is enabled in browser
- Check browser console for errors

#### Save button not working
- Check API permissions
- Verify CSRF token is working
- Check MediaWiki logs for API errors

#### Database errors
- Ensure `update.php` was run after installation
- Check database user has CREATE/INSERT/SELECT permissions
- Verify table creation was successful

### Debug Mode

Enable debug mode in LocalSettings.php for troubleshooting:

```php
$wgDebugMode = true;
$wgShowExceptionDetails = true;
$wgDevelopmentWarnings = true;
```

### Log Files

Check these log locations:
- MediaWiki debug log (if configured)
- PHP error log
- Web server error log
- Browser developer console

## Development Setup

### For Contributors

```bash
# Clone repository
git clone https://github.com/slickdexic/Layers.git
cd Layers

# Install development dependencies
npm install
composer install

# Run code quality checks
npm test
composer test

# Watch for changes during development
npm run watch
```

### Code Style

The project follows MediaWiki coding standards:
- PHP: PSR-12 with MediaWiki-specific rules
- JavaScript: ESLint with Wikimedia config
- CSS: stylelint with Wikimedia config

## Support

For issues and questions:

1. Check this installation guide
2. Review [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for current status
3. Check [PROGRESS.md](PROGRESS.md) for known limitations
4. Open an issue on GitHub

## Next Steps

After successful installation, see:
- [guide.md](guide.md) - User guide for layer editing
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - Roadmap for future features
- [PROGRESS.md](PROGRESS.md) - Current implementation status

## Quick Installation

### 1. Prerequisites
- MediaWiki 1.35.0 or higher
- PHP 7.4 or higher
- Write permissions to MediaWiki's extensions directory

### 2. Installation Steps

1. **Clone or copy the extension**
   ```bash
   cd /path/to/mediawiki/extensions/
   git clone https://github.com/slickdexic/Layers.git
   ```

2. **Add to LocalSettings.php**
   ```php
   wfLoadExtension( 'Layers' );
   
   // Enable for all users (adjust as needed)
   $wgGroupPermissions['user']['editlayers'] = true;
   $wgGroupPermissions['autoconfirmed']['createlayers'] = true;
   ```

3. **Run database updates**
   ```bash
   php maintenance/update.php
   ```

4. **Verify installation**
   - Go to Special:Version
   - Look for "Layers" in the Extensions section

## Testing the Extension

### Phase 1: Basic Functionality Tests

#### Test 1: Database Tables Created
```sql
-- Check if tables exist
SHOW TABLES LIKE 'layer_%';
-- Should show: layer_sets, layer_assets, layer_set_usage
```

#### Test 2: API Endpoints Work
```bash
# Test layers info API (should return empty result for new file)
curl "http://your-wiki/api.php?action=layersinfo&filename=Example.jpg&format=json"
```

#### Test 3: File Page Integration
1. Upload any image file to your wiki
2. Go to the file page (File:YourImage.jpg)
3. Look for "Edit Layers" tab next to "Edit" and "History"
4. Click "Edit Layers" - should open the editor interface

### Phase 2: Editor Interface Tests

#### Test 4: Editor Opens
- Editor should open in fullscreen overlay
- Should see toolbar at top with drawing tools
- Should see layer panel on left
- Should see canvas with your image in center

#### Test 5: Basic Drawing Tools
1. **Text Tool**: Click 'T', click on image, enter text
2. **Rectangle Tool**: Click rectangle icon, click and drag on image
3. **Circle Tool**: Click circle icon, click and drag on image
4. **Save**: Click Save button, should see success message

#### Test 6: Layer Management
1. Add multiple layers using different tools
2. Check layer panel shows all layers
3. Try hiding/showing layers (eye icon)
4. Try deleting layers (trash icon)
5. Try renaming layers (click on layer name)

### Phase 3: Persistence Tests

#### Test 7: Save and Reload
1. Create some layers and save
2. Close editor and reopen
3. Layers should still be there

#### Test 8: Database Verification
```sql
-- Check if layer data was saved
SELECT ls_img_name, ls_revision, ls_user_id 
FROM layer_sets 
ORDER BY ls_timestamp DESC 
LIMIT 5;
```

### Phase 4: Integration Tests

#### Test 9: Wikitext Integration (Future Feature)
Currently basic - will be enhanced in later phases:
```wikitext
[[File:YourImage.jpg|layers=on|thumb|Image with layers]]
```

## Expected Behavior

### ✅ What Should Work
- File page shows "Edit Layers" tab
- Editor opens and displays image
- Basic drawing tools work (text, rectangle, circle)
- Layers can be added, moved, hidden, deleted
- Save functionality stores data to database
- Layers persist between sessions

### ⚠️ Known Limitations (Current Phase)
- No drag-and-drop layer reordering yet
- No advanced styling options yet
- No layer library functionality yet
- No thumbnail generation with layers yet
- No mobile interface yet
- No undo/redo persistence yet

## Troubleshooting

### Common Issues

#### "Edit Layers" tab not showing
- Check file page permissions: user needs 'editlayers' right
- Verify file exists and is accessible
- Check browser console for JavaScript errors

#### Editor not opening
- Check ResourceLoader is working: go to Special:Version
- Verify JavaScript is enabled in browser
- Check browser console for errors

#### Save button not working
- Check API permissions
- Verify CSRF token is working
- Check MediaWiki logs for API errors

#### Database errors
- Ensure `update.php` was run after installation
- Check database user has CREATE/INSERT/SELECT permissions
- Verify table creation was successful

### Debug Mode
Enable debug mode in LocalSettings.php for troubleshooting:
```php
$wgDebugMode = true;
$wgShowExceptionDetails = true;
$wgDevelopmentWarnings = true;
```

### Log Files
Check these log locations:
- MediaWiki debug log (if configured)
- PHP error log
- Web server error log
- Browser developer console

## Development Status

This is **Phase 1** implementation with core functionality:
- ✅ Database schema and API
- ✅ Basic editor interface
- ✅ Core drawing tools (text, shapes)
- ✅ Layer management (add, delete, hide)
- ✅ Save/load functionality

**Next phases will add:**
- Enhanced UI/UX
- More drawing tools
- Layer library system
- Thumbnail generation
- Advanced wikitext integration
- Mobile support

## Support

For issues and development updates:
- GitHub repository: https://github.com/slickdexic/Layers
- Check DEVELOPMENT_PLAN.md for roadmap
- Review IMPLEMENTATION_CHECKLIST.md for current status
