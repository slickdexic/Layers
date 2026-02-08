# Layers Extension - Release Guide

**Last Updated:** February 6, 2026  
**Purpose:** Comprehensive checklist for preparing and publishing releases

---

## Overview

This document ensures all documentation and metadata files are properly updated during releases. **Every release, no matter how small, requires updating these files.**

---

## Pre-Release Checklist

### 1. Code Quality Verification

Before updating any documentation, verify the codebase is release-ready:

```bash
# Run all lints
npm test

# Run all tests
npm run test:js

# Run PHP tests (if applicable)
npm run test:php
```

**All checks must pass with zero errors before proceeding.**

---

## Files to Update

### Critical Files (ALWAYS Update)

| File | What to Update | Common Mistakes |
|------|---------------|-----------------|
| `extension.json` | `version` field | Forgetting to bump version |
| `README.md` | Version badge, features list, installation notes | Old version number, missing new features |
| `CHANGELOG.md` | New version section with changes | Wrong date, missing items, version mismatch |
| `Mediawiki-Extension-Layers.mediawiki` | Version, features, compatibility | Often completely neglected |

### Documentation Files (Update as Needed)

| File | What to Update | When to Update |
|------|---------------|----------------|
| `improvement_plan.md` | Version, rating, completed items status | Every release |
| `codebase_review.md` | Version, metrics, assessment score | Every release |
| `docs/API.md` | API changes, new endpoints | API changes |
| `docs/ARCHITECTURE.md` | Architecture changes | Major refactors |
| `docs/ACCESSIBILITY.md` | A11y improvements | A11y changes |

### Wiki Folder Files (Sync with Release)

| File | What to Update | Priority |
|------|---------------|----------|
| `wiki/Home.md` | Version number, key features | HIGH |
| `wiki/Changelog.md` | Mirror of CHANGELOG.md | HIGH |
| `wiki/Installation.md` | Version requirements | HIGH |
| `wiki/Configuration-Reference.md` | New config options | MEDIUM |
| `wiki/FAQ.md` | New FAQs | LOW |
| `wiki/API-Reference.md` | API changes | MEDIUM |
| `wiki/Drawing-Tools.md` | New tools | MEDIUM |
| `wiki/Keyboard-Shortcuts.md` | New shortcuts | LOW |

---

## Detailed Update Instructions

### 1. extension.json

**Location:** Root directory  
**Field:** `"version"`

```json
{
    "name": "Layers",
    "version": "1.3.2",  // ← UPDATE THIS
    ...
}
```

**Version Format:** `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

---

### 2. README.md

**Sections to Check:**

1. **Version badge** (if present)
2. **Features list** - Add any new features
3. **Installation section** - Update version requirements
4. **Quick Start** - Verify accuracy
5. **Requirements** - Update MW version compatibility

**Common Mistakes:**
- Forgetting to add new features to the feature list
- Leaving old version numbers in examples

---

### 3. CHANGELOG.md

**Format:**

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Changed behavior description

### Fixed
- Bug fix description

### Removed
- Removed feature description

### Security
- Security fix description

### Deprecated
- Deprecated feature description
```

**Rules:**
- Use present tense ("Add" not "Added")
- Link to issues/PRs where applicable
- Group related changes
- Most recent version at TOP of file

---

### 4. Mediawiki-Extension-Layers.mediawiki

**This file is the MediaWiki extension registry page content.**

**Sections to Update:**

1. **Version** - Current version number
2. **MediaWiki** - Supported versions
3. **Status** - stable/beta/alpha
4. **Features** - Feature list
5. **Changelog** - Recent changes summary

**Template:**

```
{{Extension
|name        = Layers
|status      = stable
|version     = 1.3.2
|update      = 2025-12-31
|mediawiki   = 1.39+
|php         = 7.4+
|license     = GPL-2.0-or-later
...
}}
```

---

### 5. improvement_plan.md

**Sections to Check:**

1. **Version** at top
2. **Last Updated** date
3. **Current Rating** score
4. **Current State table** - All metrics accurate
5. **Phase sections** - Mark completed items as ✅

**Common Mistakes:**
- Leaving completed items marked as ⏳
- Forgetting to update the rating
- Outdated metrics

---

### 6. codebase_review.md

**Sections to Check:**

1. **Review Date** at top
2. **Version** number
3. **Overall Assessment** score
4. **Key Strengths** list - Add new achievements
5. **Verified Metrics table** - Update all numbers
6. **Areas for Improvement** - Remove fixed issues

---

### 7. Wiki Folder Documents

**Priority Order:**

1. `wiki/Home.md` - Version, feature highlights
2. `wiki/Changelog.md` - Copy from CHANGELOG.md
3. `wiki/Installation.md` - Version requirements
4. `wiki/Configuration-Reference.md` - New config options

**Sync Command:**
After updating, commit and push to trigger wiki sync (if automated) or manually copy to GitHub wiki.

---

## Release Process

### Step 1: Update All Files

Work through the checklist above, updating every file.

### Step 2: Run Final Verification

```bash
npm test
npm run test:js
npm run test:php
```

### Step 3: Commit Changes

```bash
git add -A
git commit -m "Prepare release vX.Y.Z

- Update version to X.Y.Z
- Update CHANGELOG with release notes
- Update documentation"
```

### Step 4: Push to Repository

```bash
git push origin main
```

### Step 5: Create GitHub Release

1. Go to GitHub → Releases → New Release
2. Tag: `vX.Y.Z`
3. Title: `Layers vX.Y.Z`
4. Description: Copy relevant CHANGELOG section
5. Check "Set as latest release"
6. Publish

### Step 6: Update LTS Branches

**`main` is the primary branch.** All changes are developed and tested on `main` first, then cherry-picked to REL branches.

For each LTS branch (REL1_43, then REL1_39):

```bash
# Cherry-pick the release commit(s) from main
git checkout REL1_43
git cherry-pick <commit-hash>
# Resolve any conflicts (use --theirs for docs)
npm run test:js  # Verify tests pass
git push origin REL1_43
git tag vX.Y.Z-REL1_43
git push origin vX.Y.Z-REL1_43

# Repeat for REL1_39
git checkout REL1_39
git cherry-pick <commit-hash>
npm run test:js
git push origin REL1_39

# Return to main
git checkout main
```

### Step 7: Update GitHub Wiki

1. Navigate to wiki tab
2. Clone wiki locally or edit online
3. Update pages from `wiki/` folder
4. Commit and push wiki changes

---

## Post-Release Checklist

- [ ] GitHub release published
- [ ] All LTS branch releases published
- [ ] Wiki updated
- [ ] MediaWiki.org page updated (if applicable)
- [ ] Announcement posted (if applicable)

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2025-12-31 | Initial release guide |

---

## Quick Reference Card

### Files to Update Every Release

```
extension.json          → version field
README.md               → version, features
CHANGELOG.md            → new version section
improvement_plan.md     → version, rating, completed items
codebase_review.md      → version, metrics
Mediawiki-Extension-Layers.mediawiki → version, features
wiki/Home.md            → version, features
wiki/Changelog.md       → sync with CHANGELOG.md
wiki/Installation.md    → version requirements
```

### Pre-Release Commands

```bash
npm test                 # Lint checks
npm run test:js          # Jest tests
npm run test:php         # PHP tests
```

### Release Commands

```bash
git add -A
git commit -m "Prepare release vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```
