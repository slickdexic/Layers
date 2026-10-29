<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Utility\AtomicPdfCache;
use MediaWiki\Shell\Shell;

/** @covers \MediaWiki\Extension\Layers\Utility\AtomicPdfCache */
class AtomicPdfCacheNativeTest extends \MediaWikiIntegrationTestCase {
	public function testNativeConverterPublishesACompletePdf(): void {
		$convert = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			$this->markTestSkipped( 'ImageMagick is not configured' );
		}
		$dir = sys_get_temp_dir() . '/layers-cache-test-' . bin2hex( random_bytes( 8 ) );
		mkdir( $dir );
		$target = $dir . '/complete.pdf';
		try {
			$this->assertTrue( AtomicPdfCache::publish( $target, static function ( $path ) use ( $convert ) {
				$result = Shell::command( $convert, '-size', '2x2', 'xc:white', '-density', '150', 'pdf:' . $path )
					->includeStderr()->execute();
				return $result->getExitCode() === 0;
			} ) );
			$this->assertSame( '%PDF-', substr( file_get_contents( $target ), 0, 5 ) );
			$this->assertSame( [], glob( $dir . '/.layers-pdf-*' ) );
		} finally {
			if ( is_file( $target ) ) {
				unlink( $target );
			}
			rmdir( $dir );
		}
	}
}
