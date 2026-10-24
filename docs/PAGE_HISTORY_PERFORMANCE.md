# Page-history performance

This checkpoint advances Milestone 1 / PERF-0 to PERF-5. It records native HTTP
Save/history responses and browser asset size, image paint, editor opening and
100-layer interaction measurements. Results qualify only the environments and
compositions described below; they do not certify every performance criterion.

## October 24, 2026 observations

Runtime: reviewed commit `c07ff0e`, MediaWiki 1.44.6, PHP 8.3 and MySQL 8.
Extension code, media, object cache and logs were on server-local disk; the
object cache was enabled. A new disposable wiki held the test owner. No ordinary
wiki or previously accepted owner was edited.

| Operation | Five observed responses (ms, sorted) | Median | Maximum | One-second server budget |
| --- | --- | --- | --- | --- |
| Save one changed property among 100 layers | 98, 100, 101, 103, 122 | 101 ms | 122 ms | Met in this scope |
| Serve the exact preceding revision through the historical special page | 97, 99, 114, 116, 447 | 114 ms | 447 ms | Met in this scope |

Timing includes loopback HTTP overhead and complete response receipt; it is an
upper bound for the server work in each request. Each Save added exactly one
native owner revision. Every new snapshot, unchanged main text, all 100 layers
and reading order were checked. Each historical response contained the complete
preceding surface and its exact revision, rather than newer layers.

The first historical response is retained in the five samples. Caches were not
cleared; these are serial observations on a warm server, not a formal cold-cache
experiment. The initial untimed publication took 198 ms. Setup created one new
main revision and six layer-set revisions, all on the new disposable owner.

## Repeating the measurement

The existing `npm run bench` suite remains the broader repository benchmark.
Provision its explicitly authorized fixture first; do not point a write
benchmark at ordinary content. For this narrower server measurement:

1. Copy a completed test wiki into an isolated database/uploads/configuration
   boundary and verify the exact candidate source and original data.
2. Create one disposable owner containing a slide with 99 rectangles and one
   textbox. Publish and verify the complete 100-layer initial snapshot.
3. Make five serial one-property edits through the native publication API using
   real authorization, CSRF and exact base revisions. Time each complete response.
4. Read back every saved slot and request the exact preceding revision through
   `Special:ViewLayersPage`. Time its response and verify the embedded historical
   initialization against the preceding complete surface.
5. Preserve individual timings, compare all original rows and sources, and
   confirm that only the disposable owner's planned revisions were added.

No successful Save is repeated to repair an observer. The first sample here was
retained after correcting a harness expectation: native historical HTML uses
`no-cache, no-store, max-age=0`, without the literal `private` directive.

## Browser observations — October 24, 2026

The published candidate `c257243` has the same application runtime as the server
measurement above. A separate disposable copy retained all 24 existing revisions,
including the complete 100-layer owner. One new image owner added two fixture
revisions: its main text and one layer-set publication with a known-color rectangle.
No browser Save was performed. Changes made during interaction testing were
discarded through the normal Close dialog; all original owner rows stayed exact.

Browser: headless Chromium 145.0.7632.6 on Windows, AMD Ryzen 7 3700X, 32 GiB RAM,
1920 × 1080 viewport. MediaWiki 1.44.6, PHP 8.3, MySQL 8, enabled object cache and
server-local code/media/cache/logs were retained. This desktop is not the charter's
mid-range-laptop reference device. Caches were not deliberately cleared.

| Check | Observed result | Existing budget | Result in this scope |
| --- | --- | --- | --- |
| Layers modules on an image page | 97,658 bytes transferred with actual HTTP gzip | At most 150 KB | Within budget |
| Plain page | No Layers modules loaded and no Layers module requests | None | Within budget |
| Image load to known layer pixel, five warm visits | 93.2, 93.2, 94.8, 94.8, 99.8 ms; median 94.8 ms | At most 300 ms | Within budget when warm |
| First browser visit in the complete normal-Close run | 409.1 ms after image load | At most 300 ms | Exceeds budget; remains open |
| Edit overlay to ready editor, five warm openings | 187.15–201.46 ms; median 192.67 ms | At most 3 seconds | Within budget |
| First editor opening in that run | 495.07 ms | Warm target is 3 seconds | Reported separately |
| Drag, resize, pan with 100 layers | 60.5, 60.5, 60.0 frames/second respectively | At least 50 frames/second | Within budget in one sample per operation |
| Twenty typed characters | Median 2.2 ms; maximum 16.4 ms | Each at most 50 ms | Within budget |

The asset result requests the exact five Layers modules that became ready on the
image page, separately from core/skin dependencies. The raw HTTP response used
`Content-Encoding: gzip`; the number is compressed body bytes, excluding headers.
The plain-page check used a separate page, rather than counting modules left ready
in the image page's JavaScript environment. This does not establish the separate
criterion that nothing added by Layers blocks rendering.

Image timing begins at the native image's actual load event and ends when a frame
callback first reads the expected opaque rectangle color from the layer canvas.
It does not substitute API completion for painting. Module and native layer-read
resource timings were retained. In the 409.1 ms first visit, the core ResourceLoader
startup response took 144.3 ms, the combined core/skin/extension script response
155.4 ms and the native layer read 37.2 ms. Their sequential startup contributes
to the delay; these numbers do not attribute all of it to Layers.

The initial exploratory visit took 2,024.6 ms while fresh server assets were being
prepared. Another exploratory first visit took 274.4 ms. These observations remain
recorded and are not replaced by the warm median. First-visit PERF-2 is not closed.

Editor readiness requires the actual instance, initialized page-owned drafts,
expected layer count and a displayed canvas. The complete measurement uses normal
Close between openings. An earlier observer navigated away abruptly, accumulating
draft candidates; the recovery choice then correctly prevented the readiness
condition from finishing. That interrupted run is retained separately and does
not establish an editor-load defect or authorize bypassing recovery.

Interaction testing uses the existing benchmark's unchanged two-second motion
functions and confirms actual position, dimensions and pan offsets changed.
Typing starts with an empty inline textbox; each key is observed through the
visible editor and the following frame, and all twenty characters must reach the
layer. These are synthetic pointer events and headless frame observations, not a
physical display or touch-device measurement.

### Repeating the browser measurement

1. Use an isolated copy with verified candidate source, local files and enabled
   cache. Retain original rows and keep ordinary wikis outside its configuration.
2. Add one disposable image embed with an exact-version source and a solid-color
   rectangle at a known canvas coordinate. Retain its complete saved snapshot.
3. Observe the native image load event and poll the expected painted pixel from
   animation frames. Record the first visit separately from five warm visits,
   including ResourceLoader and native-read timing entries.
4. Press the normal Edit overlay and wait for drafts, expected layers and visible
   canvas. Close normally before the next observation; do not navigate away and
   treat a recovery choice as startup time.
5. Request only the loaded Layers modules with gzip and count raw response bytes.
   Check a separate plain page for both loaded modules and Layers requests.
6. Reuse the existing 99-rectangle/one-textbox composition and benchmark motion
   functions. Verify actual movement, resizing, pan changes and complete typed
   text. Discard temporary interaction edits through the normal dialog.
7. Compare all original rows, owner revisions and installed source after testing.
   Preserve unsuccessful observations alongside complete results.

## Limits

The server results and the browser cases above are bounded measurements.
First-visit image rendering remains over budget in retained observations.
Twenty-layer-set deferral/long tasks (PERF-6), image-data reuse across revisions
(PERF-7), physical devices, large PDFs and worst-case layer compositions are not
qualified by this checkpoint. Earlier development shared-folder timings are a
separate environment comparison. No charter target or reference-device requirement
has been changed.
