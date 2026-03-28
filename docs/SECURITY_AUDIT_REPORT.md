# Security Audit Report — MediaWiki Layers Extension v1.5.63

**Date:** June 2025
**Scope:** Full codebase — 42 PHP files (~15,339 lines), 157 JS files (~113,900 lines)
**Methodology:** Manual static analysis against OWASP Top 10, MediaWiki-specific vectors, and 15 vulnerability classes (SQL injection, XSS, CSRF, SSRF, auth bypass, command injection, prototype pollution, path traversal, clickjacking, ReDoS, race conditions, info disclosure, deserialization, open redirect, wikitext injection)

## Executive Summary

The codebase demonstrates **strong, defense-in-depth security architecture** with no critical or high-severity vulnerabilities. Five findings were confirmed and fixed; thirteen candidates were eliminated as false positives or adequately mitigated. The extension's security posture is well above average for a MediaWiki extension of this complexity.

## Findings — Fixed

### S-001: SpecialEditSlide Missing Block Status Check (MEDIUM)

**File:** `src/SpecialPages/SpecialEditSlide.php`
**Vector:** `PermissionManager::userHasRight()` checks rights but not block status. A blocked user retains `editlayers` right and could load the full slide editor. The save API independently enforces blocks, limiting impact to resource waste.
**Fix:** Added `$user->getBlock()` check with `UserBlockedError` after the permission check.

### S-002: HelpDialog innerHTML with Unescaped i18n Messages (MEDIUM)

**File:** `resources/ext.layers.editor/editor/HelpDialog.js`
**Vector:** `mw.message(key).text()` output injected into template literals set via `innerHTML`. If a wiki admin or i18n editor injects `<img onerror=alert(1) src=x>` into message values, it executes in the editor context.
**Fix:** Added `getMessageEscaped()` helper using `mw.message(key).escaped()` for all innerHTML contexts. Converted `renderTools` tool names to DOM construction (`createElement`/`textContent`).

### S-003: Anonymous User ID Collision in Ownership Check (LOW)

**File:** `src/Api/Traits/LayersApiHelperTrait.php`
**Vector:** All anonymous users share `userId = 0`. If the wiki grants `editlayers` to `*`, any anonymous user matches ownership of sets created by other anonymous users, allowing unauthorized delete/rename.
**Precondition:** Requires non-default configuration (`'*' => ['editlayers' => true]`).
**Fix:** Added `&& $userId !== 0` guard to ownership comparison.

### S-004: RichTextConverter CSS Keyword Blocklist Gap (LOW)

**File:** `resources/ext.layers.editor/canvas/RichTextConverter.js`
**Vector:** `escapeCSSValue()` blocked `url()`, `expression()`, `javascript()` but missed `behavior()` and `-moz-binding()` — legacy IE/Firefox CSS injection vectors. Limited practical impact since values go to inline styles only.
**Fix:** Extended regex to include `behavior` and `-moz-binding`.

### S-005: SpecialSlides Missing Read Permission Restriction (LOW)

**File:** `src/SpecialPages/SpecialSlides.php`
**Vector:** `Special:Slides` accessible to all users including anonymous on private wikis. Slide names and structure visible via HTML even if API calls are gated. The page rendered regardless of `read` permissions.
**Fix:** Added `'read'` restriction parameter to `SpecialPage` constructor.

## Findings — Eliminated (False Positives / Adequately Mitigated)

| # | Candidate | Why Eliminated |
|---|-----------|---------------|
| 1 | ImageMagick color argument injection | `sanitizeColor()` is an **allowlist** (hex, rgb, hsl, named) that falls back to `#000000`. Unrecognized formats never reach IM. |
| 2 | `{{#layeredit:}}` wikitext injection | `Title::getLocalURL()` URL-encodes all query parameters. Set names are further sanitized by `SetNameSanitizer`. |
| 3 | `{{#layerlist:}}` unsanitized output | `SetNameSanitizer` only allows `[\p{L}\p{N}_\-\s]` — no wikitext metacharacters (`[`, `]`, `{`, `}`, `|`, `=`). |
| 4 | ImageLayerRenderer protocol injection | Browsers do not execute `javascript:` URLs in `<img src>`. Server-side validator also strips dangerous protocols. |
| 5 | localStorage tampering | Requires pre-existing same-origin XSS. Inherent to localStorage design; out of scope. |
| 6 | Prototype pollution in ImportExportManager | `JSON.parse()` creates regular property named `__proto__`, not a prototype override. Explicit `delete` is defense-in-depth. |
| 7 | `isSafeColor()` blocklist gap | `sanitizeColor()` downstream is an allowlist that catches everything. Blocklist never the sole defense. |
| 8 | Debug logging PII exposure | Gated by `wgLayersDebug` (default: false). User IDs are not sensitive in MediaWiki context; names already public on edit histories. |
| 9 | Iframe SAMEORIGIN downgrade | `?modal=1` is same-origin only. Exploitation requires separate XSS on the wiki, which is a higher-severity prerequisite. |
| 10 | `@file` ImageMagick text injection | Already mitigated by `ltrim('@')` in `buildTextArguments()`. All geometry values cast to `(int)`. |
| 11 | postMessage origin validation | Correctly implemented with `event.origin !== window.location.origin`. |
| 12 | SSRF via ForeignFileHelper | No outbound HTTP requests. Delegates to MediaWiki core `RepoGroup::findFile()`. |
| 13 | Documentation vs code mismatch (`layers-admin` vs `delete` right) | Code is **more** restrictive than documented. Security-positive discrepancy only. |

## Positive Security Patterns Observed

| Category | Implementation |
|----------|---------------|
| **SQL Injection Prevention** | All queries use MediaWiki `IDatabase` with parameterized operations. Zero raw SQL interpolation in `LayersDatabase.php` (~1,372 lines). `validateSortColumn()`/`validateSortDirection()` use strict whitelists. |
| **CSRF Protection** | All 4 write endpoints require `needsToken('csrf')` + `mustBePosted()`. Client uses `api.postWithToken('csrf', ...)`. |
| **Input Validation** | `ServerSideLayerValidator` (~1,434 lines) enforces strict property whitelist (40+ fields), type constraints, value enums, numeric ranges. Unknown properties silently dropped. |
| **XSS Prevention — SVG** | `validateSvgString()` blocks `<script>`, event handlers, `<foreignObject>`, external URLs, `<style>`, CSS expressions, and XBL bindings. |
| **XSS Prevention — Text** | `TextSanitizer` uses double-strip (`html_entity_decode` → `strip_tags`), loop-based protocol removal (prevents `jajavascript:vascript:` nesting), event handler stripping. |
| **XSS Prevention — HTML** | PHP output uses `htmlspecialchars()` / `->escaped()`. JS uses `textContent` for user data throughout. |
| **Rate Limiting** | All endpoints use `RateLimiter` with configurable limits per action (7 keys: save, delete, rename, create, render, info, list). |
| **Race Condition Prevention** | `saveLayerSet()` uses `FOR UPDATE` locks inside atomic transactions. Retry logic with exponential backoff (3 retries, 100ms base). |
| **ReDoS Protection** | `ColorValidator` enforces `MAX_COLOR_LENGTH = 50` before all regex operations. |
| **JSON Depth Bomb Prevention** | `json_decode()` uses `max_depth: 512`. |
| **Information Disclosure** | API returns generic error codes; detailed errors logged server-side only. |
| **Open Redirect Prevention** | `returnto` validated through `Title::newFromText()` constraining to local wiki URLs. |
| **Clickjacking Protection** | Modal mode sets `X-Frame-Options: SAMEORIGIN`. |
| **Transaction Integrity** | Save/delete/rename use `startAtomic()`/`endAtomic()`. |
| **Permission Model** | Three-tier: `editlayers`, `managelayerlibrary`, `layers-admin`. Anonymous denied by default. Owner-or-admin for destructive ops. |
| **CSP Compliance** | No inline scripts. Config via `addJsConfigVars()`. ResourceLoader handles all script loading. |

## Summary

| Severity | Found | Fixed | Eliminated |
|----------|-------|-------|------------|
| CRITICAL | 0 | — | — |
| HIGH | 0 | — | — |
| MEDIUM | 2 | 2 | 0 |
| LOW | 3 | 3 | 0 |
| INFO | 0 | — | 13 |
| **Total** | **18** | **5** | **13** |
