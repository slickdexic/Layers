# Accessibility Guide

**Last Updated:** December 2025

This document describes the accessibility features of the Layers extension and provides guidance for contributors to maintain and improve accessibility compliance.

## Current Accessibility Features

### ARIA Live Regions (NEW)

The `AccessibilityAnnouncer` module provides centralized screen reader announcements:

```javascript
// Available via global singleton
window.layersAnnouncer.announce('Status message');
window.layersAnnouncer.announceError('Error message');
window.layersAnnouncer.announceSuccess('layers-saved');
window.layersAnnouncer.announceTool('rectangle');
window.layersAnnouncer.announceLayerSelection(layer, index, count);
```

**Integration Points:**
| Module | Announcement Type |
|--------|-------------------|
| ToolManager | Tool selection changes |
| SelectionManager | Layer selection changes |
| APIManager | Save success |
| ErrorHandler | All errors |

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
| Layer list | `role="listbox"` | Identifies list as selection widget |
| Layer items | `role="option"`, `aria-selected` | Marks selectable list items |
| Modal dialogs | `role="dialog"`, `aria-labelledby` | Identifies accessible dialogs |

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
| `G` | Toggle grid |
| `;` | Toggle smart guides (snap to objects) |
| `Delete` / `Backspace` | Delete selected layer(s) |
| `Escape` | Cancel current operation / deselect |
| `Shift + ?` | Show keyboard shortcuts help dialog | |

#### Layer Panel Navigation (NEW)

| Shortcut | Action |
|----------|--------|
| `Arrow Up` | Move focus to previous layer |
| `Arrow Down` | Move focus to next layer |
| `Home` | Jump to first layer |
| `End` | Jump to last layer |
| `Enter` / `Space` | Select the focused layer |
| `V` | Toggle visibility of focused layer |
| `L` | Toggle lock of focused layer |
| `Delete` / `Backspace` | Delete focused layer |

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

2. ~~**No Skip Links**~~ ✅ RESOLVED (December 2025)
   - ~~Users cannot quickly skip to main content areas~~
   - **Resolution**: Added skip links to toolbar, canvas, and layers panel

3. ~~**Color Contrast Not Verified**~~ ✅ RESOLVED (December 2025)
   - ~~CSS colors have not been audited for WCAG 2.1 AA contrast ratios~~
   - **Resolution**: Audited and fixed low-contrast colors:
     - Replaced `#999` (2.84:1 ratio) with `#767676` (4.54:1 ratio - WCAG AA compliant)
     - Verified `#666` text colors (5.74:1 ratio - passes WCAG AA)

4. ~~**Missing Landmarks**~~ ✅ RESOLVED (December 2025)
   - ~~No ARIA landmark roles (`main`, `navigation`, `region`)~~
   - **Resolution**: Added landmark roles to all major sections:
     - Header: `role="banner"`
     - Toolbar: `role="navigation"`
     - Main content: `role="main"`
     - Canvas: `role="region"`
     - Layers panel: `role="complementary"`
     - Status bar: `role="contentinfo"`

### Medium Priority

5. ~~**Visual-Only Feedback**~~ ✅ RESOLVED (December 2025)
   - ~~Some operations only provide visual feedback~~
   - **Resolution**: Added `AccessibilityAnnouncer` with ARIA live regions for tool changes, layer selection, save success, and errors

6. **Mouse-Dependent Interactions**
   - Drawing tools require mouse/touch interaction
   - Some resize/rotate handles are only mouse-accessible
   - **Recommendation**: Add keyboard alternatives for common operations

7. **Color Picker Accessibility**
   - Color picker relies heavily on mouse interaction
   - **Recommendation**: Add keyboard navigation and color value inputs

### Low Priority

8. ~~**Animation/Motion**~~ ✅ RESOLVED (December 2025)
   - ~~No `prefers-reduced-motion` media query support~~
   - **Resolution**: Added `@media (prefers-reduced-motion: reduce)` rules to all CSS files:
     - `editor-fixed.css`: Disables slide-in animation, removes all transitions
     - `LayersLightbox.css`: Disables fade transitions, stops spinner animation
     - `presets.css`: Disables button/menu transitions
     - `modal.css`: Already had support (disables fade-in animation)

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
| 1.3.1 Info and Relationships | A | ✅ Pass | Landmark roles added (December 2025) |
| 1.4.3 Contrast (Minimum) | AA | ✅ Pass | Audited December 2025 - all text meets 4.5:1 ratio |
| 2.1.1 Keyboard | A | ✅ Pass | Most features keyboard accessible |
| 2.1.2 No Keyboard Trap | A | ✅ Pass | Focus trapping properly implemented |
| 2.4.1 Bypass Blocks | A | ✅ Pass | Skip links added (December 2025) |
| 2.4.4 Link Purpose | A | ✅ Pass | Links have descriptive text |
| 2.4.7 Focus Visible | AA | ✅ Pass | All interactive elements have visible focus indicators (January 2026) |
| 4.1.2 Name, Role, Value | A | ✅ Pass | Layer list and dialogs fully labeled |
| 4.1.3 Status Messages | AA | ✅ Pass | ARIA live regions for announcements |

Legend: ✅ Pass | ⚠️ Partial | ❌ Fail | ❓ Unknown

---

## Automated Accessibility Testing (NEW - December 2025)

The extension includes automated accessibility testing using [jest-axe](https://github.com/nickcolley/jest-axe), which runs the Deque axe-core engine against rendered UI components.

### Running Accessibility Tests

```bash
npm run test:js -- AccessibilityAudit
```

### What's Tested

| Category | Tests | Description |
|----------|-------|-------------|
| Toolbar Buttons | 3 | Tool buttons, action buttons, toggle buttons |
| Layer Panel | 3 | Listbox structure, layer controls, visibility/lock |
| Form Controls | 4 | Color pickers, sliders, selects, number inputs |
| Dialogs | 2 | Modal dialogs, confirmation dialogs |
| Status Bar | 1 | Live region for status updates |
| Canvas | 1 | Application role, keyboard focus |
| Landmarks | 1 | Main, navigation, complementary regions |
| Focus | 1 | Focus visible indicators |

### Adding New Tests

When adding new UI components, create accessibility tests that verify:

1. **ARIA labels** - All interactive elements have accessible names
2. **Roles** - Correct ARIA roles for custom widgets
3. **Keyboard access** - Elements are focusable and operable
4. **Parent-child relationships** - ARIA relationships are valid
5. **Live regions** - Status updates are announced

Example test structure:

```javascript
const { axe, toHaveNoViolations } = require( 'jest-axe' );
expect.extend( toHaveNoViolations );

it( 'should be accessible', async () => {
    const container = document.createElement( 'div' );
    // ... add UI elements
    const results = await axe( container );
    expect( results ).toHaveNoViolations();
} );
```

---

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
