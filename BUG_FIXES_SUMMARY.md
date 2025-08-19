# MediaWiki Layers Extension - Bug Fixes Implemented

## Summary
Implemented comprehensive fixes for the MediaWiki Layers extension to address multiple issues:

1. **Parameter Detection Failure** - `layers=all` in wikitext wasn't being detected
2. **Client Configuration Issue** - `pageAllow=false` preventing layer rendering  
3. **URL Parameter Scope Issue** - `?layers=all` affecting all images instead of selective ones
4. **Drop Shadow Rendering** - Need to investigate shadow property handling

## Changes Made

### 1. Fixed Parser Hook Registration
**Problem**: `ParserAfterParse` was scanning HTML output instead of raw wikitext
**Solution**: Changed to `ParserBeforeInternalParse` to scan raw wikitext

**Files Modified**:
- `extension.json`: Changed hook registration from `ParserAfterParse` to `ParserBeforeInternalParse`
- `src/Hooks/WikitextHooks.php`: Updated method signature and implementation

### 2. Enhanced Pattern Detection
**Problem**: Single regex pattern was too restrictive
**Solution**: Multiple fallback patterns + broader detection

**Implementation**:
```php
// Multiple patterns to catch different variations
$patterns = [
    '/\[\[File:[^|\]]*\|[^|\]]*layers\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)[^|\]]*\]\]/',
    '/\[\[File:[^|\]]*\|[^|\]]*layer\s*=\s*(all|on|true|id:\d+|name:[^|\]]+|[0-9a-fA-F,\s]+)[^|\]]*\]\]/',
    '/\[\[File:[^|\]]*\|.*layers\s*=\s*(all|on|true|id:\d+|name:[^|\]]+)[^|\]]*\]\]/',
    '/\[\[File:[^|\]]*\|.*layer\s*=\s*(all|on|true|id:\d+|name:[^|\]]+)[^|\]]*\]\]/'
];

// Fallback: simple string detection
if (!self::$pageHasLayers && (strpos($text, 'layers=') !== false || strpos($text, 'layer=') !== false)) {
    self::$pageHasLayers = true;
}
```

### 3. Improved Debug Logging
**Problem**: Limited visibility into parameter detection process
**Solution**: Comprehensive logging at each step

**Added Logging**:
- `ParserBeforeInternalParse` hook execution and text length
- Pattern matching results with actual matched text
- `pageHasLayers()` status in `BeforePageDisplay`
- Client configuration setting (`wgLayersParam`)

### 4. Enhanced Thumbnail Fallback Logic
**Problem**: Missing layer data injection when `pageHasLayers=true`
**Solution**: Enhanced fallback in `onThumbnailBeforeProduceHTML`

**Implementation**:
```php
// FALLBACK: Check if pageHasLayers indicates layers should be shown but no flag detected
if (!$shouldFallback && self::$pageHasLayers) {
    $shouldFallback = true;
    // Auto-fetch and inject layer data from database
}
```

## Expected Behavior After Fixes

### For Wikitext: `[[File:Image.jpg|500px|layers=all|Caption]]`
1. ✅ `ParserBeforeInternalParse` detects `layers=all` pattern
2. ✅ Sets `self::$pageHasLayers = true`  
3. ✅ `BeforePageDisplay` detects `pageHasLayers()` and sets `wgLayersParam = 'all'`
4. ✅ Client gets `pageAllow = true` 
5. ✅ `ThumbnailBeforeProduceHTML` fetches layer data and injects `data-layer-data`
6. ✅ Layers render on the specific image

### For URL: `http://site/Page?layers=all`
- **Current Behavior**: Affects ALL images on page (too broad)
- **Issue**: URL parameters should be more selective
- **Future Enhancement Needed**: Restrict to images with existing layer data or explicit markers

## Testing Status

### ✅ Code Quality
- JavaScript: 45 tests passing
- PHP: Syntax validation clean  
- ESLint/Stylelint: No errors

### 🔄 Runtime Testing Needed
1. **Test page with wikitext**: `[[File:ImageTest02.jpg|500px|layers=all|Caption]]`
   - Check browser console for `mw.config.get('wgLayersParam')` = `true`  
   - Verify layer overlays render
   - Check server logs for detection messages

2. **URL parameter testing**: `http://site/Page?layers=all`
   - Verify selective behavior (should be more restrictive)
   - Check if only appropriate images get layers

3. **Drop shadow testing**: 
   - Create layer with `shadow: true, shadowColor: '#000', shadowBlur: 5`
   - Verify shadows render correctly in viewer

## Debug Log Messages to Watch For

**Successful Detection**:
```
Layers: ParserBeforeInternalParse called with text length: XXXX
Layers: ParserBeforeInternalParse detected layers parameter: [[File:...]], setting pageHasLayers=true  
Layers: Setting wgLayersParam=all due to page having layers in wikitext
Layers: pageHasLayers=true, enabling fallback layer data fetch
Layers: Added layer data attribute with X layers
```

**Detection Failure**:
```
Layers: pageHasLayers() = false, layersParam = null
```

## Drop Shadow Investigation Notes

The shadow rendering logic in `LayersViewer.js` appears correct:
- Sets `ctx.shadowColor`, `ctx.shadowBlur`, `ctx.shadowOffsetX/Y` when `layer.shadow = true`
- Supports both flat format (`shadow: true, shadowColor: '#000'`) and nested format
- Applied within `ctx.save()/restore()` block appropriately

**Potential Issues to Investigate**:
1. Layer data missing shadow properties when saved/loaded
2. Canvas context shadow being reset prematurely  
3. Shadow properties not being transmitted from editor to viewer
4. CSS or rendering conflicts with canvas shadows

## Next Steps

1. **Immediate**: Test the wikitext parameter detection with a page containing `[[File:Image.jpg|layers=all]]`
2. **Validation**: Check server logs for detection messages
3. **Shadow Debug**: Add logging to shadow rendering code to see what shadow properties are received
4. **URL Refinement**: Consider making URL `layers=all` more selective in future updates

## File Summary

**Modified Files**:
- `extension.json` - Hook registration change  
- `src/Hooks/WikitextHooks.php` - Enhanced pattern detection and fallback logic
- `src/Hooks.php` - Improved debug logging for page configuration

**Created Files**:
- `PARAMETER_DETECTION_WORKAROUND.md` - Technical implementation details
- This summary document

The fixes implement a robust multi-layer fallback system that should detect `layers=all` parameters regardless of MediaWiki version compatibility issues with parameter registration hooks.
