# Named Layer Sets - Implementation Plan

**Created:** January 2025  
**Estimated Effort:** 5-7 days  
**Dependencies:** None (backwards compatible)

---

## Prerequisites

Before starting implementation:

1. ✅ Design document created (`docs/NAMED_LAYER_SETS.md`)
2. ✅ Migration script created (`sql/patches/patch-named-sets-migration.sql`)
3. [ ] Review and approve design document
4. [ ] All existing tests passing

---

## Implementation Phases

### Phase 1: Database Layer (Day 1-2)

#### 1.1 Add Configuration Constants

**File:** `extension.json`

Add new configuration options in the `config` section:

```json
{
  "LayersMaxNamedSets": {
    "value": 15,
    "description": "Maximum number of named layer sets per image"
  },
  "LayersMaxRevisionsPerSet": {
    "value": 25,
    "description": "Maximum revisions to keep per named set"
  },
  "LayersDefaultSetName": {
    "value": "default",
    "description": "Default name for layer sets when none specified"
  }
}
```

#### 1.2 Update LayersDatabase.php

**New Methods to Add:**

```php
/**
 * Get all named sets for an image (metadata only, no JSON blobs)
 * @param string $imgName
 * @param string $sha1
 * @return array Array of named set summaries
 */
public function getNamedSetsForImage( string $imgName, string $sha1 ): array

/**
 * Get revision history for a specific named set
 * @param string $imgName
 * @param string $sha1
 * @param string $setName
 * @param int $limit
 * @return array Array of revision summaries
 */
public function getSetRevisions( string $imgName, string $sha1, string $setName, int $limit = 50 ): array

/**
 * Count revisions for a named set
 * @param string $imgName
 * @param string $sha1
 * @param string $setName
 * @return int
 */
public function countSetRevisions( string $imgName, string $sha1, string $setName ): int

/**
 * Count named sets for an image
 * @param string $imgName
 * @param string $sha1
 * @return int
 */
public function countNamedSets( string $imgName, string $sha1 ): int

/**
 * Prune old revisions for a named set, keeping only the most recent N
 * @param string $imgName
 * @param string $sha1
 * @param string $setName
 * @param int $keepCount
 * @return int Number of revisions deleted
 */
public function pruneOldRevisions( string $imgName, string $sha1, string $setName, int $keepCount ): int

/**
 * Check if a named set exists
 * @param string $imgName
 * @param string $sha1
 * @param string $setName
 * @return bool
 */
public function namedSetExists( string $imgName, string $sha1, string $setName ): bool
```

**Modify `saveLayerSet()`:**

1. Default `$setName` to config value (`'default'`)
2. Before insert, check named set count limit
3. After successful insert, trigger pruning if revision count exceeds limit

```php
public function saveLayerSet(
    string $imgName,
    array $imgMetadata,
    array $layersData,
    int $userId,
    ?string $setName = null
): ?int {
    // Default to configured default name
    $setName = $setName ?? $this->config->get( 'LayersDefaultSetName' );
    
    // Check named set limit (only for new sets)
    if ( !$this->namedSetExists( $imgName, $imgMetadata['sha1'], $setName ) ) {
        $setCount = $this->countNamedSets( $imgName, $imgMetadata['sha1'] );
        $maxSets = $this->config->get( 'LayersMaxNamedSets' );
        if ( $setCount >= $maxSets ) {
            $this->logError( 'Named set limit reached', [ 'count' => $setCount, 'max' => $maxSets ] );
            return null; // or throw specific exception
        }
    }
    
    // ... existing save logic ...
    
    // After successful save, prune old revisions
    if ( $layerSetId ) {
        $maxRevisions = $this->config->get( 'LayersMaxRevisionsPerSet' );
        $this->pruneOldRevisions( $imgName, $imgMetadata['sha1'], $setName, $maxRevisions );
    }
    
    return $layerSetId;
}
```

#### 1.3 Register Schema Migration

**File:** `src/Database/LayersSchemaManager.php`

Add the migration to `onLoadExtensionSchemaUpdates`:

```php
$updater->addExtensionUpdate( [
    'applyPatch',
    __DIR__ . '/../../sql/patches/patch-named-sets-migration.sql',
    true
] );
```

#### 1.4 Unit Tests

Create `tests/phpunit/Database/LayersDatabaseNamedSetsTest.php`:

- Test `getNamedSetsForImage()` returns correct structure
- Test `countNamedSets()` accuracy
- Test `countSetRevisions()` accuracy
- Test `pruneOldRevisions()` deletes correct rows
- Test `saveLayerSet()` enforces limits

---

### Phase 2: API Layer (Day 2-3)

#### 2.1 Update ApiLayersInfo.php

**Add `setname` Parameter:**

```php
public function getAllowedParams() {
    return [
        'filename' => [ ... ],
        'layersetid' => [ ... ],
        'setname' => [
            ApiBase::PARAM_TYPE => 'string',
            ApiBase::PARAM_REQUIRED => false,
        ],
        // ... existing params ...
    ];
}
```

**Update Response Structure:**

When `setname` is provided:
- Load that specific set's latest revision
- Return revisions only for that set

When `setname` is not provided:
- Load default set's latest revision (or most recent if no default)
- Return `named_sets` summary array
- Optionally return revisions for default set

```php
// In execute():
$setName = $params['setname'] ?? null;

if ( $setName ) {
    // Load specific named set
    $layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $setName );
    $revisions = $db->getSetRevisions( $file->getName(), $file->getSha1(), $setName, $limit );
} else {
    // Load default or latest
    $defaultName = $this->getConfig()->get( 'LayersDefaultSetName' );
    $layerSet = $db->getLayerSetByName( $file->getName(), $file->getSha1(), $defaultName );
    if ( !$layerSet ) {
        $layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
    }
}

// Always include named_sets summary
$namedSets = $db->getNamedSetsForImage( $file->getName(), $file->getSha1() );
$result['named_sets'] = $namedSets;
```

#### 2.2 Update ApiLayersSave.php

**Add New Validation:**

```php
// Check named set limit before save
if ( !$db->namedSetExists( $fileDbKey, $sha1, $setName ) ) {
    $setCount = $db->countNamedSets( $fileDbKey, $sha1 );
    $maxSets = $this->getConfig()->get( 'LayersMaxNamedSets' );
    if ( $setCount >= $maxSets ) {
        $this->dieWithError( 'layers-max-sets-reached', 'maxsetsreached' );
    }
}
```

**Add New Error Messages:**

**File:** `i18n/en.json`

```json
{
    "layers-max-sets-reached": "Maximum number of named layer sets reached for this image. Delete an existing set or save to an existing set name.",
    "layers-invalid-setname": "Invalid set name. Use only letters, numbers, underscores, and dashes."
}
```

**File:** `i18n/qqq.json`

```json
{
    "layers-max-sets-reached": "Error shown when user tries to create a new named layer set but the image already has the maximum allowed sets.",
    "layers-invalid-setname": "Error shown when the provided set name contains invalid characters."
}
```

#### 2.3 API Integration Tests

Create `tests/phpunit/Api/ApiLayersNamedSetsTest.php`:

- Test `layersinfo` with `setname` parameter
- Test `layerssave` creates new named set
- Test `layerssave` enforces set limit
- Test revision pruning after save
- Test response structure with `named_sets`

---

### Phase 3: Frontend (Day 3-5)

#### 3.1 Update APIManager.js

Add methods for named set operations:

```javascript
/**
 * Load layer set by name
 * @param {string} filename
 * @param {string} [setname]
 * @returns {Promise}
 */
loadNamedSet: function( filename, setname ) {
    var params = {
        action: 'layersinfo',
        filename: filename
    };
    if ( setname ) {
        params.setname = setname;
    }
    return this.api.get( params );
},

/**
 * Get list of named sets for image
 * @param {string} filename
 * @returns {Promise}
 */
getNamedSets: function( filename ) {
    return this.api.get({
        action: 'layersinfo',
        filename: filename
    }).then( function( response ) {
        return response.layersinfo.named_sets || [];
    });
}
```

#### 3.2 Create SetSelector Component

**File:** `resources/ext.layers.editor/SetSelector.js`

```javascript
( function () {
    'use strict';

    /**
     * Named set selector dropdown component
     */
    function SetSelector( editor, container ) {
        this.editor = editor;
        this.container = container;
        this.currentSet = 'default';
        this.namedSets = [];
        this.init();
    }

    SetSelector.prototype = {
        init: function() {
            this.render();
            this.bindEvents();
        },

        render: function() {
            // Create dropdown UI
            var html = '<div class="layers-set-selector">' +
                '<label>' + mw.message( 'layers-set-label' ).text() + '</label>' +
                '<select class="layers-set-dropdown"></select>' +
                '<button class="layers-new-set-btn" title="' + 
                    mw.message( 'layers-new-set-tooltip' ).text() + '">+</button>' +
                '</div>';
            this.container.innerHTML = html;
            this.dropdown = this.container.querySelector( '.layers-set-dropdown' );
            this.newSetBtn = this.container.querySelector( '.layers-new-set-btn' );
        },

        update: function( namedSets, currentSet ) {
            this.namedSets = namedSets || [];
            this.currentSet = currentSet || 'default';
            this.populateDropdown();
        },

        populateDropdown: function() {
            var options = this.namedSets.map( function( set ) {
                return '<option value="' + set.name + '"' +
                    ( set.name === this.currentSet ? ' selected' : '' ) + '>' +
                    set.name + ' (' + set.revision_count + ')' +
                    '</option>';
            }.bind( this ) );
            this.dropdown.innerHTML = options.join( '' );
        },

        bindEvents: function() {
            this.dropdown.addEventListener( 'change', this.onSetChange.bind( this ) );
            this.newSetBtn.addEventListener( 'click', this.onNewSet.bind( this ) );
        },

        onSetChange: function( e ) {
            var setName = e.target.value;
            this.editor.loadNamedSet( setName );
        },

        onNewSet: function() {
            this.editor.showNewSetDialog();
        }
    };

    window.LayersSetSelector = SetSelector;
} )();
```

#### 3.3 Add History Panel to LayerPanel.js

Add a "History" tab or section:

```javascript
// In LayerPanel.prototype.renderPanelTabs:
var historyTab = {
    id: 'history',
    label: mw.message( 'layers-history-tab' ).text(),
    content: this.renderHistoryPanel()
};

// Add method:
renderHistoryPanel: function() {
    var html = '<div class="layers-history-panel">' +
        '<div class="layers-history-list"></div>' +
        '</div>';
    return html;
},

updateHistoryPanel: function( revisions ) {
    var list = this.panel.querySelector( '.layers-history-list' );
    if ( !list ) return;
    
    var items = revisions.map( function( rev ) {
        return '<div class="layers-history-item" data-revision="' + rev.ls_revision + '">' +
            '<span class="revision">v' + rev.ls_revision + '</span>' +
            '<span class="timestamp">' + this.formatTimestamp( rev.ls_timestamp ) + '</span>' +
            '<span class="user">' + rev.ls_user_name + '</span>' +
            '<button class="restore-btn">' + mw.message( 'layers-restore' ).text() + '</button>' +
            '</div>';
    }.bind( this ) ).join( '' );
    
    list.innerHTML = items;
}
```

#### 3.4 Update Save Flow

In `LayersEditor.js`, update save to include set name:

```javascript
save: function( setName ) {
    setName = setName || this.currentSetName || 'default';
    
    return this.apiManager.save(
        this.filename,
        this.stateManager.getLayers(),
        setName
    ).then( function( response ) {
        this.showStatus( mw.message( 'layers-save-success' ).text() );
        // Refresh named sets list
        this.refreshNamedSets();
    }.bind( this ) );
},

saveAsNewSet: function() {
    // Show dialog to get new set name
    var dialog = new OO.ui.PromptDialog();
    dialog.open( {
        prompt: mw.message( 'layers-new-set-prompt' ).text()
    } ).then( function( name ) {
        if ( name ) {
            this.save( name );
        }
    }.bind( this ) );
}
```

#### 3.5 Add i18n Messages

**File:** `i18n/en.json`

```json
{
    "layers-set-label": "Set:",
    "layers-new-set-tooltip": "Create new named set",
    "layers-new-set-prompt": "Enter a name for the new layer set:",
    "layers-history-tab": "History",
    "layers-restore": "Restore",
    "layers-max-sets-reached": "Maximum number of named layer sets reached for this image.",
    "layers-invalid-setname": "Invalid set name. Use letters, numbers, underscores, and dashes only."
}
```

#### 3.6 Add CSS Styles

**File:** `resources/ext.layers.editor/editor-fixed.css`

```css
/* Set Selector */
.layers-set-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--layers-panel-bg);
    border-bottom: 1px solid var(--layers-border-color);
}

.layers-set-dropdown {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--layers-border-color);
    border-radius: 4px;
    background: var(--layers-input-bg);
}

.layers-new-set-btn {
    padding: 4px 12px;
    font-weight: bold;
}

/* History Panel */
.layers-history-panel {
    max-height: 200px;
    overflow-y: auto;
}

.layers-history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--layers-border-color);
}

.layers-history-item:hover {
    background: var(--layers-hover-bg);
}

.layers-history-item .revision {
    font-weight: bold;
    min-width: 40px;
}

.layers-history-item .timestamp {
    flex: 1;
    color: var(--layers-text-muted);
    font-size: 12px;
}

.layers-history-item .restore-btn {
    padding: 2px 8px;
    font-size: 11px;
}
```

#### 3.7 Update extension.json

Add new JS files to ResourceModules:

```json
{
    "ext.layers.editor": {
        "scripts": [
            "ext.layers.editor/SetSelector.js",
            // ... existing scripts ...
        ],
        "messages": [
            "layers-set-label",
            "layers-new-set-tooltip",
            "layers-new-set-prompt",
            "layers-history-tab",
            "layers-restore",
            "layers-max-sets-reached",
            "layers-invalid-setname"
        ]
    }
}
```

---

### Phase 4: Parser Integration (Day 5-6)

#### 4.1 Update Hooks.php

Add `layers=` parameter support to parser function:

```php
public static function renderLayers( Parser $parser, PPFrame $frame, array $args ) {
    // Parse positional and named parameters
    $filename = isset( $args[0] ) ? trim( $frame->expand( $args[0] ) ) : '';
    $params = [];
    
    for ( $i = 1; $i < count( $args ); $i++ ) {
        $arg = trim( $frame->expand( $args[$i] ) );
        if ( strpos( $arg, '=' ) !== false ) {
            list( $key, $value ) = explode( '=', $arg, 2 );
            $params[strtolower( trim( $key ) )] = trim( $value );
        }
    }
    
    // Extract set name (default to 'default')
    $setName = $params['layers'] ?? 
        MediaWikiServices::getInstance()
            ->getConfigFactory()
            ->makeConfig( 'Layers' )
            ->get( 'LayersDefaultSetName' );
    
    // Validate set name
    if ( !preg_match( '/^[\p{L}\p{N}_-]+$/u', $setName ) ) {
        return '<span class="error">' . 
            wfMessage( 'layers-invalid-setname' )->escaped() . 
            '</span>';
    }
    
    // Load and render with specified set
    // ... existing rendering logic, pass $setName to loader ...
}
```

#### 4.2 Update WIKITEXT_USAGE.md

Document new `layers=` parameter with examples.

---

### Phase 5: Testing & Documentation (Day 6-7)

#### 5.1 Jest Tests

Create `tests/jest/SetSelector.test.js`:

- Test component renders correctly
- Test dropdown populates with sets
- Test set change triggers callback
- Test new set button triggers dialog

Create `tests/jest/APIManagerNamedSets.test.js`:

- Test `loadNamedSet()` calls API correctly
- Test `getNamedSets()` parses response

#### 5.2 PHPUnit Integration Tests

Expand `tests/phpunit/Api/` tests:

- Full workflow: create set → save → load → history → restore
- Concurrent saves to same set
- Set limit enforcement
- Revision pruning behavior

#### 5.3 Documentation Updates

- Update `README.md` with named sets feature overview
- Update `copilot-instructions.md` with new API contracts
- Update `WIKITEXT_USAGE.md` with `layers=` examples
- Add migration notes to `CHANGELOG.md`

---

## Testing Checklist

### Database Layer
- [ ] Migration script runs without errors
- [ ] Existing data gets `ls_name = 'default'`
- [ ] New indexes are created
- [ ] `getNamedSetsForImage()` returns correct data
- [ ] `countNamedSets()` is accurate
- [ ] `pruneOldRevisions()` keeps correct revisions
- [ ] `saveLayerSet()` enforces limits

### API Layer
- [ ] `layersinfo` returns `named_sets` array
- [ ] `layersinfo` with `setname` returns correct set
- [ ] `layerssave` creates new named set
- [ ] `layerssave` rejects when limit reached
- [ ] Error messages display correctly

### Frontend
- [ ] Set selector dropdown populates
- [ ] Changing set loads correct data
- [ ] "New Set" button opens dialog
- [ ] History panel shows revisions
- [ ] Restore button loads revision
- [ ] Save uses correct set name

### Parser
- [ ] `{{#layers:File.jpg}}` loads default
- [ ] `{{#layers:File.jpg|layers=custom}}` loads named set
- [ ] Invalid set name shows error

### Backwards Compatibility
- [ ] Existing layer sets accessible as "default"
- [ ] Old API calls work (setname optional)
- [ ] Old wikitext without `layers=` works

---

## Rollout Plan

### Stage 1: Database Migration (Safe)
1. Deploy migration script
2. Run `maintenance/update.php`
3. Verify existing data intact

### Stage 2: API Updates (Safe)
1. Deploy API changes
2. Test with existing clients (should work unchanged)
3. Test new parameters

### Stage 3: Frontend Updates
1. Deploy UI changes
2. Announce feature in release notes
3. Monitor for issues

### Stage 4: Documentation
1. Update user-facing docs
2. Update developer docs
3. Create migration guide if needed

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration corrupts data | Low | High | Backup before migration, test on staging |
| Performance regression | Medium | Medium | Add indexes first, test with production-like data |
| UI breaks existing workflow | Medium | Medium | Feature flag, gradual rollout |
| Revision pruning deletes wanted data | Low | High | Make pruning config adjustable, log deletions |

---

## Future Enhancements (Not in Scope)

1. **Visual Diff**: Compare two revisions visually
2. **Set Sharing**: Copy set to another image
3. **Set Templates**: Pre-built annotation templates
4. **Collaborative Editing**: Real-time multi-user editing
5. **Set Export/Import**: JSON export for backup/transfer
