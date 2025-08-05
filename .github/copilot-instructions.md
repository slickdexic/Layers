# MediaWiki Layers Extension - Copilot Instructions

This document provides essential guidance for AI agents working on the Layers MediaWiki extension. Understanding these concepts is critical for making effective contributions.

## 1. Core Architecture

The extension has a clear separation between the PHP backend (MediaWiki integration) and the JavaScript frontend (the image editor).

- **Backend (PHP in `src/`)**: Manages integration with MediaWiki, handles API requests, and interacts with the database.
  - **Entry Point**: `extension.json` is the manifest file. It defines hooks, resource loading, and configuration.
  - **API**: The frontend communicates with the backend via two main API endpoints in `src/Api/`:
    - `ApiLayersInfo.php`: Fetches layer data for an image.
    - `ApiLayersSave.php`: Saves layer data. It receives a JSON string from the editor.
  - **Database**: `src/Database/LayersDatabase.php` contains all SQL logic for storing and retrieving layer information. The schema is in `sql/layers_tables.sql`.
  - **Hooks**: `src/Hooks/` contains the logic that integrates the extension into the MediaWiki UI and parser. `UIHooks.php` adds the "Edit Layers" tab to file pages.

- **Frontend (JavaScript in `resources/`)**: A single-page application for editing images on an HTML5 canvas.
  - **Main Editor**: `resources/ext.layers.editor/LayersEditor.js` is the primary entry point for the editor. It orchestrates the different UI components.
  - **Canvas Logic**: `resources/ext.layers.editor/CanvasManager.js` handles all rendering, drawing, and user interactions on the `<canvas>` element.
  - **UI Components**: `Toolbar.js` (drawing tools) and `LayerPanel.js` (layer management) are the other key UI pieces.
  - **Data Flow**: The editor loads data via `ApiLayersInfo`, manages the state as a JavaScript object (the `layers` array in `CanvasManager`), and saves it by POSTing the JSON representation of this state to `ApiLayersSave`.

## 2. Development Workflow

Standard PHP and JavaScript development practices are used, but with specific commands for this project.

- **Dependencies**:
  - PHP dependencies are managed with Composer: `composer install`
  - JavaScript dependencies are managed with npm: `npm install`

- **Testing & Linting**:
  - To run JavaScript linting and style checks (using ESLint via Grunt):
    ```bash
    npm test
    ```
  - To run PHP code style checks (using PHPCS):
    ```bash
    composer test
    ```
  - PHPUnit tests are located in `tests/phpunit/`. To run them, you'll need a configured MediaWiki test environment.

- **Database**:
  - To apply the necessary database schema changes after installation or updates, run the standard MediaWiki update script from your MediaWiki root directory:
    ```bash
    php maintenance/update.php
    ```

## 3. Key Conventions

- **State Management**: The frontend holds the entire state of the drawing. The backend is stateless, simply saving or loading the complete JSON blob provided by the client. When making changes to the editor, the primary location to modify is the state object within `CanvasManager.js` and then ensure it's rendered correctly.
- **Security**: All data saved via `ApiLayersSave` is sanitized on the backend. CSRF tokens are handled automatically by the MediaWiki API wrapper.
- **Configuration**: Key features are controlled via global settings in `LocalSettings.php` (e.g., `$wgLayersEnable`). When adding new configuration, follow this pattern.
- **Internationalization (i18n)**: All user-facing strings in both PHP and JavaScript must use the `wfMessage()` (PHP) or `mw.message()` (JS) system. String keys are defined in `i18n/en.json`.
