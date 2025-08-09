<?php
/**
 * Simple permission debug script for the Layers extension.
 *
 * Usage: Visit a file page with ?action=debug to see checks.
 *
 * phpcs:disable MediaWiki.Usage.SuperGlobalsUsage.SuperGlobals,Generic.WhiteSpace
 */

if ( isset( $_GET['action'] ) && $_GET['action'] === 'debug' ) {
    echo '<h2>Layers Extension Debug</h2>';

    echo '<h3>Basic Checks:</h3>';
    echo '<ul>';

    // Check if extension is loaded
    if ( class_exists( 'ExtensionRegistry' ) && ExtensionRegistry::getInstance()->isLoaded( 'Layers' ) ) {
        echo '<li>✅ Layers extension is loaded</li>';
    } else {
        echo '<li>❌ Layers extension is NOT loaded</li>';
    }

    // Check MediaWiki globals
    global $wgGroupPermissions;
    if ( isset( $wgGroupPermissions['user']['editlayers'] ) ) {
        $val = $wgGroupPermissions['user']['editlayers'] ? 'true' : 'false';
        echo '<li>✅ editlayers permission is defined for user group: ' . $val . '</li>';
    } else {
        echo '<li>❌ editlayers permission is NOT defined for user group</li>';
    }

    // Check current user (avoid deprecated $wgUser)
    $dbgUser = null;
    try {
        if ( class_exists( '\\RequestContext' ) ) {
            $ctx = \call_user_func( [ '\\RequestContext', 'getMain' ] );
            if ( $ctx && method_exists( $ctx, 'getUser' ) ) {
                $dbgUser = $ctx->getUser();
            }
        }
    } catch ( \Throwable $e ) {
    }
    if ( $dbgUser && method_exists( $dbgUser, 'isAllowed' ) ) {
        $canEdit = $dbgUser->isAllowed( 'editlayers' );
        echo '<li>Current user editlayers permission: ' . ( $canEdit ? '✅ YES' : '❌ NO' ) . '</li>';
        echo '<li>User is logged in: ' . ( $dbgUser->isLoggedIn() ? '✅ YES' : '❌ NO' ) . '</li>';
        echo '<li>User groups: ' . implode( ', ', $dbgUser->getGroups() ) . '</li>';
    } else {
        echo '<li>❌ Cannot check user permissions</li>';
    }

    // Check if this is a file page without relying on deprecated $wgTitle
    $title = null;
    try {
        if ( class_exists( '\\RequestContext' ) ) {
            $ctx = \call_user_func( [ '\\RequestContext', 'getMain' ] );
            if ( $ctx && method_exists( $ctx, 'getTitle' ) ) {
                $title = $ctx->getTitle();
            }
        }
    } catch ( \Throwable $e ) {
        // ignore
    }
    if ( $title ) {
        echo '<li>Current page: ' . $title->getFullText() . '</li>';
        $isFile = $title->inNamespace( NS_FILE ) ? '✅ YES' : '❌ NO';
        echo '<li>Is file page: ' . $isFile . '</li>';
    }

    echo '</ul>';

    echo '<h3>Hook Debug:</h3>';
    echo '<p>Add ?layersdebug=1 to the URL to enable debug logging in the UI hooks.</p>';

    exit;
}
