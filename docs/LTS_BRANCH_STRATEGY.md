# LTS Branch Strategy for Layers Extension

This document outlines the support strategy for MediaWiki LTS branches.

---

## Branch Overview

| Branch | MediaWiki Version | Current Version | Status |
|--------|------------------|-----------------|--------|
| `main` | 1.44+ | 1.2.18 | Active Development |
| `REL1_43` | 1.43.x | 1.3.0-REL1_43 | LTS (until Dec 2027) |
| `REL1_39` | 1.39.x - 1.42.x | 1.1.14 | Community Maintained (EOL Dec 31, 2025) |

---

## REL1_43 Branch (Current LTS)

### Supported MediaWiki Version
- MediaWiki 1.43.x (LTS until December 2027)

### Feature Parity
The REL1_43 branch includes **all features** from main v1.2.18:
- 14 drawing tools with blur fill support
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
| `main` | 1.2.x | 1.2.18 |
| `REL1_43` | 1.3.x-REL1_43 | 1.3.0-REL1_43 |
| `REL1_39` | 1.1.x | 1.1.14 |

---

## Backporting Process

### When to Backport

Consider backporting when:

1. A security vulnerability is discovered
2. A critical bug affects core annotation functionality
3. A fix resolves data corruption or loss issues
4. MediaWiki deprecation causes failures

### How to Backport

```bash
# 1. Checkout REL1_39 branch
git checkout REL1_39

# 2. Cherry-pick the fix from main
git cherry-pick <commit-hash>

# 3. Resolve any conflicts (adapt for MW 1.39 APIs)

# 4. Update version in extension.json
# Increment patch version: 1.1.14 → 1.1.15

# 5. Update CHANGELOG.md on the branch

# 6. Push and create release
git push origin REL1_39
git tag v1.1.15
git push origin v1.1.15
```

### API Differences Between Branches

Key differences between MediaWiki 1.39 and 1.44+:

| Feature | MW 1.39 | MW 1.44+ |
|---------|---------|----------|
| Title class | `Title::newFromText()` | `TitleFactory` service |
| User groups | `$user->getGroups()` | `$user->getEffectiveGroups()` |
| Thumbnail hooks | `MakeImageLink2` | `ThumbnailBeforeProduceHTML` |
| Hook registration | Mixed | Handler pattern |

---

## Feature Parity

### Features Available in Both Branches

| Feature | main | REL1_39 |
|---------|------|---------|
| 14 Drawing Tools | ✅ | ✅ |
| Named Layer Sets | ✅ | ✅ |
| Version History | ✅ | ✅ |
| Image Import | ✅ | ✅ |
| PNG Export | ✅ | ✅ |
| Keyboard Shortcuts | ✅ | ✅ |
| ARIA Accessibility | ✅ | ✅ |

### Features Only on `main` (1.44+)

| Feature | Version Added |
|---------|---------------|
| Blur Fill for Shapes | v1.2.6 |
| Blur Fill for Arrows | v1.2.7 |
| Fullscreen Lightbox Viewer | v1.2.0 |
| `layerslink=editor` Deep Linking | v1.2.0 |
| `layerslink=viewer` Lightbox Mode | v1.2.0 |
| `layerslink=editor-modal` Modal Mode | v1.2.5 |
| `layerslink=editor-newtab` New Tab Mode | v1.2.5 |
| Smart Guides | v1.1.7 (backported) |
| Compact Layer Panel UI | v1.2.7 |

---

## Timeline

### MediaWiki 1.39 LTS Support

- **Release Date:** November 2022
- **LTS End Date:** June 2027
- **Layers REL1_39 Support:** Until MediaWiki 1.39 EOL

### When to Deprecate REL1_39

1. After MediaWiki 1.39 reaches end-of-life
2. When maintenance burden becomes unsustainable
3. Minimum 6 months notice before dropping support

---

## User Migration Guide

### Migrating from REL1_39 to main

**Prerequisites:**
1. Upgrade MediaWiki to 1.44+
2. Backup database (layer sets are compatible)

**Steps:**

```bash
cd /path/to/extensions/Layers
git fetch origin
git checkout main
git pull origin main
```

**Layer data is fully compatible** — no migration needed for existing annotations.

### Staying on REL1_39

If you must stay on MediaWiki 1.39-1.43:

1. Keep using the REL1_39 branch
2. Watch for security releases
3. Plan upgrade path for before June 2027

---

## Recommendations

### For New Installations

Use the `main` branch with MediaWiki 1.44+ for:
- Latest features (blur fill, deep linking, lightbox)
- Active development and faster bug fixes
- Best performance and code quality

### For Existing 1.39 Installations

Evaluate upgrade path:
- **Can upgrade:** Migrate to MediaWiki 1.44+ and `main` branch
- **Cannot upgrade:** Continue with REL1_39, monitor security releases

---

## Contact

- **Issues:** https://github.com/slickdexic/Layers/issues
- **Security:** security@example.com (use GitHub Security tab for responsible disclosure)

---

*Last updated: December 28, 2025*
