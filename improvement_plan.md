# Improvement Plan

**Last Updated:** February 7, 2026 (v25 Review)
**Version:** 1.5.52
**Overall Grade:** B+

---

## Executive Summary

The Layers extension is a mature, well-tested codebase at 95.19%
statement coverage (84.96% branch). The security posture is strong
with CSRF, rate limiting, input validation, and authorization all
properly implemented. 21 god classes exist (17 JS, 2 generated,
2 PHP) but all use proper delegation patterns.

Two critical issues exist: a phantom API endpoint reference and an
unscaled callout property. Eight high-priority issues need attention.
51 documentation items are factually wrong or stale.

Note: `SlideManager.js` has a wrong namespace reference but is not
registered in any ResourceLoader module — it is dead code. Production
slide rendering uses `SlideController.js` which has the correct
namespace lookup.

This plan organizes fixes into phases by priority and effort.

---

## Phase 0 — Critical (✅ ALL FIXED)

**Status:** ✅ Both critical fixes applied Feb 7, 2026
**Effort:** ~1.5 hours total
**Impact:** Phantom API; wrong callout positions

### Fix 1: LayeredFileRenderer Phantom API

**ID:** CRIT-v25-1 — ✅ FIXED (Feb 7, 2026)
**File:** src/Hooks/Processors/LayeredFileRenderer.php L236
**Effort:** 1 hour (must decide approach)
**Options:**

1. **Create the API module** — register `ApiLayersThumbnail` in
   extension.json, implement thumbnail composition
2. **Remove the call** — disable server-side layered thumbnails
   and rely on client-side canvas rendering
3. **Use existing API** — redirect to `layersinfo` and let the
   client handle composition

Option 2 is safest if thumbnails aren't working today anyway.

---

### Fix 2: Callout tailTipX/tailTipY Scaling

**ID:** CRIT-v25-2 — ✅ FIXED (Feb 7, 2026)
**File:** resources/ext.layers/LayersViewer.js, scaleLayerCoordinates()
**Effort:** 10 min
**Fix:**

Add to the property scaling list:

```javascript
if ( layer.tailTipX !== undefined ) {
    layer.tailTipX *= scale;
}
if ( layer.tailTipY !== undefined ) {
    layer.tailTipY *= scale;
}
```

---

## Phase 1 — High Priority (Next Sprint)

**Effort:** ~8-12 hours total
**Impact:** Rendering bugs, security gaps, data integrity

### Fix 3: TextRenderer Rotation Center (HIGH-v25-1)

**Effort:** 1 hour
**File:** resources/ext.layers.shared/TextRenderer.js L205-228
**Fix:** Compute pivot based on textAlign value:

```javascript
let pivotX;
switch ( layer.textAlign ) {
    case 'center': pivotX = x; break;
    case 'right': pivotX = x - textWidth / 2; break;
    default: pivotX = x + textWidth / 2;
}
```

### Fix 4: ToolStyles SHADOW_OFFSET (HIGH-v25-2)

**Status:** ✅ FIXED (Feb 7, 2026)
**Effort:** 15 min
**File:** resources/ext.layers.editor/tools/ToolStyles.js L53-54
**Fix:** Use `SHADOW_OFFSET_X` and `SHADOW_OFFSET_Y` instead of
`SHADOW_OFFSET`. Or add `SHADOW_OFFSET` as alias to LayerDefaults.

### Fix 5: ValidationManager Null Guard (HIGH-v25-3)

**Status:** ✅ FIXED (Feb 7, 2026)
**Effort:** 10 min
**File:** resources/ext.layers.editor/modules/ValidationManager.js L311
**Fix:**

```javascript
if ( !window.layersMessages ) { return key; }
return window.layersMessages.get( key ) || key;
```

### Fix 6: CSP Header Abstraction (HIGH-v25-4)

**Effort:** 30 min
**File:** src/Action/EditLayersAction.php L356-360
**Fix:** Replace `header()` with MW response API:

```php
$out->getRequest()->response()->header(
    'Content-Security-Policy: ' . $csp
);
```

### Fix 7: SVG CSS Injection Vectors (HIGH-v25-5)

**Effort:** 1 hour
**File:** src/Validation/ServerSideLayerValidator.php ~L1215
**Fix:** Add CSS injection patterns to SVG validation:

```php
$dangerousPatterns = [
    '/expression\s*\(/i',
    '/-moz-binding\s*:/i',
    '/behavior\s*:/i',
    '/@import\b/i',
];
```

### Fix 8: SlideHooks Color Validator (HIGH-v25-6)

**Effort:** 30 min
**File:** src/Hooks/SlideHooks.php L317
**Fix:** Use ColorValidator::isValidColor() from the validation
module instead of the local implementation. Add length limit.

### Fix 9: PropertyBuilders Text Decoration (HIGH-v25-7)

**Status:** ✅ FIXED (Feb 7, 2026)
**Effort:** 45 min
**File:** resources/ext.layers.editor/ui/PropertyBuilders.js L415-430
**Fix:** Use combined textDecoration values:

```javascript
const decorations = [];
if ( underline ) decorations.push( 'underline' );
if ( strikethrough ) decorations.push( 'line-through' );
layer.textDecoration = decorations.join( ' ' ) || 'none';
```

### Fix 10: PresetManager SUPPORTED_TOOLS (HIGH-v25-8)

**Status:** ✅ FIXED (Feb 7, 2026)
**Effort:** 5 min
**File:** resources/ext.layers.editor/presets/PresetManager.js L637
**Fix:** Add `'dimension'` and `'marker'` to static array.

---

## Phase 2 — Medium Priority (Next Month)

**Effort:** ~6-8 hours total

| ID | Issue | Fix Approach | Effort |
|----|-------|-------------|--------|
| MED-v25-1 | isForeignFile 8x duplication | Move all callers to use ForeignFileHelperTrait via DI | 3h |
| MED-v25-2 | enrichWithUserNames 3x duplication | Extract shared service method | 1h |
| MED-v25-3 | GradientEditor event leak | Clear eventTracker in _build() before rebuild | 15m |
| MED-v25-4 | EffectsRenderer debug logging | ✅ FIXED | - |
| MED-v25-5 | getBackgroundVisible() gap | ✅ FIXED | - |
| MED-v25-6 | ext.layers loaded on every page | Add conditional check before addModules | 30m |
| MED-v25-7 | APIManager catch signature | Use `function( code, result )` | 10m |
| MED-v25-8 | Hardcoded validation messages | Replace with mw.message() calls | 45m |
| MED-v25-9 | selectAll fallback no filter | Add locked/invisible filter to fallback | 10m |

---

## Phase 3 — Low Priority (Ongoing)

**Effort:** ~4-6 hours total

Low-priority items (LOW-v25-1 through LOW-v25-11) are deferred to
ongoing maintenance. None affect functionality or user experience.
Focus areas: dead code removal, namespace consistency, code style,
and deprecated API migration.

---

## Phase 4 — Documentation (Parallel Track)

**Effort:** ~4-6 hours total

### Highest Impact (18 HIGH items)

1. **Update god class count** from 19 to 21 across all docs
2. **Fix wiki/Home.md** "What's New" sections — verify against
   CHANGELOG, remove fabricated entries
3. **Add `callout` type** to copilot-instructions.md layer type enum
4. **Update copilot-instructions.md** line counts (PHP: 39 files,
   ~15,019 lines; JS: 140 files, ~96,787 lines)
5. **Fix ARCHITECTURE.md** version from 0.8.5 to 1.5.52
6. **Reconcile SLIDE_MODE.md** — mark completed phases, remove
   unimplemented `lock` parameter docs
7. **Fix README.md** — tool count heading vs table mismatch

### Medium Impact (27 items)

- Config documentation: add missing variables to README and MW page
- Update module line counts in copilot-instructions, ARCHITECTURE
- Mark NAMED_LAYER_SETS.md as implemented (not proposal)
- Archive old What's New entries in wiki/Home.md

### Low Impact (6 items)

- Date formatting consistency
- Example version numbers
- Section numbering cleanup

---

## God Class Status (21 files >1,000 lines)

### Generated Data Files (2 — exempt)

| File | Lines |
|------|-------|
| ShapeLibraryData.js | ~11,299 |
| EmojiLibraryIndex.js | ~3,055 |

### Hand-Written JavaScript (17)

| File | Lines | Trend | Notes |
|------|-------|-------|-------|
| LayerPanel.js | ~2,180 | → | Delegates to 9 controllers |
| CanvasManager.js | ~2,053 | → | Facade pattern |
| Toolbar.js | ~1,891 | → | Many tool icons |
| LayersEditor.js | ~1,836 | → | Main orchestrator |
| InlineTextEditor.js | ~1,670 | → | Complex inline editing |
| APIManager.js | ~1,566 | → | Many API operations |
| PropertyBuilders.js | ~1,464 | → | Many property types |
| SelectionManager.js | ~1,415 | → | Delegates to 3 sub-modules |
| CanvasRenderer.js | ~1,365 | → | Delegates to SelectionRenderer |
| ViewerManager.js | ~1,320 | → | Lazy init pattern |
| ToolManager.js | ~1,214 | → | Delegates to handlers |
| GroupManager.js | ~1,205 | → | Group operations |
| SlideController.js | ~1,131 | → | Slide mode controller |
| TransformController.js | ~1,117 | → | Multi-layer transforms |
| LayersValidator.js | ~1,116 | → | Comprehensive validation |
| ResizeCalculator.js | ~1,017 | ↑ NEW | Was near-threshold (995→1,017) |
| ShapeRenderer.js | ~1,010 | ↑ NEW | Was near-threshold (995→1,010) |

### PHP (2)

| File | Lines | Notes |
|------|-------|-------|
| LayersDatabase.php | ~1,363 | CRUD + JSON validation |
| ServerSideLayerValidator.php | ~1,346 | Strict whitelist |

### Near-Threshold (>900 lines)

TextBoxRenderer (~996), PropertiesForm (~994), ArrowRenderer (~974),
LayerRenderer (~969), CalloutRenderer (~961), ToolbarStyleControls
(~998), ShapeRenderer (now above).

---

## Security Posture Assessment

**Rating: A- (Strong)**

Strengths:
- All writes require CSRF tokens
- Parameterized SQL throughout
- Strict property whitelist with type validation
- Rate limiting registered and enforced
- Text sanitized with iterative stripping
- Color validation (except SlideHooks — see HIGH-v25-6)
- Boolean normalization prevents API serialization bugs

Gaps to address:
- CSP uses raw header() — switch to MW API (HIGH-v25-4)
- SVG missing 4 CSS injection patterns (HIGH-v25-5)
- SlideHooks color validator too weak (HIGH-v25-6)
- $_SERVER direct access in WebFrameRateLimiter

---

## Test Coverage Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statement | 95.19% | 90% | ✅ +5.19% |
| Branch | 84.96% | 85% | ✅ At target |
| Functions | 93.67% | 90% | ✅ +3.67% |
| Lines | 95.32% | 90% | ✅ +5.32% |

Coverage is healthy. Focus on branch coverage when adding new code.

---

## Change History

| Version | Date | Reviewer | Changes |
|---------|------|----------|---------|
| v25 | Feb 7, 2026 | Critical Review | Full rewrite. 2 CRIT, 8 HIGH, 9 MED, 11 LOW, 51 doc issues |
| v24 | Feb 3, 2026 | Prior review | 4 CRIT, 11 HIGH (all now fixed) |
| v22 | Jan 2026 | Prior review | Initial comprehensive review |
