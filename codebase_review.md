# Layers MediaWiki Extension - Comprehensive Code Review

**Review Date:** December 1, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis  

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While the **backend has solid security foundations**, the **frontend carries significant architectural debt** that creates maintenance burden and scalability concerns.

**Overall Assessment: 5.5/10** — Functional for basic use cases with notable improvements since November 2025, but substantial technical debt remains. Test coverage improved to 61%, CanvasManager reduced by 47%.

**Key Strengths:**
- Backend security (CSRF, rate limiting, strict 40+ field property whitelist)
- **1,257 passing Jest tests** with **61.23% statement coverage**
- Extracted canvas controllers with 97%+ coverage (excellent pattern)
- Zero ESLint errors, zero PHP source errors
- CanvasManager reduced from 3,523 to **1,877 lines** (47% reduction)
- Processor classes created for WikitextHooks refactor

**Critical Issues Remaining:**
- **1,877-line CanvasManager.js** — still a god class needing further decomposition
- **1,553-line WikitextHooks.php** — 14 hook handlers with code duplication
- **25+ `window.X =` global exports** — IIFE pattern blocking ES modules
- **4 overlapping event systems** — 1,887 lines across EventHandler, EventManager, EventSystem, CanvasEvents
- **Core modules undertested** — LayersEditor, CanvasEvents need coverage improvements

**📋 Detailed improvement plan: [`improvement_plan.md`](./improvement_plan.md)**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 4/10 | 🔴 Poor | God classes, IIFE globals, event system confusion |
| Code Quality | 6/10 | 🟡 Fair | 0 lint errors, but structural issues remain |
| Security | 7/10 | 🟢 Fair-Good | Defense-in-depth backend, proper sanitization |
| Performance | 3/10 | 🔴 Poor | Full redraws on every change, no optimization |
| Accessibility | 4/10 | 🟠 Poor-Fair | Canvas inherently inaccessible |
| Documentation | 7/10 | 🟢 Good | Comprehensive guides, up-to-date architecture docs |
| Testing | 5/10 | 🟡 Fair | 61% coverage overall, but core modules undertested |
| Error Handling | 6/10 | 🟡 Fair | ErrorHandler exists, catch blocks now log |
| Maintainability | 4/10 | 🔴 Poor | God classes make changes high-risk |

---

## Current State Analysis (December 2025)

### File Size Summary

**JavaScript (resources/ext.layers.editor/)** — 25,293 total lines

| File | Lines | Assessment |
|------|-------|------------|
| CanvasManager.js | 1,877 | 🟡 Reduced from 3,523, still needs splitting |
| LayersEditor.js | 1,756 | 🟡 Large but manageable |
| Toolbar.js | 1,666 | 🟡 Could be componentized |
| CanvasRenderer.js | 1,439 | 🟡 Acceptable |
| LayerPanel.js | 1,103 | 🟢 Reasonable |
| TransformController.js | 1,027 | 🟢 Well-extracted, 100% coverage |
| LayersValidator.js | 1,001 | 🟢 Reasonable |
| SelectionManager.js | 950 | 🟢 Reasonable |
| ToolManager.js | 955 | 🟢 Reasonable |
| APIManager.js | 872 | 🟢 Reasonable |
| EventSystem.js | 702 | 🟡 Overlaps with EventHandler |
| StateManager.js | 652 | 🟢 Good, well-tested |
| DrawingController.js | 620 | 🟢 Well-extracted, 97% coverage |
| UIManager.js | 593 | 🟢 Reasonable |
| ErrorHandler.js | 556 | 🟢 Good |
| CanvasEvents.js | 554 | 🟡 Overlaps with EventHandler |
| HistoryManager.js | 524 | 🟢 Reasonable |
| EventHandler.js | 512 | 🟡 Overlaps with EventSystem |
| Other files (14) | <500 each | 🟢 Reasonable |

**PHP (src/)** — Key files

| File | Lines | Assessment |
|------|-------|------------|
| WikitextHooks.php | 1,553 | 🔴 14 hooks with duplication |
| ApiLayersInfo.php | 421 | 🟢 Reasonable |
| LayersHtmlInjector.php | 259 | 🟢 New, well-tested |
| LayersParamExtractor.php | 303 | 🟢 New, well-tested |

---

## 🔴 Critical Issues

### 1. CanvasManager.js: Still a God Class (1,877 lines)

**Severity:** 🔴 HIGH  
**Progress:** Reduced from 3,523 lines (47% reduction)

While significant progress has been made extracting controllers, CanvasManager still handles too many responsibilities:
- Canvas initialization and context
- Rendering coordination
- Mouse/touch event delegation
- Selection state
- Zoom and pan coordination
- Tool state management
- Image loading
- Coordinate transformation

**Extracted Successfully:**
- ✅ ZoomPanController.js (348 lines, 97% coverage)
- ✅ GridRulersController.js (390 lines, 97% coverage)
- ✅ TransformController.js (1,027 lines, 100% coverage)
- ✅ HitTestController.js (382 lines, 98% coverage)
- ✅ DrawingController.js (620 lines, 97% coverage)
- ✅ ClipboardController.js (226 lines, 98% coverage)
- ✅ TextUtils.js (191 lines)

**Still Needed:**
- CanvasCore.js — Canvas setup, context, resize (~400 lines)
- RenderCoordinator.js — Render scheduling, dirty regions (~300 lines)
- InteractionController.js — Mouse/touch delegation (~300 lines)

---

### 2. WikitextHooks.php: 14 Hooks with Duplication (1,553 lines)

**Severity:** 🟡 MEDIUM (In Progress)

14 hook handlers with repeated patterns:
- `onImageBeforeProduceHTML` (lines 127-177)
- `onParserAfterTidy` (lines 178-209)
- `onMakeImageLink2` (lines 210-297)
- `onLinkerMakeImageLink` (lines 298-372)
- `onLinkerMakeMediaLinkFile` (lines 373-550)
- `onParserFirstCallInit` (lines 551-565)
- `onGetLinkParamDefinitions` (lines 566-599)
- `onGetLinkParamTypes` (lines 600-613)
- `onParserGetImageLinkParams` (lines 614-636)
- `onParserGetImageLinkOptions` (lines 637-825)
- `onFileLink` (lines 826-837)
- `onThumbnailBeforeProduceHTML` (lines 838-1050)
- `onParserMakeImageParams` (lines 1051-1218)
- `onParserBeforeInternalParse` (lines 1219+)

**Completed:**
- ✅ LayersHtmlInjector.php created (259 lines)
- ✅ LayersParamExtractor.php created (303 lines)
- ✅ Centralized logging helper added

**Remaining Work:**
- Extract ImageLinkProcessor.php for image hooks
- Extract ThumbnailProcessor.php for thumbnail hooks
- Reduce WikitextHooks.php to <400 lines coordinator

---

### 3. IIFE Pattern with 25+ Window.* Global Exports

**Severity:** 🔴 HIGH (Architecture)

Every JavaScript file uses the 2015-era IIFE pattern:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;
}());
```

**Window.* exports found:**
- ValidationManager, UIManager, TransformationEngine
- ToolManager (also LayersToolManager), Toolbar
- TextUtils, StateManager (also stateManager instance)
- SelectionManager (as LayersSelectionManager)
- ModuleRegistry (plus layersRegistry, layersModuleRegistry)
- LayersValidator, LayersEditor
- LayerPanel, ImageLoader, HistoryManager
- HitTestController, GridRulersController
- GeometryUtils, EventSystem, EventHandler
- ErrorHandler, DrawingController, ClipboardController
- CanvasRenderer, CanvasManager, CanvasEvents
- APIManager, ZoomPanController
- Plus several singleton instances

**Problems:**
- No explicit dependency management — load order is fragile
- Cannot use ES modules, tree-shaking, or modern bundler optimizations
- Global namespace pollution creates collision risks
- Makes unit testing harder
- Blocks TypeScript adoption

---

### 4. Four Overlapping Event Systems (1,887 lines total)

**Severity:** 🔴 HIGH

| File | Lines | Purpose | Overlap |
|------|-------|---------|---------|
| EventHandler.js | 512 | DOM event handling | Duplicates EventSystem |
| EventManager.js | 119 | Global registration | Could inline into LayersEditor |
| EventSystem.js | 702 | Custom event bus | Overlaps EventHandler |
| CanvasEvents.js | 554 | Canvas-specific | Duplicates some CanvasManager |

**Problems:**
- Developers don't know which system to use
- Event handling scattered across 4+ files
- Some events handled in multiple places
- Memory leak potential from untracked listeners
- Testing requires understanding all systems

**Target State:**
- EventBus.js — Custom event pub/sub only (~300 lines)
- CanvasInputHandler.js — All DOM canvas events (~500 lines)
- Inline EventManager into LayersEditor

---

### 5. No Performance Optimizations

**Severity:** 🟡 MEDIUM

Every canvas state change triggers a **full redraw**:

```javascript
this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
// ... draws all layers from scratch
```

**Missing:**
- Dirty region tracking
- Layer caching (cache unchanged layers as images)
- Frame throttling with requestAnimationFrame batching
- Viewport culling (skip off-screen layers)

---

## 🟢 Positive Aspects

### Backend Security (Strong)

1. **CSRF Token Enforcement** — All write operations require tokens
2. **Rate Limiting** — Per-action limits via MediaWiki's rate limiter
3. **Strict Property Whitelist** — 40+ validated fields, unknown fields dropped
4. **Input Sanitization** — TextSanitizer strips HTML and dangerous protocols
5. **Parameterized Queries** — All DB operations use prepared statements

### Extracted Controllers (Excellent Pattern)

| Controller | Lines | Coverage | Quality |
|------------|-------|----------|---------|
| ZoomPanController | 348 | 97% | Excellent |
| GridRulersController | 390 | 97% | Excellent |
| TransformController | 1,027 | 100% | Excellent |
| HitTestController | 382 | 98% | Excellent |
| DrawingController | 620 | 97% | Excellent |
| ClipboardController | 226 | 98% | Excellent |

**Average: 98.5% coverage** — This proves focused modules can be properly tested.

### Test Infrastructure

- **1,257 tests passing** (up from 1,235)
- **61.23% statement coverage** (up from 54.78%)
- **34 test suites** covering most modules
- Good integration tests for save/load workflow
- Well-organized test structure in tests/jest/

### Documentation

- `.github/copilot-instructions.md` — 500+ line comprehensive guide
- `docs/` — Architecture, accessibility, security guides
- API contracts well-documented

---

## Test Coverage Details

**Overall:** 61.23% statements, 46.99% branches, 59.01% functions

**Well-tested modules (>80%):**
- TransformController: 100%
- HitTestController: 98%
- ClipboardController: 98%
- ZoomPanController: 97%
- GridRulersController: 97%
- DrawingController: 97%
- StateManager: ~85%
- CanvasRenderer: ~79%

**Needs improvement (<50%):**
- LayersEditor.js — Core orchestrator, needs more coverage
- CanvasEvents.js — Event handling, needs more coverage
- CanvasManager.js — Still largest file, harder to test

---

## Codebase Statistics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 1,257 | 1,500+ | 🟡 In Progress |
| Statement coverage | 61.23% | 70% | 🟡 Close |
| CanvasManager.js lines | 1,877 | <800 | 🟡 In Progress |
| WikitextHooks.php lines | 1,553 | <400 | 🟡 In Progress |
| ESLint errors | 0 | 0 | ✅ Met |
| PHP source errors | 0 | 0 | ✅ Met |
| Window.* exports | 25+ | <10 | 🔴 Needs Work |
| Event systems | 4 | 2 | 🔴 Needs Work |

---

## Recommendations

### Immediate (P0)

1. **Continue CanvasManager decomposition** — Extract CanvasCore.js, RenderCoordinator.js
2. **Complete WikitextHooks refactor** — Create ImageLinkProcessor, ThumbnailProcessor
3. **Increase core module coverage** — Target 50%+ for LayersEditor, CanvasEvents

### Short-Term (P1)

1. **Consolidate event systems** — Merge into EventBus + CanvasInputHandler
2. **Complete StateManager migration** — Remove bypasses in CanvasManager
3. **Fix PHP test warnings** — 11 style warnings in test files

### Medium-Term (P2)

1. **Migrate to ES modules** — Start with utility classes
2. **Implement performance optimizations** — requestAnimationFrame batching
3. **Canvas accessibility** — Screen-reader layer descriptions

### Long-Term (P3)

1. **TypeScript migration** — New code only
2. **E2E tests** — Playwright or Cypress
3. **Full WCAG 2.1 AA compliance**

---

## Conclusion

The Layers extension has made **notable progress** since November 2025:
- Test coverage increased from 55% to 61%
- CanvasManager reduced by 47% (1,646 lines extracted)
- Processor classes created for WikitextHooks

However, **significant work remains**:
- CanvasManager still 1,077 lines over target
- WikitextHooks still 1,153 lines over target
- Event systems need consolidation
- IIFE pattern must be replaced for modern development

The extracted controllers prove that proper decomposition leads to excellent test coverage. **Continue this pattern aggressively** before adding new features.

**The extension works for basic annotation tasks. Scaling to production use with many users will expose these architectural weaknesses unless addressed.**

---

*Review performed by GitHub Copilot (Claude Opus 4.5 Preview) on December 1, 2025*
