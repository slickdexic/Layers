# UX Standards Audit - Layers Editor vs Industry Standards

**Date:** December 18, 2025  
**Version:** 1.1.5  
**Compared Against:** Figma, Canva, Adobe Photoshop, Sketch, Google Drawings

---

## Executive Summary

The Layers editor is **80% compliant** with modern design tool conventions. Users familiar with Figma, Canva, or Photoshop will feel comfortable with the core interactions. However, several features expected by power users are missing.

### Overall Score: B+

| Category | Score | Status |
|----------|-------|--------|
| Core Drawing Tools | A | ✅ Excellent |
| Selection & Transform | B+ | ✅ Good |
| Keyboard Shortcuts | A | ✅ Industry-standard |
| Color Picker | B | ⚠️ Missing eyedropper |
| Alignment Tools | D | ❌ Not implemented |
| Snapping & Guides | C+ | ⚠️ Basic implementation |
| Layer Operations | B+ | ✅ Good |
| Undo/Redo | A | ✅ Excellent |
| Accessibility | A | ✅ WCAG 2.1 compliant |

---

## Detailed Analysis

### ✅ COMPLIANT - Core Drawing Tools

**What users expect:** 13+ drawing tools with intuitive behavior  
**What we have:** 13 tools (Pointer, Zoom, Text, Text Box, Pen, Rectangle, Circle, Ellipse, Polygon, Star, Arrow, Line, Blur)

| Feature | Figma | Canva | Layers | Notes |
|---------|-------|-------|--------|-------|
| Basic shapes | ✅ | ✅ | ✅ | Full parity |
| Freehand pen | ✅ | ✅ | ✅ | Smooth paths |
| Text tool | ✅ | ✅ | ✅ | Click-to-type |
| Text box | ✅ | ✅ | ✅ | Multi-line, word wrap |
| Arrow tool | ✅ | ✅ | ✅ | Multiple head types |
| Blur/redact | ❌ | ✅ | ✅ | Privacy feature |
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
**What we have:** Swatches, hex input, saved colors, NO eyedropper

| Feature | Figma | Canva | Layers | Priority |
|---------|-------|-------|--------|----------|
| Standard palette | ✅ | ✅ | ✅ | |
| Hex input | ✅ | ✅ | ✅ | |
| Recent/saved colors | ✅ | ✅ | ✅ | 16 slots |
| Opacity slider | ✅ | ✅ | ❌ | Medium |
| Eyedropper | ✅ | ✅ | ❌ | High |
| Gradient | ✅ | ✅ | ❌ | Low |

**Missing Features:**
1. **Eyedropper tool** - Pick color from canvas/image (High priority)
2. **Opacity in color picker** - Currently separate control (Medium priority)
3. **Gradient fill** - Not essential for annotations (Low priority)

**Verdict:** ⚠️ Functional but missing eyedropper

---

### ❌ MISSING - Alignment & Distribution

**What users expect:** Align left/center/right, top/middle/bottom, distribute evenly  
**What we have:** NOT IMPLEMENTED

| Feature | Figma | Canva | Layers | Priority |
|---------|-------|-------|--------|----------|
| Align left | ✅ | ✅ | ❌ | High |
| Align center (H) | ✅ | ✅ | ❌ | High |
| Align right | ✅ | ✅ | ❌ | High |
| Align top | ✅ | ✅ | ❌ | High |
| Align middle (V) | ✅ | ✅ | ❌ | High |
| Align bottom | ✅ | ✅ | ❌ | High |
| Distribute horizontally | ✅ | ✅ | ❌ | Medium |
| Distribute vertically | ✅ | ✅ | ❌ | Medium |

**Impact:** Users with multiple annotations cannot easily align them. This is a significant gap for professional use.

**Recommendation:** Implement alignment toolbar buttons for multi-selection scenarios.

**Verdict:** ❌ Critical gap for power users

---

### ⚠️ PARTIAL - Snapping & Smart Guides

**What users expect:** Snap to grid, snap to objects, smart alignment guides  
**What we have:** Basic snap-to-grid, guides from rulers, NO smart guides

| Feature | Figma | Canva | Layers | Priority |
|---------|-------|-------|--------|----------|
| Snap to grid | ✅ | ✅ | ✅ | Implemented |
| Toggle grid | ✅ | ✅ | ✅ | In state |
| Rulers | ✅ | ✅ | ✅ | Drag-to-create guides |
| Custom guides | ✅ | ✅ | ✅ | Drag from rulers |
| Smart guides (object snap) | ✅ | ✅ | ❌ | High |
| Center snap | ✅ | ✅ | ❌ | High |
| Edge snap | ✅ | ✅ | ❌ | Medium |

**Missing Features:**
1. **Smart guides** - Lines that appear when objects align (High priority)
2. **Snap to object centers** - Align with other layer centers
3. **Snap to object edges** - Align with other layer edges

**Verdict:** ⚠️ Basic snapping works, needs smart guides

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

### ❌ MISSING - Object Operations

**What users expect:** Flip horizontal/vertical, group/ungroup  
**What we have:** NOT IMPLEMENTED

| Feature | Figma | Canva | Layers | Priority |
|---------|-------|-------|--------|----------|
| Flip horizontal | ✅ | ✅ | ❌ | Medium |
| Flip vertical | ✅ | ✅ | ❌ | Medium |
| Group layers | ✅ | ✅ | ❌ | Medium |
| Ungroup | ✅ | ✅ | ❌ | Medium |
| Boolean operations | ✅ | ❌ | ❌ | Low |

**Impact:** Users cannot flip mirrored annotations or group related elements.

**Verdict:** ❌ Missing but not critical for annotation use case

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

1. **Alignment Tools**
   - Add toolbar buttons: Align Left, Center, Right, Top, Middle, Bottom
   - Enable when 2+ layers selected
   - Estimated effort: 2-3 days

2. **Smart Guides**
   - Show guide lines when dragging near other object edges/centers
   - Snap to those positions
   - Estimated effort: 3-5 days

3. **Eyedropper Tool**
   - Pick color from anywhere on canvas
   - Use in color picker or as standalone tool
   - Estimated effort: 1-2 days

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

Layers is a **production-ready** annotation editor that meets the expectations of casual users and many professional use cases. The core editing experience matches industry standards.

The main gaps are:
- **Alignment tools** - Critical for multi-element layouts
- **Smart guides** - Expected by Figma/Sketch users
- **Eyedropper** - Standard color picking feature

Addressing the High Priority items would elevate Layers from "good enough" to "professional grade" and earn an **A rating**.
