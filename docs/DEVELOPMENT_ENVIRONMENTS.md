# Maintained development wikis

The project owner's October 25, 2026 direction is **one test wiki per target
MediaWiki version**. This organization advances Milestone 1 / OPS-2 / OPS-3.
It describes the local development setup, not an extension runtime requirement.

## Version layout

| Purpose | Local URL | Core version currently installed | Layers source |
| --- | --- | --- | --- |
| Primary development and owner testing | <http://localhost:8080> | 1.45.3 | The actual working Layers checkout, mounted directly. |
| Compatibility testing | <http://localhost:8082> | 1.44.6 | The same working Layers checkout, mounted directly. |
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

## Work on the maintained wikis

- Use the appropriate version URL and record which version a result covers.
  Changes to the shared checkout appear on both supported-version wikis after
  the normal PHP/ResourceLoader cache handling. A saved copy in a task directory
  is not the active extension.
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

## Private working material and HTTP access

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
