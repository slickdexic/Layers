<?php
/**
 * Test actual transform hook
 */
require_once __DIR__ . '/../../maintenance/Maintenance.php';

class TestTransformHook extends Maintenance {
	public function execute() {
		$this->output( "Testing transform hook...\n" );

		// Get services
		$services = \MediaWiki\MediaWikiServices::getInstance();
		$repoGroup = $services->getRepoGroup();

		// Get test file
		$file = $repoGroup->findFile( 'ImageTest01.png' );
		if ( !$file ) {
			$this->output( "Test file not found\n" );
			return;
		}

		$this->output( "File: " . $file->getName() . "\n" );

		// Test thumbnail generation directly
		$this->output( "\nTesting thumbnail generation with layers...\n" );
		$params = [
			'width' => 300,
			'height' => 200,
			'layers' => [ 'API Test' ]  // Use array format as set by WikitextHooks
		];

		$thumb = $file->transform( $params );

		if ( $thumb && !$thumb->isError() ) {
			$this->output( "Thumbnail generated successfully!\n" );
			$this->output( "URL: " . $thumb->getUrl() . "\n" );
			$this->output( "Width: " . $thumb->getWidth() . "\n" );
			$this->output( "Height: " . $thumb->getHeight() . "\n" );

			// Check if this is a LayeredThumbnail
			if ( $thumb instanceof \MediaWiki\Extension\Layers\LayeredThumbnail ) {
				$this->output( "This is a LayeredThumbnail - layers are being processed!\n" );
			} else {
				$this->output( "This is a regular thumbnail: " . get_class( $thumb ) . "\n" );
			}
		} else {
			$this->output( "Thumbnail generation failed\n" );
			if ( $thumb && $thumb->isError() ) {
				$this->output( "Error: " . $thumb->toText() . "\n" );
			}
		}
	}
}

$maintClass = TestTransformHook::class;
require_once RUN_MAINTENANCE_IF_MAIN;
