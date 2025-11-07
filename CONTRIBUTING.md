# Contributing to MediaWiki Layers

Thanks for helping improve Layers! This guide covers local setup, how to run checks, and a common Windows Composer conflict.

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
