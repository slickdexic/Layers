<?php
/**
 * Simple permission debug script for Layers extension
 * To be run from a MediaWiki file page URL with ?action=debug
 */

// This is a simple diagnostic that can be added to test permission issues
if ( isset( $_GET['action'] ) && $_GET['action'] === 'debug' ) {
    echo "<h2>Layers Extension Debug</h2>";
    
    echo "<h3>Basic Checks:</h3>";
    echo "<ul>";
    
    // Check if extension is loaded
    if ( class_exists( 'ExtensionRegistry' ) && ExtensionRegistry::getInstance()->isLoaded( 'Layers' ) ) {
        echo "<li>✅ Layers extension is loaded</li>";
    } else {
        echo "<li>❌ Layers extension is NOT loaded</li>";
    }
    
    // Check MediaWiki globals
    global $wgGroupPermissions;
    if ( isset( $wgGroupPermissions['user']['editlayers'] ) ) {
        echo "<li>✅ editlayers permission is defined for user group: " . ($wgGroupPermissions['user']['editlayers'] ? 'true' : 'false') . "</li>";
    } else {
        echo "<li>❌ editlayers permission is NOT defined for user group</li>";
    }
    
    // Check current user
    global $wgUser;
    if ( $wgUser && method_exists( $wgUser, 'isAllowed' ) ) {
        $canEdit = $wgUser->isAllowed( 'editlayers' );
        echo "<li>Current user editlayers permission: " . ($canEdit ? '✅ YES' : '❌ NO') . "</li>";
        echo "<li>User is logged in: " . ($wgUser->isLoggedIn() ? '✅ YES' : '❌ NO') . "</li>";
        echo "<li>User groups: " . implode(', ', $wgUser->getGroups()) . "</li>";
    } else {
        echo "<li>❌ Cannot check user permissions</li>";
    }
    
    // Check if this is a file page
    global $wgTitle;
    if ( $wgTitle ) {
        echo "<li>Current page: " . $wgTitle->getFullText() . "</li>";
        echo "<li>Is file page: " . ($wgTitle->inNamespace( NS_FILE ) ? '✅ YES' : '❌ NO') . "</li>";
    }
    
    echo "</ul>";
    
    echo "<h3>Hook Debug:</h3>";
    echo "<p>Add ?layersdebug=1 to the URL to enable debug logging in the UI hooks.</p>";
    
    exit;
}
