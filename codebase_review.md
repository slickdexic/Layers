# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 24, 2026 (Comprehensive Audit v19 - Updated)  
**Version:** 1.5.25  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git status`)
- **Tests:** 9,951 tests in 155 suites (13 new slide refresh tests added)
- **Coverage:** 93.52% statements, 83.89% branches
- **Line counts:** Measured via `find` + `wc -l`

---

## Executive Summary

The Layers extension has excellent test coverage and strong security. This audit identified and **fixed one critical bug** related to slide refresh after editor close.

**Critical Bug Fixed (v1.5.25):** Slides now refresh after editor close via `pageshow` event handler in `init.js` that detects bfcache restoration. Added 13 new unit tests.

**Overall Assessment:** **9.2/10** — Production-ready, feature-complete, with excellent test coverage.

---

## ✅ Recently Fixed Issues

### BUG FIXED: Slide Viewers Now Refresh After Editor Close (January 24, 2026)

**Severity:** Critical → Fixed  
**Status:** ✅ RESOLVED  
**Version:** 1.5.25  
**Files Modified:** 
- [resources/ext.layers/viewer/ViewerManager.js](resources/ext.layers/viewer/ViewerManager.js) (~160 lines added)
- [resources/ext.layers/init.js](resources/ext.layers/init.js) (~10 lines added)
- [tests/jest/ViewerManager.test.js](tests/jest/ViewerManager.test.js) (11 new tests)
- [tests/jest/init.test.js](tests/jest/init.test.js) (2 new tests)

**Original Symptom:** When editing a slide (`{{#Slide: ...}}`), closing the editor required a full page refresh to see changes. Image layer sets refreshed immediately without page reload.

**Root Cause:** Slides use `window.location.href` navigation to `Special:EditSlide` (full page navigation) while images use a modal editor with a callback. When the slide editor closes via `history.back()`, the browser restores the page from bfcache (back-forward cache), which does NOT re-execute JavaScript.

**Solution Applied:**
1. Added `pageshow` event listener in `init.js` that detects bfcache restoration (`event.persisted === true`)
2. Calls `refreshAllViewers()` when page is restored from bfcache
3. Modified `refreshAllSlides()` to refresh ALL slide containers without requiring `layersSlideInitialized` property (which may be lost on bfcache restoration)
4. Added `reinitializeSlideViewer(container, payload)` method to clear and re-render slide canvas

**Test Coverage:** 13 new unit tests covering `pageshow` event handler, `reinitializeSlideViewer`, `refreshAllSlides`, and integration scenarios.

---

## 🟠 High Severity Issues

### Memory Leak: Untracked setTimeout Calls

**Severity:** High  
**Category:** Memory Leak  
**Files:** PropertyBuilders.js, LayerPanel.js, PropertiesForm.js

**Description:** Many `setTimeout` calls for debouncing are not tracked or cleared on component destruction. If a component is destroyed before the timeout fires, the callback executes on stale/destroyed state.

**Recommendation:** Create a `TimeoutTracker` utility similar to `EventTracker`.

---

### Memory Leak: Event Listeners in LayersEditorModal

**Severity:** High  
**Category:** Memory Leak  
**File:** [resources/ext.layers.modal/LayersEditorModal.js](resources/ext.layers.modal/LayersEditorModal.js)

**Description:** Event listeners on `window` and `document` are added but may accumulate if modal is opened/closed repeatedly without proper cleanup reference tracking.

---

### State Lock Timeout Could Cause Corruption

**Severity:** High  
**Category:** Race Condition  
**File:** [resources/ext.layers.editor/StateManager.js](resources/ext.layers.editor/StateManager.js)

**Description:** The 5-second lock timeout forces unlock unconditionally. If a legitimate slow operation is still in progress, this could cause state corruption.

---

## 🟡 Medium Severity Issues

### Inconsistent Layer Cloning Methods

**Category:** Code Quality  
**Description:** Layer cloning uses different methods:
- `JSON.parse(JSON.stringify(layer))` in StateManager, HistoryManager
- `DeepClone.clone()` in GroupManager
- `Object.assign({}, layer)` in some UI components

**Recommendation:** Standardize on `DeepClone.clone()`.

---

### jQuery Events Not Cleaned Up in SpecialSlides

**Category:** Memory Leak  
**File:** [resources/ext.layers.slides/SpecialSlides.js](resources/ext.layers.slides/SpecialSlides.js)

**Description:** jQuery event handlers attached with `.on()` are never cleaned up. No destroy method exists.

---

### innerHTML with Potentially User-Controlled Content

**Category:** Security (XSS Risk)  
**File:** [resources/ext.layers.slides/SpecialSlides.js](resources/ext.layers.slides/SpecialSlides.js)

**Description:** `this.$list.html(html)` where `html` is built from slide data without fully escaping user content.

---

### Missing ARIA Attributes on Dynamic Form Inputs

**Category:** Accessibility  
**File:** [resources/ext.layers.editor/ui/PropertyBuilders.js](resources/ext.layers.editor/ui/PropertyBuilders.js)

**Description:** Input elements lack proper `aria-describedby` attributes.

---

### Hardcoded Magic Numbers

**Category:** Code Quality  
**Description:** Various hardcoded values: lock timeout 5000ms, MAX_HISTORY_SIZE 100, debounce delays.

**Recommendation:** Create a `LayersConstants.js` file.

---

## Verified Metrics (January 21, 2026)

### Test Results

| Metric | Value | Status |
|--------|-------|--------|
| Tests Passing | **9,922** | ✅ 100% |
| Test Suites | **155** | ✅ All passing |
| Statement Coverage | **93.52%** | ✅ Excellent |
| Branch Coverage | **83.89%** | ✅ Target met |
| Function Coverage | **90.77%** | ✅ Excellent |
| Line Coverage | **92.94%** | ✅ Excellent |

### JavaScript

- **JS files:** 124 (excludes `resources/dist/`)
- **JS lines:** ~111,500 (includes generated emoji/shape data)

### PHP

- **PHP files:** 33
- **PHP lines:** ~11,758

---

## Previously Fixed Issues (January 22, 2026)

### 1) Slide Mode: Canvas Size Not Applied ✅ FIXED

**Symptom:** When opening the editor from a slide with `canvas=600x400`, the canvas always displayed as 800×600.

**Root Cause:** `CanvasManager.init()` was called in the constructor BEFORE slide dimensions could be set. The `handleImageLoadError()` callback would overwrite dimensions to defaults.

**Solution:** Pass `slideCanvasWidth` and `slideCanvasHeight` through the CanvasManager config. Set `baseWidth`/`baseHeight` from config BEFORE calling `init()`.

**Files Modified:**
- `resources/ext.layers.editor/CanvasManager.js` (lines 246-250)
- `resources/ext.layers.editor/LayersEditor.js` (lines 554-555)

### 2) Slide Mode: Edit Button Always Visible ✅ FIXED

**Symptom:** The edit layers overlay/button was always present on slide containers, even when not hovering.

**Root Cause:** PHP-generated edit button had CSS with no hover behavior.

**Solution:** Created JavaScript-based overlay system with fade-in/out transitions matching the regular image overlay pattern. Overlay is hidden by default and shown on container hover.

**Files Modified:**
- `resources/ext.layers/viewer/SlideViewer.css` (complete restructure)
- `resources/ext.layers/viewer/ViewerManager.js` (added `setupSlideOverlay()`, ~100 lines)
- `src/Hooks/SlideHooks.php` (removed server-side edit button HTML)

### 3) Slide Mode: No "View Full Size" Option ✅ FIXED

**Symptom:** Slides didn't show the lightbox/full-size view option that regular layered images have.

**Solution:** Added "View full size" button that exports canvas to PNG data URL and opens `LayersLightbox`.

**Files Modified:**
- `resources/ext.layers/viewer/ViewerManager.js` (added ~150 lines)
  - `handleSlideViewClick()` - Opens lightbox with canvas data URL
  - `_msg()` - i18n helper
  - `_createPencilIcon()` / `_createExpandIcon()` - SVG icons

---

## What's Working Well

### Security ✅

- CSRF protection on all write endpoints (layerssave, layersdelete, layersrename)
- Rate limiting on all write operations
- Server-side property whitelist with 50+ validated fields
- Text sanitization, color validation
- SQL injection protection via parameterized queries

### Architecture ✅

- Clean separation: PHP backend (storage/API), JS frontend (editor/viewer)
- Registry pattern for dependency management in LayersEditor
- Controller pattern in CanvasManager (delegates to 10+ specialized controllers)
- Shared rendering code between editor and viewer (LayerRenderer, etc.)
- ES6 classes throughout (100% migration complete)

### Test Coverage ✅

- 93.52% statement coverage — excellent for a project of this complexity
- 83.89% branch coverage — strong edge case coverage
- Performance benchmarks included in test suite
- Good separation of unit, integration, and E2E tests

### Features ✅

- **15 drawing tools** all working correctly
- **1,310 shapes** in Shape Library (ISO 7010, IEC 60417, etc.)
- **2,817 emoji** in Emoji Picker
- Named layer sets with version history
- Layer folders with visibility cascading
- Style presets with import/export
- Curved arrows, gradient fills, blur effects
- Full keyboard accessibility
- Dark mode support

---

## Feature Gaps (Product)

| Gap | Priority | Notes |
|-----|----------|-------|
| **Slide refresh on editor close** | **CRITICAL** | **Bug identified above** |
| Modal editing for slides | MEDIUM | Slides use page navigation, not modal |
| Mobile UI polish | MEDIUM | Touch works, but panels not optimized for small screens |
| Layer search/filter | LOW | Would help with large layer sets (50+) |
| Custom fonts | LOW | Currently limited to allowlist |
| Real-time collaboration | LOW | Major feature, not currently planned |

---

## Performance Notes

- **Rendering:** Canvas-based, performant for typical use cases
- **Hit testing:** O(n) but fast — benchmarks show ~1-2μs per layer
- **Memory:** LRU cache for images (50 entries), proper cleanup on destroy
- **Large layers:** Layer panel not virtualized; may slow with 50+ layers

---

## Recommendations

### P0 (Critical - Fix Before Next Release)

~~1. **Fix slide refresh bug** — Add `refreshSlideViewers()` method and call it alongside `refreshAllViewers()` when modal editor closes~~ ✅ **FIXED** (January 22, 2026) — Added `reinitializeSlideViewer()` and `refreshAllSlides()` methods; modified `refreshAllViewers()` to include slides

### P1 (High - Next Sprint)

1. Add tests for EmojiPickerPanel.js (0% coverage, 764 lines)
2. Create `TimeoutTracker` utility for debounce/setTimeout management
3. Audit and fix memory leaks in modal and slide components
4. Add E2E tests for emoji/shape picker user flows

### P2 (Medium - Next Milestone)

1. Virtualize layer list for sets with 50+ layers
2. Add layer search/filter UI
3. Standardize layer cloning on `DeepClone.clone()`
4. Add `aria-describedby` to form inputs
5. Consider extracting more from god classes approaching 2K lines

### P3 (Long-Term)

1. OffscreenCanvas/WebGL path for large images
2. Accessibility augmentation (SVG overlay for screen readers)
3. Real-time collaboration architecture

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
| CanvasManager.js | 2,010 | ⚠️ WATCH | At 2K threshold, uses 10+ controllers |
| Toolbar.js | 1,847 | ✅ OK | Delegates to 4 modules |
| LayerPanel.js | 1,806 | ✅ OK | Delegates to 9 controllers |
| LayersEditor.js | 1,715 | ✅ OK | Delegates to 3 modules |
| SelectionManager.js | 1,431 | ✅ OK | Delegates to 3 modules |
| APIManager.js | 1,420 | ✅ OK | Delegates to APIErrorHandler |
| ArrowRenderer.js | 1,301 | ✅ OK | Complex curved arrow rendering |
| CalloutRenderer.js | 1,291 | ✅ OK | Speech bubble rendering |
| PropertyBuilders.js | 1,284 | ✅ OK | UI property builders |
| InlineTextEditor.js | 1,258 | ✅ OK | Figma-style text editing |
| ToolManager.js | 1,224 | ✅ OK | Delegates to 2 handlers |
| GroupManager.js | 1,132 | ✅ OK | Layer grouping logic |
| CanvasRenderer.js | 1,132 | ✅ OK | Delegates to SelectionRenderer |
| TransformController.js | 1,109 | ✅ OK | Resize/rotate transforms |
| ResizeCalculator.js | 1,105 | ✅ OK | Shape-specific resize math |
| ToolbarStyleControls.js | 1,099 | ✅ OK | Style control UI |
| PropertiesForm.js | 1,001 | ✅ OK | Just crossed threshold |

**Summary:**
- Total in god classes: ~60,000 lines (54% of JS codebase)
- Generated data: ~40,579 lines (67% of god class total)
- Hand-written: ~19,000 lines (17% of total JS)
- All hand-written god classes use proper delegation patterns

---

## Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Excellent CSRF, validation, rate limiting |
| Test Coverage | 9.2/10 | 25% | 93.52% statements, 83.89% branches |
| Functionality | 9.2/10 | 25% | Slide refresh bug fixed, feature-complete |
| Architecture | 8.5/10 | 15% | Good delegation, some memory leak patterns |
| Documentation | 9.0/10 | 10% | Comprehensive, well-organized |

**Weighted Total: 9.20/10 → Overall: 9.2/10**

---

## ESLint-Disable Audit

**Total: 9 eslint-disable comments** (all legitimate)

| File | Disable | Reason |
|------|---------|--------|
| LayerSetManager.js | no-alert | Prompt for new set name |
| UIManager.js (×3) | no-alert | Prompt for set rename, delete |
| PresetDropdown.js (×2) | no-alert | Prompt for preset name |
| ImportExportManager.js | no-alert | Import confirmation |
| RevisionManager.js | no-alert | Revert confirmation |
| APIManager.js | no-control-regex | Control character sanitization |

---

## Appendix: Verification Commands

```bash
# Test count and coverage
npm run test:js -- --coverage

# JS/PHP file and line counts
find resources -name "*.js" ! -path "*/dist/*" -print | wc -l
find resources -name "*.js" ! -path "*/dist/*" -exec wc -l {} + | tail -1
find src -name "*.php" -print | wc -l
find src -name "*.php" -exec wc -l {} + | tail -1

# God classes (>=1000 lines)
find resources -name "*.js" ! -path "*/dist/*" -exec wc -l {} + | awk '$1 >= 1000 {print $1, $2}' | sort -n
```

---

*Review performed on `main` branch, January 21, 2026.*  
*Critical bug identified: Slide viewers don't refresh after editor close.*  
*Rating: 8.7/10 — Production-ready with known issues to address.*

---

## Improvement Ideas (January 20, 2026 Review)

### Features

1. **Layer Search/Filter** — Add a search box to filter layers by name/type in the layer panel. Would significantly improve UX for sets with 30+ layers.

2. **Custom Font Upload** — Allow wiki administrators to add custom fonts beyond the default allowlist. Useful for branding and specialized documentation.

3. **Layer Templates** — Pre-defined layer combinations that can be quickly applied (e.g., "Anatomy Diagram" template with numbered markers and leader lines).

4. **Collaborative Locking** — Soft locks when multiple users are editing the same layer set to prevent conflicts.

5. **Export to SVG** — Already partially supported; could be enhanced with layer visibility options in the export dialog.

### Performance

1. **OffscreenCanvas for Heavy Renders** — Use OffscreenCanvas in a Web Worker for rendering large images (5000×5000+) without blocking UI.

2. **Incremental Rendering** — Only re-render changed layers rather than full canvas redraw. The RenderCoordinator has dirty tracking but could be more granular.

3. **WebGL Renderer** — Alternative rendering path for extremely large images or effects-heavy layer sets.

4. **Image Layer Lazy Loading** — Defer loading base64 image layers until they become visible during scroll/zoom.

### Aesthetics

1. **Toolbar Customization** — Let users reorder/hide toolbar buttons for their preferred workflow.

2. **Theme Support** — Beyond dark mode, allow color theming for the editor UI (accent colors, etc.).

3. **Animation Previews** — Add subtle animations for layer transitions when showing/hiding layers.

4. **Grid/Ruler Overlays** — Optional pixel grid and ruler guides for precise positioning.

### Testing

1. **EmojiPickerPanel Tests** — Add unit/integration tests for the 764-line EmojiPickerPanel.js (currently 0% coverage).

2. **Visual Regression Tests** — Automated screenshot comparison for canvas rendering across browser versions.

3. **Load Testing** — Automated performance benchmarks for 100+ layer sets to establish baselines.

4. **Accessibility Audit Automation** — Add axe-core or similar to E2E tests for automated WCAG compliance checks.

### Code Quality

1. **Extract InlineTextEditor Helpers** — The 1,258-line InlineTextEditor.js could delegate text measurement and cursor positioning to smaller utilities.

2. **Consolidate Renderer Classes** — Consider a RendererRegistry pattern to reduce the 8 individual *Renderer.js files with similar patterns.

3. **TypeScript Migration** — The existing `types/layers.d.ts` could be expanded; consider incremental TypeScript adoption for type safety.

4. **API Response Types** — Add TypeScript/JSDoc types for all API responses to catch integration issues earlier.
