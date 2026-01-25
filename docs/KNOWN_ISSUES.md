# Known Issues

**Last Updated:** January 25, 2026  
**Version:** 1.5.31

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None known |
| P1 (Stability) | 0 | ✅ No known crashes/memory leaks |
| P2 (Code Quality) | 1 | ⚠️ ShapeLibraryPanel coverage |
| Feature Gaps | 5 | ⏳ Planned |

---

## ⚠️ P2: Code Quality Issues

### P2.1 Jest Console Noise

**Status:** ✅ RESOLVED (January 21, 2026)  
**Severity:** LOW  

jsdom "Not implemented" warnings for navigation and prompt have been suppressed in `tests/jest/setup.js`. Test output is now clean.

---

### P2.2 ShapeLibraryPanel Coverage Gap

**Status:** OPEN  
**Severity:** LOW  
**Evidence:** Coverage output shows 0% for `ShapeLibraryPanel.js`.

**Impact:** UI regressions could slip through for shape library feature.

**Root Cause:** OOUI integration makes unit testing difficult.

**Suggested Fix:** Add E2E tests via Playwright rather than Jest unit tests.

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

### F4. Lowercase Slide Parser Function (FR-12)

**Status:** ⏳ PROPOSED (January 25, 2026)

Add backwards compatibility with lowercase `{{#slide: ...}}` syntax to match MediaWiki conventions. Currently only `{{#Slide:}}` (capitalized) is supported.

### F5. Zoom to Mouse Pointer (FR-13)

**Status:** ⏳ PROPOSED (January 25, 2026)

Zoom should anchor at the mouse pointer position (or pinch point on mobile), not the top-left corner. This is standard behavior in Figma, Illustrator, and most design tools.

### F6. Enhanced Dimension Tool (FR-14)

**Status:** ⏳ PROPOSED (January 25, 2026)

Make the dimension line draggable independently from the anchor points. Add leader length property to control extension beyond the dimension line.

### F7. Angle Dimension Tool (FR-15)

**Status:** ⏳ PROPOSED (January 25, 2026)

New tool for measuring and annotating angles with three anchor points (endpoint1, vertex, endpoint2), arc dimension line, and extension lines.

---

## ✅ Recently Resolved Issues

All previously identified P0 and P1 issues have been resolved:

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

## Test Coverage Status (January 25, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests passing | **10,643** (157 suites) | ✅ |
| Statement coverage | **94.17%** | ✅ Excellent |
| Branch coverage | **84.43%** | ✅ Good |
| Function coverage | **92.18%** | ✅ Excellent |
| Line coverage | **94.31%** | ✅ Excellent |

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

*Document updated: January 25, 2026*  
*Status: ✅ Production-ready with excellent test coverage (94.17%, 10,643 tests).*
