# Layers Extension - Improvement Plan

**Last Updated:** December 31, 2025  
**Status:** ✅ No Critical Issues - Production Ready  
**Version:** 1.4.0  
**Goal:** World-class, production-ready MediaWiki extension

---

## Executive Summary

The extension is **production-ready** with layer grouping feature complete. All god classes use delegation patterns. All coverage gaps have been addressed. **All PHP warnings fixed (45 → 0).**

**Current Rating: 8.5/10**

---

## Current State (December 31, 2025)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Complete | 12 tools + layer grouping with folders |
| **Security** | ✅ Resolved | All known security issues fixed; localStorage validation added |
| **Testing** | ✅ Excellent | 7,852 tests (136 suites), 94.0% statement, 82.9% branch, 91.9% function coverage |
| **ES6 Migration** | ✅ Complete | 92 classes, 0 prototype patterns |
| **Code Hygiene** | ✅ Excellent | 0 TODO/FIXME/HACK comments |
| **God Classes** | ⚠️ Managed | 11 files >1,000 lines, all well-delegated |
| **Codebase Size** | ✅ Healthy | ~54,700 lines (102 files), well under 75K target |
| **Layer Grouping** | ✅ **COMPLETE** | Folders, expand/collapse, visibility cascade, delete options |
| **Performance** | ✅ Improved | Number inputs debounced in PropertiesForm |
| **Live Preview** | ✅ **NEW** | FR-10: Changes visible without page edit |

---

## Priority Definitions

| Priority | Timeline | Status |
|----------|----------|--------|
| **P0** | Immediate | ✅ **No critical issues** |
| **P1** | 1-4 weeks | ⏳ Monitoring |
| **P2** | 1-3 months | ⏳ Planned |
| **P3** | 3-6 months | ⏳ Not Started |

---

## Phase 0: Critical Issues (P0) - ✅ ALL RESOLVED

No critical issues. All previously identified P0 issues have been fixed:

### Previously P0 Issues - NOW RESOLVED

| Issue | Status | Resolution |
|-------|--------|------------|
| Rectangle Blur Fill Appears Transparent | ✅ FIXED | v1.2.8 - Store world coordinates before rotation |
| EffectsRenderer.js Coverage (48.7%) | ✅ FIXED | Now 99.1% statement coverage |
| CanvasRenderer.js Coverage (58.5%) | ✅ FIXED | Now 93.7% statement coverage |
| LayerDragDrop.js Coverage (68.9%) | ✅ FIXED | Now 100% statement coverage |
| LayerPanel.js Size Concern | ✅ ACCEPTABLE | 2,140 lines, well-delegated to 9 controllers |

---

## Phase 1: Monitoring Issues (P1)

### P1.1 Files Approaching 1,000 Lines

| File | Lines | Trend | Action |
|------|-------|-------|--------|
| PropertiesForm.js | 957 | Stable | ⚠️ Monitor |
| ShapeRenderer.js | 909 | Stable | ⚠️ Monitor |
| LayersValidator.js | 854 | Stable | ✅ OK |

**Note:** ToolbarStyleControls.js (1,012 lines) and ArrowRenderer.js (1,217 lines) have now crossed the 1,000 line threshold due to curved arrows and live color preview features.

### P1.2 ESLint Disable Count

**Current:** 8 eslint-disable comments  
**Target:** <15  
**Status:** ✅ WELL BELOW TARGET

| Rule | Count | Source |
|------|-------|--------|
| no-alert | 8 | DialogManager fallbacks (intentional) |

**Completed:** 
- Refactored GroupManager.js to use `omitProperty` utility (removed 4 eslint-disables)
- Replaced 5 `no-unused-vars` disables with underscore-prefix convention (`_paramName`)

### P1.3 God Class Status

All 11 files exceeding 1,000 lines use proper delegation patterns:

| File | Lines | Pattern | Status |
|------|-------|---------|--------|
| **LayerPanel.js** | **2,140** | Facade → 9 controllers | ✅ At limit |
| CanvasManager.js | 1,877 | Facade → 10 controllers | ✅ Acceptable |
| Toolbar.js | 1,556 | UI consolidation | ✅ Acceptable |
| LayersEditor.js | 1,465 | Orchestrator → managers | ✅ Acceptable |
| SelectionManager.js | 1,359 | Facade → selection helpers | ✅ Acceptable |
| ToolManager.js | 1,259 | Facade → tool handlers | ✅ Acceptable |
| CanvasRenderer.js | 1,242 | SelectionRenderer | ✅ Acceptable |
| **ArrowRenderer.js** | **1,217** | Rendering (curved arrows) | ✅ Acceptable |
| APIManager.js | 1,182 | APIErrorHandler | ✅ Acceptable |
| GroupManager.js | 1,132 | New (v1.2.13) | ✅ Acceptable |
| **ToolbarStyleControls.js** | **1,012** | Style controls (live preview) | ✅ Acceptable |

**Total in god classes: ~14,441 lines** (26% of JS codebase)

---

## Phase 2: Code Quality (P2) - Planned

### P2.1 Reduce ESLint Disables

**Status:** ✅ COMPLETE  
**Result:** Reduced from 17 → 8

**Approach Used:**
1. ✅ Refactored GroupManager.js to use `omitProperty` utility (removed 4)
2. ✅ Added underscore-prefix pattern (`_paramName`) to .eslintrc.json for intentionally unused params (removed 5)
3. Remaining 8 are intentional `no-alert` fallbacks for when DialogManager is unavailable

### P2.2 Create Architecture Diagram

**Status:** ✅ COMPLETE  
**Priority:** DONE

The ARCHITECTURE.md already contains 9 Mermaid diagrams with ASCII fallbacks:
- High-level module architecture
- Controller delegation pattern
- Rendering pipeline
- Data flow diagrams
- PHP/JS separation
- API request/response flow

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for comprehensive visualizations.

### P2.3 Mobile-Optimized UI

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

---

## Phase 3: Features (P3) - Not Started

### P3.1 TypeScript Migration ⏳

**Status:** 5% complete (2 files migrated)  
**Priority:** LOW - ES6 with JSDoc provides adequate type safety

### P3.2 WCAG 2.1 AA Audit ⏳

Full accessibility compliance audit.  
**Status:** 85% - Color contrast fixed, reduced motion added, focus indicators completed (January 2026)
**Effort:** 1 week (remaining)

### P3.3 Gradient Fills ⏳

Support for linear and radial gradients.  
**Effort:** 1 week

### P3.4 Custom Fonts ⏳

Allow users to specify custom fonts.  
**Effort:** 2 weeks

---

## Future Feature Requests (P4)

User-requested enhancements that would elevate the extension to world-class status:

### FR-4: Curved Arrows with Spline Handles ✅

**Priority:** HIGH - Core annotation improvement  
**Effort:** 2-3 weeks
**Status:** COMPLETED (v1.3.3)

Add a draggable control handle in the middle of arrow objects to create curved arrows:
- ✅ Control point drives a quadratic Bézier curve for the arrow body
- ✅ Arrow heads follow the tangent at endpoints
- ✅ Intuitive drag interaction for curve shaping (purple circular handle)
- ✅ Works with all arrow head types (pointed, chevron, standard)
- ✅ Dashed line shows connection from control point to arrow midpoint
- ✅ Key object styling supported for multi-selection

**Implementation:**
- ArrowRenderer: Added `isCurved()`, `getBezierTangent()`, `drawCurved()`, `drawArrowHead()` methods
- SelectionRenderer: Added `drawCurveControlHandle()` for purple circular control handle
- ResizeCalculator: Added 'control' handle type to `calculateLineResize()`
- ServerSideLayerValidator: Added `controlX`, `controlY` to ALLOWED_PROPERTIES
- 27 new tests (18 ArrowRenderer + 6 SelectionRenderer + 3 ResizeCalculator)

**Use Case:** Pointing to off-axis targets, flowing diagrams, organic annotations.

### FR-5: Toolbar Dropdown Grouping ⏳

**Priority:** MEDIUM - UI scalability  
**Effort:** 1-2 weeks

Reorganize the top toolbar using dropdown menus to conserve horizontal space:
- Group similar tools (e.g., Shapes: Rectangle, Circle, Ellipse, Polygon, Star)
- Group line tools (Arrow, Line)
- Group text tools (Text, Text Box)
- Show most recently used tool as the visible button
- Keyboard shortcuts continue to work globally

**Use Case:** Accommodating future tool additions without toolbar overflow.

### FR-6: Chat Bubble Tool ⏳

**Priority:** MEDIUM - New annotation type  
**Effort:** 2 weeks

A text box variant designed for speech/thought bubbles:
- All text box properties (alignment, padding, font, etc.)
- Configurable tail/pointer options:
  - Position: any edge or corner
  - Style: pointed, rounded, thought bubble (circles)
  - Direction: adjustable angle
- Preset shapes: rounded rectangle, cloud (thought), oval

**Use Case:** Comic-style annotations, dialogue callouts, instructional content.

### FR-7: Text Balloon Tool ⏳

**Priority:** MEDIUM - New annotation type  
**Effort:** 1-2 weeks

A circular text container with pointer for diagram labeling:
- Circle or ellipse shape with centered text
- Single-line or multi-line text support
- Adjustable leader line/arrow pointing to target
- Auto-sizing based on text content
- Standard text properties (font, size, color, etc.)

**Use Case:** Technical diagrams, parts callouts, numbered annotations.

### FR-8: Inline Canvas Text Editing ⏳

**Priority:** HIGH - Core UX improvement  
**Effort:** 3-4 weeks

Allow direct text editing on the canvas instead of only in the properties panel:
- Click text layer to enter edit mode
- Cursor and selection within text
- Inline formatting toolbar (font, size, weight, color, etc.)
- Real-time rendering as you type
- Escape to exit edit mode
- Works for both Text and Text Box layers

**Use Case:** Faster annotation workflow, WYSIWYG experience matching Figma/Canva.

### FR-9: Live Color Picker Preview ✅

**Priority:** HIGH - Core UX improvement  
**Effort:** 1 week
**Status:** COMPLETED (v1.3.3)

Update canvas in real-time as colors are changed in the color picker:
- ✅ Preview shows on canvas before applying
- ✅ Works for stroke and fill colors
- ✅ No commit until "Apply" is clicked
- ✅ Revert to original on "Cancel" or Escape
- ✅ Matches behavior of professional editors (Figma, Photoshop, Illustrator)

**Implementation:**
- ColorPickerDialog: Added `onPreview` callback, `originalColor` tracking, `restoreOriginalColor()` method
- ColorControlFactory: Added `onColorPreview` option that wraps callback for preview integration
- ToolbarStyleControls: Added `applyColorPreview()` method that applies color directly to selected layers and re-renders canvas
- 22 new tests covering all preview functionality

**Use Case:** Faster color selection, better visual feedback, reduced trial-and-error.

### FR-10: Live Preview Without Page Edit/Save ✅

**Priority:** HIGH - Core UX improvement  
**Effort:** 2-3 weeks
**Status:** COMPLETED (v1.3.3)

Changes made in the editor are visible on article pages immediately after saving layers, without needing to edit and save the wiki page:
- ✅ Viewer detects stale inline data via revision comparison
- ✅ API is queried for latest revision on page load
- ✅ Stale viewers are automatically reinitialized with fresh data
- ✅ Results cached briefly (30s) to avoid repeated API calls
- ✅ Graceful fallback on errors (assumes fresh to avoid breaking viewer)

**Implementation:**
- ThumbnailProcessor: Added `data-layer-revision`, `data-layer-setname`, `data-file-name` attributes
- FreshnessChecker.js: New module for checking if inline data is stale
- ViewerManager: Added `reinitializeViewer()`, `checkAndRefreshStaleViewers()` methods
- 45 new tests (33 for FreshnessChecker + 12 for ViewerManager)

**Technical Notes:**
- Uses sessionStorage for caching freshness checks (30 second TTL)
- API call includes `limit=1` for minimal response when checking freshness
- If stale, full layer data is included in response for immediate reinitialization

**Use Case:** Streamlined workflow for annotators, immediate feedback, reduced confusion.

---

## Progress Tracking

```
Phase 0 (CRITICAL):
All P0 issues resolved:          ████████████████████ 100% ✅ No critical issues

Previous P0 Issues (RESOLVED):
P0.1 Rectangle blur fix:         ████████████████████ 100% ✅ FIXED (v1.2.8)
P0.2 EffectsRenderer coverage:   ████████████████████ 100% ✅ FIXED (99%)
P0.3 CanvasRenderer coverage:    ████████████████████ 100% ✅ FIXED (94%)
P0.4 LayerDragDrop coverage:     ████████████████████ 100% ✅ FIXED (100%)

Phase 1 (Monitoring):
P1.1 Files approaching 1K:       ██████████████████░░ 90%  ⚠️ 3 files at 900-950 lines
P1.2 ESLint disables:            ████████████████████ 100% ✅ 8 (target <15) - DONE
P1.3 God class delegation:       ████████████████████ 100% ✅ All well-delegated

Phase 2 (Code Quality):
P2.1 Reduce ESLint disables:     ████████████████████ 100% ✅ 8 (below <15 target)
P2.2 Architecture diagram:       ████████████████████ 100% ✅ 9 Mermaid diagrams in ARCHITECTURE.md
P2.3 Mobile UI optimization:     ██████░░░░░░░░░░░░░░ 30%  ⏳ Basic touch works

Phase 3 (Features):
P3.1 TypeScript:                 █░░░░░░░░░░░░░░░░░░░ 5%   ⏳ Low Priority
P3.2 WCAG Audit:                 █████████████████░░░ 85%  ⏳ Focus indicators added (January 2026)
P3.3 Gradient Fills:             ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started
P3.4 Custom Fonts:               ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ Not Started

Phase 4 (Future Feature Requests):
FR-4 Curved Arrows:              ████████████████████ 100% ✅ DONE (v1.3.3)
FR-5 Toolbar Dropdowns:          ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ MEDIUM - UI scalability
FR-6 Chat Bubble Tool:           ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ MEDIUM - Speech bubbles
FR-7 Text Balloon Tool:          ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ MEDIUM - Diagram callouts
FR-8 Inline Text Editing:        ░░░░░░░░░░░░░░░░░░░░ 0%   ⏳ HIGH - WYSIWYG text
FR-9 Live Color Preview:         ████████████████████ 100% ✅ DONE (v1.3.3)
FR-10 Live Article Preview:      ████████████████████ 100% ✅ DONE (v1.3.3)
```

---

## Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total tests | 7,852 | ✅ |
| Statement coverage | 94.0% | ✅ Excellent |
| Branch coverage | 82.9% | ✅ |
| Function coverage | 91.9% | ✅ |
| Line coverage | 94.3% | ✅ |
| Test suites | 136 | ✅ |

### Files With Excellent Coverage ✅

| File | Statement | Branch | Status |
|------|-----------|--------|--------|
| EffectsRenderer.js | 99.1% | 93.0% | ✅ Excellent |
| LayerDragDrop.js | 100% | 87.7% | ✅ Excellent |
| LayerListRenderer.js | 99.5% | 82.3% | ✅ Excellent |
| CanvasRenderer.js | 93.7% | 78.2% | ✅ Good |
| LayerRenderer.js | 95.5% | 78.1% | ✅ Good |
| ShapeRenderer.js | 93.9% | 84.6% | ✅ Good |

---

## What Would Make This World-Class (10/10)

### Already Have ✅

- 7,852 passing tests with 94.0% statement coverage
- 0 TODO/FIXME/HACK comments (excellent code hygiene)
- 92 ES6 classes (no legacy patterns)
- Comprehensive documentation (20+ markdown files)
- TypeScript definitions (types/layers.d.ts) for IDE IntelliSense
- Accessible UI with ARIA support and reduced motion preference
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
- Curved arrows with Bézier curves (v1.3.3+)
- Live color picker preview (v1.3.3+)
- Live article preview (v1.3.3+)

### Need for 10/10

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| **Mobile-responsive UI** | HIGH - Opens to 50% more users | 3-4 weeks | P2 |
| **Refactor largest god classes** | MEDIUM - Code maintainability | 2-3 weeks | P2 |
| **Reduce eslint-disable comments** | ✅ DONE (8, below <15 target) | - | ✅ |
| **Architecture diagram** | ✅ DONE (9 Mermaid diagrams) | - | ✅ |
| **TypeScript definitions** | ✅ DONE (comprehensive types/layers.d.ts) | - | ✅ |
| **WCAG 2.1 AA certification** | MEDIUM - Enterprise requirement | 2 weeks | P3 |

---

## Completed Feature Requests

### FR-1: Auto-Create Layer Set on Editor Link ✅

**Status:** Implemented (v1.2.9)  
When a user clicks a `layerslink=editor` link to a non-existent layer set, automatically create the set instead of showing an error.

### FR-2: Layer Groups (Folders) ✅

**Status:** Complete (v1.2.13-v1.2.14)  
Group multiple layers into collapsible folders with:
- Create/rename/delete groups
- Drag-and-drop layers into/out of groups
- Expand/collapse folders
- Group selection = select all children
- Keyboard shortcuts (Ctrl+G, Ctrl+Shift+G)
- Folder delete dialog with options

### FR-3: Context-Aware Toolbar ✅

**Status:** Implemented (v1.2.10)  
Show only relevant toolbar controls based on the currently selected tool or layer.

---

## Rules

### ⚠️ The God Class Rule - NEEDS ATTENTION

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to ~2,000 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Soft limit:** Files should ideally stay under 2,000 lines with good delegation

**Current Status:** 11 god classes use delegation patterns. Two new files crossed 1,000 lines in v1.3.3 (ArrowRenderer: curved arrows, ToolbarStyleControls: live preview). LayerPanel.js at 2,140 lines is the largest but delegates to 9 specialized controllers.

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

## Next Actions

### Immediate (P0) - ✅ NO CRITICAL ISSUES

No urgent actions required. All critical issues resolved.

### Short-Term (P1)

1. ⏳ Monitor ToolbarStyleControls.js (944 lines)
2. ✅ eslint-disable comments reduced (17 → 8, well below <15 target)
3. ⏳ Monitor PropertiesForm.js and ShapeRenderer.js

### Medium Term (P2)

4. ⏳ Create architecture diagram
5. ⏳ Consider responsive toolbar for mobile devices

### Long Term (P3)

6. ⏳ Mobile-optimized UI - **Biggest impact for users**
7. ⏳ WCAG 2.1 AA audit
8. ⏳ Consider TypeScript migration

---

## Recent Improvements (December 2025)

### Bug Fixes
- **Curved arrow scaling bug** — Control points (`controlX`, `controlY`) now properly scaled in LayersViewer
- **Curved arrow blur fill** — Frosted glass effect now works on curved arrows

### Test Coverage Improvements
- **PropertiesForm.js** — Branch coverage: 72.41% → 81.69% (+9.28pp)
- **FolderOperationsController.js** — Branch coverage: 72.56% → 88.49% (+15.93pp), function coverage: 68.18% → 100%
- **LayerItemFactory.js** — Function coverage: 71.42% → 100%, statement coverage: 97.58% → 98.79%
- **SmartGuidesController.js** — Branch coverage: 70.55% → 76.64% (+6.09pp)
- Total tests: 7,810 → 7,840 (+30 new tests)
- Overall branch coverage: 82.63% → 82.81%
- Overall function coverage: 91.65% → 91.87%

### TypeScript Definitions
- Updated types/layers.d.ts to v1.4.0 with comprehensive property coverage
- Added ArrowProperties, StarProperties, BlurProperties, GroupProperties interfaces

---

## Summary

The Layers extension is **fully functional and production-ready**. Technical debt is manageable with all god classes using proper delegation patterns.

**Honest Rating: 8.5/10**

Deductions:
- -0.75 for 11 god classes (26% of codebase)
- -0.5 for mobile UI not responsive (basic touch works)
- -0.25 for documentation sprawl (18 files in docs/, reduced from 21)

### What Would Improve the Rating

| Action | Impact |
|--------|--------|
| Mobile-responsive UI | +0.5 |
| Reduce god classes (refactor 2-3 largest) | +0.5 |
| ✅ Reduce eslint-disable comments to <15 | +0.1 (EARNED) |
| ✅ Architecture diagram | +0.1 (EARNED) |
| WCAG 2.1 AA certification | +0.25 |

---

*Plan updated: December 31, 2025*  
*Status: ⚠️ **11 god classes** - Extension is production-ready but technical debt increased with curved arrows and live preview features*  
*Version: 1.4.0*
