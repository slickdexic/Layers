# Check saved page control

The project owner approved the [existing revision-check action](EARLIER_CREATION_RECOVERY_FLOW.md)
in a bounded bottom bar on October 27, 2026: “Approve the proposed bar”. This
advances the independent page-history release / HIST-4, DATA-1, UI-1 and UI-8.

The existing **Check saved page** button remains available in ready page-owned
editors, including PDF creation. Its action, wording, status messages, recovery
and authorization behavior are unchanged. It never saves automatically.

The bar sits below the workspace and the button is at least 44 pixels high.
The workspace fits the remaining height. Status text wraps as space permits;
the bar is capped at 96 pixels or one quarter of viewport height, with a
45-pixel minimum so the button remains usable. Longer messages scroll in a
keyboard-focusable live status. Light/dark colors and visible focus follow the
editor. Canvas fitting updates when the workspace changes size; explicit zoom
and pan state are retained.

Four installed MediaWiki 1.44 browser cases exercise image, slide and PDF
editors at desktop, tablet and narrow widths, including dark styling and
emulated touch. Each runs the actual revision check, retains the exact owner,
revision and saved layer IDs, tests a long keyboard-scrollable status, and
closes cleanly to the owner without a Save. A separate native case verifies
nonzero pan and zoom across expansion. Focused recovery tests also cover
observer cleanup and the no-ResizeObserver fallback. These are bounded browser
results; PDF creation was covered by focused tests rather than these four
browser cases. Physical-device and manual screen-reader acceptance remain open.
