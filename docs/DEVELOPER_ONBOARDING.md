# Layers Extension Developer Onboarding & Architecture Overview

## Introduction
This document provides an overview of the Layers extension architecture and onboarding steps for new developers.

## Architecture
- **Backend (PHP):** Handles MediaWiki integration, API endpoints, and database logic. Entry point: `extension.json`.
- **Frontend (JS):** Single-page app for editing images. Entry: `resources/ext.layers.editor/LayersEditor.js`.
- **Database:** SQL schema in `sql/`, logic in `src/Database/LayersDatabase.php`.

## Getting Started
1. Clone the repo and install dependencies:
   - `composer install`
   - `npm install`
2. Set up MediaWiki and enable the extension in `LocalSettings.php`.
3. Run DB migrations: `php maintenance/update.php` from MediaWiki root.
4. For JS dev: `npm test` for linting, use Grunt for builds.
5. For PHP dev: `composer test` for code style.


### Dockerized MediaWiki Environment

- MediaWiki, MySQL, and supporting services run inside Docker. The `extensions`, `LocalSettings.php`, `images`, and `mysql` directories are bind-mounted onto the host (for example `F:/Docker/mediawiki/extensions/Layers`).
- Always run MediaWiki-facing commands (maintenance scripts, PHPUnit, manual testing) inside the container so required PHP extensions and services are available. Example:
   - `docker compose exec mediawiki bash -lc "cd /var/www/html/extensions/Layers && php vendor/bin/phpunit"`
   - `docker compose exec mediawiki php maintenance/update.php`
- The host filesystem copy remains convenient for editing, but the running MediaWiki instance and database only see changes through the container mount, so keep Docker up while developing and testing.


## Key Conventions

- All user-facing strings must be internationalized.
- State is managed in the frontend and saved as a JSON blob.
- See `copilot-instructions.md` for more details.


## Useful Links

- [MediaWiki Extension Manual](https://www.mediawiki.org/wiki/Manual:Developing_extensions)
- [Layers Extension Guide](../guide.md)

---

For questions, contact the project maintainer.
