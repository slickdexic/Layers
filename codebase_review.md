# Codebase Review: MediaWiki Layers Extension

**Date of Review:** 2025-11-07

## 1. Overall Score: C-

| Category | Score (out of 10) | Weight | Weighted Score |
| :--- | :--- | :--- | :--- |
| **Functionality** | 4 | 40% | 1.6 |
| **Code Quality** | 6 | 30% | 1.8 |
| **Security** | 5 | 20% | 1.0 |
| **Maintainability** | 6 | 10% | 0.6 |
| **Total** | | | **5.0/10 (C-)** |

---

## 2. Executive Summary

This review assesses the "Layers" MediaWiki extension, a tool for adding image annotations. The codebase exhibits a mix of modern practices and significant architectural flaws. While the extension is built on a reasonable separation of concerns (PHP backend, JS frontend), it suffers from critical bugs, security vulnerabilities, and inconsistent code quality.

The most severe issue identified was a **broken save functionality**, which rendered the extension unusable. This was caused by a combination of incorrect method signatures and misplaced validation logic. This critical bug has been **fixed** as part of this review.

However, numerous other problems remain, including:
- **Redundant and Insecure Validation:** Validation logic was scattered, duplicated, and in some cases, insecure. This has been partially addressed by centralizing validation.
- **Lack of Proper Error Handling:** Many methods lacked robust error handling, relying on `error_log` instead of proper exceptions or logging channels.
- **Outdated Dependencies and Build-Process Issues:** The build process showed warnings, and some dependencies are outdated. The PHP linting process failed initially due to a misconfiguration.
- **Inconsistent Code Style:** While `phpcbf` was used to fix some issues, many warnings related to line length, comment style, and unused `use` statements remain.

The extension has potential, but it requires significant refactoring to improve security, stability, and maintainability. This document details the findings and the corrective actions taken.

---

## 3. Code Quality Analysis

### 3.1. Architecture & Design (6/10)
- **Positives:** The separation between the PHP backend (API, database) and the JavaScript frontend (editor) is logical and follows modern web development practices. The use of MediaWiki's service container is a good choice.
- **Negatives:** The data validation and sanitization logic was poorly architected, being scattered across API and database layers. The database class contained business logic that did not belong there. There is no clear database migration strategy, relying on manual patches.

### 3.2. Readability & Style (5/10)
- **Positives:** The code is generally structured, with clear file and class names.
- **Negatives:**
    - Widespread linting issues were found, including long lines, improper comment formatting, and unused `use` statements.
    - The initial `npm test` run for PHP failed due to an incorrect command, indicating a lack of maintenance in the build tooling.
    - Inconsistent use of MediaWiki's logger and PHP's native `error_log`.

### 3.3. Error Handling & Logging (4/10)
- **Positives:** Some parts of the code use MediaWiki's logging infrastructure.
- **Negatives:** Error handling is inconsistent. In many places, methods return `false` or `null` without logging, making debugging difficult. The database class often falls back to `error_log`, which is not ideal in a MediaWiki context where dedicated logging channels should be used.

---

## 4. Security Analysis (5/10)

### 4.1. Input Validation & Sanitization
- **Critical Issue (Fixed):** The `ApiLayersSave.php` and `LayersDatabase.php` classes had duplicated, and in some cases, insecure validation logic. For example, `sanitizeTextInput` in `ApiLayersSave` was a custom implementation that was not as robust as MediaWiki's built-in methods. This logic was removed and centralized into the `ServerSideLayerValidator`.
- **Remaining Concerns:** While the primary save endpoint has been improved, a full audit of all input vectors is recommended. The filename validation, for instance, was overly simplistic and has been improved to use MediaWiki's `Title` class for better security and correctness.

### 4.2. Database Security
- **Positives:** The use of prepared statements via MediaWiki's database abstraction layer prevents most common SQL injection attacks.
- **Negatives:** The `getNextRevision` method used a `SELECT ... FOR UPDATE` clause to prevent race conditions, which is good, but the overall transaction management in `saveLayerSet` was complex and prone to errors. This has been simplified.

### 4.3. Cross-Site Scripting (XSS)
- **Concern:** The sanitization of text inputs for layers was a significant concern. The refactoring has improved this by ensuring all data passes through the `ServerSideLayerValidator`, but frontend rendering of this data must still be handled with care to prevent XSS.

---

## 5. Identified Issues and Fixes

### 5.1. CRITICAL: Save Functionality Broken
- **Problem:** The `ApiLayersSave::execute()` method called `LayersDatabase::saveLayerSet()` with an incorrect number of arguments (`$majorMime` and `$minorMime` were passed separately, but the method expected a single `$mime` string). This caused a fatal PHP error, making it impossible to save any annotations.
- **Fix:**
    1.  **`ApiLayersSave.php`:** Refactored the `execute` method to pass the correct parameters to the database class. Removed all local validation and sanitization methods (`isValidFilename`, `isValidColor`, `sanitizeColor`, `sanitizeTextInput`, `sanitizeIdentifier`), as this responsibility is now correctly handled by `ServerSideLayerValidator`.
    2.  **`LayersDatabase.php`:** Refactored the `saveLayerSet` method to accept the correct parameters. Removed a large amount of redundant and misplaced validation logic that was already (or should have been) handled at the API or validator level. Simplified the transaction and retry logic.

### 5.2. Build and Linting Failures
- **Problem:**
    - `composer test` failed because it was trying to execute a Python script instead of the PHP test runner. The correct command is `npm run test:php`.
    - `npm test` (for JS) produced warnings about a missing ESLint config file.
    - `npm run test:php` produced a large number of warnings for code style violations.
- **Fix:**
    - Ran `npm run fix:php` to automatically correct many of the PHP code style issues.
    - The remaining warnings should be addressed manually to improve code quality.

---

## 6. Recommendations

1.  **Complete the Refactoring of Validation:** Ensure that *all* input validation and sanitization is handled by the `Validation` namespace classes and that no validation logic remains in the API or Database layers.
2.  **Improve Error Handling:** Replace all instances of `error_log` with the injected PSR-3 logger (`$this->logger`). Implement more robust error handling and exceptions instead of returning `false` or `null`.
3.  **Address All Linter Warnings:** Manually fix the remaining PHPCS warnings (e.g., line length, comment spacing) and resolve the ESLint configuration issue. A clean build is essential for maintainability.
4.  **Update Dependencies:** Review and update the `npm` and `composer` dependencies to their latest stable versions to incorporate security fixes and performance improvements.
5.  **Implement Database Migrations:** Replace the manual SQL patch system with MediaWiki's standard database migration system (`LoadExtensionSchemaUpdates` hook) to automate schema changes and ensure consistency across environments.
6.  **Write Unit and Integration Tests:** The current test coverage is low. New tests should be written to cover the fixed save functionality and other critical paths to prevent future regressions.
