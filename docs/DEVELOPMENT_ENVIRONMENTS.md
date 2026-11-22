# Maintained development wikis

The project owner's October 25, 2026 direction is **one test wiki per target
MediaWiki version**. This organization advances Milestone 1 / OPS-2 / OPS-3.
It describes the local development setup, not an extension runtime requirement.

## Version layout

| Purpose | Local URL | Core version currently installed | Layers source |
| --- | --- | --- | --- |
| Primary development and owner testing | <http://localhost:8080> | 1.45.3 | The actual working Layers checkout, mounted directly. |
| Compatibility and release-installation testing | <http://localhost:8082> | 1.44.6 | A reviewed public candidate installed on the service's local filesystem; no working-checkout mount. |
| Older-build testing | <http://localhost:8081> | 1.43.6 | The existing separate legacy extension checkout. |

The 8080 lane follows the latest target version through deliberate core updates;
the table records the installed version, not an assertion about the newest
upstream release. The page-history candidate requires MediaWiki 1.44 or newer.
The 1.43 wiki remains available for older Layers builds. The 1.44 test wiki
also enables its bundled Minerva skin for `useskin=minerva` checks; default
Vector remains. [Phone viewer results](PHONE_VIEWER_ACCEPTANCE.md) distinguish
passed checks from the remaining physical-device acceptance.

The existing local Compose project manages the version services. Each wiki keeps
its own settings and uploads outside the Layers repository. The retained 1.44
wiki reuses its existing database and upload data; consolidation does not create
another fresh wiki. Main-wiki settings and the 1.43 setup stay in place.

The owner approved the installed-candidate arrangement on October 27, 2026.
It retains the same 1.44 wiki, database, uploads, accounts, URL and port. Only its
web service was recreated from the same core/base with the public candidate
installed. General catch-all developer logging is disabled for release testing;
explicit channel/error configuration is preserved. The 8080 and 8081 services and
both existing database services were not restarted or replaced.

The local Compose release override keeps this arrangement persistent. Use the
normal combined Compose configuration; passing only the base file explicitly
would bypass the override and restore the earlier working-folder mount. Keep
the private override/settings out of the public extension package. The same
generic [HTTP guard](DEVELOPMENT_HTTP_GUARD.htaccess) protects the test image;
the extension itself acquires no Docker dependency.

November 22 installed candidate: the maintained 1.44.6 wiki on 8082 runs
local candidate `ee6759ed`. All 2,975 package files match the installed
bytes and permissions. The 8082 HTTP guard and prior images are retained.
See the [1.8 acceptance record](RELEASE_1_8_ACCEPTANCE.md).

## Work on the maintained wikis

- Use the appropriate version URL and record which version a result covers.
  Working-folder changes appear on 8080 after normal PHP/ResourceLoader cache
  handling. The 8082 lane remains on its installed candidate: rebuild and install
  a reviewed public-only candidate before claiming changed code passed on 1.44.
  A saved copy in a task directory is not the active extension. Candidate inputs
  must exclude private settings, data, credentials, captures and private Git history;
  pre-publication test candidates must use an explicitly reviewed file allowlist.
- Use the version's existing test accounts and configuration. Keep credentials,
  uploaded files, database exports, logs and local browser captures off GitHub
  and out of release artifacts. Never copy the main wiki's live settings into a
  test packet to make a test run.
- Run [native regressions](NATIVE_REGRESSION_TESTING.md) through MediaWiki's
  isolated test tables and dedicated temporary repositories/logs. Regular
  synthetic fixtures do not need another installed wiki, container or port.
  Avoid concurrent runs against the same test resources.
- Ask the owner before an exceptional test needs another complete installation,
  database clone or web port. Upgrade/destructive tests require an explicit
  recovery plan; do not change the owner's shared test content silently.
- Reuse the maintained services for HTTP/browser acceptance and bounded cache or
  restart checks. Coordinate any interruption of a wiki the owner is using.

## Browser acceptance configuration

`tests/e2e/fixtures.js` reads the file named by `LAYERS_ACCEPTANCE_CONFIG`.
This is a private operator file, not a file supplied by the extension. Keep one
configuration per maintained wiki, outside served checkouts and version control.
The maintained Windows primary-wiki location is
`%LOCALAPPDATA%\Layers\acceptance\mediawiki-145.json`. Other environments may use
any private path supplied through the environment variable.

The file has this shape; the account and password below are placeholders:

```json
{
  "base": "http://localhost:8080",
  "username": "dedicated-test-editor",
  "password": "store-the-real-password-only-in-this-private-file"
}
```

Use the wiki's dedicated test editor and only the rights required by the selected
synthetic fixtures. Do not put credentials in commands, reports or packages.
For example, PowerShell can select the existing configuration and list tests
without editing wiki content:

```powershell
$env:LAYERS_ACCEPTANCE_CONFIG = Join-Path $env:LOCALAPPDATA 'Layers\acceptance\mediawiki-145.json'
npx playwright test --list
```

Individual native browser suites require explicitly provisioned synthetic owners
and may need additional fixture variables documented in their headers. Review
that scope before running them; ordinary saved pages are not write-test fixtures.
The legacy `%TEMP%\layers-original-session.json` lookup is a fallback, not the
maintained configuration location. Keep 8080 primary tests and 8082 installed
compatibility tests identified separately.

## Private working material and HTTP access

The owner approved private-LAN access to the existing primary wiki on November
20 for physical phone/tablet testing. Its operator configuration retains the
localhost binding and adds the private interface only. Request hosts are
allowlisted so MediaWiki generates URLs for the origin being used; unknown hosts
are refused. Existing media-handler tools were preserved when only the web
service was recreated. Reader/editor and harmless private-path checks pass on
both origins, and the checked page revisions and slot hashes are unchanged.
This local configuration and any private environment checkpoint image are not
extension artifacts or deployment dependencies. Keep credentials and settings
outside public packages; preserve the existing HTTP guard when recreating the
test service. A successful check from this PC still needs a real device check.

A checkout mounted into a web server is a served directory, even when its files
are ignored by Git. Wiki read permissions do not automatically protect static
logs, local Markdown documents or development artifacts in that directory.
Production should use a clean extension package, with private settings, logs,
uploads and captures outside served source paths.

The shared 8080/8082 development checkout now has a **local-only root `.htaccess`**
guard, based on the [generic Apache example](DEVELOPMENT_HTTP_GUARD.htaccess).
It permits `resources/` and maintained synthetic `tests/fixtures/assets/`; other
checkout URLs are refused. ResourceLoader, wiki pages, APIs and REST delivery
remain core entry points outside this directory. No application help links
depend on the raw local documentation URLs. Read guides on GitHub or locally.

The example is opt-in development configuration, not a Layers runtime dependency
or an automatic deployment step. Check Apache `mod_rewrite`, override support
and required asset URLs before copying it to a checkout root. Without that
module the example fails closed. Other servers need their own equivalent
access policy; merely copying `.htaccess` to a server that ignores it protects
nothing. Never replace an existing operator configuration blindly.

The local guard is ignored through this repository's local Git exclude file,
with its existing contents preserved. It is not included in the published
extension. **Preserve the root guard**, along with the existing denial files
in `tmp/`, `acceptance/` and `.git/`, during cleanup. No private log, archived
settings or historical evidence was moved, truncated or made readable to fix
the boundary. Moving the retained active log later is a separate operator task.

Validate access with generated harmless canaries only. Do not download real
logs, settings, private documents or archives as a test. The recorded check
proves before/after denial on both supported-version ports, while viewer code,
stylesheet, font, PDF worker and synthetic image assets remain available.
All generated canaries and the temporary flat-file fixture are removed afterward.
This creates no additional wiki, database clone, container or web port.

## Opt-in PC editor accessibility checks

`tests/e2e/editor-accessibility.spec.js` uses the existing private
`LAYERS_ACCEPTANCE_CONFIG`. Also set `LAYERS_ACCESSIBILITY_OWNER` to an already
provisioned synthetic owning page beginning `Layers_`, and
`LAYERS_ACCESSIBILITY_SURFACE` to its exact saved surface ID. Optional
`LAYERS_ACCESSIBILITY_SKIN` accepts `vector-2022` (default) or `vector`.
Run the spec through the maintained Playwright CLI with `--project=chromium
--workers=1` and an output directory outside the served checkout.

After authentication its browser admits same-origin GET traffic only. It checks
keyboard traversal, dialogs, layer controls, rename cancellation and Undo/Redo;
PDFs additionally exercise all counter states and a deliberate contrast failure.
The slide journey tests Cancel/Discard of its own isolated local edits and
reopens the saved copy. It never invokes Save and compares every saved slot and
revision before/after. Preserve the JSON receipts/screenshots with private test
evidence. This is automated qualification, not a manual screen-reader pass.
The existing disposable CI editor job supplies its generated `MW_SERVER`/
`MW_USERNAME`/`MW_PASSWORD` environment instead of a private acceptance file and
runs both themes against `Layers_accessibility_ci`, separate from its other
editor fixture. Never run the CI seeder against a maintained wiki; it verifies
the expected disposable site identity before writing.

## Retired environments

The former task-specific wiki containers are retired. Their unique test data and
logs are retained locally outside the extension, and existing host evidence,
database volumes and images are preserved. They are historical records, not
additional maintained test targets. Do not restart old setup recipes as the
default way to continue a packet.

Removing every old local artifact is separate from keeping the active setup
small. Review retention and data ownership before deleting archives or volumes;
do not recreate the fleet while cleaning up its records. No private configuration
or test archive belongs in the published extension.
