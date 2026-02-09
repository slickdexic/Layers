# Improvement Plan

**Updated:** February 8, 2026 (v31 — 3 P2 fixes)
**Version:** 1.5.52

Cross-reference with [codebase_review.md](codebase_review.md) and
[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

---

## Phase Overview

| Phase | Focus | Items | Status |
|-------|-------|-------|--------|
| Phase 0 | Prior fixes (v22-v28) | 22+ | ✅ Done |
| Phase 1 | High-priority fixes | 10 | 8 ✅ Fixed, 2 ❌ Open |
| Phase 2 | Medium issues | 28 | 18 ✅ Fixed, 10 ❌ Open |
| Phase 3 | Low / housekeeping | 31 | Deferred (8 new) |
| Phase 4 | Infrastructure | 5 | ❌ NEW |
| Phase 5 | Documentation | 42 | ❌ Open |

---

## Phase 0 — Previously Completed (v22-v28)

All items ✅ FIXED. See codebase_review.md for details.

- 3 CRITICAL fixes (v27): exception swallowing ×2,
  diagnose.php cleanup
- 6 HIGH fixes (v27): DB cache, duplicateSelected, text
  limits, save button, clipboard paste, toggleLayerLock
- 2 CRITICAL fixes (v25): phantom API, callout scaling
- 4 HIGH fixes (v25): ToolStyles, ValidationManager, text
  decoration, PresetManager
- All v24 critical/high fixes
- **v28-fix:** 7 issues with 26 regression tests:
  - CRIT-v28-2: groupSelected() `group` → `group.id`
  - HIGH-v28-2: Canvas hash all path points (DJB2)
  - HIGH-v25-1: TextRenderer rotation respects textAlign
  - HIGH-v25-5: SVG CSS injection vectors (5 patterns)
  - HIGH-v26-1: VALID_LINK_VALUES editor subtypes
  - MED-v28-8: DrawingController Math.abs() + origin
  - MED-v28-9: DraftManager strips base64 src

---

## Phase 1 — High-Priority Fixes (10 total, 4 new)

### 1.1 Hit Testing for Rotated Rectangles/Ellipses (HIGH-v29-1)

**Effort:** 2 hours | **Risk:** Low | **Status:** ✅ FIXED (v29-fix)
**File:** resources/ext.layers.editor/canvas/HitTestController.js

Added rotation-aware hit testing to `isPointInRectangleLayer()`,
`isPointInCircle()`, and `isPointInEllipse()`. Un-rotates test
point around layer center using inverse rotation matrix.
7 regression tests added to HitTestController.test.js.

**Fix:** Before the bounds check, un-rotate the test point around
the layer's center using inverse rotation matrix:
```js
if (layer.rotation) {
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const rad = -layer.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = point.x - cx, dy = point.y - cy;
    point = {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
}
```

Add regression tests for rotated rectangle and ellipse hit testing.

---

### 1.2 ShapeRenderer strokeWidth:0 as 1 (HIGH-v29-2)

**Effort:** 30 minutes | **Risk:** Low | **Status:** ✅ FIXED (v29-fix)
**File:** resources/ext.layers.shared/ShapeRenderer.js

Replaced `|| 1` with `?? 1` in 5 methods: drawRectangle (L340),
drawCircle (L548), drawEllipse (L660), drawLine (L839),
drawPath (L906, `?? 2`). 6 regression tests added.

---

### 1.3 getRawCoordinates() Coordinate Math (HIGH-v29-3)

**Effort:** 1 hour | **Risk:** Medium | **Status:** ✅ FIXED (v29-fix)
**File:** resources/ext.layers.editor/TransformationEngine.js

Fixed `getRawCoordinates()` to apply DPI scaling
(`canvas.width/rect.width`) and correct pan/zoom order
matching `clientToCanvas()`. No active callers in resources/
but fixed for correctness.

---

### 1.4 normalizeLayers Input Mutation (HIGH-v29-4)

**Effort:** 15 minutes | **Risk:** Low | **Status:** ✅ FIXED (v29-fix)
**File:** resources/ext.layers.editor/LayersEditor.js L1533

Changed to `Object.assign({}, layer, { visible: true })` to
avoid mutating input objects. Regression test verifies original
object is unchanged and references differ.

---

### 1.5 ON DELETE CASCADE → SET NULL (HIGH-v27-1)

**Effort:** 2 hours | **Risk:** Medium (migration)
**File:** sql/layers_tables.sql, sql/patches/

Create migration patch changing both FKs to
`ON DELETE SET NULL`. Update LayersDatabase queries to handle
NULL user IDs gracefully. Test with user deletion scenario.

---

### 1.6 ls_name NOT NULL Constraint (HIGH-v27-2)

**Effort:** 1 hour | **Risk:** Medium
**File:** sql/layers_tables.sql, sql/patches/

Migration: `UPDATE layers_sets SET ls_name='default' WHERE
ls_name IS NULL;` then `ALTER TABLE ... MODIFY ls_name
VARCHAR(255) NOT NULL DEFAULT 'default'`.

---

### 1.7 ThumbnailRenderer Shadow Fix (HIGH-v28-4)

**Effort:** 4 hours | **Risk:** Medium
**File:** src/ThumbnailRenderer.php L270

Compose shadow on a separate temporary image, blur that
image, then composite beneath the shape. Requires IM
`\( +clone ... \)` sub-image command restructuring.

---

### 1.8 SQLite Schema Compatibility (HIGH-v28-5)

**Effort:** 3 hours | **Risk:** Medium
**File:** src/Database/LayersSchemaManager.php L113-220

Gate MySQL-specific DDL. For SQLite, use table recreation
pattern or skip unsupported constraints with appropriate
logging. Fix try/catch to handle SQLite error codes too.

---

### 1.9 Selection State Unification (HIGH-v27-5)

**Effort:** 4 hours | **Risk:** High (widescale)
**File:** resources/ext.layers.editor/SelectionManager.js

Make StateManager the single source of truth for selection.
Remove duplicate tracking in SelectionManager/SelectionState.
This is a large refactor requiring broad test coverage.

---

### 1.10 Rich Text Font Metrics (HIGH-v26-2)

**Effort:** 2 hours | **Risk:** Medium
**File:** resources/ext.layers.shared/TextBoxRenderer.js L551

Pass per-run fontSize to `measureText()` within `wrapText()`
instead of using base layer fontSize for all runs.

---

## Phase 2 — Medium Issues (28 items)

### New in v29 (10 items)

| ID | Fix | Effort | Risk |
|----|-----|--------|------|
| 2.1 | Fix callout blur bounds for left/right tails | 30m | ✅ FIXED (v31) |
| 2.2 | SmartGuides cache: hash snap points or invalidate on mutation | 1h | Med |
| 2.3 | DimensionRenderer: `\|\|` → `??` for zero-value options | 30m | ✅ FIXED |
| 2.4 | closeAllDialogs: track and remove keydown listeners | 30m | ✅ FIXED |
| 2.5 | Remove ToolManager dead fallback code (~400 lines) | 1h | Low |
| 2.6 | HistoryManager: explicit type parameter | 1h | Med |
| 2.7 | DialogManager: unify prompt dialogs | 1h | Med |
| 2.8 | LayerInjector: use setLogger() after construction | 15m | ✅ FIXED |
| 2.9 | SlideHooks: delegate to ColorValidator | 30m | ✅ FIXED |
| 2.10 | services.php: add declare(strict_types=1) | 5m | ✅ FIXED |

### Carried from v25-v28 (18 items)

| ID | Fix | Effort | Risk |
|----|-----|--------|------|
| 2.11 | Replace regex SVG check with DOMParser | 2h | Low |
| 2.12 | Use allowlist instead of strip in sanitize | 1h | Med |
| 2.13 | Cache Lightbox instance in ViewerOverlay | 30m | ✅ FIXED (v30) |
| 2.14 | Clone/replace input on editLayerName | 30m | ✅ FIXED (v30) |
| 2.15 | Null offscreen canvas after effects | 15m | ✅ FIXED (v30) |
| 2.16 | Scale callout tailSize by viewer ratio | 30m | Low |
| 2.17 | Cap shadow stroke to canvas dims | 15m | ✅ FIXED (v31) |
| 2.18 | Remove dead SlideManager code | 1h | Low |
| 2.19 | Extract isForeignFile to shared trait | 1h | Low |
| 2.20 | Deduplicate enrichWithUserNames | 1h | Low |
| 2.21 | Conditional module loading in Hooks | 1h | Med |
| 2.22 | i18n hardcoded PropertiesForm strings | 30m | ✅ FIXED (v31) |
| 2.23 | Filter unlocked in selectAll fallback | 15m | ✅ FIXED (v30) |
| 2.24 | Remove old listeners in GradientEditor | 30m | ✅ FIXED (v30) |
| 2.25 | Debounce InlineTextEditor input | 30m | ✅ FIXED (v30) |
| 2.26 | Viewer conditional loading | 1h | Med |
| 2.27 | Add try/catch to ApiLayersList | 15m | ✅ FIXED (v30) |
| 2.28 | Cache fallback registry instances | 15m | ✅ FIXED (v30) |

**Total Phase 2 Effort:** ~16 hours

---

## Phase 3 — Low Priority / Housekeeping (31 items)

Deferred. See docs/KNOWN_ISSUES.md P3 section for full list.

Key items:
- Defer Lightbox singleton creation (P3.1)
- EventTracker Map-based lookup (P3.2)
- PresetStorage size caps (P3.3)
- Defer ErrorHandler body append (P3.4)
- GradientEditor incremental updates (P3.5)
- ToolStyles validation (P3.6)
- ClipboardController local coords (P3.7)
- isValidColor Set-based lookup (P3.8)
- Remove dead WikitextHooks code (P3.20, P3.21)
- Fix hex regex accepting 5/7 digits (P3.23)
- Consider configurable slide dimensions (P3.14)

**Total Phase 3 Effort:** ~10 hours

---

## Phase 4 — Infrastructure Fixes (5 items)

| ID | Fix | Effort | Risk |
|----|-----|--------|------|
| 4.1 | Remove FK constraints from SQL schema | 2h | Med |
| 4.2 | Fix SpecialEditSlide missing ResourceModule | 30m | Low |
| 4.3 | Add missing slides files to module or delete | 1h | Low |
| 4.4 | Remove duplicate message keys in extension.json | 30m | Low |
| 4.5 | Upgrade phpunit.xml to PHPUnit 10 schema | 1h | Med |

**Total Phase 4 Effort:** ~5 hours

---

## Phase 5 — Documentation Fixes (42 items)

### Batch 1: Factually Wrong (12 items, ~3 hours)

- Fix i18n count: 749 → 676 in ARCHITECTURE.md, wiki/Home.md
- Fix PHPUnit count: 24 → 31 in README.md, ARCHITECTURE.md,
  MW mediawiki, wiki/Home.md
- Fix ARCHITECTURE.md version (0.8.5 → 1.5.52) and viewer lines
- Fix LTS_BRANCH_STRATEGY.md version and tool count
- Fix THIRD_PARTY_LICENSES.md SVG count (3,731 → 2,817)
- Fix copilot-instructions PropertiesForm.js (914 → 994)
- Archive or update UX_STANDARDS_AUDIT.md (v1.1.5 era)

### Batch 2: Outdated/Incomplete (16 items, ~3 hours)

- Update JS/PHP line counts across all docs
- SLIDE_MODE.md implementation status update
- INSTANTCOMMONS_SUPPORT.md → layerset= syntax
- SHAPE_LIBRARY_PROPOSAL.md status → "Implemented"
- NAMED_LAYER_SETS.md remove proposal language
- copilot-instructions.md: ~15 stale line counts
- CSP_GUIDE.md: remove unsafe-eval recommendation
- ACCESSIBILITY.md: add missing keyboard shortcuts
- WIKITEXT_USAGE.md: add Slide syntax
- DOCUMENTATION_UPDATE_GUIDE.md: reconcile file count
- CHANGELOG.md v1.5.51: 40 → 39 PHP files

### Batch 3: Style/Formatting (14 items, ~1 hour)

- Date consistency across docs
- Example version updates
- Section numbering fixes
- Various minor corrections

**Total Phase 5 Effort:** ~7 hours

---

## God Class Status (21 files >1,000 lines)

### Generated Data (exempt): 2

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript: 17

| File | Lines | Reduction Plan |
|------|-------|----------------|
| LayerPanel.js | 2,191 | Extract more to controllers |
| CanvasManager.js | 2,053 | Facade, delegates to 10 |
| Toolbar.js | 1,891 | Extract preset/style groups |
| LayersEditor.js | 1,846 | Already delegates to 7 |
| InlineTextEditor.js | 1,672 | Extract selection handler |
| APIManager.js | 1,570 | Extract error/retry logic |
| PropertyBuilders.js | 1,495 | Split by property type |
| SelectionManager.js | 1,415 | Unify with StateManager |
| CanvasRenderer.js | 1,389 | Extract cache subsystem |
| ViewerManager.js | 1,320 | Extract instance factory |
| ToolManager.js | 1,214 | Remove 400 dead lines (2.5) |
| GroupManager.js | 1,207 | Extract validation logic |
| SlideController.js | 1,131 | Extract transition system |
| TransformController.js | 1,117 | Extract constraint logic |
| LayersValidator.js | 1,116 | Split by layer type |
| ResizeCalculator.js | 1,017 | Shape-specific classes |
| ShapeRenderer.js | 1,010 | Extract gradient handling |

### PHP: 2

| File | Lines | Reduction Plan |
|------|-------|----------------|
| ServerSideLayerValidator.php | 1,375 | Type-specific validators |
| LayersDatabase.php | 1,364 | Extract query builders |

### Near-Threshold (900–1,000 lines — 6 files)

| File | Lines |
|------|-------|
| ToolbarStyleControls.js | 998 |
| TextBoxRenderer.js | 996 |
| PropertiesForm.js | 994 |
| ArrowRenderer.js | 974 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 961 |

---

## Security Posture Summary

**Grade:** B+ (Good)

### Strengths

- CSRF tokens on all writes
- Parameterized SQL everywhere
- Rate limiting on all 5 endpoints
- Iterative HTML sanitization
- Strict 110+ property whitelist
- Exponential backoff + locking
- Font sanitized at save (sanitizeIdentifier)
- CSP via MW API (addExtraHeader + fallback)
- SVG CSS injection vectors blocked (5 patterns)

### Gaps to Address

1. ON DELETE CASCADE: change to SET NULL for user FKs
2. Client SVG regex: replace with DOMParser
3. fontFamily: validate against $wgLayersDefaultFonts
   allowlist before passing to ImageMagick
4. FK constraints: remove per MediaWiki conventions
5. renderCodeSnippet: HTML-escape filename (defense
   in depth, currently dead code)

---

## Test Coverage Targets

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Statement | 95.19% | 95% | ✅ Met |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Met |
| Lines | 95.32% | 95% | ✅ Met |

### Priority Coverage Additions

1. SlideController.js: 74.8% → 85%+
2. RichTextToolbar.js: 83.8% → 90%+
3. InlineTextEditor.js: 86.3% → 90%+
4. HitTestController: rotation scenarios (Phase 1.1)
5. ShapeRenderer: strokeWidth:0 scenarios (Phase 1.2)
6. ext.layers.slides/ module tests

---

## Strategic Risks

### 1. document.execCommand Deprecation

InlineTextEditor relies on `document.execCommand`. This API
is deprecated. Plan migration to Selection/Range API with
manual DOM manipulation. **Timeline:** 6-12 months.

### 2. God Class Proliferation

17 hand-written god classes + 6 near-threshold. While
delegation patterns mitigate complexity, continued growth
will degrade maintainability. Prioritize splits during
feature work. ToolManager dead code removal (Phase 2.5)
is the easiest immediate win (~400 lines).

### 3. SQLite Compatibility

Schema migrations are MySQL-only. Community MediaWiki
installations sometimes use SQLite. Lack of support may
prevent adoption.

### 4. Module Loading Performance

ext.layers loaded on every page view via Hooks.php.
Conditional loading based on page context would reduce
overhead for non-file pages.

### 5. Foreign Key Constraints

MySQL foreign keys violate MediaWiki conventions. They
cause failures during maintenance/update.php, user merges,
and non-InnoDB engine configurations. ON DELETE CASCADE
silently destroys user content on user deletion. These
should be removed and referential integrity handled in
application code (which LayersDatabase.php already does).

---

## Effort Summary

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1 (High) | ~18h total (4h new, 14h inherited) | This sprint |
| Phase 2 (Medium) | ~16h total (6h new, 10h inherited) | Next sprint |
| Phase 3 (Low) | ~10 hours | Backlog |
| Phase 4 (Infra) | ~5 hours | This sprint |
| Phase 5 (Docs) | ~7 hours | Ongoing |
| **Total Remaining** | **~56 hours** | |

---

## Priority Fix Order (Recommended)

### Quick Wins (< 1 hour each, low risk)

1. **Phase 1.2:** ShapeRenderer `||` → `??` (30 minutes)
2. **Phase 1.4:** normalizeLayers spread copy (15 minutes)
3. **Phase 2.8:** LayerInjector setLogger() (15 minutes)
4. **Phase 2.9:** SlideHooks delegate to ColorValidator (30m)
5. **Phase 2.10:** services.php strict_types (5 minutes)
6. **Phase 4.4:** Remove duplicate message keys (30 minutes)

### Medium Effort (1-2 hours, moderate risk)

7. **Phase 1.1:** HitTest rotation support (2 hours)
8. **Phase 1.3:** getRawCoordinates() fix (1 hour)
9. **Phase 4.1:** Remove FK constraints (2 hours)
10. **Phase 2.5:** Remove ToolManager dead code (1 hour)

### Large Effort (3+ hours, higher risk)

11. **Phase 1.7:** ThumbnailRenderer shadow fix (4 hours)
12. **Phase 1.8:** SQLite schema compatibility (3 hours)
13. **Phase 1.9:** Selection state unification (4 hours)
14. **Phase 5:** Documentation batch fixes (7 hours)