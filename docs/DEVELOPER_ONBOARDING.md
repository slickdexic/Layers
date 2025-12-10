# Layers Extension Developer Onboarding & Architecture Overview

**Last Updated:** December 2025

## Introduction
This document provides an overview of the Layers extension architecture and onboarding steps for new developers.

## Architecture
- **Backend (PHP):** Handles MediaWiki integration, API endpoints, and database logic. Entry point: `extension.json`.
- **Frontend (JS):** Canvas-based editor for image annotations. Entry: `resources/ext.layers.editor/LayersEditor.js`.
- **Database:** SQL schema in `sql/`, logic in `src/Database/LayersDatabase.php`.

### Key Modules

| Module | Purpose | Lines |
|--------|---------|-------|
| `LayersEditor.js` | Main orchestrator | ~1,200 |
| `CanvasManager.js` | Canvas facade (delegates to controllers) | ~1,900 |
| `LayerRenderer.js` | Shared rendering engine | ~1,200 |
| `EditorBootstrap.js` | Initialization, hooks, cleanup | ~400 |
| `RevisionManager.js` | Revision and named set management | ~470 |
| `DialogManager.js` | Modal dialogs with ARIA | ~420 |
| `AccessibilityAnnouncer.js` | Screen reader support | ~200 |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full module dependency graph.

## Getting Started
1. Clone the repo and install dependencies:
   - `composer install`
   - `npm install`
2. Set up MediaWiki and enable the extension in `LocalSettings.php`.
3. Run DB migrations: `php maintenance/update.php` from MediaWiki root.
4. For JS dev: `npm test` for linting, `npm run test:js` for Jest unit tests.
5. For PHP dev: `composer test` for code style.


### Dockerized MediaWiki Environment

- MediaWiki, MySQL, and supporting services run inside Docker. The `extensions`, `LocalSettings.php`, `images`, and `mysql` directories are bind-mounted onto the host (for example `F:/Docker/mediawiki/extensions/Layers`).
- Always run MediaWiki-facing commands (maintenance scripts, PHPUnit, manual testing) inside the container so required PHP extensions and services are available. Example:
   - `docker compose exec mediawiki bash -lc "cd /var/www/html/extensions/Layers && php vendor/bin/phpunit"`
   - `docker compose exec mediawiki php maintenance/update.php`
- The host filesystem copy remains convenient for editing, but the running MediaWiki instance and database only see changes through the container mount, so keep Docker up while developing and testing.


## Key Conventions

- **i18n:** All user-facing strings must use `mw.message()` or `window.layersMessages.get()`.
- **State:** Managed in the frontend StateManager and saved as JSON via the API.
- **Accessibility:** Use ARIA attributes, support keyboard navigation, announce changes via `window.layersAnnouncer`.
- **ES6:** New code should use ES6 classes (see existing utilities as examples).
- **Testing:** Add Jest tests for new modules (target 90%+ coverage).

## Accessibility

The editor supports keyboard navigation and screen readers:

- **Keyboard shortcuts:** Press `Shift+?` to see all shortcuts
- **Layer panel:** Arrow keys, Home/End, Enter to select, V/L for visibility/lock
- **ARIA live regions:** Tool changes, selections, saves, and errors are announced

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for full accessibility documentation.


## Useful Links

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture details
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - Accessibility guide
- [NAMED_LAYER_SETS.md](./NAMED_LAYER_SETS.md) - Named sets feature
- [MediaWiki Extension Manual](https://www.mediawiki.org/wiki/Manual:Developing_extensions)
- [copilot-instructions.md](../.github/copilot-instructions.md) - Contributor guide

---

For questions, contact the project maintainer.
