# Bug Analysis - November 10, 2025

## Issue #1: Layer Drag and Drop Not Working

### Symptoms
Layer items cannot be reordered by dragging them in the layer panel.

### Root Cause Analysis

**Location:** `resources/ext.layers.editor/LayerPanel.js` line 377

**Problem:** Layer items are marked as draggable, but the `setupDragAndDrop()` function is called BEFORE the layer items are created.

**Code Flow:**
1. `LayerPanel` constructor calls `createInterface()` (line 28)
2. `createInterface()` calls `setupDragAndDrop()` (line 329)
3. At this point, `this.layerList` exists but has NO child layer items yet
4. Event listeners are attached to `this.layerList`, but since there are no `.layer-item` elements yet, the drag events have nothing to operate on
5. Layer items are created later when `renderLayerList()` is called

**Proof:**
```javascript
// LayerPanel.js constructor
this.createInterface();  // Line 28
this.setupEventHandlers(); // Line 29

// In createInterface():
this.layerList = document.createElement( 'ul' );
// ...
this.setupDragAndDrop(); // Line 329 - called on EMPTY list!

// setupDragAndDrop() attaches listeners to this.layerList
this.layerList.addEventListener( 'dragstart', function ( e ) {
    var li = e.target.closest( '.layer-item' ); // Will be null - no items yet!
```

**Why Event Delegation Doesn't Help:**
While the events are properly delegated to `this.layerList`, the issue is that the `draggable` attribute is set on each layer item when it's created:

```javascript
// Line 377 in createLayerItem():
item.draggable = true; // This is set, but setupDragAndDrop was already called
```

The event listeners work fine with event delegation, BUT the items aren't actually draggable because `draggable=true` isn't set until AFTER `setupDragAndDrop()` is called.

### Solution

**Option 1 (Recommended):** Set `draggable=true` in the `createLayerItem()` function - **Already done**, so the issue is likely that the event handlers aren't properly attached.

**Option 2:** Call `setupDragAndDrop()` AFTER the first set of layers are rendered.

**Option 3:** Move `draggable=true` to the CSS or ensure items are properly initialized.

**Actual Issue:** Looking more carefully, the setup IS using event delegation correctly. The real issue might be that the drag events aren't firing because:
1. The grab area might be preventing the drag from starting
2. There might be conflicting event handlers
3. The `draggable=true` might not be properly set on all items

Let me check the grab area...

**FOUND IT:** The `grabArea` element (lines 383-391) is a visual element for dragging, but it's not the element with `draggable=true`. The parent `item` has `draggable=true`, but the grab area is a child element. When users try to drag by grabbing the grab area, the drag might not propagate correctly.

### Fix Strategy

1. Ensure the entire layer item is draggable
2. Make sure drag events bubble up from child elements
3. Test that `e.target.closest('.layer-item')` correctly finds the item

---

## Issue #2: Layer History Shows "Invalid Date 1$ Paul (default)"

### Symptoms
- Revision selector shows "Invalid Date" for all entries except the top one
- Shows "1$" instead of proper formatting
- All entries show the same user name and "(default)"

### Root Cause Analysis

**Location:** `resources/ext.layers.editor/LayersEditor.js` lines 540-549

**Problem:** The timestamp from the API is being incorrectly parsed.

**Code:**
```javascript
const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
const userName = layerSet.ls_user_name || layerSet.userName || 'Unknown';
const name = layerSet.ls_name || layerSet.name || '';

let displayText = new Date( timestamp * 1000 ).toLocaleString();
displayText += ' ' + this.getMessage( 'layers-revision-by' ) + ' ' + userName;
if ( name ) {
    displayText += ' (' + name + ')';
}
```

**Issue 1: Timestamp Format**
The code assumes `timestamp` is a Unix timestamp (seconds since epoch) and multiplies by 1000 to convert to milliseconds. However, looking at the database schema:

```sql
-- From layers_tables.sql line 9
ls_timestamp binary(14) NOT NULL,
```

The timestamp is stored as `binary(14)`, which is MediaWiki's format: `YYYYMMDDHHmmss` as a 14-character string, NOT a Unix timestamp!

**Example:**
- MediaWiki format: `"20251110143000"` (Nov 10, 2025, 2:30 PM)
- Code expects: `1699632600` (Unix timestamp)

When you multiply the MediaWiki timestamp string by 1000:
- `"20251110143000" * 1000` = NaN or invalid number
- `new Date(NaN)` = Invalid Date

**Issue 2: "1$" Formatting**
The string `' 1$ '` suggests the message `layers-revision-by` is not properly defined or is returning a placeholder. The "1$" is likely a message parameter placeholder that wasn't replaced.

**Issue 3: All showing same data**
If the timestamp parsing fails and creates Invalid Date for all entries, they all look identical. The "(default)" suggests all entries have `ls_name` = "default" or empty string.

### Solution

**Fix the timestamp parsing:**

```javascript
// Convert MediaWiki binary(14) timestamp to JavaScript Date
// Format: YYYYMMDDHHmmss
function parseMWTimestamp( timestamp ) {
    if ( !timestamp || typeof timestamp !== 'string' ) {
        return null;
    }
    
    // MediaWiki timestamp: YYYYMMDDHHmmss
    const year = timestamp.substring( 0, 4 );
    const month = timestamp.substring( 4, 6 );
    const day = timestamp.substring( 6, 8 );
    const hour = timestamp.substring( 8, 10 );
    const minute = timestamp.substring( 10, 12 );
    const second = timestamp.substring( 12, 14 );
    
    // JavaScript Date expects month 0-11, so subtract 1
    return new Date( year, month - 1, day, hour, minute, second );
}

// In buildRevisionSelector():
const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
const date = parseMWTimestamp( timestamp );
let displayText = date && !isNaN( date ) ? date.toLocaleString() : 'Invalid Date';
```

**Fix the message key:**
Check if `layers-revision-by` exists in `i18n/en.json`. If not, add it or use a hardcoded fallback.

---

## Testing Strategy

### For Issue #1 (Drag and Drop):
1. Create multiple layers in the editor
2. Try to drag a layer item by:
   - Clicking on the grab icon area
   - Clicking anywhere on the layer item
   - Using different browsers
3. Verify that:
   - The item shows visual feedback during drag
   - Drop zones are highlighted
   - The layer order changes after drop
   - The canvas updates with new order
   - The change is saved to state

### For Issue #2 (Revision Display):
1. Save multiple layer revisions with different names
2. Check the revision selector dropdown
3. Verify that:
   - Each revision shows a unique, valid date/time
   - User names are displayed correctly
   - Revision names appear in parentheses
   - The "Latest (current)" label is correct
   - The selected revision is highlighted

---

## Files to Modify

### Issue #1:
- `resources/ext.layers.editor/LayerPanel.js`
  - Verify `setupDragAndDrop()` is working correctly
  - Ensure `draggable=true` is set properly
  - Check event handler delegation

### Issue #2:
- `resources/ext.layers.editor/LayersEditor.js`
  - Add `parseMWTimestamp()` helper function
  - Fix `buildRevisionSelector()` to use correct timestamp parsing
  - Verify message keys exist

- `i18n/en.json` (if needed)
  - Add missing message keys

---

## Priority

Both issues are **HIGH PRIORITY** as they affect core functionality:
1. Layer reordering is a basic expected feature
2. Revision history is critical for collaborative editing and undo functionality

---

**Analysis Completed:** November 10, 2025  
**Next Step:** Implement fixes with careful testing
