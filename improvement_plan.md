# Layers Extension - Improvement Plan

**Last Updated:** December 30, 2025  
**Status:** ⏳ P0 Issue In Progress - LayerPanel.js Refactoring  
**Version:** 1.2.15  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** with layer grouping feature complete. LayerPanel.js refactoring is **in progress**, with ~629 lines extracted to new controllers, along with 57 new unit tests.

**Current Rating: 8.0/10**

---

## Current State (December 30, 2025)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 14 tools + layer grouping with folders |
| **Security** | ✅ Resolved | All known security issues fixed |
| **Testing** | ✅ Good | 7,574 tests (135 suites), 92.6% statement coverage |
| **ES6 Migration** | ✅ Complete | 91 classes, 0 prototype patterns |
| **Code Hygiene** | ✅ Excellent | 0 TODO/FIXME/HACK comments |
| **God Classes** | ⏳ **IN PROGRESS** | 9 files >1,000 lines, LayerPanel.js reduced from 2,572→2,148 |
| **Codebase Size** | ✅ Healthy | ~54,000 lines (101 files), well under 75K target |
| **Layer Grouping** | ✅ **COMPLETE** | Folders, expand/collapse, visibility cascade, delete options |

---

## Priority Definitions

| Priority | Timeline | Status |
|----------|----------|--------|
| **P0** | Immediate | ⏳ **In Progress: LayerPanel.js** |
| **P1** | 1-4 weeks | ⏳ In Progress |
| **P2** | 1-3 months | ⏳ Planned |
| **P3** | 3-6 months | ⏳ Not Started |

---

## Phase 0: Critical Issues (P0) - ⏳ IN PROGRESS

### P0.NEW LayerPanel.js Refactoring - IN PROGRESS ⏳

**Status:** IN PROGRESS - 629 lines extracted  
**Started:** December 30, 2025

**Original Problem:** LayerPanel.js had grown to **2,572 lines**, exceeding the 2,000 line limit.

**Progress Made:**
| Extraction | Lines | Tests | Status |
|------------|-------|-------|--------|
| FolderOperationsController.js | 383 | 45 | ✅ Complete |
| ContextMenuController.js | 246 | 23 | ✅ Complete |
| **Total Extracted** | **629** | **68** | |
| **LayerPanel.js Current** | **2,148** | | Still ~350 over target |

**Remaining Work:**
- Extract keyboard navigation to KeyboardController.js (~80 lines)
- Extract selection methods to SelectionController.js (~150 lines)
- Target: Reduce to under 1,800 lines

**Files Created:**
- `resources/ext.layers.editor/ui/FolderOperationsController.js` - folder operations (create, delete, toggle visibility, ungroup)
- `resources/ext.layers.editor/ui/ContextMenuController.js` - right-click context menu

**Tests Created:**
- `tests/jest/FolderOperationsController.test.js` - 34 tests
- `tests/jest/ContextMenuController.test.js` - 23 tests

**Tests Updated:**
- LayerPanelMultiSelect.test.js - added FolderOperationsController and ContextMenuController mocks
- LayerPanelKeyboard.test.js - added FolderOperationsController mock
- LayerPanelExtended.test.js - added FolderOperationsController mock
- LayerPanelConfirmations.test.js - updated for delegation pattern

**Effort Remaining:** ~1 day

---

### P0.1 Rectangle Blur Fill Appears Transparent - FIXED ✅

**Status:** RESOLVED  
**Fix Date:** December 27, 2025

**Problem:** When rotation was applied to a rectangle, coordinates were transformed to local space (-width/2, -height/2) BEFORE being passed to EffectsRenderer.drawBlurFill. This caused canvas capture to use wrong coordinates.

**Solution Applied:**
1. Store world coordinates (`worldX`, `worldY`) BEFORE rotation transformation is applied
2. Pass world coordinates to `drawBlurFill` for capture bounds
3. Path callback still uses local coordinates (correct for the rotated context)

**Files Fixed:**
- `resources/ext.layers.shared/ShapeRenderer.js` - added worldX/worldY before rotation, updated drawBlurFill call

**Tests Added:**
- 3 new tests in `ShapeRenderer.test.js` for blur fill with rotation

**Note:** TextBoxRenderer.js already had the correct fix pattern using AABB calculation.

### P0.2 Inconsistent Blur Fill Across Shape Types - RESOLVED ✅

**Status:** RESOLVED  
**Fix Date:** December 27, 2025

Different shapes calculate bounds differently:
- Rectangle/TextBox: Top-left (BROKEN after rotation)
- Circle/Ellipse/Polygon/Star: Center-based (works better)

**Analysis:** After the rectangle coordinate fix, all shapes now use consistent world coordinate bounds:
- Rectangle: Now stores worldX/worldY before rotation, passes world coords
- Circle/Ellipse: Use center-based bounds (always stable)
- Polygon/Star: Use center-based bounds (always stable)  
- TextBox: Already had AABB calculation for rotated bounds

### P0.3 Editor vs Viewer Blur Fill Mismatch - MONITORED

**Status:** Low Priority  
**Severity:** LOW (edge case)

EffectsRenderer handles both editor (zoom/pan) and viewer (scaling) modes. Most common cases work correctly after the rectangle coordinate fix.

---

## Phase 0 (Previous): Coverage Issues - RESOLVED ✅

### P0.A EffectsRenderer.js Coverage ✅ FIXED

**Before:** 48.7% statement coverage, 43% branch coverage  
**After:** **97.3% statement coverage, 91.5% branch coverage**  
**Solution:** Added 26 comprehensive tests for drawBlurFill method, stroke styles

### P0.B CanvasRenderer.js Coverage ✅ FIXED

**Before:** 58.5% statement coverage, 47% branch coverage  
**After:** **88.5% statement coverage, 74.9% branch coverage**  
**Solution:** Added 40 tests for blur blend mode methods

---

## Phase 1: Important Issues (P1) - In Progress

### P1.1 Split ToolbarStyleControls.js ✅ COMPLETE

**Before:** 975 lines (25 lines from god class territory)  
**After:** **959 lines** (safely below 1,000 line threshold)  
**Solution:** Extracted arrow style controls to ArrowStyleControl.js module (209 lines)

Extractions performed:
1. **TextEffectsControls.js** (378 lines) - Handles font size, text stroke, shadow toggle
2. **ArrowStyleControl.js** (209 lines) - Handles arrow style dropdown UI

Both modules use the delegation pattern with clean interfaces.

### P1.2 ESLint Disable Count ✅ ACCEPTABLE

**Current:** 12 eslint-disable comments  
**Status:** All are legitimate fallbacks or API compatibility  
**Action:** None required

### P1.3 Remove Deprecated Code ✅ PARTIAL

4 deprecated items remain after cleanup (was 8):

| File | Item | Status |
|------|------|--------|
| WikitextHooks.php | `getFileSetName()` | ✅ REMOVED |
| WikitextHooks.php | `getFileLinkType()` | ✅ REMOVED |
| Toolbar.js | `handleKeyboardShortcuts` | ✅ REMOVED |
| APIManager.js | `normalizeBooleanProperties()` | ✅ REMOVED |
| ModuleRegistry.js | Legacy pattern (x2) | ⏳ Keep (fallback for old code) |
| CanvasManager.js | Fallback image loading (x2) | ⏳ Keep (fallback for edge cases) |

---

## Phase 2: Code Quality (P2) - Planned

### P2.1 Address God Classes - NOW CRITICAL

9 files now exceed 1,000 lines (**was 8, LayerPanel.js has breached 2,000 line hard limit**):

| File | Lines | Priority |
|------|-------|----------|
| **LayerPanel.js** | **2,572** | **P0 - URGENT** |
| CanvasManager.js | 1,877 | LOW (well-delegated) |
| Toolbar.js | 1,537 | MEDIUM |
| LayersEditor.js | 1,465 | LOW |
| SelectionManager.js | 1,359 | LOW |
| ToolManager.js | 1,261 | LOW |
| CanvasRenderer.js | 1,242 | LOW |
| APIManager.js | 1,182 | LOW |
| GroupManager.js | 1,015 | LOW (new) |

**Note:** LayerPanel.js requires immediate attention. Other god classes use delegation patterns and are acceptable.

### P2.2 Improve Test Coverage for UI Components

| File | Current | Target | Priority |
|------|---------|--------|----------|
| LayerDragDrop.js | 68.9% | 85%+ | MEDIUM |
| LayerListRenderer.js | 78.6% | 85%+ | MEDIUM |

---

## Phase 3: Features (P3) - Not Started

### P3.1 Mobile-Optimized UI ⏳

**Priority:** MEDIUM (basic touch works)  
**Effort:** 3-4 weeks

**Already Implemented:**
- ✅ Touch-to-mouse event conversion
- ✅ Pinch-to-zoom gesture
- ✅ Double-tap to toggle zoom
- ✅ Touch handlers in CanvasEvents.js and LayerPanel.js

**Still Needed:**
- Responsive toolbar layout for small screens
- Mobile-optimized layer panel
- Touch-friendly selection handles (larger hit areas)
- On-screen keyboard handling for text input

### P3.2 TypeScript Migration ⏳

**Status:** 5% complete (2 files migrated)  
**Priority:** LOW - ES6 with JSDoc provides adequate type safety

### P3.3 Layer Grouping ✅ COMPLETE (v1.2.13)

Group multiple layers for bulk operations.  
**Completed:** December 29, 2025

**Implemented:**
- ✅ **GroupManager.js** (~600 lines) — Full grouping API with 48 tests
- ✅ **Keyboard shortcuts** — Ctrl+G to group, Ctrl+Shift+G to ungroup
- ✅ **Selection integration** — Selecting group auto-selects children
- ✅ **Layer panel UI** — Folder icons, indentation, expand/collapse
- ✅ **PHP validation** — Server-side 'group' type support
- ✅ **Nesting support** — Up to 3 levels deep, max 100 children
- ✅ **107 new tests** — GroupManager, SelectionManager, ToolbarKeyboard

### P3.4 WCAG 2.1 AA Audit ⏳

Full accessibility compliance audit.  
**Effort:** 2 weeks

---

## God Class Status Tracker

**⚠️ WARNING: LayerPanel.js has exceeded the 2,000 line hard limit!**

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,572** | Facade → 7 controllers | **⛔ OVER LIMIT - NEEDS SPLIT** |
| CanvasManager.js | 1,877 | Facade → 10 controllers | ✅ Acceptable |
| Toolbar.js | 1,537 | UI consolidation | ⚠️ Monitor |
| LayersEditor.js | 1,465 | Orchestrator → managers | ✅ Acceptable |
| SelectionManager.js | 1,359 | Facade → selection helpers | ✅ Acceptable |
| ToolManager.js | 1,261 | Facade → tool handlers | ✅ Acceptable |
| CanvasRenderer.js | 1,242 | SelectionRenderer | ✅ Acceptable |
| APIManager.js | 1,182 | APIErrorHandler | ✅ Acceptable |
| GroupManager.js | 1,015 | New (v1.2.13) | ✅ Acceptable |

### Files to Watch (800-1000 lines)

| File | Lines | Risk | Action |
|------|-------|------|--------|
| ToolbarStyleControls.js | 946 | ⚠️ MEDIUM | Monitor |
| PropertiesForm.js | 914 | ⚠️ MEDIUM | Monitor |
| ShapeRenderer.js | 909 | ⚠️ MEDIUM | Monitor |
| LayersValidator.js | 854 | ✅ LOW | Stable |
| ResizeCalculator.js | 822 | ✅ LOW | Stable |
| LayerRenderer.js | 821 | ✅ LOW | 95% coverage |
| TransformController.js | 779 | ✅ LOW | Stable |

---

## Progress Tracking

```
Phase 0 (CRITICAL - NEW):
P0.NEW LayerPanel.js split:  ░░░░░░░░░░░░░░░░░░░░ 0%   ⚠️ URGENT - 2,572 lines

Phase 0 (Previous - RESOLVED):
P0.1 Rectangle blur fix:     ████████████████████ 100% ✅ FIXED (v1.2.8)
P0.2 Consistent blur bounds: ████████████████████ 100% ✅ FIXED
P0.3 Editor/Viewer parity:   ████████████████████ 100% ✅ Core fixed
P0.A EffectsRenderer coverage: ████████████████████ 100% ✅ FIXED (99%)
P0.B CanvasRenderer coverage:  ████████████████████ 100% ✅ FIXED (94%)

Phase 1 (Important):
P1.1 Split ToolbarStyleControls: ████████████████████ 100% ✅ Done (946 lines)
P1.2 ESLint disables:          ██████████████░░░░░░ 70%  ⚠️ Now 17 (was 12)
P1.3 Deprecated removal:       ██████████░░░░░░░░░░ 50%  ✅ 4 removed, 4 remain

Phase 2 (Code Quality):
P2.1 God class delegation:     ████████████████░░░░ 80%  ⚠️ LayerPanel.js issue
P2.2 UI component coverage:    ████████████░░░░░░░░ 60%  ⚠️ LayerDragDrop at 69%

Phase 3 (Features):
P3.1 Mobile UI optimization:   ██████░░░░░░░░░░░░░░ 30%  ⏳ Basic touch works
P3.2 TypeScript:               █░░░░░░░░░░░░░░░░░░░ 5%   ⏳ Low Priority
P3.3 Layer Grouping:           ████████████████████ 100% ✅ COMPLETE (v1.2.13)
P3.4 WCAG Audit:               ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
```

---

## What Would Make This World-Class (10/10)

### Already Have ✅

- 7,506 passing tests with 92.6% statement coverage
- 0 TODO/FIXME/HACK comments (excellent code hygiene)
- 89 ES6 classes (no legacy patterns)
- Comprehensive documentation (20+ markdown files)
- Accessible UI with ARIA support
- Named layer sets with version history
- Layer grouping with folder UI (v1.2.13+)
- Smart guides and key object alignment
- Style presets with import/export
- 4 API endpoints with full validation
- Modal editor mode for iframe editing
- Editor returns to originating page
- Rate limiting and security hardening
- Blur fill mode for all shapes
- Basic touch support (pinch-to-zoom, touch-to-mouse)

### Need for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| **Split LayerPanel.js** | HIGH - Maintainability | 2-3 days | **P0** |
| **Mobile-optimized UI** | HIGH - Opens to 50% more users | 3-4 weeks | P3.1 |
| **Improve UI component coverage** | MEDIUM - Quality | 1 week | P2.2 |
| **WCAG 2.1 AA certification** | MEDIUM - Enterprise requirement | 2 weeks | P3.4 |

---

## Rules

### ⚠️ The God Class Rule - VIOLATED

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to 2,000 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Hard limit:** No file should exceed 2,000 lines

**LayerPanel.js at 2,572 lines violates the hard limit!** ⛔

### ✅ The Timer Rule

When adding setTimeout/setInterval:
1. Store timer ID in instance variable
2. Add clearTimeout/clearInterval in destroy()
3. Document the cleanup

All major files have proper timer cleanup.

### ✅ The Dialog Rule

All user-facing dialogs must:
1. Use DialogManager or fallback wrapper
2. Have ARIA attributes
3. Support keyboard navigation
4. Match MediaWiki styling

All dialogs now use DialogManager with fallbacks.

---

## Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total tests | 7,506 | ✅ |
| Statement coverage | 92.6% | ✅ |
| Branch coverage | 81.3% | ✅ |
| Function coverage | 90.2% | ✅ |
| Line coverage | 92.9% | ✅ |
| Test suites | 133 | ✅ |

### Files Needing Coverage Improvement

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| LayerDragDrop.js | 68.9% | 48.1% | ⚠️ Below target |
| LayerListRenderer.js | 78.6% | 67.4% | ⚠️ Below target |
| CanvasManager.js | 86.6% | 72.2% | ✅ Acceptable for facade |
| APIManager.js | 86.6% | 73.8% | ✅ Acceptable |

### Files With Good Coverage ✅

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| EffectsRenderer.js | 99.1% | 93.0% | ✅ Excellent |
| CanvasRenderer.js | 93.7% | 78.2% | ✅ Good |
| LayerRenderer.js | 95.5% | 78.1% | ✅ Good |
| ShapeRenderer.js | 93.9% | 84.6% | ✅ Good |
| LayersValidator.js | 96.9% | 95.0% | ✅ Excellent |
| DialogManager.js | 96.1% | 77.2% | ✅ Good |

---

## Next Actions

### Immediate (P0) - ⚠️ NEW ISSUE

**LayerPanel.js at 2,572 lines requires immediate refactoring:**

1. ⚠️ **Extract folder/group rendering** to `FolderController.js` (~300 lines)
2. ⚠️ **Extract visibility cascading** to `LayerStateController.js` (~200 lines)
3. ⚠️ **Extract delete dialogs** to existing `ConfirmDialog.js` (~150 lines)
4. **Target:** Reduce LayerPanel.js to under 1,800 lines

**Estimated effort:** 2-3 days

### Short-Term (P1)

1. ⏳ Improve LayerDragDrop.js coverage (68.9% → 85%+)
2. ⏳ Improve LayerListRenderer.js coverage (78.6% → 85%+)
3. ⏳ Monitor files approaching 1,000 lines (ToolbarStyleControls at 946, PropertiesForm at 914)

### Medium Term (P2)

4. ⏳ Consider responsive toolbar for mobile devices
5. ⏳ Address 17 eslint-disable comments (reduce by extracting fallback code)

### Long Term (P3)

6. ⏳ Mobile-optimized UI - **Biggest impact for users**
7. ⏳ WCAG 2.1 AA audit

---

## Feature Requests

### FR-1: Auto-Create Layer Set on Editor Link (P2)

**Status:** ✅ Implemented (v1.2.9)  
**Effort:** ~4 hours (completed)  
**Documentation:** [FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md](docs/FEATURE_REQUEST_AUTO_CREATE_LAYER_SET.md)

**Summary:** When a user clicks a `layerslink=editor` link to a non-existent layer set, automatically create the set instead of showing an error. This enables:
- Pre-planned article templates with layer set placeholders
- Page Forms integration for structured wiki workflows
- Seamless collaborative annotation workflows

**Implementation:**
- `src/Action/EditLayersAction.php` - checks `autocreate=1` URL param, validates `createlayers` permission, passes to frontend
- `src/Hooks/Processors/ImageLinkProcessor.php` - adds `autocreate=1` to editor URLs for named sets
- `src/Hooks/Processors/ThumbnailProcessor.php` - same for thumbnail links
- `resources/ext.layers.editor/LayersEditor.js` - `autoCreateLayerSet()` and `loadInitialLayers()` handle auto-creation
- `resources/ext.layers.editor/editor/EditorBootstrap.js` - passes `autoCreate` config to editor
- `i18n/en.json` - new message `layers-set-auto-created`
- 6 new Jest tests for auto-create functionality

---

### FR-2: Layer Groups (Folders) (P2)

**Status:** ✅ Complete (v1.2.13-v1.2.14)  
**Effort:** ~50 hours (High complexity)  
**Documentation:** [FEATURE_REQUEST_LAYER_GROUPS.md](docs/FEATURE_REQUEST_LAYER_GROUPS.md)

**Summary:** Organize layers into collapsible groups (folders) in the Layer Panel, similar to Adobe Photoshop layer groups or Figma frames.

**Implemented Features:**
- Create/rename/delete layer groups with folder metaphor
- Drag-and-drop layers into/out of groups
- Expand/collapse groups to reduce visual clutter
- Group selection = select all child layers
- Group visibility toggle affects all children
- Support for nested groups (2-3 levels deep)
- Keyboard shortcuts: Ctrl+G (group), Ctrl+Shift+G (ungroup)
- Folder delete dialog with options (keep children or delete all)
- Batch undo for folder operations

**Impact Areas:**
- Data model: New `group` layer type with `children` array
- LayerPanel.js: Tree rendering with indentation
- SelectionManager.js: Multi-layer selection via groups
- API validation: New group type validation rules
- HistoryManager: Group operations as single undo steps

---

### FR-3: Context-Aware Toolbar (P2)

**Status:** ✅ Implemented (v1.2.10)  
**Effort:** ~4 hours (completed)  
**Documentation:** [FEATURE_REQUEST_CONTEXT_AWARE_TOOLBAR.md](docs/FEATURE_REQUEST_CONTEXT_AWARE_TOOLBAR.md)

**Summary:** Show only relevant toolbar controls based on the currently selected tool or layer, hiding style controls (stroke, fill, etc.) when they are not applicable.

**Implementation:**
- `resources/ext.layers.editor/ToolbarStyleControls.js` - Added `updateContextVisibility()`, `updateContextForSelectedLayers()`, `showAllControls()`, `setContextAwareEnabled()` methods
- `resources/ext.layers.editor/ui/TextEffectsControls.js` - Added `updateForSelectedTypes()` for layer-type-based visibility
- `resources/ext.layers.editor/editor-fixed.css` - Added CSS transitions for context-hidden class
- `extension.json` - Added `LayersContextAwareToolbar` config option
- `src/Hooks/UIHooks.php` - Passes config to JavaScript
- 20 new Jest tests for context-aware toolbar behavior

**Context Behavior:**
| Context | Controls Shown |
|---------|----------------|
| Select tool (nothing selected) | Tool buttons only |
| Rectangle/circle/shape tools | Stroke, Fill, Width, Presets |
| Text tool | Font size, Text stroke, Shadow |
| Arrow/Pen tools | Stroke, Width (no fill) |
| Shape layer selected | Full style controls |

---

## Summary

The Layers extension is **fully functional and production-ready**. However, **LayerPanel.js at 2,572 lines is critical technical debt** that needs immediate attention.

**Honest Rating: 8.0/10**

Deductions:
- -0.75 for 9 god classes (26% of codebase), especially LayerPanel.js at 2,572 lines
- -0.5 for mobile UI not responsive (basic touch works)
- -0.25 for coverage decrease (94.4% → 92.6%)
- -0.25 for 17 eslint-disable comments (above target)
- -0.25 for LayerDragDrop.js and LayerListRenderer.js below coverage target

### What Would Improve the Rating

| Action | Impact |
|--------|--------|
| **Split LayerPanel.js** | **+0.5** |
| Mobile-responsive UI | +0.5 |
| Improve UI component coverage | +0.25 |
| WCAG 2.1 AA certification | +0.25 |
| Reduce eslint-disable comments | +0.25 |

---

*Plan updated: December 30, 2025*  
*Status: ⚠️ **P0 Issue: LayerPanel.js at 2,572 lines** - Requires immediate refactoring*  
*Version: 1.2.14*  
*Feature Requests: FR-1, FR-2, and FR-3 implemented*
