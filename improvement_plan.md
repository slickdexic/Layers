# Layers Extension - Improvement Plan

**Last Updated:** November 30, 2025  
**Status:** Active Development  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a prioritized, actionable improvement plan for the Layers MediaWiki extension. Tasks are organized by priority level with effort estimates, risk assessments, and clear acceptance criteria.

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Production blockers | Must fix before any scaled deployment |
| **P1** | High - Significant quality/maintainability impact | Within 2-4 weeks |
| **P2** | Medium - Quality improvements | Within 2-3 months |
| **P3** | Low - Nice to have | Long term / as time permits |

---

## Current Status Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Jest tests | 1,235 | 1,500+ | +265 |
| Overall Coverage | 54.78% | 70% | +15.2% |
| **Core Module Coverage** | **14-24%** | **60%** | **+36-46%** |
| CanvasManager.js lines | 3,523 | <800 | -2,723 |
| WikitextHooks.php lines | 1,770 | <400 | -1,370 |
| ESLint errors | 0 | 0 | ✅ Met |
| PHP source errors | 0 | 0 | ✅ Met |
| Window.* exports | 51 | <10 | -41 |
| Empty catch blocks | 0 | 0 | ✅ Met |
| Event systems | 5 | 2 | -3 |

---

## Phase 0: Critical Fixes (P0) — Production Blockers

### 0.1 ✏️ Fix Empty Catch Block in CanvasEvents.js

**Priority:** P0 - CRITICAL  
**Status:** ✅ COMPLETED  
**Effort:** 15 minutes  
**Risk:** LOW  
**File:** `resources/ext.layers.editor/CanvasEvents.js:182`

**Resolution:** Added proper error logging with `mw.log.error()`.

```javascript
// Fixed implementation
try {
    cm.handleResize( point, e );
} catch ( error ) {
    if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
        mw.log.error( '[CanvasEvents] handleResize error:', error );
    }
}
```

**Acceptance Criteria:**
- [x] Empty catch block replaced with proper error logging
- [x] ESLint still passes
- [x] All existing tests pass

---

### 0.2 🏗️ Split CanvasManager.js God Class

**Priority:** P0 - CRITICAL  
**Status:** 🟡 In Progress (~60% complete)  
**Effort:** 5-7 days (40+ hours)  
**Risk:** HIGH  
**File:** `resources/ext.layers.editor/CanvasManager.js` (3,523 lines)

**Problem:** Unmaintainable monolith with 15+ responsibilities and only 23.6% test coverage.

**Completed Extractions:**
- ✅ ZoomPanController.js (343 lines, 97% coverage)
- ✅ GridRulersController.js (385 lines, 97% coverage)
- ✅ TransformController.js (1,027 lines, 100% coverage)
- ✅ HitTestController.js (382 lines, 98% coverage)
- ✅ DrawingController.js (620 lines, 97% coverage)
- ✅ ClipboardController.js (222 lines, 98% coverage)
- ✅ ImageLoader.js (280 lines)

**Remaining Extractions Needed:**

| New Module | Est. Lines | Responsibilities | Priority |
|------------|------------|------------------|----------|
| **CanvasCore.js** | ~400 | Canvas setup, context, init, resize | First |
| **RenderCoordinator.js** | ~600 | Render scheduling, performRedraw, dirty regions | Second |
| **InteractionController.js** | ~500 | Mouse/touch delegation, drag state | Third |
| **SelectionController.js** | ~300 | Selection box, handles (or enhance SelectionManager) | Fourth |

**Tasks:**
- [ ] Map all remaining methods to proposed modules
- [ ] Extract CanvasCore.js with init(), resize(), setupContext()
- [ ] Extract RenderCoordinator.js with performRedraw(), scheduleRedraw()
- [ ] Extract InteractionController.js with event delegation
- [ ] Update CanvasManager to compose extracted modules
- [ ] Add tests for each extracted module (target 80% coverage)
- [ ] Verify all 1,235 existing tests still pass

**Acceptance Criteria:**
- [ ] CanvasManager.js reduced to <800 lines
- [ ] Each extracted module has >80% test coverage
- [ ] No functionality regressions
- [ ] Documentation updated

---

### 0.3 🧪 Increase Core Module Test Coverage

**Priority:** P0 - CRITICAL  
**Status:** 🔴 Not Started  
**Effort:** 3-5 days  
**Risk:** LOW

**Current Coverage Crisis:**

| File | Lines | Current | Target | Gap |
|------|-------|---------|--------|-----|
| LayersEditor.js | 1,762 | 14.32% | 50% | +35.68% |
| CanvasEvents.js | 551 | 19.09% | 50% | +30.91% |
| CanvasManager.js | 3,523 | 23.64% | 50% | +26.36% |

**Tasks:**
- [ ] Add LayersEditor initialization tests
- [ ] Add LayersEditor save/load workflow tests
- [ ] Add LayersEditor layer CRUD tests
- [ ] Add CanvasEvents mouse event tests
- [ ] Add CanvasEvents touch event tests
- [ ] Add CanvasManager tool switching tests
- [ ] Add CanvasManager render cycle tests
- [ ] Update jest.config.js with coverage thresholds for core files

**Acceptance Criteria:**
- [ ] LayersEditor.js >= 50% coverage
- [ ] CanvasEvents.js >= 50% coverage
- [ ] CanvasManager.js >= 50% coverage
- [ ] CI fails if coverage drops below thresholds

---

## Phase 1: High Priority (P1) — Maintainability

### 1.1 🏗️ Split WikitextHooks.php and Eliminate Duplication

**Priority:** P1 - HIGH  
**Status:** � In Progress (~40% complete)  
**Effort:** 2-3 days  
**Risk:** MEDIUM  
**File:** `src/Hooks/WikitextHooks.php` (1,770 lines, reduced from 2,172)

**Problem:** 14 hook handlers with massive code duplication. Same HTML injection pattern repeated 5+ times.

**Proposed Structure:**

```
src/Hooks/
  WikitextHooks.php              # Coordinator (~200 lines) - delegates to processors
  Processors/
    LayersHtmlInjector.php       # ✅ CREATED - Shared HTML injection logic (~260 lines)
    LayersParamExtractor.php     # ✅ CREATED - Parameter extraction (~290 lines)
    ImageLinkProcessor.php       # TODO - onImageBeforeProduceHTML, onMakeImageLink2 (~200 lines)
    ThumbnailProcessor.php       # TODO - Thumbnail-specific hooks (~200 lines)
```

**Completed:**
- ✅ Created `LayersHtmlInjector.php` with `buildPayload()`, `encodePayload()`, `injectIntoHtml()`, `injectIntentMarker()`, `addOrUpdateClass()`, `addOrUpdateAttribute()`, `injectIntoAttributes()`, `getFileDimensions()`
- ✅ Created `LayersParamExtractor.php` with `extractFromParams()`, `extractFromHref()`, `extractFromDataMw()`, `extractFromAll()`, `isLayersEnabled()`, `getSetName()`
- ✅ Added PHPUnit tests for both processor classes
- ✅ Registered classes in extension.json AutoloadClasses
- ✅ All PHP lint and phpcs checks pass

**Tasks:**
- [x] Identify all duplicated patterns (parameter extraction, HTML injection, DB fetch)
- [x] Create LayersHtmlInjector with `injectAttributes($html, $layerData, $options)`
- [x] Create LayersParamExtractor with `extractFromHref()`, `extractFromParams()`, `extractFromDataMw()`
- [ ] Update WikitextHooks to use LayersHtmlInjector and LayersParamExtractor
- [ ] Create ImageLinkProcessor for image-specific hooks
- [ ] Create ThumbnailProcessor for thumbnail-specific hooks
- [ ] Verify all wikitext embedding scenarios still work

**Acceptance Criteria:**
- [ ] WikitextHooks.php reduced to <400 lines
- [ ] No code duplication between hook handlers
- [x] New processor classes have PHPUnit tests
- [x] PHP lint and phpcs pass

---

### 1.2 🔧 Consolidate Event Systems

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 3-4 days  
**Risk:** HIGH

**Problem:** 5 overlapping event systems create confusion and potential bugs.

**Current State:**

| File | Lines | Keep/Remove | Notes |
|------|-------|-------------|-------|
| EventHandler.js | 513 | **Merge** | DOM event handling |
| EventManager.js | 120 | **Inline** | Too small, inline into LayersEditor |
| EventSystem.js | 703 | **Keep** | Rename to EventBus, pub/sub only |
| CanvasEvents.js | 551 | **Merge** | Merge with EventHandler |
| CanvasManager inline | ~500 | **Remove** | Delegate to controllers |

**Target State:**

| File | Purpose |
|------|---------|
| **EventBus.js** | Custom event pub/sub (from EventSystem) |
| **CanvasInputHandler.js** | All DOM canvas events (merged EventHandler + CanvasEvents) |

**Tasks:**
- [ ] Document current event flow for each file
- [ ] Create EventBus.js from EventSystem.js core functionality
- [ ] Merge EventHandler.js and CanvasEvents.js into CanvasInputHandler.js
- [ ] Inline EventManager.js into LayersEditor.js
- [ ] Remove duplicate event handling from CanvasManager
- [ ] Update all references
- [ ] Add comprehensive tests for merged functionality
- [ ] Remove deprecated files

**Acceptance Criteria:**
- [ ] Only 2 event-related files remain (EventBus, CanvasInputHandler)
- [ ] All event flows documented
- [ ] No duplicate event handling
- [ ] All tests pass

---

### 1.3 🔧 Complete StateManager Migration

**Priority:** P1 - HIGH  
**Status:** 🔴 Not Started  
**Effort:** 2 days  
**Risk:** MEDIUM

**Problem:** StateManager exists but components bypass it, causing state inconsistencies.

**Components Currently Bypassing StateManager:**

| Component | Local State | Should Use StateManager |
|-----------|-------------|------------------------|
| CanvasManager | `zoom`, `pan`, `currentTool`, `selectedLayerIds` | Yes |
| Toolbar | Direct canvas manipulation | Yes |
| LayerPanel | Direct canvas calls | Yes |

**Tasks:**
- [ ] Move CanvasManager.zoom/pan to StateManager
- [ ] Move CanvasManager.currentTool to StateManager
- [ ] Ensure Toolbar reads/writes via StateManager
- [ ] Ensure LayerPanel reads/writes via StateManager
- [ ] Add state change subscriptions where needed
- [ ] Remove duplicate state variables
- [ ] Add tests for state consistency

**Acceptance Criteria:**
- [ ] Single source of truth for all editor state
- [ ] No direct state manipulation outside StateManager
- [ ] State subscription pattern used for updates

---

### 1.4 🔒 Remove Debug Console Statements

**Priority:** P1 - MEDIUM  
**Status:** ✅ COMPLETED  
**Effort:** 1 hour  
**Risk:** LOW

**Resolution:** Removed console.warn fallbacks in LayersEditor.js. Now only uses `mw.log.*` methods.

**Files fixed:**
- ✅ `LayersEditor.js:48-49` — Removed console.warn fallback
- ✅ `LayersEditor.js:1601-1603` — Removed console.warn fallback

**Acceptance Criteria:**
- [x] No direct console.* calls in production paths
- [x] Debug output only through mw.log

---

## Phase 2: Medium Priority (P2) — Quality Improvements

### 2.1 📦 Migrate to ES Modules

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 1 week  
**Risk:** MEDIUM

**Problem:** 51 window.* exports block modern tooling and create namespace pollution.

**Migration Order (by dependency depth):**

1. **No dependencies** (start here):
   - LayersConstants.js
   - GeometryUtils.js
   - ErrorHandler.js

2. **Single dependency**:
   - ValidationManager.js
   - CanvasRenderer.js

3. **Multiple dependencies** (last):
   - CanvasManager.js
   - LayersEditor.js

**Tasks:**
- [ ] Add ES module support to webpack config
- [ ] Convert LayersConstants.js to ES module with named exports
- [ ] Convert GeometryUtils.js to ES module
- [ ] Update ResourceLoader configuration in extension.json
- [ ] Test in MediaWiki development environment
- [ ] Document migration pattern for remaining files
- [ ] Update ESLint config to support ES modules

**Acceptance Criteria:**
- [ ] At least 3 utility files converted to ES modules
- [ ] Pattern documented for converting remaining files
- [ ] Webpack builds successfully
- [ ] MediaWiki ResourceLoader loads modules correctly

---

### 2.2 ⚡ Implement Basic Performance Optimizations

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3-5 days  
**Risk:** MEDIUM

**Problem:** Every state change triggers full canvas redraw.

**Proposed Optimizations (in order of impact):**

1. **requestAnimationFrame batching** — Coalesce multiple redraw requests
2. **Layer caching** — Cache unchanged layers as ImageData
3. **Dirty region tracking** — Only redraw affected areas

**Tasks:**
- [ ] Implement `scheduleRedraw()` with requestAnimationFrame batching
- [ ] Add layer cache in RenderCoordinator
- [ ] Invalidate cache on layer change
- [ ] Add performance metrics logging
- [ ] Profile before/after with Chrome DevTools

**Acceptance Criteria:**
- [ ] No more than 1 full redraw per animation frame
- [ ] Measurable performance improvement in profiles
- [ ] No visual regressions

---

### 2.3 ♿ Implement Canvas Accessibility Workaround

**Priority:** P2 - MEDIUM  
**Status:** 🔴 Not Started  
**Effort:** 3 days  
**Risk:** LOW

**Problem:** `<canvas>` is inaccessible to screen readers.

**Proposed Solution:** Screen-reader-only layer list that mirrors canvas content.

**Tasks:**
- [ ] Add visually-hidden layer description container
- [ ] Sync descriptions with canvas layer changes via StateManager subscription
- [ ] Add `aria-live="polite"` for dynamic updates
- [ ] Add keyboard navigation for layer selection (arrow keys)
- [ ] Test with NVDA and VoiceOver
- [ ] Update ACCESSIBILITY.md

**Acceptance Criteria:**
- [ ] Screen readers announce layer information
- [ ] Keyboard users can navigate layer list
- [ ] ARIA attributes properly applied

---

### 2.4 📝 Fix PHP Test Style Warnings

**Priority:** P2 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1 hour  
**Risk:** LOW

**Problem:** 11 PHP style warnings in test files.

**Tasks:**
- [ ] Fix SpaceBeforeSingleLineComment warnings in test files
- [ ] Fix line length warnings
- [ ] Replace assertEmpty with specific assertions
- [ ] Run `npm run test:php` to verify

**Acceptance Criteria:**
- [ ] `npm run test:php` shows 0 errors and 0 warnings

---

## Phase 3: Long Term (P3) — Future Improvements

### 3.1 📘 TypeScript Migration

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** Ongoing  
**Risk:** LOW

**Approach:** New code only, gradual migration.

**Tasks:**
- [ ] Add tsconfig.json with strict settings
- [ ] Create type definitions: `types/Layer.ts`, `types/Tool.ts`, `types/Event.ts`
- [ ] Write new features in TypeScript
- [ ] Add .ts file handling to webpack
- [ ] Migrate one existing file as proof of concept
- [ ] Document TypeScript conventions

**Dependencies:** 2.1 (ES Modules) should be completed first

---

### 3.2 ♿ Full WCAG 2.1 AA Compliance

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 2 weeks  
**Risk:** MEDIUM

**Tasks:**
- [ ] Color contrast audit of all UI elements
- [ ] Implement high contrast mode
- [ ] Add skip links to main regions
- [ ] Comprehensive keyboard navigation for all features
- [ ] Screen reader testing (NVDA, VoiceOver, JAWS)
- [ ] Create accessibility conformance statement
- [ ] Document all keyboard shortcuts in UI

---

### 3.3 🔬 Add E2E Tests

**Priority:** P3 - LOW  
**Status:** 🔴 Not Started  
**Effort:** 1 week  
**Risk:** LOW

**Tasks:**
- [ ] Set up Playwright or Cypress
- [ ] Create tests for full save/load workflow
- [ ] Create tests for layer creation (all types)
- [ ] Create tests for layer manipulation (move, resize, rotate)
- [ ] Create tests for multi-layer selection
- [ ] Add E2E tests to CI pipeline

---

### 3.4 🗂️ Layer Set Management: Delete and Rename

**Priority:** P3 - BACKLOG  
**Status:** 📋 Documented  
**Effort:** 3-5 days  
**Risk:** MEDIUM

**Problem:** Users can create named layer sets but cannot delete or rename them.

**Design:**
- **Delete**: Author + users with `deletelayersets` right can delete
- **Rename**: Same permission model as delete
- **Audit**: Log all deletions to MediaWiki logging system

**Tasks:**
- [ ] Add new API module: `ApiLayersDelete.php`
- [ ] Add new API module: `ApiLayersRename.php`
- [ ] Add `deletelayersets` right to extension.json
- [ ] Add UI: Delete button with confirmation dialog
- [ ] Add UI: Rename button with input dialog
- [ ] Add MediaWiki logging entries
- [ ] Write tests for new API endpoints

---

## Quick Reference: Priority Summary

### Must Do (P0) — Before Production

| # | Task | Effort | Status |
|---|------|--------|--------|
| 0.1 | Fix empty catch block | 15 min | ✅ Done |
| 0.2 | Split CanvasManager.js | 5-7 days | 🟡 ~20% |
| 0.3 | Increase core module coverage | 3-5 days | 🔴 |

### Should Do (P1) — Next Sprint

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1.1 | Split WikitextHooks.php | 2-3 days | 🟡 ~60% |
| 1.2 | Consolidate event systems | 3-4 days | 🔴 |
| 1.3 | Complete StateManager migration | 2 days | 🔴 |
| 1.4 | Remove debug console statements | 1 hour | ✅ Done |

**Total P1 Effort:** ~2 weeks

### Nice to Have (P2-P3)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 2.1 | ES Modules migration | 1 week | P2 |
| 2.2 | Performance optimizations | 3-5 days | P2 |
| 2.3 | Canvas accessibility | 3 days | P2 |
| 2.4 | Fix PHP test warnings | 1 hour | P2 |
| 3.1 | TypeScript migration | Ongoing | P3 |
| 3.2 | Full WCAG compliance | 2 weeks | P3 |
| 3.3 | E2E tests | 1 week | P3 |
| 3.4 | Layer set delete/rename | 3-5 days | P3 |

---

## Metrics Dashboard

Track progress against targets:

```
Coverage Progress:
Overall:       54.78% ===========--------- 70% target
LayersEditor:  14.32% ===----------------- 50% target (CRITICAL)
CanvasEvents:  19.09% ====---------------- 50% target (CRITICAL)
CanvasManager: 23.64% =====--------------- 50% target (CRITICAL)

Code Size Progress:
CanvasManager: 3,523 lines ==================== 800 target
WikitextHooks: 1,770 lines ==================== 400 target

Technical Debt:
Window.* exports: 51 ==================== 10 target
Event systems:    5  ==================== 2  target
Empty catches:    0  ✅ TARGET MET
Console stmts:    0  ✅ TARGET MET

New Code (In Progress):
LayersHtmlInjector.php:    ~260 lines ✅ Created with tests
LayersParamExtractor.php:  ~290 lines ✅ Created with tests
```

---

## How to Contribute

1. Pick an unassigned task from Phase 0 or Phase 1
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

**Last updated:** November 29, 2025
