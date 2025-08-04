# Layers MediaWiki Extension

A **non-destructive image annotation extension** for MediaWiki that allows users to add text, shapes, arrows, and highlights directly to images in the wiki without modifying the original files.

## ⚠️ Current Status: DEVELOPMENT VERSION

**This extension is currently in active development and is NOT ready for production use.**

### What Works Now (v0.8 - August 2025)
- ✅ Full-featured image editor with all drawing tools
- ✅ Layer management (add, edit, delete, reorder, hide/show)
- ✅ Data persistence to database with versioning
- ✅ "Edit Layers" tab on file pages
- ✅ Undo/redo system (50 steps)
- ✅ Security validation and user permissions

### Critical Missing Features
- ❌ **Server-side thumbnail rendering** - Images with layers don't display in articles yet
- ❌ **Complete wikitext integration** - `[[File:Example.jpg|layers=on]]` syntax exists but limited
- ❌ **Production testing** - Not tested at scale
- ❌ **Mobile interface** - Desktop only

### Estimated Completion: ~60% of Phase 1
The foundation is solid, but key integration pieces are still in development.

## Installation (For Developers/Testers Only)

```bash
cd extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers
composer install
npm install
```

Add to `LocalSettings.php`:
```php
wfLoadExtension( 'Layers' );
$wgLayersEnable = true;
$wgGroupPermissions['user']['editlayers'] = true;
```

Run database updates:
```bash
php maintenance/update.php
```

## Development Setup

For code quality checks:
```bash
npm test          # JavaScript linting
composer test     # PHP code standards
```

## Contributing

This extension is under active development. Contributors welcome!

### Priority Development Areas:
1. **Server-side rendering** (CRITICAL) - ImageMagick integration for thumbnails
2. **Wikitext parser integration** (CRITICAL) - Complete [[File:...layers=on]] support  
3. **Performance optimization** - Large image handling
4. **Mobile interface** - Touch-friendly editing
5. **Comprehensive testing** - Unit and integration tests

## Architecture

- **Frontend**: HTML5 Canvas with custom drawing tools
- **Backend**: MediaWiki extension with API endpoints
- **Storage**: JSON layer data with database versioning
- **Rendering**: Server-side ImageMagick composition (in development)

## Security

- Input validation and sanitization
- CSRF protection on API endpoints
- User permission integration
- Rate limiting support

## License

GPL-2.0-or-later

---

**Note**: This is a development version. The documentation may describe planned features that are not yet fully implemented. Check the current status above for what actually works.
