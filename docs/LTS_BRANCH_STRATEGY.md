# LTS Branch Strategy for Layers Extension

This document outlines the support strategy for MediaWiki LTS branches.

---

## Branch Overview

| Branch | MediaWiki Version | Current Version | Status |
|--------|------------------|-----------------|--------|
| `main` | 1.44+ | 1.4.9 | Active Development |
| `REL1_43` | 1.43.x | 1.4.9-REL1_43 | LTS (until Dec 2027) |
| `REL1_39` | 1.39.x - 1.42.x | 1.1.14 | Community Maintained (EOL Dec 31, 2025) |

---

## REL1_43 Branch (Current LTS)

### Supported MediaWiki Version
- MediaWiki 1.43.x (LTS until December 2027)

### Feature Parity
The REL1_43 branch includes **all features** from main v1.3.0:
- 13 drawing tools including new custom shape library (v1.5.0)
- Layer grouping/folders (Ctrl+G, Ctrl+Shift+G)
- Named layer sets with revision history
- Smart guides and alignment tools
- Style presets
- Deep linking (`layerslink=editor`, `layerslink=viewer`, `layerslink=editor-modal`)
- Fullscreen lightbox viewer

### Maintenance Policy
- Security fixes backported from `main`
- Critical bug fixes backported from `main`
- New features may be backported if compatible

---

## REL1_39 Branch (Legacy - Community Maintained)

### ⚠️ EOL Notice
**MediaWiki 1.39 LTS reached end-of-life on December 31, 2025.**

This branch is now **community maintained**. The core team will no longer actively maintain it, but community contributions are welcome.

### Supported MediaWiki Versions
- MediaWiki 1.39.x (EOL December 31, 2025)
- MediaWiki 1.40.x
- MediaWiki 1.41.x
- MediaWiki 1.42.x

### What This Means
- No guaranteed security updates
- No guaranteed bug fixes
- Community PRs will be reviewed and merged
- Users should upgrade to MediaWiki 1.43+ and use REL1_43 branch

---

## Version Numbering

| Branch | Version Series | Example |
|--------|----------------|---------|
| `main` | 1.3.x | 1.3.0 |
| `REL1_43` | 1.3.x-REL1_43 | 1.3.0-REL1_43 |
| `REL1_39` | 1.1.x | 1.1.14 |

---

## Backporting Process

### When to Backport

Consider backporting to REL1_43 when:

1. A security vulnerability is discovered
2. A critical bug affects core annotation functionality
3. A fix resolves data corruption or loss issues

### How to Backport

```bash
# 1. Checkout REL1_43 branch
git checkout REL1_43

# 2. Cherry-pick the fix from main
git cherry-pick <commit-hash>

# 3. Resolve any conflicts if needed

# 4. Update version in extension.json
# Increment patch version: 1.3.0-REL1_43 → 1.3.1-REL1_43

# 5. Update CHANGELOG.md on the branch

# 6. Push and create release
git push origin REL1_43
git tag v1.3.1-REL1_43
git push origin v1.3.1-REL1_43
```

---

## API Compatibility

All branches use the same APIs and data format:

| Feature | MW 1.39-1.42 | MW 1.43 | MW 1.44+ |
|---------|--------------|---------|----------|
| `ThumbnailBeforeProduceHTML` | ✅ | ✅ | ✅ |
| `Title::newFromText()` | ✅ | ✅ | ✅ |
| Layer JSON format | Compatible | Compatible | Compatible |
| API endpoints | Same | Same | Same |

---

## Feature Comparison

### Features Available in All Branches

| Feature | main | REL1_43 | REL1_39 |
|---------|------|---------|---------|
| 13 Drawing Tools | ✅ | ✅ | ✅* |
| Named Layer Sets | ✅ | ✅ | ✅ |
| Version History | ✅ | ✅ | ✅ |
| Image Import | ✅ | ✅ | ✅ |
| PNG Export | ✅ | ✅ | ✅ |
| Keyboard Shortcuts | ✅ | ✅ | ✅ |
| ARIA Accessibility | ✅ | ✅ | ✅ |

### Features in main and REL1_43 Only

| Feature | main | REL1_43 | REL1_39 |
|---------|------|---------|---------|
| Blur Fill for Shapes | ✅ | ✅ | ❌ |
| Blur Fill for Arrows | ✅ | ✅ | ❌ |
| Layer Grouping/Folders | ✅ | ✅ | ❌ |
| Fullscreen Lightbox Viewer | ✅ | ✅ | ❌ |
| Deep Linking | ✅ | ✅ | ❌ |
| Smart Guides | ✅ | ✅ | ❌ |
| Compact Layer Panel UI | ✅ | ✅ | ❌ |
| Style Presets | ✅ | ✅ | ❌ |

---

## User Migration Guide

### Migrating from REL1_39 to REL1_43

**Prerequisites:**
1. Upgrade MediaWiki to 1.43.x
2. Backup database (layer sets are compatible)

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
| 1.44+ | `main` |
| 1.43.x | `REL1_43` |
| 1.39-1.42.x | `REL1_43` (upgrade MW first) or `REL1_39` (community maintained) |

### For Existing Installations

- **On MW 1.43+:** Use `REL1_43` for stability, or `main` for latest features
- **On MW 1.39-1.42:** Plan upgrade to MW 1.43+ before June 2027

---

## Contact

- **Issues:** https://github.com/slickdexic/Layers/issues
- **Security:** Use GitHub Security tab for responsible disclosure

---

*Last updated: December 31, 2025*
