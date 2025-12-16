# Layers MediaWiki Extension - Critical Code Review

**Review Date:** January 14, 2025
**Reviewer:** GitHub Copilot (Claude Opus 4.5)
**Version:** 0.8.7

## Executive Summary

The "Layers" extension provides non-destructive image annotation capabilities for MediaWiki. This is a **comprehensive, honest assessment** of the codebase quality, architecture, and technical debt.

### Overall Assessment: 7/10

The extension is **functional and feature-complete** with good test coverage (89%), solid security, and a **fully modernized JavaScript codebase**. The ES6 class migration is **100% complete**.

**Honest evaluation:**
- The core functionality works well
- PHP backend is professionally implemented
- Test coverage is genuinely good (89.26%)
- **However:** 7 god classes remain (>1,000 lines each), and there's a significant event listener imbalance (94 add vs 33 remove)

**For the detailed, prioritized improvement plan, see [improvement_plan.md](./improvement_plan.md)**

---

## The Good ✅

| Area | Score | Notes |
|------|-------|-------|
| **Test Coverage** | 8/10 | 89.26% statement coverage, 4,617 tests all passing |
| **PHP Backend Security** | 9/10 | CSRF protection, rate limiting, parameterized queries, strict validation |
| **PHP Architecture** | 8/10 | Clean DI, service wiring, largest PHP file 810 lines |
| **Documentation** | 7/10 | Good copilot-instructions.md, some docs need updates |
| **Code Splitting** | 7/10 | Viewer (682 lines) vs Editor (32,440 lines) |
| **ES6 Migration** | 10/10 | 66 ES6 classes, 0 prototype methods remain (100% complete) |
| **Accessibility** | 6/10 | ARIA live regions exist, but incomplete keyboard support |

### What's Actually Working

1. **The extension works** - users can annotate images, save, load, view
2. **Security is solid** - PHP backend demonstrates professional practices
3. **Tests catch regressions** - 4,617 tests all passing
4. **Viewer is lightweight** - reading articles loads only 682 lines (viewer) + 3,886 lines (shared)
5. **Named layer sets** - Multiple annotation sets per image with version history
6. **ES6 100% complete** - All 66 classes use ES6 syntax, 0 prototype patterns remain

---

## The Bad ⚠️

| Area | Score | Notes |
|------|-------|-------|
| **God Classes** | 4/10 | 7 files over 1,000 lines (largest 1,895 lines) |
| **Event Listener Balance** | 4/10 | 94 addEventListener vs 33 removeEventListener - potential memory leaks |
| **Branch Coverage** | 6/10 | 77.06% branches - edge cases may be untested |

---

## Verified Metrics (January 14, 2025)

These metrics were collected directly from v0.8.7 source code.

### JavaScript Codebase

| Metric | Actual Value | Target | Status |
|--------|--------------|--------|--------|
| Total JS files | **75** | - | - |
| Total JS lines | **38,179** | - | - |
| Viewer module | **682 lines** | - | ✅ Lightweight |
| Shared module | **3,886 lines** | - | ✅ Reused code |
| Editor module | **32,440 lines** | - | Expected for full editor |
| Files > 1,000 lines | **7** | 0 | ⚠️ God classes |
| ES6 classes | **66** | 60+ | ✅ 100% Complete |
| Prototype method definitions | **0** | 0 | ✅ Eliminated |
| addEventListener calls | **94** | - | - |
| removeEventListener calls | **33** | 94 | ⚠️ Imbalance (potential leaks) |
| ESLint errors | **0** | 0 | ✅ Clean |
| Stylelint errors | **0** | 0 | ✅ Clean |

### Test Coverage

| Category | Value | Target | Status |
|----------|-------|--------|--------|
| Jest tests passing | **4,617** | - | ✅ All passing |
| Jest tests failing | **0** | 0 | ✅ All fixed |
| Jest test suites | **92** | - | ✅ Good |
| Statement coverage | **89.26%** | 80% | ✅ Exceeded |
| Branch coverage | **77.06%** | 65% | ✅ Exceeded |
| Line coverage | **89.35%** | 80% | ✅ Exceeded |
| Function coverage | **87.45%** | 80% | ✅ Exceeded |

### PHP Backend

| Metric | Value | Status |
|--------|-------|--------|
| Total PHP files | **31** | - |
| Total PHP lines | **9,128** | - |
| Largest PHP file | **810 lines** (LayersDatabase.php) | ✅ Acceptable |
| PHPUnit test files | **17** | ✅ Good coverage |
| SQL injection risks | **0** | ✅ Parameterized |

---

## Critical Issues

### 1. ⚠️ God Classes (7 Files Over 1,000 Lines)

| File | Lines | Concern |
|------|-------|---------|
| CanvasManager.js | **1,895** | Orchestrates all canvas operations - needs controller extraction |
| LayerPanel.js | **1,430** | Complex UI component - mix of rendering and logic |
| APIManager.js | **1,311** | Handles API + state - could split state management |
| LayersEditor.js | **1,284** | Main entry point - multiple responsibilities |
| SelectionManager.js | **1,266** | Core selection logic - complex but cohesive |
| ToolManager.js | **1,155** | Tool state management - could extract text editor |
| ShapeRenderer.js | **1,049** | Shared rendering logic - appropriately sized for scope |

**Recommendation:** Prioritize extracting controllers from CanvasManager and LayerPanel first, as they have the highest line counts and most mixed responsibilities.

### 2. ⚠️ Event Listener Imbalance (94 vs 33)

Analysis shows **94 addEventListener calls but only 33 removeEventListener calls**. This is a significant imbalance that could indicate memory leaks.

**Architecture context:**
- EventTracker pattern exists but may not be consistently applied
- Some listeners may be on elements that get removed from DOM (GC handles cleanup)
- Some are intentionally permanent (error handlers, beforeunload)

**Recommendation:** Audit all addEventListener calls and ensure cleanup on component destruction. Consider expanding EventTracker usage.

### 3. ⚠️ Branch Coverage Could Improve

At 77.06% branch coverage, some edge cases and error paths may not be tested. While statement coverage is good at 89.26%, improving branch coverage would catch more subtle bugs.

---

## PHP Backend Assessment

The PHP backend is **well-architected** and demonstrates professional practices:

### Security Excellence ✅

| Measure | Status |
|---------|--------|
| CSRF protection | ✅ Required on all writes |
| Rate limiting | ✅ Via MediaWiki pingLimiter |
| Property whitelist | ✅ 45+ fields, unknown dropped |
| SQL injection | ✅ All queries parameterized |
| XSS prevention | ✅ Text sanitization |
| Color injection | ✅ Strict validation |

### PHP Code Quality

| File | Lines | Quality Notes |
|------|-------|---------------|
| LayersDatabase.php | 810 | Clean DI, retry logic with exponential backoff |
| WikitextHooks.php | 779 | Complex but well-organized |
| ThumbnailRenderer.php | 602 | ImageMagick logic |
| ServerSideLayerValidator.php | 600 | Comprehensive whitelist approach |
| ApiLayersSave.php | 480 | Excellent security documentation |
| ImageLinkProcessor.php | 450 | Wikitext parsing |
| Hooks.php | 434 | Hook registration |
| ApiLayersInfo.php | 418 | Read-only API |

### PHP Test Coverage

**17 PHPUnit test files covering:**
- API endpoints (ApiLayersInfo, ApiLayersSave)
- Database layer (LayersDatabase)
- Hooks and processors
- Security (RateLimiter)
- Validation (ColorValidator, ServerSideLayerValidator)

---

## Test Suite Assessment

### Strengths ✅

- **4,617 tests passing** - substantial coverage
- **89.26% statement coverage** - good quality
- **Well-organized** - dedicated directories for each component
- **Integration tests present** - in tests/jest/integration/
- **PHPUnit coverage** - 17 test files for backend

### Areas for Improvement ⚠️

| Issue | Severity |
|-------|----------|
| No E2E test CI pipeline | ⚠️ Playwright tests exist but not in CI |
| Branch coverage at 77% | ⚠️ Some edge cases may be untested |
| God class testing | ⚠️ Large files harder to test thoroughly |

---

## Technical Debt Summary

| Debt Type | Severity | Effort to Fix | Status |
|-----------|----------|---------------|--------|
| God class splitting (7 files) | ⚠️ High | 6-8 weeks | Not started |
| Event listener audit | ⚠️ Medium | 1-2 weeks | Not started |
| Branch coverage improvement | ⚠️ Low | 2-3 weeks | 77% achieved |
| ES6 migration | ✅ Complete | - | 100% done |

**Total estimated effort: 9-13 weeks for remaining technical debt**

---

## Recommendations

### Immediate (This Week)

1. **Audit event listeners** - Document the 94 addEventListener calls and identify which need cleanup
2. **Review god classes** - Identify extraction candidates in CanvasManager and LayerPanel
3. **Set up E2E tests in CI** - Playwright tests exist but aren't automated

### Short-term (1-2 Months)

1. **Extract controllers from CanvasManager** (1,895 lines):
   - Extract ZoomController, PanController from existing code
   - Consider TransformController for resize/rotate operations
2. **Split LayerPanel** (1,430 lines):
   - Extract layer item rendering to separate component
   - Separate drag-drop logic from display logic
3. **Improve branch coverage** - Target 85% from current 77%

### Medium-term (3-6 Months)

1. **Continue god class splitting**:
   - APIManager (1,311 lines) - separate state from API calls
   - SelectionManager (1,266 lines) - extract multi-selection logic
   - ToolManager (1,155 lines) - extract text editing tools
2. **TypeScript definitions** - Add `.d.ts` files for API contracts
3. **EventTracker expansion** - Apply to all components with listeners

### Long-term (6+ Months)

1. **TypeScript migration** - Feasible with ES6 complete
2. **ES modules** - Move away from globals entirely
3. **Unified validation** - Generate client validators from server rules

---

## Verification Commands

```bash
# Test coverage (expect ~89% statements, ~77% branches)
npm run test:js -- --coverage

# God classes (>1000 lines) - expect 7 files
find resources -name "*.js" -type f ! -path "*/dist/*" -exec wc -l {} \; | awk '$1 >= 1000 {print}' | sort -rn

# ES6 class count (expect 66)
grep -rE "^\s*class\s+[A-Z]" resources --include="*.js" | wc -l

# Prototype method count (expect 0)
grep -rE "\.prototype\.[a-zA-Z]+ = function" resources --include="*.js" | wc -l

# Event listener balance (expect ~94 add, ~33 remove)
echo "Add: $(grep -r "addEventListener" resources --include="*.js" | wc -l)"
echo "Remove: $(grep -r "removeEventListener" resources --include="*.js" | wc -l)"

# Module sizes
echo "Viewer: $(cat resources/ext.layers/*.js | wc -l) lines"
echo "Shared: $(cat resources/ext.layers.shared/*.js | wc -l) lines"
echo "Editor: $(find resources/ext.layers.editor -name '*.js' -exec cat {} + | wc -l) lines"

# Total JS lines (expect ~38,179)
find resources -name "*.js" -type f ! -path "*/dist/*" -exec cat {} + | wc -l

# PHP files and lines
find src -name "*.php" | wc -l
find src -name "*.php" -exec cat {} + | wc -l
```

---

## Conclusion

The Layers extension is a **functional product with good test coverage** and **complete ES6 modernization**. The 89% test coverage provides a safety net for future refactoring work.

**Key achievements:**
- ES6 migration 100% complete (66 classes, 0 prototype methods)
- 4,617 tests all passing
- 89.26% statement coverage
- Lightweight viewer module (682 lines)
- Professional PHP backend with good security practices

**Remaining challenges:**
- 7 god classes over 1,000 lines (totaling ~9,390 lines)
- Event listener cleanup needed (94 add vs 33 remove)
- Branch coverage at 77% could be improved

**Priority recommendation:** Focus on extracting controllers from the largest god classes (CanvasManager, LayerPanel) while maintaining test coverage. The existing test suite enables safe refactoring.

---

*Review performed by GitHub Copilot (Claude Opus 4.5) on January 14, 2025, based on verified v0.8.7 metrics*
