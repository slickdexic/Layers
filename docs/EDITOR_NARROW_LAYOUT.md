# Narrow editor layout

The project owner approved this repair on October 23, 2026: “Approve the bounded
layout repair”. It advances Milestone 1 and UI-10 by keeping the existing editor
controls and canvas usable at narrow widths.

At viewport widths up to 768 pixels, the existing header controls wrap in their
current document order. Import, the layer set name and Rename, Copy from another
page, Summary and Close remain available. Each control group stays together;
the Summary input fits the available row. No wording or action changes.

The existing layer panel sits above the full-width canvas. Its mobile heights
and collapse/expand control remain; the canvas uses the remaining height.
The existing toolbar reflow, every tool and keyboard shortcut stay intact.
Wider viewports retain their previous arrangement. Wiki-page content, overlays,
viewers, publication and recovery safeguards are unchanged.

The repair uses the current workspace container for the existing mobile stacking
rule, adds viewport-based header wrapping and removes the panel's desktop width
limit at narrow widths. It adds no JavaScript observer or alternative Save path.
The existing resource-size limits remain unchanged.

Native MediaWiki 1.45.3 browser checks cover image, slide and two-page PDF editors
at 390 × 844, with the 768/769-pixel boundary checked separately. Each type saves
one owner revision, returns to its owning page and reopens through its overlay.
Controls retain their order; the existing panel collapse/expand and keyboard
activation work. Native source, geometry, siblings and main text are preserved.
Fresh wide layouts are compared with the preceding source. The existing raw
resource budgets and style/documentation gates remain unchanged.

Mounted development styles can remain cached until MediaWiki's five-minute
startup-resource manifest refresh. Debug resource loading confirmed the changed
source while that expired; normal resource loading is checked separately. No
drafts or browser storage are cleared to refresh styles.

Browser viewport checks do not claim physical touch-device or overall release
acceptance. Supported-version, upgrade, security/privacy/performance and owner
acceptance remain part of the existing Milestone 1 release checklist.
