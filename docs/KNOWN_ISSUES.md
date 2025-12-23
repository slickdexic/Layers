# Known Issues

**Last Updated:** December 24, 2025  
**Version:** 1.1.12

This document lists known functionality issues and their current status.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Blocking) | 0 | ✅ All resolved |
| P1 (Security/Stability) | 0 | ✅ All resolved |
| P2 (Code Quality) | 8 | ⏳ In progress |
| Feature Gaps | 6 | ⏳ Planned |

---

## ✅ P0 Issues Resolved (December 24, 2025)

### P0.1 LayersLightbox.js Test Coverage ✅ FIXED

**Status:** RESOLVED  
**Date Fixed:** December 24, 2025  
**File:** `resources/ext.layers/LayersLightbox.js`

The lightbox viewer component now has **86.6% test coverage** with 70 comprehensive tests covering:
- Constructor initialization
- Modal open/close behavior  
- Layer rendering in fullscreen
- Keyboard accessibility (Escape to close)
- Error handling
- Navigation between layer sets
- Background image loading

**Bug Fixed:** Added null guards to `showError()` and `renderViewer()` methods to prevent crashes when UI elements are not yet initialized.

### P0.2 Native alert() Calls Replaced ✅ FIXED

**Status:** RESOLVED  
**Date Fixed:** December 24, 2025

All 8 native `alert()`, `confirm()`, and `prompt()` calls have been replaced with accessible, MediaWiki-consistent alternatives:

| File | Replacement |
|------|-------------|
| UIManager.js (3 instances) | DialogManager Promise-based dialogs |
| Toolbar.js (3 instances) | `mw.notify()` for error messages |
| ImportExportManager.js (1 instance) | DialogManager `showConfirmDialog()` |
| LayerSetManager.js (1 instance) | DialogManager `showConfirmDialog()` |

**DialogManager Enhancements:**
- `showConfirmDialog()` - async/Promise-based confirmation dialogs
- `showAlertDialog()` - async/Promise-based alert dialogs  
- `showPromptDialogAsync()` - async/Promise-based text input dialogs

All dialogs now have proper ARIA attributes, keyboard navigation, and MediaWiki styling.

### P0.3 Console Usage in Production ⏳ IN PROGRESS

**Status:** Partially addressed  
**Severity:** LOW  
**Location:** ToolManager.js and others

Some files still use `console.*` directly instead of `mw.log.*`. This is low priority but tracked.

### P0.4 Documentation Updated ✅ FIXED

**Status:** RESOLVED  
**Date Fixed:** December 24, 2025  
**Issue:** This file has been corrected with accurate information

---

## Recently Fixed Issues

### v1.1.12 (December 24, 2025)

| Issue | Severity | Resolution |
|-------|----------|------------|
| **LayersLightbox.js 0% coverage** | CRITICAL | Added 70 tests, now 86.6% coverage |
| **Native alert() calls (8 instances)** | HIGH | Replaced with DialogManager async dialogs |
| **Null pointer in LayersLightbox** | MEDIUM | Added null guards to showError/renderViewer |
| **ESLint no-alert disables (8)** | MEDIUM | Removed - code now uses proper dialogs |

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

**Status:** ✅ RESOLVED  
**Severity:** Previously CRITICAL  
**Date Fixed:** December 24, 2025

All critical files now have test coverage:

| File | Lines | Coverage | Status |
|------|-------|----------|--------|
| **LayersLightbox.js** | **541** | **86.6%** | ✅ **Fixed** |
| ~~ColorControlFactory.js~~ | 241 | ~~HIGH~~ | ✅ Fixed |
| ~~LayerDragDrop.js~~ | 246 | ~~HIGH~~ | ✅ Fixed |
| ~~LayerListRenderer.js~~ | 433 | ~~HIGH~~ | ✅ Fixed |
| ~~MathUtils.js~~ | 78 | ~~MEDIUM~~ | ✅ Fixed |
| ~~PresetDropdown.js~~ | 526 | ~~HIGH~~ | ✅ Fixed |

**Resolution:** 70 tests added for LayersLightbox.js on December 24, 2025.

**Tracking:** [improvement_plan.md](../improvement_plan.md) P0.1

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

The codebase has **9 files exceeding 1,000 lines** (up from 7 in previous review):

| File | Lines | Delegation | Trend |
|------|-------|------------|-------|
| CanvasManager.js | 1,871 | ✅ 10+ controllers | Stable |
| LayerPanel.js | 1,838 | ✅ 7 controllers | Stable |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing |
| LayersEditor.js | 1,335 | ✅ 3 modules | Stable |
| ToolManager.js | 1,275 | ✅ 2 handlers | Stable |
| APIManager.js | 1,207 | ✅ APIErrorHandler | Stable |
| SelectionManager.js | 1,147 | ✅ 3 modules | Stable |
| **ShapeRenderer.js** | **1,049** | ⚠️ None | **NEW** |
| **LayersValidator.js** | **1,036** | ⚠️ Partial | **NEW** |

**Files approaching limit (900-1000 lines):**
- ToolbarStyleControls.js (947 lines) - HIGH risk
- UIManager.js (945 lines) - HIGH risk

**Total in god classes: ~12,297 lines** (26% of JS codebase)

**CI Protection:** `npm run check:godclass` blocks PRs that grow files beyond limits.

**See:** [improvement_plan.md](../improvement_plan.md) for remediation plan.

### ⚠️ ESLint Disable Comments

**Status:** P2 - Improved  
**Count:** 5 instances (down from 13)

ESLint rules are being disabled in 5 locations:

| Rule | Count | Issue |
|------|-------|-------|
| ~~`no-alert`~~ | ~~8~~ | ✅ Removed - code uses proper dialogs now |
| `no-console` | 3 | Using console.* instead of mw.log |
| Other | 2 | Various |

**Improvement:** All 8 `no-alert` disables removed after replacing native dialogs with DialogManager.

**Action:** Replace remaining console.* with mw.log.

### ⚠️ Codebase Size Warning

**Status:** Monitoring  
**Severity:** MEDIUM for maintainability

- **Current:** ~47,000 lines
- **Warning threshold:** 45,000 lines (EXCEEDED)
- **Block threshold:** 50,000 lines

**Action:** Continue extracting functionality from god classes.

**Tracking:** [improvement_plan.md](../improvement_plan.md) P2.7

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

*Document updated: December 24, 2025*
*P0 issues resolved: LayersLightbox.js 86.6% coverage, all 8 alert() calls replaced with accessible dialogs*
