# Feature Request: Enhanced Layerslink Navigation Modes

**Created:** December 23, 2025  
**Status:** Documented  
**Priority:** Medium (UX improvement for embedded editor workflows)

---

## Overview

This document proposes enhancements to the `layerslink` parameter to support better navigation workflows when editing layers from within wiki pages. Currently, when a user clicks on a layered image with `layerslink=editor`, they are taken to the File: page editor, and after saving/closing, they remain on the File: page—losing context of their original location.

This is particularly problematic for:
- Form-based workflows (Page Forms, Semantic Forms) where users may lose unsaved form data
- Article reading flow where users want to make quick annotations without leaving the page
- Multi-image pages where users want to edit several layer sets in sequence

---

## Problem Statement

### Current Behavior

```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor]]
```

1. User is on `Article:MyPage` editing a Page Forms form
2. User clicks the layered image to annotate it
3. Browser navigates to `File:Diagram.png?action=editlayers&setname=anatomy`
4. User makes edits and saves
5. User is now on `File:Diagram.png` — **original page context is lost**
6. Form data on `Article:MyPage` is lost

### Desired Behavior

Users should be able to:
1. Open the editor in a way that preserves their original page context
2. Return to the original page after editing (not the File: page)
3. Optionally, edit layers in an overlay/modal without leaving the page at all

---

## Proposed Solutions

### Option 1: New Tab Mode (`layerslink=editor-newtab`)

**Simplest implementation** — Opens editor in a new browser tab.

```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor-newtab]]
```

| Aspect | Details |
|--------|---------|
| **Behavior** | Opens `File:X.png?action=editlayers&setname=Y` in a new tab |
| **Implementation** | Add `target="_blank"` and `rel="noopener"` to the link |
| **Effort** | Low (< 1 hour) |
| **Pros** | Simple, no state management, works everywhere |
| **Cons** | Doesn't return user to exact scroll position; relies on browser tab management |

**Implementation Details:**

In `WikitextHooks.php`, when processing the `layerslink` parameter:

```php
case 'editor-newtab':
    $linkAttribs['target'] = '_blank';
    $linkAttribs['rel'] = 'noopener noreferrer';
    $linkAttribs['href'] = $fileTitle->getLocalURL([
        'action' => 'editlayers',
        'setname' => $setName
    ]);
    break;
```

---

### Option 2: Return URL Mode (`layerslink=editor-return`)

**Medium complexity** — Editor redirects back to original page after save/close.

```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor-return]]
```

| Aspect | Details |
|--------|---------|
| **Behavior** | After save/close, redirect to the page that contained the link |
| **Implementation** | Pass `returnto` parameter in URL; editor respects it on close |
| **Effort** | Medium (4-6 hours) |
| **Pros** | Seamless return to original page; familiar MediaWiki pattern |
| **Cons** | Form data still lost on return; page refreshes |

**Implementation Details:**

1. **WikitextHooks.php** — Add returnto parameter:

```php
case 'editor-return':
    $returnUrl = $parser->getTitle()->getFullURL();
    $linkAttribs['href'] = $fileTitle->getLocalURL([
        'action' => 'editlayers',
        'setname' => $setName,
        'returnto' => $parser->getTitle()->getPrefixedDBkey()
    ]);
    break;
```

2. **EditLayersAction.php** — Pass returnto to editor:

```php
$out->addJsConfigVars([
    'wgLayersReturnTo' => $request->getText('returnto')
]);
```

3. **EditorBootstrap.js** — Handle return navigation:

```javascript
handleEditorClose() {
    const returnTo = mw.config.get('wgLayersReturnTo');
    if (returnTo) {
        window.location.href = mw.util.getUrl(returnTo);
    } else {
        // Default behavior - stay on File: page
        window.location.reload();
    }
}
```

---

### Option 3: Modal/Overlay Mode (`layerslink=editor-modal`) ⭐ RECOMMENDED

**Most sophisticated** — Editor opens in a modal overlay on the current page.

```wikitext
[[File:Diagram.png|layers=anatomy|layerslink=editor-modal]]
```

| Aspect | Details |
|--------|---------|
| **Behavior** | Editor opens in fullscreen modal overlay; original page preserved underneath |
| **Implementation** | Load editor in iframe or dynamically inject editor components |
| **Effort** | High (2-3 days) |
| **Pros** | Form data preserved; best UX; no navigation; instant return |
| **Cons** | Complex implementation; potential CSP issues; needs careful resource management |

**Implementation Details:**

#### Architecture Approach: iframe-based Modal

Using an iframe is the cleanest approach because:
- Editor CSS/JS is isolated from host page
- No conflicts with host page's scripts
- Full editor functionality without modification
- Works with Content Security Policy (same-origin)

#### Frontend Implementation:

1. **New ResourceLoader module: `ext.layers.modal`**

```javascript
// resources/ext.layers.modal/LayersEditorModal.js
class LayersEditorModal {
    constructor() {
        this.overlay = null;
        this.iframe = null;
        this.originalScrollPos = 0;
    }
    
    /**
     * Open the editor in a modal overlay
     * @param {string} filename - The file name (without namespace)
     * @param {string} setname - The layer set name
     * @returns {Promise<void>}
     */
    open(filename, setname) {
        return new Promise((resolve, reject) => {
            // Prevent body scroll
            this.originalScrollPos = window.scrollY;
            document.body.style.overflow = 'hidden';
            
            // Create modal overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'layers-editor-modal-overlay';
            this.overlay.setAttribute('role', 'dialog');
            this.overlay.setAttribute('aria-modal', 'true');
            this.overlay.setAttribute('aria-label', mw.msg('layers-editor-modal-title'));
            
            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'layers-editor-modal-close';
            closeBtn.setAttribute('aria-label', mw.msg('layers-editor-modal-close'));
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', () => this.close());
            
            // Create iframe
            this.iframe = document.createElement('iframe');
            this.iframe.className = 'layers-editor-modal-iframe';
            this.iframe.src = mw.util.getUrl(`File:${filename}`, {
                action: 'editlayers',
                setname: setname,
                modal: '1'  // Signal to editor it's in modal mode
            });
            
            // Handle iframe load
            this.iframe.addEventListener('load', () => {
                // Setup cross-frame communication
                this.setupMessageListener(resolve);
            });
            
            // Handle Escape key
            this.escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
            
            this.overlay.appendChild(closeBtn);
            this.overlay.appendChild(this.iframe);
            document.body.appendChild(this.overlay);
            
            // Focus trap
            this.iframe.focus();
        });
    }
    
    /**
     * Setup postMessage listener for editor communication
     */
    setupMessageListener(resolve) {
        this.messageHandler = (event) => {
            // Security: verify origin
            if (event.origin !== window.location.origin) return;
            
            const data = event.data;
            if (data.type === 'layers-editor-close') {
                this.close();
                resolve({ saved: data.saved });
            } else if (data.type === 'layers-editor-save') {
                // Optionally notify host page of save
                this.onSave(data);
            }
        };
        window.addEventListener('message', this.messageHandler);
    }
    
    /**
     * Close the modal
     */
    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
        window.scrollTo(0, this.originalScrollPos);
        
        // Clean up listeners
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }
    }
    
    /**
     * Handle save event from editor
     */
    onSave(data) {
        // Could refresh the layered image on the host page
        // without full page reload
        const event = new CustomEvent('layers-saved', { detail: data });
        document.dispatchEvent(event);
    }
}

// Initialize on page load for modal links
mw.hook('wikipage.content').add(($content) => {
    $content.find('a[data-layers-modal]').on('click', function(e) {
        e.preventDefault();
        const $link = $(this);
        const modal = new LayersEditorModal();
        modal.open(
            $link.data('layers-filename'),
            $link.data('layers-setname')
        );
    });
});

module.exports = LayersEditorModal;
```

2. **CSS for modal overlay:**

```css
/* resources/ext.layers.modal/modal.css */
.layers-editor-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 10000;
    display: flex;
    flex-direction: column;
}

.layers-editor-modal-close {
    position: absolute;
    top: 10px;
    right: 20px;
    z-index: 10001;
    background: #333;
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.layers-editor-modal-close:hover {
    background: #555;
}

.layers-editor-modal-close:focus {
    outline: 2px solid #36c;
    outline-offset: 2px;
}

.layers-editor-modal-iframe {
    flex: 1;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
}
```

3. **Editor modifications for modal mode:**

In `EditorBootstrap.js`, detect modal mode and use postMessage:

```javascript
isModalMode() {
    return new URLSearchParams(window.location.search).get('modal') === '1';
}

handleClose() {
    if (this.isModalMode()) {
        // Notify parent window
        window.parent.postMessage({
            type: 'layers-editor-close',
            saved: this.hasSavedChanges
        }, window.location.origin);
    } else {
        // Standard navigation
        this.navigateAway();
    }
}
```

4. **WikitextHooks.php changes:**

```php
case 'editor-modal':
    // Use JavaScript handler instead of navigation
    $linkAttribs['href'] = '#';
    $linkAttribs['data-layers-modal'] = '1';
    $linkAttribs['data-layers-filename'] = $fileName;
    $linkAttribs['data-layers-setname'] = $setName;
    break;
```

---

## Comparison Matrix

| Feature | `editor-newtab` | `editor-return` | `editor-modal` |
|---------|-----------------|-----------------|----------------|
| **Preserves form data** | ⚠️ New tab | ❌ Page reload | ✅ Yes |
| **Returns to original page** | ⚠️ Manual | ✅ Auto | ✅ Instant |
| **Implementation effort** | 1 hour | 4-6 hours | 2-3 days |
| **Browser support** | All | All | All modern |
| **Works with Page Forms** | ⚠️ Separate tab | ❌ Data lost | ✅ Perfect |
| **Keyboard accessible** | ✅ Yes | ✅ Yes | ✅ Yes |
| **CSP compatible** | ✅ Yes | ✅ Yes | ✅ Same-origin |

---

## Recommended Implementation Order

### Phase 1: Quick Win (v1.2.1)
Implement `layerslink=editor-newtab` — simple, effective, no risk.

### Phase 2: Improved Flow (v1.3.0)
Implement `layerslink=editor-return` — better UX, familiar pattern.

### Phase 3: Ultimate UX (v1.4.0)
Implement `layerslink=editor-modal` — best experience for form workflows.

---

## Wikitext Syntax Summary

After implementation:

```wikitext
<!-- Standard: navigates to File: page editor -->
[[File:Diagram.png|layers=anatomy|layerslink=editor]]

<!-- NEW: Opens editor in new browser tab -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-newtab]]

<!-- NEW: Returns to this page after editing -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-return]]

<!-- NEW: Opens editor in modal overlay (best for forms) -->
[[File:Diagram.png|layers=anatomy|layerslink=editor-modal]]
```

---

## Testing Considerations

### Manual Test Cases

1. **New tab mode:**
   - [ ] Link opens in new tab
   - [ ] Original tab is unchanged
   - [ ] Editor functions normally in new tab

2. **Return mode:**
   - [ ] Clicking link navigates to editor
   - [ ] After save, returns to original page
   - [ ] After close without save, returns to original page
   - [ ] returnto parameter is URL-safe (special characters, long titles)

3. **Modal mode:**
   - [ ] Modal opens correctly
   - [ ] Editor is fully functional in modal
   - [ ] Escape key closes modal
   - [ ] Close button works
   - [ ] Original page scroll position preserved
   - [ ] Form data on original page is preserved
   - [ ] Save from modal notifies parent page
   - [ ] Works with Page Forms extension

### Automated Tests

- PHPUnit tests for WikitextHooks parameter parsing
- Jest tests for LayersEditorModal component
- E2E tests for each navigation mode

---

## Security Considerations

1. **New tab mode:** Use `rel="noopener noreferrer"` to prevent tab-napping
2. **Return mode:** Validate `returnto` parameter to prevent open redirects
3. **Modal mode:** Use `postMessage` origin verification; same-origin iframe only

---

## Accessibility Requirements

1. **All modes:**
   - Links must be keyboard accessible
   - Focus management on navigation
   - Screen reader announcements

2. **Modal mode specific:**
   - `role="dialog"` and `aria-modal="true"`
   - Focus trap within modal
   - Return focus to trigger element on close
   - Escape key to close
   - Announce modal open/close to screen readers

---

## Related Files

Files to be modified:

- `src/Hooks/WikitextHooks.php` — Parse new layerslink values
- `src/Action/EditLayersAction.php` — Handle returnto and modal parameters
- `resources/ext.layers.editor/editor/EditorBootstrap.js` — Modal mode handling
- `extension.json` — New ResourceLoader module for modal
- `resources/ext.layers.modal/` — New modal overlay module (Option 3)
- `i18n/en.json` — New message keys

---

## References

- Original request: User feedback, December 23, 2025
- Related: Page Forms extension integration scenarios
- Industry standard: Google Docs overlay editing, Figma modal editing

---

*Document created by GitHub Copilot (Claude Opus 4.5)*
