# Postmortem: Iframe Modal Editor 500 Error (February 2026)

## Summary

**Bug:** Clicking "Edit layers" on an image from an article page (iframe modal) returned HTTP 500 Internal Server Error, while:
- Direct navigation to the editor URL worked fine
- Slide editing via iframe modal worked fine
- Anonymous users saw a permission denied page (HTTP 200), not an error

**Root Cause:** `EditLayersAction.php` called `$out->allowClickjacking()` directly without checking if the method exists. This method was deprecated in MediaWiki 1.43 and removed in 1.44, causing a fatal PHP error.

**Time to Resolution:** Multiple debugging sessions across several days due to misleading symptoms.

**Severity:** Critical - completely blocked image layer editing via modal for all authenticated users.

---

## Timeline

### How the Bug Was Introduced

**Commit:** `4f610d8c` (February 12, 2026) - "Remove MW <1.44 compatibility code"

This commit updated `EditLayersAction.php` to require MediaWiki 1.44+ and removed backward compatibility code. However, it **directly called `allowClickjacking()`** without the `method_exists()` guard that `SpecialEditSlide.php` already had:

```php
// EditLayersAction.php (BROKEN - introduced in commit)
if ( $isModalMode ) {
    $out->allowClickjacking();  // FATAL ERROR in MW 1.44!
}

// SpecialEditSlide.php (WORKING - had protection)
if ( $isModalMode ) {
    if ( method_exists( $out, 'allowClickjacking' ) ) {
        $out->allowClickjacking();
    } elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {
        $out->setPreventClickjacking( false );
    }
}
```

### Why It Went Unnoticed During Development

1. **The method was deprecated, not removed, in MW 1.43** - It still worked in 1.43
2. **Testing on MW 1.44 was done with direct navigation**, not iframe modal
3. **Anonymous testing showed permission denied**, which looked like expected behavior
4. **The error only manifested for authenticated users in iframe context**

---

## Symptoms That Made This Hard to Debug

### Symptom 1: Different Behavior Based on Authentication

| User State | HTTP Status | What User Sees |
|------------|-------------|----------------|
| Anonymous (curl) | 200 | Permission denied page |
| Anonymous (browser) | 200 | Permission denied page |
| Authenticated (direct URL) | 200 | Editor loads correctly |
| Authenticated (iframe) | 500 | Blank iframe, console error |

**Why this was confusing:** The error only occurred for authenticated users in iframe context, making it seem like a session/cookie problem.

### Symptom 2: Console Error Message Was Misleading

```
GET http://192.168.77.33:8080/index.php/File:ImageTest02.jpg?action=editlayers&setname=005&modal=1 
net::ERR_CONTENT_LENGTH_MISMATCH 500 (Internal Server Error)
```

**Why this was confusing:** `ERR_CONTENT_LENGTH_MISMATCH` suggested a response truncation issue, not a PHP fatal error. This led to investigations of:
- Output buffering issues
- Content-Length header problems
- Apache/PHP output handling

### Symptom 3: Slides Worked, Images Didn't

Both use iframe modals (`LayersEditorModal.js`), but:
- Slides (`SpecialEditSlide.php`) → HTTP 200 ✓
- Images (`EditLayersAction.php`) → HTTP 500 ✗

**Why this was confusing:** This made it seem like the problem was specific to File: namespace handling, Action classes vs SpecialPage classes, or permission checking differences.

### Symptom 4: No PHP Error Logs

- PHP's `log_errors` was `Off` in the container
- MediaWiki's error handling caught the fatal but returned 500
- The Layers extension log showed normal execution up until the crash

**Why this was confusing:** Without stack traces, we couldn't see where the actual failure occurred.

### Symptom 5: Permission Check Worked

The logs showed:
```
EditLayersAction::show - user=Paul, id=2, registered=yes
EditLayersAction::show - hasPermission=yes
```

**Why this was confusing:** Permission checks passed, so the user WAS authenticated. This ruled out session/cookie issues (which were investigated extensively).

---

## Incorrect Theories That Were Pursued

### Theory 1: Browser Cookie/SameSite Restrictions (WRONG)

**Hypothesis:** Modern browsers block third-party cookies in iframes, preventing session authentication.

**Investigation:** Rewrote `LayersEditorModal.js` from iframe to popup window approach.

**Why it was wrong:** 
- Slides use the same iframe approach and work fine
- Same-origin iframes don't have SameSite restrictions
- The user WAS authenticated (logs proved it)

**Time wasted:** ~2 hours of code changes that had to be reverted.

### Theory 2: Authority API vs PermissionManager (WRONG)

**Hypothesis:** The `getAuthority()->isAllowed()` API doesn't work correctly in iframe context.

**Investigation:** Changed permission checking to match `SpecialEditSlide.php` pattern.

**Why it was wrong:** Permission checks passed. The error occurred AFTER permission was granted.

**Time wasted:** ~1 hour investigating permission APIs.

### Theory 3: Action Class vs SpecialPage Execution Order (WRONG)

**Hypothesis:** Something in how MediaWiki dispatches Actions prevents proper user context propagation.

**Investigation:** Added debug logging to `checkCanExecute()` override.

**Why it was wrong:** `checkCanExecute()` was never even called because the crash happened in `show()`.

---

## The Actual Root Cause

### The Fatal Call

```php
// Line 123 in EditLayersAction.php (before fix)
$out->allowClickjacking();
```

### Why This Crashes in MW 1.44

MediaWiki 1.44 removed `OutputPage::allowClickjacking()`. The replacement is:
```php
$out->getMetadata()->setPreventClickjacking( false );
// or
$out->setPreventClickjacking( false );  // deprecated but still works
```

### Why Anonymous Users Don't See the Error

Anonymous users fail the permission check at line 71:
```php
if ( !$hasPermission ) {
    throw new \PermissionsError( 'editlayers' );  // Exits here
}
```

They never reach line 123 where `allowClickjacking()` is called.

### Why Direct Navigation Works

When navigating directly (not iframe), `$isModalMode` is `false`:
```php
$isModalMode = $request->getBool( 'modal' );  // false without ?modal=1

if ( $isModalMode ) {  // This block is skipped
    $out->allowClickjacking();  // Never called
}
```

### Why Slides Work

`SpecialEditSlide.php` had a protective `method_exists()` check:
```php
if ( $isModalMode ) {
    if ( method_exists( $out, 'allowClickjacking' ) ) {  // Returns false in MW 1.44
        $out->allowClickjacking();
    } elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {  // Used instead
        $out->setPreventClickjacking( false );
    }
}
```

---

## The Fix

### Code Change

```diff
- if ( $isModalMode ) {
-     // Allow the page to be framed (loaded in iframe) for modal editor
-     // Otherwise MediaWiki's default X-Frame-Options header blocks it
-     $out->allowClickjacking();
- }
+ if ( $isModalMode ) {
+     // Use method_exists for compatibility across MediaWiki versions
+     // allowClickjacking was deprecated in MW 1.43
+     if ( method_exists( $out, 'allowClickjacking' ) ) {
+         $out->allowClickjacking();
+     } elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {
+         $out->setPreventClickjacking( false );
+     }
+ }
```

### File Changed

`src/Action/EditLayersAction.php` - Lines 115-127

---

## Why This Bug Was So Hard to Find

### 1. Conditional Execution Path

The bug only occurred when ALL of these conditions were true:
- ✅ User is authenticated (has editlayers permission)
- ✅ Request includes `?modal=1` parameter (iframe mode)
- ✅ Method `allowClickjacking()` doesn't exist (MW 1.44+)

### 2. Silent Fatal Error

- PHP's `log_errors = Off` in the container
- MediaWiki returned HTTP 500 without exposing the error
- No stack trace in any log file

### 3. Misleading HTTP Status Code Pattern

The pattern of "anonymous=200, authenticated=500" looked like a session/permission issue, not a code crash.

### 4. Working Reference Implementation

`SpecialEditSlide.php` worked correctly, so comparing the two files should have revealed the difference faster. However, the permission checking code (which was similar) distracted from the `allowClickjacking()` difference.

### 5. Removed Deprecated Method (Not Just Changed)

Deprecated methods usually still work. This one was completely removed, causing a fatal "Call to undefined method" error.

---

## Lessons Learned

### 1. Always Use method_exists() for MediaWiki Output Methods

MediaWiki frequently deprecates and removes methods. Always guard calls to OutputPage methods:

```php
// WRONG
$out->someMethod();

// RIGHT
if ( method_exists( $out, 'someMethod' ) ) {
    $out->someMethod();
} else {
    // Use alternative
}
```

### 2. When Removing Compatibility Code, Check ALL Files

The commit that "removed MW <1.44 compatibility code" should have ensured ALL files used the same pattern. `SpecialEditSlide.php` had the guard; `EditLayersAction.php` did not.

### 3. Test Modal/Iframe Paths Specifically

The direct URL test passed. The modal iframe test failed. Always test:
- Direct navigation to editor
- Modal iframe opening (from article page)
- With authenticated user
- With anonymous user

### 4. Enable PHP Error Logging in Development

```ini
log_errors = On
error_log = /var/log/php_errors.log
```

This would have shown the fatal error immediately.

### 5. Don't Trust HTTP Status Codes Alone

HTTP 500 from an authenticated user doesn't mean "authentication failed" - it means "code crashed after authentication succeeded."

### 6. Compare Working vs Non-Working Code Systematically

When one feature works (slides) and another doesn't (images), do a line-by-line diff of the relevant code paths, not just the areas you suspect.

---

## Prevention Checklist

Before any PR that touches editor loading code:

- [ ] Test direct navigation to editor (not in iframe)
- [ ] Test modal/iframe opening from article page
- [ ] Test with authenticated user who has editlayers permission
- [ ] Test with anonymous user
- [ ] Search for direct calls to OutputPage methods without `method_exists()`
- [ ] Ensure all similar files use the same patterns (e.g., EditLayersAction.php and SpecialEditSlide.php)
- [ ] Check MediaWiki deprecation notices in browser console

---

## Files Involved

| File | Role | Status |
|------|------|--------|
| `src/Action/EditLayersAction.php` | Handles `?action=editlayers` for File: pages | **FIXED** |
| `src/SpecialPages/SpecialEditSlide.php` | Handles Special:EditSlide for slides | Already had fix |
| `resources/ext.layers.modal/LayersEditorModal.js` | Creates iframe for modal editing | No changes needed |
| `resources/ext.layers/viewer/SlideController.js` | Uses LayersEditorModal for slides | No changes needed |
| `resources/ext.layers/viewer/ViewerOverlay.js` | Uses LayersEditorModal for images | No changes needed |

---

## Related Documentation

- [POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md](POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md) - Another bug that resurfaced multiple times
- [MediaWiki 1.44 Release Notes](https://www.mediawiki.org/wiki/Release_notes/1.44) - Deprecation removals

---

## Summary

**The bug:** `allowClickjacking()` was removed in MW 1.44, but `EditLayersAction.php` called it directly.

**Why so hard to find:** The error only occurred for authenticated users in iframe mode, making it look like a session/permission issue.

**The fix:** Add `method_exists()` check, matching the pattern already in `SpecialEditSlide.php`.

**Key lesson:** When removing "compatibility code," ensure ALL files that need the same fix are updated together.
