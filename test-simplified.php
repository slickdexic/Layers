<?php

echo "Testing simplified layer transform approach...\n";

// Check that the problematic parser function is removed
if ( file_exists( __DIR__ . '/src/Hooks/WikitextHooks.php' ) ) {
	echo "  ✗ WikitextHooks.php still exists (should be removed)\n";
} else {
	echo "  ✓ WikitextHooks.php removed\n";
}

// Check extension.json
$extensionJson = file_get_contents( __DIR__ . '/extension.json' );
$config = json_decode( $extensionJson, true );

if ( isset( $config['Hooks']['ParserFirstCallInit'] ) ) {
	echo "  ✗ ParserFirstCallInit hook still registered\n";
} else {
	echo "  ✓ ParserFirstCallInit hook removed\n";
}

if ( isset( $config['Hooks']['BitmapHandlerTransform'] ) ) {
	echo "  ✓ BitmapHandlerTransform hook still registered\n";
} else {
	echo "  ✗ BitmapHandlerTransform hook missing\n";
}

// Check LayersFileTransform.php
$transformFile = file_get_contents( __DIR__ . '/src/LayersFileTransform.php' );

if ( strpos( $transformFile, 'getLayerSetsForImage' ) !== false ) {
	echo "  ✓ Auto-detection logic added\n";
} else {
	echo "  ✗ Auto-detection logic not found\n";
}

if ( strpos( $transformFile, 'layeredfile' ) !== false ) {
	echo "  ✗ Still contains parser function references\n";
} else {
	echo "  ✓ No parser function references\n";
}

echo "\nTest complete.\n";
