# MediaWiki Layers Extension: Developer TODO List

This document outlines a detailed roadmap for improving and modernizing the Layers extension. Tasks are categorized by priority and area of focus.

## 📄 Table of Contents

1. [High Priority: Stability & Security](#-high-priority-stability--security)
2. [Medium Priority: Refactoring & Modernization](#-medium-priority-refactoring--modernization)
3. [Medium Priority: Feature Enhancements](#-medium-priority-feature-enhancements)
4. [Low Priority: UI/UX & Quality of Life](#-low-priority-uiux--quality-of-life)

---

## 🚀 High Priority: Stability & Security

*These tasks are critical for ensuring the extension is robust, secure, and maintainable.*

### ✅ Testing Framework

- **[ ] Setup JavaScript Unit Testing:**
  - Integrate a testing framework like Jest or Vitest.
  - Write initial unit tests for critical functions in `CanvasManager.js` (e.g., `isPointInLayer`, `getLayerBounds`).
  - Write tests for the main `LayersEditor` logic (save, load, cancel).
- **[ ] Expand PHPUnit Test Coverage:**
  - Write unit tests for `ApiLayersSave` to cover all validation and sanitization branches.
  - Write unit tests for `ApiLayersInfo` to ensure correct data retrieval.
  - Write integration tests for the database logic in `LayersDatabase.php`.
- **[ ] Implement End-to-End (E2E) Testing:**
  - Set up a framework like Cypress or Playwright.
  - Create a test spec that opens the editor, draws a shape, saves it, and verifies the result.
- **[ ] Setup CI/CD:**
  - Create a GitHub Actions (or similar) workflow.
  - Configure it to automatically run all linters (`composer test`, `npm test`) and unit tests (PHPUnit, Jest) on every push and pull request.

### 🔐 Security Hardening

- **[ ] Review and Enhance Sanitization:**
  - In `ApiLayersSave.php`, double-check the `sanitizeLayersData` function against modern XSS vectors.
  - Ensure all possible attributes within the JSON blob are accounted for and sanitized.
- **[ ] Add Stricter Validation:**
  - In `validateLayersData`, enforce stricter limits on numeric values (coordinates, sizes) to prevent rendering issues or abuse.
  - Validate color value formats more rigorously.

---

## 🛠️ Medium Priority: Refactoring & Modernization

*These tasks address the technical debt in the codebase, making future development faster and safer.*

### 💻 Frontend Refactoring

- **[ ] Decompose `CanvasManager.js`:**
  - Break the monolithic `CanvasManager.js` into smaller, focused modules.
    - `renderer.js`: For all `ctx` drawing functions.
    - `interaction.js`: For mouse/keyboard event handling (panning, zooming, clicking).
    - `state.js`: For managing the editor's state (selection, history, clipboard).
    - `geometry.js`: For hit-testing and geometric calculations.
- **[ ] Introduce a State Management Pattern:**
  - Refactor the frontend to use a more predictable state management pattern instead of direct object manipulation.
  - The state should be a single source of truth, and the canvas should re-render based on state changes. This could be a simple custom implementation or a lightweight library.
- **[ ] Modernize JavaScript:**
  - Convert the entire JS codebase from ES5/jQuery style to modern ES6+ (classes, modules, `const`/`let`, arrow functions).
  - Remove the dependency on jQuery, using native DOM APIs instead.
- **[ ] Adopt a Build System:**
  - Introduce a modern build tool like Vite or Webpack to handle JS bundling, transpilation, and dependency management, replacing the reliance on MediaWiki's ResourceLoader for development.

### 🐘 Backend Refactoring

- **[ ] Implement Dependency Injection:**
  - Refactor classes like `ApiLayersSave` and `LayersDatabase` to receive dependencies (like the database object or config) via their constructors instead of fetching them from global services. This improves testability.

---

## ✨ Medium Priority: Feature Enhancements

*These tasks add new, highly-requested functionality to the editor.*

### 🎨 Drawing & Layer Tools

- **[ ] Layer Opacity & Blend Modes:**
  - Add an `opacity` property to each layer object.
  - Update the rendering logic in `CanvasManager` to respect `ctx.globalAlpha`.
  - Add a slider in the `LayerPanel` to control the opacity of the selected layer.
- **[ ] Layer Grouping:**
  - Allow users to group multiple layers together in the `LayerPanel`.
  - Groups should be selectable, movable, and deletable as a single unit.
- **[ ] Advanced Text Tool:**
  - Allow editing text directly on the canvas.
  - Add controls for text alignment, bold, italics, and underline.
- **[ ] New Shape Tools:**
  - Add a freeform "Pencil" tool.
  - Add a "Polygon" tool that allows creating multi-point shapes.
- **[ ] Server-Side Thumbnail Rendering:**
  - Implement the logic in `LayersFileTransform.php` to render the JSON data onto the image thumbnail on the server.
  - This is critical for performance and for ensuring layers are visible to users without JavaScript enabled. It would likely involve using a library like ImageMagick.

### 🗂️ Asset & Data Management

- **[ ] Complete the Asset Library:**
  - Build the UI for the `layer_assets` table.
  - Allow users to save a shape or a group of shapes as a reusable asset.
  - Create a panel where users can browse and drag-and-drop assets onto their canvas.
- **[ ] Implement Import/Export:**
  - Add buttons to export the current layer set as a JSON file.
  - Allow users to import a previously exported JSON file to apply to an image.

---

## 🎨 Low Priority: UI/UX & Quality of Life

*These tasks focus on improving the user experience and polishing the interface.*

### 🖌️ UI Improvements

- **[ ] Modernize Editor UI:**
  - Update the CSS for the toolbar, layer panel, and modals to have a more modern look and feel, consistent with current web design trends.
  - Use SVGs for icons to ensure they are sharp on all displays.
- **[ ] Improve the Layer Panel:**
  - Show a small thumbnail preview of each layer's content.
  - Improve the drag-and-drop reordering experience.
- **[ ] Better User Feedback:**
  - Provide clearer visual cues during operations like saving, loading, and error states.
  - Add a status bar to display information like zoom level, mouse coordinates, and selection size.

### 📚 Documentation

- **[ ] Improve Inline Code Comments:**
  - Add detailed JSDoc/PHPDoc blocks to all public methods, especially in the more complex parts of the application.
- **[ ] Create Developer Setup Guide:**
  - Write a `DEVELOPER_GUIDE.md` that explains how to set up a local development environment, run tests, and contribute to the extension.
- **[ ] Write User Documentation:**
  - Create a page on mediawiki.org (or within the wiki) explaining how to use the editor's features.
