# Post-Mortem: Background Visibility Bug

**Date:** December 21, 2025 (updated January 11, 2026)  
**Severity:** High (Data integrity issue)  
**Status:** RESOLVED (FOURTH occurrence fixed January 11, 2026)  
**Time to Resolution:** Multiple debugging sessions over several days

---

## Executive Summary

A subtle type coercion bug between PHP and JavaScript caused the background layer visibility setting to be incorrectly interpreted when loading saved data in the editor. The bug manifested as:

> "Background saved as hidden → displays correctly hidden on article page → returns to editor showing as visible"

This bug resurfaced **FOUR times** during debugging because the root cause (PHP integer vs JavaScript boolean comparison) was obscured by multiple layers of abstraction and incorrect assumptions about where the failure occurred.

---

## Fourth Occurrence: Viewer Initialization on Page Return (January 2026)

### The Bug

After editing layers and returning to the article page, **ALL images** on the page would render their layer annotations correctly, but the base image (background) would not display - appearing as if hidden, even when `backgroundVisible` should be `true`.

### Root Cause

The **viewer initialization code paths** were reading `backgroundVisible` from the API response **without normalizing** the integer 0/1 to boolean. There were **FOUR separate locations** in the viewer code that had this bug:

1. `ViewerManager.refreshAllViewers()` - Used when modal editor closes
2. `ViewerManager.initializeLargeImages()` - Used for large layer sets fetched via API
3. `FreshnessChecker.checkFreshness()` - Used for live preview/freshness checking
4. `ApiFallback.processCandidate()` - Used for API fallback initialization

### The Broken Code Pattern

```javascript
// ALL FOUR LOCATIONS HAD THIS PATTERN:
const payload = {
    layers: layersArr,
    backgroundVisible: layerset.data.backgroundVisible !== undefined 
        ? layerset.data.backgroundVisible : true,  // BUG: passes integer 0/1 directly!
    backgroundOpacity: layerset.data.backgroundOpacity !== undefined 
        ? layerset.data.backgroundOpacity : 1.0
};
```

### The Fix

```javascript
// Normalize backgroundVisible: API returns 0/1 integers, convert to boolean
let bgVisible = true;
if ( layerset.data.backgroundVisible !== undefined ) {
    const bgVal = layerset.data.backgroundVisible;
    bgVisible = bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false';
}

const payload = {
    layers: layersArr,
    backgroundVisible: bgVisible,  // Now properly normalized
    backgroundOpacity: layerset.data.backgroundOpacity !== undefined
        ? parseFloat( layerset.data.backgroundOpacity ) : 1.0
};
```

### Files Modified (Fourth Fix)

| File | Change |
|------|--------|
| `resources/ext.layers/viewer/ViewerManager.js` | Fixed `refreshAllViewers()` and `initializeLargeImages()` |
| `resources/ext.layers/viewer/FreshnessChecker.js` | Fixed `checkFreshness()` |
| `resources/ext.layers/viewer/ApiFallback.js` | Fixed `processCandidate()` |
| `resources/ext.layers/LayersViewer.js` | Fixed `fallbackNormalize()` for inline data |

### Key Lesson

**Every code path that reads API data must normalize boolean values.** The editor code was fixed, but the viewer code had the same pattern in multiple places. When adding new code paths that read from the API, always normalize at the point of reading.

---

## The Bug

### Symptoms

1. User opens the Layers editor
2. User toggles background visibility OFF (hidden)
3. User saves the layer set
4. User views the article page → **Background is correctly hidden** ✓
5. User returns to the editor → **Background shows as VISIBLE** ✗

### Why This Was Confusing

- **Saving worked correctly** - the data was being stored properly
- **Article view worked correctly** - the viewer interpreted the data correctly  
- **Only the editor load was broken** - made it seem like a client-side state issue

---

## Root Cause: PHP Integer to JavaScript Boolean Type Coercion

### The Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SAVE FLOW (Works Correctly)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  JavaScript (Client)           PHP (Server)              Database            │
│  ─────────────────────         ────────────              ────────            │
│  backgroundVisible: false  →   Stored as JSON     →     ls_json_blob        │
│                                {"backgroundVisible": false, ...}             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD FLOW (The Bug)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Database              PHP (Server)                    JavaScript (Client)   │
│  ────────              ────────────                    ───────────────────   │
│  ls_json_blob    →     json_decode()              →    API Response          │
│                        backgroundVisible: false                              │
│                               │                                              │
│                               ▼                                              │
│                     preserveLayerBooleans()                                  │
│                     Converts false → 0 (integer)                             │
│                     (Prevents MediaWiki API dropping false values)           │
│                               │                                              │
│                               ▼                                              │
│                        API Response: {"backgroundVisible": 0}                │
│                               │                                              │
│                               ▼                                              │
│                     JavaScript receives: backgroundVisible = 0               │
│                               │                                              │
│                               ▼                                              │
│                     Check: visible !== false                                 │
│                            0 !== false  →  TRUE  ← BUG!                      │
│                               │                                              │
│                               ▼                                              │
│                     Background treated as VISIBLE                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Exact Code That Failed

**PHP (ApiLayersInfo.php:212-215)** - This code is CORRECT and necessary:
```php
// MediaWiki API drops boolean false during JSON serialization
// So we convert to integers 0/1 which serialize correctly
if ( array_key_exists( 'backgroundVisible', $result['layerset']['data'] ) ) {
    $result['layerset']['data']['backgroundVisible'] = 
        $result['layerset']['data']['backgroundVisible'] ? 1 : 0;
}
```

**JavaScript (Multiple files)** - This code was BROKEN:
```javascript
getBackgroundVisible() {
    const visible = this.editor.stateManager.get( 'backgroundVisible' );
    return visible !== false;  // BUG: 0 !== false is TRUE in JavaScript!
}
```

### Why `0 !== false` is `true` in JavaScript

```javascript
// JavaScript strict equality comparisons
0 === false    // false (different types: number vs boolean)
0 !== false    // true  (they are not strictly equal)

// JavaScript loose equality comparisons  
0 == false     // true  (type coercion makes them equal)
0 != false     // false (they are loosely equal)

// What we needed
visible !== false && visible !== 0  // Handles both boolean and integer
```

---

## Why This Bug Resurfaced THREE Times

### Attempt #1: Reorder State Updates (FAILED)

**Hypothesis:** "The bug is a race condition - backgroundVisible is being set AFTER layers, so the subscription fires with stale data."

**Fix Applied:**
```javascript
// APIManager.js extractLayerSetData()
// Changed order: set backgroundVisible BEFORE layers
this.editor.stateManager.set( 'backgroundVisible', backgroundVisible );
this.editor.stateManager.set( 'backgroundOpacity', backgroundOpacity );
this.editor.stateManager.set( 'layers', processedLayers );  // Now after
```

**Why It Failed:** The ordering was not the problem. The value `backgroundVisible` was `0` (integer), and even when set first, the getter still returned `true` because `0 !== false`.

**Lesson:** We were looking at the wrong layer of abstraction. The state was being set correctly - the getter was interpreting it incorrectly.

---

### Attempt #2: Add Missing ResourceLoader Entry (FAILED)

**Hypothesis:** "BackgroundLayerController.js exists but isn't being loaded because it's missing from extension.json's ResourceLoader scripts."

**Fix Applied:**
```json
// extension.json - Added the missing file
"scripts": [
    "ui/LayerItemFactory.js",
    "ui/BackgroundLayerController.js",  // Added this line
    "ui/ColorPickerDialog.js",
    ...
]
```

**Why It Failed:** While this fix was technically correct (the file WAS missing from ResourceLoader), it didn't fix the bug because:
1. LayerPanel.js has an inline fallback implementation
2. The fallback had THE SAME BUG (`visible !== false`)
3. Even with BackgroundLayerController loaded, it ALSO had the same bug

**Lesson:** The bug existed in MULTIPLE places. Fixing the module loading didn't help because ALL implementations had the same flawed comparison.

---

### Attempt #3: Fix Type Coercion (SUCCESS)

**Hypothesis:** "The PHP server converts `false` to `0` to prevent MediaWiki API from dropping the value. JavaScript code uses `!== false` which doesn't catch integer `0`."

**Fixes Applied:**

1. **APIManager.js** - Normalize at the source:
```javascript
// Normalize backgroundVisible to boolean - API returns 0/1 integers
const bgVal = layerSet.data.backgroundVisible;
if ( bgVal === undefined || bgVal === null ) {
    backgroundVisible = true;
} else if ( bgVal === false || bgVal === 0 || bgVal === '0' || bgVal === 'false' ) {
    backgroundVisible = false;
} else {
    backgroundVisible = true;
}
```

2. **BackgroundLayerController.js** - Handle both types in getter:
```javascript
getBackgroundVisible() {
    const visible = this.editor.stateManager.get( 'backgroundVisible' );
    // Handle both boolean false and integer 0 (from API serialization)
    return visible !== false && visible !== 0;
}
```

3. **LayerPanel.js** - Same fix in fallback getter:
```javascript
getBackgroundVisible() {
    const visible = this.editor.stateManager.get( 'backgroundVisible' );
    // Handle both boolean false and integer 0 (from API serialization)
    return visible !== false && visible !== 0;
}
```

**Why It Worked:** All code paths now correctly interpret `0` as "not visible".

---

## Files Modified

### Original Fix (December 2025)

| File | Change |
|------|--------|
| `resources/ext.layers.editor/APIManager.js` | Normalize `backgroundVisible` to boolean in `extractLayerSetData()` |
| `resources/ext.layers.editor/ui/BackgroundLayerController.js` | Fix `getBackgroundVisible()` to handle integer 0 |
| `resources/ext.layers.editor/LayerPanel.js` | Fix fallback `getBackgroundVisible()` to handle integer 0 |
| `extension.json` | Add missing `ui/BackgroundLayerController.js` to ResourceLoader |
| `tests/jest/APIManager.test.js` | Add tests for integer 0/1 normalization |
| `tests/jest/BackgroundLayerController.test.js` | Add tests for integer 0/1 handling |

### Fourth Fix (January 2026)

| File | Change |
|------|--------|
| `resources/ext.layers/viewer/ViewerManager.js` | Normalize in `refreshAllViewers()` and `initializeLargeImages()` |
| `resources/ext.layers/viewer/FreshnessChecker.js` | Normalize in `checkFreshness()` |
| `resources/ext.layers/viewer/ApiFallback.js` | Normalize in `processCandidate()` |
| `resources/ext.layers/LayersViewer.js` | Normalize in `fallbackNormalize()` |

---

## Prevention Strategies

### 1. Document the PHP-to-JS Boolean Contract

**Add to copilot-instructions.md:**

```markdown
## CRITICAL: Boolean Serialization Between PHP and JavaScript

The MediaWiki API drops boolean `false` values during JSON serialization.
To preserve false values, `ApiLayersInfo.php` converts booleans to integers:
- `true` → `1`
- `false` → `0`

**ALL JavaScript code that reads boolean flags from the API MUST handle both types:**

```javascript
// WRONG - will fail for integer 0
return visible !== false;

// CORRECT - handles both boolean and integer
return visible !== false && visible !== 0;

// BEST - normalize at source (APIManager.extractLayerSetData)
if ( bgVal === false || bgVal === 0 || bgVal === '0' ) {
    backgroundVisible = false;
}
```
```

### 2. Normalize All API Responses at Entry Point

The best fix is to normalize boolean values in `extractLayerSetData()` so downstream code doesn't need to worry about type coercion:

```javascript
// APIManager.js - Normalize ONCE at the API boundary
backgroundVisible = Boolean(layerSet.data.backgroundVisible);  // 0 → false, 1 → true
```

### 3. Add Type Coercion Tests

Every getter that interprets boolean flags should be tested with:
- `true` (boolean)
- `false` (boolean)
- `1` (integer from API)
- `0` (integer from API)
- `undefined` (not set)

### 4. ESLint Rule (Future)

Consider adding a custom ESLint rule that flags patterns like:
```javascript
// Flag this pattern as potentially buggy
someValue !== false  
```

---

## Test Coverage Added

```javascript
// APIManager.test.js
it('should normalize integer 0 to boolean false for backgroundVisible')
it('should normalize integer 1 to boolean true for backgroundVisible')

// BackgroundLayerController.test.js  
it('should return false when backgroundVisible is integer 0 (API serialization)')
it('should return true when backgroundVisible is integer 1 (API serialization)')
```

---

## Timeline

| Time | Action | Result |
|------|--------|--------|
| Day 1 | User reports bug | Investigated state update ordering |
| Day 1 | Applied ordering fix | Failed - same behavior |
| Day 1 | Investigated ResourceLoader | Found missing file |
| Day 1 | Added missing file to extension.json | Failed - same behavior |
| Day 2 | Deep traced data flow | Found PHP converts false→0 |
| Day 2 | Analyzed JavaScript comparisons | Found `0 !== false` bug |
| Day 2 | Fixed all three locations | Success |
| Day 2 | Added comprehensive tests | 5,766 tests passing |

---

## Key Takeaways

1. **Type coercion between PHP and JavaScript is a common source of bugs** - especially when boolean values are involved.

2. **MediaWiki API quirks can cause subtle bugs** - the fact that it drops `false` values means we need workarounds that introduce type mismatches.

3. **Always check for multiple representations of the same logical value** - `false`, `0`, `"0"`, `"false"` can all mean "not visible".

4. **Normalize data at API boundaries** - convert to proper types as soon as data enters JavaScript, not scattered throughout the codebase.

5. **When a bug resurfaces, question your assumptions** - the first two fixes were based on incorrect hypotheses about WHERE the bug was.

---

## Related Files

- [API.md](API.md) - API documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [copilot-instructions.md](../.github/copilot-instructions.md) - Development guidelines

---

*Post-mortem written: December 21, 2025*  
*Author: GitHub Copilot (Claude Opus 4.5)*
