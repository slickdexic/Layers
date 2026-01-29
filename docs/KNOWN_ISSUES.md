# Known Issues

**Last Updated:** January 29, 2026  
**Version:** 1.5.39

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None known |
| P1 (Data Loss) | 0 | ✅ Text editing commit fixed |
| P2 (Functional) | 1 | 🔴 Slides in tables empty |
| P3 (UX Polish) | 3 | 🟡 Overlay buttons, handles, cursors |
| Feature Gaps | 3 | ⏳ Planned (F3, F6, F7) |

---

## ⚠️ P2: Code Quality Issues

### P2.1 Jest Console Noise

**Status:** ✅ RESOLVED (January 21, 2026)  
**Severity:** LOW  

jsdom "Not implemented" warnings for navigation and prompt have been suppressed in `tests/jest/setup.js`. Test output is now clean.

---

### P2.2 ShapeLibraryPanel Coverage Gap

**Status:** ✅ RESOLVED (January 26, 2026)  
**Severity:** LOW  
**Evidence:** Coverage output shows 0% for `ShapeLibraryPanel.js`.

**Solution Applied:** Added comprehensive Playwright E2E tests in `tests/e2e/shape-library.spec.js` (~400 lines) covering:
- Panel open/close (button, Escape, overlay click)
- Category navigation (10 categories)
- Shape search (1,310 shapes)
- Shape insertion onto canvas
- Accessibility (ARIA, keyboard navigation)
- Visual regression checks

---

## ⏳ Feature Gaps

### F1. Layer List Virtualization

**Status:** ✅ COMPLETED (January 21, 2026)

Virtual scrolling implemented for layer lists with 30+ items. The layer panel now only renders visible layers plus a buffer, preventing UI slowdowns with large layer counts.

### F2. Layer Search/Filter

**Status:** ✅ COMPLETED (January 25, 2026)

Layer search/filter functionality implemented with:
- Search input at top of layer panel
- Real-time filtering by layer name or text content
- "Showing N of M layers" count display
- Clear button to reset filter
- Full dark mode support

### F3. Custom Fonts

Not yet available beyond the default font allowlist.

### ~~F4. Lowercase Slide Parser Function (FR-12)~~ ✅

**Status:** ✅ COMPLETED (January 25, 2026)

Both `{{#slide: ...}}` and `{{#Slide: ...}}` are now supported, matching MediaWiki conventions.

### F5. Zoom to Mouse Pointer (FR-13)

**Status:** ✅ COMPLETED (January 26, 2026)

Zoom now anchors at the mouse pointer position (or pinch point on mobile), matching standard behavior in Figma, Illustrator, and other design tools. Implemented via `zoomBy()` in ZoomPanController.js with proper anchor point calculation.

### F6. Enhanced Dimension Tool (FR-14)

**Status:** ⏳ PROPOSED (January 25, 2026)

Make the dimension line draggable independently from the anchor points. Add leader length property to control extension beyond the dimension line.

### F7. Angle Dimension Tool (FR-15)

**Status:** ⏳ PROPOSED (January 25, 2026)

New tool for measuring and annotating angles with three anchor points (endpoint1, vertex, endpoint2), arc dimension line, and extension lines.

---

## 🐛 Open Issues

### P3. Overlay Buttons Too Large

**Status:** 🟡 OPEN (January 29, 2026)  
**Severity:** P3 (UX Polish)  
**Component:** ViewerOverlay

**Issue:** The hover overlay buttons (edit/view) on layered images are too large. They should be reduced to approximately 75% of their current size for better visual balance.

**Files:** `resources/ext.layers/viewer/ViewerOverlay.js`, overlay CSS

### P3. Drag Handle Hit Areas Too Small

**Status:** 🟡 OPEN (January 29, 2026)  
**Severity:** P3 (UX Polish)  
**Component:** SelectionHandles, HitTestController

**Issue:** The target areas for resize/rotation drag handles require too precise positioning. Users must position the cursor exactly on the small square handles rather than having a reasonable tolerance zone around them. This makes grabbing handles frustrating, especially on high-DPI displays.

**Recommendation:** Increase hit test tolerance to 8-12 pixels around handles.

### P3. Mouse Cursor Not Rotated for Rotated Objects

**Status:** 🟡 OPEN (January 29, 2026)  
**Severity:** P3 (UX Polish)  
**Component:** SelectionHandles

**Issue:** When selecting a rotated object, the resize cursors (nw-resize, ne-resize, etc.) do not rotate to match the object's rotation. This creates a visual disconnect where the cursor arrow direction doesn't match the actual resize direction.

**Expected:** Cursor direction should rotate to match the object's rotation angle, similar to Figma, Illustrator, and other design tools.

**Files:** `resources/ext.layers.editor/SelectionHandles.js` (getCursor method)

### P2. Slides Inside Tables Display as Empty Until Editor Opened

**Status:** 🔴 OPEN (January 29, 2026)  
**Severity:** P2 (Functional Bug)  
**Component:** SlideController, Viewer initialization

**Issue:** When slides are embedded inside wiki table cells, they display as "empty slide" and do not render their content. Hard-refreshing the page does not fix the issue. However, opening and closing the editor while on the page causes them to display correctly. Slides outside of tables on the same page render normally.

**Likely Cause:** The slide initialization may run before table DOM is fully parsed, or IntersectionObserver-based lazy loading fails for elements inside tables.

**Workaround:** Open and close the Layers editor on the page to trigger re-initialization.

**Files:** `resources/ext.layers.slides/SlideController.js`, `resources/ext.layers/init.js`

---

## ✅ Recently Resolved Issues

All previously identified P0 and P1 issues have been resolved:

- ✅ **Text edits lost when clicking outside canvas** (January 29, 2026)
  - Added guard in LayerPanel.selectLayer() to commit inline text editing before selection change
  - Synchronously calls finishEditing(true) to preserve text before changing layers
  - Added test coverage for the new behavior
- ✅ **PHP 8.4 strict_types compatibility** (January 25, 2026)
  - Fixed `ColorValidator::isValidHexColor()` returning int instead of bool
  - Added `(int)` casts to config->get() calls for integer values
  - Fixed canvas snap not accounting for shadow/stroke expansion
- ✅ **DraftManager auto-save** (January 25, 2026)
  - Added auto-save to localStorage every 30 seconds
  - Shows recovery dialog on editor open with unsaved drafts
  - Clears draft on successful save
- ✅ **Set selector race condition** (January 25, 2026)
  - Added pending operation state to prevent concurrent operations
- ✅ Rate limiting on delete/rename APIs
- ✅ CSP blocking on File pages
- ✅ Background visibility serialization (PHP→JS boolean handling)
- ✅ Memory leak fixes (timer cleanup in destroy methods)
- ✅ ContextMenuController event listener cleanup
- ✅ Export filename sanitization
- ✅ CanvasManager async race conditions

---

## Test Coverage Status (January 29, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests passing | **11,062** (163 suites) | ✅ |
| Statement coverage | **95.37%** | ✅ Excellent |
| Branch coverage | **84.92%** | ✅ Good |
| Function coverage | **93.00%** | ✅ Excellent |
| Line coverage | **95.50%** | ✅ Excellent |

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✅ Fully supported |
| Firefox | 120+ | ✅ Fully supported |
| Safari | 17+ | ✅ Fully supported |
| Edge | 120+ | ✅ Fully supported |

---

## Performance Recommendations

| Resource | Recommended | Maximum |
|----------|-------------|---------|
| Image size | < 2048px | 4096px |
| Layer count | < 50 | 100 |
| Layer set size | < 1MB | 2MB |
| Imported image size | < 500KB | 1MB |

---

## Reporting Issues

If you encounter issues:

1. Check this document first
2. Search existing [GitHub issues](https://github.com/slickdexic/Layers/issues)
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and MediaWiki version
   - Console errors (F12 → Console tab)
   - Screenshots if applicable

---

*Document updated: January 29, 2026*  
*Status: ✅ Production-ready with excellent test coverage (95.37%, 11,062 tests).*
