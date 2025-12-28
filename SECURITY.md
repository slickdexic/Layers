# Security & CSP Guidelines for Layers Extension

This document defines the security posture and coding rules for the Layers extension. All contributors must follow these practices.

## Reporting Security Vulnerabilities

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please use one of these methods:

1. **GitHub Security Advisories** (preferred): Go to the [Security tab](../../security/advisories/new) and create a new private security advisory
2. **Email**: Contact the maintainers directly at the email listed in the repository

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to understand and resolve the issue.

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
- Use MediaWiki pingLimiter keys: `editlayers-save`, `editlayers-render`, `editlayers-create`.

### CSP (Content Security Policy)
- Avoid inline scripts/styles to support strict CSP. ResourceLoader modules should provide scripts and styles.
- No `eval` or dynamic Function usage.

### Data Model
- Only persist whitelisted layer fields. Unknown props are dropped server-side.
- See [`ApiLayersSave.php`](src/Api/ApiLayersSave.php) for the server-side validation whitelist.

---

## Platform Notes

### Windows Composer Conflict
On Windows, ensure PHP Composer is used (`composer.phar` or full path). A Python package named `composer` can shadow `composer` on PATH. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
