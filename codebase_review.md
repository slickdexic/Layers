# Layers MediaWiki Extension - Critical Code Review

**Review Date:** December 2, 2025  
**Version:** 0.8.1-dev  
**Reviewer:** GitHub Copilot (Claude Opus 4.5 Preview)  
**Review Type:** Deep Critical Analysis  
**Last Updated:** December 2, 2025 (comprehensive re-review)

---

## Executive Summary

The "Layers" extension is a MediaWiki extension for non-destructive image annotation. While it has **solid backend security** and **good test coverage**, the **frontend architecture carries significant technical debt** that creates maintenance burden, impedes scaling, and makes the codebase fragile.

**Overall Assessment: 6/10** — Functional but needs substantial architectural work before scaling.

### The Good
- Backend security is excellent (CSRF, rate limiting, strict 47-field property whitelist)
- **2,352 passing Jest tests** with **91% statement coverage**
- 8 extracted canvas controllers with 91-100% coverage demonstrate excellent patterns
- Zero active ESLint errors in production code
- PHP code is well-structured with dependency injection and service wiring

### The Bad
- **God classes**: 3 JavaScript files exceed 1,500 lines with severely mixed responsibilities
- **Global pollution**: 40+ `window.*` exports using antiquated IIFE pattern
- **Silent error suppression**: **12+ `catch { /* ignore */ }` blocks in init.js alone**
- **Fragmented state**: StateManager exists but is bypassed throughout the codebase

### The Ugly
- CanvasManager.js is **1,899 lines** (target: <800) — still a god class after 8 extractions
- WikitextHooks.php is **1,143 lines** handling 13+ hooks
- init.js has **12 silent catch blocks** that make debugging impossible
- No ES modules — blocks TypeScript, tree-shaking, and modern tooling
- **No end-to-end tests** — only unit tests

**📋 Detailed improvement plan: [`improvement_plan.md`](./improvement_plan.md)**

---

## Assessment Scores (1-10 scale)

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Architecture & Design | 3/10 | 🔴 Critical | God classes, IIFE globals, mixed concerns |
| Code Quality | 7/10 | 🟢 Good | 91% coverage, good extracted modules |
| Security | 9/10 | 🟢 Excellent | Defense-in-depth backend |
| Performance | 4/10 | 🔴 Poor | Full redraws, RenderCoordinator underutilized |
| Accessibility | 3/10 | 🔴 Poor | Canvas inherently inaccessible |
| Documentation | 5/10 | 🟡 Fair | Some docs are outdated or aspirational |
| Testing | 8/10 | 🟢 Good | 91% coverage, 2,352 tests, but no E2E |
| Error Handling | 3/10 | 🔴 Critical | 12+ silent catch blocks in init.js |
| Maintainability | 3/10 | 🔴 Poor | God classes make changes high-risk |

---

## 🔴 Critical Issues

### 1. God Classes — Architectural Failure

Three files exceed 1,500 lines with severely mixed responsibilities:

| File | Lines | Responsibilities (Mixed) | Max Methods |
|------|-------|-------------------------|-------------|
| **CanvasManager.js** | 1,899 | Canvas init, zoom/pan, selection, layers, clipboard, history, mouse, grid, rendering coordination | 134+ |
| **LayersEditor.js** | 1,756 | UI, layer CRUD, state, API, events, shortcuts, revisions, named sets, validation | 106+ |
| **Toolbar.js** | 1,678 | Tool buttons, color picker, style controls, import/export, keyboard shortcuts | ~80 |

**Impact**: Any change to these files risks breaking unrelated functionality. Code review is difficult because changes touch too many concerns.

**Evidence of problem**: 8 controllers were already extracted from CanvasManager (ZoomPan, GridRulers, Transform, HitTest, Drawing, Clipboard, RenderCoordinator, Interaction) and it's **STILL** 1,899 lines.

---

### 2. Global Namespace Pollution — 40+ `window.*` Exports

Every JavaScript file uses the antiquated IIFE pattern:

```javascript
( function () {
    'use strict';
    function CanvasManager( config ) { ... }
    window.CanvasManager = CanvasManager;  // Global pollution
}());
```

**Verified exports (52 `window.X =` assignments):**

**Classes (32 unique):**
- `CanvasManager`, `CanvasEvents`, `CanvasRenderer`, `CanvasUtilities`
- `LayersEditor`, `LayerPanel`, `LayersValidator`, `LayersConstants`
- `StateManager`, `SelectionManager` (also as `LayersSelectionManager`)
- `ToolManager` (also as `LayersToolManager`) — duplicate export!
- `ModuleRegistry` (also as `LayersModuleRegistry`)
- 8 canvas controllers
- `GeometryUtils`, `TextUtils`, `ImageLoader`, `TransformationEngine`
- `ErrorHandler` (also as `LayersErrorHandler`)
- `UIManager`, `APIManager`, `ValidationManager`, `EventManager`
- `HistoryManager`, `Toolbar`
- UI components: `ColorPickerDialog`, `ConfirmDialog`, `PropertiesForm`, `IconFactory`

**Singletons (5):**
- `window.stateManager` — singleton instance
- `window.layersErrorHandler` — singleton instance
- `window.layersRegistry` — ModuleRegistry instance
- `window.layersModuleRegistry` — legacy compatibility alias
- `window.layersEditorInstance` — runtime editor reference

**Problems:**
1. No explicit dependency management — load order is fragile
2. Cannot use tree-shaking or modern bundlers effectively
3. Global namespace collision risk with other extensions
4. Testing requires manual global mocks
5. Blocks TypeScript adoption
6. **Duplicate exports** (same class under multiple names) indicate confusion

---

### 3. Silent Error Suppression — **CRITICAL: 12+ in init.js Alone**

`resources/ext.layers/init.js` (854 lines) has **12 catch blocks that silently ignore errors**:

```javascript
} catch ( e ) { /* ignore */ }
} catch ( eUrl ) { /* ignore */ }
} catch ( eNsNum ) { /* ignore */ }
} catch ( eNs ) { /* ignore */ }
} catch ( eT ) { /* ignore */ }
} catch ( eS ) { /* ignore */ }
} catch ( e2 ) { /* ignore */ }
} catch ( e2b ) { /* ignore */ }
} catch ( eFileLink ) { /* ignore */ }
// ... and more
```

**This is a critical defect.** When something goes wrong in production:
1. No errors appear in console
2. No logging occurs anywhere
3. Debugging is nearly impossible
4. Silent failures can cascade undetected

**Additional silent catches found in:**
- StateManager.js (localStorage)
- HistoryManager.js (storage failures)
- Toolbar.js (multiple instances)
- Canvas controllers (various)

**Impact**: Production issues go undetected until users report broken functionality. Developers cannot diagnose issues without adding temporary logging.

---

### 4. Fragmented State Management

StateManager exists but is bypassed throughout:

```javascript
// CanvasManager still has local state (56+ properties):
this.zoom = 1.0;
this.pan = { x: 0, y: 0 };
this.currentTool = 'pointer';
this.layers = [];
this.selectedLayers = [];
this.gridEnabled = false;
this.showRulers = false;
// ... 40+ more properties
```

**Components bypassing StateManager:**
- CanvasManager: 56+ local state properties
- Toolbar: Direct canvas manipulation
- LayerPanel: Direct canvas method calls
- init.js: Own state tracking (`$fileSetNames`, `$fileRenderCount`)

**Impact**: State can desync between components. When one component updates state directly, others don't see the change, leading to UI inconsistencies and bugs that are hard to reproduce.

---

### 5. WikitextHooks.php — Mega-File (1,143 lines, 13+ hooks)

Despite processor extraction into `Hooks/Processors/`, this file still handles too many concerns:

| Hook | Lines | Purpose |
|------|-------|---------|
| `onParserFirstCallInit` | ~20 | Parser initialization |
| `onParserBeforeInternalParse` | ~100 | Wikitext scanning |
| `onFileLink` | ~50 | File link handling |
| `onGetLinkParamDefinitions` | ~30 | Parameter registration |
| `onGetLinkParamTypes` | ~20 | Type registration |
| `onParserGetImageLinkParams` | ~40 | Image params |
| `onParserGetImageLinkOptions` | ~30 | Image options |
| `onMakeImageLink2` | ~50 | Legacy image path |
| `onLinkerMakeImageLink` | ~60 | MW 1.44 path |
| `onLinkerMakeMediaLinkFile` | ~40 | Media links |
| `onImageBeforeProduceHTML` | ~100 | Image attribute injection |
| `onThumbnailBeforeProduceHTML` | ~50 | Thumbnail attributes |
| `onParserMakeImageParams` | ~80 | Layers parameter handling |

**Also contains mutable static state:**
- `$pageHasLayers` — boolean flag
- `$fileSetNames` — array mapping filenames to set name queues
- `$fileRenderCount` — render tracking for queue consumption
- Multiple singleton patterns for processors

---

### 6. No End-to-End Tests

While unit test coverage is excellent (91%), there are **no E2E tests** to verify:
- Full save/load workflow in a real browser
- Layer creation across all 11 types
- Complex user interactions (drag, resize, rotate)
- Integration with MediaWiki's page rendering
- Cross-browser compatibility

**Risk**: Unit tests can pass while the application is broken in real usage.

---

### 7. init.js — Large and Fragile (854 lines)

The viewer initialization file has multiple issues:
- **12 silent catch blocks** (see Critical Issue #3)
- **854 lines** in a single file that should be <400
- Complex URL parsing with multiple fallback attempts
- Duplicated DOM traversal patterns
- Mixed concerns: initialization, API fallback, DOM manipulation

---

## 🟡 Medium Issues

### 8. Hardcoded Magic Values

Constants that should be configurable:

| Value | Location | Should Be |
|-------|----------|-----------|
| `maxTextLength: 500` | LayersValidator | Server config |
| `maxIdLength: 100` | LayersValidator | Server config |
| `maxFontSize: 1000` | LayersValidator | Server config |
| Color codes (`#666`, `#888`) | Toolbar.js (~20 instances) | CSS variables |
| `1200` (modal z-index) | Various | CSS/constants |
| `0.3` (opacity values) | CanvasRenderer | Constants |

### 9. PHP Code Style Issues

`npm run test:php` reveals **70+ warnings** across test and source files:

- Long lines exceeding 120 characters
- Comments not on new lines (MediaWiki standard)
- `assertEmpty` usage (discouraged by MediaWiki)

While warnings not errors, they indicate inconsistent adherence to MediaWiki coding standards.

### 10. Missing Database Index

Named set lookups would benefit from an index:
```sql
-- Missing: 
KEY ls_name_lookup (ls_img_name, ls_img_sha1, ls_name)
```

### 11. Code Duplication

Repeated patterns that should be extracted:

1. **Logger retrieval** — appears in WikitextHooks, Hooks, ApiLayersInfo with variations
2. **File lookup** — `RepoGroup->findFile()` repeated in 4+ locations
3. **mw.message()** pattern — repeated 20+ times
4. **Safe log pattern** — duplicated error logging code
5. **URL parsing** — multiple similar fallback patterns in init.js

---

## 🟢 Strengths

### Backend Security (Excellent)

The PHP backend demonstrates excellent security practices:

1. **CSRF Token Enforcement** — All write operations require tokens
2. **Rate Limiting** — Per-action limits via MediaWiki's rate limiter
3. **Strict Property Whitelist** — 47 validated fields in ServerSideLayerValidator
4. **Multi-layer Input Validation:**
   - Size limit before JSON parsing (DoS prevention)
   - Set name sanitization (path traversal prevention)
   - Enum validation for types, blend modes
   - Points array capped at 1,000
5. **Parameterized Queries** — All DB operations use prepared statements
6. **Generic Error Messages** — Internal details logged, not exposed

### Extracted Controllers (Excellent Pattern)

| Controller | Lines | Coverage | Quality |
|------------|-------|----------|---------|
| ZoomPanController | 341 | 100% | Excellent |
| DrawingController | 614 | 100% | Excellent |
| InteractionController | 487 | 100% | Excellent |
| HitTestController | 376 | 99% | Excellent |
| ClipboardController | 220 | 99% | Excellent |
| GridRulersController | 383 | 98% | Excellent |
| RenderCoordinator | 387 | 92% | Good |
| TransformController | 1,157 | 91% | Good |

**Average: 97%+ coverage** — This proves focused modules can be properly tested. **This is the target pattern for the remaining god classes.**

### Test Infrastructure

- **2,352 tests passing** across 51 suites
- **91% statement coverage**
- Good integration tests for save/load workflow
- Well-organized test structure with unit/integration separation

### PHP Architecture

- Proper dependency injection via `services.php`
- Clean separation of concerns in `Hooks/Processors/`
- Well-documented API modules with security comments
- Retry logic with exponential backoff in database layer

---

## Test Coverage Summary (Current)

**Overall:** 91.35% statements, 76.45% branches, 90.11% functions

**Excellent (>95%):**
| Module | Statement Coverage |
|--------|-------------------|
| DrawingController | 100% |
| ZoomPanController | 100% |
| InteractionController | 100% |
| HitTestController | 99% |
| GeometryUtils | 99% |
| ValidationManager | 99% |
| ToolManager | 99% |
| ClipboardController | 99% |
| CanvasEvents | 98% |
| CanvasUtilities | 98% |
| GridRulersController | 98% |
| UIManager | 98% |

**Good (80-95%):**
| Module | Statement Coverage |
|--------|-------------------|
| HistoryManager | 95% |
| ModuleRegistry | 94% |
| TextUtils | 92% |
| RenderCoordinator | 92% |
| ImageLoader | 91% |
| TransformController | 91% |
| SelectionManager | 91% |
| CanvasRenderer | 91% |
| LayerPanel | 88% |
| CanvasManager | 87% |
| StateManager | 85% |

**Needs Improvement (<85%):**
| Module | Statement Coverage | Risk |
|--------|-------------------|------|
| LayersEditor | 81% | 🟠 Main orchestrator |

---

## Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Jest tests | 2,352 | 1,500+ | ✅ Met |
| Statement coverage | 91% | 80% | ✅ Met |
| CanvasManager.js lines | 1,899 | <800 | 🔴 1,099 over |
| LayersEditor.js lines | 1,756 | <800 | 🔴 956 over |
| Toolbar.js lines | 1,678 | <800 | 🔴 878 over |
| WikitextHooks.php lines | 1,143 | <400 | 🔴 743 over |
| init.js lines | 854 | <400 | 🔴 454 over |
| ESLint errors | 0 | 0 | ✅ Met |
| Window.* exports | 40+ | <10 | 🔴 30+ over |
| Silent catch blocks | 12+ | 0 | 🔴 Unacceptable |
| E2E tests | 0 | 10+ | 🔴 Missing |

---

## Recommendations by Priority

### P0 — Critical (Block Feature Development)

1. **Fix silent error suppression** — Replace all 12+ `/* ignore */` catches in init.js with `mw.log.warn()` calls
2. **Add error logging to catch blocks** — At minimum log the error type and context
3. **Document actual vs aspirational features** — Several docs describe unimplemented features

### P1 — High (2-4 Weeks)

1. **Continue CanvasManager decomposition** — Target <800 lines
2. **Complete StateManager migration** — Remove local state properties
3. **Split WikitextHooks.php** — One class per related hook group
4. **Add critical E2E tests** — At least save/load workflow

### P2 — Medium (1-2 Months)

1. **Begin ES module migration** — Start with utilities (GeometryUtils, TextUtils)
2. **Split Toolbar.js** — ToolButtons, StyleControls, ZoomControls
3. **Add database index** — `ls_name_lookup` for named set queries
4. **Implement canvas accessibility** — Screen reader layer descriptions
5. **Refactor init.js** — Split into smaller, focused modules

### P3 — Long Term (3+ Months)

1. **TypeScript migration** — New code only, with declaration files
2. **Full E2E test suite** — Playwright or Cypress
3. **WCAG 2.1 AA compliance** — Full accessibility audit
4. **Delete/Rename API endpoints** — Administrative features

---

## Conclusion

The Layers extension **works for basic annotation tasks** but has **significant technical debt** that will:

1. **Impede new feature development** — God classes make changes risky
2. **Cause debugging nightmares** — 12+ silent catches + fragmented state
3. **Block modernization** — IIFE pattern prevents ES modules, TypeScript
4. **Create maintenance burden** — 1,500+ line files are hard to review

**The extracted controllers prove the path forward**: focused modules with 97%+ coverage are easy to test, maintain, and reason about. **Apply this pattern aggressively to the remaining god classes before adding new features.**

**Recommended next step**: Address P0 tasks in the [improvement plan](./improvement_plan.md), especially the 12+ silent catch blocks in init.js that make production debugging impossible.

---

*Review performed by GitHub Copilot (Claude Opus 4.5 Preview) on December 2, 2025*
