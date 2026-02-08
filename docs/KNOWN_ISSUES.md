# Known Issues

**Last Updated:** February 7, 2026 (Comprehensive Critical Review v27)
**Version:** 1.5.52

This document lists known issues and current gaps for the Layers
extension. Cross-reference with
[codebase_review.md](../codebase_review.md) and
[improvement_plan.md](../improvement_plan.md) for details and fix
plans.

---

## Status Summary

| Category | Count | Status |
|----------|-------|--------|
| P0 (Critical) | **3** | All ✅ FIXED |
| P1 (High Priority) | **15** | 5 ✅ FIXED, 10 ❌ OPEN |
| P2 (Medium Priority) | **20** | All ❌ OPEN (8 new in v27) |
| P3 (Low Priority) | **17** | Deferred (5 new in v27) |
| Performance | **9** | 2 HIGH, 4 MEDIUM, 3 LOW |
| Documentation | **55** | 20 HIGH, 29 MEDIUM, 6 LOW |

---

## Security Controls Status (v27 — Verified)

| Control | Status | Notes |
|---------|--------|-------|
| CSRF Protection | ✅ PASS | All writes require tokens |
| SQL Injection | ✅ PASS | Parameterized queries |
| Rate Limiting | ✅ PASS | All 5 endpoints, per-role |
| XSS Prevention | ✅ PASS | TextSanitizer iterative removal |
| Input Validation | ✅ PASS | 110+ property strict whitelist |
| Authorization | ✅ PASS | Owner/admin checks; API reads |
| Transaction Safety | ✅ PASS | Atomic + FOR UPDATE locking |
| Boolean Normalization | ✅ PASS | API serialization handled |
| IM File Disclosure | ✅ PASS | `@` stripped, Shell::command escapes all args |
| CSP | ⚠️ PARTIAL | Raw header() bypass |
| SVG Sanitization | ⚠️ PARTIAL | Missing CSS injection vectors |
| User Deletion | ⚠️ RISK | ON DELETE CASCADE destroys user content |
| Diagnostic Tool | ✅ FIXED | diagnose.php deleted |
| shapeData Filtering | ⚠️ INFO | Nested unknown keys not stripped |

---

## Previously Fixed Issues (v22-v26)

All CRITICAL issues from prior reviews verified as fixed:

- v25: 2 CRITICAL (phantom API fixed, callout scaling fixed)
- v25: 4 HIGH (ToolStyles, ValidationManager, text decoration, PresetManager — all fixed)
- v25: 2 MEDIUM (EffectsRenderer logging, getBackgroundVisible — fixed)
- v24: 4 CRITICAL (2 fixed, 2 confirmed false positives)
- v24: 11 HIGH (all fixed)
- v22/v23: All CRITICAL/HIGH fixed

## Confirmed False Positives (v25-v27)

| Claimed Issue | Why It's False |
|---------------|----------------|
| IM color injection via ThumbnailRenderer | Shell::command escapes each arg |
| CSP header injection | $fileUrl from File::getUrl(), not user input |
| Retry on all errors in DB save | Only retries on isDuplicateKeyError() |
| isLayerEffectivelyLocked stale this.layers | Getter delegates to StateManager |
| StateManager.set() locking inconsistency | Correct pattern |
| v24 TypeScript compilation failure | Pure JS project |
| v24 Event Binding Loss | Verified working |

---

## ✅ P0 — Critical Issues (ALL FIXED)

### P0.1 ApiLayersDelete Swallows ApiUsageException

**Ref:** CRIT-v27-1 | **Status:** ✅ FIXED
**File:** src/Api/ApiLayersDelete.php

Added `catch ( \MediaWiki\Api\ApiUsageException $e ) { throw $e; }`
before generic `\Throwable` catch in both execute() and
executeSlideDelete().

---

### P0.2 ApiLayersRename Identical Exception Swallowing

**Ref:** CRIT-v27-2 | **Status:** ✅ FIXED
**File:** src/Api/ApiLayersRename.php

Same fix as P0.1 applied to both execute() and executeSlideRename().

---

### P0.3 diagnose.php Exposed Without Authentication

**Ref:** CRIT-v27-3 | **Status:** ✅ FIXED
**File:** diagnose.php (deleted)

File deleted from the repository entirely.

---

## ❌ P1 — High Priority Issues

### P1.1 ON DELETE CASCADE Silently Destroys User Annotations (NEW v27)

**Ref:** HIGH-v27-1
**File:** sql/layers_tables.sql L19, L29

Both user FKs use `ON DELETE CASCADE`. Deleting a user account
silently cascade-deletes ALL their layer sets and library assets.
MediaWiki normally preserves content from deleted users.

**Fix:** Change to `ON DELETE SET NULL` or `ON DELETE RESTRICT`.

---

### P1.2 ls_name Allows NULL Despite Required Semantics (NEW v27)

**Ref:** HIGH-v27-2
**File:** sql/layers_tables.sql L10

`ls_name varchar(255) DEFAULT NULL` allows NULL values. NULLs
bypass unique key checks (NULL != NULL in SQL). Contradicts
documentation which says `NOT NULL DEFAULT 'default'`.

**Fix:** `ALTER TABLE layer_sets MODIFY ls_name varchar(255) NOT NULL DEFAULT 'default'`

---

### P1.3 isSchemaReady() 23 DB Queries Per API Call (NEW v27)

**Ref:** HIGH-v27-3 | **Status:** ✅ FIXED
**File:** src/Database/LayersSchemaManager.php

Added `$schemaReadyResult` instance cache. Result is cached after
first call; `clearCache()` resets both `schemaCache` and
`schemaReadyResult`.

---

### P1.4 duplicateSelected Only Duplicates Last Selected (NEW v27)

**Ref:** HIGH-v27-4 | **Status:** ✅ FIXED
**File:** resources/ext.layers.editor/LayersEditor.js

Now loops over all selectedIds and creates duplicates for each.
Selects all newly duplicated layers after completion.

---

### P1.5 Triple Source of Truth for Selection State (NEW v27)

**Ref:** HIGH-v27-5
**File:** resources/ext.layers.editor/SelectionManager.js L50, L1115-1125

Selection state kept in 3+ places: `SelectionManager.selectedLayerIds`,
`CanvasManager.selectedLayerIds`, `StateManager('selectedLayerIds')`,
and `SelectionState._selectionState`. Synced via notification but
fragile to bypass.

**Fix:** Consolidate to single canonical source via StateManager.

---

### P1.6 Text Length Limit Inconsistency 1000 vs 500 (NEW v27)

**Ref:** HIGH-v27-6 | **Status:** ✅ FIXED
**File:** resources/ext.layers.editor/LayersValidator.js

Validator now references `limits.MAX_TEXT_LENGTH` from LayerDefaults
(1000 chars), consistent with server-side validation.

---

### P1.7 VALID_LINK_VALUES Drops Editor Link Subtypes (from v26)

**Ref:** HIGH-v26-1
**File:** src/Hooks/Processors/LayersParamExtractor.php L48, L354

`VALID_LINK_VALUES` is `['editor', 'viewer', 'lightbox']` but
downstream methods check for `editor-newtab`, `editor-return`,
`editor-modal`. These values are silently dropped in the
Parsoid/VisualEditor path.

---

### P1.8 Rich Text Word Wrap Uses Wrong Font Metrics (from v26)

**Ref:** HIGH-v26-2
**File:** resources/ext.layers.shared/TextBoxRenderer.js L811, L551

`drawRichTextContent()` calls `wrapText()` with base fontSize only.
Rich text runs with per-run fontSize overrides use wrong measurements.

---

### P1.9 Save Button 2s Timeout Races With Retry (from v26)

**Ref:** HIGH-v26-3 | **Status:** ✅ FIXED
**File:** resources/ext.layers.editor/APIManager.js

Removed 2000ms timer from `disableSaveButton()`. Now relies on
explicit `enableSaveButton()` calls in success and final failure
paths (state-driven, not timer-driven).

---

### P1.10 Clipboard Paste Missing arrowX/arrowY/tailTip Offset (from v26)

**Ref:** HIGH-v26-4 | **Status:** ✅ FIXED
**File:** resources/ext.layers.editor/canvas/ClipboardController.js

Added offset handling for `arrowX`, `arrowY`, `tailTipX`, `tailTipY`
in `applyPasteOffset()`.

---

### P1.11 toggleLayerLock Bypasses StateManager (from v26)

**Ref:** HIGH-v26-5 | **Status:** ✅ FIXED
**File:** resources/ext.layers.editor/LayerPanel.js

Now uses immutable update pattern through `stateManager.set('layers', ...)`
and triggers canvas re-render.

---

### P1.12 TextRenderer Rotation Ignores textAlign (from v25)

**Ref:** HIGH-v25-1
**File:** resources/ext.layers.shared/TextRenderer.js L205-228

Rotation center always assumes left-aligned. Wrong pivot for
center/right aligned text.

---

### P1.13 CSP Header Uses Raw header() (from v25)

**Ref:** HIGH-v25-4
**File:** src/Action/EditLayersAction.php L356-360

Raw PHP `header()` call. Should use MW response API:
`$out->getRequest()->response()->header()`.

---

### P1.14 SVG Validation Missing CSS Injection Vectors (from v25)

**Ref:** HIGH-v25-5
**File:** src/Validation/ServerSideLayerValidator.php ~L1215

Does not block `expression()`, `-moz-binding:url()`, `behavior:`,
or `@import` in SVG style elements. Mitigated by canvas rendering.

---

### P1.15 SlideHooks isValidColor() Weaker Than ColorValidator (from v25)

**Ref:** HIGH-v25-6
**File:** src/Hooks/SlideHooks.php L317

Only 14 named colors, no length limit, no HSL/HSLA.
`ColorValidator` has 148 colors, 50-char limit, HSL/HSLA support.

---

## ❌ P2 — Medium Priority Issues

### New in v27

| ID | Issue | File | Notes |
|----|-------|------|-------|
| P2.1 | SlideManager.js not registered in extension.json | extension.json / resources/ext.layers.slides/ | Dead code (439 lines) never loaded |
| P2.2 | ext.layers.slides excluded from coverage | jest.config.js L21-32 | Zero coverage tracking |
| P2.3 | Duplicate FK migration patches (dead code) | sql/patches/ | Two identical files |
| P2.4 | JSON deep clone on drag/resize start | SelectionManager.js L1085 | Expensive for image layers |
| P2.5 | Spaces allowed in set names | SetNameSanitizer.php L57 | Wikitext ambiguity |
| P2.6 | Duplicate message keys in extension.json | extension.json | 4 keys appear twice |
| P2.7 | BasicLayersTest.test.js tautological | tests/jest/ | Tests mock objects, not source |
| P2.8 | Fallback registry creates instances per get() | LayersEditor.js L149 | No caching |

### Carried from v25/v26

| ID | Issue | File | Notes |
|----|-------|------|-------|
| P2.9 | UIHooks over-engineered ~200→~40 lines | UIHooks.php L30-233 | Dead MW 1.44+ guards |
| P2.10 | 6 regex passes per parse | WikitextHooks.php L589-744 | Performance |
| P2.11 | ApiLayersList missing try/catch | ApiLayersList.php L62-121 | Raw DB errors |
| P2.12 | LayeredFileRenderer Exception not Throwable | LayeredFileRenderer.php L112 | TypeError uncaught |
| P2.13 | InlineTextEditor no input debouncing | InlineTextEditor.js L720 | High CPU on typing |
| P2.14 | isForeignFile/getFileSha1 6x duplication | Multiple Processor files | Trait exists but unused |
| P2.15 | enrichWithUserNames 3x duplication | ApiLayersInfo, ApiLayersList, UIHooks | Slightly different logic |
| P2.16 | GradientEditor stale event listeners | GradientEditor.js L126 | Memory leak on rebuild |
| P2.17 | ext.layers loaded every page | Hooks.php ~L88, ~L262 | Unconditional addModules |
| P2.18 | APIManager catch signature | APIManager.js L1130 | (code, data) not Error |
| P2.19 | PropertiesForm hardcoded English | PropertiesForm.js L195-220 | Not internationalized |
| P2.20 | selectAll fallback doesn't filter | SelectionManager.js L341 | Selects locked/invisible |

---

## ⚠️ P3 — Low Priority Issues (17)

### New in v27

| ID | Issue | File | Notes |
|----|-------|------|-------|
| P3.1 | ts-jest 29.x incompatible with Jest 30.x | package.json L52 | Unused dependency |
| P3.2 | jest.config.js coverage comment stale | jest.config.js L35 | Says 94.19% |
| P3.3 | Webpack library names awkward | webpack.config.js L12 | `Layersext.layers.editor` |
| P3.4 | ecmaVersion mismatch (2022 vs 2020) | .eslintrc.json L8, L118 | Source vs test |
| P3.5 | eslintIgnore in package.json redundant | package.json L63-67 | Already in .eslintrc.json |

### Carried from v26

| ID | Issue | File | Notes |
|----|-------|------|-------|
| P3.6 | Dead onParserAfterTidy method | WikitextHooks.php L233 | Empty, unregistered |
| P3.7 | Dead isFilePageContext() | WikitextHooks.php L768 | Never called |
| P3.8 | Toolbar untracked listeners | Toolbar.js L748, L819 | Raw addEventListener |
| P3.9 | Hex regex accepts 5/7 digits | LayersValidator.js L755 | Fallback path only |
| P3.10 | editLayerName stale EventTracker | LayerPanel.js L1920 | Slow memory leak |
| P3.11 | layersEqual JSON.stringify order | HistoryManager.js L700 | False positive warnings |
| P3.12 | getMemoryUsage chars not bytes | HistoryManager.js L770 | Unicode undercount |
| P3.13 | Color picker DOM leak | PropertiesForm.js L440 | Orphaned input |
| P3.14 | md5(uniqid(mt_rand())) for IDs | ThumbnailProcessor.php L366 | Counter would suffice |
| P3.15 | DraftManager silent quota fail | DraftManager.js saveDraft | No user notification |
| P3.16 | Missing module.exports | LayerPanel.js, LayersValidator.js | Blocks Jest |
| P3.17 | Dimension drag not rAF-throttled | TransformController.js | Sync render |

---

## Performance Issues

| ID | Severity | Issue | File |
|----|----------|-------|------|
| PERF-1 | HIGH | isSchemaReady() 23 DB queries, no cache | LayersSchemaManager.php L260 |
| PERF-2 | HIGH | TextRenderer shadow O(n) fillText | TextRenderer.js L247 |
| PERF-3 | MEDIUM | 6 regex passes per parse | WikitextHooks.php L589 |
| PERF-4 | MEDIUM | InlineTextEditor no debounce | InlineTextEditor.js L720 |
| PERF-5 | MEDIUM | SelectionManager JSON clone on drag | SelectionManager.js ~L1085 |
| PERF-6 | MEDIUM | LayersViewer JSON clone/frame | LayersViewer.js ~L532 |
| PERF-7 | LOW | Checker pattern rects | CanvasRenderer.js ~L550 |
| PERF-8 | LOW | ViewerManager all img query | ViewerManager.js ~L410 |
| PERF-9 | LOW | Layer hash temp arrays/frame | CanvasRenderer.js ~L165 |

---

## Documentation Issues (55 total)

### HIGH — Factually Wrong or Misleading (20)

| ID | File | Issue |
|----|------|-------|
| DOC-1 | Multiple docs | God class count says 19 — actual 21 |
| DOC-2 | wiki/Home.md | v1.5.52 "What's New" wrong features |
| DOC-3 | wiki/Home.md | v1.5.51 features misattributed |
| DOC-4 | wiki/Home.md | v1.5.49 features fabricated |
| DOC-5 | copilot-instructions.md | PHP files: 40 → actual 39 |
| DOC-6 | copilot-instructions.md | DialogManager.js ~420 → actual 736 |
| DOC-7 | copilot-instructions.md | LayersViewer.js wrong path/size |
| DOC-8 | copilot-instructions.md | `callout` missing from type enum |
| DOC-9 | copilot-instructions.md | ResizeCalculator is 1,017 not ~995 (god class) |
| DOC-10 | copilot-instructions.md | ShapeRenderer is 1,010 not ~995 (god class) |
| DOC-11 | docs/ARCHITECTURE.md | VERSION shows '0.8.5' not 1.5.52 |
| DOC-12 | docs/ARCHITECTURE.md | Controller table counts stale |
| DOC-13 | docs/ARCHITECTURE.md | Viewer "~2,500 lines" → 4,000+ |
| DOC-14 | docs/LTS_BRANCH_STRATEGY.md | Shows main as "1.4.9" not 1.5.52 |
| DOC-15 | docs/LTS_BRANCH_STRATEGY.md | Says "13 tools" not 15 |
| DOC-16 | THIRD_PARTY_LICENSES.md | 3,731 emoji SVGs vs 2,817 |
| DOC-17 | docs/GOD_CLASS_REFACTORING_PLAN.md | Header says 19, body says 21 |
| DOC-18 | docs/SLIDE_MODE.md | lock param documented but unimplemented |
| DOC-19 | wiki/Architecture-Overview.md | Table name `layers_sets` vs actual `layer_sets` |
| DOC-20 | wiki/Architecture-Overview.md | Schema `ls_data MEDIUMBLOB` vs actual `ls_json_blob mediumblob` |

### MEDIUM — Outdated or Incomplete (29)

| ID | File | Issue |
|----|------|-------|
| DOC-21 | README.md | Tool heading "15" but table has 16 rows |
| DOC-22 | README.md, mediawiki | Missing Slide Mode configs |
| DOC-23 | copilot-instructions.md | ~~JS lines ~96,619 → actual 96,856~~ FIXED (updated to ~96,886) |
| DOC-24 | copilot-instructions.md | ~~PHP lines ~14,946 → actual 15,009~~ FIXED (updated to ~15,034) |
| DOC-25 | copilot-instructions.md | Several module line counts stale |
| DOC-26 | docs/ARCHITECTURE.md | Facade table counts stale |
| DOC-27 | docs/ARCHITECTURE.md | File tree counts stale |
| DOC-28 | docs/NAMED_LAYER_SETS.md | Proposal language despite implemented |
| DOC-29 | docs/NAMED_LAYER_SETS.md | "10-20 sets" but default is 15 |
| DOC-30 | docs/SLIDE_MODE.md | "Partially Implemented" but complete |
| DOC-31 | docs/SLIDE_MODE.md | Phase 4 "v1.6.0"; current is 1.5.52 |
| DOC-32 | docs/FUTURE_IMPROVEMENTS.md | Completed items retain full plans |
| DOC-33 | docs/FUTURE_IMPROVEMENTS.md | Section numbering inconsistent |
| DOC-34 | docs/ACCESSIBILITY.md | Missing Marker/Dimension shortcuts |
| DOC-35 | docs/WIKITEXT_USAGE.md | Missing {{#Slide:}} syntax |
| DOC-36 | docs/INSTANTCOMMONS_SUPPORT.md | Uses deprecated `layers=` not `layerset=` |
| DOC-37 | docs/RELEASE_GUIDE.md | Example version 1.3.2 outdated |
| DOC-38 | docs/API.md | Name misleading (JSDoc not HTTP API) |
| DOC-39 | docs/CSP_GUIDE.md | `'unsafe-eval'` in recommended CSP |
| DOC-40 | docs/PROJECT_GOD_CLASS_REDUCTION.md | Test count "10,840+" stale |
| DOC-41 | docs/PROJECT_GOD_CLASS_REDUCTION.md | God class target mismatched |
| DOC-42 | README.md | Coverage date inconsistency |
| DOC-43 | docs/DOCUMENTATION_UPDATE_GUIDE.md | "11 Files Rule" but 14 steps |
| DOC-44 | CONTRIBUTING.md | Near-threshold list incomplete |
| DOC-45 | SECURITY.md | No Slide Mode security section |
| DOC-46 | docs/DEVELOPER_ONBOARDING.md | Stale module line counts |
| DOC-47 | wiki/Home.md | 15+ What's New sections (archive needed) |
| DOC-48 | wiki/Contributing-Guide.md | Says MW 1.39+ but main requires 1.44+ |
| DOC-49 | wiki/Frontend-Architecture.md | Controller line counts 30-50% off |

### LOW — Style/Formatting (6)

| ID | File | Issue |
|----|------|-------|
| DOC-50 | CHANGELOG.md | Unreleased exact test count stale |
| DOC-51 | docs/ACCESSIBILITY.md | "February 2026" without day |
| DOC-52 | docs/NAMED_LAYER_SETS.md | "Version: 1.1" ambiguous |
| DOC-53 | docs/RELEASE_GUIDE.md | History table has one entry |
| DOC-54 | docs/FUTURE_IMPROVEMENTS.md | Completed FR-16 full plan retained |
| DOC-55 | docs/UX_STANDARDS_AUDIT.md | Says "11 tools" and "v1.1.5" — heavily stale |

---

## Test Coverage

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statement | 95.19% | 90% | ✅ Exceeds |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ Exceeds |
| Lines | 95.32% | 90% | ✅ Exceeds |

### Coverage Gaps

| File | Statements | Branches | Functions |
|------|-----------|----------|-----------|
| SlideController.js | 74.8% | 72.5% | 85.1% |
| RichTextToolbar.js | 83.8% | 72.4% | 66.1% |
| InlineTextEditor.js | 86.3% | 79.0% | 77.1% |
| ext.layers.slides/ | N/A | N/A | N/A (not collected) |

---

## Strategic Risks

### document.execCommand Deprecation (Long-term)

InlineTextEditor.js relies entirely on `document.execCommand` for
rich text formatting (bold, italic, foreColor, hiliteColor, fontSize).
This API is [deprecated](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
with no standardized replacement. Begin planning migration to
Selection/Range API with manual DOM manipulation.

### Smart Guides Cache Invalidation

SmartGuidesController uses reference equality for cache invalidation.
If layers are mutated in-place (push/splice rather than new array),
snap guides reference stale positions. Currently mitigated by
patterns that create new arrays, but fragile against future changes.

### InlineTextEditor Blur Race Condition

The 250ms setTimeout in the blur handler allows toolbar clicks to
refocus the editor. If toolbar handling takes >250ms (GC pause,
slow machine), the editor closes mid-action. No cancellation
mechanism exists for reopening within the window.
