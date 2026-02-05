<?php
/**
 * Layers Extension Diagnostic Tool v2
 * 
 * Upload this file to extensions/Layers/ and access it directly in browser:
 * http://your-wiki/extensions/Layers/diagnose.php
 * 
 * This will show you the exact error preventing the extension from loading.
 */

error_reporting( -1 );
ini_set( 'display_errors', 1 );

echo "<h1>Layers Extension Diagnostics v2</h1>\n";
echo "<pre>\n";

// 1. Check PHP version and extensions
echo "=== PHP Environment ===\n";
echo "PHP Version: " . PHP_VERSION . "\n";

$requiredExts = [ 'json', 'mbstring', 'mysqli', 'xml' ];
$recommendedExts = [ 'gd', 'imagick', 'intl' ];

echo "\nRequired extensions:\n";
foreach ( $requiredExts as $ext ) {
    echo ( extension_loaded( $ext ) ? "✓" : "✗" ) . " {$ext}\n";
}

echo "\nRecommended extensions:\n";
foreach ( $recommendedExts as $ext ) {
    echo ( extension_loaded( $ext ) ? "✓" : "⚠" ) . " {$ext}" . 
        ( !extension_loaded( $ext ) ? " (missing but may not be critical)" : "" ) . "\n";
}

// 2. Check extension files
echo "\n=== Extension Files ===\n";

$extJson = __DIR__ . '/extension.json';
if ( file_exists( $extJson ) ) {
    $json = json_decode( file_get_contents( $extJson ), true );
    if ( $json === null ) {
        echo "✗ extension.json: INVALID JSON - " . json_last_error_msg() . "\n";
    } else {
        echo "✓ extension.json MediaWiki requirement: " . ( $json['requires']['MediaWiki'] ?? 'NOT SET' ) . "\n";
        echo "✓ Extension version: " . ( $json['version'] ?? 'NOT SET' ) . "\n";
    }
}

// Check critical PHP files for syntax errors
$phpFiles = [
    'services.php',
    'src/Database/LayersDatabase.php',
    'src/Api/ApiLayersInfo.php',
    'src/Hooks.php'
];

echo "\nPHP syntax check:\n";
foreach ( $phpFiles as $file ) {
    $path = __DIR__ . '/' . $file;
    if ( file_exists( $path ) ) {
        $output = [];
        $returnVar = 0;
        exec( 'php -l ' . escapeshellarg( $path ) . ' 2>&1', $output, $returnVar );
        $result = implode( "\n", $output );
        if ( $returnVar === 0 && strpos( $result, 'No syntax errors' ) !== false ) {
            echo "✓ {$file}: OK\n";
        } else {
            echo "✗ {$file}: SYNTAX ERROR\n";
            echo "  " . $result . "\n";
        }
    } else {
        echo "✗ {$file}: FILE NOT FOUND\n";
    }
}

// 3. Try to actually bootstrap MediaWiki
echo "\n=== MediaWiki Bootstrap Test ===\n";

$mwRoot = dirname( dirname( dirname( __FILE__ ) ) );
$webStart = $mwRoot . '/includes/WebStart.php';

if ( !file_exists( $webStart ) ) {
    echo "✗ Cannot find MediaWiki at: {$mwRoot}\n";
} else {
    echo "Found MediaWiki at: {$mwRoot}\n";
    echo "\nAttempting to bootstrap MediaWiki (this will show the real error)...\n\n";
    echo "---BEGIN ERROR OUTPUT---\n";
    
    // Flush output so we see everything before the potential crash
    ob_flush();
    flush();
    
    try {
        // This should trigger the actual error
        chdir( $mwRoot );
        
        // Define MW constant first
        if ( !defined( 'MEDIAWIKI' ) ) {
            define( 'MEDIAWIKI', true );
        }
        if ( !defined( 'MW_ENTRY_POINT' ) ) {
            define( 'MW_ENTRY_POINT', 'index' );
        }
        
        // Try to load MediaWiki - this is where the error should appear
        require_once $webStart;
        
        echo "---END ERROR OUTPUT---\n\n";
        echo "✓ MediaWiki loaded successfully!\n";
        
        // If we get here, MW loaded. Check if Layers is registered.
        if ( class_exists( 'MediaWiki\\MediaWikiServices' ) ) {
            $services = \MediaWiki\MediaWikiServices::getInstance();
            
            // Check if our services are registered
            echo "\n=== Layers Services Check ===\n";
            
            try {
                $layersDb = $services->getService( 'LayersDatabase' );
                echo "✓ LayersDatabase service: registered\n";
            } catch ( Throwable $e ) {
                echo "✗ LayersDatabase service: " . $e->getMessage() . "\n";
            }
        }
        
    } catch ( Throwable $e ) {
        echo "---END ERROR OUTPUT---\n\n";
        echo "✗ CAUGHT ERROR:\n";
        echo "Message: " . $e->getMessage() . "\n";
        echo "File: " . $e->getFile() . "\n";
        echo "Line: " . $e->getLine() . "\n";
        echo "\nStack trace:\n" . $e->getTraceAsString() . "\n";
    }
}

echo "\n</pre>\n";
echo "<hr>";
echo "<h2>What to do next</h2>";
echo "<ol>";
echo "<li>If you see an error above, that's the actual problem</li>";
echo "<li>If this page just shows a 500 error or blank, check your web server error log</li>";
echo "<li>For IIS: Check C:\\inetpub\\logs\\LogFiles\\ or Event Viewer</li>";
echo "<li>For Apache: Check error.log</li>";
echo "</ol>";
