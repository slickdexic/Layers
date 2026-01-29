# Layers MediaWiki Extension - Codebase Review

**Review Date:** January 28, 2026 (Comprehensive Critical Audit v47)
**Version:** 1.5.38
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Scope & Verification

- **Branch:** main (verified via `git branch --show-current`)
- **Tests:** 10,840 tests in 157 suites (all passing, verified January 28, 2026)
- **Coverage:** 95.53% statements, 85.28% branches, 93.97% functions, 95.64% lines (verified January 28, 2026)
- **JS files:** 132 production files (all files in resources/ext.layers* directories)
- **JS lines:** ~93,406 total
- **PHP files:** 40 (all with `declare(strict_types=1)`)
- **PHP lines:** ~14,543 total
- **i18n messages:** ~653 layers-* keys in en.json (all documented in qqq.json, verified via Banana checker)

---

## Executive Summary

The Layers extension is a **mature, feature-rich MediaWiki extension** with **excellent security practices** and **outstanding test coverage**. This is a production-ready extension suitable for deployment.

**Overall Assessment:** **8.1/10** ‚Äî Production-ready with strong fundamentals,
but pervasive documentation drift, architectural complexity, and coverage gaps in critical UI modules prevent "world-class" status.

### Key Strengths
1. **Excellent test coverage** (95.53% statement, 85.28% branch, 10,840 tests)
2. **Comprehensive server-side validation** with strict 40+ property whitelist
3. **Modern ES6 class-based architecture** (100% of JS files)
4. **PHP strict_types** in all 40 PHP files
5. **ReDoS protection** in ColorValidator (MAX_COLOR_LENGTH = 50)
6. **Proper delegation patterns** in large files (facade pattern in CanvasManager)
7. **Zero skipped tests**, zero weak assertions (toBeTruthy/toBeFalsy)
8. **No eval(), document.write(), or new Function()** usage (security)
9. **11 eslint-disable comments**, all legitimate (8 no-alert, 2 no-undef, 1 no-control-regex)
10. **Proper EventTracker** for memory-safe event listener management
11. **CSRF token protection** on all write endpoints with mustBePosted()
12. **Comprehensive undo/redo** with 50-step history
13. **Unsaved changes warning** before page close
14. **Auto-save/draft recovery** (DraftManager)
15. **Request abort handling** to prevent race conditions on rapid operations
16. **Proper async/await and Promise error handling** throughout most of the codebase
17. **No TODO/FIXME/HACK comments** in production code
18. **No console.log statements** in production code (only in build scripts)
19. **SQL injection protected** via parameterized queries in all database operations

### Key Weaknesses
1. **Pervasive documentation drift** ‚Äî README, wiki/Home.md, docs/ARCHITECTURE.md all show stale test counts and coverage
2. **20 JS god classes** (18 hand-written + 2 generated >1,000 lines) ‚Äî architectural complexity growing
3. **InlineTextEditor critical coverage gap** ‚Äî 77.65% lines, 71.17% branches in highest-complexity UI module
4. **Inconsistent database method return types** (\`null\` vs \`false\` vs \`-1\` for errors) in \`LayersDatabase.php\`
5. **Memory risk in undo/redo** ‚Äî \`HistoryManager.js\` falls back to \`JSON.parse(JSON.stringify())\` for deep cloning layer arrays
6. **71 innerHTML usages** ‚Äî safe patterns but requires periodic re-audit
7. **No visual regression testing** ‚Äî canvas rendering bugs could pass unit tests

### Issue Summary (Open)

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Documentation | 0 | **2** | 1 | 1 |
| Performance/Memory | 0 | 0 | 2 | 1 |
| Architecture | 0 | 0 | 3 | 2 |
| Code Quality | 0 | 0 | 1 | 2 |
| Testing | 0 | 0 | 2 | 3 |
| **Total** | **0** ‚úÖ | **2** | **9** | **9** |

---

## Ì≥ä Detailed Metrics

### Test Coverage (January 28, 2026)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statements | 95.53% | 90% | ‚úÖ Exceeds |
| Branches | 85.28% | 80% | ‚úÖ Exceeds |
| Functions | 93.97% | 85% | ‚úÖ Exceeds |
| Lines | 95.64% | 90% | ‚úÖ Exceeds |
| Test Count | 10,840 | - | ‚úÖ Excellent |
| Test Suites | 157 | - | ‚úÖ |
| Skipped Tests | 0 | 0 | ‚úÖ |

### Code Size Analysis

| Category | Files | Lines | Notes |
|----------|-------|-------|-------|
| JavaScript (Production) | 132 | ~93,406 | All resources/ext.layers* |
| JavaScript (Generated) | 2 | ~14,354 | ShapeLibraryData, EmojiLibraryIndex |
| JavaScript (Hand-written) | 130 | ~79,052 | Actual application code |
| PHP (Production) | 40 | ~14,543 | All source code |
| Tests (Jest) | 157 suites | ~50,300+ | Comprehensive |
| Documentation | 28+ files | - | Markdown docs in docs/ + wiki/ |
| i18n Messages | ~653 | - | All documented in qqq.json |

### Lowest Coverage Modules (Highest Risk)

| File | Lines | Functions | Branches | Risk Level |
|------|-------|-----------|----------|------------|
| InlineTextEditor.js | **77.65%** | **72.34%** | **71.17%** | Ì¥¥ HIGH |
| TextBoxRenderer.js | 87.79% | 90.90% | 88.01% | Ìø° MEDIUM |
| LayersEditor.js | 90.53% | 80.00% | 76.96% | Ìø° MEDIUM |
| Toolbar.js | 90.41% | 84.68% | 78.57% | Ìø° MEDIUM |
| LayerPanel.js | 90.53% | 79.52% | 80.32% | Ìø° MEDIUM |

---

## Ì¥¥ Critical Issues (0) ‚Äî ‚úÖ NONE

No critical issues found. The extension is production-ready.

---

## Ìø† High Severity Issues (2)

### HIGH-1: Documentation Metrics Pervasively Stale

**Severity:** High
**Category:** Documentation / Professionalism
**Locations:** README.md, wiki/Home.md, docs/ARCHITECTURE.md

**Problem:** Multiple documentation files contain outdated and conflicting metrics:

| Source | Claimed Test Count | Claimed Coverage | Actual Values |
|--------|-------------------|------------------|---------------|
| README.md badge | 10,667 | 95.9% | **10,840 / 95.53%** |
| README.md table | 10,667 | 95.86% | **10,840 / 95.53%** |
| wiki/Home.md badge | 10,667 | 95.9% | **10,840 / 95.53%** |
| wiki/Home.md table | 10,667 | 95.86% | **10,840 / 95.53%** |
| docs/ARCHITECTURE.md | 10,827 | 95.00%/84.73% | **10,840 / 95.53%** |

**Impact:** 
- New contributors receive conflicting information
- Project appears unmaintained or carelessly managed
- Undermines trust in other documentation claims

**Root Cause:** 
- Documentation update guide exists but is not being followed consistently
- No automated CI check for documentation drift
- Multiple manual update points that get out of sync

**Recommendation:**
1. **Immediate:** Update all 6 files with correct metrics (10,840 tests, 95.53% stmt, 85.28% branch)
2. **Short-term:** Add CI check that extracts coverage JSON and compares against README badges
3. **Long-term:** Automate badge generation from coverage-summary.json in CI

**Estimated Effort:** 1 hour for immediate fix; 4 hours for CI automation

---

### HIGH-2: InlineTextEditor Coverage Gap in Critical Path

**Severity:** High
**Category:** Testing / Reliability
**Location:** \`resources/ext.layers.editor/canvas/InlineTextEditor.js\`

**Problem:** InlineTextEditor.js has the **lowest coverage** of any production module despite being a **critical user workflow** component:

| Metric | Value | Suite Average | Gap |
|--------|-------|---------------|-----|
| Lines | 77.65% | 95.64% | **-18%** |
| Functions | 72.34% | 93.97% | **-21.6%** |
| Branches | 71.17% | 85.28% | **-14.1%** |

**Module Complexity:**
- 2,282 lines (largest hand-written controller)
- Rich text formatting support (v1.5.37+)
- ContentEditable for textbox/callout layers
- Floating toolbar with drag-and-drop

**Untested Scenarios (Probable):**
- Rich text selection preservation across toolbar interactions
- Edge cases in \`_savedSelection\` handling
- Toolbar drag-and-drop mechanics
- Various keyboard shortcuts and blur handling

**Impact:** Regression risk is **highest** where user interaction is most complex.

**Recommendation:**
1. Analyze uncovered lines with \`npm run test:js -- --coverage --collectCoverageFrom="**/InlineTextEditor.js"\`
2. Add tests for:
   - Start/commit/cancel flows for all layer types
   - Rich text formatting application
   - Toolbar repositioning and drag
   - Keyboard shortcuts (Enter, Escape, Ctrl+Enter)
3. Target: 85% line coverage minimum

**Estimated Effort:** 2-3 days

---

## Ìø° Medium Severity Issues (9)

### MED-1: 20 JavaScript God Classes (Trend: Growing)

**Severity:** Medium
**Category:** Architecture
**Files:** 20 hand-written JS files exceed 1,000 lines

**Current Count (January 28, 2026):**

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| InlineTextEditor.js | 2,282 | ‚ö†Ô∏è Minimal | Ì≥à Growing |
| LayerPanel.js | 2,175 | ‚úÖ 9 controllers | Stable |
| CanvasManager.js | 2,044 | ‚úÖ 10+ controllers | Stable |
| ViewerManager.js | 2,026 | ‚ö†Ô∏è Could improve | Stable |
| Toolbar.js | 1,891 | ‚úÖ 4 modules | Stable |
| LayersEditor.js | 1,850 | ‚úÖ 3 modules | Stable |
| APIManager.js | 1,523 | ‚ö†Ô∏è Could improve | Stable |
| SelectionManager.js | 1,431 | ‚úÖ 3 modules | Stable |
| PropertyBuilders.js | 1,414 | N/A (UI builders) | Stable |
| ArrowRenderer.js | 1,301 | N/A (math) | Stable |
| CalloutRenderer.js | 1,291 | N/A (rendering) | Stable |
| ToolManager.js | 1,224 | ‚úÖ 2 handlers | Stable |
| CanvasRenderer.js | 1,219 | ‚úÖ SelectionRenderer | Stable |
| GroupManager.js | 1,171 | N/A (group ops) | Stable |
| TextBoxRenderer.js | 1,117 | N/A (rendering) | Ì≥à NEW |
| TransformController.js | 1,110 | N/A (transforms) | Stable |
| ResizeCalculator.js | 1,105 | N/A (math) | Stable |
| ToolbarStyleControls.js | 1,070 | ‚úÖ Style controls | Stable |
| PropertiesForm.js | 1,006 | ‚úÖ PropertyBuilders | Ì≥à NEW |

**Alert:** Two files have recently crossed the 1,000-line threshold:
- \`TextBoxRenderer.js\` ‚Äî now 1,117 lines
- \`PropertiesForm.js\` ‚Äî now 1,006 lines

**Impact:** Increased cognitive load, harder testing, longer review cycles.

**Estimated Effort:** 2-3 days per major extraction

---

### MED-2: PHP God Classes (2 Files)

**Severity:** Medium
**Category:** Architecture
**Files:** \`LayersDatabase.php\` (1,242 lines), \`ServerSideLayerValidator.php\` (1,296 lines)

**Problem:** These classes handle too many responsibilities:
- **LayersDatabase:** CRUD, named sets, revisions, caching, queries, normalization
- **ServerSideLayerValidator:** All 16 layer types + all property types + gradient validation

**Recommendation:** See docs/GOD_CLASS_REFACTORING_PLAN.md

**Estimated Effort:** 2-3 days per class

---

### MED-3: Inconsistent Database Method Return Types

**Severity:** Medium
**Category:** Error Handling / API Consistency
**Location:** \`src/Database/LayersDatabase.php\`

**Problem:** Different database methods return inconsistent types on error/not-found:

| Method | Returns on Not Found | Returns on Error |
|--------|---------------------|------------------|
| \`getLayerSet()\` | \`false\` | \`false\` |
| \`getLayerSetByName()\` | \`null\` | \`null\` |
| \`getLatestLayerSet()\` | \`false\` | \`false\` |
| \`namedSetExists()\` | \`false\` | \`null\` |
| \`countNamedSets()\` | N/A | \`-1\` |
| \`countSetRevisions()\` | N/A | \`-1\` |
| \`saveLayerSet()\` | N/A | \`null\` |
| \`deleteNamedSet()\` | N/A | \`null\` |

**Impact:** Callers must handle multiple error patterns, increasing complexity and bug potential.

**Recommendation:** Standardize return types:
- \`null\` for "not found"
- Throw \`\RuntimeException\` for database errors

**Estimated Effort:** 1-2 days (breaking change, requires updating 15+ call sites)

---

### MED-4: HistoryManager JSON Cloning for Large Images

**Severity:** Medium
**Category:** Performance / Memory
**Location:** \`resources/ext.layers.editor/HistoryManager.js\`

**Problem:** When DeepClone module fails to use structuredClone, falls back to \`JSON.parse(JSON.stringify())\` which copies entire base64 image data (potentially 1MB+ per image per undo step). With 50-step history limit, this could consume 50MB+ per image layer.

**Current Mitigation:** Warning log added when fallback is used with image layers.

**Recommendation:**
1. Make DeepClone a hard dependency in extension.json module loading order
2. Consider reference-counting for immutable image data
3. Add maximum image layer size warning in UI

**Estimated Effort:** 4 hours for hard dependency; 2 days for reference counting

---

### MED-5: Missing E2E Tests for Shape Library Edge Cases

**Severity:** Medium
**Category:** Testing
**Location:** \`resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js\`

**Problem:** The ShapeLibraryPanel has good unit coverage but limited E2E coverage for edge cases. Feature has 1,310 shapes across 10 categories.

**Recommended Additional E2E Tests:**
- Keyboard navigation through shape grid
- Multiple shape insertions in sequence
- Shape library state persistence
- Error handling for failed SVG loads

**Estimated Effort:** 1-2 days

---

### MED-6: Coverage Gaps in UI Manager Modules

**Severity:** Medium
**Category:** Testing / Reliability
**Locations:** LayersEditor.js (76.96% branch), Toolbar.js (78.57% branch)

**Problem:** Branch coverage below 80% threshold in main editor and toolbar modules.

**Impact:** Complex conditional paths may have untested edge cases.

**Recommendation:** Target 80%+ branch coverage for these modules.

**Estimated Effort:** 1-2 days

---

### MED-7: Documentation Update Guide Not Followed

**Severity:** Medium
**Category:** Process / Professionalism
**Location:** \`docs/DOCUMENTATION_UPDATE_GUIDE.md\`

**Problem:** A comprehensive documentation update guide exists (11 Files Rule, 6 Test Count Files Rule) but it is clearly not being followed‚Äîmultiple files have stale metrics from previous versions.

**Evidence:**
- README.md shows 10,667 tests (actual: 10,840)
- wiki/Home.md shows 10,667 tests (actual: 10,840)
- docs/ARCHITECTURE.md shows conflicting values within same file

**Impact:** The guide's value is undermined if not enforced.

**Recommendation:**
1. Add pre-release CI check that verifies test count in README matches actual
2. Add version consistency check (already exists but apparently not run)
3. Consider consolidating metrics to a single source file that others import

**Estimated Effort:** 4 hours for CI check

---

### MED-8: No Visual Regression Testing

**Severity:** Medium
**Category:** Testing
**Problem:** No visual snapshot testing for canvas rendering.

**Impact:** A rendering bug in ShapeRenderer, TextBoxRenderer, etc. could pass all unit tests while producing visibly incorrect output.

**Recommendation:** Add jest-image-snapshot or Percy for key rendering scenarios.

**Estimated Effort:** 1-2 sprints

---

### MED-9: ARCHITECTURE.md Contains Internal Contradictions

**Severity:** Medium
**Category:** Documentation
**Location:** \`docs/ARCHITECTURE.md\`

**Problem:** The file contains **multiple conflicting metrics** within different sections:

| Section | Test Count | Coverage |
|---------|------------|----------|
| Codebase Statistics table | 10,827 | 95.00% stmt, 84.73% branch |
| God Classes note | ‚Äî | 94.86% |
| Both are wrong | ‚Äî | Actual: 95.53%/85.28% |

**Impact:** Readers don't know which number to trust.

**Recommendation:** Single pass through ARCHITECTURE.md to unify all metrics to verified values.

**Estimated Effort:** 30 minutes

---

## Ìø¢ Low Severity Issues (9)

### LOW-1: Native Alerts as Fallbacks ‚Äî BY DESIGN ‚úÖ
**Status:** Verified as correct design pattern
**Files:** UIManager.js, PresetDropdown.js, LayerSetManager.js, ImportExportManager.js, RevisionManager.js
**Finding:** All 8 \`eslint-disable no-alert\` occurrences are defensive fallbacks when DialogManager is unavailable.

### LOW-2: Event Listener Cleanup Inconsistency
**Location:** PropertiesForm.js, SlidePropertiesPanel.js
**Recommendation:** Use EventTracker pattern consistently for new code.

### LOW-3: Magic Numbers in Some Calculations
**Examples:** \`100\` backlink limit, timeout values, canvas padding.
**Recommendation:** Extract to named constants in LayersConstants.js or PHP config.

### LOW-4: innerHTML Usage Count (71)
**Location:** Multiple UI files
**Assessment:** 71 usages, mostly safe patterns (clearing containers, static SVG).
**Recommendation:** Requires periodic re-audit. Current count acceptable but trending up from 63.

### LOW-5: setTimeout/setInterval Tracking Inconsistent
**Count:** ~58 uses. Most are tracked, but some inconsistency exists.

### LOW-6: Missing aria-live for Some Dynamic Updates
**Location:** Various UI components
**Status:** LayerPanel now has announceToScreenReader() but other components may benefit.

### LOW-7: Missing TypeScript for Complex Modules
**Files:** StateManager, APIManager, GroupManager.
**Recommendation:** Consider TypeScript migration for core modules in v2.0.

### LOW-8: Deprecated Code Markers (7 total)
**Status:** All have removal dates (v2.0).
**Examples:** TransformationEngine.js, ToolbarStyleControls.js, ModuleRegistry.js

### LOW-9: Noisy Console Output in Jest Runs
**Problem:** Jest runs emit some console output that clutters results.
**Recommendation:** Gate performance logging behind an env flag.

---

## Ìø¢ Resolved Issues (From Previous Reviews)

### ‚úÖ ViewerManager.test.js handleSlideEditClick test ‚Äî FIXED (Jan 27, 2026)
### ‚úÖ Slide \`canvas=WxH\` Parameter Ignored ‚Äî FIXED (Jan 25, 2026)
### ‚úÖ Slide \`layerset=\` Parameter Ignored ‚Äî FIXED (Jan 25, 2026)
### ‚úÖ Version Number Inconsistencies ‚Äî FIXED (Jan 26, 2026)
### ‚úÖ window.onbeforeunload Direct Assignment ‚Äî FIXED (Jan 28, 2026)

---

## Ìø¢ Security Verification

### CSRF Token Protection ‚úÖ
- Tested and verified on all write APIs: \`ApiLayersSave\`, \`ApiLayersDelete\`, \`ApiLayersRename\`, \`ApiSlidesSave\`

### Rate Limiting ‚úÖ
- Verified usage of \`pingLimiter\` in PHP backend

### Input Validation ‚úÖ
- \`ServerSideLayerValidator\` handles 40+ properties
- \`ColorValidator\` protects against ReDoS (MAX_COLOR_LENGTH = 50)

### Code Quality Verification ‚úÖ
- No \`eval()\`, \`document.write()\`, \`new Function()\` in production
- No TODOs/FIXMEs in production code
- No \`console.log\` in production (only in scripts/)
- 11 \`eslint-disable\` comments, all legitimate

---

## Ì≥ä Rating Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Security | 9.5/10 | 25% | Strong CSRF, validation, sanitization |
| Test Coverage | 8.8/10 | 20% | 95.53% statements, but InlineTextEditor gap |
| Functionality | 9.0/10 | 20% | 15 tools, Slide Mode, Shape Library, Emoji |
| Architecture | 6.0/10 | 15% | 20 JS + 2 PHP god classes; 2 new this cycle |
| Code Quality | 7.5/10 | 10% | Inconsistent DB returns, increasing innerHTML |
| Performance | 7.8/10 | 5% | Undo image cloning risk remains |
| Documentation | 5.5/10 | 5% | Pervasive stale metrics, internal contradictions |

**Weighted Total: 8.09/10 ‚Üí Overall: 8.1/10**

---

## Honest Assessment: What Keeps This From Being "World-Class"

### Current Status: **Production-Ready (8.1/10)**

The extension is professional, secure, and well-tested. However, several issues prevent world-class status:

### What Would Make It World-Class (9.0+/10)

1. **Fix Documentation Drift Now:** Every major doc file has stale metrics. This is embarrassing for an otherwise excellent project.

2. **Close the InlineTextEditor Gap:** The most complex user-facing module has the worst coverage. This is backwards.

3. **Enforce Documentation Updates:** The update guide exists but is not followed. Add CI enforcement.

4. **Stop God Class Growth:** Two files crossed the 1,000-line threshold this cycle. Proactively extract before they grow further.

5. **Standardize PHP API:** The \`null\` vs \`false\` vs \`-1\` inconsistency is a maintenance landmine.

6. **Add Visual Regression Testing:** Canvas rendering bugs could ship undetected.

7. **Type Safety:** Adopt TypeScript for core state management modules.

### Bottom Line

This is a **well-built extension** with **excellent security** and **comprehensive testing**. The main issues are organizational (documentation) and architectural (god classes). These do not affect users but do affect maintainability and professional perception.

The project would benefit from a documentation freeze‚Äîno new features until all docs reflect reality.

---

*Review performed on \`main\` branch, January 28, 2026.*
