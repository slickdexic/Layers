# Layers MediaWiki Extension - Codebase Review

**Review Date:** December 20, 2025  
**Version:** 1.1.7  
**Reviewer:** GitHub Copilot (Claude Opus 4.5)

---

## Executive Summary

The Layers extension provides non-destructive image annotation capabilities for MediaWiki. This document provides an **honest, data-driven assessment** of the codebase quality, architecture, and technical health.

### Overall Assessment: 7.5/10 ⚠️ Solid Extension with Manageable Technical Debt

The extension is **functional and deployed** with professional security, excellent test coverage (~91%), and a fully modernized ES6 codebase. All 5,609 tests pass. Recent improvements include Smart Guides, alignment tools, style presets, and comprehensive test coverage.

**Key Strengths:**

- ✅ **5,609 tests passing** with ~91% statement coverage
- ✅ **90 JS files**, 81 ES6 classes, 0 legacy prototype patterns
- ✅ Professional PHP backend security (CSRF, rate limiting, validation)
- ✅ 14 working drawing tools with named layer sets
- ✅ Smart Guides for object-to-object snapping
- ✅ Style presets system with built-in and user-saved presets
- ✅ Alignment and distribution tools for multi-selection
- ✅ Accessibility features (skip links, ARIA, keyboard navigation)
- ✅ CI checks for god class and total codebase growth

**Critical Concerns:**

- ⚠️ **7 files >1,000 lines** (all have delegation patterns but remain large)
- ⚠️ **Total codebase: ~45,924 lines** - CI warns at 45K, blocks at 50K
- ❌ No mobile/touch support
- ⚠️ Console.log statements in production code (PresetStorage, PresetManager)
- ⚠️ Memory leak potential in CanvasManager.destroy()
- ⚠️ Dead code and deprecated methods still present

---

## Verified Metrics (December 20, 2025)

All metrics collected directly from the codebase.

### JavaScript Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total JS files | **90** | - | ✅ |
| Total JS lines | **~45,924** | <45,000 | ⚠️ Over warning |
| ES6 classes | **81** | 70+ | ✅ |
| Files >1,000 lines | **7** | 0 | ⚠️ All have delegation |
| ESLint errors | **0** | 0 | ✅ |
| Stylelint errors | **0** | 0 | ✅ |
| Jest tests | **5,609** | - | ✅ All passing |

### Files Over 1,000 Lines (God Classes)

| File | Lines | Has Delegation? | Assessment |
|------|-------|-----------------|------------|
| CanvasManager.js | **1,864** | ✅ Yes (10+ controllers) | Facade - acceptable |
| LayerPanel.js | **1,837** | ✅ Yes (7 controllers) | Facade - acceptable |
| Toolbar.js | **1,539** | ✅ Yes (4 modules) | Growing concern |
| LayersEditor.js | **1,324** | ✅ Yes (3 modules) | Acceptable |
| ToolManager.js | **1,275** | ✅ Yes (2 handlers) | Acceptable |
| SelectionManager.js | **1,194** | ✅ Yes (3 modules) | Acceptable |
| APIManager.js | **1,161** | ✅ Yes (APIErrorHandler) | Acceptable |

**Total in god classes: ~10,194 lines** (22% of JS codebase)

### Files Approaching God Class Status (800+ lines)

| File | Lines | Risk | Notes |
|------|-------|------|-------|
| LayersValidator.js | 958 | ⚠️ HIGH | Consider splitting by validation category |
| ToolbarStyleControls.js | 947 | ⚠️ HIGH | Recently reduced via PresetStyleManager |
| UIManager.js | 917 | ⚠️ MEDIUM | Dialog management could be extracted |
| CanvasRenderer.js | 859 | MEDIUM | Stable with SelectionRenderer extracted |
| ShapeRenderer.js | 857 | MEDIUM | PolygonStarRenderer already extracted |
| PropertiesForm.js | 832 | ⚠️ MEDIUM | Field renderers could be extracted |
| ResizeCalculator.js | 822 | LOW | Specialized calculator, acceptable |
| TransformController.js | 779 | LOW | Stable |

### Test Coverage Summary

| Metric | Value | Status |
|--------|-------|--------|
| Test suites | **111** | ✅ All passing |
| Tests passing | **5,609** | ✅ All passing |
| Tests failing | **0** | ✅ |
| Statement coverage | **~91%** | ✅ Excellent |
| Branch coverage | **~78%** | ✅ Good |

### Low Coverage Files (Needing Attention)

| File | Statement | Branch | Issue |
|------|-----------|--------|-------|
| AlignmentController.js | 74.19% | 62.39% | New feature, needs more tests |
| Toolbar.js | 81.39% | 62.78% | Complex UI logic |
| ToolbarStyleControls.js | 82.36% | 52.65% | Many UI branches untested |

### PHP Backend

| Metric | Value | Status |
|--------|-------|--------|
| Total PHP files | 31 | Good |
| Total PHP lines | ~9,521 | Reasonable |
| Largest PHP file | 995 lines | Borderline (LayersDatabase.php) |
| PHPUnit test files | 17 | ✅ Good coverage |
| SQL injection risks | 0 | ✅ Parameterized queries |
| CSRF protection | Complete | ✅ All write endpoints |
| Rate limiting | Active | ✅ Via pingLimiter |

---

## Critical Issues Identified

### Issue #1: Console.log Statements in Production Code

**Severity: MEDIUM**

Found 3 console.log/warn/error statements in production code that should use mw.log:

| File | Line | Code |
|------|------|------|
| PresetStorage.js | 390 | console.warn in fallback |
| PresetStorage.js | 404 | console.error in fallback |
| PresetManager.js | 599 | console.error in fallback |

**Recommendation:** Remove console fallbacks or wrap in production/debug checks.

### Issue #2: Memory Leak in CanvasManager.destroy()

**Severity: HIGH**

The CanvasManager.destroy() method is missing cleanup for several controllers:
- smartGuidesController
- alignmentController
- coordinateHelper
- Potentially others added after destroy() was written

**Impact:** Memory leaks when editor is closed and reopened.

**Recommendation:** Audit all controller references and add to destroy() cleanup.

### Issue #3: Dead Code and Deprecated Methods

**Severity: LOW-MEDIUM**

| File | Location | Description |
|------|----------|-------------|
| CanvasManager.js | Lines 1319-1324 | updateBackgroundLayerVisibility() deprecated |
| CanvasManager.js | Lines 521-557 | loadImageManually() deprecated fallback |
| LayerPanel.js | Line 391 | Empty no-op updateForTool() |
| ToolManager.js | Lines 367-376 | Commented-out code kept "for reference" |

### Issue #4: Missing Null Checks

**Severity: MEDIUM**

| File | Line | Issue |
|------|------|-------|
| CanvasManager.js | 408-411 | Missing null check for toolbar.styleControls |
| LayerPanel.js | 1355 | No null check for this.editor |
| ToolManager.js | 957 | No null check for canvas |

### Issue #5: Codebase Size Over Warning Threshold

**Severity: MEDIUM**

- Current: 45,924 lines
- Warning threshold: 45,000 lines
- Block threshold: 50,000 lines

**Recommendation:** Stricter code review for size; require extraction with new features.

### Issue #6: God Class CI Baseline Mismatch

**Severity: LOW**

The god-class-check.yml has outdated baselines. Example mismatches:

| File | CI Baseline | Actual |
|------|-------------|--------|
| Toolbar.js | 1298 | 1539 |
| ShapeRenderer.js | 1191 | 857 |

---

## Security Assessment ✅

The PHP backend maintains professional security practices:

| Security Measure | Status |
|-----------------|--------|
| CSRF Protection | ✅ Token required on all writes |
| Rate Limiting | ✅ MediaWiki pingLimiter |
| Property Whitelist | ✅ 50+ fields allowed |
| SQL Injection | ✅ Parameterized queries |
| XSS Prevention | ✅ Text sanitization |
| Size Limits | ✅ Configurable max bytes/layers |

**Verdict:** Production-grade security.

---

## UX Feature Completeness

### Drawing Tools (14 Available)

All 14 tools working: Pointer, Zoom, Text, Text Box, Pen, Rectangle, Circle, Ellipse, Polygon, Star, Arrow, Line, Blur, Marquee

### Advanced Features ✅

- Smart Guides (edge + center snapping)
- Alignment Tools (6 align + 2 distribute)
- Key Object Alignment
- Style Presets (built-in + user-saved)
- Named Layer Sets
- Version History (50 revisions per set)
- Import/Export Image

### Missing Features

| Feature | Priority |
|---------|----------|
| Mobile/Touch Support | HIGH |
| Layer Grouping | MEDIUM |
| Gradient Fills | LOW |

---

## Recommendations

### Immediate (This Week)

1. Fix memory leak in CanvasManager.destroy()
2. Update CI baselines in god-class-check.yml
3. Remove console.log fallbacks
4. Add missing null checks

### Short-Term (1-4 Weeks)

1. Monitor code growth (currently at 45.9K)
2. Improve AlignmentController coverage to 90%+
3. Remove dead/deprecated code
4. Add constants for hardcoded values

### Medium-Term (1-3 Months)

1. Split LayersValidator by category
2. Split PropertiesForm field renderers
3. Performance benchmarks with 100+ layers

### Long-Term (3-6 Months)

1. Mobile/touch support
2. TypeScript migration (start with shared)
3. Plugin architecture for custom tools

---

## Conclusion

The Layers extension is a **functional, production-ready product** with excellent test coverage and professional security. The architecture is sound with proper delegation patterns.

**Main concerns:**
1. Memory leak in destroy() needs immediate attention
2. Codebase slightly over warning threshold
3. Production code quality issues (console.log, dead code)

**The foundation is solid.** With targeted fixes, this extension is well-positioned for continued growth.

---

*Review performed by GitHub Copilot (Claude Opus 4.5)*  
*Last updated: December 20, 2025*
