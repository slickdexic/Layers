# Layers Extension - Improvement Plan

**Last Updated:** December 9, 2025  
**Status:** P0 items in progress  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. All metrics have been verified against the actual codebase on December 9, 2025.

### Current Critical State

- ❌ **User-visible bug:** Stroke shadow renders over fill (documented fix never applied)
- ❌ **CI failing:** Function coverage at 79.46% (target: 80%)
- ❌ **5 modules at 0% coverage:** EventManager, AccessibilityAnnouncer, MessageHelper, LayersConstants, compat

---

## Verified Metrics (December 9, 2025)

### JavaScript

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Total bundle size | **1,059,962 bytes (1.06MB)** | <400KB | 🔴 165% over |
| Files >1,000 lines | **8** | 0 | 🔴 |
| Global window.X exports | **123** | 0 | 🔴 |
| addEventListener imbalance | **75 unmatched** | 0 | 🔴 |
| Prototype methods | **680** | 0 | 🔴 |
| ES6 classes | **32** | 680+ | 🔴 |
| ESLint errors | **0** | 0 | ✅ |

### Test Coverage

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement coverage | ~84% | 80% | ✅ |
| Branch coverage | ~69% | 65% | ✅ |
| Line coverage | ~84% | 80% | ✅ |
| **Function coverage** | **79.46%** | 80% | ❌ **CI FAILING** |
| Jest tests | 3,437 | - | ✅ |
| Jest test suites | 76 | - | ✅ |

### Modules at 0% Coverage (Critical)

| Module | Lines | Risk | Priority |
|--------|-------|------|----------|
| EventManager.js | 126 | 🔴 Core event system | P0 |
| AccessibilityAnnouncer.js | 223 | 🔴 A11y compliance | P0 |
| MessageHelper.js | 168 | 🔴 User messaging | P0 |
| LayersConstants.js | 331 | 🟡 Constants only | P2 |
| compat.js | 35 | 🟡 Polyfills | P3 |

### Modules with Low Coverage

| Module | Lines | Coverage | Target | Priority |
|--------|-------|----------|--------|----------|
| APIManager.js | 921 | **27%** | 70% | P1 |
| ErrorHandler.js | 576 | **57%** | 75% | P1 |
| SelectionManager.js | 1,261 | **68%** | 80% | P2 |

---

## Priority Legend

| Priority | Timeline | Definition |
|----------|----------|------------|
| **P0** | Immediate | Critical bugs, CI failures, user-visible issues |
| **P1** | 2-4 weeks | Significant maintainability/quality impacts |
| **P2** | 1-2 months | Important improvements |
| **P3** | 3+ months | Long-term modernization |

---

## Phase 0: Critical Blockers (P0)

### P0.1 🔴 Fix Stroke Shadow Over Fill Bug

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL - User-visible rendering bug  
**Effort:** 2-3 days  
**Risk:** LOW - Solution documented

**Problem:**
When a shape has both stroke and fill with shadows enabled (spread=0), the stroke shadow renders ON TOP OF the fill instead of behind it. Users see shadow artifacts inside shapes with opaque fill.

**Root Cause:**
In `LayerRenderer.js`, when shadow is enabled:
1. `applyShadow()` sets canvas shadow properties
2. `fill()` is called → shadow drawn with fill ✅
3. `stroke()` is called → shadow drawn AGAIN, on top of the fill ❌

**Evidence:**
- Bug documented in `docs/archive/BUG_SHADOW_FILL_OVERLAP_2025-12-09.md`
- Document describes `destination-over` fix
- Fix was **never applied** to LayerRenderer.js (grep confirms 0 matches)

**Solution (from documentation):**
```javascript
// 1. Apply shadow → Draw fill
this.applyShadow( layer, shadowScale );
if ( hasFill ) {
    this.ctx.fillStyle = layer.fill;
    this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
    this.ctx.fill();
}

// 2. Clear shadow → Draw stroke (no shadow)
if ( this.hasShadowEnabled( layer ) && spread === 0 ) {
    this.clearShadow();
}
if ( hasStroke ) {
    this.ctx.strokeStyle = layer.stroke;
    this.ctx.lineWidth = strokeW;
    this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
    this.ctx.stroke();
}

// 3. Draw stroke shadow BEHIND using destination-over
if ( hasStroke && this.hasShadowEnabled( layer ) && spread === 0 ) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-over';
    this.applyShadow( layer, shadowScale );
    this.ctx.stroke();
    this.ctx.restore();
}
```

**Files to Update:**
| File | Method | Lines |
|------|--------|-------|
| LayerRenderer.js | `drawRectangle` | ~580-680 |
| LayerRenderer.js | `drawCircle` | ~710-780 |
| LayerRenderer.js | `drawEllipse` | ~790-880 |
| LayerRenderer.js | `drawPolygon` | ~900-1000 |
| LayerRenderer.js | `drawStar` | ~1050-1150 |

**Acceptance Criteria:**
- [ ] Shape with opaque fill: shadow only visible outside shape
- [ ] Shape with 50% fill: stroke shadow visible through fill
- [ ] Shape with no fill: stroke casts correct shadow
- [ ] All 3,437 tests still pass
- [ ] Visual verification in browser

---

### P0.2 Raise Function Coverage to 80%

**Status:** ❌ NOT STARTED  
**Priority:** CRITICAL - CI is failing  
**Effort:** 2-3 days  
**Current:** 79.46% | **Target:** 80% | **Gap:** 0.54%

**Problem:**
Function coverage is at 79.46%, failing the 80% threshold. Jest exits with error.

**Strategy:**
Add tests for highest-impact 0% coverage modules to push over threshold.

**Quick wins (sorted by impact):**

| Module | Functions | Est. Tests Needed |
|--------|-----------|-------------------|
| EventManager.js | 8 funcs | ~15 tests |
| MessageHelper.js | 12 funcs | ~20 tests |
| AccessibilityAnnouncer.js | 6 funcs | ~12 tests |

Adding ~47 tests should push coverage over 80%.

**Acceptance Criteria:**
- [ ] `npm run test:js -- --coverage` passes all thresholds
- [ ] EventManager.js has 80%+ coverage
- [ ] MessageHelper.js has 80%+ coverage
- [ ] AccessibilityAnnouncer.js has 80%+ coverage

---

### P0.3 Add EventManager.js Tests

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - 0% coverage on core module  
**Effort:** 0.5 day

**Problem:**
`EventManager.js` (126 lines) handles the extension's event system with **0% test coverage**.

**Test File:** `tests/jest/EventManager.test.js` (create new)

**Functions to Test:**
- `constructor()` - initialization
- `on()` - event subscription
- `off()` - event unsubscription
- `emit()` - event emission
- `once()` - one-time subscription
- `removeAllListeners()` - cleanup

**Test Cases (minimum 15):**
```javascript
describe( 'EventManager', () => {
    describe( 'constructor', () => {
        it( 'should create instance with empty listeners' );
    });
    
    describe( 'on', () => {
        it( 'should add listener for event' );
        it( 'should allow multiple listeners for same event' );
        it( 'should handle invalid event names gracefully' );
    });
    
    describe( 'off', () => {
        it( 'should remove specific listener' );
        it( 'should handle removing non-existent listener' );
    });
    
    describe( 'emit', () => {
        it( 'should call all listeners for event' );
        it( 'should pass arguments to listeners' );
        it( 'should handle emitting event with no listeners' );
    });
    
    describe( 'once', () => {
        it( 'should call listener only once' );
        it( 'should remove listener after first call' );
    });
    
    describe( 'removeAllListeners', () => {
        it( 'should remove all listeners for specific event' );
        it( 'should remove all listeners when no event specified' );
    });
});
```

**Acceptance Criteria:**
- [ ] `tests/jest/EventManager.test.js` exists
- [ ] 15+ tests covering all public methods
- [ ] 80%+ function coverage on EventManager.js

---

### P0.4 Add AccessibilityAnnouncer.js Tests

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - 0% coverage on a11y module  
**Effort:** 0.5 day

**Problem:**
`AccessibilityAnnouncer.js` (223 lines) handles ARIA live regions for screen readers with **0% test coverage**.

**Test File:** `tests/jest/AccessibilityAnnouncer.test.js` (create new)

**Functions to Test:**
- `constructor()` - creates ARIA live region
- `announce()` - announces message to screen readers
- `announcePolite()` - polite announcement (low priority)
- `announceAssertive()` - assertive announcement (high priority)
- `destroy()` - cleanup

**Acceptance Criteria:**
- [ ] `tests/jest/AccessibilityAnnouncer.test.js` exists
- [ ] 12+ tests covering accessibility patterns
- [ ] 80%+ function coverage

---

### P0.5 Add MessageHelper.js Tests

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - 0% coverage  
**Effort:** 0.5 day

**Problem:**
`MessageHelper.js` (168 lines) handles user-facing messages with **0% test coverage**.

**Test File:** `tests/jest/MessageHelper.test.js` (create new)

**Functions to Test:**
- Message retrieval methods
- Parameter substitution
- Fallback handling
- MediaWiki message integration mocking

**Acceptance Criteria:**
- [ ] `tests/jest/MessageHelper.test.js` exists
- [ ] 20+ tests covering message patterns
- [ ] 80%+ function coverage

---

## Phase 1: High Priority (P1)

### P1.1 Improve APIManager.js Coverage (27% → 70%)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - Core API module undertested  
**Effort:** 2-3 days

**Problem:**
`APIManager.js` (921 lines) handles all API communication but has only **27% coverage**.

**Current Tests:** `tests/jest/APIManager.test.js` exists but only tests ~1/4 of functionality.

**Untested Areas:**
- Error handling paths
- Retry logic
- Rate limiting handling
- Named layer sets operations
- Revision loading

**Acceptance Criteria:**
- [ ] APIManager.js coverage ≥ 70%
- [ ] All error paths tested
- [ ] Retry logic tested
- [ ] Rate limiting tested

---

### P1.2 Improve ErrorHandler.js Coverage (57% → 75%)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM-HIGH  
**Effort:** 1-2 days

**Problem:**
`ErrorHandler.js` (576 lines) at **57% coverage** - error handling module should be well-tested.

**Acceptance Criteria:**
- [ ] ErrorHandler.js coverage ≥ 75%
- [ ] All error type handlers tested
- [ ] Recovery paths tested

---

### P1.3 Fix Memory Leaks (Event Listener Imbalance)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - Runtime stability  
**Effort:** 1 week

**Problem:**
106 `addEventListener` calls but only 31 `removeEventListener` calls = 75 potential leaks.

**Analysis Required:**
1. Audit all addEventListener calls
2. Categorize by type:
   - DOMContentLoaded (one-time, auto-cleanup)
   - Element listeners (cleaned when element removed)
   - Document/window listeners (need explicit cleanup)
3. Add EventTracker to modules missing it

**Modules to Audit:**
- [ ] PropertiesForm.js
- [ ] ToolbarStyleControls.js
- [ ] UIManager.js (partially done)
- [ ] CanvasManager.js
- [ ] DialogManager.js

**Acceptance Criteria:**
- [ ] All document/window listeners have matching removeEventListener
- [ ] EventTracker used consistently
- [ ] No memory growth in 1-hour session (verified in DevTools)

---

### P1.4 Split CanvasManager.js (<1000 lines target)

**Status:** ❌ NOT STARTED  
**Priority:** HIGH - God class  
**Effort:** 2-3 weeks

**Problem:**
CanvasManager.js at **2,027 lines** with 100+ methods is a god class.

**Already Extracted (9 controllers):**
- ZoomPanController.js (343 lines)
- GridRulersController.js (385 lines)
- TransformController.js (1,231 lines)
- HitTestController.js (382 lines)
- DrawingController.js (632 lines)
- ClipboardController.js (220 lines)
- RenderCoordinator.js (387 lines)
- InteractionController.js (487 lines)
- TextInputController.js (187 lines)

**Remaining Extraction Candidates:**
| Code Block | Est. Lines | Priority |
|------------|-----------|----------|
| Background image loading/fallback | ~100 | Medium |
| Style state management | ~80 | Low (duplicate of StyleController?) |
| Layer bounds calculations | ~70 | Medium |
| Canvas pooling | ~50 | Low |

**Target:** CanvasManager.js < 1,000 lines as thin facade.

**Acceptance Criteria:**
- [ ] CanvasManager.js < 1,000 lines
- [ ] All extracted code has tests
- [ ] All 3,437+ tests pass
- [ ] No functionality regression

---

## Phase 2: Medium Priority (P2)

### P2.1 Bundle Size Reduction (<500KB target)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2-3 weeks  
**Current:** 1.06MB | **Target:** <500KB

**Strategies:**
1. **Lazy load dialogs** - ColorPickerDialog, ImportExportManager
2. **Viewer/Editor split** - Viewers don't need editing tools
3. **Code splitting** - ResourceLoader module separation
4. **Dead code elimination** - Find and remove unused code

**Acceptance Criteria:**
- [ ] Bundle < 500KB unminified
- [ ] Viewer loads without editor code
- [ ] All functionality preserved

---

### P2.2 Eliminate Duplicate Global Exports

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 1-2 weeks

**Problem:**
123 direct `window.X` exports despite namespace system.

**Solution:**
1. Update all internal code to use `window.Layers.*`
2. Remove duplicate `window.ClassName` exports
3. Keep namespace deprecation warnings for external users

**Acceptance Criteria:**
- [ ] Direct window.X exports < 10
- [ ] All internal code uses namespace
- [ ] Extension loads correctly

---

### P2.3 ES6 Class Conversion (10 files pilot)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 4-5 days

**Problem:**
680 prototype methods vs 32 ES6 classes (4.5% modernization).

**Pilot Candidates:**
1. TextUtils.js
2. ImageLoader.js
3. MessageHelper.js
4. CanvasUtilities.js
5. StyleController.js
6. ModuleRegistry.js
7. ErrorHandler.js
8. LayerSetManager.js
9. EventManager.js
10. StateManager.js

**Acceptance Criteria:**
- [ ] 10 files converted to ES6 classes
- [ ] Total ES6 classes: 42+
- [ ] All tests pass

---

### P2.4 Improve SelectionManager.js Coverage (68% → 80%)

**Status:** ❌ NOT STARTED  
**Priority:** MEDIUM  
**Effort:** 2-3 days

**Problem:**
Core selection module at 68% coverage.

**Acceptance Criteria:**
- [ ] SelectionManager.js coverage ≥ 80%
- [ ] Multi-select tested
- [ ] Marquee selection tested

---

### P2.5 Add Canvas Pooling for Shadow Rendering

**Status:** ❌ NOT STARTED  
**Priority:** LOW-MEDIUM  
**Effort:** 1-2 days

**Problem:**
`drawSpreadShadow()` creates new canvas on every call:
```javascript
const tempCanvas = document.createElement( 'canvas' );
```

**Solution:**
Pool temporary canvases for shadow rendering to reduce GC pressure.

---

## Phase 3: Long Term (P3)

### P3.1 Complete ES6 Class Migration

**Target:** All 680 prototype methods converted  
**Effort:** 4-6 weeks  
**Prerequisites:** P2.3 pilot successful

---

### P3.2 TypeScript Migration

**Target:** Type safety across codebase  
**Effort:** 2-3 months  
**Prerequisites:** ES6 migration complete, globals eliminated

---

### P3.3 ES Modules

**Target:** Full import/export syntax, tree-shaking  
**Effort:** 1 month  
**Prerequisites:** Globals eliminated

---

### P3.4 Validation Rule Generation

**Target:** Generate client validation from server rules  
**Effort:** 2 weeks  
**Benefit:** Eliminates dual maintenance

---

## Progress Tracking

### Verification Commands

```bash
# Test coverage (must pass thresholds)
npm run test:js -- --coverage

# Check for ESLint errors
npm test

# God classes remaining
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} + | sort -rn | head -10

# Global exports
grep -rE "window\.[A-Z][A-Za-z0-9]+ = " resources --include="*.js" | wc -l

# Event listener balance
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Bundle size
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -c
```

---

## Visual Progress

```
Phase 0 (Critical):
P0.1 Fix Shadow Bug:              ░░░░░░░░░░░░░░░░░░░░ 0% 🔴 CRITICAL
P0.2 Function Coverage to 80%:    ░░░░░░░░░░░░░░░░░░░░ 0% 🔴 CI FAILING
P0.3 EventManager Tests:          ░░░░░░░░░░░░░░░░░░░░ 0%
P0.4 AccessibilityAnnouncer Tests:░░░░░░░░░░░░░░░░░░░░ 0%
P0.5 MessageHelper Tests:         ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 1 (High):
P1.1 APIManager Coverage (70%):   ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 ErrorHandler Coverage (75%): ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 Fix Memory Leaks:            ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 Split CanvasManager:         ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 2 (Medium):
P2.1 Bundle Size Reduction:       ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 Eliminate Global Exports:    ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 ES6 Class Pilot (10 files):  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 SelectionManager Coverage:   ░░░░░░░░░░░░░░░░░░░░ 0%
P2.5 Shadow Canvas Pooling:       ░░░░░░░░░░░░░░░░░░░░ 0%

Phase 3 (Long-term):
P3.1 Complete ES6 Migration:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:        ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 ES Modules:                  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Validation Generation:       ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When:
- [ ] Shadow rendering bug fixed (stroke shadow behind fill)
- [ ] Function coverage ≥ 80%
- [ ] `npm run test:js -- --coverage` exits 0
- [ ] EventManager, AccessibilityAnnouncer, MessageHelper have 80%+ coverage

### Phase 1 Complete When:
- [ ] APIManager.js coverage ≥ 70%
- [ ] ErrorHandler.js coverage ≥ 75%
- [ ] No memory leaks in 1-hour session
- [ ] CanvasManager.js < 1,000 lines

### Phase 2 Complete When:
- [ ] Bundle size < 500KB
- [ ] Global window.X exports < 10
- [ ] 42+ ES6 class files
- [ ] SelectionManager.js coverage ≥ 80%

### Project "Healthy" When:
- [ ] No user-visible bugs
- [ ] All coverage thresholds passing
- [ ] No god classes (>1,000 lines except shared engines)
- [ ] Bundle < 400KB
- [ ] ES6 classes throughout
- [ ] All tests pass consistently

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 1-2 weeks | None - start immediately |
| Phase 1 | 4-6 weeks | Phase 0 complete |
| Phase 2 | 4-6 weeks | Parallel with late Phase 1 |
| Phase 3 | 2-3 months | Phases 1-2 complete |

**Total: 4-5 months for healthy codebase state**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Shadow fix causes regressions | Low | Medium | Test all 5 shape types, visual verification |
| Coverage threshold too strict | Low | Low | Can adjust Jest config if needed |
| CanvasManager split breaks functionality | Medium | High | Incremental extraction, feature flags |
| Memory leak fixes cause issues | Low | Medium | Test each fix individually |

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 9, 2025*
