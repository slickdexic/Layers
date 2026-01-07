# Documentation Update Guide

**Last Updated:** January 7, 2026

This guide ensures all documentation stays synchronized when making changes to the Layers extension. **This is a MANDATORY checklist before every release.**

> ⚠️ **CRITICAL:** Version 1.5.1 was released with outdated documentation in wiki/Home.md, wiki/Installation.md, and Mediawiki-Extension-Layers.txt. This guide exists to prevent that from happening again.

---

## 🔴 MANDATORY Release Checklist

Before EVERY release, run this verification script to identify stale documentation:

```bash
# Run from extension root directory
VERSION=$(grep '"version"' extension.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
echo "Current version: $VERSION"
echo ""
echo "=== Files that should contain version $VERSION ==="
grep -rn --include="*.md" --include="*.txt" --include="*.json" "1\.[0-9]\.[0-9]" . \
  | grep -v node_modules | grep -v vendor | grep -v CHANGELOG \
  | grep -v "wiki/Changelog" | grep -v coverage | head -30
```

### Quick Version Grep Commands

```bash
# Find files with OLD version (replace X.X.X with old version)
grep -rn --include="*.md" --include="*.txt" "1.5.0" . | grep -v node_modules | grep -v vendor | grep -v CHANGELOG

# Verify all files have CURRENT version
grep -rn --include="*.md" --include="*.txt" "1.5.1" . | grep -v node_modules | grep -v vendor
```

---

## 📋 The "12 Files" Rule

**TWELVE files must be updated for every version change.** No exceptions.

| # | File | What to Update | Verification |
|---|------|----------------|--------------|
| 1 | `extension.json` | `"version"` field | Source of truth |
| 2 | `package.json` | `"version"` field | `grep version package.json` |
| 3 | `README.md` | Version line, metrics | `grep -n "Version:" README.md` |
| 4 | `CHANGELOG.md` | New version section | `head -20 CHANGELOG.md` |
| 5 | `Mediawiki-Extension-Layers.txt` | `\|version =`, test counts | `grep -n "version\|Stability" Mediawiki-Extension-Layers.txt` |
| 6 | `wiki/Home.md` | "What's New", Project Status table | `grep -n "Version\|Tests" wiki/Home.md` |
| 7 | `wiki/Installation.md` | Branch version table | `grep -n "main\|REL1_43" wiki/Installation.md` |
| 8 | `wiki/Changelog.md` | Mirror of CHANGELOG.md | `head -30 wiki/Changelog.md` |
| 9 | `codebase_review.md` | Version header, metrics | `grep -n "Version" codebase_review.md` |
| 10 | `improvement_plan.md` | Version header | `grep -n "Version" improvement_plan.md` |
| 11 | `docs/KNOWN_ISSUES.md` | Version header | `grep -n "Version" docs/KNOWN_ISSUES.md` |
| 12 | `.github/copilot-instructions.md` | Version number (if present) | `grep -n "1\.[0-9]\.[0-9]" .github/copilot-instructions.md` |

---

## 📊 The "6 Test Count Files" Rule

**SIX files contain test counts/coverage.** When tests change, update ALL of them.

| File | What to Update |
|------|----------------|
| `README.md` | Badge + "Quality Metrics" table |
| `Mediawiki-Extension-Layers.txt` | "Technical Details" section |
| `wiki/Home.md` | Badge + "Project Status" table |
| `codebase_review.md` | Multiple metrics sections |
| `improvement_plan.md` | "Test Summary" section |
| `.github/copilot-instructions.md` | Test count in architecture section |

### Get Current Metrics

```bash
# Run tests with coverage and capture output
npm run test:js -- --coverage 2>&1 | tee /tmp/test-output.txt

# Extract key metrics
grep "Test Suites:" /tmp/test-output.txt
grep "Tests:" /tmp/test-output.txt  
grep "Statements" /tmp/test-output.txt
```

---

## 🛠️ Feature-Specific Updates

### Drawing Tools Changes

When adding or removing drawing tools, update these 8 files:

| File | What to Update |
|------|----------------|
| `README.md` | Drawing Tools table |
| `Mediawiki-Extension-Layers.txt` | "Drawing Tools" table, description count |
| `wiki/Home.md` | Highlights section if applicable |
| `wiki/Drawing-Tools.md` | Complete tool documentation |
| `wiki/Quick-Start-Guide.md` | Tool count mentions |
| `wiki/FAQ.md` | Tool count in answers |
| `wiki/Keyboard-Shortcuts.md` | New shortcuts if any |
| `.github/copilot-instructions.md` | Tool list in architecture section |

### API Changes

| File | What to Update |
|------|----------------|
| `wiki/API-Reference.md` | Full API documentation |
| `.github/copilot-instructions.md` | API contracts section |
| `docs/API.md` | Detailed API docs |
| `README.md` | API overview if mentioned |

### Configuration Changes

| File | What to Update |
|------|----------------|
| `extension.json` | Config defaults |
| `wiki/Configuration-Reference.md` | All config options |
| `wiki/Installation.md` | Common configuration examples |
| `Mediawiki-Extension-Layers.txt` | `|parameters =` list |
| `.github/copilot-instructions.md` | Configuration section |
| `README.md` | Configuration section |

### Permission Changes

| File | What to Update |
|------|----------------|
| `extension.json` | Rights definitions |
| `wiki/Permissions.md` | Full permissions documentation |
| `wiki/Installation.md` | Permission setup examples |
| `Mediawiki-Extension-Layers.txt` | `|rights =` list |
| `README.md` | Permissions section if mentioned |

---

## ✅ Step-by-Step Release Procedure

Work through this checklist **in order** for every release:

```
□ 1. Update extension.json version
□ 2. Update package.json version  
□ 3. Add CHANGELOG.md entry at top
□ 4. Copy CHANGELOG entry to wiki/Changelog.md
□ 5. Run tests: npm run test:js -- --coverage
□ 6. Record metrics: _____ tests, ___% statement coverage
□ 7. Update README.md (version line, badge, metrics table)
□ 8. Update Mediawiki-Extension-Layers.txt (|version=, |update=, test count)
□ 9. Update wiki/Home.md (What's New section, Project Status table)
□ 10. Update wiki/Installation.md (branch version table)
□ 11. Update codebase_review.md (version header, metrics)
□ 12. Update improvement_plan.md (version header)
□ 13. Update docs/KNOWN_ISSUES.md (version header)
□ 14. VERIFY: grep -r "OLD_VERSION" --include="*.md" . | grep -v node_modules
□ 15. Commit: git commit -m "docs: update documentation for vX.Y.Z"
```

---

## 🚫 Common Mistakes to Avoid

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Updating README.md but not wiki/Home.md | Conflicting version info | Always update together |
| Updating CHANGELOG.md but not wiki/Changelog.md | Wiki shows old info | They must mirror each other |
| Updating test count in one file only | 5 other files are wrong | Use the "6 files" list |
| Updating version in extension.json only | 11 other files are wrong | Use the "12 files" list |
| Forgetting Mediawiki-Extension-Layers.txt | MediaWiki.org page is stale | It's file #5 in checklist |
| Releasing without grep verification | Old versions slip through | Always run step #14 |

---

## 🤖 For AI Assistants (Copilot/Claude)

When a user asks to update documentation or prepare a release:

1. **ALWAYS** check extension.json for the canonical version
2. **NEVER** update only one or two files — use the "12 files" rule
3. **ALWAYS** run grep verification for the old version number
4. **ALWAYS** update wiki/Home.md when updating README.md
5. **ALWAYS** update wiki/Changelog.md when updating CHANGELOG.md
6. **ALWAYS** update Mediawiki-Extension-Layers.txt — it's often forgotten

When asked for a code review or metrics update:
- Run `npm run test:js -- --coverage` to get real numbers
- Update ALL 6 test count files, not just one

---

## 📁 Document Categories Quick Reference

### Primary (Must Always Be Accurate)
1. `README.md` — First thing users see
2. `Mediawiki-Extension-Layers.txt` — MediaWiki.org page source
3. `CHANGELOG.md` — Version history
4. `wiki/Home.md` — GitHub Wiki homepage

### Secondary (Update for Major Changes)
1. `codebase_review.md` — Technical assessment
2. `improvement_plan.md` — Development roadmap  
3. `docs/KNOWN_ISSUES.md` — Issue tracking
4. `.github/copilot-instructions.md` — AI contributor instructions

### Wiki (Auto-synced to GitHub Wiki)
- `wiki/Installation.md` — Setup instructions
- `wiki/Changelog.md` — Version history mirror
- `wiki/Drawing-Tools.md` — Tool documentation
- `wiki/Configuration-Reference.md` — Config options
- Others as needed

---

## 📜 History

| Date | Event |
|------|-------|
| January 7, 2026 | Guide enhanced after v1.5.1 was released with stale wiki docs |
| January 6, 2026 | Guide created to document update procedures |

---

*This guide is referenced by `.github/copilot-instructions.md` section 12.*
