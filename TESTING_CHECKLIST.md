# Implementation Testing Checklist - Layers Extension

## Pre-Installation Requirements ✓

### System Requirements
- [ ] MediaWiki 1.44+ installed and running
- [ ] PHP 7.4+ with required extensions
- [ ] ImageMagick 6.9+ installed and accessible
- [ ] Modern browser (Chrome 80+, Firefox 75+, Safari 13+)

### Installation Verification
- [ ] Extension files extracted to `extensions/Layers/`
- [ ] `wfLoadExtension( 'Layers' );` added to LocalSettings.php
- [ ] Database update completed: `php maintenance/update.php`
- [ ] No PHP errors in logs after installation

## Core Functionality Testing

### 1. Database Integration ✅
- [ ] Layer sets table exists and is accessible
- [ ] Layer assets table exists and is accessible  
- [ ] API endpoints respond without errors
- [ ] User permissions are correctly applied

### 2. File Page Integration 🔄
- [ ] "Edit Layers" tab appears on file pages
- [ ] Tab is only visible to users with `editlayers` permission
- [ ] Clicking tab opens editor interface
- [ ] Editor loads with background image visible

### 3. Editor Interface 🔄
- [ ] Toolbar displays all drawing tools
- [ ] Layer panel shows on left side
- [ ] Canvas displays uploaded image correctly
- [ ] All UI elements are properly styled

### 4. Drawing Tools ❌ (Need Implementation)
- [ ] **Pointer tool**: Select and move existing layers
- [ ] **Text tool**: Click to add text, edit properties
- [ ] **Rectangle tool**: Click and drag to create rectangles
- [ ] **Circle tool**: Click and drag to create circles
- [ ] **Line tool**: Click and drag to create lines
- [ ] **Arrow tool**: Click and drag to create arrows
- [ ] **Highlight tool**: Click and drag to create highlights

### 5. Layer Management 🔄
- [ ] Layers appear in layer panel after creation
- [ ] Layer visibility toggle works (eye icon)
- [ ] Layer deletion works (trash icon)
- [ ] Layer selection highlights properly
- [ ] Layer reordering via drag and drop

### 6. Persistence ✅
- [ ] Save button saves layers to database
- [ ] Saved layers reload when reopening editor
- [ ] Layer data survives browser refresh
- [ ] Multiple layer sets per image supported

### 7. Undo/Redo System ✅
- [ ] Ctrl+Z undoes last action
- [ ] Ctrl+Y redoes undone action
- [ ] Undo stack limited to 50 operations
- [ ] UI buttons reflect undo/redo availability

### 8. Keyboard Shortcuts 🔄
- [ ] V - Select pointer tool
- [ ] T - Select text tool
- [ ] R - Select rectangle tool
- [ ] C - Select circle tool
- [ ] A - Select arrow tool
- [ ] L - Select line tool
- [ ] H - Select highlight tool
- [ ] Delete - Delete selected layer
- [ ] Ctrl+S - Save layers
- [ ] Escape - Cancel editing

## Integration Testing

### 9. Wikitext Integration ❌ (Critical Missing)
- [ ] `[[File:Example.jpg|layers=on]]` displays layered image
- [ ] Server-side thumbnail generation works
- [ ] Cached thumbnails update when layers change
- [ ] Performance acceptable for typical image sizes

### 10. API Security ✅
- [ ] CSRF token required for save operations
- [ ] Input validation prevents XSS attacks
- [ ] File path validation prevents directory traversal
- [ ] Rate limiting prevents abuse

### 11. Error Handling 🔄
- [ ] Graceful handling of missing images
- [ ] Proper error messages for save failures
- [ ] Recovery from network connectivity issues
- [ ] Browser compatibility fallbacks

## Performance Testing

### 12. Image Size Limits 🔄
- [ ] Large images (>2MB) load without freezing browser
- [ ] Memory usage stays reasonable (<200MB)
- [ ] Canvas rendering remains responsive
- [ ] Server-side rendering completes within timeout

### 13. Layer Complexity 🔄
- [ ] 50+ layers can be managed without lag
- [ ] Complex shapes render smoothly
- [ ] Undo/redo remains fast with many layers
- [ ] Save operations complete within 5 seconds

## Browser Compatibility

### 14. Cross-Browser Testing ❌
- [ ] Chrome (latest): Full functionality
- [ ] Firefox (latest): Full functionality  
- [ ] Safari (latest): Full functionality
- [ ] Edge (latest): Full functionality
- [ ] Mobile browsers: Basic functionality or graceful degradation

## Regression Testing

### 15. MediaWiki Integration ✅
- [ ] Extension doesn't break existing MediaWiki features
- [ ] No conflicts with other extensions
- [ ] File uploads still work normally
- [ ] Category pages display correctly

## User Experience Testing

### 16. Usability ❌ (Need Real Users)
- [ ] New users can create basic layers within 2 minutes
- [ ] Drawing tools feel intuitive and responsive
- [ ] Layer management is discoverable
- [ ] Error messages are helpful and actionable

### 17. Accessibility 🔄
- [ ] Keyboard-only navigation works
- [ ] Screen reader compatibility
- [ ] High contrast mode support
- [ ] Focus indicators visible

## Production Readiness Checklist

### 18. Documentation ✅
- [ ] Installation guide complete and tested
- [ ] User documentation covers all features
- [ ] API documentation for developers
- [ ] Troubleshooting guide available

### 19. Monitoring & Logging 🔄
- [ ] Error logging configured
- [ ] Performance metrics tracked
- [ ] User activity monitoring (optional)
- [ ] Automated backup of layer data

### 20. Security Review ✅
- [ ] Input validation comprehensive
- [ ] Output sanitization complete
- [ ] Permission system properly implemented
- [ ] No obvious attack vectors

## Test Results Summary

### ✅ Fully Implemented (7/20)
- Database Integration
- File Page Framework  
- Persistence
- Undo/Redo System
- API Security
- MediaWiki Integration
- Documentation

### 🔄 Partially Implemented (8/20)
- File Page Integration (tab exists, editor loads)
- Editor Interface (UI complete, tools need work)
- Layer Management (framework done)
- Keyboard Shortcuts (some work)
- Error Handling (basic level)
- Performance limits (not fully tested)
- Accessibility (basic support)
- Monitoring (basic logging)

### ❌ Critical Missing (5/20)
- **Drawing Tools** (Most Important)
- **Wikitext Integration** (Blocking)
- **Browser Testing** (Required for production)
- **User Testing** (Required for polish)

## Priority Implementation Order

1. **CRITICAL**: Complete canvas drawing tools implementation
2. **CRITICAL**: Server-side thumbnail rendering integration  
3. **HIGH**: Cross-browser compatibility testing
4. **HIGH**: Complete layer management features
5. **MEDIUM**: Performance optimization and testing
6. **MEDIUM**: User experience testing and refinement
7. **LOW**: Advanced features and accessibility improvements

## Estimated Time to Production

- **Drawing Tools**: 2-3 weeks
- **Thumbnail Integration**: 1-2 weeks
- **Testing & Polish**: 2-3 weeks
- **Total**: 5-8 weeks to production-ready state

The foundation is solid, but the core drawing functionality needs completion before this extension provides real value to users.
