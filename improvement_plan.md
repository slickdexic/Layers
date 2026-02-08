# Improvement Plan

**Last Updated:** February 7, 2026 (v27 Review)
**Version:** 1.5.52
**Overall Grade:** B

---

## Executive Summary

The Layers extension is a mature, well-tested codebase at 95.19%
statement coverage (84.96% branch). The security posture is strong
for core controls (CSRF, SQL injection, rate limiting, input
validation, transaction safety). 21 god classes exist (17 JS
hand-written, 2 generated data, 2 PHP) but all use proper
delegation patterns.

The v27 review discovered **3 critical issues** and **15 high-priority
issues**. All 3 critical issues and 6 high-priority issues have been
fixed and verified with passing tests.

**Remaining high-priority issues** (9 open) span database schema
design (cascade deletes, nullable names), state management (triple
selection state), rendering bugs (rich text wrapping, text rotation),
and security polish (CSP, SVG, color validation).

55 documentation items are factually wrong or stale.

This plan organizes fixes into phases by priority and effort.

---

## Phase 0 — Previously Fixed

All critical issues from v25 and v27 have been fixed and verified:

| ID | Issue | Status |
|----|-------|--------|
| CRIT-v25-1 | Phantom API reference | ✅ FIXED |
| CRIT-v25-2 | Callout tailTip scaling | ✅ FIXED |
| CRIT-v27-1 | ApiLayersDelete exception swallowing | ✅ FIXED |
| CRIT-v27-2 | ApiLayersRename exception swallowing | ✅ FIXED |
| CRIT-v27-3 | diagnose.php unauthenticated | ✅ FIXED (deleted) |
| HIGH-v25-2 | ToolStyles SHADOW_OFFSET | ✅ FIXED |
| HIGH-v25-3 | ValidationManager null guard | ✅ FIXED |
| HIGH-v25-7 | Text decoration mutual exclusion | ✅ FIXED |
| HIGH-v25-8 | PresetManager SUPPORTED_TOOLS | ✅ FIXED |
| HIGH-v26-3 | Save button 2s timeout | ✅ FIXED |
| HIGH-v26-4 | Clipboard paste missing coordinates | ✅ FIXED |
| HIGH-v26-5 | toggleLayerLock bypasses StateManager | ✅ FIXED |
| HIGH-v27-3 | isSchemaReady 23 uncached DB queries | ✅ FIXED |
| HIGH-v27-4 | duplicateSelected single-layer only | ✅ FIXED |
| HIGH-v27-6 | Text length limit 500 vs 1000 | ✅ FIXED |
| MED-v25-4 | EffectsRenderer debug logging | ✅ FIXED |
| MED-v25-5 | getBackgroundVisible() gap | ✅ FIXED |

---

## Phase 1A — Critical (ALL FIXED)

~~**Effort:** ~1-2 hours total~~
~~**Impact:** Error handling, security~~

All 3 critical issues have been fixed. See Phase 0 table above.

- ~~Fix 1: ApiLayersDelete Exception Swallowing~~ → ✅ FIXED
- ~~Fix 2: ApiLayersRename Exception Swallowing~~ → ✅ FIXED
- ~~Fix 3: Remove diagnose.php~~ → ✅ FIXED (deleted)

---

## Phase 1B — High Priority (Next Sprint)

**Effort:** ~12-16 hours total
**Impact:** Data loss prevention, performance, rendering bugs,
UX issues, state management

### Fix 4: ON DELETE CASCADE → SET NULL (HIGH-v27-1)

**Effort:** 1 hour
**File:** sql/layers_tables.sql L19, L29

Create migration patch:

```sql
ALTER TABLE /*_*/layer_sets
  DROP FOREIGN KEY fk_layer_sets_user_id,
  ADD CONSTRAINT fk_layer_sets_user_id
    FOREIGN KEY (ls_user_id) REFERENCES /*_*/user (user_id)
    ON DELETE SET NULL;

ALTER TABLE /*_*/layer_assets
  DROP FOREIGN KEY fk_layer_assets_user_id,
  ADD CONSTRAINT fk_layer_assets_user_id
    FOREIGN KEY (la_user_id) REFERENCES /*_*/user (user_id)
    ON DELETE SET NULL;
```

Also update `ls_user_id` and `la_user_id` to allow NULL.
Register patch in `LayersSchemaManager::onLoadExtensionSchemaUpdates()`.

---

### Fix 5: ls_name NOT NULL Constraint (HIGH-v27-2)

**Effort:** 30 min
**File:** sql/layers_tables.sql L10

Create migration patch:

```sql
UPDATE /*_*/layer_sets SET ls_name = 'default'
  WHERE ls_name IS NULL;

ALTER TABLE /*_*/layer_sets
  MODIFY ls_name varchar(255) NOT NULL DEFAULT 'default';
```

---

### ~~Fix 6: Cache isSchemaReady()~~ ✅ FIXED

See Phase 0. Added `$schemaReadyResult` instance cache.

---

### ~~Fix 7: duplicateSelected Multi-Layer~~ ✅ FIXED

See Phase 0. Now loops all selected layers.

---

### Fix 8: Consolidate Selection State (HIGH-v27-5)

**Effort:** 3-4 hours (complex refactor)
**File:** resources/ext.layers.editor/SelectionManager.js

Remove direct `selectedLayerIds` from `CanvasManager` and
`SelectionManager`. Use `StateManager` as single source. All
reads go through `stateManager.get('selectedLayerIds')`.

This requires updating all consumers to read from StateManager
instead of local copies. Phased approach:
1. Remove `CanvasManager.selectedLayerIds` (sync target)
2. Make `SelectionManager.selectedLayerIds` a getter from StateManager
3. Remove `SelectionState` internal duplication
4. Ensure `notifySelectionChange()` only writes to StateManager

---

### ~~Fix 9: Text Length Limit Reconciliation~~ ✅ FIXED

See Phase 0. Validator now uses `limits.MAX_TEXT_LENGTH || 1000`.

---

### Fix 10: VALID_LINK_VALUES Whitelist (HIGH-v26-1)

**Effort:** 15 min
**File:** src/Hooks/Processors/LayersParamExtractor.php L48

```php
private const VALID_LINK_VALUES = [
    'editor', 'editor-newtab', 'editor-return',
    'editor-modal', 'viewer', 'lightbox'
];
```

---

### Fix 11: Rich Text Word Wrap (HIGH-v26-2)

**Effort:** 3-4 hours (complex)
**File:** resources/ext.layers.shared/TextBoxRenderer.js L551, L811

Implement rich-text-aware word wrap that measures each run's
fragment with its own font settings.

Approach:
1. Extract text runs with their styles
2. For each word, measure with the run's font settings
3. Track accumulated line width per-run
4. Break lines when accumulated width exceeds available width

Add tests with mixed-size rich text to verify.

---

### ~~Fix 12: Save Button Timeout~~ ✅ FIXED

See Phase 0. Removed 2000ms timer; now state-driven.

---

### ~~Fix 13: Clipboard Paste Coordinates~~ ✅ FIXED

See Phase 0. Added arrowX/arrowY/tailTipX/tailTipY offsets.

---

### ~~Fix 14: toggleLayerLock StateManager~~ ✅ FIXED

See Phase 0. Uses immutable update via stateManager.set().

---

### Fix 15: TextRenderer Rotation (HIGH-v25-1, carried)

**Effort:** 1 hour
**File:** resources/ext.layers.shared/TextRenderer.js L205-228

Compute pivot based on textAlign:

```javascript
let pivotX;
switch ( layer.textAlign ) {
    case 'center': pivotX = x; break;
    case 'right': pivotX = x - textWidth / 2; break;
    default: pivotX = x + textWidth / 2;
}
```

---

### Fix 16: CSP Header Abstraction (HIGH-v25-4, carried)

**Effort:** 30 min
**File:** src/Action/EditLayersAction.php L356-360

Replace raw `header()` with MW response API:

```php
$out->getRequest()->response()->header(
    'Content-Security-Policy: ' . $csp
);
```

---

### Fix 17: SVG CSS Injection Vectors (HIGH-v25-5, carried)

**Effort:** 1 hour
**File:** src/Validation/ServerSideLayerValidator.php ~L1215

Add CSS injection patterns to SVG validation:

```php
$dangerousPatterns = [
    '/expression\s*\(/i',
    '/-moz-binding\s*:/i',
    '/behavior\s*:/i',
    '/@import\b/i',
];
```

---

### Fix 18: SlideHooks Color Validator (HIGH-v25-6, carried)

**Effort:** 30 min
**File:** src/Hooks/SlideHooks.php L317

Replace `isValidColor()` with `ColorValidator::isValidColor()`:

```php
use MediaWiki\Extension\Layers\Validation\ColorValidator;

if ( !ColorValidator::isValidColor( $color ) ) {
    return null;
}
```

---

## Phase 2 — Medium Priority (Next Month)

**Effort:** ~10-14 hours total

| ID | Issue | Fix Approach | Effort |
|----|-------|-------------|--------|
| MED-v27-1 | SlideManager.js not registered | Register in extension.json or delete | 15m |
| MED-v27-2 | Slides coverage excluded | Add to jest.config.js collectCoverageFrom | 5m |
| MED-v27-3 | Duplicate FK migration patches | Delete one of the two files | 5m |
| MED-v27-4 | JSON clone on drag start | Use structuredClone or shallow copy | 30m |
| MED-v27-5 | Spaces in set names | Restrict to `[\p{L}\p{N}_\-]` (no spaces) | 30m |
| MED-v27-6 | Duplicate message keys | Remove duplicates from extension.json | 10m |
| MED-v27-7 | Tautological tests | Rewrite BasicLayersTest to import real modules | 1h |
| MED-v27-8 | Fallback registry uncached | Add instance cache to get() | 15m |
| MED-v26-1 | UIHooks over-engineering | Remove dead MW 1.44+ guards | 1h |
| MED-v26-2 | 6 regex passes/parse | Combine into 1-2 passes | 2h |
| MED-v26-3 | ApiLayersList try/catch | Add try/catch, return API error | 15m |
| MED-v26-4 | Exception→Throwable | Change catch type | 5m |
| MED-v26-5 | InlineTextEditor debounce | Add 50ms debounce to _handleInput | 30m |
| MED-v25-1 | isForeignFile 6x duplication | Use trait in all Processor classes | 2h |
| MED-v25-2 | enrichWithUserNames 3x | Extract to shared trait/service | 1h |
| MED-v25-3 | GradientEditor event leak | Call eventTracker.destroy() in _build | 15m |
| MED-v25-6 | ext.layers loaded every page | Conditional addModules check | 30m |
| MED-v25-7 | APIManager catch signature | Use (code, result) params | 10m |
| MED-v25-8 | Hardcoded English messages | Replace with mw.message() | 45m |
| MED-v25-9 | selectAll fallback filter | Add locked/invisible filter | 10m |

---

## Phase 3 — Low Priority (Ongoing)

**Effort:** ~4-6 hours total

Low-priority items (P3.1 through P3.17) are deferred to ongoing
maintenance. None affect functionality or user experience.

Key areas:
- **Dead code removal:** onParserAfterTidy, isFilePageContext()
- **Listener tracking:** Toolbar Shape/Emoji buttons, editLayerName
- **Validation polish:** Hex regex, JSON.stringify order
- **Memory hygiene:** Color picker, DraftManager, EventTracker
- **Testing:** Add module.exports to LayerPanel.js, LayersValidator.js
- **Dependency cleanup:** Remove unused ts-jest, fix eslintIgnore

---

## Phase 4 — Documentation (Parallel Track)

**Effort:** ~5-7 hours total

### Highest Impact (20 HIGH items)

1. **Update god class count** from 19 to 21 across all docs
   (copilot-instructions, README, ARCHITECTURE, CONTRIBUTING)
2. **Fix wiki/Home.md** — verify "What's New" sections against
   CHANGELOG; remove fabricated entries
3. **Fix copilot-instructions.md** — PHP: 39 files, ~15,009 lines;
   JS: 140 files, ~96,856 lines; update module line counts;
   add `callout` to type enum; update ResizeCalculator (1,017)
   and ShapeRenderer (1,010) as god classes
4. **Fix ARCHITECTURE.md** version from 0.8.5 to 1.5.52;
   update all controller table counts
5. **Rewrite LTS_BRANCH_STRATEGY.md** — version numbers from
   1.4.x era; tool count says 13 not 15
6. **Fix THIRD_PARTY_LICENSES.md** — 3,731 vs 2,817 emoji
7. **Reconcile GOD_CLASS_REFACTORING_PLAN.md** — update to 21
8. **Fix SLIDE_MODE.md** — mark "Implemented" not "Partially";
   remove unimplemented `lock` param docs
9. **Fix wiki/Architecture-Overview.md** — table name `layer_sets`
   not `layers_sets`; column names to match actual schema
10. **Fix wiki/Contributing-Guide.md** — MW 1.44+ not 1.39+

### Medium Impact (29 items)

- Config docs: add missing Slide Mode variables
- Module line counts in copilot-instructions, ARCHITECTURE
- Mark NAMED_LAYER_SETS.md as implemented (not proposal)
- Add `{{#Slide:}}` syntax to WIKITEXT_USAGE.md
- Update INSTANTCOMMONS_SUPPORT.md to `layerset=` syntax
- Add Marker/Dimension shortcuts to ACCESSIBILITY.md
- Remove `'unsafe-eval'` from CSP_GUIDE.md example
- Archive old What's New entries in wiki/Home.md
- Fix near-threshold list in CONTRIBUTING.md
- Fix wiki/Frontend-Architecture.md line counts (30-50% off)

### Low Impact (6 items)

- Date formatting consistency
- Example version numbers in RELEASE_GUIDE.md
- Section numbering in FUTURE_IMPROVEMENTS.md
- Exact test count in CHANGELOG.md [Unreleased]
- UX_STANDARDS_AUDIT.md version/tool count
- NAMED_LAYER_SETS.md version label

---

## God Class Status (21 files >= 1,000 lines)

### Generated Data Files (2 — exempt)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | 11,299 |
| EmojiLibraryIndex.js | 3,055 |

### Hand-Written JavaScript (17)

| File | Lines | Notes |
|------|-------|-------|
| LayerPanel.js | 2,180 | Delegates to 9 controllers |
| CanvasManager.js | 2,053 | Facade pattern |
| Toolbar.js | 1,891 | Many tool icons |
| LayersEditor.js | 1,836 | Main orchestrator |
| InlineTextEditor.js | 1,672 | Complex inline editing |
| APIManager.js | 1,575 | Many API operations |
| PropertyBuilders.js | 1,495 | Many property types |
| SelectionManager.js | 1,415 | Delegates to 3 sub-modules |
| CanvasRenderer.js | 1,391 | Delegates SelectionRenderer |
| ViewerManager.js | 1,320 | Lazy init pattern |
| ToolManager.js | 1,214 | Delegates to handlers |
| GroupManager.js | 1,207 | Group operations |
| SlideController.js | 1,131 | Slide mode controller |
| TransformController.js | 1,117 | Multi-layer transforms |
| LayersValidator.js | 1,116 | Comprehensive validation |
| ResizeCalculator.js | 1,017 | NEW — crossed threshold |
| ShapeRenderer.js | 1,010 | NEW — crossed threshold |

### PHP (2)

| File | Lines | Notes |
|------|-------|-------|
| LayersDatabase.php | 1,364 | CRUD + JSON validation |
| ServerSideLayerValidator.php | 1,348 | Strict whitelist |

### Near-Threshold (>900 lines)

| File | Lines |
|------|-------|
| ToolbarStyleControls.js | 998 |
| TextBoxRenderer.js | 996 |
| PropertiesForm.js | 994 |
| ArrowRenderer.js | 974 |
| LayerRenderer.js | 973 |
| CalloutRenderer.js | 961 |

---

## Security Posture Assessment

**Rating: B+ (Good — 3 gaps to close for A-)**

Strengths:
- All writes require CSRF tokens
- Parameterized SQL throughout
- 110+ property strict whitelist with type validation
- Rate limiting on all 5 endpoints, per-role limits
- Text sanitized with iterative stripping
- Boolean normalization prevents API serialization bugs
- Transaction safety with atomic operations and FOR UPDATE
- Color validation with 50-char ReDoS protection
- IM injection protected by Shell::command + `@` stripping

Gaps to close:
- ~~diagnose.php unauthenticated (CRIT-v27-3)~~ ✅ FIXED
- ON DELETE CASCADE destroys user content (HIGH-v27-1)
- CSP uses raw header() — switch to MW API (HIGH-v25-4)
- SVG missing 4 CSS injection patterns (HIGH-v25-5)
- SlideHooks color validator too weak (HIGH-v25-6)
- shapeData nested keys not filtered (LOW — stored but inert)

---

## Test Coverage Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.19% | 90% | ✅ +5.19% |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ +3.67% |
| Lines | 95.32% | 90% | ✅ +5.32% |

Coverage is healthy. Focus areas:
- Add ext.layers.slides to coverage collection (MED-v27-2)
- Improve SlideController.js branch coverage (72.5%)
- Improve RichTextToolbar.js function coverage (66.1%)
- Remove tautological tests from BasicLayersTest (MED-v27-7)

---

## Strategic Risks

### document.execCommand Deprecation

InlineTextEditor's entire rich text formatting pipeline relies on
the deprecated `document.execCommand` API. No browser has removed
support yet, but no standardized replacement exists. Begin planning
migration to Selection/Range API with manual DOM manipulation within
the next 6 months.

### Repetitive Renderer Boilerplate

ShapeRenderer, ArrowRenderer, and TextBoxRenderer each repeat
an identical 30-50 line shadow/fill/stroke rendering pipeline per
shape type. A template method or shared rendering pipeline could
reduce duplication by 50%+ and make rendering behavior changes
atomic.

### PropertyBuilders Data-Driven Opportunity

PropertyBuilders.js (1,495 lines) has 16 `add*()` methods with
nearly identical patterns. A data-driven approach (property
definitions as config objects) could cut the file by 50%+ and make
it significantly easier to add new property groups.

### State Management Fragility

The triple source of truth for selection state (HIGH-v27-5)
represents a broader pattern: state is distributed across Manager
instances rather than centralized. Future features should use
StateManager as the single canonical source for all stateful data.

---

## Change History

| Version | Date | Reviewer | Changes |
|---------|------|----------|---------|
| v27-fix | 2026-02-07 | Critical Review | Fixed 3 CRIT + 6 HIGH; 9 HIGH remain open; all tests pass |
| v27 | 2026-02-07 | Critical Review | 3 CRIT (new), 15 HIGH (6 new), 20 MED (8 new), 17 LOW; 55 doc; 5 false positives eliminated |
| v26 | 2026-02-07 | Critical Review | 0 CRIT, 9 HIGH, 12 MED, 12 LOW, 51 doc |
| v25 | 2026-02-07 | Critical Review | 2 CRIT, 8 HIGH, 9 MED, 11 LOW, 51 doc |
| v24 | 2026-02-07 | Prior review | 4 CRIT, 11 HIGH (all now fixed) |
| v22 | 2026-01-xx | Prior review | Initial comprehensive review |
