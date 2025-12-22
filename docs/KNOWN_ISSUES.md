# Known Issues

**Last Updated:** December 21, 2025  
**Version:** 1.1.10

This document lists known functionality issues and their current status.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Blocking) | 0 | ✅ All resolved |
| P1 (Security/Stability) | 0 | ✅ All resolved |
| P2 (Code Quality) | 7 | ⏳ In progress |
| Feature Gaps | 6 | ⏳ Planned |

---

## All P0 and P1 Issues Resolved ✅

As of version 1.1.10, all critical (P0) and high-priority (P1) issues have been fixed. The extension is production-ready.

---

## Recently Fixed Issues

### v1.1.10 (December 21, 2025)

| Issue | Severity | Resolution |
|-------|----------|------------|
| **SVG XSS Security Risk** | HIGH | Removed `image/svg+xml` from allowed MIME types |
| **Foreign Repository File Lookup** | MEDIUM | Changed to `getRepoGroup()->findFile()` in all APIs |
| **Jest Coverage Configuration** | LOW | Updated `collectCoverageFrom` patterns |
| **E2E Tests Failing** | MEDIUM | Fixed password length for MediaWiki 1.44 |

### v1.1.9 (December 21, 2025)

| Issue | Severity | Resolution |
|-------|----------|------------|
| **Background Visibility Bug** | HIGH | Fixed PHP→JS boolean serialization handling |
| **Missing AutoloadClasses** | MEDIUM | Added ApiLayersRename to extension.json |
| **Console.error in Production** | LOW | Replaced with mw.log.error |
| **Memory Leak - Animation Frame** | MEDIUM | Added cancelAnimationFrame in destroy() |
| **Missing Setname Sanitization** | MEDIUM | Added to Delete and Rename APIs |
| **Duplicated clampOpacity()** | LOW | Created shared MathUtils.js |

---

## Active Issues

### ⚠️ No Mobile/Touch Support

**Status:** Not Implemented  
**Severity:** HIGH for mobile users, MEDIUM for desktop-only deployments  
**Effort:** 4-6 weeks

The editor does not handle touch events. Users on tablets and phones cannot:

- Draw or select layers with touch
- Use pinch-to-zoom or two-finger pan
- Access mobile-optimized toolbar
- Use touch-friendly selection handles

**Workaround:** Use desktop browser or browser with desktop mode.

**Tracking:** [improvement_plan.md](../improvement_plan.md) P3.1

### ⚠️ Files With Zero Test Coverage

**Status:** P2 - Needs attention  
**Severity:** MEDIUM  
**Effort:** 4-8 hours

Five files have 0% test coverage and are at risk for undetected regressions:

| File | Lines | Risk |
|------|-------|------|
| ColorControlFactory.js | 241 | HIGH |
| LayerDragDrop.js | 246 | HIGH |
| LayerListRenderer.js | 433 | HIGH |
| MathUtils.js | 78 | MEDIUM |
| PresetDropdown.js | 526 | HIGH |

**Tracking:** [improvement_plan.md](../improvement_plan.md) P2.1

### ⚠️ SVG Images Not Supported

**Status:** By Design (Security)  
**Severity:** LOW  
**Resolution:** Not planned

SVG images are intentionally excluded from image imports because they can contain embedded JavaScript, creating XSS vulnerabilities.

**Workaround:** Convert SVG to PNG before importing.

### ⚠️ Codebase Size Warning

**Status:** Monitoring  
**Severity:** MEDIUM for maintainability

- **Current:** 46,063 lines
- **Warning threshold:** 45,000 lines (EXCEEDED)
- **Block threshold:** 50,000 lines

**Action:** Continue extracting functionality from god classes. Priority targets are LayersValidator.js and ToolbarStyleControls.js.

**Tracking:** [improvement_plan.md](../improvement_plan.md) P2.7

---

## Architecture Concerns

### ⚠️ God Classes (Technical Debt)

**Status:** Monitored with CI enforcement  
**Severity:** MEDIUM for maintainability

The codebase has **7 files exceeding 1,000 lines**. All have delegation patterns:

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,875 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,838 | ✅ 7 controllers | Stable |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing |
| LayersEditor.js | 1,324 | ✅ 3 modules | Stable |
| ToolManager.js | 1,264 | ✅ 2 handlers | Stable |
| SelectionManager.js | 1,194 | ✅ 3 modules | Stable |
| APIManager.js | 1,174 | ✅ APIErrorHandler | Stable |

**Total in god classes: ~10,208 lines** (22% of JS codebase)

**CI Protection:** `npm run check:godclass` blocks PRs that grow files beyond limits.

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

### ⚠️ ESLint Disable Comments

**Status:** P2 - Needs cleanup  
**Count:** ~20 instances

ESLint rules are being disabled in approximately 20 locations. Common patterns:
- `no-undef` - Accessing global variables
- `no-unused-vars` - Unused function parameters
- `no-alert` - Using native alerts

**Action:** Refactor code to eliminate need for disabling rules.

### ⚠️ setTimeout Without Cleanup

**Status:** P2 - Needs fix  
**Count:** ~15 instances

Several `setTimeout` calls are made without storing the timer ID for cleanup, which could cause memory leaks if the editor is destroyed while timers are pending.

**Files affected:**
- EditorBootstrap.js
- ErrorHandler.js
- UIManager.js
- ImageLoader.js

**Action:** Store timer IDs and clear in destroy() methods.

---

## Feature Gaps

### Not Implemented

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Mobile/Touch Support | HIGH | 4-6 weeks | Critical for mobile users |
| Layer Grouping | MEDIUM | 2-3 weeks | Group layers for bulk operations |
| Gradient Fills | LOW | 1 week | Linear and radial gradients |
| Custom Fonts | LOW | 2 weeks | Upload and use custom fonts |
| SVG Export | LOW | 1 week | Export annotations as SVG |
| Rulers/Guides | LOW | 2 weeks | Persistent guide lines |

---

## Browser Compatibility

### Tested Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✅ Fully supported |
| Firefox | 120+ | ✅ Fully supported |
| Safari | 17+ | ✅ Fully supported |
| Edge | 120+ | ✅ Fully supported |

### Known Browser Issues

| Browser | Issue | Workaround |
|---------|-------|------------|
| Safari | Color picker may not show eyedropper | Use hex input instead |
| Firefox | Slow with >50 layers | Reduce layer count |

---

## Performance Notes

### Recommended Limits

| Resource | Recommended | Maximum | Notes |
|----------|-------------|---------|-------|
| Image size | < 2048px | 4096px | Larger images may be slow |
| Layer count | < 50 | 100 | Performance degrades with many layers |
| Layer set size | < 1MB | 2MB | Configurable via $wgLayersMaxBytes |
| Imported image size | < 500KB | 1MB | Configurable via $wgLayersMaxImageBytes |

### Performance Tips

1. **Reduce layer count** - Merge similar layers when possible
2. **Optimize images** - Use appropriately sized images
3. **Use named sets** - Split complex annotations into multiple sets
4. **Clear history** - Saving clears undo history, freeing memory

---

## Reporting Issues

If you encounter issues:

1. Check this document first
2. Search existing [GitHub issues](https://github.com/slickdexic/Layers/issues)
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and MediaWiki version
   - Console errors (F12 → Console tab)
   - Screenshots if applicable

---

*Document updated: December 21, 2025*
