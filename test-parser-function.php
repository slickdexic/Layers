<?php

// Simple test for the parser function - no MediaWiki dependencies
echo "Testing parser function registration...\n";

// Check if the function is being registered in extension.json
$extensionJson = file_get_contents( __DIR__ . '/extension.json' );
$config = json_decode( $extensionJson, true );

echo "Hooks registered in extension.json:\n";
if ( isset( $config['Hooks'] ) ) {
	foreach ( $config['Hooks'] as $hook => $handlers ) {
		echo "  $hook\n";
	}
}

echo "\nParserFunctions registered in extension.json:\n";
if ( isset( $config['ParserFunctions'] ) ) {
	foreach ( $config['ParserFunctions'] as $func => $handler ) {
		echo "  $func -> $handler\n";
	}
} else {
	echo "  None found\n";
}

echo "\nChecking WikitextHooks.php for parser function code...\n";
$hooksFile = file_get_contents( __DIR__ . '/src/Hooks/WikitextHooks.php' );
if ( strpos( $hooksFile, 'onParserFirstCallInit' ) !== false ) {
	echo "  ✓ onParserFirstCallInit method found\n";
} else {
	echo "  ✗ onParserFirstCallInit method NOT found\n";
}

if ( strpos( $hooksFile, 'renderLayeredFile' ) !== false ) {
	echo "  ✓ renderLayeredFile method found\n";
} else {
	echo "  ✗ renderLayeredFile method NOT found\n";
}

if ( strpos( $hooksFile, '#layeredfile' ) !== false ) {
	echo "  ✓ #layeredfile parser function found\n";
} else {
	echo "  ✗ #layeredfile parser function NOT found\n";
}

echo "\nTest complete.\n";
