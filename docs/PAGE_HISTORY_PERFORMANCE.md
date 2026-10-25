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

## Controlled first-visit follow-up

The earlier fixture enabled full MediaWiki developer logging. A separate copy
compared that setting with `$wgDebugLogFile = false`, retaining dedicated Layers,
PHP-error and database-error logs. Source, data, permissions, quotas and cache
settings stayed the same. The server was warmed once, then each observation
used a fresh browser context. Modes were counterbalanced across ten observations.

| Logging mode | Five fresh-browser paint delays (ms) | Median | Maximum |
| --- | --- | --- | --- |
| Full developer logging | 350.2, 274.5, 271.1, 268.9, 255.2 | 271.1 ms | 350.2 ms |
| Production general logging | 264.3, 272.7, 258.7, 258.9, 254.5 | 258.9 ms | 272.7 ms |

All five production observations were within 300 ms on this desktop. Full logging
added 380,754 bytes across its five observations; production observations added
none to that general log. The median difference was only 12.2 ms, so logging alone
does not explain every earlier slow visit. The first server warm-up, with full
logging, took 1,997.1 ms and remains recorded separately. No production cold-server
result or complete PERF-2 acceptance is claimed, and no application loading change
was justified by this comparison. All seventeen witnessed tables and all 26 source
revisions remained exact; there were no content edits or browser Saves.

### Reusable read-only reader benchmark

`npm run bench:native-read` runs
[native-reader.spec.js](../tests/perf/native-reader.spec.js). Without
`LAYERS_NATIVE_PERF_CONFIG` it skips before launching a browser. The configuration
must identify a disposable loopback HTTP wiki, its exact wiki ID, owner page ID and
revision, plus an opaque known-color pixel in a saved image layer set. Ordinary
development ports 8080/8081 and the default HTTP port are refused before fixture
requests. Do not reuse the broader write benchmark's ordinary-content fixture.

Keep configuration and authenticated Playwright storage state outside published
source. Set `LAYERS_NATIVE_PERF_CONFIG` to a private JSON file shaped as follows;
the owner must contain one image embed with the stated probe pixel:

```json
{
  "disposable": true,
  "base": "http://127.0.0.1:8099",
  "wikiId": "layers_performance_fixture",
  "owner": "Performance image",
  "pageId": 10,
  "revision": 20,
  "probe": { "x": 50, "y": 50, "rgba": [216, 25, 171, 255] },
  "storageState": "/private/native-perf-state.json"
}
```

Use production settings and a pre-created fixture; the benchmark never provisions
content, changes settings or Saves. Browser requests are restricted to GET on the
fixture origin. The test verifies wiki/owner/revision identity, the actual native
image load, authorized native layer-read timing and the expected canvas pixel.
It retains one warm-up and five fresh-browser observations, including failures,
and applies the unchanged 300 ms budget to all five warm-server samples. Point
Playwright's `--output` at a private results directory to retain its attachments.
Authenticated storage state is optional only for an anonymously readable fixture.

The final maintained test passed five observations at 296.0, 273.8, 275.5, 286.0
and 287.7 ms. Its request guard adds observation overhead; these remain separate
from the comparison above. No-configuration skipping and ordinary-port refusal
were also checked. The same host/device and cold-server limitations still apply.

## Offscreen slide rendering

The native twenty-set check reproduced eager painting of all twenty slide sets,
including eighteen outside the desktop viewport. Inline vector/text slides now
defer painting until they enter the viewport or receive keyboard focus. Their
canvas dimensions and both overlay buttons are present immediately. Authorization,
the exact saved snapshot and the existing batched read remain unchanged.

| Native check | Result |
| --- | --- |
| Desktop, 1280 × 800 | Two sets painted initially; no offscreen sets painted |
| Narrow viewport, 390 × 844 | Three sets painted initially; no offscreen sets painted |
| Traversal | All twenty sets painted correctly when visited, at both widths |
| Layout and controls | Original dimensions and both buttons retained on all twenty hosts |
| Browser tasks | No task of 50 ms or longer reported in either positive traversal |
| Observer control | A deliberate 240 ms page-timer task was detected and correctly exceeds the 200 ms budget |
| Keyboard and page-print preparation | Focus starts the selected slide synchronously; `beforeprint` prepares every pending vector slide |
| Full-size Print preparation | Exact selected owner/revision, complete 400 × 300 image, text and colored layer verified |

The existing benchmark's PERF-6 section now checks that offscreen canvases are
unpainted, visits each host, and then retains its all-twenty-painted assertion
before reading task entries. Waiting for all offscreen slides to paint without
visiting them would contradict deferral. The broader write benchmark was not
run against ordinary content for this correction.

The scheduling change is limited to ordinary inline slides without image or
custom SVG layers. Image/PDF sources and slides containing those asynchronous
assets keep their existing eager preparation. Dedicated history/diff views,
full-size viewing and export preparation keep their existing rendering paths.
Missing or failed viewport observers fall back to immediate painting. Disposal
cancels pending callbacks and releases an activated renderer once.

These results qualify the recorded twenty-slide case. They do not close all-media
PERF-6, large-PDF or reference-device qualification. Full-size Print was exercised
through actual composition; only the final print transport was intercepted.
Physical printing and the operating-system dialog remain outside this result.

The affected first-visit reader check also retained over-budget samples. One
candidate run measured 346.1, 279.8, 286.1, 306.1 and 291.0 ms; the prior-code
comparison measured 284.1–299.7 ms, and the restored candidate measured
280.0–346.6 ms. These serial observations do not establish whether the outliers
are caused by the change. Image and dedicated-history rendering retain the
original direct call in the final dispatch. First-visit PERF-2 remains unqualified;
none of these slower observations or the 300 ms target was removed.

### Cache-preserving reader measurement

The October 24 follow-up found measurement overhead in the native-reader test.
Playwright routing disables HTTP caching: every intercepted visit downloaded
the same source image twice. Five counterbalanced ordinary-browser visits took
261.4–287.1 ms (median 270.7 ms), with one image transfer each; intercepted
visits took 291.2–302.8 ms (median 295.0 ms), with two transfers each. These are
separate observations on unchanged application code, not a product speedup.
The original routed run's 288.6–364.5 ms samples remain retained.

The maintained Chromium benchmark now admits page requests through native
Fetch interception without changing cache settings. It retains exact-origin
GET-only admission before navigation, blocks service workers and rejects
unexpected pages, frames or workers. It is a single-page image benchmark;
other execution targets require their own admission before extending its scope.
All existing fixture, identity, pixel, sample and 300 ms checks remain.

A second counterbalanced comparison measured 265.0–275.2 ms with the native
guard and one image transfer, versus 274.2–290.2 ms with Playwright routing
and two transfers. Live loopback controls prove same-origin GET and cache reuse,
refuse POST and foreign/redirected origins before server receipt, and force a
second transfer when caching is deliberately disabled. Copied-source controls
also fail when method admission is removed or caching is disabled.

The corrected maintained test passed five fresh-browser contexts at 285.6,
295.5, 273.3, 269.9 and 268.7 ms, each with one source-image transfer and no
guard violations. Its server was warmed separately. This qualifies the recorded
desktop/warm-server case only; cold-server and reference-laptop acceptance remain
open. A failed attempt to restore caching through an additional CDP session did
not remove duplicate transfers and was not adopted. No application runtime,
permissions, quota, source selection, UI or performance target changed.
