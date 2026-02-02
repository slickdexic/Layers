# Known Issues

**Last Updated:** February 2, 2026 (Comprehensive Critical Review v6)  
**Version:** 1.5.46

This document lists known issues and current gaps for the Layers extension.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical Bugs) | **0** | ‚úÖ None |
| P1 (High Priority) | **0** | Ì¥¥ ‚úÖ All Fixed |
| P2 (Medium Priority) | **2** | Ìø° Minor issues remaining |
| P3 (Low Priority) | **7** | Ìø¢ Minor issues |
| Feature Gaps | 4 | Planned |

---

## Ì¥¥ P1: High Priority Issues (0 Open - All Fixed)

### P1.1 ApiSlidesSave.php - Dead Code with Fatal Bugs

**Status:** Ì¥¥ ‚úÖ FIXED (DELETED)  
**Severity:** P1 (High)  
**Component:** Dead Code / API

**Issue:** `src/Api/ApiSlidesSave.php` exists in the repository but is NOT registered in `extension.json` APIModules. It contains 6+ fatal bugs:

| Line | Bug |
|------|-----|
| 68 | Wrong RateLimiter constructor (passes User, expects Config) |
| 69 | Wrong method name (isLimited() doesn't exist) |
| 75-77 | SlideNameValidator::validate() returns string, not ValidationResult |
| 87 | Wrong ServerSideLayerValidator constructor signature |
| 95 | getSanitizedData() doesn't exist, should be getData() |
| 128 | sanitizeColor() method not defined |
| 132 | saveSlide() method doesn't exist in LayersDatabase |

**Mitigating Factor:** Cannot be invoked (not registered in APIModules).

**Recommended Action:** Delete the file. Slide save is handled by `ApiLayersSave::executeSlideSave()`.

**Files:** `src/Api/ApiSlidesSave.php`

---

### P1.2 ApiSlideInfo.php - Dead Code with Fatal Bugs

**Status:** Ì¥¥ ‚úÖ FIXED (DELETED)  
**Severity:** P1 (High)  
**Component:** Dead Code / API

**Issue:** `src/Api/ApiSlideInfo.php` exists in the repository but is NOT registered in `extension.json` APIModules. It contains multiple fatal bugs:

| Line | Bug |
|------|-----|
| 66-68 | SlideNameValidator::validate() returns string, not ValidationResult |
| 67 | getMessage() called on string (doesn't exist) |
| 74 | getSlideByName() doesn't exist in LayersDatabase |

**Mitigating Factor:** Cannot be invoked (not registered in APIModules).

**Recommended Action:** Delete the file. Slide info is handled by `ApiLayersInfo::executeSlideRequest()`.

**Files:** `src/Api/ApiSlideInfo.php`

---

## Ìø° P2: Medium Priority Issues (2 Open)

### P2.1 Missing Boolean Properties in preserveLayerBooleans

**Status:** Ìø° ‚úÖ FIXED  
**Severity:** P2 (Medium)  
**Component:** ApiLayersInfo / Data Integrity

**Issue:** `preserveLayerBooleans()` only converts 7 of 12 boolean properties. Missing:
- `expanded`, `isMultiPath`, `strokeOnly`, `showUnit`, `showBackground`

**Impact:** False values for these properties may be lost during API JSON serialization.

**Files:** `src/Api/ApiLayersInfo.php` lines 365-368

---

### P2.2 InlineTextEditor Not in CanvasManager Destroy List

**Status:** Ìø° ‚úÖ FIXED  
**Severity:** P2 (Medium)  
**Component:** CanvasManager / Memory Leak

**Issue:** The `inlineTextEditor` controller is initialized but NOT included in the `controllersToDestroy` array, causing a memory leak.

**Files:** `resources/ext.layers.editor/CanvasManager.js` lines 1957-1973

---

### P2.3 ApiLayersRename Lacks Slide Support

**Status:** Ìø° ‚úÖ FIXED  
**Severity:** P2 (Medium)  
**Component:** ApiLayersRename / Feature Gap

**Issue:** Unlike other API modules (Save, Info, Delete), the Rename module does not support slides.

**Impact:** Cannot rename named layer sets on slides.

**Files:** `src/Api/ApiLayersRename.php`

---

### P2.4 Documentation Version Inconsistencies

**Status:** Ìø° ‚úÖ FIXED  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Several files have outdated version numbers (1.5.45 instead of 1.5.46):
- `Mediawiki-Extension-Layers.mediawiki`
- `wiki/Home.md`
- `.github/copilot-instructions.md`

---

### P2.5 Font Family Validation Too Restrictive

**Status:** Ìø° OPEN  
**Severity:** P2 (Medium)  
**Component:** ServerSideLayerValidator

**Issue:** Font validation requires fonts to be in `$wgLayersDefaultFonts` (defaults to ['Arial', 'sans-serif']). Standard fonts like Georgia, Courier New are rejected.

**Impact:** Potential data loss for layers using common fonts.

**Files:** `src/Validation/ServerSideLayerValidator.php` lines 500-506

---

### P2.6 wiki/Changelog.md Missing v1.5.46

**Status:** Ìø° ‚úÖ FIXED (Already Synced)  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** Main CHANGELOG.md has v1.5.46 but wiki/Changelog.md starts at v1.5.45.

---

### P2.7 Branch Version Table Inconsistencies

**Status:** Ìø° OPEN  
**Severity:** P2 (Medium)  
**Component:** Documentation

**Issue:** REL1_43 and REL1_39 version references are inconsistent across documentation.

---

## Ìø¢ P3: Low Priority Issues (10 Open)

### P3.1 Inconsistent API Error Codes

**Files:** Multiple API modules

Different modules use different error codes for `ERROR_FILE_NOT_FOUND`:
- ApiLayersSave: `'filenotfound'`
- ApiLayersDelete: `'invalidfilename'`
- ApiLayersRename: `'invalidfilename'`

---

### P3.2 Undocumented Rate Limit Keys

**Status:** ‚úÖ FIXED - Documented in wiki/Configuration-Reference.md and wiki/API-Reference.md

**Files:** `src/Api/ApiLayersRename.php`

**Status:** ‚úÖ FIXED - Documented in wiki/Configuration-Reference.md and wiki/API-Reference.md

The `editlayers-rename` rate limit key is used but not documented.

**Status:** ‚úÖ FIXED - Documented in wiki/Configuration-Reference.md and wiki/API-Reference.md

---

### P3.3 Text Sanitizer May Corrupt Keywords

**Files:** `src/Validation/TextSanitizer.php` lines 116-124

JS keywords are now neutralized with zero-width space instead of removed (preserves text while preventing execution).

---

### P3.4 SchemaManager Global Service Access

Uses `MediaWikiServices::getInstance()` in constructor, making unit testing harder.

---

### P3.5 Hardcoded Transaction Timeout Values

3 retries, 5000ms timeout hardcoded in LayersDatabase. Could be configurable.

---

### P3.6 TINYINT for ls_layer_count Column

Max 255; should be smallint for future-proofing.

---

### P3.7-P3.10 Documentation Line Count Discrepancies

Multiple documentation files have minor line count discrepancies (1-10 lines) for god class files. Acceptable as line counts change frequently.

---

## ‚è≥ Feature Gaps

### F1. Custom Fonts

**Status:** ‚è≥ NOT STARTED

Not yet available beyond the default font allowlist in `$wgLayersDefaultFonts`.

---

### F2. Enhanced Dimension Tool

**Status:** ‚è≥ PROPOSED

Make the dimension line draggable independently from the anchor points.

---

### F3. Angle Dimension Tool

**Status:** ‚è≥ PROPOSED

New tool for measuring and annotating angles.

---

### F4. Slide Rename Support [COMPLETED]

**Status:** ‚è≥ ‚úÖ FIXED

ApiLayersRename needs slide support to match other API modules.

---

## ‚úÖ Previously Resolved Issues

All issues from previous reviews (v1-v5) remain resolved. See previous review versions for details.

---

## Test Coverage Status (February 2, 2026)

| Metric | Value | Status |
|--------|-------|---------|
| Tests total | **11,157** (163 suites) | ‚úÖ |
| Tests passing | **11,157** | ‚úÖ All pass |
| Tests failing | **0** | ‚úÖ |
| Statement coverage | **95.44%** | ‚úÖ Excellent |
| Branch coverage | **85.20%** | ‚úÖ Good |
| Function coverage | **93.75%** | ‚úÖ Excellent |
| Line coverage | **95.56%** | ‚úÖ Excellent |

---

## Code Quality Metrics (Verified February 2, 2026)

| Metric | Value | Status |
|--------|-------|--------|
| JavaScript files | **141** (139 source + 2 dist) | ‚úÖ |
| PHP files | **42** | ‚úÖ |
| God classes (‚â•1,000 lines) | **18** | 2 generated, 14 JS, 2 PHP |
| ESLint disables | 11 | All legitimate |
| i18n messages | **667** | All documented |
| TODO/FIXME/HACK | 0 | ‚úÖ Clean |
| console.log in production | 0 | ‚úÖ Clean |
| Dead code files | 2 | ApiSlidesSave, ApiSlideInfo |

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ‚úÖ Fully supported |
| Firefox | 120+ | ‚úÖ Fully supported |
| Safari | 17+ | ‚úÖ Fully supported |
| Edge | 120+ | ‚úÖ Fully supported |

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
   - Console errors (F12 ‚Üí Console tab)
   - Screenshots if applicable

---

*Document updated: February 2, 2026 (Comprehensive Critical Review v6)*  
*Status: 2 P1 issues, 7 P2 issues, 10 P3 issues.*
