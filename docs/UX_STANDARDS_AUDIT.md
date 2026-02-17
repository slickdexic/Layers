# UX Standards Audit - Layers Editor vs Industry Standards

**Date:** February 12, 2026  
**Version:** 1.5.58  
**Compared Against:** Figma, Canva, Adobe Photoshop, Sketch, Google Drawings

---

## Executive Summary

The Layers editor is **95% compliant** with modern design tool conventions. Users familiar with Figma, Canva, or Photoshop will feel comfortable with the core interactions. All high-priority features have been implemented.

### Overall Score: A

| Category | Score | Status |
|----------|-------|--------|
| Core Drawing Tools | A | ✅ Excellent |
| Selection & Transform | B+ | ✅ Good |
| Keyboard Shortcuts | A | ✅ Industry-standard |
| Color Picker | A | ✅ Complete with eyedropper |
| Alignment Tools | A | ✅ Fully implemented |
| Snapping & Guides | A | ✅ Smart Guides implemented |
| Layer Operations | B+ | ✅ Good |
| Undo/Redo | A | ✅ Excellent |
| Accessibility | A | ✅ WCAG 2.1 compliant |

---

## Detailed Analysis

### ✅ COMPLIANT - Core Drawing Tools

**What users expect:** 11+ drawing tools with intuitive behavior  
**What we have:** 17 tools (Pointer, Text, Text Box, Callout, Pen, Rectangle, Circle, Ellipse, Polygon, Star, Arrow, Line, Marker, Dimension, Custom Shape, Emoji, Image). Shape library with 5,116 shapes in 12 categories.

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Basic shapes | ✅ | ✅ | ✅ | Full parity |
| Freehand pen | ✅ | ✅ | ✅ | Smooth paths |
| Text tool | ✅ | ✅ | ✅ | Click-to-type |
| Text box | ✅ | ✅ | ✅ | Multi-line, word wrap |
| Arrow tool | ✅ | ✅ | ✅ | Multiple head types |
| Blur effect | ❌ | ✅ | ✅ | Via fill='blur' on any shape |
| Polygon | ✅ | ✅ | ✅ | Configurable sides |
| Star | ✅ | ✅ | ✅ | Configurable points |

**Verdict:** ✅ Excellent - Full feature parity

---

### ✅ COMPLIANT - Selection & Transform

**What users expect:** Click-to-select, multi-select, resize handles, rotation  
**What we have:** All core behaviors implemented

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Click to select | ✅ | ✅ | ✅ | |
| Multi-select (Shift+Click) | ✅ | ✅ | ✅ | Ctrl/Cmd also works |
| Marquee selection | ✅ | ✅ | ✅ | M key |
| Resize handles | ✅ | ✅ | ✅ | 8 handles + rotation |
| Shift = constrain proportions | ✅ | ✅ | ✅ | Implemented |
| Rotation handle | ✅ | ✅ | ✅ | |
| Move selected | ✅ | ✅ | ✅ | Drag or arrow keys |
| Bounding box | ✅ | ✅ | ✅ | |

**Verdict:** ✅ Good - Core behaviors work as expected

---

### ✅ COMPLIANT - Keyboard Shortcuts

**What users expect:** Industry-standard shortcuts (V=select, Ctrl+Z=undo, etc.)  
**What we have:** Full compliance with standards

| Shortcut | Standard | Layers | Notes |
|----------|----------|--------|-------|
| V | Select/Pointer | ✅ | |
| T | Text | ✅ | |
| R | Rectangle | ✅ | |
| C | Circle | ✅ | |
| P | Pen | ✅ | |
| Ctrl+Z | Undo | ✅ | |
| Ctrl+Y | Redo | ✅ | |
| Ctrl+Shift+Z | Redo (alt) | ✅ | |
| Ctrl+C/V | Copy/Paste | ✅ | With offset |
| Delete | Delete layer | ✅ | |
| Shift+? | Help | ✅ | Modal dialog |

**Verdict:** ✅ Excellent - Users will feel at home

---

### ⚠️ PARTIAL - Color Picker

**What users expect:** Color swatches, hex input, recent colors, eyedropper  
**What we have:** Swatches, hex input, saved colors, eyedropper via browser's native color picker

| Feature | Figma | Canva | Layers | Priority |
|---------|-------|-------|--------|----------|
| Standard palette | ✅ | ✅ | ✅ | |
| Hex input | ✅ | ✅ | ✅ | |
| Recent/saved colors | ✅ | ✅ | ✅ | 16 slots |
| Opacity slider | ✅ | ✅ | ✅ | In properties panel |
| Eyedropper | ✅ | ✅ | ✅ | Native picker |
| Gradient | ✅ | ✅ | ✅ | 6 presets + custom |

**Verdict:** ✅ Complete with gradients and opacity

---

### ✅ COMPLIANT - Alignment & Distribution

**What users expect:** Align left/center/right, top/middle/bottom, distribute evenly  
**What we have:** Full implementation via AlignmentController

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Align left | ✅ | ✅ | ✅ | |
| Align center (H) | ✅ | ✅ | ✅ | |
| Align right | ✅ | ✅ | ✅ | |
| Align top | ✅ | ✅ | ✅ | |
| Align middle (V) | ✅ | ✅ | ✅ | |
| Align bottom | ✅ | ✅ | ✅ | |
| Distribute horizontally | ✅ | ✅ | ✅ | |
| Distribute vertically | ✅ | ✅ | ✅ | |

**Verdict:** ✅ Full feature parity

---

### ✅ COMPLIANT - Snapping & Smart Guides

**What users expect:** Snap to grid, snap to objects, smart alignment guides  
**What we have:** Full implementation via SmartGuidesController

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Snap to grid | ✅ | ✅ | ✅ | |
| Toggle grid | ✅ | ✅ | ✅ | |
| Rulers | ✅ | ✅ | ✅ | |
| Custom guides | ✅ | ✅ | ✅ | |
| Smart guides (object snap) | ✅ | ✅ | ✅ | Version-cached |
| Center snap | ✅ | ✅ | ✅ | |
| Edge snap | ✅ | ✅ | ✅ | |
| Canvas snap | ✅ | ✅ | ✅ | On by default |

**Verdict:** ✅ Full feature parity

---

### ✅ COMPLIANT - Layer Panel Operations

**What users expect:** Visibility, lock, reorder, rename, duplicate  
**What we have:** Full implementation

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Visibility toggle | ✅ | ✅ | ✅ | Eye icon |
| Lock layer | ✅ | ✅ | ✅ | Lock icon |
| Rename layer | ✅ | ✅ | ✅ | Double-click |
| Drag reorder | ✅ | ✅ | ✅ | |
| Duplicate | ✅ | ✅ | ✅ | |
| Delete | ✅ | ✅ | ✅ | |
| Multi-select in panel | ✅ | ✅ | ✅ | |

**Verdict:** ✅ Good - All expected features present

---

### ✅ COMPLIANT - Object Operations

**What users expect:** Flip horizontal/vertical, group/ungroup  
**What we have:** Full implementation via GroupManager

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Flip horizontal | ✅ | ✅ | ✅ | |
| Flip vertical | ✅ | ✅ | ✅ | |
| Group layers | ✅ | ✅ | ✅ | Folders |
| Ungroup | ✅ | ✅ | ✅ | |
| Boolean operations | ✅ | ❌ | ❌ | Not planned |

**Verdict:** ✅ Full feature parity

---

### ✅ COMPLIANT - Undo/Redo System

**What users expect:** Unlimited undo, granular history  
**What we have:** HistoryManager with proper state management

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Undo (Ctrl+Z) | ✅ | ✅ | ✅ | |
| Redo (Ctrl+Y) | ✅ | ✅ | ✅ | |
| Multiple undo levels | ✅ | ✅ | ✅ | |
| State snapshot | ✅ | ✅ | ✅ | Deep clone |

**Verdict:** ✅ Excellent

---

### ✅ COMPLIANT - Accessibility

**What users expect:** Keyboard navigation, screen reader support  
**What we have:** WCAG 2.1 Level AA compliance

| Feature | Required | Layers | Notes |
|---------|----------|--------|-------|
| Skip links | WCAG 2.4.1 | ✅ | Jump to toolbar/canvas/panel |
| ARIA landmarks | WCAG 1.3.1 | ✅ | All major sections |
| Keyboard shortcuts | WCAG 2.1.1 | ✅ | Full support |
| Focus indicators | WCAG 2.4.7 | ✅ | Visible focus |
| Screen reader | WCAG 1.3.1 | ✅ | Live regions |

**Verdict:** ✅ Excellent - Industry-leading for this category

---

## Priority Recommendations

### High Priority (Should fix soon)

1. ~~**Alignment & Distribution**~~ ✅ COMPLETED
   - ~~Add toolbar buttons: Align Left, Center, Right, Top, Middle, Bottom~~
   - ~~Enable when 2+ layers selected~~
   - Implemented in v1.1.5

2. ~~**Smart Guides**~~ ✅ COMPLETED
   - ~~Show guide lines when dragging near other object edges/centers~~
   - ~~Snap to those positions~~
   - Implemented in v1.1.7

3. ~~**Eyedropper Tool**~~ ✅ COMPLETED
   - Available via browser's native color picker
   - No standalone tool needed

### Medium Priority (Nice to have)

4. **Flip Horizontal/Vertical**
   - Add to right-click context menu or toolbar
   - Estimated effort: 1 day

5. **Opacity in Color Picker**
   - Add slider directly in color picker dialog
   - Estimated effort: 1 day

6. **Distribute Evenly**
   - When 3+ layers selected, space them evenly
   - Estimated effort: 1 day

### Low Priority (Future consideration)

7. **Group/Ungroup Layers**
   - Complex: requires nested layer handling
   - Estimated effort: 5-7 days

8. **Gradient Fills**
   - Linear and radial gradients
   - Estimated effort: 3-5 days

---

## Conclusion

Layers is a **production-ready** annotation editor that meets the expectations of casual users and professional use cases. The core editing experience matches industry standards.

**Completed High Priority Items:**
- ✅ **Alignment tools** - Full implementation with key object support
- ✅ **Smart guides** - Object-to-object snapping with visual guides
- ✅ **Eyedropper** - Available via browser's native color picker

With all high-priority items addressed, Layers earns an **A rating** for UX standards compliance.
