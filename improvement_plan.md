# Layers Extension - Improvement Plan

**Last Updated:** December 10, 2025  
**Status:** Active Planning  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension based on the comprehensive code review performed December 10, 2025.

### Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Functionality** | ✅ Working | Extension is usable in production |
| **Test Suite** | ✅ Strong | 3,853 tests, 85.58% coverage |
| **Bundle Size** | 🔴 Critical | 1.06MB - needs code splitting |
| **Architecture** | 🟠 Debt | 700 prototype methods, 8 god classes |
| **Memory Management** | 🟠 Risk | 61 unmatched event listeners |

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

### P0.1 🔴 Fix Shadow Rendering Bug

**Status:** NOT STARTED  
**Effort:** 2-3 days  
**Impact:** User-visible rendering bug

**Problem:**
When a shape has both stroke and fill with shadows enabled (spread = 0), the stroke shadow renders ON TOP OF the fill instead of behind it.

**Location:** `resources/ext.layers.shared/LayerRenderer.js`

**Solution:**
The fix is documented in `docs/archive/BUG_SHADOW_FILL_OVERLAP_2025-12-09.md`. Apply the `destination-over` composite operation pattern to all shape draw methods.

**Affected Methods:**
- `drawRectangle()`
- `drawCircle()`
- `drawEllipse()`
- `drawPolygon()`
- `drawStar()`

**Acceptance Criteria:**
- [ ] All shapes with stroke+fill+shadow render shadow behind fill
- [ ] Visual regression tests pass
- [ ] No impact on shapes without shadows

---

### P0.2 🔴 Clean Up Abandoned BaseShapeRenderer

**Status:** NOT STARTED  
**Effort:** 1 day  
**Impact:** Code clarity, accurate test coverage metrics

**Problem:**
`resources/ext.layers.shared/renderers/` contains:
- `BaseShapeRenderer.js` (338 lines, **0% coverage**)
- `HighlightRenderer.js`

These files are NOT registered in `extension.json` ResourceModules and are not used in production. This abandoned refactoring adds confusion.

**Options:**
1. **Delete** - Remove the renderers/ directory entirely
2. **Complete** - Register modules, write tests, integrate with LayerRenderer

**Recommendation:** Delete unless there's active intent to complete the extraction.

**Action Items:**
- [ ] Verify files are truly unused (grep for imports)
- [ ] Either delete directory or add to extension.json
- [ ] If keeping, write tests for BaseShapeRenderer (currently 0%)
- [ ] Update documentation

---

### P0.3 🟠 Audit Remaining Memory Leak Risks

**Status:** NOT STARTED  
**Effort:** 3-5 days  
**Impact:** Runtime stability in long sessions

**Problem:**
94 `addEventListener` calls vs 33 `removeEventListener` calls = 61 potential leaks.

**High-Risk Files to Audit:**

| File | addEventListener | removeEventListener | Gap |
|------|------------------|---------------------|-----|
| PropertiesForm.js | 3 | 0 | +3 |
| UIManager.js | 5 | 2 | +3 |
| Various init files | Multiple | Few | ? |

**Action Items:**
- [ ] Audit PropertiesForm.js - add EventTracker or destroy()
- [ ] Audit UIManager.js - verify cleanup path
- [ ] Create checklist of all files with addEventListener
- [ ] Ensure all have matching cleanup

**EventTracker Pattern (use this):**
```javascript
// In constructor:
this.eventTracker = new EventTracker();

// When adding listeners:
this.eventTracker.add( element, 'click', this.handleClick.bind(this) );

// In destroy():
this.eventTracker.destroy();
```

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

### P1.2 🟠 Increase LayerRenderer.js Test Coverage (60% → 80%)

**Status:** NOT STARTED  
**Effort:** 1 week  
**Current:** 60.03%  
**Target:** 80%

**Problem:**
LayerRenderer.js is 2,288 lines with 60% test coverage. It's the core rendering engine - changes carry high regression risk.

**Uncovered Areas:**
- Spread shadow rendering paths
- Text rendering edge cases
- Blur effect handling
- Various error paths

**Action Items:**
- [ ] Review coverage report for specific gaps
- [ ] Add tests for uncovered draw methods
- [ ] Add tests for edge cases (negative dimensions, etc.)
- [ ] Target 80% coverage minimum

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
P0.1 Shadow Bug Fix:          ░░░░░░░░░░░░░░░░░░░░ 0%
P0.2 Cleanup BaseShapeRenderer: ░░░░░░░░░░░░░░░░░░░░ 0%
P0.3 Memory Leak Audit:       ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 1 (High Impact):
P1.1 Code Splitting:          ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 LayerRenderer Coverage:  ████████████░░░░░░░░ 60%
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
- [ ] Shadow rendering bug fixed
- [ ] BaseShapeRenderer either deleted or integrated
- [ ] All high-risk files have EventTracker or destroy()

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
