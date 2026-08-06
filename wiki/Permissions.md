# Permissions

Configure user permissions for the Layers extension.

---

## Available Rights

| Right | Description | Actions Enabled |
|-------|-------------|-----------------|
| `editlayers` | Create and edit layer sets | Open editor, create sets, modify layers, save revisions |
| `layers-admin` | Administer layer data | Delete or rename any layer set or slide, regardless of who created it |

---

## Default Configuration

As defined in `extension.json`:

```php
// Anonymous users (not logged in)
$wgGroupPermissions['*']['editlayers'] = false;

// Logged-in users
$wgGroupPermissions['user']['editlayers'] = true;

// Administrators
$wgGroupPermissions['sysop']['editlayers'] = true;
$wgGroupPermissions['sysop']['layers-admin'] = true;
```

---

## Configuration Examples

### Standard Wiki (Default)

Most wikis can use the default configuration:
- All logged-in users can create and edit layers
- Admins have full control including library management

```php
wfLoadExtension( 'Layers' );
// No additional configuration needed
```

### Restricted Wiki

Only specific groups can edit layers:

```php
wfLoadExtension( 'Layers' );

// Remove default permissions
$wgGroupPermissions['user']['editlayers'] = false;

// Create a dedicated group
$wgGroupPermissions['layer-editors']['editlayers'] = true;
```

Add users to the group via `Special:UserRights`.

### Very Restrictive

Only admins can edit layers:

```php
wfLoadExtension( 'Layers' );

$wgGroupPermissions['*']['editlayers'] = false;
$wgGroupPermissions['user']['editlayers'] = false;

$wgGroupPermissions['sysop']['editlayers'] = true;
```

---

## Permission Checks

### Editing Layers

To create or edit layer sets:
- User must have `editlayers` right
- User must have read access to the file
- **User must have `edit` permission on the file's page** (since v1.5.80)
- User must not be rate-limited

### Deleting Layer Sets

To delete a named layer set:
- User must have `edit` permission on the file's page
- User must be the **owner** (created the first revision), OR
- User must have the `delete` right (typically sysop)

### Renaming Layer Sets

To rename a named layer set:
- User must have `edit` permission on the file's page
- User must be the **owner** (created the first revision), OR
- User must have the `delete` right (typically sysop)

### Why the `edit` permission is required

Layer data changes what a File page renders, so it is content. Before v1.5.80
the write endpoints (`layerssave`, `layersdelete`, `layersrename`) checked only
the global `editlayers` right, which meant page protection, namespace
protection, cascading protection and blocks were all bypassed: a blocked user,
or any user with `editlayers`, could alter the rendered output of a fully
protected File page.

All three endpoints now additionally require ordinary `edit` permission on the
file's title.

⚠️ **This is a behaviour change.** On wikis that restrict editing in `NS_FILE` —
for example via `$wgNamespaceProtection[NS_FILE]`, cascading protection from a
transcluding page, or individual page protection — layer saves that previously
succeeded will now be rejected with a normal MediaWiki permission error. If you
want a group to annotate files it cannot otherwise edit, grant that group the
`edit` right on the File namespace.

---

## Rate Limiting

In addition to permission checks, rate limiting applies:

```php
// Limit saves for regular users
$wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];  // 30 per hour

// Stricter limits for new users
$wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ]; // 5 per hour

// Limit new set creation
$wgRateLimits['editlayers-create']['user'] = [ 10, 3600 ]; // 10 per hour
```

---

## Checking User Rights

### In PHP

```php
$user = $this->getUser();

if ( $user->isAllowed( 'editlayers' ) ) {
    // User can create and edit layers
}
```

### In JavaScript

```javascript
if ( mw.config.get( 'wgUserGroups' ).includes( 'sysop' ) ) {
    // User is admin
}

// Or check via API
const api = new mw.Api();
const response = await api.get({
    action: 'query',
    meta: 'userinfo',
    uiprop: 'rights'
});

if ( response.query.userinfo.rights.includes( 'editlayers' ) ) {
    // User can edit layers
}
```

---

## UI Visibility

The "Edit layers" tab is shown based on permissions:

| Condition | Tab Shown | Tab Clickable |
|-----------|-----------|---------------|
| No `editlayers` right | No | — |
| Has `editlayers` right | Yes | Yes (full access) |

---

## Ownership

### Who is the Owner?

The owner of a named layer set is the user who created the **first revision** of that set.

### Owner Privileges

Owners can:
- Delete the layer set
- Rename the layer set

### Transferring Ownership

Ownership cannot be directly transferred. Workaround:
1. Admin deletes the set
2. New owner creates a new set with the same content

---

## Integration with MediaWiki

Layers respects MediaWiki's permission system. Every statement in this section
became true in **v1.5.80**; on earlier versions the write endpoints checked only
the `editlayers` right and none of these restrictions were enforced.

### Cascading Permissions

If a file is on a protected page with cascading protection, layer writes are
blocked, because cascading protection removes `edit` on the file's title.

### Namespace Restrictions

Layers only works in the File namespace. Layer writes require `edit` permission
on the file's page, so `$wgNamespaceProtection[NS_FILE]` restricts them too.

### Blocked Users

Blocked users cannot edit layers, even if they have `editlayers` right.

---

## Troubleshooting

### "Edit layers" tab not visible

1. Check `$wgGroupPermissions` in LocalSettings.php
2. Verify user is logged in (if required)
3. Check Special:UserRights for user's groups
4. Ensure `$wgLayersEnable = true`

### "Permission denied" error

1. User may lack required right
2. User may be blocked
3. File may have cascading protection
4. User may be rate-limited

### Users can view but not edit

Check that users have `editlayers` right, not just read access.

---

## See Also

- [[Configuration Reference]] — All settings
- [[Installation]] — Setup guide
- [[Troubleshooting]] — Common issues
