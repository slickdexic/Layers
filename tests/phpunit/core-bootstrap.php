<?php

// Use only in a disposable MediaWiki test environment. Core supplies test tables.
$installPath = getenv( 'MW_INSTALL_PATH' );
if ( !$installPath || !is_file( $installPath . '/tests/phpunit/bootstrap.integration.php' ) ) {
	throw new \RuntimeException( 'Set MW_INSTALL_PATH to a MediaWiki checkout with its test dependencies.' );
}
$testAutoload = getenv( 'LAYERS_CORE_TEST_AUTOLOAD' );
if ( $testAutoload ) {
	require_once $testAutoload;
}
require_once $installPath . '/tests/phpunit/bootstrap.integration.php';
