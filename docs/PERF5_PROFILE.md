# PERF-5 targeted profile — September 30, 2026

This report separates the extension's measured PHP stages from browser-visible request time. It profiles a 100-layer image layer set on the original test wiki at `localhost:8080`; Docker is only the test environment. The samples do not characterize a production Linux installation.

## Method and scope

The Playwright profile `tests/perf/j105-perf5-profile.spec.js` seeded one 100-layer surface (99 rectangles and one textbox), then made five serial one-property edits. Each measured publication changed one rectangle's `strokeWidth`. After each save it opened the immediately prior revision in `Special:ViewLayersPage`. The first measured pair is labeled **first post-seed**; caches were not forcibly cleared, so it is not claimed as a cold-server sample. Runs 2–5 are repeat samples, not proof that every relevant cache was warm.

A temporary header-gated PHP probe measured only requests carrying `X-Layers-Perf5` on the exact publication POST or historical-view GET. Untagged requests produced no records. The probe and all production-file instrumentation were removed after collecting the five pairs. Server timings below are milliseconds. For nested methods, inclusive time contains children; exclusive time subtracts the children that this probe also measured. Do not add nested inclusive rows together.

## Browser-observed timings

| Run | Cache characterization | Publish request wall | Old-view TTFB | View response body | Canvas visible |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | First post-seed; cache not forcibly cleared | 1,511.53 | 1,295.39 | 50.52 | 9,771.11 |
| 2 | Repeat sample | 1,497.79 | 1,006.86 | 40.58 | 9,393.71 |
| 3 | Repeat sample | 1,530.35 | 1,003.48 | 55.54 | 9,386.53 |
| 4 | Repeat sample | 1,599.50 | 1,039.59 | 45.35 | 8,420.71 |
| 5 | Repeat sample | 1,496.94 | 994.70 | 46.56 | 8,360.16 |
| **Median** |  | **1,511.53** | **1,006.86** | **46.56** | **9,386.53** |
| **Range** |  | **1,496.94–1,599.50** | **994.70–1,295.39** | **40.58–55.54** | **8,360.16–9,771.11** |

Publish request wall and view TTFB exceed one second on this host, but they include work outside the instrumented extension methods. The canvas-visible duration includes navigation, page/client startup, source loading and layer painting; it is not a server-only rendering measurement.

## Publication PHP stages

| Stage (inclusive unless marked exclusive) | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `ApiLayersPublish.execute` inclusive | 217.073 | 222.022 | 227.434 | 208.855 | 214.754 | 217.073 | 208.855–227.434 |
| `ApiLayersPublish.execute` exclusive | 41.026 | 38.823 | 42.665 | 38.016 | 39.483 | 39.483 | 38.016–42.665 |
| `ServerSideLayerValidator.validateLayers` (all calls) | 3.800 | 4.460 | 3.987 | 3.700 | 3.897 | 3.897 | 3.700–4.460 |
| `DocumentSchema.canonicalize` inclusive (all calls) | 14.203 | 14.859 | 16.349 | 13.866 | 14.679 | 14.679 | 13.866–16.349 |
| `DocumentSchema.canonicalize` exclusive (all calls) | 8.823 | 8.807 | 10.785 | 8.670 | 9.164 | 8.823 | 8.670–10.785 |
| `JsonSnapshotCodec.encode` (all calls) | 1.927 | 1.935 | 1.933 | 1.837 | 1.961 | 1.933 | 1.837–1.961 |
| `PageHistoryAccess.getStoredSurfaces` | 42.362 | 42.133 | 42.910 | 42.708 | 44.296 | 42.708 | 42.133–44.296 |
| `SourceVersionResolver.resolve` | 4.444 | 4.273 | 4.272 | 3.993 | 4.084 | 4.272 | 3.993–4.444 |
| `PageRevisionWriter.save_cas_and_page` inclusive | 121.191 | 128.416 | 127.184 | 116.152 | 118.134 | 121.191 | 116.152–128.416 |
| `PageRevisionWriter.save_cas_and_page` exclusive | 75.216 | 79.672 | 82.642 | 73.998 | 75.707 | 75.707 | 73.998–82.642 |
| Native `PageUpdater.saveRevision` inclusive (nested) | 42.875 | 45.504 | 41.453 | 39.015 | 39.195 | 41.453 | 39.015–45.504 |
| Native `PageUpdater.saveRevision` exclusive | 39.477 | 41.922 | 38.239 | 35.932 | 36.161 | 38.239 | 35.932–41.922 |

The validator runs six times per publication (two surfaces through three canonicalization passes); the table sums those calls. Encoding is measured separately. Hashing was not exposed as a distinct stage by this probe and is not assigned a fabricated duration. Likewise, `LinksUpdate`, search indexing, and job-queue subphases are not independently timed; the native save row measures the enclosing synchronous `PageUpdater.saveRevision()` call, including only the work it performs or schedules synchronously.

## Historical-view PHP stages

| Stage (inclusive unless marked exclusive) | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `SpecialViewLayersPage.execute` inclusive | 560.008 | 326.234 | 320.500 | 331.397 | 321.162 | 326.234 | 320.500–560.008 |
| `SpecialViewLayersPage.execute` exclusive | 331.585 | 304.838 | 299.694 | 309.584 | 299.389 | 304.838 | 299.389–331.585 |
| `PageReadService.read_and_bundle` inclusive | 223.231 | 16.086 | 15.618 | 16.344 | 16.020 | 16.086 | 15.618–223.231 |
| `PageReadService.read_and_bundle` exclusive | 0.269 | 0.233 | 0.214 | 0.215 | 0.200 | 0.215 | 0.200–0.269 |
| `PageHistoryAccess.read_slot` (all three reads) | 16.289 | 14.378 | 14.009 | 14.857 | 15.160 | 14.857 | 14.009–16.289 |
| `SourceVersionResolver.resolve` | 4.020 | 3.081 | 3.233 | 3.031 | 2.977 | 3.081 | 2.977–4.020 |
| `SourceRenditions.forSurface` | 207.309 | 3.134 | 2.880 | 3.178 | 2.963 | 3.134 | 2.880–207.309 |
| `JsonSnapshotCodec.encode` (all calls) | 0.535 | 0.570 | 0.469 | 0.533 | 0.473 | 0.533 | 0.469–0.570 |

The first post-seed source-rendition stage took 207.309 ms; repeat samples took 2.880–3.178 ms. This is consistent with a first-use rendition/file cost followed by cached access, but the run did not clear all caches and cannot establish a globally cold condition. `SpecialViewLayersPage.execute` exclusive time is the measured remainder after nested extension stages, not a decomposition of MediaWiki output rendering internals.

## Findings and next steps

The measured extension sections are below PERF-5's one-second target: publication `ApiLayersPublish.execute` took 208.855–227.434 ms, and the historical-view `SpecialViewLayersPage.execute` took 320.500–560.008 ms. This does **not** establish that the full server request meets PERF-5. Browser publish time was 1.497–1.600 s, view TTFB 0.995–1.295 s, and the canvas became visible after 8.360–9.771 s. The unmeasured MediaWiki request bootstrap/dispatch and client startup/painting prevent a complete end-to-end server attribution. The available evidence is insufficient to mark PERF-5 met or to justify a production optimization.

The largest actionable measured stages and their tradeoffs are:

1. The first source rendition resolution (207 ms) is worth profiling across actual formats and cache states. A cache may reduce repeats, but a cache key or reuse rule that omits immutable file-version identity or permission checks could show the wrong source or bypass access rules.
2. The compare-and-save path took 116–128 ms inclusive, with the native save taking 39–46 ms inside it. Reducing reads or simplifying writes could lower cost, but changing compare-and-swap boundaries risks lost edits and broken page-revision history; preserve the current concurrency and slot invariants.
3. Stored-surface lookup took 42–44 ms per publication, while the three viewer slot reads together took 14–16 ms. Fewer database/slot reads may help, but any cache must remain revision-, page-, and permission-aware or it can return stale or cross-owner layer sets.

The much larger browser-visible gaps (the roughly 1.3 s between client publish wall and measured API execution, and the multi-second canvas-ready interval) are not attributed to a specific extension stage here. The next useful evidence would be request-wide PHP/MW timing plus browser ResourceLoader, source load and paint spans on a reference installation. Do not add speculative caching or duplicate API requests to chase the current host measurements.

## Cleanup and verification

The test restored the automation owner by compare-and-swap and created its cleanup revision rather than deleting history. A separate read-only query confirmed page ID **228**, latest revision **2702**, exact original main text, and snapshot equality with the original single `presentation` layer set. The temporary probe helper, nine temporary PHP instrumentation edits, and container JSONL log were removed. No application production changes remain from J105.

Measured command: `npm run bench -- j105-perf5-profile.spec.js` — **1 test passed**, five serial publish/view pairs, exit code 0. Other J105 checks and documentation updates are recorded in the handoff plan and junior review ledger.
