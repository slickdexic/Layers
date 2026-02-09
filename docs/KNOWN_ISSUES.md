# Known Issues

**Last Updated:** February 8, 2026 (v29 — comprehensive fresh audit)
**Version:** 1.5.52

Cross-reference with [codebase_review.md](../codebase_review.md) and
[improvement_plan.md](../improvement_plan.md) for details and fix plans.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **0** | ✅ All fixed |
| P1 (High Priority) | **10** | ❌ OPEN (4 new in v29) |
| P2 (Medium Priority) | **28** | ❌ OPEN (10 new in v29) |
| P3 (Low Priority) | **31** | Deferred (8 new in v29) |
| Performance | **11** | 2 HIGH, 5 MEDIUM, 4 LOW |
| Infrastructure | **5** | 2 HIGH, 3 MEDIUM |
| Documentation | **42** | 12 HIGH, 16 MEDIUM, 14 LOW |

---

## Security Controls Status (v29 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ✅ PASS | All 5 endpoints, per-role |
| XSS Prevention | ✅ PASS | TextSanitizer iterative |
| Input Validation | ✅ PASS | 110+ property whitelist |
| Authorization | ✅ PASS | Owner/admin checks |
| Transaction Safety | ✅ PASS | Atomic + FOR UPDATE |
| Boolean Normalization | ✅ PASS | API serialization handled |
| IM File Disclosure | ✅ PASS | @ stripped, Shell escapes |
| CSP Header | ✅ PASS | addExtraHeader(); fallback |
| Font Sanitization | ✅ PASS | sanitizeIdentifier() |
| SVG Sanitization | ✅ PASS | CSS vectors blocked |
| IM Font Path | ⚠️ GAP | fontFamily not vs allowlist |
| Client SVG | ⚠️ WEAK | Regex-based, bypassable |
| User Deletion | ⚠️ RISK | CASCADE destroys content |
| XSS Pattern | ⚠️ LATENT | innerHTML with filename |

---

## Previously Fixed Issues (v22-v28)

All CRITICAL issues from prior reviews verified as fixed:

- v28-fix: 7 issues (1 CRIT, 4 HIGH, 2 MED) with 26 tests
- v27: 3 CRITICAL (exception swallowing ×2, diagnose.php)
- v27: 6 HIGH (DB cache, duplicateSelected, text limits,
  save button, clipboard paste, toggleLayerLock)
- v25: 2 CRITICAL (phantom API, callout scaling)
- v25: 4 HIGH (ToolStyles, ValidationManager, text decoration,
  PresetManager)
- v24: All CRITICAL/HIGH fixed

## Confirmed False Positives (v24-v29)

| Claimed Issue | Why It's False |
|---------------|----------------|
| AlignmentController moveLayer dim/marker | Default x/y |
| PolygonStarRenderer missing setContext | Cascaded |
| Non-atomic batch deletion (N undo) | saveToHistory no-op |
| ThumbnailRenderer font not validated | sanitizeIdentifier |
| WikitextHooks static state fragile | resetPageLayersFlag |
| CSP uses raw header() | Guarded fallback |
| ShapeRenderer x/y scaling | CSS transform |
| IM color injection | Shell::command escapes |
| CSP header injection | File::getUrl() |
| Retry on all errors in DB save | isDuplicateKeyError |
| isLayerEffectivelyLocked stale | Getter to StateManager |
| StateManager.set() inconsistency | Correct lock pattern |

---

## ✅ P0 — Critical Issues (0 — all fixed)

### ~~P0.1 groupSelected() Passes Object Instead of ID~~

**Ref:** CRIT-v28-2 | **Status:** ✅ FIXED (v28-fix)
**File:** resources/ext.layers.editor/GroupManager.js L1157

Changed `selectLayer( group )` to `selectLayer( group.id )`.
Regression test added to GroupManager.test.js.

---

## ❌ P1 — High Priority Issues (10)

### New in v29

#### P1.1 Hit Testing Fails on Rotated Rectangles/Ellipses

**Ref:** HIGH-v29-1 | **Status:** ❌ OPEN
**File:** resources/ext.layers.editor/canvas/HitTestController.js

`isPointInRectangleLayer()` (L343) tests against axis-aligned
bounds without un-rotating the test point into the layer's
local coordinate system. `isPointInEllipse()` (L373) has the
same issue. `isPointInPolygonOrStar()` correctly handles
rotation, proving the approach is known in the codebase.

**Impact:** Users cannot reliably click rotated rectangles,
textboxes, callouts, blur layers, image layers, or ellipses.

**Fix:** Un-rotate test point around layer center before
bounds testing (inverse rotation matrix).

---

#### P1.2 strokeWidth:0 Treated as strokeWidth:1

**Ref:** HIGH-v29-2 | **Status:** ❌ OPEN
**File:** resources/ext.layers.shared/ShapeRenderer.js

Five methods use `layer.strokeWidth || 1`:
drawRectangle (L340), drawCircle (L548), drawEllipse (L660),
drawLine (L839), drawPath (L907 uses `|| 2`).

JavaScript `||` treats 0 as falsy. Users cannot create
fill-only shapes (no stroke border). TextBoxRenderer uses
the correct `typeof` check.

**Fix:** Replace `|| 1` with `?? 1` (nullish coalescing).

---

#### P1.3 getRawCoordinates() Incorrect Coordinate Math

**Ref:** HIGH-v29-3 | **Status:** ❌ OPEN
**File:** resources/ext.layers.editor/TransformationEngine.js

`getRawCoordinates()` (L535) skips the `canvas.width/rect.width`
CSS-to-logical DPI scaling that `clientToCanvas()` (L473)
correctly applies. Also applies pan/zoom in wrong order
(subtract then divide vs divide then subtract).

**Impact:** Wrong world coordinates on HiDPI displays or when
canvas CSS size differs from pixel dimensions.

**Fix:** Unify math with `clientToCanvas()` or redirect callers.

---

#### P1.4 normalizeLayers Mutates Input Objects

**Ref:** HIGH-v29-4 | **Status:** ❌ OPEN
**File:** resources/ext.layers.editor/LayersEditor.js L1533

`.map()` creates new array but elements are same references.
`layer.visible = true` mutates the original API response data.
If history or other systems hold references to same objects,
state is silently corrupted.

**Fix:** `return { ...layer, visible: true }` (spread copy).

---

### Inherited from v25-v28

#### P1.5 ON DELETE CASCADE Destroys User Annotations

**Ref:** HIGH-v27-1 | **Status:** ❌ OPEN
**File:** sql/layers_tables.sql L19, L29

Both user FKs use `ON DELETE CASCADE`. Deleting a user
cascade-deletes ALL their layer sets and library assets.

**Fix:** Change to `ON DELETE SET NULL`.

---

#### P1.6 ls_name Allows NULL Despite Required Semantics

**Ref:** HIGH-v27-2 | **Status:** ❌ OPEN
**File:** sql/layers_tables.sql L10

`ls_name varchar(255) DEFAULT NULL` lets NULL bypass the
UNIQUE KEY. App code always provides a name.

**Fix:** `NOT NULL DEFAULT 'default'`

---

#### P1.7 ThumbnailRenderer Shadow Blur Corrupts Canvas

**Ref:** HIGH-v28-4 | **Status:** ❌ OPEN
**File:** src/ThumbnailRenderer.php L270

ImageMagick `-blur` is global — blurs entire canvas.

**Fix:** Composite shadows on separate temp images.

---

#### P1.8 SQLite-Incompatible Schema Migrations

**Ref:** HIGH-v28-5 | **Status:** ❌ OPEN
**File:** src/Database/LayersSchemaManager.php L113-220

MySQL-specific DDL in code path that also gates SQLite.

**Fix:** Add SQLite-specific code paths or skip with logging.

---

#### P1.9 Triple Source of Truth for Selection State

**Ref:** HIGH-v27-5 | **Status:** ❌ OPEN
**File:** resources/ext.layers.editor/SelectionManager.js L50

Selection state tracked in SelectionManager, StateManager,
and SelectionState — synced via notifications.

**Fix:** Use StateManager as sole canonical source.

---

#### P1.10 Rich Text Word Wrap Wrong Font Metrics

**Ref:** HIGH-v26-2 | **Status:** ❌ OPEN
**File:** resources/ext.layers.shared/TextBoxRenderer.js L551

`wrapText()` uses base fontSize for all measurements but
per-run fontSize overrides are applied during rendering,
causing lines to overflow or underflow.

---

## ❌ P2 — Medium Priority Issues (28)

### New in v29

| ID | Issue | File |
|----|-------|------|
| P2.1 | CalloutRenderer blur clips left/right tails | CalloutRenderer.js L824 |
| P2.2 | SmartGuides cache stale on mutations | SmartGuidesController.js L378 |
| P2.3 | DimensionRenderer factory 0 as default | DimensionRenderer.js L729 |
| P2.4 | closeAllDialogs leaks keydown handlers | DialogManager.js L701 |
| P2.5 | ToolManager 400+ lines dead fallbacks | ToolManager.js L500-900 |
| P2.6 | HistoryManager duck-type constructor | HistoryManager.js L28 |
| P2.7 | Duplicate prompt dialog implementations | DialogManager.js L340-564 |
| P2.8 | LayerInjector logger arg discarded | LayerInjector.php L67 |
| P2.9 | SlideHooks isValidColor too weak | SlideHooks.php L315 |
| P2.10 | services.php missing strict_types | services.php |

### Carried from v25-v28

| ID | Issue | File |
|----|-------|------|
| P2.11 | Client SVG regex bypassable | ValidationManager.js L68 |
| P2.12 | sanitizeString strips `<>` | ValidationManager.js L89 |
| P2.13 | ViewerOverlay new Lightbox per click | ViewerOverlay.js L454 |
| P2.14 | editLayerName listener accumulation | LayerPanel.js L1921 |
| P2.15 | EffectsRenderer GPU memory leak | EffectsRenderer.js L253 |
| P2.16 | Callout tailSize not scaled | LayersViewer.js |
| P2.17 | ShadowRenderer no CANVAS_DIM cap | ShadowRenderer.js L427 |
| P2.18 | SlideManager.js dead code | ext.layers.slides/ |
| P2.19 | isForeignFile 3x+ duplication | Multiple Processor files |
| P2.20 | enrichWithUserNames 3x dup | ApiLayersInfo, ApiLayersList |
| P2.21 | ext.layers loaded every page | Hooks.php L85 |
| P2.22 | PropertiesForm hardcoded English | PropertiesForm.js L190 |
| P2.23 | selectAll fallback no filter | SelectionManager.js L341 |
| P2.24 | GradientEditor stale listeners | GradientEditor.js L126 |
| P2.25 | InlineTextEditor no debounce | InlineTextEditor.js L720 |
| P2.26 | Viewer module loaded unconditionally | Hooks.php L85 |
| P2.27 | ApiLayersList missing try/catch | ApiLayersList.php L62 |
| P2.28 | Fallback registry uncached | LayersEditor.js L149 |

---

## ⚠️ P3 — Low Priority Issues (31)

### New in v29

| ID | Issue | File |
|----|-------|------|
| P3.1 | Lightbox singleton at parse time | LayersLightbox.js L500 |
| P3.2 | EventTracker O(n²) removeAll | EventTracker.js L100 |
| P3.3 | PresetStorage no size limit | PresetStorage.js L60 |
| P3.4 | ErrorHandler body in constructor | ErrorHandler.js L55 |
| P3.5 | GradientEditor full DOM rebuild | GradientEditor.js L137 |
| P3.6 | ToolStyles no validation | ToolStyles.js L150 |
| P3.7 | ClipboardController tail offset | ClipboardController.js L221 |
| P3.8 | isValidColor per-call allocation | LayersValidator.js L870 |

### Carried from v25-v28

| ID | Issue | File |
|----|-------|------|
| P3.9 | Dimension offset not scaled | LayersViewer.js |
| P3.10 | init.js crash if class undefined | init.js L84 |
| P3.11 | Lightbox missing '0'/'false' | LayersLightbox.js L237 |
| P3.12 | Image load listener accumulates | LayersViewer.js L271 |
| P3.13 | PropertiesForm anon listeners | PropertiesForm.js L249 |
| P3.14 | Hardcoded slide dimensions | ApiLayersSave.php L460 |
| P3.15 | ts-jest 29.x with Jest 30.x | package.json |
| P3.16 | jest.config.js coverage comment | jest.config.js L35 |
| P3.17 | Webpack library names | webpack.config.js L12 |
| P3.18 | ecmaVersion mismatch | .eslintrc.json |
| P3.19 | eslintIgnore redundant | package.json L63 |
| P3.20 | Dead onParserAfterTidy | WikitextHooks.php L233 |
| P3.21 | Dead isFilePageContext() | WikitextHooks.php L768 |
| P3.22 | Toolbar untracked listeners | Toolbar.js L748, L819 |
| P3.23 | Hex regex accepts 5/7 digits | LayersValidator.js L755 |
| P3.24 | editLayerName stale EventTracker | LayerPanel.js L1920 |
| P3.25 | layersEqual JSON.stringify order | HistoryManager.js L700 |
| P3.26 | getMemoryUsage chars not bytes | HistoryManager.js L770 |
| P3.27 | Color picker DOM leak | PropertiesForm.js L440 |
| P3.28 | DraftManager silent quota UX | DraftManager.js |
| P3.29 | Missing module.exports blocks Jest | LayerPanel/Validator |
| P3.30 | Dimension drag no rAF throttle | TransformController.js |
| P3.31 | Duplicate FK migration patches | sql/patches/ |

---

## Infrastructure Issues (5)

| ID | Severity | Issue | File |
|----|----------|-------|------|
| INFRA-1 | HIGH | FK constraints violate MW conventions | sql/layers_tables.sql |
| INFRA-2 | HIGH | SpecialEditSlide refs non-existent module | SpecialEditSlide.php |
| INFRA-3 | MEDIUM | ext.layers.slides missing 3 files | extension.json |
| INFRA-4 | MEDIUM | Duplicate message keys in extension.json | extension.json |
| INFRA-5 | MEDIUM | phpunit.xml deprecated PHPUnit 9 attrs | phpunit.xml |

---

## Performance Issues (11)

| ID | Severity | Issue | File |
|----|----------|-------|------|
| PERF-1 | HIGH | ext.layers loaded unconditionally | Hooks.php L85 |
| PERF-2 | HIGH | ~~Canvas hash only first/last pts~~ | ✅ FIXED |
| PERF-3 | MEDIUM | SmartGuides stale cache | SmartGuidesController.js |
| PERF-4 | MEDIUM | 6 regex passes per parse | WikitextHooks.php L589 |
| PERF-5 | MEDIUM | InlineTextEditor no debounce | InlineTextEditor.js |
| PERF-6 | MEDIUM | EffectsRenderer temp canvas leak | EffectsRenderer.js |
| PERF-7 | MEDIUM | GradientEditor full DOM rebuild | GradientEditor.js |
| PERF-8 | LOW | json_encode in production logs | WikitextHooks.php L316 |
| PERF-9 | LOW | ViewerManager queries all imgs | ViewerManager.js |
| PERF-10 | LOW | EventTracker O(n²) cleanup | EventTracker.js |
| PERF-11 | LOW | isValidColor per-call allocation | LayersValidator.js |

---

## Documentation Issues (42 total)

### HIGH — Factually Wrong or Misleading (12)

| ID | File | Issue |
|----|------|-------|
| DOC-1 | ARCHITECTURE.md | i18n count 749 (actual 676) |
| DOC-2 | wiki/Home.md | i18n count 749 (actual 676) |
| DOC-3 | README.md | PHPUnit files 24 (actual 31) |
| DOC-4 | ARCHITECTURE.md | PHPUnit files 24 (actual 31) |
| DOC-5 | MW mediawiki | PHPUnit files 24 (actual 31) |
| DOC-6 | wiki/Home.md | PHPUnit files 24 (actual 31) |
| DOC-7 | ARCHITECTURE.md | VERSION 0.8.5 (actual 1.5.52) |
| DOC-8 | ARCHITECTURE.md | Viewer lines ~2,500 (>4,000) |
| DOC-9 | LTS_BRANCH_STRATEGY.md | Main as 1.4.9; 13 tools |
| DOC-10 | THIRD_PARTY_LICENSES.md | 3,731 SVGs (actual 2,817) |
| DOC-11 | copilot-instructions.md | PropertiesForm 914 (994) |
| DOC-12 | UX_STANDARDS_AUDIT.md | v1.1.5 era; features as NOT IMPL |

### MEDIUM — Outdated or Incomplete (16)

| ID | File | Issue |
|----|------|-------|
| DOC-13 | README.md | JS lines 96,886 (actual 96,916) |
| DOC-14 | MW mediawiki | JS/PHP lines stale |
| DOC-15 | SLIDE_MODE.md | "Partially Implemented" |
| DOC-16 | INSTANTCOMMONS_SUPPORT.md | layers= syntax |
| DOC-17 | SHAPE_LIBRARY_PROPOSAL.md | "Proposed" (implemented) |
| DOC-18 | NAMED_LAYER_SETS.md | Proposal language |
| DOC-19 | copilot-instructions.md | ~15 stale line counts |
| DOC-20 | DEVELOPER_ONBOARDING.md | Stale line counts |
| DOC-21 | CSP_GUIDE.md | unsafe-eval in script-src |
| DOC-22 | ACCESSIBILITY.md | Missing keyboard shortcuts |
| DOC-23 | WIKITEXT_USAGE.md | Missing Slide syntax |
| DOC-24 | PROJECT_GOD_CLASS_REDUCTION.md | 20 vs 21 count |
| DOC-25 | wiki/Home.md | REL versions stale |
| DOC-26 | CONTRIBUTING.md | Near-threshold file stale |
| DOC-27 | DOCUMENTATION_UPDATE_GUIDE.md | 11 vs 14 files |
| DOC-28 | CHANGELOG.md v1.5.51 | Says 40 PHP files (39) |

### LOW — Style/Formatting (14)

| ID | File | Issue |
|----|------|-------|
| DOC-29 | README.md | Coverage date inconsistency |
| DOC-30 | ACCESSIBILITY.md | No day in date |
| DOC-31 | NAMED_LAYER_SETS.md | Version: 1.1 ambiguous |
| DOC-32 | RELEASE_GUIDE.md | Example version 1.3.2 |
| DOC-33 | DEBUG_CANVAS_PROPERTIES_PANEL.md | Raw debug log |
| DOC-34 | wiki/Home.md | 15+ What's New sections |
| DOC-35 | CHANGELOG.md | diagnose.php added/removed |
| DOC-36 | POSTMORTEM*.md | THREE vs FOUR |
| DOC-37 | jest.config.js L35 | Coverage says 94.19% |
| DOC-38 | wiki/Home.md | v1.5.49 highlights |
| DOC-39 | NAMED_LAYER_SETS.md | 10-20 sets vs 15 |
| DOC-40 | NAMED_LAYER_SETS.md | Wrong field name |
| DOC-41 | MW mediawiki | Missing bgcolor param |
| DOC-42 | FUTURE_IMPROVEMENTS.md | Numbering/completed |

---

## Test Coverage

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

### Coverage Gaps

| File | Statements | Branches |
|------|-----------|----------|
| SlideController.js | 74.8% | 72.5% |
| RichTextToolbar.js | 83.8% | 72.4% |
| InlineTextEditor.js | 86.3% | 79.0% |
| ext.layers.slides/ | N/A | N/A |

---

## Strategic Risks

### document.execCommand Deprecation (Long-term)

InlineTextEditor.js relies entirely on `document.execCommand`
for rich text formatting. This API is deprecated with no
standardized replacement.

### Smart Guides Cache Invalidation

SmartGuidesController uses reference equality for cache
invalidation. In-place layer mutations return stale snap
points. Currently partially mitigated by rebuild patterns
but fundamentally fragile.

### InlineTextEditor Blur Race Condition

The 250ms setTimeout blur handler allows toolbar clicks to
refocus. If toolbar handling takes >250ms, the editor closes
mid-action. No cancellation mechanism exists.

### Foreign Key Constraints

MySQL foreign keys violate MediaWiki conventions and cause
failures during maintenance/update.php, user merges, and
non-InnoDB engine configurations. ON DELETE CASCADE silently
destroys user content on user deletion.