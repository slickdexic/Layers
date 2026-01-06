# Documentation Update Guide

**Last Updated:** January 6, 2026

This guide ensures all documentation stays synchronized when making changes to the Layers extension. Use this checklist before every commit that affects version, metrics, or features.

---

## Pre-Commit Documentation Checklist

### 1. Version Changes

When updating the version number, update **ALL** of these files:

| File | What to Update |
|------|----------------|
| `extension.json` | `"version"` field |
| `package.json` | `"version"` field |
| `README.md` | Version badge and "Version:" line |
| `CHANGELOG.md` | Add new version section at top |
| `Mediawiki-Extension-Layers.txt` | `|version =` and `|update =` fields |
| `docs/KNOWN_ISSUES.md` | `**Version:**` in header |
| `codebase_review.md` | `**Version:**` in header |
| `improvement_plan.md` | `**Version:**` in header |
| `wiki/Home.md` | Version badges and "Project Status" table |
| `wiki/Installation.md` | Branch version table |
| `wiki/Changelog.md` | Add new version section (mirrors CHANGELOG.md) |
| `.github/copilot-instructions.md` | Version references if any |

### 2. Test Count / Coverage Changes

When test counts or coverage percentages change, update:

| File | What to Update |
|------|----------------|
| `README.md` | Coverage badge, test count in "Quality Metrics" table |
| `Mediawiki-Extension-Layers.txt` | "Technical Details" section: test count, coverage |
| `docs/KNOWN_ISSUES.md` | "Test Coverage Status" section |
| `codebase_review.md` | All test/coverage metrics throughout |
| `improvement_plan.md` | "Test Summary" section |
| `wiki/Home.md` | Project Status table (tests, coverage) |
| `wiki/Architecture-Overview.md` | "Code Metrics" table |
| `wiki/Testing-Guide.md` | Coverage thresholds if changed |

### 3. Drawing Tools Changes

When adding or removing drawing tools:

| File | What to Update |
|------|----------------|
| `README.md` | Drawing Tools table |
| `Mediawiki-Extension-Layers.txt` | "Drawing Tools" table, description |
| `wiki/Home.md` | Highlights section if applicable |
| `wiki/Drawing-Tools.md` | Complete tool documentation |
| `wiki/Quick-Start-Guide.md` | Tool count mentions |
| `wiki/FAQ.md` | Tool count in answers |
| `wiki/Keyboard-Shortcuts.md` | New shortcuts if any |
| `.github/copilot-instructions.md` | Tool list in architecture section |

### 4. File Count / Line Count Changes

When JavaScript or PHP files are added/removed:

| File | What to Update |
|------|----------------|
| `README.md` | Architecture section (file counts, line counts) |
| `codebase_review.md` | JavaScript/PHP summary tables |
| `improvement_plan.md` | Current State table |
| `wiki/Home.md` | Project Status table |
| `wiki/Architecture-Overview.md` | Code Metrics table, directory structure |
| `.github/copilot-instructions.md` | File line counts in architecture section |

### 5. API Changes

When modifying API endpoints:

| File | What to Update |
|------|----------------|
| `wiki/API-Reference.md` | Full API documentation |
| `.github/copilot-instructions.md` | API contracts section |
| `docs/API.md` | If exists, detailed API docs |
| `README.md` | API overview if mentioned |

### 6. Configuration Changes

When adding/removing configuration options:

| File | What to Update |
|------|----------------|
| `extension.json` | Config defaults |
| `wiki/Configuration-Reference.md` | All config options |
| `wiki/Installation.md` | Common configuration examples |
| `Mediawiki-Extension-Layers.txt` | `|parameters =` list |
| `.github/copilot-instructions.md` | Configuration section |
| `README.md` | Configuration section |

### 7. Permission Changes

When modifying user rights:

| File | What to Update |
|------|----------------|
| `extension.json` | Rights definitions |
| `wiki/Permissions.md` | Full permissions documentation |
| `wiki/Installation.md` | Permission setup examples |
| `Mediawiki-Extension-Layers.txt` | `|rights =` list |
| `README.md` | Permissions section if mentioned |

### 8. Wikitext Syntax Changes

When changing wikitext parameters:

| File | What to Update |
|------|----------------|
| `wiki/Wikitext-Syntax.md` | Full syntax documentation |
| `wiki/Quick-Start-Guide.md` | Basic examples |
| `Mediawiki-Extension-Layers.txt` | Example usage |
| `README.md` | Wikitext examples |
| `docs/WIKITEXT_USAGE.md` | Detailed documentation |
| `.github/copilot-instructions.md` | Wikitext syntax section |

---

## Document Categories

### Primary Documents (Always Check)

These documents are referenced most often and should always be accurate:

1. **`README.md`** — Main project documentation, first thing users see
2. **`Mediawiki-Extension-Layers.txt`** — MediaWiki.org extension page content
3. **`CHANGELOG.md`** — Version history
4. **`wiki/Home.md`** — GitHub Wiki homepage

### Review Documents (Check After Major Changes)

These documents provide technical details and should be updated for significant changes:

1. **`codebase_review.md`** — Technical assessment with metrics
2. **`improvement_plan.md`** — Development roadmap
3. **`docs/KNOWN_ISSUES.md`** — Issue tracking
4. **`.github/copilot-instructions.md`** — AI contributor instructions

### Wiki Documents (Check for Feature/Tool Changes)

These are synced to GitHub Wiki:

| Document | Update When |
|----------|-------------|
| `wiki/Installation.md` | Version changes, requirements change |
| `wiki/Quick-Start-Guide.md` | Tool changes, UI changes |
| `wiki/Drawing-Tools.md` | Any tool addition/modification |
| `wiki/Keyboard-Shortcuts.md` | New shortcuts added |
| `wiki/Configuration-Reference.md` | Config options change |
| `wiki/Permissions.md` | Rights change |
| `wiki/Wikitext-Syntax.md` | Parser syntax changes |
| `wiki/API-Reference.md` | API changes |
| `wiki/Architecture-Overview.md` | Major architecture changes |
| `wiki/Testing-Guide.md` | Test infrastructure changes |
| `wiki/FAQ.md` | Common questions change |
| `wiki/Troubleshooting.md` | New issues discovered |
| `wiki/Changelog.md` | Every release (mirrors CHANGELOG.md) |

---

## Quick Metrics Reference

To gather current metrics, run these commands:

```bash
# Test count and coverage
npm run test:js -- --coverage 2>&1 | grep -E "Test Suites:|Tests:|Statements"

# JavaScript file count
find resources -name "*.js" -not -path "*/dist/*" | wc -l

# JavaScript line count (approximate)
find resources -name "*.js" -not -path "*/dist/*" -exec cat {} + | wc -l

# PHP file count
find src -name "*.php" | wc -l

# PHP line count (approximate)
find src -name "*.php" -exec cat {} + | wc -l
```

---

## Automation Recommendations

### GitHub Actions

The `wiki-sync.yml` workflow automatically syncs `wiki/` to GitHub Wiki on:
- Releases
- Changes to `wiki/**` files

### Pre-Commit Hook (Optional)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Remind to check documentation
echo "📝 Documentation Reminder:"
echo "   Have you updated README.md, wiki/*, and Mediawiki-Extension-Layers.txt?"
echo "   See docs/DOCUMENTATION_UPDATE_GUIDE.md for the full checklist."
echo ""
```

---

## Common Mistakes to Avoid

1. **Updating README.md but forgetting wiki/Home.md** — They have overlapping content
2. **Updating CHANGELOG.md but not wiki/Changelog.md** — They should mirror each other
3. **Changing test counts in one file** — Test counts appear in 6+ documents
4. **Adding a tool without updating Drawing-Tools.md** — Users won't know about it
5. **Updating version in extension.json only** — Version appears in 12+ places
6. **Changing wikitext syntax without updating examples** — Examples will be wrong

---

## Template: Release Documentation Update

When preparing a release, work through this order:

1. ✅ Update `extension.json` version
2. ✅ Update `package.json` version
3. ✅ Add CHANGELOG.md entry
4. ✅ Copy CHANGELOG.md entry to wiki/Changelog.md
5. ✅ Run tests and note final counts: `npm run test:js -- --coverage`
6. ✅ Update README.md (version, metrics)
7. ✅ Update Mediawiki-Extension-Layers.txt (version, date, metrics)
8. ✅ Update wiki/Home.md (version, metrics)
9. ✅ Update wiki/Installation.md (version table)
10. ✅ Update codebase_review.md (version, date, metrics)
11. ✅ Update improvement_plan.md (version, status)
12. ✅ Update docs/KNOWN_ISSUES.md (version, metrics)
13. ✅ Grep for old version number: `grep -r "1.4.8" --include="*.md"`
14. ✅ Commit with message: `docs: update documentation for vX.Y.Z release`

---

*Guide created: January 6, 2026*  
*Maintainer: GitHub Copilot (Claude Opus 4.5)*
