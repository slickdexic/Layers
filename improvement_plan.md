# Layers Extension - Improvement Plan

**Last Updated:** December 1, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Production blockers | Immediate |
| **P1** | High - Significant quality/maintainability impact | 2-4 weeks |
| **P2** | Medium - Quality improvements | 2-3 months |
| **P3** | Low - Nice to have | Long term |

---

## Current Status Summary (December 2025)

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 1,442 | 1,500+ | +58 |
| Overall Coverage | 69.38% | 70% | +0.62% |
| CanvasManager.js lines | 1,897 | <800 | -1,097 |
| WikitextHooks.php lines | 1,553 | <400 | -1,153 |
| ESLint errors | 0 | 0 | ✅ Met |
| PHP source errors | 0 | 0 | ✅ Met |
| Window.* exports | 25+ | <10 | -15+ |
| Event systems | 4 | 2 | -2 |

### Recent Progress
- ✅ CanvasManager reduced from 3,523 to 1,877 lines (47% reduction)
- ✅ 6 canvas controllers extracted with 97-100% coverage
- ✅ LayersHtmlInjector.php created (259 lines)
- ✅ LayersParamExtractor.php created (303 lines)
- ✅ Test coverage increased from 54.78% to 69.38% (CanvasEvents.js: 18.97% → 98.07%)
- ✅ Empty catch blocks fixed
- ✅ Debug console statements removed
- ✅ **RenderCoordinator.js created (343 lines, 30 tests)** - rAF batching optimization
- ✅ **RenderCoordinator integrated into CanvasManager**
- ✅ **LayersEditorCore.test.js created (52 tests)** - comprehensive LayersEditor unit tests
- ✅ **RotatedResize.test.js created (12 tests)** - rotated shape resize behavior tests
- ✅ **Fixed rotated resize UX** - opposite edge stays fixed when resizing rotated shapes

---

## Phase 0: Critical (P0) — Immediate Priority

### 0.1 🏗️ Continue CanvasManager.js Decomposition

**Priority:** P0 - CRITICAL  
**Status:** 🟡 In Progress (47% reduction achieved)  
**Effort:** 3-4 days  
**Risk:** HIGH  
**Current:** 1,877 lines | **Target:** <800 lines

**Completed Extractions:**
- ✅ ZoomPanController.js (348 lines, 97% coverage)
- ✅ GridRulersController.js (390 lines, 97% coverage)
- ✅ TransformController.js (1,027 lines, 100% coverage)
- ✅ HitTestController.js (382 lines, 98% coverage)
- ✅ DrawingController.js (620 lines, 97% coverage)
- ✅ ClipboardController.js (226 lines, 98% coverage)
- ✅ TextUtils.js (191 lines)
- ✅ **RenderCoordinator.js (343 lines, 30 tests)** - NEW

**Remaining Extractions:**

| New Module | Est. Lines | Responsibilities |
|------------|------------|------------------|
| **CanvasCore.js** | ~400 | Canvas setup, context, init, resize |
| **InteractionController.js** | ~300 | Mouse/touch delegation, drag state |

**Tasks:**
- [x] Map remaining methods to proposed modules
- [ ] Extract CanvasCore.js with init(), resize(), setupContext()
- [x] Extract RenderCoordinator.js with performRedraw(), scheduleRedraw() ✅
- [ ] Extract InteractionController.js with event delegation
- [ ] Update CanvasManager to compose extracted modules
- [x] Add tests for each module (target 80%+ coverage) - RenderCoordinator: 30 tests ✅
- [x] Verify all 1,287 tests still pass ✅

**Acceptance Criteria:**
- [ ] CanvasManager.js <800 lines
- [x] Each extracted module >80% coverage - RenderCoordinator complete
- [x] No functionality regressions - verified with 1,287 tests

---

### 0.2 🧪 Increase Core Module Test Coverage

**Priority:** P0 - CRITICAL  
**Status:** 🔴 Not Started  
**Effort:** 3-5 days  
**Risk:** LOW

**Current Coverage (needs improvement):**

| File | Lines | Current | Target |
|------|-------|---------|--------|
| LayersEditor.js | 1,756 | ~42% | 60% |
| CanvasManager.js | 1,877 | ~38% | 50% |
| CanvasEvents.js | 554 | ✅ 98.07% | ✅ Done |

**Tasks:**
- [ ] Add LayersEditor initialization tests
- [ ] Add LayersEditor save/load workflow tests
- [ ] Add LayersEditor layer CRUD operation tests
- [x] Add CanvasEvents mouse event tests (91 tests)
- [x] Add CanvasEvents touch event tests
- [x] Add CanvasEvents keyboard event tests
- [ ] Add CanvasManager tool switching tests
- [ ] Add CanvasManager render cycle tests
- [ ] Update jest.config.js with coverage thresholds

**Acceptance Criteria:**
- [ ] LayersEditor.js ≥50% coverage
- [x] CanvasEvents.js ≥50% coverage (achieved 98.07%)
- [ ] CanvasManager.js ≥50% coverage
- [x] Overall coverage ≥70% (achieved 69.38% - nearly there)

---

### 0.3 🏗️ Complete WikitextHooks.php Refactor

**Priority:** P0 - HIGH  
**Status:** 🟡 In Progress (~35% complete)  
**Effort:** 2-3 days  
**Risk:** MEDIUM  
**Current:** 1,553 lines | **Target:** <400 lines

**Completed:**
- ✅ LayersHtmlInjector.php (259 lines)
- ✅ LayersParamExtractor.php (303 lines)
- ✅ Centralized logging helper

**Remaining:**

| New Module | Est. Lines | Hook Methods |
|------------|------------|--------------|
| **ImageLinkProcessor.php** | ~250 | onMakeImageLink2, onLinkerMakeImageLink |
| **ThumbnailProcessor.php** | ~250 | onThumbnailBeforeProduceHTML |
| **ParserProcessor.php** | ~200 | onParserMakeImageParams, onParserGetImageLinkOptions |

**Tasks:**
- [ ] Create ImageLinkProcessor.php for image-related hooks
- [ ] Create ThumbnailProcessor.php for thumbnail hooks
- [ ] Create ParserProcessor.php for parser hooks
- [ ] Refactor WikitextHooks.php to delegate to processors
- [ ] Add PHPUnit tests for new processors
- [ ] Verify all wikitext embedding scenarios work

**Acceptance Criteria:**
- [ ] WikitextHooks.php <400 lines
- [ ] Each processor has PHPUnit tests
- [ ] PHP lint and phpcs pass

---

## Phase 1: High Priority (P1) — Next Sprint

### 1.1 🔧 Consolidate Event Systems

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** HIGH

**Current State (1,887 lines across 4 files):**

| File | Lines | Action |
|------|-------|--------|
| EventHandler.js | 512 | **Merge** into CanvasInputHandler |
| EventManager.js | 119 | **Inline** into LayersEditor |
| EventSystem.js | 702 | **Refactor** to EventBus.js |
| CanvasEvents.js | 554 | **Merge** into CanvasInputHandler |

**Target State:**

| File | Lines | Purpose |
|------|-------|---------|
| EventBus.js | ~300 | Custom event pub/sub only |
| CanvasInputHandler.js | ~500 | All DOM canvas events |

**Tasks:**
- [ ] Document current event flow for each file
- [ ] Create EventBus.js from EventSystem.js core
- [ ] Merge EventHandler + CanvasEvents into CanvasInputHandler.js
- [ ] Inline EventManager into LayersEditor
- [ ] Remove duplicate handlers from CanvasManager
- [ ] Update all references
- [ ] Add tests for merged functionality

**Acceptance Criteria:**
- [ ] Only 2 event-related files remain
- [ ] All event flows documented
- [ ] All tests pass

---

### 1.2 🔧 Complete StateManager Migration

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 2 days  
**Risk:** MEDIUM

**Components Bypassing StateManager:**

| Component | Local State | Should Use StateManager |
|-----------|-------------|------------------------|
| CanvasManager | `zoom`, `pan`, `currentTool` | Yes |
| Toolbar | Direct canvas manipulation | Yes |
| LayerPanel | Direct canvas calls | Yes |

**Tasks:**
- [ ] Move CanvasManager.zoom/pan to StateManager
- [ ] Move CanvasManager.currentTool to StateManager
- [ ] Update Toolbar to use StateManager
- [ ] Update LayerPanel to use StateManager
- [ ] Add state subscriptions for UI updates
- [ ] Remove duplicate state variables
- [ ] Add state consistency tests

**Acceptance Criteria:**
- [ ] Single source of truth for all editor state
- [ ] No direct state manipulation outside StateManager

---

### 1.3 📝 Fix PHP Test Style Warnings

**Priority:** P1 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1 hour  
**Risk:** LOW

**Current Warnings (11):**
- SpaceBeforeSingleLineComment in test files
- Line length warnings (>120 chars)
- assertEmpty usage warnings

**Tasks:**
- [ ] Fix comment formatting in test files
- [ ] Split long lines
- [ ] Replace assertEmpty with specific assertions
- [ ] Run `npm run test:php` to verify

**Acceptance Criteria:**
- [ ] `npm run test:php` shows 0 warnings

---

## Phase 2: Medium Priority (P2) — Next Quarter

### 2.1 📦 Migrate to ES Modules

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1 week  
**Risk:** MEDIUM

**Migration Order (by dependency depth):**

1. **No dependencies:**
   - LayersConstants.js
   - GeometryUtils.js
   - TextUtils.js
   - ErrorHandler.js

2. **Single dependency:**
   - ValidationManager.js
   - CanvasRenderer.js

3. **Multiple dependencies (last):**
   - CanvasManager.js
   - LayersEditor.js

**Tasks:**
- [ ] Add ES module support to webpack config
- [ ] Convert LayersConstants.js to ES module
- [ ] Convert GeometryUtils.js to ES module
- [ ] Update ResourceLoader config in extension.json
- [ ] Test in MediaWiki environment
- [ ] Document migration pattern

**Acceptance Criteria:**
- [ ] At least 4 utility files converted
- [ ] Pattern documented
- [ ] Webpack builds successfully

---

### 2.2 ⚡ Implement Performance Optimizations

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3-5 days  
**Risk:** MEDIUM

**Optimizations (in order of impact):**

1. **requestAnimationFrame batching** — Coalesce redraw requests
2. **Layer caching** — Cache unchanged layers as ImageData
3. **Dirty region tracking** — Only redraw affected areas

**Tasks:**
- [ ] Implement scheduleRedraw() with rAF batching
- [ ] Add layer cache in RenderCoordinator
- [ ] Invalidate cache on layer change
- [ ] Add performance metrics logging
- [ ] Profile before/after

**Acceptance Criteria:**
- [ ] Max 1 full redraw per animation frame
- [ ] Measurable performance improvement
- [ ] No visual regressions

---

### 2.3 ♿ Implement Canvas Accessibility

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3 days  
**Risk:** LOW

**Tasks:**
- [ ] Add visually-hidden layer description container
- [ ] Sync descriptions with canvas changes
- [ ] Add aria-live="polite" for dynamic updates
- [ ] Implement keyboard layer navigation
- [ ] Test with NVDA and VoiceOver
- [ ] Update ACCESSIBILITY.md

**Acceptance Criteria:**
- [ ] Screen readers announce layer info
- [ ] Keyboard navigation works
- [ ] ARIA attributes properly applied

---

### 2.4 🏗️ Split Large UI Components

**Priority:** P2 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2-3 days  
**Risk:** LOW

**Files to Consider:**

| File | Lines | Split Into |
|------|-------|------------|
| Toolbar.js | 1,666 | ToolbarCore, ToolButtons, ToolOptions |
| LayerPanel.js | 1,103 | LayerList, LayerItem, LayerProperties |
| LayersValidator.js | 1,001 | (Acceptable, well-organized) |

**Tasks:**
- [ ] Extract ToolbarCore.js (~400 lines)
- [ ] Extract ToolButtons.js (~500 lines)
- [ ] Extract LayerList.js (~400 lines)
- [ ] Update imports and tests

---

## Phase 3: Long Term (P3) — Future Improvements

### 3.1 📘 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** Ongoing

**Tasks:**
- [ ] Add tsconfig.json
- [ ] Create type definitions (Layer, Tool, Event)
- [ ] Write new features in TypeScript
- [ ] Add .ts handling to webpack
- [ ] Migrate one file as proof of concept

**Dependencies:** 2.1 (ES Modules) should complete first

---

### 3.2 🔬 Add E2E Tests

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1 week

**Tasks:**
- [ ] Set up Playwright or Cypress
- [ ] Test full save/load workflow
- [ ] Test layer creation (all types)
- [ ] Test layer manipulation
- [ ] Add to CI pipeline

---

### 3.3 ♿ Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2 weeks

**Tasks:**
- [ ] Color contrast audit
- [ ] Implement high contrast mode
- [ ] Add skip links
- [ ] Comprehensive keyboard navigation
- [ ] Screen reader testing
- [ ] Accessibility conformance statement

---

### 3.4 🗂️ Layer Set Delete and Rename API

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 3-5 days

**Tasks:**
- [ ] Add ApiLayersDelete.php
- [ ] Add ApiLayersRename.php
- [ ] Add deletelayersets permission
- [ ] Add UI: Delete button with confirmation
- [ ] Add UI: Rename button with input
- [ ] Add MediaWiki logging entries
- [ ] Write tests

---

## Known Limitations / Polish Items (P4)

Minor UX issues that don't affect functionality but could be improved in the future.

### 4.1 🖱️ Resize Cursor Alignment on Rotated Shapes

**Priority:** P4 - POLISH  
**Status:** 📋 Documented  
**Effort:** 2-4 hours

**Issue:** When resizing a rotated shape via edge handles (n/s/e/w), the mouse cursor shows a bidirectional arrow (`ns-resize`, `ew-resize`, etc.) that aligns to the nearest 45° increment rather than exactly perpendicular to the rotated edge.

**Example:** A shape rotated 30° will show a diagonal `nesw-resize` cursor when dragging the north handle, but the actual drag direction is 30° from vertical.

**Why:** CSS only provides 4 resize cursor directions (ns, ew, nesw, nwse). There's no native way to rotate a cursor to an arbitrary angle.

**Possible Solutions:**
1. **Custom cursor images** — Generate rotated SVG/PNG cursors for common angles (15°, 30°, 45°, 60°, 75°, 90°)
2. **Canvas-rendered cursor** — Hide system cursor, draw custom cursor on canvas
3. **Accept limitation** — Current behavior is functional, just not pixel-perfect

**Note:** The resize behavior itself is correct — only the cursor visual is imprecise.

---

## Quick Reference

### P0 — Must Do Now

| # | Task | Effort | Status |
|---|------|--------|--------|
| 0.1 | Continue CanvasManager split | 3-4 days | 🟡 In Progress |
| 0.2 | Core module test coverage | 3-5 days | 🔴 Not Started |
| 0.3 | WikitextHooks refactor | 2-3 days | 🟡 In Progress |

### P1 — Next Sprint

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1.1 | Consolidate event systems | 3-4 days | 🔴 Not Started |
| 1.2 | Complete StateManager migration | 2 days | 🔴 Not Started |
| 1.3 | Fix PHP test warnings | 1 hour | 🔴 Not Started |

### P2-P3 — Later

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 2.1 | ES Modules migration | 1 week | P2 |
| 2.2 | Performance optimizations | 3-5 days | P2 |
| 2.3 | Canvas accessibility | 3 days | P2 |
| 2.4 | Split large UI components | 2-3 days | P2 |
| 3.1 | TypeScript migration | Ongoing | P3 |
| 3.2 | E2E tests | 1 week | P3 |
| 3.3 | WCAG compliance | 2 weeks | P3 |
| 3.4 | Layer set delete/rename | 3-5 days | P3 |

---

## Metrics Dashboard

```
Coverage Progress:
Overall:       61.23% ============-------- 70% target (+8.77% needed)
Core Modules:  ~25%   =====--------------- 50% target (+25% needed)

Code Size Progress:
CanvasManager: 1,877 lines ===============------ 800 target (-1,077 lines)
WikitextHooks: 1,553 lines ===============------ 400 target (-1,153 lines)

Technical Debt:
Window.* exports: 25+  ===============------ 10 target
Event systems:    4    ===============------ 2  target
ESLint errors:    0    ✅ TARGET MET
PHP errors:       0    ✅ TARGET MET
```

---

## How to Contribute

1. Pick an unassigned P0 or P1 task
2. Create a branch: `refactor/task-name` or `fix/task-name`
3. Implement with tests (target 80% coverage for new code)
4. Run `npm test` and `npm run test:php`
5. Submit PR referencing this plan (e.g., "Addresses improvement_plan.md #0.1")
6. Update this document when complete

---

## Notes

- All refactoring must maintain backward compatibility
- Each extraction should have corresponding tests
- Document breaking changes in CHANGELOG.md
- Phase 0 tasks are blockers — prioritize these
- Coordinate with maintainers before major architectural changes
- Run both `npm test` and `npm run test:php` before submitting PRs

---

**Last updated:** December 1, 2025
