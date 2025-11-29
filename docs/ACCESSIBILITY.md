# Accessibility Guide

This document describes the accessibility features of the Layers extension and provides guidance for contributors to maintain and improve accessibility compliance.

## Current Accessibility Features

### ARIA Attributes

The editor implements ARIA (Accessible Rich Internet Applications) attributes throughout the UI:

| Element | ARIA Attribute | Purpose |
|---------|---------------|---------|
| Main container | `aria-label="Layers Image Editor"` | Identifies the editor region |
| Title | `aria-level="1"` | Semantic heading level |
| Zoom readout | `aria-label="Current zoom level"` | Describes zoom display |
| Decorative separators | `aria-hidden="true"` | Hides non-content elements |
| Set selector | `aria-label` (i18n key) | Describes the layer set dropdown |
| Revision selector | `aria-label` (i18n key) | Describes revision dropdown |
| Close button | `aria-label` (i18n key) | Describes close action |
| Spinner/loading | `aria-live="polite"` | Announces loading state changes |
| Icons (decorative) | `aria-hidden="true"` | Hides decorative SVG icons |
| Range sliders | `aria-label` | Describes slider purpose |

### Keyboard Navigation

#### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `V` | Select pointer/selection tool |
| `T` | Select text tool |
| `P` | Select pen/path tool |
| `R` | Select rectangle tool |
| `C` | Select circle tool |
| `B` | Select blur tool |
| `A` | Select arrow tool |
| `L` | Select line tool |
| `H` | Select highlight tool |
| `G` | Toggle grid |
| `Delete` / `Backspace` | Delete selected layer(s) |
| `Escape` | Cancel current operation / deselect |

#### With Ctrl/Cmd Modifier

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+D` | Duplicate selected |
| `Ctrl+C` | Copy selected |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all layers |
| `Ctrl++` / `Ctrl+=` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom to 100% |

#### Selection Nudging

| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Nudge selected layer(s) by 1px |
| `Shift + Arrow Keys` | Nudge selected layer(s) by 10px |

#### Dialog Navigation

- `Escape` - Close dialogs
- `Tab` / `Shift+Tab` - Navigate between dialog controls
- Focus trapping is implemented in modal dialogs

### Focus Management

- Modal dialogs implement focus trapping to prevent focus from escaping
- When dialogs open, focus moves to the first focusable element
- When dialogs close, focus returns to the triggering element
- Input fields properly receive focus when needed (e.g., new set name input)

### Screen Reader Support

The extension uses MediaWiki's internationalization system (`mw.message()`) for all user-facing text, ensuring:
- All text can be translated
- Text is provided as proper strings rather than images
- Dynamic content updates use `aria-live` regions

## Known Accessibility Gaps

### High Priority

1. **Canvas Content Not Accessible**
   - The HTML5 canvas element is inherently inaccessible to screen readers
   - Layer content (shapes, text, annotations) cannot be read by assistive technology
   - **Recommendation**: Add a screen-reader-only layer list describing visible layers

2. **No Skip Links**
   - Users cannot quickly skip to main content areas
   - **Recommendation**: Add skip links to toolbar, canvas, and layer panel

3. **Color Contrast Not Verified**
   - CSS colors have not been audited for WCAG 2.1 AA contrast ratios
   - **Recommendation**: Audit and fix color contrast issues

4. **Missing Landmarks**
   - No ARIA landmark roles (`main`, `navigation`, `region`)
   - **Recommendation**: Add appropriate landmark roles to major sections

### Medium Priority

5. **Visual-Only Feedback**
   - Some operations only provide visual feedback (e.g., layer selection highlighting)
   - **Recommendation**: Add `aria-live` announcements for state changes

6. **Mouse-Dependent Interactions**
   - Drawing tools require mouse/touch interaction
   - Some resize/rotate handles are only mouse-accessible
   - **Recommendation**: Add keyboard alternatives for common operations

7. **Color Picker Accessibility**
   - Color picker relies heavily on mouse interaction
   - **Recommendation**: Add keyboard navigation and color value inputs

### Low Priority

8. **Animation/Motion**
   - No `prefers-reduced-motion` media query support
   - **Recommendation**: Respect user motion preferences

9. **High Contrast Mode**
   - Not tested with Windows High Contrast Mode
   - **Recommendation**: Test and add high contrast stylesheet

## Guidelines for Contributors

### Adding New UI Elements

1. **Always add ARIA attributes**
   ```javascript
   element.setAttribute('aria-label', this.msg('layers-element-label'));
   ```

2. **Use semantic HTML when possible**
   ```javascript
   // Prefer <button> over <div> for clickable elements
   const btn = document.createElement('button');
   btn.setAttribute('type', 'button');
   ```

3. **Ensure keyboard accessibility**
   ```javascript
   // Add tabindex if element should be focusable
   element.setAttribute('tabindex', '0');
   
   // Handle both click and keyboard activation
   element.addEventListener('click', handler);
   element.addEventListener('keydown', (e) => {
       if (e.key === 'Enter' || e.key === ' ') {
           handler(e);
       }
   });
   ```

### Adding New Keyboard Shortcuts

1. Check for conflicts with existing shortcuts in Toolbar.js and EventHandler.js
2. Avoid conflicts with browser/OS shortcuts
3. Document shortcuts in this file
4. Make shortcuts discoverable (tooltips with shortcut hints)

### Testing Accessibility

Before submitting changes:

1. **Keyboard Navigation**: Navigate the entire UI using only keyboard
2. **Screen Reader**: Test with NVDA (Windows) or VoiceOver (macOS)
3. **Zoom**: Test at 200% browser zoom
4. **Color**: Test with grayscale filter to check contrast

### i18n Messages for Accessibility

All ARIA labels should use i18n keys:

```javascript
// Good - uses translation system
element.setAttribute('aria-label', this.msg('layers-save-button'));

// Bad - hardcoded string
element.setAttribute('aria-label', 'Save');
```

Add message definitions to `i18n/en.json`:
```json
{
    "layers-save-button": "Save layers",
    "layers-save-button-description": "Save your layer annotations"
}
```

Document messages in `i18n/qqq.json`:
```json
{
    "layers-save-button": "Accessible label for the save button in the layers editor"
}
```

## WCAG 2.1 Compliance Status

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | ⚠️ Partial | Canvas content not accessible |
| 1.3.1 Info and Relationships | A | ⚠️ Partial | Missing landmark roles |
| 1.4.3 Contrast (Minimum) | AA | ❓ Unknown | Not audited |
| 2.1.1 Keyboard | A | ✅ Pass | Most features keyboard accessible |
| 2.1.2 No Keyboard Trap | A | ✅ Pass | Focus trapping properly implemented |
| 2.4.1 Bypass Blocks | A | ❌ Fail | No skip links |
| 2.4.4 Link Purpose | A | ✅ Pass | Links have descriptive text |
| 2.4.7 Focus Visible | AA | ✅ Pass | Focus indicators present |
| 4.1.2 Name, Role, Value | A | ⚠️ Partial | Most elements labeled |

Legend: ✅ Pass | ⚠️ Partial | ❌ Fail | ❓ Unknown

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MediaWiki Accessibility](https://www.mediawiki.org/wiki/Accessibility)
- [Canvas Accessibility](https://www.w3.org/WAI/tutorials/images/complex/#accessible-svg)

## Future Improvements

1. **Screen Reader Layer List**: Create an accessible, screen-reader-only list of layers that updates as the canvas changes
2. **Keyboard Drawing**: Allow creating simple shapes via keyboard (position, dimensions)
3. **Audio Feedback**: Optional audio cues for actions
4. **High Contrast Theme**: Dedicated high-contrast CSS theme
5. **Voice Control**: Integration with voice control APIs
