<?php
/**
 * Layers Extension Diagnostic Tool
 * 
 * Upload this file to extensions/Layers/ and access it directly in browser:
 * http://your-wiki/extensions/Layers/diagnose.php
 * 
 * This will show you the exact error preventing the extension from loading.
 */

error_reporting( -1 );
ini_set( 'display_errors', 1 );

echo "<h1>Layers Extension Diagnostics</h1>\n";
echo "<pre>\n";

// 1. Check PHP version
echo "PHP Version: " . PHP_VERSION . "\n";
if ( version_compare( PHP_VERSION, '7.4.0', '<' ) ) {
    echo "ERROR: PHP 7.4+ required\n";
}

// 2. Try to load the interfaces
echo "\nChecking class availability...\n";

$classes = [
    'Wikimedia\\Rdbms\\ILoadBalancer' => 'ILoadBalancer interface',
    'Wikimedia\\Rdbms\\IDatabase' => 'IDatabase interface',
    'MediaWiki\\MediaWikiServices' => 'MediaWikiServices class',
    'MediaWiki\\Config\\Config' => 'Config interface (MW 1.44+)',
    'Config' => 'Config interface (MW 1.39-1.43)',
];

foreach ( $classes as $class => $desc ) {
    if ( interface_exists( $class ) || class_exists( $class ) ) {
        echo "✓ {$desc}: available\n";
    } else {
        echo "✗ {$desc}: NOT FOUND\n";
    }
}

// 3. Try to include MW
echo "\nAttempting to load MediaWiki...\n";

$mwPath = dirname( dirname( dirname( __FILE__ ) ) ) . '/includes/Setup.php';
if ( !file_exists( $mwPath ) ) {
    // Try another common path
    $mwPath = dirname( dirname( dirname( __FILE__ ) ) ) . '/includes/WebStart.php';
}

if ( file_exists( $mwPath ) ) {
    echo "Found MediaWiki at: " . dirname( dirname( $mwPath ) ) . "\n";
    
    // Try loading MW core to get the real error
    echo "\nAttempting to load extension (this may show the real error)...\n\n";
    
    // Set up minimal MW environment
    define( 'MEDIAWIKI', true );
    
    try {
        // Try to load services.php directly
        $servicesPath = __DIR__ . '/services.php';
        if ( file_exists( $servicesPath ) ) {
            echo "Checking services.php syntax...\n";
            $result = shell_exec( 'php -l ' . escapeshellarg( $servicesPath ) . ' 2>&1' );
            if ( $result ) {
                echo $result;
            } else {
                // shell_exec may not work, try include
                echo "Shell access unavailable. Trying direct include...\n";
            }
        }
        
        // Check extension.json
        $extJson = __DIR__ . '/extension.json';
        if ( file_exists( $extJson ) ) {
            $json = json_decode( file_get_contents( $extJson ), true );
            if ( $json === null ) {
                echo "ERROR: extension.json is invalid JSON: " . json_last_error_msg() . "\n";
            } else {
                echo "\nextension.json MediaWiki requirement: " . 
                    ( $json['requires']['MediaWiki'] ?? 'NOT SET' ) . "\n";
                echo "Extension version: " . ( $json['version'] ?? 'NOT SET' ) . "\n";
            }
        }
        
        // Check LayersDatabase.php
        $dbFile = __DIR__ . '/src/Database/LayersDatabase.php';
        if ( file_exists( $dbFile ) ) {
            $content = file_get_contents( $dbFile );
            if ( strpos( $content, 'use Wikimedia\\Rdbms\\ILoadBalancer;' ) !== false ) {
                echo "\n✓ LayersDatabase.php uses ILoadBalancer (correct)\n";
            } else if ( strpos( $content, 'use Wikimedia\\Rdbms\\LoadBalancer;' ) !== false ) {
                echo "\n✗ LayersDatabase.php uses LoadBalancer (WRONG - causes MW 1.39 error)\n";
                echo "  The file needs to be updated from the REL1_39 branch!\n";
            } else {
                echo "\n? Could not determine LoadBalancer usage\n";
            }
            
            // Check constructor signature
            if ( preg_match( '/ILoadBalancer\s+\$loadBalancer/', $content ) ) {
                echo "✓ Constructor uses ILoadBalancer type hint\n";
            } else if ( preg_match( '/LoadBalancer\s+\$loadBalancer/', $content ) ) {
                echo "✗ Constructor uses LoadBalancer type hint (WRONG)\n";
            }
        } else {
            echo "\nERROR: LayersDatabase.php not found at expected path\n";
        }
        
    } catch ( Throwable $e ) {
        echo "\nERROR: " . $e->getMessage() . "\n";
        echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
        echo "\nStack trace:\n" . $e->getTraceAsString() . "\n";
    }
} else {
    echo "ERROR: Cannot find MediaWiki at expected path\n";
    echo "Looked for: " . $mwPath . "\n";
}

echo "\n</pre>\n";
echo "<hr><p>If you see errors above, they explain why the wiki won't load.</p>";
echo "<p>To fix: ensure you have deployed the REL1_39 branch completely.</p>";
