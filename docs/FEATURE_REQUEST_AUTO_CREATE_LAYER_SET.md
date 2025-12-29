# Feature Request: Auto-Create Layer Set on Editor Link

**Created:** December 28, 2025  
**Status:** ✅ Implemented (v1.2.9)  
**Priority:** Medium (UX improvement for workflow efficiency)

---

## Overview

When a wikitext link references a layer set that doesn't exist yet using `layerslink=editor`, automatically create that layer set when the user opens the editor (if they have sufficient permissions). This eliminates the manual step of first navigating to the file, creating a new named set, then returning to the article.

---

## Problem Statement

### Current Behavior

```wikitext
[[File:Anatomy.png|layers=heart-diagram|layerslink=editor]]
```

1. Author adds link to article referencing a new layer set name `heart-diagram`
2. User clicks the link to edit layers
3. Editor opens but the `heart-diagram` set doesn't exist
4. User must manually:
   - Create a new layer set
   - Name it `heart-diagram` (must match exactly)
   - Then begin editing
5. If the user doesn't name it correctly, the link won't work

### Desired Behavior

1. Author adds link to article referencing `heart-diagram` layer set
2. User with `createlayers` permission clicks the link
3. **Editor automatically creates the `heart-diagram` set** if it doesn't exist
4. User begins editing immediately with the correctly-named set

---

## Use Cases

### 1. Article Template Workflows

Wiki administrators can create article templates with pre-defined layer set names:

```wikitext
{{Anatomy Article
 |image=Patient-X-Ray.jpg
 |layers_bones=skeleton-overlay
 |layers_organs=organ-overlay
}}
```

When authors use this template, they can click to edit each layer set without manual creation steps.

### 2. Page Forms Integration

Page Forms can generate layer set names based on form field values:

```wikitext
[[File:{{{image}}}|layers={{{annotation_set}}}|layerslink=editor]]
```

Authors fill in the form, and the layer set is created on first access.

### 3. Collaborative Annotation Workflows

Team members can be assigned specific layer sets to create:

```wikitext
== Quality Control Annotations ==
[[File:Product-Photo.jpg|layers=defects-qa|layerslink=editor]] - QA Team
[[File:Product-Photo.jpg|layers=measurements|layerslink=editor]] - Engineering
```

Each team member clicks their link and starts annotating immediately.

---

## Proposed Solution

### Behavior Specification

When a user navigates to the layer editor via a link with a specific `setname` parameter:

1. **Check if set exists:** Query `ApiLayersInfo` for the named set
2. **If set exists:** Open editor with that set (current behavior)
3. **If set doesn't exist:**
   - **Check permissions:** User must have `createlayers` right
   - **Auto-create:** Create an empty layer set with the specified name
   - **Open editor:** Load the newly created (empty) set for editing
   - **Notify user:** Display a toast/notice: "Created new layer set: {name}"

### Permission Requirements

| User Right | Can Auto-Create? |
|------------|------------------|
| `createlayers` | ✅ Yes |
| `editlayers` (only) | ❌ No (can only edit existing sets) |
| Anonymous | ❌ No |

### URL Parameters

The auto-create behavior triggers when:
- `action=editlayers`
- `setname=<non-existent-name>`
- `autocreate=1` (optional explicit flag) OR inferred from `layerslink=editor` context

Example URL:
```
/wiki/File:Example.jpg?action=editlayers&setname=my-new-set&autocreate=1
```

---

## Implementation Details

### Phase 1: Backend Support (PHP)

#### 1.1 Modify `EditLayersAction.php`

Add auto-create logic when loading the editor:

```php
public function show() {
    $request = $this->getRequest();
    $setName = $request->getText('setname', 'default');
    $autoCreate = $request->getBool('autocreate', false);
    
    // Check if set exists
    $layersDb = $this->getLayersDatabase();
    $existingSet = $layersDb->getLayerSetByName($this->getTitle(), $setName);
    
    if (!$existingSet && $autoCreate) {
        // Check permission
        if (!$this->getUser()->isAllowed('createlayers')) {
            throw new PermissionsError('createlayers');
        }
        
        // Create empty set
        $this->autoCreateLayerSet($setName);
        
        // Pass flag to frontend for notification
        $this->getOutput()->addJsConfigVars([
            'wgLayersAutoCreated' => true,
            'wgLayersAutoCreatedSetName' => $setName
        ]);
    }
    
    // Continue with normal editor loading...
}

private function autoCreateLayerSet(string $setName): void {
    $layersDb = $this->getLayersDatabase();
    
    // Validate set name
    if (!$this->isValidSetName($setName)) {
        throw new InvalidArgumentException('Invalid layer set name');
    }
    
    // Check set limit
    $existingSets = $layersDb->getNamedSetsForFile($this->getTitle());
    $maxSets = $this->getConfig()->get('LayersMaxNamedSets');
    if (count($existingSets) >= $maxSets) {
        throw new ErrorPageError('layers-max-sets-reached', 'layers-max-sets-reached-text');
    }
    
    // Create empty layer set
    $emptyData = [
        'revision' => 1,
        'schema' => 1,
        'created' => wfTimestamp(TS_ISO_8601),
        'layers' => []
    ];
    
    $layersDb->saveLayerSet(
        $this->getTitle(),
        $this->getUser(),
        json_encode($emptyData),
        $setName
    );
    
    // Log the action
    $this->logAutoCreate($setName);
}
```

#### 1.2 Modify `WikitextHooks.php`

Add `autocreate=1` to editor links:

```php
private function buildEditorLink(Title $fileTitle, string $setName): string {
    return $fileTitle->getLocalURL([
        'action' => 'editlayers',
        'setname' => $setName,
        'autocreate' => '1',  // Enable auto-create for layerslink=editor
        'returnto' => $this->currentTitle->getPrefixedDBkey()
    ]);
}
```

### Phase 2: Frontend Notification (JavaScript)

#### 2.1 Modify `EditorBootstrap.js`

Show notification when set was auto-created:

```javascript
initializeEditor() {
    // ... existing init code ...
    
    // Check if we auto-created a new set
    if (mw.config.get('wgLayersAutoCreated')) {
        const setName = mw.config.get('wgLayersAutoCreatedSetName');
        this.showAutoCreateNotification(setName);
    }
}

showAutoCreateNotification(setName) {
    const msg = mw.msg('layers-auto-created-notification', setName);
    
    if (this.editor && this.editor.uiManager) {
        this.editor.uiManager.showNotification(msg, 'success');
    } else {
        // Fallback
        mw.notify(msg, { type: 'success', autoHide: true });
    }
    
    // Announce to screen readers
    if (window.layersAnnouncer) {
        window.layersAnnouncer.announce(msg);
    }
}
```

### Phase 3: i18n Messages

Add to `i18n/en.json`:

```json
{
    "layers-auto-created-notification": "Created new layer set: \"$1\". You can now add layers.",
    "layers-auto-create-failed-permission": "You don't have permission to create new layer sets.",
    "layers-auto-create-failed-limit": "Cannot create layer set: maximum number of sets reached for this file.",
    "layers-auto-create-failed-invalid-name": "Cannot create layer set: invalid set name."
}
```

---

## Edge Cases and Error Handling

### Invalid Set Names

If the `setname` parameter contains invalid characters:

```wikitext
[[File:Example.jpg|layers=<script>alert(1)</script>|layerslink=editor]]
```

**Handling:**
- Validate set name against allowed pattern: `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$`
- Show error message if invalid
- Do NOT create the set

### Set Limit Reached

If the file already has the maximum number of named sets (default 15):

**Handling:**
- Show error: "Maximum layer sets reached"
- Suggest deleting unused sets
- Do NOT auto-create

### Race Conditions

If two users simultaneously try to auto-create the same set:

**Handling:**
- Use database transaction with INSERT IGNORE or ON CONFLICT
- Second request sees the set exists and proceeds normally
- No error shown to either user

### Conflicting Existing Set

If user A has an existing set named `foo` and user B tries to link to `foo`:

**Handling:**
- Set exists, so no auto-create needed
- User B can edit the existing set (if they have `editlayers` permission)
- This is expected collaborative behavior

---

## Security Considerations

1. **Permission Check:** Only users with `createlayers` can auto-create
2. **Rate Limiting:** Reuse existing `editlayers-create` rate limit
3. **Name Sanitization:** Validate set name against strict pattern
4. **Set Limit:** Enforce `$wgLayersMaxNamedSets` to prevent abuse
5. **Audit Logging:** Log auto-create actions for accountability

---

## Accessibility

1. **Screen Reader Announcement:** Announce when set is auto-created
2. **Visual Notification:** Clear toast message with set name
3. **Focus Management:** No change to normal editor focus flow

---

## Testing Plan

### Unit Tests (PHP)

```php
/**
 * @covers EditLayersAction::autoCreateLayerSet
 */
public function testAutoCreateLayerSet() {
    // Test successful auto-create
    // Test permission denied
    // Test invalid set name
    // Test set limit reached
    // Test set already exists
}
```

### Integration Tests (Jest)

```javascript
describe('Auto-create layer set', () => {
    it('shows notification when set is auto-created', () => {
        // Mock mw.config with wgLayersAutoCreated = true
        // Verify notification is shown
    });
    
    it('announces to screen readers', () => {
        // Verify announcer.announce is called
    });
});
```

### E2E Tests (Playwright)

```javascript
test('auto-creates layer set from article link', async ({ page }) => {
    // 1. Create article with layerslink to non-existent set
    // 2. Click the link
    // 3. Verify editor opens with new set
    // 4. Verify notification shown
    // 5. Add a layer and save
    // 6. Verify set persists
});
```

---

## Configuration

New configuration option (optional):

```php
// LocalSettings.php

// Enable/disable auto-create feature (default: true)
$wgLayersAutoCreateEnabled = true;

// Require explicit autocreate=1 parameter (default: false)
// If true, layerslink=editor alone won't trigger auto-create
$wgLayersAutoCreateExplicit = false;
```

---

## Migration Notes

- **Backward Compatible:** No changes to existing behavior for existing sets
- **Opt-in via URL:** Only triggers with `autocreate=1` parameter
- **Default Off:** Can be disabled via `$wgLayersAutoCreateEnabled = false`

---

## Related Features

- **Named Layer Sets** (v1.1.0) - Foundation for this feature
- **layerslink=editor** (v1.0.0) - Link mode that triggers auto-create
- **layerslink=editor-modal** (v1.2.5) - Modal mode also supports auto-create
- **Page Forms Integration** - Primary use case for this feature

---

## Implementation Estimate

| Phase | Effort | Description |
|-------|--------|-------------|
| Backend (PHP) | 4-6 hours | EditLayersAction + WikitextHooks changes |
| Frontend (JS) | 2-3 hours | Notification + announcer integration |
| i18n | 30 min | Message keys |
| Testing | 3-4 hours | Unit, integration, E2E tests |
| Documentation | 1 hour | Update WIKITEXT_USAGE.md |
| **Total** | **~12 hours** | |

---

## Open Questions

1. **Should auto-create work with `layerslink=viewer`?**
   - Probably not - viewer mode implies viewing, not creating

2. **Should we show a confirmation dialog before auto-creating?**
   - Recommendation: No - the user explicitly clicked an editor link, intent is clear

3. **Should auto-create copy layers from another set?**
   - Future enhancement: `layerslink=editor&copyFrom=default` could copy layers

---

*Document created by GitHub Copilot (Claude Opus 4.5)*
