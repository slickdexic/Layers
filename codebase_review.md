# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 24, 2026 (Comprehensive Critical Audit v25)  
**Version:** 1.5.27  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 9,994 tests in 156 suites (all passing, verified January 24, 2026)
- **Coverage:** 92.17% statements, 82.45% branches (verified January 24, 2026)
- **JS files:** 126 (excludes `resources/dist/` and build scripts)
- **JS lines:** ~113,847 total
- **PHP files:** 33+

---

## Executive Summary

The Layers extension is a mature, feature-rich MediaWiki extension with **strong security practices** and **excellent test coverage**. This comprehensive critical audit identified **9 remaining issues** requiring attention, **5 issues that were previously fixed**, and several areas of technical debt.

**Overall Assessment:** **8.0/10** — Production-ready with high quality. The extension has matured significantly with recent fixes addressing race conditions, coverage gaps, and code quality issues.

### Key Strengths
- Excellent security model (CSRF, rate limiting, comprehensive validation)
- Good test coverage (92.17% statement, 82.45% branch)
- Well-documented with comprehensive inline comments
- Modern ES6 class-based architecture (100% migrated)
- Proper delegation patterns in large files
- Zero TODO/FIXME comments in production code
- No eval(), document.write(), or new Function() usage (security)
- 9 eslint-disable comments, all legitimate (8 no-alert, 1 no-control-regex)

### Critical Issues Summary (January 24, 2026)

| # | Issue | Severity | Status | Component |
|---|-------|----------|--------|-----------|
| CORE-1 | StateManager set() race condition | Medium | 🟡 By Design | Editor |
| CORE-2 | HistoryManager memory with large images | Medium | 🟢 Mitigated | Editor |
| CORE-3 | APIManager save race condition | High | ✅ **FIXED** | Editor |
| CORE-4 | GroupManager circular reference | High | ✅ **FIXED** | Editor |
| NEW-1 | ViewerManager.js coverage gap | High | ✅ **FIXED** (82.99%) | Viewer |
| NEW-2 | innerHTML usage patterns | Medium | ✅ **AUDITED** | Security |
| NEW-3 | console.log in production | Low | 🟢 Scripts Only | Code Quality |
| NEW-4 | localStorage quota handling | Low | ✅ **VERIFIED** | Robustness |
| NEW-5 | parseInt radix missing | Low | ✅ **FIXED** | Code Quality |
| NEW-6 | EmojiPickerPanel test coverage | Medium | ✅ **E2E ADDED** | Testing |
| NEW-7 | Error handling inconsistency | Medium | ✅ **DOCUMENTED** | Architecture |
| NEW-8 | Hardcoded i18n fallbacks | Low | 🔴 Open | i18n |
| NEW-9 | ShapeRenderer approaching limit | Low | 🟡 Watch | God Class |

### Test Coverage (January 24, 2026)
- ✅ **9,994 Jest tests passing** (156 suites)
- ✅ **92.17% statement coverage** (improved from 91.60%)
- ✅ **82.45% branch coverage** (improved from 82.09%)
- ✅ **ViewerManager has 82.99% coverage** (fixed from 63.73%)
- ✅ **EmojiPickerPanel has E2E tests** (Playwright integration tests added)

---

## 🔴 OPEN ISSUES

### NEW-8: Hardcoded i18n Fallbacks

**Severity:** Low  
**Category:** i18n  
**Files:** Various

**Description:** Some files use hardcoded English fallbacks for i18n strings as safety nets.

**Impact:** Low — fallbacks only trigger if message system fails.

**Recommendation:** Consider centralizing fallback logic.

---

## ✅ RECENTLY FIXED ISSUES

### NEW-5: parseInt Missing Radix Parameter ✅ FIXED

**Resolution Date:** January 24, 2026  
**Category:** Code Quality  
**Files:** ValidationHelpers.js, NumericValidator.js

**Description:** 9 `parseInt()` calls lacked the radix parameter.

**Resolution:** Added `, 10` radix parameter to all parseInt calls:
- ValidationHelpers.js: 8 occurrences fixed (RGB and HSL validation)
- NumericValidator.js: 1 occurrence fixed (polygon sides validation)

---

### NEW-6: EmojiPickerPanel Test Coverage Gap ✅ E2E ADDED

**Resolution Date:** January 24, 2026  
**Category:** Test Coverage  
**File:** [tests/e2e/emoji-picker.spec.js](tests/e2e/emoji-picker.spec.js)

**Description:** EmojiPickerPanel.js had low Jest coverage due to OOUI integration complexity.

**Resolution:** Created comprehensive Playwright E2E test suite with 17 tests covering:
- Opening/closing (button, Escape key, overlay click, close button)
- Panel structure (search input, categories, grid, ARIA dialog role)
- Category navigation
- Search functionality (including empty results)
- Emoji selection and layer creation
- Performance (lazy loading, rapid category switching)

---

### NEW-7: Error Handling Inconsistency ✅ DOCUMENTED

**Resolution Date:** January 24, 2026  
**Category:** Architecture

**Description:** Inconsistent error handling patterns across codebase.

**Resolution:** Added comprehensive error handling guidelines to CONTRIBUTING.md with:
- Three documented patterns (Log and Continue, Log and Reject, Validate and Return)
- Clear rules for when to use each pattern
- Examples from existing codebase

---

## ✅ PREVIOUSLY FIXED ISSUES

---

### NEW-7: Inconsistent Error Handling Patterns

**Severity:** Medium  
**Category:** Architecture  
**Files:** Various

**Description:** Error handling is inconsistent across the codebase:
- Some methods have try-catch blocks that log and continue
- Some methods throw errors up the call stack
- Some promise chains have `.catch()` that just logs
- SlideManager.js uses `mw.log.error` correctly for error logging

**Pattern Analysis:**
| Pattern | Files Using It | Risk |
|---------|---------------|------|
| Log and continue | PresetStorage, ColorPickerDialog | Low - graceful degradation |
| Propagate to caller | APIManager, StateManager | Good - lets caller handle |
| Swallow silently | Some UI callbacks | Medium - hidden failures |

**Impact:** Difficult to predict and test error behavior. Some errors may silently fail while others crash the editor.

**Recommendation:** 
1. Document error handling guidelines in CONTRIBUTING.md
2. Add an error boundary at top level of editor
3. Prefer the APIManager pattern: log, then reject with structured error

---

### NEW-8: Hardcoded i18n Fallback Strings

**Severity:** Low  
**Category:** i18n  
**Files:** Various

**Description:** Many files have hardcoded English fallback strings for i18n:

```javascript
// LayersEditorModal.js line 78
getMessage( 'layers-editor-modal-title', 'Edit layers' )

// EmojiPickerPanel.js line 93
mw.message( 'layers-emoji-not-loaded' ).text() || 'Emoji library not loaded'
```

While fallbacks are good practice, they should be extracted to a central location to ensure consistency and ease translation auditing.

**Recommendation:** 
1. Create a FallbackMessages.js constant file
2. Or rely on i18n/qqq.json documentation and trust mw.message()

---

### NEW-9: ShapeRenderer Approaching God Class Threshold

**Severity:** Low  
**Category:** Code Quality  
**File:** [resources/ext.layers.shared/ShapeRenderer.js](resources/ext.layers.shared/ShapeRenderer.js)

**Description:** ShapeRenderer.js is at ~994 lines, approaching the 1,000-line god class threshold.

**Current Status:** The file already delegates to PolygonStarRenderer for complex shape math.

**Recommendation:** Watch this file. If it grows beyond 1,000 lines, consider extracting:
- Gradient rendering (already has GradientRenderer)
- Blur effect rendering to EffectsRenderer
- Hit testing to a dedicated module

---

## ✅ RESOLVED ISSUES

### CORE-3: APIManager Save Race Condition ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** No tracking of save requests - rapid double-clicks could cause concurrent saves.

**Resolution:** Added `saveInProgress` flag to APIManager (line 46):
```javascript
// Prevent concurrent save operations (CORE-3 fix)
this.saveInProgress = false;
```

The save methods now check and set this flag appropriately.

---

### CORE-4: GroupManager Circular Reference ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** `moveToFolder()` only checked if layer equals folder, not if folderId is a descendant of layerId.

**Resolution:** Added `isDescendantOf()` check in moveToFolder() (line 326):
```javascript
// CORE-4 fix: Prevent circular references - don't allow moving a folder
// into one of its own descendants
if ( layer.type === 'group' && this.isDescendantOf( folderId, layerId, layers ) ) {
    return false;
}
```

---

### NEW-1: ViewerManager Coverage Gap ✅ FIXED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Issue:** ViewerManager.js had only 63.73% coverage.

**Resolution:** Added 23+ new tests for slide functionality. Coverage improved to **82.99%**.

Tested functionality:
- initializeSlideViewer
- setupSlideOverlay
- handleSlideEditClick
- handleSlideViewClick
- _createPencilIcon
- _createExpandIcon
- _msg helper

---

### NEW-2: innerHTML XSS Vectors ✅ AUDITED

**Status:** RESOLVED  
**Resolution Date:** January 24, 2026

**Audit Results:** All 20+ innerHTML usages were reviewed. **None use user-supplied data:**

| Usage Type | Count | Risk |
|------------|-------|------|
| Static SVG icons (hardcoded strings) | 12 | None |
| Unicode characters ('▼', '▶', '×') | 3 | None |
| i18n messages from mw.message() | 2 | None - MW sanitizes |
| Clear container (`innerHTML = ''`) | 3+ | None |

**Conclusion:** No XSS vulnerability present.

---

### NEW-3: console.log in Production ✅ VERIFIED

**Status:** NOT AN ISSUE  
**Verification Date:** January 24, 2026

**Finding:** All console.log/error statements in non-test code are in:
1. **Build scripts** (generate-library.js, sanitize-svgs.js) - Appropriate for CLI tools
2. **SlideManager.js** - Already uses `mw.log.error()` correctly

No production browser code uses console directly.

---

### NEW-4: localStorage Quota Handling ✅ VERIFIED

**Status:** ALREADY IMPLEMENTED  
**Verification Date:** January 24, 2026

**Finding:** All localStorage access already uses try/catch:
- **PresetStorage.js**: `save()` returns false on error
- **ColorPickerDialog.js**: `saveCustomColor()` catches and logs
- **ToolDropdown.js**: `saveMRU()` silently fails with try/catch

No additional action required.

---

## 🟡 BY DESIGN / MITIGATED

### CORE-1: StateManager set() Race Condition

**Status:** By Design  
**Category:** Architecture

**Description:** The `set()` method does NOT call `lockState()`, while `batchUpdate()` does. This means concurrent `set()` calls can interleave.

**Analysis:** This is intentional:
1. JavaScript is single-threaded - true race conditions are impossible
2. The lock mechanism is for preventing `batchUpdate()` interference
3. Single `set()` calls complete synchronously

**Risk:** Low - only a concern if async code doesn't properly sequence `set()` calls.

---

### CORE-2: HistoryManager Memory with Large Images

**Status:** Mitigated  
**Category:** Memory Management

**Description:** Each history entry clones all layers, including base64 image data.

**Mitigation Already In Place:**
1. `maxHistorySteps = 50` limit enforced
2. `cloneLayersEfficient()` method preserves large data (`src`, `path`) by reference, not by copy
3. History trimming in `saveState()` and `setMaxHistorySteps()`

**Remaining Risk:** Low - the efficient cloning avoids the 25MB+ worst case.

---

## 🔴 Code Quality Metrics

### God Class Inventory (20 Files ≥ 1,000 Lines)

**Generated Data (Exempt):**

| File | Lines | Purpose |
|------|-------|---------|
| EmojiLibraryData.js | ~26,277 | Generated emoji metadata |
| ShapeLibraryData.js | ~11,299 | Generated shape definitions |
| EmojiLibraryIndex.js | ~3,003 | Generated search index |

**Hand-Written Files:**

| File | Lines | Delegation Status | Issues |
|------|-------|-------------------|--------|
| CanvasManager.js | ~2,011 | ✅ 10+ controllers | At 2K threshold |
| ViewerManager.js | ~1,996 | ✅ Delegates to renderers | ✅ 82.99% coverage |
| Toolbar.js | ~1,847 | ✅ 4 modules | OK |
| LayerPanel.js | ~1,806 | ✅ 9 controllers | OK |
| LayersEditor.js | ~1,768 | ✅ 3 modules | OK |
| APIManager.js | ~1,513 | ✅ APIErrorHandler | ✅ saveInProgress fix |
| SelectionManager.js | ~1,431 | ✅ 3 modules | OK |
| ArrowRenderer.js | ~1,310 | N/A - math complexity | OK |
| CalloutRenderer.js | ~1,291 | N/A - rendering logic | OK |
| PropertyBuilders.js | ~1,284 | N/A - UI builders | OK |
| InlineTextEditor.js | ~1,258 | N/A - feature complexity | OK |
| ToolManager.js | ~1,224 | ✅ 2 handlers | OK |
| GroupManager.js | ~1,172 | N/A - group operations | ✅ isDescendantOf fix |
| CanvasRenderer.js | ~1,132 | ✅ SelectionRenderer | OK |
| TransformController.js | ~1,110 | N/A - transforms | OK |
| ResizeCalculator.js | ~1,105 | N/A - math | OK |
| ToolbarStyleControls.js | ~1,099 | ✅ Style controls | OK |
| PropertiesForm.js | ~1,001 | ✅ PropertyBuilders | OK |

### ESLint Disable Audit (9 comments, all legitimate)

| File | Disable Type | Reason |
|------|-------------|--------|
| LayerSetManager.js | no-alert | Prompt for new set name |
| UIManager.js (×3) | no-alert | Prompt for set operations |
| PresetDropdown.js (×2) | no-alert | Prompt for preset name |
| ImportExportManager.js | no-alert | Import confirmation |
| RevisionManager.js | no-alert | Revert confirmation |
| APIManager.js | no-control-regex | Control character sanitization |

---

## ✅ What's Working Well

### Security
- ✅ CSRF protection on all write endpoints (layerssave, layersdelete, layersrename)
- ✅ Rate limiting via MediaWiki's pingLimiter system
- ✅ Server-side property whitelist with 50+ validated fields
- ✅ Text sanitization, color validation, path traversal prevention
- ✅ SQL injection protection via parameterized queries
- ✅ No eval(), document.write(), or new Function() usage
- ✅ innerHTML audited - no user data flows into innerHTML

### Architecture
- ✅ Clean separation: PHP backend (storage/API), JS frontend (editor/viewer)
- ✅ Registry pattern for dependency management
- ✅ Controller/Facade pattern in CanvasManager
- ✅ Shared rendering code between editor and viewer
- ✅ ES6 classes throughout (100% migration complete)
- ✅ Destroy/cleanup methods in most components

### Test Coverage
- ✅ 92.17% statement coverage
- ✅ 82.45% branch coverage
- ✅ 9,994 tests in 156 suites
- ✅ Performance benchmarks in test suite
- ✅ ViewerManager coverage gap fixed (82.99%)

### Features
- ✅ **15 drawing tools** all working correctly
- ✅ **1,310 shapes** in Shape Library
- ✅ **2,817 emoji** in Emoji Picker
- ✅ Named layer sets with version history
- ✅ Layer folders with visibility cascading
- ✅ Style presets with import/export
- ✅ Curved arrows, gradient fills, blur effects
- ✅ Full keyboard accessibility
- ✅ Dark mode support (Vector 2022)

---

## Recommendations by Priority

### P0 (Critical — Immediate)
No critical issues remaining.

### P1 (High — Next Sprint)
1. **NEW-5:** Add radix parameter to parseInt() calls in ValidationHelpers.js
2. **NEW-6:** Add E2E tests for EmojiPickerPanel

### P2 (Medium — Next Milestone)
1. **NEW-7:** Document error handling guidelines
2. **NEW-8:** Centralize i18n fallback strings
3. **NEW-9:** Monitor ShapeRenderer.js growth

### P3 (Long-Term)
1. Consider TypeScript migration for complex modules
2. Add visual regression testing
3. Implement real-time collaboration architecture

---

## Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent - no vulnerabilities found |
| Test Coverage | 8.5/10 | 25% | 92.17% statement, ViewerManager fixed |
| Functionality | 8.0/10 | 25% | Feature-complete, minor issues |
| Architecture | 8.0/10 | 15% | Good patterns, few god classes |
| Documentation | 7.5/10 | 10% | Comprehensive but metrics need sync |

**Weighted Total: 8.35/10 → Overall: 8.0/10**

**Score History:**
- v25 (Jan 24, 2026): **8.0/10** — ViewerManager coverage fixed, CORE-3/CORE-4 fixed, comprehensive audit
- v24 (Jan 23, 2026): 7.0/10 — NEW-1 through NEW-7 identified
- v23 (Jan 23, 2026): 7.2/10 — Core issues identified

---

## Appendix: Verification Commands

```bash
# Verify branch and uncommitted files
git status

# Run tests with coverage
npm run test:js -- --coverage --silent

# Get test count
npm run test:js -- --coverage --silent 2>&1 | grep -E "Tests:"

# Get coverage summary
npm run test:js -- --coverage --silent 2>&1 | grep -E "All files"

# JS file count
find resources -name "*.js" ! -path "*/dist/*" ! -path "*/scripts/*" | wc -l

# JS line count
find resources -name "*.js" ! -path "*/dist/*" ! -path "*/scripts/*" -exec wc -l {} + | tail -1

# Find parseInt without radix
grep -rn "parseInt\s*(" resources --include="*.js" | grep -v ", 10"

# Find eslint-disable
grep -rn "eslint-disable" resources --include="*.js"
```

---

*Review performed on `main` branch, January 24, 2026.*  
*Rating: 8.0/10 — Production-ready, high quality extension.*
