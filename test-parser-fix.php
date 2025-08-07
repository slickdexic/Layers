<?php

// Quick test to check parser function registration
echo "Testing parser function registration fix...\n";

// Check WikitextHooks.php for proper function signature
$hooksFile = file_get_contents( __DIR__ . '/src/Hooks/WikitextHooks.php' );

echo "Checking function signatures:\n";

if ( preg_match( '/setFunctionHook\s*\(\s*[\'"]layeredfile[\'"].*SFH_OBJECT_ARGS/', $hooksFile ) ) {
	echo "  ✓ setFunctionHook uses SFH_OBJECT_ARGS flag\n";
} else {
	echo "  ✗ setFunctionHook missing SFH_OBJECT_ARGS flag\n";
}

if ( preg_match( '/renderLayeredFile\s*\(\s*\$parser,\s*\$frame,\s*\$args/', $hooksFile ) ) {
	echo "  ✓ renderLayeredFile has correct signature (\$parser, \$frame, \$args)\n";
} else {
	echo "  ✗ renderLayeredFile has incorrect signature\n";
}

if ( strpos( $hooksFile, 'frame->expand' ) !== false ) {
	echo "  ✓ Function uses \$frame->expand() for argument processing\n";
} else {
	echo "  ✗ Function doesn't use \$frame->expand() for argument processing\n";
}

echo "\nConfiguration check:\n";

$extensionJson = file_get_contents( __DIR__ . '/extension.json' );
$config = json_decode( $extensionJson, true );

if ( isset( $config['ParserFunctions'] ) ) {
	echo "  ✗ ParserFunctions found in extension.json (should be removed)\n";
} else {
	echo "  ✓ No ParserFunctions in extension.json (correct)\n";
}

if ( isset( $config['Hooks']['ParserFirstCallInit'] ) ) {
	echo "  ✓ ParserFirstCallInit hook registered\n";
} else {
	echo "  ✗ ParserFirstCallInit hook not registered\n";
}

echo "\nTest complete.\n";
