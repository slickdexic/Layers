# Contributing Guide

> **Current guidance — September 6, 2026:** Develop against main (manifest minimum MediaWiki 1.44) and a supported core runtime. REL1_43 backports require separate verification; REL1_39 is unmaintained. See [[Testing Guide]] for current commands and [[Current Status]] for dated metrics.

Thank you for your interest in contributing to Layers! This guide explains how to get started.

---

## Ways to Contribute

| Type | Description |
|------|-------------|
| 🐛 **Bug Reports** | Report issues you encounter |
| 💡 **Feature Requests** | Suggest new capabilities |
| 📖 **Documentation** | Improve docs and wiki |
| 🧪 **Testing** | Test new features, report findings |
| 💻 **Code** | Fix bugs, implement features |
| 🌍 **Translation** | Translate to other languages |

---

## Setting Up for Development

### Prerequisites

- **PHP 8.1+** with Composer
- **Node.js 18+** with npm
- **MediaWiki 1.44+** installation for main
- **Git**

### Clone and Install

```bash
cd /path/to/mediawiki/extensions
git clone https://github.com/slickdexic/Layers.git
cd Layers

# Install development dependencies
# (These are only needed for testing/development, not for using the extension)
composer install
npm install

# Run tests to verify setup
npm test
npm run test:js
```

### Running the Development Wiki

If you have a local MediaWiki installation:

1. Add to `LocalSettings.php`:
   ```php
   wfLoadExtension( 'Layers' );
   $wgLayersDebug = true;
   ```

2. Run database updates:
   ```bash
   php maintenance/run.php update.php
   ```

3. Access your wiki and test on File: pages

---

## Development Workflow

### Branching Strategy

- `main` — Latest stable code (MediaWiki 1.44+)
- `REL1_43` — LTS for MediaWiki 1.43.x (full feature parity with main)
- `REL1_39` — Unmaintained legacy branch for MediaWiki 1.39-1.42
- Feature branches — Create from `main`

### Creating a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### Making Changes

1. Write your code
2. Add/update tests
3. Run linting and tests:
   ```bash
   npm test          # Lint JS/CSS/i18n
   npm run test:js   # Jest tests
   npm run test:php  # PHP tests
   ```
4. Commit with descriptive message

### Commit Message Format

```
type: Brief description

Longer description if needed.

- Bullet points for details
- Reference issues: Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat: Add polygon corner radius support

fix: Correct text alignment in rotated text boxes

docs: Update installation instructions for MW 1.44

refactor: Extract PresetStyleManager from ToolbarStyleControls
```

---

## Code Standards

### JavaScript

- **ES6+** — Use classes, const/let, arrow functions
- **ESLint** — All code must pass linting
- **No var** — Use const (preferred) or let
- **Meaningful names** — Descriptive variable/function names

```javascript
// Good
const selectedLayers = this.getSelectedLayers();
const hasSelection = selectedLayers.length > 0;

// Bad
var x = this.getSelectedLayers();
var b = x.length > 0;
```

### PHP

- **MediaWiki coding standards** — Enforced via phpcs
- **Type hints** — Use parameter and return types
- **Documentation** — PHPDoc for public methods

```php
/**
 * Get layer data for a file.
 *
 * @param string $filename The file title
 * @param string $setname The layer set name
 * @return array|null Layer data or null if not found
 */
public function getLayerData( string $filename, string $setname ): ?array {
    // ...
}
```

### CSS

- **Stylelint** — All CSS must pass linting
- **BEM-ish naming** — `.layers-editor-toolbar-button`
- **No inline styles** — Use classes

---

## Testing

### Running Tests

```bash
# All linting (JS, CSS, i18n)
npm test

# JavaScript unit tests
npm run test:js

# JavaScript tests with coverage
npm run test:js -- --coverage

# PHP tests
npm run test:php

# Specific test file
npm run test:js -- HistoryManager
```

### Writing Tests

Tests go in `tests/jest/` for JavaScript:

```javascript
describe( 'MyComponent', () => {
    let component;
    
    beforeEach( () => {
        component = new MyComponent();
    } );
    
    afterEach( () => {
        component.destroy();
    } );
    
    it( 'should do something specific', () => {
        const result = component.doSomething();
        expect( result ).toBe( expectedValue );
    } );
} );
```

### Test Coverage Goals

- Aim for 80%+ coverage on new code
- All bug fixes should include regression tests
- Critical paths should have integration tests

---

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test && npm run test:js`)
2. ✅ Code follows style guidelines
3. ✅ New features have tests
4. ✅ Documentation updated if needed
5. ✅ Commit messages are descriptive

### Creating a Pull Request

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to [GitHub](https://github.com/slickdexic/Layers/pulls)

3. Click "New Pull Request"

4. Fill out the template:
   - Clear title
   - Description of changes
   - Related issues
   - Testing done
   - Screenshots (if UI changes)

### Review Process

1. Maintainer reviews code
2. CI checks must pass
3. Address any feedback
4. Maintainer merges when approved

---

## Project Structure

```
Layers/
├── src/                    # PHP backend
│   ├── Api/               # API modules
│   ├── Database/          # Database access
│   ├── Hooks/             # MediaWiki hooks
│   ├── Logging/           # Logging utilities
│   ├── Security/          # Security (rate limiting)
│   └── Validation/        # Input validation
├── resources/              # JavaScript frontend
│   ├── ext.layers/        # Viewer entry point
│   ├── ext.layers.editor/ # Editor modules
│   └── ext.layers.shared/ # Shared renderers
├── tests/                  # Test files
│   ├── jest/              # JavaScript tests
│   ├── phpunit/           # PHP tests
│   └── e2e/               # End-to-end tests
├── i18n/                   # Internationalization
├── sql/                    # Database schema
├── docs/                   # Documentation
└── wiki/                   # GitHub wiki source
```

---

## Architecture Guidelines

### God Class Prevention

Files should stay under 1,000 lines. If approaching:
1. Identify cohesive functionality
2. Extract to new class
3. Use delegation pattern
4. Add tests for new class

### Controller Pattern

For large managers, use controller delegation:

```javascript
class BigManager {
    constructor() {
        this.subController = new SubController( this );
    }
    
    doThing() {
        return this.subController.doThing();
    }
}
```

### Adding New Layer Properties

1. Add to server whitelist (`ALLOWED_PROPERTIES`)
2. Add to `LayerDataNormalizer` if boolean
3. Add to style presets if applicable
4. Update type definitions (`types/layers.d.ts`)
5. Add tests

---

## Documentation

### Code Documentation

- JSDoc for JavaScript functions
- PHPDoc for PHP methods
- Inline comments for complex logic

### Wiki Documentation

Wiki source is in `wiki/` directory. To update:
1. Edit the markdown file
2. Push to wiki repository (separate from main repo)

### README Updates

Keep `README.md` updated with:
- New features
- Changed requirements
- Important notes

---

## Getting Help

### Questions

- Open a [Discussion](https://github.com/slickdexic/Layers/discussions)
- Ask in your PR if unclear

### Stuck on Something

It's okay to submit a WIP (Work in Progress) PR:
- Prefix title with `[WIP]`
- Describe what you're trying to do
- Ask for guidance

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/). Be respectful, inclusive, and constructive.

---

## Thank You!

Every contribution helps make Layers better. Whether it's a typo fix, a bug report, or a major feature — we appreciate your help! 🎉

---

## See Also

- [[Architecture Overview]] — System design
- [[Testing Guide]] — Detailed testing information
- [[API Reference]] — Backend API documentation
