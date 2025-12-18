# Layers Extension - Improvement Plan

**Last Updated:** December 18, 2025  
**Status:** ⚠️ Production Ready with Technical Debt  
**Version:** 1.1.2-dev  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 17, 2025.

### Current State (Honest Assessment)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Working | Extension works in production, 13 drawing tools |
| **Test Suite** | ✅ Good | ~5,100 tests, ~91% statement coverage |
| **Security (PHP)** | ✅ Excellent | CSRF, rate limiting, validation |
| **Code Splitting** | ✅ Done | Viewer 682 lines, Shared ~5K lines, Editor ~34K lines |
| **ES6 Migration** | ✅ Complete | 67 ES6 classes, 0 prototype methods |
| **God Classes** | ⚠️ Technical Debt | **8 files over 1,000 lines** (was 9, ShapeRenderer extracted) |
| **E2E Tests** | ❌ Not in CI | Playwright exists but not automated |
| **Documentation** | ⚠️ Needs Work | Often lags behind code changes |

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | This week | Blocking issues, trivial fixes, quick wins |
| **P1** | 1-4 weeks | High-impact improvements |
| **P2** | 1-3 months | Important refactoring |
| **P3** | 3-6 months | Modernization efforts |

---

## Completed Work (Phases 0-1)

### Phase 0: Quick Wins ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| P0.1 Remove Dead PHP Code | ✅ Done | `getNextRevision()` removed |
| P0.2 Empty Catch Blocks | ✅ Done | Added `mw.log.warn()` |
| P0.3 Extract `getClass()` | ✅ Done | `NamespaceHelper.js` created |
| P0.4 Remove Skipped Tests | ✅ Done | Cleaned up |
| P0.5 Fix IconFactory Tests | ✅ Done | All 18 passing |
| P0.6 LayersViewer ES6 | ✅ Done | Converted + 38 tests |

### Phase 1: High-Impact Improvements ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| P1.1 Global Export Cleanup | ✅ Done | 50 → 0 direct `window.X` exports |
| P1.2 Integration Tests | ✅ Done | 138 tests across 3 files |
| P1.3 PHP Logging | ✅ Done | All use injected logger |

---

## Phase 2: Major Refactoring (Current Focus)

### P2.1 ES6 Class Migration ✅ COMPLETE

- **Status:** 100% complete
- **Result:** 67 ES6 classes, 0 prototype methods

### P2.2 Split LayerRenderer ✅ COMPLETE

- **Status:** Reduced from 1,953 to 371 lines (81% reduction)
- **Extracted:** ShapeRenderer (1,367), ArrowRenderer (702), ShadowRenderer (521), TextRenderer (343), EffectsRenderer (245)

### P2.3 CanvasManager Extraction ✅ ~75% COMPLETE

- **Status:** Delegates to 10+ controllers
- **Current size:** 1,893 lines (down from ~4,000)
- **Controllers extracted:** ZoomPan, GridRulers, Transform, HitTest, Drawing, Clipboard, Render, Interaction, Style, TextInput, ResizeCalculator
- **Remaining:** Orchestration code is cohesive; further splitting has diminishing returns

### P2.4 TransformController Split ✅ COMPLETE

- **Status:** Extracted ResizeCalculator.js (806 lines)
- **TransformController:** 761 lines

### P2.5-P2.9 Coverage Improvements ✅ COMPLETE

- ShadowRenderer: 72% → 100%
- ResizeCalculator: 75% → 93%
- StateManager: 68% → 98%
- APIManager: 59% → 80%
- LayersNamespace: 27% → 78%
- LayerPanel: 77% → 87%

### P2.10 ✅ Extract TextBoxRenderer - COMPLETE

- **Status:** COMPLETE (December 18, 2025)
- **Problem:** ShapeRenderer grew from ~1,050 to 1,367 lines with Text Box feature
- **Result:** Extracted TextBoxRenderer.js (~430 lines)
- **ShapeRenderer:** Reduced from 1,367 to 1,049 lines (24% reduction)
- **Tests:** 50 new unit tests, all passing
- **Applied to:** Both main and REL1_39 branches

### P2.11 ⚠️ Set Up E2E Tests in CI - NOT STARTED

- **Status:** NOT STARTED
- **Problem:** Playwright tests exist but not running in CI
- **Action:** GitHub Actions workflow with Docker MediaWiki
- **Effort:** 1-2 weeks
- **Priority:** P1

### P2.12 ✅ Extract Tool Handlers from ToolManager - COMPLETE

- **Status:** COMPLETE (December 18, 2025)
- **Problem:** ToolManager.js at 1,180 lines with embedded tool-specific logic
- **Result:** Extracted 2 new handlers with delegation pattern:
  - **TextToolHandler.js** (~210 lines) - text layer creation UI
  - **PathToolHandler.js** (~230 lines) - freeform path drawing
- **Tests:** 58 new unit tests, all passing
- **Pattern:** ToolManager delegates to handlers when available, with inline fallback for backwards compatibility
- **Total test count:** 5,164 tests passing

---

## Current God Classes (Priority P2)

**These 8 files over 1,000 lines represent the main maintainability concern:**

| File | Lines | Delegation | Priority | Action |
|------|-------|------------|----------|--------|
| CanvasManager.js | 1,893 | 10+ controllers | Low | Orchestrator, hard to split further |
| LayerPanel.js | 1,720 | 7 controllers | Low | Well-delegated |
| APIManager.js | 1,385 | None | **High** | Split into API + State layers |
| LayersEditor.js | 1,296 | 3 modules | Medium | Consider more extraction |
| SelectionManager.js | 1,266 | None | Medium | Cohesive but large |
| ToolManager.js | 1,275 | 2 handlers | Medium | **Has TextToolHandler + PathToolHandler** |
| CanvasRenderer.js | 1,132 | None | Medium | Consider layer-type renderers |
| Toolbar.js | 1,126 | None | Medium | Extract section builders |

**Recently addressed:**
- ✅ ShapeRenderer.js: 1,367 → 1,049 lines (extracted TextBoxRenderer)
- ✅ ToolManager.js: Extracted TextToolHandler (210 lines) + PathToolHandler (230 lines)

**Recommended extraction order:**
1. ~~ShapeRenderer → TextBoxRenderer~~ ✅ DONE
2. ~~ToolManager → TextToolHandler, PathToolHandler~~ ✅ DONE
3. APIManager → APIClient + StateManager consolidation
4. Toolbar → ToolbarSections (lower priority)

---

## Phase 3: Modernization (P3)

### P3.1 Add TypeScript Definitions

- **Status:** NOT STARTED
- **Effort:** 2-3 weeks
- **Benefit:** IDE autocomplete, type checking, documentation

### P3.2 TypeScript Migration

- **Status:** NOT STARTED
- **Prerequisites:** P3.1 complete
- **Effort:** 8+ weeks
- **Approach:** Gradual `.js` → `.ts` conversion

### P3.3 E2E Test Expansion

- **Status:** NOT STARTED
- **Prerequisites:** P2.11 complete (CI setup)
- **Effort:** 2-3 weeks
- **Target:** 20+ E2E tests covering core workflows

### P3.4 Mobile/Touch Support

- **Status:** NOT STARTED
- **Effort:** 4-6 weeks
- **Features:** Touch gestures, responsive UI, mobile toolbar

### P3.5 Tool Defaults System

- **Status:** NOT STARTED
- **Priority:** P3 (Future Enhancement)
- **Effort:** 3-4 weeks
- **Description:** Allow users to save and apply named style presets for tools

**Concept:**
Users create reusable style presets (e.g., "Red Warning Arrow", "Blue Label Text") that can be applied to tools. This ensures consistent styling across annotations and speeds up workflow.

**Features:**
1. **Tool Defaults Form** - A settings panel listing every tool with its configurable properties
2. **Named Default Records** - User creates named presets (e.g., "Primary Heading", "Error Arrow")
3. **Master Default** - One preset can be marked as the master/default for each tool type
4. **Property Controls** - Each control gets a "Use default" checkbox or dropdown to select a named preset
5. **Dynamic Updates** - Objects linked to a preset update when the preset changes (optional)

**Example Use Cases:**
- Medical diagrams: "Anatomy Label" preset (blue text, white outline, 14pt font)
- Technical diagrams: "Warning" preset (red arrow, thick stroke, dashed)
- Educational content: "Definition" preset (green textbox, rounded corners)

**Implementation Approach:**
1. Create `ToolDefaults.js` module with CRUD for preset storage
2. Add UI panel for managing presets (modal dialog or side panel)
3. Extend tool option controls to support "inherit from preset" mode
4. Store presets per-user in browser localStorage initially
5. Future: Store presets server-side for cross-device sync

**Data Structure Example:**
```javascript
{
  "userPresets": {
    "arrow-warning": {
      "tool": "arrow",
      "name": "Warning Arrow",
      "isDefault": true,
      "properties": {
        "stroke": "#ff0000",
        "strokeWidth": 3,
        "arrowhead": "arrow",
        "arrowStyle": "solid"
      }
    },
    "text-heading": {
      "tool": "text",
      "name": "Section Heading",
      "isDefault": false,
      "properties": {
        "fontFamily": "Arial",
        "fontSize": 24,
        "fontWeight": "bold",
        "color": "#333333"
      }
    }
  }
}
```

---

## Progress Tracking

### Visual Progress

```
Phase 0 (Quick Wins):
P0.1 Remove Dead PHP Code:    ████████████████████ 100% ✓
P0.2 Empty Catch Blocks:      ████████████████████ 100% ✓
P0.3 Extract getClass():      ████████████████████ 100% ✓
P0.4 Remove Skipped Test:     ████████████████████ 100% ✓
P0.5 Fix IconFactory Tests:   ████████████████████ 100% ✓
P0.6 LayersViewer ES6:        ████████████████████ 100% ✓

Phase 1 (High Impact):
P1.1 Global Export Cleanup:   ████████████████████ 100% ✓
P1.2 Integration Tests:       ████████████████████ 100% ✓ (138 tests)
P1.3 PHP Logging:             ████████████████████ 100% ✓

Phase 2 (Refactoring):
P2.1 ES6 Migration:           ████████████████████ 100% ✓
P2.2 LayerRenderer Split:     ████████████████████ 100% ✓
P2.3 CanvasManager:           ███████████████░░░░░ 75%
P2.4 TransformController:     ████████████████████ 100% ✓
P2.5-P2.9 Coverage:           ████████████████████ 100% ✓
P2.10 ShapeRenderer Split:    ████████████████████ 100% ✓
P2.11 E2E CI Setup:           ░░░░░░░░░░░░░░░░░░░░ 0% ⚠️ URGENT

Phase 3 (Modernization):
P3.1 TypeScript Definitions:  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 E2E Test Expansion:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Mobile Support:          ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 2 Complete When:
- [ ] ShapeRenderer < 1,000 lines (extract TextBoxRenderer) ✓ (1,049 lines)
- [ ] ToolManager < 1,000 lines (extract tool modules)
- [ ] APIManager < 1,000 lines (split API/state)
- [ ] E2E tests running in CI

### Project "Healthy" When:
- [ ] 0 files > 1,000 lines (currently 9) ← **Main Goal**
- [x] ES6 classes throughout ✓ (100%)
- [x] 0 prototype methods ✓
- [x] All tests passing ✓ (~5,106)
- [x] >90% statement coverage ✓ (~91%)
- [x] >75% branch coverage ✓ (~78%)
- [ ] E2E tests automated in CI
- [x] Accessibility: Skip links + ARIA landmarks ✓

---

## Estimated Timeline

| Phase | Duration | Start After |
|-------|----------|-------------|
| Phase 0 | ✅ COMPLETE | - |
| Phase 1 | ✅ COMPLETE | - |
| Phase 2 | 8-12 weeks remaining | Now |
| Phase 3 | 12+ weeks | Phase 2 |

**Remaining to "Healthy" state:** 
- Split 6 god classes from >1,000 to <1,000 lines each
- Set up E2E CI pipeline

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Feature growth adds to god classes | **High** | High | Establish "no file > 800 lines" rule |
| E2E setup takes longer than expected | Medium | Medium | Start with minimal workflow |
| Refactoring introduces bugs | Low | Medium | Rely on 91% test coverage |
| Documentation falls behind | **High** | Low | Review docs with each PR |

---

## What To Do Next

### This Week (Urgent)

1. **Set up E2E CI workflow**
   - Playwright tests exist but aren't running
   - Use GitHub Actions + Docker MediaWiki
   - Effort: 2-3 days

### This Month

2. **Split ToolManager.js** (1,180 lines)
   - Extract TextBoxTool.js, TextTool.js
   - Each tool should be its own module

3. **Split APIManager.js** (1,385 lines)
   - Separate API calls from state management
   - Consider consolidating with StateManager

### This Quarter

4. **Continue god class reduction**
   - Target: 0 files > 1,000 lines
   - Focus on files without delegation patterns first

5. **Consider Tool Defaults feature** (P3.5)
   - User-requested enhancement
   - Allows named style presets for consistent annotations
   - See P3.5 section for full specification

---

## New Rule: Prevent Future God Classes

**Proposed code review checklist item:**

> ❌ **BLOCK** any PR that:
> - Adds >100 lines to a file already >800 lines
> - Creates a new file >500 lines without justification
> - Adds features to god classes instead of extracting first

This would have prevented ShapeRenderer from growing to 1,367 lines with the Text Box feature.

---

## Verification Commands

```bash
# God classes (>1000 lines) - target: 0
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | awk '$1 >= 1000 {print}' | sort -rn

# Test count
find tests/jest -name "*.test.js" -exec grep -c "test(" {} + | awk -F: '{sum+=$2} END {print sum}'

# Coverage (run full suite)
npx jest --coverage

# ES6 class count (expect 67)
grep -rE "^\s*class\s+[A-Z]" resources --include="*.js" | wc -l
```

---

*Plan created by GitHub Copilot (Claude Opus 4.5) on December 10, 2025*  
*Last updated: December 18, 2025 (TextBoxRenderer extracted, background opacity/visibility bug fixed, Tool Defaults P3.5 added)*
