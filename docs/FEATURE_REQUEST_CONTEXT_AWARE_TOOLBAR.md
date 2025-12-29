# Feature Request: Context-Aware Toolbar

**Created:** December 28, 2025  
**Status:** ✅ Implemented (v1.2.10)  
**Priority:** Medium (UX polish, reduces visual clutter)  
**Complexity:** Medium (~4 hours actual)

---

## Overview

Show only relevant toolbar controls based on the currently selected tool or layer. Hide stroke width, stroke color, fill color, and other style controls when they are not applicable (e.g., when using the Select tool with nothing selected). Display basic, relevant controls when a drawing tool is activated.

---

## Problem Statement

### Current Behavior

- All style controls (stroke width, stroke color, fill color, opacity, etc.) are always visible
- Toolbar is cluttered with options that don't apply to the current context
- New users may be overwhelmed by the number of controls
- Controls take up space even when not usable
- No visual indication of which controls affect the current tool/selection

### Desired Behavior

- Toolbar shows minimal controls by default (tool buttons only)
- When a drawing tool is selected, relevant style controls appear
- When a layer is selected, editing controls for that layer type appear
- Controls smoothly animate in/out for a polished experience
- Advanced options available via expandable panel or dropdown

---

## Industry Standards Research

### Adobe Photoshop
- **Options Bar**: Changes completely based on selected tool
- Brush tool shows: size, hardness, opacity, flow
- Rectangle tool shows: fill, stroke, corner radius
- Move tool shows: alignment options
- Context-sensitive throughout

### Figma
- **Right panel**: Shows properties based on selection
- No selection: Shows page/canvas properties
- Shape selected: Shows fill, stroke, effects
- Text selected: Shows typography options
- Multiple selection: Shows shared properties

### Sketch
- **Inspector panel**: Changes based on selection
- Tool-specific options appear temporarily
- Style controls only when relevant

### Canva
- **Floating toolbar**: Appears near selection
- Shows only relevant options for selected element
- Very minimal, beginner-friendly

### Recommended Approach
Hybrid model:
1. **Static tool buttons** (always visible)
2. **Dynamic style section** (shows/hides based on context)
3. **Contextual mini-toolbar** (optional, near selection)

---

## Toolbar Contexts

### Context 1: No Tool Selected / Select Tool (Nothing Selected)
```
┌────────────────────────────────────────────────────────┐
│ [Select][Rect][Circle][Arrow][Text][Path][Pan][Zoom]  │
└────────────────────────────────────────────────────────┘
```
- Only tool buttons visible
- No style controls (nothing to style)

### Context 2: Shape Tool Selected (Rectangle, Circle, etc.)
```
┌────────────────────────────────────────────────────────┐
│ [Select][Rect][Circle][Arrow][Text][Path][Pan][Zoom]  │
│ Fill: [■ #FF0000 ▼]  Stroke: [□ #000000 ▼] [2px ▼]   │
└────────────────────────────────────────────────────────┘
```
- Tool buttons + basic shape styling
- Fill color, stroke color, stroke width

### Context 3: Text Tool Selected
```
┌────────────────────────────────────────────────────────┐
│ [Select][Rect][Circle][Arrow][Text][Path][Pan][Zoom]  │
│ Font: [Arial ▼]  Size: [16 ▼]  [B][I]  Color: [■ ▼]  │
└────────────────────────────────────────────────────────┘
```
- Tool buttons + typography controls
- Font, size, bold, italic, color

### Context 4: Arrow/Line Tool Selected
```
┌────────────────────────────────────────────────────────┐
│ [Select][Rect][Circle][Arrow][Text][Path][Pan][Zoom]  │
│ Stroke: [■ #000000 ▼] [2px ▼]  Head: [Arrow ▼]       │
└────────────────────────────────────────────────────────┘
```
- Tool buttons + line styling
- Stroke color, width, arrowhead style

### Context 5: Layer Selected (Select Tool Active)
```
┌────────────────────────────────────────────────────────┐
│ [Select][Rect][Circle][Arrow][Text][Path][Pan][Zoom]  │
│ Fill: [■ #FF0000 ▼]  Stroke: [□ #000 ▼] [2px]  [⚙]   │
└────────────────────────────────────────────────────────┘
```
- Shows controls relevant to selected layer type
- Gear icon opens full properties panel
- Changes apply to selection immediately

---

## Control Groupings by Tool/Context

| Context | Controls Shown |
|---------|----------------|
| **Select (nothing)** | Tool buttons only |
| **Select (shape)** | Fill, Stroke color, Stroke width, Opacity |
| **Select (text)** | Font, Size, Bold, Italic, Color, Alignment |
| **Select (arrow)** | Stroke color, Width, Arrowhead style |
| **Select (image)** | Opacity, (no color controls) |
| **Select (multiple)** | Common properties only |
| **Rectangle/Ellipse** | Fill, Stroke color, Stroke width |
| **Text tool** | Font, Size, Bold, Italic, Color |
| **Arrow/Line** | Stroke color, Width, Arrowhead |
| **Path tool** | Stroke color, Width |
| **Pan/Zoom** | Tool buttons only |

---

## Implementation Plan

### Phase 1: Toolbar Refactoring (~10 hours)

1. **Create ToolbarContextManager.js** (~200 lines)
   - Determines current context (tool + selection)
   - Provides list of visible controls
   - Emits events on context change

2. **Refactor Toolbar.js**
   - Separate control creation from visibility
   - Add show/hide methods for control groups
   - Add animation support (CSS transitions)

3. **Create control group configuration**
   ```javascript
   const CONTROL_GROUPS = {
     shape: ['fill', 'strokeColor', 'strokeWidth', 'opacity'],
     text: ['fontFamily', 'fontSize', 'bold', 'italic', 'color'],
     arrow: ['strokeColor', 'strokeWidth', 'arrowhead'],
     image: ['opacity']
   };
   ```

### Phase 2: Event Integration (~8 hours)

4. **Listen to tool changes**
   - ToolManager emits 'toolChanged' event
   - ToolbarContextManager updates visible controls

5. **Listen to selection changes**
   - SelectionManager emits 'selectionChanged' event
   - Determine selected layer types
   - Update controls based on selection

6. **Handle mixed selections**
   - Multiple layers of same type: show all controls
   - Multiple layers of different types: show common controls only

### Phase 3: Animation & Polish (~6 hours)

7. **Add CSS transitions**
   - Smooth height/opacity animations
   - 200-300ms duration for natural feel
   - Prevent layout jumping

8. **Add visual grouping**
   - Subtle separators between control groups
   - Consistent spacing and alignment

9. **Mobile considerations**
   - Touch-friendly control sizes
   - Collapse to icons on narrow screens

### Phase 4: Testing (~6 hours)

10. **Add Jest tests**
    - Context determination logic
    - Control visibility mapping
    - Event handling

11. **Manual testing**
    - All tool/selection combinations
    - Animation smoothness
    - Edge cases (rapid tool switching)

---

## UI/UX Details

### Animation Specifications

```css
.layers-toolbar-controls {
  transition: max-height 0.25s ease-out, opacity 0.2s ease-out;
  overflow: hidden;
}

.layers-toolbar-controls.hidden {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}

.layers-toolbar-controls.visible {
  max-height: 60px;
  opacity: 1;
}
```

### Control Sizing

| Control Type | Width | Notes |
|--------------|-------|-------|
| Color picker | 32px | Square swatch |
| Dropdown | 80-120px | Varies by content |
| Number input | 50px | With stepper buttons |
| Toggle button | 32px | Bold, Italic, etc. |

### Keyboard Accessibility

- Tab navigates through visible controls only
- Hidden controls removed from tab order
- ARIA labels updated for context
- Screen reader announces context changes

---

## Configuration Options

```javascript
// extension.json or LocalSettings.php
$wgLayersToolbarMode = 'contextual';  // 'contextual' | 'always' | 'minimal'
```

| Mode | Behavior |
|------|----------|
| `contextual` | Default. Show controls based on tool/selection |
| `always` | Legacy mode. All controls always visible |
| `minimal` | Only tool buttons. Properties panel for all styling |

---

## Data Model Changes

None required. This is purely a UI/UX change.

---

## Backward Compatibility

- No breaking changes to data model
- Users who prefer old behavior can use `always` mode
- Default experience improves for all users

---

## Files to Modify

| File | Changes |
|------|---------|
| `Toolbar.js` | Refactor to support control groups, add show/hide logic |
| `ToolbarStyleControls.js` | Add visibility methods for each control group |
| `ToolManager.js` | Emit 'toolChanged' event with tool info |
| `SelectionManager.js` | Emit 'selectionChanged' with layer types |
| `toolbar.css` (new or existing) | Add transition styles |
| **New: `ToolbarContextManager.js`** | Context determination logic |

---

## Edge Cases

1. **Rapid tool switching**
   - Debounce control updates (50-100ms)
   - Cancel pending animations

2. **Selection during drawing**
   - Drawing tool takes precedence
   - Controls don't change mid-draw

3. **Empty selection after deletion**
   - Return to tool-only context
   - Smooth transition

4. **Preset application**
   - Controls update to reflect new values
   - No context change needed

5. **Properties panel open**
   - Toolbar and properties panel can coexist
   - Changes sync bidirectionally

---

## Accessibility Considerations

- Controls announce their visibility change
- "Style controls now visible" for screen readers
- Hidden controls have `aria-hidden="true"`
- Focus management when controls appear/disappear

---

## Success Criteria

- [ ] Toolbar shows only tool buttons when nothing selected
- [ ] Relevant controls appear when drawing tool selected
- [ ] Selected layer shows appropriate controls
- [ ] Animations are smooth (no jank)
- [ ] Keyboard navigation works correctly
- [ ] Configuration option to restore old behavior
- [ ] All existing toolbar tests pass
- [ ] New tests cover context switching
- [ ] Screen reader announces changes

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 1: Toolbar Refactoring | 10 |
| Phase 2: Event Integration | 8 |
| Phase 3: Animation & Polish | 6 |
| Phase 4: Testing | 6 |
| **Total** | **~30 hours** |

---

## Future Enhancements

1. **Floating mini-toolbar** near selection (like Figma)
2. **Customizable toolbar** (user chooses visible controls)
3. **Tool presets** (save favorite tool configurations)
4. **Quick-access favorites** (pin frequently used controls)
