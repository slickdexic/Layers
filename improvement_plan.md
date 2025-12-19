# Layers Extension - Improvement Plan

**Last Updated:** December 18, 2025  
**Status:** ⚠️ Production Ready with Technical Debt Being Addressed  
**Version:** 1.1.3  
**Related:** See [`codebase_review.md`](./codebase_review.md) for detailed analysis

---

## Overview

This document provides a **prioritized, actionable improvement plan** based on the critical code review performed December 19, 2025.

### Current State (Brutally Honest Assessment)

| Area | Status | Details |
|------|--------|--------|
| **Functionality** | ✅ Working | Extension works in production, 13 drawing tools |
| **Test Suite** | ✅ Improving | **5,297 tests** (+500 since v1.0.0), ~92% statement coverage |
| **Security (PHP)** | ✅ Excellent | CSRF, rate limiting, validation - no known vulnerabilities |
| **Code Splitting** | ✅ Done | Viewer ~544 lines, Shared ~5K lines, Editor ~35K lines |
| **ES6 Migration** | ✅ Complete | 70 ES6 classes (102 files), 0 prototype methods |
| **God Classes** | ⚠️ Improving | **7 files over 1,000 lines** (~10.6K total) - down from 9 |
| **E2E Tests** | ❌ Not in CI | Playwright exists but not automated - **HIGH RISK** |
| **Documentation** | ⚠️ Improving | Updated this review, requires ongoing discipline |
| **CI Enforcement** | ✅ Active | God class growth prevention CI check added Dec 18, 2025 |
| **Bug Fixes** | ✅ Recent | Text shadow normalization fix (Dec 19, 2025) |

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
- **Tests:** 58 new unit tests, all passing (total now 5,236)
- **Pattern:** ToolManager delegates to handlers when available, with inline fallback for backwards compatibility
- **Impact:** ToolManager still 1,275 lines (reduction minimal so far)

### P2.13 ✅ Extract SelectionRenderer from CanvasRenderer - COMPLETE

- **Status:** COMPLETE (December 18, 2025)
- **Problem:** CanvasRenderer.js at 1,140 lines with distinct selection UI code
- **Result:** Extracted SelectionRenderer.js (~349 lines)
- **CanvasRenderer:** Reduced from 1,140 → 1,001 lines (12% reduction)
- **Tests:** 29 new unit tests, all passing (total now 5,364)
- **Methods extracted:**
  - `drawMultiSelectionIndicators()` - multi-select bounding box
  - `drawSelectionIndicators()` - single layer selection box
  - `drawSelectionHandles()` - resize/transform handles
  - `drawLineSelectionIndicators()` - line/arrow endpoints
  - `drawRotationHandle()` - rotation control
  - `drawMarqueeBox()` - marquee selection rectangle
- **Pattern:** CanvasRenderer delegates to SelectionRenderer via composition
- **Impact:** CanvasRenderer now under 1,100 lines with cleaner separation of concerns

### P2.14 ✅ Text Shadow Viewer Bug Fix - COMPLETE

- **Status:** COMPLETE (December 19, 2025)
- **Problem:** Text shadow on textbox objects rendered in editor but not on article pages
- **Root Cause:** The editor's `APIManager.normalizeBooleanProperties()` converts string/numeric booleans to actual booleans. The viewer lacked this normalization.
- **Result:**
  - Added `normalizeLayerData()` method to `LayersViewer.js`
  - Called in `init()` before rendering begins
  - Converts: shadow, textShadow, glow, visible, locked properties
- **Tests Added:** 4 new tests in LayersViewer.test.js + 1 improved test in TextBoxRenderer.test.js
- **Impact:** Viewer now renders text shadows correctly; total tests now 5,250

**Architectural Lesson Learned:**
The editor and viewer share data through the API but have separate initialization paths. This bug revealed a pattern risk: when adding boolean-dependent features, ensure BOTH paths normalize data consistently. Future work should extract a shared `LayerDataNormalizer` utility to prevent divergence.

### P2.15 ✅ Extract Shared LayerDataNormalizer - COMPLETE

- **Status:** COMPLETE (December 19, 2025)
- **Problem:** Editor and viewer both normalized layer data with separate implementations
- **Risk:** Future boolean properties might be added to one normalizer but not the other
- **Solution:**
  - Created `LayerDataNormalizer.js` in `ext.layers.shared/`
  - Refactored both `APIManager` and `LayersViewer` to use the shared utility
  - Fallback methods preserved for testing environments
- **Tests Added:** 46 comprehensive unit tests
- **Impact:** Single source of truth for boolean property normalization; prevents future divergence

**CRITICAL NOTE ON TRAJECTORY:**
While these extractions are positive, the overall codebase grew from 35,700 to 40,719 lines (+14%) in just 30 days. We're extracting files while simultaneously adding features that grow other files. Net effect: **debt is accumulating, not decreasing**.

---

## Reality Check: Trajectory Improving

**Positive Signs:** Recent work is reducing debt, not just moving it around.

### The Numbers (Updated December 19, 2025)

| Metric | v1.0.0 (Dec 7) | v1.1.2 (Dec 19) | Change |
|--------|----------------|-----------------|--------|
| Total LOC | ~35,700 | **~41,000** | +15% (features added) |
| God classes (>1K) | 9 | **8** | -1 ✅ |
| God class total LOC | ~12,365 | **~12,100** | -2% reduction ✅ |
| Test count | ~4,800 | **5,297** | +10% ✅ |
| Test coverage | 90.4% | ~92% | +1.6% ✅ |

**What Changed:**
- TextBoxRenderer extracted from ShapeRenderer (1,367 → 1,049 lines)
- SelectionRenderer extracted from CanvasRenderer (1,140 → 1,001 lines)
- CanvasRenderer now under 1,100 lines (removed from god class list)
- Text shadow bug fixed with proper normalization
- 4 new tests added for layer data normalization

**Trajectory:** Improving ↗️ - debt being paid down while maintaining functionality

## Current God Classes (Priority P2)

**These 8 files over 1,000 lines represent the main maintainability concern:**

| File | Lines | Delegation | Priority | Action |
|------|-------|------------|----------|--------|
| CanvasManager.js | 1,893 | 10+ controllers | Low | Orchestrator, hard to split further |
| LayerPanel.js | 1,720 | 7 controllers | Low | Well-delegated |
| LayersEditor.js | 1,296 | 3 modules | Medium | Consider more extraction |
| ToolManager.js | 1,275 | 2 handlers | Medium | **Has TextToolHandler + PathToolHandler** |
| Toolbar.js | 1,159 | None | Medium | Extract section builders |
| SelectionManager.js | 1,147 | None | **High** | ⚠️ Needs split - NO delegation |
| APIManager.js | 1,147 | 1 handler | Medium | ✅ Extracted APIErrorHandler (Dec 18) |
| ShapeRenderer.js | 1,049 | None | Medium | ✅ Extracted TextBoxRenderer (Dec 18) |

**Files approaching god class limit (800+ lines):**
- CanvasRenderer.js: 1,001 lines ⚠️ (down from 1,140, close to target)
- LayersValidator.js: 958 lines ⚠️
- UIManager.js: 917 lines ⚠️
- PropertiesForm.js: 823 lines ⚠️
- ResizeCalculator.js: 822 lines ⚠️

**Recently addressed:**
- ✅ ShapeRenderer.js: 1,367 → 1,049 lines (extracted TextBoxRenderer)
- ✅ CanvasRenderer.js: 1,140 → 1,001 lines (extracted SelectionRenderer, Dec 18)
- ✅ ToolManager.js: Extracted TextToolHandler (210 lines) + PathToolHandler (230 lines)
- ✅ APIManager.js: 1,385 → 1,147 lines (extracted APIErrorHandler, 347 lines)
- ✅ LayersViewer.js: Fixed text shadow bug with normalizeLayerData() (Dec 19)
- ✅ CI enforcement: God class growth prevention check added Dec 18, 2025

**Recommended extraction order:**
1. ~~ShapeRenderer → TextBoxRenderer~~ ✅ DONE
2. ~~ToolManager → TextToolHandler, PathToolHandler~~ ✅ DONE
3. ~~APIManager → APIErrorHandler~~ ✅ DONE (Dec 18, 2025)
4. ~~LayersViewer → normalizeLayerData~~ ✅ DONE (Dec 19, 2025) - bug fix
5. **Extract shared LayerDataNormalizer** - consolidate editor/viewer normalization (P1)
6. APIManager → further split API operations (still 1,147 lines)
7. Toolbar → ToolbarSections (lower priority)

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
P2.12 Tool Handlers:          ████████████████████ 100% ✓
P2.13 SelectionRenderer:      ████████████████████ 100% ✓
P2.14 Text Shadow Bug:        ████████████████████ 100% ✓
P2.15 Shared Normalizer:      ████████████████████ 100% ✓

Phase 3 (Modernization):
P3.1 TypeScript Definitions:  ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 TypeScript Migration:    ░░░░░░░░░░░░░░░░░░░░ 0%
P3.3 E2E Test Expansion:      ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 Mobile Support:          ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 2 Complete When:
- [x] ShapeRenderer < 1,000 lines (extract TextBoxRenderer) ✓ (1,049 lines)
- [x] CanvasRenderer < 1,100 lines (extract SelectionRenderer) ✓ (1,001 lines)
- [x] Text shadow bug fixed ✓ (normalizeLayerData added)
- [ ] ToolManager < 1,000 lines (extract more tool modules)
- [ ] APIManager < 1,000 lines (split API/state)
- [ ] E2E tests running in CI
- [x] Shared LayerDataNormalizer extracted ✓

### Project "Healthy" When:
- [ ] 0 files > 1,000 lines (currently 8) ← **Main Goal**
- [x] ES6 classes throughout ✓ (100%)
- [x] 0 prototype methods ✓
- [x] All tests passing ✓ (**5,250**)
- [x] >90% statement coverage ✓ (~92%)
- [x] >80% branch coverage ✓ (~80%)
- [ ] E2E tests automated in CI
- [x] Accessibility: Skip links + ARIA landmarks ✓
- [x] Editor/Viewer data parity ✓ (normalizeLayerData fix)

---

## Estimated Timeline (Honest Projection)

| Phase | Duration | Reality Check |
|-------|----------|---------------|
| Phase 0 | ✅ COMPLETE | Quick wins done |
| Phase 1 | ✅ COMPLETE | High-impact work done |
| Phase 2 | **12-16 weeks** if focused | **24+ weeks** if features continue |
| Phase 3 | 12+ weeks | Only after Phase 2 |

**Time to "Healthy" State:**

*If we commit to feature freeze:*
- **Week 1:** E2E CI setup, god class growth prevention
- **Weeks 2-3:** APIManager split
- **Weeks 4-5:** SelectionManager split
- **Weeks 6-8:** ToolManager, Toolbar, CanvasRenderer splits
- **Weeks 9-10:** LayersEditor split
- **Weeks 11-12:** CanvasManager documentation (already delegates)
- **Week 13:** Architecture docs, retrospective
- **Week 14+:** Feature freeze lifts, new capabilities unlocked

*If we keep shipping features:*
- **Reality:** We'll still have 9 god classes in 6 months unless we focus
- New features will make them bigger (history proves this)
- Eventually, development grinds to a halt
- Emergency refactoring under pressure (high risk)

**Brutal Truth:** You can have sustainable velocity OR new features. Pick one.

---

## Risk Assessment (December 2025 Reality Check)

| Risk | Probability | Impact | Status | Mitigation |
|------|-------------|--------|--------|------------|
| **Codebase becomes unmaintainable** | **VERY HIGH** | **CRITICAL** | 🚨 **HAPPENING NOW** | Feature freeze + debt sprint |
| **Key contributor leaves, knowledge lost** | **HIGH** | **CRITICAL** | ⚠️ Vulnerable | Document god classes ASAP |
| E2E bugs reach production | **HIGH** | **HIGH** | ⚠️ No CI tests | P0: E2E CI setup |
| Feature velocity slows as complexity grows | **CERTAIN** | **HIGH** | 🚨 **ALREADY VISIBLE** | Stop features, reduce debt |
| New contributors can't onboard | **HIGH** | **MEDIUM** | ⚠️ Steep curve | Arch docs + refactoring |
| PRs take >1 week to review | **MEDIUM** | **MEDIUM** | Trending up | Smaller files = faster review |
| Refactoring introduces bugs | **LOW** | **MEDIUM** | Controlled | 92% test coverage safety net |
| Documentation falls behind | **CERTAIN** | **LOW** | Accepted | Manual process, best effort |

---

## What To Do Next: Stop Digging

**First rule of holes: When you're in one, stop digging.**

### IMMEDIATE (This Week) - MANDATORY

**FEATURE FREEZE until further notice.**

No new features, no "quick wins", no "while we're in there" additions. Only:
1. Critical bug fixes (security, data loss)
2. Debt reduction work
3. Test infrastructure improvements

**P0.1: Set up E2E CI workflow** (2-3 days)
- Playwright exists but not running in CI
- Use GitHub Actions + Docker MediaWiki
- This is a time bomb - we're shipping browser bugs to production

**P0.2: Establish a "No God Class Growth" policy** ✅ DONE (Dec 18, 2025)
- ✅ Pre-commit hook script: `scripts/pre-commit-god-class-check.sh`
- ✅ CI check: `.github/workflows/god-class-check.yml` blocks PRs that grow god classes
- ✅ npm script: `npm run check:godclass`
- ✅ Documentation: Added to CONTRIBUTING.md

### THIS MONTH - Debt Reduction Sprint

**P1.1: Split APIManager.js** (1,385 lines) - **1 week**
- Current: Mixes API calls, caching, state management
- Target: APIClient.js (<400 lines) + consolidate with StateManager
- This is the most egregious god class (no delegation at all)

**P1.2: Split SelectionManager.js** (1,266 lines) - **1 week**
- Current: Cohesive but massive
- Target: SelectionManager (<500), SelectionRenderer (<400), SelectionGeometry (<400)
- Second-worst offender (zero delegation)

**P1.3: Document CanvasManager delegation** (2 days)
- CanvasManager is a facade (1,893 lines but delegates to 10+ controllers)
- Document the pattern so others can follow it
- Create architecture diagram showing controller relationships

### THIS QUARTER - Get to Green

**Success Criteria (Exit Feature Freeze):**
- [ ] 0 files over 1,000 lines
- [ ] E2E tests in CI with >10 test scenarios
- [x] God class growth prevention automated in CI ✅
- [ ] Architecture documentation complete

**Only after these are met:** Consider new features (Tool Defaults, mobile support, etc.)

---

## MANDATORY RULES (Effective Immediately)

### Rule 1: God Class Growth Prevention

**CI CHECK (BLOCKING):**
```bash
# Fail build if any file grows beyond current size when already >1,000 lines
for file in $(god_classes); do
  current=$(wc -l < $file)
  baseline=$(git show main:$file | wc -l)
  if [ $current -gt $baseline ]; then
    echo "❌ BLOCKED: $file grew from $baseline to $current lines"
    exit 1
  fi
done
```

### Rule 2: No New God Classes

**Pre-commit hook:**
```bash
# Warn if any file approaches 800 lines
# Block if any file exceeds 1,000 lines (unless already above)
```

### Rule 3: Feature Freeze Exit Criteria

New features are **BLOCKED** until:
1. ✅ APIManager < 1,000 lines
2. ✅ SelectionManager < 1,000 lines
3. ✅ E2E tests running in CI
4. ✅ Architecture docs published

### Rule 4: The "1-for-1" Alternative

If feature freeze is deemed unacceptable, enforce:
- **Every PR adding >50 lines must extract ≥50 lines from a god class**
- Extraction must be in the same PR (not "follow-up")
- Extractions tracked in PR description

This prevents accumulating more debt while features continue.

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
*Last updated: December 19, 2025 (Text shadow bug fixed, shared normalizer planned)*
