# Known Issues

**Last Updated:** January 21, 2026  
**Version:** 1.5.19

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ✅ None known |
| P1 (Stability) | 0 | ✅ No known crashes/memory leaks |
| P2 (Code Quality) | 2 | ⚠️ Active items (low priority) |
| Feature Gaps | 3 | ⏳ Planned |

---

## ⚠️ P2: Code Quality Issues

### P2.1 Jest Console Noise

**Status:** OPEN  
**Severity:** LOW  
**Evidence:** `coverage_output.txt` contains `jsdom` warnings for `window.location` and `window.prompt`.

**Impact:** Cosmetic only — noisy test output but all 9,753 tests pass.

**Suggested Fix:** Mock these in test setup files.

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

Large layer sets (50+) can cause UI slowdowns. Virtual scrolling would help.

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

## Test Coverage Status (January 21, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| Tests passing | **9,753** (152 suites) | ✅ |
| Statement coverage | **93.52%** | ✅ Excellent |
| Branch coverage | **83.89%** | ✅ Good |
| Function coverage | **91.37%** | ✅ Excellent |
| Line coverage | **93.68%** | ✅ Excellent |

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

*Document updated: January 21, 2026*  
*Status: ✅ Production-ready with excellent test coverage (93.52%, 9,753 tests).*
