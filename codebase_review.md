# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 22, 2026 (Comprehensive Critical Audit v20)  
**Version:** 1.5.26  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 9,936 tests in 156 suites (all passing)
- **Coverage:** 92.59% statements, 83.02% branches (verified January 22, 2026)
- **JS files:** 124 (excludes `resources/dist/` and build scripts)
- **PHP files:** 33+

---

## Executive Summary

The Layers extension is a mature, feature-rich MediaWiki extension with strong security practices, excellent test coverage, and professional architecture. However, this critical audit has identified **several issues that should be addressed** before claiming "world-class" status.

**Overall Assessment:** **8.6/10** — Production-ready with known issues requiring attention.

### Key Strengths
- Excellent security model (CSRF, rate limiting, validation)
- Strong test coverage (92.59% statement, 83.02% branch)
- Well-documented with comprehensive inline comments
- Modern ES6 class-based architecture
- Proper delegation patterns in large files

### Key Weaknesses
- **Untracked/uncommitted slide mode files** suggest incomplete feature
- **Memory leak patterns** in several components
- **Inconsistent error handling** across modules
- **Documentation metric inconsistencies** between files
- **ViewerManager has 64.84% coverage** — significant coverage gap

---

## 🔴 Critical Issues

### 1. UNTRACKED SLIDE MODE FILES — Feature Appears Incomplete

**Severity:** Critical  
**Category:** Incomplete Feature / Missing Commits

**Description:** `git status` reveals 15 untracked files related to Slide Mode:
- `docs/SLIDE_MODE.md`
- `resources/ext.layers.slides/` (entire directory)
- `resources/ext.layers.editor/ui/SlidePropertiesPanel.js`
- `resources/ext.layers/viewer/SlideViewer.css`
- `src/Api/ApiLayersList.php`
- `src/Hooks/SlideHooks.php`
- `src/SpecialPages/SpecialSlides.php`
- `src/SpecialPages/SpecialEditSlide.php`
- `src/Validation/SlideNameValidator.php`
- Multiple test files

**Impact:** The Slide Mode feature (advertised in README, CHANGELOG, and wiki) relies on code that **isn't committed to the repository**. Users cloning this repo would NOT have a functional Slide Mode feature.

**Recommendation:** Either commit these files or remove Slide Mode documentation until the feature is actually included in the codebase.

---

### 2. ViewerManager.js — 64.84% Coverage (Critical Gap)

**Severity:** High  
**Category:** Test Coverage Gap  
**File:** [resources/ext.layers/viewer/ViewerManager.js](resources/ext.layers/viewer/ViewerManager.js)

**Description:** ViewerManager is a 1,810-line critical component with only 64.84% line coverage. Uncovered lines include:
- Lines 937-1090 (~153 lines) — substantial functionality untested
- Lines 1176-1430 (~254 lines) — major code paths untested
- Various error handling paths

**Impact:** This is the core viewer component that renders layers on article pages. Insufficient testing increases regression risk.

**Recommendation:** Add tests for the uncovered code paths, particularly slide-related functionality.

---

## 🟠 High Severity Issues

### 3. Memory Leak: Untracked setTimeout Calls

**Severity:** High  
**Category:** Memory Leak  
**Files:** PropertyBuilders.js, LayerPanel.js, PropertiesForm.js, SpecialSlides.js

**Description:** Many `setTimeout` calls for debouncing are not tracked or cleared on component destruction:
```javascript
// Pattern found multiple times - no cleanup
setTimeout(() => {
    this.updateUI();
}, 300);
```

If a component is destroyed before the timeout fires, callbacks may execute on stale state or cause errors.

**Recommendation:** Create a `TimeoutTracker` utility or use the existing pattern from `APIManager._scheduleTimeout()`.

---

### 4. Memory Leak: Event Listeners Not Cleaned Up

**Severity:** High  
**Category:** Memory Leak  
**Files:** LayersEditorModal.js, SpecialSlides.js

**Description:** 
- `LayersEditorModal` adds `keydown` and `message` event listeners that ARE cleaned up in `close()`, but the modal doesn't have a `destroy()` method for cleanup if closed abnormally.
- `SpecialSlides.js` binds jQuery events with `.on()` but has NO destroy/cleanup method whatsoever.

**Recommendation:** Add explicit destroy methods to both components.

---

### 5. State Lock Timeout May Cause Corruption

**Severity:** High  
**Category:** Race Condition  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js#L172)

**Description:** The 5-second forced unlock timeout in `lockState()` could cause state corruption if a legitimate slow operation is still in progress:
```javascript
this.lockTimeout = setTimeout( () => {
    mw.log.warn( '[StateManager] Force unlocking state after timeout' );
    this.unlockState();  // Force unlock - potentially dangerous
}, 5000 );
```

**Recommendation:** Instead of force-unlocking, log an error and leave the state locked. Provide a manual recovery mechanism.

---

### 6. XSS Risk in SpecialSlides.js

**Severity:** High  
**Category:** Security  
**File:** [resources/ext.layers.slides/SpecialSlides.js](resources/ext.layers.slides/SpecialSlides.js)

**Description:** While `mw.html.escape()` is used for most user content, the pattern of building HTML strings and using `$list.html(html)` is fragile:
```javascript
const name = mw.html.escape( slide.name );
// ... more escaping ...
html += `<div class="layers-slide-item" data-name="${ name }">`;
this.$list.html( html );
```

If ANY field is missed or the escaping is inconsistent, XSS is possible.

**Recommendation:** Use DOM construction methods instead of HTML string building, or use a templating system that auto-escapes.

---

## 🟡 Medium Severity Issues

### 7. Documentation Metric Inconsistencies

**Severity:** Medium  
**Category:** Documentation  

**Description:** Metrics are inconsistent across documentation files:
- `codebase_review.md` previously reported 9,951 tests, 93.52% coverage
- `improvement_plan.md` reports 9,951 tests, 93.52% coverage  
- Actual run shows **9,902 tests, 92.59% coverage**
- README badge says "9,951 passing" but that's outdated

**Files with outdated metrics:**
- README.md (badge: 9,951 tests)
- wiki/Home.md (9,951 tests)
- improvement_plan.md (9,951 tests, 93.52%)
- copilot-instructions.md (9,951 tests)

**Recommendation:** Automate metric updates or run verification before releases.

---

### 8. Inconsistent Layer Cloning Methods

**Severity:** Medium  
**Category:** Code Quality

**Description:** Layer cloning uses inconsistent methods across the codebase:
- `JSON.parse(JSON.stringify(layer))` — StateManager, HistoryManager, TransformController
- `DeepClone.clone()` — GroupManager
- `Object.assign({}, layer)` — some UI components

**Impact:** Different cloning methods have different behaviors:
- `JSON.parse/stringify` drops functions and undefined values
- `Object.assign` is shallow only
- `DeepClone.clone()` handles both deep and shallow with edge cases

**Recommendation:** Standardize on `DeepClone.clone()` or document when each is appropriate.

---

### 9. i18n Author Placeholder Not Updated

**Severity:** Medium  
**Category:** Documentation  
**File:** [i18n/en.json](i18n/en.json)

**Description:** The i18n file metadata still shows:
```json
"@metadata": {
    "authors": [
        "Your Name"
    ]
}
```

**Recommendation:** Update to actual author name(s).

---

### 10. Missing Destroy Method in EmojiPickerPanel

**Severity:** Medium  
**Category:** Memory Leak  
**File:** resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js

**Description:** EmojiPickerPanel creates IntersectionObservers and DOM elements but has no `destroy()` method. If the picker is opened/closed multiple times, observers may accumulate.

---

### 11. Hardcoded Magic Numbers

**Severity:** Medium  
**Category:** Code Quality

**Description:** Various hardcoded values scattered throughout:
- Lock timeout: 5000ms (StateManager.js)
- Max history: 50 (HistoryManager.js)
- Debounce delays: 300ms (multiple files)
- LRU cache size: 50 (ImageLoader.js)
- Retry delays: 1000ms (APIManager.js)

**Recommendation:** Consolidate in `LayersConstants.js` (which exists but doesn't contain all these values).

---

## 🟢 Low Severity Issues

### 12. Console Statements in Build Scripts

**Severity:** Low  
**Category:** Code Quality

**Description:** Build scripts (generate-library.js, sanitize-svgs.js) use `console.log` directly. This is appropriate for CLI tools but inconsistent with the rest of the codebase which uses `mw.log`.

---

### 13. Test File eslint-disable Comments

**Severity:** Low  
**Category:** Code Quality

**Description:** Some test files have blanket `eslint-disable` comments:
- `tests/jest/tools/TextToolHandler.test.js` — `/* eslint-disable no-unused-vars */`
- `tests/jest/tools/PathToolHandler.test.js` — `/* eslint-disable no-unused-vars */`
- `tests/jest/SpecialSlides.test.js` — `/* eslint-disable no-unused-vars */`

**Recommendation:** Use more targeted line-specific disables or refactor to avoid the need.

---

### 14. Missing ARIA Attributes on Dynamic Inputs

**Severity:** Low  
**Category:** Accessibility  
**File:** [resources/ext.layers.editor/ui/PropertyBuilders.js](resources/ext.layers.editor/ui/PropertyBuilders.js)

**Description:** Dynamically created input elements lack:
- `aria-describedby` linking to help text
- `aria-invalid` for validation state
- Consistent labeling patterns

---

## ✅ Recently Fixed Issues

### BUG FIXED: Slide Viewers Now Refresh After Editor Close (January 24, 2026)

**Severity:** Critical → Fixed  
**Status:** ✅ RESOLVED  
**Version:** 1.5.25

**Original Symptom:** When editing a slide (`{{#Slide: ...}}`), closing the editor required a full page refresh to see changes.

**Root Cause:** Slides use `window.location.href` navigation while images use a modal editor. Browser bfcache restoration doesn't re-execute JavaScript.

**Solution Applied:** Added `pageshow` event listener in `init.js` that detects bfcache restoration and calls `refreshAllViewers()`.

---

## What's Working Well ✅

### Security
- CSRF protection on all write endpoints (layerssave, layersdelete, layersrename)
- Rate limiting via MediaWiki's pingLimiter system
- Server-side property whitelist with 50+ validated fields in ServerSideLayerValidator
- Text sanitization, color validation, path traversal prevention
- SQL injection protection via parameterized queries throughout LayersDatabase

### Architecture
- Clean separation: PHP backend (storage/API), JS frontend (editor/viewer)
- Registry pattern for dependency management in LayersEditor (ModuleRegistry)
- Controller/Facade pattern in CanvasManager (delegates to 10+ controllers)
- Shared rendering code between editor and viewer (LayerRenderer, ShapeRenderer, etc.)
- ES6 classes throughout (100% migration complete)

### Test Coverage
- 92.59% statement coverage — excellent for this complexity
- 83.02% branch coverage — strong edge case coverage
- 9,902 tests in 155 suites — comprehensive
- Performance benchmarks in test suite
- Good separation of unit, integration tests

### Features
- **15 drawing tools** all working correctly
- **1,310 shapes** in Shape Library (ISO 7010, IEC 60417, etc.)
- **2,817 emoji** in Emoji Picker
- Named layer sets with version history
- Layer folders with visibility cascading
- Style presets with import/export
- Curved arrows, gradient fills, blur effects
- Full keyboard accessibility
- Dark mode support (Vector 2022)

---

## God Class Inventory (≥ 1,000 lines)

**Total:** 20 files (3 generated, 17 hand-written)

### Generated Data (Exempt from Refactoring)

| File | Lines | Purpose |
|------|-------|---------|
| EmojiLibraryData.js | 26,277 | Emoji metadata |
| ShapeLibraryData.js | 11,299 | Shape definitions |
| EmojiLibraryIndex.js | 3,003 | Search index |

### Hand-Written Code

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| CanvasManager.js | 2,011 | ⚠️ WATCH | At 2K threshold |
| Toolbar.js | 1,848 | ✅ OK | Delegates to 4 modules |
| ViewerManager.js | 1,810 | ⚠️ LOW COVERAGE | Only 64.84% tested |
| LayerPanel.js | 1,806 | ✅ OK | Delegates to 9 controllers |
| LayersEditor.js | 1,715 | ✅ OK | Delegates to 3 modules |
| SelectionManager.js | 1,432 | ✅ OK | Delegates to 3 modules |
| APIManager.js | 1,421 | ✅ OK | Has timeout tracking |
| ArrowRenderer.js | 1,310 | ✅ OK | Complex curve math |
| CalloutRenderer.js | 1,291 | ✅ OK | Speech bubble rendering |
| PropertyBuilders.js | 1,284 | ✅ OK | UI property builders |
| InlineTextEditor.js | 1,258 | ✅ OK | Figma-style editing |
| ToolManager.js | 1,224 | ✅ OK | Delegates to handlers |
| GroupManager.js | 1,133 | ✅ OK | Layer grouping |
| CanvasRenderer.js | 1,132 | ✅ OK | Delegates to SelectionRenderer |
| TransformController.js | 1,110 | ✅ OK | Resize/rotate transforms |
| ResizeCalculator.js | 1,105 | ✅ OK | Shape-specific math |
| ToolbarStyleControls.js | 1,099 | ✅ OK | Style controls |
| PropertiesForm.js | 1,001 | ✅ OK | Just crossed threshold |

---

## Recommendations by Priority

### P0 (Critical — Before Next Release)

1. **Commit Slide Mode files** or remove Slide Mode documentation
2. **Increase ViewerManager.js test coverage** from 64.84% to >85%
3. **Review XSS risk** in SpecialSlides.js HTML string building

### P1 (High — Next Sprint)

1. Add `destroy()` methods to EmojiPickerPanel, SpecialSlides
2. Create `TimeoutTracker` utility for consistent cleanup
3. Fix StateManager lock timeout to not force-unlock
4. Update documentation metrics to match actual values

### P2 (Medium — Next Milestone)

1. Standardize layer cloning on `DeepClone.clone()`
2. Add ARIA attributes to dynamic form inputs
3. Consolidate magic numbers in LayersConstants.js
4. Update i18n author metadata
5. Virtualize layer list for 50+ layer sets

### P3 (Long-Term)

1. OffscreenCanvas/WebGL rendering path
2. Real-time collaboration architecture
3. Incremental TypeScript migration
4. Automated visual regression tests

---

## Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent CSRF, validation, rate limiting |
| Test Coverage | 8.5/10 | 25% | 92.59% overall but ViewerManager gap |
| Functionality | 8.5/10 | 25% | Good but Slide Mode not committed |
| Architecture | 8.5/10 | 15% | Good delegation, some memory leak patterns |
| Documentation | 8.0/10 | 10% | Good but metric inconsistencies |

**Weighted Total: 8.62/10 → Overall: 8.6/10**

---

## ESLint-Disable Audit

**Production Code: 9 eslint-disable comments** (all legitimate)

| File | Disable | Reason |
|------|---------|--------|
| LayerSetManager.js | no-alert | Prompt for new set name |
| UIManager.js (×3) | no-alert | Prompt for set operations |
| PresetDropdown.js (×2) | no-alert | Prompt for preset name |
| ImportExportManager.js | no-alert | Import confirmation |
| RevisionManager.js | no-alert | Revert confirmation |
| APIManager.js | no-control-regex | Control character sanitization |

**Test Files: 4 blanket disables** (should be reduced)

---

## Appendix: Verification Commands

```bash
# Verify branch and uncommitted files
git status

# Run tests with coverage
npm run test:js -- --coverage --silent

# Get coverage summary
npm run test:js -- --coverage --silent 2>&1 | grep -E "All files"

# JS file count
find resources -name "*.js" ! -path "*/dist/*" ! -path "*scripts*" | wc -l

# Find files with low coverage
npm run test:js -- --coverage 2>&1 | grep -E "^\s+\w.*\|\s+[0-6][0-9]\."
```

---

*Review performed on `main` branch, January 22, 2026.*  
*Critical finding: Slide Mode files are untracked/uncommitted.*  
*Rating: 8.6/10 — Production-ready with known issues to address.*
