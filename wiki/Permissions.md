# Permissions

Reviewed October 24, 2026 against the page-owned candidate. Tagged 1.5.95 uses
legacy shared storage. [Migration completion](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/UPGRADING.md) changes the
storage and editing path; it does not grant additional rights.

## Rights and defaults

| Right | Purpose | Default groups |
| --- | --- | --- |
| `editlayers` | Create/edit layers and slides, subject to owner/source checks | Logged-in users and sysops |
| `layers-admin` | Override creator checks on legacy shared rename/delete | Sysops |

Anonymous users do not receive `editlayers` by default. Ordinary MediaWiki
`delete` is not the legacy Layers administrator override. `layers-admin` does
not bypass native owner protection or revision/source visibility checks.

```php
wfLoadExtension( 'Layers' );
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['layer-editors']['editlayers'] = true;
$wgGroupPermissions['sysop']['layers-admin'] = true;
```

Assign custom groups through `Special:UserRights`. Grants across groups combine;
removing one group's grant does not remove another group's grant.

## Page-owned images, PDFs and slides

Editing requires ordinary read/edit authority on the **owning page** and
`editlayers`. Creating an owner also requires the applicable native page creation
right. Blocks, page protection and rate limits still apply. Save is a
CSRF-protected POST and checks the current owner revision and source again.

Reading requires access to the owner, its exact requested revision and the
source. Suppression or unavailable sources can prevent historical viewing.
Access must be refused rather than silently using another revision, file
version or PDF page.

A File page and an article embedding that file are different owners. File-page
edit permission does not authorize the article's sets. Slides also belong to
the page containing their saved snapshot and follow its native edit policy.

Import rechecks target edit authority and exact source visibility. A listing,
preview or earlier read is not lasting permission to apply or save. Internal
owner IDs are transport identity, not wikitext or authorization tokens.

## Visibility is not authorization

`noedit`, legacy `editable=no`, a hidden toolbar and a locked layer control the
interface. They do not replace server checks. Overlays offer editing only when
authorized; hiding a button is not a security boundary.

Test third-party access-control extensions against the intended deployment,
including cached output, historical views, source listings and exports. Current
binding reads can use the configured anonymous cache policy; control, historical
and full-source responses have stricter policies. See the
[API guide](https://github.com/slickdexic/Layers/blob/codex/l01-publication-admission/docs/PAGE_OWNED_API_GUIDE.md).

## History and exports

After completion, layer changes are captured in native owner-page history.
`LayersTrackChangesInRecentChanges` and legacy per-set revision caps do not
control that history. Draft recovery remains local until Save succeeds. Native
history operations retain their MediaWiki rights and visibility rules.

The full-size viewer exports admitted saved content, rechecking access and exact
sources. Images/slides offer PNG first and a PDF choice; PDFs offer PDF only.
An old viewer descriptor or delivery URL is not permanent access.

## Legacy shared storage

Before cutover, file saves require `editlayers`, source access and File-page
edit authority; shared slides lack the native owner binding. Rename/delete also
require creator ownership or `layers-admin`, checked for every affected PDF
page. The server generates creator metadata; clients cannot assign ownership.
Unknown old creator identity requires the override for destructive operations.

Completion makes shared writes read-only. The retained `layerspdfexport` /
`Special:LayersExport` server path reads legacy content and is separate from
page-owned viewer export. Keep its configured cache outside the document root.
