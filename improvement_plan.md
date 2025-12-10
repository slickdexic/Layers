# Layers Extension - Improvement Plan

**Last Updated:** December 10, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension based on the comprehensive code review performed December 10, 2025.

### Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Functionality** | ✅ Working | Extension is usable in production |
| **Test Suite** | ✅ Strong | 3,853+ tests, 85%+ coverage |
| **LayerRenderer Coverage** | ✅ Excellent | 89% statements (146 tests) |
| **Bundle Size** | 🔴 Critical | 1.06MB - needs code splitting |
| **Architecture** | 🟠 Debt | 700 prototype methods, 8 god classes |
| **Memory Management** | ✅ Verified | Clean - EventTracker pattern used |

---

## Priority Legend

| Priority | Timeline | Definition |
|----------|----------|------------|
| **P0** | Immediate (< 1 week) | Blocking issues, known bugs |
| **P1** | Short-term (1-4 weeks) | High-impact improvements |
| **P2** | Medium-term (1-2 months) | Important refactoring |
| **P3** | Long-term (3+ months) | Modernization efforts |

---

## Phase 0: Immediate Fixes (P0)

### P0.1 ✅ Fix Shadow Rendering Bug

**Status:** ✅ COMPLETE (December 10, 2025)  
**Effort:** 2-3 days  
**Impact:** User-visible rendering bug

**Problem (FIXED):**
Two bugs were fixed:
1. When a shape has both stroke and fill with shadows enabled (spread = 0), the stroke shadow was invisible
2. Text shadow spread had no effect

**Solution Applied:**
Changed all shape rendering to always use offscreen canvas technique for shadows, eliminating compositing issues. Text now uses circular pattern with multiple low-opacity layers for spread effect.

**Files Changed:**
- `resources/ext.layers.shared/LayerRenderer.js` - drawRectangle, drawCircle, drawEllipse, drawText

**Acceptance Criteria:**
- [x] All shapes with stroke+fill+shadow render shadow correctly
- [x] Text shadow spread works
- [x] No impact on shapes without shadows

---

### P0.2 ✅ Clean Up Abandoned BaseShapeRenderer

**Status:** ✅ COMPLETE (December 10, 2025)  
**Effort:** 1 day  
**Impact:** Code clarity, accurate test coverage metrics

**Problem (FIXED):**
`resources/ext.layers.shared/renderers/` contained abandoned refactoring code:
- `BaseShapeRenderer.js` (338 lines, **0% coverage**)
- `HighlightRenderer.js`

These files were NOT registered in `extension.json` and were never used.

**Resolution:**
Deleted the entire `renderers/` directory and associated test files:
- `resources/ext.layers.shared/renderers/` (removed)
- `tests/jest/renderers/` (removed)
- `coverage/lcov-report/ext.layers.shared/renderers/` (removed)

**Action Items:**
- [x] Verified files were truly unused (grep for imports)
- [x] Deleted directory (chosen option)
- [x] Removed associated tests and coverage reports

---

### P0.3 � Audit Remaining Memory Leak Risks

**Status:** ✅ REVIEWED (December 10, 2025)  
**Effort:** 3-5 days (originally estimated)  
**Impact:** Runtime stability in long sessions

**Audit Results:**

The initial grep analysis suggested 94 `addEventListener` calls vs 33 `removeEventListener` calls, indicating 61 potential leaks. However, detailed code review reveals **the codebase is well-designed**:

**Properly Managed (using EventTracker pattern):**
- `UIManager.js` - Uses EventTracker, has destroy() method
- `LayersEditor.js` - Uses EventTracker, has destroy() method  
- `CanvasEvents.js` - Has explicit destroy() method with all removes

**Properly Managed (cleanup callbacks in dialogs):**
- `DialogManager.js` - Each dialog has cleanup function that removes listeners
- `ColorPickerDialog.js` - close() method removes all listeners
- `ConfirmDialog.js` - close() method removes listeners

**Safe by Design (DOM removal triggers GC):**
- `PropertiesForm.js` - Listeners on form elements that are removed from DOM
- `TextInputController.js` - Modal removed from DOM on close
- `ImportExportManager.js` - FileReader callbacks are one-time

**Intentionally Persistent (page lifecycle):**
- `EditorBootstrap.js` - Global error handlers and beforeunload (expected to persist)
- `init.js` - DOMContentLoaded (fires once)
- `LayersNamespace.js` - DOMContentLoaded (fires once)
- `AccessibilityAnnouncer.js` - DOMContentLoaded with `{once: true}`

**Recommendation:** No immediate action needed. The memory management architecture is sound.

**Future Enhancement (P3+):**
Consider adding an automated lint rule or test to verify all addEventListener calls have matching removeEventListener or use EventTracker.

---

## Phase 1: High-Impact Improvements (P1)

### P1.1 🔴 Implement Viewer/Editor Code Splitting

**Status:** NOT STARTED  
**Effort:** 2-3 weeks  
**Impact:** **MASSIVE** - reduces viewer payload by ~80%

**Problem:**
The viewer (article pages with layers) loads the **entire 1.06MB** editor code even though viewers never edit.

**Current Architecture:**
```
ext.layers.shared  → DeepClone.js, LayerRenderer.js
ext.layers         → LayersViewer.js, init.js (viewer)
ext.layers.editor  → **53 files** (only needed for editing)
```

**Solution:**
1. Create `ext.layers.viewer` module (minimal, <100KB)
2. Keep `ext.layers.editor` for editing (full ~900KB)
3. Load editor via ResourceLoader only when action=editlayers

**Expected Impact:**
- Viewer payload: 1.06MB → <200KB (81% reduction)
- Editor payload: Unchanged

**Acceptance Criteria:**
- [ ] Viewers load <200KB JavaScript
- [ ] Editors still get full functionality
- [ ] No regression in either mode

---

### P1.2 ✅ Increase LayerRenderer.js Test Coverage (60% → 80%)

**Status:** ✅ COMPLETE (89% achieved, December 10, 2025)  
**Effort:** 1 week  
**Final:** 89% statements, 81% branches, 96% functions  
**Tests:** 146 total tests

**Accomplishments:**
- Started at 62% coverage
- Added comprehensive tests for all shape types:
  - Shadow rendering (rectangle, circle, ellipse, line, path, polygon, star, arrow)
  - Shadow spread=0 edge cases (bug fix coverage)
  - Rotation, opacity, stroke variants
  - Text shadow with spread effect
  - Text stroke + shadow combinations
  - Arrow head types (pointed, chevron, standard, double)
  - Blur with/without background images
- Fixed polygon tests to use correct API (sides/radius vs points array)

**Remaining Uncovered (~11%):**
- drawBlur internal temp canvas paths (require DOM mocking)

---

### P1.3 🟠 Eliminate Duplicate Global Exports

**Status:** NOT STARTED  
**Effort:** 1-2 weeks  
**Current:** 127 exports  
**Target:** <10 exports

**Problem:**
Every module exports twice:
```javascript
window.Layers.Canvas.Manager = CanvasManager;  // Namespaced (keep)
window.CanvasManager = CanvasManager;          // Global (remove)
```

**Action Items:**
- [ ] Audit all 127 global exports
- [ ] Update internal code to use `window.Layers.*`
- [ ] Add deprecation warnings for direct global access
- [ ] Remove direct global exports

---

## Phase 2: Medium-Term Refactoring (P2)

### P2.1 Split LayerRenderer.js (2,288 lines → multiple files)

**Status:** NOT STARTED  
**Effort:** 3-4 weeks

**Problem:**
Single file handles ALL shape rendering. Any change affects everything.

**Proposed Structure:**
```
ext.layers.shared/
├── LayerRenderer.js          # Facade (~300 lines)
├── rendering/
│   ├── RenderContext.js
│   ├── RectangleRenderer.js
│   ├── CircleRenderer.js
│   ├── EllipseRenderer.js
│   ├── PolygonRenderer.js
│   ├── StarRenderer.js
│   ├── ArrowRenderer.js
│   ├── LineRenderer.js
│   ├── PathRenderer.js
│   ├── TextRenderer.js
│   ├── HighlightRenderer.js
│   └── BlurRenderer.js
└── effects/
    ├── ShadowEffect.js
    └── GlowEffect.js
```

**Note:** This supersedes the abandoned `renderers/` approach.

**Acceptance Criteria:**
- [ ] No file > 500 lines in rendering/
- [ ] Each renderer has >80% test coverage
- [ ] All existing tests pass
- [ ] Visual regression tests pass

---

### P2.2 Continue CanvasManager Controller Extraction

**Status:** 45% COMPLETE (9/~15 controllers)  
**Effort:** 2-3 weeks

**Already Extracted (9 controllers with 85%+ coverage):**
- ZoomPanController.js (97% coverage)
- GridRulersController.js (94% coverage)
- TransformController.js (86% coverage)
- HitTestController.js (98% coverage)
- DrawingController.js (100% coverage)
- ClipboardController.js (98% coverage)
- RenderCoordinator.js (93% coverage)
- InteractionController.js (100% coverage)
- TextInputController.js (86% coverage)

**Still in CanvasManager (~1,000 lines to extract):**
- Background image loading (~150 lines)
- Layer operations (add/remove/reorder, ~200 lines)
- Style state management (~100 lines)
- Bounds calculations (~100 lines)

**Target:** CanvasManager <500 lines (facade only)

---

### P2.3 ES6 Class Migration Pilot (10 files)

**Status:** 4.6% COMPLETE (32/700 methods)  
**Effort:** 2 weeks

**Pilot Candidates (well-tested, smaller files):**

| File | Lines | Coverage | Priority |
|------|-------|----------|----------|
| EventTracker.js | 224 | 96% | High |
| StyleController.js | 184 | 100% | High |
| EventManager.js | 126 | 100% | High |
| TextUtils.js | 194 | 89% | Medium |
| ImageLoader.js | 293 | 91% | Medium |
| GeometryUtils.js | ~200 | ~90% | Medium |
| DeepClone.js | ~100 | ~95% | Low |
| AccessibilityAnnouncer.js | ~150 | 94% | Low |
| ModuleRegistry.js | 360 | 94% | Medium |
| HistoryManager.js | 625 | 90% | High |

**Conversion Pattern:**
```javascript
// Before:
function TextUtils() { ... }
TextUtils.prototype.method = function() { ... };
window.TextUtils = TextUtils;

// After:
class TextUtils {
    constructor() { ... }
    method() { ... }
}
window.Layers.Utils.Text = TextUtils;
```

**Acceptance Criteria:**
- [ ] 10 files converted to ES6 classes
- [ ] All tests still pass
- [ ] No functionality regression

---

## Phase 3: Long-Term (P3)

### P3.1 Complete ES6 Class Migration

**Timeline:** 4-6 weeks after pilot  
**Target:** All 700 prototype methods converted

**Prerequisites:**
- P2.3 pilot successful
- Pattern established and documented

---

### P3.2 TypeScript Migration

**Timeline:** 2-3 months after ES6 complete  
**Prerequisites:**
- ES6 migration complete
- Global exports eliminated
- Module boundaries clear

**Approach:**
1. Add .d.ts files for existing code
2. Convert files incrementally (`.js` → `.ts`)
3. Start with utilities, end with UI components

---

### P3.3 ES Modules with Tree-Shaking

**Timeline:** After TypeScript  
**Prerequisites:**
- Globals eliminated
- Module boundaries defined

**Benefits:**
- Automatic dead code elimination
- Better bundle analysis
- Modern import/export syntax

---

### P3.4 Unified Validation System

**Timeline:** 3+ months  
**Effort:** 2-3 weeks

**Problem:**
Dual validation systems (client + server) must stay in sync manually.

**Solution:**
Generate client validation from server rules:
```php
// Server defines rules
$rules = [
    'opacity' => ['type' => 'float', 'min' => 0, 'max' => 1],
    // ...
];

// Export to JSON for client
file_put_contents('validation-rules.json', json_encode($rules));
```

```javascript
// Client loads generated rules
const rules = require('./validation-rules.json');
// Generate validation functions from rules
```

---

## Progress Tracking

### Visual Progress

```
Phase 0 (Immediate):
P0.1 Shadow Bug Fix:          ████████████████████ 100% ✅
P0.2 Cleanup BaseShapeRenderer: ████████████████████ 100% ✅
P0.3 Memory Leak Audit:       ████████████████████ 100% ✅ (verified clean)

Phase 1 (High Impact):
P1.1 Code Splitting:          ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 LayerRenderer Coverage:  █████████████░░░░░░░ 66% (was 60%)
P1.3 Global Export Cleanup:   ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Refactoring):
P2.1 Split LayerRenderer:     ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 CanvasManager Extraction: █████████░░░░░░░░░░░ 45%
P2.3 ES6 Class Pilot:         █░░░░░░░░░░░░░░░░░░░ 5%

Phase 3 (Long-term):
P3.1 Complete ES6 Migration:  █░░░░░░░░░░░░░░░░░░░ 5%
P3.2 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 ES Modules:              ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Unified Validation:      ░░░░░░░░░░░░░░░░░░░░ 0%
```

### Verification Commands

```bash
# Full test suite with coverage
npm run test:js -- --coverage

# Event listener balance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# File sizes (god classes)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | sort -rn | head -10

# Global exports
grep -rE "window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c

# Prototype vs class count
echo "Prototypes: $(grep -r "\.prototype\." resources --include="*.js" | wc -l)"
echo "Classes: $(grep -rE "^class |^[[:space:]]*class " resources --include="*.js" | wc -l)"
```

---

## Success Metrics

### Phase 0 Complete When:
- [x] Shadow rendering bug fixed
- [x] BaseShapeRenderer either deleted or integrated (deleted)
- [x] All high-risk files have EventTracker or destroy() (verified - already implemented)

### Phase 1 Complete When:
- [ ] Viewer payload <200KB
- [ ] LayerRenderer.js coverage ≥80%
- [ ] Global window.X exports <10

### Phase 2 Complete When:
- [ ] No file >1,000 lines (except entry points)
- [ ] CanvasManager <500 lines
- [ ] 10+ files converted to ES6 classes

### Project "Healthy" When:
- [ ] All coverage thresholds met (80%+ statements)
- [ ] No god classes (>1,000 lines except entry points)
- [ ] Bundle <400KB for viewer
- [ ] ES6 classes throughout
- [ ] All tests pass consistently
- [ ] No memory leaks in long sessions

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 1-2 weeks | None - start immediately |
| Phase 1 | 4-6 weeks | Phase 0 complete |
| Phase 2 | 4-6 weeks | Parallel with late Phase 1 |
| Phase 3 | 2-3 months | Phases 1-2 complete |

**Total: 5-6 months for healthy codebase state**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LayerRenderer split causes visual regressions | Medium | High | Visual regression testing |
| Memory leak fixes break functionality | Low | Medium | Test each fix individually |
| ES6 conversion introduces bugs | Low | Medium | Convert well-tested files first |
| Bundle splitting breaks loading | Medium | High | Feature flag rollout |
| Test coverage drops during refactoring | Medium | Medium | No merge without coverage check |

---

## Quick Wins (Can Do Today)

1. **Run full coverage report** - `npm run test:js -- --coverage`
2. **Audit abandoned renderers** - `grep -r "BaseShapeRenderer" extension.json`
3. **Count event listener imbalance** - Commands above
4. **Document current state** - Screenshot coverage report
5. **Apply shadow bug fix** - Fix is already documented

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*
