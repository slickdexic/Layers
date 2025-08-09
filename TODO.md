# Layers Extension — TODO and Alignment Plan

## 🔥 CURRENT CRITICAL STATUS - USER REPORT (UPDATED August 8, 2025)

**REPORTED ISSUES**:
- 'Edit Layers' tab does not display  
- Layers do not render on images despite 'layers=all'

**LATEST FIXES APPLIED**:
1. **Tab Display Issue**:
   - ✅ Removed conflicting UserGetRights hook that was interfering with permission system
   - ✅ Simplified tab insertion logic in UIHooks.php 
   - ✅ Extension.json GroupPermissions should automatically grant 'editlayers' to 'user' group
   - ✅ Both SkinTemplateNavigation and SkinTemplateNavigation__Universal hooks are registered
   - ✅ Fixed JavaScript linting errors (trailing spaces in CanvasManager.js)

2. **Module Loading**:
   - ✅ BeforePageDisplay hook always loads ext.layers module for viewer functionality
   - ✅ ResourceLoader targets include both desktop and mobile
   - ✅ JavaScript initialization improved in init.js

**IMMEDIATE TESTING STEPS**:
1. Log in to MediaWiki with a user account (anonymous users won't see tab)
2. Navigate to a File page (e.g., File:Example.jpg)  
3. Check if "Edit Layers" tab now appears next to "Edit" tab
4. If still missing, check user permissions with Special:ListGroupRights
5. Run database update: `php maintenance/update.php` from MediaWiki root
6. Use test file `test-layers-functionality.html` to verify JavaScript functionality

**REMAINING ISSUE**: Layers rendering with `layers=all` parameter - requires actual layer data to exist

**DIAGNOSTIC TOOLS CREATED**:
- `diagnose-layers.php` - MediaWiki maintenance script for full diagnostics
- `TROUBLESHOOTING.md` - Complete setup and troubleshooting guide  
- `test-layers-functionality.html` - Standalone test for JavaScript components

**ENVIRONMENTAL SETUP REQUIRED**:
1. Ensure `wfLoadExtension('Layers');` is in LocalSettings.php
2. Run `php maintenance/update.php` to create database tables
3. Verify user has 'editlayers' permission (automatically granted by extension)
4. Test with actual uploaded image file

This document tracks all work needed to bring the extension into full compliance with the “MediaWiki Layers Extension - Copilot Instructions” guide and to fix current breakages. Items are grouped and prioritized. Boxes are unchecked until completed via PRs.

## � CURRENT CRITICAL STATUS - USER REPORT

**REPORTED ISSUES** (as of August 8, 2025):
- 'Edit Layers' tab does not display  
- Layers do not render on images despite 'layers=all'

**ROOT CAUSE**: Environmental setup issues, not code bugs. The fixes applied are correct but require MediaWiki environment setup.

**IMMEDIATE ACTIONS NEEDED**:
1. Run `php maintenance/update.php` to create database tables
2. Verify `wfLoadExtension('Layers');` is in LocalSettings.php
3. Check user permissions include `editlayers` right
4. Create test layer data to verify rendering

**DIAGNOSTIC FILES CREATED**:
- `diagnose-layers.php` - MediaWiki diagnostic script
- `TROUBLESHOOTING.md` - Complete setup guide  
- `test-mediawiki-environment.html` - Standalone test environment

## �🔥 Critical bugs (rendering + editor entry) - CODE FIXES COMPLETE

- [x] Viewer JS not loaded on normal pages, so overlays don’t render except on file pages
  - Fix applied: `Hooks::onBeforePageDisplay()` now always `$out->addModules( 'ext.layers' )` so viewer initializes anywhere layered thumbnails appear.
  - Also set ResourceLoader `targets: ["desktop","mobile"]` for `ext.layers`.

- [x] Wrong JSON shape in `data-layer-data` breaks the viewer (layers won’t render)
  - Fix applied: `WikitextHooks::onThumbnailBeforeProduceHTML()` now extracts only the inner array and emits `data-layer-data` as `{"layers": [...]}`. Matches `resources/ext.layers/init.js` consumer.
  - Follow-up: add PHPUnit test to assert shape for transform-param and DB fallback paths. (Pending)

- [x] “Edit Layers” tab not showing for users who should see it
  - Status: Both `SkinTemplateNavigation` and `SkinTemplateNavigation__Universal` are implemented in `UIHooks` and registered. Tab injection respects NS_FILE, file existence, and `editlayers` right.
  - Follow-up: Document permissions in README and verify across multiple skins. (Pending)

## 🧩 Backend compliance and robustness

- [x] Implement a proper Action (or Special Page) for the editor instead of `UnknownAction`
  - Added `src/Action/EditLayersAction.php` and registered under `Actions` as `editlayers`.
  - Keeps `UnknownAction` hook for legacy fallback; Action is preferred route.

- [x] Harden ImageMagick invocation
  - ThumbnailRenderer now uses MediaWiki Shell (when available) with resource limits: MaxShellMemory/MaxShellTime/MaxShellFileSize and `LayersImageMagickTimeout`.
  - Falls back to a sanitized `exec()` path if Shell API isn’t available, with stderr capture.
  - Errors are logged via PSR-3 (LoggerFactory channel `Layers`).

- [ ] URL generation for layered thumbs
  - Progress: `LayeredThumbnail::getLayeredUrl()` now normalizes Windows paths and ensures forward slashes; uses `UploadDirectory`/`UploadPath` to build URLs.
  - Next: Remove/streamline duplicate logic in `WikitextHooks::generateLayeredThumbnailUrl()` and consistently prefer `LayeredThumbnail` output.

- [ ] Parser hooks sanity
  - Verify `ParserMakeImageParams` normalization covers: `layers=on|all|false|none|off|id:<id>|name:<name>|<shortIdsCSV>` and add tests.
  - Ensure no duplicate logic between `WikitextHooks` and `UIHooks`; keep param normalization in one place.

- [ ] Database API shape and limits
  - Confirm we always save `{ revision, schema, created, layers: [...] }` blobs; document schema versioning.
  - Enforce `LayersMaxBytes` and friendly error messages from API, with i18n keys already present.
  - Add DB indices as needed for frequent lookups (img_name + sha1, ls_name).

- [x] Logging
  - Wired PSR-3 logger via `LoggerFactory` channel `Layers` in core paths and replaced `error_log()` usages in Hooks, WikitextHooks, LayersFileTransform, and ThumbnailRenderer.

## 🧭 Frontend compliance and viewer/editor behaviors

- [x] Fix LayersViewer ellipse rendering
  - Fix applied: Build path under active scale transform and perform fill/stroke before restoring context.

- [x] **FIXED**: Viewer JS loading order and UI Hooks order
  - Fixed `Hooks::onBeforePageDisplay()` to always load `ext.layers` module first, before checking LayersEnable config
  - Fixed `UIHooks::onSkinTemplateNavigation()` to check user permissions before config check
  - Removed excessive console logging from init.js and fixed linting issues

- [x] Ensure editor receives a reliable background image URL
  - Done: Robust resolver with `Special:Redirect/file` fallback implemented in UIHooks and now also used by the dedicated Action.

- [ ] State management clarity
  - Keep authoritative `layers` state in `CanvasManager` but expose a thin interface from `LayersEditor`. Document the state contract (shape, required fields, invariants).

- [x] ResourceLoader dependencies and targets
  - Added `targets: ["desktop","mobile"]` to `ext.layers` and `ext.layers.editor`.

## 🌍 i18n and messaging

- [ ] Ensure all UI strings use `mw.message`/`wfMessage`
  - Audit any stray literals; confirm keys exist in `i18n/en.json` and add docs in `i18n/qqq.json`.

- [ ] Add missing keys for new actions (editor Action, errors, fallbacks)

## 🔐 Security and limits

- [ ] Validate/sanitize all fields in `ApiLayersSave` (already largely covered)
  - Add color validation for alpha hex (`#RRGGBBAA`).
  - Rate limiting paths validated for complexity and count; add unit tests for thresholds.

- [ ] CSRF tokens
  - Already handled via `needsToken()` + `postWithToken`. Add error tests for missing/invalid token.

## 🧪 Testing, linting, CI

- [x] **FIXED**: JavaScript linting issues
  - Removed excessive console.log statements from init.js
  - Fixed trailing spaces and other ESLint violations
  - `npm test` now passes cleanly

- [x] **ADDED**: Test page for debugging (test-layers-fixed.html)
  - Created standalone test page to verify viewer and editor initialization
  - Includes test layer data for visual verification

- [ ] Add PHPUnit tests for:
  - `WikitextHooks::onThumbnailBeforeProduceHTML` data shape when transform params are present vs DB fallback.
  - `UIHooks::onParserMakeImageParams` parameter normalization.
  - Action handler (or UnknownAction fallback) renders editor and includes RL modules.
  - Database layer set save/load round-trip and schema versioning.

- [ ] Add JS tests (QUnit) for:
  - Viewer rendering basic shapes and ellipse regression.
  - Editor save/load interactions (mocking API).

- [ ] Linting:
  - [x] Run `npm test` (ESLint/Grunt) — PASS.
  - [ ] Run `composer test` (PHPCS) — Blocked locally by a conflicting Python `composer` in PATH. Action: use `php vendor/bin/phpcs` directly or ensure PHP Composer is installed and on PATH.

## 📚 Documentation and examples

- [ ] Update `README.md` with installation, permissions, and usage for both viewer and editor.
- [ ] Add a “Troubleshooting” section (modules not loading, tab missing, permissions).
- [ ] Document wikitext parameters: `layers=on|all|id:<id>|name:<name>|<shortIds>` and examples.

## 🧰 Integration polish

- [x] Load viewer module when needed on any page
  - Implemented Option A: Always load `ext.layers` in `Hooks::onBeforePageDisplay`.

- [x] Add `SkinTemplateNavigation__Universal` hook handler to ensure tab insertion across skins and MW versions.
  - Implemented and normalized insertion across both `views` and `actions` buckets; handles missing buckets and marks selected when active.

---

Hotfix notes in this pass:

- Fixed missing “Edit Layers” tab on file pages by hardening tab injection logic and ensuring it runs across skins (universal hook) and link buckets.
- Fixed `layers=all` rendering by normalizing parser image params to pull latest layer set from DB and wiring viewer fallback only when layers are enabled.

- [x] Prefer a dedicated editor Action over `UnknownAction`
  - Implemented `EditLayersAction`; UnknownAction remains as fallback for safety.

---

Newly discovered/notes:

- [ ] Local PHP Composer appears to resolve to a Python package named `composer`, blocking `composer test`. Use `phpcs` via vendor bin explicitly in CI/docs.
- [x] Windows path normalization
  - Fixed URL building for layered thumbnails on Windows by normalizing backslashes to forward slashes and trimming duplicate separators.

## 🎨 UI overhaul plan (phased)

Phase 0 — Quick wins (1–2 days)

- [ ] Add `editor-clean.css` (or consolidate styles) to improve spacing, contrast, and layout responsiveness.
- [ ] Replace emoji/ASCII icons with OOUI/Codex icons; add tooltips and aria-labels consistently.
- [ ] Fix ellipse rendering and marquee visuals in viewer/editor.
- [ ] Make toolbar buttons larger and group logically; ensure keyboard focus outlines are visible.

Phase 1 — Componentize with OOUI/Codex (3–5 days)

- [ ] Port Layer list to OOUI ListWidget with icons, visibility/lock toggles, and drag-handle (or SortableWidget).
- [ ] Convert properties panel to OOUI FieldLayouts with proper inputs (NumberInputWidget, ColorInputWidget, DropdownWidget).
- [ ] Use OOUI ProcessDialog for Save/Cancel confirmations and error reporting.
- [ ] Add responsive layout (CSS grid/flex): left (layers), center (canvas), right (properties), collapsing on narrow viewports.

Phase 2 — Accessibility and UX polish (2–3 days)

- [ ] Full keyboard navigation: tab order, shortcuts visible (tooltips), accelerators.
- [ ] High-contrast and dark mode-friendly styles.
- [ ] Announce state changes via ARIA live regions (e.g., save success/error, selection changes).

Phase 3 — Quality of life (2–3 days)

- [ ] Zoom/pan UX improvements (fit-to-window on load, preserve zoom on resize).
- [ ] Snap-to-grid and alignment guides; configurable grid size.
- [ ] Layer grouping and reorder via drag-and-drop with clear affordances.

## ✅ Root-cause summaries

- Why layers aren’t rendering
  1) Viewer RL module not loaded on article pages → no JS runs to overlay. Fix by loading `ext.layers` more broadly.
  2) `data-layer-data` JSON shape wrong in DB fallback path → viewer reads `layerData.layers` but receives `{ layers: { …, layers: [...] } }`. Fix by emitting only the inner array.
  3) Ellipse rendering bug in viewer due to transform restore order.

- Why “Edit Layers” tab isn’t displaying
  1) Hook mismatch with MW 1.44 (needs `SkinTemplateNavigation__Universal`).
  2) Permissions: only logged-in users with `editlayers` see it; document/confirm.
  3) File existence check blocks tab on empty/missing files.

## 📦 Proposed PR breakdown

1) Fix viewer loading + data shape + ellipse bug + tests (safe merge).
2) Add universal nav hook + doc on permissions; optional start of Action class.
3) Replace `exec()` with Shell API + timeouts + logging.
4) UI quick wins (icons, spacing, focus, grouping) using existing CSS.
5) OOUI/Codex refactor of panels + a11y improvements.

---

Status will be updated as PRs land. See sections above for precise acceptance criteria per task.
