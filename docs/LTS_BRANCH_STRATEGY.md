# LTS Branch Strategy for Layers Extension

This document outlines the branch strategy and support policy for the Layers extension.

---

## Primary Branch: `main`

**`main` is the primary development and testing branch.** All new features, bug fixes, and improvements are developed and tested on `main` first. The full test suite (11,148 tests, 162 suites) runs on `main` as the source of truth.

Changes are **cherry-picked** from `main` to the REL branches after verification. REL branches never receive changes that haven't been tested on `main` first.

---

## Branch Overview

| Branch | MediaWiki Version | Current Version | Status |
|--------|------------------|-----------------|--------|
| **`main`** | **1.44+** | **1.5.58** | **Primary — all development and testing** |
| `REL1_43` | 1.43.x | 1.5.58 | LTS support (until Dec 2027) |
| `REL1_39` | 1.39.x - 1.42.x | 1.5.58 | Legacy LTS support (MW 1.39 EOL Dec 2025) |

### Development Workflow

```
main (primary)
  │
  ├── All development happens here
  ├── All tests run here first (11,148 tests)
  ├── All code reviews done here
  │
  ├──── cherry-pick ──→ REL1_43 (current LTS)
  │
  └──── cherry-pick ──→ REL1_39 (previous LTS)
```

---

## REL1_43 Branch (Current MediaWiki LTS)

### Supported MediaWiki Version
- MediaWiki 1.43.x (LTS until December 2027)

### Feature Parity
The REL1_43 branch maintains **full feature parity** with `main`:
- 15 drawing tools including Shape Library (5,116 shapes) and Emoji Picker (2,817 emoji)
- Layer grouping/folders (Ctrl+G, Ctrl+Shift+G)
- Named layer sets with revision history
- Smart guides and alignment tools
- Style presets with import/export
- Deep linking (`layerslink=editor`, `layerslink=viewer`, `layerslink=editor-modal`)
- Fullscreen lightbox viewer
- Slide mode for standalone graphics
- Gradient fills

### Maintenance Policy
- Bug fixes cherry-picked from `main`
- Security fixes cherry-picked from `main`
- New features cherry-picked if compatible with MW 1.43

---

## REL1_39 Branch (Previous MediaWiki LTS)

### ⚠️ EOL Notice
**MediaWiki 1.39 LTS reached end-of-life on December 31, 2025.**

This branch is maintained because many users are still on MW 1.39. Bug fixes and security fixes are cherry-picked from `main` when applicable.

### Supported MediaWiki Versions
- MediaWiki 1.39.x (EOL December 31, 2025)
- MediaWiki 1.40.x
- MediaWiki 1.41.x
- MediaWiki 1.42.x

### Feature Parity
REL1_39 maintains full feature parity with `main` for all features compatible with MW 1.39. The only differences are PHP namespace usage (MW 1.39 uses global namespaces like `Title` instead of `MediaWiki\Title\Title`).

### Recommendation
Users on MW 1.39-1.42 should plan to upgrade to MW 1.43+ and switch to REL1_43.

---

## Version Numbering

| Branch | Version Format | Example |
|--------|---------------|---------|
| `main` | X.Y.Z | 1.5.58 |
| `REL1_43` | X.Y.Z-REL1_43 | 1.5.58-REL1_43 |
| `REL1_39` | X.Y.Z-REL1_39 | 1.5.58-REL1_39 |

---

## Cherry-Pick Process

All changes flow from `main` to REL branches via cherry-pick:

### When to Cherry-Pick

Cherry-pick from `main` to both REL branches when:

1. A security vulnerability is fixed
2. A critical bug is fixed
3. A data corruption or loss issue is resolved
4. Documentation is updated

### How to Cherry-Pick

```bash
# 1. Ensure the fix is committed and tested on main
git checkout main
npm run test:js  # All tests must pass

# 2. Cherry-pick to REL1_43
git checkout REL1_43
git cherry-pick <commit-hash>
# Resolve conflicts if needed (usually --theirs for docs)
npm run test:js  # Verify tests pass

# 3. Cherry-pick to REL1_39
git checkout REL1_39
git cherry-pick <commit-hash>
# Resolve conflicts if needed
npm run test:js  # Verify tests pass

# 4. Push all branches
git push origin main REL1_43 REL1_39

# 5. Return to main for continued development
git checkout main
```

---

## API Compatibility

All branches use the same APIs and data format:

| Feature | REL1_39 | REL1_43 | main |
|---------|---------|---------|------|
| `ThumbnailBeforeProduceHTML` | ✅ | ✅ | ✅ |
| `Title::newFromText()` | ✅ | ✅ | ✅ |
| Layer JSON format | Compatible | Compatible | Compatible |
| API endpoints | Same | Same | Same |

---

## Feature Comparison

All three branches are kept at feature parity. The only differences between branches are PHP compatibility adjustments (namespace imports for MW 1.39).

| Feature | main | REL1_43 | REL1_39 |
|---------|------|---------|---------|
| 15 Drawing Tools | ✅ | ✅ | ✅ |
| Named Layer Sets | ✅ | ✅ | ✅ |
| Version History | ✅ | ✅ | ✅ |
| Image Import | ✅ | ✅ | ✅ |
| PNG Export | ✅ | ✅ | ✅ |
| Keyboard Shortcuts | ✅ | ✅ | ✅ |
| ARIA Accessibility | ✅ | ✅ | ✅ |
| Layer Grouping/Folders | ✅ | ✅ | ✅ |
| Fullscreen Lightbox | ✅ | ✅ | ✅ |
| Deep Linking | ✅ | ✅ | ✅ |
| Smart Guides | ✅ | ✅ | ✅ |
| Style Presets | ✅ | ✅ | ✅ |
| Shape Library | ✅ | ✅ | ✅ |
| Emoji Picker | ✅ | ✅ | ✅ |
| Slide Mode | ✅ | ✅ | ✅ |
| Gradient Fills | ✅ | ✅ | ✅ |

---

## User Migration Guide

### Migrating from REL1_39 to REL1_43

**Prerequisites:**
1. Upgrade MediaWiki to 1.43.x
2. Backup database (layer sets are fully compatible)

**Steps:**

```bash
cd /path/to/extensions/Layers
git fetch origin
git checkout REL1_43
git pull origin REL1_43
php maintenance/run.php update.php
```

**Layer data is fully compatible** — no migration needed for existing annotations.

### Migrating from REL1_43 to main

**Prerequisites:**
1. Upgrade MediaWiki to 1.44+

**Steps:**

```bash
cd /path/to/extensions/Layers
git fetch origin
git checkout main
git pull origin main
php maintenance/run.php update.php
```

---

## Recommendations

### For New Installations

| MediaWiki Version | Recommended Branch |
|-------------------|--------------------|
| 1.44+ | **`main`** (primary, latest features) |
| 1.43.x | `REL1_43` |
| 1.39-1.42.x | `REL1_39` (but plan to upgrade to MW 1.43+) |

### For Existing Installations

- **On MW 1.44+:** Use `main` — this is the primary branch with the fastest bug fixes
- **On MW 1.43+:** Use `REL1_43` for stability
- **On MW 1.39-1.42:** Use `REL1_39`, but plan upgrade to MW 1.43+

---

## Contact

- **Issues:** https://github.com/slickdexic/Layers/issues
- **Security:** Use GitHub Security tab for responsible disclosure

---

*Last updated: February 8, 2026*
