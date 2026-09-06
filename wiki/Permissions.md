# Permissions

Reviewed September 6, 2026. Rights come from `extension.json`; write checks live in the API modules and shared helpers.

## Rights and defaults

| Right | Purpose | Default groups |
| --- | --- | --- |
| `editlayers` | Create/edit annotation sets and slides | Logged-in users and sysops |
| `layers-admin` | Delete/rename sets without being their creator | Sysops |

Anonymous users do not receive `editlayers` by default. Ordinary MediaWiki `delete` is **not** the Layers administrator override.

```php
wfLoadExtension( 'Layers' );
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['layer-editors']['editlayers'] = true;
$wgGroupPermissions['sysop']['layers-admin'] = true;
```

Assign custom groups through `Special:UserRights`. MediaWiki combines granted rights across groups; removing one group's grant does not remove a grant from another group.

## Image and PDF writes

Creating/saving requires `editlayers`, source read access and ordinary edit authority on the File page. Page protection, blocks and rate limits still apply. POST requests require a CSRF token.

Deleting or renaming additionally requires the original creator or `layers-admin`. For a document-wide operation (`allpages`), every affected PDF page's set must be authorized. Owning the current page's set does not authorize another creator's set on another page.

Newly saved revisions carry server-generated creator metadata so pruning does not transfer ownership to a later editor. If an old set's creator revision was already pruned and no metadata survives, deletion/renaming requires `layers-admin`; editing remains possible. The server never accepts a client-supplied owner assignment.

## Standalone slides

Slides use Layers-specific data identities and global Layers/read checks. They are not yet bound to an owning SOP article's revision or protection policy. Do not assume protecting the page containing `{{#Slide:...}}` protects the underlying shared slide. Page-owned publication is planned; see [[Current Status]].

## Visibility is not authorization

`noedit`, `editable=no`, a hidden toolbar and a locked drawing layer are interface controls, not access controls. A user with API authorization may still edit. Read restrictions also need consideration in cached content, exports and slide listings; test any third-party access-control extension with your deployment.

## History and exports

The legacy `LayersTrackChangesInRecentChanges` setting does not guarantee an audit trail. Layer-set revisions are separate from article history.

Server PDF export requires a CSRF-protected POST; downloading an existing export checks source access through `Special:LayersExport`. Keep export files outside the document root. See [[Configuration Reference]] and [[Current Status]].
