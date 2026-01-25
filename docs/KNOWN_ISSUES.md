# Known Issues

**Last Updated:** January 24, 2026  
**Version:** 1.5.29

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None known |
| P1 (Stability) | 0 | ✅ No known crashes/memory leaks |
| P2 (Code Quality) | 1 | ⚠️ ShapeLibraryPanel coverage |
| Feature Gaps | 2 | ⏳ Planned |

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

No built-in search/filter for large layer sets.

### F3. Custom Fonts

Not yet available beyond the default font allowlist.

---

## ✅ Recently Resolved Issues

All previously identified P0 and P1 issues have been resolved:

- ✅ Rate limiting on delete/rename APIs
- ✅ CSP blocking on File pages
- ✅ Background visibility serialization (PHP→JS boolean handling)
- ✅ Memory leak fixes (timer cleanup in destroy methods)
- ✅ ContextMenuController event listener cleanup
- ✅ Export filename sanitization
- ✅ CanvasManager async race conditions

---

## Test Coverage Status (January 24, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests passing | **10,574** (156 suites) | ✅ |
| Statement coverage | **94.40%** | ✅ Excellent |
| Branch coverage | **84.80%** | ✅ Good |
| Function coverage | **92.52%** | ✅ Excellent |
| Line coverage | **94.54%** | ✅ Excellent |

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

*Document updated: January 24, 2026*  
*Status: ✅ Production-ready with excellent test coverage (94.40%, 10,574 tests).*
