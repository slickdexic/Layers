<?php

declare( strict_types=1 );

require $argv[1] . '/tests/phpunit/bootstrap.php';
require_once $argv[1] . '/src/Utility/AtomicPdfCache.php';

use MediaWiki\Extension\Layers\Utility\AtomicPdfCache;

[ , , $directory, $id, $outcome ] = $argv;
$result = AtomicPdfCache::publish( $directory . '/export.pdf', static function ( $temp ) use (
	$directory, $id, $outcome
) {
	file_put_contents( $temp, '%PDF-1.7 partial ' . $id );
	file_put_contents( $directory . '/ready-' . $id, 'ready' );
	$deadline = microtime( true ) + 15;
	do {
		clearstatcache( true, $directory . '/go-' . $id );
		if ( is_file( $directory . '/go-' . $id ) ) {
			if ( $outcome === 'success' ) {
				file_put_contents( $temp, "%PDF-1.7\ncomplete-" . $id . "\n%%EOF\n" );
				return true;
			}
			return false;
		}
		usleep( 10000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'Worker timed out waiting for test gate' );
} );
echo $result ? 'published' : 'refused';
