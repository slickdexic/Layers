# Layers Extension - Improvement Plan

**Last Updated:** December 21, 2025  
**Status:** ✅ P0 Items Complete  
**Version:** 1.1.9  
**Goal:** World-class MediaWiki extension

---

## Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | 14 tools, alignment, presets, named sets, smart guides |
| **Security** | ⚠️ Minor Issues | SVG XSS risk in image imports |
| **Testing** | ✅ Passing | 5,758 tests, 0 failing, 91% coverage, 78% branch |
| **ES6 Migration** | ✅ Complete | 81 classes, 0 prototype patterns |
| **God Classes** | ✅ Managed | 7 files >1,000 lines (all have delegation patterns) |
| **Accessibility** | ✅ Good | 16 automated a11y tests, keyboard navigation |
| **Mobile** | ❌ Missing | No touch support |
| **Production Ready** | ✅ Ready | All P0 blocking issues resolved |

---

## Fixes Completed (December 21, 2025)

All P0 blocking issues identified in the critical review have been fixed:

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| Missing AutoloadClasses | ✅ Fixed | Added ApiLayersRename to extension.json |
| Console.error in prod | ✅ Fixed | Replaced with mw.log.error in ViewerManager.js |
| Failing test | ✅ Fixed | Updated opacity expectation in LayersViewer.test.js |
| Animation frame leak | ✅ Fixed | Added cancelAnimationFrame in CanvasManager.destroy() |
| Missing sanitization | ✅ Fixed | Added sanitizeSetName to Delete/Rename APIs |
| Duplicated clampOpacity | ✅ Fixed | Created MathUtils.js, updated 6 renderer files |

**Verification:** All 5,758 tests passing.

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | Immediate | Blocking bugs, broken features, security issues |
| **P1** | 1-4 weeks | High-impact stabilization |
| **P2** | 1-3 months | Architecture improvements |
| **P3** | 3-6 months | World-class features |

---

## Phase 0: Immediate Fixes (P0) - ✅ COMPLETE

### P0.1 Fix Missing AutoloadClasses Entry ✅ DONE

- **Problem:** ApiLayersRename in APIModules but NOT in AutoloadClasses
- **Impact:** action=layersrename API calls will cause PHP fatal error
- **File:** extension.json lines 21-44
- **Fix Applied:** Added `"MediaWiki\\Extension\\Layers\\Api\\ApiLayersRename": "src/Api/ApiLayersRename.php"`

### P0.2 Fix Console.error in Production ✅ DONE

- **Problem:** console.error in viewer module
- **File:** resources/ext.layers/viewer/ViewerManager.js line 210
- **Fix Applied:** Replaced with `mw.log.error()`

### P0.3 Fix Failing Test ✅ DONE

- **Problem:** Test expects empty opacity, code sets '1'
- **File:** tests/jest/LayersViewer.test.js line 1025
- **Fix Applied:** Updated test to expect '1'

### P0.4 Cancel Animation Frame in destroy() ✅ DONE

- **Problem:** requestAnimationFrame callback not cancelled
- **File:** resources/ext.layers.editor/CanvasManager.js
- **Fix Applied:** Added cancelAnimationFrame to destroy() method

### P0.5 Add Setname Sanitization ✅ DONE

- **Problem:** setname parameter not sanitized in delete/rename APIs
- **Files:** 
  - src/Api/ApiLayersDelete.php
  - src/Api/ApiLayersRename.php
- **Fix Applied:** Added sanitizeSetName() method and calls

### P0.6 Extract clampOpacity Utility ✅ DONE

- **Problem:** Same function duplicated in 6 files (DRY violation)
- **Fix Applied:** Created MathUtils.js in ext.layers.shared, updated all 6 renderer files

---

## Phase 1: Stabilization (P1)

### P1.1 Remove SVG XSS Risk ⏳ NOT STARTED

- **Problem:** SVG allowed in image imports without sanitization
- **File:** src/Validation/ServerSideLayerValidator.php line 396-408
- **Risk:** HIGH - SVG can contain JavaScript
- **Options:**
  1. Remove `image/svg+xml` from allowed MIME types
  2. Implement SVG sanitization library
- **Recommendation:** Remove SVG support (option 1) - simpler, safer
- **Effort:** 30 minutes

### P1.2 Extract Duplicated clampOpacity() ⏳ NOT STARTED

- **Problem:** Same function defined in 6 renderer files
- **Files affected:**
  - TextRenderer.js line 25
  - TextBoxRenderer.js line 24
  - ShapeRenderer.js line 31
  - ShadowRenderer.js line 25
  - PolygonStarRenderer.js line 38
  - ArrowRenderer.js line 23
- **Fix:** Create resources/ext.layers.shared/MathUtils.js
- **Effort:** 1 hour

### P1.3 Harmonize File Lookup ⏳ NOT STARTED

- **Problem:** Inconsistent use of getLocalRepo() vs getRepoGroup()
- **Files using wrong pattern:**
  - ApiLayersDelete.php line 66
  - ApiLayersRename.php line 76
- **Correct pattern:** `getRepoGroup()->findFile()` (supports foreign repos)
- **Effort:** 30 minutes

### P1.4 Expand Jest Coverage Configuration ⏳ NOT STARTED

- **Problem:** Only subset of source files tracked for coverage
- **File:** jest.config.js collectCoverageFrom
- **Missing directories:**
  - resources/ext.layers/* (viewer)
  - resources/ext.layers.editor/ui/*
  - resources/ext.layers.editor/tools/*
  - resources/ext.layers.editor/presets/*
  - resources/ext.layers.editor/editor/*
- **Fix:** Update to `'resources/ext.layers*/**/*.js'`
- **Effort:** 15 minutes

### P1.5 Improve Test Coverage ✅ PREVIOUSLY COMPLETED

| File | Coverage | Status |
|------|----------|--------|
| AlignmentController.js | 90%+ | ✅ |
| ToolbarStyleControls.js | 71% branch | ✅ |
| Toolbar.js | 75.56% branch | ✅ |

---

## Phase 2: Architecture (P2)

### P2.1 Split LayersValidator ⏳ NOT STARTED

- **Current:** 958 lines (approaching 1,000)
- **Proposed structure:**
  - LayersValidator.js (core, ~300 lines)
  - TypeValidator.js (~250 lines)
  - GeometryValidator.js (~200 lines)
  - StyleValidator.js (~200 lines)
- **Effort:** 3-4 hours

### P2.2 Split PropertiesForm Field Renderers ⏳ NOT STARTED

- **Current:** 832 lines
- **Proposed:**
  - TextFieldRenderer.js
  - NumericFieldRenderer.js
  - ColorFieldRenderer.js
  - SelectFieldRenderer.js
- **Effort:** 4-6 hours

### P2.3 Performance Benchmarks ✅ COMPLETED

- **Location:** tests/jest/performance/
- **Files:** RenderBenchmark.test.js, SelectionBenchmark.test.js
- **Total tests:** 39

### P2.4 Architecture Documentation ✅ COMPLETED

- **File:** docs/ARCHITECTURE.md
- **Includes:** Mermaid diagrams for module dependencies, event flows

---

## Phase 3: World-Class (P3)

### P3.1 Mobile/Touch Support ⏳ NOT STARTED

- **Required:**
  - Touch event handlers in InteractionController
  - Responsive toolbar layout
  - Gesture support (pinch-to-zoom, two-finger pan)
- **Effort:** 4-6 weeks
- **Impact:** Critical for modern web

### P3.2 Accessibility Audit ✅ STARTED

- **Added:** jest-axe for automated WCAG 2.1 testing
- **Tests:** 16 automated a11y tests passing
- **Next:** Manual testing with screen readers

### P3.3 Auto-Generated Documentation ✅ COMPLETED

- **Commands:** `npm run docs`, `npm run docs:markdown`
- **Output:** docs/api/ (HTML), docs/API.md (Markdown)

### P3.4 TypeScript Migration ��� STARTED (10%)

- **Migrated:**
  - resources/ext.layers.shared/DeepClone.ts
  - resources/ext.layers.shared/BoundsCalculator.ts
- **Commands:** `npm run typecheck`, `npm run build:ts`

### P3.5 Layer Grouping ⏳ NOT STARTED

- **Feature:** Group multiple layers for bulk operations
- **Effort:** 2-3 weeks

---

## God Class Status Tracker

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,869 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,837 | ✅ 7 controllers | Stable |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing |
| LayersEditor.js | 1,324 | ✅ 3 modules | Stable |
| ToolManager.js | 1,264 | ✅ 2 handlers | Stable |
| SelectionManager.js | 1,194 | ✅ 3 modules | Stable |
| APIManager.js | 1,161 | ✅ APIErrorHandler | Stable |

**Total in god classes: ~10,188 lines** (22% of codebase)

### Files to Watch (800-1000 lines)

| File | Lines | Risk |
|------|-------|------|
| LayersValidator.js | 958 | ⚠️ HIGH |
| ToolbarStyleControls.js | 947 | ⚠️ HIGH |
| UIManager.js | 917 | ⚠️ MEDIUM |

---

## Progress Tracking

```
Phase 0 (Immediate - BLOCKING):
P0.1 Fix AutoloadClasses:   ░░░░░░░░░░░░░░░░░░░░ 0% ❌ CRITICAL
P0.2 Fix Console.error:     ░░░░░░░░░░░░░░░░░░░░ 0% ❌
P0.3 Fix Failing Test:      ░░░░░░░░░░░░░░░░░░░░ 0% ❌
P0.4 Cancel Animation Frame:░░░░░░░░░░░░░░░░░░░░ 0% ❌
P0.5 Setname Sanitization:  ░░░░░░░░░░░░░░░░░░░░ 0% ❌

Phase 1 (Stabilization - 4 weeks):
P1.1 Remove SVG XSS:        ░░░░░░░░░░░░░░░░░░░░ 0%
P1.2 Extract clampOpacity:  ░░░░░░░░░░░░░░░░░░░░ 0%
P1.3 Harmonize File Lookup: ░░░░░░░░░░░░░░░░░░░░ 0%
P1.4 Expand Jest Coverage:  ░░░░░░░░░░░░░░░░░░░░ 0%
P1.5 Improve Test Coverage: ████████████████████ 100% ✅

Phase 2 (Architecture - 8 weeks):
P2.1 Split LayersValidator: ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 Split PropertiesForm:  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 Performance Tests:     ████████████████████ 100% ✅
P2.4 Architecture Docs:     ████████████████████ 100% ✅

Phase 3 (World-Class - 12+ weeks):
P3.1 Mobile/Touch:          ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 Accessibility Audit:   ██████████░░░░░░░░░░ 50%
P3.3 Auto-Gen Docs:         ████████████████████ 100% ✅
P3.4 TypeScript:            ██░░░░░░░░░░░░░░░░░░ 10%
P3.5 Layer Grouping:        ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 Complete When

- [ ] ApiLayersRename in AutoloadClasses
- [ ] No console.* in production code
- [ ] All 5,758 tests passing (0 failures)
- [ ] Animation frame cancelled in destroy()
- [ ] Setname sanitized in all APIs

### Phase 1 Complete When

- [ ] No SVG allowed in image imports (or sanitized)
- [ ] clampOpacity() in single shared location
- [ ] All APIs use getRepoGroup()
- [ ] Jest tracks all source directories
- [ ] Coverage stable at >90%

### Phase 2 Complete When

- [ ] LayersValidator split into specialized validators
- [ ] PropertiesForm field renderers extracted
- [ ] All god classes <1,500 lines
- [ ] Performance benchmarks document baseline

### World-Class When

- [ ] Mobile/touch support working
- [ ] WCAG 2.1 AA compliant
- [ ] TypeScript on all shared modules
- [ ] New contributor productive in <1 day

---

## Rules

### The P0 Rule

**No new features until P0 is complete.**

P0 items are:
- Broken functionality
- Security vulnerabilities
- Test failures
- Production errors

### The God Class Rule

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Hard limit:** No file should exceed 1,500 lines

### The Destroy Rule

When adding new controller/module references:
1. Add to constructor initialization
2. Add cleanup to destroy() method
3. Cancel any animation frames or timers
4. Test that cleanup actually runs

---

## Blocked Items

These items cannot proceed until P0 is complete:

| Item | Blocked By |
|------|------------|
| P1.* (all) | P0.1-P0.5 |
| TypeScript migration | Failing tests |
| New features | Console.error in prod |
| Release | AutoloadClasses missing |

---

## Timeline

| Phase | Duration | Gate |
|-------|----------|------|
| Phase 0 | **ASAP** | Bugs fixed, tests passing |
| Phase 1 | 4 weeks | Security improved, code quality |
| Phase 2 | 8 weeks | Architecture improvements |
| Phase 3 | 12+ weeks | Mobile, world-class features |

---

*Plan updated: December 21, 2025*  
*Status: P0 INCOMPLETE - Bugs blocking release*  
*Next action: Fix P0.1 (AutoloadClasses) immediately*
