# Layers MediaWiki Extension

A **non-destructive image annotation extension** for MediaWiki that allows users to add text, shapes, arrows, and highlights directly to images in the wiki without modifying the original files.

## ⚠️ Current Status: DEVELOPMENT VERSION

**This extension is currently in active development and is NOT ready for production use.**

### What Actually Works Now (v0.8.1 - August 2025)
- ✅ Basic image editor with core drawing tools (text, rectangle, circle, arrow, line, pen, highlight)
- ✅ Layer management (add, edit, delete, reorder, hide/show)
- ✅ Data persistence to database with versioning
- ✅ "Edit Layers" tab on file pages
- ✅ Undo/redo system (50 steps)
- ✅ Security validation and user permissions
- ✅ **Selection handles and bounding boxes** - Objects can be selected, moved, and resized
- ✅ **Enhanced text styling** - Text stroke, drop shadow support implemented
- ✅ **Arrow style options** - Single arrow, double arrow, or line only implemented
- ✅ **Object manipulation** - Drag to move, resize handles, rotation handle implemented
- ✅ **Multi-selection** - Ctrl+click and marquee selection for multiple objects
- ✅ **Professional keyboard shortcuts** - Ctrl+A, Ctrl+C, Ctrl+V, Delete key, etc.
- ✅ **Advanced shape tools** - Ellipse, polygon, star tools in toolbar
- ✅ **Layer effects UI** - Opacity, blend modes, shadow toggles in toolbar
- ✅ **Touch/mobile support** - Touch events converted to mouse events

### Critical Missing/Broken Features  
- ❌ **SERVER-SIDE RENDERING BROKEN** - Images with layers don't display in articles (critical blocker)
- ❌ **BACKEND VALIDATION BUG** - Cannot save ellipse, polygon, star, path layers (breaks functionality)
- ❌ **Complete wikitext integration** - `[[File:Example.jpg|layers=on]]` syntax exists but incomplete
- ❌ **Production testing** - Not tested at scale, many console.log statements
- ❌ **Code quality issues** - 88+ ESLint errors, ES2015+ incompatibilities
- ❌ **Performance optimization** - No memory management or efficient rendering
- ❌ **Comprehensive testing** - Limited unit tests, no integration tests

### Honest Assessment: ~85% UI Complete, ~35% Backend Complete
The frontend editor is surprisingly sophisticated with professional features, but the backend integration is incomplete and has critical bugs that prevent production use.

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
