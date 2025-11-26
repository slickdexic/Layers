# Debugging Analysis: Polygon/Star Selection Failure

## Status
**Current State:** Codebase fully reverted to original state. No active changes.
**Issue:** Clicking on Polygon or Star shapes in the editor fails to select them.
**Previous Attempts:**
1.  **Type Safety Fix (2025-11-24):**
    *   *Hypothesis:* String coordinates from API were breaking math.
    *   *Action:* Added `parseFloat` to bounds and hit-testing.
    *   *Result:* User reported "No effect".
    *   *Status:* **Reverted**.
2.  **Logic Fix (2025-11-24):**
    *   *Hypothesis:* `isPointInLayer` was ignoring the `points` array and using incorrect parametric defaults.
    *   *Action:* Updated `isPointInLayer` to prioritize `layer.points`.
    *   *Result:* User reported "No effect".
    *   *Status:* **Reverted**.

## Potential Culprits List

### 1. Coordinate System Mismatch (High Probability)
*   **Theory:** The `getMousePoint` function calculates the click position relative to the canvas. If the canvas has CSS transforms, offsets, or if `getBoundingClientRect` interacts poorly with the page layout, the calculated `(x, y)` passed to the hit test might be offset from where the user visually clicked.
*   **Evidence:** Logs show `DOMRect { y: 157 }`. If this offset isn't subtracted correctly, clicks will be vertically displaced.

### 2. Hit Test Logic / Ray Casting
*   **Theory:** The `isPointInPolygon` function uses a ray-casting algorithm.
    *   If the shape is not "closed" correctly in data, it might fail.
    *   If the shape is just a stroke (no fill), clicking *inside* might return false, and clicking *on the line* is hard.
*   **Investigation:** Does `isPointInPolygon` handle the specific winding rule of the shapes being drawn?

### 3. Data Integrity / Structure
*   **Theory:** The `layer` object in the live environment differs from the test environment.
    *   Are `points` stored as an array of objects `[{x,y}, ...]` or an array of arrays `[[x,y], ...]`?
    *   Are `points` relative to `layer.x/y` or absolute canvas coordinates? If they are relative, but we treat them as absolute (or vice versa), hit testing will look in the wrong place.

### 4. Selection Manager Priority
*   **Theory:** `SelectionManager` iterates through layers to find a match.
    *   Is it hitting a transparent "bounding box" of another layer first?
    *   Is it filtering out the polygon because it thinks it's locked or invisible?

### 5. Event Blocking
*   **Theory:** Another DOM element (like a transparent overlay or UI container) is sitting on top of the canvas, intercepting the mouse events before they reach the canvas listener.

## Next Steps: Instrumentation
Instead of guessing a fix, we must **log** the failure.
Proposed Debug Logging:
1.  Log the calculated `clickPoint` from `getMousePoint`.
2.  Log the `layer` being tested.
3.  Log the result of `isPointInPolygon`.
