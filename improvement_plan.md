# Layers Extension - Improvement Plan

**Last Updated:** December 2, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Blocks development/CI | Immediate (this week) |
| **P1** | High - Significant quality/maintainability impact | 2-4 weeks |
| **P2** | Medium - Quality improvements | 1-2 months |
| **P3** | Low - Nice to have | 3+ months |

---

## Current Status Summary (December 2025)

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 2,059 | 1,500+ | ✅ Met (+63) |
| Overall Coverage | 84% | 70% | ✅ Met |
| CanvasManager.js lines | 1,896 | <800 | -1,096 |
| LayersEditor.js lines | 1,756 | <800 | -956 |
| WikitextHooks.php lines | 1,143 | <400 | -743 |
| ESLint errors (production) | 0 | 0 | ✅ Met |
| ESLint errors (archive) | 0 | 0 | ✅ Fixed |
| Window.* exports | 30+ | <10 | -20+ |

### Recent Achievements
- ✅ Test coverage increased from ~55% to 84%
- ✅ 8 canvas controllers extracted with 96%+ average coverage
- ✅ InteractionController.js created (380 lines, 100% line coverage)
- ✅ LayerPanel coverage improved from 49.8% to 77.3% (+27.5%)
- ✅ SelectionManager coverage improved from 60.3% to 90.7% (+30.4%)
- ✅ LayersEditor coverage improved from 61.7% to 73.7% (+12%)
- ✅ ToolManager.js tests created (59 tests, 64% coverage)
- ✅ UIManager.js tests created (81 tests)
- ✅ ModuleRegistry.js tests created (51 tests)
- ✅ CanvasUtilities.js tests created (63 tests) - NEW
- ✅ 4 PHP processor classes created (ImageLinkProcessor, ThumbnailProcessor, etc.)
- ✅ WikitextHooks reduced from 1,553 to 1,143 lines (26% reduction)
- ✅ Dead code archived (EventHandler.js, EventSystem.js - 1,214 lines)
- ✅ ESLint archive ignore fixed (4 errors → 0 errors)

---

## Phase 0: Critical (P0) — Immediate Priority

### 0.1 ✅ Fix ESLint Archive Ignore

**Priority:** P0 - BLOCKER  
**Status:** ✅ Completed  
**Effort:** 5 minutes  
**Risk:** None

**Problem:** Archived dead code files caused 4 ESLint errors in CI.

**Solution:** Added `"resources/ext.layers.editor/archive/"` to `.eslintrc.json` ignorePatterns.

**Acceptance Criteria:**
- [x] `npm test` passes with 0 ESLint errors
- [x] Archive folder excluded from linting

---

### 0.2 🏗️ Continue CanvasManager.js Decomposition

**Priority:** P0 - CRITICAL  
**Status:** 🟡 In Progress  
**Effort:** 3-5 days  
**Risk:** HIGH  
**Current:** 1,896 lines | **Target:** <800 lines

**Already Extracted (8 controllers):**
- ✅ ZoomPanController.js (348 lines, 97% coverage)
- ✅ GridRulersController.js (390 lines, 97.6% coverage)
- ✅ TransformController.js (1,027 lines, 90.7% coverage)
- ✅ HitTestController.js (382 lines, 99.2% coverage)
- ✅ DrawingController.js (620 lines, 100% coverage)
- ✅ ClipboardController.js (226 lines, 98.8% coverage)
- ✅ RenderCoordinator.js (343 lines, 91.6% coverage)
- ✅ InteractionController.js (380 lines, 100% coverage) - **NEW**

**Remaining Extractions:**

| New Module | Est. Lines | Responsibilities |
|------------|------------|------------------|
| **CanvasCore.js** | ~400 | Canvas element setup, context creation, resize handling, DPI scaling |

**Next Steps:**
- [ ] Integrate InteractionController into CanvasManager (delegate state properties)
- [ ] Map remaining CanvasManager methods to CanvasCore.js
- [ ] Extract CanvasCore.js with init(), resize(), getContext()
- [ ] Extract InteractionController.js with event coordination
- [ ] Update CanvasManager to compose new modules
- [ ] Add tests for each module (target 80%+ coverage)
- [ ] Verify all 1,593 tests still pass

**Acceptance Criteria:**
- [ ] CanvasManager.js <800 lines
- [ ] Each extracted module >80% coverage
- [ ] No functionality regressions

---

### 0.3 ✅ Increase Low-Coverage Module Tests

**Priority:** P0 - HIGH  
**Status:** ✅ Completed  
**Effort:** 3-5 days  
**Risk:** LOW

**Coverage Improvements Achieved:**

| File | Lines | Before | After | Target | Status |
|------|-------|--------|-------|--------|--------|
| LayerPanel.js | 1,103 | 49.8% | 77.3% | 70% | ✅ Met |
| SelectionManager.js | 950 | 60.3% | 90.7% | 70% | ✅ Met |
| LayersEditor.js | 1,756 | 61.7% | 73.7% | 70% | ✅ Met |

**Completed Tasks:**
- [x] LayerPanelExtended.test.js: 42 tests covering UI interactions, visibility, lock states
- [x] SelectionManagerExtended.test.js: 53 tests covering multi-select, group selection
- [x] LayersEditorExtended.test.js: 63 tests covering save/load, navigation, dialogs

**Acceptance Criteria:**
- [x] LayerPanel.js ≥70% coverage (77.3%)
- [x] SelectionManager.js ≥70% coverage (90.7%)
- [x] LayersEditor.js ≥70% coverage (73.7%)

---

## Phase 1: High Priority (P1) — Next 2-4 Weeks

### 1.1 ✅ Add Tests for Untested Modules

**Priority:** P1 - HIGH  
**Status:** ✅ Completed  
**Effort:** 2-3 days  
**Risk:** LOW

**Modules status:**

| Module | Lines | Coverage | Status |
|--------|-------|----------|--------|
| ToolManager.js | 955 | 64.3% | ✅ Done (59 tests) |
| UIManager.js | 594 | - | ✅ Done (81 tests) |
| ModuleRegistry.js | ~300 | - | ✅ Done (51 tests) |
| CanvasUtilities.js | ~150 | - | ✅ Done (63 tests) |
| Toolbar.js | 1,666 | - | ✅ Already had tests (82 tests) |

**Tasks:**
- [x] Create ToolManager.test.js with tool switching tests (59 tests, 64% coverage)
- [x] Create UIManager.test.js with UI creation/management tests (81 tests)
- [x] Create ModuleRegistry.test.js with dependency injection tests (51 tests)
- [x] Create CanvasUtilities.test.js with utility function tests (63 tests)
- [x] Toolbar.test.js already exists (82 tests)

**Acceptance Criteria:**
- [x] Each module has dedicated test file
- [x] Each module ≥50% coverage

---

### 1.2 🔧 Complete StateManager Migration

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** MEDIUM

**Problem:** 56 local state references in CanvasManager bypass StateManager:
- `this.zoom`, `this.pan`
- `this.currentTool`
- `this.layers`
- `this.selectedLayers`

**Components Bypassing StateManager:**

| Component | Bypass Pattern | Should Use |
|-----------|---------------|------------|
| CanvasManager | Direct this.* properties | StateManager.get/set |
| Toolbar | Direct canvas manipulation | StateManager events |
| LayerPanel | Direct canvas calls | StateManager subscriptions |

**Tasks:**
- [ ] Move CanvasManager.zoom/pan to StateManager
- [ ] Move CanvasManager.currentTool to StateManager
- [ ] Update Toolbar to dispatch through StateManager
- [ ] Update LayerPanel to use StateManager subscriptions
- [ ] Add state consistency tests
- [ ] Remove duplicate state variables

**Acceptance Criteria:**
- [ ] Single source of truth for all editor state
- [ ] No direct state manipulation outside StateManager
- [ ] All components subscribe to state changes

---

### 1.3 🔧 Fix Silent Error Suppression

**Priority:** P1 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 2-3 hours  
**Risk:** LOW

**Problem:** Some catch blocks silently ignore errors:
```javascript
// CanvasManager.js line 28
} catch ( e ) {
    // Ignore
}
```

**Tasks:**
- [ ] Find all `// Ignore` catch blocks
- [ ] Replace with ErrorHandler logging
- [ ] Add context to error messages
- [ ] Verify no user-facing changes

**Acceptance Criteria:**
- [ ] No silent catch blocks in production code
- [ ] All errors logged with context

---

### 1.4 📝 Fix PHP Test Warnings

**Priority:** P1 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 30 minutes  
**Risk:** None

**Current Warnings (4):**
- SpaceBeforeSingleLineComment in test files
- Line length warnings (>120 chars)
- assertEmpty usage warnings

**Tasks:**
- [ ] Fix comment formatting
- [ ] Split long lines
- [ ] Replace assertEmpty with specific assertions
- [ ] Run `npm run test:php` to verify

**Acceptance Criteria:**
- [ ] `npm run test:php` shows 0 warnings

---

## Phase 2: Medium Priority (P2) — Next 1-2 Months

### 2.1 📦 Migrate to ES Modules

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks  
**Risk:** MEDIUM

**Problem:** 30+ global window.* exports:
```javascript
// Current pattern (every file)
( function () {
    function MyClass() { ... }
    window.MyClass = MyClass;  // Global pollution
}());
```

**Migration Order (by dependency depth):**

**Phase 1 - No dependencies:**
- [ ] GeometryUtils.js
- [ ] TextUtils.js
- [ ] LayersConstants.js
- [ ] ErrorHandler.js

**Phase 2 - Single dependency:**
- [ ] ValidationManager.js
- [ ] CanvasRenderer.js

**Phase 3 - Multiple dependencies (later):**
- [ ] CanvasManager.js
- [ ] LayersEditor.js

**Tasks:**
- [ ] Configure webpack for ES module output
- [ ] Convert GeometryUtils.js to ES module
- [ ] Update ResourceLoader config in extension.json
- [ ] Test in MediaWiki environment
- [ ] Document migration pattern
- [ ] Create migration guide for other files

**Acceptance Criteria:**
- [ ] At least 4 utility files converted
- [ ] Pattern documented
- [ ] Webpack builds successfully
- [ ] MediaWiki loads modules correctly

---

### 2.2 ⚡ Implement Performance Optimizations

**Priority:** P2 - MEDIUM  
**Status:** 🟡 Partially Done  
**Effort:** 3-5 days  
**Risk:** MEDIUM

**Current State:**
- RenderCoordinator exists but underutilized
- Full canvas redraws still common
- No dirty region tracking

**Optimizations (in order of impact):**

1. **Consistent RenderCoordinator usage** — Route all renders through coordinator
2. **Layer caching** — Cache unchanged layers as ImageData
3. **Dirty region tracking** — Only redraw affected areas
4. **Viewport culling** — Skip layers outside visible area

**Tasks:**
- [ ] Audit CanvasManager for direct redraw calls
- [ ] Route all redraws through RenderCoordinator
- [ ] Implement layer caching in RenderCoordinator
- [ ] Add dirty region invalidation
- [ ] Add performance metrics logging
- [ ] Profile before/after

**Acceptance Criteria:**
- [ ] Max 1 full redraw per animation frame
- [ ] Measurable performance improvement (benchmark)
- [ ] No visual regressions

---

### 2.3 ♿ Implement Canvas Accessibility

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** LOW

**Current State:** Canvas is inherently inaccessible to screen readers.

**Tasks:**
- [ ] Add visually-hidden layer description container
- [ ] Sync descriptions with canvas changes
- [ ] Add aria-live="polite" for dynamic updates
- [ ] Implement keyboard layer navigation (Tab, Arrow keys)
- [ ] Add keyboard shortcuts for layer operations
- [ ] Test with NVDA and VoiceOver
- [ ] Update ACCESSIBILITY.md

**Acceptance Criteria:**
- [ ] Screen readers announce layer info
- [ ] Full keyboard navigation works
- [ ] ARIA attributes properly applied

---

### 2.4 🏗️ Split Large UI Components

**Priority:** P2 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2-3 days  
**Risk:** LOW

**Files to Split:**

| File | Lines | Proposed Split |
|------|-------|----------------|
| Toolbar.js | 1,666 | ToolbarCore, ToolButtons, ToolOptions |
| LayerPanel.js | 1,103 | LayerList, LayerItem, LayerProperties |
| LayersEditor.js | 1,756 | EditorCore, RevisionManager, SetManager |

**Tasks:**
- [ ] Extract ToolbarCore.js (~400 lines)
- [ ] Extract ToolButtons.js (~500 lines)
- [ ] Extract LayerList.js (~400 lines)
- [ ] Update imports and tests
- [ ] Verify no regressions

---

## Phase 3: Long Term (P3) — 3+ Months

### 3.1 📘 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** Ongoing  
**Dependencies:** 2.1 (ES Modules)

**Tasks:**
- [ ] Add tsconfig.json
- [ ] Create type definitions (Layer, Tool, Event interfaces)
- [ ] Write new features in TypeScript
- [ ] Add .ts handling to webpack
- [ ] Migrate one utility file as proof of concept

---

### 3.2 🔬 Add E2E Tests

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1-2 weeks

**Tasks:**
- [ ] Set up Playwright or Cypress
- [ ] Test full save/load workflow in browser
- [ ] Test layer creation (all 11 types)
- [ ] Test layer manipulation (move, resize, rotate)
- [ ] Test undo/redo
- [ ] Add to CI pipeline

---

### 3.3 ♿ Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2-3 weeks

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

## Quick Reference

### P0 — Must Do Now (This Week)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 0.1 | Fix ESLint archive ignore | 5 min | 🔴 |
| 0.2 | Continue CanvasManager decomposition | 3-5 days | 🟡 |
| 0.3 | Increase low-coverage module tests | 3-5 days | 🔴 |

### P1 — Next Sprint (2-4 Weeks)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1.1 | Add tests for untested modules | 2-3 days | 🔴 |
| 1.2 | Complete StateManager migration | 3-4 days | 🔴 |
| 1.3 | Fix silent error suppression | 2-3 hours | 🔴 |
| 1.4 | Fix PHP test warnings | 30 min | 🔴 |

### P2 — Next Quarter (1-2 Months)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 2.1 | ES Modules migration | 1-2 weeks | 🔴 |
| 2.2 | Performance optimizations | 3-5 days | 🟡 |
| 2.3 | Canvas accessibility | 3-4 days | 🔴 |
| 2.4 | Split large UI components | 2-3 days | 🔴 |

### P3 — Long Term (3+ Months)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 3.1 | TypeScript migration | Ongoing | 🔴 |
| 3.2 | E2E tests | 1-2 weeks | 🔴 |
| 3.3 | WCAG compliance | 2-3 weeks | 🔴 |
| 3.4 | Delete/Rename API | 3-5 days | 📋 |

---

## Metrics Dashboard

```
Test Coverage Progress:
Overall:       77.47% ████████████████░░░░ 80% stretch goal
LayerPanel:    49.78% █████████░░░░░░░░░░░ 70% target
SelectionMgr:  60.26% ████████████░░░░░░░░ 70% target
LayersEditor:  61.74% ████████████░░░░░░░░ 70% target

Code Size Progress (lines):
CanvasManager: 1,896  ████████████████████ 800 target (-1,096)
LayersEditor:  1,756  ████████████████████ 800 target (-956)
WikitextHooks: 1,143  ████████████████████ 400 target (-743)

Technical Debt:
Window.* exports:   30+    ████████████████████ 10 target
Silent catches:     3+     ████████████████████ 0 target
Untested modules:   5      ██████████░░░░░░░░░░ 0 target
ESLint errors:      4      ████░░░░░░░░░░░░░░░░ 0 target
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
- **P0 tasks are blockers** — prioritize these before new features
- Coordinate with maintainers before major architectural changes
- Run both `npm test` and `npm run test:php` before submitting PRs

---

*Plan created by GitHub Copilot (Claude Opus 4.5 Preview) on December 1, 2025*
