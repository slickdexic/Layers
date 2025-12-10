# Layers Extension CSP Guide

This guide helps you set a secure Content-Security-Policy (CSP) for MediaWiki with the Layers extension while keeping the editor and viewer fully functional.

## Key requirements

Layers is a client-side overlay editor. It uses:

- Inline event handlers: none (editor uses JS listeners only)
- Dynamic style updates: via CSS classes only (no inline CSS injection)
- Canvas rendering: HTMLCanvasElement for overlays
- Images: original File page image (same-origin) and optional thumbnails
- Web workers: none
- Data URLs: optional for drag image/clipboard previews (can be disabled)

## Recommended CSP

Start strict and relax only as needed. Replace example.org with your domain.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' blob:;  # 'unsafe-eval' only if using dev tools/source maps
  style-src 'self' 'unsafe-inline';       # ResourceLoader injects inline styles for RL modules
  img-src 'self' data: blob: https://upload.example.org;  # allow data: for canvas toDataURL previews
  connect-src 'self';                      # MediaWiki API calls are same-origin
  font-src 'self' data:;                   # if you serve fonts via RL or data URIs
  media-src 'self';
  object-src 'none';
  frame-ancestors 'self';
```

Notes:

- In production, remove `'unsafe-eval'` from `script-src`. Keep it in development if your tooling needs it (source maps, eval-based loaders). The extension does not require it.
- `style-src 'unsafe-inline'` is often required by ResourceLoader for on-the-fly styles. If you maintain a nonce-based setup, configure MW ResourceLoader to attach nonces and switch to `style-src 'self' 'nonce-<...>'`.
- `img-src data:` is needed only if you enable copy/paste or export features that use canvas `toDataURL`. If disabled, you can drop `data:`.
- If your file backend or CDN serves images from a different host, add it under `img-src`.

## MediaWiki configuration tips

- Set `$wgCSPHeader` or use a reverse proxy (Apache/Nginx) to add the CSP header.
- If you use `$wgCSPReportOnly`, monitor violations before enforcing.
- For RL nonces: `$wgCSPNonce` in newer MediaWiki versions can integrate nonces with ResourceLoader.

## Troubleshooting

Common violations and fixes:

- Refused to apply inline style: add `'unsafe-inline'` to `style-src` or configure nonces for RL.
- Refused to load image data: missing `data:` in `img-src` when using canvas export/previews.
- Refused to execute script from blob: remove `blob:` from `script-src` unless you rely on it; Layers does not require it.

## Security posture checklist

- Remove `'unsafe-eval'` in production builds.
- Keep `object-src 'none'`.
- Prefer nonces over `'unsafe-inline'` where possible.
- Audit any future features (web workers, cross-origin images) and update CSP accordingly.

