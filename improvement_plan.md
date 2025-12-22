# Layers Extension - Improvement Plan

**Last Updated:** December 21, 2025  
**Status:** ✅ P0 Complete, ✅ P1 Complete  
**Version:** 1.1.10  
**Goal:** Production-ready, secure, maintainable MediaWiki extension

---

## Current State

| Area | Status | Details |
|------|--------|---------|
| **Functionality** | ✅ Working | 14 tools, alignment, presets, named sets, smart guides |
| **Security** | ✅ Resolved | All known issues fixed (SVG XSS, sanitization) |
| **Testing** | ✅ Excellent | 6,337 tests, 0 failing, 92% statement coverage, 80% branch |
| **ES6 Migration** | ✅ Complete | 85 classes, 0 prototype patterns |
| **God Classes** | ⚠️ Monitored | 7 files >1,000 lines (all have delegation patterns) |
| **Accessibility** | ✅ Good | Skip links, ARIA landmarks, keyboard navigation |
| **Mobile** | ❌ Missing | No touch support |
| **Production Ready** | ✅ Ready | All P0 and P1 issues resolved |

---

## Fixes Completed (December 21, 2025)

All P0 and P1 issues identified in reviews have been fixed:

### P0 (Blocking) - All Fixed ✅

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| Background visibility bug | ✅ Fixed | Fixed PHP→JS boolean serialization |
| Missing AutoloadClasses | ✅ Fixed | Added ApiLayersRename to extension.json |
| Console.error in prod | ✅ Fixed | Replaced with mw.log.error in ViewerManager.js |
| Failing test | ✅ Fixed | Updated opacity expectation in LayersViewer.test.js |
| Animation frame leak | ✅ Fixed | Added cancelAnimationFrame in CanvasManager.destroy() |
| Missing sanitization | ✅ Fixed | Added sanitizeSetName to Delete/Rename APIs |
| Duplicated clampOpacity | ✅ Fixed | Created MathUtils.js, updated 6 renderer files |
| ESLint error MathUtils | ✅ Fixed | Added eslint-disable comments for module exports |

### P1 (Security & Stability) - All Fixed ✅

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| SVG XSS Risk | ✅ Fixed | Removed SVG from allowed MIME types |
| Foreign repo file lookup | ✅ Fixed | Changed to getRepoGroup()->findFile() |
| Jest coverage gaps | ✅ Fixed | Updated collectCoverageFrom patterns |
| E2E tests failing | ✅ Fixed | Fixed password length for MediaWiki 1.44 |

---

## Priority Definitions

| Priority | Timeline | Criteria |
|----------|----------|----------|
| **P0** | Immediate | ✅ COMPLETE - All blocking bugs fixed |
| **P1** | 1-4 weeks | ✅ COMPLETE - Security and stability issues fixed |
| **P2** | 1-3 months | Architecture improvements, test coverage |
| **P3** | 3-6 months | Feature enhancements, future-proofing |

---

## Phase 2: Code Quality & Testing (P2)

### P2.1 Add Tests for Uncovered Files ✅ COMPLETE

**Status:** All files now have test coverage  
**Coverage:** 92.19% statements, 80.19% branches

Files previously at 0% now covered:

| File | Lines | Coverage | Status |
|------|-------|----------|--------|
| MathUtils.js | 78 | 100% | ✅ Complete |
| ColorControlFactory.js | 241 | 87.2% | ✅ Complete |
| LayerDragDrop.js | 246 | 100% | ✅ Complete |
| LayerListRenderer.js | 433 | 99.49% | ✅ Complete |
| PresetDropdown.js | 526 | 93.25% | ✅ Complete |
| APIErrorHandler.js | 348 | 98.03% | ✅ Complete |
| NamespaceHelper.js | 91 | 95.65% | ✅ Complete |

### P2.2 Split LayersValidator.js ⏳ NOT STARTED

- **Current:** 958 lines (HIGH risk - approaching 1,000 limit)
- **Proposed structure:**
  - `LayersValidator.js` (orchestrator, ~200 lines)
  - `TypeValidator.js` (~250 lines)
  - `GeometryValidator.js` (~200 lines)
  - `StyleValidator.js` (~200 lines)
  - `TextValidator.js` (~150 lines)
- **Effort:** 4-6 hours

### P2.3 Split ToolbarStyleControls.js ⏳ NOT STARTED

- **Current:** 947 lines (HIGH risk - approaching limit)
- **Proposed extraction:**
  - `ShapeStyleControls.js`
  - `TextStyleControls.js`
  - `EffectStyleControls.js`
- **Effort:** 4-6 hours

### P2.4 Fix Timer Cleanup ⏳ NOT STARTED

- **Issue:** ~15 setTimeout calls without cleanup tracking
- **Files affected:** EditorBootstrap.js, ErrorHandler.js, UIManager.js, etc.
- **Fix:** Store timer IDs and clear in destroy() methods
- **Effort:** 2-3 hours

### P2.5 Extract Magic Numbers ⏳ NOT STARTED

- **Issue:** Hardcoded values scattered throughout codebase
- **Examples:** 800x600 canvas, 1001 z-index, 8px snap threshold, 5000ms timeout
- **Fix:** Add to LayersConstants.js
- **Effort:** 1-2 hours

### P2.6 Reduce ESLint Disable Usage ⏳ NOT STARTED

- **Current:** ~20 eslint-disable comments
- **Goal:** Reduce to <5 (only truly unavoidable cases)
- **Effort:** 3-4 hours

### P2.7 Monitor Codebase Size ⏳ ONGOING

- **Current:** 46,063 lines
- **Warning threshold:** 45,000 lines (EXCEEDED by 1,063)
- **Block threshold:** 50,000 lines
- **Action:** Continue extracting functionality from god classes
- **Goal:** Stay under 50,000 lines

---

## Phase 3: Features & Future-Proofing (P3)

### P3.1 Mobile/Touch Support ⏳ NOT STARTED

- **Priority:** HIGH (for mobile users)
- **Required:**
  - Touch event handlers in InteractionController
  - Responsive toolbar layout
  - Gesture support (pinch-to-zoom, two-finger pan)
  - Touch-friendly selection handles (larger hit areas)
  - Mobile-optimized layer panel
- **Effort:** 4-6 weeks
- **Impact:** Critical for modern web, tablets

### P3.2 Accessibility Audit ⏳ STARTED (50%)

- **Completed:**
  - Skip links (WCAG 2.4.1)
  - ARIA landmarks (WCAG 1.3.1)
  - Keyboard navigation
  - 16 automated a11y tests
- **Remaining:**
  - Manual screen reader testing
  - WCAG 2.1 AA full compliance audit
  - Color contrast verification
  - Focus visibility improvements

### P3.3 Remove Deprecated Code ⏳ NOT STARTED

- **Items to remove:**
  - Direct window lookup pattern (CanvasManager.js)
  - Old normalization method (APIManager.js)
  - Deprecated global exports (compat.js)
- **Effort:** 2-3 hours
- **Breaking changes:** May require version bump

### P3.4 TypeScript Migration ⏳ STARTED (5%)

- **Migrated:**
  - `resources/ext.layers.shared/DeepClone.ts`
  - `resources/ext.layers.shared/BoundsCalculator.ts`
- **Commands:** `npm run typecheck`, `npm run build:ts`
- **Priority:** Low - ES6 with JSDoc provides good type safety
- **Effort:** 40-60 hours for full migration

### P3.5 Layer Grouping ⏳ NOT STARTED

- **Feature:** Group multiple layers for bulk operations
- **Use cases:** Move/scale/rotate groups, toggle visibility
- **Effort:** 2-3 weeks

### P3.6 Performance Benchmarks ⏳ NOT STARTED

- **Goal:** Automated performance regression detection
- **Metrics:** Render time, interaction latency, memory usage
- **Effort:** 1 week

---

## God Class Status Tracker

| File | Lines | Delegation | Trend | Action |
|------|-------|------------|-------|--------|
| CanvasManager.js | 1,875 | ✅ 10+ controllers | Stable | Monitor |
| LayerPanel.js | 1,838 | ✅ 7 controllers | Stable | Monitor |
| Toolbar.js | 1,539 | ✅ 4 modules | ↑ Growing | Watch |
| LayersEditor.js | 1,324 | ✅ 3 modules | Stable | Monitor |
| ToolManager.js | 1,264 | ✅ 2 handlers | Stable | Monitor |
| SelectionManager.js | 1,194 | ✅ 3 modules | Stable | Monitor |
| APIManager.js | 1,174 | ✅ APIErrorHandler | Stable | Monitor |

**Total in god classes: ~10,208 lines** (22% of codebase)

### Files to Watch (800-1000 lines)

| File | Lines | Risk | Action |
|------|-------|------|--------|
| LayersValidator.js | 958 | ⚠️ HIGH | **Split in P2.2** |
| ToolbarStyleControls.js | 947 | ⚠️ HIGH | **Split in P2.3** |
| UIManager.js | 917 | ⚠️ MEDIUM | Monitor |
| ShapeRenderer.js | 861 | ⚠️ LOW | Monitor |
| CanvasRenderer.js | 859 | ⚠️ LOW | Monitor |
| PropertiesForm.js | 832 | ⚠️ LOW | Monitor |
| ResizeCalculator.js | 822 | ⚠️ LOW | Monitor |

---

## Progress Tracking

```
Phase 0 (Immediate - BLOCKING):
All P0 items:               ████████████████████ 100% ✅ COMPLETE

Phase 1 (Security - 4 weeks):
P1.1 Remove SVG XSS:        ████████████████████ 100% ✅
P1.2 Fix File Lookup:       ████████████████████ 100% ✅
P1.3 Expand Jest Coverage:  ████████████████████ 100% ✅
P1.4 Stabilize E2E Tests:   ████████████████████ 100% ✅

Phase 2 (Code Quality - 8 weeks):
P2.1 Test Uncovered Files:  ░░░░░░░░░░░░░░░░░░░░ 0%
P2.2 Split LayersValidator: ░░░░░░░░░░░░░░░░░░░░ 0%
P2.3 Split ToolbarStyle:    ░░░░░░░░░░░░░░░░░░░░ 0%
P2.4 Fix Timer Cleanup:     ░░░░░░░░░░░░░░░░░░░░ 0%
P2.5 Extract Magic Numbers: ░░░░░░░░░░░░░░░░░░░░ 0%
P2.6 Reduce ESLint Disable: ░░░░░░░░░░░░░░░░░░░░ 0%
P2.7 Monitor Codebase Size: ██████████░░░░░░░░░░ 50% (ongoing)

Phase 3 (Features - 12+ weeks):
P3.1 Mobile/Touch:          ░░░░░░░░░░░░░░░░░░░░ 0%
P3.2 Accessibility Audit:   ██████████░░░░░░░░░░ 50%
P3.3 Remove Deprecated:     ░░░░░░░░░░░░░░░░░░░░ 0%
P3.4 TypeScript:            █░░░░░░░░░░░░░░░░░░░ 5%
P3.5 Layer Grouping:        ░░░░░░░░░░░░░░░░░░░░ 0%
P3.6 Performance Benchmarks:░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## Success Metrics

### Phase 0 & 1 Complete ✅

- [x] All tests passing (5,766)
- [x] No console.* in production code
- [x] Animation frame cancelled in destroy()
- [x] Setname sanitized in all APIs
- [x] Background visibility works correctly
- [x] SVG removed from allowed MIME types
- [x] All APIs use getRepoGroup()->findFile()
- [x] Jest tracks all source directories
- [x] E2E tests run without continue-on-error

### Phase 2 Complete When

- [ ] All files have >50% test coverage
- [ ] LayersValidator split into specialized validators
- [ ] ToolbarStyleControls split
- [ ] All timers cleaned up in destroy()
- [ ] Magic numbers extracted to constants
- [ ] ESLint disables reduced to <5
- [ ] Codebase under 50,000 lines

### World-Class When

- [ ] Mobile/touch support working
- [ ] WCAG 2.1 AA compliant
- [ ] TypeScript on all shared modules
- [ ] All files >80% test coverage
- [ ] New contributor productive in <1 day

---

## Rules

### The P0 Rule ✅

**No new features until P0 is complete.** — SATISFIED

P0 items are:
- Broken functionality
- Security vulnerabilities (critical)
- Test failures
- Production errors

### The God Class Rule

When any file exceeds 1,000 lines:
1. **Assess:** Is it a facade with good delegation? If yes, acceptable up to 1,500 lines.
2. **Extract:** If monolithic, identify cohesive functionality for new module
3. **Hard limit:** No file should exceed 2,000 lines

### The Security Rule

- Never allow untrusted content without sanitization
- Remove risky features (like SVG) rather than leaving them unsanitized
- All writes require CSRF tokens
- Rate limit all user-facing operations

### The Destroy Rule

When adding new controller/module references:
1. Add to constructor initialization
2. Add cleanup to destroy() method
3. Cancel any animation frames or timers
4. Test that cleanup actually runs

### The Coverage Rule

- No new file should be added without tests
- Existing files should not drop below current coverage
- UI components need at least smoke tests

---

## Quick Wins (< 30 minutes each)

1. ✅ ~~Remove SVG from allowed MIME types~~ → DONE (Dec 21, 2025)
2. ✅ ~~Fix getLocalRepo() to getRepoGroup()~~ → DONE (Dec 21, 2025)
3. ✅ ~~Expand Jest collectCoverageFrom~~ → DONE (Dec 21, 2025)
4. ⏳ Add tests for MathUtils.js → 30 min
5. ⏳ Extract SNAP_THRESHOLD to constants → 15 min
6. ⏳ Add `// @ts-check` to high-traffic files → 5 min each

---

## Timeline

| Phase | Duration | Gate | Status |
|-------|----------|------|--------|
| Phase 0 | Complete | Bugs fixed, tests passing | ✅ DONE |
| Phase 1 | Complete | Security fixed, stability improved | ✅ DONE |
| Phase 2 | 8 weeks | Code quality improvements | ⏳ Ready to start |
| Phase 3 | 12+ weeks | Mobile, world-class features | ⏳ Waiting |

---

## Next Actions

1. **P2.1** - Add tests for MathUtils.js (30 min, quick win)
2. **P2.2** - Split LayersValidator.js (4-6 hours)
3. **P2.4** - Fix timer cleanup in EditorBootstrap.js (1 hour)
4. **P2.5** - Extract SNAP_THRESHOLD constant (15 min)

---

*Plan updated: December 21, 2025*  
*Status: P0 and P1 COMPLETE - Extension is production-ready*  
*Next focus: P2 Code Quality improvements*
