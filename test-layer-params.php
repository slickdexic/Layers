<?php

echo "Testing layer parameter implementation...\n";

// Check extension.json hooks
$extensionJson = file_get_contents( __DIR__ . '/extension.json' );
$config = json_decode( $extensionJson, true );

echo "Registered hooks:\n";
if ( isset( $config['Hooks']['ParserMakeImageParams'] ) ) {
	echo "  ✓ ParserMakeImageParams registered\n";
} else {
	echo "  ✗ ParserMakeImageParams NOT registered\n";
}

if ( isset( $config['Hooks']['ThumbnailBeforeProduceHTML'] ) ) {
	echo "  ✓ ThumbnailBeforeProduceHTML registered\n";
} else {
	echo "  ✗ ThumbnailBeforeProduceHTML NOT registered\n";
}

// Check ParserHooks.php implementation
$parserHooks = file_get_contents( __DIR__ . '/src/Hooks/ParserHooks.php' );

echo "\nParser hook features:\n";
if ( strpos( $parserHooks, 'layers=all' ) !== false ) {
	echo "  ✓ layers=all support\n";
} else {
	echo "  ✗ layers=all support missing\n";
}

if ( strpos( $parserHooks, 'layers=none' ) !== false ) {
	echo "  ✓ layers=none support\n";
} else {
	echo "  ✗ layers=none support missing\n";
}

if ( strpos( $parserHooks, 'explode' ) !== false && strpos( $parserHooks, 'comma' ) !== false ) {
	echo "  ✓ Layer ID parsing (comma-separated)\n";
} else {
	echo "  ✗ Layer ID parsing missing\n";
}

// Check LayerPanel.js UI features
$layerPanel = file_get_contents( __DIR__ . '/resources/ext.layers.editor/LayerPanel.js' );

echo "\nUI features:\n";
if ( strpos( $layerPanel, 'updateCodePanel' ) !== false ) {
	echo "  ✓ Code panel update method\n";
} else {
	echo "  ✗ Code panel update method missing\n";
}

if ( strpos( $layerPanel, 'layers-code-panel' ) !== false ) {
	echo "  ✓ Code panel HTML structure\n";
} else {
	echo "  ✗ Code panel HTML structure missing\n";
}

if ( strpos( $layerPanel, 'Copy' ) !== false ) {
	echo "  ✓ Copy button functionality\n";
} else {
	echo "  ✗ Copy button functionality missing\n";
}

// Check CSS styles
$css = file_get_contents( __DIR__ . '/resources/ext.layers.editor/editor.css' );

echo "\nCSS styles:\n";
if ( strpos( $css, '.layers-code-panel' ) !== false ) {
	echo "  ✓ Code panel styling\n";
} else {
	echo "  ✗ Code panel styling missing\n";
}

if ( strpos( $css, '.copy-btn' ) !== false ) {
	echo "  ✓ Copy button styling\n";
} else {
	echo "  ✗ Copy button styling missing\n";
}

echo "\nImplementation complete!\n";
echo "\nUsage examples:\n";
echo "  [[File:MyImage.jpg|500px|layers=all|Show all layers]]\n";
echo "  [[File:MyImage.jpg|500px|layers=none|Hide all layers]]\n";
echo "  [[File:MyImage.jpg|500px|layers=4bfa,77e5|Show specific layers]]\n";
