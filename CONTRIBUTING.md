# Contributing to MediaWiki Layers

Thanks for helping improve Layers! This guide covers local setup, how to run checks, and important code quality rules.

## Codebase Size Policy

**Target: <75,000 lines of JavaScript**

This extension is feature-rich by design—14 drawing tools, multiple rendering systems, comprehensive validation, and extensive test coverage. A well-structured, secure, thoroughly-tested codebase of this size is appropriate for a professional MediaWiki extension. The 75K target provides room for continued feature development.

**There is no arbitrary 50K limit.** The focus is on code quality, not line counts:
- ✅ Well-structured with clear separation of concerns
- ✅ Secure with CSRF protection, rate limiting, validation
- ✅ Thoroughly tested (94%+ coverage, 7,688+ tests)
- ✅ Properly delegated (god classes use controller patterns)

---

## ⚠️ MANDATORY: God Class Rules

**We have 8 "god classes" (files >1,000 lines) that represent technical debt. These rules are enforced by CI:**

### Rule 1: No God Class Growth
- **CI will BLOCK your PR** if you increase the size of any god class
- If you need to add code to a god class, you must extract code first
- Target: Net zero or negative line changes to god classes

### Rule 2: No New God Classes
- **CI will BLOCK your PR** if any file exceeds 1,000 lines
- Warning issued at 800 lines - refactor before hitting 1,000
- New modules should be focused and small (<500 lines ideal)

### Rule 3: The 1-for-1 Rule (Recommended)
- For every 50 lines you add, extract 50 lines from a god class
- This helps pay down debt while adding features
- Not enforced by CI, but strongly encouraged

### Current God Classes (Do Not Grow These)
| File | Lines | Status |
|------|-------|--------|
| CanvasManager.js | 1,877 | Facade - delegates to 10+ controllers |
| LayerPanel.js | 1,838 | Delegates to 7 controllers |
| Toolbar.js | 1,537 | Needs split |
| LayersEditor.js | 1,355 | Partial delegation |
| ToolManager.js | 1,261 | Delegates to 2 handlers |
| CanvasRenderer.js | 1,242 | Delegates to SelectionRenderer |
| SelectionManager.js | 1,194 | Delegates to SelectionState, SelectionHandles |
| APIManager.js | 1,182 | Delegates to APIErrorHandler |

See [`improvement_plan.md`](improvement_plan.md) for refactoring guidance.

---

## Prerequisites

- Node.js 18+ and npm
- PHP 8.1+ with Composer (the PHP dependency manager)
- MediaWiki dev environment (for running server-side tests/integration)

## Install

- npm install
- composer install

## Run checks locally

- JS lint/style/i18n: npm test
- JS unit tests: npm run test:js
- PHP QA (lint/style/minus-x): composer test
- God class check: npm run check:godclass

### Optional: Git Pre-commit Hook

To catch god class violations before committing:

```bash
# Linux/Mac/Git Bash
cp scripts/pre-commit-god-class-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Or run manually before pushing:
npm run check:godclass
```

## Windows: Composer name conflict

On some Windows machines, a Python package named "composer" (e.g., mosaicml/composer) can shadow PHP Composer on PATH. Symptoms:

- Running composer test prints a Python traceback

Fixes:

- Ensure PHP Composer is installed via the official Windows installer and is first on PATH
- Use composer.bat explicitly in terminals
- Uninstall/rename the Python “composer” entry point (pip uninstall composer if not needed)
- As a fallback, download composer.phar locally and run:
  - php composer.phar install
  - php composer.phar run test

## Notes

- ResourceLoader loads sources under resources/ext.layers*; resources/dist is for optional debug builds
- All new user-facing strings must use i18n (mw.message / wfMessage)
- Keep layer object fields within the server whitelist (see docs and ApiLayersSave)

---

## Code Quality Standards

### File Size Limits
- **Hard limit:** 1,000 lines (CI blocks PRs exceeding this)
- **Soft limit:** 500 lines (aim for this in new modules)
- **Warning:** 800 lines (refactor before hitting limit)

### Testing Requirements
- All new code must have unit tests
- Aim for >90% coverage on new files
- Run `npm run test:js` before pushing

### Extraction Patterns
When extracting from god classes, follow these patterns:

1. **Controller Pattern** (used by CanvasManager, LayerPanel):
   - Create `*Controller.js` file
   - Controller accepts parent reference in constructor
   - Parent delegates specific methods to controller

2. **Handler Pattern** (used by ToolManager):
   - Create `*Handler.js` file
   - Handler is self-contained for specific functionality
   - Parent checks if handler available, delegates or falls back

3. **Renderer Pattern** (used by LayerRenderer):
   - Create `*Renderer.js` file
   - Single responsibility: render one type of thing
   - Pure functions where possible

See existing extractions (TextBoxRenderer, TextToolHandler, PathToolHandler) for examples.

---

## Getting Help

- Check [`improvement_plan.md`](improvement_plan.md) for technical debt roadmap
- Check [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for system architecture
- Check [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for detailed development guidance
- Check [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md) for getting started
