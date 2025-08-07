<?php

echo "Debugging layers=all parameter flow...\n";

// Check if we can simulate the parameter detection
echo "\n1. Testing ParserMakeImageParams logic:\n";

// Simulate MediaWiki params structure
$mockParams = [
	'handler' => [
		'layers' => 'all',
		'width' => 500
	]
];

echo "Input params structure:\n";
print_r( $mockParams );

if ( isset( $mockParams['handler']['layers'] ) ) {
	$layersParam = $mockParams['handler']['layers'];
	echo "✓ layers parameter detected: $layersParam\n";

	if ( $layersParam === 'all' ) {
		echo "✓ layers=all condition matched\n";
	}
} else {
	echo "✗ layers parameter NOT found in params\n";
}

echo "\n2. Check if debugging is enabled:\n";
$parserHooks = file_get_contents( __DIR__ . '/src/Hooks/ParserHooks.php' );

if ( strpos( $parserHooks, 'error_log' ) !== false ) {
	echo "✓ Debug logging is enabled in ParserHooks\n";
} else {
	echo "✗ Debug logging not found in ParserHooks\n";
}

$transformHooks = file_get_contents( __DIR__ . '/src/LayersFileTransform.php' );

if ( strpos( $transformHooks, 'error_log' ) !== false ) {
	echo "✓ Debug logging is enabled in LayersFileTransform\n";
} else {
	echo "✗ Debug logging not found in LayersFileTransform\n";
}

echo "\n3. Check MediaWiki parameter structure:\n";
echo "MediaWiki might pass parameters differently than expected.\n";
echo "Common structures:\n";
echo "- \$params['layers'] (direct)\n";
echo "- \$params['handler']['layers'] (nested)\n";
echo "- \$params['file-link']['layers'] (file link)\n";

echo "\nTo debug:\n";
echo "1. Check MediaWiki error logs for 'Layers:' messages\n";
echo "2. Try adding layers=all to see if ParserMakeImageParams is called\n";
echo "3. Check if BitmapHandlerTransform receives the parameters\n";
