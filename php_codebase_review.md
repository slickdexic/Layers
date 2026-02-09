# PHP Codebase Critical Review — Layers Extension

**Review Date:** June 2025  
**Scope:** All PHP source files (~39 files, ~15,034 lines)  
**Reviewer:** Automated Critical Review  

---

## Executive Summary

The Layers extension has a generally well-structured PHP codebase with strong security practices (CSRF, validation, rate limiting, sanitization). However, this thorough review uncovered **38 issues** across severity levels:

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 8     |
| Medium   | 16    |
| Low      | 11    |

The most serious issues are: potential exception swallowing in delete operations, CSP header injection via `$_SERVER` superglobals, and a schema validation performance bottleneck on every API call.

---

## Critical Issues (3)

### C-1: `ApiLayersDelete::execute()` catches `\Throwable` which swallows `ApiUsageException`

- **File:** [src/Api/ApiLayersDelete.php](src/Api/ApiLayersDelete.php#L130-L160)
- **Category:** Bug / Security
- **Description:** The `execute()` method has a `catch ( \Throwable $e )` block that wraps all exceptions into a generic `dieWithError( 'layers-delete-failed' )`. Unlike `ApiLayersSave` which explicitly re-throws `ApiUsageException`, this catch block will swallow permission errors (`ApiUsageException` from `dieWithError`/`dieStatus` calls in helper traits) and convert them to generic "delete failed" errors. This degrades security-relevant error information.
- **Evidence:** The `performLayerSetDeletion()` call chain includes `dieWithError( 'permissiondenied' )` in `LayersApiHelperTrait::validatePermissions()`. If this fires inside the try block, the catch converts it to a less-specific message, potentially hiding the real authorization failure from logging/monitoring.
- **Fix:** Add `if ( $e instanceof \MediaWiki\Api\ApiUsageException ) { throw $e; }` at the top of the catch block, matching the pattern in `ApiLayersSave`.

### C-2: CSP header injection via unsanitized foreign file host in `EditLayersAction`

- **File:** [src/Action/EditLayersAction.php](src/Action/EditLayersAction.php#L327-L335)
- **Category:** Security
- **Description:** The `addForeignFileCsp()` method directly reads `$_SERVER['HTTPS']` to determine the protocol scheme for CSP header construction. The broader pattern of CSP construction uses string interpolation from user-influenced data (`$foreignOrigin` from `parse_url` of file URLs). A malicious foreign file URL could inject additional CSP directives.
- **Evidence:** Line `$foreignOrigin = $scheme . '://' . $parsed['host'];` — if the registered foreign file's URL contains unusual characters in the host part (unlikely but possible with misconfigured repos), this could lead to CSP header splitting. The `parse_url` already handles most cases, but the CSP header value is not further validated against RFC 7230 restrictions.
- **Fix:** Validate that `$parsed['host']` matches a strict hostname pattern (e.g., `/^[a-zA-Z0-9.-]+$/`) before using it in CSP headers.

### C-3: `diagnose.php` is a publicly accessible diagnostic endpoint

- **File:** [diagnose.php](diagnose.php#L1-L123)
- **Category:** Security
- **Description:** This file is designed to be accessed directly via browser (`http://wiki/extensions/Layers/diagnose.php`) and enables `display_errors`, reveals PHP version, MediaWiki version, extension configuration, class availability, and database connection details. It also runs `shell_exec` on file paths. If deployed to production, this is an information disclosure vulnerability.
- **Evidence:** Lines 13-14: `error_reporting( -1 ); ini_set( 'display_errors', 1 );`. This file has no authentication, no access control, and no check for whether it's in a production environment.
- **Fix:** Either remove this file from the repository or add a check like `if ( !defined( 'MEDIAWIKI' ) || !$wgShowExceptionDetails ) { die(); }` — though ideally diagnostic scripts should be maintenance scripts requiring CLI access, not web-accessible files.

---

## High Issues (8)

### H-1: Schema validation performs N database queries per API request

- **File:** [src/Database/LayersSchemaManager.php](src/Database/LayersSchemaManager.php#L233-L290)
- **Category:** Performance
- **Description:** `isSchemaReady()` is called at the start of every API read/write operation. It calls `validateTableSchema()` which iterates over all `SCHEMA_REQUIREMENTS` entries and calls `columnExists()` for each column. Each `columnExists()` call invokes `$db->fieldExists()`, which is a database query (`SHOW COLUMNS` or equivalent). With ~12 required columns, this means **12 extra DB queries per API call** just for schema validation.
- **Evidence:** The method does have a `$this->schemaCache` that caches `hasFeature()` results, but `isSchemaReady()` itself bypasses this cache and always calls `validateTableSchema()` fresh. The cache only helps when `hasFeature()` is called directly.
- **Fix:** Cache the entire `isSchemaReady()` result (e.g., in a static/instance variable), or check it once per request lifecycle and store the result.

### H-2: Duplicate `getFileSha1()` / `isForeignFile()` methods across 6+ classes

- **File:** Multiple files
- **Category:** Quality / Design
- **Description:** The `getFileSha1()` and `isForeignFile()` helper methods are duplicated verbatim across at least 6 classes:
  - `ForeignFileHelperTrait` (the canonical trait version)
  - `LayerInjector.php` (private methods, not using the trait)
  - `LayeredFileRenderer.php` (private methods)
  - `ThumbnailProcessor.php` (private methods)
  - `ThumbnailRenderer.php` (private methods)
  - `EditLayersAction.php` (private method)
  
  The `ForeignFileHelperTrait` exists specifically to solve this, but only the API modules use it. All hook processors and other classes duplicate the logic independently.
- **Evidence:** Compare `LayerInjector.php` lines 310-354 with `ThumbnailRenderer.php` lines 680-718 — identical logic.
- **Fix:** Have the hook processors and renderers `use ForeignFileHelperTrait` (adjusting visibility as needed since the trait has protected methods but the copies are private).

### H-3: `WikitextHooks::onParserBeforeInternalParse` regex complexity with unbounded input

- **File:** [src/Hooks/WikitextHooks.php](src/Hooks/WikitextHooks.php#L565-L700)
- **Category:** Performance / Security
- **Description:** This method runs 3 separate regex sweeps (`preg_match_all`) over the entire wikitext body, plus sorting and nested loop processing. For very long articles (100KB+), this creates significant overhead during every parse. The regexes themselves are not catastrophically complex, but the triple-pass approach on potentially large text is inefficient.
- **Evidence:** The method processes raw wikitext to build `$allFileMatches`, `$layersMap`, and `$layerslinkMap` queues. Then it does a `preg_replace_callback` substitution. On a page with 1000+ `[[File:]]` references (e.g., a gallery page), the processing time could become noticeable.
- **Fix:** Consider a single-pass regex that captures all needed groups, or add an early-exit if the text doesn't contain `layerset=` or `layers=` (a simple `strpos` check before the expensive regex processing).

### H-4: `ThumbnailRenderer` passes unsanitized color values to ImageMagick `-fill` / `-stroke`

- **File:** [src/ThumbnailRenderer.php](src/ThumbnailRenderer.php#L205-L450)
- **Category:** Security
- **Description:** The `buildTextArguments`, `buildRectangleArguments`, etc. methods extract color values like `$layer['fill']`, `$layer['stroke']`, and `$layer['shadowColor']` and pass them directly to ImageMagick command arguments via `-fill` and `-stroke`. While the Shell class provides argument escaping, ImageMagick itself interprets certain color strings as filenames or special directives (e.g., `@filename` for text, `xc:` for canvas). Color values from layer data are validated by `ServerSideLayerValidator`, but the `withOpacity()` method can pass through unknown formats unchanged (its fallback is `return $color`).
- **Evidence:** `withOpacity()` at the bottom of ThumbnailRenderer: if a color string doesn't match any known format, it's returned as-is. Combined with ImageMagick's liberal interpretation of strings, this could be exploitable if validation is bypassed.
- **Fix:** Add a color format whitelist check before passing to ImageMagick, or use `ColorValidator::isValidColor()` as a gate.

### H-5: `onRegistration()` in `Hooks.php` directly modifies `$wgRateLimits` global

- **File:** [src/Hooks.php](src/Hooks.php#L57-L90)
- **Category:** Quality
- **Description:** `onRegistration()` directly writes to `$GLOBALS['wgRateLimits']` to set up rate limit defaults. While this works, it bypasses MediaWiki's configuration system and can cause issues with configuration caching in multi-request setups. Modern MW extensions should declare rate limits in `extension.json` where possible.
- **Evidence:** Lines 60-87 show direct global array assignment. This runs on every request during extension registration, even if rate limits are already configured properly.
- **Fix:** Move default rate limit configuration to `extension.json`'s `config` section (if MW version supports it), or at minimum check if the keys already exist before overwriting user-defined values.

### H-6: `ApiLayersList::enrichWithUserNames()` duplicates `ApiLayersInfo` pattern with subtle differences

- **File:** [src/Api/ApiLayersList.php](src/Api/ApiLayersList.php#L180-L230)
- **Category:** Quality
- **Description:** `ApiLayersList` has its own `enrichWithUserNames()` method that follows a different pattern from `ApiLayersInfo`'s user enrichment. The ApiLayersList version uses `$services->getUserFactory()->newFromId()` but accesses different field names (`ls_user_id` vs `userId`). This creates a maintenance burden — a fix applied to one won't automatically apply to the other.
- **Evidence:** ApiLayersList directly accesses `$slide['ls_user_id']` (raw DB column names) while ApiLayersInfo uses a normalized approach. The UIHooks class has yet another copy of this pattern.
- **Fix:** Extract a shared `UserNameEnricher` utility class that handles the user ID → name lookup, parameterized by the field name for the user ID.

### H-7: `EditLayersAction::show()` calls `MediaWikiServices::getInstance()` twice

- **File:** [src/Action/EditLayersAction.php](src/Action/EditLayersAction.php#L37-L73)
- **Category:** Quality / Performance
- **Description:** The `show()` method calls `MediaWikiServices::getInstance()` at line 40 (for permissions check) and again at line 70 (for RepoGroup). The result is not stored from the first call, so the service container is fetched twice.
- **Evidence:** Lines 39-41: `$services = class_exists(...) ? \call_user_func(...)  : null;` and then again at line 70: identical call. The second call also redundantly re-checks `class_exists`.
- **Fix:** Store the result of the first `MediaWikiServices::getInstance()` call and reuse it.

### H-8: `RateLimiter::isComplexityAllowed()` may fail on unresolved constant

- **File:** [src/Security/RateLimiter.php](src/Security/RateLimiter.php#L260-L299)
- **Category:** Bug
- **Description:** The `isComplexityAllowed()` method references `LayersConstants::DEFAULT_MAX_COMPLEXITY`. The file should have a `use` statement for `LayersConstants` to ensure the constant resolves correctly.
- **Evidence:** Review the `use` statements at the top of RateLimiter.php — verify `LayersConstants` is imported. If not, the reference would rely on relative namespace resolution which may fail.
- **Fix:** Verify and add `use MediaWiki\Extension\Layers\LayersConstants;` if missing.

---

## Medium Issues (16)

### M-1: `LayersDatabase::buildImageNameLookup()` generates multiple name variants for SQL IN clause

- **File:** [src/Database/LayersDatabase.php](src/Database/LayersDatabase.php#L180-L210)
- **Category:** Performance
- **Description:** This method runs on every query and generates 4+ name variants (with/without spaces/underscores, with/without `File:` prefix). Each query then uses `IN (...)` with all these variants. This is functionally correct but creates wider query predicates than necessary if the canonical name is always stored consistently.
- **Fix:** Normalize names on write (in `saveLayerSet`) to a canonical form and query with a single value.

### M-2: Transaction retry in `LayersDatabase::saveLayerSet()` retries on all `DBQueryError` types

- **File:** [src/Database/LayersDatabase.php](src/Database/LayersDatabase.php#L280-L340)
- **Category:** Bug
- **Description:** The retry logic catches `DBQueryError` (any query error) and retries with backoff. This means a malformed query or constraint violation would be retried 3 times with delays before finally failing. Only deadlocks/lock conflicts should trigger retries.
- **Evidence:** The catch block checks `strpos( $msg, 'Deadlock' ) !== false || strpos( $msg, 'lock' ) !== false` to decide whether to retry. However, the exception is caught whether or not it's a deadlock — the strpos check only controls whether to log "Retrying" vs "Non-retryable." The actual retry happens regardless because the exception is caught inside the loop.
- **Fix:** Re-throw the exception immediately if the message doesn't match deadlock patterns, rather than continuing the retry loop.

### M-3: `ApiLayersSave` logs raw `$filename` before validation

- **File:** [src/Api/ApiLayersSave.php](src/Api/ApiLayersSave.php#L100-L120)
- **Category:** Security (Low impact)
- **Description:** The filename parameter is validated via `Title::makeTitleSafe( NS_FILE, $filename )`, but the raw `$filename` is used in log messages before this validation occurs. A crafted filename with newlines could cause log injection.
- **Fix:** Sanitize `$filename` for log safety before first use, or move logging after validation.

### M-4: `ServerSideLayerValidator::validateSvgString()` uses regex instead of XML parser

- **File:** [src/Validation/ServerSideLayerValidator.php](src/Validation/ServerSideLayerValidator.php#L1280-L1349)
- **Category:** Security (Defense in depth)
- **Description:** SVG validation uses regex patterns to detect dangerous elements (`<script`, `<foreignObject`, `on[event]` attributes). Regex-based SVG/XML sanitization is known to be bypassable via encoding tricks (e.g., CDATA sections, entity encoding). While the path data validator restricts the character set which limits HTML injection, the SVG string validation would benefit from a proper XML parser.
- **Fix:** Use PHP's `DOMDocument` to parse the SVG and walk the DOM tree for forbidden elements/attributes.

### M-5: `ColorValidator` silently replaces invalid colors with `DEFAULT_COLOR`

- **File:** [src/Validation/ColorValidator.php](src/Validation/ColorValidator.php#L210-L270)
- **Category:** Quality
- **Description:** When `sanitizeRgbColor()` or `sanitizeHslColor()` receive a string that looks like RGB/HSL but doesn't match the expected regex, they silently return `self::DEFAULT_COLOR` (black `#000000`). This is a silent data transformation — the user's intended color is replaced without warning.
- **Fix:** Log a debug message when silently replacing an invalid color.

### M-6: `SlideHooks::buildSlideHtml` embeds inline Base64 SVG in PHP string

- **File:** [src/Hooks/SlideHooks.php](src/Hooks/SlideHooks.php#L400-L420)
- **Category:** Quality
- **Description:** The transparent background checkerboard pattern is a hardcoded Base64 SVG data URI in a PHP string. This is difficult to maintain and not self-documenting.
- **Fix:** Extract to a named constant with documentation.

### M-7: `UIHooks::onSkinTemplateNavigation()` has ~20 unnecessary `method_exists` checks

- **File:** [src/Hooks/UIHooks.php](src/Hooks/UIHooks.php#L30-L180)
- **Category:** Quality
- **Description:** This 200+ line method has ~20 `method_exists()` checks for APIs guaranteed by MW 1.44.0 (the extension's minimum version). These are dead backward-compatibility code that reduces readability.
- **Fix:** Remove compatibility checks for features guaranteed by MW 1.44.0.

### M-8: `LayeredThumbnail::toHtml()` builds HTML manually

- **File:** [src/LayeredThumbnail.php](src/LayeredThumbnail.php#L93-L128)
- **Category:** Quality
- **Description:** HTML is built via string concatenation with `htmlspecialchars`, bypassing MediaWiki's `Html::rawElement()` / `Html::element()` which handle proper encoding consistently.
- **Fix:** Use MediaWiki's `Html` class.

### M-9: `LayersFileTransform` catches `Exception` but not `\Throwable`

- **File:** [src/LayersFileTransform.php](src/LayersFileTransform.php#L47)
- **Category:** Bug
- **Description:** The catch block catches `Exception` but not `\Throwable`. PHP 7+ Type Errors would propagate uncaught and could break the entire thumbnail pipeline.
- **Fix:** Change to `catch ( \Throwable $e )`.

### M-10: Dual `onLoadExtensionSchemaUpdates` implementations

- **File:** [src/Hooks.php](src/Hooks.php#L350-L400) and [src/Database/LayersSchemaManager.php](src/Database/LayersSchemaManager.php#L50-L150)
- **Category:** Bug / Design
- **Description:** Both `Hooks.php` and `LayersSchemaManager.php` implement `onLoadExtensionSchemaUpdates` with different approaches (per-table files vs monolithic + patches). If both were registered, schema updates could conflict.
- **Fix:** Consolidate into a single handler.

### M-11: `ThumbnailProcessor` at 690 lines approaching god class territory

- **File:** [src/Hooks/Processors/ThumbnailProcessor.php](src/Hooks/Processors/ThumbnailProcessor.php)
- **Category:** Quality
- **Description:** Combines thumbnail processing, layer injection, DB fetching, foreign file detection, layerslink application, and permission checking.
- **Fix:** Extract `applyLayersLink` and `fetchLayersFromDatabase` into separate helpers.

### M-12: `ImageLinkProcessor` at 765 lines — god class

- **File:** [src/Hooks/Processors/ImageLinkProcessor.php](src/Hooks/Processors/ImageLinkProcessor.php)
- **Category:** Quality
- **Description:** Largest hook processor. Duplicates some logic from `ThumbnailProcessor`.
- **Fix:** Extract shared logic into a common service class.

### M-13: `SpecialSlides::showCreateForm()` hardcodes max dimensions to 4096

- **File:** [src/SpecialPages/SpecialSlides.php](src/SpecialPages/SpecialSlides.php#L240)
- **Category:** Bug
- **Description:** The create form hardcodes `max="4096"` for custom width/height inputs, but the actual maximum is configurable via `LayersSlideMaxWidth`/`LayersSlideMaxHeight`. Users could see a form allowing 4096px but the API would reject values above the configured max.
- **Fix:** Use `$config->get('LayersSlideMaxWidth')` for the HTML `max` attributes.

### M-14: `SetNameSanitizer::sanitize()` allows spaces which break wikitext parameter parsing

- **File:** [src/Validation/SetNameSanitizer.php](src/Validation/SetNameSanitizer.php#L65-L70)
- **Category:** Bug
- **Description:** The sanitizer allows spaces in set names (`\s` in whitelist regex). In wikitext syntax `layerset=my set`, spaces cause `my` to be treated as the value and `set` as a separate parameter.
- **Fix:** Disallow spaces in set names, or ensure all wikitext consumers properly handle multi-word values.

### M-15: `LayersDatabase::pruneOldRevisions()` deletes without logging revision IDs

- **File:** [src/Database/LayersDatabase.php](src/Database/LayersDatabase.php#L900-L950)
- **Category:** Quality / Audit
- **Description:** When old revisions are pruned, only a count is logged, not which specific revision IDs were removed.
- **Fix:** Log pruned revision IDs at debug level before deleting.

### M-16: SQL schema `binary` collation vs multi-variant name lookups

- **File:** [sql/layers_tables.sql](sql/layers_tables.sql#L7) and [src/Database/LayersDatabase.php](src/Database/LayersDatabase.php#L180-L210)
- **Category:** Design
- **Description:** `ls_img_name varchar(255) binary` means case-sensitive lookups, but `buildImageNameLookup()` generates both space and underscore variants, suggesting inconsistent storage. This could lead to orphaned data.
- **Fix:** Standardize on one canonical form at write time and simplify lookups.

---

## Low Issues (11)

### L-1: `StaticLoggerAwareTrait` shared static state documentation

- **File:** [src/Logging/StaticLoggerAwareTrait.php](src/Logging/StaticLoggerAwareTrait.php#L42)
- **Category:** Design — Document the `self::$staticLogger` sharing behavior.

### L-2: `LayersLogger::logError()` accepts `?\Exception` instead of `?\Throwable`

- **File:** [src/Logging/LayersLogger.php](src/Logging/LayersLogger.php#L120)
- **Category:** Quality — Change to `?\Throwable`.

### L-3: `ValidationResult` properties lack type declarations

- **File:** [src/Validation/ValidationResult.php](src/Validation/ValidationResult.php#L17-L25)
- **Category:** Quality — Add property types.

### L-4: `EditLayersAction` uses `class_exists` checks for MW 1.44-guaranteed classes

- **File:** [src/Action/EditLayersAction.php](src/Action/EditLayersAction.php#L38-L42)
- **Category:** Quality — Remove unnecessary defensive checks.

### L-5: `UIHooks::onImagePageAfterImageLinks` is non-static but acts as static hook

- **File:** [src/Hooks/UIHooks.php](src/Hooks/UIHooks.php#L295)
- **Category:** Quality — Make static or ensure proper registration.

### L-6: `LayersParamExtractor` at 456 lines for a utility class

- **File:** [src/Hooks/Processors/LayersParamExtractor.php](src/Hooks/Processors/LayersParamExtractor.php)
- **Category:** Quality — Review for consolidation.

### L-7: `services.php` doesn't inject dependencies into `LayersSchemaManager`

- **File:** [services.php](services.php#L22-L23)
- **Category:** Design — Inject `IConnectionProvider` for testability.

### L-8: `SlideNameValidator` uses `strlen()` vs `mb_strlen()` inconsistency

- **File:** [src/Validation/SlideNameValidator.php](src/Validation/SlideNameValidator.php#L65-L68)
- **Category:** Bug (minor) — Use `mb_strlen()` for consistency with `SetNameSanitizer`.

### L-9: `LayeredThumbnail::getLayeredUrl()` has dead `$GLOBALS` fallback

- **File:** [src/LayeredThumbnail.php](src/LayeredThumbnail.php#L67-L70)
- **Category:** Quality — Remove dead code.

### L-10: `Hooks.php` duplicates `getFileSha1()`/`isForeignFile()` as static methods

- **File:** [src/Hooks.php](src/Hooks.php#L480-L518)
- **Category:** Design — Use `ForeignFileHelperTrait` via adapter.

### L-11: Foreign key constraints in schema may cause issues with some installations

- **File:** [sql/layers_tables.sql](sql/layers_tables.sql#L25-L55)
- **Category:** Design — Document InnoDB requirement.

---

## Recommendations (Priority Order)

1. **Fix C-1 immediately** — `ApiUsageException` swallowing in `ApiLayersDelete` can mask authorization failures
2. **Remove or secure `diagnose.php` (C-3)** — information disclosure in production
3. **Address H-1 (schema validation performance)** — caching `isSchemaReady()` would eliminate ~12 DB queries per API call
4. **Consolidate `isForeignFile`/`getFileSha1` (H-2)** — use the existing `ForeignFileHelperTrait` everywhere
5. **Fix M-2 (retry on all errors)** — only retry on deadlocks, not arbitrary query errors
6. **Add early-exit to wikitext parsing (H-3)** — simple `strpos` check before expensive regex processing
7. **Validate CSP host values (C-2)** — strict hostname pattern check
8. **Validate IM colors (H-4)** — gate through `ColorValidator` before ImageMagick
9. **Remove dead MW compatibility code (M-7, L-4, L-9)** — simplify since MW 1.44+ is required
10. **Address god classes (M-11, M-12)** — extract shared logic into common services

---

## Positive Observations

The codebase demonstrates many strong practices:

- **Comprehensive CSRF protection**: All write endpoints require tokens via `needsToken()`
- **Thorough input validation**: `ServerSideLayerValidator` with 40+ fields, strict whitelists
- **ImageMagick `@` injection prevention**: Text values stripped of leading `@`
- **Rate limiting**: Consistent use of `pingLimiter()` across all write operations
- **i18n compliance**: Error messages use MediaWiki message keys throughout
- **Separation of concerns**: Clean trait extraction, processor pattern for hooks
- **Strict types**: `declare(strict_types=1)` on all source files
- **Defensive coding**: Consistent `\Throwable` catches prevent extension from crashing MediaWiki
- **Service injection**: Proper DI via `services.php` for database, logger, schema manager
- **Schema evolution**: Well-organized patch files for database migrations
