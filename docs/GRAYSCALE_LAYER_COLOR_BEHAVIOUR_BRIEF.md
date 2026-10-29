# Server-rendered color on grayscale images

This correction advances Milestone 1 / TYPES and DATA-1. On a grayscale base
image, the server renderer can render imported colored image layers in grayscale
or leave them invisible. The editor shows those layers in color. A synthetic
colored rectangle rendered correctly in the same initial comparison.

Proposed behavior: the server-side PDF export retains the saved colors of
imported image layers over grayscale base images, matching the editor. The
existing legacy viewer can call this exporter for PDF Download or a Print
fallback. The normal page display and page-owned viewer have not been shown to
have this defect. The base image remains visually grayscale, and layer order,
opacity, controls, export choices, permissions and save behavior remain
unchanged. No new wording or controls are introduced.

The owner approved this behavior on October 29, 2026. Grayscale and color bases, opaque and translucent layers, a large rotated layer, and a PDF conversion passed in the 1.45 native rendering/privacy group. Exact-commit CI and owner review of the synthetic comparison remain pending.
