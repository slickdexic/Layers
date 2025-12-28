# Feature Request: Layer Groups (Folders)

**Created:** December 28, 2025  
**Status:** ⏳ Proposed  
**Priority:** High (frequently requested feature in image editors)  
**Complexity:** High (~40-60 hours)

---

## Overview

Allow users to organize layers into collapsible groups (folders) in the Layer Panel. Groups can contain multiple layers and behave as a single unit for selection, movement, visibility, and other operations.

---

## Problem Statement

### Current Behavior

- All layers are displayed in a flat list
- No way to organize related layers together
- Selecting multiple layers requires Ctrl+click or Shift+click
- Moving multiple layers requires selecting each one
- Complex annotations with 20+ layers become difficult to manage

### Desired Behavior

- Layers can be placed inside group folders
- Groups can be collapsed/expanded to reduce visual clutter
- Selecting a group selects all child layers
- Moving a group moves all child layers together
- Groups have their own visibility toggle that affects all children
- Groups can be renamed like layers
- Nested groups (groups within groups) for complex hierarchies

---

## Use Cases

### 1. Anatomical Diagram
```
📁 Cardiovascular System
  ├── Heart outline
  ├── Arteries
  ├── Veins
  └── Labels
📁 Respiratory System
  ├── Lungs
  ├── Trachea
  └── Labels
📁 Background
  └── Body outline
```

### 2. Technical Diagram with Callouts
```
📁 Callouts
  ├── Callout 1: Motor
  ├── Callout 2: Controller
  └── Callout 3: Sensor
📁 Diagram Elements
  ├── Machine outline
  ├── Internal components
  └── Wiring
```

### 3. Before/After Comparison
```
📁 Before State
  ├── Original image overlay
  └── Problem indicators
📁 After State
  ├── Fixed image overlay
  └── Solution annotations
```

---

## User Interface Design

### Layer Panel Changes

```
┌─────────────────────────────────┐
│ Layers                      [+] │ ← New "Add Group" button
├─────────────────────────────────┤
│ 👁 📁 Cardiovascular System  ▼  │ ← Expanded group
│   👁 ○ Heart outline            │ ← Child layers indented
│   👁 ○ Arteries                 │
│   👁 ○ Veins                    │
├─────────────────────────────────┤
│ 👁 📁 Respiratory System    ▶   │ ← Collapsed group
├─────────────────────────────────┤
│ 👁 ○ Background layer           │ ← Ungrouped layer
└─────────────────────────────────┘
```

### Group Indicators

| Element | Description |
|---------|-------------|
| 📁 | Folder icon (replaces layer type icon) |
| ▼ / ▶ | Expand/collapse toggle |
| Indentation | Child layers indented 16-20px |
| Group visibility | Eye icon controls all children |

### Context Menu Options

**Right-click on group:**
- Rename Group
- Expand/Collapse
- Toggle Visibility
- Lock/Unlock All
- Delete Group (with confirmation)
- Ungroup (move children to root)

**Right-click on layer:**
- Move to Group → [submenu of groups]
- Remove from Group

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+G | Create group from selected layers |
| Ctrl+Shift+G | Ungroup selected group |
| Enter | Rename selected group |
| Left Arrow | Collapse group (when group selected) |
| Right Arrow | Expand group (when group selected) |

---

## Data Model Changes

### Current Layer Structure
```javascript
{
  id: "abc123",
  type: "rectangle",
  x: 100, y: 200,
  // ... other properties
}
```

### New Group Structure
```javascript
{
  id: "group-xyz",
  type: "group",
  name: "Cardiovascular System",
  visible: true,
  locked: false,
  expanded: true,
  children: ["abc123", "def456", "ghi789"]  // Layer IDs in order
}
```

### Layer with Parent Reference
```javascript
{
  id: "abc123",
  type: "rectangle",
  parentGroup: "group-xyz",  // Optional parent reference
  // ... other properties
}
```

### Alternative: Nested Array Structure
```javascript
// All layers stored flat, groups reference children by ID
layers: [
  { id: "group-1", type: "group", children: ["layer-1", "layer-2"] },
  { id: "layer-1", type: "rectangle", parentGroup: "group-1" },
  { id: "layer-2", type: "circle", parentGroup: "group-1" },
  { id: "layer-3", type: "text" }  // Ungrouped
]
```

---

## Implementation Plan

### Phase 1: Data Model & Basic UI (~15 hours)

1. **Update data model**
   - Add `type: "group"` layer type
   - Add `parentGroup` property to layers
   - Add `children`, `expanded` properties to groups
   - Update LayersValidator for group validation

2. **Update LayerPanel.js**
   - Render groups with folder icon
   - Implement indentation for child layers
   - Add expand/collapse toggle
   - Update drag-drop to handle groups

3. **Update StateManager**
   - Add `getLayersByGroup()` method
   - Add `getGroupChildren()` method
   - Handle group visibility cascading

### Phase 2: Selection & Interaction (~15 hours)

4. **Update SelectionManager**
   - Selecting group selects all children
   - Multi-selection includes group children
   - Deselecting group deselects all children

5. **Update CanvasManager**
   - Group selection shows combined bounding box
   - Moving group moves all children
   - Resizing group resizes all children proportionally

6. **Update TransformController**
   - Handle group transforms
   - Maintain relative positions within group

### Phase 3: Context Menu & Keyboard (~10 hours)

7. **Add group context menu**
   - Rename, expand/collapse, visibility, delete, ungroup

8. **Add keyboard shortcuts**
   - Ctrl+G to group, Ctrl+Shift+G to ungroup

9. **Add "New Group" button**
   - Creates empty group
   - Drag layers into group

### Phase 4: Persistence & Testing (~10 hours)

10. **Update API serialization**
    - Groups saved/loaded correctly
    - Backward compatibility with non-group data

11. **Add comprehensive tests**
    - Group creation, deletion, nesting
    - Selection, movement, visibility
    - Serialization/deserialization

---

## Server-Side Changes

### Validation Whitelist Updates

Add to `ServerSideLayerValidator.php`:
```php
'group' => [
    'id', 'type', 'name', 'visible', 'locked', 
    'expanded', 'children', 'parentGroup'
]
```

### Maximum Nesting Depth

- Recommended limit: 3 levels deep
- Prevents infinite recursion
- Configuration: `$wgLayersMaxGroupDepth` (default: 3)

---

## Industry Standard References

### Adobe Photoshop
- Groups called "Layer Groups"
- Folder icon with expand/collapse
- Group visibility, opacity, blend mode
- Nested groups supported
- Keyboard: Ctrl+G / Ctrl+Shift+G

### Figma
- Groups called "Frames" or "Groups"
- Auto-layout within groups
- Groups have their own constraints
- Nested groups common

### Sketch
- Groups with folder metaphor
- Click group selects all children
- Double-click enters group for editing

### Recommended Approach
Follow Photoshop model as closest to user expectations for image annotation:
- Simple folder metaphor
- Visibility toggle affects children
- No auto-layout (too complex for annotations)
- Support 2-3 levels of nesting

---

## Edge Cases

1. **Moving layer between groups**
   - Remove from old group's children array
   - Add to new group's children array
   - Update layer's parentGroup

2. **Deleting a group**
   - Option A: Delete group and all children (destructive)
   - Option B: Ungroup first, then delete empty group (safe)
   - Recommendation: Use Option B with confirmation dialog

3. **Copy/paste group**
   - Deep copy all children
   - Generate new IDs for group and children
   - Maintain internal structure

4. **Undo/redo with groups**
   - History snapshots include full group state
   - Undoing group creation restores children to ungrouped state

5. **Empty groups**
   - Allow empty groups (useful for drag-drop targets)
   - Show "(empty)" indicator

---

## Accessibility

- Groups announced as "Group: [name], [n] items, [expanded/collapsed]"
- Arrow keys navigate group structure
- Enter key expands/collapses group
- Tab key moves focus to group children
- Shift+Tab moves focus to parent group

---

## Migration

- Existing layer sets have no groups (backward compatible)
- Schema version bump recommended (schema: 2)
- Old clients ignore group properties gracefully

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 1: Data Model & Basic UI | 15 |
| Phase 2: Selection & Interaction | 15 |
| Phase 3: Context Menu & Keyboard | 10 |
| Phase 4: Persistence & Testing | 10 |
| **Total** | **~50 hours** |

---

## Success Criteria

- [ ] Users can create, rename, delete groups
- [ ] Layers can be dragged into/out of groups
- [ ] Groups can be expanded/collapsed
- [ ] Selecting group selects all children
- [ ] Moving group moves all children
- [ ] Group visibility toggle works
- [ ] Keyboard shortcuts work
- [ ] Groups persist correctly
- [ ] All existing tests still pass
- [ ] 90%+ test coverage on new code
