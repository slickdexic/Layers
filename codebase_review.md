# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 6, 2025 (Updated January 9, 2025)  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)  
**Review Type:** Critical Architectural Audit  
**Version:** 0.8.1-dev

---

## Executive Summary

The "Layers" extension is a MediaWiki extension providing non-destructive image annotation capabilities. After a thorough review and **significant refactoring work**, the codebase has improved substantially.

**Original Assessment: 4.5/10**  
**Current Assessment: 6.5/10** - Significant progress made on P0 critical blockers

### ✅ Completed Improvements (January 2025)

1. **Shared LayerRenderer Created** - Eliminated ~900 lines of duplicate rendering code
   - New: `resources/ext.layers.shared/LayerRenderer.js` (1,168 lines)
   - `LayersViewer.js` reduced from 1,225 → 330 lines (-73%)

2. **CanvasManager Decomposed** - Reduced from 5,462 → 1,899 lines (-65%)
   - 8 controllers extracted to `canvas/` directory (~4,200 lines total)
   - Now acts as a thin facade pattern

3. **Namespace Consolidation** - `LayersNamespace.js` provides unified `window.Layers` namespace
   - 45+ classes mapped to logical namespace groups
   - Deprecation warnings available in debug mode

**Detailed improvement plan: [`improvement_plan.md`](./improvement_plan.md)**

---

## Current State (January 2025)

### What's Been Fixed

1. **LayersViewer duplication eliminated.** Now uses shared `LayerRenderer` for all rendering.

2. **CanvasManager decomposed.** Eight controllers extracted, following facade pattern.

3. **Namespace structure established.** All exports now available via `window.Layers.*`.

### What Still Needs Work

1. **Bundle size still too large** (~1,000KB total, target <400KB)

2. **Prototype-based patterns** still pervasive (833 assignments)

3. **ShapeRenderer** still duplicates some LayerRenderer functionality (~36KB overlap)

4. **LayersEditor.js** still 1,889 lines (should be split further)

---

## Assessment Scores (Updated January 2025)

| Category | Original | Current | Status |
|----------|----------|---------|--------|
| **Architecture** | 3/10 | 5/10 | 🟡 Improved - controllers extracted |
| **Code Quality** | 4/10 | 5/10 | 🟡 Better patterns emerging |
| **Security** | 8/10 | 8/10 | 🟢 Unchanged - still excellent |
| **Performance** | 4/10 | 4/10 | 🟠 Bundle size still concerning |
| **Accessibility** | 3/10 | 3/10 | 🔴 Still needs work |
| **Documentation** | 7/10 | 8/10 | 🟢 Improved with README files |
| **Testing** | 8/10 | 8/10 | 🟢 2,715 tests still passing |
| **Maintainability** | 2/10 | 5/10 | 🟡 Much improved file organization |

---

## Updated Metrics (January 9, 2025)

### JavaScript Codebase

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Total JS bytes | 909KB | ~1,000KB | <400KB | 🟡 Added shared module |
| Files over 800 lines | 11 | 9 | 0 | 🟢 Improving |
| Files over 1,000 lines | 6 | 5 | 0 | 🟢 Improving |
| LayersViewer.js lines | 1,225 | 330 | <400 | ✅ Complete |
| CanvasManager.js lines | 5,462* | 1,899 | 400 | 🟢 -65% |

*Note: CanvasManager was reduced through controller extractions prior to this review.

### Controller Extractions (P0.2 Complete)

| File | Lines | Purpose |
|------|-------|---------|
| ZoomPanController.js | 343 | Zoom and pan operations |
| GridRulersController.js | 385 | Grid/ruler rendering |
| TransformController.js | 965 | Resize, rotation, drag |
| HitTestController.js | 382 | Selection hit testing |
| DrawingController.js | 622 | Shape creation/preview |
| ClipboardController.js | 212 | Copy/cut/paste |
| RenderCoordinator.js | 387 | Render scheduling |
| InteractionController.js | 487 | Event handling |
| **Total Extracted** | **~4,200** | |

### Test Coverage (Unchanged)

| Metric | Value | Status |
|--------|-------|--------|
| Jest tests | 2,715 | 🟢 All passing |
| ESLint | Passing | 🟢 |
| Stylelint | Passing | 🟢 |

---

## CRITICAL Issues (Must Fix)

### 1. Global Namespace Pollution - Architecture Blocker

**Severity: CRITICAL** 🔴

There are **34 unique `window.X =` exports** polluting the global namespace. This is not acceptable for a modern JavaScript codebase.

```javascript
// This pattern appears 34 times across the codebase:
window.CanvasManager = CanvasManager;
window.LayersEditor = LayersEditor;
// etc.
```

**Global Exports Found (34):**
```
window.APIManager, window.CanvasEvents, window.CanvasManager,
window.CanvasRenderer, window.CanvasUtilities, window.ClipboardController,
window.ColorPickerDialog, window.ConfirmDialog, window.DrawingController,
window.EventManager, window.EventTracker, window.GeometryUtils,
window.GridRulersController, window.HistoryManager, window.HitTestController,
window.IconFactory, window.ImageLoader, window.ImportExportManager,
window.InteractionController, window.LayerPanel, window.LayerSetManager,
window.PropertiesForm, window.RenderCoordinator, window.ShapeRenderer,
window.StateManager, window.StyleController, window.TextUtils,
window.Toolbar, window.ToolbarKeyboard, window.ToolbarStyleControls,
window.TransformationEngine, window.TransformController, window.UIManager,
window.ValidationManager
```

**Why This Is Critical:**
- **No tree-shaking** - All 909KB loaded regardless of what's used
- **TypeScript impossible** - Cannot type global namespace pollution
- **ES modules blocked** - Cannot use `import/export`
- **Load order fragile** - Files must load in exact sequence
- **Testing friction** - Every test needs global mocks
- **Namespace collisions** - Other extensions will conflict

---

### 2. God Classes - Development Velocity Killer

**Severity: CRITICAL** 🔴

**11 files exceed 800 lines, with 6 exceeding 1,000 lines.** This is the primary reason the codebase is unmaintainable.

**CanvasManager.js Analysis (1,980 lines):**

This single file handles:
- Canvas initialization and lifecycle
- Zoom and pan operations
- Layer selection coordination  
- Layer manipulation (add, remove, duplicate, reorder)
- Clipboard operations
- Grid and ruler coordination
- Drawing tool delegation
- Style management
- Hit testing coordination
- Transform coordination
- **60+ methods in a single class**

**The cognitive load required to modify this file is prohibitive.** Any change risks breaking unrelated functionality.

---

### 3. LayersViewer Duplicates Editor Rendering

**Severity: HIGH** 🟠

`LayersViewer.js` (1,225 lines) contains **complete duplications** of rendering logic from the editor:

- `renderRectangle`, `renderCircle`, `renderEllipse`, `renderPolygon`
- `renderStar`, `renderText`, `renderArrow`, `renderPath`, `renderBlur`
- Shadow, opacity, and transform handling

**This means:**
- Bug fixes must be applied in TWO places
- Rendering inconsistencies between viewer and editor
- Double the maintenance burden

**Solution:** Extract a shared `LayerRenderer` module used by both viewer and editor.

---

### 4. Prototype-Based Pattern Is Technical Debt

**Severity: HIGH** 🟠

The codebase has **833 prototype assignments** but only **21 ES6 class declarations**.

```javascript
// Current pattern (833 occurrences):
CanvasManager.prototype.addLayer = function ( layer ) { ... };

// Modern pattern (21 occurrences):
class APIManager {
    addLayer(layer) { ... }
}
```

**Why This Matters:**
- Prototype chain is harder to reason about
- No private fields without closures
- IDE autocomplete and navigation is degraded
- New developers are confused by mixed patterns

---

### 5. MessageHelper Incomplete Adoption

**Severity: MEDIUM** 🟠

`MessageHelper.js` exists but **5+ files still use raw `mw.message()` patterns:**

Files with direct `mw.message()` calls:
- `ImportExportManager.js`
- `LayerPanel.js`
- `LayerSetManager.js`
- `LayersValidator.js`
- `Toolbar.js`

---

### 6. E2E Test Coverage Is Inadequate

**Severity: MEDIUM** 🟠

Only **1 E2E test file** with **4 of 11 layer types** tested.

**Covered:** Rectangle, Circle, Text, Arrow

**NOT Covered:**
- Ellipse, Polygon, Star, Line, Highlight, Path, Blur
- Named layer sets workflow
- Revision history navigation
- Multi-layer selection
- Import/export functionality
- Undo/redo operations

---

## MEDIUM Issues

### 7. PHP Logger Pattern Not Fully Migrated

`LoggerAwareTrait` exists and is used in 4 files, but 5+ files still have inline `getLogger()` implementations:
- `Hooks.php`
- `ApiLayersSave.php`
- `LayersDatabase.php` (injected via constructor, not trait)

### 8. Bundle Size Is Excessive

**909KB unminified JavaScript** is excessive for an annotation editor. Even with 50% minification, that's 450KB+ of code for a feature that should be <150KB.

### 9. No Performance Monitoring

No benchmarks exist for:
- Canvas render time with N layers
- Memory usage with complex polygons
- Time to interactive on editor load

### 10. Accessibility Is Non-Existent

Canvas-based applications are inherently inaccessible, but **no accommodations have been made:**
- No ARIA live region for layer announcements
- No keyboard navigation between layers
- No screen reader descriptions of layer content
- No focus management

---

## What's Actually Working Well

### 1. Backend Security (8/10) 🟢

The PHP backend demonstrates security best practices:
- CSRF token enforcement on all writes
- Rate limiting via MediaWiki's `pingLimiter`
- Strict property whitelist (47 validated fields)
- Type/range validation on all numeric fields
- Text sanitization (HTML stripped, protocol checks)
- Parameterized SQL queries

### 2. Unit Test Coverage (8/10) 🟢

**2,715 Jest tests** across 62 test files is genuinely impressive. All tests pass.

### 3. No Console Leaks 🟢

All logging correctly uses `mw.log.*` instead of `console.*`.

### 4. Error Handling Present 🟢

114 `try/catch` blocks exist throughout the codebase.

### 5. EventTracker for Memory Safety 🟢

`EventTracker.js` provides proper event listener cleanup.

---

## Recommendations by Priority

### P0 - Critical (Block Further Development Until Fixed)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Extract shared LayerRenderer for Viewer/Editor | Eliminate 1,000+ lines duplication | 3-4 days |
| 2 | Create namespace consolidation plan | Enable modernization | 1 day |
| 3 | Split CanvasManager into 5 focused modules | Make code navigable | 1 week |

### P1 - High (Next Sprint)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Split LayersEditor.js | Decouple UI orchestration | 1 week |
| 2 | Split TransformController.js | Separate transform types | 3 days |
| 3 | Complete MessageHelper migration | Eliminate duplication | 4 hours |
| 4 | Migrate PHP to LoggerAwareTrait | Eliminate duplication | 2 hours |

### P2 - Medium (This Quarter)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Expand E2E to all 11 layer types | Regression safety | 1 week |
| 2 | Add canvas accessibility layer | WCAG compliance | 1 week |
| 3 | Begin ES module migration | Enable tree-shaking | 2 weeks |
| 4 | Add performance benchmarks | Detect regressions | 2 days |

### P3 - Long Term

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | TypeScript migration | Type safety | 2+ months |
| 2 | Complete ES modules | Modern tooling | 1 month |
| 3 | Lazy load editor components | Reduce initial payload | 2 weeks |

---

## Technical Debt Quantified

| Debt Type | Count | Fix Time |
|-----------|-------|----------|
| God classes (>800 lines) | 11 | 3-4 weeks |
| Global exports to eliminate | 34 | 1 week |
| Prototype→class migrations | 833 methods | 2-3 weeks |
| Duplicate rendering code | ~1,000 lines | 3-4 days |
| Duplicate message patterns | 5 files | 4 hours |
| Duplicate PHP logger patterns | 3 files | 2 hours |
| Missing E2E layer tests | 7 types | 3-4 days |
| Missing accessibility | Complete | 1-2 weeks |

**Total estimated refactoring time: 8-12 weeks**

---

## Conclusion

The Layers extension is **functional but deeply flawed architecturally**. It works today because of the extensive test suite that catches regressions, but the codebase is:

1. **Unmaintainable** - Files are too large to navigate
2. **Unmodernizable** - Global pollution blocks ES modules/TypeScript
3. **Duplicative** - Viewer and editor have separate rendering code
4. **Inaccessible** - No accommodations for disabled users

**The path forward requires:**
1. Immediate extraction of shared rendering code
2. Systematic god class decomposition
3. Namespace consolidation before any ES module work
4. Prototype→class migration as files are touched

Without this work, every new feature will be harder than the last, and eventually the codebase will become unmaintainable.

**See [`improvement_plan.md`](./improvement_plan.md) for the detailed, prioritized action plan.**

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on December 6, 2025*
