# Security & CSP Guidelines for Layers Extension

This document defines the security posture and coding rules for the Layers extension. All contributors must follow these practices.

- DOM safety
  - Do not use `innerHTML`, `insertAdjacentHTML`, or `cssText` for dynamic content. Prefer `textContent`, `setAttribute`, and explicit style properties.
  - Build UI using `document.createElement`, set attributes, and append nodes.
  - Sanitize any user-visible string. MediaWiki i18n messages are trusted, user-provided text is not.
  - Keep all interactive code behind event listeners—no inline event handlers.

- Network and API
  - All writes require CSRF tokens: use `api.postWithToken('csrf', ...)`.
  - Validate payload sizes and layer counts on both client and server.
  - Never log secrets; use sanitized debug logs guarded by `$wgLayersDebug`.

- Rate limiting
  - Use MediaWiki pingLimiter keys: `editlayers-save`, `editlayers-render`, `editlayers-create`.

- CSP
  - Avoid inline scripts/styles to support strict CSP. ResourceLoader modules should provide scripts and styles.
  - No `eval` or dynamic Function usage.

- Data model
  - Only persist whitelisted layer fields. Unknown props are dropped server-side.

- Windows Composer note
  - On Windows, ensure PHP Composer is used (composer.phar or full path). A Python package named `composer` can shadow `composer` on PATH.

- Reporting
  - Use the GitHub security advisories workflow or contact maintainers for vulnerabilities.
