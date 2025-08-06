# Layers MediaWiki Extension

A **non-destructive image annotation extension** for MediaWiki that allows users to add text, shapes, arrows, and highlights directly to images in the wiki without modifying the original files.

## ⚠️ Current Status: DEVELOPMENT VERSION

**This extension is currently in active development and is NOT ready for production use.**

### What Actually Works Now (v0.8.1-dev - August 2025)

#### ✅ Core Drawing Tools (Fully Functional)
- **Text Tool** - Multi-line text with font size, 8 font families, text alignment (left/center/right), color, stroke, drop shadow
- **Pen Tool** - Freehand drawing with adjustable stroke width
- **Rectangle Tool** - Drag to create rectangles with stroke and fill options
- **Circle Tool** - Drag to create circles with radius control
- **Ellipse Tool** - Separate X/Y radius control for elliptical shapes
- **Polygon Tool** - Variable-sided polygons (default hexagon)
- **Star Tool** - Configurable star shapes with inner/outer radius
- **Arrow Tool** - Single, double, or line-only arrows with size control
- **Line Tool** - Straight lines with stroke styling
- **Highlight Tool** - Semi-transparent highlighting rectangles

#### ✅ Professional Editing Features
- **Object Selection** - Click to select, bounding boxes with 8 resize handles
- **Object Transformation** - Move (drag), resize (handles), rotate (rotation handle)
- **Multi-selection** - Ctrl+click for multiple objects, marquee selection
- **Professional Shortcuts** - Ctrl+A/C/V/X/Z, Delete key, tool shortcuts (T,P,R,C,etc.)
- **Layer Management** - Add, delete, hide/show, reorder layers in panel
- **Zoom & Pan** - Mouse wheel zoom, space+drag panning
- **Grid System** - Toggle grid display, snap-to-grid functionality
- **Undo/Redo System** - Complete 50-step history with keyboard shortcuts
- **Copy/Paste Operations** - Smart positioning and multi-object support with automatic offset
- **Selection Modifiers** - Shift (proportional scaling), Alt (center scaling), rotation snap points

#### ✅ Backend Integration
- **Database Storage** - JSON layer data with versioning and history
- **API Endpoints** - ApiLayersInfo (load) and ApiLayersSave (save) working
- **Security** - Input validation, CSRF protection, user permissions
- **File Integration** - "Edit Layers" tab on MediaWiki file pages

### Critical Missing Features (Blocking Production)

#### ❌ Integration and Testing Gaps (Updated Priority)

- **Integration Testing**: Need to test end-to-end functionality
- **ImageMagick Configuration**: Verify MediaWiki ImageMagick settings
- **Parser Integration**: Minor tweaks needed for complete wikitext support
- **File Path Resolution**: Thumbnail URL generation may need adjustment

#### ❌ Production Deployment Issues  

- **Code Quality**: 51 ESLint violations (reduced from 89), minimal PHP issues remaining
- **Testing Coverage**: Limited PHPUnit tests, no JavaScript test framework
- **Browser Compatibility**: ES2015+ features need polyfills for older browsers
- **Performance**: No memory management for large images or complex scenes

#### ❌ Minor Extension Configuration Issues  

- **Version Consistency**: All files now aligned to v0.8.1-dev
- **Documentation**: Needs update to reflect actual implementation status
- **Error Handling**: Could be enhanced for production robustness

### Realistic Assessment: ~95% Frontend Complete, ~75% Backend Complete

The frontend editor is remarkably sophisticated with professional features including complete undo/redo, enhanced copy/paste, comprehensive text controls, and advanced selection modifiers. **Significant progress discovered**: The backend server-side rendering infrastructure is much more complete than initially assessed, with comprehensive ImageMagick integration already implemented.

**Key Achievement**: Both drawing tools and server-side rendering infrastructure are largely production-ready.  
**Main Blockers**: Integration testing, remaining code quality issues, and final MediaWiki parser integration.

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

### Priority Development Areas

1. **Server-side rendering** (CRITICAL) - ImageMagick integration for thumbnails
2. **Wikitext parser integration** (CRITICAL) - Complete [[File:...layers=on]] support  
3. **Code quality fixes** - Resolve 89 ESLint violations
4. **Production deployment** - Missing vendor dependencies and configuration
5. **Comprehensive testing** - Unit and integration test framework

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
