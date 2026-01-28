# REL1_39 Backport Analysis

**Created:** January 27, 2026  
**Scope:** Backporting v1.5.36 features to MediaWiki 1.39  
**Target Branch:** REL1_39 (current: v1.1.14)

---

## Executive Summary

Backporting from v1.5.36 to REL1_39 is a **major undertaking** but **technically feasible**. The PHP code is largely compatible with PHP 7.4 (no PHP 8+ syntax used). The main challenges are:

1. **Volume of changes** — 461 commits, 1,840 files, 234,590 insertions
2. **New major features** — Slide Mode, Shape Library, Emoji Picker, Inline Text Editing
3. **Hook signature differences** — Some MW hooks changed between 1.39 and 1.44
4. **Testing requirements** — Extensive regression testing on MW 1.39

---

## Effort Estimate

| Category | Effort | Risk |
|----------|--------|------|
| **PHP Compatibility** | Low | ✅ PHP 7.4+ compatible (no PHP 8 syntax) |
| **Hook Compatibility** | Medium | ⚠️ Some hooks changed signatures |
| **API Compatibility** | Low | ✅ LoadBalancer API stable |
| **Database Schema** | Low | ✅ No breaking schema changes |
| **JavaScript** | N/A | ✅ Runs in browser, not affected |
| **Testing** | High | ⚠️ Need full regression on MW 1.39 |
| **Documentation** | Low | ✅ Just version number updates |

**Total Estimated Effort:** 2-3 weeks for a senior developer

---

## Detailed Analysis

### 1. Version Gap Statistics

| Metric | REL1_39 (v1.1.14) | main (v1.5.36) | Delta |
|--------|-------------------|----------------|-------|
| Commits | - | - | **461 commits** |
| PHP Files | 40 | 62 | +22 new, 40 modified |
| JS Files | 212 | 297 | +85 new |
| i18n Messages | ~200 | ~718 | +518 messages |
| Test Count | ~2,000 | 10,667 | +8,667 tests |
| Drawing Tools | 7 | 15 | +8 tools |

### 2. New Features to Backport

#### Major Features (High Effort)

| Feature | Version | Files | Dependencies |
|---------|---------|-------|--------------|
| **Slide Mode** | v1.5.22+ | 9 PHP, 15+ JS | Special pages, parser functions, new API modules |
| **Shape Library** | v1.5.0+ | 5 JS, 11,299 lines data | ShapeLibraryPanel, ShapeLibraryData |
| **Emoji Picker** | v1.5.12+ | 5 JS, 3,055 lines index | EmojiPickerPanel, bundled SVGs |
| **Inline Text Editor** | v1.5.13+ | 1 JS (1,273 lines) | InlineTextEditor, floating toolbar |
| **Gradient Fills** | v1.5.8+ | 3 JS | GradientRenderer, GradientEditor |
| **Draft Manager** | v1.5.29+ | 1 JS (466 lines) | Auto-save, localStorage |

#### Minor Features (Lower Effort)

| Feature | Version | Impact |
|---------|---------|--------|
| Callout Tool | v1.4.0+ | New layer type |
| Marker Tool | v1.5.10+ | New layer type |
| Dimension Tool | v1.5+ | New layer type |
| Curved Arrows | v1.3.3+ | Arrow enhancement |
| Canvas Snap | v1.5.29+ | UI improvement |
| Hover Overlay | v1.5.15+ | UX improvement |
| Named Layer Sets | v1.2+ | Already partially in REL1_39 |

### 3. PHP Compatibility Assessment

#### ✅ Safe Patterns (No Changes Needed)

```php
// These are used and compatible with PHP 7.4:
declare( strict_types=1 );  // PHP 7.0+
LoadBalancer->getConnection()  // MW 1.35+
wfMessage(), wfDebugLog()  // Stable since MW 1.18
$this->getConfig()->get()  // MW 1.35+
```

#### ⚠️ Patterns to Verify

| Pattern | Current Usage | MW 1.39 Status |
|---------|---------------|----------------|
| `DB_PRIMARY` constant | Used throughout | ✅ Available (aliased from DB_MASTER) |
| `getDBLoadBalancer()` | 3 locations | ✅ Available |
| `ParserOutput::addModuleStyles()` | Not used | ✅ N/A |
| HookContainer | Not used | ✅ N/A |

#### ❌ Required Changes

| Item | Current | REL1_39 Change |
|------|---------|----------------|
| `MediaWiki >= 1.43.0` in extension.json | Required | Change to `>= 1.39.0` |
| `SkinTemplateNavigation::Universal` hook | Used | Verify exists in 1.39 |

### 4. Hook Compatibility

The following hooks are currently used and need verification for MW 1.39:

| Hook | Used In | MW 1.39 Status | Notes |
|------|---------|----------------|-------|
| `BeforePageDisplay` | LayersHooks | ✅ Stable | No changes needed |
| `FileDeleteComplete` | LayersHooks | ✅ Stable | No changes needed |
| `ImagePageAfterImageLinks` | UIHooks | ✅ Stable | No changes needed |
| `LoadExtensionSchemaUpdates` | SchemaManager | ✅ Stable | No changes needed |
| `MakeGlobalVariablesScript` | LayersHooks | ✅ Stable | No changes needed |
| `ParserFirstCallInit` | WikitextHooks | ✅ Stable | For parser functions |
| `ParserBeforeInternalParse` | WikitextHooks | ✅ Stable | For wikitext processing |
| `LinkerMakeMediaLinkFile` | WikitextHooks | ✅ Stable | No changes needed |
| `ImageBeforeProduceHTML` | WikitextHooks | ⚠️ Verify | Hook signature may differ |
| `ThumbnailBeforeProduceHTML` | WikitextHooks | ⚠️ Verify | Hook signature may differ |
| `ParserMakeImageParams` | WikitextHooks | ⚠️ Verify | Hook signature may differ |
| `SkinTemplateNavigation::Universal` | UIHooks | ⚠️ Verify | Was added in MW 1.35 |
| `BitmapHandlerTransform` | LayersFileTransform | ✅ Stable | No changes needed |

### 5. Database Schema

The database schema is **backwards compatible**. The same tables exist:
- `layer_sets` — Layer set storage
- `layer_assets` — Asset storage (not heavily used)
- `layer_set_usage` — Usage tracking

**Schema patches to review:**
- `patch-add-name-column.sql` — Adds `ls_name` column (already applied in REL1_39)
- No new tables required for core features

**Slide Mode Note:** Slides are stored in the same `layer_sets` table with a special naming convention. No new tables needed.

### 6. JavaScript Compatibility

JavaScript runs in the browser, so MW version doesn't affect compatibility. The main concerns are:
- **ResourceLoader module definitions** — Need to mirror `extension.json` changes
- **mw.Api patterns** — Stable across MW versions
- **OOUI components** — May have minor differences in MW 1.39

---

## Backport Strategy

### Option A: Full Feature Parity (Recommended)

**Approach:** Backport all features from v1.5.36

**Steps:**
1. Create branch from current REL1_39
2. Cherry-pick or merge changes in logical feature groups
3. Resolve conflicts (primarily in extension.json)
4. Update version requirements in extension.json
5. Run full test suite on MW 1.39 environment
6. Integration testing for each major feature

**Groups to Merge (in order):**

| Phase | Features | Commits (~) | Effort |
|-------|----------|-------------|--------|
| 1 | Core improvements (bug fixes, test coverage) | ~50 | 2 days |
| 2 | Shape Library + Custom Shapes | ~40 | 3 days |
| 3 | New layer types (Callout, Marker, Dimension) | ~30 | 2 days |
| 4 | Inline Text Editor + Floating Toolbar | ~25 | 2 days |
| 5 | Slide Mode (Special pages, parser) | ~60 | 4 days |
| 6 | Emoji Picker | ~20 | 1 day |
| 7 | Final polish (Gradient fills, Canvas snap, Draft) | ~30 | 2 days |

**Total: ~16 working days**

### Option B: Core Features Only

**Approach:** Backport essential features, skip complex ones

**Include:**
- Bug fixes and stability improvements
- Shape Library
- New layer types (Callout, Marker, Dimension)
- Inline Text Editing
- Gradient fills

**Exclude:**
- Slide Mode (large, complex)
- Emoji Picker (nice-to-have)
- Canvas Snap (minor)

**Effort: ~8 working days**

### Option C: Merge with Conflict Resolution

**Approach:** Direct merge with manual conflict resolution

**Steps:**
1. `git checkout REL1_39`
2. `git merge main --no-commit`
3. Resolve ~200-300 expected conflicts
4. Manual testing

**Risk:** HIGH — Merge conflicts in extension.json will be extensive

**Effort: 3-5 days for merge + 3-5 days testing**

---

## Merge Conflict Predictions

### High Conflict Files

| File | Reason | Resolution Approach |
|------|--------|---------------------|
| `extension.json` | ~200 new lines, restructured | Manual merge, keep both structures |
| `i18n/en.json` | +518 new messages | Append new messages |
| `i18n/qqq.json` | +518 documentation | Append new documentation |
| `README.md` | Extensive updates | Use new version |
| `resources/ext.layers.shared/LayerRenderer.js` | Major changes | Use new version |
| `resources/ext.layers.editor/LayersEditor.js` | Significant refactoring | Use new version |
| `src/Api/ApiLayersInfo.php` | New features added | Use new version |
| `src/Api/ApiLayersSave.php` | Validation improvements | Use new version |
| `src/Database/LayersDatabase.php` | Slide support added | Use new version |

### Moderate Conflict Files

| File | Reason |
|------|--------|
| `src/Hooks.php` | Added new hooks |
| `src/Hooks/WikitextHooks.php` | Parser improvements |
| `src/Hooks/UIHooks.php` | Hover overlay added |
| `resources/ext.layers.editor/Toolbar.js` | New tools added |
| `resources/ext.layers.editor/LayerPanel.js` | Search filter added |

### Low/No Conflict Files

- All new files (92 JS, 22 PHP)
- Test files (~157 test suites)
- Documentation files
- CSS files

---

## Testing Requirements

### Required Test Environments

| Environment | Purpose |
|-------------|---------|
| MW 1.39.0 + PHP 7.4 | Minimum version testing |
| MW 1.39.6 (latest LTS) + PHP 8.0 | Recommended version |
| MW 1.42.x + PHP 8.1 | Upper bound testing |

### Test Cases

1. **Core Layer Operations**
   - Create/edit/delete layers on images
   - All 15 drawing tools
   - Undo/redo functionality
   - Layer panel operations

2. **Slide Mode** (if included)
   - `{{#Slide:}}` parser function
   - Special:Slides browsing
   - Special:EditSlide editing
   - Named layer sets on slides

3. **Advanced Features**
   - Shape Library insertion
   - Emoji Picker (if included)
   - Inline text editing
   - Gradient fills
   - Draft recovery

4. **Integration**
   - File page integration
   - Wikitext `layerset=` parameter
   - Permission checks
   - Rate limiting

---

## Recommendations

### Immediate Actions

1. **Set up MW 1.39 test environment** — Docker or VirtualBox with MW 1.39.6
2. **Create feature branch** — `feature/rel139-backport`
3. **Start with Option A Phase 1** — Core improvements and bug fixes
4. **Incremental testing** — Test each phase before proceeding

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Hook incompatibility | Test each hook individually on MW 1.39 |
| API differences | Create compatibility shim layer if needed |
| OOUI version differences | Test UI components manually |
| Performance regression | Profile on MW 1.39 environment |

### Success Criteria

- [ ] All 10,667 Jest tests pass
- [ ] PHPUnit tests pass on MW 1.39
- [ ] ESLint/Stylelint pass
- [ ] Manual testing of all 15 tools
- [ ] Slide Mode works (if included)
- [ ] No regressions in existing functionality

---

## Conclusion

Backporting is **feasible but significant effort**. The PHP code is compatible, the main work is:

1. **Merging extension.json** — Most complex file
2. **Testing on MW 1.39** — Regression prevention
3. **Hook verification** — Ensure all hooks work

**Recommended Approach:** Option A (Full Feature Parity) if you can invest 2-3 weeks. The REL1_39 branch would then offer near-complete feature parity with main, benefiting the many MW 1.39 installations still in production.

---

*This analysis was generated by GitHub Copilot on January 27, 2026.*
