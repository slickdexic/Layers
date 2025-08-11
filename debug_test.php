<?php
// Quick debug script to test Layers extension state
require_once '/path/to/LocalSettings.php';

echo "Testing Layers extension state...\n";

// Check if extension is loaded
if ( class_exists( 'MediaWiki\Extension\Layers\Database\LayersDatabase' ) ) {
	echo "✓ Layers extension classes are loaded\n";
} else {
	echo "✗ Layers extension classes not found\n";
}

// Check hooks registration
$hooks = $GLOBALS['wgHooks'] ?? [];
$layersHooks = [
	'MakeImageLink2',
	'LinkerMakeImageLink',
	'ParserMakeImageParams',
	'ThumbnailBeforeProduceHTML'
];

foreach ( $layersHooks as $hook ) {
	if ( isset( $hooks[$hook] ) ) {
		echo "✓ Hook $hook is registered\n";
	} else {
		echo "✗ Hook $hook is NOT registered\n";
	}
}

// Check config
echo "\nConfig values:\n";
echo "LayersEnable: " . ( $GLOBALS['wgLayersEnable'] ?? 'not set' ) . "\n";
echo "LayersDebug: " . ( $GLOBALS['wgLayersDebug'] ?? 'not set' ) . "\n";

echo "\nDone.\n";
