<?php
/**
 * Debug layer display for specific image
 */
require_once __DIR__ . '/../../maintenance/Maintenance.php';

class DebugLayerDisplay extends Maintenance {
	public function execute() {
		$this->output( "Debugging layer display for ImageTest02.jpg...\n" );

		$services = \MediaWiki\MediaWikiServices::getInstance();
		$repoGroup = $services->getRepoGroup();

		// Check if the file exists
		$file = $repoGroup->findFile( 'ImageTest02.jpg' );
		if ( !$file ) {
			$this->output( "ERROR: ImageTest02.jpg not found\n" );
			return;
		}

		$this->output( "File found: " . $file->getName() . "\n" );
		$this->output( "SHA1: " . $file->getSha1() . "\n" );

		// Check for layer data
		$db = new \MediaWiki\Extension\Layers\Database\LayersDatabase();
		$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

		$this->output( "Layer sets found: " . count( $layerSets ) . "\n" );

		if ( empty( $layerSets ) ) {
			$this->output( "No layer data found for this image.\n" );
			$this->output( "You need to:\n" );
			$this->output( "1. Go to the file page: http://localhost/index.php/File:ImageTest02.jpg\n" );
			$this->output( "2. Click 'Edit Layers' tab\n" );
			$this->output( "3. Add some layers and save\n" );
			return;
		}

		foreach ( $layerSets as $i => $layerSet ) {
			$this->output( "Layer set $i: Name='{$layerSet['ls_name']}', ID={$layerSet['ls_id']}\n" );

			$data = json_decode( $layerSet['ls_json_blob'], true );
			if ( $data && isset( $data['layers'] ) ) {
				$this->output( "  Layers: " . count( $data['layers'] ) . "\n" );
				foreach ( $data['layers'] as $j => $layer ) {
					$this->output( "    Layer $j: {$layer['type']} - {$layer['id']}\n" );
				}
			}
		}

		// Test wikitext parsing with new parser function
		$this->output( "\nTesting new parser function...\n" );
		$parser = $services->getParser();
		$user = $services->getUserFactory()->newAnonymous();
		$title = $services->getTitleFactory()->newFromText( 'Test' );

		$wikitext = '{{#layeredfile:ImageTest02.jpg|x500px|layers=on|Test image 2}}';
		$this->output( "Testing: $wikitext\n" );

		$parserOptions = \ParserOptions::newFromUser( $user );
		$parserOutput = $parser->parse( $wikitext, $title, $parserOptions );

		$html = $parserOutput->getRawText();
		$this->output( "Generated HTML contains layers URL: " . ( strpos( $html, 'thumb/layers/' ) !== false ? 'YES' : 'NO' ) . "\n" );

		if ( strpos( $html, 'thumb/layers/' ) !== false ) {
			$this->output( "SUCCESS: Layers are being processed with parser function!\n" );
			$this->output( "HTML: " . $html . "\n" );
		} else {
			$this->output( "Parser function HTML:\n" );
			$this->output( $html . "\n" );
		}
	}
}

$maintClass = DebugLayerDisplay::class;
require_once RUN_MAINTENANCE_IF_MAIN;
