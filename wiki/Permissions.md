# Permissions

Configure user permissions for the Layers extension.

---

## Available Rights

| Right | Description | Actions Enabled |
|-------|-------------|-----------------|
| `editlayers` | Edit existing layer sets | Modify layers, save revisions |
| `createlayers` | Create new layer sets | Create first revision of a set |
| `managelayerlibrary` | Manage layer library | Administrative functions |

---

## Default Configuration

As defined in `extension.json`:

```php
// Anonymous users (not logged in)
$wgGroupPermissions['*']['editlayers'] = false;

// Logged-in users
$wgGroupPermissions['user']['editlayers'] = true;

// Autoconfirmed users (met age/edit thresholds)
$wgGroupPermissions['autoconfirmed']['createlayers'] = true;

// Administrators
$wgGroupPermissions['sysop']['managelayerlibrary'] = true;
```

---

## Configuration Examples

### Standard Wiki (Default)

Most wikis can use the default configuration:
- All logged-in users can edit existing layers
- Autoconfirmed users can create new layer sets
- Admins have full control

```php
wfLoadExtension( 'Layers' );
// No additional configuration needed
```

### Open Wiki

Allow all registered users to create and edit:

```php
wfLoadExtension( 'Layers' );

$wgGroupPermissions['user']['editlayers'] = true;
$wgGroupPermissions['user']['createlayers'] = true;
```

### Restricted Wiki

Only specific groups can edit layers:

```php
wfLoadExtension( 'Layers' );

// Remove default permissions
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['autoconfirmed']['createlayers'] = false;

// Create a dedicated group
$wgGroupPermissions['layer-editors']['editlayers'] = true;
$wgGroupPermissions['layer-editors']['createlayers'] = true;
```

Add users to the group via `Special:UserRights`.

### Very Restrictive

Only admins can edit layers:

```php
wfLoadExtension( 'Layers' );

$wgGroupPermissions['*']['editlayers'] = false;
$wgGroupPermissions['user']['editlayers'] = false;
$wgGroupPermissions['autoconfirmed']['editlayers'] = false;
$wgGroupPermissions['autoconfirmed']['createlayers'] = false;

$wgGroupPermissions['sysop']['editlayers'] = true;
$wgGroupPermissions['sysop']['createlayers'] = true;
```

### Educational Wiki

Teachers can create, students can edit:

```php
wfLoadExtension( 'Layers' );

// Students (regular users) can edit existing layers
$wgGroupPermissions['user']['editlayers'] = true;

// Only teachers can create new layer sets
$wgGroupPermissions['user']['createlayers'] = false;
$wgGroupPermissions['teacher']['createlayers'] = true;
$wgGroupPermissions['teacher']['editlayers'] = true;
```

---

## Permission Checks

### Editing Layers

To edit existing layer sets:
- User must have `editlayers` right
- User must have read access to the file
- User must not be rate-limited

### Creating Layer Sets

To create new layer sets:
- User must have `createlayers` right
- User must have `editlayers` right
- User must have read access to the file

### Deleting Layer Sets

To delete a named layer set:
- User must be the **owner** (created the first revision), OR
- User must have the `delete` right (typically sysop)

### Renaming Layer Sets

To rename a named layer set:
- User must be the **owner** (created the first revision), OR
- User must have the `delete` right (typically sysop)

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
    // User can edit layers
}

if ( $user->isAllowed( 'createlayers' ) ) {
    // User can create layer sets
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

The "Edit Layers" tab is shown based on permissions:

| Condition | Tab Shown | Tab Clickable |
|-----------|-----------|---------------|
| No `editlayers` right | No | — |
| Has `editlayers` but no `createlayers` | Yes | Yes (can edit existing) |
| Has both rights | Yes | Yes (full access) |

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

Layers respects MediaWiki's permission system:

### Cascading Permissions

If a file is on a protected page with cascading protection, `editlayers` is effectively blocked.

### Namespace Restrictions

Layers only works in the File namespace. The extension doesn't add restrictions beyond file read access.

### Blocked Users

Blocked users cannot edit layers, even if they have `editlayers` right.

---

## Troubleshooting

### "Edit Layers" tab not visible

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
