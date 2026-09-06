# Security & CSP Guidelines for Layers Extension

This document defines the security posture and coding rules for the Layers extension. All contributors must follow these practices.

## Reporting Security Vulnerabilities

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please use one of these methods:

1. **GitHub Security Advisories** (preferred): Go to the [private advisory form](https://github.com/slickdexic/Layers/security/advisories/new) and create a new private security advisory
If private reporting is unavailable, use a maintainer-provided private contact; do not post exploit details publicly.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

Maintainers will triage reports; no response-time guarantee is stated here.

---

## Security Practices

### DOM Safety
- Do not use `innerHTML`, `insertAdjacentHTML`, or `cssText` for dynamic content. Prefer `textContent`, `setAttribute`, and explicit style properties.
- Build UI using `document.createElement`, set attributes, and append nodes.
- Sanitize any user-visible string. MediaWiki i18n messages are trusted, user-provided text is not.
- Keep all interactive code behind event listeners—no inline event handlers.

### Network and API
- All writes require CSRF tokens: use `api.postWithToken('csrf', ...)`.
- Validate payload sizes and layer counts on both client and server.
- Never log secrets; use sanitized debug logs guarded by `$wgLayersDebug`.

### Rate Limiting
- Seven buckets are declared: `editlayers-save`, `editlayers-render`, `editlayers-list`, `editlayers-info`, `editlayers-delete`, `editlayers-rename`, and `editlayers-create`. The slide-creation enforcement gap is tracked in [known issues](docs/KNOWN_ISSUES.md).
- Defaults ship in `extension.json` since v1.5.83. This is load-bearing:
  `pingLimiter()` reports "not limited" for a bucket nobody configured, so a
  key with no default is not a control at all. Any new `editlayers-<action>`
  key must be added there.

### CSP (Content Security Policy)
- Avoid inline scripts/styles to support strict CSP. ResourceLoader modules should provide scripts and styles.
- No `eval` or dynamic Function usage.

### Data Model
- Only persist whitelisted layer fields. Unknown props are dropped server-side.
- See [`ServerSideLayerValidator.php`](src/Validation/ServerSideLayerValidator.php) for the server-side property whitelist.

---

## Platform Notes

### Windows Composer Conflict
On Windows, ensure PHP Composer is used (`composer.phar` or full path). A Python package named `composer` can shadow `composer` on PATH. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Current security boundaries

File writes require ordinary page editing authority as well as Layers rights. Delete/rename uses creator identity or `layers-admin`, checking the complete mutation scope. Do not confuse a hidden edit button, layer lock or `noedit` markup with authorization. Shared slides are not yet protected by the embedding SOP page's history/ownership.

Keep cached PDF exports outside the web document root and deliver through `Special:LayersExport`. Source-title binding supplements the access check; file-content identity alone is insufficient. Regenerate old caches after the post-1.5.95 fix.

Audit shipped dependencies, including vendored pdf.js even though its npm package is a development dependency. `npm audit --omit=dev` alone misses that runtime asset. Preserve license notices when replacing bundles.

See [current status](docs/CURRENT_STATUS.md) and the [codebase review](codebase_review.md) for open issues. Layer revision pruning, best-effort audit calls and asynchronous exports are not corporate revision-compliance guarantees. Backports to other branches require explicit verification.
