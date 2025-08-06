# Layers MediaWiki Extension - Detailed To-Do List

**Last Updated:** August 6, 2025  
**Extension Version:** 0.8.1  
**Status:** Development Phase - Backend Integration Focus

## 🚨 CRITICAL BLOCKING ISSUES (Production Blockers)

### 1. Server-Side Rendering Implementation - HIGHEST PRIORITY

**Status:** Skeleton code exists, no actual implementation  
**Impact:** Images with layers cannot display in MediaWiki articles  
**Effort:** ~40-60 hours

#### Tasks:
- [ ] **ThumbnailRenderer.php Complete Implementation**
  - [ ] ImageMagick command generation for layer overlay
  - [ ] Layer JSON parsing and rendering pipeline
  - [ ] Canvas-to-ImageMagick coordinate translation
  - [ ] Font handling for text layers on server-side
  - [ ] Error handling and fallback to original image
  - [ ] Performance optimization for large images
  - [ ] Memory management for ImageMagick operations

- [ ] **LayersFileTransform.php Integration**
  - [ ] Thumbnail transform pipeline integration
  - [ ] Cache invalidation when layers change
  - [ ] Support for different thumbnail sizes
  - [ ] Quality and format preservation

- [ ] **Wikitext Parser Support**
  - [ ] `[[File:example.jpg|layers=on]]` syntax implementation
  - [ ] `[[File:example.jpg|layers=setname]]` set selection support
  - [ ] Parser hook registration and parameter handling
  - [ ] Backward compatibility with existing file syntax

#### Technical Specifications:
```php
// Required ThumbnailRenderer methods to implement:
public function generateLayeredThumbnail(File $file, array $params): string|false
private function buildImageMagickCommand(array $layers, string $basePath): string
private function renderTextLayer(array $layer): string
private function renderShapeLayer(array $layer): string
private function validateLayerData(array $layers): bool
```

### 2. Code Quality Critical Issues - HIGH PRIORITY

**Status:** 89 ESLint violations blocking development workflow  
**Impact:** Inconsistent code quality, potential runtime errors  
**Effort:** ~8-12 hours

#### JavaScript Issues (89 total):
- [ ] **Fix 66 ESLint Errors**
  - [ ] 29 trailing spaces violations (auto-fixable)
  - [ ] 15 max-statements-per-line violations
  - [ ] 8 no-redeclare variable shadowing issues
  - [ ] 7 mixed-spaces-and-tabs formatting issues
  - [ ] 4 no-alert confirmations (replace with MediaWiki dialogs)
  - [ ] 3 no-new side-effect issues

- [ ] **Resolve 23 ESLint Warnings**
  - [ ] 18 max-len line length violations (reformat)
  - [ ] 5 missing JSDoc @param type annotations

#### Specific Files to Fix:
1. **CanvasManager.js** (52 violations) - Primary focus
2. **LayersEditor.js** (8 violations) 
3. **LayerPanel.js** (4 violations)
4. **Toolbar.js** (2 violations)
5. **LayersViewer.js** (2 violations)

### 3. Build and Development Environment - MEDIUM PRIORITY

**Status:** Missing Composer dependencies, conflicting Python packages  
**Impact:** Cannot run PHP code quality checks  
**Effort:** ~2-4 hours

#### Tasks:
- [ ] **Fix Composer Environment**
  - [ ] Resolve Python Composer vs PHP Composer conflict
  - [ ] Install missing `vendor/` directory dependencies
  - [ ] Verify PHPCS configuration and MediaWiki standards
  - [ ] Set up proper development environment documentation

- [ ] **Version Consistency**
  - [ ] Update extension.json version from 0.8.1 to current
  - [ ] Align README.md version claims with actual implementation
  - [ ] Create proper version tagging strategy

## 📝 BACKEND DEVELOPMENT TASKS

### 4. Database and API Completion - MEDIUM PRIORITY

**Status:** Core functionality exists, needs enhancement  
**Effort:** ~15-20 hours

#### API Enhancements:
- [ ] **ApiLayersSave.php Improvements**
  - [ ] Enhanced validation for complex layer types (paths, polygons)
  - [ ] Batch operation support for multiple layer saves
  - [ ] Layer history/versioning API endpoints
  - [ ] Conflict resolution for concurrent edits

- [ ] **ApiLayersInfo.php Enhancements**
  - [ ] Layer set filtering and search functionality
  - [ ] Metadata retrieval (creation date, author, version)
  - [ ] Performance optimization for large layer sets
  - [ ] Caching strategy implementation

#### Database Schema Enhancements:
- [ ] **LayersDatabase.php Extensions**
  - [ ] Layer sharing and permissions system
  - [ ] Layer template/library functionality  
  - [ ] Audit trail for layer modifications
  - [ ] Database migration scripts for schema updates

### 5. Security and Performance - MEDIUM PRIORITY

**Status:** Basic security implemented, needs enhancement  
**Effort:** ~10-15 hours

#### Security Tasks:
- [ ] **Enhanced Input Validation**
  - [ ] SVG injection prevention for shape layers
  - [ ] XSS prevention in text layer content
  - [ ] File upload size and type validation
  - [ ] Rate limiting refinement per user role

- [ ] **Permission System Enhancement**
  - [ ] Granular permissions per layer set
  - [ ] Read-only layer sharing capabilities
  - [ ] Admin controls for layer content moderation

#### Performance Tasks:
- [ ] **Memory and Performance Optimization**
  - [ ] Large image handling strategy (>4MB images)
  - [ ] Canvas rendering optimization for complex scenes
  - [ ] Database query optimization for layer retrieval
  - [ ] Thumbnail generation caching strategy

## 🎨 FRONTEND ENHANCEMENT TASKS

### 6. Advanced Drawing Tools - LOW PRIORITY

**Status:** Core tools complete, advanced features missing  
**Effort:** ~20-25 hours

#### Advanced Tool Features:
- [ ] **Polygon Tool Enhancement**
  - [ ] Point editing mode after polygon creation
  - [ ] Add/remove points functionality
  - [ ] Bezier curve support for smooth polygons

- [ ] **Text Tool Advanced Features**
  - [ ] Text rotation controls
  - [ ] Advanced text effects (glow, shadow, outline)
  - [ ] Rich text formatting (bold, italic, underline)
  - [ ] Text path following (text along curves)

- [ ] **Selection Tool Enhancements**
  - [ ] Alt+drag for center-point scaling (currently planned)
  - [ ] Lasso selection tool
  - [ ] Magic wand selection by color/transparency
  - [ ] Multiple selection modes (add, subtract, intersect)

#### New Tool Development:
- [ ] **Advanced Drawing Tools**
  - [ ] Brush tool with pressure sensitivity
  - [ ] Gradient fill tool
  - [ ] Pattern fill tool
  - [ ] Measure/dimension tool

### 7. User Interface Improvements - LOW PRIORITY

**Status:** Functional but could be enhanced  
**Effort:** ~12-15 hours

#### UI Enhancement Tasks:
- [ ] **Mobile/Touch Interface**
  - [ ] Touch-friendly tool buttons and controls
  - [ ] Pinch-to-zoom gesture support
  - [ ] Touch-based layer selection and manipulation
  - [ ] Responsive design for small screens

- [ ] **Layer Panel Enhancements**
  - [ ] Layer thumbnails/previews
  - [ ] Layer grouping and folders
  - [ ] Layer search and filtering
  - [ ] Bulk layer operations (hide/show/delete multiple)

- [ ] **Toolbar Improvements**
  - [ ] Tool presets and favorites
  - [ ] Customizable toolbar layout
  - [ ] Advanced tool property panels
  - [ ] Color palette management

## 🧪 TESTING AND QUALITY ASSURANCE

### 8. Testing Framework Development - MEDIUM PRIORITY

**Status:** Basic PHPUnit tests exist, JavaScript testing missing  
**Effort:** ~15-20 hours

#### PHP Testing:
- [ ] **Expand PHPUnit Test Coverage**
  - [ ] Complete API endpoint testing (ApiLayersSave, ApiLayersInfo)
  - [ ] Database operation testing with mock data
  - [ ] Security validation testing
  - [ ] ThumbnailRenderer testing (once implemented)

#### JavaScript Testing:
- [ ] **JavaScript Test Framework Setup**
  - [ ] QUnit or Jest test framework configuration
  - [ ] CanvasManager unit tests for drawing operations
  - [ ] LayersEditor integration tests
  - [ ] UI component testing (Toolbar, LayerPanel)

#### Integration Testing:
- [ ] **End-to-End Testing**
  - [ ] Browser automation testing (Selenium/Puppeteer)
  - [ ] Cross-browser compatibility testing
  - [ ] Performance testing with large layer sets
  - [ ] MediaWiki integration testing

### 9. Documentation and Deployment - LOW PRIORITY

**Status:** Basic documentation exists, needs expansion  
**Effort:** ~8-10 hours

#### Documentation Tasks:
- [ ] **Developer Documentation**
  - [ ] API endpoint documentation with examples
  - [ ] Database schema documentation
  - [ ] Frontend architecture documentation
  - [ ] Contribution guidelines and coding standards

- [ ] **User Documentation**
  - [ ] User manual with screenshots
  - [ ] Tool usage tutorials
  - [ ] Administration guide
  - [ ] Troubleshooting guide

#### Deployment Preparation:
- [ ] **Production Readiness**
  - [ ] Performance benchmarking and optimization
  - [ ] Security audit and penetration testing
  - [ ] MediaWiki version compatibility testing
  - [ ] Extension packaging and distribution

## 📊 EFFORT ESTIMATION SUMMARY

### Critical Path to Production (MVP):
1. **Server-Side Rendering** (40-60 hours) - MUST HAVE
2. **Code Quality Fixes** (8-12 hours) - MUST HAVE  
3. **Build Environment** (2-4 hours) - MUST HAVE
4. **Basic Testing** (8-10 hours) - SHOULD HAVE

**Total MVP Effort: 58-86 hours (7-11 development days)**

### Full Production Release:
- **Backend Completion**: 65-95 hours
- **Frontend Enhancements**: 32-40 hours  
- **Testing & QA**: 23-30 hours
- **Documentation**: 8-10 hours

**Total Full Release: 128-175 hours (16-22 development days)**

## 🎯 RECOMMENDED DEVELOPMENT PHASES

### Phase 1: Production MVP (2-3 weeks)
**Goal:** Make extension deployable for basic use cases

1. Fix critical ESLint errors (focus on CanvasManager.js)
2. Implement basic server-side rendering for simple layers
3. Complete wikitext parser integration
4. Set up proper build environment
5. Basic integration testing

### Phase 2: Enhanced Backend (2-3 weeks)  
**Goal:** Robust production-ready backend

1. Complete ThumbnailRenderer implementation
2. Enhanced API endpoints with validation
3. Security hardening and performance optimization
4. Comprehensive PHP testing
5. Database optimization

### Phase 3: Advanced Features (3-4 weeks)
**Goal:** Professional-grade editing capabilities

1. Advanced drawing tools and effects
2. Mobile interface development
3. JavaScript testing framework
4. User documentation
5. Performance optimization

### Phase 4: Production Polish (1-2 weeks)
**Goal:** Ready for public release

1. Cross-browser compatibility testing
2. Security audit
3. Performance benchmarking
4. Extension packaging
5. Release documentation

## 🔧 IMMEDIATE NEXT STEPS (This Week)

1. **Set up proper development environment**
   - Resolve Composer dependency conflicts
   - Install missing vendor packages
   - Verify MediaWiki integration

2. **Fix critical ESLint violations**
   - Start with CanvasManager.js trailing spaces (auto-fix)
   - Resolve variable shadowing issues
   - Replace alert() calls with MediaWiki dialogs

3. **Begin ThumbnailRenderer implementation**
   - Research ImageMagick PHP integration
   - Design layer-to-command translation architecture
   - Create basic text layer rendering proof of concept

4. **Version alignment and documentation update**
   - Update extension.json version to match reality
   - Document current implementation status accurately
   - Create development workflow documentation

---

**Note:** This to-do list should be reviewed and updated weekly as development progresses. Priority levels may shift based on user feedback and technical discoveries during implementation.
