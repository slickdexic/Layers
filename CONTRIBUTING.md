# Contributing to MediaWiki Layers

Thanks for helping improve Layers! This guide covers local setup, how to run checks, and important code quality rules.

## Codebase Size Policy

**Target: <110,000 lines of JavaScript**

This extension is feature-rich by design—**15 drawing tools**, multiple rendering systems, comprehensive validation, extensive test coverage, a **Shape Library with 5,116 shapes**, and an **Emoji Picker with 2,817 emoji**. The large generated data files (ShapeLibraryData.js, EmojiLibraryIndex.js) and bundled emoji data (emoji-bundle.json) account for ~15,000 lines of JavaScript. A well-structured, secure, thoroughly-tested codebase of this size is appropriate for a professional MediaWiki extension.

**There is no arbitrary 50K or 75K limit.** The focus is on code quality, not line counts:
- ✅ Well-structured with clear separation of concerns
- ✅ Secure with CSRF protection, rate limiting, validation
- ✅ Thoroughly tested (95.19% coverage, 11,254 tests)
- ✅ Properly delegated (god classes use controller patterns)

---

## ⚠️ MANDATORY: God Class Rules

**We have 21 "god classes" (files >1,000 lines) that represent technical debt. 2 are generated data files (exempt), 19 are hand-written (17 JS + 2 PHP). These rules are enforced by CI:**

### Rule 1: No God Class Growth
- **CI will BLOCK your PR** if you increase the size of any hand-written god class
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

**Generated data files (exempt from refactoring):**
- ShapeLibraryData.js (~11,299 lines)
- EmojiLibraryIndex.js (~3,055 lines)

**Hand-written JS files (use delegation patterns):**
| File | Lines | Status |
|------|-------|--------|
| LayerPanel.js | ~2,180 | Delegates to 9 controllers |
| CanvasManager.js | ~2,053 | Facade - delegates to 10+ controllers |
| Toolbar.js | ~1,891 | Needs split |
| LayersEditor.js | ~1,836 | Partial delegation |
| InlineTextEditor.js | ~1,670 | Inline text editing |
| APIManager.js | ~1,566 | Delegates to APIErrorHandler |
| PropertyBuilders.js | ~1,464 | Reusable property builders |
| SelectionManager.js | ~1,415 | Delegates to SelectionState, SelectionHandles |
| CanvasRenderer.js | ~1,365 | Delegates to SelectionRenderer |
| ViewerManager.js | ~1,320 | Viewer instance management |
| ToolManager.js | ~1,214 | Delegates to tool handlers |
| GroupManager.js | ~1,205 | Layer grouping logic |
| SlideController.js | ~1,131 | Slide mode logic |
| TransformController.js | ~1,117 | Resize/rotation logic |
| LayersValidator.js | ~1,116 | Validation logic |

**PHP god classes:**
- ServerSideLayerValidator.php (~1,346 lines)
- LayersDatabase.php (~1,363 lines)

**Near-threshold files (900-999 lines, watch carefully):**
- ToolbarStyleControls.js (~998)
- ResizeCalculator.js (~995)
- ArrowRenderer.js (~974)
- CalloutRenderer.js (~961)

See [`improvement_plan.md`](improvement_plan.md) for refactoring guidance.

---

## Prerequisites

- Node.js 18+ and npm
- PHP 8.1+ with Composer (the PHP dependency manager)
- MediaWiki dev environment (for running server-side tests/integration)

## Install

These are development dependencies for testing and linting. **Not required** to use the extension.

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

### Error Handling Guidelines

**Principle:** Errors should be handled consistently to aid debugging and provide good UX.

#### Pattern 1: Log and Continue (for non-critical operations)
Use when the operation can fail gracefully without blocking the user:
```javascript
try {
    localStorage.setItem( key, value );
} catch ( err ) {
    mw.log.warn( '[Module] localStorage save failed:', err.message );
    // Continue - feature works without persistence
}
```
**Used by:** PresetStorage, ColorPickerDialog, ToolDropdown

#### Pattern 2: Log and Reject (for API operations)
Use for async operations where the caller needs to handle failure:
```javascript
return this.api.postWithToken( 'csrf', params )
    .then( ( data ) => data )
    .catch( ( code, result ) => {
        mw.log.error( '[APIManager] Save failed:', code );
        throw this.errorHandler.handle( code, result );
    } );
```
**Used by:** APIManager, RevisionManager

#### Pattern 3: Validate and Return (for input validation)
Use for validation that returns a result object:
```javascript
validateLayer( layer ) {
    const result = { isValid: true, errors: [] };
    if ( !layer.id ) {
        result.isValid = false;
        result.errors.push( this.getMessage( 'layers-validation-id-required' ) );
    }
    return result;
}
```
**Used by:** LayersValidator, NumericValidator

#### Rules:
1. **Never use console.log/error** in production code — use `mw.log` instead
2. **Never swallow errors silently** — at minimum, log them
3. **Use i18n for user-facing messages** — error codes for logs
4. **Propagate errors** when the caller needs to react to them
5. **Clean up resources** in finally blocks or catch handlers

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
