# Authorized historical asset delivery: L02 decision record

## Layers is a MediaWiki extension — Docker is only the test environment

**Layers is a MediaWiki extension. It is not Docker-based. Docker is used only to host our development/test MediaWiki installation.** Docker, containers, PowerShell, .NET, host supervisors and container orchestration are not Layers runtime architecture, deployment requirements or feature backends. Do not add them as required or optional Layers capabilities.

The container-supervisor direction was an engineering mistake and is **abandoned, not paused**. J35 and the associated container dispatch/recovery milestones are cancelled, not blockers for page history. Earlier prototype code and test records are retained solely as records of abandoned work, not as approved implementation or an optional-backend proposal. Their test counts are not progress toward a deployable MediaWiki feature.

All active work must use MediaWiki extension mechanisms and respect the supported MediaWiki/PHP/database environment and normal media-handler requirements. Revision history, search, Cargo integration and image/PDF/slide support must not depend on this project's test-host setup. This rule overrides every earlier supervisor/container instruction in this document.

September 12, 2026. **Private renderer and authorized preparation service implemented and core-tested; the staging path validator is implemented; resource admission, production configuration wiring and HTTP transport remain unimplemented.** The [internal reader](PAGE_OWNED_READ_CONTRACT.md) and exact source resolver already have core evidence. They do not make a normal file/thumbnail URL safe for owner-revision-controlled delivery.

## Decision: core renditions of the exact pinned version — September 26, 2026

This supersedes the private-renderer boundary below. Image and PDF surfaces are displayed from MediaWiki's own rendition of the exact file version the surface is pinned to, obtained with `File::transform()` on the resolved `LocalFile`/`OldLocalFile` (`src/Revision/SourceRenditions.php`, at most 2048 px wide). The read bundle carries that URL and its display size; the viewer scales it to the surface canvas and draws the layers over it.

Why:

- **It is the supported mechanism.** Core already serves every file version, archived ones included, to anyone who can read the File page (the file history table links them). A Layers URL is never more than core would show that reader.
- **Protection follows the wiki.** On a private wiki the URL is whatever core issues, for example an `img_auth.php` URL that re-checks read permission on every request. Layers adds no bearer URL and no second delivery path.
- **Hiding a version is core's job.** When a version is revision-deleted or the file is deleted, core moves its bytes out of the public zone and purges its thumbnails; the resolver also stops returning a rendition, because it refuses hidden, deleted or mismatched versions.
- **Resource limits are core's.** Thumbnails go through core's pipeline (`$wgMaxImageArea`, shell limits, PoolCounter for on-demand rendering). The private renderer needed its own budgets, deadlines and concurrency control, which is what led to the abandoned supervisor work.

The URL is produced only after the reader is authorized for the owner revision and the source version (`SourceVersionResolver`), and only inside `layersread`'s private, uncached response. Page HTML still carries identities only. The viewer loads only `http(s)` URLs and never reads pixels back. `PageAssetService`, `PrivateRasterRenderer`, `PrivateStagingDirectory` and `SourceRenderAdmission` stay unregistered and are superseded; their tests remain as evidence about core media handlers.

Remaining work: bound file embeds on page views, the page-owned editor for image/PDF surfaces, and adoption of file embeds. Everything below this section is historical.

## Chosen boundary

The first delivery path will produce a private raster rendition of an exact image or PDF surface and stream it only through an authorized request. Standalone slides need no source delivery; the viewer draws their stored canvas/layers. Images and PDF pages use the same owner, revision, surface and permission policy. This path does not export annotated slides or burn annotations into source thumbnails.

Do not return a current file URL, an archived file URL, a public thumbnail URL, a redirect to one, or a reusable bearer URL as the historical delivery mechanism. A public derivative can outlive the permission checks that created it. Private rendering must not write a derivative into a public repository/thumb directory, even temporarily.

## Input and identity

The future request supplies an owner identity, explicit positive revision ID, exact surface ID, and positive requested pixel width. Source filename, timestamp, hash, page, MIME and source path come exclusively from the authorized stored snapshot and resolved File. Reject caller-supplied source/path/page overrides; do not infer latest or repair a missing identity.

Start with a maximum output side of 4096 pixels and maximum area of 16,777,216 pixels as **proposed internal proof limits**, not existing public configuration. Clamp neither identity nor invalid dimensions silently. Normalize geometry with the installed MediaHandler and validate the normalized output against the limits before rendering. Preserve aspect ratio and source-page rotation/crop behavior; returned actual output width/height, rather than requested width alone, governs viewer placement. A separate lead decision is required for input-size/time/concurrency budgets before HTTP enablement; pixel limits alone do not bound PDF processing cost.

Authorization binds owner + revision + surface + pinned source identity + normalized rendition parameters. The initial implementation keeps the reader's all-or-nothing document policy: if another required source makes the bundle unavailable, the delivery request also fails. Per-surface degraded rendering is deferred and must not be introduced accidentally.

## Rendering and lifetime

The lead will implement an internal private renderer and an orchestration service before any HTTP registration:

1. Authorize the owner and exact revision using the original Authority. Validate the document and exact sources. Locate the requested surface; reject a missing surface or a source-delivery request for a slide.
2. Create a uniquely owned temporary artifact outside the web root and every public repository zone. Caller text must not participate in its path. Keep the artifact within the operation's lifetime; return neither paths nor renderer objects to a transport response.
3. Invoke the installed MediaHandler with the exact resolved File, pinned page and explicit private output destination. Render synchronously. Do not call the normal public-thumbnail convenience path or schedule a public thumbnail job.
4. Inspect the resulting artifact. Only successfully decoded PNG/JPEG raster output is initially deliverable. Validate actual MIME, size and dimensions. Do not serve raw SVG, PDF, HTML, an error page or a handler-supplied URL. Native-size PNG/JPEG is the explicit exception to requiring a newly resampled derivative: copy only matching-size raster bytes into private staging and apply the same size/MIME/full-decoding checks. Never stream the original path or redirect to it; native bitmap metadata may remain intact. Bitmap and SVG handler support must be demonstrated individually; a PDF-only proof is insufficient.
5. Immediately before streaming, reauthorize the owner/revision and source with the same Authority. Confirm that the source still matches the pinned identity and is visible/available. Reject changed visibility or missing bytes, even if a private derivative was already produced.
6. Stream the checked raster bytes, then release the artifact in `finally`. Failure, cancellation, transform exceptions and permission denial must also release it. Cleanup must touch only operation-owned artifacts; no directory-prefix sweeps.

No shared derivative cache in the first implementation. Any later cache needs source identity, page, rendition parameters, handler/configuration version and an authorization gate on every retrieval; a matching cache key alone is never permission to read. A final check cannot retract bytes already transmitted if permissions change during streaming. Document this ordinary request-time limitation rather than promising instantaneous revocation of delivered content.

## Installed-core evidence and prototype obligations

Read on MediaWiki 1.45.3: `includes/media/MediaHandler.php` exposes `doTransform(File, destinationPath, destinationUrl, params, flags)`. `extensions/PdfHandler/includes/PdfHandler.php::doTransform` normalizes parameters, checks the page, obtains `getLocalRefPath()` from the supplied File, and writes to the supplied destination. It can return transform errors or deferred output instead of rendered bytes. Its source inspection supports a private-destination prototype; it is not proof that every installed handler is safe to call this way.

`includes/filerepo/file/File.php::transform` belongs to the normal thumbnail pipeline and must not be assumed private. The prototype must prove that the selected handler never redirects, copies an original into a public zone, schedules deferred work, or exposes a temporary path through error handling. Use core rendering infrastructure and its resource controls; do not create a second shell-command renderer.

## Transport contract to prove later

The HTTP adapter remains gated on the private renderer and disposable test wiki. It must authenticate normally and reauthorize each request; no bearer bypass. Responses add `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`, with verified raster Content-Type. Do not emit public ETags, redirects, internal filenames or raw exception text. Authentication, unavailable content, malformed input, resource exhaustion and rendering failure need deliberate stable status/error mapping before the adapter contract is frozen. No range/conditional request shortcut may bypass authorization.

MediaWiki annotation text may contain user-authored links; this service adds no source-delivery URLs to the stored document. A future viewer may request its authorized delivery route, but no such viewer wiring exists yet.

## Implemented private renderer contract

`PrivateRasterRenderer(TempFSFileFactory $temporaryFiles, string $decoder)` is an internal primitive. The trusted factory must point outside all served directories/public repository zones; the trusted decoder is the configured ImageMagick convert executable. Neither dependency can come from request input. This component does not authorize its File argument; only the future authorized orchestration service may expose its results to a client.

`render(File $file, int $page, int $width)` takes an already-resolved exact source and returns `mime`, actual integer `width`/`height`, and bounded `bytes`. It adds no URL or path and purges its own artifact before returning. Limits are 4096 per output side and 8 MiB encoded output, with normalized handler physical/logical dimensions also checked. Current MIME support is PNG, JPEG, SVG and PDF input, with PNG/JPEG output only. Unsupported handlers and client/deferred behavior fail explicitly.

The implementation calls `MediaHandler::doTransform` directly with the private destination, never `File::transform`. Core native-size PNG/JPEG results are privately copied, preserving quality; other original/client-output cases fail. `getimagesizefromstring` verifies header/type/dimensions, followed by a complete ImageMagick decode through core Shell. Decoder diagnostics remain internal; only stable `layers-render-unavailable` failures are generated here. Unexpected infrastructure exceptions remain for future safe transport mapping. An inability to delete an existing artifact raises `layers-render-cleanup-failed`; cleanup failure is not silently accepted.

The result is bounded in-memory bytes, not an open streaming artifact. The L02b preparation service now performs final authorization after rendering; an immediate transport handoff is still unimplemented. Input-size, execution/concurrency limits, private-directory configuration validation and HTTP mapping are still enablement gates. Existing core shell limits are used; output pixel/byte limits alone do not prove a total resource budget.

L02a checkpoint: **132 tests / 717 assertions** on MediaWiki 1.45.3 / PHP 8.3.31. Native PNG/JPEG, real SVG and two PDF page geometries render; output decodes and exact dimensions match. Success and decoder failure leave no owned staging artifact, and unrelated staging content survives. These tests do not yet prove every failure path or public-repository side effects across all handlers.

## Implementation order and exit evidence

1. **J29a, accepted with corrections:** real PNG/JPEG downsampling, persistent public/thumb inventory checks and fault probes. See the [review](JUNIOR_IMPLEMENTATION_REVIEW.md) for evidence and limits.
2. **L02b, lead:** internal exact-identity preparation and post-render rechecks are implemented (134 core tests / 767 assertions). Private-directory validation and resource/configuration policy remain open. The renderer alone cannot be exposed publicly.
3. **J29b, junior, implemented:** probes `PageAssetService::prepare` across exact revision/owner mismatch, hidden revisions, archived PDF page selection, whole-document pre/post-render policies, and mid-render suppression with empty staging (145 core tests / 1045 assertions). HTTP and resource/configuration gates remain lead-owned.
4. **Lead transport setup → J06 phase 2:** isolated HTTP registration and headers/error/security acceptance. No registration on the normal localhost wiki to make tests pass.

L02/gate A remain open. Import/undelete lifecycle isolation, retention, adoption and release gates remain separate and mandatory before a production history guarantee.

## L02b internal authorization boundary — September 12, 2026

`PageAssetService::prepare(owner, revisionId, surfaceId, width, authority)` is implemented without service or endpoint registration. It reads the exact authorized snapshot, rejects unknown IDs and source-free slides, resolves all required sources, and passes only the snapshot-selected File and page to the private renderer. After rendering and owned-artifact cleanup, it rereads the same revision, requires identical canonical content, and resolves all sources again with the original reader authority before returning the renderer's MIME/dimensions/bytes array.

Controlled domain failures normalize to `layers-asset-unavailable`. The previous exception is internal diagnostic context, never a public response body. Infrastructure and cleanup errors propagate for future transport handling. No cache or transport is implemented. This is an immediate preparation boundary, not a promise that permissions cannot change after return or after bytes have already been sent. Permission-backend cache freshness and separate database transaction visibility require transport/lifecycle acceptance; injected mid-render checks do not establish distributed revocation guarantees.

Core tests use real raster generation before revoking owner/source access, hiding the revision or deleting isolated source bytes, and require no returned result and empty owned staging. Allowed delivery succeeds; source-free slides and unknown IDs never invoke the renderer. Remaining lead work: validated private staging configuration, input/time/concurrency budgets, and disposable HTTP transport. J29a and J29b are complete (145 core tests / 1045 assertions); gate A remains open.

## Next lead decision packet: private staging and resource admission

Before adding transport, implement and test a dedicated configuration boundary. Require an explicit existing writable staging directory, resolve its actual filesystem location, and reject public document/repository roots and their descendants (including path aliases). The operator must supply every externally served alias; filesystem validation cannot infer reverse-proxy or web-server mappings. Do not silently fall back to system temp or create a public directory. Keep the factory/decoder configuration trusted and outside request parameters.

Define source byte and decoded-pixel admission limits separately from the existing output limits, including how a mixed document is charged. Reject invalid width before expensive source metadata/render work. Establish bounded worker concurrency and a hard render deadline using supported core execution facilities; a timeout that merely stops waiting while the process continues is insufficient. Account for both the transform and validation decoder, and any handler-created temporary files. Do not claim output-size checks alone prevent resource exhaustion.

Lead acceptance must cover rejected configuration without any artifact writes, canonical-path containment boundaries, capacity exhaustion, transform/decoder timeout with cleanup, and documented operator responsibilities. Freeze interfaces and measured limits before assigning additional junior implementation. This packet is design scope, not an implemented policy or authorization to enable HTTP.

J29b review clarification: suppression acceptance now updates isolated `oldimage.oi_deleted` to `DELETED_FILE | DELETED_RESTRICTED` after real raster generation while asserting that archived bytes remain. A separate provider case deletes archived bytes. Both preserve the current replacement source and withhold the result. This proves visibility re-resolution in the isolated core transaction; it does not exercise RevisionDelete UI, physical relocation by suppression workflows or cross-transaction invalidation.

## Lead staging validator — September 12, 2026

`PrivateStagingDirectory::createFactory(directory, publicRoots)` now implements the initial path boundary. Inputs are trusted operator configuration: an explicit existing absolute writable staging directory and a nonempty complete list of existing served document/repository/alias directories. Canonical `realpath` resolution catches symlink aliases and parent traversal; component-wise containment rejects equality, public descendants and staging parents of served roots while permitting similarly named private siblings. Unknown roots, relative paths, file-valued paths, NULs and wrappers fail with `layers-private-staging-invalid`. Validation creates no files or directories and never falls back to system temp.

The factory uses the canonical path. Initial tests cover a working private sibling, invalid/overlapping paths and a public symlink alias; real PNG/JPEG/SVG/PDF renderer acceptance now constructs its factory through this validator. The renderer still accepts a trusted factory directly; no production service/configuration is registered. Operators must provide every served root and control directory ancestors against replacement; this helper cannot discover reverse-proxy mappings or guarantee privacy after filesystem/web-server remapping. Linux core evidence does not establish Windows junction/ACL parity.

J31 configuration fault probes are accepted with lead corrections. The earlier lead decision packet's staging path primitive is now implemented, but complete configuration wiring and source/decoded-pixel admission, concurrency and hard deadlines remain open. Do not expose HTTP based on this helper alone.

## J31 review and cheap request admission — September 12, 2026

The staging tests now explicitly skip effective write-denial verification when the privileged runner can still write, and restore temporary directory permissions in `finally`. A separate disposable probe run as `www-data` on the installed Linux container confirms actual unwritable-directory rejection, the generic configuration error and no created artifacts. This does not establish Windows ACL/junction parity. The root-ancestor test derives its root from the fixture path, avoiding a hard-coded drive assumption.

`PageAssetService::prepare()` now rejects widths outside 1..4096 before revision reads, source resolution or rendering. It shares `PrivateRasterRenderer::MAX_SIDE` with the existing renderer checks; valid requests retain the existing authorization flow. The preflight exposes only `layers-asset-unavailable` and has no identity-dependent response. This bounds malformed-request work, not valid-source processing: decoded/source byte budgets, concurrency and hard deadlines still require lead implementation.

At the J31 checkpoint no further junior packet was ready. The subsequent source-admission implementation below opens J32; execution work still must freeze and implement source admission and execution capacity/deadline interfaces before delegating their acceptance probes. Existing J07–J15 and transport tasks retain their gates; do not start client wiring from these internal primitives.

## Source metadata admission — September 12, 2026

Implemented `SourceRenderAdmission::assertCanRender(File, page)` and invoked it from `PageAssetService` after whole-document source authorization, before rendering the selected source. Initial internal proof limits are 64 MiB per source file and 40,000,000 reported pixels for the selected page. Size must be a positive integer; page geometry must contain positive integer dimensions. Division avoids multiplication overflow. These conservative proof limits are not benchmark-derived production defaults or public configuration. No source is silently downsampled or substituted to pass admission.

The byte allowance applies to the entire pinned file, including a PDF whose requested page is small. Geometry uses core File handler pixels at the configured PDF DPI; it does not redefine snapshot canvas coordinates. SVG intrinsic geometry and compressed bitmap headers cannot bound actual decoder memory, and source metadata itself may require work. The checks trust core-reported metadata; they do not independently inspect or hash the compressed bytes. PrivateRasterRenderer remains a trusted low-level primitive without authorization/admission; the PageAssetService orchestration supplies both.

Only the selected source is charged for rendering. Other mixed-document sources still undergo the all-or-nothing authorization/existence checks but are not rendered or summed into a render-byte allowance. Slides have no source raster and remain rejected by the asset endpoint primitive. Cumulative metadata work, retained source byte verification, source/decoder memory, concurrency and hard deadlines remain separate lead-owned gates. The optional fourth PageAssetService constructor dependency is an internal test/composition seam; production callers must not replace admission with a bypass.

J32 can now probe this narrow implemented admission interface. Next lead step is bounded worker execution covering both transform and validation decode, plus complete configuration wiring; no HTTP registration is authorized by these limits.

## J32 acceptance and next lead execution milestone — September 12, 2026

J32 is accepted with stronger source-resolution evidence. Its controlled File metadata now substitutes only after real SourceVersionResolver authorization/exact-version checks. Resolver counts distinguish pre-render rejection (one resolution) from successful delivery (two); the mixed-document case checks both source keys on each resolution. Synthetic raster strings in the policy tests remain mocks, not decode evidence; existing real renderer/archived PDF suites supply that separately.

Installed MediaWiki 1.45.3 evidence: `includes/shell/Command.php::limits()` maps CPU/wall time directly and memory/file-size kilobytes to bytes; `CommandFactory::create()` supplies configured defaults. These are per-command facilities, not proof of aggregate job enforcement. Direct MediaHandler calls may spawn their own commands, and applying a limit only to the final validation decoder cannot bound the whole render. No global Shell configuration mutation is approved for an individual request.

**Lead L02c execution sequence (design, not implementation):**

1. Establish a disposable worker prototype using core command execution. Run the entire selected-source render and final decode in one supervised job. Keep owner/revision authorization and the final recheck in the parent; the worker cannot grant access or publish URLs. Transfer only a bounded job specification derived from the validated snapshot, through private staging, never caller-selected executable/path parameters. Do not serialize Authority/File objects or persist credentials in a job file. The lead must define exact-source re-resolution and minimal worker bootstrap before implementation.
2. Acquire bounded capacity before expensive source metadata work. Initially prove a single-host nonblocking capacity gate shared by all relevant PHP workers; reject saturation explicitly rather than queue indefinitely. Hold capacity through termination and cleanup. Do not use a lease that simply expires while the old worker can continue. Multi-host coordination is a separate deployment gate.
3. Give the job one elapsed-time budget covering metadata, transform and validation; nested commands must consume the remaining budget rather than each receiving a fresh full allowance. Core per-command limits can be building blocks, but process-group/descendant termination must be demonstrated on the configured platform. Do not label a stopped wait or killed parent as complete cancellation.
4. Parent owns the job workspace and cleans only that workspace after worker exit, timeout or malformed result. A killed worker cannot execute its own PHP finally block. Return bounded raster bytes only after exit, cleanup and final owner/revision/source authorization. Partial output, timeout and cleanup failure must never become a successful response.
5. Before freezing any junior packet, test a worker that spawns a child and attempts a delayed sentinel write, capacity contention across independent processes, crash recovery, malformed/oversized result, authorization revocation during work, and preservation of unrelated staging content. Require absence of the delayed write after timeout plus evidence the descendant exited. Record platform/tool dependencies and measured limits; current 64 MiB/40M metadata thresholds do not choose safe worker memory/time values by themselves.

This milestone remains lead-owned. J32 does not close gate A. Production registration, HTTP mapping, distributed capacity, lifecycle safety and retention remain unimplemented/gated.

## L02c timeout experiment and containment decision — September 12, 2026

Added reproducible Linux diagnostic `scripts/probe-render-timeout.php`. Run in the disposable installed environment with `MW_INSTALL_PATH=/var/www/html` and PHP. It uses that installation's Shellbox local executor with BashWrapper explicitly enabled; it does not bootstrap the wiki, change global Shell settings or reproduce every operator execution configuration. All child programs are finite, use unique private temporary directories, and write only known fixture files. The diagnostic removes those files after the observation interval.

Observed on the current container:

| Supervision | Requested timeout | Return time | Exit | Child delayed write |
| --- | --- | --- | --- | --- |
| Installed Shellbox BashWrapper default | 1 s | 3.018 s | 124 | Present |
| GNU timeout with TERM and 1 s forced-kill grace | 1 s + 1 s grace | 2.004 s | 137 | Absent |
| Same forced timeout, child creates a new session with setsid | 1 s + 1 s grace | 2.003 s | 137 | Present |

All three children were confirmed started and were gone after the four-second observation window. The detached child exits naturally after writing, so its eventual disappearance is not evidence that the supervisor killed it. The default timeout reports timeout status despite exceeding its deadline; an exit code alone is insufficient acceptance evidence. The installed `limit.sh` uses timeout without kill-after, matching the first observation. These results concern TERM-resistant/escaping fixture processes, not evidence that current image handlers deliberately daemonize.

**The following supervisor direction is abandoned.** This record preserves why the wrong path was taken; none of its deployment decisions or next steps remain approved. Docker is the test environment only.

<details>
<summary>Abandoned supervisor architecture and prototype evidence — do not implement</summary>

**Lead decision:** do not register a synchronous web-request rendering path based on shell timeout/process-group killing alone. Prototype a dedicated externally supervised worker whose supervisor owns a job container/cgroup and can terminate all its members, including detached descendants. The current container exposes cgroup v2 but no writable delegated cgroup root; no usable systemd-run, cgexec or bwrap command was found. Do not give the wiki privileged mode, host PID access or a Docker socket to solve this.

Next implementation milestone:

1. Build an isolated supervisor proof outside the wiki request process, using an available local image without downloads. Each job has no network, read-only runtime/source access, a unique private output workspace, explicit process/memory/CPU bounds and a whole-job wall deadline. The supervisor, not the worker, owns cleanup and capacity. Production mechanism and numeric operating budgets must be verified, not inferred from this timeout experiment.
2. Repeat the normal, TERM-resistant and detached-child sentinel probes inside that containment boundary. Require no late writes after forced stop and proof the job has no live members before releasing capacity or deleting workspace. Include supervisor restart/crash recovery and concurrent jobs with distinct workspaces before freezing the interface.
3. Define a narrow private job/result protocol around snapshot-derived source identity, pinned page and raster parameters. No caller-selected executable, backend path, arbitrary shell command or serialized Authority may enter the protocol. Keep final exact-owner/revision/source authorization in the parent immediately before delivery. Job results cannot provide a public URL or choose cleanup paths.
4. Integrate real core handlers only after the containment proof. Account for metadata lookup, worker bootstrap, transform and validation under the job budget; a limit covering only the final decoder is insufficient. Fail closed when the required supervisor is unavailable; no fallback to unbounded inline rendering.

This is an execution architecture decision backed by a diagnostic, not a deployed worker. No Docker socket, privileged container, server setting or public endpoint was changed. No junior implementation packet is ready until the supervisor proof and protocol exist. L02/gate A remains open.

## L02c disposable-container containment proof — September 12, 2026

Implemented host-side `scripts/probe-render-container.ps1` and finite fixture `tests/fixtures/execution/container-worker.sh`. The script resolves the immutable image ID already used by `mediawiki-145`, uses `--pull=never`, and creates only uniquely labeled disposable containers and volumes. The wiki is never given a Docker socket. Workers run as UID/GID 65534 with no network, read-only root/fixture mounts, all capabilities dropped, no-new-privileges, PID limit 32, memory 128 MiB and CPU quota 0.5. These values are probe controls, not selected production budgets. A temporary empty output volume is made writable for the unprivileged fixture; production per-job ownership must be stricter than this diagnostic's 0777 setup.

Each child ignores TERM, records readiness, waits for an explicit go marker, then attempts a write six seconds later. A positive control proves the detached child can write. Stop cases use Docker stop with a one-second grace, then observe beyond seven seconds from go. Observer containers mount output read-only. Results on local image `sha256:decbb81155989786c1cff0394fc0185cec65c40472be4da8f9dd584f5cefd1ae`:

| Case | Return time after go | Exit | Delayed write | Stopped state |
| --- | --- | --- | --- | --- |
| Detached positive control, natural completion | 6.067 s | 0 | Present | Running false, PID 0 |
| Stop ordinary process group | 1.286 s | 137 | Absent | Running false, PID 0 |
| Stop detached child job | 1.354 s | 137 | Absent | Running false, PID 0 |

All children were observed ready. All unrelated sentinel contents survived. Label-checked cleanup removed the exact job containers and volumes; a post-run inventory found no `layers.probe` containers or volumes. Shell syntax and PowerShell parse checks pass. This proves these finite adversarial fixtures under this local Docker runtime, not arbitrary sandbox escape resistance, production memory capacity, daemon availability or crash recovery.

**Decision:** proceed with a host-side supervisor controlling disposable job containers, not Docker access from the wiki. Keep an adapter boundary so another deployment can supply equivalent containment. Sites without an accepted supervisor must leave this feature disabled. No production worker is wired yet.

### Next lead prototype contract

- One active job per initial local supervisor, with explicit saturation rejection. The supervisor owns durable job identity and workspace records before launch; no capacity release until stopped state and cleanup are confirmed. Supervisor restart must reconcile only owned jobs by immutable ID and ownership token, never names alone. These lifecycle semantics are still to be implemented.
- Versioned private manifest: job ID, owner/revision/surface identity, pinned source filename/timestamp/hash/page and validated width. Source is a supervisor-selected read-only staged input; neither wiki request nor worker result may choose host paths, executable, mounts, image or credentials. The lead must implement exact byte staging and minimal core-handler bootstrap; the current probe contains no MediaWiki handler workload.
- Fixed result filenames inside a job-owned output directory, with bounded metadata and raster bytes. Parent rejects symlinks, unexpected files/types, oversized metadata/output, missing completion marker and malformed identity. Worker output never supplies a public URL or cleanup path. Cap captured stdout/stderr independently.
- One elapsed deadline covers staging/metadata, launch, handler transform, validation and stop grace. Core per-command limits remain defense in depth. Only after containment exit, result verification and cleanup may the parent perform the final original-reader authorization and release bytes. No success on timeout, uncertain stop, failed cleanup or source/permission loss.

**Parallel ready work:** J33 expands finite fixture lifecycle/isolation acceptance using this existing host script. Lead owns manifest/source staging, supervisor state/capacity, recovery and real-handler integration. This is a validated containment prototype, not completed L02/gate A or HTTP enablement.

## J33 lead review: lifecycle evidence corrections — September 12, 2026

The diagnostic now cleans a newly created volume if preparation fails before return, attempts cleanup of both concurrent jobs despite individual failure, and uses successful exact-token inventory queries to establish resource absence. A Docker error is not a not-found result. Invocation-scoped audit permits independent probe runs; a separately labeled guard volume was present during review runs and remained untouched.

PowerShell 7 or newer is now explicit. Each Docker CLI invocation has a 30-second host wait bound with argument-list execution and captured output. A timeout throws an uncertain-state error and terminates the CLI process tree only; it cannot guarantee daemon-side cancellation. The finite fixture bounds and cleanup attempts remain diagnostic conveniences, not durable production recovery. Newly injected volume-preparation failure complements the existing post-start host failure.

J33 is accepted with these corrections. The next lead milestone is persistent supervisor ownership: record immutable job/container IDs and tokens before/through launch, reconcile uncertain create/stop results using successful daemon queries, and release capacity only after confirmed exit and workspace cleanup. A durable journal and exclusive supervisor ownership must exist before a real-worker interface is delegated. No further junior packet is ready. The private manifest/source staging and real-handler bootstrap still follow; no production supervisor has been implemented.

## L02c supervisor journal primitive — September 12, 2026

Implemented internal `RenderJobJournal` for one supervisor and one active job on a trusted private local filesystem. It takes an existing operator-controlled directory (not request input), holds a nonblocking exclusive flock on a stable `supervisor.lock` inode for the instance lifetime, and stores a bounded strict version-1 `job.json`. A separate process cannot acquire that lock. The lock file must never be unlinked/replaced while supervisors can open it. Deployment must validate private storage, permissions and local locking semantics; this class does not discover served roots or provide multi-host coordination.

Explicit `initialize()` creates idle state only for first installation. Normal startup reads existing state; missing, malformed, oversized or unsupported state fails closed. Never call initialize as a recovery fallback. `reserve(imageId)` persists random job/ownership identities and generated container/volume names before callers may create resources. It also pins an immutable image ID. A second reservation fails while any active state exists.

| Transition | Journal effect | Runtime requirement outside this primitive |
| --- | --- | --- |
| reserve | idle → reserved; resource names and ownership token persisted | Must complete before external creation |
| recordContainer | reserved → attached; immutable daemon container ID persisted | Verify ownership when reconciling an uncertain creation |
| requireCleanup | reserved/attached/cleanup → cleanup | May be used even when create/stop result is uncertain; capacity remains occupied |
| confirmCleanup | cleanup → idle | Trusted supervisor must first prove job exit and resource/workspace cleanup through successful queries |
| close/process death | release process lock only | Unfinished durable job remains and must be reconciled after restart |

State writes use an exclusively created private temporary file, complete write/flush/fsync and same-directory rename. Write failure poisons the instance so it cannot continue admitting work. The directory entry is not separately fsynced; power-loss/storage-controller durability, network filesystems and Windows locking/rename behavior are **not proven**. This is initial process-crash recovery evidence, not a deployment-ready durability guarantee. Orphaned pending files are never swept automatically. Journal objects cannot be cloned/serialized into alternative lock owners.

Tests use real local files and separate PHP processes: contention fails immediately, SIGKILL of a writer after reservation leaves the job recoverable and still consuming capacity, wrong token/premature cleanup cannot free it, and corrupt/missing state never becomes idle. The helper process is finite and has no Docker/network access. No Docker adapter calls this journal yet; `confirmCleanup` is an explicit trusted-composition boundary and does not itself inspect Docker.

**J34 is lead-reviewed with corrections:** focused acceptance is 14 tests / 239 assertions. Write denial occurs before pending-file creation; partial-write/fsync/rename failure cleanup remains untested. Repeated cleanup is idempotent; missing-state recovery refuses admission without recreating state.

**Next:** Follow the ordered L02c milestone in the [handoff plan](IMPLEMENTATION_HANDOFF_PLAN.md). J35 is blocked until the reviewed runtime interface and harness exist. Lead must wire durable intents to daemon creation/ID recording, successful-query reconciliation, workspace cleanup and capacity release, then test supervisor death at each external side-effect boundary. Private manifest/source staging and real-handler bootstrap still follow. No production worker/HTTP registration is enabled.


## L02c recovery coordinator — September 12, 2026

Implemented internal `RenderJobRuntime`, immutable `RenderJobResources`, and `RenderJobRecovery`. This is a tested composition boundary using a scripted runtime in tests; **there is no real Docker adapter, launch path or production registration**. The coordinator owns no host workspace. Its caller keeps the journal open and exclusively locked throughout recovery.

Recovery first requires the runtime to prove quiescence: no earlier create/start command for this job can still complete. Killing a CLI and receiving a successful empty inventory do not prove that an outstanding daemon request cannot create a resource later. An adapter unable to establish this barrier must throw and retain capacity for operator recovery. The concrete Docker strategy remains a lead blocker; do not implement this method as a no-op or infer success from elapsed time.

After this barrier, successful validated inventory must check generated names, exact job/token labels, pinned image, recorded immutable container ID and unexpected duplicate resources. Ownership conflict, malformed output, query failure or uncertain outcome throws. These obligations belong to the future trusted adapter; `RenderJobResources` validates only identifier shape and the absence/running invariant, not raw Docker data.

The coordinator marks cleanup before mutations, stops an observed running container, rechecks exit and identity, removes only the stopped container, and obtains fresh inventory before removing the owned volume. A final successful inventory must show both resources absent before journal cleanup confirmation. It never initializes missing state, launches a job, retries automatically or releases capacity on an exception. Repeated recovery of idle state makes no runtime calls. Mutation methods must reverify ownership at their own boundary; the resource namespace must be exclusively controlled by the trusted supervisor.

Tests inject failures at every runtime call, retain capacity, then recover after a later verified absence. They also reject a still-running container, changed identity, residual container/volume and mismatch with a recorded ID. This is coordinator logic evidence with real journal files and mocked runtime responses, not daemon containment or crash-window evidence. Next: implement the host runtime adapter and quiescence strategy, then connect creation and exercise actual supervisor death. J35 remains blocked.


## Host Docker inventory prototype — September 12, 2026

`scripts/lib/RenderInventory.ps1` now implements read-only, ownership-checked inventory against actual Docker metadata. Its injected command runner must throw on any command failure. Candidate containers and volumes are the union of exact intended-name, job-label and token-label queries, plus recorded container ID when present. This catches a name collision even when labels differ, and a duplicated identity under another name. Successful list commands are mandatory; a failed inspect never establishes absence.

The prototype validates names, IDs, both ownership labels and pinned image. Container state must be internally consistent: created/exited with PID 0, or running with a positive PID; paused, restarting, dead, malformed and transitional states reject. Volumes must use the local driver/scope with no custom mount options. The return value contains only container ID, running state and volume presence. The caller must already control the resource namespace; these separate queries do not form an atomic snapshot against outside writers.

Run `pwsh -NoProfile -File scripts/probe-render-inventory.ps1` on the Docker host with the existing `mediawiki-145` baseline image. It creates a never-started container and disposable labeled volumes, validates absence/presence, token/image/recorded-ID mismatch, duplicate identity, malformed output and simulated daemon failure, then checks volume ownership independently. An unrelated guard volume must survive. Finally cleanup attempts every exact owned resource with label checks. No image download, worker start, Docker socket mount or production registration is involved.

This is **read-only diagnostic acceptance**, not an implementation of the PHP runtime interface, mutation revalidation, bounded production transport, quiescence or crash recovery. The diagnostic bounds each CLI wait to 30 seconds but captures output in memory; a production runner still requires bounded output and a shared end-to-end deadline. Inspect/list queries alone cannot resolve an outstanding create request. No coordinator is wired to this script.

### Launch uncertainty decision for the next lead implementation

Use a durable command-intent record before each external create/start call. Only a positively validated completion may clear that pending marker. Persist failure/timeout uncertainty; do not clear it based on elapsed time, a killed client or empty inventory. Startup with a pending marker must refuse automatic cleanup/capacity release until a separately accepted runtime barrier or operator recovery has established quiescence. The first implementation will therefore support automatic recovery for acknowledged outcomes and fail closed for unknown outcomes, explicitly sacrificing availability for safety.

This decision is not implemented yet. Lead must define the journal schema/version handling, atomic transitions and operator recovery proof before adding launch commands. Never retrofit a boolean “force clean” or automatically initialize missing state. Existing journal records do not prove whether a historical command is outstanding, and must not be treated as such proof. J35 remains blocked until this composition and actual crash-window harness exist.


## Version 2 command intent — September 12, 2026

Implemented `RenderJobJournal::beginCommand(id, token, kind)` and `acknowledgeCommand(id, token, commandId, containerId = null)`. New journals write version 2; each active job has `pendingCommand`, either null or an exact `{id, kind}` object. Kinds are `create-volume`, `create-container` (reserved phase) and `start-container` (attached phase). The command ID is a fresh random receipt. Begin persists before returning; the caller must wait for successful return before dispatch. A second pending command cannot overwrite the first.

Acknowledgement requires the current instance's issued receipt and matching job credentials, and must follow validated successful daemon completion. Create-container acknowledgement requires a valid immutable ID and writes attached state, the ID and cleared intent atomically. Invalid/stale acknowledgements preserve state. Recording a container through the older reconciliation method is prohibited while a command is pending. Entering cleanup preserves intent; cleanup confirmation cannot clear it. Reopened journals cannot acknowledge an earlier instance's command, even if the stored receipt is supplied.

`RenderJobRecovery` rejects pending commands before any runtime callback. This deliberately blocks recovery after death between dispatch and acknowledgement, including death after successful daemon completion but before the acknowledgement was committed. There is no timeout reset, forced acknowledgement or operator bypass API. A future separately reviewed recovery mechanism must establish quiescence before offering resolution. The protocol depends on the trusted launcher recording every create/start operation; a null marker does not excuse an unjournaled launch or replace runtime quiescence checks.

**Compatibility:** version 1 and other unsupported versions are rejected with `layers-journal-corrupt`, preserving their bytes. No automatic migration, deletion or initialization fallback exists, including for old idle records. These are unpublished internal supervisor records, not MediaWiki page revisions or `layer_sets`. Any existing prototype state requires a lead-reviewed reconciliation/migration procedure before reuse; do not delete a journal to regain capacity.

This change implements persistence and the recovery guard only. No Docker launcher uses it yet. Same-process/reopen tests exercise acknowledged sequences, stale receipts, forbidden mutations and retained pending state; actual command dispatch/crash-window integration remains lead-owned. Power-loss durability is still unproven.


## J37 lead acceptance — September 12, 2026

The reader and fixture builders now preserve Docker's JSON array envelope. Inspect must return exactly one object in an array; bare objects, nested arrays, null, scalar entries and malformed JSON reject. Names/IDs/images and identity labels must be strings, preventing PowerShell array-comparison coercion. The scripted suite passes 76 scenarios, including 16 review regressions. The live disposable inventory diagnostic also passes with exact owned cleanup and unrelated guard preservation; no workers started. This does not prove runtime quiescence or crash recovery.

Next lead work is bounded production command transport, with independent output limits and an elapsed deadline that includes pipe draining. The existing diagnostic's in-memory capture remains a documented limitation. No further junior assignment is ready until the runner and its finite fixture harness exist. J35 remains blocked; no PHP runtime adapter, launcher or browser-history enablement is claimed.


## Bounded host command transport — September 12, 2026

Implemented `scripts/lib/BoundedCommand.cs`, loaded by `BoundedCommand.ps1`. `Invoke-LayersBoundedCommand` accepts an absolute existing operator-selected executable, explicit string arguments, `TimeoutMilliseconds` (10–60000, default 30000) and independent per-stream `OutputLimitBytes` (1–1048576, default 262144). These are trusted supervisor inputs, never request parameters. The runner uses no shell, creates no visible window and closes stdin immediately.

Both streams are read asynchronously into bounded buffers. Completion requires client exit plus both output streams reaching EOF before the deadline; inherited pipes cannot extend the wait indefinitely. Each stream is limited by raw byte count before UTF-8 decoding. Successful zero exit returns `Stdout` and `Stderr`; nonzero exit, overflow, timeout, spawn/configuration/argument failure or decoding failure throws. No output content is copied into error messages. Buffers/copies are bounded by the configured limits, but no process RSS benchmark is claimed.

On failure the runner cancels readers and attempts to kill the owned client tree if the parent still exists, allowing at most one additional second for exit confirmation before closing local pipes. Timing assertions allow scheduling overhead. Process creation/OS calls are not a hard real-time guarantee. If the parent has already exited, surviving descendants may remain; closing inherited pipes is not containment. The finite inherited-pipe fixture deliberately waits for its child to exit. **Client termination never proves Docker daemon cancellation, resource absence or quiescence.** An uncertain journal intent remains pending.

The read-only inventory diagnostic now uses this runner, resolving the first Docker application on the trusted host PATH once. The older containment diagnostic still has its original capture wrapper; no claim of repository-wide replacement is made. No PHP runtime/launcher is wired, and no Docker access is added to the wiki.

`pwsh -NoProfile -File scripts/test-bounded-command.ps1` exercises literal argument integrity, exact 32768-byte output on both streams, independent overflow, nonzero exit, a stalled client and inherited pipes after parent exit. Seven scenarios pass on this Windows/PowerShell 7 host. They are finite local fixtures without Docker/network. J38 extends this real interface; host parity, stronger failure coverage and real launch/crash recovery remain incomplete.


## Journaled launch coordinator — September 13, 2026

Implemented internal `RenderJobLauncher` and `RenderJobLaunchRuntime`. The launcher reserves a new job and executes the fixed sequence create-volume → create-container → start-container. Before each adapter call it persists `beginCommand`, then passes the persisted snapshot including the receipt to the adapter. Only successful return permits acknowledgement; container creation acknowledgement validates and atomically stores the immutable ID. A malformed ID never permits start. The launcher returns acknowledged-start state, not completed rendering or authorized output bytes.

The adapter is a trusted boundary: it must validate successful daemon completion, exact resource ownership/configuration and the immutable created ID, reject preexisting resource collisions, and target the recorded ID for start. It must never retry or select commands/mounts from wiki requests. No concrete adapter implements this interface yet. The PowerShell runner/inventory prototype and PHP journal/launcher are not wired together; the host bridge remains a lead deliverable.

Any exception leaves persisted state untouched by the launcher. It never clears intent in catch/finally, performs cleanup, releases capacity or resumes partially launched work. A second launch against any active job is rejected before dispatch. An adapter error or invalid result leaves the pending command blocking `RenderJobRecovery`, including after reopening. Caller must hold the journal open and exclusively locked for the entire sequence; trusted callbacks must not close/mutate it.

Tests inspect real journal bytes inside each scripted runtime callback, verify command ordering and recorded container identity, inject errors at every dispatch, reject malformed creation results, and assert repeated launch/reopened recovery cannot redispatch or erase uncertain work. This is protocol composition evidence, not real Docker mutation or supervisor-crash acceptance. Final reader authorization, source staging, renderer execution and production/browser registration remain gated.


## J38 lead acceptance — September 13, 2026

Thirty-six runner scenarios and 76 inventory scenarios pass after review corrections. A test-only asynchronous runner probe enables acquisition of the original client's OS process handle before timeout and verifies exit at runner return. The PID handshake is published atomically; finite helpers and owned marker files are accounted for in finally paths. Pressure fixtures interleave both streams, with 512 KiB per stream accepted under a 1 MiB limit. Preflight checks no longer assert a fragile 100 ms wall-clock threshold.

No runner implementation changed. Evidence is Windows/PowerShell 7 only; no new full-core, live Docker or browser run is claimed. Inherited pipes are closed locally on deadline and the finite child is observed exiting, not claimed killed. Next lead work is the concrete host adapter and validation of journal/process semantics on that host, then runtime mutation/crash-window acceptance. J35 remains blocked; no additional junior packet is ready before that interface exists.


## Local host journal evidence and bridge direction — September 13, 2026

`php scripts/probe-journal-host.php` now exercises the real version 2 journal on the Windows host (PHP 8.4.11). It verifies separate-process lock exclusion, replacement writes with flush/fsync and reopening, then terminates finite helper processes after persisted create-volume/create-container/start-container handshakes. Reopening preserves the exact pending snapshot, refuses prior-instance acknowledgement and retains capacity. It never resets uncertain state; each case owns a fresh disposable directory with no real external jobs. Checked exact-file cleanup completes before success is reported.

The same five checks pass when host PHP is invoked by `Invoke-LayersBoundedCommand` with a ten-second deadline and empty stderr. This closes the local journal/runner invocation compatibility gap; Linux core tests and local Windows tests remain separate evidence. It does not prove daemon dispatch, power-loss durability, all Windows filesystems, deployment permissions, or crash recovery of external resources.

**Next lead bridge direction (not implemented):** retain a single PHP journal-owning process for the entire launcher sequence, with the host controller dispatching only fixed create-volume/create-container/start-container operations from a bounded structured exchange. The PHP process must keep its lock while awaiting host completion and persist acknowledgement only after a validated matching reply. Parent death, EOF, malformed/stale receipt or incomplete response must leave intent unresolved. No one-process-per-journal-operation design is acceptable: reopening intentionally loses acknowledgement authority, and releasing the lock between operations defeats supervisor exclusivity.

Before coding the bridge, freeze the versioned command/reply envelope, ownership/receipt validation, per-message limits, lifecycle deadline and EOF behavior. No free-form executable, argument vector, mount or host path may cross this channel from wiki data. A successful host reply must represent validated daemon completion, not merely successful JSON parsing. The journal probe is not this bridge and must not be promoted to a public command endpoint. Lead retains actual runtime mutation and supervisor-death acceptance; J35 stays blocked.


## Launch bridge message contract v1 — September 13, 2026

Implemented `RenderJobLaunchBridge`, an internal `RenderJobLaunchRuntime` adapter with an injected trusted exchange callback. It serializes one command, validates one reply and returns only after a matching completed response. The launcher remains the sole journal owner and acknowledger. This is message validation and composition, **not a concrete stream transport or Docker dispatcher**.

Request object fields: `version` (integer 1), `jobId`, `token`, `commandId` (the persisted receipt), `command` (create-volume/create-container/start-container), `image`, `containerName`, `volumeName`, and `containerId`. The input is a trusted validated journal snapshot whose pending kind must match the invoked method. There are no executable, free-form argument, mount, filename or host-path fields. Requests and replies have an 8192-byte application limit.

Reply object fields are exactly `version`, `jobId`, `token`, `commandId`, `command`, `status`, `containerId`; JSON key order does not matter. Version must be integer 1 and status must be `completed`. Identity/correlation fields must be matching strings. Create-container requires a lowercase 64-hex immutable container ID; other commands must echo the request's container ID (null for volume creation, the recorded ID for start). Missing/extra fields, non-object JSON, malformed/oversized responses, mismatches and non-completed status reject with `layers-bridge-reply-invalid`. A wrong pending kind rejects before exchange. Transport exceptions propagate without acknowledgement.

The callback must enforce IO byte limits before buffering, elapsed deadlines and EOF/failure handling. The codec's length check after callback return is not a streaming memory bound. The host must revalidate ownership/configuration and actual daemon completion before sending `completed`; matching JSON proves correlation, not authorization against a compromised host or daemon success. No automatic retry, fallback or journal reset exists. User-supplied wiki content cannot select this callback.

Core tests use real launcher/journal composition with a scripted exchange: a complete three-command sequence checks persisted receipt correlation; malformed, oversized, mismatched and simulated EOF replies preserve the original pending intent and stop further dispatch. Actual bounded stream framing, host-side dispatch, process death during an exchange and end-to-end Docker acceptance remain lead-owned; J35 stays blocked.


## J39 launch bridge protocol acceptance — September 13, 2026

Completed protocol acceptance suite in `RenderJobLaunchBridgeTest.php` (69 tests / 260 assertions in focused suite; full core suite passes 288 tests / 2,379 assertions / one existing skip). Exercised:
1. Multi-stage failure boundaries at `create-container` and `start-container`, verifying exact persisted pending receipt, phase (`reserved` vs `attached`), and container ID (`null` vs 64-hex), zero subsequent dispatch, and capacity/recovery refusal upon reopening (`layers-render-capacity-full` and `layers-journal-command-unconfirmed`).
2. Exhaustive callback return variations: non-string callback returns (`null`, `int`, `bool`, `array`, `object`), empty strings, malformed/non-object JSON, deep nesting (>16), 8192-byte success vs 8193-byte overflow, missing/extra fields, wrong version/status values/types, identity/command mismatches, and container ID formats/mismatches.
3. Outgoing request purity: exactly the 9 documented keys matching pinned journal snapshots with no arbitrary executable/path/argument/mount keys; verified key-order independence.
4. Replay protection: replaying a prior command's reply or another job's reply rejects before acknowledgement. Transport exceptions at every phase propagate without retry or reset. Mismatched pending kinds reject before calling exchange.

Tests use scripted exchange callbacks, not real Docker dispatch or streaming transport. Lead retains bounded framing, host-side runner integration, and actual crash recovery. J35 remains blocked.



## J39 lead acceptance — September 13, 2026

The protocol tests now explicitly forbid all runtime calls during unresolved recovery, assert the original propagated exception object and exact dispatch sequence at every failure stage, preserve the complete pending snapshot through reopening, and reject array-valued correlation/status fields. The junior's broader later-stage, schema, boundary, ID and replay acceptance is retained. No bridge implementation change was required.

This is scripted exchange evidence only. Actual bounded IO, EOF/timeouts, process ownership throughout a bidirectional exchange and verified host dispatch are the next lead deliverable. No further junior packet is ready until that interface and finite cross-process harness exist; J35 stays blocked. Do not equate matching reply fields with authenticated transport or actual daemon completion.


## Lead transport implementation contract — September 13, 2026

Status: design only; no transport or dispatcher is implemented by this entry. J39 remains accepted. J35 remains blocked. Implement the following slices in order; do not turn transport acceptance into a claim that page-owned history is ready.

### Process ownership and channel

The trusted host controller starts exactly one operator-selected PHP executable and fixed journal-owner script, using explicit arguments without a shell. That PHP process opens the journal once, keeps its lock throughout all three launch commands and receives replies on stdin while writing requests to stdout. Stdout is exclusively protocol traffic; diagnostics use separately bounded stderr. Neither executable selection nor journal directory, image policy, mounts or argument vectors may come from wiki content.

The current `BoundedCommand` runner closes stdin and captures stdout until exit. Keep that one-shot interface intact for Docker commands. Add a separate session transport for the persistent PHP process; using the existing runner unchanged would prevent replies and deadlock launch. Never reopen PHP for each operation or release the journal lock while awaiting a reply.

### Framing and limits

Use a four-byte unsigned big-endian payload length followed by exactly that many UTF-8 JSON bytes in both directions. The length excludes the header. Accept lengths 1 through 8192 only; reject zero or larger lengths before allocating the payload buffer. Read and write loops must handle partial headers and payloads. EOF anywhere inside a frame is failure. Decode UTF-8 strictly after the complete bounded payload arrives; no BOM, replacement decoding or line-delimited fallback. The v1 JSON command/reply fields remain unchanged.

Only one request may be outstanding. The host accepts precisely the create-volume, create-container, start-container sequence. It validates each complete request before dispatch: exact field set and scalar types, integer version 1, lowercase 32-hex job/token/receipt identifiers, exact names derived from job ID, approved immutable image digest, and the correct null/recorded container ID for the phase. Later requests must preserve job identity, image and resource names; receipts must not repeat. No extra fourth request is permitted. A malformed frame or request ends the session without a reply claiming completion and without further dispatch.

Use a monotonic deadline covering process startup, all framing reads/writes, dispatch and process exit: default 30 seconds, operator configuration from 1 through 60 seconds. Each Docker command receives only the remaining session budget; reject before dispatch if insufficient. Do not restart the deadline on progress, a new frame or a new command. Capture stderr concurrently with an independent 64 KiB raw-byte cap for the whole session. Overflow, stalled IO, invalid UTF-8, EOF before completion, unexpected additional frames and nonzero PHP exit are session failures. Error messages must not echo frames, tokens or diagnostic content.

An acknowledged third reply is not sufficient for successful session return: the PHP owner must finish persisting that acknowledgement, close cleanly and exit zero before the deadline, with stdout at EOF and no extra frame. Exit zero or EOF before three exchanges is failure. This is launch completion only, not rendering completion or publication authorization.

### Dispatch and uncertain outcomes

The host constructs fixed Docker commands from its own policy after validation. Before mutation, reject collisions using verified inventory. Before each completed reply, verify the intended resource identity and configuration using successful daemon queries, including the immutable container ID. Preserve fixed sandbox limits from the containment design. The start command targets that immutable ID. A CLI exit code alone is insufficient evidence for a completed reply.

Any command, inspection or reply-write failure stops dispatch. Do not resend an uncertain request or synthesize an acknowledgement. Closing/killing the PHP client or Docker CLI does not cancel daemon work or prove quiescence. Attempt bounded termination of owned client processes and close local pipes; retain the journal and resource evidence. A pending journal receipt blocks automatic recovery. Do not clear pending intent, remove the lock file, initialize over an existing journal or release capacity in a transport finally block.

A lost final reply may leave pending start intent even if the container started. Conversely, PHP may have persisted an acknowledgement before the controller sees failure. Recovery must inspect the actual journal; never assume that every transport failure implies a pending receipt. An acknowledged active job still requires verified runtime reconciliation before capacity can be released.

### Ordered implementation and evidence gates

1. **Lead: finite session transport.** Implement framing, whole-session deadline, concurrent bounded stderr, partial IO and owned-process cleanup behind a separate host session interface. Use disposable finite helper processes only, without Docker. Prove exact 8192-byte frames, 8193/zero rejection before allocation, fragmented headers/payloads, premature EOF, stderr pressure, blocked replies, process exit and total deadline spanning multiple exchanges. Tests must observe the original process handle where termination is claimed and account for every helper.
2. **Lead: persistent PHP composition.** Connect the real journal, launcher and codec to the framed channel. Use a scripted host dispatcher and fresh disposable journals. At each command, independently observe the persisted pending receipt and competing-owner lock refusal while PHP waits. Interrupt both sides before dispatch, after scripted dispatch, during reply delivery and after acknowledgement. Reopen and verify exact persisted state, no duplicate dispatch and retained capacity. No fixture represents real daemon completion.
3. **Junior packet preparation, not assignment.** After the real interface and finite harness pass lead review, freeze their names and invocation contract and issue a bounded adversarial transport test packet. Do not ask juniors to invent transport, deadlines, ownership or recovery semantics from this design.
4. **Lead: fixed dispatcher and runtime reconciliation.** Wire verified inventory and bounded Docker commands to launch/recovery. Run disposable, token-isolated real Docker acceptance, including deliberate collision and supervisor/client death windows, without touching unrelated resources. Unsupported uncertain cases must remain blocked with preserved evidence. This is required before reconsidering J35.

Only successful local implementation and recorded results may change these statuses. No browser URL, public endpoint registration, migration, search projection or Cargo text binding is authorized by this transport milestone.


## Bounded session transport checkpoint — September 13, 2026

Implemented `scripts/lib/FramedSession.cs` as a separate host-only transport. The existing one-shot `BoundedCommand` interface is unchanged. `FramedSession.Run(executable, arguments, timeoutMs, dispatch)` uses an absolute operator-selected executable, explicit arguments and a trusted asynchronous C# dispatcher of type `Func<string, int, CancellationToken, Task<string>>`. Its second argument is the remaining whole-session budget in milliseconds. Do not pass a PowerShell scriptblock that needs the caller's runspace to this worker-thread callback.

The implementation exchanges exactly three sequential length-prefixed messages with one child process. Four-byte unsigned big-endian lengths are checked before payload allocation; frames accept 1–8192 raw bytes. Strict UTF-8, BOM rejection, bounded reply encoding, concurrent 64 KiB stderr capture, whole-session deadlines of 1–60 seconds and final zero exit plus stdout/stderr EOF are enforced. Unexpected trailing output fails. Diagnostics are validated but not returned. It never opens, resets or acknowledges a journal.

The callback remains a trusted extension point: this transport does not validate JSON, command order/identity or daemon state. A concrete dispatcher must implement those checks before mutation. Cancellation cannot revoke side effects from an uncooperative callback or a Docker daemon; a callback that ignores cancellation may outlive transport failure. The watchdog stops further transport exchanges, attempts to terminate the owned child tree and allows up to one additional second for exit confirmation. OS startup/cleanup are not hard real-time guarantees. Inherited descendants after parent exit are not proven contained.

Fresh `pwsh -NoProfile -File scripts/test-framed-session.ps1` passes **35 scenarios** on Windows/PowerShell 7. The finite raw-pipe peers exercise three successful round trips, exact 8192-byte ASCII/multibyte frames, fragmented writes, header-only invalid lengths (zero/8193/unsigned maximum), truncated headers/payloads, invalid UTF-8/BOM, exact/overflow stderr, early exit, trailing output, nonzero exit, no input consumption, stalled/slow peers, deadline expiry in an asynchronous handler, malformed replies, original handler-exception identity and six preflight configuration failures. Where a peer PID is received, the harness acquires its original OS handle before failure and checks exit on return. No-read acceptance proves bounded failure when the peer consumes no replies; it does not assert a specific OS pipe-buffer size or that a particular write blocked. Fixtures have an eight-second runtime deadline after compilation; the parent transport also imposes its own whole-session deadline.

This is the initial transport slice, not completion of all transport adversity/crash gates. Actual PHP journal-owner composition, cross-process lock exclusion during an exchange, interruption around durable acknowledgements, inherited-pipe acceptance for this new runner and fixed Docker dispatch remain unimplemented or unverified here. No fresh core, standalone PHP, JavaScript, Docker or browser test result is claimed by this checkpoint. The last core result remains J39's 293 tests / 2,402 assertions / one existing skip. No production PHP, manifest registration or public save behavior changed.

Next lead slice: connect the real PHP journal/launcher/codec to this framed channel using disposable journals and scripted host replies, then verify persisted state and lock ownership across interruption boundaries. Do not issue the junior adversarial transport packet until that composition and its finite harness have passed lead review. J35 remains blocked.


## Persistent PHP journal-owner checkpoint — September 13, 2026

Implemented `RenderJobStreamExchange` and the internal CLI entry point `scripts/run-render-launch.php`. The trusted host invokes the entry point with an existing private journal directory and immutable image digest. It opens one journal, constructs the real launcher/bridge/stream exchange, keeps the lock throughout launch, closes it on exit and never initializes or clears state. Non-CLI requests are rejected. No public registration, Docker capability or automatic retry was added.

The PHP stream exchange writes the bounded length-prefixed request with partial-write handling, flushes it, reads exactly one bounded reply and validates UTF-8/BOM rules before returning to the existing codec. It rejects invalid lengths before reading/allocating a payload. It does not own the supplied streams or provide its own elapsed deadline: blocking CLI pipe IO must run under the host `FramedSession` process deadline. Do not invoke this CLI as a standalone unbounded service or from wiki requests. Schema/correlation validation remains in the bridge; verified daemon completion remains a future trusted dispatcher responsibility.

**Fresh local composition evidence:** `pwsh -NoProfile -File scripts/test-journal-session.ps1` passes **16 scenarios** on Windows/PowerShell 7 with PHP 8.4.11. It uses the real PHP journal/launcher/codec/stream transport with scripted host replies, while the host uses `FramedSession`. One complete launch and five failure/observation modes at each of the three commands establish:

- Each request matches the full persisted job identity, source image, resource names, phase, container ID and fresh receipt. A second PHP process cannot acquire the lock while the owner awaits its reply.
- Failure before or after a simulated dispatch, a rejected reply and a reply timeout preserve the exact pending journal bytes, with no retry or subsequent command. Reopening through the real journal refuses prior-instance acknowledgement and retains capacity.
- Test-only `PausedSessionJournal.php` pauses after the real acknowledgement write. An independent observer acquires the original PHP process handle and verifies lock exclusion during that pause. The host deadline terminates the owner; reopening preserves the acknowledged state, with null pending intent and capacity still occupied, at all three acknowledgement boundaries. No production fault-injection option was introduced.
- Launching again against any of those active journals emits no command and leaves the stored bytes unchanged. Test cleanup removes only known files in newly created disposable directories, after child/monitor completion; there are no external jobs to recover.

**Fresh core evidence:** MediaWiki 1.45.3 / PHP 8.3.31 passes **310 tests / 2,437 assertions / one existing permission-test skip**, no failures. `RenderJobStreamExchangeTest` adds bounded input/output framing, invalid UTF-8/BOM, invalid stream configuration and rejection-before-write checks. Changed PHP files pass code style. The earlier 35 generic session scenarios remain separate evidence and were not rerun in this composition checkpoint.

This closes the initial persistent-owner composition gate, not real daemon or complete crash recovery acceptance. Host-side exceptions/timeouts cause controlled client termination; abrupt host-controller death, partial reply delivery over real pipes, inherited pipes, platform parity and power-loss durability are not established here. Scripted dispatch counters are not Docker operations. The important recovery distinction is proven locally: a failed host session can leave either pending intent or already-acknowledged active state. Recovery must read the journal and verify runtime state; it must not infer either state or free capacity from the host result alone.

J40 is accepted below. Lead retains fixed host dispatch/schema enforcement, runtime reconciliation and actual host/daemon death windows. J35 remains blocked. Page-owned save registration, browser testing, search and Cargo text projection remain gated; public saves still do not create owner-page revisions.


## J40 stream framing and owner startup rejection acceptance — September 13, 2026

Completed task **J40 — PHP stream framing and owner startup rejection acceptance** extending `RenderJobStreamExchangeTest` and `JournalSessionTests.cs`:

- **Exact outbound length-prefix framing:** Verified 4-byte big-endian framing (`pack('N', 8192) . $payload`, 8,196 bytes total) and stream position `ftell` at both ASCII and multibyte 8,192-byte boundaries (`\xC3\xA9` × 4,096 chars).
- **Sequential multi-exchange stream positions:** Verified two sequential exchanges consume exactly one length-prefixed frame each, advancing input and output stream positions by exact frame lengths without over-reading or interleaving.
- **Unconsumed payload on rejected headers:** Verified that oversized (`8193`), zero (`0`), and unsigned maximum (`0xFFFFFFFF`) length headers throw `layers-stream-frame-limit` and consume strictly 4 header bytes (`ftell === 4`), leaving trailing payload unconsumed.
- **Closed and invalid stream construction:** Verified `\InvalidArgumentException('layers-stream-configuration-invalid')` for closed stream resources (closed input or closed output) and non-stream types (`null`, `int`, `string`, `bool`, `array`, `object`).
- **Test stream wrapper for fragmented and failing IO:** Implemented `RenderJobTestStreamWrapper` registered under `layers-test-stream://`. Verified that 1-byte fragmented reads and 1-byte fragmented writes reassemble complete frames and complete successfully. Verified that zero writes terminate promptly with `layers-stream-write-failed` without spinning (<10 calls), failed writes throw `layers-stream-write-failed`, failed flushes throw `layers-stream-write-failed`, and failed reads throw `layers-stream-eof`. Wrapper lifecycle is strictly unregister-clean in `tearDown()`.
- **Owner startup rejection on host:** Extended `tests/fixtures/execution/JournalSessionTests.cs` through `scripts/test-journal-session.ps1` with 4 owner startup rejection scenarios across fresh test-owned directories: missing journal (no `job.json`), invalid JSON, unsupported journal version, and valid active journal. All 4 scenarios verify failure (`layers-session-eof`), zero dispatch calls, and exact byte preservation (or continued absence for missing journal). Cleanup is nonrecursive and exact-file.

Fresh verification:
- Full core suite: **332 tests / 2,490 assertions / one existing permission-test skip**, 0 failures on MediaWiki 1.45.3 / PHP 8.3.31 (focused exchange suite: 39 tests / 88 assertions).
- Journal session host acceptance: **20 scenarios passed** on Windows/PowerShell 7 (16 journal scenarios + 4 startup rejection scenarios).
- Standalone PHPUnit: **1,070 tests / 2,485 assertions / 1 skip**, 0 failures.
- Style and lint checks: passed (`parallel-lint`, `phpcs`, `minus-x`).

Lead retains fixed Docker dispatch, runtime reconciliation, and crash recovery. J35 remains blocked. Public page-history testing remains gated; changes are local and uncommitted.



## J40 lead corrections and next implementation — September 13, 2026

Accepted J40 after correcting test-provider resource leaks, registration ownership and cleanup in the test stream wrapper, exact failure-path IO assertions, and raw-byte startup preservation. The active startup fixture is independently validated with the real journal helper. No production behavior changed.

Fresh lead verification: **334 core tests / 2,506 assertions / one existing skip**, no failures; **20 local journal session scenarios**; changed PHP style passed. The earlier J40 entry records the junior's pre-review results, not this corrected checkpoint. No new standalone, generic runner, JavaScript, live Docker or browser run is claimed.

Lead next owns host request validation/state, fixed Docker dispatch with verified outcomes and runtime reconciliation, followed by real host/daemon failure acceptance. No new junior packet is ready; J35 remains blocked. See the [ordered implementation queue](IMPLEMENTATION_HANDOFF_PLAN.md#next-lead-implementation-order-after-j40).


## Host launch protocol gate — September 13, 2026

Implemented `scripts/lib/RenderLaunchProtocol.cs`. This is the trusted host's request validator/state machine, not a Docker dispatcher. One `RenderLaunchProtocol(approvedImage)` instance belongs to one framed session and accepts only the configured lowercase immutable image digest. The production manifest, PHP behavior and public save path are unchanged.

`Accept(raw)` checks the 8192-byte UTF-8 budget before parsing, requires one JSON object of exactly nine fields, rejects duplicate properties (including escaped aliases), requires literal integer version 1, validates scalar types and lowercase identity/receipt formats, derives resource names from the job ID and enforces create-volume → create-container → start-container. Later requests must retain job/token/image/names, use a fresh receipt and target the immutable container ID returned by container creation. A second request cannot be accepted while a prior request awaits completion. A fourth request is rejected.

Successful acceptance returns an immutable `RenderLaunchRequest` with getters for JobId, Token, CommandId, Command, Image, ContainerName, VolumeName and ContainerId. It contains no executable, argument-vector or mount fields. Use this typed object for future fixed command construction. Raw JSON is not forwarded to runtime execution.

`Complete(request, createdContainerId = null)` requires the identical object issued by that instance for its current pending request. Only create-container accepts a non-null completion argument, which must be a lowercase 64-hex immutable ID. Other operations require null; the start reply echoes the recorded container ID automatically. It emits the existing seven-field completed reply and advances the host sequence. **Only verified daemon completion may justify calling Complete in a real dispatcher.** The current tests simulate completion; matching types do not establish resource existence, identity/configuration checks or journal acknowledgement.

Every failed Accept/Complete permanently aborts that instance; corrected input, replay or a later completion cannot resume it. The host calls `Abort()` on dispatch/session failure. Operations are serialized under a private lock; request objects are immutable. State is process-local and intentionally not a replacement for the durable PHP journal. No reset/retry/recovery bypass exists. If reply delivery fails after Complete, host state may have advanced while PHP remains pending; discard the host session and recover from the journal under existing rules.

**Fresh evidence:** `pwsh -NoProfile -File scripts/test-render-launch-protocol.ps1` passes **51 deterministic scenarios** on Windows/PowerShell 7. Cases cover missing/duplicate/extra properties, escaped duplicate names, wrong scalar types and formats, version encodings, length limits, pinned image/resources, property-order independence, complete sequence/reply correlation, receipt replay, changed owner/container identity, in-flight request rejection, completion object identity, explicit abort and invalid completion IDs. This is an initial focused suite, not an exhaustive type/state matrix.

The real PHP composition harness now passes every request through this validator and generates replies with Complete. Fresh `scripts/test-journal-session.ps1` passes **20 scenarios**, retaining durable-intent, lock, interrupted-acknowledgement and startup rejection evidence with scripted host outcomes. No fresh PHP/core, generic framed-session, live Docker or browser run was needed for this C# addition. The latest core evidence remains the J40 review's 334 tests / 2,506 assertions / one existing skip.

J41 is accepted with lead corrections at the latest checkpoint below. Lead next wires fixed Docker dispatch, ownership/configuration inspection and verified daemon completion, followed by recovery and actual host/daemon failure windows. J35 and all public history/browser gates remain blocked.


## J41 host launch protocol acceptance — September 13, 2026

Completed task **J41 — Host launch protocol validation acceptance** extending `RenderLaunchProtocolTests.cs`:
- Verified systematic field and type mutations across all three phases (`create-volume`, `create-container`, `start-container`), enforcing missing property rejection, array and object mutations, primitive type conversions (null, boolean, numeric), and format corruptions.
- Verified duplicate properties across all nine fields, escaped property aliases (`\u0073`, `\u006A`, `\u0074`, `\u0063`, `\u0069`), extraneous properties, deep nesting (>16), exact 8,192-byte limits, multibyte UTF-8 overflows (<8,192 chars, >8,192 bytes), and invalid UTF-16 surrogate pairs (`\uD800`, `\uDFFF`).
- Verified state machine violations: completion before acceptance, null/wrong-session/stale requests, double completion, unexpected non-null IDs on volume/start, invalid creation IDs, explicit abort at every lifecycle stage, and permanent fail-closed poison on failure.
- Verified full valid three-step exchange and all seven reply fields.

Fresh verification:
- Protocol acceptance suite: **344 scenarios passed** on Windows/PowerShell 7 (`scripts/test-render-launch-protocol.ps1`).
- Journal session host acceptance: **20 scenarios passed** on Windows/PowerShell 7 (`scripts/test-journal-session.ps1`).
- PHP style and documentation checks pass.
- Latest core integration result remains historical: **334 tests / 2,506 assertions / 1 existing skip** (no production PHP changes).

Completed pending lead review. Fixed Docker dispatch, verified daemon outcomes, and recovery remain lead-owned. J35 remains blocked. Changes are local and uncommitted.



## J41 lead acceptance — September 13, 2026

Accepted with assertion corrections. Completion rejection tests now try the original valid completion before any later Accept can independently abort the session. Added nine such all-phase cases, later-phase version-token rejection, actual null input and safe diagnostic labels. A targeted temporary-copy mutation allowing a pending completion retry fails the corrected assertion. Production protocol code is unchanged.

Fresh evidence: **368 protocol scenarios and 20 integrated PHP session scenarios**, passing on Windows/PowerShell 7. The junior report above records the earlier 344-case baseline. Core evidence remains historical at 334 tests / 2,506 assertions / one skip; no PHP, generic runner, live Docker or browser run was added. These tests do not establish verified daemon outcomes.

No new junior packet is ready. Lead next implements the fixed operation adapter, validates its command/inventory ordering through a controlled harness and then tests isolated real Docker dispatch. Runtime recovery and host/daemon failure windows remain required before J35 or public history/browser acceptance can proceed.

</details>

## Current asset delivery direction

Revisit asset delivery as part of the MediaWiki extension, using supported MediaWiki storage/media facilities and extension authorization checks. Keep the existing exact source/revision and private-output work where applicable. Do not reintroduce a container worker, host bridge or separate supervisor, including as an optional backend. Page revision persistence must be evaluated independently of this abandoned prototype.
