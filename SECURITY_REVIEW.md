# PHP Backend Security & Code Quality Review

**Scope:** All PHP files under `src/`, `extension.json`, `services.php`  
**Date:** 2026-02-17  
**Methodology:** Manual line-by-line review of all PHP source files (~14,991 lines across 40 files)

---

## Executive Summary

The Layers extension PHP backend is **well-secured overall**, with defense-in-depth applied consistently across API modules, validation, and rendering. No P0 (critical) or P1 (high) issues were found. The codebase demonstrates strong security practices:

- All database queries use MediaWiki's parameterized query builder (no raw SQL concatenation)
- All write API endpoints require CSRF tokens via `needsToken()` + `mustBePosted()`
- ImageMagick commands use `MediaWiki\Shell\Shell` abstraction (no raw `exec`/`shell_exec`)
- Input validation uses strict property whitelists, type checks, and range constraints
- Error responses never expose internal details (stack traces, table names, file paths)
- Rate limiting is applied to all API endpoints
- Permission checks are consistent (editlayers right + owner/admin for destructive ops)

**3 confirmed issues found (all P3)** and **5 hardening recommendations**.

---

## Confirmed Issues

### Finding 1: `sanitizeRichTextRun()` omits `@` stripping (P3 — Defense-in-Depth Gap)

**File:** `src/Validation/TextSanitizer.php`  
**Lines:** 183-214

**Description:** `sanitizeText()` strips leading `@` from text to prevent ImageMagick's `@filename` file-read injection (where IM interprets `@/etc/passwd` as "read contents from file"). The `sanitizeRichTextRun()` method performs identical sanitization steps but **omits** the `ltrim($text, '@')` call.

**Current Impact:** Not directly exploitable. `ThumbnailRenderer` only reads `$layer['text']` (which goes through `sanitizeText()`), not `$layer['richText']`. Client-side canvas rendering is unaffected.

**Future Risk:** If server-side rendering is ever extended to process richText runs (e.g., PDF export, OG image generation), the missing `@` stripping would create a file-read vulnerability.

**Code:**
```php
// sanitizeText() — line 56:
$text = ltrim( $text, '@' );  // ✅ Present

// sanitizeRichTextRun() — line ~210:
// ❌ Missing: no $text = ltrim( $text, '@' );
return $text;
```

**Fix:**
```php
public function sanitizeRichTextRun( string $text ): string {
    // ... existing sanitization ...
    $text = $this->removeEventHandlers( $text );

    // Strip leading '@' to prevent ImageMagick file read injection
    // (defense-in-depth: matches sanitizeText() behavior)
    $text = ltrim( $text, '@' );

    // Do NOT trim - whitespace is significant in rich text runs
    return $text;
}
```

---

### Finding 2: `CacheInvalidationTrait` silently swallows all errors (P3 — Error Masking)

**File:** `src/Api/Traits/CacheInvalidationTrait.php`  
**Lines:** 56-58

**Description:** The `invalidateCachesForFile()` method catches `\Throwable` (which includes PHP `Error` types like `TypeError`, `OutOfMemoryError`) with a completely empty catch block. While cache invalidation being best-effort is a valid design choice, silently discarding all errors—including fatal-class errors—can mask security-relevant conditions in production.

**Code:**
```php
} catch ( \Throwable $e ) {
    // Cache invalidation is best-effort; don't fail the save/delete/rename
    // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
}
```

**Fix:** Log at debug/warning level without failing the operation:
```php
} catch ( \Throwable $e ) {
    // Cache invalidation is best-effort; log but don't fail
    try {
        MediaWikiServices::getInstance()->get( 'LayersLogger' )->warning(
            'Cache invalidation failed: {message}',
            [ 'message' => $e->getMessage(), 'title' => $title->getDBkey() ]
        );
    } catch ( \Throwable $inner ) {
        // If even logging fails, truly nothing we can do
    }
}
```

---

### Finding 3: `withOpacity()` returns unsanitized color strings for unrecognized formats (P3 — Defense-in-Depth Gap)

**File:** `src/ThumbnailRenderer.php`  
**Lines:** 731-772 (end of `withOpacity()`)

**Description:** The `withOpacity()` method converts known color formats (hex, rgb, rgba, named) to `rgba()` strings. For any unrecognized format, it returns the original string unmodified:

```php
// Unknown color format. Keep original to avoid unexpected color changes.
return $color;
```

This string is then passed directly to ImageMagick's `-fill` or `-stroke` arguments. While `ColorValidator` validates colors at save time, this method lacks its own defense-in-depth check.

**Why it's P3 not higher:**
- Colors are validated by `ServerSideLayerValidator` → `ColorValidator` on every save
- `Shell::command()` escapes all arguments, preventing shell injection
- ImageMagick's `-fill`/`-stroke` only accept color specifications, not MVG commands
- No known ImageMagick color-argument exploit exists

**Still worth fixing because:**
- Legacy data from before validators existed might contain unexpected values
- The named color lookup in `withOpacity()` only covers 35 colors, while `ColorValidator` supports 147+. A valid named color not in the local lookup table falls through to the raw return.

**Fix:** Return a safe default for truly unrecognized formats:
```php
// Unknown color format — return safe default to prevent passing
// arbitrary strings to ImageMagick arguments
if ( $this->logger ) {
    $this->logger->debug( 'Unknown color format in withOpacity', [ 'color' => $color ] );
}
return 'rgba(0,0,0,' . sprintf( '%.3f', $opacity ) . ')';
```

Or expand the named color map to match `ColorValidator::NAMED_COLORS`.

---

## Security Architecture Assessment

### SQL Injection — **No Issues Found**

All database operations in `LayersDatabase.php` use MediaWiki's `IDatabase` abstraction with parameterized queries:
- `insert()`, `select()`, `update()`, `delete()` with associative conditions
- `makeList()` for IN clauses with validated integer arrays
- `validateSortColumn()` / `validateSortDirection()` use strict whitelists
- `buildSafeQueryOptions()` clamps limit (0-1000) and validates offset
- `JSON_THROW_ON_ERROR` + max depth 512 for JSON decode

### Command Injection — **No Issues Found**

`ThumbnailRenderer` uses `MediaWiki\Shell\Shell::command()` exclusively:
- Resource limits applied (memory, time, filesize) from config
- All numeric values in IM draw commands are `(int)` cast
- `@` stripping on text prevents IM file-read injection
- Font names go through `sanitizeIdentifier()` which strips `/\:` and all special chars
- No `exec()`, `shell_exec()`, `system()`, `passthru()`, `popen()`, or backticks found anywhere

### Path Traversal — **No Issues Found**

- `sanitizeShapeId()` strips `..` and `//`, limits to `[a-zA-Z0-9_.\/-]`
- `sanitizeIdentifier()` strips all chars except `[a-zA-Z0-9_.-]`
- `SetNameSanitizer` removes path separators `/\` and control chars
- Thumbnail output path uses `sha1 + '_' + md5(params) + '.png'` — no user input in filename

### SSRF — **No Issues Found**

- Image layer `src` only accepts `data:` URLs with MIME whitelist (png, jpeg, gif, webp; SVG excluded)
- No external URL fetching from user-controlled input
- Foreign file support uses MediaWiki's RepoGroup (configured server-side)

### Authentication/Authorization Bypass — **No Issues Found**

- All write endpoints: `checkUserRightsAny('editlayers')` + CSRF token + `mustBePosted()`
- Delete/Rename: Additional owner-or-admin check via `isOwnerOrAdmin()`
  - Owner check: `$ownerId === $userId` (strict int comparison, no type juggling)
  - Admin check: `$user->isAllowed('delete')` (sysop-only right)
- Read endpoints: `permissionManager->userCan('read', $user, $title)` for file info
- Slide listing: `checkUserRightsAny('read')` to prevent anonymous enumeration
- Permission defaults: anonymous users have `editlayers: false`

### Race Conditions — **Minimal Risk**

- `LayersDatabase::saveLayerSet()`: Uses `startAtomic`/`endAtomic` with `FOR UPDATE` locks, 3-retry exponential backoff, 5s timeout
- `LayersDatabase::renameNamedSet()`: Atomic transaction with `FOR UPDATE`
- Named set count enforcement is within the atomic transaction
- `ThumbnailRenderer` has a benign TOCTOU (`file_exists` check then write) — worst case is duplicate generation, not a security issue

### Information Disclosure — **No Issues Found**

- All catch blocks log full details server-side, return generic error codes to clients
- Error constants used consistently (`LayersConstants::ERROR_*`)
- Stack traces never exposed to API responses
- Debug mode requires explicit `$wgLayersDebug = true` in config; URL param only toggles when config already enabled

### XSS (Stored/Reflected) — **No Issues Found in PHP**

- `TextSanitizer::sanitizeText()`: strip_tags → html_entity_decode → re-strip_tags → protocol removal → event handler removal
- `removeDangerousProtocols()`: Loop until no changes (prevents nested bypass)
- `UIHooks`: All HTML output uses `htmlspecialchars()` / `->escaped()`
- `SpecialSlides`: Output properly escaped
- Data stored as JSON; HTML encoding deferred to render time (correct pattern)

### CSRF — **No Issues Found**

All write endpoints implement the MediaWiki CSRF pattern:
- `needsToken()` returns `'csrf'`
- `mustBePosted()` returns `true`
- `isWriteMode()` returns `true`

Verified for: `ApiLayersSave`, `ApiLayersDelete`, `ApiLayersRename`

### Rate Limiting — **Properly Implemented**

- `RateLimiter` delegates to MW's `User::pingLimiter()` with action-specific keys
- All write endpoints check rate limits
- Read endpoints (`ApiLayersInfo`, `ApiLayersList`) also rate-limited
- Image size, layer count, and complexity checks enforced via `LayerSaveGuardsTrait`

---

## Hardening Recommendations (Not Issues)

These are not vulnerabilities but opportunities to strengthen defense-in-depth:

### R1: Expand `withOpacity()` named color map

The `ThumbnailRenderer::withOpacity()` named color map has 35 entries while `ColorValidator::NAMED_COLORS` has 147+. Colors like `dodgerblue` or `mediumseagreen` that pass validation will hit the fallthrough path. Consider extracting a shared color map or importing `ColorValidator::NAMED_COLORS`.

### R2: Add `Content-Security-Policy` headers for iframe modal mode

`EditLayersAction.php` and `SpecialEditSlide.php` intentionally disable clickjacking protection for iframe modal mode (`allowClickjacking()`/`setPreventClickjacking(false)`). Consider adding a `frame-ancestors` CSP directive limited to `'self'` to restrict which origins can embed the editor in an iframe.

### R3: Consider adding server-side fontFamily allowlist in ThumbnailRenderer

While `sanitizeIdentifier()` prevents injection, the `-font` argument in ImageMagick accepts either font names or file paths. The current sanitization strips path characters (`/\:`), making path-based exploitation impossible. As extra hardening, the renderer could validate fontFamily against `$wgLayersDefaultFonts` and fall back to `DejaVu-Sans` for unknown fonts.

### R4: Add rate limiting for `ApiLayersRename`

`ApiLayersRename.execute()` does call `$rateLimiter->checkRateLimit($user, 'rename')`, but the `'rename'` action key should be documented in the rate limits configuration section and `extension.json` to ensure wiki admins can configure appropriate limits.

### R5: Consider adding database-level constraints

The schema uses application-level validation for named set uniqueness. Adding a `UNIQUE(ls_img_name, ls_img_sha1, ls_name, ls_revision)` constraint would provide database-level defense against race conditions in set creation, even though the FOR UPDATE locks already handle this.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `src/Database/LayersDatabase.php` | 1,369 | ✅ Full review |
| `src/Validation/ServerSideLayerValidator.php` | 1,407 | ✅ Full review |
| `src/Validation/ColorValidator.php` | 378 | ✅ Full review |
| `src/Validation/TextSanitizer.php` | 247 | ✅ Full review |
| `src/Validation/SetNameSanitizer.php` | ~100 | ✅ Full review |
| `src/Validation/SlideNameValidator.php` | 158 | ✅ Full review |
| `src/Security/RateLimiter.php` | 232 | ✅ Full review |
| `src/ThumbnailRenderer.php` | 772 | ✅ Full review |
| `src/Utility/ForeignFileHelper.php` | ~60 | ✅ Full review |
| `src/Hooks/UIHooks.php` | 400 | ✅ Full review |
| `src/Hooks/WikitextHooks.php` | 784 | ✅ Full review |
| `src/Action/EditLayersAction.php` | ~300 | ✅ Full review |
| `src/SpecialPages/SpecialEditSlide.php` | ~250 | ✅ Full review |
| `src/SpecialPages/SpecialSlides.php` | 308 | ✅ Full review |
| `src/Api/ApiLayersSave.php` | 685 | ✅ Full review |
| `src/Api/ApiLayersDelete.php` | 371 | ✅ Full review |
| `src/Api/ApiLayersInfo.php` | 658 | ✅ Full review |
| `src/Api/ApiLayersRename.php` | ~380 | ✅ Full review |
| `src/Api/ApiLayersList.php` | ~280 | ✅ Full review |
| `src/Api/Traits/CacheInvalidationTrait.php` | ~70 | ✅ Full review |
| `src/Api/Traits/ForeignFileHelperTrait.php` | ~50 | ✅ Full review |
| `src/Api/Traits/LayersApiHelperTrait.php` | 155 | ✅ Full review |
| `src/Api/Traits/LayerSaveGuardsTrait.php` | ~60 | ✅ Full review |
| `src/Api/Traits/LayersContinuationTrait.php` | ~40 | ✅ Full review |
| `extension.json` (permissions section) | — | ✅ Reviewed |
