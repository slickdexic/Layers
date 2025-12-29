# v1.2.8 Release Notes

**Release Date:** December 27, 2025

## Bug Fixes

### Fixed Arrow Rendering with Blur Blend Mode
Arrows with blur blend mode (set via the Blend Mode dropdown) no longer display rectangular bounding boxes in the editor. The issue was that the blur blend mode path used rectangular clip regions instead of the arrow's actual shape. Arrows and lines now render normally while ArrowRenderer handles blur fill correctly via EffectsRenderer.

### Fixed Arrow Fill Property
Arrows were being created without a `fill` property, causing ArrowRenderer to only stroke (not fill) the polygon outline. Added explicit `fill: style.color` to ShapeFactory.createArrow() and BuiltInPresets arrow definitions.

## Technical Details

### Files Changed
- `resources/ext.layers.editor/canvas/CanvasRenderer.js` - Skip arrows/lines from blur blend mode rendering path
- `resources/ext.layers.shared/LayerRenderer.js` - Same fix for shared renderer (article view)
- `resources/ext.layers.editor/tools/ShapeFactory.js` - Added fill property to createArrow()
- `resources/ext.layers.editor/presets/BuiltInPresets.js` - Added fill and arrowSize to arrow presets

### Root Cause Analysis
1. **Arrow fill issue**: Arrows created via ShapeFactory were missing the `fill` property, so ArrowRenderer would only stroke the polygon outline (resulting in an empty arrow)
2. **Blur blend mode issue**: When arrows had `blend: 'blur'` (from the Blend Mode dropdown), the `drawLayerWithBlurBlend` function used rectangular bounding boxes as clip regions instead of the arrow's polygon shape, causing visible rectangular boxes around arrows

## Testing

- **6,824 tests passing** (+68 from v1.2.7)
- All linting passes (ESLint, Stylelint, PHP CodeSniffer)
- Banana (i18n) validation passes

## Upgrade Notes

This is a bug-fix release with no breaking changes. Simply update to v1.2.8 to receive the fixes.

---

## Full Changelog

See [CHANGELOG.md](../CHANGELOG.md) for the complete version history.
