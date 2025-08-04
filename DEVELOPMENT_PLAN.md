# Layers MediaWiki Extension - Strategic Development Plan

## Executive Summary

The Layers extension is a complex, feature-rich image annotation system for MediaWiki. This plan outlines a phased approach to development, prioritizing core functionality first, then building advanced features incrementally. The project is estimated to require 6-12 months of development with proper testing and documentation.

---

## Phase 1: Foundation & Core Infrastructure (Weeks 1-4)

### 1.1 Database Schema & Core API
**Priority: Critical**
- [ ] Create database migration scripts for `layer_sets`, `layer_assets`, `layer_set_usage` tables
- [ ] Implement basic CRUD operations for layer data
- [ ] Create JSON schema validation system
- [ ] Set up configuration variables in `extension.json`
- [ ] Implement basic security and sanitization

**Deliverables:**
- Database tables created
- Basic API endpoints: `ApiLayersSave`, `ApiLayersInfo`
- Configuration system working
- Basic JSON validation

### 1.2 File Integration Points
**Priority: Critical**
- [ ] Hook into `FilePageTabs` to add "Edit Layers" tab
- [ ] Extend file parser to recognize `layers=` parameter
- [ ] Create basic file-layer association system
- [ ] Implement side-car JSON storage in `$wgUploadDirectory/layers/`

**Deliverables:**
- File pages show "Edit Layers" tab
- Basic wikitext syntax `[[File:Example.jpg|layers=on]]` works
- JSON files stored and retrieved correctly

### 1.3 Basic Editor UI Framework
**Priority: High**
- [ ] Set up ResourceLoader modules for editor dependencies
- [ ] Create basic HTML structure for editor interface
- [ ] Integrate Fabric.js canvas system
- [ ] Implement basic toolbar structure
- [ ] Create layers panel with show/hide functionality

**Deliverables:**
- Editor opens when "Edit Layers" clicked
- Canvas displays base image
- Basic layer list visible
- Save/cancel buttons functional

---

## Phase 2: Core Editing Features (Weeks 5-8)

### 2.1 Text Layer Implementation
**Priority: Critical**
- [ ] Text tool with font, size, color selection
- [ ] Text positioning and editing
- [ ] Font loading and management system
- [ ] Text styling options (bold, italic, stroke, shadow)
- [ ] Undo/redo system for text operations

**Deliverables:**
- Users can add, edit, move, and style text layers
- Text appears correctly on both editor and rendered output

### 2.2 Basic Shape Tools
**Priority: High**
- [ ] Rectangle/square tool
- [ ] Circle/ellipse tool
- [ ] Line tool with stroke options
- [ ] Arrow tool (single-headed initially)
- [ ] Color picker integration
- [ ] Stroke width and style options

**Deliverables:**
- Users can draw basic shapes on images
- Shapes have customizable appearance
- Shapes can be selected, moved, and resized

### 2.3 Layer Management Core
**Priority: High**
- [ ] Layer creation, naming, deletion
- [ ] Layer visibility toggle (eye icon)
- [ ] Layer selection and highlighting
- [ ] Basic layer reordering (drag-drop)
- [ ] Layer properties panel

**Deliverables:**
- Full layer management in left panel
- Properties update when layers selected
- Layer order affects rendering

---

## Phase 3: Advanced Editing & Rendering (Weeks 9-12)

### 3.1 Advanced Shape Tools
**Priority: Medium**
- [ ] Double-headed arrows
- [ ] Polygon tool
- [ ] Free-hand drawing/pen tool
- [ ] Highlighter with transparency
- [ ] Call-out bubbles with pointers

**Deliverables:**
- Complete shape toolkit available
- All shapes work consistently with styling system

### 3.2 Thumbnail Generation System
**Priority: High**
- [ ] Server-side image composition using ImageMagick
- [ ] SVG overlay support using librsvg
- [ ] Thumbnail caching system
- [ ] Integration with MediaWiki's transform pipeline
- [ ] Performance optimization for large images

**Deliverables:**
- Images with layers render correctly in articles
- Thumbnails generated efficiently
- Caching prevents performance issues

### 3.3 Enhanced Layer Features
**Priority: Medium**
- [ ] Layer locking functionality
- [ ] Layer grouping system
- [ ] Opacity controls per layer
- [ ] Transform tools (rotate, scale, flip)
- [ ] Keyboard shortcuts system

**Deliverables:**
- Advanced layer manipulation available
- Keyboard shortcuts improve workflow efficiency

---

## Phase 4: Wikitext Integration & Advanced Features (Weeks 13-16)

### 4.1 Complete Wikitext Syntax
**Priority: High**
- [ ] Implement layer set naming and ID system
- [ ] Selective layer rendering (`+roads,-labels` syntax)
- [ ] Parser functions: `{{#layerlist}}`, `{{#layeredit}}`
- [ ] Legacy binary overlay mode support
- [ ] Error handling for invalid syntax

**Deliverables:**
- All documented wikitext syntax works
- Parser functions available for advanced users
- Backwards compatibility maintained

### 4.2 Layer Library System
**Priority: Medium**
- [ ] Library asset storage in `Layer:` namespace
- [ ] Asset import/export functionality
- [ ] Asset preview and management UI
- [ ] Reusable layer templates
- [ ] Asset sharing permissions

**Deliverables:**
- Users can save and reuse layer sets
- Library management interface functional
- Asset permissions properly enforced

### 4.3 Revision History System
**Priority: Medium**
- [ ] Layer set versioning system
- [ ] History viewing interface
- [ ] Diff visualization for layer changes
- [ ] Rollback functionality
- [ ] Integration with MediaWiki history

**Deliverables:**
- Complete revision tracking for layer changes
- Users can view and revert to previous versions

---

## Phase 5: Polish & Production Readiness (Weeks 17-20)

### 5.1 Internationalization & Accessibility
**Priority: High**
- [ ] Complete i18n implementation for all UI strings
- [ ] RTL language support
- [ ] Screen reader compatibility
- [ ] Keyboard-only editing workflow
- [ ] Alt text support for text layers
- [ ] Contrast checking for text

**Deliverables:**
- Extension fully translatable
- WCAG 2.1 AA compliance achieved
- RTL languages fully supported

### 5.2 Performance Optimization
**Priority: High**
- [ ] Client-side performance optimization
- [ ] Server-side caching improvements
- [ ] Large file handling optimization
- [ ] Memory usage optimization
- [ ] Database query optimization
- [ ] Progressive loading for complex layer sets

**Deliverables:**
- Extension performs well with large images
- No significant impact on MediaWiki performance

### 5.3 Security Hardening
**Priority: Critical**
- [ ] Complete input sanitization audit
- [ ] CSRF protection verification
- [ ] Rate limiting implementation
- [ ] Permission system audit
- [ ] SVG sanitization for icons
- [ ] File upload security

**Deliverables:**
- Security audit passed
- No known vulnerabilities
- Proper rate limiting in place

---

## Phase 6: Documentation & Deployment (Weeks 21-24)

### 6.1 Documentation
**Priority: High**
- [ ] Administrator installation guide
- [ ] User manual with screenshots
- [ ] Developer API documentation
- [ ] Configuration reference
- [ ] Troubleshooting guide
- [ ] Migration guides

### 6.2 Testing & Quality Assurance
**Priority: Critical**
- [ ] Comprehensive unit test suite
- [ ] Integration tests for all major features
- [ ] Browser compatibility testing
- [ ] Performance testing with various image sizes
- [ ] Security penetration testing
- [ ] User acceptance testing

### 6.3 Deployment Preparation
**Priority: High**
- [ ] Installation automation scripts
- [ ] Update/migration scripts
- [ ] Monitoring and logging setup
- [ ] Backup and recovery procedures
- [ ] Production deployment checklist

---

## Technical Architecture Decisions

### Core Technologies
- **Frontend:** Fabric.js for canvas manipulation
- **UI Framework:** OOUI for consistency with MediaWiki
- **Color Picker:** Coloris (lightweight)
- **Tooltips:** Tippy.js
- **Backend:** PHP 7.4+ with MediaWiki 1.35+
- **Storage:** JSON side-car files + MySQL tables
- **Image Processing:** ImageMagick + librsvg

### Key Design Principles
1. **Non-destructive:** Original files never modified
2. **Performance First:** Lazy loading, efficient caching
3. **Progressive Enhancement:** Works without JavaScript for viewing
4. **Accessibility:** Full keyboard navigation, screen reader support
5. **Security:** All inputs sanitized, proper permission checking
6. **Scalability:** Efficient for large wikis with many images

---

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Performance with Large Images**
   - Mitigation: Progressive loading, client-side optimization
2. **Browser Compatibility**
   - Mitigation: Comprehensive testing, graceful degradation
3. **Security Vulnerabilities**
   - Mitigation: Regular security audits, input validation
4. **Complex UI/UX**
   - Mitigation: User testing, iterative design improvements

### Medium-Risk Areas
1. **Integration Complexity**
   - Mitigation: Thorough testing with various MediaWiki setups
2. **Migration Challenges**
   - Mitigation: Comprehensive migration scripts and documentation

---

## Resource Requirements

### Development Team
- **1 Senior PHP Developer** (MediaWiki expertise)
- **1 Frontend Developer** (JavaScript/Canvas experience)
- **1 UI/UX Designer** (part-time)
- **1 QA Engineer** (testing and documentation)

### Infrastructure
- **Development Environment:** MediaWiki test installation
- **Testing:** Multiple browser environments
- **Storage:** Development file storage for testing

---

## Success Metrics

### Technical Metrics
- Load time impact: < 100ms additional page load
- Memory usage: < 50MB additional per edit session
- Browser support: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile compatibility: Basic viewing on mobile devices

### User Experience Metrics
- Learning curve: New users productive within 15 minutes
- Feature adoption: 80% of users utilize basic annotation tools
- Error rate: < 5% of save operations fail
- User satisfaction: > 4.0/5.0 rating in user surveys

---

## Conclusion

This development plan provides a structured approach to building a sophisticated image annotation system for MediaWiki. The phased approach ensures core functionality is delivered early while allowing for iterative improvement of advanced features. Success depends on maintaining focus on performance, security, and user experience throughout the development process.

The plan is ambitious but achievable with proper resource allocation and adherence to the outlined timeline and priorities.
