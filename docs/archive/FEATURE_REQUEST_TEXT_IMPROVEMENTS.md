# Feature Request: Enhanced Text Layer Capabilities

**Created:** December 8, 2025  
**Status:** Documented  
**Priority:** Medium-High (Core UX improvement)

---

## Overview

This document captures a comprehensive set of improvements to the text layer functionality in the Layers extension. The goal is to transform text layers from simple single-line labels into full-featured text containers suitable for annotations, callouts, and rich content.

---

## Phase 1: Core Text Improvements (High Priority)

### 1.1 Font Size Independence from Drag Handles

**Current Behavior:**
- Text layers can be scaled using drag handles, which affects the visual size
- Font size and handle-scaling are conflated

**Requested Behavior:**
- Font size should be the ONLY factor determining text rendering size
- Drag handles should resize the TEXT CONTAINER, not scale the text itself
- Font size range: **5px to 1500px** (expanded from current limits)

**Implementation Notes:**
- Remove scale transforms from text layers
- Text container width/height should be independent properties
- Text should reflow within the container bounds

### 1.2 Multi-line Text Support

**Current Behavior:**
- Single-line text input only
- No line breaks supported

**Requested Behavior:**
- Support for multi-line text entry
- Paragraph support with proper line spacing
- Text should wrap within container bounds
- Manual line breaks (Enter key) should be preserved

**Implementation Notes:**
- Change text input from `<input type="text">` to `<textarea>`
- Store text with newline characters preserved
- Render with proper line-height and word-wrap
- Consider `white-space: pre-wrap` for rendering

### 1.3 Container-Relative Text Alignment

**Current Behavior:**
- No text alignment options

**Requested Behavior:**
- Horizontal alignment: Left, Center, Right, Justify
- Vertical alignment: Top, Middle, Bottom
- Alignment is relative to the text container bounds

**Implementation Notes:**
- Add `textAlign` property: `'left' | 'center' | 'right' | 'justify'`
- Add `verticalAlign` property: `'top' | 'middle' | 'bottom'`
- Update LayerRenderer to respect alignment when drawing text
- Update PropertiesForm to include alignment controls

### 1.4 Container Constraints

**Current Behavior:**
- No minimum size enforcement

**Requested Behavior:**
- Container minimum size should be based on text content
- Cannot resize container smaller than the text requires
- Auto-expand option when text exceeds bounds

**Implementation Notes:**
- Calculate text bounding box using canvas measureText or TextUtils
- Enforce minimum width/height during resize operations
- Consider "auto-size" vs "fixed-size" container modes

### 1.5 In-Canvas Text Editing

**Current Behavior:**
- Text can only be edited via the Properties panel in the Layer Manager
- Double-clicking a text layer does nothing

**Requested Behavior:**
- Double-click on a text layer to enter edit mode directly on the canvas
- Inline text editor appears at the text layer's position
- Edit text in-place with immediate visual feedback
- Press Enter to confirm (or Shift+Enter for newline in multi-line mode)
- Press Escape to cancel editing
- Clicking outside the text editor confirms changes

**Implementation Notes:**
- Add double-click detection in CanvasEvents for text layers
- Create inline text editor overlay positioned at layer coordinates
- Editor should match layer's font size, family, and color
- Apply zoom/pan transforms to position editor correctly
- Update layer data on confirmation
- Save state for undo/redo support
- Consider cursor positioning within existing text

**UX Flow:**
1. User double-clicks text layer on canvas
2. Text layer enters "edit mode" with visible text cursor
3. Existing text is selected or cursor is placed
4. User types/modifies text
5. Enter or click-outside confirms, Escape cancels
6. Layer updates and edit mode exits

---

## Phase 2: Container Styling (Medium Priority)

These features would make text layers function like styled text boxes, similar to callouts in presentation software.

### 2.1 Container Stroke

**Properties:**
- `containerStroke`: Color (e.g., `'#000000'`)
- `containerStrokeWidth`: Number (0-20px)
- `containerStrokeOpacity`: Number (0-1)
- `containerStrokeStyle`: `'solid' | 'dashed' | 'dotted'`

### 2.2 Container Fill

**Properties:**
- `containerFill`: Color (e.g., `'#ffffff'`)
- `containerFillOpacity`: Number (0-1)

### 2.3 Container Corner Radius

**Properties:**
- `containerBorderRadius`: Number (0-100px)
- Optional: Individual corner radii (`containerBorderRadiusTL`, etc.)

### 2.4 Container Padding

**Properties:**
- `containerPadding`: Number or `{top, right, bottom, left}`
- Affects text positioning within the container

---

## Phase 3: Advanced Features (Lower Priority / Future)

### 3.1 Speech Bubble / Callout Pointers

**Description:**
Add optional "pointer" or "tail" to text containers, creating speech bubbles or callout boxes.

**Properties:**
- `bubblePointer`: `'none' | 'triangle' | 'rounded'`
- `bubblePointerPosition`: `'top' | 'bottom' | 'left' | 'right'`
- `bubblePointerOffset`: Number (position along edge, 0-100%)
- `bubblePointerSize`: Number (size of pointer)

**Visual Examples:**
```
   ┌──────────────┐
   │  Some text   │
   └──────┬───────┘
          ▼         <- pointer

   ┌──────────────┐
   │  Some text   │◄─ pointer
   └──────────────┘
```

### 3.2 Text Effects

**Potential Properties:**
- `textShadow`: Boolean or shadow configuration
- `textOutline`: Stroke around text characters
- `textBackground`: Highlight behind text (like marker)
- `letterSpacing`: Adjust character spacing
- `lineHeight`: Control line spacing for multi-line text

### 3.3 Rich Text (Long-term)

**Description:**
Support for mixed formatting within a single text layer.

**Potential Features:**
- Bold, italic, underline for selected portions
- Multiple font sizes within one layer
- Hyperlinks (for wiki integration)
- Bullet/numbered lists

**Note:** This would require significant architecture changes and may be better as a separate "Rich Text Layer" type.

---

## Data Model Changes

### Current Text Layer Schema
```javascript
{
  type: 'text',
  id: string,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  fontFamily: string,
  color: string,
  rotation: number,
  visible: boolean,
  locked: boolean
}
```

### Proposed Text Layer Schema (Phase 1 + 2)
```javascript
{
  type: 'text',
  id: string,
  x: number,
  y: number,
  width: number,           // Container width (NEW)
  height: number,          // Container height (NEW)
  text: string,            // Now supports \n for newlines
  fontSize: number,        // Range: 5-1500
  fontFamily: string,
  color: string,
  textAlign: string,       // 'left' | 'center' | 'right' | 'justify' (NEW)
  verticalAlign: string,   // 'top' | 'middle' | 'bottom' (NEW)
  rotation: number,
  visible: boolean,
  locked: boolean,
  
  // Container styling (Phase 2)
  containerStroke: string,
  containerStrokeWidth: number,
  containerStrokeOpacity: number,
  containerFill: string,
  containerFillOpacity: number,
  containerBorderRadius: number,
  containerPadding: number,
  
  // Bubble pointer (Phase 3)
  bubblePointer: string,
  bubblePointerPosition: string,
  bubblePointerOffset: number,
  bubblePointerSize: number
}
```

---

## Server-Side Validation Updates

The `ServerSideLayerValidator` will need updates to:

1. Expand `fontSize` range validation (5-1500)
2. Add new properties to whitelist:
   - `width`, `height` (for container dimensions)
   - `textAlign`, `verticalAlign`
   - All `container*` properties
   - All `bubblePointer*` properties
3. Add enum validation for alignment values
4. Add range validation for new numeric properties

---

## UI/UX Considerations

### Properties Panel Updates
- Font size slider/input: 5px - 1500px range
- Text alignment buttons (like word processor)
- Vertical alignment dropdown
- Container section (collapsible):
  - Stroke color picker + width + opacity
  - Fill color picker + opacity
  - Border radius slider
  - Padding input

### Text Input Modal Updates
- Change from single-line input to textarea
- Add formatting hints or preview
- Consider live preview in modal

### Resize Behavior
- Corner handles: Resize container (aspect ratio optional)
- Edge handles: Resize container width or height independently
- No scaling of text content
- Visual indicator when at minimum size

---

## Implementation Order Recommendation

1. **Font size range expansion** (Quick win)
2. **Multi-line text support** (High impact)
3. **Container width/height properties** (Foundation for alignment)
4. **Text alignment** (Natural follow-up)
5. **Container minimum size constraints** (UX polish)
6. **Container fill/stroke** (Visual enhancement)
7. **Border radius** (Visual enhancement)
8. **Bubble pointers** (Advanced feature)

---

## Related Files

Files likely to be modified:

- `resources/ext.layers.editor/CanvasManager.js` - Text input modal
- `resources/ext.layers.shared/LayerRenderer.js` - Text rendering
- `resources/ext.layers.editor/ui/PropertiesForm.js` - Properties panel
- `resources/ext.layers.editor/canvas/TransformController.js` - Resize behavior
- `resources/ext.layers.editor/LayersValidator.js` - Client validation
- `src/Validation/ServerSideLayerValidator.php` - Server validation
- `resources/ext.layers.editor/GeometryUtils.js` - Bounds calculation
- `resources/ext.layers.editor/TextUtils.js` - Text measurement

---

## References

- Original request: User feedback, December 8, 2025
- Related issue: Text layer creation fix (same session)

---

*Document created by GitHub Copilot (Claude Opus 4.5)*
