# MediaWiki Layers Extension: State & Analysis

**Document Purpose:** This document provides a comprehensive analysis of the "Layers" MediaWiki extension in its current state. It covers architecture, functionality, code quality, and identifies key strengths and weaknesses.

## 1. Core Functionality

The Layers extension allows users to add vector-based annotation layers on top of images within a MediaWiki installation. It provides:

- An "Edit Layers" action on file pages, which launches a dedicated editor.
- A browser-based editor with an HTML5 canvas for drawing shapes (rectangles, circles, arrows, text) on an image.
- A layer panel to manage the order and visibility of individual shapes.
- A toolbar for selecting drawing tools.
- The ability to save the layer data associated with a specific version of an image file.
- A mechanism to render the layers on top of the image when viewing wiki pages (currently client-side).

## 2. Architecture

The extension follows a clear client-server architecture, separating the backend PHP logic from the frontend JavaScript editor.

### 2.1. Backend (PHP)

The backend is responsible for integrating with MediaWiki, handling API requests, and managing data persistence.

- **Manifest & Configuration (`extension.json`):** This is the entry point. It defines all hooks, API modules, ResourceLoader modules, user permissions (`editlayers`, `createlayers`), and configuration settings (`$wgLayersEnable`, `$wgLayersMaxBytes`, etc.).
- **API Endpoints (`src/Api/`):**
  - `ApiLayersInfo.php`: Fetches layer data for a given image. It can retrieve the latest version or a specific version by ID.
  - `ApiLayersSave.php`: Saves a complete set of layers for an image. It receives a JSON string from the editor. This is the most critical backend component.
- **Database (`src/Database/LayersDatabase.php`, `sql/layers_tables.sql`):**
  - A dedicated class, `LayersDatabase`, abstracts all SQL queries, which is excellent practice.
  - The schema defines three tables:
    - `layer_sets`: The primary table, storing each drawing as a JSON blob (`ls_json_blob`). It maintains a simple revision history for each image's annotations.
    - `layer_assets`: Appears to be for a planned or partially implemented "asset library" feature, which is not fully integrated yet.
    - `layer_set_usage`: Intended to track where a layer set is used, but also seems underutilized in the current codebase.
  - The core storage strategy is to save the entire drawing as a single JSON object, making the backend largely stateless.
- **MediaWiki Integration (`src/Hooks/`):**
  - `UIHooks.php`: Adds the "Edit Layers" tab to file pages and handles the `action=editlayers` custom action to launch the editor.
  - Other hooks manage schema updates, permissions, and parser interactions.

### 2.2. Frontend (JavaScript)

The frontend is a single-page application built with JavaScript (primarily ES5-style jQuery) and an HTML5 canvas.

- **Editor Orchestrator (`LayersEditor.js`):** The main controller for the editor. It initializes the UI, loads initial data from the API, and handles top-level actions like "Save" and "Cancel".
- **Canvas Engine (`CanvasManager.js`):** This is the heart of the frontend. It is a very large and complex file responsible for:
  - All canvas rendering and drawing logic.
  - User interaction: mouse events, zooming, panning.
  - Tool implementation (pointer, rectangle, text, etc.).
  - State management, including selection, undo/redo history, and clipboard operations.
  - Loading the background image.
- **UI Components (`Toolbar.js`, `LayerPanel.js`):** These files manage their respective parts of the UI, handling user input and communicating back to the main `LayersEditor`.
- **Data Flow:** The editor loads the layer set via `ApiLayersInfo`, holds the entire state of the drawing in a JavaScript array (`this.layers`), and saves it by POSTing the stringified version of this array to `ApiLayersSave`.

## 3. Code Quality & Maintainability

- **Dependencies:** The extension correctly uses Composer for PHP dependencies and npm for JavaScript development dependencies (linters).
- **Testing:**
  - A testing structure is in place (`/tests`), but it is minimal. There are very few PHPUnit tests.
  - JavaScript testing is absent.
  - Linting is set up via Grunt (`npm test`) and Composer (`composer test`), which is good for maintaining code style.
- **Security:**
  - The `ApiLayersSave.php` module shows a good understanding of security requirements. It includes checks for CSRF tokens, user permissions, and rate limiting.
  - It performs data validation and sanitization on the incoming JSON, which is crucial for preventing XSS and other injection attacks when the data is rendered.
- **Code Style:**
  - The PHP code generally follows MediaWiki conventions.
  - The JavaScript code is written in an older, pre-ES6 style, relying heavily on jQuery and manual DOM manipulation. Files like `CanvasManager.js` are monolithic and would be difficult for a new developer to maintain.
- **Documentation:** Inline documentation is sparse, especially in the complex `CanvasManager.js` file. The `copilot-instructions.md` file provides a good high-level overview.

## 4. Analysis Summary

### Strengths

- **Solid Foundation:** The core architecture is sound and aligns with MediaWiki extension development best practices.
- **Clear Separation of Concerns:** The backend (data persistence) and frontend (editing logic) are well-separated.
- **Security-Aware Backend:** The save API incorporates essential security measures.
- **Stateless Backend:** Storing the drawing as a single JSON blob simplifies the backend logic significantly.
- **Feature-Rich Canvas:** The canvas implementation supports many necessary features like zooming, panning, selection, and a variety of tools.

### Weaknesses

- **Technical Debt in Frontend:** The JavaScript codebase is dated. The reliance on jQuery, manual DOM manipulation, and the monolithic nature of `CanvasManager.js` make the frontend brittle and hard to extend.
- **Lack of Automated Testing:** The absence of a comprehensive test suite (both JS and PHP) means that any change carries a high risk of regression.
- **Limited Feature Set:** The drawing tools are basic. Key features like layer grouping, opacity, server-side rendering, and a proper asset library are missing.
- **Poor User Experience (UX):** The editor's UI is functional but not modern. It lacks polish and advanced features that users of modern image editors would expect.
- **Scalability Concerns:** All rendering is done client-side. For images with very complex or numerous layers, this could lead to performance issues in the user's browser.

## 5. Conclusion

The Layers extension is a promising and functional tool with a solid architectural base. Its primary weakness is the aging and monolithic nature of its frontend JavaScript code, which has accrued significant technical debt. This, combined with a lack of automated tests, makes further development challenging and risky.

The immediate priority for any future work should be to modernize the frontend and introduce a robust testing framework. Once that is achieved, the extension will be in an excellent position to be improved with new features and a better user experience.
