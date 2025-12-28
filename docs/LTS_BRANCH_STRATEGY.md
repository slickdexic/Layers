# LTS Branch Strategy for Layers Extension

This document outlines the support strategy for the MediaWiki 1.39 LTS (Long-Term Support) branch.

---

## Branch Overview

| Branch | MediaWiki Version | Current Version | Status |
|--------|------------------|-----------------|--------|
| `main` | 1.44+ | 1.2.9 | Active Development |
| `REL1_39` | 1.39.x - 1.43.x | 1.1.14 | LTS Maintenance |

---

## REL1_39 Branch (LTS)

### Supported MediaWiki Versions
- MediaWiki 1.39.x (LTS until June 2027)
- MediaWiki 1.40.x
- MediaWiki 1.41.x
- MediaWiki 1.42.x
- MediaWiki 1.43.x

### Maintenance Policy

The REL1_39 branch receives:

1. **Security Fixes** — All security vulnerabilities discovered in `main` are backported
2. **Critical Bug Fixes** — Bugs that break core functionality are backported
3. **Data Compatibility** — Layer set JSON format remains compatible between branches

The REL1_39 branch does **NOT** receive:

1. **New Features** — Features like blur fill, modal editor, etc. are `main` only
2. **UI Improvements** — UI redesigns stay on `main`
3. **Performance Optimizations** — Unless they fix a critical issue
4. **Refactoring** — Code quality improvements stay on `main`

### Version Numbering

- `main` branch: 1.2.x series (active development)
- `REL1_39` branch: 1.1.x series (maintenance only)

Backports increment the patch version (e.g., 1.1.14 → 1.1.15).

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
