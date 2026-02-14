# Layers Extension — Improvement Plan

**Last updated:** February 13, 2026 — v37 fresh audit (version 1.5.57)

This plan organizes all open issues from the codebase review into
prioritized phases with effort estimates. Each phase targets related
issues for efficient batching.

---

## Phase Summary

| Phase | Focus | Items | Fixed | Open | Est. Effort |
|-------|-------|-------|-------|------|-------------|
| 1 | Critical bugs & data safety | 14 | 14 | 0 | — |
| 2 | Security hardening | 8 | 8 | 0 | — |
| 3 | Reliability & correctness | 12 | 12 | 0 | — |
| 4 | Code quality & dead code | 10 | 8 | 2 | 6-8 hours |
| 5 | Performance | 5 | 5 | 0 | — |
| 6 | Infrastructure | 5 | 5 | 0 | — |
| 7 | Documentation debt | 42 | 7 | 35 | 4-6 hours |
| 8 | v35 findings (security + bugs) | 19 | 19 | 0 | — |
| 9 | v36 findings (code + testing) | 25 | 16 | 9 | 2-4 hours |
| 10 | v37 findings (validation + quality) | 3 | 0 | 3 | 1-2 hours |
| **Total** | | **143** | **94** | **49** | **12-18 hrs** |

---

## Phase 1: Critical Bugs & Data Safety — ✅ ALL COMPLETE

*All 14 items fixed across v27–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 1.1 | ON DELETE CASCADE destroys user content | P1-011 | ✅ Fixed v34 |
| 1.2 | ls_name allows NULL in schema | P1-012 | ✅ Fixed v34 |
| 1.3 | Triple source of truth for selection | P1-013 | ✅ Fixed v34 |
| 1.4 | Rich text word wrap wrong font metrics | P1-014 | ✅ Fixed v34 |
| 1.5 | ThumbnailRenderer shadow blur corrupts canvas | P1-015 | ✅ Done |
| 1.6 | SQLite-incompatible schema migrations | P1-016 | ✅ Fixed v34 |
| 1.7 | ShadowRenderer discards scale on rotation | P1-017 | ✅ Fixed v34 |
| 1.8 | DimensionRenderer hitTest ignores offset | P1-018 | ✅ Fixed v34 |
| 1.9 | APIManager saveInProgress stuck on throw | P1-019 | ✅ Fixed v34 |
| 1.10 | PresetStorage strips gradient data | P1-020 | ✅ Fixed v34 |
| 1.11 | groupSelected() passes object not ID | P0-001 | ✅ Fixed v28 |
| 1.12 | HitTest fails on rotated shapes | P1-005 | ✅ Fixed v29 |
| 1.13 | normalizeLayers mutates input | P1-008 | ✅ Fixed v29 |
| 1.14 | isSchemaReady 23 uncached queries | P1-009 | ✅ Fixed v27 |

---

## Phase 2: Security Hardening — ✅ ALL COMPLETE

*All 8 items fixed across v28–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 2.1 | Toolbar innerHTML with .text() | P2-014 | ✅ Fixed v34 |
| 2.2 | Client SVG sanitization regex bypassable | P2-007 | ✅ Done |
| 2.3 | sanitizeString strips `<>` destroying math | P2-008 | ✅ Fixed v34 |
| 2.4 | window.open without noopener | P2-017 | ✅ Fixed v34 |
| 2.5 | init.js event listener accumulation | P2-015 | ✅ Fixed v34 |
| 2.6 | Hardcoded 'Anonymous' not i18n | P3-005 | ✅ Fixed v34 |
| 2.7 | ThumbnailRenderer Exception not Throwable | P3-004 | ✅ Fixed v34 |
| 2.8 | checkSizeLimit .length vs bytes | P3-007 | ✅ Fixed v34 |

---

## Phase 3: Reliability & Correctness — ✅ ALL COMPLETE

*All 12 items fixed across v27–v34.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 3.1 | SmartGuides cache stale on mutations | P2-009 | ✅ Fixed v34 |
| 3.2 | ImageLoader timeout orphaned on success | P2-016 | ✅ Fixed v34 |
| 3.3 | TextBoxRenderer wrapText no long word break | P2-019 | ✅ Fixed v34 |
| 3.4 | ApiLayersSave redundant token parameter | P2-020 | ✅ Fixed v34 |
| 3.5 | LayersSchemaManager bypasses DI | P2-021 | ✅ Fixed v34 |
| 3.6 | enrichWithUserNames duplicated | P2-013 | ✅ Fixed v34 |
| 3.7 | StateManager malformed JSDoc | P3-003 | ✅ Fixed v34 |
| 3.8 | ApiLayersList missing unset() | P3-001 | ✅ Fixed v34 |
| 3.9 | CalloutRenderer blur clips L/R tails | — | ✅ Fixed v31 |
| 3.10 | closeAllDialogs leaks handlers | — | ✅ Fixed v30 |
| 3.11 | LayerInjector logger arg | — | ✅ Fixed v30 |
| 3.12 | SlideHooks isValidColor too weak | — | ✅ Fixed v30 |

---

## Phase 4: Code Quality & Dead Code

*8 of 10 items fixed. God class reduction is ongoing.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 4.1 | SlideManager.js dead code (~439 lines) | P2-006 | ✅ Fixed |
| 4.2 | ToolManager 400+ lines dead fallbacks | P2-010 | ✅ Fixed |
| 4.3 | HistoryManager duck-type constructor | P2-011 | ✅ Fixed v34 |
| 4.4 | Duplicate prompt dialog implementations | P2-012 | ✅ Done |
| 4.5 | UIHooks unused variables | P3-002 | ✅ Fixed v34 |
| 4.6 | ImageLayerRenderer djb2 collision risk | P3-006 | ✅ By Design |
| 4.7 | God class reduction (12 JS files >1K) | — | 🔄 In Progress |
| 4.8 | Remove ext.layers.slides dead module | P2-024 | ✅ Fixed |
| 4.9 | Duplicate message keys in extension.json | P2-025 | ✅ Done |
| 4.10 | phpunit.xml deprecated attributes | P2-026 | ✅ Fixed v34 |

---

## Phase 5: Performance — ✅ ALL COMPLETE

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 5.1 | ShadowRenderer/EffectsRenderer temp canvas | P2-018 | ✅ Fixed v34 |
| 5.2 | ext.layers loaded every page | P2-005 | ✅ Fixed v34 |
| 5.3 | Canvas reuse pool for renderers | — | ✅ Fixed v34 |
| 5.4 | SmartGuides spatial index | — | ✅ Closed |
| 5.5 | Lazy-load viewer overlay | — | ✅ Closed |

---

## Phase 6: Infrastructure — ✅ ALL COMPLETE

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 6.1 | Foreign key constraints violate MW conventions | P2-022 | ✅ Fixed v34 |
| 6.2 | SpecialEditSlide references missing module | P2-023 | ✅ Done |
| 6.3 | ext.layers.slides incomplete module | P2-024 | ✅ Fixed |
| 6.4 | SQLite migration compatibility | P1-016 | ✅ Fixed v34 |
| 6.5 | Schema NULL constraint for ls_name | P1-012 | ✅ Fixed v34 |

---

## Phase 7: Documentation Debt (42 Items)

*Target: Bring all documentation into sync with actual codebase state.
7 items resolved in v35; 35 still open.*

### 7A: Version & Metrics Sync (20 items, ~2 hours)

Update stale version numbers, line counts, test counts, and i18n
counts across all documentation files. See the full breakdown in
codebase_review.md § Documentation Debt Summary.

Key files requiring updates:
- README.md (badge, PHPUnit count, line counts)
- docs/ARCHITECTURE.md (version, i18n count 816, line counts)
- .github/copilot-instructions.md (version, god class counts)
- wiki/Home.md (i18n count, PHPUnit count)
- Mediawiki-Extension-Layers.mediawiki (version, line counts)
- docs/LTS_BRANCH_STRATEGY.md (version)
- docs/SLIDE_MODE.md (version)
- wiki/Installation.md (says 1.5.52!)
- God class count: Documents say 21; actual is 16 (P3-028)
- i18n count: Documents say 731-741; actual is 816 (P3-013)

### 7B: Stale Documents (10 items, ~2 hours)

| Document | Action | Status |
|----------|--------|--------|
| docs/UX_STANDARDS_AUDIT.md | Major rewrite or archive | ✅ Resolved v35 |
| docs/SHAPE_LIBRARY_PROPOSAL.md | Rename; update status | ✅ Resolved v35 |
| docs/SLIDE_MODE.md | Update implementation status | ✅ Resolved v35 |
| docs/INSTANTCOMMONS_SUPPORT.md | Fix `layers=on` → `layerset=on` | ✅ Resolved v35 |
| docs/NAMED_LAYER_SETS.md | Major rewrite (see P2-038) | ❌ Open |
| docs/ARCHITECTURE.md | Fix VERSION code sample | ✅ Resolved v35 |
| docs/FUTURE_IMPROVEMENTS.md | Fix numbering; move completed | ❌ Open |
| CHANGELOG.md | Add v1.5.53, v1.5.54 entries | ❌ Open |
| wiki/Changelog.md | Mirror CHANGELOG.md (37% gap) | ❌ Open |
| README.md | Fix `bgcolor=` → `background=` | ✅ Resolved v35 |

### 7C: Cross-Reference Consistency (12 items, ~1 hour)

Systematic pass to align all metric references. Use
docs/DOCUMENTATION_UPDATE_GUIDE.md as the checklist. See
P3-011 through P3-032 in KNOWN_ISSUES.md for the full list.

### 7D: MediaWiki Table Documentation (3 items) — NEW in v36

Three table documentation files are stale:
- Mediawiki-layer_sets-table.mediawiki — missing ls_name, ls_base_width,
  ls_base_height columns
- Mediawiki-layer_assets-table.mediawiki — table never created but
  file documents it as if it exists
- Mediawiki-layer_set_usage-table.mediawiki — table never created
  but file documents it as if it exists

### 7E: Wiki Configuration Documentation (1 item) — NEW in v36

- wiki/Configuration-Reference.md shows `LayersDebug` default as
  `true`; actual default in extension.json is `false`.

---

## Phase 8: v35 Findings — ✅ ALL COMPLETE

*All 19 items fixed in v35. See KNOWN_ISSUES.md P1-021→P1-025,
P2-027→P2-031, P3-033→P3-041 for details.*

| # | Issue | Ref | Status |
|---|-------|-----|--------|
| 8.1 | OverflowException double endAtomic | P1-021 | ✅ Fixed v35 |
| 8.2 | TextSanitizer html_entity_decode after strip_tags | P1-022 | ✅ Fixed v35 |
| 8.3 | EditLayersAction clickjacking via ?modal=true | P1-023 | ✅ Not a bug |
| 8.4 | ApiLayersList database error info disclosure | P1-024 | ✅ Fixed v35 |
| 8.5 | ThumbnailRenderer visible === false ignores 0 | P2-027 | ✅ Fixed v35 |
| 8.6 | $set param ignored in layerEditParserFunction | P2-028 | ✅ Fixed v35 |
| 8.7 | RevisionManager UTC timestamps as local | P2-029 | ✅ Fixed v35 |
| 8.8 | EditorBootstrap conditional global | P2-030 | ✅ Not a bug |
| 8.9 | CanvasRenderer _blurTempCanvas not cleaned | P2-031 | ✅ Fixed v35 |
| 8.10 | SHA1 fallback outside trait | P3-033 | ✅ Fixed v35 |
| 8.11 | SchemaManager CURRENT_VERSION stale | P3-034 | ✅ Fixed v35 |
| 8.12 | ImageLayerRenderer stale cache on src | P3-035 | ✅ Fixed v35 |
| 8.13 | DimensionRenderer hitTest fallback mismatch | P3-036 | ✅ Fixed v35 |
| 8.14 | ColorValidator alpha regex gap | P3-037 | ✅ Fixed v35 |
| 8.15 | WikitextHooks info→debug log level | P3-038 | ✅ Fixed v35 |
| 8.16 | EditLayersAction dead MW < 1.44 code | P3-039 | ✅ Fixed v35 |
| 8.17 | ErrorHandler retryOperation no-op | P3-040 | ✅ Fixed v35 |
| 8.18 | LayersLightbox hardcoded English alt | P3-041 | ✅ Fixed v35 |
| 8.19 | RichText fontSize overwritten on deselect | P1-025 | ✅ Fixed v35 |

---

## Phase 9: v36 Findings — Code, Testing & Infrastructure (25 Items)

*Target: Fix new HIGH-priority correctness bugs, testing gaps,
and medium/low issues discovered in the v36 comprehensive review.
16 of 25 items fixed; 5 closed as false positive/by design;
4 remaining are documentation or style.*

### 9A: HIGH Priority (6 items) — ✅ ALL COMPLETE

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.1 | ClipboardController paste() bypasses StateManager | P1-026 | ✅ Fixed v36 | 30m |
| 9.2 | RenderCoordinator hash omits rendering properties | P1-027 | ✅ Fixed v36 | 45m |
| 9.3 | SecurityAndRobustness.test.js tests mocks not code | P1-028 | ✅ Fixed v36 | 2h |
| 9.4 | PHPUnit version mismatch (^9.5 vs 10.5 schema) | P1-029 | ✅ Fixed v36 | 30m |
| 9.5 | npm test --force bypasses lint failures | P1-030 | ✅ Fixed v36 | 15m |
| 9.6 | ErrorHandler auto-reload loses unsaved work | P1-031 | ✅ Fixed v36 | 30m |

#### 9.1 Fix: ClipboardController paste() (P1-026)

**File:** ClipboardController.js L96-113

Replace direct array mutation with StateManager call:
```javascript
// ❌ Current (bypasses StateManager)
editor.layers.unshift(clone);
editor.selectionManager.deselectAll();
editor.selectionManager.selectLayer(clone);

// ✅ Fix (uses StateManager)
editor.stateManager.addLayer(clone, 0);
editor.selectionManager.deselectAll();
editor.selectionManager.selectLayer(clone);
```

Note: cutSelected() at L138-142 already correctly uses
`editor.stateManager.removeLayer(layer)`, proving the
inconsistency.

#### 9.2 Fix: RenderCoordinator Hash (P1-027)

**File:** RenderCoordinator.js L199-213

Current hash only includes: id, x, y, width, height, rotation,
visible, opacity. Add all rendering-affecting properties:

```javascript
// Add to hash computation:
hash += (l.fill || '') + '|' + (l.stroke || '') + '|'
    + (l.text || '') + '|' + (l.fontSize || '') + '|'
    + (l.fontFamily || '') + '|' + (l.strokeWidth || '') + '|'
    + (l.shadow ? '1' : '0') + '|' + (l.src ? l.src.length : 0);
```

Alternative: Use a version counter on layer mutations
(StateManager already increments on changes) so any mutation
triggers redraw without listing all properties.

#### 9.3 Fix: SecurityAndRobustness Tests (P1-028)

**File:** tests/jest/SecurityAndRobustness.test.js

This is the most significant testing gap. The file has zero
`require()` calls — every test creates inline mock objects and
asserts against those mocks. Two recommended approaches:

1. **Preferred:** Delete the file entirely. The existing focused
   test suites (LayersValidator.test.js, ErrorHandler.test.js,
   ValidationManager.test.js) already test the actual code with
   real require() imports and provide genuine coverage.

2. **Alternative:** Rewrite to require actual source modules:
```javascript
const LayersValidator = require('../../resources/ext.layers.editor/LayersValidator');
// Then test actual validator behavior
```

#### 9.4 Fix: PHPUnit Version Mismatch (P1-029)

**Files:** composer.json L8, phpunit.xml L3

The composer.json requires `"phpunit/phpunit": "^9.5"` but
phpunit.xml uses `xsi:noNamespaceSchemaLocation` pointing to
PHPUnit 10.5 schema, plus PHPUnit 10 features like
`cacheDirectory` and `requireCoverageMetadata`.

Additionally, HooksTest.php uses `withConsecutive()` which was
removed in PHPUnit 10.

**Fix:** Upgrade composer.json to `"^10.5"` and replace
`withConsecutive()` in HooksTest.php with sequential
`willReturn()`/`expects($this->exactly(N))`.

#### 9.5 Fix: npm test --force (P1-030)

**File:** package.json L6

```json
// ❌ Current — lint failures don't block CI
"test": "grunt test --force",

// ✅ Fix — lint failures are blocking
"test": "grunt test",
```

Before removing `--force`, run `npm test` to identify all
existing warnings and fix them first.

#### 9.6 Fix: ErrorHandler Auto-Reload (P1-031)

**File:** ErrorHandler.js L462-489

Canvas errors trigger `window.location.reload()` after 2s. But
DraftManager auto-saves every 30s. If error occurs between
auto-saves, unsaved work is lost without user consent.

```javascript
// ❌ Current
setTimeout(() => {
    window.location.reload();
}, 2000);

// ✅ Fix — save draft before reload
if (this.editor && this.editor.draftManager) {
    this.editor.draftManager.saveDraft();
}
setTimeout(() => {
    window.location.reload();
}, 2000);
```

### 9B: MEDIUM Priority (7 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.7 | ErrorHandler singleton lifecycle mismatch | P2-032 | ✅ False Positive | — |
| 9.8 | InlineTextEditor blur setTimeout not tracked | P2-033 | ✅ Fixed v36 | 10m |
| 9.9 | No default rate limits in extension.json | P2-034 | ✅ Not a Bug | — |
| 9.10 | CanvasManager JSON.parse/stringify per frame | P2-035 | ✅ Overstated | — |
| 9.11 | HistoryManager JSON.stringify for richText | P2-036 | ✅ Low Impact | — |
| 9.12 | ext.layers.slides excluded from Jest coverage | P2-037 | ✅ Fixed v36 | 5m |
| 9.13 | NAMED_LAYER_SETS.md stale throughout | P2-038 | ❌ Open | 1h |

#### Quick Wins (9B)

**P2-032 (singleton):** In EditorBootstrap constructor, add:
```javascript
if (!window.layersErrorHandler) {
    window.layersErrorHandler = new ErrorHandler(this);
}
```

**P2-033 (blur timer):** Assign return value and clear in cleanup:
```javascript
// In _handleBlur:
this._blurTimeout = setTimeout(() => { ... }, 250);
// In _removeEventHandlers:
clearTimeout(this._blurTimeout);
```

**P2-035 (JSON per frame):** Replace with structuredClone() or the
project's DeepClone utility at CanvasManager.js L799.

**P2-037 (slides coverage):** Add to jest.config.js
collectCoverageFrom array:
```javascript
'resources/ext.layers.slides/**/*.js'
```

### 9C: LOW Priority (12 items)

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 9.14 | console.log in Toolbar.js unguarded | P3-042 | ✅ Fixed v36 | 5m |
| 9.15 | ValidationManager not wrapped in IIFE | P3-043 | ❌ Open (style) | 10m |
| 9.16 | AlignmentController getCombinedBounds wrong | P3-044 | ✅ Fixed v36 | 10m |
| 9.17 | HistoryManager cancelBatch double redraws | P3-045 | ✅ Fixed v36 | 10m |
| 9.18 | InlineTextEditor optional chaining (ES2020) | P3-046 | ✅ Fixed v36 | 10m |
| 9.19 | ViewerManager custom properties on DOM | P3-047 | ✅ False Positive | — |
| 9.20 | ts-jest version incompatible / unused | P3-048 | ✅ Fixed v36 | 5m |
| 9.21 | Gruntfile ESLint cache disabled | P3-049 | ✅ Fixed v36 | 5m |
| 9.22 | Test files not linted by Grunt | P3-050 | ❌ Open (by design) | — |
| 9.23 | PHP tests use only existence assertions | P3-051 | ❌ Open (low value) | 30m |
| 9.24 | SchemaManager CURRENT_VERSION stale (1.5.56) | P3-052 | ✅ Fixed v36 | 5m |
| 9.25 | RichTextConverter innerHTML for HTML parsing | P3-053 | ❌ Open (academic) | — |

#### Quick Wins (9C)

**P3-042 (console.log):** Wrap in debug guard or use `mw.log`.

**P3-048 (ts-jest):** `npm uninstall ts-jest` — not used anywhere.

**P3-049 (ESLint cache):** Change `cache: false` to `cache: true`
in Gruntfile.js L14.

**P3-052 (CURRENT_VERSION):** Update constant string to `'1.5.57'`
in LayersSchemaManager.php.

---

## Phase 10: v37 Findings — Validation & Code Quality (3 Items)

*Target: Fix missing validation consistency and code quality issues
discovered in the v37 comprehensive review.*

### 10A: MEDIUM Priority (1 item) — ❌ OPEN

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 10.1 | Missing SlideNameValidator in API modules | P2-039 | ❌ Open | 15m |

#### 10.1 Fix: Add SlideNameValidator (P2-039)

**Files:** ApiLayersInfo.php, ApiLayersRename.php

Add SlideNameValidator to executeSlideRequest() and
executeSlideRename() for consistency with ApiLayersSave and
ApiLayersDelete:

```php
// Add to ApiLayersInfo.php executeSlideRequest():
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;

// At start of executeSlideRequest():
$validator = new SlideNameValidator();
if ( !$validator->isValid( $slidename ) ) {
    $this->dieWithError( LayersConstants::ERROR_INVALID_SLIDENAME, 'invalidslidename' );
}
```

Same pattern for ApiLayersRename::executeSlideRename().

### 10B: LOW Priority (2 items) — ❌ OPEN

| # | Issue | Ref | Status | Effort |
|---|-------|-----|--------|--------|
| 10.2 | Untracked setTimeout in PropertiesForm | P3-054 | ❌ Open | 20m |
| 10.3 | Same pattern in PropertyBuilders | P3-055 | ❌ Open | 20m |

#### 10.2-10.3 Fix: Track setTimeout Handlers

**Files:** PropertiesForm.js L316, PropertyBuilders.js L273

Add timeout tracking to both files:

```javascript
// In constructor:
this._pendingTimeouts = [];

// When setting timeout:
this._pendingTimeouts.push( setTimeout( function() { ... }, 100 ) );

// In destroy/cleanup method:
if ( this._pendingTimeouts ) {
    this._pendingTimeouts.forEach( clearTimeout );
    this._pendingTimeouts = [];
}
```

---

## Recommended Execution Order

1. **Phase 10A first** (MEDIUM): ~15 minutes
   - P2-039 (SlideNameValidator) — validation consistency
2. **Phase 9 remainder** (docs, style, academic)
3. **Phase 10B** (LOW): ~40 minutes
   - P3-054, P3-055 (setTimeout tracking)
4. **Phase 7A**: Version/metrics sync across 10+ docs (~2 hours)
5. **Phase 7B-E**: Stale documents, wiki sync, config doc
6. **Phase 4.7**: God class reduction (ongoing)

---

## Progress Tracking

When an issue is fixed:
1. Mark it ✅ in this plan with the version number
2. Update docs/KNOWN_ISSUES.md status
3. Add a CHANGELOG.md entry
4. Add regression test(s) where applicable
5. Run `npm test` and `npm run test:js` to verify no regressions

---

## Change Log

| Date | Changes |
|------|---------|
| 2026-02-13 | v37: Fresh comprehensive audit. Added Phase 10 with 3 new items (1 MED validation, 2 LOW code quality). 3 false positives excluded. 11,139 tests, 163 suites. Grade: A (maintained). |
| 2026-02-13 | v36 fixes: Fixed 16 of 25 Phase 9 items (all 6 HIGH, 2 MED, 8 LOW). |
| 2026-02-13 | v36: Fresh comprehensive review. Added Phase 9 with 25 new items. |
| 2026-02-11 | v35: Fresh comprehensive review. Added Phase 8 with 19 new items. |
| 2026-02-10 | v34 (batch 3): Fixed 6 more issues. Phase 2 100% complete. |
| 2026-02-10 | v34: Fixed 23+ issues. DB schema patches, SmartGuides. |
| 2026-02-09 | v33: Fresh comprehensive review. Added 4 P1, 8 P2, 7 P3. |
| 2026-02-08 | v29: Added Phases 5-6, infrastructure items, 42 doc issues. |
| 2026-02-08 | v28: Restructured from v27 findings. |
| 2026-02-07 | v27: Initial improvement plan. |
