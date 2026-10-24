# Page-history server performance

This checkpoint advances Milestone 1 / PERF-0 / PERF-5. It measures native HTTP
Save and historical-page responses for a layer set containing 99 rectangles and
one textbox, using the existing benchmark's 100-layer composition.

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

## Limits

These results qualify the measured server component. Browser paint, editor
responsiveness, physical devices, large PDFs, embedded-image payloads and
worst-case layer compositions are not measured here. They do not declare every
charter performance criterion complete. Earlier development shared-folder
timings are a separate environment comparison, not this reference result.
