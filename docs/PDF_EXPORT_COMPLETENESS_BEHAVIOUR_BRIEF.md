# Server PDF export completeness

**Owner approved October 28, 2026; implementation and acceptance in progress.**
Advances DATA-1 and UI-10.

PDF export keeps the existing Download action and complete PDF output. If a
required page or its saved layers cannot be rendered, the export reports the
existing PDF export failure and delivers no incomplete file. A page with no
saved layers still exports its unmodified background normally.

When the renderer does not support a saved layer type, export must not silently
hide that fact on a cached download. Preserve the existing incomplete-export
warning when it can be accurately produced; otherwise refuse instead of
presenting an incomplete PDF as complete. Do not remove any layer, change a
saved page, or weaken source access checks. Page-owned client export remains
available through its existing path.

Test a failed middle page, failed compositing, unsupported layer types, repeated
requests and successful complete exports. Show the result to the owner before
declaring the change complete.
