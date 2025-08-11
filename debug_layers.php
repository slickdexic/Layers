<?php
/**
 * Debug script to test layers functionality
 * Run this from the MediaWiki root directory
 */

// Make sure we're in the MediaWiki root
if (!file_exists('LocalSettings.php')) {
    echo "Please run this script from the MediaWiki root directory.\n";
    echo "Usage: php extensions/Layers/debug_layers.php\n";
    exit(1);
}

require_once 'includes/WebStart.php';

use MediaWiki\Extension\Layers\Database\LayersDatabase;

echo "=== Layers Extension Debug ===\n\n";

// Check if extension is loaded
if (class_exists('MediaWiki\Extension\Layers\Database\LayersDatabase')) {
    echo "✓ Layers extension is loaded\n";
} else {
    echo "✗ Layers extension is NOT loaded\n";
    exit(1);
}

// Check config
global $wgLayersEnable, $wgLayersDebug;
echo "LayersEnable: " . ($wgLayersEnable ? 'true' : 'false') . "\n";
echo "LayersDebug: " . ($wgLayersDebug ? 'true' : 'false') . "\n\n";

// Check hooks
global $wgHooks;
$requiredHooks = [
    'ParserMakeImageParams',
    'ThumbnailBeforeProduceHTML', 
    'MakeImageLink2',
    'LinkerMakeImageLink'
];

echo "=== Hook Registration ===\n";
foreach ($requiredHooks as $hook) {
    if (isset($wgHooks[$hook])) {
        echo "✓ $hook is registered\n";
    } else {
        echo "✗ $hook is NOT registered\n";
    }
}

// Test database connectivity
echo "\n=== Database Test ===\n";
try {
    $db = new LayersDatabase();
    echo "✓ LayersDatabase instantiated successfully\n";
    
    // Try to get layer sets for a test image (this will fail gracefully if no images exist)
    $layerSets = $db->getLayerSetsForImage('Test.jpg', 'dummy-sha1');
    echo "✓ Database query executed successfully (found " . count($layerSets) . " layer sets for test)\n";
    
} catch (Exception $e) {
    echo "✗ Database error: " . $e->getMessage() . "\n";
}

// Test ResourceLoader module
echo "\n=== ResourceLoader Test ===\n";
global $wgResourceModules;
if (isset($wgResourceModules['ext.layers'])) {
    echo "✓ ext.layers module is registered\n";
    $module = $wgResourceModules['ext.layers'];
    echo "  Dependencies: " . implode(', ', $module['dependencies'] ?? []) . "\n";
    echo "  Scripts: " . implode(', ', $module['scripts'] ?? []) . "\n";
} else {
    echo "✗ ext.layers module is NOT registered\n";
}

echo "\n=== Summary ===\n";
echo "If all items above show ✓, the extension is properly configured.\n";
echo "If layers still don't show with layers=all, the issue is likely in the parameter processing logic.\n";
echo "Check your MediaWiki debug log for 'Layers:' messages when loading a page with layers=all.\n";
