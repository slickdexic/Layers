# Slide loading message: proposed behaviour

**Status:** Approved by the project owner October 27, 2026. Advances UI-10 and HIST-4.

## Reader experience

While a page-owned slide is loading, show no error or other visible text in its
place. Once it loads, show the same slide and existing overlays as today. If
the authorized read or rendering actually fails, show the existing localized
unavailable or rendering-failure message. If JavaScript is disabled, retain the
existing unavailable message as a fallback. No page, revision, or layer-set
details are added to the page.

## Editor experience

Editing and the existing Edit layers and View full size controls stay the same.
This proposal changes only the temporary slide placeholder and its handling of
actual failure; it does not change permissions, exact-revision selection, saved
content, image or PDF behavior.

## Verification

Check loading, successful rendering, actual read and render failures, disabled
JavaScript, multiple slides, historical revisions and existing overlays. Show
the owner the implemented behavior before calling the change complete.
